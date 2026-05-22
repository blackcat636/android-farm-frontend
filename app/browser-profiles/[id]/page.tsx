'use client';

import { useState, useEffect, useCallback } from 'react';
import { use } from 'react';
import {
  Tabs, Tag, Button, Space, Popconfirm, Table, Card, message, Modal, Form,
  Input, Select, Switch, Badge, Tooltip, Divider, Row, Col, Descriptions,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, DesktopOutlined, CheckCircleOutlined, ArrowLeftOutlined,
  PlayCircleOutlined, StopOutlined, ReloadOutlined,
} from '@ant-design/icons';
import {
  createBackendClient, tokenStorage,
  type BrowserProfileRecord, type BrowserProfilePlatform, type BrowserProxy,
  type BrowserSession, type CreateBrowserProfilePlatformDto,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const PLATFORMS = ['instagram', 'youtube', 'facebook', 'tiktok', 'twitter', 'linkedin', 'reddit', 'threads'];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'pink', youtube: 'red', facebook: 'blue',
  tiktok: 'purple', twitter: 'cyan', linkedin: 'geekblue',
  reddit: 'orange', threads: 'default',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'green', blocked: 'red', expired: 'orange', archived: 'default',
};

const SESSION_STATUS = {
  running: 'success', pending: 'processing', starting: 'processing',
  stopping: 'warning', stopped: 'default', error: 'error',
} as const;

