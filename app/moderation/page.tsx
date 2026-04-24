'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Table, Tag } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { createBackendClient, tokenStorage, ModerationRequestItem } from '@/lib/api/backend';

const STATUS_COLOR: Record<string, string> = {
  pending: 'orange',
  approved: 'blue',
  rejected: 'red',
  executed: 'green',
  failed: 'volcano',
  awaiting_account: 'gold',
};

const KIND_LABEL: Record<string, string> = {
  'queue.create': 'Queue Task',
  'marketplace_listing.create': 'Marketplace Listing',
  'user_posts.create': 'User Post',
  'user_posts.process': 'User Post Process',
};

export default function ModerationPage() {
  const { message } = App.useApp();
  const { user: _user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<ModerationRequestItem[]>([]);
  const [loading, setLoading] = useState(false);

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
      message.error(error?.response?.data?.message || error?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Moderation</h1>
        <Button onClick={load} size="small">Refresh</Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        onRow={(row) => ({ onClick: () => router.push(`/moderation/${row.id}`), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Kind',
            dataIndex: 'kind',
            render: (v: string) => <Tag>{KIND_LABEL[v] ?? v}</Tag>,
          },
          { title: 'Platform', dataIndex: 'platform', render: (v: string | null) => v ?? '—' },
          { title: 'Action', dataIndex: 'action', render: (v: string | null) => v ?? '—' },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (v: string) => <Tag color={STATUS_COLOR[v] ?? 'default'}>{v}</Tag>,
          },
          {
            title: 'Created',
            dataIndex: 'created_at',
            render: (v: string) => new Date(v).toLocaleString(),
            sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            defaultSortOrder: 'descend',
          },
          {
            title: 'User',
            dataIndex: 'user_id',
            render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v?.slice(0, 8)}…</span>,
          },
        ]}
      />
    </div>
  );
}
