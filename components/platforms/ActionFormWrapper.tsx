'use client';

import { ReactNode, useState } from 'react';
import { Form, Button, Card, Alert, Result, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { type Emulator } from '@/lib/api/agent';
import { type SocialAccount } from '@/lib/api/backend';
import { useAllEmulators } from '@/hooks/useAllEmulators';
import { useAccountEmulatorSelection } from '@/hooks/useAccountEmulatorSelection';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { AccountEmulatorSelector } from './AccountEmulatorSelector';
import { CountrySelect } from '@/components/common/CountrySelect';
import Loading from '@/components/common/Loading';
import { message } from 'antd';

export interface ActionFormWrapperProps {
  platform: string;
  action: string;
  title: string;
  description?: string;
  platformDisplayName?: string;
  submitButtonText?: string;
  submitButtonIcon?: ReactNode;
  children: (params: {
    form: any;
    loading: boolean;
    selectedAccount: SocialAccount | null;
    selectedEmulator: Emulator | null;
  }) => ReactNode;
  onSubmit: (params: {
    formValues: any;
    accountId?: string;
    emulatorId?: string;
    agentId?: string;
    selectedAccount: SocialAccount | null;
    selectedEmulator: Emulator | null;
  }) => Promise<any>;
}

export function ActionFormWrapper({
  platform,
  action,
  title,
  description,
  platformDisplayName,
  submitButtonText = 'Add Task to Queue',
  submitButtonIcon,
  children,
  onSubmit,
}: ActionFormWrapperProps) {
  const router = useRouter();
  const [form] = Form.useForm();
  const { emulators, loading: loadingEmulators } = useAllEmulators(false, false, true);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selection = useAccountEmulatorSelection({ platform, loading });
  const {
    selectedAccount,
    selectedEmulator,
    resolveAccountAndEmulator,
  } = selection;

  const handleSubmit = async (values: any) => {
    try {
      setResult(null);
      setError(null);
      setLoading(true);

      const { accountId, emulatorId } = await resolveAccountAndEmulator(values);

      // Find agentId from selectedEmulator or from emulators
      let agentId: string | undefined;
      if (selectedEmulator?.agentId) {
        agentId = selectedEmulator.agentId;
      } else if (emulatorId) {
        const emulator = emulators.find(e => e.id === emulatorId);
        if (emulator?.agentId) {
          agentId = emulator.agentId;
        }
      }

      const result = await onSubmit({
        formValues: values,
        accountId,
        emulatorId,
        agentId,
        selectedAccount,
        selectedEmulator,
      });

      setResult(result);
      message.success('Task added to queue!');
    } catch (err: any) {
      const errorMessage = err.message || 'Error creating task';
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loadingEmulators) {
    return <Loading />;
  }

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
          Back
        </Button>
        <h1 style={{ margin: 0 }}>{title}</h1>
      </Space>

      <Card>
        {description && (
          <Alert
            title="Information"
            description={description}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <AccountEmulatorSelector
            platform={platform}
            emulators={emulators}
            loadingEmulators={loadingEmulators}
            form={form}
            loading={loading}
            platformDisplayName={platformDisplayName}
            selection={selection}
          />

          <Form.Item
            name="country_code"
            label="Country (optional)"
            tooltip="Only accounts from this country will receive the task when account is not specified"
          >
            <CountrySelect placeholder="Any country" />
          </Form.Item>

          {children({
            form,
            loading,
            selectedAccount,
            selectedEmulator,
          })}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={submitButtonIcon}
              loading={loading}
              size="large"
              block
            >
              {submitButtonText}
            </Button>
          </Form.Item>
        </Form>

        {error && (
          <Alert
            title="Error"
            description={error}
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {result && (
          <Result
            status="success"
            title="Task Added to Queue!"
            subTitle={
              <div>
                <p>
                  <strong>Task ID:</strong> {result.task_id || result.id}
                </p>
                <p>
                  <strong>Status:</strong> {result.status}
                </p>
                <p>
                  <strong>Platform:</strong> {result.platform || platform}
                </p>
                <p>
                  <strong>Action:</strong> {result.action || action}
                </p>
                {selectedAccount && (
                  <p>
                    <strong>Account:</strong> {selectedAccount.username}
                  </p>
                )}
                {selectedEmulator && (
                  <p>
                    <strong>Emulator:</strong> {selectedEmulator.name}
                  </p>
                )}
              </div>
            }
          />
        )}
      </Card>
    </div>
  );
}
