import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import Protected from "@/components/Protected";
import { FaClock, FaSignOutAlt } from "react-icons/fa";

// เผื่อ type User เดิมยังไม่มี first_name/last_name ให้ประกาศแบบหลวม ๆ ในไฟล์นี้
type MeUser = {
  id: number;
  username: string;
  email: string;
  role?: string;
  phone?: string;
  default_address?: string;
  // ✅ เพิ่มฟิลด์ชื่อ–สกุล (อาจ undefined ถ้า backend ยังไม่ได้ส่งมา)
  first_name?: string;
  last_name?: string;
};

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

  const [form, setForm] = useState<{
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    default_address?: string;
  }>({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    default_address: "",
  });

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
  }, []);

  function onChange<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function onSave() {
    try {
      setSaving(true);
      // PUT พร้อม first_name/last_name (ถ้า backend ยังไม่รองรับจะถูกละทิ้ง แต่ไม่ error)
      const res = await api.put("/api/accounts/me/", form);
      setMe(res.data);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!me) return null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Profile</h1>

        <div className="flex items-center gap-2">
          {/* ปุ่มดูประวัติการสั่งซื้อ */}
          <Link
            to="/orders"
            className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center gap-2"
            aria-label="ดูประวัติการสั่งซื้อ"
          >
            <span>ประวัติการสั่งซื้อ</span>
            <FaClock className="text-sm" />
          </Link>

          {/* ปุ่ม Logout + ไอคอนอยู่หลังคำ */}
          <button
            onClick={logout}
            className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-500 flex items-center gap-2"
            aria-label="ออกจากระบบ"
          >
            <span>Logout</span>
            <FaSignOutAlt className="text-sm" />
          </button>
        </div>
      </div>

      {!editing ? (
        <div className="p-4 rounded border border-zinc-800 bg-zinc-900 space-y-1">
          <div><span className="text-zinc-400">ชื่อ:</span> {me.first_name || "-"}</div>
          <div><span className="text-zinc-400">นามสกุล:</span> {me.last_name || "-"}</div>
          <div><span className="text-zinc-400">Username:</span> {me.username}</div>
          <div><span className="text-zinc-400">Email:</span> {me.email}</div>
          {me.role && <div><span className="text-zinc-400">Role:</span> {me.role}</div>}
          <div><span className="text-zinc-400">Phone:</span> {me.phone || "-"}</div>
          <div className="whitespace-pre-wrap">
            <span className="text-zinc-400">Address:</span> {me.default_address || "-"}
          </div>

          <button
            onClick={() => setEditing(true)}
            className="mt-3 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
          >
            Edit
          </button>
        </div>
      ) : (
        <div className="p-4 rounded border border-zinc-800 bg-zinc-900 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <label className="space-y-1">
              <div className="text-sm text-zinc-400">ชื่อ</div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                value={form.first_name || ""}
                onChange={(e) => onChange("first_name", e.target.value)}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-zinc-400">นามสกุล</div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                value={form.last_name || ""}
                onChange={(e) => onChange("last_name", e.target.value)}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-zinc-400">Username</div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                value={form.username}
                onChange={(e) => onChange("username", e.target.value)}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-zinc-400">Email</div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                value={form.email}
                onChange={(e) => onChange("email", e.target.value)}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-zinc-400">Phone</div>
              <input
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                value={form.phone || ""}
                onChange={(e) => onChange("phone", e.target.value)}
              />
            </label>

            <label className="space-y-1">
              <div className="text-sm text-zinc-400">Address</div>
              <textarea
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                rows={4}
                value={form.default_address || ""}
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
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              disabled={saving}
              onClick={() => setEditing(false)}
              className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
