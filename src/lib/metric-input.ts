export function metricInputValue(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  return Number(value);
}
