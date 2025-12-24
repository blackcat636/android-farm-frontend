'use client';

import { Layout, Menu } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardOutlined, AppstoreOutlined, MobileOutlined, HistoryOutlined, UnorderedListOutlined, UserOutlined, HeartOutlined, KeyOutlined, SafetyOutlined, StopOutlined } from '@ant-design/icons';
import AppHeader from './AppHeader';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

const { Sider, Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  // Публічні роути, які не потребують авторизації
  const publicRoutes = ['/login', '/register'];
  const isPublicRoute = publicRoutes.includes(pathname);

  // Якщо це публічний роут, показуємо без layout
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Для захищених роутів показуємо layout з перевіркою авторизації

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/platforms',
      icon: <AppstoreOutlined />,
      label: 'Platforms',
    },
    {
      key: '/emulators',
      icon: <MobileOutlined />,
      label: 'Emulators',
    },
    {
      key: '/accounts',
      icon: <UserOutlined />,
      label: 'Accounts',
    },
    {
      key: '/queue',
      icon: <UnorderedListOutlined />,
      label: 'Queue',
    },
    {
      key: '/captcha',
      icon: <SafetyOutlined />,
      label: 'Captcha',
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: 'History',
    },
    {
      key: '/posts',
      icon: <HeartOutlined />,
      label: 'Posts & Likes',
    },
    {
      key: '/api-keys',
      icon: <KeyOutlined />,
      label: 'API Keys',
    },
    {
      key: '/blacklist',
      icon: <StopOutlined />,
      label: 'Blacklist',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
  };

  return (
    <ProtectedRoute>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          collapsible
          theme="light"
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
          }}
        >
          <div style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold' }}>
            Android Farm
          </div>
          <Menu
            mode="inline"
            selectedKeys={[pathname]}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>
        <Layout style={{ marginLeft: 200 }}>
          <AppHeader />
          <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280, borderRadius: 8 }}>
            {children}
          </Content>
        </Layout>
      </Layout>
    </ProtectedRoute>
  );
}

