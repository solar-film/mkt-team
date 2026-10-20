import { bangkokDateKey } from './bangkok-date';

export type MonthRef = { year: number; month: number }; // month is 1-12

export const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** The current calendar month in Thailand. */
export function currentBangkokMonth(now = new Date()): MonthRef {
  const [year, month] = bangkokDateKey(now).split('-').map(Number);
  return { year, month };
}

export const monthKey = (ref: MonthRef) => `${ref.year}-${String(ref.month).padStart(2, '0')}`;
export const monthLabel = (ref: MonthRef) => `${THAI_MONTHS[ref.month - 1]} ${ref.year}`;

/** Thai calendar month (YYYY-MM) of a stored timestamp, or '' when there is none. */
export function bangkokMonthKey(value: string | Date | null | undefined): string {
  return value ? bangkokDateKey(value).slice(0, 7) : '';
}

export function inMonth(value: string | Date | null | undefined, ref: MonthRef): boolean {
  return bangkokMonthKey(value) === monthKey(ref);
}

/** Still outstanding at the end of the month: due in or before it, or with no due date at all. */
export function dueByEndOf(value: string | Date | null | undefined, ref: MonthRef): boolean {
  const key = bangkokMonthKey(value);
  return !key || key <= monthKey(ref);
}
