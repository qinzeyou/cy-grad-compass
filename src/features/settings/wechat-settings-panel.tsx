import { useEffect, useState, type ReactElement } from 'react';
import { Alert, Button, Card, Checkbox, Form, Input, Select, Space, Spin, Typography } from 'antd';
import type { WechatConfigDto, WechatConnectionResult, WechatSession } from './wechat-types';

interface Values { sourcePath: string; executablePath?: string; baseUrl: string; apiToken?: string; autoStart: boolean; accountDir: string; decryptKey?: string; enabled: boolean; remarkPrefixes: string; selectedSessionIds: string[]; projectsRoot: string; folderTemplate: string; }

export function WechatSettingsPanel(): ReactElement {
  const [form] = Form.useForm<Values>();
  const [config, setConfig] = useState<WechatConfigDto | null>(null);
  const [weflowConfig, setWeFlowConfig] = useState<{ hasApiToken: boolean } | null>(null);
  const [sessions, setSessions] = useState<WechatSession[]>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [testing, setTesting] = useState(false); const [result, setResult] = useState<WechatConnectionResult | null>(null);
  const load = async () => { setLoading(true); try { const [value, flow] = await Promise.all([window.desktopApi.getWechatConfig(), window.desktopApi.getWeFlowConfig()]); setConfig(value); setWeFlowConfig(flow); form.setFieldsValue({ sourcePath: flow.sourcePath, baseUrl: flow.baseUrl, accountDir: value.accountDir, enabled: value.enabled, autoStart: flow.autoStart, remarkPrefixes: value.remarkPrefixes.join('、'), selectedSessionIds: value.selectedSessionIds, projectsRoot: value.projectsRoot, folderTemplate: value.folderTemplate }); } catch { setResult({ ok: false, message: '读取微信配置失败' }); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const save = async () => { const values = await form.validateFields(); setSaving(true); try { const [next, flow] = await Promise.all([window.desktopApi.saveWechatConfig({ ...values, remarkPrefixes: values.remarkPrefixes.split(/[、,，\s]+/).filter(Boolean) }), window.desktopApi.saveWeFlowConfig(values)]); setConfig(next); setWeFlowConfig(flow); form.setFieldValue('decryptKey', ''); form.setFieldValue('apiToken', ''); setResult({ ok: true, message: '微信与 WeFlow 配置已保存' }); } catch (error) { setResult({ ok: false, message: error instanceof Error ? error.message : '保存失败' }); } finally { setSaving(false); } };
  const test = async () => { setTesting(true); setResult(null); try { const value = await window.desktopApi.testWeFlowConnection(); setResult(value); if (value.ok) setSessions(await window.desktopApi.listWeFlowSessions()); } catch (error) { setResult({ ok: false, message: error instanceof Error ? error.message : '连接失败' }); } finally { setTesting(false); } };
  if (loading) return <Card><Spin /> <Typography.Text type="secondary">正在读取微信配置…</Typography.Text></Card>;
  return <Card title="微信数据源" extra={weflowConfig?.hasApiToken ? <Typography.Text type="success">API Token 已配置</Typography.Text> : null}>
    <Typography.Paragraph type="secondary">推荐通过 WeFlow 本地 HTTP API 读取聊天记录。请先在 WeFlow 中开启 API 服务并配置 Token；应用启动时可自动启动 WeFlow。</Typography.Paragraph>
    <Form form={form} layout="vertical" initialValues={{ enabled: false, remarkPrefixes: '鱼、书', folderTemplate: '{MM-DD}_{projectName}' }}>
      <Form.Item label="微信账号目录（旧版兼容）"><Space.Compact style={{ width: '100%' }}><Form.Item name="accountDir" noStyle><Input /></Form.Item><Button onClick={() => void window.desktopApi.selectDirectory().then((value) => value && form.setFieldValue('accountDir', value))}>选择</Button></Space.Compact></Form.Item>
      <Form.Item label="旧版 WCDB 解密 Key（兼容）" name="decryptKey" extra={config?.hasDecryptKey ? '留空保持当前 Key；推荐改用 WeFlow' : '仅旧版模式需要'}><Input.Password autoComplete="new-password" /></Form.Item>
      <Form.Item label="项目根目录"><Space.Compact style={{ width: '100%' }}><Form.Item name="projectsRoot" noStyle><Input /></Form.Item><Button onClick={() => void window.desktopApi.selectDirectory().then((value) => value && form.setFieldValue('projectsRoot', value))}>选择</Button></Space.Compact></Form.Item>
      <Form.Item label="WeFlow 源码目录" extra="选择 WeFlow 源码目录，应用会自动执行 npm install（缺依赖时）并启动 npm run dev"><Space.Compact style={{ width: '100%' }}><Form.Item name="sourcePath" noStyle><Input placeholder="例如 D:\project\work\scimon\WeFlow" /></Form.Item><Button onClick={() => void window.desktopApi.selectDirectory().then((value) => value && form.setFieldValue('sourcePath', value))}>选择</Button></Space.Compact></Form.Item>
      <Form.Item label="WeFlow API 地址" name="baseUrl" rules={[{ required: true, message: '请输入 API 地址' }]}><Input /></Form.Item>
      <Form.Item label="WeFlow API Token" name="apiToken" extra={weflowConfig?.hasApiToken ? '留空保持当前 Token' : '从 WeFlow 设置复制 Access Token'}><Input.Password autoComplete="new-password" /></Form.Item>
      <Form.Item name="autoStart" valuePropName="checked"><Checkbox>应用启动时自动启动 WeFlow</Checkbox></Form.Item>
      <Form.Item label="文件夹命名模板" name="folderTemplate" extra="可用：{YYYY}、{MM}、{DD}、{MM-DD}、{projectName}"><Input /></Form.Item>
      <Form.Item label="自动监听" name="enabled" valuePropName="checked"><Checkbox>应用启动后恢复监听</Checkbox></Form.Item>
      <Form.Item label="备注名前缀" name="remarkPrefixes"><Input placeholder="鱼、书" /></Form.Item>
      <Form.Item label="指定联系人/群聊" name="selectedSessionIds"><Select mode="multiple" options={sessions.map((item) => ({ value: item.id, label: `${item.name}${item.type === 'group' ? '（群聊）' : ''}` }))} placeholder="先测试连接后选择" /></Form.Item>
      <Space><Button type="primary" loading={saving} onClick={() => void save()}>保存微信配置</Button><Button loading={testing} onClick={() => void test()}>测试 WeFlow 连接</Button></Space>
    </Form>
    {result && <Alert style={{ marginTop: 14 }} type={result.ok ? 'success' : 'error'} showIcon message={result.message} description={result.sessionCount ? `读取到 ${result.sessionCount} 个会话` : undefined} />}
  </Card>;
}
