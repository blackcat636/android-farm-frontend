import type { BrowserProfileRecord } from '@/lib/api/backend';

export type BrowserProfileHomeAgentStatus = 'unbound' | 'online' | 'offline';

export const HOME_AGENT_STATUS_LABELS: Record<BrowserProfileHomeAgentStatus, string> = {
  unbound: 'Not assigned',
  online: 'Online',
  offline: 'Offline',
};

export const HOME_AGENT_STATUS_COLORS: Record<BrowserProfileHomeAgentStatus, string> = {
  unbound: 'default',
  online: 'success',
  offline: 'error',
};

export function isBrowserProfileRunnableAdmin(
  profile: Pick<BrowserProfileRecord, 'status'>,
): boolean {
  return profile.status === 'active';
}

export function canStartBrowserSessionAdmin(
  profile: Pick<BrowserProfileRecord, 'status' | 'home_agent_status'>,
): boolean {
  if (!isBrowserProfileRunnableAdmin(profile)) return false;
  if (profile.home_agent_status === 'offline') return false;
  return true;
}
