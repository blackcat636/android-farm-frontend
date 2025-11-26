'use client';

import { useState, useEffect } from 'react';
import { type Emulator } from '@/lib/api/agent';
import { createAgentApi } from '@/lib/api/agent';
import { useAgents } from '@/contexts/AgentsContext';

/**
 * Хук для отримання емуляторів з усіх агентів
 */
export function useAllEmulators(onlyActive = true) {
  const { agents } = useAgents();
  const [emulators, setEmulators] = useState<Emulator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllEmulators = async () => {
      if (agents.length === 0) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const useTunnel = process.env.NEXT_PUBLIC_USE_TUNNEL === 'true';
        const allEmulators: Emulator[] = [];

        // Збираємо емулятори з усіх агентів паралельно
        const emulatorPromises = agents.map(async (agent) => {
          try {
            // Визначаємо baseURL для агента
            const baseURL = (useTunnel && agent.tunnelUrl)
              ? agent.tunnelUrl
              : agent.url || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

            const api = createAgentApi(baseURL);
            const response = await api.getEmulators();

            // Додаємо назву агента та agentId до кожного емулятора
            return response.emulators
              .filter((e) => !onlyActive || e.status === 'active')
              .map(emulator => ({
                ...emulator,
                agentName: agent.name,
                agentId: agent.id,
                agentBaseURL: baseURL, // Зберігаємо baseURL для виконання дій
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
  }, [agents, onlyActive]);

  return { emulators, loading, error };
}

