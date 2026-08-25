"use client";
// Ghi "tin đã xem gần đây" (FR-126): luôn lưu localStorage; nếu đã đăng nhập
// thì đồng bộ thêm lên listing_views để giữ qua nhiều thiết bị.
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

const KEY = "nhadatcc_recent";

export function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function TrackView({ code, listingId }: { code: string; listingId: string }) {
  useEffect(() => {
    try {
      const cur = readRecent().filter((c) => c !== code);
      cur.unshift(code);
      localStorage.setItem(KEY, JSON.stringify(cur.slice(0, 24)));
    } catch { /* storage bị chặn thì thôi */ }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("listing_views").upsert({
        auth_user_id: user.id,
        listing_id: listingId,
        viewed_at: new Date().toISOString(),
      }).then(() => {});
    });
  }, [code, listingId]);
  return null;
}
