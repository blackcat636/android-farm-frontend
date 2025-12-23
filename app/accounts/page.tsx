'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Select,
  Card,
  Button,
  Space,
  message,
  Popconfirm,
  Modal,
  Form,
  Input,
  Switch,
  Typography,
  Row,
  Col,
  Statistic,
  Drawer,
  Descriptions,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  createBackendClient,
  tokenStorage,
  type SocialAccount,
  type AccountProxy,
  type AccountEmulatorBinding,
  type CreateSocialAccountDto,
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
  LinkOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { CreateAccountModal } from '@/components/accounts/CreateAccountModal';
import { EditAccountModal } from '@/components/accounts/EditAccountModal';
import { AccountDetailsDrawer } from '@/components/accounts/AccountDetailsDrawer';
import { maskEmail } from '@/utils/maskEmail';

const { Option } = Select;
const { Title } = Typography;

export default function AccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    platform?: string;
    status?: string;
    requires_proxy?: boolean;
  }>({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [stats, setStats] = useState<any>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<SocialAccount | null>(null);
  const [detailsDrawerVisible, setDetailsDrawerVisible] = useState(false);
  const [detailsAccount, setDetailsAccount] = useState<SocialAccount | null>(null);

  const fetchAccounts = async (page = 1) => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      const response = await backendClient.getSocialAccounts({
        ...filters,
        page,
        limit: pagination.pageSize,
      });

      setAccounts(response.data || []);
      setPagination({
        current: response.page || page,
        pageSize: response.limit || pagination.pageSize,
        total: response.total || 0,
      });

      // Calculate statistics
      const total = response.total || 0;
      const active = response.data.filter((a) => a.status === 'active').length;
      const banned = response.data.filter((a) => a.status === 'banned').length;
      const withProxy = response.data.filter((a) => a.requires_proxy).length;

      setStats({
        total,
        active,
        banned,
        withProxy,
      });
    } catch (err: any) {
      setError(err.message || 'Error loading accounts');
      message.error(err.message || 'Error loading accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts(pagination.current);
  }, [user, filters.platform, filters.status, filters.requires_proxy]);

  const handleDelete = async (accountId: string) => {
    try {
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      await backendClient.deleteSocialAccount(accountId);
      message.success('Account deleted');
      fetchAccounts(pagination.current);
    } catch (err: any) {
      message.error(err.message || 'Error deleting account');
    }
  };

  const handleUnblock = async (accountId: string) => {
    try {
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      await backendClient.unblockSocialAccount(accountId);
      message.success('Account unblocked');
      fetchAccounts(pagination.current);
      
      // Update details if opened
      if (detailsAccount && detailsAccount.id === accountId) {
        const updatedAccount = await backendClient.getSocialAccount(accountId);
        setDetailsAccount(updatedAccount);
      }
    } catch (err: any) {
      message.error(err.message || 'Error unblocking account');
    }
  };

  const handleTableChange = (newPagination: any) => {
    fetchAccounts(newPagination.current);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'green',
      banned: 'red',
      restricted: 'orange',
      suspended: 'volcano',
      inactive: 'default',
    };
    return colors[status] || 'default';
  };

  const handleViewDetails = async (account: SocialAccount) => {
    setDetailsAccount(account);
    setDetailsDrawerVisible(true);
  };

  const columns: ColumnsType<SocialAccount> = [
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => (
        <Tag color="blue" style={{ textTransform: 'capitalize' }}>
          {platform}
        </Tag>
      ),
      filters: [
        { text: 'Instagram', value: 'instagram' },
        { text: 'YouTube', value: 'youtube' },
        { text: 'TikTok', value: 'tiktok' },
        { text: 'Facebook', value: 'facebook' },
        { text: 'Twitter', value: 'twitter' },
      ],
      onFilter: (value, record) => record.platform === value,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (username: string, record) => (
        <Button type="link" onClick={() => handleViewDetails(record)}>
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: SocialAccount) => {
        const isBlocked = record.blocked_until && new Date(record.blocked_until) > new Date();
        const blockedUntil = record.blocked_until ? new Date(record.blocked_until) : null;
        
        return (
          <Space orientation="vertical" size="small">
        <Tag color={getStatusColor(status)} style={{ textTransform: 'capitalize' }}>
          {status}
        </Tag>
            {isBlocked && (
              <Tag color="red">
                Blocked until {blockedUntil?.toLocaleString('en-US')}
              </Tag>
            )}
          </Space>
        );
      },
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Banned', value: 'banned' },
        { text: 'Restricted', value: 'restricted' },
        { text: 'Suspended', value: 'suspended' },
        { text: 'Inactive', value: 'inactive' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Proxy',
      key: 'proxy',
      render: (_, record) => (
        <Tag color={record.requires_proxy ? 'orange' : 'default'}>
          {record.requires_proxy ? (
            <>
              <SafetyOutlined /> Required
            </>
          ) : (
            'Not required'
          )}
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
                description="Are you sure you want to unblock this account?"
                onConfirm={() => handleUnblock(record.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button type="primary" icon={<UnlockOutlined />}>
                  Unblock
                </Button>
              </Popconfirm>
            )}
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedAccount(record);
              setEditModalVisible(true);
            }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete account?"
            description="Are you sure you want to delete this account?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
        );
      },
    },
  ];

  if (loading && !accounts.length) {
    return <Loading />;
  }

  if (error && !accounts.length) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>Social Accounts</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
          size="large"
        >
          Add Account
        </Button>
      </div>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="Total Accounts" value={stats.total} prefix={<UserOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Active"
                value={stats.active}
                styles={{ content: { color: '#3f8600' } }}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Banned"
                value={stats.banned}
                styles={{ content: { color: '#cf1322' } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="With Proxy"
                value={stats.withProxy}
                styles={{ content: { color: '#fa8c16' } }}
                prefix={<SafetyOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

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
            placeholder="Filter by status"
            style={{ width: 200 }}
            allowClear
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            <Option value="active">Active</Option>
            <Option value="banned">Banned</Option>
            <Option value="restricted">Restricted</Option>
            <Option value="suspended">Suspended</Option>
            <Option value="inactive">Inactive</Option>
          </Select>

          <Select
            placeholder="Proxy"
            style={{ width: 200 }}
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
        columns={columns}
        dataSource={accounts}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        onRow={(record) => ({
          onClick: () => handleViewDetails(record),
          style: { cursor: 'pointer' },
        })}
      />

      <CreateAccountModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          fetchAccounts(pagination.current);
        }}
      />

      {selectedAccount && (
        <EditAccountModal
          visible={editModalVisible}
          account={selectedAccount}
          onCancel={() => {
            setEditModalVisible(false);
            setSelectedAccount(null);
          }}
          onSuccess={() => {
            setEditModalVisible(false);
            setSelectedAccount(null);
            fetchAccounts(pagination.current);
          }}
        />
      )}

      {detailsAccount && (
        <AccountDetailsDrawer
          visible={detailsDrawerVisible}
          account={detailsAccount}
          onClose={() => {
            setDetailsDrawerVisible(false);
            setDetailsAccount(null);
          }}
          onRefresh={() => {
            fetchAccounts(pagination.current);
            if (detailsAccount) {
              // Update account details
              const token = tokenStorage.get();
              if (token) {
                const backendClient = createBackendClient(token);
                backendClient.getSocialAccount(detailsAccount.id).then((account) => {
                  setDetailsAccount(account);
                });
              }
            }
          }}
        />
      )}
    </div>
  );
}

