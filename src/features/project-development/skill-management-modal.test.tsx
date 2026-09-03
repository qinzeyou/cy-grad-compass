import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { SkillManagementModal } from './skill-management-modal';

const feature = { id: 'skill-1:collaborative-filtering', skillId: 'skill-1', name: '协同过滤推荐', description: '个性化推荐功能', skillName: 'caiya-core', source: 'imported' as const, updatedAt: '2026-01-02T00:00:00.000Z' };

describe('技能管理弹窗', () => {
  test('展示技能信息并支持查看说明和删除', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<SkillManagementModal open features={[feature]} onClose={() => undefined} onImport={() => undefined} onDelete={onDelete} getFeature={async () => ({ ...feature, instructions: '# 协同过滤推荐' })} />);
    expect(screen.getByText('协同过滤推荐')).toBeTruthy();
    expect(screen.getByText(/来源技能包：caiya-core/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '查看说明 协同过滤推荐' }));
    expect(await screen.findByText('# 协同过滤推荐')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '删除功能 协同过滤推荐' }));
    fireEvent.click(screen.getAllByRole('button', { name: /删\s*除/ })[1] as HTMLButtonElement);
    expect(onDelete).toHaveBeenCalledWith('skill-1:collaborative-filtering');
  });
});
