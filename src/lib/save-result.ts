/** Throws with the server's message when a save is refused, so a form never closes as if it had worked. */
export async function requireOk(pending: Promise<Response> | Response): Promise<Response> {
  const response = await pending;
  if (response.ok) return response;
  let detail = '';
  try { detail = (await response.clone().json())?.error || ''; } catch {}
  throw new Error(detail ? `บันทึกไม่สำเร็จ: ${detail}` : 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
}

export function saveErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.startsWith('บันทึกไม่สำเร็จ') ? error.message : 'บันทึกไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองใหม่';
}
