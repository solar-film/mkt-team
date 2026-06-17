export const getCompanyColor = (company: string | undefined | null) => {
  if (company === 'GFS') return '#0ea5e9'; // Blue
  if (company === 'MHL') return '#f59e0b'; // Amber/Orange
  if (company === 'CAR') return '#8b5cf6'; // Purple
  return '#64748b'; // Slate
};
