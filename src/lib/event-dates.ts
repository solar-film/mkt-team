// A notice on several days is stored as one Event row per selected day, so the
// existing schema, per-day edit/delete and the today/tomorrow banner keep working.
export const MAX_EVENT_DATES = 31;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_KEY.test(value)) return false;
  const parsed = new Date(value);
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Days to create from a POST body: unique, sorted yyyy-MM-dd keys from `dates`,
 * or the legacy single `date` exactly as before. Null when nothing valid was sent.
 */
export function eventDates(body: { date?: unknown; dates?: unknown }): string[] | null {
  if (body.dates !== undefined) {
    if (!Array.isArray(body.dates) || !body.dates.length || !body.dates.every(isDayKey)) return null;
    return [...new Set(body.dates)].sort();
  }
  if (typeof body.date === 'string' && body.date && !isNaN(new Date(body.date).getTime())) return [body.date];
  return null;
}

/** Thai calendar dates for the LINE notice, e.g. "21/10/2569, 23/10/2569". */
export function eventDatesLabel(dates: string[]): string {
  return dates.map(date => new Date(date).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })).join(', ');
}
