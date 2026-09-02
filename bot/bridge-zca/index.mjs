// Bridge zca-js — CHẠY TRÊN MÁY LOCAL, KHÔNG deploy đâu cả.
// Quét QR bằng ACC ZALO CLONE (đừng dùng acc chính — zca-js là API không chính
// thức, Zalo có thể khoá acc). Tin nhắn đến → gọi edge function chat-reply
// (bộ não) → gửi câu trả lời (kèm hình nếu có) lại. Cài & chạy:
//   cd bot/bridge-zca && npm init -y && npm i zca-js && node index.mjs
// Lần đầu hiện QR trong terminal → mở Zalo app trên điện thoại (đăng nhập acc
// clone) → Quét QR. Cookie lưu ./zalo-session.json, lần sau khỏi quét lại.
import { Zalo, ThreadType } from "zca-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Nạp bot/bridge-zca/.env — KHÔNG cần thư viện nào.
// Vì sao cần: BRIDGE_SECRET (FR-151) phải có trong env, mà `set BRIDGE_SECRET=…`
// trong cmd chỉ sống đúng cửa sổ đó — đóng cửa sổ hay reboot là mất, chạy
// `node index.mjs` từ cửa sổ mới là dính ngay "bridge secret sai" (401/403).
// Đọc theo đường dẫn của CHÍNH FILE NÀY, không theo thư mục đang đứng: chạy
// `node bot/bridge-zca/index.mjs` từ gốc repo thì cwd khác, mà .env vẫn phải tìm ra.
// Biến đã có sẵn trong env thật thì KHÔNG đè — máy chủ/CI đặt gì thì thắng.
// `import.meta.dirname` chỉ có từ Node 20.11. Đường lùi phải đi qua
// fileURLToPath: trên Windows, `new URL(...).pathname` trả "/C:/qc/..." — cái
// dấu / thừa đằng trước làm fs không mở được file.
const HERE = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(HERE, ".env");
if (fs.existsSync(ENV_FILE)) {
  const tuFile = {};
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || line.trim().startsWith("#")) continue;
    const val = m[2].trim()
      // Bỏ nháy bao ngoài — dán từ Dashboard hay dính thêm nháy hoặc dấu cách
      // vô hình, mà secret lệch một ký tự là 401.
      .replace(/^(['"])(.*)\1$/, "$2")
      // Bỏ ngoặc nhọn bao ngoài: hướng dẫn viết "BRIDGE_SECRET=<dán giá trị>"
      // nên người ta gõ luôn cả cặp <>. Base64 không bao giờ có < hay > nên
      // cắt là an toàn. (Lỗi này xảy ra thật 27/08.)
      .replace(/^<(.*)>$/, "$1");
    // DÒNG SAU ĐÈ DÒNG TRƯỚC, và giá trị RỖNG thì bỏ qua hẳn. Bản đầu lấy
    // "dòng đầu thắng" nên `.env` chép từ `.env.example` — vốn có sẵn một dòng
    // `BRIDGE_SECRET=` trống ở trên — khoá luôn biến thành chuỗi rỗng, dòng
    // thật gõ bên dưới không bao giờ tới lượt. Im lặng và rất khó đoán.
    if (val) tuFile[m[1]] = val;
  }
  // env thật của máy vẫn thắng .env — máy chủ/CI đặt gì thì giữ nguyên.
  for (const [k, v] of Object.entries(tuFile)) {
    if (!(k in process.env)) process.env[k] = v;
  }
  console.log(`Đã nạp ${ENV_FILE} (${Object.keys(tuFile).join(", ") || "không có biến nào"})`);
}

const CHAT_REPLY_URL =
  "https://tbcdpupiarkuxtntmosl.supabase.co/functions/v1/chat-reply";
const ANON_KEY =
  "sb_publishable_zmJBmEgFPn3bBKx_1ve6Pg_dXdo4haX"; // key công khai, chỉ gọi được function

// Nói thẳng lúc khởi động thay vì để nó chết lặng ở lượt gọi đầu. Cổng
// BRIDGE_SECRET bật ở phía server rồi mà bridge không có secret thì mọi request
// đều 401/403 — không có tin nào tới khách, mà terminal chỉ hiện một dòng
// "bridge secret sai" giữa đống log khác.
if (!process.env.BRIDGE_SECRET) {
  console.log(
    "⚠ CHƯA CÓ BRIDGE_SECRET. Cổng FR-151 đang bật trên Supabase nên bridge sẽ\n" +
    "  bị chặn 401/403 ở MỌI lượt gọi. Cách sửa (làm một lần):\n" +
    `  1. Supabase Dashboard → Project Settings → Vault → copy giá trị BRIDGE_SECRET\n` +
    `  2. Trong file ${ENV_FILE}, điền vào dòng BRIDGE_SECRET= giá trị vừa copy.\n` +
    "     Dán TRẦN, không ngoặc nhọn, không nháy. Ví dụ đúng:\n" +
    "       BRIDGE_SECRET=aB3xY9...=\n" +
    "  3. Chạy lại `node index.mjs`. (File .env đã nằm trong .gitignore.)",
  );
}

// Bám theo thư mục của script, không theo cwd: chạy từ gốc repo cũng phải tìm
// ra đúng session cũ, đừng bắt quét QR lại vô cớ.
const SESSION_FILE = path.join(HERE, "zalo-session.json");

const zalo = new Zalo();
let api;
if (fs.existsSync(SESSION_FILE)) {
  try {
    api = await zalo.login(JSON.parse(fs.readFileSync(SESSION_FILE, "utf8")));
    console.log("Đăng nhập lại bằng session đã lưu.");
  } catch {
    console.log("Session cũ hết hạn — quét QR lại.");
  }
}
if (!api) {
  api = await zalo.loginQR(); // in QR ra terminal
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(api.getContext?.() ?? {}));
  } catch { /* zca-js đổi API thì bỏ qua, chỉ mất tính năng nhớ session */ }
}
console.log("Bridge sẵn sàng — nhắn thử vào acc clone từ một acc khác.");

