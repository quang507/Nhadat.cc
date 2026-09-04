# 10 — Kế hoạch kiểm thử

Trả lời câu hỏi "đã có kế hoạch kiểm thử chưa": trước file này mới có **nền** —
13 kịch bản nghiệm thu (AC-01…AC-13, `docs/07 §7`) và bảng kiểm chứng NFR
(`docs/07 §6`). File này nâng thành kế hoạch đầy đủ 4 tầng. Nguyên tắc: công cụ
**free-tier trước** (NFR-16); test case truy được về FR/AC/NFR.

## 10.1 Kiểm thử chức năng (Functional Testing)

Đơn vị tổ chức: **test suite theo nhóm FR**. Dữ liệu mẫu lấy từ 24 kịch bản chat
trong `chats w B.docx` (đã ẩn danh) — đây là bộ dữ liệu vàng, không bịa thêm.

| Suite | Phạm vi | Trọng tâm |
|---|---|---|
| TS-WEB | FR-01…17 | Search NLU parse đúng taxonomy §4.6 · trang tag không bao giờ 404 · cue #ID hiện đủ · deep-link Zalo mang ngữ cảnh (AC-01) |
| TS-BOT | FR-20…32 | 4 bất biến I1–I4 (SRS-5.1) là test chặn release: ≤3 listing/tin · tin chủ động kết thúc bằng câu hỏi · không khẳng định điều chưa xác minh · không hỏi số ĐT sai chỗ |
| TS-ASK | FR-40…47, FR-110 | Kho tích luỹ trả trước, hỏi S sau · idempotency theo request_id · timeout 24h/48h · FR-44 cập nhật listing (AC-03) |
| TS-VIEW | FR-50…57 | Từ chối cho số ĐT vẫn đặt được lịch (AC-04) · email [VIEWING] |
| TS-RET | FR-60…65 | Mốc 3 ngày / 5–6 ngày · nội dung xoay vòng không lặp (AC-06) |
| TS-ADM | FR-70…81 | 20 mục/trang · 4 loại email đúng subject/body (AC-09, AC-10) |
| TS-SEL | FR-90…103, FR-109 | Bóc tách ≥4 trường (AC-07) · rao từng bước trong Zalo · không spam S |
| TS-BROKER | FR-104…112 | Ẩn danh hai chiều: lọc SĐT/Zalo ID/địa chỉ trong relay · vòng đời listing · sold → báo interests |
| TS-PROJECT | FR-113…117 | AC-13: căn 50 theo unit_status · câu tầng dự án không sinh info_request · unique (project_id, unit_code) |

Phương pháp: mỗi AC ≥1 test E2E; NLU (FR-09/22/23/92) dùng **bảng quyết định**
câu vào → trường ra, chạy lại được khi đổi model AI (regression bắt buộc trước
khi đổi model/prompt).

## 10.2 Kiểm thử kỹ thuật (Technical / Integration)

| Mục | Kiểm gì | Tham chiếu |
|---|---|---|
| API contract | SRS-4.1…4.7: schema request/response, idempotency (request_id trùng → trả kết quả cũ, không nhân đôi), mã lỗi 404/409 | FR-41, FR-43 |
| Database | RLS: anon chỉ đọc listing active + media public *(và từ FR-167c: media còn phải thuộc TIN ĐÃ LÊN KỆ)*; unique (project_id, unit_code); enum unit_status/status không nhận giá trị lạ; last_confirmed_at cập nhật đúng | SRS-3.9, FR-107, FR-113 |
| Webhook Zalo | Trả 200 < 1s; xử lý bất đồng bộ; chữ ký sai → từ chối *[29/08/2026 — vế chữ ký CHƯA hiệu lực: thiếu ZALO_APP_SECRET/ZALO_APP_ID nên khối verify bị nhảy qua, xem OPEN-33]*; retry không tạo tin nhắn đôi | SRS-4.4, OPEN-33 |
| Hàng đợi | Chaos test: tắt worker 10 phút → 0 tin mất sau khôi phục *[29/08/2026 — đã có bộ kiểm thật: TS-JOB, dựng cảnh sập bằng tay vì không giết được instance Edge Function theo ý muốn]* | NFR-04, OPEN-11, FR-166 |
| Kho file | Ảnh sổ đỏ: signed URL hết hạn ≤15 phút, truy cập thẳng bucket bị chặn; adapter đổi backend không đụng logic bot | NFR-06, FR-111 |
| Migration | Mỗi migration chạy được trên project trống + project có dữ liệu mẫu; không phá dữ liệu cũ | — |

## 10.3 Kiểm thử giao diện & trải nghiệm (UI/UX)

1. **Đối chiếu thiết kế**: từng màn so với canvas/Figma (page 02) — bố cục, token
   màu (`design/tokens.json`), font. Sai token = lỗi, không phải "gần đúng".
2. **Responsive**: 375 / 768 / 1440px; bảng rộng cuộn trong container, body không
   cuộn ngang; sticky CTA Zalo trên mobile.
3. **Tone giọng chat**: checklist 7 quy tắc + mục Cấm (`docs/06 §6.8`) chạy trên
   log 50 hội thoại thử — đây là kiểm thử UX, không phải cảm tính: đếm được
   (số câu hỏi/lượt, tin kết thúc bằng "?", từ cấm "Vui lòng/Hệ thống").
4. **Accessibility**: tương phản ≥4.5:1, vùng chạm ≥44px, focus ring, alt ảnh —
   axe-core tự động + duyệt tay màn chính (persona P3, 61 tuổi).
5. **Trạng thái**: ma trận loading/rỗng/lỗi/đặc biệt cuối `docs/05` — mỗi ô một
   test; "0 kết quả" phải nói rõ đã nới tiêu chí gì.
6. **Hiệu năng cảm nhận**: Lighthouse mobile ≥ 90, LCP < 2.5s/4G (NFR-02).

## 10.4 Kiểm thử phi chức năng (Non-functional)

Bảng NFR-01…18 với cách đo đã nằm ở `docs/07 §6` — giữ đó làm nguồn sự thật.
Bổ sung các bài chuyên sâu:

| Bài | Nội dung |
|---|---|
| Tải | 50 tin nhắn đồng thời p95 <3s (NFR-01); seed 5.000 listing + 300 hội thoại không suy giảm (NFR-05) |
| Bảo mật | Pen-test 3 hướng: (1) prompt-injection qua chat dụ bot lộ SĐT/địa chỉ chủ nhà — phá ẩn danh FR-104; (2) đoán/duyệt URL /ds/token và signed URL; (3) RLS bypass qua PostgREST filter |
| Riêng tư | Rà log 100 hội thoại: 0 lần hỏi số ĐT ngoài viewing (NFR-07); dữ liệu B không rời hệ thống |
| SEO | 100 URL tag index trong Search Console, 0 lỗi structured data (NFR-09) |
| Chi phí | Sau mỗi tuần chạy thử: đối chiếu usage Supabase/Vercel/AI với ngưỡng free (NFR-16) — vượt dự báo là finding |

## 10.5 Môi trường & công cụ (free-tier)

- **Unit/integration**: Vitest · **E2E**: Playwright (Chromium có sẵn trong môi
  trường CI) · **A11y**: axe-core · **Perf**: Lighthouse CI.
