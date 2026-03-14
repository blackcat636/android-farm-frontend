'use client';

import { Card, Button, Space, App } from 'antd';
import { useRouter } from 'next/navigation';
import { PlayCircleOutlined, HistoryOutlined, ArrowLeftOutlined, EyeOutlined, LikeOutlined, CommentOutlined, UserAddOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { useState } from 'react';

export default function YouTubePlatformPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCheckPosts = async () => {
    try {
      setLoading(true);
      const loadingMsg = message.loading({ content: 'Checking posts...', key: 'check-posts', duration: 0 });
      const token = tokenStorage.get();
      if (!token) {
        message.error({ content: 'Authorization required', key: 'check-posts' });
        return;
      }
      const backendClient = createBackendClient(token);
      const result = await backendClient.triggerJobWebhook('check-posts');
      loadingMsg();
      const data = result.result?.data || {};
      message.success({
        content: `Created ${data.likeTasksCreated || 0} like tasks, ${data.viewTasksCreated || 0} view tasks.`,
        key: 'check-posts',
        duration: 5,
      });
    } catch (error: any) {
      message.error({
        content: `Error: ${error.response?.data?.message || error.message || 'Unknown error'}`,
        key: 'check-posts',
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInDevelopment = () => {
    message.warning({
      content: 'Coming Soon - This feature is under development and will be available shortly',
      duration: 5,
      style: { marginTop: '20vh' },
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/platforms')}
        >
          Back to Platforms
        </Button>
      </div>
      <h1>YouTube Platform</h1>
      <Card style={{ marginTop: 24 }}>
        <h2>Available Actions</h2>
        <Space size="middle" wrap style={{ marginTop: 16 }}>
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={() => router.push('/platforms/youtube/search')}
          >
            Perform Search (search)
          </Button>
          <Button
            size="large"
            icon={<EyeOutlined />}
            onClick={() => router.push('/platforms/youtube/view')}
          >
            Watch Video
          </Button>
          <Button
            size="large"
            icon={<LikeOutlined />}
            onClick={() => router.push('/platforms/youtube/viewAndLike')}
          >
            View and Like
          </Button>
          <Button
            size="large"
            icon={<EyeOutlined />}
            onClick={handleCheckPosts}
            loading={loading}
          >
            Check Posts
          </Button>
          <Button
            size="large"
            icon={<CommentOutlined />}
            onClick={handleInDevelopment}
          >
            🚧 Comment
          </Button>
          <Button
            size="large"
            icon={<UserAddOutlined />}
            onClick={handleInDevelopment}
          >
            🚧 Subscribe
          </Button>
          <Button
            size="large"
            icon={<HistoryOutlined />}
            onClick={() => {
              // Placeholder for future history
              alert('History will be available later');
            }}
          >
            View History
          </Button>
        </Space>
      </Card>
    </div>
  );
}
