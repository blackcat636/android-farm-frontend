'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Popconfirm, Tooltip, Card, message, Modal, Form,
  Input, Select, InputNumber, Switch, Divider, Collapse, Row, Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined, UserOutlined,
} from '@ant-design/icons';
import {
  createBackendClient, tokenStorage,
  type BrowserProfileRecord, type BrowserProxy, type CreateBrowserProfileDto, type CreateBrowserProfileQuickDto,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import Link from 'next/link';

const PLATFORMS = ['instagram', 'youtube', 'facebook', 'tiktok', 'twitter', 'linkedin', 'reddit', 'threads'];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'pink', youtube: 'red', facebook: 'blue',
  tiktok: 'purple', twitter: 'cyan', linkedin: 'geekblue',
  reddit: 'orange', threads: 'default',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'green', blocked: 'red', archived: 'default',
};

const BROWSER_COLORS: Record<string, string> = {
  chrome: 'blue', camoufox: 'purple',
};

type ModalMode = 'profile' | 'quick' | 'edit' | null;

export default function BrowserProfilesPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<BrowserProfileRecord[]>([]);
  const [proxies, setProxies] = useState<BrowserProxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editingProfile, setEditingProfile] = useState<BrowserProfileRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const getClient = useCallback(() => {
    const token = tokenStorage.get();
    if (!token) throw new Error('Authorization required');
    return createBackendClient(token);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const client = getClient();
      const [profilesData, proxiesData] = await Promise.all([
        client.getAdminBrowserProfiles(),
        client.getAdminBrowserProxies(),
      ]);
      setProfiles(profilesData);
      setProxies(proxiesData);
    } catch (err: any) {
      message.error(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [user, getClient]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openProfile = () => { form.resetFields(); setEditingProfile(null); setModal('profile'); };
  const openQuick = () => { form.resetFields(); setEditingProfile(null); setModal('quick'); };
  const openEdit = (p: BrowserProfileRecord) => {
    setEditingProfile(p);
    form.setFieldsValue({ ...p, proxy_id: p.proxy_id ?? undefined });
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setEditingProfile(null); form.resetFields(); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const client = getClient();

      if (modal === 'quick') {
        const data: CreateBrowserProfileQuickDto = { ...values, name: values.name || values.username };
        const created = await client.createAdminBrowserProfileQuick(data);
        setProfiles(prev => [created, ...prev]);
        message.success('Account created');
      } else if (modal === 'edit' && editingProfile) {
        const updated = await client.updateAdminBrowserProfile(editingProfile.id, values);
        setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
        message.success('Profile updated');
      } else {
        const data: CreateBrowserProfileDto = values;
        const created = await client.createAdminBrowserProfile(data);
        setProfiles(prev => [created, ...prev]);
        message.success('Profile created');
      }
      closeModal();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await getClient().deleteAdminBrowserProfile(id);
      setProfiles(prev => prev.filter(p => p.id !== id));
      message.success('Profile deleted');
    } catch (err: any) {
      message.error(err.message || 'Error deleting');
    }
  };

  const columns: ColumnsType<BrowserProfileRecord> = [
    {
      title: 'Name',
      key: 'name',
      render: (_, r) => (
        <Link href={`/browser-profiles/${r.id}`}>
          <strong>{r.name}</strong>
        </Link>
      ),
    },
    {
      title: 'Browser',
      key: 'browser_type',
      width: 110,
      render: (_, r) => (
        <Tag color={BROWSER_COLORS[r.browser_type] || 'default'}>{r.browser_type}</Tag>
      ),
    },
    {
      title: 'Platforms',
      key: 'platforms',
      render: (_, r) => (
        <Space size={4} wrap>
          {r.platforms && r.platforms.length > 0
            ? r.platforms.map(p => (
                <Tag key={p.platform} color={PLATFORM_COLORS[p.platform] || 'default'} style={{ fontSize: 11 }}>
                  {p.platform}
                  {p.authenticated_at && ' ✓'}
                </Tag>
              ))
            : <span style={{ color: '#bbb', fontSize: 12 }}>—</span>
          }
        </Space>
      ),
    },
    {
      title: 'Proxy',
      key: 'proxy',
      width: 150,
      render: (_, r) => r.proxy
        ? <span style={{ fontSize: 12 }}>{r.proxy.label || r.proxy.host}</span>
        : <span style={{ color: '#bbb', fontSize: 12 }}>—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Blocked', value: 'blocked' },
        { text: 'Archived', value: 'archived' },
      ],
      onFilter: (v, r) => r.status === v,
      render: (v: string) => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      defaultSortOrder: 'descend',
      render: (v: string) => <span style={{ fontSize: 12 }}>{new Date(v).toLocaleDateString()}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm title="Delete profile?" description="All platforms inside will be removed." onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!user) return <Loading />;

  const browserTypeValue = Form.useWatch('browser_type', form) || 'chrome';
  const authTypeValue = Form.useWatch('auth_type', form);

  const browserConfigFields = (
    <>
      <Form.Item name="browser_type" label="Browser" initialValue="chrome">
        <Select options={[{ value: 'chrome', label: 'Chrome' }, { value: 'camoufox', label: 'Camoufox' }]} />
      </Form.Item>
      <Form.Item name="proxy_id" label="Proxy">
        <Select allowClear placeholder="No proxy" options={proxies.map(p => ({ value: p.id, label: `${p.label || p.host}:${p.port}` }))} />
      </Form.Item>
      {browserTypeValue === 'camoufox' ? (
        <Collapse ghost items={[{ key: '1', label: 'Camoufox settings', children: (
          <>
            <Form.Item name="camoufox_os" label="OS" initialValue="windows">
              <Select options={[{ value: 'windows', label: 'Windows' }, { value: 'macos', label: 'macOS' }, { value: 'linux', label: 'Linux' }]} />
            </Form.Item>
            <Form.Item name="camoufox_locale" label="Locale"><Input placeholder="uk-UA" /></Form.Item>
            <Form.Item name="camoufox_fingerprint_preset" label="Fingerprint Preset" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="camoufox_humanize" label="Humanize (0–10)" initialValue={1.5}>
              <InputNumber min={0} max={10} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="camoufox_geoip" label="GeoIP" valuePropName="checked"><Switch /></Form.Item>
          </>
        )}]} />
      ) : (
        <Collapse ghost items={[{ key: '1', label: 'Chrome settings', children: (
          <>
            <Form.Item name="chrome_user_agent" label="User Agent"><Input placeholder="Mozilla/5.0..." /></Form.Item>
            <Form.Item name="chrome_window_size" label="Window Size" initialValue="1280,800"><Input placeholder="1280,800" /></Form.Item>
          </>
        )}]} />
      )}
    </>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Browser Profiles</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>Refresh</Button>
          <Button icon={<UserOutlined />} onClick={openQuick}>New Account</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openProfile}>New Profile</Button>
        </Space>
      </div>

      <Table
        dataSource={profiles}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />

      {/* New Profile Modal */}
      <Modal
        open={modal === 'profile' || modal === 'edit'}
        title={modal === 'edit' ? 'Edit Profile' : 'New Profile'}
        onOk={handleSave}
        onCancel={closeModal}
        confirmLoading={saving}
        width={540}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="User1" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
          {modal === 'edit' && (
            <Form.Item name="status" label="Status">
              <Select options={[{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }, { value: 'archived', label: 'Archived' }]} />
            </Form.Item>
          )}
          <Divider>Browser</Divider>
          {browserConfigFields}
        </Form>
      </Modal>

      {/* New Account (Quick) Modal */}
      <Modal
        open={modal === 'quick'}
        title={<Space><ThunderboltOutlined />New Account</Space>}
        onOk={handleSave}
        onCancel={closeModal}
        confirmLoading={saving}
        width={580}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="platform" label="Platform" rules={[{ required: true }]}>
                <Select options={PLATFORMS.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="username" label="Username" rules={[{ required: true }]}>
                <Input placeholder="user@example.com" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="name" label="Profile Name">
            <Input placeholder="Leave blank to use username" />
          </Form.Item>
          <Divider>Auth</Divider>
          <Form.Item name="requires_auth" label="Requires Auth" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <Form.Item name="auth_type" label="Auth Type">
            <Select allowClear placeholder="None" options={[{ value: 'script', label: 'Script (login/password)' }, { value: 'cookies', label: 'Cookies' }]} />
          </Form.Item>
          {authTypeValue === 'script' && (
            <>
              <Form.Item name="password" label="Password"><Input.Password /></Form.Item>
              <Form.Item name="two_factor_secret" label="2FA Secret (TOTP)"><Input /></Form.Item>
            </>
          )}
          {authTypeValue === 'cookies' && (
            <>
              <Form.Item name="cookies" label="Cookies (JSON array)" getValueFromEvent={(e) => { try { return JSON.parse(e.target.value); } catch { return e.target.value; } }}>
                <Input.TextArea rows={4} placeholder='[{"name":"...","value":"...","domain":"..."}]' />
              </Form.Item>
              <Form.Item name="verify_url" label="Verify URL"><Input placeholder="https://www.instagram.com/" /></Form.Item>
              <Form.Item name="user_agent" label="User Agent"><Input /></Form.Item>
            </>
          )}
          <Divider>Browser</Divider>
          {browserConfigFields}
        </Form>
      </Modal>
    </div>
  );
}