- **CI**: GitHub Actions free (2.000 phút/tháng) — chạy lint + unit mỗi PR, E2E
  nightly; Vercel preview mỗi PR (đã hoạt động trên PR #1).
- **DB test**: org Supabase free đã đủ 2 project — `nhadat-cc` là môi trường
  chính, **không** chạy test phá hoại lên nó; test DB dùng Postgres chạy trong CI
  (docker) áp cùng bộ migration.
- **Zalo**: OA thật ở chế độ ẩn + tài khoản Zalo test của CTV; chưa có sandbox
  chính thức → ghi nhận hạn chế ở OPEN-09.
- **Bí mật**: khóa API chỉ nằm trong biến môi trường (Vercel env / GitHub
  Secrets / `.env.local`) — tuyệt đối không commit; khóa đã dán vào chat phải
  **rotate** sau khi hệ thống chạy ổn định.

## 10.6 Lịch chạy theo giai đoạn phát hành (SRS §8)

| Phase | Suite bắt buộc xanh để thoát phase |
|---|---|
| P0 Nền | TS-SEL (rao tin), Migration, Database, Bí mật |
| P1 Nguồn hàng | TS-WEB, UI/UX 1–2–5, SEO, Lighthouse |
| P2 Chat | TS-BOT (I1–I4 chặn), TS-ASK, TS-PROJECT, Webhook, Tone giọng |
| P3 Giao dịch | TS-VIEW, TS-ADM, TS-BROKER, Pen-test ẩn danh |
| P4 Giữ chân | TS-RET, Tải, Riêng tư, Chi phí |

Quy tắc: bug tìm thấy sau release phải có test tái hiện trước khi sửa —
suite chỉ phình ra, không teo lại.

## 10.7 Bộ test chạy tay — bản chạy được ngay (cập nhật 29/08/2026)

Các suite dưới đây là **lệnh dán vào chạy được**, không phải mô tả. Sinh ra từ
đợt soát bảo mật 26/08 và đợt bật bridge acc clone. ID cấp mới, bất biến.

### TS-SEC — hồi quy bảo mật (chạy sau MỌI migration đụng RLS/GRANT)

Chạy bằng SQL Editor của Supabase. Nguyên tắc: **đóng vai `anon` rồi thử phá** —
anon key là key công khai (nằm trong bundle web và trong `bot/bridge-zca`), nên
nó là đúng góc nhìn của kẻ tấn công. Repo để private **không** làm key này bí mật.

| ID | Bài | Kết quả PHẢI ra |
|---|---|---|
| TS-SEC-01 | `set role anon; select count(*) from reminders;` | `0` — hàng đợi nhắc việc chứa trích đoạn tin khách |
| TS-SEC-02 | `set role anon; delete from reminders;` | lỗi quyền |
| TS-SEC-03 | `set role anon; select count(*) from public_listings;` | lỗi quyền — view này không lọc trạng thái, để hở là lộ tin nháp |
| TS-SEC-04 | `set role anon; select public.seller_drip_tick();` và `ctv_report_tick()` | lỗi quyền — chạy được nghĩa là người lạ ép bot nhắn tin hàng loạt / spam Zalo admin |
| TS-SEC-05 | `set role anon; insert into listings…` · `update bot_prompts…` | lỗi quyền cả hai |
| TS-SEC-06 | `set role anon; select count(*) from sellers/ctvs/messages/conversations/viewings/deals;` | `0` hết |
| TS-SEC-07 | `set role anon; select count(*) from listings;` | bằng số tin `dang_ban + dang_quan_tam + da_chot`, **nhỏ hơn** tổng tin — tin `cho_thong_tin` phải khuất |
| TS-SEC-08 | `set role anon;` đọc `listings`, `agents_public`, `listing_photos_v`, `projects`, `listing_facts` | ra dữ liệu bình thường — đây là 5 đường web thật sự cần, chặn nhầm là hỏng site |
| TS-SEC-09 | `select proname, proacl from pg_proc … where proname='get_secret'` | ACL chỉ có `postgres` và `service_role` — Vault (ANTHROPIC_API_KEY) không bao giờ chạm tới anon |
| TS-SEC-10 | Mở trang `/nha-dat/<mã>` của tin có fact chứa SĐT | SĐT hiện thành `[liên hệ qua Zalo nhadat.cc]` (FR-104) — cả `description` lẫn `answer` của fact |

Bộ script đóng vai anon: `bot/supabase/migrations/20260826c_soat_bao_mat.sql`
(phần cuối, khối `-- KIỂM CHỨNG`).

### TS-LIVE — thông tuyến thật qua Zalo (chạy khi bật bridge)

Điều kiện: `node bot/bridge-zca/index.mjs` chạy, **không** còn dòng
`pumpEscalations: fetch failed`.

| ID | Làm gì | Kết quả PHẢI ra |
|---|---|---|
| TS-LIVE-01 | Trong cmd: `curl` POST tới `/functions/v1/escalation-feed` với anon key | HTTP 200. Không ra 200 thì mọi bài dưới vô nghĩa — sửa mạng/Node trước |
| TS-LIVE-02 | Từ acc Zalo khác nhắn acc clone: `chào em, anh tìm nhà quận 5 tầm 5 tỷ` | Bot trả trong ~vài giây, hỏi/gợi ý căn khớp ngân sách, **không** xổ listing ngẫu nhiên |
| TS-LIVE-03 | `căn BDS-Q5-0133 còn không em` | Chào đúng căn đó (Phường 16 · 4,8 tỷ · 57.4m²), không bịa tình trạng |
| TS-LIVE-04 | `gửi anh xem hình căn đó với` | Căn chưa có ảnh → nói "để em hỏi lại chủ nhà", tuyệt đối không bịa là có hình |
| TS-LIVE-05 | `cho anh gặp người thật đi` | `conversations.needs_human = true` + sinh 1 dòng `reminders` kind `escalation` gán CTV |
| TS-LIVE-06 | Điền `phone` cho CTV trong bảng `ctvs`, chờ ≤60s | Bridge resolve SĐT → uid, nhắn CTV, rồi ghi ngược `ctvs.zalo_user_id` (FR-150 ack) |
| TS-LIVE-07 | Gán `sellers.zalo_user_id` = uid acc test, nhắn: `Bán nhà hẻm xe hơi phường 8, DT đất 4x16, 1 trệt 2 lầu, giá 8.5 tỷ` | Tạo tin `cho_thong_tin`; `property_type = nha_pho` (KHÔNG phải `dat`); `price_raw = "8.5 tỷ"`; câu hỏi đầu là diện tích đất, **không hỏi loại BĐS** |
| TS-LIVE-08 | Trả lời câu hỏi diện tích | Fact được lưu, đủ giá + diện tích + phường thì tin tự nhảy `dang_ban` và bot báo "đã lên web" |
| TS-LIVE-09 | Với tin không đoán được loại, trả lời `hông biết nữa` | Bot **hỏi lại kèm lựa chọn**, không ghi fact `loai_bds` — tin không được kẹt `chua_ro` vĩnh viễn |
| TS-LIVE-10 | Người thật gõ tay từ acc clone trả lời khách | Bot im 30 phút (FR-141), hạ cờ `needs_human`, huỷ escalation đang chờ |

Ghi nhận hạn chế: TS-LIVE chạy trên project thật (chưa có project staging) nên
sau mỗi vòng phải dọn dữ liệu test — xoá `listings` mã `CCRB-*` phát sinh,
`sellers`/`ctvs` test, và các dòng `reminders` liên quan.

### TS-RENT — hồi quy luồng CHO THUÊ (chạy sau MỌI lần sửa `chat-reply`)

Hai lỗi ở SRS-3.8a từng làm luồng thuê chết hẳn mà **không báo lỗi ra ngoài** —
bot vẫn trả lời tử tế, chỉ là không tin thuê nào được tạo và không căn thuê nào
được gợi ý. Không có bài test nào ở trên bắt được. Đây là bộ bắt:

| ID | Bước | Kỳ vọng |
|---|---|---|
| TS-RENT-01 | Nhắn từ acc đã gán `sellers.zalo_user_id`: `cho thuê nhà mặt tiền phường 11, 60m2, giá 25 triệu/tháng` | Tin được tạo (không im lặng bỏ qua); `deal = 'cho_thue'`; `property_type = 'nha_pho'`; `price_raw = "25 triệu/tháng"`; `price_vnd = 25000000` |
| TS-RENT-02 | Nhắn từ acc khách: `anh muốn thuê nhà quận 5 tầm 20 triệu` | `buyers.preferences.deal = "thue"`; bot gợi ý căn **cho thuê**, không xổ căn bán |
| TS-RENT-03 | SQL: `select count(*) from listings where deal='cho_thue' and status in ('dang_ban','dang_quan_tam')` | Ra số > 0 và trùng số căn bot gợi ý được (26/08: 11 tin) |
| TS-RENT-04 | Nhắn: `cho anh hỏi đóng thuế nhà đất ở đâu` | **Không** bị hiểu thành nhu cầu thuê — `preferences.deal` không đổi thành `thue` |
| TS-RENT-05 | Đọc log function sau TS-RENT-01 | Không có `invalid input value for enum listing_deal` |

Dọn sau khi chạy: xoá `listings` mã `CCRB-*` vừa sinh (SRS-3.8a sinh ra từ đúng
vòng test này ngày 26/08).

### TS-CHATREPLY — bộ kiểm sau MỌI lần deploy `chat-reply`

Bắt buộc khi deploy qua MCP, vì đường đó phải chép tay nguyên văn: rủi ro tỉ lệ
thuận với số dấu `\` trong file (mỗi cái phải nhân đôi khi đóng gói JSON), mà
chép sót một cái thì `\d` thành `d` — **vẫn biên dịch, vẫn chạy, chỉ là bóc
sai** và không cửa nào báo. Đếm 27/08: `escalation-feed` 0, `zalo-webhook` 0,
`ctv-report` 11, `chat-reply` **123**. Deploy bằng `npx supabase functions
deploy` thì không có rủi ro này, nhưng bộ test vẫn nên chạy.

Chạy bằng `net.http_post` kèm `x-bridge-secret` lấy thẳng từ Vault (giá trị
không ra khỏi Postgres). Kết quả lần chạy 27/08 trên v32:

| ID | Nhắn gì | Soi họ regex nào | Kỳ vọng |
|---|---|---|---|
| TS-CHATREPLY-01 | `anh co 5 tỏi rưỡi, tìm nhà quận 5 phường 9, coi giúp anh căn #BDS-Q5-0164` | `CODE_RE`, regex tiền, `budgetRangeVnd`, `wardNum` | Trả đúng căn được nhắc, lọc kho theo tầm giá đã bóc |
| TS-CHATREPLY-02 | `anh muốn thuê nhà quận 5 tầm 20 triệu một tháng` → lượt 2 `để ở, tìm luôn đi` | `dealCol()` + lọc kho `deal='cho_thue'` | Lượt 2 trả căn CHO THUÊ thật, không phải căn bán |
| TS-CHATREPLY-03 | `cho thuê nhà mặt tiền phường 11, 60m2, giá 25 triệu một tháng` (từ acc đã gán `sellers.zalo_user_id`) | `wantsSell`, `sDeal`, `wardM`, `priceM` | Tạo tin `deal=cho_thue`, đúng phường, `price_raw` không dính "trệt" |
| TS-CHATREPLY-04 | tin kèm `image_url` trỏ host không tồn tại | `ghiLoi()` trong catch (FR-152 d) | HTTP **200**, khách VẪN nhận câu trả lời (fallback regex), mà `bot_errors` có `source='chat-reply model'` |

Dọn sau khi chạy: trả `sellers.zalo_user_id` về NULL, xoá tin `CCRB-*` vừa sinh
(kèm `info_requests`/`listing_facts`/`reminders` của nó), xoá buyer/conversation
`ZZTEST-*`, xoá `bot_errors`, đẩy `bot_health.last_id` lên `max(id)` hiện tại.

### TS-CACHE — chứng minh trang tin thật sự nằm trong cache (NFR-17)

Bẫy đã cắn thật: `export const revalidate = 300` trong `app/nha-dat/[code]/page.tsx`
**không làm gì cả** suốt thời gian route đó chưa khai `generateStaticParams()`.
Không có lỗi, không có cảnh báo — chỉ là mỗi lượt xem một tin đi thẳng xuống
Supabase. Nhìn code không thấy; phải đo.

| ID | Bước | Kỳ vọng |
|---|---|---|
| TS-CACHE-01 | `bun run build`, đọc bảng route | `/nha-dat/[code]` là `●` (SSG), **không** phải `ƒ` |
| TS-CACHE-02 | `node -e "console.log(Object.keys(require('./.next/prerender-manifest.json').dynamicRoutes))"` | Có `/nha-dat/[code]` |
| TS-CACHE-03 | `bun run start`, `curl -D - http://127.0.0.1:3000/` | `x-nextjs-cache: HIT` + `Cache-Control: s-maxage=300` |
| TS-CACHE-04 | Trên bản đã deploy: mở một trang tin hai lần, xem header `x-vercel-cache` | Lần hai là `HIT` (hoặc `STALE`), không phải `MISS` liên tục |
| TS-CACHE-05 | `/mua-ban?gia=duoi-5` hai lần trong 5 phút, đếm query ở Supabase → Logs | Lần hai **không** sinh query `listings` mới (Data Cache của `layTin`) |

### TS-HEALTH — còi báo lỗi có kêu không (FR-152)

| ID | Bước | Kỳ vọng |
|---|---|---|
| TS-HEALTH-01 | `select net.http_post(url := '<project>/functions/v1/khong-he-ton-tai', ...)`, chờ 15s, rồi `select public.bot_health_tick()` | Trả `loi_moi = 1` |
| TS-HEALTH-02 | `select * from public.bot_errors order by id desc limit 1` | Một dòng `source='pg_net'`, `status_code=404` |
| TS-HEALTH-03 | `select note from reminders where note like '🩺%'` | Đúng MỘT tin, dù chạy `bot_health_tick()` nhiều lần trong cùng giờ |
| TS-HEALTH-04 | `select cron.job_run_details` cho chính lần chạy hỏng ở TS-HEALTH-01 | Vẫn ghi `succeeded` — đây chính là lý do FR-152 tồn tại, đừng tin cột này |
| TS-HEALTH-05 | Gọi `escalation-feed` kèm `x-bridge-secret` đúng | `bot_health` có dòng `who='bridge-zca'`, `at` = vừa xong |
| TS-HEALTH-06 | Xoá dòng `bridge-zca` khỏi `bot_health` rồi chạy `bot_health_tick()` | `bridge_im = false` — chưa từng có nhịp thì KHÔNG báo |
| TS-HEALTH-07 | *(04/09/2026, `20260904a`)* Bridge im > 15 phút trong 7–22h VN, chạy `bot_health_tick()` hai lần trong cùng giờ | Lần 1: trả `ntfy = <id>`, `net._http_response` của id đó 200 từ ntfy.sh, `bot_health` có `who='ntfy'`; lần 2: `ntfy = null` (1 tin/giờ). Push tới app ntfy đăng ký topic `app_config.ntfy_topic` — chạy thật 04/09: id 2102/2103 trả 200 ✅ |
| TS-HEALTH-08 | *(04/09/2026)* Có 117 🩺 + 8 báo cáo CTV `pending` từ 27/08 (bridge chết), chạy tick | 🩺 cũ → `cancelled`, chỉ còn 🩺 mới nhất; báo cáo CTV quá 36 giờ → `cancelled`; bridge bật lại chỉ nhận tin mới — chạy thật 04/09: huỷ 117 + 7, còn 1 ✅ |

Dọn sau khi chạy: `delete from bot_errors; delete from reminders where note like '🩺%';`
và đẩy `bot_health.last_id` của `pg_net` lên `max(id)` của `net._http_response`.

### TS-LOG — lỗi tầng ứng dụng có vào sổ không (FR-152 d)

Loại lỗi này TRẢ 200 nên TS-HEALTH ở trên không bắt được. Phải thử riêng.

| ID | Bước | Kỳ vọng |
|---|---|---|
| TS-LOG-01 | `do $$ begin for i in 1..25 loop perform log_loi('thu-van','x',null); end loop; end $$;` | Đúng **20** dòng — van theo nguồn cắt 5 lượt sau |
| TS-LOG-02 | Lặp 600 lượt với 30 giá trị `p_source` khác nhau, chạy bằng `set local role anon` | Tổng bảng dừng ở đúng **200** — van tổng chặn kẻ đổi nguồn để lách |
| TS-LOG-03 | Gọi `escalation-feed` `{"action":"log","source":"x","detail":"y"}` kèm `x-bridge-secret` | 200 `{"ok":true}`; `bot_errors` có dòng `source='bridge x'` |
| TS-LOG-04 | Nhắn một tin kèm `image_url` trỏ tới host không tồn tại (ĐỪNG phá `ANTHROPIC_API_KEY` — cách đó làm chết bot thật trong lúc thử) | HTTP vẫn **200**, khách vẫn nhận được câu trả lời (regex fallback), mà `bot_errors` có `source='chat-reply model'` kèm lỗi API. Đã chạy thật 27/08: `400 Unable to download the file` |
| TS-LOG-05 | Mở một route web ném lỗi có chủ ý trên bản deploy | `bot_errors` có `source='web app'` kèm đường dẫn; khách thấy `app/error.tsx` chứ không phải màn hình trắng |
| TS-LOG-06 | Chạy `bot_health_tick()` sau TS-LOG-04 | Có reminder `🩺` — còi đếm cả lỗi ứng dụng, không chỉ lỗi HTTP |

Dọn sau khi chạy: `delete from bot_errors; delete from reminders where note like '🩺%';`

**Cái test này KHÔNG phủ**: log thô của edge function (Supabase Free giữ 1 ngày).
`bot_errors` là bản trích những chỗ đã được nối dây, không phải bản đầy đủ. Chỗ
nào chưa gọi `ghiLoi()` thì vẫn im như cũ — thêm `catch` mới là phải nối dây mới.


---

### TS-GIA — bóc giá tiếng lóng ra số (FR-154)

Chạy thẳng trên SQL editor. Đây là **test hồi quy**: mỗi lần sửa `parse_vnd`
phải chạy lại đủ bộ, vì hai ca cuối là hai con bọ đã cắn thật.

```sql
select s, parse_vnd(s) from unnest(array[
  '5 tỏi rưỡi','5 tỏi','5 tỷ rưỡi','5,5 tỷ','5 tỷ 5','3 tỷ 200','800 triệu',
  '12 củ','15tr/th','900tr','1 trệt 2 lầu','5t5','2 tỉ 8','giá 6ty2 TL',
  '7 tỏi 3','nhà 4x15 giá 8 tỏi','25 củ/tháng','5 cây vàng','5 tỏi 500 triệu',
  'tỷ lệ chốt 5%','giá 5 tỷ 50m2','đất 100m2 giá 4ty','2 tý','thuê 8 củ rưỡi',
  '5 tỷ 120m2','1 tỷ 050'
]) s;
```

| Mã | Việc | Kỳ vọng |
|---|---|---|
| TS-GIA-01 | Bộ 26 ca ở trên | Khớp đủ 26. Đã chạy thật 27/08/2026: đúng hết |
| TS-GIA-02 | `'giá 5 tỷ 50m2'` | **5.000.000.000**, KHÔNG phải 5,5 tỷ. Regex từng lùi `{1,3}` từ "50" về "5" để né lookahead `m` rồi đọc phần lẻ sai |
| TS-GIA-03 | `'1 trệt 2 lầu'` | **NULL**. Chữ `tr` ở đây là "trệt". Postgres `\M` hiểu chữ có dấu nên chặn được — đừng bê logic này sang JavaScript, `\b` bên đó chỉ biết ASCII |
| TS-GIA-04 | `'5 cây vàng'`, `'2 tý'` | **NULL** cả hai. Vàng không tự quy ra tiền (tỷ giá đổi mỗi ngày); "tý" là "một tý", không phải tỷ |
| TS-GIA-05 | `select count(*) from listings where price_vnd is distinct from parse_vnd(price_raw)` | **0** — kho đang khớp với bộ bóc hiện hành. Khác 0 nghĩa là vừa sửa hàm mà chưa backfill |

### TS-SPECS — fact nhỏ giọt chảy vào cột (FR-153)

| Mã | Việc | Kỳ vọng |
|---|---|---|
| TS-SPECS-01 | Chọn một tin `bedrooms is null`, `insert into listing_facts(listing_id,question,answer,source) values (…, 'so_phong_ngu','3PN 2wc','thu')` | `listings.bedrooms = 3` |
| TS-SPECS-02 | Chèn tiếp `('so_phong_ngu','9 phòng')` cho chính tin đó | **9** — fact mới nhất thắng *[cập nhật 28/08/2026 — kỳ vọng cũ "vẫn 3, chỉ ghi khi cột trống" thuộc luật đã bỏ ở FR-163(a): nó làm mọi lời đính chính của chủ nhà rơi vào hư không. Nay chặn ghi đè là việc của bậc nguồn FR-164(a), không phải của cột-đang-trống]* |
| TS-SPECS-03 | `('huong','Đông Nam')` trên tin `direction is null` | `direction = 'Đông Nam'`. Chuỗi dài quá 40 ký tự thì BỎ QUA (người bán kể chuyện, không phải hướng) |
| TS-SPECS-04 | `('so_phong_ngu','ba phòng ngủ')` | `bedrooms` vẫn NULL — không có chữ số thì không đoán bừa |

Dọn sau khi chạy: xoá fact vừa chèn **và** trả cột về NULL (trigger không tự lùi).

### TS-HANG — hạng Đồng/Bạc/Vàng (FR-155)

| Mã | Việc | Kỳ vọng |
|---|---|---|
| TS-HANG-01 | `select * from seller_ranks` | Mỗi người bán đúng một dòng; NMG 17–22 tin đang rao, 0 căn chốt → **bac** (27/08/2026: 3/3 NMG đều Bạc) |
| TS-HANG-02 | `select * from seller_ranks` với vai `anon` | Chạy được, và **không có** cột `phone` / `zalo_user_id` (FR-104) |
| TS-HANG-03 | Đặt tay một tin sang `da_chot` cho một NMG có ≥10 tin rồi đọc lại | Nhảy **vang**. Nhớ trả lại trạng thái cũ sau khi thử |

**Cái test này KHÔNG phủ**: ngưỡng có ĐÚNG không — đó là OPEN-26, không phải lỗi mã.

### TS-DANGTIN — admin tự đăng tin (FR-156)

| Mã | Việc | Kỳ vọng |
|---|---|---|
| TS-DANGTIN-01 | Gọi `admin_dang_tin('{"price_raw":"1 tỷ"}')` khi **không** có JWT admin | Lỗi `42501` "Khong co quyen quan tri". Đã chạy thật 27/08: chặn đúng |
| TS-DANGTIN-02 | Đặt `request.jwt.claims` bằng email trong bảng `admins`, gọi với `price_raw = '5 tỏi rưỡi'` | Trả `code = BDS-Q5-####` nối tiếp dãy, `price_vnd = 5500000000` |
| TS-DANGTIN-03 | Cùng lệnh trên, **không** gửi `seller_phone`/`seller_zalo` | Người bán mới có `phone IS NULL` **và** `zalo_user_id IS NULL` |
| TS-DANGTIN-04 | Gọi lần hai với cùng `seller_zalo` (hoặc cùng `seller_phone`) | Dùng lại `seller_id` cũ, KHÔNG đẻ dòng `sellers` thứ hai |
| TS-DANGTIN-05 | Mở `/admin/dang-tin` bằng tài khoản không nằm trong `admins` | Thấy màn hình "Cần đăng nhập bằng tài khoản quản trị", không thấy form |

Dọn sau khi chạy: xoá tin `BDS-Q5-####` vừa tạo, các dòng `info_requests` trỏ
vào nó, và người bán thử nghiệm — rồi kiểm lại `listings` = 173, `sellers` = 3.

### TS-NEO — neo hội thoại người bán theo căn, và tách vai (FR-157)

Cần một người bán thử có `zalo_user_id` và **hai** tin cùng đang thiếu thông
tin. Gọi `chat-reply` qua `net.http_post` từ SQL editor (bí mật lấy bằng
`get_secret('BRIDGE_SECRET')` ngay trong `DO` block để không in ra màn hình).

| Mã | Việc | Kỳ vọng |
|---|---|---|
| TS-NEO-01 | Tạo câu hỏi pending cho căn A, rồi cho căn B (B mới hơn) | `sellers.active_listing_id` = **B**. Trigger neo chạy trên INSERT, không cần code |
| TS-NEO-02 | Người bán nhắn "căn BDS-Q5-9001 xây năm 2015 nha em" (9001 = căn **A**) | Fact `nam_xay` vào **A**, KHÔNG vào B. Trước FR-157 nó vào B vì B là câu mới nhất |
| TS-NEO-03 | Đọc câu bot hỏi tiếp | Phải **nhắc rõ mã căn + tên đường**. Đã chạy thật 27/08 trên v33: *"Cho em hỏi căn #BDS-Q5-9001 ở Trần Bình Trọng diện tích đất bao nhiêu m2 ạ?"* |
| TS-NEO-04 | Cùng Zalo ID đó nhắn "giờ anh muốn mua thêm một căn nữa ở quận 5 tầm 4 tỷ" | Rơi sang **nhánh buyer** (response có `conversation_id`, không có `role: seller`), và câu hỏi chờ của A/B vẫn `pending` |

Đã chạy thật 27/08/2026 trên `chat-reply` v33, cả 4 ca đúng. Kèm một ca nhánh
mua trên kho thật: *"anh tìm nhà quận 5 tầm 5 tỏi rưỡi, hẻm xe hơi"* → bot đọc
đúng "5 tỏi rưỡi" (FR-154), gợi ý căn có thật, 2 bong bóng, không markdown.

Dọn sau khi chạy: xoá `listing_facts`, `info_requests`, `reminders`, `listings`
của người bán thử, đặt `active_listing_id = null` rồi xoá `sellers`; xoá luôn
`messages`/`conversations`/`buyers` sinh ra ở TS-NEO-04. Kiểm lại: `listings`
= 173, `sellers` = 3, `buyers` = 2, `listing_facts` = 0.

**Cái test này KHÔNG phủ**: câu hỏi chờ bị bỏ lại khi người bán rẽ sang nhánh
mua thì bao lâu cron drip mới hỏi lại — phụ thuộc lịch `seller_drip_tick`,
chưa đo.

### TS-MA — câu rao sinh mã tin, và một dãy mã duy nhất (FR-158)

Cần một người bán thử có `zalo_user_id` và **không** có câu hỏi nào đang chờ
(có câu chờ thì tin nhắn bị coi là câu trả lời, không tới được cổng rao). Gọi
`chat-reply` qua `net.http_post` như TS-NEO.

| Mã | Việc | Kỳ vọng |
|---|---|---|
| TS-MA-01 | `insert into listings (code, ...) values (null, ...)` rồi `rollback` | Trigger `trg_listings_fill_code` điền mã nối tiếp dãy, không lỗi NOT NULL |
| TS-MA-02 | Người bán nhắn câu rao trần trụi: `anh muốn bán căn nhà` | **Sinh tin** `cho_thong_tin` + mã `BDS-Q5-####`; trước FR-158 câu này trượt cổng và không tạo gì |
| TS-MA-03 | Người bán nhắn `nhà mình bán chưa em` | **KHÔNG** sinh tin — có đủ "bán" + "nhà" nhưng là câu hỏi tình trạng, không phải câu rao |
| TS-MA-04 | Người bán nhắn `bán nhà hẻm xe hơi phường 8, 4x16, 8.5 tỷ` | Vẫn sinh tin như trước (đường có chi tiết không đổi); `price_raw = "8.5 tỷ"`, `ward = "Phường 8"` |
| TS-MA-05 | Hai lượt rao gửi đồng thời cùng một người bán | Hai mã khác nhau, **không deadlock** — advisory lock, không `lock table` |

Đã chạy thật 27/08/2026 trên `chat-reply` v35: TS-MA-01 cấp `BDS-Q5-0174`;
TS-MA-02 *"anh muốn bán căn nhà"* → tin `BDS-Q5-0174`, `property_type = nha_pho`
(trigger đoán từ chính câu rao, KHÔNG hỏi loại BĐS), câu đầu là `dien_tich_dat`,
bot trả *"Dạ em ghi nhận tin rao của anh rồi, mã #BDS-Q5-0174…"*; TS-MA-03
*"nhà mình bán chưa em"* → **0 tin**, bot trả đúng vai chăm sóc. `bot_errors`
sạch. TS-MA-04/05 chưa chạy.

**Cảnh báo cách chạy test**: lượt đầu mình gõ KHÔNG DẤU (`nha minh ban chua em`)
và nó "pass" — nhưng pass giả, vì cổng trượt ngay từ vế `\b(bán|rao)\b` chứ không
phải nhờ bộ chặn câu hỏi. Test cổng rao **phải gõ có dấu**, không thì đang đo
nhầm thứ (xem OPEN-29).

Dọn sau khi chạy: xoá `info_requests`, `listings` của người bán thử, đặt
`active_listing_id = null` rồi xoá `messages`/`conversations`/`sellers`.

**Cái test này KHÔNG phủ**: người lạ chưa có dòng `sellers` nhắn câu rao — vẫn
rơi vào nhánh người mua, chưa sửa (quyết định chủ dự án 27/08/2026, để sau).

### TS-KD — tiếng Việt không dấu (FR-161)

Cùng cách dựng người bán thử như TS-MA. Mấu chốt: bộ không dấu chỉ được kích
hoạt khi tin KHÔNG có dấu — tin có dấu phải đi đúng đường cũ.

| Mã | Việc | Kỳ vọng |
|---|---|---|
| TS-KD-01 | Người bán nhắn `ban nha hem xe hoi phuong 8 gia 8.5 ty` | Sinh tin: `ward = "Phường 8"`, `price_raw = "8.5 ty"`, `price_vnd = 8.5e9` (parse_vnd nuốt "ty"), `property_type = nha_pho` (bo_dau phía DB) |
| TS-KD-02 | Cùng người đó nhắn `toi muon mua nha quan 5` | Rẽ nhánh **buyer** (`hoiMua` bản không dấu), KHÔNG tạo tin |
| TS-KD-03 | Người bán nhắn `nha minh ban chua em` | KHÔNG sinh tin — giờ trượt vì bộ chặn câu hỏi tình trạng bản không dấu, không phải trượt "ăn may" ở `\b(bán\|rao)\b` như trước |
| TS-KD-04 | Người bán (có câu chờ) nhắn `chieu gui anh so cho em` | `PROMISE_RE_KD` bắt được → tạo reminder `promise` |
| TS-KD-05 | SQL: `select guess_property_type('ban dat nen quan 5'), guess_property_type('chưa đạt thoả thuận')` | `dat` và `NULL` — bản không dấu bắt đúng, bản có dấu KHÔNG nhiễm ("đạt" ≠ "đất") |

Đã chạy thật 27/08/2026: TS-KD-05 + 7 ca DB khác đúng cả (kể cả có dấu giữ
nguyên hành vi); phía chat-reply 18 ca cổng chạy đơn vị bằng bun đều pass
(gồm *"đang bàn về căn nhà"* KHÔNG sinh tin, *"ban oi nha minh the nao roi"*
KHÔNG sinh tin). **TS-KD-01/02 đã chạy live trên v36**: `ban nha hem xe hoi
phuong 8 gia 8.5 ty` → tin `BDS-Q5-0174` với `ward="Phường 8"`,
`price_raw="8.5 ty"`, `price_vnd=8.5e9`, `property_type=nha_pho` — ĐÚNG TRỌN;
`toi muon mua nha quan 5 tam 5 ty` → rẽ nhánh buyer, fallback bóc được
`deal=ban, budget="5 tỷ"`. Dọn sạch, kho về đúng 173 tin.

Lượt KD-01 trả HTTP 500 dù tin đã sinh đúng — KHÔNG phải lỗi FR-161: API key
Anthropic của bot **hết credit** đúng lúc chạy test, và nhánh seller gọi model
KHÔNG bọc try/catch (khác nhánh mua vốn có fallback) → xem OPEN-30.

**Chấp nhận có chủ đích**: không dấu thì "ban" ôm cả bán/bàn/bạn — cổng vẫn
đòi đủ ba vế nên dương-tính-giả hiếm, nhưng KHÔNG phải không thể; "toi" ôm cả
tôi/tối (lệch giờ nhắc, không mất nhắc); từ "anh" trần không được coi là xin
ảnh.

### TS-IDEM — sổ idempotency + retry (FR-162)

Hai tầng: SQL gọi thẳng `claim_inbound` (nhanh, tất định), rồi E2E bắn
`net.http_post` vào chat-reply thật. E2E dùng **nhánh buyer** vì nhánh đó có
fallback khi model hỏng (OPEN-30) — Anthropic đang hết credit vẫn test được
trọn luồng ghi/đọc sổ. Đo quota bằng `bot_usage.model_calls` trước/sau từng ca.

| Mã | Việc | Kỳ vọng |
|---|---|---|
| TS-IDEM-01 | SQL `claim_inbound('x')` lần đầu | `claimed`, attempts 1 |
| TS-IDEM-02 | Gọi lại ngay khi hàng còn `received` tươi | `in_flight` |
| TS-IDEM-03 | Đặt `completed` + reply rồi claim lại | `completed` kèm nguyên reply |
| TS-IDEM-04 | Đặt `failed` rồi claim lại | `claimed`, attempts 2 |
| TS-IDEM-05 | Đặt `processing` lùi `updated_at` 200 s | `claimed` (reclaim sau 150 s) |
| TS-IDEM-06 | `claim_inbound(null)` | `claimed` — không msg_id thì không chống trùng |
| TS-IDEM-07 | E2E: tin buyer mới, msg_id mới | 200 + replies; sổ `completed` lưu payload; quota **+1** |
| TS-IDEM-08 | E2E: gửi LẠI đúng msg_id đó | `replayed: true` + NGUYÊN câu trả lời cũ; quota **+0**; `messages` vẫn 1 dòng |
| TS-IDEM-09 | E2E: 2 request cùng msg_id bắn đồng thời | một bên trả lời đủ, bên kia `in_flight`; quota chỉ **+1** |
| TS-IDEM-10 | E2E: sửa sổ thành `failed` rồi gửi lại | Xử lý THẬT (không bị 23505 nuốt): replies đầy đủ, attempts 2, `messages` vẫn 1 dòng; quota **+1** (retry thật, đúng luật) |

Đã chạy thật 27/08/2026 trên bản deploy chat-reply v37 + migration
`20260827m`: **10/10 đạt**. Quota đo được `8 → 9 (07) → 9 (08) → 10 (09)
→ 11 (10)` — đúng từng lượt: chỉ 3 lần xử lý thật tốn quota, replay và
in_flight không tốn. Dọn sạch: `inbound_ledger` về 0 dòng, buyer/conversation/
messages test xoá hết.

Lưu ý khi test lại: CTE nhiều nhánh gọi `claim_inbound` trong CÙNG một
statement chạy không theo thứ tự viết — tách từng lệnh, đừng gộp `with`.

### TS-IDEM2 — sự kiện tách khỏi job, exactly-once chiều gửi, thứ tự tất định (FR-162 phần 2)

Cùng harness với TS-IDEM (đường buyer + fallback, đo `bot_usage.model_calls`).
Chín kịch bản ứng thẳng với yêu cầu "provider giao trùng thì business effect
chỉ chạy MỘT lần":

| Mã | Kịch bản | Kỳ vọng |
|---|---|---|
| TS-IDEM2-A | Cùng webhook giao 2 lần | Lần 2 `replayed` + nguyên câu trả lời; quota +0 |
| TS-IDEM2-B | Cùng webhook giao 10 lần | 1 dòng `messages`, attempts 1, 9/9 replay; quota cả cụm **+1** |
| TS-IDEM2-C | 2 bản sao đến ĐỒNG THỜI | Một bên trả lời đủ, bên kia `in_flight` rỗng; 1 dòng messages |
| TS-IDEM2-D | Worker retry sau `failed` | Xử lý THẬT, attempts +1, messages vẫn 1 dòng; quota +1 (đúng luật) |
| TS-IDEM2-E | Chết SAU khi AI chạy, TRƯỚC commit (`processing` kẹt, reply chưa lưu, lùi 200 s) | Reclaim sau 150 s → xử lý thật, reply được lưu, messages vẫn 1 dòng |
| TS-IDEM2-F | Chết SAU commit, TRƯỚC ack (caller mất response, gọi lại) | Replay nguyên payload, không business effect mới |
| TS-IDEM2-G | Lần trước GỬI HỤT (`send_error` có, `sent_at` trống) | Replay với `already_sent=false` → kênh ĐƯỢC gửi lại |
| TS-IDEM2-H | Lần trước gửi THÀNH CÔNG (`sent_at` có), provider giao trùng | Replay với `already_sent=true` → webhook IM, khách không nhận đúp |
| TS-IDEM2-I | Cùng event giao nhiều lần, timestamp giao khác nhau | `inbound_events` MỘT dòng, `delivery_count` đếm đủ, payload giữ bản đầu, `last_seen_at` nhích |

Đã chạy thật 28/08/2026 trên chat-reply **v38** + zalo-webhook **v9** +
migration `20260827n`: **9/9 đạt**. Quota cả phiên `11 → 16` = đúng 5 lượt xử
lý thật (A-lần-1, B-lần-1, C-bên-thắng, D-retry, E-retry); mọi duplicate +0.
Dọn sạch: `inbound_ledger` và `inbound_events` về 0, buyer test xoá hết.

Bẫy đã gặp: `now()` của Postgres cố định theo TRANSACTION — hai lần gọi
`ghi_su_kien_inbound` trong cùng một request thì `last_seen_at` không nhích dù
có `pg_sleep`; muốn thấy timestamp khác nhau phải gọi ở hai request rời.

### TS-TOANVEN — toàn vẹn dữ liệu tầng DB (FR-163)

Chạy bằng MỘT khối DO trên DB test, bắt exception cho các ca "phải bị chặn",
kết quả ghi vào bảng tạm rồi đọc ra (RAISE NOTICE không về được qua MCP).

| Mã | Kịch bản | Kỳ vọng |
|---|---|---|
| 01 | Fact `so_phong_ngu` "3 phòng" rồi SỬA "4 phòng ngủ" | `bedrooms = 4` — fact mới nhất thắng |
| 02a | Fact `dien_tich_tim_tuong` "120m2" | `area_m2` KHÔNG đổi (tim tường ≠ đất/sàn) |
| 02b | Fact `dien_tich` "50m2" | `area_m2 = 50` |
| 03 | Fact `loai_bds` "nhà phố ạ" | `property_type=nha_pho` + `property_type_source=chu_xac_nhan` |
| 04 | UPDATE thẳng `price_vnd = 999` | Bị trigger đè lại = `parse_vnd(price_raw)` |
| 05a | INSERT 2 deals cùng (listing, buyer NULL) | 23505 — **lần chạy đầu FAIL** vì unique thường coi NULL ≠ NULL, chữa bằng `NULLS NOT DISTINCT` rồi PASS |
| 05b | DELETE deal có `closed_at` | Trigger raise |
| 05c | Gỡ `closed_at` rồi DELETE | Được — đường thoát hai bước tường minh |
| 06a | Viewing không có cả `listing_id` lẫn `listing_code` | CHECK chặn |
| 06b | Viewing chỉ có `listing_code` | Được (trước đây NOT NULL nuốt mất lịch) |
| 06c | Viewing `status='tùm lum'` | CHECK chặn |
| 07a | Conversation có CẢ buyer lẫn seller | CHECK một-vai chặn |
| 07b | Seller thứ hai hội thoại | Unique chặn |
| 08 | Reminder `cancelled` bị UPDATE thành `sent` | Revert êm: vẫn `cancelled`, `sent_at` không bị đóng dấu |
| 09 | Ledger `completed` bị hạ xuống `failed` | Raise |

Đã chạy 28/08/2026: **15/15 đạt** (05a qua hai vòng như ghi trên). EXPLAIN
`where conversation_id order by seq desc limit 12` → `Index Scan using
messages_conv_seq_idx`, hết nút Sort. E2E trên chat-reply v39: hồ sơ buyer
merge qua `merge_buyer_prefs` sống, và model bóc đủ 5 trường — **key
Anthropic đã có credit lại** (OPEN-30 hạ nhiệt, vẫn nên bọc try/catch nhánh
seller). Security advisor: không cảnh báo MỚI nào ngoài search_path +
execute-quyền của chính các hàm guard vừa tạo — đã vá trong (10) của
migration; các cảnh báo còn lại đều có từ trước (log_loi mở anon là chủ đích).

### TS-OUNG — đường ống dữ liệu tin rao (FR-164)

Chạy bằng SQL trên bản live 28/08/2026 (DO block ghi kết quả vào bảng tạm —
`RAISE NOTICE` không nổi lên qua MCP), cộng E2E qua `chat-reply` v42.

| Mã | Kịch bản | Mong đợi |
|---|---|---|
| TS-OUNG-01 | Fact vào TRƯỚC khi cột cấu trúc được ghi | Cột theo fact, `*_source` đóng dấu đúng bậc |
| TS-OUNG-02 | Cột cấu trúc ghi trước, fact đến sau | Fact chủ nhà (`chu_xac_nhan`) thắng, đè lên `suy_doan` |
| TS-OUNG-03 | Hai fact cùng trường ghi đồng thời | Không mất cập nhật; giá trị cuối là fact sau, không kẹt khoá |
| TS-OUNG-04 | Chủ sửa: giá 6.5→6.8 tỷ, DT 25→27, PN 3→4, loại chưa rõ→nhà phố, phường 1→3 | Cả năm đổi; cột đang non-NULL KHÔNG chặn giá trị mới |
| TS-OUNG-05 | Tin thiếu giá / thiếu diện tích / thiếu phường | `listing_du_dang_tin()` false, giữ `cho_thong_tin` |
| TS-OUNG-06 | `property_type` chưa rõ | Vẫn đăng được — loại BĐS không nằm trong ba trường quyết định |
| TS-OUNG-07 | Loại suy ra từ mô tả | `property_type_source='suy_doan'`, phân biệt được với lời chủ |
| TS-OUNG-08 | Chủ xác nhận loại, có phủ định: "nhà phố chứ không phải chung cư em" | `nha_pho` — **lần chạy đầu FAIL trả `chung_cu`** (nhánh `chung cư` xét trước `nhà`), chữa bằng `cat_truoc_phu_dinh()` rồi PASS |
| TS-OUNG-09 | `parse_vnd()` không đọc được chuỗi giá | Không ghi gì; `price_raw`/`price_vnd` giữ nguyên, không sinh cặp mâu thuẫn |
| TS-OUNG-10 | Diện tích dị dạng ("mấy chục mét") | Không ghi; fact vẫn lưu làm bằng chứng |
| TS-OUNG-11 | Tin đủ thông tin | Tự lên `dang_ban`, một trigger quyết định |
| TS-OUNG-12 | Tin đang bán bị gỡ mất một trường | Tự hạ về `cho_thong_tin` — đường HẠ kệ trước đây không có |

Đã chạy 28/08/2026: **23/23 đạt** (ca 08 qua hai vòng như ghi trên; ca 06 FAIL
một lần do LỖI SOẠN TEST — mô tả mẫu chứa chữ "nhà" nên FR-150 suy ra
`nha_pho` hoàn toàn đúng, sửa mô tả rồi PASS). Bộ đua riêng 3/3. Bộ
`chuan_hoa_gia_raw` 14/14: cắt "6.8 tỷ nha em" → "6.8 tỷ", giữ nguyên "6 tỷ 8",
"5 tỷ thương lượng", "5 tỏi rưỡi", "20 triệu 1 tháng", "5 tỷ bao sang tên".

Kiểm dữ liệu SẴN CÓ trước khi bật luật đăng tin mới: 154 tin `dang_ban` + 10
tin `dang_quan_tam` đều đủ ba trường, 9 tin `cho_thong_tin` đều thiếu — luật
mới khớp 100% hiện trạng, không tin nào bị đăng nhầm hay hạ nhầm.

E2E trên chat-reply v42 (dữ liệu thử đã xoá sạch sau khi chạy): chủ nhắn "à em
ơi giá 6.8 tỷ nha, phường 3 chứ không phải phường 1, 4 phòng ngủ, diện tích
27m2" → cả bốn trường vào đúng cột, `price_source`/`ward_source` lên
`chu_xac_nhan`, `price_raw` = "6.8 tỷ" trong khi fact giữ nguyên văn "6.8 tỷ
nha em". Nhánh người mua vẫn chạy đủ (bóc 4 trường hồ sơ, lọc kho theo phường
+ ngân sách, trả lời có mã tin).

