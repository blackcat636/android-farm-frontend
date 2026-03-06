'use client';

import { useState, useEffect } from 'react';
import { Table, Tag, Select, Card, Space, Button, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import { createBackendClient, authApi, tokenStorage, type UserWithRole } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';
import { maskEmail } from '@/utils/maskEmail';

interface UserPostClone {
  id: string;
  user_post_id: string;
  user_id: string;
  account_id?: string;
  url?: string;
  social_url?: string;
  description?: string;
  platform?: string;
  views_count: number;
  likes_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function UserPostClonesPage() {
  const { user } = useAuth();
  const [clones, setClones] = useState<UserPostClone[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    user_id?: string;
    user_post_id?: string;
    account_id?: string;
    status?: string;
  }>({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchUsers = async () => {
    try {
      const data = await authApi.getUsers();
      setUsers(data);
    } catch {}
  };

  const fetchClones = async (page = 1) => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const client = createBackendClient(token);
      const response = await client.getAdminUserPostClones({
        ...filters,
        page,
        limit: pagination.pageSize,
      });
      setClones(response.data || []);
      setPagination({ current: response.page, pageSize: response.limit || pagination.pageSize, total: response.total });
    } catch (err: any) {
      setError(err.message || 'Error loading clones');
      message.error(err.message || 'Error loading clones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (user) fetchClones(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filters.user_id, filters.user_post_id, filters.account_id, filters.status]);

  const getUserEmail = (userId: string) => {
    const u = users.find((u) => u.id === userId);
    return u?.email ? maskEmail(u.email) : userId.slice(0, 8);
  };

  const statusColors: Record<string, string> = {
    new: 'blue',
    pending: 'orange',
    published: 'cyan',
    failed: 'red',
    active: 'green',
    deleted: 'default',
  };

  const columns: ColumnsType<UserPostClone> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100, render: (id: string) => id.slice(0, 8) },
    { title: 'User', dataIndex: 'user_id', key: 'user_id', render: (userId: string) => getUserEmail(userId) },
    {
      title: 'Parent Post',
      dataIndex: 'user_post_id',
      key: 'user_post_id',
      render: (id: string) => id ? id.slice(0, 8) : '-',
    },
    {
      title: 'Account',
      dataIndex: 'account_id',
      key: 'account_id',
      render: (id: string) => id ? id.slice(0, 8) : '-',
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (url: string) => url ? <a href={url} target="_blank" rel="noopener noreferrer">{url}</a> : '-',
    },
    {
      title: 'Social URL',
      dataIndex: 'social_url',
      key: 'social_url',
      ellipsis: true,
      render: (url: string) => url ? <a href={url} target="_blank" rel="noopener noreferrer">{url}</a> : '-',
    },
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      render: (p: string) => p ? <Tag color="purple">{p}</Tag> : '-',
    },
    { title: 'Views', dataIndex: 'views_count', key: 'views_count' },
    { title: 'Likes', dataIndex: 'likes_count', key: 'likes_count' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString('en-US'),
    },
  ];

  if (loading && !clones.length) return <Loading />;
  if (error && !clones.length) return <ErrorDisplay message={error} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Post Clones</h1>
        <Button icon={<ReloadOutlined />} onClick={() => fetchClones(pagination.current)} loading={loading}>
          Refresh
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Filter by user"
            allowClear
            style={{ width: 250 }}
            showSearch
            optionFilterProp="label"
            value={filters.user_id}
            onChange={(value) => setFilters({ ...filters, user_id: value })}
            options={users.map((u) => ({ label: u.email || u.id, value: u.id }))}
          />
          <Select
            placeholder="Filter by status"
            allowClear
            style={{ width: 150 }}
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={[
              { label: 'New', value: 'new' },
              { label: 'Pending', value: 'pending' },
              { label: 'Published', value: 'published' },
              { label: 'Failed', value: 'failed' },
              { label: 'Active', value: 'active' },
              { label: 'Deleted', value: 'deleted' },
            ]}
          />
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={clones}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showTotal: (total) => `Total ${total} clones`,
        }}
        onChange={(p) => fetchClones(p.current)}
      />
    </div>
  );
}
