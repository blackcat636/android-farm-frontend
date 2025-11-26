'use client';

import { useState, useCallback } from 'react';
import { type ExecuteActionRequest } from '@/lib/api/agent';
import { createAgentApi } from '@/lib/api/agent';
import { message } from 'antd';
import { useActiveAgentApi } from './useActiveAgentApi';

export function useAgentApi() {
  const { agentApi: defaultAgentApi } = useActiveAgentApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeAction = useCallback(
    async (
      platform: string,
      action: string,
      data: ExecuteActionRequest,
      agentBaseURL?: string // Опціональний baseURL для виконання через конкретного агента
    ) => {
      setLoading(true);
      setError(null);
      
      // Показуємо повідомлення про початок виконання
      const loadingMessage = message.loading('Виконується дія... Це може зайняти деякий час.', 0);
      
      try {
        // Якщо вказано agentBaseURL, використовуємо його, інакше - активний агент
        const api = agentBaseURL ? createAgentApi(agentBaseURL) : defaultAgentApi;
        const result = await api.executeAction(platform, action, data);
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
    [defaultAgentApi]
  );

  return {
    executeAction,
    loading,
    error,
  };
}

