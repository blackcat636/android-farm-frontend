'use client';

import { useState, useEffect } from 'react';
import { Table, Tag, Select, DatePicker, Card, Statistic, Row, Col } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useRouter } from 'next/navigation';
import { createBackendClient, tokenStorage, type ExecutionHistory } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

const { RangePicker } = DatePicker;

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<ExecutionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [filters, setFilters] = useState({
    status: undefined as 'pending' | 'success' | 'error' | undefined,
    platform: undefined as string | undefined,
  });

  useEffect(() => {
    const fetchHistory = async () => {
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
        const response = await backendClient.getHistory({
          user_id: user.id,
          status: filters.status,
          platform: filters.platform,
          page: 1,
          limit: 100,
        });
        setHistory(response.data);

        const statsData = await backendClient.getHistoryStats(undefined, user.id);
        setStats(statsData);
      } catch (err: any) {
        setError(err.message || 'Error loading history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user, filters.status, filters.platform]);

  const columns: ColumnsType<ExecutionHistory> = [
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
      title: 'Emulator',
      dataIndex: 'emulator_name',
      key: 'emulator_name',
      render: (text, record) => text || record.emulator_id,
    },
    {
      title: 'Account',
      dataIndex: 'account',
      key: 'account',
      render: (account, record) => {
        if (account) {
          return (
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                router.push('/accounts');
              }}
              style={{ color: '#1890ff' }}
            >
              {account.username} {account.email && `(${account.email})`}
            </a>
          );
        }
        return '-';
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors: Record<string, string> = {
          success: 'green',
          error: 'red',
          pending: 'orange',
        };
        return <Tag color={colors[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Duration',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      render: (ms) => ms ? `${(ms / 1000).toFixed(2)}с` : '-',
    },
    {
      title: 'Date',
      dataIndex: 'started_at',
      key: 'started_at',
      render: (text) => new Date(text).toLocaleString('en-US'),
    },
  ];

  if (loading && !history.length) {
    return <Loading />;
  }

  if (error && !history.length) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div>
      <h1>Execution History</h1>
      
      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="Total" value={stats.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Success" value={stats.success} styles={{ content: { color: '#3f8600' } }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Errors" value={stats.error} styles={{ content: { color: '#cf1322' } }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Pending" value={stats.pending} styles={{ content: { color: '#faad14' } }} />
            </Card>
          </Col>
        </Row>
      )}

      <Card style={{ marginBottom: 16 }}>
        <Select
          placeholder="Filter by status"
          style={{ width: 200, marginRight: 8 }}
          allowClear
          value={filters.status}
          onChange={(value) => setFilters({ ...filters, status: value })}
        >
          <Select.Option value="success">Success</Select.Option>
          <Select.Option value="error">Errors</Select.Option>
          <Select.Option value="pending">Pending</Select.Option>
        </Select>
      </Card>

      <Table
        columns={columns}
        dataSource={history}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
              {record.result && (
                <div style={{ marginBottom: 12 }}>
                  <h4>Result</h4>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(record.result, null, 2)}
                  </pre>
                </div>
              )}
              {record.params && (
                <div>
                  <h4>Parameters</h4>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(record.params, null, 2)}
                  </pre>
                </div>
              )}
              {!record.result && !record.params && <div>No details</div>}
            </div>
          ),
        }}
      />
    </div>
  );
}

