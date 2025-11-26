'use client';
export const runtime = 'nodejs';

import { useState } from 'react';
import { Form, Input, Select, Button, Card, Alert, Space, Result } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import { type Emulator } from '@/lib/api/agent';
import { useAgentApi } from '@/hooks/useAgentApi';
import { useAllEmulators } from '@/hooks/useAllEmulators';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

export default function ExecuteActionPage() {
  const router = useRouter();
  const params = useParams();
  const platform = params?.platform as string;
  const action = params?.action as string;
  const [form] = Form.useForm();
  const { emulators, loading: loadingEmulators } = useAllEmulators(true);
  const [selectedEmulator, setSelectedEmulator] = useState<Emulator | null>(null);
  const [result, setResult] = useState<any>(null);
  const { executeAction, loading, error } = useAgentApi();

  const handleSubmit = async (values: any) => {
    if (!platform || !action) return;

    try {
      setResult(null);
      const { emulatorId, params: paramsString } = values;
      
      // Знаходимо обраний емулятор для отримання agentBaseURL
      const emulator = emulators.find((e) => e.id === emulatorId);
      setSelectedEmulator(emulator || null);
      
      let params = {};
      
      if (paramsString) {
        try {
          params = JSON.parse(paramsString);
        } catch (e) {
          throw new Error('Невірний формат JSON параметрів');
        }
      }

      // Виконуємо дію через агента обраного емулятора
      const response = await executeAction(
        platform,
        action,
        {
        emulatorId,
        params,
        },
        emulator?.agentBaseURL // Передаємо baseURL агента для виконання дії
      );
      setResult(response);
    } catch (err: any) {
      // Помилка вже оброблена в useAgentApi
      if (err.message && err.message.includes('JSON')) {
        // Додаткова обробка помилки JSON
      }
    }
  };

  if (loadingEmulators) {
    return <Loading />;
  }

  // Спеціальні форми для конкретних дій (використовуємо окремі сторінки)
  if (platform === 'youtube' && action === 'search') {
    router.replace(`/platforms/youtube/search`);
    return null;
  }
  
  if (platform === 'instagram' && action === 'post') {
    router.replace(`/platforms/instagram/post`);
    return null;
  }
  
  if (platform === 'instagram' && action === 'login') {
    router.replace(`/platforms/instagram/login`);
    return null;
  }

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
          Назад
        </Button>
        <h1 style={{ margin: 0 }}>
          {platform} - {action}
        </h1>
      </Space>

      <Card>
        <Alert
          message="Увага"
          description="Це загальна форма для виконання дії. Параметри передаються як JSON. Для специфічних дій можуть бути створені окремі сторінки з формами."
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
            <Select 
              placeholder="Оберіть емулятор" 
              disabled={loading}
              onChange={(value) => {
                const emulator = emulators.find((e) => e.id === value);
                setSelectedEmulator(emulator || null);
              }}
            >
              {emulators.map((emulator) => (
                <Select.Option key={`${emulator.agentId}-${emulator.id}`} value={emulator.id}>
                  {emulator.name} {emulator.agentName && `(${emulator.agentName})`}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="params"
            label="Параметри (JSON)"
            tooltip="Введіть параметри у форматі JSON, наприклад: {'key': 'value'}"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('Невірний формат JSON'));
                  }
                },
              },
            ]}
          >
            <Input.TextArea
              rows={6}
              placeholder='{"key": "value"}'
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
              Виконати дію
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
                  <strong>Емулятор:</strong> {selectedEmulator?.name || result.emulatorId}
                  {selectedEmulator?.agentName && ` (Агент: ${selectedEmulator.agentName})`}
                </p>
                {(
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

