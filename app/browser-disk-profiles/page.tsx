'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Popconfirm, Tooltip, Card, Statistic, message, Typography, Row, Col, Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined, DeleteOutlined, FolderOutlined, WarningOutlined, LinkOutlined, DesktopOutlined,
} from '@ant-design/icons';
import { createBackendClient, tokenStorage, type BrowserDiskProfile, type BrowserSession } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import Link from 'next/link';

const { Text } = Typography;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'pink',
  youtube: 'red',
  tiktok: 'purple',
  facebook: 'blue',
  twitter: 'cyan',
};

const SESSION_STATUS_COLORS: Record<string, string> = {
  running: 'success',
  pending: 'processing',
  starting: 'processing',
  stopping: 'warning',
  stopped: 'default',
  error: 'error',
};

const AUTH_STATUS_COLORS: Record<string, string> = {
  authorized: 'success',
  authenticated: 'success',
  none: 'default',
  in_progress: 'processing',
  waiting_2fa: 'warning',
  auth_failed: 'error',
};

interface AgentProfiles {
  agentId: string;
  agentName: string;
  profiles: BrowserDiskProfile[];
}

interface EnrichedProfile extends BrowserDiskProfile {
  agentId: string;
  agentName: string;
  session?: BrowserSession;
  orphan: boolean;
}

