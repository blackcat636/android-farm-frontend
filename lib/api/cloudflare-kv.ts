/**
 * Клієнт для роботи з Cloudflare KV через Next.js API routes
 */

export interface AgentFromKV {
  id: string;
  tunnelUrl: string;
  name?: string;
  updated_at: string | null;
}

export interface AgentsListResponse {
  ok: boolean;
  agents: AgentFromKV[];
}

export interface AgentTunnelUrlResponse {
  ok: boolean;
  url?: string;
  name?: string;
  agentId?: string;
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
 * Отримує інформацію про агента (URL, назва)
 */
export async function getAgentInfoFromKV(agentId: string): Promise<{ url: string; name: string } | null> {
  try {
    const response = await fetch(`/api/agents?agentId=${encodeURIComponent(agentId)}`);
    if (!response.ok) {
      return null;
    }
    const data: AgentTunnelUrlResponse = await response.json();
    if (data.url) {
      return {
        url: data.url,
        name: data.name || agentId
      };
    }
    return null;
  } catch (error) {
    console.error(`Помилка отримання інформації про агента ${agentId}:`, error);
    return null;
  }
}

/**
 * Отримує URL тунелю для конкретного агента (для зворотної сумісності)
 */
export async function getAgentTunnelUrlFromKV(agentId: string): Promise<string | null> {
  const info = await getAgentInfoFromKV(agentId);
  return info?.url || null;
}

