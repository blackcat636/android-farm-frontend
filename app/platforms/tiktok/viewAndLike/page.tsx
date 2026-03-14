'use client';
export const runtime = 'edge';

import { InputNumber, Form, Input } from 'antd';
import { HeartOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { ActionFormWrapper } from '@/components/platforms/ActionFormWrapper';

export default function TikTokViewAndLikePage() {
  return (
    <ActionFormWrapper
      platform="tiktok"
      action="viewAndLike"
      title="TikTok View and Like"
      description="Enter TikTok video URL. The video will open in Chrome, then in the TikTok app, and will be liked."
      platformDisplayName="TikTok"
      submitButtonText="Add Task to Queue"
      submitButtonIcon={<HeartOutlined />}
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
          action: 'viewAndLike',
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
          action: 'viewAndLike',
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
