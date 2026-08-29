# bot/ — Edge functions của bot Zalo OA (Supabase)

Tầng thi công đầu tiên của bot, chạy trên **Supabase Edge Functions** (Deno),
project `nhadat-cc` (tbcdpupiarkuxtntmosl). Suy ra từ đặc tả `docs/07-srs.md`;
tone giọng lấy từ `docs/06 §6.8` (sửa docs trước, sửa `_shared/prompts.ts` sau).

## Function đã deploy

| Function | FR | Việc |
|---|---|---|
| `ask-seller` | FR-40…47, INS-06 | Đọc view `listing_missing_facts` của một listing, sinh MỘT tin Zalo hỏi S tối đa 3 thông tin thiếu (ưu tiên cao trước), ghi `info_requests` (bỏ qua fact đang `pending` — không spam S, INS-09). `dry_run: true` để xem tin không ghi DB. |
| ~~`rate-ctv`~~ | *ĐÃ XOÁ 27/08/2026 (OPEN-23)* — trùng phần chấm điểm trong `ctv-report`. Nội dung cũ: FR-102, chấm CSKH của CTV/bot từ log hội thoại (bảng `messages` hoặc transcript truyền vào), 4 tiêu chí ×1-5 + stars tổng, ghi `ratings` (`rated_by='ai_qa'`, chi tiết trong `details` jsonb). Idempotent theo conversation. |
| `chat-reply` | NFR-12, FR-129…135, FR-29/32, UF-06 | **Bộ não hội thoại** dùng chung mọi kênh: nhánh seller (hỏi nhỏ giọt), nhánh buyer (hồ sơ nhu cầu + trả lời tự nhiên, không delay nhân tạo, lọc kho theo giá số `price_vnd`, tra căn theo mã, kho dự án, đặt lịch xem nhà + xin SĐT đúng kịch bản, bóc lời hứa, cờ `need_human`, follow-up im lặng ngắn, đọc ảnh `image_url`). |
| `zalo-webhook` | SRS-4.4 | Nhận event OA (`user_send_text`/`user_send_image`), verify chữ ký nếu có app secret, trả 200 <1s, chuyển vào chat-reply rồi gửi bong bóng (FR-131: không delay nhân tạo, giữa hai bong bóng chỉ 300ms cho Zalo giao đúng thứ tự). verify_jwt **tắt**. |
| `nudge` | FR-133, FR-32 | Cron 30': nhắc lời hứa tới hạn, nhắc lịch xem trước ~45', follow-up căn khách hỏi rồi im, hỏi thăm buyer im 5-6 ngày (4 góc, tránh lặp); chỉ gửi 8h–21h VN + jitter 0-45s; `{dry_run, force}` để test. |
| `ctv-report` | FR-136/137, FR-149 | Cron 17h VN: tổng hợp đơn per-CTV (chia xoay vòng bằng trigger), lịch xem, đơn chờ người thật, chấm điểm hội thoại theo `RATE_CTV_RUBRIC` → còn OA thì gửi thẳng, không thì đẩy vào `reminders` kind `report` (`sent_to: "queued_bridge"`) để bridge nhắn số Zalo cá nhân admin; lưu `ctv_daily_reports`. |
| `geocode-listings` | FR-122 | Điền `lat`/`lng` cho listing từ `location_raw` qua Nominatim/OSM (1 req/s, cache theo câu query, tự dừng ở ~90s để chạy lặp). Không cron, gọi tay khi có tin mới cần lên bản đồ. **Đưa vào repo 27/08/2026** — trước đó ACTIVE trên Supabase từ 25/08 mà không có dòng nào trong git. |
| `escalation-feed` | FR-140/144, FR-147/149 | Cửa cho bridge acc clone kéo việc "hỏi chính chủ / báo CTV/admin / báo cáo 17h": `{action:"pull"}` trả danh sách kèm `text` soạn sẵn đúng vai (chính chủ → giọng CSKH lễ phép; CTV/admin → thông báo nội bộ; kind `report` → NGUYÊN VĂN, không bọc lời chào) + SĐT/Zalo đích (bảng `sellers`/`ctvs`/`admins`), `{action:"ack", id}` đánh dấu đã gửi. Tuỳ chọn secret `BRIDGE_SECRET` trong Vault → yêu cầu header `x-bridge-secret`. Nudge cũng tự gửi các việc này qua OA khi có token. |

