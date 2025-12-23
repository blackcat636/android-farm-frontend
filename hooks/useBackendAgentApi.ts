'use client';

import { useMemo } from 'react';
import { useAgents } from '@/contexts/AgentsContext';
import { useAuth } from '@/contexts/AuthContext';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';

/**
 * Хук для отримання API клієнта активного агента через бекенд
 * Всі запити йдуть через бекенд і логуються в історію
 */
export function useBackendAgentApi() {
  const { activeAgent } = useAgents();
  const { user } = useAuth();

  const backendClient = useMemo(() => {
    const token = tokenStorage.get();
    if (!token) {
      return null;
    }
    return createBackendClient(token);
  }, [user]);

  return {
    backendClient,
    activeAgent,
    isConnected: !!activeAgent && !!backendClient,
  };
}

