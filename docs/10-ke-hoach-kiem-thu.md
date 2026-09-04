# 10 — Kế hoạch kiểm thử

Nền có sẵn: 13 kịch bản nghiệm thu AC-01…13 (`docs/07 §7`) và bảng kiểm chứng NFR
(`docs/07 §6`). File này là kế hoạch 4 tầng (§10.1–10.6), bộ test chạy tay đang
sống kèm kết quả mới nhất (§10.7) và nghiệm thu theo tài liệu 04/09/2026 (§10.8).
Nguyên tắc: công cụ **free-tier trước** (NFR-16); mọi test case truy về FR/AC/NFR.

## 10.1 Kiểm thử chức năng

Suite theo nhóm FR. Dữ liệu mẫu: 24 kịch bản chat trong `chats w B.docx` (đã ẩn
danh) — không bịa thêm. Mỗi AC ≥ 1 test E2E; NLU (FR-09/22/23/92) kiểm bằng bảng
quyết định câu vào → trường ra, bắt buộc chạy lại trước khi đổi model/prompt.

| Suite | Phạm vi | Trọng tâm | Ca chạy được (§10.7) |
|---|---|---|---|
| TS-WEB | FR-01…17 | search parse đúng taxonomy §4.6 · trang tag không 404 · deep-link Zalo mang ngữ cảnh (AC-01) | TS-WEB2, TS-SEO, TS-CACHE |
| TS-BOT | FR-20…32 | 4 bất biến I1–I4 (SRS-5.1) chặn release: ≤3 listing/tin · kết thúc bằng câu hỏi · không khẳng định điều chưa xác minh · không hỏi SĐT sai chỗ | TS-CHATREPLY, TS-E2E, TS-V48, TS-VAI |
| TS-ASK | FR-40…47, FR-110 | hỏi kho trước, hỏi S sau · idempotency · timeout 24h/48h · AC-03 | TS-HOICHU, TS-CTV, TS-IDEM, TS-IDEM2 |
| TS-VIEW | FR-50…57 | từ chối cho SĐT vẫn đặt được lịch (AC-04) · email [VIEWING] | TS-MATCH-06, TS-GIUCHAN-01 |
| TS-RET | FR-60…65 | mốc 5 ngày / ≥6 ngày giữ kết nối · nội dung xoay vòng không lặp (AC-06) | TS-GIUCHAN, TS-V48 |
| TS-ADM | FR-70…81 | 20 mục/trang · 4 loại email đúng subject/body (AC-09/10) | TS-ADM2, TS-DANGTIN |
| TS-SEL | FR-90…103, FR-109 | bóc ≥4 trường (AC-07) · rao từng bước trong Zalo · không spam S | TS-MA, TS-KD, TS-NEO, TS-OUNG, TS-THONGSO |
| TS-BROKER | FR-104…112 | ẩn danh hai chiều (lọc SĐT/Zalo/địa chỉ trong relay) · vòng đời listing · sold → báo interests | TS-SEC-10, TS-V48, TS-GIUCHAN |
| TS-PROJECT | FR-113…117 | AC-13: căn theo unit_status · câu tầng dự án không sinh info_request · unique (project_id, unit_code) | TS-V48 |

## 10.2 Kiểm thử kỹ thuật

| Mục | Kiểm gì | Tham chiếu | Ca chạy được |
|---|---|---|---|
| API contract | schema SRS-4.x; request_id trùng → trả kết quả cũ, không nhân đôi; mã 404/409 | FR-41/43 | TS-WEB2 (S), TS-IDEM |
| Database | RLS: anon chỉ đọc tin lên kệ + media công khai của tin đó; unique/enum/CHECK; trigger toàn vẹn | SRS-3.9, FR-107/113/163/167 | TS-SEC, TS-SEC2, TS-TOANVEN |
| Webhook Zalo | 200 < 1s; bất đồng bộ; chữ ký sai → từ chối (chưa hiệu lực: thiếu ZALO_APP_SECRET, OPEN-33); retry không tin đôi | SRS-4.4 | TS-IDEM2 |
| Hàng đợi | worker sập / hết lượt thử → 0 tin mất (dựng cảnh sập bằng tay, không giết được instance Edge Function) | NFR-04, FR-166 | TS-JOB |
| Kho file | signed URL ≤15 phút; bucket riêng không đọc thẳng; adapter đổi backend không đụng bot | NFR-06, FR-111/165 | TS-KHO, TS-WEB2 (P) |
| Migration | chạy được trên project trống + có dữ liệu; không phá dữ liệu cũ | — | TS-SEC sau mỗi migration |
| Còi báo lỗi | lỗi HTTP lẫn lỗi trả 200 đều vào sổ | FR-152, FR-168 | TS-HEALTH, TS-LOG, TS-CHUONG |

## 10.3 Kiểm thử giao diện & trải nghiệm

| Bài | Kiểm gì | Công cụ |
|---|---|---|
| Đối chiếu thiết kế | từng màn so canvas/Figma; token `design/tokens.json` — sai token là lỗi, không phải "gần đúng" | soi tay |
| Responsive | 375/768/1440px; bảng rộng cuộn trong container, body không cuộn ngang; sticky CTA Zalo mobile | Playwright |
| Tone giọng chat | 7 quy tắc + mục Cấm (`docs/06 §6.8`) trên 50 hội thoại: đếm câu hỏi/lượt, tin kết thúc "?", từ cấm | script đếm trên log |
| Accessibility | tương phản ≥4.5:1, vùng chạm ≥44px, focus ring, alt ảnh | axe-core + duyệt tay (persona P3) |
| Trạng thái | ma trận loading/rỗng/lỗi cuối `docs/05`, mỗi ô một test; "0 kết quả" nói rõ đã nới gì | Playwright |
| Hiệu năng cảm nhận | Lighthouse mobile ≥ 90, LCP < 2,5s/4G (NFR-02) | Lighthouse CI |

## 10.4 Kiểm thử phi chức năng

Bảng NFR-01…18 với cách đo nằm ở `docs/07 §6` (nguồn sự thật). Bài chuyên sâu:

| Bài | Nội dung | Công cụ |
|---|---|---|
| Tải | 50 tin đồng thời p95 < 3s (NFR-01); seed 5.000 listing + 300 hội thoại không suy giảm (NFR-05) | k6/script |
| Bảo mật | pen-test 3 hướng: prompt-injection dụ bot lộ SĐT (FR-104); đoán URL `/ds/token` + signed URL; RLS bypass qua PostgREST | tay + TS-SEC2 |
| Riêng tư | 100 hội thoại: 0 lần hỏi SĐT ngoài viewing (NFR-07); dữ liệu B không rời hệ thống | rà log |
| SEO | 100 URL tag index, 0 lỗi structured data (NFR-09) | Search Console |
| Chi phí | mỗi tuần đối chiếu usage Supabase/Vercel/AI với ngưỡng free (NFR-16); vượt dự báo là finding | dashboard + `/admin` |

## 10.5 Môi trường & công cụ (free-tier)

- Unit: Vitest · E2E web: Playwright · A11y: axe-core · Perf: Lighthouse CI · bot: `bot/tests/e2e` (mock Supabase + mock model, Node/Bun).
- CI: GitHub Actions free — lint + unit mỗi PR, E2E nightly; Vercel preview mỗi PR. Tầng TypeScript của bot hiện chưa có test chạy trong CI (gọi tay).
- DB: `nhadat-cc` là môi trường chính, **không** chạy test phá hoại; ca ghi bọc `do … raise exception` để cuộn lại. Zalo: OA thật chế độ ẩn + acc test (OPEN-09).
- Bí mật chỉ trong biến môi trường / Vault; khoá đã dán vào chat phải rotate.

## 10.6 Lịch chạy theo giai đoạn phát hành (SRS §8)

| Phase | Suite bắt buộc xanh để thoát phase |
|---|---|
| P0 Nền | TS-SEL, Migration, Database, Bí mật |
| P1 Nguồn hàng | TS-WEB, UI/UX, SEO, Lighthouse |
| P2 Chat | TS-BOT (I1–I4 chặn), TS-ASK, TS-PROJECT, Webhook, Tone giọng |
| P3 Giao dịch | TS-VIEW, TS-ADM, TS-BROKER, pen-test ẩn danh |
| P4 Giữ chân | TS-RET, Tải, Riêng tư, Chi phí |

Bug tìm thấy sau release phải có test tái hiện trước khi sửa — suite chỉ phình, không teo.

## 10.7 Bộ test chạy tay (cập nhật 04/09/2026)

Lệnh dán vào chạy được, không phải mô tả. ID bất biến. Cột cuối là kết quả **mới
nhất** (dd/mm); ⏭ = chưa chạy lại được trong sandbox (cần deploy/bridge/trình
duyệt). Ca ghi trên DB thật bọc `do … raise exception` hoặc `begin … rollback`;
bí mật lấy bằng `get_secret()` ngay trong SQL, không in ra. Bộ tự động:
`cd bot/tests/e2e && bun install && bash chay.sh` (102 kịch bản, 04/09) và
`node bot/tests/fr159-bon-vai.mjs` / `fr161-go-lan-dau.mjs` / `fr164-loi-sua-va-cau-hoi-treo.mjs`
(65 / 9 / 8) — các file `.mjs` chép regex từ `chat-reply`, sửa regex phải sửa test.

### TS-SEC — hồi quy bảo mật (chạy sau MỌI migration đụng RLS/GRANT)
SQL Editor, `set role anon` rồi thử phá — anon key là key công khai, repo private không làm nó bí mật. Script: `bot/supabase/migrations/20260826c_soat_bao_mat.sql` khối `-- KIỂM CHỨNG`.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-SEC-01 | anon `select count(*) from reminders` | `0` | ✅ 04/09 |
| TS-SEC-02 | anon `delete from reminders` | lỗi quyền | ✅ 04/09 |
| TS-SEC-03 | anon đọc `public_listings` | lỗi quyền — view không lọc trạng thái, hở là lộ tin nháp | ✅ 04/09 |
| TS-SEC-04 | anon gọi `seller_drip_tick()`, `ctv_report_tick()` | lỗi quyền | ✅ 04/09 |
| TS-SEC-05 | anon `insert listings` · `update bot_prompts` | lỗi quyền cả hai | ✅ 04/09 |
| TS-SEC-06 | anon đếm sellers/ctvs/messages/conversations/viewings/deals | `0` hết | ✅ 04/09 |
| TS-SEC-07 | anon `count(*) from listings` | = `dang_ban + dang_quan_tam + da_chot`, nhỏ hơn tổng — tin `cho_thong_tin` khuất | ✅ 04/09 |
| TS-SEC-08 | anon đọc `listings`, `agents_public`, `listing_photos_v`, `projects`, `listing_facts` | ra dữ liệu bình thường; `agents_public` = số NMG trong `sellers` | ✅ 04/09 (vá 20260904b, anon 3/3) |
| TS-SEC-09 | `proacl` của `get_secret` trong `pg_proc` | chỉ `postgres` + `service_role` | ✅ 04/09 |
| TS-SEC-10 | mở `/nha-dat/<mã>` của tin có fact chứa SĐT | SĐT → `[liên hệ qua Zalo nhadat.cc]` ở cả `description` lẫn `answer` (FR-104) | ⏭ cần bản deploy |

### TS-LIVE — thông tuyến thật qua Zalo (chạy khi bật bridge)
Điều kiện: `node bot/bridge-zca/index.mjs` chạy, không còn `pumpEscalations: fetch failed`. Chạy trên project thật nên sau mỗi vòng xoá `listings` `CCRB-*`, `sellers`/`ctvs` test, `reminders` liên quan.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-LIVE-01 | `curl` POST `/functions/v1/escalation-feed` với anon key | 200 — không 200 thì các bài dưới vô nghĩa | ⏭ bridge im từ 27/08 |
| TS-LIVE-02 | acc khác nhắn: `chào em, anh tìm nhà quận 5 tầm 5 tỷ` | trả trong vài giây, gợi ý căn khớp ngân sách, không xổ ngẫu nhiên | ⏭ |
| TS-LIVE-03 | `căn BDS-Q5-0133 còn không em` | chào đúng căn (P16 · 4,8 tỷ · 57.4m²), không bịa tình trạng | ⏭ |
| TS-LIVE-04 | `gửi anh xem hình căn đó với` | căn chưa có ảnh → "để em hỏi lại chủ nhà", không bịa có hình | ⏭ |
| TS-LIVE-05 | `cho anh gặp người thật đi` | `needs_human = true` + 1 `reminders` kind `escalation` gán CTV | ⏭ |
| TS-LIVE-06 | điền `ctvs.phone`, chờ ≤60s | bridge resolve SĐT → uid, nhắn CTV, ghi ngược `ctvs.zalo_user_id` (FR-150) | ⏭ |
| TS-LIVE-07 | acc đã gán `sellers.zalo_user_id` nhắn `Bán nhà hẻm xe hơi phường 8, DT đất 4x16, 1 trệt 2 lầu, giá 8.5 tỷ` | tin `cho_thong_tin`, `property_type = nha_pho`, `price_raw = "8.5 tỷ"`, câu hỏi đầu là diện tích đất | ⏭ |
| TS-LIVE-08 | trả lời câu diện tích | fact lưu; đủ giá + DT + phường → tin nhảy `dang_ban`, bot báo "đã lên web" | ⏭ |
| TS-LIVE-09 | tin không đoán được loại, trả `hông biết nữa` | hỏi lại kèm lựa chọn, không ghi fact `loai_bds` | ⏭ |
| TS-LIVE-10 | người thật gõ tay từ acc clone | bot im 30 phút (FR-141), hạ `needs_human`, huỷ escalation chờ | ⏭ |

