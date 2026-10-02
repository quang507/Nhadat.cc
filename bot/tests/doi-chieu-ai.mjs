// Đối chiếu LUẬT VIẾT CHO AI (prompt `_shared/ai/boc-rao.ts`) ↔ CODE kiểm / ghi kết quả AI (`kiem-bang-chung.ts`, chat-reply).
// 02/10/2026 (chủ dự án: "cần đối chiếu sửa gì về luật bóc tách giữa ai và code tay"; SRS-5.1zb). Hai bên lệch nhau thì lỗi IM:
// AI đọc đúng mà code vứt (nở hậu — `khoa_khong_co_cho_ghi`), hoặc prompt dạy một giá trị code không nhận. Không gọi model.
//  DC-01 mọi khoá AI được nói (MOI_KHOA) đều có đường ghi — KHOA_GHI hoặc ghép riêng trong `docAiChinh` (thử thật từng khoá).
//  DC-02 mọi khoá AI được nói đều có tên trong câu lệnh (AI không biết khoá thì không bao giờ nói).
//  DC-03 danh sách loại BĐS trong câu lệnh = bảng loại code nhận.
//  DC-04 mọi ý định AI nói được (Y_DINH, trừ binh_thuong) đều qua `docYDinh`.
//  DC-05 chat-reply: chỗ ghi đè còn đọc nghĩa bằng regex phải hỏi AI trước (capNhatQuan, bắt câu sửa, sửa bản nháp, đủ rồi, mở tin).
import { readFileSync } from "node:fs";
import { MOI_KHOA, KHOA_GHI, LOAI_BDS, docAiChinh, docYDinh } from "../supabase/functions/_shared/extraction/kiem-bang-chung.ts";

const goc = new URL("../supabase/functions/", import.meta.url).pathname;
const bocRao = readFileSync(goc + "_shared/ai/boc-rao.ts", "utf8");
const chat = readFileSync(goc + "chat-reply/index.ts", "utf8");
let dat = 0, hong = 0;
const kiem = (ten, ok, ct = "") => { ok ? dat++ : hong++; console.log(`${ok ? "✓" : "✗"} ${ten}${ok ? "" : ` — ${ct}`}`); };

// DC-01: khoá ngoài KHOA_GHI phải ra được một ô / cột khi đưa qua docAiChinh với giá trị mẫu.
const MAU = { ngang: ["4", "ngang 4m"], dai: ["15", "dài 15m"], no_hau: ["5", "nở hậu 5m"], duong: ["Trần Hưng Đạo", "Trần Hưng Đạo"],
  du_an: ["Sunrise City", "Sunrise City"], loai_giao_dich: ["ban", "bán"], loai_bds: ["nha_pho", "nhà phố"], quan: ["Quận 5", "quận 5"],
  ma_can: ["A12-05", "A12-05"], gia_m2: ["95 triệu/m2", "95 triệu/m2"] };
// Ngoại lệ CÓ LÝ DO (thêm dòng ở đây là một quyết định, không phải cách làm cổng xanh):
const NGOAI_LE = { dai: "dài một mình không có ô riêng — đường câu treo ghép với ngang đã có (`ghepMotChieu`); có ngang thì thành AxB" };
const ngoai = MOI_KHOA.filter((k) => !(k in KHOA_GHI) && !(k in NGOAI_LE));
const roi = ngoai.filter((k) => {
  const m = MAU[k];
  if (!m) return true;
  const d = [{ khoa: k, gia_tri: m[0], trich_dan: m[1], can: null }, ...(k === "ngang" ? [{ khoa: "dai", gia_tri: "15", trich_dan: "dài 15m", can: null }] : [])];
  const r = docAiChinh(d, null);
  return !(r.ghi.length || r.quan || r.maCan || r.giaM2Raw || r.loaiBds || r.loaiGiaoDich);
});
kiem("DC-01 mọi khoá AI nói được đều có đường ghi", roi.length === 0, roi.join(", "));
// Ca tự kiểm: khoá bịa phải bị bắt (không thì DC-01 xanh vì soi sai).
kiem("DC-01b khoá không có chỗ ghi bị bắt", !docAiChinh([{ khoa: "khoa_bia", gia_tri: "x", trich_dan: "x", can: null }], null).ghi.length);

// DC-02
const LUAT = bocRao.slice(bocRao.indexOf("const LUAT = `"), bocRao.indexOf("` + viDuThanhChu()"));
const thieuTen = MOI_KHOA.filter((k) => !new RegExp(`\\b${k}\\b`).test(LUAT));
kiem("DC-02 mọi khoá AI nói được đều có tên trong câu lệnh", thieuTen.length === 0, thieuTen.join(", "));

// DC-03
const dongLoai = /- loai_bds: ([a-z0-9_ |]+)/.exec(LUAT)?.[1] ?? "";
const loaiPrompt = dongLoai.split("|").map((x) => x.trim()).filter(Boolean).sort();
const loaiCode = Object.keys(LOAI_BDS).sort();
kiem("DC-03 loại BĐS trong câu lệnh = bảng loại code nhận", JSON.stringify(loaiPrompt) === JSON.stringify(loaiCode),
  `prompt ${loaiPrompt.join(",")} | code ${loaiCode.join(",")}`);

// DC-04
const yDinh = (/export const Y_DINH = \[([^\]]+)\]/.exec(bocRao)?.[1] ?? "").match(/"([a-z_]+)"/g)?.map((x) => x.slice(1, -1)) ?? [];
const roiYD = yDinh.filter((l) => l !== "binh_thuong" && docYDinh({ loai: l, trich_dan: "đủ rồi" }, "đủ rồi em") === null);
kiem("DC-04 mọi ý định AI nói được đều qua docYDinh", yDinh.length > 0 && roiYD.length === 0, roiYD.join(", ") || "không đọc được Y_DINH");

// DC-05 — soi mã nguồn: các chỗ từng để regex quyết khi AI đã đọc nay hỏi AI trước.
const than = (ten, dai = 1500) => { const i = chat.indexOf(ten); return i < 0 ? "" : chat.slice(i, i + dai); };
kiem("DC-05a capNhatQuan hỏi AI trước khi dò quận cả câu", /const ai = await aiLuot\(\);[\s\S]{0,200}ai !== undefined \? ai\.quan/.test(than("const capNhatQuan = async")));
kiem("DC-05b bắt câu sửa (FR-164) lọc theo AI", /const aiSua = suaFacts\.length \? await aiLuot\(\)/.test(chat));
kiem("DC-05c sửa bản nháp ghi ô AI trước", /const aiN = await aiLuot\(\);/.test(chat));
kiem("DC-05d 'đủ rồi' giữa vòng hỏi theo ý định AI", /noiDuRoi = ydDu !== undefined \? ydDu\?\.loai === "du_roi" : laDuRoi\(dapAn\)/.test(chat));
kiem("DC-05e mở tin mới theo can_khac của AI", /const canKhacAi = await canKhacLuot\(\);/.test(chat));
kiem("DC-05f câu rao: AI đã đọc thì ô AI không nói không do luật điền", /const chiAi = laCheDoAi && !!aiRao;/.test(chat));

console.log(`\n${dat}/${dat + hong} đạt`);
if (hong) process.exit(1);
