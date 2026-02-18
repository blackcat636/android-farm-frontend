'use client';

import { useEffect, useState } from 'react';
import { Table, Tag, Alert, Space, Tabs, Switch, Tooltip, Select, message } from 'antd';
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

  const columns: ColumnsType<Emulator> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Name',
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
      title: 'ID емулятора',
      dataIndex: 'emulator_id',
      key: 'emulator_id',
    },
    {
      title: 'Назва',
      dataIndex: 'emulator_name',
      key: 'emulator_name',
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
                  Видимі емулятори показуються в API та отримують задачі з черги. Приховані — ні. Новий емулятор після sync за замовчуванням прихований; увімкніть видимість, щоб він зʼявився в списках та отримував задачі.
                </p>
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
    </div>
  );
}

