'use client';

import { type Emulator } from '@/lib/api/agent';
import { type SocialAccount } from '@/lib/api/backend';
import { createBackendClient, tokenStorage } from '@/lib/api/backend';

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export interface TaskFormCache {
  emulators: Emulator[];
  countries: { code: string; name: string }[];
  accountsByPlatform: Record<string, SocialAccount[]>;
  timestamp: number;
}

let cache: TaskFormCache | null = null;

function isCacheValid(c: TaskFormCache): boolean {
  return Date.now() - c.timestamp < CACHE_TTL_MS;
}

export function getCachedEmulators(): Emulator[] | null {
  if (!cache || !isCacheValid(cache)) return null;
  return cache.emulators;
}

export function getCachedCountries(): { code: string; name: string }[] | null {
  if (!cache || !isCacheValid(cache)) return null;
  return cache.countries;
}

export function getCachedAccounts(platform: string): SocialAccount[] | null {
  if (!cache || !isCacheValid(cache)) return null;
  return cache.accountsByPlatform[platform] ?? null;
}

export function setCache(data: Partial<TaskFormCache>): void {
  cache = {
    emulators: data.emulators ?? cache?.emulators ?? [],
    countries: data.countries ?? cache?.countries ?? [],
    accountsByPlatform: data.accountsByPlatform ?? cache?.accountsByPlatform ?? {},
    timestamp: Date.now(),
  };
}

export function mergeAccountsIntoCache(platform: string, accounts: SocialAccount[]): void {
  const prev = cache?.accountsByPlatform ?? {};
  setCache({ accountsByPlatform: { ...prev, [platform]: accounts } });
}

function normalizeEmulators(list: any[]): Emulator[] {
  return (list || [])
    .filter((e: any) => e.status === 'active' || true)
    .map((e: any) => ({
      id: e.id,
      emulatorId: e.emulator_id ?? e.id,
      name: e.emulator_name ?? e.emulator_id ?? e.id,
      udid: e.udid ?? '',
      deviceName: e.device_name ?? '',
      status: (e.status === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
      agentId: e.agent_id ?? e.agentId,
      agentName: e.agent_name ?? e.agentName,
    }));
}

/** Prefetch emulators, countries, and accounts for a platform. Call on parent page mount or button hover. */
export async function prefetchTaskFormData(platform: string): Promise<void> {
  const token = tokenStorage.get();
  if (!token) return;

  const client = createBackendClient(token);

  const [emulatorsRes, countriesRes, accountsRes] = await Promise.all([
    client.getAllEmulators({
      include_hidden: false,
      active_within_minutes: 15,
      exclude_templates: true,
      readiness_status: 'ready,in_use',
    }),
    client.getCountries().catch(() => []),
    client.getSocialAccounts({ platform, status: 'active' }).catch(() => ({ data: [] })),
  ]);

  const emulators = normalizeEmulators(emulatorsRes?.emulators ?? []);
  const countries = countriesRes ?? [];
  const accounts = accountsRes?.data ?? [];

  setCache({
    emulators,
    countries,
    accountsByPlatform: { ...cache?.accountsByPlatform, [platform]: accounts },
  });
}