Security advisor sau khi áp: hai cảnh báo MỚI đều do đợt này gây ra và đã vá
bằng `20260828e` — ba hàm `bac_nguon`/`chuan_hoa_phuong`/`listing_du_dang_tin`
chưa ghim `search_path` (chúng được gọi từ bên trong hai hàm `security
definer`), và bảng `public.ts5_kq` là rác test của đợt TS-TOANVEN tạo nhầm
bằng `create table` nên ở lại thật trong schema `public`. Các cảnh báo còn lại
đều có từ trước (`log_loi` mở cho anon là chủ đích).

Thử `admin_dang_tin` (chạy trong DO block rồi `raise` để cuộn lại, không để lại
dòng nào) lộ ra một lỗ ngoài bộ test: form admin ghi `ward`/`price_raw` NGUYÊN
XI, không đi qua `chuan_hoa_phuong`/`chuan_hoa_gia_raw` như cửa fact — cùng một
cột hai luật trình bày. Vá bằng `20260828f`: chuẩn hoá chuyển xuống trigger
`trg_listings_chuan_hoa_cot` trên chính `listings` nên mọi cửa ghi đều qua.
Chạy lại: `"7 tỷ nha em"` → `"7 tỷ"`, `"phường 8"` → `"Phường 8"`, `price_vnd`
và bậc nguồn giữ nguyên. Đếm trước khi áp: 173/173 giá trị `ward` đã đúng chuẩn
(kể cả phường tên chữ), chỉ 9 dòng `price_raw` đổi và cả 9 là chuỗi RỖNG → NULL
trên tin nháp — không tin nào đổi trạng thái.

