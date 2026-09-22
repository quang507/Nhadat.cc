// hoi-ve-tin.ts — CHỦ NHÀ HỎI VỀ CHÍNH TIN CỦA MÌNH (22/09/2026, bắn thật căn hộ Hùng Vương Plaza).
//
// "hồi nãy anh nói giá bao nhiêu nhỉ" → bot đáp "em kiểm tra rồi báo lại" dù giá 4 tỷ 5 nằm ngay
// trong DB; "có khách nào hỏi chưa em" → bị nuốt làm câu trả lời chấm điểm. Chủ nhà hỏi thứ hệ
// thống ĐANG GIỮ thì trả lời tiền định từ DB, không nhờ model, không đoán. Tiền định, không mạng.
//
// Nhận diện chặt: câu phải có dáng HỎI (dấu hỏi, hoặc đuôi "chưa / không / nhỉ / vậy / sao … em")
// và KHÔNG mang con số kèm đơn vị (câu "giá 4 tỷ 3 được không?" là câu TRẢ LỜI kèm hỏi, đi đường cũ).

import { nhanDienFact } from "./khop-cau-tra-loi.ts";
import { donViGiaDep } from "./luat-tien.ts";

const boDau = (s: string): string =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export type LoaiHoiTin = "khach" | "gia" | "dien_tich" | "dia_chi" | "tang" | "huong" | "phap_ly" | "trang_thai" | "ban_chua";

export type TinTom = {
  code?: string | null; status?: string | null; price_raw?: string | null; area_m2?: number | string | null;
  location_raw?: string | null; ward?: string | null; district?: string | null; floor?: number | null;
  direction?: string | null; legal_status?: string | null; bedrooms?: number | null;
};
export type KhachTom = { quan_tam: number; hoi: number };

const CO_SO_DON_VI = /\d\s*(?:ty|ti|toi|trieu|tr\b|m2|m\b|pn|lau|tang|tam|x\s*\d)/;
const DANG_HOI = /\?|\b(?:bao nhieu|nhieu|may|nao|gi|sao|the nao|chua|khong|ko|nhi|nho|ha|ho|vay|a)\s*(?:em|chau|e|nhe|nha)?\s*[?.!]*$/;

/** Câu hỏi về tin → loại; không phải → null. */
export function hoiVeTin(text: string): LoaiHoiTin | null {
  const goc = (text ?? "").trim();
  if (!goc) return null;
  const kd = boDau(goc).replace(/\s+/g, " ").trim();
  if (CO_SO_DON_VI.test(kd)) return null;
  if (!DANG_HOI.test(kd)) return null;
  // Câu mang DỮ LIỆU ("Được giá, căn tôi sở hữu nhưng… có thông tin thêm không") là câu trả lời kèm hỏi
  // ngược → đi đường cũ (ghi fact + hỏi ngược), không phải hỏi về tin.
  if (nhanDienFact(goc)) return null;
  if (kd.split(" ").length < 3) return null;
  // 22/09/2026 (kịch bản C): "bán rồi hả em?" — model từng đáp "Chủ nhà bán rồi em chưa biết, để em hỏi
  // chủ nhà" với chính chủ nhà. Hỏi ĐÃ BÁN CHƯA là hỏi về tin: trả lời từ trạng thái, không nhờ model.
  if (/\b(?:ban roi|ban duoc chua|ban chua|da ban chua|ban dc chua|chot roi|chot chua|chot duoc chua|co ai mua|ai mua chua|mua chua)\b/.test(kd) && !/\bgia\b/.test(kd)) return "ban_chua";
  if (/\bkhach\b/.test(kd) && /\b(?:hoi|quan tam|xem|coi|nao|chua|co ai|nhieu)\b/.test(kd)) return "khach";
  if (/\b(?:ai|nguoi nao)\s+(?:hoi|quan tam|xem)\b/.test(kd)) return "khach";
  if (/\b(?:dang|len ke|len chua|dang chua|len tin|len web|dang tin)\b/.test(kd) && !/\bgia\b/.test(kd)) return "trang_thai";
  if (/\bgia\b/.test(kd) && /\b(?:bao nhieu|nhieu|nhi|the nao|la gi|hoi nay|luc nay|khi nay|nay|dang rao|de la|ghi)\b/.test(kd)) return "gia";
  if (/\b(?:dien tich|may m2|bao nhieu m2|rong bao nhieu|rong may)\b/.test(kd)) return "dien_tich";
  if (/\b(?:dia chi|o dau|duong nao|so nha|phuong nao|quan nao)\b/.test(kd)) return "dia_chi";
  if (/\btang\s+(?:may|bao nhieu|nao)\b/.test(kd)) return "tang";
  if (/\bhuong\s+(?:gi|nao)\b|\bhuong\b.*\b(?:gi|nao|sao)\b/.test(kd)) return "huong";
  if (/\b(?:phap ly|so hong|so do)\b.*\b(?:gi|sao|nao|chua|the nao)\b/.test(kd)) return "phap_ly";
  return null;
}

