'use client';

import { Layout, Menu } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardOutlined, AppstoreOutlined, MobileOutlined } from '@ant-design/icons';
import AppHeader from './AppHeader';

const { Sider, Content } = Layout;

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

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
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
  };

  return (
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
  );
}