### TS-RENT — hồi quy luồng CHO THUÊ (chạy sau MỌI lần sửa `chat-reply`)
Hai lỗi SRS-3.8a từng làm luồng thuê chết im lặng (bot vẫn trả lời tử tế). Dọn sau khi chạy: xoá `listings` `CCRB-*` vừa sinh.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-RENT-01 | acc đã gán `sellers.zalo_user_id`: `cho thuê nhà mặt tiền phường 11, 60m2, giá 25 triệu/tháng` | tin được tạo; `deal='cho_thue'`, `property_type='nha_pho'`, `price_raw="25 triệu/tháng"`, `price_vnd=25000000` | ✅ 04/09 |
| TS-RENT-02 | acc khách: `anh muốn thuê nhà quận 5 tầm 20 triệu` | `buyers.preferences.deal="thue"`; gợi ý căn cho thuê, không xổ căn bán | ✅ 04/09 |
| TS-RENT-03 | `count(*) from listings where deal='cho_thue' and status in ('dang_ban','dang_quan_tam')` | > 0 và trùng số căn bot gợi ý | ✅ 04/09 |
| TS-RENT-04 | `cho anh hỏi đóng thuế nhà đất ở đâu` | không bị hiểu thành nhu cầu thuê — `preferences.deal` không đổi | ✅ 04/09 |
| TS-RENT-05 | log function sau TS-RENT-01 | không có `invalid input value for enum listing_deal` | ✅ 04/09 |