const brainHeaders = {
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
  // Đặt BRIDGE_SECRET ở CẢ hai nơi (Vault của Supabase + env máy chạy bridge)
  // là chat-reply chỉ còn nhận request từ bridge. Chưa đặt thì vẫn chạy như cũ.
  ...(process.env.BRIDGE_SECRET ? { "x-bridge-secret": process.env.BRIDGE_SECRET } : {}),
};

// FR-141: phân biệt tin bot vừa gửi vs NGƯỜI THẬT gõ tay trên acc clone —
// nhớ ~80 tin bot gửi gần nhất (10 phút); tin đi ra không nằm trong đó = người thật.
const botSent = [];
const rememberSent = (t) => {
  botSent.push({ t, at: Date.now() });
  if (botSent.length > 80) botSent.shift();
};
const wasBotSent = (t) =>
  botSent.some((b) => b.t === t && Date.now() - b.at < 10 * 60e3);

// undici chỉ ném "fetch failed"; mã lỗi thật (ENOTFOUND/ECONNRESET/UND_ERR_*,
// lỗi chứng thư TLS…) nằm ở e.cause — không in ra thì không cách nào chẩn đoán.
const errDetail = (e) => {
  const c = e?.cause;
  const code = c?.code ?? c?.errno ?? c?.name;
  return [e?.message ?? String(e), code, c?.message !== e?.message ? c?.message : null]
    .filter(Boolean).join(" · ");
};

const FEED_URL =
  "https://tbcdpupiarkuxtntmosl.supabase.co/functions/v1/escalation-feed";
const feedHeaders = brainHeaders; // brainHeaders đã kèm x-bridge-secret

