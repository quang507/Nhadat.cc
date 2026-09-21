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
const chu = viDuThanhChu();
ok("bản chữ có đủ ví dụ và không dài quá 8000 ký tự", chu.split("VÍ DỤ ").length - 1 === VI_DU_BOC_RAO.length && chu.length <= 8000, String(chu.length));
ok("bản chữ không chứa số điện thoại", !/\b0\d{9}\b/.test(chu));

console.log(hong ? `\nVÍ DỤ MẪU: ${hong}/${tong} CA HỎNG` : `\nVÍ DỤ MẪU: ${tong}/${tong} CA ĐẠT`);
process.exit(hong ? 1 : 0);
