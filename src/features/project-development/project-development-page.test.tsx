import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { installDesktopApiMock } from '../../test/desktop-api-mock';
import { ProjectDevelopmentPage } from './project-development-page';
import type { DevelopmentEventEnvelope } from './project-development-types';

Element.prototype.scrollIntoView = () => undefined;

describe('项目开发页功能封装', () => {
  beforeEach(() => localStorage.clear());
  test('新增工作区会登记选中的本地项目目录', async () => {
    const registerProjectDirectory = vi.fn(async () => ({ id: 'p2', name: '本地项目', path: 'E:/local-project', status: 'in-progress' as const, templateId: 'external', createdAt: '', updatedAt: '' }));
    installDesktopApiMock({
      listProjects: vi.fn(async () => []),
      listDevelopmentSessions: vi.fn(async () => []),
      listSkillFeatures: vi.fn(async () => []),
      selectWorkspaceDirectory: vi.fn(async () => 'E:/local-project'),
      registerProjectDirectory,
    });

    render(<ProjectDevelopmentPage />);
    fireEvent.click(await screen.findByRole('button', { name: /新增工作区/ }));

    await waitFor(() => expect(registerProjectDirectory).toHaveBeenCalledWith('E:/local-project'));
    expect(await screen.findByText('本地项目')).toBeTruthy();
  });

  test('确认候选后保存功能并刷新功能库', async () => {
    let listener: ((event: DevelopmentEventEnvelope) => void) | undefined;
    const listSkillFeatures = vi.fn(async () => []);
    const extractSkill = vi.fn(async () => ({ id: 'skill-1', name: '个性化推荐', description: '复用推荐实现', source: 'extracted' as const, createdAt: '', updatedAt: '' }));
    installDesktopApiMock({
      listProjects: vi.fn(async () => [{ id: 'p1', name: '示例项目', path: 'C:/demo', status: 'in-progress' as const, templateId: 'external', createdAt: '', updatedAt: '' }]),
      listDevelopmentSessions: vi.fn(async () => [{ id: 's1', projectId: 'p1', projectName: '示例项目', title: '需求讨论', codexThreadId: 'thread-1', phase: 'discussion' as const, createdAt: '', updatedAt: '' }]),
      getDevelopmentSession: vi.fn(async () => ({ id: 's1', projectId: 'p1', projectName: '示例项目', title: '需求讨论', codexThreadId: 'thread-1', phase: 'discussion' as const, createdAt: '', updatedAt: '', messages: [] })),
      listSkillFeatures,
      extractSkill,
      subscribeDevelopmentEvents: vi.fn((next) => { listener = next; return () => undefined; }),
    });

    render(<ProjectDevelopmentPage />);
    await screen.findByRole('heading', { name: '需求讨论' });
    act(() => listener?.({ sessionId: 's1', event: { type: 'feature-extraction-ready', candidate: { name: '个性化推荐', description: '复用推荐实现', instructions: '# 个性化推荐' } } }));

    expect(await screen.findByRole('dialog', { name: '保存功能到功能库' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '保存到功能库' }));
    await waitFor(() => expect(extractSkill).toHaveBeenCalledWith({ name: '个性化推荐', description: '复用推荐实现', instructions: '# 个性化推荐' }));
    await waitFor(() => expect(listSkillFeatures).toHaveBeenCalledTimes(2));
  });

  test('会话排序写入本地存储并在重新挂载时恢复', async () => {
    const first = { id: 's1', projectId: 'p1', projectName: '示例项目', title: '第一个会话', codexThreadId: null, phase: 'discussion' as const, createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z' };
    const second = { ...first, id: 's2', title: '第二个会话', updatedAt: '2026-09-03T00:00:00.000Z' };
    const api = installDesktopApiMock({
      listProjects: vi.fn(async () => [{ id: 'p1', name: '示例项目', path: 'C:/demo', status: 'in-progress' as const, templateId: 'external', createdAt: '', updatedAt: '' }]),
      listDevelopmentSessions: vi.fn(async () => [first, second]),
      getDevelopmentSession: vi.fn(async (id) => ({ ...(id === 's1' ? first : second), messages: [] })),
      listSkillFeatures: vi.fn(async () => []),
    });

    const view = render(<ProjectDevelopmentPage />);
    await screen.findByText('第二个会话');
    const source = view.container.querySelector('[data-session-id="s1"]') as HTMLElement;
    const target = view.container.querySelector('[data-session-id="s2"]') as HTMLElement;
    fireEvent.dragStart(source, { dataTransfer: { effectAllowed: 'move' } });
    fireEvent.drop(target, { dataTransfer: { dropEffect: 'move' } });
    await waitFor(() => expect(JSON.parse(localStorage.getItem('project-development.session-order.v1') ?? '{}').p1).toEqual(['s2', 's1']));
    expect(api.listDevelopmentSessions).toHaveBeenCalled();

    view.unmount();
    const restored = render(<ProjectDevelopmentPage />);
    await waitFor(() => expect([...restored.container.querySelectorAll('.session-name')].map((item) => item.textContent)).toEqual(['第二个会话', '第一个会话']));
  });

});
