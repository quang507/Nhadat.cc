"use client";
// /admin/ro-hang/json — rổ hàng dưới dạng JSON (chủ dự án 09/09/2026: "1 trang
// lưu dưới dạng json"). Mỗi tin một khối: cột chính + `boc_tach` (FR-177 h —
// những gì bot bóc được từ câu rao và mọi fact chủ nhà trả lời, không có khoá
// null). Nút "Tải JSON" xuất cả rổ (theo bộ lọc) thành một file .json.
// Chỉ admin (bảng `admins`), đọc `listings` qua RLS `listings_admin_read` —
// cùng cách với /admin/ro-hang. Không gọi RPC (diem_tin chỉ service_role).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Tin = {
  id: string;
  code: string | null;
  legacy_code: string | null;
  deal: "ban" | "cho_thue";
  district: string | null;
  ward: string | null;
  street: string | null;
  location_raw: string | null;
  area_m2: number | null;
  price_vnd: number | null;
  price_raw: string | null;
  property_type: string | null;
  status: string;
  gap: boolean | null;
  can_chu_duyet: boolean;
  chu_duyet_at: string | null;
  chu_noi_du_at: string | null;
  boc_tach: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
  sellers: { name: string | null; seller_type: string } | null;
};

const COT =
  "id, code, legacy_code, deal, district, ward, street, location_raw, area_m2, price_vnd, price_raw, property_type, status, gap, can_chu_duyet, chu_duyet_at, chu_noi_du_at, boc_tach, created_at, updated_at, sellers!listings_seller_id_fkey(name, seller_type)";

// Bỏ khoá null/rỗng cho gọn — "cột null không quan trọng thì không cần liệt kê".
const gon = (t: Tin) => {
  const o: Record<string, unknown> = {
    ma_tin: t.code,
    ma_cu: t.legacy_code,
    loai_giao_dich: t.deal,
    loai_bds: t.property_type === "chua_ro" ? null : t.property_type,
    vi_tri: {
      dia_chi: t.location_raw, duong: t.street, phuong: t.ward, quan: t.district,
    },
    dien_tich_m2: t.area_m2,
    gia_raw: t.price_raw,
    gia_vnd: t.price_vnd,
    gap: t.gap,
    trang_thai: t.status,
    nguoi_ban: t.sellers ? { ten: t.sellers.name, loai: t.sellers.seller_type } : null,
    tu_chat: t.can_chu_duyet || null,
    chu_duyet_luc: t.chu_duyet_at,
    chu_noi_du_luc: t.chu_noi_du_at,
    boc_tach: t.boc_tach,
    tao_luc: t.created_at,
    sua_luc: t.updated_at,
    id: t.id,
  };
  const sach = (v: unknown): unknown => {
    if (v === null || v === undefined || v === "") return undefined;
    if (Array.isArray(v)) return v;
    if (typeof v === "object") {
      const r: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        const y = sach(x);
        if (y !== undefined) r[k] = y;
      }
      return Object.keys(r).length ? r : undefined;
    }
    return v;
  };
  return sach(o) as Record<string, unknown>;
};

