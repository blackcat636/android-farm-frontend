'use client';

import { Input, Form, Select } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { ActionFormWrapper } from '@/components/platforms/ActionFormWrapper';

const { TextArea } = Input;

const POST_TYPE_OPTIONS = [
  { value: 'video', label: 'Video' },
  { value: 'short', label: 'Short' },
  { value: 'live', label: 'Live' },
  { value: 'post', label: 'Post' },
];

export default function YouTubePostPage() {
  return (
    <ActionFormWrapper
      platform="youtube"
      action="post"
      title="YouTube Post"
      description="You can select a YouTube account or a specific emulator. If an account without binding is selected, the system will offer to create a binding to an emulator. Disabled emulators will be automatically started when executing the task."
      platformDisplayName="YouTube"
      submitButtonText="Add Task to Queue"
      submitButtonIcon={<FileTextOutlined />}
      onSubmit={async ({ formValues, accountId, emulatorId, agentId }) => {
        const token = tokenStorage.get();
        if (!token) {
          throw new Error('Authorization required');
        }

        const videoUrl = formValues.videoUrl?.trim();
        const videoPath = formValues.videoPath?.trim();
        if (!videoUrl && !videoPath) {
          throw new Error('Enter video URL or video path');
        }

        const backendClient = createBackendClient(token);

        const params: any = {
          caption: formValues.caption || '',
          postType: formValues.postType || 'video',
        };
        if (videoUrl) params.videoUrl = videoUrl;
        if (videoPath) params.videoPath = videoPath;

        const task = await backendClient.addTask({
          platform: 'youtube',
          action: 'post',
          params,
          account_id: accountId,
          emulator_id: emulatorId,
          agent_id: agentId,
          requireSession: formValues.requireSession || false,
          country_code: formValues.country_code || null,
        });

        if ('request_id' in task) {
          return {
            status: task.status,
            request_id: task.request_id,
            platform: 'youtube',
            action: 'post',
          };
        }

        return {
          task_id: task.id,
          status: task.status,
          platform: 'youtube',
          action: 'post',
        };
      }}
    >
      {({ form, loading }) => (
        <>
          <Form.Item
            name="caption"
            label="Caption (optional)"
          >
            <TextArea
              rows={4}
              placeholder="Enter video description..."
              disabled={loading}
              maxLength={5000}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="videoUrl"
            label="Video URL"
            help="URL to download video (requires emulator for push). Leave empty if using Video Path."
          >
            <Input
              placeholder="https://example.com/video.mp4"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="videoPath"
            label="Video Path (on emulator)"
            help="Path to video file already on emulator. Leave empty if using Video URL."
          >
            <Input
              placeholder="/sdcard/Download/video.mp4"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="postType"
            label="Upload as"
            initialValue="video"
          >
            <Select
              options={POST_TYPE_OPTIONS}
              disabled={loading}
            />
          </Form.Item>
        </>
      )}
    </ActionFormWrapper>
  );
}
