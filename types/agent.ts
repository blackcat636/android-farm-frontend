export interface Agent {
  id: string;
  name: string;
  url: string;
  tunnelUrl?: string;
  agentId?: string; // ID агента (agent-{hostname})
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
}

export interface AgentsContextType {
  agents: Agent[];
  activeAgent: Agent | null;
  addAgent: (agent: Omit<Agent, 'id' | 'createdAt'>) => void;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  setActiveAgent: (id: string | null) => void;
  refreshAgentTunnelUrl: (agentId: string) => Promise<void>;
}

