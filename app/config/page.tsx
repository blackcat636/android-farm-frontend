'use client';

import { useState, useEffect } from 'react';
import { Table, Card, Button, Tag, Modal, Input, Space, Popconfirm, message, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage, type AppConfigEntry } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

const { Text } = Typography;

const sourceColors: Record<string, string> = {
  db: 'blue',
  env: 'green',
  default: 'default',
};

const sourceLabels: Record<string, string> = {
  db: 'DB',
  env: 'ENV',
  default: 'default',
};

export default function ConfigPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AppConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchConfig = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const client = createBackendClient(token);
      const data = await client.getAppConfig();
      setEntries(data);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Error loading config';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (entry: AppConfigEntry) => {
    setEditKey(entry.key);
    setEditValue(entry.rawValue);
  };

  const handleSave = async () => {
    if (!editKey) return;
    try {
      setSaving(true);
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const client = createBackendClient(token);
      await client.setAppConfig(editKey, editValue);
      message.success(`${editKey} updated`);
      setEditKey(null);
      await fetchConfig();
    } catch (err: any) {
      message.error(err?.response?.data?.message || err.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (key: string) => {
    try {
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const client = createBackendClient(token);
      await client.deleteAppConfig(key);
      message.success(`${key} reset to ENV/default`);
      await fetchConfig();
    } catch (err: any) {
      message.error(err?.response?.data?.message || err.message || 'Error resetting');
    }
  };

  useEffect(() => {
    if (user) fetchConfig();
  }, [user]);

  const columns: ColumnsType<AppConfigEntry> = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: 260,
      render: (key: string) => <Text code style={{ fontSize: 13 }}>{key}</Text>,
    },
    {
      title: 'Value',
      dataIndex: 'rawValue',
      key: 'rawValue',
      width: 200,
      render: (raw: string, record) => (
        <Text style={{ fontFamily: 'monospace', color: record.source === 'db' ? '#1677ff' : undefined }}>
          {raw || <Text type="secondary">—</Text>}
        </Text>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 90,
      render: (source: string) => (
        <Tag color={sourceColors[source]}>{sourceLabels[source]}</Tag>
      ),
      filters: [
        { text: 'DB', value: 'db' },
        { text: 'ENV', value: 'env' },
        { text: 'Default', value: 'default' },
      ],
      onFilter: (value, record) => record.source === value,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => <Text type="secondary">{type}</Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => <Text type="secondary" style={{ fontSize: 12 }}>{desc}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      render: (_: unknown, record: AppConfigEntry) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          />
          {record.source === 'db' && (
            <Popconfirm
              title={`Reset ${record.key}?`}
              description="Value will fall back to ENV or default."
              onConfirm={() => handleReset(record.key)}
              okText="Reset"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" icon={<DeleteOutlined />} size="small" danger />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (loading && !entries.length) return <Loading />;
  if (error && !entries.length) return <ErrorDisplay message={error} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Config</h1>
        <Button icon={<ReloadOutlined />} onClick={fetchConfig} loading={loading}>
          Refresh
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={entries}
          rowKey="key"
          loading={loading}
          pagination={false}
          size="middle"
          rowClassName={(record) => record.source === 'db' ? 'config-row-db' : ''}
        />
      </Card>

      <Modal
        title={`Edit: ${editKey}`}
        open={!!editKey}
        onOk={handleSave}
        onCancel={() => setEditKey(null)}
        confirmLoading={saving}
        okText="Save"
        width={480}
      >
        {editKey && (
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {entries.find(e => e.key === editKey)?.description}
              </Text>
            </div>
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onPressEnter={handleSave}
              autoFocus
              placeholder="Value (always stored as string)"
              addonBefore={<Text type="secondary" style={{ fontSize: 12 }}>{entries.find(e => e.key === editKey)?.type}</Text>}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
