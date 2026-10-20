import { parseSelection } from './assignments';
import { bangkokMonthKey } from './month-filter';

export type TaskKpi = { id: string; name: string; memberId: string; month: number; year: number };

/** KPIs a task can count towards: its assignees' KPIs in the Thai month of its deadline. */
export function taskKpiOptions<T extends TaskKpi>(kpis: readonly T[], memberSelection: unknown, deadline: string | null | undefined): T[] {
  const key = bangkokMonthKey(deadline);
  if (!key) return [];
  const [year, month] = key.split('-').map(Number);
  const ids = parseSelection(memberSelection);
  const everyone = ids.includes('all');
  return kpis.filter(kpi => kpi.year === year && kpi.month === month && (everyone || ids.includes(kpi.memberId)));
}

/** Keeps a saved KPI only while it still belongs to the task's assignees and deadline month. */
export function validTaskKpiId(kpis: readonly TaskKpi[], memberSelection: unknown, deadline: string | null | undefined, kpiId: string | null | undefined): string | null {
  return kpiId && taskKpiOptions(kpis, memberSelection, deadline).some(kpi => kpi.id === kpiId) ? kpiId : null;
}
