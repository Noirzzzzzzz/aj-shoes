import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ChatMsg = {
  id: number;
  message?: string;
  image?: string | null;
  timestamp: string;
  sender: number;
  sender_name: string;
  sender_role: "superadmin" | "subadmin" | "customer";
  is_admin: boolean;
};

type Props = {
  roomId: number;
  token: string; // JWT access token
};

export default function ChatWS({ roomId, token }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const url = useMemo(
    () =>
      `ws${location.protocol === "https:" ? "s" : ""}://${location.host}/ws/chat/${roomId}/?token=${encodeURIComponent(
        token
      )}`,
    [roomId, token]
  );

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Connect WS
  const connect = useCallback(() => {
    setStatus("connecting");
    const ws = new WebSocket(url, ["Bearer", token]);
    wsRef.current = ws;

    ws.onopen = () => setStatus("open");

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.message) {
          setMessages((prev) => [...prev, data.message as ChatMsg]);
        }
      } catch (e) {
        console.warn("WS parse error", e);
      }
    };

    ws.onerror = (e) => {
      console.error("WS error:", e);
    };

    ws.onclose = () => {
      setStatus("closed");
      setTimeout(connect, 2000); // reconnect 2s
    };
  }, [token, url]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close(1000, "leave page");
  }, [connect]);

  // Send text
  const sendText = useCallback(() => {
    const msg = text.trim();
    if (!msg || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ message: msg }));
    setText("");
  }, [text]);

  // Send image (via REST, not WS)
  const sendImage = async (file: File) => {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch(`/api/chat/rooms/${roomId}/send/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      alert("ส่งรูปไม่สำเร็จ");
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <strong>Chat Room #{roomId}</strong>{" "}
        <small style={{ opacity: 0.7 }}>status: {status}</small>
      </div>

      {/* Chat messages */}
      <div
        style={{
          height: 420,
          overflowY: "auto",
          borderRadius: 12,
          background: "#0f172a",
          border: "1px solid #1e293b",
          padding: 12,
          color: "#e2e8f0",
        }}
      >
        {messages.map((m) => {
          const mine = m.is_admin; // ถ้าเป็นแอดมินจัดด้านขวา
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: mine ? "flex-end" : "flex-start",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  maxWidth: "70%",
                  background: mine ? "#2563eb" : "#111827",
                  color: mine ? "#fff" : "#e5e7eb",
                  borderRadius: 12,
                  padding: "8px 12px",
                  borderBottomRightRadius: mine ? 4 : 12,
                  borderBottomLeftRadius: mine ? 12 : 4,
                }}
              >
                {m.image ? (
                  <img src={m.image} alt="img" style={{ maxWidth: 240, borderRadius: 8 }} />
                ) : (
                  m.message
                )}
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                  {new Date(m.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}></div>
      </div>

      {/* Input box */}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendText()}
          placeholder="พิมพ์ข้อความ…"
          style={{
            flex: 1,
            background: "#0b1220",
            border: "1px solid #1f2937",
            borderRadius: 10,
            color: "#e5e7eb",
            outline: "none",
            padding: "10px 12px",
          }}
        />
        <button
          disabled={status !== "open" || !text.trim()}
          onClick={sendText}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: 0,
            background: "#2563eb",
            color: "white",
            opacity: status === "open" && text.trim() ? 1 : 0.5,
            cursor: status === "open" && text.trim() ? "pointer" : "not-allowed",
          }}
        >
          ส่ง
        </button>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files && sendImage(e.target.files[0])}
        />
      </div>
    </div>
  );
}
