// 中文注释：仪表盘占位页。保留「仪表盘」菜单入口与组件导出名，本期不展示
// 统计内容：不查询统计、不渲染统计卡片、最近项目、快速开始或错误重试区域。
import type { ReactElement } from 'react';
import { Empty, Typography } from 'antd';

export function ProjectStatisticsPage(): ReactElement {
  return (
    <section className="dashboard-empty">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Typography.Text type="secondary">
            仪表盘内容已移除，请从「项目管理」查看项目进度。
          </Typography.Text>
        }
      />
    </section>
  );
}
