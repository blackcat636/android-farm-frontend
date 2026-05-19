'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Tag, Button, Space, Popconfirm, Tooltip, Card, message,
  Modal, Form, Input, InputNumber, Select, Tabs, Badge, Switch, Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, EyeInvisibleOutlined, PlayCircleOutlined, StopOutlined, DesktopOutlined, ThunderboltOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import {
  createBackendClient, tokenStorage,
  type BrowserAccount, type BrowserProxy, type BrowserSession, type CreateBrowserAccountDto,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';

interface ScenarioParam {
  key: string;
  label: string;
  type: 'string' | 'number' | 'select';
  required?: boolean;
  defaultValue?: any;
  options?: string[];
  placeholder?: string;
}

interface ScenarioDef {
  value: string;
  label: string;
  requiresAuth: boolean;
  params: ScenarioParam[];
}

const PLATFORM_SCENARIOS: Record<string, ScenarioDef[]> = {
  instagram: [
    { value: 'check_auth', label: 'Check Auth', requiresAuth: false, params: [] },
    { value: 'browse_feed', label: 'Browse Feed', requiresAuth: true, params: [
      { key: 'scrolls',     label: 'Scrolls',          type: 'number', defaultValue: 5 },
      { key: 'scrollDelay', label: 'Scroll delay (ms)', type: 'number', defaultValue: 2000 },
    ]},
    { value: 'like_post', label: 'Like Post', requiresAuth: true, params: [
      { key: 'url', label: 'Post URL', type: 'string', required: true, placeholder: 'https://www.instagram.com/p/...' },
    ]},
    { value: 'warmup', label: 'Warmup', requiresAuth: false, params: [
      { key: 'scrolls',         label: 'Scroll steps',            type: 'number',  defaultValue: 15 },
      { key: 'minPauseMs',      label: 'Min pause (ms)',           type: 'number',  defaultValue: 1200 },
      { key: 'maxPauseMs',      label: 'Max pause (ms)',           type: 'number',  defaultValue: 4500 },
      { key: 'longPauseChance', label: 'Long pause probability',   type: 'number',  defaultValue: 0.25 },
      { key: 'startPage',       label: 'Start page',               type: 'select',  defaultValue: 'feed', options: ['feed', 'explore'] },
    ]},
  ],
  youtube: [
    { value: 'watch_and_like', label: 'Watch & Like', requiresAuth: false, params: [
      { key: 'url',          label: 'Video URL',      type: 'string', required: true, placeholder: 'https://youtu.be/...' },
      { key: 'watchSeconds', label: 'Watch (sec)',    type: 'number', defaultValue: 30 },
    ]},
    { value: 'warmup', label: 'Warmup', requiresAuth: false, params: [
      { key: 'scrolls',       label: 'Scroll steps',             type: 'number', defaultValue: 12 },
      { key: 'minPauseMs',    label: 'Min pause (ms)',            type: 'number', defaultValue: 1500 },
      { key: 'maxPauseMs',    label: 'Max pause (ms)',            type: 'number', defaultValue: 5000 },
      { key: 'watchChance',   label: 'Video open probability',    type: 'number', defaultValue: 0.3 },
      { key: 'watchMinSec',   label: 'Min watch time (sec)',      type: 'number', defaultValue: 8 },
      { key: 'watchMaxSec',   label: 'Max watch time (sec)',      type: 'number', defaultValue: 45 },
    ]},
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
  running:   { status: 'success',    text: 'running' },
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

function normalizeBrowserType(v: unknown): 'chrome' | 'camoufox' {
  return v === 'camoufox' ? 'camoufox' : 'chrome';
}

export default function BrowserAccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BrowserAccount[]>([]);
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [proxies, setProxies] = useState<BrowserProxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [startingIds, setStartingIds] = useState<Set<string>>(new Set());
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());
  const [deletingSessionIds, setDeletingSessionIds] = useState<Set<string>>(new Set());
  const [markingAuthSessionIds, setMarkingAuthSessionIds] = useState<Set<string>>(new Set());

  const [filterPlatform, setFilterPlatform] = useState<string | undefined>();
  const [filterAuthType, setFilterAuthType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterUserId, setFilterUserId] = useState('');

  // Run scenario: selected def for dynamic params
  const [selectedScenarioDef, setSelectedScenarioDef] = useState<ScenarioDef | null>(null);

  // Account modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BrowserAccount | null>(null);
  const [modalTab, setModalTab] = useState<'script' | 'cookies'>('script');
  const [requiresAuth, setRequiresAuth] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [formBrowserType, setFormBrowserType] = useState<'chrome' | 'camoufox'>('chrome');
  const [scriptForm] = Form.useForm();
  const [cookiesForm] = Form.useForm();

  // Auth modal (cookies/script from accounts list)
  const [authTargetSession, setAuthTargetSession] = useState<BrowserSession | null>(null);
  const [authTab, setAuthTab] = useState<'cookies' | 'script'>('cookies');
  const [authLoading, setAuthLoading] = useState(false);
  const [authCookiesForm] = Form.useForm();
  const [authScriptForm] = Form.useForm();

  const SERVICES_FOR_AUTH = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'youtube',   label: 'YouTube' },
    { value: 'twitter',   label: 'Twitter / X' },
    { value: 'tiktok',    label: 'TikTok' },
    { value: 'facebook',  label: 'Facebook' },
  ];

  const handleOpenAuth = (account: BrowserAccount) => {
    const session = getSessionForAccount(account.id);
    if (!session) return;
    authCookiesForm.resetFields();
    authScriptForm.resetFields();
    authCookiesForm.setFieldsValue({ service: account.platform });
    authScriptForm.setFieldsValue({ service: account.platform, username: account.username });
    setAuthTab(account.auth_type === 'script' ? 'script' : 'cookies');
    setAuthTargetSession(session);
  };

  const handleAuthCookies = async (values: any) => {
    if (!authTargetSession) return;
    try {
      setAuthLoading(true);
      let cookies: any[];
      try {
        cookies = JSON.parse(values.cookies);
        if (!Array.isArray(cookies)) throw new Error();
      } catch {
        message.error('Invalid JSON — cookies must be an array');
        return;
      }
      await getClient().authBrowserSessionCookies(authTargetSession.id, {
        service: values.service,
        cookies,
        userAgent: values.userAgent || undefined,
        verifyUrl: values.verifyUrl || undefined,
      });
      message.success('Cookie auth started');
      setAuthTargetSession(null);
      setTimeout(fetchAll, 2000);
    } catch (err: any) {
      message.error(err.message || 'Error starting auth');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthScript = async (values: any) => {
    if (!authTargetSession) return;
    try {
      setAuthLoading(true);
      await getClient().authBrowserSessionScript(authTargetSession.id, {
        service: values.service,
        username: values.username,
        password: values.password,
        twoFactorSecret: values.twoFactorSecret || undefined,
      });
      message.success('Script auth started');
      setAuthTargetSession(null);
      setTimeout(fetchAll, 2000);
    } catch (err: any) {
      message.error(err.message || 'Error starting auth');
    } finally {
      setAuthLoading(false);
    }
  };

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
      const [accs, sess, prxs] = await Promise.all([
        getClient().getAdminBrowserAccounts({
          platform: filterPlatform,
          auth_type: filterAuthType,
          status: filterStatus,
          user_id: filterUserId.trim() || undefined,
        }),
        getClient().getAdminBrowserSessions(),
        getClient().getAdminBrowserProxies(),
      ]);
      setAccounts(accs);
      setSessions(sess);
      setProxies(prxs);
    } catch (err: any) {
      message.error(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, [user, getClient, filterPlatform, filterAuthType, filterStatus, filterUserId]);

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

  const handleMarkSessionAuthenticated = async (sessionId: string) => {
    try {
      setMarkingAuthSessionIds(prev => new Set(prev).add(sessionId));
      await getClient().setBrowserSessionAuthStatus(sessionId, 'authenticated');
      message.success('Сесію позначено як авторизовану; профіль акаунта оновлено');
      await fetchAll();
    } catch (err: any) {
      message.error(err.message || 'Не вдалося оновити auth');
    } finally {
      setMarkingAuthSessionIds(prev => { const s = new Set(prev); s.delete(sessionId); return s; });
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
    setRequiresAuth(true);
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
    camoufox_humanize: 1.5,
    camoufox_geoip: false,
    chrome_user_agent: '',
    chrome_window_size: '1280,800',
  };

  const openEdit = (account: BrowserAccount) => {
    setEditingAccount(account);
    setModalTab(account.auth_type);
    setRequiresAuth(account.requires_auth !== false);
    setShowSecrets(false);
    const bt = normalizeBrowserType((account as any).browser_type);
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
      camoufox_humanize: typeof (account as any).camoufox_humanize === 'number' ? (account as any).camoufox_humanize : 1.5,
      camoufox_geoip: (account as any).camoufox_geoip ?? false,
      chrome_user_agent: (account as any).chrome_user_agent || '',
      chrome_window_size: (account as any).chrome_window_size || '1280,800',
      proxy_id: (account as any).proxy_id || undefined,
    };
    if (account.auth_type === 'script') {
      scriptForm.setFieldsValue({ ...sharedVals, password: account.password || '', two_factor_secret: account.two_factor_secret || '' });
    } else {
      cookiesForm.setFieldsValue({ ...sharedVals, cookies: account.cookies ? JSON.stringify(account.cookies, null, 2) : '', user_agent: account.user_agent || '', verify_url: account.verify_url || '' });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    const form = requiresAuth ? (modalTab === 'script' ? scriptForm : cookiesForm) : scriptForm;
    let values: any;
    try { values = await form.validateFields(); } catch { return; }

    let dto: CreateBrowserAccountDto = { ...values, requires_auth: requiresAuth, auth_type: requiresAuth ? modalTab : 'script' };
    dto.browser_type = normalizeBrowserType(values.browser_type ?? formBrowserType);
    if (!dto.proxy_id) dto.proxy_id = null;
    if (requiresAuth && modalTab === 'cookies') {
      try {
        dto.cookies = JSON.parse(values.cookies);
        if (!Array.isArray(dto.cookies)) throw new Error();
      } catch {
        message.error('Invalid JSON — cookies must be an array');
        return;
      }
    }
    if (editingAccount && requiresAuth && modalTab === 'script') {
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

    const scenarioParams: any = {};
    if (selectedScenarioDef) {
      for (const p of selectedScenarioDef.params) {
        const v = values[`param_${p.key}`];
        if (v !== undefined && v !== '' && v !== null) {
          scenarioParams[p.key] = v;
        }
      }
    }

    try {
      setRunningSc(true);
      await getClient().addTask({
        platform: scenarioAccount.platform,
        action: 'run_scenario',
        browser_account_id: scenarioAccount.id,
        params: {
          scenario: values.scenario,
          ...scenarioParams,
        },
        priority: values.priority ?? 5,
      });
      message.success('Task queued');
      setScenarioAccount(null);
      setSelectedScenarioDef(null);
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
      key: 'auth_type',
      width: 100,
      render: (_: unknown, account: BrowserAccount) => {
        if (!account.requires_auth) return <Tag color="default">no auth</Tag>;
        return <Tag color={AUTH_TYPE_COLORS[account.auth_type]}>{account.auth_type}</Tag>;
      },
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
      title: 'Profile auth',
      key: 'profile_auth',
      width: 130,
      render: (_: unknown, account: BrowserAccount) => {
        if (!account.authenticated_at) {
          return <span style={{ color: '#bbb', fontSize: 12 }}>—</span>;
        }
        const via = account.authenticated_via || 'manual';
        return (
          <Space vertical size={2}>
            <Tag color={via === 'automatic' ? 'blue' : 'green'} style={{ fontSize: 11, margin: 0 }}>
              {via === 'automatic' ? 'auto' : 'manual'}
            </Tag>
            <Tooltip title={new Date(account.authenticated_at).toLocaleString()}>
              <span style={{ fontSize: 11, color: '#888' }}>{new Date(account.authenticated_at).toLocaleDateString()}</span>
            </Tooltip>
          </Space>
        );
      },
    },
    {
      title: '2FA',
      dataIndex: 'two_factor_secret',
      key: '2fa',
      width: 55,
      render: (v: string) => v ? <Tag color="green" style={{ fontSize: 11 }}>TOTP</Tag> : '—',
    },
    {
      title: 'Proxy',
      key: 'proxy',
      width: 130,
      render: (_, account: any) => {
        if (!account.proxy) return <span style={{ color: '#bbb', fontSize: 12 }}>—</span>;
        return (
          <Tooltip title={`${account.proxy.host}:${account.proxy.port}`}>
            <Tag style={{ fontSize: 11 }}>{account.proxy.label || `${account.proxy.host}:${account.proxy.port}`}</Tag>
          </Tooltip>
        );
      },
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
      width: 200,
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
            {isRunning && session && (
              <Tooltip title={session.auth_status !== 'authenticated' ? 'Authorize (cookies / login)' : 'Re-authorize'}>
                <Button
                  size="small"
                  icon={<KeyOutlined />}
                  onClick={() => handleOpenAuth(account)}
                />
              </Tooltip>
            )}
            {isRunning && session && session.auth_status !== 'authenticated' && (
              <Tooltip title="Mark as authenticated (after manual VNC login)">
                <Button
                  size="small"
                  type="text"
                  style={{ color: '#52c41a', padding: '0 4px' }}
                  loading={markingAuthSessionIds.has(session.id)}
                  onClick={() => handleMarkSessionAuthenticated(session.id)}
                >✓</Button>
              </Tooltip>
            )}
            <Tooltip title="Run Scenario">
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                disabled={!session || (account.requires_auth && session.auth_status !== 'authenticated')}
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
          <Form.Item name="camoufox_humanize" label="Humanize (0 = off)" initialValue={1.5} extra="Natural mouse movement intensity (0–10). 0 disables it.">
            <InputNumber min={0} max={10} step={0.5} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="camoufox_geoip" label="GeoIP" valuePropName="checked" initialValue={false} extra="Match browser locale/timezone to proxy IP (requires proxy)">
            <Switch />
          </Form.Item>
        </>
      )}

      {formBrowserType === 'chrome' && (
        <>
          <Form.Item name="chrome_user_agent" label="User-Agent (optional)" extra="Override Chrome User-Agent string">
            <Input.TextArea rows={2} placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ..." />
          </Form.Item>
          <Form.Item name="chrome_window_size" label="Window Size" initialValue="1280,800" extra="Format: width,height (e.g. 1920,1080)">
            <Input placeholder="1280,800" style={{ width: 140 }} />
          </Form.Item>
        </>
      )}

      <Divider style={{ margin: '12px 0' }}>Proxy</Divider>
      <Form.Item name="proxy_id" label="Proxy">
        <Select
          allowClear
          placeholder="No proxy"
          options={proxies.map(p => ({
            value: p.id,
            label: `${p.label} — ${p.host}:${p.port}`,
          }))}
        />
      </Form.Item>
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
          <Input allowClear placeholder="User ID" style={{ width: 280, fontFamily: 'monospace', fontSize: 12 }} value={filterUserId} onChange={e => setFilterUserId(e.target.value)} />
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
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Switch
            checked={requiresAuth}
            onChange={(v) => {
              setRequiresAuth(v);
              if (!v) {
                // Sync common fields from current active form into scriptForm when switching to no-auth
                const fromForm = modalTab === 'script' ? scriptForm : cookiesForm;
                const syncFields = ['platform', 'username', 'notes', 'browser_type', 'camoufox_os', 'camoufox_locale', 'camoufox_fingerprint_preset', 'camoufox_humanize', 'camoufox_geoip', 'chrome_user_agent', 'chrome_window_size', 'proxy_id'];
                scriptForm.setFieldsValue(fromForm.getFieldsValue(syncFields as any));
              }
            }}
            disabled={!!editingAccount}
          />
          <span style={{ fontWeight: 500 }}>Requires authorization</span>
          {!requiresAuth && <Tag color="default" style={{ marginLeft: 4 }}>No auth — profile only</Tag>}
        </div>

        {requiresAuth ? (
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
                'camoufox_fingerprint_preset', 'camoufox_humanize', 'camoufox_geoip',
                'chrome_user_agent', 'chrome_window_size', 'proxy_id',
              ];
              const partial = fromForm.getFieldsValue(syncFields as any);
              toForm.setFieldsValue(partial);
              setFormBrowserType(normalizeBrowserType(partial.browser_type));
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
        ) : (
          <Form form={scriptForm} layout="vertical">
            {commonFields}
          </Form>
        )}
      </Modal>

      {/* Run Scenario modal */}
      <Modal
        title={<Space><ThunderboltOutlined /><span>Run Scenario — {scenarioAccount?.username}</span></Space>}
        open={!!scenarioAccount}
        onCancel={() => { setScenarioAccount(null); setSelectedScenarioDef(null); }}
        onOk={handleRunScenario}
        confirmLoading={runningSc}
        okText="Run"
        width={500}
        destroyOnHidden
      >
        <Form form={scenarioForm} layout="vertical">
          <Form.Item name="scenario" label="Scenario" rules={[{ required: true }]} extra={`Platform: ${scenarioAccount?.platform}`}>
            <Select
              placeholder="Select scenario"
              options={(PLATFORM_SCENARIOS[scenarioAccount?.platform || ''] || []).map(s => ({ value: s.value, label: s.label }))}
              onChange={(val) => {
                const def = (PLATFORM_SCENARIOS[scenarioAccount?.platform || ''] || []).find(s => s.value === val) || null;
                setSelectedScenarioDef(def);
                // Clear previous param fields
                if (def) {
                  const reset: any = {};
                  def.params.forEach(p => { reset[`param_${p.key}`] = p.defaultValue ?? undefined; });
                  scenarioForm.setFieldsValue(reset);
                }
              }}
            />
          </Form.Item>

          {selectedScenarioDef && selectedScenarioDef.params.length > 0 && (
            <>
              <Divider style={{ margin: '8px 0' }}>Parameters</Divider>
              {selectedScenarioDef.params.map(p => (
                <Form.Item
                  key={p.key}
                  name={`param_${p.key}`}
                  label={p.label}
                  initialValue={p.defaultValue}
                  rules={p.required ? [{ required: true, message: `${p.label} is required` }] : []}
                >
                  {p.type === 'number' ? (
                    <InputNumber style={{ width: '100%' }} placeholder={String(p.defaultValue ?? '')} />
                  ) : p.type === 'select' ? (
                    <Select options={(p.options || []).map(o => ({ value: o, label: o }))} />
                  ) : (
                    <Input placeholder={p.placeholder || ''} />
                  )}
                </Form.Item>
              ))}
            </>
          )}

          {selectedScenarioDef && selectedScenarioDef.params.length === 0 && (
            <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 12 }}>No parameters for this scenario.</div>
          )}

          <Form.Item name="priority" label="Priority" initialValue={5}>
            <Select options={[{ value: 10, label: '10 — High' }, { value: 5, label: '5 — Normal' }, { value: 1, label: '1 — Low' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Auth Modal (from accounts list) */}
      <Modal
        title={`Authorize Session — ${(authTargetSession?.auth_username || authTargetSession?.id?.slice(0, 8)) ?? ''}`}
        open={!!authTargetSession}
        onCancel={() => { setAuthTargetSession(null); authCookiesForm.resetFields(); authScriptForm.resetFields(); }}
        footer={null}
        width={560}
        destroyOnHidden
      >
        <Tabs
          activeKey={authTab}
          onChange={key => setAuthTab(key as 'cookies' | 'script')}
          items={[
            {
              key: 'cookies',
              label: 'Cookies + User-Agent',
              children: (
                <Form form={authCookiesForm} layout="vertical" onFinish={handleAuthCookies}>
                  <Form.Item name="service" label="Service" rules={[{ required: true }]}>
                    <Select options={SERVICES_FOR_AUTH} placeholder="Select service" />
                  </Form.Item>
                  <Form.Item name="cookies" label="Cookies (JSON array)" rules={[{ required: true }]}>
                    <Input.TextArea rows={6} placeholder={'[{"name":"sessionid","value":"...","domain":".instagram.com","path":"/"}]'} style={{ fontFamily: 'monospace', fontSize: 12 }} />
                  </Form.Item>
                  <Form.Item name="userAgent" label="User-Agent (optional)">
                    <Input placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..." />
                  </Form.Item>
                  <Form.Item name="verifyUrl" label="Verify URL (optional)">
                    <Input placeholder="https://www.instagram.com" />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                    <Button type="primary" htmlType="submit" loading={authLoading}>Inject Cookies</Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'script',
              label: 'Login / Password',
              children: (
                <Form form={authScriptForm} layout="vertical" onFinish={handleAuthScript}>
                  <Form.Item name="service" label="Service" rules={[{ required: true }]}>
                    <Select options={SERVICES_FOR_AUTH} placeholder="Select service" />
                  </Form.Item>
                  <Form.Item name="username" label="Username / Email" rules={[{ required: true }]}>
                    <Input placeholder="user@example.com" />
                  </Form.Item>
                  <Form.Item name="password" label="Password" rules={[{ required: true }]}>
                    <Input.Password placeholder="password" />
                  </Form.Item>
                  <Form.Item name="twoFactorSecret" label="TOTP Secret (optional)">
                    <Input placeholder="JBSWY3DPEHPK3PXP" />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                    <Button type="primary" htmlType="submit" loading={authLoading}>Start Login</Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
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
            title="noVNC"
            src={buildVncUrl(vncSession.vnc_url)}
            style={{ width: '100%', height: '75vh', border: 'none', display: 'block' }}
            allow="fullscreen; clipboard-read; clipboard-write"
          />
        )}
      </Modal>
    </div>
  );
}
