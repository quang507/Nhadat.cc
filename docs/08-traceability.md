# 08 — Traceability Matrix

Cập nhật **cùng commit** với bất kỳ thay đổi nào ở `01`…`07` (quy ước 4, `CLAUDE.md`).

## 8.1 Business Requirement → Functional Requirement

| BR | Mục tiêu | FR liên quan |
|---|---|---|
| BR-01 | Phủ 90% nguồn hàng Q5 | FR-90…FR-97, FR-101 |
| BR-02 | 20 NMG | FR-101, FR-102 |
| BR-03 | 10 chat/ngày, ≥30 tin | FR-13, FR-14, FR-20…FR-32, FR-71 |
| BR-04 | 1 giao dịch/2 ngày | FR-50…FR-57, FR-99 |
| BR-05 | Thu phí bên bán | FR-101, FR-102 |
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
| INS-11 | Trung gian toàn phần, ẩn danh hai chiều | FR-104…FR-112, UF-10, UF-13, SRS-3.8 |
| INS-12 | Sau sáp nhập 2025, địa giới cũ vẫn là ngôn ngữ thị trường | FR-118 (`ward_mapping`), Taxonomy §4.6 (04), FR-12 (trang tag) — quyết định chủ dự án 24/08/2026 |

## 8.3 FR → UF → WF → SRS → AC

