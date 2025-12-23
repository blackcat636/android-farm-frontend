'use client';

import { useState } from 'react';
import { Modal, Form, Input, Select, Switch, message, Space, Typography } from 'antd';
import { createBackendClient, tokenStorage, type CreateSocialAccountDto } from '@/lib/api/backend';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

interface CreateAccountModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

export function CreateAccountModal({ visible, onCancel, onSuccess }: CreateAccountModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      await backendClient.createSocialAccount({
        platform: values.platform,
        username: values.username,
        email: values.email,
        phone: values.phone,
        password: values.password,
        two_factor_secret: values.two_factor_secret,
        requires_proxy: values.requires_proxy ?? true,
        proxy_required_reason: values.proxy_required_reason,
      });

      message.success('Account created successfully');
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      message.error(err.message || 'Error creating account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Add Social Account"
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={600}
    >
      <Form form={form} layout="vertical" initialValues={{ requires_proxy: true }}>
        <Form.Item
          name="platform"
          label="Platform"
          rules={[{ required: true, message: 'Select platform' }]}
        >
          <Select placeholder="Select platform">
            <Option value="instagram">Instagram</Option>
            <Option value="youtube">YouTube</Option>
            <Option value="tiktok">TikTok</Option>
            <Option value="facebook">Facebook</Option>
            <Option value="twitter">Twitter</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="username"
          label="Username"
          rules={[{ required: true, message: 'Enter username' }]}
        >
          <Input placeholder="username" />
        </Form.Item>

        <Form.Item name="email" label="Email">
          <Input type="email" placeholder="email@example.com" />
        </Form.Item>

        <Form.Item name="phone" label="Phone">
          <Input placeholder="+380123456789" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: 'Enter password' }]}
        >
          <Input.Password placeholder="Password" />
        </Form.Item>

        <Form.Item name="two_factor_secret" label="2FA Secret (optional)">
          <Input placeholder="Two-factor authentication" />
        </Form.Item>

        <Form.Item
          name="requires_proxy"
          label="Proxy Required"
          valuePropName="checked"
          tooltip="Whether proxy is required for this account"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.requires_proxy !== currentValues.requires_proxy
          }
        >
          {({ getFieldValue }) =>
            getFieldValue('requires_proxy') ? (
              <Form.Item
                name="proxy_required_reason"
                label="Proxy Usage Reason"
                tooltip="Explain why proxy is needed for this account"
              >
                <TextArea rows={2} placeholder="For example: to bypass geo-blocking" />
              </Form.Item>
            ) : null
          }
        </Form.Item>
      </Form>
    </Modal>
  );
}