// FR-152: đẩy lỗi lên sổ chung `bot_errors` (xem ở /admin). console.error chỉ
// sống trong cửa sổ terminal đang mở — đóng cửa sổ là mất, mà bridge thì chạy
// nền hàng tuần. Dùng luôn cổng escalation-feed đã có secret, khỏi mở cửa mới.
// KHÔNG BAO GIỜ ném: mọi nơi gọi hàm này đều đang trong catch.
async function ghiLoi(source, detail) {
  console.error(`${source}:`, detail);
  try {
    await fetch(FEED_URL, {
      method: "POST",
      headers: feedHeaders,
      body: JSON.stringify({ action: "log", source, detail: String(detail) }),
    });
  } catch { /* mất mạng thì thôi, đừng làm hỏng thêm luồng đang lỗi */ }
}

// Mạng nhà/VPS rớt vài giây là chuyện thường: hết giờ thì thử lại 1 lần trước
// khi kêu lỗi, để một cú nghẽn không làm mất luôn lượt trả lời khách.
//
// HẠN CHỜ PHẢI DÀI HƠN VIỆC PHÍA SERVER, nếu không là tự đá vào chân mình.
// Bản trước để cứng 20 giây cho MỌI lượt gọi. Nhưng lượt gọi bộ não có kèm
// gọi model với prompt to (giọng + luật + từ điển lóng + ví dụ + kho tin), chậm
// hơn 20 giây là chuyện thường. Khi đó: client cắt ngang → thử lại → lượt thử
// lại đụng đúng lượt đầu vẫn đang chạy nên nhận `in_flight` → rơi vào vòng chờ
// 3 lần × 5 giây. Cộng dồn xấu nhất là KHOẢNG BA PHÚT khách ngồi nhìn màn hình
// trống, trong khi server đã trả lời xong từ giây thứ 25.
// Nay tách hạn chờ theo loại việc: lượt gọi bộ não được 90 giây (đủ cho model),
// còn lượt hỏi-lại và lượt ghi sổ chỉ 10 giây vì chúng trả về ngay.
async function postJson(url, headers, payload, hanCho = 20_000) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST", headers, body: JSON.stringify(payload),
        signal: AbortSignal.timeout(hanCho),
      });
      return await res.json();
    } catch (e) {
      last = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw last;
}

const HAN_CHO_BO_NAO = 90_000; // lượt gọi có kèm model
const HAN_CHO_NGAN = 10_000;   // hỏi lại / ghi sổ — trả về ngay

