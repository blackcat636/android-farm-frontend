'use client';

import { Card, Button, Space, message } from 'antd';
import { useRouter } from 'next/navigation';
import { 
  FileTextOutlined, 
  LoginOutlined, 
  HistoryOutlined, 
  LikeOutlined, 
  PlayCircleOutlined,
  CommentOutlined,
  EyeOutlined,
  UserAddOutlined
} from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { useState } from 'react';

export default function PlatformsPage() {
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
        title="Instagram" 
        style={{ marginTop: 24 }}
        extra={
          <Button
            type="link"
            onClick={() => router.push('/platforms/instagram')}
          >
            Details
          </Button>
        }
      >
        <h2>Main Actions</h2>
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
            icon={<LikeOutlined />}
            onClick={() => router.push('/platforms/instagram/like')}
          >
            Add Like
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
            icon={<CommentOutlined />}
            onClick={handleInDevelopment}
          >
            🚧 Comment Post
          </Button>
          <Button
            size="large"
            icon={<EyeOutlined />}
            onClick={handleInDevelopment}
          >
            🚧 View Post
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

      {/* YouTube */}
      <Card 
        title="YouTube" 
        style={{ marginTop: 24 }}
        extra={
          <Button
            type="link"
            onClick={() => router.push('/platforms/youtube')}
          >
            Details
          </Button>
        }
      >
        <h2>Main Actions</h2>
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
            onClick={handleInDevelopment}
          >
            🚧 Watch Video
          </Button>
          <Button
            size="large"
            icon={<LikeOutlined />}
            onClick={handleInDevelopment}
          >
            🚧 Like
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
        title="Facebook" 
        style={{ marginTop: 24 }}
        extra={
          <Button
            type="link"
            onClick={() => router.push('/platforms/facebook')}
          >
            Details
          </Button>
        }
      >
        <h2>Main Actions</h2>
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
        title="Twitter (X)" 
        style={{ marginTop: 24 }}
        extra={
          <Button
            type="link"
            onClick={() => router.push('/platforms/twitter')}
          >
            Details
          </Button>
        }
      >
        <h2>Main Actions</h2>
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

      {/* TikTok */}
      <Card 
        title="TikTok" 
        style={{ marginTop: 24 }}
        extra={
          <Button
            type="link"
            onClick={() => router.push('/platforms/tiktok')}
          >
            Details
          </Button>
        }
      >
        <h2>Main Actions</h2>
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

