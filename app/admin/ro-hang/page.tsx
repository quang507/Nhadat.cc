"use client";
// /admin/ro-hang (FR-175): rổ hàng đọc như Excel — một bảng, cột xếp đúng thứ
// tự sheet Excel gốc (STT · bán/thuê · vị trí · diện tích · giá · mô tả · người
// bán), lọc, sắp xếp, tìm, tải CSV mở thẳng bằng Excel. Cùng dữ liệu với view
// `so.ro_hang` phía DB (20260907c) nhưng không cần vào Supabase.
//
// KHÔNG có cột số điện thoại — trang web không bao giờ chọn `sellers.phone`
// (NFR-07, FR-104), kể cả cho admin. SĐT xem ở Supabase → schema `so`.
// Quyền: RLS `listings_admin_read` + `sellers_admin_read` mới là hàng rào,
// trang này chỉ là UI; người không phải admin nhìn thấy trang chặn.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatArea, formatPrice, sanitizeDescription, TYPE_LABEL } from "@/lib/format";

type Dong = {
  id: string;
  code: string | null;
  legacy_sst: number | null;
  deal: "ban" | "cho_thue";
  district: string | null;
  ward: string | null;
  street: string | null;
  location_raw: string | null;
  area_m2: number | null;
  price_vnd: number | null;
  price_raw: string | null;
  description: string | null;
  property_type: string | null;
  status: string;
  created_at: string;
  sellers: { name: string | null; seller_type: string } | null;
  media: { count: number }[] | null;
  listing_media: { count: number }[] | null;
};

const COT_CHON =
  "id, code, legacy_sst, deal, district, ward, street, location_raw, area_m2, price_vnd, price_raw, description, property_type, status, created_at, sellers!listings_seller_id_fkey(name, seller_type), media(count), listing_media(count)";

const TRANG_THAI: Record<string, string> = {
  cho_thong_tin: "chờ thông tin",
  dang_ban: "đang bán",
  dang_quan_tam: "đang quan tâm",
  da_chot: "đã chốt",
  an: "ẩn",
};
const MOI_TRANG = 20;

// Một cột = nhãn + cách lấy giá trị hiển thị + giá trị để sắp xếp. CSV dùng
// đúng danh sách này nên bảng trên màn hình và file tải về không bao giờ lệch.
type Cot = { key: string; ten: string; lay: (d: Dong) => string; sap?: (d: Dong) => number | string };
const viTri = (d: Dong) =>
  (d.location_raw ?? [d.street, d.ward, d.district].filter(Boolean).join(", ")).replace(/\r?\n/g, " — ");
const soAnh = (d: Dong) => (d.media?.[0]?.count ?? 0) + (d.listing_media?.[0]?.count ?? 0);
const COT: Cot[] = [
  { key: "stt", ten: "STT", lay: (d) => (d.legacy_sst != null ? String(d.legacy_sst) : ""), sap: (d) => d.legacy_sst ?? 1e9 },
  { key: "deal", ten: "Bán / thuê", lay: (d) => (d.deal === "ban" ? "Bán" : "Cho thuê"), sap: (d) => d.deal },
  { key: "vi_tri", ten: "Vị trí", lay: viTri, sap: viTri },
  { key: "dien_tich", ten: "Diện tích", lay: (d) => formatArea(d.area_m2), sap: (d) => d.area_m2 ?? -1 },
  { key: "gia", ten: "Giá", lay: (d) => formatPrice(d.price_vnd, d.price_raw), sap: (d) => d.price_vnd ?? -1 },
  { key: "mo_ta", ten: "Mô tả", lay: (d) => sanitizeDescription(d.description).replace(/\r?\n/g, " ") },
  { key: "nguoi_ban", ten: "Người bán", lay: (d) => d.sellers?.name ?? "", sap: (d) => d.sellers?.name ?? "" },
  { key: "ma", ten: "Mã tin", lay: (d) => d.code ?? "", sap: (d) => d.code ?? "" },
  { key: "loai", ten: "Loại", lay: (d) => TYPE_LABEL[d.property_type ?? ""] ?? "chưa rõ", sap: (d) => d.property_type ?? "" },
  { key: "trang_thai", ten: "Trạng thái", lay: (d) => TRANG_THAI[d.status] ?? d.status, sap: (d) => d.status },
  { key: "anh", ten: "Ảnh", lay: (d) => String(soAnh(d)), sap: soAnh },
  { key: "ngay", ten: "Ngày vào", lay: (d) => d.created_at.slice(0, 10), sap: (d) => d.created_at },
];

