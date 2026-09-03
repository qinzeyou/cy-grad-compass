import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, extname, join } from 'node:path';
import type { SkillDetail, SkillFeature, SkillFeatureDetail, SkillSource, SkillSummary } from './skill-types.js';

type SkillMetadata = SkillSummary & { deletedFeatureIds?: string[] };
type DiscoveredFeature = SkillFeature & { referenceNames: string[] };

function now(): string { return new Date().toISOString(); }

export class SkillService {
  private readonly skillsPath: string;

  constructor(userDataPath: string) {
    this.skillsPath = join(userDataPath, 'skills');
    mkdirSync(this.skillsPath, { recursive: true });
  }

  list(): SkillSummary[] {
    return (requireDirectory(this.skillsPath)).map((id) => {
      try { return this.readSummary(id); } catch { return null; }
    }).filter((item): item is SkillSummary => item !== null);
  }

  get(id: string): SkillDetail {
    const directory = this.directory(id);
    if (!existsSync(directory)) throw new Error('技能不存在');
    const metadata = this.readSummary(id);
    const instructionsPath = join(directory, 'SKILL.md');
    if (!existsSync(instructionsPath)) throw new Error('技能格式无效');
    return { ...metadata, instructions: readFileSync(instructionsPath, 'utf8') };
  }

  listFeatures(): SkillFeature[] {
    return this.list().flatMap((skill) => {
      const deleted = this.readMetadata(skill.id).deletedFeatureIds ?? [];
      return this.discoverFeatures(skill).filter((feature) => !deleted.includes(feature.id)).map(({ id, skillId, name, description, skillName, source, updatedAt }) => ({ id, skillId, name, description, skillName, source, updatedAt }));
    });
  }

  getFeature(id: string): SkillFeatureDetail {
    const skillId = featureSkillId(id);
    const skill = this.readSummary(skillId);
    const deleted = this.readMetadata(skillId).deletedFeatureIds ?? [];
    const feature = deleted.includes(id) ? undefined : this.discoverFeatures(skill).find((item) => item.id === id);
    if (!feature) throw new Error('功能不存在');
    const mainInstructions = readFileSync(join(this.directory(skillId), 'SKILL.md'), 'utf8');
    const referencesPath = join(this.directory(skillId), 'references');
    const instructions = [mainInstructions, ...feature.referenceNames.map((name) => readFileSync(join(referencesPath, name), 'utf8'))].join('\n\n---\n\n');
    const { referenceNames: _referenceNames, ...detail } = feature;
    return { ...detail, instructions };
  }

  deleteFeature(id: string): void {
    const feature = this.getFeature(id);
    const metadata = this.readMetadata(feature.skillId);
    this.writeMetadata(this.directory(feature.skillId), { ...metadata, deletedFeatureIds: [...(metadata.deletedFeatureIds ?? []), id] });
  }

  importFrom(sourcePath: string): SkillSummary {
    if (!existsSync(sourcePath) || !statSync(sourcePath).isDirectory()) throw new Error('技能目录不存在');
    const sourceMetadata = existsSync(join(sourcePath, 'skill.json')) ? readJson(join(sourcePath, 'skill.json')) : {};
    const instructionsPath = join(sourcePath, 'SKILL.md');
    if (!existsSync(instructionsPath)) throw new Error('技能格式无效');
    const id = randomUUID();
    const timestamp = now();
    const target = this.directory(id);
    cpSync(sourcePath, target, { recursive: true, errorOnExist: true });
    const metadata: SkillSummary = { id, name: typeof sourceMetadata.name === 'string' && sourceMetadata.name.trim() ? sourceMetadata.name.trim() : basename(sourcePath), description: typeof sourceMetadata.description === 'string' ? sourceMetadata.description.trim() : '', source: 'imported', createdAt: timestamp, updatedAt: timestamp };
    this.writeMetadata(target, metadata);
    return metadata;
  }

  saveExtracted(input: { name: string; description?: string; instructions: string }): SkillSummary {
    const name = input.name.trim();
    const instructions = input.instructions.trim();
    if (!name || !instructions) throw new Error('技能名称和说明不能为空');
    const id = randomUUID();
    const timestamp = now();
    const target = this.directory(id);
    mkdirSync(target, { recursive: true });
    const metadata: SkillSummary = { id, name, description: input.description?.trim() ?? '', source: 'extracted', createdAt: timestamp, updatedAt: timestamp };
    this.writeMetadata(target, metadata);
    writeFileSync(join(target, 'SKILL.md'), instructions, 'utf8');
    return metadata;
  }

