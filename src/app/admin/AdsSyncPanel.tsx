"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { HiRefresh } from "react-icons/hi";
import { fetchWorkspace } from "@/lib/workspace-fetch";
import { monthLabel, PLATFORM_INFO, PLATFORMS, shiftMonth, type Platform } from "@/lib/ads-data";

type Run = {
  id: string; platform: string; trigger: string; ok: boolean; rows: number; message: string | null;
  dateFrom: string; dateTo: string; startedAt: string;
};

const cell: React.CSSProperties = { padding: "0.5rem 0.75rem", verticalAlign: "top" };
const thisMonth = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).slice(0, 7);
const label = (platform: string) => platform === "facebook_organic" ? "โพสต์ Facebook" : PLATFORM_INFO[platform as Platform]?.label ?? platform;

/** Pulls past months from Windsor one platform-month at a time, so no request runs long. */
export function AdsSyncPanel() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [from, setFrom] = useState(() => `${Number(thisMonth().slice(0, 4)) - 1}-01`);
  const [to, setTo] = useState(thisMonth);
  const [platforms, setPlatforms] = useState<Platform[]>([...PLATFORMS]);
  const [progress, setProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchWorkspace("/api/admin/ads-sync");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConfigured(data.configured);
      setRuns(data.runs);
    } catch { toast.error("โหลดประวัติการดึงข้อมูลไม่สำเร็จ"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async () => {
    if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to) || from > to) { toast.error("เลือกช่วงเดือนให้ถูกต้อง"); return; }
    if (platforms.length === 0) { toast.error("เลือกอย่างน้อย 1 ช่องทาง"); return; }
    const months: string[] = [];
    for (let m = from; m <= to && months.length < 60; m = shiftMonth(m, 1)) months.push(m);
    let failed = 0;
    for (const platform of platforms) {
      for (const month of months) {
        setProgress(`${label(platform)} · ${monthLabel(month)}`);
        const res = await fetchWorkspace("/api/admin/ads-sync", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ platform, month }),
        }).catch(() => null);
        if (!res?.ok) {
          failed++;
          const data = await res?.json().catch(() => ({}));
          // A platform that is not connected fails every month the same way; stop after the first.
          toast.error(`${label(platform)} ${monthLabel(month)}: ${data?.message || data?.error || "ไม่สำเร็จ"}`);
          break;
        }
      }
    }
    setProgress(null);
    if (!failed) toast.success("ดึงข้อมูลย้อนหลังครบแล้ว");
    void load();
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>ข้อมูลโฆษณา (Windsor.ai)</h3>
        <button onClick={() => void load()} className="btn btn-icon btn-sm" title="รีเฟรช"><HiRefresh /></button>
      </div>
      {configured === false && (
        <p style={{ margin: 0, color: "#b45309" }}>ยังไม่ได้ตั้งค่า WINDSOR_API_KEY บน Vercel — ดึงข้อมูลไม่ได้จนกว่าจะตั้งค่า</p>
      )}
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
        ทุกเช้าระบบดึงข้อมูล 10 วันล่าสุดเอง ใช้ส่วนนี้เมื่อต้องการดึงเดือนย้อนหลัง (ดึงซ้ำได้ ข้อมูลเดือนเดิมจะถูกแทนที่)
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
        <label className="form-label" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          ตั้งแต่เดือน <input type="month" className="form-input" value={from} max={to} onChange={e => setFrom(e.target.value)} />
        </label>
        <label className="form-label" style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          ถึงเดือน <input type="month" className="form-input" value={to} max={thisMonth()} onChange={e => setTo(e.target.value)} />
        </label>
        {PLATFORMS.map(p => (
          <label key={p} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.875rem" }}>
            <input
              type="checkbox"
              checked={platforms.includes(p)}
              onChange={e => setPlatforms(prev => (e.target.checked ? [...prev, p] : prev.filter(x => x !== p)))}
            />
            {PLATFORM_INFO[p].label}
          </label>
        ))}
        <button className="btn btn-primary btn-sm" disabled={progress !== null || configured === false} onClick={() => void run()}>
          {progress ? `กำลังดึง ${progress}…` : "ดึงข้อมูลย้อนหลัง"}
        </button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--color-border)" }}>
              <th style={cell}>เวลา</th><th style={cell}>ช่องทาง</th><th style={cell}>ช่วงวันที่</th><th style={cell}>โดย</th><th style={cell}>ผล</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? <tr><td style={cell} colSpan={5}>ยังไม่เคยดึงข้อมูล</td></tr> : runs.map(r => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={cell}>{new Date(r.startedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</td>
                <td style={cell}>{label(r.platform)}</td>
                <td style={cell}>{r.dateFrom} – {r.dateTo}</td>
                <td style={cell}>{r.trigger === "cron" ? "อัตโนมัติ" : "ผู้ดูแล"}</td>
                <td style={{ ...cell, color: r.ok ? "#047857" : "#b91c1c" }}>{r.ok ? `สำเร็จ ${r.rows} แถว` : r.message || "ไม่สำเร็จ"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
