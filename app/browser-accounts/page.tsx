'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Popconfirm, Tooltip, Card, message,
  Modal, Form, Input, Select, Tabs, Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, EyeOutlined, EyeInvisibleOutlined,
} from '@ant-design/icons';
import {
  createBackendClient, tokenStorage,
  type BrowserAccount, type CreateBrowserAccountDto,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'success',
  blocked: 'error',
  expired: 'warning',
};

const AUTH_TYPE_COLORS: Record<string, string> = {
  script: 'blue',
  cookies: 'purple',
};

export default function BrowserAccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BrowserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Filters
  const [filterPlatform, setFilterPlatform] = useState<string | undefined>();
  const [filterAuthType, setFilterAuthType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BrowserAccount | null>(null);
  const [modalTab, setModalTab] = useState<'script' | 'cookies'>('script');
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [scriptForm] = Form.useForm();
  const [cookiesForm] = Form.useForm();

  const getClient = useCallback(() => {
    const token = tokenStorage.get();
    if (!token) throw new Error('Authorization required');
    return createBackendClient(token);
  }, []);

  const fetchAccounts = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getClient().getAdminBrowserAccounts({
        platform: filterPlatform,
        auth_type: filterAuthType,
        status: filterStatus,
      });
      setAccounts(data);
    } catch (err: any) {
      setError(err.message || 'Error loading accounts');
    } finally {
      setLoading(false);
    }
  }, [user, getClient, filterPlatform, filterAuthType, filterStatus]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const openCreate = () => {
    setEditingAccount(null);
    setModalTab('script');
    setShowSecrets(false);
    scriptForm.resetFields();
    cookiesForm.resetFields();
    setModalOpen(true);
  };

  const openEdit = (account: BrowserAccount) => {
    setEditingAccount(account);
    setModalTab(account.auth_type);
    setShowSecrets(false);
    if (account.auth_type === 'script') {
      scriptForm.setFieldsValue({
        platform: account.platform,
        username: account.username,
        status: account.status,
        password: account.password || '',
        two_factor_secret: account.two_factor_secret || '',
        notes: account.notes || '',
      });
    } else {
      cookiesForm.setFieldsValue({
        platform: account.platform,
        username: account.username,
        status: account.status,
        cookies: account.cookies ? JSON.stringify(account.cookies, null, 2) : '',
        user_agent: account.user_agent || '',
        verify_url: account.verify_url || '',
        notes: account.notes || '',
      });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    const form = modalTab === 'script' ? scriptForm : cookiesForm;
    let values: any;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    let dto: CreateBrowserAccountDto = { ...values, auth_type: modalTab };

    if (modalTab === 'cookies') {
      try {
        dto.cookies = JSON.parse(values.cookies);
        if (!Array.isArray(dto.cookies)) throw new Error('must be array');
      } catch {
        message.error('Invalid JSON — cookies must be an array');
        return;
      }
      delete (dto as any).cookies_raw;
    }

    try {
      setSaving(true);
      if (editingAccount) {
        await getClient().updateAdminBrowserAccount(editingAccount.id, dto);
        message.success('Account updated');
      } else {
        await getClient().createAdminBrowserAccount(dto);
        message.success('Account created');
      }
      setModalOpen(false);
      fetchAccounts();
    } catch (err: any) {
      message.error(err.message || 'Error saving account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingIds(prev => new Set(prev).add(id));
      await getClient().deleteAdminBrowserAccount(id);
      message.success('Account deleted');
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      message.error(err.message || 'Error deleting account');
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const columns: ColumnsType<BrowserAccount> = [
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: 'Auth Type',
      dataIndex: 'auth_type',
      key: 'auth_type',
      width: 110,
      render: (v: string) => <Tag color={AUTH_TYPE_COLORS[v]}>{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: string) => <Badge status={STATUS_COLORS[v] as any} text={v} />,
    },
    {
      title: '2FA',
      dataIndex: 'two_factor_secret',
      key: 'two_factor_secret',
      width: 60,
      render: (v: string) => v ? <Tag color="green">TOTP</Tag> : '—',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (v: string) => v ? <Tooltip title={v}>{v}</Tooltip> : '—',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (v: string) => new Date(v).toLocaleDateString(),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="Delete this account?" onConfirm={() => handleDelete(record.id)}>
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deletingIds.has(record.id)}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!user) return <Loading />;
  if (loading && accounts.length === 0) return <Loading />;
  if (error) return <ErrorDisplay message={error} />;

  const commonFields = (
    <>
      <Form.Item name="platform" label="Platform" rules={[{ required: true }]}>
        <Select options={PLATFORMS} placeholder="Select platform" />
      </Form.Item>
      <Form.Item name="username" label="Username / Login" rules={[{ required: true }]}>
        <Input placeholder="user@example.com" />
      </Form.Item>
      {editingAccount && (
        <Form.Item name="status" label="Status">
          <Select options={[
            { value: 'active', label: 'Active' },
            { value: 'blocked', label: 'Blocked' },
            { value: 'expired', label: 'Expired' },
          ]} />
        </Form.Item>
      )}
      <Form.Item name="notes" label="Notes">
        <Input.TextArea rows={2} placeholder="Optional notes" />
      </Form.Item>
    </>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Browser Accounts</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAccounts} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Account</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder="Platform"
            style={{ width: 140 }}
            options={PLATFORMS}
            value={filterPlatform}
            onChange={setFilterPlatform}
          />
          <Select
            allowClear
            placeholder="Auth type"
            style={{ width: 130 }}
            options={[{ value: 'script', label: 'Script' }, { value: 'cookies', label: 'Cookies' }]}
            value={filterAuthType}
            onChange={setFilterAuthType}
          />
          <Select
            allowClear
            placeholder="Status"
            style={{ width: 120 }}
            options={[{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }, { value: 'expired', label: 'Expired' }]}
            value={filterStatus}
            onChange={setFilterStatus}
          />
        </Space>
      </Card>

      <Table
        dataSource={accounts}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: true }}
        size="small"
      />

      <Modal
        title={editingAccount ? `Edit: ${editingAccount.username}` : 'Add Browser Account'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); scriptForm.resetFields(); cookiesForm.resetFields(); }}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editingAccount ? 'Save' : 'Create'}
        width={560}
        destroyOnClose
      >
        <Tabs
          activeKey={modalTab}
          onChange={key => { if (!editingAccount) setModalTab(key as 'script' | 'cookies'); }}
          items={[
            {
              key: 'script',
              label: 'Login / Password',
              disabled: !!editingAccount && editingAccount.auth_type !== 'script',
              children: (
                <Form form={scriptForm} layout="vertical">
                  {commonFields}
                  <Form.Item name="password" label="Password" rules={[{ required: !editingAccount }]}>
                    <Input.Password
                      placeholder={editingAccount ? '(leave empty to keep current)' : 'password'}
                      visibilityToggle={{ visible: showSecrets, onVisibleChange: setShowSecrets }}
                    />
                  </Form.Item>
                  <Form.Item
                    name="two_factor_secret"
                    label="TOTP Secret (optional)"
                    extra="Base32 secret from Google Authenticator / Authy"
                  >
                    <Input
                      placeholder="JBSWY3DPEHPK3PXP"
                      suffix={
                        <Button
                          type="text"
                          size="small"
                          icon={showSecrets ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                          onClick={() => setShowSecrets(p => !p)}
                        />
                      }
                    />
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'cookies',
              label: 'Cookies + User-Agent',
              disabled: !!editingAccount && editingAccount.auth_type !== 'cookies',
              children: (
                <Form form={cookiesForm} layout="vertical">
                  {commonFields}
                  <Form.Item
                    name="cookies"
                    label="Cookies (JSON array)"
                    rules={[{ required: !editingAccount }]}
                    extra="Export from Cookie Editor / EditThisCookie"
                  >
                    <Input.TextArea
                      rows={6}
                      placeholder={'[{"name":"sessionid","value":"...","domain":".instagram.com","path":"/"}]'}
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                  </Form.Item>
                  <Form.Item name="user_agent" label="User-Agent (optional)">
                    <Input placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..." />
                  </Form.Item>
                  <Form.Item name="verify_url" label="Verify URL (optional)">
                    <Input placeholder="https://www.instagram.com" />
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