Chat-reply từ 25/08 thêm: `human_note` (bridge báo người thật gõ tay → bot nhường
sân 30 phút, FR-141), `agreed_deal` (khách đồng ý chốt bằng chữ/emoji/like-tim →
ghi deals + da_chot, FR-142, tín hiệu cấu hình ở `bot_prompts.agree_rules`),
`send_photos` + mảng `photos` trong response (gửi hình thật từ facts hinh_anh,
FR-143), nhánh tạo tin nháp khi chính chủ nhắn câu rao mới + ngừng drip khi tin
đủ đăng (FR-144), trần **100 tin/24h** mỗi khách (`rate_limited`, FR-146) và leo
thang cần-người-thật **CTV → admin sau 30 phút** (FR-147, nửa sau nằm ở `nudge`).

**Ảnh thật của tin (FR-148)** nằm trên Supabase Storage, bucket công khai
`listing-photos`, đường dẫn `<mã tin>/<tên file>` — ví dụ `BDS-Q5-0164/01.jpg`.
Up bằng tay: Supabase → Storage → `listing-photos` → tạo thư mục đúng mã tin rồi
kéo ảnh vào; thứ tự hiển thị theo tên file (`01`, `02`…). Web và bot đọc chung
qua view `public.listing_photos_v` (`code`, `url`, `path`). Tin chưa có ảnh thì
web rơi về ảnh minh hoạ, bot đi đường hỏi-chủ-nhà FR-140.

Gọi: `POST {SUPABASE_URL}/functions/v1/<name>` với header
`Authorization: Bearer <anon key>` (verify_jwt bật, trừ `zalo-webhook`).

**Hạ tầng dùng chung** nằm ở `_shared/claude.ts`: `serviceClient()`,
`secretOf()`, `anthropicClient()`, `jsonResponse()`, `sendZalo()`,
`sendZaloImage()`, `escalationText()`, hằng `MODEL`. Function mới **phải** import
từ đây, đừng chép lại — trước 25/08 `db()`/`secret()` có 5 bản, `sendZalo()` 2
bản, và text escalation trùng byte giữa `nudge` với `escalation-feed` (thêm kind
`report` phải sửa cả hai nơi, quên một là lệch giọng bot).

## Cấu hình

- **Sửa "não" không cần deploy (FR-138)**: bảng `bot_prompts` (key/content) chứa
  toàn bộ văn phong + luật phí + nhịp nhắn + kịch bản người bán + từ điển lóng +
  few-shot + rubric chấm CTV. Vào Supabase → Table Editor → `bot_prompts`, sửa
  `content` là bot đổi NGAY lượt sau. Key: `tone_rules`, `human_chat_rules`,
  `fee_rules`, `seller_script_rules`, `slang_notes`, `buyer_fewshot`,
  `rate_ctv_rubric`. Xoá dòng = quay về mặc định trong `_shared/prompts.ts`.
- **Model**: `claude-opus-5`, structured output (zod v4 + `zodOutputFormat`),
  `effort: low` (nhanh, few-shot + luật gánh chất lượng). System prompt tách
  2 khối: khối luật ổn định được cache (`cache_control: ephemeral`), khối kho
  biến động nằm sau điểm cache.
- **ANTHROPIC_API_KEY**: đọc từ env secret của Edge Functions; nếu chưa đặt thì
  fallback đọc Supabase **Vault** qua RPC `get_secret` (chỉ `service_role` gọi
  được). Key hiện nằm trong Vault; muốn chuyển sang env:
  `supabase secrets set ANTHROPIC_API_KEY=...`.
- Deploy qua MCP (dashboard) — import `_shared/` được nắn thành file cùng cấp;
  nếu deploy bằng CLI `supabase functions deploy` thì cấu trúc `_shared/` dùng
  được nguyên trạng.
