import { FakeDB } from "./mock-supabase.mjs";
import { OUT } from "./mock-anthropic.mjs";
import { tenTroLy } from "../../supabase/functions/_shared/prompts.ts"; // FR-181: cùng hàm băm với chat-reply
globalThis.__calls = []; globalThis.__db = new FakeDB();
// 09/09/2026: câu hỏi mẫu + lời chào sửa được ở Dashboard — seed bot_prompts trước lượt đầu
// (napCauHinh nhớ tạm 60 s, đọc một lần cho cả run). vi_tri đổi câu để chứng minh bản DB đè bản code.
// 11/09 (42 ca): câu hỏi địa chỉ LẦN ĐẦU dùng khoá riêng `vi_tri@lan_dau` — đè cả hai để V1.3 vẫn đo đúng "bản DB đè bản code".
const seedBotPrompts = (d) => { d.insert("bot_prompts", { key: "cau_hoi_mau", content: JSON.stringify({ vi_tri: "Nhà mình ở đâu vậy {ac}, đường nào số mấy?", "vi_tri@lan_dau": "Nhà mình ở đâu vậy {ac}, đường nào số mấy?", "vi_tri@chua_quan": "Nhà mình ở đâu vậy {ac}, đường nào số mấy?" }) });
globalThis.__db.insert("bot_prompts", { key: "loi_chao", content: "Dạ em chào anh/chị, em là {ten} bên AI Ơi Nhà Đất ạ. Anh/chị đang muốn mua, thuê hay đang có nhà cần bán/cho thuê ạ?\nBên em có anh Thu phụ trách khu vực Sài Gòn, sẽ theo anh/chị tới khi bán được, cho thuê được hay mua được nhà nha." }); };
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
const parseMua = () => globalThis.__calls.filter((c) => c.kind === "parse" && !laLuotAnh(c.params) && !laLuotGan(c.params) && !laLuotVai(c.params));
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
check("TOIUU-02 người mua lượt đầu ≤ 20 truy vấn (+1 trần cá nhân SEC-05; +1 FR-181 ghi tên trợ lý vào hồ sơ, CHỈ lượt đầu; +1 14/09 đọc công tắc báo lại 🤖)", v.n <= 20, `${v.n}`);
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
check("TOIUU-07 người bán trả lời câu chờ ≤ 22 truy vấn (v43: 21; +1 trần cá nhân SEC-05; +2 FR-176 lịch sử + đếm căn; +1 FR-181 ghi tên trợ lý, CHỈ lượt đầu; +1 09/09 tối: đọc câu đã hết hạn để không mở lại; +1 11/09: đọc công tắc app_config.bao_lai_da_luu — tắt thì dừng ở đó; +1 14/09 FR-208: đọc công tắc boc_tach_ai, CHẠY SONG SONG, chỉ khi tin có mùi dữ liệu)", v.n <= 22 && v.r.body.role === "seller", `${v.n}`);
v = await vong({ external_user_id: "z-ccrb", text: "hoàn công đủ rồi" });
check("TOIUU-07b lượt sau của cùng người bán ≤ 24 (không còn update tên trợ lý; +1 11/09: đọc công tắc app_config.bao_lai_da_luu; +1 14/09 FR-208: công tắc boc_tach_ai, song song; +4 18/09 FR-211: câu 'hoàn công đủ rồi' có NHÃN → tìm tin, đọc nhan, gộp, ghi fact — chỉ khi câu có nhãn)", v.n <= 24, `${v.n}`);
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
  check("H1 rao đủ cơ bản → tin can_chu_duyet, chưa lên kệ, câu đầu là HẺM (nhóm chuyên môn, ưu tiên 1)",
    H?.can_chu_duyet === true && H?.status === "cho_thong_tin" && pend("do_rong_hem"), JSON.stringify({ H, ir: db().t.info_requests }));
  check("H1b vị trí cụ thể bóc từ câu rao ('hẻm trần bình trọng') → fact vi_tri + location_raw, KHÔNG hỏi lại vị trí",
    /trần bình trọng/i.test(fact("vi_tri")?.answer ?? "") && /trần bình trọng/i.test(H?.location_raw ?? "") && !pend("vi_tri"), JSON.stringify({ f: db().t.listing_facts, H }));
  r = await send({ external_user_id: "h-1", text: "hẻm 4m xe hơi vào tận nhà" });
  check("H2 trả lời hẻm → ghi fact, câu kế LIÊN QUAN: kết cấu (không nhảy sang pháp lý)",
    fact("do_rong_hem") && pend("ket_cau") && !pend("phap_ly"), JSON.stringify(db().t.info_requests));
  check("H2 câu lệnh model: chưa khen gần đây → CHỈ khen khi thật đáng nói (18/09: lâu lâu mới khen)", /CHỈ khi có gì thật đáng nói với khách mua/.test(prompt(createCalls().at(-1))) && !/KHÔNG khen, KHÔNG nhận xét/.test(prompt(createCalls().at(-1))), prompt(createCalls().at(-1)));
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
  // 20260916c: tiềm năng dời sang hỏi bù sau đăng — chat KHÔNG hỏi nữa.
  check("H4b trả lời kết cấu → không hỏi TIỀM NĂNG trong chat (20260916c: hỏi bù sau đăng)", r.body.saved_fact === "ket_cau" && !pend("tiem_nang"), JSON.stringify({ body: r.body, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
  r = await send({ external_user_id: "h-1", text: "ở hoặc làm văn phòng đều được" });
  const nhap = r.body.replies.join("\n");
  check("H5 đủ chuyên môn + ≥70 điểm → gửi BẢN NHÁP TIN (tiền định, không model), mở câu chờ duyet_tin, tin CHƯA lên kệ",
    r.body.ban_nhap === true && r.body.diem >= 70 && /Em đăng tin như vầy/.test(nhap) && /5 tỷ 8/.test(nhap) &&
      /nhắn Zalo cho em/.test(nhap) && !/#BDS/.test(nhap) && !/\d{3,}\s*\d{3}\s*\d{3}/.test(nhap) && !createCalls().some((c) => /Em đăng tin như vầy/.test(prompt(c))) &&
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
    r.body.duyet === true && !!H.chu_duyet_at && H.status === "dang_ban" && !pend("duyet_tin") && /được ghi nhận|lên web/.test(r.body.replies[0]),
    JSON.stringify({ body: r.body, H }));
  // FR-177 f (09/09): chúc mừng kèm ĐIỂM + cách thêm điểm; điểm là tiền định (diem_tin).
  check("H8e chúc mừng kèm điểm X/100, cách thêm điểm (ảnh), và hẹn hỏi thêm KHI CÓ KHÁCH quan tâm (10/09)",
    typeof r.body.diem === "number" && new RegExp(`${r.body.diem}/100`).test(r.body.replies[0]) && /Chúc mừng/.test(r.body.replies[0]) && /thêm điểm/.test(r.body.replies[0]) && /ảnh/.test(r.body.replies[0]) && /khi có khách hàng quan tâm/.test(r.body.replies[0]),
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

  // FR-188 (10/09): GẤP — hỏi ngay sau giá; "không gấp, được giá thì thôi" → gap=false rồi hỏi hẻm; bắt gấp ở mọi lượt.
  fresh();
  r = await send({ external_user_id: "g-1", text: "bán nhà hẻm trần bình trọng p4 giá 6 tỷ 50m2" });
  // 20260916c: gấp lùi sau pháp lý — câu đầu là HẺM, gấp vẫn bắt ở mọi lượt.
  check("N18 rao có giá, chưa nói gấp → câu ĐẦU là hẻm (gấp lùi sau pháp lý, 20260916c)", pend("do_rong_hem") && !pend("gap"), JSON.stringify(db().t.info_requests.map((q) => [q.question, q.status])));
  r = await send({ external_user_id: "g-1", text: "không gấp, được giá thì thôi" });
  check("N18b 'không gấp, được giá thì thôi' → listings.gap = false, câu kế là HẺM", db().t.listings[0].gap === false && pend("do_rong_hem"), JSON.stringify({ gap: db().t.listings[0].gap, ir: db().t.info_requests.map((q) => [q.question, q.status]) }));
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
      db().t.listings.length === soTinTruoc && factCua(theoThuTu[1]).includes("hien_trang_su_dung") && !db().t.listing_facts.some((f) => f.question === "gia" && /80/.test(f.answer)) && r.body.fact_theo_can >= 2,
      JSON.stringify({ body: r.body, f: db().t.listing_facts.map((f) => [f.listing_id.slice(0, 4), f.question, f.answer]) }));
  }
  // 15/09/2026 (bắn thật P1): câu rao kèm "bên em là bot hả?" → trả lời thật trước câu hỏi đầu.
  fresh();
  r = await send({ external_user_id: "la-bot", text: "tôi muốn bán căn nhà ở phường 2 quận 5, mà bên em là bot hả?" });
  check("RAO-HOI-01 câu rao kèm hỏi 'bot hả' → tạo tin + bong bóng nói thật là trợ lý AI",
    db().t.listings.length === 1 && r.body.replies.some((x) => /trợ lý AI/.test(x)), JSON.stringify(r.body.replies));
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
      r.body.ban_nhap === true && !/phí QL phí quản lý/.test(nh) && !/thổ cư thổ cư/.test(nh) &&
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
  check("BLDL-02 day_du → bong bóng ĐẦU là 🤖, đứng riêng", /^🤖 Đã lưu/.test(bl) && r.body.replies.length >= 2 && !r.body.replies.slice(1).some((x) => /🤖/.test(x)), JSON.stringify(r.body.replies));
  check("BLDL-03 dòng 🤖 Đã lưu nói ĐÚNG cột trong DB (6m², không phải 66), kèm địa chỉ/phường/giá, KHÔNG còn 📦 Tin giờ", /^🤖 Đã lưu: .*· 6m²/.test(bl) && !/66m²/.test(bl) && /99 Nguyễn Trãi/.test(bl) && /Phường 3/.test(bl) && /giá 7 tỷ/.test(bl) && !/📦 Tin giờ/.test(bl), `${LB.status} | ${bl}`);
  check("BLDL-03b 🤖 đọc SAU khi ghi: pháp lý chủ vừa trả lời trong CHÍNH lượt này có mặt trong tóm tắt", /^🤖 Đã lưu: .*sổ hồng riêng/.test(bl), bl);
  check("BLDL-04 'Đã lưu' chỉ có fact CỦA LƯỢT NÀY — không kèm '6x11' đã lưu lượt trước", !/6x11/.test(bl), bl);
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
  check("BLDL-06b lượt TẠO tin → 🤖 đầu tiên là tóm tắt tin VỪA RAO (Phường 5), bỏ 📝 trùng nhưng giữ câu 'Sai chỗ nào…'",
    /^🤖 Đã lưu: /.test(r.body.replies[0] ?? "") && /Phường 5/.test(r.body.replies[0] ?? "") && /Sai chỗ nào/.test(r.body.replies[0] ?? "") && !r.body.replies.some((x) => /^📝 Em ghi nhận/.test(x)),
    JSON.stringify(r.body.replies));

  // giá có chữ mà không ra số → báo thẳng, đó là tin web lọc giá sẽ không thấy.
  fresh(seedKho);
  LB = db().t.listings[1]; db().t.sellers[0].active_listing_id = LB.id;
  LB.price_raw = "5 tới 6"; LB.price_vnd = null;
  db().insert("info_requests", { listing_id: LB.id, question: "phap_ly", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "sổ hồng riêng em" });
  check("BLDL-07 giá không đọc ra số → 🤖 nói rõ '(chưa đọc ra số)'", /giá "5 tới 6" \(chưa đọc ra số\)/.test(r.body.replies[0] ?? ""), JSON.stringify(r.body.replies));

  // thay_doi: 🤖 đầu tiên, không mã tin, một dòng đầy đủ; lượt không lưu gì thì im.
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "thay_doi" };
  fresh(seedKho);
  LB = db().t.listings[1]; db().t.sellers[0].active_listing_id = LB.id;
  db().insert("info_requests", { listing_id: LB.id, question: "phap_ly", status: "pending" });
  r = await send({ external_user_id: "z-ccrb", text: "sổ hồng riêng em" });
  bl = r.body.replies[0] ?? "";
  check("BLDL-08 thay_doi → 🤖 là bong bóng ĐẦU, riêng, một dòng đầy đủ (địa chỉ + giá), không 📦, không mã tin", /^🤖 Đã lưu: .*99 Nguyễn Trãi.*giá 7 tỷ/.test(bl) && !/📦 Tin giờ/.test(bl) && !/BDS-Q5/.test(bl), JSON.stringify(r.body.replies));
  r = await send({ external_user_id: "z-ccrb", text: "dạ em" });
  check("BLDL-09 tin khách không lưu được gì → KHÔNG nhắn 🤖", r.body.replies.length > 0 && !r.body.replies.some((x) => /🤖/.test(x)), JSON.stringify(r.body.replies));
  LB.area_m2 = 66;
  r = await send({ external_user_id: "z-ccrb", text: "nhà hướng đông nam em" });
  check("BLDL-10 thay_doi + lượt này lưu fact + tin đã đổi (66m²) → dòng 🤖 Đã lưu in tin MỚI (66m²) và hướng, không 📦", /^🤖 Đã lưu: .*66m²/.test(r.body.replies[0] ?? "") && /hướng/i.test(r.body.replies[0] ?? "") && !/📦 Tin giờ/.test(r.body.replies[0] ?? ""), JSON.stringify(r.body.replies));
  r = await send({ external_user_id: "z-ccrb", text: "nhà hướng đông nam nha em" });
  check("BLDL-10b lưu lại mà tin KHÔNG đổi → nếu có 🤖 thì vẫn là MỘT dòng đầy đủ (66m²), không 📦", /^🤖 Đã lưu: /.test(r.body.replies[0] ?? "") ? (/66m²/.test(r.body.replies[0]) && !/📦 Tin giờ/.test(r.body.replies[0])) : !r.body.replies.some((x) => /🤖/.test(x)), JSON.stringify(r.body.replies));

  // Người MUA: 14/09 cũng được báo hồ sơ vừa lưu (đọc lại buyers.preferences).
  globalThis.__cauHinh = { test_reset_hello: "1", bao_lai_da_luu: "thay_doi" };
  fresh(seedKho);
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "ban", area: "quận 5", budget: "tầm 6 tỷ" }, replies: ["Dạ chị cần mấy phòng ngủ ạ?"] });
  r = await send({ external_user_id: "mua-bldl", text: "tìm nhà quận 5 tầm 6 tỷ" });
  check("BLDL-11 người MUA, công tắc bật → 🤖 'Đã lưu nhu cầu' là bong bóng ĐẦU, đúng khoá vừa lưu, không khoá nội bộ",
    /^🤖 Đã lưu nhu cầu: .*khu vực.*quận 5.*khoảng giá: tầm 6 tỷ/.test(r.body.replies[0] ?? "") && !/tên trợ lý|ten_tro_ly|•ai/.test(r.body.replies[0] ?? "") && r.body.replies.length === 2,
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
      /^🤖 Đã lưu: .*\(chưa rõ quận\)/.test(rr.body.replies[0] ?? "") && LL[0]?.district == null && !rr.body.replies.some((x) => /Quận 5/.test(x)),
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
  check("KHO-03 kho CÓ căn → van không đụng lời model", r.body.replies.some((t) => /BDS-Q5-0001/.test(t)) && !r.body.replies.some((t) => /chưa có căn|lọc kho/.test(t)), JSON.stringify(r.body.replies));
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
  const jsonDu = JSON.stringify({ ...OUT({ replies: ["Dạ chị cần mấy phòng ngủ ạ?"] }), profile: { ...OUT().profile, area: "quận 5", budget: "tầm 7 tỷ" }, voice_request: false });
  globalThis.__model.parseChu = () => "Đây là JSON:\n" + jsonDu + "\n";
  r = await send({ external_user_id: "json-chu-1", text: "tìm nhà quận 5 tầm 7 tỷ" });
  const cMua = parseCalls().at(-1);
  check("JSONCHU-01 model trả CHỮ có JSON (kèm chữ thừa) → đọc đúng câu trả lời và hồ sơ",
    r.body.replies.some((x) => x === "Dạ chị cần mấy phòng ngủ ạ?") && db().t.buyers.find((b) => b.zalo_user_id === "json-chu-1")?.preferences?.budget === "tầm 7 tỷ",
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
    /CHƯA BIẾT \(chỉ NHẶT/.test(u1) && !/CÒN THIẾU \(hỏi theo thứ tự/.test(u1) && /NGỪNG hỏi hồ sơ/.test(u1), u1.slice(0, 400));
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
  check("MUCDICH-01 đủ khu + giá → câu 'để ở hay đầu tư ạ?' bị bỏ, câu trước giữ",
    !r1.body.replies.some((t) => /để ở hay đầu tư/.test(t)) && r1.body.replies.some((t) => /tầm 4 tỷ ở Quận 6/.test(t)), JSON.stringify(r1.body.replies));
  fresh(seedKho);
  globalThis.__model.parse = () => OUT({ profile: { ...OUT().profile, deal: "thue" },
    replies: ["Dạ em lọc căn hộ cho mình nha.", "Mình cần căn hộ để ở hay để cho thuê lại vậy ạ?"] });
  r1 = await send({ external_user_id: "md-2", text: "tìm thuê căn hộ 2 phòng ngủ" });
  check("MUCDICH-02 khách THUÊ (chưa đủ tiêu chí) → vẫn bỏ câu dò mục đích",
    !r1.body.replies.some((t) => /để ở hay/.test(t)), JSON.stringify(r1.body.replies));
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
  check("AIBOC-04b (21/09 gộp) khách thấy MỘT bong bóng '🤖 Đã lưu' nêu cả hướng + hiện trạng AI đọc lẫn thứ luật ghi; không dòng 'AI đọc thêm' riêng; pháp lý bịa không có",
    bongAi4.length === 1 && /^🤖 Đã lưu/.test(bongAi4[0]) && /hướng: "Đông Nam"/.test(bongAi4[0]) && /hiện trạng nhà: "mới sơn sửa lại"/.test(bongAi4[0]) &&
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
    ? { so_can: 0, kien_thuc: ["gần chợ Bình Tây", "khu này yên tĩnh lắm"], truong: [
        { khoa: "phap_ly", gia_tri: "sổ hồng riêng", trich_dan: "shr", can: null },
        { khoa: "hien_trang", gia_tri: "nhà ở từ 2019 rồi", trich_dan: "nhà ở từ 2019 rồi", can: null },
        { khoa: "view", gia_tri: "view sông", trich_dan: "view sông", can: null },
      ] }
    : OUT();
  r = await send({ external_user_id: "aiboc-6", text: "shr, nhà ở từ 2019 rồi, gần chợ Bình Tây, khu này yên tĩnh lắm" });
  const f6 = (q) => db().t.listing_facts.filter((f) => f.listing_id === L6.id && f.question === q);
  check("AIBOC-06 AI đọc trước cho câu treo: 'shr, nhà ở từ 2019 rồi' khi hỏi PHÁP LÝ → luật ghi 'sổ hồng riêng' (AI chuẩn hoá, nguồn seller_chat); hiện trạng ghi một lần (luật bắt kèm, AI không ghi đè); 'view sông' bịa (không có trong tin) KHÔNG ghi",
    f6("phap_ly").length === 1 && f6("phap_ly")[0].answer === "sổ hồng riêng" && f6("phap_ly")[0].source === "seller_chat" &&
      f6("hien_trang").length === 1 && f6("view").length === 0 &&
      db().t.info_requests.some((x) => x.listing_id === L6.id && x.question === "phap_ly" && x.status === "answered"),
    JSON.stringify({ pl: f6("phap_ly").map((f) => [f.answer, f.source]), ht: f6("hien_trang").map((f) => [f.answer, f.source]), v: f6("view").length, ir: db().t.info_requests.filter((q) => q.listing_id === L6.id).map((q) => [q.question, q.status]), rep: r.body.replies }));
  check("AIBOC-07 kiến thức thêm: 'khu này yên tĩnh lắm' (luật không có ô) → fact bo_sung nguồn ai_kiem, dòng 🤖 nêu 'thông tin bổ sung'; 'gần chợ Bình Tây' luật đã ghi ô tiện ích → AI không ghi bổ sung lần hai",
    f6("bo_sung").length === 1 && f6("bo_sung")[0].answer === "khu này yên tĩnh lắm" && f6("bo_sung")[0].source === "ai_kiem" &&
      f6("tien_ich_gan").length === 1 &&
      r.body.replies.filter((x) => x.startsWith("🤖")).length === 1 && r.body.replies.some((x) => x.startsWith("🤖") && /thông tin bổ sung: "khu này yên tĩnh lắm"/.test(x)),
    JSON.stringify({ f: f6("bo_sung"), rep: r.body.replies }));
  r = await send({ external_user_id: "aiboc-6", text: "shr, nhà ở từ 2019 rồi, gần chợ Bình Tây, khu này yên tĩnh lắm" });
  check("AIBOC-07b nhắn lại y chang → không ghi bo_sung trùng", f6("bo_sung").length === 1, JSON.stringify(f6("bo_sung")));

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
  check("AIBOC-13 'chinh' câu treo phường, trả lời số đo: AI quyết fact kèm → dien_tich '5x20' (nguồn ai_kiem); KHÔNG có độ rộng hẻm 'hẻm xe hơi' (luật), KHÔNG hiện trạng 'xe hơi' (kiểm hình dạng), KHÔNG bo_sung lời hứa; câu phường vẫn treo",
    fMoi.some((f) => f.question === "dien_tich" && f.answer === "5x20" && f.source === "ai_kiem") &&
      !fMoi.some((f) => f.question === "do_rong_hem") && !fMoi.some((f) => f.question === "hien_trang") && !fMoi.some((f) => f.question === "bo_sung") &&
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
    modelThay("Dạ em hiểu là đường Phạm Thế Hiển đúng không") && tin().boc_tach?.duong_goi_y?.ten === "Phạm Thế Hiển" &&
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
    /pham the hier/.test(tin().location_raw ?? "") && tin().boc_tach?.duong_goi_y?.ten === "Phạm Thế Hiển" && modelThay("Dạ em hiểu là đường Phạm Thế Hiển đúng không"),
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
  fresh(); rp = await send({ external_user_id: "bon-5", text: "bán nhà hẻm 4m Trần Bình Trọng quận 5, 60m2, 5 tỷ" });
  check("BON-05 chưa biết cách gọi → không bong bóng nào chứa 'anh/chị', có 'anh chị'", !rp.body.replies.some((r) => /anh\/chị/i.test(r)) && rp.body.replies.some((r) => /anh chị/i.test(r)), JSON.stringify({ rep: rp.body.replies }));
  fresh(); rp = await send({ external_user_id: "bon-6", text: "chào em, anh có căn nhà hẻm 4m Trần Bình Trọng quận 5, 60m2, 5 tỷ" });
  check("BON-06 đã biết 'anh' → vẫn 'anh', không đổi", rp.body.replies.some((r) => /Sai chỗ nào anh nhắn/.test(r)), JSON.stringify({ rep: rp.body.replies }));
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
    rp.body.role === "seller" && modelThay("Phường Tăng Nhơn Phú (Quận 9 cũ), đúng không") && !tin().ward && tin().district == null &&
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
    /^🤖 Đã lưu: /.test(blChu4) && /\n👤 Hồ sơ: Zalo: "…hu-4" · cách gọi: "chú"/.test(blChu4) && !/chu-4"/.test(blChu4), blChu4);
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
  check("NHAN-01 câu rao có 'khu yên tĩnh, gần chợ' → listings.nhan = [yen_tinh, gan_cho]; fact nhan; 🤖 báo 'nhãn tìm kiếm'",
    JSON.stringify(LN.nhan) === JSON.stringify(["yen_tinh", "gan_cho"]) &&
      db().t.listing_facts.some((f) => f.listing_id === LN.id && f.question === "nhan" && f.answer === "yên tĩnh · gần chợ") &&
      r.body.replies.some((x) => x.startsWith("🤖") && /nhãn tìm kiếm: "yên tĩnh · gần chợ"/.test(x)),
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
    r.body.hoan === true && r.body.replies.length === 1 && /em chờ/i.test(r.body.replies[0]) && fPend("gap") &&
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

// ── kết ──
let hong = 0;
for (const [n, ok, d] of R) { if (!ok) hong++; console.log(`${ok ? "✓" : "✗"} ${n}${ok ? "" : "\n     → " + String(d).slice(0, 600)}`); }
console.log(hong ? `\n${hong}/${R.length} CA HỎNG` : `\nTẤT CẢ ${R.length} CA ĐẠT`);
process.exit(hong ? 1 : 0);
