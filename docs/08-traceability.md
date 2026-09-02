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
| FR-101, FR-102 | UF-09 | WF-09 | SRS-3.4 | *[FR-102 deprecated → FR-137]* Chấm điểm CTV/NMG nằm trong `ctv-report` (rubric `RATE_CTV_RUBRIC`). Edge `rate-ctv` + bảng `ratings` đã XOÁ 27/08/2026 theo OPEN-23 |
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
| FR-139 | UF-04, UF-05 | WF-04/06 (badge/banner) | `listings.status` text 5 trạng thái + trigger `trg_z_listings_normalize_status` (dịch nhãn cũ) *[28/08/2026 — khúc tự đăng đã cắt khỏi đây, nay `trg_zz_listings_dang_tin` quyết định một mình; xem FR-164d]* + RPC `mark_listing_interest` (gọi từ chat-reply theo mã căn) + cron `listing-interest-decay` 7 ngày + RLS anon chỉ đọc dang_ban/dang_quan_tam/da_chot; web: badge 🔥, banner đã chốt, admin duyệt cho_thong_tin | — |
| FR-140 | UF-04, UF-09 | — | trường `ask_owner` (BuyerTurn) → `info_requests` source `buyer_ask` + trigger `trg_route_info_request` (seller → CTV còn liên lạc → admin) + `trg_notify_info_request_escalation` (reminder `escalation`) + nhánh escalation trong `nudge` (OA) + edge `escalation-feed` + vòng poll bridge zca-js (resolve SĐT admin/CTV từ bảng `admins`/`ctvs`) | — |
| FR-141 | UF-04 | — | cột `conversations.human_touch_at` + `messages.sender='human'` + bridge phân biệt tin bot/người thật (botSent set) + endpoint `human_note` và cửa im-30-phút trong chat-reply | — |
| FR-142 | UF-04, UF-07 | — | trường `agreed_deal` (BuyerTurn) + `bot_prompts.agree_rules` + insert `deals` (fee 1%/0.5%) + listing → `da_chot` + reminder escalation 🤝; bridge map sticker/reaction thành "[sticker cảm xúc]"/"[khách thả cảm xúc]" | — |
| FR-143 | UF-04 | — | facts `hinh_anh` → mảng `photos` trong response chat-reply (trường `send_photos` + fallback regex, ≤4 hình); bridge tải URL gửi ảnh đính kèm; zalo-webhook gửi OA media template | — |
| FR-144 | UF-05, UF-09 | — | nhánh `wantsSell` trong chat-reply (tạo tin nháp + hỏi câu đầu) + đồng bộ `area_m2` từ fact diện tích + điều kiện `published` ngừng drip + trigger escalation cho assignee seller (source buyer_ask) + guard một-câu-một-lúc trong `ask-seller` drip | — |
| FR-145 | UF-01, UF-03 | WF-01 | component `ZaloWidget` (client, ẩn trên `/nha-dat/*`) gắn ở `app/layout.tsx`; link cấu hình `ZALO_OA_URL` / env `NEXT_PUBLIC_ZALO_URL` (lib/format.ts) | — |
| FR-146 | UF-04 | — | khối trần 100 tin/24h trong `chat-reply` (đếm `messages` sender=buyer, cờ `rate_limited`, một tin báo rồi im) + `conversations.needs_human` + reminder `escalation` gán CTV | — |
| FR-147 | UF-04, UF-09 | — | `conversations.needs_human_at` / `human_escalated_at`; nhánh `need_human` trong `chat-reply` (escalation gán CTV, chống lặp) + khối ladder 30 phút trong `nudge` (escalation không gán CTV → admin) + hạ cờ & huỷ nhắc ở endpoint `human_note` | — |
| FR-148 | UF-01, UF-03, UF-04 | WF-02, WF-03 | *[cập nhật 29/08/2026 → FR-165: bucket nay là `listing-public`, đường dẫn theo `<listing UUID>/<media UUID>`, metadata ở bảng `listing_media`, thứ tự theo `sort_order`]* ~~bucket Storage công khai `listing-photos` (`<mã>/<file>`)~~ + view `public.listing_photos_v` (dựng lại trên `listing_media`); web `lib/photos.ts` (`coverByCode`, `photosOfCode`) → `ListingCard` prop `photo` + gallery trang chi tiết; bot gộp ảnh kho + facts `hinh_anh` khi trả `photos` | — |
| FR-149 | UF-09 | — | `admins.zalo_phone` (số admin, không nằm trong code); `reminders.kind='report'` + `ctv-report` đẩy hàng đợi (`queued_bridge`) + `escalation-feed` phục vụ cả `escalation`/`report` (report gửi nguyên văn) + `nudge` gửi OA khi còn OA + vòng poll bridge zca-js | — |
| FR-150 | UF-05, UF-09, UF-10, UF-13 | — | enum `property_type.chua_ro` + `required_facts(chua_ro, loai_bds)` + view `listing_missing_facts` coalesce; `listings_try_publish()` (nay là vỏ tương thích) + trigger `trg_listings_autopublish` *[gỡ 28/08/2026, thay bởi `trg_zz_listings_dang_tin` — FR-164d]*; `trg_listings_price_vnd` thêm UPDATE OF price_raw; `seller_drip_tick`/`trg_listing_drip` theo trạng thái FR-139; `guess_property_type()` + trigger `trg_listings_fill_property_type` + backfill 164/173, `guess_property_type_answer()` cho nhánh fact `loai_bds` (không đọc ra loại thì hỏi lại, không ghi fact); `escalation-feed` action `ack` ghi ngược zalo_user_id | — |
| FR-151 *[cổng mở rộng 29/08 — FR-167b: HAI → TÁM function]* | UF-04 | — | (a) bảng `bot_usage` + RPC `bump_model_quota(p_limit)` gọi ngay đầu `chat-reply`, vượt trần trả 429 và im; secret `DAILY_MODEL_CALL_CAP` (Vault), mặc định 1000/ngày. (b) secret `BRIDGE_SECRET` (Vault) → `chat-reply` + `escalation-feed` đòi header `x-bridge-secret`, trừ request mang service_role key (`zalo-webhook`); bridge đọc secret từ `bot/bridge-zca/.env`. SRS-3.12 | — |
| FR-152 | UF-09 | — | bảng `bot_errors` + `bot_health` (RLS, admin đăng nhập đọc được); RPC `beat(who)` gọi từ `escalation-feed`; `bot_health_tick()` quét `net._http_response` → `bot_errors` → `reminders` kind `escalation` (gộp 1 tin/giờ); cron `bot-health-tick` `*/15 * * * *`; RPC `log_loi(source, detail, code)` (van 20/nguồn/giờ + 200/giờ) + helper `ghiLoi()` trong `_shared/claude.ts` và trong `bridge-zca`; `escalation-feed` action `log`; web `instrumentation.ts` `onRequestError` + `app/error.tsx`; khối "Sức khoẻ bot" trên `/admin` | — |
| FR-153 | UF-05, UF-09 | — | trigger `trg_listing_facts_sync_cols` + hàm `listing_facts_sync_cols()` (AFTER INSERT `listing_facts` → `listings.bedrooms/area_m2/floor/direction`, và từ FR-164 thêm `price_raw`/`ward`/`property_type`); migration `20260827e_listing_facts_sync_cols.sql`, `20260828a`, `20260828b`, `20260828d`. *[cập nhật 28/08/2026 — "chỉ ghi khi cột trống" đã bỏ: fact mới nhất thắng (FR-163a), ghi đè lọc theo `bac_nguon()` (FR-164a)]*. Không đụng `description` | TS-SPECS-01…04 |
| FR-154 | UF-04, UF-05 | WF-03, WF-05 | hàm `parse_vnd(text)` v2 (tỏi/củ/rưỡi/5t5/6ty2/4ty) + trigger sẵn có `trg_listings_price_vnd`; migration `20260827f_parse_vnd_slang.sql`; từ điển lóng `SLANG_NOTES` (`_shared/prompts.ts`) và bản đè `bot_prompts.slang_notes` | TS-GIA-01…05 |
| FR-155 | UF-09, UF-10 | — | hàm `seller_rank()` + view `seller_ranks` (chỉ tên/số đếm/hạng) + `agents_public` thêm `rank`, `closed_count`; `app/moi-gioi/page.tsx` huy hiệu + chú thích; migration `20260827g_seller_rank_admin_dang_tin.sql` | TS-HANG-01…03 |
| FR-156 | UF-09, UF-13 | — | RPC `admin_dang_tin(jsonb)` (security definer, kiểm bảng `admins`, sinh mã `BDS-Q5-####` có `lock table`, gộp người bán trùng zalo/SĐT); `app/admin/dang-tin/page.tsx`; nút vào từ `/admin`; migration `20260827g_seller_rank_admin_dang_tin.sql` | TS-DANGTIN-01…05 |
| FR-157 | UF-05, UF-09, UF-10 | — | cột `sellers.active_listing_id` + trigger `trg_info_request_set_active_listing`; `chat-reply` v33: chọn pending theo mã-trong-tin → neo → mới nhất, cổng `hoiMua` rẽ vai, prompt drip vắt vai mã căn; migration `20260827h_seller_active_listing.sql` | TS-NEO-01…04 |
| FR-158 | UF-05, UF-09 | — | cổng `wantsSell` nới trong `chat-reply` (ý định rao theo thứ tự từ + chặn câu hỏi tình trạng) + `code: null` khi tạo tin rao; hàm DB `next_listing_code()` + trigger `trg_listings_fill_code`; `admin_dang_tin` bỏ bộ sinh mã chép tay, đọc mã bằng RETURNING; migration `20260827k_ma_tin_dung_chung.sql` | TS-MA-01…05 |
| FR-159 | UF-04, UF-05, UF-10 | WF-05 | *[dựng 01/09/2026: migration `20260901d_mo_ho_so_nguoi_ban.sql` (RPC idempotent, chỉ service_role); `chat-reply` nửa 1/2 `tuNhanCoBDS` + `sellerMoi` trước nhánh bán, nửa 2/2 câu hỏi vai + cờ `preferences.hoi_vai` sau khi ghi tin khách; `wantsSell` dời lên trước nhánh bán. Kiểm TS-VAI-01…05. 02/09: migration `20260902a_gan_nhan_nguoi_ban_luc_boc_tach.sql` — chữ ký `(zalo, nhãn default ccrb)`, chỉ nâng `unknown`; `chat-reply` thêm `tinHieuMoiGioi` → `nhanNguoiBan`, và gán nhãn cho hồ sơ tạo tay còn `unknown` khi họ tự nhận/tự xưng (`canGanNhan`). Kiểm TS-VAI-06…11. SRS-3.4, SRS-3.12]* | — |
| FR-160 | UF-09 | — | *chưa dựng* — chờ OPEN-28 chốt phí trước khi suy `seller_type` từ số tin | — |
| FR-161 | UF-04, UF-05, UF-09 | — | `boDau()`/`CO_DAU_RE` + mọi cổng hai chế độ trong `chat-reply` (hoiMua, wantsSell, PROMISE_RE_KD, ward/price, regexProfileFallback, mapDue, budgetRangeVnd); SQL `bo_dau()` + `guess_property_type(_answer)` hai chế độ; migration `20260827l_bo_dau_guess_property.sql` | TS-KD-01…05 |
| FR-162 | UF-04, UF-05 | — | bảng `inbound_ledger` + RPC `claim_inbound` (migration `20260827m_so_inbound_idempotency.sql`); bảng `inbound_events` + RPC `ghi_su_kien_inbound` + cột `messages.seq` (unique) + `claim_inbound` trả `r_sent_at` (migration `20260827n_su_kien_inbound_va_thu_tu.sql`); `chat-reply` (claim trước quota, helper `hoanTat`/`baoHong` ở mọi đường ra, 23505 đi tiếp khi `attempts > 1`, cờ `already_sent`, nhường-lượt so `seq`); `zalo-webhook` (ghi sự kiện trước ack, retry gửi + ghi `sent_at`/`send_error`, im khi replay đã `already_sent`); `bridge-zca/index.mjs` (poll khi `in_flight`) | TS-IDEM-01…10, TS-IDEM2-A…I |
| FR-163 | UF-04, UF-05, UF-06 | — | migration `20260828a_toan_ven_du_lieu.sql`: `listing_facts_sync_cols` (fact mới nhất thắng), `listings.property_type_source`, `listings_set_price_vnd` bắn mọi update, `deals_listing_buyer_key` (nulls not distinct) + `trg_deals_chan_xoa`, `viewings_can_neo_check`/`viewings_status_check`, `conversations_mot_vai_check` + `conversations_buyer_uniq`/`seller_uniq`, `trg_reminders_trang_thai`, `trg_inbound_ledger_trang_thai`, `merge_buyer_prefs`, `messages_conv_seq_idx`; `chat-reply` v39 (một dòng: prefs merge qua RPC); `admin_dang_tin` ghi `property_type_source='admin'` | TS-TOANVEN-01…09 (15 ca) |
| FR-164 | UF-05, UF-09, UF-10, UF-13 | — | migration `20260828b_duong_ong_du_lieu_tin.sql`: `bac_nguon()`, `listings.price_source`/`ward_source`, `chuan_hoa_phuong()`, `listing_du_dang_tin()` + trigger `trg_zz_listings_dang_tin` (gỡ `trg_listings_autopublish` và `trg_listing_facts_touch_status`), `ghi_fact_listing()`, `listing_facts_sync_cols` mở rộng (gia/phuong/tang/huong/tim-tường chung_cu), `chuan_hoa_lai_gia()`, `admin_dang_tin` đặt nhãn nguồn; `20260828c_cat_phu_dinh_loai_bds.sql`: `cat_truoc_phu_dinh()` + `guess_property_type_answer()`; `20260828d_gia_raw_khong_dinh_tieu_tu.sql`: `chuan_hoa_gia_raw()`; `20260828e_ghim_search_path_va_don_bang_test.sql`: ghim `search_path` ba hàm mới + dọn bảng test; `20260828f_chuan_hoa_o_tang_cot.sql`: trigger `trg_listings_chuan_hoa_cot` chuẩn hoá `price_raw`/`ward` tại cột cho MỌI cửa ghi; `chat-reply` v42 (dò lời sửa fact, ghi qua `ghi_fact_listing`, bỏ hai lệnh UPDATE cột) | TS-OUNG-01…12 |
| FR-165 | UF-01, UF-03, UF-10, UF-13 | WF-02, WF-03 | migration `20260828g_kho_anh_theo_uuid.sql`: bucket `listing-public`/`listing-private`, bảng `listing_media` (+ CHECK đường dẫn theo UUID, CHECK giấy tờ phải bucket riêng, unique một-bìa-mỗi-tin), `listing_media_chon_bia` + trigger `trg_listing_media_bia`, `app_config` + `cau_hinh()`, `listing_photos_v` dựng lại trên `listing_media`, `media_cleanup_queue` + `nhan_viec_don_media` + trigger `trg_listing_media_don_file`, view `media_mo_coi_storage`/`media_mo_coi_db`; `20260828h_cron_don_media.sql`: `media_cleanup_tick` + cron `media-cleanup-tick`; edge function `media-cleanup` v2; `lib/photos.ts` (xếp theo sort_order, bìa theo `is_cover`); `scripts/up-anh.mjs` (up vào `listing-public` theo UUID + ghi dòng `listing_media`) | TS-KHO-01…25 |
| FR-166 | UF-04, UF-05, UF-06, UF-08 | — | migration `20260829a_job_nen_tin_cay.sql`: `lan_thu_ke()`, `inbound_ledger` + `next_retry_at`/`locked_by`/`started_at`/`finished_at`/`sent_bubbles` + trạng thái `dead`, `claim_inbound(text,int,text)` (lùi dần + thư chết, thêm `r_dead`), `bao_hong_inbound()`, `viec_inbound_bo_roi()`, `reminders` + `locked_at`/`locked_by`/`attempts`/`next_retry_at`/`last_error` + `dead`, `nhan_viec_nhac()`, `bao_hong_nhac()`, `media_cleanup_queue` + `next_retry_at` + `chet` + `chon_viec_don_chet()`, view `job_suc_khoe`, mở rộng guard `inbound_ledger_giu_completed()` / `reminders_giu_trang_thai_ket()` và `nhan_viec_don_media()`; `20260829c_nha_viec_nhac.sql`: `nha_viec_nhac()`; `20260829b_cron_duong_cuu.sql`: unique index `reminders_mot_reengage_cho_idx`, `inbound_sweep_tick()` + cron `inbound-sweep-tick` (1 phút), cron `media-chet-tick` (1 giờ); edge function `inbound-sweep` v1; `zalo-webhook` v10 (cửa `replay_event_id` + gửi tiếp từ `sent_bubbles`); `nudge` v16 (giành việc qua `nhan_viec_nhac`, reengage chèn trước khi gọi model, mọi lượt gọi model bọc try/catch → `bao_hong_nhac`) | TS-JOB-01…30 |
| FR-167 | UF-01, UF-03, UF-04, UF-05 | WF-02, WF-03 | migration `20260829d_soat_bao_mat.sql`: policy `listing_media_doc_cong_khai` thêm điều kiện tin đã lên kệ, `listing_photos_v` dựng lại có cùng điều kiện trong THÂN view, revoke execute `next_listing_code()`/`listings_fill_code()`/`info_request_set_active_listing()`, revoke ghi trên `seller_ranks` + `bot_prompts`, ghim `search_path` cho `bo_dau`/`seller_rank`/`parse_vnd`/`guess_property_type`, `nudge_tick`/`ctv_report_tick` mang `x-bridge-secret`; cổng `x-bridge-secret` thêm vào `nudge` v17, `ask-seller` v7, `ctv-report` v7, `geocode-listings` v3; `zalo-webhook` v11 ghi cảnh báo khi bỏ qua verify chữ ký (OPEN-33); `20260829e_va_drip_qua_cong.sql`: `ask_seller_drip()` mang `x-bridge-secret` + bỏ anon JWT nhúng cứng (vá hồi quy do chính FR-167 gây ra) | TS-SEC2-01…66 |
| FR-168 | UF-04, UF-05 | — | migration `20260901a_chuong_het_tien_api.sql`: trigger `trg_bot_errors_het_tien` + hàm `bat_het_tien_api()` soi mỗi dòng ghi vào `bot_errors`, khớp dấu hiệu hết tiền/hết hạn mức (`credit balance`, `plans & billing`, `insufficient quota`, `billing`, mã 402) thì dựng một dòng cảnh báo nguồn `HET TIEN API`, ghi THẲNG không qua `log_loi` (van chống ngập sổ không được nuốt chuông báo sập hệ thống), tự hãm nhịp 6 giờ, không tạo escalation vì đường đó đi qua cầu nối đang chết. Hiện ở `/admin`. Vá `20260901c_chuong_keu_nham_khi_thieu_ma_http.sql`: bọc `coalesce(new.status_code, 0)` — thiếu nó thì cột rỗng biến cả mệnh đề lọc thành NULL và chuông kêu trên MỌI lỗi. Kiểm TS-CHUONG-01…07. SRS-3.12 | — |
| FR-169 | UF-04, UF-05 | — | migration `20260901b_dem_chu_theo_ngay.sql`: 4 cột `in_tokens`/`out_tokens`/`cache_write_tokens`/`cache_read_tokens` trên `bot_usage` + RPC `cong_token()` + grant SELECT cho `authenticated` và policy `bot_usage_admin_read` (khuôn `bot_errors_admin_read`); `_shared/claude.ts` thêm `doTien()` nối ở CẢ BỐN chỗ gọi model của `chat-reply`; `chat-reply` đổi nhớ tạm sang `ttl: "1h"` và dời khối dự án nhà mình sang nửa được nhớ tạm; `/admin` thêm thẻ "Tiền bộ não · 7 ngày" (trung bình một lượt + tỷ lệ đọc lại, giá là hằng số trong trang chứ không lưu trong DB). Kiểm TS-TIEN-01…07. SRS-3.12 | — |
| FR-170 | UF-04, UF-05, UF-06, UF-10 | WF-05, WF-06, WF-07 | `chat-reply`: `hoiMua` siết (a); `budgetRangeVnd` + `regexProfileFallback` viết lại (b); truy vấn `askedListings` lọc `status in (dang_ban, dang_quan_tam, da_chot, an)` + `askedBlock`/`photosOf` cắt chi tiết tin `an` + cửa ảnh theo mã lọc `listings.status` (c); `viewing.listing_code` chuẩn hoá HOA trước tra/so/ghi (d); `ghiAnhKem()` ghi fact `hinh_anh` cho ảnh kèm chữ ở nhánh bán, kể cả câu rao mới (e). `fee_pct` chỉ nhận `ccrb`→1.0 / `nmg`→0.5, còn lại null (f). 02/09 tự kiểm qua handler thật: `wardNo` hiểu "P4" + hoist trước nhánh bán (g); `areaM`/`pnM` → `ghi_fact_listing` sau khi tạo tin, `DUOI_GIA` dừng trước số+m2 (h); `raoMoiKhiDangHoi` đứng trước khối câu-hỏi-treo, select `listings.ward` (i); cờ `hoi_vai` giữ `"nmg"`, `tuNhanCoBDS` nhận câu cụt khi đang trả lời hỏi vai (j). Bộ kiểm `bot/tests/e2e/` (TS-E2E). Test `bot/tests/fr159-bon-vai.mjs`. SRS-3.3 (hồ sơ khách — b), SRS-3.14 (`parse_vnd`, `listing_facts` — b, c, e), SRS-3.8 (`listings.status` — c), SRS-3.7 (`viewings` — d) | — |
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

