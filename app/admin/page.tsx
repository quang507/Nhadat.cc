"use client";
// Admin (FR-127): duyệt tin cho_thong_tin → dang_ban / ẩn (an) theo vòng đời
// FR-139 (cho_thong_tin → dang_ban → dang_quan_tam → da_chot). Quyền cấp theo
// bảng `admins` (email) — RLS phía DB mới là hàng rào thật, trang này chỉ là UI.
//
// 04/09/2026 — "admin buyer side" (FR-71/74/75/76/77/78/80, migration
// 20260904c): câu khách hỏi, lịch xem nhà, khách cần người thật, thống kê hội
// thoại 30 ngày + CSV, ô tìm khách. Mọi danh sách dài lật 20 mục/trang (FR-80).
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { supabase, type Listing } from "@/lib/supabase";
import { formatArea, formatPrice, sanitizeDescription } from "@/lib/format";
import UploadAnh from "@/components/UploadAnh";

// Tin chờ duyệt: chỉ các cột thẻ duyệt cần, không kéo "*".
type TinCho = Pick<
  Listing,
  "id" | "code" | "ward" | "price_vnd" | "price_raw" | "area_m2" | "description" | "location_raw" | "created_at"
>;

type Ng = {
  id: string;
  name: string | null;
  seller_type: string;
  active_count: number;
  closed_count: number;
  rank: string;
};

type Tien = {
  day: string;
  model_calls: number;
  in_tokens: number;
  out_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
};

// Giá niêm yết Opus 5, đô trên MỘT TRIỆU chữ-máy. Để thành hằng số ở đây, không
// nhét vào DB: giá đổi thì sửa một chỗ này, còn số chữ đã ghi trong DB vẫn đúng
// mãi mãi. Ngược lại — lưu sẵn thành tiền trong DB — là để lại một cột số sai mà
// không ai biết là nó đã sai từ lúc nào.
const GIA_VAO = 5;
const GIA_RA = 25;
const HE_SO_NAP = 2; // nhịp nhớ tạm 1 giờ; xem chat-reply chỗ cache_control
const HE_SO_DOC = 0.1;

const tienNgay = (t: Tien) =>
  (t.in_tokens * GIA_VAO +
    t.out_tokens * GIA_RA +
    t.cache_write_tokens * GIA_VAO * HE_SO_NAP +
    t.cache_read_tokens * GIA_VAO * HE_SO_DOC) / 1_000_000;

type Viec = { id: string; kind: string; note: string | null; due_at: string; created_at: string };
type NguoiBan = {
  id: string; name: string | null; seller_type: string; created_at: string; zalo_user_id: string | null;
};
const NHAN: Record<string, string> = { ccrb: "Chính chủ · 1%", nmg: "Môi giới · 0,5%", unknown: "Chưa nhãn" };

const HANG: Record<string, { ten: string; lop: string }> = {
  vang: { ten: "Vàng", lop: "bg-[#f6c453] text-navy" },
  bac:  { ten: "Bạc",  lop: "bg-line text-navy" },
  dong: { ten: "Đồng", lop: "bg-[#e2c9b0] text-navy" },
  chua_du: { ten: "Chưa đủ dữ liệu", lop: "bg-line text-mute" },
};

// FR-173 e: hạng CTV theo tỷ lệ trả lời câu khách hỏi đúng hạn (view `ctv_ranks`).
type HangCtv = {
  id: string; name: string | null; active: boolean;
  tong: number; tra_loi: number; dung_han: number; tre: number;
  ty_le_dung_han: number | null; rank: string;
};

// ── Admin buyer side (04/09/2026) ────────────────────────────────────────────
// FR-76: câu khách hỏi đang chờ / vừa được trả lời. `listings(code)`, `ctvs(name)`,
// `buyers(name)` là join qua FK của PostgREST — mỗi cái là MỘT object (hoặc null).
type CauHoi = {
  id: string; question: string; status: string; answer: string | null; source: string | null;
  assignee: string | null; sla_due_at: string | null; answered_at: string | null; created_at: string;
  listings: { code: string | null } | null;
  ctvs: { name: string | null } | null;
  buyers: { name: string | null } | null;
};
// FR-78: lịch xem nhà. `listing_code` là mã tin khách gõ khi tin chưa neo được
// vào `listing_id` (viewings_can_neo_check) — hiện cái nào có.
type LichXem = {
  id: string; listing_code: string | null; time_text: string | null; slot: string | null;
  status: string; guide: string | null; source: string | null; created_at: string;
  listings: { code: string | null } | null;
  buyers: { name: string | null } | null;
};
// FR-77: view `khach_can_nguoi_that` — cờ needs_human chưa có người thật chạm.
type KhachCan = {
  conversation_id: string; vai: string; ten: string | null; zalo_user_id: string | null;
  needs_human_at: string; last_message_at: string | null; ctv_name: string | null;
  tin_khach_cuoi: string | null; tin_khach_cuoi_at: string | null;
};
// FR-71: view `hoi_thoai_thong_ke` — 30 dòng, mỗi ngày một dòng (giờ VN).
type ThongKe = {
  ngay: string; hoi_thoai_khach_moi: number; hoi_thoai_ban_moi: number;
  tin_khach: number; tin_nguoi_ban: number; tin_bot: number; tin_nguoi_that: number;
  khach_moi: number; co_nguoi_that: number;
};
const COT_THONG_KE: (keyof ThongKe)[] = [
  "ngay", "hoi_thoai_khach_moi", "hoi_thoai_ban_moi", "tin_khach", "tin_nguoi_ban",
  "tin_bot", "tin_nguoi_that", "khach_moi", "co_nguoi_that",
];
// FR-74 & CRM: Hồ sơ khách hàng hai vai (Vừa mua vừa bán · Gắn BĐS quan tâm)
type KhachCrm = {
  id: string;
  name: string | null;
  zalo_user_id: string | null;
  preferences: Record<string, unknown> | null;
  notes: string | null;
  last_contact_at: string | null;
  created_at: string;
  seller?: {
    id: string;
    seller_type: string;
    active_listing?: {
      id: string;
      code: string | null;
      legacy_code: string | null;
      location_raw: string | null;
      price_raw: string | null;
      status: string | null;
    } | null;
  } | null;
  interests?: {
    listing_id: string;
    code: string | null;
    legacy_code: string | null;
    price_raw: string | null;
    location_raw: string | null;
  }[];
};
const TRANG_THAI_HOI: Record<string, string> = { pending: "đang chờ", answered: "đã trả lời" };
const TRANG_THAI_XEM: Record<string, string> = {
  proposed: "đề xuất", pending: "đã hẹn", done: "đã xem", cancelled: "đã huỷ",
};
const NGUOI_GIAO: Record<string, string> = { ctv: "CTV", seller: "chủ nhà", admin: "admin" };

// 04/09/2026 đợt 2 (FR-70/73, FR-96, FR-100, NFR-06):
// FR-73: view `bds_hot` — số sự kiện 60 ngày theo tin (agent SQL dựng; thiếu
// view thì thẻ nói "chưa có dữ liệu", trang không vỡ).
type BdsHot = { listing_id: string; code: string | null; ward: string | null; so_su_kien_60d: number; last_event_at: string | null };
// Độ trễ bot 7 ngày — view `bot_do_tre` (cùng cách). Cột thật đo bằng GIÂY
// (`p50_giay`, `p95_giay`, `max_giay`, `so_luot`), web đổi sang ms để so mốc NFR-01.
type DoTre = { so_luot: number | null; p50_giay: number | null; p95_giay: number | null; max_giay: number | null };
// NFR-06: media ở bucket riêng (sổ đỏ/giấy tờ) — chỉ hiện MÃ TIN + loại; đường
// dẫn không bao giờ in ra trang, chỉ dùng để ký URL 15 phút khi admin bấm.
type GiayTo = { id: string; listing_id: string; storage_path: string; media_type: string; mime_type: string; created_at: string; listings: { code: string | null } | null };

// FR-80: mọi danh sách admin 20 mục/trang. Phân trang phía client — dữ liệu đã
// tải trong một đợt, lật trang không tốn thêm truy vấn.
const MOI_TRANG = 20;
function usePhanTrang<T>(xs: T[]) {
  const [trang, setTrang] = useState(1);
  const soTrang = Math.max(1, Math.ceil(xs.length / MOI_TRANG));
  // Danh sách co lại (duyệt tin xong) thì kẹp về trang cuối còn tồn tại.
  const t = Math.min(trang, soTrang);
  return { trang: t, soTrang, tong: xs.length, setTrang, mot: xs.slice((t - 1) * MOI_TRANG, t * MOI_TRANG) };
}

// FR-75: link mở Zalo theo uid — BEST-EFFORT. uid Zalo cá nhân đi qua bridge
// (zca) không phải là số/alias công khai, `zalo.me/<uid>` có thể không mở
// được; uid từ OA lại là uid ẩn danh theo app. Vẫn để link vì rẻ, và là cái
// gần nhất với "click nhảy sang Zalo" mà không cần thêm hạ tầng.
const linkZalo = (uid: string | null) => (uid ? `https://zalo.me/${encodeURIComponent(uid)}` : null);

