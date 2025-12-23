'use client';

import React from 'react';
import { Layout, Space, Button, Dropdown, MenuProps, message } from 'antd';
import { UserOutlined, LogoutOutlined, HistoryOutlined, SyncOutlined, KeyOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AgentSelector from '@/components/Agents/AgentSelector';
import { useAuth } from '@/contexts/AuthContext';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';

const { Header } = Layout;

export default function AppHeader() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [syncing, setSyncing] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleSyncAgents = async () => {
    try {
      setSyncing(true);
      const token = tokenStorage.get();
      if (!token) {
        message.error('Authorization required');
        return;
      }
      
      const backendClient = createBackendClient(token);
      await backendClient.syncAgents();
      message.success('Agents successfully synchronized with Cloudflare KV');
      // Reload page to show new agents
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error('Error synchronizing agents:', error);
      message.error(error.response?.data?.message || 'Error synchronizing agents');
    } finally {
      setSyncing(false);
    }
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'history',
      icon: <HistoryOutlined />,
      label: <Link href="/history">History</Link>,
    },
    {
      key: 'api-keys',
      icon: <KeyOutlined />,
      label: <Link href="/api-keys">API Keys</Link>,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      onClick: handleSignOut,
    },
  ];

  return (
    <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontSize: '18px', fontWeight: 500 }}>Agent Control Panel</div>
      <Space>
        <Button
          icon={<SyncOutlined />}
          onClick={handleSyncAgents}
          loading={syncing}
          title="Synchronize agents with Cloudflare KV"
        >
          Sync Agents
        </Button>
        <AgentSelector />
        {user ? (
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />}>
              {user.email}
            </Button>
          </Dropdown>
        ) : (
          <Link href="/login">
            <Button type="primary">Login</Button>
          </Link>
        )}
      </Space>
    </Header>
  );
}

