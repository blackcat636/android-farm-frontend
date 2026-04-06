'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Card,
  Button,
  Space,
  message,
  Select,
  Typography,
  Tag,
  Statistic,
  Row,
  Col,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { authApi, type UserWithRole, type Role } from '@/lib/api/backend';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/common/Loading';
import ErrorDisplay from '@/components/common/ErrorDisplay';
import { ReloadOutlined, TeamOutlined } from '@ant-design/icons';

const { Title } = Typography;

const ROLE_COLORS: Record<string, string> = {
  user: 'default',
  manager: 'blue',
  admin: 'orange',
  superadmin: 'red',
};

const ROLES: Role[] = ['user', 'manager', 'admin', 'superadmin'];

export default function UsersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);

  const canAccess = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    if (!canAccess) {
      setLoading(false);
      setError('Недостатньо прав');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await authApi.getUsers();
      setUsers(data || []);
    } catch (err: any) {
      setError(err.response?.status === 403 ? 'Недостатньо прав для перегляду користувачів' : err.message || 'Помилка завантаження');
      message.error(err.response?.status === 403 ? 'Недостатньо прав' : err.message || 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    if (!canAccess) {
      router.replace('/');
      return;
    }
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role]);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    try {
      setUpdatingId(userId);
      await authApi.setUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      message.success('Роль оновлено');
    } catch (err: any) {
      message.error(err.response?.data?.message || err.message || 'Помилка оновлення ролі');
    } finally {
      setUpdatingId(null);
    }
  };

  const columns: ColumnsType<UserWithRole> = [
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (email: string, record) => (
        <Space>
          <span>{email || record.id}</span>
          {record.id === currentUser?.id && (
            <Tag color="green">Ви</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      render: (role: string, record) => {
        const canEdit =
          (currentUser?.role === 'superadmin') ||
          (currentUser?.role === 'admin' && record.role !== 'superadmin' && record.id !== currentUser?.id);
        const isSelf = record.id === currentUser?.id;

        if (canEdit && !isSelf) {
          return (
            <Select
              value={role}
              loading={updatingId === record.id}
              onChange={(v) => handleRoleChange(record.id, v as Role)}
              options={ROLES.map((r) => ({ label: r, value: r }))}
              style={{ minWidth: 120 }}
            />
          );
        }
        return <Tag color={ROLE_COLORS[role] || 'default'}>{role}</Tag>;
      },
    },
    {
      title: 'Дата реєстрації',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => (val ? new Date(val).toLocaleString() : '—'),
    },
  ];

  const roleCounts = users.reduce(
    (acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  if (loading) return <Loading />;

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        Користувачі та ролі
      </Title>

      {error && (
        <ErrorDisplay message={error} />
      )}

      {!error && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="Всього"
                  value={users.length}
                  prefix={<TeamOutlined />}
                />
              </Card>
            </Col>
            {ROLES.map((r) => (
              <Col key={r} span={4}>
                <Card>
                  <Statistic
                    title={r}
                    value={roleCounts[r] || 0}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          <Card
            extra={
              <Space>
                <Button onClick={() => router.push('/access-control')}>
                  Access Control
                </Button>
                <Button icon={<ReloadOutlined />} onClick={fetchUsers}>
                  Оновити
                </Button>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={users}
              rowKey="id"
              pagination={{ pageSize: 20 }}
            />
          </Card>
        </>
      )}
    </div>
  );
}
