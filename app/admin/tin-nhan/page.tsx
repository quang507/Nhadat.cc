"use client";
// /admin/tin-nhan — màn chat 3 cột của khung CRM (09/09/2026, bố cục theo
// ZaloCRM): trái = bộ lọc, giữa = hội thoại, phải = tin nhắn. Mỗi câu bot có
// "Sửa thành câu chuẩn" (FR-180) — sửa ngay tại chỗ đang đọc, mẫu vào `mau_cau`.
// Đọc `conversations`/`messages` qua RLS admin; không gọi RPC nào của bot.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type HoiThoai = {
  id: string; channel: string | null; seller_id: string | null; buyer_id: string | null;
  last_message_at: string | null; needs_human: boolean | null; human_touch_at: string | null;
  sellers: { name: string | null; zalo_user_id: string | null } | null;
  buyers: { name: string | null; zalo_user_id: string | null } | null;
};
type Tin = { id: string; sender: string; body: string; seq: number; created_at: string };
type Mau = { id: string; message_id: string | null; conversation_id: string | null; cau_chuan: string; dung_lam: string };

const AI_VI: Record<string, string> = {
  bot: "Thái", buyer: "Khách", seller: "Chủ nhà", human: "Người thật", ctv: "CTV", system: "Hệ thống",
};
const luc = (s: string | null) => s ? new Date(s).toLocaleString("vi-VN", { hour12: false }) : "";
const gioNgan = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s); const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

