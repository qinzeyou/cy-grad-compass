import { useState, type ReactElement } from 'react';
import { Button, Empty, List, Modal, Popconfirm, Tag, Typography } from 'antd';
import type { SkillFeature, SkillFeatureDetail } from './project-development-types';

type Props = { open: boolean; features: SkillFeature[]; onClose: () => void; onImport: () => void; onDelete: (id: string) => Promise<void>; getFeature: (id: string) => Promise<SkillFeatureDetail> };

export function SkillManagementModal({ open, features, onClose, onImport, onDelete, getFeature }: Props): ReactElement {
  const [detail, setDetail] = useState<SkillFeatureDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const showInstructions = async (id: string) => { setLoadingId(id); try { setDetail(await getFeature(id)); } finally { setLoadingId(null); } };
  return <Modal open={open} title="技能管理" footer={null} onCancel={onClose} width={680}><div className="skill-management-toolbar"><Typography.Text type="secondary">管理可复用的项目功能</Typography.Text><Button type="primary" onClick={onImport}>导入技能</Button></div>{features.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无技能，可导入技能" /> : <List dataSource={features} renderItem={(feature) => <List.Item actions={[<Button key="view" type="link" aria-label={`查看说明 ${feature.name}`} loading={loadingId === feature.id} onClick={() => void showInstructions(feature.id)}>查看说明</Button>, <Popconfirm key="delete" title={`删除功能“${feature.name}”？`} description="只从功能库移除，不会删除已写入项目的代码" okText="删除" cancelText="取消" onConfirm={() => onDelete(feature.id)}><Button type="link" danger aria-label={`删除功能 ${feature.name}`}>删除</Button></Popconfirm>]}><List.Item.Meta title={feature.name} description={<span className="skill-management-meta"><span>{feature.description || '暂无说明'}</span><span>来源技能包：{feature.skillName}</span><Tag>{feature.source === 'extracted' ? '提取' : '导入'}</Tag><Typography.Text type="secondary">更新于 {new Date(feature.updatedAt).toLocaleDateString('zh-CN')}</Typography.Text></span>} /></List.Item>} />}{detail !== null && <Modal open title={detail.name} footer={<Button onClick={() => setDetail(null)}>关闭</Button>} onCancel={() => setDetail(null)}><Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{detail.instructions}</Typography.Paragraph></Modal>}</Modal>;
}
