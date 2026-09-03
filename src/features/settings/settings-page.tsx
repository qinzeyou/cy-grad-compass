// 中文注释：设置页。当前只提供 AI 服务配置卡片，后续可扩展其他设置区块。
import type { ReactElement } from 'react';
import { AiSettingsPanel } from './ai-settings-panel';
import { WechatSettingsPanel } from './wechat-settings-panel';

interface SettingsPageProps { section: 'ai' | 'wechat'; }

export function SettingsPage({ section }: SettingsPageProps): ReactElement {
  return (
    <div className="settings-layout settings-layout-centered">
      {section === 'ai' ? <AiSettingsPanel /> : <WechatSettingsPanel />}
    </div>
  );
}
