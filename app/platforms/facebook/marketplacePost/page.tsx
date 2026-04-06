'use client';

import { Form, Input, InputNumber, Switch } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import {
  createBackendClient,
  tokenStorage,
  type FacebookMarketplacePostParams,
} from '@/lib/api/backend';
import { ActionFormWrapper } from '@/components/platforms/ActionFormWrapper';

const { TextArea } = Input;

function splitLines(value?: string): string[] | undefined {
  if (!value) return undefined;
  const lines = value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.length ? lines : undefined;
}

export default function FacebookMarketplacePostPage() {
  return (
    <ActionFormWrapper
      platform="facebook"
      action="marketplacePost"
      title="Facebook Marketplace Post"
      description="Create a queue task for Facebook Marketplace posting. This is a dedicated form for the agent scenario skeleton and future UI-dump-driven steps."
      platformDisplayName="Facebook"
      submitButtonText="Add Marketplace Task to Queue"
      submitButtonIcon={<FileTextOutlined />}
      onSubmit={async ({ formValues, accountId, emulatorId, agentId }) => {
        const token = tokenStorage.get();
        if (!token) {
          throw new Error('Authorization required');
        }

        const backendClient = createBackendClient(token);

        const params: FacebookMarketplacePostParams = {
          title: formValues.title?.trim(),
          description: formValues.description?.trim(),
          price: formValues.price != null ? String(formValues.price) : undefined,
          imageUrls: splitLines(formValues.imageUrls),
          imagePaths: splitLines(formValues.imagePaths),
          location: formValues.location?.trim() || undefined,
          category: formValues.category?.trim() || undefined,
        };

        const task = await backendClient.addFacebookMarketplaceTask({
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
          platform: 'facebook',
          action: 'marketplacePost',
        };
      }}
    >
      {({ loading }) => (
        <>
          <Form.Item
            name="title"
            label="Listing Title"
            rules={[{ required: true, message: 'Enter listing title' }]}
          >
            <Input
              placeholder="Example: iPhone 13 Pro 256GB"
              disabled={loading}
              maxLength={120}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Enter description' }]}
          >
            <TextArea
              rows={5}
              placeholder="Describe item condition, accessories, delivery terms..."
              disabled={loading}
              maxLength={4000}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="price"
            label="Price"
            rules={[{ required: true, message: 'Enter price' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="699.99"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="imageUrls"
            label="Image URLs (optional)"
            tooltip="One URL per line. Agent can download these images to emulator in later scenario iterations."
          >
            <TextArea
              rows={4}
              placeholder={'https://example.com/img1.jpg\nhttps://example.com/img2.jpg'}
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="imagePaths"
            label="Image Paths on Emulator (optional)"
            tooltip="One emulator path per line, for media already present on device."
          >
            <TextArea
              rows={3}
              placeholder={'/sdcard/Download/item1.jpg\n/sdcard/Pictures/item2.jpg'}
              disabled={loading}
            />
          </Form.Item>

          <Form.Item name="location" label="Location (optional)">
            <Input placeholder="City or area" disabled={loading} maxLength={120} />
          </Form.Item>

          <Form.Item name="category" label="Category (optional)">
            <Input placeholder="Electronics, Furniture..." disabled={loading} maxLength={80} />
          </Form.Item>

          <Form.Item
            name="requireSession"
            label="Require session"
            valuePropName="checked"
            tooltip="If enabled, task fails when account session is missing."
          >
            <Switch disabled={loading} />
          </Form.Item>
        </>
      )}
    </ActionFormWrapper>
  );
}

