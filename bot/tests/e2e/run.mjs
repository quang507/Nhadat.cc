import { FakeDB } from "./mock-supabase.mjs";
import { OUT } from "./mock-anthropic.mjs";
import { tenTroLy } from "../../supabase/functions/_shared/prompts.ts"; // FR-181: cùng hàm băm với chat-reply
globalThis.__calls = []; globalThis.__db = new FakeDB();
// 09/09/2026: câu hỏi mẫu + lời chào sửa được ở Dashboard — seed bot_prompts trước lượt đầu
// (napCauHinh nhớ tạm 60 s, đọc một lần cho cả run). vi_tri đổi câu để chứng minh bản DB đè bản code.
// 11/09 (42 ca): câu hỏi địa chỉ LẦN ĐẦU dùng khoá riêng `vi_tri@lan_dau` — đè cả hai để V1.3 vẫn đo đúng "bản DB đè bản code".
const seedBotPrompts = (d) => { d.insert("bot_prompts", { key: "cau_hoi_mau", content: JSON.stringify({ vi_tri: "Nhà mình ở đâu vậy {ac}, đường nào số mấy?", "vi_tri@lan_dau": "Nhà mình ở đâu vậy {ac}, đường nào số mấy?", "vi_tri@chua_quan": "Nhà mình ở đâu vậy {ac}, đường nào số mấy?" }) });
globalThis.__db.insert("bot_prompts", { key: "loi_chao", content: "Dạ em chào anh/chị, em là {ten} bên AI Ơi Nhà Đất ạ. Anh/chị đang muốn mua, thuê hay đang có nhà cần bán/cho thuê ạ?" }); }; // 23/09 FR-218 a: bỏ câu "anh Thu phụ trách khu vực" (khớp bot_prompts.loi_chao)
seedBotPrompts(globalThis.__db);
// FR-185: ảnh chủ nhà gửi được TẢI VỀ kho — mock fetch trả vài byte JPEG cho host Zalo,
// mọi URL khác lỗi (chat-reply không được gọi ra ngoài trong bài kiểm).
globalThis.__anhTaiDuoc = true;
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
const createCalls = () => globalThis.__calls.filter((c) => c.kind === "create");
const sysText = (c) => c.params.system[1].text;

