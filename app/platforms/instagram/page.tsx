'use client';

import { Card, Button, Space, message } from 'antd';
import { useRouter } from 'next/navigation';
import { FileTextOutlined, LoginOutlined, HistoryOutlined, LikeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { useState } from 'react';

export default function InstagramPlatformPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCheckPostsLikes = async () => {
    try {
      setLoading(true);
      const loadingMsg = message.loading({ content: 'Starting posts without likes check...', key: 'check-likes', duration: 0 });
      
      const token = tokenStorage.get();
      if (!token) {
        message.error({ content: 'Authorization required', key: 'check-likes' });
        return;
      }

      const backendClient = createBackendClient(token);
      const result = await backendClient.triggerJobWebhook('check-posts-likes');
      
      loadingMsg();
      message.success({
        content: `Task started successfully! Found ${result.result?.data?.totalPostsWithoutLikes || 0} posts without likes, created ${result.result?.data?.totalLikeTasksCreated || 0} tasks.`,
        key: 'check-likes',
        duration: 5,
      });
    } catch (error: any) {
      message.error({
        content: `Error: ${error.response?.data?.message || error.message || 'Unknown error'}`,
        key: 'check-likes',
        duration: 5,
      });
    } finally {
      setLoading(false);
    }
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
      <h1>Instagram Platform</h1>
      <Card style={{ marginTop: 24 }}>
        <h2>Available Actions</h2>
        <Space size="middle" wrap style={{ marginTop: 16 }}>
          <Button
            type="primary"
            size="large"
            icon={<FileTextOutlined />}
            onClick={() => router.push('/platforms/instagram/post')}
          >
            Publish Post (post)
          </Button>
          <Button
            size="large"
            icon={<LoginOutlined />}
            onClick={() => router.push('/platforms/instagram/login')}
          >
            Login (login)
          </Button>
          <Button
            size="large"
            icon={<LikeOutlined />}
            onClick={() => router.push('/platforms/instagram/like')}
          >
            Like Post
          </Button>
          <Button
            size="large"
            icon={<LikeOutlined />}
            onClick={handleCheckPostsLikes}
            loading={loading}
          >
            Check Posts Without Likes
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

