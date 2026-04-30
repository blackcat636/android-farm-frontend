'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Tabs,
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Typography,
  Divider,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Popconfirm,
  List,
  Badge,
} from 'antd';
import {
  ArrowLeftOutlined,
  SafetyOutlined,
  LinkOutlined,
  PlusOutlined,
  UnlockOutlined,
  DisconnectOutlined,
  ExportOutlined,
  CommentOutlined,
  SendOutlined,
  FireOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import {
  createBackendClient,
  tokenStorage,
  type SocialAccount,
  type AccountProxy,
  type AccountEmulatorBinding,
  type CreateProxyDto,
  type UpdateSocialAccountDto,
  type ProxyProvider,
  type AccountComment,
} from '@/lib/api/backend';
import type { BackendEmulator } from '@/lib/api/backend';
import { CountrySelect } from '@/components/common/CountrySelect';
import { maskEmail } from '@/utils/maskEmail';
import { formatEmulatorLabel } from '@/utils/emulatorDisplay';
import { useAllEmulators } from '@/hooks/useAllEmulators';
import Loading from '@/components/common/Loading';

const { Option } = Select;
const { Title, Text } = Typography;
const { TextArea } = Input;

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [account, setAccount] = useState<SocialAccount | null>(null);
  const [proxy, setProxy] = useState<AccountProxy | null>(null);
  const [binding, setBinding] = useState<AccountEmulatorBinding | null>(null);
  const [emulatorDetails, setEmulatorDetails] = useState<BackendEmulator | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [proxyLoading, setProxyLoading] = useState(false);
  const [bindingLoading, setBindingLoading] = useState(false);

  const [proxyModalVisible, setProxyModalVisible] = useState(false);
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [bindingVerificationInProgress, setBindingVerificationInProgress] = useState(false);
  const [occupiedEmulatorIds, setOccupiedEmulatorIds] = useState<string[]>([]);
  const [loadingOccupied, setLoadingOccupied] = useState(false);

  const [proxyProviders, setProxyProviders] = useState<ProxyProvider[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [warmupLoading, setWarmupLoading] = useState(false);

  const [comments, setComments] = useState<AccountComment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [proxyForm] = Form.useForm();
  const [bindForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const { emulators, loading: loadingEmulators } = useAllEmulators(false, false, true);

  const activeTab = searchParams.get('tab') || 'details';

  useEffect(() => {
    fetchAll();
  }, [id]);

  useEffect(() => {
    if (!binding?.emulator_id || binding.emulator) return;
    const token = tokenStorage.get();
    if (!token) return;
    createBackendClient(token)
      .getEmulator(binding.emulator_id)
      .then(setEmulatorDetails)
      .catch(() => setEmulatorDetails(null));
  }, [binding?.emulator_id, binding?.emulator]);

  useEffect(() => {
    if (activeTab === 'comments') fetchComments();
  }, [activeTab, id]);

  useEffect(() => {
    if (!bindModalVisible || !account) return;
    const token = tokenStorage.get();
    if (!token) return;
    setLoadingOccupied(true);
    createBackendClient(token)
      .getOccupiedEmulatorsByPlatform(account.platform)
      .then((r) => setOccupiedEmulatorIds(r.emulator_ids || []))
      .catch(() => setOccupiedEmulatorIds([]))
      .finally(() => setLoadingOccupied(false));
  }, [bindModalVisible, account?.platform]);

  useEffect(() => {
    if (account) {
      const token = tokenStorage.get();
      if (token) {
        createBackendClient(token)
          .getProxyProviders()
          .then(setProxyProviders)
          .catch(() => setProxyProviders([]));
      }
      editForm.setFieldsValue({
        platform: account.platform,
        username: account.username,
        email: account.email,
        phone: account.phone,
        two_factor_secret: '',
        country_code: account.country_code || undefined,
        requires_proxy: account.requires_proxy,
        proxy_required_reason: account.proxy_required_reason,
        proxy_source: account.proxy_source || 'account',
        proxy_provider_id: account.proxy_provider_id || undefined,
        proxy_type: account.proxy_type || undefined,
        status: account.status,
        account_status_reason: account.account_status_reason,
      });
    }
  }, [account]);

  const fetchAll = async () => {
    const token = tokenStorage.get();
    if (!token) return;
    try {
      setPageLoading(true);
      const client = createBackendClient(token);
      const [acc, prx, bnd] = await Promise.all([
        client.getSocialAccount(id),
        client.getProxyForAccount(id).catch(() => null),
        client.getBindingForAccount(id).catch(() => null),
      ]);
      setAccount(acc);
      setProxy(prx);
      setBinding(bnd);
      setEmulatorDetails(null);
    } catch (err: any) {
      message.error(err.message || 'Error loading account');
    } finally {
      setPageLoading(false);
    }
  };

  const fetchComments = async (page = 1) => {
    const token = tokenStorage.get();
    if (!token) return;
    setCommentsLoading(true);
    try {
      const res = await createBackendClient(token).getComments(id, { page, limit: 50 });
      setComments(res.data);
      setCommentsTotal(res.total);
    } catch {
      message.error('Failed to load comments');
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    const token = tokenStorage.get();
    if (!token) return;
    setCommentSubmitting(true);
    try {
      await createBackendClient(token).addComment(id, { source: 'admin', text: commentText.trim() });
      setCommentText('');
      fetchComments();
    } catch {
      message.error('Failed to add comment');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const reloadProxy = async () => {
    const token = tokenStorage.get();
    if (!token) return;
    setProxyLoading(true);
    try {
      const prx = await createBackendClient(token).getProxyForAccount(id).catch(() => null);
      setProxy(prx);
    } finally {
      setProxyLoading(false);
    }
  };

  const reloadBinding = async () => {
    const token = tokenStorage.get();
    if (!token) return;
    setBindingLoading(true);
    try {
      const bnd = await createBackendClient(token).getBindingForAccount(id).catch(() => null);
      setBinding(bnd);
      setEmulatorDetails(null);
    } finally {
      setBindingLoading(false);
    }
  };

  const handleUnblock = async () => {
    const token = tokenStorage.get();
    if (!token) return;
    try {
      await createBackendClient(token).unblockSocialAccount(id);
      message.success('Account unblocked');
      fetchAll();
    } catch (err: any) {
      message.error(err.message || 'Error unblocking account');
    }
  };

  const handleSaveEdit = async () => {
    try {
      const values = await editForm.validateFields();
      setEditLoading(true);
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');

      const updateData: UpdateSocialAccountDto = {
        platform: values.platform,
        username: values.username,
        email: values.email || undefined,
        phone: values.phone,
        two_factor_secret: values.two_factor_secret || undefined,
        country_code: values.country_code || null,
        requires_proxy: values.requires_proxy,
        proxy_required_reason: values.proxy_required_reason,
        proxy_source: values.proxy_source || 'account',
        proxy_provider_id: values.proxy_source === 'provider' ? values.proxy_provider_id : null,
        proxy_type: values.proxy_type || null,
        status: values.status,
        account_status_reason: values.account_status_reason,
      };
      if (values.password) updateData.password = values.password;
      if (values.email_password) updateData.email_password = values.email_password;

      await createBackendClient(token).updateSocialAccount(id, updateData);
      message.success('Account updated successfully');
      fetchAll();
    } catch (err: any) {
      message.error(err.message || 'Error updating account');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCreateProxy = async () => {
    try {
      const values = await proxyForm.validateFields();
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const data: CreateProxyDto = {
        account_id: id,
        proxy_host: values.proxy_host,
        proxy_port: values.proxy_port,
        proxy_type: values.proxy_type || 'http',
        proxy_username: values.proxy_username,
        proxy_password: values.proxy_password,
      };
      await createBackendClient(token).createProxy(data);
      message.success('Proxy created successfully');
      setProxyModalVisible(false);
      proxyForm.resetFields();
      reloadProxy();
    } catch (err: any) {
      message.error(err.message || 'Error creating proxy');
    }
  };

  const handleBind = async () => {
    try {
      setBindingVerificationInProgress(true);
      const values = await bindForm.validateFields();
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const verifyLogin = values.verifyLogin !== false;
      const response = await createBackendClient(token).createBinding({
        account_id: id,
        emulator_id: values.emulatorId,
        binding_type: 'permanent',
        verifyLogin,
      });
      if (!('taskId' in response)) {
        message.success('Account bound to emulator successfully');
      } else {
        message.success({
          content: (
            <span>
              Binding verification task created. <Link href="/queue">Go to Queue</Link>
            </span>
          ),
          duration: 6,
        });
      }
      setBindModalVisible(false);
      bindForm.resetFields();
      reloadBinding();
    } catch (err: any) {
      message.error(err.message || 'Error binding account to emulator');
    } finally {
      setBindingVerificationInProgress(false);
    }
  };

  const handleStartWarmup = async () => {
    try {
      setWarmupLoading(true);
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const { message: msg } = await createBackendClient(token).startSocialAccountWarmup(id);
      message.success(msg || 'Warmup started');
      await fetchAll();
    } catch (err: any) {
      message.error(err.message || 'Failed to start warmup');
    } finally {
      setWarmupLoading(false);
    }
  };

  const handleUnbind = async () => {
    if (!binding) return;
    try {
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      await createBackendClient(token).deleteBinding(binding.id);
      message.success('Account successfully unbound from emulator');
      setBinding(null);
      reloadBinding();
    } catch (err: any) {
      message.error(err.message || 'Error unbinding account');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'green',
      banned: 'red',
      restricted: 'orange',
      suspended: 'volcano',
      inactive: 'default',
      view_only: 'blue',
      warming_up: 'purple',
      testing: 'cyan',
    };
    return colors[status] || 'default';
  };

  if (pageLoading) return <Loading />;
  if (!account) return <Text type="danger">Account not found</Text>;

  const isBlocked = account.blocked_until && new Date(account.blocked_until) > new Date();

  const detailsTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>Basic Information</Title>
        {isBlocked && (
          <Popconfirm
            title="Unblock account?"
            description="Are you sure you want to unblock this account?"
            onConfirm={handleUnblock}
            okText="Yes"
            cancelText="No"
          >
            <Button type="primary" icon={<UnlockOutlined />}>Unblock</Button>
          </Popconfirm>
        )}
      </div>
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label="Platform">
          <Tag color="blue" style={{ textTransform: 'capitalize' }}>{account.platform}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Username">{account.username}</Descriptions.Item>
        <Descriptions.Item label="Email">{maskEmail(account.email)}</Descriptions.Item>
        <Descriptions.Item label="Phone">{account.phone || '-'}</Descriptions.Item>
        <Descriptions.Item label="Country">{account.country_name || account.country_code || '-'}</Descriptions.Item>
        <Descriptions.Item label="Status">
          <Space size="small" wrap>
            <Tag color={getStatusColor(account.status)} style={{ textTransform: 'capitalize' }}>
              {account.status}
            </Tag>
            {isBlocked && (
              <Tag color="red">Blocked until {new Date(account.blocked_until!).toLocaleString('en-US')}</Tag>
            )}
            {!['banned', 'suspended'].includes(account.status) &&
              !(isBlocked) && (
                <Popconfirm
                  title="Start warmup?"
                  description="Sets status to warming_up and restarts the warmup timeline from now. Queue tasks depend on WARMUP_ENABLED."
                  onConfirm={handleStartWarmup}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button
                    size="small"
                    type="default"
                    icon={<FireOutlined />}
                    loading={warmupLoading}
                  >
                    Start warmup
                  </Button>
                </Popconfirm>
              )}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Proxy Required">
          <Tag color={account.requires_proxy ? 'orange' : 'default'}>
            {account.requires_proxy ? <><SafetyOutlined /> Yes</> : 'No'}
          </Tag>
        </Descriptions.Item>
        {account.proxy_required_reason && (
          <Descriptions.Item label="Proxy Reason">{account.proxy_required_reason}</Descriptions.Item>
        )}
        {account.account_status_reason && (
          <Descriptions.Item label="Status Reason">{account.account_status_reason}</Descriptions.Item>
        )}
        {account.blocked_until && (
          <Descriptions.Item label="Blocking">
            {isBlocked ? (
              <Tag color="red">Blocked until {new Date(account.blocked_until).toLocaleString('en-US')}</Tag>
            ) : (
              <Tag color="green">Unblocked ({new Date(account.blocked_until).toLocaleString('en-US')})</Tag>
            )}
          </Descriptions.Item>
        )}
      </Descriptions>

      <Divider />
      <Title level={5}>Statistics</Title>
      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="Total Tasks">{account.total_tasks}</Descriptions.Item>
        <Descriptions.Item label="Successful"><Tag color="green">{account.successful_tasks}</Tag></Descriptions.Item>
        <Descriptions.Item label="Failed"><Tag color="red">{account.failed_tasks}</Tag></Descriptions.Item>
        <Descriptions.Item label="Failed Logins">{account.failed_logins}</Descriptions.Item>
        <Descriptions.Item label="Last Activity">
          {account.last_activity ? new Date(account.last_activity).toLocaleString('en-US') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Last Login">
          {account.last_login_at ? new Date(account.last_login_at).toLocaleString('en-US') : '-'}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );

  const editTab = (
    <div style={{ maxWidth: 600 }}>
      <Form form={editForm} layout="vertical">
        <Form.Item name="platform" label="Platform" rules={[{ required: true, message: 'Select platform' }]}>
          <Select placeholder="Select platform">
            <Option value="instagram">Instagram</Option>
            <Option value="youtube">YouTube</Option>
            <Option value="tiktok">TikTok</Option>
            <Option value="facebook">Facebook</Option>
            <Option value="twitter">Twitter</Option>
          </Select>
        </Form.Item>

        <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Enter username' }]}>
          <Input placeholder="username" />
        </Form.Item>

        <Form.Item name="email" label="Email (optional)">
          <Input type="email" placeholder="email@example.com" />
        </Form.Item>

        <Form.Item name="email_password" label="Email password (leave empty to keep unchanged)">
          <Input.Password placeholder="New email password" />
        </Form.Item>

        <Form.Item name="phone" label="Phone">
          <Input placeholder="+380123456789" />
        </Form.Item>

        <Form.Item name="password" label="New Password (leave empty to keep unchanged)">
          <Input.Password placeholder="New password" />
        </Form.Item>

        <Form.Item name="two_factor_secret" label="2FA Secret (optional)">
          <Input placeholder="Two-factor authentication" />
        </Form.Item>

        <Form.Item name="country_code" label="Country">
          <CountrySelect placeholder="Select country (optional)" />
        </Form.Item>

        <Form.Item name="requires_proxy" label="Proxy Required" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(p, c) => p.requires_proxy !== c.requires_proxy}
        >
          {({ getFieldValue }) =>
            getFieldValue('requires_proxy') ? (
              <Form.Item name="proxy_required_reason" label="Proxy Usage Reason">
                <TextArea rows={2} placeholder="For example: to bypass geo-blocking" />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(p, c) => p.requires_proxy !== c.requires_proxy}
        >
          {({ getFieldValue }) =>
            getFieldValue('requires_proxy') ? (
              <>
                <Form.Item name="proxy_source" label="Proxy Source">
                  <Select>
                    <Option value="account">Account (manual proxy)</Option>
                    <Option value="provider">Provider (proxy-service)</Option>
                  </Select>
                </Form.Item>
                <Form.Item noStyle shouldUpdate={(p, c) => p.proxy_source !== c.proxy_source}>
                  {({ getFieldValue: gf }) =>
                    gf('proxy_source') === 'provider' ? (
                      <>
                        <Form.Item name="proxy_provider_id" label="Proxy Provider">
                          <Select placeholder="Select provider">
                            {proxyProviders.map((p) => (
                              <Option key={p.id} value={p.id}>{p.name} ({p.type})</Option>
                            ))}
                          </Select>
                        </Form.Item>
                        <Form.Item name="proxy_type" label="Proxy Type">
                          <Select placeholder="http (default)">
                            <Option value="http">HTTP</Option>
                            <Option value="https">HTTPS</Option>
                          </Select>
                        </Form.Item>
                      </>
                    ) : null
                  }
                </Form.Item>
              </>
            ) : null
          }
        </Form.Item>

        <Form.Item name="status" label="Status">
          <Select>
            <Option value="active">Active</Option>
            <Option value="banned">Banned</Option>
            <Option value="restricted">Restricted</Option>
            <Option value="suspended">Suspended</Option>
            <Option value="inactive">Inactive</Option>
            <Option value="view_only">View Only</Option>
            <Option value="warming_up">Warming Up</Option>
            <Option value="testing">Testing</Option>
          </Select>
        </Form.Item>

        <Form.Item name="account_status_reason" label="Status Change Reason">
          <TextArea rows={2} placeholder="Explain the reason for status change" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleSaveEdit} loading={editLoading}>
              Save
            </Button>
            <Button onClick={() => editForm.resetFields()}>Reset</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );

  const proxyTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>Proxy</Title>
        {!proxy && account.requires_proxy && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setProxyModalVisible(true)} size="small">
            Add Proxy
          </Button>
        )}
      </div>

      {proxy ? (
        <Card size="small">
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Host">{proxy.proxy_host}</Descriptions.Item>
            <Descriptions.Item label="Port">{proxy.proxy_port}</Descriptions.Item>
            <Descriptions.Item label="Type"><Tag>{proxy.proxy_type.toUpperCase()}</Tag></Descriptions.Item>
            {proxy.proxy_username && (
              <Descriptions.Item label="Username">{proxy.proxy_username}</Descriptions.Item>
            )}
            <Descriptions.Item label="Status">
              <Tag color={proxy.status === 'active' ? 'green' : 'red'}>{proxy.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Requests">{proxy.total_requests}</Descriptions.Item>
            <Descriptions.Item label="Failed">{proxy.failed_requests}</Descriptions.Item>
            <Descriptions.Item label="Consecutive Failures">
              <Tag color={proxy.consecutive_failures > 5 ? 'red' : 'default'}>{proxy.consecutive_failures}</Tag>
            </Descriptions.Item>
            {proxy.last_check && (
              <Descriptions.Item label="Last Check">
                {new Date(proxy.last_check).toLocaleString('en-US')}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      ) : account.requires_proxy ? (
        <Text type="warning">Proxy not configured (required for account)</Text>
      ) : (
        <Text type="secondary">Proxy not required for this account</Text>
      )}

      <Modal
        title="Add Proxy"
        open={proxyModalVisible}
        onCancel={() => { setProxyModalVisible(false); proxyForm.resetFields(); }}
        onOk={handleCreateProxy}
        width={500}
      >
        <Form form={proxyForm} layout="vertical">
          <Form.Item name="proxy_host" label="Host" rules={[{ required: true, message: 'Enter proxy host' }]}>
            <Input placeholder="proxy.example.com" />
          </Form.Item>
          <Form.Item name="proxy_port" label="Port" rules={[{ required: true, message: 'Enter proxy port' }]}>
            <InputNumber min={1} max={65535} style={{ width: '100%' }} placeholder="8080" />
          </Form.Item>
          <Form.Item name="proxy_type" label="Proxy Type" initialValue="http" rules={[{ required: true }]}>
            <Select>
              <Option value="http">HTTP</Option>
              <Option value="https">HTTPS</Option>
              <Option value="socks4">SOCKS4</Option>
              <Option value="socks5">SOCKS5</Option>
            </Select>
          </Form.Item>
          <Form.Item name="proxy_username" label="Username (optional)">
            <Input placeholder="username" />
          </Form.Item>
          <Form.Item name="proxy_password" label="Password (optional)">
            <Input.Password placeholder="password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  const emulatorTab = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>
          <LinkOutlined /> Emulator Binding
        </Title>
        {!binding && (
          <Button
            type="primary"
            icon={<LinkOutlined />}
            size="small"
            onClick={() => setBindModalVisible(true)}
            loading={loadingEmulators || bindingLoading}
          >
            Bind to emulator
          </Button>
        )}
        {binding && (
          <Popconfirm
            title="Unbind account from emulator?"
            description="Are you sure you want to unbind this account? This action is irreversible."
            onConfirm={handleUnbind}
            okText="Yes"
            cancelText="No"
          >
            <Button danger icon={<DisconnectOutlined />} size="small">Unbind</Button>
          </Popconfirm>
        )}
      </div>

      {binding ? (
        <Card size="small">
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Emulator">
              <Space>
                <span>{formatEmulatorLabel(binding.emulator ?? emulatorDetails) || binding.emulator_id}</span>
                <Link href={`/emulators/${binding.emulator_id}`}>
                  <Button type="link" size="small" icon={<ExportOutlined />}>Open emulator</Button>
                </Link>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Binding Type"><Tag>{binding.binding_type}</Tag></Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={binding.status === 'active' ? 'green' : 'default'}>{binding.status}</Tag>
            </Descriptions.Item>
            {binding.session_data && (
              <Descriptions.Item label="Session"><Tag color="green">Saved</Tag></Descriptions.Item>
            )}
            {binding.session_expires_at && (
              <Descriptions.Item label="Session Expires">
                {new Date(binding.session_expires_at).toLocaleString('en-US')}
              </Descriptions.Item>
            )}
            {binding.last_used_at && (
              <Descriptions.Item label="Last Used">
                {new Date(binding.last_used_at).toLocaleString('en-US')}
              </Descriptions.Item>
            )}
            {binding.notes && (
              <Descriptions.Item label="Notes">{binding.notes}</Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      ) : (
        <Text type="secondary">Account not bound to emulator</Text>
      )}

      <Modal
        title="Bind account to emulator"
        open={bindModalVisible}
        onCancel={() => {
          if (!bindingVerificationInProgress) {
            setBindModalVisible(false);
            bindForm.resetFields();
          }
        }}
        onOk={handleBind}
        okText="Bind"
        confirmLoading={bindingVerificationInProgress}
        closable={!bindingVerificationInProgress}
        maskClosable={!bindingVerificationInProgress}
        width={500}
      >
        <Form form={bindForm} layout="vertical" initialValues={{ verifyLogin: true }}>
          <Form.Item
            name="emulatorId"
            label="Emulator"
            rules={[{ required: true, message: 'Select emulator' }]}
            help={`Emulators already bound to another ${account.platform} account are disabled.`}
          >
            <Select
              placeholder="Select emulator"
              loading={loadingEmulators || loadingOccupied}
              showSearch
              optionFilterProp="children"
            >
              {emulators.map((emulator) => (
                <Option
                  key={`${emulator.agentId}-${emulator.id}`}
                  value={emulator.id}
                  disabled={occupiedEmulatorIds.includes(emulator.id)}
                >
                  <span>
                    {emulator.name}
                    {emulator.agentName && ` (${emulator.agentName})`}
                    {emulator.status !== 'active' && (
                      <Tag color="orange" style={{ marginLeft: 8 }}>Disabled</Tag>
                    )}
                    {occupiedEmulatorIds.includes(emulator.id) && (
                      <Tag color="red" style={{ marginLeft: 8 }}>In use by {account.platform}</Tag>
                    )}
                  </span>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="verifyLogin"
            label="Verify login on emulator"
            valuePropName="checked"
            help="If enabled, the system will run login on the emulator before creating the binding."
          >
            <Switch checkedChildren="Verify login" unCheckedChildren="Skip (already on device)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  const SOURCE_COLORS: Record<string, string> = { agent: 'blue', admin: 'green', system: 'orange' };

  const commentsTab = (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Input.TextArea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          autoSize={{ minRows: 2, maxRows: 5 }}
          style={{ flex: 1 }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={commentSubmitting}
          onClick={submitComment}
          disabled={!commentText.trim()}
          style={{ alignSelf: 'flex-end' }}
        >
          Add
        </Button>
      </div>
      <List
        loading={commentsLoading}
        dataSource={comments}
        locale={{ emptyText: 'No comments yet' }}
        footer={commentsTotal > comments.length ? (
          <div style={{ textAlign: 'center' }}>
            <Button size="small" onClick={() => fetchComments()}>Load more</Button>
          </div>
        ) : null}
        renderItem={(c) => (
          <List.Item key={c.id} style={{ alignItems: 'flex-start', flexDirection: 'column', padding: '8px 0' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <Tag color={SOURCE_COLORS[c.source] ?? 'default'}>{c.source}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(c.created_at).toLocaleString()}
              </Text>
            </div>
            <Text style={{ whiteSpace: 'pre-wrap' }}>{c.text}</Text>
            {c.metadata && (
              <details style={{ marginTop: 4 }}>
                <summary style={{ fontSize: 11, color: '#888', cursor: 'pointer' }}>metadata</summary>
                <pre style={{ fontSize: 11, margin: 0, color: '#666' }}>{JSON.stringify(c.metadata, null, 2)}</pre>
              </details>
            )}
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/accounts')}>
          Back to Accounts
        </Button>
        <Title level={2} style={{ margin: 0 }}>
          {account.username}
          <Tag
            color="blue"
            style={{ marginLeft: 12, textTransform: 'capitalize', verticalAlign: 'middle', fontSize: 14 }}
          >
            {account.platform}
          </Tag>
          <Tag
            color={getStatusColor(account.status)}
            style={{ textTransform: 'capitalize', verticalAlign: 'middle', fontSize: 14 }}
          >
            {account.status}
          </Tag>
        </Title>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => router.push(`/accounts/${id}?tab=${key}`)}
          items={[
            { key: 'details', label: 'Details', children: detailsTab },
            { key: 'edit', label: 'Edit', children: editTab },
            { key: 'proxy', label: 'Proxy', children: proxyTab },
            { key: 'emulator', label: 'Emulator', children: emulatorTab },
            {
              key: 'comments',
              label: (
                <span>
                  <CommentOutlined />
                  {' Comments'}
                  {commentsTotal > 0 && <Badge count={commentsTotal} style={{ marginLeft: 6 }} />}
                </span>
              ),
              children: commentsTab,
            },
          ]}
        />
      </Card>
    </div>
  );
}
