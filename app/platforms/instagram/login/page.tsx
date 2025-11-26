'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Select, Button, Card, Alert, Space, Result } from 'antd';
import { ArrowLeftOutlined, LoginOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { type Emulator } from '@/lib/api/agent';
import { useAgentApi } from '@/hooks/useAgentApi';
import { useActiveAgentApi } from '@/hooks/useActiveAgentApi';
import Loading from '@/components/common/Loading';

export default function InstagramLoginPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const { agentApi, activeAgent } = useActiveAgentApi();
  const [emulators, setEmulators] = useState<Emulator[]>([]);
  const [loadingEmulators, setLoadingEmulators] = useState(true);
  const [result, setResult] = useState<any>(null);
  const { executeAction, loading, error } = useAgentApi();

  useEffect(() => {
    if (!activeAgent) {
      setLoadingEmulators(false);
      return;
    }

    const fetchEmulators = async () => {
      try {
        const response = await agentApi.getEmulators();
        setEmulators(response.emulators.filter((e) => e.status === 'active'));
      } catch (err) {
        console.error('Помилка завантаження емуляторів:', err);
      } finally {
        setLoadingEmulators(false);
      }
    };

    fetchEmulators();
  }, [agentApi, activeAgent]);

  const handleSubmit = async (values: any) => {
    try {
      setResult(null);
      const response = await executeAction('instagram', 'login', {
        emulatorId: values.emulatorId,
        params: {
          username: values.username,
          password: values.password,
        },
      });
      setResult(response);
    } catch (err) {
      // Помилка вже оброблена в useAgentApi
    }
  };

  if (loadingEmulators) {
    return <Loading />;
  }

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
          Назад
        </Button>
        <h1 style={{ margin: 0 }}>Instagram Login</h1>
      </Space>

      <Card>
        <Alert
          message="Авторизація"
          description="Введіть логін та пароль для авторизації в Instagram. Після успішної авторизації ви зможете виконувати інші дії без повторної авторизації."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="emulatorId"
            label="Емулятор"
            rules={[{ required: true, message: 'Оберіть емулятор' }]}
          >
            <Select placeholder="Оберіть емулятор" disabled={loading}>
              {emulators.map((emulator) => (
                <Select.Option key={emulator.id} value={emulator.id}>
                  {emulator.name} ({emulator.id})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="username"
            label="Логін (username)"
            rules={[{ required: true, message: 'Введіть логін' }]}
          >
            <Input placeholder="your_username" disabled={loading} />
          </Form.Item>

          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: 'Введіть пароль' }]}
          >
            <Input.Password placeholder="your_password" disabled={loading} />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<LoginOutlined />}
              loading={loading}
              size="large"
              block
            >
              Авторизуватися
            </Button>
          </Form.Item>
        </Form>

        {error && (
          <Alert
            message="Помилка"
            description={error}
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {result && (
          <Result
            status="success"
            title="Авторизація успішна!"
            subTitle={
              <div>
                <p>
                  <strong>Платформа:</strong> {result.platform}
                </p>
                <p>
                  <strong>Дія:</strong> {result.action}
                </p>
                <p>
                  <strong>Емулятор:</strong> {result.emulatorId}
                </p>
                {result.result && (
                  <div style={{ marginTop: 16 }}>
                    <strong>Результат:</strong>
                    <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginTop: 8 }}>
                      {JSON.stringify(result.result, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            }
          />
        )}
      </Card>
    </div>
  );
}

