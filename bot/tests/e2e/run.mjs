import { FakeDB } from "./mock-supabase.mjs";
import { OUT } from "./mock-anthropic.mjs";
import { tenTroLy } from "../../supabase/functions/_shared/prompts.ts"; // FR-181: cùng hàm băm với chat-reply
globalThis.__calls = []; globalThis.__db = new FakeDB();
// 09/09/2026: câu hỏi mẫu + lời chào sửa được ở Dashboard — seed bot_prompts trước lượt đầu
// (napCauHinh nhớ tạm 60 s, đọc một lần cho cả run). vi_tri đổi câu để chứng minh bản DB đè bản code.
const seedBotPrompts = (d) => { d.insert("bot_prompts", { key: "cau_hoi_mau", content: JSON.stringify({ vi_tri: "Nhà mình ở đâu vậy {ac}, đường nào số mấy?" }) });
globalThis.__db.insert("bot_prompts", { key: "loi_chao", content: "Dạ em chào anh/chị, em là {ten} bên AI Ơi Nhà Đất ạ. Anh/chị đang muốn mua, thuê hay đang có nhà cần bán/cho thuê ạ?\nBên em có anh Thu phụ trách khu vực Sài Gòn, sẽ theo anh/chị tới khi bán được, cho thuê được hay mua được nhà nha." }); };
seedBotPrompts(globalThis.__db);
// FR-185: ảnh chủ nhà gửi được TẢI VỀ kho — mock fetch trả vài byte JPEG cho host Zalo,
// mọi URL khác lỗi (chat-reply không được gọi ra ngoài trong bài kiểm).
globalThis.__anhTaiDuoc = true;
globalThis.fetch = async (url) => {
  globalThis.__fetches = [...(globalThis.__fetches ?? []), String(url)];
  if (!globalThis.__anhTaiDuoc || !/zdn\.vn|zadn\.vn/.test(String(url))) return new Response("", { status: 404 });
  return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } });
};
// FR-185: kịch bản model PHÂN LOẠI ẢNH (nhận ra qua DAU_HIEU trong system prompt);
// mặc định ảnh mặt tiền, đặt `globalThis.__anh` để dựng cảnh sổ hồng / không rõ.
const ANH = (o = {}) => ({ loai: "mat_tien", mo_ta: "hình như mặt tiền nhà 2 tầng", giay_to: null, ...o });
const laLuotAnh = (p) => (p?.system ?? []).some((s) => /PHÂN LOẠI ẢNH CHỦ NHÀ GỬI/.test(s.text ?? ""));
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
// `__treTruyVan` phải được xoá ở đây: quên là độ trễ của ca "đua" rỉ sang mọi
// ca sau, làm bộ kiểm chậm đi và đo một thế giới khác.
function fresh(seed) { globalThis.__db = new FakeDB(); seedBotPrompts(globalThis.__db); globalThis.__calls = []; globalThis.__model = { parse: (p) => laLuotAnh(p) ? ANH(globalThis.__anh) : OUT() }; globalThis.__rpc = {}; globalThis.__treTruyVan = null; globalThis.__anh = undefined; globalThis.__anhTaiDuoc = true; globalThis.__storageHong = false; seed?.(globalThis.__db); }
// Lượt gọi model chỉ tính NHÁNH MUA (parse hồ sơ), không tính lượt phân loại ảnh (FR-185).
const parseMua = () => globalThis.__calls.filter((c) => c.kind === "parse" && !laLuotAnh(c.params));
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
const createCalls = () => globalThis.__calls.filter((c) => c.kind === "create");
const sysText = (c) => c.params.system[1].text;

