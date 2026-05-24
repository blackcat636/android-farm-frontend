'use client';

import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, Modal, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import {
  createBackendClient,
  tokenStorage,
  type BrowserCapabilityOverride,
  type CreateBrowserCapabilityOverrideDto,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

const VISIBILITY_OPTIONS = [
  { value: 'user', label: 'user' },
  { value: 'admin', label: 'admin' },
  { value: 'operator', label: 'operator' },
  { value: 'internal', label: 'internal' },
  { value: 'hidden', label: 'hidden' },
];

export default function BrowserCatalogOverridesPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [rows, setRows] = useState<BrowserCapabilityOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<CreateBrowserCapabilityOverrideDto>();
  const scopeWatch = Form.useWatch('scope', form);

  const getClient = useCallback(() => {
    const token = tokenStorage.get();
    if (!token) throw new Error('No token');
    return createBackendClient(token);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getClient().getBrowserCapabilityOverrides();
      setRows(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load overrides');
    } finally {
      setLoading(false);
    }
  }, [user, getClient]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await getClient().createBrowserCapabilityOverride(values);
      message.success('Override created');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onToggleEnabled = async (row: BrowserCapabilityOverride, enabled: boolean) => {
    try {
      await getClient().updateBrowserCapabilityOverride(row.id, { enabled });
      load();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const onDelete = async (id: string) => {
    try {
      await getClient().deleteBrowserCapabilityOverride(id);
      message.success('Deleted');
      load();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const columns: ColumnsType<BrowserCapabilityOverride> = [
    { title: 'Scope', dataIndex: 'scope', key: 'scope', width: 100 },
    { title: 'Platform', dataIndex: 'platform', key: 'platform', render: (v) => v || '—' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    {
      title: 'Visibility override',
      dataIndex: 'visibility_override',
      key: 'visibility_override',
      render: (v) => (v ? <Tag>{v}</Tag> : '—'),
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (v, r) => (
        <Switch checked={v} onChange={(checked) => onToggleEnabled(r, checked)} />
      ),
    },
    { title: 'Note', dataIndex: 'note', key: 'note', ellipsis: true },
    {
      title: 'Actions',
      key: 'actions',
      width: 90,
      render: (_, r) => (
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(r.id)} />
      ),
    },
  ];

  if (!user) return <Loading />;
  if (error) return <ErrorDisplay message={error} />;

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Browser catalog overrides
          </Typography.Title>
          <Typography.Text type="secondary">
            Adjust visibility or disable actions/scenarios without redeploying the browser-agent.
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Add override
          </Button>
        </Space>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={{ pageSize: 20, showTotal: (t) => `Total ${t}` }}
      />

      <Modal
        title="New catalog override"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={onSave}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ enabled: true }}>
          <Form.Item name="scope" label="Scope" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'action', label: 'action' },
                { value: 'scenario', label: 'scenario' },
                { value: 'platform', label: 'platform' },
              ]}
            />
          </Form.Item>
          {scopeWatch === 'scenario' && (
            <Form.Item name="platform" label="Platform" rules={[{ required: true }]}>
              <Input placeholder="youtube" />
            </Form.Item>
          )}
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="warmup / run_scenario / youtube" />
          </Form.Item>
          <Form.Item name="visibility_override" label="Visibility override">
            <Select allowClear options={VISIBILITY_OPTIONS} placeholder="Leave empty to only use enabled flag" />
          </Form.Item>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="note" label="Note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
