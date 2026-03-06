'use client';

import { useState, useEffect } from 'react';
import { Table, Tag, Select, Card, Space, Button, message, Modal, Form, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { createBackendClient, authApi, tokenStorage, type UserWithRole } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';
import { maskEmail } from '@/utils/maskEmail';

interface UserPost {
  id: string;
  user_id: string;
  url?: string;
  description?: string;
  screenshot_url?: string;
  platform?: string;
  views_count: number;
  likes_count: number;
  status: string;
  created_at: string;
  updated_at: string;
}

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
}

export default function UserPostsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ user_id?: string; status?: string }>({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [expandedClones, setExpandedClones] = useState<Record<string, UserPostClone[]>>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm] = Form.useForm();

  const fetchUsers = async () => {
    try {
      const data = await authApi.getUsers();
      setUsers(data);
    } catch {}
  };

  const fetchPosts = async (page = 1) => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const client = createBackendClient(token);
      const response = await client.getAdminUserPosts({
        ...filters,
        page,
        limit: pagination.pageSize,
      });
      setPosts(response.data || []);
      setPagination({ current: response.page, pageSize: response.limit || pagination.pageSize, total: response.total });
    } catch (err: any) {
      setError(err.message || 'Error loading posts');
      message.error(err.message || 'Error loading posts');
    } finally {
      setLoading(false);
    }
  };

  const fetchClones = async (postId: string) => {
    try {
      const token = tokenStorage.get();
      if (!token) return;
      const client = createBackendClient(token);
      const response = await client.getAdminUserPostClones({ user_post_id: postId, limit: 100 });
      setExpandedClones((prev) => ({ ...prev, [postId]: response.data || [] }));
    } catch {}
  };

  const handleCreatePost = async (values: { user_id: string; url: string; description?: string; platform?: string }) => {
    try {
      setCreateLoading(true);
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const client = createBackendClient(token);
      await client.createAdminUserPost(values);
      message.success('Post created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchPosts(1);
    } catch (err: any) {
      message.error(err?.response?.data?.message || err.message || 'Error creating post');
    } finally {
      setCreateLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (user) fetchPosts(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filters.user_id, filters.status]);

  const getUserEmail = (userId: string) => {
    const u = users.find((u) => u.id === userId);
    return u?.email ? maskEmail(u.email) : userId.slice(0, 8);
  };

  const statusColors: Record<string, string> = {
    new: 'blue',
    active: 'green',
    paused: 'orange',
    deleted: 'red',
  };

  const columns: ColumnsType<UserPost> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => id.slice(0, 8),
    },
    {
      title: 'User',
      dataIndex: 'user_id',
      key: 'user_id',
      render: (userId: string) => getUserEmail(userId),
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (url: string) => url ? <a href={url} target="_blank" rel="noopener noreferrer">{url}</a> : '-',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '-',
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

  const cloneColumns: ColumnsType<UserPostClone> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100, render: (id: string) => id.slice(0, 8) },
    { title: 'Account', dataIndex: 'account_id', key: 'account_id', render: (id: string) => id ? id.slice(0, 8) : '-' },
    { title: 'URL', dataIndex: 'url', key: 'url', ellipsis: true, render: (url: string) => url ? <a href={url} target="_blank" rel="noopener noreferrer">{url}</a> : '-' },
    { title: 'Social URL', dataIndex: 'social_url', key: 'social_url', ellipsis: true, render: (url: string) => url ? <a href={url} target="_blank" rel="noopener noreferrer">{url}</a> : '-' },
    { title: 'Platform', dataIndex: 'platform', key: 'platform', render: (p: string) => p ? <Tag color="purple">{p}</Tag> : '-' },
    { title: 'Views', dataIndex: 'views_count', key: 'views_count' },
    { title: 'Likes', dataIndex: 'likes_count', key: 'likes_count' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag> },
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', render: (text: string) => new Date(text).toLocaleString('en-US') },
  ];

  if (loading && !posts.length) return <Loading />;
  if (error && !posts.length) return <ErrorDisplay message={error} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>User Posts</h1>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            Add Post
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => fetchPosts(pagination.current)} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space>
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
              { label: 'Active', value: 'active' },
              { label: 'Paused', value: 'paused' },
              { label: 'Deleted', value: 'deleted' },
            ]}
          />
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={posts}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showTotal: (total) => `Total ${total} posts`,
        }}
        onChange={(p) => fetchPosts(p.current)}
        expandable={{
          expandedRowRender: (record) => (
            <Table
              columns={cloneColumns}
              dataSource={expandedClones[record.id] || []}
              rowKey="id"
              pagination={false}
              size="small"
            />
          ),
          onExpand: (expanded, record) => {
            if (expanded && !expandedClones[record.id]) {
              fetchClones(record.id);
            }
          },
        }}
      />
      <Modal
        title="Add Post"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        confirmLoading={createLoading}
        okText="Create"
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreatePost}>
          <Form.Item name="user_id" label="User" rules={[{ required: true, message: 'Please select a user' }]}>
            <Select
              placeholder="Select user"
              showSearch
              optionFilterProp="label"
              options={users.map((u) => ({ label: u.email || u.id, value: u.id }))}
            />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true, message: 'Please enter URL' }]}>
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional description" />
          </Form.Item>
          <Form.Item name="platform" label="Platform">
            <Select
              placeholder="Select platform"
              allowClear
              options={[
                { label: 'Instagram', value: 'instagram' },
                { label: 'TikTok', value: 'tiktok' },
                { label: 'YouTube', value: 'youtube' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
