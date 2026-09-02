import { createClient } from "@supabase/supabase-js";

// Anon/publishable key là key công khai (chỉ đọc được thứ RLS cho phép) —
// env override được, mặc định trỏ project nhadat-cc.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tbcdpupiarkuxtntmosl.supabase.co";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_zmJBmEgFPn3bBKx_1ve6Pg_dXdo4haX";

export const supabase = createClient(url, key);

// FR-171 j — CỘT CHỌN LỌC thay cho select("*"). Thẻ tin (ListingCard) không
// đọc `description` (cột text nặng nhất), `lat/lng`, `unit_status`,
// `last_confirmed_at`; kéo "*" cho lưới 24 thẻ là kéo 24 mô tả rồi vứt — và
// với /ban-do là 300 mô tả bị serialize vào HTML. Trang chi tiết mới cần "*".
export const CARD_COLS =
  "id, code, deal, district, ward, location_raw, area_m2, price_vnd, price_raw, property_type, bedrooms, status, created_at";
/** Bản đồ: thẻ + toạ độ, vẫn không kéo mô tả. */
export const MAP_COLS = `${CARD_COLS}, lat, lng`;
export type MapRow = ListingCard & Pick<Listing, "lat" | "lng">;
/** Kiểu dữ liệu của một dòng đọc bằng CARD_COLS — đủ cho ListingCard. */
export type ListingCard = Pick<
  Listing,
  | "id" | "code" | "deal" | "district" | "ward" | "location_raw" | "area_m2"
  | "price_vnd" | "price_raw" | "property_type" | "bedrooms" | "status" | "created_at"
>;

export type Listing = {
  id: string;
  code: string | null;
  deal: "ban" | "cho_thue";
  district: string | null;
  ward: string | null;
  location_raw: string | null;
  area_m2: number | null;
  price_vnd: number | null;
  price_raw: string | null;
  description: string | null;
  status: string;
  property_type: string | null;
  unit_status: string | null;
  last_confirmed_at: string | null;
  created_at: string;
  lat: number | null;
  lng: number | null;
  bedrooms: number | null;
};
