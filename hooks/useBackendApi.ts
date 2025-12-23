'use client';

import { useState, useCallback } from 'react';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { message } from 'antd';

export function useBackendApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeAction = useCallback(
    async (
      agentId: string,
      platform: string,
      action: string,
      data: { emulatorId: string; params?: any },
    ) => {
      setLoading(true);
      setError(null);
      
      const token = tokenStorage.get();
      if (!token) {
        const errorMsg = 'Необхідна авторизація';
        setError(errorMsg);
        message.error(errorMsg);
        throw new Error(errorMsg);
      }

      const loadingMessage = message.loading('Виконується дія... Це може зайняти деякий час.', 0);
      
      try {
        const backendClient = createBackendClient(token);
        const result = await backendClient.executeAction(agentId, platform, action, data);
        loadingMessage();
        message.success('Дію виконано успішно!');
        return result;
      } catch (err: any) {
        loadingMessage();
        
        let errorMessage = 'Помилка виконання дії';
        
        if (err.response?.status === 401) {
          errorMessage = 'Необхідна авторизація';
          tokenStorage.remove();
        } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          errorMessage = 'Таймаут операції. Операція займає занадто багато часу. Спробуйте ще раз або перевірте стан емулятора.';
        } else if (err.response?.data?.error) {
          errorMessage = err.response.data.error;
        } else if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
        message.error(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    executeAction,
    loading,
    error,
  };
}

