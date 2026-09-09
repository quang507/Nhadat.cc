"use client";
// /admin/ro-hang (FR-175): rổ hàng đọc như Excel — một bảng, cột xếp đúng thứ
// tự sheet Excel gốc (STT · bán/thuê · vị trí · diện tích · giá · mô tả · người
// bán), lọc, sắp xếp, tìm, tải CSV mở thẳng bằng Excel. Cùng dữ liệu với view
// `so.ro_hang` phía DB (20260907c) nhưng không cần vào Supabase.
// 08/09/2026: Bổ sung tính năng SỬA TRỰC TIẾP tại chỗ (Inline Quick Status + Modal Sửa Chi Tiết).
import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatArea, formatPrice, sanitizeDescription, TYPE_LABEL } from "@/lib/format";
import BocTachNhom, { useBocTach } from "@/components/admin/BocTachNhom";

// FR-187: dòng JSON chia nhóm mở dưới một tin (đọc `boc_tach_v` khi bấm, không tải cả rổ).
function DongJson({ id, ma, cot }: { id: string; ma: string | null; cot: number }) {
  const { nhom, loi } = useBocTach(id);
  return (
    <tr className="bg-slate-50/70">
      <td colSpan={cot} className="px-4 py-3">
        <BocTachNhom ma={ma} nhom={nhom} loi={loi} />
      </td>
    </tr>
  );
}

type Dong = {
  id: string;
  code: string | null;
  legacy_code?: string | null;
  legacy_sst: number | null;
  deal: "ban" | "cho_thue";
  district: string | null;
  ward: string | null;
  street: string | null;
  location_raw: string | null;
  area_m2: number | null;
  frontage_m?: string | number | null;
  length_m?: string | number | null;
  floors?: number | null;
  bedrooms?: number | null;
  price_vnd: number | null;
  price_raw: string | null;
  description: string | null;
  property_type: string | null;
  status: string;
  created_at: string;
  sellers: { name: string | null; phone: string | null; seller_type: string } | null;
  media: { count: number }[] | null;
  listing_media: { count: number }[] | null;
};

const COT_CHON =
  "id, code, legacy_code, legacy_sst, deal, district, ward, street, location_raw, area_m2, frontage_m, length_m, floors, bedrooms, price_vnd, price_raw, description, property_type, status, created_at, sellers!listings_seller_id_fkey(name, phone, seller_type), media(count), listing_media(count)";

const TRANG_THAI: Record<string, string> = {
  cho_thong_tin: "chờ thông tin",
  dang_ban: "đang bán",
  dang_quan_tam: "đang quan tâm",
  da_chot: "đã chốt",
  an: "ẩn",
};

const MAU_TRANG_THAI: Record<string, string> = {
  dang_ban: "bg-emerald-50 text-emerald-800 border-emerald-300",
  cho_thong_tin: "bg-amber-50 text-amber-800 border-amber-300",
  dang_quan_tam: "bg-blue-50 text-blue-800 border-blue-300",
  da_chot: "bg-purple-50 text-purple-800 border-purple-300",
  an: "bg-slate-100 text-mute border-slate-300",
};

const MOI_TRANG = 20;

type Cot = { key: string; ten: string; lay: (d: Dong) => string; sap?: (d: Dong) => number | string };

const DUOI_THANH_PHO = /(,\s*Quận 5)?,\s*(tp\.?|thành phố)?\s*Hồ Chí Minh\.?\s*$/i;
const viTri = (d: Dong) =>
  (d.location_raw ?? [d.street, d.ward, d.district].filter(Boolean).join(", "))
    .trim()
    .replace(/\r?\n/g, " - ")
    .replace(DUOI_THANH_PHO, "");
const moTa = (d: Dong) =>
  sanitizeDescription(d.description)
    .replace(/\s*\r?\n\s*[-•+*]?\s*/g, " · ")
    .replace(/^[-•+*]\s*/, "");
const soAnh = (d: Dong) => (d.media?.[0]?.count ?? 0) + (d.listing_media?.[0]?.count ?? 0);