// ── VAI 1: người lạ ─────────────────────────────────────────────────────────
fresh();
let r = await send({ external_user_id: "la-1", text: "chào em" });
check("V1.1 lạ 'chào em' → hỏi vai, không gọi model", r.body.hoi_vai === true && /cần bán\/cho thuê/.test(r.body.reply) && /anh Thu/.test(r.body.reply) && parseCalls().length === 0, JSON.stringify(r.body));
// FR-181 (09/09 chiều): lời chào xưng TÊN TRỢ LÝ RIÊNG của khách này (băm từ Zalo ID), không còn "Thái".
check("V1.1b lời chào xưng tên trợ lý riêng (T•ai/Kh•ai…), không phải Thái, không còn {ten}", new RegExp(`em là ${tenTroLy("la-1").replace("•", "\\u2022")} bên`).test(r.body.reply) && !/Thái|\{ten\}/.test(r.body.reply), r.body.reply);
check("V1.1 cờ hoi_vai lưu trên buyer", db().t.buyers[0]?.preferences?.hoi_vai === true);
check("V1.1 câu hỏi vai nằm trong sổ tin", db().t.messages.some((m) => m.sender === "bot" && /anh Thu/.test(m.body)));
r = await send({ external_user_id: "la-1", text: "tôi có căn nhà ở phường 4" });
check("V1.2 trả lời có nhà → mở hồ sơ bán, nhãn chính chủ", db().t.sellers.length === 1 && db().t.sellers[0].seller_type === "ccrb" && r.body.role === "seller", JSON.stringify(r.body));
check("V1.2 người đó KHÔNG được báo nhãn, KHÔNG kèm biểu phí (chủ dự án 09/09 tối: gán im lặng)", !r.body.replies.some((x) => /ghi nhận anh.chị là (chính chủ|môi giới)/i.test(x)) && !r.body.replies.some((x) => /1%|0,5%/.test(x)), JSON.stringify(r.body.replies));
check("V1.2 ADMIN nhận việc: hồ sơ mở từ chat, nhãn chính chủ", db().t.reminders.some((x) => x.kind === "escalation" && /🆕/.test(x.note) && /CHÍNH CHỦ/.test(x.note) && !x.seller_id), JSON.stringify(db().t.reminders));
check("V1.2 chưa tạo tin (chưa có chi tiết), model được báo là người bán MỚI", db().t.listings.length === 0 && createCalls().some((c) => /VỪA cho biết/.test(c.params.messages[0].content)));
r = await send({ external_user_id: "la-1", text: "bán nhà P4 giá 5 tỷ 8 50m2" });
const L = db().t.listings[0];
check("V1.3 câu rao → tạo tin nháp đúng giá/phường", L && L.ward === "Phường 4" && /5 tỷ 8/.test(L.price_raw) && L.price_vnd === 5.8e9 && r.body.listing_code === L.code, JSON.stringify({ L, body: r.body }));
// FR-177 d: tin từ chat KHÔNG còn lên kệ chỉ vì đủ giá+phường+diện tích — phải
// đủ 70 điểm và chủ gật bản nháp. Đủ nhóm cơ bản thì câu đầu là chuyên môn (hẻm).
// 09/09/2026 (chủ dự án): "chỉ cần rao và hỏi vị trí cụ thể" — vi_tri vào nhóm cơ
// bản, nên rao chưa nói đường/hẻm thì câu đầu là VỊ TRÍ, chưa tới hẻm rộng.
check("V1.3 rao đủ giá+phường+diện tích nhưng chưa nói đường/hẻm → cho_thong_tin (can_chu_duyet), câu đầu là VỊ TRÍ CỤ THỂ", L?.status === "cho_thong_tin" && L?.can_chu_duyet === true && db().t.info_requests.some((q) => q.listing_id === L?.id && q.question === "vi_tri" && q.status === "pending"), JSON.stringify({ L, ir: db().t.info_requests }));
check("V1.3 bong bóng đầu 'Em ghi nhận' liệt kê đúng thứ bóc được, không có thứ trống, đứng trước lời chào", /^📝 Em ghi nhận: bán( nhà phố)? · Phường 4, Quận 5 · 50m2 · giá 5 tỷ 8\./.test(r.body.replies[0] ?? "") && r.body.replies.length >= 2 && !/gấp|phòng ngủ/.test(r.body.replies[0]), JSON.stringify(r.body.replies));
check("V1.3 câu hỏi mẫu vi_tri lấy từ bot_prompts.cau_hoi_mau (đè bản code)", createCalls().some((c) => /Nhà mình ở đâu vậy anh\/chị, đường nào số mấy\?/.test(c.params.messages[0].content)), createCalls().at(-1)?.params.messages[0].content.slice(0, 300));
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
check("V1.6 người đó KHÔNG được báo nhãn môi giới, không phí (09/09 tối); admin vẫn nhận việc MÔI GIỚI", !r.body.replies.some((x) => /ghi nhận anh.chị là môi giới/i.test(x)) && !r.body.replies.some((x) => /0,5%/.test(x)) && db().t.reminders.some((x) => /🆕/.test(x.note) && /MÔI GIỚI/.test(x.note)), JSON.stringify(r.body.replies));
check("V1.6 tự xưng sale → nhãn môi giới", db().t.sellers[0]?.seller_type === "nmg" && db().t.listings.length === 1, JSON.stringify(db().t.sellers));
fresh();
r = await send({ external_user_id: "la-4", text: "nhà mình bán chưa em?" });
check("V1.7 câu hỏi tình trạng từ người lạ → hỏi vai (không bịa hồ sơ bán)", r.body.hoi_vai === true && db().t.sellers.length === 0);
r = await send({ external_user_id: "la-4", text: "tôi có căn nhà ở Q10, giờ tìm Q5" });
check("V1.8 trả lời kể hoàn cảnh + tìm nhà → ở hàng mua, xoá cờ, không mở hồ sơ bán", db().t.sellers.length === 0 && parseCalls().length === 1 && !db().t.buyers[0].preferences.hoi_vai, JSON.stringify(db().t.buyers[0].preferences));
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
check("TOIUU-02 người mua lượt đầu ≤ 19 truy vấn (+1 trần cá nhân SEC-05; +1 FR-181 ghi tên trợ lý vào hồ sơ, CHỈ lượt đầu)", v.n <= 19, `${v.n}`);
v = await vong({ external_user_id: "do-1", text: "có căn nào không em" });
console.log(`   [đo] người mua đã có hồ sơ, bot gợi căn + follow-up: ${v.n} truy vấn`);
check("TOIUU-03 người mua có hồ sơ ≤ 17 truy vấn (v43: 24; +1 trần cá nhân SEC-05)", v.n <= 17, `${v.n}`);
check("TOIUU-04 follow-up FR-32 đi qua RPC tao_followup, không đếm/tra/chèn tay", db().log.some((l) => l.rpc === "tao_followup") && db().t.reminders.some((x) => x.kind === "followup"));
check("TOIUU-05 bot_prompts chỉ đọc MỘT lần cho cả ba lượt (nhớ tạm 60 s)", db().log.filter((l) => l.table === "bot_prompts").length <= 1, String(db().log.filter((l) => l.table === "bot_prompts").length));
check("TOIUU-06 loạt bong bóng bot vào sổ bằng MỘT câu INSERT mảng", db().log.some((l) => l.table === "messages" && l.op === "insert" && Array.isArray(l.payload)));
fresh(seedKho);
db().insert("info_requests", { listing_id: db().t.listings[0].id, question: "phap_ly", status: "pending" });
v = await vong({ external_user_id: "z-ccrb", text: "sổ hồng đầy đủ em" });
console.log(`   [đo] người bán trả lời câu chờ: ${v.n} truy vấn`);
check("TOIUU-07 người bán trả lời câu chờ ≤ 20 truy vấn (v43: 21; +1 trần cá nhân SEC-05; +2 FR-176 lịch sử + đếm căn; +1 FR-181 ghi tên trợ lý, CHỈ lượt đầu; +1 09/09 tối: đọc câu đã hết hạn để không mở lại)", v.n <= 20 && v.r.body.role === "seller", `${v.n}`);
v = await vong({ external_user_id: "z-ccrb", text: "hoàn công đủ rồi" });
check("TOIUU-07b lượt sau của cùng người bán ≤ 18 (không còn update tên trợ lý)", v.n <= 18, `${v.n}`);
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
check("DIABAN-02 chỉ nói phường → mặc định cụm khởi điểm Quận 5", db().t.listings[0]?.district === "Quận 5" && db().t.listings[0]?.ward === "Phường 4", JSON.stringify(db().t.listings[0]));
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
check("V48-79a người lạ 'alo được không' → KHÔNG hỏi vai, need_human, việc escalation 'VOICE: <uid> muốn gọi điện…', voice_request trong payload", !r.body.hoi_vai && r.body.voice_request === true && db().t.conversations.find((c) => c.buyer_id === b5.id).needs_human === true && db().t.reminders.some((x) => x.kind === "escalation" && x.buyer_id === b5.id && /^VOICE: v48-5 muốn gọi điện/.test(x.note)), JSON.stringify({ body: r.body, rem: db().t.reminders }));
r = await send({ external_user_id: "v48-5", text: "gọi điện cho anh nha" });
check("V48-79b lặp trong 24h → không đẻ thêm việc VOICE", db().t.reminders.filter((x) => /^VOICE:/.test(x.note)).length === 1);
fresh(seedKho);
await send({ external_user_id: "v48-5b", text: "tìm nhà q5 tầm 5 tỷ" });
globalThis.__model.parse = () => OUT({ voice_request: true, replies: ["Dạ để em nhờ anh phụ trách gọi lại ạ"] });
r = await send({ external_user_id: "v48-5b", text: "mình nói chuyện trực tiếp được không" });
check("V48-79c model bật voice_request (regex không bắt) → vẫn mở việc VOICE + need_human", db().t.reminders.some((x) => /^VOICE:/.test(x.note)) && r.body.voice_request === true && db().t.conversations.at(-1).needs_human === true);
globalThis.__model.parse = () => { throw new Error("model chết"); };
r = await send({ external_user_id: "v48-5c", text: "goi dien cho toi duoc khong" });
check("V48-79d model hỏng + không dấu → câu mẫu 'nhờ anh/chị phụ trách gọi lại' + việc VOICE", /gọi lại/.test(r.body.reply) && db().t.reminders.some((x) => /^VOICE: v48-5c/.test(x.note)));

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
r = await send({ external_user_id: "v48-8", text: "bán căn A12-05 dự án Ny'ah giá 6 tỷ 60m2" });
const L9 = db().t.listings.at(-1);
check("V48-114 câu rao có tên dự án → tin gắn project_id + unit_code A12-05, unit_status con_ban, last_confirmed_at", r.body.role === "seller" && L9.project_id === pj.id && L9.unit_code === "A12-05" && L9.unit_status === "con_ban" && !!L9.last_confirmed_at, JSON.stringify(L9));
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
  check("G1 'kêu chị nha' khi đang hỏi pháp lý → KHÔNG ghi fact, câu hỏi vẫn treo, không rơi xuống chăm sóc chung",
    !db().t.listing_facts.some((f) => f.question === "phap_ly") &&
      db().t.info_requests.some((q) => q.question === "phap_ly" && q.status === "pending") &&
      r.body.loai_cau === "xung_ho" && r.body.reask === "phap_ly",
    JSON.stringify(r.body));
  check("G1 nhớ xưng hô 'chị' vào sellers.xung_ho", db().t.sellers.find((s) => s.zalo_user_id === "z-ccrb")?.xung_ho === "chị", JSON.stringify(db().t.sellers[0]));
  check("G1 câu lệnh model mang cách gọi 'chị'", createCalls().some((c) => /Gọi chủ nhà là "chị"/.test(prompt(c))), prompt(createCalls().at(-1)));
  r = await send({ external_user_id: "z-ccrb", text: "sổ hồng riêng rồi em" });
  const cuoi = prompt(createCalls().at(-1));
  check("G2 lượt sau trả lời thật → ghi fact pháp lý + đóng câu hỏi",
    db().t.listing_facts.some((f) => f.question === "phap_ly" && /sổ hồng/.test(f.answer)) &&
      db().t.info_requests.every((q) => q.question !== "phap_ly" || q.status === "answered"),
    JSON.stringify(db().t.info_requests));
  check("G2 câu lệnh có LỊCH SỬ (thấy 'Kêu chị nha' của lượt trước) và vẫn gọi 'chị'",
    /CHỦ NHÀ: Kêu chị nha/.test(cuoi) && /Gọi chủ nhà là "chị"/.test(cuoi), cuoi);
  // Căn 0001 đã đủ thông tin → nhánh "đã lên web": người 3 căn thì vẫn được
  // nhắc mã căn, và KHÔNG bị bảo "chỉ có một căn".
  // FR-178: nhiều căn thì neo bằng ĐỊA CHỈ, không đọc mã tin cho khách.
  check("G2 chính chủ 3 căn → câu lệnh neo căn bằng địa chỉ (12 Trần Hưng Đạo), KHÔNG mã tin, không nói 'chỉ có một căn'", /12 Trần Hưng Đạo/.test(cuoi) && !/#BDS-Q5-0001/.test(cuoi) && !/chỉ có một căn/.test(cuoi), cuoi);
  db().insert("info_requests", { listing_id: lst1().id, question: "huong", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "16m nha" });
  check("G3 '16m nha' khi hỏi hướng → KHÔNG ghi hướng, hỏi lại",
    !db().t.listing_facts.some((f) => f.question === "huong") && r.body.loai_cau === "lech" && r.body.reask === "huong",
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
  check("G6 chủ nhà hỏi ngược khi đang bị hỏi → không ghi, loại 'hoi', câu hỏi vẫn treo",
    r.body.loai_cau === "hoi" && db().t.info_requests.some((q) => q.question === "nam_xay" && q.status === "pending"),
    JSON.stringify(r.body));

  fresh();
  r = await send({ external_user_id: "la-20", text: "bán nhà ở trần bình trọng q5" });
  check("G7 chủ MỘT căn: câu lệnh nói không nhắc mã tin; bong bóng nhãn KHÔNG kèm phí",
    createCalls().some((c) => /KHÔNG nhắc mã tin/.test(prompt(c))) && !r.body.replies.some((x) => /1%|0,5%/.test(x)),
    JSON.stringify({ replies: r.body.replies, p: prompt(createCalls().at(-1)) }));
}

// ── FR-177: hỏi như môi giới giỏi — bám câu khách, câu lệch vẫn ghi, bản nháp + duyệt ──
{
  fresh();
  const prompt = (c) => c?.params?.messages?.[0]?.content ?? "";
  const pend = (q) => db().t.info_requests.some((x) => x.question === q && x.status === "pending");
  const fact = (q) => db().t.listing_facts.find((f) => f.question === q);
  r = await send({ external_user_id: "h-1", text: "bán nhà hẻm trần bình trọng p4 giá 5 tỷ 8 60m2" });
  const H = db().t.listings[0];
  check("H1 rao đủ cơ bản → tin can_chu_duyet, chưa lên kệ, câu đầu là HẺM (nhóm chuyên môn, ưu tiên 1)",
    H?.can_chu_duyet === true && H?.status === "cho_thong_tin" && pend("do_rong_hem"), JSON.stringify({ H, ir: db().t.info_requests }));
  check("H1b vị trí cụ thể bóc từ câu rao ('hẻm trần bình trọng') → fact vi_tri + location_raw, KHÔNG hỏi lại vị trí",
    /trần bình trọng/i.test(fact("vi_tri")?.answer ?? "") && /trần bình trọng/i.test(H?.location_raw ?? "") && !pend("vi_tri"), JSON.stringify({ f: db().t.listing_facts, H }));
  r = await send({ external_user_id: "h-1", text: "hẻm 4m xe hơi vào tận nhà" });
  check("H2 trả lời hẻm → ghi fact, câu kế LIÊN QUAN: kết cấu (không nhảy sang pháp lý)",
    fact("do_rong_hem") && pend("ket_cau") && !pend("phap_ly"), JSON.stringify(db().t.info_requests));
  check("H2 câu lệnh model có KHÍCH LỆ gắn khách mua", /khích lệ có nghĩa gắn với khách mua/.test(prompt(createCalls().at(-1))), prompt(createCalls().at(-1)));
  r = await send({ external_user_id: "h-1", text: "sổ hồng riêng rồi em" });
  check("H3 hỏi kết cấu, trả lời pháp lý → VẪN GHI phap_ly, câu kết cấu vẫn treo, hỏi lại",
    fact("phap_ly")?.answer === "sổ hồng riêng rồi em" && !fact("ket_cau") && pend("ket_cau") && r.body.reask === "ket_cau",
    JSON.stringify({ body: r.body, f: db().t.listing_facts }));
  r = await send({ external_user_id: "h-1", text: "nhà nở hậu chút" });
  check("H4 câu lệch không nhận ra fact nào → ghi nguyên văn vào bo_sung, câu kết cấu vẫn treo",
    fact("bo_sung")?.answer === "nhà nở hậu chút" && pend("ket_cau") && r.body.loai_cau === "lech",
    JSON.stringify({ body: r.body, f: db().t.listing_facts }));
  r = await send({ external_user_id: "h-1", text: "3 lầu 4 phòng ngủ" });
  // FR-186 (09/09 chiều): nhà phố hỏi thêm TIỀM NĂNG (để ở hay kinh doanh ngành gì) trước khi gửi nháp — chuỗi 07/09 của sếp + chat 21/06.
  check("H4b trả lời kết cấu → câu kế là TIỀM NĂNG (hợp để ở hay kinh doanh), chưa gửi nháp", r.body.saved_fact === "ket_cau" && pend("tiem_nang") && !r.body.ban_nhap, JSON.stringify({ body: r.body, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  r = await send({ external_user_id: "h-1", text: "ở hoặc làm văn phòng đều được" });
  const nhap = r.body.replies.join("\n");
  check("H5 đủ chuyên môn + ≥70 điểm → gửi BẢN NHÁP TIN (tiền định, không model), mở câu chờ duyet_tin, tin CHƯA lên kệ",
    r.body.ban_nhap === true && r.body.diem >= 70 && /BẢN NHÁP TIN/.test(nhap) && /5 tỷ 8/.test(nhap) &&
      /nhắn Zalo cho em/.test(nhap) && !/#BDS/.test(nhap) && !/\d{3,}\s*\d{3}\s*\d{3}/.test(nhap) && !createCalls().some((c) => /BẢN NHÁP/.test(prompt(c))) &&
      pend("duyet_tin") && H.status === "cho_thong_tin",
    JSON.stringify({ body: r.body, H }));
  r = await send({ external_user_id: "h-1", text: "à giá 6 tỷ nha" });
  check("H6 chủ sửa giá lúc đang duyệt → ghi giá mới, GỬI LẠI bản nháp với giá mới, câu duyệt vẫn treo",
    r.body.sua_nhap === true && H.price_raw && /6 tỷ/.test(H.price_raw) && r.body.replies.some((x) => /6 tỷ/.test(x) && /BẢN NHÁP/.test(x)) && pend("duyet_tin"),
    JSON.stringify({ body: r.body, H }));
  r = await send({ external_user_id: "h-1", text: "phí sao em?" });
  check("H7 hỏi ngược lúc đang duyệt → loại 'hoi', câu duyệt vẫn treo, không đóng dấu",
    r.body.loai_cau === "hoi" && pend("duyet_tin") && !H.chu_duyet_at, JSON.stringify(r.body));
  r = await send({ external_user_id: "h-1", text: "ok đăng đi em" });
  check("H8 chủ GẬT → chu_duyet_at, tin lên kệ (dang_ban), câu duyệt đóng, bong bóng báo đã lên web",
    r.body.duyet === true && !!H.chu_duyet_at && H.status === "dang_ban" && !pend("duyet_tin") && /lên web/.test(r.body.replies[0]),
    JSON.stringify({ body: r.body, H }));
  // FR-177 f (09/09): chúc mừng kèm ĐIỂM + cách thêm điểm; điểm là tiền định (diem_tin).
  check("H8e chúc mừng kèm điểm X/100 và cách thêm điểm (ảnh), hứa hỏi thêm trong mấy ngày tới",
    typeof r.body.diem === "number" && new RegExp(`${r.body.diem}/100`).test(r.body.replies[0]) && /Chúc mừng/.test(r.body.replies[0]) && /thêm điểm/.test(r.body.replies[0]) && /ảnh/.test(r.body.replies[0]) && /mấy ngày tới/.test(r.body.replies[0]),
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
  check("H10b kết thúc vòng hỏi → xin chủ nhà chấm điểm cách chăm sóc (giống người thật? mất thời gian? mấy điểm), mở câu chờ danh_gia",
    r.body.xin_danh_gia === true && r.body.replies.length === 2 && /người thật/.test(r.body.replies[1]) && /mấy điểm/.test(r.body.replies[1]) && pend("danh_gia"), JSON.stringify(r.body));
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
  check("N1 người bán lượt đầu → sellers.ten_tro_ly = tên băm từ Zalo ID; system prompt nhánh bán 'Bạn là \"<tên>\"', không 'Thái', không '{ten}'",
    sC?.ten_tro_ly === tenTroLy("z-ccrb") && createCalls().some((c) => c.params.system[0].text.includes(`Bạn là "${tenTroLy("z-ccrb")}"`)) && !createCalls().some((c) => /Thái|\{ten\}/.test(c.params.system[0].text)),
    JSON.stringify({ ten: sC?.ten_tro_ly, sys: createCalls().at(-1)?.params.system[0].text.slice(0, 120) }));
  r = await send({ external_user_id: "z-ccrb", text: "ok em" });
  check("N1b lượt sau KHÔNG update ten_tro_ly nữa (đã có)", db().log.filter((l) => l.table === "sellers" && l.op === "update" && l.payload?.ten_tro_ly).length === 1);
  // FR-181: khách mua → preferences.ten_tro_ly qua merge_buyer_prefs (không thêm vòng DB).
  fresh();
  await send({ external_user_id: "m-1", text: "chào em" });
  r = await send({ external_user_id: "m-1", text: "tôi muốn mua nhà phường 4 tầm 5 tỷ" });
  check("N2 khách mua → buyers.preferences.ten_tro_ly = tên băm; system prompt mua xưng đúng tên", db().t.buyers[0]?.preferences?.ten_tro_ly === tenTroLy("m-1") && parseCalls().some((c) => c.params.system[0].text.includes(`Bạn là "${tenTroLy("m-1")}"`)), JSON.stringify(db().t.buyers[0]?.preferences));

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
  r = await send({ external_user_id: "h-9", text: "bán nhà hẻm trần bình trọng p4 giá 5 tỷ 8 60m2" });
  const H9 = db().t.listings[0];
  for (const t of ["hẻm 4m xe hơi", "3 lầu", "4 phòng ngủ", "sổ hồng riêng hoàn công đủ"]) r = await send({ external_user_id: "h-9", text: t });
  check("N6 chuỗi nhà phố 09/09: hẻm → lầu → phòng → pháp lý → tiềm năng (câu mới FR-186) rồi mới bản nháp", pend("tiem_nang", H9.id), JSON.stringify(db().t.info_requests.map((q) => [q.question, q.status])));
  r = await send({ external_user_id: "h-9", text: "ở hoặc làm văn phòng đều được" });
  check("N6b trả lời tiềm năng → bản nháp (điểm ≥70), mở duyet_tin", r.body.ban_nhap === true && pend("duyet_tin", H9.id), JSON.stringify(r.body));
  r = await send({ external_user_id: "h-9", text: "chốt đi em" });
  check("N6c 'chốt đi' lúc duyệt = GẬT (không phải báo bán rồi) → lên kệ", r.body.duyet === true && H9.status === "dang_ban" && !r.body.ngung_rao, JSON.stringify(r.body));

  // FR-186: chung cư hỏi HƯỚNG ban công (câu riêng), nhà phố thì không.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-cc", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0101", seller_id: s.id, deal: "ban", status: "cho_thong_tin", property_type: "chung_cu", location_raw: "Sunrise City", ward: "Phường 4", price_raw: "3 tỷ", price_vnd: 3e9, area_m2: 70, floor: 12, can_chu_duyet: true }).data;
    d.insert("info_requests", { listing_id: l.id, question: "so_phong_ngu", status: "pending" });
  });
  r = await send({ external_user_id: "z-cc", text: "2 phòng ngủ" });
  check("N7 chung cư trả lời phòng ngủ → câu kế là HƯỚNG (ban công), câu gợi ý riêng cho chung cư", pend("huong") && createCalls().some((c) => /Ban công căn mình quay hướng nào/.test(c.params.messages[0].content)), JSON.stringify({ ir: db().t.info_requests, p: createCalls().at(-1)?.params.messages[0].content.slice(-300) }));
  fresh();
  r = await send({ external_user_id: "h-10", text: "bán nhà hẻm trần bình trọng p4 giá 5 tỷ 8 60m2" });
  check("N7b nhà phố: view thiếu KHÔNG có hướng (nhóm phụ)", !db().missingFacts().some((m) => m.fact_key === "huong"), JSON.stringify(db().missingFacts()));
  // FR-186: cho thuê → hỏi cọc / thời hạn / trượt giá sau pháp lý.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-thue", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0102", seller_id: s.id, deal: "cho_thue", status: "cho_thong_tin", property_type: "nha_pho", location_raw: "12 Trần Hưng Đạo", ward: "Phường 4", price_raw: "15tr/tháng", price_vnd: 15e6, area_m2: 50, floors: 2, bedrooms: 2, alley_width_m: 4, can_chu_duyet: true }).data;
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
    const l = d.insert("listings", { code: "BDS-Q5-0104", seller_id: s.id, deal: "cho_thue", status: "cho_thong_tin", property_type: "kho_xuong", location_raw: "KCN Tân Tạo", ward: "Tân Tạo", price_raw: "80tr/tháng", price_vnd: 80e6, area_m2: 1000, can_chu_duyet: true }).data;
    d.insert("info_requests", { listing_id: l.id, question: "chieu_cao", status: "pending" });
  });
  r = await send({ external_user_id: "z-kho", text: "xưởng cao thông thủy 9m" });
  check("N13 kho xưởng: 'cao thông thủy 9m' khớp câu chiều cao → ghi fact, hỏi tải trọng sàn", db().t.listing_facts.some((f) => f.question === "chieu_cao") && pend("tai_trong_san"), JSON.stringify(db().t.info_requests.map((q) => [q.question, q.status])));
  r = await send({ external_user_id: "z-kho", text: "sàn chịu 2 tấn" });
  check("N13b tải trọng sàn khớp (câu số) → ghi fact, câu kế là trạm biến áp", db().t.listing_facts.some((f) => f.question === "tai_trong_san") && pend("tram_bien_ap"), JSON.stringify({ f: db().t.listing_facts.map((f) => [f.question, f.answer]), ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
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
  check("N15 né lần 1: ghi do_rong_hem, câu địa chỉ VẪN treo, hỏi lại", db().t.listing_facts.some((f) => f.question === "do_rong_hem") && pend("vi_tri"), JSON.stringify(db().t.info_requests.map((q) => [q.question, q.status])));
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
  check("N16 'đăng đi' khi đang treo câu thông số + tin ≥70 → BẢN NHÁP ngay, câu treo hết hạn, không ghi 'đăng đi' làm fact",
    r.body.ban_nhap === true && !db().t.listing_facts.some((f) => /đăng đi/.test(f.answer)) && db().t.info_requests.some((q) => q.question === "tiem_nang" && q.status === "expired") && pend("duyet_tin"),
    JSON.stringify({ body: r.body.replies, ir: db().t.info_requests.map((q) => [q.question, q.status]), f: db().t.listing_facts.map((f) => [f.question, f.answer]) }));

  // 09/09 tối lần 4: "đất thuê nhà nước tới 2058" của NGƯỜI BÁN không phải ý định đi thuê.
  fresh((d) => {
    const s = d.insert("sellers", { zalo_user_id: "z-thue-dat", seller_type: "ccrb", name: null, active_listing_id: null }).data;
    const l = d.insert("listings", { code: "BDS-Q5-0108", seller_id: s.id, deal: "cho_thue", status: "cho_thong_tin", property_type: "kho_xuong", location_raw: "KCN Tân Tạo", ward: "Tân Tạo", price_raw: "80tr/tháng", price_vnd: 80e6, area_m2: 1000, can_chu_duyet: true }).data;
    d.insert("info_requests", { listing_id: l.id, question: "phap_ly", status: "pending" });
  });
  r = await send({ external_user_id: "z-thue-dat", text: "sổ đỏ, đất thuê nhà nước tới 2058" });
  check("N17 'đất thuê nhà nước' là lời người bán → vẫn nhánh bán, ghi phap_ly + thoi_han_su_dung, không hỏi 'muốn mua hay thuê'", r.body.role === "seller" && db().t.listing_facts.some((f) => f.question === "phap_ly") && db().t.listing_facts.some((f) => f.question === "thoi_han_su_dung" || f.question === "hinh_thuc_thue_dat"), JSON.stringify({ role: r.body.role, f: db().t.listing_facts.map((f) => [f.question, f.answer]), replies: r.body.replies }));

  // FR-185: kho hỏng → không nuốt ảnh: fact URL tạm + bot_errors.
  fresh(seedKho);
  globalThis.__storageHong = true;
  r = await send({ external_user_id: "z-ccrb", text: "", image_url: "https://f9-zpg.zdn.vn/hong.jpg" });
  check("N9 kho hỏng → rơi về fact hinh_anh URL tạm + ghi sổ lỗi, vẫn cảm ơn", db().t.listing_facts.some((f) => f.question === "hinh_anh" && /hong\.jpg/.test(f.answer)) && db().t.listing_media.length === 0 && db().t.bot_errors.some((e) => /anh vao kho/.test(e.source ?? "")) && /Cảm ơn/.test(r.body.replies.at(-1)), JSON.stringify({ f: db().t.listing_facts, e: db().t.bot_errors }));
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
  check("N11 người rao nhiều căn gật bản nháp → chúc mừng có 'Điểm người rao của anh/chị hiện X/100 (N căn đang rao)', RPC diem_nguoi_ban",
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

// ── kết ──
let hong = 0;
for (const [n, ok, d] of R) { if (!ok) hong++; console.log(`${ok ? "✓" : "✗"} ${n}${ok ? "" : "\n     → " + String(d).slice(0, 600)}`); }
console.log(hong ? `\n${hong}/${R.length} CA HỎNG` : `\nTẤT CẢ ${R.length} CA ĐẠT`);
process.exit(hong ? 1 : 0);
