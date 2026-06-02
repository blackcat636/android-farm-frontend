'use client';

import {
  ApiOutlined,
  CheckCircleOutlined,
  EyeInvisibleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  App,
  Badge,
  Button,
  Card,
  Descriptions,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createBackendClient,
  tokenStorage,
  type Agent,
  type BrowserCapabilityOverride,
  type BrowserCatalogInputField,
  type BrowserCatalogScenario,
  type BrowserVisibility,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';

const VISIBILITY_OPTIONS: { value: BrowserVisibility; label: string; color: string }[] = [
  { value: 'hidden', label: 'hidden', color: 'default' },
  { value: 'admin', label: 'admin', color: 'orange' },
  { value: 'user', label: 'user', color: 'green' },
  { value: 'operator', label: 'operator', color: 'blue' },
  { value: 'internal', label: 'internal', color: 'purple' },
];

type ScenarioRow = {
  key: string;
  platform: string;
  scenario: string;
  label: string;
  minTier?: string;
  visibility: BrowserVisibility;
  override?: BrowserCapabilityOverride;
  input?: Record<string, BrowserCatalogInputField>;
  isNew: boolean;
};

export default function CatalogManagementPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [overrides, setOverrides] = useState<BrowserCapabilityOverride[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);
  const [filterVisibility, setFilterVisibility] = useState<BrowserVisibility | null>(null);

  const getClient = useCallback(() => {
    const token = tokenStorage.get();
    if (!token) throw new Error('No token');
    return createBackendClient(token);
  }, []);

  // Load browser agents list
  useEffect(() => {
    if (!user) return;
    getClient()
      .getAgents(true)
      .then((all) => {
        const browserAgents = all.filter((a) => a.type === 'browser');
        setAgents(browserAgents);
        if (browserAgents.length > 0) setSelectedAgentId(browserAgents[0].id);
      })
      .catch(() => setAgents([]))
      .finally(() => setAgentsLoading(false));
  }, [user, getClient]);

  const buildRows = useCallback(
    (
      platforms: Array<{ name: string; label?: string; scenarios: BrowserCatalogScenario[] }>,
      ovs: BrowserCapabilityOverride[],
    ): ScenarioRow[] => {
      const rows: ScenarioRow[] = [];
      for (const plat of platforms) {
        for (const scen of plat.scenarios) {
          const override = ovs.find(
            (o) => o.scope === 'scenario' && o.platform === plat.name && o.name === scen.name,
          );
          const isNew = !override;
          const visibility: BrowserVisibility = override?.visibility_override ?? 'hidden';

          rows.push({
            key: `${plat.name}:${scen.name}`,
            platform: plat.name,
            scenario: scen.name,
            label: scen.label || scen.name,
            minTier: scen.minTier,
            visibility,
            override,
            input: scen.input,
            isNew,
          });
        }
      }
      return rows;
    },
    [],
  );

  const loadCatalog = useCallback(async () => {
    if (!selectedAgentId) return;
    setLoading(true);
    try {
      const client = getClient();
      const [catalog, ovs] = await Promise.all([
        client.getBrowserCatalog(selectedAgentId, 'operator'),
        client.getBrowserCapabilityOverrides(),
      ]);
      setOverrides(ovs);
      setScenarios(buildRows(catalog.platforms, ovs));
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId, getClient, buildRows, message]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const handleRefresh = async () => {
    if (!selectedAgentId) return;
    try {
      await getClient().invalidateBrowserCatalogCache(selectedAgentId);
      await loadCatalog();
      message.success('Cache invalidated, catalog refreshed');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Refresh failed');
    }
  };

  const handleVisibilityChange = async (row: ScenarioRow, visibility: BrowserVisibility) => {
    setSavingKey(row.key);
    try {
      await getClient().upsertCatalogOverride(row.platform, row.scenario, visibility, overrides);
      message.success(`${row.platform}/${row.scenario} → ${visibility}`);
      await loadCatalog();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingKey(null);
    }
  };

  const platforms = useMemo(
    () => [...new Set(scenarios.map((s) => s.platform))],
    [scenarios],
  );

  const filteredRows = useMemo(() => {
    return scenarios.filter((row) => {
      if (filterPlatform && row.platform !== filterPlatform) return false;
      if (filterVisibility && row.visibility !== filterVisibility) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        return (
          row.platform.includes(q) ||
          row.scenario.includes(q) ||
          row.label.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scenarios, filterPlatform, filterVisibility, searchText]);

  const newCount = useMemo(() => scenarios.filter((s) => s.isNew).length, [scenarios]);
  const enabledCount = useMemo(
    () => scenarios.filter((s) => s.visibility !== 'hidden').length,
    [scenarios],
  );

  const columns: ColumnsType<ScenarioRow> = [
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      width: 120,
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Scenario',
      dataIndex: 'scenario',
      key: 'scenario',
      render: (v, row) => (
        <Space>
          <span style={{ fontFamily: 'monospace' }}>{v}</span>
          {row.isNew && <Badge count="new" style={{ backgroundColor: '#faad14', fontSize: 10 }} />}
        </Space>
      ),
    },
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      render: (v, row) => (
        <span style={{ color: row.label === row.scenario ? '#999' : undefined }}>{v}</span>
      ),
    },
    {
      title: 'Min tier',
      dataIndex: 'minTier',
      key: 'minTier',
      width: 110,
      render: (v) => {
        if (!v) return <span style={{ color: '#ccc' }}>—</span>;
        const color = v === 'curl' ? 'green' : v === 'playwright' ? 'orange' : 'red';
        return <Tag color={color}>{v}</Tag>;
      },
    },
    {
      title: 'Visibility',
      dataIndex: 'visibility',
      key: 'visibility',
      width: 180,
      render: (v: BrowserVisibility, row) => {
        const isSaving = savingKey === row.key;
        return (
          <Select
            size="small"
            value={v}
            loading={isSaving}
            disabled={isSaving}
            style={{ width: 140 }}
            onChange={(val) => handleVisibilityChange(row, val)}
            options={VISIBILITY_OPTIONS.map((opt) => ({
              value: opt.value,
              label: (
                <Space size={4}>
                  {opt.value === 'hidden' ? (
                    <EyeInvisibleOutlined style={{ color: '#999' }} />
                  ) : (
                    <CheckCircleOutlined style={{ color: opt.color === 'green' ? '#52c41a' : opt.color === 'orange' ? '#fa8c16' : '#1677ff' }} />
                  )}
                  <span>{opt.label}</span>
                </Space>
              ),
            }))}
          />
        );
      },
    },
  ];

  if (!user) return <Loading />;

  return (
    <div>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Catalog Management
          </Typography.Title>
          <Typography.Text type="secondary">
            All scenarios from the browser-agent. Set visibility to enable them in Queue modal or Cabinet.
          </Typography.Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            disabled={!selectedAgentId || loading}
          >
            Refresh from agent
          </Button>
        </Space>
      </Space>

      {/* Stats + agent selector */}
      <Space style={{ marginBottom: 16, width: '100%' }} wrap>
        {agents.length > 1 && (
          <Select
            loading={agentsLoading}
            value={selectedAgentId}
            onChange={setSelectedAgentId}
            style={{ minWidth: 200 }}
            placeholder="Select agent"
            options={agents.map((a) => ({
              value: a.id,
              label: (
                <Space>
                  <ApiOutlined />
                  <span>{a.name || a.id.slice(0, 8)}</span>
                  {a.visibility === 0 && <Tag color="red">hidden</Tag>}
                </Space>
              ),
            }))}
          />
        )}

        <Space>
          <Tag color="blue">{scenarios.length} total</Tag>
          <Tag color="green">{enabledCount} enabled</Tag>
          {newCount > 0 && <Tag color="gold">{newCount} new</Tag>}
        </Space>
      </Space>

      {/* Filters */}
      <Space style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Search scenario..."
          allowClear
          style={{ width: 220 }}
          onSearch={setSearchText}
          onChange={(e) => !e.target.value && setSearchText('')}
        />
        <Select
          allowClear
          placeholder="Platform"
          style={{ width: 140 }}
          value={filterPlatform}
          onChange={(v) => setFilterPlatform(v ?? null)}
          options={platforms.map((p) => ({ value: p, label: p }))}
        />
        <Select
          allowClear
          placeholder="Visibility"
          style={{ width: 130 }}
          value={filterVisibility}
          onChange={(v) => setFilterVisibility(v ?? null)}
          options={VISIBILITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </Space>

      <Table
        rowKey="key"
        loading={loading}
        dataSource={filteredRows}
        columns={columns}
        size="small"
        pagination={{ pageSize: 50, showTotal: (t) => `Total ${t}` }}
        expandable={{
          rowExpandable: (row) => !!row.input && Object.keys(row.input).length > 0,
          expandedRowRender: (row) => {
            if (!row.input) return null;
            const fields = Object.entries(row.input);
            return (
              <Card size="small" style={{ margin: '4px 0', background: '#fafafa' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Input schema ({fields.length} fields):
                </Typography.Text>
                <Descriptions
                  size="small"
                  column={3}
                  style={{ marginTop: 6 }}
                  items={fields.map(([key, field]) => ({
                    key,
                    label: (
                      <Space size={4}>
                        <code style={{ fontSize: 11 }}>{key}</code>
                        {field.required && <Tag color="red" style={{ fontSize: 10 }}>required</Tag>}
                      </Space>
                    ),
                    children: (
                      <span style={{ fontSize: 12 }}>
                        <Tag>{field.type || 'string'}</Tag>
                        {field.description && (
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                            {field.description}
                          </Typography.Text>
                        )}
                        {field.default !== undefined && (
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                            {' '}default: <code>{String(field.default)}</code>
                          </Typography.Text>
                        )}
                      </span>
                    ),
                  }))}
                />
              </Card>
            );
          },
        }}
      />
    </div>
  );
}
