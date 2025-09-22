import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import Protected from "@/components/Protected";
import { FaClock, FaSignOutAlt, FaShieldAlt, FaKey, FaEdit } from "react-icons/fa";

type MeUser = {
  id: number;
  username: string;
  email: string;
  role?: string;
  phone?: string;
  default_address?: string;
  first_name?: string;
  last_name?: string;
  security_question?: number | null;
};

type Question = { id: number; question: string };

export default function Profile() {
  return (
    <Protected>
      <ProfileInner />
    </Protected>
  );
}

function ProfileInner() {
  const { logout } = useAuth();

  const [me, setMe] = useState<MeUser | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ฟอร์มโปรไฟล์
  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    default_address: "",
  });

  // Security Question/Answer
  const [questions, setQuestions] = useState<Question[]>([]);
  const [secQ, setSecQ] = useState<number | "">("");
  const [secA, setSecA] = useState("");
  const [savingQA, setSavingQA] = useState(false);

  // Change password modal
  const [showPwd, setShowPwd] = useState(false);
  const [answer, setAnswer] = useState("");
  const [new1, setNew1] = useState("");
  const [new2, setNew2] = useState("");
  const [changing, setChanging] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [oldPwd, setOldPwd] = useState("");

  useEffect(() => {
    (async () => {
      const res = await api.get("/api/accounts/me/");
      const data: MeUser = res.data || {};
      setMe(data);
      setForm({
        username: data.username || "",
        email: data.email || "",
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        phone: data.phone || "",
        default_address: data.default_address || "",
      });
    })();
    (async () => {
      try {
        const res = await api.get("/api/accounts/security-questions/");
        setQuestions(res.data || []);
      } catch (e) {
        console.error("load questions failed", e);
      }
    })();
  }, []);

  function onChange<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function onSave() {
    try {
      setSaving(true);
      const res = await api.put("/api/accounts/me/", form);
      setMe(res.data);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function onSaveQA() {
    try {
      setSavingQA(true);
      await api.post("/api/accounts/set-security-answer/", {
        security_question: secQ,
        security_answer: secA,
      });
      setSecA("");
      alert("อัปเดตคำถาม/คำตอบสำเร็จ");
    } finally {
      setSavingQA(false);
    }
  }

  // ข้อความของคำถามที่ผู้ใช้ตั้งไว้ (จาก me.security_question)
  const myQuestionText = useMemo(() => {
    if (!me?.security_question) return "";
    return questions.find((q) => q.id === me.security_question)?.question || "";
  }, [me?.security_question, questions]);

  async function onChangePassword() {
    setPwdMsg("");
    if (new1 !== new2) {
      setPwdMsg("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
      return;
    }
    try {
      setChanging(true);
      const payload = {
        security_question: me?.security_question,
        answer,
        new_password1: new1,
        new_password2: new2,
        old_password: oldPwd,
      };
      const res = await api.post("/api/accounts/change-password/", payload);
      setPwdMsg(res.data?.detail || "เปลี่ยนรหัสผ่านสำเร็จ");
      setAnswer("");
      setNew1("");
      setNew2("");
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setPwdMsg(Array.isArray(d) ? d.join("\n") : d || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setChanging(false);
    }
  }

  if (!me) return null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">โปรไฟล์</h1>

        <div className="flex items-center gap-2">
          <Link
            to="/orders"
            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center gap-2"
            aria-label="ดูประวัติคำสั่งซื้อ"
          >
            <span>ประวัติคำสั่งซื้อ</span>
            <FaClock className="text-sm" />
          </Link>

          <button
            onClick={logout}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 flex items-center gap-2"
            aria-label="ออกจากระบบ"
          >
            <span>ออกจากระบบ</span>
            <FaSignOutAlt className="text-sm" />
          </button>
        </div>
      </div>

      {/* Profile */}
      {!editing ? (
        <div className="p-4 rounded border border-zinc-800 bg-zinc-900 space-y-1">
          {me.role && <div>{me.role}</div>}
          <div><span className="text-zinc-400">ชื่อ:</span> {me.first_name || "-"}</div>
          <div><span className="text-zinc-400">นามสกุล:</span> {me.last_name || "-"}</div>
          <div><span className="text-zinc-400">ชื่อผู้ใช้:</span> {me.username}</div>
          <div><span className="text-zinc-400">อีเมล:</span> {me.email}</div>
          <div><span className="text-zinc-400">เบอร์โทร:</span> {me.phone || "-"}</div>
          <div className="whitespace-pre-wrap">
            <span className="text-zinc-400">ที่อยู่:</span> {me.default_address || "-"}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center gap-2"
            >
            ตั้งค่าโปรไฟล์ <FaEdit />
            </button>

            {/* ปุ่มเปลี่ยนรหัสผ่าน */}
            <button
              onClick={() => setShowPwd(true)}
              className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 flex items-center gap-2"
            >
              เปลี่ยนรหัสผ่าน <FaKey />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded border border-zinc-800 bg-zinc-900 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="space-y-1">
              <div className="text-sm text-zinc-400">ชื่อ</div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                value={form.first_name}
                onChange={(e) => onChange("first_name", e.target.value)}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-zinc-400">นามสกุล</div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                value={form.last_name}
                onChange={(e) => onChange("last_name", e.target.value)}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-zinc-400">ชื่อผู้ใช้</div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                value={form.username}
                onChange={(e) => onChange("username", e.target.value)}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-zinc-400">อีเมล</div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                value={form.email}
                onChange={(e) => onChange("email", e.target.value)}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-zinc-400">เบอร์โทร</div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                value={form.phone}
                onChange={(e) => onChange("phone", e.target.value)}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-zinc-400">ที่อยู่</div>
              <textarea
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                rows={4}
                value={form.default_address}
                onChange={(e) => onChange("default_address", e.target.value)}
              />
            </label>
          </div>

          <div className="flex gap-2">
            <button
              disabled={saving}
              onClick={onSave}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60"
            >
              {saving ? "กำลังบันทึกข้อมูล..." : "บันทึกข้อมูล"}
            </button>
            <button
              disabled={saving}
              onClick={() => setEditing(false)}
              className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-60"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {/* ตั้ง Security Question/Answer */}
      <div className="p-4 rounded border border-zinc-800 bg-zinc-900 space-y-3">
        <div className="flex items-center gap-2 font-bold">
          <FaShieldAlt /> ตั้งคำถามเพื่อความปลอดภัย
        </div>
        <select
          value={secQ}
          onChange={(e) => setSecQ(Number(e.target.value))}
          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1"
        >
          <option value="">เลือกคำถาม</option>
          {questions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.question}
            </option>
          ))}
        </select>
        {secQ && (
          <input
            value={secA}
            onChange={(e) => setSecA(e.target.value)}
            placeholder="คำตอบของคุณ"
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1"
          />
        )}
        <button
          disabled={!secQ || !secA || savingQA}
          onClick={onSaveQA}
          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
        >
          {savingQA ? "กำลังบันทึก..." : "บันทึกคำถาม/คำตอบ"}
        </button>
      </div>

      {/* โมดัลเปลี่ยนรหัสผ่าน (ต้องตอบคำถามให้ถูก + รหัสใหม่ 2 ช่อง) */}
      {showPwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              เปลี่ยนรหัสผ่าน <FaKey /> 
            </div>

            <div className="text-sm text-zinc-300">
              คำถามเพื่อความปลอดภัย:{" "}
              <span className="font-medium">
                {myQuestionText || "— ยังไม่ได้ตั้งคำถาม —"}
              </span>
            </div>

            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="กรอกคำตอบ"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-2"
            />
            {/* ➕ ช่องรหัสผ่านเดิม (ขอให้แสดงใต้คำถาม) */}
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              placeholder="รหัสผ่านเดิม"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-2"
            />
            <input
              type="password"
              value={new1}
              onChange={(e) => setNew1(e.target.value)}
              placeholder="รหัสผ่านใหม่"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-2"
            />
            <input
              type="password"
              value={new2}
              onChange={(e) => setNew2(e.target.value)}
              placeholder="ยืนยันรหัสผ่านใหม่"
              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-2"
            />
            {new1 && new2 && new1 !== new2 && (
              <div className="text-sm text-amber-400">รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน</div>
            )}

            {pwdMsg && (
              <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                {pwdMsg}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowPwd(false)}
                className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600"
              >
                ปิด
              </button>
              <button
                disabled={
                  changing ||
                  !answer ||
                  !new1 ||
                  !new2 ||
                  new1 !== new2 ||
                  !me?.security_question
                }
                onClick={onChangePassword}
                className="px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
              >
                {changing ? "กำลังเปลี่ยน..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