const khongDau = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export default function Page() {
  const [role, setRole] = useState<"loading" | "anon" | "user" | "admin">("loading");
  const [rows, setRows] = useState<Tin[]>([]);
  const [loi, setLoi] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [chiBocTach, setChiBocTach] = useState(false);
  const [mo, setMo] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return setRole("anon");
      const { data: a } = await supabase
        .from("admins").select("email").eq("email", user.email ?? "").maybeSingle();
      if (!a) return setRole("user");
      setRole("admin");
      const { data, error } = await supabase
        .from("listings")
        .select(COT)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) setLoi(error.message);
      setRows((data ?? []) as unknown as Tin[]);
    });
  }, []);

  const loc = useMemo(() => {
    const kq = khongDau(q.trim());
    let xs = rows;
    if (chiBocTach) xs = xs.filter((t) => t.boc_tach && Object.keys(t.boc_tach).length > 0);
    if (kq) {
      xs = xs.filter((t) =>
        khongDau([t.code ?? "", t.location_raw ?? "", t.ward ?? "", t.district ?? "", t.sellers?.name ?? "",
          JSON.stringify(t.boc_tach ?? {})].join(" ")).includes(kq),
      );
    }
    return xs;
  }, [rows, q, chiBocTach]);

  const taiJson = () => {
    const goi = {
      nguon: "nhadat.cc /admin/ro-hang/json",
      xuat_luc: new Date().toISOString(),
      so_tin: loc.length,
      tin: loc.map(gon),
    };
    const blob = new Blob([JSON.stringify(goi, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ro-hang-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chepMot = async (t: Tin) => {
    try { await navigator.clipboard.writeText(JSON.stringify(gon(t), null, 2)); } catch { /* trình duyệt chặn thì thôi */ }
  };

  if (role === "loading") return <div className="mx-auto max-w-4xl px-4 py-16 text-mute font-medium">Đang kiểm tra quyền…</div>;
  if (role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-navy">Khu vực quản trị</h1>
        <p className="mt-2 text-mute text-sm">
          {role === "anon" ? "Cần đăng nhập bằng tài khoản quản trị." : "Tài khoản này không có quyền quản trị."}
        </p>
        {role === "anon" && (
          <Link href="/dang-nhap" className="mt-5 inline-block rounded-md bg-brand px-6 py-2.5 font-bold text-white hover:bg-brand-dark transition">
            Đăng nhập
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin/ro-hang" className="text-sm font-semibold text-brand hover:underline">
              ← Rổ hàng (Excel)
            </Link>
            <span className="text-mute text-xs">/</span>
            <span className="text-xs text-mute font-medium">JSON</span>
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-navy">Rổ hàng BĐS (Dạng JSON)</h1>
          <p className="mt-1 text-sm text-mute tabular-nums">
            {rows.length} tin · hiển thị {loc.length} · mỗi tin kèm <code className="rounded bg-slate-100 px-1">boc_tach</code> — những gì bot bóc được từ câu rao và câu trả lời của chủ nhà, không liệt kê trường trống
          </p>
        </div>
        <button
          type="button"
          onClick={taiJson}
          disabled={loc.length === 0}
          className="rounded-md bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          Tải JSON ({loc.length} tin)
        </button>
      </header>

      {loi && (
        <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5 text-sm text-brand">
          Không đọc được: {loi}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm: mã tin, đường, phường, người bán, nội dung bóc tách…"
          className="min-w-[280px] flex-1 rounded-md border border-line bg-white px-4 py-2 text-sm outline-none focus:border-brand"
        />
        <label className="flex items-center gap-2 text-sm text-navy">
          <input type="checkbox" checked={chiBocTach} onChange={(e) => setChiBocTach(e.target.checked)} />
          chỉ tin có bóc tách
        </label>
      </div>

      <div className="mt-5 space-y-3">
        {loc.map((t) => {
          const dangMo = mo.has(t.id);
          const soKhoa = t.boc_tach ? Object.keys(t.boc_tach).filter((k) => !k.startsWith("_")).length : 0;
          return (
            <section key={t.id} className="rounded-2xl border border-line bg-white">
              <button
                type="button"
                onClick={() => setMo((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left"
              >
                <span className="font-mono text-sm font-bold text-brand">{t.code ?? "(chưa mã)"}</span>
                <span className="text-sm text-navy">
                  {[t.location_raw, t.ward, t.district].filter(Boolean).join(", ") || "—"}
                </span>
                <span className="text-xs text-mute">{t.deal === "ban" ? "Bán" : "Cho thuê"} · {t.price_raw ?? "—"} · {t.status}</span>
                {t.gap === true && <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">gấp</span>}
                {t.chu_noi_du_at && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-mute">chủ nói đủ</span>}
                <span className="ml-auto text-xs text-mute tabular-nums">{soKhoa} khoá bóc tách · {dangMo ? "thu gọn ▲" : "xem JSON ▼"}</span>
              </button>
              {dangMo && (
                <div className="border-t border-line px-4 py-3">
                  <div className="mb-2 flex justify-end">
                    <button type="button" onClick={() => chepMot(t)} className="text-xs font-semibold text-brand hover:underline">
                      Chép JSON tin này
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
                    {JSON.stringify(gon(t), null, 2)}
                  </pre>
                </div>
              )}
            </section>
          );
        })}
        {loc.length === 0 && !loi && (
          <p className="py-10 text-center text-sm text-mute">Chưa có tin nào khớp bộ lọc.</p>
        )}
      </div>
    </div>
  );
}
