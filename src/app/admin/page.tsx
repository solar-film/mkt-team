"use client";
import { fetchWorkspace } from '@/lib/workspace-fetch';
import { toast } from 'react-hot-toast';

import { useState, useEffect } from "react";
import { HiTrash, HiOutlineDatabase, HiLogout, HiRefresh } from "react-icons/hi";

type TableName = "events" | "tasks" | "kpis" | "contents" | "ideas" | "meetings" | "members";

export default function AdminPanel() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<TableName>("events");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Authenticate
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetchWorkspace('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (response.ok) {
        setIsAuthenticated(true);
        setPassword('');
      } else {
        toast.error(response.status === 503 ? 'ยังไม่ได้ตั้งค่ารหัสผู้ดูแลบนเซิร์ฟเวอร์' : 'รหัสผ่านไม่ถูกต้อง');
      }
    } catch { toast.error('เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง'); }
  };

  const handleLogout = async () => {
    await fetchWorkspace('/api/admin/session', { method: 'DELETE' });
    setIsAuthenticated(false);
    setPassword("");
  };

  useEffect(() => {
    void fetchWorkspace('/api/admin/session').then(response => response.json())
      .then(data => setIsAuthenticated(data.authenticated === true)).catch(() => {});
  }, []);

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = `/api/admin/data?table=${activeTab}`;
      const res = await fetchWorkspace(endpoint);
      const json = await res.json();
      setData(Array.isArray(json) ? json : json.data || []);
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated, activeTab]);

  // Delete Data
  const handleDelete = async (id: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบข้อมูลนี้? การกระทำนี้ไม่สามารถกู้คืนได้")) return;
    
    try {
      const endpoint = `/api/admin/data?table=${activeTab}`;
      const res = await fetchWorkspace(`${endpoint}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        fetchData();
      } else {
        toast.error("ลบข้อมูลไม่สำเร็จ");
      }
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "var(--color-bg)" }}>
        <form onSubmit={handleLogin} className="card" style={{ padding: "2rem", width: "100%", maxWidth: "400px", textAlign: "center" }}>
          <HiOutlineDatabase style={{ fontSize: "3rem", color: "var(--color-primary)", marginBottom: "1rem" }} />
          <h2 style={{ marginBottom: "1.5rem" }}>Admin Database Panel</h2>
          <input
            type="password"
            className="form-input"
            placeholder="ใส่รหัสผ่าน..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: "1rem" }}
            autoFocus
          />
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>เข้าสู่ระบบ</button>
        </form>
      </div>
    );
  }

  // Define columns to display based on active tab
  const getColumns = () => {
    switch (activeTab) {
      case "events": return ["title", "date", "type"];
      case "tasks": return ["title", "status", "deadline"];
      case "kpis": return ["name", "target", "current", "month"];
      case "contents": return ["title", "status", "publishDate"];
      case "ideas": return ["title", "status"];
      case "meetings": return ["title", "date", "status"];
      case "members": return ["name", "role", "status"];
      default: return ["title"];
    }
  };

  const tabs: { key: TableName; label: string }[] = [
    { key: "events", label: "แจ้งเตือน (Events)" },
    { key: "tasks", label: "งาน (Tasks)" },
    { key: "contents", label: "คอนเทนต์ (Contents)" },
    { key: "kpis", label: "KPIs" },
    { key: "ideas", label: "ไอเดีย (Ideas)" },
    { key: "meetings", label: "การประชุม (Meetings)" },
    { key: "members", label: "ทีมงาน (Members)" },
  ];

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <HiOutlineDatabase /> Database Admin Panel
        </h1>
        <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <HiLogout /> ออกจากระบบ
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`btn btn-sm ${activeTab === tab.key ? "btn-primary" : "btn-secondary"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3 style={{ margin: 0 }}>ตาราง: {activeTab}</h3>
          <button onClick={fetchData} className="btn btn-icon btn-sm" title="รีเฟรช">
            <HiRefresh />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>กำลังโหลดข้อมูล...</div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-secondary)" }}>ไม่พบข้อมูลในตารางนี้</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--color-border)", textAlign: "left" }}>
                <th style={{ padding: "0.75rem", width: "80px" }}>Action</th>
                <th style={{ padding: "0.75rem", fontFamily: "monospace" }}>ID</th>
                {getColumns().map(col => (
                  <th key={col} style={{ padding: "0.75rem", textTransform: "capitalize" }}>{col}</th>
                ))}
                <th style={{ padding: "0.75rem" }}>Created At</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-surface)" }}>
                  <td style={{ padding: "0.75rem" }}>
                    <button 
                      onClick={() => handleDelete(row.id)}
                      className="btn btn-icon btn-sm" 
                      style={{ color: "var(--color-danger)" }}
                      title="ลบ"
                    >
                      <HiTrash />
                    </button>
                  </td>
                  <td style={{ padding: "0.75rem", fontFamily: "monospace", color: "var(--color-text-secondary)" }}>
                    {row.id.substring(0, 8)}...
                  </td>
                  {getColumns().map(col => (
                    <td key={col} style={{ padding: "0.75rem" }}>
                      {String(row[col] === null || row[col] === undefined ? '-' : row[col])}
                    </td>
                  ))}
                  <td style={{ padding: "0.75rem", color: "var(--color-text-secondary)" }}>
                    {row.createdAt ? new Date(row.createdAt).toLocaleDateString("th-TH") : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
