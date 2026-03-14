'use client';

import { useState } from 'react';
import {
  Card,
  Button,
  Form,
  Input,
  message,
  Space,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, HeartOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { CountrySelect } from '@/components/common/CountrySelect';

const { Title, Text } = Typography;

export default function YouTubeViewAndLikePage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { videoUrl: string; country_code?: string }) => {
    try {
      setLoading(true);
      const token = tokenStorage.get();
      if (!token) {
        message.error('Authorization required');
        return;
      }

      const backendClient = createBackendClient(token);
      await backendClient.viewAndLikeYouTubePost({
        videoUrl: values.videoUrl?.trim(),
        country_code: values.country_code || null,
      });

      message.success('Video added for view and like!');
      form.resetFields();
    } catch (err: any) {
      message.error(
        err.response?.data?.message || err.message || 'Error adding video',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/platforms/youtube')}
        >
          Back to YouTube
        </Button>
      </div>

      <Title level={2}>
        <HeartOutlined /> View and Like YouTube Video
      </Title>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            name="country_code"
            label="Country (optional)"
            tooltip="Only accounts from this country will receive view and like tasks"
          >
            <CountrySelect placeholder="Any country" />
          </Form.Item>

          <Form.Item
            name="videoUrl"
            label="YouTube Video URL"
            rules={[
              { required: true, message: 'Please enter video URL' },
              {
                pattern: /youtube\.com|youtu\.be/,
                message: 'Please enter a valid YouTube URL (youtube.com or youtu.be)',
              },
            ]}
            help="Example: https://www.youtube.com/watch?v=xxxxx"
          >
            <Input
              placeholder="https://www.youtube.com/watch?v=xxxxx"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<HeartOutlined />}
                size="large"
              >
                Add Video
              </Button>
              <Button onClick={() => form.resetFields()} size="large">
                Clear
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card style={{ marginTop: 24 }}>
        <Title level={4}>Information</Title>
        <Text type="secondary">
          <ul>
            <li>Enter the YouTube video URL that needs to be viewed and liked</li>
            <li>The video will be added to the posts table (needs_view=1, needs_like=1)</li>
            <li>View and like tasks will be created via the &quot;Check Posts&quot; job</li>
            <li>Each account will view and like the video once</li>
          </ul>
        </Text>
      </Card>
    </div>
  );
}
