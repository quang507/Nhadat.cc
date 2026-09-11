# 08 — Traceability Matrix

Cập nhật **cùng commit** với bất kỳ thay đổi nào ở `01`…`07` (quy ước 4, `CLAUDE.md`).

## 8.0 Định hướng → tầng dưới (`00-dinh-huong.md` v1.3, 04/09/2026)

| DH | Nội dung | Neo ở tầng dưới |
|---|---|---|
| DH-01 | Định vị hợp nhất: Aioinhadat, một bot Thái; Sài Gòn (phường mới) + Long An, trọng tâm bán; mặt bán theo AOND, mặt mua + web theo nhadat.cc, vòng nối qua CTV | OPEN-08/39, OPEN-27 nửa đầu, FR-173, FR-174, BR-01, INS-01/06/08/12, `06 §6.8`, SRS-5.1 |
| DH-02 | Bốn bất biến hướng nào cũng giữ | IA-P1, NFR-07 / FR-53, RSK-03 / FR-40, INS-11 / FR-104 (OPEN-36) |
| DH-03 | Mặt bán lấy AOND làm chuẩn | FR-129, FR-144, FR-153, FR-155, FR-172, `06 §6.8` kịch bản người bán; bảng §0.3 (00) liệt kê từng mục AOND §I–§VII ↔ FR |
| DH-04 | Mặt mua và web lấy nhadat.cc làm chuẩn | FR-01…FR-65, UF-01…UF-08, IA-P1…P5 |
| DH-05 | Sao Bắc Đẩu: lịch xem nhà chốt mỗi tuần; đầu vào I1–I5; OMTM = câu khách hỏi được trả lời đúng hạn | FR-57 / SRS-5.3 (viewing), FR-139 (`dang_ban`), UF-04, FR-173 (`sla_due_at`, `ctv_ranks`) / FR-140 c, BR-07 / FR-63, FR-155 / view `nmg_hoat_dong` (`20260904e`) |
| DH-06 | Lộ trình 90 ngày: chốt hướng → đo I3 qua CTV → mở địa bàn (FR-174 đợt 1 xong, đợt 2 chờ) → 7 hạng mục dữ liệu → phần AOND còn thiếu → vận hành | OPEN-21/26/28/40/41/42, OPEN-27 nửa sau; FR-173, FR-174; `01 §1.5c`; FR-135/141 (takeover UI ⏳); NFR-16 / OPEN-25 |
| DH-07 | Cho tới khi §0.8 chốt, đi theo khuyến nghị BA và ghi `[giả định BA]` | OPEN-40, OPEN-41, OPEN-42, OPEN-27 nửa sau |

## 8.1 Business Requirement → Functional Requirement

| BR | Mục tiêu | FR liên quan |
|---|---|---|
| BR-01 | Phủ 90% nguồn hàng Q5 | FR-90…FR-97, FR-101 |
| BR-02 | 20 NMG | FR-101, FR-137 (FR-102 deprecated) |
| BR-03 | 10 chat/ngày, ≥30 tin | FR-13, FR-14, FR-20…FR-32, FR-71 |
| BR-04 | 1 giao dịch/2 ngày | FR-50…FR-57, FR-99 |
| BR-05 | Thu phí bên bán | FR-101, FR-137 (FR-102 deprecated) |
| BR-06 | Miễn phí, không thu số ĐT | FR-04, FR-53, NFR-07 |
| BR-07 | Giữ kết nối 3–4 năm | FR-60…FR-65, FR-64 |
| BR-08 | SEO 100 keyword | FR-12, FR-15, FR-17, NFR-09 |
| BR-09 | Web → Zalo kèm ngữ cảnh | FR-13, FR-14, FR-30 |

## 8.2 Insight → yêu cầu

| INS | Insight | Hiện thực ở |
|---|---|---|
| INS-01 | Chat là sản phẩm | FR-13, IA-P1, UI-P1, WF-01 |
| INS-02 | Chu kỳ mua 3–4 năm | FR-60…FR-65, UF-08 |
| INS-03 | Zalo xoá sau 7 ngày | FR-63, SRS-5.3 `zalo_keepalive`, AC-06 |
| INS-04 | Riêng tư là khác biệt | FR-04, FR-121, NFR-07, WF-07, AC-04 |
| INS-05 | S không điền form | FR-91, UI-C08, WF-08, AC-07 |
| INS-06 | Thiếu thông tin là tính năng | FR-40…FR-47, UF-05, SRS-3.6, AC-03 |
| INS-07 | Ngôn ngữ nói ≠ bộ lọc | FR-02, FR-09, FR-22, FR-23, SRS-4.5, AC-12 |
| INS-08 | Sâu một quận trước | BR-01, SRS-8 (thứ tự P1 trước P2) |
| INS-09 | "Rao một lần là xong", không spam S | FR-103, §6.9 (06), SRS-5.3 `stale_listing_check` |
| INS-10 | Hàng dự án: dữ liệu hai tầng, tồn kho theo căn | FR-113…FR-117 (OPEN-15 chốt phương án b, 24/08) |
| INS-11 | Trung gian toàn phần: lưu hết, khai khi khách hỏi; liên hệ mở lúc chốt lịch xem (chỉnh 02/09/2026, OPEN-36) | FR-104…FR-112, UF-10, UF-13, SRS-3.8 |
| INS-12 | Sau sáp nhập 2025, địa giới cũ vẫn là ngôn ngữ thị trường | FR-118 (`ward_mapping`), Taxonomy §4.6 (04), FR-12 (trang tag) — quyết định chủ dự án 24/08/2026 |
| INS-13 | Bộ trường tin rao "chuẩn sàn" là mẫu số chung (mogi/radanhadat) | FR-172, SRS-3.1, SRS-3.14; khoảng trống còn lại: `streets`/`ward_mapping` (FR-118), POI (FR-28, OPEN-13), snapshot giá (FR-99/120, OPEN-10) |

## 8.3 FR → UF → WF → SRS → AC