- **Deploy qua MCP phải chép tay nguyên văn mọi file phụ thuộc.** Rủi ro tỉ lệ
  thuận với số dấu `\` trong file, vì mỗi cái phải nhân đôi khi đóng gói JSON —
  chép sót một cái thì `\d` thành `d`: **vẫn biên dịch, vẫn chạy, chỉ là bóc
  sai**, không cửa nào báo. Đếm 27/08: `escalation-feed` 0, `zalo-webhook` 0,
  `ctv-report` 11, `chat-reply` **123** (toàn regex bóc giá/giờ hẹn/mã căn).
  Deploy `chat-reply` bằng MCP thì BẮT BUỘC chạy lại bộ TS-CHATREPLY-01…04
  (`docs/10` §10.7) trước khi coi là xong. Đường an toàn hơn: `npx supabase login` một lần rồi
  `npx supabase functions deploy chat-reply` — không qua chép tay.

Bộ kiểm bắt buộc sau mỗi lần deploy `chat-reply`: **TS-CHATREPLY-01…04** trong
[`docs/10-ke-hoach-kiem-thu.md`](../docs/10-ke-hoach-kiem-thu.md) §10.7 — bốn
bài, mỗi bài soi một họ regex khác nhau (mã căn/tiền/khoảng giá · nhánh thuê ·
câu rao cho thuê · ghiLoi trong catch). Kế hoạch test nằm MỘT chỗ ở `docs/10`,
đừng chép lại vào đây.

## Bảng liên quan (migration đã áp trên nhadat-cc)

`required_facts` (37 fact chuẩn theo `property_type`) + view
`listing_missing_facts`; `conversations` + `messages` (log hội thoại);
`ctvs`; `deals.ctv_id`;
`buyers.preferences/last_contact_at/notes`; `projects` + `listings.unit_status`.

## Chưa làm (theo thứ tự SRS §8)

1. Job nền gọi `ask-seller` khi có `interests`/câu hỏi mới (outbox, OPEN-11).
2. Regression NLU theo bảng quyết định (`docs/10 §10.1`) trước khi đổi model/prompt.
3. Voice/STT (khách gửi tin thoại — cần dịch vụ STT ngoài); UI người thật cướp
   quyền chat (hiện mới có cờ `needs_human` + báo cáo CTV).
4. Secrets còn chờ: `ZALO_OA_ACCESS_TOKEN` (OA duyệt xong), `ZALO_ADMIN_ZALO_ID`
   (Zalo admin nhận báo cáo 17h), `ZALO_APP_SECRET`/`ZALO_APP_ID` (verify chữ ký).

## Ghi chú deploy 27/08/2026

`chat-reply` v36 deploy qua MCP với bản **đã bỏ dòng comment** (nội dung code
giống hệt repo từng dòng — kiểm bằng script đối chiếu — chỉ thiếu comment, vì
trần payload một lượt). Repo vẫn là nguồn sự thật; lần deploy tới bằng
`supabase functions deploy chat-reply` từ máy local sẽ tự đồng bộ bản đầy đủ.

**Cập nhật 28/08/2026 — `chat-reply` đang chạy v42** (FR-164). Vẫn deploy bằng
bản đã bỏ comment như trên; đối chiếu lần này: 1087 dòng code không-comment ở cả
hai bên, và bản rút gọn transpile sạch trước khi gửi. Kiểm sau deploy bằng hành
vi thật chứ không chỉ bằng việc nó bundle được: gọi cả nhánh người bán (lời sửa
fact) lẫn nhánh người mua (bóc hồ sơ + lọc kho) trên bản đang chạy, rồi xoá sạch
dữ liệu thử. Lưu ý khi tự gọi hàm từ SQL: `net.http_post` bỏ cuộc sau 5 s nên
nhánh người mua (có gọi model) luôn báo timeout ở `net._http_response` — đó là
hạn của người gọi, không phải hàm hỏng; xác nhận bằng cách soi DB.

## Kho ảnh (FR-165, 29/08/2026)

Hai bucket: **`listing-public`** (công khai, chỉ MIME ảnh, 10MB/file) và
**`listing-private`** (riêng tư, thêm PDF, 20MB) cho sổ đỏ/giấy tờ. Đường dẫn
là `<listing UUID>/<media UUID>.<đuôi>` — neo vào ID BẤT BIẾN của tin, không
neo vào mã tin.

Bucket `listing-photos` cũ đã bị tước quyền (hạ khỏi public, siết MIME/dung
lượng) chứ không xoá được bằng SQL: Supabase chặn `delete from storage.buckets`
("Use the Storage API instead"). Nó đang rỗng. Muốn xoá hẳn thì xoá ở
Dashboard → Storage.

Mỗi file PHẢI có một dòng `listing_media`; web và bot đọc qua
`listing_photos_v` (chỉ lộ bucket công khai). Up ảnh bằng
`node scripts/up-anh.mjs <thư-mục>` — script tự tra UUID từ mã ở tên thư mục,
up file trước rồi mới ghi dòng DB, ghi hỏng thì dọn luôn file vừa up.

Xoá/thay ảnh KHÔNG xoá file ngay: trigger ghi vào `media_cleanup_queue`, edge
function `media-cleanup` (cron `media-cleanup-tick`, 5 phút) gọi Storage API rồi
đánh dấu. Việc chưa `xong` thì còn nằm đó nên thử lại được. Soi mồ côi bằng hai
view `media_mo_coi_storage` và `media_mo_coi_db`.

URL gốc của bucket nằm ở bảng `app_config` (`storage_public_base_url`,
`functions_base_url`) chứ không nhúng cứng trong view như trước — đổi project
thì UPDATE hai dòng đó. Các cron cũ (`ctv_report_tick`, `bot_health_tick`…) vẫn
nhúng cứng host, chưa dọn — việc còn lại.
