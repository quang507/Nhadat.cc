// chat-reply — "bộ não" hội thoại B-side tách khỏi kênh (NFR-12).
// Kênh nào (OA webhook, bridge zca-js test, web chat sau này) cũng gọi vào đây.
// POST { external_user_id, text, msg_id?, channel? }
//   → { reply, replies[], conversation_id }
// Nhánh BUYER theo FR-130: hồ sơ nhu cầu tích luỹ (buyers.preferences), mỗi
// lượt hỏi đúng MỘT tiêu chí thiếu, trả lời tách tối đa 2 bong bóng.
import { z } from "npm:zod@4";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import {
  anthropicClient,
  bangNhau,
  docBiMat,
  doTien,
  ghiLoi,
  jsonResponse,
  MODEL,
  secretOf,
  serviceClient,
} from "../_shared/claude.ts";
import {
  AGREE_RULES,
  BUYER_FEWSHOT,
  FEE_RULES,
  BUYER_PROFILE_FIELDS,
  FACT_LABELS,
  nhanTheoLoai,
  HUMAN_CHAT_RULES,
  SELLER_FEWSHOT, SELLER_SCRIPT_RULES, cauHoiMau as cauHoiMauGoc, cauPhuongNgan, docCauHoiMau, docCauTienDinh, dienCau, LOI_CHAO,
  SLANG_NOTES,
  TONE_RULES,
  dienTen, tenTroLy, // FR-181: mỗi khách một tên trợ lý (T•ai, Kh•ai…)
} from "../_shared/prompts.ts";
import { SPEC_COLS, thongSoNgan, type SpecRow } from "../_shared/thong_so.ts";
import { type FactNhap, soanTinNhap, type TinNhapRow } from "../_shared/tin-nhap.ts";
// 11/09/2026: báo lại cho người bán thứ ĐÃ LƯU trong DB (công tắc app_config.bao_lai_da_luu).
import {
  aiDocThem, BOC_DUOC, bocTachTaoTin, boBaoLai, COT_BAO_LAI, DAU_BAO_LAI, docCheDo, kemLuotTao, KHONG_BOC, NGUON_AI, vuaLuuBan, vuaLuuMua,
  type CheDoBaoLai, type DongBaoLai, type FactBaoLai,
} from "../_shared/bao_lai.ts";
import { bocRaoBangModel } from "../_shared/ai/boc-rao.ts";
import { ganManhBangModel } from "../_shared/ai/gan-manh.ts"; // FR-214 b/d: một người nhiều căn
import { canGanManh, donManh } from "../_shared/extraction/gan-manh-loc.ts";
import { LOAI_VI } from "../_shared/tin-nhap.ts";
import { type AiChinh, chonDeGhi, chonViTri, coMuiDuLieuRao, type DeXuat, docAiChinh, type DongDb, giaTriChoCauTreo, KHOA_FACT_AI_BIET, kiemDeXuat, kiemKienThuc, soSanhVoiDb } from "../_shared/extraction/kiem-bang-chung.ts";
import { chonGiaRao, dealCauRao, dienTichCauRao, duAnLaTenDuong, DUOI_GIA, laSoNhaHem, ngangNhanDai, phuongTenCauRao, phuongTenKhongDau, TRUOC_LA_SAN } from "../_shared/extraction/boc-cau-rao.ts";
import { bocQuan, vungNgoai } from "../_shared/dia_ban.ts"; // FR-174: quận/huyện từ câu rao (+ vùng ngoài, 11/09)
// FR-209 (15/09): tra PHƯỜNG MỚI từ tên đường (Nominatim → bảng `wards`), hỏi xác nhận rồi mới ghi.
import { cauChonPhuong, cauNhieuNoiPhuong, cauXacNhanPhuong, chuanTenDuong, docCacPhuongNominatim, duongTraDuoc, phuongCuaDuongTrongQuan, tachTienToPhuong, urlTraPhuong } from "../_shared/extraction/tra-phuong.ts";
// FR-212 (21/09/2026): từ điển tên đường — chọn kết quả `tim_duong`, thay tên trong địa chỉ, câu hỏi xác nhận (thuần).
import { catTenDuong, cauXacNhanDuong, chonDuong, type GoiYDuong, theTenDuong, type UngVienDuong } from "../_shared/extraction/tra-duong.ts";
import { tenDuong } from "../_shared/geocode.ts";
// FR-209: Nominatim/OSM đòi User-Agent có địa chỉ liên hệ (1 req/s) — cùng chuỗi với geocode-listings.
const UA_NOMINATIM = "nhadatcc-geocoder/1.0 (admin.buyerside@nhadat.cc)";
// Tầng bốn (11/09): luật tiền và luật che liên hệ MỘT NGUỒN — web, bot và bộ
// bóc tách cùng nhập từ đây, SQL `parse_vnd` thì đối chiếu trên cùng bảng ca.
import { CO_TIEN_KD, TIEN_KD, TIEN_CD, TIEN_T_KEP, docTien, donViGiaDep, giaTheoM2, gonGiaKyHan, laDonViTy, vndThanhChu } from "../_shared/extraction/luat-tien.ts";
import { soChuThanhSo } from "../_shared/extraction/so-chu.ts";
import { coSdt, SDT_NGUON, thayLienHe, thayLienHeCoId } from "../_shared/extraction/luat-lien-he.ts";
// 11/09/2026: khách mua muốn ở GẦN đâu — model hiểu nghĩa (boc-gan), regex dự
// phòng (tien-ich), mốc + khoảng cách do SQL tính (tim-moc → tin_gan_moc).
import { coMuiViTri, docGanTienIch, nhanGan, type GanTienIch } from "../_shared/extraction/tien-ich.ts";
import { bocGanBangModel, thanhGan } from "../_shared/ai/boc-gan.ts";
import { nhungCauTim, xepTheoNghia } from "../_shared/ai/nhung.ts"; // FR-216
import { soanLenhJson } from "../_shared/lenh-json.ts"; // FR-217
import { timTinGanMoc, type TinGan } from "../_shared/tim-moc.ts";
// FR-176: câu chủ nhà nhắn có phải câu trả lời không — tầng tiền định, không model.
import {
  batXungHo, bocViTriRao, chonCanTheoCau, chonCauKe, cungHoFact, HOI_MOT_LAN, laCauHoiTron, laDongY, laDuRoi, laGap, laHoanLai, laNgungRao, laRaoLai, NHAN_HOI_LAI, nhanDienFact,
  loaiTuChu, nhanDienNhieuCan, nhanDienNhieuFact, phanLoaiCauTraLoi, tachCauHoiNguoc, tachTheoCan, tuXungTuCau, vungPhuDinh, cheoPhuDinh, catDapAn, type KetQuaKhop, type NgungRao,
  suyTuXungHo, tuXungBot, laChaoChau, XUNG_HO_LON_TUOI, XUNG_HO_HOP_LE, type XungHo,
} from "../_shared/extraction/khop-cau-tra-loi.ts";
import { boCauHoiDo, boCauKhen, boDacDiemKhongCo, type CanDuLieu, boMaTinKhach, boMenhDeKhenSai, bongBongGoiYCan, type CanGoiY, coNhacCan, doiTuXung, themXinLoiKhiHieuNham, vuaKhen } from "../_shared/extraction/van-tra-loi.ts";
import { ganNhan, tenNhan } from "../_shared/extraction/nhan.ts";
import { ghepMotChieu, gonLoiSua, laBoSungRac, laNoiDaTraLoi, soNhaDau, themTangPhu, TIEU_TU_DAU } from "../_shared/extraction/khop-cau-tra-loi.ts";
// Đáp án ô `loai_bds` khi hàm DB đoán ra loại từ một câu dài (16/09/2026).
// Câu treo có đường ghi riêng — AI đọc trước KHÔNG thay đáp án (17/09/2026).
// Câu hỏi mà câu trả lời LÀ một số tiền nhưng không phải giá bán (FR-223): số tiền kèm theo không được ghi thành `gia`.
const CAU_HOI_TIEN = new Set(["doanh_thu", "tien_coc", "phi_quan_ly", "phi_gui_xe", "gia_dien_nuoc"]);
const CAU_KHONG_LAY_AI = new Set(["phuong", "vi_tri", "loai_bds", "hinh_anh", "duyet_tin", "danh_gia", "ngung_rao_can_nao", "xac_nhan_lich", "con_ban"]);
// 21/09/2026 (Zalo thật): ở chế độ `chinh`, câu VỊ TRÍ / PHƯỜNG vẫn để AI đọc trước — AI có tên đường /
// số phường sạch thì lấy; AI trống thì luật đỡ như cũ (không hạ "khớp" thành "lệch" như các khoá khác).
const CAU_AI_DOC_TRUOC_LUAT_DO = new Set(["vi_tri", "phuong"]);
const LOAI_DAP_AN: Record<string, string> = {
  nha_pho: "nhà phố", nha_cap4: "nhà cấp 4", chung_cu: "căn hộ chung cư", dat: "đất", biet_thu: "biệt thự",
  phong_tro: "phòng trọ", mat_bang: "mặt bằng", toa_nha: "toà nhà", dat_nong_nghiep: "đất nông nghiệp",
  dat_kinh_doanh: "đất kinh doanh", kho_xuong: "kho xưởng",
};
// FR-185: ảnh chủ nhà gửi → phân loại (model) + cất vào kho (Storage + listing_media).
import { lechDienTich, phanLoaiAnh, type LoaiAnh } from "../_shared/ai/phan-loai-anh.ts";
import { bocDuAnBangModel, coMuiDuAn, donKetQua } from "../_shared/ai/boc-du-an.ts";
import { phanVaiBangModel } from "../_shared/ai/phan-vai.ts";
import { donVai, nenHoiModelVai, type VaiModel } from "../_shared/extraction/phan-vai-loc.ts";
// 13/09/2026: van sau lời model — kho trống không được hứa có hàng, ghi chú không lặp, không ghi nhận hai lần.
import { dapHoiVeTin, hoiVeTin, LEGAL_VI, type TinTom } from "../_shared/extraction/hoi-ve-tin.ts";
import { thieuCoReNhanh } from "../_shared/re_nhanh.ts";
import { nhanhCuaKhoa } from "../_shared/extraction/re-nhanh.ts";
import { boCauGhiTienKhongCo, boCauM2KhongCo, boGachDai, M2_TRONG_CAU, boCanBia, boCauVongLai, boDoanPhuongDiaDanh, chanBiaDuKien, chanHuaGuiHinh, laHuaCoHang as laHuaCoHangCau, laHuaGuiHinh, laHuaHoiChu, suaBotXungNhamKhach, suaKhenNguocNghia } from "../_shared/extraction/van-tra-loi.ts";
import { boCauGhiNhan, boCauTrung, boDoanGioiDauCau, boHoiHoanCong, boHuaDaDang, laHoiLechKhoa, thayCauHoiLech, boGachCheo, boHoiMucDich, boKhenKhongCanCu, boMauThuanCan, boTenRiengBia, chanHuaCoHang, chanNhanLaNguoi, dapHoiNguocTienDinh, gopGhiChu, laCauGhiNhan, laHoiCoHang, laLoiMeta, laNoiVoiBot, laXinBoTruong, laXinSoKhach, laXinXoaDuLieu, boCauSuaLaiModel, locHoSoMua, suaTuXungMua, motCauHoi } from "../_shared/extraction/van-tra-loi.ts";
import { catAnhVaoKho, taiAnh, type LoaiMedia } from "../_shared/kho_anh.ts";

// Đơn vị dưới quận/huyện là XÃ chứ không phải phường (huyện, thị xã, tỉnh lân cận).
const laNgoaiDoThi = (quan?: string | null): boolean =>
  !!quan && /^(huyện|thị xã|tỉnh)\s|long an|bình dương|đồng nai|tây ninh/i.test(quan);

// FR-161 — RẤT NHIỀU người nhắn Zalo không bỏ dấu, mà mọi cổng regex ở đây
// từng viết bằng chữ có dấu: "ban nha quan 5 gia 5 ty" trượt cổng rao im lặng,
// "toi muon mua nha" không tách được vai, "chieu gui anh" không thành lời hứa.
// Chữa ở GỐC chứ không vá từng mẫu: chuẩn hoá đầu vào một lần rồi khớp.
//
// Luật hai chế độ: tin CÓ DẤU thì khớp bằng bộ regex có dấu như cũ (dấu của
// người gõ là thông tin — "đang bàn" khác "đang bán", đừng vứt đi); tin KHÔNG
// DẤU mới rơi về bộ regex đã bỏ dấu, chấp nhận nhập nhằng vốn có của tiếng
// Việt không dấu (ban = bán/bàn/bạn). Model thì đọc text GỐC — model không mù
// dấu, chỉ regex là mù.
const boDau = (s: string): string =>
  s.toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
// Fallback quy tắc khi model lỗi/hết quota (hướng parseVnd của NhaDat-Radar):
// bắt tối thiểu ngân sách + hẻm/mặt tiền bằng regex để hồ sơ không mất dữ liệu,
// và trả lời template thay vì im lặng hay đổ lỗi cho khách.
// ĐƠN VỊ TIỀN — MỘT nguồn cho năm chỗ từng chép riêng (FR-171 k: fallback hồ
// sơ, khoảng giá, cổng "có chi tiết", lời sửa giá, giá trong câu rao). Bản
// không dấu (KD) chạy trên `tKD`; bản có dấu (CD) chạy trên text gốc. "toi" là
// tỏi (tỷ) CHỈ khi sau nó không có số — "5 toi 6 ty" là "5 TỚI 6". "tr" viết
// tắt của triệu, nhưng \b sau "tr" khớp luôn "TRệt" (dấu tiếng Việt không phải
// \w) — từng làm price_raw thành "1 trệt 2 lầu"; lookahead chặn mọi chữ cái
// (kể cả có dấu) đứng sau. Sửa luật tiền là sửa ở đây, không đi tìm năm chỗ.
// (Hai hằng TIEN_KD / TIEN_CD nay nhập từ `_shared/extraction/luat-tien.ts`.)
// SỐ PHƯỜNG trong một chuỗi ĐÃ BỎ DẤU: "phường 4", "phuong4", "p.4", "P4". Chỉ
// lấy con số nên bỏ dấu không mất gì. Dùng cho câu rao, hồ sơ khách và so
// "căn khác phường" ở nhánh bán.
const PHUONG_KD = /phuong\s*\.?\s*(\d{1,2})|(?:^|[^a-z0-9])p\.?\s*(\d{1,2})(?![0-9])/;
const soPhuong = (kd: string): string | null => {
  const m = PHUONG_KD.exec(kd);
  return m ? (m[1] ?? m[2]) : null;
};
function regexProfileFallback(text: string): Record<string, string> {
  // Chạy trên bản BỎ DẤU (FR-161): fallback này chỉ nhặt số + từ khoá thô,
  // và bản không dấu phủ được cả hai kiểu gõ. "thuế" → "thue" vẫn dính nhầm
  // như trước, chấp nhận — đây là lưới cuối khi model đã hỏng.
  const t = boDau(text);
  const delta: Record<string, string> = {};
  // "5 ty 8" / "5 ty ruoi": giữ cả phần lẻ, vì budgetRangeVnd đọc được nó. Bản
  // cũ cắt còn "5 tỷ" → cận trên 5,75 tỷ → căn 5,8 tỷ khách đang hỏi bị lọc mất.
  // "toi" là "tỏi" (tỷ) CHỈ khi sau nó không có số: "5 toi 6 ty" là "5 TỚI 6".
  const money = new RegExp(
    `([\\d][\\d.,]*)\\s*(${TIEN_KD})(?![a-z])(\\s*(?:ruoi|\\d{1,3}(?![\\d.,]|\\s*m)))?`,
  ).exec(t);
  if (money) {
    const unit = /^(tr|trieu|cu)$/.test(money[2]) ? "triệu" : "tỷ";
    delta.budget = `${money[1]} ${unit}${money[3] ? ` ${money[3].trim()}` : ""}`;
  }
  if (/hxh|hem xe hoi/.test(t)) delta.alley = "hẻm xe hơi";
  else if (/mat tien|\bmt\b/.test(t)) delta.alley = "mặt tiền";
  if (/(^|[^a-z])thue(?![a-z])/.test(t)) delta.deal = "thue";
  else if (/\bmua\b/.test(t)) delta.deal = "ban";
  return delta;
}

// 23/09/2026 (FR-214 a, 20260923b): MỘT hội thoại mỗi người — tin người đó gửi lúc ở vai mua (`buyer`) lẫn
// vai bán (`seller`) nằm chung một dòng `conversations`. Mọi chỗ tách "tin người" với "tin bot" dùng hàm này;
// so riêng `=== "seller"` / `=== "buyer"` là coi tin người ở vai kia thành lời BOT.
const laTinNguoi = (s: string | null | undefined): boolean => s === "seller" || s === "buyer";
// 23/09/2026: câu khách hỏi TIẾP về một căn (không phải câu tìm mới) — hẻm, giá bớt, hướng, quy hoạch, hình,
// xem nhà, số chủ, "căn đó / nhà này". "anh" trần KHÔNG có ở đây (đại từ), chỉ "hình".
const HOI_TIEP_VE_CAN_RE = /\?|\b(?:huong|quy hoach|lo gioi|hem|bot|thuong luong|phap ly|so hong|so do|hinh|xem nha|di xem|qua xem|tang|lau|dien tich|mat tien|can do|can nay|can kia|nha do|nha nay|chu nha|so chu|con khong|o dau|bao nhieu|nam xay|noi that|dau xe|gan cho|gan truong)\b/;
// 23/09/2026: hồ sơ TẠM cho lượt này — hồ sơ đã lưu, chỗ nào trống thì lấy từ chính câu khách bằng luật
// tiền định (không gọi model). Chỉ dùng để LỌC KHO lượt này; không ghi vào DB.
//   · khu vực: quận ("q5", "quận 5"), phường ("p2"), hoặc "đường <tên>" — kho chỉ lọc theo số phường,
//     nên tên đường chỉ để biết khách đã nói nơi chốn.
//   · giá: MỆNH ĐỀ chứa cụm tiền (cắt ~25 ký tự trước số) để `budgetRangeVnd` đọc được "tầm/dưới/7 tới 8".
//   · phòng ngủ: "3 phòng ngủ" / "3pn".
export function hoSoTamTuCau(prefs: Record<string, unknown>, text: string, tKD: string): Record<string, unknown> {
  const p: Record<string, unknown> = { ...prefs };
  if (p.area == null || p.area === "") {
    const quan = bocQuan(tKD, text);
    const phuong = /\b(?:phuong|p)\s*(\d{1,2})\b/.exec(tKD);
    const duong = /\b(?:duong|pho)\s+([a-z]{2,}(?:\s+[a-z]{2,}){1,3})/.exec(tKD);
    if (quan || phuong || duong) {
      p.area = [phuong ? `Phường ${Number(phuong[1])}` : null, quan, !quan && !phuong && duong ? `đường ${duong[1]}` : null]
        .filter(Boolean).join(", ");
    }
  }
  if (p.budget == null || p.budget === "") {
    for (const menhDe of text.split(/[,.;\n!?]+/)) {
      const kd = boDau(menhDe);
      const m = CO_TIEN_KD.exec(kd);
      if (m) { p.budget = menhDe.slice(Math.max(0, m.index - 25)).trim(); break; }
    }
  }
  // Phòng ngủ chỉ lấy từ câu khi hồ sơ lưu còn thiếu khu vực/giá (lượt đầu) — hồ sơ đã đủ thì lọc như cũ.
  if (typeof p.bedrooms !== "number" && (prefs.area == null || prefs.budget == null)) {
    const pn = /\b(\d{1,2})\s*(?:phong ngu|pn)\b/.exec(tKD);
    if (pn && Number(pn[1]) >= 1 && Number(pn[1]) <= 10) p.bedrooms = Number(pn[1]);
  }
  if (p.deal == null || p.alley == null || p.alley === "") {
    const tam = regexProfileFallback(text);
    if (p.deal == null && tam.deal) p.deal = tam.deal;
    // "hẻm cách mặt tiền 50m" / "gần mặt tiền" KHÔNG phải đòi nhà mặt tiền — chỉ nhận "nhà/căn/mua mặt tiền".
    const muonMatTien = /\b(?:nha|can|mua|tim|lo|dat|mb|mat bang) mat tien\b/.test(tKD) && !/\b(?:cach|gan|sat|ra) mat tien\b/.test(tKD);
    if ((p.alley == null || p.alley === "") && tam.alley && (tam.alley !== "mặt tiền" || muonMatTien)) p.alley = tam.alley;
  }
  return p;
}

// 23/09/2026 (FR-216 b): hồ sơ mua có `alley` ("hẻm xe hơi" / "mặt tiền") từ lâu mà kho KHÔNG lọc theo nó — bot
// gợi căn hẻm xe máy cho khách đòi hẻm xe hơi. Trả mệnh đề `.or()` PostgREST cho `access_type`, hoặc null (không
// lọc: khách không nói, nói "không quan trọng", hay chỉ cần hẻm xe máy). Hẻm xe hơi nhận cả mặt tiền, hẻm xe tải
// và căn chủ nói "xe hơi vào tận nhà" (`car_in_house`).
export function locLoaiHem(alley: unknown): string | null {
  if (typeof alley !== "string" || !alley.trim()) return null;
  const t = boDau(alley);
  if (/\b(?:khong|ko|k)\b.*\b(?:quan trong|can|bat buoc)\b|\b(?:sao cung duoc|gi cung duoc|dau cung duoc)\b/.test(t)) return null;
  // "hẻm xe hơi hoặc mặt tiền" → tập rộng (đã gồm mặt tiền); chỉ "mặt tiền" mới hẹp về mặt tiền.
  if (/xe hoi|\bhxh\b|o to|\boto\b|xe tai|7 cho|4 cho/.test(t)) {
    return "access_type.eq.mat_tien,access_type.eq.hem_xe_tai,access_type.eq.hem_xe_hoi,car_in_house.is.true";
  }
  if (/mat tien|\bmt\b/.test(t)) return "access_type.eq.mat_tien";
  return null;
}

// FR-133: "chiều/mai/tối… em gửi" → hẹn giờ nhắc (giờ VN = UTC+7)
function mapDue(when: string): string {
  // Bản bỏ dấu (FR-161) phủ cả hai kiểu gõ: "chieu mai" hẹn được y như
  // "chiều mai". Đổi lại "tôi"/"tối" nhập một — chỉ lệch GIỜ nhắc, không mất nhắc.
  const t = boDau(when);
  const now = Date.now();
  const vn = new Date(now + 7 * 3600e3);
  let day = 0;
  if (/mai|hom sau/.test(t)) day = 1;
  // "thứ 7", "chủ nhật/CN" → số ngày tới thứ đó (trùng hôm nay thì lấy hôm nay)
  const wd = /thu\s*([2-7])/.exec(t);
  if (wd) day = ((parseInt(wd[1], 10) - 1) - vn.getUTCDay() + 7) % 7;
  else if (/chu nhat|\bcn\b/.test(t)) day = (7 - vn.getUTCDay()) % 7;
  let hour = 15;
  const hm = /(\d{1,2})\s*(?:h|gio)/.exec(t);
  if (hm) {
    hour = Math.min(23, Math.max(0, parseInt(hm[1], 10)));
    // "3h chiều", "8h tối" — giờ kèm buổi thì cộng 12, kẻo thành 3h/8h SÁNG
    if (hour < 12 && /chieu|toi|dem/.test(t)) hour += 12;
  } else if (/sang/.test(t)) hour = 9;
  else if (/trua/.test(t)) hour = 12;
  else if (/chieu/.test(t)) hour = 15;
  else if (/toi|dem/.test(t)) hour = 19;
  else if (/cuoi tuan/.test(t)) { day = ((6 - vn.getUTCDay()) + 7) % 7 || 6; hour = 10; }
  let due = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + day, hour - 7);
  if (due <= now) due = now + 2 * 3600e3; // đã qua giờ đó → nhắc sau 2 tiếng
  return new Date(due).toISOString();
}
// Regex bắt lời hứa cho nhánh seller (không qua parse có cấu trúc).
// Hai bản có-dấu / không-dấu, chọn theo tin (FR-161).
const PROMISE_RE = /(sáng mai|chiều|tối|trưa|mai|cuối tuần)[^.,;!?]{0,30}?(gửi|chụp|báo|đưa|bổ sung|cho em|check|coi lại)|(gửi|chụp|báo|đưa|bổ sung|check|coi lại)[^.,;!?]{0,30}?(sáng mai|chiều|tối|trưa|mai|cuối tuần)/i;
const PROMISE_RE_KD = /(sang mai|chieu|toi|trua|mai|cuoi tuan)[^.,;!?]{0,30}?(gui|chup|bao|dua|bo sung|cho em|check|coi lai)|(gui|chup|bao|dua|bo sung|check|coi lai)[^.,;!?]{0,30}?(sang mai|chieu|toi|trua|mai|cuoi tuan)/;

// SRS-3.3/SRS-5.2: khoảng giá trong hồ sơ → biên VND để lọc kho bằng price_vnd
// (bản cũ ghi "SRS-4.5" — đó là POST /api/search, trích nhầm)
// (cột số, parse_vnd phía DB — hướng parseVnd của NhaDat-Radar).
// "tầm/dưới 5 tỷ" → cận trên ×1.15; "trên/từ 4 tỷ" → cận DƯỚI; "5-6 tỷ" → cả hai.
//
// Soát 01/09 (vai người mua) — ba cách nói giá RẤT thường gặp từng bị đọc sai:
//   "5 tỷ 8"        → đọc thành 5 tỷ → cận trên 5,75 tỷ → căn 5,8 tỷ khách đang
//                     hỏi bị LỌC KHỎI KHO. Phía DB `parse_vnd` đọc đúng "5 tỷ 8"
//                     cho GIÁ TIN từ 25/08, nên tin ghi 5,8 tỷ và khách nói
//                     5 tỷ 8 không bao giờ gặp nhau.
//   "từ 5 đến 6 tỷ" → bắt "6 tỷ" + "từ" thành CẬN DƯỚI 5,7 tỷ — loại hết
//                     5,0–5,69 tỷ, đúng khoảng khách muốn.
//   "5 tới 6 tỷ"    → "tới" bị đọc thành "tỏi" (lóng của tỷ) → "5 tỏi".
// Luật phần lẻ chép từ parse_vnd: 1 chữ số sau "tỷ" là phần mười, 2-3 chữ số là
// triệu; "rưỡi" = +0,5. Một luật, hai chỗ — cố ý, vì hàm DB trả MỘT số còn ở
// đây cần KHOẢNG; đổi luật thì đổi cả hai.
function budgetRangeVnd(budget: unknown): { min?: number; max?: number } | null {
  if (typeof budget !== "string") return null;
  // Bỏ dấu một lần (FR-161): hồ sơ do model bóc thì có dấu, do fallback regex
  // thì không — hàm này phải nuốt được cả hai mà không nhân đôi bảng mẫu.
  const bd = boDau(budget);
  const num = (s: string) => parseFloat(s.replace(",", "."));
  // Một lượng tiền: số + đơn vị + phần lẻ tuỳ chọn. "toi" là tỏi (tỷ) chỉ khi
  // sau nó KHÔNG có số — "5 toi 6" là "tới". Phần lẻ không được dính "m" (m2).
  const TIEN = new RegExp(
    `(\\d+(?:[.,]\\d+)?)\\s*(${TIEN_KD})(?![a-z])(?:\\s*(ruoi)|\\s*(\\d{1,3})(?![\\d.,]|\\s*m))?`,
    "g",
  );
  const doc = (m: RegExpMatchArray): number => {
    const laTy = laDonViTy(m[2]);
    let v = num(m[1]) * (laTy ? 1e9 : 1e6);
    if (laTy && Number.isInteger(num(m[1]))) {
      if (m[3]) v += 0.5e9;
      else if (m[4]) v += m[4].length === 1 ? Number(m[4]) * 1e8 : Number(m[4]) * 1e6;
    }
    return v;
  };
  const cac: number[] = [];
  for (const m of bd.matchAll(TIEN)) {
    const v = doc(m);
    if (Number.isFinite(v) && v > 0) cac.push(v);
  }
  // "5-6 tỷ", "từ 5 đến 6 tỷ", "5 tới 6 tỷ", "khoảng 5 6 tỷ": số đầu KHÔNG mang
  // đơn vị, mượn đơn vị của số sau.
  const chung = new RegExp(
    `(\\d+(?:[.,]\\d+)?)\\s*(?:-|–|~|den|toi|hoac|hay|\\s)\\s*(\\d+(?:[.,]\\d+)?)\\s*(${TIEN_KD})(?![a-z])`,
  ).exec(bd);
  if (chung) {
    const u = laDonViTy(chung[3]) ? 1e9 : 1e6;
    const a = num(chung[1]) * u, b = num(chung[2]) * u;
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b >= a) {
      return { min: Math.round(a * 0.95), max: Math.round(b * 1.1) };
    }
  }
  // "5 tỷ đến 6 tỷ", "5 tỷ 8 - 6 tỷ": hai lượng tiền đủ đơn vị.
  if (cac.length >= 2) {
    const a = Math.min(cac[0], cac[1]), b = Math.max(cac[0], cac[1]);
    return { min: Math.round(a * 0.95), max: Math.round(b * 1.1) };
  }
  if (!cac.length) return null;
  const base = cac[0];
  if (/tren|hon|\btu\b|toi thieu|it nhat/.test(bd)) return { min: Math.round(base * 0.95) };
  return { max: Math.round(base * 1.15) };
}

// HAI BẢNG TỪ VỰNG cho cùng một khái niệm mua/thuê, đừng lẫn:
//   · cột DB `listings.deal` là enum `ban | cho_thue`;
//   · hồ sơ khách (buyers.preferences, JSON) và schema model dùng từ ngắn `thue`.
// Chạm vào CỘT thì phải quy đổi, không thì INSERT tin cho thuê nổ vì sai enum,
// còn bộ lọc kho .eq("deal","thue") lỗi truy vấn → khách tìm thuê không bao giờ
// được gợi ý căn nào.
const dealCol = (v: unknown): "ban" | "cho_thue" =>
  v === "thue" || v === "cho_thue" ? "cho_thue" : "ban";

// FR-29: mã căn khách nhắc ("#BDS-Q5-0115", từ web bấm sang) — chào đúng căn đó
const CODE_RE = /(?:#\s*)?\b([A-Za-z]{2,5}(?:-[A-Za-z0-9]{1,15}){1,4})\b/g;
// Mã tin trước khi nhét vào chuỗi `.or("code.ilike.X,legacy_code.ilike.X")` của
// PostgREST: ở đó dấu phẩy / ngoặc là NGỮ PHÁP và %/_ là wildcard. Ba chỗ dùng
// (hỏi chủ, hẹn xem, chốt) lấy mã từ ĐẦU RA MODEL — không bị CODE_RE ràng buộc —
// nên model trả "BDS-NP-Q5-0001, BDS-NP-Q5-0002" là PostgREST 400, `{ data }`
// thành null và bot lặng lẽ đi nhánh "không thấy tin". Chỉ nhận [A-Z0-9-].
const maTinSach = (s: string | null | undefined): string => {
  const v = (s ?? "").trim().toUpperCase();
  return /^[A-Z0-9-]{3,40}$/.test(v) ? v : "";
};

// Hồ sơ + trả lời trong MỘT lượt gọi model (FR-130)
const BuyerTurn = z.object({
  profile: z.object({
    name: z.string().nullable().describe("Tên khách nếu khách vừa xưng tên"),
    deal: z.enum(["ban", "thue"]).nullable().describe("ban = khách muốn MUA, thue = muốn THUÊ"),
    area: z.string().nullable().describe("Khu vực khách muốn TÌM (quận/phường/đường), nguyên văn kiểu nói; nơi muốn ở GẦN (bệnh viện, trường) KHÔNG ghi vào đây"),
    budget: z.string().nullable().describe("Khoảng giá, nguyên văn kiểu nói ('tầm 5 tỷ'); khách nói mơ hồ ('rẻ thôi') thì null"),
    purpose: z.string().nullable().describe("CHỈ khi khách NÓI THẲNG: để ở / đầu tư / kinh doanh / cho thuê lại. KHÔNG suy ra từ hoàn cảnh, loại nhà hay chữ 'gấp'"),
    property_type: z.string().nullable().describe("Loại nhà khách nói: nhà hẻm / nhà mặt tiền / căn hộ / đất / phòng trọ…"),
    bedrooms: z.number().nullable(),
    alley: z.string().nullable().describe("Hẻm xe hơi / mặt tiền / không quan trọng"),
    timeline: z.string().nullable().describe("Mốc CẦN DỌN VÀO / CHỐT MUA ('trong tháng này', 'trước Tết'). Giờ đi XEM NHÀ không phải timeline (đó là viewing)"),
    notes: z.string().nullable().describe("Hoàn cảnh SỐNG đáng nhớ: người ở cùng, con học trường nào, sức khoẻ, thú nuôi, số người ở. KHÔNG chép lại câu khách, KHÔNG ghi thái độ/cảm xúc hay câu khách đang hỏi"),
  }).describe("CHỈ ghi điều khách NÓI RÕ trong câu vừa nhắn hoặc hội thoại. Không suy diễn. Chưa biết để null — null KHÔNG xoá thứ đã biết."),
  replies: z.array(z.string()).min(1).max(2)
    .describe("1-2 bong bóng tin nhắn gửi khách, theo đúng nhịp nhắn giống người"),
  promise: z.object({
    when: z.string().describe("Mốc hẹn nguyên văn: 'chiều nay', 'mai', 'tối', 'cuối tuần'…"),
    what: z.string().describe("Khách hứa làm gì: 'gửi ảnh sổ', 'báo lại tài chính'…"),
  }).nullable().describe("CHỈ điền khi khách chủ động hứa sẽ gửi/báo gì đó vào một mốc thời gian. Không suy diễn."),
  viewing: z.object({
    listing_code: z.string().nullable().describe("Mã căn muốn xem, ví dụ 'BDS-NP-BINHTAN-0001', 'BDS-NP-Q5-0001' (không có # đầu)"),
    when: z.string().describe("Khung giờ khách chốt, nguyên văn: 'mai 9h sáng', 'chiều thứ 7'…"),
    phone: z.string().nullable().describe("SĐT khách TỰ cho ở bước chốt lịch; không có thì null"),
  }).nullable().describe("CHỈ điền khi khách chốt/đề nghị lịch xem nhà cụ thể (UF-06). Không suy diễn."),
  agreed_deal: z.object({
    listing_code: z.string().nullable().describe("Mã căn khách vừa đồng ý chốt, ví dụ 'BDS-NP-BINHTAN-0001', 'BDS-NP-Q5-0001'; không rõ mã thì null"),
  }).nullable().describe("CHỈ điền khi tin NGAY TRƯỚC của EM có đề nghị chốt hợp đồng/cọc và khách vừa ĐỒNG Ý theo AGREE_RULES (bằng chữ, emoji vui, like/tim). Không suy diễn."),
  send_photos: z.string().nullable().describe("Mã căn cần gửi hình kèm tin này - CHỈ điền khi khách xin hình và khối căn ghi 'có hình sẵn'; không thì null"),
  ask_owner: z.object({
    listing_code: z.string().nullable().describe("Mã căn cần hỏi, ví dụ 'BDS-NP-BINHTAN-0001', 'BDS-NP-Q5-0001' (không có # đầu)"),
    question: z.string().describe("Điều cần hỏi/xin từ chủ tin, ngắn gọn: 'hình + địa chỉ chi tiết', 'pháp lý', 'còn bán không'…"),
  }).nullable().describe("CHỈ điền khi em vừa hứa 'để em hỏi lại chủ nhà / xin hình rồi gửi anh chị' về MỘT căn cụ thể. Không suy diễn."),
  need_human: z.boolean().describe(
    "true CHỈ khi: khách đòi gặp người thật/quản lý, khách bức xúc thật sự, đàm phán giá vào hồi kết, hoặc đã 'để em hỏi lại' 2 lần cùng một chuyện. Câu hỏi khó thường ngày thì false.",
  ),
  // FR-79 (v48): khách đòi gọi điện / voice / "alo được không" → cờ riêng để hệ
  // thống mở việc VOICE cho người thật gọi lại (kèm need_human).
  voice_request: z.boolean().describe(
    "true khi khách muốn GỌI ĐIỆN / voice / nói chuyện qua điện thoại hoặc xin số để gọi bên em. Khách CHO số của họ ở bước chốt lịch thì false.",
  ),
});

// ─── FR-171 h: thứ giống nhau cho MỌI tin thì dựng MỘT lần ở tầng module.
// Isolate của edge function sống qua nhiều request, nên hằng, schema đã biên
// dịch và các thứ nhớ tạm dưới đây chỉ tốn công ở request đầu.
const BUYER_FORMAT = zodOutputFormat(BuyerTurn);
// 14/09/2026 (đo thật cùng câu lệnh, Haiku 4.5, nhớ tạm đã trúng): gọi CÓ khuôn JSON
// `output_config.format` mất 4,1–5,4 s cho ~140 token ra; KHÔNG khuôn, dặn JSON bằng
// lời mất 1,8–3,5 s và 8/8 lượt ra JSON hợp lệ đúng từng trường. Giải mã có ràng
// buộc chậm gấp đôi. Nhánh mua nay đưa JSON Schema vào khối system NHỚ TẠM (đọc lại
// 1/10 giá), tự đọc + kiểm bằng zod; hỏng thì rơi về đường dự phòng như model chết.
// Khuôn vẫn đi kèm dưới tên `_khuon_du_phong` cho riêng lưới Groq (FR-194).
const BUYER_SCHEMA_TXT = JSON.stringify(z.toJSONSchema(BuyerTurn));
const DAU_RA_JSON =
  "ĐẦU RA: trả về DUY NHẤT một object JSON (không markdown, không chữ nào ngoài JSON) đúng JSON Schema sau — " +
  "mô tả từng trường nằm trong \"description\":\n" + BUYER_SCHEMA_TXT;
/** Đọc lượt người mua từ chữ model trả: cắt từ "{" đầu tới "}" cuối, kiểm bằng zod. */
function docLuotMuaTuChu(chu: string): z.infer<typeof BuyerTurn> | null {
  const dau = chu.indexOf("{"), cuoi = chu.lastIndexOf("}");
  if (dau < 0 || cuoi <= dau) return null;
  try {
    const kq = BuyerTurn.safeParse(JSON.parse(chu.slice(dau, cuoi + 1)));
    return kq.success ? kq.data : null;
  } catch {
    return null;
  }
}
// Khối "căn khách đang nhắc" (FR-29): trạng thái nói bằng lời cho model.
const STATUS_VI: Record<string, string> = {
  cho_thong_tin: "đang chờ bổ sung thông tin, chưa lên kệ",
  dang_ban: "đang bán",
  dang_quan_tam: "đang được nhiều khách quan tâm",
  da_chot: "ĐÃ CHỐT GIAO DỊCH - báo thật với khách là căn này đã chốt rồi gợi ý căn tương tự trong KHO",
  an: "đã gỡ khỏi kệ",
};
const PHOTO_URL_RE = /https?:\/\/\S+/g;

// ─── FR-105 (v48): LỌC LIÊN HỆ PHÍA BOT. Áp cho mọi chuỗi mô tả/fact đưa vào
// KHO gửi model và mọi bong bóng gửi NGƯỜI MUA. KHÔNG áp cho nhánh người bán /
// CTV / admin — họ cần thấy số để làm việc.
// Luật SĐT/mạng xã hội nay là MỘT NGUỒN với web (`luat-lien-he.ts`, tầng bốn
// 11/09). Bản cũ chép tay từ `lib/format.ts` kèm lời dặn "sửa regex một bên
// thì sửa bên kia" — đồng bộ bằng trí nhớ. Chiều ngược lại import được: web
// nhập thẳng file đó qua `@/bot/...`.
// Số nhà trước tên đường trong MÔ TẢ/FACT: "số 12 Trần Hưng Đạo", "572/12
// Nguyễn Trãi", "12 đường Nguyễn Trãi". Chỉ áp khi `soNha=true` (mô tả/fact)
// — `location_raw` của tin và câu chốt lịch xem UF-06 giữ nguyên [giả định BA,
// theo OPEN-36: lưu hết, khai khi khách hỏi; SĐT/Zalo mới là thứ giữ tới UF-06].
const SO_NHA_RE =
  /(?<![\p{L}\d.,/])(?:số\s*\d{1,4}[a-z]?(?:\/\d{1,4}[a-z]?)*|\d{1,4}[a-z]?(?:\/\d{1,4}[a-z]?)+|\d{1,4}[a-z]?(?=\s+(?:đường|hẻm)\s))(?=[\s,.;]|$)/giu;
function locLienHe(s: string, soNha = false): string {
  let t = thayLienHe(s, " [liên hệ qua Zalo] ");
  if (soNha) t = t.replace(SO_NHA_RE, "");
  return t.replace(/[ \t]{2,}/g, " ").trim();
}
// 22/09/2026 (bộ đo giọng M03): câu BOT TỰ NÓI với người mua ("anh chị phụ trách sẽ liên hệ
// qua Zalo") đi qua `locLienHe` thành "liên hệ qua [liên hệ qua Zalo]" — chữ "Zalo" trần là
// lời bot, không phải kênh liên hệ của ai. Bong bóng bot chỉ che SĐT và kênh CÓ ID (model lỡ
// chép từ kho); chữ KHÁCH gửi và mô tả/fact vẫn qua `locLienHe` đủ.
function locLienHeBot(s: string): string {
  return thayLienHeCoId(s, " [liên hệ qua Zalo] ").replace(/[ \t]{2,}/g, " ").trim();
}

// ─── FR-114/116 (v48): tin thuộc dự án — mã căn trong câu ("căn A12-05", "mã
// căn B2.07", "căn 1205") và tình trạng căn (enum `unit_status` của DB) nói
// bằng lời. Quá 7 ngày chưa chủ xác nhận (FR-116) thì bot KHÔNG được khẳng
// định còn/hết, phải "để em xác nhận lại chủ" + ask_owner.
const MA_CAN_RE =
  /(?:mã\s*căn|ma\s*can|căn\s*hộ|can\s*ho|căn|can)\s*(?:số|so)?\s*:?\s*([A-Za-z]{0,2}\d{1,2}[-.]\d{2,3}[A-Za-z]?|[A-Za-z]\d{2,4}|\d{4})\b/i;
const UNIT_VI: Record<string, string> = {
  con_ban: "còn bán", giu_cho: "đang giữ chỗ", da_coc: "đã cọc", da_ban: "đã bán",
};
const TTL_XAC_NHAN_MS = 7 * 24 * 3600e3;
const xacNhanCu = (at: string | null | undefined): boolean =>
  !at || Date.now() - Date.parse(at) > TTL_XAC_NHAN_MS;
type DuAnRow = {
  project_id?: string | null; unit_code?: string | null; unit_status?: string | null;
  last_confirmed_at?: string | null; projects?: { name?: string | null } | null;
};
function duAnNgan(l: DuAnRow): string {
  if (!l.project_id) return "";
  const p = [`dự án ${l.projects?.name ?? "(chưa rõ tên)"}${l.unit_code ? ` căn ${l.unit_code}` : ""}`];
  if (l.unit_status) p.push(`tình trạng căn: ${UNIT_VI[l.unit_status] ?? l.unit_status}`);
  p.push(xacNhanCu(l.last_confirmed_at)
    ? "chủ xác nhận lần cuối QUÁ 7 NGÀY (hoặc chưa từng) - nói 'để em xác nhận lại chủ rồi báo anh/chị' và điền ask_owner, KHÔNG khẳng định còn/hết"
    : `chủ xác nhận ${Math.max(0, Math.round((Date.now() - Date.parse(l.last_confirmed_at!)) / 864e5))} ngày trước - nói được theo tình trạng trên`);
  return " · " + p.join(" · ");
}

// ─── FR-27/31/65/79 (v48): các cổng regex trên bản BỎ DẤU (`tKD`, FR-161).
// "xem thêm" hình — chỉ có nghĩa khi lượt trước bot vừa gửi hình còn dư.
const XEM_THEM_RE_KD = /xem them|them (hinh|anh|tam)|con (hinh|anh|tam) (nao )?(nua|khac)|tam nua|gui them|hinh khac|(hinh|anh) tiep/;
// Khách hỏi căn "giống giống vầy" → nạp CĂN TƯƠNG TỰ.
const GIONG_RE_KD = /giong (giong )?(vay|nay|kieu nay|nhu vay|the nay)|tuong tu|na na|kieu (vay|nay|do)|nhu (vay|nay|the)|can (nao )?khac (giong|tuong tu)/;
// Khách đòi gọi điện / voice (FR-79). "sđt tôi 0909…" (khách CHO số ở bước
// chốt lịch) không khớp — chỉ khớp khi khách xin SỐ CỦA BÊN EM hay đòi gọi.
// 20/09/2026 (bắn thật mau-y-C): khách mua "cho mình xin số chủ nhà đi" — đường đi là qua người phụ
// trách (FR-173), không đưa SĐT chủ nhà qua chat (DH-02). Bản trước chỉ nói "chưa có căn nào khớp".
const XIN_SO_CHU_RE = /\b(?:xin|cho|lay|gui|co|inbox)\b[^.?!]{0,25}\b(?:so|sdt|so dien thoai|zalo|lien he)\b[^.?!]{0,20}\b(?:chu nha|chu|nguoi ban|chinh chu|ben ban)\b|\bso\s+(?:dt\s+|dien thoai\s+)?(?:cua\s+)?chu\s*(?:nha)?\b|\blien he\s+(?:truc tiep\s+)?(?:voi\s+)?chu nha\b/;
const VOICE_RE_KD = /goi dien|goi (cho|lai) (em|anh|chi|toi|minh|tui)|\balo\b(?=[^.!?]*\b(?:duoc|dc|khong|ko|goi|nghe|may)\b)|\bvoice\b|\bcall\b|goi zalo|goi video|noi chuyen (dien thoai|qua dien thoai)|dien thoai cho (em|anh|chi|toi)|so (dien thoai|dt) (cua )?(em|be|ben em|ben minh|shop)/;
// Khách chấm sao sau buổi xem (FR-65): "4 sao", "3/5", "chấm 4", "5 điểm".
const SAO_RE_KD = /(?:^|[^\d])([1-5])\s*(?:sao\b|\/\s*5\b|diem\b)|cham\s*(?:cho\s*)?(?:em\s*)?([1-5])\b/;
// "Hiện thông báo cho người ta" (02/09): vừa gán nhãn thì nói thẳng cho họ
// nhãn gì và cách sửa nếu sai. FR-176 (07/09): BỎ biểu phí khỏi câu này —
// người ta vừa nhắn một câu rao, chưa hỏi gì mà nhận ngay một đoạn "1% giá
// chốt, 3/4 tháng tiền thuê" là giọng máy phát tờ rơi. Phí nói khi họ HỎI
// (FEE_RULES) và nhắc một câu lúc tin lên web. Admin vẫn nhận đủ nhãn + phí.
const cauNhan = (t: "ccrb" | "nmg") =>
  t === "nmg"
    ? "Em ghi nhận anh/chị là môi giới nha. Nếu là chính chủ thì nhắn em một tiếng để em sửa lại."
    : "Em ghi nhận anh/chị là chính chủ nha. Nếu là môi giới thì nhắn em một tiếng để em sửa lại.";

// FR-195: khoá nào nói về CẢ DỰ ÁN chứ không riêng một căn. Chủ nhà kể "toà này
// phí quản lý 16 nghìn/m2", "khu có hồ bơi tràn bờ", "bàn giao quý 2/2025" — đó
// là chuyện của dự án, tin sau của người khác trong cùng dự án cũng cần biết.
// Chép sang `project_facts` ở trạng thái CHỜ DUYỆT; ghi thẳng vào `projects` là
// một người nhớ nhầm thì cả kho sai theo (xem 20260910f).
/**
 * Tên dự án người ta vừa nhắc, dùng khi KHO CHƯA CÓ dự án đó (FR-195, 10/09).
 * Chỉ lấy phần sau chữ "dự án / khu / khu đô thị" và cắt ở dấu câu — không đoán
 * từ cả câu, vì đoán sai thì hàng chờ duyệt đầy rác và admin thôi nhìn nó.
 */
// Chữ mở đầu một MIÊU TẢ, không bao giờ mở đầu TÊN dự án. Bắt 10/09: câu "phí
// quản lý 14 nghìn/m2, khu có công viên ven sông" vào hàng chờ duyệt với tên dự
// án là "có công viên ven sông" — mồi dính chữ "khu" trần. Nay "khu" một mình
// không còn là mồi, và dù có khớp thì mấy chữ dưới đây cũng chặn lại.
const KHONG_PHAI_TEN = new Set([
  "có", "co", "gần", "gan", "này", "nay", "đó", "do", "đấy", "day", "kia",
  "bên", "là", "thì", "thi", "cũng", "cung", "rất", "rat",
  "nhiều", "nhieu", "được", "duoc", "vẫn", "đang", "dang", "sẽ", "se",
  "ở", "o", "trong", "ngoài", "ngoai", "nội", "toàn",
]);

// Bản KHÔNG DẤU của mấy chữ trên lại trùng chữ đầu của tên dự án THẬT: kho
// 1.639 dự án có LA ASTORIA, La Bonita, La Partenza, La Premier, La Maison De
// Cần Giờ, Van Phuc Riverside, Bến Cát Center City 2 — xếp thẳng "la"/"ben"/
// "van" vào danh sách cấm là bỏ sót đúng những cái tên kho CHƯA CÓ, tức đúng
// việc FR-195 sinh ra để làm. Nên chúng chỉ bị chặn khi chữ KẾ THEO viết
// thường ("dự án van phòng cho thuê", "dự án bên quận 7"); chữ kế viết hoa là
// dấu hiệu tên riêng ("dự án La Astoria") thì cho qua. Câu rao gõ toàn chữ
// thường vẫn bị chặn — thà thiếu một tên còn hơn đổ rác vào hàng chờ duyệt.
const MO_HO_KHONG_DAU = new Set(["la", "ben", "van", "noi", "toan"]);

function tenDuAnTrongCau(t: string): string | null {
  const m = /(?:dự án|du an|khu đô thị|khu do thi|khu dân cư|khu dan cu)\s+([\p{L}\p{N}'’.\- ]{3,45})/iu.exec(t);
  // Cắt luôn phần địa bàn dính đuôi: "Lam Sơn Riverside quận 4" → "Lam Sơn Riverside".
  const ten = (m?.[1]?.split(/[,.;\n]/)[0] ?? "")
    .replace(/\s+(quận|quan|phường|phuong|huyện|huyen|thành phố|tp)\b.*$/iu, "")
    .trim();
  const tu = ten.split(/\s+/);
  const dauTien = tu[0]?.toLowerCase() ?? "";
  if (KHONG_PHAI_TEN.has(dauTien)) return null;
  if (MO_HO_KHONG_DAU.has(dauTien) && !/^\p{Lu}/u.test(tu[1] ?? "")) return null;
  return ten.length >= 3 && tu.length <= 6 ? ten : null;
}

const KHOA_DU_AN = new Set([
  "phi_quan_ly", "phi_gui_xe", "tien_ich_gan", "ha_tang", "khu_compound",
  "thang_may", "pccc", "nam_xay", "xay_dung", "mat_do_xd", "tang_cao_toi_da",
  "so_huu", "thoi_han_su_dung", "gia_dien_nuoc",
]);

// NHỚ TẠM CẤU HÌNH 60 giây: bí mật cổng, trần lượt model/ngày và bảng
// `bot_prompts`. Trước bản này ba thứ đó là ba vòng đi về DB ở ĐẦU MỌI TIN
// (secret → Vault decrypt, prompts → select) cho những giá trị đổi vài lần
// một tháng. Hệ quả duy nhất: FR-138 "sửa prompt ở dashboard là bot đổi ngay
// lượt sau" thành "trong vòng một phút" — ghi rõ trong docs.
// Client Supabase KHÔNG nhớ tạm: dựng nó rẻ, và bộ e2e thay DB giả giữa các
// kịch bản bằng cách dựng client mới.
const NHO_TAM_MS = 60e3;
type CauHinh = {
  at: number; gate: string | null; gateLoi: string | null; cap: number; P: Record<string, string>;
  /** FR-180: mẫu câu chuẩn mới nhất theo phía (mau_cau_fewshot), rỗng khi chưa có. */
  mauBan: string; mauMua: string;
};
let nhoCauHinh: CauHinh | null = null;
async function napCauHinh(client: ReturnType<typeof serviceClient>): Promise<CauHinh> {
  if (nhoCauHinh && Date.now() - nhoCauHinh.at < NHO_TAM_MS) return nhoCauHinh;
  // FR-180: mẫu câu chuẩn (anh/sếp sửa tay ở /admin/mau-cau) đi cùng lượt nạp
  // — sửa xong, trong vòng một phút bot đã bắt chước. Lỗi RPC thì coi như
  // chưa có mẫu, ghi sổ, không chặn lượt trả lời.
  // 23/09/2026 (bắn 6 tin song song): một lượt đọc BRIDGE_SECRET hụt → `gate` null được NHỚ
  // cùng cả gói 60 s → mọi tin tới isolate đó trong một phút đều 503 (tin khách thật mất theo).
  // Nay: đọc hụt thì đọc lại ngay một lần; vẫn hụt/trống thì KHÔNG nhớ gói (lượt sau đọc lại) —
  // cùng luật `gate.ts`: nhớ tạm chỉ giữ giá trị ĐÚNG, không bao giờ nhớ cái hụt.
  const docCong = async () => {
    const r1 = await docBiMat(client, "BRIDGE_SECRET");
    return r1.loi ? await docBiMat(client, "BRIDGE_SECRET") : r1;
  };
  const [cong, capRaw, { data: promptRows }, mBan, mMua] = await Promise.all([
    docCong(),
    secretOf(client, "DAILY_MODEL_CALL_CAP"),
    client.from("bot_prompts").select("key, content"),
    client.rpc("mau_cau_fewshot", { p_phia: "ban", p_n: 12 }),
    client.rpc("mau_cau_fewshot", { p_phia: "mua", p_n: 12 }),
  ]);
  if (mBan.error) await ghiLoi(client, "chat-reply mau_cau_fewshot(ban)", mBan.error.message);
  if (mMua.error) await ghiLoi(client, "chat-reply mau_cau_fewshot(mua)", mMua.error.message);
  const gate = cong.giaTri;
  const goi: CauHinh = {
    at: Date.now(),
    gate,
    gateLoi: cong.loi,
    cap: Number(capRaw) > 0 ? Number(capRaw) : 1000,
    P: Object.fromEntries((promptRows ?? []).map((r) => [r.key, r.content])),
    mauBan: String(mBan.data ?? "").trim(),
    mauMua: String(mMua.data ?? "").trim(),
  };
  if (gate) nhoCauHinh = goi;
  return goi;
}
// Client model nhớ 5 phút: `anthropicClient` đọc khoá qua secretOf (Vault khi
// không có env) rồi `new Anthropic()` — mỗi tin một lần là thừa. Key đổi thì
// tối đa 5 phút sau isolate tự nạp lại; key HỎNG thì lượt gọi ném lỗi và đi
// đúng đường lưới đỡ như cũ (hàm này chỉ dựng client, không gọi mạng).
type ModelClient = Awaited<ReturnType<typeof anthropicClient>>;
let nhoModel: { at: number; client: ModelClient } | null = null;
async function napModel(client: ReturnType<typeof serviceClient>): Promise<ModelClient> {
  if (nhoModel && Date.now() - nhoModel.at < 5 * NHO_TAM_MS) return nhoModel.client;
  const c = await anthropicClient(client);
  nhoModel = { at: Date.now(), client: c };
  return c;
}
// FR-99 (v48): giá trung bình phường (triệu/m²) tính từ CHÍNH KHO — cùng
// deal + phường, tin đang lên kệ hoặc đã chốt, có giá số và diện tích. Một
// truy vấn gộp, nhớ tạm 60 s theo `deal|phường` ở tầng module như `bot_prompts`
// (FR-171 h): khách cùng phường trong một phút dùng chung một dòng. Không có
// đủ dữ liệu thì trả chuỗi rỗng — bot được dặn nói "chưa đủ dữ liệu để so".
// Đây là ước tính từ kho, KHÔNG phải thẩm định (OPEN-10 vẫn treo phần nguồn
// giá thị trường ngoài).
const nhoGiaTB = new Map<string, { at: number; line: string }>();
async function giaTBPhuong(
  client: ReturnType<typeof serviceClient>, deal: "ban" | "cho_thue", wardNum: string,
): Promise<string> {
  const key = `${deal}|${wardNum}`;
  const c = nhoGiaTB.get(key);
  if (c && Date.now() - c.at < NHO_TAM_MS) return c.line;
  const { data, error } = await client.from("listings").select("price_vnd, area_m2")
    .eq("deal", deal).ilike("ward", `Phường ${wardNum}`)
    .in("status", ["dang_ban", "dang_quan_tam", "da_chot"])
    .not("price_vnd", "is", null).not("area_m2", "is", null).limit(200);
  if (error) {
    await ghiLoi(client, "chat-reply gia tb phuong", error.message);
    return "";
  }
  const dv = (data ?? [])
    .map((r) => Number(r.price_vnd) / Number(r.area_m2))
    .filter((v) => Number.isFinite(v) && v > 0);
  const line = dv.length
    ? `giá TB phường ${wardNum} (${deal === "ban" ? "bán" : "thuê"}): ${
      Math.round(dv.reduce((a, b) => a + b, 0) / dv.length / 1e6)
    } tr/m² (${dv.length} tin)`
    : "";
  // Chỉ nhớ khi có số: phường chưa có tin nào là hiếm và truy vấn rẻ, còn nhớ
  // chuỗi rỗng là khoá luôn 60 s kể cả khi tin vừa lên kệ.
  if (line) nhoGiaTB.set(key, { at: Date.now(), line });
  return line;
}

// SEC-08 — danh sách host được phép cho `image_url`.
// Ảnh khách gửi qua Zalo luôn nằm trên CDN của Zalo. Mọi URL khác là URL do
// người gọi bịa: hoặc để hạ tầng model đi lấy hộ một địa chỉ nội bộ, hoặc để
// trỏ vào file khổng lồ cho treo hàm, hoặc để nhét một beacon vào
// `listing_facts` — bảng mà anon đọc được và trang tin hiển thị.
// Danh sách CHO PHÉP chứ không phải danh sách cấm: thứ không biết thì từ chối.
// Zalo phát ảnh qua nhiều tên miền CDN khác nhau; thiếu một cái là ảnh khách
// gửi bị chặn sạch mà bot vẫn trả lời tử tế — đúng kiểu hỏng im lặng. Bản đầu
// của danh sách này chỉ có `zadn.vn` và quên `zdn.vn`, bộ e2e bắt được ngay.
const HOST_ANH = [
  "zalo.me", "zadn.vn", "zdn.vn", "zaloapp.com", "zmdcdn.me", "zingmp3.vn",
];
function anhHopLe(url: string | null): string | null {
  if (!url) return null;
  if (url.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  const ok = HOST_ANH.some((d) => h === d || h.endsWith(`.${d}`));
  return ok ? url : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  // 14/09/2026: đồng hồ theo chặng — lượt đầu người mua chậm 10–12 s mà không ai biết
  // chậm ở đâu. Mốc (ms từ đầu lượt) đi kèm payload `_ms` và log; không đổi hành vi.
  const t0Luot = Date.now();
  const moc: Record<string, number> = {};
  const danhDau = (k: string) => { moc[k] = Date.now() - t0Luot; };
  // SEC-06 — chặn body khổng lồ TRƯỚC khi parse. Trần model đếm LƯỢT, nhưng
  // tiền tính theo TOKEN: một request kèm `text` 500 KB là ~125.000 token đầu
  // vào cho đúng một "lượt", nên trần 1000 lượt/ngày không giữ được ví. Cầu
  // chì cũ đặt đúng chỗ nhưng nhìn nhầm đại lượng.
  const cl = Number(req.headers.get("content-length") ?? 0);
  if (cl > 128 * 1024) return jsonResponse({ error: "payload_too_large" }, 413);
  const tho = await req.text();
  if (tho.length > 128 * 1024) return jsonResponse({ error: "payload_too_large" }, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(tho || "{}");
  } catch {
    return jsonResponse({ error: "body phải là JSON" }, 400);
  }

  const externalUserId = String(body.external_user_id ?? "").trim().slice(0, 128);
  // Chế độ test "hello" (20260909b): câu báo đã xoá, gửi kèm lượt trả lời đầu.
  let thongBaoNhanTest: string | null = null;
  // SEC-06 — cắt cứng ở cửa vào. 4.000 ký tự đã dài gấp nhiều lần câu rao dài
  // nhất từng thấy; cắt ở đây thay vì ở từng chỗ dùng, vì chuỗi này đi thẳng
  // vào prompt model.
  const text = String(body.text ?? "").trim().slice(0, 4000);
  const msgId = body.msg_id ? String(body.msg_id).slice(0, 200) : null;
  const channel = String(body.channel ?? "zalo_oa").slice(0, 40);
  // SEC-08 — chỉ nhận ảnh từ host của Zalo. Bản trước đưa URL thô của người
  // gọi thẳng vào `{type:"image", source:{type:"url"}}` của Anthropic: hạ tầng
  // của họ đi lấy hộ (SSRF gián tiếp, ký bằng khoá API của dự án), URL trỏ file
  // khổng lồ thì treo hàm và đốt token, và chuỗi đó còn được ghi vào
  // `listing_facts` — bảng anon đọc được — nên thành nội dung lạ đứng tên tin
  // của người khác.
  const imageUrl = anhHopLe(body.image_url ? String(body.image_url) : null);
  // `mark_sent` là cửa ghi sổ, không phải tin nhắn — nó không có người gửi lẫn
  // nội dung. Xử ở dưới, SAU cổng bí mật.
  if (!body.mark_sent && (!externalUserId || (!text && !imageUrl))) {
    return jsonResponse({ error: "external_user_id và text (hoặc image_url) bắt buộc" }, 400);
  }
  const textOrTag = text || "[khách gửi ảnh]";

  // FR-161: người ta gõ LẪN dấu suốt — "ban nha q5 giá 5 ty" có đúng một chữ
  // có dấu. Bản trước dò một cờ "câu này có dấu không" (bật khi câu chứa BẤT KỲ
  // ký tự có dấu nào) rồi chọn MỘT bộ regex theo cờ đó, nên câu lẫn dấu bị dồn
  // hết vào bộ CÓ DẤU và "ban", "nha" không khớp "bán", "nhà" — câu rơi im
  // lặng. Cờ đó nay bỏ hẳn: giữ lại là mời người sau dùng lại đúng cái bẫy.
  // `khop` thử CẢ HAI rồi lấy hợp: bộ không dấu chạy trên `tKD` (đã bỏ dấu)
  // nên phủ luôn câu gõ đủ dấu, bộ có dấu giữ cụm chỉ đúng khi có dấu. Chỉ nới
  // thêm, không bỏ mất khớp nào. Model vẫn nhận `text` gốc.
  // 11/09/2026 (42 ca): câu gõ bằng giọng nói đọc số bằng chữ ("quận năm, năm
  // mươi mét vuông, bốn tỷ rưỡi") → đổi sang chữ số TRƯỚC khi dò. Chỉ dùng để DÒ
  // và BÓC; câu lưu vào sổ và câu đưa model vẫn là `text` gốc.
  const textBoc = soChuThanhSo(text);
  const tKD = boDau(textBoc);
  const khop = (coDau: RegExp, khongDau: RegExp) =>
    coDau.test(text) || khongDau.test(tKD);

  const client = serviceClient();

  // ─── CỔNG 1: bí mật dùng chung (tuỳ chọn, cùng khuôn với escalation-feed).
  // chat-reply KHÔNG phải endpoint công khai: chỉ bridge (máy local) và
  // zalo-webhook (server-to-server) gọi nó, không trình duyệt nào cả. Nhưng nó
  // đang mở cho bất kỳ ai cầm anon key — mà anon key nằm sẵn trong bundle JS
  // của web VÀ trong bot/bridge-zca/index.mjs của repo PUBLIC này.
  // BA ĐƯỜNG VÀO, không hơn: (1) service_role key ở header `authorization` —
  // đường của zalo-webhook, luôn qua; (2) `x-bridge-secret` khớp BRIDGE_SECRET
  // trong Vault — đường của bridge; (3) không có gì cả → KHÔNG QUA.
  // Câu cũ ở đây nói "chưa đặt secret thì chạy như cũ, không làm gãy bridge" —
  // đó chính là chỗ hỏng SEC-02 đã vá bên dưới; giữ lại câu đó thì lần sau có
  // người đọc comment rồi sửa code cho khớp comment, và cửa mở lại.
  // FR-171 h: bí mật cổng + trần lượt + bot_prompts đi chung một lượt nạp,
  // nhớ tạm 60 giây ở tầng module (xem `napCauHinh`).
  const { gate, gateLoi, cap: dailyCap, P, mauBan, mauMua } = await napCauHinh(client);
  danhDau("cau_hinh");
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  // SEC-11: so hằng thời gian cả hai đường (service key và bí mật cổng).
  const isService = !!svcKey && auth.startsWith("Bearer ") &&
    await bangNhau(auth.slice(7), svcKey);

  // SEC-02 — FAIL-CLOSED. Bản trước: `if (gate && …)` nghĩa là `gate` rỗng thì
  // BỎ QUA cổng hoàn toàn, chỉ ghi một dòng sổ. Mà `gate` rỗng xảy ra không chỉ
  // khi chưa đặt secret: Vault lỗi, DB quá tải, timeout, hết kết nối — đều cho
  // ra `null`. Kẻ tấn công không cần gây sự cố, chỉ cần thăm dò mỗi phút và đợi
  // đúng khoảnh khắc DB nghẹn. Ghi sổ vẫn xảy ra, nhưng là ghi SAU KHI cho qua.
  if (!isService) {
    if (!gate) {
      if (Deno.env.get("GATE_MO_KHI_CHUA_CO_BI_MAT") !== "1") {
        await ghiLoi(client, "chat-reply CONG DONG",
          (gateLoi ? `Đọc BRIDGE_SECRET hụt hai lần (${gateLoi}) - TỪ CHỐI. ` : "Không có BRIDGE_SECRET (chưa đặt) - TỪ CHỐI. ") +
          "Đặt secret vào " +
          "Vault, hoặc bật tạm GATE_MO_KHI_CHUA_CO_BI_MAT=1 nếu cố ý chạy không cổng.");
        return jsonResponse({ error: "gate_unavailable" }, 503);
      }
      await ghiLoi(client, "chat-reply CONG MO",
        "GATE_MO_KHI_CHUA_CO_BI_MAT=1 - cổng đang MỞ có chủ ý, ai cũng gọi được.");
    } else if (!await bangNhau(req.headers.get("x-bridge-secret") ?? "", gate)) {
      return jsonResponse({ error: "forbidden" }, 403);
    }
  }

  // FR-162 — CỬA GHI NHẬN ĐÃ GỬI, cho người gọi không cầm service key.
  // `zalo-webhook` có service key nên tự ghi `sent_bubbles`/`sent_at` vào sổ.
  // Bridge (máy local) chỉ có publishable key + bí mật cổng, không đụng bảng
  // được — nên bên kênh `zalo_personal_test`, `sent_at` KHÔNG BAO GIỜ được ghi
  // và `already_sent` vĩnh viễn false. Tức cờ chống-gửi-đúp của FR-162 là chữ
  // chết ở đúng cái kênh đang chạy thật: một `msg_id` giao hai lần — hai lượt
  // thả tim cùng map về `react-<tid>-<gMsgID>` — là khách nhận lại nguyên loạt
  // bong bóng. Cửa này trả cho bridge đúng nửa còn thiếu.
  if (body.mark_sent) {
    const soDaGui = Number(body.sent_bubbles ?? 0);
    const xong = body.done !== false;
    // SEC-13 — RÀNG hai điều kiện. Bản trước cho phép đặt `sent_at` lên BẤT KỲ
    // `zalo_msg_id` nào: đánh dấu "đã gửi" cho các tin thật chưa gửi là câu trả
    // lời không bao giờ tới khách (luật chống-gửi-đúp FR-162 nuốt nó), mà mọi
    // mã HTTP trên đường đều 200 — đúng loại hỏng im lặng nhất.
    //   · `.is("sent_at", null)` — không đụng được dòng ĐÃ chốt gửi.
    //   · dòng phải mới trong 15 phút — bridge chỉ chốt việc nó vừa làm; không
    //     ai có lý do chính đáng để chốt một tin của hôm qua.
    const cat = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: dong, error: msErr } = await client.from("inbound_ledger").update({
      sent_bubbles: Number.isFinite(soDaGui) ? soDaGui : 0,
      ...(xong
        ? { sent_at: new Date().toISOString(), send_error: null }
        : { send_error: "gửi hụt giữa chừng - bridge báo lại" }),
      updated_at: new Date().toISOString(),
    })
      .eq("zalo_msg_id", String(body.mark_sent).slice(0, 200))
      .is("sent_at", null)
      .gte("created_at", cat)
      .select("zalo_msg_id");
    if (msErr) await ghiLoi(client, "chat-reply mark_sent", msErr.message);
    const dungDong = (dong?.length ?? 0) > 0;
    if (!msErr && !dungDong) {
      await ghiLoi(client, "chat-reply mark_sent tu choi",
        `không có dòng hợp lệ cho msg_id=${String(body.mark_sent).slice(0, 60)} ` +
        "(đã chốt gửi rồi, hoặc quá 15 phút, hoặc không tồn tại)");
    }
    return jsonResponse({ ok: !msErr && dungDong, marked: String(body.mark_sent), done: xong });
  }

  // CHẾ ĐỘ TEST (20260909b, chủ dự án 09/09/2026): ai nhắn đúng chữ "hello" là
  // xoá sạch dữ liệu số Zalo đó rồi tiếp đón như khách mới. Đứng SAU cổng bí
  // mật (người lạ không xoá được ai), TRƯỚC mọi lượt tra vai. Công tắc
  // `app_config.test_reset_hello` đọc mỗi lần gặp "hello" — không cache, tắt là
  // hết ngay. Chạy thật phải đặt 0: khách thật chào "hello" mà mất tin là sự cố.
  if (!body.human_note && /^\s*hello\s*[.!]*\s*$/i.test(text)) {
    const { data: congTac } = await client.rpc("cau_hinh", { p_key: "test_reset_hello" });
    if (String(congTac ?? "") === "1") {
      const { data: daXoa, error: xoaErr } = await client.rpc("reset_nguoi_test", { p_zalo: externalUserId });
      if (xoaErr) await ghiLoi(client, "chat-reply reset_nguoi_test", xoaErr.message);
      else console.log(`TEST reset "hello" ${externalUserId.slice(-4)}: ${JSON.stringify(daXoa)}`);
      thongBaoNhanTest = daXoa ? `(TEST) Em đã xoá dữ liệu cũ của mình: ${(daXoa as { listings?: number }).listings ?? 0} tin, ${(daXoa as { messages?: number }).messages ?? 0} tin nhắn. Bắt đầu lại như khách mới nha.` : null;
    }
  }

  // FR-141: bridge báo NGƯỜI THẬT (CTV/admin gõ tay từ acc clone) vừa nhắn cho
  // khách này → ghi tin sender='human' + đặt human_touch_at; bot nhường sân
  // 30 phút, hết yên ắng thì tự tiếp sức lại như thường.
  //
  // Tin gõ tay KHÔNG mang theo vai, mà một Zalo có thể vừa bán vừa mua
  // (OPEN-22/FR-157). Trước bản này `if (!hSeller)` bỏ qua SẠCH người bán —
  // tức `human_touch_at` không bao giờ được đặt trên hội thoại người bán, nên
  // cổng nhường sân bên nhánh seller là code chết: CTV đang thương lượng với
  // chủ nhà mà chủ nhắn tiếp thì bot vẫn chen ngang. Giờ đóng cổng ở MỌI hội
  // thoại đang có của người này.
  if (body.human_note) {
    const now141 = new Date().toISOString();
    const cham: string[] = [];
    const chamVao = async (convId: string, vai: string) => {
      const { error: hErr } = await client.from("messages").insert({
        conversation_id: convId, sender: "human", body: text,
      });
      if (hErr) await ghiLoi(client, `chat-reply human_note messages(${vai})`, hErr.message);
      // FR-147: người thật đã vào tay → hạ cờ cần-người-thật, khỏi leo lên admin
      await client.from("conversations").update({
        human_touch_at: now141, last_message_at: now141, needs_human: false,
      }).eq("id", convId);
      cham.push(vai);
    };

    const { data: hSeller } = await client.from("sellers").select("id")
      .eq("zalo_user_id", externalUserId).maybeSingle();

    if (hSeller) {
      const { data: hsc, error: hscErr } = await client
        .rpc("ensure_seller_conversation", {
          p_seller_id: hSeller.id, p_channel: channel,
        }).single();
      const hsConvId = (hsc as { c_id?: string } | null)?.c_id ?? null;
      if (hscErr || !hsConvId) {
        await ghiLoi(client, "chat-reply human_note ensure_seller_conversation",
          hscErr?.message ?? "không trả về c_id");
      } else {
        await chamVao(hsConvId, "seller");
      }

      // Người đang bán VẪN có thể đang có hội thoại mua (FR-157) — cổng phải
      // phủ luôn nhánh đó. Nhưng chỉ đụng hội thoại ĐÃ CÓ: tạo mới buyer cho
      // một người đang bán là bịa ra một đơn khách không tồn tại.
      const { data: hBuyer } = await client.from("buyers").select("id")
        .eq("zalo_user_id", externalUserId).maybeSingle();
      if (hBuyer) {
        const { data: hbConv } = await client.from("conversations").select("id")
          .eq("buyer_id", hBuyer.id).order("started_at", { ascending: false })
          .limit(1).maybeSingle();
        if (hbConv) {
          await chamVao(hbConv.id, "buyer");
          await client.from("reminders").update({ status: "cancelled" })
            .eq("buyer_id", hBuyer.id).eq("kind", "escalation").eq("status", "pending");
        }
      }
    } else {
      const { data: hbc, error: hbcErr } = await client.rpc("ensure_buyer_conversation", {
        p_zalo_user_id: externalUserId, p_channel: channel,
      }).single();
      const hConvId = (hbc as { c_id?: string } | null)?.c_id ?? null;
      const hBuyerId = (hbc as { b_id?: string } | null)?.b_id ?? null;
      if (hbcErr || !hConvId) {
        await ghiLoi(client, "chat-reply human_note ensure_buyer_conversation",
          hbcErr?.message ?? "không trả về c_id");
      } else {
        await chamVao(hConvId, "buyer");
        if (hBuyerId) {
          await client.from("reminders").update({ status: "cancelled" })
            .eq("buyer_id", hBuyerId).eq("kind", "escalation").eq("status", "pending");
        }
      }
    }
    return jsonResponse({ ok: true, human_note: true, cham });
  }

  // ─── SỔ INBOUND (FR-162): mỗi zalo_msg_id là MỘT vòng đời xử lý
  // received → processing → completed/failed, lưu nguyên payload trả lời.
  // Đứng TRƯỚC cổng quota là cố ý: tin duplicate không được đốt lượt model.
  //   * completed → PHÁT LẠI payload đã lưu. Kênh gửi hụt (Zalo lỗi, bridge
  //     timeout) cứ gọi lại cùng msg_id là lấy lại được câu trả lời — retry
  //     outbound không cần chạy lại AI.
  //   * in_flight → bản sao thứ hai của cùng tin đang được lượt khác xử lý
  //     NGAY LÚC NÀY (race hai bản sao). Đứng ngoài, không xử lý đôi; bridge
  //     thấy cờ này thì chờ rồi hỏi lại.
  //   * claimed  → làm như thường. r_attempts > 1 nghĩa là lượt trước
  //     failed/chết giữa chừng — tin có thể ĐÃ nằm trong `messages`, nên 23505
  //     ở dưới không được nuốt nữa mà phải đi tiếp trả lời nốt.
  // Sổ hỏng (RPC lỗi) thì chạy như cũ — unique index messages.zalo_msg_id vẫn
  // là lưới đỡ cuối — nhưng phải vào bot_errors (FR-152).
  let coSo = false;      // lượt này có cầm sổ không
  let soAttempts = 1;    // lần thử thứ mấy của msg_id này
  if (msgId) {
    const { data: so, error: soErr } = await client
      .rpc("claim_inbound", { p_msg_id: msgId }).single();
    // Kiểu phải khớp RETURNS TABLE của `claim_inbound` — thiếu `r_dead` thì
    // `deno check` kêu TS2339 ở nhánh "đã chết 8 lượt" (bật kiểm kiểu 11/09).
    const soRow = so as {
      r_state?: string; r_reply?: Record<string, unknown> | null; r_attempts?: number;
      r_sent_at?: string | null; r_dead?: boolean;
    } | null;
    if (soErr || !soRow?.r_state) {
      await ghiLoi(client, "chat-reply claim_inbound",
        soErr?.message ?? "không trả về r_state");
    } else if (soRow.r_state === "completed") {
      // `already_sent` = lần trước MỌI bong bóng đã tới Zalo (webhook ghi
      // sent_at). Kênh dựa vào cờ này để exactly-once chiều gửi: provider giao
      // trùng thì im (khách không nhận đúp), gửi hụt lần trước thì gửi lại.
      return jsonResponse({
        reply: null, replies: [], ...(soRow.r_reply ?? {}),
        deduped: true, replayed: true, already_sent: !!soRow.r_sent_at,
      });
    } else if (soRow.r_state === "in_flight") {
      return jsonResponse({ reply: null, replies: [], deduped: true, in_flight: true });
    } else if (soRow.r_state === "dead" || soRow.r_dead) {
      // FR-166 bất biến 7: đã hỏng đủ 8 lượt, ĐỪNG THỬ NỮA. Trước bản này
      // `dead` rơi tuột vào nhánh `else` bên dưới và được xử như việc mới:
      //   * đốt một lượt gọi model đầy đủ cho một dòng đã bị bỏ,
      //   * `baoHong` sau đó va guard `inbound_ledger_giu_completed` nên không
      //     ghi được gì — hỏng im lặng,
      //   * và vì nhánh này KHÔNG cầm hợp đồng thuê, hai lượt giao cùng lúc của
      //     cùng msg_id đều chạy tới cuối và ĐỀU GỬI, phá đúng cái bất biến
      //     exactly-once mà cả FR-162 dựng lên để giữ.
      // Không giành sổ (`coSo` giữ false) nên mọi đường ra phía sau không đụng
      // vào dòng thư chết nữa.
      await ghiLoi(client, "chat-reply dead",
        `msg_id ${msgId} đã ở thư chết sau ${soRow.r_attempts ?? "?"} lượt - bỏ qua, ` +
          `không gọi model. Xem /admin để xử tay.`);
      return jsonResponse({
        reply: null, replies: [], deduped: true, dead: true,
        already_sent: !!soRow.r_sent_at,
      });
    } else {
      coSo = true;
      soAttempts = soRow.r_attempts ?? 1;
    }
  }
  // MỌI đường ra phía sau phải đi qua một trong hai cửa này, để sổ không bao
  // giờ kẹt ở processing oan (kẹt thật — function chết — thì claim_inbound tự
  // reclaim sau 150s). Ghi sổ hụt không được chặn đường trả lời: chỉ ghiLoi.
  const hoanTatGoc = async (payload: Record<string, unknown>, code = 200) => {
    moc.tong = Date.now() - t0Luot;
    payload = { ...payload, _ms: { ...moc } };
    console.log("chat-reply _ms", JSON.stringify(moc));
    if (coSo) {
      const { error: soErr2 } = await client.from("inbound_ledger").update({
        status: "completed", reply: payload, updated_at: new Date().toISOString(),
      }).eq("zalo_msg_id", msgId);
      if (soErr2) await ghiLoi(client, "chat-reply hoanTat ledger", soErr2.message);
    }
    return jsonResponse(payload, code);
  };
  // 20260909b: câu "(TEST) Em đã xoá…" đi kèm lượt trả lời đầu sau khi reset.
  const hoanTat = async (payload: Record<string, unknown>, code = 200) => {
    if (thongBaoNhanTest && Array.isArray(payload.replies)) {
      const replies = [thongBaoNhanTest, ...(payload.replies as string[])];
      payload = { ...payload, replies, reply: replies.join("\n"), test_reset: true };
      thongBaoNhanTest = null;
    }
    return await hoanTatGoc(payload, code);
  };
  const baoHong = async (payload: Record<string, unknown>, code: number, detail: string) => {
    if (coSo) {
      // FR-166: PHẢI đi qua `bao_hong_inbound`, đừng ghi thẳng `status='failed'`.
      // Hàm đó mới là chỗ đặt `next_retry_at = now() + lan_thu_ke(attempts)` và
      // tự chuyển thư chết ở lượt thứ 8. Ghi tay như trước là bỏ mất giờ hẹn:
      // `inbound-sweep` quét `failed` với `next_retry_at` NULL thì coi là tới
      // giờ NGAY, nên nó cứu lại mỗi phút một lượt — một tin gặp lỗi hết hạn
      // mức (quota) đốt sạch 8 lượt trong 8 phút rồi nằm `dead` vĩnh viễn,
      // đúng ngược lại lời hứa "lùi dần" ghi trong chính comment cũ.
      // Hàm này cũng tự né dòng đã `completed` (guard FR-163), nên không cần
      // kiểm trước ở đây.
      const { error: soErr3 } = await client.rpc("bao_hong_inbound", {
        p_msg_id: msgId, p_detail: detail.slice(0, 500),
      });
      if (soErr3) await ghiLoi(client, "chat-reply baoHong ledger", soErr3.message);
    }
    return jsonResponse(payload, code);
  };

  // FR-217 (23/09/2026): lệnh TEST "/json" — in thứ bot đã lưu cho chính người nhắn (cột, fact, bóc tách, văn bản
  // đã nhúng vector). Công tắc riêng `app_config.lenh_json` (bat | tat, 20260923f); tắt thì "/json" đi như tin thường. Không gọi model,
  // không tính trần lượt, không ghi vào hội thoại.
  if (!body.human_note && /^\s*\/json\s*$/i.test(text)) {
    const { data: congTacJ } = await client.rpc("cau_hinh", { p_key: "lenh_json" });
    if (String(congTacJ ?? "").trim() === "bat") {
      try {
        const bong = await soanLenhJson(client, externalUserId);
        return await hoanTat({ reply: bong.join("\n"), replies: bong, lenh_json: true });
      } catch (e) {
        await ghiLoi(client, "chat-reply lenh /json", e);
        const loi = "(TEST /json) Em đọc dữ liệu bị lỗi, đã ghi sổ ạ.";
        return await hoanTat({ reply: loi, replies: [loi], lenh_json: true });
      }
    }
  }

  // ─── CỔNG 2a: trần THEO TỪNG NGƯỜI (SEC-05, migration 20260905d).
  // Trần toàn cục bên dưới chặn được ví nhưng KHÔNG chặn được kẻ phá: gửi 1000
  // request rác trong vài phút là bot im với tất cả mọi người tới nửa đêm —
  // cầu chì giữ tiền hoá ra là nút tắt dịch vụ ai cũng bấm được.
  //
  // Bình luận cũ ở đây nói đếm theo `external_user_id` là vô nghĩa vì chuỗi đó
  // người gọi tự đặt. ĐÚNG khi webhook chưa kiểm chữ ký. Sau SEC-01 thì
  // `sender.id` do Zalo ký, không bịa được, nên đếm theo uid mới có nghĩa.
  // 30 lượt/giờ và 120 lượt/ngày cho uid lạ, nới gấp 4 cho người đã quen
  // (có trong sellers/ctvs/admins) — chủ nhà rao một căn nhắn hàng chục lượt
  // liền là chuyện thường, chặn nhầm họ là hỏng việc thật.
  const { data: duoiTranNguoi } = await client.rpc("bump_user_quota", { p_uid: externalUserId });
  if (duoiTranNguoi === false) {
    // Im với RIÊNG người này; những người khác không bị ảnh hưởng.
    return await baoHong(
      { reply: null, replies: [], user_quota_exceeded: true }, 429, "trần cá nhân đã chạm",
    );
  }

  // ─── CỔNG 2b: trần TOÀN CỤC lượt gọi model mỗi ngày.
  // Giữ nguyên làm chốt chặn cuối về TIỀN: trần cá nhân chặn một kẻ, trần này
  // chặn một nghìn kẻ. Chỉnh bằng secret DAILY_MODEL_CALL_CAP trong Vault;
  // mặc định 1000/ngày (đọc kèm cấu hình ở đầu hàm, nhớ tạm 60 giây).
  const { data: underQuota } = await client.rpc("bump_model_quota", { p_limit: dailyCap });
  if (underQuota === false) {
    // Im lặng hoàn toàn: trả lời thì vẫn tốn lượt model, mà đây đúng là thứ
    // đang cần chặn. bump_model_quota đã báo admin đúng một lần trong ngày.
    // Sổ ghi failed chứ không completed: sang ngày quota reset, kênh gửi lại
    // cùng msg_id thì tin ĐƯỢC xử lý thật chứ không bị phát lại cái rỗng.
    return await baoHong(
      { reply: null, replies: [], quota_exceeded: true }, 429, "quota ngày đã chạm trần",
    );
  }

  // Qua hết các cổng — từ đây là xử lý thật. Sổ đã ở `processing` từ lúc
  // `claim_inbound` (hàm DB đặt trạng thái đó ngay khi giành được sổ), nên
  // không còn câu UPDATE riêng ở đây nữa (FR-171 h); trượt trần quota ở trên
  // thì `baoHong` ghi đè bằng `failed` như cũ.

  // FR-138: "não" cấu hình được từ dashboard — bảng bot_prompts đè lên mặc định
  // trong prompts.ts. Chủ dự án sửa content ở Table Editor là bot đổi trong
  // vòng một phút (nhớ tạm `napCauHinh`), không cần deploy. Không có dòng nào
  // thì dùng bản trong code.
  // FR-181 (09/09/2026 chiều): MỖI KHÁCH MỘT TÊN TRỢ LÝ, gán tất định theo Zalo
  // ID và giữ suốt (T•ai, Kh•ai, M•ai…). Prompt/lời chào viết "{ten}", điền ở đây.
  const tenBot = tenTroLy(externalUserId);
  // 14/09/2026 (đo thật): khối system được NHỚ TẠM mà lại chứa tên trợ lý riêng của
  // từng khách (20 tên •ai) → mỗi khách một bản, lượt nào cũng `cache_read 0`,
  // `cache_write 16.058` token: model đọc lại 16 nghìn token mỗi lượt (chậm) và trả
  // tiền GHI nhớ tạm (2 lần giá) mà không bao giờ được đọc lại. Khối nhớ tạm nay
  // dùng chữ giữ chỗ chung; tên thật đi ở phần KHÔNG nhớ tạm (`DONG_TEN`).
  const TEN_GIU_CHO = "«tên em»";
  const DONG_TEN = `TÊN EM trong cuộc trò chuyện này là "${tenBot}" — chỗ nào ở trên ghi ${TEN_GIU_CHO} thì là tên này; không đổi, không xưng tên khác.`;
  const TONE = dienTen(P.tone_rules ?? TONE_RULES, TEN_GIU_CHO);
  // 09/09/2026: câu hỏi mẫu + lời chào khách mới đọc từ bot_prompts (đè lên code).
  const { bang: BANG_CAU, loi: loiCauMau } = docCauHoiMau(P.cau_hoi_mau);
  // FR-138 b (10/09): chữ TIỀN ĐỊNH cũng sửa được ở Dashboard — chủ dự án:
  // "chuyển mấy câu đó vào bot_prompts luôn đi để tao còn kiểm soát".
  const { bang: CAU_TD, loi: loiCauTD } = docCauTienDinh(P.cau_tien_dinh);
  if (loiCauTD) await ghiLoi(client, "bot_prompts.cau_tien_dinh hỏng JSON", loiCauTD);
  if (loiCauMau) await ghiLoi(client, "chat-reply bot_prompts.cau_hoi_mau JSON", loiCauMau);
  // FR-186: câu riêng theo loại BĐS ("huong@chung_cu") — truyền `loai` khi biết.
  // 13/09/2026: tin ở HUYỆN / thị xã / tỉnh lân cận thì hỏi XÃ, ở MỌI lượt — bản
  // trước chỉ đổi ở câu hỏi đầu, lượt sau vẫn "Nhà mình ở phường nào" cho đất Củ Chi.
  // 14/09/2026: câu "gấp" của tin CHO THUÊ khác tin bán — truyền `deal` khi biết.
  // 17/09/2026 (chủ dự án): hỏi phường khi tin ĐÃ có địa chỉ thì nhắc địa chỉ đó, ngắn:
  // "Hẻm 4m Trần Hưng Đạo đó phường mấy cô nhỉ?" — truyền `diaChi` khi biết.
  const cauHoiMau = (k: string, ac: string, loai?: string | null, quan?: string | null, deal?: string | null, diaChi?: string | null) =>
    k === "phuong" && diaChi && !laNgoaiDoThi(quan)
      ? cauPhuongNgan(diaChi, ac)
      : cauHoiMauGoc(
        k === "phuong" && laNgoaiDoThi(quan) ? "phuong@huyen" : k === "gap" && deal === "cho_thue" ? "gap@cho_thue"
          : k === "do_rong_hem" && laSoNhaHem(diaChi) ? "do_rong_hem@so_nha_hem" : k,
        ac, BANG_CAU, loai,
      );
  const LOI_CHAO_DB = dienTen((P.loi_chao ?? LOI_CHAO).trim(), tenBot);
  const HUMAN = P.human_chat_rules ?? HUMAN_CHAT_RULES;
  const FEES = P.fee_rules ?? FEE_RULES;
  const SELLER_SCRIPT = P.seller_script_rules ?? SELLER_SCRIPT_RULES;
  const SLANG = P.slang_notes ?? SLANG_NOTES;
  // FR-180: mẫu chuẩn thật (nếu có) nối sau few-shot soạn tay, cả hai phía.
  const MAU_CHUAN_TD = "Ví dụ CHUẨN do anh/sếp sửa tay từ hội thoại thật (FR-180) - ưu tiên bắt chước giọng này hơn mọi ví dụ khác:";
  const FEWSHOT = (P.buyer_fewshot ?? BUYER_FEWSHOT) + (mauMua ? "\n\n" + MAU_CHUAN_TD + "\n" + mauMua : "");
  const AGREE = P.agree_rules ?? AGREE_RULES;
  // MỘT prefix cho cả ba lượt gọi phía người bán (FR-171 h). Bản cũ r1/r2 dùng
  // TONE+SELLER_SCRIPT còn r3 thêm FEES → hai ô nhớ tạm khác nhau cho một
  // nhánh vốn thưa lượt, gần như luôn trượt và mỗi lần trượt trả 1,25 giá.
  // 170 chữ-máy FEES thừa ở r1/r2 rẻ hơn hẳn một ô nhớ tạm riêng.
  // FR-178: few-shot người bán (giọng AI Ơi Nhà Đất + kịch bản sếp) đi cùng luật.
  const SELLER_FEW = dienTen(P.seller_fewshot ?? SELLER_FEWSHOT, TEN_GIU_CHO) + (mauBan ? "\n\n" + MAU_CHUAN_TD + "\n" + mauBan : "");
  const SELLER_SYSTEM = TONE + "\n\n" + SELLER_SCRIPT + "\n\n" + SELLER_FEW + "\n\n" + FEES;

  // ─── FR-173 d: NGƯỜI NỘI BỘ (CTV/admin) nhắn "#mã tin: câu trả lời" ──────────
  // Câu khách hỏi đi về CTV (quyết định 03/09/2026); CTV hỏi chủ xong nhắn lại
  // bot theo mẫu này → ghi fact nguồn `ctv`/`admin`, đóng câu hỏi, trigger DB
  // `info_request_bao_lai_khach` báo lại khách. Chỉ tra `nguoi_noi_bo` khi tin
  // MỞ ĐẦU bằng mã tin, nên người mua hỏi "#BDS-… còn không em" chỉ tốn thêm
  // đúng một lượt RPC rồi rơi xuống nhánh mua như thường (FR-171 h).
  const noiBo = text.match(/^\s*#?\s*(BDS-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d+)\s*[:\-–]?\s*([\s\S]+)$/i);
  if (noiBo) {
    const { data: nb } = await client.rpc("nguoi_noi_bo", { p_zalo: externalUserId }).maybeSingle();
    const vai = (nb as { vai?: string; id?: string | null; name?: string | null } | null)?.vai ?? null;
    if (vai) {
      const maTin = noiBo[1].toUpperCase();
      const traLoi = noiBo[2].trim();
      const { data: lst } = await client.from("listings").select("id, seller_id")
        .or(`code.ilike.${maTin},legacy_code.ilike.${maTin}`).limit(1).maybeSingle();
      if (!lst) {
        const khong = `Em không thấy tin #${maTin} trong kho ạ, anh/chị xem lại mã giúp em.`;
        return await hoanTat({ reply: khong, replies: [khong], noi_bo: vai });
      }
      // FR-189 (chat Gemini 21/06 lượt 33, chủ dự án 10/09/2026): NGƯỜI THẬT CƯỚP
      // QUYỀN / TRẢ LẠI BOT bằng lệnh — "#mã giữ" → bot im với chủ căn đó tới khi
      // "#mã trả bot". Cột `conversations.human_hold`; nhãn ở /admin/tin-nhan.
      const lenhGiu = /^(giu|giữ|giu khach|giữ khách|cuop|cướp|takeover|take over)\s*$/i.test(traLoi);
      const lenhTra = /^(tra|trả|tra bot|trả bot|tha|thả|release|tra lai|trả lại)\s*$/i.test(traLoi);
      if ((lenhGiu || lenhTra) && lst.seller_id) {
        // Chủ căn chưa có hội thoại (mở hồ sơ bằng form admin) thì tạo trước rồi giữ.
        await client.rpc("ensure_seller_conversation", { p_seller_id: lst.seller_id, p_channel: channel });
        const { error: gErr } = await client.from("conversations")
          .update({ human_hold: lenhGiu, ...(lenhGiu ? { needs_human: false, human_touch_at: new Date().toISOString() } : {}) })
          .eq("seller_id", lst.seller_id);
        if (gErr) await ghiLoi(client, "chat-reply human_hold", gErr.message);
        const rep = lenhGiu
          ? `Em im với chủ căn #${maTin} rồi ạ, anh/chị nói chuyện trực tiếp nha. Xong thì nhắn "#${maTin} trả bot" để em tiếp tục.`
          : `Em tiếp tục chăm chủ căn #${maTin} rồi ạ.`;
        return await hoanTat({ reply: rep, replies: [rep], noi_bo: vai, human_hold: lenhGiu });
      }
      // Câu khách hỏi CŨ NHẤT đang chờ của căn này là câu được trả lời; không
      // có câu nào thì vẫn ghi làm fact bổ sung (CTV đi hỏi rồi, đừng bỏ).
      const { data: pend } = await client.from("info_requests").select("id, question")
        .eq("listing_id", lst.id).eq("status", "pending").eq("source", "buyer_ask")
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      const { error: fErr } = await client.rpc("ghi_fact_listing", {
        p_listing_id: lst.id, p_question: pend?.question ?? "bo_sung",
        p_answer: traLoi, p_source: vai,
      });
      if (fErr) await ghiLoi(client, "chat-reply ghi_fact_listing(noi_bo)", fErr.message);
      if (pend) {
        const { error: uErr } = await client.from("info_requests").update({
          status: "answered", answer: traLoi, answered_at: new Date().toISOString(),
        }).eq("id", pend.id);
        if (uErr) await ghiLoi(client, "chat-reply info_requests answered(noi_bo)", uErr.message);
      }
      const rep = pend
        ? `Em ghi nhận rồi ạ, em báo lại khách hỏi #${maTin} liền.`
        : `Em ghi vào tin #${maTin} rồi ạ, hiện không có câu khách nào đang chờ căn này.`;
      return await hoanTat({ reply: rep, replies: [rep], noi_bo: vai, answered: !!pend });
    }
  }

  // NGƯỜI BÁN nhắn? (FR-129 — hỏi nhỏ giọt): nếu khớp sellers.zalo_user_id và
  // đang có câu hỏi chờ, coi tin nhắn là CÂU TRẢ LỜI → lưu fact, hỏi câu kế.
  // Hồ sơ bán và cờ hỏi-vai bên mua đọc CÙNG LÚC (FR-171 h): hai truy vấn độc
  // lập, trước đây nối đuôi nhau; tốn thêm một câu nhẹ khi là người bán, đổi
  // lại mọi người mua bớt một vòng.
  type SellerRow = {
    id: string; name: string | null; active_listing_id: string | null;
    seller_type?: string | null;
    xung_ho?: XungHo | null; // FR-176: chủ nhà dặn gọi anh/chị/chú/cô/bác (16/09: thêm ba từ lớn tuổi)
    nhom_tuoi?: "tre" | "lon_tuoi" | null; // 22/09: "chào cháu" → lớn tuổi dù chưa biết chú hay cô
    ten_tro_ly?: string | null;      // FR-181: tên trợ lý riêng (CRM đọc cột này)
  };
  const [{ data: sellerCu }, { data: bCu }] = await Promise.all([
    client.from("sellers").select("id, name, active_listing_id, seller_type, xung_ho, nhom_tuoi, ten_tro_ly")
      .eq("zalo_user_id", externalUserId).maybeSingle(),
    client.from("buyers").select("preferences")
      .eq("zalo_user_id", externalUserId).maybeSingle(),
  ]);
  let sellerRow = (sellerCu ?? null) as SellerRow | null;
  // Người này VỪA được mở hồ sơ bán trong lượt này (FR-159) — nhánh bán cần
  // biết để không chăm sóc như khách quen "đang rao các tin".
  let sellerMoi = false;
  // Nhãn VỪA gán trong lượt này (mở hồ sơ từ chat, hoặc hồ sơ tạo tay được gán)
  // — để nhánh bán báo cho chính người đó biết nhãn + mức phí (02/09).
  let nhanVuaGan: "ccrb" | "nmg" | null = null;

  // OPEN-22 / FR-157: một Zalo VỪA BÁN VỪA MUA. Nhận diện người vẫn theo
  // zalo_user_id (quyết định chủ dự án 27/08/2026), nhưng VAI thì xét từng
  // lượt: có dòng `sellers` không có nghĩa cả đời người này chỉ được bán.
  // Trước bản này, hễ khớp `sellers` là chốt vai bán cho MỌI tin — chính chủ
  // vừa rao xong muốn hỏi mua căn khác thì không có đường nào đi tới nhánh
  // buyer, bot cứ hỏi ngược lại về căn của họ.
  // Câu hỏi chờ KHÔNG mất khi rẽ sang nhánh mua: `info_requests` vẫn
  // `pending`, cron drip sẽ hỏi lại.
  // Cổng này quyết định NGƯỜI BÁN nhắn có được rẽ sang nhánh mua hay không, nên
  // trượt vì gõ lẫn dấu là nặng nhất trong ba chỗ: "toi muon mua nha q5, giá
  // tốt ko" có đúng hai chữ có dấu, bản trước dồn vào bộ có dấu, không khớp vế
  // nào, và người hỏi mua bị bot hỏi ngược về căn của chính họ.
  //
  // Soát 01/09 (vai người bán): bản cũ nhận "muốn/cần + nhà/căn" và "xem nhà"/
  // "coi nhà" TRẦN là hỏi mua, nên "có khách nào coi nhà chưa em?", "tôi muốn
  // nhà mình lên web sớm", "cần căn này bán nhanh", "em đang xem nhà tôi tới
  // đâu rồi" — toàn câu CHỦ NHÀ hỏi về căn của họ — bị đẩy sang nhánh mua, bot
  // mở hồ sơ mua cho họ rồi hỏi ngược "anh tìm khu nào ạ?". Đo được 5/7 câu
  // chủ nhà thường nói bị rẽ nhầm. Nay: động từ phải là mua/thuê/tìm/kiếm
  // (không nhận danh từ làm tân ngữ); "xem/coi nhà" chỉ khi CHÍNH HỌ xin/hẹn
  // xem; và câu đang nói về KHÁCH/AI xem-mua thì không phải mình muốn mua.
  // Cổng này chỉ có tác dụng với người ĐÃ có hồ sơ bán, nên mập mờ thì nghiêng
  // về vai bán là đúng chiều.
  const hoiMuaTho =
    (khop(
      /(muốn|cần|đang|định|đi)\s*(mua|thu[êe]|tìm|kiếm)\b/i,
      /(muon|can|dang|dinh|di)\s*(mua|thue|tim|kiem)\b/,
    ) ||
      khop(
        /\b(tìm|kiếm|mua)\s*(nhà|căn|đất|phòng|mặt bằng|chung cư|q\s*\d|quận|phường|khu|chỗ|gần)|(?<!cho\s)thu[êe]\s*(nhà|căn|phòng|mặt bằng)/i,
        /\b(tim|kiem|mua)\s*(nha|can|dat|phong|mat bang|chung cu|q\s*\d|quan|phuong|khu|cho|gan)|(?<!cho\s)thue\s*(nha|can|phong|mat bang)/,
      ) ||
      khop(
        /(có|còn)\s*căn nào|tư vấn (mua|thu[êe])/i,
        /(co|con)\s*can nao|tu van (mua|thue)/,
      ) ||
      // 14/09/2026 (bắn thật): "mua để cho thuê lại, khu nào quận 5 dòng tiền tốt",
      // "mua qua bên em có mất phí gì không" rơi về hỏi vai. "mua lại" KHÔNG nhận —
      // "anh mua lại căn này 3 năm trước, giờ bán" là chủ nhà kể chuyện.
      khop(
        /(?:^|[\s,.])mua\s+(để|qua|bên|về ở|trả góp)\b|\bkhi\s+mua\b|\bmua\s+nhà\s+bên\s+em\b/i,
        /(?:^|[\s,.])mua\s+(de|qua|ben|ve o|tra gop)\b|\bkhi\s+mua\b|\bmua\s+nha\s+ben\s+em\b/,
      ) ||
      khop(
        /(cho|xin|muốn|được|đi|qua|tới|hẹn|đặt lịch)\s*(em|anh|chị|tôi|mình)?\s*(xem|coi)\s*(nhà|căn)/i,
        /(cho|xin|muon|duoc|di|qua|toi|hen|dat lich)\s*(em|anh|chi|toi|minh)?\s*(xem|coi)\s*(nha|can)/,
      )) &&
    !khop(
      /(khách|ai|người)\s*(nào)?\s*(đã|có|tới|đến)?\s*(xem|coi|mua|thu[êe]|hỏi)/i,
      /(khach|ai|nguoi)\s*(nao)?\s*(da|co|toi|den)?\s*(xem|coi|mua|thue|hoi)/,
    ) &&
    // 09/09 tối lần 4: "sổ đỏ, đất thuê nhà nước tới 2058" khớp "thuê nhà" → tin
    // NGƯỜI BÁN bị đẩy sang nhánh mua, fact pháp lý mất. Đất thuê nhà nước / thuê
    // đất / cho thuê là lời người bán, không phải ý định đi thuê.
    !khop(
      /thu[êe]\s*(nhà nước|đất)|đất thu[êe]|tiền thu[êe] đất|đang cho thu[êe]|khách thu[êe]|người thu[êe]|thu[êe] tối thiểu|thu[êe] dài hạn/i,
      /thue\s*(nha nuoc|dat)|dat thue|tien thue dat|dang cho thue|khach thue|nguoi thue|thue toi thieu|thue dai han/,
    );

  // ─── CỔNG CÂU RAO MỚI (dùng ở khối `wantsSell` trong nhánh bán; tính SỚM vì
  // (1) bộ bắt-lời-sửa FR-164 phải biết "đây có phải câu rao mới không" — câu
  // rao cũng chứa "giá …", "phường …", không hỏi cổng này trước thì câu rao mới
  // bị hiểu thành lời sửa tin cũ; (2) FR-159 ngay dưới cần nó để nhận ra người
  // LẠ đang tự rao nhà — nên cổng đứng TRƯỚC cả nhánh bán).
  //
  // \b cuối cụm chặn "cho thuê": "ê" ngoài ASCII nên sau nó không bao giờ là
  // biên từ → MỌI câu rao CHO THUÊ từng rơi âm thầm, không tạo tin.
  // FR-158 — cổng KHÔNG còn bắt buộc có giá/diện tích: câu rao trần trụi
  // ("anh muốn bán căn nhà") từng trượt vế thứ ba và bay mất, trong khi cả
  // điểm của vòng drip là hỏi cho ĐỦ những thứ còn thiếu. Nới thì phải có thứ
  // khác gánh dương-tính-giả — thứ đó là THỨ TỰ TỪ: "nhà mình bán chưa em?"
  // có đủ "bán" lẫn "nhà" nhưng không có cặp "bán nhà"/"muốn bán".
  // FR-161: tin gõ LẪN dấu là chuyện thường — "ban nha q5 giá 5 ty" có đúng
  // MỘT chữ có dấu. Thử CẢ HAI bộ rồi lấy hợp (`khop`): bộ không dấu chạy trên
  // `tKD` nên phủ luôn câu gõ đủ dấu; phép hợp chỉ NỚI THÊM.
  const coChiTiet = khop(
    new RegExp(`[\\d][\\d.,]*\\s*(${TIEN_CD})|\\d+\\s*m2|hẻm|mặt tiền|phường`, "i"),
    new RegExp(`[\\d][\\d.,]*\\s*(${TIEN_KD})|\\d+\\s*m2|\\bhem\\b|mat tien|phuong`),
  );
  const coYDinhRao =
    khop(
      // 16/09/2026 (Zalo thật): "chú có căn nhà này cần GIAO bán" — chữ "giao/gửi/nhờ" chen
      // giữa làm luật cũ trượt, câu rao rơi vào câu đang hỏi của tin cũ.
      /(muốn|cần|đang|nhờ|ký gửi)\s+(?:giao\s+|gửi\s+|nhờ\s+)?(bán|cho thu[êe]|sang nhượng|nhượng lại|sang lại)|\b(giao|gửi|ký gửi)\s+bán\b/i,
      /(muon|can|dang|nho|ky gui)\s+(?:giao\s+|gui\s+|nho\s+)?(ban|cho thue|sang nhuong|nhuong lai|sang lai)\b|\b(giao|gui|ky gui)\s+ban\b/,
    ) ||
    khop(
      /(bán|rao|cho thu[êe]|sang nhượng|nhượng lại|sang lại)\s+(nhà|căn hộ|chung cư|đất|mặt bằng|phòng trọ|biệt thự|căn)/i,
      /(ban|rao|cho thue|sang nhuong|nhuong lai|sang lai)\s+(nha|can ho|chung cu|dat|mat bang|phong tro|biet thu|can)\b/,
    );
  // Chỉ chặn câu hỏi tình trạng khi câu KHÔNG kèm chi tiết thật nào.
  const laCauHoiTinhTrang = khop(
    /(chưa|sao r[oồ]i|th[eế] n[aà]o|ra sao|đư[ơợ]c không|đc ko|xong ch[uư]a)/i,
    /(chua|sao roi|the nao|ra sao|duoc khong|dc ko|xong chua)/,
  );
  // 09/09 tối (chạy kịch bản thật): "Cho thuê kho xưởng 1000m2 KCN Tân Tạo" và
  // "Em là môi giới, có căn nhà hẻm 100 Nguyễn Trãi, 40m2, 5 tỷ" đều KHÔNG tạo
  // tin — danh sách loại thiếu kho/xưởng/toà nhà, và câu môi giới giới thiệu
  // hàng không có chữ "bán". Nới: đủ loại trong enum; môi giới/sale "có căn" +
  // chi tiết; người bán quen nói "còn căn nữa" + chi tiết.
  const coLoaiBDS = khop(
    /(nhà|căn hộ|chung cư|đất|mặt bằng|phòng trọ|biệt thự|căn\b|kho|xưởng|toà|tòa|khách sạn|chdv|building|villa|shophouse|officetel|penthouse|lô\b)/i,
    /(nha|can ho|chung cu|dat|mat bang|phong tro|biet thu|\bcan\b|\bkho\b|xuong|\btoa\b|khach san|chdv|building|villa|shophouse|officetel|penthouse|\blo\b)/,
  );
  // Chỉ khi có DẤU HIỆU NGHỀ ("môi giới", "sale", "bên sàn", "bên em có hàng")
  // hoặc người bán quen nói "còn căn nữa" — "tôi có căn nhà ở phường 4" một
  // mình vẫn mập mờ (FR-159: người mua kể hoàn cảnh), giữ nguyên đường hỏi vai.
  const moiGioiCoHang = khop(
    /(môi giới|\bsale\b|bên sàn|sàn bđs|bên em có)[^.!?]{0,60}?(có|còn)?\s*(một |1 )?(căn|nhà|đất|lô|mặt bằng|chung cư|kho|xưởng|toà|tòa)/i,
    /(moi gioi|\bsale\b|ben san|san bds|ben em co)[^.!?]{0,60}?(co|con)?\s*(mot |1 )?(can|nha|dat|\blo\b|mat bang|chung cu|kho|xuong|\btoa\b)/,
  ) ||
    // "Còn căn nữa: 7 Hồng Bàng …" / "thêm căn …" — người bán quen rao căn thứ hai
    // (10/09: lần 4 kịch bản thật câu này bị hiểu là lời SỬA phường của căn cũ).
    khop(
      /^\s*(còn|thêm|có thêm)\s*(một |1 )?(căn|lô|nhà|miếng)\s*(nữa|khác|thứ \d)?\s*[:,.-]?/i,
      /^\s*(con|them|co them)\s*(mot |1 )?(can|lo|nha|mieng)\s*(nua|khac|thu \d)?\s*[:,.-]?/,
    );
  // 10/09 lần 6 (chân dung nhà đầu tư): "Anh đầu tư mua nhà cũ sửa lại bán, giờ có căn
  // hẻm 45 Trần Phú …, 4x14, 5 tỷ 9" — có hàng + có GIÁ/M² là câu rao, dù không có
  // chữ "bán" đứng trước loại và dù có chữ "mua" (kể chuyện) trong câu.
  // 11/09/2026 (42 ca): "có căn nào q5 tầm 5 tỷ không em" là NGƯỜI MUA hỏi kho —
  // bản trước mở thành tin rao (loại chưa rõ, 5 tầng). "căn nào", dấu hỏi, lời
  // ngân sách ("tầm/khoảng/dưới … tỷ"), "… không em?" cuối câu, "cần nhà …" là
  // dấu hiệu MUA. Chỉ chặn các cổng NỚI (không cần chữ "bán"), không đụng cổng gốc.
  const coDauHieuMua = /\?/.test(text) || khop(
    /\b(tìm|cần mua|muốn mua|đang mua|hỏi mua|cần thuê|muốn thuê|ngân sách)\b|\b(căn|nhà|lô|đất|phòng)\s+nào\b|\b(tầm|khoảng|dưới)\s+\d|\bkhông\s+(em|ạ|anh|chị|bạn)\s*$|^\s*cần\s+(một\s+|1\s+)?(nhà|căn|lô|đất|phòng|mặt bằng)\b/i,
    /\b(tim|can mua|muon mua|dang mua|hoi mua|can thue|muon thue|ngan sach)\b|\b(can|nha|lo|dat|phong)\s+nao\b|\b(tam|khoang|duoi)\s+\d|\b(khong|ko|k)\s+(em|a|anh|chi|ban)\s*$|^\s*can\s+(mot\s+|1\s+)?(nha|can|lo|dat|phong|mat bang)\b/,
  );
  // "anh có 2 căn: …" là rao nhiều căn — cho phép con số đứng trước "căn".
  const coHangCoGia = khop(
    /\b(có|còn|đang có)\s*(một |1 |\d{1,2} )?(căn|nhà|lô|miếng|mảnh)\b(?!\s+nào)/i,
    /\b(co|con|dang co)\s*(mot |1 |\d{1,2} )?(can|nha|lo|mieng|manh)\b(?!\s+nao)/,
  ) && khop(/\d\s*(tỷ|tỉ|tỏi|triệu|tr)\b|\d+\s*m2/i, /\d\s*(ty|ti|toi|trieu|tr)\b|\d+\s*m2/) && !coDauHieuMua;
  // 11/09/2026 (42 ca): câu rao THẬT không có chữ "bán" rơi về lời chào khuôn
  // "đang muốn mua, thuê hay bán": "Nhà mặt tiền Hùng Vương Q5, DT 5x20, 5 tầng,
  // giá 32 tỏi", "Nhà cấp 4 Bình Chánh 5x25 thổ cư 100% 1ty9", "căn hộ Hà Đô
  // Centrosa quận 10 1PN+1 giá 4,1 tỷ bao sang tên", câu kể dài "… hẻm 5m, 4x15,
  // quận 5, giá 10 tỷ". Người rao LIỆT KÊ hàng; người mua HỎI. Nên: loại BĐS + giá
  // + chi tiết của CĂN (≥ 3, hoặc ≥ 2 khi có chữ "giá") + không dấu hiệu mua.
  const coGiaRo = khop(
    new RegExp(`[\\d][\\d.,]*\\s*(?:${TIEN_CD})(?![a-zA-ZÀ-ỹ])|${TIEN_T_KEP}`, "i"),
    new RegExp(`[\\d][\\d.,]*\\s*(?:${TIEN_KD})(?![a-z])|${TIEN_T_KEP}`),
  );
  const soChiTietCan = [
    /\d+(?:[.,]\d+)?\s*m2|\d+(?:[.,]\d+)?\s*x\s*\d+/.test(tKD),
    !!bocQuan(tKD, text) || !!vungNgoai(tKD),
    /\b(?:phuong|p)\.?\s*\d{1,2}\b/.test(tKD),
    /\bhem\b|\bhxh\b|mat tien/.test(tKD),
    /\d\s*(?:lau|tang|tam)\b|\btret\b/.test(tKD),
    /\d\s*(?:pn|phong ngu)\b/.test(tKD),
    /\btho cu\b|\bso hong\b|\bso rieng\b|\bshr\b|\bhdmb\b|\bsang ten\b/.test(tKD),
  ].filter(Boolean).length;
  const coChuGia = /\bgia\s*:?\s*\d/.test(tKD);
  const raoKhongChuBan = coLoaiBDS && coGiaRo && !coDauHieuMua &&
    (soChiTietCan >= 3 || (coChuGia && soChiTietCan >= 2));
  // 15/09/2026 (bắn thật D1): "chào BẠN mình tìm nhà cho ba mẹ… tầm 5 tỷ" — bỏ dấu
  // thành "chao ban" và \bban\b khớp → người MUA bị mở hồ sơ bán + tạo tin rao.
  // Chữ CÓ DẤU mà không phải "bán"/"rao" (bạn, bàn, bản, bận, rào…) thì che trước
  // khi bỏ dấu; câu gõ không dấu thì "ban" vẫn mập mờ như cũ, không siết thêm.
  // 23/09/2026 (bắn thật, căn hộ): "ban công hướng Đông nha em" — "ban" KHÔNG DẤU của "ban công/ban ngày/ban quản lý"
  // thành "bán" → cùng chữ "nha" (hạt câu) thành "nhà" → mở nhầm một tin nhà phố mới. Che các cụm đó trước khi dò.
  const tKDBan = boDau(text.replace(/\b(bạn|bàn|bản|bận|bẩn|bắn|rào|rảo|rão)\b/gi, "_"))
    .replace(/\bban (?:cong|ngay|dem|dau|quan ly|qlda|giam doc|to chuc|dieu hanh)\b/g, "_");
  const coChuBan = /\b(bán|rao)\b|cho thu[êe]|sang nhượng|nhượng lại|sang lại/i.test(text) ||
    /\b(ban|rao)\b|cho thue|sang nhuong|nhuong lai|sang lai/.test(tKDBan);
  // 22/09/2026 (bộ đo giọng M04): "căn 12 Trần Hưng Đạo phường 4 còn bán không" — khách MUA hỏi
  // tình trạng một căn. Có "phường" nên `coChiTiet`, có "bán" + "căn" → mở hồ sơ bán rồi hỏi "nhà
  // mình là nhà phố hay chung cư" (lạc vai). Hỏi còn bán / bán chưa / còn không mà KHÔNG kèm giá
  // là câu HỎI, không phải câu rao — chặn ở cả nhánh có chi tiết.
  const hoiConBan = !coGiaRo && khop(
    /\b(?:còn|đã|hết)\s+bán\s+(?:không|ko|k|chưa|chua)\b|\bbán\s+chưa\b|\bcòn\s+(?:không|ko|k)\s*(?:em|ạ|anh|chị|bạn)?\s*\??\s*$/i,
    /\b(?:con|da|het)\s+ban\s+(?:khong|ko|k|chua)\b|\bban\s+chua\b|\bcon\s+(?:khong|ko|k)\s*(?:em|a|anh|chi|ban)?\s*\??\s*$/,
  );
  const wantsSellLuat =
    (coChuBan && coLoaiBDS && !hoiConBan &&
      (coChiTiet || (coYDinhRao && !laCauHoiTinhTrang))) ||
    (moiGioiCoHang && coChiTiet && !khop(/\b(tìm|cần mua|muốn mua|thuê)\b/i, /\b(tim|can mua|muon mua)\b/)) ||
    coHangCoGia || raoKhongChuBan;
  // ─── FR-205 (11/09/2026): LUẬT KHÔNG KẾT LUẬN ĐƯỢC THÌ HỎI MODEL ─────────────
  // Chủ dự án: "có thể dùng AI vào các chỗ quá cứng trong code không" → "gật".
  // Luật trên chỉ bắt KIỂU câu đã gặp: lượt bắn 42 câu có 6 câu rao không chữ
  // "bán" rơi về câu chào khuôn; PR #104 vá luật cho đúng 6 câu đó, câu thứ bảy
  // nói khác đi ("gia đình cần tiền nên để lại căn…") lại rơi. Nên: luật KHÔNG ra
  // bán cũng không ra mua + người lạ + câu có mùi nhà đất → một lượt model trả
  // `ban | mua | chua_ro` kèm cụm chữ làm bằng; `donVai` đòi cụm đó có nguyên
  // trong câu, bịa cớ thì coi như chưa rõ. Model hỏng / chưa rõ → hỏi vai như cũ.
  // Model chỉ CHỌN ĐƯỜNG; giá / diện tích / quận vẫn do luật tiền định bóc.
  let vaiModel: VaiModel | null = null;
  const hoSoMuaSom = (bCu?.preferences ?? null) as Record<string, unknown> | null;
  if (nenHoiModelVai({
    coHoSoBan: !!sellerRow,
    raoTheoLuat: wantsSellLuat,
    muaTheoLuat: hoiMuaTho,
    daCoHoSoMua: BUYER_PROFILE_FIELDS.some(([k]) => hoSoMuaSom?.[k] != null && hoSoMuaSom?.[k] !== ""),
    coAnh: !!imageUrl,
    nhacMaCan: new RegExp(CODE_RE.source).test(textOrTag),
    doiGoi: VOICE_RE_KD.test(tKD),
    text,
  })) {
    try {
      const ai = await napModel(client);
      const r = await phanVaiBangModel(ai as unknown as Parameters<typeof phanVaiBangModel>[0], MODEL, text);
      if (r) {
        await doTien(client, r.usage as Parameters<typeof doTien>[1]);
        vaiModel = donVai(r.ket, text);
      }
    } catch (e) {
      await ghiLoi(client, "chat-reply phan vai (model)", e);
    }
  }
  const wantsSell = wantsSellLuat || vaiModel === "ban";
  // Câu rao thì KHÔNG phải ý định mua, dù có chữ "mua" kể chuyện ("mua nhà cũ sửa lại bán").
  const hoiMua = (hoiMuaTho || vaiModel === "mua") && !wantsSell;
  // Phường trong câu rao, bắt trên bản bỏ dấu — chỉ lấy CON SỐ nên bỏ dấu
  // không mất gì. Tự kiểm 02/09 (bơm câu rao qua handler thật): "bán nhà P4
  // giá 5 tỷ 8 50m2" tạo tin với phường RỖNG — bản cũ chỉ hiểu "phường 4",
  // trong khi "P4"/"p.4" là cách gõ nhiều nhất, và nhánh MUA hiểu từ lâu.
  // Dùng chung cho tạo tin lẫn cho phép so "căn khác phường" ở nhánh bán.
  const wardNo = soPhuong(tKD);

  // ─── FR-159 (nửa 1/2): người CHƯA có hồ sơ bán mà TỰ NHẬN có bất động sản →
  // mở hồ sơ bán NGAY lượt này rồi đi tiếp vào nhánh bán như người bán quen.
  // Trước bản này cổng câu rao nằm bên trong `if (sellerRow …)`, mà dòng
  // `sellers` chỉ được tạo bằng form admin — nên NGƯỜI LẠ nhắn "tôi muốn bán
  // nhà q5 giá 5 tỷ" rơi thẳng xuống nhánh MUA: bot bóc "khu vực q5, ngân sách
  // 5 tỷ" thành hồ sơ NGƯỜI MUA rồi hỏi "anh tìm khu nào ạ?". Câu rao mất.
  //
  // Ranh giới giữ đúng chữ FR-158/159, và CHIỀU của sai số: FR-159 nói rõ đoán
  // nhầm NGƯỜI MUA thành người bán là lỗi đắt ("nhà mình ở đâu ạ?" với một
  // người đang đi tìm nhà), còn chiều ngược lại chỉ tốn một câu hỏi thừa. Nên
  // chỉ mở hồ sơ bán ở hai mức:
  //   * TỰ NHẬN RÕ, ở bất kỳ tin nào: câu rao thật (wantsSell), "chính chủ",
  //     "ký gửi", "cần rao", "đăng bán" — người mua không nói mấy chữ này.
  //   * "tôi có căn nhà / nhà mình có…" — CHỈ khi đang trả lời câu hỏi vai
  //     (cờ `hoi_vai`). Đứng một mình thì mập mờ: "tôi có căn nhà ở Q10, giờ
  //     tìm Q5" là người mua kể hoàn cảnh, mở hồ sơ bán cho họ là sai chiều đắt.
  // KHÔNG mở vì một chữ "bán" lẻ hay từ câu chào — câu chào đi hỏi vai ở nửa
  // 2/2 dưới nhánh mua. `(?!\s*nào)` chặn "anh có nhà nào 2PN không em" (khách
  // hỏi kho), `!hoiMua` chặn "tôi có nhà rồi, giờ muốn mua thêm".
  // Đọc cờ `hoi_vai` trước khi có dòng buyer (nhánh mua mới nạp): một truy vấn
  // nhỏ, chỉ với người chưa có hồ sơ bán.
  // Cờ giữ NGUYÊN giá trị: `true` = đã hỏi; `"nmg"` = đã hỏi VÀ tin đầu của
  // người này có dấu hiệu môi giới ("em là sale bên sàn…") — để lượt trả lời
  // "có căn cần bán" vẫn nhận đúng nhãn, không rơi về chính chủ vì câu trả lời
  // không nhắc lại chữ "môi giới" (tự kiểm 02/09).
  let dangTraLoiHoiVai: false | true | "nmg" = false;
  if (!sellerRow) {
    const hv = (bCu?.preferences as Record<string, unknown> | null)?.hoi_vai;
    dangTraLoiHoiVai = hv === "nmg" ? "nmg" : !!hv;
  }
  const tuNhanCoBDS = wantsSell ||
    khop(
      /chính chủ|ký gửi|cần rao|muốn rao|đăng tin bán|đăng bán/i,
      /chinh chu|ky gui|can rao|muon rao|dang tin ban|dang ban/,
    ) ||
    (!!dangTraLoiHoiVai && (
      // "tôi có căn nhà…" / "có nhà" (đầu câu, không cần đại từ)
      khop(
        /(?:^|(?:tôi|em|mình|anh|chị|tui|bên mình|nhà mình|gia đình)\s*)(đang\s*)?có\s*(một\s*|1\s*)?(căn|nhà|đất|bất động sản|bđs|mặt bằng|chung cư|phòng trọ|biệt thự|lô)(?!\s*nào)/i,
        /(?:^|(?:toi|em|minh|anh|chi|tui|ben minh|nha minh|gia dinh)\s*)(dang\s*)?co\s*(mot\s*|1\s*)?(can|nha|dat|bat dong san|bds|mat bang|chung cu|phong tro|biet thu|lo)(?!\s*nao)/,
      ) ||
      // Trả lời cụt: "bán", "muốn bán", "tôi bán", "bên bán", "cho thuê" — đang
      // trả lời "mua hay bán?" thì một chữ là đủ (tự kiểm 02/09: bản cũ đòi cả
      // câu rao nên "bán" trơ bị xếp vào hàng mua).
      khop(
        /^\s*(tôi|em|mình|anh|chị)?\s*(muốn|cần|bên|là bên)?\s*(bán|cho thu[êe]|rao)\b/i,
        /^\s*(toi|em|minh|anh|chi)?\s*(muon|can|ben|la ben)?\s*(ban|cho thue|rao)\b/,
      )
    ));
  // ─── NHÃN chính chủ / môi giới — gán NGAY lúc bóc tách (quyết định chủ dự
  // án 02/09/2026: "gán nhãn khi bóc tách là họ có BĐS muốn bán"). Ai nói mình
  // CÓ bất động sản muốn bán là CHÍNH CHỦ; chỉ khi tự xưng môi giới mới là NMG
  // — môi giới không "có" nhà, họ bán nhà người khác, và họ hay tự xưng ("em
  // là sale", "bán giúp chủ", "hàng ký gửi"). Không đoán từ hành vi (số tin) ở
  // đây — đó là FR-160/OPEN-28. Nhãn quyết định mức phí (BR-05) nên phải có
  // ngay khi hồ sơ mở: hồ sơ không nhãn là deal không phí (FR-170 f).
  // Cố ý KHÔNG dùng "bên em có…": với người bán, "em" là bot ("bên em có khách
  // chưa?"), bắt cụm đó là dán nhãn môi giới lên chính chủ.
  const tinHieuMoiGioi = khop(
    /môi giới|\bsale\b|sàn (giao dịch|bđs|bất động sản)|nhân viên kinh doanh|chuyên viên (bđs|bất động sản|kinh doanh)|bán (giúp|hộ|giùm|dùm)|chủ nhà (gửi|nhờ)|khách gửi bán|hàng ký gửi/i,
    /moi gioi|\bsale\b|san (giao dich|bds|bat dong san)|nhan vien kinh doanh|chuyen vien (bds|bat dong san|kinh doanh)|ban (giup|ho|gium|dum)|chu nha (gui|nho)|khach gui ban|hang ky gui/,
  );
  const nhanNguoiBan: "ccrb" | "nmg" =
    tinHieuMoiGioi || dangTraLoiHoiVai === "nmg" ? "nmg" : "ccrb";
  const canMoHoSo = !sellerRow && tuNhanCoBDS && !hoiMua;
  // Hồ sơ đã có nhưng chưa nhãn (tạo tay mà không ghi loại) → gán khi họ tự
  // nhận hoặc tự xưng. Hàm DB chỉ nâng `unknown`, không ghi đè nhãn đã có.
  const canGanNhan = !!sellerRow && sellerRow.seller_type === "unknown" && !hoiMua &&
    (tuNhanCoBDS || tinHieuMoiGioi);
  if (canMoHoSo || canGanNhan) {
    const { data: moi, error: moiErr } = await client
      .rpc("mo_ho_so_nguoi_ban", {
        p_zalo_user_id: externalUserId, p_seller_type: nhanNguoiBan,
      }).maybeSingle();
    if (moiErr || !moi) {
      // Mở hụt thì đi tiếp như cũ — tệ hơn nhưng không câm; và vào sổ.
      await ghiLoi(client, "chat-reply mo_ho_so_nguoi_ban",
        moiErr?.message ?? "không trả về dòng");
    } else {
      sellerMoi = !sellerRow;
      sellerRow = moi as SellerRow;
      nhanVuaGan = sellerRow.seller_type === "nmg" ? "nmg" : "ccrb";
      // 18/09/2026 (chủ dự án: "xóa cái thông báo cho admin đi"): bỏ tin 🆕 "Hồ sơ người bán MỞ TỪ
      // CHAT…" từng đẩy vào hàng escalation (quyết định 02/09). Hồ sơ mới vẫn thấy ở /admin và 💾
      // của chính khách (dòng 👤 Hồ sơ); chữ "Bot đã báo họ nhãn và mức phí" cũng đã sai từ 09/09.
    }
  }

  if (sellerRow && !hoiMua) {
    // OPEN-30 → đóng: model là NGƯỜI SOẠN CÂU CHỮ, không phải điều kiện sống
    // của nhánh. Key hỏng/hết credit thì mọi lệnh gọi bên dưới rơi về câu mẫu
    // tất định — chủ nhà không bao giờ nhận im lặng + 500 như trước, và lỗi
    // vào sổ qua ghiLoi (FR-152) thay vì xuyên thẳng ra ngoài không dấu vết.
    // Nhánh mua đã làm đúng bài này từ đầu; đây là đưa nhánh bán về cùng chuẩn.
    let anthropicS: ModelClient | null = null;
    try {
      anthropicS = await napModel(client);
    } catch (e) {
      await ghiLoi(client, "chat-reply anthropic(seller)", e);
    }

    // FR-141/FR-152 — hội thoại NGƯỜI BÁN cũng phải vào sổ.
    // Trước bản này nhánh seller trả lời rồi `return` thẳng, không ghi dòng nào
    // vào `messages`: CTV mở hội thoại chủ nhà thấy trống trơn, không có gì để
    // bàn giao khi người thật tiếp quản. `conversations.seller_id` vốn đã có
    // sẵn kèm khoá ngoại — chỉ là chưa đường code nào ghi vào.
    // Hàm get-or-create ở migration 20260827i_hoi_thoai_nguoi_ban.sql, có
    // advisory lock như bên mua (chủ nhà gõ vụn 3 tin là 3 lượt gọi đồng thời).
    const { data: convS, error: convSErr } = await client
      .rpc("ensure_seller_conversation", {
        p_seller_id: sellerRow.id,
        p_channel: channel,
      }).single();
    const convSRow = convS as
      { c_id?: string; c_human_touch_at?: string | null; c_human_hold?: boolean | null } | null;
    const convSId = convSRow?.c_id ?? null;
    // Hàm thiếu / mất quyền / DB nghẽn mà đi tiếp thì bot vẫn trả lời trong khi
    // KHÔNG ghi được dòng nào: dedup 23505 tắt (Zalo gửi lại là bóc fact hai
    // lần, câu rao gửi lại là đẻ thêm một tin rao trùng), cổng nhường sân tắt, mà
    // HTTP vẫn 200 nên bot_health_tick không thấy gì. Nhánh mua ở đây trả 500 —
    // nhánh bán phải cùng ngữ nghĩa (FR-152).
    if (convSErr || !convSId) {
      const detail = convSErr?.message ?? "không trả về c_id";
      await ghiLoi(client, "chat-reply ensure_seller_conversation", detail);
      return await baoHong({ error: detail }, 500, detail);
    }

    // Ghi tin CHỦ NHÀ trước khi gọi model: model lỗi giữa chừng thì vẫn còn dấu
    // vết chủ nhà đã nhắn gì. Trùng `zalo_msg_id` (23505) = kênh gửi lại tin cũ
    // → đã trả lời rồi, đừng trả lời lần hai. Cùng ngữ nghĩa với nhánh mua.
    const { error: msgSErr } = await client.from("messages").insert({
      conversation_id: convSId,
      sender: "seller",
      body: imageUrl ? `${textOrTag} [ảnh: ${imageUrl}]` : text,
      zalo_msg_id: msgId,
    });
    if (msgSErr?.code === "23505" && !(coSo && soAttempts > 1)) {
      // Trùng từ THỜI TRƯỚC SỔ (sổ chưa có dòng nào cho msg_id này mà messages
      // đã có): lượt cũ đã trả lời rồi — dừng, và chốt sổ completed-rỗng để
      // các retry sau không quay lại đây nữa.
      return await hoanTat({ reply: null, replies: [], role: "seller", deduped: true });
    }
    if (msgSErr && msgSErr.code !== "23505") {
      // Mọi lỗi KHÁC 23505 (khoá ngoại, timeout, enum sai…) trước đây rơi im:
      // bot vẫn trả lời vào một hội thoại thiếu đúng dòng chủ nhà vừa nhắn.
      await ghiLoi(client, "chat-reply messages seller", msgSErr.message);
      return await baoHong({ error: msgSErr.message }, 500, msgSErr.message);
    }
    // 23505 khi soAttempts > 1: lượt trước của CHÍNH msg_id này chết giữa chừng
    // — tin chủ nhà đã nằm trong sổ messages rồi. Đi tiếp trả lời nốt, đừng
    // nuốt (đây đúng là ca "AI chưa kịp chạy / Zalo chưa kịp gửi thì hỏng").
    // (`conversations.last_message_at` do trigger trên `messages` đẩy — migration
    //  20260902d — không còn UPDATE tay ở đây.)

    // FR-141 — người thật gõ tay trong 30 phút gần đây thì bot im.
    // Cổng này trước chỉ có ở nhánh mua, nên CTV đang thương lượng với chủ nhà
    // mà chủ nhắn tiếp là bot nhảy vào nói chen giữa cuộc.
    // Trả về NGAY tại đây là bỏ luôn khúc bóc fact bên dưới: câu trả lời của
    // chủ nhà không vào `listing_facts`, `info_requests` nằm `pending` mãi, và
    // vòng drip hỏi lại đúng câu người ta vừa trả lời — CTV vào tay một cái là
    // dữ liệu căn đó đứng hình. Nên cổng chỉ khoá ĐƯỜNG RA (traLoiSeller) và
    // khoá lượt gọi model, không khoá đường ghi.
    const nguoiThatDangCham = convSRow?.c_human_touch_at;
    // FR-189 (10/09/2026): người thật GIỮ khách ("#mã giữ") → bot im vô thời hạn
    // tới khi "trả bot"; ngoài ra vẫn nhường sân 30 phút sau tin gõ tay (FR-141).
    const humanActive = convSRow?.c_human_hold === true || (!!nguoiThatDangCham &&
      Date.now() - Date.parse(nguoiThatDangCham) < 30 * 60e3);

    // MỌI đường ra của nhánh này phải đi qua đây — trả lời của bot cũng là một
    // dòng trong sổ. Thêm `return jsonResponse(...)` trần ở nhánh seller là
    // thủng lại đúng chỗ vừa vá, và thủng im lặng.
    // FR-164: lời cảm ơn cho phần SỬA FACT, gắn vào bong bóng ĐẦU của bất kỳ
    // đường ra nào phía sau. Để ở đây (trước `traLoiSeller`) vì nhánh người bán
    // có sáu lối thoát khác nhau — chép câu cảm ơn ra từng lối là kiểu bỏ sót
    // đúng một chỗ rồi không ai thấy.
    // FR-193 b (10/09): quận nói ở LƯỢT SAU cũng phải vào cột. Chủ dự án rao
    // "bán căn ho ở Hà đô centrosa garden" (không quận) rồi lượt sau nói "quận 10
    // phường 12" — trước bản này chỉ phường vào cột, còn district giữ nguyên mặc
    // định "Quận 5", tức kho có một căn hộ Quận 10 nằm trong rổ Quận 5.
    // "cả 2 căn / cả lô / đều" — quận nói cho MỌI tin đang mở (20/09/2026, bắn thật mau-y-A:
    // "ca 2 can deu quan 10 nhe" từng bị bỏ qua vì câu chờ là loại BĐS).
    const CA_LO_RE = /\b(?:ca|het)\s+(?:2|3|4|hai|ba|bon|lo|may|cac)\b|\bdeu\b|\bca lo\b/;
    /** Trả về chữ đã ghi ("Quận 10", "Quận 10 cho 2 căn") hay null khi không đổi gì. */
    const capNhatQuan = async (listingId: string | null): Promise<string | null> => {
      if (!listingId) return null;
      // Truyền cả bản THÔ: "quán 2 tầng" bỏ dấu thành "quan 2 tang", không có
      // bản thô thì không tài nào biết đó không phải Quận 2 (tầng ba, 10/09).
      // FR-214: câu đã chia mảnh theo tin → quận ở mảnh căn KHÁC không phải quận của căn đang hỏi.
      const q = textTreo !== null ? bocQuan(boDau(textTreo), textTreo) : bocQuan(tKD, text);
      if (!q) return null;
      const ids: string[] = [listingId];
      if (CA_LO_RE.test(tKD)) {
        const { data: dsLo } = await client.from("listings").select("id, district, boc_tach").eq("seller_id", sellerRow.id)
          .in("status", ["cho_thong_tin", "dang_ban", "dang_quan_tam"]).limit(20);
        for (const r of (dsLo ?? []) as Array<{ id: string; district: string | null; boc_tach: unknown }>) {
          if (r.id !== listingId && (!r.district || (r.boc_tach as { quan_mac_dinh?: unknown } | null)?.quan_mac_dinh === true)) ids.push(r.id);
        }
      }
      let soDoi = 0;
      for (const id of ids) {
        const { data: cu } = await client.from("listings").select("district, boc_tach").eq("id", id).maybeSingle();
        if (!cu) continue;
        if (cu.district === q) {
          // Chủ nhà xác nhận đúng quận đang ghi (vd "quận 5" khi cột đang mặc định Quận 5):
          // không đổi cột, chỉ bỏ dấu "mặc định" (11/09/2026).
          if ((cu.boc_tach as { quan_mac_dinh?: unknown } | null)?.quan_mac_dinh === true) {
            const { error: bt0 } = await client.rpc("ghi_boc_tach", { p_listing_id: id, p: { quan: q, quan_mac_dinh: false } });
            if (bt0) await ghiLoi(client, "chat-reply ghi_boc_tach(quan xac nhan)", bt0.message);
          }
          continue;
        }
        const { error: qErr } = await client.from("listings").update({ district: q }).eq("id", id);
        if (qErr) { await ghiLoi(client, "chat-reply cap nhat quan", qErr.message); continue; }
        soDoi++;
        const { error: btErr } = await client.rpc("ghi_boc_tach", { p_listing_id: id, p: { quan: q, quan_mac_dinh: false } });
        if (btErr) await ghiLoi(client, "chat-reply ghi_boc_tach(quan)", btErr.message);
      }
      return soDoi ? `${q}${soDoi > 1 ? ` cho ${soDoi} căn` : ""}` : null;
    };

    // ─── FR-209 (15/09/2026): tra PHƯỜNG MỚI từ TÊN ĐƯỜNG ─────────────────────
    // Chủ dự án (Zalo thật): "nếu có địa chỉ và tên đường rồi thì tự search phường
    // quận được không chứ". Nominatim trả phường MỚI (sau 07/2025, OSM bỏ ranh giới
    // quận); quận cũ tra ở bảng `wards` (NQ 1685). Bot HỎI XÁC NHẬN, chưa ghi —
    // gợi ý nằm ở `boc_tach.phuong_goi_y`, chủ nhà gật thì mới vào cột (RSK-03).
    // Tra hỏng / hết giờ (4 s) là đường đi bình thường → console.log, không vào sổ lỗi.
    type GoiYPhuong = { phuong: string; quan: string; duong: string };
    const timWard = async (ten: string): Promise<{ ten_day_du: string; quan_cu: string } | null> => {
      if (!ten || /\d/.test(ten)) return null;
      const { data, error } = await client.from("wards").select("ten_day_du, quan_cu").ilike("ten", ten).limit(1).maybeSingle();
      if (error) await ghiLoi(client, "chat-reply doc wards", error.message);
      return (data as { ten_day_du: string; quan_cu: string } | null) ?? null;
    };
    const traPhuongTuDuong = async (duongTho: string): Promise<GoiYPhuong | { nhieuNoi: string[]; duong: string } | null> => {
      const duong = chuanTenDuong(duongTho);
      if (!duongTraDuoc(duong)) return null;
      let json: unknown = null;
      try {
        const r = await fetch(urlTraPhuong(duong), { headers: { "User-Agent": UA_NOMINATIM }, signal: AbortSignal.timeout(4000) });
        if (!r.ok) { console.log(`tra phuong: nominatim ${r.status} cho "${duong}"`); return null; }
        json = await r.json();
      } catch (e) {
        console.log(`tra phuong: nominatim hỏng cho "${duong}": ${(e as Error)?.message ?? e}`);
        return null;
      }
      const cac = docCacPhuongNominatim(json);
      if (!cac.length) return null;
      if (cac.length === 1) {
        const w = await timWard(cac[0].ten);
        return w ? { phuong: w.ten_day_du, quan: w.quan_cu, duong: duong.trim() } : null;
      }
      // 23/09/2026: đường có ở nhiều phường (Trần Bình Trọng: Q5, Q10, Bình Thạnh…) → không đoán; kể các quận cũ.
      const quan: string[] = [];
      for (const p of cac.slice(0, 6)) {
        const w = await timWard(p.ten);
        if (w?.quan_cu && !quan.includes(w.quan_cu)) quan.push(w.quan_cu);
      }
      return quan.length ? { nhieuNoi: quan, duong: duong.trim() } : null;
    };
    /** Tin đang ở quận MẶC ĐỊNH và có tên đường → tra, cất gợi ý, trả câu hỏi xác nhận (null = hỏi như cũ). */
    const cauHoiPhuongGoiY = async (listingId: string, duongBiet: string | null, cachGoiNguoi: string): Promise<string | null> => {
      const { data: l } = await client.from("listings").select("district, street, location_raw, boc_tach").eq("id", listingId).maybeSingle();
      if (!l) return null;
      const duong = (duongBiet ?? "").trim() || (l.street ?? "").trim() || tenDuong(l.location_raw ?? "");
      // 25/09/2026 (chủ dự án: "người ta đưa số nhà và tên đường và quận rồi nhưng mà lại cố hỏi là phường nào"): ĐÃ
      // biết quận → tra bảng `duong` (OSM, phường mới theo quận cũ): một phường → hỏi xác nhận; 2–3 phường → hỏi chọn.
      // Không tra được (bảng chưa có đường đó) → hỏi như cũ.
      if (l.district && (l.boc_tach as { quan_mac_dinh?: unknown } | null)?.quan_mac_dinh !== true) {
        const ten = chuanTenDuong(duong);
        if (!duongTraDuoc(ten)) return null;
        const { data: dd, error: ddErr } = await client.from("duong").select("phuong, quan_cu").eq("ten_khong_dau", boDau(ten)).limit(40);
        if (ddErr) { await ghiLoi(client, "chat-reply tra duong theo quan", ddErr.message); return null; }
        const cac = phuongCuaDuongTrongQuan((dd ?? []) as Array<{ phuong: string | null; quan_cu: string | null }>, l.district);
        if (cac.length === 1) {
          const goiY = { phuong: cac[0], quan: l.district, duong: ten };
          const { error } = await client.rpc("ghi_boc_tach", { p_listing_id: listingId, p: { phuong_goi_y: goiY } });
          if (error) { await ghiLoi(client, "chat-reply ghi_boc_tach(phuong goi y theo quan)", error.message); return null; }
          return cauXacNhanPhuong(cauHoiMau("phuong@goi_y", cachGoiNguoi), cachGoiNguoi, goiY.duong, goiY.phuong, goiY.quan);
        }
        if (cac.length >= 2 && cac.length <= 3) return cauChonPhuong(cachGoiNguoi, ten, cac);
        return null;
      }
      const goiY = await traPhuongTuDuong(duong);
      if (!goiY) return null;
      if ("nhieuNoi" in goiY) return cauNhieuNoiPhuong(cachGoiNguoi, goiY.duong, goiY.nhieuNoi);
      const { error } = await client.rpc("ghi_boc_tach", { p_listing_id: listingId, p: { phuong_goi_y: goiY } });
      if (error) { await ghiLoi(client, "chat-reply ghi_boc_tach(phuong goi y)", error.message); return null; }
      return cauXacNhanPhuong(cauHoiMau("phuong@goi_y", cachGoiNguoi), cachGoiNguoi, goiY.duong, goiY.phuong, goiY.quan);
    };
    /**
     * Sau khi chủ nhà trả lời phường: gật gợi ý → quận gợi ý; tự nói TÊN phường mới →
     * tra `wards` lấy quận. Gợi ý dùng xong thì xoá. Trả về tên phường CHUẨN ("Phường
     * Long Trường") khi tra được, để fact ghi đúng chữ chứ không phải "phường long trường".
     */
    const capNhatQuanTuPhuong = async (listingId: string, goiY: GoiYPhuong | null, dapAnPhuong: string): Promise<string | null> => {
      const { data: cu } = await client.from("listings").select("district, boc_tach").eq("id", listingId).maybeSingle();
      const bt = (cu?.boc_tach ?? {}) as { quan_mac_dinh?: unknown; phuong_goi_y?: unknown };
      // 20260917a: quận trống (không còn mặc định Quận 5) cũng là "chưa rõ" như cờ cũ.
      const chuaQuan = !cu?.district || bt.quan_mac_dinh === true;
      const p: Record<string, unknown> = bt.phuong_goi_y ? { phuong_goi_y: false } : {};
      let quan = goiY?.quan ?? null;
      let tenChuan: string | null = goiY ? goiY.phuong : null;
      if (!goiY) {
        const tach = tachTienToPhuong(dapAnPhuong);
        const ten = (tach?.ten ?? dapAnPhuong).trim();
        const w = ten.length >= 2 && ten.length <= 50 ? await timWard(ten) : null;
        if (w) { tenChuan = w.ten_day_du; quan = chuaQuan ? w.quan_cu : null; }
        // 15/09/2026: không có trong `wards` (xã cũ như "Tân Kiên") thì vẫn ghi tên ĐÃ
        // CẮT chữ đệm và tiền tố viết hoa ("Xã Tân Kiên"), không phải "xã Tân Kiên đó em".
        else if (tach) tenChuan = tach.ten_day_du;
      }
      if (quan && chuaQuan) {
        const { error: qErr } = await client.from("listings").update({ district: quan }).eq("id", listingId);
        if (qErr) await ghiLoi(client, "chat-reply cap nhat quan tu phuong", qErr.message);
        else { p.quan = quan; p.quan_mac_dinh = false; }
      }
      if (Object.keys(p).length) {
        const { error } = await client.rpc("ghi_boc_tach", { p_listing_id: listingId, p });
        if (error) await ghiLoi(client, "chat-reply ghi_boc_tach(quan tu phuong)", error.message);
      }
      return tenChuan;
    };

    // ─── FR-212 (21/09/2026): TỪ ĐIỂN TÊN ĐƯỜNG ────────────────────────────────
    // Chủ dự án: "khách viết tên đường ko dấu hoặc sai 1 vài kí tự nhận ra dc ko" → bảng
    // `duong` (OSM theo phường mới, `20260921b`) + RPC `tim_duong`. Khớp đúng sau bỏ dấu →
    // viết đúng dấu theo từ điển, không hỏi; khớp gần (1–2 phép sửa, MỘT ứng viên) → HỎI
    // XÁC NHẬN, gợi ý cất ở `boc_tach.duong_goi_y`, chủ nhà gật mới ghi (RSK-03, cùng cách
    // FR-209 hỏi phường). Không khớp → giữ nguyên chữ khách gõ: từ điển vùng ven còn mỏng,
    // "không có trong từ điển" không có nghĩa là "gõ sai". RPC hỏng là SỰ CỐ (ghi sổ) nhưng
    // địa chỉ vẫn ghi như cũ — từ điển là lớp phụ, không được chặn đường ghi.
    const suaTenDuong = async (viTri: string, quan: string | null | undefined): Promise<{ viTri: string; goiY: GoiYDuong | null }> => {
      const goc = catTenDuong(chuanTenDuong(tenDuong(viTri)));
      if (!duongTraDuoc(goc)) return { viTri, goiY: null };
      const { data, error } = await client.rpc("tim_duong", { p_ten: goc, p_quan: quan ?? null });
      if (error) { await ghiLoi(client, "chat-reply tim_duong", error.message); return { viTri, goiY: null }; }
      const kq = chonDuong(goc, (data ?? null) as UngVienDuong[] | null, quan ?? null);
      if (kq.loai === "sua") return { viTri: theTenDuong(viTri, goc, kq.ten), goiY: null };
      if (kq.loai === "hoi") return { viTri, goiY: { goc, ten: kq.ten, vi_tri: theTenDuong(viTri, goc, kq.ten) } };
      return { viTri, goiY: null };
    };
    /** Cất gợi ý vào `boc_tach.duong_goi_y` rồi trả câu hỏi xác nhận (null = không cất được → hỏi như cũ). */
    const cauHoiDuongGoiY = async (listingId: string, goiY: GoiYDuong, cachGoiNguoi: string): Promise<string | null> => {
      const { error } = await client.rpc("ghi_boc_tach", { p_listing_id: listingId, p: { duong_goi_y: goiY } });
      if (error) { await ghiLoi(client, "chat-reply ghi_boc_tach(duong goi y)", error.message); return null; }
      return cauXacNhanDuong(cauHoiMau("duong@goi_y", cachGoiNguoi), cachGoiNguoi, goiY.goc, goiY.ten);
    };

    // Tầng tiền định đã ghi được fact dự án nào trong lượt này chưa. Lưới vét
    // bằng model (FR-199) chỉ chạy khi chỗ này còn `false` — hai tầng cùng ghi
    // là hàng chờ duyệt có hai dòng gần giống nhau cho cùng một câu.
    let daGhiFactDuAn = false;

    // FR-195: chép một fact sang kho dự án nếu tin có gắn dự án và khoá đó là
    // chuyện của cả dự án. Việc phụ: hỏng thì ghi sổ rồi đi tiếp.
    const chepSangDuAn = async (khoa: string, giaTri: string): Promise<void> => {
      if (!KHOA_DU_AN.has(khoa) || !giaTri?.trim()) return;
      const lid = pendingReq?.listing_id ?? sellerRow.active_listing_id ?? null;
      if (!lid) return;
      const { data: l } = await client.from("listings").select("project_id").eq("id", lid).maybeSingle();
      // Kho CHƯA CÓ dự án đó thì vẫn ghi nhận, kèm tên khách nhắc (20260910h) —
      // chủ dự án 10/09: "người ta chat dự án mà không có trong chỗ mình có cũng
      // ghi nhận được đúng ko". Admin thêm dự án vào kho rồi gật sau.
      let tenNhac: string | null = null;
      if (!l?.project_id) {
        const { data: fDuAn } = await client.from("listing_facts")
          .select("answer").eq("listing_id", lid).eq("question", "du_an_ten")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        // Tên ĐÃ NHỚ của chính tin này đứng TRƯỚC tên đoán từ câu vừa nhắn: câu
        // đang nói về phí, tiện ích thì chữ sau "dự án/khu" trong đó phần nhiều
        // là miêu tả, còn tên nhớ từ câu rao là tên chủ nhà tự gõ ra.
        tenNhac = duAnNoi[0]?.name ?? fDuAn?.answer ?? tenDuAnTrongCau(text) ?? null;
        if (!tenNhac) return;
      }
      // Cắt về MỆNH ĐỀ ĐẦU: "phí quản lý 14 nghìn/m2, khu có công viên ven sông"
      // mang hai thông tin, nhưng ô phí quản lý chỉ nên giữ phần phí — admin duyệt
      // đọc một dòng gọn thì gật nhanh, đọc cả câu thì phải tự cắt bằng mắt.
      const gonGon = giaTri.split(/[,;\n]/)[0].trim() || giaTri.trim();
      const { error } = await client.rpc("ghi_fact_du_an", {
        p_project_id: l?.project_id ?? null, p_khoa: khoa, p_gia_tri: gonGon,
        p_nguon: "seller_chat", p_listing_id: lid, p_conversation_id: convSId ?? null,
        p_ten_du_an: tenNhac,
      });
      if (error) await ghiLoi(client, "chat-reply ghi_fact_du_an", error.message);
      else daGhiFactDuAn = true;
    };

    // FR-199: LƯỚI VÉT bằng model, đứng SAU tầng tiền định.
    //
    // Chủ dự án 10/09: "ủa cái nào cũng phải viết hàm như này chứ ko dùng ai tự
    // bóc tách ra specs rồi viết vào dc hả" → "lắp đi". Được dùng model ở ĐÂY
    // (mà không được dùng cho giá / diện tích / phường) vì thứ bóc ra chỉ vào
    // `project_facts` ở trạng thái CHỜ DUYỆT — model bịa thì chết ở hàng chờ,
    // không chết trong rổ hàng.
    //
    // Ba cái van cho khỏi đốt tiền: chỉ chạy khi tầng tiền định KHÔNG ghi được
    // gì; chỉ khi câu có mùi dự án (`coMuiDuAn`); và chỉ một lượt mỗi tin.
    let daVetDuAn = false;
    // FR-208: lượt AI bóc tách chạy bóng (khởi động sau khi biết câu đang hỏi).
    let bongAi: Promise<{ truong: DeXuat[]; kienThuc: string[]; ket: unknown; usage: unknown; ms: number; cauDangHoi: string | null; cheDo: string } | null> | null = null;
    // Công tắc `app_config.boc_tach_ai` đọc MỘT lần, tách khỏi lượt model để đường ra biết
    // phải chờ (chế độ `ghi`) hay chạy nền (chế độ `bong`) mà không đợi model xong.
    let cheDoBocAi: Promise<string> | null = null;
    // FR-208 bước 2 (17/09/2026): chế độ `ghi` — trường AI đọc ra, qua kiểm bằng chứng +
    // kiểm khoảng (`chonDeGhi`), mà luật tiền định KHÔNG ghi và tin còn trống → ghi fact
    // nguồn `ai_kiem`, trả dòng 🤖 để gắn sau 💾. Chế độ `bong` chỉ ghi sổ đo, trả null.
    const ghiBongBocTach = async (extra: Record<string, unknown>): Promise<string | null> => {
      if (!bongAi) return null;
      const kq = await bongAi;
      bongAi = null;
      if (!kq) return null;
      try {
        await doTien(client, kq.usage as Parameters<typeof doTien>[1]);
        // Tin nào: như 💾 — mã vừa tạo lượt này > active_listing_id đọc lại.
        const ma = typeof extra.listing_code === "string" && extra.listing_code ? extra.listing_code : null;
        const { data: sNow } = await client.from("sellers").select("active_listing_id").eq("id", sellerRow.id).maybeSingle();
        const lid = (sNow as { active_listing_id?: string | null } | null)?.active_listing_id ?? null;
        const chon = client.from("listings")
          .select("id, deal, property_type, price_vnd, price_per_m2_vnd, area_m2, frontage_m, length_m, rear_width_m, alley_width_m, distance_to_street_m, bedrooms, bathrooms, floors, floor, district, ward, street, unit_code, direction, legal_status, gap, negotiable, rent_income_vnd, projects(name)")
          .eq("seller_id", sellerRow.id);
        const { data: dong, error: dErr } = await (ma ? chon.eq("code", ma) : lid ? chon.eq("id", lid) : chon.order("created_at", { ascending: false }))
          .limit(1).maybeSingle();
        if (dErr) await ghiLoi(client, "chat-reply boc_tach_bong(listings)", dErr.message);
        const d = (dong ?? null) as (DongDb & { id: string }) | null;
        const facts: Record<string, string> = {};
        if (d) {
          const { data: fs } = await client.from("listing_facts").select("question, answer")
            .eq("listing_id", d.id).order("created_at", { ascending: true }).limit(80);
          for (const f of (fs ?? []) as Array<{ question: string; answer: string | null }>) if (f.answer) facts[f.question] = f.answer;
        }
        const { dat, bo } = kiemDeXuat(kq.truong, text);
        const soCan = (kq.ket as { so_can?: number } | null)?.so_can ?? null;
        const soSanh = soSanhVoiDb(dat, d, facts);
        // Chế độ `ghi`: chỉ khi tin xác định được và tin rao MỘT căn (nhiều căn: DB chỉ có một tin để so).
        const daGhi: Array<{ question: string; answer: string; khoa: string }> = [];
        let boGhi: unknown[] = [];
        // Kiến thức thêm (17/09/2026): ý khách nói về căn mà không có khoá → fact `bo_sung`, ra tin
        // vào dòng "📝 Thêm" của bản nháp (`soanTinNhap`).
        const kienThucGhi: string[] = [];
        if ((kq.cheDo === "ghi" || kq.cheDo === "chinh") && d && (soCan ?? 0) <= 1) {
          const chon = chonDeGhi(dat, soSanh, d, facts);
          boGhi = chon.bo;
          for (const g of chon.ghi) {
            const { error: gErr } = await client.rpc("ghi_fact_listing", {
              p_listing_id: d.id, p_question: g.question, p_answer: g.answer, p_source: NGUON_AI,
            });
            if (gErr) await ghiLoi(client, `chat-reply ghi_fact_listing(ai_kiem ${g.question})`, gErr.message);
            else daGhi.push(g);
          }
          const { data: boSungCu } = await client.from("listing_facts").select("answer")
            .eq("listing_id", d.id).eq("question", "bo_sung").limit(40);
          const daCoBoSung = new Set(((boSungCu ?? []) as Array<{ answer: string | null }>).map((x) => boDau((x.answer ?? "").trim())));
          // Ý luật ĐÃ ghi vào một ô (tiện ích gần, hiện trạng…) không thành "bổ sung" lần hai.
          // 21/09/2026 (e2e AIBOC-08): fact NGẮN ("2" phòng ngủ) nằm trong mọi cụm có chữ số → "bàn giao quý 2
          // năm sau" bị coi là đã có. Chỉ so với fact ≥ 4 ký tự.
          const daCoTrongFact = (kt: string) => Object.values(facts).some((a) => a.trim().length >= 4 && (boDau(a).includes(boDau(kt)) || boDau(kt).includes(boDau(a))));
          for (const kt of kiemKienThuc(kq.kienThuc ?? [], text, dat)) {
            // 24/09/2026 (tin thật: "mới", "Quận 1 em ơi" vào "📝 Thêm"): mảnh rác không ghi.
            if (daCoBoSung.has(boDau(kt)) || daCoTrongFact(kt) || laBoSungRac(kt)) continue;
            const { error: kErr } = await client.rpc("ghi_fact_listing", {
              p_listing_id: d.id, p_question: "bo_sung", p_answer: kt, p_source: NGUON_AI,
            });
            if (kErr) await ghiLoi(client, "chat-reply ghi_fact_listing(ai_kiem bo_sung)", kErr.message);
            else kienThucGhi.push(kt);
          }
        }
        // 21/09/2026 (bắn thật mau-v-03): jsonb Postgres từ chối "\u0000" trong chuỗi model trả về
        // ("unsupported Unicode escape sequence") → mất một dòng sổ đo. Lọc trước khi ghi.
        const sachJson = <T>(x: T): T => JSON.parse(JSON.stringify(x).replace(/\\u0000/g, "")) as T;
        const { error: bErr } = await client.from("boc_tach_bong").insert(sachJson({
          seller_id: sellerRow.id, listing_id: d?.id ?? null,
          tin: thayLienHe(text, "[liên hệ]").slice(0, 2000), cau_dang_hoi: kq.cauDangHoi, model: MODEL, ms: kq.ms,
          so_can: soCan,
          de_xuat: kq.truong, dat, bo, so_sanh: soSanh, da_ghi: { che_do: kq.cheDo, ghi: daGhi, bo: boGhi, kien_thuc: kienThucGhi },
        }));
        if (bErr) await ghiLoi(client, "chat-reply boc_tach_bong(ghi)", bErr.message);
        const dongGhi = [
          ...daGhi.map((g) => ({ question: g.question, answer: g.answer, source: NGUON_AI })),
          ...(kienThucGhi.length ? [{ question: "bo_sung", answer: kienThucGhi.join(" · "), source: NGUON_AI }] : []),
        ];
        return dongGhi.length ? aiDocThem(dongGhi, FACT_LABELS) : null;
      } catch (e) {
        await ghiLoi(client, "chat-reply boc_tach_bong", e);
        return null;
      }
    };
    const vetDuAnBangModel = async (): Promise<void> => {
      if (daVetDuAn || daGhiFactDuAn || !anthropicS || !coMuiDuAn(text)) return;
      daVetDuAn = true;
      const lid = pendingReq?.listing_id ?? sellerRow.active_listing_id ?? null;
      if (!lid) return;
      const r = await bocDuAnBangModel(anthropicS as unknown as Parameters<typeof bocDuAnBangModel>[0], MODEL, text);
      if (!r) return;
      await doTien(client, r.usage as Parameters<typeof doTien>[1]);
      const k = donKetQua(r.ket);
      // Chỉ có TÊN mà không có fact nào thì thôi: tên dự án đã có đường riêng
      // (`du_an_ten` lúc tạo tin), thêm một dòng trống nghĩa vào hàng chờ duyệt
      // chỉ làm admin mỏi mắt.
      if (!k.facts.length) return;
      const { data: l } = await client.from("listings").select("project_id").eq("id", lid).maybeSingle();
      let tenNhac: string | null = null;
      if (!l?.project_id) {
        const { data: fDuAn } = await client.from("listing_facts")
          .select("answer").eq("listing_id", lid).eq("question", "du_an_ten")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        tenNhac = fDuAn?.answer ?? k.ten_du_an ?? null;
        if (!tenNhac) return;
      }
      for (const f of k.facts) {
        const { error } = await client.rpc("ghi_fact_du_an", {
          p_project_id: l?.project_id ?? null, p_khoa: f.khoa, p_gia_tri: f.gia_tri,
          // `nguon = 'llm'` chứ không phải 'seller_chat': admin duyệt phải thấy
          // dòng này do MÁY đọc ra, để soi kỹ hơn dòng người nói thẳng.
          p_nguon: "llm", p_listing_id: lid, p_conversation_id: convSId ?? null,
          p_ten_du_an: tenNhac,
        });
        if (error) await ghiLoi(client, "chat-reply ghi_fact_du_an(llm)", error.message);
      }
    };

    let ackSua: string | null = null;
    // FR-185: bong bóng nhận ảnh (loại ảnh, đối chiếu sổ) — đứng trước lời đáp
    // chính, cùng chỗ với lời cảm ơn sửa fact.
    let ackAnh: string[] = [];
    // "Hiện thông báo cho người ta" (02/09): vừa gán nhãn thì nói thẳng cho họ
    // (`cauNhan`, tầng module). Đứng CUỐI loạt bong bóng (sau lời chào/câu hỏi
    // của model) để đúng nhịp: chào trước, giấy tờ sau.
    // Chủ dự án 09/09/2026 tối: "sẽ không báo nhãn và mức phí cho người bán nữa,
    // chỉ tự ghi nhận thôi" — nhãn CCRB/NMG gán im lặng (admin vẫn nhận việc 🆕
    // kèm nhãn), người bán chỉ thấy bong bóng "📝 Em ghi nhận" liệt kê thứ đã bóc.
    // `cauNhan` giữ lại cho khi cần bật lại; `void` để không thành biến chết.
    void cauNhan;
    let thongBaoNhan: string | null = null;
    void nhanVuaGan;
    // 11/09/2026 (giai đoạn test): đọc LẠI dòng tin từ DB sau khi mọi nhánh đã
    // ghi, để người bán thấy đúng cái hệ thống đang giữ — không phải chữ họ gõ.
    // Tắt (mặc định) thì chỉ tốn đúng MỘT lượt rpc đọc công tắc rồi dừng.
    // Hỏng ở đâu cũng không chặn lời đáp: ghi sổ lỗi rồi coi như tắt.
    // 17/09/2026 (chủ dự án): 💾 phải nói cả HỒ SƠ vừa lưu — Zalo ID (che, 4 số cuối) lượt mở hồ sơ,
    // cách gọi ("cô") lượt vừa ghi. Gán ở khối xưng hô bên dưới, đọc ở đây.
    let xungHoVuaGhi: string | null = null;
    // FR-211 (18/09/2026, chủ dự án: "làm cái gắn nhãn để tìm được luôn đi"): ý khách nói trong tin
    // này khớp từ điển nhãn đóng (`ganNhan`, tiền định) → gộp vào `listings.nhan` (RPC them_nhan_tin,
    // không trùng) và ghi fact `nhan` để 💾 báo "nhãn tìm kiếm: …". Chạy ở đường ra, sau khi mọi luật
    // đã ghi, nên tin MỚI tạo trong lượt cũng được gắn (mã ở extra.listing_code).
    // 20/09/2026 (bắn thật mau-y-A): "can 1 so hong rieng hoan cong du, can 2 tho cu 100% 2 mat tien" —
    // nhãn của CẢ câu từng dồn hết vào căn đang chăm (căn 2 mang "đã hoàn công" của căn 1). Đường
    // ghi theo căn gắn nhãn riêng từng mảnh (`rieng`) rồi bật cờ để đường ra không gắn lại cả câu.
    let nhanTheoCanDaGan = false;
    const ganNhanChoTin = async (extra: Record<string, unknown>, rieng?: { lid: string; text: string }): Promise<void> => {
      if (!rieng && nhanTheoCanDaGan) return;
      const nhanCau = ganNhan(rieng?.text ?? text);
      if (!nhanCau.length) return;
      try {
        const ma = typeof extra.listing_code === "string" && extra.listing_code ? extra.listing_code : null;
        let lid: string | null = rieng?.lid ?? null;
        if (!lid && ma) {
          const { data: lm } = await client.from("listings").select("id").eq("code", ma).eq("seller_id", sellerRow.id).maybeSingle();
          lid = (lm as { id?: string } | null)?.id ?? null;
        }
        // Tin đang chăm (active_listing_id, trigger đặt khi mở câu hỏi) > tin mới nhất của người này.
        // KHÔNG đọc `pendingReq` ở đây: closure này chạy cả ở các nhánh trả lời TRƯỚC khi nó được khai báo.
        if (!lid && !rieng) lid = sellerRow.active_listing_id ?? null;
        if (!lid) {
          const { data: ml } = await client.from("listings").select("id").eq("seller_id", sellerRow.id)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          lid = (ml as { id?: string } | null)?.id ?? null;
        }
        if (!lid) return;
        const { data: cu } = await client.from("listings").select("nhan").eq("id", lid).maybeSingle();
        const daCo = new Set(((cu as { nhan?: string[] | null } | null)?.nhan) ?? []);
        const them = nhanCau.filter((n) => !daCo.has(n));
        if (!them.length) return;
        const { error: nErr } = await client.rpc("them_nhan_tin", { p_listing_id: lid, p_nhan: them });
        if (nErr) { await ghiLoi(client, "chat-reply them_nhan_tin", nErr.message); return; }
        const { error: fErr } = await client.rpc("ghi_fact_listing", {
          p_listing_id: lid, p_question: "nhan", p_answer: tenNhan(them), p_source: "seller_chat",
        });
        if (fErr) await ghiLoi(client, "chat-reply ghi_fact_listing(nhan)", fErr.message);
      } catch (e) {
        await ghiLoi(client, "chat-reply gan nhan", e);
      }
    };
    const baoLaiDaLuu = async (
      extra: Record<string, unknown>,
    ): Promise<{ bong: string | null; cheDo: CheDoBaoLai }> => {
      try {
        // Nhánh đã tự soạn 💾 theo từng căn (fact theo căn) → không dựng 💾 chung nữa.
        if (extra.bao_lai_tat === true) return { bong: null, cheDo: "tat" };
        const { data: cd, error: cdErr } = await client.rpc("cau_hinh", { p_key: "bao_lai_da_luu" });
        if (cdErr) await ghiLoi(client, "chat-reply cau_hinh(bao_lai_da_luu)", cdErr.message);
        const cheDo = docCheDo(cd);
        if (cheDo === "tat") return { bong: null, cheDo };
        // Tin nào: mã vừa tạo trong lượt này > active_listing_id đọc LẠI (trigger
        // đổi nó ngay khi mở câu chờ mới, bản `sellerRow` đầu lượt đã cũ) > tin mới nhất.
        const ma = typeof extra.listing_code === "string" && extra.listing_code ? extra.listing_code : null;
        let lid: string | null = null;
        if (!ma) {
          const { data: sNow, error: sErr } = await client.from("sellers")
            .select("active_listing_id").eq("id", sellerRow.id).maybeSingle();
          if (sErr) await ghiLoi(client, "chat-reply bao_lai_da_luu(sellers)", sErr.message);
          lid = (sNow as { active_listing_id?: string | null } | null)?.active_listing_id ?? null;
        }
        const coTin = () => client.from("listings").select(COT_BAO_LAI).eq("seller_id", sellerRow.id);
        const { data: lRow, error: lErr } = await (
          ma ? coTin().eq("code", ma).limit(1).maybeSingle()
            : lid ? coTin().eq("id", lid).limit(1).maybeSingle()
            : coTin().order("created_at", { ascending: false }).limit(1).maybeSingle()
        );
        if (lErr) {
          await ghiLoi(client, "chat-reply bao_lai_da_luu(listings)", lErr.message);
          return { bong: null, cheDo };
        }
        const dong = (lRow ?? null) as DongBaoLai | null;
        // 14/09/2026: đúng thứ TIN KHÁCH VỪA NHẮN đã lưu — fact có `created_at` ≥ giờ
        // ghi tin đó. Cả hai mốc đều là đồng hồ DB, không so với đồng hồ edge.
        const { data: mMsg, error: mErr } = await client.from("messages").select("created_at")
          .eq("conversation_id", convSId).eq("sender", "seller")
          .order("seq", { ascending: false }).limit(1).maybeSingle();
        if (mErr) await ghiLoi(client, "chat-reply bao_lai_da_luu(moc)", mErr.message);
        const moc = (mMsg as { created_at?: string | null } | null)?.created_at ?? null;
        let factLuot: FactBaoLai[] = [];
        if (moc) {
          const { data: fs, error: fErr } = await client.from("listing_facts")
            .select("question, answer, created_at, source, listings!inner(seller_id)")
            .eq("listings.seller_id", sellerRow.id).gte("created_at", moc)
            .order("created_at", { ascending: false }).limit(40);
          if (fErr) await ghiLoi(client, "chat-reply bao_lai_da_luu(facts)", fErr.message);
          // 21/09/2026 (chủ dự án): fact AI đọc (ai_kiem) nằm CHUNG bong bóng "🤖 Đã lưu", không tách dòng.
          factLuot = (fs ?? []) as FactBaoLai[];
        }
        const hoSo = [
          sellerMoi ? `Zalo: "…${String(externalUserId).slice(-4)}"` : null,
          xungHoVuaGhi ? `cách gọi: "${xungHoVuaGhi}"` : null,
        ].filter(Boolean).join(" · ");
        const dongHoSo = hoSo ? `👤 Hồ sơ: ${hoSo}` : null;
        // 24/09/2026 (chủ dự án: "đừng đưa đã lưu nữa, mà là đã bóc tách được gì trong tin nhắn đó, tin nhắn nào
        // của khách ko bóc tách được gì thì ghi là ko bóc tách được gì"): 🤖 chỉ nói thứ bóc từ CHÍNH tin vừa nhắn,
        // giá trị trong ngoặc kép — không in lại cả tin đang nằm trong DB (quyết định 21 + 23/09 thay bằng câu này).
        // Lượt TẠO tin: cả dòng tin là thứ bóc từ câu rao → từng cột + fact lượt này mà cột chưa nói.
        if (ma) {
          const kem = kemLuotTao(factLuot, FACT_LABELS, dong);
          return { bong: [bocTachTaoTin(dong), dongHoSo, kem].filter(Boolean).join("\n") || null, cheDo };
        }
        return { bong: [vuaLuuBan(factLuot, FACT_LABELS) ?? KHONG_BOC, dongHoSo].filter(Boolean).join("\n"), cheDo };
      } catch (e) {
        await ghiLoi(client, "chat-reply bao_lai_da_luu", e);
        return { bong: null, cheDo: "tat" };
      }
    };
    const traLoiSeller = async (
      replies: string[],
      extra: Record<string, unknown> = {},
    ) => {
      // Đường ra DUY NHẤT của nhánh người bán → chỗ nối lưới vét (FR-199). Tới
      // đây thì mọi nhánh tiền định đã ghi xong, nên `daGhiFactDuAn` đã đúng.
      await vetDuAnBangModel();
      if (humanActive) {
        // FR-141 — người thật đang cầm cuộc: không gửi, không ghi dòng bot nào.
        return await hoanTat({
          reply: null, replies: [], role: "seller", human_active: true, ...extra,
        });
      }
      // Model đã tự mở bằng lời ghi nhận (thường ĐỦ hơn bong bóng code: "sửa lại
      // 6 tỷ 5 và Phường 9" so với "sửa lại Phường 9") → bỏ bong bóng code, kẻo
      // chủ nhà đọc hai lần "Dạ em sửa lại…" liền nhau (lượt bắn 12/09).
      // 22/09/2026 (bộ đo giọng B04, chủ dự án chốt): lời SỬA THẬT ("Dạ em sửa lại giá 7 tỷ 5 rồi ạ") là
      // lời xác nhận chủ nhà cần sau câu "à nhầm" — giữ nó, bỏ câu ghi nhận của model thay vì ngược lại.
      if (ackSua && replies.length && laCauGhiNhan(replies[0])) {
        if (/^Dạ em sửa lại/.test(ackSua)) replies = boCauGhiNhan(replies);
        else ackSua = null;
      }
      // 22/09/2026 (kịch bản C): "Dạ em sửa lại Phường 2 rồi ạ." + model "Phường 2 em sửa lại rồi ạ." — câu
      // model không mở bằng "Dạ em" nên `laCauGhiNhan` không thấy, và ngắn hơn ngưỡng `boCauTrung`. Đã có lời
      // sửa tiền định thì mọi câu "sửa lại … rồi" của model là lần hai.
      if (ackSua && /^Dạ em sửa lại/.test(ackSua)) replies = boCauSuaLaiModel(replies);
      replies = chanNhanLaNguoi(replies, goiNguoi ?? "mình");
      const ackDau = ackSua;
      let sach = [...(ackSua ? [ackSua] : []), ...ackAnh, ...replies, ...(thongBaoNhan ? [thongBaoNhan] : [])]
        // Model lỡ chép nguyên chữ giữ chỗ của khối nhớ tạm → thay bằng tên thật.
        .map((r) => r.split(TEN_GIU_CHO).join(tenBot).trim()).filter(Boolean);
      // 23/09/2026 (FR-218 b): khách nói bot hiểu / ghi nhầm mà không câu nào xin lỗi → chèn lời xin lỗi (trước đổi xưng hô).
      sach = themXinLoiKhiHieuNham(text, sach, goiNguoi);
      // 16/09/2026: khách là chú/cô/bác → mọi "em" (câu tiền định lẫn model) thành "cháu".
      sach = doiTuXung(sach, sellerRow.xung_ho ?? null, sellerRow.nhom_tuoi ?? null);
      // 22/09/2026: người lớn tuổi chưa rõ chú hay cô → không "anh chị", gọi "mình" (câu tiền định lẫn model).
      if (!goiNguoi && sellerRow.nhom_tuoi === "lon_tuoi") sach = sach.map((r) => r.replace(/anh\/chị|Anh\/chị|anh chị|Anh chị/g, (m) => /^[AĐ]/.test(m) ? "Mình" : "mình"));
      // 22/09/2026 (kịch bản E): khách xưng "tui" mà model hỏi "…vậy anh?" — đoán giới tính. Chưa biết cách gọi thì
      // "anh"/"chị" đứng cuối câu (trước dấu hỏi/chấm) thành "ạ"; "anh chị" (đủ cặp) và "anh Thu" không đụng.
      if (!goiNguoi) sach = sach.map((r) => r.replace(/(?<!\banh\s)(?<![\p{L}\/])(?:anh|chị)(?=\s*[?!.]|\s*$)/gu, "ạ").replace(/\bạ ạ\b/g, "ạ"));
      // 21/09/2026 (chủ dự án "làm cả 4"): chưa biết cách gọi → "anh/chị" gạch chéo là chữ máy; người bán
      // hàng thật nói "anh chị". Áp cho mọi bong bóng (tiền định lẫn model) ở một chỗ.
      if (!goiNguoi) sach = sach.map(boGachCheo);
      if (!goiNguoi && sellerRow.nhom_tuoi !== "lon_tuoi") sach = sach.map(boDoanGioiDauCau);
      // 22/09/2026 (bộ đo giọng B08): câu tiền định "Dạ em là trợ lý AI…" đứng trước, model chép lại gần
      // nguyên văn ở bong bóng sau → chủ nhà đọc hai lần. Câu ≥ 6 từ trùng nhau chỉ giữ lần đầu.
      sach = boCauTrung(sach);
      // 24/09/2026 (chủ dự án): model không tự hỏi hoàn công — cắt mệnh đề hỏi hoàn công trong lời bot, TRỪ KHI
      // bảng rẽ nhánh (FR-223) vừa mở câu `hoan_cong` cho người này (sổ riêng, chưa nhắc hoàn công).
      if (sach.some((r) => /\?/.test(r) && /\bhoan cong\b/.test(boDau(r)))) {
        const { data: lsHc, error: lsHcErr } = await client.from("listings").select("id").eq("seller_id", sellerRow.id).limit(30);
        const idsHc = (lsHc ?? []).map((x: { id: string }) => x.id);
        let coCauHc = false;
        if (lsHcErr) await ghiLoi(client, "chat-reply doc tin (hoan cong)", lsHcErr.message);
        else if (idsHc.length) {
          const { data: hc, error: hcErr } = await client.from("info_requests").select("id").in("listing_id", idsHc)
            .eq("question", "hoan_cong").eq("status", "pending").limit(1);
          if (hcErr) await ghiLoi(client, "chat-reply doc cau hoan cong", hcErr.message);
          coCauHc = (hc ?? []).length > 0;
        }
        sach = boHoiHoanCong(sach, coCauHc);
      }
      sach = sach.map(boGachDai);
      // 23/09/2026 (bắn 26 tin): "Căn góc view thoáng khó bán lắm cô" — khen mà nói ngược nghĩa.
      sach = suaKhenNguocNghia(sach);
      ackSua = null;
      ackAnh = [];
      thongBaoNhan = null;
      // 14/09/2026 — chủ dự án: "nhắn tin lại cho khách LIỀN SAU tin nhắn đó đã bóc
      // tách (thật vào db) gì luôn". Bong bóng 💾 luôn là tin ĐẦU TIÊN của lượt. Lượt
      // tạo tin thì "📝 Em ghi nhận" (ghép từ chữ khách gõ) trùng với 💾 (đọc DB) —
      // bỏ 📝 (câu "Sai chỗ nào … nhắn lại" đã bỏ hẳn 23/09/2026 — chủ dự án).
      // FR-208 bước 2: chế độ `ghi` phải CHỜ lượt AI (đã chạy song song từ đầu nhánh) để ghi
      // fact rồi báo ngay trong lượt này — "đã lưu thì phải ghi rõ lưu vào trường nào" (17/09).
      const cheDoAi = cheDoBocAi ? await cheDoBocAi : "tat";
      // 21/09/2026: ghi fact AI TRƯỚC khi 💾 đọc lại DB — dòng 🤖 riêng đã bỏ, fact AI hiện chung trong "🤖 Đã lưu".
      if (cheDoAi === "ghi" || cheDoAi === "chinh") await ghiBongBocTach(extra);
      await ganNhanChoTin(extra);
      // FR-214 (e) — SAU khi mọi đường (kể cả AI chế độ ghi/chinh) đã ghi DB: câu "cháu ghi 7 tỷ căn Quận 11" phải khớp giá thật của một tin người này đang có.
      if (sach.some((r) => /\b(?:ghi|luu|cap nhat|sua)\b/.test(boDau(r)) && CO_TIEN_KD.test(boDau(r)))) {
        const { data: giaTin, error: gtErr } = await client.from("listings").select("price_vnd").eq("seller_id", sellerRow.id).not("price_vnd", "is", null).limit(20);
        if (gtErr) await ghiLoi(client, "chat-reply doi chieu gia da ghi", gtErr.message);
        else {
          const truoc = sach;
          sach = boCauGhiTienKhongCo(sach, ((giaTin ?? []) as Array<{ price_vnd: number | string }>).map((g) => Number(g.price_vnd)), docTien);
          if (sach !== truoc) console.log("chat-reply: bỏ câu 'đã ghi' có số tiền không có trong DB");
        }
      }
      // 24/09/2026 (bắn lại người bán Gò Vấp): khách nhắn "137/28 nhé em…" (số nhà), DB đúng (diện tích trống) mà model
      // vẫn viết "137m2 trên sổ, khuôn đất này dễ xây lắm". Câu model nói số m² KHÔNG có trong tin của người này và
      // khách cũng không gõ → bỏ câu đó. Lượt ẢNH (sổ đỏ: "sổ ghi 60m2, tin ghi 50m2") là bong bóng code đọc từ ảnh — không đụng.
      if (extra.anh !== true && !imageUrl && sach.some((r) => !/^\s*(?:🤖|💾|📝|📋)/u.test(r) && M2_TRONG_CAU.test(r))) {
        const { data: dtTin, error: dtErr } = await client.from("listings").select("area_m2").eq("seller_id", sellerRow.id).not("area_m2", "is", null).limit(20);
        if (dtErr) await ghiLoi(client, "chat-reply doi chieu m2", dtErr.message);
        else {
          const truoc = sach;
          sach = boCauM2KhongCo(sach, ((dtTin ?? []) as Array<{ area_m2: number | string }>).map((d) => Number(d.area_m2)), text);
          if (sach !== truoc) console.log("chat-reply: bỏ câu model nói số m² không có trong DB");
        }
      }
      if (sach.length) {
        const bl = await baoLaiDaLuu(extra);
        if (bl.bong) {
          // 14/09/2026 (bắn thật): 💾 đã nói lưu gì, nên "Dạ em ghi số phòng ngủ 4 rồi ạ"
          // (bong bóng code) và "Dạ em ghi 1 trệt 3 lầu… rồi" (model) là ghi nhận lần hai,
          // lần ba. Bỏ bong bóng ghi nhận của code và câu ghi nhận CÓ nội dung của model.
          // 22/09/2026 (bộ đo giọng B04, chủ dự án chốt): lời SỬA THẬT ("Dạ em sửa lại giá 7 tỷ 5 rồi ạ")
          // giữ lại dù 🤖 đã in giá mới — chủ nhà vừa nói "à nhầm" cần một lời xác nhận ngắn; chỉ bỏ lời
          // "Dạ em ghi … rồi ạ" (ghi thêm) vì 🤖 đã nói đúng điều đó.
          if (ackDau && !/^Dạ em sửa lại/.test(ackDau)) sach = sach.filter((x) => x !== ackDau.trim());
          sach = boCauGhiNhan(sach);
          // 20/09/2026 (bắn thật mau-y-B): lượt đầu "Chào em, chị có…" → lời chào + "📝 Em ghi nhận" nằm
          // CHUNG một bong bóng ("Dạ em chào chị ạ!\n📝 Em ghi nhận: …"), startsWith không thấy → khách
          // đọc hai lần. Tìm dòng 📝 ở bất kỳ bong bóng nào: bỏ dòng đó, phần còn lại nối sau 💾.
          // 21/09/2026 (bắn thật kiem-cc, chú lớn tuổi): `doiTuXung` chạy TRƯỚC đoạn này nên dòng đã thành
          // "📝 Cháu ghi nhận" → startsWith("📝 Em…") không thấy → chú đọc hai lần. So theo dấu 📝 + "ghi nhận".
          const laDongGN = (d: string) => /^📝 \S+ ghi nhận/u.test(d);
          const iGN = sach.findIndex((x) => x.split("\n").some(laDongGN));
          if (iGN >= 0) {
            const dong = sach[iGN].split("\n");
            const j = dong.findIndex(laDongGN);
            const duoi = dong.slice(j + 1).join(" ").trim();
            const truoc = dong.slice(0, j).join("\n").trim();
            if (truoc) sach.splice(iGN, 1, truoc); else sach.splice(iGN, 1);
            sach.unshift(duoi ? `${bl.bong}\n${duoi}` : bl.bong);
          } else if (!sach.length) sach = [bl.bong];
          else sach.unshift(bl.bong);
          // 23/09/2026 (bắn 26 tin): lượt đầu "Chào em, chị cần bán…" → "🤖 Đã lưu …" rồi mới "Dạ em chào chị ạ!".
          // Câu chào trơn đứng sau dòng 🤖 thì đưa lên đầu.
          const iChao = sach.findIndex((x, i) => i > 0 && /^(?:Dạ,?\s+)?(?:em|cháu)\s+chào\s+[^.!?\n]{0,25}[.!]?\s*$/iu.test(x.trim()));
          if (iChao > 0 && sach[0].startsWith(DAU_BAO_LAI)) { const [chao] = sach.splice(iChao, 1); sach.unshift(chao); }
        }
      }
      // MỘT câu INSERT cho cả loạt bong bóng (FR-171 h): `seq` là identity nên
      // vẫn tăng theo thứ tự mảng trong một INSERT.
      if (sach.length) {
        const { error: botErr } = await client.from("messages").insert(
          sach.map((r) => ({ conversation_id: convSId, sender: "bot", body: r })),
        );
        // Ghi hụt câu bot vừa nói = sổ một chiều (có trả lời, không có câu hỏi).
        // Không chặn đường trả lời chủ nhà, nhưng phải vào bot_errors (FR-152).
        if (botErr) await ghiLoi(client, "chat-reply messages bot(seller)", botErr.message);
      }
      // FR-208: ghi sổ bóng SAU khi mọi luật đã ghi DB — chạy nền nếu runtime cho phép
      // (khách không phải chờ lượt model bóng), không thì chờ ngay tại đây.
      if (cheDoAi !== "ghi" && cheDoAi !== "chinh") {
        const viecBong = ghiBongBocTach(extra);
        const nen = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
        if (nen?.waitUntil) nen.waitUntil(viecBong);
        else await viecBong;
      }
      return await hoanTat({
        reply: sach.join("\n") || null, replies: sach, role: "seller", ...extra,
      });
    };

    // ─── FR-176: NGỮ CẢNH CHUNG cho mọi lượt gọi model của nhánh người bán.
    // Trước bản này mỗi lượt là một cuộc gọi CỤT: model chỉ thấy đúng một câu
    // lệnh "chủ nhà vừa trả lời X, khen rồi hỏi Y", không thấy 5 tin trước —
    // nên tin nào cũng cùng khuôn (khen + mã căn + hỏi + "khách hay hỏi lắm"),
    // và "kêu chị nha" sống đúng một lượt rồi câu sau lại "anh". Sếp đọc log
    // 07/09/2026: "con AI nhắn không tự nhiên". Nay: 8 tin gần nhất + cách gọi
    // đã dặn (`sellers.xung_ho`, migration 20260907d) đi vào MỌI lượt.
    // 11/09/2026 (42 ca): khách TỰ XƯNG ("anh bận", "e oi a can ban nha", "chị Lan
    // đây em") cũng là lời dặn — chưa biết gọi sao thì nhận luôn, lời dặn tường
    // minh ("kêu chị nha") vẫn thắng và vẫn đổi được cách gọi cũ.
    // 16/09/2026 (Zalo thật): "Chào cháu chú có căn nhà…" → gọi "chú", tự xưng "cháu", và
    // ghi luôn giới tính + nhóm tuổi suy từ cách gọi (`sellers.gioi_tinh/nhom_tuoi`, 20260916a).
    // 17/09/2026 (Zalo thật): khách đổi "chú" → "cô" giữa chừng mà bot vẫn gọi "chú" — cách tự
    // xưng MỚI NHẤT thắng, không chỉ nhận lần đầu.
    const xungHoMoi = batXungHo(text) ?? tuXungTuCau(text);
    if (xungHoMoi && xungHoMoi !== sellerRow.xung_ho) {
      const { error: xhErr } = await client.from("sellers")
        .update({ xung_ho: xungHoMoi, ...suyTuXungHo(xungHoMoi) }).eq("id", sellerRow.id);
      if (xhErr) await ghiLoi(client, "chat-reply sellers.xung_ho", xhErr.message);
      else { sellerRow.xung_ho = xungHoMoi; xungHoVuaGhi = xungHoMoi; }
    }
    // 22/09/2026 (chủ dự án: "cô chào cháu nó vẫn đáp anh chị"): "chào cháu" mà không xưng chú/cô → biết là
    // người lớn tuổi, chưa biết chú hay cô: bot xưng cháu, gọi "mình", không "anh chị" (`nhom_tuoi` ghi trước,
    // `xung_ho` chờ câu có xưng). Hồ sơ bán vừa mở từ hàng mua thì mang cách gọi đã học ở lượt chào sang.
    if (!xungHoMoi && !sellerRow.xung_ho) {
      let nhomMoi: "lon_tuoi" | null = laChaoChau(text) ? "lon_tuoi" : null;
      let xhTuMua: XungHo | null = null;
      if (sellerMoi) {
        const { data: bPref } = await client.from("buyers").select("preferences").eq("zalo_user_id", externalUserId).maybeSingle();
        const p = (bPref?.preferences ?? {}) as { xung_ho?: unknown; nhom_tuoi?: unknown };
        if (typeof p.xung_ho === "string" && XUNG_HO_HOP_LE.has(p.xung_ho)) xhTuMua = p.xung_ho as XungHo;
        else if (p.nhom_tuoi === "lon_tuoi") nhomMoi = "lon_tuoi";
      }
      if (xhTuMua) {
        const { error: xmErr } = await client.from("sellers").update({ xung_ho: xhTuMua, ...suyTuXungHo(xhTuMua) }).eq("id", sellerRow.id);
        if (xmErr) await ghiLoi(client, "chat-reply sellers.xung_ho(tu mua)", xmErr.message);
        else { sellerRow.xung_ho = xhTuMua; sellerRow.nhom_tuoi = suyTuXungHo(xhTuMua).nhom_tuoi; }
      } else if (nhomMoi && sellerRow.nhom_tuoi !== "lon_tuoi") {
        const { error: ntErr } = await client.from("sellers").update({ nhom_tuoi: nhomMoi }).eq("id", sellerRow.id);
        if (ntErr) await ghiLoi(client, "chat-reply sellers.nhom_tuoi", ntErr.message);
        else sellerRow.nhom_tuoi = nhomMoi;
      }
    }
    // FR-181: ghi tên trợ lý vào hồ sơ người bán MỘT lần (lượt đầu) — CRM và
    // `so.nguoi_ban` đọc cột này để biết "T•ai" đang chăm ai.
    if (!sellerRow.ten_tro_ly) {
      const { error: tenErr } = await client.from("sellers")
        .update({ ten_tro_ly: tenBot }).eq("id", sellerRow.id).is("ten_tro_ly", null);
      if (tenErr) await ghiLoi(client, "chat-reply sellers.ten_tro_ly", tenErr.message);
      else sellerRow.ten_tro_ly = tenBot;
    }
    const goiNguoi = sellerRow.xung_ho ?? null;
    const lonTuoiChuaRo = !goiNguoi && sellerRow.nhom_tuoi === "lon_tuoi";
    const cachGoi = goiNguoi ?? (lonTuoiChuaRo ? "mình" : "anh/chị");
    // Bot tự xưng "cháu" với chú/cô/bác (mọi câu tiền định viết "em" → đổi ở đường ra `sach`).
    const tuXung = lonTuoiChuaRo ? "cháu" : tuXungBot(goiNguoi);
    // Câu phí tiền định cho hỏi ngược (FEE_RULES, theo nhãn) — 15/09/2026.
    const phiCauSeller = sellerRow.seller_type === "nmg"
      ? "phí bên em chỉ thu khi giao dịch thành công, 0,5% giá chốt"
      : "phí bên em chỉ thu khi giao dịch thành công, 1% giá chốt";
    const CachGoi = goiNguoi ? goiNguoi.charAt(0).toUpperCase() + goiNguoi.slice(1) : lonTuoiChuaRo ? "Mình" : "Anh/chị";
    // Điền ô cho câu tiền định (FR-138 b). Ô thiếu dữ liệu → câu rỗng, tầng gọi bỏ.
    const cauTD = (khoa: string, o: Record<string, string | number | null | undefined> = {}) =>
      dienCau(CAU_TD[khoa] ?? "", { ac: cachGoi, Ac: CachGoi, web: "AI Ơi Nhà Đất", ten: tenBot, ...o });
    const [{ data: lichSuS }, { data: tinCuaNguoi }] = await Promise.all([
      client.from("messages").select("sender, body, seq")
        .eq("conversation_id", convSId).order("seq", { ascending: false }).limit(9),
      // FR-214 b: danh sách tin người này đang rao — `nhieuCan` đếm, bộ gán mảnh đọc mã/loại/nơi chốn/giá.
      client.from("listings").select("id, code, status, property_type, district, ward, street, location_raw, price_raw, area_m2")
        .eq("seller_id", sellerRow.id).order("created_at", { ascending: true }).limit(10),
    ]);
    // Mã căn chỉ đáng nhắc khi người này rao TỪ HAI CĂN trở lên (FR-157 c sinh
    // ra cho người nhiều căn). Chính chủ một căn mà tin nào cũng "#BDS-Q5-0174"
    // là giọng máy đọc mã.
    const nhieuCan = (tinCuaNguoi ?? []).length >= 2;
    // Tin chủ nhà VỪA nhắn đã nằm trong sổ (ghi trước khi gọi model) — bỏ nó
    // khỏi lịch sử vì câu lệnh dẫn riêng.
    const lichSuRows = ((lichSuS ?? []) as Array<{ sender: string; body: string | null; seq: number }>)
      .slice().reverse();
    if (lichSuRows.length && laTinNguoi(lichSuRows[lichSuRows.length - 1].sender)) lichSuRows.pop();
    // Bong bóng 💾 (báo lại thứ đã lưu) là bảng số liệu cho người bán, không
    // phải lời em nói — bỏ khỏi lịch sử, không thì model bắt chước in bảng.
    // 18/09/2026 (chủ dự án: "tắt cái mỗi câu trả lời đều khen đi, lâu lâu thì khen thôi"): 3 tin gần
    // nhất của bot đã có câu khen → lượt này dặn model KHÔNG khen, và lọc tiền định câu khen lọt.
    const khenGanDay = vuaKhen(lichSuRows.filter((m) => !laTinNguoi(m.sender)).map((m) => boBaoLai(m.body)));
    const lichSuText = lichSuRows.map((m) => ({ ...m, body: boBaoLai(m.body) })).filter((m) => m.body)
      .map((m) =>
        `${laTinNguoi(m.sender) ? "CHỦ NHÀ" : m.sender === "human" ? "EM (người thật bên mình nhắn tay)" : "EM"}: ${
          (m.body ?? "").slice(0, 300)
        }`)
      .join("\n");
    let boiCanh =
      `NGỮ CẢNH (đọc kỹ trước khi viết):\n` +
      `- Gọi chủ nhà là "${cachGoi}"${
        goiNguoi ? ` - chủ nhà đã dặn, tuyệt đối không đổi, không dùng "anh/chị"` : ` (chưa biết nam hay nữ - KHÔNG tự đoán "anh" hay "chị"; gọi "mình" hoặc bỏ đại từ)`
      }${tuXung === "cháu" ? `; tự xưng "cháu" (chủ nhà lớn tuổi), KHÔNG xưng "em"` : ""}.\n` +
      `- Lịch sử gần nhất, tin mới ở cuối. KHÔNG lặp lại khuôn câu, lời khen, hay lý do "khách hay hỏi" đã dùng trong đó; tin trước của em mở bằng "Dạ" thì tin này đừng mở bằng "Dạ"; viết như người thật nhắn tay, mỗi tin một giọng:\n` +
      `${lichSuText || "(chưa có tin nào trước đó)"}\n\n`;

    // Người bán ĐÃ có nhãn mà tự xưng ngược lại ("em là môi giới mà" khi đang
    // CHÍNH CHỦ; "tôi là chính chủ" khi đang MÔI GIỚI) → KHÔNG tự lật (nhãn có
    // thể do admin gán), mà báo admin xác nhận + nói với họ là đã báo. Tối đa
    // một lần mỗi 24h cho mỗi người, kẻo mỗi câu "em là sale" là một việc.
    const xinDoiNhan: "ccrb" | "nmg" | null = nhanVuaGan
      ? null
      : sellerRow.seller_type === "ccrb" && tinHieuMoiGioi
      ? "nmg"
      : sellerRow.seller_type === "nmg" &&
          khop(/chính chủ|tôi là chủ|nhà của tôi|không phải môi giới/i, /chinh chu|toi la chu|nha cua toi|khong phai moi gioi/)
      ? "ccrb"
      : null;
    if (xinDoiNhan) {
      const dau = `✏️ Zalo …${externalUserId.slice(-4)}`;
      const { count: daBao } = await client.from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("kind", "escalation").in("status", ["pending", "sent"])
        .ilike("note", `${dau}%`)
        .gte("created_at", new Date(Date.now() - 24 * 3600e3).toISOString());
      if ((daBao ?? 0) === 0) {
        const { error: xErr } = await client.from("reminders").insert({
          kind: "escalation", due_at: new Date().toISOString(),
          note: `${dau}${sellerRow.name ? ` (${sellerRow.name})` : ""} đang nhãn ${
            sellerRow.seller_type === "nmg" ? "MÔI GIỚI" : "CHÍNH CHỦ"
          } nhưng tự xưng ${xinDoiNhan === "nmg" ? "MÔI GIỚI" : "CHÍNH CHỦ"}: "${text.slice(0, 120)}". Xác nhận rồi đổi ở /admin.`,
        });
        if (xErr) await ghiLoi(client, "chat-reply xin doi nhan", xErr.message);
      }
      thongBaoNhan = xinDoiNhan === "nmg"
        ? "Dạ em ghi nhận anh/chị là môi giới, em đã báo bên quản lý cập nhật lại (phí bán 0,5% khi giao dịch thành công) nha."
        : "Dạ em ghi nhận anh/chị là chính chủ, em đã báo bên quản lý cập nhật lại (phí bán 1% khi giao dịch thành công) nha.";
    }

    // NEO NGỮ CẢNH THEO CĂN, không theo "câu hỏi mới nhất" (FR-157).
    // Người bán 2-3 căn, cả hai đều đang thiếu thông tin: bot vừa hỏi căn B,
    // chủ nhớ ra chuyện căn A và nhắn "căn A hoàn công 2020 nha em" — lấy
    // `limit 1` theo created_at là ghi thẳng dữ liệu căn A vào căn B. Sai kiểu
    // này KHÔNG bao giờ tự lộ: fact vẫn có, tin vẫn lên web, chỉ là sai nhà.
    // Thứ tự tin cậy: mã tin chủ tự nhắc > căn bot vừa hỏi > câu mới nhất.
    // Một dãy mã duy nhất kể từ FR-158 — nhánh `CCRB-` cũ bỏ đi vì kho chưa bao
    const codeInText =
      /(bds-[a-z0-9]+(?:-[a-z0-9]+)+)/.exec(tKD)?.[1]?.toUpperCase() ?? null;
    // Câu hỏi chờ + huỷ nhắc-lời-hứa cũ (FR-133) chạy song song: hai việc
    // không nhìn nhau (FR-171 h). Embed lấy luôn `status` của tin để khối drip
    // bên dưới khỏi hỏi lại.
    type PendRow = {
      id: string; listing_id: string; question: string; answer?: string | null;
      created_at?: string | null;
      listings: {
        code: string | null; status?: string | null;
        location_raw: string | null; ward?: string | null; unit_code?: string | null;
        property_type?: string | null; project_id?: string | null; area_m2?: number | null;
        district?: string | null; deal?: string | null;
        frontage_m?: number | string | null; length_m?: number | string | null; // 24/09: ghép "dài 16m" với ngang đã có
        boc_tach?: unknown; // FR-212: đọc `duong_goi_y` không tốn thêm truy vấn
      };
    };
    const [{ data: pendings }] = await Promise.all([
      client
        .from("info_requests")
        .select("id, listing_id, question, answer, created_at, listings!inner(seller_id, code, status, location_raw, ward, district, deal, unit_code, property_type, project_id, area_m2, frontage_m, length_m, boc_tach)")
        .eq("listings.seller_id", sellerRow.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      client.from("reminders").update({ status: "cancelled" })
        .eq("seller_id", sellerRow.id).eq("kind", "promise").eq("status", "pending"),
    ]);
    const ds = (pendings ?? []) as unknown as PendRow[];
    // 22/09/2026 (kịch bản E): câu CHẤM ĐIỂM treo sau "bán rồi" nuốt "mở lại căn 2", "rao lại căn chung cư" thành
    // điểm chấm. Câu điểm chỉ nhận ĐIỂM (số/10) hoặc nhận xét ngắn không mang việc; câu khác → thôi câu điểm
    // (hỏi một lần là đủ), tin đi đường thường.
    const laDiemCham = (s: string) => {
      const kd = boDau(s);
      if (/(?:^|[^\d])(10|[0-9])\s*(?:\/\s*10|diem|d\b)/.test(kd)) return true;
      return kd.split(/\s+/).length <= 8 && !/\b(?:rao|dang|mo|xoa|sua|len|bo|go|gui|hoi|can \d)\b/.test(kd) &&
        /\b(?:tot|hay|on|duoc|ok|giong nguoi|tu nhien|hai long|nhiet tinh|cham|kha|te|do|cam on)\b/.test(kd);
    };
    // Câu HỎI ("có khách nào hỏi chưa em") không phải điểm nhưng cũng không đóng câu điểm — `hoiVeTin` đỡ rồi hỏi lại.
    const boDiem = ds.filter((p) => p.question === "danh_gia" && !laDiemCham(text) && !laCauHoiTron(text) && !hoiVeTin(text));
    if (boDiem.length) {
      const { error: bdErr } = await client.from("info_requests").update({ status: "expired" }).in("id", boDiem.map((p) => p.id));
      if (bdErr) await ghiLoi(client, "chat-reply thoi cau danh_gia", bdErr.message);
    }
    const dsDung = ds.filter((p) => !boDiem.some((b) => b.id === p.id));
    const pendingReq: PendRow | null =
      (codeInText ? dsDung.find((p) => p.listings?.code?.toUpperCase() === codeInText) : null) ??
      (sellerRow.active_listing_id
        ? dsDung.find((p) => p.listing_id === sellerRow.active_listing_id)
        : null) ??
      dsDung[0] ?? null;

    // ─── FR-214 (b)(d), 23/09/2026 — MỘT NGƯỜI NHIỀU CĂN. "15 tỉ nhé cháu còn nhà ở quận 11 cũ muốn 7 tỉ" trả lời
    // câu giá của lô đất VÀ nói giá căn nhà Q11; bản cũ ghi cả câu vào lô đất (kèm "Quận 11"), rồi model nói
    // "cháu ghi 7 tỷ căn Quận 11" trong khi chẳng có gì được ghi. Người rao ≥ 2 tin mà câu có dấu hiệu nói tới
    // căn khác (`canGanManh`, tiền định) → một lượt model ĐỌC LẠI hội thoại + danh sách tin, chia câu thành
    // mảnh theo mã tin (chủ dự án: "nếu bot confusion chỗ nào thì có thể đọc lại cả hội thoại"). Mảnh của
    // căn KHÁC ghi thẳng vào căn đó (chỉ dữ kiện mới — không vị trí/quận/loại, đó là lời GỌI căn); mảnh "MOI"
    // mở tin mới; phần còn lại mới là câu trả lời cho câu đang treo — và AI bóc tách chỉ đọc phần đó.
    type TinMo = { id: string; code: string | null; status?: string | null; property_type?: string | null; district?: string | null; ward?: string | null; street?: string | null; location_raw?: string | null; price_raw?: string | null; area_m2?: number | string | null };
    const dsMo = ((tinCuaNguoi ?? []) as TinMo[])
      .filter((t) => !!t.code && ["cho_thong_tin", "dang_ban", "dang_quan_tam"].includes(t.status ?? ""));
    let textTreo: string | null = null;
    let daTraCauTreo = false; // mảnh ghi theo tin đã trả lời luôn câu đang treo (vd "80m2 giá 15 tỷ" khi đang hỏi diện tích)
    const maTreo = pendingReq?.listings?.code?.toUpperCase() ?? null;
    if (anthropicS && !codeInText && canGanManh(text, dsMo.map((t) => ({ ...t, code: t.code! })), maTreo)) {
      try {
        const { data: lsDai, error: lsErr } = await client.from("messages").select("sender, body, seq")
          .eq("conversation_id", convSId).order("seq", { ascending: false }).limit(40);
        if (lsErr) await ghiLoi(client, "chat-reply gan manh(lich su)", lsErr.message);
        const hoiThoai = ((lsDai ?? []) as Array<{ sender: string; body: string | null }>).reverse()
          .map((m) => `${laTinNguoi(m.sender) ? "CHỦ NHÀ" : "EM"}: ${(boBaoLai(m.body ?? "") ?? "").slice(0, 300)}`).join("\n");
        const moTaTin = (t: TinMo) => [LOAI_VI[t.property_type ?? ""] ?? t.property_type ?? "chưa rõ loại",
          [t.location_raw ?? t.street, t.ward, t.district].filter(Boolean).join(", ") || "chưa rõ nơi chốn",
          t.price_raw ?? "chưa có giá", t.area_m2 ? `${Number(t.area_m2)}m2` : null].filter(Boolean).join(" · ");
        const dsTin = dsMo.map((t) => `${t.code} · ${moTaTin(t)}`).join("\n");
        const cauTreo = pendingReq && maTreo ? `${maTreo} — ${(FACT_LABELS[pendingReq.question] ?? pendingReq.question).replace(/\s*\(.*\)\s*$/, "")}` : null;
        const r = await ganManhBangModel(anthropicS as unknown as Parameters<typeof ganManhBangModel>[0], MODEL, { hoiThoai, dsTin, cauTreo, text });
        if (r) {
          await doTien(client, r.usage as Parameters<typeof doTien>[1]);
          const manh = donManh(r.ket, text, dsMo.map((t) => t.code!));
          // Bắn thật 23/09: đang hỏi DIỆN TÍCH lô đất, "15 tỉ nhé cháu" model gán đúng lô đất nhưng đó là GIÁ chứ không
          // phải câu trả lời diện tích → bản trước để nó làm câu trả lời, ra "thông tin bổ sung: 15 tỉ nhé cháu". Mảnh
          // của căn đang treo mà có SỐ TIỀN rõ trong lúc câu đang treo không phải giá thì ghi như mảnh căn khác.
          const TIEN_RO = /\d+(?:[.,]\d+)?\s*(?:tỷ|tỉ|ty|ti|tỏi|toi|triệu|trieu|tr)(?![\p{L}])/iu;
          const laTreo = (m: { ma: string; trich: string }) => m.ma === "KHONG" ||
            (!!maTreo && m.ma === maTreo && !(pendingReq?.question !== "gia" && TIEN_RO.test(m.trich)));
          if (manh.some((m) => !laTreo(m))) {
            const dongGhi: string[] = [];
            for (const m of manh.filter((x) => !laTreo(x))) {
              let tin = dsMo.find((t) => t.code!.toUpperCase() === m.ma) ?? null;
              if (m.ma === "MOI") {
                const kdM = boDau(m.trich);
                const loaiM = /\b(?:dat|manh dat|lo dat|dat nen)\b/.test(kdM) ? "dat" : /\b(?:can ho|chung cu)\b/.test(kdM) ? "chung_cu" : /\bnha\b/.test(kdM) ? "nha_pho" : "chua_ro";
                const { data: moi, error: moiErr } = await client.from("listings").insert({
                  code: null, seller_id: sellerRow.id, deal: "ban", property_type: loaiM, status: "cho_thong_tin", can_chu_duyet: true,
                  district: bocQuan(kdM, m.trich) ?? vungNgoai(kdM)?.ten ?? null, description: m.trich,
                }).select("id, code, status, property_type, district, location_raw, price_raw").single();
                if (moiErr || !moi) { await ghiLoi(client, "chat-reply gan manh(mo tin)", moiErr?.message ?? "insert null"); continue; }
                let vt = bocViTriRao(m.trich);
                // Căn hộ ("còn căn hộ Sunrise City quận 7…") → tra kho dự án như đường rao thường (FR-114).
                if (loaiM === "chung_cu") {
                  const { data: daM, error: daMErr } = await client.rpc("match_projects", { p_text: m.trich });
                  if (daMErr) await ghiLoi(client, "chat-reply gan manh(du an)", daMErr.message);
                  const da = ((daM ?? []) as DuAnKho[])[0];
                  if (da) {
                    const { error: daUp } = await client.from("listings").update({ project_id: da.id, unit_status: "con_ban", last_confirmed_at: new Date().toISOString(), ...(da.district && !moi.district ? { district: da.district } : {}) }).eq("id", moi.id);
                    if (daUp) await ghiLoi(client, "chat-reply gan manh(gan du an)", daUp.message);
                    if (!vt) vt = da.location_raw ? `${da.name}, ${da.location_raw}` : da.name;
                  }
                }
                if (vt) {
                  const { error: vtErr } = await client.rpc("ghi_fact_listing", { p_listing_id: moi.id, p_question: "vi_tri", p_answer: vt, p_source: "seller_chat" });
                  if (vtErr) await ghiLoi(client, "chat-reply gan manh(vi_tri moi)", vtErr.message);
                }
                tin = moi as TinMo;
              }
              if (!tin) continue;
              const nhan: string[] = [];
              // Giá chỉ lấy khi mảnh có SỐ TIỀN rõ ("muốn 7 tỉ") — bộ nhận fact đọc "quận 11 cũ muốn…" ra giá "11 cũ".
              const facts = nhanDienNhieuFact(m.trich)
                .filter((f) => f.question !== "gia" && (!["vi_tri", "phuong", "quan", "bo_sung", "loai_bds", "loai_giao_dich"].includes(f.question) || m.ma === "MOI"));
              const tienM = /(\d+(?:[.,]\d+)?\s*(?:tỷ|tỉ|ty|ti|tỏi|toi|triệu|trieu|tr)(?![\p{L}])(?:\s*\d{1,3})?)/iu.exec(m.trich);
              if (tienM && docTien(tienM[1]) != null) facts.push({ question: "gia", answer: tienM[1].trim() } as typeof facts[number]);
              for (const f of facts) {
                if (f.question === "vi_tri" && m.ma === "MOI") continue; // đã ghi ở trên
                const { error: fErr } = await client.rpc("ghi_fact_listing", { p_listing_id: tin.id, p_question: f.question, p_answer: f.answer, p_source: "seller_chat" });
                if (fErr) { await ghiLoi(client, `chat-reply gan manh(${f.question})`, fErr.message); continue; }
                // Bắn thật 23/09: fact pháp lý mang nguyên mảnh câu ("Nhà phố mà thổ cư full … shr") — cột đã đọc ra
                // `so_hong_rieng`, dòng 📝 thì in cột đó ("sổ hồng riêng"), không in lại cả câu khách gõ.
                let hienThi = f.answer;
                if (f.question === "phap_ly") {
                  const { data: lg } = await client.from("listings").select("legal_status").eq("id", tin.id).maybeSingle();
                  const ma = (lg as { legal_status?: string | null } | null)?.legal_status;
                  if (ma && LEGAL_VI[ma]) hienThi = LEGAL_VI[ma];
                }
                nhan.push(`${(FACT_LABELS[f.question] ?? f.question).replace(/\s*\(.*\)\s*$/, "")} ${hienThi}`);
                if (pendingReq && tin.id === pendingReq.listing_id && f.question === pendingReq.question) daTraCauTreo = true;
                const { error: irErr } = await client.from("info_requests").update({ status: "answered", answer: m.trich, answered_at: new Date().toISOString() })
                  .eq("listing_id", tin.id).eq("question", f.question).eq("status", "pending");
                if (irErr) await ghiLoi(client, "chat-reply gan manh(dong cau)", irErr.message);
              }
              const ten = [LOAI_VI[tin.property_type ?? ""] ?? null, tin.location_raw ?? tin.district ?? null].filter(Boolean).join(" ");
              if (m.ma === "MOI") dongGhi.push(`mở tin mới ${tin.code ?? ""}${ten ? ` (${ten})` : ""}${nhan.length ? `: ${nhan.join(" · ")}` : ""}`);
              else if (nhan.length) dongGhi.push(`tin ${tin.code}${ten ? ` (${ten})` : ""}: ${nhan.join(" · ")}`);
            }
            if (dongGhi.length) ackAnh.push(`📝 ${doiTuXung([`Em ghi vào ${dongGhi.join("; ")}.`], sellerRow.xung_ho ?? null, sellerRow.nhom_tuoi ?? null)[0]}`);
            textTreo = manh.filter(laTreo).map((m) => m.trich).join(". ").trim();
            console.log("chat-reply: gán mảnh theo tin", JSON.stringify(manh.map((m) => [m.ma, m.trich.slice(0, 40)])));
          }
        }
      } catch (e) {
        await ghiLoi(client, "chat-reply gan manh", e);
      }
    }
    // Mọi mảnh đã đi căn khác, không còn gì trả lời câu đang treo → nhắc lại câu đó (không ghi gì vào căn đang treo).
    if (textTreo === "" && pendingReq && !daTraCauTreo && !humanActive) {
      return await traLoiSeller([cauHoiMau(pendingReq.question, cachGoi, pendingReq.listings?.property_type, pendingReq.listings?.district, pendingReq.listings?.deal)], { gan_manh: true });
    }
    if (textTreo === "" && !humanActive) return await traLoiSeller([], { gan_manh: true });
    // Đã chia mảnh theo tin → phần còn lại chỉ là câu trả lời cho căn đang treo: các cờ "rao căn mới" bên dưới
    // (đọc CẢ câu) không được mở thêm tin — "cháu còn nhà ở quận 11 cũ" đã về đúng tin quận 11 rồi.
    const daGanManh = textTreo !== null;

    // FR-208 (14/09/2026): AI bóc tách CHẠY BÓNG, song song với toàn bộ luật bên dưới. Chỉ
    // khởi động ở đây (cần biết câu bot đang hỏi); kết quả kiểm + so với DB ghi ở đường ra
    // `traLoiSeller`, sau khi đã trả lời khách. Công tắc `app_config.boc_tach_ai`.
    if (anthropicS && coMuiDuLieuRao(text)) {
      const tBong = Date.now();
      const ai = anthropicS;
      cheDoBocAi = (async () => {
        const { data: cd, error: cdErr } = await client.rpc("cau_hinh", { p_key: "boc_tach_ai" });
        if (cdErr) await ghiLoi(client, "chat-reply cau_hinh(boc_tach_ai)", cdErr.message);
        return String(cd ?? "tat").trim();
      })().catch(() => "tat");
      bongAi = (async () => {
        const cheDo = await cheDoBocAi!;
        if (cheDo !== "bong" && cheDo !== "ghi" && cheDo !== "chinh") return null;
        // FR-214 b: đã chia mảnh theo căn → AI bóc tách chỉ đọc phần thuộc căn đang treo.
        const r = await bocRaoBangModel(ai as unknown as Parameters<typeof bocRaoBangModel>[0], MODEL, textTreo || text, pendingReq?.question ?? null);
        return { ...r, ms: Date.now() - tBong, cauDangHoi: pendingReq?.question ?? null, cheDo };
      })().catch(async (e) => {
        await ghiLoi(client, "chat-reply boc_tach_ai(bong)", e);
        return null;
      });
    }

    // Seller hứa "chiều gửi ảnh…" → đặt hẹn nhắc (SAU khi huỷ nhắc cũ ở trên,
    // kẻo lệnh huỷ chạy sau lại huỷ luôn nhắc vừa đặt)
    if (khop(PROMISE_RE, PROMISE_RE_KD)) {
      await client.from("reminders").insert({
        kind: "promise", seller_id: sellerRow.id,
        due_at: mapDue(text), note: text.slice(0, 200),
      });
    }
    // (Cổng câu rao mới `wantsSell` tính ở TRÊN nhánh này — FR-159 cần nó trước
    //  khi biết người nhắn có phải người bán hay không.)

    // ─── FR-114 mở rộng (09/09/2026, chat Gemini 21/06 "Sunrise City có hồ bơi
    // Olympic"): bot TỰ LÔI KIẾN THỨC DỰ ÁN ra khi chủ nhà nhắc tên dự án có
    // trong kho, hoặc căn đang hỏi đã gắn dự án. Kho là bảng `projects` (admin
    // nhập) — không có trong kho thì không bịa. Chỉ gọi `match_projects` khi câu
    // có dấu hiệu tên dự án, kẻo mỗi tin chủ nhà tốn thêm một vòng DB (FR-171 h).
    type DuAnKho = {
      id: string; name: string; developer?: string | null; district?: string | null;
      location_raw?: string | null; amenities?: unknown; description?: string | null; status_text?: string | null;
    };
    const coDauHieuDuAn = /\b(du an|chung cu|can ho|khu|city|plaza|residence|residences|tower|towers|park|garden|riverside|home|homes|villa|villas|ny'?ah|sunrise|vinhomes|masteri|akari|carina)\b/.test(tKD);
    const [duAnNoi, duAnCanHoi] = await Promise.all([
      coDauHieuDuAn
        ? client.rpc("match_projects", { p_text: text }).then((r) => ((r.data ?? []) as DuAnKho[]).slice(0, 1))
        : Promise.resolve([] as DuAnKho[]),
      pendingReq?.listings?.project_id
        ? client.from("projects").select("id, name, developer, district, location_raw, amenities, description, status_text, specs")
          .eq("id", pendingReq.listings.project_id).maybeSingle().then((r) => (r.data ? [r.data as DuAnKho] : []))
        : Promise.resolve([] as DuAnKho[]),
    ]);
    const duAnBiet = [...duAnNoi, ...duAnCanHoi.filter((d) => !duAnNoi.some((x) => x.id === d.id))].slice(0, 2);
    if (duAnBiet.length) {
      const dong = duAnBiet.map((p) => {
        const tienIch = Array.isArray(p.amenities) ? (p.amenities as string[]).slice(0, 12).join(", ") : "";
        const ts = (p as { specs?: Record<string, unknown> | null }).specs;
        return `• ${p.name}${p.developer ? ` - CĐT ${p.developer}` : ""}${p.location_raw || p.district ? ` · ${p.location_raw ?? p.district}` : ""}${ts ? ` · thông số: ${JSON.stringify(ts)}` : ""}${tienIch ? ` · tiện ích: ${tienIch}` : ""}${p.status_text ? ` · ${p.status_text}` : ""}${p.description ? ` · ${String(p.description).slice(0, 400)}` : ""}`;
      }).join("\n");
      boiCanh += `DỰ ÁN (kiến thức ĐÃ XÁC THỰC trong kho - khen bằng đúng MỘT tiện ích/đặc điểm ở đây khi hợp mạch, KHÔNG bịa tiện ích khác. ${"MỌI CON SỐ về dự án (diện tích từng loại căn, số căn, số tầng, giá, phí, năm bàn giao) CHỈ được lấy nguyên văn từ khối này. Không có ở đây thì nói thẳng 'con số đó em xác nhận lại rồi báo anh/chị' — TUYỆT ĐỐI không lấy từ trí nhớ của mình, kể cả khi thấy quen. "}):\n${dong}\n\n`;
      // Căn đang hỏi chưa gắn dự án mà chủ nhà vừa nhắc đúng tên → gắn luôn.
      if (duAnNoi[0] && pendingReq && !pendingReq.listings?.project_id && !wantsSell) {
        const { error: gdErr } = await client.from("listings").update({ project_id: duAnNoi[0].id })
          .eq("id", pendingReq.listing_id).is("project_id", null);
        if (gdErr) await ghiLoi(client, "chat-reply gan du an", gdErr.message);
      }
    }

    // ─── FR-184 (chat Gemini 21/06, chủ dự án chốt 09/09/2026): CHỦ NHÀ BÁO
    // "BÁN RỒI" / "NGƯNG BÁN". Tiền định (`laNgungRao`), không model. Một căn
    // đang rao → đóng ngay (bán rồi → `da_chot`, trigger FR-108 báo khách đang
    // chờ; rút → `an`), đóng mọi câu treo, huỷ nhắc, ghi `boc_tach.ket_thuc`.
    // Nhiều căn → liệt kê hỏi căn nào (câu chờ `ngung_rao_can_nao`, đáp án đọc
    // bằng `chonCanTheoCau`: số thứ tự hoặc địa chỉ). "Chốt rồi / ok đăng đi" lúc
    // đang DUYỆT BẢN NHÁP là gật, không phải báo bán — nhường cho khối duyệt.
    const dangChonCanNgung = pendingReq?.question === "ngung_rao_can_nao";
    // Xin chủ nhà chấm điểm cách chăm sóc — MỘT lần cho mỗi tin. 09/09/2026 đặt ở cuối vòng hỏi
    // ("đủ rồi" / hết câu); 22/09/2026 (bắn thật, chủ dự án "mục 5 dời đi"): hỏi ngay sau khi vừa
    // đăng tin đứng sai chỗ về giọng và nuốt câu hỏi kế của chủ nhà — nay chỉ hỏi sau SỰ KIỆN THẬT:
    // chủ nhà báo BÁN ĐƯỢC (chúc mừng xong mới xin điểm). Mở câu chờ `danh_gia`; đã từng mở thì thôi.
    const xinChamDiem = async (listingId: string): Promise<string | null> => {
      const { data: daXin } = await client.from("info_requests").select("id")
        .eq("listing_id", listingId).eq("question", "danh_gia").limit(1);
      if (daXin?.length) return null;
      const { error: irErr } = await client.from("info_requests").insert({
        listing_id: listingId, question: "danh_gia", status: "pending",
      });
      if (irErr) {
        if (irErr.code !== "23505") await ghiLoi(client, "chat-reply mo danh_gia", irErr.message);
        return null;
      }
      return cauHoiMau("danh_gia", cachGoi);
    };
    const kieuNgung: NgungRao | null = dangChonCanNgung
      ? ((pendingReq?.answer === "rut" ? "rut" : "ban_roi") as NgungRao)
      : (pendingReq?.question === "duyet_tin" && laDongY(text)) ? null : laNgungRao(text);
    if (kieuNgung) {
      type CanRao = { id: string; code: string | null; location_raw: string | null; ward: string | null; deal?: string | null; property_type?: string | null };
      // 22/09/2026 (kịch bản E): "căn 1 bán rồi, còn căn 2" từng gỡ CĂN 2 — danh sách xếp mới→cũ nên "căn 1" là
      // căn mở SAU. Số thứ tự chủ nhà nói là thứ tự MỞ (như bong bóng "Em mở 2 tin riêng"): cũ → mới.
      const { data: dangRao } = await client.from("listings").select("id, code, location_raw, ward, deal, property_type")
        .eq("seller_id", sellerRow.id).in("status", ["cho_thong_tin", "dang_ban", "dang_quan_tam"])
        .order("created_at", { ascending: true }).limit(10);
      const cans = (dangRao ?? []) as CanRao[];
      const tenCan = (c: CanRao) => [c.location_raw, c.ward].filter(Boolean).join(", ") || "căn chưa rõ địa chỉ";
      const dongCauChon = async () => {
        if (!dangChonCanNgung || !pendingReq) return;
        await client.from("info_requests").update({ status: "expired" }).eq("id", pendingReq.id);
      };
      if (!cans.length) {
        await dongCauChon();
        return await traLoiSeller([`Dạ hiện em không thấy tin nào của ${cachGoi} đang rao. Khi nào có căn khác ${cachGoi} nhắn em nha.`], { ngung_rao: kieuNgung, can: null });
      }
      const chon = dangChonCanNgung ? chonCanTheoCau(text, cans) : (cans.length === 1 ? cans[0] : chonCanTheoCau(text, cans));
      if (!chon) {
        if (!dangChonCanNgung) {
          const { error: irErr } = await client.from("info_requests").insert({
            listing_id: cans[0].id, question: "ngung_rao_can_nao", status: "pending", answer: kieuNgung,
          });
          if (irErr && irErr.code !== "23505") await ghiLoi(client, "chat-reply mo ngung_rao_can_nao", irErr.message);
        }
        const ds = cans.map((c, i) => `${i + 1}. ${tenCan(c)}`).join("\n");
        const hoi = `${CachGoi} đang rao ${cans.length} căn, mình ${kieuNgung === "ban_roi" ? "đã bán" : "ngưng rao"} căn nào ạ?\n${ds}\nNhắn số thứ tự hoặc địa chỉ giúp em.`;
        return await traLoiSeller([hoi], { ngung_rao: kieuNgung, hoi_can: cans.length });
      }
      const luc = new Date().toISOString();
      const trangThai = kieuNgung === "ban_roi" ? "da_chot" : "an";
      const [{ error: upErr }] = await Promise.all([
        client.from("listings").update({ status: trangThai, chu_noi_du_at: luc }).eq("id", chon.id),
        client.from("info_requests").update({ status: "expired" }).eq("listing_id", chon.id).eq("status", "pending"),
        client.from("reminders").update({ status: "cancelled" }).eq("listing_id", chon.id).eq("status", "pending"),
        client.rpc("ghi_boc_tach", { p_listing_id: chon.id, p: { ket_thuc: kieuNgung, ket_thuc_luc: luc, ket_thuc_loi: text.slice(0, 200) } }),
        dongCauChon(),
      ]);
      if (upErr) await ghiLoi(client, "chat-reply ngung rao", upErr.message);
      const thue = chon.deal === "cho_thue";
      // 22/09/2026 (bộ đo giọng B13): "đã báo các khách đang chờ" khi CHƯA có khách nào là câu khuôn bịa —
      // đếm `interests` của căn, không có thì không nói.
      const { count: soKhachCho, error: kcErr } = await client.from("interests")
        .select("listing_id", { count: "exact", head: true }).eq("listing_id", chon.id);
      if (kcErr) await ghiLoi(client, "chat-reply dem interests(ban roi)", kcErr.message);
      const baoKhach = (soKhachCho ?? 0) > 0 ? " và báo các khách đang chờ" : "";
      const cau = kieuNgung === "ban_roi"
        ? `Dạ chúc mừng ${cachGoi} đã ${thue ? "cho thuê được" : "bán được"} căn ${tenCan(chon)}!\nEm đã gỡ tin khỏi kệ${baoKhach}. Khi nào có căn khác ${cachGoi} cứ nhắn em nha.`
        : `Dạ em đã ngưng rao căn ${tenCan(chon)} theo ý ${cachGoi} và không hỏi thêm nữa.\nLúc nào muốn rao lại ${cachGoi} nhắn em một tiếng là em mở lại liền.`;
      const xinDiemBan = kieuNgung === "ban_roi" ? await xinChamDiem(chon.id) : null;
      return await traLoiSeller(xinDiemBan ? [cau, xinDiemBan] : [cau], { ngung_rao: kieuNgung, can: chon.code ?? chon.id, listing_status: trangThai, xin_danh_gia: !!xinDiemBan || undefined });
    }

    // ─── 22/09/2026 (bắn thật căn hộ Hùng Vương Plaza): chủ nhà HỎI VỀ CHÍNH TIN CỦA MÌNH — "hồi nãy
    // anh nói giá bao nhiêu nhỉ" từng được đáp "em kiểm tra rồi báo lại" dù giá nằm trong DB; "có khách
    // nào hỏi chưa em" bị nuốt làm câu trả lời chấm điểm. Thứ hệ thống đang giữ thì trả lời tiền định
    // từ DB (giá, diện tích, địa chỉ, tầng, hướng, pháp lý, tình trạng, số khách quan tâm), rồi hỏi lại
    // câu đang treo nếu có. Nhận diện chặt (`hoiVeTin`): dáng hỏi + không có số kèm đơn vị.
    {
      const loaiHoiTin = hoiVeTin(text);
      const lidHoi = loaiHoiTin ? (pendingReq?.listing_id ?? sellerRow.active_listing_id ?? null) : null;
      if (loaiHoiTin && lidHoi) {
        const [{ data: tinHoi, error: thErr }, { count: soQuanTam }, { count: soHoi }] = await Promise.all([
          client.from("listings").select("code, status, price_raw, area_m2, location_raw, ward, district, floor, direction, legal_status, bedrooms").eq("id", lidHoi).maybeSingle(),
          client.from("interests").select("listing_id", { count: "exact", head: true }).eq("listing_id", lidHoi),
          client.from("info_requests").select("id", { count: "exact", head: true }).eq("listing_id", lidHoi).eq("source", "buyer_ask"),
        ]);
        if (thErr) await ghiLoi(client, "chat-reply hoi ve tin", thErr.message);
        if (tinHoi) {
          const dap = dapHoiVeTin(loaiHoiTin, tinHoi as TinTom, { quan_tam: soQuanTam ?? 0, hoi: soHoi ?? 0 }, cachGoi);
          const hoiLaiTreo = pendingReq && !["danh_gia", "duyet_tin", "hinh_anh"].includes(pendingReq.question)
            ? cauHoiMau(pendingReq.question, cachGoi, pendingReq.listings?.property_type, pendingReq.listings?.district, pendingReq.listings?.deal)
            : null;
          return await traLoiSeller(hoiLaiTreo ? [dap, hoiLaiTreo] : [dap], { hoi_ve_tin: loaiHoiTin });
        }
      }
    }

    // ─── 22/09/2026 (kịch bản C, bắn thật): "em xoá cái hẻm 4m ghi nhầm đi" — chủ nhà xin BỎ một thứ đã
    // ghi. Bản trước đọc thành ĐỊA CHỈ (street = nguyên câu, tin lên web như thế) và "hẻm 4m" trong câu đè
    // lại hẻm 3.5m vừa sửa. Đây là lời nói với bot, không phải dữ liệu: không ghi gì, đọc lại ô đang giữ và
    // xin giá trị đúng (bot không tự xoá một ô — xoá xong tin thiếu, hỏi lại là cùng một việc).
    {
      const xinBo = laXinBoTruong(text);
      const lidBo = xinBo ? (pendingReq?.listing_id ?? sellerRow.active_listing_id ?? null) : null;
      if (xinBo && lidBo) {
        const { data: tinBo, error: tbErr } = await client.from("listings")
          .select("alley_width_m, price_raw, ward, area_m2, bedrooms, floors_text, legal_status, direction, location_raw")
          .eq("id", lidBo).maybeSingle();
        if (tbErr) await ghiLoi(client, "chat-reply xin bo truong", tbErr.message);
        const hienTai: Record<string, string | null> = {
          do_rong_hem: tinBo?.alley_width_m != null ? `hẻm ${tinBo.alley_width_m}m` : null,
          gia: tinBo?.price_raw ? `giá ${donViGiaDep(tinBo.price_raw)}` : null,
          phuong: tinBo?.ward ?? null,
          dien_tich: tinBo?.area_m2 != null ? `diện tích ${tinBo.area_m2}m²` : null,
          so_phong_ngu: tinBo?.bedrooms != null ? `${tinBo.bedrooms} phòng ngủ` : null,
          ket_cau: tinBo?.floors_text ?? null,
          phap_ly: tinBo?.legal_status ? (LEGAL_VI[tinBo.legal_status] ?? tinBo.legal_status) : null,
          huong: tinBo?.direction ? `hướng ${tinBo.direction}` : null,
          vi_tri: tinBo?.location_raw ?? null,
        };
        const ht = xinBo.truong ? hienTai[xinBo.truong] : null;
        const dap = !xinBo.truong
          ? `Dạ chỗ nào ghi nhầm ${cachGoi} nhắn lại giúp em nha, em sửa liền ạ.`
          : ht
          ? `Dạ tin mình đang ghi ${ht} ạ, ${cachGoi} nhắn ${xinBo.nhan} đúng là em sửa lại liền.`
          : `Dạ tin mình chưa ghi ${xinBo.nhan} nào ạ, ${cachGoi} cứ nhắn ${xinBo.nhan} đúng là em ghi.`;
        const duoi = pendingReq?.question === "duyet_tin"
          ? `Bản nháp ở trên ${cachGoi} thấy được thì nhắn "ok" là em đăng liền ạ.`
          : pendingReq && !["danh_gia", "hinh_anh"].includes(pendingReq.question)
          ? cauHoiMau(pendingReq.question, cachGoi, pendingReq.listings?.property_type, pendingReq.listings?.district, pendingReq.listings?.deal)
          : null;
        return await traLoiSeller(duoi ? [dap, duoi] : [dap], { xin_bo_truong: xinBo.truong ?? "?", ...(pendingReq ? { reask: pendingReq.question } : {}) });
      }
    }
    /** Câu hỏi treo nhắc lại sau một bong bóng tiền định (không nhắc câu duyệt/điểm/ảnh; duyệt thì nhắc "ok"). */
    const nhacCauTreo = (): string | null => pendingReq?.question === "duyet_tin"
      ? `Bản nháp ở trên ${cachGoi} thấy được thì nhắn "ok" là em đăng liền ạ.`
      : pendingReq && !["danh_gia", "hinh_anh"].includes(pendingReq.question)
      ? cauHoiMau(pendingReq.question, cachGoi, pendingReq.listings?.property_type, pendingReq.listings?.district, pendingReq.listings?.deal)
      : null;

    // ─── 22/09/2026 (kịch bản E): môi giới "khách nào hỏi thì cho tui số của họ" — bot từng gật "Dạ em hiểu anh
    // chị tự liên hệ khách rồi". Người mua bên này KHÔNG để lại số (bất biến DH); nói thật một lần, không ghi gì.
    if (laXinSoKhach(text) && !nhanDienFact(text)) {
      const dap = `Dạ khách mua bên em không để lại số ạ, mọi trao đổi đi qua em và anh Thu phụ trách. Có khách quan tâm em báo ${cachGoi} liền và sắp lịch xem nhà cho mình.`;
      const duoi = nhacCauTreo();
      return await traLoiSeller(duoi ? [dap, duoi] : [dap], { xin_so_khach: true, ...(pendingReq ? { reask: pendingReq.question } : {}) });
    }

    // ─── 22/09/2026 (kịch bản E): "xoá căn 1 khỏi hệ thống của tui" khi KHÔNG có câu treo → từng rơi vào model
    // ("Dạ em ghi nhận rồi ạ"). Bot không tự xoá dữ liệu: nói thật, nhờ người phụ trách (cùng câu với đường duyệt).
    if (laXinXoaDuLieu(text) && !nhanDienFact(text) && !laRaoLai(text) && !(pendingReq?.question === "danh_gia" && laDiemCham(text))) {
      const dap = `Dạ việc xoá dữ liệu em không tự làm được, để em nhờ anh Thu phụ trách xử lý giúp ${cachGoi} ạ.`;
      const duoi = nhacCauTreo();
      return await traLoiSeller(duoi ? [dap, duoi] : [dap], { xin_xoa_du_lieu: true, ...(pendingReq ? { reask: pendingReq.question } : {}) });
    }

    // ─── 22/09/2026 (kịch bản E): "mở lại căn 2", "rao lại căn chung cư đi, căn đó chưa bán" — bot hứa "nhắn em
    // một tiếng là em mở lại liền" mà chưa có luật nào nhận (câu này từng bị nuốt làm điểm chấm). Tin đã gỡ
    // (da_chot/an) của người này: một căn thì mở luôn, nhiều căn thì chọn theo số thứ tự / loại / địa chỉ, không
    // rõ thì hỏi. Đã duyệt trước đó → lên kệ lại (dang_ban); chưa → cho_thong_tin.
    if (laRaoLai(text) && !laNgungRao(text)) {
      type CanGo = { id: string; code: string | null; location_raw: string | null; ward: string | null; property_type: string | null; chu_duyet_at: string | null };
      const { data: daGo, error: dgoErr } = await client.from("listings").select("id, code, location_raw, ward, property_type, chu_duyet_at")
        .eq("seller_id", sellerRow.id).in("status", ["da_chot", "an"]).order("created_at", { ascending: true }).limit(10);
      if (dgoErr) await ghiLoi(client, "chat-reply rao lai(doc tin)", dgoErr.message);
      const cans = (daGo ?? []) as CanGo[];
      const tenCan = (c: CanGo) => [c.location_raw, c.ward].filter(Boolean).join(", ") || (c.property_type === "chung_cu" ? "căn chung cư" : "căn chưa rõ địa chỉ");
      if (!cans.length) {
        return await traLoiSeller([`Dạ em không thấy tin nào của ${cachGoi} đang gỡ để mở lại ạ. ${cachGoi.charAt(0).toUpperCase() + cachGoi.slice(1)} muốn rao căn nào thì nhắn em địa chỉ, giá và diện tích nha.`], { rao_lai: null });
      }
      const chon = cans.length === 1 ? cans[0] : chonCanTheoCau(text, cans);
      if (!chon) {
        const dsC = cans.map((c, i) => `${i + 1}. ${tenCan(c)}`).join("\n");
        return await traLoiSeller([`Dạ ${cachGoi} muốn mở lại căn nào ạ?\n${dsC}\nNhắn số thứ tự hoặc địa chỉ giúp em.`], { rao_lai: null, hoi_can: cans.length });
      }
      const trangThaiMoi = chon.chu_duyet_at ? "dang_ban" : "cho_thong_tin";
      const [{ error: rlErr }] = await Promise.all([
        client.from("listings").update({ status: trangThaiMoi }).eq("id", chon.id),
        client.rpc("ghi_boc_tach", { p_listing_id: chon.id, p: { ket_thuc: "mo_lai", mo_lai_luc: new Date().toISOString(), mo_lai_loi: text.slice(0, 200) } }),
        client.from("sellers").update({ active_listing_id: chon.id }).eq("id", sellerRow.id),
      ]);
      if (rlErr) await ghiLoi(client, "chat-reply rao lai", rlErr.message);
      const cau = trangThaiMoi === "dang_ban"
        ? `Dạ em mở lại tin căn ${tenCan(chon)} rồi ạ, tin lên kệ lại như cũ. Có gì đổi (giá, tình trạng) ${cachGoi} nhắn em nha.`
        : `Dạ em mở lại tin căn ${tenCan(chon)} rồi ạ. Tin còn thiếu vài thông tin, em hỏi tiếp rồi gửi bản nháp ${cachGoi} duyệt nha.`;
      return await traLoiSeller([cau], { rao_lai: chon.code ?? chon.id, listing_status: trangThaiMoi });
    }

    // ─── 22/09/2026 (kịch bản D): chủ nhà GỬI SĐT kèm lời dặn ("đừng đăng số của cô lên mạng") — bot từng im, gửi
    // bản nháp như không có gì; số không vào hồ sơ. Nay: số vào `sellers.phone` (chỉ admin đọc — RLS), nói rõ
    // không đăng số lên web, không ghi câu này vào tin. Câu có kèm dữ liệu căn thì chỉ lưu số + một dòng báo,
    // phần dữ liệu đi tiếp đường thường.
    {
      const mSdt = new RegExp(SDT_NGUON).exec(text);
      if (mSdt) {
        const sdt = mSdt[0].replace(/[\s.\-]/g, "").replace(/^\+?84/, "0");
        let daLuu = false;
        const { error: sdtErr } = await client.from("sellers").update({ phone: sdt }).eq("id", sellerRow.id).is("phone", null);
        // 23505: số đã thuộc hồ sơ khác — không ghi đè, không đưa số vào sổ lỗi (log_loi che, nhưng đừng thử).
        if (sdtErr && sdtErr.code !== "23505") await ghiLoi(client, "chat-reply sellers.phone", sdtErr.code ?? "update");
        else if (!sdtErr) daLuu = true;
        const conLai = text.replace(mSdt[0], " ").replace(/\s+/g, " ").trim();
        const dap = `${daLuu ? "Dạ em lưu số " + cachGoi + " rồi ạ, em" : "Dạ em"} không đăng số lên web đâu ạ. Khách quan tâm em nhắn ${cachGoi} rồi anh Thu bên em liên hệ mình.`;
        if (!nhanDienNhieuFact(conLai).length && !nhanDienFact(conLai)) {
          const duoi = nhacCauTreo();
          return await traLoiSeller(duoi ? [dap, duoi] : [dap], { sdt_luu: daLuu, ...(pendingReq ? { reask: pendingReq.question } : {}) });
        }
        if (!thongBaoNhan) thongBaoNhan = dap;
      }
    }

    // ─── 10/09 (chân dung đại diện CĐT / môi giới rao theo lô): MỘT tin liệt kê
    // NHIỀU CĂN "căn A5 8x20 giá 18 tỷ, căn A7 …, căn B2 góc 10x20 giá 22 tỷ" → mỗi
    // căn một tin riêng (mã căn, ngang×dài, giá), kế thừa dự án/quận/phường/loại
    // của căn đang nói. Trước đây câu này bị FR-164 hiểu là "sửa giá" của tin cũ.
    // ─── 16/09/2026 (Zalo thật): chủ nhà ĐÃ có tin đang rao nhắn "Chào cháu chú có căn nhà
    // này cần giao bán" — câu rao KHÔNG chi tiết. Bản trước coi nó là câu trả lời cho câu
    // đang hỏi của tin cũ (ghi "Chào cháu…" vào bổ sung), rồi mọi dữ kiện sau đó gộp vào
    // tin cũ — hai căn thành một. Nay hỏi thẳng: căn đó hay căn khác? Câu hỏi mang DẤU
    // (`DAU_CAN_CU_MOI`) để lượt sau đọc lịch sử biết mình đang hỏi gì, không cần cột mới.
    const botCuoi = [...lichSuRows].reverse().find((m) => !laTinNguoi(m.sender))?.body ?? "";
    const dangHoiCanCuMoi = /là căn đó hay căn khác/i.test(botCuoi);
    const dangXinCanMoi = /(?:địa chỉ|diện tích|giá) (?:của |cho )?căn (?:khác|mới)/i.test(botCuoi);
    const laCanKhac = /căn khác|căn mới|nhà khác|cái khác|khác ạ|khác em|khác cháu|^\s*khác\b|căn nữa|căn thứ/i.test(text) ||
      /\bcan khac|can moi|nha khac|^\s*khac\b/.test(tKD);
    const laCanDo = /căn đó|căn cũ|cùng căn|vẫn căn|căn này|căn đang rao|đúng rồi|đúng căn|là nó|vẫn là|căn hồi/i.test(text) ||
      /\bcan do|can cu|cung can|van can|dung roi|dung can\b/.test(tKD);
    // Xác nhận "căn khác" (hoặc đang được xin chi tiết căn mới và câu này có chi tiết) → mở tin mới.
    const raoCanMoiXacNhan = (dangHoiCanCuMoi && laCanKhac && !laCanDo) || (dangXinCanMoi && coChiTiet);
    // Bắn thật sau deploy #145: "ngang 5m còn dọc 16m cần bán gấp" (trả lời câu diện tích) bị
    // coi là rao suông vì có "cần bán". Suông = có ý rao + có chữ loại BĐS, KHÔNG số, không fact
    // nào ngoài gấp ("chú có căn nhà cần bán gấp" vẫn là suông; "cần bán gấp" trần thì không).
    // `coLoaiBDS` bỏ dấu nhận "cần" (can) như "căn" — ở đây đòi chữ loại RÕ: "căn"/"lô" chỉ khi còn dấu.
    const coLoaiRo = khop(
      /(nhà|căn hộ|chung cư|đất|mặt bằng|phòng trọ|biệt thự|căn\b|kho|xưởng|to[àa] nhà|khách sạn|villa|shophouse|lô\b)/i,
      /(nha|can ho|chung cu|dat|mat bang|phong tro|biet thu|\bkho\b|xuong|toa nha|khach san|villa|shophouse)/,
    );
    // Zalo thật 16/09 13:36: "cô có căn nhà này Ở QUẬN 5 cần giao bán gấp" — số của quận/phường
    // không phải chi tiết căn; câu này từng đổi QUẬN của tin cũ (capNhatQuan) thay vì hỏi căn nào.
    const textKhongSoQuan = text.replace(/(?:quận|quan|phường|phuong|\bq|\bp)\s*\.?\s*\d{1,2}\b/gi, "");
    const raoSuong = coYDinhRao && coLoaiRo && !coChiTiet && !/\d/.test(textKhongSoQuan) && !laCauHoiTinhTrang && !raoCanMoiXacNhan &&
      nhanDienNhieuFact(text).every((f) => f.question === "gap" || f.question === "phuong");
    if (!sellerMoi && (raoSuong || (dangHoiCanCuMoi && (laCanDo || laCanKhac)))) {
      type CanRao = { id: string; code: string | null; location_raw: string | null; ward: string | null; price_raw: string | null };
      const { data: dangRao, error: drErr } = await client.from("listings").select("id, code, location_raw, ward, price_raw")
        .eq("seller_id", sellerRow.id).in("status", ["cho_thong_tin", "dang_ban", "dang_quan_tam"])
        .order("created_at", { ascending: false }).limit(5);
      if (drErr) await ghiLoi(client, "chat-reply listings(can cu hay moi)", drErr.message);
      const cans = (dangRao ?? []) as CanRao[];
      const tenCan = (c: CanRao) =>
        [c.location_raw, c.ward].filter(Boolean).join(", ") || (c.code ? `mã ${c.code}` : "căn chưa rõ địa chỉ");
      // "căn Căn số 14 ở…" (bắn thật mau-chu-q8): địa chỉ đã mở đầu bằng "căn" thì không thêm chữ "căn".
      const canTen = (c: CanRao) => { const t = tenCan(c); return /^căn\b/i.test(t) ? t : `căn ${t}`; };
      if (cans.length) {
        if (dangHoiCanCuMoi && laCanDo && !laCanKhac) {
          // Cùng căn → tiếp tục câu đang treo của căn đó (không ghi gì từ câu này).
          const cauKe = pendingReq
            ? cauHoiMau(pendingReq.question, cachGoi, pendingReq.listings?.property_type, pendingReq.listings?.district, pendingReq.listings?.deal)
            : `Có gì thêm về căn này ${cachGoi} cứ nhắn em nha.`;
          return await traLoiSeller([`Dạ, vậy em tiếp tục với ${canTen(cans[0])} nha. ${cauKe}`], { can_cu_hay_moi: "can_cu" });
        }
        if (dangHoiCanCuMoi && laCanKhac) {
          // Căn khác nhưng chưa có chi tiết → xin chi tiết; câu này mang dấu `dangXinCanMoi`.
          return await traLoiSeller(
            [`Dạ, ${cachGoi} cho em xin địa chỉ, diện tích và giá của căn khác nha, em mở tin riêng cho căn đó.`],
            { can_cu_hay_moi: "can_khac" },
          );
        }
        // Câu rao suông (lần đầu, hoặc lặp lại mà chưa trả lời căn đó/căn khác) → hỏi.
        if (raoSuong && !(dangHoiCanCuMoi && (laCanDo || laCanKhac))) {
          const ds = cans.length === 1
            ? `trước đó ${cachGoi} có ${canTen(cans[0])}${cans[0].price_raw ? ` giá ${cans[0].price_raw}` : ""}`
            : `trước đó ${cachGoi} đang rao ${cans.length} căn: ${cans.map(tenCan).join(" · ")}`;
          return await traLoiSeller(
            [`Dạ ${cachGoi}, ${ds}. Căn ${cachGoi} vừa nhắc là căn đó hay căn khác ạ? Căn khác thì ${cachGoi} cho em xin địa chỉ, diện tích và giá nha.`],
            { can_cu_hay_moi: "hoi" },
          );
        }
      }
    }
    const nhieuCanTrongTin = nhanDienNhieuCan(text);
    // ─── 15/09/2026 (bắn thật N2): người rao nhiều căn nói FACT theo số thứ tự — "căn 2 sổ
    // hồng riêng, có thương lượng. căn 1 đúc 3 tấm". Trước đây câu này mở thêm 2 tin RỖNG.
    // Nay: mỗi mảnh "căn N …" ghi fact vào căn thứ N (theo thứ tự mở); mảnh nào trả lời
    // đúng câu đang treo của căn đó thì đóng câu và hỏi câu kế; còn lại nhắc lại câu treo.
    // (Không chặn theo `wantsSell`: "căn 2 đang cho thuê 80 triệu/tháng" có chữ "cho thuê" + tiền
    // nên cổng rao khớp, nhưng đây vẫn là fact cho căn đã mở — bắn thật C2 15/09.)
    const nhomCan = nhieuCanTrongTin.length < 2 ? tachTheoCan(text) : [];
    if (nhomCan.length) {
      const { data: dsCan } = await client.from("listings").select("id, code, property_type, district, deal")
        .eq("seller_id", sellerRow.id).in("status", ["cho_thong_tin", "dang_ban", "dang_quan_tam"])
        .order("created_at", { ascending: true }).limit(20);
      const cans = (dsCan ?? []) as Array<{ id: string; code: string | null; property_type: string | null; district: string | null; deal: string | null }>;
      if (cans.length >= 2) {
        const daGhi: string[] = [];
        const daDong = new Set<string>();
        for (const g of nhomCan) {
          const l = cans[g.thu - 1];
          if (!l) continue;
          await ganNhanChoTin({}, { lid: l.id, text: g.manh });
          nhanTheoCanDaGan = true;
          const nhieu = nhanDienNhieuFact(g.manh);
          const mot = nhieu.length ? null : nhanDienFact(g.manh);
          for (const f of nhieu.length ? nhieu : mot ? [mot] : []) {
            const { error: fcErr } = await client.rpc("ghi_fact_listing", { p_listing_id: l.id, p_question: f.question, p_answer: f.answer, p_source: "seller_chat" });
            if (fcErr) { await ghiLoi(client, "chat-reply ghi_fact_listing(theo can)", fcErr.message); continue; }
            daGhi.push(`căn ${g.thu} ${(FACT_LABELS[f.question] ?? f.question).replace(/\s*\(.*\)\s*$/, "")}: ${f.answer}`);
            // Mọi câu treo của CĂN ĐÓ cùng họ với fact vừa ghi thì đóng (không chỉ câu đang chọn).
            for (const q of ds) {
              if (q.listing_id === l.id && !daDong.has(q.id) && cungHoFact(f.question, q.question)) {
                await client.from("info_requests").update({ status: "answered", answer: g.manh, answered_at: new Date().toISOString() }).eq("id", q.id);
                daDong.add(q.id);
              }
            }
          }
        }
        if (daGhi.length) {
          let cauKe = "";
          // Câu treo còn lại: ưu tiên căn đang nói (pendingReq), rồi tới căn khác.
          const conTreo = ds.filter((q) => !daDong.has(q.id));
          const keTreo = (pendingReq && !daDong.has(pendingReq.id) ? pendingReq : null) ?? conTreo[0] ?? null;
          if (keTreo) {
            cauKe = cauHoiMau(keTreo.question, cachGoi, keTreo.listings?.property_type, keTreo.listings?.district, keTreo.listings?.deal);
          } else {
            const canKe = pendingReq?.listing_id ?? cans[0].id;
            const { data: thieu } = await client.from("listing_missing_facts").select("fact_key, priority, nhom")
              .eq("listing_id", canKe).order("priority").limit(8);
            const ke = chonCauKe([...(pendingReq ? [pendingReq.question] : [])], (await thieuCoReNhanh(client, canKe, (thieu ?? []) as Array<{ fact_key: string; priority: number; nhom: string | null }>, pendingReq ? [pendingReq.question] : [], text)).filter((f) => f.nhom !== "sau_dang"));
            if (ke) {
              const { error: irErr } = await client.from("info_requests").insert({ listing_id: canKe, question: ke, status: "pending" });
              if (irErr && irErr.code !== "23505") await ghiLoi(client, "chat-reply mo cau ke(theo can)", irErr.message);
              const lKe = cans.find((c) => c.id === canKe);
              cauKe = cauHoiMau(ke, cachGoi, lKe?.property_type, lKe?.district, lKe?.deal);
            }
          }
          // 💾 chung chỉ đọc MỘT tin (căn đang chăm) nên in pháp lý của căn 1 dưới tin căn 2 — bong bóng
          // tiền định ở đây đã nói rõ từng căn, tắt 💾 cho lượt này (20/09/2026).
          return await traLoiSeller([`${BOC_DUOC} ${daGhi.join(" · ")}.${cauKe ? `\n${cauKe}` : ""}`], { fact_theo_can: daGhi.length, dong_cau_treo: daDong.size, bao_lai_tat: true });
        }
      }
    }
    if (nhieuCanTrongTin.length >= 2) {
      const { data: goc } = await client.from("listings")
        .select("id, deal, district, ward, property_type, project_id, location_raw, street")
        .eq("seller_id", sellerRow.id).in("status", ["cho_thong_tin", "dang_ban"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const daMo: string[] = [];
      let dau: { id: string; property_type: string | null } | null = null;
      // 20/09/2026 (bắn thật mau-y-A): "e la moi gioi ben q10, co 2 can…" — quận nói CHUNG cho cả tin
      // phải vào từng căn (trước chỉ lấy `c.quan` của mảnh → hai tin mang mã XX). Kế thừa địa chỉ căn
      // cũ chỉ khi cùng quận. Mảnh "dat 5x20" không dấu là ĐẤT (trigger đoán loại không đọc chữ không dấu).
      const quanCau = bocQuan(tKD, text);
      const DAT_KD_RE = /(?:^|[^a-z])dat(?=\s+(?:\d|nen|tho cu|mat tien|hem|duong|vuon|nong nghiep|trong|thanh|sxkd|kinh doanh|cong nghiep|o\b))/;
      // 23/09/2026 (bắn thật, môi giới): "đang giữ 2 căn hộ The Everrich Infinity q5: căn A …, căn B …" —
      // loại + dự án nói ở ĐẦU CÂU (trước mốc căn đầu tiên) là của CẢ LÔ; căn B không tự nhắc thì kế thừa.
      // Mảnh không thuộc căn nào ("full nội thất, sổ hồng lâu dài") cũng là của cả lô → ghi cho từng căn.
      const viTriDau = nhieuCanTrongTin[0].theoLoai ? text.indexOf(nhieuCanTrongTin[0].goc) : -1;
      const dauTin = viTriDau >= 0 ? text.slice(0, viTriDau)
        : text.split(/(?:căn|can|lô|lo|nhà|nha)\s+(?:số\s+|so\s+|thứ\s+|thu\s+)?(?:\d{1,2}(?!\d)|[A-H](?![\p{L}\d]))/u)[0] ?? "";
      const kdDauTin = boDau(dauTin);
      // 23/09/2026 (bắn thật): "Chú có 2 lô đất ở Củ Chi …, lô 1 500m2 giá 3 tỷ, lô 2 …" — loại nói ở đầu câu là của cả
      // lô; bản trước chỉ đọc chữ "đất" trong mảnh từng lô → hai tin "chưa rõ loại", bot hỏi lại "nhà phố hay đất".
      const loaiDauTin = loaiTuChu(kdDauTin.replace(/\b(?:ban|can ban|muon ban)\b/g, ""));
      // Tách theo LOẠI: mọi chữ sau mốc căn đầu đã thuộc một căn — chỉ phần ĐẦU CÂU là chung (bắn thật 23/09: "2PN"
      // của căn hộ từng ghi sang căn nhà vì mảnh phẩy "với 1 căn hộ … 2PN …" không nằm nguyên trong goc đã gọt).
      const manhChung = (nhieuCanTrongTin[0].theoLoai ? dauTin : text).split(/[,;\n]/).map((x) => x.trim())
        .filter((x) => x.length >= 2 && !nhieuCanTrongTin.some((c) => c.goc.includes(x)));
      const factChung = manhChung.length ? nhanDienNhieuFact(manhChung.join(", ")) : [];
      let duAnLo: DuAnKho | null | undefined;
      for (const c of nhieuCanTrongTin) {
        const quanCan = c.quan ?? quanCau ?? null;
        const keThua = !quanCan || quanCan === (goc?.district ?? null);
        // Không mở trùng mã căn cho cùng người bán.
        if (c.ma) {
          const { data: trung } = await client.from("listings").select("id")
            .eq("seller_id", sellerRow.id).ilike("unit_code", c.ma).in("status", ["cho_thong_tin", "dang_ban"]).limit(1).maybeSingle();
          if (trung) continue;
        }
        const { data: moi, error: moiErr } = await client.from("listings").insert({
          code: null, seller_id: sellerRow.id, deal: goc?.deal ?? "ban",
          // 11/09: căn nói rõ quận riêng ("1 căn q11 …") thì không kế thừa địa chỉ căn cũ.
          district: quanCan ?? goc?.district ?? null, ward: keThua ? goc?.ward ?? null : null,
          location_raw: keThua ? goc?.location_raw ?? null : null, street: keThua ? goc?.street ?? null : null,
          description: c.goc, price_raw: c.gia ?? null,
          property_type: c.loai ?? (DAT_KD_RE.test(boDau(c.goc)) ? "dat" : loaiDauTin ?? goc?.property_type ?? "chua_ro"), status: "cho_thong_tin",
          can_chu_duyet: true, unit_code: c.ma ?? null,
          ...(c.dt ? { area_m2: Number(c.dt.replace(",", ".")) } : {}),
          ...(c.ngang && c.dai ? { frontage_m: Number(c.ngang.replace(",", ".")), length_m: Number(c.dai.replace(",", ".")) } : {}),
          ...(goc?.project_id && keThua ? { project_id: goc.project_id, unit_status: "con_ban", last_confirmed_at: new Date().toISOString() } : {}),
        }).select("id, code, property_type").single();
        if (moiErr || !moi) { await ghiLoi(client, "chat-reply mo tin nhieu can", moiErr?.message ?? "insert null"); continue; }
        // 15/09/2026 (bắn thật N1): địa chỉ của TỪNG căn ("căn 1 hẻm 7m Hồng Bàng…, căn 2
        // mặt tiền Nguyễn Chí Thanh…") — trước đây cả hai căn trống location_raw.
        let vtCan = bocViTriRao(c.goc);
        // 22/09/2026 (kịch bản E): "căn 2 chung cư Hùng Vương Plaza 78m2 tầng 15" từng mở tin nhà phố, không địa
        // chỉ, không dự án — rồi model bịa "hai căn cùng địa chỉ". Từng căn: loại theo chữ, dự án tra kho
        // (`match_projects`, FR-114), địa chỉ lấy của dự án khi câu không có đường; fact kèm (tầng, phòng ngủ,
        // pháp lý, hướng…) ghi cho đúng căn.
        const kdLoai = boDau(c.goc);
        const LOAI_CH_RE = /\b(?:chung cu|can ho|cc|ch)\b/;
        const tuNoiLoai = LOAI_CH_RE.test(kdLoai) || /\b(?:nha|dat|mat tien|hem|pho)\b/.test(kdLoai.replace(kdDauTin, ""));
        const laCanHo = LOAI_CH_RE.test(kdLoai) || (!tuNoiLoai && LOAI_CH_RE.test(kdDauTin));
        if (laCanHo && moi.property_type !== "chung_cu") {
          const { error: ptErr } = await client.from("listings").update({ property_type: "chung_cu", property_type_source: "chu_xac_nhan" }).eq("id", moi.id);
          if (ptErr) await ghiLoi(client, "chat-reply nhieu can(loai)", ptErr.message);
          else moi.property_type = "chung_cu";
        }
        if (laCanHo || /\b(?:du an|plaza|tower|towers|residence|residences|city|park|garden|riverside|khu)\b/.test(kdLoai)) {
          const { data: daCan, error: daCanErr } = await client.rpc("match_projects", { p_text: c.goc });
          if (daCanErr) await ghiLoi(client, "chat-reply match_projects(nhieu can)", daCanErr.message);
          let da: DuAnKho | undefined = ((daCan ?? []) as DuAnKho[])[0];
          // Căn không tự nhắc dự án → dự án nói ở đầu câu (tra một lần cho cả lô).
          if (!da && kdDauTin.trim()) {
            if (duAnLo === undefined) {
              const { data: daLo, error: daLoErr } = await client.rpc("match_projects", { p_text: dauTin });
              if (daLoErr) await ghiLoi(client, "chat-reply match_projects(dau tin)", daLoErr.message);
              duAnLo = ((daLo ?? []) as DuAnKho[])[0] ?? null;
            }
            da = duAnLo ?? undefined;
          }
          if (da) {
            const { error: daUpErr } = await client.from("listings").update({ project_id: da.id, unit_status: "con_ban", last_confirmed_at: new Date().toISOString(), ...(da.district ? { district: da.district } : {}) }).eq("id", moi.id);
            if (daUpErr) await ghiLoi(client, "chat-reply nhieu can(du an)", daUpErr.message);
            if (!vtCan) vtCan = da.location_raw ? `${da.name}, ${da.location_raw}` : da.name;
          }
        }
        if (vtCan) {
          const { error: vtcErr } = await client.rpc("ghi_fact_listing", { p_listing_id: moi.id, p_question: "vi_tri", p_answer: vtCan, p_source: "seller_chat" });
          if (vtcErr) await ghiLoi(client, "chat-reply ghi_fact_listing(vi_tri nhieu can)", vtcErr.message);
        }
        // 23/09/2026 (bắn thật): nhãn đọc theo TỪNG căn, bỏ mốc số thứ tự trước — "nha 2 mat tien …" là nhà THỨ HAI mặt
        // tiền, bản trước đọc cả câu rồi gắn "căn góc / 2 mặt tiền" cho tin mới nhất.
        await ganNhanChoTin({}, { lid: moi.id, text: c.goc.replace(/(?:căn|can|lô|lo|nhà|nha)\s+(?:số\s+|so\s+|thứ\s+|thu\s+)?(?:\d{1,2}|[A-H])(?![\p{L}\d])/gu, " ") });
        nhanTheoCanDaGan = true;
        const factCan = nhanDienNhieuFact(c.goc);
        for (const f of [...factCan, ...factChung.filter((g) => !factCan.some((x) => x.question === g.question))]) {
          if (["vi_tri", "gia", "dien_tich", "dien_tich_dat", "dien_tich_tim_tuong", "do_rong_hem", "mat_tien", "bo_sung", "phuong", "loai_bds", "quan"].includes(f.question)) continue;
          const { error: fkErr } = await client.rpc("ghi_fact_listing", { p_listing_id: moi.id, p_question: f.question, p_answer: f.answer, p_source: "seller_chat" });
          if (fkErr) await ghiLoi(client, `chat-reply ghi_fact_listing(${f.question} nhieu can)`, fkErr.message);
        }
        // 22/09/2026 (bộ đo giọng B11): "căn 1 hẻm 4m …, căn 2 mặt tiền …" — đường vào nói riêng cho từng
        // căn mà trước chỉ ghi vị trí, rồi câu chung cả lô hỏi lại hẻm. Hẻm phải có đơn vị mét ("hẻm 123
        // Trần…" là địa chỉ); "mặt tiền" ghi chữ, trigger đọc ra access_type.
        const kdCan = boDau(c.goc);
        const mHem = /\bhem\s*(?:rong\s*)?(?:la\s*|tam\s*|khoang\s*)?(\d{1,2}(?:[.,]\d)?)\s*(?:m|met)\b/.exec(kdCan);
        const duongVao = mHem ? `hẻm ${mHem[1].replace(",", ".")}m` : /\bmat tien\b/.test(kdCan) && !/\bcach\s*mat tien\b/.test(kdCan) ? "mặt tiền" : null;
        if (duongVao) {
          const { error: dvErr } = await client.rpc("ghi_fact_listing", { p_listing_id: moi.id, p_question: "do_rong_hem", p_answer: duongVao, p_source: "seller_chat" });
          if (dvErr) await ghiLoi(client, "chat-reply ghi_fact_listing(do_rong_hem nhieu can)", dvErr.message);
        }
        daMo.push(`${c.ma ?? vtCan ?? (c.thu ? `căn ${c.thu}` : null) ?? c.quan ?? `căn ${daMo.length + 1}`}${c.dt ? ` ${c.dt}m2` : ""}${c.gia ? ` ${c.gia}` : ""}`);
        dau = dau ?? { id: moi.id, property_type: moi.property_type };
      }
      if (daMo.length) {
        await client.from("sellers").update({ active_listing_id: dau!.id }).eq("id", sellerRow.id);
        // Hỏi MỘT câu chung cho cả lô (kết cấu / pháp lý…) — mở trên căn đầu, câu trả lời
        // kế tiếp áp cho căn đó; các căn còn lại vòng hỏi bù hỏi sau.
        const { data: thieuLo } = await client.from("listing_missing_facts").select("fact_key, priority, nhom")
          .eq("listing_id", dau!.id).order("priority").limit(8);
        const keLo = chonCauKe(["gia", "dien_tich"], (await thieuCoReNhanh(client, dau!.id, thieuLo)).filter((f) => f.nhom !== "sau_dang" && !["vi_tri", "phuong", "gap"].includes(f.fact_key)));
        if (keLo) {
          const { error: irLo } = await client.from("info_requests").insert({ listing_id: dau!.id, question: keLo, status: "pending" });
          if (irLo && irLo.code !== "23505") await ghiLoi(client, "chat-reply mo cau ke(nhieu can)", irLo.message);
        }
        return await traLoiSeller([
          `📝 Em mở ${daMo.length} tin riêng: ${daMo.join(" · ")}.`,
          keLo ? `${cauHoiMau(keLo, cachGoi, dau!.property_type)} (giống nhau cả lô thì ${cachGoi} nói "cả lô" giúp em)` : `Cả lô đủ thông tin rồi, em soạn bản nháp gửi ${cachGoi} xem nha.`,
        ], { nhieu_can: daMo.length, asked: keLo ?? null });
      }
    }

    // ─── FR-164: CHỦ NHÀ SỬA THÔNG TIN GIỮA CHỪNG.
    // "à giá 6.8 tỷ nha em", "nhà ở phường 12 chứ không phải 8" — trước bản này
    // KHÔNG có đường nào nhận: đang có câu hỏi chờ thì lời sửa bị ghi thành câu
    // TRẢ LỜI cho câu hỏi đó (sai chỗ), không có thì rơi xuống nhánh chăm sóc
    // chung rồi bay mất. Mà giá và phường là hai trong ba trường quyết định tin
    // có được lên kệ hay không.
    //
    // CHỈ bắt khi câu có NHÃN tường minh ("giá …", "phường …", "… phòng ngủ",
    // "diện tích …"). Câu trả lời cho drip thường KHÔNG lặp nhãn ("50m2", "sổ
    // hồng") nên hai đường không giẫm chân nhau; ai có lặp nhãn đúng lúc đang
    // được hỏi chính trường đó thì nhường hẳn cho đường drip bên dưới.
    // Ghi qua `ghi_fact_listing` — cửa fact duy nhất; chuẩn hoá, kiểm giá trị và
    // đo bậc ưu tiên đều nằm ở tầng DB, không chép luật lên đây.
    const suaFacts: Array<[string, string]> = [];
    // Vị trí các đoạn đã được nhận là "lời sửa". Bóc chúng ra khỏi câu thì phần
    // CÒN LẠI cho biết câu này có kèm câu trả lời cho câu hỏi đang treo không.
    const nhipSua: Array<[number, number]> = [];
    const batSua = (
      m: RegExpExecArray | null,
      key: string,
      lay: (m: RegExpExecArray) => string,
    ) => {
      if (!m) return;
      suaFacts.push([key, lay(m)]);
      nhipSua.push([m.index, m.index + m[0].length]);
    };
    // 11/09/2026 (42 ca): "sai rồi em, phường 9 chứ không phải phường 4" → bản
    // trước ghi Phường 4 (vế SAI) vào ô phường, rác vào vị trí, rồi báo "đã cập
    // nhật Phường 9". Che vế phủ định trước khi bắt lời sửa (cùng độ dài nên chỉ
    // số vẫn đúng trên `text`); câu là lời sửa thì bóc luôn vế đó khỏi phần còn lại.
    const textSua = cheoPhuDinh(text);
    const nhipPhuDinh = vungPhuDinh(text);
    // 16/09/2026: chi tiết căn MỚI sau câu "căn đó hay căn khác" (không có chữ "bán") cũng là
    // câu rao, không phải lời sửa tin cũ — e2e CHU-5 từng đè giá tin cũ 6 tỷ → 7 tỷ.
    if (!wantsSell && !raoCanMoiXacNhan) {
      const mGia = new RegExp(
        `gi[áa]\\s*[^0-9]{0,12}?([\\d][\\d.,]*\\s*(?:${TIEN_CD})(?![a-zA-ZÀ-ỹ])[^,.;\\n]*)`,
        "i",
      ).exec(textSua);
      // Đuôi `[^,.;\n]*` giữ phần CÓ NGHĨA đi sau đơn vị ("6 tỷ 8", "5 tỷ
      // thương lượng"), nhưng cũng vơ luôn tiểu từ cuối câu ("6.8 tỷ nha em").
      // KHÔNG cắt ở đây: chuỗi này là bằng chứng thô, còn `price_raw` do
      // `chuan_hoa_gia_raw()` ở tầng DB gọt — một luật, một chỗ, và mọi cửa ghi
      // (form admin, câu trả lời drip) đều đi qua nó chứ không riêng cửa này.
      batSua(mGia, "gia", (m) => m[1].trim());
      batSua(/(?:phường|phuong)\s*\.?\s*(\d{1,2})\b/i.exec(textSua), "phuong",
        (m) => `Phường ${m[1]}`);
      batSua(/(\d{1,2})\s*(?:phòng ngủ|phong ngu|\bpn\b)/i.exec(textSua), "so_phong_ngu",
        (m) => m[1]);
      // 16/09/2026 (bắn thật sau deploy #144): "nhà 4 tấm diện tích TỔNG 240m2" là SÀN — lời sửa
      // từng đè area_m2 = 240 và nuốt luôn fact `dien_tich_san`. Sàn/sử dụng/tổng-của-nhà-có-tầng
      // không phải lời sửa diện tích đất (cùng luật `dienTichCauRao`).
      const mDtSua = /(?:diện tích|dien tich|\bdt\b)\s*[^0-9]{0,8}?(\d{1,4}(?:[.,]\d+)?)\s*m2?/i.exec(textSua);
      const dtLaSan = !!mDtSua && (
        TRUOC_LA_SAN.test(boDau(mDtSua[0])) ||
        (/\btong\b/.test(boDau(mDtSua[0])) && !/\bdat\b/.test(boDau(mDtSua[0])) && /\b(?:tam|tang|lau|tret)\b/.test(tKD))
      );
      batSua(dtLaSan ? null : mDtSua, "dien_tich", (m) => `${m[1]}m2`);
      // 11/09/2026 (Zalo thật, dự án ehome 3): "Bạn phải ghi dự án chung cư ehome 3
      // chứ ở hồ ngọc lãm" — chủ nhà nói RÕ loại khi sửa mà bản trước bỏ qua: tin vẫn
      // "nhà phố", bot hỏi "diện tích đất, ngang dài" cho một căn hộ. Chỉ bắt khi câu
      // có dấu hiệu SỬA/DẶN; vế sau "không phải" đã bị che trong `textSua`.
      if (/\b(?:phai ghi|ghi lai|ghi la|sua lai|sua thanh|chu khong phai|khong phai|nham|la can ho|la chung cu)\b/.test(boDau(text))) {
        batSua(
          /(chung cư|chung cu|căn hộ|can ho|nhà phố|nha pho|nhà cấp 4|nha cap 4|đất nền|dat nen|biệt thự|biet thu|mặt bằng|mat bang|phòng trọ|phong tro|kho xưởng|kho xuong)/i.exec(textSua),
          "loai_bds", (m) => m[1]);
      }
    }
    if (suaFacts.length) nhipSua.push(...nhipPhuDinh);
    // Trường nào đang là câu hỏi chờ thì để đường drip xử — tránh vừa ghi lời
    // sửa vừa bỏ lửng câu hỏi đang treo.
    const suaThat = suaFacts.filter(([k]) =>
      !(pendingReq &&
        (k === pendingReq.question ||
          (k === "dien_tich" && /^dien_tich/.test(pendingReq.question)))));

    // Bóc các đoạn "lời sửa" ra, cắt từ PHẢI sang TRÁI để chỉ số không trượt.
    const conLai = nhipSua.length
      ? nhipSua.slice().sort((a, b) => b[0] - a[0])
        .reduce((s, [i, j]) => `${s.slice(0, i)} ${s.slice(j)}`, text)
        .replace(/\s+/g, " ").replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, "").replace(TIEU_TU_DAU, "").trim()
      : text;
    // Tiểu từ đứng trơ một mình KHÔNG phải câu trả lời: "à giá 6.8 tỷ nha em"
    // bóc xong còn "à em" — đó vẫn chỉ là lời sửa. Lọc sau `boDau` nên danh
    // sách chỉ cần bản không dấu.
    const conChu = boDau(conLai)
      .replace(
        /\b(a|u|o|da|vang|em|anh|chi|nha|nhe|nhen|ha|hen|ok|oke|roi|thi|ma|voi|va|do|luon|sai|nham|lon|xin loi|sorry|chu|la)\b/gi,
        "",
      )
      .replace(/[^a-z0-9]+/gi, "");
    // Câu VỪA sửa một trường VỪA trả lời câu hỏi đang treo. Hai việc, không
    // được chọn một: đây chính là chỗ bản trước làm rơi câu trả lời drip.
    const vuaTraLoiVuaSua = !!pendingReq && conChu.length >= 2;

    if (suaThat.length) {
      // Neo đúng CĂN theo cùng thứ tự tin cậy của FR-157: mã chủ tự nhắc > căn
      // bot đang hỏi > căn của câu hỏi chờ > tin mới nhất của người này.
      let suaId: string | null = null;
      if (codeInText) {
        const { data: cl } = await client.from("listings").select("id")
          .eq("code", codeInText).eq("seller_id", sellerRow.id).maybeSingle();
        suaId = cl?.id ?? null;
      }
      suaId = suaId ?? sellerRow.active_listing_id ?? pendingReq?.listing_id ?? null;
      if (!suaId) {
        const { data: ml } = await client.from("listings").select("id")
          .eq("seller_id", sellerRow.id).order("created_at", { ascending: false })
          .limit(1).maybeSingle();
        suaId = ml?.id ?? null;
      }
      if (suaId) {
        await capNhatQuan(suaId);
        const NHAN: Record<string, string> = {
          gia: "giá", phuong: "phường",
          so_phong_ngu: "số phòng ngủ", dien_tich: "diện tích", loai_bds: "loại",
        };
        // 10/09 lần 7: "1 trệt 2 lầu, 3 phòng ngủ" (tin CHƯA có phòng ngủ) mà bot
        // báo "em cập nhật lại rồi" — nghe như chủ nhà vừa nói sai cái gì. Đọc
        // giá trị CŨ trước khi ghi: có rồi mới là sửa, trống thì chỉ là ghi thêm.
        const { data: truoc } = await client.from("listings")
          .select("price_raw, ward, bedrooms, area_m2, property_type").eq("id", suaId).maybeSingle();
        const daCoTruoc = (k: string) =>
          k === "gia"
            ? !!truoc?.price_raw
            : k === "phuong"
            ? !!truoc?.ward
            : k === "so_phong_ngu"
            ? truoc?.bedrooms != null
            : k === "dien_tich"
            ? truoc?.area_m2 != null
            : k === "loai_bds"
            ? !!truoc?.property_type && truoc.property_type !== "chua_ro"
            : true;
        const laSuaThat = suaThat.some(([k]) => daCoTruoc(k));
        const daGhi: string[] = [];
        // 22/09/2026 (kịch bản C): "gia 7 ti 5 chu ko phai 7 ty 2" — luật tiền không đọc ra "7 ti 5" (đã vá),
        // nhưng bot vẫn nói "Dạ em sửa lại giá 7 ti 5 rồi ạ" trong khi DB giữ 7ty2 và bản nháp in giá cũ.
        // Cùng luật với L1 (FR-177 o): giá chưa đọc ra số thì KHÔNG ghi, KHÔNG nói đã sửa — nói thật, xin gõ lại.
        let giaKhongDoc: string | null = null;
        for (const [k, v] of suaThat) {
          if (k === "gia" && docTien(v) == null) { giaKhongDoc = v; continue; }
          const { error: fErr } = await client.rpc("ghi_fact_listing", {
            p_listing_id: suaId, p_question: k, p_answer: v, p_source: "seller_chat",
          });
          if (fErr) await ghiLoi(client, `chat-reply ghi_fact_listing(${k})`, fErr.message);
          // Giá trị đã tự mang nhãn ("Phường 3") thì đừng dán nhãn lần nữa —
          // "phường Phường 3" đọc như máy hỏng.
          else {
            const nhan = NHAN[k] ?? k;
            // 22/09/2026 (bộ đo giọng B04): "giá 7 tỷ 5 nha em" — tiểu từ cuối câu là bằng chứng thô cho
            // DB gọt (`chuan_hoa_gia_raw`), nhưng lời xác nhận đọc lên thì bỏ.
            const hien = v.replace(/(?:\s+(?:nha|nhé|nhe|nghen|em|anh|chị|ạ|ơi|đó|á|nè|hen|ha|nhá|cháu|chú|cô|bác|ông|bà|dì|cậu|mợ|thím|dượng|thôi|luôn|nghe))+\s*$/iu, "");
            // 22/09/2026 (kịch bản C): lời xác nhận đọc đơn vị có dấu ("7 tỷ 5"), DB vẫn giữ chữ khách gõ.
            const hienDep = k === "gia" ? donViGiaDep(hien) : hien;
            daGhi.push(
              boDau(hienDep).startsWith(boDau(nhan)) ? hienDep : `${nhan} ${hienDep}`,
            );
          }
        }
        if (giaKhongDoc && !daGhi.length) {
          return await traLoiSeller(
            [`Dạ giá "${giaKhongDoc}" em chưa đọc ra số ạ, ${cachGoi} ghi giúp em kiểu "7 tỷ 5" hay "7,5 tỷ" nha.`],
            { gia_khong_doc: giaKhongDoc, ...(pendingReq ? { reask: pendingReq.question } : {}) },
          );
        }
        if (daGhi.length) {
          const cau = (laSuaThat
            ? `Dạ em sửa lại ${daGhi.join(", ")} rồi ạ.`
            : `Dạ em ghi ${daGhi.join(", ")} rồi ạ.`) +
            (giaKhongDoc ? ` Còn giá "${giaKhongDoc}" em chưa đọc ra số, ${cachGoi} ghi giúp em kiểu "7 tỷ 5" nha.` : "");
          // FR-177 c: đang chờ duyệt bản nháp thì lời sửa KHÔNG dừng ở đây —
          // xuống khối duyet_tin để gửi lại bản nháp với số mới.
          // 09/09 tối: đang có câu hỏi treo mà chỉ sửa ("6 phòng ngủ" khi em đang
          // hỏi tầng) thì cũng KHÔNG dừng — ghi xong bot im, chủ nhà ngồi chờ.
          // Đi tiếp xuống khối câu chờ để hỏi lại thứ còn thiếu.
          if (!vuaTraLoiVuaSua && !pendingReq) {
            return await traLoiSeller([cau], { sua_fact: suaThat.map(([k]) => k) });
          }
          // KHÔNG dừng ở đây. Trước bản này khối này `return` thẳng, nên câu
          // "sổ hồng rồi em, à giá 6.8 tỷ nha" (đang treo câu hỏi pháp lý) chỉ
          // ghi được GIÁ: câu trả lời pháp lý bay mất, `info_requests` kẹt
          // `pending`, và nhịp drip sau lại hỏi đúng cái chủ nhà vừa trả lời —
          // bot hỏi lại điều vừa được đáp là kiểu mất mặt FR-144 sinh ra để
          // tránh. Gắn lời cảm ơn vào đường ra chung rồi đi tiếp xuống khối
          // `pendingReq` để câu trả lời cũng vào sổ.
          ackSua = cau;
        }
      }
    }

    // ─── FR-185 (09/09/2026, chủ dự án: "ảnh phải gắn vào kho chứ"): ẢNH CHỦ
    // NHÀ GỬI → (1) model nhìn xem là ảnh gì (mặt tiền / trong nhà / hẻm / giấy
    // tờ / bản vẽ), (2) tải về kho của mình + `listing_media` — giấy tờ vào
    // bucket RIÊNG TƯ, ảnh nhà vào bucket công khai; không phân loại được thì
    // cất riêng tư (OPEN-32 đóng), (3) ảnh giấy tờ đọc diện tích trên sổ, đối
    // chiếu với số chủ nhà nói: chưa có thì lấy, lệch >5% thì hỏi lại + báo admin.
    // Kho hỏng (không tải/cất được) → rơi về đường cũ: fact `hinh_anh` giữ URL
    // Zalo tạm + ghi sổ lỗi, để tấm ảnh không mất hẳn. Neo căn theo thứ tự FR-157;
    // tin rao MỚI (wantsSell) thì căn chưa tồn tại — gọi sau khi tạo, ở dưới.
    const LOAI_ANH_VI: Record<LoaiAnh, string> = {
      mat_tien: "mặt tiền", trong_nha: "trong nhà", phong_ngu: "phòng ngủ", bep: "bếp", wc: "nhà vệ sinh",
      san_thuong: "sân thượng", view: "view", hem: "hẻm", giay_to: "giấy tờ", ban_ve: "bản vẽ", khong_lien_quan: "", khac: "",
    };
    const LOAI_MEDIA: Record<LoaiAnh, LoaiMedia> = {
      mat_tien: "mat_tien", trong_nha: "trong_nha", phong_ngu: "phong_ngu", bep: "bep", wc: "wc", san_thuong: "san_thuong",
      view: "view", hem: "hem", giay_to: "giay_to", ban_ve: "khac", khong_lien_quan: "khac", khac: "khac",
    };
    /** Trả `true` khi ảnh KHÔNG liên quan tới nhà (đã hỏi "gửi nhầm ảnh không", không cất vào tin). */
    const nhanAnh = async (listingId: string | null): Promise<boolean> => {
      if (!imageUrl) return false;
      let id = listingId;
      if (!id) {
        // Tin MỚI NHẤT còn đang rao — tin đã gỡ / đã chốt không nhận ảnh mới.
        const { data: ml } = await client.from("listings").select("id")
          .eq("seller_id", sellerRow!.id).in("status", ["cho_thong_tin", "dang_ban", "dang_quan_tam"])
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        id = ml?.id ?? null;
      }
      if (!id) return false;
      const { data: l } = await client.from("listings")
        .select("location_raw, ward, area_m2, property_type").eq("id", id).maybeSingle();
      const boiCanhAnh = [l?.property_type, l?.location_raw, l?.ward, l?.area_m2 ? `${l.area_m2}m2` : null]
        .filter(Boolean).join(" · ");
      let kq: Awaited<ReturnType<typeof phanLoaiAnh>>["kq"] = null;
      if (anthropicS) {
        try {
          const r = await phanLoaiAnh(anthropicS as unknown as Parameters<typeof phanLoaiAnh>[0], MODEL, imageUrl, boiCanhAnh);
          kq = r.kq;
          await doTien(client, r.usage as Parameters<typeof doTien>[1]);
        } catch (e) {
          await ghiLoi(client, "chat-reply phan loai anh", e);
        }
      }
      // 24/09/2026 (chủ dự án: "ảnh ko liên quan thì nhận xét luôn bảo à anh có gửi nhầm ảnh ko"): không cất vào tin.
      if (kq?.loai === "khong_lien_quan") {
        const moTaNham = kq.mo_ta?.trim().replace(/\.$/, "").replace(/^hình như (?:là )?/iu, "");
        ackAnh.push(`Dạ ảnh này ${moTaNham ? `hình như là ${moTaNham.charAt(0).toLowerCase()}${moTaNham.slice(1)}, ` : ""}em thấy không phải ảnh nhà. ${cachGoi.charAt(0).toUpperCase()}${cachGoi.slice(1)} có gửi nhầm ảnh không ạ?`);
        return true;
      }
      const loai: LoaiMedia = kq ? LOAI_MEDIA[kq.loai] : "khac";
      const tai = await taiAnh(imageUrl);
      // Không phân loại được → cất RIÊNG TƯ (ghi `giay_to` để CHECK bucket bắt buộc
      // riêng): thà web thiếu một tấm còn hơn sổ đỏ người ta nằm trên CDN công khai.
      const cat = tai
        ? await catAnhVaoKho(client, {
          listingId: id, bytes: tai.bytes, mime: tai.mime,
          loai: kq ? loai : "giay_to", moTa: kq?.mo_ta ?? null, ocr: kq?.giay_to ?? null,
        })
        : null;
      if (!cat) {
        await ghiLoi(client, "chat-reply anh vao kho",
          `không ${tai ? "cất" : "tải"} được ảnh ${imageUrl.slice(0, 80)} - giữ URL tạm trong fact hinh_anh`);
        const { error: aErr } = await client.rpc("ghi_fact_listing", {
          p_listing_id: id, p_question: "hinh_anh", p_answer: `[ảnh] ${imageUrl}`, p_source: "seller_chat",
        });
        if (aErr) await ghiLoi(client, "chat-reply ghi_fact_listing(anh)", aErr.message);
      }
      // Câu hỏi "gửi ảnh" đang treo thì đóng — ảnh đã có, hỏi nữa là hỏi thừa.
      const treoAnh = ds.find((p) => p.listing_id === id && p.question === "hinh_anh");
      if (treoAnh) {
        await client.from("info_requests").update({
          status: "answered", answer: cat ? `[kho] ${cat.bucket}/${cat.path}` : `[ảnh] ${imageUrl}`,
          answered_at: new Date().toISOString(),
        }).eq("id", treoAnh.id);
      }
      // Lời đáp: nói ảnh gì, và với giấy tờ thì đối chiếu diện tích.
      if (kq?.loai === "giay_to") {
        const g = kq.giay_to;
        const cau: string[] = [`Em nhận được ảnh ${g?.loai_giay ?? "giấy tờ"} rồi ạ, em cất riêng, không đưa lên web.`];
        const soM2 = g?.dien_tich_m2 ?? null;
        const lech = lechDienTich(soM2, l?.area_m2);
        if (soM2 && !l?.area_m2) {
          const { error: dtErr } = await client.rpc("ghi_fact_listing", {
            p_listing_id: id, p_question: "dien_tich", p_answer: `${soM2}m2`, p_source: "so_do_ocr",
          });
          if (dtErr) await ghiLoi(client, "chat-reply ghi_fact_listing(ocr dien tich)", dtErr.message);
          cau.push(`Sổ ghi ${soM2}m2, em lấy số đó làm diện tích nha.`);
        } else if (lech !== null && lech > 5) {
          cau.push(`Sổ ghi ${soM2}m2 mà mình đang ghi ${l?.area_m2}m2, ${cachGoi} xác nhận giúp em số nào đúng ạ?`);
          await Promise.all([
            client.rpc("ghi_fact_listing", {
              p_listing_id: id, p_question: "bo_sung",
              p_answer: `sổ ghi ${soM2}m2, lệch ${lech}% so với ${l?.area_m2}m2 chủ nhà nói (OCR)`, p_source: "so_do_ocr",
            }),
            client.from("reminders").insert({
              kind: "escalation", listing_id: id, due_at: new Date().toISOString(),
              note: `📐 Ảnh sổ tin ${pendingReq?.listings?.code ?? ""} ghi ${soM2}m2, chủ nhà nói ${l?.area_m2}m2 (lệch ${lech}%). Bot đã hỏi lại chủ; admin soát ảnh ở kho riêng.`,
            }),
          ]);
        } else if (soM2) {
          cau.push(`Sổ ghi ${soM2}m2, khớp với mình đã ghi.`);
        }
        if (g?.dia_chi) {
          const { error: dcErr } = await client.rpc("ghi_fact_listing", {
            p_listing_id: id, p_question: "bo_sung", p_answer: `địa chỉ trên sổ: ${g.dia_chi}`, p_source: "so_do_ocr",
          });
          if (dcErr) await ghiLoi(client, "chat-reply ghi_fact_listing(ocr dia chi)", dcErr.message);
        }
        ackAnh.push(cau.join("\n"));
      } else if (kq) {
        const nhan = LOAI_ANH_VI[kq.loai];
        const moTa = kq.mo_ta?.trim() ? `, ${kq.mo_ta.trim().replace(/\.$/, "").toLowerCase()}` : "";
        // 10/09 (chủ dự án): ảnh đã được model ĐỌC trước khi cất kho → khen bằng
        // điểm mạnh THẬT nhìn thấy (`khen`), không khen suông.
        const khen = (kq as { khen?: string | null }).khen?.trim()?.replace(/\.$/, "");
        ackAnh.push(khen
          ? `Em nhận được ảnh${nhan ? ` ${nhan}` : ""} rồi ạ. ${khen.charAt(0).toUpperCase() + khen.slice(1)}, khách lướt qua là để ý liền.`
          : `Em nhận được ảnh${nhan ? ` ${nhan}` : ""} rồi ạ${moTa}. Ảnh này giúp khách hình dung căn nhà nhanh hơn nhiều.`);
      } else {
        ackAnh.push("Dạ em nhận được ảnh rồi ạ, em bổ sung vào tin ngay.");
      }
      return false;
    };
    // Seller gửi ẢNH không kèm chữ → nhận ảnh rồi dừng; TUYỆT ĐỐI không coi chuỗi
    // rỗng là "câu trả lời" cho câu hỏi đang chờ (từng làm mất fact pháp lý).
    if (!text && imageUrl) {
      const nham = await nhanAnh(pendingReq?.listing_id ?? sellerRow.active_listing_id ?? null);
      return await traLoiSeller(nham ? [] : [`Cảm ơn ${cachGoi} nhiều!`], { anh: true, ...(nham ? { anh_nham: true } : {}) });
    }
    // Soát 01/09 (vai người bán): ảnh KÈM CHÚ THÍCH từng rơi mất — chữ là câu
    // trả lời, ảnh vẫn phải vào kho. Neo căn theo thứ tự FR-157.
    if (!wantsSell && imageUrl) {
      await nhanAnh(pendingReq?.listing_id ?? sellerRow.active_listing_id ?? null);
    }
    // ─── FR-177 c: BẢN NHÁP TIN + "như vậy được chưa?".
    // Tiền định, KHÔNG model: số liệu trong bản nháp phải đúng từng chữ với
    // cột — model chỉ được nói, không được bịa số. Điểm đầy đủ do `diem_tin`
    // (DB) chấm; dưới 70 thì chưa gửi nháp, trả về danh sách còn thiếu để
    // tầng trên hỏi tiếp. Mở câu chờ `duyet_tin` để lượt sau biết chủ nhà đang
    // trả lời bản nháp chứ không phải một câu hỏi thông số.
    type DiemTin = { diem: number; chi_tiet: Record<string, number>; thieu: string[]; co_anh: boolean; so_anh?: number };
    const goiYTiemNang = (l: SpecRow & { property_type?: string | null; bedrooms?: number | null }): string | null => {
      if (l.property_type === "chung_cu") return "ở gia đình hoặc cho thuê";
      if (l.property_type === "mat_bang") return "kinh doanh, mở shop, văn phòng";
      if (l.property_type === "phong_tro") return "cho thuê";
      if (l.access_type === "mat_tien" || (l.alley_width_m ?? 0) >= 4) return "ở kết hợp kinh doanh hoặc cho thuê";
      if ((l.floors ?? 0) >= 3 || (l.bedrooms ?? 0) >= 3) return "ở gia đình đông người hoặc cho thuê CHDV";
      return null;
    };
    // 21/09/2026 (bắn thật mau-tdt): "sổ hồng riêng, hoàn công đủ. mà em là người hay máy vậy?" → đủ điểm,
    // bản nháp gửi luôn và câu hỏi của chủ nhà bị NUỐT. `truoc` = bong bóng đứng trước bản nháp (đáp án
    // tiền định cho câu hỏi ngược).
    const guiBanNhap = async (
      listingId: string, extra: Record<string, unknown>, lai = false, truoc: string[] = [], dangLuon = false,
    ): Promise<Awaited<ReturnType<typeof traLoiSeller>> | string[]> => {
      const [{ data: l }, { data: dt, error: dErr }, { data: facts }] = await Promise.all([
        client.from("listings")
          .select(`code, location_raw, ward, district, deal, area_m2, price_raw, price_vnd, bedrooms, property_type, gap, negotiable, furnishing, floor, rear_width_m, rent_income_vnd, ${SPEC_COLS}`)
          .eq("id", listingId).maybeSingle(),
        client.rpc("diem_tin", { p_listing_id: listingId }),
        client.from("listing_facts").select("question, answer, created_at")
          .eq("listing_id", listingId)
          .order("created_at", { ascending: false }),
      ]);
      if (dErr) await ghiLoi(client, "chat-reply diem_tin", dErr.message);
      const d = (dt ?? null) as DiemTin | null;
      if (!l || !d) return [];
      // 20/09/2026 (bắn thật mau-y-D): "giá 250 triệu/m2 thương lượng" — price_raw có chữ nhưng
      // parse_vnd không ra số → tin không bao giờ lên kệ, mà điểm vẫn 75 và bản nháp vẫn gửi với
      // "giá 250…". Chưa đọc ra GIÁ CẢ CĂN thì chưa gửi nháp: báo thiếu giá để hỏi lại.
      const lg = l as { price_vnd?: number | null; price_raw?: string | null };
      if (lg.price_vnd == null) {
        const thieuGia = `giá cả căn bằng con số${lg.price_raw ? ` (em chưa đọc ra số từ "${lg.price_raw}")` : ""}`;
        return [thieuGia, ...(d.thieu ?? []).filter((t) => !/^giá/i.test(t))];
      }
      if (d.diem < 70) return d.thieu ?? [];
      // Chủ dự án 09/09/2026 tối: "bản nháp gửi lại khách phải ghi rõ ràng và tốt
      // như MỘT TIN RAO THẬT, nhưng không bịa". Mọi dòng dưới đây đều từ cột hoặc
      // fact chủ nhà đã nói (fact mới nhất mỗi khoá); không có thì không có dòng,
      // KHÔNG đoán tiềm năng thay chủ nhà.
      // 12/09/2026: bản nháp dựng ở `_shared/tin-nhap.ts` — viết như TIN RAO
      // THẬT theo mẫu tin lẻ mogi.vn (tiêu đề gộp · địa chỉ · GIÁ · thông số),
      // và tách ra để `scripts/xem-tin-nhap.mjs` dựng thử trên dữ liệu thật mà
      // không phải deploy, `bot/tests/tin-nhap-rao.mjs` kiểm offline.
      // 24/09/2026 (chủ dự án: "nếu khách nói kiểu đăng đi thì ko hỏi nữa đưa tin luôn"): chủ đã nói "đăng đi" và tin đủ
      // điểm → đóng dấu duyệt NGAY (trigger đưa lên kệ), gửi tin đã đăng, không hỏi "ổn chưa". Chưa lên kệ được (thiếu
      // phường / diện tích — `listing_du_dang_tin`) thì nói thật còn thiếu gì; dấu duyệt giữ lại, có đủ là tự lên kệ.
      if (dangLuon) {
        const { error: dlErr } = await client.from("listings").update({ chu_duyet_at: new Date().toISOString() }).eq("id", listingId);
        if (dlErr) await ghiLoi(client, "chat-reply dang luon", dlErr.message);
        const { data: sau } = await client.from("listings").select("status, ward, area_m2").eq("id", listingId).maybeSingle();
        const { error: dtErr } = await client.from("info_requests").update({ status: "answered", answer: "đăng đi", answered_at: new Date().toISOString() })
          .eq("listing_id", listingId).eq("question", "duyet_tin").eq("status", "pending");
        if (dtErr) await ghiLoi(client, "chat-reply dang luon(dong duyet)", dtErr.message);
        if (sau && sau.status !== "cho_thong_tin") {
          const tinDang = soanTinNhap({
            l: l as TinNhapRow, facts: (facts ?? []) as FactNhap[], diem: d.diem, thieu: d.thieu ?? [],
            soAnh: d.so_anh ?? 0, lai: false, cauTD, daDang: true,
          });
          return await traLoiSeller([...truoc, tinDang, cauTD("dang_luon_cuoi")], { ...extra, duyet: true, dang_luon: true, diem: d.diem, listing_status: sau.status });
        }
        const thieuDang = [!sau?.ward ? "phường" : null, sau?.area_m2 == null ? "diện tích" : null].filter(Boolean).join(" và ") || "vài thông tin";
        if (sau && !sau.ward) {
          const { error: pErr } = await client.from("info_requests").insert({ listing_id: listingId, question: "phuong", status: "pending" });
          if (pErr && pErr.code !== "23505") await ghiLoi(client, "chat-reply dang luon(mo phuong)", pErr.message);
        }
        return await traLoiSeller([...truoc, cauTD("dang_luon_thieu", { thieu: thieuDang })], { ...extra, dang_luon: true, thieu_dang: thieuDang });
      }
      const tin = soanTinNhap({
        l: l as TinNhapRow,
        facts: (facts ?? []) as FactNhap[],
        diem: d.diem,
        thieu: d.thieu ?? [],
        soAnh: d.so_anh ?? 0,
        lai,
        cauTD,
      });
      // 23505 = câu duyệt đã mở từ lượt trước (gửi lại bản nháp) — không phải sự cố.
      const { error: irErr } = await client.from("info_requests").insert({
        listing_id: listingId, question: "duyet_tin", status: "pending",
      });
      if (irErr && irErr.code !== "23505") await ghiLoi(client, "chat-reply mo duyet_tin", irErr.message);
      return await traLoiSeller([...truoc, tin], { ...extra, ban_nhap: true, diem: d.diem });
    };
    // Tự kiểm 02/09: chủ nhà đang bị hỏi dở (pendingReq) mà nhắn RAO THÊM CĂN
    // KHÁC → bản cũ ghi cả câu rao làm CÂU TRẢ LỜI cho câu hỏi đang treo, vì
    // khối pendingReq đứng trước khối wantsSell và không hỏi gì thêm. Câu rao
    // thật KÈM dấu hiệu "căn khác" (thêm/nữa/căn khác, hoặc phường KHÁC phường
    // căn đang hỏi) thì đi tạo tin. "bán 5 tỷ nhà này" trả lời câu hỏi giá thì
    // không có dấu hiệu đó → vẫn là câu trả lời, không đẻ tin trùng.
    // 16/09/2026: đã xác nhận "căn khác" ở câu hỏi căn-cũ-hay-mới thì là rao MỚI dù không có
    // chữ thêm/nữa; câu có chi tiết lúc đang được xin chi tiết căn mới cũng vậy.
    // 17/09/2026 (Zalo thật): đang hỏi phường căn "hẻm 4m Nguyễn Trãi" mà chủ nhà nhắn "cô có căn
    // nhà hẻm 4m Trần Hưng Đạo quận 5, 50m2, giá 5 tỷ 8…" → bản trước ghi cả câu làm vị trí của
    // tin cũ (location_raw = nguyên câu, street = "Chào cháu"). Câu rao mang địa chỉ ở ĐƯỜNG KHÁC
    // căn đang hỏi là căn khác.
    const duongMoi = tenDuong(bocViTriRao(text) ?? "");
    const duongCu = tenDuong(pendingReq?.listings?.location_raw ?? "");
    // 24/09/2026 (chủ dự án test Zalo): câu có nhắc lại ĐÚNG tên đường căn đang hỏi ("…ngay nút giao Trần Đình Xu") thì
    // vẫn là căn đó, dù luật bắt được một cụm "đường" khác trước.
    const khacDuong = !!duongMoi && !!duongCu && boDau(duongMoi) !== boDau(duongCu) && !boDau(text).includes(boDau(duongCu));
    // FR-214 b (23/09/2026, Zalo chủ dự án): đang hỏi phường căn nhà Kênh Tân Hóa (Q11) mà nhắn "Đúng rồi và cô
    // muốn rao bán 1 mảnh đất ở xã Cần Giuộc tỉnh Long An ở đường tỉnh lộ 830" → căn nhà chưa có tên đường chuẩn
    // nên `khacDuong` không bắt, cả câu thành câu trả lời phường, lô đất đè lên căn nhà. Câu rao nhắc QUẬN/TỈNH
    // khác hoặc LOẠI khác (đất ↔ nhà ↔ căn hộ) với căn đang hỏi cũng là căn khác.
    const quanRaoMoi = bocQuan(tKD, text) ?? vungNgoai(tKD)?.ten ?? null;
    const quanCanCu = pendingReq?.listings?.district ?? null;
    const khacQuan = !!quanRaoMoi && !!quanCanCu && boDau(quanRaoMoi).replace(/,.*$/, "") !== boDau(quanCanCu).replace(/,.*$/, "");
    const nhomLoai = (l: string | null | undefined) => l === "dat" ? "dat" : l === "chung_cu" ? "chung_cu" : l && l !== "chua_ro" ? "nha" : null;
    // 23/09/2026: câu CÓ DẤU thì "nha" (hạt câu: "hướng Đông nha em") không phải "nhà", "dat" không phải "đất" — dò trên chữ
    // có dấu; câu gõ không dấu mới đoán trên bản bỏ dấu như cũ.
    const coDauCau = /[À-ỹđĐ]/.test(text);
    const coNha = coDauCau ? /(?<![\p{L}])nhà(?![\p{L}])/iu.test(text) : /\bnha\b/.test(tKD);
    const coDat = coDauCau ? /(?<![\p{L}])(?:mảnh đất|lô đất|đất nền|miếng đất|đất)(?![\p{L}])/iu.test(text) : /\b(?:manh dat|lo dat|dat nen|mieng dat|dat)\b/.test(tKD);
    const loaiRaoMoi = coDat && !coNha ? "dat"
      : /\b(?:can ho|chung cu)\b/.test(tKD) ? "chung_cu" : coNha ? "nha" : null;
    const khacLoai = !!loaiRaoMoi && !!nhomLoai(pendingReq?.listings?.property_type) && loaiRaoMoi !== nhomLoai(pendingReq?.listings?.property_type);
    // Câu "muốn rao bán 1 mảnh đất ở …" chưa có giá/diện tích nên luật rao (`wantsSell`) chưa nhận; có chữ bán +
    // loại BĐS + khác nơi/khác loại căn đang hỏi thì đó vẫn là căn mới, đi đường tạo tin.
    const raoMoiCanKhac = !daGanManh && !wantsSell && !!pendingReq && coChuBan && coLoaiBDS && !hoiConBan && (khacQuan || khacLoai);
    const raoMoiKhiDangHoi = !daGanManh && !!pendingReq && (wantsSell || raoCanMoiXacNhan || raoMoiCanKhac) && (
      raoCanMoiXacNhan || khacDuong || khacQuan || khacLoai ||
      // 15/09/2026: "còn căn 2 mặt tiền trần phú 4x20 giá 18 tỷ thì sao em" — "còn căn <số>"
      // cũng là căn KHÁC (bản trước hiểu là sửa căn 1). Số kèm đơn vị (căn 2 pn) thì không.
      khop(
        /\b(thêm|nữa|căn khác|căn thứ|còn (một|1) căn|lô khác|còn (?:căn|lô) (?:số )?\d{1,2}\b(?!\s*(?:pn|phòng|x\s*\d|m2|tỷ|triệu|lầu|tầng|tấm)))\b/i,
        /\b(them|nua|can khac|can thu|con (mot|1) can|lo khac|con (?:can|lo) (?:so )?\d{1,2}\b(?!\s*(?:pn|phong|x\s*\d|m2|ty|trieu|lau|tang|tam)))\b/,
      ) ||
      (!!wardNo && !!pendingReq.listings?.ward &&
        `Phường ${wardNo}` !== pendingReq.listings.ward)
    );
    // FR-214 b: "Đúng rồi và cô muốn rao bán mảnh đất …" — nửa đầu GẬT phường bot gợi ý cho căn đang hỏi, nửa
    // sau là căn mới (đi tiếp đường rao bên dưới). Bản cũ nuốt cả câu vào ô phường, phường gợi ý không được ghi.
    if (raoMoiKhiDangHoi && pendingReq?.question === "phuong" && !humanActive &&
        /^\s*(?:da\s+)?(?:dung roi|dung vay|dung|u|uh|um|ok|oke|vang|phai|chinh xac)\b/.test(tKD)) {
      const g = (pendingReq.listings?.boc_tach as { phuong_goi_y?: { phuong?: unknown } } | null)?.phuong_goi_y;
      if (g && typeof g === "object" && typeof g.phuong === "string" && g.phuong) {
        const { error: pgErr } = await client.rpc("ghi_fact_listing", {
          p_listing_id: pendingReq.listing_id, p_question: "phuong", p_answer: g.phuong, p_source: "seller_chat",
        });
        if (pgErr) await ghiLoi(client, "chat-reply gat phuong + rao moi", pgErr.message);
        else {
          const { error: irErr } = await client.from("info_requests").update({ status: "answered", answer: g.phuong, answered_at: new Date().toISOString() }).eq("id", pendingReq.id);
          if (irErr) await ghiLoi(client, "chat-reply gat phuong + rao moi(dong cau)", irErr.message);
          // Gợi ý mang cả quận ("Phường Bình Thới (Quận 11 cũ)") → ghi quận khi căn chưa có, và xoá gợi ý (bắn thật 23/09:
          // bản trước chỉ xoá gợi ý, căn nhà nằm "chưa rõ quận").
          await capNhatQuanTuPhuong(pendingReq.listing_id, typeof (g as { quan?: unknown }).quan === "string" ? g as GoiYPhuong : null, g.phuong);
          const tenCu = pendingReq.listings?.location_raw ? ` căn ${pendingReq.listings.location_raw}` : "";
          ackAnh.push(doiTuXung([`Dạ em ghi ${g.phuong} cho${tenCu} rồi ạ.`], sellerRow.xung_ho ?? null, sellerRow.nhom_tuoi ?? null)[0]);
        }
      }
    }
    if (pendingReq && !raoMoiKhiDangHoi) {
      // FR-164: KHÔNG còn ghi thẳng cột ở đây nữa.
      // Trước bản này khối này tự UPDATE `area_m2` rồi `property_type` trước khi
      // ghi fact — một nhà chức trách THỨ HAI ghi đúng những cột mà trigger fact
      // đang ghi, và nó lách được hai luật:
      //   * bậc ưu tiên: ghi đè bất kể cột đang do admin giữ, lại không đặt
      //     `property_type_source` nên giá trị mới đội lốt nhãn nguồn cũ;
      //   * luật tim-tường FR-163: `/^dien_tich/` khớp luôn `dien_tich_tim_tuong`
      //     nên diện tích tim tường vẫn đè area_m2 của nhà phố — đúng cái chỗ
      //     FR-163 vừa bịt ở tầng DB, thủng lại từ phía app.
      // Nay chỉ ghi FACT; `listing_facts_sync_cols` lo chuẩn hoá, kiểm giá trị,
      // đo bậc ưu tiên và đặt nhãn nguồn. Một luật, một chỗ.
      //
      // Riêng loai_bds vẫn hỏi hàm DB TRƯỚC, nhưng chỉ để quyết định có HỎI LẠI
      // không — không ghi cột. Dùng hàm DB (FR-150/FR-164) nên câu có phủ định
      // ("nhà phố chứ không phải chung cư") cũng đọc đúng.
      // Câu có kèm lời sửa thì phần ĐÃ BÓC mới là câu trả lời. Giữ nguyên cả
      // câu là nhét "giá 6.8 tỷ" vào fact pháp lý — bằng chứng sai chỗ còn tệ
      // hơn thiếu bằng chứng, vì nó trông như chủ nhà đã xác nhận.
      let dapAn = textTreo
        ? textTreo
        : ackSua
        ? conLai
        : nhipPhuDinh.length && suaFacts.length ? cheoPhuDinh(text).replace(/\s+/g, " ").trim() : text;
      // 11/09/2026 (42 ca): câu CHỈ là lời sửa ("sai rồi em, phường 9 chứ không phải
      // phường 4") → phần còn lại "sai rồi em" không phải câu trả lời; bản trước đem
      // nó đi phân loại và nó thành ĐỊA CHỈ. Nhận lời sửa rồi hỏi lại câu đang treo
      // trong CÙNG một bong bóng.
      if (ackSua && conChu.length < 2 && pendingReq.question !== "duyet_tin" && !humanActive) {
        const cauSua = `${ackSua} ${cauHoiMau(pendingReq.question, cachGoi, pendingReq.listings?.property_type, pendingReq.listings?.district, pendingReq.listings?.deal)}`;
        ackSua = null;
        return await traLoiSeller([cauSua], { sua_fact: true, reask: pendingReq.question });
      }
      // FR-177 g: chủ nhà nói "đủ rồi / vậy thôi / đừng hỏi nữa" giữa vòng hỏi
      // (không phải lúc duyệt bản nháp — ở đó "đủ rồi" là GẬT, xử ở dưới) →
      // đóng dấu chu_noi_du_at, đóng mọi câu đang treo của căn, KHÔNG hỏi nữa.
      // Điểm giữ nguyên theo dữ liệu thật; chủ nhà nhắn thêm gì sau này thì
      // FR-164 vẫn ghi. Tiền định (laDuRoi), không tốn model.
      if (pendingReq.question !== "duyet_tin" && pendingReq.question !== "loai_bds" && laDuRoi(dapAn)) {
        const luc = new Date().toISOString();
        const { error: duErr } = await client.from("listings")
          .update({ chu_noi_du_at: luc }).eq("id", pendingReq.listing_id);
        if (duErr) await ghiLoi(client, "chat-reply chu noi du", duErr.message);
        const { error: dongErr } = await client.from("info_requests")
          .update({ status: "expired" })
          .eq("listing_id", pendingReq.listing_id).eq("status", "pending");
        if (dongErr) await ghiLoi(client, "chat-reply dong cau treo(du roi)", dongErr.message);
        const { data: dDu } = await client.rpc("diem_tin", { p_listing_id: pendingReq.listing_id });
        const diemDu = (dDu as { diem?: number } | null)?.diem;
        const cauDu = `Dạ em hiểu rồi, em rao với thông tin hiện tại nha${
          typeof diemDu === "number" ? ` (tin mình ${diemDu}/100)` : ""
        }.\nLúc nào có thêm ảnh hay thông tin, ${cachGoi} nhắn em là em cập nhật liền ạ.`;
        // 22/09/2026: KHÔNG xin chấm điểm ở đây nữa (dời sang lúc chủ nhà báo bán được — xem `xinChamDiem`).
        return await traLoiSeller([cauDu], { du_roi: true, diem: diemDu ?? null });
      }
      // FR-212: lượt trước bot hỏi "Đường mình là X phải không?" (tên đường gõ sai 1–2 ký tự,
      // gợi ý ở `boc_tach.duong_goi_y`). Gật → ghi địa chỉ đã sửa (fact vi_tri, trigger đồng bộ
      // location_raw/street), hỏi lại câu đang treo. Không gật → bỏ gợi ý, câu vừa nhắn đi đường
      // thường (thường chính là câu trả lời câu đang treo). Gợi ý dùng đúng một lần.
      {
        const gD = (pendingReq.listings?.boc_tach as { duong_goi_y?: unknown } | null | undefined)?.duong_goi_y;
        if (gD && typeof gD === "object" && typeof (gD as GoiYDuong).ten === "string" && typeof (gD as GoiYDuong).vi_tri === "string") {
          const goiY = gD as GoiYDuong;
          const { error: xErr } = await client.rpc("ghi_boc_tach", { p_listing_id: pendingReq.listing_id, p: { duong_goi_y: false } });
          if (xErr) await ghiLoi(client, "chat-reply ghi_boc_tach(xoa duong goi y)", xErr.message);
          // Bắn thật 21/09 (mau-tdt2): "đúng rồi em, phường 2 quận 5" — gật ở VẾ ĐẦU kèm thông tin: gật vẫn
          // là gật (sửa đường), phần còn lại đi đường thường như một câu trả lời.
          const veDauD = dapAn.split(/[,;.!?]|\s+(?:mà|ma|nhưng|nhung|và|va|với|voi)\s+/u)[0]?.trim() ?? "";
          const gatCa = laDongY(dapAn);
          const gatDau = !gatCa && veDauD.length > 0 && veDauD !== dapAn.trim() && laDongY(veDauD);
          if ((gatCa || gatDau) && !humanActive && pendingReq.question !== "duyet_tin") {
            const { error: vErr } = await client.rpc("ghi_fact_listing", {
              p_listing_id: pendingReq.listing_id, p_question: "vi_tri", p_answer: goiY.vi_tri, p_source: "seller_chat",
            });
            if (vErr) await ghiLoi(client, "chat-reply ghi_fact_listing(vi_tri sua duong)", vErr.message);
            if (gatCa) {
              const cauKeDuong = cauHoiMau(pendingReq.question, cachGoi, pendingReq.listings?.property_type, pendingReq.listings?.district, pendingReq.listings?.deal, goiY.vi_tri);
              return await traLoiSeller([`Dạ em sửa lại ${goiY.ten} rồi ạ. ${cauKeDuong}`], { sua_duong: goiY.ten, reask: pendingReq.question, loai_cau: "sua_duong" });
            }
            // Cắt vế gật, phần còn lại là câu trả lời (bong bóng 🤖 của lượt đã báo "vị trí cụ thể" đổi).
            dapAn = dapAn.slice(dapAn.indexOf(veDauD) + veDauD.length).replace(/^[\s,;.!?]+/u, "").replace(/^(?:mà|ma|nhưng|nhung|và|va|với|voi)\s+/iu, "").trim() || dapAn;
          }
        }
      }
      let loaiDapAn: string | null = null;
      if (pendingReq.question === "loai_bds") {
        // 21/09/2026 (chủ dự án: "các trường khác cũng vậy, để AI nhận diện nó thuộc trường nào"): chế độ
        // `chinh` — AI đọc loại BĐS trước (qua kiểm bằng chứng), RPC đoán loại chỉ đỡ khi AI trống.
        let pt: string | null = null;
        if (bongAi && cheDoBocAi && (await cheDoBocAi) === "chinh") {
          const kqAi = await bongAi;
          if (kqAi?.ket) pt = docAiChinh(kiemDeXuat(kqAi.truong, text).dat, null).loaiBds;
        }
        if (!pt) {
          const { data: ptLuat } = await client.rpc("guess_property_type_answer", { p_text: dapAn });
          pt = ptLuat ? String(ptLuat) : null;
        }
        // 16/09/2026 (bắn thật): "Nhà trong hẻm 2 xẹc nhưng hẻm rộng 5m nhà 4 tấm" → ô loại BĐS ghi
        // NGUYÊN câu (rồi DB đọc "nhà trong" ra nhà trống). Đáp án ô loại là TÊN LOẠI đọc ra.
        // Chỉ thay đáp án GHI vào ô loại; `dapAn` giữ nguyên để nhặt fact kèm (hẻm, tầng, sàn).
        if (pt && LOAI_DAP_AN[String(pt)]) loaiDapAn = LOAI_DAP_AN[String(pt)];
        if (!pt) {
          // Không đọc ra loại → HỎI LẠI, giữ nguyên câu hỏi pending. TUYỆT ĐỐI
          // không ghi fact `loai_bds`: ghi xong là listing_missing_facts hết
          // hỏi, tin nằm `chua_ro` vĩnh viễn — đúng kiểu chết lặng FR-150 diệt.
          // 20/09/2026 (mau-y-A): câu chỉ nói QUẬN ("ca 2 can deu quan 10 nhe") thì ghi quận rồi hỏi lại.
          const qGhi = await capNhatQuan(pendingReq.listing_id);
          const again = qGhi
            ? `Dạ em ghi ${qGhi} rồi ạ. Còn nhà mình thuộc loại nào ta: nhà phố, nhà cấp 4, chung cư, đất, biệt thự, phòng trọ hay mặt bằng ạ?`
            : "Dạ em chưa rõ lắm ạ, nhà mình thuộc loại nào ta: nhà phố, nhà cấp 4, chung cư, đất, biệt thự, phòng trọ hay mặt bằng ạ?";
          return await traLoiSeller([again], { reask: "loai_bds", ...(qGhi ? { quan: qGhi } : {}) });
        }
      }

      // FR-176: CÂU VỪA NHẮN CÓ PHẢI CÂU TRẢ LỜI KHÔNG? Trước bản này khối
      // này lấy NGUYÊN câu chat làm đáp án: "Kêu chị nha" đóng câu pháp lý,
      // "16m nha" thành hướng nhà, "Ngang 5" đóng câu diện tích mà area_m2 vẫn
      // trống — và bot không bao giờ hỏi lại. Luật: thà hỏi lại một câu thừa
      // còn hơn đóng một câu hỏi bằng rác. Phân loại ở tầng tiền định
      // (`_shared/extraction/khop-cau-tra-loi.ts`), model chỉ lo NÓI.
      // FR-177 c: đang chờ chủ nhà DUYỆT BẢN NHÁP. Gật (AGREE_RULES, bản tiền
      // định `laDongY`) → khớp, xuống dưới đóng dấu `chu_duyet_at`. Sửa → ghi
      // (lời sửa có nhãn đã vào sổ ở khối FR-164; phần còn lại nhận ra fact
      // nào thì ghi fact đó, không thì `bo_sung`) rồi GỬI LẠI bản nháp, câu
      // duyệt vẫn treo. Hỏi ngược / ừ / dặn xưng hô → đường hỏi lại chung.
      let kqDuyet: KetQuaKhop | null = null;
      if (pendingReq.question === "duyet_tin") {
        const chiSua = !!ackSua && conChu.length < 2;
        // FR-177 g: "đủ rồi, đăng đi" lúc duyệt là GẬT, và là lời "đủ rồi".
        // 21/09/2026 (bắn thật mau-tdt): "ok em đăng đi, mà cái dòng phù hợp đọc kỳ quá" — gật nằm ở VẾ ĐẦU,
        // vế sau là lời bình về bản nháp, không phải dữ liệu căn nhà; bản trước coi cả câu là lời sửa, nhét
        // nguyên câu vào "📝 Thêm" rồi gửi lại nháp kèm "Em sửa lại rồi". Vế sau có fact thật thì vẫn là sửa.
        const veDau = dapAn.split(/[,;.!?]|\s+(?:mà|ma|nhưng|nhung)\s+/u)[0]?.trim() ?? "";
        // Có LỜI SỬA trong câu ("ok đăng đi, mà giá 9 tỷ 8") thì vẫn theo FR-177 c: ghi rồi gửi lại nháp, chưa duyệt.
        const gatVeDau = !ackSua && veDau.length > 0 && veDau !== dapAn.trim() && (laDongY(veDau) || laDuRoi(veDau)) &&
          !nhanDienFact(dapAn.slice(dapAn.indexOf(veDau) + veDau.length));
        if (!chiSua && (laDongY(dapAn) || laDuRoi(dapAn) || gatVeDau)) {
          kqDuyet = { loai: "khop" };
        } else if (!chiSua && !/[\p{L}\p{N}]/u.test(dapAn)) {
          // 22/09/2026 (kịch bản C): "😂😂" lúc chờ duyệt → model từng nói "Em thấy anh chị đồng ý rồi ạ" rồi
          // hỏi lại. Emoji vui (👍❤️😊) đã là gật ở `laDongY`; emoji khác không phải gật cũng không phải sửa —
          // câu tiền định, không gọi model, câu duyệt vẫn treo.
          return await traLoiSeller([`Dạ 😊 Bản nháp ở trên ${cachGoi} thấy được thì nhắn "ok" là em đăng liền, muốn sửa chỗ nào thì nhắn em nha.`], { reask: "duyet_tin", loai_cau: "emoji" });
        } else if (!chiSua && laNoiVoiBot(dapAn) && !nhanDienFact(dapAn)) {
          // 21/09/2026 (bắn thật): "xóa sạch data của anh đi để anh test lại" / "cái dòng phù hợp đọc kỳ quá" lúc
          // duyệt → từng vào `bo_sung` rồi gửi lại nháp kèm "Em sửa lại rồi". Lời nói với bot không phải dữ liệu
          // căn nhà: không ghi, không gửi lại nháp, nói thật điều bot không tự làm được; câu duyệt vẫn treo.
          const cauMeta = laXinXoaDuLieu(dapAn)
            ? "Dạ việc xoá dữ liệu em không tự làm được, để em nhờ anh chị phụ trách xử lý ạ."
            : "Dạ em nghe rồi ạ.";
          return await traLoiSeller([`${cauMeta} Bản nháp ở trên ${cachGoi} thấy được thì nhắn "ok" là em đăng liền ạ.`], { reask: "duyet_tin", loai_cau: "meta" });
        } else if (!chiSua && khop(PROMISE_RE, PROMISE_RE_KD)) {
          // 09/09 tối: "tối đi làm về chụp hình gửi em" lúc đang chờ duyệt là LỜI
          // HỨA (nhắc đã đặt ở trên), không phải lời sửa — đừng gửi lại bản nháp,
          // chỉ cảm ơn và giữ câu duyệt treo.
          return await traLoiSeller(
            [`Dạ em chờ ảnh của ${cachGoi} nha. Bản nháp ở trên ${cachGoi} thấy được thì nhắn "ok" là em đăng liền ạ.`],
            { reask: "duyet_tin", loai_cau: "hua" },
          );
        } else {
          const k = chiSua ? { loai: "lech" as const } : phanLoaiCauTraLoi("duyet_tin", dapAn);
          if (k.loai === "khop" || k.loai === "lech") {
            if (!chiSua) {
              const nd = k.chuyenSang ?? nhanDienFact(dapAn) ?? { question: "bo_sung", answer: dapAn };
              const { error: sErr } = await client.rpc("ghi_fact_listing", {
                p_listing_id: pendingReq.listing_id, p_question: nd.question,
                p_answer: nd.answer, p_source: "seller_chat",
              });
              if (sErr) await ghiLoi(client, "chat-reply ghi_fact_listing(sua nhap)", sErr.message);
            }
            const lai = await guiBanNhap(pendingReq.listing_id, { reask: "duyet_tin", sua_nhap: true }, true);
            if (!Array.isArray(lai)) return lai;
            kqDuyet = { loai: "lech" }; // điểm tụt dưới 70 sau khi sửa (hiếm) → hỏi lại
          } else {
            kqDuyet = k;
          }
        }
      }
      // FR-209: bot đã gợi ý phường tra từ tên đường ("…đúng không anh?"); chủ nhà
      // GẬT ("đúng rồi", "ừ", 👍) → đáp án CHÍNH LÀ phường gợi ý, đi đường khớp như
      // chủ nhà tự gõ. Không gật → gợi ý bỏ, câu trả lời đi đường thường.
      let goiYPhuong: GoiYPhuong | null = null;
      let nhanGoiYPhuong = false;
      if (pendingReq.question === "phuong") {
        const { data: btRow } = await client.from("listings").select("boc_tach").eq("id", pendingReq.listing_id).maybeSingle();
        const g = (btRow?.boc_tach as { phuong_goi_y?: unknown } | null)?.phuong_goi_y;
        if (g && typeof g === "object" && typeof (g as GoiYPhuong).phuong === "string") goiYPhuong = g as GoiYPhuong;
        if (goiYPhuong && laDongY(dapAn)) { dapAn = goiYPhuong.phuong; nhanGoiYPhuong = true; }
        // FR-209 b: bot hỏi phường mà chủ nhà trả lời bằng ĐỊA CHỈ ("hẻm 12 Lê Văn Việt")
        // → đó là vị trí, không phải phường (bản trước ghi nguyên địa chỉ vào cột phường).
        // Ghi vi_tri, tra phường từ tên đường rồi hỏi xác nhận; câu phường vẫn treo.
        const coPhuongSo = /(?:phường|phuong|(?<![\p{L}])p)\s*\.?\s*\d{1,2}(?!\d)/iu.test(dapAn);
        // 17/09/2026 (Zalo thật): "Nhà trong hẻm 2 xẹc nhưng hẻm rộng 5m…" trả lời câu phường
        // từng ĐÈ địa chỉ "Căn số 14 ở Ny'ah Phú Định" đã có. Địa chỉ đã có thì không ghi
        // lại từ câu lệch; muốn sửa địa chỉ thì nói rõ (FR-164).
        if (!nhanGoiYPhuong && !kqDuyet && !humanActive && !coPhuongSo && !tachTienToPhuong(dapAn) && !pendingReq.listings?.location_raw) {
          const viTriTL = bocViTriRao(dapAn);
          // FR-212: đối chiếu tên đường với từ điển trước khi ghi.
          const duongTL = viTriTL ? await suaTenDuong(viTriTL, pendingReq.listings?.district) : null;
          const viTri = duongTL?.viTri ?? viTriTL;
          if (viTri) {
            const { error: vtErr } = await client.rpc("ghi_fact_listing", {
              p_listing_id: pendingReq.listing_id, p_question: "vi_tri", p_answer: viTri, p_source: "seller_chat",
            });
            if (vtErr) await ghiLoi(client, "chat-reply ghi_fact_listing(vi_tri thay phuong)", vtErr.message);
            // 15/09/2026 (bắn thật C3): "hẻm 5m Cách Mạng Tháng 8, 4x14 nở hậu 5m" trả lời
            // câu phường → chỉ vi_tri được ghi, "4x14" và "nở hậu 5m" rơi mất. Fact khác
            // đi kèm ghi luôn như nhánh khớp ở dưới; vi_tri/phường đã có đường riêng.
            for (const f of nhanDienNhieuFact(dapAn)) {
              if (f.question === "vi_tri" || f.question === "phuong" || f.question === "bo_sung") continue;
              const { error: kErr } = await client.rpc("ghi_fact_listing", {
                p_listing_id: pendingReq.listing_id, p_question: f.question, p_answer: f.answer, p_source: "seller_chat",
              });
              if (kErr) await ghiLoi(client, "chat-reply ghi_fact_listing(kem vi_tri)", kErr.message);
              else await chepSangDuAn(f.question, f.answer);
            }
            const cauDuong = duongTL?.goiY ? await cauHoiDuongGoiY(pendingReq.listing_id, duongTL.goiY, cachGoi) : null;
            const cauGoiY = cauDuong ? null : await cauHoiPhuongGoiY(pendingReq.listing_id, tenDuong(viTri), cachGoi);
            const quanMacDinh = (btRow?.boc_tach as { quan_mac_dinh?: unknown } | null)?.quan_mac_dinh === true || !pendingReq.listings?.district;
            const cauPhuong = cauDuong ?? cauGoiY ?? cauHoiMau(quanMacDinh ? "phuong@chua_quan" : "phuong", cachGoi, pendingReq.listings?.property_type, pendingReq.listings?.district, undefined, viTri);
            return await traLoiSeller([`Dạ em ghi địa chỉ ${viTri} rồi ạ. ${cauPhuong}`], {
              saved_fact: "vi_tri", reask: "phuong", loai_cau: cauGoiY ? "goi_y_phuong" : "hoi_lai",
            });
          }
        }
      }
      // 24/09/2026 (chủ dự án test Zalo, trả lời bằng TRÍCH tin cũ: "đã trả lời rồi này"): câu phàn nàn từng thành "thông tin
      // bổ sung" và bot hỏi lại lần ba. Nay đọc lại ≤ 3 tin gần nhất của chủ nhà, tin nào trả lời được câu đang treo thì
      // lấy làm câu trả lời; không có thì xin lỗi và hỏi lại MỘT câu, không ghi gì vào tin.
      let dapAnTuTinTruoc = false;
      if (laNoiDaTraLoi(dapAn) && !humanActive) {
        const tinTruoc = lichSuRows.filter((m) => laTinNguoi(m.sender)).map((m) => boBaoLai(m.body) ?? "")
          .map((b) => b.replace(/\[ảnh:[^\]]*\]/giu, " ").trim()).filter(Boolean).slice(-3).reverse();
        const cu = tinTruoc.find((b) => !laNoiDaTraLoi(b) && phanLoaiCauTraLoi(pendingReq.question, b).loai === "khop");
        if (cu) {
          dapAn = cu;
          dapAnTuTinTruoc = true;
        } else {
          return await traLoiSeller(
            [`Dạ em xin lỗi ${cachGoi}, em đọc lại mà chưa thấy ${NHAN_HOI_LAI[pendingReq.question] ?? FACT_LABELS[pendingReq.question] ?? "câu đó"}. ${CachGoi} nhắn lại giúp em một chút nha.`],
            { reask: pendingReq.question, loai_cau: "da_tra_loi" },
          );
        }
      }
      // 24/09/2026 (chủ dự án test Zalo: "sao nó ko biết và tự nhân 5x16 vậy, nó dài 16 mà đưa vào thông tin bổ sung à"):
      // đang hỏi diện tích, lượt trước đã nói "ngang 5m" → "dài 16m" trần là chiều còn lại, không phải câu lệch.
      {
        const ghep = ghepMotChieu(pendingReq.question, dapAn, pendingReq.listings?.frontage_m, pendingReq.listings?.length_m);
        if (ghep) dapAn = ghep;
      }
      // 24/09/2026 (chủ dự án: "137/28 nghĩa là đường số 59 hẻm 137 và nhà số 28"): tin đã có tên đường mà chưa có số,
      // chủ nhắn số nhà có gạch chéo ở đầu câu → ghép "137/28 Đường số 59" vào địa chỉ; phần còn lại mới là câu trả lời
      // câu đang treo (bản trước: đang hỏi diện tích, "137/28" thành "137m2").
      // Fact số nhà ghép TRONG lượt này không phải "lượt trước chủ né câu hỏi" (đếm `daNe` bên dưới) — từng làm câu diện
      // tích hết hạn ngay lần hỏi đầu (bắn lại 24/09 k1-ban-gv2). Đánh dấu bằng cờ, không so giờ (giờ edge ≠ giờ DB).
      let ghiSoNhaLuot = false;
      {
        const sn = pendingReq.question !== "vi_tri" ? soNhaDau(dapAn) : null;
        const lr = (pendingReq.listings?.location_raw ?? "").trim();
        if (sn && lr && !/^\d/.test(lr) && !/\d\/\d/.test(lr)) {
          const { error: snErr } = await client.rpc("ghi_fact_listing", {
            p_listing_id: pendingReq.listing_id, p_question: "vi_tri", p_answer: `${sn.soNha} ${lr}`, p_source: "seller_chat",
          });
          if (snErr) await ghiLoi(client, "chat-reply ghi_fact_listing(so nha)", snErr.message);
          else {
            ghiSoNhaLuot = true;
            if (sn.conLai) dapAn = sn.conLai;
          }
        }
      }
      let kq: KetQuaKhop = pendingReq.question === "loai_bds"
        ? { loai: "khop" }
        : kqDuyet ?? phanLoaiCauTraLoi(pendingReq.question, dapAn);
      // 20/09/2026 (bắn thật mau-y-D): "à sửa lại, dài 16 chứ không phải 15" là LỜI SỬA kích thước —
      // đang hỏi giá thì vào bổ sung, đang hỏi kết cấu thì bị nhận là kết cấu (có số). Xử TRƯỚC mọi
      // luật: ghi ô ngang/dài (fact `mat_tien` đủ hai chiều, ngang lấy từ tin nếu câu không nói — DB
      // đọc "dài 16m" trần sẽ lấy 16 làm ngang), rồi coi câu là LỆCH để câu treo giữ nguyên.
      let suaKtDaGhi = false;
      {
        const sua = gonLoiSua(dapAn);
        if (sua.laSua && (sua.ngang || sua.dai) && !kqDuyet && !/^dien_tich/.test(pendingReq.question) && pendingReq.question !== "mat_tien") {
          const { data: kt } = await client.from("listings").select("frontage_m, length_m").eq("id", pendingReq.listing_id).maybeSingle();
          const cu = kt as { frontage_m?: number | string | null; length_m?: number | string | null } | null;
          const ngang = sua.ngang ?? (cu?.frontage_m != null ? String(cu.frontage_m) : null);
          const dai = sua.dai ?? (cu?.length_m != null ? String(cu.length_m) : null);
          const dapKt = ngang && dai ? `ngang ${ngang}m dài ${dai}m` : ngang ? `${ngang}m` : null;
          if (dapKt) {
            const { error: ktErr } = await client.rpc("ghi_fact_listing", {
              p_listing_id: pendingReq.listing_id, p_question: "mat_tien", p_answer: dapKt, p_source: "seller_chat",
            });
            if (ktErr) await ghiLoi(client, "chat-reply ghi_fact_listing(sua kich thuoc)", ktErr.message);
            else { suaKtDaGhi = true; kq = { loai: "lech" }; }
          }
        }
      }
      // 17/09/2026 (chủ dự án: "đừng tách AI và luật xa nhau, AI đọc trước và trả kiến thức cho luật
      // lưu"): chế độ `ghi` — AI (đã chạy song song, qua kiểm bằng chứng + khoảng) đọc ra giá trị cho
      // ĐÚNG câu bot đang hỏi → luật lấy giá trị đó ghi ("shr, nhà ở từ 2019" → pháp lý "sổ hồng
      // riêng"). Luật đang khớp với mảnh ngắn, sạch thì giữ của luật; câu có đường riêng (phường,
      // vị trí, loại, ảnh, duyệt, chấm điểm, chọn căn) không đụng. Fact luật nhận ra lệch ô vẫn ghi.
      // 21/09/2026 (chủ dự án: "đảo tầng: AI đọc là đường chính có kiểm bằng chứng"): chế độ `chinh` —
      // CHỜ lượt AI (đã chạy song song) TRƯỚC khi luật quyết. AI đọc ra giá trị cho câu đang hỏi → lấy
      // của AI, bất kể luật nói khớp/lệch/ừ (trừ hoãn, xưng hô). AI chạy xong mà KHÔNG thấy bằng chứng
      // cho khoá đang hỏi trong khi luật nói "khớp" → coi là LỆCH ("có làm hợp đồng phân phối không"
      // từng thành pháp lý). Fact kèm do AI quyết (`factKem`): luật chỉ còn đỡ khoá AI không có chỗ nói.
      // Model hỏng / trả rỗng → `aiChinh` null → toàn bộ đường luật y như cũ.
      // 24/09/2026 (chủ dự án test Zalo): "4x14, trệt 1 lầu" khi hỏi diện tích — AI chỉ trả diện tích, luật đọc được
      // "trệt 1 lầu" nhưng kết cấu là khoá AI nói → rơi mất, bot hỏi lại "mấy tầng". Kết cấu dạng CHẮC (trệt…, N tầng/
      // N lầu/N tấm) mà câu không có chữ giả định ("được xây", "xây thêm", "tối đa", "cách … là nhà") thì luật nói thay.
      const ketCauChac = (f: { question: string; answer: string }, cau: string) => f.question === "ket_cau" &&
        /^(?:nh[aà]\s+)?(?:h[ầa]m\s*\+?\s*)?(?:tr[ệe]t\b|\d{1,2}\s*(?:t[ầa]ng|l[ầa]u|t[ấa]m)\b)/iu.test(f.answer.trim()) &&
        !/\b(?:duoc xay|xay duoc|xay them|dinh xay|se xay|toi da|cho phep|quy hoach|cach|ben canh|ke ben|hang xom)\b/.test(boDau(cau));
      // 24/09/2026 (chủ dự án test Zalo): "ngang 5m daifm shr, hxh quay đầu" — AI bỏ sót "shr", pháp lý là khoá AI nói → rơi.
      // "shr / sổ hồng riêng / sổ riêng" không mơ hồ; câu không có "chưa / đang làm / chờ / chung" thì luật nói thay.
      const phapLyChac = (f: { question: string; answer: string }) => f.question === "phap_ly" &&
        /\b(?:shr|so hong rieng|so rieng)\b/.test(boDau(f.answer)) && !/\b(?:chua|dang lam|cho|khong|ko|chung)\b/.test(boDau(f.answer));
      // FR-223 (bắn thật 24/09, rn-test-c): "chưa có sổ em, đang chờ ra sổ" khi đang hỏi pháp lý — AI im, luật "AI im = lệch"
      // gạt vào bổ sung, câu pháp lý treo mãi và nhánh "chưa sổ → hỏi bao giờ ra sổ" không chạy. Cụm CHƯA SỔ rõ ràng là câu trả
      // lời pháp lý chắc (giữ nguyên chữ khách, KHÔNG đổi thành "sổ hồng riêng" — F2).
      const phapLyChuaSo = (f: { question: string; answer: string }) => f.question === "phap_ly" &&
        /\b(?:chua co so|chua ra so|cho so|cho ra so|dang lam so|hdmb|hop dong mua ban|vi bang|giay tay)\b/.test(boDau(f.answer));
      // 24/09/2026 (chủ dự án: "sao nó hỏi lại vậy … nếu trường hợp tương tự nó hiểu ko"): "4 tầng, 4 phòng ngủ nhé" khi đang
      // hỏi kết cấu — AI chỉ trả phòng ngủ, im về kết cấu → luật "AI im = lệch" gạt mất "4 tầng", vào bổ sung, bot hỏi lại.
      // Luật đọc CHẮC cho đúng câu đang hỏi (kết cấu dạng chắc, "shr") thì AI im không gạt được — cho mọi khoá có luật chắc.
      const luatChacCauTreo = (q: string, s: string) =>
        nhanDienNhieuFact(s).some((f) => f.question === q && (ketCauChac(f, s) || phapLyChac(f) || phapLyChuaSo(f))) ||
        (q === "phap_ly" && phapLyChuaSo({ question: q, answer: s })) ||
        // FR-223 (bắn thật 24/09, rn-test-h): hỏi tiền thuê, khách đáp "150 triệu một tháng" — AI xếp vào gia hoặc im → câu rơi
        // bổ sung. Số tiền đơn vị triệu trả lời câu tiền thuê là chắc.
        (q === "doanh_thu" && /\d+(?:[.,]\d+)?\s*(?:trieu|tr)\b/.test(boDau(s)));
      let aiChinh: (AiChinh & { kienThuc: string[] }) | null = null;
      const cheDoAiTreo = bongAi && cheDoBocAi ? await cheDoBocAi : "tat";
      // Câu có đường riêng (`CAU_KHONG_LAY_AI`: phường, vị trí, ảnh…): AI không quyết GIÁ TRỊ câu treo,
      // nhưng ở chế độ `chinh` vẫn quyết FACT KÈM (bắn thật 21/09 mau-v-03: trả lời câu phường bằng
      // "ngang 5 dài 20, hẻm xe hơi" → luật ghi độ rộng hẻm = "hẻm xe hơi").
      const layChoCauTreo = !CAU_KHONG_LAY_AI.has(pendingReq.question) || (cheDoAiTreo === "chinh" && CAU_AI_DOC_TRUOC_LUAT_DO.has(pendingReq.question));
      if (!suaKtDaGhi && bongAi && !kqDuyet && ((cheDoAiTreo === "ghi" && layChoCauTreo) || cheDoAiTreo === "chinh")) {
        const kqAi = await bongAi;
        const dongTreo = (pendingReq.listings ?? null) as unknown as DongDb | null;
        const datAi = kqAi ? kiemDeXuat(kqAi.truong, text).dat : [];
        const dapAnAi0 = kqAi && layChoCauTreo ? giaTriChoCauTreo(datAi, pendingReq.question, dongTreo) : null;
        // 22/09/2026: câu treo VỊ TRÍ — bản luật chứa bản AI mà dài hơn (có số nhà / hẻm) thì lấy luật.
        const dapAnAi = pendingReq.question === "vi_tri" && dapAnAi0 ? chonViTri(bocViTriRao(dapAn), dapAnAi0) : dapAnAi0;
        if (cheDoAiTreo === "chinh" && kqAi?.ket) {
          aiChinh = { ...docAiChinh(datAi, dongTreo), kienThuc: kiemKienThuc(kqAi.kienThuc ?? [], text, datAi) };
        }
        const aiThang = !!dapAnAi && (aiChinh
          ? kq.loai !== "hoan" && kq.loai !== "xung_ho"
          : (kq.loai === "lech" || kq.loai === "ack" || (kq.loai === "khop" && (dapAn.length > 40 || /[,;]/.test(dapAn)))));
        if (aiThang) {
          if (!aiChinh && kq.chuyenSang && kq.chuyenSang.question !== pendingReq.question) {
            const { error: csErr } = await client.rpc("ghi_fact_listing", {
              p_listing_id: pendingReq.listing_id, p_question: kq.chuyenSang.question, p_answer: kq.chuyenSang.answer, p_source: "seller_chat",
            });
            if (csErr) await ghiLoi(client, "chat-reply ghi_fact_listing(kem ai truoc)", csErr.message);
          }
          const hoiKem = kq.hoiNguoc ?? (kq.loai === "hoi" ? dapAn : undefined);
          kq = { loai: "khop", ...(hoiKem ? { hoiNguoc: hoiKem } : {}) };
          loaiDapAn = dapAnAi;
        } else if (aiChinh && layChoCauTreo && !CAU_AI_DOC_TRUOC_LUAT_DO.has(pendingReq.question) && kq.loai === "khop" && KHOA_FACT_AI_BIET.has(pendingReq.question) &&
          !dapAnTuTinTruoc && !luatChacCauTreo(pendingReq.question, dapAn)) {
          kq = { loai: "lech" };
        }
        if (aiChinh && kq.loai === "lech") {
          // Luật nhận "một nẻo" ra khoá X mà AI không thấy X → thay bằng fact AI đọc được (nếu có);
          // không có gì thì bỏ `chuyenSang` để rơi về ghi nguyên văn (`bo_sung`), câu vẫn treo.
          const kem = aiChinh.ghi.filter((g) => g.question !== pendingReq.question);
          // Giữ NGUYÊN tham chiếu phần tử của `aiChinh.ghi` để chỗ ghi biết nguồn là ai_kiem.
          if (kq.chuyenSang && !kem.some((f) => f.question === kq.chuyenSang!.question)) {
            kq = { ...kq, chuyenSang: kem[0] };
          } else if (!kq.chuyenSang && kem[0]) kq = { ...kq, chuyenSang: kem[0] };
        }
      }
      /** Fact KÈM trong câu trả lời: chế độ `chinh` (AI đã chạy) → AI quyết, luật chỉ đỡ khoá AI không biết. */
      // 22/09/2026 (bắn thật căn hộ): "sổ hồng riêng, full nội thất, có thang máy, view sông" — AI xếp "sổ hồng
      // riêng" vào KIẾN THỨC THÊM (thành bo_sung lúc ra) chứ không phải `phap_ly`, nên câu kế hỏi lại pháp lý.
      // AI KHÔNG NÓI ≠ AI PHỦ ĐỊNH: khoá AI biết mà AI không trả, và chính chữ đó nằm trong kiến thức thêm
      // của AI (AI thấy nhưng không xếp ô) thì luật xếp. AI có trả khoá đó thì AI vẫn thắng như FR-208 f.
      const aiKienThuc = (aiChinh?.kienThuc ?? []).map((k) => boDau(k));
      // 22/09/2026 (kịch bản D): "nở hậu 4m5", "đang thế chấp", "cho thuê 30 triệu/tháng" — AI không trả khoá, cũng
      // không xếp vào kiến thức thêm → rơi. Khoá có BẰNG CHỨNG rõ trong chữ khách (số đo / cụm chữ đặc thù) mà AI
      // im thì luật ghi; AI có trả khoá đó thì AI vẫn thắng.
      const KHOA_LUAT_DO_KHI_AI_IM = new Set(["no_hau", "doanh_thu", "so_wc", "cach_mat_tien", "nam_xay", "the_chap", "thang_may", "dien_tich_san"]);
      const factKem = (s: string): Array<{ question: string; answer: string }> => aiChinh
        ? [...aiChinh.ghi, ...nhanDienNhieuFact(s).filter((f) => f.question !== "bo_sung" && (
            !KHOA_FACT_AI_BIET.has(f.question) ||
            (!aiChinh!.ghi.some((g) => g.question === f.question) &&
              (aiKienThuc.some((k) => k.includes(boDau(f.answer)) || boDau(f.answer).includes(k)) ||
                KHOA_LUAT_DO_KHI_AI_IM.has(f.question) || ketCauChac(f, s) || phapLyChac(f) || phapLyChuaSo(f)))))
            .map((f) => phapLyChac(f) ? { question: "phap_ly", answer: "sổ hồng riêng" } : f)]
        : nhanDienNhieuFact(s);
      // 15/09/2026 (Zalo thật): vừa trả lời vừa HỎI NGƯỢC → ghi PHẦN trả lời, câu hỏi
      // của chủ nhà được trả lời TRƯỚC câu kế (không nuốt, không ghi cả câu vào ô).
      // 15/09/2026 (bắn thật A5): cả tin là MỘT câu hỏi ("bên bạn có cần mình gửi hình
      // không hay sao") → là hỏi ngược, KHÔNG phải "thông tin bổ sung" để ghi vào tin.
      const hoiNguoc = kq.hoiNguoc ?? ((kq.loai === "hoi" || (kq.loai === "lech" && !kq.chuyenSang && laCauHoiTron(dapAn))) ? dapAn : null);
      if (kq.dapAn) dapAn = kq.dapAn;
      // 15/09/2026 (bắn thật F2): câu hỏi về ẢNH có đáp án của hệ thống → bong bóng tiền
      // định đứng trước, model chỉ hỏi tiếp (model từng bỏ qua lời dặn trả lời trước).
      const hoiNguocDap = hoiNguoc
        ? dapHoiNguocTienDinh(hoiNguoc, cachGoi, phiCauSeller)
        : laXinXoaDuLieu(dapAn) && !nhanDienFact(dapAn)
        ? "Dạ việc xoá dữ liệu em không tự làm được, để em nhờ anh chị phụ trách xử lý ạ."
        : null;
      const hoiNguocPrompt = hoiNguoc
        ? hoiNguocDap
          ? `Chủ nhà còn HỎI NGƯỢC: "${hoiNguoc}" — hệ thống ĐÃ trả lời câu đó ở bong bóng trước ("${hoiNguocDap}"); em KHÔNG trả lời lại, không nhắc lại chuyện ảnh, chỉ ghi nhận rồi hỏi tiếp. `
          : `Chủ nhà còn HỎI NGƯỢC: "${hoiNguoc}". TRẢ LỜI câu đó TRƯỚC bằng 1–2 câu ngắn, CHỈ từ thông tin dự án/khu vực đã có ở trên; hỏi về cách làm việc (gửi ảnh, phí, đăng tin) thì trả lời theo hướng dẫn hệ thống; chưa nắm thì nói "em kiểm tra rồi báo lại" — KHÔNG bịa tiện ích, trường, chợ, giá. Rồi mới hỏi tiếp. `
        : "";
      // Chủ nhà CHẤM ĐIỂM cách chăm sóc (09/09/2026) → ghi fact + boc_tach, cảm
      // ơn ngắn, KHÔNG hỏi lại điểm, không gọi model. Câu hỏi ngược/ừ thì đường
      // hỏi lại chung ở dưới lo.
      // 22/09/2026: câu HỎI ("có khách nào hỏi chưa em") không phải điểm — `hoiVeTin` đã đỡ ở trên, đây chặn nốt.
      if (pendingReq.question === "danh_gia" && kq.loai === "khop" && !laCauHoiTron(dapAn) && !hoiVeTin(dapAn)) {
        const { error: dgErr } = await client.rpc("ghi_fact_listing", {
          p_listing_id: pendingReq.listing_id, p_question: "danh_gia",
          p_answer: dapAn, p_source: "seller_chat",
        });
        if (dgErr) await ghiLoi(client, "chat-reply ghi_fact_listing(danh gia)", dgErr.message);
        await client.from("info_requests").update({
          status: "answered", answer: dapAn, answered_at: new Date().toISOString(),
        }).eq("id", pendingReq.id);
        const diemM = /(?:^|[^\d])(10|[0-9])\s*(?:\/\s*10|diem|d\b|\/10)/.exec(boDau(dapAn));
        const themXoa = laXinXoaDuLieu(dapAn) ? `\nViệc xoá tin em không tự làm được, để em nhờ anh Thu xử lý giúp ${cachGoi} ạ.` : "";
        const camOn = (diemM
          ? `Dạ em cảm ơn ${cachGoi} đã chấm em ${diemM[1]} điểm ạ.\nCó khách quan tâm là em báo ${cachGoi} liền.`
          : `Dạ em cảm ơn ${cachGoi} đã góp ý ạ, em sẽ cố gắng hơn.\nCó khách quan tâm là em báo ${cachGoi} liền.`) + themXoa;
        return await traLoiSeller([camOn], { saved_fact: "danh_gia", danh_gia: dapAn });
      }
      // 09/09 tối (chạy kịch bản lần 2): câu "địa chỉ cụ thể" treo MÃI — chủ nhà
      // cứ trả lời thứ khác (đều ghi đúng ô), bot cứ hỏi lại địa chỉ mỗi lượt,
      // không bao giờ tới bản nháp. Luật: câu hỏi bị NÉ 2 lần (2 fact khác đã
      // ghi từ lúc mở câu) hoặc chủ "ok/được/đăng đi" mà tin đã đủ điểm → THÔI
      // câu đó (expired), đi tiếp câu kế; vòng hỏi bù sẽ hỏi lại sau.
      let boQuaCauTreo = false;
      // "ok / được / đăng đi" khi đang treo một câu thông số → chủ muốn ĐĂNG.
      // "ừ / dạ / vâng" trơ trọi chỉ là ừ (ack), KHÔNG phải muốn đăng (lần 3: "ừ"
      // làm hết hạn câu hẻm rồi đòi đăng tin 51 điểm).
      const kdDang = boDau(dapAn).replace(/[^a-z0-9\s]/g, " ").trim();
      const chuMuonDang = pendingReq.question !== "duyet_tin" && pendingReq.question !== "loai_bds" &&
        pendingReq.question !== "danh_gia" && pendingReq.question !== "hinh_anh" &&
        (kdDang.split(/\s+/).length <= 6 &&
          (laDuRoi(dapAn) || /\b(dang|len tin|len ke|post)\b/.test(kdDang) ||
            (laDongY(dapAn) && /\b(ok|oke|okie|duoc|dc|chot|dong y|xong)\b/.test(kdDang))) ||
          // 23/09/2026 (bắn thật căn hộ): "được giá thì bán em, ok đăng tin đi em" (9 chữ) — câu dài mà có lời
          // bảo ĐĂNG rõ ràng thì vẫn là muốn đăng; trước chỉ nhận câu ≤ 6 chữ nên cả câu thành "thông tin bổ sung".
          // 24/09/2026 (chủ dự án test Zalo): "…cần thông tin gì nữa không nếu không thì đăng bài đi" — "đăng bài" không
          // có trong danh sách nên cả câu thành câu trả lời hạn hợp đồng thuê, bot hỏi tiếp 3 câu.
          (/\b(?:dang tin|dang di|dang len|dang luon|dang bai|len tin|len ke|post tin|post bai|up tin|up bai)\b/.test(kdDang) &&
            !/\b(?:chua|khoan|dung|dung vo|khong|ko|dung co)\s+(?:dang|len)\b/.test(kdDang)));
      // FR-188 b (10/09): câu MỀM (gấp, lý do bán, thương lượng, tiềm năng) chỉ hỏi
      // MỘT lần — chủ dự án: "không hỏi lần thứ hai". Luật né-2-lần bên dưới đếm fact
      // ghi được sau khi mở câu, nên lần 7 đại diện CĐT bị hỏi "cần bán gấp không" ba
      // lượt liền (mỗi lượt chỉ ghi được một fact). Vòng hỏi bù hôm sau vẫn hỏi lại.
      // 20/09/2026 (bắn thật mau-y-B): "tối chị chụp ảnh gửi nhé, giờ đang bận" khi câu treo là GẤP
      // (câu mềm hỏi một lần) → câu bị hết hạn ở dưới rồi nhánh hoãn không tới lượt, bot hỏi tiếp thời
      // hạn thuê. Hoãn đứng TRƯỚC mọi luật hết hạn: đáp một câu, không hỏi thêm, câu vẫn treo.
      if (kq.loai === "hoan" && !humanActive) {
        const goi = goiNguoi ?? kq.xungHo ?? "mình";
        const phien = /bận|mệt|hỏi (?:gì )?(?:hoài|lắm|nhiều|mãi)/i.test(text);
        const hua = khop(PROMISE_RE, PROMISE_RE_KD);
        const cauHoan = hua
          ? `Dạ em chờ ${goi} nha, lúc nào ${goi} rảnh gửi em là em cập nhật liền ạ.`
          : phien
          ? `Dạ em xin lỗi, em hỏi dồn quá. Lúc nào ${goi} rảnh nhắn em là em làm tiếp liền nha.`
          : `Dạ ${goi} cứ thong thả nha. Có gì ${goi} nhắn em là em làm tiếp liền.`;
        return await traLoiSeller([cauHoan], { hoan: true, loai_cau: "hoan", ...(hua ? { hua: true } : {}) });
      }
      if (!boQuaCauTreo && kq.loai !== "khop" && HOI_MOT_LAN.has(pendingReq.question)) {
        const { error: mlErr } = await client.from("info_requests").update({ status: "expired" }).eq("id", pendingReq.id);
        if (mlErr) await ghiLoi(client, "chat-reply cau mem hoi mot lan", mlErr.message);
        boQuaCauTreo = true;
      }
      // 24/09/2026 (chủ dự án test Zalo): "6 tỷ 3 đăng đi" khi đang hỏi GIÁ — câu vừa TRẢ LỜI vừa bảo đăng. Bản
      // trước coi cả câu là "muốn đăng", bỏ qua câu treo → giá không đóng câu hỏi, bot nói "chỉ cần thêm…" rồi HỎI
      // LẠI GIÁ. Bỏ vỏ "đăng đi" mà phần còn lại khớp câu đang hỏi → ghi như câu trả lời, đóng câu, hỏi câu KẾ.
      const dapAnBoDang = dapAn.replace(/[\s,.]*(?:(?:ok|oke|okie|được|dc|rồi|thì)\s+)*(?:đăng|dang|lên|len|post|up)\s*(?:tin|bài|bai|đi|di|luôn|luon|kệ|ke|lên|len)?(?:\s+(?:đi|di|luôn|luon|em|e|nha|nhé|nhe|ạ|a|giúp|giùm|anh|chị|chi))*\s*[.!]*\s*$/iu, "").trim();
      // Phần còn lại là câu hỏi / điều kiện ("cần thông tin gì nữa không, nếu không thì") → không phải câu trả lời.
      const conLaHoi = /\?|\b(?:can|con)\s+(?:them\s+)?(?:thong tin\s+)?gi\s+nua\b|\b(?:neu\s+)?(?:khong|ko|k)\s+thi\s*$/.test(boDau(dapAnBoDang));
      const traLoiKemDang = chuMuonDang && dapAnBoDang.length >= 2 && dapAnBoDang !== dapAn.trim() && !conLaHoi &&
        phanLoaiCauTraLoi(pendingReq.question, dapAnBoDang).loai === "khop";
      if (traLoiKemDang) dapAn = dapAnBoDang;
      if (chuMuonDang && !traLoiKemDang) {
        // Chỉ bỏ câu treo khi tin ĐỦ điểm để gửi nháp; chưa đủ thì câu treo giữ nguyên
        // và nói rõ còn thiếu gì (xử ở dưới, sau khi đọc trạng thái tin).
        boQuaCauTreo = true;
      }
      if (!boQuaCauTreo && kq.loai !== "khop" && pendingReq.question !== "duyet_tin" && pendingReq.question !== "loai_bds" &&
          pendingReq.question !== "danh_gia" && (kq.chuyenSang || kq.loai === "ack")) {
        let neQ = client.from("listing_facts")
          .select("id", { count: "exact", head: true })
          .eq("listing_id", pendingReq.listing_id)
          .neq("question", pendingReq.question)
          // FR-211: fact `nhan` do ganNhanChoTin ghi ở ĐƯỜNG RA của lượt trước (sau khi câu chờ
          // đã mở) — không phải khách né câu hỏi, đếm vào là hết hạn câu ngay lượt sau (e2e H3).
          .neq("question", "nhan")
          .gt("created_at", pendingReq.created_at ?? new Date(0).toISOString());
        if (ghiSoNhaLuot) neQ = neQ.neq("question", "vi_tri");
        const { count: daNe } = await neQ;
        const gat = kq.loai === "ack" && laDongY(dapAn);
        // 16/09/2026 (chủ dự án, sau khi câu phường bị hỏi 4 lượt liền ở mau-co-thue): một câu
        // hỏi TỐI ĐA 2 LẦN trong chat — hỏi, khách nói thứ khác, hỏi lại một lần, vẫn thứ khác
        // thì thôi, để vòng hỏi bù (ask-seller) hỏi hôm sau. Trước là né 2 lần (hỏi 3 lượt).
        if ((kq.chuyenSang && (daNe ?? 0) >= 1) || gat) {
          const { error: neErr } = await client.from("info_requests").update({ status: "expired" }).eq("id", pendingReq.id);
          if (neErr) await ghiLoi(client, "chat-reply bo qua cau treo", neErr.message);
          boQuaCauTreo = true;
        }
      }
      await capNhatQuan(pendingReq.listing_id);
      if (pendingReq.question === "phuong" && (nhanGoiYPhuong || kq.loai === "khop")) {
        const chuan = await capNhatQuanTuPhuong(pendingReq.listing_id, nhanGoiYPhuong ? goiYPhuong : null, dapAn);
        if (chuan) dapAn = chuan;
      }
      if (kq.loai !== "khop" && !boQuaCauTreo) {
        // 11/09/2026 (42 ca): bận / để hỏi vợ / hỏi hoài → dừng THẬT: không ghi,
        // không hỏi, câu vẫn treo cho vòng hỏi bù sau. Câu tiền định, không model —
        // đường model bị dặn "câu hỏi cuối tin BẮT BUỘC" nên cứ hỏi tiếp (38 từ).
        if (kq.loai === "hoan" && !humanActive) {
          const goi = goiNguoi ?? kq.xungHo ?? "mình";
          const phien = /bận|mệt|hỏi (?:gì )?(?:hoài|lắm|nhiều|mãi)/i.test(text);
          const cauHoan = phien
            ? `Dạ em xin lỗi, em hỏi dồn quá. Lúc nào ${goi} rảnh nhắn em là em làm tiếp liền nha.`
            : `Dạ ${goi} cứ thong thả nha. Có gì ${goi} nhắn em là em làm tiếp liền.`;
          return await traLoiSeller([cauHoan], { hoan: true, loai_cau: "hoan" });
        }
        // 11/09/2026 (42 ca): một con số trần kèm mét ("4m") khi đang hỏi ĐỊA CHỈ /
        // PHƯỜNG — không biết là hẻm hay ngang. Bản trước ghi "4m" vào thông tin bổ
        // sung rồi model báo "em ghi nhận hẻm 4m rồi" (không cột nào mang giá trị
        // đó). Hỏi lại cho rõ; không ghi, không đoán. Câu khác (hướng, pháp lý…) giữ
        // đường hỏi lại cũ — "16m nha" khi hỏi hướng vẫn là câu lệch (e2e G3).
        const soTran = /^\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:m|mét|met)\s*(?:nha|nhe|nhé|ạ|a|em)?\s*[.!]?\s*$/i.exec(text);
        if (kq.loai === "lech" && !kq.chuyenSang && soTran && !humanActive &&
            (pendingReq.question === "vi_tri" || pendingReq.question === "phuong")) {
          return await traLoiSeller(
            [`${soTran[1]}m là hẻm trước nhà hay ngang mặt tiền vậy ${goiNguoi ?? "ạ"}?`],
            { reask: pendingReq.question, loai_cau: "so_tran" },
          );
        }
        // "Ngang 5" khi đang hỏi diện tích: vẫn là dữ liệu thật — ghi đúng
        // fact (mặt tiền) chứ không vứt, còn câu diện tích thì giữ treo.
        // 22/09/2026 (bắn lại kịch bản D, chế độ `chinh`): đang hỏi GIÁ, chủ nhà nói "đang cho thuê 30 triệu/tháng, đang
        // thế chấp, nở hậu 4m5" — AI không trả khoá nào → `chuyenSang` trống → cả câu rơi về bo_sung dù luật đọc được
        // ba fact có bằng chứng rõ (`KHOA_LUAT_DO_KHI_AI_IM` trong `factKem`). Lệch mà AI im thì vẫn hỏi luật.
        const kemLech = !kq.chuyenSang && aiChinh && kq.loai === "lech"
          ? factKem(dapAn).filter((f) => f.question !== pendingReq.question && f.question !== "bo_sung")
          : [];
        if (kq.chuyenSang || kemLech.length) {
          // Câu lệch mang NHIỀU fact ("Đường 12m, hướng Bắc") thì ghi hết, không
          // chỉ fact đầu (09/09 tối). Fact trùng khoá đang hỏi thì để đường khớp lo.
          const cacFact = (kq.chuyenSang
            ? [kq.chuyenSang, ...factKem(dapAn).filter((f) => f.question !== kq.chuyenSang!.question)]
            : kemLech).filter((f) => f.question !== pendingReq.question);
          for (const f of cacFact) {
            const { error: csErr } = await client.rpc("ghi_fact_listing", {
              p_listing_id: pendingReq.listing_id, p_question: f.question,
              p_answer: f.answer, p_source: aiChinh?.ghi.some((g) => g === f) ? NGUON_AI : "seller_chat",
            });
            if (csErr) await ghiLoi(client, "chat-reply ghi_fact_listing(chuyen sang)", csErr.message);
            // FR-195: nhánh TRẢ LỜI LỆCH cũng phải chép sang kho dự án. Bắt 10/09:
            // chủ nhà đang được hỏi phường mà kể phí quản lý — fact vào tin đúng,
            // nhưng hàng chờ duyệt trống vì chỗ này chưa nối dây.
            else await chepSangDuAn(f.question, f.answer);
          }
        } else if (kq.loai === "lech" && pendingReq.question !== "duyet_tin" && hoiNguoc !== dapAn) {
          // FR-177 e: không nhận ra fact nào thì VẪN ghi nguyên văn (`bo_sung`)
          // — chủ dự án 07/09: "hỏi một đường trả lời một nẻo thì vẫn phải ghi
          // nhận câu trả lời của khách". Câu hỏi gốc vẫn treo. Cả tin là câu hỏi
          // (`hoiNguoc === dapAn`) thì không ghi — đó là câu để TRẢ LỜI.
          // 20/09/2026 (bắn thật mau-y-D): "à sửa lại, dài 16 chứ không phải 15" là LỜI SỬA kích
          // thước — vào ô ngang/dài (fact `mat_tien`, DB đọc "ngang 4m dài 16m"), không vào bổ sung;
          // lời sửa khác không nhận ra thì ghi phần dữ liệu đã bỏ vỏ "sửa lại … chứ không phải".
          const sua = gonLoiSua(dapAn);
          let ghiBoSung: string | null = dapAn;
          if (suaKtDaGhi) ghiBoSung = null;
          else if (sua.laSua) ghiBoSung = sua.con.length >= 2 ? sua.con : null;
          // 21/09/2026 ("làm cả 4"): tin CHỈ có emoji/dấu ("😂😂", "👍👍") không phải thông tin căn nhà; lời nói
          // với bot ("xóa hết dữ liệu của anh đi", "cái câu này đọc kỳ") cũng không — không ghi `bo_sung`.
          else if (!/[\p{L}\p{N}]/u.test(dapAn)) ghiBoSung = null;
          else if (laNoiVoiBot(dapAn) && !nhanDienFact(dapAn)) ghiBoSung = null;
          // 22/09/2026 (kịch bản E): "tui là sale nha, ko phải chủ" là tự giới thiệu, không phải dữ liệu căn;
          // câu có SĐT thì không bao giờ vào bo_sung (§5 — bo_sung ra tin, tin ra web).
          else if (/\b(?:tui|toi|minh|em|e|anh|chi)\s+la\s+(?:sale|moi gioi|mg|chu|chinh chu|ccrb|nmg)\b|\b(?:ko|khong|k)\s+phai\s+(?:chu|chinh chu)\b/.test(boDau(dapAn)) && !nhanDienFact(dapAn)) ghiBoSung = null;
          else if (coSdt(dapAn)) ghiBoSung = null;
          // 24/09/2026 (tin thật: hỏi phường, khách đáp "Quận 1 em ơi"): còn < 2 chữ hoặc chỉ là tên quận / phường → rác.
          else if (laBoSungRac(dapAn)) ghiBoSung = null;
          // Chế độ `chinh`: AI đã đọc ra kiến thức từ câu này → đường ra ghi `bo_sung` nguồn ai_kiem
          // (`ghiBongBocTach`), không ghi nguyên văn lần hai. AI không đọc ra gì → nguyên văn như cũ.
          else if (aiChinh && aiChinh.kienThuc.length) ghiBoSung = null;
          if (ghiBoSung) {
            const { error: bsErr } = await client.rpc("ghi_fact_listing", {
              p_listing_id: pendingReq.listing_id, p_question: "bo_sung",
              p_answer: ghiBoSung, p_source: "seller_chat",
            });
            if (bsErr) await ghiLoi(client, "chat-reply ghi_fact_listing(bo sung)", bsErr.message);
          }
        }
        if (humanActive) {
          return await traLoiSeller([], { reask: pendingReq.question, loai_cau: kq.loai });
        }
        // 13/09/2026 (bắn thật): đất Củ Chi câu đầu hỏi xã, câu hỏi LẠI vẫn "phường
        // nào" — nhãn ở đây đọc thẳng bảng chung, không biết tin ở huyện.
        const xaThayPhuong = pendingReq.question === "phuong" && laNgoaiDoThi(pendingReq.listings?.district);
        const nhanDangHoi = xaThayPhuong ? "xã" : FACT_LABELS[pendingReq.question] ?? pendingReq.question;
        const nhanHoiLai = xaThayPhuong ? "chỗ mình thuộc xã nào" : NHAN_HOI_LAI[pendingReq.question] ?? nhanDangHoi;
        const viSao = kq.loai === "xung_ho"
          ? `Chủ nhà dặn gọi họ là "${kq.xungHo}": nhận bằng một câu thật ngắn, từ nay gọi đúng vậy.`
          : kq.loai === "hoi"
          ? `Chủ nhà đang HỎI NGƯỢC: trả lời thẳng câu đó trước (phí thì theo luật phí; điều chưa nắm thì "để em kiểm tra rồi báo lại").`
          : kq.loai === "ack"
          ? `Chủ nhà chỉ ừ/ok, chưa trả lời.`
          : kq.chuyenSang
          ? `Câu đó là ${FACT_LABELS[kq.chuyenSang.question] ?? kq.chuyenSang.question} (em đã ghi ${kq.chuyenSang.answer}), chưa phải ${nhanDangHoi}.`
          : pendingReq.question === "duyet_tin"
          ? `Chủ nhà chưa gật bản nháp, cũng chưa nói sửa gì rõ.`
          : `Câu đó KHÔNG trả lời được câu em hỏi - có thể chủ nhà hiểu nhầm, hoặc đang nói một thông số khác. Em đã ghi chú lại nguyên văn (không mất), nhắc lại ngắn gọn để xác nhận rồi hỏi lại.`;
        const promptLai =
          `${boiCanh}Em vừa hỏi "${nhanDangHoi}", chủ nhà nhắn: "${text}". ${viSao}\n${hoiNguocPrompt}` +
          `Viết MỘT tin ngắn như người thật nhắn Zalo: xử lý ý trên, rồi hỏi lại nhẹ nhàng, diễn đạt KHÁC câu hỏi trước: ${nhanHoiLai}? ` +
          `Ý hỏi chính vẫn là "${nhanDangHoi}" (hệ thống ghi câu trả lời kế vào ô này). ` +
          `Không xin lỗi dài, KHÔNG nhắc mã tin${nhieuCan ? " (nhiều căn thì gọi bằng địa chỉ)" : ""}.`;
        let hoiLai: string | null = null;
        if (anthropicS) {
          try {
            const r2b = await anthropicS.messages.create({
              model: MODEL, max_tokens: 400,
              output_config: { effort: "medium" },
              system: [{ type: "text", text: SELLER_SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: DONG_TEN }],
              messages: [{ role: "user", content: promptLai }],
            });
            hoiLai = r2b.content.find((b) => b.type === "text")?.text?.trim() ?? null;
            if (hoiLai && laLoiMeta(hoiLai)) { console.log("chat-reply: r2b tra loi cau lenh, bo"); hoiLai = null; }
            if (hoiLai) hoiLai = motCauHoi([hoiLai])[0];
            await doTien(client, r2b.usage);
          } catch (e) {
            await ghiLoi(client, "chat-reply model r2b(hoi lai)", e);
          }
        }
        if (!hoiLai) {
          hoiLai = (hoiNguoc && !hoiNguocDap ? `Câu ${cachGoi} hỏi em kiểm tra rồi báo lại ngay nha. ` : "") + (kq.loai === "xung_ho"
            ? `Dạ em nhớ rồi, em gọi ${kq.xungHo} nha. `
            : kq.chuyenSang
            ? `Em ghi "${kq.chuyenSang.answer}" rồi ạ. `
            : "") + `${CachGoi} cho em hỏi lại chút, ${nhanHoiLai} ạ?`;
        }
        return await traLoiSeller([...(hoiNguocDap ? [hoiNguocDap] : []), hoiLai], { reask: pendingReq.question, loai_cau: kq.loai, ...(hoiNguoc ? { hoi_nguoc: hoiNguoc } : {}) });
      }

      // Câu hỏi treo bị bỏ qua (né 2 lần / chủ gật): KHÔNG ghi câu này vào ô đang
      // hỏi — chỉ ghi fact nhận ra được (nếu có), rồi đi tiếp như vừa trả lời xong.
      let goiYDuongKe: GoiYDuong | null = null; // FR-212: tên đường khớp gần → câu kế hỏi xác nhận
      if (!boQuaCauTreo) {
        // 11/09/2026 (Zalo thật, ehome 3): câu trả lời địa chỉ kèm lời dặn ("Bạn phải
        // ghi dự án … chứ ở hồ ngọc lãm") từng vào NGUYÊN câu làm vị trí → location_raw
        // và street thành rác. Chỉ giữ cụm địa chỉ; câu phường có số thì "Phường N".
        let dapAnGhi = loaiDapAn ?? catDapAn(pendingReq.question, dapAn);
        // FR-212: câu trả lời ĐỊA CHỈ → đối chiếu tên đường với từ điển `duong` trước khi ghi. Kể cả khi
        // AI đã đọc ra tên đường (`loaiDapAn` — bắn thật 21/09 mau-tdt: "Trần Đình Trọng" của AI đi thẳng
        // vào tin, không ai hỏi "Trần Bình Trọng phải không").
        if (pendingReq.question === "vi_tri" && dapAnGhi) {
          const sd = await suaTenDuong(dapAnGhi, pendingReq.listings?.district);
          dapAnGhi = sd.viTri;
          goiYDuongKe = sd.goiY;
        }
        const { error: factErr } = await client.rpc("ghi_fact_listing", {
          p_listing_id: pendingReq.listing_id,
          p_question: pendingReq.question,
          p_answer: dapAnGhi,
          p_source: "seller_chat",
        });
        if (factErr) await ghiLoi(client, "chat-reply ghi_fact_listing(drip)", factErr.message);
        else {
          // 23/09/2026 (bắn thật): mở 2 lô rồi hỏi loại, "cả lô đều là đất thổ cư" → bản trước chỉ lô đang hỏi thành đất,
          // lô kia nằm "chưa rõ loại". "Cả lô / đều / cả 2" ở câu LOẠI áp cho mọi tin chưa rõ loại của người đó.
          if (pendingReq.question === "loai_bds" && loaiDapAn && CA_LO_RE.test(tKD)) {
            const { data: chuaRo, error: crErr } = await client.from("listings").select("id").eq("seller_id", sellerRow.id)
              .eq("property_type", "chua_ro").neq("id", pendingReq.listing_id).in("status", ["cho_thong_tin", "dang_ban", "dang_quan_tam"]).limit(20);
            if (crErr) await ghiLoi(client, "chat-reply loai ca lo(doc)", crErr.message);
            for (const t of (chuaRo ?? []) as Array<{ id: string }>) {
              const { error: lErr } = await client.rpc("ghi_fact_listing", { p_listing_id: t.id, p_question: "loai_bds", p_answer: loaiDapAn, p_source: "seller_chat" });
              if (lErr) await ghiLoi(client, "chat-reply loai ca lo", lErr.message);
              const { error: irLErr } = await client.from("info_requests").update({ status: "answered", answer: dapAn, answered_at: new Date().toISOString() })
                .eq("listing_id", t.id).eq("question", "loai_bds").eq("status", "pending");
              if (irLErr) await ghiLoi(client, "chat-reply loai ca lo(dong cau)", irLErr.message);
            }
          }
          await chepSangDuAn(pendingReq.question, dapAn);
          // FR-220: "có lửng với sân thượng" → kết cấu chữ "trệt + lửng + 2 lầu + sân thượng" (bản tin, vector, web
          // đều đọc floors_text). "không có" chỉ là fact.
          if (pendingReq.question === "tang_phu") {
            const { data: kcRow, error: kcErr } = await client.from("listings").select("floors_text, floors").eq("id", pendingReq.listing_id).maybeSingle();
            if (kcErr) await ghiLoi(client, "chat-reply tang_phu(doc)", kcErr.message);
            const moi = kcRow ? themTangPhu(kcRow.floors_text as string | null, kcRow.floors as number | null, dapAn) : null;
            if (moi) {
              const { error: tpErr } = await client.from("listings").update({ floors_text: moi }).eq("id", pendingReq.listing_id);
              if (tpErr) await ghiLoi(client, "chat-reply tang_phu(ghi)", tpErr.message);
            }
          }
          // 16/09/2026 (bắn thật mau-chu-q8): "Căn số 14 ở Ny'ah Phú Định" trả lời câu VỊ TRÍ — tên dự
          // án trong kho chỉ được khớp lúc RAO, nên tin nằm "Quận 5 (chưa rõ quận)" dù dự án ở Quận 8.
          // Nay khớp cả ở đây; quận/phường lấy của dự án khi tin còn mặc định / trống.
          if (pendingReq.question === "vi_tri" && !pendingReq.listings?.project_id) {
            const { data: dsDA, error: daErr } = await client.rpc("match_projects", { p_text: dapAn });
            if (daErr) await ghiLoi(client, "chat-reply match_projects(vi_tri)", daErr.message);
            const da = ((dsDA ?? []) as Array<{ id: string; name?: string; district?: string | null; ward?: string | null }>)[0] ?? null;
            if (da && !duAnLaTenDuong(da.name, dapAn)) {
              const { data: cu } = await client.from("listings").select("district, ward, boc_tach").eq("id", pendingReq.listing_id).maybeSingle();
              const macDinh = !cu?.district || (cu?.boc_tach as { quan_mac_dinh?: unknown } | null)?.quan_mac_dinh === true;
              const { error: gErr } = await client.from("listings").update({
                project_id: da.id,
                ...(macDinh && da.district ? { district: da.district } : {}),
                // Phường của dự án chỉ khi quận cũng lấy của dự án — tin đã nói rõ quận khác thì không lai.
                ...(macDinh && !cu?.ward && da.ward ? { ward: da.ward } : {}),
              }).eq("id", pendingReq.listing_id).is("project_id", null);
              if (gErr) await ghiLoi(client, "chat-reply gan du an(vi_tri)", gErr.message);
              else if (macDinh && da.district) {
                const { error: btErr } = await client.rpc("ghi_boc_tach", { p_listing_id: pendingReq.listing_id, p: { quan: da.district, quan_mac_dinh: false } });
                if (btErr) await ghiLoi(client, "chat-reply ghi_boc_tach(quan du an)", btErr.message);
              }
            }
          }
        }
      }
      // Câu khớp nhưng còn kèm fact khác ("3 lầu, 4 phòng ngủ" khi hỏi kết cấu;
      // "Đường 12m, hướng Bắc" khi hỏi đường) → ghi luôn, đỡ hỏi lại (09/09 tối).
      if (pendingReq.question !== "duyet_tin" && pendingReq.question !== "danh_gia" && pendingReq.question !== "hinh_anh") {
        for (const f of factKem(dapAn)) {
          // Cùng họ vẫn ghi ("phường Tân Hưng" trả lời địa chỉ thì phường cũng có), chỉ bỏ trùng khoá.
          if (!boQuaCauTreo && f.question === pendingReq.question) continue;
          // FR-223 (bắn thật 24/09, rn-test-h): đang hỏi TIỀN THUÊ / cọc / phí, số tiền trong câu là câu trả lời cho câu đó —
          // KHÔNG ghi kèm thành GIÁ BÁN ("150 triệu một tháng" từng đè giá 25 tỷ thành 150 triệu).
          if (f.question === "gia" && pendingReq.question !== "gia" && CAU_HOI_TIEN.has(pendingReq.question)) continue;
          const { error: ndErr } = await client.rpc("ghi_fact_listing", {
            p_listing_id: pendingReq.listing_id, p_question: f.question, p_answer: f.answer,
            p_source: aiChinh?.ghi.some((g) => g === f) ? NGUON_AI : "seller_chat",
          });
          if (ndErr) await ghiLoi(client, "chat-reply ghi_fact_listing(kem)", ndErr.message);
          else await chepSangDuAn(f.question, f.answer);
        }
      }
      if (!boQuaCauTreo) {
        await client.from("info_requests").update({
          status: "answered", answer: dapAn, answered_at: new Date().toISOString(),
        }).eq("id", pendingReq.id);
      }

      // FR-177 c: chủ nhà GẬT bản nháp → đóng dấu; trigger
      // `listings_quyet_dinh_dang_tin` (điểm ≥ 70 + dấu) đưa tin lên kệ.
      if (pendingReq.question === "duyet_tin") {
        const luc = new Date().toISOString();
        // FR-177 g: gật bằng "đủ rồi, đăng đi" thì cũng là lời "đủ rồi" — ghi luôn.
        const noiDu = laDuRoi(dapAn);
        const { error: okErr } = await client.from("listings")
          .update({ chu_duyet_at: luc, ...(noiDu ? { chu_noi_du_at: luc } : {}) })
          .eq("id", pendingReq.listing_id);
        if (okErr) await ghiLoi(client, "chat-reply chu duyet tin", okErr.message);
        // FR-177 f: chúc mừng kèm ĐIỂM và cách thêm điểm — "chúc mừng anh, điểm
        // của anh là X, làm sao thêm điểm". Điểm và danh sách thiếu là tiền định
        // (diem_tin), 5 phút sau cron seller-hoi-bu-tick hỏi bù câu đầu tiên.
        const [{ data: lstOk }, { data: dOk, error: dOkErr }] = await Promise.all([
          client.from("listings").select("code, status").eq("id", pendingReq.listing_id).maybeSingle(),
          client.rpc("diem_tin", { p_listing_id: pendingReq.listing_id }),
        ]);
        if (dOkErr) await ghiLoi(client, "chat-reply diem_tin(duyet)", dOkErr.message);
        const dk = (dOk ?? null) as DiemTin | null;
        const len = !!lstOk && lstOk.status !== "cho_thong_tin";
        // Mỗi ý một dòng (chủ dự án 09/09: "cái nào cần xuống dòng thì xuống dòng").
        // 22/09/2026 (bộ đo giọng B09, chủ dự án chốt): câu chúc mừng 92 từ một bong bóng → rút còn hai câu;
        // cách thêm điểm tách bong bóng riêng, bỏ câu hẹn "có thể em sẽ hỏi thêm" (câu chúc đã nói có khách
        // là báo). Khoá `dang_xong_hen` vẫn giữ trong CAU_TIEN_DINH cho bản DB cũ, không dùng ở đây nữa.
        const themDiem = dk && !noiDu && (dk.thieu ?? []).length
          ? cauTD("dang_xong_them_diem", { thieu: (dk.thieu ?? []).slice(0, 2).join(" và ") }) +
            ((dk.so_anh ?? 0) >= 3 ? "" : cauTD("dang_xong_them_anh")) + "."
          : "";
        // FR-183 (09/09/2026): ĐIỂM NGƯỜI RAO — trung bình điểm các tin đang rao
        // × hệ số quy mô (NMG). Chỉ nhắc khi rao từ 2 căn (một căn thì điểm người
        // = điểm tin, nói hai lần là thừa). Tiền định, RPC `diem_nguoi_ban`.
        let dongNguoiRao = "";
        if (len && nhieuCan) {
          const { data: dnb, error: dnbErr } = await client.rpc("diem_nguoi_ban", { p_seller_id: sellerRow.id });
          if (dnbErr) await ghiLoi(client, "chat-reply diem_nguoi_ban", dnbErr.message);
          const d = (dnb ?? null) as { diem?: number; so_tin?: number } | null;
          if (d && typeof d.diem === "number") {
            dongNguoiRao = `\nĐiểm người rao của ${cachGoi} hiện ${d.diem}/100 (${d.so_tin ?? "?"} căn đang rao); tin nào đủ hơn là điểm chung lên theo.`;
          }
        }
        const cau = len
          ? cauTD("dang_xong", { diem: dk?.diem }) + dongNguoiRao
          : `Dạ em ghi nhận rồi ạ.\nTin còn thiếu một chút để đủ điều kiện đăng, em hỏi thêm ${cachGoi} vài thông tin nữa nha.`;
        return await traLoiSeller(len && themDiem ? [cau, themDiem] : [cau], {
          duyet: true, listing_status: lstOk?.status ?? null, diem: dk?.diem ?? null, du_roi: noiDu || undefined,
        });
      }

      // Fact đã vào sổ — từ đây trở xuống là phần "nói". Người thật đang cầm
      // cuộc thì dừng: không gọi model, và KHÔNG mở câu hỏi pending mới (bot
      // có hỏi đâu mà chờ trả lời). Cron drip hỏi tiếp khi CTV buông tay.
      if (humanActive) {
        return await traLoiSeller([], { saved_fact: pendingReq.question });
      }

      // FR-144: tin ĐÃ ĐỦ ĐĂNG (auto-publish xong, hết cho_thong_tin) → NGỪNG
      // hỏi drip, để yên; khách quan tâm hỏi thêm thì FR-140 tự mở lại vòng hỏi.
      // Trạng thái phải đọc LẠI sau khi ghi fact (fact vừa ghi có thể là mảnh
      // cuối làm tin tự lên kệ) — nhưng đọc cùng lúc với câu kế tiếp, và danh
      // sách câu còn treo suy ra từ `ds` đã có (FR-171 h: 3 vòng → 1).
      const [{ data: lstNow }, { data: nextFactsTho }, { data: daHetHan }] = await Promise.all([
        client.from("listings").select("code, status, can_chu_duyet, chu_duyet_at")
          .eq("id", pendingReq.listing_id).maybeSingle(),
        client.from("listing_missing_facts").select("fact_key, priority, nhom")
          .eq("listing_id", pendingReq.listing_id).order("priority").limit(12),
        // Câu đã bị NÉ (expired) thì KHÔNG mở lại ngay trong cùng vòng — lần 3
        // kịch bản thật: địa chỉ hết hạn xong được chọn lại làm câu kế, hết hạn,
        // chọn lại… Vòng hỏi bù (cron) hỏi lại sau.
        client.from("info_requests").select("question").eq("listing_id", pendingReq.listing_id).eq("status", "expired"),
      ]);
      const hetHanSet = new Set((daHetHan ?? []).map((q) => q.question));
      // FR-223: câu nhánh theo câu trả lời (sổ riêng → hoàn công, chưa sổ → bao giờ ra sổ, đang cho thuê → bỏ hiện trạng…).
      const nextFacts = (await thieuCoReNhanh(client, pendingReq.listing_id, nextFactsTho, [pendingReq.question], text)).filter((f) => !hetHanSet.has(f.fact_key));
      const published = !!lstNow && lstNow.status !== "cho_thong_tin";
      // Chủ nói "đăng đi / ok / được" giữa vòng hỏi (09/09 tối lần 2): đủ 70 điểm
      // thì gửi BẢN NHÁP ngay (bỏ câu đang treo), dưới 70 thì nói rõ còn thiếu gì
      // rồi hỏi tiếp — không ghi "đăng đi" thành câu trả lời, không hỏi lại câu cũ.
      let dauDangThieu: string | null = null;
      if (chuMuonDang && !published && lstNow?.can_chu_duyet && !lstNow.chu_duyet_at) {
        const nhap = await guiBanNhap(pendingReq.listing_id, { saved_fact: null, chu_muon_dang: true }, false, [], true);
        if (!Array.isArray(nhap)) {
          // Nháp đã gửi → câu thông số đang treo thôi, câu duyệt thay chỗ.
          await client.from("info_requests").update({ status: "expired" }).eq("id", pendingReq.id);
          return nhap;
        }
        // Chưa đủ điểm: giữ câu treo, nói còn thiếu gì rồi hỏi lại câu đó.
        const thieuVan = nhap.slice(0, 2).join(" và ");
        // Câu vừa trả lời xong (traLoiKemDang) → không hỏi lại nó; báo còn thiếu gì rồi đi tiếp câu KẾ ở dưới.
        if (traLoiKemDang) dauDangThieu = `Dạ em đăng liền cho ${cachGoi}, chỉ cần thêm ${thieuVan || "vài thông tin"} là đủ điều kiện lên kệ ạ.`;
        else return await traLoiSeller(
          [`Dạ em đăng liền cho ${cachGoi}, chỉ cần thêm ${thieuVan || "vài thông tin"} là đủ điều kiện lên kệ ạ.\n${cauHoiMau(pendingReq.question, cachGoi, pendingReq.listings?.property_type, pendingReq.listings?.district, pendingReq.listings?.deal)}`],
          { chu_muon_dang: true, thieu: nhap, reask: pendingReq.question },
        );
      }
      if (chuMuonDang && !traLoiKemDang) {
        // Tin đã lên kệ / không tự chốt: "ok" chỉ là ừ — thôi câu treo, đi tiếp.
        await client.from("info_requests").update({ status: "expired" }).eq("id", pendingReq.id);
      }
      // Câu còn treo của căn này = mọi câu chờ đã nạp ở đầu nhánh, trừ câu vừa
      // được trả lời.
      const pendSet = new Set(
        ds.filter((p) => p.listing_id === pendingReq.listing_id && p.id !== pendingReq.id)
          .map((p) => p.question),
      );
      // FR-177 a: câu kế = nhóm ưu tiên cao nhất còn thiếu, trong nhóm chọn câu
      // LIÊN QUAN tới điều chủ nhà vừa nói (`chonCauKe`, tiền định).
      // 20260909i: nhóm `sau_dang` (WC, cách mặt tiền, hẻm thông, ngập, thế chấp, lý do
      // bán…) chỉ hỏi SAU khi tin lên kệ (cron hỏi bù) — trước bản nháp chỉ đợi
      // co_ban + chuyen_mon, kẻo chủ nhà bị hỏi 15 câu mới thấy tin.
      const nextKey = published
        ? undefined
        : chonCauKe([pendingReq.question], (nextFacts ?? []).filter((f) => !pendSet.has(f.fact_key) && f.nhom !== "sau_dang"));
      // FR-177 c: hết câu cơ bản + chuyên môn (ảnh xin trong bản nháp) và tin
      // đủ 70 điểm → gửi bản nháp thay vì hỏi tiếp. Dưới 70 thì hỏi tiếp và
      // nói rõ còn thiếu gì.
      let thieuDiem: string[] = [];
      if (!published && lstNow?.can_chu_duyet && !lstNow.chu_duyet_at &&
          (!nextKey || nextKey === "hinh_anh")) {
        const nhap = await guiBanNhap(pendingReq.listing_id, { saved_fact: pendingReq.question, ...(hoiNguoc ? { hoi_nguoc: hoiNguoc } : {}) }, false, hoiNguocDap ? [hoiNguocDap] : []);
        if (!Array.isArray(nhap)) return nhap;
        thieuDiem = nhap;
        // Thiếu GIÁ mà câu giá không còn treo (hết hạn vì chủ nhà nói thứ khác) → mở lại, kẻo bot
        // hỏi giá mà không có ô nhận câu trả lời (20/09/2026, mau-y-D: câu giá `expired`).
        if (thieuDiem[0]?.startsWith("giá") && pendingReq.question !== "gia" && !pendSet.has("gia")) {
          const { error: gErr } = await client.from("info_requests").insert({ listing_id: pendingReq.listing_id, question: "gia", status: "pending" });
          if (gErr && gErr.code !== "23505") await ghiLoi(client, "chat-reply mo lai cau gia", gErr.message);
        }
      }

      // Câu hỏi drip PHẢI vắt vai mã căn + địa chỉ (FR-157). Người bán nhiều
      // căn mà nghe "hoàn công năm nào ạ?" trống không thì họ trả lời về căn
      // đang nghĩ trong đầu, không phải căn bot đang hỏi — neo phía DB xong mà
      // câu chữ không neo thì vẫn lệch, chỉ là lệch ở đầu bên kia.
      // FR-176: neo mã căn CHỈ khi người này rao nhiều căn (FR-157 c sinh ra
      // cho ca đó). Một căn mà tin nào cũng "#BDS-Q5-0174" là giọng máy.
      // FR-178: neo bằng ĐỊA CHỈ, không đọc mã tin cho khách (mã chỉ ở web/CTV/admin).
      // 10/09 lần 8: rao theo lô thì neo bằng MÃ CĂN ("Căn A5 nha"), đừng đọc
      // "Căn Phường 16" — cả lô cùng một phường nên câu đó không chỉ ra căn nào.
      const neo = nhieuCan
        ? (pendingReq.listings?.unit_code?.trim() ||
          pendingReq.listings?.location_raw?.split(",")[0]?.trim() ||
          pendingReq.listings?.ward || "")
        : "";
      const phiMotCau = sellerRow.seller_type === "nmg"
        ? "phí chỉ thu khi giao dịch thành công, 0,5% giá chốt"
        : "phí chỉ thu khi giao dịch thành công, 1% giá chốt";

      // FR-209: câu kế là PHƯỜNG mà tin còn ở quận mặc định và đã có tên đường → tra
      // Nominatim + `wards`, hỏi xác nhận thay vì "phường mấy, quận nào".
      // FR-212: tên đường vừa ghi khớp GẦN từ điển → câu kế là XÁC NHẬN tên đường (câu treo kế vẫn mở,
      // gật thì hỏi lại nó). Chỉ khi còn câu để hỏi — hết câu thì không cất gợi ý, kẻo "ok cảm ơn" sau
      // này bị đọc thành gật.
      const cauDuongKe = goiYDuongKe && nextKey ? await cauHoiDuongGoiY(pendingReq.listing_id, goiYDuongKe, cachGoi) : null;
      const goiYKe = !cauDuongKe && nextKey === "phuong" ? await cauHoiPhuongGoiY(pendingReq.listing_id, null, cachGoi) : null;
      const nhanhKe = nextKey ? nhanhCuaKhoa(nextKey) : null;
      const cauKe = nextKey
        ? cauDuongKe ?? goiYKe ?? cauHoiMau(nextKey, cachGoi, pendingReq.listings?.property_type, pendingReq.listings?.district, pendingReq.listings?.deal, pendingReq.listings?.location_raw)
        : "";
      // Bong bóng ghi nhận đã gửi trước tin này → đừng cảm ơn/ghi nhận lần nữa.
      const daAck = ackSua
        ? `Bong bóng NGAY TRƯỚC tin này đã ghi nhận số liệu rồi ("${ackSua.slice(0, 60)}…") — KHÔNG cảm ơn, KHÔNG ghi nhận lại, vào thẳng câu hỏi. `
        : "";
      const prompt = nextKey
        ? `${boiCanh}${daAck}Chủ nhà vừa trả lời câu hỏi "${FACT_LABELS[pendingReq.question] ?? pendingReq.question}": "${text}".\n${hoiNguocPrompt}` +
          `Viết MỘT tin ngắn như người thật nhắn Zalo: ${
            khenGanDay
              ? "KHÔNG khen, KHÔNG nhận xét căn nhà (mấy tin gần đây em đã khen rồi — lâu lâu mới khen một lần): ghi nhận ngắn một vế hoặc bỏ luôn phần ghi nhận, "
              : "ghi nhận ngắn, KHÔNG đọc lại số liệu hay địa chỉ vừa nghe (hệ thống đã báo); CHỈ khi chủ nhà vừa nói điều thật đáng nói với khách mua thì thêm MỘT vế về đúng điều đó, còn không thì thôi — "
          }rồi hỏi tiếp thứ quan trọng nhất còn thiếu: ${nhanTheoLoai(nextKey, pendingReq.listings?.property_type)}. ` +
          // 24/09/2026 (chủ dự án chuyển nhận xét của AI khác): bỏ "gộp thêm một ý … cũng được" — chính khe đó cho model gắn
          // "đã hoàn công chưa" vào câu hỏi sổ. Code chọn HỎI GÌ, model chỉ chọn CÁCH NÓI.
          // FR-223 (chủ dự án chọn "lai" 24/09): câu NHÁNH → cho model biết đang hỏi thêm chuyện gì và các ý chính của
          // nhánh, để câu hỏi nối được với điều chủ nhà vừa nói (code vẫn chọn Ý NÀO hỏi — câu trả lời ghi đúng ô).
          (nhanhKe
            ? `Chủ nhà vừa nói tới chuyện "${nhanhKe.ten}" nên em hỏi thêm cho rõ; các ý chính cần thu của chuyện này: ` +
              `${nhanhKe.cacY.map((k) => FACT_LABELS[k] ?? k).join("; ")}. Lượt này hỏi ý "${nhanTheoLoai(nextKey, pendingReq.listings?.property_type)}"; ` +
              `ý nào chủ nhà đã nói trong NGỮ CẢNH thì chỉ ghi nhận, không hỏi lại. `
            : "") +
          `Câu gợi ý: "${cauKe}" — nói lại cho tự nhiên, hợp với loại nhà này; ý hỏi chính là ${nhanTheoLoai(nextKey, pendingReq.listings?.property_type)}, ` +
          `đừng gắn thêm ý khác vào câu hỏi (hệ thống ghi câu trả lời kế vào ô này; hỏi lệch là ghi sai ô). ` +
          (nhieuCan
            ? `Người này rao nhiều căn: nói rõ đang hỏi căn ${neo || "nào (theo đặc điểm)"}, KHÔNG đọc mã tin. `
            : `Người này chỉ có một căn: KHÔNG nhắc mã tin. `) +
          `Lý do "vì khách hỏi" chỉ dùng nếu 3 tin gần nhất của em trong lịch sử chưa dùng.`
        : published
        ? `${boiCanh}${hoiNguocPrompt}Chủ nhà vừa trả lời: "${text}". Tin${neo ? ` căn ${neo}` : ""} giờ đã đủ thông tin và ĐÃ LÊN WEB AI Ơi Nhà Đất. ` +
          `Viết MỘT tin ngắn: cảm ơn, báo tin đã đăng, có khách quan tâm là em báo liền. KHÔNG nhắc phí (chỉ nói khi họ hỏi: ${phiMotCau}). KHÔNG nhắc mã tin. KHÔNG hỏi thêm thông tin nào nữa.`
        : thieuDiem.length
        ? `${boiCanh}${hoiNguocPrompt}Chủ nhà vừa trả lời: "${text}". Tin chưa đủ điểm để đăng, còn thiếu (theo thứ tự ưu tiên): ${thieuDiem.slice(0, 2).join("; ")}. Viết MỘT tin ngắn như người thật: ghi nhận, rồi hỏi thứ đầu danh sách đó theo cách hợp với loại nhà này.`
        : `${boiCanh}${hoiNguocPrompt}Chủ nhà vừa trả lời câu hỏi cuối: "${text}". Viết MỘT tin ngắn cảm ơn, báo tin rao giờ đã đầy đủ thông tin, tụi em sẽ báo ngay khi có khách quan tâm. Kết thúc bằng một câu hỏi nhẹ xem ${cachGoi} còn muốn bổ sung gì không.`;
      // OPEN-30: model hỏng thì hỏi bằng câu mẫu tất định — vòng drip không
      // đứng lại chờ model sống. Câu mẫu CÓ hỏi thật (kèm neo căn) nên mở
      // info_request bên dưới vẫn đúng luật "không mở khi chưa hỏi được".
      let sellerReply: string | null = null;
      if (anthropicS) {
        try {
          const r2 = await anthropicS.messages.create({
            model: MODEL, max_tokens: 512,
            // FR-176: có lịch sử để đọc thì cho model đọc — "low" là đủ khi
            // câu lệnh cụt, giờ nó phải tránh lặp khuôn của 8 tin trước.
            output_config: { effort: "medium" },
            system: [{ type: "text", text: SELLER_SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: DONG_TEN }],
            messages: [{ role: "user", content: prompt }],
          });
          sellerReply = r2.content.find((b) => b.type === "text")?.text?.trim() ?? null;
          // 15/09/2026 (bắn thật P2): model trả lời CÂU LỆNH ("Em hiểu rồi ạ… Sẵn sàng nhận
          // hội thoại") → bỏ, dùng câu tiền định.
          if (sellerReply && laLoiMeta(sellerReply)) { console.log("chat-reply: r2 tra loi cau lenh, bo"); sellerReply = null; }
          if (sellerReply && khenGanDay) sellerReply = boCauKhen(sellerReply);
          // 22/09/2026 (bộ đo giọng B01/B15/B16): "ô tô vào được", "xuyên thoáng", "nở hậu" khi chủ nhà CHƯA
          // nói — TONE_RULES cấm khen điều khách không nói nhưng model vẫn lọt. Chỉ áp cho lời MODEL (bản
          // nháp / bảng tiền định đọc từ DB có thứ chủ nhà nói ở lượt trước). Bằng chứng = chữ chủ nhà đã gõ
          // (tin này + lịch sử gần nhất); câu hỏi ("ô tô vào được không anh?") giữ nguyên.
          if (sellerReply) {
            sellerReply = boKhenKhongCanCu([sellerReply], [text, ...lichSuRows.filter((m) => laTinNguoi(m.sender)).map((m) => m.body ?? "")].join(" "))[0] ?? null;
            if (sellerReply) sellerReply = boMenhDeKhenSai([sellerReply], [text, ...lichSuRows.filter((m) => laTinNguoi(m.sender)).map((m) => m.body ?? "")].join(" "))[0] ?? null;
            if (sellerReply) sellerReply = boHoiHoanCong([sellerReply], nextKey === "hoan_cong")[0] ?? null;
          }
          // FR-177: một lượt một câu hỏi — cắt câu hỏi thứ hai của model (15/09/2026).
          // Chỉ áp cho lời MODEL: câu tiền định (xin chấm điểm, liệt kê căn) có chủ ý.
          if (sellerReply) sellerReply = motCauHoi([sellerReply])[0];
          // 25/09/2026 (bắn thật lx-09): code mở ô chờ `gap` mà model hỏi "hẻm rộng mấy mét" — câu trả lời kế rơi sai ô.
          // Câu hỏi model mang chủ đề khoá KHÁC (không mang chủ đề khoá code chọn) → thay bằng câu mẫu của khoá đó.
          if (sellerReply && nextKey && !(cauDuongKe ?? goiYKe) && laHoiLechKhoa(sellerReply, nextKey)) {
            console.log(`chat-reply: câu hỏi model lệch khoá ${nextKey}, thay câu mẫu`);
            sellerReply = thayCauHoiLech(sellerReply, nextKey, `${neo ? `Căn ${neo} nha. ` : ""}${cauKe}`);
          }
          // Tin chưa lên kệ mà model nói "đã đăng lên web" → bỏ mệnh đề đó.
          if (sellerReply && !published) sellerReply = boHuaDaDang([sellerReply])[0] ?? null;
          // 25/09/2026 (bắn thật lx-05): câu xác nhận / chọn phường, xác nhận tên đường do CODE tra ra → thay câu hỏi của
          // model bằng câu đó NGUYÊN VĂN (model từng nói lại thành "phường nào vậy ạ?", rơi mất lựa chọn).
          if (sellerReply && (cauDuongKe ?? goiYKe)) {
            sellerReply = `${sellerReply.replace(/[^.!?]*\?\s*$/u, "").trim()} ${cauDuongKe ?? goiYKe}`.trim();
          }
          await doTien(client, r2.usage);
        } catch (e) {
          await ghiLoi(client, "chat-reply model r2(seller)", e);
        }
      }
      if (!sellerReply) {
        // FR-178: câu mẫu cũng phải là câu người nói, không đọc tên trường.
        // 10/09 lần 7: bong bóng trước đã nói "Dạ em ghi rồi ạ: …" mà bong bóng
        // này mở đầu y hệt — hai câu ghi nhận liền nhau đọc như máy. Đã có bong
        // bóng ghi nhận thì vào thẳng câu hỏi.
        const moDau = (hoiNguoc && !hoiNguocDap ? `Câu ${cachGoi} hỏi em kiểm tra rồi báo lại ngay nha. ` : "") + (ackSua ? "" : "Dạ em ghi rồi ạ. ");
        sellerReply = nextKey
          ? `${moDau}${neo ? `Căn ${neo} nha. ` : ""}${cauKe}`
          : thieuDiem.length
          ? `${moDau}Để tin đủ điều kiện đăng, ${cachGoi} cho em hỏi thêm ${thieuDiem[0]} nha?`
          : published
          ? `Dạ em cảm ơn ${cachGoi}! Tin ${neo ? `căn ${neo} ` : "nhà mình "}đã đủ thông tin và lên web rồi ạ, có khách quan tâm là em báo liền.`
          : `Dạ em cảm ơn ${cachGoi}, tin rao giờ đã đầy đủ thông tin. Có khách quan tâm là em báo ${cachGoi} ngay ạ.`;
      }

      // 22/09/2026: hết câu để hỏi thì để yên, không xin chấm điểm ở đây nữa (dời sang lúc báo bán được).
      const xinDiemCuoi: string | null = null;
      if (nextKey && sellerReply) {
        // 23505 = `ask-seller` (nhịp drip :22/:52) vừa mở đúng câu này. Không
        // phải sự cố — bỏ qua. Mã khác thì vào sổ (FR-152 d).
        const { error: irErr } = await client.from("info_requests").insert({
          listing_id: pendingReq.listing_id, question: nextKey, status: "pending",
        });
        if (irErr && irErr.code !== "23505") {
          await ghiLoi(client, "chat-reply mo cau hoi tiep", irErr.message);
        }
      }
      return await traLoiSeller([...(hoiNguocDap ? [hoiNguocDap] : []), ...(dauDangThieu ? [dauDangThieu] : []), sellerReply, ...(xinDiemCuoi ? [xinDiemCuoi] : [])], {
        ...(dauDangThieu ? { chu_muon_dang: true } : {}),
        saved_fact: boQuaCauTreo ? null : pendingReq.question, ...(xinDiemCuoi ? { xin_danh_gia: true } : {}), ...(hoiNguoc ? { hoi_nguoc: hoiNguoc } : {}),
      });
    }
    // FR-144: chính chủ nhắn CÂU RAO MỚI → tạo tin nháp cho_thong_tin ngay + mở
    // vòng hỏi nhỏ giọt, hỏi tới khi đủ-để-đăng (giá + diện tích + phường) thì
    // nghỉ; khách quan tâm hỏi thêm thì FR-140 mở lại vòng hỏi.
    // (Cổng `wantsSell` tính ở trên — FR-164 cần nó sớm để bộ bắt-lời-sửa không
    //  nuốt mất câu rao mới.)
    // 16/09/2026 (bắn thật mau-co-thue): "thôi để cô hỏi lại con cô đã" lúc KHÔNG có câu treo
    // (câu gấp vừa hỏi chưa mở IR) → rơi xuống nhánh chăm sóc, model đáp "cháu chờ" rồi hỏi
    // luôn câu mới. Hoãn là hoãn ở mọi nhánh: đáp một câu, không hỏi thêm.
    if (!wantsSell && !pendingReq && sellerRow.active_listing_id && laHoanLai(text)) {
      const goi = goiNguoi ?? "mình";
      const phien = /bận|mệt|hỏi (?:gì )?(?:hoài|lắm|nhiều|mãi)/i.test(text);
      return await traLoiSeller([phien
        ? `Dạ em xin lỗi, em hỏi dồn quá. Lúc nào ${goi} rảnh nhắn em là em làm tiếp liền nha.`
        : `Dạ ${goi} cứ thong thả nha. Có gì ${goi} nhắn em là em làm tiếp liền.`], { hoan: true, loai_cau: "hoan" });
    }
    if (!daGanManh && (wantsSell || raoMoiCanKhac || (dangXinCanMoi && coChiTiet))) {
      // Loại BĐS KHÔNG hỏi: trigger trg_listings_fill_property_type đọc chính
      // câu rao (description) mà điền (FR-150). Chỉ tin nào câu chữ không đủ
      // để đoán mới nằm lại 'chua_ro' và bị hỏi ở vòng drip.
      // Cùng một mẫu với cổng wantsSell ở trên — lệch một chữ là câu rao lọt
      // cổng "cho thue" nhưng bị ghi thành tin BÁN.
      // 14/09/2026 (bắn 14 tin bán): "bán nhà mặt tiền…, đang cho thuê 45 triệu/tháng, giá
      // 32 tỷ" từng thành tin CHO THUÊ giá 45 triệu — chữ "cho thuê" ở đâu cũng lật deal.
      // `dealCauRao`: thu nhập thuê của căn bán không lật; "sang nhượng mặt bằng" là thuê.
      // 21/09/2026 chế độ `chinh`: AI đọc CÂU RAO trước (lượt đã chạy song song từ đầu nhánh), qua kiểm
      // bằng chứng → giá trị cột lõi + fact; luật chỉ đỡ chỗ AI không đọc ra (giá, diện tích, quận,
      // phường) hoặc khi model hỏng. Riêng ĐỊA CHỈ và fact kèm: AI đã chạy thì luật không bóc nữa —
      // đó là hai chỗ đẻ ra "quý 2 năm sau" làm tên đường (TS-VAN-11). Tin rao nhiều căn: AI đứng ngoài.
      let aiRao: (AiChinh & { kienThuc: string[] }) | null = null;
      if (bongAi && cheDoBocAi && (await cheDoBocAi) === "chinh") {
        const kqAi = await bongAi;
        if (kqAi?.ket && ((kqAi.ket as { so_can?: number }).so_can ?? 1) <= 1) {
          const kdAi = kiemDeXuat(kqAi.truong, text);
          const datAi = kdAi.dat;
          aiRao = { ...docAiChinh(datAi, { deal: dealCauRao(tKD) }), kienThuc: kiemKienThuc(kqAi.kienThuc ?? [], text, datAi) };
          // FR-212 (bắn thật 21/09): khách gõ "pham the hier" → AI đọc "Phạm Thế Hiển" (sửa chính tả) → kiểm
          // bằng chứng BỎ vì đổi chữ cái (FR-208 h) → tin không có địa chỉ, không ai hỏi. Nhưng TRÍCH DẪN
          // của đề xuất đó chính là địa chỉ khách gõ, đã kiểm là nằm trong câu: lấy trích dẫn làm địa chỉ,
          // phần sửa để từ điển `duong` lo (khớp gần thì HỎI, không tự đổi chữ).
          if (!aiRao.duong) {
            const td = kdAi.bo.find((b) => b.khoa === "duong" && b.ly_do === "gia_tri_khong_nam_trong_trich_dan")?.trich_dan?.trim();
            if (td && td.length >= 4 && td.length <= 80 && /[\p{L}]{2}/u.test(td)) aiRao.duong = td;
          }
        }
      }
      const sDeal = aiRao?.loaiGiaoDich ?? dealCauRao(tKD);
      // (wardNo — số phường trong câu rao — tính ở trên, trước nhánh bán.)
      // price_raw cắt từ text GỐC (giữ nguyên chữ người gõ); đơn vị tiền lấy từ
      // TIEN_CD (đủ cả dạng có dấu lẫn không dấu — "giá 5 ti" gõ lẫn vẫn khớp).
      // parse_vnd phía DB đã nuốt được "ty"/"trieu" (kiểm 27/08).
      // Đuôi `[^,.;\n]*` giữ phần lẻ ("5 tỷ 8", "5 tỷ thương lượng") nhưng
      // từng vơ luôn diện tích đứng sau ("5 tỷ 8 50m2" → price_raw dính "50m2");
      // `chuan_hoa_gia_raw` phía DB chỉ gọt tiểu từ, không gọt "50m2". Dừng
      // TRƯỚC một cụm số+m2.
      // (`DUOI_GIA` nay ở boc-cau-rao.ts — một nguồn với bài kiểm; 15/09 thêm dừng
      // trước chữ của thứ khác: "6ty2 shr thanh khoan…" chỉ còn "6ty2".)
      // 11/09/2026 (42 ca): bắt thêm lóng "9t5"/"4t2" (TIEN_T_KEP), đọc trên
      // `textBoc` (số đọc bằng chữ đã thành chữ số).
      // 14/09/2026: con số tiền ĐẦU TIÊN từng là giá — "đang cho thuê 45 triệu…, giá 32 tỷ"
      // ra 45 triệu, "thuê 60 triệu/tháng, phí sang 350 triệu" suýt ra 350 triệu. `chonGiaRao`
      // bỏ cọc / phí / hoa hồng / tiền thuê đang thu, ưu tiên số sau chữ "giá / tổng".
      const giaDoan = aiRao?.gia ?? aiRao?.giaM2Raw ?? chonGiaRao(textBoc, sDeal, DUOI_GIA);
      const priceM = giaDoan ? [giaDoan, giaDoan] : null;
      // Diện tích + số phòng ngủ có sẵn trong câu rao thì ghi luôn qua cửa fact
      // (FR-164) sau khi tạo tin — không thì vòng nhỏ giọt hỏi lại đúng cái chủ
      // nhà vừa nói ("nhà 50m2" rồi bot hỏi "diện tích bao nhiêu ạ?"), kiểu mất
      // mặt FR-144 sinh ra để tránh. Giá/phường vào cột ngay lúc insert như cũ.
      // 14/09/2026: "diện tích 62,5m²" từng không ra diện tích (chỉ biết "m2").
      const dtRao = aiRao?.dienTich ?? (aiRao?.ngang != null && aiRao?.dai != null ? null : dienTichCauRao(tKD));
      const areaM = dtRao != null
        ? [String(dtRao), String(dtRao)]
        : aiRao?.ngang != null && aiRao?.dai != null ? [`${aiRao.ngang}x${aiRao.dai}`, `${aiRao.ngang}x${aiRao.dai}`] : null;
      const pnM = aiRao?.soPhongNgu != null
        ? [String(aiRao.soPhongNgu), String(aiRao.soPhongNgu)]
        : /(\d{1,2})\s*(?:phong ngu|\bpn\b)/.exec(tKD);
      // 11/09/2026 (42 ca): "giá 75 triệu/m2, diện tích 50m2" → căn lên web giá 75
      // triệu. parse_vnd nay trả NULL cho giá mỗi m²; có diện tích thì ghi giá CẢ
      // CĂN (75 triệu × 50m2) và nói rõ trong bong bóng ghi nhận là em đã nhân.
      const giaM2 = giaTheoM2(priceM?.[1]);
      // "5x20, giá 95 triệu/m2": không có chữ m2 nhưng ngang × dài vẫn nhân được (14/09).
      const dtSo = dtRao ?? (giaM2 ? (aiRao?.ngang != null && aiRao?.dai != null ? aiRao.ngang * aiRao.dai : ngangNhanDai(tKD)) : null);
      const giaGhi = giaM2 && dtSo ? vndThanhChu(giaM2 * dtSo) : priceM?.[1] ? gonGiaKyHan(priceM[1].trim()) : null;
      const giaNoi = giaM2 && dtSo ? `${priceM![1].trim()} (≈ ${giaGhi} cho ${dtSo}m2)` : giaGhi;
      // FR-158: mã do trigger `trg_listings_fill_code` cấp, nối tiếp đúng dãy
      // BDS-Q5-#### mà admin và web đang dùng. Đưa `code: null` xuống là cố ý —
      // bộ đúc mã `CCRB-<base36>` cũ ở đây là dãy thứ hai không ai cần, lại
      // không khoá gì nên hai chủ nhà rao cùng lúc là có cửa trùng mã.
      // FR-174: quận/huyện lấy từ chính câu rao ("Tân Bình", "q4", "Bến Lức
      // Long An"); không nói thì mặc định cụm khởi điểm Quận 5 — kho 173/173
      // tin ở đó và người rao ở đó chỉ nói "P4" [giả định BA, OPEN-27 nửa sau].
      // FR-114 (v48): câu rao có tên dự án trong kho (`match_projects`) → gắn
      // tin vào dự án + bóc mã căn ("căn A12-05", "mã căn B2.07"); không khớp
      // dự án nào thì tin là hàng lẻ như cũ. Tin vừa rao coi như "còn bán" và
      // chủ vừa xác nhận lúc rao [giả định BA] — FR-116 đếm TTL 7 ngày từ đây.
      const { data: duAnRao, error: duAnRaoErr } = await client
        .rpc("match_projects", { p_text: text });
      if (duAnRaoErr) await ghiLoi(client, "chat-reply match_projects(rao)", duAnRaoErr.message);
      // Dự án trong kho có quận/phường riêng (Ny'ah Phú Định ở Quận 8) — câu rao
      // không nói quận thì lấy của dự án, đừng mặc định Quận 5 (10/09 lần 6).
      const duAnKhop = ((duAnRao ?? []) as Array<{ id: string; name?: string; district?: string | null; ward?: string | null }>)[0] ?? null;
      // 14/09/2026: "nhà phố quận 7 đường Huỳnh Tấn Phát" khớp dự án "Căn Hộ Cao Cấp Huỳnh Tấn
      // Phát" chỉ vì trùng tên đường — tin nhận luôn phường của dự án. Trùng tên đường mà câu
      // không nhắc dự án / chung cư / căn hộ thì không phải dự án.
      const duAn = duAnKhop && !duAnLaTenDuong(duAnKhop.name, text) ? duAnKhop : null;
      // Phường tên chữ ("phường Hiệp Bình Chánh") khi câu không có phường số (14/09).
      let phuongRao = aiRao?.phuong ?? (wardNo ? `Phường ${wardNo}` : phuongTenCauRao(text));
      // 15/09/2026 (bắn thật B1): câu rao KHÔNG DẤU "phuong hiep binh chanh" — tra bảng
      // `wards` bằng so bỏ dấu (tên 2025 hoặc phường cũ trong `don_vi_cu`); không khớp
      // thì để trống và hỏi như cũ, không ghi chữ không dấu vào cột phường.
      if (!phuongRao && !/[À-ỹ]/.test(text)) {
        const tenKD = phuongTenKhongDau(tKD);
        if (tenKD) {
          const { data: dsPhuong, error: wErr } = await client.from("wards").select("ten, ten_day_du, don_vi_cu").limit(400);
          if (wErr) await ghiLoi(client, "chat-reply wards(khong dau)", wErr.message);
          const khop = ((dsPhuong ?? []) as Array<{ ten: string; ten_day_du: string | null; don_vi_cu: string | null }>)
            .find((w) => boDau(w.ten) === tenKD || boDau(w.don_vi_cu ?? "").includes(`phuong ${tenKD}`));
          if (khop) phuongRao = khop.ten_day_du ?? `Phường ${khop.ten}`;
        }
      }
      const maCanRao = duAn ? (aiRao?.maCan ?? MA_CAN_RE.exec(text)?.[1]?.toUpperCase() ?? null) : null;
      // Tình trạng GẤP (chủ dự án 09/09/2026 — cần cột riêng): nói gấp → true,
      // nói rõ "không gấp" → false, không nhắc → null (chưa rõ, không ép).
      const gapCol: boolean | null = aiRao?.gap ?? (laGap(text)
        ? true
        : /\b(khong|ko|k|chua|dau co|chang)\s*(?:can\s*)?gap\b/.test(tKD) ? false : null);
      // FR-193 (10/09, chủ dự án nhắn thật): "bán căn ho ở Hà đô centrosa garden"
      // → bot đáp "Em ghi nhận: bán · Quận 5". Không ai nói Quận 5 cả; "Quận 5" là
      // giá trị mặc định của cột `listings.district` từ thời chỉ làm chợ Quận 5.
      // Cột vẫn NOT NULL nên DB vẫn nhận mặc định, nhưng lời NÓI với khách chỉ được
      // nhắc địa bàn khi ĐỌC ĐƯỢC thật (từ câu rao hoặc từ dự án khớp trong kho).
      // 11/09/2026 (42 ca): "bán nhà ở Hà Nội quận Cầu Giấy" từng thành tin QUẬN 5.
      // Vùng xa → nói thật là chưa nhận, không mở tin. Vùng lân cận → quận ghi đúng
      // tên tỉnh.
      const quanAi = aiRao?.quan ?? null;
      const vung = quanAi || bocQuan(tKD, text) || duAn?.district ? null : vungNgoai(tKD);
      if (vung?.xa) {
        return await traLoiSeller([
          `Dạ bên em hiện chỉ nhận nhà ở Sài Gòn và Long An thôi ạ, em xin lỗi chưa hỗ trợ được căn ở ${vung.ten}.`,
        ], { ngoai_dia_ban: vung.ten });
      }
      const quanDoc = quanAi ?? bocQuan(tKD, text) ?? duAn?.district ?? vung?.ten ?? null;
      // 17/09/2026 (chủ dự án: "chỗ nào cứ mặc định quận 5 xóa sạch đi", 20260917a): chưa rõ
      // quận thì ĐỂ TRỐNG — bot hỏi "phường mấy, quận nào", hoặc suy từ phường / dự án.
      const quanRao: string | null = quanDoc ?? null;
      // 23/09/2026 (bắn thật, môi giới): "còn căn B 2pn 80m2 giá 7 tỷ 1 nữa em ơi" sau căn A The Everrich —
      // tin mới mở "BĐS bán · (chưa rõ quận)", mất loại, quận, dự án. Căn THÊM của cùng lô (còn/thêm căn, nữa)
      // mà câu không tự nói nơi chốn hay loại → kế thừa loại + quận của tin gần nhất; dự án (và phường của
      // dự án) chỉ khi tin đó là căn hộ. Địa chỉ nhà phố KHÔNG kế thừa — căn nhà khác là địa chỉ khác.
      let loCu: { property_type: string | null; district: string | null; ward: string | null; project_id: string | null } | null = null;
      if (!quanRao && !phuongRao && !duAn && !aiRao?.loaiBds && /\b(?:con|them)\s+(?:(?:mot|1)\s+)?(?:can|lo)\b|\bnua\b/.test(tKD)) {
        const { data: lc, error: lcErr } = await client.from("listings").select("property_type, district, ward, project_id")
          .eq("seller_id", sellerRow.id).in("status", ["cho_thong_tin", "dang_ban", "dang_quan_tam"])
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (lcErr) await ghiLoi(client, "chat-reply ke thua lo", lcErr.message);
        loCu = lc ?? null;
      }
      const loCanHo = loCu?.property_type === "chung_cu" && !!loCu.project_id;
      const dongTin = {
        code: null, seller_id: sellerRow.id, deal: sDeal, district: quanRao ?? loCu?.district ?? null,
        ward: phuongRao ?? duAn?.ward ?? (loCanHo ? loCu!.ward : null),
        description: text, price_raw: giaGhi,
        property_type: aiRao?.loaiBds ?? (loCu?.property_type && loCu.property_type !== "chua_ro" ? loCu.property_type : "chua_ro"),
        status: "cho_thong_tin",
        gap: gapCol,
        // FR-177 d: tin từ chat chỉ lên kệ khi đủ điểm VÀ chủ nhà gật bản nháp.
        can_chu_duyet: true,
        ...(duAn
          ? {
            project_id: duAn.id, unit_code: maCanRao, unit_status: "con_ban",
            last_confirmed_at: new Date().toISOString(),
          }
          : loCanHo
          ? { project_id: loCu!.project_id, unit_code: null as string | null, unit_status: "con_ban", last_confirmed_at: new Date().toISOString() }
          : {}),
      };
      let { data: newLst, error: newLstErr } = await client.from("listings").insert(dongTin)
        .select("id, code, property_type").single();
      // 14/09/2026 (bắn lại 14 tin bán): căn S1.02 Vinhomes Grand Park đã có trong kho (lượt
      // trước) → `listings_project_unit_uniq` chặn → tin MẤT, chủ nhà nhận câu chào khuôn như
      // chưa từng rao. Hai người rao cùng một căn là chuyện thường (chủ + môi giới, hai môi
      // giới) — vẫn tạo tin, bỏ mã căn trùng, ghi lại trong boc_tach để admin gộp.
      let maCanTrung: string | null = null;
      if (newLstErr?.code === "23505" && /listings_project_unit_uniq/.test(newLstErr.message) && dongTin.unit_code) {
        maCanTrung = dongTin.unit_code;
        ({ data: newLst, error: newLstErr } = await client.from("listings").insert({ ...dongTin, unit_code: null })
          .select("id, code, property_type").single());
      }
      // Tạo tin hỏng mà đi tiếp là NUỐT MẤT CÂU RAO: chủ nhà nhận một câu chăm
      // sóc chung chung ở nhánh dưới, tưởng đã rao xong, còn kho thì không có
      // gì. Vào sổ rồi mới đi tiếp (FR-152).
      if (newLstErr) {
        await ghiLoi(client, "chat-reply tao tin rao", newLstErr.message);
      }
      if (newLst) {
        // FR-177 h: bóc được gì thì LƯU NGAY dạng JSON (ghi_boc_tach bỏ null),
        // trước khi bàn tới cột nào có hay chưa. Fact chủ nhà trả lời sau này
        // trigger trg_zz_fact_vao_boc_tach gộp vào cùng chỗ.
        const { error: btErr } = await client.rpc("ghi_boc_tach", {
          p_listing_id: newLst.id,
          p: {
            // 11/09/2026 (Zalo thật): "sao cái nào cũng ghi Q5" — quận không đọc được thì
            // cột vẫn nhận mặc định Quận 5 (NOT NULL), nhưng boc_tach nói rõ đó là MẶC
            // ĐỊNH; bong bóng 💾 in "(chưa rõ quận)" và câu hỏi đầu hỏi thêm quận.
            nguon: aiRao ? "cau_rao+ai_chinh" : "cau_rao", loai_giao_dich: sDeal, quan: quanDoc, ...(quanDoc ? {} : { quan_mac_dinh: true }),
            phuong: phuongRao,
            gia_raw: priceM?.[1]?.trim() ?? null, ...(giaM2 ? { gia_m2: giaM2 } : {}),
            dien_tich: areaM ? `${areaM[1].replace(",", ".")}m2` : null,
            so_phong_ngu: pnM ? Number(pnM[1]) : null,
            gap: gapCol, du_an: duAn?.name ?? null, ma_can: maCanRao, ...(maCanTrung ? { ma_can_trung_tin_khac: maCanTrung } : {}),
            du_an_chua_co: duAn ? null : tenDuAnTrongCau(text),
            co_anh_kem: imageUrl ? true : null,
          },
        });
        if (btErr) await ghiLoi(client, "chat-reply ghi_boc_tach(rao)", btErr.message);
        // Diện tích / phòng ngủ đã nói trong câu rao → vào fact ngay, trước khi
        // hỏi câu nhỏ giọt đầu tiên (view thiếu-thông-tin đọc cột đã sync).
        // Vị trí cụ thể đã nói trong câu rao ("hẻm trần bình trọng", "đường
        // Nguyễn Trãi", "123/4 An Dương Vương") → fact vi_tri ngay, khỏi hỏi
        // lại thứ chủ nhà vừa nói (FR-144). Giữ nguyên chữ có dấu của người gõ.
        // 10/09 lần 7: hai hình địa chỉ THẬT bị bỏ sót, nên bot hỏi lại địa chỉ
        // vòng vòng dù chủ nhà đã nói ngay câu đầu — "hẻm 100 Nguyễn Trãi" (có số
        // nhà sau chữ hẻm) và "7 Hồng Bàng phường 12" (số nhà trần, không có chữ
        // hẻm/đường). Mẫu 1 nay cho phép số nhà; mẫu 2 bắt số nhà trần nhưng CHỈ
        // khi ngay sau là phường/quận, để "5 tỷ" hay "40m2" không thành địa chỉ.
        // 12/09/2026 (bắn 20 tin thật): luật bóc vị trí chuyển sang
        // `bocViTriRao` — bản cũ vứt nguyên cụm khi sau "hẻm/đường" là chữ tả
        // đường, nên "hẻm xe hơi 5m NGUYỄN TRÃI" mất sạch và 7/7 tin của lượt
        // bắn không có địa chỉ, bot hỏi vòng vòng, bản nháp không bao giờ bung.
        // 22/09/2026 (bắn thật sau deploy #181): AI trả tên đường trần "Trần Hưng Đạo", luật trả "hẻm 6m 12
        // Trần Hưng Đạo" — số nhà rơi vì AI đứng trước. Bản chứa bản kia mà dài hơn thì thắng (`chonViTri`).
        const viTriTho = aiRao ? chonViTri(bocViTriRao(text), aiRao.duong) : bocViTriRao(text);
        // FR-212: đối chiếu tên đường với từ điển `duong` — không dấu → có dấu ngay; sai 1–2 ký tự → gợi ý, hỏi ở câu đầu.
        const duongRao = viTriTho ? await suaTenDuong(viTriTho, quanDoc) : null;
        const viTriRao = duongRao?.viTri ?? viTriTho;
        // FR-177 n (10/09): câu rao DÀI mang 5–10 thông số → bóc HẾT ngay lúc tạo tin
        // (hướng, pháp lý, WC, nội thất, năm xây, hẻm thông, ngập, cách mặt tiền, lý do
        // bán, thương lượng…), không bắt chủ nhà nói lại. Giá/gấp đã vào cột lúc insert.
        // Tên dự án kho CHƯA CÓ: giữ lại làm fact của tin để những lượt sau còn
        // biết chủ nhà đang nói về dự án nào (FR-195).
        const tenLa = duAn ? null : aiRao ? aiRao.duAn : tenDuAnTrongCau(text);
        const daCo = new Set(["gia", "gap", "phuong", "dien_tich", "dien_tich_dat", "so_phong_ngu", "vi_tri", "bo_sung", "du_an_ten", "loai_giao_dich", "loai_bds"]);
        const factRao: Array<[string, string]> = (aiRao
          ? [...aiRao.ghi, ...nhanDienNhieuFact(text).filter((f) => !KHOA_FACT_AI_BIET.has(f.question))]
          : nhanDienNhieuFact(text))
          .filter((f) => !daCo.has(f.question))
          .map((f) => [f.question, f.answer] as [string, string]);
        for (const [k, v] of [
          ["vi_tri", viTriRao && viTriRao.length >= 6 && !/^(hẻm|hem|hxh)\s+\d+\s*(m|mét|met)?$/i.test(viTriRao) ? viTriRao : null],
          ["dien_tich", areaM ? `${areaM[1].replace(",", ".")}m2` : null],
          ["so_phong_ngu", pnM ? pnM[1] : null],
          ["du_an_ten", tenLa],
          ...factRao,
        ] as Array<[string, string | null]>) {
          if (!v) continue;
          const { error: fErr } = await client.rpc("ghi_fact_listing", {
            p_listing_id: newLst.id, p_question: k, p_answer: v, p_source: "seller_chat",
          });
          if (fErr) await ghiLoi(client, `chat-reply ghi_fact_listing(rao:${k})`, fErr.message);
        }
        // Ảnh gửi kèm câu rao → là ảnh của chính căn vừa tạo (FR-185: vào kho).
        await nhanAnh(newLst.id);
        // Tin nháp vẫn phải tạo (không được đánh rơi câu rao), nhưng người thật
        // đang cầm cuộc thì không hỏi, không nói.
        if (humanActive) {
          return await traLoiSeller([], { listing_code: newLst.code });
        }
        // FR-177 a: câu đầu bám theo điều câu rao vừa nói (phường → hỏi diện
        // tích, diện tích → hỏi giá…), trong nhóm cơ bản.
        const { data: firstFacts } = await client.from("listing_missing_facts")
          .select("fact_key, nhom").eq("listing_id", newLst.id).order("priority").limit(8);
        const vuaRao = [phuongRao ? "phuong" : "", areaM ? "dien_tich" : "", priceM ? "gia" : ""].filter(Boolean);
        const firstKey = chonCauKe(vuaRao, (await thieuCoReNhanh(client, newLst.id, firstFacts)).filter((f) => f.nhom !== "sau_dang")) ?? null;
        if (firstKey) {
          const { error: ir1Err } = await client.from("info_requests").insert({
            listing_id: newLst.id, question: firstKey, status: "pending",
          });
          if (ir1Err && ir1Err.code !== "23505") {
            await ghiLoi(client, "chat-reply mo cau hoi dau", ir1Err.message);
          }
        }
        // OPEN-30: tin rao ĐÃ tạo xong (mã đã cấp) — model chỉ soạn lời chào.
        // Model hỏng thì chào bằng câu mẫu, kèm luôn câu hỏi đầu nếu có.
        // 11/09/2026 (42 ca): lý do "để em kiểm tra giá khu vực" chỉ nói ở lần hỏi
        // địa chỉ ĐẦU (câu mẫu `vi_tri@lan_dau`); các lần hỏi lại dùng câu ngắn —
        // khuôn 25 từ kèm lý do từng lặp nguyên văn 22/52 câu bot.
        const loaiMoi = (newLst as { property_type?: string | null }).property_type;
        // 11/09/2026 (Zalo thật): câu rao không nói quận → hỏi địa chỉ KÈM quận, để
        // tin không nằm lại Quận 5 mặc định (mã tin đi theo quận: migration 20260911f).
        // FR-209: câu rao có tên đường mà không có quận → tra phường mới, hỏi xác nhận.
        // FR-212: tên đường gõ sai 1–2 ký tự → câu hỏi đầu là XÁC NHẬN tên đường (đứng trước gợi ý phường).
        const cauDuongDau = duongRao?.goiY && newLst ? await cauHoiDuongGoiY(newLst.id, duongRao.goiY, cachGoi) : null;
        // 25/09/2026: câu rao ĐÃ có quận cũng tra (bảng `duong` trong quận đó) — `cauHoiPhuongGoiY` tự chọn đường tra.
        const goiYDau = !cauDuongDau && firstKey === "phuong" && viTriRao && newLst
          ? await cauHoiPhuongGoiY(newLst.id, tenDuong(viTriRao), cachGoi)
          : null;
        const cauXacNhanDau = cauDuongDau ?? goiYDau;
        const cauHoiDau = cauDuongDau ?? goiYDau ?? (firstKey
          // 12/09/2026: tin ở HUYỆN / thị xã / tỉnh lân cận thì đơn vị dưới là XÃ —
          // hỏi "thuộc phường mấy" cho đất Củ Chi là lộ ra máy đọc mẫu câu.
          ? (firstKey === "phuong" && laNgoaiDoThi(quanDoc)
            ? cauHoiMau("phuong@huyen", cachGoi, loaiMoi)
            : !quanDoc && (firstKey === "vi_tri" || firstKey === "phuong")
            ? cauHoiMau(firstKey === "phuong" ? "phuong@chua_quan" : "vi_tri@chua_quan", cachGoi, loaiMoi)
            : firstKey === "vi_tri" && loaiMoi !== "chung_cu" && loaiMoi !== "dat"
            ? cauHoiMau("vi_tri@lan_dau", cachGoi, loaiMoi)
            : cauHoiMau(firstKey, cachGoi, loaiMoi, quanDoc, sDeal, viTriRao))
          : null);
        // 15/09/2026 (bắn thật P1): câu rao kèm hỏi ngược ("…, mà bên em là bot hả?") —
        // trước đây câu hỏi bị nuốt. Có đáp án hệ thống (bot / phí / ảnh) thì bong bóng
        // tiền định đứng trước; không thì dặn model trả lời trước rồi mới hỏi.
        const hoiRao = tachCauHoiNguoc(text).hoi;
        const dapRao = hoiRao ? dapHoiNguocTienDinh(hoiRao, cachGoi, phiCauSeller) : null;
        const hoiRaoPrompt = hoiRao
          ? dapRao
            ? `Chủ nhà còn hỏi "${hoiRao}" — hệ thống ĐÃ trả lời ở bong bóng trước; em KHÔNG trả lời lại. `
            : `Chủ nhà còn hỏi: "${hoiRao}". TRẢ LỜI câu đó trước bằng một câu ngắn, thật thà (chưa nắm thì "em kiểm tra rồi báo lại"), rồi mới hỏi. `
          : "";
        let raoReply: string | null = null;
        if (anthropicS) {
          try {
            const r1 = await anthropicS.messages.create({
              model: MODEL, max_tokens: 512,
              output_config: { effort: "low" },
              system: [{ type: "text", text: SELLER_SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: DONG_TEN }],
              messages: [{
                role: "user",
                content:
                  `${boiCanh}Chủ nhà vừa nhắn rao: "${text}". Em đã tạo tin. ${hoiRaoPrompt}` +
                  `Viết MỘT tin ngắn như người thật nhắn Zalo: nhận câu rao (${khenGanDay ? "KHÔNG khen, không nhận xét — mấy tin gần đây em đã khen rồi" : "nếu câu rao có gì đáng khen thật thì khen đúng một ý, không thì thôi"}). Hệ thống VỪA gửi một bong bóng liệt kê thông số đã ghi - KHÔNG lặp lại số liệu, không xác nhận lại địa điểm` +
                  (cauXacNhanDau
                    // 25/09/2026 (bắn thật lx-05): câu gợi ý "thuộc Phường Bến Thành hay Phường Cầu Ông Lãnh" bị model nói lại
                    // thành "phường nào vậy ạ?" — rơi mất lựa chọn. Câu xác nhận / chọn do CODE tra ra thì gửi NGUYÊN VĂN
                    // ngay sau; model chỉ nhận câu rao, không hỏi gì.
                    ? `. KHÔNG hỏi gì (hệ thống tự gửi câu hỏi xác nhận ngay sau). KHÔNG nhắc phí, KHÔNG nhắc mã tin, KHÔNG nhận xét giá.`
                    : firstKey
                    ? `, rồi hỏi thứ quan trọng nhất còn thiếu: ${FACT_LABELS[firstKey] ?? firstKey}. Câu gợi ý: "${cauHoiDau}" — nói lại cho tự nhiên, hợp với loại nhà này; ý hỏi chính là ${FACT_LABELS[firstKey] ?? firstKey}, đừng gắn thêm ý khác vào câu hỏi (hệ thống ghi câu trả lời kế vào ô này). KHÔNG nhắc phí, KHÔNG nhắc mã tin, KHÔNG nhận xét giá.`
                    : ` và báo sẽ đăng lên web ngay.`),
              }],
            });
            raoReply = r1.content.find((b) => b.type === "text")?.text?.trim() ?? null;
            if (raoReply && laLoiMeta(raoReply)) { console.log("chat-reply: r1 tra loi cau lenh, bo"); raoReply = null; }
            if (raoReply) raoReply = motCauHoi([raoReply])[0];
            // 23/09/2026 (bắn thật): "hẻm 2m5 … rất được khách tìm", "ô tô đậu trước cửa" → "ô tô vào tận nhà".
            if (raoReply) raoReply = boMenhDeKhenSai([raoReply], text)[0] ?? null;
            // 25/09/2026 (bắn thật lx-08): tin vừa tạo luôn `cho_thong_tin` (chờ đủ thông tin + chủ duyệt nháp) mà model
            // viết "đã đăng lên web rồi" → bỏ mệnh đề đó. Câu hỏi model lệch khoá code chọn → thay bằng câu mẫu.
            if (raoReply) raoReply = boHuaDaDang([raoReply])[0] ?? null;
            if (raoReply && !cauXacNhanDau && firstKey && cauHoiDau) raoReply = thayCauHoiLech(raoReply, firstKey, cauHoiDau);
            await doTien(client, r1.usage);
          } catch (e) {
            await ghiLoi(client, "chat-reply model r1(seller)", e);
          }
        }
        if (!raoReply) {
          raoReply = `Dạ em nhận tin rao rồi ạ.` +
            (cauHoiDau ? ` ${cauHoiDau}` : ` Em sẽ đăng lên web ngay ạ.`);
        } else if (cauXacNhanDau) {
          // Model đã bị dặn không hỏi; lỡ còn câu hỏi thì cắt, rồi nối câu xác nhận nguyên văn.
          raoReply = `${raoReply.replace(/[^.!?]*\?\s*$/u, "").trim()} ${cauXacNhanDau}`.trim();
        }
        if (dapRao) raoReply = `${dapRao}\n${raoReply}`;
        // Chủ dự án 09/09/2026: "đã bóc tách được cái gì, viết gửi lại cho khách
        // luôn" — bong bóng TIỀN ĐỊNH liệt kê những gì vừa ghi (không liệt kê
        // thứ trống), đứng trước lời chào/câu hỏi của model. Số liệu đúng từng
        // chữ với cột, chủ nhà thấy sai thì sửa ngay (FR-164 bắt lời sửa).
        const LOAI_GHI: Record<string, string> = {
          nha_pho: "nhà phố", nha_cap4: "nhà cấp 4", chung_cu: "căn hộ", dat: "đất",
          biet_thu: "biệt thự", phong_tro: "phòng trọ", mat_bang: "mặt bằng",
          toa_nha: "toà nhà / CHDV", dat_nong_nghiep: "đất nông nghiệp", dat_kinh_doanh: "đất kinh doanh", kho_xuong: "kho xưởng",
        };
        const loaiRao = LOAI_GHI[(newLst as { property_type?: string | null }).property_type ?? ""] ?? null;
        const ghiNhan = [
          `${sDeal === "cho_thue" ? "cho thuê" : "bán"}${loaiRao ? ` ${loaiRao}` : ""}`,
          viTriRao && viTriRao.length >= 6 ? viTriRao : null,
          [phuongRao, quanDoc].filter(Boolean).join(", ") || null,
          areaM ? (/x/.test(areaM[1]) ? `${areaM[1]}m` : `${areaM[1].replace(",", ".")}m2`) : null,
          pnM ? `${pnM[1]} phòng ngủ` : null,
          giaNoi ? `giá ${giaNoi}` : null,
          gapCol === true ? "cần gấp" : gapCol === false ? "không gấp" : null,
          duAn?.name ? `dự án ${duAn.name}${maCanRao ? ` căn ${maCanRao}` : ""}` : null,
        ].filter((x): x is string => !!x);
        // Khách mở lời bằng câu chào thì chào lại rồi mới ghi nhận — bong bóng này
        // là tiền định (đi TRƯỚC câu của model), nên nếu nó vào thẳng "Em ghi nhận"
        // thì cả đoạn mở đầu đọc như máy, kể cả lúc model còn sống.
        const khachChao = /^\s*(dạ\s*)?(xin\s*)?(chào|chao|hi|hello|alo|a lô|hế lô)\b/i.test(text);
        // 21/09/2026 (bắn thật mau-tdt): "Dạ em chào anh ạ!" (tiền định) + "Chào anh, em R•ai bên…" (model) là
        // chào HAI LẦN. Câu của model ĐÃ có lời chào thì thôi chào tiền định; model không chào / hỏng thì chào.
        const modelDaChao = /(?<![\p{L}])(chào|xin chào|hello)(?![\p{L}])/iu.test(raoReply ?? "");
        const bongGhiNhan =
          (khachChao && !modelDaChao ? cauTD("chao_lai") + "\n" : "") +
          cauTD("ghi_nhan", { ds: ghiNhan.join(" · ") });
        return await traLoiSeller([bongGhiNhan, raoReply], { listing_code: newLst.code, ghi_nhan: ghiNhan });
      }
    }
    // Seller nhắn nhưng KHÔNG có câu chờ → vẫn trả lời ĐÚNG VAI người bán
    // (trước đây rơi xuống luồng mua → bot hỏi "anh tìm khu nào" với chính chủ nhà)
    // Không có câu chờ mà người thật đang cầm cuộc → im, khỏi tốn lượt model.
    if (humanActive) return await traLoiSeller([]);

    // 09/09 tối lần 3: KHÔNG có câu chờ mà chủ nhà vẫn nhắn thông số ("sổ đỏ,
    // đất thuê nhà nước tới 2058") → trước đây rơi xuống chăm sóc chung, fact BAY
    // MẤT. Nay: ghi mọi fact nhận ra vào căn đang neo (tin mới nhất chưa chốt), và
    // nếu tin chưa lên kệ thì mở luôn câu kế (tiền định) thay vì tán gẫu.
    // 21/09/2026 chế độ `chinh`: AI đọc trước cả ở đây (thông số rơi ngoài câu chờ).
    let factRoi: Array<{ question: string; answer: string }> = wantsSell ? [] : nhanDienNhieuFact(text).filter((f) => f.question !== "bo_sung");
    if (!wantsSell && bongAi && cheDoBocAi && (await cheDoBocAi) === "chinh") {
      const kqAi = await bongAi;
      if (kqAi?.ket) {
        const ai = docAiChinh(kiemDeXuat(kqAi.truong, text).dat, null);
        factRoi = [...ai.ghi, ...factRoi.filter((f) => !KHOA_FACT_AI_BIET.has(f.question))];
      }
    }
    if (factRoi.length) {
      const { data: canNeo } = await client.from("listings")
        .select("id, code, status, can_chu_duyet, chu_duyet_at, property_type, district, deal")
        .eq("seller_id", sellerRow.id).in("status", ["cho_thong_tin", "dang_ban"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (canNeo) {
        for (const f of factRoi) {
          const { error: frErr } = await client.rpc("ghi_fact_listing", {
            p_listing_id: canNeo.id, p_question: f.question, p_answer: f.answer, p_source: "seller_chat",
          });
          if (frErr) await ghiLoi(client, "chat-reply ghi_fact_listing(roi)", frErr.message);
        }
        const daGhi = factRoi.map((f) => `${FACT_LABELS[f.question] ?? f.question}`).join(", ");
        if (canNeo.status === "cho_thong_tin" || (canNeo.can_chu_duyet && !canNeo.chu_duyet_at)) {
          const [{ data: thieuRoi }, { data: hetHanRoi }] = await Promise.all([
            client.from("listing_missing_facts").select("fact_key, priority, nhom").eq("listing_id", canNeo.id).order("priority").limit(12),
            client.from("info_requests").select("question").eq("listing_id", canNeo.id).eq("status", "expired"),
          ]);
          const hh = new Set((hetHanRoi ?? []).map((q) => q.question));
          const keRoi = chonCauKe(factRoi.map((f) => f.question), (await thieuCoReNhanh(client, canNeo.id, thieuRoi, factRoi.map((f) => f.question), text)).filter((f) => !hh.has(f.fact_key) && f.nhom !== "sau_dang"));
          if (keRoi && keRoi !== "hinh_anh") {
            const { error: irRoi } = await client.from("info_requests").insert({ listing_id: canNeo.id, question: keRoi, status: "pending" });
            if (irRoi && irRoi.code !== "23505") await ghiLoi(client, "chat-reply mo cau ke(roi)", irRoi.message);
            return await traLoiSeller([`Dạ em ghi ${daGhi} rồi ạ.\n${cauHoiMau(keRoi, cachGoi, canNeo.property_type, canNeo.district, canNeo.deal)}`], { saved_fact: factRoi.map((f) => f.question), asked: keRoi });
          }
          const nhapRoi = await guiBanNhap(canNeo.id, { saved_fact: factRoi.map((f) => f.question) });
          if (!Array.isArray(nhapRoi)) return nhapRoi;
        }
        return await traLoiSeller([`Dạ em ghi ${daGhi} vào tin rồi ạ. Có khách quan tâm là em báo ${cachGoi} liền.`], { saved_fact: factRoi.map((f) => f.question) });
      }
    }

    // FR-183 b (10/09): chủ nhà nói "đủ thông tin rồi" ngoài vòng hỏi — đó là
    // lời CHỐT, không phải câu chăm sóc chung. Đóng dấu `chu_noi_du_at`, đọc lại
    // điểm rồi trả lời đúng việc: rao như vậy, điểm bao nhiêu, muốn thêm điểm
    // thì gửi gì. Trước bản này rơi vào câu mẫu "em kiểm tra rồi báo lại".
    if (laDuRoi(text)) {
      const { data: tinChot } = await client.from("listings")
        .select("id, code, status")
        .eq("seller_id", sellerRow.id)
        .in("status", ["dang_ban", "dang_quan_tam", "cho_thong_tin"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (tinChot) {
        const luc = new Date().toISOString();
        const { error: duErr } = await client.from("listings")
          .update({ chu_noi_du_at: luc, ...(tinChot.status === "cho_thong_tin" ? { chu_duyet_at: luc } : {}) })
          .eq("id", tinChot.id);
        if (duErr) await ghiLoi(client, "chat-reply chu noi du roi", duErr.message);
        const { data: dk } = await client.rpc("diem_tin", { p_listing_id: tinChot.id });
        const d = dk as { diem?: number; thieu?: string[] } | null;
        const thieu = (d?.thieu ?? []).slice(0, 2);
        return await traLoiSeller([
          [
            cauTD("du_roi"),
            cauTD("du_roi_diem", { diem: d?.diem }),
            thieu.length ? cauTD("du_roi_them", { thieu: thieu.join(" và ") }) : "",
            cauTD("du_roi_dong"),
          ].filter(Boolean).join("\n"),
        ], { du_roi: true, diem: d?.diem ?? null });
      }
    }

    const { data: sellerLst } = await client.from("listings")
      .select("code, location_raw, ward, price_raw")
      .eq("seller_id", sellerRow.id)
      .order("created_at", { ascending: false }).limit(5);
    const lstLines = (sellerLst ?? [])
      .map((l) => `${l.location_raw ?? "(chưa rõ địa chỉ)"} ${l.ward ?? ""} · ${l.price_raw ?? "?"}`)
      .join("\n");
    // OPEN-30: chăm sóc chung — model hỏng thì ghi nhận bằng câu mẫu.
    let sReply: string | null = null;
    if (anthropicS) {
      try {
        const r3 = await anthropicS.messages.create({
          model: MODEL, max_tokens: 512,
          output_config: { effort: "low" },
          system: [{ type: "text", text: SELLER_SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: DONG_TEN }],
          messages: [{
            role: "user",
            content:
              `${boiCanh}NGƯỜI BÁN${sellerRow.name ? ` (${sellerRow.name})` : ""} đang rao các tin:\n${lstLines || "(chưa có tin đang rao)"}\n\n` +
              (sellerMoi
                ? `Người này VỪA cho biết đang có bất động sản muốn rao nhưng chưa nói chi tiết. Soạn MỘT tin NGẮN chào + mời họ nhắn địa chỉ (đường/phường), giá mong muốn và diện tích để em lên tin - KHÔNG hỏi nhu cầu mua nhà, KHÔNG nhắc phí hay chính chủ/môi giới (hệ thống đã báo riêng ngay sau tin này).`
                : `Họ vừa nhắn: "${textOrTag}". Soạn MỘT tin trả lời NGẮN đúng vai chăm sóc NGƯỜI BÁN - tuyệt đối KHÔNG hỏi nhu cầu mua nhà. ` +
                  `Không bịa tình trạng tin/lượt khách quan tâm; điều chưa nắm thì nói "để em kiểm tra rồi báo lại anh/chị liền".`),
          }],
        });
        sReply = r3.content.find((b) => b.type === "text")?.text?.trim() ?? null;
        await doTien(client, r3.usage);
      } catch (e) {
        await ghiLoi(client, "chat-reply model r3(seller)", e);
      }
    }
    return await traLoiSeller([
      sReply ??
        (sellerMoi
          ? "Dạ em chào anh/chị! Anh/chị nhắn giúp em địa chỉ (đường/phường), giá mong muốn và diện tích căn nhà để em lên tin nha."
          : "Dạ em ghi nhận rồi ạ, em kiểm tra rồi báo lại anh/chị liền nha."),
    ]);
  }

  // Nhớ người trò chuyện (FR-21/26) + hồ sơ nhu cầu (FR-130).
  // Get-or-create buyer + conversation qua RPC advisory-lock (FR-131 —
  // 3 tin gõ vụn đến đồng thời không được tạo trùng buyer/conversation).
  danhDau("mua_vao");
  const { data: bc, error: bcErr } = await client
    .rpc("ensure_buyer_conversation", {
      p_zalo_user_id: externalUserId,
      p_channel: channel,
    }).single();
  if (bcErr || !bc) {
    const detail = bcErr?.message ?? "ensure_buyer_conversation";
    return await baoHong({ error: detail }, 500, detail);
  }
  // Kiểu khớp RETURNS TABLE của `ensure_buyer_conversation` (schema.sql).
  const bcRow = bc as unknown as {
    b_id: string; b_name: string | null; c_id: string; b_prefs: Record<string, unknown> | null;
    c_ctv_id: string | null; c_human_touch_at: string | null; c_human_hold: boolean | null;
  };
  const buyer = { id: bcRow.b_id, name: bcRow.b_name };
  const convId = bcRow.c_id;
  const prefs: Record<string, unknown> = bcRow.b_prefs ?? {};
  // FR-211 (18/09/2026): khách MUA nói ý có nhãn ("yên tĩnh", "gần chợ", "xe hơi vào nhà") → nhớ vào hồ
  // sơ (`preferences.nhan`) và lọc kho bằng contains — cùng từ điển với phía bán (`ganNhan`).
  const nhanMuon = ganNhan(text);
  const nhanLoc = [...new Set([...(Array.isArray(prefs.nhan) ? (prefs.nhan as string[]) : []), ...nhanMuon])];
  // Hai cột của hội thoại mà cổng nhường sân (FR-141) và các việc báo CTV cần
  // — RPC trả luôn từ 20260902d, khỏi SELECT `conversations` lần nữa (FR-171 h).
  const convRow = {
    ctv_id: bcRow.c_ctv_id ?? null,
    human_touch_at: bcRow.c_human_touch_at ?? null,
    human_hold: bcRow.c_human_hold === true,
  };

  // Dedupe theo msg_id (retry không tạo tin đôi)
  const { data: insMsg, error: msgErr } = await client.from("messages").insert({
    conversation_id: convId, sender: "buyer",
    body: imageUrl ? `${textOrTag} [ảnh: ${imageUrl}]` : text,
    zalo_msg_id: msgId,
  }).select("seq").single();
  if (msgErr?.code === "23505" && !(coSo && soAttempts > 1)) {
    // Trùng từ THỜI TRƯỚC SỔ — lượt cũ đã trả lời rồi, đừng trả lời lần hai.
    // Chốt sổ completed-rỗng để retry sau không quay lại đây.
    return await hoanTat({ reply: null, replies: [], deduped: true });
  }
  if (msgErr && msgErr.code !== "23505") {
    return await baoHong({ error: msgErr.message }, 500, msgErr.message);
  }
  // 23505 khi soAttempts > 1: lượt trước của chính msg_id này chết giữa chừng,
  // tin khách ĐÃ nằm trong messages — lấy lại seq dòng cũ (check nhường-lượt
  // FR-131 bên dưới cần nó) rồi đi tiếp trả lời nốt, đừng nuốt.
  let insMsgSeq = insMsg?.seq ?? null;
  if (insMsgSeq == null && msgId) {
    const { data: cu } = await client.from("messages").select("seq")
      .eq("zalo_msg_id", msgId).maybeSingle();
    insMsgSeq = cu?.seq ?? null;
  }
  // (`last_message_at` do trigger trên `messages` đẩy — 20260902d.)

  // FR-141: người thật nhắn tay trong 30 phút gần đây → bot im, chỉ ghi log
  // tin khách; người thật ngừng đủ lâu thì bot tự tiếp chuyện lại.
  if (convRow.human_hold || (convRow.human_touch_at &&
      Date.now() - Date.parse(convRow.human_touch_at) < 30 * 60e3)) {
    return await hoanTat({ reply: null, replies: [], human_active: true, human_hold: convRow.human_hold });
  }

  // MỘT lượt đọc `messages` cho bốn việc từng là bốn truy vấn nối đuôi
  // (FR-171 h): trần 24h (FR-146), nhường lượt (FR-131), "tin đầu tiên?"
  // (FR-159) và lịch sử cho model. Lịch sử 12 tin mới nhất theo `seq` giảm dần
  // — đúng thứ tự identity DB cấp, không hoà.
  const [{ count: msg24h }, { data: lichSu }] = await Promise.all([
    client.from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", convId).in("sender", ["buyer", "seller"])
      .gte("created_at", new Date(Date.now() - 24 * 3600e3).toISOString()),
    client.from("messages").select("sender, body, seq")
      .eq("conversation_id", convId).order("seq", { ascending: false }).limit(12),
  ]);
  const history = (lichSu ?? []) as Array<{ sender: string; body: string; seq: number }>;

  // FR-146: trần 100 tin/24h mỗi khách. Chống người ta lấy anon key gọi thẳng
  // function đốt tiền model; khách thật nhắn nhiều đến mức này thì cũng nên có
  // người thật vào. Chạm trần: trả lời MỘT lần + báo CTV/admin, sau đó im.
  const DAILY_LIMIT = 100;
  if ((msg24h ?? 0) > DAILY_LIMIT) {
    const { count: quotaEsc } = await client.from("reminders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_id", buyer.id).eq("kind", "escalation")
      .gte("created_at", new Date(Date.now() - 24 * 3600e3).toISOString());
    if ((quotaEsc ?? 0) > 0) {
      // đã báo rồi → im tới hết ngày, không tốn thêm lượt model nào
      return await hoanTat({ reply: null, replies: [], rate_limited: true });
    }
    const capMsg =
      "Dạ hôm nay mình trao đổi nhiều rồi, để em nhờ anh/chị phụ trách nhắn lại trực tiếp cho mình nha!";
    await client.from("messages").insert({
      conversation_id: convId, sender: "bot", body: capMsg,
    });
    await client.from("conversations").update({
      needs_human: true, needs_human_at: new Date().toISOString(),
    }).eq("id", convId);
    await client.from("reminders").insert({
      kind: "escalation", buyer_id: buyer.id,
      ctv_id: convRow.ctv_id,
      due_at: new Date().toISOString(),
      note: `khách nhắn hơn ${DAILY_LIMIT} tin trong 24h, bot tạm dừng trả lời. Anh/chị vào xem giúp`,
    });
    return await hoanTat({ reply: capMsg, replies: [capMsg], rate_limited: true });
  }

  // FR-131: KHÔNG delay nhân tạo (quyết định chủ dự án 25/08 — "càng nhanh càng
  // tốt"). Chỉ giữ check nhường-lượt: tin mới hơn của cùng khách đã vào trong
  // lúc xử lý thì lượt này im, lượt của tin cuối trả lời trên ngữ cảnh gộp.
  // "Tin mới nhất" xếp theo `seq` (identity DB cấp, không bao giờ hoà) chứ
  // không theo `created_at` — hai tin cùng mili-giây là created_at bốc thăm.
  // Lượt này vẫn xử lý ĐÚNG tin của nó (insMsgSeq), không lấy "tin mới nhất"
  // làm danh tính; câu này chỉ quyết định NHƯỜNG hay không. Tin mới nhất của
  // khách nằm ngay trong 12 tin vừa nạp (nạp SAU khi chèn tin này).
  const tinKhach = history.filter((m) => laTinNguoi(m.sender));
  const newest = tinKhach[0] ?? null;
  if (newest && insMsgSeq != null && newest.seq > insMsgSeq) {
    // Completed-rỗng là ĐÚNG cả với sổ: tin này được lượt của tin cuối trả lời
    // trên ngữ cảnh gộp — phát lại rỗng, không phát lại đôi.
    return await hoanTat({ reply: null, replies: [], superseded: true });
  }

  // ─── FR-159 (nửa 2/2): người LẠ nhắn câu KHÔNG rõ vai → HỎI, không đoán.
  // "Dạ em chào anh" / "nhà phường 4 tầm 5 tỷ" — câu đầu tiên của một người
  // chưa có hồ sơ nào có thể là người mua lẫn người bán. FR-159: đoán nhầm
  // người mua thành người bán là lượt khó chịu, chiều ngược lại chỉ tốn một câu
  // hỏi thừa → HỎI đúng một lần, không gọi model (đỡ một lượt tiền), mặc định
  // NGƯỜI MUA. Câu trả lời tự nhận có BĐS thì nửa 1/2 ở trên bắt ở lượt kế
  // (cờ `hoi_vai` mở đúng vế "tôi có căn nhà"); còn lại ở hàng người mua.
  // KHÔNG hỏi khi đã rõ: đang hỏi mua, nhắc mã căn (từ web sang), gửi ảnh (để
  // model đọc ảnh), hay đã có hồ sơ nhu cầu. Chỉ hỏi ở TIN ĐẦU TIÊN của hội
  // thoại, và đứng SAU kiểm tra nhường-lượt: khách gõ "chào em" rồi "tôi muốn
  // mua nhà" liền tay thì lượt đầu nhường, không hỏi vai thừa.
  // FR-29/30: khách nhắc mã căn (gõ tay hoặc bấm từ trang chi tiết web sang) —
  // bóc MỘT lần, dùng cho cả cổng hỏi-vai lẫn khối "căn khách đang nhắc".
  const mentioned = [...new Set(
    [...textOrTag.matchAll(CODE_RE)].map((m) => m[1].toUpperCase()),
  )].slice(0, 3);
  const nhacMaCan = mentioned.length > 0;
  const daCoHoSo = BUYER_PROFILE_FIELDS.some(([k]) => prefs[k] != null && prefs[k] !== "");
  // FR-79 (v48): người lạ mở đầu bằng "alo được không" là đang ĐÒI GỌI — đi
  // thẳng hàng người mua để mở việc VOICE, hỏi vai ở đây là nuốt mất yêu cầu.
  if (!sellerRow && !prefs.hoi_vai && !hoiMua && !nhacMaCan && !imageUrl && !daCoHoSo &&
      !VOICE_RE_KD.test(tKD)) {
    // "Tin đầu tiên?" đếm trên 12 tin đã nạp; chỉ khi cửa sổ đầy mà số tin
    // khách trong đó vẫn ≤ 1 (11 tin bot + 1 tin khách) mới phải đếm chính xác.
    let tinTruoc = tinKhach.length;
    if (history.length >= 12 && tinTruoc <= 1) {
      const { count } = await client.from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", convId).in("sender", ["buyer", "seller"]);
      tinTruoc = count ?? 0;
    }
    if (tinTruoc <= 1) {
      // 09/09/2026: lời chào ở bot_prompts.loi_chao (có chị Thu), code chỉ là dự phòng.
      // 21/09/2026 (Zalo thật, chủ dự án): tin đầu chưa biết nam/nữ → "anh/chị" gạch chéo → "anh chị".
      // 22/09/2026 (chủ dự án: "cô chào cháu nó vẫn đáp anh chị"): tin đầu đã xưng chú/cô/bác (hoặc anh/chị)
      // thì lời chào gọi đúng người và xưng cháu; "chào cháu" chưa rõ chú hay cô → xưng cháu, gọi "mình" và
      // hỏi luôn "cháu gọi chú hay cô". Cách gọi ghi vào hồ sơ mua để lượt sau (kể cả khi mở hồ sơ bán) còn nhớ.
      const xhDau = batXungHo(text) ?? tuXungTuCau(text);
      const chaoChau = !xhDau && laChaoChau(text);
      const hoaXh = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
      let cauHoiVai = LOI_CHAO_DB;
      if (xhDau) cauHoiVai = doiTuXung([cauHoiVai.replace(/anh\/chị/g, xhDau).replace(/Anh\/chị/g, hoaXh(xhDau))], xhDau)[0];
      else if (chaoChau) {
        cauHoiVai = doiTuXung([cauHoiVai.replace(/chào anh\/chị,?/, "chào ạ,").replace(/anh\/chị/g, "mình").replace(/Anh\/chị/g, "Mình")], null, "lon_tuoi")[0] +
          "\nCháu gọi chú hay cô cho tiện ạ?";
      }
      cauHoiVai = boGachCheo(cauHoiVai);
      const { error: hvErr } = await client.from("messages").insert({
        conversation_id: convId, sender: "bot", body: cauHoiVai,
      });
      if (hvErr) await ghiLoi(client, "chat-reply messages hoi_vai", hvErr.message);
      const { error: pErr } = await client
        .rpc("merge_buyer_prefs", { p_buyer_id: buyer.id, p_delta: { hoi_vai: tinHieuMoiGioi ? "nmg" : true, ...(xhDau ? { xung_ho: xhDau } : {}), ...(chaoChau ? { nhom_tuoi: "lon_tuoi" } : {}) } });
      if (pErr) await ghiLoi(client, "chat-reply merge_buyer_prefs(hoi_vai)", pErr.message);
      return await hoanTat({
        reply: cauHoiVai, replies: [cauHoiVai], conversation_id: convId, hoi_vai: true,
      });
    }
  }
  if (prefs.hoi_vai) {
    // 22/09/2026: "cô" / "chú nha" trơ trọi là câu trả lời cho "cháu gọi chú hay cô" — ghi cách gọi, hỏi lại
    // vai (câu này không phải câu trả lời mua/bán), cờ hỏi vai giữ nguyên.
    const xhTro = batXungHo(text);
    if (xhTro && boDau(text).trim().split(/\s+/).length <= 3) {
      const { error: xtErr } = await client.rpc("merge_buyer_prefs", { p_buyer_id: buyer.id, p_delta: { xung_ho: xhTro, ...(XUNG_HO_LON_TUOI.has(xhTro) ? { nhom_tuoi: "lon_tuoi" } : {}) } });
      if (xtErr) await ghiLoi(client, "chat-reply merge_buyer_prefs(xung_ho tro)", xtErr.message);
      prefs.xung_ho = xhTro;
      const Xh = xhTro.charAt(0).toUpperCase() + xhTro.slice(1);
      const cauVai = doiTuXung([`Dạ ${xhTro}. ${Xh} đang muốn mua, thuê hay đang có nhà cần bán/cho thuê ạ?`], xhTro)[0];
      const { error: cvErr } = await client.from("messages").insert({ conversation_id: convId, sender: "bot", body: cauVai });
      if (cvErr) await ghiLoi(client, "chat-reply messages hoi_vai(lai)", cvErr.message);
      return await hoanTat({ reply: cauVai, replies: [cauVai], conversation_id: convId, hoi_vai: true, xung_ho: xhTro });
    }
    // Đã hỏi; câu này không tự nhận có BĐS (nửa 1/2 đã xét, không mở hồ sơ bán)
    // → ở lại hàng người mua, xoá cờ để không hỏi lại. Model đọc câu trả lời
    // qua lịch sử hội thoại (câu hỏi vai đã nằm trong `messages`).
    const { error: pErr } = await client
      .rpc("merge_buyer_prefs", { p_buyer_id: buyer.id, p_delta: { hoi_vai: null } });
    if (pErr) await ghiLoi(client, "chat-reply merge_buyer_prefs(xoa hoi_vai)", pErr.message);
    delete prefs.hoi_vai;
  }

  danhDau("mua_truoc_boc_gan");
  // 23/09/2026 (bắn 26 tin): bot vừa giới thiệu căn Trần Bình Trọng, khách hỏi tiếp "hẻm đó rộng bao nhiêu,
  // giá còn bớt không?" / "nhà hướng gì, có dính quy hoạch không" — KHÔNG nhắc mã → khối "căn khách nhắc"
  // rỗng: model chỉ có dòng KHO (không fact, không biết ảnh) nên nói "để em hỏi lại chủ về giá" dù fact
  // "có thương lượng" có sẵn, hứa "gửi hình liền" cho tin 0 ảnh, và bịa hướng. Câu hỏi tiếp về CĂN mà không
  // nhắc mã, không phải câu tìm mới (không có tiền) → căn quan tâm gần nhất (3 ngày, còn trên kệ) coi như
  // căn khách đang nhắc.
  if (!mentioned.length && !docTien(text) && HOI_TIEP_VE_CAN_RE.test(tKD)) {
    const { data: qt, error: qtErr } = await client.from("interests").select("listing_id, created_at")
      .eq("buyer_id", buyer.id).gte("created_at", new Date(Date.now() - 3 * 86400e3).toISOString())
      .order("created_at", { ascending: false }).limit(3);
    if (qtErr) await ghiLoi(client, "chat-reply can dang ban(interests)", qtErr.message);
    const ids = ((qt ?? []) as Array<{ listing_id: string }>).map((q) => q.listing_id);
    if (ids.length) {
      const { data: lq, error: lqErr } = await client.from("listings").select("id, code")
        .in("id", ids).in("status", ["dang_ban", "dang_quan_tam"]);
      if (lqErr) await ghiLoi(client, "chat-reply can dang ban(listings)", lqErr.message);
      const ma = ids.map((id) => ((lq ?? []) as Array<{ id: string; code: string | null }>).find((l) => l.id === id)?.code).find(Boolean);
      if (ma) mentioned.push(ma.toUpperCase());
    }
  }
  // Buyer quay lại nhắn → hủy nhắc-lời-hứa + follow-up đang chờ (FR-133/FR-32)
  await client.from("reminders").update({ status: "cancelled" })
    .eq("buyer_id", buyer.id).in("kind", ["promise", "followup"]).eq("status", "pending");

  // Đủ tiêu chí tối thiểu (khu vực + giá) thì mới lọc kho gợi ý; chưa đủ thì
  // bot được dặn "chưa gợi ý căn", nên nạp kho là ~250 chữ-máy không nhớ tạm +
  // một truy vấn thừa mỗi lượt đầu (FR-171 i). Khách nhắc mã căn thì vẫn nạp,
  // để gợi căn tương tự khi căn đó đã chốt/đã gỡ.
  // 11/09/2026: khách muốn ở GẦN một nơi — câu mới đè điều kiện cũ, không nhắc
  // thì dùng điều kiện đã lưu trong hồ sơ. Điều kiện này cũng là "khu vực":
  // "gần chợ Bình Tây, tầm 5 tỷ" là đủ để lọc kho.
  //
  // Hiểu NGHĨA trước (người dùng 11/09: "không phải là gần bệnh viện 1 câu mà nó
  // phải hiểu nghĩa"): câu có mùi vị trí thì một lượt model đọc ý — "tiện đi
  // khám bệnh", "chỗ làm ở Landmark 81", "quanh Ehome 3". Model trả lời được thì
  // tin model: nó phân biệt được "căn đó gần chợ không?" là câu HỎI, không phải
  // điều kiện tìm. Model hỏng thì regex. Toạ độ và số mét vẫn do SQL tính.
  let ganMoi: GanTienIch | null = null;
  let boGan = false;
  const hoiGan = coMuiViTri(text)
    ? (async (): Promise<{ ganMoi: GanTienIch | null; boGan: boolean }> => {
      try {
        const ai = await napModel(client);
        const r = await bocGanBangModel(
          ai as unknown as Parameters<typeof bocGanBangModel>[0], MODEL, text,
          typeof prefs.gan_tien_ich === "string" ? prefs.gan_tien_ich : null,
        );
        if (r) {
          await doTien(client, r.usage as Parameters<typeof doTien>[1]);
          if (r.ket) return { ganMoi: thanhGan(r.ket), boGan: r.ket.bo_dieu_kien };
        }
      } catch (e) {
        await ghiLoi(client, "chat-reply bocGanBangModel", e);
      }
      return { ganMoi: docGanTienIch(text), boGan: false };
    })()
    : null;
  // 14/09/2026 (đo thật): lượt model đọc "gần đâu" chạy TRƯỚC model chính và chặn
  // 2,7–3,1 s. Kết quả của nó chỉ đổi được lượt NÀY khi hồ sơ đã có giá (lúc đó
  // "gần X" + giá = đủ tiêu chí → lọc kho theo khoảng cách). Hồ sơ chưa có giá —
  // lượt đầu điển hình — thì chạy SONG SONG với model chính, lấy kết quả sau để
  // ghi hồ sơ; lượt sau lọc kho theo điều kiện đã lưu như cũ.
  // 23/09/2026 (bắn 26 tin): "anh cần mua nhà hẻm xe hơi Q5 tầm 8 tỷ, 3 phòng ngủ" — đủ tiêu chí NGAY TIN ĐẦU mà
  // kho chỉ lọc theo hồ sơ ĐÃ LƯU (lúc đó còn trống) → bot hứa "em lọc kho liền" rồi im, không hàng đợi nào gửi
  // sau. Nay lượt này lọc theo hồ sơ TẠM = hồ sơ đã lưu + thứ đọc tiền định từ chính câu khách (quận/phường/
  // tên đường, cụm giá, số phòng ngủ, mua/thuê). Hồ sơ lưu vẫn do lượt model ghi như cũ.
  const prefsLoc = hoSoTamTuCau(prefs, text, tKD);
  const ganTruocModel = prefsLoc.budget != null;
  if (hoiGan && ganTruocModel) ({ ganMoi, boGan } = await hoiGan);
  danhDau("mua_sau_boc_gan");
  const gan: GanTienIch | null = boGan && !ganMoi ? null : ganMoi ??
    (prefs.gan_tien_ich_loc && typeof prefs.gan_tien_ich_loc === "object"
      ? prefs.gan_tien_ich_loc as GanTienIch
      : null);
  const minimumMet = (prefsLoc.area != null || gan != null) && prefsLoc.budget != null;
  // FR-216: tìm theo nghĩa sẵn sàng? (công tắc bật + có khoá + nhung-tick KHÔNG đang tạm dừng vì Gemini từ chối —
  // 20260923h) — chỉ hỏi khi kho được lọc thật (đủ tiêu chí), song song tới lúc dựng truy vấn.
  const timNghiaP = minimumMet
    ? (async () => {
      const { data, error } = await client.rpc("tim_nghia_san_sang");
      if (error) await ghiLoi(client, "chat-reply tim_nghia_san_sang", error.message);
      return data === true;
    })().catch(() => false)
    : Promise.resolve(false);
  // 14/09/2026 (bắn 16 hội thoại mua): "tìm nhà quận 5 tầm 6 tỷ" → bot vẫn dò "để ở hay
  // đầu tư?" (5/9 hội thoại). `minimumMet` đọc hồ sơ ĐẦU lượt — lúc đó còn trống — nên câu
  // lệnh bảo model "CÒN THIẾU, hỏi theo thứ tự" dù khách vừa nói đủ khu vực + giá. Câu
  // dặn ngừng dò hồ sơ đọc thêm chính câu khách (luật tiền + bóc quận, tiền định). Kho
  // vẫn lọc theo hồ sơ đã lưu như cũ.
  const duTieuChiDeNgungDo = minimumMet ||
    ((prefs.area != null || gan != null || !!bocQuan(tKD, text) || /\b(?:phuong|p)\s*\d{1,2}\b/.test(tKD)) &&
      (prefs.budget != null || docTien(text) != null));
  // 13/09/2026: cách gọi KHÁCH MUA. Nhánh người bán có `sellers.xung_ho` từ 07/09,
  // nhánh mua thì không — model tự đoán: "có căn nào quận 10 tầm 5 tỷ không em"
  // → "Anh tìm để ở…". Lời dặn ("kêu chị nha") thắng; khách tự xưng ("chị đang
  // tìm mua") thì nhận khi chưa biết. Lưu trong hồ sơ, không thêm cột.
  const xhMuaMoi = batXungHo(text) ?? tuXungTuCau(text);
  const goiMua = (xhMuaMoi ?? prefs.xung_ho ?? null) as XungHo | null;
  // Kho lọc theo hồ sơ: mua/thuê, phường (nếu bắt được), số PN, cận trên giá (SRS-5.2)
  // Cột dùng chung cho mọi dòng "căn" đưa vào prompt (KHO, căn khách nhắc, căn
  // tương tự, căn trong dự án): thông số FR-172 + dự án/tình trạng căn FR-116.
  const CAN_COLS =
    `code, ward, district, deal, location_raw, price_raw, price_vnd, area_m2, bedrooms, property_type, ${SPEC_COLS}, project_id, unit_code, unit_status, last_confirmed_at, tien_ich_gan, nhan, boc_tach, description, projects(name)`;
  const timNghia = await timNghiaP;
  let khoQ = client
    .from("listings")
    .select(CAN_COLS) // FR-172 + FR-116
    .eq("deal", dealCol(prefsLoc.deal))
    .in("status", ["dang_ban", "dang_quan_tam"]) // FR-139: chỉ gợi ý tin đang lên kệ
    .not("price_raw", "is", null).neq("price_raw", "")
    // FR-188 (10/09): căn chủ CẦN BÁN GẤP lên đầu khi ghép khách, rồi mới tới mới nhất.
    .order("gap", { ascending: false, nullsFirst: false })
    // FR-216: bật tìm theo nghĩa thì lấy rộng 30 căn đã lọc cứng rồi xếp lại theo nghĩa, cắt còn 6.
    .order("created_at", { ascending: false }).limit(timNghia ? 30 : 6);
  const hemLoc = locLoaiHem(prefsLoc.alley);
  if (hemLoc) khoQ = khoQ.or(hemLoc);
  const wardNum = typeof prefsLoc.area === "string" ? soPhuong(boDau(prefsLoc.area)) : null;
  // Khớp ĐÚNG số phường (ilike không wildcard = so khớp nguyên chuỗi,
  // không phân biệt hoa thường) — '%1%' cũ khiến P1 dính cả P10-P16
  if (wardNum) khoQ = khoQ.ilike("ward", `Phường ${wardNum}`);
  if (typeof prefsLoc.bedrooms === "number") khoQ = khoQ.gte("bedrooms", prefsLoc.bedrooms);
  if (nhanLoc.length) khoQ = khoQ.contains("nhan", nhanLoc);
  const budgetR = budgetRangeVnd(prefsLoc.budget);
  if (budgetR?.max) khoQ = khoQ.lte("price_vnd", budgetR.max);
  if (budgetR?.min) khoQ = khoQ.gte("price_vnd", budgetR.min);
  // 11/09: lọc theo khoảng cách thật (`timTinGanMoc` → `tin_gan_moc`, migration
  // 20260911g): mốc là tiện ích OSM, dự án có toạ độ, hoặc địa danh tra được.
  // RPC hỏng thì bỏ điều kiện này và ghi sổ — đừng để kho trống vì lỗi phía
  // mình. Không định vị được nơi khách nói thì cũng không lọc, bot hỏi lại.
  let ganKq: TinGan[] | null = null;
  let khongThayMoc = false;
  if (gan && minimumMet) {
    const kq = await timTinGanMoc(client as unknown as Parameters<typeof timTinGanMoc>[0], gan, dealCol(prefs.deal));
    if (kq.loi) {
      await ghiLoi(client, "chat-reply tin_gan_moc", kq.loi);
    } else if (kq.khongThayMoc) {
      khongThayMoc = true;
    } else {
      ganKq = kq.tin;
      khoQ = khoQ.in("code", ganKq.length ? ganKq.map((g) => g.code) : ["-"]);
    }
  }
  const ganTheoMa = new Map((ganKq ?? []).map((g) => [g.code, g]));

  // FR-65 (v48): khách chấm sao → chỉ khi vừa được hỏi cảm nhận (nhắc
  // `feedback` đã `sent` trong 48 giờ) mới là đánh giá buổi xem; tra căn từ
  // chính dòng nhắc đó. Regex khớp mới tốn truy vấn.
  const saoM = SAO_RE_KD.exec(tKD);
  const saoKhach = saoM ? Number(saoM[1] ?? saoM[2]) : null;
  const [
    { data: khoTho }, { data: partnerProj }, { data: matchedProj }, { data: askedListings },
    { data: askedPhotos }, giaTB, { data: nhacFeedback },
  ] = await Promise.all([
    minimumMet || mentioned.length ? khoQ : Promise.resolve({ data: [] as never[] }),
    // FR-132: dự án nhà mình phân phối trực tiếp — luôn đứng đầu khối dự án
    client.from("projects")
      .select("name, developer, district, ward, location_raw, legal_status, status_text, amenities, specs, unit_types")
      .eq("is_partner", true).order("priority").limit(1),
    // Khách nhắc tên dự án nào trong kho (mogi/aond) thì nạp kiến thức dự án đó
    client.rpc("match_projects", { p_text: text }),
    // Căn khách đang nhắc tới — kèm facts đã xác minh từ chủ nhà (FR-29).
    // Soát 01/09 (vai người mua đã nhắm căn): bản cũ KHÔNG lọc trạng thái, mà
    // mã tin là dãy đếm BDS-Q5-#### đoán được — gõ một mã bất kỳ là bot đọc ra
    // địa chỉ, giá, diện tích, fact đã xác minh và URL ảnh của tin CHƯA ĐĂNG
    // (`cho_thong_tin`) lẫn tin chủ nhà ĐÃ GỠ (`an`). Web đã chặn đúng những
    // tin này với người lạ từ FR-167c; bot phải cùng ranh giới. Tin chưa đăng
    // thì không ai có thể biết mã hợp lệ → coi như không có. Tin đã gỡ vẫn nạp
    // nhưng CHỈ mã + trạng thái (khối askedBlock cắt chi tiết), để bot nói
    // thật "căn đó đã gỡ" thay vì "em không thấy mã này".
    mentioned.length
      ? client.from("listings")
        .select(`status, ${CAN_COLS}, listing_facts(question, answer)`) // FR-172 + FR-116
        .in("code", mentioned)
        .in("status", ["dang_ban", "dang_quan_tam", "da_chot", "an"])
        .limit(3)
      : Promise.resolve({ data: [] as never[] }),
    // FR-148: kho ảnh thật up theo MÃ tin (bucket listing-photos/<mã>/…)
    mentioned.length
      ? client.from("listing_photos_v").select("code, url").in("code", mentioned).limit(24)
      : Promise.resolve({ data: [] as never[] }),
    // FR-99: giá TB phường — chỉ khi đã đủ hồ sơ để lọc kho và biết số phường
    minimumMet && wardNum
      ? giaTBPhuong(client, dealCol(prefs.deal), wardNum)
      : Promise.resolve(""),
    // FR-65: nhắc `feedback` gần nhất đã gửi cho khách này trong 48h
    saoKhach
      ? client.from("reminders").select("id, listing_id")
        .eq("buyer_id", buyer.id).eq("kind", "feedback").eq("status", "sent")
        .gte("sent_at", new Date(Date.now() - 48 * 3600e3).toISOString())
        .order("sent_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null as { id: string; listing_id: string | null } | null }),
  ]);
  // FR-216: xếp kho theo NGHĨA câu khách (vector Gemini ↔ `listings.nhung`) TRONG nhóm đã lọc cứng. Hỏng bất
  // cứ bước nào → giữ thứ tự cũ (gấp trước, mới trước), ghi sổ. Căn chưa có vector xếp sau căn có.
  let listings = khoTho;
  if (timNghia && (khoTho ?? []).length > 1) {
    try {
      const khoa = await secretOf(client, "GEMINI_API_KEY");
      if (!khoa) throw new Error("thiếu GEMINI_API_KEY");
      // 24/09/2026: câu vừa nhắn thường cụt ("phòng cho ba mẹ riêng, có căn nào không") — ghép NHU CẦU ĐÃ LƯU (notes)
      // để vector mang đủ ý "phòng ngủ trệt, khỏi leo cầu thang" khách nói từ lượt trước.
      const cauTim = [text, typeof prefs.notes === "string" && prefs.notes.trim() ? prefs.notes.slice(0, 500) : null,
        typeof prefs.alley === "string" ? prefs.alley : null, nhanLoc.length ? tenNhan(nhanLoc) : null]
        .filter(Boolean).join(". ");
      const vec = await nhungCauTim(khoa, cauTim);
      const codes = (khoTho ?? []).map((l) => (l as { code: string }).code);
      const { data: hang, error: hangErr } = await client.rpc("tim_tin_theo_nghia", { p_vec: vec, p_codes: codes, p_limit: codes.length });
      if (hangErr) throw new Error(hangErr.message);
      listings = xepTheoNghia(khoTho ?? [], ((hang ?? []) as Array<{ code: string }>).map((h) => h.code));
    } catch (e) {
      await ghiLoi(client, "chat-reply tim_tin_theo_nghia", e);
    }
  }
  listings = (listings ?? []).slice(0, 6);
  const danhGia = saoKhach && nhacFeedback?.listing_id
    ? { listing_id: nhacFeedback.listing_id as string, stars: saoKhach }
    : null;
  const ordered = history.slice().reverse();
  // Tin KHÁCH cắt 400 ký tự (FR-171 i): khách dán nguyên bài rao dài là mỗi lượt
  // sau gánh thêm cả nghìn chữ-máy không nhớ tạm suốt 12 tin. Tin bot đã bị
  // luật 30-90 từ khống chế.
  // Bong bóng 💾 (báo lại hồ sơ đã lưu) là bảng số liệu, không phải lời em nói —
  // bỏ khỏi lịch sử, không thì model bắt chước in bảng (như nhánh người bán).
  const convo = ordered
    .filter((m) => !(m.sender === "bot" && m.body.startsWith(DAU_BAO_LAI)))
    .map((m) =>
      `${laTinNguoi(m.sender) ? "KHÁCH" : m.sender === "human" ? "EM (người thật bên mình nhắn tay)" : "EM"}: ${
        laTinNguoi(m.sender) ? m.body.slice(0, 400) : m.body
      }`)
    .join("\n");
  // FR-172: kèm thông số có cấu trúc (ngang×dài, kết cấu, WC, đường vào, pháp
  // lý) — trước đây "hẻm xe hơi", "sổ hồng riêng" nằm trong mô tả mà KHO không
  // nạp mô tả, nên bot trả lời "để em hỏi lại chủ nhà" cho thứ tin rao đã ghi.
  // MỘT hàm viết dòng căn cho KHO / căn tương tự / căn trong dự án — địa chỉ
  // qua `locLienHe` (FR-105), thông số (FR-172), dự án + tình trạng căn (FR-116).
  type CanRow = SpecRow & DuAnRow & {
    code: string; ward?: string | null; district?: string | null; deal?: string | null;
    location_raw?: string | null; price_raw?: string | null; price_vnd?: number | null;
    area_m2?: number | null; bedrooms?: number | null; property_type?: string | null;
    tien_ich_gan?: Array<{ loai: string; ten: string; m: number }> | null;
    nhan?: string[] | null; boc_tach?: Record<string, unknown> | null; description?: string | null;
  };
  // 11/09: khoảng cách là đường chim bay từ CON ĐƯỜNG của căn (toạ độ không tới
  // số nhà) — làm tròn để model không đọc ra con số giả chính xác.
  const lamTronM = (m: number) =>
    m >= 1000 ? `${String(Math.round(m / 100) / 10).replace(".", ",")} km` : `${Math.max(50, Math.round(m / 50) * 50)} m`;
  const ganTxt = (l: CanRow) => {
    const g = ganTheoMa.get(l.code);
    return g ? ` · cách ${g.moc} khoảng ${lamTronM(g.khoang_cach_m)}` : "";
  };
  // 22/09/2026 (bắn thật sau deploy #181): dòng kho không mang tiện ích chủ nhà nói ("gần chợ Hoà Bình")
  // lẫn nhãn, khách hỏi "gần chợ không" → model tự đặt tên "chợ Hàng Thịt". Đưa fact tiện ích (qua
  // `boc_tach`, trigger fact→boc_tach) và nhãn tìm kiếm vào dòng kho để model có chữ thật mà dùng.
  const tienIchNgan = (l: CanRow) => {
    const ti = l.boc_tach?.tien_ich_gan;
    const a = typeof ti === "string" && ti.trim() ? ` · ${locLienHe(ti.trim(), true).slice(0, 80)}` : "";
    const b = l.nhan?.length ? ` · ${tenNhan(l.nhan)}` : "";
    return a + b;
  };
  // 24/09/2026 (chủ dự án test vai mua): dòng kho chỉ có thông số → model tự bịa "phòng trệt rộng 14m2", "trệt để ba
  // mẹ" cho căn mà chủ nói trệt là xưởng may. Kèm LỜI CHỦ TẢ (câu rao gốc, che SĐT + số nhà, ~200 chữ) để bot nói
  // đúng điều người bán nói; luật "không ghi thì hỏi lại chủ" nằm ở đầu khối KHO.
  const chuTa = (l: CanRow) => {
    const mt = locLienHe((l.description ?? "").replace(/\s+/g, " "), true);
    if (mt.length < 20) return "";
    return ` · chủ tả: "${mt.length > 200 ? mt.slice(0, 199).replace(/\s+\S*$/, "") + "…" : mt}"`;
  };
  const dongKho = (l: CanRow) =>
    `#${l.code} · ${locLienHe(l.location_raw ?? "")} ${l.ward ?? ""} · ${l.price_raw ?? "giá đang cập nhật"} · ${l.area_m2 ?? "?"}m2${l.bedrooms ? ` · ${l.bedrooms}PN` : ""}${thongSoNgan(l)}${duAnNgan(l)}${ganTxt(l)}${tienIchNgan(l)}${chuTa(l)}`;
  const kho = ((listings ?? []) as CanRow[]).map(dongKho).join("\n");

  // Khối "căn khách đang nhắc" (FR-29): đủ chi tiết + facts đã xác minh + trạng
  // thái (`STATUS_VI` ở tầng module).
  type Asked = CanRow & {
    status?: string | null;
    listing_facts?: Array<{ question: string; answer: string }> | null;
  };
  // FR-143/148: hình sẵn có của một căn = ảnh up theo mã (bucket listing-photos)
  // + URL chính chủ gửi qua chat (facts hinh_anh). Ảnh kho đứng trước.
  const photoByCode: Record<string, string[]> = {};
  for (const p of (askedPhotos ?? []) as Array<{ code: string; url: string }>) {
    (photoByCode[p.code] ??= []).push(p.url);
  }
  const photosOf = (l: Asked): string[] =>
    l.status === "an" ? [] : [
      ...(photoByCode[l.code] ?? []),
      ...(l.listing_facts ?? [])
        .filter((f) => f.question === "hinh_anh")
        .flatMap((f) => f.answer.match(PHOTO_URL_RE) ?? []),
    ];
  const askedBlock = ((askedListings ?? []) as Asked[])
    .map((l) => {
      // Tin chủ nhà đã gỡ: chỉ nói trạng thái, KHÔNG lộ địa chỉ/giá/ảnh.
      if (l.status === "an") {
        return `#${l.code} · ${STATUS_VI.an} - KHÔNG nêu địa chỉ hay giá của căn này, báo thật là chủ nhà đã gỡ rồi gợi ý căn tương tự trong KHO`;
      }
      // Fact cắt 300 ký tự (FR-171 i): mỗi căn khách nhắc là một khối không nhớ
      // tạm; chủ nhà kể dài thì phần đầu (giá, pháp lý, diện tích) là phần đáng.
      // FR-105: fact chủ nhà kể có thể chứa SĐT/Zalo/số nhà → lọc trước khi
      // đưa model đọc (model không được biết thì không thể lỡ miệng).
      const facts = (l.listing_facts ?? [])
        .filter((f) => f.question !== "hinh_anh")
        .map((f) => `${f.question}: ${locLienHe(f.answer, true)}`).join("; ").slice(0, 300);
      const nPhotos = photosOf(l).length;
      // 11/09: tiện ích gần nhất mỗi loại (geocode-listings nạp từ OSM) — khách
      // hỏi "gần chợ không" thì trả lời được, kèm chữ "khoảng".
      const quanh = (l.tien_ich_gan ?? []).slice(0, 4)
        .map((x) => `${x.ten} ~${lamTronM(x.m)}`).join("; ");
      return `${dongKho(l)}${l.status ? ` · trạng thái: ${STATUS_VI[l.status] ?? l.status}` : ""}${facts ? ` · đã xác minh từ chủ nhà: ${facts}` : ""}${quanh ? ` · quanh căn (đường chim bay, ước tính): ${quanh}` : ""}${nPhotos ? ` · CÓ ${nPhotos} HÌNH SẴN (khách xin hình thì điền send_photos, hệ thống tự đính kèm tối đa 4 tấm/lượt và tự hỏi xem thêm - ĐỪNG hứa đi hỏi chủ nhà)` : " · chưa có hình sẵn"}`;
    }).join("\n");

  // Khối DỰ ÁN (FR-113…115/FR-132): kiến thức chung đã xác thực, bot trả lời
  // tầng dự án trực tiếp; Ny'ah (is_partner) luôn ở trên cùng.
  type Proj = {
    name: string; developer?: string | null; district?: string | null;
    location_raw?: string | null; legal_status?: string | null; status_text?: string | null;
    amenities?: unknown; specs?: unknown; unit_types?: unknown; description?: string | null;
  };
  const projLine = (p: Proj, full: boolean) => {
    const parts = [`${p.name} - CĐT ${p.developer ?? "?"} · ${p.location_raw ?? p.district ?? ""}`];
    if (p.legal_status) parts.push(`pháp lý: ${p.legal_status}`);
    if (p.status_text) parts.push(`tình trạng: ${p.status_text}`);
    if (Array.isArray(p.amenities)) parts.push(`tiện ích: ${(p.amenities as string[]).join(", ")}`);
    if (full && p.specs) parts.push(`thông số: ${JSON.stringify(p.specs)}`);
    if (full && p.unit_types) parts.push(`mẫu nhà/căn: ${JSON.stringify(p.unit_types)}`);
    if (!full && p.description) parts.push(String(p.description).slice(0, 280));
    return "• " + parts.join(" · ");
  };
  const partner = (partnerProj ?? [])[0] as Proj | undefined;
  // Tối đa 2 dự án khách nhắc (FR-171 i): mỗi dự án đủ thông số + mẫu căn là
  // ~1.350 ký tự không nhớ tạm; khách nhắc 3-4 tên một câu là hiếm và model
  // vẫn trả lời được từ hai dự án đầu.
  const matched = ((matchedProj ?? []) as Proj[])
    .filter((m) => m.name !== partner?.name).slice(0, 2);
  // Dự án nhà mình đứng RIÊNG khỏi khối kho: nó giống hệt nhau cho mọi khách và
  // gần như không đổi, nên chỗ của nó là trong phần được nhớ tạm (rẻ 1/10), chứ
  // không phải nằm chung với khối kho biến động theo từng hồ sơ. Riêng thông số
  // + mẫu căn đã là 1.350 ký tự, gửi đủ giá mỗi lượt cho cả khách chưa hỏi tới
  // dự án là phí. Xem bot/README §01/09.
  const duanNhaMinh = partner ? projLine(partner, true) : "";
  // Dự án khách vừa nhắc tên thì mới nạp — biến động, phải nằm sau điểm nhớ tạm.
  const duanBlock = matched.map((m) => projLine(m, true)).join("\n");

  // ─── FR-116 (v48): "căn X dự án Y còn không" → đọc `unit_status` của tin
  // thuộc dự án khách nhắc. Chỉ tốn một truy vấn khi `match_projects` có kết
  // quả (kể cả dự án nhà mình); có mã căn thì lọc đúng căn, không thì liệt kê
  // tối đa 5 căn của dự án. Tình trạng + TTL 7 ngày viết bởi `duAnNgan`.
  const maCanHoi = MA_CAN_RE.exec(text)?.[1]?.toUpperCase() ?? null;
  const duAnIds = ((matchedProj ?? []) as Array<{ id?: string }>)
    .map((m) => m.id).filter((x): x is string => !!x);
  let canDuAn: CanRow[] = [];
  if (duAnIds.length) {
    let uq = client.from("listings").select(CAN_COLS)
      .in("project_id", duAnIds).in("status", ["dang_ban", "dang_quan_tam", "da_chot"])
      .order("created_at", { ascending: false }).limit(5);
    if (maCanHoi) uq = uq.ilike("unit_code", maCanHoi);
    const { data: cd, error: cdErr } = await uq;
    if (cdErr) await ghiLoi(client, "chat-reply can du an", cdErr.message);
    canDuAn = (cd ?? []) as CanRow[];
  }
  const canDuAnBlock = duAnIds.length
    ? (canDuAn.length
      ? canDuAn.map(dongKho).join("\n")
      : maCanHoi
      ? `căn ${maCanHoi}: KHÔNG có trong kho - nói thật là em chưa có căn này, để em hỏi bộ phận dự án rồi báo lại`
      : "")
    : "";

  // ─── FR-114 (e) (22/09/2026, Zalo thật): "quận 5 có dự án gì không em" → bot chỉ biết dự án khi
  // khách GỌI TÊN (`match_projects`) hoặc dự án nhà mình (Quận 8), nên kể Ny'ah Phú Định cho khách
  // hỏi Quận 5 rồi "chưa có căn nào" — trong khi `projects` có 17 dự án Quận 5 đủ địa chỉ. Nay: khách
  // hỏi tới dự án / chung cư / căn hộ, hoặc kho tin trống mà đã đủ tiêu chí, thì nạp tối đa 5 dự án
  // CÙNG QUẬN khách tìm làm kiến thức tham khảo — không phải căn đang bán, model phải nói rõ thế.
  const quanKhach = bocQuan(tKD, text) ??
    (typeof prefs.area === "string" ? bocQuan(boDau(prefs.area), prefs.area) : null);
  const hoiDuAnKhu = /\b(?:du an|chung cu|can ho|cao oc|toa nha|khu dan cu|kdc)\b/.test(tKD);
  let duAnKhuBlock = "";
  // Kho tin có căn nào thuộc các dự án vừa nạp không — không có thì câu "chưa có căn nào đang rao" là thật.
  let coCanTrongDuAnKhu = false;
  if (quanKhach && (hoiDuAnKhu || (minimumMet && !(listings ?? []).length))) {
    const { data: dak, error: dakErr } = await client.from("projects")
      .select("id, name, developer, district, ward, location_raw, legal_status, status_text, amenities, unit_types")
      .eq("district", quanKhach).order("priority").limit(6);
    if (dakErr) await ghiLoi(client, "chat-reply du an trong khu", dakErr.message);
    const ds = ((dak ?? []) as Array<Proj & { id?: string }>).filter((p) => p.name !== partner?.name && !matched.some((m) => m.name === p.name)).slice(0, 5);
    duAnKhuBlock = ds.map((p) => projLine(p, false)).join("\n");
    const ids = new Set(ds.map((p) => p.id).filter(Boolean));
    coCanTrongDuAnKhu = ((listings ?? []) as CanRow[]).some((l) => l.project_id && ids.has(l.project_id));
  }

  // ─── FR-31 (v48): CĂN TƯƠNG TỰ khi căn khách hỏi đã chốt/đã gỡ, hoặc khách
  // hỏi "còn căn nào giống giống vầy không". Căn gốc = căn khách nhắc; không
  // có thì căn bot vừa nói tới gần nhất trong lịch sử (một truy vấn tra mã).
  // Cùng phường trước (≥3 thì đủ), thiếu thì mở ra cùng quận; giá 0,7×–1,3×
  // căn gốc, cùng deal; xếp: cùng phường > cùng đường vào > cùng loại nhà;
  // lấy 3. Không còn công thức trọng số SRS-5.2 giấy — thay bằng luật này.
  const askedArr = (askedListings ?? []) as Asked[];
  const muonTuongTu = GIONG_RE_KD.test(tKD);
  let canGoc: CanRow | null = askedArr.find((l) => l.status === "da_chot" || l.status === "an") ??
    (muonTuongTu ? askedArr[0] ?? null : null);
  if (!canGoc && muonTuongTu) {
    const maBotNoi = [...ordered].reverse()
      .filter((m) => m.sender === "bot")
      .flatMap((m) => [...m.body.matchAll(CODE_RE)].map((x) => x[1].toUpperCase()))[0];
    if (maBotNoi) {
      const { data: g } = await client.from("listings").select(CAN_COLS)
        .eq("code", maBotNoi).maybeSingle();
      canGoc = (g as CanRow | null) ?? null;
    } else {
      // 23/09/2026: bot không còn viết mã cho khách (FR-178 a) → căn vừa gợi là căn khách quan tâm gần nhất (FR-108).
      const { data: qt, error: qtErr } = await client.from("interests").select("listing_id")
        .eq("buyer_id", buyer.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (qtErr) await ghiLoi(client, "chat-reply can tuong tu (interests)", qtErr.message);
      if (qt?.listing_id) {
        const { data: g } = await client.from("listings").select(CAN_COLS).eq("id", qt.listing_id).maybeSingle();
        canGoc = (g as CanRow | null) ?? null;
      }
    }
  }
  let tuongTu: CanRow[] = [];
  if (canGoc) {
    const timGiong = async (theo: "ward" | "district") => {
      const gia = Number(canGoc!.price_vnd);
      let q = client.from("listings").select(CAN_COLS)
        .eq("deal", canGoc!.deal ?? "ban").in("status", ["dang_ban", "dang_quan_tam"])
        .neq("code", canGoc!.code).not("price_raw", "is", null)
        .order("created_at", { ascending: false }).limit(6);
      q = theo === "ward" ? q.eq("ward", canGoc!.ward) : q.eq("district", canGoc!.district);
      if (gia > 0) q = q.gte("price_vnd", Math.round(gia * 0.7)).lte("price_vnd", Math.round(gia * 1.3));
      const { data: r, error: rErr } = await q;
      if (rErr) await ghiLoi(client, `chat-reply can tuong tu(${theo})`, rErr.message);
      return (r ?? []) as CanRow[];
    };
    const ung: CanRow[] = canGoc.ward ? await timGiong("ward") : [];
    if (ung.length < 3 && canGoc.district) {
      const them = await timGiong("district");
      for (const t of them) if (!ung.some((u) => u.code === t.code)) ung.push(t);
    }
    const diem = (l: CanRow) =>
      (l.ward && l.ward === canGoc!.ward ? 4 : 0) +
      (l.access_type && l.access_type === canGoc!.access_type ? 2 : 0) +
      (l.property_type && l.property_type === canGoc!.property_type ? 1 : 0);
    tuongTu = ung.sort((a, b) => diem(b) - diem(a)).slice(0, 3);
  }
  const tuongTuBlock = tuongTu.map(dongKho).join("\n");

  // Chống hỏi cung: 2 tin gần nhất của bot đều là câu hỏi → lượt này đưa giá trị
  const botMsgs = ordered.filter((m) => m.sender === "bot");
  const interrogated = botMsgs.length >= 2 &&
    botMsgs.slice(-2).every((m) => m.body.trimEnd().endsWith("?"));

  // Hồ sơ ĐÃ BIẾT / CÒN THIẾU theo thứ tự ưu tiên UF-04
  const known = [
    ...BUYER_PROFILE_FIELDS
      .filter(([k]) => prefs[k] != null && prefs[k] !== "")
      .map(([k, label]) => `- ${label}: ${prefs[k]}`),
    // 11/09: "gần tiện ích" KHÔNG nằm trong danh sách hỏi (đừng hỏi khách nào
    // cũng "cần gần gì không") — chỉ nhắc khi khách đã tự nói.
    ...(gan ? [`- muốn ở gần: ${nhanGan(gan)}`] : []),
  ].join("\n");
  const missing = BUYER_PROFILE_FIELDS
    .filter(([k]) => prefs[k] == null || prefs[k] === "")
    .map(([, label]) => `- ${label}`).join("\n");
  // (`minimumMet` tính ở trên, trước khi quyết định có lọc kho không.)

  type LuotMua = {
      profile: Record<string, unknown>; replies: string[];
      promise?: { when: string; what: string } | null;
      viewing?: { listing_code: string | null; when: string; phone: string | null } | null;
      ask_owner?: { listing_code: string | null; question: string } | null;
      agreed_deal?: { listing_code: string | null } | null;
      send_photos?: string | null;
      need_human?: boolean;
      voice_request?: boolean;
  };
  // Tên kiểu riêng: `as typeof out` ở dưới bị TS thu hẹp thành `null` theo luồng
  // (out vừa gán null), nên ép kiểu thành "chuyển sang null" — lỗi TS2352.
  let out: LuotMua | null = null;
  // FR-27 (v48): "xem thêm" hình — offset nhớ ở `buyers.preferences.photo_offset`
  // = {code, n} (rẻ nhất: đi chung RPC `merge_buyer_prefs` đã có ở hậu kỳ,
  // không thêm cột, không tra `messages`). Có nghĩa CHỈ khi lượt trước còn dư.
  const offsetCu = (prefs.photo_offset ?? null) as { code?: string; n?: number } | null;
  const xemThemHinh = !!offsetCu?.code && XEM_THEM_RE_KD.test(tKD);
  try {
    danhDau("mua_truoc_model");
    // Dựng client TRONG try: thiếu key/hỏng model đều rơi về fallback regex bên
    // dưới thay vì 500 — không đổ lỗi cho khách (giữ đúng ý đồ fallback cũ).
    const anthropic = await napModel(client);
    const resp = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      // effort low: nhanh hơn rõ rệt, few-shot + luật đã gánh chất lượng (nudge
      // chạy low được chấm 4.5-4.7/5); cần sâu hơn thì nâng lại "medium"
      output_config: { effort: "low" },
      _khuon_du_phong: BUYER_FORMAT,
      // Tách 2 khối theo GIÁ, không theo chủ đề: mọi thứ giống hệt nhau cho mọi
      // khách nằm trước điểm nhớ tạm (đọc lại chỉ tốn 1/10 giá); mọi thứ đổi
      // theo hồ sơ từng khách nằm sau (phải trả đủ giá dù có cache hay không).
      //
      // TTL 1 GIỜ, KHÔNG PHẢI 5 PHÚT MẶC ĐỊNH — và đây là lựa chọn theo LƯU
      // LƯỢNG, phải xem lại khi lưu lượng đổi. Khối tĩnh ~5.800 token. Nạp lại
      // tốn 1,25 lần giá gốc ở nhịp 5 phút, 2 lần ở nhịp 1 giờ; đọc lại tốn
      // 1/10. Đồng hồ đếm từ lúc BẮT ĐẦU mỗi lượt và mỗi lần đọc lại đặt lại
      // đồng hồ, nên cái quyết định là KHOẢNG CÁCH giữa hai lượt bất kỳ dùng
      // chung khối này — của mọi khách cộng lại, không phải của riêng một khách.
      //
      //   cách nhau < 5 phút  → để 5 phút: lượt nào cũng làm nóng lại, rẻ nhất
      //   cách nhau 5–60 phút → để 1 giờ: đây là khoảng DUY NHẤT bù nổi giá nạp
      //   cách nhau > 1 giờ   → cả hai đều không cứu; chịu lượt nguội
      //
      // Hôm nay khách thưa, khoảng cách rơi vào 5–60 phút. Ở nhịp đó để 5 phút
      // thì lượt nào cũng trượt, mà một lượt trượt (1,25) còn ĐẮT HƠN không
      // dùng nhớ tạm (1,0) — mất tiền để không được gì.
      //
      // ĐỔI NGƯỢC LẠI VỀ 5 PHÚT khi vượt ~12 lượt trả lời/giờ (cỡ 10 khách/ngày
      // trong giờ làm). Lúc đó lưu lượng tự giữ nóng và giá nạp gấp đôi thành
      // lỗ thuần. Đọc số thật ở cache_read_input_tokens trong usage.
      system: [{
        type: "text",
        text: TONE + "\n\n" + HUMAN + "\n\n" + FEES + "\n\n" + SLANG + "\n\n" + AGREE + "\n\n" + FEWSHOT +
          "\n\nBất biến: tối đa 3 listing một tin; không khẳng định còn/hết hay pháp lý khi chưa xác minh - nói 'để em hỏi lại chủ nhà'; tin chủ động kết thúc bằng MỘT câu hỏi. Chỉ dùng listing trong KHO ở khối sau, không bịa." +
          "\n\n" + DAU_RA_JSON +
          (duanNhaMinh
            ? "\n\nDỰ ÁN NHÀ MÌNH ĐANG PHÂN PHỐI TRỰC TIẾP (kiến thức chung ĐÃ XÁC THỰC - trả lời TRỰC TIẾP câu hỏi tầng dự án: vị trí, chủ đầu tư, pháp lý dự án, tiện ích, mẫu nhà, quy cách bàn giao - KHÔNG cần 'hỏi lại chủ nhà'. GIÁ từng căn KHÔNG có ở đây: khách hỏi giá thì nói 'để em kiểm tra giá lô đó rồi báo anh/chị liền'. Khách hợp nhu cầu (nhà phố xây mới, khu biệt lập an ninh, ~43-92m2, quanh Q5/Q6/Q8) thì chủ động giới thiệu MỘT lần như một lựa chọn; khách không quan tâm thì thôi, đừng lặp lại):\n" +
              duanNhaMinh
            : ""),
        cache_control: { type: "ephemeral", ttl: "1h" },
      }, {
        type: "text",
        text: DONG_TEN + "\n\nKHO HIỆN CÓ (mỗi căn chỉ nói điều CÓ trong dòng của nó - thông số hoặc lời 'chủ tả'; điều dòng không ghi như phòng ngủ ở tầng nào, diện tích từng phòng, công năng từng tầng thì nói 'để em hỏi lại chủ', KHÔNG tự suy theo nhu cầu khách):\n" +
          (kho || (minimumMet || mentioned.length
            ? "(trống)"
            : "(chưa lọc - chưa đủ khu vực + giá để lọc, đừng nói kho trống)")) +
          (giaTB
            ? `\n(${giaTB} - ước tính từ kho bên em, dùng để so khi khách hỏi "giá vậy ok không": nói rẻ/mắc hơn mặt bằng khoảng bao nhiêu %, KHÔNG gọi là thẩm định)`
            : "") +
          (gan && ganKq
            ? `\n(Đã lọc theo ý khách muốn ở gần ${nhanGan(gan)}. Khoảng cách là đường chim bay tính từ con đường của căn, ước tính - nói "khoảng", KHÔNG hứa chính xác, KHÔNG nói số nhà.${
              ganKq.length ? "" : " Không có căn nào đã định vị trong bán kính này - nói thật, gợi ý nới bán kính hoặc khu khác."
            })`
            : "") +
          (gan && khongThayMoc
            ? `\n(Khách muốn ở gần ${nhanGan(gan)} nhưng bên em CHƯA định vị được nơi đó - hỏi lại khách nơi đó ở đường nào / quận nào, KHÔNG đoán vị trí.)`
            : "") +
          (askedBlock
            ? "\n\nCĂN KHÁCH ĐANG NHẮC TỚI (khách vào từ web hoặc gõ mã - chào ĐÚNG căn này, trả lời thẳng vào nó; mục 'đã xác minh từ chủ nhà' được nói chắc, còn lại vẫn 'để em hỏi lại'):\n" +
              askedBlock
            : "") +
          (tuongTuBlock
            ? `\n\nCĂN TƯƠNG TỰ (cùng khu, giá 0,7–1,3 lần căn #${canGoc?.code ?? ""} - dùng khi căn khách hỏi đã chốt/đã gỡ hoặc khách hỏi "giống giống vầy"; nêu điểm giống, vẫn tối đa 3 căn một tin):\n` +
              tuongTuBlock
            : "") +
          (canDuAnBlock
            ? "\n\nCĂN TRONG DỰ ÁN KHÁCH HỎI (tình trạng từng căn đọc từ đây, KHÔNG đoán; dòng ghi 'QUÁ 7 NGÀY' thì 'để em xác nhận lại chủ' + ask_owner):\n" +
              canDuAnBlock
            : "") +
          (duAnKhuBlock
            ? `\n\nDỰ ÁN TRONG ${quanKhach?.toUpperCase() ?? "KHU VỰC"} KHÁCH ĐANG TÌM (kho kiến thức tham khảo, KHÔNG phải căn đang bán - khách hỏi "khu này có dự án gì" thì kể tối đa 3 tên kèm địa chỉ từ đây, đúng tên; nói rõ hiện bên em CHƯA có căn nào của các dự án này đang rao, có căn là báo; TUYỆT ĐỐI không kể dự án ngoài danh sách này):\n` +
              duAnKhuBlock
            : "") +
          (duanBlock
            ? "\n\nDỰ ÁN KHÁCH VỪA NHẮC TỚI (kiến thức chung ĐÃ XÁC THỰC - dùng trả lời TRỰC TIẾP câu hỏi tầng dự án: vị trí, chủ đầu tư, pháp lý dự án, tiện ích, mẫu nhà, quy cách bàn giao - KHÔNG cần 'hỏi lại chủ nhà'. " + "MỌI CON SỐ về dự án (diện tích từng loại căn, số căn, số tầng, giá, phí, năm bàn giao) CHỈ được lấy nguyên văn từ khối này. Không có ở đây thì nói thẳng 'con số đó em xác nhận lại rồi báo anh/chị' — TUYỆT ĐỐI không lấy từ trí nhớ của mình, kể cả khi thấy quen. " + "GIÁ từng căn KHÔNG có ở đây: khách hỏi giá thì nói 'để em kiểm tra giá lô đó rồi báo anh/chị liền'):\n" +
              duanBlock
            : ""),
      }],
      messages: [{
        role: "user",
        content: [
          ...(imageUrl
            ? [{ type: "image" as const, source: { type: "url" as const, url: imageUrl } }]
            : []),
          { type: "text" as const, text:
          (goiMua
            ? `CÁCH GỌI KHÁCH: "${goiMua}" - khách đã tự xưng/dặn, giữ nguyên mọi tin, không dùng "anh/chị".\n`
            : `CÁCH GỌI KHÁCH: chưa biết nam hay nữ - KHÔNG tự đoán "anh" hay "chị"; gọi "mình" hoặc bỏ đại từ.\n`) +
          `HỒ SƠ ĐÃ BIẾT về khách${buyer.name ? ` (tên: ${buyer.name})` : ""}:\n${known || "(chưa biết gì)"}\n\n` +
          (duTieuChiDeNgungDo
            ? `CHƯA BIẾT (chỉ NHẶT khi khách tự kể hoặc khi khách chê căn vừa gửi, TUYỆT ĐỐI không hỏi chủ động - đủ khu vực + giá là ngừng dò hồ sơ):\n${missing || "(đã đủ)"}\n\n`
            : `CÒN THIẾU (hỏi theo thứ tự ưu tiên; gộp 2-3 ý vào MỘT câu hỏi liền mạch cũng được, đừng thành bảng hỏi):\n${missing || "(đã đủ)"}\n\n`) +
          (duTieuChiDeNgungDo
            ? "Đã đủ tiêu chí tối thiểu (khu vực + giá) - NGỪNG hỏi hồ sơ, chuyển sang gợi ý căn khớp (KHO trống thì nói thật em lọc rồi báo) và để khách dẫn chuyện.\n"
            : "CHƯA đủ tiêu chí tối thiểu (khu vực + giá) - chưa gợi ý căn trừ khi khách hỏi thẳng một căn.\n") +
          // 14/09/2026 (bắn thật, FR-207): khách thấy "💾 Đã lưu nhu cầu: … để ở" rồi câu
          // ngay sau lại "chị muốn ở hay kinh doanh?" — model tự điền `purpose` từ "nhà có
          // mẹ già" rồi vẫn hỏi theo danh sách CÒN THIẾU (đọc từ hồ sơ ĐẦU lượt).
          "Trường nào em ĐIỀN vào profile ở CHÍNH lượt này (kể cả suy ra từ lời khách) là ĐÃ BIẾT - KHÔNG hỏi lại trường đó trong replies; khách sẽ thấy ngay dòng báo đã lưu.\n" +
          (interrogated
            ? "Hai tin trước em đều đã đặt câu hỏi - lượt này ĐƯA GIÁ TRỊ trước (gợi ý/thông tin), hỏi thật nhẹ hoặc không hỏi.\n"
            : "") +
          `\nHội thoại tới giờ:\n${convo}\n` +
          (imageUrl ? "\nKhách VỪA GỬI KÈM MỘT TẤM ẢNH (đính trên). Mô tả trung thực điều thấy được; đoán thì nói 'hình như là…' và xác nhận lại; KHÔNG suy diễn vật liệu/pháp lý từ ảnh.\n" : "") +
          (VOICE_RE_KD.test(tKD)
            ? "\nKhách VỪA XIN GỌI ĐIỆN/VOICE: trả lời 'để em nhờ anh/chị phụ trách gọi lại cho mình liền ạ', điền voice_request=true và need_human=true; KHÔNG đưa số điện thoại nào.\n"
            : "") +
          (danhGia
            ? `\nKhách VỪA CHẤM ${danhGia.stars}/5 SAO cho căn vừa xem (hệ thống đã ghi nhận, đừng hỏi lại điểm): cảm ơn ngắn${danhGia.stars <= 3 ? ", rồi hỏi đúng MỘT câu chưa ưng chỗ nào để em lọc tiếp" : ", hỏi có muốn xem thêm căn khác không"}.\n`
            : "") +
          (xemThemHinh
            ? "\nKhách VỪA XIN XEM THÊM HÌNH căn bot gửi lượt trước - hệ thống tự gửi 4 tấm kế, em chỉ nói ngắn 'dạ em gửi tiếp nè', KHÔNG hứa đi xin chủ nhà.\n"
            : "") +
          `\nSoạn lượt trả lời tiếp theo của EM và cập nhật hồ sơ:` },
        ],
      }],
    });
    moc.mua_tok_ra = resp.usage?.output_tokens ?? -1;
    moc.mua_tok_vao = resp.usage?.input_tokens ?? -1;
    moc.mua_tok_nho_doc = resp.usage?.cache_read_input_tokens ?? -1;
    moc.mua_tok_nho_ghi = resp.usage?.cache_creation_input_tokens ?? -1;
    if (resp.stop_reason !== "refusal") {
      // Lưới Groq vẫn trả `parsed_output` (nó dùng khuôn dự phòng); Anthropic trả chữ.
      const chu = (resp.content ?? []).map((b: { type: string; text?: string }) => b.type === "text" ? b.text ?? "" : "").join("");
      out = (resp.parsed_output as LuotMua | null) ?? (docLuotMuaTuChu(chu) as LuotMua | null);
      if (!out) await ghiLoi(client, "chat-reply model JSON hong", `stop=${resp.stop_reason} · ${chu.slice(0, 200)}`);
    }
    // Đo SAU khi đã cầm chắc câu trả lời trong tay: lượt buyer là lượt đắt nhất
    // (khối tĩnh ~5.800 chữ-máy), nên đây là con số quan trọng nhất của đồng hồ.
    await doTien(client, resp.usage);
  } catch (e) {
    // Chỗ này nguy hơn vẻ ngoài: model hỏng thì khối dưới vẫn dựng câu trả lời
    // bằng regex và trả 200 tử tế. Khách không thấy gì lạ, mã HTTP không thấy
    // gì lạ, nên bot_health_tick cũng mù. Phải tự ghi sổ (FR-152).
    await ghiLoi(client, "chat-reply model", e);
  }

  if (hoiGan && !ganTruocModel) ({ ganMoi, boGan } = await hoiGan);
  danhDau("mua_sau_model");
  // Fallback quy tắc: model hỏng ≠ khách nói không rõ — đừng đổ lỗi cho khách,
  // vẫn bóc được ngân sách/hẻm bằng regex và hỏi tiếp tiêu chí thiếu kế tiếp.
  if (!out) {
    const delta = regexProfileFallback(text);
    const nextMissing = BUYER_PROFILE_FIELDS
      .find(([k]) => (prefs[k] == null || prefs[k] === "") && delta[k] == null);
    out = {
      profile: delta,
      replies: [
        VOICE_RE_KD.test(tKD)
          ? "Dạ để em nhờ anh/chị phụ trách gọi lại cho mình liền ạ."
          : nextMissing
          ? `Dạ em ghi nhận rồi ạ. ${buyer.name ? `Anh/chị ${buyer.name}` : "Anh/chị"} cho em xin thêm ${nextMissing[1]} để em lọc đúng căn nha?`
          : "Dạ em ghi nhận rồi ạ. Em xem kỹ rồi báo lại anh/chị liền nha, anh/chị chờ em xíu!",
      ],
    };
  }
  // FR-79 (v48): khách đòi gọi điện — theo cờ model HOẶC regex (model quên thì
  // vẫn mở việc VOICE). Cần người thật là hệ quả bắt buộc.
  // 13/09/2026: model KHÔNG có căn nào trong tay (kho trống/chưa lọc, không căn
  // khách nhắc, không căn tương tự, không căn dự án) mà vẫn "Dạ có em" / "em đang
  // có vài căn…" → bỏ câu đó, nói thật. Câu lệnh đã dặn "không bịa" mà vẫn lọt
  // ở lượt bắn 12/09 (2/2 khách mua), nên chặn bằng code.
  if (!kho && !askedBlock && !tuongTuBlock && !canDuAn.length) {
    const ac = goiMua ?? "mình";
    const chan = chanHuaCoHang(
      out.replies,
      minimumMet || mentioned.length
        ? `hiện bên em chưa có căn nào khớp đúng nhu cầu này ạ. Em ghi lại rồi, có căn mới hợp là em báo ${ac} liền nha.`
        // 23/09/2026: câu cũ "em lọc kho … rồi báo lại liền nha" là lời hứa không ai làm (không hàng đợi nào gửi
        // sau). Chưa đủ tiêu chí thì xin đúng thứ còn thiếu — lượt sau đủ là kho lọc ngay.
        : `${ac} cho em xin thêm ${[!(prefsLoc.area != null || gan != null) ? "khu vực" : null, prefsLoc.budget == null ? "tầm giá" : null].filter(Boolean).join(" và ") || "tiêu chí"} để em lọc đúng căn nha.`,
      laHoiCoHang(text),
    );
    if (chan.daChan) {
      out.replies = chan.replies;
      console.log("chat-reply: chặn câu hứa có hàng khi kho trống");
    }
    // 23/09/2026 (bắn lại sau deploy #193): kho trống mà model tả "căn này hẻm xe hơi 4m P12, 50m2, 7,9 tỷ" —
    // căn không tồn tại. Bỏ bong bóng tả căn; còn lại trống thì nói thật.
    const boBia = boCanBia(out.replies);
    if (boBia !== out.replies) {
      out.replies = /chua co (?:can|tin) nao|chua co can/.test(boDau(boBia.join(" ")))
        ? boBia
        : [...boBia, `Dạ hiện bên em chưa có căn nào khớp đúng nhu cầu này ạ. Có căn mới hợp là em báo ${ac} liền nha.`];
      console.log("chat-reply: bỏ căn bịa khi kho trống");
    }
  }
  // 23/09/2026 (bắn lại sau deploy #193): kho CÓ căn khớp (Trần Bình Trọng 8 tỷ 2, khách "dưới 9 tỷ") mà model chỉ
  // "Dạ em lọc kho cho mình xem" rồi hỏi thêm — khách không thấy căn nào. Không nhắc căn nào trong kho mà có câu
  // hứa lọc/tìm → thay câu hứa bằng căn đầu kho (tiền định, chỉ chữ có trong kho).
  if (kho && minimumMet && !mentioned.length) {
    const dsKho = (listings ?? []) as CanRow[];
    const vb = boDau(out.replies.join(" "));
    const daNoiCan = dsKho.some((l) => vb.includes(boDau(l.code)) || (() => { const dc = boDau(l.location_raw ?? ""); return dc.length >= 5 && vb.includes(dc); })());
    if (!daNoiCan && out.replies.some((r) => laHuaCoHangCau(r, false))) {
      const l0 = dsKho[0];
      const moTa = [`${locLienHe(l0.location_raw ?? "").trim()} ${l0.ward ?? ""}`.trim(), l0.price_raw, l0.area_m2 ? `${Number(l0.area_m2)}m2` : null, l0.bedrooms ? `${l0.bedrooms}PN` : null]
        .filter(Boolean).join(" · ");
      const chan = chanHuaCoHang(out.replies, `em có căn #${l0.code} · ${moTa}, ${goiMua ?? "mình"} xem thử nha?`, false);
      if (chan.daChan) {
        out.replies = chan.replies;
        console.log(`chat-reply: thay lời hứa lọc kho bằng căn ${l0.code}`);
      }
    }
  }
  // 13/09/2026: khách hỏi "em là người hay máy" → model đáp "Em là người thật,
  // không phải máy đâu" (lượt bắn 13/09). Nói dối khách về bản chất trợ lý là
  // thứ không được phép lọt, dù câu lệnh dặn gì — chặn bằng code.
  out.replies = chanNhanLaNguoi(out.replies, goiMua ?? "mình");
  // 20/09/2026 (bắn thật mau-y-C): "cho mình xin số chủ nhà đi" → nói rõ đường đi qua người phụ trách.
  if (XIN_SO_CHU_RE.test(tKD)) {
    const ac = goiMua ?? "mình";
    out.replies = [
      `Dạ bên em không gửi số chủ nhà qua chat ạ. Có căn hợp, anh chị phụ trách bên em sẽ liên hệ ${ac} và dẫn ${ac} đi xem, làm việc trực tiếp với chủ nhà luôn.`,
      // 23/09/2026: "Dạ em chưa có SĐT chủ, bên em quản lý qua Zalo cho tiện ạ" — lời model nói ngược câu trên.
      ...out.replies.filter((r) => !/\b(?:so|sdt|so dien thoai|dien thoai)\b[^.?!]*\bchu\b/.test(boDau(r))),
    ];
  }
  // 23/09/2026 (FR-218 b): khách nói bot hiểu nhầm mà không câu nào xin lỗi → chèn lời xin lỗi (trước đổi xưng hô).
  out.replies = themXinLoiKhiHieuNham(text, out.replies, goiMua);
  // 23/09/2026: khách là chú mà model tự xưng "chú ghi nhớ rồi ạ" → "cháu ghi nhớ".
  out.replies = suaBotXungNhamKhach(out.replies, goiMua);
  // 16/09/2026: khách mua là chú/cô/bác → bot tự xưng "cháu" (cùng luật nhánh bán).
  out.replies = doiTuXung(out.replies, goiMua);
  // 22/09/2026 (bộ đo giọng B08, cùng lưới với nhánh bán): câu ≥ 6 từ lặp giữa hai bong bóng chỉ giữ lần đầu.
  out.replies = boCauTrung(out.replies);
  let canDangNoi: { code: string } | null = null;
  // 22/09/2026 (bộ đo giọng M06): kho ghi căn 12 Trần Hưng Đạo hẻm 6m mà bot nói "mặt tiền kinh doanh".
  // Căn đang nói = căn khách nhắc mã, hoặc căn trong kho mà địa chỉ xuất hiện trong câu bot / câu khách /
  // câu bot lượt trước ("căn đó"). Câu khẳng định trái với cột kho (hẻm ↔ mặt tiền, sổ riêng ↔ chung) thì bỏ.
  {
    const botTruoc = [...ordered].reverse().find((m) => m.sender === "bot")?.body ?? "";
    const vanBan = boDau(`${out.replies.join(" ")} ${text} ${botTruoc}`);
    const ungVien = [...askedArr, ...((listings ?? []) as CanRow[])];
    const canNoi = ungVien.find((l) => { const dc = boDau(l.location_raw ?? ""); return dc.length >= 5 && vanBan.includes(dc); }) ??
      (askedArr.length === 1 ? askedArr[0] : null);
    canDangNoi = canNoi ?? null;
    if (canNoi) {
      const truoc = out.replies;
      out.replies = boMauThuanCan(out.replies, canNoi);
      if (out.replies !== truoc) console.log(`chat-reply: bỏ câu mâu thuẫn với căn ${canNoi.code}`);
    }
    // 23/09/2026 (bắn 26 tin): "Dạ căn này hướng Đông, thoáng và sáng lắm ạ. Chưa có quy hoạch gì…" — kho không có
    // hướng lẫn quy hoạch. Câu khẳng định dữ kiện KHÔNG có trong dữ liệu (kho, căn khách nhắc, dự án) thì bỏ, nói
    // thật "em chưa có thông tin" và mở việc hỏi chủ cho căn đang nói (model chưa mở thì code mở).
    const acMua = goiMua ?? "mình";
    // Đang nói về MỘT CĂN thì chỉ dữ liệu căn làm chứng (khối dự án đối tác luôn có chữ "quy hoạch 1/500" — bắn lại
    // sau deploy #193, "không có quy hoạch gì cả" lọt vì thế). Không có căn nào đang nói thì mọi khối.
    const nguCanhDuLieu = (canNoi
      ? [kho, askedBlock, tuongTuBlock, canDuAnBlock]
      : [kho, askedBlock, tuongTuBlock, canDuAnBlock, duAnKhuBlock, duanBlock, duanNhaMinh]).map(String).join("\n");
    const bia = chanBiaDuKien(out.replies, nguCanhDuLieu);
    if (bia.bo.length) {
      out.replies = bia.replies;
      const muc = bia.bo.join(" với ");
      const maHoi = out.ask_owner?.listing_code ?? canNoi?.code ?? null;
      // Câu hỏi chủ PHẢI gồm đúng mục vừa bỏ — bắn lại sau deploy #195: model tự điền ask_owner "hướng nhà (…)"
      // (chép từ lịch sử) khi khách hỏi năm xây, nên "năm xây" không bao giờ tới chủ nhà.
      if (maHoi) {
        const qCu = out.ask_owner?.question?.trim() ?? "";
        out.ask_owner = { listing_code: maHoi, question: qCu && boDau(qCu).includes(boDau(muc)) ? qCu : muc };
      }
      if (!laHuaHoiChu(out.replies)) {
        out.replies.push(maHoi
          ? `Dạ ${muc} của căn này em chưa có thông tin chắc chắn, em hỏi lại chủ nhà rồi báo ${acMua} ngay nha.`
          : `Dạ ${muc} thì em chưa có thông tin chắc chắn ạ.`);
      }
      console.log("chat-reply: bỏ dữ kiện bịa", bia.bo.join(","));
    }
    // 23/09/2026: "Về giá, để em hỏi lại chủ nhà rồi báo anh liền" mà model KHÔNG mở ask_owner → lời hứa không ai
    // làm. Có căn đang nói thì code mở việc hỏi chủ bằng chính câu khách.
    if (!out.ask_owner?.question && canNoi && laHuaHoiChu(out.replies)) {
      out.ask_owner = { listing_code: canNoi.code, question: text.slice(0, 200) };
      console.log("chat-reply: mở ask_owner cho lời hứa hỏi chủ");
    }
    // 23/09/2026: "chợ An Đông là khu P12 Quận 5 phải không ạ?" — phường của địa danh do model đoán.
    const doanPhuong = boDoanPhuongDiaDanh(out.replies, `${nguCanhDuLieu}\n${text}\n${history.map((m) => m.body ?? "").join("\n")}`);
    if (doanPhuong.bo) {
      out.replies = doanPhuong.replies.length ? doanPhuong.replies : [`Dạ ${acMua}, em ghi nhận rồi ạ.`];
      console.log("chat-reply: bỏ câu đoán phường địa danh", doanPhuong.bo);
    }
    // 23/09/2026: khách "mai 9h sáng em qua xem được không" → bot hỏi ngược "Mai 9h sáng có được không?".
    out.replies = boCauVongLai(out.replies, text);
    // 22/09/2026 (bắn thật sau deploy #181): "gần chợ Hàng Thịt" khi kho chỉ nói "gần chợ Hoà Bình" — tên
    // riêng sau chợ / trường / bệnh viện… không có trong ngữ cảnh (kho, căn khách nhắc, dự án, lịch sử) thì
    // gọt tên, giữ loại ("gần chợ").
    const nguCanhTen = [kho, askedBlock, tuongTuBlock, canDuAnBlock, duAnKhuBlock, duanBlock, duanNhaMinh, text, ...history.map((m) => m.body ?? "")].map(String).join("\n");
    const truocTen = out.replies;
    out.replies = boTenRiengBia(out.replies, nguCanhTen);
    if (out.replies !== truocTen) console.log("chat-reply: gọt tên riêng không có trong kho");
    // FR-114 (e), bắn thật 22/09 sau deploy #184: model kể đúng ba dự án nhưng nói "bên em có vài dự án ĐANG
    // BÁN" (status_text của dự án) mà quên câu "chưa có căn nào đang rao" đã dặn — khách hiểu là có hàng.
    // Kho không có căn nào thuộc các dự án đó mà bong bóng nêu tên dự án thì nối một câu nói thật, tiền định, ngay sau nó.
    if (duAnKhuBlock && !coCanTrongDuAnKhu) {
      const tenDA = duAnKhuBlock.split("\n").map((d) => boDau(d.replace(/^• /, "").split(" - ")[0].trim())).filter((t) => t.length >= 4);
      const daNoi = out.replies.join(" ");
      if (!/chua co (?:can|tin) nao|chua co can/.test(boDau(daNoi))) {
        const i = out.replies.findIndex((r) => { const kd = boDau(r); return tenDA.some((t) => kd.includes(t)); });
        if (i >= 0) {
          out.replies.splice(i + 1, 0, `Hiện bên em chưa có căn nào của các dự án này đang rao, có căn là em báo ${goiMua ?? "mình"} liền ạ.`);
          console.log("chat-reply: nối câu 'chưa có căn nào đang rao' sau khối dự án trong quận");
        }
      }
    }
  }
  // 22/09/2026 (bộ đo giọng, ca M01/M02/M06 chạy model giả): câu dò tiền định "Anh/chị cho em xin thêm…"
  // và mọi câu model ở nhánh MUA chưa đi qua bộ lọc gạch chéo như nhánh bán (1952) → khách mua chưa
  // biết nam/nữ vẫn đọc "anh/chị". Cùng một lưới cho hai nhánh.
  if (!goiMua) out.replies = out.replies.map(boGachCheo);
  // 15/09/2026 (bắn thật K2): "phòng riêng hay share…? Ngoài ra, có cần toilet riêng, điều hòa
  // không?" — HUMAN_CHAT_RULES cho gộp ý vào MỘT câu hỏi, không phải hai câu hỏi.
  out.replies = motCauHoi(out.replies);
  // 14/09/2026 (bắn 16 hội thoại lần 3): câu dặn "đủ khu + giá thì ngừng dò" và "không hỏi
  // người thuê về mục đích" vẫn lọt 2/16 — bỏ câu hỏi "để ở hay đầu tư" bằng code.
  if (duTieuChiDeNgungDo || prefs.deal === "thue" || out.profile?.deal === "thue") {
    const bo = boHoiMucDich(out.replies);
    if (bo.daBo) {
      out.replies = bo.replies;
      console.log("chat-reply: bỏ câu dò mục đích (đủ tiêu chí / khách thuê)");
    }
  }
  // FR-218 b (24/09/2026): đủ quận + giá, kho có căn, khách chưa từng được đưa căn nào trong kho này, mà model
  // lượt này CHỈ hỏi dò → bỏ câu hỏi dò, đưa 2 căn đầu (đã xếp theo nghĩa) bằng chữ tiền định.
  if (duTieuChiDeNgungDo && minimumMet && (listings ?? []).length && !(askedListings ?? []).length && !out.send_photos && !out.viewing && !out.agreed_deal) {
    const cans: CanGoiY[] = ((listings ?? []) as CanRow[]).map((l) => {
      const ten = (l.location_raw ? tenDuong(l.location_raw) : "") || l.ward || "";
      const dong = [
        [ten, l.ward].filter((x, i, a) => x && a.indexOf(x) === i).join(" "),
        l.price_raw, l.area_m2 ? `${l.area_m2}m²` : null, l.floors_text, l.bedrooms ? `${l.bedrooms} phòng ngủ` : null,
      ].filter(Boolean).join(" · ");
      return { code: l.code, ten, dong };
    });
    const daDuaTruoc = coNhacCan(history.filter((m) => m.sender === "bot").map((m) => m.body), cans);
    // Chỉ khi model KHÔNG nói gì ngoài câu hỏi dò — khách hỏi chuyện khác ("quận 5 có dự án gì") mà model đã trả
    // lời thì để yên.
    const chiHoiDo = boCauHoiDo(out.replies.filter((x) => !/^\s*(?:🤖|💾|📝|📋)/u.test(x))).length === 0;
    if (chiHoiDo && !daDuaTruoc && !coNhacCan(out.replies, cans)) {
      out.replies = [...boCauHoiDo(out.replies), bongBongGoiYCan(cans, goiMua ?? "mình")];
      console.log("chat-reply: model chưa đưa căn dù đủ tiêu chí - đưa 2 căn đầu kho");
    }
  }
  // FR-218 c (24/09/2026, bắn thật sau #266): "Cả 2 căn đều có phòng ngủ ở tầng trệt" cho hai căn không ghi điều
  // đó — lời dặn trong prompt không đủ. Câu khẳng định đặc điểm mà dữ liệu căn không có → "em hỏi lại chủ".
  {
    const canDl: CanDuLieu[] = [...((listings ?? []) as CanRow[]), ...((askedListings ?? []) as Array<CanRow & { listing_facts?: Array<{ question: string; answer: string }> | null }>)]
      .map((l) => ({
        ten: (l.location_raw ? tenDuong(l.location_raw) : "") || "",
        du_lieu: [dongKho(l), l.description ?? "", l.floors_text ?? "",
          ...(("listing_facts" in l && Array.isArray(l.listing_facts)) ? l.listing_facts.map((f) => `${f.question}: ${f.answer}`) : [])].join(" · "),
      }));
    const dd = boDacDiemKhongCo(out.replies, canDl);
    if (dd.bo.length) {
      out.replies = dd.replies;
      console.log("chat-reply: bỏ câu khẳng định đặc điểm căn không ghi", dd.bo.join(","));
    }
  }
  const muonGoi = !!out.voice_request || VOICE_RE_KD.test(tKD);
  if (muonGoi) out.need_human = true;

  // Gộp hồ sơ: chỉ ghi đè trường model bóc được (không xoá điều đã biết).
  // Riêng notes (hoàn cảnh) là TÍCH LUỸ — nối thêm, đừng ghi đè mất "mẹ già ở
  // cùng" chỉ vì hôm nay khách nói "ưu tiên gần chợ".
  const delta: Record<string, unknown> = {};
  // FR-188 (10/09/2026): khách MUA nói "cần tìm gấp / mua gấp" → cờ gấp trong hồ
  // sơ (tiền định, laGap); "không gấp, từ từ" → false. CTV và ghép căn đọc cờ này.
  if (laGap(text)) delta.gap = true;
  else if (/\b(khong|ko|k|chua)\s*(?:can\s*)?(?:gap|voi)\b|\btu tu\b|\bkhong voi\b/.test(tKD)) delta.gap = false;
  // 14/09/2026 (bắn 16 hội thoại mua): mục đích / thời hạn / hoàn cảnh hay bị điền
  // bịa — chỉ giữ khi câu khách vừa nhắn có căn cứ (`locHoSoMua`). Trường bị gỡ thì
  // KHÔNG ghi (null = không đụng giá trị cũ), nên thứ đã biết từ trước vẫn còn.
  const hoSoLoc = locHoSoMua(out.profile, text);
  if (hoSoLoc.bo.length) console.log("chat-reply: gỡ trường hồ sơ không căn cứ", hoSoLoc.bo.join(","));
  for (const [k, v] of Object.entries(hoSoLoc.profile)) {
    if (v === null || v === "" || k === "name") continue;
    if (k === "notes" && typeof prefs.notes === "string" && prefs.notes) {
      // Gộp theo TỪNG Ý: model hay trả lại cả ghi chú cũ lẫn mới, so nguyên chuỗi
      // thì nối thêm cả đoạn cũ → "mẹ già ở cùng; mẹ già ở cùng; …" (13/09).
      const gop = gopGhiChu(prefs.notes, String(v));
      if (gop) delta.notes = gop;
    } else {
      delta[k] = v;
    }
  }
  // 23/09/2026 (bắn 26 tin): "ưu tiên sổ hồng riêng" → model ghi vào HOÀN CẢNH (notes). Đó là yêu cầu pháp lý:
  // ghi khoá riêng `phap_ly`, bỏ ghi chú nếu nó chỉ nói lại chuyện sổ. Khoá này KHÔNG nằm trong danh sách hỏi dò.
  const plMua = /\b(so hong rieng|shr|so rieng|so hong|so do|phap ly (?:ro rang|sach|chuan|day du))\b/.exec(tKD);
  if (plMua) {
    const PL_MUA: Record<string, string> = { "so hong rieng": "sổ hồng riêng", shr: "sổ hồng riêng", "so rieng": "sổ hồng riêng", "so hong": "sổ hồng", "so do": "sổ đỏ" };
    delta.phap_ly = PL_MUA[plMua[1]] ?? "pháp lý rõ ràng";
  }
  // Ghi chú chỉ nói lại chuyện sổ (model chép lại từ lịch sử ở lượt sau) → bỏ khi hồ sơ đã có pháp lý.
  {
    const nkd = typeof delta.notes === "string" ? boDau(delta.notes) : "";
    if (nkd && (delta.phap_ly || prefs.phap_ly) && /\b(?:so|phap ly|shr)\b/.test(nkd) && nkd.split(/\s+/).length <= 6) delete delta.notes;
  }
  // 23/09/2026: "em đang tìm mua căn hộ hoặc nhà nhỏ q5" — model bỏ trống loại hình. Câu nói rõ thì ghi.
  if (delta.property_type == null && (prefs.property_type == null || prefs.property_type === "")) {
    const muaCanHo = /\b(?:can ho|chung cu)\b/.test(tKD);
    const muaNha = /\bnha\s+(?:pho|hem|rieng|nho|mat tien|o|dat)\b/.test(tKD);
    if (muaCanHo) delta.property_type = muaNha ? "căn hộ hoặc nhà" : "căn hộ";
  }
  // 11/09: điều kiện gần tiện ích (regex, tien-ich.ts) — lưu cả nhãn đọc được
  // lẫn bản có cấu trúc để lượt sau lọc kho mà không cần khách nói lại.
  if (ganMoi) {
    delta.gan_tien_ich = nhanGan(ganMoi);
    delta.gan_tien_ich_loc = ganMoi;
  } else if (boGan) {
    // "thôi khỏi cần gần trường nữa" — gỡ hẳn, lượt sau không lọc theo nó.
    delta.gan_tien_ich = null;
    delta.gan_tien_ich_loc = null;
  }
  // FR-181: tên trợ lý của khách mua nằm trong hồ sơ (`preferences.ten_tro_ly`),
  // ghi một lần, đi chung RPC gộp hồ sơ — không thêm vòng DB nào.
  if (!prefs.ten_tro_ly) delta.ten_tro_ly = tenBot;
  if (xhMuaMoi && xhMuaMoi !== prefs.xung_ho) delta.xung_ho = xhMuaMoi;
  if (nhanMuon.length) delta.nhan = nhanLoc;
  // ─── HẬU KỲ: mọi việc ghi sổ sau khi đã có câu trả lời trong tay chạy SONG
  // SONG (FR-171 h). Trước bản này chúng nối đuôi nhau: ~8-12 vòng đi về DB
  // thành ~8-12 lần thời gian mạng, trong khi chẳng việc nào cần kết quả của
  // việc kia. Mỗi việc là một closure tự đủ; việc nào hỏng thì hỏng một mình
  // và đã có ghiLoi/lưới riêng bên trong. Thứ tự duy nhất phải giữ: tin KHÁCH
  // đã vào sổ từ đầu lượt, nên loạt bong bóng bot chèn ở đây luôn đứng sau.
  // FR-105: mọi bong bóng gửi NGƯỜI MUA qua bộ lọc liên hệ — model được dặn
  // không đưa số, nhưng dặn không phải là chặn.
  // 22/09/2026: khách mua là chú/cô/bác (hoặc "chào cháu" chưa rõ) → bot xưng cháu, cùng luật nhánh bán.
  const replies = doiTuXung(out.replies.map((r) => locLienHeBot(suaTuXungMua(r.split(TEN_GIU_CHO).join(tenBot)).trim())).filter(Boolean), goiMua, prefs.nhom_tuoi === "lon_tuoi" ? "lon_tuoi" : null);
  danhDau("mua_truoc_hau_ky");
  // FR-32: mã trong câu trả lời, không có thì lấy mã khách vừa nhắc (bot hay
  // gọi căn bằng tên đường thay vì lặp lại mã)
  const repliedCodes = [...replies.join("\n").matchAll(CODE_RE)]
    .map((m) => m[1].toUpperCase());
  const repliedCode = repliedCodes[0] ?? mentioned[0];
  // 23/09/2026 (bắn thật): model viết "#BDS-NP-Q5-0004 · Hùng Vương …" cho khách mua — FR-178 (a) cấm. Mã đã đọc
  // ở trên cho quan tâm / theo dõi / ảnh; giờ mới gỡ khỏi chữ gửi khách (thay bằng tên đường của căn nếu có).
  {
    const nhanCan: Record<string, string> = {};
    for (const l of [...((listings ?? []) as CanRow[]), ...((askedListings ?? []) as CanRow[])]) {
      const ten = tenDuong(l.location_raw ?? "") || l.ward || "";
      if (l.code && ten) nhanCan[l.code.toUpperCase()] = ten;
    }
    replies.splice(0, replies.length, ...boMaTinKhach(replies, nhanCan).map(boGachDai));
  }
  let photos: string[] = [];

  // Hồ sơ: FR-163 trộn bằng `||` phía DB (merge_buyer_prefs) thay vì ghi đè cả
  // object {...prefs, ...delta} — bản ghi-đè là đọc-trộn-ghi kinh điển: hai
  // lượt gối nhau là lượt sau chôn mất delta lượt trước bằng prefs cũ.
  const viecHoSo = async () => {
    if (Object.keys(delta).length > 0) {
      const { error: prefErr } = await client
        .rpc("merge_buyer_prefs", { p_buyer_id: buyer.id, p_delta: delta });
      if (prefErr) await ghiLoi(client, "chat-reply merge_buyer_prefs", prefErr.message);
    }
    if (out.profile.name && !buyer.name) {
      await client.from("buyers").update({ name: out.profile.name }).eq("id", buyer.id);
    }
  };

  // Bot bí / khách đòi người thật → gắn cờ (FR-135) + BÁO NGAY cho CTV đang
  // chăm đơn (FR-147). Quá 30 phút chưa ai đụng tay thì nudge leo tiếp lên
  // admin. Chống báo lặp: đã có escalation pending cho khách này thì thôi.
  // FR-79 (v48): đòi gọi điện là một việc VOICE riêng — note mở đầu "VOICE: "
  // để tầng DB nhặt gửi email [VOICE] (SRS-5.5); chống lặp theo đúng tiền tố
  // trong 24h, không dính vào việc 🙋 thường (một khách có thể có cả hai).
  const viecNguoiThat = async () => {
    if (!out.need_human) return;
    // ĐUA: bản trước ĐẾM việc escalation đang chờ rồi mới GHI. Hai tin "cho anh
    // gặp người thật" liền nhau → hai lượt cùng đếm 0 → CTV nhận hai việc cho
    // một khách. Đã dựng lại được trong e2e (ĐUA-4) trước khi vá: 2 việc.
    //
    // KHÔNG vá được bằng chỉ mục duy nhất — luật ở đây là "24 GIỜ TRƯỢT"
    // (nhánh VOICE) và "còn pending" (nhánh thường), mà cửa sổ trượt thì
    // `create unique index` không phát biểu nổi. Còn khoá
    // `unique (buyer_id) where kind='escalation' and status='pending'` thì SAI
    // HẲN: khách đang có việc "cần người thật" mà chốt kèo là `viecChot` bị DB
    // từ chối, CTV không được báo về một giao dịch đã chốt.
    // Nên đẩy nguyên hai điều kiện lọc đó xuống `mo_viec_can_nguoi_that`
    // (20260905h) — khoá tư vấn theo từng khách, luật giữ nguyên từng chữ.
    // Zalo ID che còn 4 số cuối, và tin cuối đi qua `locLienHe` — y như hai chỗ
    // khác trong file này (1204, 1515). Bản cũ ghi NGUYÊN Zalo ID và nguyên văn
    // câu khách vào `note`, mà `note` chảy thẳng ra `escalation-feed` rồi ra
    // email [VOICE]; đúng ngữ cảnh này (khách xin gọi điện) câu đó thường chứa
    // số điện thoại của chính họ (review 10/09, mục A4).
    const uidChe = `Zalo …${externalUserId.slice(-4)}`;
    const tinCuoi = locLienHe(text.slice(0, 120), true);
    const note = muonGoi
      ? `VOICE: ${uidChe} muốn gọi điện${buyer.name ? ` (${buyer.name})` : ""}. Tin cuối: "${tinCuoi}". Anh/chị gọi lại giúp em`
      : `🙋 khách cần người thật${buyer.name ? ` (${buyer.name})` : ""}. Tin cuối: "${tinCuoi}"`;
    const [, { error: nhErr }] = await Promise.all([
      client.from("conversations")
        .update({ needs_human: true, needs_human_at: new Date().toISOString() })
        .eq("id", convId),
      client.rpc("mo_viec_can_nguoi_that", {
        p_buyer_id: buyer.id,
        p_ctv_id: convRow.ctv_id ?? null,
        p_note: note,
        p_voice: muonGoi,
      }),
    ]);
    if (nhErr) await ghiLoi(client, "chat-reply escalation(buyer)", nhErr.message);
  };

  // FR-65 (v48): chấm sao sau buổi xem → RPC `ghi_danh_gia` (tầng DB, cùng
  // ngày do agent SQL tạo). Chưa có hàm thì lỗi vào sổ, khách vẫn được cảm ơn.
  const viecDanhGia = async () => {
    if (!danhGia) return;
    const { error: dgErr } = await client.rpc("ghi_danh_gia", {
      p_buyer_id: buyer.id, p_listing_id: danhGia.listing_id,
      p_stars: danhGia.stars, p_note: text.slice(0, 300),
    });
    if (dgErr) await ghiLoi(client, "chat-reply ghi_danh_gia", dgErr.message);
  };

  // FR-140: bot hứa "để em hỏi lại chủ nhà" → tạo info_request; trigger DB
  // định tuyến: chính chủ có Zalo → CTV còn liên lạc được → admin phụ trách
  // (kèm reminder escalation để nudge/bridge đi báo ngay).
  const viecHoiChu = async () => {
    if (!out.ask_owner?.question) return;
    const aoCode = maTinSach(out.ask_owner.listing_code ?? mentioned[0]);
    if (!aoCode) return;
    // .limit(1): một mã có thể khớp cả `code` của tin này lẫn `legacy_code` của
    // tin khác; maybeSingle() gặp 2 dòng là PGRST116 và cũng rơi về "không thấy".
    const { data: aoLst } = await client.from("listings").select("id")
      .or(`code.ilike.${aoCode},legacy_code.ilike.${aoCode}`).limit(1).maybeSingle();
    if (!aoLst) return;
    // chống hỏi trùng: đã có yêu cầu pending của KHÁCH NÀY cho căn này trong 24h thì thôi.
    // 23/09/2026 (bắn lại sau deploy #193): bản cũ chống trùng theo CĂN — khách A hỏi hướng, khách B hỏi giá
    // bớt cùng căn → câu của B bị nuốt, B không bao giờ nhận câu trả lời dù bot đã hứa "em hỏi lại chủ".
    const { data: aoCu, error: aoCuErr } = await client.from("info_requests")
      .select("id, question")
      .eq("listing_id", aoLst.id).eq("buyer_id", buyer.id).eq("status", "pending").eq("source", "buyer_ask")
      .gte("created_at", new Date(Date.now() - 24 * 3600e3).toISOString()).limit(1).maybeSingle();
    if (aoCuErr) await ghiLoi(client, "chat-reply hoi chu nha(doc cu)", aoCuErr.message);
    // 23/09/2026 (bắn lại sau deploy #194): cùng khách đã chờ "hướng nhà", nay hỏi thêm "quy hoạch" → bản trên
    // bỏ câu mới dù bot đã hứa hỏi. Câu CHƯA có trong việc đang chờ thì NỐI vào việc đó (chủ nhà đọc một tin).
    const aoCau = out.ask_owner.question.trim();
    if (aoCu && !boDau(String(aoCu.question ?? "")).includes(boDau(aoCau))) {
      const { error: aoNoiErr } = await client.from("info_requests")
        .update({ question: `${aoCu.question}; ${aoCau}`.slice(0, 500) }).eq("id", aoCu.id);
      if (aoNoiErr) await ghiLoi(client, "chat-reply hoi chu nha(noi cau)", aoNoiErr.message);
    }
    if (!aoCu && !aoCuErr) {
      // FR-140: câu khách hỏi chủ nhà. Hai khách cùng hỏi một câu về một căn
      // là chuyện thường — 23505 nghĩa là câu đó đang chờ chủ nhà trả lời rồi,
      // trả lời về sẽ tới cả hai khách. Không hỏi chồng.
      const { error: aoErr } = await client.from("info_requests").insert({
        listing_id: aoLst.id, buyer_id: buyer.id,
        question: out.ask_owner.question, status: "pending", source: "buyer_ask",
      });
      if (aoErr && aoErr.code !== "23505") {
        await ghiLoi(client, "chat-reply hoi chu nha", aoErr.message);
      }
    }
  };

  // Khách hứa gửi gì đó → đặt hẹn nhắc (FR-133)
  const viecLoiHua = async () => {
    if (!(out.promise?.when && out.promise?.what)) return;
    await client.from("reminders").insert({
      kind: "promise", buyer_id: buyer.id,
      due_at: mapDue(out.promise.when), note: `${out.promise.what} (hẹn: ${out.promise.when})`,
    });
  };

  // Khách chốt lịch xem nhà (UF-06 / FR-50…53) → ghi viewings + nhắc trước giờ.
  // Khách bổ sung SĐT / đổi giờ ở lượt sau là CẬP NHẬT lịch pending đang có,
  // không tạo lịch trùng (từng tạo 2 dòng cho 1 cuộc hẹn).
  const viecLichXem = async () => {
    if (!out.viewing?.when) return;
    // Soát 01/09 (vai người mua đã nhắm căn): mã do model điền chép theo cách
    // khách gõ — "bds-q5-0115" thường — mà kho lưu HOA và `.eq` phân biệt hoa
    // thường. Mọi cửa khác (ask_owner, agreed_deal, send_photos) đều `toUpperCase`
    // rồi, riêng cửa này thì không: lịch xem ghi thiếu `listing_id`, và lượt sau
    // khách bổ sung SĐT với mã viết hoa thì so sánh lệch → tạo lịch THỨ HAI, đúng
    // cái lỗi khối này từng được sửa để tránh.
    const vwCode = maTinSach(out.viewing.listing_code) || null;
    const slot = mapDue(out.viewing.when);
    const slotMs = Date.parse(slot);
    // Tra mã căn và lịch đang chờ cùng lúc — hai câu không nhìn nhau.
    const [{ data: lst }, { data: existVw }] = await Promise.all([
      vwCode
        ? client.from("listings").select("id").or(`code.ilike.${vwCode},legacy_code.ilike.${vwCode}`).limit(1).maybeSingle()
        : Promise.resolve({ data: null as { id: string } | null }),
      client.from("viewings")
        .select("id, listing_code")
        .eq("buyer_id", buyer.id).eq("status", "pending")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const listingId: string | null = lst?.id ?? null;
    const sameAppt = existVw &&
      (!vwCode || !existVw.listing_code ||
        String(existVw.listing_code).toUpperCase() === vwCode);
    let vwId: string | null = null;
    if (existVw && sameAppt) {
      const patch: Record<string, unknown> = { time_text: out.viewing.when, slot };
      if (out.viewing.phone) patch.phone = out.viewing.phone;
      if (vwCode && !existVw.listing_code) {
        patch.listing_code = vwCode;
        patch.listing_id = listingId;
      }
      vwId = existVw.id;
      await Promise.all([
        client.from("viewings").update(patch).eq("id", existVw.id),
        // dời giờ nhắc theo slot mới
        client.from("reminders")
          .update({ due_at: new Date(slotMs - 45 * 60e3).toISOString() })
          .eq("viewing_id", vwId).eq("kind", "viewing").eq("status", "pending"),
      ]);
    } else {
      // ĐUA: `existVw` đọc ở trên rồi mới ghi ở đây. Hai tin "mai 9h anh qua
      // xem nha" liền nhau → hai lượt cùng thấy "chưa có" → hai buổi xem cho
      // MỘT cuộc hẹn, rồi mỗi buổi đẻ một nhắc, khách bị nhắc hai lần.
      // `viewings_mot_hen_cho_moi_can_idx` chặn cú thứ hai; lượt thua đọc lại
      // dòng của lượt thắng để vẫn có `vwId` mà gắn nhắc — nếu bỏ trống thì
      // cuộc hẹn có mà không ai nhắc, tệ hơn cả trước khi vá.
      const { data: vw, error: vwErr } = await client.from("viewings").insert({
        buyer_id: buyer.id, listing_id: listingId,
        listing_code: vwCode, time_text: out.viewing.when,
        slot, phone: out.viewing.phone ?? null, status: "pending", source: "bot",
      }).select("id").maybeSingle();
      if (vwErr?.code === "23505") {
        const { data: lai } = await client.from("viewings")
          .select("id").eq("buyer_id", buyer.id).eq("status", "pending")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        vwId = lai?.id ?? null;
      } else if (vwErr) {
        await ghiLoi(client, "chat-reply ghi viewing", vwErr.message);
        vwId = null;
      } else {
        vwId = vw?.id ?? null;
      }
    }
    // Nhắc trước buổi xem ~45 phút (mẫu §6.8); lịch quá gần hoặc đã có nhắc thì thôi
    if (vwId && slotMs - Date.now() > 90 * 60e3) {
      const { count: remCnt } = await client.from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("viewing_id", vwId).eq("status", "pending");
      if ((remCnt ?? 0) === 0) {
        // Cùng kiểu đua với `viewings` ngay trên. 23505 nghĩa là lượt kia đã
        // đặt nhắc cho đúng buổi xem này — im lặng bỏ qua là ĐÚNG, mọi mã lỗi
        // khác thì phải vào sổ (FR-152 d).
        const { error: rmErr } = await client.from("reminders").insert({
          kind: "viewing", buyer_id: buyer.id, viewing_id: vwId,
          due_at: new Date(slotMs - 45 * 60e3).toISOString(),
          note: `lịch xem ${vwCode ? "#" + vwCode : "nhà"} lúc ${out.viewing.when}`,
        });
        if (rmErr && rmErr.code !== "23505") {
          await ghiLoi(client, "chat-reply nhac buoi xem", rmErr.message);
        }
      }
    }
  };

  // Loạt bong bóng bot vào sổ bằng MỘT câu INSERT (`seq` identity tăng theo
  // thứ tự mảng). Ghi hụt phải vào bot_errors (FR-152), không chặn trả lời.
  const viecGhiTraLoi = async () => {
    if (!replies.length) return;
    const { error: botErr } = await client.from("messages").insert(
      replies.map((r) => ({ conversation_id: convId, sender: "bot", body: r })),
    );
    if (botErr) await ghiLoi(client, "chat-reply messages bot(buyer)", botErr.message);
  };

  // FR-139: khách hỏi / bot đưa căn nào ra → đánh dấu "đang được quan tâm"
  // (7 ngày không ai hỏi nữa thì cron tự trả về đang bán)
  // FR-108 (v48): ghi luôn KHÁCH NÀO quan tâm (bảng `interests`) qua overload
  // `mark_listing_interest(p_codes, p_buyer_id)` (migration 20260904f của
  // agent SQL) — để lúc tin chốt còn biết báo ai. Căn khách xin hình / nhờ hỏi
  // chủ cũng là quan tâm. Overload chưa có (PGRST202) thì rơi về bản cũ chỉ
  // đổi trạng thái + ghi sổ, không được câm FR-139.
  const interestCodes = [...new Set([
    ...mentioned, ...repliedCodes,
    ...(out.send_photos ? [out.send_photos.toUpperCase()] : []),
    ...(out.ask_owner?.listing_code ? [out.ask_owner.listing_code.toUpperCase()] : []),
  ])];
  const viecQuanTam = async () => {
    if (!interestCodes.length) return;
    const { error: miErr } = await client.rpc("mark_listing_interest", {
      p_codes: interestCodes, p_buyer_id: buyer.id,
    });
    if (miErr) {
      await ghiLoi(client, "chat-reply mark_listing_interest(buyer)", miErr.message);
      await client.rpc("mark_listing_interest", { p_codes: interestCodes });
    }
  };

  // FR-142: khách ĐỒNG Ý chốt (chữ / emoji vui / like-tim theo AGREE_RULES) →
  // ghi deals + listing sang da_chot + báo gấp CTV/admin qua kênh escalation.
  const viecChot = async () => {
    if (!out.agreed_deal) return;
    const dealCode = maTinSach(out.agreed_deal.listing_code ?? mentioned[0] ?? repliedCode);
    if (!dealCode) return;
    // 15/09/2026: `sellers(...)` trần trên `listings` là PGRST201 (hai quan hệ, xem
    // ask-seller) — bản trước không đọc `error` nên khách "ok chốt" mà kèo KHÔNG
    // bao giờ vào `deals`, im lặng.
    const { data: dl, error: dlErr } = await client.from("listings")
      .select("id, price_vnd, seller_id, sellers!listings_seller_id_fkey(seller_type)")
      .or(`code.ilike.${dealCode},legacy_code.ilike.${dealCode}`).limit(1).maybeSingle();
    if (dlErr) await ghiLoi(client, "chat-reply chot keo doc listing", dlErr.message);
    if (!dl) return;
    const { count: dupDeal } = await client.from("deals")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", dl.id).eq("buyer_id", buyer.id);
    if ((dupDeal ?? 0) > 0) return;
    const sType = (dl.sellers as { seller_type?: string } | null)?.seller_type;
    // ĐUA: `count` ở trên đọc "chưa có" rồi mới ghi — hai tin "ok chốt nha" cách
    // nhau vài trăm ms là hai lượt cùng đọc 0. `deals_listing_buyer_key` chặn
    // được cú ghi thứ hai, nhưng bản trước KHÔNG đọc `error` nên lượt thua
    // tưởng mình ghi xong và vẫn chạy tiếp khối dưới: CTV nhận HAI tin "khách
    // vừa ĐỒNG Ý CHỐT, liên hệ gấp" cho cùng một kèo. Ràng buộc đã có sẵn, chỗ
    // hỏng nằm ở đây — đọc lỗi rồi dừng.
    const { error: dealErr } = await client.from("deals").insert({
      listing_id: dl.id, buyer_id: buyer.id,
      ctv_id: convRow.ctv_id,
      price_vnd: dl.price_vnd ?? null,
      // Chỉ hai loại có mức phí (BR-05: chính chủ 1%, môi giới 0,5%).
      // `unknown` — người bán mở từ chat (FR-159) chưa được phân loại —
      // phải để null chứ không được đổ về 0,5%: bản cũ `sType ? 0.5` coi
      // mọi giá trị khác `ccrb` là môi giới, tức chính chủ vào qua chat mà
      // chốt kèo trước khi phân loại là bị tính phí SAI một nửa. Xem OPEN-28.
      fee_pct: sType === "ccrb" ? 1.0 : sType === "nmg" ? 0.5 : null,
      closed_at: new Date().toISOString(),
    });
    if (dealErr) {
      // 23505 = lượt kia vừa ghi xong đúng kèo này. Không phải sự cố, nhưng
      // cũng KHÔNG được đi tiếp — đi tiếp là báo gấp lần hai.
      if (dealErr.code !== "23505") await ghiLoi(client, "chat-reply ghi deal", dealErr.message);
      return;
    }
    await Promise.all([
      client.from("listings").update({ status: "da_chot" }).eq("id", dl.id),
      client.from("reminders").insert({
        kind: "escalation", listing_id: dl.id, buyer_id: buyer.id,
        ctv_id: convRow.ctv_id, due_at: new Date().toISOString(),
        note: `🤝 khách vừa ĐỒNG Ý CHỐT căn #${dealCode}. Liên hệ làm hợp đồng gấp`,
      }),
    ]);
  };

  // FR-143: gửi hình thật kèm tin — nguồn là URL chính chủ đã gửi (facts
  // hinh_anh). Model điền send_photos; khách xin hình mà model quên thì vẫn
  // tự đính kèm theo mã khách nhắc.
  // "hinh" không dấu thêm vào (FR-161); "anh" trần thì KHÔNG — đó là đại từ,
  // thêm vào là mọi câu có chữ "anh" đều bị coi là xin ảnh.
  // FR-27 (v48): mỗi lượt ≤4 tấm; còn dư thì nhớ offset vào
  // `preferences.photo_offset` và câu trả lời kết bằng "xem thêm hình không
  // ạ?"; lượt sau "xem thêm" → gửi 4 tấm kế từ offset. Hết thì xoá offset.
  let conHinh = false;
  const viecAnh = async () => {
    const photoWanted = out!.send_photos ??
      (xemThemHinh
        ? offsetCu!.code!
        : /hình|ảnh|\bhinh\b|hinh anh|photo|\bpic\b/i.test(text) ? (mentioned[0] ?? repliedCode ?? null)
        // 23/09/2026: model hứa "em gửi hình liền" mà quên send_photos → đính kèm ảnh của căn đang nói (nếu có).
        : replies.some(laHuaGuiHinh) ? (repliedCode ?? canDangNoi?.code ?? null) : null);
    if (!photoWanted) return;
    const pCode = photoWanted.toUpperCase();
    const inAsked = ((askedListings ?? []) as Asked[]).find((l) => l.code === pCode);
    let tatCa: string[];
    if (inAsked) tatCa = photosOf(inAsked);
    else {
      // Cùng ranh giới với khối askedListings: `listing_photos_v` tự lọc tin đã
      // lên kệ (FR-167c), còn fact ảnh thì phải lọc ở đây — không thì URL ảnh
      // của tin chưa đăng / đã gỡ vẫn lọt qua cửa này.
      const [{ data: pStore }, { data: pFacts }] = await Promise.all([
        client.from("listing_photos_v").select("url").eq("code", pCode).limit(24),
        client.from("listing_facts")
          .select("answer, listings!inner(code, status)")
          .eq("question", "hinh_anh").eq("listings.code", pCode)
          .in("listings.status", ["dang_ban", "dang_quan_tam", "da_chot"]).limit(8),
      ]);
      tatCa = [
        ...(pStore ?? []).map((p) => p.url as string),
        ...(pFacts ?? []).flatMap((f) => (f.answer as string).match(PHOTO_URL_RE) ?? []),
      ];
    }
    const bd = offsetCu?.code === pCode ? (offsetCu.n ?? 0) : 0;
    photos = tatCa.slice(bd, bd + 4);
    conHinh = tatCa.length - bd - photos.length > 0;
    if (conHinh) delta.photo_offset = { code: pCode, n: bd + photos.length };
    else if (offsetCu) delta.photo_offset = null;
  };
  // Ảnh tính TRƯỚC hậu kỳ (một vòng thêm chỉ khi khách xin hình): câu "xem
  // thêm hình không ạ?" phải vào bong bóng cuối trước khi ghi sổ, và offset
  // phải nằm trong `delta` trước khi `viecHoSo` gộp hồ sơ.
  await viecAnh();
  // 23/09/2026 (bắn 26 tin): tin 0 ảnh, bot vẫn "Em gửi hình liền đây :)". Không có tấm nào để gửi → nói thật.
  if (!photos.length && replies.some(laHuaGuiHinh)) {
    const loiHinh = doiTuXung([`Căn này chủ nhà chưa gửi hình ạ, ${goiMua ?? "mình"} muốn xem thì em hẹn đi xem trực tiếp nha.`], goiMua, prefs.nhom_tuoi === "lon_tuoi" ? "lon_tuoi" : null)[0];
    replies.splice(0, replies.length, ...chanHuaGuiHinh(replies, loiHinh));
    console.log("chat-reply: chặn lời hứa gửi hình (không có ảnh)");
  }
  if (conHinh && !/xem thêm|thêm hình/i.test(replies.join(" "))) {
    if (replies.length) replies[replies.length - 1] += " Anh/chị xem thêm hình không ạ?";
    else replies.push("Dạ em gửi hình nè, anh/chị xem thêm hình không ạ?");
  }

  // FR-32: lượt này có nói về một căn cụ thể mà khách KHÔNG chốt lịch → nếu
  // khách im ~2,5 tiếng thì chủ động gửi thêm thông tin căn đó (tối đa 1 lần/24h;
  // khách nhắn lại thì reminder này bị hủy ở đầu lượt sau). Đếm + tra tin +
  // chèn nằm trong MỘT hàm DB `tao_followup` (20260902d) thay cho ba vòng.
  const viecFollowup = async () => {
    if (!repliedCode || out!.viewing) return;
    const { error: fuErr } = await client.rpc("tao_followup", {
      p_buyer_id: buyer.id, p_code: repliedCode,
    });
    if (fuErr) await ghiLoi(client, "chat-reply tao_followup", fuErr.message);
  };

  // 14/09/2026 — chủ dự án: "nhắn lại cho khách liền sau tin nhắn đó đã bóc tách
  // (thật vào db) gì". Bật công tắc `bao_lai_da_luu` thì hồ sơ phải ghi XONG trước
  // (không chạy song song nữa), đọc LẠI từ DB, rồi báo đúng khoá đã đổi ở bong bóng
  // ĐẦU TIÊN. Tắt thì y như cũ: một lượt rpc đọc công tắc, hồ sơ ghi song song.
  let hoSoDaGhi = false;
  if (replies.length) {
    try {
      const { data: cdMua, error: cdMuaErr } = await client.rpc("cau_hinh", { p_key: "bao_lai_da_luu" });
      if (cdMuaErr) await ghiLoi(client, "chat-reply cau_hinh(bao_lai_da_luu, mua)", cdMuaErr.message);
      if (docCheDo(cdMua) !== "tat") {
        await viecHoSo();
        hoSoDaGhi = true;
        const { data: bSau, error: bSauErr } = await client.from("buyers")
          .select("preferences").eq("id", buyer.id).maybeSingle();
        if (bSauErr) await ghiLoi(client, "chat-reply bao_lai_da_luu(buyers)", bSauErr.message);
        const bong = vuaLuuMua(prefs, (bSau as { preferences?: Record<string, unknown> } | null)?.preferences, BUYER_PROFILE_FIELDS);
        // Qua bộ lọc liên hệ như mọi bong bóng gửi người mua (FR-105) — ghi chú hoàn cảnh do model viết.
        if (bong) {
          // 💾 đã báo lưu gì → "Dạ chị, em ghi lại: mua nhà Quận 5 tầm 7 tỷ…" là ghi nhận lần hai.
          const conLai = boCauGhiNhan(replies);
          replies.splice(0, replies.length, locLienHe(bong), ...conLai);
        } else {
          // 24/09/2026 (chủ dự án): tin không bóc được gì cũng nói ra.
          replies.unshift(KHONG_BOC);
        }
      }
    } catch (e) {
      await ghiLoi(client, "chat-reply bao_lai_da_luu(mua)", e);
    }
  }

  await Promise.all([
    hoSoDaGhi ? Promise.resolve() : viecHoSo(), viecNguoiThat(), viecHoiChu(), viecLoiHua(), viecLichXem(),
    viecGhiTraLoi(), viecQuanTam(), viecChot(), viecFollowup(), viecDanhGia(),
  ]);

  return await hoanTat({
    reply: replies.join("\n"), replies, photos, conversation_id: convId,
    ...(conHinh ? { more_photos: true } : {}),
    ...(muonGoi ? { voice_request: true } : {}),
    ...(danhGia ? { rated: danhGia.stars } : {}),
  });
});
