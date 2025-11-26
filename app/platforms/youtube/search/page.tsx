'use client';

import { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, Button, Card, Alert, Space, Result } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { type Emulator } from '@/lib/api/agent';
import { useAgentApi } from '@/hooks/useAgentApi';
import { useActiveAgentApi } from '@/hooks/useActiveAgentApi';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

export default function YouTubeSearchPage() {
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
      const response = await executeAction('youtube', 'search', {
        emulatorId: values.emulatorId,
        params: {
          query: values.query,
          watchSeconds: values.watchSeconds || 15,
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
        <h1 style={{ margin: 0 }}>YouTube Search</h1>
      </Space>

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            watchSeconds: 15,
          }}
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
            name="query"
            label="Пошуковий запит"
            rules={[{ required: true, message: 'Введіть пошуковий запит' }]}
          >
            <Input placeholder="Введіть запит для пошуку" disabled={loading} />
          </Form.Item>

          <Form.Item
            name="watchSeconds"
            label="Час перегляду (секунди)"
            rules={[
              { required: true, message: 'Введіть час перегляду' },
              { type: 'number', min: 3, message: 'Мінімум 3 секунди' },
            ]}
          >
            <InputNumber
              min={3}
              max={300}
              placeholder="15"
              style={{ width: '100%' }}
              disabled={loading}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<PlayCircleOutlined />}
              loading={loading}
              size="large"
              block
            >
              Виконати пошук
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
            title="Дію виконано успішно!"
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

