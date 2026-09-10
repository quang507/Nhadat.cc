// Supabase giả trong bộ nhớ: đủ để chat-reply chạy trọn đường, ghi lại mọi truy vấn.
import { randomUUID } from "node:crypto";

const singular = (t) => t.replace(/s$/, "");
// Mốc thời gian phải DUY NHẤT, như Postgres. `toISOString()` chỉ có mili giây,
// mà ba câu hỏi chờ mở liên tiếp rơi trọn trong một mili giây là chuyện thường —
// khi đó `order("created_at", { ascending: false })` HOÀ, `Array.sort` ổn định
// giữ nguyên thứ tự chèn, nên `ds[0]` hoá ra câu CŨ NHẤT trong nhóm hoà thay vì
// mới nhất: chat-reply bốc nhầm câu đang treo và ca G5 đỏ chừng 1/6 lượt chạy.
// Postgres lưu timestamp tới micro giây nên hoà gần như không xảy ra; mock phải
// giống chỗ đó, không thì bộ e2e đo một hành vi khác bản thật. (Bắt 08/09/2026.)
let mocNhoNhat = 0;
const now = () => {
  const t = Math.max(Date.now(), mocNhoNhat + 1);
  mocNhoNhat = t;
  return new Date(t).toISOString();
};

export class FakeDB {
  constructor() {
    this.t = {};
    for (const n of ["sellers","buyers","conversations","messages","listings","listing_facts","info_requests",
      "reminders","viewings","deals","inbound_ledger","bot_prompts","projects","listing_photos_v","bot_errors","bot_usage","ledger_log",
      "ctvs","admins","interests","ratings","inbound_events","listing_media","app_config"]) this.t[n] = [];
    this.seq = 0; this.log = [];
    // FR-185: kho file giả — chat-reply cất ảnh chủ nhà gửi vào Storage.
    this.storage = [];
  }
  rows(n) {
    if (n === "listing_missing_facts") return this.missingFacts();
    return this.t[n] ?? (this.t[n] = []);
  }
  // FR-144/FR-140: view thiếu-thông-tin — chỉ tin còn cho_thong_tin
  // FR-177 (20260907h): nhóm co_ban (1–9) → chuyen_mon (10–19) → phu (20+),
  // đúng chuỗi nhà phố của required_facts thật. "Đã có" đọc từ cột như view.
  missingFacts() {
    // FR-186 (20260909h): chuỗi theo LOẠI BĐS và loại giao dịch — chép đúng seed
    // `required_facts` thật (deal null = mọi giao dịch, "cho_thue" = chỉ tin thuê).
    // Nhóm `phu` KHÔNG có ở đây: view thật lọc (20260908a). Hướng HỎI với chung cư /
    // đất (chuyen_mon), không hỏi với nhà phố / biệt thự (phu) — mock phải y vậy.
    const CB = (k, p) => [k, p, "co_ban", null];
    const CM = (k, p, deal = null) => [k, p, "chuyen_mon", deal];
    const THUE_NHA = [CM("noi_that", 15, "cho_thue"), CM("tien_coc", 16, "cho_thue"), CM("thoi_han_thue", 17, "cho_thue"), CM("truot_gia", 18, "cho_thue")];
    // 20260909i: nhóm sau_dang — hỏi bù SAU khi lên kệ; chat-reply không đợi nhóm này trước bản nháp.
    const SD = (k, p) => [k, p, "sau_dang", null];
    const SAU_NHA = [SD("so_wc", 30), SD("cach_mat_tien", 31), SD("hem_thong", 32), SD("ngap_nuoc", 33), SD("hien_trang_su_dung", 34), SD("the_chap", 35), SD("tien_ich_gan", 36), SD("ly_do_ban", 37), SD("thuong_luong", 38)];
    const REQ = {
      toa_nha: [CB("vi_tri", 2), CB("phuong", 3), CB("dien_tich_dat", 5), CB("gia", 9), CM("so_phong", 10), CM("ty_le_lap_day", 11), CM("doanh_thu", 12), CM("ket_cau", 13), CM("thang_may", 14), CM("pccc", 15), CM("phap_ly", 16), CM("do_rong_hem", 17), CM("hinh_anh", 19)],
      dat_nong_nghiep: [CB("vi_tri", 2), CB("phuong", 3), CB("dien_tich", 4), CB("gia", 9), CM("quy_hoach", 10), CM("len_tho_cu", 11), CM("duong_vao", 12), CM("nguon_nuoc", 13), CM("ranh_gioi", 14), CM("phap_ly", 15), CM("hinh_anh", 19)],
      dat_kinh_doanh: [CB("vi_tri", 2), CB("phuong", 3), CB("dien_tich", 4), CB("gia", 9), CM("thoi_han_su_dung", 10), CM("hinh_thuc_thue_dat", 11), CM("muc_dich", 12), CM("do_rong_duong", 13), CM("phap_ly", 14), CM("hinh_anh", 19)],
      kho_xuong: [CB("vi_tri", 2), CB("phuong", 3), CB("dien_tich", 4), CB("gia", 9), CM("chieu_cao", 10), CM("tai_trong_san", 11), CM("tram_bien_ap", 12), CM("xu_ly_nuoc_thai", 13), CM("duong_container", 14), CM("phap_ly", 15), CM("thoi_han_su_dung", 16), CM("tien_coc", 17, "cho_thue"), CM("thoi_han_thue", 18, "cho_thue"), CM("hinh_anh", 19)],
      chua_ro: [CB("loai_bds", 1), CB("vi_tri", 2), CB("phuong", 3), CB("gia", 9)],
      nha_pho: [CB("vi_tri", 2), CB("phuong", 3), CB("dien_tich_dat", 5), CB("gia", 9), CM("do_rong_hem", 10), CM("ket_cau", 11), CM("so_phong_ngu", 12), CM("phap_ly", 13), CM("tiem_nang", 14), ...THUE_NHA, CM("hinh_anh", 19), ...SAU_NHA],
      nha_cap4: [CB("vi_tri", 2), CB("phuong", 3), CB("dien_tich_dat", 5), CB("gia", 9), CM("do_rong_hem", 10), CM("hien_trang", 11), CM("so_phong_ngu", 12), CM("phap_ly", 13), CM("tiem_nang", 14), CM("noi_that", 15, "cho_thue"), CM("tien_coc", 16, "cho_thue"), CM("thoi_han_thue", 17, "cho_thue"), CM("hinh_anh", 19)],
      chung_cu: [CB("vi_tri", 2), CB("phuong", 3), CB("dien_tich_tim_tuong", 6), CB("gia", 9), CM("tang", 10), CM("so_phong_ngu", 11), CM("huong", 12), CM("noi_that", 13), CM("phap_ly", 14), CM("phi_quan_ly", 15), CM("tien_coc", 16, "cho_thue"), CM("thoi_han_thue", 17, "cho_thue"), CM("hinh_anh", 19)],
      dat: [CB("vi_tri", 2), CB("phuong", 3), CB("dien_tich", 4), CB("tho_cu", 8), CB("gia", 9), CM("do_rong_duong", 10), CM("huong", 11), CM("ha_tang", 12), CM("xay_dung", 13), CM("phap_ly", 14), CM("hinh_anh", 19)],
      biet_thu: [CB("vi_tri", 2), CB("phuong", 3), CB("dien_tich_dat", 5), CB("gia", 9), CM("ket_cau", 10), CM("so_phong_ngu", 11), CM("san_vuon", 12), CM("do_rong_hem", 13), CM("khu_compound", 14), CM("phap_ly", 15), CM("noi_that", 16, "cho_thue"), CM("tien_coc", 17, "cho_thue"), CM("thoi_han_thue", 18, "cho_thue"), CM("hinh_anh", 19)],
      phong_tro: [CB("vi_tri", 2), CB("phuong", 3), CB("dien_tich", 4), CB("gia", 9), CM("noi_that", 10), CM("gia_dien_nuoc", 11), CM("gio_giac", 12), CM("tien_coc", 13), CM("hinh_anh", 19)],
      mat_bang: [CB("vi_tri", 2), CB("phuong", 3), CB("dien_tich", 4), CB("mat_tien", 7), CB("gia", 9), CM("nganh_hang_phu_hop", 10), CM("thoi_han_thue", 11), CM("tien_coc", 12), CM("truot_gia", 13), CM("hinh_anh", 19)],
    };
    const out = [];
    for (const l of this.t.listings) {
      // 20260909a: view thật không lọc status — tin dang_ban vẫn có câu còn thiếu
      // để cron hỏi bù. Mock lọc là mock nói dối đúng chỗ tính năng này đo.
      const have = new Set(this.t.listing_facts.filter((f) => f.listing_id === l.id).map((f) => f.question));
      if (l.location_raw || l.street || l.project_id) have.add("vi_tri"); // 20260909m
      if (l.price_raw) have.add("gia"); if (l.gap != null) have.add("gap"); if (l.area_m2) { have.add("dien_tich"); have.add("dien_tich_dat"); have.add("dien_tich_tim_tuong"); } if (l.ward) have.add("phuong");
      if (l.property_type && l.property_type !== "chua_ro") have.add("loai_bds"); if (l.bedrooms) have.add("so_phong_ngu");
      if (l.alley_width_m || l.access_type === "mat_tien") { have.add("do_rong_hem"); have.add("do_rong_duong"); } if (l.floors) have.add("ket_cau");
      if (l.legal_status) have.add("phap_ly"); if (l.direction) have.add("huong"); if (l.floor) have.add("tang");
      if (l.planning_status) have.add("quy_hoach"); if (l.year_built) have.add("nam_xay"); if (l.furnishing) have.add("noi_that"); if (l.frontage_m) have.add("mat_tien");
      // Ảnh trong kho (listing_media) = đã có ảnh, như view thật (FR-185).
      if (this.t.listing_media.some((m) => m.listing_id === l.id)) have.add("hinh_anh");
      const loai = REQ[l.property_type ?? "chua_ro"] ? (l.property_type ?? "chua_ro") : "chua_ro";
      for (const [k, priority, nhom, deal] of [...REQ[loai], ...(loai === "chua_ro" ? [] : [["gap", 10, "co_ban", null]])]) {
        if (deal && deal !== (l.deal ?? "ban")) continue;
        if (!have.has(k)) out.push({ listing_id: l.id, fact_key: k, priority, nhom });
      }
    }
    return out;
  }
  // FR-177 d — bản JS của `diem_tin` (20260907h), cùng 7 tiêu chí, cùng điểm.
  diemTin(l) {
    const f = {};
    for (const x of this.t.listing_facts.filter((x) => x.listing_id === l.id)) f[x.question] = x.answer;
    const has = (k) => Object.prototype.hasOwnProperty.call(f, k);
    const thieu = [];
    const coHem = l.alley_width_m != null || l.access_type === "mat_tien" || has("do_rong_hem") || has("do_rong_duong") || ["chung_cu", "phong_tro"].includes(l.property_type);
    const viTri = (l.location_raw ? 7 : 0) + (l.ward ? 4 : 0) + (coHem ? 4 : 0);
    if (!coHem) thieu.push("hẻm rộng mấy mét, xe hơi vào được không");
    const coMt = l.frontage_m != null || has("mat_tien") || ["chung_cu", "phong_tro"].includes(l.property_type) || /\d\s*[xX×]\s*\d/.test(f.dien_tich_dat ?? f.dien_tich ?? "");
    let dt = 0;
    if (l.area_m2 != null) { dt = 12 + (coMt ? 8 : 0); if (!coMt) thieu.push("chiều ngang mặt tiền"); } else thieu.push("diện tích");
    let kc = 0;
    if (l.property_type === "dat") { kc = has("tho_cu") || l.planning_status ? 15 : 0; if (!kc) thieu.push("thổ cư bao nhiêu, quy hoạch ra sao"); }
    else if (l.property_type === "phong_tro") { kc = l.furnishing || has("noi_that") ? 15 : 0; if (!kc) thieu.push("nội thất có gì"); }
    else if (l.property_type === "mat_bang") { kc = l.floors || has("ket_cau") || has("nganh_hang_phu_hop") ? 15 : 0; if (!kc) thieu.push("mấy tầng, hợp ngành gì"); }
    else {
      const coKc = l.floors != null || l.floors_text || has("ket_cau") || l.floor != null || has("tang") || (l.property_type === "nha_cap4" && has("hien_trang"));
      const coPn = l.bedrooms != null || has("so_phong_ngu");
      kc = (coKc ? 8 : 0) + (coPn ? 7 : 0);
      if (!coKc) thieu.push("mấy tầng"); if (!coPn) thieu.push("mấy phòng ngủ");
    }
    let pl = 0;
    if (l.legal_status || has("phap_ly") || l.property_type === "phong_tro") pl = 10; else thieu.push("pháp lý (sổ hồng riêng/chung, hoàn công)");
    const gia = l.price_vnd != null ? 10 : 0; if (!gia) thieu.push("giá");
    let tn = 0;
    const moTa = String(l.description ?? "").toLowerCase();
    // 20260909a: tiềm năng 20 → 10 (nêu rõ 10, suy được 5), nhường 10 cho ảnh.
    if (has("tiem_nang")) tn = 10;
    else {
      if ((l.floors ?? 0) >= 3 || (l.bedrooms ?? 0) >= 3 || l.access_type === "mat_tien" || (l.alley_width_m ?? 0) >= 4 || ["chung_cu", "mat_bang", "phong_tro", "biet_thu"].includes(l.property_type) || has("san_vuon") || /kinh doanh|cho thu|chdv|đầu tư|dau tu|văn phòng|van phong|buôn bán|mở shop|mở quán/.test(moTa)) tn = 5;
      thieu.push("tiềm năng sử dụng (ở, cho thuê hay kinh doanh)");
    }
    const cta = l.code ? 10 : 0;
    // Ảnh 10: đếm TẤM (fact hinh_anh + listing_media), 3 tấm = tối đa, ảnh gì cũng tính.
    const soAnh = this.t.listing_facts.filter((x) => x.listing_id === l.id && x.question === "hinh_anh").length
      + this.t.listing_media.filter((m) => m.listing_id === l.id).length;
    const anh = soAnh >= 3 ? 10 : soAnh === 2 ? 7 : soAnh === 1 ? 4 : 0;
    if (soAnh === 0) thieu.push("vài tấm ảnh (nhà, sổ, hẻm — ảnh nào cũng được)");
    else if (soAnh < 3) thieu.push(`thêm ảnh cho đủ 3 tấm (đang có ${soAnh})`);
    return { diem: viTri + dt + kc + pl + gia + tn + cta + anh, chi_tiet: { vi_tri_hem: viTri, dien_tich: dt, ket_cau: kc, phap_ly: pl, gia, tiem_nang: tn, goi_hanh_dong: cta, anh }, thieu, co_anh: soAnh > 0, so_anh: soAnh };
  }
  // trg_zz_listings_dang_tin (20260828b + 20260907h): cho_thong_tin ↔ dang_ban.
  quyetDinhDangTin(l) {
    let du = !!(l.price_raw && l.area_m2 && l.ward);
    if (du && l.can_chu_duyet) du = !!l.chu_duyet_at && this.diemTin(l).diem >= 70;
    if (du && l.status === "cho_thong_tin") l.status = "dang_ban";
    else if (!du && l.status === "dang_ban") l.status = "cho_thong_tin";
  }
  insert(table, row) {
    const r = { id: randomUUID(), created_at: now(), ...row };
    if (table === "messages") {
      if (r.zalo_msg_id && this.t.messages.some((m) => m.zalo_msg_id === r.zalo_msg_id)) {
        return { error: { code: "23505", message: "duplicate key value violates unique constraint messages_zalo_msg_id_key" } };
      }
      r.seq = ++this.seq;
      // Trigger `trg_messages_bump_last_message` (20260902d): mọi tin đẩy mốc hội thoại.
      const cv = this.t.conversations.find((c) => c.id === r.conversation_id); if (cv) cv.last_message_at = r.created_at;
      if (globalThis.__afterInsertMsg && r.sender === 'buyer') { const h = globalThis.__afterInsertMsg; globalThis.__afterInsertMsg = null; this.rows('messages').push(r); h(this, r); return { data: r }; }
    }
    if (table === "reminders") r.status = r.status ?? "pending"; // DB default 'pending'
    // ── Chỉ mục duy nhất TỪNG PHẦN (20260905f/g) ─────────────────────────────
    // Ba khoá này là thứ DUY NHẤT chặn được mẫu SELECT-rồi-INSERT. Mock không
    // mô phỏng chúng thì ca kiểm cạnh tranh sẽ XANH trong khi bản thật ném
    // 23505 và code chưa biết bắt — tức bộ e2e nói dối theo hướng lạc quan,
    // đúng kiểu nguy nhất. Chép sát định nghĩa trong migration.
    const trung = (msg) => ({ error: { code: "23505", message: msg } });
    if (table === "info_requests" && (r.status ?? "pending") === "pending" &&
        this.t.info_requests.some((x) =>
          x.listing_id === r.listing_id && x.question === r.question && x.status === "pending")) {
      return trung("info_requests_mot_cau_cho_idx");
    }
    if (table === "viewings" && (r.status ?? "pending") === "pending") {
      const neo = (x) => x.listing_code ?? x.listing_id ?? null;
      if (this.t.viewings.some((x) =>
        x.status === "pending" && x.buyer_id === r.buyer_id && neo(x) === neo(r))) {
        return trung("viewings_mot_hen_cho_moi_can_idx");
      }
    }
    if (table === "reminders" && r.kind === "viewing" && r.status === "pending" && r.viewing_id &&
        this.t.reminders.some((x) =>
          x.kind === "viewing" && x.status === "pending" && x.viewing_id === r.viewing_id)) {
      return trung("reminders_mot_nhac_moi_buoi_xem_idx");
    }
    if (table === "deals" &&
        this.t.deals.some((x) => x.listing_id === r.listing_id && x.buyer_id === r.buyer_id)) {
      return trung("deals_listing_buyer_key");
    }
    if (table === "listings") {
      r.code = r.code ?? `BDS-Q5-${String(this.t.listings.length + 1).padStart(4, "0")}`;
      r.status = r.status ?? "cho_thong_tin";
      if (r.price_raw && r.price_vnd == null) r.price_vnd = parseVnd(r.price_raw);
      // trg_listings_fill_property_type (FR-150): đoán loại từ câu rao.
      if ((r.property_type ?? "chua_ro") === "chua_ro" && r.description) {
        // 20260910b: luôn so trên chuỗi ĐÃ BỎ DẤU — người thật gõ lẫn có dấu /
        // thiếu dấu trong cùng câu ("bán căn ho ở Hà đô centrosa").
        const d = boDauMock(String(r.description));
        r.property_type = /kho bai|kho xuong|nha xuong/.test(d) ? "kho_xuong"
          : /nong nghiep|dat vuon|dat lua/.test(d) ? "dat_nong_nghiep"
          : /skc|tmd|thuong mai dich vu|san xuat kinh doanh/.test(d) ? "dat_kinh_doanh"
          : /can ho dich vu|chdv|khach san|toa nha/.test(d) ? "toa_nha"
          : /chung cu|can ho|canho|\bcc\b|\bch\b/.test(d) ? "chung_cu"
          : /\bdat\b|lo dat|dat nen/.test(d) ? "dat"
          : /\bnha\b|nha pho|\bnp\b|tret|\blau\b|hem|mat tien/.test(d) ? "nha_pho" : "chua_ro";
      }
      // (Không chạy quyết định lên kệ lúc chèn: seed cố ý dựng tin "chưa đăng"
      //  có đủ giá/diện tích/phường để kiểm SEC — V4.1/V4.7.)
    }
    this.rows(table).push(r);
    return { data: r };
  }
}
// Bỏ dấu — bản mock của public.bo_dau() trong DB.
export const boDauMock = (s) =>
  String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

