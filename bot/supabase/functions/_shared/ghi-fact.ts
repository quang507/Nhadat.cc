// ghi-fact.ts — CỬA DUY NHẤT ghi fact tin rao từ edge function (SRS-5.1zzzzj, 09/10/2026).
//
// Bắn production 09/10: "MTKD đường Võ Văn Tần phường 6 quận 3 cũ" → fact `phuong` "Phường 6" → trigger DB đổ vào cột phường →
// bản nháp gửi khách "Phường 6, Quận 3" (không có phường mới nào tên đó). chat-reply có hơn 40 chỗ gọi `ghi_fact_listing`, khoá
// fact tính lúc chạy (`g.question`, `k`, `f.question`): soát từng chỗ thì chỗ thứ 41 lọt. Nay mọi lượt ghi fact đi qua hàm này, và
// MỘT luật ở đây: fact `phuong` (kể cả câu `vi_tri` chỉ là tên phường mà DB đổi sang `phuong`) mang tên phường MỚI có thật
// (`tenPhuongCot`, khop-phuong.ts) hay KHÔNG được ghi — câu phường còn treo, bot hỏi lại. `bot/tests/ghi-phuong-mot-cua.mjs` đỏ
// khi có chỗ gọi `rpc("ghi_fact_listing"` ngoài file này; DB (`20261009b`) chặn lần cuối và ghi sổ lỗi.
//
// SRS-5.1zzzzzzm (14/10/2026, người test thật): fact `vi_tri` cũng chuẩn hoá Ở ĐÂY — số nhà đứng trước, tên đường theo từ điển `duong`
// (chỉ khi khớp ĐÚNG sau bỏ dấu: `chonDuong` → `sua` / `khop`; khớp gần là việc của gợi ý hỏi xác nhận ở chat-reply, không phải của cửa).
// Trước đó ba đường ghi vi_tri (luật đã qua `suaTenDuong`, AI ghi cụm nguyên văn, lượt chốt tin ghi cụm nối lại) mỗi đường một kiểu chữ,
// và lượt chốt đã đè "1235 Huỳnh Tấn Phát" bằng "đường huỳnh tấn phát số 1235". Từ điển hỏng (RPC lỗi) thì vẫn ghi — chỉ mất phần
// sửa dấu, không chặn đường ghi (cùng luật FR-212).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { laTenPhuongHopLe, tenPhuongCot } from "./extraction/khop-phuong.ts";
import { chuanHoaViTri, tenDuongDeTra } from "./extraction/dia-chi.ts";
import { chonDuong, type UngVienDuong } from "./extraction/tra-duong.ts";
import { duongTraDuoc } from "./extraction/tra-phuong.ts";

export type ThamSoFact = { p_listing_id: string | null | undefined; p_question: string; p_answer: string; p_source?: string | null };
/** `ghi`: câu trả lời ĐÃ ghi (fact phường: tên chuẩn; fact vi_tri: địa chỉ đã chuẩn hoá) — lời xác nhận cho khách đọc chữ này, không đọc chữ khách gõ. */
export type KetQuaFact = { data: unknown; error: { message: string; code?: string } | null; boQua?: "phuong_khong_chuan"; ghi?: string };

const boDau = (s: string): string =>
  s.normalize("NFC").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
/**
 * Bản TS của nhánh đầu `ghi_fact_listing` (20260928f, FR-241): câu `vi_tri` chỉ là "xã / phường / thị trấn …", không có dấu hiệu
 * đường / hẻm / số nhà → DB ghi nó thành fact `phuong`. Cửa này phải biết trước để tên phường đó cũng qua `tenPhuongCot`.
 */
export function viTriLaPhuong(answer: string): boolean {
  const kd = boDau(answer.trim());
  return /^(xa|phuong|thi tran)\s+\S/.test(kd) && !/(duong|\bhem\b|\bngo\b|\bkiet\b|\bso\s*[0-9]|[0-9]+\s*\/|,\s*[0-9])/.test(kd);
}

