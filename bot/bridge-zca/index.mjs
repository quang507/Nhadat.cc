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

const CHAT_REPLY_URL =
  "https://tbcdpupiarkuxtntmosl.supabase.co/functions/v1/chat-reply";
const ANON_KEY =
  "sb_publishable_zmJBmEgFPn3bBKx_1ve6Pg_dXdo4haX"; // key công khai, chỉ gọi được function

const SESSION_FILE = "./zalo-session.json";

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

// Gửi một tin (kèm ảnh nếu bộ não trả về) — dùng chung cho tin nhắn và reaction
async function handleIncoming(threadId, text, imageUrl, msgId) {
  console.log(`← [${threadId}] ${text || "[ảnh]"}`);
  const res = await fetch(CHAT_REPLY_URL, {
    method: "POST",
    headers: brainHeaders,
    body: JSON.stringify({
      external_user_id: String(threadId),
      text: typeof text === "string" ? text : "",
      image_url: imageUrl,
      msg_id: msgId,
      channel: "zalo_personal_test",
    }),
  });
  const { reply, replies, photos, error } = await res.json();
  if (error) return console.error("chat-reply lỗi:", error);
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
    try {
      const img = await fetch(url);
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
      console.error("gửi ảnh lỗi:", e?.message ?? e);
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
    console.error("Lỗi xử lý tin:", e?.message ?? e);
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
      await handleIncoming(tid, `[khách thả cảm xúc ${icon}]`, undefined, undefined);
    } catch (e) {
      console.error("reaction lỗi:", e?.message ?? e);
    }
  });
} catch { /* phiên bản zca-js không hỗ trợ reaction */ }

// FR-140/144: mỗi phút kéo việc "hỏi chính chủ / báo CTV/admin" từ
// escalation-feed, resolve SĐT → uid Zalo rồi nhắn từ acc clone, xong ack.
// OA duyệt xong thì nudge tự gửi phía server, vòng này tự hết việc.
const FEED_URL =
  "https://tbcdpupiarkuxtntmosl.supabase.co/functions/v1/escalation-feed";
const feedHeaders = {
  ...brainHeaders,
  ...(process.env.BRIDGE_SECRET ? { "x-bridge-secret": process.env.BRIDGE_SECRET } : {}),
};
const uidCache = new Map(); // SĐT → uid, khỏi findUser lặp lại
async function pumpEscalations() {
  try {
    const res = await fetch(FEED_URL, {
      method: "POST", headers: feedHeaders, body: JSON.stringify({ action: "pull" }),
    });
    const { items, error } = await res.json();
    if (error) return console.error("escalation-feed lỗi:", error);
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
        if (!uid) { console.error(`escalation ${it.id}: không resolve được ${it.name}`); continue; }
        const msg = it.text ?? `🔔 nhadat.cc: ${it.note}. Anh/chị check giúp rồi trả lời khách sớm nha.`;
        rememberSent(msg);
        await api.sendMessage(msg, String(uid), ThreadType.User);
        await fetch(FEED_URL, {
          method: "POST", headers: feedHeaders,
          body: JSON.stringify({ action: "ack", id: it.id }),
        });
        console.log(`🔔 đã nhắn ${it.name}: ${String(it.note).slice(0, 70)}…`);
      } catch (e) {
        console.error(`escalation ${it.id} lỗi:`, e?.message ?? e); // giữ pending, vòng sau thử lại
      }
    }
  } catch (e) {
    console.error("pumpEscalations:", e?.message ?? e);
  }
}
setInterval(pumpEscalations, 60_000);
pumpEscalations();

api.listener.start();
