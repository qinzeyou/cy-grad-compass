import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Button, Modal, Typography } from 'antd';
import { changeProjectStatus, fetchProjectList } from '../project-statistics/project-statistics-api';
import type { Project, ProjectStatus, ProjectStatusFilter } from '../project-statistics/project-statistics-types';
import { openProjectPath, updateProject } from './project-management-api';
import { ProjectForm } from './project-form';
import { ProjectList } from './project-list';
import { TemplatePanel } from './template-panel';

interface ProjectManagementPageProps {
  initialStatus?: ProjectStatusFilter;
  // 中文注释：从项目列表选择项目后，交给项目开发页打开对应 AI 工作台。
  onDevelop: (project: Project) => void;
}

type LoadState = 'loading' | 'ready' | 'error';

// 中文注释：项目管理页。负责模板面板、新建项目表单与项目列表的组合与数据刷新，
// 不直接处理文件系统，所有文件操作都走 preload 白名单 API。
export function ProjectManagementPage({ initialStatus = 'all', onDevelop }: ProjectManagementPageProps): ReactElement {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<ProjectStatusFilter>(initialStatus);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  // 中文注释：按当前筛选条件重新查询项目列表；错误重试时直接调用，不经过防抖。
  const reload = useCallback(() => {
    setLoadState('loading');
    fetchProjectList({ keyword: keyword.trim(), status })
      .then((items) => {
        setProjects(items);
        setLoadState('ready');
      })
      .catch(() => {
        setLoadState('error');
      });
  }, [keyword, status]);

  // 中文注释：筛选条件变化后 250ms 防抖再查询，避免搜索输入时每次按键都访问数据库。
  useEffect(() => {
    const timer = window.setTimeout(reload, 250);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const clearFilters = useCallback(() => {
    setKeyword('');
    setStatus('all');
  }, []);

  // 中文注释：生成成功后立即刷新列表，让新项目马上出现在列表与统计中。
  const handleCreated = useCallback((project: Project) => {
    setNotice(`项目「${project.name}」已生成`);
    setCreateOpen(false);
    reload();
  }, [reload]);

  const handleStatusChangeForProject = useCallback((project: Project, next: ProjectStatus) => {
    setNotice(null);
    setBusyProjectId(project.id);
    changeProjectStatus(project.id, next)
      .then(({ project: updated }) => {
        // 中文注释：只替换发生变化的行，避免整列表闪烁。
        setProjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      })
      .catch(() => {
        setNotice('项目状态更新失败，请稍后重试');
      })
      .finally(() => {
        setBusyProjectId(null);
      });
  }, []);

  const handleRenameProject = useCallback(async (project: Project, newName: string) => {
    setBusyProjectId(project.id);
    try {
      const { project: updated } = await updateProject({ id: project.id, name: newName });
      setProjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } finally {
      setBusyProjectId(null);
    }
  }, []);

  // 中文注释：归档是破坏性操作，先确认再执行。
  const handleArchiveProject = useCallback((project: Project) => {
    Modal.confirm({ title: '归档项目', content: `确定归档项目「${project.name}」吗？归档后可随时改回其他状态。`, okText: '归档', cancelText: '取消', onOk: () => { setNotice(null); setBusyProjectId(project.id); return changeProjectStatus(project.id, 'archived').then(({ project: updated }) => setProjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))).catch(() => setNotice('归档失败，请稍后重试')).finally(() => setBusyProjectId(null)); } });
  }, []);

  // 中文注释：按记录 id 打开目录；主进程确认记录存在，路径失效时返回系统错误文本。
  const handleOpenPath = useCallback(async (project: Project) => {
    setBusyProjectId(project.id);
    try {
      await openProjectPath(project.id);
      setNotice(null);
    } catch (error) {
      setNotice(`无法打开项目目录：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setBusyProjectId(null);
    }
  }, []);

  return (
    <>
      {notice !== null && (
        <div className="notice-banner" role="status">
          <span>{notice}</span>
          <Button type="text" onClick={() => setNotice(null)} aria-label="关闭提示">×</Button>
        </div>
      )}

      <div className="management-toolbar">
        <div>
          <Typography.Text className="eyebrow">PROJECT CONTROL</Typography.Text>
          <Typography.Text type="secondary">管理项目状态与开发入口</Typography.Text>
        </div>
        <div className="management-actions">
          <Button type="primary" onClick={() => setCreateOpen(true)}>新建项目</Button>
          <Button onClick={() => setTemplateOpen(true)}>模板管理</Button>
        </div>
      </div>
      <div className="management-grid">
        <div className="management-main">
          <section className="panel list-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">PROJECTS</span>
                <h3>项目列表</h3>
              </div>
            </div>
            <ProjectList
              loadState={loadState}
              projects={projects}
              keyword={keyword}
              status={status}
              busyProjectId={busyProjectId}
              onKeywordChange={setKeyword}
              onStatusChange={setStatus}
              onClearFilters={clearFilters}
              onRetry={reload}
              onStatusChangeForProject={handleStatusChangeForProject}
              onRenameProject={handleRenameProject}
              onArchiveProject={handleArchiveProject}
              onOpenPath={handleOpenPath}
              onDevelop={onDevelop}
              onImportTemplate={() => setTemplateOpen(true)}
              onCreateProject={() => setCreateOpen(true)}
            />
          </section>
        </div>
      </div>
      <Modal open={createOpen} title="新建项目" footer={null} destroyOnClose onCancel={() => setCreateOpen(false)}>
        <ProjectForm embedded onCreated={handleCreated} />
      </Modal>
      <Modal open={templateOpen} title="模板管理" footer={null} width={560} destroyOnClose onCancel={() => setTemplateOpen(false)}>
        <TemplatePanel />
      </Modal>
    </>
  );
}
