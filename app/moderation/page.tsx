'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, DatePicker, Select, Space, Table, Tag } from 'antd';
import type { Dayjs } from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import { createBackendClient, tokenStorage, ModerationRequestItem } from '@/lib/api/backend';
import { can } from '@/lib/auth/permissions';

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

const STATUS_OPTIONS = Object.keys(STATUS_COLOR).map((s) => ({ label: s, value: s }));
const KIND_OPTIONS = Object.entries(KIND_LABEL).map(([value, label]) => ({ label, value }));

export default function ModerationPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const router = useRouter();

  const canReview = can((user as any)?.permissions ?? [], 'moderation.review');

  const [rows, setRows] = useState<ModerationRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterKind, setFilterKind] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);
  const [filterDates, setFilterDates] = useState<[Dayjs, Dayjs] | null>(null);

  const client = useMemo(() => {
    const token = tokenStorage.get();
    if (!token) return null;
    return createBackendClient(token);
  }, []);

  const handleApprove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!client) return;
    setActing(id);
    try {
      await client.approveModerationRequest(id);
      message.success('Approved');
      await load();
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || 'Failed');
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!client) return;
    setActing(id);
    try {
      await client.rejectModerationRequest(id);
      message.success('Rejected');
      await load();
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || 'Failed');
    } finally {
      setActing(null);
    }
  };

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

  const platformOptions = useMemo(() => {
    const platforms = Array.from(new Set(rows.map((r) => r.platform).filter(Boolean))) as string[];
    return platforms.map((p) => ({ label: p, value: p }));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (filterStatus.length && !filterStatus.includes(row.status)) return false;
      if (filterKind && row.kind !== filterKind) return false;
      if (filterPlatform && row.platform !== filterPlatform) return false;
      if (filterDates) {
        const created = new Date(row.created_at).getTime();
        const from = filterDates[0].startOf('day').valueOf();
        const to = filterDates[1].endOf('day').valueOf();
        if (created < from || created > to) return false;
      }
      return true;
    });
  }, [rows, filterStatus, filterKind, filterPlatform, filterDates]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Moderation</h1>
      </div>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="Status"
          mode="multiple"
          allowClear
          style={{ minWidth: 220 }}
          options={STATUS_OPTIONS}
          onChange={(v) => setFilterStatus(v)}
        />
        <Select
          placeholder="Kind"
          allowClear
          style={{ minWidth: 190 }}
          options={KIND_OPTIONS}
          onChange={(v) => setFilterKind(v ?? null)}
        />
        <Select
          placeholder="Platform"
          allowClear
          style={{ minWidth: 140 }}
          options={platformOptions}
          onChange={(v) => setFilterPlatform(v ?? null)}
        />
        <DatePicker.RangePicker
          onChange={(dates) => setFilterDates(dates as [Dayjs, Dayjs] | null)}
        />
        <Button onClick={load}>Refresh</Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={filtered}
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
          {
            title: 'Actions',
            render: (_: unknown, row: ModerationRequestItem) => (
              <Space onClick={(e) => e.stopPropagation()}>
                <Button
                  size="small"
                  type="primary"
                  disabled={!canReview || row.status !== 'pending'}
                  loading={acting === row.id}
                  onClick={(e) => handleApprove(e, row.id)}
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  danger
                  disabled={!canReview || row.status !== 'pending'}
                  loading={acting === row.id}
                  onClick={(e) => handleReject(e, row.id)}
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
