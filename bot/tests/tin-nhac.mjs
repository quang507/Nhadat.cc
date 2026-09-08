// tin-nhac.mjs — chữ gửi ra Zalo cho việc trong hàng đợi `reminders`.
// Chạy: bun bot/tests/tin-nhac.mjs
// Sinh ra 08/09/2026 từ ảnh Zalo admin của chủ dự án: tin báo sức khoẻ đọc ra
// "🔔 nhadat.cc: 🩺 nhadat.cc: 4 lỗi trong 1 giờ qua. Xem trang /admin.. Anh/chị
// check giúp rồi trả lời khách sớm nha." — lặp tên, thừa dấu chấm, và bảo admin
// trả lời một khách không tồn tại.
import { escalationText } from "../supabase/functions/_shared/tin_nhac.ts";

let hong = 0, tong = 0;
const ok = (ten, dat, thay = "") => {
  tong++;
  if (dat) console.log(`✓ ${ten}`);
  else { hong++; console.log(`✗ ${ten}\n     → ${thay}`); }
};

// ── Tin NỘI BỘ đã tự mang dấu hiệu: gửi nguyên ──────────────────────────────
for (const [ten, note] of [
  ["sức khoẻ", "🩺 nhadat.cc: 4 lỗi trong 1 giờ qua. Xem trang /admin."],
  ["hồ sơ mới", "🆕 Hồ sơ người bán MỞ TỪ CHAT — nhãn CHÍNH CHỦ (phí 1%)."],
  ["khách hỏi", "❓ Khách hỏi căn #BDS-Q5-0001: \"phap_ly\"."],
  ["xin đổi nhãn", "✏️ Zalo …8895 đang nhãn CHÍNH CHỦ nhưng tự xưng MÔI GIỚI."],
]) {
  const t = escalationText({ kind: "escalation", note, seller_id: null });
  ok(`${ten}: không dán thêm "🔔 nhadat.cc:"`, !/🔔 nhadat\.cc:/.test(t), t);
  ok(`${ten}: không có hai dấu chấm cuối`, !/\.\.\s*$/.test(t), t);
  ok(`${ten}: không bảo trả lời khách`, !/trả lời khách sớm/.test(t), t);
}

// ── CTV / admin, ghi chú chữ thường: vẫn gắn tên + đuôi như cũ ──────────────
{
  const t = escalationText({
    kind: "escalation",
    note: "khách hỏi #BDS-Q5-0001 · cần: pháp lý (sổ hồng, hoàn công) · giao ctv.",
    seller_id: null,
  });
  ok("CTV: có tiền tố nhadat.cc", /^🔔 nhadat\.cc: khách hỏi/.test(t), t);
  ok("CTV: có đuôi nhắc trả lời khách", /trả lời khách sớm nha\.$/.test(t), t);
  ok("CTV: không hai dấu chấm", !/\.\.\s/.test(t), t);
}

// ── Chính chủ: giọng CSKH, cắt dấu chấm thừa ────────────────────────────────
{
  const t = escalationText({
    kind: "escalation",
    note: "khách đang quan tâm căn #BDS-Q5-0001 của mình, cần bổ sung: diện tích đất.",
    seller_id: "s-1",
  });
  ok("chính chủ: mở bằng lời chào", /^Chào anh\/chị, em bên nhadat\.cc ạ\./.test(t), t);
  ok("chính chủ: không hai dấu chấm", !/\.\.\s/.test(t), t);
  ok("chính chủ: đọc nhãn tiếng người, không đọc tên cột", /diện tích đất/.test(t) && !/dien_tich_dat/.test(t), t);
}

// ── report (báo cáo CTV 17h): gửi NGUYÊN VĂN, không thêm gì ─────────────────
{
  const bao = "Báo cáo CTV 2026-09-07 (17h)\n\n【CTV 1】\n- Đang chăm: 1 đơn";
  ok("report: nguyên văn", escalationText({ kind: "report", note: bao, seller_id: null }) === bao);
}

// ── Ghi chú rỗng thì không nổ ───────────────────────────────────────────────
ok("note rỗng: không nổ", typeof escalationText({ kind: "escalation", note: null }) === "string");

console.log(hong ? `\nTIN-NHAC: ${hong}/${tong} CA HỎNG` : `\nTIN-NHAC: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
