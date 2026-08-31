// 中文注释：设置页。当前只提供 AI 服务配置卡片，后续可扩展其他设置区块。
import type { ReactElement } from 'react';
import { Typography } from 'antd';
import { AiSettingsPanel } from './ai-settings-panel';

export function SettingsPage(): ReactElement {
  return (
    <div className="settings-layout">
      <div className="settings-heading">
        <Typography.Text className="eyebrow">SETTINGS</Typography.Text>
        <Typography.Title level={3} style={{ margin: '6px 0 0' }}>设置</Typography.Title>
        <Typography.Text type="secondary">配置 DeepSeek 服务并验证连通性</Typography.Text>
      </div>
      <AiSettingsPanel />
    </div>
  );
}