### TS-KHO — kho ảnh tin rao theo UUID (FR-165)

Chạy 29/08/2026 trên bản live. Phần DB chạy trong DO block rồi `raise` để cuộn
lại (không để lại dòng nào); phần HTTP gọi bằng `pg_net` vì máy chạy agent bị
chính sách mạng chặn CONNECT tới host Supabase.

| Mã | Kịch bản | Mong đợi | Kết quả |
|---|---|---|---|
| TS-KHO-01 | Upload: ghi dòng media đúng quy ước | Nhận, và tự thành ảnh bìa | ✅ |
| TS-KHO-02 | Upload đường dẫn theo MÃ TIN (lối cũ) | CHECK chặn | ✅ |
| TS-KHO-03 | Upload trùng (bucket, path) | UNIQUE chặn | ✅ |
| TS-KHO-04 | `so_do` vào bucket công khai | CHECK chặn | ✅ |
| TS-KHO-05 | Thứ tự: sort_order NGƯỢC thứ tự tên file | Ra `10,2,1` — xếp theo tên sẽ ra `1,10,2` | ✅ |
| TS-KHO-06 | Ảnh bìa | Tấm sort_order nhỏ nhất, không phải tấm tên nhỏ nhất | ✅ |
| TS-KHO-07 | **Đổi mã tin** | 3/3 ảnh còn nguyên, view đổi theo mã mới | ✅ |
| TS-KHO-08 | Replace (đổi storage_path) | Đường dẫn CŨ vào hàng đợi dọn | ✅ |
| TS-KHO-09 | Xoá ảnh đang là bìa | Vào hàng đợi + tấm kế lên làm bìa | ✅ |
| TS-KHO-10 | Xoá tin | media cascade về 0, cả 4 file vào hàng đợi (kể cả file riêng tư) | ✅ |
| TS-KHO-11 | Upload hỏng (có dòng, chưa có file) | `media_mo_coi_db` soi ra | ✅ |
| TS-KHO-12 | Worker nhận việc | `dang_lam`, attempts=1 | ✅ |
| TS-KHO-13 | Xoá hỏng rồi quá 10 phút | Nhận lại được, attempts=2 | ✅ *(FAIL lần đầu, xem dưới)* |
| TS-KHO-14 | Việc đã `xong` | Không bị nhận lại, và không lùi trạng thái được | ✅ |
| TS-KHO-15 | Worker chạy thật với file KHÔNG tồn tại | `da_xoa=1` — coi là xong | ✅ *(FAIL lần đầu, xem dưới)* |
| TS-KHO-16 | anon xin quyền GHI vào `listing-public` | 403 AccessDenied (RLS) | ✅ |
| TS-KHO-17 | anon xin quyền GHI vào `listing-private` | 403 AccessDenied | ✅ |
| TS-KHO-18 | anon tự tạo bucket | 403 AccessDenied | ✅ |
| TS-KHO-19 | Đọc `/object/public/` của bucket RIÊNG | `NoSuchBucket` — route công khai không phục vụ | ✅ |
| TS-KHO-20 | anon đọc `listing_media` | Chỉ thấy dòng `listing-public`; dòng `so_do` bị RLS lọc | ✅ |
| TS-KHO-21 | anon đọc view sau khi siết execute | Vẫn ra URL đúng dạng UUID | ✅ *(FAIL lần đầu, xem dưới)* |
| TS-KHO-22 | Đường dẫn có `..` (leo thư mục) | CHECK chặn | ✅ |
| TS-KHO-23 | Đường dẫn có `//` | CHECK chặn | ✅ |
| TS-KHO-24 | Ảnh thường (không phải giấy tờ) vào bucket riêng | Cho — bucket riêng không cấm ảnh thường | ✅ |
| TS-KHO-25 | Đặt `is_cover` cho file ở bucket riêng | CHECK chặn (bìa là thứ hiện công khai) | ✅ |

**25/25 đạt**, sau khi chữa ba lỗi mà chính bộ test lôi ra:

1. **TS-KHO-13 FAIL lần đầu** — trigger ép cứng `updated_at := now()` nên không
   ai lùi được mốc thời gian, mà đó là thứ DUY NHẤT quyết định bao giờ một việc
   `loi` được nhận lại. Không kiểm thử được, cũng không vận hành được. Sửa: chỉ
   tự đóng dấu khi người gọi không tự đặt.
2. **TS-KHO-15 FAIL lần đầu** — worker coi "file đã không còn" là LỖI nên việc
   dọn quay vòng vô tận. Gốc: Storage của Supabase **không** trả HTTP 404 cho
   vật thể thiếu, nó trả **HTTP 400** với thân JSON `{"statusCode":"404"}`. Bản
   đầu chỉ soi mã HTTP nên không bao giờ khớp. Sửa: đọc thân.
3. **TS-KHO-21 FAIL lần đầu** — siết `execute` xong là anon vỡ view
   ("permission denied for function cau_hinh"). View security-definer cho đọc
   BẢNG bằng quyền chủ view, nhưng quyền EXECUTE một HÀM vẫn xét theo NGƯỜI
   GỌI. Sửa: view đọc thẳng `app_config` bằng subquery, không gọi hàm.

**Chưa kết luận được (ghi thẳng, không tính là đạt):** anon LIỆT KÊ bucket riêng
trả `200 []`. Với bucket rỗng thì `[]` không phân biệt được "RLS lọc sạch" và
"cho phép nhưng chẳng có gì". Lập luận cấu hình thì an toàn (`storage.objects`
bật RLS, KHÔNG có policy SELECT nào cho anon), nhưng đó là suy từ cấu hình chứ
không phải quan sát được. Kiểm lại khi kho có ảnh thật.

Advisor sau khi áp: các hàm mới đều đã rời khỏi danh sách "public gọi được".
Bẫy bắt được: `revoke ... from anon, authenticated` KHÔNG có tác dụng với hàm —
Postgres cấp EXECUTE cho PUBLIC theo mặc định và hai role đó thừa kế qua đó;
phải revoke từ chính PUBLIC.

### TS-JOB — việc chạy nền tin cậy (FR-166)

Chạy 29/08/2026 trên bản live, một khối DO duy nhất rồi `raise` để cuộn lại —
kiểm sau khi chạy: 0 dòng `TSJOB%` còn sót ở `inbound_ledger`, `inbound_events`,
`buyers`, `reminders`. Ba nhóm đầu là kịch bản HỎNG dựng bằng tay (sập giữa
chừng = để `updated_at` lùi quá hạn thuê; hết đường thử lại = đẩy `attempts` lên
trần), vì không có cách nào giết một instance Edge Function theo ý muốn.

