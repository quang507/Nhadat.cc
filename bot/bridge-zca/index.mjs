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
    const text = message.data?.content;
    if (typeof text !== "string" || !text.trim()) return; // MVP: chỉ text

    console.log(`← [${message.threadId}] ${text}`);
    const res = await fetch(CHAT_REPLY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_user_id: String(message.threadId),
        text,
        msg_id: message.data?.msgId ? String(message.data.msgId) : undefined,
        channel: "zalo_personal_test",
      }),
    });
    const { reply, error } = await res.json();
    if (error) return console.error("chat-reply lỗi:", error);
    if (!reply) return;

    await api.sendMessage(reply, message.threadId, ThreadType.User);
    console.log(`→ ${reply.slice(0, 80)}…`);
  } catch (e) {
    console.error("Lỗi xử lý tin:", e?.message ?? e);
  }
});

api.listener.start();
