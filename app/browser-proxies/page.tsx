'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Popconfirm, Tooltip, Card, message,
  Modal, Form, Input, InputNumber, Select,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  createBackendClient, tokenStorage,
  type BrowserProxy, type CreateBrowserProxyDto,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';

const PROXY_TYPES = [
  { value: 'manual', label: 'Manual' },
];

const PROXY_PROTOCOLS = [
  { value: 'http',   label: 'HTTP' },
  { value: 'https',  label: 'HTTPS' },
  { value: 'socks4', label: 'SOCKS4' },
  { value: 'socks5', label: 'SOCKS5' },
];

const PROTOCOL_COLORS: Record<string, string> = {
  http: 'blue', https: 'cyan', socks4: 'purple', socks5: 'geekblue',
};

export default function BrowserProxiesPage() {
  const { user } = useAuth();
  const [proxies, setProxies] = useState<BrowserProxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<BrowserProxy | null>(null);
  const [saving, setSaving] = useState(false);
  const [formType, setFormType] = useState<string>('manual');
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
      setProxies(await getClient().getAdminBrowserProxies());
    } catch (err: any) {
      message.error(err.message || 'Error loading proxies');
    } finally {
      setLoading(false);
    }
  }, [user, getClient]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setEditingProxy(null);
    setFormType('manual');
    form.resetFields();
    form.setFieldsValue({ type: 'manual' });
    setModalOpen(true);
  };

  const openEdit = (proxy: BrowserProxy) => {
    setEditingProxy(proxy);
    setFormType(proxy.type);
    form.setFieldsValue({
      label: proxy.label,
      type: proxy.type,
      protocol: proxy.protocol || 'http',
      host: proxy.host,
      port: proxy.port,
      username: proxy.username || '',
      password: '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    let values: any;
    try { values = await form.validateFields(); } catch { return; }

    const dto: CreateBrowserProxyDto = {
      label: values.label,
      type: values.type,
      protocol: values.protocol || 'http',
      host: values.host,
      port: values.port,
      username: values.username || undefined,
      password: values.password || undefined,
    };

    try {
      setSaving(true);
      if (editingProxy) {
        await getClient().updateAdminBrowserProxy(editingProxy.id, dto);
        message.success('Proxy updated');
      } else {
        await getClient().createAdminBrowserProxy(dto);
        message.success('Proxy created');
      }
      setModalOpen(false);
      fetchAll();
    } catch (err: any) {
      message.error(err.message || 'Error saving proxy');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingIds(prev => new Set(prev).add(id));
      await getClient().deleteAdminBrowserProxy(id);
      message.success('Proxy deleted');
      setProxies(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      message.error(err.message || 'Error deleting proxy');
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const columns: ColumnsType<BrowserProxy> = [
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      render: (v: string) => <strong>{v || '—'}</strong>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Protocol',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 90,
      render: (v: string) => <Tag color={PROTOCOL_COLORS[v] || 'default'}>{(v || 'http').toUpperCase()}</Tag>,
    },
    {
      title: 'Host : Port',
      key: 'hostport',
      width: 200,
      render: (_, p) => <code style={{ fontSize: 12 }}>{p.host}:{p.port}</code>,
    },
    {
      title: 'Auth',
      key: 'auth',
      width: 100,
      render: (_, p) => p.username
        ? <Tag color="green">user:***</Tag>
        : <span style={{ color: '#bbb' }}>—</span>,
    },
    {
      title: 'Accounts',
      key: 'accounts',
      render: (_, p) => {
        if (!p.accounts?.length) return <span style={{ color: '#bbb', fontSize: 12 }}>none</span>;
        return (
          <Space size={4} wrap>
            {p.accounts.map(a => (
              <Tag key={a.id} style={{ fontSize: 11, margin: 0 }}>
                {a.platform}/{a.username}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, proxy) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(proxy)} />
          <Popconfirm title="Delete this proxy?" onConfirm={() => handleDelete(proxy.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} loading={deletingIds.has(proxy.id)} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!user) return <Loading />;

  return (
    <Card
      title="Browser Proxies"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Proxy</Button>
        </Space>
      }
    >
      <Table
        dataSource={proxies}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingProxy ? 'Edit Proxy' : 'Add Proxy'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="type" label="Type" rules={[{ required: true }]} initialValue="manual">
              <Select options={PROXY_TYPES} onChange={(v) => setFormType(v)} />
            </Form.Item>
            <Form.Item name="protocol" label="Protocol" initialValue="http">
              <Select options={PROXY_PROTOCOLS} />
            </Form.Item>
          </div>

          <Form.Item name="label" label="Label" rules={[{ required: true, message: 'Label is required' }]}>
            <Input placeholder="My residential proxy" />
          </Form.Item>

          {formType === 'manual' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: '0 12px' }}>
                <Form.Item name="host" label="Host" rules={[{ required: true, message: 'Host is required' }]}>
                  <Input placeholder="proxy.example.com" />
                </Form.Item>
                <Form.Item name="port" label="Port" rules={[{ required: true, message: 'Port required' }]}>
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} placeholder="3128" />
                </Form.Item>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
                <Form.Item name="username" label="Username">
                  <Input placeholder="user" />
                </Form.Item>
                <Form.Item name="password" label="Password" extra={editingProxy ? 'Leave blank to keep current' : undefined}>
                  <Input.Password placeholder="password" />
                </Form.Item>
              </div>
            </>
          )}
        </Form>
      </Modal>
    </Card>
  );
}
