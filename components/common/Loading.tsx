'use client';

import { Spin } from 'antd';

export default function Loading() {
  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <Spin size="large" />
    </div>
  );
}

