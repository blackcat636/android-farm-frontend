'use client';
export const runtime = 'edge';

import { Card, Button, Space } from 'antd';
import { useRouter, useParams } from 'next/navigation';
import { PlayCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAllEmulators } from '@/hooks/useAllEmulators';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

export default function PlatformDetailPage() {
  const router = useRouter();
  const params = useParams();
  const platform = params?.platform as string;
  const { user } = useAuth();
  const { emulators, loading: loadingEmulators } = useAllEmulators(false);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const firstAgentId = emulators[0]?.agentId ?? (emulators[0] as any)?.agent_id;

  useEffect(() => {
    if (!platform || !user) return;
    if (!firstAgentId) {
      setError('No emulators available. Add agents and sync to see platforms.');
      setLoading(false);
      return;
    }

    const token = tokenStorage.get();
    if (!token) {
      setError('Authorization required');
      setLoading(false);
      return;
    }

    const fetchActions = async () => {
      try {
        setLoading(true);
        const backendClient = createBackendClient(token);
        const response = await backendClient.getPlatformActions(firstAgentId, platform);
        setActions(response.actions || []);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Error loading platform actions');
      } finally {
        setLoading(false);
      }
    };

    fetchActions();
  }, [platform, user, firstAgentId]);

  if (loadingEmulators || loading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div>
      <h1>Platform: {platform}</h1>
      <Card style={{ marginTop: 24 }}>
        <h2>Available Actions</h2>
        {actions.length > 0 ? (
          <Space orientation="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
            {actions.map((action) => (
              <Button
                key={action}
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={() => router.push(`/platforms/${platform}/${action}`)}
                block
              >
                Execute {action}
              </Button>
            ))}
            <Button
              icon={<HistoryOutlined />}
              onClick={() => {
                // Placeholder for future history
                alert('History will be available later');
              }}
              block
            >
              View History
            </Button>
          </Space>
        ) : (
          <p>No available actions for this platform</p>
        )}
      </Card>
    </div>
  );
}

