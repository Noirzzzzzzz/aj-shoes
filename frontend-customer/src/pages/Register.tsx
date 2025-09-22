import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import api from "@/api/client";

type Question = { id: number; question: string };

export default function Register() {
  const { login } = useAuth(); // ← ใช้ login หลังสมัครสำเร็จ
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // security Q/A
  const [securityQuestion, setSecurityQuestion] = useState<number | "">("");
  const [securityAnswer, setSecurityAnswer] = useState("");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/accounts/security-questions/");
        setQuestions(res.data || []);
      } catch (e) {
        console.error("load questions failed", e);
      }
    })();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      // ✅ ยิงสมัครตรงไป backend เพื่อแนบ security_question/answer ได้
      await api.post("/api/accounts/register/", {
        username,
        email,
        password,
        security_question: securityQuestion || undefined,
        security_answer: securityAnswer || undefined,
      });

      // ✅ สมัครสำเร็จ → ล็อกอินอัตโนมัติ
      await login(username, password);
      nav("/");
    } catch (e: any) {
      // ลองอ่านรายละเอียด error จาก backend ถ้ามี
      const detail =
        e?.response?.data?.detail ||
        (Array.isArray(e?.response?.data) ? e.response.data.join(", ") : null) ||
        JSON.stringify(e?.response?.data || {});
      setErr(detail && detail !== "{}" ? detail : "Register failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10 space-y-4">
      <h1 className="text-xl font-bold mb-4">Register</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
        />

        {/* ✅ dropdown เลือกคำถาม */}
        <select
          value={securityQuestion}
          onChange={(e) => setSecurityQuestion(Number(e.target.value))}
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
        >
          <option value="">เลือกคำถามเพื่อความปลอดภัย</option>
          {questions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.question}
            </option>
          ))}
        </select>

        {/* ✅ input คำตอบ */}
        {securityQuestion && (
          <input
            value={securityAnswer}
            onChange={(e) => setSecurityAnswer(e.target.value)}
            placeholder="คำตอบของคุณ"
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
          />
        )}

        {err && <div className="text-red-400 text-sm whitespace-pre-wrap">{err}</div>}

        <button
          disabled={loading}
          className="w-full px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
        >
          {loading ? "Processing..." : "Register"}
        </button>
      </form>

      {/* ลิงก์กลับไปหน้า Login */}
      <p className="text-center text-sm text-zinc-400">
        มีบัญชีอยู่แล้ว?{" "}
        <Link to="/login" className="text-emerald-400 hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </main>
  );
}
