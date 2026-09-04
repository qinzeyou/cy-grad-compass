import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { SkillExtractionConfirmModal } from './skill-extraction-confirm-modal';

describe('功能封装确认弹窗', () => {
  test('确认后保存候选，取消不保存', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();
    render(<SkillExtractionConfirmModal candidate={{ name: '个性化推荐', description: '复用推荐实现', instructions: '# 个性化推荐' }} onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByText('个性化推荐')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '保存到功能库' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ name: '个性化推荐', description: '复用推荐实现', instructions: '# 个性化推荐' }));
    fireEvent.click(screen.getByRole('button', { name: /取\s*消/ }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
