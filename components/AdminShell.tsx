"use client";
// AdminShell — khung CRM cho mọi trang /admin/* (chủ dự án 09/09/2026: "lấy
// giao diện của ZaloCRM cho dễ nhìn"). Lấy BỐ CỤC của họ, không lấy mã (AGPL):
// thanh trên xanh navy, tab theo phân hệ, ô tìm, chuông việc, avatar. Trang
// công khai (Header/Footer nhadat.cc) tự ẩn dưới /admin.
//
// Tab = ROUTE, không phải state trong một trang: mỗi phân hệ một URL để chia
// sẻ link, mở tab mới, quay lại đúng chỗ. Bàn làm việc giữ ?tab= cho bốn khối
// cũ (todo/crm/stats/ops) — giữ nguyên dữ liệu đã có, chỉ đổi vỏ.
import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Tab = { href: string; label: string; icon: string; khop: (p: string, tab: string | null) => boolean; title?: string };

const TABS: Tab[] = [
  { href: "/admin", label: "Bàn làm việc", icon: "▦", khop: (p, t) => p === "/admin" && (!t || t === "todo") },
  { href: "/admin?tab=crm", label: "Khách hàng", icon: "👥", khop: (p, t) => p === "/admin" && t === "crm" },
  { href: "/admin/tin-nhan", label: "Tin nhắn", icon: "💬", khop: (p) => p.startsWith("/admin/tin-nhan") },
  { href: "/admin/ro-hang", label: "Rổ hàng", icon: "📋", khop: (p) => p.startsWith("/admin/ro-hang") || p.startsWith("/admin/dang-tin") },
  { href: "/admin/mau-cau", label: "Mẫu câu", icon: "✏️", khop: (p) => p.startsWith("/admin/mau-cau"), title: "FR-180: câu chuẩn để huấn luyện giọng bot" },
  { href: "/admin?tab=stats", label: "Báo cáo", icon: "📊", khop: (p, t) => p === "/admin" && t === "stats" },
  { href: "/admin?tab=ops", label: "Vận hành", icon: "⚙️", khop: (p, t) => p === "/admin" && t === "ops" },
];

function ThanhTren() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const tab = sp.get("tab");
  const [email, setEmail] = useState<string | null>(null);
  const [chuong, setChuong] = useState<{ viec: number; loi: number } | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let song = true;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!song || !user) return;
      setEmail(user.email ?? null);
      // Chuông: việc chờ (escalation/report) + lỗi bot 24h. RLS admin lọc; người
      // thường nhận 0 dòng, không lỗi.
      const d1 = new Date(Date.now() - 86400e3).toISOString();
      const [v, l] = await Promise.all([
        supabase.from("reminders").select("id", { count: "exact", head: true })
          .eq("status", "pending").in("kind", ["escalation", "report"]),
        supabase.from("bot_errors").select("id", { count: "exact", head: true }).gte("at", d1),
      ]);
      if (song) setChuong({ viec: v.count ?? 0, loi: l.count ?? 0 });
    });
    return () => { song = false; };
  }, [pathname]);

  const tim = (e: FormEvent) => {
    e.preventDefault();
    const k = q.trim();
    if (k) router.push(`/admin/ro-hang?q=${encodeURIComponent(k)}`);
  };
  const dangXuat = () => supabase.auth.signOut().then(() => location.assign("/"));
  const tongChuong = (chuong?.viec ?? 0) + (chuong?.loi ?? 0);

  return (
    <header className="sticky top-0 z-40 bg-navy text-white shadow-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3">
        <Link href="/admin" className="mr-2 flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/10">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-sm font-extrabold">AI</span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-extrabold">AI Ơi Nhà Đất</span>
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-white/60">CRM · nhadat.cc</span>
          </span>
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const on = t.khop(pathname, tab);
            return (
              <Link
                key={t.href}
                href={t.href}
                title={t.title}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  on ? "bg-white text-navy shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="text-base leading-none">{t.icon}</span>
                <span>{t.label}</span>
              </Link>
            );
          })}
        </nav>
        <form onSubmit={tim} className="hidden md:block">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="🔍 Tìm mã tin, đường, người bán…"
            className="w-56 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/50 outline-none focus:bg-white/20 lg:w-72"
          />
        </form>
        <Link
          href="/admin/dang-tin"
          className="hidden shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white hover:bg-brand-dark sm:block"
        >
          ＋ Đăng tin
        </Link>
        <Link
          href="/admin?tab=todo"
          title={chuong ? `${chuong.viec} việc chờ · ${chuong.loi} lỗi bot 24h` : "việc chờ"}
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-white/10"
        >
          <span className="text-lg">🔔</span>
          {tongChuong > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-extrabold leading-[18px]">
              {tongChuong > 99 ? "99+" : tongChuong}
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={dangXuat}
          title={email ? `${email} · bấm để đăng xuất` : "đăng xuất"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-extrabold uppercase text-white hover:opacity-90"
        >
          {(email ?? "?").slice(0, 1)}
        </button>
      </div>
    </header>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream/60">
      <Suspense fallback={<div className="h-14 bg-navy" />}>
        <ThanhTren />
      </Suspense>
      {children}
    </div>
  );
}
