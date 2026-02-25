'use client';
export const runtime = 'edge';

import { Input, Form } from 'antd';
import { LoginOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { ActionFormWrapper } from '@/components/platforms/ActionFormWrapper';

export default function InstagramLoginPage() {
  return (
    <ActionFormWrapper
      platform="instagram"
      action="login"
      title="Instagram Login"
      description="Enter login and password to authenticate in Instagram. After successful authentication, you will be able to perform other actions without re-authentication. You can select an Instagram account or a specific emulator. If an account without binding is selected, the system will offer to create a binding to an emulator."
      platformDisplayName="Instagram"
      submitButtonText="Authenticate"
      submitButtonIcon={<LoginOutlined />}
      onSubmit={async ({ formValues, accountId, emulatorId, agentId }) => {
        const token = tokenStorage.get();
        if (!token) {
          throw new Error('Authorization required');
        }

        const backendClient = createBackendClient(token);

        const params: any = {
          username: formValues.username,
          password: formValues.password,
        };

        const task = await backendClient.addTask({
          platform: 'instagram',
          action: 'login',
          params,
          account_id: accountId,
          emulator_id: emulatorId,
          agent_id: agentId,
          requireSession: formValues.requireSession || false,
          country_code: formValues.country_code || null,
        });

        return {
          task_id: task.id,
          status: task.status,
          platform: 'instagram',
          action: 'login',
        };
      }}
    >
      {({ form, loading }) => (
        <>
          <Form.Item
            name="username"
            label="Login (username)"
            rules={[{ required: true, message: 'Enter login' }]}
          >
            <Input placeholder="your_username" disabled={loading} />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Enter password' }]}
          >
            <Input.Password placeholder="your_password" disabled={loading} />
          </Form.Item>
        </>
      )}
    </ActionFormWrapper>
  );
}
