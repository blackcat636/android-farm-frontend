/**
 * Єдине форматування відображення емулятора (назва, id, агент)
 */
export function formatEmulatorLabel(e: {
  emulator_name?: string;
  emulator_id?: string;
  id?: string;
  agent_id?: string;
  name?: string;
  agentName?: string;
} | null | undefined): string {
  if (!e) return '—';
  const name = e.emulator_name ?? e.name ?? e.emulator_id ?? e.id ?? '—';
  const id = e.emulator_id && e.emulator_id !== name ? ` (${e.emulator_id})` : '';
  const agent = (e.agent_id ?? (e as { agentName?: string }).agentName)
    ? ` · ${e.agent_id ?? (e as { agentName?: string }).agentName}`
    : '';
  return `${name}${id}${agent}`;
}
