'use client';

import { useState, useEffect } from 'react';
import { type Emulator } from '@/lib/api/agent';
import { useAuth } from '@/contexts/AuthContext';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';
import { getCachedEmulators, setCache } from '@/lib/cache/task-form-cache';

/**
 * Хук для отримання емуляторів з БД (GET /api/emulators, тільки з активних агентів).
 */
const DEFAULT_ACTIVE_WITHIN_MINUTES = 15;

export function useAllEmulators(onlyActive = true, includeHidden = false, forTasksAndBinding = false) {
  const { user } = useAuth();
  const cached = forTasksAndBinding ? getCachedEmulators() : null;
  const [emulators, setEmulators] = useState<Emulator[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
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
        if (!cached) setLoading(true);
        setError(null);

        const { emulators: list } = await backendClient.getAllEmulators({
          include_hidden: includeHidden,
          active_within_minutes: DEFAULT_ACTIVE_WITHIN_MINUTES,
          ...(forTasksAndBinding && {
            exclude_templates: true,
            readiness_status: 'ready,in_use',
          }),
        });

        const normalized = (list || [])
          .filter((e: any) => !onlyActive || e.status === 'active')
          .map((e: any) => ({
            id: e.id,
            emulatorId: e.emulator_id ?? e.id,
            name: e.emulator_name ?? e.emulator_id ?? e.id,
            udid: e.udid ?? '',
            deviceName: e.device_name ?? '',
            status: (e.status === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
            agentId: e.agent_id ?? e.agentId,
            agentName: e.agent_name ?? e.agentName,
          }));

        setEmulators(normalized);
        if (forTasksAndBinding) setCache({ emulators: normalized });
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Помилка завантаження емуляторів');
      } finally {
        setLoading(false);
      }
    };

    fetchAllEmulators();
  }, [onlyActive, includeHidden, forTasksAndBinding, user]);

  return { emulators, loading, error, agentErrors };
}
