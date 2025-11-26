'use client';

import { useMemo } from 'react';
import { useAgents } from '@/contexts/AgentsContext';
import { createAgentApi } from '@/lib/api/agent';

/**
 * Хук для отримання API клієнта активного агента
 * Автоматично використовує URL активного агента
 */
export function useActiveAgentApi() {
  const { activeAgent } = useAgents();

  const agentApi = useMemo(() => {
    if (!activeAgent) {
      // Fallback на дефолтний URL
      const defaultUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      return createAgentApi(defaultUrl);
    }

    // Використовуємо tunnelUrl якщо є та дозволено використання тунелю, інакше звичайний url
    const useTunnel = process.env.NEXT_PUBLIC_USE_TUNNEL === 'true';
    const baseURL = (useTunnel && activeAgent.tunnelUrl) 
      ? activeAgent.tunnelUrl 
      : activeAgent.url;
    return createAgentApi(baseURL);
  }, [activeAgent]);

  return {
    agentApi,
    activeAgent,
    isConnected: !!activeAgent,
  };
}

