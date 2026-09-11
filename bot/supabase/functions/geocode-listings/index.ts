// geocode-listings — điền lat/lng cho listing từ địa chỉ (FR-122) và nạp tiện
// ích quanh nó (11/09/2026). Nominatim/OSM free: 1 req/s, có User-Agent. Cache
// theo câu tra để các tin cùng đường dùng chung kết quả.
//
// ĐƯA VÀO REPO 27/08/2026 (soát mã nguồn). Trước đó function này ACTIVE trên
// Supabase từ 25/08 mà KHÔNG có một dòng nào trong git: dựng lại project từ
// repo là mất hẳn, mà sửa hay review thì không có gì để đọc.
//
// 11/09/2026 — "tìm nhà gần bệnh viện cách 1 km": đo thật thì 0/37 tin có toạ
// độ. Hàm này không có cron nên không ai gọi, và câu tra luôn kèm quận có dấu
// — OSM TP.HCM bỏ ranh giới quận từ 07/2025 nên Nominatim trả rỗng. Bản này:
//   - lấy việc qua RPC `tin_can_geocode` (migration 20260911g), cron
//     `geocode-tick` gọi 10 phút một lần khi CÓ việc;
//   - câu tra dựng ở `_shared/geocode.ts`: bỏ số nhà (toạ độ chỉ tới mức
//     đường, đúng lời /ban-do hứa), thêm nấc không quận, nấc không dấu;
//   - có toạ độ thì nạp điểm OSM trong 3 km (Overpass) vào bảng `tien_ich` và
//     ghi `tien_ich_gan` — thứ chat-reply dùng để lọc "gần bệnh viện 1 km".
import { serviceClient } from "../_shared/claude.ts";
import { congBiMat } from "../_shared/gate.ts";
import {
  cauOverpass, type DiemOsm, docDiemOsm, ganNhatMoiLoai, laTinhNgoai, queriesDuAn, queriesFor, trongVung,
  trongVungQuan, viewboxQuan, type VungQuan, vungQuan,
} from "../_shared/geocode.ts";

const UA = "nhadatcc-geocoder/1.0 (admin.buyerside@nhadat.cc)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Máy chủ chính hay "too busy" (đo 11/09 từ máy văn phòng); gọi từ hạ tầng
// Supabase thì chạy. Có máy phụ để một lần bận không làm trễ cả lượt.
// Lượt chạy thật đầu tiên (11/09) cả hai máy đều hỏng: máy chính trả 406 (gọi
// từ DB thì 504 "too busy"), máy phụ quá 35 s. Thêm máy thứ ba.
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const CHAN_THOI_GIAN_MS = 110_000; // dưới wall-clock 150s; chạy lại là tiếp

