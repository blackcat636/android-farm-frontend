'use client';

import { useState, useEffect } from 'react';
import { Table, Tag, Select, Card, Statistic, Row, Col, Button, Popconfirm, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { DeleteOutlined, ReloadOutlined, RedoOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage, type Task } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';
import { message } from 'antd';
import { maskEmail } from '@/utils/maskEmail';

export default function QueuePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: ['pending', 'processing'] as string[], // По замовчуванню показуємо pending і processing
    platform: undefined as string | undefined,
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  });

  const fetchTasks = async (page = 1) => {
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
      const response = await backendClient.getQueue({
        status: filters.status && filters.status.length > 0 ? filters.status.join(',') : undefined,
        platform: filters.platform,
        page,
        limit: pagination.pageSize,
      });

      setTasks(response.data || []);
      setPagination({
        current: response.page || page,
        pageSize: response.limit || pagination.pageSize,
        total: response.total || 0,
      });
      // Оновлюємо статистику з відповіді сервера
      if (response.stats) {
        setStats(response.stats);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading queue');
      message.error(err.message || 'Error loading queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTasks(pagination.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, JSON.stringify(filters.status), filters.platform]);

  const handleCancel = async (taskId: string) => {
    try {
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      await backendClient.cancelTask(taskId);
      message.success('Task cancelled');
      fetchTasks(pagination.current);
    } catch (err: any) {
      message.error(err.message || 'Error cancelling task');
    }
  };

  const handleRetry = async (taskId: string) => {
    try {
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      await backendClient.retryTask(taskId);
      message.success('Task retried');
      fetchTasks(pagination.current);
    } catch (err: any) {
      message.error(err.message || 'Error retrying task');
    }
  };

  const handleTableChange = (newPagination: any) => {
    fetchTasks(newPagination.current);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'orange',
      assigned: 'blue',
      processing: 'cyan',
      completed: 'green',
      failed: 'red',
      cancelled: 'default',
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Pending',
      assigned: 'Assigned',
      processing: 'Processing',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  const columns: ColumnsType<Task> = [
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
    },
    {
      title: 'Account',
      dataIndex: 'account',
      key: 'account',
      render: (account, record) => {
        if (account) {
          return (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                router.push('/accounts');
              }}
              style={{ color: '#1890ff' }}
            >
              <Tag color="purple">
                {account.username} {account.email && `(${maskEmail(account.email)})`}
              </Tag>
            </a>
          );
        }
        return <Tag color="gray">-</Tag>;
      },
    },
    {
      title: 'Emulator',
      dataIndex: 'emulator_id',
      key: 'emulator_id',
      render: (text, record) => {
        if (record.assigned_emulator_id) {
          return <Tag>{record.assigned_emulator_id}</Tag>;
        }
        if (text) {
          return <Tag>{text}</Tag>;
        }
        if (record.emulator_type) {
          return <Tag color="purple">Type: {record.emulator_type}</Tag>;
        }
        return <Tag color="gray">Any</Tag>;
      },
    },
    {
      title: 'Agent',
      dataIndex: 'assigned_agent_id',
      key: 'assigned_agent_id',
      render: (text) => text ? <Tag>{text}</Tag> : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => priority || 0,
    },
    {
      title: 'Duration',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      render: (ms) => ms ? `${(ms / 1000).toFixed(2)}с` : '-',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      defaultSortOrder: 'descend' as const,
      render: (text) => new Date(text).toLocaleString('en-US'),
    },
    {
      title: 'Completed',
      dataIndex: 'completed_at',
      key: 'completed_at',
      render: (text) => text ? new Date(text).toLocaleString('en-US') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Task) => (
        <Space>
          {['pending', 'assigned', 'processing'].includes(record.status) && (
            <Popconfirm
              title="Cancel task?"
              onConfirm={() => handleCancel(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
              >
                Cancel
              </Button>
            </Popconfirm>
          )}
          {record.status === 'failed' && (
            <Popconfirm
              title="Retry task?"
              onConfirm={() => handleRetry(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="text"
                icon={<RedoOutlined />}
                size="small"
              >
                Retry
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // Статистика тепер приходить з сервера і зберігається в стані

  if (loading && !tasks.length) {
    return <Loading />;
  }

  if (error && !tasks.length) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Task Queue</h1>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => fetchTasks(pagination.current)}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Всього" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pending"
              value={stats.pending}
              styles={{ content: { color: '#faad14' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Processing"
              value={stats.processing}
              styles={{ content: { color: '#1890ff' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Completed"
              value={stats.completed}
              styles={{ content: { color: '#3f8600' } }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Select
            mode="multiple"
            placeholder="Filter by status"
            style={{ width: 250 }}
            allowClear
            value={filters.status}
            onChange={(value) => {
              // Якщо вибрано "all", показуємо всі (порожній масив)
              const newStatus = value && value.length > 0 ? value : [];
              setFilters({ ...filters, status: newStatus });
              setPagination({ ...pagination, current: 1 });
            }}
            maxTagCount="responsive"
          >
            <Select.Option value="pending">Pending</Select.Option>
            <Select.Option value="assigned">Assigned</Select.Option>
            <Select.Option value="processing">Processing</Select.Option>
            <Select.Option value="completed">Completed</Select.Option>
            <Select.Option value="failed">Failed</Select.Option>
            <Select.Option value="cancelled">Cancelled</Select.Option>
          </Select>

          <Select
            placeholder="Filter by platform"
            style={{ width: 200 }}
            allowClear
            value={filters.platform}
            onChange={(value) => {
              setFilters({ ...filters, platform: value });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            {/* Опції можна заповнити динамічно, отримуючи список платформ */}
            <Select.Option value="youtube">YouTube</Select.Option>
            <Select.Option value="instagram">Instagram</Select.Option>
          </Select>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} tasks`,
        }}
        onChange={handleTableChange}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ margin: 0 }}>
              <p><strong>Task ID:</strong> {record.id}</p>
              {record.account_id && (
                <p><strong>Account ID:</strong> {record.account_id}</p>
              )}
              {record.proxy_id && (
                <p><strong>Proxy ID:</strong> {record.proxy_id}</p>
              )}
              {record.params && (
                <div>
                  <p><strong>Parameters:</strong></p>
                  <pre>{JSON.stringify(record.params, null, 2)}</pre>
                </div>
              )}
              {record.error_message && (
                <p style={{ color: 'red' }}><strong>Error:</strong> {record.error_message}</p>
              )}
              {record.result && (
                <div>
                  <p><strong>Result:</strong></p>
                  <pre>{JSON.stringify(record.result, null, 2)}</pre>
                  {record.result.screenshot_url && (
                    <div style={{ marginTop: 16 }}>
                      <p><strong>Screenshot:</strong></p>
                      <img
                        src={record.result.screenshot_url}
                        alt="Task screenshot"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '400px',
                          border: '1px solid #d9d9d9',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                        onClick={() => window.open(record.result.screenshot_url, '_blank')}
                        onError={(e) => {
                          console.error('Failed to load screenshot:', record.result.screenshot_url);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <p style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                        <a href={record.result.screenshot_url} target="_blank" rel="noopener noreferrer">
                          Open in new tab
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              )}
              <p><strong>Created:</strong> {new Date(record.created_at).toLocaleString('en-US')}</p>
              {record.assigned_at && (
                <p><strong>Assigned:</strong> {new Date(record.assigned_at).toLocaleString('en-US')}</p>
              )}
              {record.started_at && (
                <p><strong>Started:</strong> {new Date(record.started_at).toLocaleString('en-US')}</p>
              )}
              {record.completed_at && (
                <p><strong>Completed:</strong> {new Date(record.completed_at).toLocaleString('en-US')}</p>
              )}
            </div>
          ),
        }}
      />
    </div>
  );
}