export default function BrowserDiskProfilesPage() {
  const { user } = useAuth();
  const [agentProfiles, setAgentProfiles] = useState<AgentProfiles[]>([]);
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const getClient = useCallback(() => {
    const token = tokenStorage.get();
    if (!token) throw new Error('Authorization required');
    return createBackendClient(token);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const client = getClient();
      const [profilesData, sessionsData] = await Promise.all([
        client.getAdminBrowserAgentDiskProfiles(),
        client.getAdminBrowserSessions(),
      ]);
      setAgentProfiles(profilesData);
      setSessions(sessionsData);
    } catch (err: any) {
      message.error(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [user, getClient]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (agentId: string, profileId: string) => {
    const key = `${agentId}:${profileId}`;
    try {
      setDeletingIds(prev => new Set(prev).add(key));
      await getClient().deleteAdminBrowserAgentDiskProfile(agentId, profileId);
      message.success('Profile deleted');
      setAgentProfiles(prev =>
        prev.map(a =>
          a.agentId === agentId
            ? { ...a, profiles: a.profiles.filter(p => p.id !== profileId) }
            : a,
        ),
      );
    } catch (err: any) {
      message.error(err.message || 'Error deleting profile');
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const latestSessionByProfile = sessions.reduce<Record<string, BrowserSession>>((acc, s) => {
    if (!s.browser_profile_id) return acc;
    const existing = acc[s.browser_profile_id];
    if (!existing || new Date(s.updated_at || s.created_at) > new Date(existing.updated_at || existing.created_at)) {
      acc[s.browser_profile_id] = s;
    }
    return acc;
  }, {});

  const enrichedProfiles: EnrichedProfile[] = agentProfiles.flatMap(a =>
    a.profiles.map(p => {
      const session = latestSessionByProfile[p.browser_profile_id || p.id];
      const orphan = !p.browser_profile_id && (p.type === 'profile' || p.type === 'unknown' || !p.type);
      return { ...p, agentId: a.agentId, agentName: a.agentName, session, orphan };
    }),
  );

  const totalSize = enrichedProfiles.reduce((sum, p) => sum + p.sizeBytes, 0);
  const orphanCount = enrichedProfiles.filter(p => p.orphan).length;
  const activeCount = enrichedProfiles.filter(p => p.session?.status === 'running').length;
  const ephemeralCount = enrichedProfiles.filter(p => p.type === 'ephemeral').length;

  const columns: ColumnsType<EnrichedProfile> = [
    {
      title: 'Type',
      key: 'type',
      width: 110,
      filters: [
        { text: 'Profile', value: 'profile' },
        { text: 'Ephemeral', value: 'ephemeral' },
        { text: 'Unknown', value: 'unknown' },
      ],
      onFilter: (value, r) => (r.type || 'unknown') === value,
      render: (_, r) => {
        if (r.type === 'ephemeral') return <Tag color="orange" style={{ fontSize: 11 }}>Ephemeral</Tag>;
        if (r.type === 'profile') return <Tag color="blue" style={{ fontSize: 11 }}>Profile</Tag>;
        return <Tag color="default" style={{ fontSize: 11 }}>Unknown</Tag>;
      },
    },
    {
      title: 'Profile',
      key: 'profile',
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Space size={4}>
            <FolderOutlined style={{ color: r.orphan ? '#ff4d4f' : r.type === 'ephemeral' ? '#fa8c16' : '#faad14' }} />
            <Tooltip title={r.id}>
              <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.id.slice(0, 16)}…</Text>
            </Tooltip>
            {r.orphan && (
              <Tooltip title="No matching browser profile in DB — orphaned">
                <WarningOutlined style={{ color: '#ff4d4f' }} />
              </Tooltip>
            )}
          </Space>
          {r.browser_profile_id && (
            <Link href={`/browser-profiles/${r.browser_profile_id}`}>
              <Text style={{ fontSize: 12 }}>{r.browser_profile_id.slice(0, 8)}…</Text>
            </Link>
          )}
          {r.type === 'ephemeral' && r.session_id && (
            <Text type="secondary" style={{ fontSize: 11 }}>session {r.session_id.slice(0, 8)}…</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Session',
      key: 'session',
      width: 160,
      render: (_, r) => {
        if (!r.session) return <Text type="secondary" style={{ fontSize: 11 }}>No session</Text>;
        const s = r.session;
        const isActive = ['running', 'pending', 'starting'].includes(s.status);
        return (
          <Space direction="vertical" size={2}>
            <Space size={4}>
              <Badge status={SESSION_STATUS_COLORS[s.status] as any} />
              <Text style={{ fontSize: 11 }}>{s.status}</Text>
            </Space>
            {isActive && s.vnc_url && (
              <a href={`${s.vnc_url}?autoconnect=1`} target="_blank" rel="noreferrer">
                <Button size="small" icon={<DesktopOutlined />} style={{ fontSize: 11, height: 20, padding: '0 6px' }}>
                  VNC
                </Button>
              </a>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Size',
      dataIndex: 'sizeBytes',
      key: 'sizeBytes',
      width: 90,
      sorter: (a, b) => a.sizeBytes - b.sizeBytes,
      render: (v: number) => (
        <Text style={{ fontSize: 12, color: v > 500 * 1024 * 1024 ? '#ff4d4f' : v > 100 * 1024 * 1024 ? '#faad14' : undefined }}>
          {formatBytes(v)}
        </Text>
      ),
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      sorter: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      defaultSortOrder: 'descend',
      render: (v: string) => <Text style={{ fontSize: 11 }}>{new Date(v).toLocaleString()}</Text>,
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_, record) => {
        const key = `${record.agentId}:${record.id}`;
        const hasActiveSession = ['running', 'pending', 'starting', 'stopping'].includes(record.session?.status || '');
        return (
          <Tooltip title={hasActiveSession ? 'Stop session first' : 'Delete profile'}>
            <Popconfirm
              title="Delete browser profile?"
              description="This will permanently remove all cookies and saved data."
              onConfirm={() => handleDelete(record.agentId, record.id)}
              disabled={hasActiveSession}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deletingIds.has(key)}
                disabled={hasActiveSession}
              />
            </Popconfirm>
          </Tooltip>
        );
      },
    },
  ];

  if (!user) return <Loading />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Disk Profiles</h1>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Browser profile directories stored on browser-agent hosts
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>Refresh</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={4}>
          <Card size="small"><Statistic title="Total Profiles" value={enrichedProfiles.length} /></Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="Total Size" value={formatBytes(totalSize)} valueStyle={{ fontSize: 18 }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="Ephemeral" value={ephemeralCount} valueStyle={{ color: ephemeralCount > 0 ? '#fa8c16' : undefined }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="Active Sessions" value={activeCount} valueStyle={{ color: activeCount > 0 ? '#52c41a' : undefined }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic title="Orphaned" value={orphanCount} valueStyle={{ color: orphanCount > 0 ? '#ff4d4f' : undefined }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small"><Statistic title="Agents" value={agentProfiles.length} /></Card>
        </Col>
      </Row>

      {agentProfiles.map(agent => {
        const agentEnriched = enrichedProfiles.filter(p => p.agentId === agent.agentId);
        const agentSize = agentEnriched.reduce((s, p) => s + p.sizeBytes, 0);
        return (
          <Card
            key={agent.agentId}
            title={
              <Space>
                <Tag color="blue">{agent.agentName}</Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>{agent.agentId}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {agent.profiles.length} profiles · {formatBytes(agentSize)}
                </Text>
              </Space>
            }
            style={{ marginBottom: 16 }}
            size="small"
          >
            {agentEnriched.length === 0 ? (
              <Text type="secondary">No profiles found</Text>
            ) : (
              <Table
                dataSource={agentEnriched}
                columns={columns}
                rowKey="id"
                loading={loading}
                size="small"
                pagination={false}
                rowClassName={r => r.orphan ? 'ant-table-row-danger' : ''}
              />
            )}
          </Card>
        );
      })}

      {agentProfiles.length === 0 && !loading && (
        <Card>
          <Text type="secondary">No browser agents found or no profiles stored yet.</Text>
        </Card>
      )}
    </div>
  );
}
