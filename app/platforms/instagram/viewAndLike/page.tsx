'use client';

import { Input, Form } from 'antd';
import { HeartOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { ActionFormWrapper } from '@/components/platforms/ActionFormWrapper';

export default function InstagramViewAndLikePage() {
  return (
    <ActionFormWrapper
      platform="instagram"
      action="viewAndLike"
      title="Instagram View and Like Post"
      description="Open post in Instagram via Chrome, view it and like (save + share). Task will be added to the queue."
      platformDisplayName="Instagram"
      submitButtonText="Add Task to Queue"
      submitButtonIcon={<HeartOutlined />}
      onSubmit={async ({ formValues, accountId, emulatorId, agentId }) => {
        const token = tokenStorage.get();
        if (!token) {
          throw new Error('Authorization required');
        }

        const backendClient = createBackendClient(token);
        const task = await backendClient.addTask({
          platform: 'instagram',
          action: 'viewAndLike',
          params: { postUrl: formValues.postUrl },
          account_id: accountId,
          emulator_id: emulatorId,
          agent_id: agentId,
          country_code: formValues.country_code || null,
        });

        return {
          task_id: task.id,
          status: task.status,
          platform: 'instagram',
          action: 'viewAndLike',
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
        </>
      )}
    </ActionFormWrapper>
  );
}