export default function Page() {
  const [role, setRole] = useState<"loading" | "anon" | "user" | "admin">("loading");
  const [pending, setPending] = useState<TinCho[]>([]);
  const [counts, setCounts] = useState<{ tong: number; active: number; cho: number }>();
  // FR-152: sức khoẻ bot. Đọc THẲNG từ DB bằng phiên admin — cố tình KHÔNG đi
  // qua bridge, vì còi báo "bridge chết" mà lại gửi bằng bridge thì vô nghĩa.
  const [health, setHealth] = useState<{
    beat: string | null;
    errs: { id: number; at: string; source: string; status_code: number | null; detail: string | null }[];
  }>();
  // FR-155: hạng người rao. CHỈ hiện ở đây, không hiện trên web (OPEN-26 —
  // quyết định chủ dự án 27/08/2026). Chưa ai chốt được căn nào nên chưa ai lên
  // Vàng được; đưa ra trước mặt khách lúc này là dựng thang bịt bậc trên cùng.
  const [hang, setHang] = useState<Ng[]>([]);
  // Tiền bộ não (migration 20260901b). Đếm LƯỢT không trả lời được câu "scale
  // lên có chịu nổi không" — tiền tính theo CHỮ, và bốn loại chữ lệch giá tới
  // 50 lần. Đây là chỗ đọc số thật thay vì ước tính.
  const [tien, setTien] = useState<Tien[]>([]);
  // 02/09 — "hiện thông báo cho admin". Đường cũ là hàng escalation đi qua
  // bridge tới Zalo admin; bridge chết từ 27/08 nên 85 việc xếp hàng không ai
  // thấy. Đọc THẲNG bảng ở đây, đóng việc ngay tại chỗ.
  const [viec, setViec] = useState<Viec[]>([]);
  // Người bán mới 14 ngày: nhãn bot gán lúc bóc tách — sai thì đổi ở đây.
  const [nguoiBan, setNguoiBan] = useState<NguoiBan[]>([]);
  // FR-173 e (03/09): CTV nhận câu khách hỏi, trễ hạn thì rớt hạng — xem ở đây.
  const [hangCtv, setHangCtv] = useState<HangCtv[]>([]);
  // Admin buyer side (04/09) — bốn danh sách + thống kê, cùng đợt tải.
  const [cauHoi, setCauHoi] = useState<CauHoi[]>([]);
  const [lichXem, setLichXem] = useState<LichXem[]>([]);
  const [khachCan, setKhachCan] = useState<KhachCan[]>([]);
  const [thongKe, setThongKe] = useState<ThongKe[]>([]);
  // Lỗi đọc: hiện ra UI thay vì nuốt — policy thiếu thì thấy ngay ở đây.
  const [loi, setLoi] = useState<string[]>([]);
  // CRM Khách hàng & Hai vai (Vừa mua vừa bán · Gắn BĐS quan tâm · Nhu cầu)
  const [danhSachCrm, setDanhSachCrm] = useState<KhachCrm[]>([]);
  const [qCrm, setQCrm] = useState("");
  const [dangGanBds, setDangGanBds] = useState<string | null>(null);
  const [maBdsGan, setMaBdsGan] = useState("");
  const [dangLuuBds, setDangLuuBds] = useState(false);
  const [suaNhuCauId, setSuaNhuCauId] = useState<string | null>(null);
  const [formNhuCau, setFormNhuCau] = useState({
    area: "",
    property_type: "",
    deal: "ban",
    bedrooms: "",
    budget: "",
    notes: "",
  });

  // 04/09 đợt 2
  const [bdsHot, setBdsHot] = useState<BdsHot[] | null>(null);
  const [doTre, setDoTre] = useState<DoTre | null | undefined>(undefined);
  const [giayTo, setGiayTo] = useState<GiayTo[]>([]);
  const [loiPhu, setLoiPhu] = useState<Record<string, string>>({});
  // FR-100: tạo danh sách riêng — nhập mã tin cách nhau bởi dấu phẩy + tiêu đề.
  const [dsMa, setDsMa] = useState("");
  const [dsTieuDe, setDsTieuDe] = useState("");
  const [dsKq, setDsKq] = useState<{ ok: boolean; text: string; path?: string } | null>(null);
  const [dangTaoDs, setDangTaoDs] = useState(false);
  const [daChep, setDaChep] = useState(false);
  // FR-96: up ảnh cho một tin chờ duyệt ngay tại thẻ duyệt.
  const [upCho, setUpCho] = useState<string | null>(null);

  // Lọc CRM phía client
  const filteredCrm = useMemo(() => {
    if (!qCrm.trim()) return danhSachCrm;
    const q = qCrm.toLowerCase().trim();
    return danhSachCrm.filter((k) => {
      const name = (k.name ?? "").toLowerCase();
      const zalo = (k.zalo_user_id ?? "").toLowerCase();
      const notes = (k.notes ?? "").toLowerCase();
      const p = k.preferences ?? {};
      const area = String(p.area ?? "").toLowerCase();
      const ptype = String(p.property_type ?? "").toLowerCase();
      const sellCode = (k.seller?.active_listing?.code ?? "").toLowerCase();
      const intCodes = (k.interests ?? []).map((i) => (i.code ?? "").toLowerCase()).join(" ");
      return (
        name.includes(q) ||
        zalo.includes(q) ||
        notes.includes(q) ||
        area.includes(q) ||
        ptype.includes(q) ||
        sellCode.includes(q) ||
        intCodes.includes(q)
      );
    });
  }, [danhSachCrm, qCrm]);

  // FR-80 — hook phân trang phải đứng TRƯỚC mọi `return` sớm theo `role`.
  const ptTin = usePhanTrang(pending);
  const ptNguoiBan = usePhanTrang(nguoiBan);
  const ptCauHoi = usePhanTrang(cauHoi);
  const ptLichXem = usePhanTrang(lichXem);
  const ptKhachCan = usePhanTrang(khachCan);
  const ptThongKe = usePhanTrang(thongKe);
  const ptCrm = usePhanTrang(filteredCrm);

  // MỘT đợt cho cả trang (FR-171 j). Trước bản này là 5 đợt nối tiếp (12 truy
  // vấn), mỗi đợt một lần thời gian mạng VN→Supabase ~150-250 ms, tức 1-1,5 s
  // trước khi có số. Không truy vấn nào ở đây cần kết quả của truy vấn khác.
  // Ba lần `count: exact` trên `listings` (3 lần quét bảng) thay bằng MỘT lượt
  // đọc cột `status` rồi đếm tại chỗ — kho ~200 dòng, rẻ hơn ba lần quét.
  // 04/09: thêm 4 truy vấn buyer side vào CÙNG đợt, vẫn một vòng đi về.
  const load = async () => {
    const d7 = new Date(Date.now() - 7 * 86400e3).toISOString();
    const [pend, st, beatRes, errRes, tn, vc, nb, hg, hc, ch, lx, kc, tk, hot, tre, gt, buyRes, intRes] = await Promise.all([
      supabase
        .from("listings")
        .select("id, code, ward, price_vnd, price_raw, area_m2, description, location_raw, created_at")
        .eq("status", "cho_thong_tin")
        .order("created_at", { ascending: false }).limit(50),
      supabase.from("listings").select("status"),
      supabase.from("bot_health").select("at").eq("who", "bridge-zca").maybeSingle(),
      supabase.from("bot_errors").select("id, at, source, status_code, detail")
        .order("at", { ascending: false }).limit(10),
      supabase
        .from("bot_usage")
        .select("day, model_calls, in_tokens, out_tokens, cache_write_tokens, cache_read_tokens")
        .order("day", { ascending: false }).limit(7),
      supabase.from("reminders")
        .select("id, kind, note, due_at, created_at")
        .eq("status", "pending").in("kind", ["escalation", "report"])
        .order("due_at", { ascending: true }).limit(30),
      supabase.from("sellers")
        .select("id, name, seller_type, created_at, zalo_user_id, active_listing_id, listings:active_listing_id(id, code, legacy_code, location_raw, price_raw, status)")
        .order("created_at", { ascending: false }).limit(100),
      supabase
        .from("seller_ranks")
        .select("id, name, seller_type, active_count, closed_count, rank")
        .order("active_count", { ascending: false }).limit(50),
      supabase
        .from("ctv_ranks")
        .select("id, name, active, tong, tra_loi, dung_han, tre, ty_le_dung_han, rank")
        .order("name").limit(20),
      // FR-76 — câu khách hỏi: đang chờ + vừa trả lời, mới nhất trước.
      supabase
        .from("info_requests")
        .select("id, question, status, answer, source, assignee, sla_due_at, answered_at, created_at, listings(code), ctvs(name), buyers(name)")
        .in("status", ["pending", "answered"])
        .order("created_at", { ascending: false }).limit(100),
      // FR-78 — lịch xem: sắp tới + 7 ngày qua; lịch chưa có giờ máy (chỉ
      // `time_text`) thì lấy theo ngày tạo trong 7 ngày.
      supabase
        .from("viewings")
        .select("id, listing_code, time_text, slot, status, guide, source, created_at, listings(code), buyers(name)")
        .or(`slot.gte.${d7},and(slot.is.null,created_at.gte.${d7})`)
        .order("slot", { ascending: true, nullsFirst: false }).limit(100),
      // FR-77 — view gác cổng admin (20260904c).
      supabase
        .from("khach_can_nguoi_that")
        .select("conversation_id, vai, ten, zalo_user_id, needs_human_at, last_message_at, ctv_name, tin_khach_cuoi, tin_khach_cuoi_at")
        .order("needs_human_at", { ascending: true }).limit(100),
      // FR-71 — view 30 ngày, ngày mới nhất trước.
      supabase
        .from("hoi_thoai_thong_ke")
        .select("ngay, hoi_thoai_khach_moi, hoi_thoai_ban_moi, tin_khach, tin_nguoi_ban, tin_bot, tin_nguoi_that, khach_moi, co_nguoi_that")
        .order("ngay", { ascending: false }),
      // FR-73 — view `bds_hot` (gác cổng admin). Lỗi (chưa có view) → thẻ báo.
      supabase.from("bds_hot").select("listing_id, code, ward, so_su_kien_60d, last_event_at")
        .order("so_su_kien_60d", { ascending: false }).limit(20),
      // Độ trễ bot 7 ngày — view `bot_do_tre`.
      supabase.from("bot_do_tre").select("so_luot, p50_giay, p95_giay, max_giay").maybeSingle(),
      // NFR-06 — giấy tờ ở bucket riêng (policy `listing_media_admin_all`).
      supabase.from("listing_media")
        .select("id, listing_id, storage_path, media_type, mime_type, created_at, listings(code)")
        .eq("bucket", "listing-private").order("created_at", { ascending: false }).limit(100),
      // CRM: người mua & BĐS quan tâm
      supabase
        .from("buyers")
        .select("id, name, zalo_user_id, preferences, notes, last_contact_at, created_at")
        .order("created_at", { ascending: false }).limit(100),
      supabase
        .from("interests")
        .select("buyer_id, listing_id, listings(id, code, legacy_code, location_raw, price_raw, status)"),
    ]);
    setBdsHot(hot.error ? null : ((hot.data ?? []) as BdsHot[]));
    setDoTre(tre.error ? null : ((tre.data as DoTre | null) ?? null));
    setGiayTo((gt.data ?? []) as unknown as GiayTo[]);
    setLoiPhu({
      ...(hot.error ? { bds_hot: hot.error.message } : {}),
      ...(tre.error ? { bot_do_tre: tre.error.message } : {}),
      ...(gt.error ? { giay_to: gt.error.message } : {}),
    });
    setHangCtv((hc.data ?? []) as HangCtv[]);
    setPending((pend.data ?? []) as TinCho[]);
    const trangThai = (st.data ?? []).map((r) => r.status as string);
    setCounts({
      tong: trangThai.length,
      active: trangThai.filter((s) => s === "dang_ban" || s === "dang_quan_tam").length,
      cho: trangThai.filter((s) => s === "cho_thong_tin").length,
    });
    setHealth({ beat: (beatRes.data?.at as string) ?? null, errs: errRes.data ?? [] });
    setTien((tn.data ?? []) as Tien[]);
    setViec((vc.data ?? []) as Viec[]);
    setNguoiBan((nb.data ?? []) as NguoiBan[]);
    setHang((hg.data ?? []) as Ng[]);
    setCauHoi((ch.data ?? []) as unknown as CauHoi[]);
    setLichXem((lx.data ?? []) as unknown as LichXem[]);
    setKhachCan((kc.data ?? []) as KhachCan[]);
    setThongKe((tk.data ?? []) as ThongKe[]);

    // Xử lý danh sách CRM khách hàng hai vai & gắn BĐS quan tâm
    const rawBuyers = (buyRes.data ?? []) as any[];
    const rawSellers = (nb.data ?? []) as any[];
    const rawInterests = (intRes.data ?? []) as any[];

    const crmItems: KhachCrm[] = [];
    const seenZalo = new Set<string>();

    for (const b of rawBuyers) {
      if (b.zalo_user_id) seenZalo.add(b.zalo_user_id);
      const s = b.zalo_user_id ? rawSellers.find((x) => x.zalo_user_id === b.zalo_user_id) : null;
      const bInts = rawInterests
        .filter((i) => i.buyer_id === b.id)
        .map((i) => ({
          listing_id: i.listing_id,
          code: i.listings?.code ?? null,
          legacy_code: i.listings?.legacy_code ?? null,
          price_raw: i.listings?.price_raw ?? null,
          location_raw: i.listings?.location_raw ?? null,
        }));

      crmItems.push({
        id: b.id,
        name: b.name || s?.name || null,
        zalo_user_id: b.zalo_user_id,
        preferences: b.preferences,
        notes: b.notes,
        last_contact_at: b.last_contact_at,
        created_at: b.created_at,
        seller: s
          ? {
              id: s.id,
              seller_type: s.seller_type,
              active_listing: s.listings ?? null,
            }
          : null,
        interests: bInts,
      });
    }

    for (const s of rawSellers) {
      if (s.zalo_user_id && seenZalo.has(s.zalo_user_id)) continue;
      crmItems.push({
        id: s.id,
        name: s.name,
        zalo_user_id: s.zalo_user_id,
        preferences: null,
        notes: null,
        last_contact_at: null,
        created_at: s.created_at,
        seller: {
          id: s.id,
          seller_type: s.seller_type,
          active_listing: s.listings ?? null,
        },
        interests: [],
      });
    }
    setDanhSachCrm(crmItems);

    setLoi(
      [["câu hỏi", ch.error], ["lịch xem", lx.error], ["khách cần người thật", kc.error], ["thống kê", tk.error], ["người mua", buyRes.error]]
        .filter(([, e]) => e)
        .map(([ten, e]) => `${ten as string}: ${(e as { message: string }).message}`),
    );
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

  // Đóng một việc chờ: đánh dấu đã gửi (admin đã đọc ở đây thay vì qua Zalo).
  const dongViec = async (id: string) => {
    const { error } = await supabase.from("reminders")
      .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);
    if (!error) setViec((v) => v.filter((x) => x.id !== id));
  };
  // Đổi nhãn người bán. RLS phía DB (sellers_admin_update) mới là hàng rào.
  const doiNhan = async (id: string, seller_type: "ccrb" | "nmg") => {
    const { error } = await supabase.from("sellers").update({ seller_type }).eq("id", id);
    if (!error) setNguoiBan((l) => l.map((s) => (s.id === id ? { ...s, seller_type } : s)));
  };

  const setStatus = async (id: string, status: "dang_ban" | "an") => {
    const { error } = await supabase.from("listings").update({ status }).eq("id", id);
    if (!error) setPending((p) => p.filter((l) => l.id !== id));
  };

  const xoaTin = async (id: string, code: string | null) => {
    if (!confirm(`Xoá tin ${code ? `#${code}` : ""}?`)) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (!error) setPending((p) => p.filter((l) => l.id !== id));
    else alert(`Lỗi xoá: ${error.message}`);
  };

  // CRM: Gắn BĐS quan tâm cho khách
  const ganBdsQuanTam = async (buyerId: string) => {
    if (!maBdsGan.trim()) return;
    setDangLuuBds(true);
    const { data, error } = await supabase.rpc("admin_gan_bds_quan_tam", {
      p_buyer_id: buyerId,
      p_code: maBdsGan.trim(),
    });
    setDangLuuBds(false);
    if (error || (data && !data.ok)) {
      alert(error?.message || data?.error || "Lỗi gắn BĐS quan tâm");
    } else {
      setMaBdsGan("");
      setDangGanBds(null);
      load();
    }
  };

  // CRM: Gỡ BĐS quan tâm
  const xoaBdsQuanTam = async (buyerId: string, listingId: string) => {
    if (!confirm("Gỡ BĐS quan tâm này khỏi khách?")) return;
    const { error } = await supabase.rpc("admin_xoa_bds_quan_tam", {
      p_buyer_id: buyerId,
      p_listing_id: listingId,
    });
    if (error) alert(error.message);
    else load();
  };

  // CRM: Mở form sửa nhu cầu
  const moSuaNhuCau = (k: KhachCrm) => {
    const p = k.preferences ?? {};
    setSuaNhuCauId(k.id);
    setFormNhuCau({
      area: String(p.area ?? ""),
      property_type: String(p.property_type ?? ""),
      deal: String(p.deal ?? "ban"),
      bedrooms: p.bedrooms != null ? String(p.bedrooms) : "",
      budget: String(p.budget ?? ""),
      notes: k.notes ?? String(p.notes ?? ""),
    });
  };

  // CRM: Lưu cập nhật nhu cầu khách
  const luuSuaNhuCau = async (buyerId: string) => {
    const newPrefs: Record<string, unknown> = {};
    if (formNhuCau.area.trim()) newPrefs.area = formNhuCau.area.trim();
    if (formNhuCau.property_type.trim()) newPrefs.property_type = formNhuCau.property_type.trim();
    if (formNhuCau.deal.trim()) newPrefs.deal = formNhuCau.deal.trim();
    if (formNhuCau.bedrooms.trim()) newPrefs.bedrooms = Number(formNhuCau.bedrooms.trim()) || null;
    if (formNhuCau.budget.trim()) newPrefs.budget = formNhuCau.budget.trim();
    if (formNhuCau.notes.trim()) newPrefs.notes = formNhuCau.notes.trim();

    const { data, error } = await supabase.rpc("admin_cap_nhat_khach", {
      p_buyer_id: buyerId,
      p_preferences: newPrefs,
      p_notes: formNhuCau.notes.trim() || null,
    });
    if (error || (data && !data.ok)) {
      alert(error?.message || "Lỗi lưu nhu cầu khách");
    } else {
      setSuaNhuCauId(null);
      load();
    }
  };

  // FR-100 — tạo danh sách riêng qua RPC `tao_danh_sach` (kiểm admin dưới DB).
  const taoDs = async (e: FormEvent) => {
    e.preventDefault();
    const ma = dsMa.split(/[,\s;]+/).map((x) => x.trim()).filter(Boolean);
    if (!ma.length) return setDsKq({ ok: false, text: "Chưa có mã tin nào." });
    setDangTaoDs(true); setDsKq(null); setDaChep(false);
    const { data, error } = await supabase.rpc("tao_danh_sach", { p_listing_codes: ma, p_title: dsTieuDe || null });
    setDangTaoDs(false);
    if (error) return setDsKq({ ok: false, text: error.message });
    const r = data as { path: string; n: number; expires_at: string };
    setDsKq({ ok: true, path: r.path, text: `${r.n} tin · sống tới ${new Date(r.expires_at).toLocaleDateString("vi-VN")}` });
  };
  const chepLink = async (path: string) => {
    try { await navigator.clipboard.writeText(`${location.origin}${path}`); setDaChep(true); }
    catch { setDsKq((k) => (k ? { ...k, text: `${k.text} — không chép được, bôi đen link mà copy` } : k)); }
  };

  // NFR-06 — ký URL 15 phút (900 s) cho một file bucket riêng rồi mở tab mới.
  // Policy `storage_admin_private_all` cho admin SELECT object → ký được.
  const xemGiayTo = async (g: GiayTo) => {
    const { data, error } = await supabase.storage.from("listing-private").createSignedUrl(g.storage_path, 900);
    if (error || !data?.signedUrl) {
      setLoi((l) => [...l, `giấy tờ #${g.listings?.code ?? "?"}: ${error?.message ?? "không ký được URL"}`]);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  // FR-71 — CSV tạo ngay trên trình duyệt (NFR-11: xem ở Excel). BOM để Excel
  // đọc UTF-8; chưa có xuất Excel phía server.
  const taiCsv = () => {
    const dong = [
      COT_THONG_KE.join(","),
      ...thongKe.map((r) => COT_THONG_KE.map((c) => String(r[c])).join(",")),
    ];
    const blob = new Blob(["\uFEFF" + dong.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hoi-thoai-30-ngay-${new Date().toISOString().slice(0, 10)}.csv`;
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

  const now = Date.now();
  const tongTK = thongKe.reduce(
    (s, r) => ({
      hoi_thoai: s.hoi_thoai + r.hoi_thoai_khach_moi,
      tin_khach: s.tin_khach + r.tin_khach,
      tin_bot: s.tin_bot + r.tin_bot,
      tin_nguoi_that: s.tin_nguoi_that + r.tin_nguoi_that,
      khach_moi: s.khach_moi + r.khach_moi,
      co: s.co + r.co_nguoi_that,
    }),
    { hoi_thoai: 0, tin_khach: 0, tin_bot: 0, tin_nguoi_that: 0, khach_moi: 0, co: 0 },
  );

  // Việc đang chờ người thật. Đây là con số duy nhất đáng đặt lên đầu trang:
  // admin mở trang này để hỏi "có gì cần tao không?", không phải để ngắm số liệu.
  const cauHoiCho = cauHoi.filter((c) => c.status === "pending").length;
  const lichSapToi = lichXem.filter(
    (v) => v.slot && new Date(v.slot).getTime() >= now && v.status !== "cancelled",
  ).length;
  const canXuLy = pending.length + khachCan.length + cauHoiCho + viec.length;

  // Câu hỏi quá hạn SLA — đếm riêng vì nó khác "đang chờ": đã trễ hẹn với khách.
  const cauHoiQuaHan = cauHoi.filter(
    (c) => c.status === "pending" && !!c.sla_due_at && new Date(c.sla_due_at).getTime() < now,
  ).length;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-10">
      {/* ═══ Đầu trang: một câu trả lời cho "có gì cần tao không?" ═══ */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Quản trị</h1>
          <p className="mt-1 text-sm text-mute tabular-nums">
            {counts
              ? `${counts.tong} tin trong rổ · ${counts.active} đang rao · ${counts.cho} chờ duyệt`
              : "đang đọc rổ hàng…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* FR-175: rổ hàng đọc như Excel — bảng lọc/sắp/tải CSV, không cần vào Supabase */}
          <Link
            href="/admin/ro-hang"
            className="rounded-full border border-line px-5 py-2.5 text-sm font-bold text-navy transition hover:border-brand hover:text-brand active:scale-[0.98]"
          >
            Rổ hàng (như Excel)
          </Link>
          <Link
            href="/admin/dang-tin"
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark active:scale-[0.98]"
          >
            + Đăng tin thủ công
          </Link>
        </div>
      </header>

      {loi.length > 0 && (
        <p className="mt-4 rounded-shot border border-brand/30 bg-brand/5 px-4 py-2.5 text-sm text-brand">
          Không đọc được: {loi.join(" · ")}
        </p>
      )}

      {/* ═══ TẦNG 1 — việc cần làm ═══
          Đặt trước mọi thứ khác, và tin chờ duyệt đứng đầu vì đó là việc admin
          làm nhiều nhất. Trước đây nó nằm cuối cùng, sau 17 khối tra cứu. */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline gap-x-3 border-b-2 border-navy pb-2">
          <h2 className="text-xl font-extrabold tracking-tight">Cần xử lý</h2>
          <span className="text-sm text-mute tabular-nums">
            {canXuLy > 0 ? `${canXuLy} việc đang chờ` : "hết việc — rổ sạch"}
          </span>
          {cauHoiQuaHan > 0 && (
            <span className="rounded-full bg-brand px-3 py-0.5 text-xs font-extrabold text-white tabular-nums">
              {cauHoiQuaHan} câu quá hạn
            </span>
          )}
        </div>

        {/* ── Tin chờ duyệt ── */}
        <Muc ten="Tin chờ duyệt" dem={pending.length} phu="bot bóc từ câu rao — duyệt thì mới lên kệ">
          {pending.length === 0 ? (
            <Rong>Không còn tin nào chờ duyệt.</Rong>
          ) : (
            <>
              <div className="mt-4 space-y-3">
                {ptTin.mot.map((l) => (
                  <article key={l.id} className="rounded-shot border border-line bg-white p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-bold">
                        #{l.code}
                        {l.ward ? ` · ${l.ward}` : ""}
                        {l.price_raw || l.price_vnd ? ` · ${formatPrice(l.price_vnd, l.price_raw)}` : " · Giá chưa có"}
                        {l.area_m2 ? ` · ${formatArea(l.area_m2)}` : ""}
                      </p>
                      <span className="text-xs text-mute tabular-nums">
                        {new Date(l.created_at).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 max-w-[70ch] text-sm text-navy/80">
                      {sanitizeDescription(l.description) || l.location_raw || (
                        <span className="italic text-mute">Tin chưa có nội dung mô tả</span>
                      )}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setStatus(l.id, "dang_ban")}
                        className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-dark active:scale-[0.98]"
                      >
                        Duyệt — cho rao
                      </button>
                      <button
                        onClick={() => setStatus(l.id, "an")}
                        className="rounded-full border border-line px-5 py-2 text-sm font-semibold transition hover:border-brand hover:text-brand active:scale-[0.98]"
                      >
                        Ẩn tin
                      </button>
                      <button
                        onClick={() => xoaTin(l.id, l.code)}
                        className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 hover:border-red-300 active:scale-[0.98]"
                      >
                        Xoá tin
                      </button>
                      <button
                        onClick={() => setUpCho((c) => (c === l.id ? null : l.id))}
                        className="rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:border-brand hover:text-brand"
                      >
                        {upCho === l.id ? "Đóng ảnh" : "Up ảnh"}
                      </button>
                      <span className="ml-auto text-xs text-mute">
                        (Duyệt để xem công khai)
                      </span>
                    </div>
                    {/* FR-96: up ảnh cho tin chờ duyệt (policy admin, bucket listing-public) */}
                    {upCho === l.id && (
                      <div className="mt-4">
                        <UploadAnh listingId={l.id} code={l.code} />
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <PhanTrang {...ptTin} />
            </>
          )}
        </Muc>

        {/* ── FR-77 — khách cần người thật ── */}
        <Muc
          ten="Khách cần người thật"
          dem={khachCan.length}
          phu="bot đã giơ cờ, chưa ai vào"
        >
          {khachCan.length === 0 ? (
            <Rong>Không hội thoại nào đang chờ người thật.</Rong>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-line text-sm">
                {ptKhachCan.mot.map((k) => (
                  <li key={k.conversation_id} className="flex flex-wrap items-start gap-x-3 py-2.5">
                    <span className="w-32 shrink-0 tabular-nums text-mute">
                      {new Date(k.needs_human_at).toLocaleString("vi-VN")}
                    </span>
                    <span className="font-semibold">{k.ten ?? "Không tên"}</span>
                    <span className="text-mute">{k.vai === "khach" ? "khách" : "người bán"}</span>
                    {k.ctv_name && <span className="text-mute">CTV {k.ctv_name}</span>}
                    <span className="min-w-0 basis-full text-navy/85 sm:basis-auto sm:flex-1">
                      {k.tin_khach_cuoi ? `“${k.tin_khach_cuoi}”` : (
                        <span className="text-mute">chưa có tin nào</span>
                      )}
                    </span>
                    {linkZalo(k.zalo_user_id) && (
                      <a
                        href={linkZalo(k.zalo_user_id)!}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-zalo transition hover:border-zalo"
                      >
                        Mở Zalo
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <PhanTrang {...ptKhachCan} />
            </>
          )}
        </Muc>

        {/* ── FR-76 — câu khách hỏi ── */}
        <Muc
          ten="Câu khách hỏi"
          dem={cauHoiCho}
          phu={
            cauHoi.length
              ? `${cauHoiCho} đang chờ · ${cauHoi.length - cauHoiCho} đã trả lời`
              : "chưa có câu hỏi nào"
          }
        >
          {cauHoi.length === 0 ? (
            <Rong>Chưa có câu hỏi nào.</Rong>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-line text-sm">
                {ptCauHoi.mot.map((c) => {
                  const quaHan =
                    c.status === "pending" && !!c.sla_due_at &&
                    new Date(c.sla_due_at).getTime() < now;
                  return (
                    <li key={c.id} className="py-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-bold">#{c.listings?.code ?? "—"}</span>
                        <span className="min-w-0 max-w-[70ch] flex-1 text-navy/85">{c.question}</span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                            quaHan
                              ? "bg-brand text-white"
                              : c.status === "pending"
                                ? "bg-navy text-white"
                                : "bg-brand/10 text-brand"
                          }`}
                        >
                          {quaHan ? "quá hạn" : (TRANG_THAI_HOI[c.status] ?? c.status)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-mute tabular-nums">
                        <span>{new Date(c.created_at).toLocaleString("vi-VN")}</span>
                        {c.buyers?.name && <span>khách {c.buyers.name}</span>}
                        <span>nguồn {c.source ?? "—"}</span>
                        <span>
                          giao {NGUOI_GIAO[c.assignee ?? ""] ?? c.assignee ?? "—"}
                          {c.ctvs?.name ? ` ${c.ctvs.name}` : ""}
                        </span>
                        {c.sla_due_at && (
                          <span className={quaHan ? "font-bold text-brand" : ""}>
                            hạn {new Date(c.sla_due_at).toLocaleString("vi-VN")}
                          </span>
                        )}
                        {c.answered_at && (
                          <span>trả lời {new Date(c.answered_at).toLocaleString("vi-VN")}</span>
                        )}
                      </div>
                      {c.answer && <p className="mt-1 max-w-[70ch] text-sm text-navy/75">↳ {c.answer}</p>}
                    </li>
                  );
                })}
              </ul>
              <PhanTrang {...ptCauHoi} />
            </>
          )}
        </Muc>

        {/* ── Việc chờ admin ── */}
        <Muc ten="Việc chờ admin" dem={viec.length} phu="bot đẩy lên, đọc xong thì đóng">
          {viec.length === 0 ? (
            <Rong>Không có việc nào chờ.</Rong>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {viec.map((v) => (
                <li key={v.id} className="flex flex-wrap items-start gap-x-3 py-2.5">
                  <span className="w-32 shrink-0 tabular-nums text-mute">
                    {new Date(v.created_at).toLocaleString("vi-VN")}
                  </span>
                  <span className="min-w-0 max-w-[70ch] flex-1 text-navy/85">{v.note}</span>
                  <button
                    onClick={() => dongViec(v.id)}
                    className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold transition hover:border-brand hover:text-brand"
                  >
                    Đã xử lý
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Muc>

        {/* ── FR-78 — lịch xem nhà ── */}
        <Muc
          ten="Lịch xem nhà"
          dem={lichSapToi}
          phu={lichXem.length ? `${lichXem.length} lịch — sắp tới và 7 ngày qua` : "chưa có lịch nào"}
        >
          {lichXem.length === 0 ? (
            <Rong>Chưa có lịch xem nào.</Rong>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-line text-sm">
                {ptLichXem.mot.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-x-3 py-2.5">
                    <span className="w-36 shrink-0 tabular-nums text-mute">
                      {v.slot
                        ? new Date(v.slot).toLocaleString("vi-VN")
                        : (v.time_text ?? "chưa rõ giờ")}
                    </span>
                    <span className="font-bold">#{v.listings?.code ?? v.listing_code ?? "—"}</span>
                    <span className="font-semibold">{v.buyers?.name ?? "Khách chưa tên"}</span>
                    {v.slot && v.time_text && <span className="text-mute">“{v.time_text}”</span>}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                        v.status === "pending" ? "bg-brand/10 text-brand" : "bg-line text-navy"
                      }`}
                    >
                      {TRANG_THAI_XEM[v.status] ?? v.status}
                    </span>
                    <span className="ml-auto text-xs text-mute">
                      {v.guide ? `dẫn: ${v.guide}` : "chưa có người dẫn"}
                    </span>
                  </li>
                ))}
              </ul>
              <PhanTrang {...ptLichXem} />
            </>
          )}
        </Muc>
      </section>

      {/* ═══ TẦNG 2 — bot còn sống không ═══
          Một dải, không phải ba thẻ. Chỉ nở ra khi có lỗi (FR-152, NFR-01). */}
      <section className="mt-16">
        <div className="flex flex-wrap items-baseline gap-x-3 border-b-2 border-navy pb-2">
          <h2 className="text-xl font-extrabold tracking-tight">Bot</h2>
          <span className="text-sm text-mute">nhịp tim, độ trễ, sổ lỗi</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {health ? <BridgeBadge at={health.beat} /> : <span className="text-mute">đang đọc…</span>}

          <span className="tabular-nums text-mute">
            {doTre === undefined
              ? "độ trễ: đang đọc…"
              : doTre === null || doTre.so_luot == null
                ? `độ trễ: chưa có dữ liệu${loiPhu.bot_do_tre ? ` (${loiPhu.bot_do_tre})` : ""}`
                : null}
            {doTre && doTre.so_luot != null && (
              <>
                p50 <b className="text-navy">{Math.round((doTre.p50_giay ?? 0) * 1000).toLocaleString("vi-VN")} ms</b>
                {" · p95 "}
                <b className={(doTre.p95_giay ?? 0) > 3 ? "text-brand" : "text-navy"}>
                  {Math.round((doTre.p95_giay ?? 0) * 1000).toLocaleString("vi-VN")} ms
                </b>
                {" · "}{doTre.so_luot} lượt · mốc NFR-01 p95 &lt; 3 000 ms
              </>
            )}
          </span>

          {health && (
            <span className={health.errs.length ? "font-semibold text-brand" : "text-mute"}>
              {health.errs.length ? `${health.errs.length} lỗi gần nhất` : "sổ lỗi sạch"}
            </span>
          )}
        </div>

        {health && health.errs.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-mute transition hover:text-brand">
              Xem {health.errs.length} lỗi
            </summary>
            <ul className="mt-2 divide-y divide-line text-sm">
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
          </details>
        )}
      </section>

      {/* ═══ TẦNG 3 — tra cứu ═══
          Gập lại hết. Đây là thứ mở ra khi cần trả lời một câu hỏi cụ thể,
          không phải thứ phải cuộn qua mỗi lần vào trang. */}
      <section className="mt-16">
        <div className="flex flex-wrap items-baseline gap-x-3 border-b-2 border-navy pb-2">
          <h2 className="text-xl font-extrabold tracking-tight">Tra cứu</h2>
          <span className="text-sm text-mute">mở khi cần, không phải thứ nhìn hằng ngày</span>
        </div>

        {/* FR-100 — danh sách riêng cho một khách (UF-12) */}
        <TraCuu ten="Tạo danh sách riêng cho khách" phu="link /ds/… sống 30 ngày, gửi qua Zalo">
          <form onSubmit={taoDs} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                value={dsMa}
                onChange={(e) => setDsMa(e.target.value)}
                placeholder="BDS-Q5-0007, BDS-Q5-0012, BDS-Q5-0031"
                className="min-w-0 rounded-full border border-line px-4 py-1.5 text-sm outline-none focus:border-brand"
              />
              <input
                value={dsTieuDe}
                onChange={(e) => setDsTieuDe(e.target.value)}
                placeholder="tiêu đề: Quận 5 · dưới 12 tỉ · HXH"
                className="min-w-0 rounded-full border border-line px-4 py-1.5 text-sm outline-none focus:border-brand sm:w-72"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={dangTaoDs}
                className="rounded-full bg-brand px-5 py-1.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60"
              >
                {dangTaoDs ? "Đang tạo…" : "Tạo link"}
              </button>
              {dsKq && (
                <span className={`text-sm ${dsKq.ok ? "text-navy" : "text-brand"}`}>
                  {dsKq.ok && dsKq.path ? (
                    <>
                      <a href={dsKq.path} target="_blank" rel="noreferrer" className="font-bold underline">
                        {dsKq.path}
                      </a>
                      {" · "}
                      {dsKq.text}{" "}
                      <button
                        type="button"
                        onClick={() => chepLink(dsKq.path!)}
                        className="rounded-full border border-line px-3 py-0.5 text-xs font-semibold transition hover:border-brand hover:text-brand"
                      >
                        {daChep ? "Đã chép" : "Chép link"}
                      </button>
                    </>
                  ) : (
                    dsKq.text
                  )}
                </span>
              )}
            </div>
          </form>
        </TraCuu>

        {/* CRM Khách hàng & Hai vai (Vừa mua vừa bán · Gắn BĐS quan tâm · Nhu cầu) */}
        <TraCuu
          ten="Khách hàng & CRM (Vừa mua vừa bán · Gắn BĐS quan tâm)"
          dem={filteredCrm.length}
          phu="hồ sơ hai vai, nhu cầu mua/thuê, căn đang rao và BĐS quan tâm"
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={qCrm}
              onChange={(e) => setQCrm(e.target.value)}
              placeholder="Lọc nhanh theo tên, Zalo UID, khu vực, mã BĐS rao hoặc quan tâm…"
              className="min-w-0 flex-1 rounded-full border border-line px-4 py-2 text-sm outline-none focus:border-brand"
            />
            {qCrm && (
              <button
                type="button"
                onClick={() => setQCrm("")}
                className="rounded-full border border-line px-3 py-1 text-xs text-mute transition hover:border-brand hover:text-brand"
              >
                Xoá lọc
              </button>
            )}
          </div>

          {filteredCrm.length === 0 ? (
            <Rong>Chưa có khách hàng nào khớp.</Rong>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {ptCrm.mot.map((k) => {
                const p = k.preferences ?? {};
                const isDual = !!k.seller && !!k.preferences;
                const isSellerOnly = !!k.seller && !k.preferences;
                const isEditing = suaNhuCauId === k.id;
                const isAssigning = dangGanBds === k.id;

                return (
                  <li key={k.id} className="space-y-2.5 py-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-base font-bold text-navy">{k.name ?? "Chưa rõ tên"}</span>
                      {k.zalo_user_id && (
                        <span className="tabular-nums text-xs text-mute font-mono">
                          Zalo: {k.zalo_user_id}
                        </span>
                      )}

                      {/* Vai trò */}
                      {isDual ? (
                        <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 text-xs font-extrabold shadow-sm">
                          ✨ Vừa mua vừa bán
                        </span>
                      ) : isSellerOnly ? (
                        <span className="rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 text-xs font-bold">
                          {k.seller?.seller_type === "ccrb" ? "Chính chủ bán" : "Môi giới bán"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-0.5 text-xs font-bold">
                          Khách mua / thuê
                        </span>
                      )}

                      <span className="ml-auto flex items-center gap-2">
                        {linkZalo(k.zalo_user_id) && (
                          <a
                            href={linkZalo(k.zalo_user_id)!}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-zalo transition hover:border-zalo"
                          >
                            Mở Zalo
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => (isEditing ? setSuaNhuCauId(null) : moSuaNhuCau(k))}
                          className="rounded-full border border-line px-3 py-1 text-xs font-semibold transition hover:border-brand hover:text-brand"
                        >
                          {isEditing ? "Đóng" : "Sửa nhu cầu"}
                        </button>
                      </span>
                    </div>

                    {/* Chi tiết người bán nếu có */}
                    {k.seller?.active_listing && (
                      <div className="rounded-md bg-amber-50/60 border border-amber-200/70 p-2.5 text-xs flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-bold text-amber-900">Căn đang rao bán:</span>
                        <Link
                          href={`/nha-dat/${encodeURIComponent(k.seller.active_listing.code ?? "")}`}
                          target="_blank"
                          className="font-extrabold text-brand hover:underline"
                        >
                          #{k.seller.active_listing.code}
                          {k.seller.active_listing.legacy_code && (
                            <span className="text-mute font-normal"> ({k.seller.active_listing.legacy_code})</span>
                          )}
                        </Link>
                        {k.seller.active_listing.location_raw && (
                          <span className="text-navy/80">{k.seller.active_listing.location_raw}</span>
                        )}
                        {k.seller.active_listing.price_raw && (
                          <span className="font-bold text-navy">{k.seller.active_listing.price_raw}</span>
                        )}
                        <span className="rounded bg-white/80 border border-line px-1.5 py-0.5 text-[10px] text-mute">
                          {k.seller.active_listing.status}
                        </span>
                      </div>
                    )}

                    {/* Nhu cầu mua/thuê */}
                    {Boolean(k.preferences) && (
                      <div className="rounded-md bg-slate-50 border border-slate-200/80 p-2.5 text-xs space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="font-bold text-navy">Nhu cầu:</span>
                          <span className="rounded bg-brand/10 text-brand px-1.5 py-0.5 font-bold">
                            {p.deal === "thue" ? "Cần thuê" : "Cần mua"}
                          </span>
                          {Boolean(p.property_type) && (
                            <span className="font-semibold text-navy">· Loại: {String(p.property_type)}</span>
                          )}
                          {Boolean(p.area) && (
                            <span className="font-semibold text-navy">· Khu vực: {String(p.area)}</span>
                          )}
                          {p.bedrooms != null && (
                            <span className="font-semibold text-navy">· {String(p.bedrooms)} PN</span>
                          )}
                          {Boolean(p.budget) && (
                            <span className="font-semibold text-navy">· Giá: {String(p.budget)}</span>
                          )}
                        </div>
                        {Boolean(p.notes || k.notes) && (
                          <p className="text-mute italic">
                            Ghi chú: {String(k.notes || p.notes)}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Form sửa nhu cầu khi bấm "Sửa nhu cầu" */}
                    {isEditing && (
                      <div className="rounded-lg border-2 border-brand/40 bg-white p-3.5 shadow-sm space-y-3">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-brand">
                          Can thiệp hồ sơ nhu cầu khách: {k.name ?? k.zalo_user_id}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                          <div>
                            <label className="block font-semibold mb-1 text-mute">Nhu cầu deal</label>
                            <select
                              value={formNhuCau.deal}
                              onChange={(e) => setFormNhuCau({ ...formNhuCau, deal: e.target.value })}
                              className="w-full rounded border border-line p-1.5 bg-white"
                            >
                              <option value="ban">Mua BĐS</option>
                              <option value="thue">Thuê BĐS</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 text-mute">Khu vực tìm kiếm</label>
                            <input
                              value={formNhuCau.area}
                              onChange={(e) => setFormNhuCau({ ...formNhuCau, area: e.target.value })}
                              placeholder="Vd: Bình Tân, Quận 5..."
                              className="w-full rounded border border-line p-1.5"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 text-mute">Loại BĐS</label>
                            <input
                              value={formNhuCau.property_type}
                              onChange={(e) => setFormNhuCau({ ...formNhuCau, property_type: e.target.value })}
                              placeholder="Vd: căn hộ, nhà phố..."
                              className="w-full rounded border border-line p-1.5"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 text-mute">Số phòng ngủ</label>
                            <input
                              type="number"
                              value={formNhuCau.bedrooms}
                              onChange={(e) => setFormNhuCau({ ...formNhuCau, bedrooms: e.target.value })}
                              placeholder="Vd: 3"
                              className="w-full rounded border border-line p-1.5"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 text-mute">Khoảng giá / Ngân sách</label>
                            <input
                              value={formNhuCau.budget}
                              onChange={(e) => setFormNhuCau({ ...formNhuCau, budget: e.target.value })}
                              placeholder="Vd: 8-10 triệu/tháng, 5 tỷ..."
                              className="w-full rounded border border-line p-1.5"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold mb-1 text-mute">Ghi chú CSKH</label>
                            <input
                              value={formNhuCau.notes}
                              onChange={(e) => setFormNhuCau({ ...formNhuCau, notes: e.target.value })}
                              placeholder="Vd: diện tích 50m2, dọn vào ngay..."
                              className="w-full rounded border border-line p-1.5"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setSuaNhuCauId(null)}
                            className="rounded px-3 py-1 text-xs font-semibold text-mute hover:text-navy"
                          >
                            Huỷ
                          </button>
                          <button
                            type="button"
                            onClick={() => luuSuaNhuCau(k.id)}
                            className="rounded bg-brand px-4 py-1 text-xs font-bold text-white hover:bg-brand-dark transition"
                          >
                            Lưu nhu cầu
                          </button>
                        </div>
                      </div>
                    )}

                    {/* BĐS quan tâm & Gắn BĐS */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-semibold text-mute">BĐS quan tâm:</span>
                      {k.interests && k.interests.length > 0 ? (
                        k.interests.map((it) => (
                          <span
                            key={it.listing_id}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2.5 py-0.5 text-xs text-navy"
                          >
                            <Link
                              href={`/nha-dat/${encodeURIComponent(it.code ?? "")}`}
                              target="_blank"
                              className="font-bold text-brand hover:underline"
                            >
                              #{it.code}
                            </Link>
                            {it.price_raw && <span className="text-mute">({it.price_raw})</span>}
                            <button
                              type="button"
                              onClick={() => xoaBdsQuanTam(k.id, it.listing_id)}
                              title="Gỡ BĐS quan tâm"
                              className="ml-1 text-mute hover:text-red-600 font-bold"
                            >
                              ✕
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-mute italic">Chưa gắn BĐS nào</span>
                      )}

                      {/* Nút / Ô gắn BĐS */}
                      {isAssigning ? (
                        <div className="inline-flex items-center gap-1">
                          <input
                            value={maBdsGan}
                            onChange={(e) => setMaBdsGan(e.target.value)}
                            placeholder="Mã tin (vd: BDS-CH-Q5-0001)"
                            className="rounded-full border border-brand px-2.5 py-0.5 text-xs outline-none w-48"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => ganBdsQuanTam(k.id)}
                            disabled={dangLuuBds}
                            className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white hover:bg-brand-dark"
                          >
                            {dangLuuBds ? "Đang gắn…" : "Gắn"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDangGanBds(null);
                              setMaBdsGan("");
                            }}
                            className="text-xs text-mute hover:text-navy px-1"
                          >
                            Huỷ
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDangGanBds(k.id);
                            setMaBdsGan("");
                          }}
                          className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs font-semibold text-brand transition hover:border-brand"
                        >
                          + Gắn BĐS quan tâm
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <PhanTrang {...ptCrm} />
        </TraCuu>

        {/* FR-70/73 — BĐS hot 60 ngày (view `bds_hot`) */}
        <TraCuu
          ten="BĐS hot · 60 ngày"
          dem={bdsHot?.length ?? 0}
          phu="đếm sự kiện (xem, hỏi, hẹn) theo tin — nhiều nhất trước"
        >
          {bdsHot === null ? (
            <Rong>chưa có dữ liệu{loiPhu.bds_hot ? ` (${loiPhu.bds_hot})` : ""}</Rong>
          ) : bdsHot.length === 0 ? (
            <Rong>Chưa có sự kiện nào trong 60 ngày.</Rong>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {bdsHot.map((h) => (
                <li key={h.listing_id} className="flex flex-wrap items-center gap-x-3 py-2.5">
                  <span className="w-12 shrink-0 text-right font-extrabold tabular-nums text-brand">
                    {h.so_su_kien_60d}
                  </span>
                  <Link
                    href={`/nha-dat/${encodeURIComponent(h.code ?? "")}`}
                    target="_blank"
                    className="font-semibold transition hover:text-brand"
                  >
                    #{h.code ?? h.listing_id.slice(0, 8)}
                  </Link>
                  <span className="text-mute">{h.ward ?? ""}</span>
                  <span className="ml-auto text-xs text-mute tabular-nums">
                    {h.last_event_at
                      ? `gần nhất ${new Date(h.last_event_at).toLocaleString("vi-VN")}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TraCuu>

        {/* FR-71 — thống kê hội thoại 30 ngày (view hoi_thoai_thong_ke) + CSV */}
        <TraCuu
          ten="Thống kê hội thoại · 30 ngày"
          phu={`${tongTK.hoi_thoai} hội thoại khách mới · ${tongTK.khach_moi} khách mới · ${tongTK.co} lần cần người thật`}
        >
          <div className="flex justify-end">
            <button
              onClick={taiCsv}
              disabled={!thongKe.length}
              className="rounded-full border border-line px-3 py-1 text-xs font-semibold transition hover:border-brand hover:text-brand disabled:opacity-40"
            >
              Tải CSV
            </button>
          </div>
          {thongKe.length > 0 && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-left text-xs text-mute">
                  <tr>
                    <th className="py-1 pr-3 font-semibold">Ngày</th>
                    <th className="py-1 pr-3 font-semibold">HT khách</th>
                    <th className="py-1 pr-3 font-semibold">HT bán</th>
                    <th className="py-1 pr-3 font-semibold">Tin khách</th>
                    <th className="py-1 pr-3 font-semibold">Tin bot</th>
                    <th className="py-1 pr-3 font-semibold">Người thật</th>
                    <th className="py-1 pr-3 font-semibold">Khách mới</th>
                    <th className="py-1 font-semibold">Cờ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ptThongKe.mot.map((r) => (
                    <tr key={r.ngay}>
                      <td className="py-1 pr-3 text-mute">
                        {new Date(r.ngay).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="py-1 pr-3">{r.hoi_thoai_khach_moi}</td>
                      <td className="py-1 pr-3">{r.hoi_thoai_ban_moi}</td>
                      <td className="py-1 pr-3">{r.tin_khach}</td>
                      <td className="py-1 pr-3">{r.tin_bot}</td>
                      <td className="py-1 pr-3">{r.tin_nguoi_that}</td>
                      <td className="py-1 pr-3">{r.khach_moi}</td>
                      <td className="py-1">{r.co_nguoi_that}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PhanTrang {...ptThongKe} />
          <p className="mt-3 max-w-[70ch] text-xs text-mute">
            Ngày theo giờ VN. Tin “người thật” = CTV hoặc admin nhắn trong hội thoại. CSV tạo trên
            trình duyệt; chưa có xuất Excel phía server.
          </p>
        </TraCuu>

        {/* Người bán mới — nhãn bot gán lúc bóc tách, sửa tại chỗ (02/09) */}
        {nguoiBan.length > 0 && (
          <TraCuu
            ten="Người bán · 14 ngày qua"
            dem={nguoiBan.length}
            phu="nhãn quyết định mức phí — bấm để đổi nếu bot gán sai"
          >
            <ul className="divide-y divide-line text-sm">
              {ptNguoiBan.mot.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-3 py-2.5">
                  <span className="w-28 shrink-0 tabular-nums text-mute">
                    {new Date(s.created_at).toLocaleDateString("vi-VN")}
                  </span>
                  <span className="font-semibold">{s.name ?? "Chưa có tên"}</span>
                  <span className="text-mute">{s.zalo_user_id ? "từ chat" : "tạo tay"}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                      s.seller_type === "unknown" ? "bg-navy text-white" : "bg-brand/10 text-brand"
                    }`}
                  >
                    {NHAN[s.seller_type] ?? s.seller_type}
                  </span>
                  <span className="ml-auto flex gap-2">
                    {(["ccrb", "nmg"] as const)
                      .filter((t) => t !== s.seller_type)
                      .map((t) => (
                        <button
                          key={t}
                          onClick={() => doiNhan(s.id, t)}
                          className="rounded-full border border-line px-3 py-1 text-xs font-semibold transition hover:border-brand hover:text-brand"
                        >
                          Đổi thành {t === "ccrb" ? "chính chủ" : "môi giới"}
                        </button>
                      ))}
                  </span>
                </li>
              ))}
            </ul>
            <PhanTrang {...ptNguoiBan} />
          </TraCuu>
        )}

        {/* Tiền bộ não — số ĐO, không phải ước tính (migration 20260901b) */}
        {tien.length > 0 && <TheTien rows={tien} />}

        {/* FR-173 — hạng CTV theo độ kịp thời trả lời câu khách hỏi (03/09) */}
        {hangCtv.length > 0 && (
          <TraCuu
            ten="Hạng CTV"
            phu="tỷ lệ trả lời trong hạn 30 ngày — Vàng ≥90%, Bạc ≥70%, còn lại Đồng"
          >
            <ul className="divide-y divide-line text-sm">
              {hangCtv.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                      HANG[c.rank]?.lop ?? "bg-line"
                    }`}
                  >
                    {HANG[c.rank]?.ten ?? c.rank}
                  </span>
                  <span className="font-semibold">{c.name ?? "Không tên"}</span>
                  {!c.active && <span className="text-mute">tạm nghỉ</span>}
                  <span className="ml-auto tabular-nums text-mute">
                    {c.dung_han}/{c.tong} đúng hạn · {c.tre} trễ
                    {c.ty_le_dung_han != null ? ` · ${Math.round(c.ty_le_dung_han * 100)}%` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </TraCuu>
        )}

        {/* FR-155 — hạng người rao. Nội bộ, KHÔNG lên web (OPEN-26). */}
        {hang.length > 0 && (
          <TraCuu ten="Hạng người rao" phu="chưa hiện trên web — chờ có giao dịch chốt thật (OPEN-26)">
            <ul className="divide-y divide-line text-sm">
              {hang.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-x-3 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                      HANG[n.rank]?.lop ?? "bg-line"
                    }`}
                  >
                    {HANG[n.rank]?.ten ?? n.rank}
                  </span>
                  <span className="font-semibold">{n.name ?? "Không tên"}</span>
                  <span className="text-mute">{n.seller_type.toUpperCase()}</span>
                  <span className="ml-auto tabular-nums text-mute">
                    {n.active_count} tin đang rao · {n.closed_count} đã chốt
                  </span>
                </li>
              ))}
            </ul>
          </TraCuu>
        )}

        {/* NFR-06 — giấy tờ ở bucket riêng: link ký 15 phút */}
        <TraCuu
          ten="Giấy tờ (bucket riêng)"
          dem={giayTo.length}
          phu="link xem sống 15 phút, không bao giờ công khai"
        >
          {loiPhu.giay_to ? (
            <Rong>không đọc được: {loiPhu.giay_to}</Rong>
          ) : giayTo.length === 0 ? (
            <Rong>Chưa có file nào.</Rong>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {giayTo.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-x-3 py-2.5">
                  <span className="w-32 shrink-0 tabular-nums text-mute">
                    {new Date(g.created_at).toLocaleString("vi-VN")}
                  </span>
                  <span className="font-bold">#{g.listings?.code ?? "—"}</span>
                  <span className="text-mute">
                    {g.media_type === "so_do"
                      ? "sổ đỏ / sổ hồng"
                      : g.media_type === "giay_to"
                        ? "giấy tờ"
                        : g.media_type}{" "}
                    · {g.mime_type}
                  </span>
                  <button
                    onClick={() => xemGiayTo(g)}
                    className="ml-auto rounded-full border border-line px-3 py-1 text-xs font-semibold transition hover:border-brand hover:text-brand"
                  >
                    Xem giấy tờ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TraCuu>
      </section>
    </div>
  );
}

// ── Nguyên liệu bố cục ───────────────────────────────────────────────────────
//
// Trước bản này mọi khối trên trang đều là MỘT hình dạng: thẻ trắng bo góc,
// cách nhau đúng một giá trị `mt-6`, mở đầu bằng cùng một nhãn `.eyebrow` xám.
// Mười tám lần. Nhíu mắt lại thì không có gì nổi lên trước gì — đó chính là
// "không có thứ bậc", và nó không sửa được bằng cách đổi màu hay bo góc.
//
// Hai nguyên liệu dưới đây phân biệt hai loại nội dung khác nhau về BẢN CHẤT:
// việc phải làm hôm nay (mở sẵn, có số đếm, đứng trên nền trang) và tra cứu
// (gập lại, chỉ mở khi cần trả lời một câu hỏi cụ thể).

/** Một mục việc trong tầng "Cần xử lý". Tiêu đề là `h2` thật — số đếm ở bên
 *  phải tiêu đề chứ không trộn vào câu mô tả, để nhìn lướt là ra số. */
function Muc({ ten, phu, dem, children }: {
  ten: string; phu?: string; dem?: number; children: ReactNode;
}) {
  const co = (dem ?? 0) > 0;
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        <h3 className="text-base font-extrabold tracking-tight">{ten}</h3>
        {dem !== undefined && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold tabular-nums ${
              co ? "bg-brand text-white" : "bg-line text-mute"
            }`}
          >
            {dem}
          </span>
        )}
        {phu && <span className="text-sm text-mute">{phu}</span>}
      </div>
      {children}
    </section>
  );
}

/** Một khối tra cứu — gập lại mặc định. `<details>` là đúng thứ ở đây: nó giữ
 *  được bàn phím và trình đọc màn hình mà không cần một dòng JS nào. */
function TraCuu({ ten, phu, dem, children }: {
  ten: string; phu?: string; dem?: number; children: ReactNode;
}) {
  return (
    <details className="group mt-3 border-b border-line pb-3">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-2.5 rounded-shot py-1.5 transition hover:text-brand">
        <span className="text-base font-bold tracking-tight">{ten}</span>
        {dem !== undefined && dem > 0 && (
          <span className="rounded-full bg-line px-2 py-0.5 text-xs font-bold tabular-nums text-navy">
            {dem}
          </span>
        )}
        {phu && <span className="text-sm font-normal text-mute">{phu}</span>}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

/** Trạng thái rỗng. Một dòng, không phải một thẻ trắng cao 100px — ngày yên ắng
 *  thì năm khối rỗng chiếm hết màn hình mà chẳng nói gì. */
function Rong({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm text-mute">{children}</p>;
}

// FR-80 — thanh lật trang. Một trang thì không vẽ gì.
function PhanTrang({ trang, soTrang, tong, setTrang }: {
  trang: number; soTrang: number; tong: number; setTrang: (n: number) => void;
}) {
  if (soTrang <= 1) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-3 text-xs text-mute">
      <button onClick={() => setTrang(trang - 1)} disabled={trang <= 1}
        className="rounded-full border border-line px-3 py-1 font-semibold transition hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line disabled:hover:text-mute">
        ← Trước
      </button>
      <span className="tabular-nums">trang {trang}/{soTrang} · {tong} mục</span>
      <button onClick={() => setTrang(trang + 1)} disabled={trang >= soTrang}
        className="rounded-full border border-line px-3 py-1 font-semibold transition hover:border-brand hover:text-brand disabled:opacity-40 disabled:hover:border-line disabled:hover:text-mute">
        Sau →
      </button>
    </div>
  );
}

// Tiền bộ não, 7 ngày gần nhất.
//
// Con số đáng nhìn nhất KHÔNG phải tổng tiền mà là TRUNG BÌNH MỘT LƯỢT: tổng
// tiền lớn lên theo số khách là chuyện đương nhiên và lành mạnh, còn trung bình
// một lượt phình ra mới là dấu hiệu prompt đang béo dần hoặc nhớ tạm đang trượt.
//
// Cột "đọc lại" là sức khoẻ bộ nhớ tạm. Dưới 50% nghĩa là phần lớn lượt phải nạp
// lại khối luật từ đầu — đang trả giá nạp (2 lần) mà không hưởng giá đọc (1/10),
// tức là đắt hơn cả không dùng nhớ tạm. Gặp vậy thì đổi nhịp nhớ tạm trong
// chat-reply (khối bình luận ngay chỗ cache_control giải thích chọn nhịp nào).
function TheTien({ rows }: { rows: Tien[] }) {
  const tong = rows.reduce((s, t) => s + tienNgay(t), 0);
  const tongLuot = rows.reduce((s, t) => s + t.model_calls, 0);
  const tongNap = rows.reduce((s, t) => s + t.cache_write_tokens, 0);
  const tongDoc = rows.reduce((s, t) => s + t.cache_read_tokens, 0);
  // Chưa deploy bản có đồng hồ thì mọi cột chữ đều bằng 0 — nói thẳng ra vậy,
  // đừng hiện "$0.00" như thể đã đo được và bot chạy miễn phí.
  const daDo = rows.some((t) => t.in_tokens + t.out_tokens + tongNap + tongDoc > 0);
  const tyLeDoc = tongNap + tongDoc > 0 ? tongDoc / (tongNap + tongDoc) : null;

  return (
    <TraCuu
      ten="Tiền bộ não · 7 ngày"
      phu={
        daDo
          ? `$${tong.toFixed(2)} · ${tongLuot} lượt · trung bình $${tongLuot ? (tong / tongLuot).toFixed(3) : "—"}/lượt`
          : "chưa đo được chữ — bản chat-reply có đồng hồ chưa được deploy"
      }
    >
      {daDo && tyLeDoc !== null && (
        <p
          className={`text-sm font-bold ${tyLeDoc >= 0.5 ? "text-brand" : "text-navy"}`}
        >
          nhớ tạm: đọc lại {Math.round(tyLeDoc * 100)}%
          {tyLeDoc >= 0.5 ? "" : " — đang lỗ, xem lại nhịp"}
        </p>
      )}

      <ul className="mt-2 divide-y divide-line text-sm">
        {rows.map((t) => (
          <li key={t.day} className="flex flex-wrap gap-x-3 py-2">
            <span className="w-28 shrink-0 tabular-nums text-mute">
              {new Date(t.day).toLocaleDateString("vi-VN")}
            </span>
            <span className="w-20 shrink-0 tabular-nums">{t.model_calls} lượt</span>
            <span className="w-24 shrink-0 tabular-nums font-semibold">
              {t.in_tokens + t.out_tokens + t.cache_write_tokens + t.cache_read_tokens > 0
                ? `$${tienNgay(t).toFixed(3)}`
                : "—"}
            </span>
            <span className="min-w-0 flex-1 tabular-nums text-navy/60">
              vào {t.in_tokens.toLocaleString("vi-VN")} · ra{" "}
              {t.out_tokens.toLocaleString("vi-VN")} · nạp{" "}
              {t.cache_write_tokens.toLocaleString("vi-VN")} · đọc lại{" "}
              {t.cache_read_tokens.toLocaleString("vi-VN")}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 max-w-[70ch] text-xs text-mute">
        Cận trên: tính giá nạp theo nhịp 1 giờ (2× — nhịp của lượt khách mua). Lượt
        người bán để nhịp 5 phút nên rẻ hơn một chút. Từ 02/09 cả bốn nơi gọi bộ
        não (chat-reply, nudge, ask-seller, ctv-report) đều gắn đồng hồ — đây là
        tổng, không còn là sàn.
      </p>
    </TraCuu>
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