### TS-CHATREPLY — bộ kiểm sau MỌI lần deploy `chat-reply`
Bắt buộc khi deploy qua MCP (chép tay: mỗi `\` phải nhân đôi, `chat-reply` có 123 dấu; sót một cái là bóc sai mà vẫn biên dịch). Gọi `net.http_post` kèm `x-bridge-secret` từ Vault. Dọn: `sellers.zalo_user_id` về NULL, xoá tin `CCRB-*` + info_requests/facts/reminders, buyer `ZZTEST-*`, `bot_errors`, đẩy `bot_health.last_id`.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-CHATREPLY-01 | `anh co 5 tỏi rưỡi, tìm nhà quận 5 phường 9, coi giúp anh căn #BDS-Q5-0164` (`CODE_RE`, regex tiền, `wardNum`) | trả đúng căn được nhắc, lọc kho theo tầm giá đã bóc | ✅ 04/09 |
| TS-CHATREPLY-02 | `anh muốn thuê nhà quận 5 tầm 20 triệu một tháng` → `để ở, tìm luôn đi` (`dealCol()`) | lượt 2 trả căn CHO THUÊ thật | ✅ 04/09 |
| TS-CHATREPLY-03 | acc seller: `cho thuê nhà mặt tiền phường 11, 60m2, giá 25 triệu một tháng` (`wantsSell`, `sDeal`, `wardM`, `priceM`) | tin `deal=cho_thue`, đúng phường, `price_raw` không dính "trệt" | ✅ 04/09 |
| TS-CHATREPLY-04 | tin kèm `image_url` trỏ host không tồn tại (`ghiLoi()` trong catch) | HTTP 200, khách vẫn có trả lời (fallback regex); `bot_errors` có `source='chat-reply model'` | ✅ 04/09 |

### TS-CACHE — trang tin thật sự nằm trong cache (NFR-17)
`export const revalidate` không có tác dụng khi route thiếu `generateStaticParams()` — không lỗi, không cảnh báo, mỗi lượt xem là một lambda. Nhìn code không thấy; phải đo.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-CACHE-01 | `bun run build`, đọc bảng route | `/nha-dat/[code]` là `●` (SSG), không phải `ƒ` | ✅ 04/09 |
| TS-CACHE-02 | `node -e "console.log(Object.keys(require('./.next/prerender-manifest.json').dynamicRoutes))"` | có `/nha-dat/[code]` | ✅ 04/09 |
| TS-CACHE-03 | `bun run start`, `curl -D - http://127.0.0.1:3000/` | `x-nextjs-cache: HIT` + `Cache-Control: s-maxage=300` | ✅ 04/09 |
| TS-CACHE-04 | bản deploy: mở một trang tin hai lần, xem `x-vercel-cache` | lần hai `HIT`/`STALE`, không `MISS` liên tục | ⏭ sandbox không tới Vercel |
| TS-CACHE-05 | `/mua-ban?gia=duoi-5` hai lần trong 5 phút, đếm query ở Supabase Logs | lần hai không sinh query `listings` mới (Data Cache của `layTin`) | ⏭ |

### TS-HEALTH — còi báo lỗi có kêu không (FR-152)
SQL trên DB thật. Dọn: `delete from bot_errors; delete from reminders where note like '🩺%'`, đẩy `bot_health.last_id` của `pg_net` lên `max(id)` của `net._http_response`.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-HEALTH-01 | `net.http_post` tới `/functions/v1/khong-he-ton-tai`, chờ 15s, `bot_health_tick()` | trả `loi_moi = 1` | ⏭ 04/09 |
| TS-HEALTH-02 | `select * from bot_errors order by id desc limit 1` | dòng `source='pg_net'`, `status_code=404` | ✅ 04/09 |
| TS-HEALTH-03 | `select note from reminders where note like '🩺%'` | đúng MỘT tin dù tick nhiều lần trong giờ | ✅ 04/09 |
| TS-HEALTH-04 | `cron.job_run_details` của chính lần chạy hỏng ở 01 | vẫn `succeeded` — lý do FR-152 tồn tại, đừng tin cột này | ✅ 04/09 |
| TS-HEALTH-05 | gọi `escalation-feed` kèm `x-bridge-secret` đúng | `bot_health` có `who='bridge-zca'`, `at` vừa xong | ⏭ |
| TS-HEALTH-06 | xoá dòng `bridge-zca` khỏi `bot_health` rồi tick | `bridge_im = false` — chưa từng có nhịp thì không báo | ⏭ |
| TS-HEALTH-07 | bridge im > 15 phút trong 7–22h VN, tick hai lần cùng giờ (`20260904a`) | lần 1 `ntfy = <id>`, `net._http_response` 200 từ ntfy.sh, `bot_health` có `who='ntfy'`; lần 2 `ntfy = null` (1 tin/giờ) | ✅ 04/09 (id 2102/2103 → 200) |
| TS-HEALTH-08 | tồn 🩺 cũ + báo cáo CTV `pending` từ 27/08, chạy tick | 🩺 cũ → `cancelled`, chỉ còn mới nhất; báo cáo CTV quá 36h → `cancelled` | ✅ 04/09 (huỷ 117 + 7, còn 1) |

### TS-LOG — lỗi tầng ứng dụng có vào sổ không (FR-152 d)
Loại lỗi này TRẢ 200 nên TS-HEALTH không bắt được. Không phủ log thô edge function (Free giữ 1 ngày); chỗ chưa gọi `ghiLoi()` vẫn im. Dọn như TS-HEALTH.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-LOG-01 | lặp 25 lượt `log_loi('thu-van','x',null)` | đúng **20** dòng — van theo nguồn | ✅ 04/09 |
| TS-LOG-02 | 600 lượt với 30 `p_source` khác nhau, `set local role anon` | tổng bảng dừng ở **200** — van tổng chặn kẻ đổi nguồn | ✅ 04/09 |
| TS-LOG-03 | `escalation-feed` `{"action":"log","source":"x","detail":"y"}` + `x-bridge-secret` | 200 `{"ok":true}`; `bot_errors` có `source='bridge x'` | ⏭ cần HTTP |
| TS-LOG-04 | tin kèm `image_url` host không tồn tại (đừng phá `ANTHROPIC_API_KEY` — làm chết bot thật) | HTTP 200, khách vẫn có trả lời; `bot_errors` `source='chat-reply model'` kèm lỗi API | ✅ 27/08 (`400 Unable to download`) · ⏭ 04/09 |
| TS-LOG-05 | route web ném lỗi có chủ ý trên bản deploy | `bot_errors` `source='web app'` kèm đường dẫn; khách thấy `app/error.tsx` | ⏭ cần deploy |
| TS-LOG-06 | `bot_health_tick()` sau TS-LOG-04 | có reminder 🩺 — còi đếm cả lỗi ứng dụng | ✅ 04/09 |

### TS-GIA — bóc giá tiếng lóng ra số (FR-154)
SQL editor, test hồi quy mỗi lần sửa `parse_vnd`: `select s, parse_vnd(s) from unnest(array['5 tỏi rưỡi','5 tỏi','5 tỷ rưỡi','5,5 tỷ','5 tỷ 5','3 tỷ 200','800 triệu','12 củ','15tr/th','900tr','1 trệt 2 lầu','5t5','2 tỉ 8','giá 6ty2 TL','7 tỏi 3','nhà 4x15 giá 8 tỏi','25 củ/tháng','5 cây vàng','5 tỏi 500 triệu','tỷ lệ chốt 5%','giá 5 tỷ 50m2','đất 100m2 giá 4ty','2 tý','thuê 8 củ rưỡi','5 tỷ 120m2','1 tỷ 050']) s;`
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-GIA-01 | bộ 26 ca ở trên | khớp đủ 26 | ✅ 04/09 |
| TS-GIA-02 | `'giá 5 tỷ 50m2'` | **5.000.000.000**, không phải 5,5 tỷ (regex từng lùi `{1,3}` để né lookahead `m`) | ✅ 04/09 |
| TS-GIA-03 | `'1 trệt 2 lầu'` | **NULL** — `tr` là "trệt"; `\M` Postgres hiểu dấu, đừng bê sang JS (`\b` chỉ ASCII) | ✅ 04/09 |
| TS-GIA-04 | `'5 cây vàng'`, `'2 tý'` | **NULL** cả hai — vàng không quy ra tiền; "tý" không phải tỷ | ✅ 04/09 |
| TS-GIA-05 | `count(*) from listings where price_vnd is distinct from parse_vnd(price_raw)` | **0** — khác 0 là sửa hàm chưa backfill | ✅ 04/09 |

### TS-SPECS — fact nhỏ giọt chảy vào cột (FR-153)
SQL trên tin có cột trống; dọn: xoá fact vừa chèn **và** trả cột về NULL (trigger không tự lùi).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-SPECS-01 | tin `bedrooms is null`, chèn `listing_facts` (`so_phong_ngu`, `'3PN 2wc'`, `thu`) | `listings.bedrooms = 3` | ✅ 04/09 |
| TS-SPECS-02 | chèn tiếp (`so_phong_ngu`, `'9 phòng'`) cùng tin | **9** — fact mới nhất thắng (luật "chỉ ghi khi trống" đã bỏ ở FR-163 a; chặn ghi đè là việc của bậc nguồn FR-164 a) | ✅ 04/09 |
| TS-SPECS-03 | (`huong`, `'Đông Nam'`) trên tin `direction is null` | `direction = 'Đông Nam'`; chuỗi > 40 ký tự thì bỏ qua | ✅ 04/09 |
| TS-SPECS-04 | (`so_phong_ngu`, `'ba phòng ngủ'`) | `bedrooms` vẫn NULL — không chữ số thì không đoán | ✅ 04/09 |

### TS-HANG — hạng Đồng/Bạc/Vàng (FR-155)
Đọc view `seller_ranks`. Không phủ: ngưỡng có đúng không (OPEN-26).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-HANG-01 | `select * from seller_ranks` | mỗi người bán một dòng; NMG 17–22 tin, 0 chốt → **bac** | ✅ 04/09 (3/3 Bạc) |
| TS-HANG-02 | cùng view, vai `anon` | không có cột `phone`/`zalo_user_id` (FR-104); từ `20260904b` view invoker → anon **0 dòng** là đúng ý (hạng ẩn khỏi web, chỉ `/admin` đọc) | ✅ 04/09 |
| TS-HANG-03 | đặt tay một tin `da_chot` cho NMG ≥10 tin, đọc lại (nhớ trả lại) | nhảy **vang** | ✅ 04/09 |

### TS-DANGTIN — admin tự đăng tin (FR-156)
RPC `admin_dang_tin` + trang `/admin/dang-tin`. Dọn: xoá tin `BDS-Q5-####` vừa tạo, `info_requests` của nó, người bán thử; kiểm lại `listings` = 173, `sellers` = 3.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-DANGTIN-01 | gọi `admin_dang_tin('{"price_raw":"1 tỷ"}')` không JWT admin | `42501` "Khong co quyen quan tri" | ✅ 04/09 |
| TS-DANGTIN-02 | `request.jwt.claims` = email trong `admins`, `price_raw='5 tỏi rưỡi'` | `code = BDS-Q5-####` nối dãy, `price_vnd = 5500000000` | ✅ 04/09 |
| TS-DANGTIN-03 | cùng lệnh, không gửi `seller_phone`/`seller_zalo` | người bán mới `phone IS NULL` và `zalo_user_id IS NULL` | ✅ 04/09 |
| TS-DANGTIN-04 | gọi lần hai cùng `seller_zalo` (hoặc `seller_phone`) | dùng lại `seller_id` cũ, không đẻ dòng `sellers` thứ hai | ✅ 04/09 |
| TS-DANGTIN-05 | mở `/admin/dang-tin` bằng tài khoản không trong `admins` | màn "Cần đăng nhập bằng tài khoản quản trị", không thấy form | ✅ 04/09 |

### TS-NEO — neo hội thoại người bán theo căn, tách vai (FR-157)
Cần người bán thử có `zalo_user_id` và **hai** tin cùng thiếu thông tin; gọi `chat-reply` qua `net.http_post`. Không phủ: câu hỏi chờ bị bỏ lại bao lâu thì drip hỏi lại. Dọn: xoá facts/info_requests/reminders/listings của người bán thử, `active_listing_id = null` rồi xoá `sellers`; xoá buyer/conversation của 04.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-NEO-01 | tạo câu hỏi pending cho căn A rồi căn B (B mới hơn) | `sellers.active_listing_id = B` — trigger neo trên INSERT | ✅ 04/09 |
| TS-NEO-02 | người bán nhắn "căn BDS-Q5-9001 xây năm 2015 nha em" (9001 = A) | fact `nam_xay` vào **A**, không vào B | ✅ 27/08 (v33) |
| TS-NEO-03 | đọc câu bot hỏi tiếp | nhắc rõ mã căn + tên đường ("căn #BDS-Q5-9001 ở Trần Bình Trọng diện tích đất…") | ✅ 27/08 |
| TS-NEO-04 | cùng Zalo ID nhắn "giờ anh muốn mua thêm một căn nữa ở quận 5 tầm 4 tỷ" | rẽ nhánh **buyer** (có `conversation_id`, không `role: seller`); câu chờ của A/B vẫn `pending` | ✅ 27/08 |

### TS-MA — câu rao sinh mã tin, một dãy mã duy nhất (FR-158)
Người bán thử **không** có câu hỏi chờ (có thì tin nhắn bị coi là câu trả lời). Test cổng rao **phải gõ có dấu** — gõ không dấu trượt ở `\b(bán|rao)\b` là pass giả (OPEN-29). Không phủ: người lạ chưa có dòng `sellers` nhắn câu rao vẫn rơi nhánh mua (chủ dự án để sau, 27/08).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-MA-01 | `insert into listings (code, …) values (null, …)` rồi `rollback` | `trg_listings_fill_code` điền mã nối dãy, không lỗi NOT NULL | ✅ 04/09 |
| TS-MA-02 | câu rao trần: `anh muốn bán căn nhà` | sinh tin `cho_thong_tin` + mã `BDS-Q5-####`; trigger đoán `nha_pho` từ chính câu rao, câu đầu hỏi `dien_tich_dat` | ✅ 27/08 (v35) |
| TS-MA-03 | `nhà mình bán chưa em` | **không** sinh tin — câu hỏi tình trạng, không phải câu rao | ✅ 27/08 |
| TS-MA-04 | `bán nhà hẻm xe hơi phường 8, 4x16, 8.5 tỷ` | sinh tin; `price_raw = "8.5 tỷ"`, `ward = "Phường 8"` | chưa chạy |
| TS-MA-05 | hai lượt rao đồng thời cùng người bán | hai mã khác nhau, không deadlock (advisory lock) | chưa chạy |

### TS-KD — tiếng Việt không dấu (FR-161)
Dựng như TS-MA. Bộ không dấu chỉ kích hoạt khi tin KHÔNG có dấu; tin có dấu đi đường cũ. Chấp nhận có chủ đích: "ban" ôm bán/bàn/bạn (cổng đòi đủ ba vế), "toi" ôm tôi/tối, "anh" trần không phải xin ảnh.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-KD-01 | `ban nha hem xe hoi phuong 8 gia 8.5 ty` | tin: `ward="Phường 8"`, `price_raw="8.5 ty"`, `price_vnd=8.5e9`, `property_type=nha_pho` | ✅ 27/08 live (v36) |
| TS-KD-02 | cùng người nhắn `toi muon mua nha quan 5` | rẽ nhánh buyer (`hoiMua` không dấu), không tạo tin | ✅ 27/08 live |
| TS-KD-03 | `nha minh ban chua em` | không sinh tin — trượt vì bộ chặn câu hỏi bản không dấu, không phải "ăn may" | ✅ 27/08 (đơn vị, 18 ca cổng) |
| TS-KD-04 | người bán có câu chờ nhắn `chieu gui anh so cho em` | `PROMISE_RE_KD` bắt → reminder `promise` | chưa chạy |
| TS-KD-05 | `select guess_property_type('ban dat nen quan 5'), guess_property_type('chưa đạt thoả thuận')` | `dat` và `NULL` — "đạt" ≠ "đất" | ✅ 04/09 |

### TS-IDEM — sổ idempotency + retry (FR-162)
SQL gọi thẳng `claim_inbound`, rồi E2E `net.http_post` vào chat-reply thật nhánh buyer (có fallback khi model hỏng). Đo quota bằng `bot_usage.model_calls`. Bẫy: CTE nhiều nhánh gọi `claim_inbound` trong cùng statement chạy không theo thứ tự — tách từng lệnh.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-IDEM-01 | `claim_inbound('x')` lần đầu | `claimed`, attempts 1 | ✅ 04/09 |
| TS-IDEM-02 | gọi lại khi hàng còn `received` tươi | `in_flight` | ✅ 04/09 |
| TS-IDEM-03 | đặt `completed` + reply rồi claim lại | `completed` kèm nguyên reply | ✅ 04/09 |
| TS-IDEM-04 | đặt `failed` rồi claim lại | `claimed`, attempts 2 | ✅ 04/09 |
| TS-IDEM-05 | đặt `processing`, lùi `updated_at` 200 s | `claimed` (reclaim sau 150 s) | ✅ 04/09 |
| TS-IDEM-06 | `claim_inbound(null)` | `23502` — từ `20260829a` PK `zalo_msg_id` NOT NULL; `chat-reply` chỉ gọi khi có `msgId` (kỳ vọng cũ "claimed" lỗi thời) | ✅ 04/09 (sửa kỳ vọng) |
| TS-IDEM-07 | E2E: tin buyer mới, msg_id mới | 200 + replies; sổ `completed`; quota **+1** | ✅ 27/08 (v37) |
| TS-IDEM-08 | E2E: gửi LẠI đúng msg_id | `replayed: true` + nguyên câu cũ; quota **+0**; `messages` 1 dòng | ✅ 27/08 |
| TS-IDEM-09 | E2E: 2 request cùng msg_id đồng thời | một bên trả lời, bên kia `in_flight`; quota **+1** | ✅ 27/08 |
| TS-IDEM-10 | E2E: sửa sổ `failed` rồi gửi lại | xử lý THẬT, attempts 2, `messages` 1 dòng; quota **+1** | ✅ 27/08 |

### TS-IDEM2 — sự kiện tách khỏi job, exactly-once chiều gửi (FR-162 phần 2)
Cùng harness TS-IDEM (chat-reply v38 + zalo-webhook v9 + `20260827n`). Bẫy: `now()` cố định theo transaction — muốn `last_seen_at` nhích phải gọi ở hai request rời.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-IDEM2-A | cùng webhook giao 2 lần | lần 2 `replayed` + nguyên câu; quota +0 | ✅ 28/08 |
| TS-IDEM2-B | cùng webhook giao 10 lần | 1 dòng `messages`, attempts 1, 9/9 replay; quota +1 | ✅ 28/08 |
| TS-IDEM2-C | 2 bản sao đến đồng thời | một bên trả lời, bên kia `in_flight` rỗng; 1 dòng messages | ✅ 28/08 |
| TS-IDEM2-D | worker retry sau `failed` | xử lý thật, attempts +1, messages 1 dòng; quota +1 | ✅ 28/08 |
| TS-IDEM2-E | chết SAU khi AI chạy, TRƯỚC commit (`processing` kẹt, lùi 200 s) | reclaim sau 150 s → xử lý thật, reply lưu, messages 1 dòng | ✅ 28/08 |
| TS-IDEM2-F | chết SAU commit, TRƯỚC ack (caller gọi lại) | replay nguyên payload, không business effect mới | ✅ 28/08 |
| TS-IDEM2-G | lần trước GỬI HỤT (`send_error` có, `sent_at` trống) | replay `already_sent=false` → kênh gửi lại | ✅ 28/08 |
| TS-IDEM2-H | lần trước gửi thành công, provider giao trùng | replay `already_sent=true` → webhook im, khách không nhận đúp | ✅ 28/08 |
| TS-IDEM2-I | cùng event giao nhiều lần, timestamp khác | `inbound_events` MỘT dòng, `delivery_count` đủ, payload giữ bản đầu, `last_seen_at` nhích | ✅ 04/09 |

### TS-TOANVEN — toàn vẹn dữ liệu tầng DB (FR-163)
Một khối DO trên DB thật, bắt exception cho ca "phải bị chặn", ghi bảng tạm rồi đọc (RAISE NOTICE không về qua MCP). EXPLAIN `messages` theo `conversation_id order by seq desc` phải là `Index Scan using messages_conv_seq_idx`.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| 01 | fact `so_phong_ngu` "3 phòng" rồi sửa "4 phòng ngủ" | `bedrooms = 4` — fact mới nhất thắng | ✅ 04/09 |
| 02a | fact `dien_tich_tim_tuong` "120m2" | `area_m2` không đổi | ✅ 04/09 |
| 02b | fact `dien_tich` "50m2" | `area_m2 = 50` | ✅ 04/09 (vá 20260904b) |
| 03 | fact `loai_bds` "nhà phố ạ" | `property_type=nha_pho` + `property_type_source=chu_xac_nhan` | ✅ 04/09 (vá 20260904b) |
| 04 | UPDATE thẳng `price_vnd = 999` | trigger đè lại = `parse_vnd(price_raw)` | ✅ 04/09 |
| 05a | INSERT 2 deals cùng (listing, buyer NULL) | 23505 — unique `NULLS NOT DISTINCT` | ✅ 04/09 |
| 05b | DELETE deal có `closed_at` | trigger raise | ✅ 04/09 |
| 05c | gỡ `closed_at` rồi DELETE | được — đường thoát hai bước | ✅ 04/09 |
| 06a | viewing không có cả `listing_id` lẫn `listing_code` | CHECK chặn | ✅ 04/09 |
| 06b | viewing chỉ có `listing_code` | được | ✅ 04/09 |
| 06c | viewing `status='tùm lum'` | CHECK chặn | ✅ 04/09 |
| 07a | conversation có cả buyer lẫn seller | CHECK một-vai chặn | ✅ 04/09 |
| 07b | seller thứ hai hội thoại | unique chặn | ✅ 04/09 |
| 08 | reminder `cancelled` bị UPDATE thành `sent` | revert êm: vẫn `cancelled`, `sent_at` trống | ✅ 04/09 |
| 09 | ledger `completed` bị hạ xuống `failed` | raise | ✅ 04/09 |

### TS-OUNG — đường ống dữ liệu tin rao (FR-164)
DO block trên DB thật + E2E qua `chat-reply`. Mọi cửa ghi (`listing_facts`, `admin_dang_tin`, web) đều qua trigger `trg_listings_chuan_hoa_cot` (`20260828f`) nên `ward`/`price_raw` một luật trình bày; bộ `chuan_hoa_gia_raw` 14/14.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-OUNG-01 | fact vào TRƯỚC khi cột cấu trúc được ghi | cột theo fact, `*_source` đúng bậc, tin đủ ba trường lên `dang_ban` | ✅ 04/09 (vá 20260904b) |
| TS-OUNG-02 | cột ghi trước, fact đến sau | fact chủ nhà (`chu_xac_nhan`) đè `suy_doan` | ✅ 04/09 (vá 20260904b) |
| TS-OUNG-03 | hai fact cùng trường ghi đồng thời | không mất cập nhật; giá trị cuối là fact sau, không kẹt khoá | ✅ 04/09 |
| TS-OUNG-04 | chủ sửa giá 6.5→6.8 tỷ, DT 25→27, PN 3→4, loại chưa rõ→nhà phố, phường 1→3 | cả năm đổi; cột non-NULL không chặn | ✅ 04/09 (vá 20260904b) |
| TS-OUNG-05 | tin thiếu giá / diện tích / phường | `listing_du_dang_tin()` false, giữ `cho_thong_tin` | ✅ 04/09 |
| TS-OUNG-06 | `property_type` chưa rõ | vẫn đăng được — loại không nằm trong ba trường quyết định | ✅ 04/09 |
| TS-OUNG-07 | loại suy từ mô tả | `property_type_source='suy_doan'` | ✅ 04/09 |
| TS-OUNG-08 | chủ xác nhận có phủ định: "nhà phố chứ không phải chung cư em" | `nha_pho` — `cat_truoc_phu_dinh()` | ✅ 04/09 (vá 20260904b) |
| TS-OUNG-09 | `parse_vnd()` không đọc được chuỗi giá | không ghi; `price_raw`/`price_vnd` giữ nguyên | ✅ 04/09 |
| TS-OUNG-10 | diện tích dị dạng ("mấy chục mét") | không ghi; fact vẫn lưu làm bằng chứng | ✅ 04/09 |
| TS-OUNG-11 | tin đủ thông tin | tự lên `dang_ban`, một trigger quyết định | ✅ 04/09 |
| TS-OUNG-12 | tin đang bán bị gỡ mất một trường | tự hạ về `cho_thong_tin` | ✅ 04/09 |

### TS-KHO — kho ảnh tin rao theo UUID (FR-165)
DB trong DO block cuộn lại; HTTP qua `pg_net`. Chưa kết luận: anon LIỆT KÊ bucket riêng trả `200 []` — kho rỗng nên không phân biệt "RLS lọc" với "cho phép nhưng rỗng", kiểm lại khi có ảnh thật. Bẫy: `revoke … from anon` không tác dụng với hàm, phải revoke từ PUBLIC.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-KHO-01 | upload: ghi dòng media đúng quy ước | nhận, tự thành ảnh bìa | ✅ 04/09 |
| TS-KHO-02 | upload đường dẫn theo MÃ TIN (lối cũ) | CHECK chặn | ✅ 04/09 |
| TS-KHO-03 | upload trùng (bucket, path) | UNIQUE chặn | ✅ 04/09 |
| TS-KHO-04 | `so_do` vào bucket công khai | CHECK chặn | ✅ 04/09 |
| TS-KHO-05 | sort_order NGƯỢC thứ tự tên file | ra `10,2,1` (xếp theo tên sẽ ra `1,10,2`) | ✅ 04/09 |
| TS-KHO-06 | ảnh bìa | tấm `sort_order` nhỏ nhất — tiền đề chèn theo `sort_order` tăng dần (như `up-anh.mjs`); `listing_media_chon_bia()` cố ý không đè bìa admin chọn tay | ✅ 04/09 (ghi tiền đề) |
| TS-KHO-07 | đổi mã tin | 3/3 ảnh còn nguyên, view đổi theo mã mới | ✅ 04/09 |
| TS-KHO-08 | replace (đổi storage_path) | đường dẫn cũ vào hàng đợi dọn | ✅ 04/09 |
| TS-KHO-09 | xoá ảnh đang là bìa | vào hàng đợi + tấm kế lên bìa | ✅ 04/09 |
| TS-KHO-10 | xoá tin | media cascade về 0, cả 4 file vào hàng đợi (kể cả riêng tư) | ✅ 04/09 |
| TS-KHO-11 | upload hỏng (có dòng, chưa có file) | `media_mo_coi_db` soi ra | ✅ 04/09 |
| TS-KHO-12 | worker nhận việc | `dang_lam`, attempts=1 | ✅ 04/09 |
| TS-KHO-13 | xoá hỏng rồi quá 10 phút | nhận lại được, attempts=2 (trigger chỉ tự đóng dấu `updated_at` khi người gọi không đặt) | ✅ 04/09 |
| TS-KHO-14 | việc đã `xong` | không bị nhận lại, không lùi trạng thái được | ✅ 04/09 |
| TS-KHO-15 | worker chạy thật với file KHÔNG tồn tại | `da_xoa=1` — Storage trả HTTP 400 thân `{"statusCode":"404"}`, worker phải đọc thân | ✅ 29/08 · ⏭ 04/09 |
| TS-KHO-16 | anon xin quyền GHI `listing-public` | 403 AccessDenied | ✅ 29/08 · ⏭ 04/09 |
| TS-KHO-17 | anon xin quyền GHI `listing-private` | 403 AccessDenied | ✅ 29/08 · ⏭ 04/09 |
| TS-KHO-18 | anon tự tạo bucket | 403 AccessDenied | ✅ 29/08 · ⏭ 04/09 |
| TS-KHO-19 | đọc `/object/public/` của bucket RIÊNG | `NoSuchBucket` | ✅ 29/08 · ⏭ 04/09 |
| TS-KHO-20 | anon đọc `listing_media` | chỉ thấy dòng `listing-public`; `so_do` bị RLS lọc | ✅ 04/09 |
| TS-KHO-21 | anon đọc view sau khi siết execute | vẫn ra URL dạng UUID — view đọc thẳng `app_config` bằng subquery, không gọi hàm (EXECUTE xét theo người gọi) | ✅ 04/09 |
| TS-KHO-22 | đường dẫn có `..` | CHECK chặn | ✅ 04/09 |
| TS-KHO-23 | đường dẫn có `//` | CHECK chặn | ✅ 04/09 |
| TS-KHO-24 | ảnh thường vào bucket riêng | cho — bucket riêng không cấm ảnh thường | ✅ 04/09 |
| TS-KHO-25 | `is_cover` cho file ở bucket riêng | CHECK chặn | ✅ 04/09 |

### TS-JOB — việc chạy nền tin cậy (FR-166)
Một khối DO trên DB thật, cuộn lại (0 dòng `TSJOB%` sót). Cảnh sập dựng bằng tay: `updated_at` lùi quá hạn thuê, `attempts` đẩy lên trần. E2E: sự kiện mồ côi thật trong `inbound_events` → `inbound-sweep` nhặt, job `completed`, 3 `messages`, lượt sau không liệt kê nữa.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-JOB-01 | claim tin lần đầu | `received`, attempts=1, sổ `processing` | ✅ 04/09 |
| TS-JOB-02 | hai worker giành cùng tin | bên thua `in_flight`, không xử lý đôi | ✅ 04/09 |
| TS-JOB-03 | worker sập: `processing` quá hạn thuê 150s | worker sau nhận lại, attempts=2 | ✅ 04/09 |
| TS-JOB-04 | báo hỏng một job | `failed` + `next_retry_at` | ✅ 04/09 |
| TS-JOB-05 | claim trước giờ thử lại | `in_flight` — không đập API sớm | ✅ 04/09 |
| TS-JOB-06 | luật lùi dần `lan_thu_ke()` | nhân đôi dần, chặn 1 tiếng, nhiễu ±20% | ✅ 04/09 |
| TS-JOB-07 | hỏng vĩnh viễn: lần thứ 8 | `dead`, thôi thử | ✅ 04/09 |
| TS-JOB-08 | claim việc đã `dead` | trả `dead` + cờ `r_dead` | ✅ 04/09 |
| TS-JOB-09 | lùi `dead` → `processing` | guard chặn (chỉ gỡ bằng `completed`) | ✅ 04/09 |
| TS-JOB-10 | báo hỏng trên dòng đã `completed` | `da_completed`, không đụng status | ✅ 04/09 |
| TS-JOB-11 | nudge giành việc nhắc tới hạn | 1 dòng, `locked_by`, attempts=1 | ✅ 04/09 |
| TS-JOB-12 | hai worker nudge chạy chồng | worker thứ hai lấy 0 dòng | ✅ 04/09 |
| TS-JOB-13 | gửi nhắc hụt | nhả thuê + hẹn giờ lùi dần | ✅ 04/09 |
| TS-JOB-14 | giành nhắc trước giờ thử lại | 0 dòng | ✅ 04/09 |
| TS-JOB-15 | nhắc hỏng lần thứ 5 | `dead` | ✅ 04/09 |
| TS-JOB-16 | lùi nhắc `dead` → `pending` | guard giữ `dead` | ✅ 04/09 |
| TS-JOB-17 | hai lời hỏi thăm cùng một khách | 23505 — unique index, bên thua nhường | ✅ 04/09 |
| TS-JOB-18 | nhắc chưa tới hạn | không bị nhặt | ✅ 04/09 |
| TS-JOB-19 | worker nhận việc dọn file | `dang_lam`, attempts=1 | ✅ 04/09 |
| TS-JOB-20 | việc dọn file quá 6 lần | thôi nhận | ✅ 04/09 |
| TS-JOB-21 | `chon_viec_don_chet()` | đổi sang `chet` | ✅ 04/09 |
| TS-JOB-22 | sập trước khi gọi chat-reply: có sự kiện, không job | đường cứu thấy, `chua_co_job` | ✅ 04/09 |
| TS-JOB-23 | sập giữa lúc gọi model: job kẹt `processing` | đường cứu thấy, `job_do_dang` | ✅ 04/09 |
| TS-JOB-24 | sập sau AI, trước lần gửi đầu (`completed`, `sent_at` null, `sent_bubbles` 0) | đường cứu thấy, `chua_gui` — so `jsonb_array_length(reply->'replies')` với `sent_bubbles`, không đợi `send_error` | ✅ 04/09 |
| TS-JOB-25 | đã gửi đủ bong bóng | không liệt kê | ✅ 04/09 |
| TS-JOB-26 | việc đã `dead` | không liệt kê | ✅ 04/09 |
| TS-JOB-27 | view `job_suc_khoe` | thấy việc dở của cả ba hàng đợi | ✅ 04/09 |
| TS-JOB-28 | giành được nhưng KHÔNG thử gửi (thiếu đích/token OA) | `nha_viec_nhac` trả việc: hết khoá, `attempts` về 0 (`20260829c`) | ✅ 04/09 |
| TS-JOB-29 | nhả xong, worker sau nhặt lại | lấy được ngay | ✅ 04/09 |
| TS-JOB-30 | nhả một việc đã `sent` | `khong_co` — chỉ nhả việc `pending` | ✅ 04/09 |

### TS-SEC2 — soát bảo mật theo VAI THẬT (FR-167)
Không đọc policy rồi suy, mà `set local role anon`/`authenticated` kèm `request.jwt.claims` rồi thử đọc/ghi/gọi RPC; edge function gọi HTTP bằng publishable key. Chấm theo SỐ DÒNG (UPDATE bị RLS chặn không ném lỗi) và ép đánh giá hàm bằng `execute … into` (`count(*)` bỏ qua hàm). Kho file: `storage.objects`/`buckets` bật RLS 0 policy — 16 ca ghi/leo thư mục/đổi bucket đều chặn (29/08); liệt kê bucket rỗng `200 []` chưa kết luận được.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-SEC2-01…22 | `anon` ĐỌC sellers, buyers, messages, conversations, deals, viewings, reminders, admins, ctvs, info_requests, bot_prompts, app_config, bot_errors, inbound_ledger, media_cleanup_queue, job_suc_khoe, tin nháp, fact địa chỉ/hình, media bucket riêng | 22/22 chặn | ✅ 04/09 |
| TS-SEC2-23…41 | người lạ ĐÃ ĐĂNG NHẬP ghi: sửa/xoá tin người khác, tự phong admin, sửa SĐT chủ nhà, tạo seller/buyer đội tên, sửa CRM/phí, chốt/xoá deal, chèn tin nhắn, spam nhắc, sửa prompt/app_config, thêm media/fact, lịch xem giả | 19/19 chặn | ✅ 04/09 |
| TS-SEC2-42…56 | người lạ gọi RPC: get_secret, cau_hinh, next_listing_code, listings_fill_code, info_request_set_active_listing, ghi_fact_listing, merge_buyer_prefs, claim_inbound, nhan_viec_nhac, bump_model_quota, beat, các `*_tick` | 15/15 chặn | ✅ 04/09 |
| TS-SEC2-57…59 | chéo người bán: B đọc hồ sơ A, tin nháp A, cướp tin A (đổi `seller_id`) | 3/3 chặn | ✅ 04/09 |
| TS-SEC2-60…61 | không vỡ nghiệp vụ: anon đọc tin đã lên kệ + ảnh | 2/2 đạt | ✅ 04/09 |
| TS-SEC2-H1 | `nudge` không kèm khoá | 403 (trước vá: 200 + lộ lời nhắc) | ✅ 29/08 · ⏭ 04/09 |
| TS-SEC2-H2 | `nudge` + publishable key | 403 (trước: 200) | ✅ 29/08 · ⏭ |
| TS-SEC2-H3 | `nudge` + `x-bridge-secret` đúng (đường cron) | 200 | ✅ 29/08 · ⏭ |
| TS-SEC2-H4 | `nudge` + bridge secret sai | 403 | ✅ 29/08 · ⏭ |
| TS-SEC2-H5 | `ask-seller` + publishable key | 403 (trước: 400 — đã qua cổng); bằng bridge secret vẫn qua | ✅ 29/08 · ⏭ |
| TS-SEC2-H6 | `ctv-report` + publishable key | 403 (trước: chạy tới model) | ✅ 29/08 · ⏭ |
| TS-SEC2-H7 | `geocode-listings` + publishable key | 403 (trước: 200, ghi lat/lng) | ✅ 29/08 · ⏭ |
| TS-SEC2-H8 | `chat-reply`/`escalation-feed`/`media-cleanup`/`inbound-sweep` + publishable key | 403/401/403/403 (vốn kín) | ✅ 29/08 · ⏭ |
| TS-SEC2-62 | mọi hàm SQL có `net.http_post` đều mang `x-bridge-secret` — trừ `canh_bao_ngoai` (ntfy, FR-152 e), loại trừ tường minh trong câu `pg_get_functiondef` | danh sách thiếu rỗng | ✅ 04/09 (6 hàm: 5 + 1 loại trừ; sửa câu) |
| TS-SEC2-63 | không hàm nào còn nhúng cứng anon JWT đời cũ (`eyJhbGciOi…`) | rỗng | ✅ 04/09 |
| TS-SEC2-64 | `authenticated` gọi `ask_seller_drip()` | chặn | ✅ 04/09 |
| TS-SEC2-65 | `anon` gọi `ask_seller_drip()` | chặn | ✅ 04/09 |
| TS-SEC2-66 | `seller_drip_tick` + `trg_listing_drip` vẫn SECURITY DEFINER | 2/2 — siết `ask_seller_drip` không gãy đường vận hành (hồi quy drip vá `20260829e`) | ✅ 04/09 |

### TS-HQ — hồi quy sau soát thù địch + hai lượt review diff (29/08/2026)
Mười lỗi đều ở tầng TypeScript của FR-161…167 — nơi chưa có test; 01–04 chạy máy (`bot/tests/*.mjs`, Node, không cần mạng), 05–12 là bất biến kiểm tĩnh. Hạn còn lại: bridge chưa tiếp tục từ `sent_bubbles` (cần `claim_inbound` trả thêm cột).
| ID | Bài | Kỳ vọng / vá ở | Kết quả mới nhất |
|---|---|---|---|
| TS-HQ-01 | `node bot/tests/fr161-go-lan-dau.mjs` — câu gõ LẪN dấu là câu rao (`ban nha q5 giá 5 ty`) | 9/9 | ✅ 04/09 |
| TS-HQ-02 | cùng file — câu gõ lẫn dấu là câu hỏi mua | nhận ra | ✅ 04/09 |
| TS-HQ-03 | `node bot/tests/fr164-loi-sua-va-cau-hoi-treo.mjs` — vừa sửa trường vừa trả lời câu treo | ghi CẢ HAI, 8/8 | ✅ 04/09 |
| TS-HQ-04 | cùng file — câu CHỈ có lời sửa | không rơi xuống khối câu hỏi treo | ✅ 04/09 |
| TS-HQ-05 | `chat-reply` gặp job `dead` | DỪNG, không gọi model — nhánh `r_state === "dead"` (vỡ exactly-once nếu không) | ✅ 04/09 kiểm tĩnh |
| TS-HQ-06 | báo hỏng job | qua `bao_hong_inbound`, không ghi thẳng `status='failed'` (thiếu `next_retry_at` → sweep đốt 8 lượt/8 phút) | ✅ 04/09 kiểm tĩnh |
| TS-HQ-07 | `nudge --dry_run` | không đụng lời nhắc thật — `baoHongNhac` | ✅ 04/09 kiểm tĩnh |
| TS-HQ-08 | dòng giữ chỗ `reengage` mồ côi | được dọn (quét > 15 phút) — nếu không khách đó không bao giờ được hỏi thăm | ✅ 04/09 kiểm tĩnh |
| TS-HQ-09 | lỗi chèn giữ chỗ khác 23505 | vào `bot_errors`, không `continue` trần | ✅ 04/09 kiểm tĩnh |
| TS-HQ-10 | `catch` ở cửa phát lại `zalo-webhook` | chỉ bọc `JSON.parse`; `handleEvent` ném không được nuốt thành 200 | ✅ 04/09 kiểm tĩnh |
| TS-HQ-11 | bridge tôn trọng `replayed`+`already_sent`, ghi `sent_at` (`mark_sent`) | thả tim đúp không phát lại loạt bong bóng | ✅ 04/09 kiểm tĩnh |
| TS-HQ-12 | `nha_viec_nhac` chỉ nhả việc của CHÍNH worker đó (`20260829f`) | worker treo không xoá khoá worker đang chạy | ✅ 04/09 |

### TS-TIEN — đồng hồ đo tiền bộ não (FR-169)
`DO … raise exception` trên DB thật, `bot_usage` giữ nguyên 3 dòng cũ. Điểm mù: chỉ `chat-reply` nối `doTien()`; `nudge`/`ask-seller`/`ctv-report` chưa — số ở `/admin` là SÀN. Chưa kiểm: số chữ thật và nhịp nhớ tạm 1 giờ (`cache_read_tokens` phải > `cache_write_tokens` sau 3 lượt cách 10 phút).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-TIEN-01 | `cong_token(1000,200,5000,0)` khi ngày chưa có dòng | tự tạo dòng, `model_calls` giữ 0 | ✅ 04/09 |
| TS-TIEN-02 | `cong_token(300,100,0,5000)` tiếp | CỘNG DỒN: in=1300 out=300 nạp=5000 đọc=5000 | ✅ 04/09 |
| TS-TIEN-03 | `cong_token(null,null,null,null)` | `coalesce` về 0, dòng không đổi | ✅ 04/09 |
| TS-TIEN-04 | `bump_model_quota(1000)` SAU `cong_token` | calls 0→1 trên CÙNG dòng, số chữ nguyên — `insert … on conflict`, không `update` thuần | ✅ 04/09 |
| TS-TIEN-05 | `anon` đọc `bot_usage` | chặn ở tầng quyền | ✅ 04/09 |
| TS-TIEN-06 | `authenticated` không trong `admins` | RLS lọc còn 0 dòng | ✅ 04/09 |
| TS-TIEN-07 | `authenticated` trong `admins` | thấy đủ dòng | ✅ 04/09 (3 dòng) |

### TS-CHUONG — chuông báo hết tiền tài khoản AI (FR-168)
Cùng khuôn TS-TIEN; đối chiếu sau: `bot_errors` về số cũ, 0 dòng `HET TIEN API`. Luật rút ra: mệnh đề `or` để lọc bỏ phải bọc `coalesce` mọi cột cho phép NULL; ca âm tính quan trọng ngang ca dương tính.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-CHUONG-01 | ghi lỗi `Your credit balance is too low…` | chuông kêu, đúng 1 dòng nguồn `HET TIEN API` | ✅ 04/09 |
| TS-CHUONG-02 | ghi thêm lỗi hết tiền trong cùng 6 giờ | vẫn 1 dòng — van hãm nhịp | ✅ 04/09 |
| TS-CHUONG-03 | ghi thẳng một dòng nguồn `HET TIEN API` | không tự soi mình, không đệ quy | ✅ 04/09 |
| TS-CHUONG-04 | sau khi chuông kêu, soi `reminders` | 0 — cố ý không đẩy qua cầu nối | ✅ 04/09 |
| TS-CHUONG-05 | nội dung dòng chuông | mở đầu "🔴 BỘ NÃO ĐANG CÂM — HẾT TIỀN TÀI KHOẢN AI", có đường dẫn nạp tiền | ✅ 04/09 |
| TS-CHUONG-06 | ÂM TÍNH: `Overloaded`, `Unterminated string`, `connection reset`, hai cái `status_code` RỖNG | chuông im (`NULL` trong chuỗi `or` làm hàm rơi xuống nhánh kêu) | ✅ 04/09 (vá 20260901c) |
| TS-CHUONG-07 | HTTP 402, nội dung không khớp mẫu chữ | chuông kêu | ✅ 04/09 |

### TS-VAI — bóc dữ liệu theo bốn vai người nhắn (FR-159, FR-170)
Tầng regex: `node bot/tests/fr159-bon-vai.mjs` (65 ca: chủ nhà ở lại nhánh bán, hỏi mua rẽ nhánh mua, người lạ mở/không mở hồ sơ bán, khoảng giá "có ÔM căn giá X không", nhãn chính chủ/môi giới). Tầng DB: RPC `mo_ho_so_nguoi_ban(zalo, nhãn default ccrb)` (`20260901d`), cuộn lại, 0 dòng `test-fr159-%` sót. Trọn luồng người lạ → câu hỏi vai → hồ sơ bán → câu rao: kiểm ở TS-E2E.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-VAI-01 | Zalo id lạ | tạo đúng 1 dòng, `seller_type = unknown` | ✅ 02/09 |
| TS-VAI-02 | gọi lần hai cùng id (race) | CÙNG id, không 23505 | ✅ 02/09 |
| TS-VAI-03 | người đã có tên gọi lại | trả đúng tên cũ, không xoá | ✅ 02/09 |
| TS-VAI-04 | vai `anon` gọi | chặn | ✅ 02/09 |
| TS-VAI-05 | vai `authenticated` gọi | chặn | ✅ 02/09 |
| TS-VAI-06 | mở với nhãn `nmg` | dòng mới mang `nmg` | ✅ 02/09 |
| TS-VAI-07 | mở không truyền nhãn | mặc định `ccrb` | ✅ 02/09 |
| TS-VAI-08 | hồ sơ tạo tay còn `unknown`, gọi lại với `ccrb` | nâng thành `ccrb` | ✅ 02/09 |
| TS-VAI-09 | nhãn đã `ccrb`, gọi lại với `nmg` | không ghi đè — lời tự xưng không lật nhãn admin | ✅ 02/09 |
| TS-VAI-10 | `anon` gọi chữ ký mới | chặn | ✅ 02/09 |
| TS-VAI-11 | `authenticated` gọi chữ ký mới | chặn | ✅ 02/09 |
| TS-VAI-12 | `anon` đọc `sellers` | 0 dòng | ✅ 02/09 |
| TS-VAI-13 | đăng nhập không phải admin đọc `sellers` | 0 dòng | ✅ 02/09 |
| TS-VAI-14 | đăng nhập không phải admin đọc `reminders` | 0 dòng | ✅ 02/09 |
| TS-VAI-15 | admin đọc `sellers` | thấy đủ | ✅ 02/09 (3) |
| TS-VAI-16 | admin đọc `reminders` đang chờ | thấy | ✅ 02/09 (93) |
| TS-VAI-17 | admin update `sellers.seller_type` | được | ✅ 02/09 |
| TS-VAI-18 | admin update `reminders.status` | được | ✅ 02/09 |

### TS-E2E — chạy `chat-reply` THẬT trong Node, Supabase + model giả lập
`bun build` đóng gói `chat-reply/index.ts` (Deno) thành file Node, thay `npm:` bằng gói thật (`zod`, `@anthropic-ai/sdk`) và gói giả (`mock-supabase.mjs` DB trong bộ nhớ, `mock-anthropic.mjs` model theo kịch bản). Không Deno, không DB thật, ~1 giây: `cd bot/tests/e2e && bun install && bash chay.sh` (`chay.sh` tự đóng gói lại — chạy `run.mjs` trực tiếp là chạy bundle cũ). Kịch bản chia bốn vai + bất biến chéo (nhường lượt, model hỏng, ảnh trần, mã từ web), khẳng định trên DB giả hoặc PROMPT thật gửi model. Giới hạn: DB giả chép NGHĨA của RPC/trigger, RPC thật đổi thì bộ này không tự biết — tầng DB kiểm bằng TS-VAI/TS-TIEN/TS-CHUONG. Kết quả mới nhất: **102/102** (04/09, trên bundle kéo ngược sau deploy v48).

### TS-TOIUU — đếm vòng đi về DB và bất biến tối ưu (FR-171)
Cùng bộ e2e; mock ghi mọi truy vấn vào `db().log`. Ngưỡng đặt bằng số đo SAU khi sửa — ai thêm truy vấn vào đường nóng là đỏ. Đo build: `bun install` 4,4 s vs `npm` 20,1 s; `next build` ~34 s ở cả hai.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-TOIUU-01 | người lạ nhắn câu mập mờ → bot hỏi vai | ≤ 11 truy vấn, 0 lượt model | ✅ 04/09 (v43: 18 → 11) |
| TS-TOIUU-02 | người mua lượt đầu (chưa hồ sơ) | ≤ 17 truy vấn | ✅ 04/09 (20 → 17) |
| TS-TOIUU-03 | người mua đã có hồ sơ, hỏi tiếp | ≤ 16 truy vấn | ✅ 04/09 (24 → 16) |
| TS-TOIUU-04 | khách hỏi một căn rồi im | follow-up qua RPC `tao_followup`, có `reminders` kind `followup` | ✅ 04/09 (3 vòng → 1 RPC) |
| TS-TOIUU-05 | ba lượt liên tiếp trong 60 s | `bot_prompts` đọc ≤ 1 lần (nhớ tạm module) | ✅ 04/09 |
| TS-TOIUU-06 | bot trả 2–3 bong bóng | vào `messages` bằng MỘT INSERT mảng | ✅ 04/09 |
| TS-TOIUU-07 | người bán trả lời câu hỏi chờ | ≤ 15 truy vấn, `role = seller` | ✅ 04/09 (21 → 15) |
| TS-TOIUU-08 | mọi kịch bản | không còn UPDATE `conversations` chỉ để ghi `last_message_at` | ✅ 04/09 |
| TS-TOIUU-09 | mọi kịch bản | hội thoại có tin thì `last_message_at` đã được trigger (giả) đẩy — kiểm chính mock | ✅ 04/09 |
| TS-TOIUU-10 | người mua lượt đầu, chưa đủ khu vực + giá | không `select listings` | ✅ 04/09 |

### TS-HOICHU — khách hỏi → báo admin + hỏi chủ → chủ trả lời → báo lại khách (FR-140 b/c)
DB thật trong một giao dịch rồi rollback. Từ 03/09 FR-173 đổi đường `buyer_ask` (giao CTV, admin không bị báo mỗi câu) nên 01 và 03 lỗi thời — bản mới ở TS-CTV; 02 vẫn đúng.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-HOICHU-01 | chèn `buyer_ask`, tin có chủ trên Zalo | HAI `reminders` `escalation`: một gắn `seller_id`, một đi đường admin "❓ Khách hỏi căn #…" | ✅ 02/09 · lỗi thời từ 03/09 (xem TS-CTV-01/02) |
| TS-HOICHU-02 | `info_requests` → `answered` | thêm `followup` gắn `buyer_id` "chủ nhà vừa trả lời câu khách hỏi về #…"; nhắc im lặng cùng căn bị huỷ | ✅ 02/09 |
| TS-HOICHU-03 | `assignee` sau định tuyến | `seller`; nguồn giữ `buyer_ask` | ✅ 02/09 · lỗi thời từ 03/09 |

### TS-CTV — câu khách hỏi về CTV; CTV chậm → admin đỡ khách; hạng CTV (FR-173)
DB thật `begin … rollback` (`20260903a`, `20260903b` khoá hai hàm khỏi REST; `ctv_ranks` bị advisor báo "security definer view" — cố ý, xem `09`). Phần chat-reply: e2e CTV-01…04 (CTV nhắn `#mã: câu trả lời` → `answered` + fact nguồn `ctv`, 0 lượt model; mã lạ → "Em không thấy tin"; người lạ nhắn `#mã` → tra `nguoi_noi_bo` một lượt rồi đi nhánh mua) ✅ 04/09.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-CTV-01 | chèn `buyer_ask` cho tin có chủ trên Zalo, có một CTV `active` | `assignee = ctv`, `ctv_id` gán, `sla_due_at = now() + 120 phút`; không giao chủ nhà | ✅ 03/09 |
| TS-CTV-02 | dòng nhắc sinh ra | MỘT `escalation` gắn `ctv_id` (mẫu `#mã: câu trả lời` trong 120 phút); 0 dòng đường admin | ✅ 03/09 |
| TS-CTV-03 | lùi `sla_due_at` về quá khứ, `info_request_sla_tick()` hai lần | lần 1 trả 1 + một dòng admin "⏰ CTV … chưa trả lời … Admin đỡ khách", `sla_missed_at` đánh dấu; lần 2 trả 0 | ✅ 03/09 |
| TS-CTV-04 | `nguoi_noi_bo('<zalo CTV>')` / `nguoi_noi_bo('nguoi-la')` | (`ctv`, tên) / 0 dòng | ✅ 03/09 |
| TS-CTV-05 | `ghi_fact_listing(…, 'ctv')` rồi `info_requests → answered` | `listing_facts.source = ctv`, `bac_nguon('ctv') = 2`; trigger FR-140 c sinh `followup` cho khách | ✅ 03/09 |
| TS-CTV-06 | view `ctv_ranks` (claims `service_role`): 4 câu 30 ngày, 3 đúng hạn, 1 trễ | `tong=4 tra_loi=3 dung_han=3 tre=1 ty_le=0.75 rank=bac`; vai `postgres` không jwt → 0 dòng | ✅ 03/09 |

### TS-DIABAN — địa bàn mở: quận/huyện từ câu rao, không ghi cứng Quận 5 (FR-174 đợt 1)
Ba ca e2e + một ca DB thật (`do … raise`). Chưa kiểm trên Zalo thật: `nudge` v23 soạn tin báo lại khách.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-DIABAN-01 | e2e: chính chủ rao "bán nhà Bến Lức Long An 2 tỷ 80m2" | `district = "Bến Lức, Long An"` | ✅ 04/09 |
| TS-DIABAN-02 | e2e: "bán nhà P4 giá 5 tỷ 8 50m2" (không nói quận) | `district = "Quận 5"` (mặc định cụm khởi điểm), `ward = Phường 4` | ✅ 04/09 |
| TS-DIABAN-03 | e2e: "bán nhà Tân Bình hẻm 6m 6 tỷ 60m2" | `district = "Quận Tân Bình"` | ✅ 04/09 |
| TS-DIABAN-04 | `admin_dang_tin` (`20260903d`) với `district = "Đức Hoà, Long An"` và không có `district`, JWT admin giả | ghi "Đức Hoà, Long An" / mặc định "Quận 5" | ✅ 03/09 |

### TS-THONGSO — tin rao có cấu trúc: bóc từ mô tả, cột đã có thì không hỏi (FR-172)
DB thật qua MCP sau `20260902e` + `20260902f`, trên 173 tin (164 có mô tả). Ca 01–08 là số đo bao phủ (chốt chống hồi quy khi sửa regex — giảm là phải giải thích), 09–15 là hành vi. Giới hạn biết mà chưa vá: "306m² (4,2mx22m)" là tổng sàn (6 tin `dt_lech` > 35%); "cách mặt tiền 40m" đi cùng "nhà mặt tiền" trong cùng bài; chung cư gán nhầm `nha_pho` thì "tầng 25" ra null (dải 1–30 chặn), không ra sai.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-THONGSO-01 | ngang × dài từ "4x16m", "4m x 15m", "3m6 x 16", "ngang 4.6m dài 13.2m", "4*15" | ≥ 115/164 có `frontage_m` | ✅ 02/09 (ngang 121, dài 118, nở hậu 11) |
| TS-THONGSO-02 | số tầng "1 trệt 3 lầu" (=4), "5 tầng", "x 3T", "trệt, lầu" (=2), "nhà C4" (=1); chung cư "tầng 25" → `floor` | ≥ 135/164; 2 chung cư có `floor` | ✅ 02/09 (141; floor 2) |
| TS-THONGSO-03 | đường vào: "mặt tiền"/"MT"/"2MT" → MT; "HXH"/"xe hơi vô" → HXH; "HXT"/"xe tải" → HXT; "nhà hẻm … cách mặt tiền 20m" → HẺM; "hẻm hông 6m" không tính | ≥ 120/164 | ✅ 02/09 (126: MT 53, HXH 42, HXT 9) |
| TS-THONGSO-04 | hẻm rộng "hẻm 4m", "HXH 5.5m", "đường rộng 8m"; cách MT "cách mặt tiền 40m" | số hợp lý (1–40 m / 5–500 m) | ✅ 02/09 (hẻm 25, cách MT 19) |
| TS-THONGSO-05 | pháp lý "sổ hồng riêng/SHR" → `so_hong_rieng`; "sổ hồng/đỏ" → `so_hong`; "sổ chung"; "hoàn công"/"chưa hoàn công" → bool; "pháp lý rõ ràng" trơ → không đoán | ≥ 70/164 | ✅ 02/09 (75; hoàn công 37; quy hoạch 6) |
| TS-THONGSO-06 | PN/WC "4PN 5WC", "3 phòng ngủ 4 nhà vệ sinh", "Số phòng ngủ: 4" | PN không ghi đè giá trị đã có (79 giữ nguyên), WC ≥ 60 | ✅ 02/09 (PN 81, 0 lệch; WC 63) |
| TS-THONGSO-07 | tiện ích: thang máy, xe hơi vô nhà, căn góc, nội thất, năm xây, hướng (chỉ chữ la bàn sau "hướng"), TL, "đang cho thuê 20 triệu/tháng" (chỉ tin bán) | có, không bịa | ✅ 02/09 (thang máy 10, góc 21, nội thất 25, năm 4, hướng 7, TL 52, thuê 17) |
| TS-THONGSO-08 | `street` từ `location_raw`: "Số 1xx, Đường Trần Hưng Đạo" → "Trần Hưng Đạo"; "Hẻm xx/, Đường Hồ Thành Biên" → "Hồ Thành Biên"; "Phường 2, Quận 5" → null | mọi tin có tên đường trong địa chỉ | ✅ 02/09 (159/164; 5 tin chỉ ghi phường → null) |
| TS-THONGSO-09 | `listing_missing_facts` sau backfill | giảm rõ, KHÔNG về 0 | ✅ 02/09 (1.140 → 638; còn nhiều nhất hướng 152, quy hoạch 139, năm xây 137) |
| TS-THONGSO-10 | `price_per_m2_vnd` cho mọi tin có giá + diện tích; tin thuê theo tháng | 164/164 | ✅ 02/09 (thuê 70 tr/64m² → 1,1 tr/m²/tháng) |
| TS-THONGSO-11 | e2e THONGSO-01: dòng KHO gửi model | "4x12.5m · trệt + 2 lầu · 3WC · hẻm xe hơi 6m · sổ hồng riêng, hoàn công" | ✅ 04/09 |
| TS-THONGSO-12 | e2e THONGSO-02: khách gõ mã căn | khối "căn khách đang nhắc" mang "hẻm xe hơi 6m" + "sổ hồng riêng" | ✅ 04/09 |
| TS-THONGSO-13 | bậc nguồn khi fact chảy vào cột (`20260902g`): tin `boc_mo_ta` → (1) chủ `ket_cau` "trệt 3 lầu, 4 toilet"; (2) admin đặt hẻm 4 rồi chủ nói "hẻm 6m xe tải"; (3) `admin_form` "hẻm 3m" sau; (4) view thiếu | (1) floors 4, WC 4, `chu_xac_nhan`; (2) hẻm 6 `hem_xe_tai` — chủ đè admin (FR-164 a); (3) vẫn 6 — admin không đè chủ; (4) 0 câu thiếu | ✅ 02/09 (rollback, kho vẫn 173) |
| TS-THONGSO-14 | bộ 20 câu mẫu qua `boc_thong_so()`: "hẻm 2m xe máy, giấy tay"; "cách mặt tiền 30m, đang cho thuê 25tr/tháng"; "hầm trệt lửng 4 lầu, thang máy"; "nhà 4 tấm"/"2 tấm rưỡi"; "60 m 2, hẻm 2.5m"; "hẻm 2 xẹt"; chung cư "tầng 5 lầu"; cấp 4 "được xây 3 tấm" | mọi khoá đúng, không bịa | ✅ 03/09 20/20 (vá 20260903c: hẻm 2m, ngang 30 m, `p_type` NULL, "tấm") |
| TS-THONGSO-15 | fact `question` chữ tự do → cột (`ap_thong_so`): (A) CTV "pháp lý" → "sổ hồng riêng, hoàn công"; (B) "hẻm mấy mét" → "hẻm 4m xe hơi"; (C) chủ `so_phong_ngu` "3"; (D) CTV `bo_sung` "sổ hồng chung, 5PN" SAU chủ; (E) chủ "sổ hồng chung"; (F) "còn bán, bớt được chút" | (A) SHR + hoàn công bậc admin; (B) hẻm 4 HXH; (C) 3 PN `chu_xac_nhan`; (D) không đè; (E) đè được; (F) không đụng cột | ✅ 03/09 (rollback) |

### TS-SEO — nền SEO: trang tag SSG, sitemap, robots, canonical, JSON-LD (FR-12/17, NFR-09)
Dựng theo IA §4.4 sau nghiệm thu 04/09 (OPEN-44). 01–04 chạy trong sandbox, 05–06 cần Vercel. Trang tag dùng cùng luật lọc với `/mua-ban`; `revalidate = 3600` nhưng bảng build in `5m` vì `coverByCode` (unstable_cache 300 s) — cố ý.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-SEO-01 | `bun run build`, bảng route | `/[tag]` là `●` đủ số tag của `lib/tags.ts`; `/sitemap.xml`, `/robots.txt` có; `/nha-dat/[code]` vẫn `●` | ✅ 04/09 (83 trang tĩnh: 17 + 64 tag + 2) |
| TS-SEO-02 | `bun -e 'import {TAG_DEFS} from "./lib/tags.ts"; …'` | slug không dấu, chữ thường, gạch nối, `ty` không `tỉ`, duy nhất; keyword hiển thị giữ "tỉ" | ✅ 04/09 (64 slug duy nhất) |
| TS-SEO-03 | `relatedTags(t)` | 6–8 tag, không chứa chính nó, ưu tiên cùng giao dịch + loại + khu | ✅ 04/09 |
| TS-SEO-04 | `/ban-nha-hem-xe-hoi-quan-5` trên `next start` | H1 = keyword, mô tả 80–120 từ, lưới lọc `access_type in (mat_tien, hem_xe_tai, hem_xe_hoi)`, 8 tag liên quan; `/abc-xyz` → 404 | ⏭ sandbox không tới Supabase (lưới rỗng → hộp Zalo, đúng luật) |
| TS-SEO-05 | `curl -s https://nhadat.cc/sitemap.xml \| grep -c '<loc>'` | ≥ 8 tĩnh + 64 tag + số tin lên kệ (~165) | ⏭ chờ deploy |
| TS-SEO-06 | trang tin: `application/ld+json` + canonical + OG | một `RealEstateListing`, `identifier` = mã, `offers.price` = `price_vnd`, `address` chỉ tới phường (FR-104); canonical = URL tin; OG = ảnh thật nếu có | ⏭ chờ deploy; kiểm tĩnh `jsonLd()` không dùng `location_raw` |

### TS-ADM2 — admin buyer side (FR-71/74/75/76/77/78/80)
Migration `20260904c_admin_buyer_side.sql` + thẻ mới `app/admin/page.tsx`. 01–09 là MỘT khối `do … raise exception 'KQ: …'` (chép ở cuối migration, chạy RIÊNG sau khi áp): dựng buyer/hội thoại/câu hỏi/lịch xem bằng vai chủ, rồi `authenticated` với email admin lấy từ bảng `admins`, rồi `anon`. Chạy lại sau MỌI migration đụng RLS sáu bảng này. Cố ý chưa làm: bảng theo hội thoại FR-71 (cần FR-72), lọc thời gian FR-74, email FR-81, nhãn "tiêu cực" FR-77 (`needs_human` là proxy [giả định BA]).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-ADM2-01 | admin đọc `info_requests` dòng thử (`buyer_ask`, trigger FR-173 chạy bình thường) | 1 dòng | ✅ 04/09 |
| TS-ADM2-02 | admin đọc `viewings` của buyer thử | 1 dòng | ✅ 04/09 |
| TS-ADM2-03 | admin đọc `buyers` — policy mở cả bảng, web chỉ chọn `id, name, zalo_user_id, preferences, last_contact_at, created_at` | 1 dòng; `page.tsx` không có chuỗi `phone` trong select | ✅ 04/09 |
| TS-ADM2-04 | admin đọc `messages` của hội thoại thử | 1 dòng | ✅ 04/09 |
| TS-ADM2-05 | admin đọc `ctvs` (web chỉ chọn `name` qua join) | = số CTV thật | ✅ 04/09 (2) |
| TS-ADM2-06 | admin đọc view `khach_can_nguoi_that` lọc `conversation_id` thử | 1 dòng, `ten` = tên buyer, `tin_khach_cuoi` = tin vừa chèn | ✅ 04/09 |
| TS-ADM2-07 | admin đọc view `hoi_thoai_thong_ke` | đủ 30 dòng kể cả ngày trống; hôm nay (giờ VN) `tin_khach` = 1 | ✅ 04/09 |
| TS-ADM2-08 | anon đếm `info_requests`, `buyers`, `conversations` (GRANT có, policy không) | 0 / 0 / 0 | ✅ 04/09 |
| TS-ADM2-09 | anon `select` hai view | `42501` — đã revoke, không phải "0 dòng" | ✅ 04/09 |
| TS-ADM2-10 | sau rollback: dữ liệu thử = 0; hai view vai `postgres` không JWT → 0; `pg_policies` đủ 6 `*_admin_read`; grant view chỉ `authenticated`/`service_role` SELECT | như kỳ vọng | ✅ 04/09 (`ctv_ranks` cũ còn INSERT/UPDATE thừa, vô hại) |
| TS-ADM2-11 | UI: đăng nhập admin thật mở `/admin` — năm thẻ mới hiện, không dòng "Không đọc được"; truy vấn đợt đầu bắn song song (FR-171 j); câu `pending` quá `sla_due_at` chữ cam; tìm khách không lộ SĐT, "Mở Zalo" chỉ ở dòng có uid | như mô tả | ⏭ cần trình duyệt; `tsc --noEmit` + `bun run build` xanh 04/09 |
| TS-ADM2-12 | UI FR-80 + CSV: > 20 tin `cho_thong_tin` → "trang 1/2 · N mục", Trước/Sau, kẹp về trang 1; "Tải CSV" → `hoi-thoai-30-ngay-<ngày>.csv` BOM UTF-8, 31 dòng | như mô tả | ⏭ cần trình duyệt |

### TS-MATCH — tin mới khớp tiêu chí + cảm nhận sau xem + bản đồ (FR-64/56/54)
Migration `20260904d` + `nudge` v24. 01–07 một khối `do … raise exception` trên DB thật; 08–09 trên `nudge` đang deploy với dữ liệu `TEST-` commit rồi xoá, `dry_run: true`. Hồ sơ khách thử `{area:"phường 8 quận 5", budget:"5 tỷ", deal:"ban"}`. Lưu ý: trigger FR-64 khớp cả khách THẬT có hồ sơ "Quận 5, tầm 5 tỷ" — từ giờ mỗi tin thật lên kệ là có khách được nhắn ở nhịp cron kế; van 1 tin/khách/24h đổi ở `bao_tin_moi_khop`, không ở `nudge`.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-MATCH-01 | tin P8 Q5, 5,2 tỷ, 45,5 m², mặt tiền → `dang_ban` | khách x đúng 1 `match`, note "#mã · Phường 8, Quận 5 · 5.2 tỷ · 45.5m2 · mặt tiền"; khách y (không Zalo) 0 | ✅ 04/09 (sửa `to_char … FM`: "40m2" không thành "4m2") |
| TS-MATCH-02 | tin P3 Q5, 5,2 tỷ | x (nêu P8) 0; z (`area:"Quận 5"`, không `deal`) 1 — quận chỉ là dự phòng; w (im 40 ngày) 0 | ✅ 04/09 |
| TS-MATCH-03 | tin P8, 9 tỷ | 0 (5 tỷ ngoài dải 0,7×–1,15×) | ✅ 04/09 |
| TS-MATCH-04 | tin thứ hai P8, 5 tỷ, cùng ngày | 0 (van 1 tin/khách/24h); z đã có `match` cũng không nhận thêm | ✅ 04/09 |
| TS-MATCH-05 | (a) tin sang `dang_quan_tam` rồi về `dang_ban`; (b) tin thuê P8 5 tỷ; (c) tin `cho_thong_tin` không giá rồi `update … set price_raw` | (a) không sinh thêm; (b) 0; (c) 1 — BEFORE trigger tự lật `dang_ban` (FR-144) | ✅ 04/09 |
| TS-MATCH-06 | `viewings.slot` = +2h, nhắc `viewing` → `sent` | 1 `feedback`, `listing_id` = tin buổi xem, `due_at` = slot + 4h; đánh `sent` lần nữa không đúp | ✅ 04/09 |
| TS-MATCH-07 | `anon` gọi `bao_tin_moi_khop` | `has_function_privilege = false` | ✅ 04/09 |
| TS-MATCH-08 | `nudge` v24 `dry_run` với 3 nhắc `match`/`viewing` (tin có lat/lng)/`feedback` | 200; `match` và `feedback` mẫu cố định không gọi model; `viewing` có "Bản đồ: https://maps.google.com/?q=lat,lng"; `sent = none`, không dòng mới, không `bot_errors` | ✅ 04/09 (done=10, 0 lỗi, dọn sót 0) |
| TS-MATCH-09 | deploy v24: bun bundle → `deploy_edge_function` (`verify_jwt=false`) → `get_edge_function` kéo ngược → so byte | trùng byte | ✅ 04/09 (19.067 byte, SHA-256 `35152a33…`) |

### TS-WEB2 — search NL, upload ảnh, dự án, danh sách riêng, giấy tờ
Luồng WEB (FR-01/02/03/04/08/09/10, FR-70/73 web, FR-96, FR-99 web, FR-100, FR-117, NFR-06) + `20260904g`. **P** = policy/RPC trên DB thật (khối `do … raise` cuối migration, chạy lại sau mọi lần đụng RLS `storage.objects`/`listing_media`/`curated_lists`; sau khối mọi bảng thử = 0); **S** = bóc câu qua `next start` + curl; **W** = trang web. Sandbox chặn host Supabase nên ca cần DB từ web ⏭ (trên Vercel chạy như trang cũ).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-WEB2-P01 | người bán đăng nhập (`sellers.auth_user_id`) insert `storage.objects` `listing-public` `<uuid tin mình>/a.jpg` | được | ✅ 04/09 |
| TS-WEB2-P02 | cùng người, `<uuid tin người khác>/b.jpg` | chặn | ✅ 04/09 (42501) |
| TS-WEB2-P03 | cùng người, bucket `listing-private` | chặn | ✅ 04/09 (42501) |
| TS-WEB2-P04 | người bán insert `listing_media` (public) tin mình, đọc lại | được, đọc = 1 | ✅ 04/09 |
| TS-WEB2-P05 | người bán insert `listing_media` tin người khác | chặn | ✅ 04/09 (42501) |
| TS-WEB2-P06 | người bán gọi `tao_danh_sach` | chặn | ✅ 04/09 (42501) |
| TS-WEB2-P07 | admin (JWT email trong `admins`): insert object public mọi đường dẫn + private + SELECT object private + `listing_media` `so_do` private | được cả bốn | ✅ 04/09 |
| TS-WEB2-P08 | admin `tao_danh_sach([A, B], 'TS-WEB2 ds')`; rồi mã lạ | `{token 24 hex, n=2}`; mã lạ → "Khong co tin" | ✅ 04/09 |
| TS-WEB2-P09 | anon `doc_danh_sach(token)`; token sai | có `listings`, không `buyer_id`; NULL | ✅ 04/09 (n=1: tin B thiếu DT nên FR-164 giữ nháp — đúng luật) |
| TS-WEB2-P10 | anon `select curated_lists`; insert `storage.objects`; đếm `listing_media` private | chặn; chặn; 0 | ✅ 04/09 |
| TS-WEB2-S01 | `GET /api/search?q=tìm mua nhà phố HXH 8 tỉ ở Q5` | ban, nhà, HXH, 6,8–9,2 tỉ, Quận 5; title "Mua nhà phố hẻm xe hơi khoảng 8 tỉ, Quận 5"; url `/mua-ban?gmin&gmax&vao=hxh&loai&q` | ✅ 04/09 |
| TS-WEB2-S02 | câu S01 không dấu | y hệt S01 | ✅ 04/09 |
| TS-WEB2-S03 | `thuê căn hộ 2 phòng ngủ dưới 15tr/tháng phường 4` | cho_thue, chung_cu, P4, max 15 tr, 2 PN; url `/cho-thue?phuong&gmax=15000000&pn=2&loai=chung_cu&q` | ✅ 04/09 |
| TS-WEB2-S04 | `ban nha mat tien duong Tran Binh Trong quan 5 duoi 5 ty` | mt, street "Tran Binh Trong", max 5 tỉ; `duong=` → ilike `street` | ✅ 04/09 |
| TS-WEB2-S05 | `đất Bình Chánh 5-8 tỷ gần chợ Bình Điền` | dat, `quan=` Bình Chánh, 5–8 tỉ, `moc=` "chợ Bình Điền" giữ dấu | ✅ 04/09 |
| TS-WEB2-S06 | `cho em hỏi giá nhà ở đây thế nào` (không tín hiệu mạnh) | `empty: true`, url `/mua-ban?q=`; hộp "Câu này tụi em chưa hiểu hết — nhắn Zalo" (loại BĐS một mình chưa đủ) | ✅ 04/09 |
| TS-WEB2-S07 | `ban nha hxh phuong 5` / `cần thuê mặt bằng Q5` | khớp tag → `/ban-nha-hem-xe-hoi-phuong-5-quan-5` / `/cho-thue-mat-bang-quan-5` | ✅ 04/09 |
| TS-WEB2-S08 | `?go=1` với S01 và S06 | 302 → url tương ứng | ✅ 04/09 |
| TS-WEB2-S09 | `POST /api/listing/parse` "Bán nhà HXH xe tải quay đầu, gần ngã tư Trần Bình Trọng, 4x16 một trệt hai lầu, 3PN, sổ hồng riêng, phường 5 Q5, 9 tỉ bớt lộc" | ban, nha_pho, P5/Q5, mốc "ngã tư Trần Bình Trọng", 3 PN, `price_raw` "9 tỉ" → 9e9, HXH, 4×16, area 64 (`needs_review`), floors 3, SHR, negotiable | ✅ 04/09 (sửa: từ dừng "tư", price_raw dính, "một trệt hai lầu") |
| TS-WEB2-S10 | `POST /api/search {"q":"nha 3pn q5"}`; `GET ?text=cho thue mat bang duong nguyen trai q5 dt 60m2 15tr/thang` | 200 JSON; mat_bang + street + 60 m² + 15 tr/tháng, không đọc "60 m2" thành 60 triệu | ✅ 04/09 |
| TS-WEB2-W01 | `/` có 3 khối FR-01 + "Hỏi bất kỳ, có tức thì" + ba vế FR-04 | có | ✅ 04/09 |
| TS-WEB2-W02 | `/` form `action="/api/search"` + placeholder "tìm mua nhà phố HXH 8 tỉ ở Q5" | có, không cần JS | ✅ 04/09 |
| TS-WEB2-W03 | `/mua-ban?q=…` | `<meta name="robots" content="noindex, follow">` + dải "Tìm thấy N tin theo yêu cầu: …" | ✅ meta · ⏭ dải (DB) |
| TS-WEB2-W04 | `/mua-ban?q=cho+em+hoi+gia` | hộp Zalo "Câu này tụi em chưa hiểu hết…" | ✅ 04/09 |
| TS-WEB2-W05 | trang tin: `WardMap` chỉ vẽ khi phường có toạ độ, lat/lng xoá trước khi vào `MapView` | kiểm tĩnh (tsc) | ✅ tsc · ⏭ trình duyệt |
| TS-WEB2-W06 | `/admin` thẻ BĐS hot / Độ trễ bot khi view chưa có | thẻ ghi "chưa có dữ liệu", thẻ khác vẫn tải (`hot.error`/`tre.error` tách `setLoi`) | ✅ tĩnh · ⏭ trình duyệt |
| TS-WEB2-W07 | `UploadAnh`: up file → ghi dòng; ghi hỏng → remove file; lỗi từng tấm ra UI | kiểm tĩnh | ✅ tsc · ⏭ trình duyệt (P01–P05 đã kiểm hàng rào) |
| TS-WEB2-W08 | trang tin dòng FR-99 | ẩn khi < 3 tin khác; tự loại chính tin | ✅ tĩnh `soSanhGia` · ⏭ DB (P1 có 23 tin có giá/m²) |
| TS-WEB2-W09 | `/ds/abcdefabcdefabcdefabcdef` | `<meta robots noindex, nofollow>`; trang "hết hạn" + Zalo, không 404 | ✅ meta · ⏭ nội dung (RPC) |
| TS-WEB2-W10 | `bun run build` | `/du-an/[slug]` ●, `/nha-dat/[code]` ●, `/[tag]` ●, `/ds/[token]` ƒ, `/api/*` ƒ | ✅ 04/09 (sandbox prerender 0 đường nha-dat/du-an vì host chặn) |
| TS-WEB2-W11 | `/admin` "Xem giấy tờ" → `createSignedUrl(path, 900)`; đường dẫn không in ra | kiểm tĩnh | ✅ tĩnh · ⏭ trình duyệt (P07 đã kiểm SELECT private) |
| TS-WEB2-W12 | `bunx tsc --noEmit` | sạch | ✅ 04/09 |
| TS-WEB2-W13 | `/robots.txt` chặn `/ds/`, `/api/`; `/sitemap.xml` có `/du-an/<slug>` | có | ✅ robots · ⏭ sitemap (DB) |

### TS-GIUCHAN — giữ chân 5 ngày, vòng đời, email (FR-60…65/70/72/73/81/103/108/110/52)
Migration `20260904f` + `nudge` v25 + cron `info-timeout-tick`, `stale-listing-tick`. 01–05 khối `do … raise exception` (uid `TEST-gc-*`); 06 một `net.http_post` thật tới ntfy; 07–08 trên `nudge` đang deploy, dữ liệu `TEST-GCN` commit rồi xoá, `dry_run: true`. Nên biết: câu `xac_nhan_lich` mở với `source='buyer_ask'` nên ĐẾM vào `ctv_ranks` [giả định BA]; FR-103 chỉ hỏi tin CÓ chủ (158 tin Excel không chủ không bao giờ được hỏi); `email_admin` với `admin_email` rỗng im hoàn toàn — chủ ý.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-GIUCHAN-01 | vòng đời một khách (FR-108/70/52/57/65/110/103): `mark_listing_interest` ×2 → `buyer_ask` → lịch xem → CTV `xac_nhan_lich` → nhắc `match` `sent` → `deals` → `da_chot` ×2 → `ghi_danh_gia(4)` rồi `(5)` → 3 câu hỏi cũ + `info_request_timeout_tick()` → tin cũ 31 ngày + `stale_listing_tick()` ×2 → giơ cờ + VOICE | interests 1; `property_events` 6 loại ×1; escalation lịch 1, không escalation mặc định; `confirmed` + followup; `sold` 1 có căn thay thế; rating 4 (5 không cộng); tick `{nhac_24h, het_han_seller, het_han_buyer_ask}` đúng; stale 1 rồi 0; `bot_errors` 0 | ✅ 04/09 đúng cả (timeout `{2,1,1}`; stale đi nhánh CTV vì chủ chưa có Zalo) |
| TS-GIUCHAN-02 | van FR-108: cùng tin `da_chot` lần hai | không thêm `sold` (index + van 24h) | ✅ 04/09 |
| TS-GIUCHAN-03 | FR-103 trần và lặp: `stale_listing_tick()` hai lần cùng ngày | lần 2 không hỏi lại tin vừa hỏi | ✅ 04/09 |
| TS-GIUCHAN-04 | ba view qua vai admin: 5 tin cách 10'/40'/5'/2h → `hoi_thoai_phien`; `interests` → `bds_hot`; 2 dòng ledger 1,2 s / 4,8 s → `bot_do_tre`; đọc `property_events` | 3 phiên `2/buyer, 2/buyer, 1/bot`; `bds_hot` 1 dòng/tin; `so_luot=2`, `p95≈4,6`; admin đọc được | ✅ 04/09 (`listing_views` chưa thử: FK `auth.users`, chưa có user auth) |
| TS-GIUCHAN-05 | anon: đọc 3 view, SELECT `property_events`, EXECUTE `ghi_danh_gia`/`can_cung_khu`/`mark_listing_interest`/`info_request_timeout_tick`/`canh_bao_ngoai` | tất cả chặn | ✅ 04/09 |
| TS-GIUCHAN-06 | ntfy email thật: `net.http_post` tới ntfy.sh với `email:` | 200, hoặc mã lỗi cho biết vì sao | ⚠️ 04/09 `400 40053 anonymous email sending is not allowed` — cần tài khoản + `NTFY_TOKEN` (đã mở đường đọc Vault; FR-81 / SRS-5.5 chờ chủ dự án) |
| TS-GIUCHAN-07 | deploy `nudge` v25: bun bundle → `\uXXXX` → UTF-8 → `deploy_edge_function` (`verify_jwt=false`) → `get_edge_function` → so byte | trùng byte | ✅ 04/09 (24.203 byte, SHA-256 `d7fb2323…`) |
| TS-GIUCHAN-08 | `nudge` v25 `dry_run` (secret từ Vault trong SQL): (a) kho thật; (b) `TEST-GCN`: 5 nhắc `sold`/`followup` chủ chưa phản hồi/`followup` lịch/`feedback`/`rating`; khách im 6,5 ngày; khách im 5,2 ngày có căn cuối | (a) 200, không `bot_errors`; (b) năm mẫu đúng chữ không gọi model; 6,5 ngày → `giu_ket_noi` "nhắn lại em một chữ thôi, kẻo Zalo tự ngắt"; 5,2 ngày → `can_cuoi` kèm `#mã`, `kho>0`; `sent=none` | ✅ 04/09 (a) done=7; (b) done=14, đúng cả, dọn sót 0 |

### TS-V48 — chat-reply v48 (FR-27/31/45/65/79/99/105/108/114/116)
Mười FR có tài liệu mà bot chưa làm (lộ ở §10.8): `chat-reply` v48 + `_shared/prompts.ts` (`human_chat_rules`, `buyer_fewshot` đồng bộ xuống `bot_prompts` bằng SQL sinh từ file). Chạy trong e2e (74 → 102 kịch bản), lần cuối trên nội dung kéo ngược sau deploy. Cố ý chưa làm (ghi ở `02` từng FR): hai thời điểm xin đánh giá còn lại FR-65; thẻ voice riêng `/admin` FR-79; FR-99 phía bán + nguồn giá ngoài (OPEN-10); chọn dự án ở `/raoban` FR-114; "tin chốt → báo mọi B" tầng DB; duyệt ảnh tay FR-105.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-V48-105a…c | fact chủ nhà có SĐT + "zalo 0903…" + "nhà số 12 Trần Hưng Đạo"; model trả lời có số | prompt gửi model không còn số, có "[liên hệ qua Zalo]", bỏ "số 12" giữ tên đường; bong bóng gửi khách không số; `location_raw` trong KHO giữ số nhà (OPEN-36) | ✅ 04/09 |
| TS-V48-105d | chính chủ trả lời câu chờ kèm SĐT | nhánh bán KHÔNG lọc, fact giữ số để CTV gọi | ✅ 04/09 |
| TS-V48-108a…c | khách nhắc căn; `ask_owner` một căn; overload thiếu (PGRST202) | `mark_listing_interest(p_codes, p_buyer_id)` + dòng `interests`; căn nhờ hỏi chủ cũng vào; overload thiếu → gọi bản cũ + `bot_errors`, khách vẫn có trả lời | ✅ 04/09 |
| TS-V48-45 | khối luật + few-shot | có "Trong khi chờ, anh/chị có câu hỏi gì khác về căn này không ạ?", `voice_request=true`, "giá TB phường", CĂN TƯƠNG TỰ, CHẤM SAO | ✅ 04/09 |
| TS-V48-31a | hỏi căn ĐÃ GỠ (P12, 9 tỷ, HXH); kho có P12 8 tỷ HXH / 12 tỷ / 7 tỷ MT | CĂN TƯƠNG TỰ có 8 + 7 tỷ (0,7–1,3×), không 12 tỷ, HXH trước; không lộ địa chỉ/giá căn đã gỡ | ✅ 04/09 |
| TS-V48-31b | bot vừa nói #0006; khách "còn căn nào giống giống vầy không" | căn gốc = #0006 từ lịch sử, tương tự có #0008 | ✅ 04/09 |
| TS-V48-27a…c | căn có 6 hình, khách xin hình; rồi "xem thêm" | 4 tấm đầu + "xem thêm hình không ạ?" + `photo_offset={code,n:4}`; "xem thêm" → 2 tấm kế, hết thì không hỏi, offset xoá | ✅ 04/09 |
| TS-V48-79a…d | người lạ "alo được không em, gọi cho anh đi"; lặp; model bật `voice_request`; model hỏng + không dấu | không hỏi vai; `need_human`; `reminders(escalation, 'VOICE: <uid>…')`; 24h không đẻ thêm; câu mẫu "gọi lại" khi model hỏng | ✅ 04/09 |
| TS-V48-65a…c | nhắc `feedback` `sent` 1h trước, "4 sao em"; 3 ngày trước, "3/5"; RPC thiếu | `ghi_danh_gia(buyer, tin buổi xem, 4)` + `rated:4`; quá 48h không ghi; RPC thiếu → `bot_errors`, khách vẫn có trả lời | ✅ 04/09 |
| TS-V48-116a…c | "căn A12-05 dự án Ny'ah còn không" (giữ chỗ, xác nhận 10 ngày trước); "căn B9-99"; "#BDS… còn không" (`con_ban` vừa xác nhận) | khối CĂN TRONG DỰ ÁN đúng căn, "đang giữ chỗ", "QUÁ 7 NGÀY" → ask_owner, không lộ căn khác; mã không có → nói thật; dòng căn nhắc mang dự án + "chủ xác nhận 0 ngày trước" | ✅ 04/09 |
| TS-V48-114 | rao "bán căn A12-05 dự án Ny'ah giá 6 tỷ 60m2"; rao không dự án (114b) | tin gắn `project_id` + `unit_code A12-05` + `unit_status con_ban` + `last_confirmed_at`; hàng lẻ → null | ✅ 04/09 |
| TS-V48-99a…c | hồ sơ P4 + tầm 6 tỷ, hỏi "#… giá vậy ok không"; lượt kế; chưa đủ hồ sơ | KHO kèm "giá TB phường 4 (bán): 116 tr/m² (1 tin)"; hai lượt ≤1 truy vấn (nhớ tạm 60 s theo `deal\|phường`, không nhớ kết quả rỗng); chưa đủ hồ sơ → không truy vấn | ✅ 04/09 |
| TS-V48-DEPLOY | bun bundle (`--minify-whitespace`, `\uXXXX` → UTF-8) → `deploy_edge_function` (`verify_jwt=false`) → `get_edge_function` → so byte | trùng 100% | ✅ 04/09 (92.388 byte, SHA-256 `6eb8de75…`; e2e trên bản kéo ngược 102/102) |
| TS-V48-PROMPTS | md5 `bot_prompts` ↔ hằng TS | trước ghi 8/8 khoá khớp (không đè sửa tay); sau ghi `human_chat_rules` `b4633cc2…`, `buyer_fewshot` `90f602df…` = TS | ✅ 04/09 |
| TS-V48-LIVE | `net.http_post` uid `TEST-e2e-v48`: "nhà 3PN phường 8 tầm 5 tỷ"; rồi "mua, nhà 3PN phường 8 tầm 5 tỷ" | 200 hỏi vai (không tốn model); 200 nhánh model: hồ sơ `{deal:ban, area:"Phường 8", budget:"tầm 5 tỷ", bedrooms:3}`, hai bong bóng, `bot_errors` 0; dọn sạch | ✅ 04/09 |

## 10.8 Nghiệm thu theo từng tài liệu (04/09/2026)

Đi từ `00` xuống từng tầng, đối chiếu từng khẳng định với code ở HEAD và DB thật
(chỉ đọc; ca ghi bọc `do … raise`), đồng thời chạy lại toàn bộ suite §10.7 chạy
được trong sandbox. Lệch nhỏ sửa cùng commit; lệch lớn thành OPEN-43/44/45.

### 10.8.1 Kết quả suite §10.7 (chạy lại 04/09/2026)

| Suite | Kết quả | Ghi chú |
|---|---|---|
| TS-E2E (`bash chay.sh`) | ✅ 74/74 (sáng) → 102/102 (sau v48) | gồm CTV, DIABAN, THONGSO, TOIUU |
| `fr159` / `fr161` / `fr164` `.mjs` | ✅ 65 / 9 / 8 | |
| TS-CHATREPLY-01…04, TS-RENT-01…05 (bot thật qua `net.http_post`) | ✅ 9/9 | uid `TEST-e2e-*`, dọn sau |
| TS-CACHE-01…03 | ✅ | 04/05 ⏭ Vercel |
| TS-SEC-01…10 | ✅ 8 · ❌ 1 → vá · ⏭ 1 | TS-SEC-08 `agents_public` (vá `20260904b`) |
| TS-SEC2-01…66 + kho file | ✅ · ❌ 1 (62: câu bất biến, đã sửa câu) · ⏭ H1…H8 | |
| TS-HQ-01…12 | ✅ 12/12 | 05–11 kiểm tĩnh |
| TS-LOG-01/02/06 · TS-HEALTH-02/03/04/07/08 | ✅ | còn lại ⏭ cần HTTP/bridge/trình duyệt |
| TS-GIA, TS-SPECS, TS-HANG, TS-DANGTIN, TS-NEO-01, TS-MA-01, TS-KD-05 | ✅ | |
| TS-IDEM-01…06, TS-IDEM2-I | ✅ | IDEM-06 kỳ vọng lỗi thời (đã sửa dòng) |
| TS-TOANVEN · TS-OUNG | ✅ · ❌ 02b/03 · ❌ 01/02/04/08 → vá | FR-164 gãy (vá `20260904b`), chạy lại xanh |
| TS-KHO-01…14, 20…25 | ✅ | 15…19 ⏭ worker; 06 ghi tiền đề |
| TS-JOB-01…30, TS-TIEN-01…07, TS-CHUONG-01…07 | ✅ 44/44 | |
| TS-LIVE | ⏭ | bridge im từ 27/08 |

Đỏ thật, đã vá bằng `20260904b_nghiem_thu_theo_tai_lieu.sql`: (1) **FR-164 gãy
tầng DB từ 02/09** — `20260902e` viết lại `listing_facts_sync_cols` làm rơi bốn
nhánh `gia`/`phuong`/`loai_bds`/`dien_tich_tim_tuong`, không ai thấy vì
`listing_facts` thật rỗng và TS-THONGSO-13 chỉ thử cụm thông số; cấy lại luật
20260828b/d + dải giá tin thuê. (2) **`/moi-gioi` trống từ 27/08** —
`agents_public` invoker, anon 0/3 → view definer tự chứa. (3) **Người bán web
tự đăng tin vỡ 42501** — cấp EXECUTE `parse_vnd`/`guess_property_type` cho
`authenticated`. (4) Dọn: `lan_thu_ke` thu hồi khỏi anon (SRS-3.12), xoá hàm mồ
côi `listing_facts_touch_status`, enum mồ côi `rating_target`.

### 10.8.2 Kết luận theo tài liệu (gộp 10.8.3 sao Bắc Đẩu; trạng thái sau khi dựng thêm §10.8.4)

| Tài liệu | Buổi sáng (đúng / một phần / sai) | Trạng thái sau 04/09 |
|---|---|---|
| `00` Định hướng (v1.2 → v1.3) | 73 khẳng định: 50 / 20 / 3 | sửa §0.6 (bridge dừng), §0.7 (173 tin là import, chưa phải bằng chứng "rao một câu"), OPEN-26/28; `/quan-ly` gỡ `Quận 5` cứng |
| `02` FR-01…90 | 21 / 28 / 16 chưa | RET (FR-60…65) + ADM (FR-70…81) + WEB dựng chiều — TS-GIUCHAN, TS-ADM2, TS-WEB2; còn treo ghi tại từng FR (OPEN-43) |
| `02` FR-91…174 | 60 / 10 / 10 chưa · 3 deprecated | lệch chữ FR-133/137/110/100/108 ghi chú vào `02`; 10 FR bot dựng ở v48 (TS-V48) |
| `02` NFR-01…18 | 8 / 5 / 5 chưa đo | NFR-09 SEO dựng (TS-SEO); NFR-02/05/14 vẫn chưa có số đo |
| `03` UF-01…13 | 4 / 5 / 4 | UF-06/07/13 nửa sau: curated list + upload dựng; email cần tài khoản ntfy; fingerprint chưa (OPEN-43) |
| `04` IA | 8 trang đặc tả chưa có, 10 route IA chưa ghi | trang tag/SEO dựng (OPEN-44); IA cập nhật đợt sau |
| `05` WF-01…14 | 2 / 6 / 6 | nhãn "Nhã Đạt CC" → Aioinhadat (sửa); còn lại theo OPEN-43/45 |
| `06` UI | tone 8/8; TONE_RULES #5 mâu thuẫn; DB↔TS lệch 3 khoá | #5 → "một tin một thông tin"; `bot_prompts` = `prompts.ts`; token lệch `06 §6.2` → OPEN-45 |
| `07` SRS | cron 10/10; RPC service_role đúng trừ `lan_thu_ke`; AC 1 ✅ / 3 ⚠ / 9 ❌; 2.1 còn Zalo SSO/Realtime/Logstash/Slack/SMTP/Fingerprint; `/api/*` 0/7 | DB vá theo SRS (`20260904b`); `/api/search`, `/api/listing/parse` dựng (TS-WEB2); SRS gắn ghi chú trạng thái → OPEN-43 |
| `00 §0.5` sao Bắc Đẩu | NSM lịch xem 0 · I1 0 tin mới/7 ngày (158 `dang_ban` toàn `import_excel` 21/08) · I2 3/3 (thử) · I3 0/0 · I4 chờ ~21/09 | I5 đo được qua view `nmg_hoat_dong` (`20260904e`): 0/3 NMG hoạt động |

### 10.8.4 Dựng thêm cùng ngày (theo yêu cầu "dựng mấy thứ có trong tài liệu")

| Việc | Ở đâu | Kiểm |
|---|---|---|
| FR-12/17, NFR-09 — SEO nền: 64 trang tag SSG, sitemap, robots, canonical/OG, JSON-LD | `lib/tags.ts`, `app/[tag]`, `app/sitemap.ts`, `app/robots.ts`, trang tin | TS-SEO-01…03 ✅, 04…06 ⏭ deploy |
| FR-64 tin mới khớp tiêu chí, FR-56 cảm nhận sau xem, FR-54 link bản đồ | `20260904d`, nudge v24 | TS-MATCH-01…09 ✅ |
| FR-71/74/75/76/77/78/80 admin buyer side | `20260904c`, `app/admin/page.tsx` | TS-ADM2-01…10 ✅, 11–12 ⏭ UI |
| I5 đo được | `20260904e` view `nmg_hoat_dong` | admin/service_role 3 dòng, 0 hoạt động; anon 0 |
| Đợt 2 "dựng hết, giữ chân 5 ngày": FR-60/61/62/63/65/70/72/73/52/103/108/110, FR-57/81 email ntfy, NFR-01 | `20260904f`, nudge v25, cron `info-timeout-tick`, `stale-listing-tick` | TS-GIUCHAN-01…05 ✅, 06 ⚠ ntfy cần tài khoản |
| FR-27/31/45/65/79/99/105/108/114/116 | chat-reply v48 (byte trùng), `prompts.ts` + `bot_prompts` | TS-V48 ✅, e2e 102/102, live 200 |
| FR-01/02/03/04/08/09/10, FR-96, FR-99 web, FR-100 `/ds/[token]`, FR-117 `/du-an/[slug]`, SRS-4.3/4.5/4.6, NFR-06 | `20260904g`, `lib/parse-query.ts`, `app/api/*`, `components/UploadAnh.tsx`, `/admin` | TS-WEB2 P/S ✅, W ⏭ UI |

Dữ liệu thật đáng lưu ý: `listing_facts`, `info_requests`, `listing_media`,
`deals`, `interests`, `viewings` đều 0; `ctvs` 2 (1 bật, 0 có Zalo uid);
`sellers.zalo_user_id` 0/3; bridge im từ 27/08 16:21 (VN). Toàn bộ chuỗi
FR-129/140/153/165/172c/173 mới có bằng chứng từ test rollback + e2e, **chưa có
giao dịch thật nào chảy qua** — điều kiện tiên quyết cho DH-06 đợt 2.
