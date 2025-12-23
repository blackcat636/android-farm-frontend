'use client';

import { Card, Button, Space } from 'antd';
import { useRouter } from 'next/navigation';
import { PlayCircleOutlined, HistoryOutlined, ArrowLeftOutlined } from '@ant-design/icons';

export default function YouTubePlatformPage() {
  const router = useRouter();

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

