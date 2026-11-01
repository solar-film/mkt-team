"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { HiRefresh } from "react-icons/hi";
import { fetchWorkspace } from "@/lib/workspace-fetch";

type PinRow = { id: string; name: string; role: string; status: string; pinUpdatedAt: string | null };
type AttemptRow = {
  id: string; kind: string; memberId: string | null; memberName: string | null; success: boolean;
  reason: string; ip: string; userAgent: string | null; createdAt: string;
};

const cell: React.CSSProperties = { padding: "0.6rem 0.75rem", verticalAlign: "middle" };
const when = (value: string) => new Date(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "medium" });

const REASONS: Record<string, string> = {
  ok: "เข้าสำเร็จ", "wrong pin": "PIN ผิด", "wrong password": "รหัสผิด", locked: "ถูกล็อกชั่วคราว",
  "no pin": "ยังไม่มี PIN", inactive: "สมาชิกปิดใช้งาน", "unknown member": "ไม่พบสมาชิก",
  "wrong pin (change)": "PIN ผิด (ตอนเปลี่ยน PIN)", "pin changed": "เปลี่ยน PIN เอง", "pin set by admin": "ผู้ดูแลตั้ง PIN",
};

/** Admin sets or resets each member's 6-digit PIN; the member is signed out everywhere. */
export function PinPanel() {
  const [rows, setRows] = useState<PinRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWorkspace("/api/admin/member-pins");
      if (!res.ok) throw new Error();
      setRows(await res.json());
    } catch { toast.error("โหลดรายชื่อไม่สำเร็จ"); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async (memberId: string) => {
    const pin = drafts[memberId] || "";
    if (!/^\d{6}$/.test(pin)) { toast.error("PIN ต้องเป็นตัวเลข 6 หลัก"); return; }
    setSaving(memberId);
    try {
      const res = await fetchWorkspace("/api/admin/member-pins", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ตั้ง PIN ไม่สำเร็จ");
      toast.success("ตั้ง PIN แล้ว แจ้งสมาชิกโดยตรง (ไม่ส่งในกลุ่ม)");
      setDrafts(prev => ({ ...prev, [memberId]: "" }));
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ตั้ง PIN ไม่สำเร็จ");
    }
    setSaving(null);
  };

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h3 style={{ margin: 0 }}>PIN สมาชิก</h3>
        <button onClick={load} className="btn btn-icon btn-sm" title="รีเฟรช"><HiRefresh /></button>
      </div>
      <p style={{ marginTop: 0, color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
        ตั้งหรือรีเซ็ต PIN 6 หลัก (ห้ามเลขซ้ำหรือเรียงกัน) · สมาชิกจะถูกออกจากระบบทุกเครื่อง และเปลี่ยน PIN เองได้ภายหลังจากเมนูชื่อตัวเอง
      </p>
      {loading ? <div style={{ padding: "1rem" }}>กำลังโหลด…</div> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
              <th style={cell}>สมาชิก</th><th style={cell}>สถานะ PIN</th><th style={cell}>ตั้ง PIN ใหม่</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)", opacity: row.status === "inactive" ? 0.5 : 1 }}>
                <td style={cell}>{row.name} <span style={{ color: "var(--color-text-secondary)" }}>· {row.role}</span></td>
                <td style={cell}>{row.pinUpdatedAt ? `ตั้งแล้ว (${when(row.pinUpdatedAt)})` : <strong style={{ color: "var(--color-danger)" }}>ยังไม่มี — เข้าระบบไม่ได้</strong>}</td>
                <td style={cell}>
                  <form onSubmit={e => { e.preventDefault(); void save(row.id); }} style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      aria-label={`PIN ใหม่ของ ${row.name}`} className="form-input" inputMode="numeric" autoComplete="off" maxLength={6}
                      placeholder="6 หลัก" style={{ width: "7rem", letterSpacing: "0.2em" }}
                      value={drafts[row.id] || ""} onChange={e => setDrafts(prev => ({ ...prev, [row.id]: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                    />
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving === row.id}>{saving === row.id ? "…" : "บันทึก"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** The latest 200 sign-in attempts for members and the admin page. */
export function LoginLogPanel() {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWorkspace("/api/admin/login-log");
      if (!res.ok) throw new Error();
      setRows(await res.json());
    } catch { toast.error("โหลดประวัติไม่สำเร็จ"); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0 }}>ประวัติการเข้าระบบ (200 รายการล่าสุด)</h3>
        <button onClick={load} className="btn btn-icon btn-sm" title="รีเฟรช"><HiRefresh /></button>
      </div>
      {loading ? <div style={{ padding: "1rem" }}>กำลังโหลด…</div> : rows.length === 0 ? (
        <div style={{ padding: "1rem", color: "var(--color-text-secondary)" }}>ยังไม่มีประวัติ</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
              <th style={cell}>เวลา</th><th style={cell}>ประเภท</th><th style={cell}>สมาชิก</th><th style={cell}>ผล</th><th style={cell}>IP</th><th style={cell}>อุปกรณ์</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>{when(row.createdAt)}</td>
                <td style={cell}>{row.kind === "admin" ? "ผู้ดูแล" : "สมาชิก"}</td>
                <td style={cell}>{row.memberName || row.memberId || "-"}</td>
                <td style={{ ...cell, color: row.success ? "var(--color-success, #16a34a)" : "var(--color-danger)", whiteSpace: "nowrap" }}>
                  {REASONS[row.reason] || row.reason}
                </td>
                <td style={{ ...cell, fontFamily: "monospace" }}>{row.ip || "-"}</td>
                <td style={{ ...cell, maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-secondary)" }} title={row.userAgent || ""}>
                  {row.userAgent || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
