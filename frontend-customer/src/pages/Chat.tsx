import { useEffect, useRef, useState, useMemo } from "react";
import Protected from "@/components/Protected";
import api from "@/api/client";
import { FaImage } from "react-icons/fa";
import { IoIosSend } from "react-icons/io";

/* ---------- Types ---------- */
interface User {
  id: number;
  username: string;
  email: string;
  role: "customer" | "superadmin" | "subadmin" | string;
}

interface ChatRoom {
  id: number;
  customer: number;
  customer_name: string;
  customer_email: string;
  created_at: string;
  updated_at: string;
  last_message?: {
    message: string;
    timestamp: string;
    sender_name: string;
    is_admin: boolean;
  };
}

interface ChatMessage {
  id: number;
  message: string;
  image?: string;
  timestamp: string;
  sender: number;
  sender_name: string;
  sender_role: string;
  is_admin: boolean;
}

/* ---------- Config ---------- */
const MAX_IMAGE_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/* ---------- Page ---------- */
export default function Chat() {
  return (
    <Protected>
      <ChatInner />
    </Protected>
  );
}

/* ---------- Helpers ---------- */
const formatTime = (ts: string) => {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString();
  } catch {
    return ts;
  }
};

function useAutoScroll(dep: unknown[]) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, dep);
  return endRef;
}

// อ่าน JWT access token จาก localStorage (SimpleJWT มักเก็บ key "access")
function getWsToken(): string | null {
  const token = localStorage.getItem("access");
  return token && token !== "undefined" && token !== "null" ? token : null;
}

