'use client';

import { useEffect, useState } from 'react';
import { Table, Tag, Radio, Alert, Space } from 'antd';
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
  const { agents, refreshAgents, refreshAgentTunnelUrl } = useAgents();
  const [emulators, setEmulators] = useState<Emulator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [agentErrors, setAgentErrors] = useState<Record<string, string>>({});

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
              // Очищаємо помилку для цього агента, якщо запит успішний
              setAgentErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[agent.id];
                return newErrors;
              });
              
              // Додаємо назву агента до кожного емулятора
              return (response.emulators || []).map((emulator: any) => ({
                ...emulator,
                agentName: agent.name,
                agentId: agent.id,
              }));
            } catch (err: any) {
              const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
              const statusCode = err.response?.status;
              const agentUrl = agent.tunnelUrl || agent.url || 'unknown';
              
              // Зберігаємо детальну інформацію про помилку для цього агента
              let detailedError = `Помилка завантаження емуляторів з агента "${agent.name}"`;
              
              if (statusCode === 502) {
                detailedError = `Не вдалося підключитися до агента "${agent.name}". ` +
                  `Агент може бути офлайн або URL неправильний. ` +
                  `Перевірте URL: ${agentUrl}. ` +
                  `Помилка бекенду: ${errorMessage}`;
              } else {
                detailedError = `Помилка завантаження емуляторів з агента "${agent.name}": ${errorMessage}`;
              }
              
              console.error(detailedError, err);
              
              // Зберігаємо помилку для відображення
              setAgentErrors(prev => ({
                ...prev,
                [agent.id]: detailedError
              }));
              
              // ВИДАЛЕНО: Автоматичне оновлення URL при помилці 502 викликало безкінечний цикл
              // Користувач може оновити URL вручну через кнопку "Retry & Update URL"
              // Якщо помилка 502, спробуємо оновити URL агента з KV
              // if (statusCode === 502 && agent.agentId) {
              //   try {
              //     console.log(`Спробую оновити URL агента ${agent.name} з KV...`);
              //     await refreshAgentTunnelUrl(agent.id);
              //     // Оновимо список агентів з бекенду
              //     await refreshAgents();
              //     console.log(`URL агента ${agent.name} оновлено`);
              //   } catch (updateError) {
              //     console.warn(`Не вдалося оновити URL агента ${agent.name}:`, updateError);
              //   }
              // }
              
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
      
      {/* Показуємо помилки для конкретних агентів */}
      {Object.keys(agentErrors).length > 0 && (
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
          {Object.entries(agentErrors).map(([agentId, errorMsg]) => {
            const agent = agents.find(a => a.id === agentId);
            return (
              <Alert
                key={agentId}
                message={`Помилка агента: ${agent?.name || agentId}`}
                description={errorMsg}
                type="warning"
                showIcon
                closable
                onClose={() => {
                  setAgentErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[agentId];
                    return newErrors;
                  });
                }}
              />
            );
          })}
        </Space>
      )}
      
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

