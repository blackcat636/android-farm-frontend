'use client';

import { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Select,
  Card,
  Statistic,
  Row,
  Col,
  Button,
  Space,
  Input,
  Modal,
  Image,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, EyeOutlined, CheckOutlined } from '@ant-design/icons';
import { createBackendClient, tokenStorage, type CaptchaRequest } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

export default function CaptchaPage() {
  const { user } = useAuth();
  const [captchas, setCaptchas] = useState<CaptchaRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: undefined as 'waiting' | 'solved' | 'timeout' | 'cancelled' | undefined,
    platform: undefined as string | undefined,
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [selectedCaptcha, setSelectedCaptcha] = useState<CaptchaRequest | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loadingScreenshot, setLoadingScreenshot] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchCaptchas = async (page = 1) => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      const response = await backendClient.getCaptchas({
        status: filters.status,
        platform: filters.platform,
        page,
        limit: pagination.pageSize,
      });

      setCaptchas(response.data || []);
      setPagination({
        current: response.page || page,
        pageSize: response.limit || pagination.pageSize,
        total: response.total || 0,
      });
    } catch (err: any) {
      setError(err.message || 'Error loading captchas');
      message.error(err.message || 'Error loading captchas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCaptchas(pagination.current);
    }
  }, [user, filters.status, filters.platform]);

  const handleTableChange = (newPagination: any) => {
    fetchCaptchas(newPagination.current);
  };

  const handleSubmitCode = async () => {
    if (!selectedCaptcha || !codeInput.trim()) {
      message.warning('Enter captcha code');
      return;
    }

    try {
      setSubmitting(true);
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      await backendClient.submitCaptchaCode(selectedCaptcha.id, codeInput.trim());
      message.success('Captcha code submitted successfully');
      setModalVisible(false);
      setCodeInput('');
      setSelectedCaptcha(null);
      fetchCaptchas(pagination.current);
    } catch (err: any) {
      message.error(err.message || 'Error submitting captcha code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewCaptcha = async (captcha: CaptchaRequest) => {
    setSelectedCaptcha(captcha);
    setCodeInput('');
    setScreenshotUrl(null);
    setModalVisible(true);
    
    // Отримуємо signed URL для зображення
    try {
      setLoadingScreenshot(true);
      const token = tokenStorage.get();
      if (!token) {
        throw new Error('Authorization required');
      }

      const backendClient = createBackendClient(token);
      const response = await backendClient.getCaptchaScreenshotUrl(captcha.id);
      setScreenshotUrl(response.url);
    } catch (err: any) {
      message.error(err.message || 'Error loading image');
      // Якщо не вдалося отримати signed URL, використовуємо оригінальний URL
      setScreenshotUrl(captcha.screenshot_url);
    } finally {
      setLoadingScreenshot(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      waiting: 'orange',
      solved: 'green',
      timeout: 'red',
      cancelled: 'default',
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      waiting: 'Waiting',
      solved: 'Solved',
      timeout: 'Timeout',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  };

  const columns: ColumnsType<CaptchaRequest> = [
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Account',
      dataIndex: 'account',
      key: 'account',
      render: (account) => {
        if (account) {
          return (
            <Tag color="purple">
              {account.username} {account.email && `(${account.email})`}
            </Tag>
          );
        }
        return <Tag color="gray">-</Tag>;
      },
    },
    {
      title: 'Emulator',
      dataIndex: 'emulator_id',
      key: 'emulator_id',
      render: (text) => text ? <Tag>{text}</Tag> : '-',
    },
    {
      title: 'Agent',
      dataIndex: 'agent_id',
      key: 'agent_id',
      render: (text) => text ? <Tag>{text}</Tag> : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code) => code ? <Tag color="green">{code}</Tag> : '-',
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
        render: (text) => new Date(text).toLocaleString('en-US'),
    },
    {
      title: 'Expires',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (text) => {
        const expiresAt = new Date(text);
        const now = new Date();
        const isExpired = expiresAt < now;
        return (
          <span style={{ color: isExpired ? 'red' : 'inherit' }}>
            {expiresAt.toLocaleString('en-US')}
          </span>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: CaptchaRequest) => (
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewCaptcha(record)}
          >
            View
          </Button>
          {record.status === 'waiting' && (
            <Button
              type="text"
              icon={<CheckOutlined />}
              size="small"
              onClick={() => handleViewCaptcha(record)}
            >
              Enter Code
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const stats = {
    total: pagination.total,
    waiting: captchas.filter((c) => c.status === 'waiting').length,
    solved: captchas.filter((c) => c.status === 'solved').length,
    timeout: captchas.filter((c) => c.status === 'timeout').length,
  };

  if (loading && !captchas.length) {
    return <Loading />;
  }

  if (error && !captchas.length) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Captcha</h1>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => fetchCaptchas(pagination.current)}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Всього" value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Waiting"
              value={stats.waiting}
              styles={{ content: { color: '#faad14' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Solved"
              value={stats.solved}
              styles={{ content: { color: '#3f8600' } }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Timeout"
              value={stats.timeout}
              styles={{ content: { color: '#cf1322' } }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Select
            placeholder="Filter by status"
            style={{ width: 200 }}
            allowClear
            value={filters.status}
            onChange={(value) => {
              setFilters({ ...filters, status: value });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Select.Option value="waiting">Waiting</Select.Option>
            <Select.Option value="solved">Solved</Select.Option>
            <Select.Option value="timeout">Timeout</Select.Option>
            <Select.Option value="cancelled">Cancelled</Select.Option>
          </Select>

          <Select
            placeholder="Filter by platform"
            style={{ width: 200 }}
            allowClear
            value={filters.platform}
            onChange={(value) => {
              setFilters({ ...filters, platform: value });
              setPagination({ ...pagination, current: 1 });
            }}
          >
            <Select.Option value="youtube">YouTube</Select.Option>
            <Select.Option value="instagram">Instagram</Select.Option>
          </Select>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={captchas}
        rowKey="id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} captchas`,
        }}
        onChange={handleTableChange}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ margin: 0 }}>
              <p><strong>Captcha ID:</strong> {record.id}</p>
              {record.account_id && (
                <p><strong>Account ID:</strong> {record.account_id}</p>
              )}
              {record.task_id && (
                <p><strong>Task ID:</strong> {record.task_id}</p>
              )}
              {record.agent_id && (
                <p><strong>Agent ID:</strong> {record.agent_id}</p>
              )}
              {record.emulator_id && (
                <p><strong>Emulator ID:</strong> {record.emulator_id}</p>
              )}
              <p><strong>Screenshot:</strong> <a href={record.screenshot_url} target="_blank" rel="noopener noreferrer">View</a></p>
              <p><strong>Created:</strong> {new Date(record.created_at).toLocaleString('en-US')}</p>
              <p><strong>Updated:</strong> {new Date(record.updated_at).toLocaleString('en-US')}</p>
              {record.expires_at && (
                <p><strong>Expires:</strong> {new Date(record.expires_at).toLocaleString('en-US')}</p>
              )}
            </div>
          ),
        }}
      />

      <Modal
        title="Captcha"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setCodeInput('');
          setScreenshotUrl(null);
          setSelectedCaptcha(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setModalVisible(false);
            setCodeInput('');
            setScreenshotUrl(null);
            setSelectedCaptcha(null);
          }}>
            Close
          </Button>,
          selectedCaptcha?.status === 'waiting' && (
            <Button
              key="submit"
              type="primary"
              loading={submitting}
              onClick={handleSubmitCode}
            >
              Submit Code
            </Button>
          ),
        ]}
        width={800}
      >
        {selectedCaptcha && (
          <div>
            <div style={{ marginBottom: 16 }}>
              {loadingScreenshot ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  Loading image...
                </div>
              ) : (
                <div>
                  <Image
                    src={screenshotUrl || selectedCaptcha.screenshot_url}
                    alt="Captcha screenshot"
                    style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                    preview={false}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                    onError={(e) => {
                      console.error('Failed to load captcha image:', screenshotUrl || selectedCaptcha.screenshot_url);
                      message.error('Failed to load captcha image');
                      // Спробуємо використати прямий URL якщо signed URL не працює
                      if (screenshotUrl && screenshotUrl !== selectedCaptcha.screenshot_url) {
                        const img = e.target as HTMLImageElement;
                        img.src = selectedCaptcha.screenshot_url;
                      }
                    }}
                    onLoad={() => {
                      console.log('Captcha image loaded successfully');
                    }}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                    URL: {screenshotUrl || selectedCaptcha.screenshot_url}
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <p><strong>Platform:</strong> {selectedCaptcha.platform}</p>
              {selectedCaptcha.account && (
                <p><strong>Account:</strong> {selectedCaptcha.account.username} {selectedCaptcha.account.email && `(${selectedCaptcha.account.email})`}</p>
              )}
              <p><strong>Status:</strong> <Tag color={getStatusColor(selectedCaptcha.status)}>{getStatusLabel(selectedCaptcha.status)}</Tag></p>
              {selectedCaptcha.code && (
                <p><strong>Code:</strong> <Tag color="green">{selectedCaptcha.code}</Tag></p>
              )}
              <p><strong>Created:</strong> {new Date(selectedCaptcha.created_at).toLocaleString('en-US')}</p>
              <p><strong>Expires:</strong> {new Date(selectedCaptcha.expires_at).toLocaleString('en-US')}</p>
            </div>
            {selectedCaptcha.status === 'waiting' && (
              <div>
                <Input
                  placeholder="Enter captcha code"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onPressEnter={handleSubmitCode}
                  maxLength={20}
                  style={{ marginBottom: 8 }}
                />
                <p style={{ color: '#999', fontSize: 12 }}>
                  Enter the code from the captcha image above
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

