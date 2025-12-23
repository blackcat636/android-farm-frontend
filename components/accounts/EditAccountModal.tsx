'use client';

import { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, message, Typography } from 'antd';
import {
  createBackendClient,
  tokenStorage,
  type SocialAccount,
  type UpdateSocialAccountDto,
} from '@/lib/api/backend';

const { Option } = Select;
const { TextArea } = Input;

interface EditAccountModalProps {
  visible: boolean;
  account: SocialAccount;
  onCancel: () => void;
  onSuccess: () => void;
}

export function EditAccountModal({
  visible,
  account,
  onCancel,
  onSuccess,
}: EditAccountModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && account) {
      form.setFieldsValue({
        platform: account.platform,
        username: account.username,
        email: account.email,
        phone: account.phone,
        two_factor_secret: '',
        requires_proxy: account.requires_proxy,
        proxy_required_reason: account.proxy_required_reason,
        status: account.status,
        account_status_reason: account.account_status_reason,
      });
    }
  }, [visible, account, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const updateData: UpdateSocialAccountDto = {
        platform: values.platform,
        username: values.username,
        email: values.email,
        phone: values.phone,
        two_factor_secret: values.two_factor_secret || undefined,
        requires_proxy: values.requires_proxy,
        proxy_required_reason: values.proxy_required_reason,
        status: values.status,
        account_status_reason: values.account_status_reason,
      };

      // Add password only if it's changed
      if (values.password) {
        updateData.password = values.password;
      }

      const backendClient = createBackendClient(token);
      await backendClient.updateSocialAccount(account.id, updateData);

      message.success('Account updated successfully');
      form.resetFields();
      onSuccess();
    } catch (err: any) {
      message.error(err.message || 'Error updating account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Edit Account"
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={600}
    >
      <Form form={form} layout="vertical">
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

        <Form.Item name="password" label="New Password (leave empty to keep unchanged)">
          <Input.Password placeholder="New password" />
        </Form.Item>

        <Form.Item name="two_factor_secret" label="2FA Secret (optional)">
          <Input placeholder="Two-factor authentication" />
        </Form.Item>

        <Form.Item
          name="requires_proxy"
          label="Proxy Required"
          valuePropName="checked"
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
              <Form.Item name="proxy_required_reason" label="Proxy Usage Reason">
                <TextArea rows={2} placeholder="For example: to bypass geo-blocking" />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        <Form.Item name="status" label="Status">
          <Select>
            <Option value="active">Active</Option>
            <Option value="banned">Banned</Option>
            <Option value="restricted">Restricted</Option>
            <Option value="suspended">Suspended</Option>
            <Option value="inactive">Inactive</Option>
          </Select>
        </Form.Item>

        <Form.Item name="account_status_reason" label="Status Change Reason">
          <TextArea rows={2} placeholder="Explain the reason for status change" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

