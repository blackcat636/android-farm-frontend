'use client';

import { Input, Form, InputNumber } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { ActionFormWrapper } from '@/components/platforms/ActionFormWrapper';

export default function InstagramViewPage() {
  return (
    <ActionFormWrapper
      platform="instagram"
      action="view"
      title="Instagram View Post"
      description="Open post in Instagram via Chrome and view it (without liking). Task will be added to the queue."
      platformDisplayName="Instagram"
      submitButtonText="Add Task to Queue"
      submitButtonIcon={<EyeOutlined />}
      onSubmit={async ({ formValues, accountId, emulatorId, agentId }) => {
        const token = tokenStorage.get();
        if (!token) {
          throw new Error('Authorization required');
        }

        const backendClient = createBackendClient(token);
        const params: Record<string, unknown> = {
          postUrl: formValues.postUrl,
        };
        if (formValues.viewSeconds != null && formValues.viewSeconds > 0) {
          params.viewSeconds = formValues.viewSeconds;
        }

        const task = await backendClient.addTask({
          platform: 'instagram',
          action: 'view',
          params,
          account_id: accountId,
          emulator_id: emulatorId,
          agent_id: agentId,
          country_code: formValues.country_code || null,
        });

        return {
          task_id: task.id,
          status: task.status,
          platform: 'instagram',
          action: 'view',
        };
      }}
    >
      {({ loading }) => (
        <>
          <Form.Item
            name="postUrl"
            label="Instagram Post URL"
            rules={[
              { required: true, message: 'Enter post URL' },
              {
                pattern: /instagram\.com|instagr\.am/,
                message: 'Enter a valid Instagram post URL',
              },
            ]}
            help="Example: https://www.instagram.com/p/ABC123/"
          >
            <Input
              placeholder="https://www.instagram.com/p/ABC123/"
              disabled={loading}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="viewSeconds"
            label="View Duration (seconds)"
            tooltip="How long to view the post (default: 5, range: 1–60)"
            initialValue={5}
          >
            <InputNumber
              min={1}
              max={60}
              placeholder="5"
              disabled={loading}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </>
      )}
    </ActionFormWrapper>
  );
}
