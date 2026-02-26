'use client';

import { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, message } from 'antd';
import { createBackendClient, tokenStorage, type CreateSocialAccountDto, type ProxyProvider } from '@/lib/api/backend';
import { CountrySelect } from '@/components/common/CountrySelect';

const { Option } = Select;
const { TextArea } = Input;

interface CreateAccountModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

export function CreateAccountModal({ visible, onCancel, onSuccess }: CreateAccountModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [proxyProviders, setProxyProviders] = useState<ProxyProvider[]>([]);

  useEffect(() => {
    if (visible) {
      const token = tokenStorage.get();
      if (token) {
        const backendClient = createBackendClient(token);
        backendClient.getProxyProviders().then(setProxyProviders).catch(() => setProxyProviders([]));
      }
    }
  }, [visible]);

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
        country_code: values.country_code || null,
        proxy_source: values.proxy_source || 'account',
        proxy_provider_id: values.proxy_source === 'provider' ? values.proxy_provider_id : null,
        proxy_type: values.proxy_type || null,
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

        <Form.Item name="country_code" label="Country">
          <CountrySelect placeholder="Select country (optional)" />
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

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.requires_proxy !== currentValues.requires_proxy
          }
        >
          {({ getFieldValue }) =>
            getFieldValue('requires_proxy') ? (
              <>
                <Form.Item name="proxy_source" label="Proxy Source" initialValue="account">
                  <Select>
                    <Option value="account">Account (manual proxy)</Option>
                    <Option value="provider">Provider (proxy-service)</Option>
                  </Select>
                </Form.Item>
                <Form.Item
                  noStyle
                  shouldUpdate={(p, c) => p.proxy_source !== c.proxy_source}
                >
                  {({ getFieldValue: gf }) =>
                    gf('proxy_source') === 'provider' ? (
                      <>
                        <Form.Item
                          name="proxy_provider_id"
                          label="Proxy Provider"
                          rules={[{ required: true, message: 'Select provider' }]}
                        >
                          <Select placeholder="Select provider">
                            {proxyProviders.map((p) => (
                              <Option key={p.id} value={p.id}>
                                {p.name} ({p.type})
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                        <Form.Item name="proxy_type" label="Proxy Type">
                          <Select placeholder="http (default)">
                            <Option value="http">HTTP</Option>
                            <Option value="https">HTTPS</Option>
                          </Select>
                        </Form.Item>
                      </>
                    ) : null
                  }
                </Form.Item>
              </>
            ) : null
          }
        </Form.Item>
      </Form>
    </Modal>
  );
}

