'use client';

import { useState, useEffect } from 'react';
import { 
  Table, 
  Tag, 
  Card, 
  Button, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Switch, 
  Popconfirm,
  message,
  Typography,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { 
  DeleteOutlined, 
  PlusOutlined, 
  EditOutlined, 
  ReloadOutlined,
  StopOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { createBackendClient, tokenStorage, type BlacklistEntry, type CreateBlacklistEntryDto, type UpdateBlacklistEntryDto } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

const { TextArea } = Input;
const { Title } = Typography;

export default function BlacklistPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BlacklistEntry | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchEntries = async () => {
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

      const backendClient = createBackendClient(token);
      const data = await backendClient.getBlacklist();
      setEntries(data || []);
    } catch (err: any) {
      setError(err.message || 'Error loading blacklist');
      message.error(err.message || 'Error loading blacklist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchEntries();
    }
  }, [user]);

  const handleCreate = async (values: any) => {
    try {
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      // Обробка params як JSON рядка
      let params = {};
      if (values.params && typeof values.params === 'string' && values.params.trim()) {
        try {
          params = JSON.parse(values.params);
        } catch (e) {
          message.error('Invalid JSON in parameters field');
          return;
        }
      } else if (values.params && typeof values.params === 'object') {
        params = values.params;
      }

      const createData: CreateBlacklistEntryDto = {
        ...values,
        params: Object.keys(params).length > 0 ? params : undefined,
      };

      const backendClient = createBackendClient(token);
      await backendClient.createBlacklistEntry(createData);
      message.success('Blacklist entry created');
      setIsModalVisible(false);
      form.resetFields();
      fetchEntries();
    } catch (err: any) {
      message.error(err.message || 'Error creating blacklist entry');
    }
  };

  const handleUpdate = async (values: UpdateBlacklistEntryDto) => {
    if (!editingEntry) return;

    try {
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      await backendClient.updateBlacklistEntry(editingEntry.id, values);
      message.success('Blacklist entry updated');
      setIsEditModalVisible(false);
      setEditingEntry(null);
      editForm.resetFields();
      fetchEntries();
    } catch (err: any) {
      message.error(err.message || 'Error updating blacklist entry');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      await backendClient.deleteBlacklistEntry(id);
      message.success('Blacklist entry deleted');
      fetchEntries();
    } catch (err: any) {
      message.error(err.message || 'Error deleting blacklist entry');
    }
  };

  const handleEdit = (entry: BlacklistEntry) => {
    setEditingEntry(entry);
    editForm.setFieldsValue({
      reason: entry.reason,
      is_active: entry.is_active,
      match_params_exactly: entry.match_params_exactly,
    });
    setIsEditModalVisible(true);
  };

  const getStatusTag = (isActive: boolean) => {
    return isActive ? (
      <Tag color="red" icon={<StopOutlined />}>Active</Tag>
    ) : (
      <Tag color="green" icon={<CheckCircleOutlined />}>Inactive</Tag>
    );
  };

  const columns: ColumnsType<BlacklistEntry> = [
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
    },
    {
      title: 'Account ID',
      dataIndex: 'account_id',
      key: 'account_id',
      render: (text) => text ? <Tag color="purple">{text.substring(0, 8)}...</Tag> : <Tag color="gray">Any</Tag>,
    },
    {
      title: 'Emulator ID',
      dataIndex: 'emulator_id',
      key: 'emulator_id',
      render: (text) => text ? <Tag>{text}</Tag> : <Tag color="gray">Any</Tag>,
    },
    {
      title: 'Agent ID',
      dataIndex: 'agent_id',
      key: 'agent_id',
      render: (text) => text ? <Tag>{text}</Tag> : <Tag color="gray">Any</Tag>,
    },
    {
      title: 'Params',
      dataIndex: 'params',
      key: 'params',
      render: (params) => {
        if (!params || Object.keys(params).length === 0) {
          return <Tag color="gray">None</Tag>;
        }
        return (
          <Tag color="orange" title={JSON.stringify(params, null, 2)}>
            {Object.keys(params).length} param(s)
          </Tag>
        );
      },
    },
    {
      title: 'Match Type',
      dataIndex: 'match_params_exactly',
      key: 'match_params_exactly',
      render: (exact) => (
        <Tag color={exact ? 'red' : 'orange'}>
          {exact ? 'Exact' : 'Partial'}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive) => getStatusTag(isActive),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (text) => text || <Tag color="gray">-</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString('uk-UA'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: BlacklistEntry) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Delete blacklist entry?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading && !entries.length) {
    return <Loading />;
  }

  if (error && !entries.length) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>Task Blacklist</Title>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchEntries}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalVisible(true)}
          >
            Add Entry
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={entries}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} entries`,
          }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ margin: 0 }}>
                <p><strong>Entry ID:</strong> {record.id}</p>
                {record.user_id && (
                  <p><strong>User ID:</strong> {record.user_id}</p>
                )}
                {record.params && Object.keys(record.params).length > 0 && (
                  <div>
                    <p><strong>Parameters:</strong></p>
                    <pre style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                      {JSON.stringify(record.params, null, 2)}
                    </pre>
                  </div>
                )}
                {record.reason && (
                  <p><strong>Reason:</strong> {record.reason}</p>
                )}
                <p><strong>Created:</strong> {new Date(record.created_at).toLocaleString('uk-UA')}</p>
                {record.created_by && (
                  <p><strong>Created by:</strong> {record.created_by}</p>
                )}
              </div>
            ),
          }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Add Blacklist Entry"
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            name="platform"
            label="Platform"
            rules={[{ required: true, message: 'Please select platform' }]}
          >
            <Select placeholder="Select platform">
              <Select.Option value="instagram">Instagram</Select.Option>
              <Select.Option value="youtube">YouTube</Select.Option>
              <Select.Option value="tiktok">TikTok</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="action"
            label="Action"
            rules={[{ required: true, message: 'Please enter action' }]}
          >
            <Input placeholder="e.g., like, post, search" />
          </Form.Item>

          <Form.Item
            name="params"
            label="Parameters (JSON)"
            tooltip="Optional: Parameters to match. Leave empty to block all tasks with this platform/action."
          >
            <TextArea
              rows={4}
              placeholder='{"postUrl": "https://..."}'
            />
          </Form.Item>

          <Form.Item
            name="account_id"
            label="Account ID (Optional)"
            tooltip="Leave empty to block for all accounts"
          >
            <Input placeholder="UUID" />
          </Form.Item>

          <Form.Item
            name="emulator_id"
            label="Emulator ID (Optional)"
            tooltip="Leave empty to block for all emulators"
          >
            <Input placeholder="Emulator ID" />
          </Form.Item>

          <Form.Item
            name="agent_id"
            label="Agent ID (Optional)"
            tooltip="Leave empty to block for all agents"
          >
            <Input placeholder="Agent ID" />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Reason"
          >
            <TextArea rows={2} placeholder="Why is this task blacklisted?" />
          </Form.Item>

          <Form.Item
            name="match_params_exactly"
            label="Match Parameters Exactly"
            valuePropName="checked"
            initialValue={false}
            tooltip="If checked, all params must match exactly. If unchecked, only specified params need to match."
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create
              </Button>
              <Button onClick={() => {
                setIsModalVisible(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Edit Blacklist Entry"
        open={isEditModalVisible}
        onCancel={() => {
          setIsEditModalVisible(false);
          setEditingEntry(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Form.Item
            name="reason"
            label="Reason"
          >
            <TextArea rows={2} placeholder="Why is this task blacklisted?" />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Active"
            valuePropName="checked"
            tooltip="Inactive entries won't block tasks"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="match_params_exactly"
            label="Match Parameters Exactly"
            valuePropName="checked"
            tooltip="If checked, all params must match exactly. If unchecked, only specified params need to match."
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Update
              </Button>
              <Button onClick={() => {
                setIsEditModalVisible(false);
                setEditingEntry(null);
                editForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

