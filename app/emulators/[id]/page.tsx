'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Descriptions,
  Tag,
  Tabs,
  Table,
  Button,
  Space,
  Card,
  Select,
  message,
  Empty,
} from 'antd';
import { ArrowLeftOutlined, UserOutlined, UnorderedListOutlined, HistoryOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import Link from 'next/link';
import { createBackendClient, tokenStorage, type BackendEmulator, type Task, type ExecutionHistory } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import { formatEmulatorLabel } from '@/utils/emulatorDisplay';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

type BindingWithAccount = {
  id: string;
  account_id: string;
  emulator_id: string;
  status: string;
  binding_type: string;
  bound_at: string;
  last_used_at?: string;
  account?: {
    id: string;
    username: string;
    email?: string;
    platform: string;
    status: string;
  };
};

export default function EmulatorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params.id as string;

  const [emulator, setEmulator] = useState<BackendEmulator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bindings, setBindings] = useState<BindingWithAccount[]>([]);
  const [bindingsLoading, setBindingsLoading] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksFilters, setTasksFilters] = useState<{ status?: string; platform?: string }>({});
  const [tasksPagination, setTasksPagination] = useState({ current: 1, total: 0, pageSize: 20 });

  const [history, setHistory] = useState<ExecutionHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilters, setHistoryFilters] = useState<{
    status?: 'pending' | 'success' | 'error';
    platform?: string;
  }>({});
  const [historyPagination, setHistoryPagination] = useState({ current: 1, total: 0, pageSize: 20 });

  const fetchEmulator = async () => {
    const token = tokenStorage.get();
    if (!token || !id) return;
    try {
      setLoading(true);
      setError(null);
      const client = createBackendClient(token);
      const data = await client.getEmulator(id);
      setEmulator(data);
    } catch (err: any) {
      setError(err?.response?.status === 404 ? 'Емулятор не знайдено' : err?.message || 'Помилка завантаження');
      setEmulator(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchBindings = async () => {
    if (!id) return;
    const token = tokenStorage.get();
    if (!token) return;
    setBindingsLoading(true);
    try {
      const client = createBackendClient(token);
      const data = await client.getBindingsForEmulator(id);
      setBindings((data || []) as BindingWithAccount[]);
    } catch {
      setBindings([]);
    } finally {
      setBindingsLoading(false);
    }
  };

  const fetchTasks = async (page = 1) => {
    if (!emulator) return;
    const token = tokenStorage.get();
    if (!token) return;
    setTasksLoading(true);
    try {
      const client = createBackendClient(token);
      const response = await client.getQueue({
        emulator_id: emulator.emulator_id,
        agent_id: emulator.agent_id,
        status: tasksFilters.status,
        platform: tasksFilters.platform,
        page,
        limit: tasksPagination.pageSize,
      });
      setTasks(response.data || []);
      setTasksPagination((prev) => ({ ...prev, current: response.page || page, total: response.total || 0 }));
    } catch {
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  };

  const fetchHistory = async (page = 1) => {
    if (!emulator) return;
    const token = tokenStorage.get();
    if (!token) return;
    setHistoryLoading(true);
    try {
      const client = createBackendClient(token);
      const response = await client.getHistory({
        user_id: user?.id,
        emulator_id: emulator.emulator_id,
        agent_id: emulator.agent_id,
        status: historyFilters.status,
        platform: historyFilters.platform,
        page,
        limit: historyPagination.pageSize,
      });
      setHistory(response.data || []);
      setHistoryPagination((prev) => ({ ...prev, current: response.page || page, total: response.total || 0 }));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (user && id) fetchEmulator();
  }, [user, id]);

  useEffect(() => {
    if (emulator) {
      fetchBindings();
    }
  }, [emulator?.id]);

  useEffect(() => {
    setTasksPagination((p) => ({ ...p, current: 1 }));
  }, [tasksFilters.status, tasksFilters.platform]);

  useEffect(() => {
    setHistoryPagination((p) => ({ ...p, current: 1 }));
  }, [historyFilters.status, historyFilters.platform]);

  useEffect(() => {
    if (emulator) fetchTasks(tasksPagination.current);
  }, [emulator?.id, emulator?.emulator_id, emulator?.agent_id, tasksFilters.status, tasksFilters.platform, tasksPagination.current]);

  useEffect(() => {
    if (emulator && user) fetchHistory(historyPagination.current);
  }, [emulator?.id, emulator?.emulator_id, emulator?.agent_id, historyFilters.status, historyFilters.platform, historyPagination.current, user?.id]);

  if (loading) return <Loading />;
  if (error || !emulator) return <ErrorDisplay message={error || 'Емулятор не знайдено'} />;

  const bindingColumns: ColumnsType<BindingWithAccount> = [
    { title: 'Account', key: 'account', render: (_, r) => r.account ? <Link href="/accounts">{r.account.username}</Link> : r.account_id },
    { title: 'Platform', key: 'platform', render: (_, r) => r.account?.platform && <Tag color="blue">{r.account.platform}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag> },
    { title: 'Binding Type', dataIndex: 'binding_type', key: 'binding_type' },
    { title: 'Bound At', dataIndex: 'bound_at', key: 'bound_at', render: (t: string) => t && new Date(t).toLocaleString() },
  ];

  const taskColumns: ColumnsType<Task> = [
    { title: 'Platform', dataIndex: 'platform', key: 'platform', render: (t: string) => t && <Tag color="blue">{t}</Tag> },
    { title: 'Action', dataIndex: 'action', key: 'action' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag>{s}</Tag> },
    { title: 'Account', key: 'account', render: (_, r) => r.account?.username || '-' },
    { title: 'Created', dataIndex: 'created_at', key: 'created_at', render: (t: string) => t && new Date(t).toLocaleString() },
    { title: 'Actions', key: 'actions', render: (_, r) => <Link href={`/queue`}>Queue</Link> },
  ];

  const historyColumns: ColumnsType<ExecutionHistory> = [
    { title: 'Platform', dataIndex: 'platform', key: 'platform', render: (t: string) => t && <Tag color="blue">{t}</Tag> },
    { title: 'Action', dataIndex: 'action', key: 'action' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'success' ? 'green' : s === 'error' ? 'red' : 'orange'}>{s}</Tag> },
    { title: 'Account', key: 'account', render: (_, r) => r.account?.username || '-' },
    { title: 'Started', dataIndex: 'started_at', key: 'started_at', render: (t: string) => t && new Date(t).toLocaleString() },
    { title: 'Duration', dataIndex: 'duration_ms', key: 'duration_ms', render: (ms: number) => ms ? `${(ms / 1000).toFixed(1)}s` : '-' },
    { title: 'Actions', key: 'actions', render: (_, r) => <Link href={`/history`}>History</Link> },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/emulators">
          <Button icon={<ArrowLeftOutlined />}>Назад до емуляторів</Button>
        </Link>
      </div>

      <Card title={formatEmulatorLabel(emulator)} style={{ marginBottom: 24 }}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="UUID">{emulator.id}</Descriptions.Item>
          <Descriptions.Item label="Emulator ID">{emulator.emulator_id}</Descriptions.Item>
          <Descriptions.Item label="Agent">{emulator.agent_id}</Descriptions.Item>
          <Descriptions.Item label="Device">{emulator.device_name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Status"><Tag color={emulator.status === 'active' ? 'green' : 'default'}>{emulator.status}</Tag></Descriptions.Item>
          <Descriptions.Item label="Visibility">{emulator.visibility === 1 ? <Tag color="green">Видимий</Tag> : <Tag>Прихований</Tag>}</Descriptions.Item>
          <Descriptions.Item label="Readiness">{emulator.readiness_status || 'new'}</Descriptions.Item>
          <Descriptions.Item label="Шаблон">{emulator.is_template ? <Tag>Так</Tag> : 'Ні'}</Descriptions.Item>
          <Descriptions.Item label="Last seen">{emulator.last_seen ? new Date(emulator.last_seen).toLocaleString() : '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Tabs
        items={[
          {
            key: 'bindings',
            label: (
              <span>
                <UserOutlined /> Прив&apos;язані аккаунти ({bindings.length})
              </span>
            ),
            children: (
              <>
                <Table
                  columns={bindingColumns}
                  dataSource={bindings}
                  rowKey="id"
                  loading={bindingsLoading}
                  pagination={false}
                  locale={{ emptyText: <Empty description="Немає прив'язаних аккаунтів" /> }}
                />
              </>
            ),
          },
          {
            key: 'tasks',
            label: (
              <span>
                <UnorderedListOutlined /> Черга задач ({tasksPagination.total})
              </span>
            ),
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Select
                    placeholder="Статус"
                    allowClear
                    style={{ width: 120 }}
                    value={tasksFilters.status || undefined}
                    onChange={(v) => setTasksFilters((f) => ({ ...f, status: v }))}
                    options={[
                      { value: 'pending', label: 'Pending' },
                      { value: 'processing', label: 'Processing' },
                      { value: 'completed', label: 'Completed' },
                      { value: 'failed', label: 'Failed' },
                    ]}
                  />
                  <Select
                    placeholder="Платформа"
                    allowClear
                    style={{ width: 120 }}
                    value={tasksFilters.platform || undefined}
                    onChange={(v) => setTasksFilters((f) => ({ ...f, platform: v }))}
                    options={[
                      { value: 'instagram', label: 'Instagram' },
                      { value: 'tiktok', label: 'TikTok' },
                      { value: 'youtube', label: 'YouTube' },
                    ]}
                  />
                </Space>
                <Table
                  columns={taskColumns}
                  dataSource={tasks}
                  rowKey="id"
                  loading={tasksLoading}
                  pagination={{
                    current: tasksPagination.current,
                    total: tasksPagination.total,
                    pageSize: tasksPagination.pageSize,
                    onChange: (p) => fetchTasks(p),
                  }}
                  locale={{ emptyText: <Empty description="Немає задач" /> }}
                />
              </>
            ),
          },
          {
            key: 'history',
            label: (
              <span>
                <HistoryOutlined /> Історія ({historyPagination.total})
              </span>
            ),
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Select
                    placeholder="Статус"
                    allowClear
                    style={{ width: 120 }}
                    value={historyFilters.status || undefined}
                    onChange={(v) => setHistoryFilters((f) => ({ ...f, status: v }))}
                    options={[
                      { value: 'pending', label: 'Pending' },
                      { value: 'success', label: 'Success' },
                      { value: 'error', label: 'Error' },
                    ]}
                  />
                  <Select
                    placeholder="Платформа"
                    allowClear
                    style={{ width: 120 }}
                    value={historyFilters.platform || undefined}
                    onChange={(v) => setHistoryFilters((f) => ({ ...f, platform: v }))}
                    options={[
                      { value: 'instagram', label: 'Instagram' },
                      { value: 'tiktok', label: 'TikTok' },
                      { value: 'youtube', label: 'YouTube' },
                    ]}
                  />
                </Space>
                <Table
                  columns={historyColumns}
                  dataSource={history}
                  rowKey="id"
                  loading={historyLoading}
                  pagination={{
                    current: historyPagination.current,
                    total: historyPagination.total,
                    pageSize: historyPagination.pageSize,
                    onChange: (p) => fetchHistory(p),
                  }}
                  locale={{ emptyText: <Empty description="Немає записів історії" /> }}
                />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
