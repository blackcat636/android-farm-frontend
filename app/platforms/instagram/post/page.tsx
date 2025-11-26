'use client';
export const runtime = 'nodejs';

import { useState } from 'react';
import { Form, Input, Select, Button, Card, Alert, Space, Result, InputNumber } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { type Emulator } from '@/lib/api/agent';
import { useAgentApi } from '@/hooks/useAgentApi';
import { useAllEmulators } from '@/hooks/useAllEmulators';
import Loading from '@/components/common/Loading';

const { TextArea } = Input;

export default function InstagramPostPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const { emulators, loading: loadingEmulators } = useAllEmulators(true);
  const [selectedEmulator, setSelectedEmulator] = useState<Emulator | null>(null);
  const [result, setResult] = useState<any>(null);
  const { executeAction, loading, error } = useAgentApi();

  const handleSubmit = async (values: any) => {
    try {
      setResult(null);
      
      // Знаходимо обраний емулятор для отримання agentBaseURL
      const emulator = emulators.find((e) => e.id === values.emulatorId);
      setSelectedEmulator(emulator || null);
      
      const params: any = {
        caption: values.caption,
      };

      // Додаємо username та password якщо вони вказані
      if (values.username) {
        params.username = values.username;
      }
      if (values.password) {
        params.password = values.password;
      }

      // Додаємо imagePath якщо вказано
      if (values.imagePath) {
        params.imagePath = values.imagePath;
      }

      const response = await executeAction(
        'instagram',
        'post',
        {
        emulatorId: values.emulatorId,
        params,
        },
        emulator?.agentBaseURL
      );
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
        <h1 style={{ margin: 0 }}>Instagram Post</h1>
      </Space>

      <Card>
        <Alert
          message="Інформація"
          description="Якщо користувач не авторизований, система автоматично виконає авторизацію за вказаними логіном та паролем. Якщо логін/пароль не вказані, а користувач не авторизований - виникне помилка."
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
            name="caption"
            label="Підпис до посту"
            rules={[{ required: true, message: 'Введіть підпис до посту' }]}
          >
            <TextArea
              rows={4}
              placeholder="Введіть текст посту..."
              disabled={loading}
              maxLength={2200}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="imagePath"
            label="Шлях до зображення (опціонально)"
            tooltip="Шлях до зображення на пристрої для публікації"
          >
            <Input placeholder="/storage/emulated/0/Pictures/image.jpg" disabled={loading} />
          </Form.Item>

          <Card type="inner" title="Авторизація (якщо потрібно)" style={{ marginBottom: 24 }}>
            <Alert
              message="Опціонально"
              description="Вкажіть логін та пароль, якщо користувач не авторизований. Якщо користувач вже авторизований - ці поля можна не заповнювати."
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form.Item
              name="username"
              label="Логін (username)"
            >
              <Input placeholder="your_username" disabled={loading} />
            </Form.Item>

            <Form.Item
              name="password"
              label="Пароль"
            >
              <Input.Password placeholder="your_password" disabled={loading} />
            </Form.Item>
          </Card>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<FileTextOutlined />}
              loading={loading}
              size="large"
              block
            >
              Опублікувати пост
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
            title="Пост успішно опубліковано!"
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

