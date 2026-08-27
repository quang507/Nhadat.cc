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
| Database | RLS: anon chỉ đọc listing active + media public; unique (project_id, unit_code); enum unit_status/status không nhận giá trị lạ; last_confirmed_at cập nhật đúng | SRS-3.9, FR-107, FR-113 |
| Webhook Zalo | Trả 200 < 1s; xử lý bất đồng bộ; chữ ký sai → từ chối; retry không tạo tin nhắn đôi | SRS-4.4 |
| Hàng đợi | Chaos test: tắt worker 10 phút → 0 tin mất sau khôi phục | NFR-04, OPEN-11 |
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

Bảng NFR-01…16 với cách đo đã nằm ở `docs/07 §6` — giữ đó làm nguồn sự thật.
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

## 10.7 Bộ test chạy tay — bản chạy được ngay (26/08/2026)

Hai suite dưới đây là **lệnh dán vào chạy được**, không phải mô tả. Sinh ra từ
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
| TS-SPECS-02 | Chèn tiếp `('so_phong_ngu','9 phòng')` cho chính tin đó | Vẫn **3** — chỉ ghi khi cột trống, không đè lên số đã có |
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