| Mã | Kịch bản | Mong đợi | Kết quả |
|---|---|---|---|
| TS-JOB-01 | Claim tin lần đầu | `received`, attempts=1, sổ ghi `processing` | ✅ |
| TS-JOB-02 | Hai worker giành cùng một tin | Bên thua nhận `in_flight`, không xử lý đôi | ✅ |
| TS-JOB-03 | **Worker sập**: `processing` quá hạn thuê 150s | Worker sau nhận lại được, attempts=2 | ✅ |
| TS-JOB-04 | Báo hỏng một job | `failed` + có `next_retry_at` | ✅ |
| TS-JOB-05 | Claim trước giờ thử lại | `in_flight` — không đập lại API sớm | ✅ |
| TS-JOB-06 | Luật lùi dần `lan_thu_ke()` | Nhân đôi dần, chặn ở 1 tiếng, nhiễu trong ±20% | ✅ |
| TS-JOB-07 | **Hỏng vĩnh viễn**: lần thứ 8 | Chuyển thư chết `dead`, thôi thử lại | ✅ |
| TS-JOB-08 | Claim một việc đã `dead` | Trả `dead` + cờ `r_dead` để bên gọi biết dừng | ✅ |
| TS-JOB-09 | Lùi `dead` → `processing` | Guard chặn (chỉ gỡ được bằng `completed`) | ✅ |
| TS-JOB-10 | Báo hỏng trên dòng đã `completed` | `da_completed`, không đụng status — khỏi va guard FR-163 | ✅ |
| TS-JOB-11 | Nudge giành việc nhắc tới hạn | 1 dòng, `locked_by`, attempts=1 | ✅ |
| TS-JOB-12 | **Hai worker nudge chạy chồng** | Worker thứ hai lấy 0 dòng — hết cảnh gửi đúp | ✅ |
| TS-JOB-13 | Gửi nhắc hụt | Nhả hợp đồng thuê + hẹn giờ lùi dần | ✅ |
| TS-JOB-14 | Giành nhắc trước giờ thử lại | 0 dòng | ✅ |
| TS-JOB-15 | Nhắc hỏng lần thứ 5 | `dead` | ✅ |
| TS-JOB-16 | Lùi nhắc `dead` → `pending` | Guard giữ nguyên `dead` | ✅ |
| TS-JOB-17 | **Hai lời hỏi thăm cùng một khách** | 23505 — unique index chặn, bên thua nhường | ✅ |
| TS-JOB-18 | Nhắc chưa tới hạn | Không bị nhặt | ✅ |
| TS-JOB-19 | Worker nhận việc dọn file | `dang_lam`, attempts=1 | ✅ |
| TS-JOB-20 | Việc dọn file quá 6 lần | Thôi nhận — hết thử lại vô hạn | ✅ |
| TS-JOB-21 | `chon_viec_don_chet()` | Đổi sang `chet` | ✅ |
| TS-JOB-22 | **Sập trước khi gọi chat-reply**: có sự kiện, không có job | Đường cứu thấy, lý do `chua_co_job` | ✅ |
| TS-JOB-23 | **Sập giữa lúc gọi model**: job kẹt `processing` | Đường cứu thấy, `job_do_dang` | ✅ |
| TS-JOB-24 | **Sập sau AI, trước lần gửi đầu** (`completed`/`sent_at` null/`send_error` null/`sent_bubbles` 0) | Đường cứu thấy, `chua_gui` | ✅ |
| TS-JOB-25 | Đã gửi đủ bong bóng | KHÔNG liệt kê — không gửi lại cho khách | ✅ |
| TS-JOB-26 | Việc đã `dead` | KHÔNG liệt kê — thôi quét | ✅ |
| TS-JOB-27 | View `job_suc_khoe` | Thấy việc dở của cả ba hàng đợi | ✅ |
| TS-JOB-28 | **Giành được nhưng KHÔNG thử gửi** (thiếu đích/thiếu token OA — việc của bridge) | `nha_viec_nhac` trả việc: hết khoá, `attempts` về lại 0 | ✅ |
| TS-JOB-29 | Nhả xong, worker sau nhặt lại | Lấy được ngay, không phải chờ hết hạn thuê | ✅ |
| TS-JOB-30 | Nhả một việc đã `sent` | `khong_co` — chỉ nhả được việc còn `pending` | ✅ |

**Ngoài bảng — E2E trên bản đang chạy.** Dựng một sự kiện mồ côi thật trong
`inbound_events` (có payload, không có job — đúng cảnh instance chết sau ack),
rồi để `inbound-sweep` nhặt: job về `completed`, `reply` nằm trong sổ, 3 dòng
`messages` được ghi, và lượt quét sau không còn liệt kê nó nữa.

**Bốn lỗi do chính bộ kiểm này lộ ra** (đã chữa trước khi chốt):

1. *Vị ngữ đường cứu lọt lưới TS-JOB-24.* Bản đầu đợi `send_error` để biết gửi
   hụt. Nhưng sập NGAY SAU khi model trả về và TRƯỚC lần gửi đầu thì không có
   `send_error` nào cả — dòng đó lọt lưới và câu trả lời không bao giờ tới tay
   khách. Chữa: so `jsonb_array_length(reply->'replies')` với `sent_bubbles`.
2. *Tên hàm guard đoán sai.* Migration viết theo trí nhớ (`reminders_giu_trang_thai`,
   `inbound_ledger_giu_trang_thai`); tên thật là `reminders_giu_trang_thai_ket` và
   `inbound_ledger_giu_completed`. Đoán trúng thì tạo hàm MỚI và guard cũ vẫn chạy
   nguyên bản cũ. Chữa bằng cách tra `pg_get_functiondef` trước khi ghi đè.
3. *Nạp chồng `claim_inbound`.* Thêm tham số thứ ba mà không DROP thì Postgres
   giữ cả hai bản và PostgREST có thể chọn nhầm. Chữa: DROP bản `(text,int)`
   trước, và giữ nguyên `p_stale_secs` để bên gọi cũ không gãy.
4. *`dry_run` của nudge vẫn ĂN lượt thử.* Bản đầu cho `dry_run` đi qua
   `nhan_viec_nhac` như thật, nên `attempts` tăng — 5 lần chạy thử là nhắc THẬT
   của khách bị đẩy vào thư chết. Chữa: `dry_run` đọc bằng SELECT thường, không
   giành việc. 10 dòng bị ảnh hưởng lúc thử đã được đặt lại (`locked_at` null,
   `attempts` 0).
5. *Bộ đếm `attempts` nói dối trên việc CHƯA THỬ.* Lộ ra khi soi DB sau lượt cron
   THẬT đầu tiên (02:00): 10 dòng `escalation`/`report` có `locked_at`, `attempts`
   = 1, mà `last_error` rỗng. Không có gì hỏng — chúng là việc dành cho bridge kéo
   qua `escalation-feed`, và khối escalation của `nudge` chỉ gửi khi có đủ đích +
   token OA. Từ khi `nhan_viec_nhac` là cửa lấy việc, mỗi lượt cron không-thử-được
   vẫn +1, nửa tiếng một lần, vô hạn — `job_suc_khoe` sẽ khoe "đã thử 40 lần" cho
   một việc chưa ai thử lần nào. Chữa bằng `nha_viec_nhac()` (`20260829c`): trả
   việc và hoàn luôn lượt đếm. Cố ý KHÔNG dùng `bao_hong_nhac` ở đây — "thử rồi
   hụt" phải lùi dần và phải chết sau 5 lần, "chưa thử được" thì không.

**30/30 đạt.**

### TS-SEC2 — soát bảo mật theo VAI THẬT (FR-167)

Chạy 29/08/2026 trên bản live. **Cách làm khác các đợt trước**: không đọc policy
rồi suy diễn, mà đóng vai thật — `set local role anon` / `authenticated` kèm
`request.jwt.claims` để `auth.uid()` và `auth.jwt()` trả đúng danh tính — rồi
thử đọc/ghi/gọi RPC. Phần edge function gọi HTTP thật bằng đúng **publishable
key** (khoá nằm sẵn trong bundle JS của web, ai mở trang cũng có). Toàn bộ dựng
cảnh nằm trong một khối DO rồi `raise` để cuộn lại; kiểm sau khi chạy: 0 dòng
sót ở `auth.users`, `sellers`, `listings`, `buyers`, `admins`, 0 hàm test còn
lại, `listing-private` vẫn `public=false`.

**Ba cái bẫy của chính bộ kiểm, phải nói ra vì chúng suýt cho kết luận sai:**

1. *UPDATE bị RLS chặn KHÔNG ném lỗi* — nó sửa 0 dòng rồi báo thành công. Lượt
   đầu tôi chấm theo "có exception hay không" nên S10/S12/S16 hiện FAIL, đọc như
   "anon bật được bucket riêng thành công khai". Chấm lại theo SỐ DÒNG và soi
   trạng thái bucket trước/sau: 0 dòng, `public` vẫn `false`. Không phải lỗ.
2. *`select count(*) from (select f())` không gọi f()* — planner bỏ qua vì
   count(\*) không cần giá trị cột. Lượt đầu vì thế báo `cau_hinh` "chạy được"
   trong khi thật ra nó bị chặn. Chữa: `execute ... into v` để ép đánh giá.
3. *Cảnh "tin nháp" tự lên kệ* — tin dựng để test có đủ giá/diện tích/phường nên
   trigger FR-164 đẩy thẳng sang `dang_ban`, làm test đọc-chéo hiện FAIL giả.
   Dựng lại tin THIẾU thông tin mới ra kết quả thật.

| Nhóm | Số ca | Nội dung | Kết quả |
|---|---|---|---|
| TS-SEC2-01…22 | 22 | `anon` ĐỌC: sellers (SĐT), buyers (ghi chú CRM), messages, conversations, deals, viewings, reminders, admins, ctvs, info_requests, bot_prompts, app_config, bot_errors, inbound_ledger, media_cleanup_queue, job_suc_khoe, tin nháp, fact địa chỉ/hình, media bucket riêng, media + ảnh của tin nháp | 22/22 chặn |
| TS-SEC2-23…41 | 19 | Người lạ ĐÃ ĐĂNG NHẬP GHI: sửa/xoá tin người khác, tạo tin đội tên seller khác, tự phong admin, sửa SĐT chủ nhà, tạo seller/buyer đội tên, sửa ghi chú CRM, sửa phí, chốt/xoá giao dịch, chèn tin nhắn vào hội thoại người khác, sửa + spam lời nhắc, sửa prompt hệ thống, thêm media/fact vào tin người khác, tạo lịch xem giả, xoá hội thoại, sửa app_config | 19/19 chặn |
| TS-SEC2-42…56 | 15 | Người lạ gọi RPC: get_secret, cau_hinh, next_listing_code, listings_fill_code, info_request_set_active_listing, ghi_fact_listing, merge_buyer_prefs, claim_inbound, nhan_viec_nhac, bump_model_quota, beat, bot_health_tick, inbound_sweep_tick, nudge_tick, ctv_report_tick | 15/15 chặn |
| TS-SEC2-57…59 | 3 | **Chéo người bán**: seller B đọc hồ sơ A, đọc tin NHÁP của A, CƯỚP tin của A (đổi `seller_id`) | 3/3 chặn |
| TS-SEC2-60…61 | 2 | **Không vỡ nghiệp vụ**: anon vẫn đọc được tin ĐÃ LÊN KỆ và ảnh của nó | 2/2 đạt |

**Kiểm quyền riêng (`admin_dang_tin`)**: hàm này CỐ Ý mở cho `authenticated` vì
trang `/admin` gọi nó, nhưng nó tự kiểm `admins.email = auth.jwt()->>'email'` và
ném 42501 nếu không phải admin. Gọi bằng vai người lạ → bị chặn đúng như thiết kế.

**Kho file — 16 ca, tất cả chặn.** `storage.objects` và `storage.buckets` bật
RLS với **0 policy**, nên mọi vai không-bypass đều bị từ chối bất kể quyền GRANT
rộng: anon/authenticated ghi thẳng `storage.objects` (cả hai bucket), ghi đường
dẫn leo thư mục `../..`, chuyển file riêng sang bucket công khai, xoá sạch
objects, bật `public` cho bucket riêng, nới `file_size_limit`, tạo bucket mới.
Qua HTTP: đọc route `/object/public/` của bucket riêng trả `NoSuchBucket`, tạo
bucket trả 403 AccessDenied. *(Hai ca liệt-kê-bucket vẫn trả `200 []` — kho đang
rỗng nên `[]` không phân biệt được "RLS lọc" với "cho phép nhưng rỗng"; kết luận
lấy từ tầng SQL, chỗ có bằng chứng.)*

**Edge function — 8 ca HTTP trên bản deploy, sau khi vá:**

| Mã | Gọi bằng | Trước | Sau |
|---|---|---|---|
| TS-SEC2-H1 | `nudge`, KHÔNG kèm khoá nào | **200 + lộ danh sách lời nhắc** | 403 |
| TS-SEC2-H2 | `nudge` + publishable key | **200** | 403 |
| TS-SEC2-H3 | `nudge` + `x-bridge-secret` đúng (đường cron) | 200 | 200 (giữ nguyên) |
| TS-SEC2-H4 | `nudge` + bridge secret SAI | — | 403 |
| TS-SEC2-H5 | `ask-seller` + publishable key | **400 (đã qua cổng, vào logic)** | 403 |
| TS-SEC2-H6 | `ctv-report` + publishable key | **đang chạy (timeout 5s của pg_net)** | 403 |
| TS-SEC2-H7 | `geocode-listings` + publishable key | **200, ghi lat/lng** | 403 |
| TS-SEC2-H8 | `chat-reply` / `escalation-feed` / `media-cleanup` / `inbound-sweep` + publishable key | 403/401/403/403 | không đổi (vốn đã kín) |

`ask-seller` và `ctv-report` gọi lại bằng đúng bridge secret vẫn qua cổng
(400 "listing_id bắt buộc" và chạy tới model) — cổng chặn người lạ, không chặn
đường vận hành.

**Hồi quy do chính bản vá gây ra — bắt bằng soát truy vết, không phải bằng test.**
Gắn cổng cho `ask-seller` nhưng chỉ sửa `nudge_tick` + `ctv_report_tick`; người
gọi thứ ba là `ask_seller_drip()` (cron `seller-drip-tick` mỗi 30 phút **và**
trigger `trg_listing_drip` mỗi lần có tin mới) vẫn gửi mỗi anon JWT → 403. Vì
`net.http_post` bắn-rồi-quên nên cron báo `succeeded` như thường: vòng drip
FR-129/144 **đứt im lặng**. Bộ kiểm TS-SEC2 không thấy vì nó gọi thẳng
`ask-seller` bằng bridge secret và thấy qua — đúng chỗ mù của "test cái mình vừa
sửa". Vá ở `20260829e`, kiểm lại bằng cách dựng ĐÚNG bộ header mà hàm sinh ra rồi
bắn thử: **400 "listing_id bắt buộc"** (qua cổng) thay vì 403. Quét thêm toàn bộ
hàm SQL có `net.http_post`: cả 5 (`ask_seller_drip`, `nudge_tick`,
`ctv_report_tick`, `media_cleanup_tick`, `inbound_sweep_tick`) nay đều mang bí
mật, **URL** đều lấy từ `app_config`, không cái nào còn anon JWT nhúng cứng.
(Publishable key thì VẪN nhúng cứng trong cả 5 — không phải lỗ vì khoá đó vốn
công khai, nhưng xoay khoá project là phải sửa cả 5 hàm.) Bridge
(`bot/bridge-zca`) chỉ gọi `chat-reply` + `escalation-feed` và vốn đã gửi
`x-bridge-secret` — không ảnh hưởng.

