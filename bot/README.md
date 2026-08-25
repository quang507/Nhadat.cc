# bot/ — Edge functions của bot Zalo OA (Supabase)

Tầng thi công đầu tiên của bot, chạy trên **Supabase Edge Functions** (Deno),
project `nhadat-bot` (tbcdpupiarkuxtntmosl). Suy ra từ đặc tả `docs/07-srs.md`;
tone giọng lấy từ `docs/06 §6.8` (sửa docs trước, sửa `_shared/prompts.ts` sau).

## Function đã deploy

| Function | FR | Việc |
|---|---|---|
| `ask-seller` | FR-40…47, INS-06 | Đọc view `listing_missing_facts` của một listing, sinh MỘT tin Zalo hỏi S tối đa 3 thông tin thiếu (ưu tiên cao trước), ghi `info_requests` (bỏ qua fact đang `pending` — không spam S, INS-09). `dry_run: true` để xem tin không ghi DB. |
| `rate-ctv` | FR-102 | Chấm CSKH của CTV/bot từ log hội thoại (bảng `messages` hoặc transcript truyền vào), 4 tiêu chí ×1-5 + stars tổng, ghi `ratings` (`rated_by='ai_qa'`, chi tiết trong `details` jsonb). Idempotent theo conversation. |
| `chat-reply` | NFR-12, FR-129…135, FR-29/32, UF-06 | **Bộ não hội thoại** dùng chung mọi kênh: nhánh seller (hỏi nhỏ giọt), nhánh buyer (hồ sơ nhu cầu + trả lời tự nhiên, debounce gộp tin, lọc kho theo giá số `price_vnd`, tra căn theo mã, kho dự án, đặt lịch xem nhà + xin SĐT đúng kịch bản, bóc lời hứa, cờ `need_human`, follow-up im lặng ngắn, đọc ảnh `image_url`). |
| `zalo-webhook` | SRS-4.4 | Nhận event OA (`user_send_text`/`user_send_image`), verify chữ ký nếu có app secret, trả 200 <1s, chuyển vào chat-reply rồi gửi bong bóng (bong bóng đầu gần như ngay, sau trễ theo độ dài). verify_jwt **tắt**. |
| `nudge` | FR-133, FR-32 | Cron 30': nhắc lời hứa tới hạn, nhắc lịch xem trước ~45', follow-up căn khách hỏi rồi im, hỏi thăm buyer im 5-6 ngày (4 góc, tránh lặp); chỉ gửi 8h–21h VN + jitter 0-45s; `{dry_run, force}` để test. |
| `ctv-report` | FR-136/137 | Cron 17h VN: tổng hợp đơn per-CTV (chia xoay vòng bằng trigger), lịch xem, đơn chờ người thật, chấm điểm hội thoại theo `RATE_CTV_RUBRIC` → gửi Zalo admin (`ZALO_ADMIN_ZALO_ID`) + lưu `ctv_daily_reports`. |

Gọi: `POST {SUPABASE_URL}/functions/v1/<name>` với header
`Authorization: Bearer <anon key>` (verify_jwt bật, trừ `zalo-webhook`).

## Cấu hình

- **Model**: `claude-opus-5`, structured output (zod v4 + `zodOutputFormat`),
  `effort: medium`. System prompt được cache (`cache_control: ephemeral`).
- **ANTHROPIC_API_KEY**: đọc từ env secret của Edge Functions; nếu chưa đặt thì
  fallback đọc Supabase **Vault** qua RPC `get_secret` (chỉ `service_role` gọi
  được). Key hiện nằm trong Vault; muốn chuyển sang env:
  `supabase secrets set ANTHROPIC_API_KEY=...`.
- Deploy qua MCP (dashboard) — import `_shared/` được nắn thành file cùng cấp;
  nếu deploy bằng CLI `supabase functions deploy` thì cấu trúc `_shared/` dùng
  được nguyên trạng.

## Bảng liên quan (migration đã áp trên nhadat-bot)

`required_facts` (37 fact chuẩn theo `property_type`) + view
`listing_missing_facts`; `conversations` + `messages` (log hội thoại);
`ratings` (+ `rated_by`, `conversation_id`, `details`); `ctvs`; `deals.ctv_id`;
`buyers.preferences/last_contact_at/notes`; `projects` + `listings.unit_status`.

## Chưa làm (theo thứ tự SRS §8)

1. Job nền gọi `ask-seller` khi có `interests`/câu hỏi mới (outbox, OPEN-11).
2. Regression NLU theo bảng quyết định (`docs/10 §10.1`) trước khi đổi model/prompt.
3. Voice/STT (khách gửi tin thoại — cần dịch vụ STT ngoài); UI người thật cướp
   quyền chat (hiện mới có cờ `needs_human` + báo cáo CTV).
4. Secrets còn chờ: `ZALO_OA_ACCESS_TOKEN` (OA duyệt xong), `ZALO_ADMIN_ZALO_ID`
   (Zalo admin nhận báo cáo 17h), `ZALO_APP_SECRET`/`ZALO_APP_ID` (verify chữ ký).
