import type { ReactElement } from 'react';
import type { DevelopmentSession } from './project-development-types';

type Props = {
  sessions: DevelopmentSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
};

const STATUS_LABELS = { idle: '待开始', queued: '排队中', running: '运行中', completed: '已完成', stopped: '已停止' } as const;

// 中文注释：左栏只处理会话切换，运行状态由父组件统一维护。
export function DevelopmentSessionList({ sessions, activeId, onSelect, onCreate }: Props): ReactElement {
  return (
    <aside className="development-sessions">
      <div className="development-sidebar-head">
        <div><span className="eyebrow">PROJECT DEVELOPMENT</span><h2>开发会话</h2></div>
        <button className="icon-button" type="button" onClick={onCreate} aria-label="新建开发会话">＋</button>
      </div>
      <div className="session-list">
        {sessions.map((session) => (
          <button
            className={session.id === activeId ? 'session-item active' : 'session-item'}
            key={session.id}
            type="button"
            onClick={() => onSelect(session.id)}
            aria-current={session.id === activeId ? 'page' : undefined}
          >
            <span className={`session-status ${session.run.status}`} />
            <span className="session-copy"><strong>{session.title}</strong><small>{STATUS_LABELS[session.run.status]} · {session.updatedAt}</small></span>
          </button>
        ))}
      </div>
      <div className="development-sidebar-foot">模拟工作区 · 不会修改项目文件</div>
    </aside>
  );
}