/** Quận cũ đang ghi của căn (null khi trống hay còn mặc định) — dùng cho cả hai phép chuẩn hoá. */
async function quanCua(client: SupabaseClient, listingId: string | null | undefined): Promise<{ quan: string | null; error: { message: string } | null }> {
  if (!listingId) return { quan: null, error: null };
  const { data: l, error } = await client.from("listings").select("district, boc_tach").eq("id", listingId).maybeSingle();
  if (error) return { quan: null, error };
  const macDinh = (l?.boc_tach as { quan_mac_dinh?: unknown } | null | undefined)?.quan_mac_dinh === true;
  return { quan: l?.district && !macDinh ? String(l.district) : null, error: null };
}

/**
 * Tên đường TỪ ĐIỂN khớp đúng tên khách gõ trong `viTri` (bỏ dấu, hoa thường), hay null. Khớp gần / không có / RPC hỏng → null.
 * RPC hỏng là sự cố nhưng không chặn đường ghi — nơi gọi vẫn ghi địa chỉ chữ khách; sổ lỗi do `ghiLoi` ở chat-reply (cùng lượt
 * `suaTenDuong` đã ghi) — ở đây chỉ `console.log` để không đẻ hai dòng cho một lần RPC hỏng.
 */
async function tenDuongTuDien(client: SupabaseClient, viTri: string, quan: string | null): Promise<string | null> {
  const goc = tenDuongDeTra(viTri);
  if (!goc || !duongTraDuoc(goc)) return null;
  const { data, error } = await client.rpc("tim_duong", { p_ten: goc, p_quan: quan });
  if (error) { console.log(`ghi-fact: tim_duong hỏng cho "${goc}": ${error.message}`); return null; }
  const ds = (data ?? null) as UngVienDuong[] | null;
  const kq = chonDuong(goc, ds, quan);
  if (kq.loai === "sua") return kq.ten;
  // Khớp đúng mà không cần sửa: khách gõ đúng y một tên (giữ chữ khách — đã là tên từ điển) hoặc nhiều tên cùng chữ bỏ dấu (không đoán).
  if (kq.loai === "giu" && kq.khop) {
    const dung = (ds ?? []).filter((u) => u.khoang_cach === 0 && boDau(u.ten) === boDau(goc));
    return dung.length === 1 ? dung[0].ten : null;
  }
  return null;
}

/** Ghi một fact tin rao. Fact phường không chuẩn được → không ghi (`boQua`), không lỗi: bot hỏi lại phường như chưa biết. */
export async function ghiFact(client: SupabaseClient, a: ThamSoFact): Promise<KetQuaFact> {
  let answer = String(a.p_answer ?? "");
  const laPhuong = a.p_question === "phuong" || (a.p_question === "vi_tri" && viTriLaPhuong(answer));
  if (a.p_question === "vi_tri" && !laPhuong && answer.trim()) {
    const { quan, error: qErr } = await quanCua(client, a.p_listing_id);
    if (qErr) return { data: null, error: qErr };
    answer = chuanHoaViTri(answer, await tenDuongTuDien(client, answer, quan));
    const { data, error } = await client.rpc("ghi_fact_listing", { ...a, p_answer: answer });
    return { data, error, ghi: answer };
  }
  if (!laPhuong || laTenPhuongHopLe(answer.trim())) {
    const { data, error } = await client.rpc("ghi_fact_listing", a);
    return { data, error, ghi: answer };
  }
  // Phường số cũ cần quận cũ của căn ("phường 13" + Phú Nhuận) — đọc cột quận khi chuỗi chưa phải tên chuẩn.
  const { quan, error: qErr } = await quanCua(client, a.p_listing_id);
  if (qErr) return { data: null, error: qErr };
  const ten = tenPhuongCot(answer, quan);
  if (!ten) {
    // Đường đi đúng thiết kế (khách nói tên không tra được) → console.log, KHÔNG vào sổ lỗi.
    console.log(`ghi-fact: phường "${answer.slice(0, 60)}" (quận ${quan ?? "?"}) không ra phường mới — không ghi, bot hỏi lại`);
    return { data: null, error: null, boQua: "phuong_khong_chuan" };
  }
  const { data, error } = await client.rpc("ghi_fact_listing", { ...a, p_question: "phuong", p_answer: ten });
  return { data, error, ghi: ten };
}
