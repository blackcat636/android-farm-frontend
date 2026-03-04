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

export default function InstagramViewAndLikePage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { postUrl: string; country_code?: string }) => {
    try {
      setLoading(true);
      const token = tokenStorage.get();
      if (!token) {
        message.error('Authorization required');
        return;
      }

      const backendClient = createBackendClient(token);
      await backendClient.viewAndLikeInstagramPost({
        postUrl: values.postUrl,
        country_code: values.country_code || null,
      });

      message.success('Post added for view and like!');
      form.resetFields();
    } catch (err: any) {
      message.error(
        err.response?.data?.message || err.message || 'Error adding post',
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
          onClick={() => router.push('/platforms/instagram')}
        >
          Back to Instagram
        </Button>
      </div>

      <Title level={2}>
        <HeartOutlined /> View and Like Instagram Post
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
            name="postUrl"
            label="Instagram Post URL"
            rules={[
              { required: true, message: 'Please enter post URL' },
              {
                pattern: /instagram\.com|instagr\.am/,
                message: 'Please enter a valid Instagram post URL',
              },
            ]}
            help="Example: https://www.instagram.com/p/ABC123/"
          >
            <Input
              placeholder="https://www.instagram.com/p/ABC123/"
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
                Add Post
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
            <li>Enter the Instagram post URL that needs to be viewed and liked</li>
            <li>The post will be added to the posts table (needs_view=1, needs_like=1)</li>
            <li>Like tasks will be created via the &quot;Check Posts&quot; job</li>
            <li>Each account will view and like the post once</li>
          </ul>
        </Text>
      </Card>
    </div>
  );
}
