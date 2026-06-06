'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Select, Card, Statistic, Row, Col, Button, Popconfirm, Space, Modal, Form, Input, Drawer, Collapse, InputNumber } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { DeleteOutlined, ReloadOutlined, RedoOutlined, StopOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import {
  createBackendClient,
  tokenStorage,
  type Task,
  type BrowserProfileRecord,
  type BrowserCatalogResponse,
  type BrowserCatalogScenario,
  type BrowserExecutionChunk,
  type Agent,
  type TaskPrompt,
  type TaskPromptField,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';
import { message } from 'antd';
import { maskEmail } from '@/utils/maskEmail';
import BrowserScenarioInputForm from '@/components/browser/BrowserScenarioInputForm';

const BROWSER_AGENT_PLATFORMS = ['reddit','youtube','generic','news-portal','twitter','instagram','tiktok'];

const PROMPT_DISPLAY_TYPES = new Set(['image', 'qrcode']);
const isPromptDisplayField = (t?: string) => !!t && PROMPT_DISPLAY_TYPES.has(t);

function PromptQrImage({ value }: { value: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    import('qrcode')
      .then((QR) => QR.toDataURL(value, { width: 220, margin: 1 }))
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => {});
    return () => { alive = false; };
  }, [value]);
  return src
    ? <img src={src} width={220} height={220} alt="QR code" style={{ borderRadius: 4 }} />
    : <span style={{ color: '#888', fontSize: 12 }}>Generating QR…</span>;
}

