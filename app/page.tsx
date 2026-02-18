'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Tag } from 'antd';
import { useAllEmulators } from '@/hooks/useAllEmulators';
import { useAuth } from '@/contexts/AuthContext';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

export default function Dashboard() {
  const { user } = useAuth();
  const { emulators, loading: loadingEmulators, error: emulatorsError } = useAllEmulators(false);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);

  // Платформи з першого доступного агента (з списку емуляторів)
  useEffect(() => {
    if (!user || !emulators.length) {
      setPlatforms([]);
      return;
    }
    const token = tokenStorage.get();
    if (!token) return;
    const firstAgentId = emulators[0]?.agentId ?? (emulators[0] as any)?.agent_id;
    if (!firstAgentId) return;
    setLoadingPlatforms(true);
    createBackendClient(token)
      .getPlatforms(firstAgentId)
      .then((data) => setPlatforms(data.platforms || []))
      .catch(() => setPlatforms([]))
      .finally(() => setLoadingPlatforms(false));
  }, [user, emulators]);

  const loadingState = loadingEmulators || loadingPlatforms;

  if (loadingState && emulators.length === 0) {
    return <Loading />;
  }

  if (emulatorsError && !user) {
    return <ErrorDisplay message="Необхідна авторизація" />;
  }

  const activeEmulators = emulators.filter((e) => e.status === 'active').length;

  return (
    <div>
      <h1>Dashboard</h1>
      <Row gutter={16} style={{ marginTop: 24 }}>
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
        <Col span={6}>
          <Card>
            <Statistic title="Agents" value={new Set(emulators.map((e) => e.agentId ?? (e as any).agent_id)).size} />
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
                  <div key={`${emulator.agentId ?? (emulator as any).agent_id}-${emulator.id}`} style={{ marginBottom: 12 }}>
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
