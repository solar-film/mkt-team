"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { HiRefresh } from "react-icons/hi";
import { fetchWorkspace } from "@/lib/workspace-fetch";

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
        ทุกเช้า 06:30 ระบบดึงโพสต์ 3 เพจจาก Windsor แล้วจับคู่กับคอนเทนต์ Facebook ในระบบ (ข้อความต้นโพสต์ตรงกับชื่องาน และวันเผยแพร่ห่างไม่เกิน 1 วัน) · บันทึก Reach เป็น D+7 เมื่อโพสต์อายุ 7–9 วัน · โพสต์ที่จับคู่ไม่ได้ ตรวจชื่องานให้ตรงกับบรรทัดแรกของโพสต์ · 30 วันล่าสุด: จับคู่ได้ {matched} จาก {posts.length} โพสต์
      </p>
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
                <td style={cell}>{p.d7 ? `${p.d7.reach?.toLocaleString("th-TH") ?? "—"}${p.d7.source === "windsor" ? "" : " (กรอกเอง)"}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
