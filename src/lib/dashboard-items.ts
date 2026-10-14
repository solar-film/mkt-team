export function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const records = new Map<string, T>();
  for (const item of items) {
    if (!records.has(item.id)) records.set(item.id, item);
  }
  return [...records.values()];
}
