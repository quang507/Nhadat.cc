// LUẬT CHE LIÊN HỆ — MỘT NGUỒN cho web và bot (tầng bốn, 11/09/2026).
//
// Trước bản này có HAI bản chép tay: `lib/format.ts sanitizeDescription` (web,
// FR-104) và `chat-reply locLienHe` (bot, FR-105). Chú thích bên bot còn ghi
// thẳng "Deno không import được module Next; sửa regex một bên thì sửa bên
// kia" — tức lời hứa đồng bộ bằng trí nhớ. Chiều ngược lại thì được: web nhập
// thẳng file này qua `@/bot/...` (đúng như `/admin/prompt` nhập `prompts.ts`).
//
// Giữ NGUỒN regex dạng chuỗi, dựng RegExp mới mỗi lần gọi: một RegExp `/g` dùng
// chung giữa nhiều lời gọi `.test()` giữ `lastIndex` từ lần trước — lần gọi thứ
// hai trên cùng một câu có SĐT trả `false`. Lỗi đó không kêu, chỉ thỉnh thoảng
// để lọt một số điện thoại.

/** SĐT Việt Nam: +84 / 84 / 0 đầu, 9–11 chữ số, chấp nhận dấu cách · chấm · gạch giữa. */
export const SDT_NGUON = "(\\+?84|0)[\\s.\\-]?(\\d[\\s.\\-]?){8,10}";
/** Kênh liên hệ ngoài: Zalo, Facebook, Viber, Telegram kèm tên/ID đi sau. */
export const MANG_XA_HOI_NGUON = "\\b(zalo|z@lo|fb|facebook|viber|telegram)\\b\\s*:?\\s*[\\w.@/]*";

/**
 * Thay mọi SĐT và kênh liên hệ trong `s` bằng `nhan`. Không giữ trạng thái giữa
 * các lần gọi.
 *
 * MỘT lượt `replace` với hai nhánh, KHÔNG phải hai lượt nối nhau. Bản hai lượt
 * (SĐT trước, mạng xã hội sau — đúng thứ tự của cả web lẫn bot suốt từ 02/09)
 * làm LỒNG NHÃN: nhãn "[liên hệ qua Zalo AI Ơi Nhà Đất]" vừa chèn ở lượt một có
 * chữ "Zalo", lượt hai khớp đúng chữ đó và chèn thêm một nhãn nữa vào giữa —
 * mô tả trên web hiện "[liên hệ qua [liên hệ qua Zalo AI Ơi Nhà Đất] Ơi Nhà
 * Đất]". Bắt 11/09 lúc gom hai bản về một nguồn. Một lượt `replace` không bao
 * giờ quét lại chữ nó vừa chèn, nên nhãn có chứa gì cũng không lồng được.
 */
export function thayLienHe(s: string, nhan: string): string {
  return s.replace(new RegExp(`(?:${SDT_NGUON})|(?:${MANG_XA_HOI_NGUON})`, "gi"), nhan);
}

/** Câu có chứa SĐT không — dựng RegExp mới nên gọi bao nhiêu lần cũng đúng. */
export function coSdt(s: string): boolean {
  return new RegExp(SDT_NGUON).test(s);
}
