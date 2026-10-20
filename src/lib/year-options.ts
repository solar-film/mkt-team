const FIRST_DATA_YEAR = 2024;

/** Years from the first recorded data through next year, so a new year is always selectable. */
export function yearOptions(now = new Date()): number[] {
  const last = now.getFullYear() + 1;
  return Array.from({ length: last - FIRST_DATA_YEAR + 1 }, (_, index) => FIRST_DATA_YEAR + index);
}
