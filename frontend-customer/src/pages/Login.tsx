import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "@/api/client";

type Question = { id: number; question: string };

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;

  // ---- login form ----
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      await login(username, password);
      nav(loc.state?.from || "/");
    } catch (e: any) {
      setErr("Invalid credentials");
    }
  }

  // ---- reset password modal ----
  const [showReset, setShowReset] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [rpUsername, setRpUsername] = useState("");
  const [rpQ, setRpQ] = useState<number | "">("");
  const [rpAnswer, setRpAnswer] = useState("");
  const [new1, setNew1] = useState("");
  const [new2, setNew2] = useState("");
  const [rpMsg, setRpMsg] = useState("");
  const [loadingQ, setLoadingQ] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // โหลดคำถาม (ใช้ endpoint เดิม /api/accounts/security-questions/)
  useEffect(() => {
    if (!showReset) return;
    (async () => {
      try {
        setLoadingQ(true);
        const { data } = await api.get("/api/accounts/security-questions/");
        setQuestions(data || []);
      } catch {
        setQuestions([]);
      } finally {
        setLoadingQ(false);
      }
    })();
  }, [showReset]);

  async function doReset() {
    setRpMsg("");
    if (!rpUsername || !rpQ || !rpAnswer || !new1 || !new2) {
      setRpMsg("กรอกข้อมูลให้ครบทุกช่อง");
      return;
    }
    if (new1 !== new2) {
      setRpMsg("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
      return;
    }
    try {
      setSubmitting(true);
      // เรียก /api/accounts/forgot-password/ ตามสเปค backend
      await api.post("/api/accounts/forgot-password/", {
        username: rpUsername,
        security_question: rpQ,
        answer: rpAnswer,
        new_password: new1,
      });
      setRpMsg("รีเซ็ตรหัสผ่านสำเร็จ! ลองเข้าสู่ระบบด้วยรหัสใหม่ได้เลย");
      // เคลียร์ฟอร์ม
      setNew1(""); setNew2(""); setRpAnswer("");
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setRpMsg(Array.isArray(d) ? d.join("\n") : (d || "รีเซ็ตรหัสผ่านไม่สำเร็จ"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10 space-y-4">
      <h1 className="text-xl font-bold mb-4">Login</h1>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2"
        />
        {err && <div className="text-red-400 text-sm">{err}</div>}
        <button className="w-full px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500">
          Login
        </button>
      </form>

      {/* ลิงก์สมัครสมาชิก */}
      <p className="text-center text-sm text-zinc-400">
        ยังไม่มีบัญชี?{" "}
        <Link to="/register" className="text-emerald-400 hover:underline">
          สมัครสมาชิก
        </Link>
      </p>

      {/* ปุ่มรีเซ็ตรหัสผ่าน */}
      <div className="text-center">
        <button
          className="text-sm text-emerald-400 hover:underline"
          onClick={() => {
            setShowReset(true);
            // ใส่ค่า username ปัจจุบันให้ฟอร์มรีเซ็ต เพื่อความสะดวก
            setRpUsername(username || "");
          }}
        >
          ลืมรหัสผ่าน / รีเซ็ตรหัสผ่าน
        </button>
      </div>

      {/* โมดัลรีเซ็ตรหัสผ่าน: คำถาม + คำตอบ + รหัสใหม่ 2 ช่อง */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
            <div className="text-lg font-semibold">รีเซ็ตรหัสผ่าน</div>

            <input
              value={rpUsername}
              onChange={(e) => setRpUsername(e.target.value)}
              placeholder="ชื่อผู้ใช้"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
            />

            <select
              value={rpQ}
              onChange={(e) => setRpQ(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
            >
              <option value="">{loadingQ ? "กำลังโหลดคำถาม..." : "เลือกคำถาม"}</option>
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.question}
                </option>
              ))}
            </select>

            <input
              value={rpAnswer}
              onChange={(e) => setRpAnswer(e.target.value)}
              placeholder="คำตอบของคุณ"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
            />

            <input
              type="password"
              value={new1}
              onChange={(e) => setNew1(e.target.value)}
              placeholder="รหัสผ่านใหม่"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
            />
            <input
              type="password"
              value={new2}
              onChange={(e) => setNew2(e.target.value)}
              placeholder="ยืนยันรหัสผ่านใหม่"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2"
            />
            {new1 && new2 && new1 !== new2 && (
              <div className="text-amber-400 text-sm">
                รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน
              </div>
            )}

            {rpMsg && (
              <div className="text-sm text-zinc-300 whitespace-pre-wrap">{rpMsg}</div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600"
                onClick={() => {
                  setShowReset(false);
                  setRpMsg("");
                }}
              >
                ปิด
              </button>
              <button
                disabled={
                  submitting || !rpUsername || !rpQ || !rpAnswer || !new1 || !new2 || new1 !== new2
                }
                onClick={doReset}
                className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
              >
                {submitting ? "กำลังรีเซ็ต..." : "ยืนยันรีเซ็ต"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
