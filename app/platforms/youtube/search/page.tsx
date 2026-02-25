'use client';
export const runtime = 'edge';

import { Input, InputNumber, Form } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { ActionFormWrapper } from '@/components/platforms/ActionFormWrapper';

export default function YouTubeSearchPage() {
  return (
    <ActionFormWrapper
      platform="youtube"
      action="search"
      title="YouTube Search"
      description="You can select a YouTube account or a specific emulator. If an account without binding is selected, the system will offer to create a binding to an emulator. Disabled emulators will be automatically started when executing the task."
      platformDisplayName="YouTube"
      submitButtonText="Add Task to Queue"
      submitButtonIcon={<PlayCircleOutlined />}
      onSubmit={async ({ formValues, accountId, emulatorId, agentId }) => {
        const token = tokenStorage.get();
        if (!token) {
          throw new Error('Authorization required');
        }

        const backendClient = createBackendClient(token);

        const params: any = {
          query: formValues.query,
          watchSeconds: formValues.watchSeconds || 15,
        };

        const task = await backendClient.addTask({
          platform: 'youtube',
          action: 'search',
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
          platform: 'youtube',
          action: 'search',
        };
      }}
    >
      {({ form, loading }) => (
        <>
          <Form.Item
            name="query"
            label="Search Query"
            rules={[{ required: true, message: 'Enter search query' }]}
          >
            <Input placeholder="Enter search query" disabled={loading} />
          </Form.Item>

          <Form.Item
            name="watchSeconds"
            label="Watch Time (seconds)"
            rules={[
              { required: true, message: 'Enter watch time' },
              { type: 'number', min: 3, message: 'Minimum 3 seconds' },
            ]}
            initialValue={15}
          >
            <InputNumber
              min={3}
              max={300}
              placeholder="15"
              style={{ width: '100%' }}
              disabled={loading}
            />
          </Form.Item>
        </>
      )}
    </ActionFormWrapper>
  );
}
