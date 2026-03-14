'use client';
export const runtime = 'edge';

import { InputNumber, Form, Input } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { ActionFormWrapper } from '@/components/platforms/ActionFormWrapper';

export default function TikTokViewPage() {
  return (
    <ActionFormWrapper
      platform="tiktok"
      action="view"
      title="TikTok View"
      description="Enter TikTok video URL and watch duration. The video will open in Chrome and then in the TikTok app."
      platformDisplayName="TikTok"
      submitButtonText="Add Task to Queue"
      submitButtonIcon={<EyeOutlined />}
      onSubmit={async ({ formValues, accountId, emulatorId, agentId }) => {
        const token = tokenStorage.get();
        if (!token) {
          throw new Error('Authorization required');
        }

        const backendClient = createBackendClient(token);

        const params: any = {
          videoUrl: formValues.videoUrl?.trim(),
          viewSeconds: formValues.duration ?? 30,
          duration: formValues.duration ?? 30,
        };

        const task = await backendClient.addTask({
          platform: 'tiktok',
          action: 'view',
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
          action: 'view',
        };
      }}
    >
      {({ loading }) => (
        <>
          <Form.Item
            name="videoUrl"
            label="TikTok Video URL"
            rules={[
              { required: true, message: 'Enter TikTok video URL' },
              {
                pattern: /tiktok\.com|vm\.tiktok\.com/,
                message: 'Enter a valid TikTok URL (tiktok.com or vm.tiktok.com)',
              },
            ]}
            help="Example: https://www.tiktok.com/@user/video/1234567890"
          >
            <Input
              placeholder="https://www.tiktok.com/@user/video/1234567890"
              disabled={loading}
            />
          </Form.Item>
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
