// A notice on several days is stored as one Event row per selected day (each with
// its own optional time), so the existing schema, per-day edit/delete and the
// today/tomorrow banner keep working.
export const MAX_EVENT_DATES = 31;

export type EventSlot = { date: string; time: string | null };

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_KEY.test(value)) return false;
  const parsed = new Date(value);
  return !isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Rows to create from a POST body: `dates` as [{ date: yyyy-MM-dd, time?: HH:mm }]
 * (unique, sorted by day then time), or the legacy single `date` + `time` exactly
 * as before. Null when anything sent is invalid or nothing was sent.
 */
export function eventSlots(body: { date?: unknown; time?: unknown; dates?: unknown }): EventSlot[] | null {
  if (body.dates !== undefined) {
    if (!Array.isArray(body.dates) || !body.dates.length) return null;
    const slots = new Map<string, EventSlot>();
    for (const item of body.dates) {
      if (!item || typeof item !== 'object') return null;
      const { date, time } = item as { date?: unknown; time?: unknown };
      if (!isDayKey(date)) return null;
      if (time !== undefined && time !== null && time !== '' && (typeof time !== 'string' || !CLOCK.test(time))) return null;
      const slot = { date, time: typeof time === 'string' && time ? time : null };
      slots.set(`${slot.date} ${slot.time ?? ''}`, slot);
    }
    return [...slots.values()].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
  }
  if (typeof body.date === 'string' && body.date && !isNaN(new Date(body.date).getTime())) {
    return [{ date: body.date, time: typeof body.time === 'string' && body.time ? body.time : null }];
  }
  return null;
}

const thaiDate = (date: string) => new Date(date).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
const slotText = (slot: EventSlot) => `${thaiDate(slot.date)}${slot.time ? ` เวลา ${slot.time} น.` : ''}`;

/** LINE "วันที่" line: one day stays on the line as before; several days are listed one per line. */
export function eventSlotsLabel(slots: EventSlot[]): string {
  return slots.length === 1 ? `วันที่: ${slotText(slots[0])}` : `วันที่:${slots.map(slot => `\n- ${slotText(slot)}`).join('')}`;
}
