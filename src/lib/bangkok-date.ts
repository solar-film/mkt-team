const bangkokDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
});

/**
 * Calendar day (YYYY-MM-DD) in Thailand. Stored timestamps are UTC, so slicing the ISO string
 * would put anything due between 00:00 and 06:59 Thai time on the previous day.
 */
export function bangkokDateKey(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : bangkokDay.format(date);
}