const COT: Cot[] = [
  { key: "stt", ten: "STT", lay: (d) => (d.legacy_sst != null ? String(d.legacy_sst) : ""), sap: (d) => d.legacy_sst ?? 1e9 },
  { key: "deal", ten: "Bán / thuê", lay: (d) => (d.deal === "ban" ? "Bán" : "Cho thuê"), sap: (d) => d.deal },
  { key: "vi_tri", ten: "Vị trí", lay: viTri, sap: viTri },
  { key: "dien_tich", ten: "Diện tích", lay: (d) => formatArea(d.area_m2), sap: (d) => d.area_m2 ?? -1 },
  { key: "gia", ten: "Giá", lay: (d) => formatPrice(d.price_vnd, d.price_raw), sap: (d) => d.price_vnd ?? -1 },
  { key: "mo_ta", ten: "Mô tả", lay: moTa },
  { key: "nguoi_ban", ten: "Người bán", lay: (d) => d.sellers?.name ?? "", sap: (d) => d.sellers?.name ?? "" },
  { key: "sdt", ten: "SĐT người bán", lay: (d) => d.sellers?.phone ?? "", sap: (d) => d.sellers?.phone ?? "" },
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
  const [sap, setSap] = useState<{ key: string; tang: boolean }>({ key: "ngay", tang: false });
  const [trang, setTrang] = useState(1);
  const [mo, setMo] = useState<Set<string>>(new Set());
  // FR-187: tin đang mở JSON chia nhóm.
  const [moJson, setMoJson] = useState<Set<string>>(new Set());

  // Modal chỉnh sửa trực tiếp
  const [dangSua, setDangSua] = useState<Dong | null>(null);
  const [formSua, setFormSua] = useState<{
    deal: "ban" | "cho_thue";
    status: string;
    property_type: string;
    price_raw: string;
    price_vnd: string;
    area_m2: string;
    frontage_m: string;
    length_m: string;
    floors: string;
    bedrooms: string;
    location_raw: string;
    district: string;
    ward: string;
    street: string;
    description: string;
  }>({
    deal: "ban",
    status: "dang_ban",
    property_type: "nha_pho",
    price_raw: "",
    price_vnd: "",
    area_m2: "",
    frontage_m: "",
    length_m: "",
    floors: "",
    bedrooms: "",
    location_raw: "",
    district: "",
    ward: "",
    street: "",
    description: "",
  });
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    // Ô tìm trên thanh CRM (AdminShell) đưa ?q= sang đây.
    try { const k = new URLSearchParams(location.search).get("q"); if (k) setQ(k); } catch { /* SSR */ }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return setRole("anon");
      const { data: a } = await supabase
        .from("admins").select("email").eq("email", user.email ?? "").maybeSingle();
      if (!a) return setRole("user");
      setRole("admin");
      const { data, error } = await supabase
        .from("listings")
        .select(COT_CHON)
        .order("created_at", { ascending: false })
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
    setSap((s) => ({ key, tang: s.key === key ? !s.tang : false }));
  };

  // Mở modal sửa chi tiết
  const moSua = (d: Dong) => {
    setDangSua(d);
    setFormSua({
      deal: d.deal || "ban",
      status: d.status || "dang_ban",
      property_type: d.property_type || "nha_pho",
      price_raw: d.price_raw || "",
      price_vnd: d.price_vnd ? String(d.price_vnd) : "",
      area_m2: d.area_m2 ? String(d.area_m2) : "",
      frontage_m: d.frontage_m ? String(d.frontage_m) : "",
      length_m: d.length_m ? String(d.length_m) : "",
      floors: d.floors ? String(d.floors) : "",
      bedrooms: d.bedrooms ? String(d.bedrooms) : "",
      location_raw: d.location_raw || "",
      district: d.district || "",
      ward: d.ward || "",
      street: d.street || "",
      description: d.description || "",
    });
  };

  // Lưu chỉnh sửa vào database
  const luuSua = async () => {
    if (!dangSua) return;
    setDangLuu(true);
    const numOrNull = (v: string) => {
      const s = v.trim().replace(',', '.');
      if (!s) return null;
      const n = Number(s);
      return isNaN(n) ? null : n;
    };
    const intOrNull = (v: string) => {
      const s = v.trim();
      if (!s) return null;
      const n = parseInt(s, 10);
      return isNaN(n) ? null : n;
    };

    const updates = {
      deal: formSua.deal,
      status: formSua.status,
      property_type: formSua.property_type || null,
      price_raw: formSua.price_raw.trim() || null,
      price_vnd: numOrNull(formSua.price_vnd),
      area_m2: numOrNull(formSua.area_m2),
      frontage_m: numOrNull(formSua.frontage_m),
      length_m: numOrNull(formSua.length_m),
      floors: intOrNull(formSua.floors),
      bedrooms: intOrNull(formSua.bedrooms),
      location_raw: formSua.location_raw.trim() || null,
      district: formSua.district.trim() || null,
      ward: formSua.ward.trim() || null,
      street: formSua.street.trim() || null,
      description: formSua.description.trim() || null,
      can_chu_duyet: false,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("listings").update(updates).eq("id", dangSua.id);
    setDangLuu(false);

    if (error) {
      alert(`Lỗi lưu thay đổi: ${error.message}`);
    } else {
      setRows((prev) =>
        prev.map((r) =>
          r.id === dangSua.id
            ? ({ ...r, ...updates } as unknown as Dong)
            : r
        )
      );
      setDangSua(null);
    }
  };

  // Đổi trạng thái nhanh 1-click từ dropdown trên bảng
  const doiTrangThaiNhanh = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("listings").update({
      status: newStatus,
      can_chu_duyet: false,
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    if (error) {
      alert(`Lỗi đổi trạng thái: ${error.message}`);
    } else {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    }
  };

  // Xoá tin trực tiếp
  const xoaTin = async (id: string, code: string | null) => {
    if (!confirm(`Bạn có chắc muốn xoá hoàn toàn tin #${code ?? id}?`)) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) {
      alert(`Lỗi xoá tin: ${error.message}`);
    } else {
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (dangSua?.id === id) setDangSua(null);
    }
  };

  const bao = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const taiCsv = () => {
    const dong = [COT.map((c) => bao(c.ten)).join(",")].concat(
      loc.map((d) => COT.map((c) => bao(c.lay(d))).join(",")),
    );
    const blob = new Blob(["\uFEFF" + dong.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ro-hang-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const o = "rounded-full border border-line px-3.5 py-1.5 text-sm outline-none focus:border-brand bg-white";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-sm font-semibold text-brand hover:underline">
              Quay lại Bàn quản trị
            </Link>
            <span className="text-mute text-xs">/</span>
            <span className="text-xs text-mute font-medium">Quản lý rổ hàng</span>
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-navy">Rổ hàng BĐS (Dạng Excel)</h1>
          <p className="mt-1 text-sm text-mute tabular-nums">
            {rows.length} tin trong rổ · đang lọc hiển thị {loc.length} · hỗ trợ sửa trực tiếp giá, trạng thái, vị trí & mô tả
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/dang-tin"
            className="rounded-md border border-line px-4 py-2 text-sm font-bold text-navy hover:border-brand hover:text-brand bg-white transition"
          >
            + Đăng tin mới
          </Link>
          <Link
            href="/admin/ro-hang/json"
            className="rounded-md border border-line px-4 py-2 text-sm font-bold text-navy hover:border-brand hover:text-brand bg-white transition"
            title="Rổ hàng dạng JSON kèm bóc tách (FR-177 h)"
          >
            {"{ }"} JSON
          </Link>
          <button
            type="button"
            onClick={taiCsv}
            disabled={loc.length === 0}
            className="rounded-md bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
          >
            Tải CSV ({loc.length} dòng)
          </button>
        </div>
      </header>

      {loi && (
        <div className="mt-4 rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5 text-sm text-brand">
          Không đọc được: {loi}
        </div>
      )}

      {/* Thanh lọc & tìm kiếm */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setTrang(1); }}
          placeholder="Tìm nhanh: mã tin, đường, phường, giá, mô tả, người bán…"
          className={`${o} min-w-0 flex-1 px-4`}
        />
        <select value={deal} onChange={(e) => { setDeal(e.target.value as typeof deal); setTrang(1); }} className={o}>
          <option value="">Tất cả (Bán + Thuê)</option>
          <option value="ban">Chỉ Bán</option>
          <option value="cho_thue">Chỉ Cho thuê</option>
        </select>
        <select value={trangThai} onChange={(e) => { setTrangThai(e.target.value); setTrang(1); }} className={o}>
          <option value="">Mọi trạng thái</option>
          {Object.entries(TRANG_THAI).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Bảng dữ liệu Rổ Hàng có Sửa trực tiếp */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 border-b border-line">
            <tr className="text-xs uppercase tracking-wide text-mute">
              {COT.map((c) => (
                <th key={c.key} className="px-3 py-3 font-semibold">
                  {c.sap ? (
                    <button type="button" onClick={() => bamCot(c.key)} className="hover:text-brand flex items-center gap-1">
                      <span>{c.ten}</span>
                      <span className="text-brand font-bold">{sap.key === c.key ? (sap.tang ? "↑" : "↓") : ""}</span>
                    </button>
                  ) : (
                    c.ten
                  )}
                </th>
              ))}
              <th className="px-3 py-3 font-semibold text-center sticky right-0 bg-slate-50 shadow-l">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {mot.map((d) => {
              const moTaFull = COT[5].lay(d);
              const daMo = mo.has(d.id);
              const daMoJson = moJson.has(d.id);

              return (
                <Fragment key={d.id}>
                <tr className="align-top hover:bg-slate-50/80 transition">
                  {COT.map((c) => {
                    // Cột mô tả
                    if (c.key === "mo_ta") {
                      return (
                        <td key={c.key} className="max-w-[26rem] px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setMo((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}
                            className="text-left text-navy/85 hover:text-navy"
                            title={daMo ? "thu gọn" : "bấm để xem đủ"}
                          >
                            {daMo || moTaFull.length <= 130 ? moTaFull : moTaFull.slice(0, 130) + "…"}
                          </button>
                        </td>
                      );
                    }

                    // Cột mã tin
                    if (c.key === "ma" && d.code) {
                      return (
                        <td key={c.key} className="whitespace-nowrap px-3 py-3 tabular-nums font-bold">
                          <Link href={`/nha-dat/${encodeURIComponent(d.code)}`} target="_blank" className="text-brand hover:underline">
                            #{d.code}
                          </Link>
                          {d.legacy_code && d.legacy_code !== d.code && (
                            <span className="text-mute block text-[11px] font-normal">({d.legacy_code})</span>
                          )}
                        </td>
                      );
                    }

                    // Cột trạng thái: Dropdown đổi trạng thái nhanh tại chỗ
                    if (c.key === "trang_thai") {
                      return (
                        <td key={c.key} className="whitespace-nowrap px-3 py-3">
                          <select
                            value={d.status}
                            onChange={(e) => doiTrangThaiNhanh(d.id, e.target.value)}
                            className={`rounded-full px-2.5 py-1 text-xs font-bold border outline-none cursor-pointer transition ${
                              MAU_TRANG_THAI[d.status] ?? "bg-slate-100 text-mute border-slate-300"
                            }`}
                            title="Bấm để đổi nhanh trạng thái"
                          >
                            {Object.entries(TRANG_THAI).map(([val, label]) => (
                              <option key={val} value={val} className="bg-white text-navy font-medium">
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    }

                    // Cột giá
                    if (c.key === "gia") {
                      return (
                        <td key={c.key} className="whitespace-nowrap px-3 py-3 tabular-nums font-bold text-navy">
                          {c.lay(d)}
                        </td>
                      );
                    }

                    // Cột vị trí
                    if (c.key === "vi_tri") {
                      return (
                        <td key={c.key} className="max-w-[18rem] px-3 py-3 text-navy font-medium">
                          {c.lay(d)}
                        </td>
                      );
                    }

                    return (
                      <td key={c.key} className="whitespace-nowrap px-3 py-3 tabular-nums text-navy/80">
                        {c.lay(d)}
                      </td>
                    );
                  })}

                  {/* Cột nút thao tác */}
                  <td className="whitespace-nowrap px-3 py-3 text-center sticky right-0 bg-white/95-xs">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => moSua(d)}
                        className="rounded-md bg-brand/10 border border-brand/30 px-3 py-1 text-xs font-bold text-brand hover:bg-brand hover:text-white transition"
                        title="Chỉnh sửa thông tin tin này"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => setMoJson((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}
                        className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${daMoJson ? "border-navy bg-navy text-white" : "border-line text-mute hover:text-navy hover:border-slate-400"}`}
                        title="JSON bóc tách chia nhóm của tin này (FR-187)"
                      >
                        JSON
                      </button>
                      {d.code && (
                        <Link
                          href={`/nha-dat/${encodeURIComponent(d.code)}`}
                          target="_blank"
                          className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-mute hover:text-navy hover:border-slate-400 transition"
                          title="Xem trang hiển thị công khai"
                        >
                          Xem
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
                {daMoJson && <DongJson id={d.id} ma={d.code} cot={COT.length + 1} />}
                </Fragment>
              );
            })}
            {mot.length === 0 && (
              <tr>
                <td colSpan={COT.length + 1} className="px-3 py-12 text-center text-mute font-medium">
                  Không có tin nào khớp với bộ lọc tìm kiếm.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Phân trang */}
      {soTrang > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={t <= 1}
            onClick={() => setTrang(t - 1)}
            className="rounded-md border border-line px-4 py-1.5 font-semibold text-navy hover:border-brand hover:text-brand disabled:opacity-40 bg-white"
          >
            Trước
          </button>
          <span className="text-mute tabular-nums font-medium">trang {t}/{soTrang} · {MOI_TRANG} tin mỗi trang</span>
          <button
            type="button"
            disabled={t >= soTrang}
            onClick={() => setTrang(t + 1)}
            className="rounded-md border border-line px-4 py-1.5 font-semibold text-navy hover:border-brand hover:text-brand disabled:opacity-40 bg-white"
          >
            Sau -
          </button>
        </div>
      )}

      {/* ════ MODAL CHỈNH SỬA TRỰC TIẾP TIN BĐS ════ */}
      {dangSua && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4-xs animate-in fade-in">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-line max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-lg font-bold text-navy flex items-center gap-2">
                  <span>Chỉnh sửa BĐS:</span>
                  <span className="text-brand font-mono">#{dangSua.code}</span>
                </h3>
                <p className="text-xs text-mute mt-0.5">
                  Cập nhật trực tiếp vào cơ sở dữ liệu rổ hàng AI Ơi Nhà Đất
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDangSua(null)}
                className="text-mute hover:text-navy text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 text-xs">
              {/* Giao dịch */}
              <div>
                <label className="block font-bold text-navy mb-1">Giao dịch</label>
                <select
                  value={formSua.deal}
                  onChange={(e) => setFormSua({ ...formSua, deal: e.target.value as "ban" | "cho_thue" })}
                  className="w-full rounded-lg border border-line p-2 text-sm font-semibold bg-white"
                >
                  <option value="ban">Bán</option>
                  <option value="cho_thue">Cho thuê</option>
                </select>
              </div>

              {/* Trạng thái */}
              <div>
                <label className="block font-bold text-navy mb-1">Trạng thái</label>
                <select
                  value={formSua.status}
                  onChange={(e) => setFormSua({ ...formSua, status: e.target.value })}
                  className="w-full rounded-lg border border-line p-2 text-sm font-semibold bg-white"
                >
                  {Object.entries(TRANG_THAI).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Loại BĐS */}
              <div>
                <label className="block font-bold text-navy mb-1">Loại BĐS</label>
                <select
                  value={formSua.property_type}
                  onChange={(e) => setFormSua({ ...formSua, property_type: e.target.value })}
                  className="w-full rounded-lg border border-line p-2 text-sm font-semibold bg-white"
                >
                  {/* 20260909i: lấy từ TYPE_LABEL — bản cũ chép tay có `can_ho` không tồn tại trong enum (lưu là lỗi 22P02). */}
                  <option value="chua_ro">Chưa rõ</option>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 text-xs border-t border-line/60 pt-3">
              {/* Giá hiển thị */}
              <div>
                <label className="block font-bold text-navy mb-1">Giá hiển thị (chữ)</label>
                <input
                  value={formSua.price_raw}
                  onChange={(e) => setFormSua({ ...formSua, price_raw: e.target.value })}
                  placeholder="Vd: 7 tỷ, 12 tỷ, 15 tr/th"
                  className="w-full rounded-lg border border-line p-2 text-sm font-bold text-brand"
                />
              </div>

              {/* Giá số VNĐ */}
              <div>
                <label className="block font-bold text-navy mb-1">Giá VNĐ (số)</label>
                <input
                  type="number"
                  value={formSua.price_vnd}
                  onChange={(e) => setFormSua({ ...formSua, price_vnd: e.target.value })}
                  placeholder="Vd: 7000000000"
                  className="w-full rounded-lg border border-line p-2 text-sm font-mono"
                />
              </div>

              {/* Diện tích */}
              <div>
                <label className="block font-bold text-navy mb-1">Diện tích (m²)</label>
                <input
                  type="number"
                  step="any"
                  value={formSua.area_m2}
                  onChange={(e) => setFormSua({ ...formSua, area_m2: e.target.value })}
                  placeholder="Vd: 66 hoặc 72"
                  className="w-full rounded-lg border border-line p-2 text-sm font-bold"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4 text-xs border-t border-line/60 pt-3">
              <div>
                <label className="block font-bold text-navy mb-1">Ngang (m)</label>
                <input
                  value={formSua.frontage_m}
                  onChange={(e) => setFormSua({ ...formSua, frontage_m: e.target.value })}
                  placeholder="Vd: 6"
                  className="w-full rounded-lg border border-line p-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-navy mb-1">Dài (m)</label>
                <input
                  value={formSua.length_m}
                  onChange={(e) => setFormSua({ ...formSua, length_m: e.target.value })}
                  placeholder="Vd: 11 hoặc 12"
                  className="w-full rounded-lg border border-line p-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-navy mb-1">Số tầng (tấm)</label>
                <input
                  type="number"
                  value={formSua.floors}
                  onChange={(e) => setFormSua({ ...formSua, floors: e.target.value })}
                  placeholder="Vd: 2 hoặc 5"
                  className="w-full rounded-lg border border-line p-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-navy mb-1">Số phòng ngủ</label>
                <input
                  type="number"
                  value={formSua.bedrooms}
                  onChange={(e) => setFormSua({ ...formSua, bedrooms: e.target.value })}
                  placeholder="Vd: 3 hoặc 5"
                  className="w-full rounded-lg border border-line p-2 text-sm"
                />
              </div>
            </div>

            {/* Vị trí chi tiết */}
            <div className="space-y-3 border-t border-line/60 pt-3 text-xs">
              <div>
                <label className="block font-bold text-navy mb-1">Địa chỉ / Vị trí chi tiết (hiển thị)</label>
                <input
                  value={formSua.location_raw}
                  onChange={(e) => setFormSua({ ...formSua, location_raw: e.target.value })}
                  placeholder="Vd: Bùi Tư Toàn, Phường An Lạc, Bình Tân"
                  className="w-full rounded-lg border border-line p-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-bold text-navy mb-1">Đường</label>
                  <input
                    value={formSua.street}
                    onChange={(e) => setFormSua({ ...formSua, street: e.target.value })}
                    placeholder="Vd: Đường Bùi Tư Toàn"
                    className="w-full rounded-lg border border-line p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-navy mb-1">Phường / Xã</label>
                  <input
                    value={formSua.ward}
                    onChange={(e) => setFormSua({ ...formSua, ward: e.target.value })}
                    placeholder="Vd: Phường An Lạc"
                    className="w-full rounded-lg border border-line p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-navy mb-1">Quận / Huyện / Tỉnh</label>
                  <input
                    value={formSua.district}
                    onChange={(e) => setFormSua({ ...formSua, district: e.target.value })}
                    placeholder="Vd: Bình Tân hoặc Quận 5"
                    className="w-full rounded-lg border border-line p-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Nội dung mô tả */}
            <div className="border-t border-line/60 pt-3 text-xs">
              <label className="block font-bold text-navy mb-1">Nội dung mô tả BĐS</label>
              <textarea
                rows={4}
                value={formSua.description}
                onChange={(e) => setFormSua({ ...formSua, description: e.target.value })}
                placeholder="Nhập nội dung mô tả tin rao..."
                className="w-full rounded-lg border border-line p-2 text-sm"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => xoaTin(dangSua.id, dangSua.code)}
                className="rounded-md border border-red-200 px-4 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 hover:border-red-300 transition"
              >
                Xoá tin này
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDangSua(null)}
                  className="rounded-md border border-line px-5 py-2 text-xs font-bold text-mute hover:text-navy transition"
                >
                  Huỷ bỏ
                </button>
                <button
                  type="button"
                  onClick={luuSua}
                  disabled={dangLuu}
                  className="rounded-md bg-brand px-6 py-2 text-sm font-bold text-white hover:bg-brand-dark transition disabled:opacity-60"
                >
                  {dangLuu ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
