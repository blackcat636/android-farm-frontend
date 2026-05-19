'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Table, Tag, Select, Input, Space, Button, Tooltip, Typography, Badge } from 'antd';
import { ReloadOutlined, ClearOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { createBackendClient, tokenStorage, type BrowserLog } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';

const { Text } = Typography;

const LEVEL_BADGE: Record<string, any> = {
  info:  { status: 'processing', color: '#1890ff' },
  warn:  { status: 'warning',   color: '#faad14' },
  error: { status: 'error',     color: '#ff4d4f' },
};

const EVENT_COLOR: Record<string, string> = {
  session_start:   'cyan',
  session_stop:    'default',
  auth_start:      'blue',
  auth_ok:         'green',
  auth_fail:       'red',
  scenario_start:  'purple',
  scenario_ok:     'green',
  scenario_fail:   'red',
  error:           'red',
};

const EVENTS = [
  'session_start', 'session_stop',
  'auth_start', 'auth_ok', 'auth_fail',
  'scenario_start', 'scenario_ok', 'scenario_fail',
  'error',
];

const PAGE_SIZE = 100;

export default function BrowserLogsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<BrowserLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [filterLevel, setFilterLevel] = useState<string | undefined>();
  const [filterEvent, setFilterEvent] = useState<string | undefined>();
  const [filterSession, setFilterSession] = useState(searchParams.get('session_id') || '');
  const [filterAccount, setFilterAccount] = useState('');

  const getClient = useCallback(() => {
    const token = tokenStorage.get();
    if (!token) throw new Error('No token');
    return createBackendClient(token);
  }, []);

  const fetch = useCallback(async (p = page) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await getClient().getAdminBrowserLogs({
        level: filterLevel,
        event: filterEvent,
        session_id: filterSession || undefined,
        account_id: filterAccount || undefined,
        limit: PAGE_SIZE,
        offset: (p - 1) * PAGE_SIZE,
      });
      setLogs(res.data);
      setTotal(res.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user, getClient, filterLevel, filterEvent, filterSession, filterAccount, page]);

  useEffect(() => { setPage(1); fetch(1); }, [filterLevel, filterEvent, filterSession, filterAccount]);
  useEffect(() => { fetch(page); }, [page]);

  // Auto-refresh every 5s
  useEffect(() => {
    const t = setInterval(() => fetch(page), 5000);
    return () => clearInterval(t);
  }, [fetch, page]);

  const columns: ColumnsType<BrowserLog> = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => (
        <Text style={{ fontSize: 12, fontFamily: 'monospace' }}>
          {new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{new Date(v).toLocaleDateString()}</Text>
        </Text>
      ),
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: 75,
      render: (v: string) => (
        <Badge status={LEVEL_BADGE[v]?.status || 'default'} text={<Text style={{ fontSize: 12, color: LEVEL_BADGE[v]?.color }}>{v}</Text>} />
      ),
    },
    {
      title: 'Event',
      dataIndex: 'event',
      key: 'event',
      width: 140,
      render: (v: string) => <Tag color={EVENT_COLOR[v] || 'default'} style={{ fontSize: 12 }}>{v}</Tag>,
    },
    {
      title: 'Account',
      key: 'account',
      width: 160,
      render: (_, log) => log.account ? (
        <div>
          <Tag style={{ fontSize: 11 }}>{log.account.platform}</Tag>
          <Text style={{ fontSize: 12 }}>{log.account.username}</Text>
        </div>
      ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Session',
      key: 'session',
      width: 110,
      render: (_, log) => log.session_id ? (
        <Tooltip title={log.session_id}>
          <Text style={{ fontSize: 11, fontFamily: 'monospace', cursor: 'pointer' }} copyable={{ text: log.session_id }}>
            {log.session_id.slice(0, 8)}…
          </Text>
        </Tooltip>
      ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Message',
      key: 'message',
      render: (_, log) => (
        <div>
          {log.message && <Text style={{ fontSize: 13 }}>{log.message}</Text>}
          {log.data && (
            <Tooltip title={<pre style={{ fontSize: 11, margin: 0, maxWidth: 400 }}>{JSON.stringify(log.data, null, 2)}</pre>}>
              <Text type="secondary" style={{ fontSize: 11, marginLeft: log.message ? 8 : 0, cursor: 'help' }}>
                {'{data}'}
              </Text>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Agent',
      dataIndex: 'agent_id',
      key: 'agent_id',
      width: 120,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>,
    },
  ];

  const clearFilters = () => {
    setFilterLevel(undefined);
    setFilterEvent(undefined);
    setFilterSession('');
    setFilterAccount('');
  };

  if (!user) return <Loading />;

  const hasFilters = !!(filterLevel || filterEvent || filterSession || filterAccount);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Browser Agent Logs</h1>
          <Text type="secondary">{total} entries · auto-refresh 5s</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => fetch(page)} loading={loading}>Refresh</Button>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          allowClear
          placeholder="Level"
          style={{ width: 110 }}
          value={filterLevel}
          onChange={setFilterLevel}
          options={[{ value: 'info', label: 'info' }, { value: 'warn', label: 'warn' }, { value: 'error', label: 'error' }]}
        />
        <Select
          allowClear
          placeholder="Event"
          style={{ width: 160 }}
          value={filterEvent}
          onChange={setFilterEvent}
          options={EVENTS.map(e => ({ value: e, label: e }))}
        />
        <Input
          allowClear
          placeholder="Session ID"
          style={{ width: 200, fontFamily: 'monospace' }}
          value={filterSession}
          onChange={e => setFilterSession(e.target.value)}
        />
        <Input
          allowClear
          placeholder="Account ID"
          style={{ width: 200, fontFamily: 'monospace' }}
          value={filterAccount}
          onChange={e => setFilterAccount(e.target.value)}
        />
        {hasFilters && (
          <Button icon={<ClearOutlined />} onClick={clearFilters}>Clear</Button>
        )}
      </Space>

      <Table
        dataSource={logs}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        rowClassName={log => log.level === 'error' ? 'log-row-error' : log.level === 'warn' ? 'log-row-warn' : ''}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: t => `${t} total`,
          onChange: p => setPage(p),
        }}
      />

      <style>{`
        .log-row-error td { background: #fff1f0 !important; }
        .log-row-warn td { background: #fffbe6 !important; }
      `}</style>
    </div>
  );
}
