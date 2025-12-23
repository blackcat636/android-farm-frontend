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
import { ArrowLeftOutlined, LikeOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';

const { Title, Text } = Typography;

export default function InstagramLikePage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: { postUrl: string }) => {
    try {
      setLoading(true);
      const token = tokenStorage.get();
      if (!token) {
        message.error('Authorization required');
        return;
      }

      const backendClient = createBackendClient(token);
      const result = await backendClient.likeInstagramPost({
        postUrl: values.postUrl,
      });

      message.success('Post added successfully!');
      form.resetFields();
    } catch (err: any) {
      message.error(
        err.response?.data?.message || err.message || 'Error adding post'
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
        <LikeOutlined /> Like Instagram Post
      </Title>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
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
                icon={<LikeOutlined />}
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
            <li>Enter the Instagram post URL that needs to be liked</li>
            <li>The post will be added to the posts table</li>
            <li>Like tasks will be created automatically via the "Check Posts Without Likes" job</li>
            <li>After execution, a record will be added to the post_likes table</li>
          </ul>
        </Text>
      </Card>
    </div>
  );
}