export default function Page() {
  const [role, setRole] = useState<"loading" | "anon" | "user" | "admin">("loading");
  const [email, setEmail] = useState("");
  const [hoiThoai, setHoiThoai] = useState<HoiThoai[]>([]);
  const [mau, setMau] = useState<Mau[]>([]);
  const [chon, setChon] = useState<HoiThoai | null>(null);
  const [tin, setTin] = useState<Tin[]>([]);
  const [loi, setLoi] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [locPhia, setLocPhia] = useState<"" | "ban" | "mua">("");
  const [chiCanNguoi, setChiCanNguoi] = useState(false);
  const [chiChuaMau, setChiChuaMau] = useState(false);
  const [dangSua, setDangSua] = useState<string | null>(null);
  const [nhap, setNhap] = useState("");
  const [dangLuu, setDangLuu] = useState(false);

  const napMau = async () => {
    const { data } = await supabase.from("mau_cau").select("id, message_id, conversation_id, cau_chuan, dung_lam").limit(3000);
    setMau((data ?? []) as Mau[]);
  };
  const napHoiThoai = async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, channel, seller_id, buyer_id, last_message_at, needs_human, human_touch_at, sellers!conversations_seller_id_fkey(name, zalo_user_id), buyers!conversations_buyer_id_fkey(name, zalo_user_id)")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) setLoi(error.message);
    setHoiThoai((data ?? []) as unknown as HoiThoai[]);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return setRole("anon");
      const { data: a } = await supabase.from("admins").select("email").eq("email", user.email ?? "").maybeSingle();
      if (!a) return setRole("user");
      setRole("admin"); setEmail(user.email ?? "");
      await Promise.all([napHoiThoai(), napMau()]);
      try {
        const id = new URLSearchParams(location.search).get("hoi_thoai");
        if (id) {
          const { data } = await supabase.from("conversations")
            .select("id, channel, seller_id, buyer_id, last_message_at, needs_human, human_touch_at, sellers!conversations_seller_id_fkey(name, zalo_user_id), buyers!conversations_buyer_id_fkey(name, zalo_user_id)")
            .eq("id", id).maybeSingle();
          if (data) moHoiThoai(data as unknown as HoiThoai);
        }
      } catch { /* không có URL */ }
    });
  }, []);

  const moHoiThoai = async (h: HoiThoai) => {
    setChon(h); setDangSua(null);
    const { data, error } = await supabase.from("messages")
      .select("id, sender, body, seq, created_at").eq("conversation_id", h.id).order("seq").limit(500);
    if (error) setLoi(error.message);
    setTin((data ?? []) as Tin[]);
  };

  const ten = (h: HoiThoai) => h.sellers?.name ?? h.buyers?.name ?? (h.seller_id ? "Chủ nhà" : "Khách");
  const soMau = (id: string) => mau.filter((m) => m.conversation_id === id && m.dung_lam !== "bo").length;
  const mauCua = (messageId: string) => mau.find((m) => m.message_id === messageId);

  const danhSach = useMemo(() => {
    const k = q.trim().toLowerCase();
    return hoiThoai.filter((h) =>
      (!locPhia || (locPhia === "ban" ? !!h.seller_id : !h.seller_id)) &&
      (!chiCanNguoi || !!h.needs_human) &&
      (!chiChuaMau || soMau(h.id) === 0) &&
      (!k || ten(h).toLowerCase().includes(k) || (h.sellers?.zalo_user_id ?? h.buyers?.zalo_user_id ?? "").includes(k)),
    );
  }, [hoiThoai, q, locPhia, chiCanNguoi, chiChuaMau, mau]);

  const luu = async (t: Tin) => {
    if (!chon || !nhap.trim()) return;
    setDangLuu(true);
    const { data: nguCanh } = await supabase.rpc("ngu_canh_tin", { p_message_id: t.id });
    const { error } = await supabase.from("mau_cau").upsert({
      message_id: t.id, conversation_id: chon.id, phia: chon.seller_id ? "ban" : "mua",
      ngu_canh: nguCanh ?? [], cau_bot: t.body, cau_chuan: nhap.trim(), dung_lam: "ca_hai", nguoi_sua: email,
    }, { onConflict: "message_id" });
    setDangLuu(false);
    if (error) { setLoi(error.message); return; }
    setDangSua(null); await napMau();
  };

  const dem = {
    tong: hoiThoai.length,
    ban: hoiThoai.filter((h) => !!h.seller_id).length,
    canNguoi: hoiThoai.filter((h) => !!h.needs_human).length,
    chuaMau: hoiThoai.filter((h) => soMau(h.id) === 0).length,
  };

  if (role === "loading") return <div className="mx-auto max-w-4xl px-4 py-16 text-mute font-medium">Đang kiểm tra quyền…</div>;
  if (role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-navy">Khu vực quản trị</h1>
        <p className="mt-2 text-mute text-sm">{role === "anon" ? "Cần đăng nhập bằng tài khoản quản trị." : "Tài khoản này không có quyền quản trị."}</p>
        {role === "anon" && <Link href="/dang-nhap" className="mt-5 inline-block rounded-full bg-brand px-6 py-2.5 font-bold text-white shadow-sm hover:bg-brand-dark transition">Đăng nhập</Link>}
      </div>
    );
  }

  const chip = (on: boolean) => `rounded-lg px-3 py-1.5 text-left text-sm font-semibold transition ${on ? "bg-navy text-white" : "bg-white text-navy hover:bg-slate-100"}`;

  return (
    <div className="mx-auto grid h-[calc(100vh-56px)] max-w-[1600px] grid-cols-[220px_340px_1fr] gap-0 border-x border-line bg-white">
      {/* Cột 1: bộ lọc */}
      <aside className="flex flex-col gap-1 overflow-y-auto border-r border-line bg-cream/40 p-3">
        <div className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-mute">Phạm vi</div>
        <button type="button" className={chip(!locPhia && !chiCanNguoi && !chiChuaMau)} onClick={() => { setLocPhia(""); setChiCanNguoi(false); setChiChuaMau(false); }}>Tất cả <span className="float-right text-xs opacity-70">{dem.tong}</span></button>
        <button type="button" className={chip(locPhia === "ban")} onClick={() => setLocPhia(locPhia === "ban" ? "" : "ban")}>Người bán <span className="float-right text-xs opacity-70">{dem.ban}</span></button>
        <button type="button" className={chip(locPhia === "mua")} onClick={() => setLocPhia(locPhia === "mua" ? "" : "mua")}>Người mua <span className="float-right text-xs opacity-70">{dem.tong - dem.ban}</span></button>
        <div className="mb-1 mt-3 px-1 text-[11px] font-bold uppercase tracking-wider text-mute">Cần làm</div>
        <button type="button" className={chip(chiCanNguoi)} onClick={() => setChiCanNguoi(!chiCanNguoi)}>🔥 Cần người thật <span className="float-right text-xs opacity-70">{dem.canNguoi}</span></button>
        <button type="button" className={chip(chiChuaMau)} onClick={() => setChiChuaMau(!chiChuaMau)}>✏️ Chưa có mẫu chuẩn <span className="float-right text-xs opacity-70">{dem.chuaMau}</span></button>
        <div className="mt-auto rounded-xl border border-line bg-white p-3 text-xs text-mute">
          Mẫu chuẩn: <b className="text-navy">{mau.filter((m) => m.dung_lam !== "bo").length}/300</b>
          <Link href="/admin/mau-cau" className="ml-1 font-semibold text-brand hover:underline">kho mẫu →</Link>
        </div>
      </aside>

      {/* Cột 2: hội thoại */}
      <section className="flex flex-col overflow-hidden border-r border-line">
        <div className="border-b border-line p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Tìm theo tên, Zalo ID…" className="w-full rounded-lg border border-line bg-cream/60 px-3 py-2 text-sm outline-none focus:border-brand" />
          <div className="mt-2 text-xs text-mute tabular-nums">{danhSach.length} hội thoại · mới nhất lên trên</div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {danhSach.map((h) => {
            const n = soMau(h.id);
            return (
              <li key={h.id}>
                <button type="button" onClick={() => moHoiThoai(h)} className={`flex w-full flex-col gap-1 border-b border-line/70 px-3 py-2.5 text-left hover:bg-cream/60 ${chon?.id === h.id ? "bg-brand/5" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white ${h.seller_id ? "bg-amber-500" : "bg-zalo"}`}>{ten(h).slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-navy">{ten(h)}</span>
                    <span className="text-[11px] text-mute tabular-nums">{gioNgan(h.last_message_at)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pl-10">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${h.seller_id ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>{h.seller_id ? "bán" : "mua"}</span>
                    {h.needs_human && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">🔥 cần người thật</span>}
                    {h.human_touch_at && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-mute">người thật đã vào</span>}
                    {n > 0 && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">{n} mẫu</span>}
                  </div>
                </button>
              </li>
            );
          })}
          {danhSach.length === 0 && <li className="px-4 py-10 text-center text-sm text-mute">Không có hội thoại khớp bộ lọc.</li>}
        </ul>
      </section>

      {/* Cột 3: tin nhắn */}
      <section className="flex flex-col overflow-hidden bg-cream/30">
        {!chon ? (
          <div className="grid flex-1 place-items-center text-center text-sm text-mute"><div><div className="text-5xl">💬</div><div className="mt-2">Chọn cuộc trò chuyện</div></div></div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-line bg-white px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-navy">{ten(chon)}</span>
                <span className="text-xs text-mute">· {chon.seller_id ? "người bán" : "người mua"} · {chon.channel}</span>
                {chon.needs_human && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">🔥 cần người thật</span>}
              </div>
              <span className="text-xs text-mute tabular-nums">{tin.length} lượt</span>
            </div>
            <ol className="flex-1 space-y-2 overflow-y-auto p-4">
              {tin.map((t) => {
                const bot = t.sender === "bot";
                const co = mauCua(t.id);
                const sua = dangSua === t.id;
                return (
                  <li key={t.id} className={`flex ${bot ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 shadow-2xs ${bot ? "bg-navy text-white" : t.sender === "human" ? "bg-emerald-50 text-navy" : "bg-white text-navy"}`}>
                      <div className={`flex items-center justify-between gap-3 text-[10px] ${bot ? "text-white/60" : "text-mute"}`}>
                        <span className="font-bold">{AI_VI[t.sender] ?? t.sender}</span><span className="tabular-nums">{luc(t.created_at)}</span>
                      </div>
                      <div className="mt-0.5 whitespace-pre-wrap text-sm">{t.body}</div>
                      {bot && !sua && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                          <button type="button" onClick={() => { setDangSua(t.id); setNhap(co?.cau_chuan ?? t.body); }} className="font-bold text-brand hover:underline">✏️ {co ? "Sửa lại câu chuẩn" : "Sửa thành câu chuẩn"}</button>
                          {co && <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-200">đã có mẫu</span>}
                        </div>
                      )}
                      {bot && sua && (
                        <div className="mt-2 space-y-1.5">
                          <textarea value={nhap} onChange={(e) => setNhap(e.target.value)} rows={3} className="w-full rounded-lg bg-white px-2.5 py-1.5 text-sm text-navy outline-none" placeholder="Câu anh/sếp muốn bot nói…" />
                          <div className="flex gap-2 text-xs">
                            <button type="button" disabled={dangLuu || !nhap.trim()} onClick={() => luu(t)} className="rounded-full bg-brand px-3 py-1 font-bold text-white disabled:opacity-60">{dangLuu ? "Đang lưu…" : "Lưu mẫu"}</button>
                            <button type="button" onClick={() => setDangSua(null)} className="text-white/70 hover:underline">huỷ</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
      {loi && <div className="fixed bottom-4 right-4 rounded-xl border border-brand/30 bg-white px-4 py-2 text-sm text-brand shadow">⚠️ {loi}</div>}
    </div>
  );
}
