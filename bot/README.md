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

## Chạy bridge trên máy (bắt buộc đọc trước khi kêu "sao nó sai")

```
cd bot/bridge-zca
npm i
copy .env.example .env        # Windows;  Linux/macOS: cp .env.example .env
node index.mjs
```

Bước tạo `.env` KHÔNG bỏ được. Cổng FR-151 đang **bật** trên Supabase: cả
`chat-reply` lẫn `escalation-feed` chỉ nhận request kèm header
`x-bridge-secret` khớp secret cùng tên trong Vault. Thiếu nó thì:

| Triệu chứng ở terminal | Nghĩa là |
|---|---|
| `escalation-feed: bridge secret sai` | 401 — bridge không gửi header, hoặc gửi sai |
| `chat-reply: forbidden` | 403 — cùng nguyên nhân, chỉ khác cửa |

Bridge vẫn đăng nhập Zalo được và vẫn in "Bridge sẵn sàng" — nên rất dễ tưởng
là chạy ngon. Thực tế nó không nói chuyện được với server, khách nhắn vào là im.

Lấy giá trị: **Dashboard → Project Settings → Vault → `BRIDGE_SECRET`**, dán vào
`.env`. Dán nguyên văn, không nháy, không dấu cách thừa — lệch một ký tự là 401.
(File đọc theo thư mục của `index.mjs`, không theo thư mục đang đứng, nên chạy
từ đâu cũng được. `.env` đã nằm trong `.gitignore`; repo này đang PUBLIC.)

Đừng dùng `set BRIDGE_SECRET=...` trong cmd: nó chỉ sống trong đúng cửa sổ đó,
đóng cửa sổ hay reboot là mất, mở cửa sổ mới chạy lại là sai y như cũ.

**Thứ tự khi bật/tắt cổng** — làm ngược là bridge chết trong khoảng giữa:
- Bật: điền `.env` **trước** → tạo secret trong Vault **sau**.
- Tắt khẩn: `delete from vault.secrets where name = 'BRIDGE_SECRET';`

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
