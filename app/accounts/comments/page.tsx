'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Select, Input, Card, Button, Space, Typography, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBackendClient, tokenStorage, type AccountCommentWithAccount } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';
import { ReloadOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const { Title } = Typography;
const { RangePicker } = DatePicker;

const PLATFORMS = ['instagram', 'youtube', 'tiktok', 'facebook', 'twitter'];
const SOURCE_COLORS: Record<string, string> = { agent: 'blue', admin: 'green', system: 'orange' };

export default function AccountCommentsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [comments, setComments] = useState<AccountCommentWithAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [filters, setFilters] = useState<{
    source?: string;
    platform?: string;
    date_from?: string;
    date_to?: string;
  }>({});

  const fetchComments = useCallback(async (p = page) => {
    const token = tokenStorage.get();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const client = createBackendClient(token);
      const res = await client.getAllComments({
        ...filters,
        page: p,
        limit: pageSize,
      });
      setComments(res.data);
      setTotal(res.total);
    } catch (err: any) {
      setError(err.message || 'Error loading comments');
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    if (user) fetchComments(1);
  }, [user, filters]);

  const columns: ColumnsType<AccountCommentWithAccount> = [
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (v) => new Date(v).toLocaleString(),
      sorter: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Account',
      key: 'account',
      width: 200,
      render: (_, record) => {
        const acc = record.social_accounts;
        if (!acc) return <span style={{ color: '#999' }}>—</span>;
        return (
          <Link href={`/accounts/${acc.id}?tab=comments`}>
            <Space>
              <UserOutlined />
              <span>{acc.username}</span>
              <Tag color="blue" style={{ marginLeft: 0 }}>{acc.platform}</Tag>
            </Space>
          </Link>
        );
      },
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 90,
      render: (v) => <Tag color={SOURCE_COLORS[v] ?? 'default'}>{v}</Tag>,
    },
    {
      title: 'Comment',
      dataIndex: 'text',
      key: 'text',
      render: (text, record) => (
        <div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
          {record.metadata && (
            <details style={{ marginTop: 4 }}>
              <summary style={{ fontSize: 11, color: '#888', cursor: 'pointer' }}>metadata</summary>
              <pre style={{ fontSize: 11, margin: 0, color: '#666' }}>
                {JSON.stringify(record.metadata, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ),
    },
  ];

  if (!user) return <Loading />;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Account Comments</Title>
        <Button icon={<ReloadOutlined />} onClick={() => fetchComments(1)}>Refresh</Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder="Source"
            style={{ width: 130 }}
            value={filters.source}
            onChange={(v) => setFilters((f) => ({ ...f, source: v }))}
          >
            <Option value="agent">agent</Option>
            <Option value="admin">admin</Option>
            <Option value="system">system</Option>
          </Select>

          <Select
            allowClear
            placeholder="Platform"
            style={{ width: 140 }}
            value={filters.platform}
            onChange={(v) => setFilters((f) => ({ ...f, platform: v }))}
          >
            {PLATFORMS.map((p) => (
              <Option key={p} value={p}>{p}</Option>
            ))}
          </Select>

          <RangePicker
            showTime
            style={{ width: 370 }}
            onChange={(dates) => {
              if (!dates) {
                setFilters((f) => ({ ...f, date_from: undefined, date_to: undefined }));
              } else {
                setFilters((f) => ({
                  ...f,
                  date_from: dates[0]?.toISOString(),
                  date_to: dates[1]?.toISOString(),
                }));
              }
            }}
          />
        </Space>
      </Card>

      {error ? (
        <ErrorDisplay message={error} />
      ) : (
        <Table
          columns={columns}
          dataSource={comments}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: ['25', '50', '100'],
            showTotal: (t) => `Total: ${t}`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
              fetchComments(p);
            },
          }}
        />
      )}
    </div>
  );
}
