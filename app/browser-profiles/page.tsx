'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Popconfirm, Tooltip, Card, Statistic, message, Typography, Row, Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, DeleteOutlined, FolderOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage, type BrowserProfile } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';

const { Text } = Typography;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface AgentProfiles {
  agentId: string;
  agentName: string;
  profiles: BrowserProfile[];
}

interface FlatProfile extends BrowserProfile {
  agentId: string;
  agentName: string;
}

export default function BrowserProfilesPage() {
  const { user } = useAuth();
  const [agentProfiles, setAgentProfiles] = useState<AgentProfiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const getClient = useCallback(() => {
    const token = tokenStorage.get();
    if (!token) throw new Error('Authorization required');
    return createBackendClient(token);
  }, []);

  const fetchProfiles = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getClient().getAdminBrowserProfiles();
      setAgentProfiles(data);
    } catch (err: any) {
      message.error(err.message || 'Error loading profiles');
    } finally {
      setLoading(false);
    }
  }, [user, getClient]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleDelete = async (agentId: string, profileId: string) => {
    const key = `${agentId}:${profileId}`;
    try {
      setDeletingIds(prev => new Set(prev).add(key));
      await getClient().deleteAdminBrowserProfile(agentId, profileId);
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

  const flatProfiles: FlatProfile[] = agentProfiles.flatMap(a =>
    a.profiles.map(p => ({ ...p, agentId: a.agentId, agentName: a.agentName })),
  );

  const totalSize = flatProfiles.reduce((sum, p) => sum + p.sizeBytes, 0);

  const columns: ColumnsType<FlatProfile> = [
    {
      title: 'Profile ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Space>
          <FolderOutlined style={{ color: '#faad14' }} />
          <Tooltip title={id}>
            <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{id.slice(0, 16)}…</Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Agent',
      dataIndex: 'agentName',
      key: 'agentName',
      width: 160,
      render: (v: string, record) => (
        <Tooltip title={record.agentId}>
          <Tag color="blue">{v}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'sizeBytes',
      key: 'sizeBytes',
      width: 100,
      sorter: (a, b) => a.sizeBytes - b.sizeBytes,
      render: (v: number) => (
        <Text style={{ fontSize: 12, color: v > 500 * 1024 * 1024 ? '#ff4d4f' : v > 100 * 1024 * 1024 ? '#faad14' : undefined }}>
          {formatBytes(v)}
        </Text>
      ),
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      sorter: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
      defaultSortOrder: 'descend',
      render: (v: string) => <Text style={{ fontSize: 12 }}>{new Date(v).toLocaleString()}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => {
        const key = `${record.agentId}:${record.id}`;
        return (
          <Popconfirm
            title="Delete this browser profile?"
            description="This will permanently remove all cookies and saved data."
            onConfirm={() => handleDelete(record.agentId, record.id)}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deletingIds.has(key)}
            />
          </Popconfirm>
        );
      },
    },
  ];

  if (!user) return <Loading />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Browser Profiles</h1>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Browser profile directories stored on browser-agent hosts
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchProfiles} loading={loading}>Refresh</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card><Statistic title="Total Profiles" value={flatProfiles.length} /></Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Size"
              value={formatBytes(totalSize)}
              valueStyle={{ fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Agents" value={agentProfiles.length} /></Card>
        </Col>
      </Row>

      {agentProfiles.map(agent => (
        <Card
          key={agent.agentId}
          title={
            <Space>
              <Tag color="blue">{agent.agentName}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>{agent.agentId}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {agent.profiles.length} profiles · {formatBytes(agent.profiles.reduce((s, p) => s + p.sizeBytes, 0))}
              </Text>
            </Space>
          }
          style={{ marginBottom: 16 }}
          size="small"
        >
          {agent.profiles.length === 0 ? (
            <Text type="secondary">No profiles found</Text>
          ) : (
            <Table
              dataSource={agent.profiles.map(p => ({ ...p, agentId: agent.agentId, agentName: agent.agentName }))}
              columns={columns}
              rowKey="id"
              loading={loading}
              size="small"
              pagination={false}
            />
          )}
        </Card>
      ))}

      {agentProfiles.length === 0 && !loading && (
        <Card>
          <Text type="secondary">No browser agents found or no profiles stored yet.</Text>
        </Card>
      )}
    </div>
  );
}
