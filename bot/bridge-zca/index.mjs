// Bridge zca-js — CHẠY TRÊN MÁY LOCAL, KHÔNG deploy đâu cả.
// Quét QR bằng ACC ZALO CLONE (đừng dùng acc chính — zca-js là API không chính
// thức, Zalo có thể khoá acc). Tin nhắn đến → gọi edge function chat-reply
// (bộ não) → gửi câu trả lời lại. Cài & chạy:
//   cd bot/bridge-zca && npm init -y && npm i zca-js && node index.mjs
// Lần đầu hiện QR trong terminal → mở Zalo app trên điện thoại (đăng nhập acc
// clone) → Quét QR. Cookie lưu ./zalo-session.json, lần sau khỏi quét lại.
import { Zalo, ThreadType } from "zca-js";
import fs from "node:fs";

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

api.listener.on("message", async (message) => {
  try {
    if (message.isSelf) return; // đừng tự trả lời chính mình
    if (message.type !== ThreadType.User) return; // chỉ chat 1-1, bỏ qua nhóm
    let text = message.data?.content;
    let imageUrl;
    if (text && typeof text === "object" && text.href) {  // FR-134: ảnh có href
      imageUrl = text.href;
      text = text.title ?? "";
    }
    if ((typeof text !== "string" || !text.trim()) && !imageUrl) return;

    console.log(`← [${message.threadId}] ${text}`);
    const res = await fetch(CHAT_REPLY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_user_id: String(message.threadId),
        text: typeof text === "string" ? text : "",
        image_url: imageUrl,
        msg_id: message.data?.msgId ? String(message.data.msgId) : undefined,
        channel: "zalo_personal_test",
      }),
    });
    const { reply, replies, error } = await res.json();
    if (error) return console.error("chat-reply lỗi:", error);
    const bubbles = Array.isArray(replies) && replies.length ? replies : reply ? [reply] : [];
    if (!bubbles.length) return;

    // Quyết định 25/08: KHÔNG delay nhân tạo — bong bóng đầu đi ngay lập tức,
    // giữa các bong bóng chỉ chừa 300ms cho Zalo giao đúng thứ tự.
    for (const [i, bubble] of bubbles.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, 300));
      await api.sendMessage(bubble, message.threadId, ThreadType.User);
      console.log(`→ ${bubble.slice(0, 80)}…`);
    }
  } catch (e) {
    console.error("Lỗi xử lý tin:", e?.message ?? e);
  }
});

// FR-140: mỗi phút kéo việc "báo CTV/admin" (khách hỏi căn không có chính chủ)
// từ escalation-feed, resolve SĐT → uid Zalo rồi nhắn từ acc clone, xong ack.
// OA duyệt xong thì nudge tự gửi phía server, vòng này tự hết việc.
const FEED_URL =
  "https://tbcdpupiarkuxtntmosl.supabase.co/functions/v1/escalation-feed";
const feedHeaders = {
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
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
        await api.sendMessage(
          `🔔 nhadat.cc: ${it.note}. Anh/chị check giúp rồi trả lời khách sớm nha.`,
          String(uid), ThreadType.User,
        );
        await fetch(FEED_URL, {
          method: "POST", headers: feedHeaders,
          body: JSON.stringify({ action: "ack", id: it.id }),
        });
        console.log(`🔔 đã báo ${it.name}: ${String(it.note).slice(0, 70)}…`);
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
