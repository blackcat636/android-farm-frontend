'use client';

import { Layout, Space } from 'antd';
import AgentSelector from '@/components/Agents/AgentSelector';

const { Header } = Layout;

export default function AppHeader() {
  return (
    <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontSize: '18px', fontWeight: 500 }}>Agent Control Panel</div>
      <AgentSelector />
    </Header>
  );
}

