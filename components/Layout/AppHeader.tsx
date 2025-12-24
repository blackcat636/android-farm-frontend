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
    <Header style={{ 
      background: '#ffffff', 
      padding: '0 40px', 
      borderBottom: '1px solid #e2e8f0', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      height: 72,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ 
        fontSize: '18px', 
        fontWeight: 600,
        background: 'linear-gradient(135deg, #0a0e27 0%, #1a1a1a 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        letterSpacing: '-0.02em',
      }}>
        Agent Control Panel
      </div>
      <Space size="middle">
        <Button
          icon={<SyncOutlined />}
          onClick={handleSyncAgents}
          loading={syncing}
          title="Synchronize agents with Cloudflare KV"
          style={{
            fontWeight: 500,
          }}
        >
          Sync Agents
        </Button>
        <AgentSelector />
        {user ? (
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button 
              type="text" 
              icon={<UserOutlined />}
              style={{
                fontWeight: 500,
                color: '#1a1a1a',
              }}
            >
              {user.email}
            </Button>
          </Dropdown>
        ) : (
          <Link href="/login">
            <Button type="primary" style={{ fontWeight: 500 }}>Login</Button>
          </Link>
        )}
      </Space>
    </Header>
  );
}

