'use client';

import { Layout, Menu, Drawer } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardOutlined, AppstoreOutlined, MobileOutlined, HistoryOutlined, UnorderedListOutlined, UserOutlined, HeartOutlined, KeyOutlined, SafetyOutlined, StopOutlined, ApiOutlined, TeamOutlined, FileTextOutlined, CopyOutlined, SettingOutlined, CommentOutlined, ChromeOutlined, ClusterOutlined, ProfileOutlined, AuditOutlined, LockOutlined, GlobalOutlined } from '@ant-design/icons';
import AppHeader from './AppHeader';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useState, useEffect, useMemo } from 'react';

const { Sider, Content } = Layout;

/** Longest-prefix first so `/accounts/comments` wins over `/accounts`. `"/"` is matched only exactly. */
const MENU_LEAF_KEYS = [
  '/user-post-clones',
  '/accounts/comments',
  '/browser-disk-profiles',
  '/browser-sessions',
  '/browser-proxies',
  '/browser-logs',
  '/browser-profiles',
  '/access-control',
  '/proxy-providers',
  '/user-posts',
  '/moderation',
  '/blacklist',
  '/platforms',
  '/emulators',
  '/api-keys',
  '/accounts',
  '/history',
  '/queue',
  '/agents',
  '/captcha',
  '/posts',
  '/users',
  '/config',
  '/',
] as const;

function getSelectedMenuKey(pathname: string): string {
  for (const key of MENU_LEAF_KEYS) {
    if (key === '/') {
      if (pathname === '/') return '/';
      continue;
    }
    if (pathname === key || pathname.startsWith(`${key}/`)) return key;
  }
  return pathname;
}

const MENU_GROUP_BY_LEAF: Record<string, string> = {
  '/': 'grp-overview',
  '/users': 'grp-overview',
  '/access-control': 'grp-overview',
  '/moderation': 'grp-security',
  '/captcha': 'grp-security',
  '/blacklist': 'grp-security',
  '/platforms': 'grp-ops',
  '/emulators': 'grp-ops',
  '/agents': 'grp-ops',
  '/queue': 'grp-ops',
  '/history': 'grp-ops',
  '/accounts': 'grp-content',
  '/accounts/comments': 'grp-content',
  '/posts': 'grp-content',
  '/user-posts': 'grp-content',
  '/user-post-clones': 'grp-content',
  '/proxy-providers': 'grp-proxy',
  '/api-keys': 'grp-proxy',
  '/browser-sessions': 'grp-browser',
  '/browser-disk-profiles': 'grp-browser',
  '/browser-proxies': 'grp-browser',
  '/browser-logs': 'grp-browser',
  '/browser-profiles': 'grp-browser',
  '/config': 'grp-system',
};

function getAutoOpenMenuKeys(pathname: string): string[] {
  const leaf = getSelectedMenuKey(pathname);
  const g = MENU_GROUP_BY_LEAF[leaf];
  return g ? [g] : [];
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathnameAutoOpenKeys = useMemo(() => getAutoOpenMenuKeys(pathname), [pathname]);
  const [userMenuOpenKeys, setUserMenuOpenKeys] = useState<string[]>([]);
  const mergedMenuOpenKeys = useMemo(
    () => [...new Set([...pathnameAutoOpenKeys, ...userMenuOpenKeys])],
    [pathnameAutoOpenKeys, userMenuOpenKeys],
  );

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

  const menuItems = useMemo(
    () => [
      {
        key: 'grp-overview',
        icon: <TeamOutlined />,
        label: 'Overview & access',
        children: [
          { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
          { key: '/users', icon: <TeamOutlined />, label: 'Users' },
          { key: '/access-control', icon: <SafetyOutlined />, label: 'Access Control' },
        ],
      },
      {
        key: 'grp-security',
        icon: <SafetyOutlined />,
        label: 'Moderation & security',
        children: [
          { key: '/moderation', icon: <AuditOutlined />, label: 'Moderation' },
          { key: '/captcha', icon: <LockOutlined />, label: 'Captcha' },
          { key: '/blacklist', icon: <StopOutlined />, label: 'Blacklist' },
        ],
      },
      {
        key: 'grp-ops',
        icon: <ClusterOutlined />,
        label: 'Operations',
        children: [
          { key: '/platforms', icon: <AppstoreOutlined />, label: 'Platforms' },
          { key: '/emulators', icon: <MobileOutlined />, label: 'Emulators' },
          { key: '/agents', icon: <ClusterOutlined />, label: 'Agents' },
          { key: '/queue', icon: <UnorderedListOutlined />, label: 'Queue' },
          { key: '/history', icon: <HistoryOutlined />, label: 'History' },
        ],
      },
      {
        key: 'grp-content',
        icon: <FileTextOutlined />,
        label: 'Accounts & content',
        children: [
          { key: '/accounts', icon: <UserOutlined />, label: 'Accounts' },
          { key: '/accounts/comments', icon: <CommentOutlined />, label: 'Acc. Comments' },
          { key: '/posts', icon: <HeartOutlined />, label: 'Posts & Likes' },
          { key: '/user-posts', icon: <FileTextOutlined />, label: 'User Posts' },
          { key: '/user-post-clones', icon: <CopyOutlined />, label: 'Post Clones' },
        ],
      },
      {
        key: 'grp-proxy',
        icon: <GlobalOutlined />,
        label: 'Proxy & API',
        children: [
          { key: '/proxy-providers', icon: <ApiOutlined />, label: 'Proxy Providers' },
          { key: '/api-keys', icon: <KeyOutlined />, label: 'API Keys' },
        ],
      },
      {
        key: 'grp-browser',
        icon: <ChromeOutlined />,
        label: 'Browser',
        children: [
          { key: '/browser-profiles', icon: <UserOutlined />, label: 'Browser Profiles' },
          { key: '/browser-sessions', icon: <ChromeOutlined />, label: 'Browser Sessions' },
          { key: '/browser-disk-profiles', icon: <FileTextOutlined />, label: 'Disk Profiles' },
          { key: '/browser-proxies', icon: <ApiOutlined />, label: 'Browser Proxies' },
          { key: '/browser-logs', icon: <ProfileOutlined />, label: 'Browser Logs' },
        ],
      },
      {
        key: 'grp-system',
        icon: <SettingOutlined />,
        label: 'System',
        children: [{ key: '/config', icon: <SettingOutlined />, label: 'Config' }],
      },
    ],
    [],
  );

  const handleMenuClick = ({ key }: { key: string }) => {
    if (!key.startsWith('/')) return;
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
        Nexus Labs
      </div>
      <Menu
        mode="inline"
        selectedKeys={[getSelectedMenuKey(pathname)]}
        openKeys={mergedMenuOpenKeys}
        onOpenChange={setUserMenuOpenKeys}
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
                Nexus Labs
              </div>
            }
            placement="left"
            onClose={() => setMobileMenuOpen(false)}
            open={mobileMenuOpen}
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