export default function BrowserProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<BrowserProfileRecord | null>(null);
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [proxies, setProxies] = useState<BrowserProxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformModal, setPlatformModal] = useState<'add' | 'edit' | null>(null);
  const [editingPlatform, setEditingPlatform] = useState<BrowserProfilePlatform | null>(null);
  const [saving, setSaving] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
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
      const [profileData, sessionsData, proxiesData] = await Promise.all([
        client.getAdminBrowserProfileById(id),
        client.getAdminBrowserSessions(),
        client.getAdminBrowserProxies(),
      ]);
      setProfile(profileData);
      setSessions(sessionsData.filter((s: BrowserSession) => s.browser_profile_id === id));
      setProxies(proxiesData);
    } catch (err: any) {
      message.error(err.message || 'Error loading profile');
    } finally {
      setLoading(false);
    }
  }, [id, user, getClient]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const usedPlatforms = profile?.platforms?.map(p => p.platform) || [];
  const availablePlatforms = PLATFORMS.filter(p => !usedPlatforms.includes(p));

  const openAddPlatform = () => { form.resetFields(); setEditingPlatform(null); setPlatformModal('add'); };
  const openEditPlatform = (p: BrowserProfilePlatform) => {
    setEditingPlatform(p);
    form.setFieldsValue(p);
    setPlatformModal('edit');
  };
  const closeModal = () => { setPlatformModal(null); setEditingPlatform(null); form.resetFields(); };

  const handleSavePlatform = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const client = getClient();

      if (platformModal === 'edit' && editingPlatform) {
        const updated = await client.updateAdminBrowserProfilePlatform(id, editingPlatform.id, values);
        setProfile(prev => prev ? {
          ...prev,
          platforms: prev.platforms?.map(p => p.id === updated.id ? updated : p),
        } : prev);
        message.success('Platform updated');
      } else {
        const data: CreateBrowserProfilePlatformDto = values;
        const created = await client.addAdminBrowserProfilePlatform(id, data);
        setProfile(prev => prev ? { ...prev, platforms: [...(prev.platforms || []), created] } : prev);
        message.success('Platform added');
      }
      closeModal();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err.message || 'Error saving platform');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlatform = async (platformId: string) => {
    try {
      await getClient().deleteAdminBrowserProfilePlatform(id, platformId);
      setProfile(prev => prev ? { ...prev, platforms: prev.platforms?.filter(p => p.id !== platformId) } : prev);
      message.success('Platform removed');
    } catch (err: any) {
      message.error(err.message || 'Error removing platform');
    }
  };

  const handleStartSession = async () => {
    try {
      setStartingSession(true);
      const session = await getClient().createAdminBrowserSession({ browser_profile_id: id });
      setSessions(prev => [session, ...prev]);
      message.success('Session started');
    } catch (err: any) {
      message.error(err.message || 'Error starting session');
    } finally {
      setStartingSession(false);
    }
  };

  const handleStopSession = async (sessionId: string) => {
    try {
      await getClient().stopAdminBrowserSession(sessionId);
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: 'stopping' as const } : s));
      message.success('Session stopping…');
    } catch (err: any) {
      message.error(err.message || 'Error stopping session');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await getClient().deleteAdminBrowserSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      message.success('Session deleted');
    } catch (err: any) {
      message.error(err.message || 'Error deleting session');
    }
  };

  const handleMarkAuthenticated = async (platformId: string) => {
    try {
      const updated = await getClient().markAdminBrowserProfilePlatformAuthenticated(id, platformId);
      setProfile(prev => prev ? {
        ...prev,
        platforms: prev.platforms?.map(p => p.id === platformId ? updated : p),
      } : prev);
      message.success('Marked as authenticated');
    } catch (err: any) {
      message.error(err.message || 'Error');
    }
  };

  const authTypeValue = Form.useWatch('auth_type', form);

  const platformColumns: ColumnsType<BrowserProfilePlatform> = [
    {
      title: 'Platform',
      key: 'platform',
      render: (_, r) => <Tag color={PLATFORM_COLORS[r.platform] || 'default'}>{r.platform}</Tag>,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (v: string) => <span style={{ fontSize: 13 }}>{v || '—'}</span>,
    },
    {
      title: 'Auth',
      key: 'auth',
      width: 100,
      render: (_, r) => r.requires_auth
        ? <Tag color="blue">{r.auth_type || 'none'}</Tag>
        : <Tag color="default">No auth</Tag>,
    },
    {
      title: 'Status',
      key: 'status',
      width: 90,
      render: (_, r) => <Tag color={STATUS_COLORS[r.status] || 'default'}>{r.status}</Tag>,
    },
    {
      title: 'Authenticated',
      key: 'authenticated_at',
      width: 160,
      render: (_, r) => r.authenticated_at ? (
        <Space size={4}>
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <span style={{ fontSize: 11 }}>{new Date(r.authenticated_at).toLocaleDateString()} ({r.authenticated_via})</span>
        </Space>
      ) : <span style={{ color: '#bbb', fontSize: 12 }}>Not authenticated</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Mark authenticated">
            <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleMarkAuthenticated(r.id)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditPlatform(r)} />
          </Tooltip>
          <Popconfirm title="Remove platform?" onConfirm={() => handleDeletePlatform(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const sessionColumns: ColumnsType<BrowserSession> = [
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, r) => (
        <Space size={4}>
          <Badge status={SESSION_STATUS[r.status as keyof typeof SESSION_STATUS] || 'default'} />
          <span>{r.status}</span>
          {r.error && <Tooltip title={r.error}><span style={{ color: '#ff4d4f', fontSize: 11 }}>(!)</span></Tooltip>}
        </Space>
      ),
    },
    {
      title: 'VNC',
      key: 'vnc',
      width: 80,
      render: (_, r) => r.vnc_url && r.status === 'running' ? (
        <a href={`${r.vnc_url}?autoconnect=1`} target="_blank" rel="noreferrer">
          <Button size="small" icon={<DesktopOutlined />}>VNC</Button>
        </a>
      ) : null,
    },
    {
      title: 'Agent',
      dataIndex: 'agent_id',
      key: 'agent_id',
      render: (v: string) => v ? <span style={{ fontSize: 11, fontFamily: 'monospace' }}>{v.slice(0, 12)}…</span> : '—',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (v: string) => <span style={{ fontSize: 12 }}>{new Date(v).toLocaleString()}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_, r) => (
        <Space size={4}>
          {['running', 'starting', 'pending'].includes(r.status) && (
            <Tooltip title="Stop">
              <Popconfirm title="Stop this session?" onConfirm={() => handleStopSession(r.id)}>
                <Button size="small" danger icon={<StopOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          {['stopped', 'error'].includes(r.status) && (
            <Tooltip title="Delete">
              <Popconfirm title="Delete this session?" onConfirm={() => handleDeleteSession(r.id)}>
                <Button size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  if (!user) return <Loading />;
  if (loading) return <Loading />;
  if (!profile) return <div style={{ padding: 24 }}>Profile not found</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/browser-profiles')}>Back</Button>
        <h1 style={{ margin: 0 }}>{profile.name}</h1>
        <Tag color={STATUS_COLORS[profile.status] || 'default'}>{profile.status}</Tag>
        <Tag color={profile.browser_type === 'camoufox' ? 'purple' : 'blue'}>{profile.browser_type}</Tag>
      </div>

      <Tabs
        items={[
          {
            key: 'platforms',
            label: `Platforms (${profile.platforms?.length || 0})`,
            children: (
              <Card
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openAddPlatform}
                    disabled={availablePlatforms.length === 0}
                  >
                    Add Platform
                  </Button>
                }
              >
                <Table
                  dataSource={profile.platforms || []}
                  columns={platformColumns}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  locale={{ emptyText: 'No platforms added yet' }}
                />
              </Card>
            ),
          },
          {
            key: 'info',
            label: 'Info',
            children: (
              <Card>
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="ID"><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{profile.id}</span></Descriptions.Item>
                  <Descriptions.Item label="Browser">{profile.browser_type}</Descriptions.Item>
                  <Descriptions.Item label="Proxy">{profile.proxy ? `${profile.proxy.label || profile.proxy.host}:${profile.proxy.port}` : '—'}</Descriptions.Item>
                  <Descriptions.Item label="Status"><Tag color={STATUS_COLORS[profile.status]}>{profile.status}</Tag></Descriptions.Item>
                  {profile.browser_type === 'camoufox' && <>
                    <Descriptions.Item label="OS">{profile.camoufox_os || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Locale">{profile.camoufox_locale || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Humanize">{profile.camoufox_humanize ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="GeoIP">{profile.camoufox_geoip ? 'Yes' : 'No'}</Descriptions.Item>
                  </>}
                  {profile.browser_type === 'chrome' && <>
                    <Descriptions.Item label="Window Size">{profile.chrome_window_size || '—'}</Descriptions.Item>
                    <Descriptions.Item label="User Agent" span={2}><span style={{ fontSize: 11, wordBreak: 'break-all' }}>{profile.chrome_user_agent || '—'}</span></Descriptions.Item>
                  </>}
                  <Descriptions.Item label="Notes" span={2}>{profile.notes || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Created">{new Date(profile.created_at).toLocaleString()}</Descriptions.Item>
                  <Descriptions.Item label="Updated">{profile.updated_at ? new Date(profile.updated_at).toLocaleString() : '—'}</Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'sessions',
            label: `Sessions (${sessions.length})`,
            children: (
              <Card
                extra={
                  <Space>
                    <Button icon={<ReloadOutlined />} size="small" onClick={fetchAll}>Refresh</Button>
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      loading={startingSession}
                      onClick={handleStartSession}
                      disabled={profile.status !== 'active'}
                    >
                      Start Session
                    </Button>
                  </Space>
                }
              >
                <Table
                  dataSource={sessions}
                  columns={sessionColumns}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  locale={{ emptyText: 'No sessions yet — click "Start Session" to launch one' }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* Add/Edit Platform Modal */}
      <Modal
        open={!!platformModal}
        title={platformModal === 'edit' ? `Edit ${editingPlatform?.platform}` : 'Add Platform'}
        onOk={handleSavePlatform}
        onCancel={closeModal}
        confirmLoading={saving}
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {platformModal === 'add' && (
            <Form.Item name="platform" label="Platform" rules={[{ required: true }]}>
              <Select
                options={availablePlatforms.map(p => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
                placeholder="Select platform"
              />
            </Form.Item>
          )}
          <Form.Item name="username" label="Username">
            <Input placeholder="user@example.com" />
          </Form.Item>
          {platformModal === 'edit' && (
            <Form.Item name="status" label="Status">
              <Select options={[{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }, { value: 'expired', label: 'Expired' }]} />
            </Form.Item>
          )}
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
              <Form.Item
                name="cookies"
                label="Cookies (JSON array)"
                getValueFromEvent={(e) => { try { return JSON.parse(e.target.value); } catch { return e.target.value; } }}
                getValueProps={(v) => ({ value: v ? JSON.stringify(v, null, 2) : '' })}
              >
                <Input.TextArea rows={5} placeholder='[{"name":"...","value":"...","domain":"..."}]' />
              </Form.Item>
              <Form.Item name="verify_url" label="Verify URL"><Input placeholder="https://www.instagram.com/" /></Form.Item>
              <Form.Item name="user_agent" label="User Agent"><Input /></Form.Item>
            </>
          )}
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
