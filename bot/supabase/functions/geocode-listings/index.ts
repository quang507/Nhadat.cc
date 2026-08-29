// geocode-listings — điền lat/lng cho listing từ location_raw (FR-122).
// Nominatim/OSM free: 1 req/s, có User-Agent. Cache theo câu query để các tin
// cùng đường dùng chung kết quả. Chạy lặp tới khi hết (mỗi lần tối đa ~90s).
//
// ĐƯA VÀO REPO 27/08/2026 (soát mã nguồn). Trước đó function này ACTIVE trên
// Supabase từ 25/08 mà KHÔNG có một dòng nào trong git: dựng lại project từ
// repo là mất hẳn, mà sửa hay review thì không có gì để đọc.
import { createClient } from "npm:@supabase/supabase-js@2";

const UA = "nhadatcc-geocoder/1.0 (admin.buyerside@nhadat.cc)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// SỬA 27/08/2026: quận lấy từ CHÍNH DÒNG TIN, không hardcode "Quận 5" nữa.
// Kho có tin Quận 1 (BDS-Q5-0154, mặt tiền Trần Hưng Đạo) — mọi truy vấn của nó
// đều bị dán đuôi ", Quận 5" nên Nominatim trả rỗng, tin nằm ngoài bản đồ vĩnh
// viễn mà không ai thấy lỗi. Mã tin mang tiền tố BDS-Q5 không có nghĩa BĐS ở Q5.
//
// Thêm một nấc lùi nữa: BỎ PHƯỜNG. Thử thật 27/08 trên chính tin đó —
//   "Đường Trần Hưng Đạo, Phường Nguyễn Cư Trinh, Quận 1, TP.HCM" → []
//   "Đường Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh"          → 10.7561670, 106.6844352
// Tên phường sau sáp nhập 2025 nhiều chỗ chưa có trong OSM; kèm vào là giết
// luôn kết quả đúng. Thứ tự: hẹp trước, mỗi nấc bỏ bớt một ràng buộc.
function queriesFor(
  row: { location_raw: string | null; ward: string | null; district: string | null },
): string[] {
  const out: string[] = [];
  const raw = (row.location_raw ?? "").trim();
  const quan = (row.district ?? "Quận 5").trim();
  const duoi = `${quan}, Thành phố Hồ Chí Minh`;
  const ward = row.ward ? `, ${row.ward}` : "";
  if (raw) {
    out.push(`${raw}${ward}, ${duoi}`);
    if (ward) out.push(`${raw}, ${duoi}`);
    // bỏ "hẻm 123 " / số nhà đầu chuỗi → chỉ còn tên đường
    const street = raw.replace(/^\s*(hẻm|hem)?\s*[\d/]+\s*/i, "").trim();
    if (street && street !== raw) {
      out.push(`${street}${ward}, ${duoi}`);
      if (ward) out.push(`${street}, ${duoi}`);
    }
  }
  if (row.ward) out.push(`${row.ward}, ${duoi}`);
  return out;
}

Deno.serve(async (req) => {
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── CỔNG (soát bảo mật 29/08/2026) ───────────────────────────────────────
  // Hàm này không có cron, "gọi tay khi có tin mới" — nhưng đo thật bằng
  // publishable key (khoá công khai nằm trong bundle JS) thì nó CHẠY: trả 200
  // và ghi lat/lng. Nghĩa là người lạ bắn được vòng lặp gọi Nominatim/OSM bằng
  // User-Agent của dự án (dễ ăn ban IP của bên thứ ba) và ghi đè toạ độ tin.
  // Không import _shared/claude.ts để giữ hàm này độc lập như cũ.
  const { data: bimat } = await db.rpc("get_secret", { secret_name: "BRIDGE_SECRET" });
  const laDichVu = req.headers.get("authorization") ===
    `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (bimat && !laDichVu && req.headers.get("x-bridge-secret") !== bimat) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  // Tin KHÔNG có cả địa chỉ lẫn phường thì không có gì để tra — lọc ngay ở đây
  // thay vì đếm chúng vào `failed` mỗi lần chạy. Kho 27/08 có 9 dòng rỗng hoàn
  // toàn (0165–0173, nhập hụt từ Excel), chúng làm báo cáo lúc nào cũng đỏ.
  const { data: rows } = await db
    .from("listings")
    .select("id, location_raw, ward, district")
    .is("lat", null)
    .or("location_raw.not.is.null,ward.not.is.null")
    .limit(300);

  const cache = new Map<string, [number, number] | null>();
  let updated = 0, failed = 0, calls = 0;
  const t0 = Date.now();

  for (const row of rows ?? []) {
    if (Date.now() - t0 > 90_000) break; // giữ dưới wall-clock; chạy lại là tiếp
    let point: [number, number] | null = null;
    for (const q of queriesFor(row)) {
      if (cache.has(q)) {
        point = cache.get(q)!;
        if (point) break; else continue;
      }
      calls++;
      await sleep(1100);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
          { headers: { "User-Agent": UA } },
        );
        const js = await res.json();
        point = js?.[0] ? [Number(js[0].lat), Number(js[0].lon)] : null;
      } catch (e) {
        // FR-152: đừng nuốt. Hàm này trả 200 kèm `failed` dù mọi lượt đều hỏng,
        // nên không có sổ thì một đợt Nominatim chặn IP nhìn hệt như "địa chỉ
        // khó tra". Gọi thẳng RPC để khỏi kéo thêm file vào bản deploy.
        point = null;
        await db.rpc("log_loi", {
          p_source: "geocode-listings",
          p_detail: `${q} → ${e instanceof Error ? e.message : String(e)}`,
          p_code: null,
        });
      }
      cache.set(q, point);
      if (point) break;
    }
    if (point) {
      await db.from("listings").update({ lat: point[0], lng: point[1] }).eq("id", row.id);
      updated++;
    } else {
      failed++;
    }
  }

  const { count } = await db
    .from("listings").select("id", { count: "exact", head: true }).is("lat", null);
  return new Response(
    JSON.stringify({ updated, failed, api_calls: calls, remaining_null: count }),
    { headers: { "Content-Type": "application/json" } },
  );
});
