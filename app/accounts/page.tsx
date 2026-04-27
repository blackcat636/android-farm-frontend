'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Tag,
  Select,
  Card,
  Button,
  Space,
  message,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  Tabs,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  createBackendClient,
  tokenStorage,
  type SocialAccount,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UserOutlined,
  SafetyOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { CreateAccountModal } from '@/components/accounts/CreateAccountModal';
import { maskEmail } from '@/utils/maskEmail';

const { Option } = Select;
const { Title } = Typography;

export default function AccountsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'active' | 'banned'>('active');

  // Active tab state
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ platform?: string; requires_proxy?: boolean }>({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  // Banned tab state
  const [bannedAccounts, setBannedAccounts] = useState<SocialAccount[]>([]);
  const [bannedLoading, setBannedLoading] = useState(false);
  const [bannedFilters, setBannedFilters] = useState<{ platform?: string }>({});
  const [bannedPagination, setBannedPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const [createModalVisible, setCreateModalVisible] = useState(false);

  const fetchAccounts = async (page = 1) => {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const response = await createBackendClient(token).getSocialAccounts({
        ...filters,
        exclude_status: 'banned',
        page,
        limit: pagination.pageSize,
      });
      setAccounts(response.data || []);
      setPagination({ current: response.page || page, pageSize: response.limit || 20, total: response.total || 0 });
    } catch (err: any) {
      setError(err.message || 'Error loading accounts');
      message.error(err.message || 'Error loading accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchBannedAccounts = async (page = 1) => {
    if (!user) return;
    const token = tokenStorage.get();
    if (!token) return;
    setBannedLoading(true);
    try {
      const response = await createBackendClient(token).getSocialAccounts({
        ...bannedFilters,
        status: 'banned',
        page,
        limit: bannedPagination.pageSize,
      });
      setBannedAccounts(response.data || []);
      setBannedPagination({ current: response.page || page, pageSize: response.limit || 20, total: response.total || 0 });
    } catch {
      setBannedAccounts([]);
    } finally {
      setBannedLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts(1);
  }, [user, filters.platform, filters.requires_proxy]);

  useEffect(() => {
    fetchBannedAccounts(1);
  }, [user, bannedFilters.platform]);

  const handleDelete = async (accountId: string) => {
    const token = tokenStorage.get();
    if (!token) return;
    try {
      await createBackendClient(token).deleteSocialAccount(accountId);
      message.success('Account deleted');
      fetchAccounts(pagination.current);
      fetchBannedAccounts(bannedPagination.current);
    } catch (err: any) {
      message.error(err.message || 'Error deleting account');
    }
  };

  const handleUnblock = async (accountId: string) => {
    const token = tokenStorage.get();
    if (!token) return;
    try {
      await createBackendClient(token).unblockSocialAccount(accountId);
      message.success('Account unblocked');
      fetchAccounts(pagination.current);
    } catch (err: any) {
      message.error(err.message || 'Error unblocking account');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'green',
      banned: 'red',
      restricted: 'orange',
      suspended: 'volcano',
      inactive: 'default',
      testing: 'cyan',
      view_only: 'blue',
      warming_up: 'purple',
    };
    return colors[status] || 'default';
  };

  const baseColumns: ColumnsType<SocialAccount> = [
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => (
        <Tag color="blue" style={{ textTransform: 'capitalize' }}>{platform}</Tag>
      ),
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (username: string, record) => (
        <Button type="link" onClick={() => router.push(`/accounts/${record.id}`)}>
          {username}
        </Button>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => maskEmail(email),
    },
    {
      title: 'Country',
      key: 'country',
      render: (_: unknown, record: SocialAccount) => record.country_name || record.country_code || '-',
    },
    {
      title: 'Proxy',
      key: 'proxy',
      render: (_, record) => (
        <Tag color={record.requires_proxy ? 'orange' : 'default'}>
          {record.requires_proxy ? <><SafetyOutlined /> Required</> : 'Not required'}
        </Tag>
      ),
    },
    {
      title: 'Statistics',
      key: 'stats',
      render: (_, record) => (
        <Space size="small">
          <Tag>Tasks: {record.total_tasks}</Tag>
          <Tag color="green">Success: {record.successful_tasks}</Tag>
          <Tag color="red">Failed: {record.failed_tasks}</Tag>
        </Space>
      ),
    },
  ];

  const activeColumns: ColumnsType<SocialAccount> = [
    ...baseColumns,
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: SocialAccount) => {
        const isBlocked = record.blocked_until && new Date(record.blocked_until) > new Date();
        return (
          <Space size="small">
            <Tag color={getStatusColor(status)} style={{ textTransform: 'capitalize' }}>{status}</Tag>
            {isBlocked && (
              <Tag color="red">Blocked until {new Date(record.blocked_until!).toLocaleString('en-US')}</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const isBlocked = record.blocked_until && new Date(record.blocked_until) > new Date();
        return (
          <Space size="middle">
            {isBlocked && (
              <Popconfirm
                title="Unblock account?"
                onConfirm={() => handleUnblock(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button type="primary" icon={<UnlockOutlined />}>Unblock</Button>
              </Popconfirm>
            )}
            <Button icon={<EditOutlined />} onClick={() => router.push(`/accounts/${record.id}?tab=edit`)}>
              Edit
            </Button>
            <Popconfirm
              title="Delete account?"
              onConfirm={() => handleDelete(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const bannedColumns: ColumnsType<SocialAccount> = [
    ...baseColumns,
    {
      title: 'Status Reason',
      dataIndex: 'account_status_reason',
      key: 'account_status_reason',
      render: (r: string) => r || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => router.push(`/accounts/${record.id}?tab=edit`)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete account?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const onRow = (record: SocialAccount) => ({
    onClick: (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('.ant-btn')) return;
      router.push(`/accounts/${record.id}`);
    },
    style: { cursor: 'pointer' },
  });

  if (loading && !accounts.length && !bannedAccounts.length) return <Loading />;
  if (error && !accounts.length) return <ErrorDisplay message={error} />;

  const totalAll = pagination.total + bannedPagination.total;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>Social Accounts</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)} size="large">
          Add Account
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Total Accounts" value={totalAll} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active"
              value={accounts.filter((a) => a.status === 'active').length}
              styles={{ content: { color: '#3f8600' } }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Banned"
              value={bannedPagination.total}
              styles={{ content: { color: '#cf1322' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="With Proxy"
              value={accounts.filter((a) => a.requires_proxy).length}
              styles={{ content: { color: '#fa8c16' } }}
              prefix={<SafetyOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'active' | 'banned')}
        items={[
          {
            key: 'active',
            label: `Accounts (${pagination.total})`,
            children: (
              <>
                <Card style={{ marginBottom: 16 }}>
                  <Space>
                    <Select
                      placeholder="Filter by platform"
                      style={{ width: 200 }}
                      allowClear
                      value={filters.platform}
                      onChange={(value) => setFilters({ ...filters, platform: value })}
                    >
                      <Option value="instagram">Instagram</Option>
                      <Option value="youtube">YouTube</Option>
                      <Option value="tiktok">TikTok</Option>
                      <Option value="facebook">Facebook</Option>
                      <Option value="twitter">Twitter</Option>
                    </Select>
                    <Select
                      placeholder="Proxy"
                      style={{ width: 160 }}
                      allowClear
                      value={filters.requires_proxy}
                      onChange={(value) => setFilters({ ...filters, requires_proxy: value })}
                    >
                      <Option value={true}>Required</Option>
                      <Option value={false}>Not required</Option>
                    </Select>
                    <Button icon={<ReloadOutlined />} onClick={() => fetchAccounts(pagination.current)}>
                      Refresh
                    </Button>
                  </Space>
                </Card>
                <Table
                  columns={activeColumns}
                  dataSource={accounts}
                  rowKey="id"
                  loading={loading}
                  pagination={pagination}
                  onChange={(p) => fetchAccounts(p.current || 1)}
                  onRow={onRow}
                />
              </>
            ),
          },
          {
            key: 'banned',
            label: (
              <span style={{ color: bannedPagination.total > 0 ? '#cf1322' : undefined }}>
                Banned ({bannedPagination.total})
              </span>
            ),
            children: (
              <>
                <Card style={{ marginBottom: 16 }}>
                  <Space>
                    <Select
                      placeholder="Filter by platform"
                      style={{ width: 200 }}
                      allowClear
                      value={bannedFilters.platform}
                      onChange={(value) => setBannedFilters({ platform: value })}
                    >
                      <Option value="instagram">Instagram</Option>
                      <Option value="youtube">YouTube</Option>
                      <Option value="tiktok">TikTok</Option>
                      <Option value="facebook">Facebook</Option>
                      <Option value="twitter">Twitter</Option>
                    </Select>
                    <Button icon={<ReloadOutlined />} onClick={() => fetchBannedAccounts(bannedPagination.current)}>
                      Refresh
                    </Button>
                  </Space>
                </Card>
                <Table
                  columns={bannedColumns}
                  dataSource={bannedAccounts}
                  rowKey="id"
                  loading={bannedLoading}
                  pagination={bannedPagination}
                  onChange={(p) => fetchBannedAccounts(p.current || 1)}
                  onRow={onRow}
                />
              </>
            ),
          },
        ]}
      />

      <CreateAccountModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          fetchAccounts(1);
        }}
      />
    </div>
  );
}
