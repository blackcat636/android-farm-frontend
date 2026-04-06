'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  message,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  authApi,
  type EffectivePermissionsResponse,
  type PermissionCatalogItem,
  type PermissionEffect,
  type PermissionScope,
  type Role,
  type RolePermissionItem,
  type UserPermissionItem,
  type UserWithRole,
} from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';
import { ReloadOutlined, TeamOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const ROLES: Role[] = ['user', 'manager', 'admin', 'superadmin'];
const EFFECT_OPTIONS: PermissionEffect[] = ['allow', 'deny'];
const SCOPE_OPTIONS: PermissionScope[] = ['own', 'team', 'all'];

const ROLE_COLORS: Record<string, string> = {
  user: 'default',
  manager: 'blue',
  admin: 'orange',
  superadmin: 'red',
};

function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const candidate = err as { response?: { data?: { message?: string } }; message?: string };
    return candidate.response?.data?.message || candidate.message || fallback;
  }
  return fallback;
}

function isForbiddenError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const candidate = err as { response?: { status?: number } };
  return candidate.response?.status === 403;
}

export default function AccessControlPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionItem[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermissionItem[]>([]);
  const [effectivePermissions, setEffectivePermissions] =
    useState<EffectivePermissionsResponse | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserRoleId, setUpdatingUserRoleId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [roleForm] = Form.useForm();
  const [userOverrideForm] = Form.useForm();

  const canAccess = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  const loadAll = async () => {
    try {
      setError(null);
      const [usersData, catalogData, rolePermissionsData] = await Promise.all([
        authApi.getUsers(),
        authApi.getPermissionsCatalog(),
        authApi.getRolePermissions(),
      ]);
      setUsers(usersData || []);
      setCatalog(catalogData || []);
      setRolePermissions(rolePermissionsData || []);
    } catch (err: unknown) {
      const msg = isForbiddenError(err)
        ? 'Недостатньо прав для керування доступом'
        : getErrorMessage(err, 'Помилка завантаження доступів');
      setError(msg);
      message.error(msg);
    }
  };

  const loadUserPermissions = async (userId?: string) => {
    if (!userId) {
      setUserPermissions([]);
      setEffectivePermissions(null);
      return;
    }
    try {
      const [overrides, effective] = await Promise.all([
        authApi.getUserPermissions(userId),
        authApi.getEffectiveUserPermissions(userId),
      ]);
      setUserPermissions(overrides || []);
      setEffectivePermissions(effective || null);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Помилка завантаження прав користувача');
      message.error(msg);
      setUserPermissions([]);
      setEffectivePermissions(null);
    }
  };

  const refreshAll = async () => {
    try {
      setRefreshing(true);
      await loadAll();
      await loadUserPermissions(selectedUserId);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    if (!canAccess) {
      router.replace('/');
      return;
    }

    (async () => {
      try {
        setLoading(true);
        await loadAll();
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    loadUserPermissions(selectedUserId);
  }, [selectedUserId]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.email || '').toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q),
    );
  }, [users, search]);

  const roleCounts = useMemo(
    () =>
      users.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    [users],
  );

  const handleRoleChange = async (userId: string, role: Role) => {
    try {
      setUpdatingUserRoleId(userId);
      await authApi.setUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      message.success('Роль оновлено');
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'Помилка оновлення ролі'));
    } finally {
      setUpdatingUserRoleId(null);
    }
  };

  const handleUpsertRolePermission = async (values: {
    role: Role;
    permission_key: string;
    effect: PermissionEffect;
    scope: PermissionScope;
  }) => {
    try {
      await authApi.setRolePermission(values);
      message.success('Право ролі збережено');
      roleForm.resetFields();
      setRolePermissions(await authApi.getRolePermissions());
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'Помилка збереження права ролі'));
    }
  };

  const handleDeleteRolePermission = async (row: RolePermissionItem) => {
    try {
      await authApi.deleteRolePermission(row.role, row.permission_key);
      message.success('Право ролі видалено');
      setRolePermissions((prev) =>
        prev.filter((p) => !(p.role === row.role && p.permission_key === row.permission_key)),
      );
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'Помилка видалення права ролі'));
    }
  };

  const handleUpsertUserPermission = async (values: {
    user_id: string;
    permission_key: string;
    effect: PermissionEffect;
    scope: PermissionScope;
    expires_at?: dayjs.Dayjs;
  }) => {
    try {
      await authApi.setUserPermission({
        user_id: values.user_id,
        permission_key: values.permission_key,
        effect: values.effect,
        scope: values.scope,
        expires_at: values.expires_at ? values.expires_at.toISOString() : undefined,
      });
      message.success('Override збережено');
      await loadUserPermissions(values.user_id);
      userOverrideForm.resetFields(['permission_key', 'effect', 'scope', 'expires_at']);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'Помилка збереження override'));
    }
  };

  const handleDeleteUserPermission = async (row: UserPermissionItem) => {
    try {
      await authApi.deleteUserPermission(row.user_id, row.permission_key);
      message.success('Override видалено');
      await loadUserPermissions(row.user_id);
    } catch (err: unknown) {
      message.error(getErrorMessage(err, 'Помилка видалення override'));
    }
  };

  const userColumns: ColumnsType<UserWithRole> = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string, record) => (
        <Space>
          <span>{email || record.id}</span>
          {record.id === currentUser?.id && <Tag color="green">Ви</Tag>}
        </Space>
      ),
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      render: (role: string, record) => {
        const isSelf = record.id === currentUser?.id;
        const canEdit =
          currentUser?.role === 'superadmin' ||
          (currentUser?.role === 'admin' && role !== 'superadmin' && !isSelf);
        if (!canEdit) return <Tag color={ROLE_COLORS[role] || 'default'}>{role}</Tag>;
        return (
          <Select
            value={role}
            loading={updatingUserRoleId === record.id}
            onChange={(newRole) => handleRoleChange(record.id, newRole as Role)}
            options={ROLES.map((r) => ({ label: r, value: r }))}
            style={{ minWidth: 140 }}
          />
        );
      },
    },
    {
      title: 'Створено',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => (val ? new Date(val).toLocaleString() : '—'),
    },
  ];

  const rolePermissionColumns: ColumnsType<RolePermissionItem> = [
    { title: 'Role', dataIndex: 'role', key: 'role', render: (r) => <Tag>{r}</Tag> },
    { title: 'Permission', dataIndex: 'permission_key', key: 'permission_key' },
    {
      title: 'Effect',
      dataIndex: 'effect',
      key: 'effect',
      render: (e: PermissionEffect) => <Tag color={e === 'deny' ? 'red' : 'green'}>{e}</Tag>,
    },
    { title: 'Scope', dataIndex: 'scope', key: 'scope' },
    {
      title: 'Дії',
      key: 'actions',
      render: (_, row) => (
        <Popconfirm
          title="Видалити право ролі?"
          onConfirm={() => handleDeleteRolePermission(row)}
        >
          <Button size="small" danger>
            Видалити
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const userPermissionColumns: ColumnsType<UserPermissionItem> = [
    { title: 'Permission', dataIndex: 'permission_key', key: 'permission_key' },
    {
      title: 'Effect',
      dataIndex: 'effect',
      key: 'effect',
      render: (e: PermissionEffect) => <Tag color={e === 'deny' ? 'red' : 'green'}>{e}</Tag>,
    },
    { title: 'Scope', dataIndex: 'scope', key: 'scope' },
    {
      title: 'Expires',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (v: string | null | undefined) => (v ? new Date(v).toLocaleString() : '—'),
    },
    {
      title: 'Дії',
      key: 'actions',
      render: (_, row) => (
        <Popconfirm
          title="Видалити override?"
          onConfirm={() => handleDeleteUserPermission(row)}
        >
          <Button size="small" danger>
            Видалити
          </Button>
        </Popconfirm>
      ),
    },
  ];

  if (loading) return <Loading />;

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={3} style={{ marginBottom: 0 }}>
          Access Control
        </Title>
        <Button icon={<ReloadOutlined />} onClick={refreshAll} loading={refreshing}>
          Оновити
        </Button>
      </Space>

      {error ? (
        <ErrorDisplay message={error} />
      ) : (
        <Tabs
          items={[
            {
              key: 'users',
              label: 'Users & Roles',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Card>
                        <Statistic title="Всього" value={users.length} prefix={<TeamOutlined />} />
                      </Card>
                    </Col>
                    {ROLES.map((r) => (
                      <Col key={r} span={4}>
                        <Card>
                          <Statistic title={r} value={roleCounts[r] || 0} />
                        </Card>
                      </Col>
                    ))}
                  </Row>

                  <Card>
                    <Space style={{ marginBottom: 12 }}>
                      <Input.Search
                        placeholder="Пошук email / id / role"
                        allowClear
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ minWidth: 320 }}
                      />
                    </Space>
                    <Table
                      rowKey="id"
                      columns={userColumns}
                      dataSource={filteredUsers}
                      pagination={{ pageSize: 20 }}
                    />
                  </Card>
                </Space>
              ),
            },
            {
              key: 'role-permissions',
              label: 'Role Permissions',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <Card title="Додати / оновити право ролі">
                    <Form
                      form={roleForm}
                      layout="inline"
                      onFinish={handleUpsertRolePermission}
                      initialValues={{ effect: 'allow', scope: 'all' }}
                    >
                      <Form.Item name="role" rules={[{ required: true }]} label="Role">
                        <Select style={{ width: 140 }} options={ROLES.map((r) => ({ label: r, value: r }))} />
                      </Form.Item>
                      <Form.Item name="permission_key" rules={[{ required: true }]} label="Permission">
                        <Select
                          showSearch
                          style={{ width: 280 }}
                          options={catalog.map((c) => ({ label: c.key, value: c.key }))}
                        />
                      </Form.Item>
                      <Form.Item name="effect" rules={[{ required: true }]} label="Effect">
                        <Select style={{ width: 120 }} options={EFFECT_OPTIONS.map((e) => ({ label: e, value: e }))} />
                      </Form.Item>
                      <Form.Item name="scope" rules={[{ required: true }]} label="Scope">
                        <Select style={{ width: 120 }} options={SCOPE_OPTIONS.map((s) => ({ label: s, value: s }))} />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit">
                          Зберегти
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                  <Card title="Права ролей">
                    <Table
                      rowKey={(row) => `${row.role}:${row.permission_key}`}
                      columns={rolePermissionColumns}
                      dataSource={rolePermissions}
                      pagination={{ pageSize: 20 }}
                    />
                  </Card>
                </Space>
              ),
            },
            {
              key: 'user-overrides',
              label: 'User Overrides',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <Card>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text strong>Оберіть користувача</Text>
                      <Select
                        showSearch
                        placeholder="User"
                        value={selectedUserId}
                        onChange={setSelectedUserId}
                        style={{ width: 420 }}
                        options={users.map((u) => ({
                          value: u.id,
                          label: `${u.email || u.id} (${u.role})`,
                        }))}
                      />
                    </Space>
                  </Card>

                  <Card title="Додати / оновити user override">
                    <Form
                      form={userOverrideForm}
                      layout="inline"
                      initialValues={{
                        user_id: selectedUserId,
                        effect: 'allow',
                        scope: 'all',
                      }}
                      onValuesChange={() => {
                        if (!userOverrideForm.getFieldValue('user_id') && selectedUserId) {
                          userOverrideForm.setFieldValue('user_id', selectedUserId);
                        }
                      }}
                      onFinish={handleUpsertUserPermission}
                    >
                      <Form.Item
                        name="user_id"
                        rules={[{ required: true }]}
                        label="User"
                        initialValue={selectedUserId}
                      >
                        <Select
                          showSearch
                          style={{ width: 320 }}
                          options={users.map((u) => ({
                            value: u.id,
                            label: `${u.email || u.id} (${u.role})`,
                          }))}
                        />
                      </Form.Item>
                      <Form.Item name="permission_key" rules={[{ required: true }]} label="Permission">
                        <Select
                          showSearch
                          style={{ width: 260 }}
                          options={catalog.map((c) => ({ label: c.key, value: c.key }))}
                        />
                      </Form.Item>
                      <Form.Item name="effect" rules={[{ required: true }]} label="Effect">
                        <Select style={{ width: 120 }} options={EFFECT_OPTIONS.map((e) => ({ label: e, value: e }))} />
                      </Form.Item>
                      <Form.Item name="scope" rules={[{ required: true }]} label="Scope">
                        <Select style={{ width: 120 }} options={SCOPE_OPTIONS.map((s) => ({ label: s, value: s }))} />
                      </Form.Item>
                      <Form.Item name="expires_at" label="Expires">
                        <DatePicker showTime />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit">
                          Зберегти
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>

                  <Card title="User overrides">
                    <Table
                      rowKey={(row) => `${row.user_id}:${row.permission_key}`}
                      columns={userPermissionColumns}
                      dataSource={userPermissions}
                      pagination={{ pageSize: 20 }}
                    />
                  </Card>

                  <Card title="Effective permissions (merged)">
                    {!effectivePermissions ? (
                      <Text type="secondary">Оберіть користувача, щоб побачити effective permissions.</Text>
                    ) : (
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Text>
                          Роль: <Tag color={ROLE_COLORS[effectivePermissions.role] || 'default'}>{effectivePermissions.role}</Tag>
                        </Text>
                        <Table
                          rowKey={(row) => row.key}
                          pagination={{ pageSize: 20 }}
                          dataSource={effectivePermissions.permissions}
                          columns={[
                            { title: 'Permission', dataIndex: 'key', key: 'key' },
                            {
                              title: 'Effect',
                              dataIndex: 'effect',
                              key: 'effect',
                              render: (e: PermissionEffect) => (
                                <Tag color={e === 'deny' ? 'red' : 'green'}>{e}</Tag>
                              ),
                            },
                            { title: 'Scope', dataIndex: 'scope', key: 'scope' },
                          ]}
                        />
                      </Space>
                    )}
                  </Card>
                </Space>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}

