# bot/ — Bot Zalo của Aioinhadat (Supabase Edge Functions)

Deno trên Supabase, project `nhadat-cc` (`tbcdpupiarkuxtntmosl`). Đặc tả ở
`docs/07-srs.md`; tone giọng ở `docs/06 §6.8` — **sửa docs trước, sửa
`_shared/prompts.ts` sau**, rồi đồng bộ bảng `bot_prompts`.

## Function đang chạy (04/09/2026)

| Function | v | verify_jwt | Việc |
|---|---|---|---|
| `chat-reply` | 48 | tắt | Bộ não hội thoại dùng chung mọi kênh. Phân vai từng lượt (mua / bán / CTV / admin), nhánh mua (hồ sơ nhu cầu, lọc kho, tra mã căn, căn tương tự, giá TB phường, gửi ảnh, đặt lịch, hỏi chủ, chốt kèo), nhánh bán (nhỏ giọt một thông tin/lần), nhánh nội bộ (`#mã: trả lời`). Lọc liên hệ trước khi gửi người mua. |
| `zalo-webhook` | 12 | tắt | Nhận event OA, ghi `inbound_events` rồi ack < 1s, chuyển `chat-reply`, gửi bong bóng (300 ms giữa hai bong bóng). Cửa `{replay_event_id}` cho đường cứu. |
| `nudge` | 25 | tắt | Cron 2 lượt/giờ giờ người: nhắc lời hứa, nhắc lịch xem trước 45' kèm link bản đồ, follow-up, hỏi thăm khách im **5 ngày** (6 góc xoay vòng, ≥6 ngày buộc giữ kết nối Zalo), và các kind mẫu-cố-định `match` / `feedback` / `sold` / `rating`. `{dry_run, force}`. |
| `ask-seller` | 9 | bật | Đọc `listing_missing_facts`, sinh MỘT tin hỏi người bán, ghi `info_requests`; bỏ qua fact đang `pending`. |
| `ctv-report` | 10 | bật | Báo cáo 17h VN per-CTV (đơn, lịch xem, việc chờ người thật, hạng CTV), lưu `ctv_daily_reports`, đẩy qua `reminders` kind `report`. |
| `escalation-feed` | 10 | bật | Cửa cho bridge: `{action:"pull"}` lấy việc kèm text soạn sẵn + đích, `{action:"ack", id}` đánh dấu đã gửi (kèm học `zalo_user_id`), `{action:"log"}` ghi lỗi vào sổ. |
| `media-cleanup` | 4 | tắt | Nhặt `media_cleanup_queue`, xoá file Storage, đánh dấu. File không còn cũng tính xong. |
| `inbound-sweep` | 3 | tắt | Đường cứu tin đến: hỏi `viec_inbound_bo_roi()` rồi gọi ngược `zalo-webhook` ở cửa phát lại (không tự gửi — khâu gửi giữ luật chống gửi đúp). |
| `geocode-listings` | 5 | bật | Điền `lat`/`lng` từ `location_raw` qua Nominatim (1 req/s). Gọi tay. |

Gọi: `POST {SUPABASE_URL}/functions/v1/<name>`, header `Authorization: Bearer
<anon key>`; function nào có cổng thì thêm `x-bridge-secret`.

**Hạ tầng dùng chung — import, đừng chép lại:**
`_shared/claude.ts` (`serviceClient`, `secretOf`, `anthropicClient`,
`jsonResponse`, `sendZalo`, `sendZaloImage`, `escalationText`, `ghiLoi`,
`doTien`, `MODEL`) · `_shared/gate.ts` (`congBiMat`) · `_shared/prompts.ts`
(văn phong, luật phí, kịch bản người bán, từ điển lóng, few-shot, rubric) ·
`_shared/thong_so.ts` (`SPEC_COLS`, `thongSoNgan`) · `_shared/dia_ban.ts`
(`bocQuan`).

Hai luật không được quên: mọi `catch` mới phải gọi `ghiLoi(...)` (FR-152 d);
mọi chỗ gọi model phải gọi `await doTien(client, r.usage)` ngay sau đó, không
thì lượt đó vô hình với đồng hồ tiền ở `/admin` (FR-169).

## Deploy

Không có máy local nên dùng MCP, nhưng **không chép tay** — chép tay đo được
một lỗi mỗi 7 KB, và lỗi rơi vào regex thì hỏng im lặng:

```bash
bun build bot/supabase/functions/<fn>/index.ts --target=node \
  --external 'npm:*' --minify-whitespace --outfile <scratch>/<fn>.ts
```

1. Bundle như trên (gộp `_shared/`, chỉ còn một file `index.ts`).
2. `deploy_edge_function` với nội dung lấy **thẳng từ file bundle**, giữ đúng
   `verify_jwt` của bản đang chạy.
3. `get_edge_function` kéo ngược, chuẩn hoá `\uXXXX` rồi **so từng byte** với
   bundle. Lệch là deploy lại, không được để bản lệch.
4. Chạy e2e **trên chính nội dung kéo ngược** (ghi vào
   `bot/tests/e2e/chat-reply.bundle.mjs`) trước khi coi là xong.
5. Gọi thử một lượt thật bằng `net.http_post` từ SQL (uid `TEST-…`, secret đọc
   từ `vault.decrypted_secrets` ngay trong câu truy vấn, không in ra), rồi dọn
   dữ liệu thử.

## Test

```bash
bash bot/tests/e2e/chay.sh          # 102 kịch bản, TỰ dựng lại bundle — đừng chạy run.mjs trực tiếp
node bot/tests/fr159-bon-vai.mjs    # 65 ca phân vai
node bot/tests/fr161-go-lan-dau.mjs # 9 ca tiếng Việt không dấu
node bot/tests/fr164-loi-sua-va-cau-hoi-treo.mjs  # 8 ca
```

