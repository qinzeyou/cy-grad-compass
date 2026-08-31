import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Button, Empty, Modal, Spin, Tag, Typography } from 'antd';
import { fetchTemplate, importTemplate, replaceTemplate } from './project-management-api';
import type { Template } from './project-management-types';

// 中文注释：模板面板。负责展示模板状态并提供导入/替换入口；
// 替换前必须二次确认，操作期间禁用按钮避免重复导入。
export function TemplatePanel(): ReactElement {
  const [template, setTemplate] = useState<Template | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadState('loading');
    fetchTemplate()
      .then((data) => {
        setTemplate(data);
        setLoadState('ready');
      })
      .catch(() => {
        setLoadState('error');
        setNotice('模板读取失败，请稍后重试');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 中文注释：导入成功或用户取消都会结束忙碌状态；取消（null）时不更新任何数据。
  const handleImport = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const imported = await importTemplate();
      if (imported !== null) {
        setTemplate(imported);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '模板导入失败，请重试');
    } finally {
      setBusy(false);
    }
  }, []);

  // 中文注释：替换会覆盖当前模板，先确认再执行；已生成项目记录不受影响。
  const handleReplace = useCallback(async () => {
    if (!await new Promise<boolean>((resolve) => Modal.confirm({ title: '替换模板', content: '替换模板将覆盖当前模板库副本，已生成的项目记录不受影响。是否继续？', okText: '继续', cancelText: '取消', onOk: () => resolve(true), onCancel: () => resolve(false) }))) return;
    setBusy(true);
    setNotice(null);
    try {
      const imported = await replaceTemplate();
      if (imported !== null) {
        setTemplate(imported);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '模板替换失败，请重试');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <section className="panel template-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">TEMPLATE LIBRARY</span>
          <h3>代码模板</h3>
        </div>
        <span className={`template-status ${template !== null ? 'loaded' : 'missing'}`}>
          {loadState === 'loading' ? '读取中' : template !== null ? '已导入' : '未导入'}
        </span>
      </div>

      {notice !== null && (
        <div className="inline-notice" role="alert">
          <span>{notice}</span>
          <Button type="text" onClick={() => setNotice(null)} aria-label="关闭提示">×</Button>
        </div>
      )}

      {loadState === 'error' && template === null ? (
        <div className="error-panel compact">
          <strong>模板读取失败</strong>
          <p>无法读取本地数据库，请稍后重试。</p>
          <Button onClick={load}>重新加载</Button>
        </div>
      ) : (
        <>
          {template !== null ? (
            <dl className="template-meta">
              <div><dt>模板名称</dt><dd>{template.name}</dd></div>
              <div><dt>导入时间</dt><dd>{formatDateTime(template.updatedAt)}</dd></div>
              <div><dt>存储路径</dt><dd className="mono" title={template.storedPath}>{template.storedPath}</dd></div>
            </dl>
          ) : (
              <Empty description="还没有导入代码模板" />
          )}

          <div className="template-actions">
            <Button type="primary" loading={busy} onClick={() => void handleImport()}>{template !== null ? '重新导入模板' : '导入代码模板'}</Button>
            {template !== null && (
              <Button onClick={() => void handleReplace()} disabled={busy}>替换模板</Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

// 中文注释：ISO 字符串只取本地日期与时分展示，避免时区细节影响可读性。
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
