export const getCompanyColor = (company: string | undefined | null) => {
  if (company === 'GFS') return '#0ea5e9'; // Blue
  if (company === 'MHL') return '#f59e0b'; // Amber/Orange
  if (company === 'CAR') return '#8b5cf6'; // Purple
  return '#64748b'; // Slate
};

export const MEMBER_COLORS = [
  '#8b5cf6', // 0: Purple
  '#06b6d4', // 1: Cyan
  '#10b981', // 2: Emerald
  '#f59e0b', // 3: Amber
  '#ef4444', // 4: Red
  '#ec4899', // 5: Pink
  '#3b82f6', // 6: Blue
  '#14b8a6', // 7: Teal
];

export function hashName(name: string): number {
  if (!name) return 0;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash) + (i * 11);
  }
  hash ^= name.length * 17;
  return Math.abs(hash);
}

export function getMemberColor(name: string | undefined | null): string {
  if (!name) return '#cbd5e1'; // Default gray
  let colorIndex = hashName(name) % MEMBER_COLORS.length;
  
  if (name.includes('เพลง')) {
    colorIndex = 5; // Pink
  }
  if (name.includes('แต้ว')) {
    colorIndex = 0; // Purple
  }
  
  return MEMBER_COLORS[colorIndex];
}