  delete(id: string): void {
    const directory = this.directory(id);
    if (!existsSync(directory)) throw new Error('技能不存在');
    rmSync(directory, { recursive: true, force: true });
  }

  private directory(id: string): string {
    if (!/^[0-9a-f-]{16,}$/i.test(id)) throw new Error('技能编号无效');
    return join(this.skillsPath, id);
  }

  private readSummary(id: string): SkillSummary {
    const metadata = this.readMetadata(id);
    return { id, name: metadata.name, description: metadata.description, source: metadata.source, createdAt: metadata.createdAt, updatedAt: metadata.updatedAt };
  }

  private readMetadata(id: string): SkillMetadata {
    const metadata = readJson(join(this.directory(id), 'skill.json')) as Partial<SkillMetadata>;
    if (metadata.id !== id || typeof metadata.name !== 'string') throw new Error('技能格式无效');
    return { id, name: metadata.name, description: typeof metadata.description === 'string' ? metadata.description : '', source: (metadata.source as SkillSource) ?? 'imported', createdAt: String(metadata.createdAt ?? ''), updatedAt: String(metadata.updatedAt ?? ''), deletedFeatureIds: Array.isArray(metadata.deletedFeatureIds) ? metadata.deletedFeatureIds.filter((item): item is string => typeof item === 'string') : undefined };
  }

  private discoverFeatures(skill: SkillSummary): DiscoveredFeature[] {
    const referencesPath = join(this.directory(skill.id), 'references');
    const references = existsSync(referencesPath) ? readdirSync(referencesPath, { withFileTypes: true }).filter((item) => item.isFile() && extname(item.name) === '.md').map((item) => item.name) : [];
    const groups = new Map<string, string[]>();
    // ponytail: 先沿用 references/<功能>-<层>.md 约定；出现无法命名的功能时再给 skill.json 增加显式 features。
    for (const name of references) {
      const match = name.match(/^(.+?)-(?:core|backend|frontend|database)\.md$/i);
      if (!match?.[1]) continue;
      groups.set(match[1], [...(groups.get(match[1]) ?? []), name]);
    }
    if (groups.size === 0) return [{ id: `${skill.id}:main`, skillId: skill.id, name: skill.name, description: skill.description, skillName: skill.name, source: skill.source, updatedAt: skill.updatedAt, referenceNames: [] }];
    return [...groups.entries()].map(([key, referenceNames]) => {
      const coreName = referenceNames.find((name) => name.toLowerCase() === `${key.toLowerCase()}-core.md`) ?? referenceNames[0];
      const content = readFileSync(join(referencesPath, coreName), 'utf8');
      const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? key;
      const name = key === 'collaborative-filtering' ? '协同过滤推荐' : heading.replace(/(?:核心|后端适配|前端适配|数据库适配)$/u, '').trim();
      const description = key === 'collaborative-filtering' ? '基于 ItemCF 的个性化推荐功能' : firstParagraph(content) || skill.description;
      return { id: `${skill.id}:${key}`, skillId: skill.id, name, description, skillName: skill.name, source: skill.source, updatedAt: skill.updatedAt, referenceNames: referenceNames.sort() };
    });
  }

  private writeMetadata(directory: string, metadata: SkillMetadata): void { writeFileSync(join(directory, 'skill.json'), JSON.stringify(metadata, null, 2), 'utf8'); }
}

function featureSkillId(id: string): string {
  const separator = id.indexOf(':');
  if (separator <= 0 || separator === id.length - 1) throw new Error('功能编号无效');
  return id.slice(0, separator);
}

function firstParagraph(content: string): string {
  return content.split(/\r?\n/).map((line) => line.trim()).find((line) => line !== '' && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('```')) ?? '';
}

function requireDirectory(path: string): string[] {
  try { return readdirSync(path, { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => item.name); } catch { return []; }
}

function readJson(path: string): Record<string, unknown> {
  try { return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>; } catch { throw new Error('技能格式无效'); }
}
