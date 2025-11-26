'use client';

import { Alert } from 'antd';

interface ErrorDisplayProps {
  message: string;
  description?: string;
}

export default function ErrorDisplay({ message, description }: ErrorDisplayProps) {
  return (
    <Alert
      message={message}
      description={description}
      type="error"
      showIcon
      style={{ margin: '20px 0' }}
    />
  );
}

