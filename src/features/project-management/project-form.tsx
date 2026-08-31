import { useState, type ReactElement } from 'react';
import { Button, Form, Input, Typography } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { createProject, selectDirectory } from './project-management-api';
import type { Project } from '../project-statistics/project-statistics-types';

interface ProjectFormProps { onCreated: (project: Project) => void; embedded?: boolean; }

// 中文注释：项目表单只负责收集名称和目标目录，文件系统访问统一通过 preload API 完成。
export function ProjectForm({ onCreated, embedded = false }: ProjectFormProps): ReactElement {
  const [form] = Form.useForm(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (values: { name: string; targetDirectory: string }) => { setBusy(true); setError(''); try { onCreated(await createProject(values)); form.resetFields(); } catch (reason) { setError(reason instanceof Error ? reason.message : '项目生成失败，请重试'); } finally { setBusy(false); } };
  const pick = async () => { const directory = await selectDirectory(); if (directory) form.setFieldValue('targetDirectory', directory); };
  return <section className={embedded ? 'form-panel form-panel-embedded' : 'panel form-panel'}>{!embedded && <div className="panel-heading"><div><Typography.Text className="eyebrow">NEW PROJECT</Typography.Text><Typography.Title level={4}>新建项目</Typography.Title></div></div>}<Form form={form} layout="vertical" className="project-form" onFinish={(values) => void submit(values)}><Form.Item label="项目名称" name="name" rules={[{ required: true, message: '请输入项目名称' }]}><Input maxLength={80} placeholder="例如：论文答辩系统" disabled={busy} /></Form.Item><Form.Item label="目标目录" name="targetDirectory" rules={[{ required: true, message: '请选择目标目录' }]}><Input readOnly placeholder="点击右侧按钮选择存放项目的目录" disabled={busy} addonAfter={<Button type="text" icon={<FolderOpenOutlined />} onClick={() => void pick()} disabled={busy}>选择</Button>} /></Form.Item>{error && <Typography.Text type="danger">{error}</Typography.Text>}<Button type="primary" htmlType="submit" loading={busy}>生成项目</Button></Form></section>;
}
