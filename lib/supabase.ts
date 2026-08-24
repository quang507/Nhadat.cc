import { createClient } from "@supabase/supabase-js";

// Anon/publishable key là key công khai (chỉ đọc được thứ RLS cho phép) —
// env override được, mặc định trỏ project nhadat-bot.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tbcdpupiarkuxtntmosl.supabase.co";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_zmJBmEgFPn3bBKx_1ve6Pg_dXdo4haX";

export const supabase = createClient(url, key);

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
};
