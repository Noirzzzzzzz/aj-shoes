import { useEffect, useRef, useState } from "react";
import Protected from "@/components/Protected";
import api from "@/api/client";

type Thread = { id:number };
type Msg = { id:number; sender:number; text:string; qr_code_url:string };

export default function Chat() {
  return (
    <Protected><ChatInner /></Protected>
  );
}

function ChatInner() {
  const [thread, setThread] = useState<Thread | null>(null);
  const [log, setLog] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(()=>{
    (async()=>{
      // ensure a thread exists
      const { data } = await api.post("/api/chat/threads/", {});
      setThread(data);
      // connect ws
      const token = localStorage.getItem("access");
      const ws = new WebSocket(`${(location.protocol==="https:")?"wss":"ws"}://${location.host.replace(":5173", ":8000")}/ws/chat/${data.id}/?token=${token}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        setLog(prev => [...prev, d]);
      };
      ws.onclose = () => { wsRef.current = null; };
    })();
    return ()=>{ wsRef.current?.close(); };
  }, []);

  function send() {
    if (!text) return;
    wsRef.current?.send(JSON.stringify({ text }));
    setText("");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-3">
      <h1 className="text-xl font-bold">Chat</h1>
      <div className="h-80 border border-zinc-800 rounded bg-zinc-900 p-3 overflow-auto">
        {log.map((m,i) => (
          <div key={i} className="py-1 text-sm">
            {m.qr_code_url ? (
              <a className="text-sky-400 underline" href={m.qr_code_url} target="_blank">QR</a>
            ) : m.text}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={text} onChange={e=>setText(e.target.value)} className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-2" placeholder="Type message..." />
        <button onClick={send} className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700">Send</button>
      </div>
    </main>
  );
}
