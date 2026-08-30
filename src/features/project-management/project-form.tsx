import { useRef, useState, type FormEvent, type ReactElement } from 'react';
import { createProject, selectDirectory } from './project-management-api';
import type { Project } from '../project-statistics/project-statistics-types';

interface ProjectFormProps {
  // 中文注释：生成成功后回调，父组件据此刷新列表。
  onCreated: (project: Project) => void;
}

// 中文注释：收集项目名称与目标目录的表单。目录由主进程弹窗选择，
// 表单只保存用户选择结果，不直接访问文件系统。
export function ProjectForm({ onCreated }: ProjectFormProps): ReactElement {
  const [name, setName] = useState('');
  const [targetDirectory, setTargetDirectory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handlePickDirectory = async () => {
    setError(null);
    const selected = await selectDirectory();
    if (selected !== null) {
      setTargetDirectory(selected);
    }
  };

  // 中文注释：先做本地必填校验，再交给主进程做完整校验（名称规则、目录可写、重复目录等）。
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim() === '') {
      setError('请输入项目名称');
      nameInputRef.current?.focus();
      return;
    }
    if (targetDirectory === '') {
      setError('请先选择目标目录');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const project = await createProject({ name, targetDirectory });
      setName('');
      setTargetDirectory('');
      onCreated(project);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '项目生成失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel form-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">NEW PROJECT</span>
          <h3>新建项目</h3>
        </div>
      </div>
      <form className="project-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-field">
          <label htmlFor="project-name">项目名称</label>
          <input
            id="project-name"
            ref={nameInputRef}
            className="form-input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：论文答辩系统"
            maxLength={80}
            disabled={busy}
            aria-describedby={error !== null ? 'project-form-error' : undefined}
          />
        </div>
        <div className="form-field">
          <label htmlFor="project-target">目标目录</label>
          <div className="dir-picker">
            <input
              id="project-target"
              className="form-input dir-input"
              type="text"
              value={targetDirectory}
              readOnly
              placeholder="点击右侧按钮选择存放项目的目录"
              disabled={busy}
            />
            <button className="secondary-button compact-button" type="button" onClick={() => void handlePickDirectory()} disabled={busy}>
              选择目录
            </button>
          </div>
        </div>
        {error !== null && (
          <p className="form-error" id="project-form-error" role="alert">{error}</p>
        )}
        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? '正在生成…' : '生成项目'}
          </button>
          <span className="form-hint">只复制目录并登记记录，不安装依赖、不初始化 Git。</span>
        </div>
      </form>
    </section>
  );
}
