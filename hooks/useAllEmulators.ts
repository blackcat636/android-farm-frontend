'use client';

import { useState, useEffect } from 'react';
import { type Emulator } from '@/lib/api/agent';
import { useAuth } from '@/contexts/AuthContext';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';

/**
 * Хук для отримання емуляторів з усіх агентів одним запитом (GET /api/proxy/emulators).
 */
export function useAllEmulators(onlyActive = true, includeHidden = false) {
  const { user } = useAuth();
  const [emulators, setEmulators] = useState<Emulator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentErrors, setAgentErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchAllEmulators = async () => {
      const token = tokenStorage.get();
      if (!token) {
        setError('Необхідна авторизація');
        setLoading(false);
        return;
      }

      const backendClient = createBackendClient(token);

      try {
        setLoading(true);
        setError(null);

        const { emulators: list, errors: errs } = await backendClient.getAllEmulators({
          include_hidden: includeHidden,
        });

        setAgentErrors(errs || {});

        const normalized = (list || [])
          .filter((e: any) => !onlyActive || e.status === 'active')
          .map((e: any) => ({
            ...e,
            agentId: e.agent_id ?? e.agentId,
            agentName: e.agent_name ?? e.agentName,
          }));

        setEmulators(normalized);
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Помилка завантаження емуляторів');
        setAgentErrors({});
      } finally {
        setLoading(false);
      }
    };

    fetchAllEmulators();
  }, [onlyActive, includeHidden, user]);

  return { emulators, loading, error, agentErrors };
}
