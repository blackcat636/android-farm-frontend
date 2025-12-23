'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useBackendAgentApi } from '@/hooks/useBackendAgentApi';
import { useAllEmulators } from '@/hooks/useAllEmulators';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

export default function Dashboard() {
  const { backendClient, activeAgent } = useBackendAgentApi();
  const { emulators, loading: loadingEmulators } = useAllEmulators(false);
  const [health, setHealth] = useState<any>(null);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeAgent) {
      setError('Agent not selected. Please add and select an agent.');
      setLoading(false);
      return;
    }

    if (!backendClient) {
        setError('Authorization required');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Отримуємо дані з детальною обробкою помилок
        let healthData = null;
        let platformsData: any = { ok: false, platforms: [] };

        try {
          healthData = await backendClient.getHealth(activeAgent.id);
        } catch (err: any) {
          console.error('Healthcheck error:', err);
          if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
            setError(`Failed to connect to agent "${activeAgent.name}". Check URL: ${activeAgent.url || activeAgent.tunnelUrl}`);
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
  }, [backendClient, activeAgent]);

  const loadingState = loading || loadingEmulators;

  if (loadingState) {
    return <Loading />;
  }

  const activeEmulators = emulators.filter((e) => e.status === 'active').length;

  return (
    <div>
      <h1>Dashboard</h1>
      {error && (
        <ErrorDisplay 
          message={error} 
          description={activeAgent ? `Make sure agent "${activeAgent.name}" is running and accessible at ${activeAgent.url}` : 'Please add and select an agent in the page header'}
        />
      )}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Agent Status"
              value={health ? 'Active' : 'Unavailable'}
              prefix={health ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
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