Suite chạy trên DB thật (rollback) và bảng kiểm đầy đủ nằm ở `docs/10`.

## Cron (Postgres `pg_cron`, giờ UTC; 1–13 UTC = 8–20h VN)

| Job | Lịch | Việc |
|---|---|---|
| `nudge-tick` | `7,37 1-13 * * *` | gọi `nudge` |
| `seller-drip-tick` | `22,52 1-13 * * *` | hỏi nhỏ giọt người bán |
| `ctv-sla-tick` | `*/15 1-13 * * *` | quá 120' thì admin đỡ khách (FR-173) |
| `info-timeout-tick` | `3 1-13 * * *` | 24h nhắc, 48h đóng câu hỏi (FR-110) |
| `ctv-report-tick` | `0 10 * * *` | báo cáo 17h VN |
| `stale-listing-tick` | `0 2 * * *` | tin im 30 ngày → hỏi còn bán không (FR-103) |
| `listing-interest-decay` | `0 20 * * *` | hạ cờ "đang quan tâm" sau 7 ngày |
| `bot-health-tick` | `*/15 * * * *` | quét `net._http_response`, nhịp tim, còi ntfy |
| `inbound-sweep-tick` | `* * * * *` | đường cứu tin đến |
| `media-cleanup-tick` | `*/5 * * * *` | dọn file |
| `media-chet-tick` | `0 * * * *` | nhặt việc dọn chết |
| `cron-don-so` | `15 18 * * *` | xoá `cron.job_run_details` quá 7 ngày |

**Đừng tin `cron.job_run_details.status`**: `net.http_post` trả về ngay khi xếp
hàng nên cron luôn báo `succeeded` kể cả khi function trả 500. Kết quả thật ở
`net._http_response`, được `bot_health_tick()` quét sang `bot_errors`.

## Cấu hình

- **Sửa "não" không cần deploy (FR-138)**: bảng `bot_prompts` (key/content) —
  `tone_rules`, `human_chat_rules`, `fee_rules`, `seller_script_rules`,
  `slang_notes`, `buyer_fewshot`, `agree_rules`, `rate_ctv_rubric`. Sửa ở Table
  Editor là bot đổi trong vòng một phút (nhớ tạm 60 s). Nội dung phải khớp
  `_shared/prompts.ts` — đổi một bên thì đồng bộ bên kia bằng script, đừng gõ tay.
- **Secret trong Vault** (đọc qua RPC `get_secret`, chỉ `service_role`):
  `ANTHROPIC_API_KEY`, `BRIDGE_SECRET`. Chưa có: `ZALO_OA_TOKEN`,
  `ZALO_APP_SECRET`/`ZALO_APP_ID` (OPEN-33), `ZALO_ADMIN_ZALO_ID`,
  `NTFY_TOKEN` (cần cho email FR-81), `DAILY_MODEL_CALL_CAP` (mặc định 1000).
- **`app_config`** (khoá/giá trị, không phải secret): `ntfy_topic`, `admin_email`,
  URL Storage công khai.

## Vận hành

- **Bridge Zalo** (`bot/bridge-zca/`, zca-js trên acc cá nhân trong lúc chờ OA
  duyệt): poll `escalation-feed`, gửi tin, ack ngược. Cài lên VPS theo
  `bot/bridge-zca/VPS.md` (systemd `nhadat-bridge.service`). Bridge chết là
  đường ra Zalo đứt.
- **Còi báo ngoài bridge**: `canh_bao_ngoai()` → ntfy.sh topic trong
  `app_config.ntfy_topic`; `bot_health_tick` kêu 1 tin/giờ khi bridge im. Đây là
  đường báo động DUY NHẤT không vòng lại qua bridge (FR-152 e).
- **Sao lưu**: `scripts/sao-luu.mjs` (bậc Free không có backup tự động —
  OPEN-25). Cần `SUPABASE_SERVICE_ROLE_KEY` trong biến môi trường, đích ghi
  NGOÀI repo vì bản sao chứa SĐT thật.
- **Sức khoẻ**: trang `/admin` — sổ lỗi, nhịp tim, tiền bộ não, độ trễ bot,
  việc chờ, hạng CTV.

### Sự cố 27/08 → 04/09/2026: bridge im 8 ngày

Bridge dừng lúc 27/08 16:21 (VN). Sổ lỗi có ghi, nhưng **đường báo động lại đi
qua chính bridge** nên không ai biết: 120 lời nhắc escalation bị huỷ vì treo quá
lâu, báo cáo CTV không tới. Vá: `canh_bao_ngoai()` gọi thẳng ntfy (04/09), và
bridge chuyển lên VPS có systemd tự khởi động lại. Bài học ghi vào NFR-18: một
kênh báo động không được đi qua thứ mà nó phải giám sát.

## Migration

58 file ở `bot/supabase/migrations/`, đặt tên `YYYYMMDD<chữ>_<việc>.sql`, áp
theo thứ tự tên. Migration là **nguồn sự thật của schema**: sửa DB bằng
`apply_migration` với đúng nội dung file trong repo, không sửa tay ở dashboard
rồi quên ghi lại. Đợt gần nhất: `20260904a` (còi ntfy) → `20260904g` (kho ảnh
web + danh sách riêng).

## Chưa làm

OA Zalo chờ duyệt (đang chạy acc clone qua bridge) · thoại/STT (FR-134) ·
fingerprint (FR-16, OPEN-14) · chữ ký webhook Zalo (OPEN-33) · các mục còn lại
ở `docs/09` OPEN-43.
