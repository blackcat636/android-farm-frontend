'use client';

import { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Switch, Tooltip, Space, message, Badge, Typography } from 'antd';
import { AndroidOutlined, ChromeOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { createBackendClient, tokenStorage, type Agent } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';

const { Text } = Typography;

function formatLastSeen(lastSeen?: string): string {
  if (!lastSeen) return '—';
  const diff = Date.now() - new Date(lastSeen).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isOnline(agent: Agent): boolean {
  if (agent.status === 'online') return true;
  if (!agent.last_seen) return false;
  return Date.now() - new Date(agent.last_seen).getTime() < 90_000;
}

export default function AgentsPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const token = tokenStorage.get();
    if (!token) return;
    setLoading(true);
    try {
      const data = await createBackendClient(token).getAgents(true);
      setAgents(data);
    } catch {
      message.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleVisibility = async (agent: Agent) => {
    const token = tokenStorage.get();
    if (!token) return;
    const newVisibility = agent.visibility === 0 ? 1 : 0;
    setToggling(prev => new Set(prev).add(agent.id));
    try {
      await createBackendClient(token).updateAgent(agent.id, { visibility: newVisibility });
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, visibility: newVisibility } : a));
    } catch {
      message.error('Failed to update agent');
    } finally {
      setToggling(prev => { const s = new Set(prev); s.delete(agent.id); return s; });
    }
  };

  const columns: ColumnsType<Agent> = [
    {
      title: 'Status',
      key: 'status',
      width: 80,
      align: 'center',
      render: (_, agent) => (
        <Badge
          status={isOnline(agent) ? 'success' : 'default'}
          text={<Text style={{ fontSize: 12 }}>{isOnline(agent) ? 'online' : 'offline'}</Text>}
        />
      ),
    },
    {
      title: 'Type',
      key: 'type',
      width: 110,
      render: (_, agent) => {
        const type = agent.type || 'android';
        return (
          <Tag
            icon={type === 'browser' ? <ChromeOutlined /> : <AndroidOutlined />}
            color={type === 'browser' ? 'geekblue' : 'green'}
            style={{ fontWeight: 500 }}
          >
            {type}
          </Tag>
        );
      },
      filters: [
        { text: 'Android', value: 'android' },
        { text: 'Browser', value: 'browser' },
      ],
      onFilter: (value, record) => (record.type || 'android') === value,
    },
    {
      title: 'Name / ID',
      key: 'name',
      render: (_, agent) => (
        <div>
          <div style={{ fontWeight: 600 }}>{agent.name || agent.id}</div>
          {agent.name && <Text type="secondary" style={{ fontSize: 12 }}>{agent.id}</Text>}
        </div>
      ),
    },
    {
      title: 'URL',
      key: 'url',
      render: (_, agent) => {
        const url = agent.tunnel_url || agent.url;
        if (!url) return <Text type="secondary">—</Text>;
        return (
          <Tooltip title={url}>
            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, maxWidth: 260, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
              {url.replace(/^https?:\/\//, '')}
            </a>
          </Tooltip>
        );
      },
    },
    {
      title: 'Last seen',
      key: 'last_seen',
      width: 110,
      render: (_, agent) => (
        <Tooltip title={agent.last_seen ? new Date(agent.last_seen).toLocaleString() : undefined}>
          <Text style={{ fontSize: 13 }}>{formatLastSeen(agent.last_seen)}</Text>
        </Tooltip>
      ),
      sorter: (a, b) => {
        const ta = a.last_seen ? new Date(a.last_seen).getTime() : 0;
        const tb = b.last_seen ? new Date(b.last_seen).getTime() : 0;
        return tb - ta;
      },
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Visible',
      key: 'visibility',
      width: 80,
      align: 'center',
      render: (_, agent) => (
        <Switch
          size="small"
          checked={agent.visibility !== 0}
          loading={toggling.has(agent.id)}
          onChange={() => toggleVisibility(agent)}
        />
      ),
    },
  ];

  if (!user) return <Loading />;

  const online = agents.filter(isOnline).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Agents</h1>
          <Text type="secondary">{online} online / {agents.length} total</Text>
        </div>
        <ReloadOutlined
          onClick={load}
          spin={loading}
          style={{ fontSize: 18, cursor: 'pointer', color: '#1890ff' }}
        />
      </div>

      <Table
        dataSource={agents}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="middle"
        rowClassName={agent => agent.visibility === 0 ? 'ant-table-row-hidden' : ''}
        style={{ opacity: 1 }}
      />

      <style>{`
        .ant-table-row-hidden td { opacity: 0.45; }
      `}</style>
    </div>
  );
}
