'use client';

import { Card, Button, Space } from 'antd';
import { useRouter, useParams } from 'next/navigation';
import { PlayCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useActiveAgentApi } from '@/hooks/useActiveAgentApi';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

export default function PlatformDetailPage() {
  const router = useRouter();
  const params = useParams();
  const platform = params?.platform as string;
  const { agentApi, activeAgent } = useActiveAgentApi();
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!platform) return;
    if (!activeAgent) {
      setError('Агент не вибрано. Будь ласка, додайте та виберіть агента.');
      setLoading(false);
      return;
    }

    const fetchActions = async () => {
      try {
        setLoading(true);
        const response = await agentApi.getPlatformActions(platform);
        setActions(response.actions || []);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Помилка завантаження дій платформи');
      } finally {
        setLoading(false);
      }
    };

    fetchActions();
  }, [platform, agentApi, activeAgent]);

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div>
      <h1>Platform: {platform}</h1>
      <Card style={{ marginTop: 24 }}>
        <h2>Доступні дії</h2>
        {actions.length > 0 ? (
          <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
            {actions.map((action) => (
              <Button
                key={action}
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={() => router.push(`/platforms/${platform}/${action}`)}
                block
              >
                Виконати {action}
              </Button>
            ))}
            <Button
              icon={<HistoryOutlined />}
              onClick={() => {
                // Заглушка для майбутньої історії
                alert('Історія буде доступна пізніше');
              }}
              block
            >
              Переглянути історію
            </Button>
          </Space>
        ) : (
          <p>Немає доступних дій для цієї платформи</p>
        )}
      </Card>
    </div>
  );
}

