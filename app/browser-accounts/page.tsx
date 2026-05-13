'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Tag, Button, Space, Popconfirm, Tooltip, Card, message,
  Modal, Form, Input, Select, Tabs, Badge, Switch, Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, EyeInvisibleOutlined, PlayCircleOutlined, StopOutlined, DesktopOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import {
  createBackendClient, tokenStorage,
  type BrowserAccount, type BrowserSession, type CreateBrowserAccountDto,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';

const PLATFORM_SCENARIOS: Record<string, { value: string; label: string }[]> = {
  instagram: [
    { value: 'check_auth',  label: 'Check Auth — перевірити авторизацію' },
    { value: 'browse_feed', label: 'Browse Feed — прокрутити стрічку' },
    { value: 'like_post',   label: 'Like Post — лайкнути пост (url в params)' },
  ],
  youtube: [
    { value: 'watch_and_like', label: 'Watch & Like — переглянути відео і лайкнути' },
  ],
};

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube',   label: 'YouTube' },
  { value: 'twitter',   label: 'Twitter / X' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'linkedin',  label: 'LinkedIn' },
];

const STATUS_COLORS: Record<string, string> = { active: 'success', blocked: 'error', expired: 'warning' };
const AUTH_TYPE_COLORS: Record<string, string> = { script: 'blue', cookies: 'purple' };

const SESSION_BADGE: Record<string, { status: any; text: string }> = {
  pending:   { status: 'processing', text: 'starting' },
  starting:  { status: 'processing', text: 'starting' },
  running:   { status: 'warning',    text: 'running' },
  stopping:  { status: 'default',    text: 'stopping' },
  stopped:   { status: 'default',    text: 'stopped' },
  error:     { status: 'error',      text: 'error' },
};

const AUTH_BADGE: Record<string, { color: string; text: string }> = {
  in_progress:  { color: 'blue',    text: 'auth…' },
  waiting_2fa:  { color: 'orange',  text: '2FA wait' },
  authenticated:{ color: 'green',   text: 'auth ✓' },
  auth_failed:  { color: 'red',     text: 'auth fail' },
};

