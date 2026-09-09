"use client";
// /admin/mau-cau — FR-180: sửa câu bot thành CÂU CHUẨN, lưu cặp "ngữ cảnh → câu
// chuẩn" (chủ dự án 09/09/2026: "mỗi ngày anh hoặc sếp sửa tay câu bot thành
// câu mong muốn… đủ 300 mẫu thì thử fine-tune").
// Trái: hội thoại mới nhất (cả bán lẫn mua). Phải: từng lượt; mỗi câu bot có ô
// sửa. Lưu = upsert `mau_cau` (RLS admin), ngữ cảnh 8 lượt trước chụp qua RPC
// `ngu_canh_tin`. Bot dùng mẫu mới trong vòng 1 phút (mau_cau_fewshot).
// Nút "Tải JSONL" xuất ShareGPT (Unsloth) từ những mẫu đang hiển thị — bản
// đầy đủ để train chạy `node scripts/xuat-mau-cau.mjs`.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const MUC_TIEU = 300;

type HoiThoai = {
  id: string; channel: string | null; seller_id: string | null; buyer_id: string | null;
  last_message_at: string | null;
  sellers: { name: string | null } | null; buyers: { name: string | null } | null;
};
type Tin = { id: string; sender: string; body: string; seq: number; created_at: string };
type Mau = {
  id: string; message_id: string | null; conversation_id: string | null; phia: "ban" | "mua";
  ngu_canh: Array<{ ai: string; noi_dung: string; luc?: string }>;
  cau_bot: string; cau_chuan: string; dung_lam: "vi_du" | "fine_tune" | "ca_hai" | "bo";
  ghi_chu: string | null; nguoi_sua: string | null; updated_at: string;
};

const AI_VI: Record<string, string> = {
  bot: "Thái", buyer: "Khách", seller: "Chủ nhà", human: "Người thật", ctv: "CTV", system: "Hệ thống",
};
const DUNG_LAM_VI: Record<Mau["dung_lam"], string> = {
  ca_hai: "ví dụ + fine-tune", vi_du: "chỉ ví dụ trong prompt", fine_tune: "chỉ fine-tune", bo: "bỏ",
};
const luc = (s: string | null) => s ? new Date(s).toLocaleString("vi-VN", { hour12: false }) : "";