// Gửi một tin (kèm ảnh nếu bộ não trả về) — dùng chung cho tin nhắn và reaction
async function handleIncoming(threadId, text, imageUrl, msgId) {
  console.log(`← [${threadId}] ${text || "[ảnh]"}`);
  const payload = {
    external_user_id: String(threadId),
    text: typeof text === "string" ? text : "",
    image_url: imageUrl,
    msg_id: msgId,
    channel: "zalo_personal_test",
  };
  let out = await postJson(CHAT_REPLY_URL, brainHeaders, payload, HAN_CHO_BO_NAO);
  // FR-162: in_flight = một bản sao của CÙNG tin này đang được xử lý — thường
  // là chính lượt đầu của postJson bị timeout 20s nên lượt thử lại chạm mặt nó.
  // Đừng bỏ đi tay không: chờ rồi hỏi lại (tối đa 3 lần), lượt kia xong là
  // server PHÁT LẠI câu trả lời đã lưu trong sổ — không gọi model lần hai.
  for (let i = 0; i < 3 && out?.in_flight; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    out = await postJson(CHAT_REPLY_URL, brainHeaders, payload, HAN_CHO_NGAN);
  }
  const { reply, replies, photos, error, replayed, already_sent } = out ?? {};
  if (error) return await ghiLoi("chat-reply", error);

  // FR-162: cùng `msg_id` giao lần hai VÀ lần trước đã gửi đủ → im.
  // `zalo-webhook` kiểm đúng cặp cờ này từ lâu, bridge thì không — nên riêng
  // kênh acc clone, một tin giao trùng là khách nhận lại y nguyên loạt bong
  // bóng. Chạm được thật: hai lượt thả tim trên cùng một tin đều quy về
  // `react-<tid>-<gMsgID>`, tức CÙNG một msg_id.
  if (replayed && already_sent) {
    console.log(`↩ [${threadId}] ${msgId} đã trả lời và đã gửi xong — bỏ bản trùng`);
    return;
  }

  const bubbles = Array.isArray(replies) && replies.length ? replies : reply ? [reply] : [];

  // Quyết định 25/08: KHÔNG delay nhân tạo — bong bóng đầu đi ngay lập tức,
  // giữa các bong bóng chỉ chừa 300ms cho Zalo giao đúng thứ tự.
  let daGui = 0;
  try {
    for (const [i, bubble] of bubbles.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, 300));
      rememberSent(bubble);
      await api.sendMessage(bubble, String(threadId), ThreadType.User);
      daGui = i + 1;
      console.log(`→ ${bubble.slice(0, 80)}…`);
    }
  } finally {
    // Ghi vào sổ là ĐÃ GỬI. Không có bước này thì `already_sent` bên trên vĩnh
    // viễn false và cái cổng vừa thêm là chữ chết: bridge không cầm service key
    // nên phải nhờ `chat-reply` ghi hộ (cửa `mark_sent`, cùng bí mật cổng).
    // Đặt trong `finally` để tin gửi hụt GIỮA CHỪNG cũng kịp ghi được đã đi tới
    // đâu — ném ra mà không ghi thì sổ nói "chưa gửi gì" trong khi khách đã cầm
    // ba bong bóng đầu.
    // Hạn còn lại, biết mà chưa vá: bridge chưa TIẾP TỤC từ `sent_bubbles`, nên
    // gửi hụt giữa chừng rồi giao lại vẫn phát từ bong bóng đầu. Muốn hết thì
    // `claim_inbound` phải trả thêm `sent_bubbles` — đổi chữ ký hàm DB, để dịp
    // khác chứ không nhét vào bản vá này.
    if (msgId && bubbles.length) {
      try {
        await postJson(CHAT_REPLY_URL, brainHeaders, {
          mark_sent: msgId, sent_bubbles: daGui, done: daGui === bubbles.length,
        }, HAN_CHO_NGAN);
      } catch (e) {
        await ghiLoi("mark_sent", errDetail(e));
      }
    }
  }

  // FR-143: đính kèm hình thật (URL chính chủ gửi, bộ não chọn) — tải về file
  // tạm rồi gửi như ảnh đính kèm; lỗi một tấm thì bỏ qua tấm đó.
  for (const url of Array.isArray(photos) ? photos : []) {
    try {
      // Hạn chờ BẮT BUỘC: một URL ảnh treo mà không có hạn là kẹt luôn cả vòng
      // gửi ảnh, khách chờ mãi không thấy tấm nào.
      const img = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!img.ok) continue;
      const f = path.join(
        os.tmpdir(),
        `nhadat-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
      );
      fs.writeFileSync(f, Buffer.from(await img.arrayBuffer()));
      await api.sendMessage({ msg: "", attachments: [f] }, String(threadId), ThreadType.User);
      fs.unlinkSync(f);
      console.log(`→ 📷 ${url.slice(0, 70)}…`);
    } catch (e) {
      await ghiLoi("gửi ảnh", errDetail(e));
    }
  }
}

api.listener.on("message", async (message) => {
  try {
    if (message.type !== ThreadType.User) return; // chỉ chat 1-1, bỏ qua nhóm

    // FR-141: tin ĐI RA từ acc clone mà không phải bot vừa gửi = CTV/admin đang
    // gõ tay → báo bộ não ghi log + nhường sân 30 phút, đừng trả lời chen ngang.
    if (message.isSelf) {
      const selfText = typeof message.data?.content === "string" ? message.data.content : "";
      if (!selfText || wasBotSent(selfText)) return;
      // Ghi hụt chỗ này KHÔNG được nuốt. Đây là tin báo "người thật đã vào
      // cuộc"; mất nó là bot không biết mà nhường sân, rồi chen ngang đúng lúc
      // cộng tác viên đang thương lượng giá với khách. Bản trước dùng
      // `.catch(() => {})` — hỏng hoàn toàn im lặng.
      try {
        await postJson(CHAT_REPLY_URL, brainHeaders, {
          external_user_id: String(message.threadId),
          text: selfText,
          human_note: true,
          channel: "zalo_personal_test",
        }, HAN_CHO_NGAN);
      } catch (e) {
        await ghiLoi("bao nguoi that vao cuoc", errDetail(e));
      }
      console.log(`👤 người thật nhắn [${message.threadId}] — bot nhường sân 30 phút`);
      return;
    }

    let text = message.data?.content;
    let imageUrl;
    if (text && typeof text === "object") {
      if (text.href) { // FR-134: ảnh có href
        imageUrl = text.href;
        text = text.title ?? "";
      } else if (text.catId != null || text.id != null) {
        text = "[sticker cảm xúc]"; // FR-142: sticker vui/like/tim = tín hiệu đồng ý
      } else {
        text = "";
      }
    }
    if ((typeof text !== "string" || !text.trim()) && !imageUrl) return;
    await handleIncoming(
      message.threadId,
      text,
      imageUrl,
      message.data?.msgId ? String(message.data.msgId) : undefined,
    );
  } catch (e) {
    await ghiLoi("xử lý tin", errDetail(e));
  }
});

// FR-142: khách thả cảm xúc (tim/like) lên tin nhắn — cũng là tín hiệu đồng ý.
// zca-js bản cũ không có event này thì try/catch bỏ qua, không sao.
try {
  api.listener.on("reaction", async (r) => {
    try {
      if (r?.isSelf) return;
      const tid = String(r?.threadId ?? r?.data?.threadId ?? "");
      if (!tid) return;
      const icon = r?.data?.content?.rIcon ?? r?.data?.rIcon ?? "❤️";
      // msg_id BẮT BUỘC có: postJson() thử lại khi mạng nghẽn, mà chat-reply
      // chống trả lời hai lần bằng khoá trùng zalo_msg_id. Đường tin nhắn
      // thường có sẵn msgId; đường reaction thì phải tự dựng.
      // Id phải vừa GIỐNG nhau giữa hai lượt thử của CÙNG cú thả tim (nên tính
      // MỘT lần ở đây, ngoài postJson), vừa KHÁC nhau giữa hai cú thả tim khác
      // nhau — lấy icon làm khoá là khách thả tim lần hai bị bot ngó lơ vĩnh
      // viễn, vì khoá trùng nằm vĩnh viễn trong DB.
      const rMsgId = r?.data?.content?.rMsg?.[0]?.gMsgID ?? r?.data?.msgId ??
        r?.data?.content?.rMsgId ?? Date.now();
      await handleIncoming(
        tid,
        `[khách thả cảm xúc ${icon}]`,
        undefined,
        `react-${tid}-${rMsgId}`,
      );
    } catch (e) {
      console.error("reaction lỗi:", errDetail(e));
    }
  });
} catch { /* phiên bản zca-js không hỗ trợ reaction */ }

// FR-140/144: mỗi phút kéo việc "hỏi chính chủ / báo CTV/admin" từ
// escalation-feed, resolve SĐT → uid Zalo rồi nhắn từ acc clone, xong ack.
// OA duyệt xong thì nudge tự gửi phía server, vòng này tự hết việc.
const uidCache = new Map(); // SĐT → uid, khỏi findUser lặp lại

// CHỐNG CHỒNG LƯỢT. `setInterval` cứ 60 giây là bắn một lượt, KHÔNG cần biết
// lượt trước xong chưa. Mỗi việc phải đi ba lượt mạng (tìm người → nhắn → báo
// đã xong), nên khi hàng đợi dồn (đang 85 việc) hoặc mạng chậm, một lượt vượt
// 60 giây là chuyện thường → hai lượt chạy chồng nhau.
// Mà cửa `pull` chỉ SELECT theo trạng thái `pending`, KHÔNG giành việc. Hai lượt
// chồng nhau thấy đúng cùng một danh sách và CÙNG GỬI → cộng tác viên nhận tin
// đúp. Đây đúng là cảnh mà bên `nudge` đã phải dựng cơ chế giành việc để chặn;
// đường này chưa có, nên chặn tạm bằng một cái cờ ngay trong tiến trình.
let dangKeoViec = false;

// LÙI DẦN KHI RỖNG (FR-171 c). Kéo mỗi 60 giây bất kể có việc hay không là
// 1.440 lượt lambda/ngày, mỗi lượt 3 câu SQL, trong khi hàng đợi trống 99%
// thời gian. Nay: có việc → 60 s; rỗng → nhân đôi tới trần 5 phút; có việc trở
// lại → về 60 s. Trần 5 phút chứ không 10 vì `bot_health_tick` coi bridge là
// chết khi 15 phút không thấy nhịp tim (nhịp tim đi kèm mỗi lượt kéo) — phải
// còn dư hai lượt trước ngưỡng đó.
const NHIP_NHANH = 60_000;
const NHIP_TRAN = 5 * 60_000;
let nhipKeo = NHIP_NHANH;

async function pumpEscalations() {
  if (dangKeoViec) return;
  dangKeoViec = true;
  try {
    const { items, error } = await postJson(FEED_URL, feedHeaders, { action: "pull" });
    if (error) return await ghiLoi("escalation-feed", error);
    nhipKeo = items?.length ? NHIP_NHANH : Math.min(nhipKeo * 2, NHIP_TRAN);
    for (const it of items ?? []) {
      try {
        let uid = it.zalo_user_id;
        if (!uid && it.phone) {
          // CHỈ NHỚ KHI TÌM RA. Bản trước nhớ cả kết quả thất bại: `findUser`
          // hụt một lần vì mạng chớp hay Zalo chặn tần suất là số đó bị ghim
          // `null` VĨNH VIỄN tới lúc khởi động lại tiến trình. Từ đó mỗi phút
          // ghi một dòng "không resolve được", còn lời nhắc thì nằm `pending`
          // mãi mãi. Nhiều khả năng đây là lý do việc dồn ứ ngay cả lúc cầu
          // nối còn sống.
          if (uidCache.has(it.phone)) {
            uid = uidCache.get(it.phone);
          } else {
            const u = await api.findUser(it.phone).catch(() => null);
            uid = u?.uid ?? u?.userId ?? null;
            if (uid) uidCache.set(it.phone, uid);
          }
        }
        if (!uid) { await ghiLoi("escalation", `${it.id}: không resolve được ${it.name}`); continue; }
        const msg = it.text ?? `🔔 nhadat.cc: ${it.note}. Anh/chị check giúp rồi trả lời khách sớm nha.`;
        rememberSent(msg);
        await api.sendMessage(msg, String(uid), ThreadType.User);
        // Gửi kèm uid vừa resolve từ SĐT: server ghi ngược vào sellers/ctvs/admins
        // để lần sau bot nhận ra người này ngay từ tin đầu (khỏi điền tay).
        await postJson(FEED_URL, feedHeaders, {
          action: "ack", id: it.id, zalo_user_id: String(uid),
        });
        console.log(`🔔 đã nhắn ${it.name}: ${String(it.note).slice(0, 70)}…`);
      } catch (e) {
        await ghiLoi("escalation", `${it.id}: ${errDetail(e)}`); // giữ pending, vòng sau thử lại
      }
    }
  } catch (e) {
    await ghiLoi("pumpEscalations", errDetail(e));
  } finally {
    // Phải nằm trong `finally`: nhánh `return` giữa chừng ở trên mà không hạ cờ
    // là kẹt cứng, từ đó không lượt nào chạy nữa và hàng đợi đứng im mãi.
    dangKeoViec = false;
  }
}
// `setTimeout` xích nhau thay cho `setInterval`: nhịp đọc lại sau MỖI lượt,
// và một lượt kéo dài không bao giờ bị lượt sau đè lên (cờ `dangKeoViec` vẫn
// giữ làm lưới thứ hai).
async function vongKeo() {
  await pumpEscalations();
  setTimeout(vongKeo, nhipKeo);
}
vongKeo();

api.listener.start();
