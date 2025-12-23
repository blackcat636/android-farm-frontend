'use client';

import { useState, useEffect } from 'react';
import { type Emulator } from '@/lib/api/agent';
import { useAgents } from '@/contexts/AgentsContext';
import { useAuth } from '@/contexts/AuthContext';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';

/**
 * Хук для отримання емуляторів з усіх агентів через бекенд
 */
export function useAllEmulators(onlyActive = true) {
  const { agents } = useAgents();
  const { user } = useAuth();
  const [emulators, setEmulators] = useState<Emulator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllEmulators = async () => {
      if (agents.length === 0) {
        setLoading(false);
        return;
      }

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

        const allEmulators: Emulator[] = [];

        // Збираємо емулятори з усіх агентів паралельно через бекенд
        const emulatorPromises = agents.map(async (agent) => {
          try {
            const response = await backendClient.getEmulators(agent.id);
            // Додаємо назву агента та agentId до кожного емулятора
            return (response.emulators || [])
              .filter((e: any) => !onlyActive || e.status === 'active')
              .map((emulator: any) => ({
                ...emulator,
                agentName: agent.name,
                agentId: agent.id,
              }));
          } catch (err: any) {
            console.error(`Помилка завантаження емуляторів з агента ${agent.name}:`, err.message);
            return []; // Повертаємо порожній масив при помилці
          }
        });

        const results = await Promise.all(emulatorPromises);
        // Об'єднуємо всі емулятори в один масив
        allEmulators.push(...results.flat());
        setEmulators(allEmulators);
      } catch (err: any) {
        setError(err.message || 'Помилка завантаження емуляторів');
      } finally {
        setLoading(false);
      }
    };

    fetchAllEmulators();
  }, [agents, onlyActive, user]);

  return { emulators, loading, error };
}