export default function Page() {
  const [role, setRole] = useState<"loading" | "anon" | "user" | "admin">("loading");
  const [email, setEmail] = useState<string>("");
  const [hoiThoai, setHoiThoai] = useState<HoiThoai[]>([]);
  const [mau, setMau] = useState<Mau[]>([]);
  const [chon, setChon] = useState<HoiThoai | null>(null);
  const [tin, setTin] = useState<Tin[]>([]);
  const [dangSua, setDangSua] = useState<string | null>(null);
  const [nhap, setNhap] = useState("");
  const [dungLam, setDungLam] = useState<Mau["dung_lam"]>("ca_hai");
  const [ghiChu, setGhiChu] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [locPhia, setLocPhia] = useState<"" | "ban" | "mua">("");
  const [dangLuu, setDangLuu] = useState(false);

  const napMau = async () => {
    const { data, error } = await supabase.from("mau_cau").select("*").order("updated_at", { ascending: false }).limit(2000);
    if (error) setLoi(error.message);
    setMau((data ?? []) as Mau[]);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return setRole("anon");
      const { data: a } = await supabase.from("admins").select("email").eq("email", user.email ?? "").maybeSingle();
      if (!a) return setRole("user");
      setRole("admin");
      setEmail(user.email ?? "");
      const { data, error } = await supabase
        .from("conversations")
        .select("id, channel, seller_id, buyer_id, last_message_at, sellers!conversations_seller_id_fkey(name), buyers!conversations_buyer_id_fkey(name)")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(150);
      if (error) setLoi(error.message);
      setHoiThoai((data ?? []) as unknown as HoiThoai[]);
      await napMau();
    });
  }, []);

  const moHoiThoai = async (h: HoiThoai) => {
    setChon(h); setDangSua(null);
    const { data, error } = await supabase.from("messages")
      .select("id, sender, body, seq, created_at").eq("conversation_id", h.id).order("seq").limit(400);
    if (error) setLoi(error.message);
    setTin((data ?? []) as Tin[]);
  };

  const mauCua = (messageId: string) => mau.find((m) => m.message_id === messageId);
  const batDauSua = (t: Tin) => {
    const co = mauCua(t.id);
    setDangSua(t.id);
    setNhap(co?.cau_chuan ?? t.body);
    setDungLam(co?.dung_lam ?? "ca_hai");
    setGhiChu(co?.ghi_chu ?? "");
  };

  const luu = async (t: Tin) => {
    if (!chon) return;
    const cauChuan = nhap.trim();
    if (!cauChuan) return;
    setDangLuu(true);
    // Ngữ cảnh: 8 lượt trước, tính ở DB để trang và script xuất cùng một cách.
    const { data: nguCanh, error: ncErr } = await supabase.rpc("ngu_canh_tin", { p_message_id: t.id });
    if (ncErr) setLoi(ncErr.message);
    const { error } = await supabase.from("mau_cau").upsert({
      message_id: t.id, conversation_id: chon.id, phia: chon.seller_id ? "ban" : "mua",
      ngu_canh: nguCanh ?? [], cau_bot: t.body, cau_chuan: cauChuan, dung_lam: dungLam,
      ghi_chu: ghiChu.trim() || null, nguoi_sua: email,
    }, { onConflict: "message_id" });
    setDangLuu(false);
    if (error) { setLoi(error.message); return; }
    setDangSua(null);
    await napMau();
  };

  const xoa = async (m: Mau) => {
    if (!confirm("Xoá mẫu này?")) return;
    const { error } = await supabase.from("mau_cau").delete().eq("id", m.id);
    if (error) setLoi(error.message); else await napMau();
  };

  const mauDung = useMemo(() => mau.filter((m) => m.dung_lam !== "bo" && (!locPhia || m.phia === locPhia)), [mau, locPhia]);
  const soDung = mau.filter((m) => m.dung_lam !== "bo").length;

  const taiJsonl = () => {
    // ShareGPT (Unsloth): ngữ cảnh → lượt human/gpt xen kẽ, kết bằng gpt = câu chuẩn.
    const dong = mauDung.filter((m) => m.dung_lam !== "vi_du").map((m) => {
      const conv: Array<{ from: "human" | "gpt"; value: string }> = [];
      for (const x of m.ngu_canh ?? []) {
        const from = x.ai === "bot" ? "gpt" : "human";
        const last = conv[conv.length - 1];
        if (last && last.from === from) last.value += "\n" + x.noi_dung; else conv.push({ from, value: x.noi_dung });
      }
      if (!conv.length || conv[conv.length - 1].from === "gpt") conv.push({ from: "human", value: "(khách im)" });
      conv.push({ from: "gpt", value: m.cau_chuan });
      return JSON.stringify({ phia: m.phia, conversations: conv });
    });
    const blob = new Blob([dong.join("\n") + "\n"], { type: "application/jsonl;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `mau-cau-${new Date().toISOString().slice(0, 10)}.sharegpt.jsonl`; a.click();
    URL.revokeObjectURL(url);
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

  const pct = Math.min(100, Math.round((soDung / MUC_TIEU) * 100));
  const ten = (h: HoiThoai) => h.sellers?.name ?? h.buyers?.name ?? (h.seller_id ? "Chủ nhà" : "Khách");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-sm font-semibold text-brand hover:underline">← Quay lại Bàn quản trị</Link>
            <span className="text-mute text-xs">/</span>
            <span className="text-xs text-mute font-medium">Mẫu câu chuẩn</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy">Sửa câu bot thành câu chuẩn</h1>
          <p className="mt-1 text-sm text-mute">
            Mở một hội thoại, bấm <b>Sửa</b> ở câu bot chưa ưng, gõ câu anh/sếp muốn bot nói. Bot bắt chước mẫu mới trong vòng 1 phút; đủ {MUC_TIEU} mẫu thì đem đi fine-tune.
          </p>
        </div>
        <div className="min-w-[260px]">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold text-navy tabular-nums">{soDung}/{MUC_TIEU} mẫu</span>
            <span className="text-mute text-xs">{mau.filter((m) => m.phia === "ban" && m.dung_lam !== "bo").length} bán · {mau.filter((m) => m.phia === "mua" && m.dung_lam !== "bo").length} mua</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
          <div className="mt-2 flex gap-2">
            <select value={locPhia} onChange={(e) => setLocPhia(e.target.value as "" | "ban" | "mua")} className="rounded-full border border-line bg-white px-3 py-1 text-xs">
              <option value="">Cả hai phía</option><option value="ban">Bán</option><option value="mua">Mua</option>
            </select>
            <button type="button" onClick={taiJsonl} disabled={mauDung.length === 0} className="rounded-full bg-brand px-4 py-1 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-60">
              📥 Tải JSONL ({mauDung.filter((m) => m.dung_lam !== "vi_du").length})
            </button>
          </div>
        </div>
      </header>

      {loi && <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5 text-sm text-brand">⚠️ {loi}</div>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-line bg-white shadow-2xs">
          <div className="border-b border-line px-4 py-2 text-xs font-bold uppercase tracking-wide text-mute">Hội thoại mới nhất</div>
          <ul className="max-h-[70vh] overflow-y-auto">
            {hoiThoai.map((h) => {
              const n = mau.filter((m) => m.conversation_id === h.id && m.dung_lam !== "bo").length;
              return (
                <li key={h.id}>
                  <button type="button" onClick={() => moHoiThoai(h)} className={`flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50 ${chon?.id === h.id ? "bg-brand/5" : ""}`}>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${h.seller_id ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>{h.seller_id ? "bán" : "mua"}</span>
                    <span className="flex-1 truncate text-sm text-navy">{ten(h)}</span>
                    {n > 0 && <span className="text-[11px] font-bold text-brand tabular-nums">{n} mẫu</span>}
                    <span className="text-[11px] text-mute tabular-nums">{luc(h.last_message_at).slice(0, 5)}</span>
                  </button>
                </li>
              );
            })}
            {hoiThoai.length === 0 && <li className="px-4 py-6 text-center text-sm text-mute">Chưa có hội thoại.</li>}
          </ul>
        </aside>

        <section className="rounded-2xl border border-line bg-white shadow-2xs">
          {!chon ? (
            <div className="px-6 py-16 text-center text-sm text-mute">Chọn một hội thoại bên trái.</div>
          ) : (
            <div className="px-4 py-3">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="font-bold text-navy">{ten(chon)} · {chon.seller_id ? "người bán" : "người mua"} · {chon.channel}</span>
                <span className="text-xs text-mute tabular-nums">{tin.length} lượt</span>
              </div>
              <ol className="space-y-2">
                {tin.map((t) => {
                  const bot = t.sender === "bot";
                  const co = mauCua(t.id);
                  const sua = dangSua === t.id;
                  return (
                    <li key={t.id} className={`rounded-xl px-3 py-2 ${bot ? "bg-slate-50" : "bg-blue-50/60"}`}>
                      <div className="flex items-center justify-between text-[11px] text-mute">
                        <span className="font-bold">{AI_VI[t.sender] ?? t.sender}</span>
                        <span className="tabular-nums">{luc(t.created_at)}</span>
                      </div>
                      <div className="mt-0.5 whitespace-pre-wrap text-sm text-navy">{t.body}</div>
                      {bot && !sua && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                          <button type="button" onClick={() => batDauSua(t)} className="font-bold text-brand hover:underline">✏️ {co ? "Sửa lại câu chuẩn" : "Sửa thành câu chuẩn"}</button>
                          {co && (
                            <>
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">đã có mẫu · {DUNG_LAM_VI[co.dung_lam]}</span>
                              <span className="text-mute">→ “{co.cau_chuan.slice(0, 90)}{co.cau_chuan.length > 90 ? "…" : ""}”</span>
                              <button type="button" onClick={() => xoa(co)} className="text-mute hover:text-red-600">xoá</button>
                            </>
                          )}
                        </div>
                      )}
                      {bot && sua && (
                        <div className="mt-2 space-y-2">
                          <textarea value={nhap} onChange={(e) => setNhap(e.target.value)} rows={4}
                            className="w-full rounded-xl border border-brand/40 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
                            placeholder="Câu anh/sếp muốn bot nói ở đúng chỗ này…" />
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <select value={dungLam} onChange={(e) => setDungLam(e.target.value as Mau["dung_lam"])} className="rounded-full border border-line bg-white px-3 py-1">
                              {(Object.keys(DUNG_LAM_VI) as Mau["dung_lam"][]).map((k) => <option key={k} value={k}>{DUNG_LAM_VI[k]}</option>)}
                            </select>
                            <input value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="ghi chú (vì sao sửa)…" className="min-w-[200px] flex-1 rounded-full border border-line bg-white px-3 py-1" />
                            <button type="button" disabled={dangLuu || !nhap.trim()} onClick={() => luu(t)} className="rounded-full bg-brand px-4 py-1 font-bold text-white hover:bg-brand-dark disabled:opacity-60">
                              {dangLuu ? "Đang lưu…" : "Lưu mẫu"}
                            </button>
                            <button type="button" onClick={() => setDangSua(null)} className="text-mute hover:underline">huỷ</button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
