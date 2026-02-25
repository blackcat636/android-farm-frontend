'use client';
export const runtime = 'edge';

import { InputNumber, Form } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { ActionFormWrapper } from '@/components/platforms/ActionFormWrapper';

export default function TikTokWatchPage() {
  return (
    <ActionFormWrapper
      platform="tiktok"
      action="watch"
      title="TikTok Watch"
      description="Select an account or emulator and set watch duration. Disabled emulators will be started automatically."
      platformDisplayName="TikTok"
      submitButtonText="Add Task to Queue"
      submitButtonIcon={<PlayCircleOutlined />}
      onSubmit={async ({ formValues, accountId, emulatorId, agentId }) => {
        const token = tokenStorage.get();
        if (!token) {
          throw new Error('Authorization required');
        }

        const backendClient = createBackendClient(token);

        const params: any = {
          duration: formValues.duration || 30,
        };

        const task = await backendClient.addTask({
          platform: 'tiktok',
          action: 'watch',
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
          platform: 'tiktok',
          action: 'watch',
        };
      }}
    >
      {({ loading }) => (
        <>
          <Form.Item
            name="duration"
            label="Watch Time (seconds)"
            rules={[
              { required: true, message: 'Enter watch time' },
              { type: 'number', min: 3, message: 'Minimum 3 seconds' },
            ]}
            initialValue={30}
          >
            <InputNumber
              min={3}
              max={600}
              placeholder="30"
              style={{ width: '100%' }}
              disabled={loading}
            />
          </Form.Item>
        </>
      )}
    </ActionFormWrapper>
  );
}
