import { useEffect, useRef, useState } from "react";
import api from "@/api";

type Thread = { id:number; customer:number; created_at:string };
type Msg = { id:number; sender:number; text:string; qr_code_url:string };

export default function Chat(){
  const [threads,setThreads] = useState<Thread[]>([]);
  const [sel,setSel] = useState<Thread|null>(null);
  const [log,setLog] = useState<Msg[]>([]);
  const [text,setText] = useState("");
  const [qr,setQr] = useState("");
  const wsRef = useRef<WebSocket|null>(null);

  async function loadThreads(){
    const { data } = await api.get("/api/chat/threads/");
    setThreads(data.results || data);
  }
  useEffect(()=>{ loadThreads(); }, []);

  useEffect(()=>{
    wsRef.current?.close();
    if (!sel) return;
    const token = localStorage.getItem("access");
    const ws = new WebSocket(`${(location.protocol==="https:")?"wss":"ws"}://${location.host.replace(":5174", ":8000")}/ws/chat/${sel.id}/?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (e)=>{ setLog(prev => [...prev, JSON.parse(e.data)]); };
    return ()=>{ ws.close(); };
  }, [sel?.id]);

  function send(){
    if (!text && !qr) return;
    wsRef.current?.send(JSON.stringify({ text, qr_code_url: qr }));
    setText(""); setQr("");
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 grid md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <h1 className="text-xl font-bold">Chat</h1>
        <div className="border border-zinc-800 rounded bg-zinc-900 max-h-[70vh] overflow-auto">
          {threads.map(t => (
            <button key={t.id} onClick={()=>setSel(t)} className={`w-full text-left px-3 py-2 border-b border-zinc-800 hover:bg-zinc-800 ${sel?.id===t.id?"bg-zinc-800":""}`}>
              Thread #{t.id}
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-2 space-y-2">
        <div className="h-[60vh] border border-zinc-800 rounded bg-zinc-900 p-3 overflow-auto">
          {sel ? log.map((m,i)=>(
            <div key={i} className="py-1 text-sm">
              {m.qr_code_url ? <a className="text-sky-400 underline" href={m.qr_code_url} target="_blank">QR</a> : m.text}
            </div>
          )) : <div className="text-zinc-400">Select a thread…</div>}
        </div>
        <div className="flex gap-2">
          <input value={text} onChange={e=>setText(e.target.value)} placeholder="Message…" className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-2" />
          <input value={qr} onChange={e=>setQr(e.target.value)} placeholder="QR URL (optional)" className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-2" />
          <button onClick={send} className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700">Send</button>
        </div>
      </div>
    </main>
  );
}