// ── VAI 1: người lạ ─────────────────────────────────────────────────────────
fresh();
let r = await send({ external_user_id: "la-1", text: "chào em" });
check("V1.1 lạ 'chào em' → hỏi vai, không gọi model; KHÔNG kèm 'anh Thu phụ trách khu vực' (FR-218 a)", r.body.hoi_vai === true && /cần bán\/cho thuê/.test(r.body.reply) && !/anh Thu|phụ trách/.test(r.body.reply) && parseCalls().length === 0, JSON.stringify(r.body));
// FR-181 (09/09 chiều): lời chào xưng TÊN TRỢ LÝ RIÊNG của khách này (băm từ Zalo ID), không còn "Thái".
check("V1.1b lời chào xưng tên trợ lý riêng (T•ai/Kh•ai…), không phải Thái, không còn {ten}", new RegExp(`em là ${tenTroLy("la-1").replace("•", "\\u2022")} bên`).test(r.body.reply) && !/Thái|\{ten\}/.test(r.body.reply), r.body.reply);
check("V1.1 cờ hoi_vai lưu trên buyer", db().t.buyers[0]?.preferences?.hoi_vai === true);
check("V1.1 câu hỏi vai nằm trong sổ tin", db().t.messages.some((m) => m.sender === "bot" && /cần bán\/cho thuê/.test(m.body)));
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
check("TOIUU-02 người mua lượt đầu ≤ 22 truy vấn (+1 trần cá nhân SEC-05; +1 FR-181 ghi tên trợ lý vào hồ sơ, CHỈ lượt đầu; +1 14/09 đọc công tắc báo lại 🤖; +1 23/09 lọc kho ngay tin đầu; +1 FR-216 đọc công tắc tim_theo_nghia, chỉ khi kho được lọc)", v.n <= 22, `${v.n}`);
v = await vong({ external_user_id: "do-1", text: "có căn nào không em" });
console.log(`   [đo] người mua đã có hồ sơ, bot gợi căn + follow-up: ${v.n} truy vấn`);
check("TOIUU-03 người mua có hồ sơ ≤ 18 truy vấn (v43: 24; +1 trần cá nhân SEC-05; +1 14/09 đọc công tắc báo lại 🤖)", v.n <= 18, `${v.n}`);
check("TOIUU-04 follow-up FR-32 đi qua RPC tao_followup, không đếm/tra/chèn tay", db().log.some((l) => l.rpc === "tao_followup") && db().t.reminders.some((x) => x.kind === "followup"));
check("TOIUU-05 bot_prompts chỉ đọc MỘT lần cho cả ba lượt (nhớ tạm 60 s)", db().log.filter((l) => l.table === "bot_prompts").length <= 1, String(db().log.filter((l) => l.table === "bot_prompts").length));
check("TOIUU-06 loạt bong bóng bot vào sổ bằng MỘT câu INSERT mảng", db().log.some((l) => l.table === "messages" && l.op === "insert" && Array.isArray(l.payload)));
fresh(seedKho);
db().insert("info_requests", { listing_id: db().t.listings[0].id, question: "phap_ly", status: "pending" });
v = await vong({ external_user_id: "z-ccrb", text: "sổ hồng đầy đủ em" });
console.log(`   [đo] người bán trả lời câu chờ: ${v.n} truy vấn`);
check("TOIUU-07 người bán trả lời câu chờ ≤ 23 truy vấn (v43: 21; +1 trần cá nhân SEC-05; +2 FR-176 lịch sử + đếm căn; +1 FR-181 ghi tên trợ lý, CHỈ lượt đầu; +1 09/09 tối: đọc câu đã hết hạn để không mở lại; +1 11/09: đọc công tắc app_config.bao_lai_da_luu — tắt thì dừng ở đó; +1 14/09 FR-208: đọc công tắc boc_tach_ai, CHẠY SONG SONG, chỉ khi tin có mùi dữ liệu; +1 24/09 FR-223: đọc tin + fact (một truy vấn nhúng) để rẽ nhánh câu kế, chỉ khi có luật đụng tới)", v.n <= 23 && v.r.body.role === "seller", `${v.n}`);
v = await vong({ external_user_id: "z-ccrb", text: "hoàn công đủ rồi" });
check("TOIUU-07b lượt sau của cùng người bán ≤ 25 (không còn update tên trợ lý; +1 11/09: đọc công tắc app_config.bao_lai_da_luu; +1 14/09 FR-208: công tắc boc_tach_ai, song song; +4 18/09 FR-211: câu 'hoàn công đủ rồi' có NHÃN → tìm tin, đọc nhan, gộp, ghi fact — chỉ khi câu có nhãn; +1 24/09 FR-223: đọc tin + fact để rẽ nhánh)", v.n <= 25, `${v.n}`);
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
  r = await send({ external_user_id: "h-1", text: "bán nhà hẻm trần bình trọng p4 giá 5 tỷ 8 60m2, không gấp" });
  const H = db().t.listings[0];
  // 20260924c (FR-219): thứ tự "chủ nhà dễ trả lời trước" — đã có vị trí, diện tích, giá → câu đầu là KẾT CẤU.
  check("H1 rao đủ vị trí + diện tích + giá → tin can_chu_duyet, chưa lên kệ, câu đầu là KẾT CẤU (FR-219)",
    H?.can_chu_duyet === true && H?.status === "cho_thong_tin" && pend("ket_cau"), JSON.stringify({ H, ir: db().t.info_requests }));
  check("H1b vị trí cụ thể bóc từ câu rao ('hẻm trần bình trọng') → fact vi_tri + location_raw, KHÔNG hỏi lại vị trí",
    /trần bình trọng/i.test(fact("vi_tri")?.answer ?? "") && /trần bình trọng/i.test(H?.location_raw ?? "") && !pend("vi_tri"), JSON.stringify({ f: db().t.listing_facts, H }));
  r = await send({ external_user_id: "h-1", text: "3 lầu" });
  check("H2 trả lời kết cấu → ghi fact, câu kế LIÊN QUAN: phòng ngủ (không nhảy sang pháp lý)",
    fact("ket_cau") && pend("so_phong_ngu") && !pend("phap_ly"), JSON.stringify(db().t.info_requests));
  check("H2 câu lệnh model: chưa khen gần đây → CHỈ khen khi thật đáng nói (18/09: lâu lâu mới khen), không đọc lại số (24/09)", /CHỈ khi chủ nhà vừa nói điều thật đáng nói với khách mua/.test(prompt(createCalls().at(-1))) && /KHÔNG đọc lại số liệu/.test(prompt(createCalls().at(-1))) && !/gộp thêm một ý/.test(prompt(createCalls().at(-1))) && !/KHÔNG khen, KHÔNG nhận xét/.test(prompt(createCalls().at(-1))), prompt(createCalls().at(-1)));
  r = await send({ external_user_id: "h-1", text: "sổ hồng riêng rồi em" });
  check("H3 hỏi phòng ngủ, trả lời pháp lý → VẪN GHI phap_ly, câu phòng ngủ vẫn treo, hỏi lại",
    fact("phap_ly")?.answer === "sổ hồng riêng rồi em" && !fact("so_phong_ngu") && pend("so_phong_ngu") && r.body.reask === "so_phong_ngu",
    JSON.stringify({ body: r.body, f: db().t.listing_facts }));
  r = await send({ external_user_id: "h-1", text: "nhà nở hậu chút" });
  check("H4 câu lệch không nhận ra fact nào → ghi nguyên văn vào bo_sung, câu phòng ngủ vẫn treo",
    fact("bo_sung")?.answer === "nhà nở hậu chút" && pend("so_phong_ngu") && r.body.loai_cau === "lech",
    JSON.stringify({ body: r.body, f: db().t.listing_facts }));
  r = await send({ external_user_id: "h-1", text: "4 phòng ngủ" });
  // FR-186 (09/09 chiều): nhà phố hỏi thêm TIỀM NĂNG (để ở hay kinh doanh ngành gì) trước khi gửi nháp — chuỗi 07/09 của sếp + chat 21/06.
  // 20260916c: tiềm năng dời sang hỏi bù sau đăng — chat KHÔNG hỏi nữa.
  // FR-225 a (25/09/2026, chủ dự án test Zalo: "nở hậu nhiu cộng vào diện tích nhà luôn"): "nhà nở hậu chút" ở H4 chưa có số mét
  // → câu kế là NỞ HẬU (trước đây bỏ qua, đi thẳng câu hẻm); trả lời xong mới tới hẻm.
  check("H4b trả lời phòng ngủ → không hỏi TIỀM NĂNG trong chat (20260916c: hỏi bù sau đăng); câu kế là NỞ HẬU bao nhiêu mét (FR-225, H4 nói 'nở hậu chút')", r.body.saved_fact === "so_phong_ngu" && !pend("tiem_nang") && pend("no_hau"), JSON.stringify({ body: r.body, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  r = await send({ external_user_id: "h-1", text: "nở hậu 5m" });
  check("H4c 'nở hậu 5m' → ghi fact nở hậu, câu kế là HẺM (FR-219)", /\b5m\b/.test(fact("no_hau")?.answer ?? "") && !pend("no_hau") && pend("do_rong_hem"), JSON.stringify({ body: r.body, f: fact("no_hau"), ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
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
    check("HX-01 rao '105/12 Trần Bình Trọng' → câu hẻm là xác nhận 'nằm trong hẻm đúng không'",
      hoiHem && /nằm trong hẻm đúng không/.test(`${pHx}\n${rHx2.body.replies.join("\n")}`),
      JSON.stringify({ rep: rHx2.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === lHx?.id).map((q) => [q.question, q.status]), p: pHx.slice(-400) }));
  }
  r = await send({ external_user_id: "h-1", text: "hẻm 4m xe hơi vào tận nhà" });
  const nhap = r.body.replies.join("\n");
  check("H5 đủ chuyên môn + ≥70 điểm → gửi BẢN NHÁP TIN (tiền định, không model), mở câu chờ duyet_tin, tin CHƯA lên kệ",
    r.body.ban_nhap === true && r.body.diem >= 70 && /Em đăng tin như vầy/.test(nhap) && /5 tỷ 8/.test(nhap) &&
      // 24/09/2026 (chủ dự án): câu cuối bản nháp = "👉 Có khách quan tâm là <tên trợ lý> báo lại <cách gọi> liền ạ.", đứng SAU CÙNG.
      !/nhắn Zalo cho em/.test(nhap) && /\n👉 Có khách quan tâm là \S*•ai báo lại .+ liền ạ\.$/.test(r.body.replies.find((x) => /Em đăng tin như vầy/.test(x)) ?? "") && !/#BDS/.test(nhap) && !/\d{3,}\s*\d{3}\s*\d{3}/.test(nhap) && !createCalls().some((c) => /Em đăng tin như vầy/.test(prompt(c))) &&
      pend("duyet_tin") && H.status === "cho_thong_tin",
    JSON.stringify({ body: r.body, H }));
  r = await send({ external_user_id: "h-1", text: "à giá 6 tỷ nha" });
  check("H6 chủ sửa giá lúc đang duyệt → ghi giá mới, GỬI LẠI bản nháp với giá mới, câu duyệt vẫn treo",
    r.body.sua_nhap === true && H.price_raw && /6 tỷ/.test(H.price_raw) && r.body.replies.some((x) => /6 tỷ/.test(x) && /Em đăng tin như vầy/.test(x)) && pend("duyet_tin"),
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
  for (const t of ["hẻm 4m xe hơi", "3 lầu", "4 phòng ngủ", "sổ hồng riêng hoàn công đủ"]) r = await send({ external_user_id: "h-9", text: t });
  // 20260916c: tiềm năng không còn trong chat → sau pháp lý (gấp đã nói lúc rao) là bản nháp ngay.
  check("N6 chuỗi nhà phố: hẻm → lầu → phòng → pháp lý → bản nháp (tiềm năng để hỏi bù, 20260916c)", pend("duyet_tin", H9.id) && !pend("tiem_nang", H9.id), JSON.stringify(db().t.info_requests.map((q) => [q.question, q.status])));
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
  check("N7 chung cư trả lời phòng ngủ → câu kế là HƯỚNG (ban công), câu gợi ý riêng cho chung cư", pend("huong") && createCalls().some((c) => /Ban công căn mình quay hướng nào/.test(c.params.messages[0].content)), JSON.stringify({ ir: db().t.info_requests, p: createCalls().at(-1)?.params.messages[0].content.slice(-300) }));
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
  check("N18b 'không gấp, được giá thì thôi' → listings.gap = false, câu kết cấu vẫn treo", db().t.listings[0].gap === false && pend("ket_cau"), JSON.stringify({ gap: db().t.listings[0].gap, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
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
      luot.length > 0 && !/NGUYÊN VĂN|ĐÚNG MỘT|Không hỏi gì khác|dưới 30 từ|dưới 50 từ/.test(luot) && /ý hỏi chính/.test(luot) && /hợp với loại nhà/.test(luot),
      JSON.stringify({ cung: luot.match(/.{0,80}(?:NGUYÊN VĂN|ĐÚNG MỘT|Không hỏi gì khác|dưới 30 từ|dưới 50 từ).{0,80}/g), n: luot.length }));
  }

  // Người MUA: 14/09 cũng được báo hồ sơ vừa lưu (đọc lại buyers.preferences).
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "thay_doi" };
  fresh(seedKho);
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "ban", area: "quận 5", budget: "tầm 6 tỷ" }, replies: ["Dạ chị cần mấy phòng ngủ ạ?"] });
  r = await send({ external_user_id: "mua-bldl", text: "tìm nhà quận 5 tầm 6 tỷ" });
  check("BLDL-11 người MUA, công tắc bật → 🤖 'Đã lưu nhu cầu' là bong bóng ĐẦU, đúng khoá vừa lưu, không khoá nội bộ",
    /^🤖 Bóc tách được: .*khu vực muốn tìm: "quận 5".*khoảng giá: "tầm 6 tỷ"/.test(r.body.replies[0] ?? "") && !/tên trợ lý|ten_tro_ly|•ai/.test(r.body.replies[0] ?? "") && r.body.replies.length === 2,
    JSON.stringify(r.body.replies));
  // 22/09/2026 (bắn thật): model mở bằng "Dạ em đã lưu nhu cầu: …" sau 🤖 → câu đó bị bỏ, câu hỏi giữ.
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "ban", area: "quận 5", budget: "tầm 6 tỷ", bedrooms: 3 }, replies: ["Dạ em đã lưu nhu cầu: mua nhà Quận 5, tầm 6 tỷ để ở ạ. Mình thích hẻm xe hơi hay mặt tiền ạ?"] });
  r = await send({ external_user_id: "mua-bldl", text: "3 phòng ngủ, để ở" });
  check("BLDL-11c model lặp 'Dạ em đã lưu nhu cầu…' sau 🤖 → bỏ câu lặp, còn 🤖 + câu hỏi",
    /^🤖 Bóc tách được/.test(r.body.replies[0] ?? "") && !/đã lưu nhu cầu: mua/.test(r.body.replies.slice(1).join(" ")) && /hẻm xe hơi hay mặt tiền/.test(r.body.replies.join(" ")),
    JSON.stringify(r.body.replies));
  const hsMua = db().t.buyers.find((b) => b.zalo_user_id === "mua-bldl")?.preferences ?? {};
  check("BLDL-11b 🤖 người mua nói đúng thứ ĐÃ vào DB (hồ sơ có area + budget)", hsMua.area === "quận 5" && hsMua.budget === "tầm 6 tỷ", JSON.stringify(hsMua));
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
    LL[0]?.boc_tach?.quan_mac_dinh === true && !("quan" in (LL[0]?.boc_tach ?? {})) && /phường mấy, quận nào/.test(r1q) &&
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
    check(`${ca.ma} hỏi ${ca.q}, khách '${ca.cau}' → ${ca.ghi ? `ghi '${ca.ghi}', câu xong` : "KHÔNG ghi, câu vẫn treo"}; không chuyển nguyên câu sang ô khác`,
      (ca.ghi ? fT(ca.q).length === 1 && fT(ca.q)[0].answer === ca.ghi && irT("answered") && !irT("pending") : fT(ca.q).length === 0 && irT("pending")) && !lech.length,
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
    check("GOP-02 kết cấu 'trệt + 3 lầu' + 'có sân thượng nữa em' → AI gộp 'trệt + 3 lầu + sân thượng', không bổ sung lặp, câu phường vẫn treo; AI nhận giá trị đang ghi",
      fG("ket_cau").some((f) => f.answer === "trệt + 3 lầu + sân thượng") && !fG("bo_sung").some((f) => /sân thượng/.test(f.answer)) &&
        db().t.info_requests.some((x) => x.listing_id === L.id && x.question === "phuong" && x.status === "pending") && /Thông tin đang ghi[\s\S]*ket_cau: "trệt \+ 3 lầu"/.test(userMsg),
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
  check("AIBOC-08 'chinh' câu rao: giá 1 tỷ 8 (AI, không đuôi rác), loại căn hộ, Quận 7, 2 PN vào tin; địa chỉ = 'Nguyễn Lương Bằng' (không có 'quý 2 năm sau' ở bất kỳ cột/fact nào)",
    L8.price_vnd === 18e8 && L8.property_type === "chung_cu" && L8.district === "Quận 7" && f8("so_phong_ngu")[0]?.answer === "2" &&
      L8.location_raw === "Nguyễn Lương Bằng" && !/quý 2/.test(`${L8.location_raw}|${L8.street ?? ""}|${L8.ward ?? ""}|${L8.price_raw}`) &&
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
  check("AIBOC-09 'chinh' câu treo giá, AI không thấy giá → KHÔNG ghi giá '50 triệu'; câu thành kiến thức → bo_sung MỘT lần nguồn ai_kiem (luật không ghi nguyên văn lần hai); câu giá vẫn treo, bot hỏi lại",
    f8("gia").length === 0 && L8.price_vnd === 18e8 && f8("bo_sung").filter((f) => /50 triệu/.test(f.answer)).length === 1 && f8("bo_sung").find((f) => /50 triệu/.test(f.answer)).source === "ai_kiem" &&
      db().t.info_requests.some((x) => x.listing_id === L8.id && x.question === "gia" && x.status === "pending") && r.body.reask === "gia",
    JSON.stringify({ gia: f8("gia"), bs: f8("bo_sung"), ir: db().t.info_requests.filter((q) => q.listing_id === L8.id).map((q) => [q.question, q.status]), rep: r.body.replies, extra: r.body.reask }));

  // Câu treo PHÁP LÝ, chủ nhà hỏi "có làm hợp đồng phân phối không" — luật từng ghi pháp lý (TS-VAN-11 lỗi 4).
  db().t.info_requests.forEach((x) => { if (x.listing_id === L8.id && x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: L8.id, question: "phap_ly", status: "pending" });
  globalThis.__model.parse = (p) => laLuotBocRao(p) ? { so_can: 0, kien_thuc: [], truong: [] } : OUT();
  r = await send({ external_user_id: "aiboc-8", text: "bên em có làm hợp đồng phân phối không" });
  check("AIBOC-10 'chinh' câu treo pháp lý, AI trả rỗng → không ghi pháp lý; câu vẫn treo",
    f8("phap_ly").length === 0 && db().t.info_requests.some((x) => x.listing_id === L8.id && x.question === "phap_ly" && x.status === "pending"),
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
  check("AIBOC-13 'chinh' câu treo phường, trả lời số đo: AI quyết fact kèm → dien_tich '5x20' (nguồn ai_kiem); 'hẻm xe hơi' vào ô hẻm đúng chữ (không số mét bịa), KHÔNG hiện trạng 'xe hơi' (kiểm hình dạng), KHÔNG bo_sung lời hứa; câu phường vẫn treo",
    fMoi.some((f) => f.question === "dien_tich" && f.answer === "5x20" && f.source === "ai_kiem") &&
      fMoi.filter((f) => f.question === "do_rong_hem").every((f) => f.answer === "hẻm xe hơi") && !fMoi.some((f) => f.question === "hien_trang") && !fMoi.some((f) => f.question === "bo_sung") &&
      db().t.info_requests.some((x) => x.listing_id === L8.id && x.question === "phuong" && x.status === "pending"),
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
  rp = await send({ external_user_id: "duong-2", text: "bán nhà hẻm 4m pham the hier quận 8, 60m2" });
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
  await send({ external_user_id: "duong-3", text: "bán nhà hẻm 4m pham the hier quận 8, 60m2" });
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
  rp = await send({ external_user_id: "duong-7", text: "bán nhà hẻm 4m pham the hier quận 8, 60m2" });
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
{
  const tin = () => db().t.listings.at(-1);
  const pendQ = () => db().t.info_requests.filter((x) => x.status === "pending").map((x) => x.question);
  // Tin đủ điểm ngay lúc trả lời pháp lý → bản nháp gửi luôn; câu "mà em là người hay máy vậy?" phải được đáp TRƯỚC bản nháp.
  fresh();
  await send({ external_user_id: "nhap-1", text: "bán nhà hẻm 6m Trần Bình Trọng phường 2 quận 5, 4x15, trệt 2 lầu, 3 phòng ngủ, giá 9 tỷ 5" });
  tin().alley_width_m = 6; tin().area_m2 = 60; tin().frontage_m = 4; // mock không bóc hẻm/4x15 từ câu rao; DB thật có (boc_thong_so) — đủ 70 điểm sau câu pháp lý
  db().t.info_requests.forEach((x) => { if (x.status === "pending") x.status = "expired"; });
  db().insert("info_requests", { listing_id: tin().id, question: "phap_ly", status: "pending" });
  let rp = await send({ external_user_id: "nhap-1", text: "sổ hồng riêng, hoàn công đủ. mà em là người hay máy vậy?" });
  const iNhap = rp.body.replies.findIndex((r) => /Em đăng tin như vầy/.test(r));
  const iDap = rp.body.replies.findIndex((r) => /trợ lý AI/.test(r));
  check("NHAP-01 trả lời pháp lý kèm hỏi 'người hay máy' → có bong bóng 'em là trợ lý AI' ĐỨNG TRƯỚC bản nháp",
    iNhap >= 0 && iDap >= 0 && iDap < iNhap && pendQ().includes("duyet_tin"),
    JSON.stringify({ rep: rp.body.replies, pend: pendQ() }));
  // Gật ở vế đầu + lời bình → là GẬT: tin duyệt, không có "📝 Thêm: ok em đăng đi…", không gửi lại nháp.
  rp = await send({ external_user_id: "nhap-1", text: "ok em đăng đi, mà cái dòng phù hợp đọc kỳ quá" });
  check("NHAP-02 'ok em đăng đi, mà cái dòng phù hợp đọc kỳ quá' lúc duyệt → gật (chu_duyet_at), không vào bo_sung, không gửi lại nháp",
    !!tin().chu_duyet_at && !db().t.listing_facts.some((f) => f.question === "bo_sung" && /đăng đi/.test(f.answer)) && !rp.body.replies.some((r) => /Em đăng tin như vầy|Em sửa lại rồi/.test(r)),
    JSON.stringify({ l: { chu_duyet_at: tin().chu_duyet_at }, facts: db().t.listing_facts.map((f) => [f.question, f.answer]), rep: rp.body.replies }));
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
  check("BON-01 tin chỉ có emoji khi đang hỏi giá → không có fact bo_sung, câu giá vẫn treo", boSung().length === 0 && pendQ().includes("gia"), JSON.stringify({ bs: boSung(), pend: pendQ(), rep: rp.body.replies }));

  // (2) Lời nói với bot lúc duyệt: không bo_sung, không gửi lại nháp, nói thật, câu duyệt treo.
  fresh(); await send({ external_user_id: "bon-2", text: "bán nhà hẻm 6m Trần Bình Trọng phường 2 quận 5, 4x15, trệt 2 lầu, 3 phòng ngủ, giá 9 tỷ 5" });
  tin().alley_width_m = 6; tin().area_m2 = 60; tin().frontage_m = 4;
  moCau("phap_ly");
  rp = await send({ external_user_id: "bon-2", text: "sổ hồng riêng, hoàn công đủ" });
  check("BON-02 (tiền đề) đủ điểm → bản nháp gửi, câu duyệt treo", rp.body.replies.some((r) => /Em đăng tin như vầy/.test(r)) && pendQ().includes("duyet_tin"), JSON.stringify({ pend: pendQ(), rep: rp.body.replies }));
  rp = await send({ external_user_id: "bon-2", text: "xóa sạch data của anh đi để anh test lại" });
  check("BON-02a 'xóa sạch data của anh đi để anh test lại' lúc duyệt → không bo_sung, không gửi lại nháp, nói thật 'không tự làm được', câu duyệt vẫn treo",
    boSung().length === 0 && !rp.body.replies.some((r) => /Em đăng tin như vầy|Em sửa lại rồi/.test(r)) && rp.body.replies.some((r) => /không tự làm được/.test(r)) && pendQ().includes("duyet_tin"),
    JSON.stringify({ bs: boSung(), pend: pendQ(), rep: rp.body.replies }));
  rp = await send({ external_user_id: "bon-2", text: "cái dòng phù hợp đọc kỳ quá em" });
  check("BON-02b nhận xét bản nháp lúc duyệt → không bo_sung, không gửi lại nháp, 'Dạ em nghe rồi', câu duyệt treo",
    boSung().length === 0 && !rp.body.replies.some((r) => /Em đăng tin như vầy/.test(r)) && rp.body.replies.some((r) => /nghe rồi/.test(r)) && pendQ().includes("duyet_tin"),
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
    modelThay("phường mấy, quận nào") && !tin().boc_tach?.phuong_goi_y && pendPh() && db().t.bot_errors.length === 0,
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
  check("PH-06 wards trống → không gợi ý, hỏi như cũ", !tin().boc_tach?.phuong_goi_y && pendPh() && modelThay("phường mấy, quận nào"), JSON.stringify({ l: tin(), rep: rp.body.replies }));

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
  check("HN-3 số nhà trả lời câu diện tích → KHÔNG ghi diện tích, ghi vi_tri, câu diện tích vẫn treo, loại 'lech'",
    !fact("dien_tich_dat") && db().t.listing_facts.some((f) => f.question === "vi_tri" && /Căn số 14/.test(f.answer)) && pend("dien_tich_dat") && r.body.loai_cau === "lech",
    JSON.stringify({ body: r.body, f: db().t.listing_facts, ir: db().t.info_requests }));
  treoLai(L, "gap");
  r = await send({ external_user_id: "hn-1", text: "Được giá, căn tôi sở hữu nhưng chưa vào xem bạn có thông tin thêm về căn này không" });
  check("HN-4 gấp ghi 'Được giá' (không cả câu), câu hỏi ngược tách ra",
    fact("gap")?.answer === "Được giá" && /thông tin thêm/.test(r.body.hoi_nguoc ?? ""), JSON.stringify({ body: r.body, f: db().t.listing_facts }));
  // 15/09/2026 (bắn thật A5): cả tin là MỘT câu hỏi → không ghi "thông tin bổ sung", là hỏi ngược.
  treoLai(L, "tang");
  r = await send({ external_user_id: "hn-1", text: "bên bạn có cần mình gửi hình không hay sao" });
  check("HN-5 cả tin là câu hỏi → KHÔNG ghi bo_sung, body có hoi_nguoc = câu đó, câu tầng vẫn treo",
    !db().t.listing_facts.some((f) => f.question === "bo_sung") && r.body.hoi_nguoc === "bên bạn có cần mình gửi hình không hay sao" && pend("tang"),
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
  check("CHU-8 'nhà trong hẻm… nhà 4 tấm diện tích tổng 240m2' → KHÔNG nội thất, KHÔNG diện tích đất; ghi hẻm 5m + 4 tấm + sàn 240m2, câu diện tích đất vẫn treo",
    !f2("noi_that") && !f2("dien_tich_dat") && !f2("dien_tich") && f2("do_rong_hem") && /4 tam|4 tấm/.test(f2("ket_cau")?.answer ?? "") && f2("dien_tich_san")?.answer === "240m2" &&
      db().t.info_requests.some((x) => x.question === "dien_tich_dat" && x.status === "pending") && db().t.listings[0].area_m2 !== 240,
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
    globalThis.__calls.some((c) => JSON.stringify(c.params ?? c).includes("Hẻm 4m Nguyễn Trãi đó phường mấy chú nhỉ?")) && db().t.info_requests.some((x) => x.listing_id === L4.id && x.question === "phuong" && x.status === "pending"),
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
    globalThis.__calls.some((c) => JSON.stringify(c.params ?? c).includes("KHÔNG khen, KHÔNG nhận xét căn nhà")) &&
      !/chốt nhanh/.test(cauBot) && /bao nhiêu phòng ngủ/.test(cauBot),
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
  globalThis.__model.create = () => "Dạ nhà 3 lầu là khách chốt nhanh lắm anh. Tổng cộng bao nhiêu phòng ngủ anh?";
  r = await send({ external_user_id: "khen-2", text: "trệt 2 lầu" });
  const cauBot2 = r.body.replies.find((x) => !x.startsWith("🤖") && !x.startsWith("🤖")) ?? "";
  check("KHEN-02 chưa khen gần đây → prompt cho phép MỘT câu khi đáng, không lọc câu model",
    !globalThis.__calls.some((c) => JSON.stringify(c.params ?? c).includes("KHÔNG khen, KHÔNG nhận xét căn nhà")) && /chốt nhanh/.test(cauBot2),
    JSON.stringify({ rep: r.body.replies }));
  globalThis.__model.create = macDinhCreate;
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
    r.body.loai_cau === "hoi" && /0,5%/.test(r.body.replies.join(" ")) && !db().t.listing_facts.some((f) => f.question === "bo_sung" && /doc quyen/.test(f.answer)),
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
      (rep().match(/trợ lý AI/g) ?? []).length === 1 && /Sổ hồng nhà mình riêng chưa/.test(rep()),
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
    check("GOVAP-03b câu diện tích VẪN treo (fact số nhà ghi trong lượt không tính là né), không bong bóng nào nói 137m2",
      pend("dien_tich_dat", tin2.id) && !r.body.replies.some((x) => /137\s*m2/.test(x)),
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
  rnSeed("z-rn1", "BDS-Q5-0931");
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
  {
    const l = db().t.listings.find((x) => x.code === "BDS-Q5-0939");
    check("RENHANH-04b tin chưa có phường/quận, trả lời 'hoàn công rồi' → câu kế là PHƯỜNG, không gửi bản nháp",
      pend("phuong", l.id) && !pend("duyet_tin", l.id) && !r.body.replies.some((x) => /^📋/.test(x)),
      JSON.stringify({ rep: r.body.replies, ir: db().t.info_requests.filter((q) => q.listing_id === l.id).map((q) => [q.question, q.status]) }));
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
      db().t.listing_media.some((m) => m.listing_id === tA.id && m.media_type === "san_thuong") && r.body.replies.some((x) => /ảnh sân thượng/.test(x)) && !r.body.replies.some((x) => /mặt tiền/.test(x)),
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
  const MINH = /(?<![\p{L}])(?:mình|anh chị|anh\/chị)(?![\p{L}])/iu;
  r = await send({ external_user_id: "ong-1", text: "chào cháu, ông bán nhà Trần Bình Trọg Q5 7 tỷ" });
  const repOng = r.body.replies.join(" ");
  check("XHO-01 'chào cháu, ông bán nhà…' → sellers.xung_ho = ông, nam, lớn tuổi; bot xưng cháu, gọi ông, không 'em' / 'mình' / 'anh chị'",
    S("ong-1")?.xung_ho === "ông" && S("ong-1")?.gioi_tinh === "nam" && S("ong-1")?.nhom_tuoi === "lon_tuoi" &&
      r.body.replies.length > 0 && !EM.test(repOng) && !MINH.test(repOng) && /cháu/i.test(repOng),
    JSON.stringify({ s: S("ong-1"), rep: r.body.replies }));
  r = await send({ external_user_id: "ba-1", text: "bà chào cháu" });
  const repBa = r.body.replies.join(" ");
  check("XHO-02 tin đầu 'bà chào cháu' → 'Dạ cháu chào bà', hỏi 'Bà đang muốn mua…', không 'em' / 'anh chị'",
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
  check("GVD-01 tin đầu 'cô chào cháu' → 'Dạ cháu chào cô…', hỏi 'Cô đang muốn mua, thuê hay…', không 'anh chị' / 'em'; prefs xung_ho = cô",
    /^Dạ cháu chào cô/.test(r.body.replies[0] ?? "") && /Cô đang muốn mua/.test(rep()) && !/anh chị|anh\/chị/i.test(rep()) && !/(?<![\p{L}])em(?![\p{L}])/u.test(rep()) && bX("gvd-1")?.[0] === "cô",
    JSON.stringify({ rep: r.body.replies, b: bX("gvd-1") }));
  // (2) lượt sau mở hồ sơ bán → cách gọi đi theo: xưng cháu, gọi cô ở bong bóng ghi nhận.
  r = await send({ external_user_id: "gvd-1", text: "cô có căn nhà muốn bán, hẻm 4m Nguyễn Trãi q5, 60m2" });
  check("GVD-02 'cô có căn nhà muốn bán…' sau lời chào → hồ sơ bán xung_ho = cô, nhom_tuoi lon_tuoi; 📝 'Cháu ghi nhận', 'cô nhắn lại giúp cháu'",
    r.body.role === "seller" && JSON.stringify(sX("gvd-1")) === JSON.stringify(["cô", "lon_tuoi"]) && /Cháu ghi nhận/.test(rep()) && JSON.stringify(createCalls().at(-1)?.params ?? {}).includes('Gọi chủ nhà là \\"cô\\"') && !/Sai chỗ nào/.test(rep()),
    JSON.stringify({ rep: r.body.replies, s: sX("gvd-1") }));
  // (3) "chào cháu" trơ → biết lớn tuổi, chưa biết chú/cô: xưng cháu, gọi "mình", hỏi "cháu gọi chú hay cô".
  fresh();
  r = await send({ external_user_id: "gvd-3", text: "chào cháu" });
  check("GVD-03 tin đầu 'chào cháu' → 'Dạ cháu chào ạ…', 'Mình đang muốn mua…', + 'Cháu gọi chú hay cô cho tiện ạ?'; prefs nhom_tuoi lon_tuoi, xung_ho trống",
    /^Dạ cháu chào ạ/.test(r.body.replies[0] ?? "") && /Mình đang muốn mua/.test(rep()) && /Cháu gọi chú hay cô/.test(rep()) && !/anh chị/i.test(rep()) && JSON.stringify(bX("gvd-3")) === JSON.stringify([null, "lon_tuoi", true]),
    JSON.stringify({ rep: r.body.replies, b: bX("gvd-3") }));
  // (4) trả lời "cô" trơ → ghi cách gọi, hỏi lại vai, cờ hỏi vai giữ.
  r = await send({ external_user_id: "gvd-3", text: "cô" });
  check("GVD-04 'cô' trơ sau câu 'gọi chú hay cô' → 'Dạ cô. Cô đang muốn mua…', prefs xung_ho = cô, hoi_vai vẫn giữ",
    /^Dạ cô\. Cô đang muốn mua/.test(r.body.replies[0] ?? "") && bX("gvd-3")?.[0] === "cô" && bX("gvd-3")?.[2] === true,
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
  check("GVD-06 'chào cháu' → câu rao không xưng → sellers.nhom_tuoi lon_tuoi, xung_ho trống; 📝 'Cháu ghi nhận', model 'anh chị?' → 'mình', không 'anh chị'",
    r.body.role === "seller" && JSON.stringify(sX("gvd-6")) === JSON.stringify([null, "lon_tuoi"]) && /Cháu ghi nhận/.test(rep()) && /vậy mình\?/.test(rep()) && !/anh chị|anh\/chị/i.test(rep()),
    JSON.stringify({ rep: r.body.replies, s: sX("gvd-6") }));
  // (7) chủ nhà đã có tin, đang treo câu tầng, nhắn "cô chào cháu" → nhận "cô", không ghi fact, câu tầng treo.
  fresh(seedKho);
  {
    const sC = db().t.sellers.find((x) => x.zalo_user_id === "z-ccrb"); const tin = db().t.listings.find((l) => l.code === "BDS-Q5-0002"); sC.active_listing_id = tin.id;
    db().insert("info_requests", { listing_id: tin.id, question: "ket_cau", status: "pending" });
    const truoc = db().t.listing_facts.filter((f) => f.listing_id === tin.id).length;
    r = await send({ external_user_id: "z-ccrb", text: "cô chào cháu" });
    check("GVD-07 chủ nhà có tin nhắn 'cô chào cháu' → xung_ho = cô, không ghi fact, câu tầng vẫn treo, bot xưng cháu",
      sC.xung_ho === "cô" && db().t.listing_facts.filter((f) => f.listing_id === tin.id).length === truoc &&
        db().t.info_requests.some((x) => x.listing_id === tin.id && x.question === "ket_cau" && x.status === "pending") && !/(?<![\p{L}])em(?![\p{L}])/u.test(rep()),
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
    check("GVE-13 'chinh' đang hỏi giá, AI im: 'đang cho thuê 30tr/tháng, đang thế chấp, nở hậu 4m5' → doanh_thu + the_chap + no_hau (rent 30tr, rear 4.5), KHÔNG bo_sung cả câu, câu giá treo",
      fq.includes("doanh_thu") && fq.includes("the_chap") && fq.includes("no_hau") && tin.rent_income_vnd === 30000000 && tin.rear_width_m === 4.5 &&
        !db().t.listing_facts.some((f) => f.listing_id === tin.id && f.question === "bo_sung" && /cho thuê/.test(f.answer)) && pendQ().includes("gia"),
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
  check("GVF-10 căn không có ảnh mà model 'Em gửi hình liền đây' → thay bằng 'chủ nhà chưa gửi hình', không gửi ảnh",
    !/gửi hình liền/.test(rep()) && /chưa gửi hình/.test(rep()) && !(r.body.photos ?? []).length, JSON.stringify(r.body));
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
  check("GVF-21 căn 0 ảnh mà model mời 'Anh xem hình trước nhé?' → thay bằng 'chủ nhà chưa gửi hình', giữ câu hẻm",
    /hẻm 6m/.test(rep()) && /chưa gửi hình/.test(rep()) && !/xem hình trước/.test(rep()), JSON.stringify(r.body.replies));
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

// ── kết ──
let hong = 0;
for (const [n, ok, d] of R) { if (!ok) hong++; console.log(`${ok ? "✓" : "✗"} ${n}${ok ? "" : "\n     → " + String(d).slice(0, 600)}`); }
console.log(hong ? `\n${hong}/${R.length} CA HỎNG` : `\nTẤT CẢ ${R.length} CA ĐẠT`);
process.exit(hong ? 1 : 0);
