'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Select, Card, Statistic, Row, Col, Button, Popconfirm, Space, Modal, Form, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { DeleteOutlined, ReloadOutlined, RedoOutlined, StopOutlined, PlusOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage, type Task, type BrowserAccount } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';
import { message } from 'antd';
import { maskEmail } from '@/utils/maskEmail';

const BROWSER_SCENARIOS: Record<string, { value: string; label: string }[]> = {
  instagram: [
    { value: 'check_auth',  label: 'Check Auth' },
    { value: 'browse_feed', label: 'Browse Feed' },
    { value: 'like_post',   label: 'Like Post' },
  ],
  youtube: [
    { value: 'watch_and_like', label: 'Watch & Like' },
  ],
};

export default function QueuePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{
    status: string[];
    platform: string | undefined;
    action: string | undefined;
  }>({
    status: [],
    platform: undefined,
    action: undefined,
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

  // Browser task modal
  const [browserModalOpen, setBrowserModalOpen] = useState(false);
  const [browserForm] = Form.useForm();
  const [browserAccounts, setBrowserAccounts] = useState<BrowserAccount[]>([]);
  const [addingBrowserTask, setAddingBrowserTask] = useState(false);
  const selectedPlatform = Form.useWatch('platform', browserForm);

  const getClient = useCallback(() => {
    const token = tokenStorage.get();
    if (!token) throw new Error('No token');
    return createBackendClient(token);
  }, []);

  const loadBrowserAccounts = async () => {
    try {
      const accounts = await getClient().getAdminBrowserAccounts({ status: 'active' });
      setBrowserAccounts(accounts);
    } catch {}
  };

  const handleAddBrowserTask = async () => {
    let values: any;
    try { values = await browserForm.validateFields(); } catch { return; }
    let scenarioParams: any = {};
    if (values.params_json) {
      try { scenarioParams = JSON.parse(values.params_json); } catch {
        message.error('Invalid JSON in params');
        return;
      }
    }
    try {
      setAddingBrowserTask(true);
      await getClient().addTask({
        platform: values.platform,
        action: 'run_scenario',
        browser_account_id: values.account_id,
        params: {
          scenario: values.scenario,
          ...scenarioParams,
        },
        priority: values.priority ?? 5,
      });
      message.success('Browser task added to queue');
      setBrowserModalOpen(false);
      browserForm.resetFields();
      fetchTasks();
    } catch (err: any) {
      message.error(err.message || 'Failed to add task');
    } finally {
      setAddingBrowserTask(false);
    }
  };

  const fetchTasks = async (
    page = 1,
    overrides?: { status?: string[]; platform?: string; action?: string; limit?: number },
  ) => {
    if (!user) {
      setLoading(false);
      return;
    }

    const effFilters = overrides
      ? {
          status: overrides.status ?? filters.status,
          platform: overrides.platform ?? filters.platform,
          action: overrides.action !== undefined ? overrides.action : filters.action,
        }
      : filters;
    const effStatus = effFilters.status?.length ? effFilters.status.join(',') : undefined;
    const effLimit = overrides?.limit ?? pagination.pageSize;

    try {
      setLoading(true);
      setError(null);
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      const response = await backendClient.getQueue({
        status: effStatus,
        platform: effFilters.platform,
        action: effFilters.action,
        page,
        limit: effLimit,
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
  }, [user, JSON.stringify(filters.status), filters.platform, filters.action]);

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

  const handleAddToBlacklist = async (taskId: string) => {
    try {
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      await backendClient.addTaskToBlacklist(taskId, `Auto-blacklisted from failed task ${taskId}`);
      message.success('Task added to blacklist');
      fetchTasks(pagination.current);
    } catch (err: any) {
      message.error(err.message || 'Error adding task to blacklist');
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
      title: 'Country',
      dataIndex: ['country_name', 'country_code'],
      key: 'country',
      render: (_: unknown, record: Task) => record.country_name || record.country_code || '-',
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
      title: 'Batch',
      dataIndex: 'batchable',
      key: 'batchable',
      render: (batchable, record) => {
        if (record.batch_id) return <Tag color="geekblue">batch</Tag>;
        if (batchable) return <Tag color="cyan">batchable</Tag>;
        return null;
      },
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
                className="cancel-button"
                type="primary"
                danger
                icon={<DeleteOutlined />}
                size="small"
                style={{
                  fontWeight: 600,
                  backgroundColor: '#ff4d4f',
                  borderColor: '#ff4d4f',
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(255, 77, 79, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff7875';
                  e.currentTarget.style.borderColor = '#ff7875';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 77, 79, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff4d4f';
                  e.currentTarget.style.borderColor = '#ff4d4f';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(255, 77, 79, 0.3)';
                }}
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
          <Popconfirm
            title="Add task to blacklist?"
            description="This will prevent similar tasks from being created in the future."
            onConfirm={() => handleAddToBlacklist(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              className="blacklist-button"
              icon={<StopOutlined />}
              size="small"
              style={{
                fontWeight: 600,
                backgroundColor: '#000000',
                borderColor: '#000000',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#262626';
                e.currentTarget.style.borderColor = '#262626';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#000000';
                e.currentTarget.style.borderColor = '#000000';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
              }}
            >
              Blacklist
            </Button>
          </Popconfirm>
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
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { loadBrowserAccounts(); setBrowserModalOpen(true); }}
          >
            Browser Task
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchTasks(pagination.current)}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
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
          <Button
            type={filters.status.length === 2 && filters.status.includes('pending') && filters.status.includes('processing') ? 'primary' : 'default'}
            onClick={() => {
              const newFilters = { ...filters, status: ['pending', 'processing'] };
              setFilters(newFilters);
              setPagination((p) => ({ ...p, current: 1, pageSize: 20 }));
              fetchTasks(1, { status: ['pending', 'processing'], limit: 20 });
            }}
          >
            Актуальні
          </Button>
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
            <Select.Option value="youtube">YouTube</Select.Option>
            <Select.Option value="instagram">Instagram</Select.Option>
            <Select.Option value="tiktok">TikTok</Select.Option>
          </Select>

          <Select
            placeholder="Filter by action"
            style={{ width: 180 }}
            allowClear
            value={filters.action}
            onChange={(value) => {
              setFilters({ ...filters, action: value });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Select.Option value="warmup">warmup</Select.Option>
            <Select.Option value="view">view</Select.Option>
            <Select.Option value="like">like</Select.Option>
            <Select.Option value="viewAndLike">viewAndLike</Select.Option>
            <Select.Option value="post">post</Select.Option>
            <Select.Option value="delete">delete</Select.Option>
            <Select.Option value="login">login</Select.Option>
            <Select.Option value="auth">auth</Select.Option>
            <Select.Option value="search">search</Select.Option>
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
              {record.batch_id && (
                <p><strong>Batch ID:</strong> <Tag color="geekblue">{record.batch_id}</Tag></p>
              )}
              {record.account_id && (
                <p><strong>Account ID:</strong> {record.account_id}</p>
              )}
              {(record.country_code || record.country_name) && (
                <p><strong>Country:</strong> {record.country_name || record.country_code}</p>
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

      {/* Browser Task Modal */}
      <Modal
        title={<Space><PlusOutlined /><span>Add Browser Task</span></Space>}
        open={browserModalOpen}
        onCancel={() => { setBrowserModalOpen(false); browserForm.resetFields(); }}
        onOk={handleAddBrowserTask}
        confirmLoading={addingBrowserTask}
        okText="Add to Queue"
        width={500}
        destroyOnHidden
      >
        <Form form={browserForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="platform" label="Platform" rules={[{ required: true }]}>
            <Select
              placeholder="Select platform"
              onChange={() => browserForm.setFieldValue('scenario', undefined)}
              options={[
                { value: 'instagram', label: 'Instagram' },
                { value: 'youtube',   label: 'YouTube' },
              ]}
            />
          </Form.Item>
          <Form.Item name="account_id" label="Account" rules={[{ required: true }]}>
            <Select
              placeholder="Select browser account"
              showSearch
              optionFilterProp="label"
              options={browserAccounts
                .filter(a => !selectedPlatform || a.platform === selectedPlatform)
                .map(a => ({
                  value: a.id,
                  label: `${a.platform} / ${a.username}`,
                }))}
            />
          </Form.Item>
          <Form.Item name="scenario" label="Scenario" rules={[{ required: true }]}>
            <Select
              placeholder="Select scenario"
              options={BROWSER_SCENARIOS[selectedPlatform] || []}
              disabled={!selectedPlatform}
            />
          </Form.Item>
          <Form.Item name="params_json" label="Params (JSON, optional)" extra='e.g. {"url":"https://youtu.be/...","watchSeconds":30}'>
            <Input.TextArea rows={3} placeholder="{}" style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </Form.Item>
          <Form.Item name="priority" label="Priority" initialValue={5}>
            <Select options={[{ value: 10, label: '10 — High' }, { value: 5, label: '5 — Normal' }, { value: 1, label: '1 — Low' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

