import { FakeDB, napPhuongCuThat, napPhuongThat } from "./mock-supabase.mjs";
import { laNgungHangLoat as laNgungHangLoatLuat } from "../../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts";
import { OUT } from "./mock-anthropic.mjs";
import { LOI_CHAO, tenTroLy } from "../../supabase/functions/_shared/prompts.ts";
import { createHash as bamSha } from "node:crypto";
// SRS-5.1zl: khoá mà doc_prompt_khac (mock) sẽ trả cho một lượt gọi đã ghi trong log.
class RpcTra {
  constructor(l) { const bam = l.args?.p_bam ?? {}; this.khoa = (globalThis.__db.t.bot_prompts ?? []).filter((r) => r.key in bam && bam[r.key] !== bamSha("sha256").update(r.content ?? "", "utf8").digest("hex")).map((r) => r.key); }
  co(k) { return this.khoa.includes(k); }
} // FR-181: cùng hàm băm với chat-reply
globalThis.__calls = []; globalThis.__db = new FakeDB();
// 09/09/2026: câu hỏi mẫu + lời chào sửa được ở Dashboard — seed bot_prompts trước lượt đầu
// (napCauHinh nhớ tạm 60 s, đọc một lần cho cả run). vi_tri đổi câu để chứng minh bản DB đè bản code.
// 11/09 (42 ca): câu hỏi địa chỉ LẦN ĐẦU dùng khoá riêng `vi_tri@lan_dau` — đè cả hai để V1.3 vẫn đo đúng "bản DB đè bản code".
const seedBotPrompts = (d) => { d.insert("bot_prompts", { key: "cau_hoi_mau", content: JSON.stringify({ vi_tri: "Nhà mình ở đâu vậy {ac}, đường nào số mấy?", "vi_tri@lan_dau": "Nhà mình ở đâu vậy {ac}, đường nào số mấy?", "vi_tri@chua_quan": "Nhà mình ở đâu vậy {ac}, đường nào số mấy?" }) });
globalThis.__db.insert("bot_prompts", { key: "loi_chao", content: "Dạ em chào anh/chị, em là {ten} bên AI Ơi Nhà Đất ạ. Anh/chị cần giao bán bất động sản đúng không ạ?" }); }; // 23/09 FR-218 a: bỏ câu "anh Thu phụ trách khu vực" (khớp bot_prompts.loi_chao)
seedBotPrompts(globalThis.__db);
// FR-185: ảnh chủ nhà gửi được TẢI VỀ kho — mock fetch trả vài byte JPEG cho host Zalo,
// mọi URL khác lỗi (chat-reply không được gọi ra ngoài trong bài kiểm).
globalThis.__anhTaiDuoc = true;
globalThis.__choAlbumMs = 0; // 01/10/2026: gộp album ảnh chờ 8s trên production; e2e không chờ
globalThis.fetch = async (url) => {
  globalThis.__fetches = [...(globalThis.__fetches ?? []), String(url)];
  // FR-209: Nominatim giả — đặt `globalThis.__nominatim` = JSON là "tra được"; mặc định 404
  // (chat-reply phải coi đó là đường đi bình thường: hỏi như cũ, không vào sổ lỗi).
  if (/nominatim\.openstreetmap\.org/.test(String(url))) {
    return globalThis.__nominatim
      ? new Response(JSON.stringify(globalThis.__nominatim), { status: 200, headers: { "content-type": "application/json" } })
      : new Response("", { status: 404 });
  }
  if (!globalThis.__anhTaiDuoc || !/zdn\.vn|zadn\.vn/.test(String(url))) return new Response("", { status: 404 });
  return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
};
// FR-185: kịch bản model PHÂN LOẠI ẢNH (nhận ra qua DAU_HIEU trong system prompt);
// mặc định ảnh mặt tiền, đặt `globalThis.__anh` để dựng cảnh sổ hồng / không rõ.
const ANH = (o = {}) => ({ loai: "mat_tien", mo_ta: "hình như mặt tiền nhà 2 tầng", giay_to: null, ...o });
const laLuotAnh = (p) => (p?.system ?? []).some((s) => /PHÂN LOẠI ẢNH CHỦ NHÀ GỬI/.test(s.text ?? ""));
// 11/09: lượt model đọc "khách muốn ở gần đâu" (_shared/ai/boc-gan.ts) — không phải lượt trả lời.
const laLuotGan = (p) => (p?.system ?? []).some((s) => /có muốn nhà ở GẦN/.test(s.text ?? ""));
// FR-205: lượt model PHÂN VAI người lạ (_shared/ai/phan-vai.ts) — không phải lượt trả lời.
const laLuotVai = (p) => (p?.system ?? []).some((s) => /PHÂN VAI TIN NHẮN ĐẦU TIÊN/.test(s.text ?? ""));
// FR-214 b/d: lượt model "gán mảnh theo căn" — không phải lượt trả lời khách mua.
const laLuotGanManh = (p) => (p?.system ?? []).some((s) => /GÁN MẢNH TIN NHẮN VÀO ĐÚNG CĂN/.test(s.text ?? ""));
// FR-180: napCauHinh nhớ tạm 60 s ở tầng module → đặt mẫu chuẩn TRƯỚC lượt gọi đầu.
globalThis.__mauCau = {
  // 20260909h (FR-181): mau_cau_fewshot ghi "→ Trợ lý:" thay "→ Thái:" — tên bot nay theo từng khách.
  ban: '- Khách: "hẻm 4m xe hơi vào tận nhà" → Trợ lý: "Hẻm 4m ô tô tới cửa thì khách chuộng lắm anh. Nhà mình mấy lầu ạ?"',
  mua: '- Khách: "có căn nào 2 phòng ngủ tầm 3 tỷ ko" → Trợ lý: "Dạ có ạ. Anh muốn ở khu nào để em lọc cho gần?"',
};
const ENV = { SUPABASE_URL: "http://x", SUPABASE_SERVICE_ROLE_KEY: "svc", BRIDGE_SECRET: "s3cret", ANTHROPIC_API_KEY: "test-key" };
globalThis.Deno = { serve: (h) => { globalThis.__handler = h; }, env: { get: (k) => ENV[k] } };
await import("./chat-reply.bundle.mjs");
const H = globalThis.__handler;

let msgN = 0;
async function send(body, hdr = {}) {
  const b = { msg_id: `m${++msgN}`, channel: "zalo_personal_test", ...body };
  const hdrs = { "x-bridge-secret": "s3cret", ...hdr };
  // SEC-06: chat-reply đọc `req.text()` rồi tự parse (để chặn body khổng lồ
  // TRƯỚC khi parse) và soi `content-length`. Request giả phải có đủ cả ba,
  // không thì bộ e2e đo một cửa vào khác với cửa vào thật.
  const tho = JSON.stringify(b);
  const hdrsFull = { "content-length": String(tho.length), ...hdrs };
  const req = {
    method: "POST",
    headers: { get: (k) => hdrsFull[k.toLowerCase()] ?? null },
    text: async () => tho,
    json: async () => b,
  };
  const res = await H(req);
  return { status: res.status, body: await res.json() };
}
const db = () => globalThis.__db;
// FR-229 (20260925i): tin BÁN hỏi các câu pháp lý (đứng tên, thế chấp, quy hoạch, tranh chấp, khớp sổ) sau câu sổ, TRƯỚC
// bản nháp. Ca đo bản nháp qua chuỗi hỏi đáp thì trả lời hết các câu đó (`quaPhapLy`, trả phản hồi lượt cuối); ca dựng tin
// bằng tay thì ghi sẵn các fact đó (`coSanPhapLy`) để lượt đang đo vẫn là lượt ra bản nháp.
const DAP_PHAP_LY = { nguoi_dung_ten: "tên anh", the_chap: "cầm tay", quy_hoach: "không dính", tranh_chap: "không", dien_tich_khop_so: "khớp" };
async function quaPhapLy(uid, r) {
  for (let i = 0; i < 6; i++) {
    const treo = db().t.info_requests.find((q) => q.status === "pending" && DAP_PHAP_LY[q.question]);
    if (!treo) break;
    r = await send({ external_user_id: uid, text: DAP_PHAP_LY[treo.question] });
  }
  return r;
}
const coSanPhapLy = (listingId) => { for (const [question, answer] of Object.entries(DAP_PHAP_LY)) db().insert("listing_facts", { listing_id: listingId, question, answer }); };
// `__treTruyVan` phải được xoá ở đây: quên là độ trễ của ca "đua" rỉ sang mọi
// ca sau, làm bộ kiểm chậm đi và đo một thế giới khác.
function fresh(seed) { globalThis.__db = new FakeDB(); seedBotPrompts(globalThis.__db); globalThis.__calls = []; globalThis.__nominatim = undefined; globalThis.__fetches = []; globalThis.__model = { parse: (p) => laLuotAnh(p) ? ANH(globalThis.__anh) : OUT() }; globalThis.__rpc = {}; globalThis.__treTruyVan = null; globalThis.__anh = undefined; globalThis.__anhTaiDuoc = true; globalThis.__storageHong = false; seed?.(globalThis.__db); }
// Lượt gọi model chỉ tính NHÁNH MUA (parse hồ sơ), không tính lượt phân loại ảnh (FR-185).
const parseMua = () => globalThis.__calls.filter((c) => c.kind === "parse" && !laLuotAnh(c.params) && !laLuotGan(c.params) && !laLuotVai(c.params) && !laLuotGanManh(c.params));
function seedKho(d) {
  const sC = d.insert("sellers", { zalo_user_id: "z-ccrb", seller_type: "ccrb", name: "Chị D.", active_listing_id: null }).data;
  const sU = d.insert("sellers", { zalo_user_id: "z-unknown", seller_type: "unknown", name: null, active_listing_id: null }).data;
  const sN = d.insert("sellers", { zalo_user_id: "z-nmg", seller_type: "nmg", name: "Sale A", active_listing_id: null }).data;
  // FR-172: căn 0001 có thông số có cấu trúc (như sau backfill 20260902e) — KHO
  // và khối căn-khách-nhắc phải mang chúng vào prompt (TS-THONGSO-E2E).
  d.insert("listings", { code: "BDS-Q5-0001", seller_id: sC.id, deal: "ban", status: "dang_ban", location_raw: "12 Trần Hưng Đạo", ward: "Phường 4", price_raw: "5,8 tỷ", price_vnd: 5.8e9, area_m2: 50, bedrooms: 2,
    frontage_m: 4, length_m: 12.5, floors: 3, floors_text: "trệt + 2 lầu", bathrooms: 3, access_type: "hem_xe_hoi", alley_width_m: 6, legal_status: "so_hong_rieng", has_completion: true, specs_source: "boc_mo_ta" });
  d.insert("listings", { code: "BDS-Q5-0002", seller_id: sC.id, deal: "ban", status: "cho_thong_tin", location_raw: "99 Nguyễn Trãi", ward: "Phường 3", price_raw: "7 tỷ", price_vnd: 7e9, area_m2: 60 });
  d.insert("listings", { code: "BDS-Q5-0003", seller_id: sC.id, deal: "ban", status: "an", location_raw: "7 Hồng Bàng", ward: "Phường 12", price_raw: "9 tỷ", price_vnd: 9e9, area_m2: 80 });
  d.insert("listings", { code: "BDS-Q5-0004", seller_id: sU.id, deal: "ban", status: "dang_ban", location_raw: "5 An Dương Vương", ward: "Phường 8", price_raw: "6 tỷ", price_vnd: 6e9, area_m2: 55 });
  d.insert("listings", { code: "BDS-Q5-0005", seller_id: sN.id, deal: "ban", status: "dang_ban", location_raw: "3 Hải Thượng Lãn Ông", ward: "Phường 10", price_raw: "4 tỷ", price_vnd: 4e9, area_m2: 40 });
  d.insert("listing_facts", { listing_id: d.t.listings[1].id, question: "hinh_anh", answer: "[ảnh] https://x/anh-tin-nhap.jpg", source: "seller_chat" });
  return { sC, sU, sN };
}
const R = []; const check = (n, ok, detail = "") => { R.push([n, !!ok, detail]); };
const parseCalls = () => parseMua();
// SRS-5.1zzp: lượt GỌI LẠI cho đúng ô (câu lệnh mở "Em vừa soạn tin này cho chủ nhà") là lượt phụ — mock mặc định không hỏi gì
// nên hầu hết lượt bán đều gọi lại; các ca soi "câu lệnh lượt vừa rồi" phải thấy câu lệnh CHÍNH. Đếm lượt gọi lại qua `lan` của mock.
const createCalls = () => globalThis.__calls.filter((c) => c.kind === "create" && !/Em vừa soạn tin này cho chủ nhà/.test(c.params?.messages?.[0]?.content ?? ""));
const sysText = (c) => c.params.system[1].text;

// ── VAI 1: người lạ ─────────────────────────────────────────────────────────
fresh();
let r = await send({ external_user_id: "la-1", text: "chào em" });
check("V1.1 lạ 'chào em' → hỏi vai, không gọi model; KHÔNG kèm 'anh Thu phụ trách khu vực' (FR-218 a)", r.body.hoi_vai === true && /cần giao bán bất động sản đúng không ạ\?/.test(r.body.reply) && !/anh Thu|phụ trách/.test(r.body.reply) && parseCalls().length === 0, JSON.stringify(r.body));
// FR-181 (09/09 chiều): lời chào xưng TÊN TRỢ LÝ RIÊNG của khách này (băm từ Zalo ID), không còn "Thái".
check("V1.1b lời chào xưng tên trợ lý riêng (T•ai/Kh•ai…), không phải Thái, không còn {ten}", new RegExp(`em là ${tenTroLy("la-1").replace("•", "\\u2022")} bên`).test(r.body.reply) && !/Thái|\{ten\}/.test(r.body.reply), r.body.reply);
check("V1.1 cờ hoi_vai lưu trên buyer", db().t.buyers[0]?.preferences?.hoi_vai === true);
check("V1.1 câu hỏi vai nằm trong sổ tin", db().t.messages.some((m) => m.sender === "bot" && /cần giao bán bất động sản/.test(m.body)));
r = await send({ external_user_id: "la-1", text: "tôi có căn nhà ở phường 4" });
check("V1.2 trả lời có nhà → mở hồ sơ bán, nhãn chính chủ", db().t.sellers.length === 1 && db().t.sellers[0].seller_type === "ccrb" && r.body.role === "seller", JSON.stringify(r.body));
check("V1.2 người đó KHÔNG được báo nhãn, KHÔNG kèm biểu phí (chủ dự án 09/09 tối: gán im lặng)", !r.body.replies.some((x) => /ghi nhận anh.chị là (chính chủ|môi giới)/i.test(x)) && !r.body.replies.some((x) => /1%|0,5%/.test(x)), JSON.stringify(r.body.replies));
check("V1.2 ADMIN KHÔNG còn nhận tin 🆕 'hồ sơ mở từ chat' (chủ dự án 18/09: xoá thông báo cho admin)", !db().t.reminders.some((x) => /🆕/.test(x.note ?? "")), JSON.stringify(db().t.reminders));
check("V1.2 chưa tạo tin (chưa có chi tiết), model được báo là người bán MỚI", db().t.listings.length === 0 && createCalls().some((c) => /VỪA cho biết/.test(c.params.messages[0].content)));
r = await send({ external_user_id: "la-1", text: "bán nhà P4 giá 5 tỷ 8 50m2" });
const L = db().t.listings[0];
check("V1.3 câu rao → tạo tin nháp đúng giá/phường", L && L.ward === "Phường 4" && /5 tỷ 8/.test(L.price_raw) && L.price_vnd === 5.8e9 && r.body.listing_code === L.code, JSON.stringify({ L, body: r.body }));
// FR-177 d: tin từ chat KHÔNG còn lên kệ chỉ vì đủ giá+phường+diện tích — phải
// đủ 70 điểm và chủ gật bản nháp. Đủ nhóm cơ bản thì câu đầu là chuyên môn (hẻm).
// 09/09/2026 (chủ dự án): "chỉ cần rao và hỏi vị trí cụ thể" — vi_tri vào nhóm cơ
// bản, nên rao chưa nói đường/hẻm thì câu đầu là VỊ TRÍ, chưa tới hẻm rộng.
check("V1.3 rao đủ giá+phường+diện tích nhưng chưa nói đường/hẻm → cho_thong_tin (can_chu_duyet), câu đầu là VỊ TRÍ CỤ THỂ", L?.status === "cho_thong_tin" && L?.can_chu_duyet === true && db().t.info_requests.some((q) => q.listing_id === L?.id && q.question === "vi_tri" && q.status === "pending"), JSON.stringify({ L, ir: db().t.info_requests }));
// FR-193 (10/09): câu rao KHÔNG nói quận thì bong bóng không được nói "Quận 5" —
// đó là mặc định của cột, không phải điều khách nói.
check("V1.3 bong bóng đầu 'Em ghi nhận' liệt kê đúng thứ bóc được, không tự thêm quận, đứng trước lời chào", /^📝 Em ghi nhận: bán( nhà phố)? · Phường 4 · 50m2 · giá 5 tỷ 8\./.test(r.body.replies[0] ?? "") && r.body.replies.length >= 2 && !/gấp|phòng ngủ|Quận 5/.test(r.body.replies[0]), JSON.stringify(r.body.replies));
check("V1.3 câu hỏi mẫu vi_tri lấy từ bot_prompts.cau_hoi_mau (đè bản code)", createCalls().some((c) => /Nhà mình ở đâu vậy anh chị, đường nào số mấy\?/.test(c.params.messages[0].content)), createCalls().at(-1)?.params.messages[0].content.slice(0, 300));
check("V1.3 boc_tach ghi ngay lúc tạo: loại giao dịch, phường, giá thô, diện tích; không có khoá null", L?.boc_tach?.loai_giao_dich === "ban" && L?.boc_tach?.phuong === "Phường 4" && /5 tỷ 8/.test(L?.boc_tach?.gia_raw ?? "") && L?.boc_tach?.dien_tich === "50m2" && !("gap" in (L?.boc_tach ?? {})) && !("du_an" in (L?.boc_tach ?? {})), JSON.stringify(L?.boc_tach));
check("V1.3 rao đã nói 50m2 → diện tích được ghi, drip KHÔNG hỏi lại", L?.area_m2 === 50 && !db().t.info_requests.some((q) => q.listing_id === L?.id && q.question === "dien_tich"), JSON.stringify(db().t.info_requests));
check("V1.3 giá thô không dính đuôi '50m2'", L && !/m2/.test(L.price_raw), L?.price_raw);
r = await send({ external_user_id: "la-1", text: "có khách nào coi nhà chưa em" });
check("V1.4 chủ nhà hỏi khách coi nhà → ở lại nhánh bán", r.body.role === "seller" && parseCalls().length === 0, JSON.stringify(r.body));

fresh();
r = await send({ external_user_id: "la-1b", text: "bán nhà phường 4 giá 5 tỷ" });
const Lb = db().t.listings[0];
check("V1.3b rao THIẾU diện tích → tin nháp + hỏi nhỏ giọt, câu đầu không phải giá/phường", Lb?.status === "cho_thong_tin" && db().t.info_requests.some((q) => q.listing_id === Lb?.id && q.status === "pending" && !["gia","phuong"].includes(q.question)), JSON.stringify(db().t.info_requests));
fresh();
r = await send({ external_user_id: "la-2", text: "tôi muốn bán nhà q5 giá 5 tỷ" });
check("V1.5 câu rao đầy đủ ngay tin đầu → không hỏi vai, mở hồ sơ + tạo tin", !r.body.hoi_vai && db().t.sellers.length === 1 && db().t.listings.length === 1 && db().t.sellers[0].seller_type === "ccrb", JSON.stringify(r.body));
fresh();
r = await send({ external_user_id: "la-3", text: "em là sale, có căn q5 cần bán 6 tỷ" });
check("V1.6 người đó KHÔNG được báo nhãn môi giới, không phí (09/09 tối); admin cũng không còn tin 🆕 (18/09)", !r.body.replies.some((x) => /ghi nhận anh.chị là môi giới/i.test(x)) && !r.body.replies.some((x) => /0,5%/.test(x)) && !db().t.reminders.some((x) => /🆕/.test(x.note ?? "")), JSON.stringify(r.body.replies));
check("V1.6 tự xưng sale → nhãn môi giới", db().t.sellers[0]?.seller_type === "nmg" && db().t.listings.length === 1, JSON.stringify(db().t.sellers));
fresh();
r = await send({ external_user_id: "la-4", text: "nhà mình bán chưa em?" });
check("V1.7 câu hỏi tình trạng từ người lạ → hỏi vai (không bịa hồ sơ bán)", r.body.hoi_vai === true && db().t.sellers.length === 0);
r = await send({ external_user_id: "la-4", text: "tôi có căn nhà ở Q10, giờ tìm Q5" });
check("V1.8 trả lời kể hoàn cảnh + tìm nhà → ở hàng mua, xoá cờ, không mở hồ sơ bán", db().t.sellers.length === 0 && parseCalls().length === 1 && !db().t.buyers[0].preferences.hoi_vai, JSON.stringify(db().t.buyers[0].preferences));
fresh();
// 15/09/2026 (bắn thật D1): "chào BẠN … tìm nhà … tầm 5 tỷ" — bỏ dấu ra "ban" nên
// cổng rao khớp, người mua bị mở hồ sơ bán + tạo tin "Nhà phố bán · Quận 10 · 5 tỷ".
r = await send({ external_user_id: "la-5b", text: "chào bạn mình tìm nhà cho ba mẹ ở gần bệnh viện, tầm 5 tỷ đổ lại, q10 hoặc q5 gì cũng đc" });
check("V1.8b 'chào bạn … tìm nhà … 5 tỷ' là NGƯỜI MUA — không mở hồ sơ bán, không tạo tin", db().t.sellers.length === 0 && db().t.listings.length === 0 && r.body.role !== "seller", JSON.stringify({ body: r.body, s: db().t.sellers, l: db().t.listings }));
fresh();
r = await send({ external_user_id: "la-5", text: "chào em" });
r = await send({ external_user_id: "la-5", text: "muốn hỏi thông tin thôi" });
check("V1.9 trả lời 'muốn hỏi thông tin' → hàng mua, cờ xoá, model được gọi", parseCalls().length === 1 && db().t.buyers[0].preferences.hoi_vai == null && db().t.sellers.length === 0);
fresh(); r = await send({ external_user_id: "la-6", text: "", image_url: "https://f9-zpg.zdn.vn/a.jpg" });
check("V1.10 lạ gửi ảnh trần → không hỏi vai, model đọc ảnh", !r.body.hoi_vai && parseCalls().length === 1 && parseCalls()[0].params.messages[0].content.some((c) => c.type === "image"));
fresh(seedKho); r = await send({ external_user_id: "la-7", text: "#BDS-Q5-0001 còn không em" });
check("V1.11 lạ vào từ web kèm mã → không hỏi vai, đi thẳng hàng mua", !r.body.hoi_vai && parseCalls().length === 1);
fresh(); globalThis.__afterInsertMsg = (d, m) => { d.insert("messages", { conversation_id: m.conversation_id, sender: "buyer", body: "tôi muốn mua nhà", zalo_msg_id: "m-sau" }); };
r = await send({ external_user_id: "la-8", text: "chào em" });
check("V1.12 tin mới hơn tới giữa chừng → nhường lượt, KHÔNG hỏi vai thừa", r.body.superseded === true && !db().t.buyers[0].preferences.hoi_vai && !db().t.messages.some((m) => m.sender === "bot"), JSON.stringify(r.body));
fresh((d) => { const b = d.insert("buyers", { zalo_user_id: "cu-1", name: "Anh B.", preferences: { area: "phường 4", budget: "5 tỷ" } }).data; d.insert("conversations", { buyer_id: b.id, channel: "zalo_personal_test", started_at: "2026-08-01T00:00:00Z" }); });
r = await send({ external_user_id: "cu-1", text: "chào em" });
check("V1.13 khách cũ đã có hồ sơ, hội thoại trống → không hỏi vai", !r.body.hoi_vai && parseCalls().length === 1);

fresh(); r = await send({ external_user_id: "la-9", text: "em là sale bên sàn giao dịch ABC" });
check("V1.14 tự xưng sale nhưng chưa rao → hỏi vai, cờ nhớ 'môi giới'", r.body.hoi_vai === true && db().t.buyers[0].preferences.hoi_vai === "nmg");
r = await send({ external_user_id: "la-9", text: "có căn nhà cần bán ở P6 giá 7 tỷ" });
check("V1.14 lượt sau rao → nhãn MÔI GIỚI nhớ từ tin đầu", db().t.sellers[0]?.seller_type === "nmg" && db().t.listings[0]?.ward === "Phường 6", JSON.stringify(db().t.sellers));
fresh(); await send({ external_user_id: "la-10", text: "chào em" }); r = await send({ external_user_id: "la-10", text: "bán" });
check("V1.15 trả lời câu hỏi vai bằng một chữ 'bán' → mở hồ sơ chính chủ", db().t.sellers[0]?.seller_type === "ccrb" && r.body.role === "seller", JSON.stringify(r.body));
fresh(); await send({ external_user_id: "la-11", text: "chào em" }); r = await send({ external_user_id: "la-11", text: "có nhà" });
check("V1.16 trả lời 'có nhà' → mở hồ sơ bán", db().t.sellers.length === 1 && r.body.role === "seller");
// 27/09/2026 (chủ dự án: câu chào chỉ hỏi "anh chị cần giao bán bất động sản đúng không ạ?"): GẬT trơn là người bán, và bot
// không chào lần hai, không hỏi lại "bán hay cho thuê".
for (const [i, gat] of ["đúng rồi em", "dạ", "ừ", "vâng đúng rồi"].entries()) {
  fresh(); await send({ external_user_id: `la-gat-${i}`, text: "chào em" });
  globalThis.__model.create = () => "Dạ em chào anh! Anh muốn rao bán hay cho thuê ạ? Anh cho em xin địa chỉ (đường/phường), diện tích và giá mong muốn nha.";
  r = await send({ external_user_id: `la-gat-${i}`, text: gat });
  globalThis.__model.create = undefined;
  const cau = r.body.replies.join("\n");
  check(`V1.17 trả lời câu hỏi vai bằng '${gat}' → mở hồ sơ bán; bot KHÔNG chào lại, KHÔNG hỏi 'bán hay cho thuê'`,
    db().t.sellers.length === 1 && r.body.role === "seller" && !/chào/i.test(cau) && !/bán hay cho thuê/i.test(cau) && /địa chỉ/.test(cau),
    JSON.stringify({ rep: r.body.replies, s: db().t.sellers.length }));
}
// 27/09/2026 (test Zalo): "Hay quá" sau câu chào → không sang hỏi "mua hay thuê"; hỏi lại câu chào MỘT lần, lần sau mới về hàng mua.
fresh(); await send({ external_user_id: "la-hay-qua", text: "Hello" });
r = await send({ external_user_id: "la-hay-qua", text: "Hay quá" });
check("V1.19 'Hay quá' sau câu chào → hỏi lại 'cần giao bán bất động sản đúng không ạ', không hỏi mua / thuê, không gọi model",
  r.body.hoi_vai === true && /cần giao bán bất động sản đúng không ạ\?/.test(r.body.reply) && !/mua|thuê/.test(r.body.reply) && parseCalls().length === 0, JSON.stringify(r.body));
r = await send({ external_user_id: "la-hay-qua", text: "đúng rồi" });
check("V1.19b rồi 'đúng rồi' → người bán", db().t.sellers.length === 1 && r.body.role === "seller", JSON.stringify(r.body));
fresh(); await send({ external_user_id: "la-hay-qua2", text: "Hello" }); await send({ external_user_id: "la-hay-qua2", text: "Hay quá" });
r = await send({ external_user_id: "la-hay-qua2", text: "ok" });
check("V1.19c chung chung lần hai → không hỏi lại lần ba (về hàng người mua như cũ)", !/cần giao bán bất động sản đúng không/.test(r.body.reply ?? "") , JSON.stringify(r.body));
for (const [i, khong] of ["không, anh muốn mua nhà", "đúng rồi anh muốn mua"].entries()) {
  fresh(); await send({ external_user_id: `la-khong-${i}`, text: "chào em" });
  r = await send({ external_user_id: `la-khong-${i}`, text: khong });
  check(`V1.18 '${khong}' sau câu hỏi vai → KHÔNG mở hồ sơ bán`, db().t.sellers.length === 0, JSON.stringify(r.body));
}
fresh(); await send({ external_user_id: "la-12", text: "chào em" }); r = await send({ external_user_id: "la-12", text: "mua" });
check("V1.16b trả lời 'mua' → hàng mua, không mở hồ sơ bán", db().t.sellers.length === 0 && parseCalls().length === 1);
fresh(); r = await send({ external_user_id: "la-13", text: "cho thuê nhà q5 10tr/tháng 40m2" });
check("V1.17 rao CHO THUÊ ngay tin đầu → hồ sơ bán + tin cho_thue + diện tích 40", db().t.sellers.length === 1 && db().t.listings[0]?.deal === "cho_thue" && db().t.listings[0]?.area_m2 === 40, JSON.stringify(db().t.listings[0]));

// ── VAI 2: người đã có tin rao ────────────────────────────────────────────────
fresh(seedKho);
let s = seedKho; // (seed đã chạy trong fresh)
const lst1 = () => db().t.listings[0];
db().insert("info_requests", { listing_id: lst1().id, question: "phap_ly", status: "pending" });
globalThis.__anh = { loai: "giay_to", mo_ta: "hình như sổ hồng", giay_to: { loai_giay: "sổ hồng", dien_tich_m2: 50, dia_chi: "Trần Hưng Đạo, Phường 4", so_thua: "12", so_to: "3", ro_net: true } };
r = await send({ external_user_id: "z-ccrb", text: "sổ hồng đây em", image_url: "https://f9-zpg.zdn.vn/so-hong.jpg" });
const facts = db().t.listing_facts.filter((f) => f.listing_id === lst1().id);
// FR-185 (09/09): ảnh KHÔNG còn là fact URL Zalo — vào kho (listing_media); giấy tờ → bucket RIÊNG TƯ.
const mediaSo = db().t.listing_media.filter((m) => m.listing_id === lst1().id);
check("V2.1 ảnh KÈM chú thích khi đang hỏi pháp lý → ghi pháp lý, ảnh vào KHO (không fact URL tạm)", facts.some((f) => f.question === "phap_ly" && /sổ hồng/.test(f.answer)) && !facts.some((f) => f.question === "hinh_anh" && /so-hong/.test(f.answer)) && mediaSo.length === 1, JSON.stringify({ facts, mediaSo }));
check("V2.1b ảnh sổ → media_type giay_to, bucket listing-private, có OCR; file đã upload; KHÔNG ghi tên người", mediaSo[0]?.media_type === "giay_to" && mediaSo[0]?.bucket === "listing-private" && mediaSo[0]?.ocr?.dien_tich_m2 === 50 && db().storage.some((f) => f.bucket === "listing-private") && !JSON.stringify(mediaSo[0]?.ocr).includes("ten_"), JSON.stringify({ mediaSo, st: db().storage }));
check("V2.1c sổ 50m2 khớp tin 50m2 → bong bóng báo cất riêng + khớp; câu hỏi pháp lý được đóng", r.body.replies.some((x) => /cất riêng/.test(x) && /khớp/.test(x)) && db().t.info_requests.every((q) => q.question !== "phap_ly" || q.status === "answered"), JSON.stringify(r.body.replies));
globalThis.__anh = undefined;
r = await send({ external_user_id: "z-ccrb", text: "thêm tấm này nữa", image_url: "https://f9-zpg.zdn.vn/them.jpg" });
check("V2.2 ảnh nhà kèm chữ, KHÔNG có câu hỏi treo → vào kho CÔNG KHAI của tin gần nhất, media_type mat_tien, nguồn seller_chat", db().t.listing_media.some((m) => m.bucket === "listing-public" && m.media_type === "mat_tien" && m.nguon === "seller_chat"), JSON.stringify(db().t.listing_media));
check("V2.2b bong bóng nhận ảnh nói loại ảnh ('mặt tiền') và lợi ích cho khách", r.body.replies.some((x) => /mặt tiền/.test(x) && /khách/.test(x)), JSON.stringify(r.body.replies));
r = await send({ external_user_id: "z-ccrb", text: "tôi muốn nhà mình lên web sớm" });
check("V2.3 'muốn nhà mình lên web' → KHÔNG rẽ sang mua", r.body.role === "seller" && parseCalls().length === 0, JSON.stringify(r.body));
r = await send({ external_user_id: "z-ccrb", text: "tôi muốn mua thêm căn q5 tầm 5 tỷ" });
check("V2.4 người bán hỏi mua thật → rẽ sang nhánh mua, không tạo tin", parseCalls().length === 1 && db().t.listings.length === 5 && !r.body.role);
r = await send({ external_user_id: "z-unknown", text: "em là môi giới, tin nhà đang rao sao rồi" });
check("V2.5 hồ sơ tạo tay chưa nhãn, tự xưng môi giới → nâng thành nmg", db().t.sellers.find((x) => x.zalo_user_id === "z-unknown").seller_type === "nmg");
r = await send({ external_user_id: "z-nmg", text: "em là chính chủ mà" });
check("V2.6 nhãn admin đã gán (nmg) không bị lời tự xưng lật", db().t.sellers.find((x) => x.zalo_user_id === "z-nmg").seller_type === "nmg");

fresh(seedKho);
db().insert("info_requests", { listing_id: db().t.listings[0].id, question: "phap_ly", status: "pending" });
r = await send({ external_user_id: "z-ccrb", text: "bán thêm căn nữa ở P5 giá 6 tỷ 60m2" });
check("V2.7 đang bị hỏi pháp lý mà rao THÊM CĂN → tạo tin mới, câu hỏi cũ vẫn treo", db().t.listings.length === 6 && db().t.listings[5].ward === "Phường 5" && db().t.info_requests.some((q) => q.question === "phap_ly" && q.status === "pending"), JSON.stringify({ n: db().t.listings.length, iq: db().t.info_requests }));
fresh(seedKho);
db().insert("info_requests", { listing_id: db().t.listings[0].id, question: "gia", status: "pending" });
r = await send({ external_user_id: "z-ccrb", text: "giá bán nhà này 5 tỷ 9" });
check("V2.8 đang bị hỏi giá, trả lời có chữ 'bán nhà' → vẫn là câu trả lời, KHÔNG đẻ tin trùng", db().t.listings.length === 5 && db().t.info_requests.some((q) => q.question === "gia" && q.status === "answered"), JSON.stringify(db().t.info_requests));

fresh(seedKho);
r = await send({ external_user_id: "z-ccrb", text: "em là môi giới mà, không phải chủ" });
check("V2.9 chính chủ tự xưng môi giới → KHÔNG tự lật nhãn, báo admin xác nhận, nói với họ đã báo", db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb").seller_type === "ccrb" && db().t.reminders.some((x) => /✏️/.test(x.note) && /tự xưng MÔI GIỚI/.test(x.note)) && r.body.replies.some((t) => /báo bên quản lý/.test(t)), JSON.stringify({ rem: db().t.reminders, rep: r.body.replies }));
r = await send({ external_user_id: "z-ccrb", text: "em là sale thật đó" });
check("V2.9 lặp lại trong 24h → không đẻ thêm việc cho admin", db().t.reminders.filter((x) => /✏️/.test(x.note)).length === 1);

// ── VAI 3: người hỏi tìm nhà ──────────────────────────────────────────────────
fresh(seedKho);
globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "ban", area: "phường 4", budget: "tầm 5 tỷ 8" } });
r = await send({ external_user_id: "mua-1", text: "tôi muốn mua nhà phường 4 tầm 5 tỷ 8" });
check("V3.1 hồ sơ ghi budget nguyên văn", db().t.buyers[0].preferences.budget === "tầm 5 tỷ 8");
globalThis.__model.parse = () => OUT({ replies: ["Dạ có căn #BDS-Q5-0001 hợp anh nè"] });
r = await send({ external_user_id: "mua-1", text: "có căn nào không em" });
const khoQ = db().log.filter((l) => l.table === "listings" && l.op === "select" && l.filters.some((f) => f.kind === "lte" && f.col === "price_vnd")).pop();
const lte = khoQ?.filters.find((f) => f.kind === "lte").val;
check("V3.2 lọc kho với '5 tỷ 8' → cận trên ≥ 5,8 tỷ (căn 5,8 tỷ KHÔNG bị lọc mất)", lte >= 5.8e9, `lte=${lte}`);
const last = parseCalls().pop();
check("V3.3 căn 5,8 tỷ có mặt trong KHO gửi model", /BDS-Q5-0001/.test(sysText(last)));
check("V3.3 tin CHƯA ĐĂNG và ĐÃ GỠ không lọt vào KHO", !/BDS-Q5-0002|BDS-Q5-0003/.test(sysText(last)));
check("THONGSO-01 dòng KHO mang thông số có cấu trúc (ngang×dài, kết cấu, WC, hẻm, sổ)", /4x12\.5m · trệt \+ 2 lầu · 3WC · hẻm xe hơi 6m · sổ hồng riêng, hoàn công/.test(sysText(last)), sysText(last).split("\n").find((x) => x.includes("BDS-Q5-0001")));

// ── FR-228 (25/09/2026, chủ dự án gửi bộ 7 câu "nếu có người hỏi tìm mua"; chọn "Mỗi lượt 1 câu, xen giữa") ──
{
  const userMua = (c) => c.params.messages[0].content.map((x) => x.text ?? "").join("");
  fresh(seedKho);
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "ban", area: "phường 4", budget: "tầm 5 tỷ 8" } });
  await send({ external_user_id: "tv-1", text: "tôi muốn mua nhà phường 4 tầm 5 tỷ 8" });
  const u1 = userMua(parseCalls().pop());
  check("TUVAN-01 đủ khu vực + giá → prompt có CÂU TƯ VẤN KẾ = câu 1 'muốn mình sống ở một khu như thế nào', vẫn gợi ý căn",
    /CÂU TƯ VẤN KẾ/.test(u1) && /sống ở một khu như thế nào/.test(u1) && /NGỪNG hỏi các trường hồ sơ ở trên/.test(u1), u1.slice(0, 900));
  // Câu 5 đổi theo người ở cùng: có ông bà → gợi ý chung (không phải câu "2 mẫu" của Ny'ah Phú Định).
  fresh((d) => { seedKho(d); d.insert("buyers", { zalo_user_id: "tv-2", preferences: { deal: "ban", area: "phường 4", budget: "5 tỷ", khu_song: "yên tĩnh", nguoi_o_cung: "vợ chồng, 2 con và ông bà", noi_lam: "Quận 1", bedrooms: 4, dien_tich_mong_muon: "70m2" } }); });
  globalThis.__model.parse = () => OUT();
  await send({ external_user_id: "tv-2", text: "có căn nào hợp không em" });
  const u2 = userMua(parseCalls().pop());
  check("TUVAN-02 người ở cùng có ông bà, không hỏi Ny'ah → câu kế là gợi ý thang máy / phòng ngủ dưới trệt, KHÔNG phải 'Bên em có 2 mẫu'",
    /thang máy hoặc phòng ngủ dưới trệt/.test(u2) && !/Bên em có 2 mẫu/.test(u2), (u2.match(/CÂU TƯ VẤN KẾ[^\n]*/) ?? [""])[0]);
  // Câu 7: khách cần vay → mở việc cho CTV (💰), bot không tự tư vấn. Khách không nói gì về vay → không mở việc dù model điền.
  fresh(seedKho);
  await send({ external_user_id: "tv-3", text: "tìm nhà phường 4 tầm 5 tỷ 8" });
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, can_vay: true } });
  await send({ external_user_id: "tv-3", text: "anh cần tư vấn vay ngân hàng nữa em" });
  const bTv3 = db().t.buyers.find((b) => b.zalo_user_id === "tv-3");
  check("TUVAN-03 khách 'cần tư vấn vay ngân hàng' → hồ sơ can_vay=true, việc escalation '💰 khách cần tư vấn vay ngân hàng' cho CTV",
    bTv3?.preferences?.can_vay === true && db().t.reminders.some((x) => x.kind === "escalation" && x.buyer_id === bTv3.id && /^💰 khách cần tư vấn vay ngân hàng/.test(x.note ?? "")),
    JSON.stringify({ p: bTv3?.preferences, rem: db().t.reminders.map((x) => x.note) }));
  fresh(seedKho);
  await send({ external_user_id: "tv-4", text: "tìm nhà phường 4 tầm 5 tỷ 8" });
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, can_vay: true } });
  await send({ external_user_id: "tv-4", text: "ok em" });
  const bTv4 = db().t.buyers.find((b) => b.zalo_user_id === "tv-4");
  check("TUVAN-04 model tự điền can_vay khi khách không nói gì về vay → không ghi, không mở việc",
    bTv4?.preferences?.can_vay == null && !db().t.reminders.some((x) => /vay ngân hàng/.test(x.note ?? "")),
    JSON.stringify({ p: bTv4?.preferences, rem: db().t.reminders.map((x) => x.note) }));
}
globalThis.__model = { parse: () => OUT() };
globalThis.__rpc = {}; // fallback: model hỏng
globalThis.__model.parse = () => { throw new Error("model chết"); };
r = await send({ external_user_id: "mua-2", text: "toi muon mua nha, tam 5 ty 8 nha em" });
check("V3.4 model hỏng → fallback vẫn bóc '5 tỷ 8' đủ phần lẻ", db().t.buyers.find((b) => b.zalo_user_id === "mua-2").preferences.budget === "5 tỷ 8", JSON.stringify(db().t.buyers.find((b) => b.zalo_user_id === "mua-2").preferences));
check("V3.4 lỗi model vào sổ", db().t.bot_errors.some((e) => e.source === "chat-reply model"));

// ── VAI 4: đã nhắm một căn ────────────────────────────────────────────────────
fresh(seedKho);
r = await send({ external_user_id: "nham-1", text: "#BDS-Q5-0002 giá bao nhiêu" });
let st = sysText(parseCalls().pop());
check("V4.1 hỏi mã tin CHƯA ĐĂNG → bot không được biết địa chỉ/giá/ảnh", !/Nguyễn Trãi|7 tỷ|anh-tin-nhap/.test(st));
r = await send({ external_user_id: "nham-1", text: "#BDS-Q5-0003 còn ko" });
st = sysText(parseCalls().pop());
check("V4.2 hỏi mã tin ĐÃ GỠ → chỉ báo đã gỡ, không lộ địa chỉ/giá", /BDS-Q5-0003/.test(st) && /đã gỡ/.test(st) && !/Hồng Bàng|9 tỷ/.test(st), st.slice(-400));
r = await send({ external_user_id: "nham-1", text: "bds-q5-0001 gia bao nhieu" });
st = sysText(parseCalls().pop());
check("V4.3 mã viết thường vẫn tra đúng căn + đánh dấu quan tâm", /BDS-Q5-0001/.test(st) && /Trần Hưng Đạo/.test(st) && db().t.listings[0].status === "dang_quan_tam");
check("THONGSO-02 khối căn khách nhắc cũng mang thông số (bot trả lời 'hẻm mấy mét' không cần hỏi chủ)", /hẻm xe hơi 6m/.test(st) && /sổ hồng riêng/.test(st));
globalThis.__model.parse = () => OUT({ viewing: { listing_code: "bds-q5-0001", when: "mai 9h sáng", phone: null } });
r = await send({ external_user_id: "nham-1", text: "mai 9h sáng qua xem bds-q5-0001 được không" });
const vw = db().t.viewings;
check("V4.4 lịch xem từ mã viết thường → lưu HOA + gắn đúng căn", vw.length === 1 && vw[0].listing_code === "BDS-Q5-0001" && vw[0].listing_id === db().t.listings[0].id, JSON.stringify(vw));
globalThis.__model.parse = () => OUT({ viewing: { listing_code: "BDS-Q5-0001", when: "mai 9h sáng", phone: "0909xxxxxx" } });
r = await send({ external_user_id: "nham-1", text: "sđt tôi 0909xxxxxx" });
check("V4.5 bổ sung SĐT với mã viết HOA → CẬP NHẬT lịch cũ, không tạo lịch thứ hai", db().t.viewings.length === 1 && db().t.viewings[0].phone === "0909xxxxxx", JSON.stringify(db().t.viewings));
for (const [code, mong] of [["BDS-Q5-0004", null], ["BDS-Q5-0001", 1.0], ["BDS-Q5-0005", 0.5]]) {
  globalThis.__model.parse = () => OUT({ agreed_deal: { listing_code: code } });
  r = await send({ external_user_id: "nham-1", text: `ok chốt ${code}` });
  const dl = db().t.deals.find((d) => d.listing_id === db().t.listings.find((l) => l.code === code).id);
  check(`V4.6 chốt ${code} (chủ ${code === "BDS-Q5-0004" ? "chưa nhãn" : code === "BDS-Q5-0001" ? "chính chủ" : "môi giới"}) → phí ${mong}`, dl && dl.fee_pct === mong, JSON.stringify(dl));
}
globalThis.__model.parse = () => OUT({ send_photos: "BDS-Q5-0002" });
r = await send({ external_user_id: "nham-1", text: "cho xem hình #BDS-Q5-0002" });
check("V4.7 xin hình tin CHƯA ĐĂNG → không có ảnh nào lọt ra", (r.body.photos ?? []).length === 0, JSON.stringify(r.body.photos));

// ── TS-TOIUU: đếm VÒNG ĐI VỀ DB mỗi đường (FR-171 h) — mock ghi mọi truy vấn/RPC vào db().log
const vong = async (body) => { const n0 = db().log.length; const r = await send(body); return { r, n: db().log.length - n0 }; };
fresh(seedKho);
globalThis.__model.parse = () => OUT({ replies: ["Dạ có căn #BDS-Q5-0001 hợp anh nè"] });
let v = await vong({ external_user_id: "do-1", text: "chào em" });
// Số đếm là TRUY VẤN (mỗi câu select/insert/rpc một đơn vị), không phải vòng
// đi về: các câu trong một Promise.all chỉ tốn một lần thời gian mạng. Ngưỡng
// đặt = số đo 02/09 để làm chốt chặn hồi quy; bản v43 đo được 18 / 20 / 24 / 21.
console.log(`   [đo] người lạ hỏi vai: ${v.n} truy vấn`);
check("TOIUU-01 người lạ hỏi vai ≤ 12 truy vấn (v43: 18; +1 trần cá nhân SEC-05), 0 model", v.n <= 12 && parseCalls().length === 0, `${v.n}`);
v = await vong({ external_user_id: "do-1", text: "tôi muốn mua nhà phường 4 tầm 5 tỷ" });
console.log(`   [đo] người mua lượt đầu (có model): ${v.n} truy vấn`);
// 23/09/2026: +1 — câu đầu đủ khu vực + giá nay LỌC KHO ngay (trước chỉ hứa "em lọc kho liền" rồi im).
check("TOIUU-02 người mua lượt đầu ≤ 25 truy vấn (+1 trần cá nhân SEC-05; +1 FR-181 ghi tên trợ lý vào hồ sơ, CHỈ lượt đầu; +1 14/09 đọc công tắc báo lại 🤖; +1 23/09 lọc kho ngay tin đầu; +1 FR-216 đọc công tắc tim_theo_nghia, chỉ khi kho được lọc; +1 FR-248 b tìm căn gần ngân sách, CHỈ khi kho trống vì giá — ca này 'tầm 5 tỷ' ≤ 5,75 tỷ mà căn phường 4 là 5,8 tỷ; +1 SRS-5.1y đọc công tắc tro_ly — không nhớ tạm để bật/tắt có hiệu lực lượt kế; +1 06/10 SRS-5.1zzn đọc công tắc luat_loi_bot ở nhánh mua; +1 ghi sổ van_kich, CHỈ khi có van đổi lời — mock chạy `du` nên có)", v.n <= 26, `${v.n}`);
v = await vong({ external_user_id: "do-1", text: "có căn nào không em" });
console.log(`   [đo] người mua đã có hồ sơ, bot gợi căn + follow-up: ${v.n} truy vấn`);
check("TOIUU-03 người mua có hồ sơ ≤ 20 truy vấn (v43: 24; +1 trần cá nhân SEC-05; +1 14/09 đọc công tắc báo lại 🤖; +1 SRS-5.1y đọc công tắc tro_ly; +1 06/10 SRS-5.1zzn công tắc luat_loi_bot; +1 ghi sổ van_kich khi có van đổi lời)", v.n <= 21, `${v.n}`);
check("TOIUU-04 follow-up FR-32 đi qua RPC tao_followup, không đếm/tra/chèn tay", db().log.some((l) => l.rpc === "tao_followup") && db().t.reminders.some((x) => x.kind === "followup"));
check("TOIUU-05 bot_prompts chỉ đọc MỘT lần cho cả ba lượt (nhớ tạm 60 s)", db().log.filter((l) => l.table === "bot_prompts").length <= 1, String(db().log.filter((l) => l.table === "bot_prompts").length));
check("TOIUU-06 loạt bong bóng bot vào sổ bằng MỘT câu INSERT mảng", db().log.some((l) => l.table === "messages" && l.op === "insert" && Array.isArray(l.payload)));
fresh(seedKho);
db().insert("info_requests", { listing_id: db().t.listings[0].id, question: "phap_ly", status: "pending" });
v = await vong({ external_user_id: "z-ccrb", text: "sổ hồng đầy đủ em" });
console.log(`   [đo] người bán trả lời câu chờ: ${v.n} truy vấn`);
check("TOIUU-07 người bán trả lời câu chờ ≤ 23 truy vấn (v43: 21; +1 trần cá nhân SEC-05; +2 FR-176 lịch sử + đếm căn; +1 FR-181 ghi tên trợ lý, CHỈ lượt đầu; +1 09/09 tối: đọc câu đã hết hạn để không mở lại; +1 11/09: đọc công tắc app_config.bao_lai_da_luu — tắt thì dừng ở đó; +1 14/09 FR-208: đọc công tắc boc_tach_ai, CHẠY SONG SONG, chỉ khi tin có mùi dữ liệu; +1 24/09 FR-223: đọc tin + fact (một truy vấn nhúng) để rẽ nhánh câu kế, chỉ khi có luật đụng tới; +1 30/09: đọc công tắc app_config.luat_loi_bot, một lần mỗi lượt)", v.n <= 24 && v.r.body.role === "seller", `${v.n}`);
v = await vong({ external_user_id: "z-ccrb", text: "hoàn công đủ rồi" });
check("TOIUU-07b lượt sau của cùng người bán ≤ 25 (không còn update tên trợ lý; +1 11/09: đọc công tắc app_config.bao_lai_da_luu; +1 14/09 FR-208: công tắc boc_tach_ai, song song; +4 18/09 FR-211: câu 'hoàn công đủ rồi' có NHÃN → tìm tin, đọc nhan, gộp, ghi fact — chỉ khi câu có nhãn; +1 24/09 FR-223: đọc tin + fact để rẽ nhánh; +1 30/09: công tắc app_config.luat_loi_bot)", v.n <= 26, `${v.n}`);
check("TOIUU-08 không còn UPDATE last_message_at tay (trigger DB lo)", !db().log.some((l) => l.table === "conversations" && l.op === "update" && l.payload && Object.keys(l.payload).length === 1 && "last_message_at" in l.payload));
check("TOIUU-09 trigger giả đẩy last_message_at khi chèn tin", db().t.conversations.every((c) => !db().t.messages.some((m) => m.conversation_id === c.id) || c.last_message_at));
fresh();
v = await vong({ external_user_id: "la-x", text: "chào em" });
check("TOIUU-10 lượt đầu chưa đủ khu vực+giá → KHÔNG lọc kho (không select listings)", !db().log.some((l) => l.table === "listings" && l.op === "select"));

// ── TS-CTV: câu khách hỏi về CTV; CTV/admin nhắn "#mã: trả lời" (FR-173 d, 03/09/2026)
fresh(seedKho);
db().insert("ctvs", { name: "CTV Test", zalo_user_id: "ctv-1", active: true });
db().insert("buyers", { zalo_user_id: "kh-ctv", name: "Khách CTV", preferences: {} });
db().insert("info_requests", { listing_id: lst1().id, buyer_id: db().t.buyers.at(-1).id, question: "còn bán không", status: "pending", source: "buyer_ask", assignee: "ctv" });
r = await send({ external_user_id: "ctv-1", text: "#BDS-Q5-0001: chủ nói còn bán, sổ hồng riêng" });
check("CTV-01 CTV nhắn '#mã: trả lời' → câu khách hỏi đóng, fact nguồn ctv", db().t.info_requests.some((q) => q.question === "còn bán không" && q.status === "answered" && /còn bán/.test(q.answer ?? "")) && db().t.listing_facts.some((f) => f.source === "ctv"), JSON.stringify({ iq: db().t.info_requests, f: db().t.listing_facts }));
check("CTV-02 bot xác nhận với CTV bằng câu mẫu, KHÔNG gọi model", /báo lại khách/.test(r.body.reply ?? "") && r.body.noi_bo === "ctv" && parseCalls().length === 0, JSON.stringify(r.body));
r = await send({ external_user_id: "ctv-1", text: "#BDS-Q5-9999: chủ nói còn" });
check("CTV-03 mã tin không có → báo lại CTV, không ghi gì", /không thấy tin/.test(r.body.reply ?? "") && db().t.listing_facts.filter((f) => f.source === "ctv").length === 1, JSON.stringify(r.body));
r = await send({ external_user_id: "la-9", text: "#BDS-Q5-0001 còn không em" });
check("CTV-04 người LẠ mở đầu bằng mã tin → đi nhánh mua như thường, không ghi fact", !r.body.noi_bo && db().t.listing_facts.filter((f) => f.source === "ctv").length === 1 && db().log.some((l) => l.rpc === "nguoi_noi_bo"), JSON.stringify(r.body));

// ── TS-DIABAN: địa bàn mở — quận/huyện lấy từ câu rao, không ghi cứng Quận 5 (FR-174, 03/09/2026)
fresh(); r = await send({ external_user_id: "la-db1", text: "bán nhà Bến Lức Long An 2 tỷ 80m2" });
check("DIABAN-01 rao ở Long An → district 'Bến Lức, Long An'", db().t.listings[0]?.district === "Bến Lức, Long An", JSON.stringify(db().t.listings[0]));
fresh(); r = await send({ external_user_id: "la-db2", text: "bán nhà P4 giá 5 tỷ 8 50m2" });
// 20260917a: KHÔNG còn mặc định Quận 5 — chỉ nói phường thì quận để trống, bot hỏi thêm quận.
check("DIABAN-02 chỉ nói phường → quận ĐỂ TRỐNG (20260917a bỏ mặc định Quận 5), ward Phường 4", db().t.listings[0]?.district == null && db().t.listings[0]?.ward === "Phường 4", JSON.stringify(db().t.listings[0]));
fresh(); r = await send({ external_user_id: "la-db3", text: "bán nhà Tân Bình hẻm 6m 6 tỷ 60m2" });
check("DIABAN-03 tên quận trong câu rao → 'Quận Tân Bình'", db().t.listings[0]?.district === "Quận Tân Bình", JSON.stringify(db().t.listings[0]));

// ── TS-V48: chat-reply v48 — FR-105/108/31/27/79/65/116/114/99/45 (04/09/2026)
// FR-105 lọc liên hệ phía bot (chỉ nhánh người MUA)
fresh(seedKho);
db().insert("listing_facts", { listing_id: lst1().id, question: "phap_ly", answer: "sổ hồng riêng, liên hệ chủ 0703 123 456 hoặc zalo 0703123456, nhà số 12 Trần Hưng Đạo", source: "seller_chat" });
globalThis.__model.parse = () => OUT({ replies: ["Dạ căn này sổ hồng riêng ạ, anh gọi chủ 0703123456 nha"] });
r = await send({ external_user_id: "v48-1", text: "#BDS-Q5-0001 pháp lý sao em" });
st = sysText(parseCalls().pop());
// Số 0703… là SỐ GIẢ (ngoài guard PII 09x của soát tiền commit), vẫn khớp PHONE_RE.
check("V48-105a fact có SĐT/Zalo/số nhà → prompt gửi model không còn số, 'số 12' bị bỏ, tên đường giữ", !/0703/.test(st) && /\[liên hệ qua Zalo\]/.test(st) && !/số 12 Trần/.test(st) && /Trần Hưng Đạo/.test(st), st.slice(st.indexOf("CĂN KHÁCH"), st.indexOf("CĂN KHÁCH") + 500));
check("V48-105b bong bóng gửi khách mua không còn SĐT", !/0703/.test(r.body.reply) && /liên hệ qua Zalo/.test(r.body.reply), r.body.reply);
check("V48-105c địa chỉ tin (location_raw) trong KHO giữ nguyên số nhà (OPEN-36: khai khi khách hỏi)", /12 Trần Hưng Đạo/.test(st));
fresh(seedKho);
db().insert("info_requests", { listing_id: lst1().id, question: "phap_ly", status: "pending" });
r = await send({ external_user_id: "z-ccrb", text: "sổ hồng riêng, gọi tôi 0703 123 456" });
check("V48-105d nhánh người BÁN không lọc — fact giữ nguyên số để CTV gọi", db().t.listing_facts.some((f) => /0703 123 456/.test(f.answer)) && r.body.role === "seller");

// FR-108 interests ghi kèm khách
fresh(seedKho);
r = await send({ external_user_id: "v48-2", text: "#BDS-Q5-0001 còn không em" });
const bid = db().t.buyers.find((b) => b.zalo_user_id === "v48-2").id;
check("V48-108a khách nhắc căn → mark_listing_interest(p_codes, p_buyer_id) + dòng interests", db().log.some((l) => l.rpc === "mark_listing_interest" && l.args.p_buyer_id === bid) && db().t.interests.some((i) => i.buyer_id === bid && i.listing_id === lst1().id), JSON.stringify(db().t.interests));
globalThis.__model.parse = () => OUT({ ask_owner: { listing_code: "BDS-Q5-0004", question: "còn bán không" }, replies: ["Dạ để em hỏi lại chủ nhà rồi báo anh liền. Trong khi chờ, anh có câu hỏi gì khác về căn này không ạ?"] });
r = await send({ external_user_id: "v48-2", text: "căn ở An Dương Vương còn không" });
check("V48-108b ask_owner một căn → căn đó cũng vào interests", db().t.interests.some((i) => i.buyer_id === bid && i.listing_id === db().t.listings[3].id), JSON.stringify(db().t.interests));
globalThis.__rpc.mark_listing_interest = (d, a) => a.p_buyer_id ? { data: null, error: { code: "PGRST202", message: "Could not find the function mark_listing_interest(p_buyer_id, p_codes)" } } : { data: 1, error: null };
r = await send({ external_user_id: "v48-2", text: "#BDS-Q5-0005 sao em" });
const mi = db().log.filter((l) => l.rpc === "mark_listing_interest");
check("V48-108c overload chưa có (PGRST202) → gọi lại bản cũ, lỗi vào sổ, khách vẫn có trả lời", mi.at(-1).args.p_buyer_id == null && mi.at(-2).args.p_buyer_id === bid && db().t.bot_errors.some((e) => e.source === "chat-reply mark_listing_interest(buyer)") && r.body.replies.length > 0);
check("V48-45 luật + fewshot: hứa hỏi chủ → kết bằng 'Trong khi chờ, anh/chị có câu hỏi gì khác về căn này không ạ?'", (() => { const s0 = parseCalls().pop().params.system[0].text; return /Trong khi chờ, anh\/chị có câu hỏi gì khác về căn này không ạ\?/.test(s0) && /voice_request=true/.test(s0) && /giá TB phường/.test(s0) && /CĂN TƯƠNG TỰ/.test(s0) && /CHẤM SAO/.test(s0); })());

// FR-31 căn tương tự
fresh(seedKho);
db().t.listings[2].access_type = "hem_xe_hoi"; // #0003 (Phường 12, 9 tỷ, đã gỡ)
db().insert("listings", { code: "BDS-Q5-0006", seller_id: db().t.sellers[0].id, deal: "ban", status: "dang_ban", location_raw: "8 Hồng Bàng", ward: "Phường 12", price_raw: "8 tỷ", price_vnd: 8e9, area_m2: 70, access_type: "hem_xe_hoi" });
db().insert("listings", { code: "BDS-Q5-0007", seller_id: db().t.sellers[0].id, deal: "ban", status: "dang_ban", location_raw: "9 Hồng Bàng", ward: "Phường 12", price_raw: "12 tỷ", price_vnd: 12e9, area_m2: 100 });
db().insert("listings", { code: "BDS-Q5-0008", seller_id: db().t.sellers[0].id, deal: "ban", status: "dang_ban", location_raw: "10 Hồng Bàng", ward: "Phường 12", price_raw: "7 tỷ", price_vnd: 7e9, area_m2: 60, access_type: "mat_tien" });
r = await send({ external_user_id: "v48-3", text: "#BDS-Q5-0003 còn ko em" });
st = sysText(parseCalls().pop());
let tt = st.slice(st.indexOf("CĂN TƯƠNG TỰ"));
check("V48-31a căn khách hỏi ĐÃ GỠ → CĂN TƯƠNG TỰ cùng phường, giá 0,7–1,3× (0006, 0008), không 0007 (12 tỷ), cùng hẻm xe hơi xếp trước", /CĂN TƯƠNG TỰ \(cùng khu, giá 0,7–1,3 lần căn #BDS-Q5-0003/.test(st) && tt.indexOf("BDS-Q5-0006") > 0 && tt.indexOf("BDS-Q5-0006") < tt.indexOf("BDS-Q5-0008") && !/BDS-Q5-0007/.test(tt) && !/Hồng Bàng|9 tỷ/.test(st.slice(st.indexOf("CĂN KHÁCH"), st.indexOf("CĂN TƯƠNG TỰ"))), tt.slice(0, 400));
globalThis.__model.parse = () => OUT({ replies: ["Dạ có căn #BDS-Q5-0006 nè anh, hẻm xe hơi 8 tỷ"] });
r = await send({ external_user_id: "v48-3", text: "vậy có căn nào khác không" });
globalThis.__model.parse = () => OUT();
r = await send({ external_user_id: "v48-3", text: "còn căn nào giống giống vầy không em" });
st = sysText(parseCalls().pop());
check("V48-31b 'giống giống vầy' không kèm mã → căn gốc = căn bot vừa nói (#0006), tương tự có 0008", /căn #BDS-Q5-0006/.test(st) && /BDS-Q5-0008/.test(st.slice(st.indexOf("CĂN TƯƠNG TỰ"))), st.slice(st.indexOf("CĂN TƯƠNG TỰ") - 20, st.indexOf("CĂN TƯƠNG TỰ") + 400));

// FR-27 gửi ≤4 hình + "xem thêm"
fresh(seedKho);
for (let i = 1; i <= 6; i++) db().insert("listing_photos_v", { code: "BDS-Q5-0001", url: `https://x/p${i}.jpg` });
globalThis.__model.parse = () => OUT({ send_photos: "BDS-Q5-0001", replies: ["Dạ em gửi hình liền đây ạ"] });
r = await send({ external_user_id: "v48-4", text: "cho xem hình #BDS-Q5-0001" });
const b4 = () => db().t.buyers.find((b) => b.zalo_user_id === "v48-4");
check("V48-27a 6 hình → gửi 4 tấm đầu, kết 'xem thêm hình không ạ?', offset ở preferences.photo_offset", r.body.photos.length === 4 && r.body.photos[0] === "https://x/p1.jpg" && /xem thêm hình không ạ\?$/.test(r.body.replies.at(-1)) && r.body.more_photos === true && b4().preferences.photo_offset?.n === 4 && b4().preferences.photo_offset?.code === "BDS-Q5-0001", JSON.stringify({ body: r.body, p: b4().preferences }));
globalThis.__model.parse = () => OUT({ replies: ["Dạ em gửi tiếp nè"] });
r = await send({ external_user_id: "v48-4", text: "xem thêm" });
check("V48-27b 'xem thêm' → 2 tấm kế (p5, p6), hết hình thì không hỏi nữa, offset xoá", r.body.photos.length === 2 && r.body.photos[0] === "https://x/p5.jpg" && !r.body.more_photos && !/xem thêm hình/.test(r.body.reply) && b4().preferences.photo_offset == null, JSON.stringify({ body: r.body, p: b4().preferences }));
check("V48-27c model được báo khách xin xem thêm (không hứa đi xin chủ)", /XIN XEM THÊM HÌNH/.test(parseCalls().pop().params.messages[0].content.at(-1).text));

// FR-79 voice
fresh(seedKho);
r = await send({ external_user_id: "v48-5", text: "alo được không em, gọi cho anh đi" });
const b5 = db().t.buyers.find((b) => b.zalo_user_id === "v48-5");
check("V48-79a người lạ 'alo được không' → KHÔNG hỏi vai, need_human, việc escalation 'VOICE: Zalo …<4 số cuối> muốn gọi điện…' (A4: che uid), voice_request trong payload", !r.body.hoi_vai && r.body.voice_request === true && db().t.conversations.find((c) => c.buyer_id === b5.id).needs_human === true && db().t.reminders.some((x) => x.kind === "escalation" && x.buyer_id === b5.id && /^VOICE: Zalo …48-5 muốn gọi điện/.test(x.note)), JSON.stringify({ body: r.body, rem: db().t.reminders }));
r = await send({ external_user_id: "v48-5", text: "gọi điện cho anh nha" });
check("V48-79b lặp trong 24h → không đẻ thêm việc VOICE", db().t.reminders.filter((x) => /^VOICE:/.test(x.note)).length === 1);
fresh(seedKho);
await send({ external_user_id: "v48-5b", text: "tìm nhà q5 tầm 5 tỷ" });
globalThis.__model.parse = () => OUT({ voice_request: true, replies: ["Dạ để em nhờ anh phụ trách gọi lại ạ"] });
r = await send({ external_user_id: "v48-5b", text: "mình nói chuyện trực tiếp được không" });
check("V48-79c model bật voice_request (regex không bắt) → vẫn mở việc VOICE + need_human", db().t.reminders.some((x) => /^VOICE:/.test(x.note)) && r.body.voice_request === true && db().t.conversations.at(-1).needs_human === true);
globalThis.__model.parse = () => { throw new Error("model chết"); };
r = await send({ external_user_id: "v48-5c", text: "goi dien cho toi duoc khong" });
check("V48-79d model hỏng + không dấu → câu mẫu 'nhờ anh/chị phụ trách gọi lại' + việc VOICE", /gọi lại/.test(r.body.reply) && db().t.reminders.some((x) => /^VOICE: Zalo …8-5c/.test(x.note)));

// FR-65 chấm sao sau buổi xem
fresh(seedKho);
const b6 = db().insert("buyers", { zalo_user_id: "v48-6", name: "Anh S.", preferences: { area: "phường 4", budget: "5 tỷ" } }).data;
db().insert("reminders", { kind: "feedback", buyer_id: b6.id, listing_id: lst1().id, status: "sent", sent_at: new Date(Date.now() - 3600e3).toISOString(), due_at: new Date(Date.now() - 3600e3).toISOString(), note: "hỏi cảm nhận sau khi xem #BDS-Q5-0001" });
r = await send({ external_user_id: "v48-6", text: "4 sao em" });
check("V48-65a '4 sao' trong 48h sau nhắc feedback → ghi_danh_gia(buyer, tin của buổi xem, 4) + model được báo", db().t.ratings.some((x) => x.buyer_id === b6.id && x.listing_id === lst1().id && x.stars === 4) && r.body.rated === 4 && /VỪA CHẤM 4\/5 SAO/.test(parseCalls().pop().params.messages[0].content.at(-1).text), JSON.stringify(db().t.ratings));
fresh(seedKho);
const b6b = db().insert("buyers", { zalo_user_id: "v48-6b", preferences: { area: "phường 4", budget: "5 tỷ" } }).data;
db().insert("reminders", { kind: "feedback", buyer_id: b6b.id, listing_id: lst1().id, status: "sent", sent_at: new Date(Date.now() - 3 * 864e5).toISOString(), due_at: new Date(Date.now() - 3 * 864e5).toISOString(), note: "cũ" });
r = await send({ external_user_id: "v48-6b", text: "3/5 thôi em" });
check("V48-65b nhắc feedback đã quá 48h → không ghi đánh giá", !db().log.some((l) => l.rpc === "ghi_danh_gia") && r.body.rated == null);
globalThis.__rpc.ghi_danh_gia = () => ({ data: null, error: { message: "function ghi_danh_gia does not exist" } });
db().insert("reminders", { kind: "feedback", buyer_id: b6b.id, listing_id: lst1().id, status: "sent", sent_at: new Date().toISOString(), due_at: new Date().toISOString(), note: "mới" });
r = await send({ external_user_id: "v48-6b", text: "chấm 5 luôn" });
check("V48-65c RPC chưa có → lỗi vào sổ, khách vẫn được trả lời", db().t.bot_errors.some((e) => e.source === "chat-reply ghi_danh_gia") && r.body.replies.length > 0 && r.body.rated === 5);

// FR-114/116 dự án
fresh(seedKho);
const pj = db().insert("projects", { name: "Ny'ah Phú Định", developer: "X", district: "Quận 8", is_partner: true, priority: 1 }).data;
globalThis.__rpc.match_projects = (d, a) => ({ data: /ny'?ah/i.test(a.p_text) ? [pj] : [], error: null });
db().insert("listings", { code: "BDS-Q5-0009", seller_id: db().t.sellers[0].id, deal: "ban", status: "dang_ban", location_raw: "Ny'ah", ward: "Phường 16", price_raw: "6 tỷ", price_vnd: 6e9, area_m2: 60, project_id: pj.id, unit_code: "A12-05", unit_status: "giu_cho", last_confirmed_at: new Date(Date.now() - 10 * 864e5).toISOString() });
db().insert("listings", { code: "BDS-Q5-0010", seller_id: db().t.sellers[0].id, deal: "ban", status: "dang_ban", location_raw: "Ny'ah", ward: "Phường 16", price_raw: "6,2 tỷ", price_vnd: 6.2e9, area_m2: 62, project_id: pj.id, unit_code: "A12-06", unit_status: "con_ban", last_confirmed_at: new Date().toISOString() });
db().insert("buyers", { zalo_user_id: "v48-7", preferences: { deal: "ban" } });
r = await send({ external_user_id: "v48-7", text: "căn A12-05 dự án Ny'ah còn không em" });
st = sysText(parseCalls().pop());
let cd = st.slice(st.indexOf("CĂN TRONG DỰ ÁN"));
check("V48-116a 'căn X dự án Y còn không' → khối CĂN TRONG DỰ ÁN đúng căn A12-05: 'đang giữ chỗ', quá 7 ngày → dặn xác nhận lại chủ + ask_owner", /CĂN TRONG DỰ ÁN/.test(st) && /dự án Ny'ah Phú Định căn A12-05 · tình trạng căn: đang giữ chỗ · chủ xác nhận lần cuối QUÁ 7 NGÀY/.test(cd) && !/A12-06/.test(cd), cd.slice(0, 500));
r = await send({ external_user_id: "v48-7", text: "căn B9-99 dự án Ny'ah còn không" });
st = sysText(parseCalls().pop());
check("V48-116b mã căn không có trong kho → nói thật, không bịa", /căn B9-99: KHÔNG có trong kho/.test(st));
r = await send({ external_user_id: "v48-7", text: "#BDS-Q5-0010 còn không" });
st = sysText(parseCalls().pop());
check("V48-116c căn khách nhắc thuộc dự án → dòng mang dự án + 'còn bán' + chủ xác nhận 0 ngày trước", /căn A12-06 · tình trạng căn: còn bán · chủ xác nhận 0 ngày trước/.test(st.slice(st.indexOf("CĂN KHÁCH"))));
r = await send({ external_user_id: "v48-8", text: "bán căn A12-07 dự án Ny'ah giá 6 tỷ 60m2" });
const L9 = db().t.listings.at(-1);
check("V48-114 câu rao có tên dự án → tin gắn project_id + unit_code A12-07 (14/09: A12-05 đã có tin — mock nay mô phỏng listings_project_unit_uniq), unit_status con_ban, last_confirmed_at", r.body.role === "seller" && L9.project_id === pj.id && L9.unit_code === "A12-07" && L9.unit_status === "con_ban" && !!L9.last_confirmed_at, JSON.stringify(L9));
fresh(seedKho); r = await send({ external_user_id: "v48-8b", text: "bán nhà P4 giá 5 tỷ 8 50m2" });
check("V48-114b câu rao không có dự án → hàng lẻ như cũ (project_id/unit_status null)", db().t.listings.at(-1).project_id == null && db().t.listings.at(-1).unit_status == null);

// FR-99 giá TB phường
fresh(seedKho);
db().insert("buyers", { zalo_user_id: "v48-9", preferences: { area: "phường 4", budget: "tầm 6 tỷ", deal: "ban" } });
const nGia = () => db().log.filter((l) => l.table === "listings" && l.op === "select" && l.sel === "price_vnd, area_m2").length;
r = await send({ external_user_id: "v48-9", text: "#BDS-Q5-0001 giá vậy ok không em" });
st = sysText(parseCalls().pop());
check("V48-99a KHO kèm 'giá TB phường 4 (bán): 116 tr/m² (1 tin)' từ tin cùng deal+phường", /\(giá TB phường 4 \(bán\): 116 tr\/m² \(1 tin\) - ước tính từ kho/.test(st), st.slice(0, 400));
r = await send({ external_user_id: "v48-9", text: "còn căn khác không" });
check("V48-99b giá TB nhớ tạm 60 s ở tầng module — hai lượt ≤ MỘT truy vấn (khoá deal|phường dùng chung mọi khách)", nGia() <= 1 && /giá TB phường 4/.test(sysText(parseCalls().pop())), String(nGia()));
fresh(seedKho); r = await send({ external_user_id: "v48-9b", text: "#BDS-Q5-0001 sao em" });
check("V48-99c chưa đủ hồ sơ (khu vực + giá) → không tính giá TB, không truy vấn thừa", nGia() === 0 && !/giá TB phường/.test(sysText(parseCalls().pop())));

// ── SEC: hồi quy các lỗ vá 05/09/2026 (soát bảo mật 05/09 → FR-167; file audit đã xoá 07/09) ──
// Mỗi ca dưới đây tương ứng một finding. Sửa cửa vào chat-reply mà làm hỏng
// một trong số này nghĩa là đã mở lại đúng cái lỗ vừa đóng.

// SEC-02 — cổng fail-CLOSED. Không kèm bí mật thì phải bị chặn, kể cả khi
// người gọi biết đúng external_user_id.
fresh(seedKho);
r = await send({ external_user_id: "z-ccrb", text: "chào em" }, { "x-bridge-secret": "SAI" });
check("SEC-02 sai bí mật cổng → 403, không xử lý", r.status === 403 && r.body.error === "forbidden", JSON.stringify(r));
r = await send({ external_user_id: "z-ccrb", text: "chào em" }, { "x-bridge-secret": "" });
check("SEC-02 thiếu bí mật cổng → 403", r.status === 403, JSON.stringify(r));

// SEC-06 — cắt đầu vào. `text` dài phải bị cắt còn 4.000 ký tự TRƯỚC khi vào
// prompt; body khổng lồ phải bị từ chối trước cả khi parse.
fresh(seedKho);
const dai = "a".repeat(9000);
r = await send({ external_user_id: "sec-06", text: `tìm nhà quận 5 tầm 5 tỷ ${dai}` });
const guiModel = parseCalls().pop();
check("SEC-06 text 9.000 ký tự → chuỗi vào model bị cắt ≤ 4.000",
  !guiModel || JSON.stringify(guiModel.params.messages).length < 9000, String(JSON.stringify(guiModel?.params?.messages ?? "").length));
check("SEC-06 tin lưu sổ cũng đã cắt", (db().t.messages.find((m) => m.sender === "buyer")?.body?.length ?? 0) <= 4000,
  String(db().t.messages.find((m) => m.sender === "buyer")?.body?.length));
{
  // Body vượt trần: đo bằng content-length như cửa thật.
  const b = { external_user_id: "sec-06b", text: "x".repeat(200_000), msg_id: "m-big", channel: "zalo_personal_test" };
  const tho = JSON.stringify(b);
  const hdrs = { "x-bridge-secret": "s3cret", "content-length": String(tho.length) };
  const res = await H({ method: "POST", headers: { get: (k) => hdrs[k.toLowerCase()] ?? null }, text: async () => tho, json: async () => b });
  check("SEC-06 body > 128 KB → 413, không đụng DB", res.status === 413, String(res.status));
}

// SEC-08 — chỉ nhận ảnh từ host Zalo. URL lạ phải bị bỏ như thể không có ảnh,
// và KHÔNG được ghi vào listing_facts (bảng anon đọc được).
fresh(seedKho);
r = await send({ external_user_id: "z-ccrb", text: "", image_url: "https://ke-tan-cong.example/beacon.png" });
check("SEC-08 ảnh host lạ → bỏ, không ghi fact nào mang URL đó",
  !db().t.listing_facts.some((f) => /ke-tan-cong/.test(String(f.answer))), JSON.stringify(db().t.listing_facts));
fresh(seedKho);
r = await send({ external_user_id: "z-ccrb", text: "", image_url: "http://f9-zpg.zdn.vn/a.jpg" });
check("SEC-08 http:// (không TLS) cũng bị bỏ",
  !db().t.listing_facts.some((f) => /f9-zpg/.test(String(f.answer))), JSON.stringify(db().t.listing_facts));
fresh(seedKho);
r = await send({ external_user_id: "z-ccrb", text: "", image_url: "https://f9-zpg.zdn.vn.ke-gian.example/a.jpg" });
check("SEC-08 host giả mạo hậu tố (…zdn.vn.ke-gian.example) bị bỏ",
  !db().t.listing_facts.some((f) => /ke-gian/.test(String(f.answer))), JSON.stringify(db().t.listing_facts));

// SEC-05 — trần cá nhân. RPC trả false → im với RIÊNG người đó, mã 429.
fresh(seedKho);
globalThis.__rpc = { bump_user_quota: () => ({ data: false, error: null }) };
r = await send({ external_user_id: "sec-05", text: "tìm nhà quận 5 tầm 5 tỷ" });
check("SEC-05 chạm trần cá nhân → 429, không gọi model", r.status === 429 && parseCalls().length === 0, JSON.stringify(r));
globalThis.__rpc = {};

// SEC-13 — mark_sent không đụng được dòng đã chốt gửi / không tồn tại.
fresh(seedKho);
r = await send({ external_user_id: "sec-13", mark_sent: "khong-ton-tai", sent_bubbles: 1 });
check("SEC-13 mark_sent msg_id không tồn tại → ok:false", r.body.ok === false, JSON.stringify(r.body));

// ── CỔNG: bốn kiểu người gọi ─────────────────────────────────────────────
// Bộ 112 ca ở trên đều gửi bí mật ĐÚNG, nên chúng chứng minh "bí mật đúng thì
// qua" một cách ngầm định. Bốn ca dưới đây nói thẳng từng đường vào, để sửa
// cổng mà làm gãy một đường thì thấy ngay đường nào.

// (1) service-role: zalo-webhook gọi chat-reply bằng service key, KHÔNG có
// x-bridge-secret. Đây là đường sống của kênh OA — gãy là bot câm với OA.
fresh(seedKho);
r = await send(
  { external_user_id: "zalo-oa-1", text: "tìm nhà quận 5 tầm 5 tỷ", channel: "zalo_oa" },
  { "x-bridge-secret": undefined, authorization: "Bearer svc" },
);
check("CỔNG-1 service-role (đường zalo-webhook) → qua, không cần bí mật cổng",
  r.status === 200 && !r.body.error, JSON.stringify(r).slice(0, 200));
check("CỔNG-1 kênh zalo_oa xử lý bình thường, có trả lời",
  Array.isArray(r.body.replies) && r.body.replies.length > 0, JSON.stringify(r.body).slice(0, 200));

// (2) bí mật ĐÚNG (đường bridge) — khẳng định tường minh, không để ngầm.
fresh(seedKho);
r = await send({ external_user_id: "bridge-1", text: "tìm nhà quận 5 tầm 5 tỷ" });
check("CỔNG-2 bí mật cổng ĐÚNG (đường bridge) → qua", r.status === 200 && !r.body.error, JSON.stringify(r).slice(0, 200));

// (3) service key SAI → không được mượn đường service-role.
fresh(seedKho);
r = await send(
  { external_user_id: "gia-mao", text: "chào em" },
  { "x-bridge-secret": undefined, authorization: "Bearer KHONG-PHAI-SERVICE-KEY" },
);
check("CỔNG-3 Bearer sai → 403 (không mượn được đường service-role)",
  r.status === 403, JSON.stringify(r));

// (4) mark_sent HAPPY PATH — bridge chốt đúng dòng nó vừa gửi.
// Ca SEC-13 ở trên chỉ chứng minh chiều TỪ CHỐI; thiếu ca này thì một bản vá
// siết quá tay sẽ làm bridge không bao giờ ghi được sent_at mà test vẫn xanh.
fresh(seedKho);
r = await send({ external_user_id: "ms-1", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "ms-happy" });
r = await send({ external_user_id: "ms-1", mark_sent: "ms-happy", sent_bubbles: 2, done: true });
{
  const so = db().t.inbound_ledger.find((x) => x.zalo_msg_id === "ms-happy");
  check("CỔNG-4 mark_sent dòng vừa gửi → ok:true và sổ ghi sent_at",
    r.body.ok === true && !!so?.sent_at && so?.sent_bubbles === 2,
    JSON.stringify({ body: r.body, so }));
}

// (5) human_note (FR-141) — bridge báo NGƯỜI THẬT vừa gõ tay, bot nhường sân.
// Cửa này nằm SAU cổng bí mật và TRƯỚC sổ inbound, nên dễ bị một bản vá cổng
// làm gãy mà không ca nào chạm tới.
fresh(seedKho);
r = await send({ external_user_id: "z-ccrb", text: "anh gọi chị D. rồi nhé", human_note: true });
{
  const conv = db().t.conversations.find((c) => c.human_touch_at);
  check("CỔNG-5 human_note → ok, ghi tin sender='human', đặt human_touch_at",
    r.body.ok === true && r.body.human_note === true &&
    db().t.messages.some((m) => m.sender === "human") && !!conv,
    JSON.stringify({ body: r.body, co_human: db().t.messages.some((m) => m.sender === "human") }));
  check("CỔNG-5 human_note hạ cờ needs_human (FR-147)",
    conv ? conv.needs_human === false : false, JSON.stringify(conv));
}

// ── ĐUA: SELECT-kiểm-tồn-tại rồi INSERT ──────────────────────────────────
// Zalo giao hai tin của cùng một người cách nhau vài trăm ms. `claim_inbound`
// chỉ chặn giao TRÙNG một msg_id — hai msg_id KHÁC nhau chạy song song thật.
// `Promise.all` dưới đây tái hiện đúng cảnh đó: hai lượt handler xen kẽ nhau ở
// mọi điểm `await`, nên cùng đọc "chưa có" rồi cùng ghi. Mock đã mô phỏng ba
// chỉ mục duy nhất từng phần của 20260905f/g, nên nếu code không bắt 23505 thì
// mấy ca này đỏ.

// PHẢI TRỄ CẢ CÚ GHI, không chỉ cú đọc. Bản đầu chỉ trễ `select` và ca kiểm
// vẫn xanh kể cả khi tắt sạch chỉ mục duy nhất — đo lại mới thấy vì sao:
// `setTimeout` là macrotask, nên khi select của lượt A xong thì TOÀN BỘ phần
// còn lại của A (đều là microtask) chạy hết — ghi xong xuôi — trước khi timer
// của lượt B kịp nổ. Hai lượt vẫn nối đuôi, chỉ là nối đuôi chậm hơn.
// Cho cú ghi một độ trễ DÀI HƠN cú đọc thì thứ tự thành:
//   đọc A (rỗng) → đọc B (rỗng) → ghi A (được) → ghi B (23505)
// tức đúng cuộc đua thật. Kiểm bằng đột biến ở cuối: tắt mô phỏng chỉ mục
// duy nhất thì mấy ca dưới phải ĐỎ.
const treDoc = (bang) => (t, op) => (t !== bang ? 0 : op === "select" ? 5 : 25);

// (1) Hai tin cùng hẹn một buổi xem.
fresh(seedKho);
globalThis.__treTruyVan = treDoc("viewings");
globalThis.__model.parse = () => OUT({
  viewing: { listing_code: "BDS-Q5-0001", when: "mai 9h sáng", phone: null },
});
{
  const [ra, rb] = await Promise.all([
    send({ external_user_id: "dua-vw", text: "mai 9h anh qua xem căn BDS-Q5-0001 nha" }),
    send({ external_user_id: "dua-vw", text: "mai 9h anh qua xem căn BDS-Q5-0001 nha" }),
  ]);
  const vws = db().t.viewings.filter((v) => v.status === "pending");
  const nhac = db().t.reminders.filter((r) => r.kind === "viewing");
  check("ĐUA-1 hai tin hẹn xem song song → CHỈ MỘT buổi xem", vws.length === 1,
    JSON.stringify(vws.map((v) => ({ id: v.id, code: v.listing_code }))));
  check("ĐUA-1 → CHỈ MỘT nhắc trước buổi xem (khách không bị nhắc hai lần)",
    nhac.length === 1, JSON.stringify(nhac.map((r) => r.note)));
  check("ĐUA-1 cả hai lượt vẫn trả lời được, không lượt nào 500",
    ra.status === 200 && rb.status === 200, JSON.stringify([ra.status, rb.status]));
  check("ĐUA-1 lượt thua vẫn gắn được nhắc vào buổi xem của lượt thắng",
    nhac[0]?.viewing_id === vws[0]?.id, JSON.stringify({ nhac: nhac[0]?.viewing_id, vw: vws[0]?.id }));
}

// (2) Hai tin cùng chốt một kèo. `deals_listing_buyer_key` đã có từ trước, nên
// dòng deals thứ hai vốn đã bị chặn — cái CHƯA được chặn là khối chạy TIẾP sau
// đó: bản trước không đọc `error` nên lượt thua vẫn bắn thêm một việc
// escalation "khách vừa ĐỒNG Ý CHỐT, liên hệ gấp". CTV nhận hai lần một kèo.
fresh(seedKho);
{
  // Lượt khởi động: khách mới toanh thì lượt đầu rẽ vào nhánh HỎI VAI và không
  // bao giờ tới khối chốt kèo — đo mới thấy (một lượt đụng `deals`, một lượt
  // trả câu chào). Không có lượt này thì ca đua bên dưới xanh vì chỉ có MỘT
  // lượt chạy thật, chứ không phải vì code đúng.
  await send({ external_user_id: "dua-deal", text: "anh đang tìm mua nhà quận 5" });
  globalThis.__treTruyVan = treDoc("deals");
  globalThis.__model.parse = () => OUT({ agreed_deal: { listing_code: "BDS-Q5-0001" } });
  const [ra, rb] = await Promise.all([
    send({ external_user_id: "dua-deal", text: "ok em, anh chốt căn này" }),
    send({ external_user_id: "dua-deal", text: "ok em, anh chốt căn này" }),
  ]);
  const esc = db().t.reminders.filter((r) => r.kind === "escalation" && /ĐỒNG Ý CHỐT/.test(r.note ?? ""));
  check("ĐUA-2 hai tin chốt song song → CHỈ MỘT deal", db().t.deals.length === 1,
    JSON.stringify(db().t.deals.length));
  check("ĐUA-2 → CHỈ MỘT việc báo gấp cho CTV", esc.length === 1,
    JSON.stringify(esc.map((r) => r.note?.slice(0, 40))));
  check("ĐUA-2 cả hai lượt đều 200", ra.status === 200 && rb.status === 200,
    JSON.stringify([ra.status, rb.status]));
}

// (3) Hai khách cùng hỏi chủ nhà một câu về một căn (FR-140).
fresh(seedKho);
globalThis.__treTruyVan = treDoc("info_requests");
globalThis.__model.parse = () => OUT({
  ask_owner: { listing_code: "BDS-Q5-0001", question: "còn bán không" },
  replies: ["Dạ để em hỏi lại chủ nhà rồi báo anh liền ạ"],
});
{
  const [ra, rb] = await Promise.all([
    send({ external_user_id: "dua-ask-1", text: "căn BDS-Q5-0001 còn bán không em" }),
    send({ external_user_id: "dua-ask-2", text: "căn BDS-Q5-0001 còn bán không em" }),
  ]);
  const irs = db().t.info_requests.filter((r) => r.status === "pending");
  check("ĐUA-3 hai khách cùng hỏi một câu → CHỈ MỘT câu chờ chủ nhà",
    irs.length === 1, JSON.stringify(irs.map((r) => r.question)));
  check("ĐUA-3 cả hai khách vẫn nhận được trả lời",
    ra.status === 200 && rb.status === 200 &&
    (ra.body.replies?.length ?? 0) > 0 && (rb.body.replies?.length ?? 0) > 0,
    JSON.stringify([ra.status, rb.status]));
  check("ĐUA-3 không có lỗi lạ nào lọt vào sổ (23505 phải được nuốt đúng chỗ)",
    db().t.bot_errors.filter((e) => /hoi chu nha/.test(String(e.source))).length === 0,
    JSON.stringify(db().t.bot_errors.map((e) => e.source)));
}

// (4) Hai tin cùng xin gặp người thật (viecNguoiThat).
// Bất biến: một khách đang có việc escalation CHỜ thì không mở thêm việc nữa —
// CTV không nên nhận hai tin "khách cần người thật" cho cùng một khách.
// Cửa sổ ở đây là "24 GIỜ TRƯỢT" (nhánh VOICE) và "còn pending" (nhánh thường),
// không phát biểu được bằng chỉ mục duy nhất, nên vá bằng RPC nguyên tử.
fresh(seedKho);
{
  await send({ external_user_id: "dua-nt", text: "anh đang tìm mua nhà quận 5" });
  globalThis.__treTruyVan = treDoc("reminders");
  globalThis.__model.parse = () => OUT({ need_human: true, replies: ["Dạ để em nhờ anh phụ trách ạ"] });
  const [ra, rb] = await Promise.all([
    send({ external_user_id: "dua-nt", text: "cho anh gặp người thật đi em" }),
    send({ external_user_id: "dua-nt", text: "cho anh gặp người thật đi em" }),
  ]);
  const esc = db().t.reminders.filter((r) => r.kind === "escalation");
  check("ĐUA-4 hai tin xin người thật song song → CHỈ MỘT việc escalation",
    esc.length === 1, JSON.stringify(esc.map((r) => r.note?.slice(0, 45))));
  check("ĐUA-4 cả hai lượt đều 200", ra.status === 200 && rb.status === 200,
    JSON.stringify([ra.status, rb.status]));
  check("ĐUA-4 cờ needs_human vẫn được bật",
    db().t.conversations.some((c) => c.needs_human === true),
    JSON.stringify(db().t.conversations.map((c) => c.needs_human)));
}

// ══════════ TRÙNG: claim_inbound giữ đúng-một-lần (FR-166) ══════════════════
// KHÔNG sửa `claim_inbound` — nó đã có chốt nguyên tử trên `inbound_ledger`.
// Mười cảnh dưới đây chỉ ĐO xem cái chốt đó có thật sự giữ bốn lời hứa không:
// không gọi model lần hai · không đốt hạn mức lần hai · không đẻ tin trùng ·
// không gửi trùng.
//
// Mock đã được chép lại cho đủ NĂM nhánh của hàm thật (received / completed /
// in_flight / dead / failed-có-giờ-hẹn). Bản mock cũ chỉ có ba, tức bốn cảnh
// dưới đây trước nay không kiểm được.
const soModel = () => globalThis.__calls.filter((c) => c.kind === "parse" || c.kind === "create").length;
const soRpc = (ten) => db().log.filter((x) => x.rpc === ten).length;
const soDong = (b) => db().t[b].length;
const soTin = () => db().t.messages.length;

// (1) Cùng msg_id gửi HAI lần.
fresh(seedKho);
{
  const r1 = await send({ external_user_id: "trung-1", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-1" });
  const m1 = soModel(), t1 = soTin(), q1 = soRpc("bump_user_quota");
  const r2 = await send({ external_user_id: "trung-1", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-1" });
  check("TRÙNG-1 lần hai → deduped/replayed, không phải xử lại từ đầu",
    r2.body.deduped === true && r2.body.replayed === true, JSON.stringify(r2.body).slice(0, 200));
  check("TRÙNG-1 KHÔNG gọi model lần hai", soModel() === m1, `${m1} → ${soModel()}`);
  check("TRÙNG-1 KHÔNG đốt hạn mức lần hai", soRpc("bump_user_quota") === q1,
    `${q1} → ${soRpc("bump_user_quota")}`);
  check("TRÙNG-1 KHÔNG đẻ tin trùng trong hội thoại", soTin() === t1, `${t1} → ${soTin()}`);
  check("TRÙNG-1 lần hai trả lại ĐÚNG câu cũ", JSON.stringify(r2.body.replies) === JSON.stringify(r1.body.replies),
    JSON.stringify([r1.body.replies, r2.body.replies]));
}

// (2) Cùng msg_id gửi MƯỜI lần — provider giao lại liên tục.
fresh(seedKho);
{
  await send({ external_user_id: "trung-2", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-2" });
  const m1 = soModel(), t1 = soTin(), q1 = soRpc("bump_user_quota");
  for (let i = 0; i < 9; i++) {
    await send({ external_user_id: "trung-2", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-2" });
  }
  check("TRÙNG-2 mười lượt giao → vẫn ĐÚNG MỘT lượt model", soModel() === m1, `${m1} → ${soModel()}`);
  check("TRÙNG-2 → vẫn đúng một lượt hạn mức", soRpc("bump_user_quota") === q1, `${q1} → ${soRpc("bump_user_quota")}`);
  check("TRÙNG-2 → không tin nào thừa", soTin() === t1, `${t1} → ${soTin()}`);
  check("TRÙNG-2 → sổ vẫn MỘT dòng", soDong("inbound_ledger") === 1, JSON.stringify(soDong("inbound_ledger")));
}

// (3) Cùng msg_id ĐỒNG THỜI.
fresh(seedKho);
{
  globalThis.__treTruyVan = (t) => (t === "messages" ? 8 : 0);
  const [ra, rb] = await Promise.all([
    send({ external_user_id: "trung-3", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-3" }),
    send({ external_user_id: "trung-3", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-3" }),
  ]);
  const chan = [ra, rb].filter((r) => r.body.in_flight === true || r.body.deduped === true).length;
  check("TRÙNG-3 hai lượt cùng msg_id song song → đúng MỘT lượt bị chặn", chan === 1,
    JSON.stringify([ra.body.in_flight ?? ra.body.deduped, rb.body.in_flight ?? rb.body.deduped]));
  check("TRÙNG-3 → đúng MỘT lượt model", soModel() === 1, String(soModel()));
  check("TRÙNG-3 → đúng MỘT lượt hạn mức", soRpc("bump_user_quota") === 1, String(soRpc("bump_user_quota")));
}

// (4) Phát lại một dòng ĐÃ completed: phải trả câu cũ + cờ already_sent theo sổ.
fresh(seedKho);
{
  await send({ external_user_id: "trung-4", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-4" });
  const so = db().t.inbound_ledger.find((x) => x.zalo_msg_id === "T-4");
  so.sent_at = new Date().toISOString();          // webhook đã chốt gửi xong
  const r = await send({ external_user_id: "trung-4", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-4" });
  check("TRÙNG-4 completed + đã gửi → already_sent = true (kênh sẽ im, không bắn đúp)",
    r.body.replayed === true && r.body.already_sent === true, JSON.stringify(r.body).slice(0, 160));
  so.sent_at = null;                               // lần trước gửi hụt
  const r2 = await send({ external_user_id: "trung-4", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-4" });
  check("TRÙNG-4 completed + CHƯA gửi → already_sent = false (đây là đường retry gửi)",
    r2.body.replayed === true && r2.body.already_sent === false, JSON.stringify(r2.body).slice(0, 160));
}

// (5) in_flight: lượt trước còn đang cầm sổ và còn tươi.
fresh(seedKho);
{
  db().t.inbound_ledger.push({
    zalo_msg_id: "T-5", status: "processing", attempts: 1, reply: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  const r = await send({ external_user_id: "trung-5", text: "tìm nhà quận 5", msg_id: "T-5" });
  check("TRÙNG-5 đang có lượt khác cầm sổ → in_flight, KHÔNG gọi model",
    r.body.in_flight === true && soModel() === 0, JSON.stringify({ b: r.body, model: soModel() }));
}

// (6) processing NGUỘI (>150 giây): phải giành lại được, không kẹt vĩnh viễn.
fresh(seedKho);
{
  db().t.inbound_ledger.push({
    zalo_msg_id: "T-6", status: "processing", attempts: 1, reply: null,
    created_at: new Date(Date.now() - 600e3).toISOString(),
    updated_at: new Date(Date.now() - 600e3).toISOString(),
  });
  const r = await send({ external_user_id: "trung-6", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-6" });
  const so = db().t.inbound_ledger.find((x) => x.zalo_msg_id === "T-6");
  check("TRÙNG-6 processing nguội → GIÀNH LẠI được (function chết không khoá vĩnh viễn)",
    !r.body.in_flight && soModel() === 1 && so.attempts === 2,
    JSON.stringify({ in_flight: r.body.in_flight, model: soModel(), attempts: so.attempts }));
}

// (7) failed + giờ hẹn lùi dần: chưa tới giờ thì KHÔNG cho chạy lại.
fresh(seedKho);
{
  db().t.inbound_ledger.push({
    zalo_msg_id: "T-7", status: "failed", attempts: 2, reply: null,
    created_at: new Date(Date.now() - 600e3).toISOString(),
    updated_at: new Date(Date.now() - 600e3).toISOString(),
    next_retry_at: new Date(Date.now() + 60e3).toISOString(),
  });
  const r = await send({ external_user_id: "trung-7", text: "tìm nhà quận 5", msg_id: "T-7" });
  check("TRÙNG-7 chưa tới giờ hẹn → in_flight, không đốt thêm lượt model",
    r.body.in_flight === true && soModel() === 0, JSON.stringify({ b: r.body, model: soModel() }));
  const so = db().t.inbound_ledger.find((x) => x.zalo_msg_id === "T-7");
  so.next_retry_at = new Date(Date.now() - 1000).toISOString();
  const r2 = await send({ external_user_id: "trung-7", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-7" });
  check("TRÙNG-7 tới giờ hẹn → chạy lại được", !r2.body.in_flight && soModel() === 1,
    JSON.stringify({ b: r2.body.deduped, model: soModel() }));
}

// (8) THƯ CHẾT: đủ 8 lượt thì thôi hẳn, đừng đốt thêm lượt model nào.
fresh(seedKho);
{
  db().t.inbound_ledger.push({
    zalo_msg_id: "T-8", status: "failed", attempts: 8, reply: null,
    created_at: new Date(Date.now() - 600e3).toISOString(),
    updated_at: new Date(Date.now() - 600e3).toISOString(), next_retry_at: null,
  });
  const r = await send({ external_user_id: "trung-8", text: "tìm nhà quận 5", msg_id: "T-8" });
  check("TRÙNG-8 thư chết → dead:true, KHÔNG gọi model",
    r.body.dead === true && soModel() === 0, JSON.stringify({ b: r.body, model: soModel() }));
  check("TRÙNG-8 có ghi sổ để người còn biết mà xử tay",
    db().t.bot_errors.some((e) => String(e.source).includes("chat-reply dead")),
    JSON.stringify(db().t.bot_errors.map((e) => e.source)));
  check("TRÙNG-8 dòng sổ chuyển hẳn sang dead",
    db().t.inbound_ledger.find((x) => x.zalo_msg_id === "T-8").status === "dead", "");
}

// (9) HẠN MỨC + trùng: chạm trần rồi thì lượt giao lại KHÔNG được đốt thêm.
fresh(seedKho);
{
  globalThis.__rpc = { bump_user_quota: () => ({ data: false, error: null }) };
  const r1 = await send({ external_user_id: "trung-9", text: "tìm nhà quận 5", msg_id: "T-9" });
  const q1 = soRpc("bump_user_quota");
  const r2 = await send({ external_user_id: "trung-9", text: "tìm nhà quận 5", msg_id: "T-9" });
  check("TRÙNG-9 chạm trần → 429 và KHÔNG gọi model", r1.status === 429 && soModel() === 0,
    JSON.stringify({ s: r1.status, model: soModel() }));
  check("TRÙNG-9 giao lại khi đã chạm trần → KHÔNG hỏi hạn mức lần nữa",
    soRpc("bump_user_quota") === q1, `${q1} → ${soRpc("bump_user_quota")}`);
  check("TRÙNG-9 lượt giao lại vẫn không gọi model", soModel() === 0, String(soModel()));
  check("TRÙNG-9 lượt hai được nhận diện là trùng",
    r2.body.deduped === true || r2.body.in_flight === true, JSON.stringify(r2.body).slice(0, 160));
}

// (10) MODEL HỎNG rồi thử lại: lượt sau phải chạy lại được, không kẹt.
fresh(seedKho);
{
  globalThis.__model.parse = () => { throw new Error("model chết"); };
  const r1 = await send({ external_user_id: "trung-10", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-10" });
  const so = db().t.inbound_ledger.find((x) => x.zalo_msg_id === "T-10");
  check("TRÙNG-10 model hỏng → khách vẫn có câu trả lời (fallback), không im",
    (r1.body.replies?.length ?? 0) > 0, JSON.stringify(r1.body).slice(0, 160));
  check("TRÙNG-10 sổ KHÔNG bị bỏ dở: có trạng thái rõ ràng",
    ["completed", "failed", "dead"].includes(so.status), JSON.stringify(so.status));
  // Dựng lại cảnh "lượt trước hỏng thật, đã tới giờ hẹn"
  so.status = "failed"; so.attempts = 1; so.next_retry_at = new Date(Date.now() - 1000).toISOString();
  so.updated_at = new Date(Date.now() - 600e3).toISOString();
  globalThis.__model.parse = () => OUT({ replies: ["Dạ có căn hợp anh nè"] });
  const truoc = soModel();
  const r2 = await send({ external_user_id: "trung-10", text: "tìm nhà quận 5 tầm 5 tỷ", msg_id: "T-10" });
  check("TRÙNG-10 thử lại sau khi model hỏng → chạy lại được, gọi model lần nữa",
    !r2.body.in_flight && soModel() > truoc, JSON.stringify({ b: r2.body.deduped, model: soModel() }));
}

// ── FR-176: giọng người bán tự nhiên — lịch sử, xưng hô, câu lệch thì hỏi lại ──
// Tái hiện đúng lượt rao 15:37 07/09/2026 (#BDS-Q5-0174) mà sếp đọc log chê.
{
  fresh(seedKho);
  const prompt = (c) => c?.params?.messages?.[0]?.content ?? "";
  db().insert("info_requests", { listing_id: lst1().id, question: "phap_ly", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "Kêu chị nha" });
  // SRS-5.1s (01/10/2026, chủ dự án: "không được hỏi lại lần nào hết"): câu chưa được trả lời thì THÔI, không hỏi lại.
  check("G1 'kêu chị nha' khi đang hỏi pháp lý → KHÔNG ghi fact, thôi câu pháp lý (không hỏi lại), không rơi xuống chăm sóc chung",
    !db().t.listing_facts.some((f) => f.question === "phap_ly") &&
      db().t.info_requests.some((q) => q.question === "phap_ly" && q.status === "expired") &&
      !db().t.info_requests.some((q) => q.question === "phap_ly" && q.status === "pending") && r.body.reask !== "phap_ly",
    JSON.stringify(r.body));
  check("G1 nhớ xưng hô 'chị' vào sellers.xung_ho", db().t.sellers.find((s) => s.zalo_user_id === "z-ccrb")?.xung_ho === "chị", JSON.stringify(db().t.sellers[0]));
  check("G1 câu lệnh model mang cách gọi 'chị'", createCalls().some((c) => /Gọi chủ nhà là "chị"/.test(prompt(c))), prompt(createCalls().at(-1)));
  // SRS-5.1s: câu pháp lý đã thôi ở lượt G1 — vòng hỏi bù hôm sau hỏi lại (dựng lại câu treo đó).
  db().insert("info_requests", { listing_id: lst1().id, question: "phap_ly", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "sổ hồng riêng rồi em" });
  const cuoi = prompt(createCalls().at(-1));
  check("G2 lượt sau vẫn nói pháp lý → ghi fact pháp lý, không còn câu pháp lý treo",
    db().t.listing_facts.some((f) => f.question === "phap_ly" && /sổ hồng/.test(f.answer)) &&
      db().t.info_requests.every((q) => q.question !== "phap_ly" || q.status !== "pending"),
    JSON.stringify(db().t.info_requests));
  check("G2 câu lệnh có LỊCH SỬ (thấy 'Kêu chị nha' của lượt trước) và vẫn gọi 'chị'",
    /CHỦ NHÀ: Kêu chị nha/.test(cuoi) && /Gọi chủ nhà là "chị"/.test(cuoi), cuoi);
  // Căn 0001 đã đủ thông tin → nhánh "đã lên web": người 3 căn thì vẫn được
  // nhắc mã căn, và KHÔNG bị bảo "chỉ có một căn".
  // FR-178: nhiều căn thì neo bằng ĐỊA CHỈ, không đọc mã tin cho khách.
  check("G2 chính chủ 3 căn → câu lệnh neo căn bằng địa chỉ (12 Trần Hưng Đạo), KHÔNG mã tin, không nói 'chỉ có một căn'", /12 Trần Hưng Đạo/.test(cuoi) && !/#BDS-Q5-0001/.test(cuoi) && !/chỉ có một căn/.test(cuoi), cuoi);
  db().insert("info_requests", { listing_id: lst1().id, question: "huong", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "16m nha" });
  check("G3 '16m nha' khi hỏi hướng → KHÔNG ghi hướng, thôi câu hướng (không hỏi lại)",
    !db().t.listing_facts.some((f) => f.question === "huong") && r.body.reask !== "huong" &&
      !db().t.info_requests.some((q) => q.question === "huong" && q.status === "pending"),
    JSON.stringify(r.body));
  db().insert("info_requests", { listing_id: lst1().id, question: "dien_tich_dat", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "Ngang 5" });
  check("G4 'Ngang 5' khi hỏi diện tích → ghi MẶT TIỀN 5m, câu diện tích vẫn treo",
    db().t.listing_facts.some((f) => f.question === "mat_tien" && f.answer === "5m") &&
      !db().t.listing_facts.some((f) => f.question === "dien_tich_dat") &&
      db().t.info_requests.some((q) => q.question === "dien_tich_dat" && q.status === "pending"),
    JSON.stringify(db().t.listing_facts));
  r = await send({ external_user_id: "z-ccrb", text: "5x16" });
  check("G5 '5x16' → khớp diện tích, ghi fact, đóng câu",
    db().t.listing_facts.some((f) => f.question === "dien_tich_dat" && f.answer === "5x16") &&
      db().t.info_requests.every((q) => q.question !== "dien_tich_dat" || q.status === "answered"),
    JSON.stringify(db().t.listing_facts));
  db().insert("info_requests", { listing_id: lst1().id, question: "nam_xay", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "phí bên em sao?" });
  check("G6 chủ nhà hỏi ngược khi đang bị hỏi → không ghi, trả lời câu hỏi (hoi_nguoc), thôi câu năm xây (không hỏi lại)",
    !!r.body.hoi_nguoc && !db().t.listing_facts.some((f) => f.question === "nam_xay") &&
      !db().t.info_requests.some((q) => q.question === "nam_xay" && q.status === "pending"),
    JSON.stringify(r.body));

  fresh();
  r = await send({ external_user_id: "la-20", text: "bán nhà ở trần bình trọng q5" });
  check("G7 chủ MỘT căn: câu lệnh nói không nhắc mã tin; bong bóng nhãn KHÔNG kèm phí",
    createCalls().some((c) => /CẦN HỎI:/.test(prompt(c)) && !/rao nhiều căn/.test(prompt(c))) && !r.body.replies.some((x) => /1%|0,5%/.test(x)),
    JSON.stringify({ replies: r.body.replies, p: prompt(createCalls().at(-1)) }));
}

// ── FR-177: hỏi như môi giới giỏi — bám câu khách, câu lệch vẫn ghi, bản nháp + duyệt ──
{
  fresh();
  const prompt = (c) => c?.params?.messages?.[0]?.content ?? "";
  const pend = (q) => db().t.info_requests.some((x) => x.question === q && x.status === "pending");
  const fact = (q) => db().t.listing_facts.find((f) => f.question === q);
  r = await send({ external_user_id: "h-1", text: "bán nhà hẻm trần bình trọng p4 giá 5 tỷ 8 60m2, không gấp" });
  const H = db().t.listings[0];
  // 20260924c (FR-219): thứ tự "chủ nhà dễ trả lời trước" — đã có vị trí, diện tích, giá → câu đầu là KẾT CẤU.
  check("H1 rao đủ vị trí + diện tích + giá → tin can_chu_duyet, chưa lên kệ, câu đầu là KẾT CẤU (FR-219)",
    H?.can_chu_duyet === true && H?.status === "cho_thong_tin" && pend("ket_cau"), JSON.stringify({ H, ir: db().t.info_requests }));
  check("H1b vị trí cụ thể bóc từ câu rao ('hẻm trần bình trọng') → fact vi_tri + location_raw, KHÔNG hỏi lại vị trí",
    /trần bình trọng/i.test(fact("vi_tri")?.answer ?? "") && /trần bình trọng/i.test(H?.location_raw ?? "") && !pend("vi_tri"), JSON.stringify({ f: db().t.listing_facts, H }));
  r = await send({ external_user_id: "h-1", text: "3 lầu" });
  // FR-241 (chủ dự án 28/09: "sao cứ hỏi phòng ngủ ko z để sau rồi hỏi đi"): nhà phố — phòng ngủ lùi ra sau giá + pháp lý
  // (priority 21); câu kế sau kết cấu là HẺM, không phải phòng ngủ.
  check("H2 trả lời kết cấu → ghi fact, câu kế là HẺM — phòng ngủ để sau (FR-241), không nhảy sang pháp lý",
    fact("ket_cau") && pend("do_rong_hem") && !pend("so_phong_ngu") && !pend("phap_ly"), JSON.stringify(db().t.info_requests));
  check("H2 câu lệnh model: chưa khen gần đây → CHỈ khen khi thật đáng nói (18/09: lâu lâu mới khen), không đọc lại số (24/09)", !/không khen \(mấy tin gần đây/.test(prompt(createCalls().at(-1))) && /không đọc lại số liệu/.test(prompt(createCalls().at(-1))) && !/gộp thêm một ý/.test(prompt(createCalls().at(-1))) && !/KHÔNG khen, KHÔNG nhận xét/.test(prompt(createCalls().at(-1))), prompt(createCalls().at(-1)));
  r = await send({ external_user_id: "h-1", text: "sổ hồng riêng rồi em" });
  // FR-234 (28/09): nói sang ô khác → ghi ô đó, KHÔNG hỏi lại câu đang hỏi (ô không phải ô lõi).
  check("H3 hỏi hẻm, trả lời pháp lý → VẪN GHI phap_ly, câu hẻm thôi, KHÔNG hỏi lại (FR-234)",
    fact("phap_ly")?.answer === "sổ hồng riêng" /* FR-248 a: bỏ tiểu từ "rồi em" */ && !fact("do_rong_hem") && !pend("do_rong_hem") && r.body.reask !== "do_rong_hem",
    JSON.stringify({ body: r.body, f: db().t.listing_facts }));
  r = await send({ external_user_id: "h-1", text: "nhà nở hậu chút" });
  // FR-233 (chủ dự án 27/09: "mấy cái mày ko ghi được vào db thì để AI nó xét qua … chứ mày cứ hỏi nhiều quá"): câu lệch
  // không đọc ra ô nào → ghi nguyên văn, KHÔNG hỏi lại câu phòng ngủ, đi tiếp câu kế.
  check("H4 câu lệch không nhận ra fact nào → ghi nguyên văn vào bo_sung, KHÔNG hỏi lại câu phòng ngủ (FR-233)",
    fact("bo_sung")?.answer === "nhà nở hậu chút" && !pend("so_phong_ngu") && r.body.reask !== "so_phong_ngu",
    JSON.stringify({ body: r.body, f: db().t.listing_facts }));
  r = await send({ external_user_id: "h-1", text: "4 phòng ngủ" });
  // FR-186 (09/09 chiều): nhà phố hỏi thêm TIỀM NĂNG (để ở hay kinh doanh ngành gì) trước khi gửi nháp — chuỗi 07/09 của sếp + chat 21/06.
  // 20260916c: tiềm năng dời sang hỏi bù sau đăng — chat KHÔNG hỏi nữa.
  // FR-225 a (25/09/2026, chủ dự án test Zalo: "nở hậu nhiu cộng vào diện tích nhà luôn"): "nhà nở hậu chút" ở H4 chưa có số mét
  // → câu kế là NỞ HẬU (trước đây bỏ qua, đi thẳng câu hẻm); trả lời xong mới tới hẻm.
  check("H4b nói phòng ngủ → ghi ô phòng ngủ; không hỏi TIỀM NĂNG trong chat (20260916c: hỏi bù sau đăng); câu treo là NỞ HẬU bao nhiêu mét (FR-225, H4 nói 'nở hậu chút')", !!fact("so_phong_ngu") && !pend("tiem_nang") && pend("no_hau"), JSON.stringify({ body: r.body, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  r = await send({ external_user_id: "h-1", text: "nở hậu 5m" });
  // FR-233/234: câu hẻm đã thôi ở lượt nói lệch ("nhà nở hậu chút") — không hỏi lại; còn thiếu thì bản nháp nhắc.
  check("H4c 'nở hậu 5m' → ghi fact nở hậu; hẻm (đã thôi ở lượt lệch) không hỏi lại, bản nháp nhắc thiếu hẻm", /\b5m\b/.test(fact("no_hau")?.answer ?? "") && !pend("no_hau") && (pend("do_rong_hem") || /hẻm rộng/.test(r.body.reply ?? "")), JSON.stringify({ body: r.body, f: fact("no_hau"), ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  // FR-241 (28/09/2026, bắn thật lx-72 / lx-77): giá viết bằng CHỮ vào được ô giá; hỏi địa chỉ mà khách chỉ đáp "xã …"
  // thì đó là phường/xã — không được thành tên đường.
  {
    await send({ external_user_id: "fr241-1", text: "bán nhà Bình Chánh 4x15, 2 lầu, sổ hồng riêng" });
    const l241 = db().t.listings.find((l) => l.id === db().t.info_requests.filter((q) => q.status === "pending").at(-1)?.listing_id);
    const traLoi = { vi_tri: "xã Vĩnh Lộc A", gia: "giá chín tỷ rưỡi" };
    const daHoi = [];
    for (let i = 0; i < 8; i++) {
      const treo = db().t.info_requests.find((q) => q.listing_id === l241?.id && q.status === "pending")?.question;
      if (!treo || daHoi.includes(treo)) break;
      daHoi.push(treo);
      await send({ external_user_id: "fr241-1", text: traLoi[treo] ?? "không rõ em" });
    }
    if (!daHoi.includes("gia")) await send({ external_user_id: "fr241-1", text: "giá chín tỷ rưỡi" });
    const f241 = db().t.listing_facts.filter((f) => f.listing_id === l241?.id);
    check("FR241-E1 'giá chín tỷ rưỡi' → price_vnd 9,5 tỷ",
      l241?.price_vnd === 9_500_000_000, JSON.stringify({ daHoi, gia: l241?.price_vnd, f: f241.map((f) => [f.question, f.answer]) }));
    check("FR241-E2 đang hỏi địa chỉ, khách đáp 'xã Vĩnh Lộc A' → ghi PHƯỜNG, không thành vị trí/tên đường",
      daHoi.includes("vi_tri") && f241.some((f) => f.question === "phuong" && f.answer === "xã Vĩnh Lộc A") && !f241.some((f) => f.question === "vi_tri" && /vĩnh lộc/i.test(f.answer)) && !/vĩnh lộc/i.test(l241?.location_raw ?? ""),
      JSON.stringify({ daHoi, f: f241.map((f) => [f.question, f.answer]), loc: l241?.location_raw }));
  }
  // 25/09/2026: số nhà có xuyệt ("105/12 …") → câu hẻm là XÁC NHẬN "trong hẻm đúng không", không hỏi trống.
  {
    const rHx = await send({ external_user_id: "hx-1", text: "Bán nhà 105/12 Trần Bình Trọng phường 1 quận 5, 4x15, 3 lầu, 4 phòng ngủ, sổ hồng riêng, giá 7 tỷ" });
    const lHx = db().t.listings.find((l) => /105\/12/.test(l.location_raw ?? ""));
    const traLoi = { dien_tich_dat: "60m2", dien_tich: "60m2", ket_cau: "3 lầu", so_phong_ngu: "4 phòng ngủ", phap_ly: "sổ hồng riêng", phuong: "phường 1" };
    let rHx2 = rHx;
    for (let i = 0; i < 5; i++) {
      const treo = db().t.info_requests.find((q) => q.listing_id === lHx?.id && q.status === "pending")?.question;
      if (!treo || treo === "do_rong_hem" || !traLoi[treo]) break;
      rHx2 = await send({ external_user_id: "hx-1", text: traLoi[treo] });
    }
    const pHx = prompt(createCalls().at(-1));
    const hoiHem = db().t.info_requests.some((q) => q.listing_id === lHx?.id && q.question === "do_rong_hem" && q.status === "pending");
    // 30/09/2026: "105/12" là hẻm 105, nhà số 12 (quy ước TP.HCM) → câu hẻm gọi đúng số hẻm.
    check("HX-01 rao '105/12 Trần Bình Trọng' → câu hẻm là xác nhận 'nằm trong hẻm 105 đúng không'",
      hoiHem && /nằm trong hẻm 105 đúng không/.test(`${pHx}\n${rHx2.body.replies.join("\n")}`),
      JSON.stringify({ rep: rHx2.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === lHx?.id).map((q) => [q.question, q.status]), p: pHx.slice(-400) }));
  }
  r = await send({ external_user_id: "h-1", text: "hẻm 4m xe hơi vào tận nhà" });
  r = await quaPhapLy("h-1", r);
  const nhap = r.body.replies.join("\n");
  check("H5 đủ chuyên môn + ≥70 điểm → gửi BẢN NHÁP TIN (tiền định, không model), mở câu chờ duyet_tin, tin CHƯA lên kệ",
    r.body.ban_nhap === true && r.body.diem >= 70 && /Em sẽ rao như vầy/.test(nhap) && /5 tỷ 8/.test(nhap) &&
      // 24/09/2026 (chủ dự án): câu cuối bản nháp = "👉 Có khách quan tâm là <tên trợ lý> báo lại <cách gọi> liền ạ.", đứng SAU CÙNG.
      !/nhắn Zalo cho em/.test(nhap) && /\n👉 Có khách quan tâm là \S*•ai báo lại .+ liền ạ\.$/.test(r.body.replies.find((x) => /Em sẽ rao như vầy/.test(x)) ?? "") && !/#BDS/.test(nhap) && !/\d{3,}\s*\d{3}\s*\d{3}/.test(nhap) && !createCalls().some((c) => /Em sẽ rao như vầy/.test(prompt(c))) &&
      pend("duyet_tin") && H.status === "cho_thong_tin",
    JSON.stringify({ body: r.body, H }));
  r = await send({ external_user_id: "h-1", text: "à giá 6 tỷ nha" });
  check("H6 chủ sửa giá lúc đang duyệt → ghi giá mới, GỬI LẠI bản nháp với giá mới, câu duyệt vẫn treo",
    r.body.sua_nhap === true && H.price_raw && /6 tỷ/.test(H.price_raw) && r.body.replies.some((x) => /6 tỷ/.test(x) && /Em sẽ rao như vầy/.test(x)) && pend("duyet_tin"),
    JSON.stringify({ body: r.body, H }));
  r = await send({ external_user_id: "h-1", text: "phí sao em?" });
  check("H7 hỏi ngược lúc đang duyệt → loại 'hoi', câu duyệt vẫn treo, không đóng dấu",
    r.body.loai_cau === "hoi" && pend("duyet_tin") && !H.chu_duyet_at, JSON.stringify(r.body));
  r = await send({ external_user_id: "h-1", text: "ok đăng đi em" });
  // 11/09: câu `dang_xong` nói "đã được ghi nhận" (bản sửa tay trong bot_prompts,
  // kéo về code ở PR FR-205) — nhận cả cách nói cũ lẫn mới.
  check("H8 chủ GẬT → chu_duyet_at, tin lên kệ (dang_ban), câu duyệt đóng, bong bóng báo đã ghi nhận",
    r.body.duyet === true && !!H.chu_duyet_at && H.status === "dang_ban" && !pend("duyet_tin") && /lên kệ|lên web/.test(r.body.replies[0]),
    JSON.stringify({ body: r.body, H }));
  check("AOND-06 đã nói phí ở lượt 'phí sao em?' → tin lên kệ KHÔNG dẫn phí lần hai", r.body.dan_phi !== true && !/biết phí bên em chưa/.test(r.body.replies.join("\n")), JSON.stringify(r.body.replies));
  // FR-177 f (09/09): chúc mừng kèm ĐIỂM + cách thêm điểm; điểm là tiền định (diem_tin).
  // 22/09/2026 (bộ đo giọng B09, chủ dự án chốt): câu chúc rút còn HAI câu ≤ 30 từ, cách thêm điểm tách bong
  // bóng riêng, bỏ câu hẹn "có thể em sẽ hỏi thêm" — "Chúc mừng" không còn là chữ bắt buộc.
  check("H8e chúc kèm điểm X/100 hai câu ≤ 30 từ + 'có khách … báo'; cách thêm điểm (ảnh) ở bong bóng riêng (22/09)",
    typeof r.body.diem === "number" && new RegExp(`${r.body.diem}/100`).test(r.body.replies[0]) && /[Cc]ó khách quan tâm là em báo/.test(r.body.replies[0]) &&
      r.body.replies[0].split(/\s+/).length <= 30 && r.body.replies.length === 2 && /thêm điểm/.test(r.body.replies[1]) && /ảnh/.test(r.body.replies[1]) && !/khi có khách hàng quan tâm/.test(r.body.replies.join(" ")),
    JSON.stringify(r.body));
  check("H8f sau khi lên kệ, view còn-thiếu vẫn có câu (ảnh, tiềm năng) để cron hỏi bù — chưa có chu_noi_du_at",
    !H.chu_noi_du_at && db().missingFacts().some((m) => m.listing_id === H.id), JSON.stringify(db().missingFacts().filter((m) => m.listing_id === H.id)));
  // FR-177 g: cron hỏi bù (mô phỏng: mở câu ảnh) → chủ nói "đủ rồi" → dừng hỏi, điểm giữ nguyên.
  db().insert("info_requests", { listing_id: H.id, question: "hinh_anh", status: "pending" });
  const diemTruoc = db().diemTin(H).diem;
  r = await send({ external_user_id: "h-1", text: "đủ rồi em, đừng hỏi nữa" });
  check("H10 chủ nói 'đủ rồi' → chu_noi_du_at có, câu treo đóng, bong bóng báo rao với thông tin hiện tại + điểm KHÔNG đổi",
    r.body.du_roi === true && !!H.chu_noi_du_at && !pend("hinh_anh") && db().diemTin(H).diem === diemTruoc && new RegExp(`${diemTruoc}/100`).test(r.body.replies[0]) && !createCalls().some((c) => /đủ rồi em, đừng hỏi nữa/.test(prompt(c))),
    JSON.stringify({ body: r.body, H }));
  // 22/09/2026 (chủ dự án "mục 5 dời đi"): "đủ rồi" KHÔNG còn xin chấm điểm — câu đó dời sang lúc báo bán được (N3b).
  check("H10b 'đủ rồi' → một bong bóng, KHÔNG xin chấm điểm, không mở danh_gia (22/09)",
    !r.body.xin_danh_gia && r.body.replies.length === 1 && !pend("danh_gia"), JSON.stringify(r.body));
  db().insert("info_requests", { listing_id: H.id, question: "danh_gia", status: "pending" });
  r = await send({ external_user_id: "h-1", text: "giống người thật, 8 điểm nha em" });
  check("H10c chủ chấm '8 điểm' → fact danh_gia + boc_tach, cảm ơn tiền định (không model), không hỏi lại điểm",
    fact("danh_gia")?.answer === "giống người thật, 8 điểm nha em" && H.boc_tach?.danh_gia === "giống người thật, 8 điểm nha em" && /8 điểm/.test(r.body.replies[0]) && !pend("danh_gia") && !createCalls().some((c) => /8 điểm nha em/.test(prompt(c))), JSON.stringify({ body: r.body, f: db().t.listing_facts }));
  // Cột gấp + JSON bóc tách ở tin mới (chủ dự án 09/09: cần cột gấp, lưu bóc tách trước).
  r = await send({ external_user_id: "h-2", text: "cần bán gấp nhà 123/4 an dương vương p9 giá 6 tỷ 50m2" });
  const G = db().t.listings.find((x) => x.seller_id === db().t.sellers.find((s) => s.zalo_user_id === "h-2")?.id);
  check("H11b bong bóng ghi nhận có 'cần gấp' và vị trí", /cần gấp/.test(r.body.replies[0] ?? "") && /123\/4 an dương vương/i.test(r.body.replies[0] ?? ""), JSON.stringify(r.body.replies));
  check("H11 câu rao 'cần bán gấp' → listings.gap = true, boc_tach.gap = true, vi_tri '123/4 an dương vương' vào location_raw",
    G?.gap === true && G?.boc_tach?.gap === true && G?.boc_tach?.loai_giao_dich === "ban" && /123\/4 an dương vương/i.test(G?.location_raw ?? ""), JSON.stringify({ G, f: db().t.listing_facts.filter((f) => f.listing_id === G?.id) }));
  r = await send({ external_user_id: "h-3", text: "bán nhà p5 giá 4 tỷ 40m2, không gấp" });
  const K = db().t.listings.find((x) => x.seller_id === db().t.sellers.find((s) => s.zalo_user_id === "h-3")?.id);
  check("H12 'không gấp' → gap = false (câu rao không nhắc → null, xem V1.3)", K?.gap === false, JSON.stringify(K));
  // FR-178: suốt luồng người bán, KHÔNG bong bóng nào đọc mã tin; câu mẫu là câu
  // người nói (không "kết cấu (số tầng, phòng)"); system prompt có few-shot người bán.
  const botMsgs = db().t.messages.filter((m) => m.sender === "bot").map((m) => m.body);
  check("H8b không bong bóng nào gửi chủ nhà chứa mã tin #BDS", botMsgs.length > 0 && !botMsgs.some((b) => /#BDS/.test(b)), JSON.stringify(botMsgs));
  check("H8c câu mẫu hỏi tiếp là câu người nói, không đọc tên trường", !botMsgs.some((b) => /kết cấu \(số tầng/.test(b)) && botMsgs.some((b) => /mấy tầng|phòng ngủ|sổ hồng/.test(b)), JSON.stringify(botMsgs));
  check("H8d system prompt người bán có few-shot (giọng đúng/sai)", createCalls().some((c) => /Ví dụ giọng ĐÚNG/.test(c.params.system[0].text) && /Ví dụ giọng SAI/.test(c.params.system[0].text)));
  // FR-180: mẫu chuẩn thật (mau_cau_fewshot) đi vào system prompt người bán, sau few-shot soạn tay.
  check("H8g system prompt người bán có MẪU CHUẨN thật từ mau_cau (FR-180)", createCalls().some((c) => /Ví dụ CHUẨN do anh\/sếp sửa tay/.test(c.params.system[0].text) && /Hẻm 4m ô tô tới cửa thì khách chuộng lắm anh/.test(c.params.system[0].text)), createCalls().at(-1)?.params.system[0].text.slice(-400));
  // CHẾ ĐỘ TEST 20260909b: "hello" xoá sạch dữ liệu của h-1 (tin H + hội thoại + người bán), tiếp đón như khách mới.
  const sellerH1 = db().t.sellers.find((s) => s.zalo_user_id === "h-1");
  const nTruoc = { l: db().t.listings.filter((l) => l.seller_id === sellerH1?.id).length, f: db().t.listing_facts.filter((f) => f.listing_id === H.id).length };
  r = await send({ external_user_id: "h-1", text: "hello" });
  check("T1 'hello' (công tắc bật) → xoá tin H, fact, hội thoại, người bán h-1; báo (TEST) đã xoá; tiếp như khách mới",
    nTruoc.l === 1 && nTruoc.f > 0 && !db().t.listings.some((l) => l.id === H.id) && !db().t.listing_facts.some((f) => f.listing_id === H.id) &&
      !db().t.sellers.some((s) => s.zalo_user_id === "h-1") && /\(TEST\) Em đã xoá/.test(r.body.replies?.[0] ?? "") && /1 tin/.test(r.body.replies?.[0] ?? "") && r.body.role !== "seller",
    JSON.stringify({ nTruoc, body: r.body, sellers: db().t.sellers.map((s) => s.zalo_user_id) }));
  check("T1b các người khác (h-2, h-3) KHÔNG bị đụng", db().t.sellers.some((s) => s.zalo_user_id === "h-2") && db().t.listings.some((l) => l.id === G?.id), JSON.stringify(db().t.sellers.map((s) => s.zalo_user_id)));
  globalThis.__cauHinh = { test_reset_hello: "0" };
  r = await send({ external_user_id: "h-2", text: "hello" });
  check("T2 công tắc TẮT → 'hello' không xoá gì, không có câu (TEST)", db().t.sellers.some((s) => s.zalo_user_id === "h-2") && db().t.listings.some((l) => l.id === G?.id) && !(r.body.replies ?? []).some((x) => /\(TEST\)/.test(x)), JSON.stringify(r.body));
  globalThis.__cauHinh = undefined;
  // Tin KHÔNG từ chat (Excel/admin): luật cũ, không cần duyệt.
  fresh(seedKho);
  const L2 = db().t.listings[1];
  db().insert("info_requests", { listing_id: L2.id, question: "do_rong_hem", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "#BDS-Q5-0002 hẻm 3m" });
  check("H9 tin nhập tay (can_chu_duyet=false) đủ giá+dt+phường → lên kệ theo luật cũ, không đòi duyệt",
    L2.status === "dang_ban" && !pend("duyet_tin"), JSON.stringify({ L2, body: r.body }));
}

// ── CHỐT 09/09 chiều (chat Gemini 21/06): FR-181 tên trợ lý · FR-184 bán rồi · FR-185 ảnh kho · FR-186 hướng chung cư · FR-183 điểm người rao ──
{
  const pend = (q, lid) => db().t.info_requests.some((x) => x.question === q && x.status === "pending" && (!lid || x.listing_id === lid));
  // FR-181: người bán lượt đầu → cột sellers.ten_tro_ly; system prompt nhánh bán xưng đúng tên đó, không còn "Thái".
  fresh(seedKho);
  r = await send({ external_user_id: "z-ccrb", text: "có khách nào hỏi chưa em" });
  const sC = db().t.sellers.find((s) => s.zalo_user_id === "z-ccrb");
  // 14/09/2026: khối system NHỚ TẠM không mang tên riêng (mọi khách chung một bản nhớ
  // tạm); tên thật đi ở khối thứ hai, không nhớ tạm.
  check("N1 người bán lượt đầu → sellers.ten_tro_ly = tên băm từ Zalo ID; khối nhớ tạm dùng «tên em», khối sau nói đúng tên; không 'Thái', không '{ten}'",
    sC?.ten_tro_ly === tenTroLy("z-ccrb") &&
      createCalls().some((c) => c.params.system[0].text.includes('Bạn là "«tên em»"') && !!c.params.system[0].cache_control &&
        (c.params.system[1]?.text ?? "").includes(`"${tenTroLy("z-ccrb")}"`) && !c.params.system[1]?.cache_control) &&
      !createCalls().some((c) => /Thái|\{ten\}/.test(c.params.system.map((x) => x.text).join("\n"))),
    JSON.stringify({ ten: sC?.ten_tro_ly, sys: createCalls().at(-1)?.params.system.map((x) => x.text.slice(0, 120)) }));
  r = await send({ external_user_id: "z-ccrb", text: "ok em" });
  check("N1b lượt sau KHÔNG update ten_tro_ly nữa (đã có)", db().log.filter((l) => l.table === "sellers" && l.op === "update" && l.payload?.ten_tro_ly).length === 1);
  // FR-181: khách mua → preferences.ten_tro_ly qua merge_buyer_prefs (không thêm vòng DB).
  fresh();
  await send({ external_user_id: "m-1", text: "chào em" });
  r = await send({ external_user_id: "m-1", text: "tôi muốn mua nhà phường 4 tầm 5 tỷ" });
  check("N2 khách mua → buyers.preferences.ten_tro_ly = tên băm; khối sau (không nhớ tạm) nói đúng tên, khối nhớ tạm dùng «tên em»",
    db().t.buyers[0]?.preferences?.ten_tro_ly === tenTroLy("m-1") &&
      parseCalls().some((c) => c.params.system[0].text.includes('Bạn là "«tên em»"') && c.params.system[1].text.includes(`"${tenTroLy("m-1")}"`)),
    JSON.stringify(db().t.buyers[0]?.preferences));
  {
    // Hai khách KHÁC tên trợ lý → khối system nhớ tạm phải GIỐNG HỆT (không thì mỗi khách một ô nhớ tạm, không bao giờ trúng).
    const n0 = parseCalls().length;
    await send({ external_user_id: "m-khac-ten-9", text: "tìm nhà quận 5 tầm 6 tỷ" });
    const moi = parseCalls().slice(n0)[0];
    const cu = parseCalls().find((c) => c.params.system[1].text.includes(`"${tenTroLy("m-1")}"`));
    globalThis.__model.parse = () => OUT({ replies: ["Dạ em là «tên em» bên AI Ơi Nhà Đất ạ."] });
    const rTen = await send({ external_user_id: "m-khac-ten-9", text: "em tên gì" });
    check("NHOTAM-02 model chép nguyên «tên em» → khách nhận tên thật",
      rTen.body.replies.some((x) => x.includes(`em là ${tenTroLy("m-khac-ten-9")} bên`)) && !JSON.stringify(rTen.body.replies).includes("«tên em»"),
      JSON.stringify(rTen.body.replies));
    globalThis.__model.parse = () => OUT();
    check("NHOTAM-01 hai khách khác tên trợ lý → khối system nhớ tạm giống hệt từng chữ",
      tenTroLy("m-khac-ten-9") !== tenTroLy("m-1") && !!moi && !!cu && moi.params.system[0].text === cu.params.system[0].text &&
        moi.params.system[1].text.includes(`"${tenTroLy("m-khac-ten-9")}"`),
      JSON.stringify({ t1: tenTroLy("m-1"), t2: tenTroLy("m-khac-ten-9"), giong: moi?.params.system[0].text === cu?.params.system[0].text }));
  }

  // FR-184: một căn đang rao, chủ báo "bán rồi" → da_chot, câu treo đóng, nhắc huỷ, boc_tach.ket_thuc, không gọi model.
  fresh(seedKho);
  const sN = db().t.sellers.find((s) => s.zalo_user_id === "z-nmg");
  const tinN = db().t.listings.find((l) => l.seller_id === sN.id);
  db().insert("info_requests", { listing_id: tinN.id, question: "hinh_anh", status: "pending" });
  db().insert("reminders", { kind: "escalation", seller_id: sN.id, listing_id: tinN.id, due_at: new Date().toISOString(), note: "💬 hỏi bù" });
  r = await send({ external_user_id: "z-nmg", text: "căn đó anh bán được rồi nhé em" });
  check("N3 một căn, 'bán được rồi' → status da_chot, câu treo expired, nhắc cancelled, boc_tach.ket_thuc=ban_roi, bong bóng chúc mừng + gỡ tin, 0 lượt model",
    tinN.status === "da_chot" && !pend("hinh_anh", tinN.id) && db().t.reminders.every((x) => x.listing_id !== tinN.id || x.status === "cancelled") && tinN.boc_tach?.ket_thuc === "ban_roi" &&
      r.body.ngung_rao === "ban_roi" && /chúc mừng/i.test(r.body.replies[0]) && /gỡ tin/.test(r.body.replies[0]) && createCalls().length === 0,
    JSON.stringify({ st: tinN.status, body: r.body, rem: db().t.reminders }));
  check("N3b bán được là SỰ KIỆN THẬT → bong bóng thứ hai xin chấm điểm (người thật? mấy điểm?), mở danh_gia (22/09, dời từ 'đủ rồi')",
    r.body.xin_danh_gia === true && r.body.replies.length === 2 && /người thật/.test(r.body.replies[1]) && /mấy điểm/.test(r.body.replies[1]) && pend("danh_gia", tinN.id),
    JSON.stringify(r.body.replies));
  // FR-184: nhiều căn → hỏi căn nào; trả lời số thứ tự → đóng đúng căn; "ngưng bán" → an.
  fresh(seedKho);
  const sCc = db().t.sellers.find((s) => s.zalo_user_id === "z-ccrb");
  const cansC = db().t.listings.filter((l) => l.seller_id === sCc.id && ["cho_thong_tin", "dang_ban", "dang_quan_tam"].includes(l.status));
  r = await send({ external_user_id: "z-ccrb", text: "không bán nữa em, rút tin" });
  check("N4 nhiều căn đang rao, 'không bán nữa' → liệt kê căn, mở câu chờ ngung_rao_can_nao (answer=rut), chưa đổi trạng thái căn nào",
    r.body.hoi_can === cansC.length && /căn nào/.test(r.body.replies[0]) && /1\. /.test(r.body.replies[0]) && db().t.info_requests.some((q) => q.question === "ngung_rao_can_nao" && q.status === "pending" && q.answer === "rut") && cansC.every((l) => l.status !== "an"),
    JSON.stringify({ body: r.body, ir: db().t.info_requests }));
  r = await send({ external_user_id: "z-ccrb", text: "căn nguyễn trãi" });
  const canNT = db().t.listings.find((l) => /Nguyễn Trãi/.test(l.location_raw ?? ""));
  check("N4b trả lời 'căn nguyễn trãi' → đúng căn đó sang 'an', cău chọn đóng, các căn khác giữ nguyên",
    canNT?.status === "an" && canNT?.boc_tach?.ket_thuc === "rut" && !pend("ngung_rao_can_nao") && db().t.listings.filter((l) => l.seller_id === sCc.id && l.status === "dang_ban").length === 1,
    JSON.stringify({ canNT, ls: db().t.listings.map((l) => [l.location_raw, l.status]) }));
  fresh(seedKho);
  r = await send({ external_user_id: "z-ccrb", text: "bán rồi hả em?" });
  check("N5 câu HỎI 'bán rồi hả em?' không phải báo bán → không đổi trạng thái, đi nhánh chăm sóc", !r.body.ngung_rao && db().t.listings.every((l) => l.status !== "da_chot"), JSON.stringify(r.body));
  // Đang duyệt bản nháp mà nói "chốt đi" → GẬT, không phải báo bán.
  fresh();
  r = await send({ external_user_id: "h-9", text: "bán nhà hẻm trần bình trọng p4 giá 5 tỷ 8 60m2, không gấp" });
  const H9 = db().t.listings[0];
  // FR-241 l: nhà phố hỏi pháp lý TRƯỚC phòng ngủ (phòng ngủ dải 16–21, sau pháp lý).
  for (const t of ["hẻm 4m xe hơi", "3 lầu", "sổ hồng riêng hoàn công đủ"]) r = await send({ external_user_id: "h-9", text: t });
  r = await quaPhapLy("h-9", r);
  if (db().t.info_requests.some((q) => q.listing_id === H9.id && q.question === "so_phong_ngu" && q.status === "pending")) r = await send({ external_user_id: "h-9", text: "4 phòng ngủ" });
  // 20260916c: tiềm năng không còn trong chat → sau pháp lý (gấp đã nói lúc rao) là bản nháp ngay.
  check("N6 chuỗi nhà phố: hẻm → lầu → pháp lý → phòng (FR-241) → bản nháp (tiềm năng để hỏi bù, 20260916c)", pend("duyet_tin", H9.id) && !pend("tiem_nang", H9.id), JSON.stringify(db().t.info_requests.map((q) => [q.question, q.status])));
  r = await send({ external_user_id: "h-9", text: "ở hoặc làm văn phòng đều được" });
  check("N6b nói tiềm năng lúc đang duyệt → ghi fact, gửi lại bản nháp, duyet_tin vẫn treo", db().t.listing_facts.some((f) => f.listing_id === H9.id && f.question === "tiem_nang") && pend("duyet_tin", H9.id), JSON.stringify(r.body));
  r = await send({ external_user_id: "h-9", text: "chốt đi em" });
  check("N6c 'chốt đi' lúc duyệt = GẬT (không phải báo bán rồi) → lên kệ", r.body.duyet === true && H9.status === "dang_ban" && !r.body.ngung_rao, JSON.stringify(r.body));

  // FR-186: chung cư hỏi HƯỚNG ban công (câu riêng), nhà phố thì không.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-cc", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0101", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "chung_cu", gap: false, location_raw: "Sunrise City", ward: "Phường 4", price_raw: "3 tỷ", price_vnd: 3e9, area_m2: 70, floor: 12, can_chu_duyet: true }).data;
    d.insert("info_requests", { listing_id: l.id, question: "so_phong_ngu", status: "pending" });
  });
  r = await send({ external_user_id: "z-cc", text: "2 phòng ngủ" });
  check("N7 chung cư trả lời phòng ngủ → câu kế là HƯỚNG (ban công), câu gợi ý riêng cho chung cư", pend("huong") && createCalls().some((c) => /CẦN HỎI: [^\n]*hướng/i.test(c.params.messages[0].content)), JSON.stringify({ ir: db().t.info_requests, p: createCalls().at(-1)?.params.messages[0].content.slice(-300) }));
  fresh();
  r = await send({ external_user_id: "h-10", text: "bán nhà hẻm trần bình trọng p4 giá 5 tỷ 8 60m2, không gấp" });
  check("N7b nhà phố: view thiếu KHÔNG có hướng (nhóm phụ)", !db().missingFacts().some((m) => m.fact_key === "huong"), JSON.stringify(db().missingFacts()));
  // FR-186: cho thuê → hỏi cọc / thời hạn / trượt giá sau pháp lý.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-thue", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0102", seller_id: s.id, deal: "cho_thue", status: "cho_thong_tin", property_type: "nha_pho", gap: false, location_raw: "12 Trần Hưng Đạo", ward: "Phường 4", price_raw: "15tr/tháng", price_vnd: 15e6, area_m2: 50, floors: 2, bedrooms: 2, alley_width_m: 4, can_chu_duyet: true }).data;
    d.insert("listing_facts", { listing_id: l.id, question: "tiem_nang", answer: "ở", source: "seller_chat" });
    d.insert("listing_facts", { listing_id: l.id, question: "noi_that", answer: "full", source: "seller_chat" });
    d.insert("info_requests", { listing_id: l.id, question: "phap_ly", status: "pending" });
  });
  r = await send({ external_user_id: "z-thue", text: "sổ hồng riêng" });
  check("N8 tin CHO THUÊ: sau pháp lý hỏi TIỀN CỌC (fact chỉ có với deal cho_thue)", pend("tien_coc"), JSON.stringify(db().t.info_requests.map((q) => [q.question, q.status])));
  r = await send({ external_user_id: "z-thue", text: "cọc 2 tháng" });
  check("N8b 'cọc 2 tháng' khớp câu cọc → ghi fact, hỏi thời hạn thuê", db().t.listing_facts.some((f) => f.question === "tien_coc") && pend("thoi_han_thue"), JSON.stringify(db().t.info_requests.map((q) => [q.question, q.status])));

  // 20260909i: loại mới KHO XƯỞNG — đoán loại từ câu rao, câu hỏi chuyên môn riêng (chiều cao thông thủy).
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-kho", seller_type: "nmg", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0104", seller_id: s.id, deal: "cho_thue", status: "cho_thong_tin", property_type: "kho_xuong", gap: false, location_raw: "KCN Tân Tạo", ward: "Tân Tạo", price_raw: "80tr/tháng", price_vnd: 80e6, area_m2: 1000, can_chu_duyet: true }).data;
    d.insert("info_requests", { listing_id: l.id, question: "chieu_cao", status: "pending" });
  });
  r = await send({ external_user_id: "z-kho", text: "xưởng cao thông thủy 9m" });
  check("N13 kho xưởng: 'cao thông thủy 9m' khớp câu chiều cao → ghi fact, hỏi tải trọng sàn", db().t.listing_facts.some((f) => f.question === "chieu_cao") && pend("tai_trong_san"), JSON.stringify(db().t.info_requests.map((q) => [q.question, q.status])));
  r = await send({ external_user_id: "z-kho", text: "sàn chịu 2 tấn" });
  check("N13b tải trọng sàn khớp (câu số) → ghi fact, câu kế là đường container (FR-219: vật lý dễ trước)", db().t.listing_facts.some((f) => f.question === "tai_trong_san") && pend("duong_container"), JSON.stringify({ f: db().t.listing_facts.map((f) => [f.question, f.answer]), ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  // 20260909i: nhóm sau_dang (WC, hẻm thông, thế chấp…) có trong view thiếu nhưng KHÔNG được hỏi trước bản nháp.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-sd", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0105", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "7 An Dương Vương", ward: "Phường 8", price_raw: "7 tỷ", price_vnd: 7e9, area_m2: 60, floors: 3, bedrooms: 3, alley_width_m: 5, legal_status: "so_hong_rieng", can_chu_duyet: true }).data;
    d.insert("listing_facts", { listing_id: l.id, question: "hinh_anh", answer: "https://x/1.jpg", source: "seller_chat" });
    d.insert("info_requests", { listing_id: l.id, question: "tiem_nang", status: "pending" });
  });
  r = await send({ external_user_id: "z-sd", text: "hợp để ở" });
  check("N14 đủ co_ban + chuyen_mon → view vẫn còn so_wc/hem_thong (sau_dang) nhưng bot KHÔNG hỏi, đi thẳng bản nháp", db().missingFacts().some((m) => m.nhom === "sau_dang") && !db().t.info_requests.some((q) => q.status === "pending" && ["so_wc", "cach_mat_tien", "hem_thong", "ngap_nuoc", "the_chap", "ly_do_ban", "thuong_luong", "hien_trang_su_dung", "tien_ich_gan"].includes(q.question)), JSON.stringify({ ir: db().t.info_requests.map((q) => [q.question, q.status]), thieu: db().missingFacts().map((m) => m.fact_key) }));

  // 09/09 tối lần 2: câu "địa chỉ" treo mãi → né 2 lần thì bỏ qua, đi câu kế; "đăng đi" giữa vòng → bản nháp.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-ne", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0106", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", ward: "Phường 5", price_raw: "7 tỷ", price_vnd: 7e9, can_chu_duyet: true }).data;
    d.insert("info_requests", { listing_id: l.id, question: "vi_tri", status: "pending", created_at: "2026-09-09T00:00:00Z" });
  });
  r = await send({ external_user_id: "z-ne", text: "hẻm 4m xe hơi" });
  // SRS-5.1s: một câu chỉ hỏi MỘT lần — né lần 1 là thôi luôn (trước: hỏi lại một lần, né lần hai mới thôi).
  check("N15 né lần 1: ghi do_rong_hem, câu địa chỉ THÔI ngay (expired), không hỏi lại", db().t.listing_facts.some((f) => f.question === "do_rong_hem") && !pend("vi_tri") && db().t.info_requests.some((q) => q.question === "vi_tri" && q.status === "expired"), JSON.stringify(db().t.info_requests.map((q) => [q.question, q.status])));
  r = await send({ external_user_id: "z-ne", text: "3 lầu 4 phòng ngủ" });
  check("N15b né lần 2: câu địa chỉ hết hạn (expired), ghi ket_cau + so_phong_ngu, hỏi câu KẾ chứ không hỏi địa chỉ nữa",
    !pend("vi_tri") && db().t.info_requests.some((q) => q.question === "vi_tri" && q.status === "expired") && db().t.listing_facts.some((f) => f.question === "ket_cau") && db().t.listing_facts.some((f) => f.question === "so_phong_ngu") && db().t.info_requests.some((q) => q.status === "pending" && q.question !== "vi_tri"),
    JSON.stringify({ ir: db().t.info_requests.map((q) => [q.question, q.status]), f: db().t.listing_facts.map((f) => f.question) }));
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-dang", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0107", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "9 Hồng Bàng", ward: "Phường 12", price_raw: "8 tỷ", price_vnd: 8e9, area_m2: 60, floors: 3, bedrooms: 3, alley_width_m: 5, legal_status: "so_hong_rieng", can_chu_duyet: true }).data;
    d.insert("listing_facts", { listing_id: l.id, question: "hinh_anh", answer: "https://x/1.jpg", source: "seller_chat" });
    d.insert("info_requests", { listing_id: l.id, question: "tiem_nang", status: "pending" });
  });
  r = await send({ external_user_id: "z-dang", text: "đăng đi em" });
  // 24/09/2026 (chủ dự án: "nếu khách nói kiểu đăng đi thì ko hỏi nữa đưa tin luôn"): đủ điểm → LÊN KỆ ngay, không hỏi duyệt.
  check("N16 'đăng đi' khi đang treo câu thông số + tin ≥70 → LÊN KỆ ngay (không hỏi 'ổn chưa', không mở câu duyệt), câu treo hết hạn, không ghi 'đăng đi' làm fact",
    r.body.dang_luon === true && db().t.listings.find((l) => l.code === "BDS-Q5-0107")?.status === "dang_ban" && !pend("duyet_tin") &&
      !r.body.replies.some((x) => /ổn chưa|xem vậy được chưa/.test(x)) && r.body.replies.some((x) => /lên kệ/.test(x)) &&
      !db().t.listing_facts.some((f) => /đăng đi/.test(f.answer)) && db().t.info_requests.some((q) => q.question === "tiem_nang" && q.status === "expired"),
    JSON.stringify({ body: r.body.replies, ir: db().t.info_requests.map((q) => [q.question, q.status]), f: db().t.listing_facts.map((f) => [f.question, f.answer]) }));

  // 09/09 tối lần 4: "đất thuê nhà nước tới 2058" của NGƯỜI BÁN không phải ý định đi thuê.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-thue-dat", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0108", seller_id: s.id, deal: "cho_thue", status: "cho_thong_tin", property_type: "kho_xuong", location_raw: "KCN Tân Tạo", ward: "Tân Tạo", price_raw: "80tr/tháng", price_vnd: 80e6, area_m2: 1000, can_chu_duyet: true }).data;
    d.insert("info_requests", { listing_id: l.id, question: "phap_ly", status: "pending" });
  });
  r = await send({ external_user_id: "z-thue-dat", text: "sổ đỏ, đất thuê nhà nước tới 2058" });
  check("N17 'đất thuê nhà nước' là lời người bán → vẫn nhánh bán, ghi phap_ly + thoi_han_su_dung, không hỏi 'muốn mua hay thuê'", r.body.role === "seller" && db().t.listing_facts.some((f) => f.question === "phap_ly") && db().t.listing_facts.some((f) => f.question === "thoi_han_su_dung" || f.question === "hinh_thuc_thue_dat"), JSON.stringify({ role: r.body.role, f: db().t.listing_facts.map((f) => [f.question, f.answer]), replies: r.body.replies }));

  // FR-188 (10/09): GẤP — hỏi ngay sau giá; "không gấp, được giá thì thôi" → gap=false rồi hỏi hẻm; bắt gấp ở mọi lượt.
  fresh();
  r = await send({ external_user_id: "g-1", text: "bán nhà hẻm trần bình trọng p4 giá 6 tỷ 50m2" });
  // 20260916c: gấp lùi sau pháp lý — câu đầu là HẺM, gấp vẫn bắt ở mọi lượt.
  check("N18 rao có giá, chưa nói gấp → câu ĐẦU là kết cấu (FR-219), gấp ở cuối", pend("ket_cau") && !pend("gap"), JSON.stringify(db().t.info_requests.map((q) => [q.question, q.status])));
  r = await send({ external_user_id: "g-1", text: "không gấp, được giá thì thôi" });
  check("N18b 'không gấp, được giá thì thôi' → listings.gap = false, câu kết cấu thôi (FR-234 không hỏi lại), đi tiếp câu kế", db().t.listings[0].gap === false && !pend("ket_cau") && db().t.info_requests.some((q) => q.status === "pending"), JSON.stringify({ gap: db().t.listings[0].gap, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  r = await send({ external_user_id: "g-1", text: "hẻm 4m, mà thôi anh cần bán gấp, cần tiền" });
  check("N18c giữa chừng nói 'cần bán gấp' → gap lật thành true (bắt ở mọi lượt), hẻm vẫn ghi", db().t.listings[0].gap === true && db().t.listing_facts.some((f) => f.question === "do_rong_hem"), JSON.stringify({ gap: db().t.listings[0].gap, f: db().t.listing_facts.map((f) => [f.question, f.answer]) }));
  // FR-188: người MUA "cần tìm gấp" → cờ gấp trong hồ sơ.
  fresh(seedKho);
  r = await send({ external_user_id: "b-gap", text: "tôi cần tìm gấp nhà quận 5 tầm 5 tỷ" });
  check("N19 người mua 'cần tìm gấp' → buyers.preferences.gap = true", db().t.buyers.some((b) => b.zalo_user_id === "b-gap" && b.preferences?.gap === true), JSON.stringify(db().t.buyers.map((b) => [b.zalo_user_id, b.preferences])));
  // FR-189: người nội bộ "#mã giữ" → bot im với chủ căn; "#mã trả bot" → bot nói lại.
  fresh((d) => {
    seedKho(d);
    d.insert("admins", { email: "boss@x", zalo_user_id: "z-boss" });
  });
  r = await send({ external_user_id: "z-boss", text: "#BDS-Q5-0001 giữ" });
  check("N20 admin '#mã giữ' → conversations.human_hold = true cho chủ căn", /im với chủ căn/.test(r.body.reply ?? "") && db().t.conversations.some((c) => c.seller_id === db().t.sellers.find((s) => s.zalo_user_id === "z-ccrb").id && c.human_hold === true), JSON.stringify({ body: r.body, c: db().t.conversations }));
  r = await send({ external_user_id: "z-ccrb", text: "hẻm 4m xe hơi" });
  check("N20b chủ căn nhắn khi đang bị giữ → bot IM (replies rỗng, human_active)", r.body.replies.length === 0 && r.body.human_active === true, JSON.stringify(r.body));
  r = await send({ external_user_id: "z-boss", text: "#BDS-Q5-0001 trả bot" });
  check("N20c '#mã trả bot' → human_hold = false", db().t.conversations.every((c) => !c.human_hold), JSON.stringify(db().t.conversations));
  // 10/09: người bán quen "Còn căn nữa: …" → TIN THỨ HAI, không phải lời sửa tin cũ.
  fresh(seedKho);
  r = await send({ external_user_id: "z-ccrb", text: "Còn căn nữa: 7 Hồng Bàng phường 12 quận 5, 60m2, 9 tỷ, mặt tiền" });
  check("N21 'Còn căn nữa: 7 Hồng Bàng …' từ người bán quen → tạo tin MỚI (mã mới), phường 12, 9 tỷ", db().t.listings.length === 6 && db().t.listings.some((l) => l.ward === "Phường 12" && /9 tỷ/.test(l.price_raw ?? "") && l.seller_id === db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb").id && l.code === "BDS-Q5-0006"), JSON.stringify(db().t.listings.map((l) => [l.code, l.ward, l.price_raw])));

  // FR-177 n (10/09): câu rao DÀI đủ mọi thứ → bóc hết ngay lúc tạo, gấp vào cột, không hỏi lại thứ đã nói.
  fresh();
  r = await send({ external_user_id: "dai-1", text: "Bán nhà hẻm 8m Nguyễn Trãi phường 8 quận 5, 4x16 = 64m2 sổ riêng hoàn công, 1 trệt 3 lầu 4 phòng ngủ 3 wc, hướng Đông, nhà mới xây 2022, full nội thất, giá 9 tỷ 5 còn thương lượng, cần bán gấp vì đi định cư, cách mặt tiền 30m hẻm thông không ngập" });
  {
    const L = db().t.listings[0]; const F = new Set(db().t.listing_facts.map((f) => f.question));
    check("N22 rao dài → ≥10 fact bóc ngay (hướng, pháp lý, WC, nội thất, năm xây, hẻm thông, ngập, cách mặt tiền, lý do bán, thương lượng), gap=true, không hỏi lại thứ đã nói",
      L?.gap === true && ["huong", "phap_ly", "so_wc", "noi_that", "nam_xay", "hem_thong", "ngap_nuoc", "cach_mat_tien", "ly_do_ban", "thuong_luong"].every((k) => F.has(k)) &&
        !db().t.info_requests.some((q) => q.status === "pending" && ["huong", "phap_ly", "gap", "so_phong_ngu", "gia"].includes(q.question)),
      JSON.stringify({ gap: L?.gap, f: [...F], ir: db().t.info_requests.map((q) => q.question) }));
  }
  // 10/09 chân dung đại diện CĐT: một tin nhiều căn → mỗi căn một tin riêng, kế thừa dự án/quận.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-cdt", seller_type: "nmg", name: null, active_listing_id: null }).data;
    const p = d.insert("projects", { name: "Ny'ah Phú Định", slug: "nyah-phu-dinh", district: "Quận 8", ward: "Phường 16", amenities: [], description: "Khu biệt lập 50 căn" }).data;
    d.insert("listings", { code: "BDS-Q8-0001", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", district: "Quận 8", ward: "Phường 16", project_id: p.id, price_raw: "18 tỷ", price_vnd: 18e9, can_chu_duyet: true, gap: false });
  });
  r = await send({ external_user_id: "z-cdt", text: "căn A5 8x20 giá 18 tỷ, căn A7 8x20 giá 18 tỷ 5, căn B2 góc 10x20 giá 22 tỷ" });
  check("N23 'căn A5 …, căn A7 …, căn B2 …' → 3 tin mới có unit_code, ngang×dài, giá riêng, cùng dự án Quận 8; hỏi MỘT câu chung cho lô",
    db().t.listings.filter((l) => l.unit_code).length === 3 && db().t.listings.some((l) => l.unit_code === "B2" && l.frontage_m === 10 && /22 tỷ/.test(l.price_raw)) && db().t.listings.filter((l) => l.unit_code).every((l) => l.district === "Quận 8") && r.body.nhieu_can === 3 && r.body.replies.some((x) => /Em mở 3 tin/.test(x)),
    JSON.stringify({ body: r.body, l: db().t.listings.map((l) => [l.code, l.unit_code, l.frontage_m, l.price_raw, l.district]) }));
  // 15/09/2026 (bắn thật N2): "căn 2 …, căn 1 …" chỉ mang FACT → không mở tin, ghi đúng căn theo thứ tự mở.
  {
    const soTinTruoc = db().t.listings.length;
    const theoThuTu = [...db().t.listings].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    r = await send({ external_user_id: "z-cdt", text: "căn 2 sổ hồng riêng, có thương lượng. căn 1 đúc 3 tấm" });
    const factCua = (l) => db().t.listing_facts.filter((f) => f.listing_id === l.id).map((f) => f.question);
    check("N23b fact theo số thứ tự căn → không mở tin mới, căn 2 nhận phap_ly + thuong_luong, căn 1 nhận ket_cau",
      db().t.listings.length === soTinTruoc && !r.body.nhieu_can && factCua(theoThuTu[1]).includes("phap_ly") && factCua(theoThuTu[1]).includes("thuong_luong") && factCua(theoThuTu[0]).includes("ket_cau") && r.body.fact_theo_can >= 3,
      JSON.stringify({ body: r.body, so: [soTinTruoc, db().t.listings.length], f: db().t.listing_facts.map((f) => [f.listing_id.slice(0, 4), f.question, f.answer]), tt: theoThuTu.map((l) => l.id.slice(0, 4)) }));
    // 15/09 (bắn thật C2): "căn 2 đang cho thuê 80 triệu/tháng" có "cho thuê" + tiền (cổng rao khớp) vẫn là fact theo căn, không phải giá.
    r = await send({ external_user_id: "z-cdt", text: "căn 1 sổ hồng riêng hoàn công đủ, căn 2 đang cho thuê 80 triệu/tháng" });
    check("N23c 'căn 2 đang cho thuê 80 triệu/tháng' → hiện trạng vào căn 2, KHÔNG có fact giá 80 triệu, không mở tin",
      db().t.listings.length === soTinTruoc && (factCua(theoThuTu[1]).includes("doanh_thu") || factCua(theoThuTu[1]).includes("hien_trang_su_dung")) && !db().t.listing_facts.some((f) => f.question === "gia" && /80/.test(f.answer)) && r.body.fact_theo_can >= 2,
      JSON.stringify({ body: r.body, f: db().t.listing_facts.map((f) => [f.listing_id.slice(0, 4), f.question, f.answer]) }));
  }
  // 15/09/2026 (bắn thật P1): câu rao kèm "bên em là bot hả?" → trả lời thật trước câu hỏi đầu.
  fresh();
  r = await send({ external_user_id: "la-bot", text: "tôi muốn bán căn nhà ở phường 2 quận 5, mà bên em là bot hả?" });
  check("RAO-HOI-01 câu rao kèm hỏi 'bot hả' → tạo tin + bong bóng nói thật là trợ lý AI",
    db().t.listings.length === 1 && r.body.replies.some((x) => /trợ lý AI/.test(x)), JSON.stringify(r.body.replies));
  // 23/09/2026 (bắn thật 10 câu): câu hỏi phí đứng TRƯỚC, ngăn bằng "?" → bot bỏ qua, chỉ hỏi phường.
  fresh();
  r = await send({ external_user_id: "hoi-phi", text: "bên em lấy phí bao nhiêu vậy? anh có nhà Lê Hồng Phong muốn gửi bán" });
  check("RAO-HOI-02 'phí bao nhiêu vậy? anh có nhà … muốn gửi bán' → tạo tin + trả lời phí (chỉ thu khi thành công, 1%)",
    db().t.listings.length === 1 && r.body.replies.some((x) => /1%/.test(x) && /phí/i.test(x)), JSON.stringify(r.body.replies));
  // Cùng lượt bắn: hai căn một tin — "hẻm Nguyễn Tri Phương" từng thành "hẻm Nguyễn Tri", căn 2 thành "2 căn hộ Hà Đô".
  fresh();
  r = await send({ external_user_id: "hai-can-ten", text: "cô có 2 căn: căn 1 nhà hẻm Nguyễn Tri Phương quận 10 giá 8 tỷ, căn 2 căn hộ Hà Đô quận 10 75m2 giá 5 tỷ" });
  {
    const vt = db().t.listings.map((l) => l.location_raw ?? "");
    const fvt = db().t.listing_facts.filter((f) => f.question === "vi_tri").map((f) => f.answer);
    check("NC-TEN-01 hai căn một tin → 2 tin; căn 1 địa chỉ 'hẻm Nguyễn Tri Phương' (không cụt 'Nguyễn Tri'); không địa chỉ nào '2 căn hộ …'",
      db().t.listings.length === 2 && [...vt, ...fvt].some((x) => /hẻm Nguyễn Tri Phương/.test(x)) && ![...vt, ...fvt].some((x) => /Nguyễn Tri$/.test(x) || /^2 căn/.test(x)) &&
        !r.body.replies.some((x) => /2 căn hộ Hà Đô/.test(x)),
      JSON.stringify({ vt, fvt, rep: r.body.replies }));
  }
  // 10/09 chân dung nhà đầu tư: kể "mua nhà cũ sửa lại bán" + có căn + giá → là NGƯỜI BÁN, tạo tin.
  fresh();
  r = await send({ external_user_id: "dt-1", text: "Anh đầu tư mua nhà cũ sửa lại bán, giờ có căn hẻm 45 Trần Phú phường 4 quận 5 vừa sửa xong, 4x14, 5 tỷ 9" });
  check("N24 nhà đầu tư 'mua nhà cũ sửa lại bán, có căn … 5 tỷ 9' → nhánh bán, tạo tin 5 tỷ 9 (không rơi nhánh mua vì chữ 'mua')", r.body.role === "seller" && db().t.listings.length === 1 && /5 tỷ 9/.test(db().t.listings[0].price_raw ?? "") && db().t.buyers.length === 0, JSON.stringify({ role: r.body.role, l: db().t.listings.map((l) => l.price_raw), b: db().t.buyers.length }));

  // 10/09 lần 7: câu MỀM (gấp) chỉ hỏi MỘT lần — chủ nhà trả lời thứ khác là thôi,
  // không hỏi lại lần hai (trước bản này đại diện CĐT bị hỏi gấp 3 lượt liền).
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-gap1", seller_type: "nmg", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0108", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "20 Hải Thượng Lãn Ông", ward: "Phường 10", price_raw: "12 tỷ", price_vnd: 12e9, area_m2: 70, can_chu_duyet: true }).data;
    d.insert("info_requests", { listing_id: l.id, question: "gap", status: "pending" });
  });
  r = await send({ external_user_id: "z-gap1", text: "nhà 3 lầu 4 phòng ngủ em nha" });
  check("N25 đang treo câu GẤP mà chủ nói chuyện khác → câu gấp hết hạn ngay (hỏi một lần), fact kết cấu vẫn ghi, không hỏi lại gấp",
    db().t.info_requests.some((q) => q.question === "gap" && q.status === "expired") && !pend("gap") &&
      db().t.listing_facts.some((f) => f.question === "ket_cau"),
    JSON.stringify({ ir: db().t.info_requests.map((q) => [q.question, q.status]), f: db().t.listing_facts.map((f) => [f.question, f.answer]) }));

  // 10/09 lần 7: bản nháp KHÔNG lặp chữ của nhãn ("Phí: phí QL phí quản lý 20 nghìn/m2").
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-nhan", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0109", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "chung_cu", gap: false, location_raw: "Sunrise City", ward: "Phường 4", price_raw: "3 tỷ 9", price_vnd: 3.9e9, area_m2: 70, floor: 12, legal_status: "so_hong_rieng", can_chu_duyet: true }).data;
    for (const [q, a] of [["phi_quan_ly", "phí quản lý 20 nghìn/m2"], ["phi_gui_xe", "gửi xe 1tr2/tháng"],
      ["tho_cu", "thổ cư 80m2"], ["cach_mat_tien", "cách mặt tiền 30m"], ["nam_xay", "nhà mới xây 2022"],
      ["so_phong_ngu", "2 phòng ngủ"], ["so_wc", "2 WC"], ["hinh_anh", "https://x/1.jpg"]]) {
      d.insert("listing_facts", { listing_id: l.id, question: q, answer: a, source: "seller_chat" });
    }
    d.insert("info_requests", { listing_id: l.id, question: "tiem_nang", status: "pending" });
  });
  r = await send({ external_user_id: "z-nhan", text: "đăng đi em" });
  {
    const nh = r.body.replies.join(String.fromCharCode(10));
    check("N26 bản nháp không lặp nhãn: 'phí quản lý' một lần, không 'thổ cư thổ cư', không 'cách mặt tiền cách mặt tiền', không '2 phòng ngủ phòng ngủ'",
      (r.body.ban_nhap === true || r.body.dang_luon === true) && !/phí QL phí quản lý/.test(nh) && !/thổ cư thổ cư/.test(nh) &&
        !/cách mặt tiền cách mặt tiền/.test(nh) && !/phòng ngủ phòng ngủ/.test(nh) && !/WC WC/.test(nh) &&
        !/xây nhà mới xây/.test(nh) && nh.includes("phí quản lý 20 nghìn/m2"),
      nh);
  }

  // 10/09 lần 7: địa chỉ CÓ SỐ NHÀ phải vào tin ngay, khỏi hỏi lại ("hẻm 100 Nguyễn
  // Trãi", "7 Hồng Bàng"); mô tả đường ("hẻm 3m xe máy") thì KHÔNG phải địa chỉ.
  for (const [uid, cau, mong] of [
    ["vt-1", "Em là môi giới, có căn nhà hẻm 100 Nguyễn Trãi phường 3 quận 5, 40m2, 5 tỷ", "hẻm 100 Nguyễn Trãi"],
    ["vt-2", "Còn căn nữa: 7 Hồng Bàng phường 12 quận 5, 60m2, 9 tỷ, mặt tiền", "7 Hồng Bàng"],
    ["vt-3", "bán nhà hẻm 3m xe máy p4 q5 50m2 4 tỷ", null],
  ]) {
    fresh();
    r = await send({ external_user_id: uid, text: cau });
    const L = db().t.listings[0];
    const vt = db().t.listing_facts.find((f) => f.question === "vi_tri")?.answer ?? null;
    check(`N27 "${cau.slice(0, 42)}…" → vi_tri ${mong ?? "KHÔNG nhận (là mô tả đường)"}`,
      vt === mong && (L?.location_raw ?? null) === mong &&
        (mong ? !db().t.info_requests.some((q) => q.question === "vi_tri" && q.status === "pending") : true),
      JSON.stringify({ vt, loc: L?.location_raw, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  }

  // 10/09 lần 7: trường CÒN TRỐNG thì là "em ghi rồi", không phải "em cập nhật lại".
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-ghi", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0110", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "30 Hồng Bàng", ward: "Phường 12", price_raw: "7 tỷ", price_vnd: 7e9, area_m2: 50, can_chu_duyet: true }).data;
    d.insert("info_requests", { listing_id: l.id, question: "do_rong_hem", status: "pending" });
  });
  r = await send({ external_user_id: "z-ghi", text: "1 trệt 2 lầu, 3 phòng ngủ" });
  // 11/09 (42 ca): lời ghi nhận nay là "Dạ em ghi … rồi ạ." / "Dạ em sửa lại … rồi ạ." — ngắn, không "anh/chị".
  check("N28 tin chưa có phòng ngủ → bong bóng nói 'em ghi … rồi', KHÔNG nói 'sửa lại/cập nhật lại'; bong bóng kế không ghi nhận lần hai",
    r.body.replies.some((x) => /^Dạ em ghi .+ rồi ạ\./i.test(x)) && !r.body.replies.some((x) => /cập nhật lại|sửa lại/i.test(x)) &&
      r.body.replies.filter((x) => /^Dạ em ghi (?!nhận)/i.test(x)).length === 1,
    JSON.stringify(r.body.replies));

  // 10/09 lần 8: rao theo lô → neo câu hỏi bằng MÃ CĂN, không phải phường (cả lô cùng phường).
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-lo", seller_type: "nmg", name: null, active_listing_id: null }).data;
    const p = d.insert("projects", { name: "Ny'ah Phú Định", slug: "nyah-phu-dinh", district: "Quận 8", ward: "Phường 16", amenities: [], description: "" }).data;
    let dau = null;
    for (const [ma, gia] of [["A5", "18 tỷ"], ["A7", "18 tỷ 5"]]) {
      const l = d.insert("listings", { code: `BDS-Q8-00${ma}`, seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", district: "Quận 8", ward: "Phường 16", project_id: p.id, unit_code: ma, price_raw: gia, price_vnd: 18e9, area_m2: 160, frontage_m: 8, length_m: 20, can_chu_duyet: true, gap: false }).data;
      dau = dau ?? l;
    }
    s.active_listing_id = dau.id;
    d.insert("info_requests", { listing_id: dau.id, question: "phap_ly", status: "pending" });
  });
  // Model CHẾT để đo đúng câu mẫu tiền định (đường thật hôm 10/09 khi hết credit API).
  globalThis.__model.create = () => { throw new Error("model chết"); };
  r = await send({ external_user_id: "z-lo", text: "sổ hồng riêng từng căn, hoàn công" });
  check("N29 rao theo lô, model chết → câu mẫu neo bằng mã căn ('Căn A5 nha.'), không neo bằng phường, không có dấu phẩy trước câu hỏi",
    r.body.replies.some((x) => /Căn A5 nha. [A-ZĐ]/.test(x)) && !r.body.replies.some((x) => /Căn Phường/.test(x)),
    JSON.stringify({ body: r.body, ir: db().t.info_requests.map((q) => [q.question, q.status]), l: db().t.listings.map((x) => [x.code, x.unit_code]) }));

  // FR-193 (10/09, chủ dự án nhắn thật vào Zalo OA): "Chào bạn tôi cần bán căn ho ở
  // Hà đô centrosa garden" → phải (1) chào lại, (2) hiểu "căn ho" = chung cư dù câu
  // có dấu chỗ khác, (3) KHÔNG khẳng định "Quận 5" vì không ai nói quận.
  fresh();
  r = await send({ external_user_id: "chao-1", text: "Chào bạn tôi cần bán căn ho ở Hà đô centrosa garden" });
  check("N30 'Chào bạn … bán căn ho …' → chào lại, loại = chung cư (chữ thiếu dấu), không tự nhận Quận 5, không hỏi lại loại BĐS",
    /^Dạ em chào/.test(r.body.replies[0] ?? "") && db().t.listings[0]?.property_type === "chung_cu" &&
      !/Quận 5/.test(r.body.replies.join(String.fromCharCode(10))) &&
      !db().t.info_requests.some((q) => q.question === "loai_bds" && q.status === "pending"),
    JSON.stringify({ replies: r.body.replies, loai: db().t.listings[0]?.property_type, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));

  // FR-193 b (10/09): quận nói ở LƯỢT SAU cũng phải vào cột — không để căn hộ
  // Quận 10 nằm trong rổ Quận 5 (mặc định của cột).
  fresh();
  r = await send({ external_user_id: "quan-1", text: "Chào bạn tôi cần bán căn ho ở Hà đô centrosa garden" });
  r = await send({ external_user_id: "quan-1", text: "quận 10 phường 12, 86m2, 6 tỷ 5" });
  check("N31 lượt sau nói 'quận 10 phường 12' → listings.district = Quận 10 (không giữ mặc định Quận 5), ward = Phường 12",
    db().t.listings[0]?.district === "Quận 10" && db().t.listings[0]?.ward === "Phường 12",
    JSON.stringify(db().t.listings.map((l) => [l.code, l.district, l.ward, l.property_type])));

  // FR-183 b (10/09): tin đã lên kệ, chủ nhà nhắn "đủ thông tin rồi em" ngoài vòng
  // hỏi → chốt bằng ĐIỂM, không rơi vào câu chăm sóc chung.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-du", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    d.insert("listings", { code: "BDS-Q5-0120", seller_id: s.id, deal: "ban", status: "dang_ban", property_type: "nha_pho", location_raw: "45 Trần Bình Trọng", ward: "Phường 2", district: "Quận 5", price_raw: "8 tỷ", price_vnd: 8e9, area_m2: 60, floors: 4, bedrooms: 4, alley_width_m: 5, legal_status: "so_hong_rieng", has_completion: true, can_chu_duyet: true, gap: false });
  });
  r = await send({ external_user_id: "z-du", text: "đủ thông tin rồi em" });
  check("N32 'đủ thông tin rồi em' khi tin đã lên kệ → chốt 'em rao như vậy nhé' + nói ĐIỂM, đóng dấu chu_noi_du_at",
    r.body.du_roi === true && /rao như vậy/i.test(r.body.replies.join(" ")) && r.body.replies.join(" ").includes("/100") &&
      db().t.listings[0].chu_noi_du_at != null,
    JSON.stringify({ body: r.body, l: db().t.listings.map((l) => [l.code, l.chu_noi_du_at]) }));

  // FR-193 e (10/09, lượt bắn 15 tin): toà/tháp là thông tin RIÊNG, không phải kết
  // cấu; và "cao 9m" trong câu kho xưởng phải được ghi, không hỏi lại.
  {
    const { nhanDienFact } = await import("../../supabase/functions/_shared/extraction/khop-cau-tra-loi.ts");
    const a = nhanDienFact("toa S3.02 tang 15");
    const b = nhanDienFact("cao 9m, tải trọng 2 tấn, có trạm biến áp 320kva");
    check("N33 'toa S3.02' → fact toa_thap (không phải ket_cau); 'cao 9m' kèm tải trọng → fact chieu_cao",
      a?.question === "toa_thap" && a?.answer === "S3.02" && b?.question === "chieu_cao",
      JSON.stringify({ a, b }));
  }

  // FR-195 (10/09): chủ nhà kể chuyện của CẢ DỰ ÁN → chép sang project_facts ở
  // trạng thái chờ duyệt, KHÔNG ghi thẳng vào projects.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-pf", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const p = d.insert("projects", { name: "Sunrise City", slug: "sunrise-city", district: "Quận 7", ward: "Phường Tân Hưng", amenities: ["Hồ bơi Olympic"], description: "" }).data;
    const l = d.insert("listings", { code: "BDS-Q7-0009", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "chung_cu", district: "Quận 7", ward: "Phường Tân Hưng", project_id: p.id, price_raw: "3 tỷ", price_vnd: 3e9, area_m2: 70, can_chu_duyet: true, gap: false }).data;
    s.active_listing_id = l.id;
    d.insert("info_requests", { listing_id: l.id, question: "phi_quan_ly", status: "pending" });
  });
  r = await send({ external_user_id: "z-pf", text: "phí quản lý 16 nghìn/m2" });
  check("N34 fact cấp DỰ ÁN (phí quản lý) → vào project_facts chờ duyệt, projects chưa đổi",
    db().t.project_facts?.some((f) => f.khoa === "phi_quan_ly" && f.trang_thai === "cho_duyet" && /16/.test(f.gia_tri)) === true &&
      JSON.stringify(db().t.projects[0].amenities) === JSON.stringify(["Hồ bơi Olympic"]),
    JSON.stringify({ pf: db().t.project_facts, am: db().t.projects[0].amenities }));

  // FR-185: kho hỏng → không nuốt ảnh: fact URL tạm + bot_errors.
  fresh(seedKho);
  globalThis.__storageHong = true;
  r = await send({ external_user_id: "z-ccrb", text: "", image_url: "https://f9-zpg.zdn.vn/hong.jpg" });
  check("N9 kho hỏng → rơi về fact hinh_anh URL tạm + ghi sổ lỗi, vẫn đáp nhận ảnh", db().t.listing_facts.some((f) => f.question === "hinh_anh" && /hong\.jpg/.test(f.answer)) && db().t.listing_media.length === 0 && db().t.bot_errors.some((e) => /anh vao kho/.test(e.source ?? "")) && /Cảm ơn|Ảnh .*đẹp/.test(r.body.replies.at(-1)), JSON.stringify({ f: db().t.listing_facts, e: db().t.bot_errors, rep: r.body.replies }));
  globalThis.__storageHong = false;
  // FR-185: sổ ghi lệch diện tích → hỏi lại + báo admin; chưa có diện tích → lấy từ sổ.
  fresh(seedKho);
  db().t.sellers.find((s) => s.zalo_user_id === "z-ccrb").active_listing_id = db().t.listings[0].id; // căn 0001: 50m2
  globalThis.__anh = { loai: "giay_to", mo_ta: "sổ hồng", giay_to: { loai_giay: "sổ hồng", dien_tich_m2: 60, dia_chi: null, so_thua: null, so_to: null, ro_net: true } };
  r = await send({ external_user_id: "z-ccrb", text: "", image_url: "https://f9-zpg.zdn.vn/so2.jpg" });
  check("N10 sổ ghi 60m2, tin ghi 50m2 (lệch 20%) → bong bóng hỏi lại số nào đúng + việc 📐 cho admin + fact bo_sung nguồn so_do_ocr",
    r.body.replies.some((x) => /60m2/.test(x) && /50m2/.test(x) && /xác nhận/.test(x)) && db().t.reminders.some((x) => /📐/.test(x.note)) && db().t.listing_facts.some((f) => f.question === "bo_sung" && f.source === "so_do_ocr"),
    JSON.stringify({ body: r.body, rem: db().t.reminders }));
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-so", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    d.insert("listings", { code: "BDS-Q5-0103", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "5 Hồng Bàng", ward: "Phường 12", price_raw: "9 tỷ", price_vnd: 9e9, can_chu_duyet: true });
  });
  globalThis.__anh = { loai: "giay_to", mo_ta: "sổ hồng", giay_to: { loai_giay: "sổ hồng", dien_tich_m2: 48.5, dia_chi: "Hồng Bàng, P12", so_thua: "7", so_to: "2", ro_net: true } };
  r = await send({ external_user_id: "z-so", text: "", image_url: "https://f9-zpg.zdn.vn/so3.jpg" });
  check("N10b tin chưa có diện tích → lấy 48.5m2 từ sổ (fact dien_tich nguồn so_do_ocr), bong bóng nói lấy số đó", db().t.listing_facts.some((f) => f.question === "dien_tich" && /48\.5/.test(f.answer) && f.source === "so_do_ocr") && r.body.replies.some((x) => /48\.5m2/.test(x)), JSON.stringify({ body: r.body, f: db().t.listing_facts }));
  check("N10c model không phân loại được → vẫn cất nhưng RIÊNG TƯ", (() => { globalThis.__anh = undefined; return true; })());
  fresh(seedKho);
  globalThis.__model.parse = (p) => laLuotAnh(p) ? null : OUT();
  r = await send({ external_user_id: "z-ccrb", text: "", image_url: "https://f9-zpg.zdn.vn/mo.jpg" });
  check("N10d phân loại hỏng → ảnh vào bucket listing-private (không phục vụ web), không fact URL", db().t.listing_media.some((m) => m.bucket === "listing-private") && !db().t.listing_facts.some((f) => /mo\.jpg/.test(f.answer)), JSON.stringify(db().t.listing_media));

  // FR-183: người rao ≥2 căn gật bản nháp → chúc mừng kèm ĐIỂM NGƯỜI RAO.
  fresh(seedKho);
  const L2 = db().t.listings[1]; // BDS-Q5-0002 cho_thong_tin của z-ccrb (đã có 3 tin)
  L2.can_chu_duyet = true; L2.floors = 3; L2.bedrooms = 3; L2.alley_width_m = 4; L2.legal_status = "so_hong_rieng";
  db().insert("listing_facts", { listing_id: L2.id, question: "tiem_nang", answer: "ở", source: "seller_chat" });
  db().insert("info_requests", { listing_id: L2.id, question: "duyet_tin", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "ok đăng đi" });
  check("N11 người rao nhiều căn gật bản nháp → chúc mừng có 'Điểm người rao của anh chị hiện X/100 (N căn đang rao)', RPC diem_nguoi_ban",
    r.body.duyet === true && /Điểm người rao/.test(r.body.replies[0]) && /căn đang rao/.test(r.body.replies[0]) && db().log.some((l) => l.rpc === "diem_nguoi_ban"), JSON.stringify(r.body));
  // FR-114 mở rộng: chủ nhà nhắc dự án trong kho → khối DỰ ÁN vào ngữ cảnh model.
  fresh((d) => {
    d.insert("projects", { name: "Sunrise City", developer: "Novaland", district: "Quận 7", amenities: ["Hồ bơi Olympic", "Gym"], description: "Khu căn hộ ven sông" });
    const s = d.insert("sellers", { zalo_user_id: "z-da", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q7-0001", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "chung_cu", ward: "Phường Tân Hưng", price_raw: "3 tỷ", price_vnd: 3e9, can_chu_duyet: true }).data;
    d.insert("info_requests", { listing_id: l.id, question: "vi_tri", status: "pending" });
  });
  globalThis.__rpc.match_projects = (_d, a) => ({ data: /sunrise/i.test(a.p_text) ? db().t.projects : [], error: null });
  r = await send({ external_user_id: "z-da", text: "căn hộ chung cư Sunrise City tầng 12" });
  check("N12 chủ nhắc 'Sunrise City' (có trong kho) → ngữ cảnh model có khối DỰ ÁN với tiện ích 'Hồ bơi Olympic'; tin được gắn project_id", createCalls().some((c) => /DỰ ÁN \(kiến thức ĐÃ XÁC THỰC/.test(c.params.messages[0].content) && /Hồ bơi Olympic/.test(c.params.messages[0].content)) && db().t.listings[0].project_id === db().t.projects[0].id, JSON.stringify({ p: createCalls().at(-1)?.params.messages[0].content.slice(0, 400), l: db().t.listings[0] }));
  delete globalThis.__rpc.match_projects;
}

// ── 11/09: BÁO LẠI THỨ ĐÃ LƯU (app_config.bao_lai_da_luu) ─────────────────────
// Chủ dự án: "chat một câu là nhắn đã thu thập được gì trong Supabase". Bong bóng
// 🤖 phải ĐỌC LẠI từ DB — nên các ca dưới chỉnh cột bằng tay (như trigger đọc
// lệch) rồi kiểm bot nói đúng cột, không nói theo chữ khách.
{
  // Chưa có dòng cấu hình = tắt.
  delete globalThis.__cauHinh;
  fresh(seedKho);
  db().insert("info_requests", { listing_id: db().t.listings[1].id, question: "phap_ly", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "sổ hồng riêng em" });
  check("BLDL-01 chưa bật công tắc → không có bong bóng 🤖", r.body.role === "seller" && r.body.replies.length > 0 && !r.body.replies.some((x) => /🤖/.test(x)), JSON.stringify(r.body.replies));

  // day_du: cột diện tích bị "đọc lệch" thành 6 trong khi chủ nhà gõ "6x11".
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "day_du" };
  fresh(seedKho);
  let LB = db().t.listings[1]; // BDS-Q5-0002 · 99 Nguyễn Trãi · Phường 3 · 7 tỷ · cho_thong_tin
  db().t.sellers[0].active_listing_id = LB.id;
  LB.area_m2 = 6;
  LB.can_chu_duyet = true; // chưa chủ duyệt → không tự lên kệ, lượt sau còn hỏi qua model
  db().insert("listing_facts", { listing_id: LB.id, question: "dien_tich", answer: "6x11", source: "seller_chat" });
  db().insert("info_requests", { listing_id: LB.id, question: "phap_ly", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "sổ hồng riêng em" });
  // 14/09/2026 — chủ dự án: "nhắn tin lại cho khách LIỀN SAU tin nhắn đó đã bóc
  // tách (thật vào db) gì". 🤖 là bong bóng ĐẦU TIÊN, nói fact CỦA LƯỢT NÀY đọc từ
  // DB. 21/09/2026 (chủ dự án): các lượt sau in Y NHƯ lượt tạo tin — một dòng "🤖 Đã lưu:" là toàn bộ tin
  // trong DB + "Kèm:" cho fact ngoài cột; không còn dòng "📦 Tin giờ" hay dòng fact riêng.
  let bl = r.body.replies[0] ?? "";
  check("BLDL-02 day_du → bong bóng ĐẦU là 🤖, đứng riêng", /^🤖 Bóc tách được/.test(bl) && r.body.replies.length >= 2 && !r.body.replies.slice(1).some((x) => /🤖/.test(x)), JSON.stringify(r.body.replies));
  // 24/09/2026 (chủ dự án: "đừng đưa đã lưu nữa, mà là đã bóc tách được gì trong tin nhắn đó"): 🤖 chỉ nói thứ bóc
  // từ CHÍNH tin vừa nhắn, giá trị trong ngoặc kép — không in lại cả tin (địa chỉ, 6m², giá) như bản 21/09.
  // 25/09/2026: chữ đệm cuối câu ("… em") không vào ô — giá trị là "sổ hồng riêng".
  check("BLDL-03 🤖 'Bóc tách được' chỉ nói thứ bóc từ tin NÀY (pháp lý, trong ngoặc kép), KHÔNG in lại cả tin (địa chỉ/6m²/giá), không 📦", /^🤖 Bóc tách được: pháp lý: "sổ hồng riêng"/.test(bl) && !/sổ hồng riêng em/.test(bl) && !/Nguyễn Trãi|6m²|giá/.test(bl) && !/📦 Tin giờ/.test(bl), `${LB.status} | ${bl}`);
  check("BLDL-03b 🤖 đọc SAU khi ghi: pháp lý chủ vừa trả lời trong CHÍNH lượt này có mặt trong tóm tắt", /^🤖 Bóc tách được: .*sổ hồng riêng/.test(bl), bl);
  check("BLDL-04 'Bóc tách được' chỉ có fact CỦA LƯỢT NÀY — không kèm '6x11' đã lưu lượt trước", !/6x11/.test(bl), bl);
  check("BLDL-05 🤖 vào sổ tin như mọi câu bot", db().t.messages.some((m) => m.sender === "bot" && /^🤖/.test(m.body ?? "")));
  // Lượt sau là câu RAO THÊM CĂN — nhánh này chắc chắn gửi lịch sử (khối NGỮ
  // CẢNH) cho model. Phải thấy câu bot lượt trước (lịch sử có thật, phép kiểm
  // không rỗng) mà KHÔNG thấy 🤖 (đã lọc).
  const loiLuot1 = Array.from(r.body.replies.find((x) => !x.startsWith("🤖")) ?? "").slice(0, 18).join("");
  const nTruoc = createCalls().length;
  r = await send({ external_user_id: "z-ccrb", text: "còn một căn nữa, bán nhà Phường 5 giá 6 tỷ 60m2" });
  const moi = createCalls().slice(nTruoc);
  const vao = (c) => (c.params.messages ?? []).map((m) => typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n") + JSON.stringify(c.params.system ?? "");
  check("BLDL-06 lượt sau: model CÓ nhận lịch sử (câu lượt trước) nhưng KHÔNG thấy 🤖", loiLuot1.length > 5 && moi.some((c) => /NGỮ CẢNH/.test(vao(c)) && vao(c).includes(loiLuot1)) && !moi.some((c) => vao(c).includes("🤖")), JSON.stringify({ loiLuot1, n: moi.length, dau: moi.map((c) => vao(c).slice(0, 500)) }));
  // 23/09/2026 (chủ dự án): câu "Sai chỗ nào … nhắn lại giúp em nha" bỏ hẳn.
  check("BLDL-06b lượt TẠO tin → 🤖 đầu tiên là tóm tắt tin VỪA RAO (Phường 5), bỏ 📝 trùng, KHÔNG còn câu 'Sai chỗ nào…'",
    // FR-226 a (25/09/2026, chủ dự án: "Nhà người ta chưa có gì mà nó tự nhận là nhà phố"): "bán nhà Phường 5 …" chưa có dấu
    // hiệu nhà phố → "Nhà bán".
    /^🤖 Bóc tách được: loại: "Nhà bán"/.test(r.body.replies[0] ?? "") && /Phường 5/.test(r.body.replies[0] ?? "") && !r.body.replies.some((x) => /Sai chỗ nào/.test(x)) && !r.body.replies.some((x) => /^📝 Em ghi nhận/.test(x)),
    JSON.stringify(r.body.replies));
  // 21/09/2026 (bắn thật kiem-cc): chủ nhà là "chú" → doiTuXung đổi "📝 Em ghi nhận" thành "📝 Cháu ghi nhận"
  // TRƯỚC đoạn bỏ 📝 → khách đọc hai lần. Bỏ 📝 phải nhận cả hai cách xưng.
  db().t.sellers[0].xung_ho = "chú";
  r = await send({ external_user_id: "z-ccrb", text: "chú còn một căn nữa, bán nhà Phường 6 giá 5 tỷ 50m2" });
  check("BLDL-06c chủ nhà là CHÚ → lượt tạo tin vẫn bỏ 📝 (đã thành 'Cháu ghi nhận'), 🤖 đầu, xưng cháu",
    /^🤖 Bóc tách được: /.test(r.body.replies[0] ?? "") && !r.body.replies.some((x) => /📝 \S+ ghi nhận/u.test(x)) && r.body.replies.some((x) => /cháu/i.test(x)),
    JSON.stringify(r.body.replies));
  db().t.sellers[0].xung_ho = null;

  // giá có chữ mà không ra số → báo thẳng, đó là tin web lọc giá sẽ không thấy.
  fresh(seedKho);
  LB = db().t.listings[1]; db().t.sellers[0].active_listing_id = LB.id;
  LB.price_raw = "5 tới 6"; LB.price_vnd = null;
  db().insert("info_requests", { listing_id: LB.id, question: "phap_ly", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "sổ hồng riêng em" });
  // 24/09: lượt sau chỉ báo thứ bóc từ tin đó; "(chưa đọc ra số)" nằm ở lượt tạo tin (bocTachTaoTin, van-tra-loi.mjs).
  check("BLDL-07 lượt sau: tin 'sổ hồng riêng em' → 🤖 chỉ pháp lý, không in lại giá cũ '5 tới 6'", /^🤖 Bóc tách được: pháp lý/.test(r.body.replies[0] ?? "") && !/5 tới 6/.test(r.body.replies[0] ?? ""), JSON.stringify(r.body.replies));

  // thay_doi: 🤖 đầu tiên, không mã tin, một dòng đầy đủ; lượt không lưu gì thì im.
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "thay_doi" };
  fresh(seedKho);
  LB = db().t.listings[1]; db().t.sellers[0].active_listing_id = LB.id;
  db().insert("info_requests", { listing_id: LB.id, question: "phap_ly", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "sổ hồng riêng em" });
  bl = r.body.replies[0] ?? "";
  check("BLDL-08 thay_doi → 🤖 là bong bóng ĐẦU, riêng, chỉ thứ bóc từ tin này (pháp lý), không 📦, không mã tin", /^🤖 Bóc tách được: pháp lý: "sổ hồng riêng"$/.test(bl) && !/📦 Tin giờ/.test(bl) && !/BDS-Q5/.test(bl), JSON.stringify(r.body.replies));
  r = await send({ external_user_id: "z-ccrb", text: "dạ em" });
  check("BLDL-09 tin khách không bóc được gì → 🤖 'Không bóc tách được gì từ tin này.' (24/09: không bóc được cũng nói ra)", r.body.replies[0] === "🤖 Không bóc tách được gì từ tin này." && r.body.replies.length >= 2, JSON.stringify(r.body.replies));
  LB.area_m2 = 66;
  r = await send({ external_user_id: "z-ccrb", text: "nhà hướng đông nam em" });
  check("BLDL-10 lượt này lưu hướng (cột đã đổi 66m² ở chỗ khác) → 🤖 chỉ 'hướng', không in 66m², không 📦", /^🤖 Bóc tách được: hướng: "hướng đông nam"/.test(r.body.replies[0] ?? "") && !/66m²/.test(r.body.replies[0] ?? "") && !/📦 Tin giờ/.test(r.body.replies[0] ?? ""), JSON.stringify(r.body.replies));
  r = await send({ external_user_id: "z-ccrb", text: "nhà hướng đông nam nha em" });
  check("BLDL-10b nói lại hướng → 🤖 đầu là MỘT dòng về tin này (hướng hoặc 'không bóc được'), không 📦", /^🤖 (?:Bóc tách được: .*hướng|Không bóc tách được gì)/.test(r.body.replies[0] ?? "") && !/📦 Tin giờ/.test(r.body.replies[0] ?? ""), JSON.stringify(r.body.replies));

  // 23/09/2026 (chủ dự án, lần 2: "in các cột chính và thông tin của lượt hiện tại thôi nhưng ko được thiếu cái gì hết"):
  // 🤖 = tóm tắt cột + fact CỦA LƯỢT NÀY mà cột chưa nói. Fact ngoài cột của lượt TRƯỚC không in lại.
  LB.nhan = ["view_cong_vien", "nha_hoan_cong"];
  db().insert("listing_facts", { listing_id: LB.id, question: "nhan", answer: "đã hoàn công", source: "seller_chat" });
  db().insert("listing_facts", { listing_id: LB.id, question: "ly_do_ban", answer: "lượt trước: đổi nhà gần trường cho con", source: "seller_chat" });
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: LB.id, question: "so_phong_ngu", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "3 phòng ngủ em, nhà nhìn ra view sông thoáng lắm" });
  bl = r.body.replies[0] ?? "";
  check("BLDL-10c 🤖 = cột chính + fact CỦA LƯỢT NÀY (3 phòng ngủ, view sông); KHÔNG in lại fact ngoài cột của lượt trước (lý do bán)",
    /^🤖 Bóc tách được: .*số phòng ngủ: "3"/.test(bl) && /view sông/.test(bl) && !/đổi nhà gần trường/.test(bl), JSON.stringify(r.body.replies));
  check("BLDL-10e 🤖 in nhãn BÓC TỪ TIN NÀY (view sông), không in lại nhãn cũ của tin (view công viên, đã hoàn công); view in nhãn trung tính 'view:' (không 'view căn hộ')",
    /nhãn tìm kiếm: "view sông"/.test(bl) && !/view công viên|đã hoàn công/.test(bl) && /view: "/.test(bl) && !/view căn hộ/.test(bl), bl);
  // "ko được thiếu cái gì hết": fact lượt này mà CỘT tương ứng trống (trigger không đọc ra) vẫn phải in ở "Kèm:";
  // "gấp" không có trong tóm tắt cột nên luôn in.
  LB.legal_status = null;
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: LB.id, question: "phap_ly", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "vi bằng thôi em, cần bán gấp" });
  bl = r.body.replies[0] ?? "";
  check("BLDL-10f fact lượt này có cột mà cột trống (pháp lý 'vi bằng' — trigger không đổi ra legal_status) + 'gấp' → vẫn in ở Kèm, không thiếu",
    /^🤖 Bóc tách được: .*pháp lý: "vi bằng thôi"/.test(bl) && /gấp/.test(bl) && !LB.legal_status, JSON.stringify({ bl, legal: LB.legal_status, f: db().t.listing_facts.filter((f) => f.listing_id === LB.id).slice(-4).map((f) => [f.question, f.answer]) }));

  // 23/09/2026 (chủ dự án: "xóa hoặc sửa luật cứng nhắc đó đi"): câu lệnh gửi model KHÔNG còn ép chép nguyên văn,
  // "ĐÚNG MỘT", "Không hỏi gì khác", "dưới 30 từ" — vẫn nói ý hỏi chính để câu trả lời kế vào đúng ô.
  // Người bán MỚI rao một câu → chắc chắn đi nhánh r1 "nhận câu rao, hỏi thứ đầu tiên còn thiếu".
  {
    const vaoDu = (c) => (c.params.messages ?? []).map((m) => typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n") + JSON.stringify(c.params.system ?? "");
    const nTruocR1 = createCalls().length;
    await send({ external_user_id: "bldl-mem", text: "bán nhà hẻm 4m Nguyễn Trãi quận 5, 60m2, giá 6 tỷ" });
    const luot = createCalls().slice(nTruocR1).map(vaoDu).join("\n");
    check("BLDL-10d câu lệnh model không còn luật cứng (NGUYÊN VĂN / ĐÚNG MỘT / Không hỏi gì khác / dưới 30 từ), vẫn có 'ý hỏi chính' + 'hợp với loại nhà'",
      luot.length > 0 && !/NGUYÊN VĂN|ĐÚNG MỘT|Không hỏi gì khác|dưới 30 từ|dưới 50 từ/.test(luot) && /CẦN HỎI:/.test(luot),
      JSON.stringify({ cung: luot.match(/.{0,80}(?:NGUYÊN VĂN|ĐÚNG MỘT|Không hỏi gì khác|dưới 30 từ|dưới 50 từ).{0,80}/g), n: luot.length }));
  }

  // Người MUA: 14/09 cũng được báo hồ sơ vừa lưu (đọc lại buyers.preferences).
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "thay_doi" };
  fresh(seedKho);
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "ban", area: "quận 5", budget: "tầm 6 tỷ" }, replies: ["Dạ chị cần mấy phòng ngủ ạ?"] });
  r = await send({ external_user_id: "mua-bldl", text: "tìm nhà quận 5 tầm 6 tỷ" });
  check("BLDL-11 người MUA, công tắc bật → 🤖 'Đã lưu nhu cầu' là bong bóng ĐẦU, đúng khoá vừa lưu, không khoá nội bộ",
    /^🤖 Bóc tách được: .*khu vực muốn tìm: "Quận 5".*khoảng giá: "tầm 6 tỷ"/.test(r.body.replies[0] ?? "") && !/tên trợ lý|ten_tro_ly|•ai/.test(r.body.replies[0] ?? "") && r.body.replies.length === 2,
    JSON.stringify(r.body.replies));
  // 22/09/2026 (bắn thật): model mở bằng "Dạ em đã lưu nhu cầu: …" sau 🤖 → câu đó bị bỏ, câu hỏi giữ.
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "ban", area: "quận 5", budget: "tầm 6 tỷ", bedrooms: 3 }, replies: ["Dạ em đã lưu nhu cầu: mua nhà Quận 5, tầm 6 tỷ để ở ạ. Mình thích hẻm xe hơi hay mặt tiền ạ?"] });
  r = await send({ external_user_id: "mua-bldl", text: "3 phòng ngủ, để ở" });
  check("BLDL-11c model lặp 'Dạ em đã lưu nhu cầu…' sau 🤖 → bỏ câu lặp, còn 🤖 + câu hỏi",
    /^🤖 Bóc tách được/.test(r.body.replies[0] ?? "") && !/đã lưu nhu cầu: mua/.test(r.body.replies.slice(1).join(" ")) && /hẻm xe hơi hay mặt tiền/.test(r.body.replies.join(" ")),
    JSON.stringify(r.body.replies));
  const hsMua = db().t.buyers.find((b) => b.zalo_user_id === "mua-bldl")?.preferences ?? {};
  check("BLDL-11b 🤖 người mua nói đúng thứ ĐÃ vào DB (hồ sơ có area + budget)", hsMua.area === "Quận 5" && hsMua.budget === "tầm 6 tỷ", JSON.stringify(hsMua));
  const nLich = parseCalls().length;
  r = await send({ external_user_id: "mua-bldl", text: "3 phòng em" });
  const lichSuMua = JSON.stringify(parseCalls().slice(nLich).map((c) => c.params.messages));
  check("BLDL-11c lượt sau model người mua KHÔNG thấy 🤖 trong lịch sử", !lichSuMua.includes("🤖"), lichSuMua.slice(0, 300));
  delete globalThis.__cauHinh;
  fresh(seedKho);
  r = await send({ external_user_id: "mua-bldl2", text: "tìm nhà quận 5 tầm 6 tỷ" });
  check("BLDL-11d người MUA, công tắc tắt → không 🤖", !JSON.stringify(r.body).includes("🤖"), JSON.stringify(r.body).slice(0, 300));
  delete globalThis.__cauHinh;
}

// ── 11/09: LƯỢT BẮN 42 CA — cổng rao, giá lóng, giá mỗi m², số đọc bằng chữ, ─
// vùng ngoài, nhiều căn theo quận, lời sửa có phủ định, bận/hoãn, số trần, tự xưng.
{
  globalThis.__cauHinh = { test_reset_hello: "1" }; // 🤖 tắt: đo đúng lời đáp
  const raoMoi = async (uid, text) => { fresh(); const rr = await send({ external_user_id: uid, text }); return { rr, LL: db().t.listings }; };
  let { rr, LL } = await raoMoi("t42-1", "Nhà mặt tiền Hùng Vương Q5, DT 5x20, 5 tầng, giá 32 tỏi");
  check("T42-01 rao KHÔNG có chữ 'bán' (loại + giá + ≥3 chi tiết) → mở tin, không chào khuôn", LL.length === 1 && LL[0].price_raw === "32 tỏi" && rr.body.role === "seller" && !rr.body.hoi_vai, JSON.stringify({ LL, b: rr.body }));
  ({ rr, LL } = await raoMoi("t42-2", "Cần sang nhượng căn hộ The Sun Avenue quận 2 3pn 96m2, HĐMB, giá 5 tỷ"));
  check("T42-02 'sang nhượng căn hộ' là rao bán → mở tin", LL.length === 1 && /5 tỷ/.test(LL[0].price_raw ?? "") && LL[0].deal === "ban", JSON.stringify({ LL, b: rr.body }));
  ({ rr, LL } = await raoMoi("t42-3", "Nhà cấp 4 Bình Chánh 5x25 thổ cư 100% 1ty9"));
  check("T42-03 'Nhà cấp 4 Bình Chánh 5x25 thổ cư 1ty9' → mở tin, quận Bình Chánh, giá '1ty9'", LL.length === 1 && LL[0].district === "Huyện Bình Chánh" && LL[0].price_raw === "1ty9", JSON.stringify(LL));
  ({ rr, LL } = await raoMoi("t42-4", "có căn nào q5 tầm 5 tỷ không em"));
  check("T42-04 người MUA 'có căn nào q5 tầm 5 tỷ không em' → KHÔNG mở tin rao", LL.length === 0 && rr.body.role !== "seller", JSON.stringify({ LL, b: rr.body }));
  ({ rr, LL } = await raoMoi("t42-4b", "tìm nhà q5 hẻm xe hơi 60m2 tầm 6 tỷ"));
  check("T42-04b người MUA 'tìm nhà … tầm 6 tỷ' → KHÔNG mở tin rao", LL.length === 0, JSON.stringify(LL));
  ({ rr, LL } = await raoMoi("t42-5", "bán nhà hxh Nguyễn Trãi p3 q5, 4x16, 1 trệt 2 lầu, shr, 9t5"));
  check("T42-05 giá lóng '9t5' được cắt; fact pháp lý là 'shr', không phải NGUYÊN câu rao", LL[0]?.price_raw === "9t5" && db().t.listing_facts.find((f) => f.question === "phap_ly")?.answer === "shr", JSON.stringify({ L: LL[0], f: db().t.listing_facts }));
  ({ rr, LL } = await raoMoi("t42-6", "bán nhà quận 5 giá 75 triệu/m2, diện tích 50m2"));
  check("T42-06 '75 triệu/m2, 50m2' → giá CẢ CĂN '3 tỷ 750 triệu', bong bóng ghi nhận nói rõ em đã nhân", LL[0]?.price_raw === "3 tỷ 750 triệu" && /75 triệu\/m2 \(≈ 3 tỷ 750 triệu cho 50m2\)/.test(rr.body.replies[0] ?? ""), JSON.stringify({ L: LL[0], rep: rr.body.replies }));
  ({ rr, LL } = await raoMoi("t42-7", "bán nhà quận năm phường hai diện tích năm mươi mét vuông giá bốn tỷ rưỡi"));
  check("T42-07 câu nói bằng giọng (số đọc bằng chữ) → Phường 2, Quận 5, giá '4 tỷ rưỡi', diện tích 50m2", LL[0]?.ward === "Phường 2" && LL[0]?.district === "Quận 5" && LL[0]?.price_raw === "4 tỷ rưỡi" && db().t.listing_facts.some((f) => f.question === "dien_tich" && f.answer === "50m2"), JSON.stringify({ L: LL[0], f: db().t.listing_facts }));
  ({ rr, LL } = await raoMoi("t42-8", "bán nhà ở Hà Nội quận Cầu Giấy 50m2 9 tỷ"));
  check("T42-08 nhà Hà Nội → KHÔNG mở tin, nói thật là chỉ nhận Sài Gòn và Long An", LL.length === 0 && rr.body.replies.some((x) => /Sài Gòn và Long An/.test(x)), JSON.stringify({ LL, rep: rr.body.replies }));
  ({ rr, LL } = await raoMoi("t42-9", "bán nhà Thủ Dầu Một Bình Dương 5x20 giá 3 tỷ"));
  check("T42-09 vùng lân cận (Bình Dương) → vẫn mở tin, quận ghi 'Bình Dương', KHÔNG phải Quận 5", LL.length === 1 && LL[0].district === "Bình Dương", JSON.stringify(LL));
  ({ rr, LL } = await raoMoi("t42-10", "anh có 2 căn: 1 căn q5 50m2 6 tỷ, 1 căn q11 40m2 4 tỷ"));
  check("T42-10 'có 2 căn: 1 căn q5 …, 1 căn q11 …' → HAI tin đúng hai quận, không mã căn 'Q5'",
    LL.length === 2 && LL.map((l) => l.district).sort().join(",") === "Quận 11,Quận 5" && LL.every((l) => !l.unit_code) && LL.map((l) => l.area_m2).sort().join(",") === "40,50" &&
      /Em mở 2 tin riêng: Quận 5 50m2 6 tỷ · Quận 11 40m2 4 tỷ/.test(rr.body.replies[0] ?? ""),
    JSON.stringify({ LL, rep: rr.body.replies }));

  // Lời sửa có vế phủ định, đang treo câu địa chỉ.
  const coTinDangHoi = (uid, q, them = {}) => fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: uid, seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0142", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", price_raw: "7 tỷ", price_vnd: 7e9, area_m2: 60, can_chu_duyet: true, ...them }).data;
    d.t.sellers.find((x) => x.id === s.id).active_listing_id = l.id;
    d.insert("info_requests", { listing_id: l.id, question: q, status: "pending" });
  });
  coTinDangHoi("t42-sua", "vi_tri", { ward: "Phường 4" });
  r = await send({ external_user_id: "t42-sua", text: "sai rồi em, phường 9 chứ không phải phường 4" });
  let f42 = db().t.listing_facts;
  check("T42-11 'phường 9 chứ không phải phường 4' → ghi Phường 9, KHÔNG ghi Phường 4, KHÔNG ghi 'sai rồi em' vào địa chỉ; một bong bóng: sửa + hỏi lại",
    f42.some((f) => f.question === "phuong" && f.answer === "Phường 9") && !f42.some((f) => f.answer === "Phường 4") && !f42.some((f) => /không phải|sai rồi/.test(f.answer ?? "")) &&
      r.body.replies.length === 1 && /^Dạ em sửa lại Phường 9 rồi ạ\. /.test(r.body.replies[0]) && !/cập nhật lại/.test(r.body.replies[0]) &&
      db().t.info_requests.some((q) => q.question === "vi_tri" && q.status === "pending"),
    JSON.stringify({ f42, rep: r.body.replies }));

  coTinDangHoi("t42-ban", "phuong", { district: "Quận 3", price_raw: "12 tỷ", price_vnd: 12e9, area_m2: 70 });
  r = await send({ external_user_id: "t42-ban", text: "hỏi gì hỏi lắm vậy em, anh bận" });
  check("T42-12 'hỏi gì hỏi lắm vậy em, anh bận' → KHÔNG ghi gì, xin lỗi, KHÔNG hỏi thêm, gọi 'anh', câu phường vẫn treo",
    db().t.listing_facts.length === 0 && r.body.replies.length === 1 && /xin lỗi/i.test(r.body.replies[0]) && /anh rảnh/.test(r.body.replies[0]) && !/\?/.test(r.body.replies[0]) &&
      db().t.info_requests.some((q) => q.question === "phuong" && q.status === "pending") && db().t.sellers.find((x) => x.zalo_user_id === "t42-ban")?.xung_ho === "anh",
    JSON.stringify({ rep: r.body.replies, f: db().t.listing_facts, s: db().t.sellers }));

  coTinDangHoi("t42-vo", "vi_tri", { ward: "Phường 2", district: "Quận 4" });
  r = await send({ external_user_id: "t42-vo", text: "để anh hỏi vợ đã em" });
  check("T42-12b 'để anh hỏi vợ đã em' → không ghi 'thông tin bổ sung', bảo thong thả, không hỏi", db().t.listing_facts.length === 0 && /thong thả/.test(r.body.replies[0] ?? "") && !/\?/.test(r.body.replies[0] ?? ""), JSON.stringify({ rep: r.body.replies, f: db().t.listing_facts }));

  coTinDangHoi("t42-4m", "vi_tri", { ward: "Phường 2", district: "Quận 6" });
  r = await send({ external_user_id: "t42-4m", text: "4m" });
  check("T42-13 '4m' khi đang hỏi địa chỉ → hỏi rõ hẻm hay ngang, KHÔNG ghi 'bo_sung', KHÔNG nói đã ghi", /4m là hẻm trước nhà hay ngang mặt tiền/.test(r.body.replies[0] ?? "") && !db().t.listing_facts.some((f) => f.question === "bo_sung") && !/ghi nhận|em ghi/.test(r.body.replies[0] ?? ""), JSON.stringify({ rep: r.body.replies, f: db().t.listing_facts }));

  ({ rr, LL } = await raoMoi("t42-14", "e oi a can ban nha o q8 nha 3 lau 4x12 gia 4t2 nhe"));
  check("T42-14 khách tự xưng 'a' → hồ sơ gọi 'anh'; giá lóng '4t2' được cắt", db().t.sellers.find((x) => x.zalo_user_id === "t42-14")?.xung_ho === "anh" && /^4t2/.test(LL[0]?.price_raw ?? ""), JSON.stringify({ s: db().t.sellers, L: LL[0] }));

  fresh();
  r = await send({ external_user_id: "t42-15", text: "alo em" });
  check("T42-15 'alo em' là lời chào, KHÔNG phải đòi gọi điện", r.body.voice_request !== true, JSON.stringify(r.body));

  // 11/09 chiều (Zalo thật, dự án ehome 3): chủ nhà sửa LOẠI + nói địa chỉ trong một câu dặn.
  coTinDangHoi("t42-eh", "vi_tri", {});
  r = await send({ external_user_id: "t42-eh", text: "Bạn phải ghi dự án chung cư ehome 3 chứ ở hồ ngọc lãm" });
  f42 = db().t.listing_facts;
  check("T42-16 'Bạn phải ghi dự án chung cư ehome 3 chứ ở hồ ngọc lãm' → ghi LOẠI chung cư, vị trí chỉ 'hồ ngọc lãm' (không nguyên câu), báo đã sửa loại",
    f42.some((f) => f.question === "loai_bds" && /chung cư/.test(f.answer ?? "")) && f42.some((f) => f.question === "vi_tri" && f.answer === "hồ ngọc lãm") &&
      !f42.some((f) => /phải ghi/.test(f.answer ?? "")) && /sửa lại loại chung cư/.test(r.body.replies[0] ?? ""),
    JSON.stringify({ f42, rep: r.body.replies }));
  coTinDangHoi("t42-p6", "phuong", {});
  r = await send({ external_user_id: "t42-p6", text: "Đường hồ ngọc lãm quận 8 phường 6" });
  f42 = db().t.listing_facts;
  check("T42-17 trả lời câu phường bằng cả địa chỉ → fact phường là 'Phường 6', vị trí 'Đường hồ ngọc lãm …'",
    f42.some((f) => f.question === "phuong" && f.answer === "Phường 6") && f42.some((f) => f.question === "vi_tri" && /^Đường hồ ngọc lãm/.test(f.answer ?? "")),
    JSON.stringify(f42));

  // 11/09 chiều (Zalo thật): "sao cái nào cũng ghi Q5 hết vậy" — câu rao không nói quận.
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "day_du" };
  ({ rr, LL } = await raoMoi("t42-q5", "bán nhà hẻm 12 Hồ Ngọc Lãm 50m2 3 tỷ"));
  const r1q = createCalls().map((c) => (c.params.messages ?? []).map((m) => typeof m.content === "string" ? m.content : "").join("\n")).find((s) => /Chủ nhà vừa nhắn rao/.test(s)) ?? "";
  check("T42-18 rao KHÔNG nói quận → boc_tach đánh dấu quận mặc định, câu hỏi đầu hỏi KÈM quận, 🤖 nói 'chưa rõ quận', 📝 không tự nhận Quận 5",
    LL[0]?.boc_tach?.quan_mac_dinh === true && !("quan" in (LL[0]?.boc_tach ?? {})) && /phường và quận|phường mấy, quận nào/.test(r1q) &&
      /^🤖 Bóc tách được: .*\(chưa rõ quận\)/.test(rr.body.replies[0] ?? "") && LL[0]?.district == null && !rr.body.replies.some((x) => /Quận 5/.test(x)),
    JSON.stringify({ bt: LL[0]?.boc_tach, rep: rr.body.replies, r1q: r1q.slice(0, 400) }));
  r = await send({ external_user_id: "t42-q5", text: "quận 8 phường 6 em" });
  const Lq5 = db().t.listings.find((l) => l.id === LL[0]?.id);
  check("T42-19 lượt sau nói 'quận 8' → cột Quận 8, bỏ dấu mặc định, 🤖 hết 'chưa rõ quận'",
    Lq5?.district === "Quận 8" && Lq5?.boc_tach?.quan_mac_dinh === false && !/chưa rõ quận/.test(r.body.replies.at(-1) ?? ""),
    JSON.stringify({ L: Lq5, rep: r.body.replies }));
  ({ rr, LL } = await raoMoi("t42-q5b", "bán nhà hẻm 12 Nguyễn Trãi 50m2 3 tỷ"));
  r = await send({ external_user_id: "t42-q5b", text: "quận 5 phường 3 nha" });
  const Lq5b = db().t.listings.find((l) => l.id === LL[0]?.id);
  check("T42-20 chủ nhà xác nhận ĐÚNG Quận 5 → giữ cột, bỏ dấu mặc định", Lq5b?.district === "Quận 5" && Lq5b?.boc_tach?.quan_mac_dinh === false, JSON.stringify(Lq5b));
  globalThis.__cauHinh = { test_reset_hello: "1" };
}

// ── 11/09: TÌM NHÀ GẦN MỐC — model hiểu NGHĨA, SQL đo khoảng cách ─────────────
// Người dùng: "tìm nhà gần bệnh viện cách 1 km" → rồi "không phải là gần bệnh
// viện 1 câu mà nó phải hiểu nghĩa". Lượt model `boc-gan` đọc ý, `tin_gan_moc`
// (giả ở đây) trả căn + mốc + mét, KHO chỉ còn căn gần.
{
  const GAN = (o = {}) => ({ muon_gan: true, loai: "benh_vien", ten: null, cap_truong: null, ban_kinh_m: null, bo_dieu_kien: false, ...o });
  const hoSo = (id) => db().t.buyers.find((b) => b.zalo_user_id === id)?.preferences ?? {};
  let goiMoc = [];
  const mocGia = (tin = [{ listing_id: "x", code: "BDS-Q5-0004", moc: "Bệnh viện Triều An", khoang_cach_m: 620 }]) => ({
    tin_gan_moc: (_d, a) => { goiMoc.push(a); return { data: tin, error: null }; },
    co_moc: () => ({ data: true, error: null }),
  });
  const vaoHoSo = async (id) => {
    globalThis.__model.parse = (p) => laLuotGan(p) ? GAN() : OUT({ profile: { ...OUT().profile, deal: "ban", budget: "tầm 7 tỷ" } });
    await send({ external_user_id: id, text: "mua nhà tầm 7 tỷ" });
  };

  fresh(seedKho); goiMoc = []; globalThis.__rpc = mocGia();
  await vaoHoSo("gan-1");
  globalThis.__model.parse = (p) => laLuotGan(p) ? GAN() : OUT();
  r = await send({ external_user_id: "gan-1", text: "chỗ nào tiện đi khám bệnh không em" });
  const stG1 = sysText(parseCalls().pop());
  check("GAN-01 câu nói vòng 'tiện đi khám bệnh' → model đọc ra bệnh viện, tìm trong ~1 km, đúng deal",
    goiMoc.length === 1 && goiMoc[0].p_loai === "benh_vien" && goiMoc[0].p_ban_kinh_m === 1000 && goiMoc[0].p_deal === "ban", JSON.stringify(goiMoc));
  check("GAN-02 KHO chỉ còn căn gần, dòng căn kèm 'cách <mốc> khoảng 600 m' (làm tròn), có lời dặn 'nói khoảng'",
    /BDS-Q5-0004[^\n]*cách Bệnh viện Triều An khoảng 600 m/.test(stG1) && !/BDS-Q5-0001/.test(stG1) && /Đã lọc theo ý khách muốn ở gần bệnh viện, trong ~1 km/.test(stG1),
    stG1.slice(0, 900));
  check("GAN-03 hồ sơ lưu điều kiện (nhãn + bản có cấu trúc) để lượt sau lọc tiếp",
    hoSo("gan-1").gan_tien_ich === "bệnh viện, trong ~1 km" && hoSo("gan-1").gan_tien_ich_loc?.loai === "benh_vien", JSON.stringify(hoSo("gan-1")));
  globalThis.__model.parse = () => OUT();
  goiMoc = [];
  const soGoiTruoc = globalThis.__calls.length;
  r = await send({ external_user_id: "gan-1", text: "có căn nào 2 phòng ngủ không" });
  check("GAN-04 lượt sau không nhắc lại vẫn lọc theo điều kiện đã lưu (không gọi thêm model đọc vị trí)",
    goiMoc.length === 1 && !globalThis.__calls.slice(soGoiTruoc).some((c) => laLuotGan(c.params)), JSON.stringify(goiMoc));

  // Câu HỎI về một căn ("căn đó gần chợ không") không phải điều kiện tìm — regex
  // sẽ bắt nhầm "gần chợ", model thì không. Model trả lời được → tin model.
  fresh(seedKho); goiMoc = []; globalThis.__rpc = mocGia();
  await vaoHoSo("gan-2");
  globalThis.__model.parse = (p) => laLuotGan(p) ? GAN({ muon_gan: false, loai: null }) : OUT();
  r = await send({ external_user_id: "gan-2", text: "căn BDS-Q5-0004 gần chợ không em" });
  check("GAN-05 hỏi 'căn đó gần chợ không' → KHÔNG thành bộ lọc, hồ sơ không ghi điều kiện",
    goiMoc.length === 0 && !hoSo("gan-2").gan_tien_ich, JSON.stringify({ goiMoc, p: hoSo("gan-2") }));

  // Model hỏng → regex dự phòng vẫn bắt "gần bệnh viện 2km".
  fresh(seedKho); goiMoc = []; globalThis.__rpc = mocGia();
  await vaoHoSo("gan-3");
  globalThis.__model.parse = (p) => { if (laLuotGan(p)) throw new Error("model chết"); return OUT(); };
  r = await send({ external_user_id: "gan-3", text: "tìm căn gần bệnh viện trong vòng 2km" });
  check("GAN-06 model đọc vị trí hỏng → regex: bệnh viện, 2000 m", goiMoc[0]?.p_loai === "benh_vien" && goiMoc[0]?.p_ban_kinh_m === 2000, JSON.stringify(goiMoc));
  // Gỡ điều kiện.
  globalThis.__model.parse = (p) => laLuotGan(p) ? GAN({ muon_gan: false, loai: null, bo_dieu_kien: true }) : OUT();
  goiMoc = [];
  r = await send({ external_user_id: "gan-3", text: "thôi khỏi cần gần bệnh viện nữa em" });
  check("GAN-07 'thôi khỏi cần gần bệnh viện' → gỡ khỏi hồ sơ, không lọc nữa",
    goiMoc.length === 0 && hoSo("gan-3").gan_tien_ich == null && hoSo("gan-3").gan_tien_ich_loc == null, JSON.stringify({ goiMoc, p: hoSo("gan-3") }));

  // 14/09/2026: hồ sơ CHƯA có giá → lượt đọc "gần đâu" chạy song song với model
  // chính (không chặn trước) — vẫn phải có đủ hai lượt và hồ sơ vẫn lưu điều kiện.
  fresh(seedKho); goiMoc = []; globalThis.__rpc = mocGia();
  globalThis.__model.parse = (p) => laLuotGan(p) ? GAN() : OUT();
  r = await send({ external_user_id: "gan-song-song", text: "tìm nhà gần bệnh viện cho mẹ em" });
  check("GAN-SONGSONG hồ sơ chưa có giá: đọc 'gần đâu' song song, hồ sơ vẫn lưu điều kiện, không lọc kho theo mốc lượt này",
    parseCalls().length >= 1 && globalThis.__calls.some((c) => c.kind === "parse" && laLuotGan(c.params)) &&
      /bệnh viện/.test(hoSo("gan-song-song").gan_tien_ich ?? "") && hoSo("gan-song-song").gan_tien_ich_loc?.loai === "benh_vien" && goiMoc.length === 0,
    JSON.stringify({ p: hoSo("gan-song-song"), goiMoc }));

  // RPC hỏng → bỏ lọc (kho vẫn đủ căn), không để khách thấy kho trống vì lỗi phía mình.
  fresh(seedKho); goiMoc = [];
  globalThis.__rpc = { tin_gan_moc: (_d, a) => { goiMoc.push(a); return { data: null, error: { message: "timeout" } }; } };
  await vaoHoSo("gan-4");
  globalThis.__model.parse = (p) => laLuotGan(p) ? GAN({ loai: "du_an", ten: "Ehome 3" }) : OUT();
  r = await send({ external_user_id: "gan-4", text: "có nhà nào quanh Ehome 3 không" });
  const stG4 = sysText(parseCalls().pop());
  check("GAN-08 tin_gan_moc hỏng → KHO không lọc (còn BDS-Q5-0001), không có dòng 'Đã lọc'",
    goiMoc.length === 1 && goiMoc[0].p_loai === "du_an" && goiMoc[0].p_ten_re === "ehome 3" && /BDS-Q5-0001/.test(stG4) && !/Đã lọc theo ý khách/.test(stG4),
    JSON.stringify({ goiMoc, st: stG4.slice(0, 400) }));

  // Mốc có trong kho nhưng không căn nào đủ gần → nói thật, gợi ý nới bán kính.
  fresh(seedKho); goiMoc = []; globalThis.__rpc = mocGia([]);
  await vaoHoSo("gan-5");
  globalThis.__model.parse = (p) => laLuotGan(p) ? GAN({ loai: "sieu_thi", ten: "Aeon Bình Tân", ban_kinh_m: 500 }) : OUT();
  r = await send({ external_user_id: "gan-5", text: "muốn đi bộ ra Aeon Bình Tân được" });
  const stG5 = sysText(parseCalls().pop());
  check("GAN-09 không căn nào trong 500 m quanh Aeon Bình Tân → KHO trống + dặn nói thật, gợi ý nới bán kính",
    goiMoc[0]?.p_ten_re === "aeon binh tan" && goiMoc[0]?.p_ban_kinh_m === 500 && !/BDS-Q5-000[145]/.test(stG5) && /Không có căn nào đã định vị trong bán kính này/.test(stG5),
    JSON.stringify({ goiMoc, st: stG5.slice(0, 500) }));
}

// ── 11/09: FR-205 — PHÂN VAI BẰNG MODEL khi luật không kết luận được ─────────
{
  globalThis.__cauHinh = { test_reset_hello: "1" }; // 🤖 tắt: đo đúng đường đi
  const VAI = (o = {}) => ({ vai: "chua_ro", bang_chung: "", ...o });
  const luotVai = () => globalThis.__calls.filter((c) => c.kind === "parse" && laLuotVai(c.params));
  const macDinh = (vai) => (p) => laLuotVai(p) ? vai : laLuotAnh(p) ? ANH() : OUT();
  const CAU_BAN = "Gia đình cần tiền nên để lại căn nhà 4x16 hẻm xe hơi Trần Hưng Đạo q5, sổ hồng riêng";
  const CAU_MUA = "nhà 4x16 hẻm xe hơi quận 5 tầm 6 tỷ, mẹ già nên cần gần bệnh viện";
  const CAU_MO = "cho em hỏi về căn nhà ở hẻm Trần Hưng Đạo";

  fresh(); globalThis.__model.parse = macDinh(VAI({ vai: "ban", bang_chung: "để lại căn nhà 4x16" }));
  r = await send({ external_user_id: "vai-1", text: CAU_BAN });
  check("VAI-01 rao KHÔNG chữ 'bán', luật bỏ sót → model 'ban' → mở hồ sơ bán, đi nhánh bán, không chào khuôn",
    luotVai().length === 1 && !r.body.hoi_vai && db().t.sellers.length === 1 && r.body.role === "seller",
    JSON.stringify({ b: r.body, s: db().t.sellers.length, l: db().t.listings.length, v: luotVai().length }));

  fresh(); globalThis.__model.parse = macDinh(VAI({ vai: "mua", bang_chung: "cần gần bệnh viện" }));
  r = await send({ external_user_id: "vai-2", text: CAU_MUA });
  check("VAI-02 người mua kể nhu cầu, không có chữ 'tìm/mua' → model 'mua' → thẳng hàng mua, không chào khuôn, không mở hồ sơ bán",
    luotVai().length === 1 && !r.body.hoi_vai && db().t.sellers.length === 0 && parseMua().length === 1,
    JSON.stringify({ b: r.body, v: luotVai().length, m: parseMua().length }));

  fresh(); globalThis.__model.parse = macDinh(VAI());
  r = await send({ external_user_id: "vai-3", text: CAU_MO });
  check("VAI-03 model 'chua_ro' → hỏi vai như cũ", luotVai().length === 1 && r.body.hoi_vai === true && db().t.sellers.length === 0, JSON.stringify(r.body));

  fresh(); globalThis.__model.parse = macDinh(VAI({ vai: "ban", bang_chung: "chủ cần bán gấp" }));
  r = await send({ external_user_id: "vai-4", text: CAU_MO });
  check("VAI-04 model 'ban' mà cụm làm bằng KHÔNG có trong câu → không tin: hỏi vai, không mở hồ sơ bán",
    r.body.hoi_vai === true && db().t.sellers.length === 0, JSON.stringify(r.body));

  fresh(); globalThis.__model.parse = (p) => { if (laLuotVai(p)) throw new Error("model chết"); return OUT(); };
  r = await send({ external_user_id: "vai-5", text: CAU_BAN });
  check("VAI-05 model phân vai hỏng → như cũ: 200, hỏi vai, không mở hồ sơ bán", r.status === 200 && r.body.hoi_vai === true && db().t.sellers.length === 0, JSON.stringify(r.body));

  fresh(); globalThis.__model.parse = macDinh(VAI({ vai: "ban", bang_chung: "chào em" }));
  await send({ external_user_id: "vai-6a", text: "chào em" });
  await send({ external_user_id: "vai-6b", text: "bán nhà q5 giá 5 tỷ" });
  await send({ external_user_id: "vai-6c", text: "tìm nhà quận 5 tầm 5 tỷ" });
  check("VAI-06 câu chào / câu luật đã rõ bán / câu luật đã rõ mua → KHÔNG tốn lượt model phân vai", luotVai().length === 0, String(luotVai().length));
  delete globalThis.__cauHinh;
}

// ── 13/09: VAN SAU LỜI MODEL (lượt bắn 20 tin thật 12/09) — kho trống không hứa
// có hàng, khách mua tự xưng thì gọi đúng, ghi chú hoàn cảnh không lặp ────────
{
  const userText = (c) => c.params.messages[0].content.map((x) => x.text ?? "").join("");
  fresh();
  globalThis.__model.parse = () => OUT({ replies: ["Dạ có em. Anh cần mấy phòng ngủ ạ?"] });
  r = await send({ external_user_id: "kho-1", text: "có căn nào quận 10 tầm 5 tỷ không em" });
  check("KHO-01 kho trống, model đáp 'Dạ có em.' → bỏ câu hứa, nói lọc kho/chưa có, câu hỏi còn nguyên",
    !r.body.replies.some((t) => /Dạ có em/.test(t)) && r.body.replies.some((t) => /(lọc kho|chưa có căn)/.test(t) && /mấy phòng ngủ/.test(t)),
    JSON.stringify(r.body.replies));
  check("KHO-01b chưa biết nam/nữ → câu lệnh dặn gọi 'anh/chị', không tự đoán",
    /CÁCH GỌI KHÁCH: chưa biết nam hay nữ/.test(userText(parseCalls().pop())), userText(parseCalls().pop()).slice(0, 200));

  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, area: "quận 5", budget: "tầm 7 tỷ", notes: "mẹ già ở cùng" }, replies: ["Dạ chị cần mấy phòng ngủ ạ?"] });
  r = await send({ external_user_id: "kho-2", text: "chị đang tìm mua nhà quận 5 tầm 7 tỷ, nhà có mẹ già" });
  const hs2 = () => db().t.buyers.find((b) => b.zalo_user_id === "kho-2")?.preferences ?? {};
  check("XH-MUA-01 'chị đang tìm mua' → hồ sơ xung_ho = chị", hs2().xung_ho === "chị", JSON.stringify(hs2()));
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, notes: "mẹ già ở cùng; muốn gần bệnh viện" }, replies: ["Dạ được chị. Em đang có vài căn 3 phòng, hẻm xe hơi tầm 7 tỷ. Để em xem xem căn nào phù hợp nhất với chị nhé."] });
  r = await send({ external_user_id: "kho-2", text: "3 phòng ngủ em, hẻm xe hơi, gần bệnh viện" });
  check("XH-MUA-02 lượt sau câu lệnh mang 'CÁCH GỌI KHÁCH: \"chị\"'", /CÁCH GỌI KHÁCH: "chị"/.test(userText(parseCalls().pop())), userText(parseCalls().pop()).slice(0, 200));
  check("KHO-02 đủ khu vực + giá mà kho trống, model 'em đang có vài căn…' → 'chưa có căn nào khớp', giữ 'Dạ được chị.'",
    r.body.replies.length === 1 && /^Dạ được chị\. Hiện bên em chưa có căn nào khớp/.test(r.body.replies[0]) && !/vài căn|căn nào phù hợp/.test(r.body.replies[0]),
    JSON.stringify(r.body.replies));
  check("NOTES-01 model trả lại cả ghi chú cũ → hồ sơ không lặp 'mẹ già ở cùng'",
    hs2().notes === "mẹ già ở cùng; muốn gần bệnh viện", JSON.stringify(hs2().notes));

  fresh(seedKho);
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "ban", area: "phường 4", budget: "tầm 5 tỷ 8" } });
  await send({ external_user_id: "kho-3", text: "tôi muốn mua nhà phường 4 tầm 5 tỷ 8" });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ có căn #BDS-Q5-0001 hợp anh nè"] });
  r = await send({ external_user_id: "kho-3", text: "có căn nào không em" });
  // 23/09/2026 (FR-178 a): mã tin model viết cho khách được thay bằng tên đường của căn; căn vẫn ghi quan tâm.
  check("KHO-03 kho CÓ căn → van không đụng lời model (chỉ mã tin '#BDS-Q5-0001' thành 'Trần Hưng Đạo'); căn vẫn vào interests",
    r.body.replies.some((t) => /căn Trần Hưng Đạo hợp anh/.test(t)) && !r.body.replies.some((t) => /BDS-|chưa có căn|lọc kho/.test(t)) &&
      db().t.interests.some((i) => i.listing_id === db().t.listings.find((l) => l.code === "BDS-Q5-0001")?.id), JSON.stringify(r.body.replies));
  // 13/09 lượt bắn thứ hai: "em là người hay máy vậy" → model nhận là người thật.
  fresh();
  globalThis.__model.parse = () => OUT({ replies: ["Dạ em là M•ai bên AI Ơi Nhà Đất ạ. Em là người thật, không phải máy đâu anh/chị. Mình đang tìm mua hay thuê nhà ạ?"] });
  r = await send({ external_user_id: "nguoi-1", text: "tôi muốn tìm nhà, mà em là người hay máy vậy" });
  check("NGUOI-01 model nhận là người thật → câu đó bị thay bằng 'trợ lý AI', giữ câu hỏi quay lại việc",
    !r.body.replies.some((t) => /người thật, không phải máy/.test(t)) && r.body.replies.some((t) => /trợ lý AI/.test(t) && /tìm mua hay thuê/.test(t)),
    JSON.stringify(r.body.replies));
}

// ── 14/09: tin CHO THUÊ hỏi câu gấp của tin thuê, không phải "ra hàng gấp hay được giá" ─
{
  globalThis.__cauHinh = { test_reset_hello: "1" };
  const thue = (d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-gapthue", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-CH-Q7-0009", seller_id: s.id, deal: "cho_thue", status: "cho_thong_tin", property_type: "chung_cu", location_raw: "Sunrise City", ward: "Phường Tân Hưng", district: "Quận 7", price_raw: "18 triệu/tháng", price_vnd: 18e6, area_m2: 76, can_chu_duyet: true }).data;
    d.insert("info_requests", { listing_id: l.id, question: "gap", status: "pending" });
    return l;
  };
  fresh(thue);
  globalThis.__model.parse = () => { throw new Error("model chết"); };
  globalThis.__model.create = () => { throw new Error("model chết"); };
  r = await send({ external_user_id: "z-gapthue", text: "ok em" });
  const tatCa = JSON.stringify(r.body.replies);
  check("GAPTHUE-01 tin cho thuê đang treo câu gấp, hỏi lại → câu của tin THUÊ, không 'ra hàng gấp hay được giá'",
    /cho thuê gấp hay chờ được khách/.test(tatCa) && !/ra hàng gấp/.test(tatCa), tatCa);
  fresh((d) => { const l = thue(d); l.deal = "ban"; });
  globalThis.__model.parse = () => { throw new Error("model chết"); };
  globalThis.__model.create = () => { throw new Error("model chết"); };
  r = await send({ external_user_id: "z-gapthue", text: "ok em" });
  check("GAPTHUE-02 tin BÁN vẫn câu cũ 'ra hàng gấp hay được giá'", /ra hàng gấp/.test(JSON.stringify(r.body.replies)), JSON.stringify(r.body.replies));
  delete globalThis.__cauHinh;
}

// ── 14/09: nhánh mua KHÔNG còn structured output (chậm gấp đôi) — đọc JSON từ chữ ──
{
  fresh(seedKho);
  const jsonDu = JSON.stringify({ ...OUT({ replies: ["Dạ chị xem thử căn Hải Thượng Lãn Ông 4 tỷ nha"] }), profile: { ...OUT().profile, area: "quận 5", budget: "tầm 7 tỷ" }, voice_request: false });
  globalThis.__model.parseChu = () => "Đây là JSON:\n" + jsonDu + "\n";
  r = await send({ external_user_id: "json-chu-1", text: "tìm nhà quận 5 tầm 7 tỷ" });
  const cMua = parseCalls().at(-1);
  check("JSONCHU-01 model trả CHỮ có JSON (kèm chữ thừa) → đọc đúng câu trả lời và hồ sơ",
    r.body.replies.some((x) => x === "Dạ chị xem thử căn Hải Thượng Lãn Ông 4 tỷ nha") && db().t.buyers.find((b) => b.zalo_user_id === "json-chu-1")?.preferences?.budget === "tầm 7 tỷ",
    JSON.stringify({ rep: r.body.replies, p: db().t.buyers.find((b) => b.zalo_user_id === "json-chu-1")?.preferences }));
  check("JSONCHU-02 lượt gọi tới Anthropic không có output_config.format, không lọt _khuon_du_phong (lớp lọc gỡ); khối nhớ tạm có ĐẦU RA + JSON Schema",
    !cMua.params.output_config?.format && /ĐẦU RA: trả về DUY NHẤT một object JSON/.test(cMua.params.system[0].text) && /"voice_request"/.test(cMua.params.system[0].text) && !("_khuon_du_phong" in cMua.params),
    JSON.stringify({ oc: cMua.params.output_config, co: !!cMua.params._khuon_du_phong }));
  fresh(seedKho);
  globalThis.__model.parseChu = () => "{ hỏng mất rồi";
  r = await send({ external_user_id: "json-chu-2", text: "tìm nhà quận 5 tầm 7 tỷ" });
  check("JSONCHU-03 chữ không phải JSON hợp lệ → rơi về đường dự phòng (vẫn trả lời) + ghi sổ 'chat-reply model JSON hong'",
    r.status === 200 && r.body.replies.length > 0 && db().t.bot_errors.some((e) => /model JSON hong/.test(e.source ?? "")),
    JSON.stringify({ rep: r.body.replies, err: (db().t.bot_errors ?? []).map((e) => e.source) }));
  delete globalThis.__model.parseChu;
}

// ── 14/09: lượt đầu khách nói đủ khu vực + giá → câu lệnh NGỪNG dò hồ sơ ngay lượt đó ─
{
  const vaoMua = (c) => (c.params.messages ?? []).map((m) => (Array.isArray(m.content) ? m.content.map((x) => x.text ?? "").join("") : m.content)).join("\n");
  fresh(seedKho);
  await send({ external_user_id: "du-tc-1", text: "tìm nhà quận 5 tầm 6 tỷ" });
  const u1 = vaoMua(parseCalls().at(-1));
  check("DUTIEUCHI-01 lượt đầu 'tìm nhà quận 5 tầm 6 tỷ' (hồ sơ còn trống) → câu lệnh 'CHƯA BIẾT … không hỏi chủ động', không 'CÒN THIẾU'",
    /CHƯA BIẾT \(chỉ NHẶT/.test(u1) && !/CÒN THIẾU \(hỏi theo thứ tự/.test(u1) && /NGỪNG hỏi (?:các trường )?hồ sơ/.test(u1), u1.slice(0, 400));
  fresh(seedKho);
  await send({ external_user_id: "du-tc-2", text: "tìm nhà quận 5 cho gia đình" });
  const u2 = vaoMua(parseCalls().at(-1));
  check("DUTIEUCHI-02 chưa nói giá → vẫn 'CÒN THIẾU' (được hỏi khoảng giá)", /CÒN THIẾU \(hỏi theo thứ tự/.test(u2), u2.slice(0, 400));
}

// ── 14/09 bắn lần 3: model vẫn dò "để ở hay đầu tư" dù câu dặn cấm → bỏ câu đó bằng code ──
{
  fresh(seedKho);
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "ban", area: "Quận 6", budget: "4 tỷ" },
    replies: ["Dạ em tìm căn tầm 4 tỷ ở Quận 6 cho anh nhé. Anh tìm nhà hẻm hay mặt tiền, để ở hay đầu tư ạ?"] });
  let r1 = await send({ external_user_id: "md-1", text: "anh có 2 tỷ, vay thêm được không để mua nhà 4 tỷ quận 6" });
  // 23/09/2026: "Dạ em tìm căn tầm 4 tỷ ở Quận 6 cho anh nhé" khi kho trống là LỜI HỨA SUÔNG (bắn thật: "em lọc căn 2PN
  // Quận 7 … cho anh nhé" rồi không gửi gì) → thay bằng câu nói thật; câu dò mục đích vẫn bị bỏ.
  check("MUCDICH-01 đủ khu + giá → câu 'để ở hay đầu tư ạ?' bị bỏ; câu hứa 'em tìm căn … cho anh' khi kho trống thành câu nói thật",
    !r1.body.replies.some((t) => /để ở hay đầu tư/.test(t)) && !r1.body.replies.some((t) => /tầm 4 tỷ ở Quận 6 cho anh/.test(t)) && r1.body.replies.some((t) => /chưa có căn nào khớp/.test(t)), JSON.stringify(r1.body.replies));
  fresh(seedKho);
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "thue" },
    replies: ["Dạ em lọc căn hộ cho mình nha.", "Mình cần căn hộ để ở hay để cho thuê lại vậy ạ?"] });
  r1 = await send({ external_user_id: "md-2", text: "tìm thuê căn hộ 2 phòng ngủ" });
  check("MUCDICH-02 khách THUÊ (chưa đủ tiêu chí) → vẫn bỏ câu dò mục đích",
    !r1.body.replies.some((t) => /để ở hay/.test(t)), JSON.stringify(r1.body.replies));
  // 23/09/2026 (bắn thật, người thuê Q7, kho trống): "Dạ em lọc căn 2PN Quận 7 quanh 15 triệu cho anh nhé :)" rồi không gửi gì.
  fresh(seedKho);
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "thue", area: "Quận 7", budget: "15 triệu", bedrooms: 2 },
    replies: ["Dạ em lọc căn 2PN Quận 7 quanh 15 triệu cho anh nhé :)"] });
  r1 = await send({ external_user_id: "hua-loc", text: "anh cần thuê căn hộ 2 phòng ngủ quận 7 tầm 15 triệu, dọn vào tháng sau" });
  check("HUA-LOC-01 người thuê, kho trống, model hứa 'em lọc căn … cho anh nhé' → bỏ lời hứa, nói thật chưa có căn",
    !r1.body.replies.some((t) => /lọc căn 2PN/.test(t)) && r1.body.replies.some((t) => /chưa có căn|cho em xin thêm/.test(t)), JSON.stringify(r1.body.replies));
  fresh(seedKho);
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "ban" },
    replies: ["Dạ mình tìm ở khu nào, tầm giá bao nhiêu, để ở hay đầu tư ạ?"] });
  r1 = await send({ external_user_id: "md-3", text: "mua qua bên em có mất phí gì không" });
  check("MUCDICH-03 người MUA chưa nói khu/giá → câu hỏi giữ nguyên (được dò)",
    r1.body.replies.some((t) => /để ở hay đầu tư/.test(t)), JSON.stringify(r1.body.replies));
}

// ── 14/09 bắn lại 14 tin bán: rao TRÙNG căn đã có (project_id + unit_code) → tin mất trắng ──
{
  fresh((d) => {
    const pj = d.insert("projects", { name: "Vinhomes Grand Park", developer: "Vinhomes", district: "TP Thủ Đức" }).data;
    const s0 = d.insert("sellers", { zalo_user_id: "z-cu", seller_type: "nmg", name: "Sale B", active_listing_id: null }).data;
    d.insert("listings", { code: "BDS-CH-THUDUC-0001", seller_id: s0.id, deal: "ban", status: "cho_thong_tin", property_type: "chung_cu", project_id: pj.id, unit_code: "S1.02", price_raw: "3 tỷ 1", price_vnd: 3.1e9, can_chu_duyet: true });
  });
  globalThis.__rpc.match_projects = (_d, a) => ({ data: /vinhomes/i.test(a.p_text) ? db().t.projects : [], error: null });
  r = await send({ external_user_id: "trung-can", text: "bán căn hộ Vinhomes Grand Park Thủ Đức, căn S1.02 tầng 12, 69m2 2pn 2wc, sổ hồng, giá 3 tỷ 150" });
  const moi = db().t.listings.filter((l) => l.code !== "BDS-CH-THUDUC-0001");
  check("TRUNGCAN-01 căn S1.02 đã có tin khác → vẫn TẠO tin mới (bỏ mã căn trùng), không rơi câu chào khuôn",
    moi.length === 1 && moi[0].unit_code == null && moi[0].project_id === db().t.projects[0].id && !db().t.bot_errors.some((e) => e.source === "chat-reply tao tin rao"),
    JSON.stringify({ moi, loi: db().t.bot_errors, rep: r.body.replies }));
  delete globalThis.__rpc.match_projects;
}

// ── FR-208: AI bóc tách tin người bán CHẠY BÓNG (TS-AIBOC-02) ──
{
  const laLuotBocRao = (p) => (p?.system ?? []).some((s) => /BÓC TÁCH TIN NHẮN NGƯỜI BÁN/.test(s.text ?? ""));
  const RAO_MT = "bán nhà mặt tiền đường Châu Văn Liêm phường 14 quận 5, ngang 4.2m dài 18m, đang cho thuê 45 triệu/tháng, giá 32 tỷ còn thương lượng";
  const DE_XUAT = {
    so_can: 1, kien_thuc: [],
    truong: [
      { khoa: "gia", gia_tri: "32 tỷ", trich_dan: "giá 32 tỷ", can: null },
      { khoa: "gia", gia_tri: "45 triệu", trich_dan: "45 triệu/tháng", can: null },
      { khoa: "quan", gia_tri: "Quận 5", trich_dan: "quận 5", can: null },
      { khoa: "huong", gia_tri: "Đông Nam", trich_dan: "hướng Đông Nam", can: null },
    ],
  };
  const macDinh = globalThis.__model?.parse;

  fresh(seedKho);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "bong" };
  globalThis.__model.parse = (p) => laLuotBocRao(p) ? DE_XUAT : OUT();
  r = await send({ external_user_id: "aiboc-1", text: RAO_MT });
  const tinAi = db().t.listings.at(-1);
  const bong = db().rows("boc_tach_bong");
  check("AIBOC-01 bật 'bong': một dòng boc_tach_bong — 2 đạt (giá 32 tỷ, quận 5), 2 bỏ (tiền thuê làm giá, hướng bịa), so với DB: giá + quận trung",
    bong.length === 1 && bong[0].dat.length === 2 && bong[0].bo.map((b) => b.ly_do).sort().join() === "tien_thue_khong_phai_gia_ban,trich_dan_khong_co_trong_tin" &&
      bong[0].so_sanh.trung.includes("gia") && bong[0].so_sanh.trung.includes("quan") && bong[0].listing_id === tinAi.id,
    JSON.stringify({ bong, tin: tinAi }));
  check("AIBOC-01b chạy bóng KHÔNG đổi tin rao: giá vẫn do luật (32 tỷ), không cột nào mang 'Đông Nam'; khách vẫn nhận lời đáp",
    tinAi.price_vnd === 32e9 && !JSON.stringify(tinAi).includes("Đông Nam") && r.body.replies.length > 0, JSON.stringify(tinAi));

  fresh(seedKho);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "tat" };
  globalThis.__model.parse = (p) => laLuotBocRao(p) ? DE_XUAT : OUT();
  r = await send({ external_user_id: "aiboc-2", text: RAO_MT });
  check("AIBOC-02 công tắc 'tat' → không gọi model bóc, không dòng bóng",
    !globalThis.__calls.some((c) => laLuotBocRao(c.params)) && db().rows("boc_tach_bong").length === 0);

  fresh(seedKho);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "bong" };
  globalThis.__model.parse = (p) => { if (laLuotBocRao(p)) throw new Error("model bóc chết"); return OUT(); };
  r = await send({ external_user_id: "aiboc-3", text: RAO_MT });
  check("AIBOC-03 model bóc ném lỗi → tin vẫn tạo, khách vẫn được trả lời, lỗi vào sổ",
    db().t.listings.at(-1)?.price_vnd === 32e9 && r.body.replies.length > 0 && db().t.bot_errors.some((e) => e.source === "chat-reply boc_tach_ai(bong)"),
    JSON.stringify({ loi: db().t.bot_errors, rep: r.body.replies }));

  // FR-208 bước 2 (17/09/2026): chế độ `ghi` — AI GHI CÓ KIỂM (TS-AIBOC-04).
  // Hai ý luật tiền định KHÔNG bắt (đo bằng nhanDienNhieuFact 17/09): hướng không có chữ "hướng", hiện trạng "mới sơn sửa".
  const RAO_GHI = `${RAO_MT}, mặt nhà quay về phía Đông Nam, nhà mới sơn sửa lại`;
  const DE_XUAT_GHI = {
    so_can: 1, kien_thuc: [],
    truong: [
      { khoa: "gia", gia_tri: "32 tỷ", trich_dan: "giá 32 tỷ", can: null },
      { khoa: "huong", gia_tri: "Đông Nam", trich_dan: "quay về phía Đông Nam", can: null },
      { khoa: "hien_trang", gia_tri: "mới sơn sửa lại", trich_dan: "nhà mới sơn sửa lại", can: null },
      { khoa: "phap_ly", gia_tri: "sổ hồng riêng", trich_dan: "sổ hồng riêng", can: null },
    ],
  };
  fresh(seedKho);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ghi", bao_lai_da_luu: "thay_doi" };
  globalThis.__model.parse = (p) => laLuotBocRao(p) ? DE_XUAT_GHI : OUT();
  r = await send({ external_user_id: "aiboc-4", text: RAO_GHI });
  const tinGhi = db().t.listings.at(-1);
  const factAi = db().t.listing_facts.filter((f) => f.listing_id === tinGhi.id && f.source === "ai_kiem");
  const bongGhi = db().rows("boc_tach_bong");
  check("AIBOC-04 bật 'ghi': hướng + hiện trạng (luật không bắt, tin trống) vào listing_facts nguồn ai_kiem; giá (luật đã ghi) không đụng; pháp lý bịa KHÔNG ghi",
    factAi.map((f) => `${f.question}=${f.answer}`).sort().join("|") === "hien_trang=mới sơn sửa lại|huong=Đông Nam" && tinGhi.price_vnd === 32e9 &&
      bongGhi.length === 1 && bongGhi[0].da_ghi?.che_do === "ghi" && bongGhi[0].da_ghi.ghi.length === 2 &&
      bongGhi[0].so_sanh.trung.includes("gia") && bongGhi[0].bo.some((b) => b.khoa === "phap_ly"),
    JSON.stringify({ factAi, tin: tinGhi, bong: bongGhi }));
  const bongAi4 = r.body.replies.filter((x) => x.startsWith("🤖"));
  // 21/09 tối (kiem-tbt): hướng AI đọc đã vào cột → hiện "hướng Đông Nam" ở dòng chính, KHÔNG lặp ở Kèm.
  check("AIBOC-04b (21/09 gộp) khách thấy MỘT bong bóng '🤖 Đã lưu' nêu cả hướng (cột) + hiện trạng AI đọc (Kèm) lẫn thứ luật ghi; không dòng 'AI đọc thêm' riêng; pháp lý bịa không có",
    bongAi4.length === 1 && /^🤖 Bóc tách được/.test(bongAi4[0]) && /hướng Đông Nam/.test(bongAi4[0]) && /hiện trạng nhà: "mới sơn sửa lại"/.test(bongAi4[0]) &&
      !/pháp lý/.test(bongAi4[0]) && !r.body.replies.some((x) => /AI đọc thêm/.test(x)),
    JSON.stringify(r.body.replies));

  fresh(seedKho);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ghi", bao_lai_da_luu: "thay_doi" };
  globalThis.__model.parse = (p) => laLuotBocRao(p) ? DE_XUAT_GHI : OUT();
  r = await send({ external_user_id: "aiboc-5", text: "ok em" });
  check("AIBOC-05 'ghi' nhưng tin không có mùi dữ liệu → không gọi model bóc, không ghi gì",
    !globalThis.__calls.some((c) => laLuotBocRao(c.params)) && db().t.listing_facts.every((f) => f.source !== "ai_kiem"));

  // 17/09/2026 (chủ dự án): AI ĐỌC TRƯỚC, trả kiến thức cho luật lưu; kiến thức thêm vào mô tả.
  fresh(seedKho);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ghi", bao_lai_da_luu: "thay_doi" };
  globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
  r = await send({ external_user_id: "aiboc-6", text: RAO_MT });
  const L6 = db().t.listings.at(-1);
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: L6.id, question: "phap_ly", status: "pending" });
  globalThis.__model.parse = (p) => laLuotBocRao(p)
    ? { so_can: 0, kien_thuc: ["gần chợ Bình Tây", "khu này yên tĩnh lắm", "hàng xóm thân thiện lắm"], truong: [
        { khoa: "phap_ly", gia_tri: "sổ hồng riêng", trich_dan: "shr", can: null },
        { khoa: "hien_trang", gia_tri: "nhà ở từ 2019 rồi", trich_dan: "nhà ở từ 2019 rồi", can: null },
        { khoa: "view", gia_tri: "view sông", trich_dan: "view sông", can: null },
      ] }
    : OUT();
  r = await send({ external_user_id: "aiboc-6", text: "shr, nhà ở từ 2019 rồi, gần chợ Bình Tây, khu này yên tĩnh lắm, hàng xóm thân thiện lắm" });
  const f6 = (q) => db().t.listing_facts.filter((f) => f.listing_id === L6.id && f.question === q);
  check("AIBOC-06 AI đọc trước cho câu treo: 'shr, nhà ở từ 2019 rồi' khi hỏi PHÁP LÝ → luật ghi 'sổ hồng riêng' (AI chuẩn hoá, nguồn seller_chat); hiện trạng ghi một lần (luật bắt kèm, AI không ghi đè); 'view sông' bịa (không có trong tin) KHÔNG ghi",
    f6("phap_ly").length === 1 && f6("phap_ly")[0].answer === "sổ hồng riêng" && f6("phap_ly")[0].source === "seller_chat" &&
      f6("hien_trang").length === 1 && f6("view").length === 0 &&
      db().t.info_requests.some((x) => x.listing_id === L6.id && x.question === "phap_ly" && x.status === "answered"),
    JSON.stringify({ pl: f6("phap_ly").map((f) => [f.answer, f.source]), ht: f6("hien_trang").map((f) => [f.answer, f.source]), v: f6("view").length, ir: db().t.info_requests.filter((q) => q.listing_id === L6.id).map((q) => [q.question, q.status]), rep: r.body.replies }));
  // 25/09/2026: "khu này yên tĩnh lắm" nay là NHÃN "yên tĩnh" (FR-211) — không ghi bổ sung lần hai (FR-223 r).
  check("AIBOC-07 kiến thức thêm: 'hàng xóm thân thiện lắm' (không ô, không nhãn) → fact bo_sung nguồn ai_kiem, dòng 🤖 nêu 'thông tin bổ sung'; 'gần chợ Bình Tây' luật đã ghi ô tiện ích và 'khu này yên tĩnh lắm' đã thành nhãn → AI không ghi bổ sung lần hai",
    f6("bo_sung").length === 1 && f6("bo_sung")[0].answer === "hàng xóm thân thiện lắm" && f6("bo_sung")[0].source === "ai_kiem" &&
      f6("tien_ich_gan").length === 1 && (L6.nhan ?? []).includes("yen_tinh") &&
      r.body.replies.filter((x) => x.startsWith("🤖")).length === 1 && r.body.replies.some((x) => x.startsWith("🤖") && /thông tin bổ sung: "hàng xóm thân thiện lắm"/.test(x)),
    JSON.stringify({ f: f6("bo_sung"), rep: r.body.replies }));
  r = await send({ external_user_id: "aiboc-6", text: "shr, nhà ở từ 2019 rồi, gần chợ Bình Tây, khu này yên tĩnh lắm, hàng xóm thân thiện lắm" });
  check("AIBOC-07b nhắn lại y chang → không ghi bo_sung trùng", f6("bo_sung").length === 1, JSON.stringify(f6("bo_sung")));

  // 25/09/2026 (chủ dự án "ko ghi trùng"; bắn thật lx-12): hỏi hẻm, đáp "hẻm 3m thôi, xe hơi không vào được" → luật ghi hẻm 3m,
  // AI trả kiến thức "xe hơi không vào được" — nói lại đúng điều ô hẻm đã giữ → KHÔNG ghi bo_sung.
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: L6.id, question: "do_rong_hem", status: "pending" });
  globalThis.__model.parse = (p) => laLuotBocRao(p)
    ? { so_can: 0, kien_thuc: ["xe hơi không vào được", "hẻm yên tĩnh, hàng xóm thân thiện"], truong: [] } : OUT();
  r = await send({ external_user_id: "aiboc-6", text: "hẻm 3m thôi, xe hơi không vào được, hẻm yên tĩnh, hàng xóm thân thiện" });
  check("TRUNG-E1 'xe hơi không vào được' khi vừa ghi hẻm 3m → không vào bo_sung; 'hẻm yên tĩnh, hàng xóm thân thiện' (mới) vẫn ghi",
    f6("do_rong_hem").length === 1 && !f6("bo_sung").some((f) => /xe hơi không vào/.test(f.answer)) && f6("bo_sung").some((f) => /hàng xóm thân thiện/.test(f.answer)),
    JSON.stringify({ hem: f6("do_rong_hem"), bs: f6("bo_sung").map((f) => f.answer), rep: r.body.replies }));

  // 25/09/2026 (ảnh chat thật, chủ dự án "hxh nó vẫn ko đọc được"): đang hỏi HẺM ở chế độ `chinh`, khách đáp "hxh" /
  // "hẻm xe hơi" / "ô tô vô tận nhà" — AI im hoặc xếp vào kiến thức thêm → trước đây rơi bổ sung / tiềm năng, hỏi lại số mét.
  for (const [i, cau] of ["hxh", "hẻm xe hơi", "ô tô vô tận nhà"].entries()) {
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: `hxh-${i}`, text: RAO_MT });
    const LH = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LH.id, question: "do_rong_hem", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [cau], truong: [] } : OUT();
    const rH = await send({ external_user_id: `hxh-${i}`, text: cau });
    const fH = (q) => db().t.listing_facts.filter((f) => f.listing_id === LH.id && f.question === q);
    check(`HXH-0${i + 1} đang hỏi hẻm, đáp '${cau}' (AI im) → ghi ô hẻm, câu hẻm xong, KHÔNG vào bổ sung / tiềm năng, không hỏi lại số mét`,
      fH("do_rong_hem").length === 1 && !fH("bo_sung").length && !fH("tiem_nang").length &&
        db().t.info_requests.some((x) => x.listing_id === LH.id && x.question === "do_rong_hem" && x.status === "answered") &&
        !db().t.info_requests.some((x) => x.listing_id === LH.id && x.question === "do_rong_hem" && x.status === "pending"),
      JSON.stringify({ hem: fH("do_rong_hem"), bs: fH("bo_sung"), tn: fH("tiem_nang"), ir: db().t.info_requests.filter((x) => x.listing_id === LH.id).map((x) => [x.question, x.status]), rep: rH.body.replies }));
    if (i === 0) check("HXH-01b 'hxh' ghi thành chữ đọc được 'hẻm xe hơi'", fH("do_rong_hem")[0]?.answer === "hẻm xe hơi", JSON.stringify(fH("do_rong_hem")));
  }
  // 27/09/2026 (chủ dự án test Zalo, căn Botanic): đang hỏi hẻm, khách nhắn "8 tỉ" — AI im, luật đọc ra giá mà bị gạt (khoá AI
  // biết) → câu vào bổ sung, bot hỏi giá lại. Cả tin chỉ là một số tiền → ghi ô giá.
  for (const [i, cau] of ["8 tỉ", "9 tỷ rưỡi nha em", "Giá 8.000.000.000"].entries()) {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: `tien-tron-${i}`, text: "bán nhà hẻm Trần Bình Trọng quận 5, 60m2, trệt 2 lầu" });
    const LT = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LT.id, question: "do_rong_hem", status: "pending" });
    const rT = await send({ external_user_id: `tien-tron-${i}`, text: cau });
    const fT = (q) => db().t.listing_facts.filter((f) => f.listing_id === LT.id && f.question === q);
    check(`TIEN-TRON-0${i + 1} đang hỏi hẻm, chỉ nhắn '${cau}' (chế độ chinh, AI im) → ghi ô GIÁ, không vào bổ sung`,
      fT("gia").length === 1 && !fT("bo_sung").length, JSON.stringify({ gia: fT("gia"), bs: fT("bo_sung"), rep: rT.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // 30/09/2026 (bắn thật lx-ban-f): đang hỏi hẻm, khách chỉ nhắn "60m2" — chế độ chinh, AI im → luật đọc diện tích bị gạt,
  // bot báo "Không bóc tách được gì" rồi hỏi lại. Cả tin chỉ là con số + m2 → ghi ô diện tích.
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: "dt-tron-1", text: "bán nhà hẻm Trần Bình Trọng quận 5, trệt 2 lầu, giá 8 tỷ" });
    const LD = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LD.id, question: "do_rong_hem", status: "pending" });
    const rD = await send({ external_user_id: "dt-tron-1", text: "60m2" });
    const fD = (q) => db().t.listing_facts.filter((f) => f.listing_id === LD.id && f.question === q);
    check("DT-TRON-01 đang hỏi hẻm, chỉ nhắn '60m2' (chế độ chinh, AI im) → ghi ô DIỆN TÍCH, không vào bổ sung",
      fD("dien_tich").length === 1 && !fD("bo_sung").length, JSON.stringify({ dt: fD("dien_tich"), bs: fD("bo_sung"), rep: rD.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // 01/10/2026 (chủ dự án: "bỏ luật, dùng AI bóc — biết từ đồng nghĩa, viết gần giống"): chế độ `ai`. AI đọc mọi tin của
  // người đang rao (không qua cổng regex), nhận khối CHUẨN HOÁ, máy chỉ chặn bịa (không soát từ khoá).
  {
    const cuCH = globalThis.__cauHinh;
    const coChuanHoa = (p) => (p?.system ?? []).some((x) => /CHẾ ĐỘ CHUẨN HOÁ/.test(x.text ?? ""));
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    let goiAi = [];
    globalThis.__model.parse = (p) => { if (laLuotBocRao(p)) { goiAi.push(p); return { so_can: 0, kien_thuc: [], truong: [] }; } return OUT(); };
    await send({ external_user_id: "aim-1", text: "bán nhà phố hẻm 4m Trần Bình Trọng quận 5, 60m2, trệt 2 lầu, giá 8 tỷ" });
    check("AIM-00 chế độ ai → lượt bóc rao có khối CHUẨN HOÁ", goiAi.length > 0 && goiAi.every(coChuanHoa), JSON.stringify(goiAi.length));
    const LA = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LA.id, question: "phap_ly", status: "pending" });
    goiAi = [];
    globalThis.__model.parse = (p) => { if (laLuotBocRao(p)) { goiAi.push(p); return { so_can: 0, kien_thuc: [], cap_nhat: [],
      truong: [{ khoa: "phap_ly", gia_tri: "sổ hồng riêng", trich_dan: "xhr", can: null }],
      tra_loi: { co_tra_loi: true, gia_tri: "sổ hồng riêng", trich_dan: "xhr" } }; } return OUT(); };
    const rA = await send({ external_user_id: "aim-1", text: "xhr" });
    const fA = (q) => db().t.listing_facts.filter((f) => f.listing_id === LA.id && f.question === q);
    check("AIM-01 chế độ ai, hỏi pháp lý, 'xhr' (gõ sai shr) → AI đọc (dù không có mùi dữ liệu với luật), ghi 'sổ hồng riêng'",
      goiAi.length === 1 && fA("phap_ly").some((f) => f.answer === "sổ hồng riêng") && !fA("bo_sung").length,
      JSON.stringify({ goi: goiAi.length, pl: fA("phap_ly"), bs: fA("bo_sung"), rep: rA.body.replies }));
    // AI nói không trả lời câu đang hỏi, luật đọc "chắc" (hxh) → chế độ ai KHÔNG gỡ lại bằng luật.
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LA.id, question: "do_rong_hem", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null } } : OUT();
    await send({ external_user_id: "aim-1", text: "để chiều anh coi lại hxh hay không" });
    check("AIM-02 chế độ ai, AI nói 'không trả lời' → luật (hxh chắc) KHÔNG ghi ô hẻm",
      !fA("do_rong_hem").length,
      JSON.stringify({ hem: fA("do_rong_hem"), ir: db().t.info_requests.filter((x) => x.listing_id === LA.id).map((x) => [x.question, x.status]) }));
    globalThis.__cauHinh = cuCH;
  }
  // 02/10/2026 (test Zalo, ảnh chủ dự án; "xóa luôn mấy luật này đi… để AI viết, và để AI có cache đọc lại nguyên tin nhắn"):
  // người có 2 tin (A = nhà phố Trương Đình Hội; B = vỏ rỗng đang treo câu LOẠI), dán NGUYÊN tin rao căn A. Bản cũ: mảnh về A
  // nhưng ô do regex ghi (tiêu đề → kết cấu, "có thang máy không có thang máy"), rồi hỏi loại nhà cho vỏ B; thả 👍 → hỏi lần ba.
  {
    const cuCH = globalThis.__cauHinh;
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    const uid = "zr-1";
    globalThis.__model = { parse: (p) => laLuotBocRao(p) ? { so_can: 1, kien_thuc: [], truong: [] } : OUT(), create: () => "Dạ em ghi rồi ạ." };
    await send({ external_user_id: uid, text: "anh muốn bán nhà ở Trương Đình Hội" });
    const sl = () => db().t.sellers.find((x) => x.zalo_user_id === uid);
    const A = db().t.listings.filter((l) => l.seller_id === sl().id).at(-1);
    Object.assign(A, { code: "BDS-NP-Q8-0901", property_type: "nha_pho", street: "Trương Đình Hội", location_raw: "Trương Đình Hội", ward: "Phường Phú Định", district: "Quận 8", status: "cho_thong_tin" });
    const B = db().insert("listings", { seller_id: sl().id, code: "BDS-XX-XX-0902", deal: "ban", property_type: "chua_ro", status: "cho_thong_tin", can_chu_duyet: true }).data;
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: B.id, question: "loai_bds", status: "pending" });
    sl().active_listing_id = B.id;
    const RAO = "BÁN NHÀ PHỐ 6 TẦNG CÓ THANG MÁY – TRƯƠNG ĐÌNH HỘI, P. PHÚ ĐỊNH\nGiá: 6,95 tỷ (giảm nhẹ cho khách thiện chí)\n" +
      "Nhà phố biệt lập trong khu dân cư an ninh, yên tĩnh. Nhà bàn giao phần thô, mặt tiền đã hoàn thiện.\nThông tin nhà:\n" +
      "• Diện tích đất: 4m x 11m\n• Tổng diện tích sàn: 245m²\n• Kết cấu: 6 tầng, có thang máy\n• 3 phòng ngủ, 4 WC\n• Hướng Tây\n" +
      "• Garage đậu xe hơi trong nhà\n• Đường trước nhà rộng 7m\nPháp lý: Sổ hồng, hoàn công đẩy đủ.";
    const T = (khoa, gia_tri, trich_dan) => ({ khoa, gia_tri, trich_dan, can: null });
    const DX_RAO = { so_can: 1, kien_thuc: [], cap_nhat: [], truong: [
      T("loai_bds", "nha_pho", "NHÀ PHỐ"), T("gia", "6,95 tỷ", "6,95 tỷ"), T("ngang", "4", "4m x 11m"), T("dai", "11", "4m x 11m"),
      T("so_tang", "6", "6 tầng"), T("thang_may", "co", "có thang máy"), T("so_phong_ngu", "3", "3 phòng ngủ"), T("so_wc", "4", "4 WC"),
      T("huong", "Tây", "Hướng Tây"), T("phap_ly", "sổ hồng", "Sổ hồng"), T("hoan_cong", "co", "hoàn công đẩy đủ"),
    ], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null } };
    const goiBoc = [];
    globalThis.__model = {
      parse: (p) => laLuotGanManh(p) ? { manh: [{ trich: RAO, ma_tin: A.code }] } : laLuotBocRao(p) ? (goiBoc.push(p), DX_RAO) : OUT(),
      create: () => "Dạ em ghi rồi ạ.",
    };
    const rZ = await send({ external_user_id: uid, text: RAO });
    const fZ = (q) => db().t.listing_facts.filter((f) => f.listing_id === A.id && f.question === q).map((f) => f.answer);
    const repZ = rZ.body.replies.join("\n");
    check("ZR-01 dán nguyên tin rao căn đã có → AI ghi ô (thang máy 'có', 4x11, 3 phòng ngủ), KHÔNG lấy tiêu đề 'BÁN NHÀ PHỐ…' làm kết cấu",
      fZ("thang_may").includes("có") && fZ("dien_tich").includes("4x11") && A.bedrooms === 3 && !fZ("ket_cau").some((v) => /BÁN NHÀ PHỐ/i.test(v ?? "")),
      JSON.stringify({ tm: fZ("thang_may"), dt: fZ("dien_tich"), kc: fZ("ket_cau"), pn: A.bedrooms, rep: rZ.body.replies }));
    check("ZR-02 dòng 📝 in nhãn ngắn 'thang máy: có', không in câu hỏi nối giá trị ('có thang máy không …')",
      /thang máy: có/.test(repZ) && !/có thang máy không/.test(repZ), JSON.stringify(rZ.body.replies));
    check("ZR-03 tin B là vỏ rỗng → không hỏi 'nhà phố, chung cư hay đất' nữa; câu loại của B thôi treo, neo chuyển sang A",
      !/chung cư hay đất|thuộc loại nào/.test(repZ) && !db().t.info_requests.some((x) => x.listing_id === B.id && x.status === "pending") && sl().active_listing_id === A.id,
      JSON.stringify({ rep: rZ.body.replies, irB: db().t.info_requests.filter((x) => x.listing_id === B.id).map((x) => [x.question, x.status]), neo: sl().active_listing_id === A.id }));
    // "Bộ nhớ": lượt bóc rao đọc lại NGUYÊN VĂN tin chủ nhà nhắn trước đó.
    const pmBoc = JSON.stringify(goiBoc.at(-1)?.messages ?? []);
    check("ZR-04 lượt AI bóc tách đọc lại nguyên văn tin chủ nhà nhắn trước ('anh muốn bán nhà ở Trương Đình Hội') — tin dài không bị cắt 1.200 chữ",
      /Các tin CHỦ NHÀ đã nhắn TRƯỚC/.test(pmBoc) && /anh muốn bán nhà ở Trương Đình Hội/.test(pmBoc) && /hoàn công đẩy đủ/.test(pmBoc), pmBoc.slice(0, 400));
    // Thả cảm xúc khi câu đang hỏi cần NỘI DUNG → im (không lấy làm câu trả lời).
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: B.id, question: "loai_bds", status: "pending" });
    sl().active_listing_id = B.id;
    globalThis.__model = { parse: (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT(), create: () => "Dạ em chưa rõ lắm ạ, nhà mình thuộc loại nào ta?" };
    const rR = await send({ external_user_id: uid, text: "[khách thả cảm xúc /-strong]" });
    const rR2 = await send({ external_user_id: uid, text: "[khách thả cảm xúc ❤️]" });
    check("ZR-05 thả cảm xúc (/-strong, ❤️) khi đang hỏi loại nhà → bot im, câu loại vẫn treo, không ghi gì",
      rR.body.replies.length === 0 && rR2.body.replies.length === 0 && db().t.info_requests.some((x) => x.listing_id === B.id && x.question === "loai_bds" && x.status === "pending"),
      JSON.stringify({ r1: rR.body.replies, r2: rR2.body.replies }));
    // Câu loại nhà: AI đã đọc mà không thấy loại → hỏi lại, KHÔNG đem câu đi đoán bằng regex (`guess_property_type_answer`).
    const nLog = db().log.length;
    const rL = await send({ external_user_id: uid, text: "diện tích đất 4m x 11m nha em" });
    check("ZR-06 đang hỏi loại, 'diện tích đất 4m x 11m' (AI không thấy loại) → không gọi luật đoán loại, không ghi loại ĐẤT, hỏi lại",
      !db().log.slice(nLog).some((x) => x.rpc === "guess_property_type_answer") && B.property_type !== "dat" && /loại nào|nhà phố/.test(rL.body.replies.join(" ")),
      JSON.stringify({ rep: rL.body.replies, pt: B.property_type, rpc: db().log.slice(nLog).filter((x) => x.rpc).map((x) => x.rpc) }));
    globalThis.__cauHinh = cuCH;
    globalThis.__model = { parse: () => OUT() };
  }
  // 02/10/2026 (chủ dự án: "làm hết cả hai nhóm, cái nào trong code rối quá xóa luôn"; SRS-5.1zb): các chỗ regex còn đọc NGHĨA câu
  // khách và ghi đè / rẽ luồng dù AI đã đọc. Mỗi ca: AI (mock) đọc đúng, luật cũ đọc sai — bản sửa phải theo AI.
  {
    const cuCH = globalThis.__cauHinh;
    const T = (khoa, gia_tri, trich_dan) => ({ khoa, gia_tri, trich_dan, can: null });
    const ai = (them = {}) => (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [],
      tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null },
      cam_xuc: { muc: "binh_thuong", trich_dan: null }, khong_can_hoi: [], y_dinh: { loai: "binh_thuong", trich_dan: null }, ...them } : OUT();
    const RAO = "bán nhà hẻm 4m Tôn Đản quận 4, 4x15, giá 6 tỷ";
    const moDC = async (uid, cauTreo) => {
      fresh(seedKho);
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
      globalThis.__model = { parse: ai({ so_can: 1, truong: [T("loai_bds", "nha_pho", "nhà hẻm"), T("gia", "6 tỷ", "giá 6 tỷ"),
        T("ngang", "4", "4x15"), T("dai", "15", "4x15"), T("quan", "Quận 4", "quận 4")] }), create: () => "Dạ em ghi rồi ạ." };
      await send({ external_user_id: uid, text: RAO });
      const L = db().t.listings.at(-1);
      db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
      if (cauTreo) db().insert("info_requests", { listing_id: L.id, question: cauTreo, status: "pending" });
      return L;
    };
    const fDC = (L, q) => db().t.listing_facts.filter((f) => f.listing_id === L.id && f.question === q).map((f) => f.answer);
    const treoDC = (L) => db().t.info_requests.filter((x) => x.listing_id === L.id && x.status === "pending").map((x) => x.question);

    // DC-E2E-01: quận nhắc lúc đang hỏi hướng là nơi GẦN đó — không đè quận đã có (dù AI có lỡ đọc ra quận).
    let L = await moDC("dc-1", "huong");
    globalThis.__model.parse = ai({ truong: [T("huong", "Đông", "hướng Đông"), T("quan", "Quận 1", "Quận 1")] });
    await send({ external_user_id: "dc-1", text: "hướng Đông, ra Quận 1 có 5 phút" });
    const q1 = db().t.listings.find((x) => x.id === L.id)?.district;
    const L1b = await moDC("dc-1b", "gia");
    globalThis.__model.parse = ai({ truong: [T("quan", "Quận 7", "quận 7")] });
    await send({ external_user_id: "dc-1b", text: "giá thì mình tham khảo mấy căn bên quận 7 đã em" });
    const q1b = db().t.listings.find((x) => x.id === L1b.id)?.district;
    check("DC-E2E-01 đang hỏi hướng 'hướng Đông, ra Quận 1 có 5 phút' / hỏi giá '…tham khảo mấy căn bên quận 7' → quận vẫn Quận 4",
      q1 === "Quận 4" && q1b === "Quận 4", JSON.stringify([q1, q1b]));

    // DC-E2E-02: lời sửa có nhãn "giá" — giá trị theo AI, không phải số đầu tiên regex nhặt.
    L = await moDC("dc-2", "huong");
    globalThis.__model.parse = ai({ truong: [T("gia", "8 tỷ 5", "8 tỷ 5")] });
    const r2 = await send({ external_user_id: "dc-2", text: "căn kế bên giá 9 tỷ đó em, anh để 8 tỷ 5 thôi" });
    check("DC-E2E-02 'căn kế bên giá 9 tỷ đó em, anh để 8 tỷ 5 thôi' → giá 8 tỷ 5 (theo AI); không lượt ghi nào mang '9 tỷ'",
      db().t.listings.find((x) => x.id === L.id)?.price_vnd === 8.5e9 && !fDC(L, "gia").some((v) => /9 tỷ/.test(v ?? "")),
      JSON.stringify([db().t.listings.find((x) => x.id === L.id)?.price_raw, fDC(L, "gia")]));

    // DC-E2E-03: sửa bản nháp — ô theo AI.
    L = await moDC("dc-3", "duyet_tin");
    globalThis.__model.parse = ai({ truong: [T("hien_trang", "nhà để trống", "nhà để trống")] });
    await send({ external_user_id: "dc-3", text: "ghi thêm giùm em, nói thật nhà để trống lâu rồi" });
    const rac3 = db().t.listing_facts.filter((f) => f.listing_id === L.id && /ghi thêm giùm/.test(f.answer ?? "")).map((f) => [f.question, f.answer]);
    check("DC-E2E-03 sửa nháp 'ghi thêm giùm em, nói thật nhà để trống lâu rồi' → ghi hiện trạng theo AI; không ô nào mang nguyên câu ('ghi thêm giùm em…')",
      fDC(L, "hien_trang").length > 0 && !fDC(L, "noi_that").length && !rac3.length, JSON.stringify({ ht: fDC(L, "hien_trang"), rac: rac3 }));

    // DC-E2E-04: câu TẢ nhà có chữ "hết rồi" không phải "đủ rồi".
    L = await moDC("dc-4", "ket_cau");
    db().insert("info_requests", { listing_id: L.id, question: "phap_ly", status: "pending" });
    globalThis.__model.parse = ai({ truong: [T("ket_cau", "xây kín hết", "xây kín hết")], tra_loi: { co_tra_loi: true, gia_tri: "xây kín hết", trich_dan: "xây kín hết" } });
    await send({ external_user_id: "dc-4", text: "xây kín hết rồi em" });
    check("DC-E2E-04 trả lời kết cấu 'xây kín hết rồi em' (AI: không phải 'đủ rồi') → không đóng dấu 'chủ nói đủ', bot còn hỏi tiếp",
      !db().t.listings.find((x) => x.id === L.id)?.chu_noi_du_at && treoDC(L).length > 0, JSON.stringify({ du: db().t.listings.find((x) => x.id === L.id)?.chu_noi_du_at, treo: treoDC(L) }));
    // Ngược lại: AI đọc "đủ rồi" thật → đóng dấu.
    L = await moDC("dc-4b", "ket_cau");
    globalThis.__model.parse = ai({ y_dinh: { loai: "du_roi", trich_dan: "thôi em lên luôn đi" } });
    await send({ external_user_id: "dc-4b", text: "thôi em lên luôn đi, nhiêu đó được rồi" });
    check("DC-E2E-04b 'thôi em lên luôn đi, nhiêu đó được rồi' (AI: du_roi, cách nói luật không có) → đóng dấu 'chủ nói đủ'",
      !!db().t.listings.find((x) => x.id === L.id)?.chu_noi_du_at, JSON.stringify({ du: db().t.listings.find((x) => x.id === L.id)?.chu_noi_du_at, treo: treoDC(L) }));

    // DC-E2E-05: "nha dang cho thue" (không dấu) là hiện trạng, không phải "đăng".
    L = await moDC("dc-5", "hien_trang");
    globalThis.__model.parse = ai({ truong: [T("hien_trang", "đang cho thuê", "dang cho thue")], tra_loi: { co_tra_loi: true, gia_tri: "đang cho thuê", trich_dan: "dang cho thue" } });
    const r5 = await send({ external_user_id: "dc-5", text: "nha dang cho thue" });
    check("DC-E2E-05 hỏi hiện trạng, 'nha dang cho thue' → ghi hiện trạng, không coi là bảo đăng (không 'em đăng liền', không đóng dấu duyệt)",
      fDC(L, "hien_trang").length > 0 && !db().t.listings.find((x) => x.id === L.id)?.chu_duyet_at && !/đăng liền/.test(r5.body.replies.join(" ")),
      JSON.stringify({ ht: fDC(L, "hien_trang"), duyet: db().t.listings.find((x) => x.id === L.id)?.chu_duyet_at, rep: r5.body.replies }));

    // DC-E2E-06: "nữa" trong câu không phải căn mới.
    L = await moDC("dc-6", "gia");
    const nTin = db().t.listings.length;
    globalThis.__model.parse = ai({ can_khac: false, truong: [T("gia", "5 tỷ", "5 tỷ")], tra_loi: { co_tra_loi: true, gia_tri: "5 tỷ", trich_dan: "5 tỷ" } });
    await send({ external_user_id: "dc-6", text: "bán nhà này 5 tỷ nữa là chốt em" });
    check("DC-E2E-06 'bán nhà này 5 tỷ nữa là chốt em' (AI: cùng căn) → KHÔNG mở tin mới, giá căn đang hỏi 5 tỷ",
      db().t.listings.length === nTin && db().t.listings.find((x) => x.id === L.id)?.price_vnd === 5e9,
      JSON.stringify({ n: db().t.listings.length - nTin, gia: db().t.listings.find((x) => x.id === L.id)?.price_raw }));

    // DC-E2E-07: câu rao — AI đã đọc mà không nói gấp → không đoán gấp bằng từ khoá.
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    globalThis.__model = { parse: ai({ so_can: 1, truong: [T("loai_bds", "nha_pho", "nhà hẻm"), T("gia", "6 tỷ", "giá 6 tỷ"), T("quan", "Quận 3", "quận 3")] }), create: () => "Dạ em ghi rồi ạ." };
    await send({ external_user_id: "dc-7", text: "bán nhà hẻm quận 3 giá 6 tỷ, chưa cần bán gấp đâu em" });
    check("DC-E2E-07 rao '…chưa cần bán gấp đâu em' (AI không nói gấp) → cột gấp KHÔNG phải true",
      db().t.listings.at(-1)?.gap !== true, JSON.stringify({ gap: db().t.listings.at(-1)?.gap }));

    // DC-E2E-08: AI đã đọc câu rao, không nói loại → tin để trống loại (bot hỏi), trigger không đoán bằng regex.
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    globalThis.__model = { parse: ai({ so_can: 1, truong: [T("gia", "4 tỷ", "giá 4 tỷ"), T("quan", "Quận 8", "quận 8")] }), create: () => "Dạ em ghi rồi ạ." };
    await send({ external_user_id: "dc-8", text: "bán căn 1 trệt 1 lầu có kho chứa đồ, hẻm 3m quận 8 giá 4 tỷ" });
    check("DC-E2E-08 AI không nói loại → tin mang dấu _thong_so_ai, loại để trống (chua_ro), trigger không tự đoán",
      db().t.listings.at(-1)?.property_type === "chua_ro" && String(db().t.listings.at(-1)?.boc_tach?._thong_so_ai) === "true",
      JSON.stringify({ pt: db().t.listings.at(-1)?.property_type, bt: db().t.listings.at(-1)?.boc_tach }));

    // DC-E2E-09: nở hậu AI đọc ra có chỗ ghi.
    L = await moDC("dc-9", "huong");
    globalThis.__model.parse = ai({ truong: [T("huong", "Tây", "hướng tây"), T("no_hau", "5", "phía sau nở ra 5m")] });
    await send({ external_user_id: "dc-9", text: "hướng tây, phía sau nở ra 5m nha em" });
    check("DC-E2E-09 'hướng tây, phía sau nở ra 5m' (luật không đọc được) → ô nở hậu 5m theo AI (trước đây AI đọc ra mà bị bỏ)",
      fDC(L, "no_hau").includes("5m"), JSON.stringify({ nh: fDC(L, "no_hau") }));
    // DC-E2E-10 (bắn thật 02/10 thu-gap-04/06, SRS-5.1zd): AI im → luật từng ghi ô gấp bằng mẩu câu, mất phủ định.
    for (const [ma, cau] of [["dc-10a", "hong có gấp gì hết"], ["dc-10b", "chưa cần tiền, bán chơi thôi"], ["dc-10c", "giá tốt thì bán, không thì để đó"]]) {
      L = await moDC(ma, "phuong");
      globalThis.__model.parse = ai();
      await send({ external_user_id: ma, text: cau });
      check(`DC-E2E-10 ${ma} hỏi phường, '${cau}' (AI im) → luật KHÔNG ghi ô gấp từ mẩu câu`, !fDC(L, "gap").length,
        JSON.stringify({ gap: fDC(L, "gap"), gapCot: db().t.listings.find((x) => x.id === L.id)?.gap }));
    }
    globalThis.__cauHinh = cuCH;
    globalThis.__model = { parse: () => OUT() };
  }
  // 01/10/2026 (chủ dự án test Zalo: album 4 ảnh → 4 lần "🤖 Không bóc tách được gì" + 4 câu khen; "gộp lại khen 1 2 câu thôi,
  // nhận ảnh cần hỏi cái gì nữa thì hỏi"): lượt ảnh trơn không có 🤖, chỉ lượt ảnh CUỐI của đợt trả lời, gộp số ảnh, hỏi câu đang chờ.
  {
    fresh(seedKho);
    await send({ external_user_id: "alb-1", text: RAO_MT });
    const LB = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LB.id, question: "phap_ly", status: "pending" });
    const rA1 = await send({ external_user_id: "alb-1", text: "", image_url: "https://f9-zpg.zdn.vn/p1.jpg" });
    check("ALB-01 ảnh trơn → KHÔNG có '🤖 Không bóc tách được gì'; 🤖 'Bóc tách ảnh: mặt tiền'; một câu khen; hỏi lại câu đang chờ (pháp lý)",
      !rA1.body.replies.some((x) => /Không bóc tách được gì/.test(x)) && rA1.body.replies.some((x) => /^🤖 Bóc tách ảnh: mặt tiền/.test(x)) &&
        rA1.body.replies.filter((x) => /^Ảnh .*đẹp/.test(x)).length === 1 &&
        rA1.body.replies.some((x) => /sổ/i.test(x) && /\?/.test(x)),
      JSON.stringify(rA1.body.replies));
    const conv = db().t.messages.find((m) => m.sender === "seller")?.conversation_id;
    db().insert("messages", { conversation_id: conv, sender: "seller", body: " [ảnh: https://f9-zpg.zdn.vn/p2.jpg]" });
    db().insert("messages", { conversation_id: conv, sender: "seller", body: " [ảnh: https://f9-zpg.zdn.vn/p3.jpg]" });
    const rA3 = await send({ external_user_id: "alb-1", text: "", image_url: "https://f9-zpg.zdn.vn/p4.jpg" });
    check("ALB-02 ảnh cuối của đợt 3 ảnh liền nhau → 🤖 'Bóc tách ảnh: 3 ảnh', MỘT câu khen",
      rA3.body.replies.some((x) => /^🤖 Bóc tách ảnh: 3 ảnh/.test(x)) && rA3.body.replies.filter((x) => /^Ảnh .*đẹp|nhận được ảnh/.test(x)).length === 1,
      JSON.stringify(rA3.body.replies));
    const soBotTruoc = db().t.messages.filter((m) => m.sender === "bot").length;
    globalThis.__afterInsertMsgSeller = (d, m) => { d.insert("messages", { conversation_id: m.conversation_id, sender: "seller", body: " [ảnh: https://f9-zpg.zdn.vn/p6.jpg]", created_at: new Date(Date.now() + 60_000).toISOString() }); };
    const rA4 = await send({ external_user_id: "alb-1", text: "", image_url: "https://f9-zpg.zdn.vn/p5.jpg" });
    check("ALB-03 còn ảnh khác tới sau → lượt này IM (lượt sau trả lời), ảnh vẫn vào kho",
      rA4.body.replies.length === 0 && db().t.messages.filter((m) => m.sender === "bot").length === soBotTruoc,
      JSON.stringify(rA4.body));
  }
  // 01/10/2026 (chủ dự án: "xhr có thể người ta nhắn shr nhưng viết nhầm, có thể hỏi lại xác nhận"): AI đánh dấu xac_nhan →
  // câu đầu là xác nhận nghĩa; gật → ghi ô; câu treo cũ hỏi lại.
  {
    const cuCH = globalThis.__cauHinh;
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 1, kien_thuc: [], cap_nhat: [], tra_loi: null,
      truong: [{ khoa: "loai_bds", gia_tri: "nha_pho", trich_dan: "nhà phố", can: null }, { khoa: "gia", gia_tri: "8 tỷ", trich_dan: "giá 8 tỷ", can: null }],
      xac_nhan: [{ khoa: "phap_ly", gia_tri: "sổ hồng riêng", trich_dan: "xhr" }] } : OUT();
    const rX = await send({ external_user_id: "aim-xn", text: "bán nhà phố hẻm 4m Trần Bình Trọng quận 5, 60m2, xhr, giá 8 tỷ" });
    const LX = db().t.listings.at(-1);
    const fX = (q) => db().t.listing_facts.filter((f) => f.listing_id === LX.id && f.question === q);
    check("AIM-XN1 'xhr' AI không chắc → bot hỏi 'Dạ \"xhr\" là sổ hồng riêng đúng không', CHƯA ghi pháp lý, gợi ý cất ở boc_tach",
      rX.body.replies.some((x) => /"xhr" là sổ hồng riêng đúng không/.test(x)) && !fX("phap_ly").length && LX.boc_tach?.xac_nhan_goi_y?.gia_tri === "sổ hồng riêng",
      JSON.stringify({ rep: rX.body.replies, pl: fX("phap_ly"), bt: LX.boc_tach }));
    // SRS-5.1zf: gật do AI đọc (`dong_y`).
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, dong_y: "dong_y", dong_y_trich: "đúng rồi em" } : OUT();
    const rX2 = await send({ external_user_id: "aim-xn", text: "đúng rồi em" });
    check("AIM-XN2 gật → ghi pháp lý 'sổ hồng riêng', gợi ý xoá, 🤖 báo pháp lý, hỏi lại câu đang treo",
      fX("phap_ly").some((f) => f.answer === "sổ hồng riêng") && db().t.listings.at(-1).boc_tach?.xac_nhan_goi_y === false &&
        rX2.body.replies.some((x) => /pháp lý: "sổ hồng riêng"/.test(x)) && rX2.body.replies.some((x) => /\?/.test(x)),
      JSON.stringify({ rep: rX2.body.replies, pl: fX("phap_ly"), bt: db().t.listings.at(-1).boc_tach }));
    globalThis.__cauHinh = cuCH;
  }
  // 01/10/2026 (bắn thật lx-tam-01/02/03, chế độ `ai`): khách trả lời ô KHÁC câu đang hỏi mà AI im hẳn → luật ghi ô đó (trước:
  // vào "📝 Thêm", bot hỏi lại gấp); đang hỏi phường mà đáp "có lửng nha em" → KHÔNG ghi phường "có lửng".
  {
    const cuCH = globalThis.__cauHinh;
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null } } : OUT();
    await send({ external_user_id: "aim-im", text: "bán nhà hẻm 4m Trần Bình Trọng quận 5, 60m2, trệt 2 lầu, giá 8 tỷ" });
    const LI = db().t.listings.at(-1);
    const fI = (q) => db().t.listing_facts.filter((f) => f.listing_id === LI.id && f.question === q);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LI.id, question: "phuong", status: "pending" });
    // SRS-5.1zd (bắn thật 02/10 thu-gap-04/06): bản trước khẳng định "AI im thì LUẬT ghi gấp" — chính luật đó đọc "hong có gấp gì hết"
    // ra GẤP, "chưa cần tiền" ra "cần tiền". Gấp là ô phán đoán: AI im thì không ghi (không vào bổ sung, không ghi phường); AI đọc
    // "không gấp" (khoá gap, có trích dẫn) thì ghi.
    const rI = await send({ external_user_id: "aim-im", text: "không gấp em" });
    check("AIM-IM1 chế độ ai, đang hỏi phường, 'không gấp em', AI im hẳn → luật KHÔNG ghi gấp; không vào bổ sung, không ghi phường",
      !fI("gap").length && !fI("bo_sung").length && !fI("phuong").length, JSON.stringify({ gap: fI("gap"), bs: fI("bo_sung"), ph: fI("phuong"), rep: rI.body.replies }));
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LI.id, question: "phuong", status: "pending" });
    const parseIm = globalThis.__model.parse;
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null },
      truong: [{ khoa: "gap", gia_tri: "khong", trich_dan: "không gấp", can: null }] } : OUT();
    await send({ external_user_id: "aim-im", text: "không gấp em" });
    check("AIM-IM1b đang hỏi phường, 'không gấp em', AI đọc gấp = khong → ghi ô gấp 'không gấp', không ghi phường",
      fI("gap").some((f) => f.answer === "không gấp") && !fI("phuong").length, JSON.stringify({ gap: fI("gap"), ph: fI("phuong") }));
    globalThis.__model.parse = parseIm;
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LI.id, question: "phuong", status: "pending" });
    const rI2 = await send({ external_user_id: "aim-im", text: "có lửng nha em" });
    check("AIM-IM2 đang hỏi phường, 'có lửng nha em' → KHÔNG ghi phường 'có lửng'",
      !fI("phuong").some((f) => /lửng/.test(f.answer)) && !/lửng/.test(db().t.listings.at(-1).ward ?? ""), JSON.stringify({ ph: fI("phuong"), rep: rI2.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // 01/10/2026 (bắn thử lx-tt-08, chế độ `ai`): đang hỏi phường, khách "shr" — AI xếp vào `xac_nhan` (không chắc) mà nhánh câu lệch
  // không hỏi xác nhận → "Không bóc tách được gì", pháp lý trống. Hai bộ đọc (AI + từ điển tiền định) cùng ra một ô → ghi luôn.
  // Cùng lượt bắn: "phường nào" / "đường nào" hỏi hai lần liền — một câu chỉ hỏi MỘT lần trong chat (SRS-5.1s).
  {
    const cuCH = globalThis.__cauHinh;
    const rong = (xn = []) => (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: xn, tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null } } : OUT();
    const moTin = async (uid) => {
      fresh(seedKho);
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
      globalThis.__model.parse = rong();
      await send({ external_user_id: uid, text: "ban nha 4x15 tret 2 lau 3pn hxh q10 gia 9ty" });
      const L = db().t.listings.at(-1);
      db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
      db().insert("info_requests", { listing_id: L.id, question: "phuong", status: "pending" });
      return L;
    };
    const fq = (L, q) => db().t.listing_facts.filter((f) => f.listing_id === L.id && f.question === q);
    const treo = (L) => db().t.info_requests.filter((x) => x.listing_id === L.id && x.status === "pending").map((x) => x.question);
    let L = await moTin("xnc-1");
    globalThis.__model.parse = rong([{ khoa: "phap_ly", gia_tri: "sổ hồng riêng", trich_dan: "shr" }]);
    const r1 = await send({ external_user_id: "xnc-1", text: "shr" });
    check("XN-CHAC-01 hỏi phường, 'shr', AI để vào xac_nhan → từ điển cũng đọc pháp lý: ghi 'sổ hồng riêng', không 'Không bóc tách được gì'",
      fq(L, "phap_ly").some((f) => f.answer === "sổ hồng riêng") && !r1.body.replies.some((x) => /Không bóc tách/.test(x)),
      JSON.stringify({ pl: fq(L, "phap_ly"), rep: r1.body.replies }));
    L = await moTin("xnc-2");
    globalThis.__model.parse = rong([{ khoa: "phap_ly", gia_tri: "sổ hồng riêng", trich_dan: "xhr" }]);
    const r2 = await send({ external_user_id: "xnc-2", text: "xhr" });
    check("XN-CHAC-02 'xhr' (chỉ AI đoán, từ điển không đọc) → KHÔNG ghi thẳng; bot hỏi xác nhận nghĩa",
      !fq(L, "phap_ly").length && r2.body.replies.some((x) => /"xhr" là sổ hồng riêng/.test(x)), JSON.stringify({ pl: fq(L, "phap_ly"), rep: r2.body.replies }));
    // Không hỏi lại: mỗi cách khách KHÔNG trả lời câu phường → thôi câu phường, câu treo kế là câu KHÁC.
    const caKhongHoiLai = [
      ["HL1-01", "sổ hồng riêng", "nói sang ô khác (ô lõi)"],
      ["HL1-02", "ko gap", "nói sang ô khác, không dấu"],
      ["HL1-03", "ừ", "chỉ ừ"],
      ["HL1-04", "nhà này đẹp lắm em, mới sơn lại", "kể chuyện, không ô nào"],
      ["HL1-05", "phí bên em tính sao", "hỏi ngược"],
    ];
    for (const [id, cau, ve] of caKhongHoiLai) {
      L = await moTin(`hl1-${id}`);
      const r = await send({ external_user_id: `hl1-${id}`, text: cau });
      const pq = db().t.info_requests.find((x) => x.listing_id === L.id && x.question === "phuong");
      check(`${id} hỏi phường, khách '${cau}' (${ve}) → thôi câu phường, KHÔNG hỏi lại phường`,
        pq?.status === "expired" && !treo(L).includes("phuong") && !r.body.replies.some((x) => /phường/i.test(x) && /\?/.test(x)),
        JSON.stringify({ treo: treo(L), pq: pq?.status, rep: r.body.replies }));
    }
    L = await moTin("hl1-q");
    const rq = await send({ external_user_id: "hl1-q", text: "quận 10 em" });
    check("HL1-06 hỏi phường, khách chỉ nói 'quận 10 em' (trả lời MỘT PHẦN) → vẫn hỏi phường (phần còn thiếu)",
      treo(L).includes("phuong"), JSON.stringify({ treo: treo(L), rep: rq.body.replies }));
    globalThis.__cauHinh = cuCH;
  }

  // SRS-5.1t (01/10/2026, chủ dự án: "ra luật nó phải đọc thêm 1 2 câu hoặc cả ngữ cảnh phía trước nữa, sửa cả 4 đi").
  {
    const cuCH = globalThis.__cauHinh;
    const laSoat = (p) => (p?.system ?? []).some((x) => /SOÁT LỜI BOT GỬI CHỦ NHÀ/.test(x.text ?? ""));
    const aiRao = (them = {}) => (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [],
      tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null },
      cam_xuc: { muc: "binh_thuong", trich_dan: null }, khong_can_hoi: [], ...them } : laSoat(p) ? { nhan_xet: [] } : OUT();
    const dung = async (uid, cauTreo, cauBot) => {
      fresh(seedKho);
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
      // SRS-5.1zb: chế độ `ai` mà AI đã đọc câu rao thì ô AI không nói không do luật điền — mock đưa đúng thứ AI thật đọc ra.
      globalThis.__model.parse = aiRao({ so_can: 1, truong: [
        { khoa: "loai_giao_dich", gia_tri: "ban", trich_dan: "bán nhà", can: null }, { khoa: "loai_bds", gia_tri: "nha_pho", trich_dan: "nhà hẻm", can: null },
        { khoa: "gia", gia_tri: "7 tỷ", trich_dan: "giá 7 tỷ", can: null },
        { khoa: "ngang", gia_tri: "4", trich_dan: "4x16", can: null }, { khoa: "dai", gia_tri: "16", trich_dan: "4x16", can: null },
        { khoa: "quan", gia_tri: "Quận Bình Thạnh", trich_dan: "Bình Thạnh", can: null },
      ] });
      await send({ external_user_id: uid, text: "bán nhà hẻm 4m Phan Đăng Lưu Bình Thạnh 4x16 giá 7 tỷ" });
      const L = db().t.listings.at(-1);
      db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
      db().insert("info_requests", { listing_id: L.id, question: cauTreo, status: "pending" });
      if (cauBot) db().insert("messages", { conversation_id: db().t.conversations.at(-1).id, sender: "bot", body: cauBot });
      return L;
    };
    const fq2 = (L, q) => db().t.listing_facts.filter((f) => f.listing_id === L.id && f.question === q);
    // (1) Ngữ cảnh: AI thấy câu bot THẬT vừa nói; "ừ" cho câu chọn A/B không ghi; câu có/không thì ghi.
    let L = await dung("ctx-1", "gap", "Dạ sổ riêng thì dễ bán lắm. Mình cần ra hàng gấp hay được giá thì thôi ạ?");
    let msgAi = "";
    globalThis.__model.parse = (p) => { if (laLuotBocRao(p)) msgAi = String(p.messages?.[0]?.content ?? ""); return aiRao({ tra_loi: { co_tra_loi: true, gia_tri: "được giá thì thôi", trich_dan: "ừ" } })(p); };
    await send({ external_user_id: "ctx-1", text: "ừ" });
    check("CTX-01 bot hỏi 'gấp hay được giá thì thôi?', khách 'ừ', AI đoán 'được giá thì thôi' → KHÔNG ghi ô gấp",
      !fq2(L, "gap").length, JSON.stringify(fq2(L, "gap")));
    check("CTX-02 AI nhận NGỮ CẢNH: câu bot vừa nói nguyên văn + vài lượt trước",
      /Vài lượt NGAY TRƯỚC/.test(msgAi) && /gấp hay được giá thì thôi/.test(msgAi) && /CHỦ NHÀ: bán nhà hẻm 4m/.test(msgAi), msgAi.slice(0, 600));
    L = await dung("ctx-3", "gap", "Dạ mình có cần bán gấp không ạ?");
    globalThis.__model.parse = aiRao({ tra_loi: { co_tra_loi: true, gia_tri: "có, cần bán gấp", trich_dan: "ừ" } });
    await send({ external_user_id: "ctx-3", text: "ừ" });
    check("CTX-03 câu CÓ/KHÔNG 'có cần bán gấp không?', khách 'ừ' → ghi gấp (không chặn quá tay)",
      fq2(L, "gap").some((f) => /gấp/.test(f.answer)), JSON.stringify(fq2(L, "gap")));
    // (4) Cảm xúc: bực / nghi ngờ có trích dẫn → việc cho người phụ trách (một lần / 24h); bực → xin lỗi, thôi hỏi.
    const escCx = () => db().t.reminders.filter((x) => x.kind === "escalation" && /^😟 Zalo/.test(x.note ?? ""));
    L = await dung("cx-1", "phuong");
    globalThis.__model.parse = aiRao({ cam_xuc: { muc: "buc", trich_dan: "hỏi hoài vậy" } });
    const rC1 = await send({ external_user_id: "cx-1", text: "trời ơi em hỏi hoài vậy" });
    check("CX-01 AI đọc BỰC (trích có trong tin) → 1 việc escalation '😟 … có vẻ bực' KHÔNG gắn seller_id (không gửi về chủ nhà), bot xin lỗi, không hỏi tiếp",
      escCx().length === 1 && /có vẻ bực/.test(escCx()[0].note) && !escCx()[0].seller_id && rC1.body.replies.some((x) => /xin lỗi/i.test(x)) && !rC1.body.replies.some((x) => /\?/.test(x)),
      JSON.stringify({ esc: escCx().map((x) => x.note), rep: rC1.body.replies }));
    globalThis.__model.parse = aiRao({ cam_xuc: { muc: "buc", trich_dan: "phiền quá" } });
    await send({ external_user_id: "cx-1", text: "phiền quá à" });
    check("CX-02 bực lần hai trong 24 giờ → KHÔNG báo trùng", escCx().length === 1, JSON.stringify(escCx().map((x) => x.note)));
    L = await dung("cx-3", "phuong");
    globalThis.__model.parse = aiRao({ cam_xuc: { muc: "nghi_ngo", trich_dan: "có phải lừa đảo không" } });
    await send({ external_user_id: "cx-3", text: "bên em có phải lừa đảo không vậy" });
    check("CX-03 nghi ngờ (cách nói mới) → báo người phụ trách 'đang nghi ngờ'", escCx().some((x) => /nghi ngờ/.test(x.note)), JSON.stringify(escCx().map((x) => x.note)));
    // Bực rồi nghi ngờ trong 24 giờ là HAI chuyện — báo cả hai; nghi ngờ thì bong bóng trấn an tiền định đứng trước.
    L = await dung("cx-5", "phuong");
    globalThis.__model.parse = aiRao({ cam_xuc: { muc: "buc", trich_dan: "phiền quá" } });
    await send({ external_user_id: "cx-5", text: "phiền quá à" });
    globalThis.__model.parse = aiRao({ cam_xuc: { muc: "nghi_ngo", trich_dan: "chắc bên này lừa" } });
    const rC5 = await send({ external_user_id: "cx-5", text: "chắc bên này lừa rồi" });
    const esc5 = db().t.reminders.filter((x) => x.kind === "escalation" && /^😟 Zalo …cx-5/.test(x.note ?? ""));
    check("CX-05 bực rồi nghi ngờ → 2 việc (mỗi mức một); nghi ngờ → lời đầu là trấn an (không thu trước, phí khi giao dịch thành công); câu nghi ngờ KHÔNG ghi vào tin",
      esc5.length === 2 && /không thu đồng nào trước/.test(rC5.body.replies.find((x) => !/^🤖/.test(x)) ?? "") &&
        /phí chỉ thu khi giao dịch thành công, 1% giá chốt/.test(rC5.body.replies.find((x) => !/^🤖/.test(x)) ?? "") &&
        !db().t.listing_facts.some((f) => f.listing_id === L.id && /lừa/.test(f.answer ?? "")),
      JSON.stringify({ esc: esc5.map((x) => x.note), rep: rC5.body.replies }));
    // Bắn thử v317 (lx-cx-12): bực → hoãn, rồi "nói thật chứ chị sợ mấy bên online lừa lắm" → ghi vào ô NỘI THẤT.
    for (const [uid, them] of [
      ["cx-6a", { truong: [{ khoa: "noi_that", gia_tri: "nói thật chứ chị sợ mấy bên online lừa lắm", trich_dan: "nói thật chứ chị sợ mấy bên online lừa lắm", can: null }] }],
      ["cx-6b", { tra_loi: { co_tra_loi: true, gia_tri: "sợ mấy bên online lừa", trich_dan: "sợ mấy bên online lừa lắm" } }],
      ["cx-6c", {}],
    ]) {
      L = await dung(uid, "phuong");
      globalThis.__model.parse = aiRao({ cam_xuc: { muc: "buc", trich_dan: "hỏi hoài vậy" } });
      await send({ external_user_id: uid, text: "hỏi gì mà hỏi hoài vậy em" });
      globalThis.__model.parse = aiRao({ cam_xuc: { muc: "nghi_ngo", trich_dan: "sợ mấy bên online lừa lắm" }, ...them });
      const r6 = await send({ external_user_id: uid, text: "nói thật chứ chị sợ mấy bên online lừa lắm" });
      const f6 = db().t.listing_facts.filter((f) => f.listing_id === L.id && /lừa/.test(f.answer ?? ""));
      check(`CX-06 ${uid} bực rồi 'chị sợ mấy bên online lừa lắm' (AI nghi ngờ có trích dẫn) → câu cảm xúc KHÔNG vào ô nào của tin, bot không nói 'em ghi rồi'`,
        !f6.length && !r6.body.replies.some((x) => /em ghi (?:nhận )?rồi|Bóc tách được/.test(x)),
        JSON.stringify({ f6: f6.map((f) => [f.question, f.answer]), rep: r6.body.replies, treo: db().t.info_requests.filter((x) => x.listing_id === L.id).map((x) => [x.question, x.status]) }));
    }
    // AI đọc ra cảm xúc thì AI KHÔNG im — luật không đọc ô từ lời bày tỏ ("hối chị gấp gấp" là chuyện môi giới khác, không phải chủ cần bán gấp).
    L = await dung("cx-7", "phuong");
    globalThis.__model.parse = aiRao({ cam_xuc: { muc: "nghi_ngo", trich_dan: "hối chị gấp gấp rồi lừa, sợ lắm" } });
    await send({ external_user_id: "cx-7", text: "mấy bên môi giới hối chị gấp gấp rồi lừa, sợ lắm" });
    const f7 = db().t.listing_facts.filter((f) => f.listing_id === L.id && f.question === "gap");
    check("CX-07 'mấy bên môi giới hối chị gấp gấp rồi lừa, sợ lắm' (AI: nghi ngờ, không ô nào) → KHÔNG ghi ô gấp", !f7.length, JSON.stringify(f7.map((f) => f.answer)));
    L = await dung("cx-4", "phuong");
    globalThis.__model.parse = aiRao({ cam_xuc: { muc: "buc", trich_dan: "cút đi" } });
    await send({ external_user_id: "cx-4", text: "phường 12 em" });
    check("CX-04 AI nói bực mà trích dẫn KHÔNG có trong tin → không báo ai", !escCx().length, JSON.stringify(escCx().map((x) => x.note)));
    // (3) Câu không áp dụng cho căn này (AI, có trích dẫn) → không hỏi; câu lõi / trích sai thì không bỏ.
    L = await dung("kh-1", "phuong");
    globalThis.__model.parse = aiRao({ khong_can_hoi: [
      { khoa: "so_phong_ngu", ly_do: "nhà để kinh doanh, không có phòng ngủ", trich_dan: "không có phòng ngủ" },
      { khoa: "gia", ly_do: "đã có", trich_dan: "không có phòng ngủ" },
      { khoa: "do_rong_hem", ly_do: "mặt tiền", trich_dan: "nhà mặt tiền" },
    ] });
    await send({ external_user_id: "kh-1", text: "phường 12 em, nhà làm văn phòng không có phòng ngủ" });
    const LK = db().t.listings.find((x) => x.id === L.id);
    const kh = LK?.boc_tach?.khong_hoi ?? [];
    check("KH-01 AI: căn không có phòng ngủ (trích có trong tin) → cất khong_hoi so_phong_ngu; 'gia' (câu lõi) và trích không có trong tin thì không",
      kh.includes("so_phong_ngu") && !kh.includes("gia") && !kh.includes("do_rong_hem"), JSON.stringify(LK?.boc_tach));
    // Căn hộ: phòng ngủ là câu kế ngay (ưu tiên 4) — AI thấy căn officetel không có phòng ngủ → câu kế phải là câu KHÁC.
    fresh(seedKho);
    globalThis.__model.parse = aiRao();
    await send({ external_user_id: "kh-2", text: "bán căn hộ 40m2 tầng 12 Sunrise City quận 7 giá 2 tỷ 2" });
    const LH = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LH.id, question: "tang", status: "pending" });
    globalThis.__model.parse = aiRao({ khong_can_hoi: [{ khoa: "so_phong_ngu", ly_do: "officetel không có phòng ngủ", trich_dan: "không có phòng ngủ" }] });
    await send({ external_user_id: "kh-2", text: "căn officetel không có phòng ngủ em" });
    check("KH-02 căn hộ officetel 'không có phòng ngủ' → câu treo kế KHÔNG phải phòng ngủ (vốn là câu kế ngay)",
      !db().t.info_requests.some((x) => x.listing_id === LH.id && x.status === "pending" && x.question === "so_phong_ngu") &&
        db().t.info_requests.some((x) => x.listing_id === LH.id && x.status === "pending"),
      JSON.stringify(db().t.info_requests.filter((x) => x.listing_id === LH.id).map((x) => [x.question, x.status])));
    // Câu hỏi ĐẦU sau câu rao cũng lọc: chủ nói ngay trong câu rao căn không có phòng ngủ.
    fresh(seedKho);
    let msgRao = "";
    globalThis.__model.parse = (p) => { if (laLuotBocRao(p)) msgRao = String(p.messages?.[0]?.content ?? ""); return aiRao({ so_can: 1, khong_can_hoi: [{ khoa: "so_phong_ngu", ly_do: "studio không có phòng ngủ riêng", trich_dan: "không có phòng ngủ riêng" }],
      // SRS-5.1zb: AI đã đọc câu rao thì ô AI không nói không do luật điền — mock đưa loại / diện tích / giá như AI thật đọc ra.
      truong: [{ khoa: "loai_bds", gia_tri: "chung_cu", trich_dan: "căn hộ studio", can: null }, { khoa: "dien_tich", gia_tri: "35", trich_dan: "35m2", can: null },
        { khoa: "gia", gia_tri: "2 tỷ 1", trich_dan: "giá 2 tỷ 1", can: null }, { khoa: "quan", gia_tri: "Quận 7", trich_dan: "quận 7", can: null }] })(p); };
    await send({ external_user_id: "kh-3", text: "bán căn hộ studio 35m2 tầng 9 Sunrise City 23 Nguyễn Hữu Thọ phường Tân Hưng quận 7 giá 2 tỷ 1, không có phòng ngủ riêng" });
    const LS3 = db().t.listings.at(-1);
    check("KH-03 câu rao 'không có phòng ngủ riêng' → AI nhận danh mục câu tùy căn; câu hỏi ĐẦU không phải phòng ngủ; khong_hoi cất",
      /Câu bot còn định hỏi/.test(msgRao) && /so_phong_ngu/.test(msgRao) && (LS3?.boc_tach?.khong_hoi ?? []).includes("so_phong_ngu") &&
        !db().t.info_requests.some((x) => x.listing_id === LS3.id && x.status === "pending" && x.question === "so_phong_ngu"),
      JSON.stringify({ bt: LS3?.boc_tach, kh: LS3?.boc_tach?.khong_hoi, ir: db().t.info_requests.filter((x) => x.listing_id === LS3?.id).map((x) => [x.question, x.status]) }));
    // SRS-5.1v (đợt 1 chuyển luật sang AI): câu rao chế độ `ai`, AI đọc được → tin mang dấu `_thong_so_ai` (trigger DB không đọc
    // câu rao bằng regex); ô luật cũ (đường vào, xe container) do AI ghi chữ sạch. AI chết → không dấu, luật đỡ như cũ.
    const RAO_KCN = "cho thuê kho xưởng 500m2 trong KCN Tân Tạo Bình Tân giá 60 triệu/tháng, nằm trong khu công nghiệp nên không có hẻm, xe container vào tận nơi em";
    fresh(seedKho);
    globalThis.__model.parse = aiRao({ truong: [
      { khoa: "loai_bds", gia_tri: "kho_xuong", trich_dan: "kho xưởng", can: null },
      { khoa: "loai_giao_dich", gia_tri: "cho_thue", trich_dan: "cho thuê", can: null },
      { khoa: "loai_duong_vao", gia_tri: "khong_hem", trich_dan: "nằm trong khu công nghiệp nên không có hẻm", can: null },
      { khoa: "duong_container", gia_tri: "xe container vào tận nơi em", trich_dan: "xe container vào tận nơi em", can: null },
    ] });
    await send({ external_user_id: "tsai-1", text: RAO_KCN });
    const LT1 = db().t.listings.at(-1);
    const fT = (L, q) => db().t.listing_facts.filter((f) => f.listing_id === L.id && f.question === q).map((f) => f.answer);
    check("TS-AI-01 câu rao KCN 'không có hẻm, xe container vào tận nơi em' (chế độ ai) → dấu _thong_so_ai; đường vào 'không có hẻm'; xe container ghi MỘT lần, bỏ 'em'",
      LT1?.boc_tach?._thong_so_ai === true && fT(LT1, "loai_duong_vao").join() === "không có hẻm" && fT(LT1, "duong_container").join("|") === "xe container vào tận nơi",
      JSON.stringify({ bt: LT1?.boc_tach, f: db().t.listing_facts.filter((f) => f.listing_id === LT1?.id).map((f) => [f.question, f.answer]) }));
    fresh(seedKho);
    globalThis.__model.parse = (p) => { if (laLuotBocRao(p)) throw new Error("model bóc chết"); return aiRao()(p); };
    await send({ external_user_id: "tsai-2", text: RAO_KCN });
    const LT2 = db().t.listings.at(-1);
    check("TS-AI-02 cùng câu rao mà AI chết → KHÔNG dấu _thong_so_ai (trigger DB đọc câu rao như cũ — luật đỡ)", !!LT2 && !LT2.boc_tach?._thong_so_ai,
      JSON.stringify({ bt: LT2?.boc_tach }));
    // SRS-5.1w (đợt 2 chuyển luật sang AI): ý định / vai / bổ sung / địa chỉ do AI quyết (có trích dẫn), từ khoá chỉ đỡ khi AI chết.
    const binh = { y_dinh: { loai: "binh_thuong", trich_dan: null }, vai: { la: "khong_noi", trich_dan: null } };
    const stL = (L) => db().t.listings.find((x) => x.id === L.id)?.status;
    const treoD2 = (L) => db().t.info_requests.filter((x) => x.listing_id === L.id && x.status === "pending").map((x) => x.question);
    L = await dung("d2-1", "phuong");
    globalThis.__model.parse = aiRao({ ...binh, y_dinh: { loai: "ban_roi", trich_dan: "có người lấy rồi" } });
    await send({ external_user_id: "d2-1", text: "nhà chị có người lấy rồi em" });
    check("D2-01 'nhà chị có người lấy rồi em' (từ khoá bỏ sót) — AI: đã bán, có trích dẫn → tin đóng (da_chot)", stL(L) === "da_chot", JSON.stringify({ st: stL(L) }));
    L = await dung("d2-2", "phuong");
    globalThis.__model.parse = aiRao(binh);
    await send({ external_user_id: "d2-2", text: "hàng xóm bán rồi, còn nhà chị vẫn bán nha" });
    check("D2-02 'hàng xóm bán rồi, còn nhà chị vẫn bán' (từ khoá đọc 'bán rồi') — AI: bình thường → tin KHÔNG đóng", !["da_chot", "an"].includes(stL(L)), JSON.stringify({ st: stL(L) }));
    L = await dung("d2-3", "ket_cau");
    globalThis.__model.parse = aiRao(binh);
    await send({ external_user_id: "d2-3", text: "căn này chị tính bán từ năm ngoái mà chưa có thời gian" });
    check("D2-03 'căn này chị tính bán từ năm ngoái mà chưa có thời gian' — AI không thấy ý nào về căn nhà → KHÔNG ghi nguyên câu vào bổ sung",
      !db().t.listing_facts.some((f) => f.listing_id === L.id && f.question === "bo_sung"), JSON.stringify(db().t.listing_facts.filter((f) => f.listing_id === L.id).map((f) => [f.question, f.answer])));
    const escNhan = (uid) => db().t.reminders.filter((x) => x.kind === "escalation" && x.note?.startsWith(`✏️ Zalo …${uid.slice(-4)}`));
    L = await dung("d2-4", "phuong");
    globalThis.__model.parse = aiRao(binh);
    await send({ external_user_id: "d2-4", text: "mấy bên môi giới gọi chị suốt, phiền lắm" });
    check("D2-04 'mấy bên môi giới gọi chị suốt' (nhắc môi giới KHÁC) — AI: không tự xưng → KHÔNG báo đổi nhãn", !escNhan("d2-4").length, JSON.stringify(escNhan("d2-4").map((x) => x.note)));
    L = await dung("d2-5", "phuong");
    globalThis.__model.parse = aiRao({ ...binh, vai: { la: "moi_gioi", trich_dan: "em làm bên sàn" } });
    await send({ external_user_id: "d2-5", text: "à em làm bên sàn nha anh" });
    check("D2-05 'em làm bên sàn' — AI: tự xưng môi giới (có trích dẫn) → báo admin xác nhận đổi nhãn", escNhan("d2-5").length === 1, JSON.stringify(escNhan("d2-5").map((x) => x.note)));
    L = await dung("d2-7", "phuong");
    globalThis.__model.parse = aiRao({ ...binh, y_dinh: { loai: "hoan", trich_dan: "lát nữa nói tiếp" } });
    const r7 = await send({ external_user_id: "d2-7", text: "chị đang chạy xe, lát nữa nói tiếp nha" });
    check("D2-07 'chị đang chạy xe, lát nữa nói tiếp nha' (từ khoá bỏ sót) — AI: hoãn → không hỏi tiếp, câu phường vẫn treo, không ghi bổ sung",
      !r7.body.replies.some((x) => /\?/.test(x)) && treoD2(L).includes("phuong") && !db().t.listing_facts.some((f) => f.listing_id === L.id && f.question === "bo_sung"),
      JSON.stringify({ rep: r7.body.replies, treo: treoD2(L) }));
    // SRS-5.1x (đợt 3): câu kế do AI chọn trong danh sách hợp lệ; chọn ngoài danh sách → luật chọn như cũ.
    L = await dung("d3-1", "ket_cau");
    globalThis.__model.parse = aiRao({ ...binh, cau_ke: { khoa: "phap_ly", ly_do: "cần pháp lý để lên tin" },
      tra_loi: { co_tra_loi: true, gia_tri: "trệt + 2 lầu", trich_dan: "trệt 2 lầu" }, truong: [{ khoa: "so_tang", gia_tri: "3", trich_dan: "trệt 2 lầu", can: null }] });
    await send({ external_user_id: "d3-1", text: "trệt 2 lầu em" });
    check("D3-01 AI chọn câu kế 'phap_ly' (có trong danh sách còn hỏi) → câu treo kế là pháp lý", treoD2(L).includes("phap_ly"), JSON.stringify({ treo: treoD2(L) }));
    const keLuat = await (async () => {
      L = await dung("d3-2", "ket_cau");
      globalThis.__model.parse = aiRao({ ...binh, cau_ke: { khoa: "ten_lua", ly_do: "x" },
        tra_loi: { co_tra_loi: true, gia_tri: "trệt + 2 lầu", trich_dan: "trệt 2 lầu" }, truong: [{ khoa: "so_tang", gia_tri: "3", trich_dan: "trệt 2 lầu", can: null }] });
      await send({ external_user_id: "d3-2", text: "trệt 2 lầu em" });
      return treoD2(L);
    })();
    check("D3-02 AI chọn khoá KHÔNG có trong danh sách → bỏ, luật chọn câu kế (vẫn có câu treo, không phải khoá lạ)", keLuat.length === 1 && keLuat[0] !== "ten_lua", JSON.stringify({ treo: keLuat }));
    fresh(seedKho);
    globalThis.__model.parse = aiRao({ truong: [
      { khoa: "loai_bds", gia_tri: "kho_xuong", trich_dan: "xưởng", can: null },
      { khoa: "loai_giao_dich", gia_tri: "cho_thue", trich_dan: "cho thuê", can: null },
      { khoa: "loai_duong_vao", gia_tri: "khong_hem", trich_dan: "không có hẻm gì hết", can: null },
    ] });
    await send({ external_user_id: "d2-6", text: "cho thuê xưởng 800m2 trong cụm công nghiệp Đức Hòa Long An, không có hẻm gì hết, giá 70 triệu/tháng" });
    const LD6 = db().t.listings.at(-1);
    check("D2-06 câu rao 'không có hẻm gì hết' mà AI không đọc ra đường → KHÔNG ghi địa chỉ luật đoán ('hẻm gì hết')",
      !db().t.listing_facts.some((f) => f.listing_id === LD6?.id && f.question === "vi_tri") && !/gì hết/.test(LD6?.location_raw ?? ""),
      JSON.stringify({ vt: db().t.listing_facts.filter((f) => f.listing_id === LD6?.id && f.question === "vi_tri").map((f) => f.answer), lr: LD6?.location_raw }));
    // (2) Nhận xét không căn cứ: AI soát lời bot, code kiểm căn cứ → bỏ câu khen bịa, giữ câu hỏi.
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laSoat(p)
      ? { nhan_xet: [{ cau: "Nhà phố hẻm sâu yên tĩnh, kết cấu 4x15 ạ.", khang_dinh: "hẻm sâu yên tĩnh", can_cu: "hẻm sâu" }] }
      : aiRao()(p);
    globalThis.__model.create = () => "Nhà phố hẻm sâu yên tĩnh, kết cấu 4x15 ạ. Nhà mình ở phường nào anh chị?";
    const rK = await send({ external_user_id: "khen-1", text: "ban nha 4x15 tret 2 lau 3pn hxh q10 gia 9ty" });
    check("KHEN-AI-01 lời bot 'hẻm sâu…' (chủ không nói hẻm sâu) → bỏ câu khen, giữ câu hỏi",
      !rK.body.replies.some((x) => /hẻm sâu/.test(x)) && rK.body.replies.some((x) => /\?/.test(x)), JSON.stringify(rK.body.replies));
    globalThis.__model.parse = (p) => laSoat(p)
      ? { nhan_xet: [{ cau: "Nhà mình hẻm xe hơi, trệt 2 lầu ạ.", khang_dinh: "hẻm xe hơi", can_cu: "hxh" }] }
      : aiRao()(p);
    globalThis.__model.create = () => "Nhà mình hẻm xe hơi, trệt 2 lầu ạ. Nhà mình ở phường nào anh chị?";
    const rK2 = await send({ external_user_id: "khen-2", text: "ban nha 4x15 tret 2 lau 3pn hxh q10 gia 9ty" });
    check("KHEN-AI-02 nhận xét CÓ căn cứ ('hxh' trong tin) → giữ nguyên",
      rK2.body.replies.some((x) => /hẻm xe hơi, trệt 2 lầu/.test(x)), JSON.stringify(rK2.body.replies));
    globalThis.__model.create = undefined;
    globalThis.__cauHinh = cuCH;
  }
  // 01/10/2026 (bắn thật lx-tam-12; chủ dự án: "trong data có danh sách … phường xã rồi mà nếu gần giống thì lôi ra"): đang hỏi
  // phường, "156 đường 59 Tây Thông Hội" (đảo chữ) → Phường Thông Tây Hội theo bảng wards; phường AI đoán (Xã Tân Thông Hội) không đè.
  {
    const cuCH = globalThis.__cauHinh;
    fresh((d) => { seedKho(d); d.t.wards = napPhuongThat().map((w) => ({ ...w })); });
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: null } : OUT();
    await send({ external_user_id: "tdp-1", text: "Cần bán nhà 4 tầng hẻm xe hơi quận Gò Vấp, dt 50m2, giá 6 tỷ 5" });
    const LT = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LT.id, question: "phuong", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], cap_nhat: [], xac_nhan: [], tra_loi: null,
      truong: [{ khoa: "phuong", gia_tri: "Xã Tân Thông Hội", trich_dan: "Tây Thông Hội", can: null }] } : OUT();
    const rT = await send({ external_user_id: "tdp-1", text: "156 đường 59 Tây Thông Hội" });
    const LT2 = db().t.listings.at(-1);
    check("TDP-01 đang hỏi phường, '156 đường 59 Tây Thông Hội' → phường 'Phường Thông Tây Hội' (từ điển wards), không ghi Tân Thông Hội / Củ Chi",
      /Thông Tây Hội/.test(LT2.ward ?? "") && !db().t.listing_facts.some((f) => f.listing_id === LT.id && f.question === "phuong" && /Tân Thông Hội|Củ Chi/.test(f.answer)),
      JSON.stringify({ ward: LT2.ward, ph: db().t.listing_facts.filter((f) => f.listing_id === LT.id && f.question === "phuong"), rep: rT.body.replies }));
    check("TDP-02 'nhà 4 tầng' không thành nhà cấp 4", LT.property_type !== "nha_cap4", LT.property_type);
    globalThis.__cauHinh = cuCH;
  }
  // 01/10/2026 (chủ dự án: "làm hàm dò địa danh chung đi … nếu 137/28 thì là hẻm rồi, đường số 59 hoặc đường có tên là
  // đường lớn"): tên trơn dò cả bốn từ điển (tim_dia_danh); số nhà trơn + tên đường → hỏi đường trước nhà thay câu hẻm.
  {
    const cuCH = globalThis.__cauHinh;
    const phuongCu = await napPhuongCuThat();
    const datTuDien = (d) => {
      seedKho(d);
      d.t.wards = napPhuongThat().map((w) => ({ ...w }));
      d.t.phuong_cu = phuongCu.map((p) => ({ ...p }));
      d.t.quan_cu = [...new Set(d.t.wards.map((w) => w.quan_cu))].map((ten) => ({ ten }));
      d.t.duong = [{ ten: "Tây Thạnh", loai: "duong", quan_cu: "Quận Tân Phú", phuong: "Phường Tây Thạnh", tinh: "TP.HCM" }];
    };
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    const imAi = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: null } : OUT();
    const hoiPhuong = (lid) => {
      db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
      db().insert("info_requests", { listing_id: lid, question: "phuong", status: "pending" });
    };

    fresh(datTuDien);
    globalThis.__model.parse = imAi;
    await send({ external_user_id: "dd-1", text: "Cần bán nhà hẻm xe hơi quận Tân Phú, dt 50m2, 3 tầng, giá 6 tỷ" });
    const L1 = db().t.listings.at(-1);
    hoiPhuong(L1.id);
    const r1 = await send({ external_user_id: "dd-1", text: "tây thạnh nha em" });
    check("DD-01 đang hỏi phường, 'tây thạnh nha em' (vừa là đường vừa là phường) → Phường Tây Thạnh",
      db().t.listings.at(-1).ward === "Phường Tây Thạnh", JSON.stringify({ ward: db().t.listings.at(-1).ward, rep: r1.body.replies }));

    fresh(datTuDien);
    globalThis.__model.parse = imAi;
    await send({ external_user_id: "dd-2", text: "Cần bán nhà hẻm xe hơi quận Gò Vấp, dt 50m2, 3 tầng, giá 6 tỷ" });
    const L2 = db().t.listings.at(-1);
    hoiPhuong(L2.id);
    const r2 = await send({ external_user_id: "dd-2", text: "thong tay hoj" });
    check("DD-02 'thong tay hoj' (không dấu, sai 1 ký tự) → Phường Thông Tây Hội",
      db().t.listings.at(-1).ward === "Phường Thông Tây Hội", JSON.stringify({ ward: db().t.listings.at(-1).ward, rep: r2.body.replies }));

    fresh(datTuDien);
    globalThis.__model.parse = imAi;
    await send({ external_user_id: "dd-3", text: "Cần bán nhà hẻm xe hơi, dt 50m2, 3 tầng, giá 6 tỷ" });
    const L3 = db().t.listings.at(-1);
    hoiPhuong(L3.id);
    const r3 = await send({ external_user_id: "dd-3", text: "quận binh thanh nha" });
    const L3b = db().t.listings.at(-1);
    check("DD-03 tin chưa có quận, 'quận binh thanh nha' → quận Bình Thạnh, không ghi phường bừa",
      L3b.district === "Quận Bình Thạnh" && !/b[iì]nh th[aạ]nh/i.test(L3b.ward ?? ""), JSON.stringify({ ward: L3b.ward, district: L3b.district, rep: r3.body.replies }));
    fresh(datTuDien);
    globalThis.__model.parse = imAi;
    await send({ external_user_id: "dd-6", text: "Cần bán nhà hẻm xe hơi, dt 50m2, 3 tầng, giá 16 tỷ" });
    const L6 = db().t.listings.at(-1);
    hoiPhuong(L6.id);
    const r6 = await send({ external_user_id: "dd-6", text: "thao dien a" });
    check("DD-04 phường CŨ 'thao dien' (Thủ Đức cũ) → phường mới Phường An Khánh",
      db().t.listings.at(-1).ward === "Phường An Khánh", JSON.stringify({ ward: db().t.listings.at(-1).ward, rep: r6.body.replies }));

    // Các ca đường cũ KHÔNG tự lo (đo 01/10 bằng cách tắt tim_dia_danh): quận gõ sai, phường cũ / phường gõ sai khi câu
    // đang treo là câu khác — đường cũ ghi nguyên chữ thô "phường thảo điền".
    for (const [ma, q, t, mong] of [
      ["DD-05", "phuong", "quan binh thnh", (l) => l.district === "Quận Bình Thạnh" && !l.ward],
      ["DD-06", "gia", "phường thảo điền", (l) => l.ward === "Phường An Khánh"],
      ["DD-07", "vi_tri", "phường tay thnh", (l) => l.ward === "Phường Tây Thạnh"],
    ]) {
      fresh(datTuDien);
      globalThis.__model.parse = imAi;
      await send({ external_user_id: "dx-1", text: "Cần bán nhà hẻm xe hơi, dt 50m2, 3 tầng, giá 16 tỷ" });
      const Lx = db().t.listings.at(-1);
      db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
      db().insert("info_requests", { listing_id: Lx.id, question: q, status: "pending" });
      const rx = await send({ external_user_id: "dx-1", text: t });
      const Ly = db().t.listings.at(-1);
      check(`${ma} đang hỏi ${q}, '${t}' → dò địa danh chung`, mong(Ly), JSON.stringify({ ward: Ly.ward, district: Ly.district, rep: rx.body.replies }));
    }

    // 01/10/2026 (bắn thử lx-dd-51): phường khách nói thuộc QUẬN KHÁC quận tin đang ghi → hỏi lại, không ghi thẳng.
    const aiPhuong = (ten, trich) => (p) => laLuotBocRao(p)
      ? { so_can: 0, kien_thuc: [], cap_nhat: [], xac_nhan: [], tra_loi: null, truong: [{ khoa: "phuong", gia_tri: ten, trich_dan: trich, can: null }] } : OUT();
    for (const [ma, tra, mong] of [
      ["LQ-02", "tân phú em", (l) => l.ward === "Phường Tây Thạnh" && /Tân Phú/.test(l.district ?? "")],
      ["LQ-03", "đúng rồi", (l) => l.ward === "Phường Tây Thạnh" && /Tân Phú/.test(l.district ?? "")],
      ["LQ-04", "quận 5 mà em", (l) => !l.ward && l.district === "Quận 5"],
    ]) {
      fresh(datTuDien);
      globalThis.__model.parse = imAi;
      await send({ external_user_id: "lq-1", text: "Bán nhà hẻm xe hơi quận 5, 4x15, 3 tầng, giá 12 tỷ" });
      const Lq = db().t.listings.at(-1);
      hoiPhuong(Lq.id);
      globalThis.__model.parse = aiPhuong("Phường Tây Thạnh", "tay thnh");
      const rq1 = await send({ external_user_id: "lq-1", text: "tay thnh" });
      const Lq1 = db().t.listings.at(-1);
      if (ma === "LQ-02") {
        check("LQ-01 tin Quận 5, 'tay thnh' → Phường Tây Thạnh (Tân Phú) KHÔNG ghi thẳng, hỏi lại Tân Phú hay Quận 5",
          !Lq1.ward && /Tân Phú/.test((rq1.body.replies ?? []).join(" ")) && /Quận 5/.test((rq1.body.replies ?? []).join(" ")),
          JSON.stringify({ ward: Lq1.ward, rep: rq1.body.replies }));
      }
      // SRS-5.1zf: chế độ `ai` — GẬT do AI đọc (`dong_y`), luật `laDongY` chỉ đỡ khi AI không chạy.
      globalThis.__model.parse = ma === "LQ-03" ? (p) => laLuotBocRao(p) ? { ...imAi(p), dong_y: "dong_y", dong_y_trich: "đúng rồi" } : OUT() : imAi;
      const rq2 = await send({ external_user_id: "lq-1", text: tra });
      const Lq2 = db().t.listings.at(-1);
      check(`${ma} rồi khách đáp '${tra}'`, mong(Lq2), JSON.stringify({ ward: Lq2.ward, district: Lq2.district, rep: rq2.body.replies }));
    }

    // Bắn thử v309 (lx-lq-61): AI IM ở lượt "tay thnh" → luật ghi chữ thô "tay thnh"; rồi "tân phú em" → AI ghi "Phường Tân Phú".
    {
      fresh(datTuDien);
      globalThis.__model.parse = imAi;
      await send({ external_user_id: "lq-5", text: "Bán nhà hẻm xe hơi quận 5, 4x15, trệt 2 lầu, giá 12 tỷ" });
      const L5q = db().t.listings.at(-1);
      hoiPhuong(L5q.id);
      const r5a = await send({ external_user_id: "lq-5", text: "tay thnh" });
      const L5a = db().t.listings.at(-1);
      check("LQ-05 AI im, 'tay thnh' cho tin Quận 5 → không ghi chữ thô, hỏi lại Tân Phú hay Quận 5",
        !L5a.ward && /Tân Phú/.test((r5a.body.replies ?? []).join(" ")), JSON.stringify({ ward: L5a.ward, rep: r5a.body.replies }));
      globalThis.__model.parse = aiPhuong("Phường Tân Phú", "tân phú");
      const r5b = await send({ external_user_id: "lq-5", text: "tân phú em" });
      const L5b = db().t.listings.at(-1);
      check("LQ-06 rồi 'tân phú em' (AI đọc nhầm Phường Tân Phú) → Phường Tây Thạnh, Quận Tân Phú",
        L5b.ward === "Phường Tây Thạnh" && /Tân Phú/.test(L5b.district ?? ""), JSON.stringify({ ward: L5b.ward, district: L5b.district, rep: r5b.body.replies }));
    }

    // Bắn thử v310 (lx-lq-72): giữ quận cũ ("bình thạnh mà em") → AI ghi nền "Phường Bình Thạnh" dù bot vừa hỏi lại phường.
    {
      fresh(datTuDien);
      globalThis.__model.parse = imAi;
      await send({ external_user_id: "lq-7", text: "Cần bán nhà hẻm xe hơi quận Bình Thạnh 50m2 3 tầng giá 16 tỷ" });
      const L7q = db().t.listings.at(-1);
      hoiPhuong(L7q.id);
      globalThis.__model.parse = aiPhuong("Phường An Khánh", "thảo điền");
      await send({ external_user_id: "lq-7", text: "phường thảo điền" });
      globalThis.__model.parse = aiPhuong("Phường Bình Thạnh", "bình thạnh");
      const r7 = await send({ external_user_id: "lq-7", text: "bình thạnh mà em" });
      const L7 = db().t.listings.at(-1);
      check("LQ-07 tin Bình Thạnh, 'phường thảo điền' → hỏi lại; 'bình thạnh mà em' → giữ quận, KHÔNG ghi Phường Bình Thạnh, hỏi lại phường",
        !L7.ward && L7.district === "Quận Bình Thạnh" && /phường nào/i.test((r7.body.replies ?? []).join(" ")),
        JSON.stringify({ ward: L7.ward, district: L7.district, rep: r7.body.replies }));
    }

    fresh(datTuDien);
    globalThis.__model.parse = imAi;
    const r4 = await send({ external_user_id: "dd-4", text: "Bán nhà 156 Nguyễn Trãi phường 3 quận 5, 4x15, 3 tầng, giá 12 tỷ" });
    const L4 = db().t.listings.at(-1);
    const hoi4 = db().t.info_requests.filter((x) => x.listing_id === L4.id).map((x) => x.question);
    check("MT-E1 '156 Nguyễn Trãi' (số nhà trơn) → không hỏi hẻm",
      !hoi4.includes("do_rong_hem") && !/hẻm/i.test((r4.body.replies ?? []).join(" ")), JSON.stringify({ hoi4, rep: r4.body.replies }));
    fresh(datTuDien);
    globalThis.__model.parse = imAi;
    const r5 = await send({ external_user_id: "dd-5", text: "Bán nhà 137/28 Nguyễn Trãi phường 3 quận 5, 4x15, 3 tầng, giá 12 tỷ" });
    const L5 = db().t.listings.at(-1);
    const hoi5 = db().t.info_requests.filter((x) => x.listing_id === L5.id).map((x) => x.question);
    check("MT-E2 '137/28 Nguyễn Trãi' (có xẹc) → không hỏi đường trước nhà",
      !hoi5.includes("do_rong_duong"), JSON.stringify({ hoi5, rep: r5.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // 01/10/2026 (bắn thử lx-hn-62; chủ dự án: "sửa từ cái gốc nguyên nhân"): khách HỎI LẠI — AI nói có hỏi + chủ đề
  // (`hoi_lai`), thay ba bộ từ khoá. Câu hỏi không bao giờ thành thông tin; hỏi thị trường không đáp bằng giá rao.
  {
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    const aiHoi = (cau, chuDe) => (p) => laLuotBocRao(p)
      ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null },
          hoi_lai: { co_hoi: true, cau_hoi: cau, chu_de: chuDe } } : OUT();
    const moTin = async (uid) => {
      fresh(seedKho);
      // SRS-5.1zb: AI đã đọc câu rao thì ô AI không nói không do luật điền — mock đưa giá / số đo / quận như AI thật đọc ra.
      globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 1, kien_thuc: [], cap_nhat: [], xac_nhan: [], tra_loi: null, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null },
        truong: [{ khoa: "loai_bds", gia_tri: "nha_pho", trich_dan: "nhà hẻm", can: null }, { khoa: "gia", gia_tri: "15 tỷ", trich_dan: "giá 15 tỷ", can: null }, { khoa: "ngang", gia_tri: "4", trich_dan: "4x16", can: null },
          { khoa: "dai", gia_tri: "16", trich_dan: "4x16", can: null }, { khoa: "quan", gia_tri: "Quận 1", trich_dan: "quận 1", can: null }] } : OUT();
      await send({ external_user_id: uid, text: "Bán nhà hẻm 5m Trần Hưng Đạo quận 1, 4x16, giá 15 tỷ" });
      const L = db().t.listings.at(-1);
      db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
      db().insert("info_requests", { listing_id: L.id, question: "phuong", status: "pending" });
      return L;
    };
    for (const [ma, cau, chuDe] of [
      ["HN-01", "bao lâu thì bán được em", "dich_vu"],
      ["HN-02", "giá khu này giờ sao em", "thi_truong"],
      ["HN-03", "ben minh co doc quyen ko", "dich_vu"],
      ["HN-04", "khu này dễ bán hông em", "thi_truong"],
    ]) {
      const L = await moTin(`hn-${ma}`);
      globalThis.__model.parse = aiHoi(cau, chuDe);
      const r = await send({ external_user_id: `hn-${ma}`, text: cau });
      const facts = db().t.listing_facts.filter((f) => f.listing_id === L.id && (f.question === "bo_sung" || f.question === "phuong"));
      const rep = (r.body.replies ?? []).join(" ");
      check(`${ma} khách hỏi lại '${cau}' (AI: ${chuDe}) → không ghi làm thông tin, không đáp giá rao, thôi câu phường (không hỏi lại)`,
        !facts.length && !/đang rao là/.test(rep) && !db().t.info_requests.some((x) => x.listing_id === L.id && x.question === "phuong" && x.status === "pending"),
        JSON.stringify({ facts, rep: r.body.replies }));
    }
    // 02/10/2026 (test tay chủ dự án: "nếu lấy thông tin ra thì phải ghi vì sao có cái này, người ta hỏi sao em biết nhà 4-6 tầng
    // nó ko trả lời dc"; SRS-5.1ze): bot đáp "Dạ em là trợ lý AI…". AI xếp câu "sao em biết" vào chủ đề `nguon` → lệnh cho model
    // phải nói NGUỒN (chủ nhà nói / kho dự án / nhận nói nhầm).
    for (const [ma, cau] of [["HN-09", "sao em biết nhà 4-6 tầng"], ["HN-10", "ai nói với em là có thang máy vậy"]]) {
      await moTin(`hn-${ma}`);
      globalThis.__model.parse = aiHoi(cau, "nguon");
      let lenh = "";
      globalThis.__model.create = (p) => { lenh += JSON.stringify(p.messages ?? p); return "Dạ em nói nhầm ạ, em xin lỗi. Nhà mình mấy tầng ạ?"; };
      const r = await send({ external_user_id: `hn-${ma}`, text: cau });
      globalThis.__model.create = undefined;
      const rep = (r.body.replies ?? []).join(" ");
      check(`${ma} chủ nhà hỏi '${cau}' (AI: nguon) → lệnh model đòi nói NGUỒN, không đáp 'em là trợ lý AI'`,
        /SAO BIẾT/.test(lenh) && /KHO DỰ ÁN/.test(lenh) && !/trợ lý AI/.test(rep), JSON.stringify({ rep: r.body.replies, coLenh: /SAO BIẾT/.test(lenh) }));
    }
    // Bắn thử v312 (lx-hn-91/92): câu hệ thống không có dữ liệu → nói thật + chuyển người phụ trách (escalation), không để
    // model tự trả lời; AI nói là câu hỏi thì luật không đọc dữ liệu từ câu hỏi ("ký hợp đồng gì không" ≠ pháp lý).
    for (const [ma, cau, chuDe, mongRep] of [
      ["HN-06", "ký hợp đồng gì không em", "dich_vu", /phụ trách/],
      ["HN-07", "giá khu này giờ sao em", "thi_truong", /chưa có số liệu/],
      ["HN-08", "tin của anh ai xem được vậy", "dich_vu", /phụ trách/],
    ]) {
      const L = await moTin(`hn-${ma}`);
      const truocNhac = db().t.reminders.filter((x) => x.kind === "escalation").length;
      globalThis.__model.parse = aiHoi(cau, chuDe);
      const r = await send({ external_user_id: `hn-${ma}`, text: cau });
      const facts = db().t.listing_facts.filter((f) => f.listing_id === L.id && ["phap_ly", "bo_sung", "phuong"].includes(f.question));
      const rep = (r.body.replies ?? []).join(" ");
      const nhac = db().t.reminders.filter((x) => x.kind === "escalation").length - truocNhac;
      // 01/10/2026: việc "❓" là tin cho NGƯỜI PHỤ TRÁCH — không gắn seller_id (có seller_id là tin gửi chủ nhà, FR-144).
      const viecHoi = db().t.reminders.filter((x) => x.kind === "escalation" && /^❓/.test(x.note ?? "")).at(-1);
      check(`${ma} '${cau}' (AI: ${chuDe}) → nói thật + chuyển người phụ trách (không gắn seller_id), không ghi dữ liệu, không đáp số khách`,
        !facts.length && mongRep.test(rep) && !/chưa có khách|đang rao là/.test(rep) && nhac === 1 && !!viecHoi && !viecHoi.seller_id,
        JSON.stringify({ facts, nhac, rep: r.body.replies }));
      // Hỏi lại y câu đó trong 24 giờ → không đẻ thêm nhắc việc.
      const r2 = await send({ external_user_id: `hn-${ma}`, text: cau });
      void r2;
      if (ma === "HN-06") check("HN-06b hỏi lại y câu đó → không thêm nhắc việc thứ hai", db().t.reminders.filter((x) => x.kind === "escalation").length - truocNhac === 1);
    }
    // AI nói đây là hỏi về CHÍNH TIN (giá đã ghi) → vẫn đáp bằng dữ liệu tin như cũ.
    {
      const L = await moTin("hn-05");
      globalThis.__model.parse = aiHoi("hồi nãy anh nói giá bao nhiêu nhỉ", "tin_cua_minh");
      const r = await send({ external_user_id: "hn-05", text: "hồi nãy anh nói giá bao nhiêu nhỉ" });
      check("HN-05 'hồi nãy anh nói giá bao nhiêu nhỉ' (AI: tin_cua_minh) → đáp giá đã ghi 15 tỷ",
        /15 tỷ/.test((r.body.replies ?? []).join(" ")), JSON.stringify(r.body.replies));
      void L;
    }
    globalThis.__cauHinh = cuCH;
  }
  // 01/10/2026 (chủ dự án: "nhà nếu có 4 tấm, tầng thì hỏi có tính gác lửng ko" — tấm / tầng / lửng gọi chung là kết cấu).
  {
    fresh(seedKho);
    globalThis.__model.parse = () => OUT();
    const rL = await send({ external_user_id: "lung-1", text: "bán nhà hẻm 5m Trần Bình Trọng quận 5, 4x15, 4 tấm, giá 7 tỷ" });
    const LL = db().t.listings.at(-1);
    check("LUNG-01 rao '4 tấm' (không nói lầu / lửng) → câu hỏi 'kết cấu 4 tấm đó có tính cả gác lửng không', gợi ý cất ở boc_tach",
      rL.body.replies.some((x) => /kết cấu 4 tấm đó có tính cả gác lửng không/.test(x)) && LL.boc_tach?.lung_goi_y?.n === 4,
      JSON.stringify({ rep: rL.body.replies, bt: LL.boc_tach }));
    const rL2 = await send({ external_user_id: "lung-1", text: "có em" });
    const LL2 = db().t.listings.at(-1);
    check("LUNG-02 đáp 'có em' → kết cấu 'trệt + lửng + 2 lầu' (floors 3), gợi ý xoá, nói lại kết cấu và hỏi tiếp câu đang chờ",
      LL2.floors === 3 && LL2.floors_text === "trệt + lửng + 2 lầu" && LL2.boc_tach?.lung_goi_y === false &&
        rL2.body.replies.some((x) => /trệt \+ lửng \+ 2 lầu/.test(x) && /\?/.test(x)),
      JSON.stringify({ rep: rL2.body.replies, f: LL2.floors, ft: LL2.floors_text }));
    // 05/10/2026 (SRS-5.1zzb, test Zalo 17:30): "có em ơi" (có "ơi") từng rơi khỏi danh sách từ đáp → không ghi lửng, bot hỏi câu khác.
    fresh(seedKho);
    globalThis.__model.parse = () => OUT();
    await send({ external_user_id: "lung-1b", text: "nhà anh là nhà phố, 4 tầng, hẻm 5m Trần Bình Trọng quận 5, 4x15, giá 7 tỷ" });
    const rL2b = await send({ external_user_id: "lung-1b", text: "có em ơi" });
    const LL2b = db().t.listings.at(-1);
    check("LUNG-02b đáp 'có em ơi' (cách nói mới) → kết cấu 'trệt + lửng + 2 lầu', không coi là không trả lời",
      LL2b.floors === 3 && LL2b.floors_text === "trệt + lửng + 2 lầu" && rL2b.body.replies.some((x) => /trệt \+ lửng \+ 2 lầu/.test(x)),
      JSON.stringify({ rep: rL2b.body.replies, f: LL2b.floors, ft: LL2b.floors_text, bt: LL2b.boc_tach }));
    const rL3 = await send({ external_user_id: "lung-1", text: "4 tấm em" });
    check("LUNG-03 đã hỏi một lần → không hỏi lửng lần hai",
      !rL3.body.replies.some((x) => /gác lửng/.test(x)), JSON.stringify(rL3.body.replies));
    fresh(seedKho);
    const rL4 = await send({ external_user_id: "lung-2", text: "bán nhà hẻm 5m Lê Văn Sỹ quận 3, 4x15, trệt 3 lầu, giá 7 tỷ" });
    check("LUNG-04 rao 'trệt 3 lầu' (đã rõ) → không hỏi lửng", !rL4.body.replies.some((x) => /gác lửng/.test(x)), JSON.stringify(rL4.body.replies));
    // 02/10/2026 (test tay chủ dự án, SRS-5.1ze): khách HỎI "Sao em biết nhà 4-6 tầng" → bot hỏi "kết cấu 6 tầng đó có tính cả gác
    // lửng không"; khách đáp "Nhà a 4 tầng tính cả lửng" → bot vẫn lấy 6 → "trệt + lửng + 4 lầu".
    fresh(seedKho);
    const rL7 = await send({ external_user_id: "lung-3", text: "bán nhà hẻm 5m Lê Văn Sỹ quận 3, 4x15, giá 7 tỷ" });
    void rL7;
    const rL7b = await send({ external_user_id: "lung-3", text: "sao em biết nhà 4-6 tầng" });
    check("LUNG-07 (luật, AI không chạy) khách hỏi 'sao em biết nhà 4-6 tầng' → không hỏi lửng (khoảng số không phải kết cấu)",
      !rL7b.body.replies.some((x) => /gác lửng/.test(x)), JSON.stringify(rL7b.body.replies));
    const cuCH = globalThis.__cauHinh;
    const rongL = (truong = []) => (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong, cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null } } : OUT();
    const moL = async (uid) => {
      fresh(seedKho);
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
      globalThis.__model.parse = rongL();
      await send({ external_user_id: uid, text: "ban nha hem 5m Le Van Sy quan 3, 4x15, gia 7 ty" });
      const L = db().t.listings.at(-1);
      db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
      db().insert("info_requests", { listing_id: L.id, question: "phuong", status: "pending" });
      return L;
    };
    await moL("lung-4");
    const rL5 = await send({ external_user_id: "lung-4", text: "sao em biết nhà 6 tầng vậy" });
    check("LUNG-05 (chế độ ai) khách HỎI 'sao em biết nhà 6 tầng vậy', AI không đọc ra kết cấu → không hỏi 'kết cấu 6 tầng đó có tính cả gác lửng'",
      !rL5.body.replies.some((x) => /gác lửng/.test(x)), JSON.stringify(rL5.body.replies));
    await moL("lung-5");
    globalThis.__model.parse = rongL([{ khoa: "so_tang", gia_tri: "5", trich_dan: "5 tầng", can: null }]);
    const rL8 = await send({ external_user_id: "lung-5", text: "nhà anh 5 tầng em" });
    check("LUNG-08 (chế độ ai) AI đọc so_tang 5 → hỏi 'kết cấu 5 tầng đó có tính cả gác lửng không'",
      rL8.body.replies.some((x) => /kết cấu 5 tầng đó có tính cả gác lửng không/.test(x)), JSON.stringify(rL8.body.replies));
    const L6 = await moL("lung-6");
    L6.boc_tach = { ...(L6.boc_tach ?? {}), lung_goi_y: { n: 6, dv: "tầng" } };
    globalThis.__model.parse = rongL();
    const rL6 = await send({ external_user_id: "lung-6", text: "Nhà a 4 tầng tính cả lửng" });
    const LL6 = db().t.listings.find((x) => x.id === L6.id);
    check("LUNG-06 bot hỏi '6 tầng đó có tính cả gác lửng', khách đáp 'Nhà a 4 tầng tính cả lửng' → số khách nói thắng: 'trệt + lửng + 2 lầu'",
      LL6.floors_text === "trệt + lửng + 2 lầu" && LL6.floors === 3, JSON.stringify({ ft: LL6.floors_text, f: LL6.floors, rep: rL6.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // 02/10/2026 (bắn thử thu-gapb, SRS-5.1ze): AI trả MỘT khoá ngoài danh sách (cap_nhat.khoa "gia" không thuộc KHOA_GOP, cảm xúc
  // "vui" không thuộc danh sách) → cả lượt bóc tách bị gạt, ô gấp AI đọc đúng cũng mất. Nay chỉ bỏ phần tử sai.
  {
    const cuCH = globalThis.__cauHinh;
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    const rongK = (them = {}) => (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null }, ...them } : OUT();
    globalThis.__model.parse = rongK();
    await send({ external_user_id: "khoa-sai", text: "ban nha hem 5m Le Van Sy quan 3, 4x15, gia 7 ty" });
    const L = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: L.id, question: "phuong", status: "pending" });
    globalThis.__model.parse = rongK({
      truong: [{ khoa: "gap", gia_tri: "khong", trich_dan: "được giá thì bán", can: null }, { khoa: "gia_khong_co", gia_tri: "x", trich_dan: "anh", can: null }],
      cap_nhat: [{ khoa: "gia", gia_tri: "7 tỷ", cach: "thay" }],
      cam_xuc: { muc: "vui", trich_dan: null },
    });
    const r = await send({ external_user_id: "khoa-sai", text: "từ từ anh rao, được giá thì bán em" });
    const fg = db().t.listing_facts.filter((f) => f.listing_id === L.id && f.question === "gap");
    check("KHOA-SAI-01 AI trả khoá ngoài danh sách (cap_nhat 'gia', truong 'gia_khong_co', cảm xúc 'vui') → vẫn ghi ô gấp 'không gấp' AI đọc đúng",
      fg.some((f) => f.answer === "không gấp"), JSON.stringify({ fg, rep: r.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // Đợt 1 bỏ luật từ khoá (02/10/2026, SRS-5.1zf): GẬT / BẢO ĐĂNG do AI đọc (`dong_y`), `laDongY` / `laBaoDang` chỉ đỡ khi AI
  // không chạy. Chế độ `ai`: AI nói không gật thì "ok" KHÔNG duyệt; AI nói gật thì cách nói luật không biết vẫn duyệt.
  {
    const cuCH = globalThis.__cauHinh;
    // SRS-5.1zf: ý gật do lượt AI nhỏ "Ý NGẮN CỦA LƯỢT" (doc-y-luot.ts) đọc — mock trả cùng một đối tượng cho cả hai lượt.
    const laLuotYLuot = (p) => (p?.system ?? []).some((s) => /Ý NGẮN CỦA LƯỢT/.test(s.text ?? ""));
    const aiDY = (dy, them = {}) => (p) => (laLuotBocRao(p) || laLuotYLuot(p)) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null }, ...(dy ? { dong_y: dy.dang_di ? "dong_y_dang" : dy.la, dong_y_trich: dy.trich_dan } : {}), ...them } : OUT();
    const moDY = async (uid, cau = "duyet_tin") => {
      fresh(seedKho);
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
      globalThis.__model.parse = aiDY(null);
      await send({ external_user_id: uid, text: "ban nha hem 5m Le Van Sy quan 3, 4x15, gia 7 ty" });
      const L = db().t.listings.at(-1);
      db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
      db().insert("info_requests", { listing_id: L.id, question: cau, status: "pending" });
      return L;
    };
    const duyet = (L) => !!db().t.listings.find((x) => x.id === L.id)?.chu_duyet_at;
    let L = await moDY("dy-1");
    globalThis.__model.parse = aiDY({ la: "dong_y", trich_dan: "ổn áp rồi em", dang_di: true });
    let r = await send({ external_user_id: "dy-1", text: "ổn áp rồi em, triển luôn" });
    check("DY-01 duyệt bản nháp, 'ổn áp rồi em, triển luôn' (luật từ khoá không biết), AI gật + bảo đăng → đóng dấu duyệt",
      duyet(L), JSON.stringify({ rep: r.body.replies }));
    L = await moDY("dy-2");
    globalThis.__model.parse = aiDY({ la: "khong_noi", trich_dan: null });
    r = await send({ external_user_id: "dy-2", text: "ok" });
    check("DY-02 duyệt bản nháp, 'ok' mà AI đọc là KHÔNG gật (AI quyết) → không đóng dấu duyệt",
      !duyet(L), JSON.stringify({ rep: r.body.replies }));
    L = await moDY("dy-3");
    globalThis.__model.parse = aiDY({ la: "dong_y", trich_dan: "ok em" }, { truong: [{ khoa: "gia", gia_tri: "9 tỷ 8", trich_dan: "giá 9 tỷ 8", can: null }] });
    r = await send({ external_user_id: "dy-3", text: "ok em, mà giá 9 tỷ 8 nha" });
    check("DY-03 duyệt bản nháp, 'ok em, mà giá 9 tỷ 8 nha' — gật KÈM dữ liệu là lời sửa → chưa đóng dấu duyệt",
      !duyet(L), JSON.stringify({ rep: r.body.replies }));
    // Gật sau lời HOÃN của bot (FR-235, dời xuống sau lượt AI): AI gật, không dữ liệu → "Dạ vâng ạ, em chờ … nha".
    L = await moDY("dy-4", "huong");
    const conv = db().t.conversations.at(-1);
    db().insert("messages", { conversation_id: conv.id, sender: "bot", body: "Dạ anh chị cứ thong thả, lúc nào rảnh nhắn em nha.", created_at: new Date().toISOString() });
    globalThis.__model.parse = aiDY({ la: "dong_y", trich_dan: "ừa vậy cũng được" });
    r = await send({ external_user_id: "dy-4", text: "ừa vậy cũng được" });
    check("DY-04 sau lời hoãn, 'ừa vậy cũng được' (luật không biết, AI gật) → đáp 'em chờ … nha', không hỏi tiếp",
      r.body.loai_cau === "hoan_gat" && r.body.replies.some((x) => /em chờ/.test(x)), JSON.stringify(r.body));
    globalThis.__cauHinh = cuCH;
  }
  // Đợt 3 bỏ luật từ khoá (02/10/2026, SRS-5.1zg): YÊU CẦU của chủ nhà (hỏi về tin, bao lâu bán, xin số khách, xin xoá) do lượt
  // AI nhỏ đọc (`yeu_cau`); `hoiVeTin` / `laXinSoKhach` / `laXinXoaDuLieu` chỉ đỡ khi AI không chạy. Câu thử là cách nói luật
  // KHÔNG biết (hoặc biết sai) — tắt bản sửa thì đỏ.
  {
    const cuCH = globalThis.__cauHinh;
    const laLuotYLuot = (p) => (p?.system ?? []).some((s) => /Ý NGẮN CỦA LƯỢT/.test(s.text ?? ""));
    const aiYC = (yc, them = {}) => (p) => (laLuotBocRao(p) || laLuotYLuot(p)) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null }, dong_y: "khong_noi", dong_y_trich: null, ...(yc ? { yeu_cau: yc.loai, yeu_cau_trich: yc.trich_dan, yeu_cau_o: yc.o ?? null } : {}), ...them } : OUT();
    const moYC = async (uid) => {
      fresh(seedKho);
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
      globalThis.__model.parse = aiYC(null);
      await send({ external_user_id: uid, text: "ban nha hem 5m Le Van Sy quan 3, 4x15, gia 7 ty" });
      const L = db().t.listings.at(-1);
      db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
      db().insert("info_requests", { listing_id: L.id, question: "huong", status: "pending" });
      return L;
    };
    const hoiDichVu = (cau) => ({ hoi_lai: { co_hoi: true, cau_hoi: cau, chu_de: "dich_vu" } });
    const soViecHoi = () => db().t.reminders.filter((x) => x.kind === "escalation" && /^❓/.test(x.note ?? "")).length;
    await moYC("yc-1");
    let cau = "bao lâu thì có người mua vậy em";
    globalThis.__model.parse = aiYC({ loai: "hoi_bao_lau_ban", trich_dan: "bao lâu thì có người mua" }, hoiDichVu(cau));
    let r = await send({ external_user_id: "yc-1", text: cau });
    check("YC-01 'bao lâu thì có người mua vậy em' (AI: hỏi bao lâu bán) → bot tự trả lời 'tuỳ giá và khu vực', KHÔNG chuyển người phụ trách",
      r.body.replies.some((x) => /tuỳ giá và khu vực/.test(x)) && soViecHoi() === 0 && !r.body.replies.some((x) => /nhờ anh chị phụ trách/.test(x)), JSON.stringify({ rep: r.body.replies, n: soViecHoi() }));
    await moYC("yc-2");
    globalThis.__model.parse = aiYC({ loai: "hoi_trang_thai", trich_dan: "tin anh lên web được chưa" });
    r = await send({ external_user_id: "yc-2", text: "tin anh lên web được chưa e" });
    check("YC-02 'tin anh lên web được chưa e', tin chưa lên kệ → nói còn thiếu gì (không chỉ 'đang chờ thêm thông tin')",
      r.body.replies.some((x) => /chưa lên kệ vì còn thiếu|đủ thông tin rồi/.test(x)) && Array.isArray(r.body.thieu), JSON.stringify(r.body));
    await moYC("yc-3");
    globalThis.__model.parse = aiYC({ loai: "hoi_khach", trich_dan: "có mống nào hỏi căn nhà chưa" });
    r = await send({ external_user_id: "yc-3", text: "nay có mống nào hỏi căn nhà chưa" });
    check("YC-03 'nay có mống nào hỏi căn nhà chưa' (luật không biết) → trả lời số khách từ DB",
      r.body.hoi_ve_tin === "khach" && r.body.replies.some((x) => /chưa có khách nào hỏi/.test(x)), JSON.stringify(r.body.replies));
    await moYC("yc-4");
    globalThis.__model.parse = aiYC({ loai: "xin_so_khach", trich_dan: "đưa a cách liên lạc với người mua đi" });
    r = await send({ external_user_id: "yc-4", text: "đưa a cách liên lạc với người mua đi, a tự nói chuyện" });
    check("YC-04 'đưa a cách liên lạc với người mua đi' (luật không biết 'liên lạc') → nói thật khách mua không để lại số",
      r.body.xin_so_khach === true && r.body.replies.some((x) => /không để lại số/.test(x)), JSON.stringify(r.body.replies));
    await moYC("yc-5");
    globalThis.__model.parse = aiYC({ loai: "xin_xoa_du_lieu", trich_dan: "dẹp hết đi" });
    r = await send({ external_user_id: "yc-5", text: "anh không muốn lưu gì bên em nữa, dẹp hết đi" });
    check("YC-05 'không muốn lưu gì bên em nữa, dẹp hết đi' (luật không biết) → nói thật bot không tự xoá, nhờ người phụ trách",
      r.body.xin_xoa_du_lieu === true && r.body.replies.some((x) => /xoá dữ liệu em không tự làm được/.test(x)), JSON.stringify(r.body.replies));
    await moYC("yc-6");
    globalThis.__model.parse = aiYC({ loai: "hoi_khach", trich_dan: "em gửi thông tin khách hỏi cho anh xem" });
    r = await send({ external_user_id: "yc-6", text: "em gửi thông tin khách hỏi cho anh xem với" });
    check("YC-06 'em gửi thông tin khách hỏi cho anh xem với' — luật đọc là xin số khách, AI đọc là hỏi khách → AI quyết",
      !r.body.xin_so_khach && r.body.hoi_ve_tin === "khach", JSON.stringify(r.body));
    await moYC("yc-7");
    globalThis.__model.parse = aiYC({ loai: "xin_so_khach", trich_dan: "cho anh số khách" });
    r = await send({ external_user_id: "yc-7", text: "hướng đông nam em" });
    check("YC-07 AI nói xin số khách mà cụm trích KHÔNG có trong tin → không nhận (không đáp 'không để lại số')",
      !r.body.xin_so_khach && !r.body.replies.some((x) => /không để lại số/.test(x)), JSON.stringify(r.body.replies));
    globalThis.__cauHinh = cuCH;
  }
  // SRS-5.1zh (bắn thử câu đơn giản 02/10): "ok đăng đi" bị nhánh "đủ rồi" chặn (bot nói "em rao" mà không đăng); "đang bận tí nói
  // sau nha" bỏ dấu khớp "đang bán" + "nhà" → hỏi "căn đó hay căn khác"; tên căn "căn căn chưa rõ địa chỉ".
  {
    const cuCH = globalThis.__cauHinh;
    const laLuotYLuot = (p) => (p?.system ?? []).some((s) => /Ý NGẮN CỦA LƯỢT/.test(s.text ?? ""));
    const aiZH = (them = {}) => (p) => (laLuotBocRao(p) || laLuotYLuot(p)) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null }, can_khac: false, dong_y: "khong_noi", dong_y_trich: null, yeu_cau: "khong", yeu_cau_trich: null, ...them } : OUT();
    const moZH = async (uid, rao, cau) => {
      fresh(seedKho);
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
      globalThis.__model.parse = aiZH();
      await send({ external_user_id: uid, text: rao });
      const L = db().t.listings.at(-1);
      db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
      db().insert("info_requests", { listing_id: L.id, question: cau, status: "pending" });
      return L;
    };
    let L = await moZH("zh-1", "ban nha hem 5m Le Van Sy quan 3, 4x15, gia 7 ty", "gap");
    globalThis.__model.parse = aiZH({ y_dinh: { loai: "du_roi", trich_dan: "đăng đi" }, dong_y: "dong_y_dang", dong_y_trich: "ok đăng đi" });
    let r = await send({ external_user_id: "zh-1", text: "ok đăng đi" });
    console.log("   [zh-1]", JSON.stringify(r.body).slice(0, 400));
    check("ZH-01 'ok đăng đi' (AI: du_roi + bảo đăng) → đi nhánh ĐĂNG, không nói 'em rao với thông tin hiện tại' khi tin chưa lên kệ",
      !r.body.du_roi && !r.body.replies.some((x) => /rao với thông tin hiện tại/.test(x)), JSON.stringify(r.body));
    L = await moZH("zh-2", "ban nha hem 5m Le Van Sy quan 3, 4x15, gia 7 ty", "huong");
    globalThis.__model.parse = aiZH({ y_dinh: { loai: "du_roi", trich_dan: "thôi đủ rồi" } });
    r = await send({ external_user_id: "zh-2", text: "thôi đủ rồi em, hỏi hoài" });
    check("ZH-02 'thôi đủ rồi' khi tin chưa lên kệ → ngừng hỏi, nói thật còn thiếu gì (hoặc gửi bản nháp), KHÔNG nói 'em rao'",
      !r.body.replies.some((x) => /rao với thông tin hiện tại/.test(x)) && (r.body.replies.some((x) => /chưa lên kệ được vì còn thiếu/.test(x)) || /duyet_tin/.test(JSON.stringify(r.body))), JSON.stringify(r.body));
    L = await moZH("zh-3", "ban nha hem 5m Le Van Sy quan 3, 4x15, gia 7 ty", "phuong");
    globalThis.__model.parse = aiZH({ y_dinh: { loai: "hoan", trich_dan: "anh đang bận tí nói sau nha" } });
    r = await send({ external_user_id: "zh-3", text: "anh đang bận tí nói sau nha" });
    check("ZH-03 'anh đang bận tí nói sau nha' (bỏ dấu: 'đang bán' + 'nhà') — AI không đọc ra ý rao → KHÔNG hỏi 'căn đó hay căn khác'",
      r.body.can_cu_hay_moi !== "hoi" && !r.body.replies.some((x) => /căn đó hay căn khác/.test(x)), JSON.stringify(r.body));
    // SRS-5.1zi: lời model có "hệ thống đã gửi…" / câu khen trỏ ngược mở đầu → đường ra người bán bỏ.
    L = await moZH("zh-5", "ban nha hem 5m Le Van Sy quan 3, 4x15, gia 7 ty", "huong");
    globalThis.__model.parse = aiZH({ truong: [{ khoa: "huong", gia_tri: "Đông", trich_dan: "hướng đông", can: null }] });
    globalThis.__model.create = () => "Cái này khách hỏi nhiều lắm á.\nPhần đó hệ thống đã ghi nhận cho mình rồi nha. Nhà mình xây mấy tầng anh chị?";
    r = await send({ external_user_id: "zh-5", text: "hướng đông em" });
    globalThis.__model.create = undefined;
    check("ZH-05 lời model 'hệ thống đã ghi nhận…' và câu mở đầu trỏ ngược 'Cái này…' → không tới tay chủ nhà",
      !r.body.replies.some((x) => /hệ thống|Cái này khách hỏi/.test(x)), JSON.stringify(r.body.replies));
    // SRS-5.1zj: tên đường bằng số ("30/4") — AI đọc đúng, ngưỡng độ dài địa chỉ lúc tạo tin từng gạt mất.
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = aiZH({ truong: [
      { khoa: "loai_giao_dich", gia_tri: "ban", trich_dan: "bán nhà", can: null },
      { khoa: "duong", gia_tri: "30/4", trich_dan: "đường 30/4", can: null },
      { khoa: "quan", gia_tri: "Quận Tân Phú", trich_dan: "quận Tân Phú", can: null },
      { khoa: "gia", gia_tri: "12 tỷ", trich_dan: "giá 12 tỷ", can: null },
    ] });
    r = await send({ external_user_id: "zh-6", text: "bán nhà mặt tiền đường 30/4 quận Tân Phú, 4x18, giá 12 tỷ" });
    const L6 = db().t.listings.at(-1);
    check("ZH-06 'mặt tiền đường 30/4' (AI: duong '30/4') → tin có địa chỉ 'đường 30/4', không trống",
      /đường 30\/4/.test(String(L6?.location_raw ?? "")) || db().t.listing_facts.some((f) => f.listing_id === L6?.id && f.question === "vi_tri" && /đường 30\/4/.test(f.answer)),
      JSON.stringify({ loc: L6?.location_raw, facts: db().t.listing_facts.filter((f) => f.listing_id === L6?.id).map((f) => [f.question, f.answer]) }));
    // SRS-5.1zk (chủ dự án: "mấy hàm sql ngu quá thay bằng AI tự ghi đi"): địa chỉ AI viết đi thẳng (bỏ bề rộng hẻm, luật không
    // ghép lại "6m"), tên đường AI đọc ghi thẳng cột street.
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = aiZH({ truong: [
      { khoa: "loai_giao_dich", gia_tri: "ban", trich_dan: "bán nhà", can: null },
      { khoa: "duong", gia_tri: "88 hẻm Tân Kỳ Tân Quý", trich_dan: "88 hẻm 6m Tân Kỳ Tân Quý", can: null },
      { khoa: "ten_duong", gia_tri: "Tân Kỳ Tân Quý", trich_dan: "88 hẻm 6m Tân Kỳ Tân Quý", can: null },
      { khoa: "do_rong_hem", gia_tri: "6", trich_dan: "hẻm 6m", can: null },
      { khoa: "quan", gia_tri: "Quận Tân Phú", trich_dan: "quận Tân Phú", can: null },
      { khoa: "gia", gia_tri: "6 tỷ 5", trich_dan: "giá 6 tỷ 5", can: null },
    ] });
    r = await send({ external_user_id: "zh-7", text: "bán nhà số 88 hẻm 6m Tân Kỳ Tân Quý quận Tân Phú, 4x15, giá 6 tỷ 5" });
    const L7 = db().t.listings.at(-1);
    check("ZH-07 'số 88 hẻm 6m Tân Kỳ Tân Quý' → địa chỉ AI '88 hẻm Tân Kỳ Tân Quý' (không '6m'), street 'Tân Kỳ Tân Quý' do AI ghi",
      L7?.location_raw === "88 hẻm Tân Kỳ Tân Quý" && L7?.street === "Tân Kỳ Tân Quý", JSON.stringify({ loc: L7?.location_raw, street: L7?.street }));
    L = await moZH("zh-8", "ban nha Tan Binh, 4x12, gia 5 ty", "vi_tri");
    L.street = null;
    globalThis.__model.parse = aiZH({
      truong: [
        { khoa: "duong", gia_tri: "45 hẻm Cộng Hòa", trich_dan: "45 hẻm rộng 4 mét Cộng Hòa", can: null },
        { khoa: "ten_duong", gia_tri: "Cộng Hòa", trich_dan: "45 hẻm rộng 4 mét Cộng Hòa", can: null },
      ],
      tra_loi: { co_tra_loi: true, gia_tri: "45 hẻm Cộng Hòa", trich_dan: "45 hẻm rộng 4 mét Cộng Hòa" },
    });
    r = await send({ external_user_id: "zh-8", text: "nhà ở 45 hẻm rộng 4 mét Cộng Hòa em" });
    check("ZH-08 trả lời câu địa chỉ '45 hẻm rộng 4 mét Cộng Hòa' (cách nói mới) → địa chỉ '45 hẻm Cộng Hòa', street 'Cộng Hòa'",
      L.location_raw === "45 hẻm Cộng Hòa" && L.street === "Cộng Hòa", JSON.stringify({ loc: L.location_raw, street: L.street, facts: db().t.listing_facts.filter((f) => f.listing_id === L.id).map((f) => [f.question, f.answer]) }));
    // SRS-5.1zk (bắn thử thu-dc4-08): đang hỏi PHƯỜNG, khách trả lời bằng địa chỉ có bề rộng hẻm → địa chỉ của AI, không của luật.
    L = await moZH("zh-9", "ban nha Binh Thanh 4x14 gia 7 ty", "phuong");
    L.location_raw = null; L.street = null; L.ward = null;
    globalThis.__model.parse = aiZH({ truong: [
      { khoa: "duong", gia_tri: "77 hẻm Xô Viết Nghệ Tĩnh", trich_dan: "77 hẻm 3m Xô Viết Nghệ Tĩnh", can: null },
      { khoa: "ten_duong", gia_tri: "Xô Viết Nghệ Tĩnh", trich_dan: "77 hẻm 3m Xô Viết Nghệ Tĩnh", can: null },
      { khoa: "do_rong_hem", gia_tri: "3", trich_dan: "hẻm 3m", can: null },
    ] });
    r = await send({ external_user_id: "zh-9", text: "nhà ở 77 hẻm 3m Xô Viết Nghệ Tĩnh em" });
    check("ZH-09 hỏi phường, khách đáp '77 hẻm 3m Xô Viết Nghệ Tĩnh' → địa chỉ '77 hẻm Xô Viết Nghệ Tĩnh' (AI), street 'Xô Viết Nghệ Tĩnh'",
      L.location_raw === "77 hẻm Xô Viết Nghệ Tĩnh" && L.street === "Xô Viết Nghệ Tĩnh", JSON.stringify({ loc: L.location_raw, street: L.street, rep: r.body.replies }));
    // SRS-5.1zo (bắn thử thu-dc4-11): kho dự án khớp GẦN ĐÚNG cả câu ("Phan Xích Long … Phú Nhuận" ~ "KDC Phước Long B - Phú Nhuận")
    // — chế độ `ai` chỉ gắn dự án khi AI đọc ra tên dự án; tra kho bằng tên đó.
    {
      const daGia = { id: "da-pl", name: "KDC Phước Long B - Phú Nhuận", district: "TP Thủ Đức", ward: "Phường Phước Long B" };
      const goiMp = [];
      fresh(seedKho);
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
      globalThis.__rpc = { match_projects: (_db, a) => { goiMp.push(a.p_text); return { data: /phu nhuan|phú nhuận|sunrise/i.test(a.p_text) ? [daGia] : [], error: null }; } };
      globalThis.__model.parse = aiZH({ truong: [
        { khoa: "loai_giao_dich", gia_tri: "ban", trich_dan: "bán nhà", can: null },
        { khoa: "duong", gia_tri: "Phan Xích Long", trich_dan: "Phan Xích Long", can: null },
        { khoa: "quan", gia_tri: "Quận Phú Nhuận", trich_dan: "Phú Nhuận", can: null },
        { khoa: "gia", gia_tri: "10 tỷ", trich_dan: "giá 10 tỷ", can: null },
      ] });
      await send({ external_user_id: "zh-10", text: "bán nhà hẻm xe hơi 6 mét Phan Xích Long Phú Nhuận, 4x15, giá 10 tỷ" });
      const L10 = db().t.listings.at(-1);
      check("ZH-10 'Phan Xích Long Phú Nhuận', AI không nói dự án → không gắn dự án, không lấy phường Phước Long B",
        !L10?.project_id && L10?.ward !== "Phường Phước Long B" && !goiMp.some((t) => /Phan Xích Long/.test(t)),
        JSON.stringify({ project: L10?.project_id, ward: L10?.ward, goiMp }));
      fresh(seedKho);
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
      goiMp.length = 0;
      globalThis.__rpc = { match_projects: (_db, a) => { goiMp.push(a.p_text); return { data: /sunrise/i.test(a.p_text) ? [{ id: "da-sr", name: "Sunrise City", district: "Quận 7", ward: null }] : [], error: null }; } };
      globalThis.__model.parse = aiZH({ truong: [
        { khoa: "loai_giao_dich", gia_tri: "ban", trich_dan: "bán căn hộ", can: null },
        { khoa: "loai_bds", gia_tri: "chung_cu", trich_dan: "căn hộ", can: null },
        { khoa: "du_an", gia_tri: "Sunrise City", trich_dan: "Sunrise City", can: null },
        { khoa: "gia", gia_tri: "4 tỷ 2", trich_dan: "giá 4 tỷ 2", can: null },
      ] });
      await send({ external_user_id: "zh-11", text: "bán căn hộ Sunrise City 2pn 76m2 giá 4 tỷ 2" });
      const L11 = db().t.listings.at(-1);
      // (Lượt tra bằng cả câu còn lại là khối NGỮ CẢNH dự án cho lời bot — có chữ "căn hộ" — không ghi vào tin.)
      check("ZH-11 AI đọc ra dự án 'Sunrise City' → tra kho bằng TÊN đó, gắn dự án", L11?.project_id === "da-sr" && goiMp.includes("Sunrise City"),
        JSON.stringify({ project: L11?.project_id, goiMp }));
      globalThis.__rpc = {};
    }
    L = await moZH("zh-4", "ban nha hem 3m Tan Binh, 4x12, gia 5 ty", "phuong");
    L.location_raw = null; L.ward = null; L.district = "Quận Tân Bình";
    globalThis.__model.parse = aiZH({ y_dinh: { loai: "ban_roi", trich_dan: "bán rồi" } });
    r = await send({ external_user_id: "zh-4", text: "nhà anh bán rồi em ơi" });
    check("ZH-04 báo bán rồi, tin chỉ có quận → 'căn ở Quận Tân Bình', không 'căn căn chưa rõ địa chỉ'",
      r.body.replies.some((x) => /căn ở Quận Tân Bình/.test(x)) && !r.body.replies.some((x) => /căn căn|chưa rõ địa chỉ/.test(x)), JSON.stringify(r.body.replies));
    // SRS-5.1zp (bộ đo N06): tin nhiều căn — mỗi căn lấy quận / giá AI đọc cho CĂN ĐÓ (theo `can` hoặc theo cụm trích nằm trong
    // đoạn của căn), không lấy quận đầu tiên của cả câu cho mọi căn.
    {
      const moN = async (uid, text, truong) => {
        fresh(seedKho);
        globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
        const truoc = new Set(db().t.listings.map((x) => x.id));
        globalThis.__model.parse = aiZH({ so_can: 2, truong });
        await send({ external_user_id: uid, text });
        return db().t.listings.filter((x) => !truoc.has(x.id));
      };
      const tq = (ds) => JSON.stringify(ds.map((x) => [x.district, x.price_raw]));
      const N6 = "Bán 2 nhà: nhà 1 ở Tân Bình 4x15 6 tỷ, nhà 2 ở Gò Vấp 4x16 5 tỷ 5";
      let ds = await moN("zh-n06", N6, [
        { khoa: "quan", gia_tri: "Quận Tân Bình", trich_dan: "Tân Bình", can: 1 }, { khoa: "gia", gia_tri: "6 tỷ", trich_dan: "6 tỷ", can: 1 },
        { khoa: "quan", gia_tri: "Quận Gò Vấp", trich_dan: "Gò Vấp", can: 2 }, { khoa: "gia", gia_tri: "5 tỷ 5", trich_dan: "5 tỷ 5", can: 2 },
      ]);
      check("ZH-12 N06 'nhà 1 ở Tân Bình …, nhà 2 ở Gò Vấp …' (AI có `can`) → hai tin Tân Bình / Gò Vấp",
        ds.length === 2 && ds.some((x) => x.district === "Quận Tân Bình") && ds.some((x) => x.district === "Quận Gò Vấp"), tq(ds));
      ds = await moN("zh-n06b", "ban 2 can: can 1 phu nhuan 4x12 7 ty, can 2 binh thanh 5x20 9 ty", [
        { khoa: "quan", gia_tri: "Phú Nhuận", trich_dan: "phu nhuan", can: null }, { khoa: "quan", gia_tri: "Bình Thạnh", trich_dan: "binh thanh", can: null },
      ]);
      check("ZH-13 (cách nói mới, không dấu, AI không đánh `can`) → gán quận theo cụm trích nằm trong đoạn của căn",
        ds.length === 2 && ds.some((x) => x.district === "Quận Phú Nhuận") && ds.some((x) => x.district === "Quận Bình Thạnh"), tq(ds));
    }
    // SRS-5.1zt (bộ đo X04): một câu vừa bán vừa mua → tin bán + hồ sơ mua của CÙNG người (AI đọc vế mua, code kiểm trích dẫn).
    {
      const moX = async (uid, text, muaKem) => {
        fresh(seedKho);
        globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
        globalThis.__model.parse = aiZH({ truong: [
          { khoa: "loai_bds", gia_tri: "chung_cu", trich_dan: "căn hộ", can: null }, { khoa: "gia", gia_tri: "3 tỷ", trich_dan: "3 tỷ", can: null },
          { khoa: "quan", gia_tri: "Quận 7", trich_dan: "q7", can: null },
        ], ...(muaKem !== undefined ? { mua_kem: muaKem } : {}) });
        const r = await send({ external_user_id: uid, text });
        return { r, b: db().t.buyers.find((x) => x.zalo_user_id === uid) };
      };
      const X4 = "em bán căn hộ q7 3 tỷ để mua nhà Bình Thạnh 6 tỷ";
      let { r: rx, b } = await moX("zh-x04", X4, { khu_vuc: "Bình Thạnh", ngan_sach: "6 tỷ", loai: "nhà", trich_dan: "mua nhà Bình Thạnh 6 tỷ" });
      check("ZH-14 X04 'bán căn hộ q7 3 tỷ để mua nhà Bình Thạnh 6 tỷ' → hồ sơ mua Bình Thạnh / 6 tỷ + câu báo đã ghi",
        /Bình Thạnh/.test(b?.preferences?.area ?? "") && b?.preferences?.budget === "6 tỷ" && rx.body.replies.some((x) => /nhu cầu mua/.test(x))
          && db().t.listings.at(-1)?.district === "Quận 7",
        JSON.stringify({ p: b?.preferences, rep: rx.body.replies }));
      ({ r: rx, b } = await moX("zh-x04b", X4, { khu_vuc: "q7", ngan_sach: "3 tỷ", loai: null, trich_dan: "mua nhà Bình Thạnh 6 tỷ" }));
      check("ZH-15 AI lấy khu / giá của căn BÁN cho vế mua → không ghi gì vào hồ sơ mua",
        !b?.preferences?.area && !b?.preferences?.budget && !rx.body.replies.some((x) => /nhu cầu mua/.test(x)), JSON.stringify(b?.preferences ?? null));
      ({ r: rx, b } = await moX("zh-x04c", "bán căn hộ q7 3 tỷ, bán xong anh tính mua căn hộ quận 2 tầm 5 tỷ rưỡi",
        { khu_vuc: "quận 2", ngan_sach: "tầm 5 tỷ rưỡi", loai: "căn hộ", trich_dan: "anh tính mua căn hộ quận 2 tầm 5 tỷ rưỡi" }));
      check("ZH-16 (cách nói mới) 'bán xong anh tính mua căn hộ quận 2 tầm 5 tỷ rưỡi' → hồ sơ mua Quận 2 / 5 tỷ rưỡi / căn hộ",
        b?.preferences?.area === "Quận 2" && b?.preferences?.budget === "tầm 5 tỷ rưỡi" && b?.preferences?.property_type === "căn hộ", JSON.stringify(b?.preferences ?? null));
      // SRS-5.1zu (bắn thử thu-x04-r): lượt AI BÓC TÁCH hỏng (model 503), lượt nhỏ vẫn đọc vế mua → luật không được lấy quận của
      // vế MUA cho tin bán. Câu nhiều quận: bỏ vế mua rồi đọc lại; không có vế mua để bỏ thì để trống quận.
      const moHong = async (uid, text, muaKem) => {
        fresh(seedKho);
        globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
        globalThis.__model.parse = (p) => {
          if (laLuotBocRao(p) && !laLuotYLuot(p)) throw new Error("503 high demand");
          return aiZH(muaKem !== undefined ? { mua_kem: muaKem } : {})(p);
        };
        await send({ external_user_id: uid, text });
        return { L: db().t.listings.at(-1), b: db().t.buyers.find((x) => x.zalo_user_id === uid) };
      };
      let h = await moHong("zh-x04d", X4, { khu_vuc: "Bình Thạnh", ngan_sach: "6 tỷ", loai: "nhà", trich_dan: "mua nhà Bình Thạnh 6 tỷ" });
      check("ZH-17 AI bóc tách hỏng, lượt nhỏ đọc vế mua → tin bán Quận 7 (không lấy Bình Thạnh của vế mua), hồ sơ mua vẫn ghi",
        h.L?.district === "Quận 7" && /Bình Thạnh/.test(h.b?.preferences?.area ?? ""), JSON.stringify({ q: h.L?.district, p: h.b?.preferences ?? null }));
      h = await moHong("zh-x04e", "ban can ho quan 7 gia 3 ty, con nha go vap thi de sau", undefined);
      check("ZH-18 (cách nói mới, không dấu) AI hỏng + câu nhắc hai quận, không có vế mua để bỏ → không đoán quận (để trống, bot hỏi)",
        h.L && !h.L.district, JSON.stringify({ q: h.L?.district ?? null }));
    }
    globalThis.__cauHinh = cuCH;
  }
  // SRS-5.1zl (giảm egress): lượt bot không kéo nguyên bảng bot_prompts — chỉ khoá DB KHÁC bản code (doc_prompt_khac).
  {
    fresh(seedKho);
    globalThis.__db.t.bot_prompts = globalThis.__db.t.bot_prompts.filter((r) => r.key !== "loi_chao");
    globalThis.__db.insert("bot_prompts", { key: "loi_chao", content: LOI_CHAO }); // trùng bản code
    globalThis.__db.insert("bot_prompts", { key: "fee_rules", content: "Luật phí sửa tay: chỉ nói khi hỏi." }); // khác bản code
    // Gói cấu hình nhớ 60 s theo isolate (bộ e2e chạy một tiến trình) → đẩy đồng hồ qua 61 s cho lượt này nạp lại.
    const nowGoc = Date.now; const lech = Date.now() + 61e3 - nowGoc(); Date.now = () => nowGoc() + lech;
    try { await send({ external_user_id: "eg-1", text: "bán nhà hẻm 4m Nguyễn Trãi quận 5 giá 8 tỷ" }); } finally { Date.now = nowGoc; }
    const goi = globalThis.__db.log.filter((x) => x.rpc === "doc_prompt_khac");
    const keoBang = globalThis.__db.log.some((x) => x.table === "bot_prompts" && x.op === "select");
    const tra = goi.length ? new RpcTra(goi[0]) : null;
    check("EG-01 lượt bot hỏi doc_prompt_khac (không select cả bảng bot_prompts); khoá trùng code không trả, khoá sửa tay có trả",
      goi.length >= 1 && !keoBang && tra && !tra.co("loi_chao") && tra.co("fee_rules") && tra.co("cau_hoi_mau"),
      JSON.stringify({ goi: goi.length, keoBang, khoa: tra?.khoa }));
  }
  // SRS-5.1zg nhánh MUA: xin hình mà chưa rõ căn → hỏi lại căn nào; hỏi tiện ích → kèm link Google Maps tìm sẵn.
  {
    fresh(seedKho);
    globalThis.__model.parse = () => OUT({ replies: ["Dạ anh/chị tìm khu nào ạ?"] });
    await send({ external_user_id: "mh-1", text: "tôi đang tìm mua nhà để ở" });
    globalThis.__model.parse = () => OUT({ xin_hinh: "cho em coi mặt tiền căn đó", replies: ["Dạ em gửi hình liền ạ"] });
    let r = await send({ external_user_id: "mh-1", text: "cho em coi mặt tiền căn đó ra sao" });
    check("MUA-HINH-01 'cho em coi mặt tiền căn đó ra sao' (không có chữ 'hình'), chưa rõ căn → hỏi lại căn nào, không hứa gửi hình",
      (r.body.photos ?? []).length === 0 && r.body.replies.some((x) => /đang nói căn nào/.test(x)) && !r.body.replies.some((x) => /gửi hình liền/.test(x)), JSON.stringify(r.body.replies));
    fresh(seedKho);
    globalThis.__model.parse = () => OUT({ replies: ["Dạ anh/chị tìm khu nào ạ?"] });
    await send({ external_user_id: "mm-1", text: "tôi đang tìm mua nhà để ở" });
    globalThis.__model.parse = () => OUT({ hoi_tien_ich: { loai: "chợ", khu_vuc: "đường Trần Hưng Đạo" }, replies: ["Dạ quanh đó em chưa có dữ liệu chợ ạ"] });
    r = await send({ external_user_id: "mm-1", text: "quanh đường Trần Hưng Đạo có chợ nào hông em" });
    const link = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("chợ gần đường Trần Hưng Đạo");
    check("MUA-MAP-01 'quanh đường Trần Hưng Đạo có chợ nào hông' → kèm link Google Maps tìm 'chợ gần đường Trần Hưng Đạo'",
      r.body.replies.some((x) => x.includes(link)), JSON.stringify(r.body.replies));
    fresh(seedKho);
    globalThis.__model.parse = () => OUT({ replies: ["Dạ anh/chị tìm khu nào ạ?"] });
    await send({ external_user_id: "mm-2", text: "tôi đang tìm mua nhà để ở" });
    globalThis.__model.parse = () => OUT({ hoi_tien_ich: { loai: "trường học", khu_vuc: "Quận 1" }, replies: ["Dạ anh/chị hỏi quanh khu nào ạ?"] });
    r = await send({ external_user_id: "mm-2", text: "gần đó có trường không em" });
    check("MUA-MAP-02 khu vực model đưa KHÔNG có trong lời khách, chưa có căn / khu vực → không gửi link bịa chỗ",
      !r.body.replies.some((x) => /google\.com\/maps/.test(x)), JSON.stringify(r.body.replies));
  }
  // 02/10/2026 (bắn lại thu-gapd sau #412, SRS-5.1ze): AI đọc đúng "được giá thì bán em" = không gấp nhưng chỉ đưa vào
  // `khong_can_hoi` (câu đã trả lời), `truong` rỗng → không ghi ô gấp. Nay giá trị ở khong_can_hoi thành đề xuất thường.
  {
    const cuCH = globalThis.__cauHinh;
    const aiK = (kch) => (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null }, khong_can_hoi: kch } : OUT();
    for (const [ma, cau, kch, mong] of [
      ["GAP-KCH-01", "được giá thì bán em", [{ khoa: "gap", ly_do: "đã trả lời", trich_dan: "được giá thì bán em", gia_tri: "khong" }], "không gấp"],
      ["GAP-KCH-02", "đang kẹt tiền lắm em", [{ khoa: "gap", ly_do: "đã trả lời", trich_dan: "đang kẹt tiền lắm", gia_tri: "co" }], "cần bán gấp"],
      ["GAP-KCH-03", "cái này khỏi hỏi em", [{ khoa: "gap", ly_do: "không áp dụng", trich_dan: "khỏi hỏi", gia_tri: null }], null],
    ]) {
      fresh(seedKho);
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
      globalThis.__model.parse = aiK([]);
      const uid = `gkch-${ma}`;
      await send({ external_user_id: uid, text: "ban nha hem 5m Le Van Sy quan 3, 4x15, gia 7 ty" });
      const L = db().t.listings.at(-1);
      db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
      db().insert("info_requests", { listing_id: L.id, question: "phuong", status: "pending" });
      globalThis.__model.parse = aiK(kch);
      const r = await send({ external_user_id: uid, text: cau });
      const fg = db().t.listing_facts.filter((f) => f.listing_id === L.id && f.question === "gap");
      check(`${ma} đang hỏi phường, '${cau}', AI để gấp ở khong_can_hoi (giá trị ${kch[0].gia_tri}) → ${mong ? `ghi gấp '${mong}'` : "không ghi gấp"}`,
        mong ? fg.some((f) => f.answer === mong) : !fg.length, JSON.stringify({ fg, rep: r.body.replies }));
    }
    globalThis.__cauHinh = cuCH;
  }
  // 02/10/2026 (test tay chủ dự án, SRS-5.1ze): "Ừ anh đang muốn bán căn nhà…" → bot gọi "anh chị" suốt. AI đọc khách tự xưng.
  {
    const cuCH = globalThis.__cauHinh;
    const aiX = (tx) => (p) => laLuotBocRao(p) ? { so_can: 1, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null }, tu_xung: tx } : OUT();
    for (const [ma, tx, mong] of [
      ["XH-AI-01", { la: "anh", trich_dan: "nhà a" }, "anh"],
      ["XH-AI-02", { la: "chị", trich_dan: "nhà a" }, null], // cụm trích không có chữ "chị" → không nhận
    ]) {
      fresh(seedKho);
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
      globalThis.__model.parse = aiX(tx);
      const uid = `xh-ai-${ma}`;
      const r = await send({ external_user_id: uid, text: "ừm nhà a ở Lê Văn Sỹ quận 3, 4x15, bán 7 tỷ" });
      const s = db().t.sellers.find((x) => x.zalo_user_id === uid);
      const coAnhChi = (r.body.replies ?? []).some((x) => /anh chị|anh\/chị/i.test(x));
      check(`${ma} 'ừm nhà a … bán 7 tỷ', AI đọc tự xưng ${JSON.stringify(tx)} → ${mong ? `gọi '${mong}', không 'anh chị'` : "không nhận (trích dẫn không có chữ đó)"}`,
        mong ? (s?.xung_ho === mong && !coAnhChi) : !s?.xung_ho, JSON.stringify({ xh: s?.xung_ho, rep: r.body.replies }));
    }
    globalThis.__cauHinh = cuCH;
  }
  // 05/10/2026 (SRS-5.1zx, hội thoại test 02/10 → hỏi bù 04/10 "…không mình?"): cách gọi khách phải học được ở MỌI chế độ có bóc
  // tách, từ TIN CŨ (AI trích tin cũ; luật quét lịch sử) — lỡ một lượt không còn là hồ sơ trống mãi.
  {
    const cuCH = globalThis.__cauHinh;
    const aiX = (tx) => (p) => laLuotBocRao(p) ? { so_can: 1, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null }, tu_xung: tx } : OUT();
    const coAnhChi = (r) => (r.body.replies ?? []).some((x) => /anh chị|anh\/chị/i.test(x));
    // XH-AI-03: chế độ `chinh` (không phải `ai`) — AI đọc tự xưng vẫn được nhận.
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = aiX({ la: "anh", trich_dan: "nhà a" });
    const r3 = await send({ external_user_id: "xh-ai-03", text: "ừm nhà a ở Lê Văn Sỹ quận 3, 4x15, bán 7 tỷ" });
    check("XH-AI-03 chế độ chinh, AI đọc tự xưng 'nhà a' → gọi 'anh', không 'anh chị'",
      db().t.sellers.find((x) => x.zalo_user_id === "xh-ai-03")?.xung_ho === "anh" && !coAnhChi(r3), JSON.stringify(r3.body.replies));
    // XH-AI-04: lượt 1 AI không thấy tự xưng, lượt 2 AI trích từ TIN CŨ → nhận.
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = aiX({ la: null, trich_dan: null });
    await send({ external_user_id: "xh-ai-04", text: "Được giá thì anh mới bán, nhà Lê Văn Sỹ quận 3, 4x15, 7 tỷ" });
    globalThis.__model.parse = aiX({ la: "anh", trich_dan: "thì anh mới bán" });
    const r4 = await send({ external_user_id: "xh-ai-04", text: "Shr" });
    check("XH-AI-04 'Shr' + AI trích 'thì anh mới bán' từ tin cũ → gọi 'anh'",
      db().t.sellers.find((x) => x.zalo_user_id === "xh-ai-04")?.xung_ho === "anh" && !coAnhChi(r4), JSON.stringify({ xh: db().t.sellers.find((x) => x.zalo_user_id === "xh-ai-04")?.xung_ho, rep: r4.body.replies }));
    // XH-LS-01: hồ sơ cũ trống cách gọi, lịch sử có 'Nhà a 4 tầng tính cả lửng' (lượt đó luật bỏ sót) → lượt sau học lại bằng luật, AI im.
    fresh((d) => {
      seedKho(d);
      const s = d.insert("sellers", { zalo_user_id: "xh-ls-01", seller_type: "ccrb", name: null, active_listing_id: null, xung_ho: null }).data;
      const c = d.insert("conversations", { seller_id: s.id, channel: "zalo_personal_test", started_at: "2026-10-02T09:19:00Z" }).data;
      d.insert("messages", { conversation_id: c.id, sender: "seller", body: "Nhà a 4 tầng tính cả lửng" });
      d.insert("messages", { conversation_id: c.id, sender: "bot", body: "Dạ em ghi nhận rồi ạ. Sổ nhà mình là sổ riêng hay sổ chung ạ?" });
    });
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = aiX({ la: null, trich_dan: null });
    const r5 = await send({ external_user_id: "xh-ls-01", text: "Shr" });
    check("XH-LS-01 hồ sơ trống, tin cũ 'Nhà a 4 tầng…' → luật học từ lịch sử, gọi 'anh', không 'anh chị' / 'mình'",
      db().t.sellers.find((x) => x.zalo_user_id === "xh-ls-01")?.xung_ho === "anh" && !coAnhChi(r5) && !(r5.body.replies ?? []).some((x) => /\bmình\s*[?.!]/.test(x)),
      JSON.stringify({ xh: db().t.sellers.find((x) => x.zalo_user_id === "xh-ls-01")?.xung_ho, rep: r5.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // 05/10/2026 (SRS-5.1zz, chủ dự án: "nó xưng mình đây này"): model nhánh bán tự xưng "mình" bằng cách nói CHƯA từng bắn
  // ("Để mình xem lại rồi báo anh", "mình cập nhật lại") → lưới mệnh đề đổi thành "em"; "Nhà mình" (gọi khách) giữ.
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model = {
      parse: (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null } } : OUT(),
      create: () => "Dạ, mình cập nhật lại rồi ạ. Để mình xem lại rồi báo anh nha. Nhà mình mấy toilet ạ?",
    };
    const rX = await send({ external_user_id: "z-ccrb", text: "ok em" });
    const repX = (rX.body.replies ?? []).filter((x) => !/^\s*(?:🤖|💾|📝|📋)/u.test(x)).join("\n");
    check("XM-E2E-01 model 'mình cập nhật / Để mình xem lại' → 'em cập nhật / Để em xem lại'; 'Nhà mình' giữ",
      repX.length > 0 && !/(?:^|[.,;:!?]\s*|Dạ,?\s+|Để\s+)[Mm]ình (?:cập nhật|xem lại)/u.test(repX) && /Nhà mình/.test(repX),
      JSON.stringify(rX.body.replies));
    globalThis.__cauHinh = cuCH;
    globalThis.__model = { parse: () => OUT() };
  }
  // 30/09/2026 (bắn thật lx-mua-e): khách MUA đã có hồ sơ nới ngân sách "vậy có căn 6 tỷ rưỡi cũng được" → cổng nới
  // `coHangCoGia` ("có căn" + giá) mở hồ sơ BÁN, tạo tin "BĐS bán", hỏi "nhà mình là nhà phố hay chung cư".
  for (const [i, cau, laBan] of [
    [0, "vậy có căn 6 tỷ rưỡi cũng được", false],
    [1, "có căn nhà 6 tỷ 5 hẻm xe hơi thì em gửi anh", false],
    [2, "à anh có căn nhà quận 10 cần bán giá 6 tỷ, 4x15", true],
  ]) {
    fresh((d) => {
      const b = d.insert("buyers", { zalo_user_id: `mua-noi-${i}`, name: null, preferences: { deal: "ban", area: "Quận 5", budget: "dưới 5 tỷ" } }).data;
      d.insert("conversations", { buyer_id: b.id, channel: "zalo_personal_test", started_at: "2026-09-30T00:00:00Z" });
    });
    const soTin = db().t.listings.length;
    const rM = await send({ external_user_id: `mua-noi-${i}`, text: cau });
    const coBan = db().t.sellers.some((x) => x.zalo_user_id === `mua-noi-${i}`);
    check(`MUA-NOI-0${i + 1} người đang có hồ sơ MUA nhắn '${cau}' → ${laBan ? "MỞ hồ sơ bán (có chữ bán)" : "KHÔNG mở hồ sơ bán, không tạo tin"}`,
      laBan ? coBan : (!coBan && db().t.listings.length === soTin),
      JSON.stringify({ coBan, tin: db().t.listings.length - soTin, rep: rM.body.replies }));
  }
  // FR-248 (30/09/2026, bắn lại trên v274). Mỗi ca ghi NGUYÊN NHÂN lỗi cũ.
  // (a) khách lưu "dưới 5 tỷ" rồi nới "vậy có căn 6 tỷ rưỡi cũng được" — `hoSoTamTuCau` chỉ đọc giá trong câu khi hồ sơ CHƯA có
  // ngân sách → kho lượt này vẫn lọc ≤ 5,75 tỷ, căn 5,8 tỷ phường 4 không tới được model, bot chỉ hứa "em sẽ để ý".
  {
    fresh((d) => { seedKho(d); const b = d.insert("buyers", { zalo_user_id: "ns-1", name: null, preferences: { deal: "ban", area: "phường 4", budget: "dưới 5 tỷ" } }).data;
      d.insert("conversations", { buyer_id: b.id, channel: "zalo_personal_test", started_at: "2026-09-30T00:00:00Z" }); });
    globalThis.__model.parse = () => OUT();
    await send({ external_user_id: "ns-1", text: "vậy có căn 6 tỷ rưỡi cũng được" });
    const qN = db().log.filter((l) => l.table === "listings" && l.op === "select" && l.filters.some((f) => f.kind === "lte" && f.col === "price_vnd")).pop();
    const lteN = qN?.filters.find((f) => f.kind === "lte" && f.col === "price_vnd").val;
    check("FR248-E1 nới ngân sách 'vậy có căn 6 tỷ rưỡi cũng được' → kho lượt này lọc theo giá MỚI (≥ 6,5 tỷ), căn 5,8 tỷ vào KHO",
      lteN >= 6.5e9 && /BDS-Q5-0001/.test(sysText(parseCalls().pop())), `lte=${lteN}`);
  }
  // (b) kho trống VÌ GIÁ ("dưới 5 tỷ", phường 4 chỉ có căn 5,8 tỷ) → bot chỉ nói "chưa có căn nào khớp", không nói căn gần nhất.
  {
    fresh((d) => { seedKho(d); const b = d.insert("buyers", { zalo_user_id: "ns-2", name: null, preferences: { deal: "ban", area: "phường 4", budget: "dưới 5 tỷ" } }).data;
      d.insert("conversations", { buyer_id: b.id, channel: "zalo_personal_test", started_at: "2026-09-30T00:00:00Z" }); });
    globalThis.__model.parse = () => OUT({ replies: ["Dạ hiện em chưa có căn nào khớp ạ."] });
    const rG = await send({ external_user_id: "ns-2", text: "có căn nào không em" });
    check("FR248-E2 kho trống vì giá → nói căn gần tầm giá nhất (5,8 tỷ Trần Hưng Đạo), không bịa",
      rG.body.replies.some((x) => /Gần tầm giá nhất/.test(x) && /5,8 tỷ/.test(x) && /Trần Hưng Đạo/.test(x)), JSON.stringify(rG.body.replies));
  }
  // (b2) bắn lại v275 (lx-mua-e3): kho CÓ căn khớp mà model chỉ "em gợi 2 căn khớp nhu cầu mình nhé:" rồi hết — câu đó không nằm
  // trong mẫu câu hứa nên luật "thay câu hứa bằng căn đầu kho" không chạy, khách không thấy căn nào.
  {
    fresh((d) => { seedKho(d); const b = d.insert("buyers", { zalo_user_id: "ns-3", name: null, preferences: { deal: "ban", area: "phường 4", budget: "tầm 6 tỷ" } }).data;
      d.insert("conversations", { buyer_id: b.id, channel: "zalo_personal_test", started_at: "2026-09-30T00:00:00Z" }); });
    globalThis.__model.parse = () => OUT({ replies: ["Dạ em gợi 2 căn khớp nhu cầu mình nhé:"] });
    const rH = await send({ external_user_id: "ns-3", text: "có căn nào không em" });
    check("FR248-E2b kho có căn, model chỉ 'em gợi 2 căn … nhé:' → thay bằng căn thật trong kho (Trần Hưng Đạo 5,8 tỷ)",
      rH.body.replies.some((x) => /Trần Hưng Đạo/.test(x) && /5,8 tỷ/.test(x)) && !rH.body.replies.some((x) => /gợi 2 căn/.test(x)), JSON.stringify(rH.body.replies));
  }
  // 30/09/2026 (bắn thử người mua, SRS-5.1h). (C) "tìm căn hộ quận 7 2 phòng ngủ dưới 3 tỷ" → model "Dạ có…" và bot đưa NHÀ PHỐ
  // QUẬN 5 6 tỷ 5: kho không lọc quận / loại, còn "dưới 3 tỷ" đọc thành {min 2,85 tỷ} ("hon" khớp trong "phòng").
  {
    fresh((d) => { seedKho(d);
      d.insert("listings", { code: "BDS-CH-Q7-0001", seller_id: d.t.sellers[0].id, deal: "ban", status: "dang_ban", location_raw: "Nguyễn Hữu Thọ", ward: "Phường Tân Hưng", district: "Quận 7", property_type: "chung_cu", price_raw: "2 tỷ 8", price_vnd: 2.8e9, area_m2: 70, bedrooms: 2 });
      d.insert("listings", { code: "BDS-NP-Q5-0099", seller_id: d.t.sellers[0].id, deal: "ban", status: "dang_ban", location_raw: "Trần Bình Trọng", ward: "Phường 1", district: "Quận 5", property_type: "nha_pho", price_raw: "2 tỷ 5", price_vnd: 2.5e9, area_m2: 30, bedrooms: 2 }); });
    globalThis.__model.parse = () => OUT({ replies: ["Dạ có, em kiếm 2PN dưới 3 tỷ ở Quận 7 ạ."] });
    await send({ external_user_id: "mua-c-1", text: "tìm căn hộ quận 7 2 phòng ngủ dưới 3 tỷ" });
    const qC = db().log.filter((l) => l.table === "listings" && l.op === "select" && l.filters.some((f) => f.kind === "lte" && f.col === "price_vnd")).pop();
    const lteC = qC?.filters.find((f) => f.kind === "lte" && f.col === "price_vnd")?.val;
    const khoC = sysText(parseCalls().pop());
    check("MUA-C1 'căn hộ quận 7 … dưới 3 tỷ' → kho có trần giá ≤ 3,45 tỷ, lọc quận + loại: có căn hộ Q7, KHÔNG có nhà phố Q5 / căn Q5 cũ",
      lteC != null && lteC <= 3.45e9 && /BDS-CH-Q7-0001/.test(khoC) && !/BDS-NP-Q5-0099|BDS-Q5-0001|BDS-Q5-0005/.test(khoC),
      JSON.stringify({ lteC, kho: (khoC.match(/#BDS-[A-Z0-9-]+/g) ?? []) }));
  }
  // (D) "dưới 5 tỷ" (đã lưu) → "vậy 7 tỷ cũng được em": kho có căn mà model chỉ hỏi lại đúng câu vừa hỏi → khách không thấy căn.
  {
    fresh((d) => { seedKho(d); const b = d.insert("buyers", { zalo_user_id: "mua-d-1", name: null, preferences: { deal: "ban", area: "phường 4", budget: "dưới 5 tỷ" } }).data;
      const cv = d.insert("conversations", { buyer_id: b.id, channel: "zalo_personal_test", started_at: "2026-09-30T00:00:00Z" }).data;
      d.insert("messages", { conversation_id: cv.id, sender: "bot", body: "Mình thích hẻm xe hơi hay mặt tiền hơn ạ?", seq: 1 }); });
    globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, budget: "7 tỷ" }, replies: ["Mình muốn hẻm xe hơi hay mặt tiền hơn vậy ạ?"] });
    const rD = await send({ external_user_id: "mua-d-1", text: "vậy 7 tỷ cũng được em" });
    check("MUA-D1 nới ngân sách, model chỉ hỏi lặp 'hẻm xe hơi hay mặt tiền' → đưa căn trong kho (Trần Hưng Đạo 5,8 tỷ), bỏ câu hỏi lặp",
      rD.body.replies.some((x) => /Trần Hưng Đạo/.test(x) && /5,8 tỷ/.test(x)) && !rD.body.replies.some((x) => /hẻm xe hơi hay mặt tiền/.test(x)),
      JSON.stringify(rD.body.replies));
    globalThis.__model.parse = () => OUT({ replies: ["Căn rẻ nhất khu này là Trần Hưng Đạo Trần Hưng Đạo Phường 4, 5,8 tỷ ạ."] });
    const rD2 = await send({ external_user_id: "mua-d-1", text: "căn nào rẻ nhất" });
    check("MUA-D2 lời model 'Trần Hưng Đạo Trần Hưng Đạo Phường 4' → 'Trần Hưng Đạo Phường 4'", rD2.body.replies.some((x) => /Trần Hưng Đạo Phường 4/.test(x)) && !rD2.body.replies.some((x) => /Trần Hưng Đạo Trần Hưng Đạo/.test(x)), JSON.stringify(rD2.body.replies));
    // 30/09/2026 (bắn lại v291): "Dạ vậy em sẽ lọc thêm mấy căn nữa cho mình ạ, chờ em một tí." đứng ngay trước danh sách căn.
    {
      fresh((d) => { seedKho(d); const b = d.insert("buyers", { zalo_user_id: "mua-d-2", name: null, preferences: { deal: "ban", area: "phường 4", budget: "dưới 5 tỷ" } }).data;
        d.insert("conversations", { buyer_id: b.id, channel: "zalo_personal_test", started_at: "2026-09-30T00:00:00Z" }); });
      globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, budget: "7 tỷ" }, replies: ["Dạ vậy em sẽ lọc thêm mấy căn nữa cho mình ạ, chờ em một tí."] });
      const rL = await send({ external_user_id: "mua-d-2", text: "vậy 7 tỷ cũng được em" });
      check("MUA-D1b đổi ngân sách, model 'em sẽ lọc thêm… chờ em một tí' → bỏ câu hứa, còn danh sách căn (Trần Hưng Đạo)",
        rL.body.replies.some((x) => /Trần Hưng Đạo/.test(x)) && !rL.body.replies.some((x) => /lọc thêm|chờ em/.test(x)), JSON.stringify(rL.body.replies));
    }
  }
  // (c) hỏi địa chỉ, khách "o q10" (chế độ chinh, AI im) → vi_tri "o q10", câu địa chỉ coi như xong, bot thôi hỏi đường.
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: "q10-1", text: "e muon ban nha" });
    const LQ = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LQ.id, question: "vi_tri", status: "pending" });
    await send({ external_user_id: "q10-1", text: "o q10" });
    const fQ = (q) => db().t.listing_facts.filter((f) => f.listing_id === LQ.id && f.question === q);
    check("FR248-E3 hỏi địa chỉ, 'o q10' → KHÔNG ghi vị trí 'o q10', câu địa chỉ vẫn treo, không vào bổ sung",
      !fQ("vi_tri").length && !fQ("bo_sung").length && db().t.info_requests.some((x) => x.listing_id === LQ.id && x.question === "vi_tri" && x.status === "pending"),
      JSON.stringify({ vt: fQ("vi_tri"), bs: fQ("bo_sung"), ir: db().t.info_requests.filter((x) => x.listing_id === LQ.id).map((x) => [x.question, x.status]) }));
    globalThis.__cauHinh = cuCH;
  }
  // (d) căn hộ, đang hỏi nội thất, khách "phí quản lý 15k/m2" (AI im) → "Không bóc tách được gì", phí mất hẳn.
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: "pql-1", text: "bán căn hộ Sunrise City quận 7 76m2 2pn tầng 12 giá 5 tỷ 2" });
    const LP = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LP.id, question: "noi_that", status: "pending" });
    await send({ external_user_id: "pql-1", text: "phí quản lý 15k/m2" });
    const fP = db().t.listing_facts.filter((f) => f.listing_id === LP.id && f.question === "phi_quan_ly");
    check("FR248-E4 đang hỏi nội thất, 'phí quản lý 15k/m2' (AI im) → ghi ô phí quản lý = '15k/m2'", fP.length === 1 && fP[0].answer === "15k/m2", JSON.stringify(fP));
    globalThis.__cauHinh = cuCH;
  }
  // (e) 30/09/2026 (bắn thử bán lx-ban-292b): đang hỏi phí quản lý, "sổ hồng rồi em, phí quản lý 15k/m2" — AI chỉ trả phí "15 nghìn",
  // im về pháp lý → pháp lý mất (bot hỏi lại "đã ra sổ hồng chưa"), phí mất "/m2".
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: "pql-2", text: "bán căn hộ Sunrise City quận 7 76m2 2pn tầng 12 giá 5 tỷ 2" });
    const LP = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LP.id, question: "phi_quan_ly", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? {
      so_can: 0, kien_thuc: [],
      truong: [{ khoa: "phi_quan_ly", gia_tri: "15 nghìn", trich_dan: "phí quản lý 15k/m2", can: null }],
      tra_loi: { co_tra_loi: true, gia_tri: "15 nghìn", trich_dan: "phí quản lý 15k/m2" },
    } : OUT();
    await send({ external_user_id: "pql-2", text: "sổ hồng rồi em, phí quản lý 15k/m2" });
    const fP = (q) => db().t.listing_facts.filter((f) => f.listing_id === LP.id && f.question === q).map((f) => f.answer);
    check("SOHONG-01 AI chỉ trả phí '15 nghìn', im pháp lý → phí giữ '/m2' + pháp lý 'sổ hồng' (không tự thêm 'riêng')",
      fP("phi_quan_ly").some((a) => /^15.*\/m2$/.test(a)) && fP("phap_ly").includes("sổ hồng") && !fP("phap_ly").some((a) => /riêng/.test(a)),
      JSON.stringify({ pql: fP("phi_quan_ly"), pl: fP("phap_ly"), ir: db().t.info_requests.filter((x) => x.listing_id === LP.id).map((x) => [x.question, x.status]) }));
    globalThis.__cauHinh = cuCH;
  }
  // FR-250 (30/09/2026, bắn thật v277 — AI bóc tách chết vì Gemini 503, luật phải tự đứng).
  // (a) "em cần bán nhà" mở tin rỗng loại nhà; câu rao "căn hộ bên thảo điền quận 2 cũ…" → `khacLoai` coi là căn khác, mở tin THỨ HAI;
  // phường không ra vì không có chữ "phường" (`phuongTenCauRao`). Nay: điền vào tin rỗng, Thảo Điền (cũ) → Phường An Khánh.
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: "td-1", text: "em cần bán nhà" });
    await send({ external_user_id: "td-1", text: "bán căn hộ bên thảo điền quận 2 cũ, 2pn 75m2, giá 8 tỷ" });
    const sTD = db().t.sellers.find((x) => x.zalo_user_id === "td-1");
    const tTD = db().t.listings.filter((l) => l.seller_id === sTD?.id);
    check("FR250-E1 'em cần bán nhà' rồi câu rao căn hộ Thảo Điền (AI im) → MỘT tin, căn hộ, Phường An Khánh, Quận 2, 8 tỷ",
      tTD.length === 1 && tTD[0].property_type === "chung_cu" && tTD[0].ward === "Phường An Khánh" && tTD[0].district === "Quận 2" && tTD[0].price_vnd === 8e9,
      JSON.stringify(tTD.map((l) => [l.property_type, l.ward, l.district, l.price_raw])));
    globalThis.__cauHinh = cuCH;
  }
  // (a2) cùng loại: "em cần bán nhà" rồi câu rao NHÀ đủ chi tiết (AI chết) — tin rỗng đang hỏi địa chỉ nên câu rao bị coi là câu
  // trả lời địa chỉ, cả câu vào "bổ sung", không ra giá / diện tích (bắn thật thu-groq-02, 30/09).
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => { if (laLuotBocRao(p)) throw new Error("Groq 413 Request too large"); return OUT(); };
    await send({ external_user_id: "td-2", text: "em cần bán nhà" });
    await send({ external_user_id: "td-2", text: "nhà hẻm xe hơi 137/28 đường số 59 an hội tây gò vấp, 4x15, 3 tầng, giá 6 tỷ 2" });
    const s2 = db().t.sellers.find((x) => x.zalo_user_id === "td-2");
    const t2 = db().t.listings.filter((l) => l.seller_id === s2?.id);
    const bs2 = db().t.listing_facts.filter((f) => t2.some((l) => l.id === f.listing_id) && f.question === "bo_sung");
    check("FR250-E1b 'em cần bán nhà' rồi câu rao nhà đủ chi tiết (AI hỏng: Groq 413) → MỘT tin, giá 6,2 tỷ, 60m², Phường An Hội Tây; không vào bổ sung",
      t2.length === 1 && t2[0].price_vnd === 6.2e9 && (Number(t2[0].area_m2) === 60 || db().t.listing_facts.some((f) => f.listing_id === t2[0].id && f.question === "dien_tich" && /4x15/.test(f.answer))) && t2[0].ward === "Phường An Hội Tây" && !bs2.length,
      JSON.stringify({ tin: t2.map((l) => [l.price_raw, l.area_m2, l.ward]), bs: bs2.map((f) => f.answer), f: db().t.listing_facts.filter((f) => t2.some((l) => l.id === f.listing_id)).map((f) => [f.question, f.answer]), loi: (db().t.bot_errors ?? []).map((e) => e.source + ":" + String(e.detail).slice(0, 80)).slice(-4) }));
    globalThis.__cauHinh = cuCH;
  }
  // (b) trả lời câu địa chỉ "nhà ở vĩnh lộc b bình chánh, hẻm 5m" → ô "vị trí cụ thể" = "vĩnh lộc b bình chánh" (chỉ tên hành chính).
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: "vl-1", text: "em cần bán nhà" });
    const LV = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LV.id, question: "vi_tri", status: "pending" });
    await send({ external_user_id: "vl-1", text: "nhà ở vĩnh lộc b bình chánh, hẻm 5m" });
    const fV = db().t.listing_facts.filter((f) => f.listing_id === LV.id && f.question === "vi_tri");
    check("FR250-E2 địa chỉ chỉ có tên xã / huyện → KHÔNG ghi vị trí cụ thể; phường Xã Tân Vĩnh Lộc, Huyện Bình Chánh vẫn ghi",
      !fV.length && !LV.location_raw && LV.ward === "Xã Tân Vĩnh Lộc" && LV.district === "Huyện Bình Chánh",
      JSON.stringify({ vt: fV, loc: LV.location_raw, ward: LV.ward, district: LV.district }));
    globalThis.__cauHinh = cuCH;
  }
  // (c) lượt đầu model viết "Cảm ơn đã tin tưởng, mình đã tạo tin rồi. Mình cho mình xin địa chỉ…" → bỏ lời "đã tạo tin", bot xưng em.
  {
    fresh(seedKho);
    const cau = "Cảm ơn đã tin tưởng, mình đã tạo tin rồi. Mình cho mình xin địa chỉ nhà (đường, phường, quận) nha?";
    globalThis.__model.parse = (p) => laLuotAnh(p) ? ANH(globalThis.__anh) : OUT({ replies: [cau] });
    globalThis.__model.create = () => cau;
    const rT = await send({ external_user_id: "tt-1", text: "em cần bán nhà" });
    const noi = rT.body.replies.filter((x) => !/^(🤖|💾|📝|📋|👤)/u.test(x)).join(" | ");
    check("FR250-E3 lời bot lượt đầu: không 'đã tạo tin', không 'cho mình xin'",
      !/tạo tin/.test(noi) && !/cho mình xin/i.test(noi), noi);
    globalThis.__model.create = undefined;
  }
  // 30/09/2026 (chủ dự án: "nhiều quy tắc quá … để lại cho AI nó làm"): công tắc `luat_loi_bot`. GỌN (production mặc định)
  // không cắt câu nhận xét thị trường / khen của model — prompt tự dặn; ĐỦ thì cắt như cũ. Luật chống bịa vẫn chạy ở cả hai.
  for (const [cheDo, conCau] of [["gon", true], ["du", false]]) {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", luat_loi_bot: cheDo };
    const cau = "Dạ em ghi nhận ạ, khách mua dạo này hỏi nhà phố nhiều lắm. Anh chị cho em xin địa chỉ nhà nha?";
    globalThis.__model.parse = (p) => laLuotAnh(p) ? ANH(globalThis.__anh) : OUT({ replies: [cau] });
    globalThis.__model.create = () => cau;
    const rL = await send({ external_user_id: `luat-${cheDo}`, text: "em cần bán nhà" });
    const noi = rL.body.replies.filter((x) => !/^(🤖|💾|📝|📋|👤)/u.test(x)).join(" | ");
    check(`LUAT-GON-${cheDo} luat_loi_bot=${cheDo} → câu 'khách mua … hỏi nhiều lắm' ${conCau ? "GIỮ (để AI quyết)" : "bị cắt"}`,
      /hỏi nhà phố nhiều lắm/.test(noi) === conCau && /xin địa chỉ/.test(noi), noi);
    globalThis.__model.create = undefined;
    globalThis.__cauHinh = cuCH;
  }
  // 06/10/2026 (SRS-5.1zzn, chủ dự án "làm bước 1 và 2"): `gon` nay tắt TOÀN BỘ van SỬA VĂN (gạch dài, gạch chéo, "mình", câu ghi
  // nhận trùng, lặp, khen, chào lại…), chỉ còn lưới an toàn + ghi đúng ô; mọi van đổi lời đều vào sổ `van_kich` (trước / sau).
  for (const [cheDo, giuNguyen] of [["gon", true], ["du", false]]) {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", luat_loi_bot: cheDo };
    const cau = "Dạ em ghi nhận ạ — anh/chị cho mình xin địa chỉ nhà nha?";
    globalThis.__model.parse = (p) => laLuotAnh(p) ? ANH(globalThis.__anh) : OUT({ replies: [cau] });
    globalThis.__model.create = () => cau;
    const rV = await send({ external_user_id: `van-${cheDo}`, text: "em cần bán nhà" });
    const noi = rV.body.replies.filter((x) => !/^(🤖|💾|📝|📋|👤)/u.test(x)).join(" | ");
    const vk = rV.body.van_kich ?? [];
    const dongVk = db().t.van_kich ?? [];
    if (giuNguyen) {
      check("VAN-01 luat_loi_bot=gon: gạch dài, 'anh/chị', 'cho mình xin' của model GIỮ NGUYÊN (van sửa văn tắt, model tự lo)",
        /—/.test(noi) && /anh\/chị/.test(noi) && /cho mình xin/.test(noi), noi);
      check("VAN-02 gon: sổ van KHÔNG có boGachDai / boGachCheo / botXungEm (không chạy thì không ghi)",
        !vk.some((v) => /boGachDai|boGachCheo|botXungEm/.test(v)), JSON.stringify(vk));
    } else {
      check("VAN-03 luat_loi_bot=du: ba lỗi đó bị sửa như cũ (bật lại ở Table Editor, không cần deploy)",
        !/—/.test(noi) && !/anh\/chị/.test(noi) && !/cho mình xin/.test(noi), noi);
      check("VAN-04 du: body.van_kich có boGachDai, boGachCheo, botXungEm; bảng van_kich có dòng nhánh ban, trước ≠ sau, có conversation_id",
        ["boGachDai", "boGachCheo", "botXungEm"].every((v) => vk.includes(v))
          && dongVk.some((d) => d.nhanh === "ban" && d.van === "boGachDai" && d.truoc !== d.sau && d.conversation_id),
        JSON.stringify({ vk, n: dongVk.length, mau: dongVk[0] }));
    }
    globalThis.__model.create = undefined;
    globalThis.__cauHinh = cuCH;
  }
  // 30/09/2026 (SRS-5.1e, chủ dự án: "2 hàm tìm theo nghĩa cho địa danh và dự án … làm đi"): tên dự án / tên đường GÕ SAI mà
  // khớp chữ không ra → tìm theo nghĩa (vector), MÁY xác nhận tên còn gần chữ khách gõ và đúng MỘT tên.
  {
    const env = globalThis.Deno.env; const getCu = env.get; env.get = (k) => k === "GEMINI_API_KEY" ? "gem-test" : getCu(k);
    const cuCH = globalThis.__cauHinh;
    const seedVin = (d) => { seedKho(d);
      d.insert("projects", { name: "Vinhomes Grand Park", slug: "vinhomes-grand-park", district: "Thành phố Thủ Đức", ward: "Phường Long Bình", amenities: [], description: "" });
      d.insert("projects", { name: "Vinhomes Central Park", slug: "vinhomes-central-park", district: "Quận Bình Thạnh", ward: null, amenities: [], description: "" }); };
    // (a) dự án gõ sai → gắn đúng dự án (vector xếp Central Park gần hơn nhưng tên không gần chữ khách → loại).
    fresh(seedVin);
    globalThis.__cauHinh = { test_reset_hello: "1", tim_theo_nghia: "bat" };
    let cauNhung = null;
    globalThis.__nhung = (t) => { cauNhung = t; return Array.from({ length: 768 }, () => 0.01); };
    globalThis.__rpc = { tim_du_an_theo_nghia: (d) => ({ data: [...d.t.projects].reverse().filter((p) => /Vinhomes/.test(p.name))
      .map((p, i) => ({ id: p.id, name: p.name, do_gan: 0.82 - i * 0.02 })), error: null }) };
    await send({ external_user_id: "nghia-da-1", text: "bán căn hộ dự án vinhome gran park 2pn 70m2 giá 3 tỷ" });
    const LD = db().t.listings.at(-1); const pGP = db().t.projects.find((p) => p.name === "Vinhomes Grand Park");
    check("NGHIA-DA-01 'dự án vinhome gran park' (khớp chữ không ra) → tìm theo nghĩa, gắn Vinhomes Grand Park, không nhầm Central Park",
      LD?.project_id === pGP.id && /^Dự án vinhome gran park$/i.test(cauNhung ?? ""), JSON.stringify({ pid: LD?.project_id, cauNhung }));
    // (b) vector chỉ ra tên KHÔNG gần chữ khách → không gắn gì.
    fresh(seedVin);
    globalThis.__rpc = { tim_du_an_theo_nghia: (d) => ({ data: d.t.projects.filter((p) => p.name === "Vinhomes Central Park")
      .map((p) => ({ id: p.id, name: p.name, do_gan: 0.9 })), error: null }) };
    await send({ external_user_id: "nghia-da-2", text: "bán căn hộ dự án vinhome gran park 2pn 70m2 giá 3 tỷ" });
    check("NGHIA-DA-02 vector chỉ trả Vinhomes Central Park (tên không gần 'vinhome gran park') → KHÔNG gắn dự án",
      !db().t.listings.at(-1)?.project_id, JSON.stringify(db().t.listings.at(-1)));
    // (c) tên đường lệch > 2 ký tự ("huyn tanphat") → tim_duong không ra → tìm theo nghĩa → HỎI XÁC NHẬN, không ghi thẳng.
    fresh((d) => { seedKho(d); d.insert("duong", { ten: "Huỳnh Tấn Phát", tinh: "TP.HCM", tinh_cu: "TP.HCM", phuong: "Phường Tân Thuận", quan_cu: "Quận 7", nguon: "test" }); });
    globalThis.__rpc = { tim_dia_danh_theo_nghia: () => ({ data: [
      { loai: "duong", ten: "Huỳnh Tấn Phát", quan_cu: "Quận 7", do_gan: 0.81 },
      { loai: "duong", ten: "Huỳnh Tịnh Của", quan_cu: "Quận 3", do_gan: 0.8 }], error: null }) };
    const rD = await send({ external_user_id: "nghia-duong-1", text: "bán nhà hẻm 4m huyn tan fat quận 7, 60m2, 5 tỷ" });
    const LN = db().t.listings.at(-1);
    check("NGHIA-DUONG-01 'huyn tan fat' (lệch 3 ký tự) → gợi ý Huỳnh Tấn Phát, hỏi xác nhận; địa chỉ chưa sửa",
      LN?.boc_tach?.duong_goi_y?.ten === "Huỳnh Tấn Phát" && rD.body.replies.join("\n").includes("Huỳnh Tấn Phát") && /huyn tan fat/.test(LN?.location_raw ?? ""),
      JSON.stringify({ l: LN?.location_raw, gy: LN?.boc_tach?.duong_goi_y, rep: rD.body.replies }));
    // (e) bắn thật 30/09: "bán căn hộ sunrize city …" — không có chữ "dự án", AI im → tên lấy sau "căn hộ"; vector trả cả
    // "Sunrise City" lẫn "Khu Căn Hộ Sunrise" (cùng lõi khi bỏ từ chung) → phân xử trên tên đầy đủ, gắn Sunrise City.
    fresh((d) => { seedKho(d);
      d.insert("projects", { name: "Sunrise City", slug: "sunrise-city", district: "Quận 7", ward: "Phường Tân Hưng", amenities: [], description: "" });
      d.insert("projects", { name: "Khu Căn Hộ Sunrise", slug: "khu-can-ho-sunrise", district: "Quận 7", ward: null, amenities: [], description: "" }); });
    cauNhung = null;
    globalThis.__rpc = { tim_du_an_theo_nghia: (d) => ({ data: d.t.projects.filter((p) => /Sunrise/.test(p.name))
      .map((p) => ({ id: p.id, name: p.name, do_gan: p.name === "Sunrise City" ? 0.73 : 0.697 })), error: null }) };
    await send({ external_user_id: "nghia-da-4", text: "bán căn hộ sunrize city 2pn 70m2 giá 3 tỷ" });
    const LS = db().t.listings.at(-1);
    check("NGHIA-DA-04 'bán căn hộ sunrize city' (không chữ 'dự án') → tìm theo nghĩa, gắn Sunrise City, quận 7 từ dự án",
      db().t.projects.find((p) => p.id === LS?.project_id)?.name === "Sunrise City" && LS?.district === "Quận 7" && /^Dự án sunrize city$/i.test(cauNhung ?? ""),
      JSON.stringify({ pid: LS?.project_id, d: LS?.district, cauNhung }));
    // (f) "căn hộ chính chủ" không phải tên dự án → không tốn lượt nhúng.
    fresh(seedVin); cauNhung = null;
    await send({ external_user_id: "nghia-da-5", text: "bán căn hộ chính chủ 2pn 70m2 giá 3 tỷ" });
    check("NGHIA-DA-05 'bán căn hộ chính chủ' → không nhúng tìm dự án", cauNhung === null, String(cauNhung));
    // (d) tìm theo nghĩa TẮT → không nhúng, không gọi hàm.
    fresh(seedVin);
    globalThis.__cauHinh = { test_reset_hello: "1" };
    let daNhung = false; globalThis.__nhung = () => { daNhung = true; return Array.from({ length: 768 }, () => 0); };
    await send({ external_user_id: "nghia-da-3", text: "bán căn hộ dự án vinhome gran park 2pn 70m2 giá 3 tỷ" });
    check("NGHIA-DA-03 tim_theo_nghia tắt → không nhúng, không gọi tim_du_an_theo_nghia", !daNhung && !db().log.some((x) => x.rpc === "tim_du_an_theo_nghia"));
    delete globalThis.__nhung; globalThis.__rpc = {}; env.get = getCu; globalThis.__cauHinh = cuCH;
  }
  // FR-241 o (bắn lại 28/09, lx-85/lx-86/lx-87): đang hỏi ô khác, khách nhắn TRỌN một câu pháp lý ("sổ chung", "sổ hồng rồi em")
  // hay TRỌN một tên phường/xã ("xã Vĩnh Lộc A") — AI im hoặc chỉ xếp vào kiến thức thêm → luật bị gạt: pháp lý rơi vào bổ sung,
  // phường mất hẳn (laBoSungRac). Cả tin là đúng một giá trị của khoá đó → luật chắc, giữ.
  for (const [i, [treo, cau, khoa, kt]] of [
    ["do_rong_hem", "sổ chung", "phap_ly", false], ["phuong", "sổ hồng rồi em", "phap_ly", true],
    ["huong", "xã Vĩnh Lộc A", "phuong", false], ["huong", "sổ đỏ nha em", "phap_ly", true],
  ].entries()) {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: kt ? [cau] : [], truong: [] } : OUT();
    await send({ external_user_id: `tron-khoa-${i}`, text: "bán nhà hẻm Trần Bình Trọng quận 5, 60m2, trệt 2 lầu, giá 8 tỷ" });
    const LK = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LK.id, question: treo, status: "pending" });
    const rK = await send({ external_user_id: `tron-khoa-${i}`, text: cau });
    const fK = (q) => db().t.listing_facts.filter((f) => f.listing_id === LK.id && f.question === q);
    check(`TRON-KHOA-0${i + 1} đang hỏi ${treo}, chỉ nhắn '${cau}' (chinh, AI ${kt ? "xếp kiến thức" : "im"}) → ghi ô ${khoa}, không vào bổ sung`,
      // FR-248 a (30/09): giá trị pháp lý gọn tiểu từ đuôi ("sổ hồng rồi em" → "sổ hồng").
      fK(khoa).some((f) => f.answer === (khoa === "phap_ly" ? cau.replace(/\s+(?:rồi em|nha em)$/u, "") : cau)) && !fK("bo_sung").some((f) => f.answer === cau),
      JSON.stringify({ khoa: fK(khoa), bs: fK("bo_sung"), rep: rK.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // FR-243 (29/09/2026, kịch bản K1–K10 qua bot giả lập) — mỗi ca ghi NGUYÊN NHÂN.
  {
    const cuCH = globalThis.__cauHinh;
    // K3: câu rao đầu "4x12" (AI im) không vào diện tích → bot hỏi lại diện tích. Nguyên nhân: lúc tạo tin chỉ đọc "m2".
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh" };
    await send({ external_user_id: "fr243-k3", text: "bán nhà hẻm Lý Thường Kiệt Q10 4x12 trệt 2 lầu giá 7 tỷ" });
    const L3 = db().t.listings.at(-1);
    const f3 = db().t.listing_facts.filter((f) => f.listing_id === L3?.id && f.question === "dien_tich");
    check("FR243-E1 rao đầu '4x12' (AI im) → fact diện tích 4x12, không hỏi lại diện tích", f3.some((f) => /^4x12/.test(f.answer)) &&
      !db().t.info_requests.some((q) => q.listing_id === L3?.id && q.status === "pending" && /^dien_tich/.test(q.question)),
      JSON.stringify({ f3, ir: db().t.info_requests }));
    // K7: "thôi em ơi nhà bán rồi" → gỡ; "à không, chưa bán, vẫn bán nha" → tin nằm luôn ở đã chốt. Nguyên nhân: `laRaoLai` đòi
    // chữ rao/đăng/mở.
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh" };
    await send({ external_user_id: "fr243-k7", text: "bán nhà hẻm Phạm Thế Hiển Q8 60m2 giá 4 tỷ" });
    const L7 = db().t.listings.at(-1);
    await send({ external_user_id: "fr243-k7", text: "thôi em ơi nhà bán rồi" });
    const daChot = L7?.status === "da_chot";
    const r7 = await send({ external_user_id: "fr243-k7", text: "à không, chưa bán, vẫn bán nha" });
    check("FR243-E2 báo bán rồi rút lời 'à không, chưa bán, vẫn bán nha' → mở lại tin", daChot && L7?.status === "cho_thong_tin" && /mở lại tin/.test((r7.body.replies ?? []).join(" ")),
      JSON.stringify({ daChot, st: L7?.status, rep: r7.body.replies }));
    // Không kích: chưa có lượt gỡ tin thì "chưa bán, vẫn bán nha" không đi nhánh mở lại.
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh" };
    await send({ external_user_id: "fr243-k7b", text: "bán nhà hẻm Phạm Thế Hiển Q8 60m2 giá 4 tỷ" });
    const r7b = await send({ external_user_id: "fr243-k7b", text: "à không, chưa bán, vẫn bán nha" });
    check("FR243-E3 không kích: chưa gỡ tin, 'chưa bán, vẫn bán nha' không trả lời 'không thấy tin nào đang gỡ'", !/đang gỡ để mở lại|mở lại tin/.test((r7b.body.replies ?? []).join(" ")), JSON.stringify(r7b.body.replies));
    // K5: đang hỏi một câu, khách "đang trồng cây ăn trái" → bot đáp "em đăng liền cho anh chị". Nguyên nhân: bỏ dấu thì "đang" = "đăng",
    // luật "chủ muốn đăng" khớp chữ "dang".
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh" };
    await send({ external_user_id: "fr243-k5", text: "bán 1000m2 đất vườn Củ Chi, có 100 thổ cư, giá 3 tỷ 2" });
    const L5 = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: L5.id, question: "vi_tri", status: "pending" });
    const r5 = await send({ external_user_id: "fr243-k5", text: "đang trồng cây ăn trái" });
    check("FR243-E4 'đang trồng cây ăn trái' không bị hiểu là giục đăng; ghi hiện trạng", !/đăng liền/.test((r5.body.replies ?? []).join(" ")) && r5.body.chu_muon_dang !== true &&
      db().t.listing_facts.some((f) => f.listing_id === L5.id && f.question === "hien_trang_su_dung"),
      JSON.stringify({ rep: r5.body.replies, facts: db().t.listing_facts.filter((f) => f.listing_id === L5.id) }));
    // FR-244 (kịch bản L1): căn hộ "…giá 4ty6 phí quản lý 15k/m2" → giá dính "phí quản lý", fact phí quản lý là NGUYÊN câu rao,
    // tầng 12 mất. Nguyên nhân: đuôi giá không dừng trước "phí quản lý"; câu một mảnh thì luật cả câu trả nguyên văn.
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh" };
    await send({ external_user_id: "fr244-l1", text: "bán căn hộ Sunrise City q7 block V3 tầng 12 76m2 2pn 2wc giá 4ty6 phí quản lý 15k/m2" });
    const L1 = db().t.listings.at(-1);
    const f1 = (k) => db().t.listing_facts.filter((f) => f.listing_id === L1?.id && f.question === k).map((f) => f.answer);
    check("FR244-E1 căn hộ: giá không dính phí quản lý; phí quản lý cắt đúng cụm; tầng 12 được ghi", L1?.price_raw === "4ty6" &&
      f1("phi_quan_ly").join() === "15k/m2" /* FR-248 a: gọn còn con số */ && f1("tang").includes("12"), JSON.stringify({ gia: L1?.price_raw, pql: f1("phi_quan_ly"), tang: f1("tang") }));
    // FR-244 (kịch bản L10): NMG nói "căn B sổ hồng riêng" → bong bóng "căn 2 pháp lý". Nguyên nhân: tachTheoCan bỏ chữ khách gọi.
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh" };
    await send({ external_user_id: "fr244-l10", text: "em có 3 căn: căn A hẻm 4m Trần Hưng Đạo Q5 3x12 giá 4 tỷ, căn B mặt tiền Hùng Vương Q5 4x20 giá 25 tỷ, căn C hẻm 2m An Dương Vương Q5 3x8 giá 2 tỷ 8" });
    const r10 = await send({ external_user_id: "fr244-l10", text: "căn B sổ hồng riêng" });
    check("FR244-E2 'căn B sổ hồng riêng' → bong bóng nói 'căn B', không 'căn 2'", /căn B pháp lý/.test((r10.body.replies ?? []).join(" ")) && !/căn 2 pháp lý/.test((r10.body.replies ?? []).join(" ")), JSON.stringify(r10.body.replies));
    globalThis.__cauHinh = cuCH;
  }
  // 27/09/2026 (chủ dự án test Zalo): "Ngang có 3 m" rồi "Nhưng dài tới 14 m" khi bot đang hỏi kết cấu (chế độ chinh, AI im)
  // → diện tích "ngang 3m dài 14m", không rơi bổ sung.
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: "dai-tron", text: "bán nhà hẻm Trần Bình Trọng quận 5 giá 8 tỷ" });
    const LD = db().t.listings.at(-1);
    LD.frontage_m = 3;
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LD.id, question: "ket_cau", status: "pending" });
    const rD = await send({ external_user_id: "dai-tron", text: "Nhưng dài tới 14 m" });
    const fD = (q) => db().t.listing_facts.filter((f) => f.listing_id === LD.id && f.question === q);
    check("DAI-TRON-01 đã có ngang 3, đang hỏi kết cấu, nhắn 'Nhưng dài tới 14 m' (chinh, AI im) → diện tích 'ngang 3m dài 14m', không bổ sung",
      fD("dien_tich").some((f) => f.answer === "ngang 3m dài 14m") && !fD("bo_sung").length,
      JSON.stringify({ dt: fD("dien_tich"), bs: fD("bo_sung"), rep: rD.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // FR-240 b (phát lại test 28/09 trên production): tin đất, đang hỏi đường, khách "diện tích 425m2 thổ cư. dài 22m ngang 19m" —
  // AI đọc diện tích + ngang dài, xếp "thổ cư" vào kiến thức thêm → ô thổ cư trống, "thổ cư" rơi ghi chú, cuối hội thoại bot
  // hỏi "thổ cư bao nhiêu". "425m2 thổ cư" là thổ cư 425m2.
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: "tho-cu-dt", text: "bán đất Cần Đước, Long An" });
    const LC = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LC.id, question: "vi_tri", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? {
      so_can: 0, kien_thuc: ["thổ cư"],
      truong: [
        { khoa: "dien_tich", gia_tri: "425", trich_dan: "diện tích 425m2", can: null },
        { khoa: "ngang", gia_tri: "19", trich_dan: "ngang 19m", can: null },
        { khoa: "dai", gia_tri: "22", trich_dan: "dài 22m", can: null },
      ],
      tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null },
    } : OUT();
    const rC = await send({ external_user_id: "tho-cu-dt", text: "diện tích 425m2 thổ cư. dài 22m ngang 19m" });
    const fC = (q) => db().t.listing_facts.filter((f) => f.listing_id === LC.id && f.question === q);
    check("FR240-E2 tin đất '425m2 thổ cư' (chinh, AI xếp 'thổ cư' vào kiến thức thêm) → ô thổ cư 425m2, không ghi chú 'thổ cư'",
      fC("tho_cu").some((f) => /425/.test(f.answer)) && !fC("bo_sung").some((f) => /^thổ cư$/i.test(f.answer.trim())),
      JSON.stringify({ tc: fC("tho_cu"), bs: fC("bo_sung"), rep: rC.body.replies }));
    // FR-240 c: câu GIÁ vừa mở; lượt đó đường ra còn ghi thêm ghi chú (bo_sung, sau lúc mở câu). Lượt sau khách nói sang hẻm
    // ("đường hxh 5m") → ô giá là ô lõi, được hỏi lại MỘT lần. Ghi chú của chính lượt mở câu không phải "khách đã né một lần".
    const giaTreo = db().t.info_requests.find((x) => x.listing_id === LC.id && x.question === "gia" && x.status === "pending");
    db().insert("listing_facts", { listing_id: LC.id, question: "bo_sung", answer: "gần chợ", source: "ai_kiem", created_at: new Date(Date.parse(giaTreo?.created_at ?? new Date().toISOString()) + 5).toISOString() });
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? {
      so_can: 0, kien_thuc: [],
      truong: [{ khoa: "do_rong_hem", gia_tri: "5", trich_dan: "hxh 5m", can: null }],
      tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null },
    } : OUT();
    const rC2 = await send({ external_user_id: "tho-cu-dt", text: "đường hxh 5m" });
    // SRS-5.1s: ô lõi cũng chỉ hỏi MỘT lần — nói sang ô khác là thôi câu giá (vòng hỏi bù / bản nháp thiếu giá mới hỏi lại).
    check("FR240-E3 đang hỏi GIÁ (đất), khách nói sang hẻm → ghi hẻm, thôi câu giá (không hỏi lại ngay)",
      !!giaTreo && db().t.info_requests.some((x) => x.id === giaTreo.id && x.status === "expired") && fC("do_rong_hem").length === 1,
      JSON.stringify({ ir: db().t.info_requests.filter((x) => x.listing_id === LC.id).map((x) => [x.question, x.status]), rep: rC2.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // 27/09/2026 (chủ dự án test Zalo): câu "sổ đứng tên ai" — AI nói "không trả lời" cho "Anh đứng tên chính nhé" (rơi bổ sung, bot
  // xin họ tên), AI đọc "ba a thôi" thành "ba người". Câu này giữ nguyên chữ khách, AI không quyết.
  for (const [i, [cau, tl]] of [["Anh đứng tên chính nhé", { co_tra_loi: false, gia_tri: null, trich_dan: null }],
    ["ba a thôi", { co_tra_loi: true, gia_tri: "ba người", trich_dan: "ba a" }]].entries()) {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: `dung-ten-${i}`, text: RAO_MT });
    const LN = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LN.id, question: "nguoi_dung_ten", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [], tra_loi: tl } : OUT();
    const rN = await send({ external_user_id: `dung-ten-${i}`, text: cau });
    const fN = (q) => db().t.listing_facts.filter((f) => f.listing_id === LN.id && f.question === q);
    check(`DUNGTEN-E${i + 1} '${cau}' khi hỏi người đứng tên (chinh) → ghi đúng chữ khách, không bổ sung, không 'ba người'`,
      fN("nguoi_dung_ten").length === 1 && !/ba người/.test(fN("nguoi_dung_ten")[0].answer) && !fN("bo_sung").length,
      JSON.stringify({ dt: fN("nguoi_dung_ten"), bs: fN("bo_sung"), rep: rN.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // 27/09/2026 (test Zalo): hỏi giá, khách "Cái giá hồi nãy đó" — giá đã nói năm tin trước ("Giá 8.000.000.000"). Đọc lại tin cũ,
  // không rơi bổ sung (bot từng tự bịa "Em nhớ anh muốn 5 tỷ 2").
  {
    fresh(seedKho);
    await send({ external_user_id: "gia-hoi-nay", text: "bán nhà hẻm Trần Bình Trọng quận 5, 60m2" });
    const LG = db().t.listings.at(-1);
    const conv = db().t.conversations.at(-1);
    for (const t of ["Giá 8.000.000.000", "Ngang có 3 m", "Nhưng dài tới 14 m", "Chưa xây gì hết em nhà cấp 4", "Ô tô thì vào được"])
      db().insert("messages", { conversation_id: conv.id, sender: "seller", body: t });
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LG.id, question: "gia", status: "pending" });
    const rG = await send({ external_user_id: "gia-hoi-nay", text: "Cái giá hồi nãy đó" });
    const fG = (q) => db().t.listing_facts.filter((f) => f.listing_id === LG.id && f.question === q);
    check("GIAHN-01 'Cái giá hồi nãy đó' → lấy giá ở tin trước (8.000.000.000), không bổ sung",
      fG("gia").some((f) => /8\.000\.000\.000/.test(f.answer)) && !fG("bo_sung").length, JSON.stringify({ gia: fG("gia"), bs: fG("bo_sung"), rep: rG.body.replies }));
  }
  // 27/09/2026 (test Zalo, đất Cần Đước): hỏi "lên thổ cư được không", khách "nói ở trên ròi mà" → bot vơ "ko có gì hết" (câu trả
  // lời HẠ TẦNG) làm đáp án. Câu có / không chỉ lấy tin cũ nói đúng chủ đề; không có thì xin lỗi hỏi lại, không ghi gì.
  {
    fresh(seedKho);
    await send({ external_user_id: "noi-tren", text: "bán đất Cần Đước Long An 425m2 giá 6 tỷ" });
    const LT = db().t.listings.at(-1);
    const conv = db().t.conversations.at(-1);
    for (const t of ["ko có gì hết", "425m2"]) db().insert("messages", { conversation_id: conv.id, sender: "seller", body: t });
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LT.id, question: "len_tho_cu", status: "pending" });
    const rT = await send({ external_user_id: "noi-tren", text: "nói ở trên ròi mà" });
    check("NOITREN-01 'nói ở trên ròi mà' khi hỏi lên thổ cư → KHÔNG ghi 'ko có gì hết' vào lên thổ cư",
      !db().t.listing_facts.some((f) => f.listing_id === LT.id && f.question === "len_tho_cu"), JSON.stringify({ f: db().t.listing_facts.filter((f) => f.listing_id === LT.id).map((f) => [f.question, f.answer]), rep: rT.body.replies }));
  }
  // 27/09/2026 (test Zalo): bot hỏi "Ô tô vào được tận nhà không anh?" (câu hẻm), khách "Ok" → bị hiểu là "đăng đi".
  {
    fresh(seedKho);
    await send({ external_user_id: "ok-cokhong", text: "bán nhà Trần Bình Trọng quận 5 60m2 giá 8 tỷ" });
    const LO = db().t.listings.at(-1);
    const conv = db().t.conversations.at(-1);
    db().insert("messages", { conversation_id: conv.id, sender: "bot", body: "Ô tô vào được tận nhà không anh?" });
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LO.id, question: "do_rong_hem", status: "pending" });
    const rO = await send({ external_user_id: "ok-cokhong", text: "Ok" });
    check("OKCK-01 'Ok' trả lời câu có/không của bot → KHÔNG thành 'đăng đi' (không 'Dạ em đăng liền', không mở duyệt)",
      !rO.body.replies.some((x) => /đăng liền|Em sẽ rao như vầy/.test(x)) && !rO.body.chu_muon_dang, JSON.stringify(rO.body));
  }
  // 27/09/2026 (test Zalo): "312 Nguyễn Thuơbgj Hiền" khi đang hỏi hẻm (chinh, AI im) → địa chỉ, không bổ sung.
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: "so-nha-sai", text: "bán nhà quận Phú Nhuận 60m2 giá 8 tỷ" });
    const LS = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LS.id, question: "do_rong_hem", status: "pending" });
    const rS = await send({ external_user_id: "so-nha-sai", text: "312 Nguyễn Thuơbgj Hiền" });
    const fS = (q) => db().t.listing_facts.filter((f) => f.listing_id === LS.id && f.question === q);
    check("SONHA-01 '312 Nguyễn Thuơbgj Hiền' khi hỏi hẻm (chinh, AI im) → ghi địa chỉ, không bổ sung, không vào ô hẻm",
      fS("vi_tri").some((f) => /312/.test(f.answer)) && !fS("bo_sung").length && !fS("do_rong_hem").length,
      JSON.stringify({ vt: fS("vi_tri"), bs: fS("bo_sung"), hem: fS("do_rong_hem"), rep: rS.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // 27/09/2026 (bắn thật lx-36): "Ở cầu kho em ơi" khi hỏi phường (chinh, AI im) → phường ghi đúng nhưng luật tiềm năng còn
  // ghi kèm "Ở cầu kho em ơi" ("ở" = để ở). Đang hỏi địa chỉ thì "ở …" là NẰM Ở.
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: "cau-kho", text: "bán nhà quận 1 60m2 giá 8 tỷ" });
    const LK = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LK.id, question: "phuong", status: "pending" });
    const rK = await send({ external_user_id: "cau-kho", text: "Ở cầu kho em ơi" });
    const fK = (q) => db().t.listing_facts.filter((f) => f.listing_id === LK.id && f.question === q);
    check("CAUKHO-E1 'Ở cầu kho em ơi' khi hỏi phường (chinh, AI im) → ghi phường, KHÔNG ghi kèm tiềm năng",
      // 30/09/2026 (FR-250): tên CŨ đúng chữ đổi sang phường MỚI như AI vẫn làm — Cầu Kho (Quận 1 cũ) nay thuộc Phường Cầu Ông Lãnh.
      fK("phuong").some((f) => /cầu kho|cầu ông lãnh/i.test(f.answer)) && !fK("tiem_nang").length,
      JSON.stringify({ ph: fK("phuong"), tn: fK("tiem_nang"), rep: rK.body.replies }));
    globalThis.__cauHinh = cuCH;
  }
  // 27/09/2026 (chủ dự án test Zalo): đang hỏi phường, chủ nhà hỏi "Em biết Botanic không" → model bịa "Botanic ở Quận 1, dự án
  // Phú Mỹ Hưng". Câu nêu quận / khu chủ nhà chưa nói và tin không có → bỏ, câu hỏi phường giữ.
  {
    fresh((d) => {
      const s = d.insert("sellers", { zalo_user_id: "bia-vt", seller_type: "ccrb", name: null, active_listing_id: null }).data;
      const l = d.insert("listings", { code: "BDS-CC-XX-0961", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "chung_cu", location_raw: "Căn chung cư ở Botanic", district: null, ward: null, can_chu_duyet: true }).data;
      d.insert("info_requests", { listing_id: l.id, question: "phuong", status: "pending" });
    });
    globalThis.__model.create = () => "Em biết Botanic ở Quận 1, dự án Phú Mỹ Hưng, khách gia đình rất ưa nhà ở đó. Căn anh ở phường mấy vậy?";
    const rB = await send({ external_user_id: "bia-vt", text: "Em biết Botanic không" });
    globalThis.__model.create = undefined;
    const cauB = rB.body.replies.join("\n");
    check("VITRI-BIA-E1 'Em biết Botanic không' → không còn 'Quận 1' / 'Phú Mỹ Hưng' bịa, câu hỏi phường vẫn gửi",
      !/Quận 1|Phú Mỹ Hưng/.test(cauB) && /phường/.test(cauB), JSON.stringify(rB.body.replies));
  }
  // FR-224 (25/09/2026, chủ dự án: "đừng bắt theo từ nữa, bắt theo nguyên cả câu của khách để AI đọc lại"): chế độ `chinh`,
  // AI đọc NGUYÊN tin và trả lời thẳng câu đang hỏi (`tra_loi`). Bốn câu luật đọc SAI (chạy thử phanLoaiCauTraLoi 25/09).
  const CA_TRA_LOI = [
    // luật: lệch → chuyển sang hien_trang_su_dung
    { ma: "TRALOI-01", q: "do_rong_hem", cau: "nhà trong hẻm, xe hơi chạy vô tới cửa luôn",
      tl: { co_tra_loi: true, gia_tri: "hẻm xe hơi vào tới cửa", trich_dan: "xe hơi chạy vô tới cửa luôn" }, ghi: "hẻm xe hơi vào tới cửa" },
    // luật: lệch → chuyển sang ket_cau
    { ma: "TRALOI-02", q: "thang_may", cau: "nhà 5 tầng có lắp thang máy riêng",
      tl: { co_tra_loi: true, gia_tri: "có thang máy riêng", trich_dan: "có lắp thang máy riêng" }, ghi: "có thang máy riêng",
      truong: [{ khoa: "so_tang", gia_tri: "5", trich_dan: "nhà 5 tầng", can: null }] },
    // luật: khớp (ghi năm xây của NHÀ HÀNG XÓM)
    { ma: "TRALOI-03", q: "nam_xay", cau: "hàng xóm mới xây năm 2019 cao hơn nhà em",
      tl: { co_tra_loi: false, gia_tri: null, trich_dan: null }, ghi: null },
    // Bắn thật lx-21 (25/09): AI lấy số của ý khác ("5x12") làm độ rộng hẻm → bỏ; luật đọc "hxh" → "hẻm xe hơi"
    { ma: "TRALOI-05", q: "do_rong_hem", cau: "hxh, 5x12, trệt 3 lầu",
      tl: { co_tra_loi: true, gia_tri: "hẻm xe hơi 5 mét", trich_dan: "hxh" }, ghi: "hẻm xe hơi" },
    // AI nói có nhưng BỊA số (không có trong tin) → không lấy chữ AI; luật đọc như cũ
    { ma: "TRALOI-04", q: "gap", cau: "ừ có",
      tl: { co_tra_loi: true, gia_tri: "có, cần bán gấp trong 2 tháng", trich_dan: "ừ có" }, ghi: "ừ có" },
  ];
  for (const [i, ca] of CA_TRA_LOI.entries()) {
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: `traloi-${i}`, text: RAO_MT });
    const LT = db().t.listings.at(-1);
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: LT.id, question: ca.q, status: "pending" });
    let userMsg = "";
    globalThis.__model.parse = (p) => {
      if (!laLuotBocRao(p)) return OUT();
      userMsg = String(p.messages?.[0]?.content ?? "");
      return { so_can: 0, kien_thuc: [], truong: ca.truong ?? [], tra_loi: ca.tl };
    };
    const rT = await send({ external_user_id: `traloi-${i}`, text: ca.cau });
    const fT = (q) => db().t.listing_facts.filter((f) => f.listing_id === LT.id && f.question === q);
    const irT = (st) => db().t.info_requests.some((x) => x.listing_id === LT.id && x.question === ca.q && x.status === st);
    const lech = db().t.listing_facts.filter((f) => f.listing_id === LT.id && ["hien_trang_su_dung", "ket_cau", "nam_xay"].includes(f.question) && f.question !== ca.q && f.answer === ca.cau);
    // Bắn thật lx-22: AI im về diện tích, "5x12" (kích thước chắc) vẫn phải ghi — trước đó bot hỏi lại diện tích.
    if (ca.ma === "TRALOI-05") check("TRALOI-05b AI im về diện tích, '5x12' trong câu vẫn ghi ô diện tích", db().t.listing_facts.some((f) => f.listing_id === LT.id && f.question === "dien_tich" && /5\s*x\s*12/.test(f.answer)), JSON.stringify(db().t.listing_facts.filter((f) => f.listing_id === LT.id).map((f) => [f.question, f.answer])));
    // FR-233 (27/09): câu không ghi được vào ô đang hỏi → ghi chú nguyên văn, KHÔNG hỏi lại (câu treo thôi, không còn pending).
    check(`${ca.ma} hỏi ${ca.q}, khách '${ca.cau}' → ${ca.ghi ? `ghi '${ca.ghi}', câu xong` : "KHÔNG ghi vào ô đó, ghi chú nguyên văn, không hỏi lại"}; không chuyển nguyên câu sang ô khác`,
      (ca.ghi ? fT(ca.q).length === 1 && fT(ca.q)[0].answer === ca.ghi && irT("answered") && !irT("pending")
        : fT(ca.q).length === 0 && !irT("pending") && fT("bo_sung").some((f) => f.answer === ca.cau) && rT.body.reask !== ca.q) && !lech.length,
      JSON.stringify({ f: fT(ca.q), lech, ir: db().t.info_requests.filter((x) => x.listing_id === LT.id).map((x) => [x.question, x.status]), rep: rT.body.replies }));
    if (i === 0) check("TRALOI-01b AI nhận cả CHỮ câu bot vừa hỏi (không chỉ khoá trần)", /do_rong_hem — "[^"]{10,}"/.test(userMsg), userMsg.slice(0, 200));
  }
  // FR-226 a (25/09/2026, test Zalo chủ dự án …3057): "anh muốn bán nhà" → bot từng ghi "loại: Nhà phố bán". Nay "Nhà bán".
  fresh(seedKho);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
  globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
  {
    const rN = await send({ external_user_id: "nha-tran", text: "anh muốn bán nhà" });
    check("NHATRAN-01 'anh muốn bán nhà' → 🤖 ghi 'Nhà bán', KHÔNG 'Nhà phố'", rN.body.replies.some((x) => /loại: "Nhà bán"/.test(x)) && !rN.body.replies.some((x) => /Nhà phố/.test(x)), JSON.stringify(rN.body.replies));
  }
  // FR-226 b (25/09/2026, chủ dự án: "khách trả lời nhỏ giọt về địa chỉ hoặc các trường khác thì để AI gộp lại hoặc thay thế
  // hoặc sửa"). Dựng: tin "Ngô Y Linh", kết cấu "trệt + 3 lầu", đang hỏi phường.
  const dungGop = async (uid) => {
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
    await send({ external_user_id: uid, text: "bán nhà hẻm Ngô Y Linh Bình Tân 5x12 4 tấm giá 4 tỷ" });
    const L = db().t.listings.at(-1);
    L.location_raw = "Ngô Y Linh"; L.floors_text = "trệt + 3 lầu";
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: L.id, question: "phuong", status: "pending" });
    return L;
  };
  const moiAi = (cn, kt = []) => (p) => laLuotBocRao(p)
    ? { so_can: 0, kien_thuc: kt, truong: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, cap_nhat: cn } : OUT();
  {
    // Luật dự phòng: "số 45 nha" — số nhà ghép vào địa chỉ đang có, không thành phường, không vào bổ sung.
    const L = await dungGop("gop-1");
    globalThis.__model.parse = moiAi([{ khoa: "vi_tri", gia_tri_moi: "45/12 Ngô Y Linh", cach: "gop" }], ["số 45"]);
    let loiDan = "";
    globalThis.__model.create = (p) => { loiDan = JSON.stringify(p.messages ?? ""); return "Dạ em ghi địa chỉ rồi ạ, nhà mình thuộc phường nào vậy anh?"; };
    const rG = await send({ external_user_id: "gop-1", text: "số 45 nha" });
    globalThis.__model.create = undefined;
    const fG = (q) => db().t.listing_facts.filter((f) => f.listing_id === L.id && f.question === q);
    check("GOP-01 địa chỉ 'Ngô Y Linh' + 'số 45 nha' → địa chỉ '45 Ngô Y Linh' (bản AI bịa '45/12' bị bỏ), KHÔNG thành phường, KHÔNG bổ sung 'số 45', câu phường vẫn treo",
      L.location_raw === "45 Ngô Y Linh" && !fG("vi_tri").some((f) => /12/.test(f.answer)) && !fG("phuong").length && !fG("bo_sung").some((f) => /45/.test(f.answer)) &&
        db().t.info_requests.some((x) => x.listing_id === L.id && x.question === "phuong" && x.status === "pending") &&
        // Model viết câu (chủ dự án 25/09: "ko cần khóa câu cố định") nhưng được dặn đúng ý: vừa ghi SỐ NHÀ, không phải
        // "hiểu nhầm" (bắn thật lx-21) — lời dặn chung "KHÔNG trả lời được câu em hỏi" không được gửi. 🤖 báo địa chỉ mới.
        /SỐ NHÀ/.test(loiDan) && /45 Ngô Y Linh/.test(loiDan) && !/KHÔNG trả lời được/.test(loiDan) &&
        rG.body.replies.some((x) => /phường/.test(x)) && rG.body.replies.some((x) => /^🤖.*45 Ngô Y Linh/.test(x)),
      JSON.stringify({ lr: L.location_raw, vt: fG("vi_tri"), ph: fG("phuong"), bs: fG("bo_sung"), ir: db().t.info_requests.filter((x) => x.listing_id === L.id).map((x) => [x.question, x.status]), rep: rG.body.replies }));
  }
  {
    // AI gộp: kết cấu đang ghi "trệt + 3 lầu", khách "có sân thượng nữa em" → "trệt + 3 lầu + sân thượng".
    const L = await dungGop("gop-2");
    let userMsg = "";
    const goc = moiAi([{ khoa: "ket_cau", gia_tri_moi: "trệt + 3 lầu + sân thượng", cach: "gop" }], ["có sân thượng"]);
    globalThis.__model.parse = (p) => { if (laLuotBocRao(p)) userMsg = String(p.messages?.[0]?.content ?? ""); return goc(p); };
    const rG = await send({ external_user_id: "gop-2", text: "có sân thượng nữa em" });
    const fG = (q) => db().t.listing_facts.filter((f) => f.listing_id === L.id && f.question === q);
    check("GOP-02 kết cấu 'trệt + 3 lầu' + 'có sân thượng nữa em' → AI gộp 'trệt + 3 lầu + sân thượng', không bổ sung lặp, thôi câu phường (không hỏi lại); AI nhận giá trị đang ghi",
      fG("ket_cau").some((f) => f.answer === "trệt + 3 lầu + sân thượng") && !fG("bo_sung").some((f) => /sân thượng/.test(f.answer)) &&
        !db().t.info_requests.some((x) => x.listing_id === L.id && x.question === "phuong" && x.status === "pending") && /Thông tin đang ghi[\s\S]*ket_cau: "trệt \+ 3 lầu"/.test(userMsg),
      JSON.stringify({ kc: fG("ket_cau"), bs: fG("bo_sung"), ir: db().t.info_requests.filter((x) => x.listing_id === L.id).map((x) => [x.question, x.status]), rep: rG.body.replies, userMsg: userMsg.slice(0, 300) }));
  }
  {
    // AI gộp BỊA: thêm "thang máy" khách không nói → bỏ.
    const L = await dungGop("gop-3");
    globalThis.__model.parse = moiAi([{ khoa: "ket_cau", gia_tri_moi: "trệt + 3 lầu + sân thượng + thang máy", cach: "gop" }]);
    await send({ external_user_id: "gop-3", text: "có sân thượng nữa em" });
    const fG = (q) => db().t.listing_facts.filter((f) => f.listing_id === L.id && f.question === q);
    check("GOP-03 AI gộp BỊA 'thang máy' (khách không nói) → không ghi giá trị đó", !fG("ket_cau").some((f) => /thang máy/.test(f.answer)), JSON.stringify(fG("ket_cau")));
  }
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ghi", bao_lai_da_luu: "thay_doi" };

  // ── 21/09/2026 chế độ `chinh` — ĐẢO TẦNG: AI đọc là đường chính có kiểm bằng chứng, luật đỡ (TS-AIBOC-06) ──
  // Câu rao mang đúng hai bẫy của TS-VAN-11: "giá 1 tỷ 8 căn 2 phòng ngủ" (đuôi giá rác) và "bàn giao quý 2 năm sau" (luật từng lấy làm tên đường).
  const R8 = "bán căn hộ 2 phòng ngủ đường Nguyễn Lương Bằng quận 7, giá 1 tỷ 8 căn 2 phòng ngủ, bàn giao quý 2 năm sau";
  const DX8 = { so_can: 1, kien_thuc: ["bàn giao quý 2 năm sau"], truong: [
    { khoa: "loai_giao_dich", gia_tri: "ban", trich_dan: "bán căn hộ", can: null },
    { khoa: "loai_bds", gia_tri: "chung_cu", trich_dan: "căn hộ", can: null },
    { khoa: "so_phong_ngu", gia_tri: "2", trich_dan: "2 phòng ngủ", can: null },
    { khoa: "duong", gia_tri: "Nguyễn Lương Bằng", trich_dan: "đường Nguyễn Lương Bằng", can: null },
    { khoa: "quan", gia_tri: "Quận 7", trich_dan: "quận 7", can: null },
    { khoa: "gia", gia_tri: "1 tỷ 8", trich_dan: "giá 1 tỷ 8", can: null },
  ] };
  fresh(seedKho);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
  globalThis.__model.parse = (p) => laLuotBocRao(p) ? DX8 : OUT();
  r = await send({ external_user_id: "aiboc-8", text: R8 });
  const L8 = db().t.listings.at(-1);
  const f8 = (q) => db().t.listing_facts.filter((f) => f.listing_id === L8.id && f.question === q);
  const bong8 = db().rows("boc_tach_bong");
  check("AIBOC-08 'chinh' câu rao: giá 1 tỷ 8 (AI, không đuôi rác), loại căn hộ, Quận 7, 2 PN vào tin; địa chỉ = 'đường Nguyễn Lương Bằng' (nguyên văn khách gõ, SRS-5.1zzr; không có 'quý 2 năm sau' ở bất kỳ cột/fact nào)",
    L8.price_vnd === 18e8 && L8.property_type === "chung_cu" && L8.district === "Quận 7" && f8("so_phong_ngu")[0]?.answer === "2" &&
      L8.location_raw === "đường Nguyễn Lương Bằng" && !/quý 2/.test(`${L8.location_raw}|${L8.street ?? ""}|${L8.ward ?? ""}|${L8.price_raw}`) &&
      !db().t.listing_facts.some((f) => f.listing_id === L8.id && f.question !== "bo_sung" && /quý 2/.test(f.answer)),
    JSON.stringify({ L8, f: db().t.listing_facts.filter((f) => f.listing_id === L8.id) }));
  check("AIBOC-08b 'bàn giao quý 2 năm sau' → kiến thức → bo_sung nguồn ai_kiem; sổ đo che_do = chinh; nguồn boc_tach 'cau_rao+ai_chinh'; khách có lời đáp",
    f8("bo_sung").length === 1 && f8("bo_sung")[0].answer === "bàn giao quý 2 năm sau" && f8("bo_sung")[0].source === "ai_kiem" &&
      bong8.length === 1 && bong8[0].da_ghi?.che_do === "chinh" && L8.boc_tach?.nguon === "cau_rao+ai_chinh" && r.body.replies.length > 0,
    JSON.stringify({ bs: f8("bo_sung"), bong: bong8, bt: L8.boc_tach, rep: r.body.replies }));

  // Câu treo GIÁ, chủ nhà: "khách chốt nhanh anh bớt 50 triệu" — luật từng ghi giá = 50 triệu (TS-VAN-11 lỗi 1).
  db().t.info_requests.forEach((x) => { if (x.listing_id === L8.id && x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: L8.id, question: "gia", status: "pending" });
  globalThis.__model.parse = (p) => laLuotBocRao(p)
    ? { so_can: 0, kien_thuc: ["khách chốt nhanh anh bớt 50 triệu"], truong: [] } : OUT();
  r = await send({ external_user_id: "aiboc-8", text: "khách chốt nhanh anh bớt 50 triệu" });
  // FR-233 (27/09): câu đã thành ghi chú (kiến thức AI) → không hỏi lại câu giá; đi tiếp. Tin thiếu giá thì bản nháp tự mở lại câu giá.
  check("AIBOC-09 'chinh' câu treo giá, AI không thấy giá → KHÔNG ghi giá '50 triệu'; câu thành kiến thức → bo_sung MỘT lần nguồn ai_kiem (luật không ghi nguyên văn lần hai); không hỏi lại giá (FR-233)",
    f8("gia").length === 0 && L8.price_vnd === 18e8 && f8("bo_sung").filter((f) => /50 triệu/.test(f.answer)).length === 1 && f8("bo_sung").find((f) => /50 triệu/.test(f.answer)).source === "ai_kiem" &&
      !db().t.info_requests.some((x) => x.listing_id === L8.id && x.question === "gia" && x.status === "pending") && r.body.reask !== "gia",
    JSON.stringify({ gia: f8("gia"), bs: f8("bo_sung"), ir: db().t.info_requests.filter((q) => q.listing_id === L8.id).map((q) => [q.question, q.status]), rep: r.body.replies, extra: r.body.reask }));

  // Câu treo PHÁP LÝ, chủ nhà hỏi "có làm hợp đồng phân phối không" — luật từng ghi pháp lý (TS-VAN-11 lỗi 4).
  db().t.info_requests.forEach((x) => { if (x.listing_id === L8.id && x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: L8.id, question: "phap_ly", status: "pending" });
  globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
  r = await send({ external_user_id: "aiboc-8", text: "bên em có làm hợp đồng phân phối không" });
  check("AIBOC-10 'chinh' câu treo pháp lý, AI trả rỗng → không ghi pháp lý; thôi câu (không hỏi lại)",
    f8("phap_ly").length === 0 && !db().t.info_requests.some((x) => x.listing_id === L8.id && x.question === "phap_ly" && x.status === "pending"),
    JSON.stringify({ pl: f8("phap_ly"), ir: db().t.info_requests.filter((q) => q.listing_id === L8.id).map((q) => [q.question, q.status]), rep: r.body.replies }));

  // Câu treo KẾT CẤU, trả lời kèm hai fact khác: AI quyết cả câu treo lẫn fact kèm.
  db().t.info_requests.forEach((x) => { if (x.listing_id === L8.id && x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: L8.id, question: "ket_cau", status: "pending" });
  globalThis.__model.parse = (p) => laLuotBocRao(p)
    ? { so_can: 0, kien_thuc: [], truong: [
        { khoa: "ket_cau", gia_tri: "1 trệt 2 lầu", trich_dan: "1 trệt 2 lầu", can: null },
        { khoa: "so_wc", gia_tri: "3", trich_dan: "3 wc", can: null },
        { khoa: "huong", gia_tri: "Đông", trich_dan: "hướng đông", can: null },
      ] } : OUT();
  r = await send({ external_user_id: "aiboc-8", text: "1 trệt 2 lầu, 3 wc, hướng đông" });
  check("AIBOC-11 'chinh' câu treo kết cấu: AI '1 trệt 2 lầu' ghi ô kết cấu (nguồn seller_chat), câu answered; WC + hướng kèm ghi nguồn ai_kiem, mỗi ô một lần",
    f8("ket_cau").length === 1 && f8("ket_cau")[0].answer === "1 trệt 2 lầu" && f8("ket_cau")[0].source === "seller_chat" &&
      f8("so_wc").length === 1 && f8("so_wc")[0].source === "ai_kiem" && f8("huong").length === 1 && f8("huong")[0].answer === "Đông" &&
      db().t.info_requests.some((x) => x.listing_id === L8.id && x.question === "ket_cau" && x.status === "answered"),
    JSON.stringify({ kc: f8("ket_cau"), wc: f8("so_wc"), h: f8("huong"), ir: db().t.info_requests.filter((q) => q.listing_id === L8.id).map((q) => [q.question, q.status]) }));

  // Câu treo PHƯỒNG (đường riêng — AI không quyết câu treo) nhưng fact KÈM vẫn do AI: bắn thật 21/09 mau-v-03.
  db().t.info_requests.forEach((x) => { if (x.listing_id === L8.id && x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: L8.id, question: "phuong", status: "pending" });
  const soFactTruoc = db().t.listing_facts.filter((f) => f.listing_id === L8.id).length;
  globalThis.__model.parse = (p) => laLuotBocRao(p)
    ? { so_can: 0, kien_thuc: ["để em coi lại sổ rồi báo"], truong: [
        { khoa: "ngang", gia_tri: "5", trich_dan: "ngang 5", can: null },
        { khoa: "dai", gia_tri: "20", trich_dan: "dài 20", can: null },
        { khoa: "hien_trang", gia_tri: "xe hơi", trich_dan: "hẻm xe hơi", can: null },
      ] } : OUT();
  r = await send({ external_user_id: "aiboc-8", text: "ngang 5 dài 20 nha, hẻm xe hơi, để em coi lại sổ rồi báo" });
  const fMoi = db().t.listing_facts.filter((f) => f.listing_id === L8.id).slice(soFactTruoc);
  // 25/09/2026 (chủ dự án: "nếu hẻm xe hơi thì hẻm rộng tầm bao nhiêu trở lên cái này nó phải tự nhận biết được"): "hẻm xe
  // hơi" LÀ thông tin hẻm — ghi ô hẻm đúng chữ đó (trigger đọc ra loại đường vào, không bịa số mét). Bản 21/09 cấm điều này.
  check("AIBOC-13 'chinh' câu treo phường, trả lời số đo: AI quyết fact kèm → dien_tich '5x20' (nguồn ai_kiem); 'hẻm xe hơi' vào ô hẻm đúng chữ (không số mét bịa), KHÔNG hiện trạng 'xe hơi' (kiểm hình dạng), KHÔNG bo_sung lời hứa; thôi câu phường (không hỏi lại)",
    fMoi.some((f) => f.question === "dien_tich" && f.answer === "5x20" && f.source === "ai_kiem") &&
      fMoi.filter((f) => f.question === "do_rong_hem").every((f) => f.answer === "hẻm xe hơi") && !fMoi.some((f) => f.question === "hien_trang") && !fMoi.some((f) => f.question === "bo_sung") &&
      !db().t.info_requests.some((x) => x.listing_id === L8.id && x.question === "phuong" && x.status === "pending"),
    JSON.stringify({ fMoi, ir: db().t.info_requests.filter((q) => q.listing_id === L8.id).map((q) => [q.question, q.status]), rep: r.body.replies }));

  // 21/09/2026 (Zalo thật): câu treo VỊ TRÍ — AI đọc tên đường (phục hồi dấu) thắng luật `catDapAn` (từng ghi cả câu).
  db().t.info_requests.forEach((x) => { if (x.listing_id === L8.id && x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: L8.id, question: "vi_tri", status: "pending" });
  L8.location_raw = null; L8.street = null; L8.ward = null;
  const soFact14 = db().t.listing_facts.filter((f) => f.listing_id === L8.id).length;
  globalThis.__model.parse = (p) => laLuotBocRao(p)
    ? { so_can: 0, kien_thuc: [], truong: [
        { khoa: "duong", gia_tri: "Phạm Thế Hiển", trich_dan: "Pham The Hien", can: null },
        { khoa: "do_rong_hem", gia_tri: "4", trich_dan: "hem 4m", can: null },
        { khoa: "phuong", gia_tri: "4", trich_dan: "P.4", can: null },
      ] } : OUT();
  r = await send({ external_user_id: "aiboc-8", text: "nhà của anh ở hem 4m Pham The Hien, P.4 📐" });
  const f14 = db().t.listing_facts.filter((f) => f.listing_id === L8.id).slice(soFact14);
  check("AIBOC-14 'chinh' câu treo VỊ TRÍ, khách gõ cả câu không dấu: vi_tri = 'Phạm Thế Hiển' (AI, có dấu), location_raw theo; hẻm 4m + phường 4 đi ô riêng (ai_kiem); câu vị trí answered; không fact nào mang cả câu",
    f14.some((f) => f.question === "vi_tri" && f.answer === "Phạm Thế Hiển") && L8.location_raw === "Phạm Thế Hiển" &&
      f14.some((f) => f.question === "do_rong_hem" && f.answer === "4m" && f.source === "ai_kiem") && f14.some((f) => f.question === "phuong" && f.answer === "Phường 4") &&
      !f14.some((f) => /nhà của anh/.test(f.answer)) && db().t.info_requests.some((x) => x.listing_id === L8.id && x.question === "vi_tri" && x.status === "answered"),
    JSON.stringify({ f14, loc: L8.location_raw, ir: db().t.info_requests.filter((q) => q.listing_id === L8.id).map((q) => [q.question, q.status]), rep: r.body.replies }));

  // AI không đọc ra đường → luật đỡ như cũ (không hạ khớp thành lệch cho câu vị trí).
  db().t.info_requests.forEach((x) => { if (x.listing_id === L8.id && x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: L8.id, question: "vi_tri", status: "pending" });
  const soFact15 = db().t.listing_facts.filter((f) => f.listing_id === L8.id).length;
  globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
  r = await send({ external_user_id: "aiboc-8", text: "123/4 An Dương Vương" });
  const f15 = db().t.listing_facts.filter((f) => f.listing_id === L8.id).slice(soFact15);
  check("AIBOC-15 'chinh' câu treo VỊ TRÍ, AI trả rỗng → luật đỡ: vi_tri = '123/4 An Dương Vương' (seller_chat), câu answered",
    f15.some((f) => f.question === "vi_tri" && f.answer === "123/4 An Dương Vương" && f.source === "seller_chat") &&
      db().t.info_requests.some((x) => x.listing_id === L8.id && x.question === "vi_tri" && x.status === "answered"),
    JSON.stringify({ f15, ir: db().t.info_requests.filter((q) => q.listing_id === L8.id).map((q) => [q.question, q.status]), rep: r.body.replies }));

  // Câu treo LOẠI BĐS: AI đọc loại trước, RPC đoán loại chỉ đỡ khi AI trống.
  db().t.info_requests.forEach((x) => { if (x.listing_id === L8.id && x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: L8.id, question: "loai_bds", status: "pending" });
  L8.property_type = "chua_ro";
  globalThis.__model.parse = (p) => laLuotBocRao(p)
    ? { so_can: 0, kien_thuc: [], truong: [{ khoa: "loai_bds", gia_tri: "dat", trich_dan: "lô đất", can: null }] } : OUT();
  r = await send({ external_user_id: "aiboc-8", text: "em có 1 lô đất 5x20 trong khu dân cư" });
  check("AIBOC-16 'chinh' câu treo LOẠI BĐS: mock RPC đoán loại trả null, AI đọc 'dat' → ô loại = 'đất', câu answered, không hỏi lại",
    db().t.listing_facts.some((f) => f.listing_id === L8.id && f.question === "loai_bds" && f.answer === "đất") &&
      db().t.info_requests.some((x) => x.listing_id === L8.id && x.question === "loai_bds" && x.status === "answered") && r.body.reask !== "loai_bds",
    JSON.stringify({ f: db().t.listing_facts.filter((f) => f.listing_id === L8.id && f.question === "loai_bds"), rep: r.body.replies, reask: r.body.reask }));

  // Model bóc CHẾT ở chế độ chinh → toàn bộ đường luật y như cũ (fallback), lỗi vào sổ.
  fresh(seedKho);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh" };
  globalThis.__model.parse = (p) => { if (laLuotBocRao(p)) throw new Error("model bóc chết"); return OUT(); };
  r = await send({ external_user_id: "aiboc-12", text: "bán nhà hẻm 4m Trần Hưng Đạo quận 5, 4x15, giá 6 tỷ" });
  const L12 = db().t.listings.at(-1);
  check("AIBOC-12 'chinh' model bóc chết → luật đỡ: giá 6 tỷ, Quận 5, địa chỉ có 'Trần Hưng Đạo', khách được trả lời, lỗi vào sổ",
    L12?.price_vnd === 6e9 && L12.district === "Quận 5" && /Trần Hưng Đạo/.test(L12.location_raw ?? "") && r.body.replies.length > 0 &&
      db().t.bot_errors.some((e) => e.source === "chat-reply boc_tach_ai(bong)"),
    JSON.stringify({ L12, loi: db().t.bot_errors, rep: r.body.replies }));

  globalThis.__cauHinh = undefined;
  if (macDinh) globalThis.__model.parse = macDinh;
}

// ── FR-212 (21/09/2026): TỪ ĐIỂN TÊN ĐƯỜNG `duong` — không dấu → có dấu ngay; sai 1–2 ký tự → HỎI xác nhận; không có → giữ nguyên ──
{
  const seedDuong = (d) => {
    d.insert("duong", { ten: "Phạm Thế Hiển", tinh: "TP.HCM", tinh_cu: "TP.HCM", phuong: "Phường Phú Định", quan_cu: "Quận 8", nguon: "test" });
    d.insert("duong", { ten: "Phạm Thế Hiển", tinh: "TP.HCM", tinh_cu: "TP.HCM", phuong: "Phường Chánh Hưng", quan_cu: "Quận 8", nguon: "test" });
    d.insert("duong", { ten: "Lê Văn Việt", tinh: "TP.HCM", tinh_cu: "TP.HCM", phuong: "Phường Tăng Nhơn Phú", quan_cu: "Quận 9", nguon: "test" });
  };
  const tin = () => db().t.listings.at(-1);
  const rpcDuong = () => db().log.filter((x) => x.rpc === "tim_duong");
  const modelThay = (chu) => globalThis.__calls.some((c) => JSON.stringify(c.params ?? c).includes(chu));
  const pend = () => db().t.info_requests.filter((x) => x.status === "pending").map((x) => x.question);

  // Không dấu, khớp ĐÚNG → ghi có dấu ngay, không hỏi, không gợi ý.
  fresh(seedDuong);
  let rp = await send({ external_user_id: "duong-1", text: "bán nhà hẻm 4m pham the hien quận 8, 60m2, 5 tỷ" });
  check("DUONG-01 'pham the hien' khớp đúng từ điển → location_raw 'hẻm 4m Phạm Thế Hiển', không gợi ý, tra 1 lần bằng tên đường trần",
    rp.body.role === "seller" && tin().location_raw === "hẻm 4m Phạm Thế Hiển" && !tin().boc_tach?.duong_goi_y &&
      rpcDuong().length === 1 && rpcDuong()[0].args.p_ten === "pham the hien" && rpcDuong()[0].args.p_quan === "Quận 8",
    JSON.stringify({ l: tin(), rpc: rpcDuong(), rep: rp.body.replies }));

  // Sai 1 ký tự → câu hỏi đầu là XÁC NHẬN tên đường; gợi ý cất; địa chỉ vẫn chữ khách gõ.
  fresh(seedDuong);
  rp = await send({ external_user_id: "duong-2", text: "bán nhà hẻm 4m pham the hier quận 7, 60m2" });
  check("DUONG-02 'pham the hier' khớp gần → hỏi 'Dạ em hiểu là đường Phạm Thế Hiển đúng không', gợi ý ở boc_tach.duong_goi_y, địa chỉ chưa sửa",
    rp.body.replies.join("\n").includes("Dạ em hiểu là đường Phạm Thế Hiển đúng không") && tin().boc_tach?.duong_goi_y?.ten === "Phạm Thế Hiển" &&
      tin().boc_tach?.duong_goi_y?.vi_tri === "hẻm 4m Phạm Thế Hiển" && /pham the hier/.test(tin().location_raw ?? "") && pend().length > 0,
    JSON.stringify({ l: tin(), pend: pend(), rep: rp.body.replies }));
  const cauTreo = pend()[0];
  rp = await send({ external_user_id: "duong-2", text: "đúng rồi em" });
  check("DUONG-03 gật → location_raw 'hẻm 4m Phạm Thế Hiển', gợi ý xoá, bot 'Dạ em sửa lại Phạm Thế Hiển' rồi hỏi lại câu đang treo",
    tin().location_raw === "hẻm 4m Phạm Thế Hiển" && tin().boc_tach?.duong_goi_y === false &&
      rp.body.replies.some((r) => /sửa lại Phạm Thế Hiển/.test(r) && /\?/.test(r)) && pend().includes(cauTreo),
    JSON.stringify({ l: tin(), pend: pend(), rep: rp.body.replies }));

  // Không gật, trả lời câu treo → gợi ý bỏ, câu trả lời đi đường thường.
  fresh(seedDuong);
  await send({ external_user_id: "duong-3", text: "bán nhà hẻm 4m pham the hier quận 7, 60m2" });
  rp = await send({ external_user_id: "duong-3", text: "5 tỷ 2" });
  check("DUONG-04 không gật, nói '5 tỷ 2' → gợi ý xoá, địa chỉ giữ chữ khách gõ, giá vẫn ghi",
    tin().boc_tach?.duong_goi_y === false && /pham the hier/.test(tin().location_raw ?? "") && tin().price_vnd > 0,
    JSON.stringify({ l: tin(), rep: rp.body.replies }));

  // Từ điển trống → giữ nguyên, không hỏi, không sổ lỗi (đường đi bình thường).
  fresh();
  rp = await send({ external_user_id: "duong-4", text: "bán nhà hẻm 4m pham the hien quận 8, 60m2, 5 tỷ" });
  check("DUONG-05 từ điển trống → giữ 'pham the hien', không gợi ý, không bot_errors",
    /pham the hien/.test(tin().location_raw ?? "") && !tin().boc_tach?.duong_goi_y && db().t.bot_errors.length === 0,
    JSON.stringify({ l: tin(), loi: db().t.bot_errors }));

  // Trả lời câu ĐỊA CHỈ đang treo bằng chữ không dấu → sửa dấu theo từ điển.
  fresh(seedDuong);
  await send({ external_user_id: "duong-5", text: "bán nhà quận 9, 60m2, 5 tỷ" });
  const cauDangHoi = pend()[0]; // vi_tri hay phuong tuỳ chonCauKe — cả hai nhánh đều phải đối chiếu từ điển
  rp = await send({ external_user_id: "duong-5", text: "hẻm 12 le van viet" });
  check("DUONG-06 trả lời địa chỉ không dấu khi bot đang hỏi vị trí/phường → location_raw 'hẻm 12 Lê Văn Việt'",
    ["vi_tri", "phuong"].includes(cauDangHoi) && tin().location_raw === "hẻm 12 Lê Văn Việt",
    JSON.stringify({ cauDangHoi, l: tin(), rep: rp.body.replies }));
  // Và đúng nhánh GHI CÂU TRẢ LỜI (câu vị trí đang treo): mở thẳng câu vi_tri rồi trả lời không dấu.
  fresh(seedDuong);
  await send({ external_user_id: "duong-5b", text: "bán nhà quận 9, 60m2, 5 tỷ" });
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: tin().id, question: "vi_tri", status: "pending" });
  rp = await send({ external_user_id: "duong-5b", text: "hẻm 12 le van viet" });
  check("DUONG-06b câu vi_tri treo, trả lời không dấu → location_raw 'hẻm 12 Lê Văn Việt', câu vi_tri answered",
    tin().location_raw === "hẻm 12 Lê Văn Việt" && db().t.info_requests.some((x) => x.question === "vi_tri" && x.status === "answered"),
    JSON.stringify({ l: tin(), ir: db().t.info_requests.map((q) => [q.question, q.status]), rep: rp.body.replies }));

  // Bắn thật 21/09 (chế độ `chinh`): AI đọc "pham the hier" thành "Phạm Thế Hiển" (sửa chính tả) → kiểm bằng chứng
  // bỏ vì đổi chữ cái → tin KHÔNG có địa chỉ, không ai hỏi. Nay lấy TRÍCH DẪN làm địa chỉ → từ điển hỏi xác nhận.
  fresh(seedDuong);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
  globalThis.__model.parse = (p) => laLuotBocRao(p)
    ? { so_can: 1, kien_thuc: [], truong: [
        { khoa: "loai_bds", gia_tri: "nha_pho", trich_dan: "bán nhà", can: null },
        { khoa: "duong", gia_tri: "Phạm Thế Hiển", trich_dan: "pham the hier", can: null },
        { khoa: "quan", gia_tri: "Quận 8", trich_dan: "quận 8", can: null },
        { khoa: "dien_tich", gia_tri: "60", trich_dan: "60m2", can: null },
      ] } : OUT();
  rp = await send({ external_user_id: "duong-7", text: "bán nhà hẻm 4m pham the hier quận 7, 60m2" });
  check("DUONG-08 chế độ 'chinh': AI sửa 'pham the hier' → 'Phạm Thế Hiển' bị kiểm bằng chứng bỏ → lấy trích dẫn làm địa chỉ, từ điển hỏi xác nhận, gợi ý cất",
    /pham the hier/.test(tin().location_raw ?? "") && tin().boc_tach?.duong_goi_y?.ten === "Phạm Thế Hiển" && rp.body.replies.join("\n").includes("Dạ em hiểu là đường Phạm Thế Hiển đúng không"),
    JSON.stringify({ l: tin(), rep: rp.body.replies }));
  globalThis.__cauHinh = undefined;

  // Bắn thật 21/09 (mau-tdt, chế độ luật): rao không địa chỉ, trả lời câu vị trí bằng CÂU DÀI "nhà ở đường trần
  // đình trọng phường 2 quận 5, hẻm 6m…" → cụm đi nguyên vào tim_duong, không khớp gì. Nay cắt tên đường trần.
  const seedTBT = (d) => {
    d.insert("duong", { ten: "Trần Bình Trọng", tinh: "TP.HCM", tinh_cu: "TP.HCM", phuong: "Phường Chợ Quán", quan_cu: "Quận 5", nguon: "test" });
    d.insert("duong", { ten: "Trịnh Đình Trọng", tinh: "TP.HCM", tinh_cu: "TP.HCM", phuong: "Phường Bảy Hiền", quan_cu: "Quận Tân Bình", nguon: "test" });
  };
  fresh(seedTBT);
  await send({ external_user_id: "duong-8", text: "chào em, anh có căn nhà muốn bán, em tư vấn giúp anh" });
  rp = await send({ external_user_id: "duong-8", text: "nhà ở đường trần đình trọng phường 2 quận 5, hẻm 6m xe hơi vào tận nhà" });
  check("DUONG-09 câu địa chỉ dài → tra bằng tên trần 'trần đình trọng', khớp gần Trần Bình Trọng (1 ký tự) → hỏi 'Dạ em hiểu là đường Trần Bình Trọng đúng không', gợi ý cất",
    rpcDuong().some((x) => x.args.p_ten === "trần đình trọng") && tin().boc_tach?.duong_goi_y?.ten === "Trần Bình Trọng" && modelThay("Dạ em hiểu là đường Trần Bình Trọng đúng không"),
    JSON.stringify({ rpc: rpcDuong().map((x) => x.args), l: tin(), rep: rp.body.replies }));

  // Cùng kịch bản ở chế độ `chinh`: AI đọc "Trần Đình Trọng" (giá trị AI đi vào `loaiDapAn`) — bắn thật 21/09 tin
  // ghi thẳng, không ai hỏi. Nay hook từ điển chạy cả với giá trị AI.
  fresh(seedTBT);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
  globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
  await send({ external_user_id: "duong-9", text: "chào em, anh có căn nhà muốn bán, em tư vấn giúp anh" });
  globalThis.__model.parse = (p) => laLuotBocRao(p)
    ? { so_can: 0, kien_thuc: [], truong: [
        { khoa: "duong", gia_tri: "Trần Đình Trọng", trich_dan: "đường trần đình trọng", can: null },
        { khoa: "phuong", gia_tri: "2", trich_dan: "phường 2", can: null },
        { khoa: "quan", gia_tri: "Quận 5", trich_dan: "quận 5", can: null },
        { khoa: "do_rong_hem", gia_tri: "6", trich_dan: "hẻm 6m", can: null },
      ] } : OUT();
  rp = await send({ external_user_id: "duong-9", text: "nhà ở đường trần đình trọng phường 2 quận 5, hẻm 6m xe hơi vào tận nhà" });
  check("DUONG-10 chế độ 'chinh', AI đọc 'Trần Đình Trọng' → vẫn qua từ điển: gợi ý Trần Bình Trọng, hỏi xác nhận; địa chỉ tạm vẫn là chữ chưa sửa",
    tin().boc_tach?.duong_goi_y?.ten === "Trần Bình Trọng" && modelThay("Dạ em hiểu là đường Trần Bình Trọng đúng không") && /đình trọng/i.test(tin().location_raw ?? "") && !/Bình Trọng/.test(tin().location_raw ?? ""),
    JSON.stringify({ l: tin(), rep: rp.body.replies }));
  rp = await send({ external_user_id: "duong-9", text: "đúng rồi em, 3 phòng ngủ" });
  check("DUONG-11 gật KÈM thông tin ('đúng rồi em, 3 phòng ngủ') → địa chỉ mang 'Trần Bình Trọng', gợi ý xoá, 3 phòng ngủ vẫn ghi",
    /Trần Bình Trọng/.test(tin().location_raw ?? "") && !/đình trọng/i.test(tin().location_raw ?? "") && tin().boc_tach?.duong_goi_y === false && tin().bedrooms === 3,
    JSON.stringify({ l: tin(), rep: rp.body.replies }));
  globalThis.__cauHinh = undefined;

  // RPC hỏng → SỰ CỐ vào sổ, nhưng địa chỉ vẫn ghi như cũ (từ điển là lớp phụ).
  fresh(seedDuong); globalThis.__rpc.tim_duong = () => ({ data: null, error: { message: "boom" } });
  rp = await send({ external_user_id: "duong-6", text: "bán nhà hẻm 4m pham the hien quận 8, 60m2, 5 tỷ" });
  check("DUONG-07 RPC tim_duong hỏng → 1 dòng bot_errors, địa chỉ vẫn ghi chữ khách gõ",
    db().t.bot_errors.some((e) => /tim_duong/.test(JSON.stringify(e))) && /pham the hien/.test(tin().location_raw ?? ""),
    JSON.stringify({ l: tin(), loi: db().t.bot_errors }));
}

// ── 21/09/2026 (bắn thật mau-tdt): bản nháp và câu duyệt — không nuốt câu hỏi ngược, gật ở vế đầu vẫn là gật ──
// 01/10/2026 (chủ dự án test Zalo: "phường ko có mà sao ghi là Không Có Phường viết vào tin"): "ko có" / "ko có phường" khi hỏi
// phường không phải tên phường, cũng không phải thông tin bổ sung.
for (const [uid, cau] of [["pkc-1", "ko có"], ["pkc-2", "ko có phường"], ["pkc-3", "không biết phường nào"]]) {
  const tin = () => db().t.listings.at(-1);
  fresh();
  await send({ external_user_id: uid, text: "bán nhà phố hẻm 4m Lê Văn Sỹ quận 3, 4x15, trệt 2 lầu, giá 8 tỷ" });
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: tin().id, question: "phuong", status: "pending" });
  const rp = await send({ external_user_id: uid, text: cau });
  check(`PHUONG-KC '${cau}' khi hỏi phường → KHÔNG ghi phường, KHÔNG ghi bổ sung`,
    !tin().ward && !db().t.listing_facts.some((f) => f.listing_id === tin().id && /^(?:phuong|bo_sung)$/.test(f.question) && /ko có|không biết/.test(f.answer ?? "")),
    JSON.stringify({ ward: tin().ward, facts: db().t.listing_facts.filter((f) => f.listing_id === tin().id).map((f) => [f.question, f.answer]), rep: rp.body.replies }));
}
// 30/09/2026 (bắn thử bán lx-ban-292a): chờ duyệt nháp, "chính chủ đứng tên, không thế chấp" → ghi HAI ý; lời không đổi bản nháp
// thì không gửi lại nháp kèm "Em sửa lại rồi".
{
  const tin = () => db().t.listings.at(-1);
  const fq = (q) => db().t.listing_facts.filter((f) => f.listing_id === tin().id && f.question === q).map((f) => f.answer);
  fresh();
  await send({ external_user_id: "nhap-s", text: "bán nhà hẻm 6m Trần Bình Trọng phường 2 quận 5, 4x15, trệt 2 lầu, 3 phòng ngủ, giá 9 tỷ 5" });
  tin().alley_width_m = 6; tin().area_m2 = 60; tin().frontage_m = 4;
  coSanPhapLy(tin().id);
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: tin().id, question: "phap_ly", status: "pending" });
  await send({ external_user_id: "nhap-s", text: "sổ hồng riêng, hoàn công đủ" });
  let rp = await send({ external_user_id: "nhap-s", text: "chính chủ đứng tên, không thế chấp" });
  check("NHAP-S1 chờ duyệt, 'chính chủ đứng tên, không thế chấp' → ô đứng tên 'chính chủ đứng tên' + ô thế chấp 'không thế chấp'",
    fq("nguoi_dung_ten").includes("chính chủ đứng tên") && fq("the_chap").includes("không thế chấp"),
    JSON.stringify({ facts: db().t.listing_facts.filter((f) => f.listing_id === tin().id).map((f) => [f.question, f.answer]), rep: rp.body.replies }));
  rp = await send({ external_user_id: "nhap-s", text: "ba anh đứng tên" });
  check("NHAP-S2 lời không đổi dòng nào của bản nháp → 'Dạ em ghi thêm rồi', KHÔNG gửi lại nháp / 'Em sửa lại rồi'",
    rp.body.replies.some((r) => /ghi thêm rồi/.test(r)) && !rp.body.replies.some((r) => /Em sẽ rao như vầy|Em sửa lại rồi/.test(r)),
    JSON.stringify(rp.body.replies));
}
{
  const tin = () => db().t.listings.at(-1);
  const pendQ = () => db().t.info_requests.filter((x) => x.status === "pending").map((x) => x.question);
  // Tin đủ điểm ngay lúc trả lời pháp lý → bản nháp gửi luôn; câu "mà em là người hay máy vậy?" phải được đáp TRƯỚC bản nháp.
  fresh();
  await send({ external_user_id: "nhap-1", text: "bán nhà hẻm 6m Trần Bình Trọng phường 2 quận 5, 4x15, trệt 2 lầu, 3 phòng ngủ, giá 9 tỷ 5" });
  tin().alley_width_m = 6; tin().area_m2 = 60; tin().frontage_m = 4; // mock không bóc hẻm/4x15 từ câu rao; DB thật có (boc_thong_so) — đủ 70 điểm sau câu pháp lý
  coSanPhapLy(tin().id);
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: tin().id, question: "phap_ly", status: "pending" });
  let rp = await send({ external_user_id: "nhap-1", text: "sổ hồng riêng, hoàn công đủ. mà em là người hay máy vậy?" });
  const iNhap = rp.body.replies.findIndex((r) => /Em sẽ rao như vầy/.test(r));
  const iDap = rp.body.replies.findIndex((r) => /trợ lý AI/.test(r));
  check("NHAP-01 trả lời pháp lý kèm hỏi 'người hay máy' → có bong bóng 'em là trợ lý AI' ĐỨNG TRƯỚC bản nháp",
    iNhap >= 0 && iDap >= 0 && iDap < iNhap && pendQ().includes("duyet_tin"),
    JSON.stringify({ rep: rp.body.replies, pend: pendQ() }));
  // Gật ở vế đầu + lời bình → là GẬT: tin duyệt, không có "📝 Thêm: ok em đăng đi…", không gửi lại nháp.
  rp = await send({ external_user_id: "nhap-1", text: "ok em đăng đi, mà cái dòng phù hợp đọc kỳ quá" });
  check("NHAP-02 'ok em đăng đi, mà cái dòng phù hợp đọc kỳ quá' lúc duyệt → gật (chu_duyet_at), không vào bo_sung, không gửi lại nháp",
    !!tin().chu_duyet_at && !db().t.listing_facts.some((f) => f.question === "bo_sung" && /đăng đi/.test(f.answer)) && !rp.body.replies.some((r) => /Em sẽ rao như vầy|Em sửa lại rồi/.test(r)),
    JSON.stringify({ l: { chu_duyet_at: tin().chu_duyet_at }, facts: db().t.listing_facts.map((f) => [f.question, f.answer]), rep: rp.body.replies }));
  check("AOND-05 tin lên kệ mà chưa từng nói phí → DẪN PHÍ một câu hỏi (demo AOND), body.dan_phi",
    rp.body.dan_phi === true && rp.body.replies.some((r) => /biết phí bên em chưa/.test(r)), JSON.stringify({ rep: rp.body.replies, dan_phi: rp.body.dan_phi }));
  // Vế sau có LỜI SỬA ("mà giá 9 tỷ 8") → FR-164 ghi giá mới trước, phần còn lại "ok đăng đi" là gật (FR-177 g:
  // "đủ rồi, đăng đi" lúc duyệt là GẬT) → tin duyệt với giá MỚI. Không được mất giá mới, không được vào bo_sung.
  fresh();
  await send({ external_user_id: "nhap-2", text: "bán nhà hẻm 6m Trần Bình Trọng phường 2 quận 5, 4x15, trệt 2 lầu, 3 phòng ngủ, giá 9 tỷ 5" });
  tin().alley_width_m = 6; tin().area_m2 = 60; tin().frontage_m = 4;
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: tin().id, question: "phap_ly", status: "pending" });
  await send({ external_user_id: "nhap-2", text: "sổ hồng riêng, hoàn công đủ" });
  rp = await send({ external_user_id: "nhap-2", text: "ok đăng đi, mà giá 9 tỷ 8 nha em" });
  check("NHAP-03 'ok đăng đi, mà giá 9 tỷ 8 nha em' → giá 9 tỷ 8 ghi (lời sửa), rồi gật → duyệt; không vào bo_sung",
    /9 tỷ 8/.test(tin().price_raw ?? "") && !!tin().chu_duyet_at && !db().t.listing_facts.some((f) => f.question === "bo_sung" && /đăng đi/.test(f.answer)),
    JSON.stringify({ l: { price_raw: tin().price_raw, chu_duyet_at: tin().chu_duyet_at }, rep: rp.body.replies }));
  // 21/09/2026 tối (bắn thật kiem-cc2): chủ nhà là CHÚ gật "ok đăng đi cháu" → từng KHÔNG gật (bộ đệm `laDongY`
  // thiếu cháu/chú/cô/bác), lời gật thành "📝 Thêm: ok đăng đi cháu" và nháp gửi lại. Nay gật như "ok đăng đi em".
  fresh();
  await send({ external_user_id: "nhap-3", text: "chào cháu, chú bán nhà hẻm 6m Trần Bình Trọng phường 2 quận 5, 4x15, trệt 2 lầu, 3 phòng ngủ, giá 9 tỷ 5" });
  tin().alley_width_m = 6; tin().area_m2 = 60; tin().frontage_m = 4;
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: tin().id, question: "phap_ly", status: "pending" });
  await send({ external_user_id: "nhap-3", text: "sổ hồng riêng rồi cháu, chú đứng tên" });
  rp = await send({ external_user_id: "nhap-3", text: "ok đăng đi cháu" });
  check("NHAP-04 chủ nhà là CHÚ: 'ok đăng đi cháu' lúc duyệt → gật (chu_duyet_at), không vào bo_sung, không gửi lại nháp, xưng cháu",
    !!tin().chu_duyet_at && !db().t.listing_facts.some((f) => f.question === "bo_sung" && /đăng đi/.test(f.answer)) && !rp.body.replies.some((r) => /đăng tin như vầy|sửa lại rồi/i.test(r)) && !rp.body.replies.some((r) => /(?<![\p{L}])em(?![\p{L}])/iu.test(r)),
    JSON.stringify({ l: { chu_duyet_at: tin().chu_duyet_at, xung_ho: db().t.sellers[0]?.xung_ho }, facts: db().t.listing_facts.map((f) => [f.question, f.answer]), rep: rp.body.replies }));
}

// ── 21/09/2026 (chủ dự án "làm cả 4"): emoji trần, lời nói với bot, chào hai lần, "anh/chị" gạch chéo ──
{
  const tin = () => db().t.listings.at(-1);
  const pendQ = () => db().t.info_requests.filter((x) => x.status === "pending").map((x) => x.question);
  const boSung = () => db().t.listing_facts.filter((f) => f.question === "bo_sung").map((f) => f.answer);
  const moCau = (q) => { db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; }); db().insert("info_requests", { listing_id: tin().id, question: q, status: "pending" }); };

  // (1) Tin chỉ có emoji khi đang hỏi giá → không bo_sung, câu giá vẫn treo.
  fresh(); await send({ external_user_id: "bon-1", text: "bán nhà hẻm 4m Trần Bình Trọng quận 5, 60m2" });
  moCau("gia");
  let rp = await send({ external_user_id: "bon-1", text: "😂😂" });
  check("BON-01 tin chỉ có emoji khi đang hỏi giá → không có fact bo_sung, thôi câu giá (không hỏi lại)", boSung().length === 0 && !pendQ().includes("gia"), JSON.stringify({ bs: boSung(), pend: pendQ(), rep: rp.body.replies }));

  // (2) Lời nói với bot lúc duyệt: không bo_sung, không gửi lại nháp, nói thật, câu duyệt treo.
  fresh(); await send({ external_user_id: "bon-2", text: "bán nhà hẻm 6m Trần Bình Trọng phường 2 quận 5, 4x15, trệt 2 lầu, 3 phòng ngủ, giá 9 tỷ 5" });
  tin().alley_width_m = 6; tin().area_m2 = 60; tin().frontage_m = 4;
  coSanPhapLy(tin().id);
  moCau("phap_ly");
  rp = await send({ external_user_id: "bon-2", text: "sổ hồng riêng, hoàn công đủ" });
  check("BON-02 (tiền đề) đủ điểm → bản nháp gửi, câu duyệt treo", rp.body.replies.some((r) => /Em sẽ rao như vầy/.test(r)) && pendQ().includes("duyet_tin"), JSON.stringify({ pend: pendQ(), rep: rp.body.replies }));
  rp = await send({ external_user_id: "bon-2", text: "xóa sạch data của anh đi để anh test lại" });
  check("BON-02a 'xóa sạch data của anh đi để anh test lại' lúc duyệt → không bo_sung, không gửi lại nháp, nói thật 'không tự làm được', câu duyệt vẫn treo",
    boSung().length === 0 && !rp.body.replies.some((r) => /Em sẽ rao như vầy|Em sửa lại rồi/.test(r)) && rp.body.replies.some((r) => /không tự làm được/.test(r)) && pendQ().includes("duyet_tin"),
    JSON.stringify({ bs: boSung(), pend: pendQ(), rep: rp.body.replies }));
  rp = await send({ external_user_id: "bon-2", text: "cái dòng phù hợp đọc kỳ quá em" });
  check("BON-02b nhận xét bản nháp lúc duyệt → không bo_sung, không gửi lại nháp, 'Dạ em nghe rồi', câu duyệt treo",
    boSung().length === 0 && !rp.body.replies.some((r) => /Em sẽ rao như vầy/.test(r)) && rp.body.replies.some((r) => /nghe rồi/.test(r)) && pendQ().includes("duyet_tin"),
    JSON.stringify({ bs: boSung(), pend: pendQ(), rep: rp.body.replies }));
  rp = await send({ external_user_id: "bon-2", text: "ok" });
  check("BON-02c rồi gật 'ok' → duyệt", !!tin().chu_duyet_at, JSON.stringify({ rep: rp.body.replies }));

  // (2c) Xin xoá dữ liệu khi đang hỏi giá → không bo_sung, bong bóng nói thật, câu giá treo.
  fresh(); await send({ external_user_id: "bon-3", text: "bán nhà hẻm 4m Trần Bình Trọng quận 5, 60m2" });
  moCau("gia");
  rp = await send({ external_user_id: "bon-3", text: "xóa hết dữ liệu của anh đi" });
  check("BON-03 xin xoá dữ liệu khi đang hỏi giá → không bo_sung, có bong bóng 'không tự làm được', câu giá vẫn treo",
    boSung().length === 0 && rp.body.replies.some((r) => /không tự làm được/.test(r)) && pendQ().includes("gia"),
    JSON.stringify({ bs: boSung(), pend: pendQ(), rep: rp.body.replies }));

  // (3) Khách chào, model sống → không chào tiền định riêng (model đã chào); model hỏng → chào tiền định.
  fresh(); globalThis.__model.create = () => "Chào chị, em M•ai bên AI Ơi Nhà Đất ạ. Chị cho em xin địa chỉ nhà nha?";
  rp = await send({ external_user_id: "bon-4", text: "chào em, chị có căn nhà ở q10 muốn bán" });
  check("BON-04 khách chào, câu model ĐÃ có lời chào → KHÔNG thêm bong bóng 'Dạ em chào chị ạ!' (chào một lần)",
    rp.body.role === "seller" && !rp.body.replies.some((r) => /Dạ em chào chị ạ!/.test(r)) && rp.body.replies.some((r) => /Chào chị, em M•ai/.test(r)), JSON.stringify({ rep: rp.body.replies }));
  fresh(); rp = await send({ external_user_id: "bon-4b", text: "chào em, chị có căn nhà ở q10 muốn bán" });
  check("BON-04b khách chào, câu model KHÔNG chào → vẫn có lời chào tiền định", rp.body.replies.some((r) => /Dạ em chào chị ạ!/.test(r)), JSON.stringify({ rep: rp.body.replies }));

  // (4) Chưa biết cách gọi → không bong bóng nào còn "anh/chị" gạch chéo.
  // 23/09/2026: câu "Sai chỗ nào anh/chị nhắn lại" (bằng chứng cũ) đã bỏ — model giả trả câu có "anh/chị" để đo bộ lọc.
  fresh(); globalThis.__model.create = () => "Nhà mình mấy tầng vậy anh/chị?";
  rp = await send({ external_user_id: "bon-5", text: "bán nhà hẻm 4m Trần Bình Trọng quận 5, 60m2, 5 tỷ" });
  check("BON-05 chưa biết cách gọi → không bong bóng nào chứa 'anh/chị', có 'anh chị'", !rp.body.replies.some((r) => /anh\/chị/i.test(r)) && rp.body.replies.some((r) => /anh chị/i.test(r)), JSON.stringify({ rep: rp.body.replies }));
  globalThis.__model.create = undefined;
  fresh(); rp = await send({ external_user_id: "bon-6", text: "chào em, anh có căn nhà hẻm 4m Trần Bình Trọng quận 5, 60m2, 5 tỷ" });
  check("BON-06 đã biết 'anh' → câu lệnh gửi model gọi 'anh', lời chào 'Dạ em chào anh'",
    JSON.stringify(createCalls().at(-1)?.params ?? {}).includes('Gọi chủ nhà là \\"anh\\"') && rp.body.replies.some((r) => /Dạ em chào anh/.test(r)), JSON.stringify({ rep: rp.body.replies }));
  // 22/09/2026 (bộ đo giọng `bot/tests/giong`, ca M01/M02/M06): nhánh MUA chưa qua bộ lọc gạch chéo —
  // model trả JSON hỏng → câu dò tiền định "Anh/chị cho em xin thêm…" đi thẳng ra khách.
  fresh(seedKho);
  globalThis.__model.create = () => "không phải json";
  rp = await send({ external_user_id: "mua-gach-cheo", text: "mình tìm nhà quận 5 tầm 7 tỷ để ở" });
  check("BON-07 khách MUA chưa biết cách gọi, model hỏng JSON → câu dò tiền định KHÔNG còn 'anh/chị' gạch chéo",
    rp.body.replies.length > 0 && !rp.body.replies.some((r) => /anh\s*\/\s*chị/i.test(r)), JSON.stringify(rp.body.replies));
}

// ── FR-209 (15/09/2026): tra PHƯỜNG MỚI từ tên đường — Nominatim → bảng `wards`, HỎI XÁC NHẬN, gật mới ghi ──
{
  // JSON rút gọn từ câu trả lời THẬT của Nominatim cho "Lê Văn Việt, Thành phố Hồ Chí Minh" (15/09/2026).
  const LVV = [{ addresstype: "road", name: "Lê Văn Việt", address: { road: "Lê Văn Việt", suburb: "Phường Tăng Nhơn Phú", city: "Thành phố Hồ Chí Minh" } }];
  const seedWards = (d) => {
    d.insert("wards", { ten: "Tăng Nhơn Phú", ten_day_du: "Phường Tăng Nhơn Phú", quan_cu: "Quận 9", loai: "phuong" });
    d.insert("wards", { ten: "Long Trường", ten_day_du: "Phường Long Trường", quan_cu: "Quận 9", loai: "phuong" });
  };
  const pendPh = () => db().t.info_requests.some((x) => x.question === "phuong" && x.status === "pending");
  const tin = () => db().t.listings.at(-1);
  const nomi = () => (globalThis.__fetches ?? []).filter((u) => /nominatim/.test(u));
  const modelThay = (chu) => globalThis.__calls.some((c) => JSON.stringify(c.params ?? c).includes(chu));

  fresh(seedWards); globalThis.__nominatim = LVV;
  let rp = await send({ external_user_id: "ph-1", text: "bán căn hộ 5 tầng sổ hồng riêng, đường Lê Văn Việt, 60m2, 5 tỷ" });
  check("PH-01 rao có đường, không quận → câu hỏi đầu là XÁC NHẬN 'Phường Tăng Nhơn Phú (Quận 9 cũ)'; chưa ghi ward/quận; gợi ý ở boc_tach; câu phường treo",
    rp.body.role === "seller" && rp.body.replies.join("\n").includes("Phường Tăng Nhơn Phú (Quận 9 cũ), đúng không") && !tin().ward && tin().district == null &&
      tin().boc_tach?.phuong_goi_y?.phuong === "Phường Tăng Nhơn Phú" && tin().boc_tach?.phuong_goi_y?.quan === "Quận 9" && pendPh(),
    JSON.stringify({ rep: rp.body.replies, l: tin(), ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  check("PH-01b gọi Nominatim đúng MỘT lần, bằng TÊN ĐƯỜNG (không số nhà), ghim countrycodes=vn",
    nomi().length === 1 && /countrycodes=vn/.test(nomi()[0]) && /q=L%C3%AA%20V%C4%83n%20Vi%E1%BB%87t%2C/.test(nomi()[0]), JSON.stringify(nomi()));
  rp = await send({ external_user_id: "ph-1", text: "đúng rồi em" });
  check("PH-02 chủ GẬT → ward = Phường Tăng Nhơn Phú, district = Quận 9, quan_mac_dinh=false, gợi ý xoá, câu phường answered, bot hỏi câu kế",
    tin().ward === "Phường Tăng Nhơn Phú" && tin().district === "Quận 9" && tin().boc_tach?.quan_mac_dinh === false && tin().boc_tach?.phuong_goi_y === false &&
      !pendPh() && db().t.info_requests.some((x) => x.question === "phuong" && x.status === "answered") && rp.body.replies.length > 0,
    JSON.stringify({ l: tin(), ir: db().t.info_requests.map((q) => [q.question, q.status]), rep: rp.body.replies }));

  // Không gật, tự nói phường số + quận → đường cũ (capNhatQuan), gợi ý bỏ.
  fresh(seedWards); globalThis.__nominatim = LVV;
  await send({ external_user_id: "ph-2", text: "bán nhà đường Lê Văn Việt 50m2 4 tỷ" });
  rp = await send({ external_user_id: "ph-2", text: "phường 8 quận 5 em" });
  check("PH-03 không gật, nói 'phường 8 quận 5' → ward Phường 8, district Quận 5 hết mặc định, gợi ý xoá",
    tin().ward === "Phường 8" && tin().district === "Quận 5" && tin().boc_tach?.quan_mac_dinh === false && tin().boc_tach?.phuong_goi_y === false,
    JSON.stringify({ l: tin(), rep: rp.body.replies }));

  // Tự nói TÊN phường mới KHÁC gợi ý → tra `wards` lấy quận, ghi tên chuẩn.
  fresh(seedWards); globalThis.__nominatim = LVV;
  await send({ external_user_id: "ph-3", text: "bán nhà đường Lê Văn Việt 50m2 4 tỷ" });
  rp = await send({ external_user_id: "ph-3", text: "không, phường long trường" });
  check("PH-04 chủ nói tên phường MỚI khác ('phường long trường') → ward 'Phường Long Trường' (chữ chuẩn từ wards), district Quận 9",
    tin().ward === "Phường Long Trường" && tin().district === "Quận 9" && tin().boc_tach?.phuong_goi_y === false,
    JSON.stringify({ l: tin(), rep: rp.body.replies }));

  // Nominatim hỏng → hỏi như cũ, không gợi ý, KHÔNG vào sổ lỗi (đường đi bình thường).
  fresh(seedWards); globalThis.__nominatim = undefined;
  rp = await send({ external_user_id: "ph-4", text: "bán nhà đường Lê Văn Việt 50m2 4 tỷ" });
  check("PH-05 Nominatim 404 → hỏi 'phường mấy, quận nào' như cũ, không gợi ý, không bot_errors",
    (modelThay("phường mấy, quận nào") || modelThay("phường và quận")) && !tin().boc_tach?.phuong_goi_y && pendPh() && db().t.bot_errors.length === 0,
    JSON.stringify({ l: tin(), loi: db().t.bot_errors, rep: rp.body.replies }));

  // (Câu xác nhận / chọn do code tra ra được gửi NGUYÊN VĂN — kiểm trên câu trả lời, không trên lệnh gửi model.)
  // 25/09/2026 (chủ dự án: "người ta đưa số nhà và tên đường và quận rồi nhưng mà lại cố hỏi là phường nào"): ĐÃ biết quận
  // → tra bảng `duong` trong quận đó: một phường → hỏi xác nhận; hai phường → hỏi chọn; không có → hỏi như cũ.
  const seedTDX = (d, hai = false) => {
    seedWards(d);
    d.insert("wards", { ten: "Cầu Ông Lãnh", ten_day_du: "Phường Cầu Ông Lãnh", quan_cu: "Quận 1", loai: "phuong" });
    d.insert("duong", { ten: "Trần Đình Xu", ten_khong_dau: "tran dinh xu", tinh: "TP.HCM", tinh_cu: "TP.HCM", phuong: "Phường Cầu Ông Lãnh", quan_cu: "Quận 1", nguon: "test" });
    d.insert("duong", { ten: "Trần Đình Xu", ten_khong_dau: "tran dinh xu", tinh: "TP.HCM", tinh_cu: "TP.HCM", phuong: "Phường Rạch Dừa", quan_cu: "Vũng Tàu", nguon: "test" });
    if (hai) d.insert("duong", { ten: "Trần Đình Xu", ten_khong_dau: "tran dinh xu", tinh: "TP.HCM", tinh_cu: "TP.HCM", phuong: "Phường Bến Thành", quan_cu: "Quận 1", nguon: "test" });
  };
  fresh((d) => seedTDX(d)); globalThis.__nominatim = undefined;
  rp = await send({ external_user_id: "ph-q1", text: "bán nhà 152 Trần Đình Xu quận 1, 8x15, 1 trệt 4 lầu, 4 phòng ngủ, sổ hồng riêng, giá 65 tỷ" });
  check("PH-Q1a đã có số nhà + đường + QUẬN → không hỏi trống 'phường mấy': hỏi XÁC NHẬN 'Phường Cầu Ông Lãnh (Quận 1 cũ)', gợi ý cất",
    rp.body.replies.join("\n").includes("Phường Cầu Ông Lãnh (Quận 1 cũ), đúng không") && tin().boc_tach?.phuong_goi_y?.phuong === "Phường Cầu Ông Lãnh" && pendPh(),
    JSON.stringify({ rep: rp.body.replies, l: tin() }));
  rp = await send({ external_user_id: "ph-q1", text: "đúng rồi em" });
  check("PH-Q1b gật → ward Phường Cầu Ông Lãnh, quận vẫn Quận 1", tin().ward === "Phường Cầu Ông Lãnh" && tin().district === "Quận 1" && !pendPh(),
    JSON.stringify({ l: tin(), rep: rp.body.replies }));
  fresh((d) => seedTDX(d, true)); globalThis.__nominatim = undefined;
  rp = await send({ external_user_id: "ph-q2", text: "bán nhà 152 Trần Đình Xu quận 1, 8x15, 1 trệt 4 lầu, 4 phòng ngủ, sổ hồng riêng, giá 65 tỷ" });
  check("PH-Q1c đường có HAI phường trong quận → hỏi chọn 'Phường Cầu Ông Lãnh hay Phường Bến Thành', không cất gợi ý",
    rp.body.replies.join("\n").includes("thuộc Phường Cầu Ông Lãnh hay Phường Bến Thành") && !tin().boc_tach?.phuong_goi_y && pendPh(),
    JSON.stringify({ rep: rp.body.replies, l: tin() }));

  // 23/09/2026 (Zalo chủ dự án): "nhà ở trần bình trọng" + "số nhà 105" → bot "thuộc Phường Vườn Lài (Quận 10 cũ)",
  // số 105 thật ở Chợ Quán (Q5 cũ). Đường có ở NHIỀU phường → không đoán, không cất gợi ý, hỏi kèm các quận.
  {
    const TBT = ["Phường Chợ Quán", "Phường Vườn Lài", "Phường Bình Lợi Trung"].map((p) => ({ addresstype: "road", address: { road: "Trần Bình Trọng", suburb: p, city: "Thành phố Hồ Chí Minh" } }));
    fresh((d) => {
      d.insert("wards", { ten: "Chợ Quán", ten_day_du: "Phường Chợ Quán", quan_cu: "Quận 5", loai: "phuong" });
      d.insert("wards", { ten: "Vườn Lài", ten_day_du: "Phường Vườn Lài", quan_cu: "Quận 10", loai: "phuong" });
      d.insert("wards", { ten: "Bình Lợi Trung", ten_day_du: "Phường Bình Lợi Trung", quan_cu: "Bình Thạnh", loai: "phuong" });
    });
    globalThis.__nominatim = TBT;
    rp = await send({ external_user_id: "ph-tbt", text: "anh bán nhà số 105 đường Trần Bình Trọng giá 9 tỷ" });
    const tat = JSON.stringify(rp.body.replies) + JSON.stringify(globalThis.__calls.map((c) => c.params ?? c));
    check("PH-12 đường có ở nhiều phường (Chợ Quán/Q5, Vườn Lài/Q10, Bình Lợi Trung) → KHÔNG khẳng định 'thuộc Phường Vườn Lài', không cất gợi ý, hỏi kèm 'Quận 5, Quận 10, Bình Thạnh', ward/quận trống",
      !/thuộc Phường Vườn Lài|thuộc Phường Chợ Quán/.test(tat) && /có ở nhiều nơi \(Quận 5, Quận 10, Bình Thạnh\)/.test(tat) &&
        !tin().boc_tach?.phuong_goi_y && !tin().ward && tin().district == null,
      JSON.stringify({ rep: rp.body.replies, l: tin() }));
  }

  // 25/09/2026 (chủ dự án test Zalo): "a bán nhà" → bot hỏi địa chỉ → "an duong vương" → bot ghi rồi hỏi ô tô, KHÔNG hỏi
  // quận ("An Dương Vương nó 2 3 chỗ lận"). Vừa trả lời địa chỉ mà quận chưa rõ → câu kế là phường/quận, kể các quận.
  {
    const ADV = ["Phường Chợ Quán", "Phường An Lạc", "Phường Bình Phú"].map((p) => ({ addresstype: "road", address: { road: "An Dương Vương", suburb: p, city: "Thành phố Hồ Chí Minh" } }));
    fresh((d) => {
      d.insert("wards", { ten: "Chợ Quán", ten_day_du: "Phường Chợ Quán", quan_cu: "Quận 5", loai: "phuong" });
      d.insert("wards", { ten: "An Lạc", ten_day_du: "Phường An Lạc", quan_cu: "Bình Tân", loai: "phuong" });
      d.insert("wards", { ten: "Bình Phú", ten_day_du: "Phường Bình Phú", quan_cu: "Quận 6", loai: "phuong" });
      d.insert("duong", { ten: "An Dương Vương", ten_khong_dau: "an duong vuong", phuong: "Phường Chợ Quán", quan_cu: "Quận 5" });
      d.insert("duong", { ten: "An Dương Vương", ten_khong_dau: "an duong vuong", phuong: "Phường An Đông", quan_cu: "Quận 5" });
      d.insert("duong", { ten: "An Dương Vương", ten_khong_dau: "an duong vuong", phuong: "Phường An Lạc", quan_cu: "Bình Tân" });
    });
    globalThis.__nominatim = ADV;
    await send({ external_user_id: "ph-adv", text: "a bán nhà" });
    const hoiDiaChi = db().t.info_requests.some((q) => q.question === "vi_tri" && q.status === "pending");
    rp = await send({ external_user_id: "ph-adv", text: "an duong vương" });
    check("PH-13 'a bán nhà' → hỏi địa chỉ → 'an duong vương' (quận chưa rõ) → câu kế là phường/quận, kể 'Quận 5, Bình Tân, Quận 6', câu phường treo, không hỏi ô tô",
      hoiDiaChi && /có ở nhiều nơi \(Quận 5, Bình Tân, Quận 6\)/.test(rp.body.replies.join(" ")) && pendPh() &&
        !db().t.info_requests.some((q) => q.question === "do_rong_hem" && q.status === "pending") && !tin().ward,
      JSON.stringify({ hoiDiaChi, rep: rp.body.replies, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
    // Bắn thật lx-29: "quận 5 em" → ward thành "quận 5". Chỉ nói quận → ghi quận, ward trống, hỏi phường theo bảng đường.
    // Bắn lại lx-30 sau #308: model viết lại mất tên phường ("Dạ nhà anh thuộc phường nào vậy anh?") và 🤖 báo "Không bóc
    // tách được gì" dù quận đã ghi. Câu hỏi phường giữ nguyên văn gợi ý; 🤖 báo quận.
    globalThis.__model.create = () => "Dạ nhà anh thuộc phường nào vậy anh?";
    const chCu = globalThis.__cauHinh;
    globalThis.__cauHinh = { ...(chCu ?? {}), bao_lai_da_luu: "thay_doi" };
    rp = await send({ external_user_id: "ph-adv", text: "quận 5 em" });
    globalThis.__cauHinh = chCu;
    globalThis.__model.create = undefined;
    check("PH-13b 'quận 5 em' khi hỏi phường/quận → district Quận 5, ward TRỐNG, câu phường treo, hỏi chọn 'Phường Chợ Quán hay Phường An Đông' (dù model bỏ tên phường), 🤖 báo quận",
      tin().district === "Quận 5" && !tin().ward && pendPh() && !db().t.listing_facts.some((f) => f.question === "phuong") &&
        /Phường Chợ Quán hay Phường An Đông/.test(rp.body.replies.join(" ")) && rp.body.replies.some((x) => /^🤖.*quận: "Quận 5"/.test(x)),
      JSON.stringify({ rep: rp.body.replies, l: { w: tin().ward, d: tin().district }, f: db().t.listing_facts.filter((f) => f.question === "phuong") }));
  }

  // Tra được phường nhưng bảng `wards` KHÔNG có (phường mới chưa nạp) → hỏi như cũ.
  fresh(); globalThis.__nominatim = LVV;
  rp = await send({ external_user_id: "ph-5", text: "bán nhà đường Lê Văn Việt 50m2 4 tỷ" });
  check("PH-06 wards trống → không gợi ý, hỏi như cũ", !tin().boc_tach?.phuong_goi_y && pendPh() && (modelThay("phường mấy, quận nào") || modelThay("phường và quận")), JSON.stringify({ l: tin(), rep: rp.body.replies }));

  // Câu rao đã NÓI quận → không tra (không tốn lượt Nominatim), hỏi phường như cũ.
  fresh(seedWards); globalThis.__nominatim = LVV;
  rp = await send({ external_user_id: "ph-6", text: "bán nhà đường Lê Văn Việt quận 9, 50m2 4 tỷ" });
  check("PH-07 câu rao có quận → KHÔNG gọi Nominatim, không gợi ý", nomi().length === 0 && !tin().boc_tach?.phuong_goi_y && tin().district === "Quận 9", JSON.stringify({ l: tin(), f: nomi() }));

  // Địa chỉ nói ở LƯỢT SAU (câu đầu hỏi địa chỉ) → câu kế là phường có gợi ý.
  fresh(seedWards); globalThis.__nominatim = LVV;
  rp = await send({ external_user_id: "ph-7", text: "bán nhà 50m2 4 tỷ" });
  const irDau = db().t.info_requests.map((q) => [q.question, q.status]);
  rp = await send({ external_user_id: "ph-7", text: "hẻm 12 Lê Văn Việt" });
  check("PH-08 bot hỏi phường, chủ trả lời bằng ĐỊA CHỈ → ghi vi_tri (không ghi vào phường), tra đường rồi hỏi xác nhận, câu phường vẫn treo",
    irDau.some(([q]) => q === "phuong") && /Phường Tăng Nhơn Phú \(Quận 9 cũ\), đúng không/.test(rp.body.replies.join(" ")) &&
      db().t.listing_facts.some((f) => f.question === "vi_tri" && f.answer === "hẻm 12 Lê Văn Việt") && !tin().ward &&
      tin().boc_tach?.phuong_goi_y?.duong === "Lê Văn Việt" && pendPh() && nomi().length === 1,
    JSON.stringify({ irDau, ir: db().t.info_requests.map((q) => [q.question, q.status]), bt: tin().boc_tach, ward: tin().ward, f: nomi(), rep: rp.body.replies }));
  // 15/09/2026 (bắn thật C3): địa chỉ trả lời câu phường KÈM kích thước / nở hậu → fact
  // đi kèm phải ghi luôn (bản trước chỉ ghi vi_tri, "4x14" và "nở hậu 5m" rơi mất);
  // tên đường "Cách Mạng Tháng 8" giữ số cuối.
  fresh(seedWards); globalThis.__nominatim = undefined;
  await send({ external_user_id: "ph-7c", text: "bán nhà quận 10 4 tỷ" });
  rp = await send({ external_user_id: "ph-7c", text: "hẻm 5m Cách Mạng Tháng 8, 4x14 nở hậu 5m" });
  check("PH-08c địa chỉ + '4x14 nở hậu 5m' trả lời câu phường → vi_tri 'hẻm 5m Cách Mạng Tháng 8', dien_tich + no_hau ghi kèm, câu phường vẫn treo",
    db().t.listing_facts.some((f) => f.question === "vi_tri" && f.answer === "hẻm 5m Cách Mạng Tháng 8") &&
      db().t.listing_facts.some((f) => f.question === "dien_tich" && f.answer === "4x14") &&
      db().t.listing_facts.some((f) => f.question === "no_hau") && pendPh(),
    JSON.stringify({ f: db().t.listing_facts, ir: db().t.info_requests.map((q) => [q.question, q.status]), rep: rp.body.replies }));
  // 15/09/2026 (bắn thật C4): "à mà nhà này cho thuê chứ ko bán, 25 triệu" khi đang hỏi
  // phường → đổi loại giao dịch (fact `loai_giao_dich`, trigger 20260915d lật deal), giá
  // 25 triệu vào tin THUÊ; không ghi "tiềm năng"; không bị hiểu là rút tin.
  fresh(seedWards); globalThis.__nominatim = undefined;
  await send({ external_user_id: "ph-7d", text: "bán nhà quận 10 4 tỷ" });
  rp = await send({ external_user_id: "ph-7d", text: "à mà nhà này cho thuê chứ ko bán, 25 triệu" });
  check("DEAL-01 'cho thuê chứ ko bán, 25 triệu' → deal cho_thue, giá 25 triệu, fact loai_giao_dich, KHÔNG tiem_nang, tin không bị ẩn",
    tin().deal === "cho_thue" && tin().price_vnd === 25e6 && db().t.listing_facts.some((f) => f.question === "loai_giao_dich" && f.answer === "cho_thue") &&
      !db().t.listing_facts.some((f) => f.question === "tiem_nang") && tin().status !== "an" && !rp.body.ngung_rao,
    JSON.stringify({ l: { deal: tin().deal, price_vnd: tin().price_vnd, status: tin().status }, f: db().t.listing_facts, rep: rp.body.replies }));
  fresh(seedWards); globalThis.__nominatim = LVV;
  rp = await send({ external_user_id: "ph-7", text: "bán nhà 50m2 4 tỷ" });
  rp = await send({ external_user_id: "ph-7", text: "hẻm 12 Lê Văn Việt" });
  rp = await send({ external_user_id: "ph-7", text: "ừ" });
  check("PH-08b 'ừ' → ward Phường Tăng Nhơn Phú, district Quận 9, câu phường answered",
    tin().ward === "Phường Tăng Nhơn Phú" && tin().district === "Quận 9" && !pendPh() && db().t.info_requests.some((x) => x.question === "phuong" && x.status === "answered"),
    JSON.stringify({ l: tin(), ir: db().t.info_requests.map((q) => [q.question, q.status]), rep: rp.body.replies }));
  // Trả lời địa chỉ mà Nominatim hỏng → vẫn ghi vi_tri, hỏi lại phường (không nuốt địa chỉ vào cột phường).
  fresh(seedWards); globalThis.__nominatim = undefined;
  await send({ external_user_id: "ph-8", text: "bán nhà 50m2 4 tỷ" });
  rp = await send({ external_user_id: "ph-8", text: "hẻm 12 Lê Văn Việt" });
  check("PH-09 trả lời địa chỉ, Nominatim hỏng → vi_tri ghi, ward vẫn trống, hỏi lại 'phường mấy, quận nào'",
    db().t.listing_facts.some((f) => f.question === "vi_tri") && !tin().ward && pendPh() && /phường mấy, quận nào/.test(rp.body.replies.join(" ")),
    JSON.stringify({ ward: tin().ward, ir: db().t.info_requests.map((q) => [q.question, q.status]), rep: rp.body.replies }));
}

// ── 15/09/2026: vừa trả lời vừa HỎI NGƯỢC; số nhà không phải diện tích (Zalo thật Ny'ah Phú Định) ──
{
  fresh();
  const prompt = (c) => c?.params?.messages?.[0]?.content ?? "";
  const fact = (q) => db().t.listing_facts.find((f) => f.question === q);
  const pend = (q) => db().t.info_requests.some((x) => x.question === q && x.status === "pending");
  const treoLai = (L, q) => { db().t.info_requests.forEach((x) => { if (x.listing_id === L.id) x.status = "expired"; }); db().insert("info_requests", { listing_id: L.id, question: q, status: "pending" }); };
  r = await send({ external_user_id: "hn-1", text: "bán nhà hẻm trần bình trọng p4 giá 5 tỷ 8 60m2" });
  const L = db().t.listings[0];
  treoLai(L, "ket_cau");
  r = await send({ external_user_id: "hn-1", text: "Nhà 5 tầng, có thang máy thì phải, bạn có biết xung quanh khu này có tiện ích gì không" });
  check("HN-1 vừa trả lời vừa hỏi ngược → kết cấu ghi 'Nhà 5 tầng' (không cả câu), thang máy ghi kèm, câu kết cấu đóng, body có hoi_nguoc",
    fact("ket_cau")?.answer === "Nhà 5 tầng" && !!fact("thang_may") && !pend("ket_cau") && r.body.hoi_nguoc === "bạn có biết xung quanh khu này có tiện ích gì không",
    JSON.stringify({ body: r.body, f: db().t.listing_facts, ir: db().t.info_requests }));
  check("HN-2 câu lệnh model: TRẢ LỜI câu hỏi ngược TRƯỚC, không bịa tiện ích",
    /HỎI NGƯỢC/.test(prompt(createCalls().at(-1))) && /KHÔNG bịa/.test(prompt(createCalls().at(-1))), prompt(createCalls().at(-1)));
  treoLai(L, "dien_tich_dat");
  r = await send({ external_user_id: "hn-1", text: "Căn số 14 ở ny’ah phú định" });
  check("HN-3 số nhà trả lời câu diện tích → KHÔNG ghi diện tích, ghi vi_tri, thôi câu diện tích (không hỏi lại)",
    !fact("dien_tich_dat") && db().t.listing_facts.some((f) => f.question === "vi_tri" && /Căn số 14/.test(f.answer)) && !pend("dien_tich_dat") && r.body.reask !== "dien_tich_dat",
    JSON.stringify({ body: r.body, f: db().t.listing_facts, ir: db().t.info_requests }));
  treoLai(L, "gap");
  r = await send({ external_user_id: "hn-1", text: "Được giá, căn tôi sở hữu nhưng chưa vào xem bạn có thông tin thêm về căn này không" });
  check("HN-4 gấp ghi 'Được giá' (không cả câu), câu hỏi ngược tách ra",
    fact("gap")?.answer === "Được giá" && /thông tin thêm/.test(r.body.hoi_nguoc ?? ""), JSON.stringify({ body: r.body, f: db().t.listing_facts }));
  // 15/09/2026 (bắn thật A5): cả tin là MỘT câu hỏi → không ghi "thông tin bổ sung", là hỏi ngược.
  treoLai(L, "tang");
  r = await send({ external_user_id: "hn-1", text: "bên bạn có cần mình gửi hình không hay sao" });
  check("HN-5 cả tin là câu hỏi → KHÔNG ghi bo_sung, body có hoi_nguoc = câu đó, thôi câu tầng (không hỏi lại)",
    !db().t.listing_facts.some((f) => f.question === "bo_sung") && r.body.hoi_nguoc === "bên bạn có cần mình gửi hình không hay sao" && !pend("tang"),
    JSON.stringify({ body: r.body, f: db().t.listing_facts, ir: db().t.info_requests }));
  // 15/09 (bắn thật E4): câu treo loại CÓ/KHÔNG (gấp) — chữ "không" trong câu hỏi không được thành đáp án.
  treoLai(L, "gap");
  r = await send({ external_user_id: "hn-1", text: "bên bạn có cần mình gửi hình không hay sao" });
  check("HN-6 câu hỏi trọn khi đang hỏi GẤP → không ghi ô gấp, là hỏi ngược",
    !db().t.listing_facts.some((f) => f.question === "gap" && /gửi hình/.test(f.answer)) && r.body.saved_fact !== "gap" &&
      r.body.hoi_nguoc === "bên bạn có cần mình gửi hình không hay sao" && /gửi ảnh thẳng vào đây/.test(r.body.replies[0] ?? ""),
    JSON.stringify({ body: r.body, f: db().t.listing_facts }));
}

// ── 16/09/2026 (Zalo thật, ảnh chụp chủ dự án): khách xưng CHÚ; người đã có tin nhắn câu rao SUÔNG; diện tích SÀN ──
{
  fresh();
  const S = () => db().t.sellers.find((s) => s.zalo_user_id === "chu-1");
  const EM = /(?<![\p{L}])em(?![\p{L}])/iu;
  const rep = () => r.body.replies.join(" ");
  r = await send({ external_user_id: "chu-1", text: "Chào cháu chú có căn nhà hẻm 5m Phú Định phường 16 quận 8 cần bán, 4x15, giá 6 tỷ" });
  check("CHU-1 tự xưng 'chú' → sellers.xung_ho = chú, gioi_tinh nam, nhom_tuoi lon_tuoi",
    S()?.xung_ho === "chú" && S()?.gioi_tinh === "nam" && S()?.nhom_tuoi === "lon_tuoi", JSON.stringify(S()));
  check("CHU-2 bot tự xưng 'cháu', không còn 'em' trong mọi bong bóng",
    r.body.replies.length > 0 && r.body.replies.every((x) => !EM.test(x)) && /cháu/.test(rep()), JSON.stringify(r.body.replies));
  r = await send({ external_user_id: "chu-1", text: "Chào cháu chú có căn nhà này cần giao bán" });
  check("CHU-3 người đã có tin nhắn câu rao SUÔNG → hỏi 'căn đó hay căn khác', KHÔNG ghi fact rác, không mở tin",
    /là căn đó hay căn khác/.test(rep()) && db().t.listings.length === 1 && !db().t.listing_facts.some((f) => /Chào cháu/.test(f.answer)) && !EM.test(rep()),
    JSON.stringify({ rep: r.body.replies, f: db().t.listing_facts }));
  r = await send({ external_user_id: "chu-1", text: "căn khác" });
  check("CHU-4 'căn khác' → xin địa chỉ, diện tích, giá của căn khác; vẫn 1 tin",
    /địa chỉ/.test(rep()) && /căn khác/.test(rep()) && db().t.listings.length === 1, JSON.stringify(r.body.replies));
  r = await send({ external_user_id: "chu-1", text: "Căn số 14 ở Ny'ah Phú Định, 80m2, giá 7 tỷ" });
  check("CHU-5 chi tiết căn mới (không chữ 'bán') → mở tin THỨ HAI có địa chỉ 'Căn số 14 ở Ny'ah Phú Định'; tin cũ giữ 6 tỷ",
    db().t.listings.length === 2 && /6 tỷ/.test(db().t.listings[0].price_raw ?? "") && /7 tỷ/.test(db().t.listings[1].price_raw ?? "") &&
      /Căn số 14/.test(db().t.listings[1].location_raw ?? ""),
    JSON.stringify(db().t.listings.map((l) => [l.code, l.price_raw, l.area_m2, l.location_raw])));
  r = await send({ external_user_id: "chu-1", text: "chú có căn nhà cần bán" });
  check("CHU-6 rao suông khi có 2 căn → liệt kê 2 căn, hỏi căn đó hay căn khác", /đang rao 2 căn/.test(rep()) && /là căn đó hay căn khác/.test(rep()), JSON.stringify(r.body.replies));
  r = await send({ external_user_id: "chu-1", text: "căn đó" });
  // Bắn thật sau deploy #145: câu trả lời có "cần bán gấp" + số đo KHÔNG phải rao suông.
  {
    const L1 = db().t.listings[0];
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: L1.id, question: "dien_tich_dat", status: "pending" });
    r = await send({ external_user_id: "chu-1", text: "ngang 5m còn dọc 16m cần bán gấp" });
    const fL1 = (q) => db().t.listing_facts.find((f) => f.listing_id === L1.id && f.question === q);
    check("CHU-7b 'ngang 5m còn dọc 16m cần bán gấp' khi đang hỏi đất → KHÔNG hỏi căn đó/căn khác; đất 'ngang 5m dài 16m', gấp 'cần bán gấp', mặt tiền 'ngang 5m dài 16m'",
      !/căn đó hay căn khác/.test(rep()) && fL1("dien_tich_dat")?.answer === "ngang 5m dài 16m" && fL1("gap")?.answer === "cần bán gấp" && fL1("mat_tien")?.answer === "ngang 5m dài 16m",
      JSON.stringify({ rep: r.body.replies, f: db().t.listing_facts.filter((f) => f.listing_id === L1.id) }));
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: L1.id, question: "gap", status: "pending" });
    r = await send({ external_user_id: "chu-1", text: "cần bán gấp" });
    check("CHU-7c 'cần bán gấp' trần khi đang hỏi gấp → là đáp án, không hỏi căn đó/căn khác",
      !/căn đó hay căn khác/.test(rep()) && r.body.saved_fact === "gap", JSON.stringify({ rep: r.body.replies, body: r.body }));
    // Zalo thật 13:36: "Hello" khi đang chờ ảnh → không ghi bổ sung; "cô có căn nhà này ở quận 5 cần
    // giao bán gấp" → hỏi căn đó/căn khác, KHÔNG đổi quận tin cũ.
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: L1.id, question: "hinh_anh", status: "pending" });
    // "Hello" trong e2e kích test_reset_hello (mock = 1, production = 0) nên dùng lời chào khác.
    r = await send({ external_user_id: "chu-1", text: "Alo em ơi" });
    check("CHU-7e lời chào suông 'Alo em ơi' khi đang chờ ảnh → không ghi bo_sung, không saved_fact",
      !db().t.listing_facts.some((f) => f.question === "bo_sung" && /alo/i.test(f.answer)) && !r.body.saved_fact, JSON.stringify({ body: r.body, f: db().t.listing_facts.filter((f) => f.question === "bo_sung") }));
    const quanTruoc = L1.district;
    r = await send({ external_user_id: "chu-1", text: "Chào cháu cô có căn nhà này ở quận 5 cần giao bán gấp" });
    check("CHU-7f 'cô có căn nhà này ở quận 5 cần giao bán gấp' → hỏi căn đó hay căn khác; quận tin cũ giữ nguyên; không ghi gấp",
      /căn đó hay căn khác/.test(rep()) && db().t.listings[0].district === quanTruoc && !db().t.listing_facts.some((f) => f.listing_id === L1.id && f.question === "gap" && f.answer === "bán gấp"),
      JSON.stringify({ rep: r.body.replies, d: db().t.listings[0].district, quanTruoc }));
    r = await send({ external_user_id: "chu-1", text: "chú có căn nhà cần bán gấp" });
    check("CHU-7d 'chú có căn nhà cần bán gấp' (không chi tiết) → vẫn hỏi căn đó hay căn khác", /căn đó hay căn khác/.test(rep()), JSON.stringify(r.body.replies));
  }
  r = await send({ external_user_id: "chu-1", text: "chú có căn nhà cần bán" });
  r = await send({ external_user_id: "chu-1", text: "căn đó" });
  check("CHU-7 'căn đó' → tiếp tục căn cũ, không mở tin, không ghi fact",
    db().t.listings.length === 2 && /tiếp tục với (căn|Căn số 14)/.test(rep()) && !db().t.listing_facts.some((f) => /^căn đó$/i.test(f.answer)), JSON.stringify(r.body.replies));
  // Diện tích SÀN của nhà nhiều tầng không phải diện tích đất; "nhà trong hẻm" không phải "nhà trống".
  fresh();
  r = await send({ external_user_id: "chu-2", text: "bán nhà phú định q8 giá 6 tỷ" });
  const L2 = db().t.listings[0];
  db().t.info_requests.forEach((x) => { if (x.listing_id === L2.id) x.status = "expired"; });
  db().insert("info_requests", { listing_id: L2.id, question: "dien_tich_dat", status: "pending" });
  r = await send({ external_user_id: "chu-2", text: "Nhà trong hẻm 2 xẹc nhưng hẻm rộng 5m nhà 4 tấm diện tích tổng 240m2" });
  const f2 = (q) => db().t.listing_facts.find((f) => f.question === q);
  check("CHU-8 'nhà trong hẻm… nhà 4 tấm diện tích tổng 240m2' → KHÔNG nội thất, KHÔNG diện tích đất; ghi hẻm 5m + 4 tấm + sàn 240m2, thôi câu diện tích đất (không hỏi lại)",
    !f2("noi_that") && !f2("dien_tich_dat") && !f2("dien_tich") && f2("do_rong_hem") && /4 tam|4 tấm/.test(f2("ket_cau")?.answer ?? "") && f2("dien_tich_san")?.answer === "240m2" &&
      !db().t.info_requests.some((x) => x.question === "dien_tich_dat" && x.status === "pending") && db().t.listings[0].area_m2 !== 240,
    JSON.stringify({ f: db().t.listing_facts, L: db().t.listings[0], ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  // Bắn thật sau deploy #144: câu treo là LOẠI BĐS → lời sửa FR-164 nuốt "diện tích tổng 240m2"
  // (area_m2 = 240, mất fact sàn), ô loại ghi nguyên câu.
  fresh();
  r = await send({ external_user_id: "chu-2b", text: "bán nhà phú định q8 giá 6 tỷ" });
  const L2b = db().t.listings[0];
  db().t.info_requests.forEach((x) => { if (x.listing_id === L2b.id) x.status = "expired"; });
  db().insert("info_requests", { listing_id: L2b.id, question: "loai_bds", status: "pending" });
  r = await send({ external_user_id: "chu-2b", text: "Nhà trong hẻm 2 xẹc nhưng hẻm rộng 5m nhà 4 tấm diện tích tổng 240m2" });
  const f2b = (q) => db().t.listing_facts.find((f) => f.question === q);
  check("CHU-8b câu đó khi đang hỏi LOẠI → không sửa diện tích, ô loại ghi tên loại (không nguyên câu), có sàn 240m2 + kết cấu '4 tấm' có dấu",
    !f2b("dien_tich") && db().t.listings[0].area_m2 !== 240 && f2b("dien_tich_san")?.answer === "240m2" && f2b("ket_cau")?.answer === "4 tấm" &&
      (!f2b("loai_bds") || f2b("loai_bds").answer.length < 30),
    JSON.stringify({ f: db().t.listing_facts, L: db().t.listings[0], rep: r.body.replies }));
  // 30/09/2026 (bắn thử vector v288, SRS-5.1f): đang hỏi PHƯỜNG, chủ nhà tả "nhà có 1 phòng ngủ ngay tầng trệt cho người già…" —
  // lời sửa FR-164 bắt "1 phòng ngủ" thành số phòng ngủ = 1 (nguồn seller_chat). Phòng ngủ theo tầng không phải lời sửa.
  fresh();
  r = await send({ external_user_id: "chu-pn-tang", text: "bán nhà hẻm xe hơi đường Trần Bình Trọng quận 5, 4x15, trệt 2 lầu sân thượng, giá 8 tỷ" });
  const Lpn = db().t.listings[0];
  db().t.info_requests.forEach((x) => { if (x.listing_id === Lpn.id) x.status = "expired"; });
  db().insert("info_requests", { listing_id: Lpn.id, question: "phuong", status: "pending" });
  r = await send({ external_user_id: "chu-pn-tang", text: "nhà có 1 phòng ngủ ngay tầng trệt cho người già, sau nhà có sân phơi rộng, đi bộ ra chợ 5 phút" });
  check("CHU-PN-TANG '1 phòng ngủ ngay tầng trệt' → KHÔNG ghi số phòng ngủ, không đáp xác nhận giá",
    !db().t.listing_facts.some((f) => f.listing_id === Lpn.id && f.question === "so_phong_ngu") && db().t.listings[0].bedrooms == null &&
      !/đang ghi giá/.test(r.body.replies.join("\n")),
    JSON.stringify({ f: db().t.listing_facts.filter((f) => f.listing_id === Lpn.id).map((f) => [f.question, f.answer]), rep: r.body.replies }));
  fresh();
  r = await send({ external_user_id: "chu-3", text: "bán nhà 4 tấm hẻm 5m phú định q8 diện tích tổng 240m2 giá 6 tỷ" });
  check("CHU-9 câu rao 'nhà 4 tấm diện tích tổng 240m2' → area_m2 trống, fact dien_tich_san 240m2",
    db().t.listings[0]?.area_m2 == null && db().t.listing_facts.some((f) => f.question === "dien_tich_san" && f.answer === "240m2"),
    JSON.stringify({ L: db().t.listings[0], f: db().t.listing_facts }));

  // 17/09/2026 (Zalo thật 16:42): đang hỏi PHƯỜNG căn "hẻm 4m Nguyễn Trãi" mà chủ nhà nhắn rao căn ở
  // ĐƯỜNG KHÁC kèm chi tiết → bản trước ghi nguyên câu làm vị trí tin cũ (street = "Chào cháu").
  fresh();
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "thay_doi" };
  r = await send({ external_user_id: "chu-4", text: "Chào cháu, chú có căn nhà hẻm 4m Nguyễn Trãi quận 5, 60m2, giá 6 tỷ 5" });
  const L4 = db().t.listings[0];
  const blChu4 = r.body.replies.find((x) => x.startsWith("🤖")) ?? "";
  check("BLDL-12 lượt mở hồ sơ + xưng 'chú' → 🤖 kèm dòng '👤 Hồ sơ: Zalo \"…\" · cách gọi: \"chú\"' (Zalo che còn 4 ký tự cuối)",
    /^🤖 Bóc tách được: /.test(blChu4) && /\n👤 Hồ sơ: Zalo: "…hu-4" · cách gọi: "chú"/.test(blChu4) && !/chu-4"/.test(blChu4), blChu4);
  check("PH-08 câu hỏi đầu là phường, tin đã có địa chỉ + quận → hỏi ngắn nhắc địa chỉ: 'Hẻm 4m Nguyễn Trãi đó phường mấy chú nhỉ?'",
    globalThis.__calls.some((c) => { const j = JSON.stringify(c.params ?? c); return /CẦN HỎI: [^\\n]*phường/.test(j) && /Nguyễn Trãi/i.test(j); }) && db().t.info_requests.some((x) => x.listing_id === L4.id && x.question === "phuong" && x.status === "pending"),
    JSON.stringify({ ir: db().t.info_requests.map((q) => [q.question, q.status]), calls: globalThis.__calls.map((c) => JSON.stringify(c.params ?? c).slice(0, 300)) }));
  r = await send({ external_user_id: "chu-4", text: "Chào cháu, cô có căn nhà hẻm 4m Trần Hưng Đạo quận 5, 50m2, giá 5 tỷ 8, mặt nhà quay về phía Đông, nhà mới sơn sửa lại" });
  const L4b = db().t.listings.find((l) => l.id !== L4.id);
  check("CHU-10 đang hỏi phường căn Nguyễn Trãi, rao căn hẻm 4m TRẦN HƯNG ĐẠO có chi tiết → tin MỚI (địa chỉ 'hẻm 4m Trần Hưng Đạo', 50m2, 5 tỷ 8); tin cũ giữ nguyên",
    db().t.listings.length === 2 && L4b?.location_raw === "hẻm 4m Trần Hưng Đạo" && L4b?.area_m2 === 50 && L4b?.price_vnd === 5.8e9 &&
      db().t.listings.find((l) => l.id === L4.id)?.location_raw === "hẻm 4m Nguyễn Trãi" && db().t.listings.find((l) => l.id === L4.id)?.price_vnd === 6.5e9 &&
      !db().t.listing_facts.some((f) => /^Chào cháu/.test(f.answer ?? "")),
    JSON.stringify({ L: db().t.listings, f: db().t.listing_facts, rep: r.body.replies }));
  check("CHU-10b đổi 'chú' → 'cô' cùng lượt: 🤖 nêu cách gọi mới, không nêu Zalo (hồ sơ đã mở từ trước)",
    (r.body.replies.find((x) => x.startsWith("🤖")) ?? "").includes('👤 Hồ sơ: cách gọi: "cô"') && !/Zalo/.test(r.body.replies.find((x) => x.startsWith("🤖")) ?? ""),
    JSON.stringify(r.body.replies));
  globalThis.__cauHinh = undefined;
}

// ── 18/09/2026: "tắt cái mỗi câu trả lời đều khen đi, lâu lâu thì khen thôi"; bỏ tin 🆕 cho admin ──
{
  fresh();
  const macDinhCreate = globalThis.__model?.create;
  r = await send({ external_user_id: "khen-1", text: "bán nhà hẻm 4m Nguyễn Trãi quận 5, 60m2, giá 6 tỷ 5" });
  check("ADMIN-01 mở hồ sơ từ chat → KHÔNG còn tin 🆕 'Hồ sơ người bán MỞ TỪ CHAT' trong hàng escalation",
    !db().t.reminders.some((x) => /🆕 Hồ sơ người bán/.test(x.note ?? "")), JSON.stringify(db().t.reminders.map((x) => x.note)));
  const conv = db().t.conversations.find((c) => c.seller_id === db().t.sellers[0].id) ?? db().t.conversations[0];
  // Hai tin bot gần nhất có câu khen → lượt kế phải dặn KHÔNG khen và lọc câu khen lọt.
  db().insert("messages", { conversation_id: conv.id, sender: "bot", body: "Hẻm xe hơi 4m là khách chuộng lắm anh. Nhà mình phường mấy anh nhỉ?" });
  db().insert("messages", { conversation_id: conv.id, sender: "bot", body: "Sổ hồng riêng là chốt nhanh lắm. Nhà mấy tầng anh?" });
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: db().t.listings[0].id, question: "ket_cau", status: "pending" });
  globalThis.__model.create = () => "Dạ nhà 3 lầu, sổ riêng là khách chốt nhanh lắm anh. Tổng cộng bao nhiêu phòng ngủ anh?";
  r = await send({ external_user_id: "khen-1", text: "trệt 2 lầu" });
  const cauBot = r.body.replies.find((x) => !x.startsWith("🤖") && !x.startsWith("🤖")) ?? "";
  check("KHEN-01 3 tin bot gần nhất đã khen → prompt dặn 'KHÔNG khen'; câu khen model lọt bị lọc, câu hỏi giữ",
    globalThis.__calls.some((c) => JSON.stringify(c.params ?? c).includes("không khen (mấy tin gần đây em khen rồi)")) &&
      // FR-241 l: sau kết cấu code chọn câu PHÁP LÝ → câu hỏi model (phòng ngủ) thay bằng câu mẫu sổ; câu hỏi vẫn còn.
      !/chốt nhanh/.test(cauBot) && /(bao nhiêu phòng ngủ|[Ss]ổ hồng)/.test(cauBot),
    JSON.stringify({ rep: r.body.replies }));
  // 25/09/2026 (bắn thật lx-09): code chọn câu kế mà model hỏi chuyện KHÁC (hẻm) → câu hỏi thay bằng câu mẫu của khoá.
  {
    fresh();
    await send({ external_user_id: "lk-1", text: "bán nhà hẻm 4m Nguyễn Trãi quận 5, 60m2, giá 6 tỷ 5" });
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: db().t.listings[0].id, question: "ket_cau", status: "pending" });
    globalThis.__model.create = () => "Dạ vâng ạ. Hẻm nhà mình rộng mấy mét, ô tô vào được không anh chị?";
    const rLk = await send({ external_user_id: "lk-1", text: "trệt 2 lầu" });
    const keLk = db().t.info_requests.find((x) => x.status === "pending")?.question;
    const cauLk = rLk.body.replies.filter((x) => !/^(?:🤖|💾|📝)/u.test(x)).join(" ");
    check("LK-E1 ô chờ là khoá khác hẻm mà model hỏi hẻm → câu hỏi đổi về đúng khoá, không còn câu hẻm",
      keLk && keLk !== "do_rong_hem" && !/Hẻm nhà mình rộng/.test(cauLk) && /\?/.test(cauLk), JSON.stringify({ keLk, rep: rLk.body.replies }));
    // lx-08: tin vừa tạo còn chờ mà model nói "đã đăng lên web rồi" → bỏ.
    fresh();
    globalThis.__model.create = () => "Em cảm ơn mình tin nhé, đã đăng lên web AI Ơi Nhà Đất rồi :) Nhà mình xây mấy tầng vậy anh chị?";
    const rDd = await send({ external_user_id: "dd-1", text: "bán nhà hẻm 4m Nguyễn Trãi phường 2 quận 5, 60m2, giá 6 tỷ 5" });
    const cauDd = rDd.body.replies.filter((x) => !/^(?:🤖|💾|📝)/u.test(x)).join(" ");
    check("DD-E1 tin rao vừa tạo (chờ) → bỏ câu 'đã đăng lên web', giữ lời cảm ơn",
      !/đã đăng/.test(cauDd) && /cảm ơn/.test(cauDd), JSON.stringify(rDd.body.replies));
    globalThis.__model.create = macDinhCreate;
  }
  // Không khen gần đây → được phép khen một câu (không lọc).
  fresh();
  r = await send({ external_user_id: "khen-2", text: "bán nhà hẻm 4m Nguyễn Trãi quận 5, 60m2, giá 6 tỷ 5" });
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: db().t.listings[0].id, question: "ket_cau", status: "pending" });
  globalThis.__calls.length = 0;
  // FR-240 a: câu mẫu cũ "khách chốt nhanh lắm" là đoán thanh khoản (nay bị bỏ ở mọi lượt) — ca này đo KHEN ĐẶC ĐIỂM căn.
  globalThis.__model.create = () => "Dạ trệt 2 lầu vậy là rộng rãi lắm anh. Tổng cộng bao nhiêu phòng ngủ anh?";
  r = await send({ external_user_id: "khen-2", text: "trệt 2 lầu" });
  const cauBot2 = r.body.replies.find((x) => !x.startsWith("🤖") && !x.startsWith("🤖")) ?? "";
  check("KHEN-02 chưa khen gần đây → prompt cho phép MỘT câu khi đáng, không lọc câu model",
    !globalThis.__calls.some((c) => JSON.stringify(c.params ?? c).includes("không khen (mấy tin gần đây em khen rồi)")) && /rộng rãi/.test(cauBot2),
    JSON.stringify({ rep: r.body.replies }));
  globalThis.__model.create = macDinhCreate;
  // FR-240 a (phát lại test 28/09 trên production): mỗi lượt bot gửi 🤖 + lời đáp; 🤖 rỗng sau boBaoLai nên "3 tin gần nhất" chỉ
  // còn hơn một lượt — khen lượt 3 rồi khen lại lượt 6. Câu khen cách 2 lời đáp (4 tin kể cả 🤖) vẫn tính là "vừa khen".
  fresh();
  r = await send({ external_user_id: "khen-3", text: "bán nhà hẻm 4m Nguyễn Trãi quận 5, 60m2, giá 6 tỷ 5" });
  {
    const conv3 = db().t.conversations.find((c) => c.seller_id === db().t.sellers[0].id) ?? db().t.conversations[0];
    db().insert("messages", { conversation_id: conv3.id, sender: "bot", body: "Hẻm 4m là rộng rãi lắm anh. Nhà mình phường mấy anh nhỉ?" });
    db().insert("messages", { conversation_id: conv3.id, sender: "bot", body: "🤖 Bóc tách được: phường: \"Phường 2\"" });
    db().insert("messages", { conversation_id: conv3.id, sender: "bot", body: "Sổ hồng riêng hay sổ chung anh?" });
    db().insert("messages", { conversation_id: conv3.id, sender: "bot", body: "🤖 Bóc tách được: pháp lý: \"sổ hồng riêng\"" });
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: db().t.listings[0].id, question: "ket_cau", status: "pending" });
    globalThis.__calls.length = 0;
    globalThis.__model.create = () => "Dạ trệt 2 lầu vậy là rộng rãi lắm anh. Tổng cộng bao nhiêu phòng ngủ anh?";
    r = await send({ external_user_id: "khen-3", text: "trệt 2 lầu" });
    const cauBot3 = r.body.replies.find((x) => !x.startsWith("🤖")) ?? "";
    check("KHEN-03 khen cách 2 lời đáp (xen 🤖) → vẫn là 'vừa khen': prompt dặn KHÔNG khen, câu khen lọt bị lọc, câu hỏi giữ",
      globalThis.__calls.some((c) => JSON.stringify(c.params ?? c).includes("không khen (mấy tin gần đây em khen rồi)")) && !/rộng rãi/.test(cauBot3) && /(phòng ngủ|[Ss]ổ hồng)/.test(cauBot3),
      JSON.stringify({ rep: r.body.replies }));
    globalThis.__model.create = macDinhCreate;
  }
}

// ── FR-211 (18/09/2026): NHÃN TÌM KIẾM — gắn từ câu rao / câu trả lời, lọc ở bot mua ──
{
  fresh();
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "thay_doi" };
  r = await send({ external_user_id: "nhan-1", text: "bán nhà hẻm 4m Nguyễn Trãi quận 5, 60m2, giá 6 tỷ 5, khu yên tĩnh, gần chợ" });
  const LN = db().t.listings[0];
  // 23/09/2026 (FR-215): 🤖 in nhãn từ cột `listings.nhan` ("nhãn: …", đủ mọi lượt), không in fact "nhãn tìm kiếm" lượt lẻ.
  check("NHAN-01 câu rao có 'khu yên tĩnh, gần chợ' → listings.nhan = [yen_tinh, gan_cho]; fact nhan; 🤖 báo 'nhãn: yên tĩnh · gần chợ'",
    JSON.stringify(LN.nhan) === JSON.stringify(["yen_tinh", "gan_cho"]) &&
      db().t.listing_facts.some((f) => f.listing_id === LN.id && f.question === "nhan" && f.answer === "yên tĩnh · gần chợ") &&
      r.body.replies.some((x) => x.startsWith("🤖") && /nhãn: "yên tĩnh · gần chợ"/.test(x)),
    JSON.stringify({ nhan: LN.nhan, rep: r.body.replies }));
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: LN.id, question: "ket_cau", status: "pending" });
  r = await send({ external_user_id: "nhan-1", text: "trệt 2 lầu, xe hơi vào tận nhà, gần chợ luôn" });
  check("NHAN-02 câu trả lời thêm 'xe hơi vào tận nhà' → thêm nhãn mới, 'gần chợ' không trùng; fact nhan chỉ ghi nhãn MỚI",
    JSON.stringify(LN.nhan) === JSON.stringify(["yen_tinh", "gan_cho", "xe_hoi_vao_nha"]) &&
      db().t.listing_facts.filter((f) => f.listing_id === LN.id && f.question === "nhan").at(-1)?.answer === "xe hơi vào nhà",
    JSON.stringify({ nhan: LN.nhan, f: db().t.listing_facts.filter((f) => f.question === "nhan") }));
  r = await send({ external_user_id: "nhan-1", text: "3 phòng ngủ" });
  check("NHAN-03 câu không có ý nhãn → không ghi thêm fact nhan", db().t.listing_facts.filter((f) => f.listing_id === LN.id && f.question === "nhan").length === 2);
  globalThis.__cauHinh = undefined;

  // Khách MUA: nhãn vào hồ sơ và lọc kho bằng contains.
  fresh(seedKho);
  r = await send({ external_user_id: "nhan-mua", text: "tìm nhà quận 5 tầm 6 tỷ, khu yên tĩnh" });
  const hsN = db().t.buyers.find((b) => b.zalo_user_id === "nhan-mua")?.preferences ?? {};
  check("NHAN-04 khách mua nói 'khu yên tĩnh' → preferences.nhan = [yen_tinh]", JSON.stringify(hsN.nhan) === JSON.stringify(["yen_tinh"]), JSON.stringify(hsN));
}

// ── TS-VAN-10 (20/09/2026): 10 lỗi thấy ở lượt bắn 4 kịch bản mới — vá cùng ngày ──
{
  const fPend = (q) => db().t.info_requests.some((x) => x.question === q && x.status === "pending");
  const facts = (lid, q) => db().t.listing_facts.filter((f) => f.listing_id === lid && (!q || f.question === q));
  // L10: câu rao mở đầu bằng lời chào → chỉ MỘT lần ghi nhận (🤖), không còn "📝 Em ghi nhận" trong bong bóng chào.
  fresh();
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "thay_doi" };
  r = await send({ external_user_id: "va10-b", text: "Chào em, chị có mảnh nhà đất ở Gò Vấp, đất 60 mét vuông xây 3 tầng, ngõ 3 mét, sổ đỏ chính chủ, 5 tỉ 2, ngõ thông không ngập" });
  const LB = db().t.listings[0];
  check("VA10-01 lượt đầu có 🤖 → không còn dòng '📝 Em ghi nhận' ở bong bóng nào; nhãn hem_thong + khong_ngap",
    r.body.replies.filter((x) => x.startsWith("🤖")).length === 1 &&
      !r.body.replies.some((x) => x.split("\n").some((d) => d.startsWith("📝 Em ghi nhận"))) &&
      LB?.nhan?.includes("hem_thong") && LB?.nhan?.includes("khong_ngap"),
    JSON.stringify({ rep: r.body.replies, nhan: LB?.nhan }));
  // L9: hoãn kèm lời hứa khi câu treo là câu MỀM (gấp) → đáp một câu, không hỏi tiếp, câu vẫn treo, nhắc hứa có.
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: LB.id, question: "gap", status: "pending" });
  r = await send({ external_user_id: "va10-b", text: "tối chị chụp ảnh gửi nhé, giờ đang bận" });
  check("VA10-02 'tối chụp ảnh gửi, giờ đang bận' → hoãn (một câu 'em chờ'), câu gấp vẫn treo, nhắc promise",
    r.body.hoan === true && r.body.replies.filter((x) => !x.startsWith("🤖")).length === 1 && /em chờ/i.test(r.body.replies.filter((x) => !x.startsWith("🤖"))[0] ?? "") && fPend("gap") &&
      db().t.reminders.some((x) => x.kind === "promise" && x.status === "pending"),
    JSON.stringify({ body: r.body, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  // L3: lời sửa phường kèm địa chỉ → vị trí sạch tiểu từ.
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: LB.id, question: "vi_tri", status: "pending" });
  r = await send({ external_user_id: "va10-b", text: "phường 17 nhé, đường Phan Văn Trị" });
  check("VA10-03 'phường 17 nhé, đường Phan Văn Trị' → phường 17 + vị trí 'đường Phan Văn Trị' (không 'nhé,')",
    facts(LB.id, "phuong").some((f) => f.answer === "Phường 17") && facts(LB.id, "vi_tri").some((f) => f.answer === "đường Phan Văn Trị") &&
      !facts(LB.id).some((f) => /^nhé/i.test(f.answer)),
    JSON.stringify(facts(LB.id)));
  globalThis.__cauHinh = undefined;

  // L1: giá theo m² + "ngang 4 dài 15" → giá cả căn; giá chưa đọc ra số → KHÔNG gửi nháp, mở lại câu giá.
  fresh();
  r = await send({ external_user_id: "va10-d", text: "bán nhà mặt tiền đường Nguyễn Chí Thanh quận 5, ngang 4 dài 15, giá 250 triệu/m2 thương lượng" });
  const LD = db().t.listings[0];
  check("VA10-04 'ngang 4 dài 15, giá 250 triệu/m2' → price_raw = 15 tỷ (250 triệu × 60m²)", LD?.price_raw === "15 tỷ", JSON.stringify({ price_raw: LD?.price_raw, rep: r.body.replies }));
  LD.price_raw = "250 triệu/m2 thương lượng"; LD.price_vnd = null;
  db().t.listing_facts.push({ id: "f-va10-1", listing_id: LD.id, question: "phap_ly", answer: "sổ hồng riêng", source: "seller_chat", created_at: new Date().toISOString() });
  LD.legal_status = "so_hong_rieng"; LD.ward = "Phường 9"; LD.area_m2 = 60; LD.bedrooms = 5;
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: LD.id, question: "ket_cau", status: "pending" });
  r = await send({ external_user_id: "va10-d", text: "ok đăng đi" });
  check("VA10-05 chủ muốn đăng mà giá chưa đọc ra số → KHÔNG gửi bản nháp, nói thiếu 'giá cả căn bằng con số'",
    r.body.ban_nhap !== true && r.body.chu_muon_dang === true && /giá cả căn bằng con số/.test(r.body.replies.join(" ")) && fPend("ket_cau"),
    JSON.stringify({ body: r.body, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  // L2: lời sửa kích thước → ô ngang/dài (mat_tien), không vào bổ sung.
  r = await send({ external_user_id: "va10-d", text: "à sửa lại, dài 16 chứ không phải 15" });
  check("VA10-06 'à sửa lại, dài 16 chứ không phải 15' → fact mat_tien 'ngang 4m dài 16m', không có bo_sung mang câu sửa",
    facts(LD.id, "mat_tien").some((f) => f.answer === "ngang 4m dài 16m") && !facts(LD.id, "bo_sung").some((f) => /sửa lại/i.test(f.answer)),
    JSON.stringify({ body: r.body, f: facts(LD.id).map((f) => [f.question, f.answer]), ir: db().t.info_requests.map((q) => [q.question, q.status]) }));

  // L4 + L5 + L6: môi giới gõ KHÔNG DẤU, 2 căn một tin, quận nói chung, hỏi phí, fact theo căn.
  fresh();
  r = await send({ external_user_id: "va10-a", text: "e la moi gioi ben q10, co 2 can can ban: can 1 nha hem 6m Ba Hat 4x14 1 tret 2 lau 7 ty 9, can 2 dat 5x20 duong Ly Thai To 12 ty. lien he e 0912345678 zalo" });
  const A = db().t.listings.slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  check("VA10-07 'ben q10' → cả 2 tin Quận 10; mảnh 'dat 5x20' không dấu → đất",
    A.length === 2 && A.every((l) => l.district === "Quận 10") && A[1].property_type === "dat",
    JSON.stringify(A.map((l) => [l.code, l.district, l.property_type])));
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: A[0].id, question: "so_phong_ngu", status: "pending" });
  r = await send({ external_user_id: "va10-a", text: "phi ben minh sao, co bat ky doc quyen ko" });
  check("VA10-08 hỏi phí KHÔNG DẤU → là câu hỏi ngược: trả lời phí (0,5% môi giới), không ghi bổ sung",
    !!r.body.hoi_nguoc && /0,5%/.test(r.body.replies.join(" ")) && !db().t.listing_facts.some((f) => f.question === "bo_sung" && /doc quyen/.test(f.answer)),
    JSON.stringify({ body: r.body, f: db().t.listing_facts.filter((f) => f.question === "bo_sung") }));
  A.forEach((l) => { l.district = null; });
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: A[1].id, question: "loai_bds", status: "pending" });
  r = await send({ external_user_id: "va10-a", text: "ca 2 can deu quan 10 nhe" });
  check("VA10-09 'ca 2 can deu quan 10' khi đang hỏi loại → ghi Quận 10 cho CẢ 2 căn, báo rồi hỏi lại loại",
    A.every((l) => l.district === "Quận 10") && /Quận 10 cho 2 căn/.test(r.body.replies.join(" ")) && fPend("loai_bds"),
    JSON.stringify({ rep: r.body.replies, q: A.map((l) => l.district) }));
  r = await send({ external_user_id: "va10-a", text: "can 1 so hong rieng hoan cong du, can 2 tho cu 100% 2 mat tien" });
  check("VA10-10 fact theo căn: nhãn 'đã hoàn công' chỉ ở căn 1, 'thổ cư 100%' + 'căn góc' chỉ ở căn 2; MỘT 🤖 nói rõ từng căn",
    A[0].nhan?.includes("nha_hoan_cong") && !A[1].nhan?.includes("nha_hoan_cong") &&
      A[1].nhan?.includes("tho_cu_100") && A[1].nhan?.includes("can_goc") && !A[0].nhan?.includes("tho_cu_100") &&
      r.body.replies.filter((x) => x.startsWith("🤖")).length === 1 && /căn 1/.test(r.body.replies[0]) && /căn 2/.test(r.body.replies[0]),
    JSON.stringify({ n1: A[0].nhan, n2: A[1].nhan, rep: r.body.replies }));

  // L7 + L8: khách MUA — "gần chợ xe hơi vào" không thành mốc "chợ chợ xe hơi"; kho trống nói thẳng; xin số chủ nhà.
  fresh();
  const GANC = () => ({ muon_gan: true, loai: "cho", ten: "chợ xe hơi", cap_truong: null, ban_kinh_m: 600, bo_dieu_kien: false });
  globalThis.__model.parse = (p) => laLuotGan(p) ? GANC() : OUT({ profile: { ...OUT().profile, deal: "ban", area: "Quận 5", budget: "tầm 7 tỷ", bedrooms: 3 }, replies: ["Em kiểm tra kho rồi báo mình liền ạ."] });
  r = await send({ external_user_id: "va10-c", text: "mình cần mua nhà Q5 khu yên tĩnh gần chợ xe hơi vào được nhà, tầm 7 tỉ, 3 phòng ngủ" });
  const hsC = () => db().t.buyers.find((b) => b.zalo_user_id === "va10-c")?.preferences ?? {};
  check("VA10-11 model trả tên mốc 'chợ xe hơi' → hồ sơ ghi 'chợ, trong ~600 m' (không 'chợ chợ xe hơi'); nhãn có gan_cho + xe_hoi_vao_nha",
    hsC().gan_tien_ich === "chợ, trong ~600 m" && (hsC().nhan ?? []).includes("gan_cho") && (hsC().nhan ?? []).includes("xe_hoi_vao_nha"),
    JSON.stringify(hsC()));
  globalThis.__model.parse = (p) => laLuotGan(p) ? GANC() : OUT({ replies: ["Dạ mình để em kiểm tra hẻm 4m Nguyễn Trãi rồi báo liền ạ."] });
  r = await send({ external_user_id: "va10-c", text: "có căn nào hẻm 4m Nguyễn Trãi không" });
  check("VA10-12 kho trống, khách hỏi căn cụ thể → nói thẳng 'chưa có căn nào khớp', không 'để em kiểm tra rồi báo'",
    /chưa có căn nào khớp/.test(r.body.replies.join(" ")) && !/kiểm tra .*rồi báo/.test(r.body.replies.join(" ")),
    JSON.stringify(r.body.replies));
  globalThis.__model.parse = (p) => laLuotGan(p) ? GANC() : OUT({ replies: ["Dạ em ghi nhận rồi ạ."] });
  r = await send({ external_user_id: "va10-c", text: "cho mình xin số chủ nhà đi" });
  check("VA10-13 xin số chủ nhà → nói rõ không gửi số qua chat, người phụ trách dẫn đi xem",
    /không gửi số chủ nhà/.test(r.body.replies[0] ?? "") && /phụ trách/.test(r.body.replies[0] ?? ""),
    JSON.stringify(r.body.replies));
  globalThis.__model = { parse: () => OUT() };
}

// ── 22/09/2026: VÁ THEO BỘ ĐO GIỌNG (TS-GIONG-02, mười lỗi) ─────────────────────
{
  const cauHinhCu = globalThis.__cauHinh;
  const rep = () => r.body.replies.join(" ");
  // Hai hàm này ở các khối trên là `const` trong khối → không thấy ở đây (GVA-08 từng chạy với mock AI ném
  // ReferenceError → luật đỡ, xanh "oan"). Khai lại tại chỗ.
  const laLuotBocRao = (p) => (p?.system ?? []).some((s) => /BÓC TÁCH TIN NHẮN NGƯỜI BÁN/.test(s.text ?? ""));
  const pend = (q, lid) => db().t.info_requests.some((x) => x.question === q && x.status === "pending" && (!lid || x.listing_id === lid));
  const buyerBiet = (d, uid) => { const b = d.insert("buyers", { zalo_user_id: uid, name: null, preferences: { deal: "mua", area: "Quận 5", budget: "tầm 6 tỷ" } }).data; d.insert("conversations", { buyer_id: b.id, channel: "zalo_personal_test", started_at: "2026-09-01T00:00:00Z" }); };
  // (7) M04: khách MUA có hồ sơ hỏi "còn bán không" → KHÔNG mở hồ sơ bán, không tạo tin.
  fresh((d) => { seedKho(d); buyerBiet(d, "gva-1"); });
  let soTin = db().t.listings.length, soSeller = db().t.sellers.length;
  r = await send({ external_user_id: "gva-1", text: "căn 12 Trần Hưng Đạo phường 4 còn bán không" });
  check("GVA-01 khách mua có hồ sơ hỏi 'căn … phường 4 còn bán không' → vẫn hàng MUA, không mở hồ sơ bán, không tạo tin",
    r.body.role !== "seller" && db().t.listings.length === soTin && db().t.sellers.length === soSeller && !/nhà phố hay chung cư/.test(rep()),
    JSON.stringify({ role: r.body.role, rep: r.body.replies }));
  // (6) M03: câu BOT tự nói "liên hệ qua Zalo" không bị che; ID/SĐT model lỡ chép vẫn che.
  fresh((d) => { seedKho(d); buyerBiet(d, "gva-2"); });
  globalThis.__model.parse = () => OUT({ replies: ["Có căn hợp, anh chị phụ trách bên em sẽ liên hệ qua Zalo với mình ạ.", "Chủ căn đó zalo: 0903123456 nha."] });
  r = await send({ external_user_id: "gva-2", text: "vậy làm sao mình xem nhà được" });
  check("GVA-02 bong bóng bot 'liên hệ qua Zalo' giữ nguyên chữ; 'zalo: 0903…' vẫn bị che",
    /liên hệ qua Zalo với mình/.test(rep()) && !/\[liên hệ qua \[/.test(rep()) && !/0903/.test(rep()) && /\[liên hệ qua Zalo\]/.test(rep()),
    JSON.stringify(r.body.replies));
  // (1) B08: "em là người hay máy" → câu tiền định + model chép lại → chỉ MỘT lần "trợ lý AI".
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
    const tin = db().t.listings.find((l) => l.seller_id === sC.id && l.status === "dang_ban");
    db().insert("info_requests", { listing_id: tin.id, question: "phap_ly", status: "pending" });
    globalThis.__model.create = () => "Em là trợ lý AI bên AI Ơi Nhà Đất, việc gì cần người thật thì có anh chị phụ trách khu vực theo sát chị ạ. Sổ hồng nhà mình riêng chưa chị?";
    r = await send({ external_user_id: "z-ccrb", text: "mà em là người hay máy vậy?" });
    check("GVA-03 hỏi 'người hay máy' → nói thật 'trợ lý AI' đúng MỘT lần (model chép lại câu tiền định bị bỏ), câu hỏi sổ vẫn còn",
      // 01/10 (chủ dự án: "pháp lý … từng ý thôi"): câu sổ một ý, không gộp đứng tên / thế chấp.
      (rep().match(/trợ lý AI/g) ?? []).length === 1 && /Sổ hồng nhà mình/.test(rep()) && !/đứng tên|thế chấp/.test(rep()),
      JSON.stringify(r.body.replies));
    globalThis.__model.create = undefined;
  }
  // (3) B13: "bán rồi" khi CHƯA có khách quan tâm → không nói "báo các khách đang chờ"; có `interests` thì nói.
  fresh(seedKho);
  r = await send({ external_user_id: "z-nmg", text: "bán rồi em, cảm ơn em nha" });
  check("GVA-04 'bán rồi' mà interests trống → chúc mừng + gỡ tin, KHÔNG 'báo các khách đang chờ'",
    r.body.ngung_rao === "ban_roi" && /gỡ tin khỏi kệ\./.test(rep()) && !/báo các khách/.test(rep()), JSON.stringify(r.body.replies));
  fresh((d) => { seedKho(d); const sN = d.t.sellers.find((x) => x.zalo_user_id === "z-nmg"); const tin = d.t.listings.find((l) => l.seller_id === sN.id); const b = d.insert("buyers", { zalo_user_id: "gva-4b", preferences: {} }).data; d.insert("interests", { buyer_id: b.id, listing_id: tin.id }); });
  r = await send({ external_user_id: "z-nmg", text: "bán rồi em, cảm ơn em nha" });
  check("GVA-04b 'bán rồi' mà có 1 khách quan tâm → 'gỡ tin khỏi kệ và báo các khách đang chờ'",
    r.body.ngung_rao === "ban_roi" && /gỡ tin khỏi kệ và báo các khách đang chờ/.test(rep()), JSON.stringify(r.body.replies));
  // (2) B11: hai căn một tin — giá không nuốt "60m2" thành "5 tỷ 60"; hẻm / mặt tiền ghi riêng từng căn.
  fresh();
  r = await send({ external_user_id: "gva-5", text: "bên anh có 2 căn: căn 1 hẻm 4m Nguyễn Trãi p3 q5 5 tỷ 60m2, căn 2 mặt tiền Hồng Bàng p12 q5 12 tỷ 80m2" });
  {
    const LL = db().t.listings;
    const f = (lid, q) => db().t.listing_facts.find((x) => x.listing_id === lid && x.question === q)?.answer;
    const c1 = LL.find((l) => /Nguyễn Trãi/.test(l.location_raw ?? "") || f(l.id, "vi_tri")?.includes("Nguyễn Trãi"));
    const c2 = LL.find((l) => /Hồng Bàng/.test(l.location_raw ?? "") || f(l.id, "vi_tri")?.includes("Hồng Bàng"));
    check("GVA-05 'căn 1 hẻm 4m … 5 tỷ 60m2, căn 2 mặt tiền … 12 tỷ 80m2' → giá '5 tỷ' / '12 tỷ' (không '5 tỷ 60'), 60/80 m², hẻm 4m và mặt tiền ghi riêng từng căn",
      LL.length === 2 && !!c1 && !!c2 && c1.price_raw === "5 tỷ" && c2.price_raw === "12 tỷ" && c1.area_m2 === 60 && c2.area_m2 === 80 &&
        f(c1.id, "do_rong_hem") === "hẻm 4m" && f(c2.id, "do_rong_hem") === "mặt tiền",
      JSON.stringify({ LL: LL.map((l) => [l.location_raw, l.price_raw, l.area_m2]), facts: db().t.listing_facts.map((x) => [x.question, x.answer]), rep: r.body.replies }));
  }
  // (10) B04: sửa giá lúc 🤖 bật → vẫn có lời xác nhận ngắn "Dạ em sửa lại giá … rồi ạ" bên cạnh 🤖.
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "thay_doi" };
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
    const tin = db().t.listings.find((l) => l.seller_id === sC.id && l.status === "dang_ban");
    sC.active_listing_id = tin.id;
    db().insert("info_requests", { listing_id: tin.id, question: "ket_cau", status: "pending" });
    r = await send({ external_user_id: "z-ccrb", text: "à nhầm, giá 7 tỷ 5 nha em" });
    check("GVA-06 'à nhầm, giá 7 tỷ 5' khi 🤖 bật → có 🤖 VÀ lời xác nhận 'Dạ em sửa lại giá 7 tỷ 5 rồi ạ' (không mất vì trùng bảng)",
      r.body.replies.some((x) => x.startsWith("🤖")) && r.body.replies.some((x) => /^Dạ em sửa lại giá 7 tỷ 5/.test(x)),
      JSON.stringify(r.body.replies));
  }
  globalThis.__cauHinh = cauHinhCu;
  // (8) M06: căn khách nhắc là HẺM 6m mà model nói "mặt tiền kinh doanh" → bỏ câu đó, giữ câu hỏi.
  fresh((d) => { seedKho(d); buyerBiet(d, "gva-7"); });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ căn 12 Trần Hưng Đạo mặt tiền kinh doanh được anh. Mở quán ăn thì để em hỏi lại chủ nhà cho anh nha?"] });
  r = await send({ external_user_id: "gva-7", text: "căn BDS-Q5-0001 mở quán ăn được không" });
  check("GVA-07 căn kho ghi hẻm 6m mà model nói 'mặt tiền kinh doanh' → câu đó bị bỏ, câu hỏi lại chủ nhà giữ",
    !/mặt tiền/.test(rep()) && /hỏi lại chủ nhà/.test(rep()), JSON.stringify(r.body.replies));
  // (12) chế độ `chinh`: AI trả tên đường trần, luật giữ "hẻm 6m 12 Trần Hưng Đạo" → bản đầy đủ hơn thắng.
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh" };
  fresh();
  globalThis.__model.parse = (p) => laLuotBocRao(p)
    ? { so_can: 0, kien_thuc: [], truong: [
        { khoa: "duong", gia_tri: "Trần Hưng Đạo", trich_dan: "12 Trần Hưng Đạo", can: null },
        { khoa: "gia", gia_tri: "5 tỷ 8", trich_dan: "5 tỷ 8", can: null },
        { khoa: "quan", gia_tri: "Quận 5", trich_dan: "quận 5", can: null },
      ] } : OUT();
  r = await send({ external_user_id: "gva-8", text: "anh bán nhà hẻm 6m 12 Trần Hưng Đạo phường 4 quận 5, 4x12.5, 3 lầu, 5 tỷ 8" });
  {
    const L = db().t.listings[0];
    const vt = db().t.listing_facts.find((f) => f.listing_id === L?.id && f.question === "vi_tri")?.answer;
    check("GVA-08 'chinh': AI đọc đường 'Trần Hưng Đạo', luật đọc 'hẻm 6m 12 Trần Hưng Đạo' → vị trí giữ SỐ NHÀ 12",
      !!L && /12 Trần Hưng Đạo/.test(L.location_raw ?? "") && /12 Trần Hưng Đạo/.test(vt ?? ""), JSON.stringify({ loc: L?.location_raw, vt, rep: r.body.replies }));
  }
  globalThis.__cauHinh = cauHinhCu;
  // (11) kho có fact "gần chợ Hoà Bình" → dòng kho mang chữ đó; model bịa "chợ Hàng Thịt" → gọt còn "gần chợ".
  fresh((d) => { seedKho(d); buyerBiet(d, "gva-9"); const L = d.t.listings.find((l) => l.code === "BDS-Q5-0001"); L.boc_tach = { tien_ich_gan: "gần chợ Hoà Bình" }; L.nhan = ["gan_cho"]; d.insert("listing_facts", { listing_id: L.id, question: "tien_ich_gan", answer: "gần chợ Hoà Bình", source: "seller_chat" }); });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ em có căn 12 Trần Hưng Đạo hẻm 6m, gần chợ Hàng Thịt lắm. Anh muốn xem hôm nào?"] });
  r = await send({ external_user_id: "gva-9", text: "căn BDS-Q5-0001 có gần chợ không" });
  {
    const prompt = JSON.stringify(globalThis.__calls.filter((c) => c.kind === "parse").map((c) => c.params));
    check("GVA-09 dòng kho / căn khách nhắc mang 'gần chợ Hoà Bình' + nhãn; 'chợ Hàng Thịt' bịa bị gọt còn 'gần chợ'",
      /gần chợ Hoà Bình/.test(prompt) && !/Hàng Thịt/.test(rep()) && /gần chợ lắm/.test(rep()) && /xem hôm nào/.test(rep()),
      JSON.stringify({ rep: r.body.replies, coTienIch: /gần chợ Hoà Bình/.test(prompt) }));
  }
  // FR-114 (e) (22/09/2026, Zalo thật): "quận 5 có dự án gì không em" → nạp dự án CÙNG QUẬN từ kho `projects`
  // làm kiến thức; không kể dự án quận khác / dự án nhà mình sai quận; tên ngoài kho bị gọt.
  fresh((d) => {
    seedKho(d); buyerBiet(d, "gva-10");
    d.insert("projects", { name: "Ny'ah Phú Định", district: "Quận 8", ward: "Phường 16", is_partner: true, priority: 1, location_raw: "Phú Định, Quận 8" });
    d.insert("projects", { name: "Chung cư Lakai", district: "Quận 5", ward: "Phường 7", location_raw: "Số 5 Nguyễn Tri Phương, Phường 7, Quận 5", developer: "Lakai", priority: 5 });
    d.insert("projects", { name: "Dragon Riverside City", district: "Quận 5", ward: "Phường 1", location_raw: "628-630 Võ Văn Kiệt, Phường 1, Quận 5", priority: 3 });
    d.insert("projects", { name: "Sunrise City", district: "Quận 7", ward: "Phường Tân Hưng", location_raw: "Nguyễn Hữu Thọ, Quận 7", priority: 2 });
  });
  // Model kể đúng tên nhưng nói "đang bán" và QUÊN câu "chưa có căn nào đang rao" (bắn thật 22/09) → code nối câu đó.
  globalThis.__model.parse = () => OUT({ replies: ["Dạ anh, Quận 5 bên em có vài dự án đang bán như Chung cư Lakai ở Nguyễn Tri Phương và Dragon Riverside City ở Võ Văn Kiệt ạ. Ngoài ra còn dự án Sunrise Quận 5 nữa ạ.", "Anh có khoảng giá nào không ạ?"] });
  r = await send({ external_user_id: "gva-10", text: "quận 5 có dự án gì không em" });
  {
    const prompt = JSON.stringify(globalThis.__calls.filter((c) => c.kind === "parse").map((c) => c.params));
    check("GVA-10 khách hỏi 'quận 5 có dự án gì' → khối DỰ ÁN TRONG QUẬN 5 với Lakai + Dragon Riverside, KHÔNG có Sunrise City (Q7); tên bịa 'Sunrise Quận 5' bị gọt; kho trống + model quên → nối bong bóng 'chưa có căn nào … đang rao' ngay sau bong bóng kể dự án",
      /DỰ ÁN TRONG QUẬN 5/.test(prompt) && /Chung cư Lakai/.test(prompt) && /Dragon Riverside City/.test(prompt) &&
        !/TRONG QUẬN 5[^]*?Sunrise City/.test(prompt.split("DỰ ÁN KHÁCH VỪA NHẮC")[0]) &&
        /Lakai/.test(rep()) && /Dragon Riverside City/.test(rep()) && !/Sunrise Quận 5/.test(rep()) &&
        r.body.replies.length === 3 && /^Hiện bên em chưa có căn nào của các dự án này đang rao/.test(r.body.replies[1] ?? "") && /khoảng giá/.test(r.body.replies[2] ?? ""),
      JSON.stringify({ rep: r.body.replies, coKhoi: /DỰ ÁN TRONG QUẬN 5/.test(prompt) }));
  }
  // Không hỏi dự án, kho có tin → không nạp khối (không tốn truy vấn, không đẩy model kể dự án).
  globalThis.__model.parse = () => OUT({ replies: ["Dạ anh cần mấy phòng ngủ ạ?"] });
  r = await send({ external_user_id: "gva-10", text: "anh tìm nhà hẻm 3 phòng ngủ" });
  {
    const prompt = JSON.stringify(globalThis.__calls.filter((c) => c.kind === "parse").map((c) => c.params).slice(-1));
    check("GVA-10b câu không nhắc dự án, kho có tin → KHÔNG có khối DỰ ÁN TRONG QUẬN", !/DỰ ÁN TRONG QUẬN 5/.test(prompt), prompt.slice(0, 300));
  }
  // (2) chủ nhà HỎI VỀ CHÍNH TIN CỦA MÌNH → trả lời tiền định từ DB, hỏi lại câu treo; học xưng hô "anh nói".
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
    const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0001");
    sC.active_listing_id = tin.id;
    db().insert("info_requests", { listing_id: tin.id, question: "ket_cau", status: "pending" });
    r = await send({ external_user_id: "z-ccrb", text: "hồi nãy anh nói giá bao nhiêu nhỉ" });
    check("GVA-11 'hồi nãy anh nói giá bao nhiêu nhỉ' → 'Dạ giá mình đang rao là 5,8 tỷ ạ' + hỏi lại câu treo; 0 lượt model; xưng hô học được 'anh'",
      r.body.hoi_ve_tin === "gia" && /giá mình đang rao là 5,8 tỷ/.test(r.body.replies[0] ?? "") && r.body.replies.length === 2 && /tầng|lầu|kết cấu/i.test(r.body.replies[1] ?? "") &&
        createCalls().length === 0 && sC.xung_ho === "anh" && pend("ket_cau", tin.id),
      JSON.stringify({ rep: r.body.replies, xh: sC.xung_ho }));
    // (1) đang treo câu chấm điểm mà chủ hỏi "có khách nào hỏi chưa em" → KHÔNG nuốt làm điểm, trả lời thật.
    db().t.info_requests.forEach((x) => { if (x.listing_id === tin.id && x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: tin.id, question: "danh_gia", status: "pending" });
    r = await send({ external_user_id: "z-ccrb", text: "có khách nào hỏi chưa em" });
    check("GVA-12 đang treo danh_gia, 'có khách nào hỏi chưa em' → 'chưa có khách nào hỏi', KHÔNG ghi fact danh_gia, câu chấm điểm vẫn treo",
      r.body.hoi_ve_tin === "khach" && /chưa có khách nào hỏi/.test(r.body.replies[0] ?? "") && !db().t.listing_facts.some((f) => f.listing_id === tin.id && f.question === "danh_gia") && pend("danh_gia", tin.id) && r.body.replies.length === 1,
      JSON.stringify({ rep: r.body.replies, f: db().t.listing_facts.filter((f) => f.question === "danh_gia") }));
    db().insert("interests", { buyer_id: db().insert("buyers", { zalo_user_id: "gva-12b", preferences: {} }).data.id, listing_id: tin.id });
    r = await send({ external_user_id: "z-ccrb", text: "có ai hỏi căn anh chưa" });
    check("GVA-12b có 1 khách quan tâm → 'đang có 1 khách quan tâm'", /1 khách quan tâm/.test(r.body.replies[0] ?? ""), JSON.stringify(r.body.replies));
  }
  // FR-220 (24/09/2026): câu hỏi bù "có tầng lửng, sân thượng hay tầng hầm không" → phần CÓ chen vào kết cấu chữ.
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
    const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0001");
    sC.active_listing_id = tin.id;
    tin.floors = 3; tin.floors_text = "trệt + 2 lầu";
    db().insert("info_requests", { listing_id: tin.id, question: "tang_phu", status: "pending" });
    r = await send({ external_user_id: "z-ccrb", text: "có lửng với sân thượng em" });
    const fTp = db().t.listing_facts.find((f) => f.listing_id === tin.id && f.question === "tang_phu");
    check("TANGPHU-01 'có lửng với sân thượng' → fact tang_phu + floors_text 'trệt + lửng + 2 lầu + sân thượng'; câu không còn treo",
      !!fTp && tin.floors_text === "trệt + lửng + 2 lầu + sân thượng" && tin.floors === 3 && !pend("tang_phu", tin.id),
      JSON.stringify({ fTp, kc: tin.floors_text, rep: r.body.replies }));
    const tin2 = db().t.listings.find((l) => l.code === "BDS-Q5-0002");
    sC.active_listing_id = tin2.id;
    tin2.floors = 4; tin2.floors_text = "trệt + 3 lầu";
    db().insert("info_requests", { listing_id: tin2.id, question: "tang_phu", status: "pending" });
    r = await send({ external_user_id: "z-ccrb", text: "không có em" });
    const fTp2 = db().t.listing_facts.find((f) => f.listing_id === tin2.id && f.question === "tang_phu");
    check("TANGPHU-02 'không có em' → ghi fact, kết cấu giữ nguyên 'trệt + 3 lầu'",
      !!fTp2 && tin2.floors_text === "trệt + 3 lầu" && !pend("tang_phu", tin2.id),
      JSON.stringify({ fTp2, kc: tin2.floors_text, rep: r.body.replies }));
    check("TANGPHU-03 kết cấu đã có lửng → view không còn thiếu tang_phu",
      !db().missingFacts().some((m) => m.listing_id === tin.id && m.fact_key === "tang_phu"), "");
  }
  // 24/09/2026 (chủ dự án test Zalo, người bán Gò Vấp): "đường số 59", "dài 16m" ghép ngang đã có, số nhà "137/28" không thành m².
  {
    const cauHinhCu = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1" };
    fresh(seedKho);
    r = await send({ external_user_id: "gv-01", text: "Anh cần bán nhà ở đường số 59 Gò vấp," });
    const tGv = db().t.listings.find((l) => l.seller_id === db().t.sellers.find((x) => x.zalo_user_id === "gv-01")?.id);
    check("GOVAP-01 rao 'đường số 59 Gò vấp' → địa chỉ 'đường số 59', quận Gò Vấp",
      /đường số 59/i.test(tGv?.location_raw ?? "") && /Gò Vấp/.test(tGv?.district ?? ""), JSON.stringify({ lr: tGv?.location_raw, q: tGv?.district, rep: r.body.replies }));
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
    const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0003");
    sC.active_listing_id = tin.id;
    tin.area_m2 = null; tin.frontage_m = 5; tin.length_m = null;
    db().insert("info_requests", { listing_id: tin.id, question: "dien_tich_dat", status: "pending" });
    r = await send({ external_user_id: "z-ccrb", text: "dài 16m" });
    check("GOVAP-02 đang hỏi diện tích, tin có ngang 5 → 'dài 16m' thành 80 m², KHÔNG vào bổ sung",
      Number(tin.area_m2) === 80 && !db().t.listing_facts.some((f) => f.listing_id === tin.id && f.question === "bo_sung" && /16/.test(f.answer)) && !pend("dien_tich_dat", tin.id),
      JSON.stringify({ area: tin.area_m2, f: db().t.listing_facts.filter((f) => f.listing_id === tin.id).map((f) => [f.question, f.answer]), rep: r.body.replies }));
    const tin2 = db().t.listings.find((l) => l.code === "BDS-Q5-0002");
    sC.active_listing_id = tin2.id;
    tin2.area_m2 = null; tin2.frontage_m = null; tin2.location_raw = "đường số 59"; tin2.price_raw = null; tin2.price_vnd = null;
    db().insert("info_requests", { listing_id: tin2.id, question: "dien_tich_dat", status: "pending" });
    const taoCu3 = globalThis.__model.create;
    globalThis.__model.create = () => "137m2 trên sổ, giá 5 tỷ 9 thương lượng 5 tỷ 5, khuôn đất này dễ xây lắm anh. Diện tích đất trên sổ bao nhiêu, ngang dài thế nào anh?";
    r = await send({ external_user_id: "z-ccrb", text: "137/28 nhé em, cần bán gấp giá 5 tỏi 9 thương lượng 5 tỏi 5 là bán được" });
    globalThis.__model.create = taoCu3;
    check("GOVAP-03 '137/28 nhé em, cần bán gấp…' khi đang hỏi diện tích → địa chỉ '137/28 đường số 59', diện tích KHÔNG thành 137",
      tin2.location_raw === "137/28 đường số 59" && Number(tin2.area_m2 ?? 0) !== 137 && tin2.gap === true,
      JSON.stringify({ lr: tin2.location_raw, area: tin2.area_m2, gap: tin2.gap, rep: r.body.replies }));
    check("GOVAP-03b khách nói sang số nhà → thôi câu diện tích (không hỏi lại), không bong bóng nào nói 137m2",
      !pend("dien_tich_dat", tin2.id) && !r.body.replies.some((x) => /137\s*m2/.test(x)),
      JSON.stringify({ ir: db().t.info_requests.filter((q) => q.listing_id === tin2.id).map((q) => [q.question, q.status]), rep: r.body.replies }));
    // Model tự nói số m² không có trong DB → bỏ câu đó (tin 0001 có 50 m²).
    fresh(seedKho);
    {
      const sC6 = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
      const t6 = db().t.listings.find((l) => l.code === "BDS-Q5-0002");
      sC6.active_listing_id = t6.id;
      t6.floors = null;
      db().insert("info_requests", { listing_id: t6.id, question: "ket_cau", status: "pending" });
      const taoCu = globalThis.__model.create;
      globalThis.__model.create = () => "Nhà 137m2 xây 3 tầng là rộng rãi lắm anh. Tổng cộng bao nhiêu phòng ngủ anh?";
      r = await send({ external_user_id: "z-ccrb", text: "3 tầng em" });
      globalThis.__model.create = taoCu;
      check("GOVAP-06 model nói '137m2' (tin có 60 m², khách không gõ) → bỏ câu đó, giữ câu hỏi phòng ngủ",
        !r.body.replies.some((x) => /137\s*m2/.test(x)) && r.body.replies.some((x) => /phòng ngủ/.test(x)),
        JSON.stringify(r.body.replies));
    }
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh" };
    fresh(seedKho);
    const sC3 = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
    const tin3 = db().t.listings.find((l) => l.code === "BDS-Q5-0003");
    sC3.active_listing_id = tin3.id;
    tin3.area_m2 = null; tin3.frontage_m = 5; tin3.length_m = null;
    db().insert("info_requests", { listing_id: tin3.id, question: "dien_tich_dat", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p)
      ? { so_can: 0, kien_thuc: [], truong: [{ khoa: "dai", gia_tri: "16", trich_dan: "dài 16m", can: null }] }
      : OUT();
    r = await send({ external_user_id: "z-ccrb", text: "dài 16m" });
    check("GOVAP-04 'chinh': AI chỉ đọc 'dài 16', tin có ngang 5 → 80 m², câu diện tích không còn treo",
      Number(tin3.area_m2) === 80 && !pend("dien_tich_dat", tin3.id),
      JSON.stringify({ area: tin3.area_m2, f: db().t.listing_facts.filter((f) => f.listing_id === tin3.id).map((f) => [f.question, f.answer]), rep: r.body.replies }));
    fresh(seedKho);
    const sC4 = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
    const tin4 = db().t.listings.find((l) => l.code === "BDS-Q5-0003");
    sC4.active_listing_id = tin4.id;
    tin4.legal_status = null;
    db().insert("info_requests", { listing_id: tin4.id, question: "dien_tich_dat", status: "pending" });
    tin4.area_m2 = null;
    globalThis.__model.parse = (p) => laLuotBocRao(p)
      ? { so_can: 0, kien_thuc: [], truong: [{ khoa: "ngang", gia_tri: "5", trich_dan: "ngang 5m", can: null }] }
      : OUT();
    r = await send({ external_user_id: "z-ccrb", text: "ngang 5m daifm shr, hxh quay đầu" });
    check("GOVAP-05 'chinh': AI bỏ sót 'shr' → luật ghi pháp lý 'sổ hồng riêng'",
      tin4.legal_status === "so_hong_rieng" && db().t.listing_facts.some((f) => f.listing_id === tin4.id && f.question === "phap_ly" && f.answer === "sổ hồng riêng"),
      JSON.stringify({ pl: tin4.legal_status, f: db().t.listing_facts.filter((f) => f.listing_id === tin4.id).map((f) => [f.question, f.answer]), rep: r.body.replies }));
    // 24/09/2026 (chủ dự án: "sao nó hỏi lại vậy … nếu trường hợp tương tự nó hiểu ko").
    fresh(seedKho);
    {
      const s7 = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
      const t7 = db().t.listings.find((l) => l.code === "BDS-Q5-0002");
      s7.active_listing_id = t7.id;
      t7.floors = null; t7.floors_text = null; t7.bedrooms = null;
      db().insert("info_requests", { listing_id: t7.id, question: "ket_cau", status: "pending" });
      globalThis.__model.parse = (p) => laLuotBocRao(p)
        ? { so_can: 0, kien_thuc: ["4 tầng"], truong: [] }
        : OUT();
      r = await send({ external_user_id: "z-ccrb", text: "4 tầng, 4 phòng ngủ nhé" });
      check("HOILAI-01 'chinh': AI không trả trường nào (như production 11:02), im về kết cấu → luật chắc '4 tầng' vẫn là câu trả lời (4 tầng, 4 PN), không vào bổ sung, câu kết cấu đóng",
        t7.floors === 4 && t7.bedrooms === 4 && !pend("ket_cau", t7.id) &&
          !db().t.listing_facts.some((f) => f.listing_id === t7.id && f.question === "bo_sung" && /4 tầng/.test(f.answer)),
        JSON.stringify({ fl: t7.floors, bd: t7.bedrooms, f: db().t.listing_facts.filter((f) => f.listing_id === t7.id).map((f) => [f.question, f.answer]), rep: r.body.replies }));
      // Giả lập lượt trước bot KHÔNG bắt được (bản cũ): xoá kết cấu, mở lại câu treo → chủ nói "đã trả lời rồi này".
      t7.floors = null; t7.floors_text = null;
      db().t.listing_facts = db().t.listing_facts.filter((f) => !(f.listing_id === t7.id && f.question === "ket_cau"));
      db().insert("info_requests", { listing_id: t7.id, question: "ket_cau", status: "pending" });
      globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
      r = await send({ external_user_id: "z-ccrb", text: "đã trả lời rồi này" });
      check("HOILAI-02 'đã trả lời rồi này' → đọc lại tin trước '4 tầng, 4 phòng ngủ nhé' → kết cấu 4 tầng, KHÔNG ghi câu phàn nàn vào bổ sung",
        t7.floors === 4 && !pend("ket_cau", t7.id) &&
          !db().t.listing_facts.some((f) => f.listing_id === t7.id && /đã trả lời/.test(f.answer)),
        JSON.stringify({ fl: t7.floors, f: db().t.listing_facts.filter((f) => f.listing_id === t7.id).map((f) => [f.question, f.answer]), rep: r.body.replies }));
      db().insert("info_requests", { listing_id: t7.id, question: "huong", status: "pending" });
      r = await send({ external_user_id: "z-ccrb", text: "nói rồi mà" });
      check("HOILAI-03 'nói rồi mà' khi tin trước không trả lời câu hướng → xin lỗi, hỏi lại MỘT câu, không ghi gì",
        /xin lỗi/.test(r.body.replies.join(" ")) && pend("huong", t7.id) && !db().t.listing_facts.some((f) => f.listing_id === t7.id && /nói rồi/.test(f.answer)),
        JSON.stringify(r.body.replies));
    }
    globalThis.__model.parse = () => OUT();
    globalThis.__cauHinh = cauHinhCu;
  }
  // 24/09/2026 (chủ dự án test Zalo, nhà mặt tiền Trần Đình Xu): tin rao dài nhiều dòng KHÔNG đẻ căn thứ hai; "đăng rao bán đi"
  // (kèm "đã cho thuê") KHÔNG phải báo bán rồi.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-tdx", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-NP-XX-0901", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "Trần Đình Xu", street: "Trần Đình Xu", can_chu_duyet: true }).data;
    s.active_listing_id = l.id;
    d.insert("info_requests", { listing_id: l.id, question: "dien_tich_dat", status: "pending" });
  });
  r = await send({ external_user_id: "z-tdx", text: "Quận 1 8x15m 3 tầng · Góc 2 mặt tiền\nHợp đồng thuê Sacombank đến năm 2031 · 150 triệu/tháng\nGóc hai mặt tiền ngay nút giao Trần Đình Xu – Nguyễn Cư Trinh, vị trí nhận diện nổi bật." });
  {
    const cua = db().t.listings.filter((l) => l.seller_id === db().t.sellers.find((x) => x.zalo_user_id === "z-tdx")?.id);
    check("TDX-01 tin rao nhiều dòng nhắc lại 'Trần Đình Xu' → KHÔNG tạo căn thứ hai ('mặt tiền Hợp đồng'), diện tích 8x15 vào căn đang hỏi",
      cua.length === 1 && Number(cua[0].area_m2) === 120 && !cua.some((l) => /Hợp đồng/.test(l.location_raw ?? "")),
      JSON.stringify({ n: cua.length, lr: cua.map((l) => l.location_raw), area: cua.map((l) => l.area_m2), rep: r.body.replies }));
    const tT = cua[0];
    tT.price_raw = "65 tỷ"; tT.price_vnd = 65e9; tT.bedrooms = 4;
    db().t.info_requests.forEach((q) => { if (q.listing_id === tT.id && q.status === "pending") q.status = "expired"; });
    db().insert("info_requests", { listing_id: tT.id, question: "phap_ly", status: "pending" });
    r = await send({ external_user_id: "z-tdx", text: "đã cho thuê là nhà đã hoàn thiện hết rồi em, đăng rao bán đi" });
    check("TDX-02 'đã cho thuê là nhà đã hoàn thiện hết rồi em, đăng rao bán đi' → KHÔNG hỏi 'đã bán căn nào', tin không bị đóng",
      !r.body.replies.some((x) => /đã bán căn nào|bán rồi/.test(x)) && tT.status !== "da_chot" && tT.status !== "an",
      JSON.stringify({ st: tT.status, rep: r.body.replies }));
  }
  // 24/09/2026: "đăng đi" mà tin THIẾU PHƯỜNG (chưa lên kệ được) → nói thật còn thiếu phường, mở câu phường; có phường là tự lên kệ.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-dang-p", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-GV-0901", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "137/28 Đường số 59", district: "Quận Gò Vấp", ward: null, price_raw: "5 tỷ 9", price_vnd: 5.9e9, area_m2: 80, floors: 4, bedrooms: 4, alley_width_m: 5, access_type: "hem_xe_hoi", legal_status: "so_hong_rieng", can_chu_duyet: true }).data;
    d.insert("listing_facts", { listing_id: l.id, question: "hinh_anh", answer: "https://x/1.jpg", source: "seller_chat" });
    d.insert("info_requests", { listing_id: l.id, question: "phap_ly", status: "pending" });
  });
  r = await send({ external_user_id: "z-dang-p", text: "hoàn công rồi, đăng đi" });
  {
    const tP = db().t.listings.find((l) => l.code === "BDS-GV-0901");
    check("DANGLUON-01 'đăng đi' mà tin thiếu phường → không gửi nháp hỏi duyệt, nói thật 'chỉ còn thiếu phường', mở câu phường, đã đóng dấu duyệt",
      r.body.dang_luon === true && tP.status === "cho_thong_tin" && !!tP.chu_duyet_at && pend("phuong", tP.id) &&
        r.body.replies.some((x) => /thiếu phường/.test(x)) && !r.body.replies.some((x) => /ổn chưa/.test(x)),
      JSON.stringify({ st: tP.status, rep: r.body.replies, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  }
  // FR-223 (24/09/2026, chủ dự án: "rẽ nhánh nếu câu hỏi trước trả lời gì thì sau đó sẽ có bộ câu hỏi gì"): câu kế theo NỘI DUNG câu trả lời.
  const rnSeed = (uid, code, them = {}, facts = []) => fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: uid, seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code, seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "12 Trần Hưng Đạo", district: "Quận 5", ward: "Phường 2", price_raw: "9 tỷ", price_vnd: 9e9, area_m2: 60, floors: 3, bedrooms: 3, alley_width_m: 5, access_type: "hem_xe_hoi", can_chu_duyet: true, ...them }).data;
    for (const [q, a] of facts) d.insert("listing_facts", { listing_id: l.id, question: q, answer: a, source: "seller_chat" });
    d.insert("info_requests", { listing_id: l.id, question: "phap_ly", status: "pending" });
  });
  // 27/09 (FR-232): tin BÁN không rẽ nhánh hoàn công trước bản nháp — nhánh này đo trên tin chưa rõ bán / thuê.
  rnSeed("z-rn1", "BDS-Q5-0931", { deal: null });
  r = await send({ external_user_id: "z-rn1", text: "sổ hồng riêng em" });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0931");
    check("RENHANH-01 nhà phố trả lời 'sổ hồng riêng' → câu kế là HOÀN CÔNG (câu nhánh), bot hỏi được câu đó",
      pend("hoan_cong", l.id) && /hoàn công/.test(createCalls().at(-1)?.params?.messages?.[0]?.content ?? ""),
      JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
    r = await send({ external_user_id: "z-rn1", text: "rồi em" });
    const fHc = db().t.listing_facts.find((x) => x.listing_id === l.id && x.question === "hoan_cong");
    check("RENHANH-04 trả lời 'rồi em' cho câu hoàn công → ghi fact hoan_cong, không hỏi lại hoàn công",
      !!fHc && !pend("hoan_cong", l.id), JSON.stringify({ fHc, rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
  }
  // 25/09/2026 (chủ dự án test Zalo, tin An Dương Vương): "hoàn công rồi" → câu liên quan là ẢNH → code gửi NHÁP, bỏ qua
  // phường/quận còn thiếu (nháp ra không có quận). Còn câu khác thì chưa được chọn ảnh.
  rnSeed("z-rn9", "BDS-Q5-0939", { district: null, ward: null, location_raw: "An Dương Vương", boc_tach: { quan_mac_dinh: true } });
  r = await send({ external_user_id: "z-rn9", text: "sổ hồng riêng em" });
  r = await send({ external_user_id: "z-rn9", text: "hoàn công rồi" });
  r = await quaPhapLy("z-rn9", r);
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0939");
    // SRS-5.1s: câu phường đã được hỏi (sau pháp lý); "hoàn công rồi" không trả lời nó → thôi câu phường, KHÔNG nhảy sang nháp.
    check("RENHANH-04b tin chưa có phường/quận → phường được hỏi trước nháp; 'hoàn công rồi' không gửi bản nháp",
      db().t.info_requests.some((q) => q.listing_id === l.id && q.question === "phuong") && !pend("duyet_tin", l.id) && !r.body.replies.some((x) => /^📋/.test(x)),
      JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
  }
  // FR-232 (27/09/2026, chủ dự án sau test Zalo: "Tao thấy hỏi hơi nhiều" → "Cả 3"): tin BÁN hỏi pháp lý MỘT câu trước bản
  // nháp (sổ + ai đứng tên + cầm tay / thế chấp, câu trả lời tách từng ô); quy hoạch / tranh chấp / khớp sổ hỏi bù sau khi
  // lên tin, "không có gì hết" trả lời cả ba.
  const PL_TRUOC = ["nguoi_dung_ten", "the_chap", "quy_hoach", "tranh_chap", "dien_tich_khop_so", "hoan_cong"];
  rnSeed("z-pl1", "BDS-Q5-0951");
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0951");
    const treo = () => db().t.info_requests.filter((q) => q.listing_id === l.id && q.status === "pending").map((q) => q.question);
    const fL = (q) => db().t.listing_facts.filter((f) => f.listing_id === l.id && f.question === q).map((f) => f.answer);
    r = await send({ external_user_id: "z-pl1", text: "sổ hồng riêng, anh đứng tên, sổ cầm tay em" });
    check("PL232-E1 một câu 'sổ hồng riêng, anh đứng tên, sổ cầm tay' → ghi sổ + đứng tên + thế chấp; không hỏi thêm câu pháp lý nào trước bản nháp",
      fL("phap_ly").length && fL("nguoi_dung_ten").some((a) => /đứng tên/.test(a)) && fL("the_chap").some((a) => /cầm tay/.test(a)) &&
        !treo().some((q) => PL_TRUOC.includes(q)),
      JSON.stringify({ pl: fL("phap_ly"), dt: fL("nguoi_dung_ten"), tc: fL("the_chap"), treo: treo(), rep: r.body.replies }));
  }
  // Cùng câu, chế độ `chinh` (production): AI đọc câu sổ, im về đứng tên / thế chấp → luật vẫn ghi kèm hai ô đó.
  rnSeed("z-pl1c", "BDS-Q5-0956");
  {
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => laLuotBocRao(p)
      ? { so_can: 0, kien_thuc: [], truong: [], tra_loi: { co_tra_loi: true, gia_tri: "sổ hồng riêng", trich_dan: "sổ hồng riêng" } } : OUT();
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0956");
    r = await send({ external_user_id: "z-pl1c", text: "sổ hồng riêng, anh đứng tên, sổ cầm tay em" });
    const fL = (q) => db().t.listing_facts.filter((f) => f.listing_id === l.id && f.question === q).map((f) => f.answer);
    check("PL232-E1c (chinh) AI đọc câu sổ, im về hai ý kia → vẫn ghi đứng tên + thế chấp, sổ ghi 'sổ hồng riêng'",
      fL("phap_ly").includes("sổ hồng riêng") && fL("nguoi_dung_ten").length === 1 && fL("the_chap").length === 1,
      JSON.stringify({ pl: fL("phap_ly"), dt: fL("nguoi_dung_ten"), tc: fL("the_chap"), rep: r.body.replies }));
    globalThis.__cauHinh = cuCH;
    globalThis.__model.parse = undefined;
  }
  rnSeed("z-pl3", "BDS-Q5-0953");
  r = await send({ external_user_id: "z-pl3", text: "sổ hồng riêng em" });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0953");
    check("PL232-E2 chỉ nói 'sổ hồng riêng' → KHÔNG hỏi đứng tên / thế chấp / quy hoạch / hoàn công trước bản nháp (hỏi bù sau khi lên tin)",
      !db().t.info_requests.some((q) => q.listing_id === l.id && PL_TRUOC.includes(q.question)),
      JSON.stringify({ ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]), rep: r.body.replies }));
  }
  // Bot hỏi câu sổ cho tin bán → câu gộp; model rút còn một vế thì câu mẫu thay vào (`giuVeCauMau`).
  rnSeed("z-pl4", "BDS-Q5-0954", { price_raw: null, price_vnd: null }, [["gap", "không gấp"]]);
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0954");
    db().t.info_requests = db().t.info_requests.filter((q) => q.listing_id !== l.id);
    db().insert("info_requests", { listing_id: l.id, question: "gia", status: "pending" });
    globalThis.__model.create = () => "Dạ 9 tỷ em ghi rồi ạ. Sổ nhà mình riêng hay chung anh?";
    r = await send({ external_user_id: "z-pl4", text: "9 tỷ em" });
    globalThis.__model.create = undefined;
    const cau = r.body.replies.join("\n");
    check("PL232-E3 câu sổ của tin bán hỏi MỘT ý (01/10, chủ dự án: \"từng ý thôi\") — không gộp đứng tên / thế chấp",
      db().t.info_requests.some((q) => q.listing_id === l.id && q.status === "pending" && q.question === "phap_ly") &&
        /riêng hay chung|riêng hay sổ chung/.test(cau) && !/đứng tên/.test(cau) && !/thế chấp/.test(cau),
      JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
  }
  // Bắn thật lx-38: câu hỏi ĐẦU sau câu rao (đường r1) là câu sổ — model rút còn một vế → câu mẫu gộp.
  {
    fresh(seedKho);
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1" };
    globalThis.__model.create = () => "Hẻm xe hơi tới cửa như vậy khách chuộng lắm. Sổ nhà mình riêng hay chung ạ?";
    r = await send({ external_user_id: "z-pl6", text: "bán nhà hẻm xe hơi 5m Trần Hưng Đạo phường Cầu Ông Lãnh quận 1, 4x15 60m2, 1 trệt 2 lầu 3 phòng ngủ, giá 9 tỷ, không gấp" });
    globalThis.__model.create = undefined;
    globalThis.__cauHinh = cuCH;
    const l = db().t.listings.at(-1);
    const cau = r.body.replies.join("\n");
    check("PL232-E3b câu hỏi đầu sau câu rao là câu sổ MỘT ý — không gộp đứng tên / thế chấp",
      db().t.info_requests.some((q) => q.listing_id === l.id && q.status === "pending" && q.question === "phap_ly") &&
        /[Ss]ổ/.test(cau) && !/đứng tên/.test(cau) && !/thế chấp/.test(cau),
      JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
  }
  // Sau khi lên tin: hỏi bù gom ba câu (ask-seller mở ba câu treo), khách đáp "không có gì hết" → ghi cả ba, đóng cả ba.
  rnSeed("z-pl5", "BDS-Q5-0955", { status: "dang_ban" }, [["phap_ly", "sổ hồng riêng"]]);
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0955");
    db().t.info_requests.forEach((q) => { if (q.listing_id === l.id) q.status = "expired"; });
    for (const q of ["quy_hoach", "tranh_chap", "dien_tich_khop_so"]) db().insert("info_requests", { listing_id: l.id, question: q, status: "pending" });
    r = await send({ external_user_id: "z-pl5", text: "không có gì hết em" });
    const fL = (q) => db().t.listing_facts.filter((f) => f.listing_id === l.id && f.question === q);
    check("PL232-E4 hỏi bù gộp quy hoạch / tranh chấp / khớp sổ, 'không có gì hết em' → ghi cả ba ô, không còn câu nào treo",
      ["quy_hoach", "tranh_chap", "dien_tich_khop_so"].every((q) => fL(q).length === 1) &&
        !db().t.info_requests.some((q) => q.listing_id === l.id && q.status === "pending" && ["quy_hoach", "tranh_chap", "dien_tich_khop_so"].includes(q.question)),
      JSON.stringify({ f: ["quy_hoach", "tranh_chap", "dien_tich_khop_so"].map((q) => fL(q).map((x) => x.answer)), ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]), rep: r.body.replies }));
  }
  // FR-233 (chủ dự án 27/09/2026: "mấy cái mày ko ghi được vào db thì để AI nó xét qua … chứ mày cứ hỏi nhiều quá và ko
  // được tự nhiên"): câu không vào được ô đang hỏi → ghi chú nguyên văn (vào vector của tin), không hỏi lại, đi tiếp câu kế.
  rnSeed("z-233", "BDS-Q5-0957", {}, [["gap", "không gấp"]]);
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0957");
    r = await send({ external_user_id: "z-233", text: "nhà này phong thủy tốt lắm, ở ai cũng khá lên" });
    const lenh = createCalls().at(-1)?.params?.messages?.[0]?.content ?? "";
    check("FR233-E1 câu không vào ô đang hỏi (sổ) → ghi chú nguyên văn, KHÔNG hỏi lại câu sổ, lời dặn model: đi tiếp, không nói đã ghi / không hỏi lại",
      db().t.listing_facts.some((f) => f.listing_id === l.id && f.question === "bo_sung" && /phong thủy/.test(f.answer)) &&
        !db().t.info_requests.some((q) => q.listing_id === l.id && q.question === "phap_ly" && q.status === "pending") &&
        r.body.reask !== "phap_ly" && /KHÔNG hỏi lại câu cũ/.test(lenh),
      JSON.stringify({ rep: r.body.replies, reask: r.body.reask, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
  }
  // FR-234 (chủ dự án 28/09/2026: "fix theo 2 điểm chưa ổn … và khách bảo cứ đăng như này trước đi chiều anh gửi thêm thông
  // tin với ảnh các thứ h đang bận thì sao, làm luôn").
  // (a) Nói sang ô khác khi hỏi ô KHÔNG lõi → ghi ô đó, không hỏi lại; ô lõi (giá…) vẫn hỏi lại một lần.
  rnSeed("z-234a", "BDS-Q5-0960", {}, [["gap", "không gấp"]]);
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0960");
    r = await send({ external_user_id: "z-234a", text: "nhà hướng đông nam em" });
    const lenh = createCalls().at(-1)?.params?.messages?.[0]?.content ?? "";
    check("FR234-E1 hỏi sổ, khách nói hướng → ghi hướng, KHÔNG hỏi lại câu sổ, lời dặn model 'chưa phải câu em hỏi — KHÔNG hỏi lại'",
      db().t.listing_facts.some((f) => f.listing_id === l.id && f.question === "huong") &&
        !db().t.info_requests.some((q) => q.listing_id === l.id && q.question === "phap_ly" && q.status === "pending") &&
        r.body.reask !== "phap_ly" && /chưa phải câu em hỏi — KHÔNG hỏi lại câu cũ/.test(lenh),
      JSON.stringify({ rep: r.body.replies, reask: r.body.reask, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
  }
  rnSeed("z-234b", "BDS-Q5-0961", { price_raw: null, price_vnd: null });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0961");
    db().t.info_requests = db().t.info_requests.filter((q) => q.listing_id !== l.id);
    db().insert("info_requests", { listing_id: l.id, question: "gia", status: "pending" });
    r = await send({ external_user_id: "z-234b", text: "nhà 4 phòng ngủ em" });
    check("FR234-E2 hỏi GIÁ (ô lõi), khách nói phòng ngủ → ghi phòng ngủ, câu giá vẫn treo, hỏi lại một lần",
      db().t.listing_facts.some((f) => f.listing_id === l.id && f.question === "so_phong_ngu") &&
        db().t.info_requests.some((q) => q.listing_id === l.id && q.question === "gia" && q.status === "pending") && r.body.reask === "gia",
      JSON.stringify({ rep: r.body.replies, reask: r.body.reask, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
  }
  // (c) "cứ đăng như này trước đi, chiều anh gửi thêm thông tin với ảnh, h đang bận" → đăng luôn, hẹn nhắc, không hỏi thêm.
  const CAU_DANG_BAN = "Bảo cứ đăng như này trước đi chiều anh gửi thêm thông tin với ảnh các thứ h đang bận";
  rnSeed("z-234c", "BDS-Q5-0962", { frontage_m: 4, legal_status: "so_hong_rieng" }, [["gap", "không gấp"], ["phap_ly", "sổ hồng riêng"]]);
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0962");
    r = await send({ external_user_id: "z-234c", text: CAU_DANG_BAN });
    const nhac = (db().t.reminders ?? []).filter((x) => x.kind === "promise" && x.status === "pending");
    check("FR234-E3 'cứ đăng như này trước đi … chiều gửi thêm … h đang bận' (tin đủ điểm) → đóng dấu duyệt, lên kệ, có lời hẹn, hẹn nhắc, không hỏi thêm",
      !!l.chu_duyet_at && l.status !== "cho_thong_tin" && r.body.dang_luon === true && r.body.replies.some((x) => /gửi thêm thông tin với ảnh/.test(x)) &&
        nhac.length >= 1 && !r.body.replies.some((x) => /\?\s*$/.test(x) && !/ổn chưa/.test(x) && /(?:sổ|phường|mấy)/.test(x)),
      JSON.stringify({ st: l.status, duyet: l.chu_duyet_at, rep: r.body.replies, nhac: nhac.length }));
  }
  rnSeed("z-234d", "BDS-Q5-0963", { price_raw: null, price_vnd: null }, [["gap", "không gấp"]]);
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0963");
    r = await send({ external_user_id: "z-234d", text: CAU_DANG_BAN });
    check("FR234-E4 cùng câu, tin CHƯA đủ (thiếu giá) → không lên kệ, nói thật còn thiếu giá, không hỏi dồn; dấu duyệt giữ để đủ là tự lên",
      !!l.chu_duyet_at && l.status === "cho_thong_tin" && r.body.replies.length === 1 && /thiếu giá/.test(r.body.replies[0]) && /không hỏi lại/.test(r.body.replies[0]),
      JSON.stringify({ st: l.status, duyet: l.chu_duyet_at, rep: r.body.replies }));
  }
  // Bắn thật lx-41: câu đó tới lúc bot ĐANG CHỜ DUYỆT bản nháp → trước bản vá rơi nhánh lời hứa "nhắn ok là em đăng liền", không đăng.
  rnSeed("z-234f", "BDS-Q5-0965", { frontage_m: 4, legal_status: "so_hong_rieng" }, [["gap", "không gấp"], ["phap_ly", "sổ hồng riêng"]]);
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0965");
    db().t.info_requests = db().t.info_requests.filter((q) => q.listing_id !== l.id);
    db().insert("info_requests", { listing_id: l.id, question: "duyet_tin", status: "pending" });
    r = await send({ external_user_id: "z-234f", text: CAU_DANG_BAN });
    check("FR234-E3b đang chờ DUYỆT nháp, 'cứ đăng như này trước đi … chiều gửi thêm … h đang bận' → gật duyệt, lên kệ, có lời hẹn; KHÔNG 'nhắn ok là em đăng liền'",
      !!l.chu_duyet_at && l.status !== "cho_thong_tin" && r.body.duyet === true &&
        r.body.replies.some((x) => /gửi thêm thông tin với ảnh/.test(x)) && !r.body.replies.some((x) => /nhắn "ok"/.test(x)),
      JSON.stringify({ st: l.status, duyet: l.chu_duyet_at, rep: r.body.replies }));
  }
  // (b) Trước bản nháp, AI đọc lại GHI CHÚ chưa đọc (bo_sung nguồn chat) → ghi vào ô còn trống, đánh dấu đã đọc.
  rnSeed("z-234e", "BDS-Q5-0964", {}, [["gap", "không gấp"], ["bo_sung", "cửa chính nhìn hướng đông nam đón gió"]]);
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0964");
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    let docGhiChu = 0;
    globalThis.__model.parse = (p) => {
      if (!laLuotBocRao(p)) return OUT();
      const noi = String(p.messages?.[0]?.content ?? "");
      if (/đông nam/.test(noi)) docGhiChu++;
      return { so_can: 0, kien_thuc: [], tra_loi: { co_tra_loi: true, gia_tri: "sổ hồng riêng", trich_dan: "sổ hồng riêng" },
        truong: [{ khoa: "huong", gia_tri: "Đông Nam", trich_dan: "hướng đông nam", can: null }] };
    };
    r = await send({ external_user_id: "z-234e", text: "sổ hồng riêng em" });
    const huong = db().t.listing_facts.filter((f) => f.listing_id === l.id && f.question === "huong");
    check("FR234-E5 trước bản nháp AI đọc lại ghi chú 'cửa chính nhìn hướng đông nam' → ghi ô hướng (nguồn AI), đánh dấu ghi chú đã đọc",
      docGhiChu === 1 && huong.length === 1 && huong[0].source === "ai_kiem" && (l.boc_tach?.ghi_chu_da_doc ?? []).length === 1,
      JSON.stringify({ docGhiChu, huong, bt: l.boc_tach, rep: r.body.replies }));
    globalThis.__cauHinh = cuCH;
    globalThis.__model.parse = undefined;
  }
  // FR-235 (chủ dự án 28/09/2026, ảnh test Zalo 09:15): "hướng đông. đăng bài được chưa. a bận rồi" → hướng ghi vào tin nhưng câu
  // hướng vẫn treo; "ok e" → bot "chỉ cần thêm giá… Lô đất mình hướng nào anh?" (hỏi lại thứ vừa nói, và hỏi tiếp khi khách
  // đã nói bận). Nay: ghi fact khoá nào thì câu treo cùng khoá đóng (DB `ghi_fact_listing`, 20260928a); lời hoãn + "ok" → đáp ngắn.
  rnSeed("z-235", "BDS-DAT-0966", { property_type: "dat", price_raw: null, price_vnd: null, floors: null, bedrooms: null });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-DAT-0966");
    db().t.info_requests = db().t.info_requests.filter((q) => q.listing_id !== l.id);
    db().insert("info_requests", { listing_id: l.id, question: "huong", status: "pending" });
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
    globalThis.__model.parse = (p) => {
      if (!laLuotBocRao(p)) return OUT();
      return /hướng đông/.test(String(p.messages?.[0]?.content ?? ""))
        ? { so_can: 0, kien_thuc: [], truong: [{ khoa: "huong", gia_tri: "Đông", trich_dan: "hướng đông", can: null }], tra_loi: { co_tra_loi: true, gia_tri: "Đông", trich_dan: "hướng đông" } }
        : { so_can: 0, kien_thuc: [], truong: [] };
    };
    const ir = () => db().t.info_requests.filter((q) => q.listing_id === l.id);
    r = await send({ external_user_id: "z-235", text: "hướng đông. đăng bài được chưa. a bận rồi" });
    check("FR235-E1 'hướng đông. đăng bài được chưa. a bận rồi' → ghi hướng, câu hướng ĐÓNG (không treo), đóng dấu duyệt, nói thiếu gì, không hỏi thêm",
      db().t.listing_facts.some((f) => f.listing_id === l.id && f.question === "huong") && !ir().some((q) => q.question === "huong" && q.status === "pending") &&
        !!l.chu_duyet_at && r.body.replies.some((x) => /còn thiếu/.test(x)) && !r.body.replies.some((x) => /hướng nào/.test(x)),
      JSON.stringify({ rep: r.body.replies, ir: ir().map((q) => [q.question, q.status]) }));
    const soCau = ir().length;
    r = await send({ external_user_id: "z-235", text: "ok e" });
    check("FR235-E2 sau lời hoãn, 'ok e' → đáp ngắn, KHÔNG hỏi lại hướng, không mở câu hỏi mới",
      r.body.replies.filter((x) => !/^🤖/.test(x)).length === 1 && /em chờ/.test(r.body.replies.at(-1)) && !/\?/.test(r.body.replies.at(-1)) && ir().length === soCau,
      JSON.stringify({ rep: r.body.replies, ir: ir().map((q) => [q.question, q.status]) }));
    globalThis.__cauHinh = cuCH; globalThis.__model.parse = undefined;
  }
  rnSeed("z-235b", "BDS-Q5-0967", {}, [["gap", "không gấp"]]);
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0967");
    const ir = () => db().t.info_requests.filter((q) => q.listing_id === l.id);
    r = await send({ external_user_id: "z-235b", text: "giờ anh bận rồi em" });
    const soCau = ir().length;
    r = await send({ external_user_id: "z-235b", text: "ok e" });
    check("FR235-E3a 'giờ anh bận rồi em' KHÔNG phải 'bán rồi' — tin không bị gỡ khỏi kệ", l.status !== "da_chot" && !r.body.ngung_rao, JSON.stringify({ st: l.status }));
    check("FR235-E3 'giờ anh bận rồi' (bot: lúc nào rảnh nhắn em) rồi 'ok e' → đáp ngắn, không hỏi tiếp",
      r.body.replies.length === 1 && /em chờ/.test(r.body.replies[0]) && ir().length === soCau,
      JSON.stringify({ rep: r.body.replies, ir: ir().map((q) => [q.question, q.status]) }));
    r = await send({ external_user_id: "z-235b", text: "sổ hồng riêng em" });
    check("FR235-E4 sau đó khách nói dữ liệu thật → đi đường thường (ghi sổ, không bị nuốt bởi chặn gật)",
      db().t.listing_facts.some((f) => f.listing_id === l.id && f.question === "phap_ly"),
      JSON.stringify({ rep: r.body.replies, f: db().t.listing_facts.filter((f) => f.listing_id === l.id).map((f) => [f.question, f.answer]) }));
  }
  // FR-236 (bắn thật lx-43, 28/09/2026): tin lên kệ từ câu "hướng đông. đăng bài được chưa. a bận rồi" thiếu dòng hướng (hướng ghi ở
  // đường ra, sau khi soạn tin) và gọi tin đất là "Tin nhà mình"; "full thổ cư" chỉ thành nhãn nên điểm vẫn báo thiếu thổ cư; tin
  // đã đăng, không câu nào đang hỏi mà "giờ anh bận rồi" → "em hỏi dồn quá".
  for (const cheDo of ["chinh", "tat"]) {
    const uid = `z-236-${cheDo}`, code = cheDo === "chinh" ? "BDS-DAT-0968" : "BDS-DAT-0969";
    rnSeed(uid, code, { property_type: "dat", floors: null, bedrooms: null, legal_status: "so_hong_rieng", access_type: "mat_tien", alley_width_m: null, frontage_m: 5, length_m: 12 }, [["tho_cu", "100%"]]);
    const l = db().t.listings.find((x) => x.code === code);
    db().t.info_requests = db().t.info_requests.filter((q) => q.listing_id !== l.id);
    db().insert("info_requests", { listing_id: l.id, question: "huong", status: "pending" });
    const cuCH = globalThis.__cauHinh;
    globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: cheDo, bao_lai_da_luu: "thay_doi" };
    if (cheDo === "chinh") globalThis.__model.parse = (p) => {
      if (!laLuotBocRao(p)) return OUT();
      return /hướng đông/.test(String(p.messages?.[0]?.content ?? ""))
        ? { so_can: 0, kien_thuc: [], truong: [{ khoa: "huong", gia_tri: "Đông", trich_dan: "hướng đông", can: null }], tra_loi: { co_tra_loi: true, gia_tri: "Đông", trich_dan: "hướng đông" } }
        : { so_can: 0, kien_thuc: [], truong: [] };
    };
    r = await send({ external_user_id: uid, text: "hướng đông. đăng bài được chưa. a bận rồi" });
    const tin = r.body.replies.join("\n");
    check(`FR236-E1 (${cheDo}) tin lên kệ từ câu 'hướng đông… đăng bài… bận' → bản tin CÓ dòng '🧭 Hướng: Đông' và mở 'Tin đất mình lên kệ'`,
      l.status !== "cho_thong_tin" && /🧭 Hướng: Đông/.test(tin) && /Tin đất mình lên kệ/.test(tin) && !/Tin nhà mình/.test(tin),
      JSON.stringify({ st: l.status, rep: r.body.replies }));
    // FR-237 (chủ dự án 28/09 "Sửa đi"): tin ĐẤT không được xin "vài tấm ảnh (nhà, sổ, hẻm…)".
    check(`FR237-E1 (${cheDo}) tin đất lên kệ, chưa ảnh → gợi ý 'ảnh (lô đất, sổ, đường vào…)', không 'nhà, sổ, hẻm'`,
      /vài tấm ảnh \(lô đất, sổ, đường vào/.test(tin) && !/nhà, sổ, hẻm/.test(tin), JSON.stringify(tin.split("\n").filter((x) => /Độ đầy đủ/.test(x))));
    globalThis.__cauHinh = cuCH; globalThis.__model.parse = undefined;
  }
  rnSeed("z-236c", "BDS-DAT-0970", { property_type: "dat", floors: null, bedrooms: null });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-DAT-0970");
    r = await send({ external_user_id: "z-236c", text: "sổ hồng riêng full thổ cư em" });
    const tc = db().t.listing_facts.filter((f) => f.listing_id === l.id && f.question === "tho_cu");
    check("FR236-E2 'full thổ cư' → nhãn thổ cư 100% VÀ ô thổ cư = 100% (điểm không báo thiếu thổ cư, bot không gợi ý hỏi lại)",
      (l.nhan ?? []).includes("tho_cu_100") && tc.length === 1 && tc[0].answer === "100%" && !r.body.replies.some((x) => /thổ cư bao nhiêu/.test(x)),
      JSON.stringify({ nhan: l.nhan, tc, rep: r.body.replies }));
    r = await send({ external_user_id: "z-236c", text: "thổ cư toàn bộ nha em" });
    check("FR236-E3 nói lại 'thổ cư toàn bộ' khi ô thổ cư đã có → không ghi ô thổ cư lần hai",
      db().t.listing_facts.filter((f) => f.listing_id === l.id && f.question === "tho_cu" && f.answer === "100%").length === 1,
      JSON.stringify(db().t.listing_facts.filter((f) => f.listing_id === l.id).map((f) => [f.question, f.answer])));
  }
  rnSeed("z-236d", "BDS-Q5-0971", { status: "dang_ban", legal_status: "so_hong_rieng" });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0971");
    db().t.info_requests = db().t.info_requests.filter((q) => q.listing_id !== l.id);
    db().t.sellers.find((s) => s.zalo_user_id === "z-236d").active_listing_id = l.id;
    r = await send({ external_user_id: "z-236d", text: "giờ anh bận rồi em" });
    check("FR236-E4 tin đã lên kệ, không câu nào đang hỏi, 'giờ anh bận rồi em' → không 'em hỏi dồn quá'; nói tin vẫn đang rao; tin không bị gỡ",
      !r.body.replies.some((x) => /hỏi dồn/.test(x)) && r.body.replies.some((x) => /vẫn đang rao/.test(x)) && l.status === "dang_ban",
      JSON.stringify({ st: l.status, rep: r.body.replies }));
    r = await send({ external_user_id: "z-236d", text: "ok e" });
    check("FR236-E5 rồi 'ok e' → đáp ngắn 'em chờ', không hỏi gì",
      r.body.replies.length === 1 && /em chờ/.test(r.body.replies[0]) && !/\?/.test(r.body.replies[0]),
      JSON.stringify({ rep: r.body.replies }));
  }
  // FR-239 (chủ dự án 28/09/2026 "Sửa hết 13 điểm"): phát lại 3 hội thoại test 27–28/09 trên bot hiện tại.
  {
    const macDinh239 = globalThis.__model.create;
    // (a)+(h) câu rao: model "Em đã lên tin rồi ạ" (tin còn chờ) + khen thị trường "khách mua hay quan tâm lắm".
    fresh();
    globalThis.__model.create = () => "Cho thuê ngân hàng ổn định thì khách mua hay quan tâm lắm anh. Em đã lên tin rồi ạ. Nhà mình thuộc phường nào vậy anh?";
    r = await send({ external_user_id: "z-239a", text: "Nhà phố ở đường trần hưng đạo quận 1 đang cho viettinbank thuê 400 triệu 1 tháng bán 65 tỉ em" });
    const cau = r.body.replies.filter((x) => !/^(?:🤖|💾|📝)/u.test(x)).join(" ");
    check("FR239-E1 câu rao: bỏ 'Em đã lên tin rồi' (tin còn chờ) và câu khen 'khách mua hay quan tâm lắm', giữ câu hỏi",
      !/lên tin rồi/.test(cau) && !/quan tâm lắm/.test(cau) && /\?/.test(cau), JSON.stringify(r.body.replies));
    // (d) tỉnh bịa: khách nói Cần Đước, Long An → model "Đất ở Cần Thơ, Long An…".
    fresh();
    globalThis.__model.create = () => "Đất ở Cần Thơ, Long An là vị trí tốt cho buôn bán anh. Diện tích trên sổ bao nhiêu anh?";
    r = await send({ external_user_id: "z-239d", text: "bán lô đất ở Cần Đước, Long An giá 3 tỷ" });
    const cauD = r.body.replies.filter((x) => !/^(?:🤖|💾|📝)/u.test(x)).join(" ");
    check("FR239-E2 câu rao nói Cần Đước, Long An → bỏ câu 'Cần Thơ' model bịa", !/Cần Thơ/.test(cauD), JSON.stringify(r.body.replies));
    // (i) có đường mà chưa rõ quận → câu hỏi đầu là phường / quận.
    fresh();
    globalThis.__model.create = macDinh239;
    r = await send({ external_user_id: "z-239i", text: "bán nhà hẻm 4m đường Đặng Văn Ngữ, 4x15, giá 6 tỷ" });
    const pendI = db().t.info_requests.filter((q) => q.status === "pending").map((q) => q.question);
    check("FR239-E3 rao có đường, chưa rõ quận → câu hỏi đầu là phường (kèm quận), không phải diện tích",
      pendI.includes("phuong") && !pendI.includes("dien_tich_dat"), JSON.stringify({ pendI, rep: r.body.replies }));
    globalThis.__model.create = macDinh239;
  }
  // (b) "Chưa xây gì hết em nhà cấp 4" khi đang hỏi kết cấu → tin NHÀ không bị đổi thành đất.
  rnSeed("z-239b", "BDS-Q5-0972", {});
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0972");
    db().t.info_requests = db().t.info_requests.filter((q) => q.listing_id !== l.id);
    db().insert("info_requests", { listing_id: l.id, question: "ket_cau", status: "pending" });
    r = await send({ external_user_id: "z-239b", text: "Chưa xây gì hết em nhà cấp 4" });
    check("FR239-E4 'Chưa xây gì hết em nhà cấp 4' → loại tin KHÔNG thành đất, không có fact loai_bds 'đất trống'",
      !/^dat/.test(l.property_type ?? "") && !db().t.listing_facts.some((f) => f.listing_id === l.id && f.question === "loai_bds" && /đất/.test(f.answer)),
      JSON.stringify({ pt: l.property_type, rep: r.body.replies }));
  }
  // (c) hỏi lại giá / nhắc "cái giá hồi nãy" → nhắc đúng giá đã ghi, không nói phí, không xin lỗi lạc đề.
  rnSeed("z-239c", "BDS-Q5-0973", { price_raw: "8.000.000.000", price_vnd: 8e9 });
  {
    r = await send({ external_user_id: "z-239c", text: "Là bao nhiêu vậy em nhớ không" });
    const cauC = r.body.replies.join(" ");
    check("FR239-E5 'Là bao nhiêu vậy em nhớ không' → trả lời giá 8 tỷ từ tin, không nói phí 1%",
      /8 tỷ/.test(cauC) && !/1%|phí/.test(cauC), JSON.stringify(r.body.replies));
    r = await send({ external_user_id: "z-239c", text: "Cái giá hồi nãy đó" });
    const cauC2 = r.body.replies.join(" ");
    check("FR239-E6 'Cái giá hồi nãy đó' (đang hỏi câu khác) → 'giá … hồi nãy là 8 tỷ, em ghi rồi', hỏi lại câu đang treo, không 'chưa thấy'",
      /hồi nãy là 8 tỷ/.test(cauC2) && !/chưa thấy/.test(cauC2) && /\?/.test(cauC2), JSON.stringify(r.body.replies));
  }
  // (k) đất: trả lời diện tích xong → câu kế là GIÁ (ưu tiên 4), không phải đường / hướng.
  rnSeed("z-239k", "BDS-DAT-0974", { property_type: "dat", price_raw: null, price_vnd: null, area_m2: null, floors: null, bedrooms: null, access_type: null, alley_width_m: null });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-DAT-0974");
    db().t.info_requests = db().t.info_requests.filter((q) => q.listing_id !== l.id);
    db().insert("info_requests", { listing_id: l.id, question: "dien_tich", status: "pending" });
    r = await send({ external_user_id: "z-239k", text: "5x20 em" });
    const pend = db().t.info_requests.filter((q) => q.listing_id === l.id && q.status === "pending").map((q) => q.question);
    check("FR239-E7 đất: sau diện tích hỏi GIÁ ngay (không hỏi đường, hướng trước)", pend.includes("gia"), JSON.stringify({ pend, rep: r.body.replies }));
  }
  // (f) đất thiếu giá mà bảo đăng → "giá cả lô", không "giá cả căn".
  rnSeed("z-239f", "BDS-DAT-0975", { property_type: "dat", price_raw: null, price_vnd: null, floors: null, bedrooms: null });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-DAT-0975");
    db().t.info_requests = db().t.info_requests.filter((q) => q.listing_id !== l.id);
    db().insert("info_requests", { listing_id: l.id, question: "huong", status: "pending" });
    r = await send({ external_user_id: "z-239f", text: "hướng đông. đăng bài được chưa. a bận rồi" });
    const cauF = r.body.replies.join(" ");
    check("FR239-E8 tin đất thiếu giá, bảo đăng → nói thiếu 'giá cả lô', không 'giá cả căn'", /giá cả lô/.test(cauF) && !/cả căn/.test(cauF), JSON.stringify(r.body.replies));
  }
  // (j) phường gõ thường → cột ward viết đúng.
  rnSeed("z-239j", "BDS-Q5-0976", { ward: null });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0976");
    db().t.info_requests = db().t.info_requests.filter((q) => q.listing_id !== l.id);
    db().insert("info_requests", { listing_id: l.id, question: "phuong", status: "pending" });
    r = await send({ external_user_id: "z-239j", text: "phường cầu kho em" });
    check("FR239-E9 'phường cầu kho em' → cột ward 'Phường Cầu Kho' (không 'cầu kho')", l.ward === "Phường Cầu Kho", JSON.stringify({ ward: l.ward, rep: r.body.replies }));
  }
  rnSeed("z-pl2", "BDS-Q5-0952", { deal: "cho_thue" });
  r = await send({ external_user_id: "z-pl2", text: "sổ hồng riêng em" });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0952");
    check("PL229-E4 tin CHO THUÊ → không hỏi người đứng tên / thế chấp / tranh chấp trước bản nháp",
      !db().t.info_requests.some((q) => q.listing_id === l.id && ["nguoi_dung_ten", "the_chap", "tranh_chap", "dien_tich_khop_so"].includes(q.question)),
      JSON.stringify(db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status])));
  }
  // FR-225 a (25/09/2026, chủ dự án test Zalo: khách "nở hậu nhé" → bot bịa "nở hậu 4.5"; "nở hậu nhiu cộng vào diện tích"):
  // nói nở hậu mà chưa có số mét → câu kế hỏi nở hậu bao nhiêu mét.
  rnSeed("z-nh1", "BDS-Q5-0941", { has_completion: true, frontage_m: 5, length_m: 12 });
  r = await send({ external_user_id: "z-nh1", text: "sổ hồng riêng em, nhà nở hậu nha" });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0941");
    check("NOHAU-E1 'nhà nở hậu' chưa có số mét → câu kế là no_hau (hỏi bao nhiêu mét)",
      pend("no_hau", l.id), JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
  }
  rnSeed("z-nh2", "BDS-Q5-0942", { has_completion: true, frontage_m: 5, length_m: 12 });
  r = await send({ external_user_id: "z-nh2", text: "sổ hồng riêng em, nở hậu 6m" });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0942");
    check("NOHAU-E2 'nở hậu 6m' đã có số → không hỏi lại nở hậu",
      !pend("no_hau", l.id), JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
  }
  rnSeed("z-rn2", "BDS-Q5-0932", { rent_income_vnd: 150000000 }, [["hien_trang", "đang cho Sacombank thuê"]]);
  r = await send({ external_user_id: "z-rn2", text: "sổ hồng riêng em" });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0932");
    check("RENHANH-02 'sổ hồng riêng' mà nhà ĐANG CHO THUÊ → KHÔNG hỏi hoàn công (chủ dự án: đang cho thuê là hoàn thiện rồi)",
      !pend("hoan_cong", l.id) && !r.body.replies.some((x) => /hoàn công/.test(x)),
      JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
  }
  rnSeed("z-rn8", "BDS-Q5-0938", { description: "bán nhà mặt tiền Nguyễn Trãi phường 3 quận 5, 4x20, trệt 3 lầu, 4 phòng ngủ, đang cho ngân hàng thuê, giá 25 tỷ" });
  r = await send({ external_user_id: "z-rn8", text: "sổ hồng riêng em" });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0938");
    check("RENHANH-08 'đang cho ngân hàng thuê' chỉ có trong câu rao gốc (không fact) → 'sổ hồng riêng' KHÔNG hỏi hoàn công, hỏi hạn hợp đồng thuê (bắn thật 24/09 rn-test-f)",
      !pend("hoan_cong", l.id) && pend("han_hop_dong_thue", l.id),
      JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
  }
  // Bắn thật 24/09 (rn-test-h): hỏi tiền thuê, khách đáp "150 triệu một tháng em" → luật đọc thành GIÁ BÁN, câu rơi bổ sung
  // (AI tắt thì còn ghi đè giá bán 25 tỷ thành 150 triệu).
  for (const cheDo of ["tat", "chinh"]) {
    const cauHinhCu = globalThis.__cauHinh, parseCu = globalThis.__model.parse;
    globalThis.__cauHinh = { ...(cauHinhCu ?? {}), boc_tach_ai: cheDo };
    if (cheDo === "chinh") globalThis.__model.parse = () => ({ so_can: 0, kien_thuc: [], truong: [] });
    fresh((d) => {
      const s = d.insert("sellers", { zalo_user_id: `z-rn9-${cheDo}`, seller_type: "ccrb", name: null, active_listing_id: null }).data;
      const l = d.insert("listings", { code: `BDS-Q5-09${cheDo === "tat" ? "39" : "40"}`, seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "Nguyễn Trãi", district: "Quận 5", ward: "Phường 3", price_raw: "25 tỷ", price_vnd: 25e9, area_m2: 80, floors: 4, bedrooms: 4, access_type: "mat_tien", legal_status: "so_hong_rieng", can_chu_duyet: true, description: "bán nhà mặt tiền Nguyễn Trãi, đang cho ngân hàng thuê, giá 25 tỷ" }).data;
      d.insert("listing_facts", { listing_id: l.id, question: "han_hop_dong_thue", answer: "tới năm 2030", source: "seller_chat" });
      d.insert("info_requests", { listing_id: l.id, question: "doanh_thu", status: "pending" });
    });
    r = await send({ external_user_id: `z-rn9-${cheDo}`, text: "150 triệu một tháng em" });
    const l = db().t.listings.find((x) => x.code === `BDS-Q5-09${cheDo === "tat" ? "39" : "40"}`);
    const fs9 = db().t.listing_facts.filter((x) => x.listing_id === l.id).map((x) => [x.question, x.answer]);
    check(`RENHANH-09 (${cheDo}) hỏi tiền thuê, đáp '150 triệu một tháng em' → vào ô tiền thuê, GIÁ BÁN vẫn 25 tỷ, không vào bổ sung`,
      fs9.some(([q, a]) => q === "doanh_thu" && /150/.test(a)) && !fs9.some(([q]) => q === "bo_sung" || q === "gia") && Number(l.price_vnd) === 25e9 && !pend("doanh_thu", l.id),
      JSON.stringify({ fs9, price: l.price_vnd, rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
    globalThis.__cauHinh = cauHinhCu; globalThis.__model.parse = parseCu;
  }
  rnSeed("z-rn3", "BDS-Q5-0933");
  r = await send({ external_user_id: "z-rn3", text: "chưa có sổ em, đang chờ ra sổ" });
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0933");
    check("RENHANH-03 'chưa có sổ, đang chờ ra sổ' → câu kế là ý chính đầu của nhánh (giấy tờ đang có), lệnh model có tên nhánh + các ý, KHÔNG hỏi hoàn công",
      pend("giay_to_hien_co", l.id) && !pend("hoan_cong", l.id) && /chưa có sổ/.test(createCalls().at(-1)?.params?.messages?.[0]?.content ?? "") && /dự kiến bao giờ ra sổ/.test(createCalls().at(-1)?.params?.messages?.[0]?.content ?? ""),
      JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
    r = await send({ external_user_id: "z-rn3", text: "vi bằng em" });
    check("RENHANH-06 trả lời ý 1 của nhánh chưa sổ ('vi bằng em') → ghi giấy tờ, hỏi tiếp ý 2 (dự kiến bao giờ ra sổ)",
      db().t.listing_facts.some((x) => x.listing_id === l.id && x.question === "giay_to_hien_co") && pend("du_kien_ra_so", l.id),
      JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
    r = await send({ external_user_id: "z-rn3", text: "cuối năm nay có sổ em" });
    check("RENHANH-07 trả lời ý 2 → nhánh hết ý, không hỏi lại ý nào của nhánh",
      db().t.listing_facts.some((x) => x.listing_id === l.id && x.question === "du_kien_ra_so") && !pend("du_kien_ra_so", l.id) && !pend("giay_to_hien_co", l.id),
      JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
  }
  // FR-223 (bắn thật production 24/09, rn-test-c): chế độ AI `chinh`, AI IM về "chưa có sổ em, đang chờ ra sổ" → luật
  // "AI im = lệch" từng gạt câu vào BỔ SUNG, câu pháp lý treo mãi, nhánh "chưa sổ → bao giờ ra sổ" không chạy.
  {
    const cauHinhCu = globalThis.__cauHinh, parseCu = globalThis.__model.parse;
    globalThis.__cauHinh = { ...(cauHinhCu ?? {}), boc_tach_ai: "chinh" };
    // Model làm đúng lời prompt "viết lại sạch, bỏ từ đệm" → giá trị không còn chữ "em" nên KHÔNG nằm nguyên trong cụm
    // trích → kiểm bằng chứng loại → coi như AI im (đúng hình production).
    globalThis.__model.parse = () => ({ so_can: 0, kien_thuc: [], truong: [{ khoa: "phap_ly", gia_tri: "chưa có sổ, đang chờ ra sổ", trich_dan: "chưa có sổ em, đang chờ ra sổ", can: null }] });
    rnSeed("z-rn5", "BDS-Q5-0935");
    r = await send({ external_user_id: "z-rn5", text: "chưa có sổ em, đang chờ ra sổ" });
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0935");
    const fs5 = db().t.listing_facts.filter((x) => x.listing_id === l.id).map((x) => [x.question, x.answer]);
    check("RENHANH-05 'chinh' + AI im: 'chưa có sổ em, đang chờ ra sổ' → vào ô PHÁP LÝ (giữ chữ khách, không thành sổ hồng), không vào bổ sung, câu kế hỏi tiến độ sổ",
      fs5.some(([q, a]) => q === "phap_ly" && /chưa có sổ/.test(a)) && !fs5.some(([q]) => q === "bo_sung") && l.legal_status !== "so_hong_rieng" &&
        !pend("phap_ly", l.id) && pend("giay_to_hien_co", l.id),
      JSON.stringify({ fs5, legal: l.legal_status, rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
    globalThis.__cauHinh = cauHinhCu; globalThis.__model.parse = parseCu;
  }
  // 24/09/2026 (chủ dự án: "ảnh ko liên quan thì nhận xét luôn bảo à anh có gửi nhầm ảnh ko"): không cất vào tin.
  fresh(seedKho);
  {
    const sA = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
    const tA = db().t.listings.find((l) => l.code === "BDS-Q5-0002");
    sA.active_listing_id = tA.id;
    globalThis.__anh = { loai: "khong_lien_quan", mo_ta: "hình như là tô phở bò", khen: null, giay_to: null };
    r = await send({ external_user_id: "z-ccrb", text: "", image_url: "https://photo-stal-22.zdn.vn/pho.jpg" });
    globalThis.__anh = undefined;
    check("ANHNHAM-01 ảnh không liên quan (tô phở) → hỏi 'có gửi nhầm ảnh không', KHÔNG cất vào tin, không 'Cảm ơn'",
      r.body.replies.some((x) => /gửi nhầm ảnh/.test(x) && /tô phở/.test(x)) && !r.body.replies.some((x) => /Cảm ơn/.test(x)) &&
        !db().t.listing_media.some((m) => m.listing_id === tA.id),
      JSON.stringify({ rep: r.body.replies, media: db().t.listing_media.length }));
    globalThis.__anh = { loai: "san_thuong", mo_ta: "hình như là sân thượng có cây xanh", khen: "sân thượng rộng thoáng", giay_to: null };
    r = await send({ external_user_id: "z-ccrb", text: "", image_url: "https://photo-stal-22.zdn.vn/st.jpg" });
    globalThis.__anh = undefined;
    check("ANHNHAM-02 ảnh sân thượng → cất loại 'san_thuong', bot nói 'ảnh sân thượng' (không phải 'mặt tiền')",
      db().t.listing_media.some((m) => m.listing_id === tA.id && m.media_type === "san_thuong") && r.body.replies.some((x) => /ảnh sân thượng/i.test(x)) && !r.body.replies.some((x) => /mặt tiền/.test(x)),
      JSON.stringify({ rep: r.body.replies, media: db().t.listing_media.map((m) => m.media_type) }));
  }
  // (4) chế độ `chinh`: AI xếp "sổ hồng riêng" vào KIẾN THỨC THÊM (không trả khoá phap_ly) → luật xếp ô pháp lý, câu kế không hỏi lại pháp lý.
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh" };
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
    const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0002");
    sC.active_listing_id = tin.id;
    db().insert("info_requests", { listing_id: tin.id, question: "so_phong_ngu", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p)
      ? { so_can: 0, kien_thuc: ["sổ hồng riêng", "view sông"], truong: [{ khoa: "so_phong_ngu", gia_tri: "3", trich_dan: "3 phòng ngủ", can: null }] }
      : OUT();
    r = await send({ external_user_id: "z-ccrb", text: "3 phòng ngủ, sổ hồng riêng, view sông" });
    const fPl = db().t.listing_facts.find((f) => f.listing_id === tin.id && f.question === "phap_ly");
    const pendMoi = db().t.info_requests.filter((x) => x.listing_id === tin.id && x.status === "pending").map((x) => x.question);
    check("GVA-13 'chinh': AI để 'sổ hồng riêng' ở kiến thức thêm, không trả phap_ly → luật ghi fact phap_ly 'sổ hồng riêng'; câu kế KHÔNG phải pháp lý",
      !!fPl && /sổ hồng riêng/.test(fPl.answer) && !pendMoi.includes("phap_ly") && !/sổ hồng|pháp lý|hợp đồng mua bán/i.test(r.body.replies.join(" ")),
      JSON.stringify({ fPl, pendMoi, rep: r.body.replies }));
  }
  // (3) chế độ `chinh`: tên đường xuất hiện hai lần ("Hung Vuong Plaza 126 Hung Vuong") → địa chỉ lấy lần có số nhà; (6) 🤖 in "giá 4 tỷ 3" dù khách gõ "4 ty 3".
  fresh();
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
  globalThis.__model.parse = (p) => laLuotBocRao(p)
    ? { so_can: 0, kien_thuc: [], truong: [
        { khoa: "duong", gia_tri: "Hùng Vương", trich_dan: "126 Hung Vuong", can: null },
        { khoa: "gia", gia_tri: "4 tỷ 3", trich_dan: "gia 4 ty 3", can: null },
        { khoa: "quan", gia_tri: "Quận 5", trich_dan: "q5", can: null },
      ] } : OUT();
  r = await send({ external_user_id: "gva-14", text: "em la moi gioi ben q5, co can ho Hung Vuong Plaza 126 Hung Vuong p12, tang 15, 2pn 78m2, gia 4 ty 3" });
  {
    const L = db().t.listings[0];
    check("GVA-14 'Hung Vuong Plaza 126 Hung Vuong' + AI 'Hùng Vương' → địa chỉ có SỐ NHÀ '126 Hùng Vương'; 🤖 in 'giá 4 tỷ 3' (đơn vị có dấu) dù DB giữ chữ khách gõ",
      !!L && /126 Hùng Vương/.test(L.location_raw ?? "") && /giá: "4 tỷ 3"/.test(r.body.replies[0] ?? "") && !/4 ty 3/.test(r.body.replies[0] ?? ""),
      JSON.stringify({ loc: L?.location_raw, price: L?.price_raw, rep: r.body.replies }));
  }
  globalThis.__cauHinh = cauHinhCu;
  globalThis.__model = { parse: () => OUT() };
}

// ── 22/09/2026 kịch bản C (bắn thật nhà Trần Bình Trọng, nhiều kiểu sai — 7 lỗi, chủ dự án "vá hết") ──
{
  const cauHinhCu = globalThis.__cauHinh;
  const rep = () => r.body.replies.join(" ");
  const pend = (q, lid) => db().t.info_requests.some((x) => x.question === q && x.status === "pending" && (!lid || x.listing_id === lid));
  const soFact = (lid) => db().t.listing_facts.filter((f) => f.listing_id === lid).length;
  const tinC = () => { const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb"); const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0002"); sC.active_listing_id = tin.id; return tin; };
  // (1) "gia 7 ti 5 chu ko phai 7 ty" — "ti" không dấu là tỷ; giá đổi thật, lời xác nhận đọc "7 tỷ 5".
  fresh(seedKho);
  {
    const tin = tinC();
    db().insert("info_requests", { listing_id: tin.id, question: "ket_cau", status: "pending" });
    r = await send({ external_user_id: "z-ccrb", text: "gia 7 ti 5 chu ko phai 7 ty" });
    check("GVC-01 'gia 7 ti 5 chu ko phai 7 ty' → price_vnd 7,5 tỷ (DB giữ '7 ti 5'), lời xác nhận 'sửa lại giá 7 tỷ 5', câu tầng vẫn treo",
      tin.price_vnd === 7500000000 && tin.price_raw === "7 ti 5" && /sửa lại giá 7 tỷ 5/.test(rep()) && pend("ket_cau", tin.id),
      JSON.stringify({ price: [tin.price_raw, tin.price_vnd], rep: r.body.replies }));
  }
  // (2) "em xoá cái hẻm 4m ghi nhầm đi" lúc chờ duyệt — KHÔNG ghi gì (từng thành địa chỉ + đè hẻm), đọc lại ô đang giữ, câu duyệt treo.
  fresh(seedKho);
  {
    const tin = tinC(); tin.alley_width_m = 3.5; tin.status = "cho_thong_tin";
    db().insert("info_requests", { listing_id: tin.id, question: "duyet_tin", status: "pending" });
    const truoc = soFact(tin.id);
    r = await send({ external_user_id: "z-ccrb", text: "em xoá cái hẻm 4m ghi nhầm đi" });
    check("GVC-02 'em xoá cái hẻm 4m ghi nhầm đi' lúc duyệt → không ghi fact, địa chỉ '99 Nguyễn Trãi' giữ, hẻm 3.5 giữ, đáp 'đang ghi hẻm 3.5m' + nhắc nhắn ok, KHÔNG gửi lại 📋",
      soFact(tin.id) === truoc && tin.location_raw === "99 Nguyễn Trãi" && tin.alley_width_m === 3.5 && /đang ghi hẻm 3.5m/.test(rep()) && /nhắn "ok"/.test(rep()) &&
        !r.body.replies.some((x) => x.startsWith("📋")) && pend("duyet_tin", tin.id) && r.body.xin_bo_truong === "do_rong_hem",
      JSON.stringify({ loc: tin.location_raw, hem: tin.alley_width_m, facts: db().t.listing_facts.filter((f) => f.listing_id === tin.id).map((f) => [f.question, f.answer]), rep: r.body.replies }));
  }
  // (2b) cùng câu khi đang treo câu tầng → đáp rồi hỏi lại câu treo; không ghi gì.
  fresh(seedKho);
  {
    const tin = tinC(); tin.alley_width_m = 3.5;
    db().insert("info_requests", { listing_id: tin.id, question: "ket_cau", status: "pending" });
    const truoc = soFact(tin.id);
    r = await send({ external_user_id: "z-ccrb", text: "bỏ cái hẻm 4m ghi nhầm đi em" });
    check("GVC-02b 'bỏ cái hẻm 4m ghi nhầm đi em' đang treo câu tầng → không ghi fact, hẻm 3.5 giữ, hỏi lại tầng",
      soFact(tin.id) === truoc && tin.alley_width_m === 3.5 && /đang ghi hẻm 3.5m/.test(rep()) && r.body.replies.length === 2 && /tầng|lầu|tấm/i.test(r.body.replies[1]) && pend("ket_cau", tin.id),
      JSON.stringify({ hem: tin.alley_width_m, rep: r.body.replies }));
  }
  // (3) "3pn 2wc" → fact so_wc vào cột bathrooms (20260922c).
  fresh(seedKho);
  {
    const tin = tinC(); tin.bedrooms = null;
    db().insert("info_requests", { listing_id: tin.id, question: "so_phong_ngu", status: "pending" });
    r = await send({ external_user_id: "z-ccrb", text: "3pn 2wc" });
    check("GVC-03 '3pn 2wc' → bedrooms 3 và bathrooms 2 (fact so_wc từng không vào cột)",
      tin.bedrooms === 3 && tin.bathrooms === 2,
      JSON.stringify({ pn: tin.bedrooms, wc: tin.bathrooms, facts: db().t.listing_facts.filter((f) => f.listing_id === tin.id).map((f) => [f.question, f.answer]) }));
  }
  // (4) sửa phường: bong bóng code "Dạ em sửa lại Phường 2 rồi ạ." + model "Phường 2 em sửa lại rồi ạ." → chỉ một lời sửa.
  fresh(seedKho);
  {
    const tin = tinC();
    db().insert("info_requests", { listing_id: tin.id, question: "ket_cau", status: "pending" });
    globalThis.__model.parse = () => OUT({ replies: ["Phường 2 em sửa lại rồi ạ. Nhà mình mấy tầng ạ?"] });
    r = await send({ external_user_id: "z-ccrb", text: "à mà phường 2 chứ không phải phường 3" });
    const soSua = r.body.replies.join("\n").split(/[.!?\n]/).filter((c) => /sửa lại/.test(c)).length;
    check("GVC-04 sửa phường → đúng MỘT câu 'sửa lại' (model lặp 'Phường 2 em sửa lại rồi ạ' bị bỏ), câu hỏi tầng giữ",
      tin.ward === "Phường 2" && soSua === 1 && /mấy tầng/.test(rep()), JSON.stringify(r.body.replies));
    globalThis.__model = { parse: () => OUT() };
  }
  // (5) "bán rồi hả em?" là HỎI, không phải báo bán: đáp từ trạng thái, tin vẫn dang_ban, không gọi model.
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb"); const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0001"); sC.active_listing_id = tin.id;
    globalThis.__model.parse = () => OUT({ replies: ["Chủ nhà bán rồi em chưa biết — để em hỏi chủ nhà xác nhận."] });
    r = await send({ external_user_id: "z-ccrb", text: "bán rồi hả em?" });
    check("GVC-05 'bán rồi hả em?' → 'Dạ chưa bán ạ, tin mình đang lên kệ…' tiền định; tin vẫn dang_ban, không ngưng rao, không câu model",
      r.body.hoi_ve_tin === "ban_chua" && /^Dạ chưa bán ạ/.test(r.body.replies[0] ?? "") && tin.status === "dang_ban" && !r.body.ngung_rao && !/hỏi chủ nhà/.test(rep()),
      JSON.stringify({ st: tin.status, rep: r.body.replies, body: r.body }));
    globalThis.__model = { parse: () => OUT() };
  }
  // (6) 🤖 in "giá 7 tỷ 2" khi khách gõ "7ty2" (đơn vị dính số hai đầu).
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "thay_doi" };
  fresh();
  r = await send({ external_user_id: "gvc-6", text: "ban nha hem 4m 123/4 tran binh trong p2 q5, 4x15 60m2, 7ty2, so hong rieng" });
  {
    const L = db().t.listings[0];
    check("GVC-06 câu rao '7ty2' → DB giữ '7ty2' (7,2 tỷ), 🤖 in 'giá 7 tỷ 2', không in '7ty2'",
      !!L && L.price_vnd === 7200000000 && r.body.replies.some((x) => x.startsWith("🤖") && /giá: "7 tỷ 2"/.test(x) && !/7ty2/.test(x)),
      JSON.stringify({ price: [L?.price_raw, L?.price_vnd], rep: r.body.replies }));
  }
  globalThis.__cauHinh = cauHinhCu;
  // (7) "😂😂" lúc chờ duyệt → câu tiền định, không gọi model, không ghi, câu duyệt treo.
  fresh(seedKho);
  {
    const tin = tinC(); tin.status = "cho_thong_tin";
    db().insert("info_requests", { listing_id: tin.id, question: "duyet_tin", status: "pending" });
    const truoc = soFact(tin.id);
    globalThis.__model.parse = () => OUT({ replies: ["Em thấy anh chị đồng ý rồi ạ. Tin em đăng như vậy được không?"] });
    r = await send({ external_user_id: "z-ccrb", text: "😂😂" });
    check("GVC-07 '😂😂' lúc duyệt → 'Dạ 😊 Bản nháp ở trên … nhắn \"ok\"' tiền định; không ghi fact, không 📋, không 'đồng ý rồi', câu duyệt treo, chưa duyệt",
      r.body.loai_cau === "emoji" && /nhắn "ok"/.test(rep()) && !/đồng ý rồi/.test(rep()) && soFact(tin.id) === truoc && !r.body.replies.some((x) => x.startsWith("📋")) &&
        pend("duyet_tin", tin.id) && !tin.chu_duyet_at,
      JSON.stringify({ rep: r.body.replies, body: r.body }));
    globalThis.__model = { parse: () => OUT() };
  }
  globalThis.__cauHinh = cauHinhCu;
}

// ── 23/09/2026 (Zalo thật): "chào cháu, ông bán nhà Trần Bình Trọg Q5 7 tỷ" → bot "Dạ cháu chào mình ạ!", hỏi "…đúng
// không mình?" — ông/bà chưa có trong danh sách cách gọi (FR-176) ──
{
  fresh();
  const S = (u) => db().t.sellers.find((s) => s.zalo_user_id === u);
  const EM = /(?<![\p{L}])em(?![\p{L}])/iu;
  // "nhà mình" (nhà CỦA KHÁCH) là cụm TONE_RULES cho phép — câu mẫu phường "Nhà mình phường mấy ông nhỉ?" nay luôn đi kèm
  // (SRS-5.1zzo: lời model không hỏi thì nối câu hỏi của ô đã mở); bot TỰ XƯNG "mình" mới là lỗi.
  const MINH = /(?<![\p{L}])(?<!nhà )(?:mình|anh chị|anh\/chị)(?![\p{L}])/iu;
  r = await send({ external_user_id: "ong-1", text: "chào cháu, ông bán nhà Trần Bình Trọg Q5 7 tỷ" });
  const repOng = r.body.replies.join(" ");
  check("XHO-01 'chào cháu, ông bán nhà…' → sellers.xung_ho = ông, nam, lớn tuổi; bot xưng cháu, gọi ông, không 'em' / 'mình' / 'anh chị'",
    S("ong-1")?.xung_ho === "ông" && S("ong-1")?.gioi_tinh === "nam" && S("ong-1")?.nhom_tuoi === "lon_tuoi" &&
      r.body.replies.length > 0 && !EM.test(repOng) && !MINH.test(repOng) && /cháu/i.test(repOng),
    JSON.stringify({ s: S("ong-1"), rep: r.body.replies }));
  r = await send({ external_user_id: "ba-1", text: "bà chào cháu" });
  const repBa = r.body.replies.join(" ");
  check("XHO-02 tin đầu 'bà chào cháu' → 'Dạ cháu chào bà', hỏi 'Bà cần giao bán…', không 'em' / 'anh chị'",
    /cháu chào bà/i.test(repBa) && /Bà /.test(repBa) && !EM.test(repBa) && !/anh chị|anh\/chị/i.test(repBa), JSON.stringify(r.body.replies));
  r = await send({ external_user_id: "thim-1", text: "chào cháu, thím có căn nhà hẻm 4m đường Nguyễn Trãi quận 5 cần bán 6 tỷ" });
  const repThim = r.body.replies.join(" ");
  check("XHO-03 'chào cháu, thím có căn nhà…' → xung_ho = thím, nữ, lớn tuổi; bot xưng cháu, không 'em' / 'mình' / 'anh chị'",
    S("thim-1")?.xung_ho === "thím" && S("thim-1")?.gioi_tinh === "nu" && S("thim-1")?.nhom_tuoi === "lon_tuoi" &&
      r.body.replies.length > 0 && !EM.test(repThim) && !MINH.test(repThim) && /cháu/i.test(repThim),
    JSON.stringify({ s: S("thim-1"), rep: r.body.replies }));
}

// ── 22/09/2026 (chủ dự án: "người ta chào là cô chào cháu nó vẫn đáp anh chị") — FR-176 (c) lời chào ──
{
  const rep = () => r.body.replies.join(" ");
  const sX = (uid) => { const s = db().t.sellers.find((x) => x.zalo_user_id === uid); return s ? [s.xung_ho ?? null, s.nhom_tuoi ?? null] : null; };
  const bX = (uid) => { const b = db().t.buyers.find((x) => x.zalo_user_id === uid); return b ? [b.preferences?.xung_ho ?? null, b.preferences?.nhom_tuoi ?? null, b.preferences?.hoi_vai ?? null] : null; };
  // (1) tin đầu "cô chào cháu" → lời chào gọi cô, xưng cháu, không "anh chị"; hồ sơ mua nhớ "cô".
  fresh();
  r = await send({ external_user_id: "gvd-1", text: "cô chào cháu" });
  check("GVD-01 tin đầu 'cô chào cháu' → 'Dạ cháu chào cô…', hỏi 'Cô cần giao bán bất động sản đúng không ạ?', không 'anh chị' / 'em'; prefs xung_ho = cô",
    /^Dạ cháu chào cô/.test(r.body.replies[0] ?? "") && /Cô cần giao bán bất động sản đúng không ạ\?/.test(rep()) && !/anh chị|anh\/chị/i.test(rep()) && !/(?<![\p{L}])em(?![\p{L}])/u.test(rep()) && bX("gvd-1")?.[0] === "cô",
    JSON.stringify({ rep: r.body.replies, b: bX("gvd-1") }));
  // (2) lượt sau mở hồ sơ bán → cách gọi đi theo: xưng cháu, gọi cô ở bong bóng ghi nhận.
  r = await send({ external_user_id: "gvd-1", text: "cô có căn nhà muốn bán, hẻm 4m Nguyễn Trãi q5, 60m2" });
  check("GVD-02 'cô có căn nhà muốn bán…' sau lời chào → hồ sơ bán xung_ho = cô, nhom_tuoi lon_tuoi; 📝 'Cháu ghi nhận', 'cô nhắn lại giúp cháu'",
    r.body.role === "seller" && JSON.stringify(sX("gvd-1")) === JSON.stringify(["cô", "lon_tuoi"]) && /Cháu ghi nhận/.test(rep()) && JSON.stringify(createCalls().at(-1)?.params ?? {}).includes('Gọi chủ nhà là \\"cô\\"') && !/Sai chỗ nào/.test(rep()),
    JSON.stringify({ rep: r.body.replies, s: sX("gvd-1") }));
  // (3) "chào cháu" trơ → biết lớn tuổi, chưa biết chú/cô: xưng cháu, gọi "mình", hỏi "cháu gọi chú hay cô".
  fresh();
  r = await send({ external_user_id: "gvd-3", text: "chào cháu" });
  check("GVD-03 tin đầu 'chào cháu' → 'Dạ cháu chào ạ…', 'Cô chú cần giao bán…', + 'Cháu gọi chú hay cô cho tiện ạ?'; prefs nhom_tuoi lon_tuoi, xung_ho trống",
    /^Dạ cháu chào ạ/.test(r.body.replies[0] ?? "") && /Cô chú cần giao bán bất động sản/.test(rep()) && /Cháu gọi chú hay cô/.test(rep()) && !/anh chị/i.test(rep()) && JSON.stringify(bX("gvd-3")) === JSON.stringify([null, "lon_tuoi", true]),
    JSON.stringify({ rep: r.body.replies, b: bX("gvd-3") }));
  // (4) trả lời "cô" trơ → ghi cách gọi, hỏi lại vai, cờ hỏi vai giữ.
  r = await send({ external_user_id: "gvd-3", text: "cô" });
  check("GVD-04 'cô' trơ sau câu 'gọi chú hay cô' → 'Dạ cô. Cô cần giao bán…', prefs xung_ho = cô, hoi_vai vẫn giữ",
    /^Dạ cô\. Cô cần giao bán bất động sản đúng không ạ\?/.test(r.body.replies[0] ?? "") && bX("gvd-3")?.[0] === "cô" && bX("gvd-3")?.[2] === true,
    JSON.stringify({ rep: r.body.replies, b: bX("gvd-3") }));
  // (5) rồi câu rao KHÔNG xưng → hồ sơ bán vẫn mang "cô" từ hồ sơ mua.
  r = await send({ external_user_id: "gvd-3", text: "bán nhà hẻm 4m Nguyễn Trãi q5, 60m2, 7 tỷ" });
  check("GVD-05 câu rao không xưng sau 'cô' → sellers.xung_ho = cô (mang từ hồ sơ mua), bong bóng gọi cô xưng cháu",
    r.body.role === "seller" && sX("gvd-3")?.[0] === "cô" && JSON.stringify(createCalls().at(-1)?.params ?? {}).includes('Gọi chủ nhà là \\"cô\\"') && /Cháu ghi nhận/.test(rep()), JSON.stringify({ rep: r.body.replies, s: sX("gvd-3") }));
  // (6) "chào cháu" rồi câu rao ngay, không bao giờ xưng → xưng cháu, gọi "mình", KHÔNG "anh chị".
  fresh();
  r = await send({ external_user_id: "gvd-6", text: "chào cháu" });
  // 25/09/2026: câu mock hỏi đúng khoá code chọn (phường) — hỏi "mấy tầng" giờ bị lưới lệch-khoá thay bằng câu mẫu.
  globalThis.__model.create = () => "Nhà mình ở phường mấy vậy anh chị?";
  r = await send({ external_user_id: "gvd-6", text: "bán nhà hẻm 4m Nguyễn Trãi q5, 60m2, 7 tỷ" });
  globalThis.__model.create = undefined;
  check("GVD-06 'chào cháu' → câu rao không xưng → sellers.nhom_tuoi lon_tuoi, xung_ho trống; 📝 'Cháu ghi nhận', model 'anh chị?' → 'cô chú', không 'anh chị'",
    r.body.role === "seller" && JSON.stringify(sX("gvd-6")) === JSON.stringify([null, "lon_tuoi"]) && /Cháu ghi nhận/.test(rep()) && /vậy cô chú\?/.test(rep()) && !/anh chị|anh\/chị/i.test(rep()),
    JSON.stringify({ rep: r.body.replies, s: sX("gvd-6") }));
  // (7) chủ nhà đã có tin, đang treo câu tầng, nhắn "cô chào cháu" → nhận "cô", không ghi fact, câu tầng treo.
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb"); const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0002"); sC.active_listing_id = tin.id;
    db().insert("info_requests", { listing_id: tin.id, question: "ket_cau", status: "pending" });
    const truoc = db().t.listing_facts.filter((f) => f.listing_id === tin.id).length;
    r = await send({ external_user_id: "z-ccrb", text: "cô chào cháu" });
    check("GVD-07 chủ nhà có tin nhắn 'cô chào cháu' → xung_ho = cô, không ghi fact, thôi câu kết cấu (không hỏi lại), bot xưng cháu",
      sC.xung_ho === "cô" && db().t.listing_facts.filter((f) => f.listing_id === tin.id).length === truoc &&
        !db().t.info_requests.some((x) => x.listing_id === tin.id && x.question === "ket_cau" && x.status === "pending") && !/(?<![\p{L}])em(?![\p{L}])/u.test(rep()),
      JSON.stringify({ rep: r.body.replies, xh: sC.xung_ho, facts: db().t.listing_facts.filter((f) => f.listing_id === tin.id).map((f) => [f.question, f.answer]) }));
  }
  // (8) khách MUA là chú → bong bóng nhánh mua xưng cháu.
  fresh();
  globalThis.__model.parse = () => OUT({ replies: ["Dạ em ghi nhận rồi ạ, chú tìm khu nào ạ?"] });
  r = await send({ external_user_id: "gvd-8", text: "chú chào cháu, chú muốn mua nhà q5 tầm 5 tỷ" });
  check("GVD-08 khách mua 'chú chào cháu, chú muốn mua…' → prefs xung_ho chú, bong bóng 'Dạ cháu ghi nhận…' (em → cháu ở nhánh mua)",
    bX("gvd-8")?.[0] === "chú" && /Dạ cháu ghi nhận/.test(rep()) && !/(?<![\p{L}])em(?![\p{L}])/u.test(rep()), JSON.stringify({ rep: r.body.replies, b: bX("gvd-8") }));
  globalThis.__model = { parse: () => OUT() };
}

// ── 22/09/2026 kịch bản D + E (bắn thật: cô lớn tuổi mặt tiền Trần Bình Trọng; môi giới hai căn) — 12 lỗi, "vá hết" ──
{
  const rep = () => r.body.replies.join(" ");
  const cauHinhCu = globalThis.__cauHinh;
  const laLuotBocRao = (p) => (p?.system ?? []).some((s) => /BÓC TÁCH TIN NHẮN NGƯỜI BÁN/.test(s.text ?? ""));
  const pendQ = () => db().t.info_requests.filter((x) => x.status === "pending").map((x) => x.question);
  const seedDA = (d) => d.insert("projects", { name: "Hùng Vương Plaza", district: "Quận 5", location_raw: "126 Hùng Vương, P12", priority: 50 });
  // D: chính chủ lớn tuổi, mặt tiền.
  fresh(seedDA);
  r = await send({ external_user_id: "gve-d", text: "Cô chào cháu, cô có căn nhà mặt tiền Trần Bình Trọng phường 1 quận 5 muốn bán" });
  r = await send({ external_user_id: "gve-d", text: "ngang 4 dài 20, nở hậu 4m5" });
  {
    const L = db().t.listings[0];
    check("GVE-01 'ngang 4 dài 20, nở hậu 4m5' → 80m², rear_width_m 4.5 (fact no_hau '4.5m')",
      L.area_m2 === 80 && L.rear_width_m === 4.5 && db().t.listing_facts.some((f) => f.question === "no_hau" && f.answer === "4.5m"),
      JSON.stringify({ area: L.area_m2, rear: L.rear_width_m, facts: db().t.listing_facts.map((f) => [f.question, f.answer]) }));
  }
  r = await send({ external_user_id: "gve-d", text: "giá 25 tỉ, thương lượng chút" });
  r = await send({ external_user_id: "gve-d", text: "nhà cô đang cho thuê 30 triệu/tháng, khách mua có phải giữ hợp đồng thuê không cháu?" });
  {
    const L = db().t.listings[0];
    check("GVE-02 'đang cho thuê 30 triệu/tháng, … không cháu?' → fact doanh_thu '30 triệu/tháng', rent_income_vnd 30 triệu, câu hỏi ngược tách ra",
      L.rent_income_vnd === 30000000 && db().t.listing_facts.some((f) => f.question === "doanh_thu" && f.answer === "30 triệu/tháng") && /giữ hợp đồng/.test(r.body.hoi_nguoc ?? ""),
      JSON.stringify({ rent: L.rent_income_vnd, hn: r.body.hoi_nguoc, facts: db().t.listing_facts.map((f) => [f.question, f.answer]) }));
  }
  r = await send({ external_user_id: "gve-d", text: "số cô là 0903123456, cháu đừng đăng số của cô lên mạng nhé, ai hỏi thì cháu nhắn cô" });
  {
    const s = db().t.sellers.find((x) => x.zalo_user_id === "gve-d");
    check("GVE-03 gửi SĐT + dặn đừng đăng → sellers.phone lưu, đáp 'không đăng số lên web', SĐT KHÔNG vào fact/bo_sung, câu treo nhắc lại",
      s.phone === "0903123456" && r.body.sdt_luu === true && /không đăng số lên web/.test(rep()) && !db().t.listing_facts.some((f) => /0903/.test(String(f.answer))) && !/0903/.test(rep()) && r.body.replies.length === 2,
      JSON.stringify({ phone: s.phone, rep: r.body.replies }));
  }
  r = await send({ external_user_id: "gve-d", text: "à mà giá 24 tỷ 5 thôi cháu" });
  check("GVE-04 'giá 24 tỷ 5 thôi cháu' → xác nhận 'sửa lại giá 24 tỷ 5 rồi ạ' không kèm 'thôi'", /sửa lại giá 24 tỷ 5 rồi ạ/.test(rep()) && !/5 thôi/.test(rep()), JSON.stringify(r.body.replies));
  // E: môi giới hai căn, căn 2 chung cư có dự án.
  fresh(seedDA);
  r = await send({ external_user_id: "gve-e", text: "e là môi giới, có 2 căn: căn 1 hẻm 3m Trần Hưng Đạo p2 q5 4x12 5 tỷ 5, căn 2 chung cư Hùng Vương Plaza 78m2 tầng 15 4 tỷ 3" });
  {
    const [c1, c2] = db().t.listings;
    check("GVE-05 căn 2 'chung cư Hùng Vương Plaza 78m2 tầng 15' → chung_cu, gắn dự án, địa chỉ từ dự án, tầng 15; căn 1 nhà phố hẻm 3m",
      db().t.listings.length === 2 && c1.property_type === "nha_pho" && /Trần Hưng Đạo/.test(c1.location_raw ?? "") && c2.property_type === "chung_cu" && !!c2.project_id && /Hùng Vương Plaza/.test(c2.location_raw ?? "") && c2.floor === 15 && /Hùng Vương Plaza/.test(rep()),
      JSON.stringify(db().t.listings.map((l) => [l.code, l.property_type, l.location_raw, !!l.project_id, l.floor])));
    check("GVE-06 chưa biết cách gọi → câu hỏi không kết bằng 'anh?'/'chị?' và không 'anh/ạ' (giữ 'anh chị')", !/(?<![\p{L}\/])(anh|chị)\s*[?]/u.test(rep().replace(/anh chị/g, "")) && !/anh\/ạ/.test(rep()), rep());
  }
  // Nhánh bán gọi model bằng `messages.create` (chữ) → mock qua `__model.create`.
  globalThis.__model = { parse: () => OUT(), create: () => "Dạ em ghi nhận rồi. Căn 1 xây mấy tầng vậy anh?" };
  r = await send({ external_user_id: "gve-e", text: "bên em thu phí sao? tui là sale nha, ko phải chủ" });
  check("GVE-07 'bên em thu phí sao? tui là sale nha, ko phải chủ' → phí 0,5%, KHÔNG ghi bo_sung 'ko phải chủ', model 'vậy anh?' → 'vậy ạ?'",
    /0,5% giá chốt/.test(rep()) && !db().t.listing_facts.some((f) => f.question === "bo_sung") && /vậy ạ\?/.test(rep()) && !/vậy anh\?/.test(rep()),
    JSON.stringify({ rep: r.body.replies, bs: db().t.listing_facts.filter((f) => f.question === "bo_sung").map((f) => f.answer) }));
  globalThis.__model = { parse: () => OUT() };
  r = await send({ external_user_id: "gve-e", text: "khách nào hỏi thì cho tui số của họ nha, tui tự liên hệ chốt" });
  check("GVE-08 'cho tui số của khách' → 'khách mua bên em không để lại số', không gật, câu treo nhắc lại",
    r.body.xin_so_khach === true && /không để lại số/.test(rep()) && !/tự liên hệ khách rồi/.test(rep()), JSON.stringify(r.body.replies));
  r = await send({ external_user_id: "gve-e", text: "căn 1 bán rồi nha, còn căn 2 thôi" });
  {
    const [c1, c2] = db().t.listings;
    check("GVE-09 'căn 1 bán rồi, còn căn 2' → CĂN 1 (mở trước) da_chot, căn 2 còn nguyên, câu chúc nêu 'hẻm 3m Trần Hưng Đạo'",
      c1.status === "da_chot" && c2.status !== "da_chot" && /Trần Hưng Đạo/.test(rep()) && !/căn căn/.test(rep()), JSON.stringify({ st: [c1.status, c2.status], rep: r.body.replies }));
  }
  r = await send({ external_user_id: "gve-e", text: "mở lại căn 1 đi em, nó chưa bán" });
  {
    const [c1] = db().t.listings;
    check("GVE-10 câu chấm điểm đang treo, 'mở lại căn 1 đi, nó chưa bán' → KHÔNG thành điểm, câu điểm thôi (expired), tin mở lại",
      r.body.rao_lai === c1.code && c1.status !== "da_chot" && !db().t.listing_facts.some((f) => f.question === "danh_gia") && !pendQ().includes("danh_gia") && /mở lại tin/.test(rep()),
      JSON.stringify({ st: c1.status, rep: r.body.replies, pend: pendQ(), facts: db().t.listing_facts.filter((f) => f.question === "danh_gia") }));
  }
  r = await send({ external_user_id: "gve-e", text: "rao lại căn chung cư đi em" });
  check("GVE-10b 'rao lại căn chung cư' khi căn đó đang rao → không thấy tin gỡ, đáp thật", r.body.rao_lai === null && /không thấy tin nào/.test(rep()), JSON.stringify(r.body.replies));
  // chấm điểm + xin xoá trong cùng câu, khi câu điểm đang treo
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb"); const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0001"); sC.active_listing_id = tin.id;
    tin.status = "da_chot"; db().insert("info_requests", { listing_id: tin.id, question: "danh_gia", status: "pending" });
    r = await send({ external_user_id: "z-ccrb", text: "8 điểm. mà xoá căn này khỏi hệ thống của tui đi" });
    check("GVE-11 '8 điểm. mà xoá căn này khỏi hệ thống' → ghi điểm 8, 'cảm ơn … 8 điểm' + 'xoá … em không tự làm được', KHÔNG 'chỗ nào ghi nhầm'",
      db().t.listing_facts.some((f) => f.question === "danh_gia") && /8 điểm/.test(rep()) && /không tự làm được/.test(rep()) && !/ghi nhầm/.test(rep()), JSON.stringify(r.body.replies));
  }
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb"); const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0001"); sC.active_listing_id = tin.id;
    r = await send({ external_user_id: "z-ccrb", text: "xoá căn này khỏi hệ thống của tui đi" });
    check("GVE-11b 'xoá căn này khỏi hệ thống' không câu treo → nói thật không tự xoá được, không 'ghi nhầm', không ghi fact",
      r.body.xin_xoa_du_lieu === true && /không tự làm được/.test(rep()) && !db().t.listing_facts.some((f) => f.listing_id === tin.id), JSON.stringify(r.body.replies));
  }
  // chế độ `chinh`: AI im về nở hậu / thế chấp → luật ghi (bằng chứng rõ).
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh" };
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb"); const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0002"); sC.active_listing_id = tin.id;
    db().insert("info_requests", { listing_id: tin.id, question: "so_phong_ngu", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p)
      ? { so_can: 0, kien_thuc: [], truong: [{ khoa: "so_phong_ngu", gia_tri: "3", trich_dan: "3 phòng ngủ", can: null }] }
      : OUT();
    r = await send({ external_user_id: "z-ccrb", text: "3 phòng ngủ, nở hậu 4m5, đang thế chấp ngân hàng" });
    check("GVE-12 'chinh': AI chỉ trả phòng ngủ, im về nở hậu + thế chấp (không cả trong kiến thức thêm) → luật ghi no_hau 4.5m và the_chap (bằng chứng rõ trong chữ khách)",
      db().t.listing_facts.some((f) => f.listing_id === tin.id && f.question === "no_hau" && f.answer === "4.5m") && db().t.listing_facts.some((f) => f.listing_id === tin.id && f.question === "the_chap"),
      JSON.stringify(db().t.listing_facts.filter((f) => f.listing_id === tin.id).map((f) => [f.question, f.answer, f.source])));
  }
  // (bắn lại D sau deploy #191, chế độ `chinh`): đang hỏi GIÁ, chủ nhà nói dòng tiền + thế chấp + nở hậu, AI im hết →
  // trước: cả câu về bo_sung; nay luật ghi ba fact có bằng chứng rõ, câu giá vẫn treo.
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb"); const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0002"); sC.active_listing_id = tin.id;
    tin.price_raw = null; tin.price_vnd = null;
    db().insert("info_requests", { listing_id: tin.id, question: "gia", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: ["đang thế chấp ngân hàng"], truong: [] } : OUT();
    r = await send({ external_user_id: "z-ccrb", text: "nhà cô đang cho thuê 30 triệu/tháng, đang thế chấp ngân hàng, nở hậu 4m5 nha cháu" });
    const fq = db().t.listing_facts.filter((f) => f.listing_id === tin.id).map((f) => f.question);
    check("GVE-13 'chinh' đang hỏi giá, AI im: 'đang cho thuê 30tr/tháng, đang thế chấp, nở hậu 4m5' → doanh_thu + the_chap + no_hau (rent 30tr, rear 4.5), KHÔNG bo_sung cả câu, thôi câu giá (không hỏi lại)",
      fq.includes("doanh_thu") && fq.includes("the_chap") && fq.includes("no_hau") && tin.rent_income_vnd === 30000000 && tin.rear_width_m === 4.5 &&
        !db().t.listing_facts.some((f) => f.listing_id === tin.id && f.question === "bo_sung" && /cho thuê/.test(f.answer)) && !pendQ().includes("gia"),
      JSON.stringify({ facts: db().t.listing_facts.filter((f) => f.listing_id === tin.id).map((f) => [f.question, f.answer, f.source]), rent: tin.rent_income_vnd, rear: tin.rear_width_m, pend: pendQ() }));
  }
  // 24/09/2026 (chủ dự án test Zalo): "4x14, trệt 1 lầu" khi hỏi diện tích, AI chỉ trả diện tích → kết cấu rơi mất.
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb"); const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0002"); sC.active_listing_id = tin.id;
    db().insert("info_requests", { listing_id: tin.id, question: "dien_tich_dat", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p)
      ? { so_can: 0, kien_thuc: [], truong: [{ khoa: "dien_tich", gia_tri: "4x14", trich_dan: "4x14", can: null }] }
      : OUT();
    r = await send({ external_user_id: "z-ccrb", text: "4x14, trệt 1 lầu" });
    const kc = db().t.listing_facts.filter((f) => f.listing_id === tin.id && f.question === "ket_cau").map((f) => f.answer);
    check("KETCAU-01 'chinh': '4x14, trệt 1 lầu' khi hỏi diện tích, AI chỉ trả diện tích → luật vẫn ghi kết cấu 'trệt 1 lầu'",
      kc.includes("trệt 1 lầu"), JSON.stringify(db().t.listing_facts.filter((f) => f.listing_id === tin.id).map((f) => [f.question, f.answer, f.source])));
  }
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb"); const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0002"); sC.active_listing_id = tin.id;
    db().insert("info_requests", { listing_id: tin.id, question: "dien_tich_dat", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p)
      ? { so_can: 0, kien_thuc: [], truong: [{ khoa: "dien_tich", gia_tri: "4x14", trich_dan: "4x14", can: null }] }
      : OUT();
    r = await send({ external_user_id: "z-ccrb", text: "4x14, đất này được xây 5 tầng" });
    check("KETCAU-02 'chinh': 'được xây 5 tầng' là GIẢ ĐỊNH → luật KHÔNG ghi kết cấu thay AI",
      !db().t.listing_facts.some((f) => f.listing_id === tin.id && f.question === "ket_cau"), JSON.stringify(db().t.listing_facts.filter((f) => f.listing_id === tin.id).map((f) => [f.question, f.answer])));
  }
  globalThis.__cauHinh = cauHinhCu;
  globalThis.__model = { parse: () => OUT() };
}

// ── 23/09/2026 bắn 26 tin kịch bản bán/mua (căn Trần Bình Trọng) — 9 lỗi, "vá hết đi, kèm e2e" ──
{
  const rep = () => r.body.replies.join(" ");
  const seedEver = (d) => d.insert("projects", { name: "The EverRich Infinity", district: "Quận 5", ward: "Phường 4", location_raw: "290 An Dương Vương", priority: 50 });
  const buyerCo = (d, uid, pr = {}) => { const b = d.insert("buyers", { zalo_user_id: uid, name: null, preferences: { deal: "ban", area: "Quận 5", budget: "tầm 6 tỷ", ...pr } }).data; d.insert("conversations", { buyer_id: b.id, channel: "zalo_personal_test", started_at: "2026-09-01T00:00:00Z" }); return b; };
  const quanTam = (d, b, code) => d.insert("interests", { buyer_id: b.id, listing_id: d.t.listings.find((l) => l.code === code).id, created_at: new Date().toISOString() });
  const promptMua = () => JSON.stringify(parseCalls().slice(-1).map((c) => c.params));
  // (2) "chưa có sổ" không thành có sổ.
  fresh();
  r = await send({ external_user_id: "gvf-2", text: "nhượng lại căn chung cư mini đường Nguyễn Trãi q5, 35m2, 1pn, chưa có sổ, giá 1 tỏi 350" });
  {
    const L = db().t.listings[0];
    check("GVF-01 'chưa có sổ' → legal_status KHÔNG phải so_hong, bong bóng không nói 'có sổ'",
      !!L && !L.legal_status && !/· có sổ|sổ hồng/.test(rep()), JSON.stringify({ ls: L?.legal_status, rep: r.body.replies, facts: db().t.listing_facts.map((f) => [f.question, f.answer]) }));
  }
  // (6) môi giới rao 2 căn "căn A …, căn B …" chung dự án.
  fresh(seedEver);
  r = await send({ external_user_id: "gvf-6", text: "Sale bên em đang giữ 2 căn hộ The Everrich Infinity q5: căn A 1pn 52m2 giá 4.8 tỷ, căn B 2pn 80m2 giá 7 tỷ 1, full nội thất, sổ hồng lâu dài" });
  {
    const ls = db().t.listings;
    check("GVF-02 'căn A …, căn B …' → mở 2 tin, CẢ HAI là căn hộ gắn dự án EverRich, Quận 5; căn B 80m2 giá 7 tỷ 1",
      ls.length === 2 && ls.every((l) => l.property_type === "chung_cu" && !!l.project_id && l.district === "Quận 5") && ls[1].area_m2 === 80 && /7 tỷ 1/.test(ls[1].price_raw ?? ""),
      JSON.stringify(ls.map((l) => [l.code, l.property_type, !!l.project_id, l.district, l.area_m2, l.price_raw])));
    check("GVF-02b bong bóng mở nhiều tin KHÔNG còn câu 'Sai chỗ nào … nhắn lại' (chủ dự án 23/09)", !/Sai chỗ nào|nhắn lại giúp/.test(rep()), JSON.stringify(r.body.replies));
    check("GVF-03 mảnh chung 'full nội thất' ghi cho CẢ HAI căn",
      ls.length === 2 && ls.every((l) => db().t.listing_facts.some((f) => f.listing_id === l.id && f.question === "noi_that")),
      JSON.stringify(db().t.listing_facts.map((f) => [f.listing_id === ls[0]?.id ? "A" : "B", f.question, f.answer])));
  }
  // (6b) một căn hộ đã rao, "còn căn B … nữa" → kế thừa loại, quận, dự án.
  fresh(seedEver);
  r = await send({ external_user_id: "gvf-6b", text: "bán căn hộ The Everrich Infinity quận 5, 1pn 52m2, giá 4.8 tỷ" });
  r = await send({ external_user_id: "gvf-6b", text: "còn căn B 2pn 80m2 giá 7 tỷ 1 nữa em ơi, em lưu chưa" });
  {
    const ls = db().t.listings;
    const B = ls[1];
    check("GVF-04 'còn căn B … nữa' → tin mới kế thừa căn hộ + Quận 5 + dự án của tin trước (không '(chưa rõ quận)')",
      ls.length === 2 && B.property_type === "chung_cu" && B.district === "Quận 5" && B.project_id === ls[0].project_id && !!B.project_id && !/chưa rõ quận/.test(rep()),
      JSON.stringify({ ls: ls.map((l) => [l.code, l.property_type, l.district, !!l.project_id]), rep: r.body.replies }));
  }
  // (4) khách mua đủ khu vực + giá NGAY TIN ĐẦU → kho được lọc ngay lượt này.
  fresh(seedKho);
  globalThis.__model.parse = () => OUT({ replies: ["Dạ có căn #BDS-Q5-0001 hợp anh nè"] });
  r = await send({ external_user_id: "gvf-4", text: "anh cần mua nhà phường 4 quận 5 tầm 6 tỷ, 2 phòng ngủ" });
  check("GVF-05 tin đầu 'phường 4 quận 5 tầm 6 tỷ, 2 phòng ngủ' → KHO gửi model có căn #BDS-Q5-0001 ngay lượt đầu",
    /KHO HIỆN CÓ \(.*?\):\\n#BDS-Q5-0001/.test(promptMua()), promptMua().split("KHO HIỆN CÓ")[1]?.slice(0, 200));
  // (5c) chưa đủ tiêu chí + kho chưa lọc: không hứa "lọc kho rồi báo", xin đúng thứ còn thiếu.
  fresh();
  globalThis.__model.parse = () => OUT({ replies: ["Dạ em tìm kiếm liền ạ"] });
  r = await send({ external_user_id: "gvf-5c", text: "anh cần tìm mua nhà quận 5" });
  check("GVF-06 chưa có giá, kho chưa lọc, model 'Dạ em tìm kiếm liền ạ' → thay bằng 'cho em xin thêm tầm giá', không hứa lọc kho",
    /xin thêm tầm giá/.test(rep()) && !/tìm kiếm liền|lọc kho/.test(rep()), JSON.stringify(r.body.replies));
  // (1) bịa hướng + quy hoạch cho căn vừa giới thiệu (khách hỏi tiếp, KHÔNG nhắc mã).
  fresh((d) => { seedKho(d); const b = buyerCo(d, "gvf-1"); quanTam(d, b, "BDS-Q5-0001"); });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ căn này hướng Đông, thoáng và sáng lắm ạ. Chưa có quy hoạch gì, để em xác nhận lại chủ nhà rồi báo chính xác cho mình nhé"] });
  r = await send({ external_user_id: "gvf-1", text: "nha huong gi e, co dinh quy hoach gi ko" });
  {
    const ir = db().t.info_requests.filter((x) => x.source === "buyer_ask");
    check("GVF-07 hỏi tiếp không nhắc mã → căn quan tâm gần nhất vào khối 'căn khách nhắc' (model thấy #BDS-Q5-0001 kèm tình trạng hình)",
      /BDS-Q5-0001[^"]*(?:chưa có hình sẵn|HÌNH SẴN)/.test(promptMua()), promptMua().slice(0, 300));
    check("GVF-08 model bịa 'hướng Đông' + 'chưa có quy hoạch' (kho không có) → bỏ, nói 'chưa có thông tin chắc chắn', mở ask_owner cho căn 0001",
      !/hướng Đông|Chưa có quy hoạch/.test(rep()) && /chưa có thông tin chắc chắn/.test(rep()) && ir.length === 1 && ir[0].listing_id === db().t.listings.find((l) => l.code === "BDS-Q5-0001").id,
      JSON.stringify({ rep: r.body.replies, ir }));
  }
  // Model tự điền ask_owner SAI ("hướng nhà") khi khách hỏi năm xây và bịa "xây năm 2018" → câu hỏi chủ là "năm xây".
  fresh((d) => { seedKho(d); const b = buyerCo(d, "gvf-1b"); quanTam(d, b, "BDS-Q5-0001"); });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ nhà xây năm 2018 ạ."], ask_owner: { listing_code: "BDS-Q5-0001", question: "hướng nhà (hướng đông/tây/nam/bắc)" } });
  r = await send({ external_user_id: "gvf-1b", text: "nha do xay nam nao vay e" });
  {
    const ir = db().t.info_requests.filter((x) => x.source === "buyer_ask");
    check("GVF-08b model bịa 'xây năm 2018' + tự điền ask_owner sai 'hướng nhà' → bỏ câu bịa, câu hỏi chủ là 'năm xây'",
      !/2018/.test(rep()) && ir.length === 1 && ir[0].question === "năm xây", JSON.stringify({ rep: r.body.replies, ir }));
  }
  // (5b) "để em hỏi lại chủ về giá" mà model không mở ask_owner → code mở.
  fresh((d) => { seedKho(d); const b = buyerCo(d, "gvf-5b"); quanTam(d, b, "BDS-Q5-0001"); });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ hẻm 6m xe hơi vào tận cửa ạ.", "Về giá, để em hỏi lại chủ nhà rồi báo anh liền."] });
  r = await send({ external_user_id: "gvf-5b", text: "hẻm đó rộng bao nhiêu, xe hơi vào tận cửa không em? giá còn bớt được không?" });
  check("GVF-09 lời hứa 'hỏi lại chủ nhà' không kèm ask_owner → code mở info_requests buyer_ask cho căn đang nói",
    db().t.info_requests.some((x) => x.source === "buyer_ask" && x.listing_id === db().t.listings.find((l) => l.code === "BDS-Q5-0001").id),
    JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests }));
  // (5a) căn 0 ảnh mà model hứa gửi hình.
  fresh((d) => { seedKho(d); buyerCo(d, "gvf-5a"); });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ em có căn 12 Trần Hưng Đạo P4, 2 phòng ngủ, 5,8 tỷ ạ", "Em gửi hình liền đây :)"] });
  r = await send({ external_user_id: "gvf-5a", text: "có căn nào quận 5 tầm 6 tỷ không em" });
  // 30/09/2026: khách KHÔNG xin hình → chỉ bỏ câu hứa, không chèn "chủ nhà chưa gửi hình" (câu khách không hỏi).
  check("GVF-10 căn không có ảnh, khách không xin hình, model 'Em gửi hình liền đây' → bỏ câu hứa, không chèn 'chưa gửi hình', không gửi ảnh",
    !/gửi hình liền/.test(rep()) && !/chưa gửi hình/.test(rep()) && /Trần Hưng Đạo/.test(rep()) && !(r.body.photos ?? []).length, JSON.stringify(r.body));
  fresh((d) => { seedKho(d); const b = buyerCo(d, "gvf-5c"); quanTam(d, b, "BDS-Q5-0001"); });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ em gửi hình liền cho mình nha."] });
  r = await send({ external_user_id: "gvf-5c", text: "cho anh xem hình căn đó đi em" });
  check("GVF-10b khách XIN hình, căn 0 ảnh → vẫn nói thật 'chủ nhà chưa gửi hình', không hứa gửi",
    !/gửi hình liền/.test(rep()) && /chưa gửi hình/.test(rep()) && !(r.body.photos ?? []).length, JSON.stringify(r.body.replies));
  // (7) khách là chú, model tự xưng "chú ghi nhớ".
  fresh((d) => buyerCo(d, "gvf-7", { xung_ho: "chú", nhom_tuoi: "lon_tuoi" }));
  globalThis.__model.parse = () => OUT({ replies: ["Dạ, chú ghi nhớ rồi ạ."] });
  r = await send({ external_user_id: "gvf-7", text: "chú muốn ở gần chợ An Đông cháu nhé" });
  check("GVF-11 khách là chú, model 'Dạ, chú ghi nhớ rồi ạ' → 'Dạ, cháu ghi nhớ rồi ạ'", /Dạ, cháu ghi nhớ rồi ạ/.test(rep()) && !/chú ghi nhớ/.test(rep()), JSON.stringify(r.body.replies));
  // (8b) đoán phường của địa danh.
  fresh((d) => buyerCo(d, "gvf-8", { xung_ho: "chú", nhom_tuoi: "lon_tuoi" }));
  globalThis.__model.parse = () => OUT({ replies: ["Dạ chú, chợ An Đông là khu P12 Quận 5 phải không ạ?"] });
  r = await send({ external_user_id: "gvf-8", text: "chú muốn mua nhà cho con gái ở gần chợ An Đông" });
  check("GVF-12 model đoán 'chợ An Đông là khu P12' (không ai nói P12) → bỏ câu đó", !/P12/.test(rep()) && r.body.replies.length >= 1, JSON.stringify(r.body.replies));
  // (8c) câu hỏi vọng lại + (8d) 'chưa có SĐT chủ' ngược câu tiền định.
  fresh((d) => { seedKho(d); const b = buyerCo(d, "gvf-8c"); quanTam(d, b, "BDS-Q5-0001"); });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ em chưa có SĐT chủ, bên em quản lý qua Zalo cho tiện ạ", "Mai 9h sáng có được không?"] });
  r = await send({ external_user_id: "gvf-8c", text: "cho em xin số chủ nhà với, mai 9h sáng em qua xem được không" });
  check("GVF-13 xin số chủ + 'mai 9h sáng em qua xem được không' → bỏ 'chưa có SĐT chủ' và câu hỏi vọng lại 'Mai 9h sáng có được không?'",
    /không gửi số chủ nhà/.test(rep()) && !/SĐT chủ/.test(rep()) && !/Mai 9h sáng có được không/.test(rep()), JSON.stringify(r.body.replies));
  // (9) hồ sơ mua: pháp lý + loại hình.
  fresh();
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "ban", area: "Quận 5", budget: "dưới 9 tỷ", notes: "ưu tiên sổ hồng riêng" }, replies: ["Dạ mình cần mấy phòng ngủ ạ?"] });
  r = await send({ external_user_id: "gvf-9", text: "em đang tìm mua căn hộ hoặc nhà nhỏ q5 dưới 9 tỷ, ưu tiên sổ hồng riêng" });
  {
    const p = db().t.buyers.find((b) => b.zalo_user_id === "gvf-9")?.preferences ?? {};
    check("GVF-14 'ưu tiên sổ hồng riêng' → phap_ly 'sổ hồng riêng' (không vào hoàn cảnh), 'căn hộ hoặc nhà nhỏ' → loại hình 'căn hộ hoặc nhà'",
      p.phap_ly === "sổ hồng riêng" && !p.notes && p.property_type === "căn hộ hoặc nhà", JSON.stringify(p));
  }
  // (8) nhánh bán: khen ngược nghĩa + câu chào đứng sau 🤖.
  fresh();
  const cauHinhGvf = globalThis.__cauHinh;
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "day_du" };
  globalThis.__model = { parse: () => OUT(), create: () => "Căn góc view thoáng khó bán lắm cô. Căn hộ mình ở tầng mấy cô?" };
  r = await send({ external_user_id: "gvf-8s", text: "Chào cháu, cô muốn bán căn hộ chung cư Ngô Gia Tự quận 10, căn góc 1 phòng ngủ, 50 mét, giá 2 tỷ 1" });
  check("GVF-15 nhánh bán 'khó bán lắm' sau ưu điểm → 'khó kiếm lắm'", /khó kiếm lắm/.test(rep()) && !/khó bán lắm/.test(rep()), JSON.stringify(r.body.replies));
  check("GVF-16 lượt rao đầu có lời chào → câu chào đứng TRƯỚC dòng 🤖 Đã lưu",
    /^(?:Dạ,?\s+)?(?:em|cháu)\s+chào/i.test(r.body.replies[0] ?? "") && r.body.replies.slice(1).some((x) => x.startsWith("🤖")), JSON.stringify(r.body.replies));
  globalThis.__cauHinh = cauHinhGvf;
  // (bắn lại sau deploy #193) kho trống mà model tả một căn cụ thể → bỏ bong bóng đó.
  fresh();
  globalThis.__model = { parse: () => OUT({ replies: ["Dạ để cháu xem ạ.", "Chú ơi, căn này hẻm xe hơi 4m P12, 50m2, 7,9 tỷ — gần chợ chỉ khoảng 600m, yên tĩnh cho ở. Chú có quan tâm không ạ?"] }) };
  r = await send({ external_user_id: "gvf-17", text: "Chú muốn mua nhà quận 5, khoảng 7 tới 8 tỷ cháu ơi" });
  check("GVF-17 kho trống, model tả 'căn này hẻm xe hơi 4m P12, 50m2, 7,9 tỷ' → bỏ bong bóng căn bịa, nói thật chưa có căn",
    !/7,9 tỷ|P12|50m2/.test(rep()) && /chưa có căn nào khớp/.test(rep()), JSON.stringify(r.body.replies));
  // kho CÓ căn khớp mà model chỉ hứa "em lọc kho cho mình xem" → thay bằng căn đầu kho.
  fresh(seedKho);
  globalThis.__model = { parse: () => OUT({ replies: ["Dạ em lọc kho cho mình xem. Mình cần hẻm xe hơi không ạ?"] }) };
  r = await send({ external_user_id: "gvf-18", text: "em đang tìm mua nhà phường 4 quận 5 dưới 7 tỷ" });
  // 23/09/2026 (FR-178 a, bắn thật): bong bóng tiền định KHÔNG còn mang mã tin cho khách — nêu căn bằng địa chỉ.
  check("GVF-18 kho có #BDS-Q5-0001 mà model chỉ 'em lọc kho cho mình xem' → bong bóng nêu căn Trần Hưng Đạo (tiền định từ kho), KHÔNG mã tin, không còn câu hứa",
    !/BDS-/.test(rep()) && /Trần Hưng Đạo/.test(rep()) && !/lọc kho/.test(rep()), JSON.stringify(r.body.replies));
  // Hai khách hỏi chủ về CÙNG một căn, hai câu khác nhau → mỗi khách một việc hỏi chủ (bản cũ nuốt câu thứ hai).
  fresh((d) => { seedKho(d); for (const u of ["gvf-19a", "gvf-19b"]) { const b = buyerCo(d, u); quanTam(d, b, "BDS-Q5-0001"); } });
  globalThis.__model = { parse: () => OUT({ replies: ["Dạ để em hỏi lại chủ nhà rồi báo mình liền."] }) };
  r = await send({ external_user_id: "gvf-19a", text: "nhà đó hướng gì em?" });
  r = await send({ external_user_id: "gvf-19b", text: "căn đó giá còn bớt không em?" });
  {
    const L = db().t.listings.find((l) => l.code === "BDS-Q5-0001");
    const ir = db().t.info_requests.filter((x) => x.source === "buyer_ask" && x.listing_id === L.id);
    check("GVF-19 hai khách hỏi chủ cùng một căn → HAI việc hỏi chủ (mỗi khách một), không nuốt câu thứ hai",
      ir.length === 2 && new Set(ir.map((x) => x.buyer_id)).size === 2, JSON.stringify(ir));
  }
  // Cùng khách hỏi thêm câu thứ hai về cùng căn → nối vào việc đang chờ (không bỏ, không tạo dòng thứ hai).
  globalThis.__model = { parse: () => OUT({ replies: ["Dạ để em hỏi lại chủ nhà rồi báo mình liền."], ask_owner: { listing_code: "BDS-Q5-0001", question: "có dính quy hoạch không" } }) };
  r = await send({ external_user_id: "gvf-19a", text: "căn đó có dính quy hoạch không em?" });
  {
    const L = db().t.listings.find((l) => l.code === "BDS-Q5-0001");
    const ir = db().t.info_requests.filter((x) => x.source === "buyer_ask" && x.listing_id === L.id && x.buyer_id === db().t.buyers.find((b) => b.zalo_user_id === "gvf-19a").id);
    check("GVF-19b cùng khách hỏi thêm 'quy hoạch' khi đang chờ câu khác → NỐI vào việc đang chờ (1 dòng, có cả hai câu)",
      ir.length === 1 && /quy hoạch/.test(ir[0].question) && ir[0].question.includes(";"), JSON.stringify(ir));
  }
  // Khối dự án đối tác có chữ "quy hoạch" → vẫn chặn câu "không có quy hoạch" về CĂN đang nói.
  fresh((d) => { seedKho(d); d.insert("projects", { name: "Ny'ah Phú Định", district: "Quận 8", is_partner: true, priority: 1, status_text: "quy hoạch 1/500 đã duyệt" }); const b = buyerCo(d, "gvf-20"); quanTam(d, b, "BDS-Q5-0001"); });
  globalThis.__model = { parse: () => OUT({ replies: ["Pháp lý sổ hồng riêng hoàn công, không có quy hoạch gì cả.", "Mình có muốn xem trực tiếp không ạ?"] }) };
  r = await send({ external_user_id: "gvf-20", text: "nha do co dinh quy hoach gi ko e" });
  check("GVF-20 khối dự án đối tác có chữ 'quy hoạch' → vẫn bỏ 'không có quy hoạch gì cả' về căn đang nói, nói thật + hỏi chủ",
    !/không có quy hoạch/.test(rep()) && /chưa có thông tin chắc chắn/.test(rep()), JSON.stringify(r.body.replies));
  // Mời "xem hình trước nhé?" cho căn 0 ảnh.
  fresh((d) => { seedKho(d); const b = buyerCo(d, "gvf-21"); quanTam(d, b, "BDS-Q5-0001"); });
  globalThis.__model = { parse: () => OUT({ replies: ["Dạ hẻm 6m xe hơi vào tận cửa ạ. Anh xem hình trước nhé?"] }) };
  r = await send({ external_user_id: "gvf-21", text: "hẻm đó rộng bao nhiêu em?" });
  check("GVF-21 căn 0 ảnh, khách hỏi hẻm, model mời 'Anh xem hình trước nhé?' → bỏ lời mời, không chèn 'chưa gửi hình', giữ câu hẻm",
    /hẻm 6m/.test(rep()) && !/chưa gửi hình/.test(rep()) && !/xem hình trước/.test(rep()), JSON.stringify(r.body.replies));
  // Lượt sau model chép lại ghi chú "ưu tiên sổ hồng riêng" → không vào hoàn cảnh khi đã có phap_ly.
  fresh((d) => buyerCo(d, "gvf-22", { phap_ly: "sổ hồng riêng" }));
  globalThis.__model = { parse: () => OUT({ profile: { ...OUT().profile, notes: "ưu tiên sổ hồng riêng" }, replies: ["Dạ bên em không gửi số chủ nhà qua chat ạ."] }) };
  r = await send({ external_user_id: "gvf-22", text: "cho em xin số chủ nhà với" });
  check("GVF-22 hồ sơ đã có phap_ly, model chép lại ghi chú 'ưu tiên sổ hồng riêng' → không ghi vào hoàn cảnh",
    !db().t.buyers.find((b) => b.zalo_user_id === "gvf-22")?.preferences?.notes, JSON.stringify(db().t.buyers.find((b) => b.zalo_user_id === "gvf-22")?.preferences));
  globalThis.__model = { parse: () => OUT() };
}

// ── 23/09/2026 FR-214 (chủ dự án: "có 1 chat thôi", một người vừa mua nhiều căn vừa bán nhiều căn) ──
{
  const rep = () => r.body.replies.join(" ");
  fresh();
  globalThis.__model = { parse: () => OUT(), create: () => "Dạ nhà mình mấy tầng vậy ạ?" };
  r = await send({ external_user_id: "gvg-1", text: "bán nhà hẻm 4m Nguyễn Trãi q5, 60m2, 7 tỷ" });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ mình cần mấy phòng ngủ ạ?"] });
  r = await send({ external_user_id: "gvg-1", text: "tôi cũng đang muốn mua căn hộ quận 7 tầm 3 tỷ" });
  {
    const s = db().t.sellers.find((x) => x.zalo_user_id === "gvg-1");
    const b = db().t.buyers.find((x) => x.zalo_user_id === "gvg-1");
    const convs = db().t.conversations.filter((c) => c.seller_id === s?.id || c.buyer_id === b?.id);
    const pm = JSON.stringify(parseCalls().slice(-1).map((c) => c.params));
    check("GVG-01 rao bán rồi hỏi mua → MỘT hội thoại mang cả seller_id lẫn buyer_id, tin cả hai vai chung một chỗ",
      !!s && !!b && convs.length === 1 && convs[0].seller_id === s.id && convs[0].buyer_id === b.id &&
        db().t.messages.filter((m) => m.conversation_id === convs[0].id && ["seller", "buyer"].includes(m.sender)).length === 2,
      JSON.stringify({ convs, msgs: db().t.messages.map((m) => [m.conversation_id === convs[0]?.id, m.sender, m.body.slice(0, 30)]) }));
    check("GVG-02 nhánh mua thấy câu rao bán cũ là lời KHÁCH (không phải EM)",
      /KHÁCH: bán nhà hẻm 4m Nguyễn Trãi/.test(pm) && !/EM: bán nhà hẻm 4m Nguyễn Trãi/.test(pm), pm.slice(0, 400));
  }
  r = await send({ external_user_id: "gvg-1", text: "nhà tôi 3 tầng" });
  {
    const pc = JSON.stringify(createCalls().slice(-1).map((c) => c.params));
    check("GVG-03 quay lại nhánh bán → lịch sử có câu hỏi mua là lời CHỦ NHÀ (không phải EM)",
      /CHỦ NHÀ: tôi cũng đang muốn mua căn hộ quận 7/.test(pc) && !/EM: tôi cũng đang muốn mua/.test(pc), pc.slice(0, 600));
  }
  globalThis.__model = { parse: () => OUT() };
}

// ── 23/09/2026 FR-214 (b)(d)(e): Zalo chủ dự án — rao nhà Kênh Tân Hóa rồi đất Cần Giuộc, năm tin, bot gộp một ──
{
  const rep = () => r.body.replies.join(" ");
  const uid = "gvh-1";
  const ds = () => { const s = db().t.sellers.find((x) => x.zalo_user_id === uid); return db().t.listings.filter((l) => l.seller_id === s?.id); };
  const nha = () => ds().find((l) => l.property_type !== "dat");
  const dat = () => ds().find((l) => l.property_type === "dat");
  fresh();
  globalThis.__model = { parse: () => OUT(), create: () => "Dạ cô cho cháu xin thêm thông tin nha." };
  r = await send({ external_user_id: uid, text: "Cô cần bán nhà đường kênh Tân Hoá" });
  {
    // Dựng đúng cảnh 02:34: bot đã gợi ý phường, câu phường đang treo.
    const A = ds()[0];
    A.boc_tach = { ...(A.boc_tach ?? {}), phuong_goi_y: { phuong: "Phường Bình Thới", quan: "Quận 11", duong: "Kênh Tân Hóa" } };
    A.district = null;
    for (const ir of db().t.info_requests.filter((x) => x.listing_id === A.id && x.status === "pending")) ir.status = "expired";
    db().insert("info_requests", { listing_id: A.id, question: "phuong", status: "pending" });
    db().t.sellers.find((x) => x.zalo_user_id === uid).active_listing_id = A.id;
  }
  r = await send({ external_user_id: uid, text: "Đúng rồi và 1 muốn rao bán 1 mảnh đất ở xã cần giuộc tỉnh long an ở đường tỉnh lộ 830" });
  check("GVH-01 đang hỏi phường căn nhà, 'Đúng rồi và … mảnh đất ở Cần Giuộc, Long An' → HAI tin: nhà giữ loại/vị trí + nhận Phường Bình Thới, đất mở riêng Long An",
    ds().length === 2 && !!nha() && !!dat() && !/Tỉnh lộ|tinh lo/i.test(nha()?.location_raw ?? "") && nha()?.ward === "Phường Bình Thới" && /Long An/.test(dat()?.district ?? ""),
    JSON.stringify({ ds: ds().map((l) => [l.code, l.property_type, l.location_raw, l.ward, l.district]), rep: r.body.replies }));
  check("GVH-01b gật phường gợi ý kèm quận ('Phường Bình Thới (Quận 11 cũ)') → căn nhà nhận luôn Quận 11, gợi ý được xoá (bắn thật 23/09: quận để trống)",
    nha()?.district === "Quận 11" && !nha()?.boc_tach?.phuong_goi_y, JSON.stringify([nha()?.district, nha()?.boc_tach]));
  if (dat() && nha()) {
  {
    // Lô đất đang được hỏi giá (cảnh 02:45).
    const B = dat();
    for (const ir of db().t.info_requests.filter((x) => x.status === "pending")) ir.status = "expired";
    db().insert("info_requests", { listing_id: B.id, question: "gia", status: "pending" });
    db().t.sellers.find((x) => x.zalo_user_id === uid).active_listing_id = B.id;
  }
  const soGanManh = () => globalThis.__calls.filter((c) => c.kind === "parse" && laLuotGanManh(c.params)).length;
  const n0 = soGanManh();
  globalThis.__model = {
    parse: (p) => laLuotGanManh(p)
      ? { manh: [{ trich: "15 tỉ nhé cháu", ma_tin: dat().code }, { trich: "còn nhà ở quận 11 cũ muốn 7 tỉ", ma_tin: nha().code }] }
      : OUT(),
    create: () => "Dạ cháu ghi 15 tỷ căn Long An, 7 tỷ căn Quận 11 rồi cô. Lô đất mình hướng nào cô?",
  };
  r = await send({ external_user_id: uid, text: "15 tỉ nhé cháu còn nhà ở quận 11 cũ muốn 7 tỉ" });
  check("GVH-02 '15 tỉ nhé cháu còn nhà ở quận 11 cũ muốn 7 tỉ' → một lượt model đọc lại hội thoại; đất 15 tỷ, NHÀ 7 tỷ; đất KHÔNG thành Quận 11",
    soGanManh() === n0 + 1 && dat()?.price_vnd === 15e9 && nha()?.price_vnd === 7e9 && /Long An/.test(dat()?.district ?? "") && /7 tỉ/.test(rep()),
    JSON.stringify({ ds: ds().map((l) => [l.code, l.property_type, l.price_raw, l.price_vnd, l.district]), rep: r.body.replies }));
  const pmManh = JSON.stringify(globalThis.__calls.filter((c) => c.kind === "parse" && laLuotGanManh(c.params)).at(-1)?.params ?? {});
  check("GVH-03 lượt gán mảnh được đọc CẢ hội thoại (câu rao nhà Kênh Tân Hoá từ lượt đầu) + danh sách hai mã tin",
    /CHỦ NHÀ: Cô cần bán nhà đường kênh Tân Hoá/.test(pmManh) && pmManh.includes(nha().code) && pmManh.includes(dat().code), pmManh.slice(0, 500));
  {
    for (const ir of db().t.info_requests.filter((x) => x.status === "pending")) ir.status = "expired";
    db().insert("info_requests", { listing_id: dat().id, question: "tho_cu", status: "pending" });
  }
  globalThis.__model = {
    parse: (p) => laLuotGanManh(p) ? { manh: [{ trich: "Nhà phố mà thổ cư full nhà căn nhà phố mặt tiền 5m 3 phòng ngủ shr", ma_tin: nha().code }] } : OUT(),
    create: () => "Dạ cháu ghi rồi ạ.",
  };
  r = await send({ external_user_id: uid, text: "Nhà phố mà thổ cư full nhà căn nhà phố mặt tiền 5m 3 phòng ngủ shr" });
  check("GVH-04 'Nhà phố … mặt tiền 5m 3 phòng ngủ shr' khi đang hỏi thổ cư lô đất → vào tin NHÀ (3PN, sổ riêng); lô đất không nhận phòng ngủ/sổ",
    nha()?.bedrooms === 3 && nha()?.legal_status === "so_hong_rieng" && dat()?.bedrooms == null && dat()?.legal_status == null,
    JSON.stringify({ ds: ds().map((l) => [l.code, l.bedrooms, l.legal_status, l.frontage_m]) }));
  check("GVH-04b dòng 📝 in pháp lý đã đọc ('sổ hồng riêng'), không in lại nguyên câu khách gõ (bắn thật 23/09 lượt 5)",
    /sổ hồng riêng/.test(rep()) && !/pháp lý Nhà phố mà/.test(rep()), JSON.stringify(r.body.replies));
  // (e) model nói đã ghi một con số không có trong DB → bỏ câu đó.
  globalThis.__model = { parse: () => OUT(), create: () => "Dạ cháu ghi 9 tỷ cho căn Quận 11 rồi cô. Lô đất mình hướng nào cô?" };
  r = await send({ external_user_id: uid, text: "hướng đông nam cháu" });
  check("GVH-05 model 'cháu ghi 9 tỷ cho căn Quận 11' (DB không có giá 9 tỷ nào) → bỏ câu đó, giữ câu hỏi",
    !/9 tỷ/.test(rep()) && /hướng nào/.test(rep()), JSON.stringify(r.body.replies));
  // Bắn thật 23/09 lượt 4: câu đang treo là DIỆN TÍCH lô đất, mảnh của lô đất lại là GIÁ.
  {
    for (const ir of db().t.info_requests.filter((x) => x.status === "pending")) ir.status = "expired";
    db().insert("info_requests", { listing_id: dat().id, question: "dien_tich", status: "pending" });
  }
  globalThis.__model = {
    parse: (p) => laLuotGanManh(p)
      ? { manh: [{ trich: "đất 16 tỉ nhé cháu", ma_tin: dat().code }, { trich: "còn nhà muốn 7 tỉ 5", ma_tin: nha().code }] }
      : OUT(),
    create: () => "Dạ cháu ghi rồi ạ.",
  };
  const bsTruoc = db().t.listing_facts.filter((f) => f.listing_id === dat().id && f.question === "bo_sung").length;
  r = await send({ external_user_id: uid, text: "đất 16 tỉ nhé cháu còn nhà muốn 7 tỉ 5" });
  check("GVH-06 đang hỏi DIỆN TÍCH lô đất, mảnh lô đất là '16 tỉ' → GIÁ lô đất 16 tỷ (không vào 'thông tin bổ sung'), nhà 7 tỷ 5, hỏi lại diện tích",
    dat()?.price_vnd === 16e9 && nha()?.price_vnd === 7.5e9 &&
      db().t.listing_facts.filter((f) => f.listing_id === dat().id && f.question === "bo_sung").length === bsTruoc &&
      db().t.info_requests.some((x) => x.listing_id === dat().id && x.question === "dien_tich" && x.status === "pending") && /diện tích|mét vuông|m2|rộng/i.test(rep()),
    JSON.stringify({ ds: ds().map((l) => [l.code, l.price_vnd]), rep: r.body.replies, bs: db().t.listing_facts.filter((f) => f.question === "bo_sung").map((f) => f.answer) }));
  }
  globalThis.__model = { parse: () => OUT() };
}

// ── 23/09/2026 FR-214 b: bắn thật 5 người — một tin nói HAI bất động sản, không có "căn 1/căn 2" ──
{
  fresh();
  globalThis.__model = { parse: () => OUT() };
  const ls = () => db().t.listings;
  const rep = () => r.body.replies.join(" ");
  r = await send({ external_user_id: "gvi-a", text: "Chị cần bán 2 căn: căn nhà hẻm 5m Nguyễn Trãi quận 5 60m2 giá 9 tỷ, với 1 căn hộ chung cư Hà Đô quận 10 2PN 75m2 giá 5 tỷ 2" });
  check("GVI-01 'căn nhà … Q5 9 tỷ, với 1 căn hộ … Q10 5 tỷ 2' → HAI tin: nhà phố Q5 60m2 9 tỷ + căn hộ Q10 75m2 5 tỷ 2 (bản trước gộp một, loại căn hộ)",
    ls().length === 2 && ls()[0].property_type === "nha_pho" && ls()[0].district === "Quận 5" && Number(ls()[0].area_m2) === 60 && /9 tỷ/.test(ls()[0].price_raw ?? "") &&
      ls()[1].property_type === "chung_cu" && ls()[1].district === "Quận 10" && Number(ls()[1].area_m2) === 75 && /5 tỷ 2/.test(ls()[1].price_raw ?? ""),
    JSON.stringify(ls().map((l) => [l.code, l.property_type, l.district, l.area_m2, l.price_raw])));
  check("GVI-01b '2PN' của căn hộ KHÔNG ghi sang căn nhà (bắn thật 23/09: nhà Q5 nhận 2 phòng ngủ)",
    ls().length === 2 && ls()[0].bedrooms == null && ls()[1].bedrooms === 2, JSON.stringify(ls().map((l) => [l.code, l.bedrooms])));
  fresh();
  r = await send({ external_user_id: "gvi-d", text: "em ban 2 nha: nha 1 hem 3m pham the hien q8 3 ty 2, nha 2 mat tien au duong lan q8 12 ty" });
  check("GVI-02 không dấu 'nha 1 …, nha 2 …' → HAI tin nhà phố Q8 (3 tỷ 2 · 12 tỷ), không gắn nhãn '2 mặt tiền'",
    ls().length === 2 && ls().every((l) => l.property_type === "nha_pho" && l.district === "Quận 8") && /3 tỷ 2/.test(ls()[0].price_raw ?? "") && /12 tỷ/.test(ls()[1].price_raw ?? "") &&
      !ls().some((l) => (l.nhan ?? []).includes("can_goc")),
    JSON.stringify(ls().map((l) => [l.code, l.property_type, l.district, l.price_raw, l.nhan])));
  fresh();
  r = await send({ external_user_id: "gvi-e", text: "Chú có 2 lô đất ở Củ Chi muốn bán, lô 1 500m2 giá 3 tỷ, lô 2 1000m2 giá 5 tỷ" });
  check("GVI-03 '2 lô đất ở Củ Chi, lô 1 …, lô 2 …' → hai tin loại ĐẤT (loại ở đầu câu là của cả lô), không hỏi lại 'nhà phố hay đất'",
    ls().length === 2 && ls().every((l) => l.property_type === "dat") && !/nhà phố, chung cư hay đất/.test(rep()),
    JSON.stringify({ ls: ls().map((l) => [l.code, l.property_type, l.district, l.area_m2]), rep: r.body.replies }));
  // "cả lô" ở câu LOẠI áp cho mọi tin chưa rõ loại.
  fresh();
  r = await send({ external_user_id: "gvi-e2", text: "Chú có 2 lô ở Củ Chi muốn bán, lô 1 500m2 giá 3 tỷ, lô 2 1000m2 giá 5 tỷ" });
  {
    for (const ir of db().t.info_requests.filter((x) => x.status === "pending")) ir.status = "expired";
    db().insert("info_requests", { listing_id: ls()[0].id, question: "loai_bds", status: "pending" });
    db().t.sellers.find((x) => x.zalo_user_id === "gvi-e2").active_listing_id = ls()[0].id;
  }
  const loaiTruoc = ls().map((l) => l.property_type);
  r = await send({ external_user_id: "gvi-e2", text: "cả lô đều là đất thổ cư" });
  check("GVI-04 đang hỏi loại lô 1, 'cả lô đều là đất thổ cư' → CẢ HAI lô thành đất (bản trước lô 2 nằm 'chưa rõ loại')",
    ls().length === 2 && ls().every((l) => l.property_type === "dat"), JSON.stringify({ truoc: loaiTruoc, sau: ls().map((l) => [l.code, l.property_type]), rep: r.body, f: db().t.listing_facts.map((f) => [f.question, f.answer]) }));
  // Mới MỘT tin, câu vừa trả lời căn cũ vừa rao căn mới → AI chia (mảnh đầu = câu treo, mảnh sau = MOI).
  fresh();
  r = await send({ external_user_id: "gvi-b", text: "Anh bán nhà mặt tiền Lê Văn Sỹ quận 3 4x18 giá 25 tỷ" });
  {
    for (const ir of db().t.info_requests.filter((x) => x.status === "pending")) ir.status = "expired";
    db().insert("info_requests", { listing_id: ls()[0].id, question: "phuong", status: "pending" });
    db().t.sellers.find((x) => x.zalo_user_id === "gvi-b").active_listing_id = ls()[0].id;
  }
  globalThis.__model = {
    parse: (p) => laLuotGanManh(p)
      ? { manh: [{ trich: "phường 9 em.", ma_tin: ls()[0].code }, { trich: "À anh còn miếng đất ở Nhơn Trạch Đồng Nai 100m2 thổ cư muốn 2 tỷ 3 nữa", ma_tin: "MOI" }] }
      : OUT(),
    create: () => "Dạ em ghi rồi ạ.",
  };
  r = await send({ external_user_id: "gvi-b", text: "phường 9 em. À anh còn miếng đất ở Nhơn Trạch Đồng Nai 100m2 thổ cư muốn 2 tỷ 3 nữa" });
  const nhaB = ls().find((l) => l.property_type === "nha_pho"), datB = ls().find((l) => l.property_type === "dat");
  check("GVI-05 mới 1 tin, 'phường 9 em. À anh còn miếng đất ở Nhơn Trạch … 2 tỷ 3 nữa' → Phường 9 về căn nhà Q3; lô đất mở riêng (đất, 2 tỷ 3, không mang Phường 9)",
    ls().length === 2 && nhaB?.ward === "Phường 9" && !!datB && datB.price_vnd === 2.3e9 && !datB.ward,
    JSON.stringify({ ls: ls().map((l) => [l.code, l.property_type, l.district, l.ward, l.price_vnd, l.area_m2]), rep: r.body.replies }));
  globalThis.__model = { parse: () => OUT() };
}

// ── 23/09/2026 FR-216: kho lọc theo LOẠI HẺM (prefs.alley) + xếp theo NGHĨA (RAG, công tắc tim_theo_nghia) ──
{
  const seedHem = (d) => {
    seedKho(d);
    const s = d.t.sellers[0];
    d.insert("listings", { code: "BDS-Q5-0006", seller_id: s.id, deal: "ban", status: "dang_ban", location_raw: "8 Trần Bình Trọng", ward: "Phường 1", price_raw: "6 tỷ 2", price_vnd: 6.2e9, area_m2: 45, access_type: "hem_xe_may", alley_width_m: 2 });
    d.insert("listings", { code: "BDS-Q5-0007", seller_id: s.id, deal: "ban", status: "dang_ban", location_raw: "20 Nguyễn Trãi", ward: "Phường 2", price_raw: "6 tỷ 1", price_vnd: 6.1e9, area_m2: 42, access_type: "mat_tien", nhan: ["xe_hoi_quay_dau"] });
    d.t.listings.find((l) => l.code === "BDS-Q5-0001").nhan = ["xe_hoi_quay_dau"];
  };
  const khoMua = () => (JSON.stringify(parseCalls().slice(-1).map((c) => c.params)).split("KHO HIỆN CÓ")[1] ?? "").slice(0, 1500);
  const maTrongKho = () => [...khoMua().matchAll(/#(BDS-Q5-\d{4})/g)].map((m) => m[1]).filter((x, i, a) => a.indexOf(x) === i);
  const cauHinhCu = globalThis.__cauHinh;
  // (1) khách đòi hẻm xe hơi → kho bỏ căn hẻm xe máy (0006) và căn chưa rõ đường vào (0004).
  fresh(seedHem);
  r = await send({ external_user_id: "rag-1", text: "anh cần mua nhà hẻm xe hơi quận 5 tầm 6 tỷ" });
  check("RAG-01 'hẻm xe hơi … tầm 6 tỷ' → KHO chỉ còn căn hẻm xe hơi/mặt tiền (0001, 0007), KHÔNG căn hẻm xe máy 0006 lẫn căn chưa rõ 0004",
    maTrongKho().includes("BDS-Q5-0001") && maTrongKho().includes("BDS-Q5-0007") && !maTrongKho().includes("BDS-Q5-0006") && !maTrongKho().includes("BDS-Q5-0004"),
    JSON.stringify(maTrongKho()));
  // (2) đối chứng: không nói loại hẻm → căn hẻm xe máy vẫn được gợi.
  fresh(seedHem);
  r = await send({ external_user_id: "rag-2", text: "anh cần mua nhà quận 5 tầm 6 tỷ" });
  check("RAG-02 không nói loại hẻm → KHO còn căn hẻm xe máy 0006 (không lọc thừa)", maTrongKho().includes("BDS-Q5-0006"), JSON.stringify(maTrongKho()));
  // (2b) "hẻm cách mặt tiền 50m" không phải đòi nhà mặt tiền.
  fresh(seedHem);
  r = await send({ external_user_id: "rag-2b", text: "anh cần mua nhà hẻm cách mặt tiền 50m quận 5 tầm 6 tỷ" });
  check("RAG-02b 'hẻm cách mặt tiền 50m' → KHÔNG lọc về mặt tiền (còn 0006)", maTrongKho().includes("BDS-Q5-0006"), JSON.stringify(maTrongKho()));
  // (3) công tắc BẬT: vector câu tìm + RPC xếp hạng → 0007 lên đầu dù cũ hơn.
  fresh(seedHem);
  globalThis.__cauHinh = { test_reset_hello: "1", tim_theo_nghia: "bat" };
  const env = globalThis.Deno.env; const getCu = env.get; env.get = (k) => k === "GEMINI_API_KEY" ? "gem-test" : getCu(k);
  let cauNhung = null;
  globalThis.__nhung = (t) => { cauNhung = t; return Array.from({ length: 768 }, () => 0.01); };
  globalThis.__rpc = { tim_tin_theo_nghia: (_d, a) => ({ data: ["BDS-Q5-0007", "BDS-Q5-0001"].filter((c) => a.p_codes.includes(c)).map((code, i) => ({ code, do_gan: 0.8 - i / 10 })), error: null }) };
  r = await send({ external_user_id: "rag-3", text: "anh cần mua nhà hẻm xe hơi quận 5 tầm 6 tỷ, xe hơi quay đầu được" });
  const goiXep = db().log.find((x) => x.rpc === "tim_tin_theo_nghia");
  check("RAG-03 bật tim_theo_nghia → gọi tim_tin_theo_nghia(vector 768, mã đã lọc cứng + nhãn xe_hoi_quay_dau); KHO xếp 0007 trước 0001; câu nhúng mang ý khách",
    !!goiXep && goiXep.args.p_vec.length === 768 && goiXep.args.p_codes.includes("BDS-Q5-0001") && !goiXep.args.p_codes.includes("BDS-Q5-0006") &&
      maTrongKho()[0] === "BDS-Q5-0007" && /quay đầu/.test(cauNhung ?? ""),
    JSON.stringify({ goi: goiXep?.args?.p_codes, kho: maTrongKho(), cauNhung }));
  // (4) nhúng hỏng → kho giữ thứ tự cũ, ghi sổ, khách vẫn được trả lời.
  fresh(seedHem);
  globalThis.__nhung = () => { throw new Error("Gemini embed 503"); };
  r = await send({ external_user_id: "rag-4", text: "anh cần mua nhà hẻm xe hơi quận 5 tầm 6 tỷ" });
  check("RAG-04 nhúng hỏng → KHO vẫn đủ 0001 + 0007, sổ lỗi 'chat-reply tim_tin_theo_nghia', có trả lời",
    maTrongKho().includes("BDS-Q5-0001") && maTrongKho().includes("BDS-Q5-0007") && db().t.bot_errors.some((e) => e.source === "chat-reply tim_tin_theo_nghia") && r.body.replies?.length > 0,
    JSON.stringify({ kho: maTrongKho(), loi: db().t.bot_errors.map((e) => e.source) }));
  env.get = getCu;
  // (5) công tắc TẮT → không nhúng, không gọi RPC xếp hạng.
  fresh(seedHem);
  globalThis.__cauHinh = { test_reset_hello: "1" };
  let daNhung = false;
  globalThis.__nhung = () => { daNhung = true; return Array.from({ length: 768 }, () => 0); };
  r = await send({ external_user_id: "rag-5", text: "anh cần mua nhà hẻm xe hơi quận 5 tầm 6 tỷ" });
  check("RAG-05 tim_theo_nghia tắt → không nhúng, không gọi tim_tin_theo_nghia", !daNhung && !db().log.some((x) => x.rpc === "tim_tin_theo_nghia"));
  // (6) 24/09: câu vừa nhắn cụt → vector câu tìm ghép thêm NHU CẦU ĐÃ LƯU (notes).
  fresh((d) => { seedHem(d); d.insert("buyers", { zalo_user_id: "rag-6", preferences: { deal: "mua", area: "Quận 5", budget: "6-7 tỷ", notes: "ba mẹ già ở cùng, cần phòng ngủ dưới trệt để khỏi leo cầu thang" } }); });
  globalThis.__cauHinh = { test_reset_hello: "1", tim_theo_nghia: "bat" };
  env.get = (k) => k === "GEMINI_API_KEY" ? "gem-test" : getCu(k);
  cauNhung = null;
  globalThis.__nhung = (t) => { cauNhung = t; return Array.from({ length: 768 }, () => 0.01); };
  globalThis.__rpc = { tim_tin_theo_nghia: (_d, a) => ({ data: a.p_codes.map((code, i) => ({ code, do_gan: 0.8 - i / 10 })), error: null }) };
  r = await send({ external_user_id: "rag-6", text: "phòng cho ba mẹ riêng em có căn nào ko" });
  check("RAG-06 câu cụt 'phòng cho ba mẹ riêng…' → câu nhúng mang cả nhu cầu đã lưu 'phòng ngủ dưới trệt … leo cầu thang'",
    /phòng cho ba mẹ riêng/.test(cauNhung ?? "") && /phòng ngủ dưới trệt/.test(cauNhung ?? "") && /leo cầu thang/.test(cauNhung ?? ""), cauNhung);
  env.get = getCu;
  delete globalThis.__nhung;
  globalThis.__rpc = {};
  globalThis.__cauHinh = cauHinhCu;
}

// ── 24/09/2026 FR-218 b: dòng kho kèm LỜI CHỦ TẢ + luật không tự suy; đủ quận + giá mà model chỉ hỏi dò → đưa căn ──
{
  const seedTa = (d) => {
    seedKho(d);
    const l = d.t.listings.find((x) => x.code === "BDS-Q5-0001");
    l.description = "Bán nhà hẻm 6m số 12 Trần Hưng Đạo, trệt 2 lầu, có 1 phòng ngủ ngay tầng trệt cho ông bà lớn tuổi, liên hệ 0903 123 456";
  };
  const promptKho = () => (JSON.stringify(parseCalls().slice(-1).map((c) => c.params)).split("KHO HIỆN CÓ")[1] ?? "").slice(0, 2000);
  fresh(seedTa);
  globalThis.__model.parse = () => OUT({ replies: ["Dạ có căn Trần Hưng Đạo hợp mình nè"] });
  r = await send({ external_user_id: "ta-1", text: "tìm nhà phường 4 quận 5 tầm 6 tỷ" });
  check("KHOTA-01 dòng kho có 'chủ tả: \"…phòng ngủ ngay tầng trệt…\"', SĐT và số nhà bị che; đầu khối KHO dặn không tự suy, 'để em hỏi lại chủ'",
    /chủ tả: \\"[^"]*phòng ngủ ngay tầng trệt/.test(promptKho()) && !/0903/.test(promptKho()) && !/số 12/.test(promptKho().split("chủ tả")[1] ?? "") &&
      /KHÔNG tự suy/.test(promptKho()) && /để em hỏi lại chủ/.test(promptKho()),
    promptKho().slice(0, 900));
  // (2) model chỉ hỏi dò dù đủ quận + giá → bỏ câu hỏi dò, đưa căn trong kho (không mã tin).
  fresh(seedTa);
  globalThis.__model.parse = () => OUT({ replies: ["Dạ mình có ba mẹ ở cùng hay phòng cho ba mẹ riêng vậy?", "Hoặc mình ưu tiên hẻm xe hơi hay mặt tiền được không ạ?"] });
  r = await send({ external_user_id: "ta-2", text: "tìm nhà quận 5 tầm 6 tới 7 tỷ, có phòng ngủ dưới trệt cho ba mẹ già" });
  {
    const rp = (r.body.replies ?? []).join("\n");
    check("DUACAN-01 đủ quận + giá, model chỉ hỏi dò → bỏ 2 câu hỏi dò, thêm bong bóng đưa căn An Dương Vương/… (không mã #BDS), kết bằng MỘT câu hỏi",
      /Dạ bên em đang có/.test(rp) && /An Dương Vương|Trần Hưng Đạo/.test(rp) && !/ba mẹ ở cùng hay/.test(rp) && !/hẻm xe hơi hay mặt tiền/.test(rp) && !/BDS-/.test(rp),
      rp);
  }
  // (3) model đã nhắc một căn trong kho → không chen bong bóng tiền định.
  fresh(seedTa);
  globalThis.__model.parse = () => OUT({ replies: ["Dạ căn An Dương Vương P8 6 tỷ hợp mình nè, mình xem thử không ạ?"] });
  r = await send({ external_user_id: "ta-3", text: "tìm nhà quận 5 tầm 6 tới 7 tỷ" });
  check("DUACAN-02 model đã đưa căn (nhắc tên đường trong kho) → KHÔNG thêm bong bóng 'Dạ bên em đang có'",
    !/Dạ bên em đang có/.test((r.body.replies ?? []).join("\n")), JSON.stringify(r.body.replies));
  // (4) căn đã đưa ở lượt trước (lịch sử bot nhắc tên đường) → lượt này model hỏi khách chê gì thì để yên.
  fresh(seedTa);
  globalThis.__model.parse = () => OUT({ replies: ["Dạ căn An Dương Vương P8 6 tỷ hợp mình nè"] });
  await send({ external_user_id: "ta-4", text: "tìm nhà quận 5 tầm 6 tới 7 tỷ" });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ mình chưa ưng căn đó ở điểm nào ạ?"] });
  r = await send({ external_user_id: "ta-4", text: "căn đó chưa ưng lắm" });
  check("DUACAN-03 đã đưa căn ở lượt trước → lượt sau model hỏi khách chưa ưng gì thì KHÔNG đẩy lại danh sách",
    !/Dạ bên em đang có/.test((r.body.replies ?? []).join("\n")) && /chưa ưng/.test((r.body.replies ?? []).join("\n")), JSON.stringify(r.body.replies));
  // (5) 24/09 bắn thật sau #266: model khẳng định "đều có phòng ngủ ở tầng trệt" cho căn không ghi → thay câu.
  fresh(seedTa);
  globalThis.__model.parse = () => OUT({ replies: ["Dạ căn An Dương Vương P8 6 tỷ có phòng ngủ ở tầng trệt cho ba mẹ luôn. Mình xem thử không ạ?"] });
  r = await send({ external_user_id: "ta-5", text: "tìm nhà quận 5 tầm 6 tới 7 tỷ, có phòng ngủ dưới trệt cho ba mẹ" });
  {
    const rp = (r.body.replies ?? []).join("\n");
    check("DACDIEM-01 căn An Dương Vương (dữ liệu không ghi) bị nói 'có phòng ngủ ở tầng trệt' → thay bằng 'em hỏi lại chủ', câu hỏi giữ",
      !/có phòng ngủ ở tầng trệt cho ba mẹ luôn/.test(rp) && /hỏi lại chủ/.test(rp) && /xem thử không ạ\?/.test(rp), rp);
  }
  globalThis.__model = { parse: () => OUT() };
}

// ── 23/09/2026 FR-217: lệnh TEST "/json" — in thứ bot đã lưu cho chính người nhắn, không gọi model ──
{
  fresh(seedKho);
  const L1 = db().t.listings.find((l) => l.code === "BDS-Q5-0001");
  L1.nhan = ["xe_hoi_quay_dau"]; L1.nhung_luc = "2026-09-23T12:14:00Z";
  db().insert("listing_facts", { listing_id: L1.id, question: "huong", answer: "Đông Nam", source: "seller_chat" });
  globalThis.__rpc = { van_ban_nhung: () => ({ data: "Bán nhà phố. 12 Trần Hưng Đạo, Phường 4. Hẻm xe hơi rộng 6 m", error: null }) };
  const cauHinhCu = globalThis.__cauHinh;
  globalThis.__cauHinh = { test_reset_hello: "0", lenh_json: "bat" }; // công tắc riêng: bật dù chế độ "hello" tắt
  const truoc = globalThis.__calls.length;
  r = await send({ external_user_id: "z-ccrb", text: "/json" });
  const j = (r.body.replies ?? []).join("\n");
  check("JSON-01 '/json' (lenh_json = bat, 'hello' tắt) → in tin #BDS-Q5-0001: cột (hẻm xe hơi, nhãn), fact huong, văn bản đã nhúng vector; KHÔNG gọi model",
    r.body.lenh_json === true && /#BDS-Q5-0001/.test(j) && /hem_xe_hoi/.test(j) && /xe_hoi_quay_dau/.test(j) && /Đông Nam/.test(j) &&
      /đã nhúng lúc 2026-09-23 12:14/.test(j) && /Hẻm xe hơi rộng 6 m/.test(j) && globalThis.__calls.length === truoc,
    j.slice(0, 800));
  check("JSON-02 '/json' không lộ tin của người khác (0004 của z-unknown)", !/BDS-Q5-0004/.test(j), j.slice(0, 300));
  check("JSON-03 bong bóng ≤ 1800 ký tự", (r.body.replies ?? []).every((x) => x.length <= 1800), JSON.stringify((r.body.replies ?? []).map((x) => x.length)));
  globalThis.__cauHinh = { test_reset_hello: "1" };
  r = await send({ external_user_id: "z-ccrb", text: "/json" });
  check("JSON-04 lenh_json chưa bật (dù chế độ 'hello' bật) → '/json' không in dữ liệu (đi như tin thường)", r.body.lenh_json !== true && !/TEST \/json/.test((r.body.replies ?? []).join(" ")), JSON.stringify(r.body).slice(0, 300));
  globalThis.__cauHinh = cauHinhCu;
}

// ── 23/09/2026 FR-218 b: khách nói bot hiểu nhầm → bot xin lỗi (dù model quên) ──
{
  fresh(seedKho);
  r = await send({ external_user_id: "xl-1", text: "anh cần mua nhà quận 5 tầm 6 tỷ" });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ anh cần thuê khu nào trong Quận 5 ạ?"] });
  r = await send({ external_user_id: "xl-1", text: "không phải vậy em, ý anh là thuê chứ không mua" });
  const loi = (r.body.replies ?? []).filter((x) => !/^(?:🤖|💾)/u.test(x));
  check("XL-01 'không phải vậy, ý anh là thuê' + model không xin lỗi → bong bóng lời mở bằng 'Dạ em xin lỗi …, em hiểu nhầm ạ.'",
    /^Dạ em xin lỗi(?: anh)?, em hiểu nhầm ạ\./.test(loi[0] ?? ""), JSON.stringify(r.body.replies));
  globalThis.__model.parse = () => OUT({ replies: ["Dạ em xin lỗi anh, em sửa liền ạ. Anh cần thuê tầm bao nhiêu?"] });
  r = await send({ external_user_id: "xl-1", text: "hiểu sai rồi em" });
  check("XL-02 model đã xin lỗi → không chèn lần hai", ((r.body.replies ?? []).join(" ").match(/xin lỗi/g) ?? []).length === 1, JSON.stringify(r.body.replies));
  globalThis.__model = { parse: () => OUT() };
}

// ── 23/09/2026 bắn thật 5 bán + 2 mua: "được giá thì bán em, ok đăng tin đi em" (câu dài) và "ban công hướng Đông nha em" ──
{
  const pendQ = (q) => db().t.info_requests.some((x) => x.question === q && x.status === "pending");
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-dang9", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0107", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "9 Hồng Bàng", ward: "Phường 12", price_raw: "8 tỷ", price_vnd: 8e9, area_m2: 60, floors: 3, bedrooms: 3, alley_width_m: 5, legal_status: "so_hong_rieng", can_chu_duyet: true }).data;
    d.insert("listing_facts", { listing_id: l.id, question: "hinh_anh", answer: "https://x/1.jpg", source: "seller_chat" });
    d.insert("info_requests", { listing_id: l.id, question: "huong", status: "pending" });
  });
  r = await send({ external_user_id: "z-dang9", text: "được giá thì bán em, ok đăng tin đi em" });
  check("DANG9-01 câu DÀI 'được giá thì bán em, ok đăng tin đi em' khi đang treo câu hướng + tin ≥70 → LÊN KỆ ngay, không ghi cả câu làm 'thông tin bổ sung'",
    r.body.dang_luon === true && db().t.listings.find((l) => l.code === "BDS-Q5-0107")?.status === "dang_ban" && !db().t.listing_facts.some((f) => /đăng tin đi/.test(f.answer ?? "")),
    JSON.stringify({ body: r.body.replies, ir: db().t.info_requests.map((q) => [q.question, q.status]), f: db().t.listing_facts.map((f) => [f.question, f.answer]) }));
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-dang10", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0108", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "9 Hồng Bàng", ward: "Phường 12", price_raw: "8 tỷ", price_vnd: 8e9, area_m2: 60, can_chu_duyet: true }).data;
    d.insert("info_requests", { listing_id: l.id, question: "huong", status: "pending" });
  });
  r = await send({ external_user_id: "z-dang10", text: "chưa đăng tin đâu em, để anh tính thêm" });
  check("DANG9-02 'chưa đăng tin đâu em…' (phủ định) → KHÔNG gửi bản nháp", r.body.ban_nhap !== true, JSON.stringify(r.body.replies));
  // 24/09/2026 (chủ dự án test Zalo, tin 152 Trần Đình Xu): "…cần thông tin gì nữa không nếu không thì đăng bài đi" khi đang treo
  // câu hạn hợp đồng thuê → là lệnh ĐĂNG, không phải câu trả lời (trước: ghi cả câu vào ô hợp đồng, hỏi tiếp 3 câu).
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-dang12", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0110", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "9 Hồng Bàng", ward: "Phường 12", price_raw: "8 tỷ", price_vnd: 8e9, area_m2: 60, floors: 3, bedrooms: 3, alley_width_m: 5, legal_status: "so_hong_rieng", rent_income_vnd: 4e8, can_chu_duyet: true }).data;
    d.insert("listing_facts", { listing_id: l.id, question: "hinh_anh", answer: "https://x/1.jpg", source: "seller_chat" });
    d.insert("info_requests", { listing_id: l.id, question: "han_hop_dong_thue", status: "pending" });
  });
  r = await send({ external_user_id: "z-dang12", text: "Uhm em cần thông tin gì nữa không nếu không thì đăng bài đi" });
  check("DANG9-03 '…nếu không thì đăng bài đi' khi treo câu hạn hợp đồng → LÊN KỆ, không ghi câu đó vào ô nào",
    r.body.dang_luon === true && !db().t.listing_facts.some((f) => /đăng bài/.test(f.answer ?? "")),
    JSON.stringify({ body: r.body.replies, f: db().t.listing_facts.map((f) => [f.question, f.answer]) }));
  // Cùng buổi: "Hợp đồng 10 năm cho thuê 4 năm rồi đó" khi hỏi hạn hợp đồng → ô hạn hợp đồng, KHÔNG đè pháp lý;
  // hỏi phường, đáp "Quận 1 em ơi" → không thành "📝 Thêm".
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-hdt1", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0111", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "152 Trần Đình Xu", district: "Quận 1", price_raw: "65 tỷ", price_vnd: 65e9, area_m2: 120, floors: 5, bedrooms: 4, legal_status: "so_hong_rieng", rent_income_vnd: 4e8, can_chu_duyet: true }).data;
    s.active_listing_id = l.id;
    d.insert("listing_facts", { listing_id: l.id, question: "phap_ly", answer: "sổ hồng riêng", source: "seller_chat" });
    d.insert("info_requests", { listing_id: l.id, question: "han_hop_dong_thue", status: "pending" });
  });
  r = await send({ external_user_id: "z-hdt1", text: "Hợp đồng 10 năm cho thuê 4 năm rồi đó" });
  {
    const fs = db().t.listing_facts;
    check("HDT-01 'Hợp đồng 10 năm cho thuê 4 năm rồi đó' → ô hạn hợp đồng thuê, pháp lý vẫn 'sổ hồng riêng', không ghi 'thuê tối thiểu'",
      fs.some((f) => f.question === "han_hop_dong_thue" && /10 năm/.test(f.answer ?? "")) && !fs.some((f) => f.question === "phap_ly" && /hợp đồng/i.test(f.answer ?? "")) &&
        !fs.some((f) => f.question === "thoi_han_thue"),
      JSON.stringify(fs.map((f) => [f.question, f.answer])));
  }
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-hdt2", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0112", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "152 Trần Đình Xu", district: "Quận 1", price_raw: "65 tỷ", price_vnd: 65e9, area_m2: 120, can_chu_duyet: true }).data;
    s.active_listing_id = l.id;
    d.insert("info_requests", { listing_id: l.id, question: "phuong", status: "pending" });
  });
  r = await send({ external_user_id: "z-hdt2", text: "Quận 1 em ơi" });
  check("HDT-02 hỏi phường, đáp 'Quận 1 em ơi' → KHÔNG ghi vào 📝 Thêm (bo_sung)",
    !db().t.listing_facts.some((f) => f.question === "bo_sung"), JSON.stringify(db().t.listing_facts.map((f) => [f.question, f.answer])));
  // 24/09/2026 (chủ dự án test Zalo): "6 tỷ 3 đăng đi" khi đang hỏi GIÁ, tin chưa đủ điểm → ghi giá, ĐÓNG câu giá, báo còn
  // thiếu gì rồi hỏi câu KẾ — trước: coi cả câu là "muốn đăng", câu giá vẫn treo, bot hỏi lại "rao giá bao nhiêu".
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-dang11", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0109", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "Nguyễn Trãi", ward: "Phường 2", district: "Quận 5", area_m2: 56, can_chu_duyet: true }).data;
    s.active_listing_id = l.id;
    d.insert("info_requests", { listing_id: l.id, question: "gia", status: "pending" });
  });
  r = await send({ external_user_id: "z-dang11", text: "6 tỷ 3 đăng đi" });
  {
    const giaIr = db().t.info_requests.find((q) => q.question === "gia");
    const rp = (r.body.replies ?? []).filter((x) => !x.startsWith("🤖")).join("\n");
    check("DANG11-01 '6 tỷ 3 đăng đi' khi hỏi giá, tin chưa đủ điểm → fact giá '6 tỷ 3', câu giá ĐÃ trả lời, báo 'chỉ cần thêm …', KHÔNG hỏi lại giá",
      db().t.listing_facts.some((f) => f.question === "gia" && f.answer === "6 tỷ 3") && giaIr?.status === "answered" &&
        /chỉ cần thêm/.test(rp) && !/(?:rao )?giá bao nhiêu|thu về|giá mình muốn/i.test(rp),
      JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.map((q) => [q.question, q.status]), f: db().t.listing_facts.map((f) => [f.question, f.answer]) }));
  }
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-bancong", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-CH-Q5-0001", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "chung_cu", ward: "Phường 5", district: "Quận 5", price_raw: "4 tỷ 2", price_vnd: 4.2e9, area_m2: 80, can_chu_duyet: true }).data;
    s.active_listing_id = l.id;
    d.insert("info_requests", { listing_id: l.id, question: "huong", status: "pending" });
  });
  r = await send({ external_user_id: "z-bancong", text: "ban công hướng Đông nha em" });
  check("BANCONG-01 căn hộ đang hỏi hướng, 'ban công hướng Đông nha em' → KHÔNG mở tin nhà phố mới ('ban công' ≠ 'bán', 'nha' ≠ 'nhà'); câu hướng được trả lời",
    db().t.listings.length === 1 && !pendQ("huong"),
    JSON.stringify({ ls: db().t.listings.map((l) => [l.code, l.property_type]), ir: db().t.info_requests.map((q) => [q.question, q.status]), rep: r.body.replies }));
  // Đối chứng: câu rao THẬT có dấu "còn căn nhà hẻm … nữa" vẫn mở tin mới như cũ.
  r = await send({ external_user_id: "z-bancong", text: "à còn căn nhà hẻm 4m Nguyễn Trãi quận 5, 50m2, giá 6 tỷ nữa nha em" });
  check("BANCONG-02 câu rao thật 'còn căn nhà hẻm … giá 6 tỷ nữa' → vẫn mở tin mới", db().t.listings.length === 2, JSON.stringify(db().t.listings.map((l) => [l.code, l.property_type])));
}

// 30/09/2026 (chủ dự án, chat thử trên máy): "nhà chú ở 137/28 đường số 59 phường an hội tây nhé" nhắn TRƯỚC câu rao
// "chú muốn bán 15 tỏi có tl, nhà 45m2 5 tấm nhé" → địa chỉ mất, phường không nhận (thường, có dấu), giá "chưa đọc ra số"
// (mock thiếu "tỏi"); hỏi lại phường thì AI cắt "An Hội Tây" thành "An Hội". Bảng `wards` là 168 phường thật.
{
  const laLuotBocRaoAH = (p) => (p?.system ?? []).some((s) => /BÓC TÁCH TIN NHẮN NGƯỜI BÁN/.test(s.text ?? ""));
  const seedAH = (d) => {
    d.t.wards = napPhuongThat().map((w) => ({ ...w }));
    d.insert("sellers", { zalo_user_id: "ah-tay", seller_type: "ccrb", name: null, active_listing_id: null });
  };
  fresh(seedAH);
  const cuCH = globalThis.__cauHinh;
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
  globalThis.__model.parse = (p) => laLuotBocRaoAH(p) ? { so_can: 1, kien_thuc: [], truong: [{ khoa: "phuong", gia_tri: "Phường An Hội Tây", trich_dan: "phường an hội tây", can: null }] } : OUT();
  await send({ external_user_id: "ah-tay", text: "nhà chú ở 137/28 đường số 59 phường an hội tây nhé" });
  const rAH = await send({ external_user_id: "ah-tay", text: "chú muốn bán 15 tỏi có tl, nhà 45m2 5 tấm nhé" });
  const lAH = db().t.listings.at(-1);
  const fAH = (q) => db().t.listing_facts.filter((f) => f.listing_id === lAH?.id && f.question === q).map((f) => f.answer);
  check("AHT-01 địa chỉ nói TRƯỚC câu rao → tin mới có phường 'Phường An Hội Tây' (viết thường có dấu vẫn nhận)",
    lAH?.ward === "Phường An Hội Tây", JSON.stringify({ l: lAH && { ward: lAH.ward, district: lAH.district, loc: lAH.location_raw }, rep: rAH.body.replies }));
  check("AHT-02 phường An Hội Tây → quận cũ Gò Vấp (từ bảng wards), không hỏi lại quận",
    lAH?.district === "Quận Gò Vấp", JSON.stringify({ district: lAH?.district }));
  check("AHT-03 vị trí giữ số nhà hẻm '137/28 đường số 59' (hẻm 137, nhà số 28)",
    [lAH?.location_raw, ...fAH("vi_tri")].some((v) => /137\/28 đường số 59/i.test(v ?? "")), JSON.stringify({ loc: lAH?.location_raw, vt: fAH("vi_tri") }));
  check("AHT-04 '15 tỏi có tl' → price_vnd 15 tỷ (mock parse_vnd đọc 'tỏi' như bản thật)",
    Number(lAH?.price_vnd) === 15e9, JSON.stringify({ raw: lAH?.price_raw, vnd: lAH?.price_vnd }));
  check("AHT-05 không hỏi lại phường khách đã nói",
    !db().t.info_requests.some((x) => x.listing_id === lAH?.id && x.question === "phuong" && x.status === "pending"),
    JSON.stringify(db().t.info_requests.filter((x) => x.listing_id === lAH?.id).map((x) => [x.question, x.status])));

  // AI (chế độ chinh) đọc câu trả lời phường ra "Phường An Hội" — cắt mất "Tây". Chốt với bảng wards → An Hội Tây.
  fresh(seedAH);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
  globalThis.__model.parse = (p) => laLuotBocRaoAH(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
  await send({ external_user_id: "ah-tay", text: "chú muốn bán nhà hẻm đường số 59, 45m2 5 tấm, giá 15 tỷ" });
  const lAI = db().t.listings.at(-1);
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: lAI.id, question: "phuong", status: "pending" });
  globalThis.__model.parse = (p) => laLuotBocRaoAH(p)
    ? { so_can: 0, kien_thuc: [], truong: [{ khoa: "phuong", gia_tri: "Phường An Hội Tây", trich_dan: "phường an hội tây", can: null }], tra_loi: { co_tra_loi: true, gia_tri: "Phường An Hội Tây", trich_dan: "phường an hội tây" } }
    : OUT();
  const rAI = await send({ external_user_id: "ah-tay", text: "phường an hội tây quận gò vấp" });
  const lAI2 = db().t.listings.find((l) => l.id === lAI.id);
  const fPh = db().t.listing_facts.filter((f) => f.listing_id === lAI.id && f.question === "phuong").map((f) => f.answer);
  check("AHT-06 AI đọc 'Phường An Hội' (cắt chữ) khi khách 'phường an hội tây quận gò vấp' → ghi 'Phường An Hội Tây', không ghi 'Phường An Hội'",
    fPh.includes("Phường An Hội Tây") && !fPh.includes("Phường An Hội") && lAI2?.ward !== "Phường An Hội",
    JSON.stringify({ fPh, ward: lAI2?.ward, rep: rAI.body.replies }));
  check("AHT-07 quận chưa rõ → lấy quận cũ của phường: Quận Gò Vấp", lAI2?.district === "Quận Gò Vấp", JSON.stringify({ district: lAI2?.district }));
  globalThis.__model.parse = (p) => laLuotBocRaoAH(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
  globalThis.__cauHinh = cuCH;
}

// 30/09/2026 (chủ dự án: "còn mấy hẻm khác còn nhiều / nhỏ và nhỏ hơn nữa … vector đường lớn phường quận mới và cũ và dự án
// … nhắc tới gần đúng sẽ biết cái nào đúng và sửa vào, kết hợp với vị trí nữa, để biết đường nào gần đường nào").
// Từ điển `duong` nay có đường số + hẻm + toạ độ, bảng `phuong_cu`; bot dùng vị trí để biết phường / sửa tên đường.
{
  const PHUONG_CU_E2E = await napPhuongCuThat();
  const seedVT = (d) => {
    d.t.wards = napPhuongThat().map((w) => ({ ...w }));
    d.t.phuong_cu = PHUONG_CU_E2E.map((c) => ({ ...c }));
    const duong = (ten, phuong, quan_cu, loai, lat, lng, so_hem = null, duong_me = null) =>
      d.insert("duong", { ten, ten_khong_dau: ten.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(), tinh: "TP.HCM", phuong, quan_cu, loai, lat, lng, so_hem, duong_me });
    duong("Đường số 59", "Phường An Hội Tây", "Quận Gò Vấp", "so", 10.853604, 106.651747);
    duong("Hẻm 137 Đường số 59", "Phường An Hội Tây", "Quận Gò Vấp", "hem", 10.8538, 106.6519, "137", "Đường số 59");
    duong("Trần Bình Trọng", "Phường Chợ Quán", "Quận 5", "duong", 10.7560, 106.6780);
    duong("Trần Bình Trọng", "Phường Vườn Lài", "Quận 10", "duong", 10.7640, 106.6700);
    duong("Trần Bình Trọng", "Phường Bình Lợi Trung", "Quận Bình Thạnh", "duong", 10.8100, 106.7000);
    duong("An Dương Vương", "Phường Chợ Quán", "Quận 5", "duong", 10.7570, 106.6770);
    duong("An Dương Vương", "Phường An Lạc", "Quận Bình Tân", "duong", 10.7300, 106.6100);
    duong("Phạm Thế Hiển", "Phường Chánh Hưng", "Quận 8", "duong", 10.7400, 106.6600);
  };
  const cuCH2 = globalThis.__cauHinh;
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "tat" };
  const tatCa = (r) => r.body.replies.join("\n");

  // (a) Số hẻm + đường mẹ → đúng một phường → hỏi xác nhận phường đó (không hỏi trống "phường mấy").
  fresh(seedVT); globalThis.__nominatim = [];
  let rv = await send({ external_user_id: "vt-hem", text: "chú bán nhà 137/28 đường số 59 gò vấp, 45m2, giá 15 tỷ" });
  let lv = db().t.listings.at(-1);
  check("AHT-08 '137/28 đường số 59' → tra hẻm 137 của đường số 59 → hỏi xác nhận Phường An Hội Tây, cất gợi ý",
    /hẻm 137 đường số 59 thuộc Phường An Hội Tây/i.test(tatCa(rv)) && lv?.boc_tach?.phuong_goi_y?.phuong === "Phường An Hội Tây",
    JSON.stringify({ rep: rv.body.replies, bt: lv?.boc_tach, loc: lv?.location_raw, d: lv?.district }));

  // (b) Đường có ở ba phường, khách nhắc KÈM con đường thứ hai → phường nơi hai đường gần nhau.
  fresh(seedVT); globalThis.__nominatim = [];
  rv = await send({ external_user_id: "vt-giao", text: "bán nhà hẻm Trần Bình Trọng gần An Dương Vương, 60m2, giá 9 tỷ" });
  lv = db().t.listings.at(-1);
  check("AHT-09 'Trần Bình Trọng gần An Dương Vương' (đường có ở 3 phường) → Phường Chợ Quán (hai đường cách nhau vài trăm mét), hỏi xác nhận",
    /Trần Bình Trọng \(gần An Dương Vương\) thuộc Phường Chợ Quán/.test(tatCa(rv)) && lv?.boc_tach?.phuong_goi_y?.phuong === "Phường Chợ Quán",
    JSON.stringify({ rep: rv.body.replies, bt: lv?.boc_tach, rpc: db().log.filter((x) => x.rpc).map((x) => [x.rpc, JSON.stringify(x.args).slice(0, 120)]), ir: db().t.info_requests.map((q) => [q.question, q.status]) }));

  // (c) Tên phường CŨ → phường mới + quận cũ theo wards.
  fresh(seedVT); globalThis.__nominatim = [];
  { const bp = (p) => (p?.system ?? []).some((s) => /BÓC TÁCH TIN NHẮN NGƯỜI BÁN/.test(s.text ?? "")); globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh" }; globalThis.__model.parse = (p) => bp(p) ? { so_can: 1, kien_thuc: [], truong: [{ khoa: "phuong", gia_tri: "Phường An Khánh", trich_dan: "phường thảo điền", can: null }] } : OUT(); }
  rv = await send({ external_user_id: "vt-cu", text: "bán nhà phường thảo điền 100m2 giá 20 tỷ" });
  lv = db().t.listings.at(-1);
  check("AHT-10 'phường thảo điền' (phường cũ) → ward Phường An Khánh, quận Quận 2",
    lv?.ward === "Phường An Khánh" && lv?.district === "Quận 2", JSON.stringify({ w: lv?.ward, d: lv?.district, rep: rv.body.replies }));

  // (d) Tên đường gõ sai 1 chữ, quận đã nói và đường đó có trong quận → sửa luôn, không hỏi.
  fresh(seedVT); globalThis.__nominatim = [];
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "tat" }; globalThis.__model.parse = () => OUT();
  rv = await send({ external_user_id: "vt-sua", text: "bán nhà 12 pham the hier quận 8, 50m2, giá 5 tỷ" });
  lv = db().t.listings.at(-1);
  check("AHT-11 'pham the hier quận 8' → địa chỉ sửa thành Phạm Thế Hiển (đường có trong Quận 8), KHÔNG hỏi 'phải không'",
    /Phạm Thế Hiển/.test(lv?.location_raw ?? "") && !lv?.boc_tach?.duong_goi_y && !/Phạm Thế Hiển (?:đúng|phải) không/.test(tatCa(rv)),
    JSON.stringify({ loc: lv?.location_raw, bt: lv?.boc_tach, rep: rv.body.replies }));
  globalThis.__cauHinh = cuCH2;
}

{ const PHUONG_CU_E2E3 = await napPhuongCuThat();
// 30/09/2026 — bắn thử bằng `bun run chat` (4 lượt, ~30 câu), các lỗi luật tìm ra và đã sửa:
{
const aiPhuong = (gia_tri, trich) => { globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" }; globalThis.__model.parse = (p) => (p?.system ?? []).some((s) => /BÓC TÁCH TIN NHẮN NGƯỜI BÁN/.test(s.text ?? "")) ? { so_can: 1, kien_thuc: [], truong: gia_tri ? [{ khoa: "phuong", gia_tri, trich_dan: trich, can: null }] : [] } : OUT(); };
const aiTat = () => { globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "tat" }; globalThis.__model.parse = () => OUT(); };
  const seedCT = (d) => { d.t.wards = napPhuongThat().map((w) => ({ ...w })); };
  const cuCH3 = globalThis.__cauHinh;
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "tat" };

  // (1) Người lạ được hỏi vai, đáp bằng câu rao KHÔNG có chữ loại → phải là người BÁN (trước: khách mua ngân sách 6 tỷ).
  fresh(seedCT);
  aiPhuong("Phường Tân Định", "phường tân định");
  await send({ external_user_id: "ct-vai", text: "nhà mình ở phường tân định quận 1 nhé" });
  let rc = await send({ external_user_id: "ct-vai", text: "hẻm 3m, 3x15, 2 lầu, bán 6 tỷ thương lượng" });
  let lc = db().t.listings.at(-1);
  check("CT-01 đáp câu hỏi vai bằng 'hẻm 3m, 3x15, 2 lầu, bán 6 tỷ' → người BÁN, tin 6 tỷ, phường Tân Định từ câu nói trước",
    rc.body.role === "seller" && Number(lc?.price_vnd) === 6e9 && lc?.ward === "Phường Tân Định" && lc?.district === "Quận 1",
    JSON.stringify({ role: rc.body.role, l: lc && { w: lc.ward, d: lc.district, p: lc.price_vnd }, rep: rc.body.replies }));

  // (2) Trả lời câu ĐỊA CHỈ kèm phường → vị trí gọn + phường + quận cũ (trước: nguyên câu vào vị trí, phường mất).
  fresh(seedCT);
  aiTat();
  await send({ external_user_id: "ct-vt", text: "chào em" });
  await send({ external_user_id: "ct-vt", text: "có nhà muốn bán" });
  const lvt = db().t.listings.at(-1);
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: lvt.id, question: "vi_tri", status: "pending" });
  aiPhuong("Phường An Hội Tây", "phường an hội tây");
  rc = await send({ external_user_id: "ct-vt", text: "nhà ở 137/28 đường số 59 phường an hội tây gò vấp" });
  lc = db().t.listings.find((l) => l.id === lvt.id);
  check("CT-02 trả lời địa chỉ 'nhà ở 137/28 đường số 59 phường an hội tây gò vấp' → vị trí '137/28 đường số 59', phường An Hội Tây, quận Gò Vấp",
    lc?.location_raw === "137/28 đường số 59" && lc?.ward === "Phường An Hội Tây" && lc?.district === "Quận Gò Vấp",
    JSON.stringify({ l: lc && { loc: lc.location_raw, w: lc.ward, d: lc.district }, rep: rc.body.replies }));

  // (3) Số nhà + tên đường + tên quận trần (không chữ "quận") → có địa chỉ (trước: rơi mất).
  fresh(seedCT);
  rc = await send({ external_user_id: "ct-pn", text: "bán nhà 20 hồ biểu chánh phú nhuận 4x16 3 lầu 13 tỷ" });
  lc = db().t.listings.at(-1);
  check("CT-03 '20 hồ biểu chánh phú nhuận' → vị trí '20 hồ biểu chánh', quận Phú Nhuận",
    /^20 h[ồo] bi[ểe]u ch[áa]nh$/i.test(lc?.location_raw ?? "") && lc?.district === "Quận Phú Nhuận", JSON.stringify({ loc: lc?.location_raw, d: lc?.district }));

  // (4) Chữ nối dính cuối địa chỉ.
  fresh(seedCT);
  rc = await send({ external_user_id: "ct-gan", text: "bán nhà hẻm xe hơi nguyen van cu gần trần hưng đạo, 50m2, trệt 2 lầu, giá 9 tỏi rưỡi" });
  lc = db().t.listings.at(-1);
  check("CT-04 địa chỉ không dính chữ 'gần' cuối; '9 tỏi rưỡi' = 9,5 tỷ",
    !/gần\s*$/.test(lc?.location_raw ?? "gần") && Number(lc?.price_vnd) === 9.5e9, JSON.stringify({ loc: lc?.location_raw, p: lc?.price_vnd }));

  // (5) Tên phường cũ dễ nhầm với phường mới ngắn hơn.
  fresh((d) => { seedCT(d); d.t.phuong_cu = PHUONG_CU_E2E3.map((c) => ({ ...c })); });
  aiPhuong("Xã Tân Vĩnh Lộc", "xã vĩnh lộc b");
  rc = await send({ external_user_id: "ct-vlb", text: "bán đất xã vĩnh lộc b bình chánh 5x20 giá 3 tỷ 2" });
  lc = db().t.listings.at(-1);
  check("CT-05 'xã vĩnh lộc b' (cũ) → Xã Tân Vĩnh Lộc, KHÔNG phải Xã Vĩnh Lộc", lc?.ward === "Xã Tân Vĩnh Lộc", JSON.stringify({ w: lc?.ward }));
  globalThis.__cauHinh = cuCH3;
}

}
// ── SRS-5.1y: TRỢ LÝ CÓ CÔNG CỤ (nhánh mua, công tắc app_config.tro_ly) ─────────────────────────────────────────────
{
  const cuCH = globalThis.__cauHinh;
  const seedTL = (d) => {
    seedKho(d);
    const L = d.t.listings.find((l) => l.code === "BDS-Q5-0001"); L.lat = 10.755; L.lng = 106.67;
    d.t.tien_ich = [
      { osm_id: "n/1", loai: "truong_hoc", ten: "Trường Tiểu học Chương Dương", ten_kd: "truong tieu hoc chuong duong", lat: 10.757, lng: 106.671 },
      { osm_id: "n/2", loai: "cho", ten: "Chợ Hoà Bình", ten_kd: "cho hoa binh", lat: 10.7595, lng: 106.6705 },
      { osm_id: "n/3", loai: "truong_hoc", ten: "Trường Xa Lắc", ten_kd: "truong xa lac", lat: 10.80, lng: 106.70 },
    ];
    for (const uid of ["thu-tl1", "thu-tl2", "thu-tl5", "khach-that-tl4", "thu-tl3"]) {
      const b = d.insert("buyers", { zalo_user_id: uid, name: null, preferences: { deal: "ban", area: "Quận 5", budget: "tầm 6 tỷ" } }).data;
      d.insert("conversations", { buyer_id: b.id, channel: "zalo_personal_test", started_at: "2026-09-01T00:00:00Z" });
    }
  };
  const goiTroLy = () => globalThis.__calls.filter((c) => c.kind === "create" && c.params.tools);

  // TL-E2E-01: khách hỏi trường quanh căn → model gọi tim_tien_ich_quanh → kết quả thật từ tien_ich (đo khoảng cách bằng
  // code) → lời trả lời giữ nguyên tên trường (lưới gọt tên riêng coi kết quả công cụ là ngữ cảnh), không qua đường JSON.
  fresh(seedTL);
  globalThis.__cauHinh = { test_reset_hello: "1", tro_ly: "thu" };
  let kqCongCu = null;
  globalThis.__model.troLy = (p) => {
    const cuoi = p.messages.at(-1);
    if (Array.isArray(cuoi.content) && cuoi.content[0]?.type === "tool_result") {
      kqCongCu = cuoi.content[0].content;
      return { stop_reason: "end_turn", content: [{ type: "text", text: "Dạ gần căn #BDS-Q5-0001 có Trường Tiểu học Chương Dương khoảng 250 m ạ. Mình có bé đang học cấp mấy ạ?" }] };
    }
    return { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu1", name: "tim_tien_ich_quanh", input: { khu_vuc: "BDS-Q5-0001", loai: "truong_hoc" } }] };
  };
  let rt = await send({ external_user_id: "thu-tl1", text: "căn BDS-Q5-0001 gần đó có trường tiểu học nào không em" });
  check("TL-E2E-01a công cụ đọc ra trường trong bán kính, khoảng cách code đo (~250 m), không kèm trường xa",
    /Trường Tiểu học Chương Dương ~250 m/.test(kqCongCu ?? "") && !/Xa Lắc/.test(kqCongCu ?? ""), String(kqCongCu));
  check("TL-E2E-01b lời trả lời giữ tên trường từ dữ liệu công cụ, payload ghi công cụ đã gọi, KHÔNG gọi đường JSON",
    /Chương Dương/.test(rt.body.reply ?? "") && rt.body.tro_ly?.cong_cu?.join() === "tim_tien_ich_quanh" && parseCalls().length === 0 &&
      /Chương Dương/.test(rt.body.tro_ly?.van_goc?.[0] ?? "") && /Chương Dương ~250 m/.test(rt.body.tro_ly?.du_lieu?.[0] ?? ""),
    JSON.stringify({ b: rt.body, parse: parseCalls().length }));
  check("TL-E2E-01c system lượt trợ lý dùng lời dặn công cụ, không còn lời dặn JSON",
    /chế độ trợ lý có công cụ/.test(goiTroLy()[0]?.params.system[0].text ?? "") && !/trả về DUY NHẤT một object JSON/.test(goiTroLy()[0]?.params.system[0].text ?? ""));

  // TL-E2E-02: model ghi hồ sơ — trường có lời khách làm chứng thì vào hồ sơ; trường bịa (3 phòng ngủ) KHÔNG vào.
  fresh(seedTL);
  globalThis.__cauHinh = { test_reset_hello: "1", tro_ly: "thu" };
  globalThis.__model.troLy = (p) => {
    const cuoi = p.messages.at(-1);
    if (Array.isArray(cuoi.content) && cuoi.content[0]?.type === "tool_result") {
      return { stop_reason: "end_turn", content: [{ type: "text", text: "Dạ em ghi mình cần hẻm xe hơi rồi ạ. Mình cần mấy phòng ngủ ạ?" }] };
    }
    return { stop_reason: "tool_use", content: [
      { type: "text", text: "Dạ em ghi hẻm xe hơi, 3 phòng ngủ rồi nha." },
      { type: "tool_use", id: "g1", name: "ghi_ho_so_mua", input: { truong: [
        { khoa: "alley", gia_tri: "hẻm xe hơi", trich_dan: "hem xe hoi" },
        { khoa: "bedrooms", gia_tri: "3", trich_dan: "3 phòng ngủ" },
      ] } },
    ] };
  };
  rt = await send({ external_user_id: "thu-tl2", text: "anh cần hem xe hoi nha em" });
  const hsTL2 = db().t.buyers.find((b) => b.zalo_user_id === "thu-tl2")?.preferences ?? {};
  check("TL-E2E-02 hẻm xe hơi vào hồ sơ; '3 phòng ngủ' (khách không nói) không vào; lời 'em ghi 3 phòng ngủ' không tới khách",
    /xe h[ơo]i/.test(String(hsTL2.alley ?? "")) && hsTL2.bedrooms == null && !/3 phòng ngủ/.test(rt.body.reply ?? "") && goiTroLy().length === 2,
    JSON.stringify({ hs: hsTL2, rep: rt.body.reply, n: goiTroLy().length }));

  // TL-E2E-03: công tắc không có dòng (= tắt) → đường JSON cũ, không lượt nào kèm công cụ.
  fresh(seedTL);
  globalThis.__cauHinh = { test_reset_hello: "1" };
  globalThis.__model.troLy = () => { throw new Error("không được gọi"); };
  rt = await send({ external_user_id: "thu-tl3", text: "quanh đó có chợ không em" });
  check("TL-E2E-03 công tắc tắt → đường JSON, không gọi trợ lý", goiTroLy().length === 0 && parseCalls().length === 1 && !rt.body.tro_ly, JSON.stringify(rt.body));

  // TL-E2E-04: công tắc `thu` mà ID THẬT → đường JSON (chỉ ID thử theo la_id_thu mới dùng trợ lý).
  fresh(seedTL);
  globalThis.__cauHinh = { test_reset_hello: "1", tro_ly: "thu" };
  globalThis.__model.troLy = () => { throw new Error("không được gọi"); };
  rt = await send({ external_user_id: "khach-that-tl4", text: "quanh đó có chợ không em" });
  check("TL-E2E-04 'thu' + ID thật → đường JSON", goiTroLy().length === 0 && parseCalls().length === 1, JSON.stringify(rt.body));

  // TL-E2E-05: trợ lý chết (model ném) → ghi sổ lỗi, đường JSON trả lời ngay trong lượt.
  fresh(seedTL);
  globalThis.__cauHinh = { test_reset_hello: "1", tro_ly: "thu" };
  globalThis.__model.troLy = () => { throw new Error("529 overloaded"); };
  rt = await send({ external_user_id: "thu-tl5", text: "quanh đó có chợ không em" });
  check("TL-E2E-05 trợ lý ném → sổ lỗi 'chat-reply tro ly' + đường JSON trả lời",
    goiTroLy().length === 1 && parseCalls().length === 1 && rt.body.replies?.length > 0 && db().t.bot_errors.some((e) => e.source === "chat-reply tro ly") && rt.body.tro_ly?.ly_do === "loi" && rt.body.tro_ly?.vong === 0,
    JSON.stringify({ b: rt.body, err: db().t.bot_errors }));

  // TL-E2E-06 (bắn thật 02/10 "quanh chợ An Đông có trường tiểu học nào" → bot hỏi ngược "chợ An Đông ở đường nào"): kho căn
  // không định vị được mốc → câu dặn của đường JSON ép HỎI LẠI KHÁCH; ở chế độ trợ lý câu dặn phải cho gọi công cụ trước.
  fresh(seedTL);
  globalThis.__cauHinh = { test_reset_hello: "1", tro_ly: "thu" };
  globalThis.__rpc = { tin_gan_moc: () => ({ data: [], error: null }), co_moc: () => ({ data: false, error: null }) };
  globalThis.__model.parse = (p) => laLuotGan(p) ? { muon_gan: true, loai: "cho", ten: "An Đông", cap_truong: null, ban_kinh_m: null, bo_dieu_kien: false } : OUT();
  let sysTL6 = "";
  globalThis.__model.troLy = (p) => { sysTL6 = p.system[1].text; return { stop_reason: "end_turn", content: [{ type: "text", text: "Dạ em xem giúp anh nha." }] }; };
  rt = await send({ external_user_id: "thu-tl5", text: "quanh chợ An Đông có trường tiểu học nào không em" });
  check("TL-E2E-06 kho chưa định vị được mốc → system trợ lý dặn gọi tim_tien_ich_quanh trước, không ép hỏi lại khách",
    /CHƯA định vị được nơi đó/.test(sysTL6) && /gọi tim_tien_ich_quanh TRƯỚC/.test(sysTL6) && !/hỏi lại khách nơi đó ở đường nào/.test(sysTL6),
    sysTL6.slice(0, 600));
  globalThis.__rpc = {};

  // TL-E2E-07 (bắn thật 02/10): model gửi khu vực KÈM đuôi quận "chợ Hoà Bình, Quận 5" — cả chuỗi không khớp tên mốc
  // ("cho hoa binh"); công cụ phải thử bản bỏ đuôi và ra trường quanh chợ.
  fresh(seedTL);
  globalThis.__cauHinh = { test_reset_hello: "1", tro_ly: "thu" };
  let kqTL7 = null;
  globalThis.__model.troLy = (p) => {
    const cuoi = p.messages.at(-1);
    if (Array.isArray(cuoi.content) && cuoi.content[0]?.type === "tool_result") {
      kqTL7 = cuoi.content[0].content;
      return { stop_reason: "end_turn", content: [{ type: "text", text: "Dạ quanh chợ Hoà Bình có Trường Tiểu học Chương Dương khoảng 300 m ạ." }] };
    }
    return { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t7", name: "tim_tien_ich_quanh", input: { khu_vuc: "chợ Hoà Bình, Quận 5", loai: "truong_hoc" } }] };
  };
  rt = await send({ external_user_id: "thu-tl1", text: "quanh chợ Hoà Bình quận 5 có trường nào không em" });
  check("TL-E2E-07 'chợ Hoà Bình, Quận 5' định vị qua mốc tien_ich (bỏ đuôi quận) → ra trường trong bán kính",
    /^Quanh Chợ Hoà Bình/.test(kqTL7 ?? "") && /Chương Dương/.test(kqTL7 ?? ""), String(kqTL7));

  // TL-E2E-08 (bắn thật 02/10 thu-trl-04): khách mua xưng "mình", model gọi "chị ơi" — nhánh mua chưa biết giới tính thì
  // không gọi theo giới (lưới chung với nhánh bán, `boGoiDoanGioi`).
  fresh(seedTL);
  globalThis.__cauHinh = { test_reset_hello: "1", tro_ly: "thu" };
  globalThis.__model.troLy = () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "Dạ được chị ơi :) Mình cần mấy phòng ngủ vậy chị?" }] });
  rt = await send({ external_user_id: "thu-tl9", text: "minh muon mua nha, cho minh hoi chut" });
  check("TL-E2E-08 chưa biết anh hay chị → 'chị ơi' thành 'anh chị ơi', '…vậy chị?' thành '…vậy ạ?' (05/10: không còn 'mình')",
    /anh chị ơi/.test(rt.body.reply ?? "") && !/\bchị\b/i.test(rt.body.reply ?? ""), String(rt.body.reply));

  // TL-E2E-09 (bắn thật 02/10 thu-trl-05): model tự kể "Bệnh viện Chợ Rẫy khoảng 500m" không gọi công cụ → code nhắc một lần
  // → model tra → lời trả lời theo dữ liệu thật; payload ghi số lần nhắc.
  fresh(seedTL);
  globalThis.__cauHinh = { test_reset_hello: "1", tro_ly: "thu" };
  let luotTL9 = 0;
  globalThis.__model.troLy = (p) => {
    luotTL9++;
    const cuoi = p.messages.at(-1);
    const noiDung = Array.isArray(cuoi.content) ? cuoi.content : [];
    if (noiDung.some((c) => c.type === "tool_result")) return { stop_reason: "end_turn", content: [{ type: "text", text: "Dạ gần căn này có Trường Tiểu học Chương Dương khoảng 250 m ạ." }] };
    if (noiDung.some((c) => c.type === "text" && /HỆ THỐNG/.test(c.text ?? ""))) {
      return { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t9", name: "tim_tien_ich_quanh", input: { khu_vuc: "BDS-Q5-0001", loai: "truong_hoc" } }] };
    }
    return { stop_reason: "end_turn", content: [{ type: "text", text: "Dạ gần căn này có trường Nguyễn Du khoảng 900m ạ." }] };
  };
  rt = await send({ external_user_id: "thu-tl1", text: "căn BDS-Q5-0001 gần trường nào không em" });
  check("TL-E2E-09 khoảng cách không nguồn → nhắc, tra công cụ, trả lời theo dữ liệu; payload nhac_khoang_cach = 1",
    luotTL9 === 3 && /Chương Dương/.test(rt.body.reply ?? "") && !/900/.test(rt.body.reply ?? "") && rt.body.tro_ly?.nhac_khoang_cach === 1,
    JSON.stringify({ n: luotTL9, b: rt.body }));

  // TL-E2E-10 (bắn thật 02/10 thu-trl-07): khách hỏi trường TIỂU HỌC — công cụ lọc đúng cấp; không có cấp đó thì nói rõ
  // "KHÔNG có trường … nào" và các trường gần nhất đều ghi CẤP, để model không gọi THCS là tiểu học.
  fresh((d) => { seedTL(d); d.t.tien_ich.push({ osm_id: "n/4", loai: "truong_hoc", ten: "Trường Trung học Cơ sở Lý Phong", ten_kd: "truong trung hoc co so ly phong", lat: 10.7555, lng: 106.6705 }); });
  globalThis.__cauHinh = { test_reset_hello: "1", tro_ly: "thu" };
  const kqTL10 = [];
  globalThis.__model.troLy = (p) => {
    const cuoi = p.messages.at(-1);
    if (Array.isArray(cuoi.content) && cuoi.content.some((c) => c.type === "tool_result")) {
      kqTL10.push(...cuoi.content.filter((c) => c.type === "tool_result").map((c) => c.content));
      return { stop_reason: "end_turn", content: [{ type: "text", text: "Dạ em xem rồi ạ." }] };
    }
    return { stop_reason: "tool_use", content: [
      { type: "tool_use", id: "a", name: "tim_tien_ich_quanh", input: { khu_vuc: "BDS-Q5-0001", loai: "truong_hoc", cap_truong: "tieu_hoc" } },
      { type: "tool_use", id: "b", name: "tim_tien_ich_quanh", input: { khu_vuc: "BDS-Q5-0001", loai: "truong_hoc", cap_truong: "thpt" } },
    ] };
  };
  rt = await send({ external_user_id: "thu-tl1", text: "căn BDS-Q5-0001 gần trường tiểu học nào không em" });
  check("TL-E2E-10a cap tieu_hoc → chỉ trường tiểu học, dòng ghi '(tiểu học)', không kèm THCS Lý Phong",
    /trường học \(tiểu học\): Trường Tiểu học Chương Dương/.test(kqTL10[0] ?? "") && !/Lý Phong/.test(kqTL10[0] ?? ""), String(kqTL10[0]));
  check("TL-E2E-10b cap thpt không có → 'KHÔNG có trường THPT nào', trường gần nhất ghi đúng cấp (THCS)",
    /KHÔNG có trường THPT nào/.test(kqTL10[1] ?? "") && /trường học \(THCS\): Trường Trung học Cơ sở Lý Phong/.test(kqTL10[1] ?? ""), String(kqTL10[1]));

  // HS-E2E-01 (02/10/2026): đường JSON cũ (trợ lý tắt) — model ghi "vợ chồng + 2 con nhỏ" và 2 phòng ngủ từ "nhà có 2 con nhỏ"
  // → hồ sơ không nhận hai trường đó; trường có chữ khách thì vẫn ghi.
  fresh(seedTL);
  globalThis.__cauHinh = { test_reset_hello: "1" };
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, alley: "hẻm xe hơi", bedrooms: 2, nguoi_o_cung: "vợ chồng + 2 con nhỏ" } });
  rt = await send({ external_user_id: "thu-tl3", text: "minh can hem xe hoi, nha co 2 con nho" });
  const hsHS = db().t.buyers.find((b) => b.zalo_user_id === "thu-tl3")?.preferences ?? {};
  check("HS-E2E-01 đường JSON cũ: chữ khách không nói (vợ chồng, 2 phòng ngủ) không vào hồ sơ; hẻm xe hơi vẫn vào",
    hsHS.nguoi_o_cung == null && hsHS.bedrooms == null && /xe h[ơo]i/.test(String(hsHS.alley ?? "")), JSON.stringify(hsHS));

  // TL-E2E-11 (02/10/2026, bắn D1 "còn bệnh viện gần đó thì sao"): model gọi công cụ mãi không viết lời → vòng CUỐI gửi
  // tool_choice none, model buộc trả lời bằng dữ liệu đã tra; không rơi về đường JSON cũ.
  fresh(seedTL);
  globalThis.__cauHinh = { test_reset_hello: "1", tro_ly: "thu" };
  globalThis.__model.troLy = (p) => p.tool_choice?.type === "none"
    ? { stop_reason: "end_turn", content: [{ type: "text", text: "Dạ quanh căn #BDS-Q5-0001 có Chợ Hoà Bình khoảng 500 m ạ." }] }
    : { stop_reason: "tool_use", content: [{ type: "tool_use", id: `tu${Math.random()}`, name: "tim_tien_ich_quanh", input: { khu_vuc: "BDS-Q5-0001", loai: "cho" } }] };
  rt = await send({ external_user_id: "thu-tl1", text: "căn BDS-Q5-0001 gần chợ nào không em" });
  check("TL-E2E-11 hết vòng công cụ → vòng cuối tool_choice none, trả lời bằng dữ liệu đã tra, không qua đường JSON cũ",
    goiTroLy().at(-1)?.params?.tool_choice?.type === "none" && /Hoà Bình/.test(rt.body.reply ?? "") && parseCalls().length === 0 && rt.body.tro_ly?.vong === 4,
    JSON.stringify({ b: rt.body, n: goiTroLy().length }));

  // TL-E2E-12: trợ lý hỏng (model từ chối) → payload nói LÝ DO; đường JSON cũ kể "bệnh viện … khoảng 800m" không nguồn →
  // lưới khoảng cách (nay chạy cho MỌI đường) bỏ câu đó.
  fresh(seedTL);
  globalThis.__cauHinh = { test_reset_hello: "1", tro_ly: "thu" };
  globalThis.__model.troLy = () => ({ stop_reason: "refusal", content: [] });
  globalThis.__model.parse = () => OUT({ replies: ["Dạ gần đó có Bệnh viện Chợ Rẫy khoảng 800m ạ.", "Mình muốn nhà hẻm hay mặt tiền ạ?"] });
  rt = await send({ external_user_id: "thu-tl9", text: "minh muon mua nha, benh vien gan do thi sao" });
  check("TL-E2E-12 trợ lý hỏng → ly_do 'tu_choi'; đường cũ nêu khoảng cách không nguồn → bỏ câu đó, giữ câu hỏi",
    rt.body.tro_ly?.ly_do === "tu_choi" && !/800\s*m/.test(rt.body.reply ?? "") && /hẻm hay mặt tiền/.test(rt.body.reply ?? ""),
    JSON.stringify(rt.body));
  globalThis.__cauHinh = cuCH;
}
// ── SRD Aioinhadat 05/10/2026 — keep-alive "còn bán không" (SRS-5.1zzc), phường từ câu hỏi (SRS-5.1zzh), trần hạng Đồng +
//    NMG Vàng ưu tiên khách nét (SRS-5.1zzf) ──
{
  const cuCH = globalThis.__cauHinh;
  const laLuotBocRaoCB = (p) => (p?.system ?? []).some((s) => /BÓC TÁCH TIN NHẮN NGƯỜI BÁN/.test(s.text ?? ""));
  const laLuotYLuotCB = (p) => (p?.system ?? []).some((s) => /Ý NGẮN CỦA LƯỢT/.test(s.text ?? ""));
  const tinCB = () => db().t.listings.find((l) => l.code === "BDS-Q5-0001");
  const qCB = () => db().t.info_requests.find((x) => x.question === "con_ban");
  const moConBan = () => {
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: tinCB().id, question: "con_ban", status: "pending", source: "seller_flow", assignee: "seller" });
  };
  // (1) AI tắt → luật đỡ `docTraLoiConBan`. Trước bản sửa (thăm dò 05/10): "còn em" không đóng dấu; "vẫn đang bán nha" bị hỏi
  //     "căn đó hay căn khác"; "ừ" làm câu bị thôi; "bán rồi em" hỏi "căn nào" dù câu đã gắn căn.
  globalThis.__cauHinh = { test_reset_hello: "1" };
  for (const [cau, mong] of [["còn em", "con"], ["vẫn đang bán nha", "con"], ["ừ", "con"], ["chưa bán được em ơi", "con"], ["bán rồi em", "ban_roi"], ["ngưng bán rồi", "rut"]]) {
    fresh(seedKho); moConBan();
    const r = await send({ external_user_id: "z-ccrb", text: cau });
    const l = tinCB(); const q = qCB(); const rep = (r.body.replies ?? []).join(" ");
    const ok = mong === "con"
      ? q.status === "answered" && !!l.last_confirmed_at && l.status === "dang_ban" && /giữ tin căn 12 Trần Hưng Đạo/.test(rep) &&
        (db().t.property_events ?? []).some((e) => e.listing_id === l.id && e.meta?.con_ban === true)
      : mong === "ban_roi" ? q.status === "answered" && l.status === "da_chot" && /chúc mừng[^]*12 Trần Hưng Đạo/i.test(rep) && !/căn nào/.test(rep)
      : q.status === "answered" && l.status === "an" && /ngưng rao căn 12 Trần Hưng Đạo/.test(rep);
    check(`CB-01 keep-alive "còn bán không", luật đỡ: "${cau}" → ${mong}, đúng căn đã hỏi`, ok, JSON.stringify({ q: q?.status, st: l.status, lc: l.last_confirmed_at, rep }));
  }
  fresh(seedKho); moConBan();
  const rK = await send({ external_user_id: "z-ccrb", text: "phí bên em bao nhiêu" });
  check("CB-02 đang treo còn bán không mà hỏi phí → không đóng tin, không đóng dấu, câu còn treo",
    tinCB().status === "dang_ban" && qCB().status === "pending" && !tinCB().last_confirmed_at, JSON.stringify(rK.body.replies));
  // (2) AI quyết (công tắc `ai`): chữ KHÔNG có từ khoá, AI đọc theo nghĩa, code kiểm trích dẫn.
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
  const aiCB = ({ dongY, yDinh } = {}) => (p) => (laLuotBocRaoCB(p) || laLuotYLuotCB(p))
    ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null },
        hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null }, y_dinh: yDinh ?? { loai: "binh_thuong", trich_dan: null },
        ...(dongY ? { dong_y: dongY.la, dong_y_trich: dongY.trich } : { dong_y: "khong_noi", dong_y_trich: null }) }
    : OUT();
  fresh(seedKho); moConBan();
  globalThis.__model.parse = aiCB({ dongY: { la: "dong_y", trich: "y như cũ" } });
  let rA = await send({ external_user_id: "z-ccrb", text: "y như cũ em nhé" });
  check("CB-03 AI đọc GẬT ('y như cũ em nhé', không từ khoá) → còn bán: đóng dấu xác nhận, giữ tin",
    qCB().status === "answered" && !!tinCB().last_confirmed_at && /giữ tin/.test((rA.body.replies ?? []).join(" ")), JSON.stringify({ q: qCB(), rep: rA.body.replies }));
  fresh(seedKho); moConBan();
  globalThis.__model.parse = aiCB({ dongY: { la: "khong_dong_y", trich: "thôi em" } });
  rA = await send({ external_user_id: "z-ccrb", text: "thôi em" });
  check("CB-04 AI đọc KHÔNG ĐỒNG Ý mà không nói bán rồi → tạm ngưng (an, mở lại được), không báo khách 'đã bán'",
    tinCB().status === "an" && qCB().status === "answered" && /ngưng rao/.test((rA.body.replies ?? []).join(" ")), JSON.stringify({ st: tinCB().status, rep: rA.body.replies }));
  fresh(seedKho); moConBan();
  globalThis.__model.parse = aiCB({ yDinh: { loai: "ban_roi", trich_dan: "có người lấy rồi" } });
  rA = await send({ external_user_id: "z-ccrb", text: "có người lấy rồi em" });
  check("CB-05 AI đọc 'có người lấy rồi' = bán rồi (luật không bắt được chữ này) → da_chot đúng căn đã hỏi",
    tinCB().status === "da_chot" && /chúc mừng/i.test((rA.body.replies ?? []).join(" ")) && !/căn nào/.test((rA.body.replies ?? []).join(" ")), JSON.stringify({ st: tinCB().status, rep: rA.body.replies }));

  // (3) SRS-5.1zzh (Zalo thật 05/10 18:09): khách HỎI "em biết dự án ny'ah phú định không" → từ điển từng ghi phường Phú Định.
  //     AI nói cả tin là câu hỏi → không ghi; đối chứng: khách KHAI "nhà anh ở phú định" (AI đọc ô phường) → ghi.
  const seedPD = (d) => { seedKho(d); d.t.wards = napPhuongThat().map((w) => ({ ...w })); };
  const moTinPD = () => {
    const t = db().t.listings.find((l) => l.code === "BDS-Q5-0002"); t.ward = null; t.status = "cho_thong_tin";
    db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
    db().insert("info_requests", { listing_id: t.id, question: "so_phong_ngu", status: "pending" });
    return t;
  };
  const aiPD = (them) => (p) => laLuotBocRaoCB(p)
    ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null },
        hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null }, y_dinh: { loai: "binh_thuong", trich_dan: null }, ...them }
    : OUT();
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
  fresh(seedPD);
  const tPD = moTinPD();
  globalThis.__model.parse = aiPD({ hoi_lai: { co_hoi: true, cau_hoi: "em biết dự án ny'ah phú định không", chu_de: "du_an" } });
  const rPD = await send({ external_user_id: "z-ccrb", text: "em biết dự án ny'ah phú định không" });
  check("PD-01 'em biết dự án ny'ah phú định không' (AI: cả tin là câu hỏi) → KHÔNG ghi phường Phú Định",
    !tPD.ward && !db().t.listing_facts.some((f) => f.listing_id === tPD.id && f.question === "phuong"),
    JSON.stringify({ ward: tPD.ward, facts: db().t.listing_facts.filter((f) => f.listing_id === tPD.id), rep: rPD.body.replies }));
  fresh(seedPD);
  const tPD2 = moTinPD();
  globalThis.__model.parse = aiPD({ truong: [{ khoa: "phuong", gia_tri: "Phú Định", trich_dan: "phú định", can: null }] });
  await send({ external_user_id: "z-ccrb", text: "nhà anh ở phú định em" });
  check("PD-02 đối chứng: khách KHAI 'nhà anh ở phú định' (AI đọc ô phường) → từ điển chuẩn hoá, ghi Phường Phú Định",
    /Phú Định/.test(tPD2.ward ?? ""), JSON.stringify({ ward: tPD2.ward, facts: db().t.listing_facts.filter((f) => f.listing_id === tPD2.id) }));

  // PD-03/04 (chủ dự án 05/10: "người ta đang hỏi về dự án mà có thể họ sẽ hỏi để bán nhà khác"): hỏi về dự án CÓ trong kho →
  //   không gắn dự án vào tin đang hỏi, prompt mang khối DỰ ÁN + dặn trả lời rồi hỏi "có căn ở đó cần bán không"; dự án KHÔNG có
  //   trong kho → dặn nói thật chưa nắm, vẫn hỏi câu đó.
  fresh(seedPD);
  const tPD3 = moTinPD();
  const pjPD = db().insert("projects", { name: "Ny'ah Phú Định", developer: "X", district: "Quận 8", amenities: ["hồ bơi"], description: "Khu biệt lập 50 căn nhà phố" }).data;
  globalThis.__model.parse = aiPD({ hoi_lai: { co_hoi: true, cau_hoi: "em biết dự án ny'ah phú định không", chu_de: "du_an" } });
  globalThis.__calls = [];
  const rPD3 = await send({ external_user_id: "z-ccrb", text: "em biết dự án ny'ah phú định không" });
  // Lời dặn hỏi ngược nằm trong `messages` (NGỮ CẢNH), khối DỰ ÁN trong `system` → soi cả hai.
  const sysCua = () => globalThis.__calls.map((c) => JSON.stringify(c.params?.system ?? []) + JSON.stringify(c.params?.messages ?? [])).join("\n");
  const sysPD3 = sysCua();
  check("PD-03 hỏi về dự án CÓ trong kho → KHÔNG gắn dự án vào tin đang hỏi; prompt có khối DỰ ÁN + dặn trả lời rồi hỏi 'có căn ở đó cần bán'",
    !tPD3.project_id && /Theo em biết, dự án/.test(sysPD3) && /có căn ở dự án đó cần bán/.test(sysPD3) && /Ny'ah Phú Định/.test(sysPD3) && !tPD3.ward,
    JSON.stringify({ pid: tPD3.project_id, ward: tPD3.ward, co: /có căn ở dự án đó cần bán/.test(sysPD3), duAn: /Ny'ah/.test(sysPD3), rep: rPD3.body.replies }));
  void pjPD;
  fresh(seedPD);
  const tPD4 = moTinPD();
  globalThis.__model.parse = aiPD({ hoi_lai: { co_hoi: true, cau_hoi: "em biết khu botanic không", chu_de: "du_an" } });
  globalThis.__calls = [];
  await send({ external_user_id: "z-ccrb", text: "em biết khu botanic không" });
  const sysPD4 = sysCua();
  check("PD-04 hỏi về dự án KHÔNG có trong kho → không gắn gì, prompt dặn nói thật chưa nắm + hỏi có căn ở đó cần bán",
    !tPD4.project_id && /chưa nắm rõ dự án đó/.test(sysPD4) && /có căn ở dự án đó cần bán/.test(sysPD4), JSON.stringify({ pid: tPD4.project_id, co: /chưa nắm rõ dự án đó/.test(sysPD4) }));

  // CB-06 (chat thử "nhà bình thường" 05/10): đang duyệt bản nháp, "ừ còn bán, em cứ đăng đi" là GẬT + bảo đăng — không phải
  //   "rao lại tin đã gỡ" (từng đáp "không thấy tin nào của anh đang gỡ").
  globalThis.__cauHinh = { test_reset_hello: "1" };
  globalThis.__model.parse = () => OUT();
  fresh(seedKho);
  const tDuyet = db().t.listings.find((l) => l.code === "BDS-Q5-0002");
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: tDuyet.id, question: "duyet_tin", status: "pending" });
  const rDuyet = await send({ external_user_id: "z-ccrb", text: "ừ còn bán, em cứ đăng đi" });
  check("CB-06 đang duyệt bản nháp, 'ừ còn bán, em cứ đăng đi' → duyệt (chu_duyet_at), KHÔNG rơi vào 'rao lại tin đã gỡ'",
    !!tDuyet.chu_duyet_at && !/đang gỡ/.test((rDuyet.body.replies ?? []).join(" ")), JSON.stringify({ cd: tDuyet.chu_duyet_at, rep: rDuyet.body.replies }));

  // (4) SRS-5.1zzf — hạng Đồng tối đa 5 căn: `con_duoc_rao` (DB) nói hết trần → không mở tin, nói thật + cách lên Bạc.
  globalThis.__cauHinh = { test_reset_hello: "1" };
  globalThis.__model.parse = () => OUT();
  fresh(seedKho);
  globalThis.__rpc = { con_duoc_rao: () => ({ data: { duoc: false, hang: "dong", so_dang_rao: 5, tran: 5, diem: 32 }, error: null }) };
  const soTinTruoc = db().t.listings.length;
  const rD = await send({ external_user_id: "z-ccrb", text: "bán thêm căn nữa ở P5 giá 6 tỷ 60m2" });
  check("HD-01 hạng Đồng đủ 5 căn mà rao thêm → KHÔNG mở tin; nói trần 5 căn và cách lên hạng Bạc",
    db().t.listings.length === soTinTruoc && /hạng Đồng/.test((rD.body.replies ?? []).join(" ")) && /hạng Bạc/.test((rD.body.replies ?? []).join(" ")),
    JSON.stringify({ n: db().t.listings.length, rep: rD.body.replies }));
  globalThis.__rpc = {};
  fresh(seedKho);
  const rD2 = await send({ external_user_id: "z-ccrb", text: "bán thêm căn nữa ở P5 giá 6 tỷ 60m2" });
  check("HD-02 chưa đủ trần (RPC mặc định) → mở tin như cũ", db().t.listings.length === soTinTruoc + 1, JSON.stringify(rD2.body.replies));

  // (5) SRS-5.1zzf — khách MUA đã nét (khu vực + ngân sách): tin của NMG hạng VÀNG lên đầu KHO, thứ tự còn lại giữ nguyên.
  //     seedKho: #0001 (chủ "z-ccrb", tin cũ nhất) · #0005 (NMG "z-nmg", tin mới nhất → mặc định đứng trước).
  fresh(seedKho);
  const sCV = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
  db().insert("buyers", { zalo_user_id: "vang-1", name: "Anh V.", preferences: { area: "quận 5", budget: "dưới 7 tỷ" } });
  globalThis.__rpc = { hang_cua_nguoi_ban: () => ({ data: [{ seller_id: sCV.id, hang: "vang", diem: 85 }], error: null }) };
  await send({ external_user_id: "vang-1", text: "có căn nào phù hợp không em" });
  const sysV = parseCalls().at(-1) ? sysText(parseCalls().at(-1)) : "";
  const iV1 = sysV.indexOf("#BDS-Q5-0001"), iV5 = sysV.indexOf("#BDS-Q5-0005");
  check("VG-01 khách nét, chủ của #0001 hạng Vàng → #0001 đứng TRƯỚC #0005 (tin mới hơn) trong KHO",
    iV1 >= 0 && iV5 >= 0 && iV1 < iV5, JSON.stringify({ iV1, iV5, kho: sysV.split("\n").filter((x) => /#BDS/.test(x)).slice(0, 6) }));
  globalThis.__rpc = {};
  fresh(seedKho);
  db().insert("buyers", { zalo_user_id: "vang-2", name: "Anh V.", preferences: { area: "quận 5", budget: "dưới 7 tỷ" } });
  await send({ external_user_id: "vang-2", text: "có căn nào phù hợp không em" });
  const sysV2 = parseCalls().at(-1) ? sysText(parseCalls().at(-1)) : "";
  check("VG-02 đối chứng: không ai Vàng → thứ tự cũ (#0005 mới hơn đứng trước #0001)",
    sysV2.indexOf("#BDS-Q5-0005") >= 0 && sysV2.indexOf("#BDS-Q5-0005") < sysV2.indexOf("#BDS-Q5-0001"), JSON.stringify(sysV2.split("\n").filter((x) => /#BDS/.test(x)).slice(0, 6)));
  globalThis.__rpc = {};
  globalThis.__cauHinh = cuCH;
}
// ── 05/10/2026 (SRS-5.1zzi): văn phong demo AOND — câu lệnh khuôn ngắn, 🤖 chế độ admin, dẫn phí sau khi tin lên kệ ──
{
  const cuCH = globalThis.__cauHinh;
  const pr = (c) => c?.params?.messages?.[0]?.content ?? ""; // `prompt` ở khối khác là biến cục bộ; ngoài khối là hàm global của Bun
  fresh();
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "admin" };
  let ra = await send({ external_user_id: "aond-1", text: "bán nhà hẻm 4m Trần Bình Trọng quận 5, 60m2, giá 6 tỷ" });
  const p1 = createCalls().at(-1) ? pr(createCalls().at(-1)) : "";
  check("AOND-01 câu lệnh lượt rao: có 'CẦN HỎI:' (chỉ đưa Ý), không có 'Câu gợi ý' (model tự đặt câu)", /CẦN HỎI:/.test(p1) && !/Câu gợi ý/.test(p1), p1.slice(-300));
  check("AOND-02 bao_lai_da_luu=admin: 🤖 KHÔNG gửi khách; có ở body.bao_lai_admin và trong messages (sender bot) cho /admin",
    !ra.body.replies.some((x) => /^🤖/.test(x)) && /^🤖/.test(ra.body.bao_lai_admin ?? "") && db().t.messages.some((m) => m.sender === "bot" && /^🤖/.test(m.body)),
    JSON.stringify({ rep: ra.body.replies, admin: ra.body.bao_lai_admin }));
  ra = await send({ external_user_id: "aond-1", text: "trệt 2 lầu" });
  const p2 = createCalls().at(-1) ? pr(createCalls().at(-1)) : "";
  check("AOND-03 câu lệnh lượt hỏi tiếp: khuôn ĐÃ BIẾT (60m2 · 6 tỷ · Trần Bình Trọng) + CHỦ NHÀ VỪA NHẮN + CẦN HỎI; không 'Câu gợi ý'",
    /ĐÃ BIẾT về căn[^\n]*60m2/.test(p2) && /ĐÃ BIẾT về căn[^\n]*6 tỷ/.test(p2) && /ĐÃ BIẾT về căn[^\n]*Trần Bình Trọng/i.test(p2) &&
      /CHỦ NHÀ VỪA NHẮN/.test(p2) && /CẦN HỎI:/.test(p2) && !/Câu gợi ý/.test(p2),
    p2.slice(-500));
  globalThis.__model.create = () => "Dạ em ghi nhận 3 phòng ngủ rồi ạ. Sổ nhà mình là sổ riêng hay sổ chung anh chị?";
  ra = await send({ external_user_id: "aond-1", text: "3 phòng ngủ" });
  check("AOND-04 admin mode: khách vẫn có MỘT lời xác nhận đã ghi (của model hoặc câu tiền định), không có 🤖",
    ra.body.replies.some((x) => /em ghi (nhận|số phòng)/i.test(x)) && !ra.body.replies.some((x) => /^🤖/.test(x)), JSON.stringify(ra.body.replies));
  globalThis.__cauHinh = cuCH;
}
// ── 05/10/2026 (SRS-5.1zzj…zzm, demo AOND): file / link người bán gửi — CSV rổ hàng, bảng giá PDF vào kho dự án, căn A12 điền từ kho,
//    gom nhiều căn có xác nhận, nhịp gửi ──
{
  const cuCH = globalThis.__cauHinh;
  const enc = (t) => new TextEncoder().encode(t);
  const gocFetch = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    const u = String(url);
    if (/zdn\.vn\/ro-hang\.csv/.test(u)) return new Response(enc("Địa chỉ,Phường,Quận,Diện tích,Giá,Pháp lý,SĐT chủ\n12 Trần Hưng Đạo,P4,Quận 5,60m2,5 tỷ,SHR,0903123456\n99 Nguyễn Trãi,P3,Quận 5,4x15,6 tỷ 5,sổ chung,\n"), { status: 200, headers: { "content-type": "text/csv", "content-disposition": 'attachment; filename="ro-hang.csv"' } });
    if (/zdn\.vn\/bang-gia\.pdf/.test(u)) return new Response(enc("%PDF-1.4 bang gia"), { status: 200, headers: { "content-type": "application/pdf" } });
    if (/files\.example\.com\/trang\.html/.test(u)) return new Response(enc("<html>x</html>"), { status: 200, headers: { "content-type": "text/html" } });
    return gocFetch(url, opt);
  };
  const laLuotDocTL = (p) => (p?.system ?? []).some((x) => /ĐỌC TÀI LIỆU DỰ ÁN/.test(x.text ?? ""));
  const laLuotYL = (p) => (p?.system ?? []).some((x) => /Ý NGẮN CỦA LƯỢT/.test(x.text ?? ""));
  const laLuotBR = (p) => (p?.system ?? []).some((x) => /BÓC TÁCH TIN NHẮN NGƯỜI BÁN/.test(x.text ?? ""));
  const tinCua = (z) => { const sid = db().t.sellers.find((x) => x.zalo_user_id === z)?.id; return db().t.listings.filter((l) => l.seller_id === sid); };

  // F1 — CSV qua file_url: 2 tin mới, SĐT không vào đâu, 4x15 → 60m2, sổ chung; nhịp gửi mặc định 300 ms
  fresh();
  await send({ external_user_id: "aond-f1", text: "bán nhà hẻm 4m Trần Bình Trọng quận 5, 60m2, giá 6 tỷ" });
  let r = await send({ external_user_id: "aond-f1", text: "", file_url: "https://f.zdn.vn/ro-hang.csv", file_name: "ro-hang.csv" });
  const tinF1 = tinCua("aond-f1");
  const nt = tinF1.find((l) => /Nguyễn Trãi/.test(l.location_raw ?? ""));
  check("AOND-F1 CSV rổ hàng qua file_url → nhập 2 tin (tổng 3), 📥 liệt kê, body.nhap_ro_hang",
    r.body.nhap_ro_hang === true && tinF1.length === 3 && /^📥 Em nhập 2 căn/.test(r.body.replies[0] ?? "") && /Trần Hưng Đạo/.test(r.body.replies[0]),
    JSON.stringify({ rep: r.body.replies, n: tinF1.length }));
  check("AOND-F1b SĐT trong bảng KHÔNG vào tin nào (§5); '4x15' → 60m2; 'sổ chung' → so_hong_chung; 'SHR' → so_hong_rieng; tin ở cho_thong_tin + can_chu_duyet",
    !JSON.stringify(tinF1).includes("0903") && nt?.area_m2 === 60 && nt?.legal_status === "so_hong_chung" &&
      tinF1.find((l) => /12 Trần Hưng Đạo/.test(l.location_raw ?? ""))?.legal_status === "so_hong_rieng" && nt?.status === "cho_thong_tin" && nt?.can_chu_duyet === true,
    JSON.stringify(tinF1.map((l) => [l.location_raw, l.area_m2, l.legal_status, l.status])));
  check("AOND-F1c nhịp gửi mặc định: body.nhip_go = [0, 300] cho 2 bong bóng; tin người bán lưu kèm [file: ro-hang.csv]",
    JSON.stringify(r.body.nhip_go) === "[0,300]" && db().t.messages.some((m) => m.sender === "seller" && /\[file: ro-hang\.csv\]/.test(m.body)),
    JSON.stringify({ nhip: r.body.nhip_go, msgs: db().t.messages.filter((m) => m.sender === "seller").map((m) => m.body) }));

  // F1d — nhịp gửi bật → [0, ≥600]
  globalThis.__cauHinh = { test_reset_hello: "1", nhip_go: "bat" };
  globalThis.__khongNhoCauHinh = true; // napCauHinh nhớ 60 s — ca này đổi công tắc giữa chừng
  r = await send({ external_user_id: "aond-f1", text: "", file_url: "https://f.zdn.vn/ro-hang.csv", file_name: "ro-hang.csv" });
  globalThis.__khongNhoCauHinh = false;
  check("AOND-F1d app_config.nhip_go = bat → nhip_go[1] theo độ dài bong bóng trước (600–2500 ms)",
    Array.isArray(r.body.nhip_go) && r.body.nhip_go[0] === 0 && r.body.nhip_go[1] >= 600 && r.body.nhip_go[1] <= 2500, JSON.stringify(r.body.nhip_go));
  globalThis.__cauHinh = { test_reset_hello: "1" };

  // F1e — link tới trang HTML → không đọc được, nói rõ định dạng; không tạo tin
  const truocHtml = tinCua("aond-f1").length;
  r = await send({ external_user_id: "aond-f1", text: "xem thêm ở https://files.example.com/trang.html nha em" });
  check("AOND-F1e link HTML → 'chưa đọc được định dạng', không tạo tin", /chưa đọc được định dạng/.test(r.body.replies.join("\n")) && tinCua("aond-f1").length === truocHtml, JSON.stringify(r.body.replies));

  // F2 — PDF bảng giá: model giả đọc 2 căn + 1 mẫu nhà → kho du_an_can của dự án có trong kho, file cất bucket riêng tư
  fresh();
  const pj = db().insert("projects", { name: "Ny'ah Phú Định", district: "Quận 8", amenities: ["hồ bơi"] }).data;
  await send({ external_user_id: "aond-f2", text: "anh là môi giới, có vài căn Ny'ah Phú Định muốn rao" });
  globalThis.__model.parse = (p) => laLuotDocTL(p)
    ? { loai: "bang_gia", ten_du_an: "Ny'ah Phú Định", chu_dau_tu: "Phú Định Land", mau_nha: [{ ten: "Cosmo Gen 2", thong_so: "5x20, 3 tầng, 4 phòng ngủ" }],
        can: [{ ma_can: "A12", mau_nha: "Cosmo Gen 2", dien_tich: "100m2", dien_tich_dat: "100m2", gia: "12,5 tỷ", huong: "Đông", tang: null, ghi_chu: "lô góc" },
              { ma_can: "A13", mau_nha: "Cosmo Gen 2", dien_tich: "95m2", dien_tich_dat: null, gia: "11,8 tỷ", huong: null, tang: null, ghi_chu: null }],
        tien_ich: ["hồ bơi", "công viên"], ghi_chu: "bảng giá đợt 2", ro_net: true }
    : laLuotAnh(p) ? ANH(globalThis.__anh) : OUT();
  r = await send({ external_user_id: "aond-f2", text: "", file_url: "https://f.zdn.vn/bang-gia.pdf", file_name: "bang-gia.pdf" });
  const kho = db().t.du_an_can.filter((c) => c.project_id === pj.id);
  const tl = db().t.du_an_tai_lieu[0];
  check("AOND-F2 PDF bảng giá → du_an_can 2 căn (A12 100m2 · 12,5 tỷ · lô góc), du_an_tai_lieu loai bang_gia so_can_doc 2, file ở listing-private/du-an/…",
    r.body.tai_lieu_du_an === true && kho.length === 2 && kho.find((c) => c.ma_can === "A12")?.dien_tich_m2 === 100 && kho.find((c) => c.ma_can === "A12")?.gia_raw === "12,5 tỷ" &&
      kho.find((c) => c.ma_can === "A12")?.thuoc_tinh?.ghi_chu === "lô góc" && tl?.loai === "bang_gia" && tl?.so_can_doc === 2 && tl?.project_id === pj.id &&
      db().storage.some((f) => f.bucket === "listing-private" && /^du-an\//.test(f.path)),
    JSON.stringify({ rep: r.body.replies, kho, tl, st: db().storage }));
  check("AOND-F2b lời đáp: 'Em đọc bảng giá dự án Ny'ah Phú Định … 2 căn, mẫu Cosmo Gen 2'; mẫu nhà vào projects.unit_types",
    /Em đọc bảng giá dự án Ny'ah Phú Định/.test(r.body.replies[0] ?? "") && /2 căn/.test(r.body.replies[0]) && /Cosmo Gen 2/.test(r.body.replies[0]) &&
      (db().t.projects.find((x) => x.id === pj.id)?.unit_types ?? []).some((m) => m.ten === "Cosmo Gen 2"),
    JSON.stringify({ rep: r.body.replies, ut: db().t.projects.find((x) => x.id === pj.id)?.unit_types }));

  // F3 — rao "căn A12" → tin gắn dự án + unit_code, diện tích điền từ kho, fact bo_sung "theo kho dự án", khối CĂN TRONG DỰ ÁN tới model
  globalThis.__model.parse = (p) => laLuotAnh(p) ? ANH(globalThis.__anh) : OUT();
  r = await send({ external_user_id: "aond-f2", text: "bán căn A12 Ny'ah Phú Định giá 13 tỷ" });
  const tinA12 = tinCua("aond-f2").find((l) => l.unit_code === "A12");
  check("AOND-F3 rao 'bán căn A12 Ny'ah Phú Định giá 13 tỷ' → tin project_id + unit_code A12, area_m2 100 điền từ kho, giá rao 13 tỷ (không lấy giá niêm yết)",
    tinA12 && tinA12.project_id === pj.id && tinA12.area_m2 === 100 && /13 tỷ/.test(tinA12.price_raw ?? "") &&
      db().t.listing_facts.some((f) => f.listing_id === tinA12.id && f.question === "bo_sung" && /theo kho dự án, căn A12/.test(f.answer) && /giá niêm yết 12,5 tỷ/.test(f.answer)),
    JSON.stringify({ tin: tinA12, facts: db().t.listing_facts.filter((f) => f.listing_id === tinA12?.id) }));
  r = await send({ external_user_id: "aond-f2", text: "sổ hồng riêng rồi em" });
  const pF3 = createCalls().at(-1)?.params?.messages?.[0]?.content ?? "";
  check("AOND-F3b lượt hỏi tiếp: ngữ cảnh model có khối CĂN TRONG DỰ ÁN với A12 · Cosmo Gen 2 · niêm yết 12,5 tỷ · lô góc",
    /CĂN TRONG DỰ ÁN Ny'ah Phú Định/.test(pF3) && /A12 · Cosmo Gen 2 · 100m2/.test(pF3) && /niêm yết 12,5 tỷ/.test(pF3) && /lô góc/.test(pF3), pF3.slice(0, 600));

  // F2c — tài liệu CHƯA rõ dự án: model không đọc được tên, người bán chưa có tin gắn dự án → hỏi tên; lượt sau nói tên → gắn + ghi căn
  fresh();
  const pj2 = db().insert("projects", { name: "Akari City", district: "Bình Tân" }).data;
  await send({ external_user_id: "aond-f2c", text: "chào em, anh có mấy căn muốn gửi bán" });
  globalThis.__model.parse = (p) => laLuotDocTL(p)
    ? { loai: "phan_lo", ten_du_an: null, chu_dau_tu: null, mau_nha: [], can: [{ ma_can: "B2.07", mau_nha: null, dien_tich: "70m2", dien_tich_dat: null, gia: null, huong: null, tang: "2", ghi_chu: null }], tien_ich: [], ghi_chu: null, ro_net: false }
    : laLuotAnh(p) ? ANH(globalThis.__anh) : OUT();
  r = await send({ external_user_id: "aond-f2c", text: "", file_url: "https://f.zdn.vn/bang-gia.pdf", file_name: "phan-lo.pdf" });
  check("AOND-F2c tài liệu không có tên dự án → hỏi 'đây là dự án nào', giữ nội dung đọc ở du_an_tai_lieu.noi_dung, chưa ghi du_an_can",
    /dự án nào vậy/.test(r.body.replies[0] ?? "") && db().t.du_an_tai_lieu[0]?.project_id == null && db().t.du_an_tai_lieu[0]?.noi_dung?.can?.length === 1 && db().t.du_an_can.length === 0,
    JSON.stringify({ rep: r.body.replies, tl: db().t.du_an_tai_lieu }));
  globalThis.__model.parse = (p) => laLuotAnh(p) ? ANH(globalThis.__anh) : OUT();
  r = await send({ external_user_id: "aond-f2c", text: "dự án Akari City đó em" });
  check("AOND-F2d lượt sau nói tên dự án có trong kho → gắn tài liệu, ghi 1 căn B2.07 tầng 2 vào du_an_can, bong bóng 'em gắn 1 căn'",
    db().t.du_an_can.some((c) => c.project_id === pj2.id && c.ma_can === "B2.07" && c.tang === 2) && db().t.du_an_tai_lieu[0]?.project_id === pj2.id &&
      r.body.replies.some((x) => /gắn 1 căn/.test(x)),
    JSON.stringify({ rep: r.body.replies, kho: db().t.du_an_can, tl: db().t.du_an_tai_lieu }));

  // F4 — gom nhiều căn (luật đỡ, AI tắt): "ngưng rao hết trừ căn Trần Hưng Đạo" → hỏi xác nhận, chưa ẩn; "ừ" → ẩn 0002, giữ 0001
  fresh(seedKho);
  const tinZ = (code) => db().t.listings.find((l) => l.code === code);
  r = await send({ external_user_id: "z-ccrb", text: "ngưng rao hết trừ căn Trần Hưng Đạo nha em" });
  const pendNHL = () => db().t.info_requests.find((q) => q.question === "xac_nhan_ngung_hang_loat");
  check("AOND-F4 'ngưng rao hết trừ căn Trần Hưng Đạo' → liệt kê 1 căn sẽ ẩn (Nguyễn Trãi), giữ THĐ, hỏi xác nhận; CHƯA đổi trạng thái",
    pendNHL()?.status === "pending" && /Em sẽ ngưng rao 1 căn/.test(r.body.replies[0] ?? "") && /Nguyễn Trãi/.test(r.body.replies[0]) && /Giữ lại:.*Trần Hưng Đạo/.test(r.body.replies[0]) &&
      tinZ("BDS-Q5-0001").status === "dang_ban" && tinZ("BDS-Q5-0002").status === "cho_thong_tin",
    JSON.stringify({ rep: r.body.replies, pend: pendNHL(), st: [tinZ("BDS-Q5-0001").status, tinZ("BDS-Q5-0002").status] }));
  r = await send({ external_user_id: "z-ccrb", text: "ừ" });
  check("AOND-F4b 'ừ' → 0002 thành an (boc_tach.ket_thuc rut), 0001 vẫn dang_ban, câu xác nhận answered, đáp 'đã ngưng rao 1 căn'",
    tinZ("BDS-Q5-0002").status === "an" && tinZ("BDS-Q5-0002").boc_tach?.ket_thuc === "rut" && tinZ("BDS-Q5-0001").status === "dang_ban" && pendNHL()?.status === "answered" &&
      /đã ngưng rao 1 căn/.test(r.body.replies.join("\n")),
    JSON.stringify({ rep: r.body.replies, st: [tinZ("BDS-Q5-0001").status, tinZ("BDS-Q5-0002").status], pend: pendNHL() }));

  // F5 — "gỡ hết đi" rồi "thôi" → không ẩn gì, câu xác nhận expired
  fresh(seedKho);
  r = await send({ external_user_id: "z-ccrb", text: "gỡ hết đi em" });
  check("AOND-F5 'gỡ hết đi' → an_het: liệt kê 2 căn, hỏi xác nhận", /Em sẽ ngưng rao 2 căn/.test(r.body.replies[0] ?? "") && pendNHL()?.status === "pending", JSON.stringify(r.body.replies));
  r = await send({ external_user_id: "z-ccrb", text: "thôi, giữ nguyên đi" });
  check("AOND-F5b 'thôi' → giữ nguyên, không căn nào an, câu xác nhận expired",
    tinZ("BDS-Q5-0001").status === "dang_ban" && tinZ("BDS-Q5-0002").status === "cho_thong_tin" && pendNHL()?.status === "expired" && /giữ nguyên/.test(r.body.replies.join("\n")),
    JSON.stringify({ rep: r.body.replies, st: [tinZ("BDS-Q5-0001").status, tinZ("BDS-Q5-0002").status] }));

  // F6 — AI đọc ý (chế độ ai): cách nói MỚI luật không bắt — "mấy căn kia dẹp giúp anh, giữ mỗi căn Nguyễn Trãi" → chi_giu
  fresh(seedKho);
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai" };
  const aiNHL = (nhl) => (p) => laLuotBR(p)
    ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null }, y_dinh: { loai: "binh_thuong", trich_dan: null } }
    : laLuotYL(p) ? { dong_y: "khong_noi", dong_y_trich: null, yeu_cau: "khong", yeu_cau_trich: null, yeu_cau_o: null, mua_kem: null, ngung_hang_loat: nhl }
    : laLuotGanManh(p) ? { manh: [] } // câu nhắc tên đường căn khác → FR-214 hỏi model gán mảnh; model thật thấy đây là lệnh, không phải dữ kiện
    : OUT();
  globalThis.__model.parse = aiNHL({ kieu: "chi_giu", giu: ["căn Nguyễn Trãi"], trich_dan: "mấy căn kia dẹp giúp anh" });
  r = await send({ external_user_id: "z-ccrb", text: "mấy căn kia dẹp giúp anh, giữ mỗi căn Nguyễn Trãi" });
  check("AOND-F6 AI đọc 'mấy căn kia dẹp giúp anh, giữ mỗi căn Nguyễn Trãi' (luật không bắt) → ẩn THĐ, giữ Nguyễn Trãi, hỏi xác nhận",
    laNgungHangLoatLuat("mấy căn kia dẹp giúp anh, giữ mỗi căn Nguyễn Trãi") === null &&
      pendNHL()?.status === "pending" && /Trần Hưng Đạo/.test(r.body.replies[0] ?? "") && /Giữ lại:.*Nguyễn Trãi/.test(r.body.replies[0]),
    JSON.stringify({ rep: r.body.replies, pend: pendNHL() }));
  globalThis.__model.parse = aiNHL(null);
  r = await send({ external_user_id: "z-ccrb", text: "ngưng rao căn Nguyễn Trãi thôi" });
  check("AOND-F6b AI nói KHÔNG có ý gom (null) → không mở xác nhận hàng loạt, FR-184 một căn như cũ", !db().t.info_requests.some((q) => q.question === "xac_nhan_ngung_hang_loat" && q.status === "pending" && q.created_at > (pendNHL()?.created_at ?? "")) , JSON.stringify(r.body.replies));
  globalThis.__cauHinh = cuCH;
  globalThis.fetch = gocFetch;
}
// ── 06/10/2026 (SRS-5.1zzo, bắn thử thu-srd-a1 / thu-srd-b1): bốn lớp lỗi sửa ở GỐC, không vá cục bộ ──
{
  const laLuotBocRao = (p) => (p?.system ?? []).some((s) => /BÓC TÁCH TIN NHẮN NGƯỜI BÁN/.test(s.text ?? ""));
  const laLuotYLuot = (p) => (p?.system ?? []).some((s) => /Ý NGẮN CỦA LƯỢT/.test(s.text ?? ""));
  const aiGoc = (them = {}) => (p) => (laLuotBocRao(p) || laLuotYLuot(p))
    ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null },
      can_khac: false, dong_y: "khong_noi", dong_y_trich: null, yeu_cau: "khong", yeu_cau_trich: null, ...them }
    : laLuotAnh(p) ? ANH(globalThis.__anh) : OUT();
  const loiBot = (r) => (r.body ?? r).replies.filter((x) => !/^(🤖|💾|📝|📋|👤)/u.test(x)).join(" | ");
  const cuCH = globalThis.__cauHinh;

  // Lớp 1 — MỞ Ô CHỜ MÀ KHÔNG HỌI: câu treo pháp lý, model r2 trả "Dạ em cảm ơn anh." → lời gửi đi phải có câu hỏi, đúng ô vừa mở.
  for (const cheDo of ["gon", "du"]) {
    fresh(seedKho);
    globalThis.__cauHinh = { test_reset_hello: "1", luat_loi_bot: cheDo };
    const sN = db().t.sellers.find((x) => x.zalo_user_id === "z-nmg");
    const tin = db().insert("listings", { code: "BDS-Q5-0901", seller_id: sN.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", district: "Quận 5", ward: "Phường 2",
      location_raw: "123 Trần Bình Trọng", street: "Trần Bình Trọng", area_m2: 60, frontage_m: 4, length_m: 15, floors_text: "trệt + 2 lầu", floors: 3, bedrooms: 3, access_type: "hem_xe_hoi", alley_width_m: 4 }).data;
    db().insert("info_requests", { listing_id: tin.id, question: "phap_ly", status: "pending" });
    db().insert("info_requests", { listing_id: tin.id, question: "gia", status: "expired" });
    globalThis.__model.create = () => "Dạ em cảm ơn anh.";
    const rG = await send({ external_user_id: "z-nmg", text: "Sổ riêng, anh đứng tên" });
    const noi = loiBot(rG);
    const moi = db().t.info_requests.filter((q) => q.listing_id === tin.id && q.status === "pending" && q.question !== "phap_ly");
    check(`GOC-01 (${cheDo}) model không hỏi → lời gửi đi có câu hỏi; ô chờ mới mở có câu hỏi đi kèm (không mở ô mà không hỏi)`,
      /\?/.test(noi) && moi.length >= 1 && (rG.body.van_kich ?? []).includes("damBaoCauHoi"), JSON.stringify({ noi, moi: moi.map((q) => q.question), vk: rG.body.van_kich }));
    globalThis.__model.create = undefined;
  }
  globalThis.__cauHinh = cuCH;

  // Lớp 2 — CỔNG NHIỀU CĂN DO AI QUYẾT: câu dùng dấu phẩy phân cách thông số, regex không thấy căn; AI đánh số `can` → hai tin.
  {
    const T = (khoa, gia_tri, trich_dan, can) => ({ khoa, gia_tri, trich_dan, can });
    const moHaiCan = async (uid, text, truong) => {
      fresh(seedKho);
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
      const truoc = new Set(db().t.listings.map((x) => x.id));
      globalThis.__model.parse = aiGoc({ so_can: 2, truong });
      const rr = await send({ external_user_id: uid, text });
      return { rr, ds: db().t.listings.filter((x) => !truoc.has(x.id)) };
    };
    const B1 = "Em có 2 căn gửi bán: căn 1 hẻm 5m Phạm Văn Chí P7 Q6, 4x12, 6.9 tỷ; căn 2 mặt tiền Trần Phú Q5, 4x20, 18 tỷ";
    let { rr, ds } = await moHaiCan("goc-2a", B1, [
      T("loai_giao_dich", "ban", "gửi bán", null), T("loai_bds", "nha_pho", "căn", null),
      T("duong", "hẻm 5m Phạm Văn Chí", "hẻm 5m Phạm Văn Chí", 1), T("phuong", "7", "P7", 1), T("quan", "Quận 6", "Q6", 1), T("ngang", "4", "4x12", 1), T("dai", "12", "4x12", 1), T("do_rong_hem", "5", "hẻm 5m", 1), T("gia", "6.9 tỷ", "6.9 tỷ", 1),
      T("duong", "Trần Phú", "mặt tiền Trần Phú", 2), T("quan", "Quận 5", "Q5", 2), T("ngang", "4", "4x20", 2), T("dai", "20", "4x20", 2), T("gia", "18 tỷ", "18 tỷ", 2), T("loai_duong_vao", "mat_tien", "mặt tiền", 2),
    ]);
    const q6 = ds.find((x) => x.district === "Quận 6"), q5 = ds.find((x) => x.district === "Quận 5");
    check("GOC-02 'căn 1 …, 4x12, 6.9 tỷ; căn 2 …' (regex cắt theo dấu phẩy không thấy căn) → AI chia: HAI tin Quận 6 / Quận 5 đúng giá",
      ds.length === 2 && !!q6 && !!q5 && /6\.9 tỷ/.test(q6.price_raw ?? "") && /18 tỷ/.test(q5.price_raw ?? ""), JSON.stringify(ds.map((x) => [x.district, x.price_raw, x.location_raw])));
    check("GOC-02b nhãn 'căn góc / 2 mặt tiền' của căn 2 KHÔNG dán lên căn 1; bong bóng không nói 'chưa rõ quận'",
      !!q6 && q6.corner_lot !== true && !(q6.nhan ?? []).some((n) => /mat_tien|goc/.test(n)) && !/chưa rõ quận/.test(rr.body.replies.join(" ")), JSON.stringify({ q6, replies: rr.body.replies }));
    ({ rr, ds } = await moHaiCan("goc-2b", "Bên anh đang có hai sản phẩm nhờ em đăng: nhà Lê Quang Định Bình Thạnh 4x18 giá 9 tỷ 2, và căn hộ Sunrise City Q7 70m2 3 tỷ 8", [
      T("loai_bds", "nha_pho", "nhà", 1), T("duong", "Lê Quang Định", "Lê Quang Định", 1), T("quan", "Quận Bình Thạnh", "Bình Thạnh", 1), T("ngang", "4", "4x18", 1), T("dai", "18", "4x18", 1), T("gia", "9 tỷ 2", "9 tỷ 2", 1),
      T("loai_bds", "chung_cu", "căn hộ", 2), T("quan", "Quận 7", "Q7", 2), T("dien_tich", "70", "70m2", 2), T("gia", "3 tỷ 8", "3 tỷ 8", 2),
    ]));
    check("GOC-02c (cách nói MỚI, không có 'căn 1/căn 2') → vẫn hai tin, nhà Bình Thạnh + căn hộ Quận 7",
      ds.length === 2 && ds.some((x) => x.district === "Quận Bình Thạnh" && x.property_type === "nha_pho") && ds.some((x) => x.district === "Quận 7" && x.property_type === "chung_cu"),
      JSON.stringify(ds.map((x) => [x.district, x.property_type, x.price_raw])));
    globalThis.__cauHinh = cuCH;
  }

  // Lớp 3 — "KHÁCH HỎI" PHẢI CÓ BẰNG CHỨNG: "Anh là môi giới nha" AI gán ve_bot → không đáp "em là trợ lý AI", không coi là hỏi ngược.
  {
    const hoiMG = async (uid, text, them) => {
      fresh(seedKho);
      // `gon` như production: ở `du` van `boCauGhiNhan` cắt luôn câu tiền định "em ghi nhận … là môi giới" (câu ghi nhận thứ hai).
      globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi", luat_loi_bot: "gon" };
      const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
      const tin = db().t.listings.find((l) => l.seller_id === sC.id && l.status === "cho_thong_tin");
      db().insert("info_requests", { listing_id: tin.id, question: "ket_cau", status: "pending" });
      globalThis.__model.parse = aiGoc({ hoi_lai: { co_hoi: true, cau_hoi: text, chu_de: "ve_bot" }, ...them });
      return await send({ external_user_id: uid, text });
    };
    let rM = await hoiMG("z-ccrb", "Anh là môi giới nha", { vai: { la: "moi_gioi", trich_dan: "Anh là môi giới" } });
    check("GOC-03 'Anh là môi giới nha' (AI: ve_bot + vai môi giới) → KHÔNG hỏi ngược về bot, có lời ghi nhận môi giới, vẫn hỏi tiếp",
      !rM.body.hoi_nguoc && rM.body.replies.some((x) => /ghi nhận .{0,12} là môi giới/.test(x)) && /\?/.test(loiBot(rM))
        && db().t.reminders.some((x) => /tự xưng MÔI GIỚI/.test(x.note ?? "")),
      JSON.stringify({ body: rM.body, rem: db().t.reminders.map((x) => x.note) }));
    rM = await hoiMG("z-ccrb", "bên anh là sàn nha em", { vai: { la: "khong_noi", trich_dan: null } });
    check("GOC-03b (mới) 'bên anh là sàn nha em', AI gán ve_bot mà không đọc vai → câu không nói gì về bot → không hỏi ngược",
      !rM.body.hoi_nguoc, JSON.stringify(rM.body));
    rM = await hoiMG("z-ccrb", "em là người hay máy vậy", {});
    check("GOC-03c câu hỏi về bot THẬT 'em là người hay máy vậy' → vẫn là hỏi ngược (lưới không chặn câu đúng)",
      rM.body.hoi_nguoc === "em là người hay máy vậy", JSON.stringify(rM.body));
    globalThis.__cauHinh = cuCH;
  }

  // Lớp 4 — KHẲNG ĐỊNH TRẠNG THÁI TIN KHÔNG ĐỐI CHIẾU DB: không còn tin mở mà model r3 nói "tin đang rao" → bỏ mệnh đề; prompt nói rõ.
  {
    fresh(seedKho);
    const sN = db().t.sellers.find((x) => x.zalo_user_id === "z-nmg");
    for (const l of db().t.listings.filter((l) => l.seller_id === sN.id)) l.status = "an";
    globalThis.__model.create = () => "Tin căn Trần Phú của anh đang rao, có khách quan tâm em báo anh liền nhé.";
    const rT = await send({ external_user_id: "z-nmg", text: "ừ" });
    const noi = loiBot(rT);
    const r3 = createCalls().at(-1);
    check("GOC-04 không còn tin mở, model nói 'Tin căn Trần Phú đang rao' → mệnh đề bị bỏ (van boHuaDaDang(khong_tin_mo) kích), prompt r3 báo KHÔNG CÓ tin",
      !/đang rao/.test(noi) && (rT.body.van_kich ?? []).includes("boHuaDaDang(khong_tin_mo)") && /KHÔNG CÓ tin nào đang rao/.test(r3?.params.messages?.[0]?.content ?? ""),
      JSON.stringify({ noi, vk: rT.body.van_kich, prompt: (r3?.params.messages?.[0]?.content ?? "").slice(-300) }));
    // Đối chứng: còn tin mở thì câu "đang rao" là thật, giữ.
    fresh(seedKho);
    globalThis.__model.create = () => "Dạ tin căn Hải Thượng Lãn Ông của anh vẫn đang rao, có khách em báo liền nhé.";
    const rC = await send({ external_user_id: "z-nmg", text: "ừ" });
    check("GOC-04b còn tin đang bán → 'vẫn đang rao' giữ nguyên, prompt r3 liệt kê tin (không có dòng KHÔNG CÓ)",
      /đang rao/.test(loiBot(rC)) && !/KHÔNG CÓ tin nào đang rao/.test(createCalls().at(-1)?.params.messages?.[0]?.content ?? ""), loiBot(rC));
    globalThis.__model.create = undefined;
  }
}
// ── 06/10/2026 (bước 3, SRS-5.1zzp): lời model lệch ô → GỌI LẠI model một lần, câu mẫu chỉ là lưới cuối ──
{
  const loiBot = (r) => (r.body ?? r).replies.filter((x) => !/^(🤖|💾|📝|📋|👤)/u.test(x)).join(" | ");
  const dungTin = (uid) => {
    fresh(seedKho);
    const sN = db().t.sellers.find((x) => x.zalo_user_id === uid);
    const tin = db().insert("listings", { code: "BDS-Q5-0902", seller_id: sN.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", district: "Quận 5", ward: "Phường 2",
      location_raw: "123 Trần Bình Trọng", street: "Trần Bình Trọng", area_m2: 60, frontage_m: 4, length_m: 15 }).data;
    db().insert("info_requests", { listing_id: tin.id, question: "phap_ly", status: "pending" });
    return tin;
  };
  // 06a: lần 1 không hỏi → gọi lại → lần 2 có câu hỏi (không lệch khoá) → dùng lời model lần 2, không dán câu mẫu.
  dungTin("z-nmg");
  let lan = 0;
  globalThis.__model.create = () => (++lan === 1 ? "Dạ em cảm ơn anh." : "Dạ em ghi rồi, anh cho em hỏi thêm một chút nha?");
  let rB = await send({ external_user_id: "z-nmg", text: "Sổ riêng, anh đứng tên" });
  let noi = loiBot(rB);
  check("GOC-06 lời r2 không hỏi → gọi lại model MỘT lần, dùng lời lần 2 (giọng model), không dán câu mẫu; sổ van có goiLaiChoDungO, không có damBaoCauHoi",
    lan === 2 && /anh cho em hỏi thêm một chút nha\?/.test(noi) && (rB.body.van_kich ?? []).includes("goiLaiChoDungO") && !(rB.body.van_kich ?? []).includes("damBaoCauHoi"),
    JSON.stringify({ lan, noi, vk: rB.body.van_kich }));
  // 06b: lần 2 vẫn không hỏi → câu mẫu dán (lưới cuối), chỉ gọi lại MỘT lần.
  dungTin("z-nmg");
  lan = 0;
  globalThis.__model.create = () => { lan++; return "Dạ em cảm ơn anh."; };
  rB = await send({ external_user_id: "z-nmg", text: "Sổ riêng, anh đứng tên" });
  noi = loiBot(rB);
  check("GOC-06b lần 2 vẫn không hỏi → chỉ gọi lại MỘT lần rồi câu mẫu dán (damBaoCauHoi), lời gửi đi vẫn có câu hỏi",
    lan === 2 && /\?/.test(noi) && (rB.body.van_kich ?? []).includes("goiLaiChoDungO") && (rB.body.van_kich ?? []).includes("damBaoCauHoi"), JSON.stringify({ lan, noi, vk: rB.body.van_kich }));
  // 06c: lời đã đúng ô → không gọi lại (không tốn lượt).
  dungTin("z-nmg");
  lan = 0;
  globalThis.__model.create = () => { lan++; return "Dạ em ghi rồi, anh cho em hỏi thêm một chút nha?"; };
  rB = await send({ external_user_id: "z-nmg", text: "Sổ riêng, anh đứng tên" });
  check("GOC-06c lời đã có câu hỏi đúng ô → KHÔNG gọi lại (1 lượt model), sổ van không có goiLaiChoDungO",
    lan === 1 && !(rB.body.van_kich ?? []).includes("goiLaiChoDungO"), JSON.stringify({ lan, vk: rB.body.van_kich, noi: loiBot(rB) }));
  globalThis.__model.create = undefined;
}
// ── 06/10/2026 (SRS-5.1zzq, đối chiếu SRD AOND): câu phí MỘT NGUỒN theo vai + loại giao dịch; dẫn phí ở nhánh "đăng đi" ──
{
  const laLuotBocRao = (p) => (p?.system ?? []).some((s) => /BÓC TÁCH TIN NHẮN NGƯỜI BÁN/.test(s.text ?? ""));
  const laLuotYLuot = (p) => (p?.system ?? []).some((s) => /Ý NGẮN CỦA LƯỢT/.test(s.text ?? ""));
  const aiPhi = (them = {}) => (p) => (laLuotBocRao(p) || laLuotYLuot(p))
    ? { so_can: 0, kien_thuc: [], truong: [], cap_nhat: [], xac_nhan: [], tra_loi: { co_tra_loi: false, gia_tri: null, trich_dan: null }, hoi_lai: { co_hoi: false, cau_hoi: null, chu_de: null },
      cam_xuc: { muc: "binh_thuong", trich_dan: null }, khong_can_hoi: [], can_khac: false, dong_y: "khong_noi", dong_y_trich: null, yeu_cau: "khong", yeu_cau_trich: null, ...them }
    : laLuotAnh(p) ? ANH(globalThis.__anh) : OUT();
  const loiBot = (r) => (r.body ?? r).replies.filter((x) => !/^(🤖|💾|📝|📋|👤)/u.test(x)).join(" | ");
  const dungThue = (uid, sellerType, deal) => {
    fresh(seedKho);
    const sN = db().insert("sellers", { zalo_user_id: uid, seller_type: sellerType, name: null, active_listing_id: null }).data;
    const tin = db().insert("listings", { code: `BDS-Q5-09${uid.slice(-2)}`, seller_id: sN.id, deal, status: "cho_thong_tin", property_type: "chung_cu", district: "Quận 7", ward: "Phường Tân Phú",
      location_raw: "Sunrise City", price_raw: deal === "cho_thue" ? "15 triệu/tháng" : "5 tỷ 8", area_m2: 76 }).data;
    db().insert("info_requests", { listing_id: tin.id, question: "noi_that", status: "pending" });
    return tin;
  };
  const cuCH = globalThis.__cauHinh;
  // PHI-01: tin CHO THUÊ, chủ nhà hỏi phí (không dấu) → 3/4 tháng tiền thuê, không "1%".
  dungThue("phi-t1", "ccrb", "cho_thue");
  let rP = await send({ external_user_id: "phi-t1", text: "phi ben minh sao em" });
  check("PHI-01 tin CHO THUÊ hỏi phí → '3/4 tháng tiền thuê', không nói 1% / 0,5% giá chốt",
    !!rP.body.hoi_nguoc && /3\/4 tháng tiền thuê/.test(loiBot(rP)) && !/1%|0,5%|giá chốt/.test(loiBot(rP)), JSON.stringify(rP.body));
  // PHI-02: hồ sơ chưa rõ vai (unknown) hỏi phí → không báo con số.
  dungThue("phi-u2", "unknown", "ban");
  rP = await send({ external_user_id: "phi-u2", text: "phi ben minh sao em" });
  check("PHI-02 vai chưa rõ (unknown) hỏi phí → nói thu khi giao dịch thành công, KHÔNG báo con số",
    !!rP.body.hoi_nguoc && /chỉ thu khi giao dịch thành công/.test(loiBot(rP)) && !/1%|0,5%/.test(loiBot(rP)), JSON.stringify(rP.body));
  // PHI-02b đối chứng: môi giới tin bán → vẫn 0,5% giá chốt (câu cũ không đổi).
  dungThue("phi-m3", "nmg", "ban");
  rP = await send({ external_user_id: "phi-m3", text: "phi ben minh sao em" });
  check("PHI-02b môi giới tin bán hỏi phí → 0,5% giá chốt như cũ", /0,5% giá chốt/.test(loiBot(rP)), loiBot(rP));
  // PHI-03: nghi ngờ lừa đảo ở tin CHO THUÊ → câu trấn an tiền định nói đúng phí thuê.
  dungThue("phi-n4", "ccrb", "cho_thue");
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "ai", bao_lai_da_luu: "thay_doi" };
  globalThis.__model.parse = aiPhi({ cam_xuc: { muc: "nghi_ngo", trich_dan: "có phải lừa đảo không" } });
  rP = await send({ external_user_id: "phi-n4", text: "bên em có phải lừa đảo không vậy" });
  check("PHI-03 nghi ngờ ở tin cho thuê → trấn an 'không thu đồng nào trước' + phí 3/4 tháng tiền thuê, không '1% giá chốt'",
    /không thu đồng nào trước/.test(loiBot(rP)) && /3\/4 tháng tiền thuê/.test(loiBot(rP)) && !/1% giá chốt/.test(loiBot(rP)), loiBot(rP));
  globalThis.__cauHinh = cuCH;
  // PHI-04: "đăng đi" đủ điểm → lên kệ ngay VÀ dẫn phí một lần (trước đây nhánh này quên).
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "phi-d5", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0905", seller_id: s.id, deal: "ban", status: "cho_thong_tin", can_chu_duyet: true, property_type: "nha_pho", location_raw: "9 Hồng Bàng", ward: "Phường 12", price_raw: "8 tỷ", price_vnd: 8e9, area_m2: 60, floors: 3, bedrooms: 3, legal_status: "so_hong_rieng", access_type: "hem_xe_hoi", alley_width_m: 4, district: "Quận 5" }).data;
    d.insert("listing_facts", { listing_id: l.id, question: "hinh_anh", answer: "https://x/1.jpg", source: "seller_chat" });
    d.insert("info_requests", { listing_id: l.id, question: "tiem_nang", status: "pending" });
  });
  rP = await send({ external_user_id: "phi-d5", text: "đăng đi em" });
  check("PHI-04 'đăng đi' lên kệ ngay → có câu dẫn phí 'biết phí bên em chưa' (body.dan_phi), đúng một lần",
    rP.body.dang_luon === true && rP.body.dan_phi === true && rP.body.replies.filter((x) => /biết phí bên em chưa/.test(x)).length === 1, JSON.stringify(rP.body.replies));
  // PHI-04b đã nói phí trước đó → "đăng đi" không dẫn phí lần hai.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "phi-d6", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0906", seller_id: s.id, deal: "ban", status: "cho_thong_tin", can_chu_duyet: true, property_type: "nha_pho", location_raw: "9 Hồng Bàng", ward: "Phường 12", price_raw: "8 tỷ", price_vnd: 8e9, area_m2: 60, floors: 3, bedrooms: 3, legal_status: "so_hong_rieng", access_type: "hem_xe_hoi", alley_width_m: 4, district: "Quận 5" }).data;
    d.insert("listing_facts", { listing_id: l.id, question: "hinh_anh", answer: "https://x/1.jpg", source: "seller_chat" });
    d.insert("info_requests", { listing_id: l.id, question: "tiem_nang", status: "pending" });
    const c = d.insert("conversations", { seller_id: s.id, channel: "zalo_personal_test" }).data;
    d.insert("messages", { conversation_id: c.id, sender: "bot", body: "Dạ phí bên em chỉ thu khi giao dịch thành công, 1% giá chốt ạ." });
  });
  rP = await send({ external_user_id: "phi-d6", text: "đăng đi em" });
  check("PHI-04b đã nói phí rồi → 'đăng đi' KHÔNG dẫn phí lần hai", rP.body.dang_luon === true && rP.body.dan_phi !== true && !/biết phí bên em chưa/.test(rP.body.replies.join("\n")), JSON.stringify(rP.body.replies));
}
// ── 06/10/2026 (SRS-5.1zzr): ô quan trọng ghi NGUYÊN VĂN cụm khách gõ — ca gốc test Zalo 14:06 "hẻm 137 Nguyễn Trãi" → bot ghi "137 hẻm Nguyễn Trãi" ──
{
  const laLuotBocRao = (p) => (p?.system ?? []).some((s) => /BÓC TÁCH TIN NHẮN NGƯỜI BÁN/.test(s.text ?? ""));
  const cuCH = globalThis.__cauHinh, cuParse = globalThis.__model.parse;
  globalThis.__cauHinh = { test_reset_hello: "1", boc_tach_ai: "chinh", bao_lai_da_luu: "thay_doi" };
  // (1) câu rao: model đảo thứ tự chữ địa chỉ → tin vẫn ghi đúng chữ khách.
  fresh(seedKho);
  globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 1, kien_thuc: [], truong: [
    { khoa: "loai_giao_dich", gia_tri: "ban", trich_dan: "bán nhà", can: null },
    { khoa: "loai_bds", gia_tri: "nha_pho", trich_dan: "bán nhà", can: null },
    { khoa: "duong", gia_tri: "137 hẻm Nguyễn Trãi", trich_dan: "hẻm 137 Nguyễn Trãi", can: null },
    { khoa: "ten_duong", gia_tri: "Nguyễn Trãi", trich_dan: "hẻm 137 Nguyễn Trãi", can: null },
    { khoa: "quan", gia_tri: "Quận 5", trich_dan: "quận 5", can: null },
    { khoa: "gia", gia_tri: "8 tỷ 5", trich_dan: "giá 8 tỷ 5", can: null },
  ] } : OUT();
  let rN = await send({ external_user_id: "nv-01", text: "bán nhà hẻm 137 Nguyễn Trãi quận 5, 4x15, giá 8 tỷ 5" });
  const LN = db().t.listings.at(-1);
  check("NV-E1 câu rao, model viết '137 hẻm Nguyễn Trãi' → tin ghi đúng chữ khách 'hẻm 137 Nguyễn Trãi'",
    LN?.location_raw === "hẻm 137 Nguyễn Trãi", JSON.stringify({ loc: LN?.location_raw, rep: rN.body.replies }));
  // (2) trả lời câu địa chỉ đang treo (đúng kịch bản chủ dự án 06/10 14:06).
  fresh(seedKho);
  {
    const s = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb");
    const t = db().insert("listings", { code: "BDS-Q5-0961", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "nha_pho", can_chu_duyet: true, location_raw: null, ward: null, district: null, price_raw: "8 tỷ 5", price_vnd: 8.5e9, area_m2: 60 }).data;
    s.active_listing_id = t.id;
    db().insert("info_requests", { listing_id: t.id, question: "vi_tri", status: "pending" });
    globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [
      { khoa: "duong", gia_tri: "137 hẻm Nguyễn Trãi", trich_dan: "hẻm 137 Nguyễn Trãi", can: null },
      { khoa: "ten_duong", gia_tri: "Nguyễn Trãi", trich_dan: "hẻm 137 Nguyễn Trãi", can: null },
      { khoa: "quan", gia_tri: "Quận 5", trich_dan: "quận 5", can: null },
    ], tra_loi: { co_tra_loi: true, gia_tri: "137 hẻm Nguyễn Trãi", trich_dan: "hẻm 137 Nguyễn Trãi" } } : OUT();
    rN = await send({ external_user_id: "z-ccrb", text: "Nhà ở hẻm 137 Nguyễn Trãi quận 5" });
    const vt = db().t.listing_facts.filter((f) => f.listing_id === t.id && f.question === "vi_tri").map((f) => f.answer);
    check("NV-E2 trả lời câu địa chỉ treo → vị trí là 'hẻm 137 Nguyễn Trãi', không chỗ nào '137 hẻm'",
      [t.location_raw, ...vt].some((v) => v === "hẻm 137 Nguyễn Trãi") && ![t.location_raw, ...vt].some((v) => /137 hẻm/.test(v ?? "")),
      JSON.stringify({ loc: t.location_raw, vt, rep: rN.body.replies }));
  }
  globalThis.__cauHinh = cuCH;
  globalThis.__model.parse = cuParse;
}
// ── 06/10/2026 (SRS-5.1zzs, khớp AOND): lời chào mời gửi ảnh / không cần form; lên kệ nói hạng; môi giới 2–9 căn nhắc chuẩn 10 căn ──
{
  fresh(seedKho);
  let rG = await send({ external_user_id: "g-moi-1", text: "chào em" });
  check("AOND-G1 lời chào NGẮN hai câu (chủ dự án 06/10 bác vế mời gửi ảnh / không form của AOND), kết bằng câu hỏi vai",
    !/gửi ảnh|điền form|nhắn như nhắn bạn/.test(rG.body.reply ?? "") && /cần giao bán bất động sản đúng không ạ\?\s*$/.test(rG.body.reply ?? ""), JSON.stringify(rG.body));
  const seedDuyet = (uid, type, code, them = 0) => fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: uid, seller_type: type, name: null, active_listing_id: null }).data;
    for (let i = 0; i < them; i++) {
      d.insert("listings", { code: `${code}-${i}`, seller_id: s.id, deal: "ban", status: "dang_ban", property_type: "nha_pho", location_raw: `${i + 1} Hồng Bàng`, ward: "Phường 12", district: "Quận 5", price_raw: "7 tỷ", price_vnd: 7e9, area_m2: 50 });
    }
    const l = d.insert("listings", { code, seller_id: s.id, deal: "ban", status: "cho_thong_tin", can_chu_duyet: true, property_type: "nha_pho", location_raw: "9 Hồng Bàng", ward: "Phường 12", district: "Quận 5", price_raw: "8 tỷ", price_vnd: 8e9, area_m2: 60, floors: 3, bedrooms: 3, legal_status: "so_hong_rieng", access_type: "hem_xe_hoi", alley_width_m: 4 }).data;
    d.insert("listing_facts", { listing_id: l.id, question: "hinh_anh", answer: "https://x/1.jpg", source: "seller_chat" });
    d.insert("info_requests", { listing_id: l.id, question: "duyet_tin", status: "pending" });
    s.active_listing_id = l.id;
  });
  seedDuyet("g-ccrb", "ccrb", "BDS-Q5-0971");
  rG = await send({ external_user_id: "g-ccrb", text: "ok đăng đi em" });
  const lG = db().t.listings.find((l) => l.code === "BDS-Q5-0971");
  check("AOND-G2 chính chủ gật → lên kệ, câu lên kệ nói hạng (mock: Bạc), KHÔNG nhắc chuẩn 10 căn",
    lG?.status === "dang_ban" && /hạng Bạc/.test(rG.body.replies.join("\n")) && !/10 căn/.test(rG.body.replies.join("\n")),
    JSON.stringify({ st: lG?.status, rep: rG.body.replies }));
  seedDuyet("g-nmg", "nmg", "BDS-Q5-0972", 2);
  rG = await send({ external_user_id: "g-nmg", text: "ok đăng đi em" });
  const lG2 = db().t.listings.find((l) => l.code === "BDS-Q5-0972");
  check("AOND-G3 môi giới 3 căn gật → lên kệ, có hạng; KHÔNG nhắc chuẩn 10 căn, không hứa quyền lợi (chủ dự án 06/10 bỏ câu đó)",
    lG2?.status === "dang_ban" && /hạng Bạc/.test(rG.body.replies.join("\n")) && !/10 căn/.test(rG.body.replies.join("\n")) && !/ưu tiên/.test(rG.body.replies.join("\n")),
    JSON.stringify({ st: lG2?.status, rep: rG.body.replies }));
}
// ── kết ──
let hong = 0;
for (const [n, ok, d] of R) { if (!ok) hong++; console.log(`${ok ? "✓" : "✗"} ${n}${ok ? "" : "\n     → " + String(d).slice(0, 600)}`); }
console.log(hong ? `\n${hong}/${R.length} CA HỎNG` : `\nTẤT CẢ ${R.length} CA ĐẠT`);
process.exit(hong ? 1 : 0);
