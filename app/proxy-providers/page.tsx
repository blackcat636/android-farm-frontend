'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  message,
  Popconfirm,
  Modal,
  Form,
  Input,
  Switch,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  createBackendClient,
  tokenStorage,
  type ProxyProvider,
  type CreateProxyProviderDto,
  type UpdateProxyProviderDto,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

export default function ProxyProvidersPage() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<ProxyProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProxyProvider | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fetchProviders = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const client = createBackendClient(token);
      const data = await client.getProxyProviders();
      setProviders(data || []);
    } catch (err: any) {
      setError(err.message || 'Error loading proxy providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [user]);

  const handleCreate = () => {
    setEditingProvider(null);
    form.resetFields();
    form.setFieldsValue({ type: 'proxy-service', is_active: true });
    setModalVisible(true);
  };

  const handleEdit = (record: ProxyProvider) => {
    setEditingProvider(record);
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      baseUrl: (record.config as any)?.baseUrl || '',
      apiKey: (record.config as any)?.apiKey || '',
      is_active: record.is_active,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const client = createBackendClient(token);

      const config = { baseUrl: values.baseUrl, apiKey: values.apiKey };

      if (editingProvider) {
        await client.updateProxyProvider(editingProvider.id, {
          name: values.name,
          type: values.type,
          config,
          is_active: values.is_active,
        } as UpdateProxyProviderDto);
        message.success('Provider updated');
      } else {
        await client.createProxyProvider({
          name: values.name,
          type: values.type,
          config,
          is_active: values.is_active,
        } as CreateProxyProviderDto);
        message.success('Provider created');
      }
      setModalVisible(false);
      fetchProviders();
    } catch (err: any) {
      message.error(err.message || 'Error saving');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const client = createBackendClient(token);
      await client.deleteProxyProvider(id);
      message.success('Provider deleted');
      fetchProviders();
    } catch (err: any) {
      message.error(err.message || 'Error deleting');
    }
  };

  const columns: ColumnsType<ProxyProvider> = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    {
      title: 'Base URL',
      key: 'baseUrl',
      render: (_, r) => (r.config as any)?.baseUrl || '-',
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (v: boolean) => (v ? 'Yes' : 'No'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete provider?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading && !providers.length) return <Loading />;
  if (error && !providers.length) return <ErrorDisplay message={error} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Proxy Providers</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Add Provider
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={providers}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingProvider ? 'Edit Provider' : 'Add Proxy Provider'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. My Proxy Service" />
          </Form.Item>
          <Form.Item name="type" label="Type">
            <Input disabled value="proxy-service" />
          </Form.Item>
          <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true }]}>
            <Input placeholder="http://localhost:3000" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true }]}>
            <Input.Password placeholder="API key for proxy-service" />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