| FR | User Flow | Wireframe | SRS | Acceptance |
|---|---|---|---|---|
| FR-01…06 | UF-01 | WF-01 | SRS-2.1; FR-01/03/04 (04/09/2026): `app/page.tsx` khối "Lời hứa" 3 mục + bong bóng CSS (`HoiThoai`), khối vòng hỏi 3 bước (`VONG_HOI`), khối riêng tư 3 vế; FR-02: form GET `/api/search?go=1` ở hero | TS-WEB2-W01/W02 |
| FR-07, FR-08 | UF-01 | WF-02 | SRS-4.5; FR-08 (04/09/2026): `components/ListingBrowse` nhận `q` → "Tìm thấy N tin theo yêu cầu: <tiêu đề>" + hộp Zalo `search:<q>`; `/mua-ban`, `/cho-thue` `noindex` khi có `q` | AC-01; TS-WEB2-W03/W04 |
| FR-09 | UF-01 | WF-02 | SRS-4.5 (04/09/2026): `lib/parse-query.ts` (`parseQuery`, luật, có/không dấu) + `app/api/search/route.ts` (GET/POST, `go=1` → 302) + tham số mới `gmin/gmax/dtmin/dtmax/quan/loai/duong/moc` ở `ListingBrowse` | AC-12; TS-WEB2-S01…S10 |
| FR-10, FR-11 | UF-02 | WF-03 | SRS-3.1; FR-10 bản đồ (04/09/2026): `components/WardMap` (dynamic ssr:false bọc `MapView` có `center/zoom`) một chấm `wardPoint`, ghi "vị trí ở mức phường" | AC-01; TS-WEB2-W05 |
| FR-12 | UF-01 | WF-04 | §4.4 (IA); `lib/tags.ts` + `app/[tag]/page.tsx` (SSG, 64 tag, 04/09) | TS-SEO-01…06 |
| FR-13, FR-14 | UF-03 | WF-01, WF-02 | SRS-4.7 | AC-01 |
| FR-15 | UF-02 | WF-03, WF-04 | — | — |
| FR-16 | UF-01 | — | SRS-3.3 `fingerprint_ids` | — |
| FR-17 | — | WF-04 | NFR-09; `app/sitemap.ts`, `app/robots.ts`, `metadataBase`/canonical/OpenGraph (`app/layout.tsx`, trang tin, trang tag), JSON-LD `RealEstateListing` ở `app/nha-dat/[code]/page.tsx` (04/09) | TS-SEO-01…06 |
| FR-20…FR-26 | UF-04 | WF-05 | SRS-5.1 | AC-02 |
| FR-27, FR-28 | UF-04 | WF-03, WF-05 | SRS-3.8 `photos`; FR-27: `chat-reply` v48 (04/09/2026) ≤4 tấm/lượt + `buyers.preferences.photo_offset` + "xem thêm" → 4 tấm kế (SRS-5.1 nhánh XIN HÌNH) | TS-V48-27a/b/c |
| FR-29, FR-30 | UF-03, UF-04 | WF-05 | SRS-4.7; chat-reply: khối "CĂN KHÁCH ĐANG NHẮC" (tra mã căn trong tin + facts đã xác minh, chào đúng căn) | AC-01 |
| FR-31, FR-32 | UF-04 | WF-05 | FR-31: khối CĂN TƯƠNG TỰ trong `chat-reply` (SRS-5.2); FR-32: reminder `followup` 2,5h + `nudge` | TS-V48-31a/b, TS-JOB |
| FR-40…FR-47 | UF-05 | WF-06, WF-10 | SRS-3.6, SRS-4.1, SRS-4.2; FR-45: luật `HUMAN_CHAT_RULES` + few-shot v48 (04/09/2026) — `ask_owner` kết bằng "Trong khi chờ, anh/chị có câu hỏi gì khác về căn này không ạ?" (`bot_prompts` đồng bộ) | AC-03; TS-V48-45 |
| FR-50…FR-57 | UF-06 | WF-07 | SRS-3.7 `viewings`; trigger `viewings_bao_ctv_va_email` (`20260904f`): nhắc CTV ngay + câu `xac_nhan_lich` + email [VIEWING]; CTV trả lời → `status = confirmed`; nhắc trước giờ + bản đồ + hỏi cảm nhận ở `nudge` | AC-04; TS-GIUCHAN-01, TS-MATCH |
| FR-54 | UF-06 | WF-07 | `nudge` v24 (04/09/2026): nhắc `viewing` nối dòng "Bản đồ: maps.google.com/?q=lat,lng" khi `listings.lat/lng` có (qua `viewings → listings`); toạ độ do `geocode-listings` (FR-122) điền | TS-MATCH-08 (docs/10 §10.7) |
| FR-56 | UF-07 | — | SRS-5.2 (loại listing đã từ chối); SRS-3.8b `reminders.kind = feedback` + SRS-3.12 trigger `reminders_hen_hoi_cam_nhan` (`20260904d`): nhắc `viewing` đánh `sent` → hẹn `feedback` giờ xem + 4h; `nudge` v24 gửi mẫu cố định | AC-05; TS-MATCH-06/07/09 |
| FR-60…FR-65 | UF-08 | — | `nudge` v25: hỏi thăm khi im đủ 5 ngày, sáu góc xoay vòng, kho cùng khu `can_cung_khu()`, ≥6 ngày buộc giữ kết nối (FR-60…63); FR-65: `feedback` + `ghi_danh_gia()` (`20260904f`), `chat-reply` bắt "N sao" | TS-GIUCHAN, TS-V48-65 |
| FR-64 | UF-08 | — | `bao_tin_moi_khop()` + trigger trên `listings` (`20260904d`), `reminders.kind = match`, `nudge` gửi mẫu cố định; tiêu chí = `buyers.preferences` | AC-06; TS-MATCH-01…05, 09 |
| FR-70, FR-72, FR-73 | — | WF-12 | SRS-3.2 `property_events` + trigger từ 7 bảng nguồn, view `bds_hot` (FR-73), `hoi_thoai_phien` (FR-72), `bot_do_tre` (`20260904f`); thẻ `/admin` | AC-09; TS-WEB2-W06; TS-GIUCHAN-01, 04, 05 |
| FR-71 | — | WF-12 | SRS-3.11 (04/09/2026): view `hoi_thoai_thong_ke` + policy `conversations/messages_admin_read`; thẻ "Thống kê hội thoại · 30 ngày" + CSV ở `app/admin/page.tsx` | AC-09 · TS-ADM2-07, TS-ADM2-12 |
| FR-74, FR-75 | — | WF-13 | SRS-3.11 (04/09/2026): policy `buyers_admin_read`; ô "Tìm khách" ở `app/admin/page.tsx`, không chọn `buyers.phone`; nút "Mở Zalo" (10/09) chỉ trỏ `zalo.me/<sđt>` khi có SĐT phía NGƯỜI BÁN (FR-175), khách B không có SĐT thì mở Zalo Web — `zalo_user_id` là ID nội bộ luồng chat, `zalo.me/<uid>` ra trang lỗi | AC-09 · TS-ADM2-03, TS-ADM2-11 |
| FR-76 | UF-05, UF-11 | WF-12 | SRS-3.6; SRS-3.11 (04/09/2026): policy `info_requests_admin_read`, `ctvs_admin_read`; thẻ "Câu hỏi đang chờ" ở `app/admin/page.tsx` | AC-09 · TS-ADM2-01, TS-ADM2-05, TS-ADM2-11 |
| FR-77 | UF-11 | WF-14 | SRS-5.4; SRS-3.11 (04/09/2026): view `khach_can_nguoi_that` (cờ `needs_human` làm proxy); thẻ "Khách cần người thật" | AC-10 · TS-ADM2-06 |
| FR-78 | UF-06, UF-11 | WF-14 | SRS-3.7; SRS-3.11 (04/09/2026): policy `viewings_admin_read`; thẻ "Lịch xem nhà" ở `app/admin/page.tsx` | AC-10 · TS-ADM2-02, TS-ADM2-11 |
| FR-79 | UF-06, UF-11 | WF-14 | `chat-reply` cờ `voice_request` → `need_human` + `reminders` escalation note `VOICE:` → email [VOICE] (SRS-5.5); chưa có thẻ riêng trên `/admin` | AC-10; TS-V48-79a…d |
| FR-80 | — | WF-12…14 | UI-C10; `usePhanTrang` 20 mục/trang ở `app/admin/page.tsx` (04/09/2026) | AC-09 · TS-ADM2-12 |
| FR-81 | UF-11 | — | SRS-5.5: `canh_bao_ngoai(…, p_email)` + `email_admin()` qua ntfy.sh (`20260904f`), 4 nguồn [VIEWING]/[UPSET]/[QUESTION]/[VOICE]; cần `app_config.admin_email` + `NTFY_TOKEN` (chưa có) | AC-10; TS-GIUCHAN |
| FR-90…FR-96 | UF-09 | WF-08, WF-09 | `/raoban`; SRS-4.6 `app/api/listing/parse` (FR-92); `components/UploadAnh` + policy storage `20260904g` (FR-96) | AC-07; TS-WEB2-P01…P06, S09, W07 |
| FR-98 | UF-05 | WF-10 | SRS-4.2 | AC-03 |
| FR-99 | UF-04 | WF-05 | `chat-reply`: dòng "giá TB phường" trong KHO (SRS-5.1); web: dòng so với giá TB phường ở trang tin. Nguồn giá ngoài: OPEN-10 | TS-V48-99a/b/c, TS-WEB2 |
| FR-100 | UF-12 | WF-11 | SRS-4.3 (ĐÃ DỰNG 04/09/2026 dạng RPC): SRS-3.8b `curated_lists` + `tao_danh_sach`/`doc_danh_sach` (`20260904g`); `app/ds/[token]/page.tsx` (noindex/nofollow, hết hạn → trang + Zalo); ô "Danh sách riêng cho khách" ở `/admin` | AC-11; TS-WEB2-P06…P10, W09 |
| FR-101, FR-102 | UF-09 | WF-09 | SRS-3.4 | Chấm điểm CTV/NMG nằm trong `ctv-report` (rubric `RATE_CTV_RUBRIC`). Edge `rate-ctv` + bảng `ratings` đã XOÁ 27/08/2026 theo OPEN-23 |
| FR-103 | UF-09 | — | SRS-5.3 `stale_listing_check` → cron thật `stale-listing-tick` 9h VN + `stale_listing_tick()` (`20260904f`, SRS-3.12): tin `dang_ban` im 30 ngày → `info_requests(con_ban)` 1 lần/30 ngày + escalation hỏi chủ/CTV, trần 5 tin/ngày | TS-GIUCHAN-03 |
| FR-104, FR-105 | UF-06, UF-12 | — | SRS-3.8 bất biến ẩn danh (OPEN-36); web `sanitizeDescription`, bot `locLienHe()` (SRS-5.1) cho fact/mô tả/bong bóng gửi người mua | TS-SEC-10, TS-V48-105 |
| FR-106, FR-107, FR-108 | UF-13 | — | FR-106/107 thay bằng FR-139 và FR-129/144; FR-108: `mark_listing_interest(p_codes, p_buyer_id)` ghi `interests`, trigger tin chốt → `reminders.kind = sold` + căn thay thế (`20260904f`), `nudge` mẫu cố định | TS-V48-108a/b/c; TS-GIUCHAN-01 |
| FR-109, FR-111 | UF-10 | — | SRS-3.8 | — |
| FR-110 | UF-05 | WF-06 | `info_request_timeout_tick()` + cron `info-timeout-tick` (`20260904f`): 24h `reminded_at`, 48h `expired`, `buyer_ask` quá hạn → `followup` báo khách; SLA CTV 120' là `ctv-sla-tick` (FR-173) | TS-GIUCHAN-01 |
| FR-112 | UF-07 | — | SRS-3.8 `deals` | — |
| FR-113 | — | — | SRS-3.10 `projects` | AC-13 |
| FR-114 | UF-09, UF-10 | WF-09 | SRS-3.10; luồng Zalo (04/09/2026, `chat-reply` v48): câu rao khớp `match_projects` → `project_id` + `unit_code` + `unit_status='con_ban'` + `last_confirmed_at`; `/raoban` web + form admin chưa | AC-13; TS-V48-114/114b |
| FR-115, FR-116 | UF-05 | — | SRS-3.10, SRS-5.1 (nhánh tầng dự án / tồn kho căn — FR-116 dựng 04/09/2026 trong `chat-reply` v48: khối CĂN TRONG DỰ ÁN đọc `unit_status`, TTL 7 ngày → "xác nhận lại chủ" + `ask_owner`) | AC-13; TS-V48-116a/b/c |
| FR-117 | — | — | SRS-3.10; nửa trang (04/09/2026): `app/du-an/[slug]/page.tsx` SSG + `app/sitemap.ts` + link từ trang tin (`Listing.project_id/unit_code`); màn quản lý giỏ hàng chưa | TS-WEB2-W10 |
| FR-118 | — | — | *chưa đặc tả kỹ thuật — bảng `ward_mapping` sẽ vào SRS-3.x khi chốt nguồn dữ liệu NQ 202/2025/QH15* | — |
| FR-119 | — | — | app/tinh-lai-vay (client, không đụng DB) | — |
| FR-120 | — | — | app/thong-ke (đọc listings qua RLS anon) | — |
| FR-121 | — | — | localStorage phía trình duyệt, không lưu server | — |
| FR-122 | — | — | app/ban-do + lib/geo (tâm phường, tôn trọng SRS-3.8 ẩn danh) | — |
| FR-123 | UF-01 | WF-03 | app/mua-ban, cho-thue (query param) | — |
| FR-124 | UF-09 | — | sellers.auth_user_id + RLS listings_own_* | — |
| FR-125 | — | — | view `agents_public` (không lộ phone; SECURITY DEFINER **tự chứa**, `20260904b` — bản invoker `20260827g` làm `/moi-gioi` trống 27/08→04/09) | TS-SEC-08 |
| FR-126 | UF-08 | — | `buyers.auth_user_id`, `listing_views`, app/tai-khoan | — |
| FR-127 | UF-11 | WF-12 | bảng `admins` + RLS `listings_admin_*`, app/admin | — |
| FR-128 | UF-01 | WF-03 | `listings.bedrooms` + backfill regex | — |
| FR-129 | UF-05, UF-09 | — | trigger `listing_insert_drip` + cron `seller_drip_tick` (trần 2 căn/24h/seller) + ask-seller mode drip + chat-reply nhánh seller; văn phong §6.8 "Kịch bản người bán" (06) | — |
| FR-130 | UF-04, UF-08 | WF-05 | `buyers.preferences` + chat-reply (bóc tách hồ sơ + nhịp hỏi §6.8 FR-130) | — |
| FR-131 | UF-04 | — | chat-reply KHÔNG delay nhân tạo (chỉ check nhường-lượt khi có tin mới hơn) + RPC `ensure_buyer_conversation` (advisory lock); bridge/zalo-webhook bỏ typing giả, giữa 2 bong bóng chỉ 300ms giữ thứ tự | — |
| FR-132 | UF-04, UF-05 | — | bảng `projects` (chỉ Ny'ah — seed mogi đã gỡ theo quyết định 25/08, cơ chế nạp giữ ở code) + RPC `match_projects` + khối KHO DỰ ÁN trong chat-reply (thực thi FR-115) | AC-13 |
| FR-133 | UF-05, UF-08 | — | bảng `reminders` + chat-reply (bóc promise, hủy khi quay lại) + edge `nudge` + cron `nudge-tick` `7,37 1-13 * * *` (hai lượt/giờ, 8–20h VN) (thực thi FR-63 phía bot); giờ gửi 8h–21h VN (jitter 0–45s đã bỏ theo FR-171 d) | AC-06 |
| FR-134 | UF-04 | — | chat-reply nhận `image_url` (content block image, chỉ dẫn "hình như là"); zalo-webhook bắt `user_send_image`; bridge zca-js bắt content.href | — |
| FR-135 | UF-04 | — | trường `need_human` trong BuyerTurn (chat-reply) + cột `conversations.needs_human/needs_human_at`; đơn chờ hiện trong báo cáo FR-137 | — |
| FR-136 | — | — | bảng `ctvs` + cột `conversations.ctv_id` + trigger `trg_conversations_assign_ctv` (function `assign_ctv_round_robin`) (ít đơn 30-ngày nhất nhận trước) | — |
| FR-137 | — | — | edge `ctv-report` + cron `ctv-report-tick` 17h VN (10:00 UTC) + bảng `ctv_daily_reports`; chấm điểm bằng `RATE_CTV_RUBRIC` (_shared/prompts.ts); đích: `reminders` kind `report` → bridge → `admins.zalo_phone` (FR-149), OA trực tiếp chỉ khi có token + `ZALO_ADMIN_ZALO_ID` | — |
| FR-138 | — | — | bảng `bot_prompts` (seed từ _shared/prompts.ts) + loader trong `chat-reply`/`nudge` (DB đè code, fallback về prompts.ts) | — |
| FR-139 | UF-04, UF-05 | WF-04/06 | `listings.status` 5 trạng thái + trigger chuẩn hoá, `mark_listing_interest`, cron `listing-interest-decay`, RLS anon chỉ tin lên kệ; web badge/banner, `/admin` duyệt | — |
| FR-140 | UF-04, UF-09 | — | `ask_owner` → `info_requests` `buyer_ask` + `trg_route_info_request` + `trg_notify_info_request_escalation` + `nudge`/`escalation-feed`/bridge; nửa (b) thay bằng FR-173, (c) trigger `trg_info_request_bao_lai_khach` | TS-HOICHU, TS-CTV |
| FR-141 | UF-04 | — | cột `conversations.human_touch_at` + `messages.sender='human'` + bridge phân biệt tin bot/người thật (botSent set) + endpoint `human_note` và cửa im-30-phút trong chat-reply | — |
| FR-142 | UF-04, UF-07 | — | trường `agreed_deal` (BuyerTurn) + `bot_prompts.agree_rules` + insert `deals` (fee 1%/0.5%) + listing → `da_chot` + reminder escalation 🤝; bridge map sticker/reaction thành "[sticker cảm xúc]"/"[khách thả cảm xúc]" | — |
| FR-143 | UF-04 | — | facts `hinh_anh` → mảng `photos` trong response chat-reply (trường `send_photos` + fallback regex, ≤4 hình); bridge tải URL gửi ảnh đính kèm; zalo-webhook gửi OA media template | — |
| FR-144 | UF-05, UF-09 | — | nhánh `wantsSell` trong chat-reply (tạo tin nháp + hỏi câu đầu) + đồng bộ `area_m2` từ fact diện tích + điều kiện `published` ngừng drip + trigger escalation cho assignee seller (source buyer_ask) + guard một-câu-một-lúc trong `ask-seller` drip | — |
| FR-145 | UF-01, UF-03 | WF-01 | component `ZaloWidget` (client, ẩn trên `/nha-dat/*`) gắn ở `app/layout.tsx`; link cấu hình `ZALO_OA_URL` / env `NEXT_PUBLIC_ZALO_URL` (lib/format.ts) | — |
| FR-146 | UF-04 | — | khối trần 100 tin/24h trong `chat-reply` (đếm `messages` sender=buyer, cờ `rate_limited`, một tin báo rồi im) + `conversations.needs_human` + reminder `escalation` gán CTV | — |
| FR-147 | UF-04, UF-09 | — | `conversations.needs_human_at` / `human_escalated_at`; nhánh `need_human` trong `chat-reply` (escalation gán CTV, chống lặp) + khối ladder 30 phút trong `nudge` (escalation không gán CTV → admin) + hạ cờ & huỷ nhắc ở endpoint `human_note` | — |
| FR-148 | UF-01, UF-03, UF-04 | WF-02, WF-03 | Thay bằng FR-165: view `listing_photos_v` trên `listing_media`; web `lib/photos.ts`; bot gộp ảnh kho + fact `hinh_anh` | — |
| FR-149 | UF-09 | — | `admins.zalo_phone` (số admin, không nằm trong code); `reminders.kind='report'` + `ctv-report` đẩy hàng đợi (`queued_bridge`) + `escalation-feed` phục vụ cả `escalation`/`report` (report gửi nguyên văn) + `nudge` gửi OA khi còn OA + vòng poll bridge zca-js | — |
| FR-150 | UF-05, UF-09, UF-10, UF-13 | — | enum `property_type.chua_ro`, `guess_property_type()`/`_answer()` + trigger `trg_listings_fill_property_type`, `listing_missing_facts` coalesce, `trg_listings_price_vnd` cả UPDATE, `escalation-feed` ack ghi ngược uid | TS-LIVE-09, TS-OUNG |
| FR-151 | UF-04 | — | `bot_usage` + `bump_model_quota()` (trần ngày, Vault `DAILY_MODEL_CALL_CAP`); `BRIDGE_SECRET` → header `x-bridge-secret` qua `_shared/gate.ts` | TS-SEC2, TS-IDEM |
| FR-152 | UF-09 | — | `bot_errors`/`bot_health`, `beat()`, `bot_health_tick()` + cron 15', `log_loi()`/`ghiLoi()`, web `instrumentation.ts`, `/admin` sức khoẻ bot; (e) `canh_bao_ngoai()` → ntfy (`20260904a`), `bot/bridge-zca/VPS.md`; `20260906a` còi đọc lại kết quả lượt báo trước trong `net._http_response` thay vì tin con dấu của chính nó, hạn chờ ntfy 5→15 s, bridge chưa-từng-điểm-danh cũng báo, `che_sdt()` che SĐT ở `log_loi` | TS-HEALTH, TS-LOG |
| FR-153 | UF-05, UF-09 | — | trigger `trg_listing_facts_sync_cols` → `listing_facts_sync_cols()` (fact → cột; từ FR-164 thêm giá/phường/loại) | TS-SPECS-01…04 |
| FR-154 | UF-04, UF-05 | WF-03, WF-05 | hàm `parse_vnd(text)` v2 (tỏi/củ/rưỡi/5t5/6ty2/4ty) + trigger sẵn có `trg_listings_price_vnd`; migration `20260827f_parse_vnd_slang.sql`; từ điển lóng `SLANG_NOTES` (`_shared/prompts.ts`) và bản đè `bot_prompts.slang_notes` | TS-GIA-01…05 |
| FR-155 | UF-09, UF-10 | — | hàm `seller_rank()` + view `seller_ranks` (chỉ tên/số đếm/hạng) + `agents_public` thêm `rank`, `closed_count`; `app/moi-gioi/page.tsx` huy hiệu + chú thích; migration `20260827g_seller_rank_admin_dang_tin.sql` | TS-HANG-01…03 |
| FR-156 | UF-09, UF-13 | — | RPC `admin_dang_tin(jsonb)` (security definer, kiểm bảng `admins`, sinh mã `BDS-Q5-####` có `lock table`, gộp người bán trùng zalo/SĐT); `app/admin/dang-tin/page.tsx`; nút vào từ `/admin`; migration `20260827g_seller_rank_admin_dang_tin.sql` | TS-DANGTIN-01…05 |
| FR-157 | UF-05, UF-09, UF-10 | — | cột `sellers.active_listing_id` + trigger `trg_info_request_set_active_listing`; `chat-reply` v33: chọn pending theo mã-trong-tin → neo → mới nhất, cổng `hoiMua` rẽ vai, prompt drip vắt vai mã căn; migration `20260827h_seller_active_listing.sql` | TS-NEO-01…04 |
| FR-158 | UF-05, UF-09 | — | `next_listing_code()` + trigger `trg_listings_fill_code`; `chat-reply` cổng `wantsSell` tạo tin `code: null`; `admin_dang_tin` đọc mã RETURNING | TS-MA-01…05 |
| FR-159 | UF-04, UF-05, UF-10 | WF-05 | `mo_ho_so_nguoi_ban(zalo, nhãn)` (`20260901d`, `20260902a`); `chat-reply` `tuNhanCoBDS`/`tinHieuMoiGioi`/`thongBaoNhan`/`xinDoiNhan`; policy `sellers_admin_*`, `reminders_admin_*`; `/admin` việc chờ + người bán | TS-VAI-01…18 |
| FR-160 | UF-09 | — | *chưa dựng* — chờ OPEN-28 chốt phí trước khi suy `seller_type` từ số tin | — |
| FR-161 | UF-04, UF-05, UF-09 | — | `boDau()` + mọi cổng regex hai chế độ trong `chat-reply`; SQL `bo_dau()`, `guess_property_type(_answer)` (`20260827l`) | TS-KD-01…05, `bot/tests/fr161` |
| FR-162 | UF-04, UF-05 | — | `inbound_ledger` + `claim_inbound()`, `inbound_events` + `ghi_su_kien_inbound()`, `messages.seq`; `chat-reply` claim trước quota + `already_sent`; `zalo-webhook` ghi sự kiện trước ack; bridge poll `in_flight` | TS-IDEM-01…10, TS-IDEM2-A…I |
| FR-163 | UF-04, UF-05, UF-06 | — | `20260828a`: fact mới nhất thắng, `deals_listing_buyer_key` + `trg_deals_chan_xoa`, CHECK `viewings`/`conversations`, guard trạng thái `reminders`/`inbound_ledger`, `merge_buyer_prefs`, `messages_conv_seq_idx` | TS-TOANVEN-01…09 |
| FR-164 | UF-05, UF-09, UF-10, UF-13 | — | `20260828b/c/d/e`: `bac_nguon()`, `price_source`/`ward_source`, `chuan_hoa_phuong()`, `listing_du_dang_tin()` + `trg_zz_listings_dang_tin`, `ghi_fact_listing()`, `cat_truoc_phu_dinh()`, `chuan_hoa_gia_raw()`, `trg_listings_chuan_hoa_cot`; `20260904b` cấy lại bốn nhánh fact rơi mất từ `20260902e`; `chat-reply` chỉ ghi fact | TS-OUNG-01…12 |
| FR-165 | UF-01, UF-03, UF-10, UF-13 | WF-02, WF-03 | `20260828g/h`: bucket `listing-public`/`listing-private`, `listing_media` + CHECK, `listing_media_chon_bia`, `app_config`/`cau_hinh()`, `listing_photos_v`, `media_cleanup_queue` + cron; edge `media-cleanup`; `lib/photos.ts`; `scripts/up-anh.mjs`; web upload `components/UploadAnh` (`20260904g`) | TS-KHO-01…25 |
| FR-166 | UF-04, UF-05, UF-06, UF-08 | — | `20260829a/c`: `lan_thu_ke()`, `inbound_ledger` trạng thái `dead` + `claim_inbound`/`bao_hong_inbound`/`viec_inbound_bo_roi`, `reminders` khoá/thử lại + `nhan_viec_nhac`/`bao_hong_nhac`/`nha_viec_nhac`, `media_cleanup_queue` `chet` + `chon_viec_don_chet`, view `job_suc_khoe`; edge `inbound-sweep` + cron 1' | TS-JOB-01…30 |
| FR-167 | UF-01, UF-03, UF-04, UF-05 | WF-02, WF-03 | `20260829d`: policy `listing_media_doc_cong_khai` theo tin lên kệ, `listing_photos_v` cùng điều kiện, revoke EXECUTE hàm nội bộ, ghim `search_path`; `x-bridge-secret` ở mọi function; còn hở OPEN-33; `20260905k` thu quyền ghi `chat_quota` của anon + miễn trần chung `log_loi` cho `service_role` | TS-SEC2, TS-SEC3 |
| FR-168 | UF-04, UF-05 | — | `20260901a/c`: trigger `trg_bot_errors_het_tien` + `bat_het_tien_api()` (dấu hiệu hết tiền/402, hãm 6h, ghi thẳng không qua van); hiện ở `/admin` | TS-CHUONG-01…07 |
| FR-169 | UF-04, UF-05 | — | `20260901b`: 4 cột token trên `bot_usage` + `cong_token()` + policy admin đọc; `doTien()` ở mọi chỗ gọi model; thẻ tiền bộ não `/admin` | TS-TIEN-01…07 |
| FR-170 | UF-04, UF-05, UF-06, UF-10 | WF-05, WF-06, WF-07 | `chat-reply`: `hoiMua`, `budgetRangeVnd`, `askedListings` lọc trạng thái, mã HOA, `ghiAnhKem()`, `fee_pct` theo nhãn, `wardNo`, `raoMoiKhiDangHoi`; e2e `bot/tests/e2e` | TS-VAI, TS-E2E |
| FR-171 | UF-04, UF-05, UF-06, UF-08 | WF-02, WF-03, WF-05 | `20260902c/d`: index, cron giờ người, `cron-don-so`, `trg_messages_bump_last_message`, `tao_followup`; `_shared/gate.ts`; chat-reply bớt vòng DB; web `CARD_COLS`/`React.cache`/lazy | TS-TOIUU-01…10 |
| FR-172 | UF-01, UF-03, UF-05, UF-06 | WF-02, WF-03, WF-05 | `20260902e/f/g`, `20260903c`: 24 cột thông số + `price_per_m2_vnd`, `boc_thong_so()`, `boc_ten_duong()`, `ap_thong_so()`, `trg_y_listings_boc_thong_so`; `_shared/thong_so.ts`; web bảng thông số + bộ lọc | TS-THONGSO-01…15, e2e THONGSO 
| FR-171 (ranh giới) | UF-04, UF-05 | — | `bot/tests/ranh-gioi.mjs`: mã bóc tách tiền định không được chạm model/DB, tầng AI không được ghi bảng nghiệp vụ (3 RPC khai tên: `get_secret`, `log_loi`, `cong_token`). Kiểm tĩnh, trong `test:bot` nên chạy CI mỗi PR mà không thêm required check | TS-RANHGIOI-01…10 |
| NFR-11 (đọc DB) | — | — | `20260906b`: chú thích 31/31 bảng theo 5 nhóm `[RỔ HÀNG] [NGƯỜI & HỘI THOẠI] [BOT & HÀNG ĐỢI] [CTV] [HỆ THỐNG]`, 17/17 view, 69 chú thích cột; view `ro_hang_ban` (20 cột, giá quy tỷ, cột `canh_bao` chỉ đích danh trường máy đoán), `security_invoker=on`, revoke `anon`+`authenticated` trước khi grant select. Bản đồ in ra giấy: SRS-3.0. `20260907c`: schema `so` tách khỏi `public` — `so.ro_hang` (9 cột đầu đúng sheet `nhà Q5.xlsx`, cả bán lẫn thuê) + `so.nguoi_ban`; PostgREST không phơi, `anon`/`authenticated` revoke, `security_invoker=on`; ngoài vùng `xuat_schema()` quét (README §Phục hồi ghi bước chạy thêm). `20260907f`: `so.ro_hang` ô đọc một dòng — mô tả gộp xuống dòng thành ` · `, vị trí bỏ đuôi `, Quận 5, Hồ Chí Minh`, diện tích dấu phẩy. `20260907g`: `so.hoi_thoai` — log chat đọc bằng mắt người (chủ dự án hỏi 07/09) | — |
| NFR-16 (kho gốc) | — | — | `20260907b`: bucket `masterdb-raw` — bản GỐC masterDB, riêng tư tuyệt đối, KHÔNG policy cho anon/authenticated nên chỉ `service_role` vào được; trần 50 MB/file, không chặn mime (kho lưu trữ, không biết trước cất gì). Trả lời phần "nơi cất" của OPEN-47 — nhưng bucket đang RỖNG, chưa đẩy `masterDB/` lên thì lưới an toàn vẫn là ổ đĩa cá nhân | — | `scripts/up-masterdb.mjs` đẩy bản gốc lên bucket đó (KHÔNG nén — đây là tủ hồ sơ, không phải CDN), chạy lại được, và đối chiếu đếm đĩa ↔ đếm bucket ở cuối; bài tự kiểm **TS-MASTERDB** (24 ca, Storage giả) chạy mỗi PR trong job `saoluu`.
| FR-173 | UF-05, UF-11 | — | `20260909h` (a sửa): `route_info_request` (`buyer_ask` → CHỦ NHÀ có Zalo, `sla_due_at` +12 giờ `chu_nha_han_gio()`/`app_config.chu_nha_han_gio`), `notify_info_request_escalation` tin "💬 … có khách đang hỏi căn …" cho chủ, `info_request_sla_tick` (a) chủ quá hạn → `chu_nha_qua_han_at` + chuyển CTV 120 phút / admin; `20260903a/b`: `sla_due_at`/`sla_missed_at`, `ctv_sla_phut()`, `route_info_request` (tin không có chủ Zalo → CTV), `info_request_sla_tick()` + cron `ctv-sla-tick`, `nguoi_noi_bo()`, view `ctv_ranks`; `chat-reply` nhánh nội bộ `#mã: trả lời`; `ctv-report` dòng hạng; `/admin` thẻ hạng CTV | TS-CTV-01…06, e2e CTV |
| FR-174 | UF-04, UF-09, UF-10 | — | `_shared/dia_ban.ts` (`bocQuan`) + `chat-reply` `district`; `20260903d` `admin_dang_tin` nhận `district`; ô quận `/quan-ly`; copy web Sài Gòn + Long An. Đợt 2 (`wards`, FR-118) chờ OPEN-27 | TS-DIABAN-01…04, e2e DIABAN |
| FR-175 | — | — | `20260907c` + `20260907f` schema `so` (`so.ro_hang`, `so.nguoi_ban`); `app/admin/ro-hang/page.tsx` (lọc, sắp, tìm không dấu, CSV BOM, cột SĐT người bán chỉ admin thấy — RLS, không phải code; mô tả/vị trí trình bày cùng luật với `20260907f`); link từ `/admin`. Đọc qua RLS `listings_admin_read` + `sellers_admin_read`. **09/09**: `app/admin/ro-hang/json/page.tsx` (JSON từng tin + `boc_tach`, tải `.json`, chép từng tin; cột `gap`/`chu_noi_du_at`/`boc_tach` từ `20260909a`), nút `{ } JSON` trên `/admin/ro-hang`; **khung CRM 09/09**: `app/admin/layout.tsx`, `components/AdminShell.tsx` (tab/route, tìm, chuông, đăng xuất), `Header.tsx`/`Footer.tsx` ẩn dưới `/admin`, `/admin` đọc `?tab=` (Suspense), bỏ thanh tab nội bộ; `app/admin/tin-nhan/page.tsx` (chat 3 cột + sửa câu chuẩn), `app/admin/mau-cau/page.tsx` thành kho mẫu (bảng, sửa/xoá, xuất JSONL); **NN/g 09/09**: `components/ui.tsx`, `icons.tsx` +20 icon, codemod bỏ emoji/pill/bóng trên 6 trang admin, `AdminShell` icon SVG + menu đăng xuất có chữ; `20260909f` `admin_xoa_khach`; tin-nhan: Làm mới / Đã xử lý / Xoá khách; luật `06 §6.11` | — |
| FR-176 | UF-10 | — | `chat-reply`: khối `boiCanh` (8 tin + `sellers.xung_ho`) đi vào r1/r2/r2b/r3; `neo` mã căn chỉ khi `nhieuCan`; `cauNhan` bỏ biểu phí; khối drip gọi `phanLoaiCauTraLoi` trước `ghi_fact_listing`, lệch → r2b hỏi lại. `_shared/extraction/khop-cau-tra-loi.ts` (tiền định, thuộc luật ranh giới). `20260907d` `sellers.xung_ho`. `20260907e` priority `required_facts` nhà phố theo chuỗi sếp + `gia`/`phuong` cho mọi loại + view `listing_missing_facts` đọc cột `price_vnd`/`ward`. `prompts.ts` FACT_LABELS/SELLER_SCRIPT | TS-KYGUI-01: `bot/tests/fr176-khop-cau-tra-loi.mjs` 49 ca; e2e G1–G7; TOIUU-07 nới 16→18 truy vấn |
| FR-177 | UF-10 | — | `20260908a` lọc `nhom = 'phu'` khỏi `listing_missing_facts` (ngưỡng priority không phải là cấm — bot vẫn hỏi hướng/quy hoạch khi các nhóm trên hết câu, log 07/09). `20260907h`: `required_facts.nhom` (co_ban/chuyen_mon/phu, priority đơn điệu 1–9/10–19/20+), `hinh_anh` + `so_phong_ngu` vào chuỗi, view `listing_missing_facts` thêm `nhom` + "đã có ảnh"; `diem_tin(listings|uuid)` 7 tiêu chí 15/20/15/10/10/20/10 → `{diem, chi_tiet, thieu[], co_anh}`; `listings.can_chu_duyet`/`chu_duyet_at`; `listings_quyet_dinh_dang_tin` đòi điểm ≥ 70 + dấu duyệt cho tin từ chat. `khop-cau-tra-loi.ts`: `nhanDienFact()` (câu lệch → fact nào), `chonCauKe()` (câu kế bám câu vừa nói, trong nhóm ưu tiên cao nhất), `laDongY()`; `chat-reply`: câu lệch không nhận ra → fact `bo_sung`, câu kế qua `chonCauKe`, `guiBanNhap()` tiền định + câu chờ `duyet_tin`, gật → `chu_duyet_at`; `SELLER_SCRIPT_RULES` khích lệ + thứ tự cơ bản trước; `FACT_LABELS` thêm `hinh_anh/tiem_nang/bo_sung/duyet_tin`. Kiểm: TS-KYGUI-02…12 (`bot/tests/fr177-hoi-nhu-moi-gioi-gioi.mjs` 63 ca, e2e H1–H9), TS-KYGUI-13…16 trên DB thật (hỏi kết cấu trả lời pháp lý → ghi `phap_ly`, giữ câu kết cấu; `bo_sung`; bản nháp; sửa lúc duyệt; gật → lên kệ; tin nhập tay luật cũ), V1.3 đổi kỳ vọng. **09/09 (f–i, `20260909a`)**: `listings.chu_noi_du_at`/`gap`/`boc_tach`; `ghi_boc_tach(uuid,jsonb)` + trigger `trg_zz_fact_vao_boc_tach`; `diem_tin` 8 mục (tiềm năng 10/5, ảnh 4/7/10 theo số tấm, `so_anh`); `seller_drip_tick` nhận `dang_ban` + `can_chu_duyet`, trừ `chu_noi_du_at`; `seller_hoi_bu_tick` + cron `seller-hoi-bu-tick` (*/5 1-13 UTC); `required_facts` thêm `vi_tri` (co_ban, priority 3, mọi loại) + view `listing_missing_facts` coi `location_raw` là đã có + trigger `trg_zz_vi_tri_vao_cot`; `nhan_fact('vi_tri')`; `so.ro_hang.gap` + `boc_tach` (`20260909d`); `bot_prompts` `seller_fewshot`/`seller_script_rules` sửa bằng `replace` cùng chữ TS. `khop-cau-tra-loi.ts`: `laDuRoi()`, `laGap()`, `vi_tri` trong `TU_KHOA`/`nhanDienFact`/`NHOM_FACT`/`LIEN_QUAN`, `danh_gia` luôn khớp. `chat-reply`: cột `gap` + `ghi_boc_tach` + fact `vi_tri` lúc tạo tin; bong bóng "📝 Em ghi nhận: …" (tiền định) trước lời chào (e2e V1.3, H11b); chúc mừng kèm điểm + cách thêm điểm (xuống dòng); "đủ rồi" → `chu_noi_du_at` + đóng câu treo + xin chấm điểm; `xinChamDiem()` khi hết câu; trả lời `danh_gia` → fact + cảm ơn tiền định. `ask-seller`: không OA → `reminders` "💬 …" + ghi `messages`; `tin_nhac.ts` gửi nguyên văn "💬". `prompts.ts`: bỏ "xem giá khu đó", `vi_tri`/`danh_gia` trong `FACT_LABELS`/`CAU_HOI_MAU`, 3 luật giọng mới. Kiểm: TS-KYGUI-18…23 (`fr177-hoi-nhu-moi-gioi-gioi.mjs` 99 ca; e2e V1.3, H1b, H8e/f, H10/H10b/H10c, H11/H12; `tin-nhac.mjs` 22 ca). Nguồn gốc: chủ dự án 09/09/2026; `Kịch bản huấn luyện môi giới (Gemini 07-09-2026).md` | — |
| FR-178 | UF-04, UF-10 | — | `_shared/prompts.ts`: `TONE_RULES` (Aioinhadat, <30 từ, không mã), `HUMAN_CHAT_RULES` (bỏ "#mã · …", lịch xem theo địa chỉ), `SELLER_SCRIPT_RULES` viết lại, `SELLER_FEWSHOT` mới, `CAU_HOI_MAU`/`cauHoiMau()`; `chat-reply`: `SELLER_SYSTEM` thêm few-shot (`P.seller_fewshot`), `neo` theo địa chỉ, bản nháp/duyệt/rao/drip không còn `#code`, câu mẫu qua `cauHoiMau`, danh sách tin cho r3 không mã; `bot_prompts` thêm khoá `seller_fewshot`; **09/09** thêm `cau_hoi_mau` (JSON, `CAU_HOI_MAU_TEXT`, `docCauHoiMau()`, `cauHoiMau(k, ac, bang)`) và `loi_chao` (`LOI_CHAO`, anh Thu) — `20260909e`; chat-reply đọc qua `P` (cache 60 s); e2e V1.3 câu vi_tri đè từ DB, V1.1 lời chào có anh Thu. Kiểm: TS-KYGUI-11/17; e2e G2 (neo địa chỉ, không mã), H5 (CTA "nhắn Zalo cho em"), H8b/c/d (không bong bóng nào có #BDS, câu mẫu là câu người nói, system prompt có few-shot). Tài liệu: `06 §6.8`. | — |
| FR-179 | UF-10 | — | `20260909b`: `app_config.test_reset_hello`, `reset_nguoi_test(text)`; `chat-reply`: khối "hello" sau cổng, `thongBaoNhanTest` nối đầu replies trong `hoanTat`; mock `cau_hinh`/`reset_nguoi_test`. Kiểm: e2e T1, T1b, T2. | — |
| FR-180 | UF-10, UF-04 | — | `20260909c`: bảng `mau_cau` + RLS admin + `so.mau_cau`, RPC `ngu_canh_tin`, `mau_cau_fewshot`; `app/admin/mau-cau/page.tsx`; `chat-reply` `napCauHinh` nạp `mauBan`/`mauMua` → nối vào `SELLER_FEW` và `FEWSHOT` với tiêu đề "Ví dụ CHUẨN do anh/sếp sửa tay"; mock `mau_cau_fewshot`; `scripts/xuat-mau-cau.mjs`; `train/` (README, unsloth_qwen.py, requirements); `sao-luu.mjs` BANG thêm `mau_cau`. Kiểm: e2e H8g; TS-KYGUI-25. | — |
| FR-181 | UF-04, UF-10 | — | `prompts.ts`: `KHO_TEN_TRO_LY` (20), `tenTroLy()` (FNV-1a), `dienTen()`; `TONE_RULES`/`LOI_CHAO`/`SELLER_FEWSHOT` viết "{ten}"; `chat-reply` điền `tenBot` vào TONE/LOI_CHAO_DB/SELLER_FEW, ghi `sellers.ten_tro_ly` lượt đầu (`.is(null)`), `delta.ten_tro_ly` vào `merge_buyer_prefs`; `ask-seller`/`nudge` `dienTen` theo Zalo người nhận; `20260909h`: cột `sellers.ten_tro_ly`, `bot_prompts` 5 khoá sinh từ TS, `mau_cau_fewshot` "→ Trợ lý:", `seller_ranks.ten_tro_ly`, `so.nguoi_ban.tro_ly`; `/admin/tin-nhan` nhãn "Trợ lý"; `scripts/xuat-mau-cau.mjs` điền "T•ai" cố định. Kiểm: e2e V1.1b, N1, N1b, N2, TOIUU-02/07/07b; `fr177-hoi-nhu-moi-gioi-gioi.mjs` 5 ca tên (TS-KYGUI-26) | — |
| FR-182 | — | — | OPEN-55 (bảng 14 dòng chat ↔ hệ thống, quyết định từng dòng); không có mã riêng | — |
| FR-183 | UF-10 | — | `20260909h`: `diem_nguoi_ban(uuid)` (grant authenticated+service_role, kiểm `la_admin()`), `seller_ranks.diem_nguoi_rao`, `so.nguoi_ban.diem_nguoi_rao`; `chat-reply` khối duyệt: RPC khi `nhieuCan`, dòng "Điểm người rao của …"; mock rpc `diem_nguoi_ban` chép công thức. Kiểm: e2e N11 (TS-KYGUI-27) | — |
| FR-184 | UF-10, UF-13 | — | `khop-cau-tra-loi.ts`: `laNgungRao()` (`ban_roi`/`rut`/null), `chonCanTheoCau()`; `chat-reply` khối FR-184 trước FR-164: một căn → `status` `da_chot`/`an` + `chu_noi_du_at` + expired/cancelled + `ghi_boc_tach{ket_thuc}`; nhiều căn → câu chờ `ngung_rao_can_nao` (answer = kiểu) + `chonCanTheoCau`; nhường khối duyệt khi đang `duyet_tin` và `laDongY`; `nhan_fact('ngung_rao_can_nao')`. Kiểm: `fr177` 30 ca (11 bán rồi, 7 rút, 12 không), 9 ca chọn căn; e2e N3, N4, N4b, N5, N6c (TS-KYGUI-28) | — |
| FR-185 | UF-10 | — | `_shared/ai/phan-loai-anh.ts` (`AnhSchema`, `phanLoaiAnh()`, `lechDienTich()`, `DAU_HIEU_PHAN_LOAI_ANH`), `_shared/kho_anh.ts` (`taiAnh()`, `catAnhVaoKho()`); `chat-reply` `nhanAnh()` thay `ghiAnhKem`/khối ảnh trần, `ackAnh` vào `traLoiSeller`, đóng câu `hinh_anh` treo, fact `dien_tich`/`bo_sung` nguồn `so_do_ocr`, việc 📐; `20260909h`: `listing_media.nguon/mo_ta/ocr`; mock: `storage.from().upload/remove`, `__storageHong`, `__anh`, fetch giả host Zalo, `diemTin`/`missingFacts` đếm `listing_media`; `ranh-gioi.mjs` bao `_shared/ai/`. Kiểm: e2e V2.1/V2.1b/V2.1c/V2.2/V2.2b, N9, N10, N10b, N10d (TS-KYGUI-29) | — |
| FR-186 | UF-10 | — | `20260909h`: `required_facts.deal`, index (property_type, fact_key, coalesce(deal)), reseed 94 dòng 8 loại, `listing_missing_facts` lọc deal, `nhan_fact` khoá mới; `prompts.ts`: `CAU_HOI_MAU` khoá `fact@loai` + 7 câu mới, `cauHoiMau(…, loai)`, `FACT_LABELS`; `khop-cau-tra-loi.ts`: `HOI_SO`/`TU_KHOA`/`NHAN_HOI_LAI`/`nhanDienFact`/`LIEN_QUAN`; `chat-reply` truyền `property_type` vào `cauHoiMau` (3 chỗ), select `property_type/project_id/area_m2` trong câu chờ; `SELLER_SCRIPT_RULES` thứ tự theo loại; mock `missingFacts()` theo loại + deal. **`20260909i`**: enum + 4 loại (`toa_nha`, `dat_nong_nghiep`, `dat_kinh_doanh`, `kho_xuong`), nhóm `sau_dang`, seed +~110 dòng, `guess_property_type`/`_answer`, `diem_tin` nhánh loại mới, `nhan_fact` 36 khoá; `chat-reply` lọc `sau_dang` (2 chỗ); `khop-cau-tra-loi.ts` `HOI_CO_KHONG`, `HOI_SO`, `nhanDienFact` 30+ mẫu; `prompts.ts` `CAU_HOI_MAU`/`FACT_LABELS`/`SELLER_SCRIPT_RULES`; web `TYPE_LABEL`, `LOAI_HOP_LE`, `tags.ts` (`toa-nha`, `kho-xuong`), `parse-query.ts`, select admin; mock `REQ` 4 loại + `SAU_NHA`, đoán loại, rpc guess. Kiểm: `fr177` 10 ca nhận diện + 5 ca `chonCauKe` + 4 câu mẫu; e2e H4b, N6, N6b, N7, N7b, N8, N8b (TS-KYGUI-30); N13, N13b, N14 (TS-KYGUI-33). **09/09 tối**: `khop-cau-tra-loi.ts` `HO_FACT`/`cungHoFact`, tiền kiểm `nhanDienFact` trong `phanLoaiCauTraLoi`, `nhanDienNhieuFact`, `boDauGiuDoDai`, luật `vi_tri`/`do_rong_hem`/`do_rong_duong`/`doanh_thu`/`phi_quan_ly`/`san_vuon`/`tho_cu`/`len_tho_cu`/xã; `chat-reply` `coLoaiBDS`/`moiGioiCoHang`, sửa-xong-hỏi-tiếp, ghi nhiều fact (khớp + chuyển sang), r2/r2b buộc đúng câu, hứa-khi-duyệt, `LOAI_GHI`/`LOAI_VI` 4 loại, `diaChiGon`, bản nháp đầy đủ (FR-177 j), tắt bong bóng nhãn (FR-159); `ask-seller` gom 2–3 (FR-177 k); `20260909k`, `20260909l`. Kiểm: e2e 229 + FR-177 196 sau vá; kịch bản thật chạy lại (TS-KYGUI-34) | — |
| FR-188 | UF-10, UF-04 | — | `20260909n`: required_facts `gap` ×11, `doc_gap()`, `listing_facts_sync_gap`, view; `khop-cau-tra-loi.ts` luật gap + `HOI_CO_KHONG` + `FACT_PHU` gia; `prompts.ts` CAU_HOI_MAU/FACT_LABELS gap; `chat-reply` buyer `delta.gap` (laGap), `khoQ.order("gap")`; mock gap. Kiểm: e2e N18/N18b/N18c/N19 | — |
| FR-189 | UF-10, UF-04 | — | `20260909n`: `conversations.human_hold`, `ensure_seller/buyer_conversation` +`c_human_hold`, RPC `giu_khach`; `chat-reply` lệnh "#mã giữ / trả bot", `humanActive`/buyer gate đọc `human_hold`; `app/admin/tin-nhan` nhãn + nút. Kiểm: e2e N20/N20b/N20c | — |
| FR-190 | UF-11 | — | `20260909n`: `ctvs.khu_vuc`, `app_config.ctv_tran_ca`, `ctv_dang_ganh()`, `chon_ctv()`, `route_info_request`, `assign_ctv_round_robin`. Kiểm: TS-KYGUI-35 (DB thật) | — |
| FR-191 | UF-10 | — | `20260909n`: `seller_keep_alive_tick()` + cron `seller-keep-alive-tick` 02:30 UTC; `ask-seller` lọc `expired` (FR-186 o). Kiểm: TS-KYGUI-35 | — |
| FR-192 | UF-11 | WF-13 | `20260910a`: `quota_tieu_hao()` (trần ngày từ Vault, trần theo người từ `chat_quota`, dấu hết số dư từ `bot_errors`); web `app/admin/page.tsx` thẻ Quota tiêu hao + băng cảnh báo. Kiểm: TS-QUOTA-01…03 | — · `20260910l`: `het_credit` cần thêm dấu `bot_health(model_chinh)` (TS-QUOTA-04) |
| FR-193 | UF-04 | — | `20260910b`: `guess_property_type`/`_answer` so trên `bo_dau()`; `chat-reply` `quanDoc` (không tự nhận quận) + chào lại. Kiểm: e2e N30, V1.3, TS-LOAI-01 | — |
| FR-194 | UF-04 | — | `_shared/groq.ts` (`bocDuPhong`, `nenDoiSang`), `_shared/claude.ts` bọc client; Vault `GROQ_API_KEY`/`GROQ_MODEL`. Kiểm: TS-GROQ-01…03 | — |
| FR-195 | UF-04 | WF-13 | `20260910f`: bảng `project_facts`, `ghi_fact_du_an()`, `duyet_fact_du_an()`, view `project_facts_cho_duyet`; `chat-reply` `chepSangDuAn()`; web thẻ duyệt ở tab Vận hành. Kiểm: e2e N34, TS-DUAN-02 | — |
| FR-196 | UF-06 | — | `chat-reply` luật số trong hai khối dự án; `scripts/dao-sau-du-an.mjs` (Groq, JSON schema, xoay model). Kiểm: TS-DUAN-03 | — |
| FR-197 | UF-11 | WF-13 | `20260910i`: `don_du_lieu_thu()` + cron 14:00 UTC; `20260910h`: `quota_tieu_hao` thêm cờ dự phòng, `project_facts.ten_du_an`; web băng cảnh báo + chuông theo loại lỗi. Kiểm: TS-DON-01 | — |
| FR-198 | UF-04 | — | `_shared/claude.ts` `MODEL` đọc secret `ANTHROPIC_MODEL` (mặc định Haiku 4.5); `_shared/tham-so-model.ts` lọc `output_config.effort` theo tên model; `bot/tests/tham-so-model.mjs` trong `test:bot`. Kiểm: TS-MODEL-01 | — |
| FR-199 | UF-04 | — | `_shared/extraction/vet-du-an-loc.ts` (van + dọn, tiền định) · `_shared/ai/boc-du-an.ts` (gọi model, JSON schema) · `chat-reply` `vetDuAnBangModel()` nối ở đường ra `traLoiSeller`; ghi qua `ghi_fact_du_an` với `nguon='llm'`. Kiểm: TS-VET-01 | — |
| FR-200 | UF-11 | WF-13 | `20260910k`: `doc_bot_prompts()` + `sua_bot_prompt()` + cột `bot_prompts.sua_boi`; web `/admin/prompt` so với `_shared/prompts.ts`. Kiểm: TS-PROMPT-01 | — |
| FR-201 | UF-11 | WF-13 | `/admin/ro-hang`: `luuSua(duyet)` đặt `status='dang_ban'` kèm xác nhận + danh sách ô thiếu; dropdown ngoài bảng khoá mục *đang bán*. Kiểm: TS-DUYET-01 | — |
| FR-202 | UF-06 | — | `nudge` cất tin vào `reminders.noi_dung_gui`, `nhan_viec_nhac` bỏ qua dòng đó (`20260911b`); `nhacChuNha()` đặt dòng nhắc chủ nhà; `escalation-feed` pull trả thêm dòng soạn sẵn (buyers/sellers), ack ghi tin vào hội thoại. Kiểm: TS-NHAC-CLONE-01 | — |
| FR-203 | UF-11 | — | bảng `bridge_dang_nhap` + `yeu_cau_quet_lai_zalo()` (`20260911b`); `escalation-feed` action `qr` + cờ `quet_lai`; bridge `baoDangNhap()`/`phienChet()`/`actions.retry()`; `/admin` ô `TheZaloClone`. Kiểm: TS-QR-01 | — |
| FR-187 | UF-10 | WF-ADMIN | `20260909i`: `jsonb_bo_rong(jsonb)`, `boc_tach_nhom(listings)` + `boc_tach_nhom(uuid)`, view `boc_tach_v`, `so.boc_tach`; `components/admin/BocTachNhom.tsx` (`NHAN_NHOM`, `sapNhom`, `useBocTach`, `taiJsonTin`); `app/admin/ro-hang/json/page.tsx` đọc `boc_tach_v`; `app/admin/ro-hang/page.tsx` nút JSON + `DongJson`. Kiểm: TS-KYGUI-33 (DB thật) | — |
| FR-97 | | — | — | — |

## 8.4 Rủi ro → biện pháp

| RSK | Biện pháp trong đặc tả |
|---|---|
| RSK-01 | FR-63, SRS-5.3 `zalo_keepalive`, UF-08, AC-06 |
| RSK-02 | NFR-12, SRS-2.1 (tầng messaging tách rời) |
| RSK-03 | FR-40, UI-C05, SRS-5.1 bất biến I3, §6.8 quy tắc 4 |
| RSK-04 | Thứ tự phát hành SRS-8 (P1 trước P2) |
| RSK-05 | UF-06 nhánh lỗi, SRS-5.2 xếp hạng |
| RSK-06 | `last_verified_at`, SRS-5.3 `stale_listing_check`, WF-03 |
| RSK-07 | NFR-06, SRS-3.9, §6.7 |

## 8.6 NFR → hiện thực → cách nghiệm thu

Chỉ liệt NFR **đã có hiện thực trong code**; NFR còn là mục tiêu nằm ở `07 §6`.

| NFR | Hiện thực ở | Nghiệm thu |
|---|---|---|
| NFR-01 (bot trả lời < 3 s p95) | Số vòng DB đo bằng e2e (FR-171); view `bot_do_tre` p50/p95 7 ngày (`20260904f`) | TS-TOIUU; thẻ `/admin` |
| NFR-04 (tin nhắn không mất khi một bên offline) | FR-166: `inbound_events` + `inbound_ledger` + `inbound-sweep` mỗi phút + `lan_thu_ke()` | TS-JOB, TS-IDEM2 |
| NFR-06 (giấy tờ không lộ) | bucket `listing-private` + CHECK giấy tờ phải bucket riêng + RLS lọc anon (FR-165/167); admin xem qua `createSignedUrl` 15' (`20260904g`) | TS-KHO-20…25, TS-WEB2 |
| NFR-16 (free-tier trước) | Supabase Free + Vercel Hobby; quyết định giữ nguyên 27/08 (OPEN-25) | Ràng buộc kèm theo: chạy `scripts/sao-luu.mjs` định kỳ vì Free KHÔNG có backup tự động — 31 bảng, `manifest.json` ghi trạng thái từng bảng, `liet_ke_bang()` DỪNG khi thiếu bảng (OPEN-47); bài tự kiểm TS-SAOLUU (`scripts/sao-luu.tu-kiem.mjs`, PostgREST giả) chạy mỗi PR; phục hồi có `scripts/phuc-hoi.mjs` + `soat-phuc-hoi.mjs` và diễn tập TS-PHUCHOI (10 cảnh trên Postgres thật, CI job `phuchoi`) — quy trình đầy đủ ở `docs/12`. **07/09: bản sao đầu tiên đã tồn tại** (31/31 bảng, `day_du`, trên OneDrive thư mục hạn chế quyền) và `schema.sql` đã sinh (PR #35) — nhưng **vẫn chưa có lượt phục hồi bản sao thật nào**, và bản 07/09 chạy TRƯỚC `up-anh.mjs` nên `listing_media` trong đó rỗng (OPEN-47) |
| NFR-17 (trang tin phải trong cache) | `generateStaticParams()` ở `app/nha-dat/[code]/page.tsx`; `unstable_cache` bọc truy vấn trong `components/ListingBrowse.tsx` và `lib/photos.ts`; SRS-3.13 | TS-CACHE-01…05 |
| NFR-18 (xanh phải là xanh thật) | `bot_health_tick()` quét `net._http_response` → `bot_errors`; `log_loi()` + `ghiLoi()` cho lỗi trả-200; SRS-3.12 | TS-HEALTH-01…06, TS-LOG-01…06 |
| NFR-09 (SEO) | `app/sitemap.ts`, `app/robots.ts`, `metadataBase`/canonical/OpenGraph ở `app/layout.tsx` + trang tin + `app/[tag]`, JSON-LD `RealEstateListing` ở `app/nha-dat/[code]/page.tsx`, `lib/tags.ts` (64 tag — chờ TOP-100 OPEN-06) | TS-SEO-01…06 |

---

## 8.5 FR chưa có đặc tả kỹ thuật đầy đủ

| FR | Thiếu gì | Theo dõi ở |
|---|---|---|
| FR-99 (định giá so sánh) | Thuật toán, nguồn dữ liệu giá thị trường | `OPEN-10` |
| FR-102 (chấm điểm NMG) [deprecated → FR-137] | Ngưỡng cảnh báo khi NMG dưới chuẩn (OPEN-12). Phần trùng lặp đã xử lý: `rate-ctv` + `ratings` xoá 27/08/2026 | `OPEN-12` |
| FR-28 (tiện ích quanh BĐS) | Nguồn dữ liệu POI (Google Places? tự nhập?) | `OPEN-13` |
| FR-16 (fingerprint) | Thư viện, chính sách lưu trữ, cơ chế từ chối | `OPEN-14` |
| FR-118 (`ward_mapping`) | Nguồn dữ liệu máy-đọc-được danh mục phường cũ↔mới (NQ 202/2025/QH15), schema bảng trong SRS | — |
