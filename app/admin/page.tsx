"use client";
// Admin (FR-127): duyệt tin unverified → active / ẩn (expired).
// Quyền cấp theo bảng `admins` (email) — RLS phía DB mới là hàng rào thật,
// trang này chỉ là UI. Thêm admin: insert email vào bảng admins.
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, type Listing } from "@/lib/supabase";
import { formatArea, formatPrice, sanitizeDescription } from "@/lib/format";

export default function Page() {
  const [role, setRole] = useState<"loading" | "anon" | "user" | "admin">("loading");
  const [pending, setPending] = useState<Listing[]>([]);
  const [counts, setCounts] = useState<{ tong: number; active: number; cho: number }>();

  const load = async () => {
    const { data } = await supabase
      .from("listings").select("*").eq("status", "unverified")
      .order("created_at", { ascending: false }).limit(50);
    setPending((data ?? []) as Listing[]);
    const [{ count: tong }, { count: active }, { count: cho }] = await Promise.all([
      supabase.from("listings").select("id", { count: "exact", head: true }),
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "unverified"),
    ]);
    setCounts({ tong: tong ?? 0, active: active ?? 0, cho: cho ?? 0 });
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return setRole("anon");
      const { data: a } = await supabase
        .from("admins").select("email").eq("email", user.email ?? "").maybeSingle();
      if (!a) return setRole("user");
      setRole("admin");
      load();
    });
  }, []);

  const setStatus = async (id: string, status: "active" | "expired") => {
    const { error } = await supabase.from("listings").update({ status }).eq("id", id);
    if (!error) setPending((p) => p.filter((l) => l.id !== id));
  };

  if (role === "loading") return <div className="mx-auto max-w-4xl px-4 py-16 text-mute">Đang kiểm tra quyền…</div>;
  if (role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Khu vực quản trị</h1>
        <p className="mt-2 text-mute">
          {role === "anon" ? "Cần đăng nhập bằng tài khoản quản trị." : "Tài khoản này không có quyền quản trị."}
        </p>
        {role === "anon" && (
          <Link href="/dang-nhap" className="mt-5 inline-block rounded-full bg-brand px-6 py-2.5 font-bold text-white">
            Đăng nhập
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-extrabold">Duyệt tin</h1>
      {counts && (
        <p className="mt-1 text-sm text-mute tabular-nums">
          {counts.tong} tin tổng · {counts.active} đang rao · {counts.cho} chờ duyệt
        </p>
      )}

      <div className="mt-6 space-y-4">
        {pending.map((l) => (
          <div key={l.id} className="rounded-king border border-line bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-bold">
                #{l.code} · {l.ward} · {formatPrice(l.price_vnd, l.price_raw)} · {formatArea(l.area_m2)}
              </p>
              <span className="text-xs text-mute">{new Date(l.created_at).toLocaleString("vi-VN")}</span>
            </div>
            <p className="mt-2 line-clamp-3 text-sm text-navy/80">
              {sanitizeDescription(l.description) || l.location_raw}
            </p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setStatus(l.id, "active")}
                className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-dark active:scale-[0.98]">
                Duyệt — cho rao
              </button>
              <button onClick={() => setStatus(l.id, "expired")}
                className="rounded-full border border-line px-5 py-2 text-sm font-semibold transition hover:border-brand hover:text-brand active:scale-[0.98]">
                Ẩn tin
              </button>
              <Link href={`/nha-dat/${encodeURIComponent(l.code ?? "")}`} target="_blank"
                className="ml-auto self-center text-sm font-semibold text-mute hover:text-brand">
                Xem trang tin →
              </Link>
            </div>
          </div>
        ))}
        {pending.length === 0 && (
          <div className="rounded-king border border-line bg-white p-10 text-center text-mute">
            Không còn tin chờ duyệt.
          </div>
        )}
      </div>
    </div>
  );
}
