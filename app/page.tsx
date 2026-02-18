'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Tag, Button, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useBackendAgentApi } from '@/hooks/useBackendAgentApi';
import { useAllEmulators } from '@/hooks/useAllEmulators';
import { useAgents } from '@/contexts/AgentsContext';
import { useAuth } from '@/contexts/AuthContext';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

export default function Dashboard() {
  const { user } = useAuth();
  const { backendClient, activeAgent } = useBackendAgentApi();
  const { emulators, loading: loadingEmulators } = useAllEmulators(false);
  const { refreshAgents, refreshAgentTunnelUrl } = useAgents();
  const [health, setHealth] = useState<any>(null);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!backendClient) {
      setError(user ? null : 'Authorization required');
      setLoading(false);
      return;
    }

    if (!activeAgent) {
      setHealth(null);
      setPlatforms([]);
      setError(null);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        let healthData = null;
        let platformsData: any = { ok: false, platforms: [] };

        try {
          healthData = await backendClient.getHealth(activeAgent.id);
        } catch (err: any) {
          console.error('Healthcheck error:', err);
          const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
          const statusCode = err.response?.status;
          const agentUrl = activeAgent.tunnelUrl || activeAgent.url || 'unknown';
          if (statusCode === 502) {
            setError(
              `Failed to connect to agent "${activeAgent.name}". Check URL: \`${agentUrl}\``
            );
          } else if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
            setError(`Failed to connect to agent "${activeAgent.name}". Check URL: ${agentUrl}`);
          } else {
            setError(`Error connecting to agent "${activeAgent.name}": ${errorMessage}`);
          }
        }

        try {
          platformsData = await backendClient.getPlatforms(activeAgent.id);
        } catch (err: any) {
          console.error('Error loading platforms:', err);
        }

        setHealth(healthData);
        setPlatforms(platformsData.platforms || []);
      } catch (err: any) {
        console.error('General error:', err);
        setError(err.message || 'Error loading data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [backendClient, activeAgent, user]);

  const loadingState = loadingEmulators || (activeAgent && backendClient && loading);

  if (loadingState) {
    return <Loading />;
  }

  const activeEmulators = emulators.filter((e) => e.status === 'active').length;

  const agentStatusLabel = !activeAgent
    ? 'No agent selected'
    : health
      ? 'Active'
      : 'Unavailable';

  return (
    <div>
      <h1>Dashboard</h1>
      {error && activeAgent && (
        <Card style={{ marginBottom: 24, borderColor: '#ff4d4f' }}>
          <ErrorDisplay
            message={error}
            description={`Make sure agent "${activeAgent.name}" is running and accessible at ${activeAgent.tunnelUrl || activeAgent.url || 'unknown URL'}. You can select another agent in the header.`}
          />
          {activeAgent && (
            <Space style={{ marginTop: 16 }}>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={async () => {
                  setRetrying(true);
                  setError(null);
                  try {
                    // Оновимо список агентів з бекенду (це також оновить tunnelUrl)
                    await refreshAgents();
                    // Спробуємо оновити URL агента напряму з агента (якщо є базовий URL)
                    if (activeAgent.agentId) {
                      await refreshAgentTunnelUrl(activeAgent.id);
                    }
                    // Повторимо запит
                    const token = tokenStorage.get();
                    if (token) {
                      const client = createBackendClient(token);
                      const healthData = await client.getHealth(activeAgent.id);
                      setHealth(healthData);
                      setError(null);
                    }
                  } catch (err: any) {
                    console.error('Retry error:', err);
                    setError(`Still unable to connect: ${err.response?.data?.message || err.message}`);
                  } finally {
                    setRetrying(false);
                  }
                }}
                loading={retrying}
              >
                Retry & Update URL
              </Button>
              <Button 
                onClick={async () => {
                  setRetrying(true);
                  setError(null);
                  try {
                    // Оновимо список агентів з бекенду
                    await refreshAgents();
                    // Повторимо запит
                    const token = tokenStorage.get();
                    if (token) {
                      const client = createBackendClient(token);
                      const healthData = await client.getHealth(activeAgent.id);
                      setHealth(healthData);
                      setError(null);
                    }
                  } catch (err: any) {
                    console.error('Retry error:', err);
                    setError(`Still unable to connect: ${err.response?.data?.message || err.message}`);
                  } finally {
                    setRetrying(false);
                  }
                }}
                loading={retrying}
              >
                Retry
              </Button>
            </Space>
          )}
        </Card>
      )}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Agent Status"
              value={agentStatusLabel}
              prefix={
                health ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <CloseCircleOutlined style={{ color: activeAgent ? '#ff4d4f' : '#faad14' }} />
                )
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Platforms" value={platforms.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Total Emulators" value={emulators.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Active Emulators" value={activeEmulators} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card title="Platforms" style={{ marginTop: 16 }}>
            {platforms.length > 0 ? (
              <div>
                {platforms.map((platform) => (
                  <Tag key={platform} style={{ marginBottom: 8, fontSize: 14, padding: '4px 12px' }}>
                    {platform}
                  </Tag>
                ))}
              </div>
            ) : (
              <p>No available platforms</p>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Emulators" style={{ marginTop: 16 }}>
            {emulators.length > 0 ? (
              <div>
                {emulators.map((emulator) => (
                  <div key={`${emulator.agentId}-${emulator.id}`} style={{ marginBottom: 12 }}>
                    <div>
                      <strong>{emulator.name}</strong> ({emulator.id})
                      {emulator.agentName && (
                        <Tag color="blue" style={{ marginLeft: 8 }}>
                          {emulator.agentName}
                        </Tag>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                      {emulator.udid} -{' '}
                      <Tag color={emulator.status === 'active' ? 'green' : 'red'}>
                        {emulator.status}
                      </Tag>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No available emulators</p>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
