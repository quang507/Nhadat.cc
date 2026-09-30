#!/usr/bin/env bun
// khop-phuong.mjs — KIỂM tên phường AI đọc ra + quy ước số nhà hẻm (30/09/2026, chạy offline).
// Chủ dự án 30/09: "để AI nhận" — không còn luật dò tên phường; AI chọn tên (có danh sách mới + cũ trong câu lệnh), máy xác
// nhận tên có thật và câu khách có nhắc nó. Danh sách = 168 phường THẬT (20260915a) + 487 tên cũ (ds-phuong.ts).
import { cauNhacPhuong, chotPhuongAi, danhSachPhuongChoAi, laTenPhuongChu, nghiaDuChac, phuongChuan, phuongTrongTrich, tenDayDu } from "../supabase/functions/_shared/extraction/khop-phuong.ts";
import { PHUONG_CU, PHUONG_MOI } from "../supabase/functions/_shared/extraction/ds-phuong.ts";
import { kiemDeXuat } from "../supabase/functions/_shared/extraction/kiem-bang-chung.ts";
import { tachSoNhaHem } from "../supabase/functions/_shared/extraction/boc-cau-rao.ts";
import { napPhuongThat } from "./e2e/mock-supabase.mjs";

let dat = 0, hong = 0;
const ok = (ten, dk, chi = "") => { if (dk) dat++; else { hong++; console.log(`✗ ${ten}${chi ? `
    ${chi}` : ""}`); } };
const ten = (w) => w ? tenDayDu(w) : null;

ok("ds-phuong.ts khớp migration: 168 phường mới", PHUONG_MOI.length === 168 && PHUONG_MOI.length === napPhuongThat().length);
ok("ds-phuong.ts: 487 tên cũ", PHUONG_CU.length === 487, String(PHUONG_CU.length));

// phuongChuan: tra ĐÚNG tên AI trả, không dò câu.
ok("'Phường An Hội Tây' → có thật", ten(phuongChuan("Phường An Hội Tây")) === "Phường An Hội Tây");
ok("'xã tân vĩnh lộc' → Xã Tân Vĩnh Lộc", ten(phuongChuan("xã tân vĩnh lộc")) === "Xã Tân Vĩnh Lộc");
ok("'Phường An Hội' (AI cắt chữ) → KHÔNG có thật", phuongChuan("Phường An Hội") === null);
ok("'Phường 12' (số) → không tra ở đây", phuongChuan("Phường 12") === null);

// cauNhacPhuong: câu khách có nhắc phường AI chọn không — tên mới hoặc cũ, lệch 1–2 chữ.
const W = (t) => phuongChuan(t);
ok("'bán nhà cấp 4 Vĩnh Lộc B' nhắc Tân Vĩnh Lộc (tên cũ)", cauNhacPhuong("anh muốn bán nhà ở Vĩnh Lộc B nhà cấp 4 giá 2 tỷ", W("Tân Vĩnh Lộc")));
ok("'Vĩnh Lộc B' KHÔNG tính là nhắc Xã Vĩnh Lộc (vĩnh lộc b là tên cũ của Tân Vĩnh Lộc)", !cauNhacPhuong("bán nhà ở Vĩnh Lộc B", W("Vĩnh Lộc")));
ok("'Vĩnh Lộc A' nhắc Xã Vĩnh Lộc", cauNhacPhuong("đất ở vĩnh lộc a", W("Vĩnh Lộc")));
ok("'bên thảo điền' nhắc An Khánh", cauNhacPhuong("căn hộ bên thảo điền", W("An Khánh")));
ok("gõ sai 'an hoi tai' nhắc An Hội Tây", cauNhacPhuong("nha o an hoi tai go vap", W("An Hội Tây")));
ok("câu không nhắc → false", !cauNhacPhuong("bán nhà quận 5 giá 7 tỷ", W("An Hội Tây")));
ok("chotPhuongAi: AI trả tên có thật + câu nhắc → phường", ten(chotPhuongAi("Xã Tân Vĩnh Lộc", "ở Vĩnh Lộc B")) === "Xã Tân Vĩnh Lộc");
ok("chotPhuongAi: AI bịa phường câu không nhắc → null", chotPhuongAi("Phường Bến Thành", "bán nhà ở Vĩnh Lộc B") === null);
ok("phuongTrongTrich('phường an hội tây') = true", phuongTrongTrich("phường an hội tây"));

