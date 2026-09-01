import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Alert, Button, Card, Drawer, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import { analyze, confirmCandidate, getDashboard } from './order-analysis-api';
import type { DealCandidate, OrderDashboard, OrderRecord } from './order-types';
import './order-analysis.css';

const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const date = (value: number | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未识别';

export function OrderAnalysisPage(): ReactElement {
  const [dashboard, setDashboard] = useState<OrderDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<DealCandidate | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [form] = Form.useForm<{ projectName: string; customerName: string; amount?: number }>();
  const [transactionForm] = Form.useForm<{ type: 'follow-up' | 'refund'; amount: number; note?: string }>();
  const [maintenanceForm] = Form.useForm<{ content: string }>();

  const load = () => { setLoading(true); void getDashboard().then(setDashboard).catch((reason) => setError(reason instanceof Error ? reason.message : '读取订单数据失败')).finally(() => setLoading(false)); };
  useEffect(load, []);
  useEffect(() => window.desktopApi.subscribeOrderChanges(() => load()), []);
  const candidates = dashboard?.candidates ?? [];
  const orders = dashboard?.orders ?? [];
  const summary = dashboard?.summary ?? { gross: 0, refunds: 0, net: 0, orderCount: 0, pendingCandidateCount: 0 };
  const columns = useMemo(() => [
    { title: '客户', dataIndex: 'customerName' },
    { title: '项目', dataIndex: 'projectName' },
    { title: '首单时间', dataIndex: 'confirmedAt', render: (value: number) => date(value) },
    { title: '累计收益', render: (_: unknown, row: OrderRecord) => money(row.transactions.reduce((sum, item) => sum + (item.type === 'refund' ? -Math.abs(item.amount) : item.amount), 0)) },
    { title: '续单', render: (_: unknown, row: OrderRecord) => row.transactions.filter((item) => item.type === 'follow-up').length },
    { title: '维护', render: (_: unknown, row: OrderRecord) => row.maintenance.length },
  ], []);

  const openConfirm = (candidate: DealCandidate) => { setSelected(candidate); form.setFieldsValue({ projectName: candidate.projectName, customerName: candidate.customerName, amount: candidate.amount ?? undefined }); setConfirmOpen(true); };
  const submitConfirm = async () => { if (!selected) return; const values = await form.validateFields(); setRunning(true); try { await confirmCandidate(selected.id, { projectName: values.projectName, customerName: values.customerName, confirmedAt: selected.dealTime ?? Date.now(), amount: values.amount ?? null }); setConfirmOpen(false); setSelected(null); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : '创建订单失败'); } finally { setRunning(false); } };
  const runAnalyze = async () => { setRunning(true); setError(''); try { setDashboard(await analyze()); } catch (reason) { setError(reason instanceof Error ? reason.message : '分析失败'); } finally { setRunning(false); } };
  const updateSelectedOrder = (next: OrderRecord) => { setSelectedOrder(next); setDashboard((current) => current ? { ...current, orders: current.orders.map((item) => item.id === next.id ? next : item) } : current); };
  const addTransaction = async () => { if (!selectedOrder) return; try { const values = await transactionForm.validateFields(); updateSelectedOrder(await window.desktopApi.addOrderTransaction(selectedOrder.id, { ...values, amount: Number(values.amount), occurredAt: Date.now(), note: values.note || '', evidenceMessageIds: [] })); transactionForm.resetFields(); } catch (reason) { setError(reason instanceof Error ? reason.message : '保存交易失败'); } };
  const addMaintenance = async () => { if (!selectedOrder) return; try { const values = await maintenanceForm.validateFields(); updateSelectedOrder(await window.desktopApi.addOrderMaintenance(selectedOrder.id, { occurredAt: Date.now(), content: values.content, nextFollowUpAt: null })); maintenanceForm.resetFields(); } catch (reason) { setError(reason instanceof Error ? reason.message : '保存维护记录失败'); } };

  return <div className="order-analysis-page">
    <div className="management-toolbar"><div><Typography.Text className="eyebrow">DEAL INTELLIGENCE</Typography.Text><Typography.Title level={3} style={{ margin: '6px 0 0' }}>成单分析</Typography.Title><Typography.Text type="secondary">微信线索、订单与收益</Typography.Text></div><Space><Button onClick={load}>刷新</Button><Button type="primary" loading={running} onClick={() => void runAnalyze()}>分析新消息</Button></Space></div>
    {error && <Alert closable showIcon type="error" message={error} onClose={() => setError('')} />}
    <div className="order-metrics-grid"><Card><Typography.Text type="secondary">累计净收益</Typography.Text><strong>{money(summary.net)}</strong></Card><Card><Typography.Text type="secondary">累计收款</Typography.Text><strong>{money(summary.gross)}</strong></Card><Card><Typography.Text type="secondary">待确认线索</Typography.Text><strong>{summary.pendingCandidateCount}</strong></Card><Card><Typography.Text type="secondary">已确认订单</Typography.Text><strong>{summary.orderCount}</strong></Card></div>
    <div className="order-analysis-grid">
      <Card title="待确认成单" extra={<Tag color="gold">{candidates.length} 条</Tag>} className="order-candidates-card">
        {loading ? <Spin /> : candidates.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待确认线索" /> : <div className="candidate-list">{candidates.map((candidate) => <button className="candidate-row" key={candidate.id} onClick={() => setSelected(candidate)}><div><Typography.Text strong>{candidate.customerName}</Typography.Text><Typography.Text type="secondary">{candidate.projectName}</Typography.Text></div><div><Tag color="gold">置信度 {Math.round(candidate.confidence * 100)}%</Tag><Typography.Text>{candidate.amount == null ? '金额待确认' : money(candidate.amount)}</Typography.Text></div><small>{date(candidate.dealTime)}</small><span className="candidate-actions"><Button size="small" onClick={(event) => { event.stopPropagation(); openConfirm(candidate); }}>确认成单</Button></span></button>)}</div>}
      </Card>
      <Card title="收益概览" className="order-revenue-card"><div className="revenue-bars"><div><span>首单</span><i style={{ width: `${Math.min(100, summary.gross ? 70 : 0)}%` }} /><b>{money(summary.gross)}</b></div><div><span>退款</span><i className="refund" style={{ width: `${Math.min(100, summary.gross ? (summary.refunds / summary.gross) * 100 : 0)}%` }} /><b>{money(summary.refunds)}</b></div><div><span>净收益</span><i className="net" style={{ width: `${Math.min(100, summary.gross ? (summary.net / summary.gross) * 100 : 0)}%` }} /><b>{money(summary.net)}</b></div></div></Card>
    </div>
    <Card title="订单台账" className="order-table-card"><Table rowKey="id" loading={loading} dataSource={orders} columns={columns} pagination={{ pageSize: 8 }} onRow={(row) => ({ onClick: () => { setSelected(null); setSelectedOrder(row); } })} /></Card>
    <Drawer title={selected ? `${selected.customerName} · 成单线索` : '成单线索'} open={selected !== null && !confirmOpen} width={520} onClose={() => setSelected(null)} footer={selected && <Button type="primary" block onClick={() => openConfirm(selected)}>确认成单并创建文件夹</Button>}>
      {selected && <Space direction="vertical" size={16} style={{ width: '100%' }}><div><Typography.Text type="secondary">匹配项目</Typography.Text><Typography.Title level={4}>{selected.projectName}</Typography.Title><Typography.Text>预计金额：{selected.amount == null ? '待确认' : money(selected.amount)}</Typography.Text></div><Typography.Paragraph>AI 置信度：{Math.round(selected.confidence * 100)}%</Typography.Paragraph><div className="evidence-timeline">{selected.evidence.map((item) => <div key={item.id}><Typography.Text type="secondary">{item.senderName} · {date(item.sentAt)}</Typography.Text><p>{item.text}</p></div>)}</div></Space>}
    </Drawer>
    <Drawer title={selectedOrder ? `${selectedOrder.customerName} · ${selectedOrder.projectName}` : '订单详情'} open={selectedOrder !== null} width={520} onClose={() => setSelectedOrder(null)}>
      {selectedOrder && <Space direction="vertical" size={14} style={{ width: '100%' }}><Typography.Text type="secondary">文件夹：{selectedOrder.folderPath || '未创建'}</Typography.Text><Typography.Title level={5}>交易记录</Typography.Title>{selectedOrder.transactions.length === 0 ? <Typography.Text type="secondary">暂无交易记录</Typography.Text> : selectedOrder.transactions.map((item) => <div className="order-detail-row" key={item.id}><Tag color={item.type === 'refund' ? 'orange' : 'green'}>{item.type === 'initial' ? '首单' : item.type === 'follow-up' ? '续单' : '退款'}</Tag><span>{money(item.amount)}</span><Typography.Text type="secondary">{date(item.occurredAt)}</Typography.Text></div>)}<Form form={transactionForm} layout="inline" onFinish={() => void addTransaction()}><Form.Item name="type" initialValue="follow-up"><Select style={{ width: 90 }} options={[{ value: 'follow-up', label: '续单' }, { value: 'refund', label: '退款' }]} /></Form.Item><Form.Item name="amount" rules={[{ required: true, message: '请输入金额' }]}><InputNumber min={0} precision={2} placeholder="金额" /></Form.Item><Form.Item name="note"><Input placeholder="备注" /></Form.Item><Button htmlType="submit">追加交易</Button></Form><Typography.Title level={5}>维护记录</Typography.Title>{selectedOrder.maintenance.length === 0 ? <Typography.Text type="secondary">暂无维护记录</Typography.Text> : selectedOrder.maintenance.map((item) => <div className="order-maintenance-row" key={item.id}><Typography.Text>{item.content}</Typography.Text><Typography.Text type="secondary">{date(item.occurredAt)}</Typography.Text></div>)}<Form form={maintenanceForm} layout="inline" onFinish={() => void addMaintenance()}><Form.Item name="content" rules={[{ required: true, message: '请输入维护内容' }]}><Input placeholder="例如：修改登录流程" /></Form.Item><Button htmlType="submit">新增维护</Button></Form></Space>}
    </Drawer>
    <Modal title="确认成单并创建文件夹" open={confirmOpen} confirmLoading={running} onCancel={() => setConfirmOpen(false)} onOk={() => void submitConfirm()} okText="创建并入账" cancelText="取消"><Form form={form} layout="vertical"><Form.Item name="customerName" label="客户" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="projectName" label="项目/业务名称" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="amount" label="首单收益"><InputNumber min={0} precision={2} style={{ width: '100%' }} /></Form.Item><Typography.Text type="secondary">文件夹将按成交时间归档到 E:\\副业\\开发\\年份目录，命名模板由设置决定。</Typography.Text></Form></Modal>
  </div>;
}