type Viec = {
  id: string; location_raw: string | null; street: string | null; ward: string | null;
  district: string | null; quan_mac_dinh: boolean; lat: number | null; lng: number | null;
  toa_do_muc: string | null; du_an_lat: number | null; du_an_lng: number | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const loiChu = (e: unknown) => e instanceof Error ? e.message : String(e);

Deno.serve(async (req) => {
  const db = serviceClient();

  // ── CỔNG (soát bảo mật 29/08/2026) ───────────────────────────────────────
  // Gọi bằng publishable key từng CHẠY được: người lạ bắn vòng lặp gọi
  // Nominatim/OSM bằng User-Agent của dự án (dễ ăn ban IP của bên thứ ba) và
  // ghi đè toạ độ tin. 02/09 (FR-171 k): dùng cổng chung `_shared/gate.ts`.
  const chan = await congBiMat(req, db, "geocode-listings");
  if (chan) return chan;

  // FR-152: đừng nuốt lỗi — hàm này trả 200 kèm `failed`, không có sổ thì một
  // đợt OSM chặn IP nhìn hệt như "địa chỉ khó tra".
  const ghiLoi = (detail: string) =>
    db.rpc("log_loi", { p_source: "geocode-listings", p_detail: detail.slice(0, 400), p_code: null });

  const { data: viec, error: vErr } = await db.rpc("tin_can_geocode", { p_limit: 40 });
  if (vErr) {
    await ghiLoi(`tin_can_geocode → ${vErr.message}`);
    return json({ error: vErr.message }, 500);
  }

  const cache = new Map<string, [number, number] | null>();
  const osmCache = new Map<string, DiemOsm[] | null>();
  let updated = 0, failed = 0, calls = 0, poi = 0, poiFail = 0;
  let lanNominatim = 0;
  const t0 = Date.now();

  // `vung`: quận cũ của tin → chỉ tìm trong hộp quanh quận đó (xem vungQuan).
  const traNominatim = async (q: string, vung: VungQuan | null = null): Promise<[number, number] | null> => {
    const hop = vung ? `&viewbox=${viewboxQuan(vung)}&bounded=1` : "";
    const khoa = `${q}|${hop}`;
    if (cache.has(khoa)) return cache.get(khoa)!;
    const cho = 1100 - (Date.now() - lanNominatim);
    if (cho > 0) await sleep(cho);
    lanNominatim = Date.now();
    calls++;
    let point: [number, number] | null = null;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn${hop}&q=${encodeURIComponent(q)}`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) },
      );
      const js = await res.json();
      const r = js?.[0];
      // Khớp cả thành phố/tỉnh (câu tra quá rộng) = không có điểm: ghim vào
      // tâm TP.HCM rồi đo "cách bệnh viện 1 km" là sai cả chục km.
      if (r && !/^(city|state|province|country|municipality|region)$/.test(String(r.addresstype ?? r.type ?? ""))) {
        point = [Number(r.lat), Number(r.lon)];
      }
    } catch (e) {
      await ghiLoi(`nominatim ${q} → ${loiChu(e)}`);
    }
    // Hộp chỉ là gợi ý cho Nominatim; kiểm lại bằng khoảng cách tới tâm quận.
    if (point && vung && !trongVungQuan(point[0], point[1], vung)) point = null;
    cache.set(khoa, point);
    return point;
  };

  const napOverpass = async (lat: number, lng: number): Promise<DiemOsm[] | null> => {
    const q = cauOverpass(lat, lng);
    for (const base of OVERPASS) {
      try {
        // POST dạng form, như tài liệu Overpass khuyên (GET dài dễ bị chặn).
        const res = await fetch(base, {
          method: "POST",
          headers: {
            "User-Agent": UA,
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: `data=${encodeURIComponent(q)}`,
          signal: AbortSignal.timeout(35_000),
        });
        if (!res.ok) {
          await ghiLoi(`overpass ${base} → HTTP ${res.status}`);
          continue;
        }
        return docDiemOsm(await res.json());
      } catch (e) {
        await ghiLoi(`overpass ${base} → ${loiChu(e)}`);
      }
    }
    return null;
  };

  for (const row of (viec ?? []) as Viec[]) {
    if (Date.now() - t0 > CHAN_THOI_GIAN_MS) break;
    const luc = new Date().toISOString();
    let lat = row.lat, lng = row.lng, muc = row.toa_do_muc;

    // ── Bước 1: toạ độ ──
    if (lat == null || lng == null) {
      let point: [number, number] | null = null;
      let mucMoi: string | null = null;
      if (row.du_an_lat != null && row.du_an_lng != null) {
        point = [row.du_an_lat, row.du_an_lng];
        mucMoi = "du_an";
      } else {
        const ngoai = laTinhNgoai(row.district);
        const vung = row.quan_mac_dinh ? null : vungQuan(row.district);
        for (const c of queriesFor(row)) {
          if (Date.now() - t0 > CHAN_THOI_GIAN_MS) break;
          const p = await traNominatim(c.q, vung);
          if (p && trongVung(p[0], p[1], ngoai)) {
            point = p;
            mucMoi = c.muc;
            break;
          }
        }
      }
      if (!point) {
        failed++;
        await db.from("listings").update({ geocode_at: luc }).eq("id", row.id);
        continue;
      }
      [lat, lng] = point;
      muc = mucMoi;
      const { error } = await db.from("listings")
        .update({ lat, lng, toa_do_muc: muc, geocode_at: luc }).eq("id", row.id);
      if (error) {
        await ghiLoi(`ghi toạ độ ${row.id} → ${error.message}`);
        continue;
      }
      updated++;
    }

    // ── Bước 2: tiện ích quanh tin ──
    // Tâm phường không đủ để đo "cách 1 km" — đánh dấu đã xét, không nạp.
    if (muc === "phuong") {
      await db.from("listings").update({ tien_ich_gan: null, tien_ich_at: luc }).eq("id", row.id);
      continue;
    }
    // Các tin cùng đoạn đường (~100 m) dùng chung một lượt Overpass.
    const khoa = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    let diem = osmCache.get(khoa);
    if (diem === undefined) {
      diem = await napOverpass(lat, lng);
      osmCache.set(khoa, diem);
      if (diem?.length) {
        for (let i = 0; i < diem.length; i += 500) {
          const { error } = await db.from("tien_ich").upsert(
            diem.slice(i, i + 500).map((d) => ({ ...d, cap_nhat_at: luc })),
            { onConflict: "osm_id" },
          );
          if (error) await ghiLoi(`upsert tien_ich → ${error.message}`);
        }
      }
    }
    if (!diem) {
      poiFail++;
      // Overpass công cộng hay quá tải (đo 11/09: 504 "too busy", 406) — lỗi
      // phía họ, không phải địa chỉ khó tra. Lùi geocode_at 11 giờ để tick thử
      // lại sau ~1 giờ, thay vì 12 giờ như một địa chỉ tra hỏng.
      await db.from("listings")
        .update({ geocode_at: new Date(Date.now() - 11 * 3600e3).toISOString() }).eq("id", row.id);
      continue;
    }
    await db.from("listings")
      .update({ tien_ich_gan: ganNhatMoiLoai(lat, lng, diem), tien_ich_at: luc, geocode_at: luc })
      .eq("id", row.id);
    poi++;
  }

  // ── Bước 3: toạ độ DỰ ÁN (mốc "gần Ehome 3"), chỉ bằng thời gian còn dư ──
  let duAn = 0, duAnHong = 0;
  if (Date.now() - t0 < CHAN_THOI_GIAN_MS - 10_000) {
    const { data: das, error: dErr } = await db.rpc("du_an_can_geocode", { p_limit: 30 });
    if (dErr) await ghiLoi(`du_an_can_geocode → ${dErr.message}`);
    for (const p of (das ?? []) as Array<{ id: string; name: string | null; location_raw: string | null; ward: string | null; district: string | null }>) {
      if (Date.now() - t0 > CHAN_THOI_GIAN_MS) break;
      const ngoai = laTinhNgoai(p.district);
      const vung = vungQuan(p.district);
      let point: [number, number] | null = null;
      for (const c of queriesDuAn(p)) {
        if (Date.now() - t0 > CHAN_THOI_GIAN_MS) break;
        const pt = await traNominatim(c.q, vung);
        if (pt && trongVung(pt[0], pt[1], ngoai)) {
          point = pt;
          break;
        }
      }
      const luc = new Date().toISOString();
      await db.from("projects")
        .update(point ? { lat: point[0], lng: point[1], geocode_at: luc } : { geocode_at: luc })
        .eq("id", p.id);
      if (point) duAn++;
      else duAnHong++;
    }
  }

  const { data: con } = await db.rpc("tin_can_geocode", { p_limit: 200 });
  return json({
    updated, failed, api_calls: calls, tien_ich_nap: poi, tien_ich_hong: poiFail,
    du_an: duAn, du_an_hong: duAnHong, con_viec: (con ?? []).length,
  });
});