// Kiểm bằng chứng (đường thật AI → kiemDeXuat): tên cũ đổi sang mới qua được, tên cắt bị bỏ.
let k = kiemDeXuat([{ khoa: "phuong", gia_tri: "Xã Tân Vĩnh Lộc", trich_dan: "Vĩnh Lộc B", can: null }], "anh muốn bán nhà ở Vĩnh Lộc B nhà cấp 4 giá 2 tỷ");
ok("kiemDeXuat: AI 'Xã Tân Vĩnh Lộc' trích 'Vĩnh Lộc B' → ĐẠT, ghi 'Xã Tân Vĩnh Lộc'", k.dat.some((d) => d.khoa === "phuong" && /Xã Tân Vĩnh Lộc/.test(d.gia_tri ?? d.answer ?? JSON.stringify(d))), JSON.stringify(k));
k = kiemDeXuat([{ khoa: "phuong", gia_tri: "Phường An Hội", trich_dan: "phường an hội tây", can: null }], "phường an hội tây quận gò vấp");
ok("kiemDeXuat: AI cắt 'Phường An Hội' → BỎ", !k.dat.some((d) => d.khoa === "phuong"), JSON.stringify(k));
k = kiemDeXuat([{ khoa: "phuong", gia_tri: "Phường An Khánh", trich_dan: "thảo điền", can: null }], "căn hộ bên thảo điền 2pn giá 8 tỷ");
ok("kiemDeXuat: 'thảo điền' → Phường An Khánh ĐẠT", k.dat.some((d) => d.khoa === "phuong"), JSON.stringify(k));

const ds = danhSachPhuongChoAi();
ok("danh sách cho AI có 'Xã Tân Vĩnh Lộc' và 'Xã Vĩnh Lộc B'", /Xã Tân Vĩnh Lộc/.test(ds) && /Xã Vĩnh Lộc B/.test(ds));
ok("danh sách cho AI < 40.000 ký tự", ds.length < 40000, String(ds.length));
ok("laTenPhuongChu('an hoi tai') = true", laTenPhuongChu("an hoi tai"));
ok("laTenPhuongChu('phường 4') = false", !laTenPhuongChu("phường 4"));

ok("nghiaDuChac: 0,93 + cách 0,05 + đúng quận → sửa", nghiaDuChac({ do_gan: 0.93, quan_cu: "Quận Gò Vấp" }, { do_gan: 0.88 }, "Quận Gò Vấp"));
ok("nghiaDuChac: khác quận → hỏi", !nghiaDuChac({ do_gan: 0.95, quan_cu: "Quận 12" }, { do_gan: 0.8 }, "Quận Gò Vấp"));
ok("nghiaDuChac: chưa biết quận → hỏi", !nghiaDuChac({ do_gan: 0.95, quan_cu: "Quận 12" }, null, null));
ok("nghiaDuChac: hai ứng viên sát nhau → hỏi", !nghiaDuChac({ do_gan: 0.92, quan_cu: "Quận 5" }, { do_gan: 0.91 }, "Quận 5"));
ok("nghiaDuChac: 0,85 → hỏi", !nghiaDuChac({ do_gan: 0.85, quan_cu: "Quận 5" }, null, "Quận 5"));

// ── Quy ước số nhà hẻm TP.HCM ──
const sh = tachSoNhaHem("137/28 đường số 59");
ok("137/28 → hẻm 137, nhà số 28", sh?.hem === "137" && sh?.soNha === "28", JSON.stringify(sh));
const sh3 = tachSoNhaHem("nhà 137/28/5 Lê Văn Sỹ");
ok("137/28/5 → hẻm 137/28, nhà số 5", sh3?.hem === "137/28" && sh3?.soNha === "5", JSON.stringify(sh3));
ok("12/3A → hẻm 12, nhà 3A", tachSoNhaHem("hẻm 12/3a Trần Hưng Đạo")?.soNha === "3A");
ok("137/28 → một cấp hẻm [137]", JSON.stringify(sh?.capHem) === '["137"]', JSON.stringify(sh));
ok("137/28/5 → hai cấp hẻm [137, 137/28]", JSON.stringify(sh3?.capHem) === '["137","137/28"]', JSON.stringify(sh3));
const sh4 = tachSoNhaHem("12/3/4/5A Nguyễn Trãi");
ok("12/3/4/5A → hẻm nhỏ nhất 12/3/4, nhà 5A, ba cấp [12, 12/3, 12/3/4]",
  sh4?.hem === "12/3/4" && sh4?.soNha === "5A" && JSON.stringify(sh4?.capHem) === '["12","12/3","12/3/4"]', JSON.stringify(sh4));
ok("có khoảng trắng '137 / 28 / 5' vẫn đọc", tachSoNhaHem("nhà 137 / 28 / 5 Lê Văn Sỹ")?.hem === "137/28");
ok("'đường 3/2' là tên đường → null", tachSoNhaHem("nhà mặt tiền đường 3/2") === null);
ok("'1/2 tỷ' không phải địa chỉ → null", tachSoNhaHem("bớt 1/2 tỷ") === null);
ok("số nhà trơn '105 Trần Bình Trọng' → null", tachSoNhaHem("105 Trần Bình Trọng") === null);

console.log(`\nKHỚP PHƯỜNG: ${dat} đạt · ${hong} hỏng`);
if (hong) { console.log("KHỚP PHƯỜNG: CÓ CA HỎNG"); process.exit(1); }
console.log("KHỚP PHƯỜNG ĐẠT");
