// ghi-fact.ts — CỬA DUY NHẤT ghi fact tin rao từ edge function (SRS-5.1zzzzj, 09/10/2026).
//
// Bắn production 09/10: "MTKD đường Võ Văn Tần phường 6 quận 3 cũ" → fact `phuong` "Phường 6" → trigger DB đổ vào cột phường →
// bản nháp gửi khách "Phường 6, Quận 3" (không có phường mới nào tên đó). chat-reply có hơn 40 chỗ gọi `ghi_fact_listing`, khoá
// fact tính lúc chạy (`g.question`, `k`, `f.question`): soát từng chỗ thì chỗ thứ 41 lọt. Nay mọi lượt ghi fact đi qua hàm này, và
// MỘT luật ở đây: fact `phuong` (kể cả câu `vi_tri` chỉ là tên phường mà DB đổi sang `phuong`) mang tên phường MỚI có thật
// (`tenPhuongCot`, khop-phuong.ts) hay KHÔNG được ghi — câu phường còn treo, bot hỏi lại. `bot/tests/ghi-phuong-mot-cua.mjs` đỏ
// khi có chỗ gọi `rpc("ghi_fact_listing"` ngoài file này; DB (`20261009b`) chặn lần cuối và ghi sổ lỗi.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { laTenPhuongHopLe, tenPhuongCot } from "./extraction/khop-phuong.ts";

export type ThamSoFact = { p_listing_id: string | null | undefined; p_question: string; p_answer: string; p_source?: string | null };
/** `ghi`: câu trả lời ĐÃ ghi (fact phường: tên chuẩn) — lời xác nhận cho khách đọc chữ này, không đọc chữ khách gõ. */
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

/** Ghi một fact tin rao. Fact phường không chuẩn được → không ghi (`boQua`), không lỗi: bot hỏi lại phường như chưa biết. */
export async function ghiFact(client: SupabaseClient, a: ThamSoFact): Promise<KetQuaFact> {
  const answer = String(a.p_answer ?? "");
  const laPhuong = a.p_question === "phuong" || (a.p_question === "vi_tri" && viTriLaPhuong(answer));
  if (!laPhuong || laTenPhuongHopLe(answer.trim())) {
    const { data, error } = await client.rpc("ghi_fact_listing", a);
    return { data, error, ghi: answer };
  }
  // Phường số cũ cần quận cũ của căn ("phường 13" + Phú Nhuận) — đọc cột quận khi chuỗi chưa phải tên chuẩn.
  let quan: string | null = null;
  if (a.p_listing_id) {
    const { data: l, error: lErr } = await client.from("listings").select("district, boc_tach").eq("id", a.p_listing_id).maybeSingle();
    if (lErr) return { data: null, error: lErr };
    const macDinh = (l?.boc_tach as { quan_mac_dinh?: unknown } | null | undefined)?.quan_mac_dinh === true;
    quan = l?.district && !macDinh ? String(l.district) : null;
  }
  const ten = tenPhuongCot(answer, quan);
  if (!ten) {
    // Đường đi đúng thiết kế (khách nói tên không tra được) → console.log, KHÔNG vào sổ lỗi.
    console.log(`ghi-fact: phường "${answer.slice(0, 60)}" (quận ${quan ?? "?"}) không ra phường mới — không ghi, bot hỏi lại`);
    return { data: null, error: null, boQua: "phuong_khong_chuan" };
  }
  const { data, error } = await client.rpc("ghi_fact_listing", { ...a, p_question: "phuong", p_answer: ten });
  return { data, error, ghi: ten };
}