const khongDau = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export default function Page() {
  const [role, setRole] = useState<"loading" | "anon" | "user" | "admin">("loading");
  const [rows, setRows] = useState<Dong[]>([]);
  const [loi, setLoi] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [deal, setDeal] = useState<"" | "ban" | "cho_thue">("");
  const [trangThai, setTrangThai] = useState("");
  const [sap, setSap] = useState<{ key: string; tang: boolean }>({ key: "stt", tang: true });
  const [trang, setTrang] = useState(1);
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
        .select(COT_CHON)
        .order("legacy_sst", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) setLoi(error.message);
      setRows((data ?? []) as unknown as Dong[]);
    });
  }, []);

  const loc = useMemo(() => {
    const kq = khongDau(q.trim());
    let xs = rows.filter((d) => (!deal || d.deal === deal) && (!trangThai || d.status === trangThai));
    if (kq) {
      xs = xs.filter((d) =>
        khongDau([d.code ?? "", viTri(d), d.description ?? "", d.sellers?.name ?? "", String(d.legacy_sst ?? "")].join(" ")).includes(kq),
      );
    }
    const cot = COT.find((c) => c.key === sap.key);
    if (cot?.sap) {
      const f = cot.sap;
      xs = [...xs].sort((a, b) => {
        const x = f(a), y = f(b);
        const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "vi");
        return sap.tang ? r : -r;
      });
    }
    return xs;
  }, [rows, q, deal, trangThai, sap]);

  const soTrang = Math.max(1, Math.ceil(loc.length / MOI_TRANG));
  const t = Math.min(trang, soTrang);
  const mot = loc.slice((t - 1) * MOI_TRANG, t * MOI_TRANG);

  const bamCot = (key: string) => {
    setSap((s) => ({ key, tang: s.key === key ? !s.tang : true }));
    setTrang(1);
  };

  // CSV có BOM để Excel trên Windows đọc tiếng Việt đúng ngay khi mở đúp.
  const taiCsv = () => {
    const bao = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const dong = [COT.map((c) => bao(c.ten)).join(",")].concat(
      loc.map((d) => COT.map((c) => bao(c.lay(d))).join(",")),
    );
    const blob = new Blob(["﻿" + dong.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ro-hang-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const o = "rounded-full border border-line px-3 py-1.5 text-sm outline-none focus:border-brand";
  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-10">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm text-mute">
            <Link href="/admin" className="underline hover:text-brand">Quản trị</Link> · Rổ hàng
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Rổ hàng</h1>
          <p className="mt-1 text-sm text-mute tabular-nums">
            {rows.length} tin · đang hiện {loc.length} · cột xếp như file Excel gốc · không có cột số điện thoại
          </p>
        </div>
        <button
          type="button"
          onClick={taiCsv}
          disabled={loc.length === 0}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
        >
          Tải CSV ({loc.length} dòng) — mở bằng Excel
        </button>
      </header>

      {loi && (
        <p className="mt-4 rounded-shot border border-brand/30 bg-brand/5 px-4 py-2.5 text-sm text-brand">
          Không đọc được: {loi}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setTrang(1); }}
          placeholder="tìm: mã tin, đường, phường, mô tả, người bán…"
          className={`${o} min-w-0 flex-1 px-4`}
        />
        <select value={deal} onChange={(e) => { setDeal(e.target.value as typeof deal); setTrang(1); }} className={o}>
          <option value="">Bán + cho thuê</option>
          <option value="ban">Chỉ bán</option>
          <option value="cho_thue">Chỉ cho thuê</option>
        </select>
        <select value={trangThai} onChange={(e) => { setTrangThai(e.target.value); setTrang(1); }} className={o}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(TRANG_THAI).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-shot border border-line">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-line text-xs uppercase tracking-wide text-mute">
              {COT.map((c) => (
                <th key={c.key} className="px-3 py-2 font-semibold">
                  {c.sap ? (
                    <button type="button" onClick={() => bamCot(c.key)} className="hover:text-brand">
                      {c.ten}{sap.key === c.key ? (sap.tang ? " ↑" : " ↓") : ""}
                    </button>
                  ) : (
                    c.ten
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {mot.map((d) => {
              const moTa = COT[5].lay(d);
              const daMo = mo.has(d.id);
              return (
                <tr key={d.id} className="align-top hover:bg-brand/5">
                  {COT.map((c) => {
                    if (c.key === "mo_ta") {
                      return (
                        <td key={c.key} className="max-w-[28rem] px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setMo((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}
                            className="text-left"
                            title={daMo ? "thu gọn" : "bấm để xem đủ"}
                          >
                            {daMo || moTa.length <= 140 ? moTa : moTa.slice(0, 140) + "…"}
                          </button>
                        </td>
                      );
                    }
                    if (c.key === "ma" && d.code) {
                      return (
                        <td key={c.key} className="whitespace-nowrap px-3 py-2 tabular-nums">
                          <Link href={`/nha-dat/${d.code}`} target="_blank" className="underline hover:text-brand">{d.code}</Link>
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} className={`px-3 py-2 tabular-nums ${c.key === "vi_tri" ? "max-w-[18rem]" : "whitespace-nowrap"}`}>
                        {c.lay(d)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {mot.length === 0 && (
              <tr><td colSpan={COT.length} className="px-3 py-6 text-center text-mute">Không có tin nào khớp.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {soTrang > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button type="button" disabled={t <= 1} onClick={() => setTrang(t - 1)} className="rounded-full border border-line px-4 py-1.5 disabled:opacity-40">← Trước</button>
          <span className="text-mute tabular-nums">trang {t}/{soTrang} · {MOI_TRANG} tin mỗi trang</span>
          <button type="button" disabled={t >= soTrang} onClick={() => setTrang(t + 1)} className="rounded-full border border-line px-4 py-1.5 disabled:opacity-40">Sau →</button>
        </div>
      )}
    </div>
  );
}
