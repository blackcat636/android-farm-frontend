'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  App,
  Button,
  Card,
  Descriptions,
  Input,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { createBackendClient, tokenStorage, ModerationRequestItem } from '@/lib/api/backend';
import { can } from '@/lib/auth/permissions';

const { Text, Paragraph } = Typography;

const STATUS_COLOR: Record<string, string> = {
  pending: 'orange',
  approved: 'blue',
  rejected: 'red',
  executed: 'green',
  failed: 'volcano',
  awaiting_account: 'gold',
};

const KIND_LABEL: Record<string, string> = {
  'queue.create': 'Queue Task',
  'marketplace_listing.create': 'Marketplace Listing',
  'user_posts.create': 'User Post',
  'user_posts.process': 'User Post Process',
};

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?.*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|avi|mkv|m4v)(\?.*)?$/i;

function MediaValue({ value }: { value: unknown }) {
  if (typeof value !== 'string') {
    if (typeof value === 'object') {
      return <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(value, null, 2)}</pre>;
    }
    return <Text>{String(value)}</Text>;
  }

  const isUrl = value.startsWith('http://') || value.startsWith('https://');
  if (!isUrl) return <Text>{value}</Text>;

  if (IMAGE_EXT.test(value)) {
    return (
      <Space direction="vertical" size={4}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="preview" style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 4, objectFit: 'contain' }} />
        <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>{value}</a>
      </Space>
    );
  }

  if (VIDEO_EXT.test(value)) {
    return (
      <Space direction="vertical" size={4}>
        <video src={value} controls style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 4 }} />
        <a href={value} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>{value}</a>
      </Space>
    );
  }

  return <a href={value} target="_blank" rel="noreferrer">{value}</a>;
}

function PayloadBlock({ kind, payload }: { kind: string; payload: Record<string, unknown> }) {
  if (kind === 'queue.create') {
    const params = (payload.params as Record<string, unknown>) ?? {};
    const entries = Object.entries(params);
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Descriptions bordered size="small" column={1}>
          {payload.platform != null && (
            <Descriptions.Item label="Platform">{String(payload.platform)}</Descriptions.Item>
          )}
          {payload.action != null && (
            <Descriptions.Item label="Action">{String(payload.action)}</Descriptions.Item>
          )}
          {payload.requireSession !== undefined && (
            <Descriptions.Item label="Require Session">
              {payload.requireSession ? 'Yes' : 'No'}
            </Descriptions.Item>
          )}
          {payload.selectRandomAccount !== undefined && (
            <Descriptions.Item label="Account Selection">
              {payload.selectRandomAccount ? 'Random (auto)' : 'Pre-assigned'}
            </Descriptions.Item>
          )}
        </Descriptions>

        {entries.length > 0 && (
          <Card size="small" title="Post Parameters">
            <Descriptions bordered size="small" column={1}>
              {entries.map(([key, val]) => (
                <Descriptions.Item key={key} label={key}>
                  <MediaValue value={val} />
                </Descriptions.Item>
              ))}
            </Descriptions>
          </Card>
        )}
      </Space>
    );
  }

  if (kind === 'marketplace_listing.create') {
    return (
      <Descriptions bordered size="small" column={1}>
        {Object.entries(payload).map(([key, val]) => (
          <Descriptions.Item key={key} label={key}>
            {typeof val === 'object' ? (
              <pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(val, null, 2)}</pre>
            ) : (
              <Text>{String(val)}</Text>
            )}
          </Descriptions.Item>
        ))}
      </Descriptions>
    );
  }

  return (
    <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, fontSize: 12, margin: 0 }}>
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

export default function ModerationDetailPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [item, setItem] = useState<ModerationRequestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [note, setNote] = useState('');

  const canReview = can((user as any)?.permissions ?? [], 'moderation.review');

  const client = useMemo(() => {
    const token = tokenStorage.get();
    if (!token) return null;
    return createBackendClient(token);
  }, []);

  const load = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const data = await client.getModerationRequest(id);
      setItem(data);
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [client, id]);

  const handleApprove = async () => {
    if (!client) return;
    setActing(true);
    try {
      await client.approveModerationRequest(id, note || undefined);
      message.success('Approved');
      setNote('');
      await load();
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || 'Failed to approve');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!client) return;
    setActing(true);
    try {
      await client.rejectModerationRequest(id, note || undefined);
      message.success('Rejected');
      setNote('');
      await load();
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || 'Failed to reject');
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <Spin style={{ display: 'block', marginTop: 80, textAlign: 'center' }} />;
  }

  if (!item) return null;

  const isPending = item.status === 'pending';

  return (
    <div style={{ maxWidth: 800 }}>
      <Space style={{ marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/moderation')}>
          Back
        </Button>
      </Space>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Main info */}
        <Card>
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="ID" span={2}>
              <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Kind">
              <Tag>{KIND_LABEL[item.kind] ?? item.kind}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLOR[item.status] ?? 'default'}>{item.status}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Platform">{item.platform ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Action">{item.action ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Required Permission">
              <Text code>{item.required_permission}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="User ID">
              <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.user_id}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Created">{new Date(item.created_at).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Updated">{new Date(item.updated_at).toLocaleString()}</Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Payload */}
        <Card title="Payload">
          <PayloadBlock kind={item.kind} payload={item.payload} />
        </Card>

        {/* Review info */}
        {(item.reviewed_by || item.review_note || item.reviewed_at) && (
          <Card title="Review">
            <Descriptions bordered size="small" column={1}>
              {item.reviewed_by && (
                <Descriptions.Item label="Reviewed by">
                  <Text copyable style={{ fontFamily: 'monospace', fontSize: 12 }}>{item.reviewed_by}</Text>
                </Descriptions.Item>
              )}
              {item.reviewed_at && (
                <Descriptions.Item label="Reviewed at">
                  {new Date(item.reviewed_at).toLocaleString()}
                </Descriptions.Item>
              )}
              {item.review_note && (
                <Descriptions.Item label="Note">
                  <Paragraph style={{ margin: 0 }}>{item.review_note}</Paragraph>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}

        {/* Actions */}
        {canReview && (
          <Card title="Actions">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input.TextArea
                placeholder="Review note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                disabled={!isPending}
              />
              <Space>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  disabled={!isPending}
                  loading={acting}
                  onClick={handleApprove}
                >
                  Approve
                </Button>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  disabled={!isPending}
                  loading={acting}
                  onClick={handleReject}
                >
                  Reject
                </Button>
              </Space>
            </Space>
          </Card>
        )}
      </Space>
    </div>
  );
}
