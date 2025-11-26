/**
 * Клієнт для роботи з Cloudflare KV через Next.js API routes
 */

export interface AgentFromKV {
  id: string;
  tunnelUrl: string;
  updated_at: string | null;
}

export interface AgentsListResponse {
  ok: boolean;
  agents: AgentFromKV[];
}

export interface AgentTunnelUrlResponse {
  ok: boolean;
  url?: string;
  message?: string;
}

/**
 * Отримує список всіх агентів з KV
 */
export async function getAgentsFromKV(): Promise<AgentFromKV[]> {
  try {
    const response = await fetch('/api/agents');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: AgentsListResponse = await response.json();
    return data.agents || [];
  } catch (error) {
    console.error('Помилка отримання списку агентів з KV:', error);
    return [];
  }
}

/**
 * Отримує URL тунелю для конкретного агента
 */
export async function getAgentTunnelUrlFromKV(agentId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/agents?agentId=${encodeURIComponent(agentId)}`);
    if (!response.ok) {
      return null;
    }
    const data: AgentTunnelUrlResponse = await response.json();
    return data.url || null;
  } catch (error) {
    console.error(`Помилка отримання URL тунелю для агента ${agentId}:`, error);
    return null;
  }
}