| FR | User Flow | Wireframe | SRS | Acceptance |
|---|---|---|---|---|
| FR-01…06 | UF-01 | WF-01 | SRS-2.1 | — |
| FR-07, FR-08 | UF-01 | WF-02 | SRS-4.5 | AC-01 |
| FR-09 | UF-01 | WF-02 | SRS-4.5 | AC-12 |
| FR-10, FR-11 | UF-02 | WF-03 | SRS-3.1 | AC-01 |
| FR-12 | UF-01 | WF-04 | §4.4 (IA) | AC-01 |
| FR-13, FR-14 | UF-03 | WF-01, WF-02 | SRS-4.7 | AC-01 |
| FR-15 | UF-02 | WF-03, WF-04 | — | — |
| FR-16 | UF-01 | — | SRS-3.3 `fingerprint_ids` | — |
| FR-17 | — | WF-04 | NFR-09 | — |
| FR-20…FR-26 | UF-04 | WF-05 | SRS-5.1 | AC-02 |
| FR-27, FR-28 | UF-04 | WF-03, WF-05 | SRS-3.8 `photos` | — |
| FR-29, FR-30 | UF-03, UF-04 | WF-05 | SRS-4.7; chat-reply: khối "CĂN KHÁCH ĐANG NHẮC" (tra mã căn trong tin + facts đã xác minh, chào đúng căn) | AC-01 |
| FR-31, FR-32 | UF-04 | WF-05 | SRS-5.2; FR-32: reminder `followup` 2,5h sau khi bot nói về một căn (huỷ khi khách nhắn lại, ≤1/24h) + nhánh followup trong edge `nudge` | — |
| FR-40…FR-47 | UF-05 | WF-06, WF-10 | SRS-3.6, SRS-4.1, SRS-4.2 | AC-03 |
| FR-50…FR-57 | UF-06 | WF-07 | SRS-3.7 | AC-04 |
| FR-56 | UF-07 | — | SRS-5.2 (loại listing đã từ chối) | AC-05 |
| FR-60…FR-65 | UF-08 | — | SRS-5.3 | AC-06 |
| FR-70…FR-73 | — | WF-12 | SRS-3.2 | AC-09 |
| FR-74, FR-75 | — | WF-13 | SRS-3.5 | AC-09 |
| FR-76 | UF-05, UF-11 | WF-12 | SRS-3.6 | AC-09 |
| FR-77 | UF-11 | WF-14 | SRS-5.4 | AC-10 |
| FR-78, FR-79 | UF-06, UF-11 | WF-14 | SRS-3.7, SRS-3.8 | AC-10 |
| FR-80 | — | WF-12…14 | UI-C10 | AC-09 |
| FR-81 | UF-11 | — | SRS-5.5 | AC-10 |
| FR-90…FR-96 | UF-09 | WF-08, WF-09 | SRS-4.6 | AC-07 |
| FR-98 | UF-05 | WF-10 | SRS-4.2 | AC-03 |
| FR-99 | — | — | — | *chưa đặc tả — `OPEN-10`* |
| FR-100 | UF-12 | WF-11 | SRS-4.3 | AC-11 |
| FR-101, FR-102 | UF-09 | WF-09 | SRS-3.4 | — |
| FR-103 | UF-09 | — | SRS-5.3 | — |
| FR-104, FR-105 | UF-06, UF-12 | — | SRS-3.8 (bất biến ẩn danh) | — |
| FR-106, FR-107, FR-108 | UF-13 | — | SRS-3.8, SRS-5.3 | — |
| FR-109, FR-111 | UF-10 | — | SRS-3.8 | — |
| FR-110 | UF-05 | WF-06 | SRS-5.3 `info_request_sla` | — |
| FR-112 | UF-07 | — | SRS-3.8 `deals` | — |
| FR-113 | — | — | SRS-3.10 `projects` | AC-13 |
| FR-114 | UF-09, UF-10 | WF-09 | SRS-3.10 | AC-13 |
| FR-115, FR-116 | UF-05 | — | SRS-3.10, SRS-5.1 (nhánh tầng dự án / tồn kho căn) | AC-13 |
| FR-117 | — | — | *giai đoạn 2 — chưa đặc tả UI* | — |
| FR-118 | — | — | *chưa đặc tả kỹ thuật — bảng `ward_mapping` sẽ vào SRS-3.x khi chốt nguồn dữ liệu NQ 202/2025/QH15* | — |
| FR-119 | — | — | app/tinh-lai-vay (client, không đụng DB) | — |
| FR-120 | — | — | app/thong-ke (đọc listings qua RLS anon) | — |
| FR-121 | — | — | localStorage phía trình duyệt, không lưu server | — |
| FR-122 | — | — | app/ban-do + lib/geo (tâm phường, tôn trọng SRS-3.8 ẩn danh) | — |
| FR-123 | UF-01 | WF-03 | app/mua-ban, cho-thue (query param) | — |
| FR-124 | UF-09 | — | sellers.auth_user_id + RLS listings_own_* | — |
| FR-125 | — | — | view `agents_public` (không lộ phone) | — |
| FR-126 | UF-08 | — | `buyers.auth_user_id`, `listing_views`, app/tai-khoan | — |
| FR-127 | UF-11 | WF-12 | bảng `admins` + RLS `listings_admin_*`, app/admin | — |
| FR-128 | UF-01 | WF-03 | `listings.bedrooms` + backfill regex | — |
| FR-129 | UF-05, UF-09 | — | trigger `listing_insert_drip` + cron `seller_drip_tick` (trần 2 căn/24h/seller) + ask-seller mode drip + chat-reply nhánh seller; văn phong §6.8 "Kịch bản người bán" (06) | — |
| FR-130 | UF-04, UF-08 | WF-05 | `buyers.preferences` + chat-reply (bóc tách hồ sơ + nhịp hỏi §6.8 FR-130) | — |
| FR-131 | UF-04 | — | chat-reply KHÔNG delay nhân tạo (chỉ check nhường-lượt khi có tin mới hơn) + RPC `ensure_buyer_conversation` (advisory lock); bridge/zalo-webhook bỏ typing giả, giữa 2 bong bóng chỉ 300ms giữ thứ tự | — |
| FR-132 | UF-04, UF-05 | — | bảng `projects` (chỉ Ny'ah — seed mogi đã gỡ theo quyết định 25/08, cơ chế nạp giữ ở code) + RPC `match_projects` + khối KHO DỰ ÁN trong chat-reply (thực thi FR-115) | AC-13 |
| FR-133 | UF-05, UF-08 | — | bảng `reminders` + chat-reply (bóc promise, hủy khi quay lại) + edge `nudge` + cron `nudge-tick` 30' (thực thi FR-63 phía bot); giờ gửi 8h–21h VN + jitter 0–45s trong `nudge` | AC-06 |
| FR-134 | UF-04 | — | chat-reply nhận `image_url` (content block image, chỉ dẫn "hình như là"); zalo-webhook bắt `user_send_image`; bridge zca-js bắt content.href | — |
| FR-135 | UF-04 | — | trường `need_human` trong BuyerTurn (chat-reply) + cột `conversations.needs_human/needs_human_at`; đơn chờ hiện trong báo cáo FR-137 | — |
| FR-136 | — | — | bảng `ctvs` + cột `conversations.ctv_id` + trigger `trg_conversations_assign_ctv` (function `assign_ctv_round_robin`) (ít đơn 30-ngày nhất nhận trước) | — |
| FR-137 | — | — | edge `ctv-report` + cron `ctv-report-tick` 17h VN (10:00 UTC) + bảng `ctv_daily_reports`; chấm điểm bằng `RATE_CTV_RUBRIC` (_shared/prompts.ts) | — |
| FR-138 | — | — | bảng `bot_prompts` (seed từ _shared/prompts.ts) + loader trong `chat-reply`/`nudge` (DB đè code, fallback về prompts.ts) | — |
| FR-139 | UF-04, UF-05 | WF-04/06 (badge/banner) | `listings.status` text 5 trạng thái + trigger `trg_z_listings_normalize_status` (dịch nhãn cũ, auto-publish khi đủ giá+diện tích+phường) + RPC `mark_listing_interest` (gọi từ chat-reply theo mã căn) + cron `listing-interest-decay` 7 ngày + RLS anon chỉ đọc dang_ban/dang_quan_tam/da_chot; web: badge 🔥, banner đã chốt, admin duyệt cho_thong_tin | — |
| FR-140 | UF-04, UF-09 | — | trường `ask_owner` (BuyerTurn) → `info_requests` source `buyer_ask` + trigger `trg_route_info_request` (seller → CTV còn liên lạc → admin) + `trg_notify_info_request_escalation` (reminder `escalation`) + nhánh escalation trong `nudge` (OA) + edge `escalation-feed` + vòng poll bridge zca-js (resolve SĐT admin/CTV từ bảng `admins`/`ctvs`) | — |
| FR-141 | UF-04 | — | cột `conversations.human_touch_at` + `messages.sender='human'` + bridge phân biệt tin bot/người thật (botSent set) + endpoint `human_note` và cửa im-30-phút trong chat-reply | — |
| FR-142 | UF-04, UF-07 | — | trường `agreed_deal` (BuyerTurn) + `bot_prompts.agree_rules` + insert `deals` (fee 1%/0.5%) + listing → `da_chot` + reminder escalation 🤝; bridge map sticker/reaction thành "[sticker cảm xúc]"/"[khách thả cảm xúc]" | — |
| FR-143 | UF-04 | — | facts `hinh_anh` → mảng `photos` trong response chat-reply (trường `send_photos` + fallback regex, ≤4 hình); bridge tải URL gửi ảnh đính kèm; zalo-webhook gửi OA media template | — |
| FR-144 | UF-05, UF-09 | — | nhánh `wantsSell` trong chat-reply (tạo tin nháp + hỏi câu đầu) + đồng bộ `area_m2` từ fact diện tích + điều kiện `published` ngừng drip + trigger escalation cho assignee seller (source buyer_ask) + guard một-câu-một-lúc trong `ask-seller` drip | — |
| FR-145 | UF-01, UF-03 | WF-01 | component `ZaloWidget` (client, ẩn trên `/nha-dat/*`) gắn ở `app/layout.tsx`; link cấu hình `ZALO_OA_URL` / env `NEXT_PUBLIC_ZALO_URL` (lib/format.ts) | — |
| FR-146 | UF-04 | — | khối trần 100 tin/24h trong `chat-reply` (đếm `messages` sender=buyer, cờ `rate_limited`, một tin báo rồi im) + `conversations.needs_human` + reminder `escalation` gán CTV | — |
| FR-147 | UF-04, UF-09 | — | `conversations.needs_human_at` / `human_escalated_at`; nhánh `need_human` trong `chat-reply` (escalation gán CTV, chống lặp) + khối ladder 30 phút trong `nudge` (escalation không gán CTV → admin) + hạ cờ & huỷ nhắc ở endpoint `human_note` | — |
| FR-148 | UF-01, UF-03, UF-04 | WF-02, WF-03 | bucket Storage công khai `listing-photos` (`<mã>/<file>`) + view `public.listing_photos_v`; web `lib/photos.ts` (`coverByCode`, `photosOfCode`) → `ListingCard` prop `photo` + gallery trang chi tiết; bot gộp ảnh kho + facts `hinh_anh` khi trả `photos` | — |
| FR-149 | UF-09 | — | `admins.zalo_phone` (số admin, không nằm trong code); `reminders.kind='report'` + `ctv-report` đẩy hàng đợi (`queued_bridge`) + `escalation-feed` phục vụ cả `escalation`/`report` (report gửi nguyên văn) + `nudge` gửi OA khi còn OA + vòng poll bridge zca-js | — |
| FR-97 | *[deprecated → FR-109]* | — | — | — |

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

## 8.5 FR chưa có đặc tả kỹ thuật đầy đủ

| FR | Thiếu gì | Theo dõi ở |
|---|---|---|
| FR-99 (định giá so sánh) | Thuật toán, nguồn dữ liệu giá thị trường | `OPEN-10` |
| FR-102 (chấm điểm NMG) | Quy trình thu thập rating, ngưỡng cảnh báo | `OPEN-12` |
| FR-28 (tiện ích quanh BĐS) | Nguồn dữ liệu POI (Google Places? tự nhập?) | `OPEN-13` |
| FR-16 (fingerprint) | Thư viện, chính sách lưu trữ, cơ chế từ chối | `OPEN-14` |
| FR-118 (`ward_mapping`) | Nguồn dữ liệu máy-đọc-được danh mục phường cũ↔mới (NQ 202/2025/QH15), schema bảng trong SRS | — |
