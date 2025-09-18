import React, { useEffect, useState } from "react";
import ChatWS from "@/components/ChatWS"; // ตัว WS component ที่เราต่อแล้ว

type Room = {
  id: number;
  customer: number;
  customer_name: string;
  updated_at: string;
  last_message?: { message: string } | null;
};

export default function AdminChat({ token }: { token: string }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [active, setActive] = useState<Room | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/chat/rooms/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: Room[] = await res.json();
      setRooms(data);
      if (data.length) setActive(data[0]);
    })();
  }, [token]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 12 }}>
      <aside style={{ border: "1px solid #1e293b", borderRadius: 10 }}>
        <div style={{ padding: 10, fontWeight: 600 }}>ลูกค้าทั้งหมด</div>
        <div style={{ maxHeight: 520, overflowY: "auto" }}>
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setActive(r)}
              style={{
                width: "100%", textAlign: "left", padding: 10, border: 0,
                background: active?.id === r.id ? "#1f2a44" : "transparent",
                cursor: "pointer"
              }}
            >
              <div style={{ fontWeight: 600 }}>{r.customer_name || `Room #${r.id}`}</div>
              <div style={{ fontSize: 12, opacity: .7 }}>
                {r.last_message?.message || "—"}
              </div>
            </button>
          ))}
          {!rooms.length && <div style={{ opacity:.6, padding:10 }}>ยังไม่มีห้อง</div>}
        </div>
      </aside>

      <main>
        {active ? (
          <ChatWS roomId={active.id} token={token} />
        ) : (
          <div style={{ opacity:.6 }}>เลือกห้องทางซ้ายเพื่อเริ่มคุย</div>
        )}
      </main>
    </div>
  );
}
