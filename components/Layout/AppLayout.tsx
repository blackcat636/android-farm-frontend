'use client';

import { Layout, Menu, Drawer } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardOutlined, AppstoreOutlined, MobileOutlined, HistoryOutlined, UnorderedListOutlined, UserOutlined, HeartOutlined, KeyOutlined, SafetyOutlined, StopOutlined, MenuOutlined } from '@ant-design/icons';
import AppHeader from './AppHeader';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

const { Sider, Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Публічні роути, які не потребують авторизації
  const publicRoutes = ['/login', '/register'];
  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const menuContent = (
    <>
      <div style={{ 
        padding: '24px 20px', 
        textAlign: 'center', 
        fontWeight: 700,
        fontSize: '20px',
        background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        letterSpacing: '-0.03em',
        borderBottom: '1px solid #edf2f7',
        marginBottom: '12px',
      }}>
        Android Farm
      </div>
      <Menu
        mode="inline"
        selectedKeys={[pathname]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{
          border: 'none',
          padding: '12px 8px',
          background: 'transparent',
        }}
      />
    </>
  );

  // Після всіх хуків: якщо публічний роут — без layout
  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <ProtectedRoute>
      <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
        {/* Desktop Sider */}
        {mounted && !isMobile && (
          <Sider
            collapsible
            theme="light"
            width={260}
            style={{
              overflow: 'auto',
              height: '100vh',
              position: 'fixed',
              left: 0,
              top: 0,
              bottom: 0,
              boxShadow: '4px 0 24px rgba(0, 0, 0, 0.08)',
              borderRight: '1px solid #e2e8f0',
              background: '#ffffff',
            }}
          >
            {menuContent}
          </Sider>
        )}

        {/* Mobile Drawer */}
        {mounted && isMobile && (
          <Drawer
            title={
              <div style={{ 
                fontWeight: 700,
                fontSize: '20px',
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-0.03em',
              }}>
                Android Farm
              </div>
            }
            placement="left"
            onClose={() => setMobileMenuOpen(false)}
            open={mobileMenuOpen}
            bodyStyle={{ padding: 0 }}
            width={260}
            styles={{
              body: {
                padding: 0,
              },
            }}
          >
            {menuContent}
          </Drawer>
        )}

        <Layout style={{ 
          marginLeft: mounted && !isMobile ? 260 : 0, 
          background: 'transparent',
          transition: 'margin-left 0.3s ease',
        }}>
          <AppHeader 
            onMenuClick={isMobile ? () => setMobileMenuOpen(true) : undefined}
          />
          <Content style={{ 
            margin: isMobile ? '16px' : '32px', 
            padding: 0,
            minHeight: 280,
            overflow: 'hidden',
          }}>
            <div className="fade-in" style={{
              background: '#ffffff',
              borderRadius: 12,
              padding: isMobile ? 20 : 40,
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e2e8f0',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              minHeight: '100%',
            }}>
              {children}
            </div>
          </Content>
        </Layout>
      </Layout>
    </ProtectedRoute>
  );
}

