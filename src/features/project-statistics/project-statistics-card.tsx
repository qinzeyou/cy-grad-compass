import type { ReactElement } from 'react';

type CardTone = 'dark' | 'yellow' | 'green' | 'light';

interface ProjectStatisticsCardProps {
  label: string;
  value: number | string;
  tone: CardTone;
  onClick?: () => void;
}

// 中文注释：单张统计指标卡片。传入 onClick 时渲染为按钮，点击进入项目开发内的管理筛选。
export function ProjectStatisticsCard({ label, value, tone, onClick }: ProjectStatisticsCardProps): ReactElement {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{onClick !== undefined ? '点击查看项目' : '来自本地数据库'}</small>
    </>
  );
  if (onClick === undefined) {
    return (
      <div className={`metric-card ${tone}`}>{content}</div>
    );
  }
  return (
    <button className={`metric-card ${tone} clickable`} type="button" onClick={onClick} title={`查看${label}项目`}>
      {content}
    </button>
  );
}
