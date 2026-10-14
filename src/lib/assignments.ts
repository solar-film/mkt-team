export function parseSelection(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(values.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))];
}

export function matchesMemberSelection(value: unknown, memberId: string) {
  const ids = parseSelection(value);
  return ids.includes('all') || ids.includes(memberId);
}

export function matchesCompanySelection(value: unknown, company: string) {
  return parseSelection(value).includes(company);
}

export function memberSelectionLabel(value: unknown, members: { id: string; name: string }[]) {
  const ids = parseSelection(value);
  if (ids.includes('all')) return 'ทุกคน';
  return ids.map(id => members.find(member => member.id === id)?.name || 'ไม่ระบุ').join(', ') || 'ไม่ระบุ';
}

export function serializeAssignments<T extends { memberId: string; company: string; memberIds?: string[]; companies?: string[] }>(item: T) {
  const memberIds = parseSelection(item.memberIds?.length ? item.memberIds : item.memberId);
  const companies = parseSelection(item.companies?.length ? item.companies : item.company);
  return { ...item, memberIds, companies, memberId: memberIds.join(','), company: companies.join(',') };
}

export function memberAssignmentFilter(memberId: string) {
  return { OR: [
    { memberId },
    { memberId: 'all' },
    { memberIds: { has: memberId } },
    { memberIds: { has: 'all' } },
  ] };
}

export class AssignmentValidationError extends Error {}

export interface AssignmentInput {
  memberId?: unknown;
  memberIds?: unknown;
  company?: unknown;
  companies?: unknown;
}

export async function resolveAssignments(
  input: AssignmentInput,
  findMembers: (ids: string[]) => Promise<{ id: string }[]>,
  creating = false,
) {
  const result: { memberId?: string; memberIds?: string[]; company?: string; companies?: string[] } = {};
  if (creating || input.memberId !== undefined || input.memberIds !== undefined) {
    const selected = parseSelection(input.memberIds !== undefined ? input.memberIds : input.memberId);
    const memberIds = selected.includes('all') ? ['all'] : selected;
    if (!memberIds.length) throw new AssignmentValidationError('กรุณาเลือกผู้รับผิดชอบอย่างน้อย 1 คน');
    const members = await findMembers(memberIds.includes('all') ? [] : memberIds);
    if (!members.length || (!memberIds.includes('all') && memberIds.some(id => !members.some(member => member.id === id)))) {
      throw new AssignmentValidationError('ไม่พบผู้รับผิดชอบที่เลือก กรุณาตรวจสอบรายการอีกครั้ง');
    }
    // Keep a valid single-member relation for existing integrations; the array holds the complete assignment.
    result.memberId = memberIds.includes('all') ? members[0].id : memberIds[0];
    result.memberIds = memberIds;
  }
  if (creating || input.company !== undefined || input.companies !== undefined) {
    if (!creating && input.companies === undefined && input.company === '') {
      return { ...result, company: '', companies: [] };
    }
    const companies = input.companies !== undefined ? parseSelection(input.companies) : parseSelection(input.company || 'GFS');
    if (!companies.length || companies.some(company => !['GFS', 'MHL', 'CAR'].includes(company))) {
      throw new AssignmentValidationError('กรุณาเลือกบริษัท GFS, MHL หรือ CAR อย่างน้อย 1 บริษัท');
    }
    result.company = companies[0];
    result.companies = companies;
  }
  return result;
}
