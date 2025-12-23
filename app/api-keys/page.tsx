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
  Typography,
  Tag,
  Alert,
  Tooltip,
  Input as AntInput,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  createBackendClient,
  tokenStorage,
  authApi,
  type ApiKey,
  type CreateApiKeyDto,
  type CreateApiKeyResponse,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';
import {
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CopyOutlined,
  KeyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
const { Title } = Typography;
const { TextArea } = Input;

export default function ApiKeysPage() {
  const { user } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newKeyModalVisible, setNewKeyModalVisible] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchApiKeys = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const keys = await authApi.getApiKeys();
      setApiKeys(keys || []);
    } catch (err: any) {
      setError(err.message || 'Error loading API keys');
      message.error(err.message || 'Error loading API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, [user]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const response = await authApi.createApiKey({
        name: values.name,
      });

      setNewKey(response.api_key);
      setCreateModalVisible(false);
      setNewKeyModalVisible(true);
      form.resetFields();
      fetchApiKeys();
    } catch (err: any) {
      message.error(err.message || 'Error creating API key');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      await authApi.deleteApiKey(id);
      message.success('API key deleted');
      fetchApiKeys();
    } catch (err: any) {
      message.error(err.message || 'Error deleting API key');
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    message.success('API key copied to clipboard');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const columns: ColumnsType<ApiKey> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => name || <span style={{ color: '#999' }}>Unnamed</span>,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => formatDate(date),
    },
    {
      title: 'Last Used',
      dataIndex: 'last_used_at',
      key: 'last_used_at',
      render: (date: string) => formatDate(date),
    },
    {
      title: 'Expires',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (date: string, record) => {
        if (!date) {
          return <Tag color="green">No limit</Tag>;
        }
        if (isExpired(date)) {
          return <Tag color="red">Expired</Tag>;
        }
        return <Tag color="orange">Until {formatDate(date)}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm
          title="Delete API key?"
          description="Are you sure you want to delete this API key? It will stop working after deletion."
          onConfirm={() => handleDelete(record.id)}
          okText="Yes"
          cancelText="No"
        >
          <Button danger icon={<DeleteOutlined />} size="small">
            Delete
          </Button>
        </Popconfirm>
      ),
    },
  ];

  if (loading && !apiKeys.length) {
    return <Loading />;
  }

  if (error && !apiKeys.length) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>
          <KeyOutlined /> API Keys
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
          size="large"
        >
          Create API Key
        </Button>
      </div>

      <Alert
        title="API Key Security"
        description="API keys provide full access to your account. Keep them secure and do not share them with others. If a key is compromised, delete it immediately."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card style={{ marginBottom: 24 }}>
        <Typography.Title level={4}>How to use API key</Typography.Title>
        <Typography.Paragraph>
          API key is an alternative to Bearer token for authentication. Add the <Typography.Text code>X-API-Key</Typography.Text> header to each HTTP request.
        </Typography.Paragraph>
        
        <Typography.Title level={5} style={{ marginTop: 16 }}>Header name</Typography.Title>
        <Typography.Paragraph>
          Use header: <Typography.Text code strong>X-API-Key</Typography.Text>
        </Typography.Paragraph>

        <Typography.Title level={5} style={{ marginTop: 16 }}>Examples</Typography.Title>
        
        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>cURL:</Typography.Text>
          <pre style={{ marginTop: 8, marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, fontSize: '12px', overflow: 'auto' }}>
{`curl -H "X-API-Key: your_key" \\
  ${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/queue`}
          </pre>
        </div>

        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>JavaScript (fetch):</Typography.Text>
          <pre style={{ marginTop: 8, marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, fontSize: '12px', overflow: 'auto' }}>
{`fetch('${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/queue', {
  headers: {
    'X-API-Key': 'your_key'
  }
})`}
          </pre>
        </div>

        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>Python (requests):</Typography.Text>
          <pre style={{ marginTop: 8, marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, fontSize: '12px', overflow: 'auto' }}>
{`import requests

response = requests.get(
    '${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/queue',
    headers={'X-API-Key': 'your_key'}
)`}
          </pre>
        </div>

        <Alert
          title="Important"
          description="API key can be used instead of Bearer token. If the request has X-API-Key header, it takes priority over Authorization: Bearer. All endpoints support both authentication methods."
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Card>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={fetchApiKeys}>
            Refresh
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={apiKeys}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: 'No API keys. Create your first key to get started.' }}
        />
      </Card>

      {/* Модальне вікно створення ключа */}
      <Modal
        title="Create New API Key"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={handleCreate}
        okText="Create"
        cancelText="Cancel"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Key name"
            tooltip="Name will help you identify the key (e.g., 'Production API', 'Development')"
          >
            <Input placeholder="Enter key name" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальне вікно з новим ключем */}
      <Modal
        title="New API Key Created"
        open={newKeyModalVisible}
        onCancel={() => {
          setNewKeyModalVisible(false);
          setNewKey(null);
        }}
        footer={[
          <Button
            key="copy"
            type="primary"
            icon={<CopyOutlined />}
            onClick={() => newKey && handleCopyKey(newKey)}
          >
            Copy Key
          </Button>,
          <Button key="close" onClick={() => {
            setNewKeyModalVisible(false);
            setNewKey(null);
          }}>
            Close
          </Button>,
        ]}
        width={600}
      >
        <Alert
          title="Important!"
          description="This API key will be shown only once. Be sure to copy it and save it in a secure place. After closing this window, you will not be able to see the key again."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
          <Form.Item label="Your API key">
          <Input.Group compact>
            <AntInput
              value={newKey || ''}
              readOnly
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
            <Button
              icon={<CopyOutlined />}
              onClick={() => newKey && handleCopyKey(newKey)}
            >
              Copy
            </Button>
          </Input.Group>
        </Form.Item>
        
        <div style={{ marginTop: 24 }}>
          <Typography.Title level={5}>How to use API key</Typography.Title>
          <Typography.Paragraph>
            API key is an alternative to Bearer token for authentication. Add the <Typography.Text code>X-API-Key</Typography.Text> header to each request.
          </Typography.Paragraph>

          <Typography.Title level={5} style={{ marginTop: 16 }}>Header name</Typography.Title>
          <Typography.Paragraph>
            Use header: <Typography.Text code strong>X-API-Key</Typography.Text>
          </Typography.Paragraph>

          <Typography.Title level={5} style={{ marginTop: 16 }}>Usage examples</Typography.Title>
          
          <div style={{ marginTop: 12 }}>
            <Typography.Text strong>cURL:</Typography.Text>
            <pre style={{ marginTop: 8, marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, fontSize: '12px', overflow: 'auto' }}>
{`curl -H "X-API-Key: ${newKey}" \\
  ${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/queue`}
            </pre>
          </div>

          <div style={{ marginTop: 12 }}>
            <Typography.Text strong>JavaScript (fetch):</Typography.Text>
            <pre style={{ marginTop: 8, marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, fontSize: '12px', overflow: 'auto' }}>
{`fetch('${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/queue', {
  headers: {
    'X-API-Key': '${newKey}'
  }
})
.then(response => response.json())
.then(data => console.log(data));`}
            </pre>
          </div>

          <div style={{ marginTop: 12 }}>
            <Typography.Text strong>JavaScript (axios):</Typography.Text>
            <pre style={{ marginTop: 8, marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, fontSize: '12px', overflow: 'auto' }}>
{`import axios from 'axios';

axios.get('${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/queue', {
  headers: {
    'X-API-Key': '${newKey}'
  }
})
.then(response => console.log(response.data));`}
            </pre>
          </div>

          <div style={{ marginTop: 12 }}>
            <Typography.Text strong>Python (requests):</Typography.Text>
            <pre style={{ marginTop: 8, marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, fontSize: '12px', overflow: 'auto' }}>
{`import requests

headers = {
    'X-API-Key': '${newKey}'
}

response = requests.get(
    '${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/queue',
    headers=headers
)
print(response.json())`}
            </pre>
          </div>

          <div style={{ marginTop: 12 }}>
            <Typography.Text strong>Node.js (axios):</Typography.Text>
            <pre style={{ marginTop: 8, marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4, fontSize: '12px', overflow: 'auto' }}>
{`const axios = require('axios');

axios.get('${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/queue', {
  headers: {
    'X-API-Key': '${newKey}'
  }
})
.then(response => console.log(response.data));`}
            </pre>
          </div>

          <Alert
          title="Note"
          description="API key can be used instead of Bearer token. If the request has X-API-Key header, it takes priority over Authorization: Bearer."
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </div>
      </Modal>
    </div>
  );
}
