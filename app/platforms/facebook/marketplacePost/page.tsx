'use client';

import { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Result, Select, Switch } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import {
  createBackendClient,
  tokenStorage,
  type FacebookMarketplaceOptions,
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

function defaultScheduledLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ScheduledAtField({ form, loading }: { form: { getFieldValue: (n: string) => unknown; setFieldsValue: (v: object) => void }; loading: boolean }) {
  useEffect(() => {
    const cur = form.getFieldValue('scheduled_at');
    if (cur === undefined || cur === '') {
      form.setFieldsValue({ scheduled_at: defaultScheduledLocal() });
    }
  }, [form]);
  return (
    <Form.Item
      name="scheduled_at"
      label="Publish at (local time)"
      rules={[{ required: true, message: 'Select date and time' }]}
    >
      <Input type="datetime-local" disabled={loading} />
    </Form.Item>
  );
}

export default function FacebookMarketplacePostPage() {
  const [fbOptions, setFbOptions] = useState<FacebookMarketplaceOptions | null>(null);

  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) return;
    let cancelled = false;
    createBackendClient(token)
      .getFacebookMarketplaceOptions()
      .then((data) => {
        if (!cancelled) setFbOptions(data);
      })
      .catch(() => {
        if (!cancelled) setFbOptions(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ActionFormWrapper
      platform="facebook"
      action="marketplacePost"
      title="Facebook Marketplace Post"
      description="Create a scheduled Marketplace listing. It is stored and enqueued at the chosen time. Account/emulator selection is optional but recommended."
      platformDisplayName="Facebook"
      submitButtonText="Schedule listing"
      submitButtonIcon={<FileTextOutlined />}
      successMessage="Listing saved"
      renderResult={(payload: { listing?: { id: string; status: string; scheduled_at: string }; moderation?: { request_id: string } }) => {
        const listing = payload?.listing;
        if (!listing) return null;
        return (
          <Result
            status="success"
            title={payload.moderation?.request_id ? 'Submitted for moderation' : 'Listing scheduled'}
            subTitle={
              <div>
                <p>
                  <strong>Listing ID:</strong> {listing.id}
                </p>
                <p>
                  <strong>Status:</strong> {listing.status}
                </p>
                <p>
                  <strong>Scheduled at:</strong> {new Date(listing.scheduled_at).toLocaleString()}
                </p>
                {payload.moderation?.request_id && (
                  <p>
                    <strong>Moderation request:</strong> {payload.moderation.request_id}
                  </p>
                )}
              </div>
            }
          />
        );
      }}
      onSubmit={async ({ formValues, accountId, emulatorId, agentId }) => {
        const token = tokenStorage.get();
        if (!token) {
          throw new Error('Authorization required');
        }

        const scheduledLocal = formValues.scheduled_at as string | undefined;
        if (!scheduledLocal) {
          throw new Error('Select schedule date and time');
        }
        const scheduled_at = new Date(scheduledLocal).toISOString();

        const backendClient = createBackendClient(token);

        const params: FacebookMarketplacePostParams = {
          title: formValues.title?.trim(),
          description: formValues.description?.trim(),
          price: formValues.price != null ? String(formValues.price) : undefined,
          imageUrls: splitLines(formValues.imageUrls),
          imagePaths: splitLines(formValues.imagePaths),
          location: formValues.location?.trim() || undefined,
          category: (formValues.category as string | undefined)?.trim() || undefined,
          condition: (formValues.condition as string | undefined)?.trim() || undefined,
          listingType: (formValues.listingType as string | undefined)?.trim() || undefined,
        };

        const res = await backendClient.createMarketplaceListing({
          title: params.title!,
          description: params.description!,
          price: params.price,
          scheduled_at,
          social_account_id: accountId,
          emulator_id: emulatorId,
          agent_id: agentId,
          requireSession: Boolean(formValues.requireSession),
          country_code: formValues.country_code || null,
          imageUrls: params.imageUrls,
          imagePaths: params.imagePaths,
          location: params.location,
          category: params.category,
          condition: params.condition,
          listingType: params.listingType,
          submitPublish: formValues.submitPublish !== false,
        });

        return { listing: res.listing, moderation: res.moderation };
      }}
    >
      {({ loading, form }) => (
        <>
          <ScheduledAtField form={form} loading={loading} />

          <Form.Item
            name="listingType"
            label="Listing type"
            tooltip="Matches Facebook Marketplace create flow; the agent taps this label on device."
            initialValue="One item"
          >
            <Select
              allowClear
              placeholder={fbOptions ? 'Select type' : 'Loading…'}
              disabled={loading || !fbOptions}
              options={(fbOptions?.listingTypes || []).map((t) => ({ value: t, label: t }))}
            />
          </Form.Item>

          <Form.Item
            name="title"
            label="Listing Title"
            rules={[{ required: true, message: 'Enter listing title' }]}
          >
            <Input
              placeholder="Example: iPhone 13 Pro 256GB"
              disabled={loading}
              maxLength={500}
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
              maxLength={8000}
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
            <Input placeholder="City or area" disabled={loading} maxLength={256} />
          </Form.Item>

          <Form.Item name="category" label="Category (optional)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={fbOptions ? 'Select category' : 'Loading…'}
              disabled={loading || !fbOptions}
              options={(fbOptions?.categories || []).map((c) => ({ value: c, label: c }))}
            />
          </Form.Item>

          <Form.Item name="condition" label="Condition (optional)">
            <Select
              allowClear
              placeholder={fbOptions ? 'Select condition' : 'Loading…'}
              disabled={loading || !fbOptions}
              options={(fbOptions?.conditions || []).map((c) => ({ value: c, label: c }))}
            />
          </Form.Item>

          <Form.Item
            name="submitPublish"
            label="Submit publish on device"
            valuePropName="checked"
            initialValue={true}
            tooltip="If off, the agent fills the form only (phased rollout); listing will not be marked published."
          >
            <Switch disabled={loading} />
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