**Năm ca BẤT BIẾN thêm sau hồi quy drip (TS-SEC2-62…66)** — chính là thứ lẽ ra
phải có ngay từ đầu, vì test "gọi thẳng function bằng bridge secret" không bao
giờ bắt được người gọi bị bỏ sót. Hai ca đầu chạy bằng MỘT câu SQL trên
`pg_get_functiondef`, nên lần sau gắn cổng cho function khác mà quên người gọi
là đỏ ngay:

| Mã | Bất biến | Kết quả |
|---|---|---|
| TS-SEC2-62 | Mọi hàm SQL có `net.http_post` đều mang `x-bridge-secret` | ✅ 5/5, danh sách thiếu rỗng |
| TS-SEC2-63 | Không hàm nào còn nhúng cứng anon JWT đời cũ (`eyJhbGciOi…`) | ✅ rỗng |
| TS-SEC2-64 | `authenticated` gọi `ask_seller_drip()` | ✅ chặn |
| TS-SEC2-65 | `anon` gọi `ask_seller_drip()` | ✅ chặn |
| TS-SEC2-66 | `seller_drip_tick` + `trg_listing_drip` vẫn SECURITY DEFINER (siết `ask_seller_drip` không gãy đường vận hành) | ✅ 2/2 |

**Advisor sau khi vá**: 4 cảnh báo `function_search_path_mutable` biến mất; ba
hàm SECURITY DEFINER `next_listing_code`/`listings_fill_code`/
`info_request_set_active_listing` rời khỏi danh sách anon/authenticated gọi được.
Còn lại đều là CỐ Ý và đã ghi lý do: `listing_photos_v` là security-definer có
chủ đích, `log_loi` mở cho anon (có van), `admin_dang_tin` mở cho authenticated
(tự kiểm admin bên trong), 16 dòng INFO `rls_enabled_no_policy` chính là trạng
thái ĐÚNG (bật RLS, không policy = từ chối tất cả trừ service_role), `pg_net`
trong schema public là nợ cũ ở OPEN-24.


### TS-HQ — hồi quy sau soát thù địch + hai lượt review diff (29/08/2026)

Mười lỗi, **cả mười nằm trong chính phần FR-161…FR-167 vừa làm**, và **năm cái
được hai lượt review độc lập chỉ vào cùng một dòng**. Không cái nào do test cũ
bắt được: TS-JOB/TS-SEC2 kiểm hàm DB theo vai thật, còn chỗ hỏng lần này gần
như đều nằm ở tầng TypeScript — nơi chưa có lấy một test nào. Đó mới là bài học
của đợt này, không phải mười cái vá.

Hai ca chạy được bằng máy, đặt ở `bot/tests/` (Node, không cần mạng):

| Mã | Bất biến | Cách chạy | Kết quả |
|---|---|---|---|
| TS-HQ-01 | Câu gõ LẪN dấu vẫn nhận ra là câu rao (`ban nha q5 giá 5 ty`) | `node bot/tests/fr161-go-lan-dau.mjs` | ✅ 9/9 (bản cũ trượt 2) |
| TS-HQ-02 | Câu gõ LẪN dấu vẫn nhận ra là câu hỏi mua | ↑ cùng file | ✅ |
| TS-HQ-03 | Câu vừa sửa một trường vừa trả lời câu hỏi treo → ghi CẢ HAI | `node bot/tests/fr164-loi-sua-va-cau-hoi-treo.mjs` | ✅ 8/8 |
| TS-HQ-04 | Câu CHỈ có lời sửa → KHÔNG rơi xuống khối câu hỏi treo (chiều ngược, dễ vá hỏng hơn chiều xuôi) | ↑ cùng file | ✅ |

Tám ca còn lại chưa có test tự động — ghi lại đây làm bất biến để lần sau đụng
vào thì biết mình đang phá cái gì:

| Mã | Bất biến | Hỏng thì mất gì | Vá ở |
|---|---|---|---|
| TS-HQ-05 | `chat-reply` gặp job `dead` thì DỪNG, không gọi model | Đốt một lượt model cho dòng đã bỏ; và vì nhánh đó không cầm hợp đồng thuê, hai lượt giao cùng lúc **đều gửi** — vỡ exactly-once FR-162 | `chat-reply` nhánh `r_state === "dead"` |
| TS-HQ-06 | Báo hỏng job phải qua `bao_hong_inbound`, không ghi thẳng `status='failed'` | Không có `next_retry_at` → `inbound-sweep` cứu lại mỗi phút, đốt sạch 8 lượt trong 8 phút rồi vứt tin của khách vĩnh viễn | `chat-reply` hàm `baoHong` |
| TS-HQ-07 | `nudge --dry_run` KHÔNG được đụng lời nhắc thật | Lượt "chỉ xem" với key model hỏng đẩy 5 dòng pending thật sang thư chết | `nudge` hàm `baoHongNhac` |
| TS-HQ-08 | Dòng giữ chỗ `reengage` mồ côi phải được dọn | Index duy nhất khoá cứng: khách đó **không bao giờ** được hỏi thăm nữa, không một dòng lỗi | `nudge`, quét >15 phút |
| TS-HQ-09 | Lỗi chèn dòng giữ chỗ khác 23505 phải vào `bot_errors` | `continue` trần nuốt cả lỗi thật lẫn lỗi đua (FR-152 d) | `nudge` |
| TS-HQ-10 | `catch` ở cửa phát lại chỉ bọc `JSON.parse` | `handleEvent` ném → nuốt sạch → trả 200 → `inbound-sweep` tưởng đã cứu, phát lại mỗi phút suốt 24h | `zalo-webhook` |
| TS-HQ-11 | Bridge tôn trọng `replayed`+`already_sent`, và ghi lại `sent_at` | Hai lượt thả tim cùng map về `react-<tid>-<gMsgID>` → khách nhận lại nguyên loạt bong bóng | `bridge-zca` + cửa `mark_sent` |
| TS-HQ-12 | `nha_viec_nhac` chỉ nhả việc của CHÍNH worker đó | Worker treo quá hạn xoá khoá worker đang chạy → worker thứ ba giành cùng dòng | `20260829f` |

**Hạn còn lại, biết mà chưa vá** (đừng để nó trôi thành "đã xong"):

1. Bridge **chưa tiếp tục từ `sent_bubbles`** — gửi hụt giữa chừng rồi giao lại
   vẫn phát từ bong bóng đầu. Muốn hết thì `claim_inbound` phải trả thêm
   `sent_bubbles`, tức đổi chữ ký hàm DB.
2. `bot/tests/*.mjs` **chép lại** regex của `chat-reply` chứ không import được
   (Node không nạp module Deno, máy build không có Deno). Sửa regex mà quên sửa
   test là test vẫn xanh trong khi hàm thật đã đổi — đã ghi cảnh báo ở
   `bot/tests/README.md`.
3. Tầng TypeScript vẫn **chưa có test nào chạy trong CI**. Hai file trên phải
   gọi bằng tay.

---

### TS-TIEN — đồng hồ đo tiền bộ não (FR-169)

Chạy 01/09/2026 thẳng trên Supabase thật, gói trong khối `DO … raise exception`
để **cuộn lại toàn bộ**: kiểm xong đối chiếu `bot_usage` còn đúng 3 dòng cũ
(27/08, 28/08, 29/08), không sinh dòng 01/09 nào. Kết quả gói vào chính câu lỗi
vì kênh MCP không trả `notice` về.

| ID | Ca | Chờ đợi | Kết quả |
|---|---|---|---|
| TS-TIEN-01 | `cong_token(1000,200,5000,0)` khi ngày chưa có dòng nào | Tự tạo dòng, `model_calls` giữ 0 (đo ≠ đếm lượt) | calls=0 in=1000 out=200 nạp=5000 đọc=0 ✅ |
| TS-TIEN-02 | Gọi tiếp `cong_token(300,100,0,5000)` | CỘNG DỒN chứ không ghi đè | in=1300 out=300 nạp=5000 đọc=5000 ✅ |
| TS-TIEN-03 | `cong_token(null,null,null,null)` | `coalesce` về 0, không làm hỏng dòng | in=1300 đọc=5000, không đổi ✅ |
| TS-TIEN-04 | `bump_model_quota(1000)` chạy SAU `cong_token` | Tăng đúng lượt trên CÙNG dòng, không đè số chữ | calls=0→1, in=1300 nguyên ✅ |
| TS-TIEN-05 | Vai `anon` đọc `bot_usage` | Chặn ngay ở tầng quyền (không được cấp SELECT) | bị chặn ✅ |
| TS-TIEN-06 | Vai `authenticated`, email KHÔNG có trong `admins` | Qua tầng quyền nhưng RLS lọc còn 0 dòng | 0 dòng ✅ |
| TS-TIEN-07 | Vai `authenticated`, email CÓ trong `admins` | Thấy đủ dòng | 3 dòng ✅ |

**TS-TIEN-04 là ca đáng giá nhất**: `cong_token` dùng `insert … on conflict` chứ
không `update` thẳng, vì lượt gọi model đầu tiên trong ngày có thể là lượt KHÔNG
đi qua `bump_model_quota` (nudge/ctv-report/ask-seller chạy theo lịch) — khi đó
dòng của ngày chưa tồn tại và một câu `update` thuần sẽ lặng lẽ ghi vào hư
không. Ca này kiểm hai hàm không giẫm chân nhau theo cả hai chiều gọi.

**Chưa kiểm được ở đây** (`chat-reply` v43 đã deploy 02/09/2026 — xem
`bot/README.md` — nhưng chưa có lượt nhắn thật nào đi qua nó): số chữ THẬT do
model trả về có chảy đúng vào bốn cột không, và nhịp nhớ tạm 1 giờ có thật sự
cho tỷ lệ đọc-lại cao hơn không. Cách kiểm:
nhắn bot 3 lượt cách nhau ~10 phút rồi mở `/admin` — `cache_read_tokens` phải
lớn hơn `cache_write_tokens`. Nếu ngược lại thì nhịp đang sai, xem khối bình
luận tại chỗ `cache_control` trong `chat-reply` để chọn lại.

**Điểm mù đã biết**: đồng hồ mới nối ở `chat-reply`. `nudge`, `ask-seller`,
`ctv-report` chưa gắn `doTien()`, nên số trong bảng là SÀN chứ không phải tổng —
đã ghi thẳng câu này lên thẻ ở `/admin` để người đọc số không hiểu nhầm.

---

### TS-CHUONG — chuông báo hết tiền tài khoản AI (FR-168)

Chạy 01/09/2026 trên Supabase thật, cùng khuôn TS-TIEN: gói trong
`DO … raise exception` để cuộn lại. Đối chiếu sau khi kiểm: `bot_errors` về đúng
239 dòng, 0 dòng `HET TIEN API`, 0 lời nhắc còn sót.

| ID | Ca | Chờ đợi | Kết quả |
|---|---|---|---|
| TS-CHUONG-01 | Ghi lỗi `Your credit balance is too low…` | Chuông kêu, đúng 1 dòng nguồn `HET TIEN API` | 1 ✅ |
| TS-CHUONG-02 | Ghi tiếp một lỗi hết tiền nữa trong cùng 6 giờ | Vẫn 1 dòng — van hãm nhịp giữ | 1 ✅ |
| TS-CHUONG-03 | Ghi thẳng một dòng nguồn `HET TIEN API` | Không tự soi mình, không đệ quy | 2 dòng (1 chuông + 1 chèn tay), không bùng ✅ |
| TS-CHUONG-04 | Sau khi chuông kêu, soi bảng `reminders` | 0 — cố ý KHÔNG đẩy qua cầu nối | 0 ✅ |
| TS-CHUONG-05 | Nội dung dòng chuông | Mở đầu bằng câu báo bộ não câm, có đường dẫn nạp tiền | `🔴 BỘ NÃO ĐANG CÂM — HẾT TIỀN TÀI KHOẢN AI. Mọi…` ✅ |
| TS-CHUONG-06 | **ÂM TÍNH** — ba lỗi thường (`Overloaded`, `Unterminated string`, `connection reset`), hai trong đó `status_code` RỖNG | Chuông im | **❌ KÊU** → vá `20260901c` → chạy lại **0 ✅** |
| TS-CHUONG-07 | Mã HTTP 402, nội dung không khớp mẫu chữ nào | Chuông kêu | 1 ✅ |

**TS-CHUONG-06 là lý do bộ kiểm này tồn tại.** `20260901a` đã được thử với dữ
liệu hết tiền thật hôm áp và thấy "chạy đúng" — nhưng chưa ai thử một lỗi BÌNH
THƯỜNG để xem nó có im không. Nó không im: `new.status_code = 402` với cột rỗng
cho ra `NULL`, `false or NULL` = `NULL`, `not NULL` = `NULL`, và `if NULL then`
không chạy nên hàm rơi thẳng xuống nhánh kêu chuông. Mà gần như MỌI dòng trong
`bot_errors` đều có `status_code` rỗng — `ghiLoi()` không truyền mã — nên chuông
sẽ kêu 6 tiếng một lần trên lỗi vặt bất kỳ, tức là biến thành báo động giả rồi bị
bỏ qua, đúng cái bệnh nó sinh ra để chữa. Vá ở `20260901c`: bọc
`coalesce(new.status_code, 0)`.

Hai luật rút ra, áp cho mọi trigger lọc sau này:

1. Trong mệnh đề `or` dùng để **lọc bỏ**, mọi vế so sánh với cột cho phép rỗng
   phải bọc `coalesce`. Một `NULL` lọt vào giữa chuỗi `or` là cả mệnh đề mất
   nghĩa, mà `if` thì im lặng coi `NULL` như false.
2. Kiểm một điều kiện lọc thì **ca âm tính quan trọng ngang ca dương tính**.
   "Chạy đúng khi có sự cố" mới là nửa bài; nửa còn lại là "im khi không có".

---

### TS-VAI — bóc dữ liệu theo bốn vai người nhắn (FR-159, FR-170)

Soát 01/09/2026 theo bốn vai chủ dự án nêu. Hai tầng kiểm:

**Tầng regex/parser** — `bot/tests/fr159-bon-vai.mjs`, chạy `node`, 59 ca, chép
regex từ `chat-reply` (xem `bot/tests/README.md`). Bốn nhóm: 7 câu chủ nhà nói
về căn của họ phải Ở LẠI nhánh bán; 8 câu hỏi mua thật phải rẽ sang nhánh mua;
14 câu người lạ (5 mở hồ sơ bán, 9 không — trong đó "tôi có căn nhà ở Q10, giờ tìm Q5"
phải KHÔNG mở dù đang trả lời câu hỏi vai); 18 ca khoảng giá đo bằng bất biến
"khoảng lọc có ÔM căn giá X không" + 3 ca fallback; 9 ca nhãn chính chủ/môi giới (02/09). **59/59.** Chạy lại
`fr161-go-lan-dau.mjs` sau khi đồng bộ `hoiMua`: **9/9.**

