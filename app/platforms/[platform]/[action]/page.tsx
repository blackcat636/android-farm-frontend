'use client';
export const runtime = 'edge';

import { Input, Form } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { useParams } from 'next/navigation';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { ActionFormWrapper } from '@/components/platforms/ActionFormWrapper';

const { TextArea } = Input;

export default function ExecuteActionPage() {
  const params = useParams();
  const platform = params?.platform as string;
  const action = params?.action as string;

  // Special forms for specific actions (use separate pages)
  if (platform === 'youtube' && action === 'search') {
    return null; // Will be redirected via router.replace in useEffect
  }
  
  if (platform === 'instagram' && action === 'post') {
    return null; // Will be redirected via router.replace in useEffect
  }
  
  if (platform === 'instagram' && action === 'login') {
    return null; // Will be redirected via router.replace in useEffect
  }

  if (!platform || !action) {
    return null;
  }

  return (
    <ActionFormWrapper
      platform={platform}
      action={action}
      title={`${platform.toUpperCase()} - ${action}`}
          description="This is a general form for executing an action. Parameters are passed as JSON. For specific actions, separate pages with forms may be created."
      submitButtonText="Add Task to Queue"
      submitButtonIcon={<PlayCircleOutlined />}
      onSubmit={async ({ formValues, accountId, emulatorId, agentId }) => {
        const token = tokenStorage.get();
        if (!token) {
          throw new Error('Authorization required');
        }

        const backendClient = createBackendClient(token);

        let params = {};
        
        if (formValues.params) {
          try {
            params = JSON.parse(formValues.params);
          } catch (e) {
            throw new Error('Invalid JSON parameters format');
          }
        }

        const task = await backendClient.addTask({
          platform,
          action,
          params,
          account_id: accountId,
          emulator_id: emulatorId,
          agent_id: agentId,
          requireSession: formValues.requireSession || false,
        });

        return {
          task_id: task.id,
          status: task.status,
          platform,
          action,
        };
      }}
    >
      {({ form, loading }) => (
          <Form.Item
            name="params"
            label="Parameters (JSON)"
            tooltip="Enter parameters in JSON format, for example: {'key': 'value'}"
            rules={[
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('Invalid JSON format'));
                  }
                },
              },
            ]}
          >
          <TextArea
              rows={6}
              placeholder='{"key": "value"}'
              disabled={loading}
            />
          </Form.Item>
      )}
    </ActionFormWrapper>
  );
}