function PromptDisplayField({ field }: { field: TaskPromptField }) {
  const content = field.content || '';
  const imgSrc = content.startsWith('data:') ? content : `data:image/png;base64,${content}`;
  return (
    <div>
      {field.label && <div style={{ marginBottom: 4, fontSize: 13 }}>{field.label}</div>}
      {field.type === 'image' && content ? (
        <img src={imgSrc} alt={field.label || 'image'} style={{ maxWidth: '100%', borderRadius: 8 }} />
      ) : field.type === 'qrcode' && content ? (
        <PromptQrImage value={content} />
      ) : (
        <span style={{ color: '#888', fontSize: 12 }}>No content</span>
      )}
    </div>
  );
}

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
  const [browserProfiles, setBrowserProfiles] = useState<BrowserProfileRecord[]>([]);
  const [browserAgents, setBrowserAgents] = useState<Agent[]>([]);
  const [browserCatalog, setBrowserCatalog] = useState<BrowserCatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [addingBrowserTask, setAddingBrowserTask] = useState(false);
  const selectedPlatform = Form.useWatch('platform', browserForm);
  const selectedAgentId = Form.useWatch('agent_id', browserForm);
  const selectedScenarioName = Form.useWatch('scenario', browserForm);

  const selectedScenario: BrowserCatalogScenario | undefined = browserCatalog?.platforms
    .find((p) => p.name === selectedPlatform)
    ?.scenarios.find((s) => s.name === selectedScenarioName);
  const profileRequired = !selectedScenario?.minTier || selectedScenario.minTier !== 'curl';
  const hasDynamicInput = !!(selectedScenario?.input && Object.keys(selectedScenario.input).length > 0);

  // Chunks drawer
  const [chunksDrawerTask, setChunksDrawerTask] = useState<Task | null>(null);
  const [chunks, setChunks] = useState<BrowserExecutionChunk[]>([]);
  const [chunksTotal, setChunksTotal] = useState(0);
  const [chunksItemsTotal, setChunksItemsTotal] = useState(0);
  const [chunksLoading, setChunksLoading] = useState(false);

  // Interactive prompts (bag.prompt)
  const [prompts, setPrompts] = useState<Record<string, TaskPrompt>>({});
  const [promptModal, setPromptModal] = useState<TaskPrompt | null>(null);
  const [promptAnswers, setPromptAnswers] = useState<Record<string, unknown>>({});
  const [promptSubmitting, setPromptSubmitting] = useState(false);

  const getClient = useCallback(() => {
    const token = tokenStorage.get();
    if (!token) throw new Error('No token');
    return createBackendClient(token);
  }, []);

  const loadBrowserProfiles = async () => {
    try {
      const profiles = await getClient().getAdminBrowserProfiles();
      setBrowserProfiles(profiles.filter(p => p.status === 'active'));
    } catch {}
  };

  const loadBrowserAgents = async () => {
    try {
      const agents = await getClient().getAgents(true);
      const browserOnly = agents.filter((a) => a.type === 'browser');
      setBrowserAgents(browserOnly);
      if (browserOnly.length > 0 && !browserForm.getFieldValue('agent_id')) {
        browserForm.setFieldValue('agent_id', browserOnly[0].id);
      }
    } catch {
      setBrowserAgents([]);
    }
  };

  const loadBrowserCatalog = async (agentId: string) => {
    if (!agentId) {
      setBrowserCatalog(null);
      return;
    }
    setCatalogLoading(true);
    try {
      const catalog = await getClient().getBrowserCatalog(agentId, 'admin');
      setBrowserCatalog(catalog);
    } catch {
      setBrowserCatalog(null);
    } finally {
      setCatalogLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAgentId) {
      loadBrowserCatalog(selectedAgentId);
    }
  }, [selectedAgentId]);

  const openBrowserModal = () => {
    setBrowserModalOpen(true);
    loadBrowserProfiles();
    loadBrowserAgents();
  };

  const handleAddBrowserTask = async () => {
    let values: any;
    try { values = await browserForm.validateFields(); } catch { return; }

    // Build input from dynamic fields or JSON
    let input: Record<string, unknown> = {};
    if (hasDynamicInput && values.input_fields) {
      input = values.input_fields;
    } else if (values.params_json) {
      try { input = JSON.parse(values.params_json); } catch {
        message.error('Invalid JSON in params');
        return;
      }
    }

    try {
      setAddingBrowserTask(true);
      await getClient().addTask({
        platform: values.platform,
        action: 'run_scenario',
        browser_profile_id: values.profile_id || undefined,
        params: {
          scenario: values.scenario,
          input,
          ...(values.forceTier ? { forceTier: values.forceTier } : {}),
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

  const openChunksDrawer = async (task: Task) => {
    setChunksDrawerTask(task);
    setChunks([]);
    setChunksLoading(true);
    try {
      const result = await getClient().getQueueTaskChunks(task.id);
      setChunks(result.chunks);
      setChunksTotal(result.total);
      setChunksItemsTotal(result.itemsTotal);
    } catch (err: any) {
      message.error(err.message || 'Failed to load chunks');
    } finally {
      setChunksLoading(false);
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

  // Poll pending interactive prompts → map taskId → prompt
  const loadPrompts = useCallback(async () => {
    if (!user) return;
    try {
      const list = await getClient().getAdminPrompts('pending');
      const map: Record<string, TaskPrompt> = {};
      for (const p of list) map[p.task_id] = p;
      setPrompts(map);
    } catch {
      // silent — prompts are best-effort
    }
  }, [user, getClient]);

  useEffect(() => {
    if (!user) return;
    loadPrompts();
    const t = setInterval(loadPrompts, 5000);
    return () => clearInterval(t);
  }, [user, loadPrompts]);

  const openPromptModal = (prompt: TaskPrompt) => {
    const defaults: Record<string, unknown> = {};
    for (const f of prompt.fields || []) {
      if (f.type === 'confirm') defaults[f.name] = false;
    }
    setPromptAnswers(defaults);
    setPromptModal(prompt);
  };

  const handleSubmitPrompt = async () => {
    if (!promptModal) return;
    const missing = (promptModal.fields || [])
      .filter((f) => !isPromptDisplayField(f.type) && f.required && (promptAnswers[f.name] == null || promptAnswers[f.name] === ''))
      .map((f) => f.name);
    if (missing.length) {
      message.warning(`Fill required fields: ${missing.join(', ')}`);
      return;
    }
    setPromptSubmitting(true);
    try {
      await getClient().answerPromptAdmin(promptModal.task_id, promptAnswers);
      message.success('Answer submitted — scenario resumed');
      setPromptModal(null);
      setPromptAnswers({});
      await loadPrompts();
      await fetchTasks(pagination.current);
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || 'Failed to submit answer');
    } finally {
      setPromptSubmitting(false);
    }
  };

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
      in_progress: 'cyan',
      waiting_input: 'gold',
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
      in_progress: 'In progress',
      waiting_input: 'Waiting input',
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
          {record.status === 'waiting_input' && prompts[record.id] && (
            <Button
              type="primary"
              size="small"
              onClick={() => openPromptModal(prompts[record.id])}
              style={{ fontWeight: 600, backgroundColor: '#faad14', borderColor: '#faad14' }}
            >
              Answer
            </Button>
          )}
          {record.action === 'run_scenario' && BROWSER_AGENT_PLATFORMS.includes(record.platform) && (
            <Button
              type="text"
              icon={<UnorderedListOutlined />}
              size="small"
              onClick={() => openChunksDrawer(record)}
              title="View execution chunks"
            >
              Chunks
            </Button>
          )}
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
            onClick={openBrowserModal}
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
              {record.browser_profile_id && (
                <p><strong>Browser Profile ID:</strong> {record.browser_profile_id}</p>
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
        width={560}
        destroyOnHidden
      >
        <Form form={browserForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="agent_id" label="Browser agent" rules={[{ required: true }]}>
            <Select
              placeholder="Select browser agent"
              options={browserAgents.map((a) => ({
                value: a.id,
                label: a.name || a.id,
              }))}
              onChange={() => {
                browserForm.setFieldsValue({ platform: undefined, scenario: undefined, input_fields: undefined });
              }}
            />
          </Form.Item>
          <Form.Item name="platform" label="Platform" rules={[{ required: true }]}>
            <Select
              loading={catalogLoading}
              placeholder="Select platform"
              onChange={() => browserForm.setFieldsValue({ scenario: undefined, input_fields: undefined })}
              options={(browserCatalog?.platforms || []).map((p) => ({
                value: p.name,
                label: p.label || p.name,
              }))}
              disabled={!selectedAgentId}
            />
          </Form.Item>
          <Form.Item name="scenario" label="Scenario" rules={[{ required: true }]}>
            <Select
              loading={catalogLoading}
              placeholder="Select scenario"
              onChange={() => browserForm.setFieldsValue({ input_fields: undefined })}
              options={
                browserCatalog?.platforms
                  .find((p) => p.name === selectedPlatform)
                  ?.scenarios.map((s) => ({
                    value: s.name,
                    label: s.label || s.name,
                  })) || []
              }
              disabled={!selectedPlatform}
            />
          </Form.Item>
          <Form.Item
            name="profile_id"
            label={profileRequired ? 'Profile' : 'Profile (optional for curl tier)'}
            rules={[{ required: profileRequired, message: 'Profile is required for this scenario' }]}
          >
            <Select
              placeholder={profileRequired ? 'Select browser profile' : 'Optional'}
              allowClear={!profileRequired}
              showSearch
              optionFilterProp="label"
              options={browserProfiles
                .filter(p => !selectedPlatform || p.platforms?.some(pl => pl.platform === selectedPlatform))
                .map(p => {
                  const platformNames = p.platforms?.map(pl => pl.platform).join(', ') || '—';
                  return { value: p.id, label: `${p.name} [${platformNames}]` };
                })}
            />
          </Form.Item>

          {/* Dynamic input fields from catalog schema */}
          {hasDynamicInput && selectedScenario?.input && (
            <BrowserScenarioInputForm
              input={selectedScenario.input}
              namePrefix={['input_fields']}
            />
          )}

          {/* Advanced JSON (always available as fallback) */}
          <Collapse
            ghost
            items={[{
              key: 'advanced',
              label: <span style={{ fontSize: 12, color: '#999' }}>Advanced JSON params</span>,
              children: (
                <Form.Item
                  name="params_json"
                  extra={hasDynamicInput ? 'Overrides dynamic fields above if filled' : 'e.g. {"url":"https://...","max_pages":3}'}
                >
                  <Input.TextArea rows={3} placeholder="{}" style={{ fontFamily: 'monospace', fontSize: 12 }} />
                </Form.Item>
              ),
            }]}
          />

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="forceTier" label="Force tier (optional)">
                <Select
                  allowClear
                  placeholder="auto"
                  options={[
                    { value: 'curl', label: 'curl (fastest)' },
                    { value: 'playwright', label: 'playwright' },
                    { value: 'browser', label: 'browser (full)' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Priority" initialValue={5}>
                <Select options={[{ value: 10, label: '10 — High' }, { value: 5, label: '5 — Normal' }, { value: 1, label: '1 — Low' }]} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Chunks Drawer */}
      <Drawer
        title={
          <Space>
            <UnorderedListOutlined />
            <span>Execution chunks</span>
            {chunksDrawerTask && (
              <Tag color="blue">{chunksDrawerTask.platform}/{chunksDrawerTask.params?.scenario}</Tag>
            )}
            {chunksItemsTotal > 0 && <Tag color="green">{chunksItemsTotal} items</Tag>}
          </Space>
        }
        open={!!chunksDrawerTask}
        onClose={() => setChunksDrawerTask(null)}
        width={700}
        extra={
          chunksDrawerTask && (
            <Button size="small" icon={<ReloadOutlined />} onClick={() => openChunksDrawer(chunksDrawerTask)}>
              Refresh
            </Button>
          )
        }
      >
        <Table
          loading={chunksLoading}
          dataSource={chunks}
          rowKey="seq"
          size="small"
          pagination={{ pageSize: 50, showTotal: (t) => `${t} chunks` }}
          columns={[
            { title: '#', dataIndex: 'seq', key: 'seq', width: 50 },
            {
              title: 'Type',
              dataIndex: 'chunkType',
              key: 'chunkType',
              width: 160,
              render: (v) => {
                const color = v === 'discovered_items' ? 'blue' : v === 'done' ? 'green' : v === 'error' ? 'red' : 'default';
                return <Tag color={color}>{v}</Tag>;
              },
            },
            {
              title: 'Items',
              key: 'items',
              width: 70,
              render: (_, row) => {
                const items = (row.data as any)?.items;
                return Array.isArray(items) ? items.length : '—';
              },
            },
            {
              title: 'Page',
              key: 'page',
              width: 70,
              render: (_, row) => (row.data as any)?.page ?? '—',
            },
            {
              title: 'Engine',
              key: 'engine',
              width: 100,
              render: (_, row) => (row.data as any)?.engineUsed ?? '—',
            },
            {
              title: 'Time',
              dataIndex: 'createdAt',
              key: 'createdAt',
              render: (v) => v ? new Date(v).toLocaleTimeString() : '—',
            },
          ]}
          expandable={{
            rowExpandable: (row) => {
              const items = (row.data as any)?.items;
              return Array.isArray(items) && items.length > 0;
            },
            expandedRowRender: (row) => {
              const items = (row.data as any)?.items || [];
              return (
                <Table
                  dataSource={items}
                  rowKey={(item: any) => item.externalId || item.url || Math.random().toString()}
                  size="small"
                  pagination={{ pageSize: 20 }}
                  columns={[
                    { title: 'Title', dataIndex: 'title', key: 'title', ellipsis: true },
                    {
                      title: 'URL',
                      dataIndex: 'url',
                      key: 'url',
                      ellipsis: true,
                      render: (v) => v ? <a href={v} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>{v}</a> : '—',
                    },
                    { title: 'Type', dataIndex: 'outputType', key: 'outputType', width: 100 },
                    { title: 'Published', dataIndex: 'publishedAt', key: 'publishedAt', width: 120, render: (v) => v ? new Date(v).toLocaleDateString() : '—' },
                  ]}
                />
              );
            },
          }}
        />
      </Drawer>

      {/* Interactive prompt answer modal */}
      <Modal
        title={promptModal?.title || 'Scenario question'}
        open={!!promptModal}
        onOk={handleSubmitPrompt}
        onCancel={() => { setPromptModal(null); setPromptAnswers({}); }}
        confirmLoading={promptSubmitting}
        okText="Submit"
        destroyOnClose
      >
        {promptModal && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Tag color="gold">task {promptModal.task_id.slice(0, 8)}…</Tag>
            {(promptModal.fields || []).map((field) => (
              isPromptDisplayField(field.type) ? (
                <PromptDisplayField key={field.name} field={field} />
              ) : (
              <div key={field.name}>
                <div style={{ marginBottom: 4, fontSize: 13 }}>
                  {field.label || field.name}
                  {field.required && <span style={{ color: '#ff4d4f' }}> *</span>}
                </div>
                {field.hint && (
                  <div style={{ marginBottom: 6, fontSize: 12, wordBreak: 'break-all' }}>
                    {field.hint.startsWith('http')
                      ? <a href={field.hint} target="_blank" rel="noreferrer">{field.hint}</a>
                      : <span style={{ color: '#888' }}>{field.hint}</span>}
                  </div>
                )}
                {field.type === 'confirm' ? (
                  <Select
                    style={{ width: '100%' }}
                    value={promptAnswers[field.name] as boolean}
                    onChange={(v) => setPromptAnswers((prev) => ({ ...prev, [field.name]: v }))}
                    options={[{ value: true, label: 'Yes / Confirmed' }, { value: false, label: 'No' }]}
                  />
                ) : field.type === 'choice' && field.choices ? (
                  <Select
                    style={{ width: '100%' }}
                    value={promptAnswers[field.name] as string}
                    onChange={(v) => setPromptAnswers((prev) => ({ ...prev, [field.name]: v }))}
                    options={field.choices.map((c) => ({ value: c, label: c }))}
                  />
                ) : field.type === 'number' ? (
                  <InputNumber
                    style={{ width: '100%' }}
                    value={promptAnswers[field.name] as number}
                    onChange={(v) => setPromptAnswers((prev) => ({ ...prev, [field.name]: v }))}
                  />
                ) : field.type === 'textarea' ? (
                  <Input.TextArea
                    rows={3}
                    value={promptAnswers[field.name] as string}
                    onChange={(e) => setPromptAnswers((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  />
                ) : (
                  <Input
                    value={promptAnswers[field.name] as string}
                    onChange={(e) => setPromptAnswers((prev) => ({ ...prev, [field.name]: e.target.value }))}
                    placeholder={field.name}
                  />
                )}
              </div>
              )
            ))}
          </Space>
        )}
      </Modal>
    </div>
  );
}