## 8.6 NFR → hiện thực → cách nghiệm thu

Trước 27/08/2026 ma trận không theo dõi NFR ở đâu cả — NFR chỉ nằm rải trong
`02` và `07 §6`. Soát mã nguồn 27/08 phát hiện thiếu, bổ sung mục này cho các
NFR **đã có hiện thực trong code** (những NFR còn là mục tiêu thì vẫn ở `07 §6`).

| NFR | Hiện thực ở | Nghiệm thu |
|---|---|---|
| NFR-04 (tin nhắn không được mất khi một bên offline) | **Đã dựng 29/08 (FR-166)**: sự kiện bền `inbound_events` + job `inbound_ledger` (vòng đời có `dead`) + đường cứu `viec_inbound_bo_roi()` → edge function `inbound-sweep` (cron 1 phút) + luật lùi dần `lan_thu_ke()`. Trước đó `inbound_events` được ghi mà KHÔNG ai đọc, nên instance chết là mất tin. Đường nhanh inline vẫn giữ để không phạm FR-131 | TS-JOB-01…30 |
| NFR-06 (giấy tờ không lộ) | **Nửa đã dựng**: bucket `listing-private` (không công khai) + CHECK bắt `so_do`/`giay_to` phải nằm ở đó + RLS lọc dòng riêng tư khỏi anon (FR-165, **siết lại ở FR-167c** sau khi đo thấy media và view của tin CHƯA ĐĂNG vẫn lọt qua anon). Đo được: route `/object/public` của bucket riêng trả `NoSuchBucket`. **Nửa CHƯA dựng**: đường ký signed URL ≤15 phút — quét repo không có `createSignedUrl`, chưa chỗ nào đọc `listing-private`. Và ảnh gửi qua chat vẫn nằm ngoài ranh giới này (OPEN-32) | TS-KHO-04, TS-KHO-17, TS-KHO-19, TS-KHO-20, TS-KHO-25 |
| NFR-16 (free-tier trước) | Supabase Free + Vercel Hobby; quyết định giữ nguyên 27/08 (OPEN-25) | Ràng buộc kèm theo: chạy `scripts/sao-luu.mjs` định kỳ vì Free KHÔNG có backup tự động |
| NFR-17 (trang tin phải trong cache) | `generateStaticParams()` ở `app/nha-dat/[code]/page.tsx`; `unstable_cache` bọc truy vấn trong `components/ListingBrowse.tsx` và `lib/photos.ts`; SRS-3.13 | TS-CACHE-01…05 |
| NFR-18 (xanh phải là xanh thật) | `bot_health_tick()` quét `net._http_response` → `bot_errors`; `log_loi()` + `ghiLoi()` cho lỗi trả-200; SRS-3.12 | TS-HEALTH-01…06, TS-LOG-01…06 |

---

## 8.5 FR chưa có đặc tả kỹ thuật đầy đủ

| FR | Thiếu gì | Theo dõi ở |
|---|---|---|
| FR-99 (định giá so sánh) | Thuật toán, nguồn dữ liệu giá thị trường | `OPEN-10` |
| FR-102 (chấm điểm NMG) | Ngưỡng cảnh báo khi NMG dưới chuẩn (OPEN-12). Phần trùng lặp đã xử lý: `rate-ctv` + `ratings` xoá 27/08/2026 | `OPEN-12` |
| FR-28 (tiện ích quanh BĐS) | Nguồn dữ liệu POI (Google Places? tự nhập?) | `OPEN-13` |
| FR-16 (fingerprint) | Thư viện, chính sách lưu trữ, cơ chế từ chối | `OPEN-14` |
| FR-118 (`ward_mapping`) | Nguồn dữ liệu máy-đọc-được danh mục phường cũ↔mới (NQ 202/2025/QH15), schema bảng trong SRS | — |