export default function BrowserAccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BrowserAccount[]>([]);
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [startingIds, setStartingIds] = useState<Set<string>>(new Set());
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());
  const [deletingSessionIds, setDeletingSessionIds] = useState<Set<string>>(new Set());

  const [filterPlatform, setFilterPlatform] = useState<string | undefined>();
  const [filterAuthType, setFilterAuthType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  // Account modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BrowserAccount | null>(null);
  const [modalTab, setModalTab] = useState<'script' | 'cookies'>('script');
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [formBrowserType, setFormBrowserType] = useState<string>('chrome');
  const [scriptForm] = Form.useForm();
  const [cookiesForm] = Form.useForm();

  // VNC modal
  const [vncSession, setVncSession] = useState<BrowserSession | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build noVNC URL with correct WebSocket path parameter
  // noVNC default WS path is "websockify" relative to page root,
  // but we need it to go through /proxy/vnc/{sessionId}/websockify
  const buildVncUrl = (vncUrl: string): string => {
    try {
      const url = new URL(vncUrl);
      const pathParam = url.pathname.replace(/^\//, '').replace(/\/$/, '') + '/websockify';
      url.searchParams.set('path', pathParam);
      url.searchParams.set('autoconnect', '1');
      return url.toString();
    } catch {
      return vncUrl;
    }
  };

  // Run scenario modal
  const [scenarioAccount, setScenarioAccount] = useState<BrowserAccount | null>(null);
  const [scenarioForm] = Form.useForm();
  const [runningSc, setRunningSc] = useState(false);

  const getClient = useCallback(() => {
    const token = tokenStorage.get();
    if (!token) throw new Error('Authorization required');
    return createBackendClient(token);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [accs, sess] = await Promise.all([
        getClient().getAdminBrowserAccounts({ platform: filterPlatform, auth_type: filterAuthType, status: filterStatus }),
        getClient().getAdminBrowserSessions(),
      ]);
      setAccounts(accs);
      setSessions(sess);
    } catch (err: any) {
      message.error(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [user, getClient, filterPlatform, filterAuthType, filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh поки є незавершена сесія (включно з running + authenticated і stopping)
  useEffect(() => {
    const needsPoll = sessions.some(s =>
      ['pending', 'starting', 'running', 'stopping'].includes(s.status),
    );
    if (!needsPoll) return;
    const timer = setInterval(fetchAll, 10000);
    return () => clearInterval(timer);
  }, [sessions, fetchAll]);

  const getSessionForAccount = (accountId: string) =>
    sessions.find(s => s.browser_account_id === accountId && !['stopped', 'error'].includes(s.status)) || null;

  const handleStartSession = async (account: BrowserAccount) => {
    try {
      setStartingIds(prev => new Set(prev).add(account.id));
      await getClient().createAdminBrowserSession({ browser_account_id: account.id });
      message.success(`Session starting for ${account.username}`);
      setTimeout(fetchAll, 1500);
    } catch (err: any) {
      message.error(err.message || 'Failed to start session');
    } finally {
      setStartingIds(prev => { const s = new Set(prev); s.delete(account.id); return s; });
    }
  };

  const handleStopSession = async (account: BrowserAccount) => {
    const session = getSessionForAccount(account.id);
    if (!session) return;
    try {
      setStoppingIds(prev => new Set(prev).add(account.id));
      await getClient().stopAdminBrowserSession(session.id);
      message.success('Session stopping');
      setTimeout(fetchAll, 1500);
    } catch (err: any) {
      message.error(err.message || 'Failed to stop session');
    } finally {
      setStoppingIds(prev => { const s = new Set(prev); s.delete(account.id); return s; });
    }
  };

  const handleDeleteSession = async (session: BrowserSession) => {
    try {
      setDeletingSessionIds(prev => new Set(prev).add(session.id));
      await getClient().deleteAdminBrowserSession(session.id);
      message.success('Session deleted');
      fetchAll();
    } catch (err: any) {
      message.error(err.message || 'Failed to delete session');
    } finally {
      setDeletingSessionIds(prev => { const s = new Set(prev); s.delete(session.id); return s; });
    }
  };

  const openCreate = () => {
    setEditingAccount(null);
    setModalTab('script');
    setShowSecrets(false);
    setFormBrowserType('chrome');
    scriptForm.resetFields();
    cookiesForm.resetFields();
    setModalOpen(true);
  };

  const camoufoxDefaults = {
    browser_type: 'chrome',
    camoufox_os: 'windows',
    camoufox_locale: '',
    camoufox_fingerprint_preset: false,
    camoufox_humanize: true,
  };

  const openEdit = (account: BrowserAccount) => {
    setEditingAccount(account);
    setModalTab(account.auth_type);
    setShowSecrets(false);
    const bt = (account as any).browser_type || 'chrome';
    setFormBrowserType(bt);
    const sharedVals = {
      platform: account.platform,
      username: account.username,
      status: account.status,
      notes: account.notes || '',
      browser_type: bt,
      camoufox_os: (account as any).camoufox_os || 'windows',
      camoufox_locale: (account as any).camoufox_locale || '',
      camoufox_fingerprint_preset: (account as any).camoufox_fingerprint_preset ?? false,
      camoufox_humanize: (account as any).camoufox_humanize ?? true,
    };
    if (account.auth_type === 'script') {
      scriptForm.setFieldsValue({ ...sharedVals, password: account.password || '', two_factor_secret: account.two_factor_secret || '' });
    } else {
      cookiesForm.setFieldsValue({ ...sharedVals, cookies: account.cookies ? JSON.stringify(account.cookies, null, 2) : '', user_agent: account.user_agent || '', verify_url: account.verify_url || '' });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    const form = modalTab === 'script' ? scriptForm : cookiesForm;
    let values: any;
    try { values = await form.validateFields(); } catch { return; }

    let dto: CreateBrowserAccountDto = { ...values, auth_type: modalTab };
    dto.browser_type = (values.browser_type as string) || formBrowserType || 'chrome';
    if (modalTab === 'cookies') {
      try {
        dto.cookies = JSON.parse(values.cookies);
        if (!Array.isArray(dto.cookies)) throw new Error();
      } catch {
        message.error('Invalid JSON — cookies must be an array');
        return;
      }
    }
    if (editingAccount && modalTab === 'script') {
      if (!values.password?.trim?.()) delete (dto as any).password;
      if (!values.two_factor_secret?.trim?.()) delete (dto as any).two_factor_secret;
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
      fetchAll();
    } catch (err: any) {
      message.error(err.message || 'Error saving account');
    } finally {
      setSaving(false);
    }
  };

  const handleRunScenario = async () => {
    if (!scenarioAccount) return;
    let values: any;
    try { values = await scenarioForm.validateFields(); } catch { return; }

    let scenarioParams: any = {};
    if (values.params_json) {
      try { scenarioParams = JSON.parse(values.params_json); } catch {
        message.error('Invalid JSON in params');
        return;
      }
    }

    try {
      setRunningSc(true);
      await getClient().addTask({
        platform: 'browser',
        action: 'run_scenario',
        params: {
          browser_account_id: scenarioAccount.id,
          service: scenarioAccount.platform,
          scenario: values.scenario,
          scenarioParams,
        },
        priority: values.priority ?? 5,
      });
      message.success('Task queued');
      setScenarioAccount(null);
      scenarioForm.resetFields();
    } catch (err: any) {
      message.error(err.message || 'Failed to queue task');
    } finally {
      setRunningSc(false);
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
      width: 110,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: 'Auth',
      dataIndex: 'auth_type',
      key: 'auth_type',
      width: 90,
      render: (v: string) => <Tag color={AUTH_TYPE_COLORS[v]}>{v}</Tag>,
    },
    {
      title: 'Browser',
      dataIndex: 'browser_type',
      key: 'browser_type',
      width: 100,
      render: (v: string) => {
        const bt = v || 'chrome';
        return <Tag color={bt === 'camoufox' ? 'green' : 'blue'}>{bt}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: string) => <Badge status={STATUS_COLORS[v] as any} text={v} />,
    },
    {
      title: '2FA',
      dataIndex: 'two_factor_secret',
      key: '2fa',
      width: 55,
      render: (v: string) => v ? <Tag color="green" style={{ fontSize: 11 }}>TOTP</Tag> : '—',
    },
    {
      title: 'Session',
      key: 'session',
      width: 130,
      render: (_, account) => {
        const session = getSessionForAccount(account.id);
        if (!session) return <span style={{ color: '#bbb', fontSize: 12 }}>no session</span>;

        const sb = SESSION_BADGE[session.status] || { status: 'default', text: session.status };
        const ab = session.auth_status ? AUTH_BADGE[session.auth_status] : null;

        return (
          <Space vertical size={2}>
            <Badge status={sb.status} text={<span style={{ fontSize: 12 }}>{sb.text}</span>} />
            {ab && <Tag color={ab.color} style={{ fontSize: 11, margin: 0 }}>{ab.text}</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, account) => {
        const session = getSessionForAccount(account.id);
        const isRunning = session && ['running'].includes(session.status);
        const isActive = session && ['pending', 'starting', 'running', 'stopping'].includes(session.status);
        const isInactive = session && ['stopped', 'error'].includes(session.status);

        return (
          <Space size={4}>
            {!isActive ? (
              <Tooltip title="Start Session">
                <Button
                  size="small"
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={startingIds.has(account.id)}
                  onClick={() => handleStartSession(account)}
                />
              </Tooltip>
            ) : (
              <Tooltip title="Stop Session">
                <Button
                  size="small"
                  danger
                  icon={<StopOutlined />}
                  loading={stoppingIds.has(account.id)}
                  onClick={() => handleStopSession(account)}
                />
              </Tooltip>
            )}
            {isInactive && (
              <Popconfirm title="Delete this session?" onConfirm={() => handleDeleteSession(session!)}>
                <Tooltip title="Delete inactive session">
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    loading={deletingSessionIds.has(session!.id)}
                  />
                </Tooltip>
              </Popconfirm>
            )}
            <Tooltip title={isRunning ? 'Open VNC' : 'VNC available when running'}>
              <Button
                size="small"
                icon={<DesktopOutlined />}
                disabled={!isRunning || !session?.vnc_url}
                onClick={() => session && setVncSession(session)}
              />
            </Tooltip>
            <Tooltip title="Run Scenario">
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                disabled={!session || session.auth_status !== 'authenticated'}
                onClick={() => { setScenarioAccount(account); scenarioForm.resetFields(); }}
              />
            </Tooltip>
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(account)} />
            <Popconfirm title="Delete this account?" onConfirm={() => handleDelete(account.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} loading={deletingIds.has(account.id)} />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  if (!user) return <Loading />;

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
          <Select options={[{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }, { value: 'expired', label: 'Expired' }]} />
        </Form.Item>
      )}
      <Form.Item name="notes" label="Notes">
        <Input.TextArea rows={2} placeholder="Optional notes" />
      </Form.Item>

      <Divider style={{ margin: '12px 0' }} />

      <Form.Item name="browser_type" label="Browser" initialValue="chrome">
        <Select
          options={[
            { value: 'chrome', label: 'Chrome (CDP)' },
            { value: 'camoufox', label: 'Camoufox (Anti-detect Firefox)' },
          ]}
          onChange={(v) => setFormBrowserType(v)}
        />
      </Form.Item>

      {formBrowserType === 'camoufox' && (
        <>
          <Form.Item name="camoufox_os" label="OS" initialValue="windows" extra="Determines UA, fonts, and platform-specific fingerprint">
            <Select options={[
              { value: 'windows', label: 'Windows' },
              { value: 'macos',   label: 'macOS' },
              { value: 'linux',   label: 'Linux' },
            ]} />
          </Form.Item>
          <Form.Item name="camoufox_locale" label="Locale (optional)" extra="e.g. en-US, uk-UA — auto-detected from proxy IP if left empty">
            <Input placeholder="en-US" />
          </Form.Item>
          <Form.Item name="camoufox_fingerprint_preset" label="Fingerprint Preset" valuePropName="checked" initialValue={false} extra="Use a real Firefox fingerprint from traffic dataset (312 presets)">
            <Switch />
          </Form.Item>
          <Form.Item name="camoufox_humanize" label="Human Mouse" valuePropName="checked" initialValue={true} extra="Natural curved mouse movement at C++ level">
            <Switch />
          </Form.Item>
        </>
      )}
    </>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Browser Accounts</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Account</Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select allowClear placeholder="Platform" style={{ width: 140 }} options={PLATFORMS} value={filterPlatform} onChange={setFilterPlatform} />
          <Select allowClear placeholder="Auth type" style={{ width: 130 }} options={[{ value: 'script', label: 'Script' }, { value: 'cookies', label: 'Cookies' }]} value={filterAuthType} onChange={setFilterAuthType} />
          <Select allowClear placeholder="Status" style={{ width: 120 }} options={[{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }, { value: 'expired', label: 'Expired' }]} value={filterStatus} onChange={setFilterStatus} />
        </Space>
      </Card>

      <Table dataSource={accounts} columns={columns} rowKey="id" loading={loading} pagination={{ pageSize: 50, showSizeChanger: true }} size="middle" />

      {/* Account create/edit modal */}
      <Modal
        title={editingAccount ? `Edit: ${editingAccount.username}` : 'Add Browser Account'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); scriptForm.resetFields(); cookiesForm.resetFields(); }}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editingAccount ? 'Save' : 'Create'}
        width={560}
        destroyOnHidden
      >
        <Tabs
          activeKey={modalTab}
          onChange={(key) => {
            if (editingAccount) return;
            const next = key as 'script' | 'cookies';
            // Два окремі Form: при перемиканні вкладки синхронізуємо спільні поля,
            // інакше browser_type залишиться chrome у неактивній формі → сесія завжди Chromium.
            const fromForm = modalTab === 'script' ? scriptForm : cookiesForm;
            const toForm = next === 'script' ? scriptForm : cookiesForm;
            const syncFields = [
              'platform', 'username', 'notes',
              'browser_type', 'camoufox_os', 'camoufox_locale',
              'camoufox_fingerprint_preset', 'camoufox_humanize',
            ];
            const partial = fromForm.getFieldsValue(syncFields as any);
            toForm.setFieldsValue(partial);
            setFormBrowserType((partial.browser_type as string) || 'chrome');
            setModalTab(next);
          }}
          items={[
            {
              key: 'script',
              label: 'Login / Password',
              disabled: !!editingAccount && editingAccount.auth_type !== 'script',
              children: (
                <Form form={scriptForm} layout="vertical">
                  {commonFields}
                  <Form.Item name="password" label="Password" rules={[{ required: !editingAccount }]}>
                    <Input.Password placeholder={editingAccount ? '(leave empty to keep current)' : 'password'} visibilityToggle={{ visible: showSecrets, onVisibleChange: setShowSecrets }} />
                  </Form.Item>
                  <Form.Item name="two_factor_secret" label="TOTP Secret (optional)" extra="Base32 secret from Google Authenticator / Authy">
                    <Input placeholder="JBSWY3DPEHPK3PXP" suffix={<Button type="text" size="small" icon={showSecrets ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => setShowSecrets(p => !p)} />} />
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
                  <Form.Item name="cookies" label="Cookies (JSON array)" rules={[{ required: !editingAccount }]} extra="Export from Cookie Editor / EditThisCookie">
                    <Input.TextArea rows={6} placeholder={'[{"name":"sessionid","value":"...","domain":".instagram.com","path":"/"}]'} style={{ fontFamily: 'monospace', fontSize: 12 }} />
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

      {/* Run Scenario modal */}
      <Modal
        title={<Space><ThunderboltOutlined /><span>Run Scenario — {scenarioAccount?.username}</span></Space>}
        open={!!scenarioAccount}
        onCancel={() => setScenarioAccount(null)}
        onOk={handleRunScenario}
        confirmLoading={runningSc}
        okText="Run"
        width={480}
        destroyOnHidden
      >
        <Form form={scenarioForm} layout="vertical">
          <Form.Item name="scenario" label="Scenario" rules={[{ required: true }]} extra={`Platform: ${scenarioAccount?.platform}`}>
            <Select
              placeholder="Select scenario"
              options={PLATFORM_SCENARIOS[scenarioAccount?.platform || ''] || []}
            />
          </Form.Item>
          <Form.Item name="params_json" label="Params (JSON, optional)" extra="Leave empty if no params needed">
            <Input.TextArea rows={4} placeholder={'{\n  "url": "https://www.instagram.com/p/...",\n  "scrolls": 5\n}'} style={{ fontFamily: 'monospace', fontSize: 12 }} />
          </Form.Item>
          <Form.Item name="priority" label="Priority" initialValue={5}>
            <Select options={[{ value: 10, label: '10 — High' }, { value: 5, label: '5 — Normal' }, { value: 1, label: '1 — Low' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* VNC viewer modal */}
      <Modal
        title={
          <Space>
            <DesktopOutlined />
            <span>VNC — {vncSession?.auth_username || vncSession?.id?.slice(0, 8)}</span>
            {vncSession?.auth_status && AUTH_BADGE[vncSession.auth_status] && (
              <Tag color={AUTH_BADGE[vncSession.auth_status].color}>{AUTH_BADGE[vncSession.auth_status].text}</Tag>
            )}
          </Space>
        }
        open={!!vncSession}
        onCancel={() => setVncSession(null)}
        footer={
          <Button onClick={() => { if (vncSession?.vnc_url) window.open(buildVncUrl(vncSession.vnc_url), '_blank'); }}>
            Open in new tab
          </Button>
        }
        width="90vw"
        style={{ top: 20 }}
        styles={{ body: { padding: 0 } }}
        destroyOnHidden
      >
        {vncSession?.vnc_url && (
          <iframe
            ref={iframeRef}
            src={buildVncUrl(vncSession.vnc_url)}
            style={{ width: '100%', height: '75vh', border: 'none', display: 'block' }}
            allow="clipboard-read; clipboard-write"
          />
        )}
      </Modal>
    </div>
  );
}