/* ---------- Main Component ---------- */
function ChatInner() {
  const [user, setUser] = useState<User | null>(null);

  // rooms (admin) + selected
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);

  // messages + composer
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  // image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState<"idle" | "open" | "closed" | "error">("idle");
  const [warn, setWarn] = useState<string | null>(null);

  // WS & reconnect
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intendedCloseRef = useRef(false);

  // anti-spam timestamps
  const sendTimestampsRef = useRef<number[]>([]);

  const isAdmin = useMemo(
    () => ["superadmin", "subadmin"].includes(user?.role || ""),
    [user]
  );

  const messagesEndRef = useAutoScroll([messages]);

  /* ---------- Initial load ---------- */
  useEffect(() => {
    (async () => {
      try {
        const me = await api.get("/api/accounts/me/");
        setUser(me.data);
        if (me.data.role === "customer") {
          const roomRes = await api.get("/api/chat/my-room/");
          const { room, messages } = roomRes.data;
          setSelectedRoom(room);
          setMessages(messages);
          connectWebSocket(room.id);
        } else if (["superadmin", "subadmin"].includes(me.data.role)) {
          const roomsRes = await api.get("/api/chat/rooms/");
          setRooms(roomsRes.data);
        }
      } catch (err) {
        console.error("Error loading initial data:", err);
        setWarn("ไม่สามารถโหลดข้อมูลเริ่มต้นได้");
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      intendedCloseRef.current = true;
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  /* ---------- WebSocket ---------- */
  const connectWebSocket = (roomId: number) => {
    if (wsRef.current) {
      intendedCloseRef.current = true;
      try { wsRef.current.close(); } catch {}
    }

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host.replace(":5173", ":8000");

    // แนบ JWT เป็น query string ให้ middleware JWT ของ Channels
    const token = getWsToken();
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    const wsUrl = `${proto}://${host}/ws/chat/${roomId}/${qs}`;
    // console.log("[Chat] WS URL:", wsUrl);

    intendedCloseRef.current = false;
    setWsStatus("idle");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("open");
      reconnectAttemptRef.current = 0;
      try { ws.send(JSON.stringify({ type: "ping" })); } catch {}
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data?.message) {
          setMessages((prev) => [...prev, data.message as ChatMessage]);
        }
      } catch (e) {
        console.warn("Invalid WS message:", e);
      }
    };

    ws.onerror = (e) => {
      console.error("WebSocket error:", e);
      setWsStatus("error");
    };

    ws.onclose = (event) => {
      setWsStatus("closed");
      if (event.code === 4001) {
        // unauthenticated/expired
        setWarn("เซสชันหมดอายุ โปรดล็อกอินใหม่");
        return;
      }
      // auto reconnect
      if (!intendedCloseRef.current) {
        const attempt = Math.min(reconnectAttemptRef.current + 1, 6);
        reconnectAttemptRef.current = attempt;
        const delay = Math.min(15000, 1000 * 2 ** (attempt - 1));
        if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(() => {
          if (selectedRoom) connectWebSocket(selectedRoom.id);
        }, delay) as unknown as number;
      }
    };
  };

  /* ---------- Admin: select room ---------- */
  const selectRoom = async (room: ChatRoom) => {
    try {
      setSelectedRoom(room);
      setMessages([]);
      const res = await api.get(`/api/chat/rooms/${room.id}/messages/`);
      setMessages(res.data);
      connectWebSocket(room.id);
    } catch (e) {
      console.error("Error loading room messages:", e);
      setWarn("โหลดข้อความห้องนี้ไม่สำเร็จ");
    }
  };

  /* ---------- Anti-spam ---------- */
  const canSendNow = () => {
    const now = Date.now();
    const windowMs = 10_000;
    const maxMsgs = 5;

    // เคลียร์ timestamp เก่า
    sendTimestampsRef.current = sendTimestampsRef.current.filter((t) => now - t < windowMs);

    if (sendTimestampsRef.current.length >= maxMsgs) {
      setWarn("ส่งข้อความถี่เกินไป โปรดรอสักครู่");
      return false;
    }
    const last = sendTimestampsRef.current[sendTimestampsRef.current.length - 1];
    if (last && now - last < 1500) {
      setWarn("อย่าส่งข้อความถี่เกินไป");
      return false;
    }
    setWarn(null);
    return true;
  };

  /* ---------- Image helpers ---------- */
  const pickFile = () => fileInputRef.current?.click();

  const onSelectFile = (file?: File | null) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setWarn("อัปโหลดได้เฉพาะ JPG/PNG/WEBP/GIF");
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setWarn(`ไฟล์ใหญ่เกินไป จำกัด ${MAX_IMAGE_MB}MB`);
      return;
    }
    setWarn(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ---------- Send ---------- */
  const sendMessage = async () => {
    if (!selectedRoom) return;

    const text = newMessage.trim();
    const hasText = !!text;
    const hasImage = !!imageFile;

    if (!hasText && !hasImage) return;
    if (!canSendNow()) return;

    setSending(true);
    try {
      if (hasImage) {
        // ส่งรูปผ่าน REST (multipart)
        const form = new FormData();
        if (hasText) form.append("message", text);
        form.append("image", imageFile as File);
        const res = await api.post(`/api/chat/rooms/${selectedRoom.id}/send/`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (res?.data) setMessages((prev) => [...prev, res.data]);
        setNewMessage("");
        clearImage();
        sendTimestampsRef.current.push(Date.now());
      } else {
        // ข้อความล้วน → ส่งทาง WS
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ message: text }));
          setNewMessage("");
          sendTimestampsRef.current.push(Date.now());
        } else {
          setWarn("ยังเชื่อมต่อไม่สำเร็จ กำลังพยายามเชื่อมต่อใหม่…");
        }
      }
    } catch (e) {
      console.error("Error sending message:", e);
      setWarn("ส่งข้อความ/รูปไม่สำเร็จ");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ---------- Layouts ---------- */
  if (loading) {
    return (
      <main className="h-screen bg-gray-1000 text-gray-200 flex items-center justify-center">
        <div className="animate-pulse text-sm opacity-80">Loading chat…</div>
      </main>
    );
  }

  // ลูกค้า
  if (user?.role === "customer" && selectedRoom) {
    return (
      <main className="h-screen flex flex-col bg-gray-1000 text-gray-100">
        <Header title="ติดต่อสอบถาม" subtitle="สอบถามกับทีมสนับสนุนของเรา" wsStatus={wsStatus} />
        <MessageList meId={user.id} messages={messages} endRef={messagesEndRef} variant="customer" />
        <Composer
          value={newMessage}
          onChange={setNewMessage}
          onKeyDown={handleKeyDown}
          onSend={sendMessage}
          disabled={sending || wsStatus !== "open"}
          warn={warn}
          pickFile={pickFile}
          imagePreview={imagePreview}
          clearImage={clearImage}
          fileInputRef={fileInputRef}
          onFilePicked={onSelectFile}
        />
      </main>
    );
  }

  // แอดมิน
  return (
    <main className="h-screen bg-gray-1000 text-gray-100 flex">
      <aside className="w-80 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-semibold">แชทของแอดมิน</h1>
          <p className="text-xs text-gray-400 mt-1">{rooms.length} ห้องแชท</p>
        </div>
        <div className="flex-1 overflow-auto">
          {rooms.map((room) => {
            const active = selectedRoom?.id === room.id;
            return (
              <button
                key={room.id}
                onClick={() => selectRoom(room)}
                className={`w-full text-left p-4 border-b border-gray-900 hover:bg-gray-900/60 transition ${
                  active ? "bg-gray-900" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-sm font-bold">
                    {room.customer_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{room.customer_name}</p>
                      <span className="ml-2 shrink-0 text-[10px] text-gray-400">
                        {formatTime(room.last_message?.timestamp || room.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {room.last_message?.message || "No messages yet"}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">{room.customer_email}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">{selectedRoom.customer_name}</h2>
                <p className="text-xs text-gray-400">{selectedRoom.customer_email}</p>
              </div>
              <WsBadge wsStatus={wsStatus} />
            </div>

            <MessageList meId={-1} messages={messages} endRef={messagesEndRef} variant="admin" />

            <Composer
              value={newMessage}
              onChange={setNewMessage}
              onKeyDown={handleKeyDown}
              onSend={sendMessage}
              disabled={sending || wsStatus !== "open"}
              warn={warn}
              pickFile={pickFile}
              imagePreview={imagePreview}
              clearImage={clearImage}
              fileInputRef={fileInputRef}
              onFilePicked={onSelectFile}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-lg">เลือกห้องแชท</p>
              <p className="text-sm">เลือกห้องแชทเพื่อเริ่มส่งข้อความ</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

/* ---------- Subcomponents ---------- */
function Header({
  title,
  subtitle,
  wsStatus,
}: {
  title: string;
  subtitle?: string;
  wsStatus: "idle" | "open" | "closed" | "error";
}) {
  return (
    <div className="p-4 border-b border-gray-800 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      <WsBadge wsStatus={wsStatus} />
    </div>
  );
}

function WsBadge({ wsStatus }: { wsStatus: "idle" | "open" | "closed" | "error" }) {
  const label =
    wsStatus === "open"
      ? "Connected"
      : wsStatus === "error"
      ? "Error"
      : wsStatus === "closed"
      ? "Disconnected"
      : "Connecting…";
  const dot =
    wsStatus === "open"
      ? "bg-emerald-500"
      : wsStatus === "error"
      ? "bg-rose-500"
      : "bg-amber-500";
  return (
    <div className="flex items-center gap-2 text-xs text-gray-300">
      <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
      {label}
    </div>
  );
}

function MessageList({
  meId,
  messages,
  endRef,
  variant,
}: {
  meId: number;
  messages: ChatMessage[];
  endRef: React.RefObject<HTMLDivElement>;
  variant: "customer" | "admin";
}) {
  return (
    <div className="flex-1 overflow-auto p-4 space-y-3 bg-gray-1000">
      {messages.map((m) => {
        const mine =
          variant === "customer" ? m.sender === meId : !m.is_admin;
        const align = mine ? "justify-end" : "justify-start";

        const bubble =
          variant === "customer"
            ? mine
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-100"
            : m.is_admin
            ? "bg-blue-600 text-white"
            : "bg-red-600 text-white";

        return (
          <div className={`flex ${align}`} key={m.id}>
            <div className={`max-w-[75%] lg:max-w-[60%] rounded-2xl px-4 py-2 ${bubble}`}>
              {m.image && (
                <a href={m.image} target="_blank" rel="noreferrer" className="block mb-2">
                  <img
                    src={m.image}
                    alt="uploaded"
                    className="rounded-xl max-h-64 object-contain w-full bg-black/20"
                    loading="lazy"
                  />
                </a>
              )}
              {m.message && <p className="whitespace-pre-wrap break-words">{m.message}</p>}
              <p className="text-[10px] opacity-75 mt-1">
                {m.sender_name} • {formatTime(m.timestamp)}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

function Composer({
  value,
  onChange,
  onKeyDown,
  onSend,
  disabled,
  warn,
  pickFile,
  imagePreview,
  clearImage,
  fileInputRef,
  onFilePicked,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  disabled?: boolean;
  warn: string | null;

  pickFile: () => void;
  imagePreview: string | null;
  clearImage: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFilePicked: (file?: File | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFilePicked(f);
  };

  return (
    <div
      className={`p-4 border-t border-gray-800 bg-gray-1000 ${dragOver ? "bg-gray-1000" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {warn && <div className="mb-2 text-[11px] text-amber-300/90">{warn}</div>}

      {imagePreview && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900 p-2">
          <div className="flex items-center gap-3">
            <img src={imagePreview} alt="preview" className="h-14 w-14 object-cover rounded-lg" />
            <span className="text-xs text-gray-300">จะส่งรูปนี้</span>
          </div>
          <button onClick={clearImage} className="text-xs px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700">
            ลบรูป
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={pickFile}
          className="px-3 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 text-sm"
        >
          <FaImage />
        </button>

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="พิมพ์ข้อความ… (ลากวางรูปได้)"
          className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 placeholder:text-gray-500"
        />

        <button
          onClick={onSend}
          disabled={disabled || (!value.trim() && !imagePreview)}
          className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IoIosSend />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => onFilePicked(e.target.files?.[0] || null)}
        />
      </div>

      <p className="mt-2 text-[10px] text-gray-500">
        รองรับ JPG/PNG/WEBP/GIF สูงสุด {MAX_IMAGE_MB}MB • ลากวางไฟล์ได้
      </p>
    </div>
  );
}
