'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Agent, AgentsContextType } from '@/types/agent';
import { createBackendClient, tokenStorage, type Agent as BackendAgent } from '@/lib/api/backend';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'android-farm-agents';

function mapBackendAgentToFrontend(b: BackendAgent): Agent {
  return {
    id: b.id,
    name: b.name || b.id,
    url: b.url || b.tunnel_url || '',
    tunnelUrl: b.tunnel_url,
    agentId: b.id,
    isActive: b.status === 'online',
    createdAt: b.created_at || new Date().toISOString(),
    lastUsed: b.last_seen,
    status: b.status,
    lastSeen: b.last_seen,
    visibility: b.visibility,
  };
}

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const loadingTunnelUrlRef = useRef<Set<string>>(new Set());
  const attemptedAgentsRef = useRef<Set<string>>(new Set());

  const loadAgentsFromBackend = useCallback(async () => {
    const token = tokenStorage.get();
    if (!token) return;
    try {
      const backendClient = createBackendClient(token);
      const backendAgents = await backendClient.getAgents(false);
      const mapped = backendAgents.map(mapBackendAgentToFrontend);
      setAgents(mapped);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
      }
      if (mapped.length > 0) {
        setActiveAgentId((prev) => {
          const valid = prev && mapped.some((a) => a.id === prev);
          if (valid) return prev;
          const savedId = typeof window !== 'undefined' ? localStorage.getItem('android-farm-active-agent-id') : null;
          const firstId = savedId && mapped.some((a) => a.id === savedId) ? savedId : mapped[0].id;
          if (typeof window !== 'undefined') {
            localStorage.setItem('android-farm-active-agent-id', firstId);
          }
          return firstId;
        });
      }
    } catch (error) {
      console.error('Помилка завантаження агентів з бекенду:', error);
    }
  }, []);

  // Завантаження агентів тільки з бекенду (тільки видимі) для залогіненого користувача
  useEffect(() => {
    if (typeof window === 'undefined' || authLoading) return;
    const token = tokenStorage.get();
    if (token && user) {
      loadAgentsFromBackend();
    } else {
      setAgents([]);
      setActiveAgentId(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('android-farm-active-agent-id');
      }
    }
  }, [authLoading, user?.id, loadAgentsFromBackend]);

  // Збереження агентів в localStorage
  const saveAgents = useCallback((newAgents: Agent[]) => {
    setAgents(newAgents);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newAgents));
    }
  }, []);

  const addAgent = useCallback((agentData: Omit<Agent, 'id' | 'createdAt'>) => {
    const newAgent: Agent = {
      ...agentData,
      id: `agent-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updatedAgents = [...agents, newAgent];
    saveAgents(updatedAgents);
    
    // Якщо це перший агент, робимо його активним
    if (updatedAgents.length === 1) {
      setActiveAgentId(newAgent.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('android-farm-active-agent-id', newAgent.id);
      }
    }
  }, [agents, saveAgents]);

  const updateAgent = useCallback((id: string, updates: Partial<Agent>) => {
    const updatedAgents = agents.map(agent =>
      agent.id === id ? { ...agent, ...updates } : agent
    );
    saveAgents(updatedAgents);
  }, [agents, saveAgents]);

  const deleteAgent = useCallback((id: string) => {
    const updatedAgents = agents.filter(agent => agent.id !== id);
    saveAgents(updatedAgents);
    
    // Якщо видаляємо активного агента, вибираємо іншого
    if (activeAgentId === id) {
      if (updatedAgents.length > 0) {
        setActiveAgentId(updatedAgents[0].id);
        if (typeof window !== 'undefined') {
          localStorage.setItem('android-farm-active-agent-id', updatedAgents[0].id);
        }
      } else {
        setActiveAgentId(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('android-farm-active-agent-id');
        }
      }
    }
  }, [agents, activeAgentId, saveAgents]);

  const setActiveAgent = useCallback((id: string | null) => {
    setActiveAgentId(id);
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem('android-farm-active-agent-id', id);
        // Оновлюємо lastUsed
        const updatedAgents = agents.map(agent =>
          agent.id === id ? { ...agent, lastUsed: new Date().toISOString() } : agent
        );
        saveAgents(updatedAgents);
      } else {
        localStorage.removeItem('android-farm-active-agent-id');
      }
    }
  }, [agents, saveAgents]);

  const refreshAgentTunnelUrl = useCallback(async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent?.url) return;
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(
        `${agent.url}/api/tunnel/url${agent.agentId ? `?agentId=${encodeURIComponent(agent.agentId)}` : ''}`,
        { timeout: 5000 }
      );
      if (response.data?.ok && response.data?.url) {
        updateAgent(agentId, { tunnelUrl: response.data.url });
      }
    } catch (error) {
      console.error('Помилка оновлення URL тунелю:', error);
    }
  }, [agents, updateAgent]);

  // Очищаємо attemptedAgentsRef при зміні активного агента
  useEffect(() => {
    if (activeAgentId) {
      // Очищаємо спроби для попереднього агента, якщо він змінився
      attemptedAgentsRef.current.clear();
    }
  }, [activeAgentId]);

  // ТИМЧАСОВО ВИМКНЕНО: Автоматичне завантаження tunnelUrl викликало безкінечний цикл
  // Користувач може завантажити tunnelUrl вручну через refreshAgentTunnelUrl
  // Або через кнопку "Retry & Update URL" на сторінці
  // 
  // Автоматично завантажуємо tunnelUrl для активного агента якщо його немає
  // Використовуємо тільки activeAgentId як залежність, щоб уникнути безкінечного циклу
  // useEffect(() => {
  //   if (!activeAgentId || typeof window === 'undefined') {
  //     return;
  //   }

  //   // Перевіряємо, чи вже намагалися завантажити для цього агента
  //   if (attemptedAgentsRef.current.has(activeAgentId)) {
  //     return;
  //   }

  //   // Отримуємо поточний стан агента зі стану
  //   const activeAgent = agents.find(a => a.id === activeAgentId);
  //   if (!activeAgent) {
  //     return;
  //   }

  //   // Перевіряємо, чи потрібно завантажувати tunnelUrl
  //   if (
  //     activeAgent.tunnelUrl || // Якщо tunnelUrl вже є
  //     process.env.NEXT_PUBLIC_USE_TUNNEL !== 'true' || // Або тунель вимкнено
  //     loadingTunnelUrlRef.current.has(activeAgentId) // Або вже завантажуємо
  //   ) {
  //     return;
  //   }

  //   // Позначаємо, що намагаємося завантажити
  //   loadingTunnelUrlRef.current.add(activeAgentId);
  //   attemptedAgentsRef.current.add(activeAgentId);
    
  //   const loadTunnelUrl = async () => {
  //     try {
  //       // Спочатку спробувати отримати з KV
  //       if (activeAgent.agentId) {
  //         const agentInfo = await getAgentInfoFromKV(activeAgent.agentId);
  //         if (agentInfo && agentInfo.url) {
  //           setAgents(prevAgents => {
  //             const updated = prevAgents.map(a =>
  //               a.id === activeAgentId 
  //                 ? { ...a, tunnelUrl: agentInfo.url, name: agentInfo.name || a.name } 
  //                 : a
  //             );
  //             if (typeof window !== 'undefined') {
  //               localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  //             }
  //             return updated;
  //           });
  //           loadingTunnelUrlRef.current.delete(activeAgentId);
  //           return;
  //         }
  //       }

  //       // Fallback: якщо є базовий URL, запитуємо через нього
  //       if (activeAgent.url) {
  //         const axios = (await import('axios')).default;
  //         const response = await axios.get(`${activeAgent.url}/api/tunnel/url${activeAgent.agentId ? `?agentId=${encodeURIComponent(activeAgent.agentId)}` : ''}`, {
  //           timeout: 5000
  //         });
  //         if (response.data.ok && response.data.url) {
  //           setAgents(prevAgents => {
  //             const updated = prevAgents.map(a =>
  //               a.id === activeAgentId ? { ...a, tunnelUrl: response.data.url } : a
  //             );
  //             if (typeof window !== 'undefined') {
  //               localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  //             }
  //             return updated;
  //           });
  //         }
  //       }
  //     } catch (error) {
  //       console.debug('Не вдалося автоматично завантажити tunnelUrl:', error);
  //     } finally {
  //       loadingTunnelUrlRef.current.delete(activeAgentId);
  //     }
  //   };
  //   loadTunnelUrl();
  // }, [activeAgentId]); // Залежність тільки від activeAgentId - викликається тільки при зміні активного агента

  const refreshAgents = useCallback(async () => {
    await loadAgentsFromBackend();
  }, [loadAgentsFromBackend]);

  const updateAgentOnBackend = useCallback(
    async (id: string, updates: { visibility?: number }) => {
      const token = tokenStorage.get();
      if (!token) throw new Error('Authorization required');
      const backendClient = createBackendClient(token);
      await backendClient.updateAgent(id, updates);
      await loadAgentsFromBackend();
    },
    [loadAgentsFromBackend],
  );

  const activeAgent = activeAgentId ? agents.find(a => a.id === activeAgentId) || null : null;

  return (
    <AgentsContext.Provider
      value={{
        agents,
        activeAgent,
        addAgent,
        updateAgent,
        deleteAgent,
        setActiveAgent,
        refreshAgentTunnelUrl,
        refreshAgents,
        updateAgentOnBackend,
      }}
    >
      {children}
    </AgentsContext.Provider>
  );
}

export function useAgents() {
  const context = useContext(AgentsContext);
  if (context === undefined) {
    throw new Error('useAgents must be used within an AgentsProvider');
  }
  return context;
}

