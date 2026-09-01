import { useEffect, useState, type ReactElement } from 'react';
import { Alert, Button, Card, Checkbox, Form, Input, Select, Space, Spin, Typography } from 'antd';
import type { WechatConfigDto, WechatConnectionResult, WechatSession } from './wechat-types';

interface Values { accountDir: string; decryptKey?: string; enabled: boolean; remarkPrefixes: string; selectedSessionIds: string[]; projectsRoot: string; folderTemplate: string; }

export function WechatSettingsPanel(): ReactElement {
  const [form] = Form.useForm<Values>();
  const [config, setConfig] = useState<WechatConfigDto | null>(null);
  const [sessions, setSessions] = useState<WechatSession[]>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [testing, setTesting] = useState(false); const [result, setResult] = useState<WechatConnectionResult | null>(null);
  const load = async () => { setLoading(true); try { const value = await window.desktopApi.getWechatConfig(); setConfig(value); form.setFieldsValue({ accountDir: value.accountDir, enabled: value.enabled, remarkPrefixes: value.remarkPrefixes.join('、'), selectedSessionIds: value.selectedSessionIds, projectsRoot: value.projectsRoot, folderTemplate: value.folderTemplate }); } catch { setResult({ ok: false, message: '读取微信配置失败' }); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const save = async () => { const values = await form.validateFields(); setSaving(true); try { const next = await window.desktopApi.saveWechatConfig({ ...values, remarkPrefixes: values.remarkPrefixes.split(/[、,，\s]+/).filter(Boolean) }); setConfig(next); form.setFieldValue('decryptKey', ''); setResult({ ok: true, message: '微信配置已保存' }); } catch (error) { setResult({ ok: false, message: error instanceof Error ? error.message : '保存失败' }); } finally { setSaving(false); } };
  const test = async () => { setTesting(true); setResult(null); try { const value = await window.desktopApi.testWechatConnection(); setResult(value); if (value.ok) setSessions(await window.desktopApi.listWechatSessions()); } catch (error) { setResult({ ok: false, message: error instanceof Error ? error.message : '连接失败' }); } finally { setTesting(false); } };
  if (loading) return <Card><Spin /> <Typography.Text type="secondary">正在读取微信配置…</Typography.Text></Card>;
  return <Card title="微信数据源">
    <Typography.Paragraph type="secondary">当前项目直接读取微信数据库并监听新消息，不需要启动其他项目。</Typography.Paragraph>
    <Form form={form} layout="vertical" initialValues={{ enabled: false, remarkPrefixes: '鱼、书', folderTemplate: '{MM-DD}_{projectName}' }}>
      <Form.Item label="微信账号目录"><Space.Compact style={{ width: '100%' }}><Form.Item name="accountDir" noStyle><Input /></Form.Item><Button onClick={() => void window.desktopApi.selectDirectory().then((value) => value && form.setFieldValue('accountDir', value))}>选择</Button></Space.Compact></Form.Item>
      <Form.Item label="WCDB 解密 Key" name="decryptKey" extra={config?.hasDecryptKey ? '留空保持当前 Key' : '请输入 64 位解密 Key'}><Input.Password autoComplete="new-password" /></Form.Item>
      <Form.Item label="项目根目录"><Space.Compact style={{ width: '100%' }}><Form.Item name="projectsRoot" noStyle><Input /></Form.Item><Button onClick={() => void window.desktopApi.selectDirectory().then((value) => value && form.setFieldValue('projectsRoot', value))}>选择</Button></Space.Compact></Form.Item>
      <Form.Item label="文件夹命名模板" name="folderTemplate" extra="可用：{YYYY}、{MM}、{DD}、{MM-DD}、{projectName}"><Input /></Form.Item>
      <Form.Item label="自动监听" name="enabled" valuePropName="checked"><Checkbox>应用启动后恢复监听</Checkbox></Form.Item>
      <Form.Item label="备注名前缀" name="remarkPrefixes"><Input placeholder="鱼、书" /></Form.Item>
      <Form.Item label="指定联系人/群聊" name="selectedSessionIds"><Select mode="multiple" options={sessions.map((item) => ({ value: item.id, label: `${item.name}${item.type === 'group' ? '（群聊）' : ''}` }))} placeholder="先测试连接后选择" /></Form.Item>
      <Space><Button type="primary" loading={saving} onClick={() => void save()}>保存微信配置</Button><Button loading={testing} onClick={() => void test()}>测试微信连接</Button></Space>
    </Form>
    {result && <Alert style={{ marginTop: 14 }} type={result.ok ? 'success' : 'error'} showIcon message={result.message} description={result.sessionCount ? `读取到 ${result.sessionCount} 个会话` : undefined} />}
  </Card>;
}
