'use client';

import { useState, useEffect } from 'react';
import {
  Drawer,
  Descriptions,
  Tag,
  Button,
  Space,
  Card,
  Typography,
  Divider,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Popconfirm,
  Switch,
  Alert,
} from 'antd';
import {
  createBackendClient,
  tokenStorage,
  type SocialAccount,
  type AccountProxy,
  type AccountEmulatorBinding,
  type CreateProxyDto,
} from '@/lib/api/backend';
import { SafetyOutlined, LinkOutlined, PlusOutlined, EditOutlined, UnlockOutlined, DisconnectOutlined } from '@ant-design/icons';
import { maskEmail } from '@/utils/maskEmail';
import { useAllEmulators } from '@/hooks/useAllEmulators';

const { Option } = Select;
const { Title, Text } = Typography;

interface AccountDetailsDrawerProps {
  visible: boolean;
  account: SocialAccount;
  onClose: () => void;
  onRefresh: () => void;
}

export function AccountDetailsDrawer({
  visible,
  account,
  onClose,
  onRefresh,
}: AccountDetailsDrawerProps) {
  const [proxy, setProxy] = useState<AccountProxy | null>(null);
  const [binding, setBinding] = useState<AccountEmulatorBinding | null>(null);
  const [loading, setLoading] = useState(false);
  const [proxyModalVisible, setProxyModalVisible] = useState(false);
  const [bindModalVisible, setBindModalVisible] = useState(false);
  const [bindingVerificationInProgress, setBindingVerificationInProgress] = useState(false);
  const [proxyForm] = Form.useForm();
  const [bindForm] = Form.useForm();
  const { emulators, loading: loadingEmulators } = useAllEmulators(false);

  useEffect(() => {
    if (visible && account) {
      loadDetails();
    }
  }, [visible, account]);

  const loadDetails = async () => {
    const token = tokenStorage.get();
    if (!token) return;

    try {
      setLoading(true);
      const backendClient = createBackendClient(token);

      // Load proxy
      const proxyData = await backendClient.getProxyForAccount(account.id);
      setProxy(proxyData);

      // Load binding
      const bindingData = await backendClient.getBindingForAccount(account.id);
      setBinding(bindingData);
    } catch (err: any) {
      console.error('Error loading details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProxy = async () => {
    try {
      const values = await proxyForm.validateFields();
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      const proxyData: CreateProxyDto = {
        account_id: account.id,
        proxy_host: values.proxy_host,
        proxy_port: values.proxy_port,
        proxy_type: values.proxy_type || 'http',
        proxy_username: values.proxy_username,
        proxy_password: values.proxy_password,
      };

      await backendClient.createProxy(proxyData);
      message.success('Proxy created successfully');
      setProxyModalVisible(false);
      proxyForm.resetFields();
      loadDetails();
      onRefresh();
    } catch (err: any) {
      message.error(err.message || 'Error creating proxy');
    }
  };

  const handleUnblock = async () => {
    try {
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      await backendClient.unblockSocialAccount(account.id);
      message.success('Account unblocked');
      onRefresh();
    } catch (err: any) {
      message.error(err.message || 'Error unblocking account');
    }
  };

  const handleUnbind = async () => {
    try {
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      if (!binding) {
        throw new Error('Binding not found');
      }

      const backendClient = createBackendClient(token);
      await backendClient.deleteBinding(binding.id);
      message.success('Account successfully unbound from emulator');
      setBinding(null);
      loadDetails();
      onRefresh();
    } catch (err: any) {
      message.error(err.message || 'Error unbinding account');
    }
  };

  const POLL_INTERVAL_MS = 3000;
  const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

  const handleBind = async () => {
    try {
      const values = await bindForm.validateFields();
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');

      const backendClient = createBackendClient(token);
      const verifyLogin = values.verifyLogin !== false;

      const response = await backendClient.createBinding({
        account_id: account.id,
        emulator_id: values.emulatorId,
        binding_type: 'permanent',
        verifyLogin,
      });

      // Direct creation (verifyLogin: false)
      if (!('taskId' in response)) {
        message.success('Account bound to emulator successfully');
        setBindModalVisible(false);
        bindForm.resetFields();
        loadDetails();
        onRefresh();
        return;
      }

      // Async verification — poll
      setBindingVerificationInProgress(true);
      try {
        const startTime = Date.now();
        for (;;) {
          const task = await backendClient.getTask(response.taskId);

          if (task.status === 'completed') {
            message.success('Account bound to emulator successfully');
            setBindModalVisible(false);
            bindForm.resetFields();
            loadDetails();
            onRefresh();
            return;
          }

          if (task.status === 'failed') {
            throw new Error(task.error_message || 'Login verification failed');
          }

          if (Date.now() - startTime > POLL_TIMEOUT_MS) {
            throw new Error('Verification timeout (5 min)');
          }

          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
      } finally {
        setBindingVerificationInProgress(false);
      }
    } catch (err: any) {
      message.error(err.message || 'Error binding account to emulator');
    }
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

  return (
    <>
      <Drawer
        title={`Account Details: ${account.username}`}
        placement="right"
        width={600}
        onClose={onClose}
        open={visible}
        extra={
          account.blocked_until && new Date(account.blocked_until) > new Date() ? (
            <Popconfirm
              title="Unblock account?"
              description="Are you sure you want to unblock this account?"
              onConfirm={handleUnblock}
              okText="Yes"
              cancelText="No"
            >
              <Button type="primary" icon={<UnlockOutlined />}>
                Unblock
              </Button>
            </Popconfirm>
          ) : null
        }
      >
        <Descriptions title="Basic Information" bordered column={1} size="small">
          <Descriptions.Item label="Platform">
            <Tag color="blue" style={{ textTransform: 'capitalize' }}>
              {account.platform}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Username">{account.username}</Descriptions.Item>
          <Descriptions.Item label="Email">{maskEmail(account.email)}</Descriptions.Item>
          <Descriptions.Item label="Phone">{account.phone || '-'}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Space orientation="vertical" size="small">
            <Tag color={getStatusColor(account.status)} style={{ textTransform: 'capitalize' }}>
              {account.status}
            </Tag>
              {account.blocked_until && new Date(account.blocked_until) > new Date() && (
                <Tag color="red">
                  Blocked until {new Date(account.blocked_until).toLocaleString('en-US')}
                </Tag>
              )}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Proxy Required">
            <Tag color={account.requires_proxy ? 'orange' : 'default'}>
              {account.requires_proxy ? (
                <>
                  <SafetyOutlined /> Yes
                </>
              ) : (
                'No'
              )}
            </Tag>
          </Descriptions.Item>
          {account.proxy_required_reason && (
            <Descriptions.Item label="Proxy Reason">
              {account.proxy_required_reason}
            </Descriptions.Item>
          )}
          {account.account_status_reason && (
            <Descriptions.Item label="Status Reason">
              {account.account_status_reason}
            </Descriptions.Item>
          )}
          {account.blocked_until && (
            <Descriptions.Item label="Blocking">
              {new Date(account.blocked_until) > new Date() ? (
                <Tag color="red">
                  Blocked until {new Date(account.blocked_until).toLocaleString('en-US')}
                </Tag>
              ) : (
                <Tag color="green">
                  Unblocked ({new Date(account.blocked_until).toLocaleString('en-US')})
                </Tag>
              )}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Divider />

        <Title level={5}>Statistics</Title>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="Total Tasks">{account.total_tasks}</Descriptions.Item>
          <Descriptions.Item label="Successful">
            <Tag color="green">{account.successful_tasks}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Failed">
            <Tag color="red">{account.failed_tasks}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Failed Logins">{account.failed_logins}</Descriptions.Item>
          <Descriptions.Item label="Last Activity">
            {account.last_activity
              ? new Date(account.last_activity).toLocaleString('en-US')
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Last Login">
            {account.last_login_at
              ? new Date(account.last_login_at).toLocaleString('en-US')
              : '-'}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5}>Proxy</Title>
          {!proxy && account.requires_proxy && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setProxyModalVisible(true)}
              size="small"
            >
              Add Proxy
            </Button>
          )}
        </div>

        {proxy ? (
          <Card size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Host">{proxy.proxy_host}</Descriptions.Item>
              <Descriptions.Item label="Port">{proxy.proxy_port}</Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag>{proxy.proxy_type.toUpperCase()}</Tag>
              </Descriptions.Item>
              {proxy.proxy_username && (
                <Descriptions.Item label="Username">{proxy.proxy_username}</Descriptions.Item>
              )}
              <Descriptions.Item label="Status">
                <Tag color={proxy.status === 'active' ? 'green' : 'red'}>
                  {proxy.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Requests">{proxy.total_requests}</Descriptions.Item>
              <Descriptions.Item label="Failed">{proxy.failed_requests}</Descriptions.Item>
              <Descriptions.Item label="Consecutive Failures">
                <Tag color={proxy.consecutive_failures > 5 ? 'red' : 'default'}>
                  {proxy.consecutive_failures}
                </Tag>
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

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={5}>
            <LinkOutlined /> Emulator Binding
          </Title>
          {!binding && (
            <Button
              type="primary"
              icon={<LinkOutlined />}
              size="small"
              onClick={() => setBindModalVisible(true)}
              loading={loadingEmulators}
            >
              Bind to emulator
            </Button>
          )}
          {binding && (
            <Popconfirm
              title="Unbind account from emulator?"
              description="Are you sure you want to unbind this account from emulator? This action is irreversible."
              onConfirm={handleUnbind}
              okText="Yes"
              cancelText="No"
            >
              <Button danger icon={<DisconnectOutlined />} size="small">
                Unbind
              </Button>
            </Popconfirm>
          )}
        </div>

        {binding ? (
          <Card size="small">
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Emulator ID">{binding.emulator_id}</Descriptions.Item>
              <Descriptions.Item label="Binding Type">
                <Tag>{binding.binding_type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={binding.status === 'active' ? 'green' : 'default'}>
                  {binding.status}
                </Tag>
              </Descriptions.Item>
              {binding.session_data && (
                <Descriptions.Item label="Session">
                  <Tag color="green">Saved</Tag>
                </Descriptions.Item>
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
      </Drawer>

      <Modal
        title="Add Proxy"
        open={proxyModalVisible}
        onCancel={() => {
          setProxyModalVisible(false);
          proxyForm.resetFields();
        }}
        onOk={handleCreateProxy}
        width={500}
      >
        <Form form={proxyForm} layout="vertical">
          <Form.Item
            name="proxy_host"
            label="Host"
            rules={[{ required: true, message: 'Enter proxy host' }]}
          >
            <Input placeholder="proxy.example.com" />
          </Form.Item>

          <Form.Item
            name="proxy_port"
            label="Port"
            rules={[{ required: true, message: 'Enter proxy port' }]}
          >
            <InputNumber min={1} max={65535} style={{ width: '100%' }} placeholder="8080" />
          </Form.Item>

          <Form.Item
            name="proxy_type"
            label="Proxy Type"
            initialValue="http"
            rules={[{ required: true }]}
          >
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
          >
            <Select
              placeholder="Select emulator"
              loading={loadingEmulators}
              showSearch
              optionFilterProp="children"
            >
              {emulators.map((emulator) => (
                <Option key={`${emulator.agentId}-${emulator.id}`} value={emulator.id}>
                  <span>
                    {emulator.name}
                    {emulator.agentName && ` (${emulator.agentName})`}
                    {emulator.status !== 'active' && (
                      <Tag color="orange" style={{ marginLeft: 8 }}>
                        Disabled
                      </Tag>
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
            help="If enabled, the system will run login on the emulator before creating the binding. Disable only if you have already logged in this account manually on the device."
          >
            <Switch
              checkedChildren="Verify login"
              unCheckedChildren="Skip (already on device)"
            />
          </Form.Item>

          {bindingVerificationInProgress && (
            <Alert
              message="Verifying login on emulator…"
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Form>
      </Modal>
    </>
  );
}

