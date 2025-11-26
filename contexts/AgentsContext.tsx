'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Agent, AgentsContextType } from '@/types/agent';
import { agentApi } from '@/lib/api/agent';
import { getAgentsFromKV, getAgentInfoFromKV } from '@/lib/api/cloudflare-kv';

const STORAGE_KEY = 'android-farm-agents';

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  // Завантаження агентів з KV або localStorage
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const loadAgents = async () => {
      try {
        const useTunnel = process.env.NEXT_PUBLIC_USE_TUNNEL === 'true';
        let agentsFromKV: Agent[] = [];
        let shouldUseKV = false;

        // Спробувати завантажити агентів з KV (якщо увімкнено тунель)
        if (useTunnel) {
          try {
            const kvAgents = await getAgentsFromKV();
            if (kvAgents.length > 0) {
              // Конвертуємо агентів з KV у формат Agent
              agentsFromKV = kvAgents.map((kvAgent, index) => ({
                id: kvAgent.id,
                name: kvAgent.name || `Agent ${kvAgent.id}`, // Використовуємо назву з KV
                url: '', // Базовий URL не відомий, використовуємо тільки tunnelUrl
                tunnelUrl: kvAgent.tunnelUrl,
                agentId: kvAgent.id,
                isActive: index === 0,
                createdAt: kvAgent.updated_at || new Date().toISOString(),
              }));
              shouldUseKV = true;
            }
          } catch (error) {
            console.debug('Не вдалося завантажити агентів з KV:', error);
          }
        }

        // Якщо знайшли агентів в KV - використовуємо їх
        if (shouldUseKV && agentsFromKV.length > 0) {
          setAgents(agentsFromKV);
          // Зберігаємо в localStorage для швидкого доступу
          localStorage.setItem(STORAGE_KEY, JSON.stringify(agentsFromKV));
          setActiveAgentId(agentsFromKV[0].id);
          localStorage.setItem('android-farm-active-agent-id', agentsFromKV[0].id);
          return;
        }

        // Якщо агентів в KV немає - завантажуємо з localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        const storedActiveId = localStorage.getItem('android-farm-active-agent-id');
        
        if (stored) {
          const parsedAgents = JSON.parse(stored) as Agent[];
          setAgents(parsedAgents);
          
          // Встановлюємо активного агента
          if (storedActiveId) {
            const activeAgent = parsedAgents.find(a => a.id === storedActiveId);
            if (activeAgent) {
              setActiveAgentId(storedActiveId);
            } else if (parsedAgents.length > 0) {
              setActiveAgentId(parsedAgents[0].id);
            }
          } else if (parsedAgents.length > 0) {
            setActiveAgentId(parsedAgents[0].id);
          }
        } else {
          // Якщо агентів немає взагалі, створюємо дефолтний
          const defaultUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
          const defaultAgent: Agent = {
            id: 'default',
            name: 'Default Agent',
            url: defaultUrl,
            isActive: true,
            createdAt: new Date().toISOString(),
          };
          setAgents([defaultAgent]);
          setActiveAgentId('default');
          localStorage.setItem(STORAGE_KEY, JSON.stringify([defaultAgent]));
          localStorage.setItem('android-farm-active-agent-id', 'default');
        }
      } catch (error) {
        console.error('Помилка завантаження агентів:', error);
      }
    };

    loadAgents();
  }, []);

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
    if (!agent) return;

    try {
          // Спочатку спробувати отримати з KV (якщо фронтенд на Cloudflare)
          const useTunnel = process.env.NEXT_PUBLIC_USE_TUNNEL === 'true';
          if (useTunnel && agent.agentId) {
            const agentInfo = await getAgentInfoFromKV(agent.agentId);
            if (agentInfo) {
              updateAgent(agentId, { 
                tunnelUrl: agentInfo.url,
                name: agentInfo.name || agent.name // Оновлюємо назву з KV, якщо є
              });
              return;
            }
          }

      // Fallback: якщо є базовий URL, запитуємо через нього
      if (agent.url) {
        const axios = (await import('axios')).default;
        const response = await axios.get(`${agent.url}/api/tunnel/url${agent.agentId ? `?agentId=${encodeURIComponent(agent.agentId)}` : ''}`, {
          timeout: 5000
        });

        if (response.data.ok && response.data.url) {
          updateAgent(agentId, { tunnelUrl: response.data.url });
        }
      }
    } catch (error) {
      console.error('Помилка оновлення URL тунелю:', error);
    }
  }, [agents, updateAgent]);

  // Автоматично завантажуємо tunnelUrl для активного агента якщо його немає
  useEffect(() => {
    if (!activeAgentId || agents.length === 0 || typeof window === 'undefined') {
      return;
    }

    const activeAgent = agents.find(a => a.id === activeAgentId);
    // Завантажуємо tunnelUrl тільки якщо він відсутній та увімкнено використання тунелю
    if (activeAgent && !activeAgent.tunnelUrl && process.env.NEXT_PUBLIC_USE_TUNNEL === 'true') {
      const loadTunnelUrl = async () => {
        try {
          // Спочатку спробувати отримати з KV
          if (activeAgent.agentId) {
            const agentInfo = await getAgentInfoFromKV(activeAgent.agentId);
            if (agentInfo) {
              setAgents(prevAgents => {
                const updated = prevAgents.map(a =>
                  a.id === activeAgentId 
                    ? { ...a, tunnelUrl: agentInfo.url, name: agentInfo.name || a.name } 
                    : a
                );
                if (typeof window !== 'undefined') {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                }
                return updated;
              });
              return;
            }
          }

          // Fallback: якщо є базовий URL, запитуємо через нього
          if (activeAgent.url) {
            const axios = (await import('axios')).default;
            const response = await axios.get(`${activeAgent.url}/api/tunnel/url${activeAgent.agentId ? `?agentId=${encodeURIComponent(activeAgent.agentId)}` : ''}`, {
              timeout: 5000
            });
            if (response.data.ok && response.data.url) {
              setAgents(prevAgents => {
                const updated = prevAgents.map(a =>
                  a.id === activeAgentId ? { ...a, tunnelUrl: response.data.url } : a
                );
                if (typeof window !== 'undefined') {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                }
                return updated;
              });
            }
          }
        } catch (error) {
          console.debug('Не вдалося автоматично завантажити tunnelUrl:', error);
        }
      };
      loadTunnelUrl();
    }
  }, [activeAgentId, agents]);

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

