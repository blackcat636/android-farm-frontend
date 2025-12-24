'use client';

import { Card, Button, Space, message } from 'antd';
import { useRouter } from 'next/navigation';
import { ArrowLeftOutlined, EyeOutlined, UserAddOutlined, CommentOutlined, HistoryOutlined } from '@ant-design/icons';

export default function TwitterPlatformPage() {
  const router = useRouter();

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
      <h1>Twitter (X) Platform</h1>
      <Card style={{ marginTop: 24 }}>
        <h2>Available Actions</h2>
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

