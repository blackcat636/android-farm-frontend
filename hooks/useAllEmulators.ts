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
  const { agents, refreshAgents, refreshAgentTunnelUrl } = useAgents();
  const { user } = useAuth();
  const [emulators, setEmulators] = useState<Emulator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agentErrors, setAgentErrors] = useState<Record<string, string>>({});

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
            // Очищаємо помилку для цього агента, якщо запит успішний
            setAgentErrors(prev => {
              const newErrors = { ...prev };
              delete newErrors[agent.id];
              return newErrors;
            });
            
            // Додаємо назву агента та agentId до кожного емулятора
            return (response.emulators || [])
              .filter((e: any) => !onlyActive || e.status === 'active')
              .map((emulator: any) => ({
                ...emulator,
                agentName: agent.name,
                agentId: agent.id,
              }));
          } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
            const statusCode = err.response?.status;
            const agentUrl = agent.tunnelUrl || agent.url || 'unknown';
            
            // Зберігаємо детальну інформацію про помилку для цього агента
            let detailedError = `Помилка завантаження емуляторів з агента "${agent.name}"`;
            
            if (statusCode === 502) {
              detailedError = `Не вдалося підключитися до агента "${agent.name}". ` +
                `Агент може бути офлайн або URL неправильний. ` +
                `Перевірте URL: ${agentUrl}. ` +
                `Помилка бекенду: ${errorMessage}`;
            } else {
              detailedError = `Помилка завантаження емуляторів з агента "${agent.name}": ${errorMessage}`;
            }
            
            console.error(detailedError, err);
            
            // Зберігаємо помилку для відображення
            setAgentErrors(prev => ({
              ...prev,
              [agent.id]: detailedError
            }));
            
            // ВИДАЛЕНО: Автоматичне оновлення URL при помилці 502 викликало безкінечний цикл
            // Користувач може оновити URL вручну через кнопку "Retry & Update URL"
            // Якщо помилка 502, спробуємо оновити URL агента з KV
            // if (statusCode === 502 && agent.agentId) {
            //   try {
            //     console.log(`Спробую оновити URL агента ${agent.name} з KV...`);
            //     await refreshAgentTunnelUrl(agent.id);
            //     // Оновимо список агентів з бекенду
            //     await refreshAgents();
            //     console.log(`URL агента ${agent.name} оновлено, спробуйте оновити сторінку`);
            //   } catch (updateError) {
            //     console.warn(`Не вдалося оновити URL агента ${agent.name}:`, updateError);
            //   }
            // }
            
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

  return { emulators, loading, error, agentErrors };
}

