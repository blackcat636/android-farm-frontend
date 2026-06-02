'use client';

import { Form, Input, InputNumber, Switch, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { BrowserCatalogInputField } from '@/lib/api/backend';

interface Props {
  input: Record<string, BrowserCatalogInputField>;
  /** Form field name prefix, e.g. ['input_fields'] */
  namePrefix?: string[];
}

export default function BrowserScenarioInputForm({ input, namePrefix = [] }: Props) {
  const fields = Object.entries(input);
  if (fields.length === 0) return null;

  return (
    <>
      {fields.map(([key, field]) => {
        const fieldName = [...namePrefix, key];
        const label = (
          <span>
            {key}
            {field.required && <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>}
            {field.description && (
              <Tooltip title={field.description}>
                <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
              </Tooltip>
            )}
          </span>
        );

        const rules = field.required ? [{ required: true, message: `${key} is required` }] : [];
        const extra = field.description && (
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {field.description}
          </Typography.Text>
        );

        if (field.type === 'boolean') {
          return (
            <Form.Item
              key={key}
              name={fieldName}
              label={label}
              valuePropName="checked"
              initialValue={field.default as boolean ?? false}
              extra={extra}
            >
              <Switch />
            </Form.Item>
          );
        }

        if (field.type === 'number') {
          return (
            <Form.Item
              key={key}
              name={fieldName}
              label={label}
              rules={rules}
              initialValue={field.default as number}
              extra={extra}
            >
              <InputNumber style={{ width: '100%' }} placeholder={String(field.default ?? '')} />
            </Form.Item>
          );
        }

        // string | url | default
        return (
          <Form.Item
            key={key}
            name={fieldName}
            label={label}
            rules={[
              ...rules,
              ...(field.type === 'url' ? [{ type: 'url' as const, message: 'Enter a valid URL' }] : []),
            ]}
            initialValue={field.default as string ?? undefined}
            extra={extra}
          >
            <Input
              placeholder={
                field.type === 'url' ? 'https://...' : String(field.default ?? '')
              }
            />
          </Form.Item>
        );
      })}
    </>
  );
}
