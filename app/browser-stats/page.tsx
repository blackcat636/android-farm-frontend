'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table, Tag, Card, Row, Col, Statistic, Select, Button, Space, Tooltip, Spin,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  createBackendClient, tokenStorage,
  type BrowserTaskRunStat, type BrowserProfileRecord,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';

const ENGINE_COLORS: Record<string, string> = {
  curl: 'default', playwright: 'purple', browser: 'blue',
};

function formatBytes(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const PAGE_SIZE = 50;

export default function BrowserStatsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<BrowserTaskRunStat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<BrowserProfileRecord[]>([]);
  const [profileFilter, setProfileFilter] = useState<string | undefined>();
  const [engineFilter, setEngineFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [initialLoad, setInitialLoad] = useState(true);

  const getClient = useCallback(() => {
    const token = tokenStorage.get();
    if (!token) throw new Error('Authorization required');
    return createBackendClient(token);
  }, []);

  const fetchProfiles = useCallback(async () => {
    try {
      const client = getClient();
      const data = await client.getAdminBrowserProfiles();
      setProfiles(data);
    } catch {}
  }, [getClient]);

  const fetchStats = useCallback(async (p = 1) => {
    try {
      setLoading(true);
      const client = getClient();
      const offset = (p - 1) * PAGE_SIZE;
      const res = await client.getAdminBrowserTaskRunStats({
        profile_id: profileFilter,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(res.items.filter(r => !engineFilter || r.engine_used === engineFilter));
      setTotal(res.total);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [getClient, profileFilter, engineFilter]);

  useEffect(() => {
    if (user) {
      fetchProfiles();
      fetchStats(1);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    setPage(1);
    fetchStats(1);
  };

  if (initialLoad) return <Loading />;

  const totalRx = items.reduce((s, r) => s + (r.traffic_rx_bytes || 0), 0);
  const totalTx = items.reduce((s, r) => s + (r.traffic_tx_bytes || 0), 0);
  const avgDur = items.length
    ? Math.round(items.reduce((s, r) => s + (r.duration_sec || 0), 0) / items.length)
    : 0;

  const columns: ColumnsType<BrowserTaskRunStat> = [
    {
      title: 'Profile',
      key: 'profile',
      render: (_, r) => r.browser_profile?.name || r.browser_profile_id?.slice(0, 8) || '—',
    },
    {
      title: 'Session',
      dataIndex: 'session_id',
      key: 'session_id',
      width: 110,
      render: (v: string) => v ? <Tooltip title={v}>{v.slice(0, 8)}…</Tooltip> : '—',
    },
    {
      title: 'Engine',
      dataIndex: 'engine_used',
      key: 'engine_used',
      width: 110,
      render: (v: string) => v ? <Tag color={ENGINE_COLORS[v] ?? 'default'}>{v}</Tag> : '—',
    },
    {
      title: 'Traffic ↓',
      dataIndex: 'traffic_rx_bytes',
      key: 'traffic_rx_bytes',
      width: 100,
      render: (v: number) => formatBytes(v),
    },
    {
      title: 'Traffic ↑',
      dataIndex: 'traffic_tx_bytes',
      key: 'traffic_tx_bytes',
      width: 100,
      render: (v: number) => formatBytes(v),
    },
    {
      title: 'Duration',
      dataIndex: 'duration_sec',
      key: 'duration_sec',
      width: 90,
      render: (v: number) => v ? `${v}s` : '—',
    },
    {
      title: 'Active',
      dataIndex: 'active_duration_sec',
      key: 'active_duration_sec',
      width: 80,
      render: (v: number) => v ? `${v}s` : '—',
    },
    {
      title: 'Stop Reason',
      dataIndex: 'stop_reason',
      key: 'stop_reason',
      ellipsis: true,
      render: (v: string) => v || '—',
    },
    {
      title: 'Date',
      dataIndex: 'ended_at',
      key: 'ended_at',
      width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '—',
      sorter: (a, b) =>
        new Date(a.ended_at ?? a.created_at).getTime() - new Date(b.ended_at ?? b.created_at).getTime(),
      defaultSortOrder: 'descend',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>Browser Run Statistics</h2>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder="All profiles"
            style={{ width: 220 }}
            value={profileFilter}
            onChange={setProfileFilter}
            options={profiles.map(p => ({ value: p.id, label: p.name }))}
            showSearch
            optionFilterProp="label"
          />
          <Select
            allowClear
            placeholder="All engines"
            style={{ width: 150 }}
            value={engineFilter}
            onChange={setEngineFilter}
            options={[
              { value: 'curl', label: 'curl' },
              { value: 'playwright', label: 'playwright' },
              { value: 'browser', label: 'browser' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>Search</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { setProfileFilter(undefined); setEngineFilter(undefined); setTimeout(() => fetchStats(1), 0); }}>Reset</Button>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="Runs (page)" value={items.length} suffix={`/ ${total} total`} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Traffic ↓" value={formatBytes(totalRx)} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Traffic ↑" value={formatBytes(totalTx)} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Avg Duration" value={avgDur ? `${avgDur}s` : '—'} /></Card></Col>
      </Row>

      <Spin spinning={loading}>
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            onChange: (p) => { setPage(p); fetchStats(p); },
            showSizeChanger: false,
            showTotal: (t) => `Total ${t} runs`,
          }}
          locale={{ emptyText: 'No run stats yet' }}
        />
      </Spin>
    </div>
  );
}
