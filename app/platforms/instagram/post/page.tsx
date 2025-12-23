'use client';
export const runtime = 'edge';

import { Input, Form } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { ActionFormWrapper } from '@/components/platforms/ActionFormWrapper';

const { TextArea } = Input;

export default function InstagramPostPage() {
  return (
    <ActionFormWrapper
      platform="instagram"
      action="post"
      title="Instagram Post"
      description="You can select an Instagram account or a specific emulator. If an account without binding is selected, the system will offer to create a binding to an emulator. Disabled emulators will be automatically started when executing the task."
      platformDisplayName="Instagram"
      submitButtonText="Add Task to Queue"
      submitButtonIcon={<FileTextOutlined />}
      onSubmit={async ({ formValues, accountId, emulatorId, agentId }) => {
        const token = tokenStorage.get();
        if (!token) {
          throw new Error('Authorization required');
        }

        const backendClient = createBackendClient(token);
      
      const params: any = {
          caption: formValues.caption,
      };

        if (formValues.imagePath) {
          params.imagePath = formValues.imagePath;
      }

        const task = await backendClient.addTask({
          platform: 'instagram',
          action: 'post',
        params,
          account_id: accountId,
          emulator_id: emulatorId,
          agent_id: agentId,
          requireSession: formValues.requireSession || false,
        });

        return {
          task_id: task.id,
          status: task.status,
          platform: 'instagram',
          action: 'post',
        };
              }}
            >
      {({ form, loading }) => (
        <>
          <Form.Item
            name="caption"
            label="Post Caption"
            rules={[{ required: true, message: 'Enter post caption' }]}
          >
            <TextArea
              rows={4}
              placeholder="Enter post text..."
              disabled={loading}
              maxLength={2200}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="imagePath"
            label="Image Path (optional)"
            tooltip="Path to image on device for publishing"
          >
            <Input placeholder="/storage/emulated/0/Pictures/image.jpg" disabled={loading} />
          </Form.Item>
        </>
      )}
    </ActionFormWrapper>
  );
}
