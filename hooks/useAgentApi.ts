'use client';

import { useState, useCallback } from 'react';
import { type ExecuteActionRequest } from '@/lib/api/agent';
import { message } from 'antd';
import { useActiveAgentApi } from './useActiveAgentApi';

export function useAgentApi() {
  const { agentApi } = useActiveAgentApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeAction = useCallback(
    async (
      platform: string,
      action: string,
      data: ExecuteActionRequest
    ) => {
      setLoading(true);
      setError(null);
      
      // Показуємо повідомлення про початок виконання
      const loadingMessage = message.loading('Виконується дія... Це може зайняти деякий час.', 0);
      
      try {
        const result = await agentApi.executeAction(platform, action, data);
        loadingMessage(); // Закриваємо повідомлення про завантаження
        message.success('Дію виконано успішно!');
        return result;
      } catch (err: any) {
        loadingMessage(); // Закриваємо повідомлення про завантаження
        
        let errorMessage = 'Помилка виконання дії';
        
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
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
    [agentApi]
  );

  return {
    executeAction,
    loading,
    error,
  };
}