// đủ cho "5 tỷ 8", "5,5 tỷ", "800 triệu"
export function parseVnd(s) {
  const t = String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  let m = /(\d+)\s*ty\s*(\d)(?!\d)/.exec(t); if (m) return +m[1] * 1e9 + +m[2] * 1e8;
  m = /(\d+(?:[.,]\d+)?)\s*(ty|ti)/.exec(t); if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1e9);
  m = /(\d+(?:[.,]\d+)?)\s*(trieu|tr)/.exec(t); if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1e6);
  // "7t" = 7 tỷ (20260908a). Sau luật `tr` để "7tr" vẫn là triệu; \b sau `t`
  // nên "7 tấm" không dính (bản thật dùng \M của Postgres, cùng ý).
  m = /(\d+(?:[.,]\d+)?)\s*t\b/.exec(t); if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 1e9);
  return null;
}

function parseSelect(sel) {
  const items = []; let depth = 0, cur = "";
  for (const ch of sel) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { items.push(cur.trim()); cur = ""; } else cur += ch; }
  if (cur.trim()) items.push(cur.trim());
  return items.map((it) => {
    const m = /^([a-z_]+)(!inner)?\((.*)\)$/.exec(it);
    return m ? { embed: m[1], inner: !!m[2], cols: m[3].split(",").map((s) => s.trim()) } : { col: it };
  });
}

