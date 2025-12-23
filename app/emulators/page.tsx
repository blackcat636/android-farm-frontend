'use client';

import { useEffect, useState } from 'react';
import { Table, Tag, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { type Emulator } from '@/lib/api/agent';
import { useBackendAgentApi } from '@/hooks/useBackendAgentApi';
import { useAgents } from '@/contexts/AgentsContext';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

type ViewMode = 'active' | 'all';

export default function EmulatorsPage() {
  const { backendClient, activeAgent } = useBackendAgentApi();
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

        if (!backendClient) {
          setError('Authorization required');
          setLoading(false);
          return;
        }

        if (viewMode === 'active') {
          // Режим "Активний агент"
          if (!activeAgent) {
            setError('Agent not selected. Please add and select an agent.');
            setLoading(false);
            return;
          }

          const response = await backendClient.getEmulators(activeAgent.id);
          setEmulators(response.emulators || []);
        } else {
          // Режим "Всі агенти"
          if (agents.length === 0) {
            setError('Agents not found. Please add at least one agent.');
            setLoading(false);
            return;
          }

          const allEmulators: Emulator[] = [];

          // Збираємо емулятори з усіх агентів паралельно через бекенд
          const emulatorPromises = agents.map(async (agent) => {
            try {
              const response = await backendClient.getEmulators(agent.id);
              // Додаємо назву агента до кожного емулятора
              return (response.emulators || []).map((emulator: any) => ({
                ...emulator,
                agentName: agent.name,
                agentId: agent.id,
              }));
            } catch (err: any) {
              console.error(`Error loading emulators from agent ${agent.name}:`, err.message);
              return []; // Повертаємо порожній масив при помилці
            }
          });

          const results = await Promise.all(emulatorPromises);
          // Об'єднуємо всі емулятори в один масив
          allEmulators.push(...results.flat());
          setEmulators(allEmulators);
        }
      } catch (err: any) {
        setError(err.message || 'Error loading emulators');
      } finally {
        setLoading(false);
      }
    };

    fetchEmulators();
  }, [viewMode, activeAgent, backendClient, agents]);

  const columns: ColumnsType<Emulator> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Agent',
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
      title: 'Status',
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
          <Radio.Button value="active">Active Agent</Radio.Button>
          <Radio.Button value="all">All Agents</Radio.Button>
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

