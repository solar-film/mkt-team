"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { HiRefresh } from "react-icons/hi";
import { fetchWorkspace } from "@/lib/workspace-fetch";
import { PAGE_METRIC_SOURCE } from "@/lib/facebook-posts";

type Post = {
  id: string; createdTime: string; firstLine: string; reach: number | null;
  contentTitle: string | null; d7: { reach: number | null; source: string } | null;
};

const cell: React.CSSProperties = { padding: "0.5rem 0.75rem", verticalAlign: "top" };

/** Facebook posts pulled from Windsor and whether each found its content item and D+7 reach. */
export function FacebookPostsPanel() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetchWorkspace("/api/admin/facebook-posts");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPosts(data.posts);
      setConfigured(data.configured);
    } catch { toast.error("โหลดโพสต์ Facebook ไม่สำเร็จ"); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await fetchWorkspace("/api/admin/facebook-posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || "ดึงไม่สำเร็จ");
      toast.success(`ได้ ${data.posts} โพสต์ · จับคู่ใหม่ ${data.matched} · บันทึก D+7 ${data.d7}`);
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ดึงไม่สำเร็จ");
    } finally { setRunning(false); }
  };

  // Past months: fill D+7 reach from the page (empty or 0 only; typed numbers stay).
  const [month, setMonth] = useState(() => {
    const d = new Date(Date.now() + 7 * 3_600_000);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7);
  });
  // After a failed part, the next click on the same month starts from that part.
  const [resume, setResume] = useState<{ month: string; part: number; parts: number } | null>(null);
  const resumeFrom = resume && resume.month === month ? resume : null;
  const backfill = async () => {
    if (!resumeFrom && !confirm(`เติม Reach D+7 ของเดือน ${month} จาก Windsor?\n\n• คอนเทนต์ที่ยังไม่มี D+7 → สร้างใหม่\n• D+7 ที่ช่อง Reach ว่างหรือเป็น 0 → ใส่ค่าจากเพจ\n• Reach ที่กรอกไว้แล้ว (มากกว่า 0) → คงเดิม\n\nค่าที่ได้เป็นยอดสะสม ณ วันนี้ ไม่ใช่ยอดวันที่ 7 พอดี`)) return;
    setRunning(true);
    // One request per week of the month (a whole month is too slow for one request); stop at the first failure.
    const total = { posts: 0, matched: 0, created: 0, filled: 0, kept: 0 };
    let part = resumeFrom?.part ?? 0;
    let parts = resumeFrom?.parts ?? 1;
    setResume(null);
    try {
      while (part < parts) {
        setProgress(parts > 1 ? `${part + 1}/${parts}` : `${part + 1}`);
        const res = await fetchWorkspace("/api/admin/facebook-posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, part }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`ช่วงที่ ${part + 1}: ${data.message || data.error || (res.status === 504 ? "ใช้เวลานานเกิน 60 วินาที" : "ดึงไม่สำเร็จ")}`);
        for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += Number(data[key]) || 0;
        parts = data.parts;
        part++;
      }
      toast.success(`${month}: ได้ ${total.posts} โพสต์ · จับคู่ใหม่ ${total.matched} · สร้าง D+7 ${total.created} · เติม Reach ${total.filled} · คงค่าที่กรอก ${total.kept}`, { duration: 10000 });
    } catch (error) {
      setResume({ month, part, parts });
      const done = ` (รอบนี้: สร้าง ${total.created} · เติม ${total.filled}) · กดปุ่มอีกครั้งเพื่อทำต่อจากช่วงที่ ${part + 1}`;
      toast.error(`${error instanceof Error ? error.message : "ดึงไม่สำเร็จ"}${done}`, { duration: 12000 });
    } finally {
      setRunning(false);
      setProgress("");
      void load();
    }
  };

  const matched = posts.filter(p => p.contentTitle).length;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Reach โพสต์ Facebook (D+7 อัตโนมัติ)</h3>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-primary btn-sm" disabled={running || configured === false} onClick={() => void runNow()}>
            {running ? "กำลังดึง…" : "ดึงโพสต์ 12 วันล่าสุดตอนนี้"}
          </button>
          <button onClick={() => void load()} className="btn btn-icon btn-sm" title="รีเฟรช"><HiRefresh /></button>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
        ทุกเช้า 06:30 ระบบดึงโพสต์ทุกเพจที่ต่อไว้ใน Windsor แล้วจับคู่กับคอนเทนต์ Facebook ในระบบ (ข้อความต้นโพสต์ตรงกับชื่องาน และวันเผยแพร่ห่างไม่เกิน 1 วัน) · บันทึก Reach เป็น D+7 เมื่อโพสต์อายุ 7–9 วัน · โพสต์ที่จับคู่ไม่ได้ ตรวจชื่องานให้ตรงกับบรรทัดแรกของโพสต์ · 30 วันล่าสุด: จับคู่ได้ {matched} จาก {posts.length} โพสต์
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", padding: "0.75rem", borderRadius: "8px", background: "var(--color-surface-hover)" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>เติม Reach ย้อนหลัง</span>
        <input type="month" className="form-input" style={{ width: "auto", padding: "0.3rem 0.5rem" }} value={month} onChange={e => setMonth(e.target.value)} aria-label="เดือนที่จะเติม Reach" />
        <button className="btn btn-secondary btn-sm" disabled={running || configured === false || !month} onClick={() => void backfill()}>
          {running ? (progress ? `กำลังดึงช่วง ${progress}…` : "กำลังดึง…") : resumeFrom ? `ทำต่อจากช่วงที่ ${resumeFrom.part + 1}/${resumeFrom.parts}` : "เติม Reach เดือนนี้จาก Windsor"}
        </button>
        <span style={{ fontSize: "0.78rem", color: "var(--color-text-secondary)" }}>เติมเฉพาะช่องว่างหรือ 0 · สร้าง D+7 ให้คอนเทนต์ที่ยังไม่มี · ค่าที่กรอกไว้คงเดิม · เป็นยอดสะสม ณ วันที่ดึง</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--color-border)" }}>
              <th style={cell}>โพสต์เมื่อ</th><th style={cell}>บรรทัดแรกของโพสต์</th><th style={cell}>Reach ล่าสุด</th><th style={cell}>คอนเทนต์ในระบบ</th><th style={cell}>D+7</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? <tr><td style={cell} colSpan={5}>ยังไม่มีโพสต์ที่ดึงมา</td></tr> : posts.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ ...cell, whiteSpace: "nowrap" }}>{new Date(p.createdTime).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" })}</td>
                <td style={cell}>{p.firstLine || "—"}</td>
                <td style={cell}>{p.reach === null ? "—" : p.reach.toLocaleString("th-TH")}</td>
                <td style={{ ...cell, color: p.contentTitle ? "inherit" : "#b45309" }}>{p.contentTitle ?? "จับคู่ไม่ได้"}</td>
                <td style={cell}>{p.d7 ? `${p.d7.reach?.toLocaleString("th-TH") ?? "—"}${p.d7.source === PAGE_METRIC_SOURCE ? "" : " (กรอกเอง)"}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
