'use client';
export const runtime = 'nodejs';

import { useEffect, useState } from 'react';
import { Card, List, Button, Tag, Space } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useActiveAgentApi } from '@/hooks/useActiveAgentApi';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

interface PlatformWithActions {
  name: string;
  actions: string[];
}

export default function PlatformsPage() {
  const router = useRouter();
  const { agentApi, activeAgent } = useActiveAgentApi();
  const [platforms, setPlatforms] = useState<PlatformWithActions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeAgent) {
      setError('Агент не вибрано. Будь ласка, додайте та виберіть агента.');
      setLoading(false);
      return;
    }

    const fetchPlatforms = async () => {
      try {
        setLoading(true);
        const platformsResponse = await agentApi.getPlatforms();
        const platformsList: PlatformWithActions[] = [];

        for (const platform of platformsResponse.platforms) {
          try {
            const actionsResponse = await agentApi.getPlatformActions(platform);
            platformsList.push({
              name: platform,
              actions: actionsResponse.actions || [],
            });
          } catch (err) {
            platformsList.push({
              name: platform,
              actions: [],
            });
          }
        }

        setPlatforms(platformsList);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Помилка завантаження платформ');
      } finally {
        setLoading(false);
      }
    };

    fetchPlatforms();
  }, [agentApi, activeAgent]);

  const handleExecuteAction = (platform: string, action: string) => {
    router.push(`/platforms/${platform}/${action}`);
  };

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div>
      <h1>Platforms</h1>
      {platforms.length === 0 ? (
        <Card>
          <p>Немає доступних платформ</p>
        </Card>
      ) : (
        <List
          grid={{ gutter: 16, column: 1 }}
          dataSource={platforms}
          renderItem={(platform) => (
            <List.Item>
              <Card
                title={platform.name}
                style={{ width: '100%' }}
                extra={
                  <Button
                    type="link"
                    onClick={() => router.push(`/platforms/${platform.name}`)}
                  >
                    Деталі
                  </Button>
                }
              >
                <div>
                  <strong>Доступні дії:</strong>
                  <Space wrap style={{ marginTop: 12 }}>
                    {platform.actions.length > 0 ? (
                      platform.actions.map((action) => (
                        <Button
                          key={action}
                          type="primary"
                          icon={<PlayCircleOutlined />}
                          onClick={() => handleExecuteAction(platform.name, action)}
                        >
                          {action}
                        </Button>
                      ))
                    ) : (
                      <Tag>Немає доступних дій</Tag>
                    )}
                  </Space>
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  );
}

