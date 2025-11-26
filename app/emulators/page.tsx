'use client';

import { useEffect, useState } from 'react';
import { Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type Emulator } from '@/lib/api/agent';
import { useActiveAgentApi } from '@/hooks/useActiveAgentApi';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

export default function EmulatorsPage() {
  const { agentApi, activeAgent } = useActiveAgentApi();
  const [emulators, setEmulators] = useState<Emulator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeAgent) {
      setError('Агент не вибрано. Будь ласка, додайте та виберіть агента.');
      setLoading(false);
      return;
    }

    const fetchEmulators = async () => {
      try {
        setLoading(true);
        const response = await agentApi.getEmulators();
        setEmulators(response.emulators);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Помилка завантаження емуляторів');
      } finally {
        setLoading(false);
      }
    };

    fetchEmulators();
  }, [agentApi, activeAgent]);

  const columns: ColumnsType<Emulator> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Назва',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Агент',
      key: 'agent',
      render: () => activeAgent?.name || 'Unknown',
    },
    {
      title: 'UDID',
      dataIndex: 'udid',
      key: 'udid',
      render: (udid: string) => (
        <span style={{ fontSize: '12px', color: '#666' }}>{udid}</span>
      ),
    },
    {
      title: 'Device Name',
      dataIndex: 'deviceName',
      key: 'deviceName',
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>{status}</Tag>
      ),
    },
  ];

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div>
      <h1>Emulators</h1>
      <Table
        columns={columns}
        dataSource={emulators}
        rowKey="id"
        pagination={false}
        style={{ marginTop: 24 }}
      />
    </div>
  );
}

