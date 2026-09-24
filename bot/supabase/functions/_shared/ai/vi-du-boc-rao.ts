// FR-208 (g) — VÍ DỤ MẪU cho model bóc tách tin người bán (21/09/2026, học từ google/langextract:
// schema dạy bằng ví dụ có đáp án, trích dẫn nguyên văn). Mỗi ví dụ là một tin THẬT kiểu khách
// gõ + đáp án đúng. File này KHÔNG import gì để `bot/tests/vi-du-boc-rao.mjs` chạy được bằng bun:
// bài đó bắt MỌI trường trong đáp án phải qua `kiemDeXuat` — ví dụ dạy model thứ code sẽ bỏ là đỏ.
// Bốn ví dụ cuối là bốn chỗ model đọc SAI ở lượt bắn 21/09 (TS-AIBOC-07): "hẻm xe hơi" thành hiện
// trạng, "2000m2" thành chiều dài, "Thảo Điền" thành dự án, "25m2" ghi kèm đơn vị, lời hứa thành kiến thức.
import type { DeXuat } from "../extraction/kiem-bang-chung.ts";

export type ViDuBocRao = {
  cau_dang_hoi: string | null;
  tin: string;
  so_can: number;
  truong: DeXuat[];
  kien_thuc: string[];
  /** Vì sao đáp án như vậy — in vào prompt để model hiểu luật, không chỉ chép mẫu. */
  luu_y?: string;
};

const t = (khoa: string, gia_tri: string, trich_dan: string): DeXuat => ({ khoa, gia_tri, trich_dan, can: null });

