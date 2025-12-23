'use client';

import { Form, Select, Radio, Alert, Tag, Switch, Tooltip } from 'antd';
import { UserOutlined, DesktopOutlined } from '@ant-design/icons';
import { type Emulator } from '@/lib/api/agent';
import { type SocialAccount, type AccountEmulatorBinding } from '@/lib/api/backend';
import { type UseAccountEmulatorSelectionReturn } from '@/hooks/useAccountEmulatorSelection';

export interface AccountEmulatorSelectorProps {
  platform: string;
  emulators: Emulator[];
  loadingEmulators: boolean;
  form: any;
  loading?: boolean;
  platformDisplayName?: string;
  selection: UseAccountEmulatorSelectionReturn;
}

export function AccountEmulatorSelector({
  platform,
  emulators,
  loadingEmulators,
  form,
  loading = false,
  platformDisplayName,
  selection,
}: AccountEmulatorSelectorProps) {
  const {
    selectionType,
    setSelectionType,
    accounts,
    loadingAccounts,
    selectedAccount,
    setSelectedAccount,
    binding,
    selectedEmulator,
    setSelectedEmulator,
  } = selection;

  const displayName = platformDisplayName || platform.toUpperCase();

  const handleSelectionTypeChange = (type: 'account' | 'emulator') => {
    setSelectionType(type);
    setSelectedAccount(null);
    form.setFieldsValue({ accountId: undefined, emulatorId: undefined });
  };

  const handleAccountChange = (value: string) => {
    const account = accounts.find(a => a.id === value);
    setSelectedAccount(account || null);
    form.setFieldsValue({ emulatorId: undefined });
  };

  const handleEmulatorChange = (value: string) => {
    const emulator = emulators.find(e => e.id === value);
    setSelectedEmulator(emulator || null);
  };

  return (
    <>
      <Form.Item
        label="Selection"
        rules={[{ required: true }]}
      >
        <Radio.Group
          value={selectionType}
          onChange={(e) => handleSelectionTypeChange(e.target.value)}
        >
          <Radio.Button value="account">
            <UserOutlined /> Use Account
          </Radio.Button>
          <Radio.Button value="emulator">
            <DesktopOutlined /> Use Emulator
          </Radio.Button>
        </Radio.Group>
      </Form.Item>

      {selectionType === 'account' && (
        <>
          <Form.Item
            name="accountId"
            label={`${displayName} Account`}
            rules={[{ required: true, message: 'Select account' }]}
          >
            <Select
              placeholder="Select account"
              disabled={loading || loadingAccounts}
              loading={loadingAccounts}
              onChange={handleAccountChange}
              notFoundContent={loadingAccounts ? 'Loading...' : 'No accounts found'}
            >
              {accounts.map((account) => {
                const isBlocked = account.blocked_until && new Date(account.blocked_until) > new Date();
                const blockedUntil = account.blocked_until ? new Date(account.blocked_until) : null;
                
                return (
                  <Select.Option 
                    key={account.id} 
                    value={account.id}
                    disabled={isBlocked}
                  >
                    <span>
                      {account.username} 
                      {account.status !== 'active' && ` (${account.status})`}
                      {isBlocked && (
                        <Tag color="red" style={{ marginLeft: 8 }}>
                          Blocked until {blockedUntil?.toLocaleString('en-US')}
                        </Tag>
                      )}
                    </span>
                </Select.Option>
                );
              })}
            </Select>
          </Form.Item>

          {selectedAccount && (
            <>
              <Alert
                title={
                  binding
                    ? `Binding to emulator: ${binding.emulator_id}`
                    : "Binding not found"
                }
                type={binding ? 'success' : 'warning'}
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Form.Item
                name="requireSession"
                label="Require Session"
                tooltip="If enabled, task execution will be blocked if session for account is not found. If disabled, task will execute even without session."
                valuePropName="checked"
                initialValue={false}
              >
                <Switch
                  checkedChildren="Required"
                  unCheckedChildren="Not Required"
                  disabled={loading}
                />
              </Form.Item>
            </>
          )}

          {selectedAccount && !binding && (
            <Form.Item
              name="emulatorId"
              label="Emulator for Binding"
              rules={[{ required: true, message: 'Select emulator for binding' }]}
              help="Select emulator to create binding with account. Disabled emulators will be automatically started."
            >
              <Select
                placeholder="Select emulator"
                disabled={loading || loadingEmulators}
                onChange={handleEmulatorChange}
              >
                {emulators.map((emulator) => (
                  <Select.Option key={`${emulator.agentId}-${emulator.id}`} value={emulator.id}>
                    <span>
                      {emulator.name} {emulator.agentName && `(${emulator.agentName})`}
                      {emulator.status !== 'active' && (
                        <Tag color="orange" style={{ marginLeft: 8 }}>Disabled</Tag>
                      )}
                    </span>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </>
      )}

      {selectionType === 'emulator' && (
        <Form.Item
          name="emulatorId"
          label="Emulator"
          rules={[{ required: true, message: 'Select emulator' }]}
        >
          <Select
            placeholder="Select emulator"
            disabled={loading || loadingEmulators}
            onChange={handleEmulatorChange}
          >
            {emulators.map((emulator) => (
              <Select.Option key={`${emulator.agentId}-${emulator.id}`} value={emulator.id}>
                <span>
                  {emulator.name} {emulator.agentName && `(${emulator.agentName})`}
                  {emulator.status !== 'active' && (
                    <Tag color="orange" style={{ marginLeft: 8 }}>Disabled</Tag>
                  )}
                </span>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      )}
    </>
  );
}
