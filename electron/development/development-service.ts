import { randomUUID } from 'node:crypto';
import { statSync } from 'node:fs';
import { ProjectRepository } from '../database/project-repository.js';
import { DevelopmentRepository } from './development-repository.js';
import { CodexController, type CodexRunRequest } from './codex-controller.js';
import type {
  DevelopmentEvent,
  FeatureExtractionCandidate,
  DevelopmentMessage,
  DevelopmentSession,
  DevelopmentSessionDetail,
} from './development-types.js';
import type { SkillService } from '../skills/skill-service.js';

const DEVELOPMENT_PROMPT = '需求已经确认。请先检查当前工作区：如果是空项目或模板项目，就从 0 到 1 建立所需结构；如果已有代码，则在现有实现基础上增量修改或添加功能。遵循项目现有规范，完成后运行必要检查并汇报结果。';
const CONTINUE_PROMPT = '请继续完成当前项目开发任务。先检查当前工作区和已有改动，从上次中断的位置继续，保留已完成内容，不要覆盖无关代码，完成后运行必要检查并汇报结果。';
const FEATURE_EXTRACTION_PROMPT = `你正在进行功能封装。只能读取当前工作区，严禁创建、修改或删除任何文件。根据用户要求定位并分析可复用功能，先用中文说明分析结果。最后必须追加一个 <skill-candidate> JSON 对象，字段为 name、description、instructions；instructions 必须是完整中文 SKILL.md，含 frontmatter、适用场景、扫描步骤、实现逻辑、验证方式。除该标签外不要输出候选 JSON。`;
const FEATURE_EXTRACTION_MISSING = 'AI 未生成可保存的功能说明，请重新描述要封装的功能';

function currentTime(): string { return new Date().toISOString(); }

function ensureProjectDirectory(path: string): void {
  try {
    if (!statSync(path).isDirectory()) throw new Error('项目目录不存在');
  } catch { throw new Error('项目目录不存在'); }
}

function cleanMessage(text: string): string {
  const value = text.trim();
  if (!value) throw new Error('消息不能为空');
  if (value.length > 20_000) throw new Error('消息不能超过 20000 个字符');
  return value;
}

type ControllerLike = Pick<CodexController, 'run' | 'stop' | 'subscribe'>;
export type DevelopmentMode = 'discussion' | 'development' | 'feature-extraction';

function featureCandidate(text: string): { content: string; candidate?: FeatureExtractionCandidate; error?: string } {
  const match = /<skill-candidate>\s*([\s\S]*?)\s*<\/skill-candidate>/i.exec(text);
  if (match === null) return { content: text.trim(), error: FEATURE_EXTRACTION_MISSING };
  try {
    const value = JSON.parse(match[1]) as Partial<FeatureExtractionCandidate>;
    if (typeof value.name !== 'string' || !value.name.trim() || typeof value.description !== 'string' || !value.description.trim() || typeof value.instructions !== 'string' || value.instructions.trim().length < 20) throw new Error('invalid');
    return { content: text.replace(match[0], '').trim(), candidate: { name: value.name.trim(), description: value.description.trim(), instructions: value.instructions.trim() } };
  } catch {
    return { content: text.replace(match[0], '').trim(), error: 'AI 返回的功能说明格式无效，请重新尝试' };
  }
}

