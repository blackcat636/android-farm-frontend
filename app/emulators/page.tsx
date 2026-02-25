'use client';

import { useEffect, useState } from 'react';
import { Table, Tag, Alert, Space, Tabs, Switch, Tooltip, Select, message, Modal, Button, InputNumber } from 'antd';
import { CopyOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { type Emulator } from '@/lib/api/agent';
import { useMemo } from 'react';
import { useAllEmulators } from '@/hooks/useAllEmulators';
import { createBackendClient, tokenStorage, type BackendEmulator } from '@/lib/api/backend';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';

export default function EmulatorsPage() {
  const [includeHiddenLive, setIncludeHiddenLive] = useState(false);
  const [agentFilter, setAgentFilter] = useState<string>('');
  const { emulators, loading, error, agentErrors } = useAllEmulators(false, includeHiddenLive);
  const [backendEmulators, setBackendEmulators] = useState<BackendEmulator[]>([]);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const [visibilityUpdating, setVisibilityUpdating] = useState<Record<string, boolean>>({});
  const [isTemplateUpdating, setIsTemplateUpdating] = useState<Record<string, boolean>>({});
  const [readinessUpdating, setReadinessUpdating] = useState<Record<string, boolean>>({});
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneTemplateId, setCloneTemplateId] = useState<string>('');
  const [cloneCount, setCloneCount] = useState(1);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BackendEmulator | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const agentOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    for (const e of emulators) {
      const id = e.agentId ?? (e as any).agent_id;
      const name = (e.agentName ?? (e as any).agent_name) || id;
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push({ id, name });
      }
    }
    return list;
  }, [emulators]);

  const filteredEmulators = agentFilter
    ? emulators.filter((e) => (e.agentId ?? (e as any).agent_id) === agentFilter)
    : emulators;

  // Список емуляторів з бекенду (БД) для управління видимістю
  const fetchBackendEmulators = async () => {
    const token = tokenStorage.get();
    if (!token) return;
    setLoadingBackend(true);
    try {
      const client = createBackendClient(token);
      const list = await client.getBackendEmulators({ include_hidden: true });
      setBackendEmulators(list);
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не вдалося завантажити список емуляторів');
    } finally {
      setLoadingBackend(false);
    }
  };

  useEffect(() => {
    const token = tokenStorage.get();
    if (token) fetchBackendEmulators();
  }, []);

  const handleEmulatorVisibilityChange = async (id: string, checked: boolean) => {
    const token = tokenStorage.get();
    if (!token) return;
    setVisibilityUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      const client = createBackendClient(token);
      await client.updateEmulator(id, { visibility: checked ? 1 : 0 });
      message.success(checked ? 'Видимість увімкнено' : 'Емулятор приховано');
      await fetchBackendEmulators();
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не вдалося оновити');
    } finally {
      setVisibilityUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleIsTemplateChange = async (id: string, checked: boolean) => {
    const token = tokenStorage.get();
    if (!token) return;
    setIsTemplateUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      const client = createBackendClient(token);
      await client.updateEmulator(id, { is_template: checked });
      message.success(checked ? 'Відмічено як шаблон' : 'Знято відмітку шаблону');
      await fetchBackendEmulators();
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не вдалося оновити');
    } finally {
      setIsTemplateUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleReadinessChange = async (id: string, value: string) => {
    const token = tokenStorage.get();
    if (!token) return;
    setReadinessUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      const client = createBackendClient(token);
      await client.updateEmulator(id, { readiness_status: value });
      message.success('Готовність оновлено');
      await fetchBackendEmulators();
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Не вдалося оновити');
    } finally {
      setReadinessUpdating((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleCloneClick = (record?: BackendEmulator) => {
    if (record && record.is_template) {
      setCloneTemplateId(record.id);
    } else {
      setCloneTemplateId(backendEmulators.find((e) => e.is_template)?.id || '');
    }
    setCloneCount(1);
    setCloneModalOpen(true);
  };

  const handleCloneConfirm = async () => {
    if (!cloneTemplateId) {
      message.error('Оберіть шаблон');
      return;
    }
    const token = tokenStorage.get();
    if (!token) return;
    setCloneLoading(true);
    try {
      const client = createBackendClient(token);
      await client.cloneEmulators(cloneTemplateId, cloneCount);
      message.success(`Клонування запущено (${cloneCount} шт.). Це може зайняти кілька хвилин.`);
      setCloneModalOpen(false);
      await fetchBackendEmulators();
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Помилка клонування');
    } finally {
      setCloneLoading(false);
    }
  };

  const handleDeleteClick = (record: BackendEmulator) => {
    setDeleteTarget(record);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const token = tokenStorage.get();
    if (!token) return;
    setDeleteLoading(true);
    try {
      const client = createBackendClient(token);
      await client.deleteEmulator(deleteTarget.id);
      message.success('Емулятор видалено');
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await fetchBackendEmulators();
    } catch (e: any) {
      message.error(e?.response?.data?.message || 'Помилка видалення');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleMarkReady = async (id: string) => {
    await handleReadinessChange(id, 'ready');
  };

  const columns: ColumnsType<Emulator> = [
    {
      title: 'ID',
      key: 'id',
      render: (_: unknown, record: Emulator) => record.emulatorId ?? record.id,
    },
    {
      title: 'Назва',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Agent',
      key: 'agent',
      render: (_: any, record: Emulator) => record.agentName ?? (record as any).agent_name ?? 'Unknown',
    },
    {
      title: 'UDID',
      dataIndex: 'udid',
      key: 'udid',
      render: (udid: string) => (
        <span style={{ fontSize: '12px', color: '#666' }}>{udid}</span>
      ),
    },
    {
      title: 'Device Name',
      dataIndex: 'deviceName',
      key: 'deviceName',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>{status}</Tag>
      ),
    },
  ];

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  const backendColumns: ColumnsType<BackendEmulator> = [
    {
      title: 'Агент',
      dataIndex: 'agent_id',
      key: 'agent_id',
    },
    {
      title: 'ID',
      dataIndex: 'emulator_id',
      key: 'emulator_id',
    },
    {
      title: 'Назва',
      key: 'emulator_name',
      render: (_: unknown, record: BackendEmulator) => record.emulator_name ?? record.emulator_id ?? record.id,
    },
    {
      title: 'Пристрій',
      dataIndex: 'device_name',
      key: 'device_name',
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'Видимість',
      key: 'visibility',
      render: (_: unknown, record: BackendEmulator) => {
        const visible = record.visibility === 1;
        return (
          <Tooltip title={visible ? 'Видимий: показується в API та отримує задачі' : 'Прихований: не показується та не отримує задачі'}>
            <Switch
              size="small"
              checked={visible}
              loading={visibilityUpdating[record.id]}
              onChange={(checked) => handleEmulatorVisibilityChange(record.id, checked)}
            />
          </Tooltip>
        );
      },
    },
    {
      title: 'Шаблон',
      key: 'is_template',
      render: (_: unknown, record: BackendEmulator) => (
        <Tooltip title="Шаблон для клонування. Не доступний для задач та біндінгу.">
          <Switch
            size="small"
            checked={!!record.is_template}
            loading={isTemplateUpdating[record.id]}
            onChange={(checked) => handleIsTemplateChange(record.id, checked)}
          />
        </Tooltip>
      ),
    },
    {
      title: 'Готовність',
      key: 'readiness_status',
      render: (_: unknown, record: BackendEmulator) => {
        const status = record.readiness_status || 'new';
        return (
          <Select
            size="small"
            value={status}
            style={{ width: 110 }}
            loading={readinessUpdating[record.id]}
            onChange={(v) => handleReadinessChange(record.id, v)}
            options={[
              { value: 'new', label: 'Новий' },
              { value: 'ready', label: 'Готовий' },
              { value: 'in_use', label: 'В роботі' },
            ]}
          />
        );
      },
    },
    {
      title: 'Дії',
      key: 'actions',
      render: (_: unknown, record: BackendEmulator) => (
        <Space>
          {(record.readiness_status || 'new') === 'new' && (
            <Tooltip title="Позначити як готовий">
              <Button
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleMarkReady(record.id)}
                loading={readinessUpdating[record.id]}
              />
            </Tooltip>
          )}
          <Tooltip title="Клонувати з шаблону">
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCloneClick(record)}
            />
          </Tooltip>
          <Tooltip title="Видалити емулятор">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteClick(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Emulators</h1>
      </div>

      <Tabs
        defaultActiveKey="live"
        items={[
          {
            key: 'live',
            label: 'Live (з агентів)',
            children: (
              <>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                  <Select
                    placeholder="Усі агенти"
                    allowClear
                    style={{ minWidth: 200 }}
                    value={agentFilter || undefined}
                    onChange={(v) => setAgentFilter(v ?? '')}
                    options={[
                      { value: '', label: 'Усі агенти' },
                      ...agentOptions.map((a) => ({ value: a.id, label: a.name })),
                    ]}
                  />
                  <Tooltip title="Показати емулятори з прихованою видимістю (з БД)">
                    <Space>
                      <span>Приховані</span>
                      <Switch
                        size="small"
                        checked={includeHiddenLive}
                        onChange={setIncludeHiddenLive}
                      />
                    </Space>
                  </Tooltip>
                </div>
                {Object.keys(agentErrors).length > 0 && (
                  <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                    {Object.entries(agentErrors).map(([agentId, errorMsg]) => (
                      <Alert
                        key={agentId}
                        message={`Помилка агента: ${agentId}`}
                        description={errorMsg}
                        type="warning"
                        showIcon
                        closable
                      />
                    ))}
                  </Space>
                )}
                <Table
                  columns={columns}
                  dataSource={filteredEmulators}
                  rowKey={(record) => `${record.agentId ?? (record as any).agent_id}-${record.id}`}
                  pagination={false}
                  style={{ marginTop: 24 }}
                />
              </>
            ),
          },
          {
            key: 'visibility',
            label: 'Управління видимістю',
            children: (
              <>
                <p style={{ color: '#666', marginBottom: 16 }}>
                  Видимі емулятори показуються в API та отримують задачі з черги. Приховані — ні. Шаблонні — тільки для клонування. Для задач і біндінгу доступні тільки з готовністю «Готовий» або «В роботі».
                </p>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<CopyOutlined />} onClick={() => handleCloneClick()}>
                    Клонувати з шаблону
                  </Button>
                </div>
                <Table
                  columns={backendColumns}
                  dataSource={backendEmulators}
                  rowKey="id"
                  loading={loadingBackend}
                  pagination={{ pageSize: 20 }}
                  style={{ marginTop: 24 }}
                />
              </>
            ),
          },
        ]}
      />

      <Modal
        title="Клонувати емулятори"
        open={cloneModalOpen}
        onOk={handleCloneConfirm}
        onCancel={() => setCloneModalOpen(false)}
        confirmLoading={cloneLoading}
        okText="Клонувати"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <span style={{ marginRight: 8 }}>Шаблон:</span>
            <Select
              style={{ minWidth: 200 }}
              value={cloneTemplateId || undefined}
              onChange={setCloneTemplateId}
              placeholder="Оберіть шаблон"
              options={backendEmulators
                .filter((e) => e.is_template)
                .map((e) => ({ value: e.id, label: `${e.emulator_name || e.emulator_id} (${e.agent_id})` }))}
            />
          </div>
          <div>
            <span style={{ marginRight: 8 }}>Кількість:</span>
            <InputNumber
              min={1}
              max={10}
              value={cloneCount}
              onChange={(v) => setCloneCount(v ?? 1)}
            />
          </div>
          <p style={{ color: '#666', fontSize: 12 }}>
            Клонування може зайняти кілька хвилин на кожен емулятор.
          </p>
        </Space>
      </Modal>

      <Modal
        title="Видалити емулятор"
        open={deleteModalOpen}
        onOk={handleDeleteConfirm}
        onCancel={() => { setDeleteModalOpen(false); setDeleteTarget(null); }}
        confirmLoading={deleteLoading}
        okText="Видалити"
        okButtonProps={{ danger: true }}
      >
        {deleteTarget && (
          <p>
            Видалити емулятор <strong>{deleteTarget.emulator_name || deleteTarget.emulator_id}</strong>?
            ВМ буде видалено з MEmu. Спочатку видаліть прив&apos;язки, якщо є.
          </p>
        )}
      </Modal>
    </div>
  );
}