class Builder {
  constructor(db, table) { this.db = db; this.table = table; this.filters = []; this.op = "select"; this.sel = "*"; this.embedFilters = []; }
  select(cols = "*", opts = {}) { if (this.op === "select") { this.sel = cols; this.count = opts.count; this.head = opts.head; } else this.returning = cols; return this; }
  insert(p) { this.op = "insert"; this.payload = p; return this; }
  update(p) { this.op = "update"; this.payload = p; return this; }
  _f(kind, col, val) { (col.includes(".") ? this.embedFilters : this.filters).push({ kind, col, val }); return this; }
  eq(c, v) { return this._f("eq", c, v); } neq(c, v) { return this._f("neq", c, v); } in(c, v) { return this._f("in", c, v); }
  gte(c, v) { return this._f("gte", c, v); } lte(c, v) { return this._f("lte", c, v); } gt(c, v) { return this._f("gt", c, v); } lt(c, v) { return this._f("lt", c, v); }
  not(c, op, v) { return this._f("not_" + op, c, v); } ilike(c, v) { return this._f("ilike", c, v); }
  // `.is(col, null)` của PostgREST — SEC-13 dùng nó để chỉ đụng dòng CHƯA chốt
  // gửi. Thiếu ở mock thì bộ e2e đo một hành vi khác với bản chạy thật.
  is(c, v) { return this._f("is", c, v); }
  // `.or("code.ilike.X,legacy_code.ilike.X")` của PostgREST — chat-reply (03724e4,
  // chuẩn hoá mã tin) tra mã bằng CẢ `code` lẫn `legacy_code`. Cú pháp: các mệnh
  // đề `cột.toán_tử.giá_trị` cách nhau dấu phẩy, khớp MỘT mệnh đề là đủ. Thiếu
  // hàm này thì bundle ném TypeError ngay lượt đầu và 208 ca không chạy ca nào
  // (CI đỏ 6 lần liên tiếp 08/09 mà không ai nhìn). Mệnh đề lạ → ném lỗi, không
  // lặng lẽ coi là đúng.
  or(expr) {
    const items = String(expr).split(",").map((s) => {
      const m = /^([a-z_]+)\.(eq|neq|gt|gte|lt|lte|ilike|like|is)\.(.*)$/i.exec(s.trim());
      if (!m) throw new Error(`mock-supabase: .or() không hiểu mệnh đề "${s}"`);
      let val = m[3];
      if (m[2] === "is") val = val === "null" ? null : val === "true";
      return { kind: m[2] === "like" ? "ilike" : m[2], col: m[1], val };
    });
    return this._f("or", "__or__", items);
  }
  order(c, o = {}) { this.ord = { c, asc: o.ascending !== false }; return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  single() { this.mode = "single"; return this; }
  static test(f, row) {
    const v = row[f.col];
    switch (f.kind) {
      case "eq": return v === f.val; case "neq": return v !== f.val; case "in": return f.val.includes(v);
      case "gte": return v != null && v >= f.val; case "lte": return v != null && v <= f.val; case "gt": return v > f.val; case "lt": return v < f.val;
      case "is": return f.val === null ? v == null : v === f.val;
      case "or": return f.val.some((sub) => Builder.test(sub, row));
      case "not_is": return f.val === null ? v != null : v !== f.val;
      case "ilike": { const p = "^" + String(f.val).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$"; return new RegExp(p, "i").test(String(v ?? "")); }
    }
    return true;
  }
  embedOf(row, embed) {
    const fk = singular(embed) + "_id";
    if (fk in row) return { one: true, rows: this.db.rows(embed).filter((r) => r.id === row[fk]) };
    const back = singular(this.table) + "_id";
    return { one: false, rows: this.db.rows(embed).filter((r) => r[back] === row.id) };
  }
  run() {
    const db = this.db; const t = this.table;
    db.log.push({ table: t, op: this.op, filters: this.filters, embedFilters: this.embedFilters, payload: this.payload, sel: this.sel });
    if (this.op === "insert") {
      const arr = Array.isArray(this.payload) ? this.payload : [this.payload]; const out = [];
      for (const p of arr) { const r = db.insert(t, p); if (r.error) return { data: null, error: r.error }; out.push(r.data); }
      return this.mode === "single" ? { data: out[0], error: null } : { data: out, error: null };
    }
    let rows = db.rows(t).filter((r) => this.filters.every((f) => Builder.test(f, r)));
    if (this.op === "update") {
      rows.forEach((r) => Object.assign(r, this.payload));
      if (t === "listings") rows.forEach((r) => db.quyetDinhDangTin(r));
      return { data: rows, error: null };
    }
    const items = parseSelect(this.sel);
    // lọc theo embed (vd listings.seller_id) + !inner
    rows = rows.filter((r) => {
      for (const it of items) if (it.embed) {
        const e = this.embedOf(r, it.embed);
        const ok = e.rows.filter((er) => this.embedFilters.filter((f) => f.col.startsWith(it.embed + ".")).every((f) => Builder.test({ ...f, col: f.col.split(".")[1] }, er)));
        if (it.inner && ok.length === 0) return false;
      }
      return true;
    });
    if (this.ord) rows.sort((a, b) => (a[this.ord.c] > b[this.ord.c] ? 1 : a[this.ord.c] < b[this.ord.c] ? -1 : 0) * (this.ord.asc ? 1 : -1));
    if (this.lim != null) rows = rows.slice(0, this.lim);
    if (this.head) return { data: null, count: rows.length, error: null };
    const proj = rows.map((r) => {
      const o = {};
      for (const it of items) {
        if (it.col === "*") Object.assign(o, r);
        else if (it.col) o[it.col] = r[it.col];
        else {
          const e = this.embedOf(r, it.embed);
          const ok = e.rows.filter((er) => this.embedFilters.filter((f) => f.col.startsWith(it.embed + ".")).every((f) => Builder.test({ ...f, col: f.col.split(".")[1] }, er)));
          const pick = (er) => Object.fromEntries(it.cols.map((c) => [c, er[c]]));
          o[it.embed] = e.one ? (ok[0] ? pick(ok[0]) : null) : ok.map(pick);
        }
      }
      return o;
    });
    if (this.mode === "maybe") return { data: proj[0] ?? null, error: null };
    if (this.mode === "single") return proj[0] ? { data: proj[0], error: null } : { data: null, error: { code: "PGRST116", message: "0 rows" } };
    return { data: proj, error: null, count: this.count ? proj.length : undefined };
  }
  // ĐỘ TRỄ GIẢ — chỗ cuộc đua thật sự sống.
  // Bản trước chạy `run()` gần như tức thời, nên hai handler gọi song song vẫn
  // nối đuôi nhau: handler A xong cả khối SELECT→INSERT rồi B mới bắt đầu, và
  // ca kiểm "đua" đo được đúng con số như khi không có đua. Đã đo: tắt hết chỉ
  // mục duy nhất trong mock mà 129/129 vẫn xanh — bộ kiểm câm.
  // Cuộc đua thật nằm ở ĐỘ TRỄ MẠNG giữa lúc đọc và lúc ghi. `__treTruyVan`
  // cho ca kiểm chèn đúng độ trễ đó: `(bang, op) => số ms`.
  then(res, rej) {
    const tre = globalThis.__treTruyVan?.(this.table, this.op ?? "select") ?? 0;
    const chay = () => { try { return Promise.resolve(this.run()); } catch (e) { return Promise.reject(e); } };
    if (!tre) return chay().then(res, rej);
    return new Promise((ok) => setTimeout(ok, tre)).then(chay).then(res, rej);
  }
}

class RpcCall {
  constructor(db, name, args) { this.db = db; this.name = name; this.args = args; }
  single() { this.mode = "single"; return this; } maybeSingle() { this.mode = "maybe"; return this; }
  run() {
    const db = this.db; const a = this.args ?? {}; db.log.push({ rpc: this.name, args: a });
    const R = globalThis.__rpc ?? {};
    if (R[this.name]) return R[this.name](db, a);
    switch (this.name) {
      // Vault giả. Mặc định RỖNG (không secret nào) — giữ nguyên hành vi cũ cho
      // bộ chat-reply. Ca kiểm nào cần secret thì đặt `globalThis.__vault`, một
      // hàm `(tên) => { data, error }`. Đây là cách bộ kiểm có secret riêng mà
      // KHÔNG bao giờ chạm secret production: giá trị dưới đây là chuỗi bịa,
      // sống trong tiến trình test, không đọc env thật, không gọi Vault thật.
      // `error` khác null là cảnh ĐỌC HỤT — khác hẳn cảnh "chưa đặt" (data null,
      // error null). Hai cảnh này đi hai nhánh khác nhau trong zalo-webhook, và
      // gộp chúng làm một chính là lỗi SEC-02 cũ.
      case "get_secret":
        return globalThis.__vault ? globalThis.__vault(a.secret_name) : { data: null, error: null };
      // 20260909b — công tắc test: mặc định BẬT trong e2e (như DB test hiện tại).
      // FR-180: mẫu câu chuẩn cho prompt — e2e đặt globalThis.__mauCau = { ban, mua }.
      case "mau_cau_fewshot":
        return { data: (globalThis.__mauCau ?? {})[a.p_phia] ?? "", error: null };
      case "cau_hinh":
        return { data: (globalThis.__cauHinh ?? { test_reset_hello: "1" })[a.p_key] ?? null, error: null };
      case "reset_nguoi_test": {
        const z = a.p_zalo;
        const sIds = db.t.sellers.filter((s) => s.zalo_user_id === z).map((s) => s.id);
        const bIds = db.t.buyers.filter((b) => b.zalo_user_id === z).map((b) => b.id);
        const lIds = db.t.listings.filter((l) => sIds.includes(l.seller_id)).map((l) => l.id);
        const cIds = db.t.conversations.filter((c) => sIds.includes(c.seller_id) || bIds.includes(c.buyer_id)).map((c) => c.id);
        const bo = (t, f) => { const n = db.t[t].length; db.t[t] = db.t[t].filter((r) => !f(r)); return n - db.t[t].length; };
        bo("deals", (r) => lIds.includes(r.listing_id) || bIds.includes(r.buyer_id));
        bo("viewings", (r) => lIds.includes(r.listing_id) || bIds.includes(r.buyer_id));
        bo("info_requests", (r) => lIds.includes(r.listing_id) || bIds.includes(r.buyer_id));
        const nM = bo("messages", (r) => cIds.includes(r.conversation_id));
        const nC = bo("conversations", (r) => cIds.includes(r.id));
        for (const t of ["listing_facts", "interests", "reminders", "ratings"]) bo(t, (r) => lIds.includes(r.listing_id) || bIds.includes(r.buyer_id) || sIds.includes(r.seller_id));
        const nL = bo("listings", (r) => lIds.includes(r.id));
        const nS = bo("sellers", (r) => sIds.includes(r.id));
        const nB = bo("buyers", (r) => bIds.includes(r.id));
        return { data: { ok: true, listings: nL, messages: nM, conversations: nC, sellers: nS, buyers: nB }, error: null };
      }
      // Chép ĐÚNG ngữ nghĩa hàm thật (đã đọc `pg_get_functiondef` 05/09/2026):
      //   insert … on conflict (event_id) do update
      //     set delivery_count = delivery_count + 1, last_seen_at = now()
      //   returning delivery_count
      // Tức giao trùng KHÔNG đẻ dòng thứ hai, chỉ đếm thêm — đó là cả cái cột
      // sống của chống-giao-trùng (FR-162). Mock mà chỉ push thêm dòng thì ca
      // "duplicate webhook" sẽ xanh trong khi hàm thật chưa chắc đúng.
      case "ghi_su_kien_inbound": {
        const co = db.t.inbound_events.find((x) => x.event_id === a.p_event_id);
        if (co) { co.delivery_count++; co.last_seen_at = now(); return { data: co.delivery_count, error: null }; }
        db.t.inbound_events.push({
          event_id: a.p_event_id, zalo_user_id: a.p_zalo_user_id, payload: a.p_payload,
          delivery_count: 1, first_seen_at: now(), last_seen_at: now(),
        });
        return { data: 1, error: null };
      }
      // 20260905h — chép đúng hai điều kiện lọc của hàm thật. Hàm thật xếp hàng
      // bằng `pg_advisory_xact_lock` theo từng khách; ở đây `run()` chạy ĐỒNG BỘ
      // (không `await` nào ở giữa) nên đọc-rồi-ghi không xen được — đúng cái mà
      // khoá tư vấn bảo đảm bên DB. Chính vì vậy ca ĐUA-4 mới xanh sau khi vá và
      // ĐỎ trước khi vá (lúc app còn đi hai truy vấn rời).
      case "mo_viec_can_nguoi_that": {
        const cua24h = Date.now() - 24 * 3600e3;
        const da = db.t.reminders.filter((r) =>
          r.buyer_id === a.p_buyer_id && r.kind === "escalation" &&
          (a.p_voice
            ? ["pending", "sent"].includes(r.status) &&
              /^voice:/i.test(String(r.note ?? "")) &&
              Date.parse(r.created_at) > cua24h
            : r.status === "pending")).length;
        if (da > 0) return { data: false, error: null };
        db.insert("reminders", {
          kind: "escalation", buyer_id: a.p_buyer_id, ctv_id: a.p_ctv_id ?? null,
          due_at: now(), note: a.p_note,
        });
        return { data: true, error: null };
      }
      // 20260905i — lease chiều GỬI. Hàm thật là MỘT câu `update … where
      // sent_at is null and (sending_until is null or sending_until < now())`,
      // nguyên tử ở tầng hàng. Ở đây `run()` chạy đồng bộ nên cũng nguyên tử —
      // đúng cái mà Postgres bảo đảm. Chép sát điều kiện, kể cả "đã gửi xong
      // thì không giành nữa": bỏ vế đó là mock rộng hơn hàm thật.
      case "giu_luot_gui": {
        const l = db.t.inbound_ledger.find((x) => x.zalo_msg_id === a.p_msg_id);
        // 20260905j: KHÔNG có dòng sổ ≠ có người giữ. Gộp hai cảnh đó vào cùng
        // một `false` là bỏ luôn cú gửi — khách không nhận được gì.
        if (!l) return { data: true, error: null };
        if (l.sent_at) return { data: false, error: null };
        if (l.sending_until && Date.parse(l.sending_until) > Date.now()) {
          return { data: false, error: null };
        }
        l.sending_until = new Date(Date.now() + (a.p_han_secs ?? 120) * 1000).toISOString();
        l.updated_at = now();
        return { data: true, error: null };
      }
      case "nha_luot_gui": {
        const l = db.t.inbound_ledger.find((x) => x.zalo_msg_id === a.p_msg_id);
        if (l) { l.sending_until = null; l.updated_at = now(); }
        return { data: null, error: null };
      }
      case "log_loi": db.t.bot_errors.push({ at: now(), source: a.p_source, detail: a.p_detail, status_code: a.p_code }); return { data: null, error: null };
      case "cong_token": db.t.bot_usage.push(a); return { data: null, error: null };
      case "bump_model_quota": return { data: true, error: null };
      // SEC-05 — trần cá nhân. Mặc định cho qua; ca kiểm đè bằng
      // `globalThis.__rpc = { bump_user_quota: () => ({ data: false, error: null }) }`.
      case "bump_user_quota": return { data: true, error: null };
      // ══ claim_inbound — chép ĐỦ NĂM NHÁNH của hàm thật ══
      // (đọc `pg_get_functiondef` 05/09/2026; xem migration FR-166)
      // Bản mock cũ chỉ có ba nhánh: mới / completed / còn lại-thì-nhận. Thiếu
      // `in_flight` (processing còn tươi), `dead` (đủ 8 lượt) và `next_retry_at`.
      // Thiếu đúng ba nhánh mà `chat-reply` xử KHÁC HẲN nhau — nghĩa là ba
      // đường thoát quan trọng nhất của chống-trùng chưa từng được ca kiểm nào
      // chạm tới. Mock hẹp hơn hàm thật thì bộ e2e xanh mà không chứng minh gì.
      //
      // `created_at` PHẢI có: bảng thật khai `not null default now()`, và cổng
      // `mark_sent` (SEC-13) lọc `.gte("created_at", 15 phút trước)`.
      case "claim_inbound": {
        const STALE = (a.p_stale_secs ?? 150) * 1000;
        const MAX = 8;
        let l = db.t.inbound_ledger.find((x) => x.zalo_msg_id === a.p_msg_id);
        if (!l) {
          l = { zalo_msg_id: a.p_msg_id, status: "processing", attempts: 1, reply: null,
                created_at: now(), updated_at: now(), started_at: now(), next_retry_at: null };
          db.t.inbound_ledger.push(l);
          return { data: { r_state: "received", r_attempts: 1, r_sent_at: null, r_dead: false }, error: null };
        }
        if (l.status === "completed") {
          return { data: { r_state: "completed", r_reply: l.reply, r_attempts: l.attempts, r_sent_at: l.sent_at ?? null, r_dead: false }, error: null };
        }
        if (l.status === "dead") {
          return { data: { r_state: "dead", r_reply: l.reply, r_attempts: l.attempts, r_sent_at: l.sent_at ?? null, r_dead: true }, error: null };
        }
        // Đang có lượt khác cầm và còn tươi → KHÔNG cấp sổ lần hai.
        if (l.status === "processing" && Date.parse(l.updated_at ?? l.created_at) > Date.now() - STALE) {
          return { data: { r_state: "in_flight", r_attempts: l.attempts, r_sent_at: l.sent_at ?? null, r_dead: false }, error: null };
        }
        // Chưa tới giờ hẹn lùi dần → cũng không cấp.
        if (l.next_retry_at && Date.parse(l.next_retry_at) > Date.now()) {
          return { data: { r_state: "in_flight", r_attempts: l.attempts, r_sent_at: l.sent_at ?? null, r_dead: false }, error: null };
        }
        if (l.attempts >= MAX) {
          l.status = "dead"; l.finished_at = now(); l.updated_at = now();
          return { data: { r_state: "dead", r_reply: l.reply, r_attempts: l.attempts, r_sent_at: l.sent_at ?? null, r_dead: true }, error: null };
        }
        l.status = "processing"; l.attempts++; l.started_at = now();
        l.next_retry_at = null; l.updated_at = now();
        return { data: { r_state: "received", r_reply: l.reply, r_attempts: l.attempts, r_sent_at: l.sent_at ?? null, r_dead: false }, error: null };
      }
      // bao_hong_inbound — cũng chép đủ nhánh: `completed` thì KHÔNG hạ cấp
      // (guard `inbound_ledger_giu_completed`), đủ 8 lượt thì sang thư chết,
      // còn lại thì `failed` kèm giờ hẹn lùi dần.
      case "bao_hong_inbound": {
        const l = db.t.inbound_ledger.find((x) => x.zalo_msg_id === a.p_msg_id);
        if (!l) return { data: "khong_co", error: null };
        if (l.status === "completed") return { data: "da_completed", error: null };
        if (l.attempts >= 8) {
          l.status = "dead"; l.detail = a.p_detail; l.finished_at = now(); l.updated_at = now();
          return { data: "dead", error: null };
        }
        // `lan_thu_ke`: 30s × 2^(attempts-1), trần 1 giờ. Bỏ phần ngẫu nhiên
        // ±20% của hàm thật — ca kiểm cần con số đoán được.
        const cho = Math.min(30e3 * 2 ** (Math.max(l.attempts, 1) - 1), 3600e3);
        l.status = "failed"; l.detail = a.p_detail;
        l.next_retry_at = new Date(Date.now() + cho).toISOString();
        l.updated_at = now();
        return { data: "failed", error: null };
      }
      case "ensure_buyer_conversation": {
        let b = db.t.buyers.find((x) => x.zalo_user_id === a.p_zalo_user_id);
        if (!b) b = db.insert("buyers", { zalo_user_id: a.p_zalo_user_id, name: null, preferences: {} }).data;
        let c = db.t.conversations.filter((x) => x.buyer_id === b.id).sort((x, y) => (x.started_at < y.started_at ? 1 : -1))[0];
        if (!c) c = db.insert("conversations", { buyer_id: b.id, channel: a.p_channel, started_at: now(), human_touch_at: null, ctv_id: null }).data;
        return { data: { b_id: b.id, b_name: b.name, b_prefs: b.preferences, c_id: c.id, c_ctv_id: c.ctv_id ?? null, c_human_touch_at: c.human_touch_at ?? null, c_human_hold: c.human_hold === true }, error: null };
      }
      case "tao_followup": {
        // 20260902d: một nhắc follow-up còn hiệu lực mỗi khách mỗi 24h
        const l = db.t.listings.find((x) => x.code === a.p_code); if (!l) return { data: false, error: null };
        const since = Date.now() - 24 * 3600e3;
        if (db.t.reminders.some((r) => r.buyer_id === a.p_buyer_id && r.kind === "followup" && ["pending","sent"].includes(r.status) && Date.parse(r.created_at) > since)) return { data: false, error: null };
        db.insert("reminders", { kind: "followup", buyer_id: a.p_buyer_id, listing_id: l.id, due_at: new Date(Date.now() + 150 * 60e3).toISOString(), note: `khách hỏi #${a.p_code} rồi im — chủ động gửi thêm thông tin căn này` });
        return { data: true, error: null };
      }
      case "ensure_seller_conversation": {
        let c = db.t.conversations.find((x) => x.seller_id === a.p_seller_id);
        if (!c) c = db.insert("conversations", { seller_id: a.p_seller_id, channel: a.p_channel, started_at: now(), human_touch_at: null }).data;
        return { data: { c_id: c.id, c_human_touch_at: c.human_touch_at, c_human_hold: c.human_hold === true }, error: null };
      }
      case "mo_ho_so_nguoi_ban": {
        let s = db.t.sellers.find((x) => x.zalo_user_id === a.p_zalo_user_id);
        if (!s) s = db.insert("sellers", { zalo_user_id: a.p_zalo_user_id, seller_type: a.p_seller_type ?? "ccrb", name: null, active_listing_id: null }).data;
        else if (s.seller_type === "unknown") s.seller_type = a.p_seller_type ?? "ccrb";
        const row = { id: s.id, name: s.name, active_listing_id: s.active_listing_id, seller_type: s.seller_type };
        return { data: this.mode ? row : [row], error: null };
      }
      case "merge_buyer_prefs": { const b = db.t.buyers.find((x) => x.id === a.p_buyer_id); if (b) b.preferences = { ...(b.preferences ?? {}), ...(a.p_delta ?? {}) }; return { data: null, error: null }; }
      case "ghi_fact_listing": {
        const l = db.t.listings.find((x) => x.id === a.p_listing_id); if (!l) return { data: null, error: { message: "listing khong ton tai" } };
        db.insert("listing_facts", { listing_id: l.id, question: a.p_question, answer: a.p_answer, source: a.p_source });
        // 20260909a: trg_zz_fact_vao_boc_tach + trg_zz_vi_tri_vao_cot
        l.boc_tach = { ...(l.boc_tach ?? {}), [a.p_question]: a.p_answer, _cap_nhat: now() };
        if (a.p_question === "vi_tri" && !l.location_raw) l.location_raw = String(a.p_answer).trim();
        if (a.p_question === "gia") { l.price_raw = a.p_answer; l.price_vnd = parseVnd(a.p_answer); }
        if (a.p_question === "phuong") l.ward = a.p_answer;
        if (a.p_question === "gap") {
          const kd = String(a.p_answer).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
          l.gap = /\b(khong|ko|k|chua|chang)\s*(can\s*)?(gap|voi)\b|duoc gia thi thoi|khong voi|tu tu/.test(kd) ? false : /\bgap\b|can tien|\bvoi\b/.test(kd) ? true : l.gap;
        }
        if (a.p_question === "dien_tich" || a.p_question === "dien_tich_dat") {
          const m = /(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/.exec(a.p_answer);
          l.area_m2 = m ? parseFloat(m[1].replace(",", ".")) * parseFloat(m[2].replace(",", ".")) : parseFloat(String(a.p_answer).replace(",", "."));
          if (m) l.frontage_m = parseFloat(m[1].replace(",", "."));
        }
        if (a.p_question === "so_phong_ngu") l.bedrooms = parseInt(a.p_answer, 10);
        // listing_facts_sync_cols + boc_thong_so (rút gọn): đủ để điểm FR-177 đo được.
        if (a.p_question === "mat_tien") l.frontage_m = parseFloat(String(a.p_answer).replace(",", "."));
        if (a.p_question === "do_rong_hem") { const m = /(\d+(?:[.,]\d+)?)/.exec(a.p_answer); if (m) l.alley_width_m = parseFloat(m[1].replace(",", ".")); if (/xe hơi|xe hoi/i.test(a.p_answer)) l.access_type = l.access_type ?? "hem_xe_hoi"; }
        if (a.p_question === "ket_cau") { const m = /(\d+)\s*(?:lầu|lau|tầng|tang|tấm|tam)/i.exec(a.p_answer); if (m) l.floors = parseInt(m[1], 10) + (/lầu|lau/i.test(a.p_answer) ? 1 : 0); const pn = /(\d+)\s*(?:phòng ngủ|phong ngu|pn)/i.exec(a.p_answer); if (pn) l.bedrooms = parseInt(pn[1], 10); }
        if (a.p_question === "phap_ly" && /sổ hồng riêng|so hong rieng|shr/i.test(a.p_answer)) l.legal_status = "so_hong_rieng";
        db.quyetDinhDangTin(l);
        return { data: null, error: null };
      }
      case "diem_tin": {
        const l = db.t.listings.find((x) => x.id === a.p_listing_id);
        return { data: l ? db.diemTin(l) : null, error: null };
      }
      // FR-183 (20260909h): điểm người rao = TB diem_tin các tin đang rao × hệ số
      // quy mô NMG (+6%/căn ≤10, +4% 11–30, +1,5% >30), trần 100 — chép đúng hàm thật.
      case "diem_nguoi_ban": {
        const s = db.t.sellers.find((x) => x.id === a.p_seller_id);
        if (!s) return { data: null, error: null };
        const ls = db.t.listings.filter((l) => l.seller_id === s.id && ["dang_ban", "dang_quan_tam", "cho_thong_tin"].includes(l.status));
        if (!ls.length) return { data: { diem: 0, diem_tb: 0, so_tin: 0, he_so: 1 }, error: null };
        const tb = ls.reduce((t, l) => t + db.diemTin(l).diem, 0) / ls.length;
        const n = ls.length;
        const heSo = s.seller_type === "nmg" ? 1 + 0.06 * Math.min(n, 10) + 0.04 * Math.max(Math.min(n, 30) - 10, 0) + 0.015 * Math.max(n - 30, 0) : 1;
        return { data: { diem: Math.min(100, Math.round(tb * heSo)), diem_tb: Math.round(tb * 10) / 10, so_tin: n, he_so: heSo }, error: null };
      }
      case "ghi_boc_tach": {
        // 20260909a: gộp, bỏ null, đóng dấu _cap_nhat
        const l = db.t.listings.find((x) => x.id === a.p_listing_id); if (!l) return { data: null, error: null };
        const sach = Object.fromEntries(Object.entries(a.p ?? {}).filter(([, v]) => v !== null && v !== undefined));
        l.boc_tach = { ...(l.boc_tach ?? {}), ...sach, _cap_nhat: now() };
        return { data: null, error: null };
      }
      case "guess_property_type_answer": { const t = boDauMock(String(a.p_text)); return { data: /kho|xuong/.test(t) ? "kho_xuong" : /nong nghiep|dat vuon/.test(t) ? "dat_nong_nghiep" : /skc|tmd|thuong mai/.test(t) ? "dat_kinh_doanh" : /dich vu|khach san|toa nha/.test(t) ? "toa_nha" : /nha pho|\bnp\b/.test(t) ? "nha_pho" : /chung cu|can ho|canho|\bcc\b|\bch\b/.test(t) ? "chung_cu" : null, error: null }; }
      case "mark_listing_interest": {
        // v48 / 20260904f (FR-108): overload có p_buyer_id ghi thêm `interests`
        // (PK buyer_id+listing_id — chèn trùng thì bỏ qua).
        let n = 0;
        for (const l of db.t.listings) if (a.p_codes.includes(l.code)) {
          if (["dang_ban", "dang_quan_tam"].includes(l.status)) { l.status = "dang_quan_tam"; n++; }
          if (a.p_buyer_id && !db.t.interests.some((i) => i.buyer_id === a.p_buyer_id && i.listing_id === l.id)) db.insert("interests", { buyer_id: a.p_buyer_id, listing_id: l.id });
        }
        return { data: n, error: null };
      }
      case "ghi_danh_gia": { db.insert("ratings", { buyer_id: a.p_buyer_id, listing_id: a.p_listing_id, stars: a.p_stars, note: a.p_note }); return { data: null, error: null }; }
      // FR-195: kho thông tin dự án lượm từ chat (20260910f).
      case "ghi_fact_du_an": {
        const t = db.rows("project_facts");
        if (!a.p_project_id || !String(a.p_gia_tri ?? "").trim()) return { data: null, error: null };
        if (t.some((x) => x.project_id === a.p_project_id && x.khoa === a.p_khoa && x.gia_tri === a.p_gia_tri)) return { data: null, error: null };
        const r = { id: t.length + 1, project_id: a.p_project_id, khoa: a.p_khoa, gia_tri: String(a.p_gia_tri).trim(), nguon: a.p_nguon ?? "seller_chat", listing_id: a.p_listing_id ?? null, conversation_id: a.p_conversation_id ?? null, trang_thai: "cho_duyet", created_at: new Date().toISOString() };
        t.push(r);
        return { data: r.id, error: null };
      }
      case "match_projects": return { data: [], error: null };
      case "nguoi_noi_bo": {
        // 20260903a (FR-173 d): CTV đang hoạt động trước, rồi admin; người lạ → null
        const c = db.t.ctvs.find((x) => x.active !== false && x.zalo_user_id === a.p_zalo);
        if (c) return { data: { vai: "ctv", id: c.id, name: c.name }, error: null };
        const ad = db.t.admins.find((x) => x.zalo_user_id === a.p_zalo);
        if (ad) return { data: { vai: "admin", id: null, name: ad.email ?? "admin" }, error: null };
        return { data: null, error: null };
      }
    }
    return { data: null, error: { message: `rpc ${this.name} chưa giả lập` } };
  }
  then(res, rej) { try { return Promise.resolve(this.run()).then(res, rej); } catch (e) { return Promise.reject(e).then(res, rej); } }
}

export function createClient() {
  const db = globalThis.__db;
  // FR-185: Storage giả — `upload` cất byte vào db.storage, `remove` gỡ. Đặt
  // `globalThis.__storageHong = true` để dựng cảnh kho hỏng (chat-reply phải rơi
  // về fact URL tạm + ghi sổ lỗi, không nuốt ảnh).
  const storage = {
    from: (bucket) => ({
      upload: async (path, bytes, opts) => {
        db.log.push({ storage: "upload", bucket, path });
        if (globalThis.__storageHong) return { data: null, error: { message: "storage hỏng (giả)" } };
        db.storage.push({ bucket, path, size: bytes?.byteLength ?? 0, contentType: opts?.contentType ?? null });
        return { data: { path }, error: null };
      },
      remove: async (paths) => { db.storage = db.storage.filter((f) => !(f.bucket === bucket && paths.includes(f.path))); return { data: null, error: null }; },
    }),
  };
  return { from: (t) => new Builder(db, t), rpc: (n, a) => new RpcCall(db, n, a), storage };
}
