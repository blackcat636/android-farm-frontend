'use client';

import { Select, Button, Modal, Form, Input, message, Space, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useAgents } from '@/contexts/AgentsContext';
import { createAgentApi } from '@/lib/api/agent';

export default function AgentSelector() {
  const { agents, activeAgent, setActiveAgent, addAgent, updateAgent, deleteAgent, refreshAgentTunnelUrl } = useAgents();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);

  const handleAddAgent = async () => {
    try {
      const values = await form.validateFields();
      const { name, url, agentId } = values;

      // Тестуємо підключення
      setTesting(true);
      try {
        const testApi = createAgentApi(url);
        await testApi.getHealth();
        message.success('Підключення успішне!');
      } catch (error) {
        message.warning('Не вдалося підключитися, але агент додано. Перевірте URL пізніше.');
      } finally {
        setTesting(false);
      }

      // Спробуємо отримати URL тунелю
      let tunnelUrl: string | undefined;
      try {
        const testApi = createAgentApi(url);
        const tunnelResponse = await testApi.getTunnelUrl(agentId || undefined);
        if (tunnelResponse.ok && tunnelResponse.url) {
          tunnelUrl = tunnelResponse.url;
        }
      } catch (error) {
        // Ігноруємо помилку, тунель може бути не налаштований
      }

      addAgent({
        name,
        url,
        agentId: agentId || undefined,
        tunnelUrl,
        isActive: false,
      });

      form.resetFields();
      setIsModalVisible(false);
      message.success('Агента додано успішно!');
    } catch (error) {
      if (error !== 'validate') {
        message.error('Помилка додавання агента');
      }
    }
  };

  const handleRefreshTunnel = async (agentId: string) => {
    try {
      await refreshAgentTunnelUrl(agentId);
      message.success('URL тунелю оновлено');
    } catch (error) {
      message.error('Помилка оновлення URL тунелю');
    }
  };

  const handleDelete = (id: string) => {
    deleteAgent(id);
    message.success('Агента видалено');
  };

  return (
    <Space>
      <Select
        value={activeAgent?.id || undefined}
        onChange={(value) => setActiveAgent(value)}
        style={{ minWidth: 200 }}
        placeholder="Виберіть агента"
      >
        {agents.map((agent) => (
          <Select.Option key={agent.id} value={agent.id}>
            {agent.name} {agent.tunnelUrl && '🌐'}
          </Select.Option>
        ))}
      </Select>

      <Button
        icon={<PlusOutlined />}
        onClick={() => setIsModalVisible(true)}
      >
        Додати агента
      </Button>

      {activeAgent && (
        <>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => handleRefreshTunnel(activeAgent.id)}
            size="small"
            title="Оновити URL тунелю"
          />
          {agents.length > 1 && (
            <Popconfirm
              title="Видалити цього агента?"
              onConfirm={() => handleDelete(activeAgent.id)}
              okText="Так"
              cancelText="Ні"
            >
              <Button
                icon={<DeleteOutlined />}
                danger
                size="small"
              />
            </Popconfirm>
          )}
        </>
      )}

      <Modal
        title="Додати нового агента"
        open={isModalVisible}
        onOk={handleAddAgent}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={testing}
        okText="Додати"
        cancelText="Скасувати"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Назва агента"
            rules={[{ required: true, message: 'Введіть назву агента' }]}
          >
            <Input placeholder="Наприклад: Server 1" />
          </Form.Item>

          <Form.Item
            name="url"
            label="URL агента"
            rules={[
              { required: true, message: 'Введіть URL агента' },
              { type: 'url', message: 'Введіть коректний URL' },
            ]}
          >
            <Input placeholder="http://localhost:3000 або https://tunnel-url.trycloudflare.com" />
          </Form.Item>

          <Form.Item
            name="agentId"
            label="Agent ID (опціонально)"
            tooltip="ID агента для отримання URL з Cloudflare KV. Якщо не вказано, використовується hostname."
          >
            <Input placeholder="agent-hostname" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