export const VI_DU_BOC_RAO: ViDuBocRao[] = [
  {
    // Bắn thật 21/09 (mau-tdt): câu chào có tên đường lẫn trong câu → model trả RỖNG, tin không có địa chỉ.
    cau_dang_hoi: null,
    tin: "chào em, anh có căn nhà ở trần đình trọng muốn bán, em tư vấn giúp anh",
    so_can: 1,
    truong: [t("loai_giao_dich", "ban", "muốn bán"), t("loai_bds", "nha_pho", "căn nhà"), t("duong", "Trần Đình Trọng", "trần đình trọng")],
    kien_thuc: [],
    luu_y: "Câu chào vẫn có dữ liệu. Tên đường KHÔNG đổi chữ cái dù nghi gõ sai — hệ thống hỏi lại.",
  },
  {
    cau_dang_hoi: null,
    tin: "Bán nhà mặt tiền đường Châu Văn Liêm phường 14 quận 5, ngang 4.2m dài 18m, 1 trệt 3 lầu, đang cho thuê 45 triệu/tháng, giá 32 tỷ còn thương lượng",
    so_can: 1,
    truong: [
      t("loai_giao_dich", "ban", "Bán nhà"), t("loai_bds", "nha_pho", "nhà mặt tiền"),
      t("duong", "Châu Văn Liêm", "đường Châu Văn Liêm"), t("phuong", "14", "phường 14"), t("quan", "Quận 5", "quận 5"),
      t("ngang", "4.2", "ngang 4.2m"), t("dai", "18", "dài 18m"), t("so_tang", "4", "1 trệt 3 lầu"),
      t("thu_nhap_thue", "45 triệu", "đang cho thuê 45 triệu/tháng"), t("gia", "32 tỷ", "giá 32 tỷ"), t("thuong_luong", "co", "còn thương lượng"),
    ],
    kien_thuc: [],
    luu_y: "Tin BÁN đang cho thuê: 45 triệu/tháng là thu_nhap_thue, không phải gia. 1 trệt 3 lầu = 4 tầng.",
  },
  {
    cau_dang_hoi: null,
    tin: "🏠 BÁN GẤP NHÀ Q6 📍 Hẻm 5m Phạm Văn Chí, P.7 📐 4.2 x 12, nở hậu 4.5 🏗 Trệt lửng 2 lầu, 3PN 3WC 📜 SHR, hoàn công 2021 💰 6.9 tỷ TL",
    so_can: 1,
    truong: [
      t("loai_giao_dich", "ban", "BÁN GẤP NHÀ"), t("gap", "co", "BÁN GẤP"), t("quan", "Quận 6", "Q6"),
      t("do_rong_hem", "5", "Hẻm 5m"), t("duong", "Phạm Văn Chí", "Phạm Văn Chí"), t("phuong", "7", "P.7"),
      t("ngang", "4.2", "4.2 x 12"), t("dai", "12", "4.2 x 12"), t("no_hau", "4.5", "nở hậu 4.5"),
      t("so_tang", "3", "Trệt lửng 2 lầu"), t("so_phong_ngu", "3", "3PN"), t("so_wc", "3", "3WC"),
      t("phap_ly", "SHR, hoàn công 2021", "SHR, hoàn công 2021"), t("gia", "6.9 tỷ", "6.9 tỷ"), t("thuong_luong", "co", "TL"),
    ],
    // 24/09/2026 (AI khác soát prompt): bản trước đưa "hoàn công 2021" vào kien_thuc trong khi phap_ly đã có — tự phạm luật "không lặp ý đã có khoá".
    kien_thuc: [],
    luu_y: "Tin Facebook: bỏ biểu tượng, mỗi mảnh một trường. Lửng không tính so_tang.",
  },
  {
    cau_dang_hoi: "noi_that",
    tin: "khách chốt nhanh anh bớt 50 triệu",
    so_can: 0,
    truong: [],
    kien_thuc: [],
    luu_y: "\"bớt / giảm N\" là MỨC GIẢM, không phải gia, không phải thương lượng → không trường nào.",
  },
  {
    cau_dang_hoi: "phuong",
    tin: "ngang 5 dài 20 nha, hẻm xe hơi, để em coi lại sổ rồi báo",
    so_can: 0,
    truong: [t("ngang", "5", "ngang 5"), t("dai", "20", "dài 20")],
    kien_thuc: [],
    luu_y: "\"hẻm xe hơi\" không số mét → không phải do_rong_hem, không phải hien_trang. Lời hứa không vào kien_thuc.",
  },
  {
    cau_dang_hoi: null,
    tin: "Bán 2000m2 đất vườn Củ Chi đường Nguyễn Thị Rành xã Trung Lập Thượng, có 300m2 thổ, giá 1 tỷ 2 cả lô, gấp",
    so_can: 1,
    truong: [
      t("loai_giao_dich", "ban", "Bán 2000m2 đất vườn"), t("loai_bds", "dat_nong_nghiep", "đất vườn"), t("dien_tich", "2000", "2000m2"),
      t("quan", "Huyện Củ Chi", "Củ Chi"), t("duong", "Nguyễn Thị Rành", "đường Nguyễn Thị Rành"), t("gia", "1 tỷ 2", "giá 1 tỷ 2"), t("gap", "co", "gấp"),
    ],
    kien_thuc: ["có 300m2 thổ"],
    luu_y: "\"2000m2\" là dien_tich, không phải dai. Xã: chưa có ô.",
  },
  {
    cau_dang_hoi: null,
    tin: "Chào em, chị có villa Thảo Điền Thủ Đức 10x20 hồ bơi sân vườn 5 phòng ngủ, giá 68 tỷ, nội thất full, sổ hồng riêng hoàn công đủ",
    so_can: 1,
    truong: [
      t("loai_bds", "biet_thu", "villa"), t("quan", "TP Thủ Đức", "Thủ Đức"), t("ngang", "10", "10x20"), t("dai", "20", "10x20"),
      t("so_phong_ngu", "5", "5 phòng ngủ"), t("gia", "68 tỷ", "giá 68 tỷ"), t("noi_that", "full", "nội thất full"),
      t("phap_ly", "sổ hồng riêng hoàn công đủ", "sổ hồng riêng hoàn công đủ"),
    ],
    kien_thuc: ["hồ bơi sân vườn"],
    luu_y: "\"Thảo Điền\" là tên KHU, không phải du_an. Không nói bán hay thuê → không loai_giao_dich.",
  },
  {
    cau_dang_hoi: null,
    tin: "cho thue phong tro gan dh spkt thu duc 25m2 co gac may lanh 2tr8/thang coc 1 thang gio giac tu do",
    so_can: 1,
    truong: [
      t("loai_giao_dich", "cho_thue", "cho thue phong tro"), t("loai_bds", "phong_tro", "phong tro"), t("quan", "TP Thủ Đức", "thu duc"),
      t("dien_tich", "25", "25m2"), t("gia", "2tr8", "2tr8/thang"), t("tien_coc", "1 tháng", "coc 1 thang"),
    ],
    kien_thuc: ["gan dh spkt", "co gac may lanh", "gio giac tu do"],
    luu_y: "Trường số chỉ ghi SỐ (\"25\", không \"25m2\"). Cọc: \"1 tháng\".",
  },
  {
    cau_dang_hoi: null,
    tin: "Bán toà CHDV Phú Nhuận 6x22 hầm 6 tầng 24 phòng full khách, thu nhập 180 triệu/tháng, giá 45 tỷ, hẻm xe hơi 8m thông",
    so_can: 1,
    truong: [
      t("loai_giao_dich", "ban", "Bán toà CHDV"), t("loai_bds", "toa_nha", "toà CHDV"), t("quan", "Quận Phú Nhuận", "Phú Nhuận"),
      t("ngang", "6", "6x22"), t("dai", "22", "6x22"), t("ket_cau", "hầm 6 tầng", "hầm 6 tầng"),
      t("thu_nhap_thue", "180 triệu", "thu nhập 180 triệu/tháng"), t("gia", "45 tỷ", "giá 45 tỷ"), t("do_rong_hem", "8", "hẻm xe hơi 8m thông"),
    ],
    kien_thuc: ["24 phòng full khách"],
    luu_y: "Toà nhà BÁN: \"thu nhập N/tháng\" là thu_nhap_thue. Hẻm có số mét mới là do_rong_hem.",
  },
  {
    cau_dang_hoi: "vi_tri",
    tin: "nhà của anh ở hem 4m pham the hien, p4 q8 nha",
    so_can: 0,
    truong: [
      t("duong", "Phạm Thế Hiển", "pham the hien"), t("do_rong_hem", "4", "hem 4m"), t("phuong", "4", "p4"), t("quan", "Quận 8", "q8"),
    ],
    kien_thuc: [],
    luu_y: "Không dấu → tên đường viết lại CÓ DẤU, trích dẫn giữ nguyên văn. Chỉ tên đường vào duong; hẻm, phường đi ô riêng.",
  },
  // 24/09/2026 (chủ dự án chuyển nhận xét của AI khác sau khi đọc prompt xuất ra, lượt Trần Đình Xu): ý không có khoá
  // chép NGUYÊN VĂN, không đặt nhãn diễn giải (luật thoi_han_thue chỉ cho tin cho thuê nằm ở LUAT, boc-rao.ts).
  {
    cau_dang_hoi: "so_phong_ngu",
    tin: "4 phòng ngủ em, còn tầng 1 và 2 là để kinh doanh",
    so_can: 0,
    truong: [t("so_phong_ngu", "4", "4 phòng ngủ")],
    kien_thuc: ["tầng 1 và 2 là để kinh doanh"],
    luu_y: "Ý không có khoá → CHÉP NGUYÊN VĂN vào kien_thuc, không đặt nhãn (\"tiềm năng kinh doanh\"). \"tầng 1 và 2\" không phải tang.",
  },

];

/** Bản chữ để dán vào system prompt (sau LUAT, cùng khối cache). */
export function viDuThanhChu(ds: ViDuBocRao[] = VI_DU_BOC_RAO): string {
  return ds.map((v, i) => {
    const dau = v.cau_dang_hoi ? `Câu bot vừa hỏi chủ nhà: ${v.cau_dang_hoi}\n` : "";
    const ra = JSON.stringify({ so_can: v.so_can, truong: v.truong, kien_thuc: v.kien_thuc });
    return `VÍ DỤ ${i + 1}\n${dau}Tin nhắn chủ nhà: "${v.tin}"\nĐáp án: ${ra}${v.luu_y ? `\nVì sao: ${v.luu_y}` : ""}`;
  }).join("\n\n");
}
