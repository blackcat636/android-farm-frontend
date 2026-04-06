'use client';

import { useEffect, useMemo, useState } from 'react';
import { App, Button, Input, Space, Table, Tag } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { createBackendClient, tokenStorage, ModerationRequestItem } from '@/lib/api/backend';
import { can } from '@/lib/auth/permissions';

export default function ModerationPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [rows, setRows] = useState<ModerationRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');

  const canReview = can((user as any)?.permissions ?? [], 'moderation.review');

  const client = useMemo(() => {
    const token = tokenStorage.get();
    if (!token) return null;
    return createBackendClient(token);
  }, []);

  const load = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const data = await client.getModerationRequests();
      setRows(data);
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || 'Failed to load moderation requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const handleApprove = async (id: string) => {
    if (!client) return;
    await client.approveModerationRequest(id, note || undefined);
    message.success('Moderation request approved');
    await load();
  };

  const handleReject = async (id: string) => {
    if (!client) return;
    await client.rejectModerationRequest(id, note || undefined);
    message.success('Moderation request rejected');
    await load();
  };

  return (
    <div>
      <h1>Moderation</h1>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Review note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ width: 320 }}
        />
        <Button onClick={load}>Refresh</Button>
      </Space>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          { title: 'Kind', dataIndex: 'kind' },
          { title: 'Platform', dataIndex: 'platform' },
          { title: 'Action', dataIndex: 'action' },
          { title: 'Required Permission', dataIndex: 'required_permission' },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (value: string) => <Tag>{value}</Tag>,
          },
          {
            title: 'Actions',
            render: (_, row) => (
              <Space>
                <Button
                  size="small"
                  type="primary"
                  disabled={!canReview || row.status !== 'pending'}
                  onClick={() => handleApprove(row.id)}
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  danger
                  disabled={!canReview || row.status !== 'pending'}
                  onClick={() => handleReject(row.id)}
                >
                  Reject
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}
