// geocode-listings — điền lat/lng cho listing từ location_raw (FR-122).
// Nominatim/OSM free: 1 req/s, có User-Agent. Cache theo câu query để các tin
// cùng đường dùng chung kết quả. Chạy lặp tới khi hết (mỗi lần tối đa ~90s).
//
// ĐƯA VÀO REPO 27/08/2026 (soát mã nguồn). Trước đó function này ACTIVE trên
// Supabase từ 25/08 mà KHÔNG có một dòng nào trong git: dựng lại project từ
// repo là mất hẳn, mà sửa hay review thì không có gì để đọc. Bản này chép
// nguyên văn từ bản đang chạy (version 1), không sửa một ký tự.
import { createClient } from "npm:@supabase/supabase-js@2";

const UA = "nhadatcc-geocoder/1.0 (admin.buyerside@nhadat.cc)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function queriesFor(row: { location_raw: string | null; ward: string | null }): string[] {
  const out: string[] = [];
  const raw = (row.location_raw ?? "").trim();
  const ward = row.ward ? `, ${row.ward}` : "";
  if (raw) {
    out.push(`${raw}${ward}, Quận 5, Thành phố Hồ Chí Minh`);
    // bỏ "hẻm 123 " / số nhà đầu chuỗi → chỉ còn tên đường
    const street = raw.replace(/^\s*(hẻm|hem)?\s*[\d/]+\s*/i, "").trim();
    if (street && street !== raw) {
      out.push(`${street}${ward}, Quận 5, Thành phố Hồ Chí Minh`);
    }
  }
  if (row.ward) out.push(`${row.ward}, Quận 5, Thành phố Hồ Chí Minh`);
  return out;
}

Deno.serve(async () => {
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: rows } = await db
    .from("listings")
    .select("id, location_raw, ward")
    .is("lat", null)
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
      } catch {
        point = null;
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
