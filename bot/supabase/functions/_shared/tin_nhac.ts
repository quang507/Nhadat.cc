// tin_nhac.ts — soạn chữ cho một việc trong hàng đợi `reminders` khi đi ra
// ngoài (OA qua `nudge`, hoặc bridge qua `escalation-feed`). Hai đường phải nói
// y hệt nhau, nên chữ nằm ở đúng một chỗ.
//
// Tách khỏi `claude.ts` ngày 08/09/2026 vì file đó import SDK Anthropic +
// Supabase, không nạp được trong bài kiểm chạy offline. Hàm này thuần chữ,
// không import gì — kiểm bằng `bun bot/tests/tin-nhac.mjs`, không tốn một đồng.

/**
 * Text của một việc trong hàng đợi `reminders` khi đi ra ngoài (OA hoặc bridge).
 * Dùng CHUNG cho `nudge` (đường OA) và `escalation-feed` (đường bridge) — hai
 * đường phải nói y hệt nhau.
 * - kind `report` (FR-149): báo cáo CTV 17h → gửi NGUYÊN VĂN về Zalo admin.
 * - có seller_id (FR-144): đích là chính chủ → giọng CSKH lễ phép.
 * - còn lại: CTV/admin → thông báo nội bộ.
 */
export function escalationText(
  r: { kind: string; note: unknown; seller_id?: string | null },
): string {
  if (r.kind === "report") return String(r.note);
  // Ghi chú thường kết bằng dấu chấm rồi khuôn nối thêm ". " → "…/admin.."
  const note = String(r.note ?? "").trim().replace(/\s*\.+\s*$/, "");
  // FR-177 f (09/09/2026): "💬 " = câu hỏi bù ask-seller đã soạn sẵn cho chủ nhà
  // (đường bridge, khi không có OA). Gửi NGUYÊN VĂN, không bọc "em bên AI Ơi Nhà Đất".
  if (note.startsWith("💬")) return note.replace(/^💬\s*/, "");
  if (r.seller_id) {
    return `Chào anh/chị, em bên AI Ơi Nhà Đất ạ. ${note}. Anh/chị bổ sung giúp em để em báo khách liền nha!`;
  }
  // Tin NỘI BỘ đã tự mang dấu hiệu ở đầu (🩺 sức khoẻ, 🆕 hồ sơ mới, ❓ khách
  // hỏi, ✏️ xin đổi nhãn): gửi nguyên. Dán thêm "🔔 AI Ơi Nhà Đất:" thì admin đọc
  // ra "AI Ơi Nhà Đất: 🩺 AI Ơi Nhà Đất: 4 lỗi…", và đuôi "trả lời khách sớm nha" là
  // vô nghĩa với một tin báo hệ thống — chẳng có khách nào để trả lời.
  // (Bắt 08/09/2026 từ ảnh Zalo admin của chủ dự án.)
  if (/^[^\p{L}\p{N}]/u.test(note)) return note;
  return `🔔 AI Ơi Nhà Đất: ${note}. Anh/chị check giúp rồi trả lời khách sớm nha.`;
}
