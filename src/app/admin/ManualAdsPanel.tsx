"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { HiOutlineTrash } from "react-icons/hi2";
import { fetchWorkspace } from "@/lib/workspace-fetch";
import { monthLabel } from "@/lib/ads-data";

type Row = { platform: string; month: string; spend: number; impressions: number; clicks: number; leads: number; syncedAt: string };

const cell: React.CSSProperties = { padding: "0.5rem 0.75rem", verticalAlign: "top" };
const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).slice(0, 7);
const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.25rem" };
const empty = { spend: "", impressions: "", clicks: "", leads: "" };

/**
 * ChatGPT Ads spend typed in by the admin, one figure per month, once the platform leaves the
 * Windsor plan (set WINDSOR_SKIP_PLATFORMS=openai_ads on Vercel at the same time).
 */
export function ManualAdsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [month, setMonth] = useState(thisMonth);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchWorkspace("/api/admin/manual-ads");
      if (!res.ok) throw new Error();
      setRows((await res.json()).rows);
    } catch { toast.error("โหลดยอดที่กรอกไว้ไม่สำเร็จ"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetchWorkspace("/api/admin/manual-ads", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform: "openai_ads", month, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      toast.success(`บันทึก ChatGPT Ads ${monthLabel(month)} แล้ว`);
      setForm(empty);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally { setSaving(false); }
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`ลบยอด ChatGPT Ads ${monthLabel(row.month)} ที่กรอกไว้?`)) return;
    const res = await fetchWorkspace(`/api/admin/manual-ads?platform=${row.platform}&month=${row.month}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) { toast.success("ลบแล้ว"); void load(); } else toast.error("ลบไม่สำเร็จ");
  };

  const pick = (m: string) => {
    setMonth(m);
    const row = rows.find(r => r.month === m);
    setForm(row ? { spend: String(row.spend), impressions: String(row.impressions), clicks: String(row.clicks), leads: String(row.leads) } : empty);
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h3 style={{ margin: 0 }}>ChatGPT Ads (กรอกเอง)</h3>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
        กรอกยอดรวมทั้งเดือนจาก ChatGPT Ads Manager แทนการดึงจาก Windsor · นับเป็นค่าโฆษณาของ GFS B2C เหมือนเดิม · กราฟรายวันจะเห็นยอดนี้เป็นก้อนเดียวที่วันที่ 1 ของเดือน · กรอกเดือนเดิมซ้ำ = แก้ยอด
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
        <label className="form-label" style={field}>
          เดือน <input type="month" className="form-input" value={month} max={thisMonth()} onChange={e => pick(e.target.value)} />
        </label>
        <label className="form-label" style={field}>
          ค่าใช้จ่าย (บาท) <input inputMode="decimal" className="form-input" value={form.spend} onChange={e => setForm({ ...form, spend: e.target.value })} placeholder="0" />
        </label>
        <label className="form-label" style={field}>
          Impressions <input inputMode="numeric" className="form-input" value={form.impressions} onChange={e => setForm({ ...form, impressions: e.target.value })} placeholder="0" />
        </label>
        <label className="form-label" style={field}>
          Clicks <input inputMode="numeric" className="form-input" value={form.clicks} onChange={e => setForm({ ...form, clicks: e.target.value })} placeholder="0" />
        </label>
        <label className="form-label" style={field}>
          Conversions <input inputMode="numeric" className="form-input" value={form.leads} onChange={e => setForm({ ...form, leads: e.target.value })} placeholder="0" />
        </label>
        <button className="btn btn-primary btn-sm" disabled={saving || !form.spend} onClick={() => void save()}>
          {saving ? "กำลังบันทึก…" : "บันทึกยอดเดือนนี้"}
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--color-border)" }}>
              <th style={cell}>เดือน</th><th style={cell}>ค่าใช้จ่าย</th><th style={cell}>Impressions</th><th style={cell}>Clicks</th><th style={cell}>Conversions</th><th style={cell}>บันทึกเมื่อ</th><th style={cell} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td style={cell} colSpan={7}>ยังไม่มียอดที่กรอกเอง</td></tr> : rows.map(r => (
              <tr key={`${r.platform}-${r.month}`} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={cell}><button className="btn btn-sm" onClick={() => pick(r.month)} title="แก้ยอดเดือนนี้">{monthLabel(r.month)}</button></td>
                <td style={cell}>฿{r.spend.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</td>
                <td style={cell}>{r.impressions.toLocaleString("th-TH")}</td>
                <td style={cell}>{r.clicks.toLocaleString("th-TH")}</td>
                <td style={cell}>{r.leads.toLocaleString("th-TH")}</td>
                <td style={cell}>{new Date(r.syncedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</td>
                <td style={cell}><button className="btn btn-icon btn-sm" onClick={() => void remove(r)} aria-label={`ลบ ${monthLabel(r.month)}`}><HiOutlineTrash /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
