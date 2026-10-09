// vi-du-boc-rao.mjs — FR-208 (g): ví dụ mẫu trong prompt bóc tách phải QUA được chính lớp kiểm
// bằng chứng. Ví dụ dạy model một trường mà code sẽ bỏ là dạy sai.   bun bot/tests/vi-du-boc-rao.mjs
import { VI_DU_BOC_RAO, viDuThanhChu } from "../supabase/functions/_shared/ai/vi-du-boc-rao.ts";
import { kiemDeXuat, kiemKienThuc, MOI_KHOA } from "../supabase/functions/_shared/extraction/kiem-bang-chung.ts";

let hong = 0, tong = 0;
const ok = (ten, dat, chi = "") => { tong++; if (!dat) hong++; console.log(`${dat ? "✓" : "✗"} ${ten}${dat ? "" : `  → ${chi}`}`); };

for (const [i, v] of VI_DU_BOC_RAO.entries()) {
  const { dat, bo } = kiemDeXuat(v.truong, v.tin);
  ok(`ví dụ ${i + 1}: mọi trường (${v.truong.length}) qua kiểm bằng chứng`, bo.length === 0 && dat.length === v.truong.length,
    JSON.stringify(bo.map((b) => [b.khoa, b.gia_tri, b.ly_do])));
  ok(`ví dụ ${i + 1}: khoá đều trong MOI_KHOA`, v.truong.every((t) => MOI_KHOA.includes(t.khoa)));
  const kt = kiemKienThuc(v.kien_thuc, v.tin, dat);
  ok(`ví dụ ${i + 1}: kiến thức (${v.kien_thuc.length}) đều được giữ`, kt.length === v.kien_thuc.length, JSON.stringify({ kt, muon: v.kien_thuc }));
  ok(`ví dụ ${i + 1}: không trường nào trùng khoá (trừ ngang/dai chung cụm)`,
    new Set(v.truong.map((t) => t.khoa)).size === v.truong.length);
}
// 09/10/2026 (bắn production thu-kg3 / thu-kg5): luật + ví dụ phải dạy "MT" / "MTKD" = mat_tien (SRS-5.1zzzzi) và tên xã / huyện +
// kích thước không phải địa chỉ (SRS-5.1zzzzd). Xoá câu luật hay ví dụ là đỏ.
{
  const { readFileSync } = await import("node:fs");
  const luat = readFileSync(new URL("../supabase/functions/_shared/ai/boc-rao.ts", import.meta.url), "utf8");
  ok("SRS-5.1zzzzi luật dạy 'MT' / 'MTKD' là viết tắt chuẩn = mat_tien, có ví dụ trích 'MT…' → mat_tien",
    /"MTKD"[^`]*mat_tien/.test(luat) && /Viết tắt CHUẨN của nghề \([^)]*"MT", "MTKD"/.test(luat) &&
      VI_DU_BOC_RAO.some((v) => v.truong.some((t) => t.khoa === "loai_duong_vao" && t.gia_tri === "mat_tien" && /^MT/.test(t.trich_dan))));
  ok("SRS-5.1zzzzd luật + ví dụ: tên xã / huyện + kích thước không phải duong / ten_duong",
    /duong \/ ten_duong CHỈ khi tin có tên đường, hẻm hoặc số nhà/.test(luat) &&
      VI_DU_BOC_RAO.some((v) => /(?:^|\s)xã\s/i.test(v.tin) && /\d+x\d+/.test(v.tin) && !v.truong.some((t) => t.khoa === "duong" || t.khoa === "ten_duong")));
}
const chu = viDuThanhChu();
// 01/10/2026: nới 8000 → 8600 cho ví dụ 12 (lỗi thật của chế độ `ai`: lạc câu hỏi thì trả rỗng, "3 lầu" quên trệt). Khối
// ví dụ nằm trong system có cache (tỉ lệ trúng cache Console ~92%), nên vài trăm ký tự thêm gần như không tốn thêm tiền.
// 02/10/2026: nới 8600 → 9500 cho ví dụ đầu (đợt 1 chuyển luật sang AI: ô có / không đọc phủ định, thế chấp, thương lượng —
// model bỏ sót ở lượt bắn lx-t6-02). Cùng lý do trên: khối ví dụ nằm trong system có cache.
// 03/10/2026: nới 9500 → 10200 cho ví dụ số hẻm / bề rộng hẻm (SRS-5.1zk — địa chỉ do AI ghi thẳng, bỏ luật ghép địa chỉ).
// 09/10/2026: nới 10200 → 12000 cho hai ví dụ bắn production (SRS-5.1zzzzi "MTKD" = mặt tiền; SRS-5.1zzzzd tên xã / huyện + kích thước
// không phải địa chỉ). Cùng lý do trên: khối ví dụ nằm trong system có cache.
ok("bản chữ có đủ ví dụ và không dài quá 12000 ký tự", chu.split("VÍ DỤ ").length - 1 === VI_DU_BOC_RAO.length && chu.length <= 12000, String(chu.length));
ok("bản chữ không chứa số điện thoại", !/\b0\d{9}\b/.test(chu));

console.log(hong ? `\nVÍ DỤ MẪU: ${hong}/${tong} CA HỎNG` : `\nVÍ DỤ MẪU: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