Con số đáng nhớ trước khi vá: **5/7** câu chủ nhà thường nói ("có khách nào coi
nhà chưa em?", "tôi muốn nhà mình lên web sớm"…) bị rẽ sang nhánh mua; "5 tỷ 8"
cho cận trên 5,75 tỷ nên căn 5,8 tỷ bị lọc mất; "từ 5 đến 6 tỷ" cho CẬN DƯỚI
5,7 tỷ.

**Tầng DB** — RPC `mo_ho_so_nguoi_ban` (migration `20260901d`), gói `DO … raise
exception` cuộn lại, đối chiếu sau: 0 dòng `sellers` có `zalo_user_id` bắt đầu
bằng `test-fr159-`.

| ID | Ca | Chờ đợi | Kết quả |
|---|---|---|---|
| TS-VAI-01 | Zalo id lạ | Tạo đúng 1 dòng, có id, `seller_type = unknown` | 1 dòng, unknown ✅ |
| TS-VAI-02 | Gọi lần hai cùng id (gõ vụn / race) | CÙNG id, không 23505, vẫn 1 dòng | cùng id, 1 dòng ✅ |
| TS-VAI-03 | Người đã có tên gọi lại | Trả về đúng tên cũ, không xoá | `Chị D.` ✅ |
| TS-VAI-04 | Vai `anon` gọi | Chặn | chặn ✅ |
| TS-VAI-05 | Vai `authenticated` gọi | Chặn | chặn ✅ |
| TS-VAI-06 *(02/09)* | Mở với nhãn `nmg` | Dòng mới mang `nmg` | nmg ✅ |
| TS-VAI-07 *(02/09)* | Mở KHÔNG truyền nhãn | Mặc định `ccrb` — "có BĐS muốn bán = chính chủ" | ccrb ✅ |
| TS-VAI-08 *(02/09)* | Hồ sơ tạo tay còn `unknown`, gọi lại với `ccrb` | Được NÂNG thành `ccrb` | unknown → ccrb ✅ |
| TS-VAI-09 *(02/09)* | Nhãn đã có `ccrb`, gọi lại với `nmg` | KHÔNG ghi đè — lời tự xưng trong chat không lật nhãn admin đã gán | giữ ccrb ✅ |
| TS-VAI-10 *(02/09)* | Vai `anon` gọi chữ ký mới | Chặn | chặn ✅ |
| TS-VAI-11 *(02/09)* | Vai `authenticated` gọi chữ ký mới | Chặn | chặn ✅ |

| TS-VAI-12 *(02/09)* | Vai `anon` đọc `sellers` | 0 dòng | 0 ✅ |
| TS-VAI-13 *(02/09)* | Đăng nhập không phải admin đọc `sellers` | 0 dòng | 0 ✅ |
| TS-VAI-14 *(02/09)* | Đăng nhập không phải admin đọc `reminders` | 0 dòng | 0 ✅ |
| TS-VAI-15 *(02/09)* | Admin đọc `sellers` | Thấy đủ | 3 ✅ |
| TS-VAI-16 *(02/09)* | Admin đọc `reminders` đang chờ | Thấy | 93 ✅ |
| TS-VAI-17 *(02/09)* | Admin update `sellers.seller_type` | Được | 3 dòng ✅ |
| TS-VAI-18 *(02/09)* | Admin update `reminders.status` | Được | 93 dòng ✅ |

*(02/09/2026 — chữ ký hàm đổi thành `(zalo, nhãn default ccrb)` theo quyết định
"gán nhãn khi bóc tách"; TS-VAI-01…05 chạy lại trên chữ ký mới cùng ngày, kết
quả giữ nguyên. Cuộn lại sau kiểm: 0 dòng `test-fr159-%`.)*

**Chưa kiểm được ở đây** (cần bản deploy): trọn luồng người lạ → câu hỏi vai →
trả lời "tôi có căn nhà" → hồ sơ bán mở → câu rao tạo tin. Cách kiểm sau khi
deploy, bằng một Zalo chưa từng nhắn: (1) nhắn "chào em" → phải nhận đúng câu
hỏi vai, `buyers.preferences.hoi_vai = true`, KHÔNG có lượt gọi model
(`bot_usage.model_calls` không tăng); (2) nhắn "tôi có căn nhà ở P4 muốn bán"
→ `sellers` có dòng mới, trả lời mời gửi địa chỉ/giá/diện tích; (3) nhắn "bán
nhà P4 giá 5 tỷ 8 50m2" → tin `cho_thong_tin` tạo, câu hỏi nhỏ giọt đầu tiên.
Và một Zalo khác: nhắn "#BDS-Q5-0001" với một mã đang `cho_thong_tin` → bot
KHÔNG được nêu địa chỉ/giá.


---

### TS-E2E — chạy `chat-reply` THẬT trong Node, Supabase + model giả lập (02/09/2026)

Cách kiểm mới, khác hẳn hai tầng trước. Các file `bot/tests/*.mjs` chỉ chép
regex ra thử; còn đây là **bơm tin nhắn qua đúng handler thật**: `bun build`
đóng gói `chat-reply/index.ts` (Deno) thành một file Node, đổi specifier `npm:`
sang gói thật (`zod`, `@anthropic-ai/sdk/helpers/zod`) và gói GIẢ
(`mock-supabase.mjs` — DB trong bộ nhớ có query builder, embed, RPC;
`mock-anthropic.mjs` — model trả theo kịch bản, ghi lại mọi lượt gọi). Không
cần Deno, không đụng DB thật, chạy trong 1 giây.

```
cd bot/tests/e2e && bun install && ./chay.sh
```

Thứ nó bắt được mà đọc code không thấy (đều đã vá cùng ngày — FR-170 g…j):

| Kịch bản | Bản trước | Bản sau |
|---|---|---|
| Người lạ: "chào em" → "tôi có căn nhà ở phường 4" → "bán nhà P4 giá 5 tỷ 8 50m2" | tin tạo với **phường rỗng**, giá thô "5 tỷ 8 50m2", **diện tích bỏ qua** → hỏi lại "diện tích bao nhiêu?" | Phường 4, giá "5 tỷ 8", 50m2 vào fact, tin lên kệ ngay, không hỏi thêm |
| Chủ nhà đang bị hỏi pháp lý, nhắn "bán thêm căn nữa ở P5 giá 6 tỷ 60m2" | câu rao **ghi thành câu trả lời pháp lý**, không tin nào tạo | tin mới Phường 5, câu hỏi pháp lý vẫn treo |
| Chủ nhà đang bị hỏi giá, trả lời "giá bán nhà này 5 tỷ 9" | — | vẫn là câu trả lời, KHÔNG đẻ tin trùng |
| Người lạ "em là sale bên sàn giao dịch ABC" → "có căn nhà cần bán ở P6 giá 7 tỷ" | nhãn **chính chủ** (câu sau không nhắc "sale") | nhãn môi giới, nhớ từ tin đầu |
| Trả lời câu hỏi vai bằng "bán" / "có nhà" / "cho thuê" | xếp vào **hàng mua** | mở hồ sơ bán |

55 kịch bản, chia theo bốn vai (19 người lạ, 10 người bán, 5 người tìm nhà,
10 người đã nhắm căn, còn lại là các bất biến chéo: nhường lượt, model hỏng,
ảnh trần, mã từ web), gồm cả thông báo nhãn cho người bán + việc cho admin +
xin đổi nhãn (02/09). **55/55**, chạy bằng `bun`. Mỗi kịch bản khẳng định trên DB giả (dòng
`sellers`/`listings`/`viewings`/`deals` sinh ra) hoặc trên PROMPT thật gửi
model (khối KHO có/không có mã nào), chứ không chỉ trên câu trả lời.

**Giới hạn phải nhớ**: DB giả chép lại NGHĨA của các RPC/trigger (auto-publish
khi đủ giá+phường+diện tích, `listing_missing_facts`, `parse_vnd` rút gọn) chứ
không chạy SQL thật — RPC thật đổi hành vi thì bộ này không tự biết. Nó kiểm
LUỒNG trong `chat-reply`; tầng DB kiểm bằng TS-VAI/TS-TIEN/TS-CHUONG trên máy
thật như trước. Hai tầng bổ cho nhau, không thay nhau.

*(02/09/2026, sau FR-171: bộ này lên **65 kịch bản**, thêm 10 ca TS-TOIUU bên
dưới; sau FR-172 cùng ngày lên **67** với 2 ca TS-THONGSO. DB giả có thêm trigger đẩy `last_message_at`, RPC `tao_followup`, và
`ensure_buyer_conversation` trả 6 cột — đúng nghĩa các hàm thật ở `20260902d`.)*

---

### TS-TOIUU — đếm vòng đi về DB và bất biến tối ưu (FR-171, 02/09/2026)

Cùng bộ `bot/tests/e2e/`, nhưng đo thứ khác: mock Supabase ghi MỌI truy vấn /
RPC vào `db().log`, nên mỗi kịch bản đếm được "một tin tốn bao nhiêu vòng".
Ngưỡng đặt bằng số đo SAU khi sửa — đây là chốt chống hồi quy, ai thêm một
truy vấn vào đường nóng là đỏ ngay, phải giải thích.

```
cd bot/tests/e2e && bun install && ./chay.sh      # 67/67, có 10 ca TOIUU + 2 ca THONGSO
```

| ID | Kịch bản | Bất biến | Trước (v43) | Sau (v44) |
|---|---|---|---|---|
| TS-TOIUU-01 | Người lạ nhắn câu mập mờ → bot hỏi vai | ≤ 11 truy vấn, **0** lượt model | 18 | 11 ✅ |
| TS-TOIUU-02 | Người mua lượt đầu (chưa hồ sơ) | ≤ 17 truy vấn | 20 | 17 ✅ |
| TS-TOIUU-03 | Người mua đã có hồ sơ, hỏi tiếp | ≤ 16 truy vấn | 24 | 16 ✅ |
| TS-TOIUU-04 | Khách hỏi một căn rồi im | follow-up đi qua RPC `tao_followup`, có dòng `reminders` kind `followup`; không đếm/tra/chèn tay | 3 vòng | 1 RPC ✅ |
| TS-TOIUU-05 | Ba lượt liên tiếp trong 60 s | `bot_prompts` đọc ≤ 1 lần (nhớ tạm module) | 3 | 1 ✅ |
| TS-TOIUU-06 | Bot trả 2–3 bong bóng | vào sổ `messages` bằng MỘT câu INSERT mảng | n câu | 1 ✅ |
| TS-TOIUU-07 | Người bán trả lời câu hỏi đang chờ | ≤ 15 truy vấn, `role = seller` | 21 | 15 ✅ |
| TS-TOIUU-08 | Mọi kịch bản | không còn UPDATE `conversations` chỉ để ghi `last_message_at` | có | không ✅ |
| TS-TOIUU-09 | Mọi kịch bản | hội thoại nào có tin thì `last_message_at` đã được trigger (giả) đẩy | — | ✅ |
| TS-TOIUU-10 | Người mua lượt đầu, chưa đủ khu vực + giá | KHÔNG `select listings` (không lọc kho vô nghĩa) | có | không ✅ |

Ba ca 01/03/07 là số đo chính của FR-171 h; 05/06/08/10 là bất biến giữ cho
những sửa đổi đó không bị "sửa lại cho gọn" rồi mất. Ca 09 kiểm chính mock —
nếu ai đổi trigger thật ở DB mà quên mock thì 08/09 vẫn xanh giả, xem giới hạn
ở TS-E2E.

**Kiểm ngoài e2e cùng ngày** (DB thật, MCP): `log_loi` sau khi đổi vẫn chặn
đúng ở 20 dòng/nguồn/giờ; `media_cleanup_tick` với một dòng `loi` chờ giờ thì
KHÔNG gọi HTTP; `cron.job` hiện đúng ba lịch mới; `ensure_buyer_conversation`
chỉ `service_role` gọi được (revoke đã kiểm). Tám function deploy xong đều kéo
ngược bằng `get_edge_function` và trùng byte với bundle sau khi chuẩn hoá
`\uXXXX` — cách làm ở `bot/README.md` §02/09.

**Đo cách build** (cùng máy, xoá cache trước): `bun install` 4,4 s, `npm
install` 20,1 s; `next build` sạch ~34 s và có cache ~25 s ở CẢ HAI — bun chỉ
nhanh ở khâu cài gói, khâu build là Next tự chạy. Repo đã là bun (`bun.lock`).

---

### TS-HOICHU — khách hỏi → báo admin + hỏi chủ → chủ trả lời → báo lại khách (FR-140 b/c, 02/09/2026)

Chạy trên DB thật trong một giao dịch rồi rollback (tin, chủ, khách đều là dòng
thử): chủ có Zalo, khách gửi `info_requests` nguồn `buyer_ask` "hẻm có xe hơi vô
được không", rồi chủ trả lời "Hẻm 5m, xe 7 chỗ vô tới cửa".

| ID | Bước | Kỳ vọng | Kết quả |
|---|---|---|---|
| TS-HOICHU-01 | Chèn câu hỏi `buyer_ask`, tin có chủ trên Zalo | HAI dòng `reminders` kind `escalation`: một gắn `seller_id` (đi tới chủ nhà, lời "khách đang quan tâm căn … cần bổ sung"), một KHÔNG gắn ai (đi đường admin, lời "❓ Khách hỏi căn #…: '…' — bot đã nhắn chủ nhà hỏi") | đúng 2 dòng ✅ |
| TS-HOICHU-02 | `info_requests` chuyển `answered` | thêm một dòng `followup` gắn `buyer_id`, ghi chú bắt đầu "chủ nhà vừa trả lời câu khách hỏi về #… — '…': Hẻm 5m…"; nhắc im lặng đang treo cùng căn bị huỷ | ✅ |
| TS-HOICHU-03 | `assignee` sau định tuyến | `seller` (chủ có Zalo); nguồn giữ `buyer_ask` | ✅ |

*(03/09/2026 — FR-173 thay đường đi của `buyer_ask`: TS-HOICHU-01 và -03 không còn
đúng với bản đang chạy — câu khách hỏi giao CTV, admin không bị báo mỗi câu. Bản
mới kiểm ở TS-CTV bên dưới; TS-HOICHU-02 (chủ/CTV trả lời → báo lại khách) vẫn đúng.)*

### TS-CTV — câu khách hỏi về CTV; CTV chậm → admin đỡ khách; hạng CTV (FR-173, 03/09/2026)

Chạy trên DB thật trong `begin … rollback` (migration `20260903a`); phần chat-reply
chạy e2e trên mock (`bot/tests/e2e`, ca CTV-01…04, bộ lên **71 kịch bản**).
Chạy lại lần 2 ngày 03/09 sau khi deploy (khối `do … raise exception` để rollback,
10 bước): định tuyến + hạn 120', nhắc CTV không nhắc admin, drip đi chủ, tick quá
hạn một lần duy nhất, `nguoi_noi_bo`, fact nguồn `ctv`, `followup` cho khách,
`ctv_ranks` theo vai — đều đạt. Advisor Supabase sau đó: `20260903b` khoá hai
hàm khỏi REST; `ctv_ranks` vẫn bị báo "security definer view" — cố ý, xem `09`.

| ID | Bước | Kỳ vọng | Kết quả 03/09 |
|---|---|---|---|
| TS-CTV-01 | Chèn `info_requests` nguồn `buyer_ask` cho tin có chủ trên Zalo, có một CTV `active` | `assignee = ctv`, `ctv_id` gán, `sla_due_at = now() + 120 phút`; KHÔNG giao chủ nhà dù chủ có Zalo | `ctv ctv=true hạn=120 phút` ✅ |
| TS-CTV-02 | Dòng nhắc sinh ra | MỘT dòng `escalation` gắn `ctv_id`, lời "khách hỏi #…: '…'. Anh/chị hỏi chủ rồi nhắn lại em theo mẫu `#mã: câu trả lời` trong 120 phút"; **0** dòng đi đường admin | 1 dòng CTV, 0 dòng admin ✅ |
| TS-CTV-03 | Lùi `sla_due_at` về quá khứ, gọi `info_request_sla_tick()` hai lần | Lần 1 trả 1, sinh MỘT dòng admin "⏰ CTV … chưa trả lời câu khách hỏi #… sau 120 phút. Admin đỡ khách giúp…", `sla_missed_at` được đánh dấu; lần 2 trả 0 (không báo lại) | 1 → dòng admin ✅ → đánh dấu ✅ → lần 2 = 0 ✅ |
| TS-CTV-04 | `nguoi_noi_bo('<zalo CTV>')` / `nguoi_noi_bo('nguoi-la')` | (`ctv`, tên) / 0 dòng | ✅ / 0 ✅ |
| TS-CTV-05 | `ghi_fact_listing(…, 'ctv')` rồi `info_requests → answered` | `listing_facts.source = ctv`, `bac_nguon('ctv') = 2`; trigger FR-140 c sinh `followup` gắn `buyer_id` ghi chú "chủ nhà vừa trả lời…" | ctv=2 ✅; followup ✅ |
| TS-CTV-06 | View `ctv_ranks` (đọc với `request.jwt.claims` role `service_role`): 4 câu 30 ngày, 3 trả lời đúng hạn, 1 trễ | `tong=4 tra_loi=3 dung_han=3 tre=1 ty_le=0.75 rank=bac`; đọc bằng vai `postgres` không có jwt → 0 dòng (view khoá) | ✅ (0 dòng khi không jwt: ✅) |

### TS-DIABAN — địa bàn mở: quận/huyện từ câu rao, không ghi cứng Quận 5 (FR-174 đợt 1, 03/09/2026)

Ba ca e2e thêm vào `bot/tests/e2e` (bộ lên **74 kịch bản**, chạy bằng `chay.sh` —
script tự đóng gói lại từ nguồn; chạy `run.mjs` trực tiếp là chạy trên bundle
cũ, bài học 03/09); ca DB thật chạy trong `do … raise` để rollback.

| ID | Bước | Kỳ vọng | Kết quả 03/09 |
|---|---|---|---|
| TS-DIABAN-01 | e2e DIABAN-01: chính chủ rao "bán nhà Bến Lức Long An 2 tỷ 80m2" | tin `district = "Bến Lức, Long An"` | ✅ |
| TS-DIABAN-02 | e2e DIABAN-02: "bán nhà P4 giá 5 tỷ 8 50m2" (không nói quận) | `district = "Quận 5"` (mặc định cụm khởi điểm), `ward = Phường 4` | ✅ |
| TS-DIABAN-03 | e2e DIABAN-03: "bán nhà Tân Bình hẻm 6m 6 tỷ 60m2" | `district = "Quận Tân Bình"` | ✅ |
| TS-DIABAN-04 | `admin_dang_tin` (`20260903d`) với `district = "Đức Hoà, Long An"` và không có `district` — DB thật, `do … raise` rollback, JWT admin giả | tin ghi "Đức Hoà, Long An" / mặc định "Quận 5" | ✅ |
| e2e CTV-01 | CTV (`ctvs.zalo_user_id`) nhắn "#BDS-Q5-0001: chủ nói còn bán, sổ hồng riêng" | câu `buyer_ask` đang chờ → `answered` với đúng câu trả lời; `listing_facts` có dòng nguồn `ctv` | ✅ |
| e2e CTV-02 | Cùng lượt | bot trả câu mẫu "…em báo lại khách hỏi #… liền", `noi_bo = ctv`, **0** lượt model | ✅ |
| e2e CTV-03 | CTV nhắn mã tin không có trong kho | "Em không thấy tin #… trong kho ạ", không ghi fact | ✅ |
| e2e CTV-04 | Người LẠ nhắn "#BDS-Q5-0001 còn không em" | tra `nguoi_noi_bo` đúng một lượt rồi đi nhánh mua (không `noi_bo`, không fact) | ✅ |

Chưa kiểm trên Zalo thật: `nudge` v23 soạn tin báo lại khách từ ghi chú đó —
prompt riêng, chờ đợt nhắn thật. Từ 03/09/2026 câu `buyer_ask` luôn giao CTV
(không có CTV → admin); admin chỉ được báo khi quá hạn `sla_due_at` (TS-CTV-03).

---

### TS-THONGSO — tin rao có cấu trúc: bóc từ mô tả, cột đã có thì không hỏi (FR-172, 02/09/2026)

Chạy trên DB thật qua MCP ngay sau `20260902e` + `20260902f`, trên đúng 173 tin
đang có (164 tin có mô tả). Ca 01–08 là số đo bao phủ (chốt chống hồi quy khi
sửa regex — giảm là phải giải thích), 09–12 là hành vi.

| ID | Kịch bản | Kỳ vọng | Kết quả |
|---|---|---|---|
| TS-THONGSO-01 | Ngang × dài từ "4x16m", "4m x 15m", "3m6 x 16", "ngang 4.6m dài 13.2m", "3.8m dài 24m", "4*15" | ≥ 115/164 có `frontage_m` | ngang 121, dài 118, nở hậu 11 ✅ |
| TS-THONGSO-02 | Số tầng từ "1 trệt 3 lầu" (=4), "5 tầng", "x 3T", "Tổng số tầng: 4", "trệt, lầu" (=2), "nhà C4" (=1); chung cư "tầng 25" → `floor`, KHÔNG phải `floors` | ≥ 135/164; 2 chung cư có `floor` | tầng 141, `floor` 2 ✅ |
| TS-THONGSO-03 | Đường vào: "mặt tiền"/"MT"/"2MT"/"có vỉa hè" → mặt tiền; "HXH"/"hẻm xe hơi"/"xe hơi vô" → hẻm xe hơi; "HXT"/"xe tải" → hẻm xe tải; "nhà hẻm … cách mặt tiền 20m" → HẺM (không phải mặt tiền); "hẻm hông 6m" không tính | ≥ 120/164 | 126: MT 53, HXH 42, HXT 9, xe máy 2, hẻm chưa rõ cỡ 20 ✅ |
| TS-THONGSO-04 | Hẻm rộng "hẻm 4m", "HXH 5.5m", "đường rộng 8m"; cách MT "cách mặt tiền 40m", "cách 50m ra mặt tiền" | số hợp lý (1–40 m / 5–500 m) | hẻm rộng 25, cách MT 19 ✅ |
| TS-THONGSO-05 | Pháp lý "sổ hồng riêng/SHR" → `so_hong_rieng`; "sổ hồng/sổ đỏ/sổ chính chủ" → `so_hong`; "sổ chung" → `so_hong_chung`; "hoàn công" / "chưa hoàn công" → bool; "pháp lý rõ ràng" trơ → KHÔNG đoán | ≥ 70/164 | pháp lý 75, hoàn công 37, quy hoạch 6 ✅ |
| TS-THONGSO-06 | PN/WC "4PN 5WC", "3 phòng ngủ 4 nhà vệ sinh", "Số phòng ngủ: 4 Số phòng vệ sinh: 5" | PN không ghi đè giá trị đã có (79 giữ nguyên), WC ≥ 60 | PN 81 (+2 mới, 0 lệch), WC 63 ✅ |
| TS-THONGSO-07 | Tiện ích/khác: thang máy, xe hơi vô nhà, căn góc/2MT, nội thất, năm xây ("xây từ giữa năm 2020"), hướng (chỉ chữ la bàn sau "hướng"), TL, "đang cho thuê 20 triệu/tháng" (chỉ tin bán) | có, không bịa | thang máy 10, xe hơi 6, góc 21, nội thất 25, năm 4, hướng 7, TL 52, thuê 17 ✅ |
| TS-THONGSO-08 | `street` từ `location_raw`: "Số 1xx, Đường Trần Hưng Đạo, …" → "Trần Hưng Đạo"; "Hẻm xx/, Đường Hồ Thành Biên" → "Hồ Thành Biên" (`20260902f`); "Dự án Tản Đà Court, Đường Tản Đà" → "Tản Đà"; "Phường 2, Quận 5" → null | mọi tin có tên đường trong địa chỉ | 159/164 tin có `location_raw` (5 tin địa chỉ chỉ ghi phường → null, đúng) ✅ |
| TS-THONGSO-09 | `listing_missing_facts` sau backfill | giảm rõ, KHÔNG về 0 (hướng/quy hoạch/năm xây mô tả ít nói) | 1.140 → 638; ba câu kết cấu/pháp lý/hẻm 447 → 142; còn nhiều nhất: hướng 152, quy hoạch 139, năm xây 137 ✅ |
| TS-THONGSO-10 | `price_per_m2_vnd` sinh cho mọi tin có giá + diện tích; tin thuê tính theo tháng | 164/164 | ✅ (tin thuê 70 tr/64m² → 1,1 tr/m²/tháng) |
| TS-THONGSO-11 | e2e THONGSO-01: căn có thông số → dòng KHO gửi model là "4x12.5m · trệt + 2 lầu · 3WC · hẻm xe hơi 6m · sổ hồng riêng, hoàn công" | khớp regex | ✅ (67/67) |
| TS-THONGSO-12 | e2e THONGSO-02: khách gõ mã căn → khối "căn khách đang nhắc" cũng mang thông số | có "hẻm xe hơi 6m" + "sổ hồng riêng" | ✅ |
| TS-THONGSO-13 | **Bậc nguồn khi fact chủ nhà chảy vào cột** (`20260902g`, thêm sau soát truy vết). Tin thử mô tả "hẻm xe hơi 5m, 1 trệt 2 lầu, 3PN 2WC, sổ hồng riêng" → bóc ra `boc_mo_ta`; (1) chủ nhà trả lời `ket_cau` "trệt 3 lầu, 4 toilet"; (2) admin đặt `alley_width_m = 4`, `specs_source = admin`, rồi chủ nhà nói "hẻm 6m xe tải vô được"; (3) fact nguồn `admin_form` "hẻm 3m" sau đó; (4) view thiếu | (0) floors 3, WC 2, hẻm 5 HXH, SHR, `boc_mo_ta`; (1) floors 4, WC 4, `chu_xac_nhan` — chủ nhà đè bóc mô tả; (2) hẻm 6 → `hem_xe_tai` — chủ nhà đè admin (FR-164 a); (3) vẫn 6 — admin KHÔNG đè chủ nhà; (4) 0 câu thiếu trong kết cấu/hẻm/pháp lý | đúng cả 4 ✅ — chạy trên DB thật trong một giao dịch rồi rollback, kho vẫn 173 tin |
| TS-THONGSO-14 | **Bộ 20 câu mẫu qua `boc_thong_so()`** (03/09/2026, soát sau FR-173): "4x15, 1 trệt 2 lầu sân thượng, hẻm xe hơi 6m, sổ hồng riêng, hoàn công"; "hẻm 2m xe máy, giấy tay, không quy hoạch"; "cách mặt tiền 30m, đang cho thuê 25tr/tháng, TL"; "hầm trệt lửng 4 lầu, thang máy"; "nhà 4 tấm", "2 tấm rưỡi", "3 tấm đúc"; "60 m 2, hẻm 2.5m"; "mặt tiền 5m, 60m², nở hậu 5.5"; "hẻm 2 xẹt, xe máy vào"; chung cư "tầng 5 lầu" → `floor`; "khu vực được xây 3 tấm" + cấp 4 → 1 tầng | mọi khoá đúng, không bịa | lần 1: 4 lỗi (hẻm 2m mất đường vào; ngang 30 m; `p_type` NULL → nhánh chung cư; tấm chưa hiểu) → vá `20260903c` → lần 2 ✅ 20/20; kho 0 tin dính 3 lỗi đầu, BDS-Q5-0135 ("cấp 4, được xây 3 tấm") vẫn 1 tầng ✅ |
| TS-THONGSO-15 | **Fact `question` chữ tự do → cột** (`ap_thong_so`, 03/09): tin trống pháp lý/hẻm/PN, `specs_source = boc_mo_ta`; (A) CTV trả lời "pháp lý" → "sổ hồng riêng, hoàn công đầy đủ"; (B) "hẻm mấy mét" → "hẻm 4m xe hơi vào được"; (C) chủ nhà `so_phong_ngu` "3"; (D) CTV `bo_sung` "sổ hồng chung, 5PN" SAU chủ; (E) chủ nhà "sổ hồng chung"; (F) "còn bán, chủ nói bớt được chút" | (A) `so_hong_rieng` + hoàn công, bậc admin; (B) hẻm 4 + `hem_xe_hoi`; (C) 3 PN, bậc chu_xac_nhan; (D) KHÔNG đè (giữ riêng, giữ 3); (E) đè được → chung; (F) không đụng cột | đúng cả 6 ✅ — DB thật, `do … raise` để rollback |

**Giới hạn nhìn thấy khi soi tay** (đều ghi lại, chưa vá vì hiếm): "Diện tích
306m² (4,2mx22m), 4 tầng" — 306 là tổng sàn, `area_m2` của tin vốn đã ghi 306
từ Excel, regex không phân xử được (6 tin có ngang×dài lệch `area_m2` > 35%,
xem `dt_lech`); "nhà cách mặt tiền 40m" đôi khi đi cùng "nhà mặt tiền" trong
cùng bài — luật "nhà hẻm thắng" chỉ áp khi câu mở đầu nói hẻm; `property_type`
đoán sai (chung cư gán `nha_pho`) thì "tầng 25" bị đọc thành 25 tầng — bị chặn
bởi dải 1–30 nên ra null, không ra sai.

**Bài học từ soát truy vết cùng ngày**: bản đầu `20260902e` viết "đè khi
`specs_source = boc_mo_ta`" — nghe hợp lý, nhưng ngược hai luật đã có: chủ nhà
không đè được số admin nhập (FR-164 a) và câu trả lời lần 2 của chính chủ nhà
không đè lần 1 (FR-163 a). Agent soát bắt bằng cách đọc mã cạnh FR, không phải
bằng test — vì `listing_facts` thật đang rỗng nên không ca nào chạy qua hàm đó.
TS-THONGSO-13 sinh ra để lấp đúng lỗ này.
