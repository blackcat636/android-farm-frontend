'use client';

import { Select, Button, Modal, Form, Input, message, Space, Popconfirm, Switch, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useAgents } from '@/contexts/AgentsContext';
import { createAgentApi } from '@/lib/api/agent';

export default function AgentSelector() {
  const { agents, activeAgent, setActiveAgent, addAgent, updateAgent, deleteAgent, refreshAgentTunnelUrl, updateAgentOnBackend } = useAgents();
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);

  const handleAddAgent = async () => {
    try {
      const values = await form.validateFields();
      const { name, url, agentId } = values;

      // Test connection
      setTesting(true);
      try {
        const testApi = createAgentApi(url);
        await testApi.getHealth();
        message.success('Connection successful!');
      } catch (error) {
        message.warning('Failed to connect, but agent added. Check URL later.');
      } finally {
        setTesting(false);
      }

      // Try to get tunnel URL
      let tunnelUrl: string | undefined;
      try {
        const testApi = createAgentApi(url);
        const tunnelResponse = await testApi.getTunnelUrl(agentId || undefined);
        if (tunnelResponse.ok && tunnelResponse.url) {
          tunnelUrl = tunnelResponse.url;
        }
      } catch (error) {
        // Ignore error, tunnel may not be configured
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
      message.success('Agent added successfully!');
    } catch (error) {
      if (error !== 'validate') {
        message.error('Error adding agent');
      }
    }
  };

  const handleRefreshTunnel = async (agentId: string) => {
    try {
      await refreshAgentTunnelUrl(agentId);
      message.success('Tunnel URL updated');
    } catch (error) {
      message.error('Error updating tunnel URL');
    }
  };

  const handleDelete = (id: string) => {
    deleteAgent(id);
    message.success('Agent deleted');
  };

  const handleVisibilityChange = async (checked: boolean) => {
    if (!activeAgent) return;
    const value = checked ? 1 : 0;
    setVisibilityLoading(true);
    try {
      await updateAgentOnBackend(activeAgent.id, { visibility: value });
      if (value === 0) {
        message.info('Агент приховано: не показується в API та не отримує задачі');
        if (agents.length > 1) {
          const next = agents.find((a) => a.id !== activeAgent.id);
          if (next) setActiveAgent(next.id);
        }
      } else {
        message.success('Видимість увімкнено');
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не вдалося оновити видимість');
    } finally {
      setVisibilityLoading(false);
    }
  };

  const isAgentVisible = activeAgent?.visibility == null || activeAgent?.visibility !== 0;

  return (
    <Space wrap>
      <Select
        value={activeAgent?.id || undefined}
        onChange={(value) => setActiveAgent(value)}
        style={{ minWidth: 200 }}
        placeholder="Select agent"
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
        Add Agent
      </Button>

      {activeAgent && (
        <>
          <Tooltip title="Видимість: показувати в API та давати задачі. Вимкнено = прихований.">
            <Space size={4}>
              <EyeOutlined style={{ color: '#888', fontSize: 12 }} />
              <Switch
                size="small"
                checked={isAgentVisible}
                loading={visibilityLoading}
                onChange={handleVisibilityChange}
              />
            </Space>
          </Tooltip>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => handleRefreshTunnel(activeAgent.id)}
            size="small"
            title="Refresh tunnel URL"
          />
          {agents.length > 1 && (
            <Popconfirm
              title="Delete this agent?"
              onConfirm={() => handleDelete(activeAgent.id)}
              okText="Yes"
              cancelText="No"
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
        title="Add New Agent"
        open={isModalVisible}
        onOk={handleAddAgent}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={testing}
        okText="Add"
        cancelText="Cancel"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Agent Name"
            rules={[{ required: true, message: 'Enter agent name' }]}
          >
            <Input placeholder="For example: Server 1" />
          </Form.Item>

          <Form.Item
            name="url"
            label="Agent URL"
            rules={[
              { required: true, message: 'Enter agent URL' },
              { type: 'url', message: 'Enter valid URL' },
            ]}
          >
            <Input placeholder="http://localhost:3000 or https://tunnel-url.trycloudflare.com" />
          </Form.Item>

          <Form.Item
            name="agentId"
            label="Agent ID (optional)"
            tooltip="Agent ID for getting URL from Cloudflare KV. If not specified, hostname is used."
          >
            <Input placeholder="agent-hostname" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

