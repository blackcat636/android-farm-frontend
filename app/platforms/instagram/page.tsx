'use client';

import { Card, Button, Space } from 'antd';
import { useRouter } from 'next/navigation';
import { FileTextOutlined, LoginOutlined, HistoryOutlined } from '@ant-design/icons';

export default function InstagramPlatformPage() {
  const router = useRouter();

  return (
    <div>
      <h1>Instagram Platform</h1>
      <Card style={{ marginTop: 24 }}>
        <h2>Доступні дії</h2>
        <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
          <Button
            type="primary"
            size="large"
            icon={<FileTextOutlined />}
            onClick={() => router.push('/platforms/instagram/post')}
            block
          >
            Опублікувати пост (post)
          </Button>
          <Button
            size="large"
            icon={<LoginOutlined />}
            onClick={() => router.push('/platforms/instagram/login')}
            block
          >
            Авторизуватися (login)
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

