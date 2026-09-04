"use client";
// Admin (FR-127): duyệt tin cho_thong_tin → dang_ban / ẩn (an) theo vòng đời
// FR-139 (cho_thong_tin → dang_ban → dang_quan_tam → da_chot). Quyền cấp theo
// bảng `admins` (email) — RLS phía DB mới là hàng rào thật, trang này chỉ là UI.
//
// 04/09/2026 — "admin buyer side" (FR-71/74/75/76/77/78/80, migration
// 20260904c): câu khách hỏi, lịch xem nhà, khách cần người thật, thống kê hội
// thoại 30 ngày + CSV, ô tìm khách. Mọi danh sách dài lật 20 mục/trang (FR-80).
import { useEffect, useState, type FormEvent } from "react";
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
// FR-74: kết quả tìm khách. CỐ Ý không có `phone` — bảng có cột đó, policy cho
// admin đọc cả bảng, nhưng web không bao giờ chọn nó (NFR-07, FR-104).
type Khach = {
  id: string; name: string | null; zalo_user_id: string | null;
  preferences: Record<string, unknown> | null; last_contact_at: string | null; created_at: string;
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
  // FR-74: tìm khách theo yêu cầu, ngoài đợt tải đầu (phụ thuộc chữ admin gõ).
  const [qKhach, setQKhach] = useState("");
  const [khach, setKhach] = useState<Khach[] | null>(null);
  const [dangTim, setDangTim] = useState(false);
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

  // FR-80 — hook phân trang phải đứng TRƯỚC mọi `return` sớm theo `role`.
  const ptTin = usePhanTrang(pending);
  const ptNguoiBan = usePhanTrang(nguoiBan);
  const ptCauHoi = usePhanTrang(cauHoi);
  const ptLichXem = usePhanTrang(lichXem);
  const ptKhachCan = usePhanTrang(khachCan);
  const ptThongKe = usePhanTrang(thongKe);

  // MỘT đợt cho cả trang (FR-171 j). Trước bản này là 5 đợt nối tiếp (12 truy
  // vấn), mỗi đợt một lần thời gian mạng VN→Supabase ~150-250 ms, tức 1-1,5 s
  // trước khi có số. Không truy vấn nào ở đây cần kết quả của truy vấn khác.
  // Ba lần `count: exact` trên `listings` (3 lần quét bảng) thay bằng MỘT lượt
  // đọc cột `status` rồi đếm tại chỗ — kho ~200 dòng, rẻ hơn ba lần quét.
  // 04/09: thêm 4 truy vấn buyer side vào CÙNG đợt, vẫn một vòng đi về.
  const load = async () => {
    const d7 = new Date(Date.now() - 7 * 86400e3).toISOString();
    const [pend, st, beatRes, errRes, tn, vc, nb, hg, hc, ch, lx, kc, tk, hot, tre, gt] = await Promise.all([
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
        .select("id, name, seller_type, created_at, zalo_user_id")
        .gte("created_at", new Date(Date.now() - 14 * 86400e3).toISOString())
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
    setLoi(
      [["câu hỏi", ch.error], ["lịch xem", lx.error], ["khách cần người thật", kc.error], ["thống kê", tk.error]]
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

  // FR-74 — tìm khách theo tên Zalo hoặc uid. Bỏ ký tự cú pháp của bộ lọc
  // PostgREST (dấu phẩy, ngoặc) để chữ gõ không thành mệnh đề lọc.
  const timKhach = async (e: FormEvent) => {
    e.preventDefault();
    const q = qKhach.replace(/[,()"\\]/g, " ").trim();
    if (!q) return setKhach(null);
    setDangTim(true);
    const { data, error } = await supabase
      .from("buyers")
      .select("id, name, zalo_user_id, preferences, last_contact_at, created_at")
      .or(`name.ilike.%${q}%,zalo_user_id.ilike.%${q}%`)
      .order("last_contact_at", { ascending: false, nullsFirst: false })
      .limit(MOI_TRANG);
    setDangTim(false);
    if (error) setLoi((l) => [...l, `tìm khách: ${error.message}`]);
    setKhach((data ?? []) as Khach[]);
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
      {loi.length > 0 && (
        <p className="mt-2 text-sm text-brand">Không đọc được: {loi.join(" · ")}</p>
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

      {/* Độ trễ bot 7 ngày — view `bot_do_tre` (04/09 đợt 2) */}
      <div className="mt-6 rounded-king border border-line bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="eyebrow text-mute">Độ trễ bot · 7 ngày</span>
          {doTre === undefined ? (
            <span className="text-sm text-mute">đang đọc…</span>
          ) : doTre === null || doTre.so_luot == null ? (
            <span className="text-sm text-mute">chưa có dữ liệu{loiPhu.bot_do_tre ? ` (${loiPhu.bot_do_tre})` : ""}</span>
          ) : (
            <span className="text-sm tabular-nums">
              p50 <b>{Math.round((doTre.p50_giay ?? 0) * 1000).toLocaleString("vi-VN")} ms</b> · p95{" "}
              <b className={(doTre.p95_giay ?? 0) > 3 ? "text-brand" : ""}>{Math.round((doTre.p95_giay ?? 0) * 1000).toLocaleString("vi-VN")} ms</b>
              {doTre.max_giay != null ? ` · max ${Math.round(doTre.max_giay * 1000).toLocaleString("vi-VN")} ms` : ""}{" "}
              · {doTre.so_luot} lượt · mốc NFR-01: p95 &lt; 3 000 ms
            </span>
          )}
        </div>
      </div>

      {/* FR-70/73 — BĐS hot 60 ngày (view `bds_hot`) */}
      <div className="mt-6 rounded-king border border-line bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="eyebrow text-mute">BĐS hot · 60 ngày</span>
          <span className="text-sm text-mute">
            {bdsHot === null
              ? `chưa có dữ liệu${loiPhu.bds_hot ? ` (${loiPhu.bds_hot})` : ""}`
              : bdsHot.length ? "đếm sự kiện (xem, hỏi, hẹn) theo tin — nhiều nhất trước" : "chưa có sự kiện nào trong 60 ngày"}
          </span>
        </div>
        {bdsHot && bdsHot.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {bdsHot.map((h) => (
              <li key={h.listing_id} className="flex flex-wrap items-center gap-x-3 py-2">
                <span className="w-16 shrink-0 text-right font-extrabold tabular-nums text-brand">{h.so_su_kien_60d}</span>
                <Link href={`/nha-dat/${encodeURIComponent(h.code ?? "")}`} target="_blank" className="font-semibold hover:text-brand">
                  #{h.code ?? h.listing_id.slice(0, 8)}
                </Link>
                <span className="text-mute">{h.ward ?? ""}</span>
                <span className="ml-auto text-xs text-mute tabular-nums">
                  {h.last_event_at ? `gần nhất ${new Date(h.last_event_at).toLocaleString("vi-VN")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* FR-100 — tạo danh sách riêng cho một khách (UF-12) */}
      <div className="mt-6 rounded-king border border-line bg-white p-5">
        <form onSubmit={taoDs} className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="eyebrow text-mute">Danh sách riêng cho khách</span>
            <span className="text-sm text-mute">nhập mã tin cách nhau bởi dấu phẩy → link /ds/… sống 30 ngày, gửi qua Zalo</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input value={dsMa} onChange={(e) => setDsMa(e.target.value)}
              placeholder="BDS-Q5-0007, BDS-Q5-0012, BDS-Q5-0031"
              className="min-w-0 rounded-full border border-line px-4 py-1.5 text-sm outline-none focus:border-brand" />
            <input value={dsTieuDe} onChange={(e) => setDsTieuDe(e.target.value)}
              placeholder="tiêu đề: Quận 5 · dưới 12 tỉ · HXH"
              className="min-w-0 rounded-full border border-line px-4 py-1.5 text-sm outline-none focus:border-brand sm:w-72" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={dangTaoDs}
              className="rounded-full bg-brand px-5 py-1.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60">
              {dangTaoDs ? "Đang tạo…" : "Tạo link"}
            </button>
            {dsKq && (
              <span className={`text-sm ${dsKq.ok ? "text-navy" : "text-brand"}`}>
                {dsKq.ok && dsKq.path ? (
                  <>
                    <a href={dsKq.path} target="_blank" rel="noreferrer" className="font-bold underline">{dsKq.path}</a>
                    {" · "}{dsKq.text}{" "}
                    <button type="button" onClick={() => chepLink(dsKq.path!)}
                      className="rounded-full border border-line px-3 py-0.5 text-xs font-semibold transition hover:border-brand hover:text-brand">
                      {daChep ? "Đã chép" : "Chép link"}
                    </button>
                  </>
                ) : dsKq.text}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* NFR-06 — giấy tờ ở bucket riêng: chỉ mã tin + loại, xem qua URL ký 15 phút */}
      <div className="mt-6 rounded-king border border-line bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="eyebrow text-mute">Giấy tờ (bucket riêng)</span>
          <span className="text-sm text-mute">
            {loiPhu.giay_to
              ? `không đọc được: ${loiPhu.giay_to}`
              : giayTo.length ? `${giayTo.length} file · link xem sống 15 phút, không bao giờ công khai` : "chưa có file nào"}
          </span>
        </div>
        {giayTo.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {giayTo.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-x-3 py-2">
                <span className="w-32 shrink-0 tabular-nums text-mute">{new Date(g.created_at).toLocaleString("vi-VN")}</span>
                <span className="font-bold">#{g.listings?.code ?? "—"}</span>
                <span className="text-mute">{g.media_type === "so_do" ? "sổ đỏ / sổ hồng" : g.media_type === "giay_to" ? "giấy tờ" : g.media_type} · {g.mime_type}</span>
                <button onClick={() => xemGiayTo(g)}
                  className="ml-auto rounded-full border border-line px-3 py-1 text-xs font-semibold transition hover:border-brand hover:text-brand">
                  Xem giấy tờ
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Việc chờ admin — đọc thẳng bảng, không qua bridge (02/09) */}
      <div className="mt-6 rounded-king border border-line bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="eyebrow text-mute">Việc chờ admin</span>
          <span className="text-sm text-mute">
            {viec.length ? `${viec.length} việc đang chờ` : "Không có việc nào chờ"}
          </span>
        </div>
        {viec.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {viec.map((v) => (
              <li key={v.id} className="flex flex-wrap items-start gap-x-3 py-2">
                <span className="w-32 shrink-0 tabular-nums text-mute">
                  {new Date(v.created_at).toLocaleString("vi-VN")}
                </span>
                <span className="min-w-0 flex-1 text-navy/85">{v.note}</span>
                <button onClick={() => dongViec(v.id)}
                  className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold transition hover:border-brand hover:text-brand">
                  Đã xử lý
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* FR-77 — khách cần người thật (view khach_can_nguoi_that, 04/09) */}
      <div className="mt-6 rounded-king border border-line bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="eyebrow text-mute">Khách cần người thật</span>
          <span className="text-sm text-mute">
            {khachCan.length
              ? `${khachCan.length} hội thoại đang giơ cờ, chưa ai vào`
              : "Không hội thoại nào đang chờ người thật"}
          </span>
        </div>
        {khachCan.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {ptKhachCan.mot.map((k) => (
              <li key={k.conversation_id} className="flex flex-wrap items-start gap-x-3 py-2">
                <span className="w-32 shrink-0 tabular-nums text-mute">
                  {new Date(k.needs_human_at).toLocaleString("vi-VN")}
                </span>
                <span className="font-semibold">{k.ten ?? "Không tên"}</span>
                <span className="text-mute">{k.vai === "khach" ? "khách" : "người bán"}</span>
                {k.ctv_name && <span className="text-mute">CTV {k.ctv_name}</span>}
                <span className="min-w-0 basis-full text-navy/85 sm:basis-auto sm:flex-1">
                  {k.tin_khach_cuoi ? `“${k.tin_khach_cuoi}”` : <span className="text-mute">chưa có tin nào</span>}
                </span>
                {linkZalo(k.zalo_user_id) && (
                  <a href={linkZalo(k.zalo_user_id)!} target="_blank" rel="noreferrer"
                    className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-zalo transition hover:border-zalo">
                    Mở Zalo
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        <PhanTrang {...ptKhachCan} />
      </div>

      {/* FR-76 — câu khách hỏi đang chờ / vừa trả lời (04/09) */}
      <div className="mt-6 rounded-king border border-line bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="eyebrow text-mute">Câu hỏi đang chờ</span>
          <span className="text-sm text-mute">
            {cauHoi.length
              ? `${cauHoi.filter((c) => c.status === "pending").length} đang chờ · ${cauHoi.filter((c) => c.status === "answered").length} đã trả lời`
              : "Chưa có câu hỏi nào"}
          </span>
        </div>
        {cauHoi.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {ptCauHoi.mot.map((c) => {
              const quaHan = c.status === "pending" && !!c.sla_due_at && new Date(c.sla_due_at).getTime() < now;
              return (
                <li key={c.id} className="py-2">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-bold">#{c.listings?.code ?? "—"}</span>
                    <span className="min-w-0 flex-1 text-navy/85">{c.question}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                      c.status === "pending" ? "bg-navy text-white" : "bg-brand/10 text-brand"
                    }`}>
                      {TRANG_THAI_HOI[c.status] ?? c.status}
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
                        {quaHan ? " — quá hạn" : ""}
                      </span>
                    )}
                    {c.answered_at && <span>trả lời {new Date(c.answered_at).toLocaleString("vi-VN")}</span>}
                  </div>
                  {c.answer && <p className="mt-1 text-sm text-navy/75">↳ {c.answer}</p>}
                </li>
              );
            })}
          </ul>
        )}
        <PhanTrang {...ptCauHoi} />
      </div>

      {/* FR-78 — lịch xem nhà: sắp tới + 7 ngày qua (04/09) */}
      <div className="mt-6 rounded-king border border-line bg-white p-5">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="eyebrow text-mute">Lịch xem nhà</span>
          <span className="text-sm text-mute">
            {lichXem.length ? `${lichXem.length} lịch — sắp tới và 7 ngày qua` : "Chưa có lịch xem nào"}
          </span>
        </div>
        {lichXem.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {ptLichXem.mot.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 py-2">
                <span className="w-36 shrink-0 tabular-nums text-mute">
                  {v.slot ? new Date(v.slot).toLocaleString("vi-VN") : (v.time_text ?? "chưa rõ giờ")}
                </span>
                <span className="font-bold">#{v.listings?.code ?? v.listing_code ?? "—"}</span>
                <span className="font-semibold">{v.buyers?.name ?? "Khách chưa tên"}</span>
                {v.slot && v.time_text && <span className="text-mute">“{v.time_text}”</span>}
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                  v.status === "pending" ? "bg-brand/10 text-brand" : "bg-line text-navy"
                }`}>
                  {TRANG_THAI_XEM[v.status] ?? v.status}
                </span>
                <span className="ml-auto text-xs text-mute">
                  {v.guide ? `dẫn: ${v.guide}` : "chưa có người dẫn"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <PhanTrang {...ptLichXem} />
      </div>

      {/* FR-74 / FR-75 — tìm khách theo tên hoặc Zalo uid; KHÔNG hiện số điện thoại */}
      <div className="mt-6 rounded-king border border-line bg-white p-5">
        <form onSubmit={timKhach} className="flex flex-wrap items-center gap-3">
          <span className="eyebrow text-mute">Tìm khách</span>
          <input
            value={qKhach}
            onChange={(e) => setQKhach(e.target.value)}
            placeholder="tên Zalo hoặc uid"
            className="min-w-0 flex-1 rounded-full border border-line px-4 py-1.5 text-sm outline-none focus:border-brand"
          />
          <button type="submit" disabled={dangTim}
            className="rounded-full bg-brand px-5 py-1.5 text-sm font-bold text-white transition hover:bg-brand-dark disabled:opacity-60">
            {dangTim ? "Đang tìm…" : "Tìm"}
          </button>
        </form>
        {khach && (
          khach.length === 0 ? (
            <p className="mt-3 text-sm text-mute">Không thấy khách nào khớp.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {khach.map((b) => {
                const p = b.preferences ?? {};
                const soThich = ["area", "budget", "bedrooms"]
                  .filter((k) => p[k] != null && p[k] !== "")
                  .map((k) => `${{ area: "khu", budget: "ngân sách", bedrooms: "PN" }[k]}: ${String(p[k])}`);
                return (
                  <li key={b.id} className="flex flex-wrap items-center gap-x-3 py-2">
                    <span className="font-semibold">{b.name ?? "Không tên"}</span>
                    <span className="tabular-nums text-mute">{b.zalo_user_id ?? "chưa có uid"}</span>
                    <span className="min-w-0 flex-1 text-navy/75">
                      {soThich.length ? soThich.join(" · ") : "chưa rõ nhu cầu"}
                    </span>
                    <span className="text-xs text-mute tabular-nums">
                      {b.last_contact_at
                        ? `liên hệ cuối ${new Date(b.last_contact_at).toLocaleDateString("vi-VN")}`
                        : `tạo ${new Date(b.created_at).toLocaleDateString("vi-VN")}`}
                    </span>
                    {linkZalo(b.zalo_user_id) && (
                      <a href={linkZalo(b.zalo_user_id)!} target="_blank" rel="noreferrer"
                        className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-zalo transition hover:border-zalo">
                        Mở Zalo
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        )}
        <p className="mt-3 text-xs text-mute">
          Tối đa 20 kết quả, không hiện số điện thoại. Link Zalo theo uid là best-effort —
          uid cá nhân qua bridge có thể không mở được.
        </p>
      </div>

      {/* FR-71 — thống kê hội thoại 30 ngày (view hoi_thoai_thong_ke) + CSV */}
      <div className="mt-6 rounded-king border border-line bg-white p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="eyebrow text-mute">Thống kê hội thoại · 30 ngày</span>
          <span className="text-sm text-mute tabular-nums">
            {tongTK.hoi_thoai} hội thoại khách mới · {tongTK.khach_moi} khách mới ·{" "}
            {tongTK.tin_khach} tin khách / {tongTK.tin_bot} bot / {tongTK.tin_nguoi_that} người thật ·{" "}
            {tongTK.co} lần cần người thật
          </span>
          <button onClick={taiCsv} disabled={!thongKe.length}
            className="ml-auto rounded-full border border-line px-3 py-1 text-xs font-semibold transition hover:border-brand hover:text-brand disabled:opacity-40">
            Tải CSV
          </button>
        </div>
        {thongKe.length > 0 && (
          <div className="mt-3 overflow-x-auto">
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
                    <td className="py-1 pr-3 text-mute">{new Date(r.ngay).toLocaleDateString("vi-VN")}</td>
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
        <p className="mt-3 text-xs text-mute">
          Ngày theo giờ VN. Tin "người thật" = CTV hoặc admin nhắn trong hội thoại. CSV tạo trên
          trình duyệt; chưa có xuất Excel phía server.
        </p>
      </div>

      {/* Người bán mới — nhãn bot gán lúc bóc tách, sửa tại chỗ (02/09) */}
      {nguoiBan.length > 0 && (
        <div className="mt-6 rounded-king border border-line bg-white p-5">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="eyebrow text-mute">Người bán 14 ngày qua</span>
            <span className="text-sm text-mute">nhãn quyết định mức phí — bấm để đổi nếu bot gán sai</span>
          </div>
          <ul className="mt-3 divide-y divide-line text-sm">
            {ptNguoiBan.mot.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 py-2">
                <span className="w-28 shrink-0 tabular-nums text-mute">
                  {new Date(s.created_at).toLocaleDateString("vi-VN")}
                </span>
                <span className="font-semibold">{s.name ?? "Chưa có tên"}</span>
                <span className="text-mute">{s.zalo_user_id ? "từ chat" : "tạo tay"}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                  s.seller_type === "unknown" ? "bg-navy text-white" : "bg-brand/10 text-brand"
                }`}>
                  {NHAN[s.seller_type] ?? s.seller_type}
                </span>
                <span className="ml-auto flex gap-2">
                  {(["ccrb", "nmg"] as const).filter((t) => t !== s.seller_type).map((t) => (
                    <button key={t} onClick={() => doiNhan(s.id, t)}
                      className="rounded-full border border-line px-3 py-1 text-xs font-semibold transition hover:border-brand hover:text-brand">
                      Đổi thành {t === "ccrb" ? "chính chủ" : "môi giới"}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <PhanTrang {...ptNguoiBan} />
        </div>
      )}

      {/* Tiền bộ não — số ĐO, không phải ước tính (migration 20260901b) */}
      {tien.length > 0 && <TheTien rows={tien} />}

      {/* FR-173 — hạng CTV theo độ kịp thời trả lời câu khách hỏi (03/09). */}
      {hangCtv.length > 0 && (
        <div className="mt-6 rounded-king border border-line bg-white p-5">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="eyebrow text-mute">Hạng CTV</span>
            <span className="text-sm text-mute">
              tỷ lệ trả lời câu khách hỏi trong hạn (30 ngày) — Vàng ≥90%, Bạc ≥70%, còn lại Đồng
            </span>
          </div>
          <ul className="mt-3 divide-y divide-line text-sm">
            {hangCtv.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 py-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${HANG[c.rank]?.lop ?? "bg-line"}`}>
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
        </div>
      )}

      {/* FR-155 — hạng người rao. Nội bộ, KHÔNG lên web (OPEN-26). */}
      {hang.length > 0 && (
        <div className="mt-6 rounded-king border border-line bg-white p-5">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="eyebrow text-mute">Hạng người rao</span>
            <span className="text-sm text-mute">
              chưa hiện trên web — chờ có giao dịch chốt thật (OPEN-26)
            </span>
          </div>
          <ul className="mt-3 divide-y divide-line text-sm">
            {hang.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-x-3 py-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${HANG[n.rank]?.lop ?? "bg-line"}`}>
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
        </div>
      )}

      {/* Tin chờ duyệt — tải 50, hiện 20/trang (FR-80) */}
      <div className="mt-6 space-y-4">
        {ptTin.mot.map((l) => (
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
              <button onClick={() => setUpCho((c) => (c === l.id ? null : l.id))}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold transition hover:border-brand hover:text-brand">
                {upCho === l.id ? "Đóng ảnh" : "Up ảnh"}
              </button>
              <Link href={`/nha-dat/${encodeURIComponent(l.code ?? "")}`} target="_blank"
                className="ml-auto self-center text-sm font-semibold text-mute hover:text-brand">
                Xem trang tin →
              </Link>
            </div>
            {/* FR-96: up ảnh cho tin chờ duyệt (policy admin, bucket listing-public) */}
            {upCho === l.id && (
              <div className="mt-4">
                <UploadAnh listingId={l.id} code={l.code} />
              </div>
            )}
          </div>
        ))}
        {pending.length === 0 && (
          <div className="rounded-king border border-line bg-white p-10 text-center text-mute">
            Không còn tin chờ duyệt.
          </div>
        )}
        <PhanTrang {...ptTin} />
      </div>
    </div>
  );
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
    <div className="mt-6 rounded-king border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="eyebrow text-mute">Tiền bộ não · 7 ngày</span>
        {daDo ? (
          <>
            <span className="font-bold tabular-nums">${tong.toFixed(2)}</span>
            <span className="text-sm text-mute tabular-nums">
              {tongLuot} lượt · trung bình ${tongLuot ? (tong / tongLuot).toFixed(3) : "—"}/lượt
            </span>
            {tyLeDoc !== null && (
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  tyLeDoc >= 0.5 ? "bg-brand/10 text-brand" : "bg-navy text-white"
                }`}
              >
                nhớ tạm: đọc lại {Math.round(tyLeDoc * 100)}%
                {tyLeDoc >= 0.5 ? "" : " — đang lỗ, xem lại nhịp"}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-mute">
            chưa đo được chữ — bản chat-reply có đồng hồ chưa được deploy; cột dưới
            mới chỉ đếm lượt
          </span>
        )}
      </div>

      <ul className="mt-3 divide-y divide-line text-sm">
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

      <p className="mt-3 text-xs text-mute">
        Cận trên: tính giá nạp theo nhịp 1 giờ (2× — nhịp của lượt khách mua). Lượt
        người bán để nhịp 5 phút nên rẻ hơn một chút. Từ 02/09 cả bốn nơi gọi bộ
        não (chat-reply, nudge, ask-seller, ctv-report) đều gắn đồng hồ — đây là
        tổng, không còn là sàn.
      </p>
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
