import { useState, type ReactElement } from 'react';
import { Button, Modal, Typography } from 'antd';
import type { FeatureExtractionCandidate } from './project-development-types';

type Props = { candidate: FeatureExtractionCandidate; onConfirm: (candidate: FeatureExtractionCandidate) => Promise<void>; onCancel: () => void };

export function SkillExtractionConfirmModal({ candidate, onConfirm, onCancel }: Props): ReactElement {
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await onConfirm(candidate); } finally { setSaving(false); } };
  return <Modal open title="保存功能到功能库" onCancel={onCancel} footer={[<Button key="cancel" onClick={onCancel}>取消</Button>, <Button key="confirm" type="primary" loading={saving} onClick={() => void save()}>保存到功能库</Button>]}><Typography.Title level={5}>{candidate.name}</Typography.Title><Typography.Paragraph type="secondary">{candidate.description}</Typography.Paragraph><Typography.Paragraph className="skill-extraction-preview">已生成完整技能说明，保存后可在功能库中选择并复用。</Typography.Paragraph></Modal>;
}
