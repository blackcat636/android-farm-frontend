'use client';

import { Card, Button, Space } from 'antd';
import { useRouter } from 'next/navigation';
import { PlayCircleOutlined, HistoryOutlined } from '@ant-design/icons';

export default function YouTubePlatformPage() {
  const router = useRouter();

  return (
    <div>
      <h1>YouTube Platform</h1>
      <Card style={{ marginTop: 24 }}>
        <h2>Доступні дії</h2>
        <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={() => router.push('/platforms/youtube/search')}
            block
          >
            Виконати пошук (search)
          </Button>
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
      </Card>
    </div>
  );
}

