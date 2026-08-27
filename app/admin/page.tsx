"use client";
// Admin (FR-127): duyệt tin cho_thong_tin → dang_ban / ẩn (an) theo vòng đời
// FR-139 (cho_thong_tin → dang_ban → dang_quan_tam → da_chot). Quyền cấp theo
// bảng `admins` (email) — RLS phía DB mới là hàng rào thật, trang này chỉ là UI.
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, type Listing } from "@/lib/supabase";
import { formatArea, formatPrice, sanitizeDescription } from "@/lib/format";

export default function Page() {
  const [role, setRole] = useState<"loading" | "anon" | "user" | "admin">("loading");
  const [pending, setPending] = useState<Listing[]>([]);
  const [counts, setCounts] = useState<{ tong: number; active: number; cho: number }>();
  // FR-152: sức khoẻ bot. Đọc THẲNG từ DB bằng phiên admin — cố tình KHÔNG đi
  // qua bridge, vì còi báo "bridge chết" mà lại gửi bằng bridge thì vô nghĩa.
  const [health, setHealth] = useState<{
    beat: string | null;
    errs: { id: number; at: string; source: string; status_code: number | null; detail: string | null }[];
  }>();

  const load = async () => {
    const { data } = await supabase
      .from("listings").select("*").eq("status", "cho_thong_tin")
      .order("created_at", { ascending: false }).limit(50);
    setPending((data ?? []) as Listing[]);
    const [{ count: tong }, { count: active }, { count: cho }] = await Promise.all([
      supabase.from("listings").select("id", { count: "exact", head: true }),
      supabase.from("listings").select("id", { count: "exact", head: true }).in("status", ["dang_ban", "dang_quan_tam"]),
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("status", "cho_thong_tin"),
    ]);
    setCounts({ tong: tong ?? 0, active: active ?? 0, cho: cho ?? 0 });

    const [beatRes, errRes] = await Promise.all([
      supabase.from("bot_health").select("at").eq("who", "bridge-zca").maybeSingle(),
      supabase.from("bot_errors").select("id, at, source, status_code, detail")
        .order("at", { ascending: false }).limit(10),
    ]);
    setHealth({ beat: (beatRes.data?.at as string) ?? null, errs: errRes.data ?? [] });
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

  const setStatus = async (id: string, status: "dang_ban" | "an") => {
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
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Duyệt tin</h1>
        <Link
          href="/admin/dang-tin"
          className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-dark active:scale-[0.98]"
        >
          + Đăng tin thủ công
        </Link>
      </div>
      {counts && (
        <p className="mt-1 text-sm text-mute tabular-nums">
          {counts.tong} tin tổng · {counts.active} đang rao · {counts.cho} chờ duyệt
        </p>
      )}

      {/* FR-152 — sức khoẻ bot */}
      {health && (
        <div className="mt-6 rounded-king border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="eyebrow text-mute">Sức khoẻ bot</span>
            <BridgeBadge at={health.beat} />
            <span className="text-sm text-mute">
              {health.errs.length ? `${health.errs.length} lỗi gần nhất` : "Không có lỗi nào được ghi"}
            </span>
          </div>
          {health.errs.length > 0 && (
            <ul className="mt-3 divide-y divide-line text-sm">
              {health.errs.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-3 py-2">
                  <span className="w-32 shrink-0 tabular-nums text-mute">
                    {new Date(e.at).toLocaleString("vi-VN")}
                  </span>
                  <span className="font-semibold">
                    {e.source}
                    {e.status_code ? ` · ${e.status_code}` : ""}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-navy/75">{e.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
              <button onClick={() => setStatus(l.id, "dang_ban")}
                className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-dark active:scale-[0.98]">
                Duyệt — cho rao
              </button>
              <button onClick={() => setStatus(l.id, "an")}
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

// Nhịp tim bridge. Ba trạng thái, không phải hai: "chưa từng chạy" khác hẳn
// "đã chết" — báo nhầm cái đầu thành cái sau là còi giả ngay ngày đầu.
function BridgeBadge({ at }: { at: string | null }) {
  if (!at) {
    return (
      <span className="rounded-full bg-line px-3 py-1 text-xs font-bold text-mute">
        bridge: chưa từng gõ cửa
      </span>
    );
  }
  const phut = Math.round((Date.now() - new Date(at).getTime()) / 60000);
  const song = phut <= 15;
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        song ? "bg-brand/10 text-brand" : "bg-navy text-white"
      }`}
    >
      bridge: {song ? "đang sống" : `im ${phut} phút`}
    </span>
  );
}
