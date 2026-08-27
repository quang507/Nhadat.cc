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

// Mạng nhà/VPS rớt vài giây là chuyện thường: timeout 20s rồi thử lại 1 lần
// trước khi kêu lỗi, để một cú nghẽn không làm mất luôn lượt trả lời khách.
async function postJson(url, headers, payload) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST", headers, body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
      return await res.json();
    } catch (e) {
      last = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw last;
}

// Gửi một tin (kèm ảnh nếu bộ não trả về) — dùng chung cho tin nhắn và reaction
async function handleIncoming(threadId, text, imageUrl, msgId) {
  console.log(`← [${threadId}] ${text || "[ảnh]"}`);
  const { reply, replies, photos, error } = await postJson(CHAT_REPLY_URL, brainHeaders, {
    external_user_id: String(threadId),
    text: typeof text === "string" ? text : "",
    image_url: imageUrl,
    msg_id: msgId,
    channel: "zalo_personal_test",
  });
  if (error) return await ghiLoi("chat-reply", error);
  const bubbles = Array.isArray(replies) && replies.length ? replies : reply ? [reply] : [];

  // Quyết định 25/08: KHÔNG delay nhân tạo — bong bóng đầu đi ngay lập tức,
  // giữa các bong bóng chỉ chừa 300ms cho Zalo giao đúng thứ tự.
  for (const [i, bubble] of bubbles.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 300));
    rememberSent(bubble);
    await api.sendMessage(bubble, String(threadId), ThreadType.User);
    console.log(`→ ${bubble.slice(0, 80)}…`);
  }

  // FR-143: đính kèm hình thật (URL chính chủ gửi, bộ não chọn) — tải về file
  // tạm rồi gửi như ảnh đính kèm; lỗi một tấm thì bỏ qua tấm đó.
  for (const url of Array.isArray(photos) ? photos : []) {
    // File tạm phải khai NGOÀI try, và xoá trong `finally`. Bản cũ đặt
    // `unlinkSync` ngay sau `sendMessage`: hễ gửi lỗi (mạng rớt, zca-js ném,
    // acc bị treo) là nhảy thẳng vào catch và bỏ qua dòng xoá. Bridge chạy nền
    // hàng tuần, mỗi tấm ảnh gửi hụt để lại một file kẹt vĩnh viễn trong tmpdir
    // — Windows không tự dọn %TEMP%, nên nó chỉ lớn dần cho tới lúc đầy ổ.
    let f = null;
    try {
      const img = await fetch(url);
      if (!img.ok) continue;
      f = path.join(
        os.tmpdir(),
        `nhadat-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
      );
      fs.writeFileSync(f, Buffer.from(await img.arrayBuffer()));
      await api.sendMessage({ msg: "", attachments: [f] }, String(threadId), ThreadType.User);
      console.log(`→ 📷 ${url.slice(0, 70)}…`);
    } catch (e) {
      await ghiLoi("gửi ảnh", errDetail(e));
    } finally {
      // Xoá cũng có thể ném (file đang bị zca-js giữ) — nuốt riêng cú đó, đừng
      // để việc dọn dẹp làm hỏng vòng gửi những tấm còn lại.
      if (f) try { fs.unlinkSync(f); } catch { /* dọn hụt thì thôi */ }
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
      await fetch(CHAT_REPLY_URL, {
        method: "POST",
        headers: brainHeaders,
        body: JSON.stringify({
          external_user_id: String(message.threadId),
          text: selfText,
          human_note: true,
          channel: "zalo_personal_test",
        }),
      }).catch(() => {});
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

// Cờ chống chồng nhịp. `setInterval(fn, 60_000)` KHÔNG chờ lượt trước xong —
// nó bắn lượt mới đúng 60 giây một lần bất kể lượt cũ còn chạy hay không. Mà
// một lượt ở đây có thể dài hơn thế dễ dàng: `pull` (retry 2 lần, timeout 20s
// mỗi lần) + `findUser` cho từng SĐT lạ + `sendMessage` từng người + `ack`.
// Mạng chậm là hai lượt chạy song song, cùng `pull` về ĐÚNG danh sách pending
// đó (dòng chỉ chuyển `sent` ở bước ack cuối cùng), và chính chủ nhận hai tin
// giống hệt nhau cách nhau vài giây.
let dangBom = false;
async function pumpEscalations() {
  if (dangBom) {
    console.log("⏭ bỏ nhịp escalation: lượt trước còn chạy");
    return;
  }
  dangBom = true;
  try {
    const { items, error } = await postJson(FEED_URL, feedHeaders, { action: "pull" });
    if (error) return await ghiLoi("escalation-feed", error);
    for (const it of items ?? []) {
      try {
        let uid = it.zalo_user_id;
        if (!uid && it.phone) {
          if (!uidCache.has(it.phone)) {
            const u = await api.findUser(it.phone).catch(() => null);
            uidCache.set(it.phone, u?.uid ?? u?.userId ?? null);
          }
          uid = uidCache.get(it.phone);
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
    dangBom = false;
  }
}

// Vòng lặp bằng setTimeout thay cho setInterval: nhịp sau chỉ hẹn giờ SAU KHI
// nhịp trước kết thúc, nên khoảng cách luôn là "xong rồi chờ 60 giây" chứ
// không phải "cứ 60 giây một phát bất kể". Cờ `dangBom` ở trên vẫn giữ, vì
// escalation-feed cũng là nhịp tim FR-152 và có thể có nơi khác gọi tay.
async function vongBom() {
  await pumpEscalations();
  setTimeout(vongBom, 60_000);
}
vongBom();

api.listener.start();
