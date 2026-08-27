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
      }, {
        // Khai rõ khoá đụng độ. PostgREST đang tự suy ra khoá chính
        // (auth_user_id, listing_id) nên hiện tại vẫn chạy đúng — nhưng đó là
        // suy diễn ngầm, và ngày nào bảng thêm một unique index khác thì nó
        // suy ra cái khác mà không báo gì, biến "xem lại một tin" thành lỗi
        // 409 hoặc thành hai dòng. Viết ra thì nó khoá vào đúng ý mình.
        onConflict: "auth_user_id,listing_id",
      }).then(({ error }) => {
        // Ghi "tin đã xem" hụt không được làm hỏng trang, nhưng cũng đừng nuốt
        // hẳn — im lặng ở đây là lý do FR-126 hỏng mà không ai biết.
        if (error) console.warn("TrackView: không ghi được listing_views —", error.message);
      });
    });
  }, [code, listingId]);
  return null;
}