// 中文注释：服务层是项目、数据库和 Codex 之间的唯一业务边界，渲染进程不直接操作它们。
export class DevelopmentService {
  private readonly unsubscribeController: () => void;
  private activeSessionId: string | null = null;
  private pendingDevelopmentSessionId: string | null = null;
  private featureExtractionSessionId: string | null = null;
  private featureExtractionSucceeded = false;
  private featureExtractionError = FEATURE_EXTRACTION_MISSING;

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly developmentRepository: DevelopmentRepository,
    private readonly controller: ControllerLike,
    private readonly publish: (sessionId: string, event: DevelopmentEvent) => void,
    private readonly skillService?: SkillService,
  ) {
    this.unsubscribeController = controller.subscribe((event) => this.handleEvent(event));
  }

  listSessions(): DevelopmentSession[] { return this.developmentRepository.listSessions(); }

  getSession(id: string): DevelopmentSessionDetail {
    const session = this.developmentRepository.getSession(id);
    if (session === null) throw new Error('开发会话不存在');
    return session;
  }

  deleteSession(id: string): void {
    this.getSession(id);
    if (this.activeSessionId === id) throw new Error('运行中的会话不能删除');
    this.developmentRepository.deleteSession(id);
  }

  deleteWorkspace(projectId: string): void {
    if (this.projectRepository.findById(projectId) === null) throw new Error('项目不存在');
    if (this.activeSessionId !== null && this.developmentRepository.getSession(this.activeSessionId)?.projectId === projectId) {
      throw new Error('运行中的会话不能删除');
    }
    this.developmentRepository.deleteWorkspace(projectId, () => this.projectRepository.delete(projectId));
  }

  createSession(projectId: string): DevelopmentSessionDetail {
    const project = this.projectRepository.findById(projectId);
    if (project === null) throw new Error('项目不存在');
    ensureProjectDirectory(project.path);
    const timestamp = currentTime();
    this.developmentRepository.createSession({ id: randomUUID(), projectId, title: project.name, phase: 'discussion', createdAt: timestamp, updatedAt: timestamp });
    return this.getSessionByProjectAndTime(projectId, timestamp);
  }

  async sendMessage(sessionId: string, text: string, mode?: DevelopmentMode, skillId?: string): Promise<void> {
    const session = this.getSession(sessionId);
    const content = cleanMessage(text);
    if (this.activeSessionId !== null) throw new Error('已有 AI 任务正在运行');
    const timestamp = currentTime();
    const message: DevelopmentMessage = { id: randomUUID(), sessionId, role: 'user', content, createdAt: timestamp };
    this.developmentRepository.addMessage(message);
    if (session.messages.length === 0) this.developmentRepository.updateTitle(sessionId, content.slice(0, 22), timestamp);
    ensureProjectDirectory(this.projectPath(session.projectId));
    // 中文注释：下拉模式只影响当前消息意图；真正的写权限必须由“确认开发”切换会话阶段，避免误触直接改文件。
    const extraction = mode === 'feature-extraction';
    const selectedMode = extraction ? 'feature-extraction' : session.phase === 'development' ? 'development' : 'discussion';
    const skillPrompt = skillId === undefined ? '' : `\n\n请参考技能“${this.skillService?.get(skillId).name ?? ''}”：\n${this.skillService?.get(skillId).instructions ?? ''}`;
    if (extraction) {
      this.featureExtractionSessionId = sessionId;
      this.featureExtractionSucceeded = false;
      this.featureExtractionError = FEATURE_EXTRACTION_MISSING;
    }
    const prompt = extraction ? `${FEATURE_EXTRACTION_PROMPT}\n\n用户要求：${content}` : `[当前模式：${selectedMode}]\n${content}${skillPrompt}`;
    const request: CodexRunRequest = { projectPath: this.projectPath(session.projectId), prompt, sandbox: selectedMode === 'development' ? 'workspace-write' : 'read-only', ...(session.codexThreadId === null ? {} : { threadId: session.codexThreadId }) };
    try { await this.run(sessionId, request); } finally {
      if (this.featureExtractionSessionId === sessionId) {
        this.featureExtractionSessionId = null;
        this.featureExtractionSucceeded = false;
        this.featureExtractionError = FEATURE_EXTRACTION_MISSING;
      }
    }
  }

  async startDevelopment(sessionId: string, skillId?: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (session.codexThreadId === null) throw new Error('请先与 AI 讨论需求');
    if (this.activeSessionId !== null) throw new Error('已有 AI 任务正在运行');
    ensureProjectDirectory(this.projectPath(session.projectId));
    this.pendingDevelopmentSessionId = sessionId;
    const skillPrompt = skillId === undefined ? '' : `\n\n请参考技能“${this.skillService?.get(skillId).name ?? ''}”：\n${this.skillService?.get(skillId).instructions ?? ''}`;
    await this.run(sessionId, { projectPath: this.projectPath(session.projectId), threadId: session.codexThreadId, prompt: DEVELOPMENT_PROMPT + skillPrompt, sandbox: 'workspace-write' });
  }

  async continueDevelopment(sessionId: string): Promise<void> {
    const session = this.getSession(sessionId);
    if (session.codexThreadId === null) throw new Error('没有可继续的开发线程');
    if (this.activeSessionId !== null) throw new Error('已有 AI 任务正在运行');
    ensureProjectDirectory(this.projectPath(session.projectId));
    await this.run(sessionId, { projectPath: this.projectPath(session.projectId), threadId: session.codexThreadId, prompt: CONTINUE_PROMPT, sandbox: 'workspace-write' });
  }

  async pause(sessionId: string): Promise<void> {
    if (this.activeSessionId !== sessionId) return;
    await this.controller.stop(true);
  }

  async stop(sessionId: string): Promise<void> {
    if (this.activeSessionId !== sessionId) return;
    await this.controller.stop();
  }

  async dispose(): Promise<void> {
    if (this.activeSessionId !== null) await this.controller.stop();
    this.unsubscribeController();
  }

  private async run(sessionId: string, request: CodexRunRequest): Promise<void> {
    this.activeSessionId = sessionId;
    try { await this.controller.run(request); } finally { if (this.activeSessionId === sessionId) this.activeSessionId = null; }
  }

  private projectPath(projectId: string): string {
    const project = this.projectRepository.findById(projectId);
    if (project === null) throw new Error('项目不存在');
    return project.path;
  }

  private getSessionByProjectAndTime(projectId: string, timestamp: string): DevelopmentSessionDetail {
    const session = this.developmentRepository.listSessions().find((item) => item.projectId === projectId && item.createdAt === timestamp);
    if (session === undefined) throw new Error('开发会话创建失败');
    return this.getSession(session.id);
  }

  private handleEvent(event: DevelopmentEvent): void {
    const sessionId = this.activeSessionId;
    if (sessionId === null) return;
    if (event.type === 'thread-started') this.developmentRepository.saveThreadId(sessionId, event.threadId, currentTime());
    if (event.type === 'assistant-message') {
      if (this.featureExtractionSessionId === sessionId) {
        const result = featureCandidate(event.text);
        const content = result.content || '功能分析完成，等待保存确认。';
        this.developmentRepository.addMessage({ id: randomUUID(), sessionId, role: 'assistant', content, createdAt: currentTime() });
        this.publish(sessionId, { type: 'assistant-message', text: content });
        if (result.candidate) {
          this.featureExtractionSucceeded = true;
          this.publish(sessionId, { type: 'feature-extraction-ready', candidate: result.candidate });
        } else this.featureExtractionError = result.error ?? '功能封装失败，请重试';
        return;
      }
      this.developmentRepository.addMessage({ id: randomUUID(), sessionId, role: 'assistant', content: event.text, createdAt: currentTime() });
    }
    if (event.type === 'turn-started' && this.pendingDevelopmentSessionId === sessionId) {
      this.developmentRepository.updatePhase(sessionId, 'development', currentTime());
      this.pendingDevelopmentSessionId = null;
    }
    if (event.type === 'process-exited') {
      if (this.featureExtractionSessionId === sessionId && !this.featureExtractionSucceeded && !event.stopped && event.exitCode === 0) this.publish(sessionId, { type: 'feature-extraction-failed', message: this.featureExtractionError });
      this.activeSessionId = null;
      this.pendingDevelopmentSessionId = null;
    }
    this.publish(sessionId, event);
  }
}
