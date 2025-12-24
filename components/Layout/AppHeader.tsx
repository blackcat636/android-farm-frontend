'use client';

import React from 'react';
import { Layout, Space, Button, Dropdown, MenuProps, message } from 'antd';
import { UserOutlined, LogoutOutlined, HistoryOutlined, SyncOutlined, KeyOutlined, MenuOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AgentSelector from '@/components/Agents/AgentSelector';
import { useAuth } from '@/contexts/AuthContext';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';

const { Header } = Layout;

interface AppHeaderProps {
  onMenuClick?: () => void;
}

export default function AppHeader({ onMenuClick }: AppHeaderProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [syncing, setSyncing] = React.useState(false);
  const [isSmallScreen, setIsSmallScreen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkScreen = () => {
      const width = window.innerWidth;
      setIsSmallScreen(width < 640);
      setIsMobile(width < 768);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

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
      padding: onMenuClick ? '0 12px' : '0 40px', 
      borderBottom: '1px solid #e2e8f0', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      height: 72,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      flexWrap: 'nowrap',
      overflow: 'hidden',
    }}>
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
        flex: '0 1 auto',
      }}>
        {onMenuClick && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={onMenuClick}
            style={{
              fontSize: '18px',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ 
          fontSize: onMenuClick ? '16px' : '18px', 
          fontWeight: 600,
          background: 'linear-gradient(135deg, #0a0e27 0%, #1a1a1a 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.02em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {onMenuClick ? 'Control' : 'Agent Control Panel'}
        </div>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        minWidth: 0,
      }}>
        {!isMobile && (
          <Button
            icon={<SyncOutlined />}
            onClick={handleSyncAgents}
            loading={syncing}
            title="Synchronize agents with Cloudflare KV"
            style={{
              fontWeight: 500,
              padding: onMenuClick ? '4px 8px' : undefined,
            }}
          >
            {!isSmallScreen && 'Sync Agents'}
          </Button>
        )}
        {!isMobile && (
          <div style={{ flexShrink: 0 }}>
            <AgentSelector />
          </div>
        )}
        {user ? (
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button 
              type="text" 
              icon={<UserOutlined />}
              style={{
                fontWeight: 500,
                color: '#1a1a1a',
                padding: onMenuClick ? '4px 8px' : undefined,
              }}
            >
              {!isSmallScreen && user.email}
            </Button>
          </Dropdown>
        ) : (
          <Link href="/login">
            <Button type="primary" style={{ fontWeight: 500 }}>Login</Button>
          </Link>
        )}
      </div>
    </Header>
  );
}

