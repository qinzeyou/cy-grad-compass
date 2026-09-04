import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { CheckCircleFilled, DeleteOutlined, DownOutlined, FileTextFilled, MessageOutlined } from '@ant-design/icons';
import { Alert, App as AntdApp, Avatar, Button, Card, Collapse, DatePicker, Dropdown, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { analyze, confirmCandidate, deleteCandidate, deleteOrder, getDashboard, ignoreCandidate } from './order-analysis-api';
import type { DealCandidate, OrderDashboard, OrderRecord } from './order-types';
import './order-analysis.css';

type AnalysisDebug = { startedAt: number; finishedAt: number | null; steps: Array<{ stage: string; message: string; details?: Record<string, unknown> }> };
type AnalysisRange = { beginTimestamp?: number; endTimestamp?: number };
const ANALYSIS_RANGE_KEY = 'order-analysis-range';
const LAST_ANALYSIS_END_KEY = 'order-analysis-last-end';

const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const date = (value: number | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未识别';
const contactName = (candidate: DealCandidate) => candidate.remarkName || candidate.nickname || candidate.customerName;
const orderContactName = (order: OrderRecord) => order.remarkName || order.nickname || order.customerName;

export function OrderAnalysisPage(): ReactElement {
  const { modal } = AntdApp.useApp();
  const [dashboard, setDashboard] = useState<OrderDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [analysisDebug, setAnalysisDebug] = useState<AnalysisDebug | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [selected, setSelected] = useState<DealCandidate | null>(null);
  const [evidenceOrder, setEvidenceOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [folders, setFolders] = useState<Array<{ name: string; path: string }>>([]);
  const [form] = Form.useForm<{ projectName: string; customerName: string; amount?: number; folderMode: 'new' | 'existing' | 'none'; folderPath?: string }>();
  const folderMode = Form.useWatch('folderMode', form);
  const [transactionForm] = Form.useForm<{ type: 'follow-up' | 'refund'; amount: number; note?: string }>();
  const [maintenanceForm] = Form.useForm<{ content: string }>();
  const [analysisRange, setAnalysisRange] = useState<[Dayjs, Dayjs] | null>(() => {
    try { const raw = localStorage.getItem(ANALYSIS_RANGE_KEY); if (!raw) return null; const value = JSON.parse(raw) as [string, string]; return value?.length === 2 ? [dayjs(value[0]), dayjs(value[1])] : null; } catch { return null; }
  });

  const load = () => { setLoading(true); void getDashboard().then(setDashboard).catch((reason) => setError(reason instanceof Error ? reason.message : '读取订单数据失败')).finally(() => setLoading(false)); };
  useEffect(load, []);
  useEffect(() => window.desktopApi.subscribeOrderChanges(() => load()), []);
  useEffect(() => window.desktopApi.subscribeOrderAnalysisProgress((next) => setDashboard(next)), []);
  const candidates = [...(dashboard?.candidates ?? [])].sort((left, right) => (right.dealTime ?? -Infinity) - (left.dealTime ?? -Infinity));
  const orderedEvidence = selected ? [...selected.evidence].sort((left, right) => evidenceOrder === 'asc' ? left.sentAt - right.sentAt : right.sentAt - left.sentAt) : [];
  const orders = dashboard?.orders ?? [];
  const summary = dashboard?.summary ?? { gross: 0, refunds: 0, net: 0, orderCount: 0, pendingCandidateCount: 0 };
  const removeCandidate = (candidate: DealCandidate) => {
    modal.confirm({
      title: '删除待确认线索？',
      content: `将删除“${candidate.customerName} · ${candidate.projectName}”这条线索，聊天记录不会被删除。`,
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try { await deleteCandidate(candidate.id); if (selected?.id === candidate.id) setSelected(null); load(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : '删除线索失败'); throw reason; }
      },
    });
  };
  const removeOrder = (order: OrderRecord) => {
    modal.confirm({
      title: '删除订单台账？',
      content: `将删除“${order.customerName} · ${order.projectName}”的台账记录，已创建的项目文件夹会保留。`,
      okText: '删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try { await deleteOrder(order.id); if (selectedOrder?.id === order.id) setSelectedOrder(null); load(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : '删除订单失败'); throw reason; }
      },
    });
  };
  const columns = useMemo(() => [
    { title: '客户', render: (_: unknown, row: OrderRecord) => <div className="order-contact"><Avatar size={32} src={row.avatarUrl}>{orderContactName(row).slice(0, 1)}</Avatar><span><Typography.Text strong>{orderContactName(row)}</Typography.Text>{row.nickname && row.nickname !== orderContactName(row) && <Typography.Text type="secondary">昵称：{row.nickname}</Typography.Text>}</span></div> },
    { title: '项目', dataIndex: 'projectName' },
    { title: '首单时间', dataIndex: 'confirmedAt', render: (value: number) => date(value) },
    { title: '累计收益', render: (_: unknown, row: OrderRecord) => money(row.transactions.reduce((sum, item) => sum + (item.type === 'refund' ? -Math.abs(item.amount) : item.amount), 0)) },
    { title: '续单', render: (_: unknown, row: OrderRecord) => row.transactions.filter((item) => item.type === 'follow-up').length },
    { title: '维护', render: (_: unknown, row: OrderRecord) => row.maintenance.length },
    { title: '操作', render: (_: unknown, row: OrderRecord) => <Button danger size="small" onClick={(event) => { event.stopPropagation(); removeOrder(row); }}>删除</Button> },
  ], [removeOrder]);

  const markNotDeal = (candidate: DealCandidate) => { modal.confirm({ title: '确认未成单？', content: '旧聊天不会再次生成这条线索；出现新的聊天并再次识别到成交时，仍可重新出现。', okText: '确认未成单', cancelText: '取消', onOk: async () => { await ignoreCandidate(candidate.id); setSelected(null); load(); } }); };
  const openConfirm = (candidate: DealCandidate) => { setSelected(candidate); form.setFieldsValue({ projectName: candidate.projectName, customerName: candidate.remarkName || candidate.nickname || candidate.customerName, amount: candidate.amount ?? undefined, folderMode: 'new', folderPath: undefined }); void window.desktopApi.listOrderProjectFolders().then(setFolders); setConfirmOpen(true); };
  const submitConfirm = async () => { if (!selected) return; const values = await form.validateFields(); setRunning(true); try { await confirmCandidate(selected.id, { projectName: values.projectName, customerName: values.customerName, confirmedAt: selected.dealTime ?? Date.now(), amount: values.amount ?? null, folderMode: values.folderMode, folderPath: values.folderPath || null }); setConfirmOpen(false); setSelected(null); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : '创建订单失败'); } finally { setRunning(false); } };
  const runAnalyze = async () => {
    setRunning(true);
    setError('');
    setAnalysisMessage('正在读取微信记录并分析…');
    try {
      const lastEnd = localStorage.getItem(LAST_ANALYSIS_END_KEY);
      const range: AnalysisRange | undefined = analysisRange
        ? { beginTimestamp: analysisRange[0].startOf('day').valueOf(), endTimestamp: analysisRange[1].endOf('day').valueOf() }
        : lastEnd ? { beginTimestamp: dayjs(lastEnd).startOf('day').valueOf(), endTimestamp: dayjs().endOf('day').valueOf() } : undefined;
      const next = await analyze(range);
      setDashboard(next);
      localStorage.setItem(LAST_ANALYSIS_END_KEY, dayjs().format('YYYY-MM-DD'));
      const debug = await window.desktopApi.getOrderAnalysisDebug?.() ?? null;
      setAnalysisDebug(debug);
      const aiSteps = debug?.steps.filter((step) => step.stage === 'decision' && step.details?.ai) ?? [];
      const fallback = aiSteps.find((step) => (step.details?.ai as { mode?: string } | undefined)?.mode === 'heuristic-fallback');
      const aiStatus = fallback ? `DeepSeek 调用失败，已降级本地规则（${((fallback.details?.ai as { fallbackReason?: string } | undefined)?.fallbackReason || '未知原因')}）` : aiSteps.some((step) => (step.details?.ai as { mode?: string } | undefined)?.mode === 'deepseek') ? '已使用 DeepSeek AI 分析' : '使用本地规则分析';
      setAnalysisMessage(`分析完成：发现 ${next.candidates.length} 条待确认线索，已确认订单 ${next.orders.length} 笔 · ${aiStatus}`);
    } catch (reason) {
      setAnalysisDebug(await window.desktopApi.getOrderAnalysisDebug?.() ?? null);
      setAnalysisMessage('');
      setError(reason instanceof Error ? reason.message : '分析失败');
    } finally {
      setRunning(false);
    }
  };
  const updateSelectedOrder = (next: OrderRecord) => { setSelectedOrder(next); setDashboard((current) => current ? { ...current, orders: current.orders.map((item) => item.id === next.id ? next : item) } : current); };
  const addTransaction = async () => { if (!selectedOrder) return; try { const values = await transactionForm.validateFields(); updateSelectedOrder(await window.desktopApi.addOrderTransaction(selectedOrder.id, { ...values, amount: Number(values.amount), occurredAt: Date.now(), note: values.note || '', evidenceMessageIds: [] })); transactionForm.resetFields(); } catch (reason) { setError(reason instanceof Error ? reason.message : '保存交易失败'); } };
  const addMaintenance = async () => { if (!selectedOrder) return; try { const values = await maintenanceForm.validateFields(); updateSelectedOrder(await window.desktopApi.addOrderMaintenance(selectedOrder.id, { occurredAt: Date.now(), content: values.content, nextFollowUpAt: null })); maintenanceForm.resetFields(); } catch (reason) { setError(reason instanceof Error ? reason.message : '保存维护记录失败'); } };

  return <div className="order-analysis-page">
    <div className="management-toolbar"><Space><DatePicker.RangePicker value={analysisRange} allowClear onChange={(value) => { const next = value && value[0] && value[1] ? [value[0], value[1]] as [Dayjs, Dayjs] : null; setAnalysisRange(next); if (next) localStorage.setItem(ANALYSIS_RANGE_KEY, JSON.stringify(next.map((item) => item.format('YYYY-MM-DD')))); else localStorage.removeItem(ANALYSIS_RANGE_KEY); }} placeholder={['开始日期', '结束日期']} /><Button onClick={() => setDebugOpen(true)} disabled={!analysisDebug}>调试信息</Button><Button onClick={load}>刷新</Button><Button type="primary" loading={running} onClick={() => void runAnalyze()}>分析新消息</Button></Space></div>
    {error && <Alert closable showIcon type="error" message={error} onClose={() => setError('')} />}
    {analysisMessage && <Alert closable showIcon type="success" message={analysisMessage} onClose={() => setAnalysisMessage('')} />}
    <div className="order-metrics-grid"><Card><Typography.Text type="secondary">累计净收益</Typography.Text><strong>{money(summary.net)}</strong></Card><Card><Typography.Text type="secondary">累计收款</Typography.Text><strong>{money(summary.gross)}</strong></Card><Card><Typography.Text type="secondary">待确认线索</Typography.Text><strong>{summary.pendingCandidateCount}</strong></Card><Card><Typography.Text type="secondary">已确认订单</Typography.Text><strong>{summary.orderCount}</strong></Card></div>
    <div className="order-analysis-grid">
      <Card title="待确认" extra={<Tag color="gold">{candidates.length} 条</Tag>} className="order-candidates-card">
        {loading ? <Spin /> : candidates.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待确认线索" /> : <div className="candidate-list">{candidates.map((candidate) => <div className="candidate-row" role="button" aria-label={`查看成单线索：${contactName(candidate)} · ${candidate.projectName}`} tabIndex={0} key={candidate.id} onClick={() => setSelected(candidate)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelected(candidate); }}><div className="candidate-contact"><Avatar size={34} src={candidate.avatarUrl}>{contactName(candidate).slice(0, 1)}</Avatar><span><Typography.Text strong>{contactName(candidate)}</Typography.Text>{candidate.nickname && candidate.nickname !== contactName(candidate) && <Typography.Text type="secondary">昵称：{candidate.nickname}</Typography.Text>}<Typography.Text type="secondary">{candidate.projectName}</Typography.Text></span></div><div><Tag color="gold">置信度 {Math.round(candidate.confidence * 100)}%</Tag><Typography.Text>{candidate.amount == null ? '金额待确认' : money(candidate.amount)}</Typography.Text></div><small>{date(candidate.dealTime)}</small><span className="candidate-actions"><Button size="small" onClick={(event) => { event.stopPropagation(); openConfirm(candidate); }}>确认成单</Button><Button danger size="small" onClick={(event) => { event.stopPropagation(); removeCandidate(candidate); }}>删除</Button></span></div>)}</div>}
      </Card>
      <Card title="收益概览" className="order-revenue-card"><div className="revenue-bars"><div><span>首单</span><i style={{ width: `${Math.min(100, summary.gross ? 70 : 0)}%` }} /><b>{money(summary.gross)}</b></div><div><span>退款</span><i className="refund" style={{ width: `${Math.min(100, summary.gross ? (summary.refunds / summary.gross) * 100 : 0)}%` }} /><b>{money(summary.refunds)}</b></div><div><span>净收益</span><i className="net" style={{ width: `${Math.min(100, summary.gross ? (summary.net / summary.gross) * 100 : 0)}%` }} /><b>{money(summary.net)}</b></div></div></Card>
    </div>
    <Card title="订单" className="order-table-card"><Table className="order-ledger-table" size="small" rowKey="id" loading={loading} dataSource={orders} columns={columns} pagination={{ pageSize: 8, hideOnSinglePage: true }} scroll={{ x: 760, y: '100%' }} onRow={(row) => ({ onClick: () => { setSelected(null); setSelectedOrder(row); } })} /></Card>
    <Modal title={selected ? <div className="candidate-modal-titlebar"><span>{contactName(selected)} · 成单线索</span><Space className="candidate-modal-header-actions"><Space className="candidate-modal-actions"><Button onClick={() => markNotDeal(selected)}>未成单</Button><Button danger icon={<DeleteOutlined />} onClick={() => removeCandidate(selected)}>删除</Button><Button type="primary" icon={<CheckCircleFilled />} onClick={() => openConfirm(selected)}>确认成单</Button></Space><Button type="text" className="candidate-modal-close-button" onClick={() => setSelected(null)}>关闭</Button></Space></div> : '成单线索'} open={selected !== null && !confirmOpen} width={900} centered closable={false} onCancel={() => setSelected(null)} footer={null} className="candidate-detail-modal">
      {selected && <article className="candidate-detail-shell">
        <header className="candidate-detail-header">
          <div className="candidate-detail-profile"><Avatar size={52} src={selected.avatarUrl}>{contactName(selected).slice(0, 1)}</Avatar><div><Typography.Title level={3}>{contactName(selected)}</Typography.Title><Typography.Text type="secondary">昵称：{selected.nickname && selected.nickname !== contactName(selected) ? selected.nickname : '—'}</Typography.Text></div></div>
        </header>
        <div className="candidate-project-label"><FileTextFilled /> 匹配项目</div>
        <section className="candidate-summary-card">
          <div className="candidate-summary-project"><span><FileTextFilled /></span><Typography.Title level={3}>{selected.projectName}</Typography.Title></div>
          <div className="candidate-summary-stats">
            <div><Typography.Text type="secondary">预计金额</Typography.Text><strong className="candidate-summary-amount">{selected.amount == null ? '待确认' : money(selected.amount)}</strong></div>
            <div><Typography.Text type="secondary">成交时间</Typography.Text><strong>{date(selected.dealTime)}</strong></div>
            <div><Typography.Text type="secondary">成交判断置信度</Typography.Text><strong className="candidate-summary-confidence">{Math.round(selected.confidence * 100)}%</strong></div>
          </div>
          <div className="candidate-summary-art" aria-hidden="true"><FileTextFilled /><CheckCircleFilled /></div>
        </section>
        <section className="candidate-chat-section">
          <div className="candidate-chat-toolbar"><Collapse className="candidate-chat-collapse" bordered={false} items={[{ key: 'evidence', label: <span className="candidate-chat-title"><MessageOutlined /> 成交聊天记录（{selected.evidence.length} 条）</span>, children: <div className="candidate-chat-list">{orderedEvidence.map((item) => <article className={`candidate-chat-message${item.isSelf ? ' is-self' : ''}`} key={item.id}><Avatar size={32} src={item.isSelf ? undefined : selected.avatarUrl}>{item.isSelf ? '我' : contactName(selected).slice(0, 1)}</Avatar><div className="candidate-chat-content"><div className="candidate-chat-meta"><Typography.Text strong>{item.senderName}{item.isSelf ? '（我）' : ''}</Typography.Text><Typography.Text type="secondary">{date(item.sentAt)}</Typography.Text></div><div className="candidate-chat-bubble">{item.text}</div></div></article>)}</div> }]} />
            <Dropdown trigger={['click']} menu={{ items: [{ key: 'asc', label: '时间正序' }, { key: 'desc', label: '时间倒序' }], onClick: ({ key }) => setEvidenceOrder(key as 'asc' | 'desc') }}><Button type="text" className="candidate-chat-sort" aria-label="按时间排序">按时间排序 <DownOutlined /></Button></Dropdown>
          </div>
        </section>
      </article>}
    </Modal>
    <Modal title={selectedOrder ? `${orderContactName(selectedOrder)} · ${selectedOrder.projectName}` : '订单详情'} open={selectedOrder !== null} width={760} footer={null} onCancel={() => setSelectedOrder(null)}>
      {selectedOrder && <Space direction="vertical" size={14} style={{ width: '100%' }}><div className="candidate-profile"><Avatar size={52} src={selectedOrder.avatarUrl}>{orderContactName(selectedOrder).slice(0, 1)}</Avatar><div><Typography.Title level={4} style={{ margin: 0 }}>{orderContactName(selectedOrder)}</Typography.Title>{selectedOrder.nickname && selectedOrder.nickname !== orderContactName(selectedOrder) && <Typography.Text type="secondary">昵称：{selectedOrder.nickname}</Typography.Text>}</div></div><Typography.Text type="secondary">文件夹：{selectedOrder.folderPath || '未创建'}</Typography.Text><Button danger onClick={() => removeOrder(selectedOrder)}>删除订单台账</Button><Typography.Title level={5}>交易记录</Typography.Title>{selectedOrder.transactions.length === 0 ? <Typography.Text type="secondary">暂无交易记录</Typography.Text> : selectedOrder.transactions.map((item) => <div className="order-detail-row" key={item.id}><Tag color={item.type === 'refund' ? 'orange' : 'green'}>{item.type === 'initial' ? '首单' : item.type === 'follow-up' ? '续单' : '退款'}</Tag><span>{money(item.amount)}</span><Typography.Text type="secondary">{date(item.occurredAt)}</Typography.Text></div>)}<Form form={transactionForm} layout="inline" onFinish={() => void addTransaction()}><Form.Item name="type" initialValue="follow-up"><Select style={{ width: 90 }} options={[{ value: 'follow-up', label: '续单' }, { value: 'refund', label: '退款' }]} /></Form.Item><Form.Item name="amount" rules={[{ required: true, message: '请输入金额' }]}><InputNumber min={0} precision={2} placeholder="金额" /></Form.Item><Form.Item name="note"><Input placeholder="备注" /></Form.Item><Button htmlType="submit">追加交易</Button></Form><Typography.Title level={5}>维护记录</Typography.Title>{selectedOrder.maintenance.length === 0 ? <Typography.Text type="secondary">暂无维护记录</Typography.Text> : selectedOrder.maintenance.map((item) => <div className="order-maintenance-row" key={item.id}><Typography.Text>{item.content}</Typography.Text><Typography.Text type="secondary">{date(item.occurredAt)}</Typography.Text></div>)}<Form form={maintenanceForm} layout="inline" onFinish={() => void addMaintenance()}><Form.Item name="content" rules={[{ required: true, message: '请输入维护内容' }]}><Input placeholder="例如：修改登录流程" /></Form.Item><Button htmlType="submit">新增维护</Button></Form></Space>}
    </Modal>
    <Modal title="确认成单" open={confirmOpen} confirmLoading={running} onCancel={() => { setConfirmOpen(false); setSelected(null); }} onOk={() => void submitConfirm()} okText="确认并入账" cancelText="取消"><Form form={form} layout="vertical"><Form.Item name="customerName" label="客户" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="projectName" label="项目/业务名称" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="amount" label={selected?.amount == null ? '首单收益（聊天中未识别，请填写）' : '首单收益（已从聊天识别）'} rules={selected?.amount == null ? [{ required: true, message: '请输入成交金额' }] : undefined}><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item><Form.Item name="folderMode" label="项目文件夹"><Select options={[{ value: 'new', label: '新建项目文件夹' }, { value: 'existing', label: '关联已有文件夹' }, { value: 'none', label: '暂不关联文件夹' }]} /></Form.Item>{folderMode === 'existing' && <Form.Item name="folderPath" label="已有文件夹" rules={[{ required: true, message: '请选择已有文件夹' }]}><Select showSearch optionFilterProp="label" options={folders.map((folder) => ({ value: folder.path, label: `${folder.name} · ${folder.path}` }))} /></Form.Item>}</Form></Modal>
    <Modal title="分析调试信息" open={debugOpen} width={760} footer={null} onCancel={() => setDebugOpen(false)}>{analysisDebug ? <Space direction="vertical" size={12} style={{ width: '100%' }}><Typography.Text type="secondary">开始时间：{date(analysisDebug.startedAt)}{analysisDebug.finishedAt ? ` · 完成时间：${date(analysisDebug.finishedAt)}` : ' · 分析未正常结束'}</Typography.Text><div style={{ maxHeight: 520, overflow: 'auto', background: '#f7f8fa', padding: 14, borderRadius: 6 }}>{analysisDebug.steps.map((step, index) => <div key={`${step.stage}-${index}`} style={{ marginBottom: 12 }}><Typography.Text strong>{index + 1}. [{step.stage}] {step.message}</Typography.Text>{step.details && <pre style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0', fontSize: 12 }}>{JSON.stringify(step.details, null, 2)}</pre>}</div>)}</div></Space> : <Empty description="暂无分析记录，请先点击分析新消息" />}</Modal>
  </div>;
}
