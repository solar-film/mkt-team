import { parseSelection } from './assignments';
import { bangkokMonthKey } from './month-filter';

export type TaskKpi = { id: string; name: string; memberId: string; month: number; year: number };

// A task's kpiId holds one KPI id or several comma-separated ids (KPI ids never contain commas).
// A single id is a one-item list, so existing links keep counting exactly as before.

export function parseKpiIds(value: unknown): string[] {
  return parseSelection(value);
}

/** Normalised storage value: trimmed, de-duplicated ids joined by commas, or null when empty. */
export function joinKpiIds(value: unknown): string | null {
  const ids = parseKpiIds(value);
  return ids.length ? ids.join(',') : null;
}

/** True when the task's stored KPI link includes the given KPI. */
export function taskHasKpi(storedKpiIds: unknown, kpiId: string): boolean {
  return parseKpiIds(storedKpiIds).includes(kpiId);
}

/** KPIs a task can count towards: its assignees' KPIs in the Thai month of its deadline. */
export function taskKpiOptions<T extends TaskKpi>(kpis: readonly T[], memberSelection: unknown, deadline: string | null | undefined): T[] {
  const key = bangkokMonthKey(deadline);
  if (!key) return [];
  const [year, month] = key.split('-').map(Number);
  const ids = parseSelection(memberSelection);
  const everyone = ids.includes('all');
  return kpis.filter(kpi => kpi.year === year && kpi.month === month && (everyone || ids.includes(kpi.memberId)));
}

/** Keeps only selected KPIs that still belong to the task's assignees and deadline month. */
export function validTaskKpiIds(kpis: readonly TaskKpi[], memberSelection: unknown, deadline: string | null | undefined, storedKpiIds: unknown): string | null {
  const allowed = new Set(taskKpiOptions(kpis, memberSelection, deadline).map(kpi => kpi.id));
  return joinKpiIds(parseKpiIds(storedKpiIds).filter(id => allowed.has(id)));
}
