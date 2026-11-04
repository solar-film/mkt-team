"use client";

import { useState } from "react";
import { fetchWorkspace } from "@/lib/workspace-fetch";

type Platform = "instagram" | "tiktok_organic";
const labels: Record<Platform, string> = { instagram: "Instagram", tiktok_organic: "TikTok" };
type Counts = { posts: number; matched: number; created: number; filled: number; kept: number; young: number; missingReach: number; unmatched: number; ambiguous: number };
type Result = Counts & { platform: Platform; month: string; complete: boolean };
type Response = Counts & { ok: boolean; parts: number; message?: string | null; error?: string };
type Step = { platform: Platform; month: string };
type Resume = { steps: Step[]; index: number; part: number; parts: number; total: Counts };
const empty = (): Counts => ({ posts: 0, matched: 0, created: 0, filled: 0, kept: 0, young: 0, missingReach: 0, unmatched: 0, ambiguous: 0 });
const countKeys = Object.keys(empty()) as (keyof Counts)[];

function previousMonth() {
  const date = new Date(Date.now() + 7 * 3_600_000);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

/** Historical running totals, saved with a note; these are never represented as day-seven measurements. */
export function SocialReachPanel() {
  const [from, setFrom] = useState(previousMonth);
  const [to, setTo] = useState(previousMonth);
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [resume, setResume] = useState<Resume | null>(null);

  const changeRange = (set: (value: string) => void, value: string) => {
    set(value); setResume(null); setError("");
  };
  const saveResult = (step: Step, total: Counts, complete: boolean) => {
    setResults(before => [...before.filter(row => row.platform !== step.platform || row.month !== step.month), { ...step, ...total, complete }]);
  };
  const run = async () => {
    let state = resume;
    if (!state) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(from) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(to) || from > to) {
        setError("เลือกช่วงเดือนให้ถูกต้อง"); return;
      }
      const months: string[] = [];
      for (const date = new Date(`${from}-01T00:00:00Z`); date.toISOString().slice(0, 7) <= to; date.setUTCMonth(date.getUTCMonth() + 1)) {
        months.push(date.toISOString().slice(0, 7));
        if (months.length > 24) { setError("เลือกได้ครั้งละไม่เกิน 24 เดือน"); return; }
      }
      const platforms: Platform[] = platform === "all" ? ["instagram", "tiktok_organic"] : [platform];
      if (!confirm(`เติม Reach ย้อนหลัง ${platforms.map(p => labels[p]).join(" / ")} ช่วง ${from} ถึง ${to}?\n\nเติมเฉพาะช่องว่างของโพสต์ที่ครบ 7 วัน จับคู่ด้วยลิงก์ตรงกันเท่านั้น และคงตัวเลขเดิมรวมถึง 0\nเมื่อบันทึก Reach สำเร็จ จะเปลี่ยนประเภทเป็น Organic แม้เดิมเป็น Paid\n\nค่าที่เติมเป็นยอดสะสม ณ วันที่ดึง พร้อมหมายเหตุว่าไม่ใช่ยอดวันที่ 7 พอดี`)) return;
      state = { steps: months.flatMap(month => platforms.map(p => ({ month, platform: p }))), index: 0, part: 0, parts: 1, total: empty() };
      setResults([]);
    }
    setRunning(true); setError(""); setResume(null);
    const work = { ...state, total: { ...state.total } };
    try {
      while (work.index < work.steps.length) {
        const step = work.steps[work.index];
        while (work.part < work.parts) {
          setProgress(`${labels[step.platform]} ${step.month} · ช่วง ${work.part + 1}${work.parts > 1 ? `/${work.parts}` : ""} · เดือน/ช่องทาง ${work.index + 1}/${work.steps.length}`);
          const response = await fetchWorkspace("/api/admin/social-reach", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...step, part: work.part }),
          });
          const data: Response = await response.json().catch(() => ({}));
          if (!response.ok || data.ok !== true) throw new Error(data.message || data.error || (response.status === 504 ? "ใช้เวลานานเกิน 60 วินาที" : "ดึงไม่สำเร็จ"));
          if (!Number.isInteger(data.parts) || data.parts < 1 || countKeys.some(key => !Number.isInteger(data[key]) || data[key] < 0)) throw new Error("ผลตอบกลับไม่ครบ กรุณาตรวจและทำต่ออีกครั้ง");
          countKeys.forEach(key => { work.total[key] += data[key]; });
          work.parts = data.parts;
          work.part++;
          saveResult(step, { ...work.total }, work.part === work.parts);
        }
        work.index++; work.part = 0; work.parts = 1; work.total = empty();
      }
      setProgress("เติมย้อนหลังครบช่วงที่เลือกแล้ว");
    } catch (caught) {
      setResume(work);
      setError(`${caught instanceof Error ? caught.message : "ดึงไม่สำเร็จ"} · กดทำต่อได้ ตัวเลขที่บันทึกแล้วจะคงอยู่`);
    } finally { setRunning(false); }
  };

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }} aria-labelledby="social-reach-title">
      <h3 id="social-reach-title" style={{ margin: 0 }}>Reach ย้อนหลัง — Instagram / TikTok</h3>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>เติมเฉพาะ Reach ที่ยังว่างของโพสต์ที่ครบ 7 วัน จับคู่จากลิงก์โพสต์ตรงกัน และคงค่าที่มีอยู่รวมถึง 0 · เมื่อบันทึกสำเร็จเปลี่ยนเป็น Organic แม้เดิมเป็น Paid · บันทึกหมายเหตุว่าเป็นยอดสะสมย้อนหลัง ไม่ใช่ยอดวันที่ 7 พอดี · ไม่รวม YouTube</p>
      <div style={{ display: "flex", alignItems: "end", gap: "0.75rem", flexWrap: "wrap" }}>
        <label>ช่องทาง Reach ย้อนหลัง<select className="form-input" value={platform} disabled={running} onChange={e => { setPlatform(e.target.value as Platform | "all"); setResume(null); setError(""); }}>
          <option value="all">Instagram และ TikTok</option><option value="instagram">Instagram</option><option value="tiktok_organic">TikTok</option>
        </select></label>
        <label>Reach ย้อนหลัง ตั้งแต่เดือน<input type="month" className="form-input" value={from} disabled={running} onChange={e => changeRange(setFrom, e.target.value)} /></label>
        <label>Reach ย้อนหลัง ถึงเดือน<input type="month" className="form-input" value={to} disabled={running} onChange={e => changeRange(setTo, e.target.value)} /></label>
        <button className="btn btn-primary btn-sm" disabled={running || !from || !to} onClick={() => void run()}>{running ? "กำลังเติม Reach ย้อนหลัง…" : resume ? "ทำต่อ: Reach Instagram / TikTok" : "เติม Reach Instagram / TikTok"}</button>
      </div>
      {progress && <p role="status" style={{ margin: 0, fontSize: "0.85rem" }}>{progress}</p>}
      {error && <p role="alert" style={{ margin: 0, color: "var(--color-danger)" }}>{error}</p>}
      {results.length > 0 && <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead><tr>{["ช่องทาง / เดือน", "สร้างใหม่", "เติมช่องว่าง", "คงค่าเดิม", "ยังไม่ครบ 7 วัน", "ไม่มี Reach", "ไม่พบงานที่ลิงก์ตรง", "ข้อมูลกำกวม", "สถานะ"].map(label => <th key={label} style={{ padding: "0.5rem", textAlign: "left", whiteSpace: "nowrap" }}>{label}</th>)}</tr></thead>
        <tbody>{results.map(row => <tr key={`${row.platform}:${row.month}`}>
          <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{labels[row.platform]} {row.month}</td>
          {[row.created, row.filled, row.kept, row.young, row.missingReach, row.unmatched, row.ambiguous].map((n, i) => <td key={i} style={{ padding: "0.5rem" }}>{n.toLocaleString("th-TH")}</td>)}
          <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{row.complete ? "ครบทุกช่วง" : "กำลังทำ / รอทำต่อ"}</td>
        </tr>)}</tbody>
      </table><p style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>“ไม่พบงานที่ลิงก์ตรง” นับโพสต์ต้นทางที่ไม่มีงานตรงกัน · รายการที่ไม่พบข้อมูลยังเว้นว่าง ไม่แทนด้วย 0</p></div>}
    </section>
  );
}
