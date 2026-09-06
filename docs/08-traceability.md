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
| FR-74, FR-75 | — | WF-13 | SRS-3.11 (04/09/2026): policy `buyers_admin_read`; ô "Tìm khách" + link `zalo.me/<uid>` (best-effort) ở `app/admin/page.tsx`, không chọn `phone` | AC-09 · TS-ADM2-03, TS-ADM2-11 |
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
| FR-172 | UF-01, UF-03, UF-05, UF-06 | WF-02, WF-03, WF-05 | `20260902e/f/g`, `20260903c`: 24 cột thông số + `price_per_m2_vnd`, `boc_thong_so()`, `boc_ten_duong()`, `ap_thong_so()`, `trg_y_listings_boc_thong_so`; `_shared/thong_so.ts`; web bảng thông số + bộ lọc | TS-THONGSO-01…15, e2e THONGSO |
| FR-173 | UF-05, UF-11 | — | `20260903a/b`: `sla_due_at`/`sla_missed_at`, `ctv_sla_phut()`, `route_info_request` (`buyer_ask` → CTV), `info_request_sla_tick()` + cron `ctv-sla-tick`, `nguoi_noi_bo()`, view `ctv_ranks`; `chat-reply` nhánh nội bộ `#mã: trả lời`; `ctv-report` dòng hạng; `/admin` thẻ hạng CTV | TS-CTV-01…06, e2e CTV |
| FR-174 | UF-04, UF-09, UF-10 | — | `_shared/dia_ban.ts` (`bocQuan`) + `chat-reply` `district`; `20260903d` `admin_dang_tin` nhận `district`; ô quận `/quan-ly`; copy web Sài Gòn + Long An. Đợt 2 (`wards`, FR-118) chờ OPEN-27 | TS-DIABAN-01…04, e2e DIABAN |
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
| NFR-16 (free-tier trước) | Supabase Free + Vercel Hobby; quyết định giữ nguyên 27/08 (OPEN-25) | Ràng buộc kèm theo: chạy `scripts/sao-luu.mjs` định kỳ vì Free KHÔNG có backup tự động — 31 bảng, `manifest.json` ghi trạng thái từng bảng, `liet_ke_bang()` DỪNG khi thiếu bảng (OPEN-47); bài tự kiểm TS-SAOLUU (`scripts/sao-luu.tu-kiem.mjs`, PostgREST giả) chạy mỗi PR; phục hồi có `scripts/phuc-hoi.mjs` + `soat-phuc-hoi.mjs` và diễn tập TS-PHUCHOI (10 cảnh trên Postgres thật, CI job `phuchoi`) — quy trình đầy đủ ở `docs/12`, và **chưa có lượt phục hồi bản sao thật nào** |
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
