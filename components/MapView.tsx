"use client";
// Bản đồ Leaflet + OpenStreetMap (FR-122, port ý tưởng từ NhaDat-Radar).
// Leaflet đụng window lúc import nên phải import động trong useEffect.
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Listing } from "@/lib/supabase";
import { escapeHtml, formatPrice } from "@/lib/format";
import { Q5_CENTER, wardPoint } from "@/lib/geo";

export default function MapView({ listings }: { listings: Listing[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      map = L.map(ref.current).setView(Q5_CENTER, 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      for (const l of listings) {
        const code = l.code ?? l.id.slice(0, 8);
        // Toạ độ geocode từ địa chỉ tương đối (FR-122); thiếu thì rơi về tâm phường
        const p: [number, number] | null =
          l.lat && l.lng ? [Number(l.lat), Number(l.lng)] : wardPoint(l.ward, code);
        if (!p) continue;
        const marker = L.circleMarker(p, {
          radius: 9,
          color: "#e60023",
          weight: 2,
          fillColor: "#e60023",
          fillOpacity: l.deal === "cho_thue" ? 0.25 : 0.65,
        }).addTo(map);
        // bindPopup nhận HTML THÔ và nhét thẳng vào DOM — đây là chỗ duy nhất
        // trên web không có React đứng giữa thoát ký tự hộ. Mà `price_raw` và
        // `ward` là chữ chính chủ tự gõ trong Zalo ("9 tỉ bớt lộc"), đi vào DB
        // nguyên văn qua chat-reply. Một câu rao chứa `<img src=x onerror=…>`
        // là chạy được script trên nhadat.cc — mà người rao thì bất kỳ ai cũng
        // làm được, chỉ cần nhắn cho bot một câu. Thoát hết trước khi ghép.
        const donGia = escapeHtml(formatPrice(l.price_vnd, l.price_raw));
        const phuong = escapeHtml(l.ward ?? "");
        const maAn = escapeHtml(code);
        marker.bindPopup(
          `<div style="font-family:inherit;min-width:170px">
            <strong>${donGia}</strong> · ${phuong}<br/>
            <span style="color:#687686">#${maAn} · ${l.deal === "cho_thue" ? "cho thuê" : "bán"}</span><br/>
            <a href="/nha-dat/${encodeURIComponent(code)}" style="color:#e60023;font-weight:700">Xem tin →</a>
          </div>`,
        );
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [listings]);

  return <div ref={ref} className="h-full w-full" />;
}
