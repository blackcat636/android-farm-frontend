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
import { ArrowLeftOutlined, EyeOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { CountrySelect } from '@/components/common/CountrySelect';

const { Title, Text } = Typography;

export default function TikTokViewPage() {
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
      await backendClient.viewTikTokPost({
        videoUrl: values.videoUrl?.trim(),
        country_code: values.country_code || null,
      });

      message.success('Video added for viewing!');
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
          onClick={() => router.push('/platforms/tiktok')}
        >
          Back to TikTok
        </Button>
      </div>

      <Title level={2}>
        <EyeOutlined /> View TikTok Video
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
            tooltip="Only accounts from this country will receive view tasks"
          >
            <CountrySelect placeholder="Any country" />
          </Form.Item>

          <Form.Item
            name="videoUrl"
            label="TikTok Video URL"
            rules={[
              { required: true, message: 'Please enter video URL' },
              {
                pattern: /tiktok\.com|vm\.tiktok\.com/,
                message: 'Please enter a valid TikTok URL (tiktok.com or vm.tiktok.com)',
              },
            ]}
            help="Example: https://www.tiktok.com/@user/video/1234567890"
          >
            <Input
              placeholder="https://www.tiktok.com/@user/video/1234567890"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<EyeOutlined />}
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
            <li>Enter the TikTok video URL that needs to be viewed</li>
            <li>The video will be added to the posts table (needs_view=1)</li>
            <li>View tasks will be created via the &quot;Check Posts&quot; job</li>
            <li>Each account will view the video once</li>
          </ul>
        </Text>
      </Card>
    </div>
  );
}
