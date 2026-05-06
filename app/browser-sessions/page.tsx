'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Tag, Button, Space, Popconfirm, Tooltip, Card, Row, Col, Statistic, message,
  Modal, Tabs, Form, Input, Select,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined, StopOutlined, LinkOutlined, BugOutlined, KeyOutlined,
} from '@ant-design/icons';
import { createBackendClient, tokenStorage, type BrowserSession } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

const STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  starting: 'processing',
  running: 'success',
  stopping: 'warning',
  stopped: 'default',
  error: 'error',
};

const AUTH_STATUS_COLORS: Record<string, string> = {
  none: 'default',
  in_progress: 'processing',
  waiting_2fa: 'warning',
  authenticated: 'success',
  auth_failed: 'error',
};

const SERVICES = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
];

export default function BrowserSessionsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<BrowserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());

  // Auth modal state
  const [authSession, setAuthSession] = useState<BrowserSession | null>(null);
  const [authTab, setAuthTab] = useState<'cookies' | 'script'>('cookies');
  const [authLoading, setAuthLoading] = useState(false);
  const [cookiesForm] = Form.useForm();
  const [scriptForm] = Form.useForm();

  // 2FA modal state
  const [twoFaSession, setTwoFaSession] = useState<BrowserSession | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getClient = useCallback(() => {
    const token = tokenStorage.get();
    if (!token) throw new Error('Authorization required');
    return createBackendClient(token);
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getClient().getAdminBrowserSessions();
      setSessions(data);
    } catch (err: any) {
      setError(err.message || 'Error loading sessions');
    } finally {
      setLoading(false);
    }
  }, [user, getClient]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Poll for 2FA pending sessions
  useEffect(() => {
    const waiting = sessions.find(s => s.auth_status === 'waiting_2fa');
    if (waiting && !twoFaSession) {
      setTwoFaSession(waiting);
      setTwoFaCode('');
    }
    if (!waiting && twoFaSession) {
      setTwoFaSession(null);
    }
  }, [sessions, twoFaSession]);

  useEffect(() => {
    if (twoFaSession) {
      pollRef.current = setInterval(fetchSessions, 4000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [twoFaSession, fetchSessions]);

  const handleStop = async (id: string) => {
    try {
      setStoppingIds(prev => new Set(prev).add(id));
      await getClient().stopBrowserSession(id);
      message.success('Stop requested');
      setTimeout(fetchSessions, 1500);
    } catch (err: any) {
      message.error(err.message || 'Error stopping session');
    } finally {
      setStoppingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleAuthCookies = async (values: any) => {
    if (!authSession) return;
    try {
      setAuthLoading(true);
      let cookies: any[];
      try {
        cookies = JSON.parse(values.cookies);
        if (!Array.isArray(cookies)) throw new Error('Must be an array');
      } catch {
        message.error('Invalid JSON — cookies must be an array of objects');
        return;
      }
      await getClient().authBrowserSessionCookies(authSession.id, {
        service: values.service,
        cookies,
        userAgent: values.userAgent || undefined,
        verifyUrl: values.verifyUrl || undefined,
      });
      message.success('Cookie auth started');
      setAuthSession(null);
      cookiesForm.resetFields();
      setTimeout(fetchSessions, 2000);
    } catch (err: any) {
      message.error(err.message || 'Error starting cookie auth');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthScript = async (values: any) => {
    if (!authSession) return;
    try {
      setAuthLoading(true);
      await getClient().authBrowserSessionScript(authSession.id, {
        service: values.service,
        username: values.username,
        password: values.password,
        twoFactorSecret: values.twoFactorSecret || undefined,
      });
      message.success('Script auth started');
      setAuthSession(null);
      scriptForm.resetFields();
      setTimeout(fetchSessions, 2000);
    } catch (err: any) {
      message.error(err.message || 'Error starting script auth');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSubmit2fa = async () => {
    if (!twoFaSession || !twoFaCode.trim()) return;
    try {
      setTwoFaLoading(true);
      await getClient().submitBrowserSession2fa(twoFaSession.id, twoFaCode.trim());
      message.success('2FA code submitted');
      setTwoFaCode('');
      setTimeout(fetchSessions, 2000);
    } catch (err: any) {
      message.error(err.message || 'Error submitting 2FA code');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const stats = {
    total: sessions.length,
    running: sessions.filter(s => s.status === 'running').length,
    pending: sessions.filter(s => s.status === 'pending' || s.status === 'starting').length,
    error: sessions.filter(s => s.status === 'error').length,
  };

  const columns: ColumnsType<BrowserSession> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id: string) => <Tooltip title={id}>{id.slice(0, 8)}…</Tooltip>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => <Tag color={STATUS_COLORS[status] || 'default'}>{status}</Tag>,
      filters: ['pending', 'running', 'stopped', 'error'].map(s => ({ text: s, value: s })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Auth',
      dataIndex: 'auth_status',
      key: 'auth_status',
      width: 130,
      render: (authStatus: string, record: BrowserSession) => (
        <Space direction="vertical" size={2}>
          <Tag color={AUTH_STATUS_COLORS[authStatus] || 'default'}>{authStatus || 'none'}</Tag>
          {record.auth_service && (
            <span style={{ fontSize: 11, color: '#888' }}>{record.auth_service}</span>
          )}
          {record.auth_username && (
            <span style={{ fontSize: 11, color: '#888' }}>{record.auth_username}</span>
          )}
        </Space>
      ),
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
      width: 80,
      render: (v: string) => v || '—',
    },
    {
      title: 'Agent',
      dataIndex: 'agent_id',
      key: 'agent_id',
      width: 120,
      render: (v: string) => v ? <Tooltip title={v}>{v.slice(0, 12)}…</Tooltip> : '—',
    },
    {
      title: 'VNC',
      dataIndex: 'vnc_url',
      key: 'vnc_url',
      render: (url: string) =>
        url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            <LinkOutlined /> Open
          </a>
        ) : '—',
    },
    {
      title: 'CDP',
      dataIndex: 'debug_url',
      key: 'debug_url',
      render: (url: string) =>
        url ? (
          <Tooltip title={url}>
            <BugOutlined /> {url.slice(0, 25)}…
          </Tooltip>
        ) : '—',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Error',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (v: string) =>
        v ? <Tooltip title={v}><span style={{ color: '#ff4d4f' }}>{v}</span></Tooltip> : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<KeyOutlined />}
            disabled={record.status !== 'running'}
            onClick={() => { setAuthSession(record); setAuthTab('cookies'); }}
          >
            Auth
          </Button>
          <Popconfirm
            title="Stop this session?"
            onConfirm={() => handleStop(record.id)}
            disabled={['stopped', 'stopping', 'error'].includes(record.status)}
          >
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              loading={stoppingIds.has(record.id)}
              disabled={['stopped', 'stopping', 'error'].includes(record.status)}
            >
              Stop
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!user) return <Loading />;
  if (loading && sessions.length === 0) return <Loading />;
  if (error) return <ErrorDisplay message={error} />;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Browser Sessions</h2>
        <Button icon={<ReloadOutlined />} onClick={fetchSessions} loading={loading}>
          Refresh
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card><Statistic title="Total" value={stats.total} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Running" value={stats.running} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Pending / Starting" value={stats.pending} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="Error" value={stats.error} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
      </Row>

      <Table
        dataSource={sessions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 50, showSizeChanger: true }}
        size="small"
      />

      {/* Auth Modal */}
      <Modal
        title={`Authorize Session ${authSession?.id?.slice(0, 8) ?? ''}`}
        open={!!authSession}
        onCancel={() => { setAuthSession(null); cookiesForm.resetFields(); scriptForm.resetFields(); }}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Tabs
          activeKey={authTab}
          onChange={key => setAuthTab(key as 'cookies' | 'script')}
          items={[
            {
              key: 'cookies',
              label: 'Cookies + User-Agent',
              children: (
                <Form form={cookiesForm} layout="vertical" onFinish={handleAuthCookies}>
                  <Form.Item name="service" label="Service" rules={[{ required: true }]}>
                    <Select options={SERVICES} placeholder="Select service" />
                  </Form.Item>
                  <Form.Item name="cookies" label="Cookies (JSON array)" rules={[{ required: true }]}>
                    <Input.TextArea
                      rows={6}
                      placeholder={'[{"name":"sessionid","value":"...","domain":".instagram.com","path":"/"}]'}
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                  </Form.Item>
                  <Form.Item name="userAgent" label="User-Agent (optional)">
                    <Input placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..." />
                  </Form.Item>
                  <Form.Item name="verifyUrl" label="Verify URL (optional)">
                    <Input placeholder="https://www.instagram.com" />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                    <Button type="primary" htmlType="submit" loading={authLoading}>
                      Inject Cookies
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: 'script',
              label: 'Login / Password',
              children: (
                <Form form={scriptForm} layout="vertical" onFinish={handleAuthScript}>
                  <Form.Item name="service" label="Service" rules={[{ required: true }]}>
                    <Select options={SERVICES} placeholder="Select service" />
                  </Form.Item>
                  <Form.Item name="username" label="Username / Email" rules={[{ required: true }]}>
                    <Input placeholder="user@example.com" />
                  </Form.Item>
                  <Form.Item name="password" label="Password" rules={[{ required: true }]}>
                    <Input.Password placeholder="password" />
                  </Form.Item>
                  <Form.Item name="twoFactorSecret" label="TOTP Secret (optional, for Google Authenticator)">
                    <Input placeholder="JBSWY3DPEHPK3PXP" />
                  </Form.Item>
                  <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                    <Button type="primary" htmlType="submit" loading={authLoading}>
                      Start Login
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Modal>

      {/* 2FA Modal */}
      <Modal
        title="2FA Code Required"
        open={!!twoFaSession}
        onOk={handleSubmit2fa}
        onCancel={() => { setTwoFaSession(null); setTwoFaCode(''); }}
        confirmLoading={twoFaLoading}
        okText="Submit Code"
        okButtonProps={{ disabled: twoFaCode.trim().length < 4 }}
      >
        <p>
          Session <strong>{twoFaSession?.id?.slice(0, 8)}</strong> is waiting for an SMS 2FA code.
        </p>
        {twoFaSession?.two_fa_hint && (
          <p style={{ color: '#888' }}>Hint: {twoFaSession.two_fa_hint}</p>
        )}
        <Input
          size="large"
          placeholder="Enter SMS code"
          value={twoFaCode}
          onChange={e => setTwoFaCode(e.target.value)}
          onPressEnter={handleSubmit2fa}
          maxLength={8}
          style={{ textAlign: 'center', letterSpacing: 4, fontSize: 20 }}
          autoFocus
        />
      </Modal>
    </div>
  );
}