export const LEGAL_VI: Record<string, string> = {
  so_hong_rieng: "sổ hồng riêng", so_hong_chung: "sổ hồng chung", so_hong: "có sổ", hdmb: "hợp đồng mua bán",
  giay_tay: "giấy tay", cho_so: "đang chờ sổ",
};
const STATUS_VI: Record<string, string> = {
  dang_ban: "đang lên kệ rồi", dang_quan_tam: "đang lên kệ, có khách quan tâm", cho_thong_tin: "đang chờ thêm thông tin, chưa lên kệ",
  da_chot: "đã chốt, em gỡ khỏi kệ rồi", an: "đang tạm gỡ khỏi kệ",
};

/** Câu trả lời tiền định từ DB. `ac` = cách gọi khách. Không có dữ liệu thì nói thật là chưa có. */
export function dapHoiVeTin(loai: LoaiHoiTin, tin: TinTom, khach: KhachTom, ac: string): string {
  const chua = (thu: string) => `Dạ tin mình chưa có ${thu}, ${ac} cho em xin ${thu} nha.`;
  switch (loai) {
    case "khach": {
      const n = Math.max(khach.quan_tam, 0), h = Math.max(khach.hoi, 0);
      if (!n && !h) return `Dạ hiện chưa có khách nào hỏi căn này, có khách là em báo ${ac} liền ạ.`;
      return `Dạ căn này đang có ${n || h} khách quan tâm${h ? `, ${h} câu khách hỏi em đã chuyển ${ac}` : ""}; có gì mới em báo ${ac} liền ạ.`;
    }
    case "gia": return tin.price_raw ? `Dạ giá mình đang rao là ${donViGiaDep(tin.price_raw)} ạ.` : chua("giá");
    case "dien_tich": return tin.area_m2 ? `Dạ tin ghi diện tích ${tin.area_m2}m² ạ.` : chua("diện tích");
    case "dia_chi": {
      const dc = [tin.location_raw, tin.ward, tin.district].filter(Boolean).join(", ");
      return dc ? `Dạ tin ghi địa chỉ ${dc} ạ.` : chua("địa chỉ");
    }
    case "tang": return tin.floor != null ? `Dạ tin ghi tầng ${tin.floor} ạ.` : chua("số tầng");
    case "huong": return tin.direction ? `Dạ tin ghi hướng ${tin.direction} ạ.` : chua("hướng");
    case "phap_ly": return tin.legal_status ? `Dạ tin ghi pháp lý ${LEGAL_VI[tin.legal_status] ?? tin.legal_status} ạ.` : chua("pháp lý");
    case "trang_thai": return `Dạ tin mình ${STATUS_VI[tin.status ?? ""] ?? "đang được em theo dõi"} ạ.`;
    case "ban_chua": {
      if (tin.status === "da_chot") return `Dạ tin mình đã chốt, em gỡ khỏi kệ rồi ạ.`;
      const n = Math.max(khach.quan_tam, 0);
      return `Dạ chưa bán ạ, tin mình ${STATUS_VI[tin.status ?? ""] ?? "đang được em theo dõi"}${n ? `, đang có ${n} khách quan tâm` : ""}; có khách chốt là em báo ${ac} liền.`;
    }
  }
}
