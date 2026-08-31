// 中文注释：AI 设置面板。负责配置的读取、保存与连通性测试三种独立交互，
// 三种操作各有独立 loading；真实 API Key 不进入页面回显，只显示 hasApiKey 状态。
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Alert, Button, Card, Form, Input, Space, Spin, Typography } from 'antd';
import { fetchAiConfig, saveAiConfig, testAiConnection } from './settings-api';
import type { AiConnectionErrorCode, AiConnectionResult } from './settings-types';

const ERROR_CODE_LABELS: Record<AiConnectionErrorCode, string> = {
  AI_CONFIG: '配置不合法',
  AI_TIMEOUT: '连接超时',
  AI_HTTP: '服务返回错误',
  AI_RESPONSE: '响应格式异常',
  AI_NETWORK: '网络连接失败',
};

function formatTestResult(result: AiConnectionResult): { type: 'success' | 'error'; text: string } {
  if (result.ok) {
    return { type: 'success', text: `连接成功，耗时 ${result.elapsedMs} ms（模型 ${result.model}）` };
  }
  return { type: 'error', text: `[${result.code}] ${ERROR_CODE_LABELS[result.code]}：${result.message}` };
}

interface AiFormValues {
  model: string;
  apiBaseUrl: string;
  apiKey?: string;
}

type LoadState = 'loading' | 'ready' | 'error';

// 中文注释：表单加载时从主进程读取已保存配置；读取失败时允许重新加载，
// 但绝不在表单里回显真实 Key。
export function AiSettingsPanel(): ReactElement {
  const [form] = Form.useForm<AiFormValues>();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<AiConnectionResult | null>(null);

  const load = useCallback(() => {
    setLoadState('loading');
    fetchAiConfig()
      .then((dto) => {
        form.setFieldsValue({ model: dto.model, apiBaseUrl: dto.apiBaseUrl, apiKey: '' });
        setHasApiKey(dto.hasApiKey);
        setLoadState('ready');
      })
      .catch(() => {
        setLoadState('error');
      });
  }, [form]);

  useEffect(() => {
    load();
  }, [load]);

  // 中文注释：保存成功即清空 Key 输入框，避免密钥长期保留在表单状态中。
  const handleSave = useCallback(async () => {
    const values = await form.validateFields();
    setSaving(true);
    setSaveNotice(null);
    try {
      const dto = await saveAiConfig({
        provider: 'deepseek',
        model: values.model,
        apiBaseUrl: values.apiBaseUrl,
        apiKey: values.apiKey?.trim() || undefined,
      });
      form.setFieldValue('apiKey', '');
      setHasApiKey(dto.hasApiKey);
      setSaveNotice({ type: 'success', text: '配置已保存' });
    } catch (error) {
      setSaveNotice({ type: 'error', text: error instanceof Error ? error.message : '保存失败，请稍后重试' });
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testAiConnection());
    } catch (error) {
      setTestResult({
        ok: false,
        code: 'AI_NETWORK',
        message: error instanceof Error ? error.message : '无法连接 DeepSeek 服务，请稍后重试',
      });
    } finally {
      setTesting(false);
    }
  }, []);

  if (loadState === 'loading') {
    return (
      <div className="settings-loading">
        <Spin size="large" />
        <Typography.Text type="secondary">正在读取 AI 配置…</Typography.Text>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <Card className="settings-card">
        <Alert
          type="error"
          showIcon
          message="读取 AI 配置失败"
          description="无法读取本地配置文件，已按默认配置继续。请稍后重试或直接保存新配置。"
          action={<Button onClick={load}>重新加载</Button>}
        />
      </Card>
    );
  }

  return (
    <Card className="settings-card" title="AI 服务">
      <Form
        form={form}
        layout="vertical"
        initialValues={{ model: 'deepseek-chat', apiBaseUrl: 'https://api.deepseek.com' }}
      >
        <Form.Item label="Provider">
          <Input value="DeepSeek" disabled />
        </Form.Item>
        <Form.Item label="模型" name="model" rules={[{ required: true, message: '请输入模型名称' }]}>
          <Input placeholder="deepseek-chat" />
        </Form.Item>
        <Form.Item label="API 地址" name="apiBaseUrl" rules={[{ required: true, message: '请输入 API 地址' }]}>
          <Input placeholder="https://api.deepseek.com" />
        </Form.Item>
        <Form.Item
          label="API Key"
          name="apiKey"
          extra={
            hasApiKey
              ? '已配置 API Key：留空保存保持不变，输入新值可替换；密钥不会回显。'
              : '密钥只保存在本机配置文件中，不会回显。'
          }
        >
          <Input.Password
            placeholder={hasApiKey ? '已配置，输入新值可替换' : '请输入 DeepSeek API Key'}
            autoComplete="new-password"
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" loading={saving} onClick={() => void handleSave()}>
              保存配置
            </Button>
            <Button loading={testing} disabled={!hasApiKey} onClick={() => void handleTest()}>
              测试连接
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {saveNotice !== null && (
        <Alert
          className="settings-alert"
          type={saveNotice.type}
          showIcon
          message={saveNotice.text}
          closable
          onClose={() => setSaveNotice(null)}
        />
      )}

      {testResult !== null && (() => {
        const rendered = formatTestResult(testResult);
        return <Alert className="settings-alert" type={rendered.type} showIcon message={rendered.text} />;
      })()}
    </Card>
  );
}
