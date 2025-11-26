'use client';

import { useEffect, useState } from 'react';
import { Table, Tag, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type Emulator, createAgentApi } from '@/lib/api/agent';
import { useActiveAgentApi } from '@/hooks/useActiveAgentApi';
import { useAgents } from '@/contexts/AgentsContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

type ViewMode = 'active' | 'all';

export default function EmulatorsPage() {
  const { agentApi, activeAgent } = useActiveAgentApi();
  const { agents } = useAgents();
  const [emulators, setEmulators] = useState<Emulator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('active');

  useEffect(() => {
    const fetchEmulators = async () => {
      try {
        setLoading(true);
        setError(null);

        if (viewMode === 'active') {
          // Режим "Активний агент"
          if (!activeAgent) {
            setError('Агент не вибрано. Будь ласка, додайте та виберіть агента.');
            setLoading(false);
            return;
          }

          const response = await agentApi.getEmulators();
          setEmulators(response.emulators);
        } else {
          // Режим "Всі агенти"
          if (agents.length === 0) {
            setError('Агенти не знайдені. Будь ласка, додайте хоча б одного агента.');
            setLoading(false);
            return;
          }

          const useTunnel = process.env.NEXT_PUBLIC_USE_TUNNEL === 'true';
          const allEmulators: Emulator[] = [];

          // Збираємо емулятори з усіх агентів паралельно
          const emulatorPromises = agents.map(async (agent) => {
            try {
              // Визначаємо baseURL для агента
              const baseURL = (useTunnel && agent.tunnelUrl)
                ? agent.tunnelUrl
                : agent.url || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

              const api = createAgentApi(baseURL);
              const response = await api.getEmulators();

              // Додаємо назву агента до кожного емулятора
              return response.emulators.map(emulator => ({
                ...emulator,
                agentName: agent.name,
              }));
            } catch (err: any) {
              console.error(`Помилка завантаження емуляторів з агента ${agent.name}:`, err.message);
              return []; // Повертаємо порожній масив при помилці
            }
          });

          const results = await Promise.all(emulatorPromises);
          // Об'єднуємо всі емулятори в один масив
          allEmulators.push(...results.flat());
          setEmulators(allEmulators);
        }
      } catch (err: any) {
        setError(err.message || 'Помилка завантаження емуляторів');
      } finally {
        setLoading(false);
      }
    };

    fetchEmulators();
  }, [viewMode, activeAgent, agentApi, agents]);

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
      render: (_: any, record: Emulator) => record.agentName || activeAgent?.name || 'Unknown',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Emulators</h1>
        <Radio.Group
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
          size="large"
        >
          <Radio.Button value="active">Активний агент</Radio.Button>
          <Radio.Button value="all">Всі агенти</Radio.Button>
        </Radio.Group>
      </div>
      <Table
        columns={columns}
        dataSource={emulators}
        rowKey={(record) => `${record.agentName || 'unknown'}-${record.id}`}
        pagination={false}
        style={{ marginTop: 24 }}
      />
    </div>
  );
}

