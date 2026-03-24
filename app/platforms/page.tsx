'use client';

import { Card, Button, Space, App } from 'antd';
import { useRouter } from 'next/navigation';
import { 
  FileTextOutlined, 
  LoginOutlined, 
  HistoryOutlined, 
  HeartOutlined,
  LikeOutlined,
  PlayCircleOutlined,
  CommentOutlined,
  EyeOutlined,
  UserAddOutlined
} from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { useState, useEffect } from 'react';
import { prefetchTaskFormData } from '@/lib/cache/task-form-cache';

export default function PlatformsPage() {
  const { message } = App.useApp();
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
      <h1>Platforms</h1>
      
      {/* Instagram */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: '20px', color: '#0a0e27', letterSpacing: '-0.01em' }}>Instagram</span>
            <Button
              type="link"
              onClick={() => router.push('/platforms/instagram')}
            >
              Details
            </Button>
          </div>
        }
        style={{ 
          marginTop: 24,
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
        }}
        styles={{
          header: {
            background: 'linear-gradient(135deg, #fafbfc 0%, #ffffff 100%)',
            borderBottom: '1px solid #e2e8f0',
            padding: '20px 24px',
          },
          body: {
            padding: '24px',
          },
        }}
      >
        <h2 style={{ fontWeight: 600, fontSize: '16px', color: '#161b22', marginBottom: 20, marginTop: 0 }}>Main Actions</h2>
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
        </Space>
      </Card>

      {/* TikTok */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: '20px', color: '#0a0e27', letterSpacing: '-0.01em' }}>TikTok</span>
            <Button
              type="link"
              onClick={() => router.push('/platforms/tiktok')}
            >
              Details
            </Button>
          </div>
        }
        style={{ 
          marginTop: 24,
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
        }}
        styles={{
          header: {
            background: 'linear-gradient(135deg, #fafbfc 0%, #ffffff 100%)',
            borderBottom: '1px solid #e2e8f0',
            padding: '20px 24px',
          },
          body: {
            padding: '24px',
          },
        }}
      >
        <h2 style={{ fontWeight: 600, fontSize: '16px', color: '#161b22', marginBottom: 20, marginTop: 0 }}>Main Actions</h2>
        <Space size="middle" wrap style={{ marginTop: 16 }}>
          <Button
            type="primary"
            size="large"
            icon={<EyeOutlined />}
            onClick={() => router.push('/platforms/tiktok/view')}
          >
            View Video (view)
          </Button>
          <Button
            size="large"
            icon={<HeartOutlined />}
            onClick={() => router.push('/platforms/tiktok/viewAndLike')}
          >
            View and Like Video (viewAndLike)
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
            icon={<UserAddOutlined />}
            onClick={handleInDevelopment}
          >
            🚧 Subscribe
          </Button>
          <Button
            size="large"
            icon={<CommentOutlined />}
            onClick={handleInDevelopment}
          >
            🚧 Comments
          </Button>
        </Space>
      </Card>
      {/* YouTube */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: '20px', color: '#0a0e27', letterSpacing: '-0.01em' }}>YouTube</span>
            <Button
              type="link"
              onClick={() => router.push('/platforms/youtube')}
            >
              Details
            </Button>
          </div>
        }
        style={{ 
          marginTop: 24,
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
        }}
        styles={{
          header: {
            background: 'linear-gradient(135deg, #fafbfc 0%, #ffffff 100%)',
            borderBottom: '1px solid #e2e8f0',
            padding: '20px 24px',
          },
          body: {
            padding: '24px',
          },
        }}
      >
        <h2 style={{ fontWeight: 600, fontSize: '16px', color: '#161b22', marginBottom: 20, marginTop: 0 }}>Main Actions</h2>
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
            icon={<FileTextOutlined />}
            onClick={() => router.push('/platforms/youtube/post')}
          >
            Post
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
        </Space>
      </Card>

      {/* Facebook */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: '20px', color: '#0a0e27', letterSpacing: '-0.01em' }}>Facebook</span>
            <Button
              type="link"
              onClick={() => router.push('/platforms/facebook')}
            >
              Details
            </Button>
          </div>
        }
        style={{ 
          marginTop: 24,
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
        }}
        styles={{
          header: {
            background: 'linear-gradient(135deg, #fafbfc 0%, #ffffff 100%)',
            borderBottom: '1px solid #e2e8f0',
            padding: '20px 24px',
          },
          body: {
            padding: '24px',
          },
        }}
      >
        <h2 style={{ fontWeight: 600, fontSize: '16px', color: '#161b22', marginBottom: 20, marginTop: 0 }}>Main Actions</h2>
        <Space size="middle" wrap style={{ marginTop: 16 }}>
          <Button
            size="large"
            icon={<EyeOutlined />}
            onClick={handleInDevelopment}
          >
            🚧 View
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
            icon={<CommentOutlined />}
            onClick={handleInDevelopment}
          >
            🚧 Comments
          </Button>
        </Space>
      </Card>

      {/* Twitter/X */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600, fontSize: '20px', color: '#0a0e27', letterSpacing: '-0.01em' }}>Twitter (X)</span>
            <Button
              type="link"
              onClick={() => router.push('/platforms/twitter')}
            >
              Details
            </Button>
          </div>
        }
        style={{ 
          marginTop: 24,
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
        }}
        styles={{
          header: {
            background: 'linear-gradient(135deg, #fafbfc 0%, #ffffff 100%)',
            borderBottom: '1px solid #e2e8f0',
            padding: '20px 24px',
          },
          body: {
            padding: '24px',
          },
        }}
      >
        <h2 style={{ fontWeight: 600, fontSize: '16px', color: '#161b22', marginBottom: 20, marginTop: 0 }}>Main Actions</h2>
        <Space size="middle" wrap style={{ marginTop: 16 }}>
          <Button
            size="large"
            icon={<EyeOutlined />}
            onClick={handleInDevelopment}
          >
            🚧 View
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
            icon={<CommentOutlined />}
            onClick={handleInDevelopment}
          >
            🚧 Comments
          </Button>
        </Space>
      </Card>

    </div>
  );
}

