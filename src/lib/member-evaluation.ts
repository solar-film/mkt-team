export class EvaluationInputError extends Error {}

export interface EvaluationInput {
  memberId: string;
  summary: string;
  strengths: string | null;
  improvements: string | null;
  nextSteps: string | null;
}

const MAX_TEXT = 4000;

function text(value: unknown, label: string, required = false): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) throw new EvaluationInputError(`${label} is required`);
    return null;
  }
  if (typeof value !== 'string') throw new EvaluationInputError(`${label} must be text`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new EvaluationInputError(`${label} is required`);
  return trimmed.slice(0, MAX_TEXT) || null;
}

/** Checks an upload from มะลิ and matches each entry to a member by id or exact name. */
export function parseEvaluations(body: Record<string, unknown>, members: { id: string; name: string }[]) {
  const year = Number(body.year);
  const month = Number(body.month);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) throw new EvaluationInputError('year is invalid');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new EvaluationInputError('month is invalid');
  if (!Array.isArray(body.evaluations) || body.evaluations.length === 0 || body.evaluations.length > 50) {
    throw new EvaluationInputError('evaluations must be a list of 1-50 entries');
  }

  const seen = new Set<string>();
  const evaluations: EvaluationInput[] = body.evaluations.map((raw: unknown, index: number) => {
    if (!raw || typeof raw !== 'object') throw new EvaluationInputError(`evaluations[${index}] is invalid`);
    const entry = raw as Record<string, unknown>;
    const member = members.find(m => m.id === entry.memberId) ?? members.find(m => m.name === entry.memberName);
    if (!member) throw new EvaluationInputError(`evaluations[${index}]: member not found`);
    if (seen.has(member.id)) throw new EvaluationInputError(`evaluations[${index}]: ${member.name} appears twice`);
    seen.add(member.id);
    return {
      memberId: member.id,
      summary: text(entry.summary, `evaluations[${index}].summary`, true)!,
      strengths: text(entry.strengths, `evaluations[${index}].strengths`),
      improvements: text(entry.improvements, `evaluations[${index}].improvements`),
      nextSteps: text(entry.nextSteps, `evaluations[${index}].nextSteps`),
    };
  });
  return { year, month, evaluations };
}
