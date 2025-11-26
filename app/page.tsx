'use client';

import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useActiveAgentApi } from '@/hooks/useActiveAgentApi';
import { useAllEmulators } from '@/hooks/useAllEmulators';
import { type PlatformsResponse } from '@/lib/api/agent';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

export default function Dashboard() {
  const { agentApi, activeAgent } = useActiveAgentApi();
  const { emulators, loading: loadingEmulators } = useAllEmulators(false);
  const [health, setHealth] = useState<any>(null);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeAgent) {
      setError('Агент не вибрано. Будь ласка, додайте та виберіть агента.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Отримуємо дані з детальною обробкою помилок
        let healthData = null;
        let platformsData: PlatformsResponse = { ok: false, platforms: [] };

        try {
          healthData = await agentApi.getHealth();
        } catch (err: any) {
          console.error('Помилка healthcheck:', err);
          if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
            setError(`Не вдалося підключитися до агента "${activeAgent.name}". Перевірте URL: ${activeAgent.url}`);
          }
        }

        try {
          platformsData = await agentApi.getPlatforms();
        } catch (err: any) {
          console.error('Помилка завантаження платформ:', err);
        }

        setHealth(healthData);
        setPlatforms(platformsData.platforms || []);
      } catch (err: any) {
        console.error('Загальна помилка:', err);
        setError(err.message || 'Помилка завантаження даних');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [agentApi, activeAgent]);

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
          description={activeAgent ? `Перевірте, що агент "${activeAgent.name}" запущений і доступний на ${activeAgent.url}` : 'Будь ласка, додайте та виберіть агента в заголовку сторінки'}
        />
      )}
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Статус агента"
              value={health ? 'Активний' : 'Недоступний'}
              prefix={health ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Платформи" value={platforms.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Всього емуляторів" value={emulators.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Активних емуляторів" value={activeEmulators} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card title="Платформи" style={{ marginTop: 16 }}>
            {platforms.length > 0 ? (
              <div>
                {platforms.map((platform) => (
                  <Tag key={platform} style={{ marginBottom: 8, fontSize: 14, padding: '4px 12px' }}>
                    {platform}
                  </Tag>
                ))}
              </div>
            ) : (
              <p>Немає доступних платформ</p>
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Емулятори" style={{ marginTop: 16 }}>
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
              <p>Немає доступних емуляторів</p>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
