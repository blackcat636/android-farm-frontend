'use client';

import { Card, Button, Space, message } from 'antd';
import { useRouter } from 'next/navigation';
import { FileTextOutlined, LoginOutlined, HistoryOutlined, HeartOutlined, ArrowLeftOutlined, CommentOutlined, EyeOutlined, UserAddOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { useState, useEffect } from 'react';
import { prefetchTaskFormData } from '@/lib/cache/task-form-cache';

export default function InstagramPlatformPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    prefetchTaskFormData('instagram');
  }, []);

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
      content: '🚧 Coming Soon - This feature is under development and will be available shortly',
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
      <h1>Instagram Platform</h1>
      <Card style={{ marginTop: 24 }}>
        <h2>Available Actions</h2>
        <Space size="middle" wrap style={{ marginTop: 16 }}>
          <Button
            type="primary"
            size="large"
            icon={<FileTextOutlined />}
            onMouseEnter={() => prefetchTaskFormData('instagram')}
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
            icon={<EyeOutlined />}
            onClick={() => router.push('/platforms/instagram/view')}
          >
            View Post
          </Button>
          <Button
            size="large"
            icon={<HeartOutlined />}
            onClick={() => router.push('/platforms/instagram/viewAndLike')}
          >
            View and Like Post
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
            🚧 Comment Post
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

