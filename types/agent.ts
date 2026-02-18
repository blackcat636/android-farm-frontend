export interface Agent {
  id: string;
  name: string;
  url: string;
  tunnelUrl?: string;
  agentId?: string; // ID агента (agent-{hostname})
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
  status?: string; // Статус агента (online/offline)
  lastSeen?: string; // Останній раз коли агент був активний
  /** 0 = прихований (не в списку, не отримує задачі), 1 або undefined = видимий */
  visibility?: number | null;
}

export interface AgentsContextType {
  agents: Agent[];
  activeAgent: Agent | null;
  addAgent: (agent: Omit<Agent, 'id' | 'createdAt'>) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  setActiveAgent: (id: string | null) => void;
  refreshAgentTunnelUrl: (agentId: string) => Promise<void>;
  refreshAgents: () => Promise<void>;
  /** Оновити агента на бекенді (наприклад видимість) і оновити список */
  updateAgentOnBackend: (id: string, updates: { visibility?: number }) => Promise<void>;
}

