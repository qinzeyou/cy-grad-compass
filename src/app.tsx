import { useEffect, useState, type ReactElement } from 'react';

const navItems = ['仪表盘', '项目管理', '模板管理'];

// 中文注释：MVP 首页先用内存数据展示核心工作区，数据库接入将在下一阶段替换这组占位数据。
export function App(): ReactElement {
  const [activeNav, setActiveNav] = useState('仪表盘');
  const [appVersion, setAppVersion] = useState('读取中');

  useEffect(() => {
    void window.desktopApi.getAppVersion().then(setAppVersion);
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">CY</div>
        <div className="brand-copy">
          <strong>毕业设计指南针</strong>
          <span>项目工作台</span>
        </div>
        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item) => (
            <button
              className={activeNav === item ? 'nav-item active' : 'nav-item'}
              key={item}
              onClick={() => setActiveNav(item)}
              type="button"
            >
              <span className="nav-dot" />
              {item}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>桌面版</span>
          <small>v{appVersion}</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">WORKSPACE / 2026</span>
            <h1>{activeNav}</h1>
          </div>
          <button className="primary-button" type="button">＋ 新建项目</button>
        </header>

        <section className="welcome-strip">
          <div>
            <span className="eyebrow">PROJECT CONTROL CENTER</span>
            <h2>把每一个毕业项目，推进到可交付。</h2>
            <p>从模板生成项目，集中管理目录与状态，随时掌握整体进度。</p>
          </div>
          <div className="welcome-badge">01<span>/</span>01</div>
        </section>

        <section className="metrics-grid" aria-label="项目统计">
          <Metric label="项目总数" value="0" tone="dark" />
          <Metric label="进行中" value="0" tone="yellow" />
          <Metric label="已完成" value="0" tone="green" />
          <Metric label="已归档" value="0" tone="light" />
        </section>

        <section className="content-grid">
          <div className="panel project-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">RECENT PROJECTS</span>
                <h3>最近项目</h3>
              </div>
              <button className="text-button" type="button">查看全部 →</button>
            </div>
            <div className="empty-state">
              <div className="empty-icon">＋</div>
              <strong>还没有毕业项目</strong>
              <p>导入模板后，创建你的第一个项目。</p>
              <button className="secondary-button" type="button">导入代码模板</button>
            </div>
          </div>
          <div className="panel quick-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">QUICK START</span>
                <h3>快速开始</h3>
              </div>
            </div>
            <ol className="steps-list">
              <li><span>01</span><div><strong>导入代码模板</strong><small>复制到应用模板库</small></div></li>
              <li><span>02</span><div><strong>生成毕业项目</strong><small>选择目标目录并登记</small></div></li>
              <li><span>03</span><div><strong>管理项目状态</strong><small>保持项目进度清晰</small></div></li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }): ReactElement {
  return <div className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>较上月 —</small></div>;
}
