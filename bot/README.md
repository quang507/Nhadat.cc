# bot/ — Edge functions của bot Zalo OA (Supabase)

Tầng thi công đầu tiên của bot, chạy trên **Supabase Edge Functions** (Deno),
project `nhadat-cc` (tbcdpupiarkuxtntmosl). Suy ra từ đặc tả `docs/07-srs.md`;
tone giọng lấy từ `docs/06 §6.8` (sửa docs trước, sửa `_shared/prompts.ts` sau).

## Function đã deploy

| Function | FR | Việc |
|---|---|---|
| `ask-seller` | FR-40…47, INS-06 | Đọc view `listing_missing_facts` của một listing, sinh MỘT tin Zalo hỏi S tối đa 3 thông tin thiếu (ưu tiên cao trước), ghi `info_requests` (bỏ qua fact đang `pending` — không spam S, INS-09). `dry_run: true` để xem tin không ghi DB. |
| ~~`rate-ctv`~~ | — | *ĐÃ XOÁ 27/08/2026 (OPEN-23)* — trùng phần chấm điểm trong `ctv-report`. Nội dung cũ: FR-102, chấm CSKH của CTV/bot từ log hội thoại (bảng `messages` hoặc transcript truyền vào), 4 tiêu chí ×1-5 + stars tổng, ghi `ratings` (`rated_by='ai_qa'`, chi tiết trong `details` jsonb). Idempotent theo conversation. |
| `chat-reply` | NFR-12, FR-129…135, FR-29/32, FR-159, FR-170, UF-06 | **Bộ não hội thoại** dùng chung mọi kênh — phân vai trước (FR-159: người lạ tự nhận có BĐS → mở hồ sơ bán ngay; câu mập mờ ở tin đầu → hỏi "đang muốn tìm mua/thuê nhà, hay đang có bất động sản cần rao ạ?" một lần, không gọi model; mặc định người mua): nhánh seller (hỏi nhỏ giọt), nhánh buyer (hồ sơ nhu cầu + trả lời tự nhiên, không delay nhân tạo, lọc kho theo giá số `price_vnd`, tra căn theo mã, kho dự án, đặt lịch xem nhà + xin SĐT đúng kịch bản, bóc lời hứa, cờ `need_human`, follow-up im lặng ngắn, đọc ảnh `image_url`). |
| `zalo-webhook` | SRS-4.4 | Nhận event OA (`user_send_text`/`user_send_image`), verify chữ ký nếu có app secret, trả 200 <1s, chuyển vào chat-reply rồi gửi bong bóng (FR-131: không delay nhân tạo, giữa hai bong bóng chỉ 300ms cho Zalo giao đúng thứ tự). verify_jwt **tắt**. Từ FR-166 có thêm cửa `{replay_event_id}` (chỉ service key) để đường cứu gọi lại, và gửi tiếp từ `sent_bubbles` thay vì phát lại từ bong bóng đầu. |
| `nudge` | FR-133, FR-32 | Cron 30': nhắc lời hứa tới hạn, nhắc lịch xem trước ~45', follow-up căn khách hỏi rồi im, hỏi thăm buyer im 5-6 ngày (4 góc, tránh lặp); chỉ gửi 8h–21h VN + jitter 0-45s; `{dry_run, force}` để test. Từ FR-166 giành việc qua `nhan_viec_nhac` (hợp đồng thuê 5 phút) nên hai lượt chạy chồng nhau không gửi đúp; `dry_run` KHÔNG giành việc. |
| `ctv-report` | FR-136/137, FR-149 | Cron 17h VN: tổng hợp đơn per-CTV (chia xoay vòng bằng trigger), lịch xem, đơn chờ người thật, chấm điểm hội thoại theo `RATE_CTV_RUBRIC` → còn OA thì gửi thẳng, không thì đẩy vào `reminders` kind `report` (`sent_to: "queued_bridge"`) để bridge nhắn số Zalo cá nhân admin; lưu `ctv_daily_reports`. |
| `geocode-listings` | FR-122 | Điền `lat`/`lng` cho listing từ `location_raw` qua Nominatim/OSM (1 req/s, cache theo câu query, tự dừng ở ~90s để chạy lặp). Không cron, gọi tay khi có tin mới cần lên bản đồ. **Đưa vào repo 27/08/2026** — trước đó ACTIVE trên Supabase từ 25/08 mà không có dòng nào trong git. |
| `inbound-sweep` | FR-166 | Đường CỨU cho tin nhắn đến. Cron `inbound-sweep-tick` (1 phút) hỏi `viec_inbound_bo_roi()` xem việc nào đường nhanh chưa làm xong, rồi gọi ngược `zalo-webhook` ở cửa phát lại — cố ý không tự gửi lấy, vì khâu gửi là chỗ giữ luật chống-gửi-đúp. Bình thường không có việc thì hàm tick return ngay, không gọi gì. |
| `media-cleanup` | FR-165 | Cron `media-cleanup-tick` (5 phút): nhặt `media_cleanup_queue`, gọi Storage API xoá file rồi đánh dấu. File không còn cũng tính là xong (Supabase trả HTTP 400 với thân `{"statusCode":"404"}`, không phải 404). |
| `escalation-feed` | FR-140/144, FR-147/149 | Cửa cho bridge acc clone kéo việc "hỏi chính chủ / báo CTV/admin / báo cáo 17h": `{action:"pull"}` trả danh sách kèm `text` soạn sẵn đúng vai (chính chủ → giọng CSKH lễ phép; CTV/admin → thông báo nội bộ; kind `report` → NGUYÊN VĂN, không bọc lời chào) + SĐT/Zalo đích (bảng `sellers`/`ctvs`/`admins`), `{action:"ack", id}` đánh dấu đã gửi. Tuỳ chọn secret `BRIDGE_SECRET` trong Vault → yêu cầu header `x-bridge-secret`. Nudge cũng tự gửi các việc này qua OA khi có token. |

Chat-reply từ 25/08 thêm: `human_note` (bridge báo người thật gõ tay → bot nhường
sân 30 phút, FR-141), `agreed_deal` (khách đồng ý chốt bằng chữ/emoji/like-tim →
ghi deals + da_chot, FR-142, tín hiệu cấu hình ở `bot_prompts.agree_rules`),
`send_photos` + mảng `photos` trong response (gửi hình thật từ facts hinh_anh,
FR-143), nhánh tạo tin nháp khi chính chủ nhắn câu rao mới + ngừng drip khi tin
đủ đăng (FR-144), trần **100 tin/24h** mỗi khách (`rate_limited`, FR-146) và leo
thang cần-người-thật **CTV → admin sau 30 phút** (FR-147, nửa sau nằm ở `nudge`).

**Ảnh thật của tin** — xem mục "Kho ảnh (FR-165)" ở cuối file. *(Lối cũ FR-148
— bucket `listing-photos`, thư mục theo mã tin, thứ tự theo tên file — đã bỏ từ
29/08/2026: mã tin đổi được, đổi là ảnh rơi khỏi tin.)* Web và bot vẫn đọc chung
qua view `public.listing_photos_v` (`code`, `url`, `path` — hợp đồng giữ nguyên).
Tin chưa có ảnh thì web rơi về ảnh minh hoạ, bot đi đường hỏi-chủ-nhà FR-140.

Gọi: `POST {SUPABASE_URL}/functions/v1/<name>` với header
`Authorization: Bearer <anon key>` (verify_jwt bật, trừ `zalo-webhook`).

**Hạ tầng dùng chung** nằm ở `_shared/claude.ts`: `serviceClient()`,
`secretOf()`, `anthropicClient()`, `jsonResponse()`, `sendZalo()`,
`sendZaloImage()`, `escalationText()`, `ghiLoi()`, `doTien()`, hằng `MODEL`.
Function nào gọi model thì gọi kèm `await doTien(client, r.usage)` ngay sau chỗ
lấy kết quả ra — không có dòng đó thì lượt gọi ấy vô hình với đồng hồ đo tiền ở
`/admin` (FR-169). Function mới **phải** import
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
  2 khối **theo GIÁ chứ không theo chủ đề**: khối giống nhau cho mọi khách (luật
  + ví dụ mẫu + dự án nhà mình) nằm trước điểm nhớ tạm, khối đổi theo từng khách
  (kho, căn khách nhắc, dự án khách nhắc) nằm sau. Nhánh buyer để
  `cache_control: { type: "ephemeral", ttl: "1h" }` — nhịp chọn theo lưu lượng,
  xem mục "Tiền bộ não" ở cuối file trước khi đổi.
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

## Test hồi quy (`bot/tests/`)

```bash
node bot/tests/fr161-go-lan-dau.mjs
node bot/tests/fr164-loi-sua-va-cau-hoi-treo.mjs
```

Chạy bằng Node, không cần Deno / mạng / Supabase; hỏng thì thoát khác 0. Sinh ra
sau đợt soát 29/08 vì mười lỗi tìm được lần đó **gần như đều ở tầng TypeScript**
— nơi trước giờ chưa có lấy một test nào, trong khi hàm DB đã có TS-JOB/TS-SEC2
phủ dày. Chi tiết bất biến: `docs/10 §TS-HQ`.

Hai file này **chép lại** regex của `chat-reply` chứ không import (Node không nạp
được module Deno). Sửa regex ở `chat-reply/index.ts` mà quên sửa ở đây thì test
vẫn xanh trong khi hàm thật đã đổi — xem `bot/tests/README.md`.

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

### ⚠️ 29/08/2026 — deploy qua MCP là CHÉP TAY, và chép tay thì SAI

Công cụ MCP `deploy_edge_function` chỉ nhận **nội dung file dán thẳng vào lời
gọi**, không nhận đường dẫn. Nghĩa là mỗi lần deploy là một lần chép tay lại
toàn bộ file. Đợt 29/08 đo được tỷ lệ thật: bản `_shared/prompts.ts` 21KB bị
**sai 3 ký tự** — `LỊCH`→`LỊ CH`, `LỊCH`→`LẪCH`, `SẴN`→`SẮN`, tức khoảng
**một lỗi mỗi 7KB**. Cả ba là chữ HOA có dấu, gõ nhầm mã `\uXXXX` (`Ẫ` Ẫ
thay `Ị` Ị; `Ắ` Ắ thay `Ẵ` Ẵ).

Hai luật rút ra:

1. **Viết ký tự UTF-8 thẳng, đừng dùng `\uXXXX`.** JSON nhận UTF-8; chép
   ký-tự-sang-ký-tự an toàn hơn hẳn việc mã hoá qua số.
2. **Deploy xong PHẢI kéo lại bằng `get_edge_function` và đối chiếu.** Không
   đối chiếu thì không biết. Ba lỗi trên chỉ lộ ra nhờ bước này.

**Hệ quả cho `chat-reply`:** bản rút gọn của nó là **57.7KB, 1145 dòng, 65 dòng
chứa regex**. Với tỷ lệ đo được thì chép tay nó là khoảng **8 lỗi**, và chúng
rơi vào đúng đám regex nhận diện câu rao / định tuyến mua-bán — hỏng ở đó là
hỏng IM LẶNG, không parse error nào bắt được. Vì vậy `chat-reply` **không deploy
qua MCP nữa**. Cách đúng, chạy từ máy local, gửi đúng byte của repo:

```bash
supabase functions deploy chat-reply --project-ref tbcdpupiarkuxtntmosl
```

Cách này cũng bỏ luôn được trò bỏ-comment: CLI gửi thẳng file đầy đủ.

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

## Việc chạy nền (FR-166, 29/08/2026)

**Mô hình chạy**: `zalo-webhook` ghi `inbound_events` TRƯỚC khi ack 200, rồi làm
việc thật trong `EdgeRuntime.waitUntil` — tức CÙNG instance vừa trả 200. Đường
nhanh đó giữ nguyên vì FR-131 đòi bot đáp ngay; thứ thêm vào là ĐƯỜNG CỨU cho
lúc instance chết giữa chừng. Trước FR-166, `inbound_events` được ghi mà không
chỗ nào đọc, nên instance chết là tin của khách mất vĩnh viễn, im lặng.

Ba hàng đợi, một luật lùi dần chung `lan_thu_ke()` (30s → gấp đôi → chặn 1
tiếng, nhiễu ±20%):

| Hàng đợi | Bảng | Giành việc | Trần thử lại |
|---|---|---|---|
| Tin đến | `inbound_ledger` | `claim_inbound()` | 8 lần → `dead` |
| Nhắc/nudge | `reminders` | `nhan_viec_nhac()` | 5 lần → `dead` |
| Dọn file | `media_cleanup_queue` | `nhan_viec_don_media()` | 6 lần → `chet` |

Xem việc kẹt ở view `job_suc_khoe` (job id, attempts, lỗi, started/finished,
next_retry). **Chưa nối vào `/admin`**: trang đó đọc Supabase bằng publishable
key (vai `anon`), mà view này `revoke all` khỏi anon. Muốn hiện thì mở qua một
RPC security-definer có kiểm quyền admin, kiểu `bot_health_tick`. Hiện đọc bằng
service key.

Hai cửa báo hỏng cho lời nhắc, đừng lẫn: `bao_hong_nhac` là ĐÃ THỬ mà hụt (lùi
dần, 5 lần thì chết), `nha_viec_nhac` là CHƯA THỬ được — thiếu đích hoặc thiếu
token OA, tức việc của bridge — nên trả lại nguyên vẹn và hoàn luôn lượt đếm.

**Deploy 29/08/2026**: `zalo-webhook` v10, `nudge` v16, `inbound-sweep` v1, cùng
lối bỏ-comment như `chat-reply` (đối chiếu số dòng code không-comment hai bên,
rồi transpile thử trước khi gửi). Cron mới: `inbound-sweep-tick` (1 phút),
`media-chet-tick` (1 giờ).

**Lưu ý khi đọc còi báo lỗi**: `inbound_sweep_tick()` gọi edge function bằng
`net.http_post`, mà pg_net bỏ cuộc sau 5 s — một lượt cứu thật (có gọi model,
có gửi Zalo) thì luôn quá 5 s, nên `bot_health_tick` sẽ ghi một dòng "timeout"
vào `bot_errors`. Đó là hạn của NGƯỜI GỌI, không phải hàm hỏng: edge function
vẫn chạy tiếp tới xong. Nhưng dòng đó cũng đáng đọc theo nghĩa khác — đường cứu
chỉ chạy khi đường nhanh đã hỏng, nên thấy nó là có chuyện. Soi việc thật ở
`job_suc_khoe` chứ đừng kết luận từ dòng timeout.

**Zalo OA không có khoá idempotency phía nhà cung cấp** (`message/cs`, tài liệu
v3.0). Nên chống gửi đúp bằng cách ĐẾM: `inbound_ledger.sent_bubbles` ghi sau
MỖI bong bóng tới nơi, lần thử sau bỏ qua đúng bấy nhiêu tấm đầu và dừng hẳn khi
gửi hụt (không gửi lệch thứ tự).

## Cổng cho edge function (FR-167, 29/08/2026)

**`verify_jwt=true` KHÔNG phải là xác thực.** Nó chỉ đòi publishable key, mà
khoá đó nằm sẵn trong bundle JS của web — ai mở trang cũng có. Đợt soát bảo mật
29/08 gọi thử bằng đúng khoá đó và `ask-seller`, `ctv-report`,
`geocode-listings` đều CHẠY; `nudge` thì còn tệ hơn, `verify_jwt=false` và không
kiểm gì cả nên POST tay không kèm khoá nào cũng chạy.

Nay **tám** function dùng chung một cổng: qua nếu (a) `Authorization` là service
key, hoặc (b) header `x-bridge-secret` khớp secret `BRIDGE_SECRET` trong Vault.
Chưa đặt secret thì cổng mở như cũ — nhưng nó ĐANG được đặt.

| Function | Ai gọi hợp lệ |
|---|---|
| `chat-reply` | `zalo-webhook` (service key), bridge |
| `nudge` | cron `nudge_tick` (mang bridge secret) |
| `ctv-report` | cron `ctv_report_tick` (mang bridge secret) |
| `media-cleanup` | cron `media_cleanup_tick` (mang bridge secret) |
| `inbound-sweep` | cron `inbound_sweep_tick` (mang bridge secret) |
| `ask-seller` | cron `seller-drip-tick` + trigger `trg_listing_drip`, cả hai qua `ask_seller_drip()` — **hàm đó PHẢI mang bridge secret**, xem `20260829e` / gọi tay / bridge |
| `geocode-listings` | gọi tay |
| `escalation-feed` | bridge (dùng 401 thay vì 403, có từ trước) |

Sửa hàm tick TRƯỚC rồi mới deploy function, để cron không đứt nhịp nào.

**Đọc bí mật phải qua `secretOf()` — env TRƯỚC, Vault SAU.** `get_secret` trần
chỉ hỏi Vault, nên nếu `BRIDGE_SECRET` được đặt bằng biến môi trường của
function thì cửa đó đọc ra `null` và **mở toang trong khi cả nhà đã đóng**. Đã
vấp đúng hai chỗ (`geocode-listings`, `escalation-feed`), vá 29/08.

**Cổng fail-open là chủ ý, nhưng không được im.** Gắn cổng trước khi có bí mật
thì cron không gãy — cái giá là một lần đọc hụt bí mật biến function thành công
khai mà không ai hay. Cả tám cửa nay ghi `bot_errors` nguồn
`<tên function> CONG MO` khi không đọc được `BRIDGE_SECRET` (van `log_loi` 20
dòng/nguồn/giờ chặn spam). Thấy dòng đó ở `/admin` là **đang hở**, không phải
cảnh báo cho vui.

**`zalo-webhook` là ngoại lệ và đang HỞ** — nó buộc phải `verify_jwt=false` (Zalo
không gửi JWT Supabase được), hàng rào duy nhất là chữ ký `X-ZEvent-Signature`,
mà `ZALO_APP_SECRET`/`ZALO_APP_ID` chưa có trong Vault nên khối verify bị nhảy
qua. Đặt hai secret đó vào Vault là đóng, không phải sửa code. Xem **OPEN-33**.
Trong lúc chờ, mỗi lượt bỏ qua verify ghi một dòng `zalo-webhook KHONG VERIFY`
vào `bot_errors`.

### Điểm mù: migration stub

`bot/supabase/migrations/20260825_seller_drip.sql` là **stub 6 dòng ghi chú**,
không có SQL thật — DDL được áp qua MCP mà không lưu lại. Hệ quả cụ thể: thân
`ask_seller_drip()` **chưa từng có mặt trong repo** cho tới `20260829e`, nên mọi
lượt soát tĩnh bằng grep đều không thấy nó nhúng anon JWT và không thấy nó gọi
`ask-seller`. Đó chính là lý do đợt vá cổng FR-167 bỏ sót người gọi này.

Đã quét cả thư mục: đây là stub DUY NHẤT, các file khác đều có SQL thật. Nhưng
bài học giữ nguyên — **"bản sao tham chiếu" mà thiếu một hàm thì nó nói dối**.
Áp DDL qua MCP xong phải chép lại nội dung thật vào file migration tương ứng.

## Tiền bộ não (FR-168, FR-169, 01/09/2026)

### Một lượt khách nhắn tốn gì

Gói gửi lên mỗi lượt buyer ~19–20 nghìn ký tự. Chia làm hai nửa **giá lệch nhau
10 lần**, và đó là toàn bộ câu chuyện chi phí:

| Nửa | Nội dung | Cỡ | Giá |
|---|---|---|---|
| Trước điểm nhớ tạm | 6 khối luật + ví dụ mẫu + dự án nhà mình | ~13.000 ký tự (~5.800 chữ-máy) | đọc lại: 1/10 |
| Sau điểm nhớ tạm | kho 6 căn, căn khách nhắc, dự án khách nhắc, hồ sơ, 12 tin gần nhất | ~6.000 ký tự (~2.800 chữ-máy) | đủ giá |

Giá niêm yết Opus 5: 5 đô/triệu chữ-máy vào, 25 đô/triệu ra; nạp bộ nhớ tạm
1,25× (nhịp 5 phút) hoặc 2× (nhịp 1 giờ); đọc lại 0,1×.

Ra tiền một lượt: **trúng nhớ tạm ~0,027 đô**, **không dùng nhớ tạm ~0,053 đô**,
**trượt nhớ tạm ~0,060 đô**. Đọc lại dòng cuối cho kỹ — **một lượt TRƯỢT đắt hơn
là không bật nhớ tạm**. Đó không phải nghịch lý, đó là hoá đơn: đã trả phí nạp
mà không ai đọc lại.

### Chọn nhịp nhớ tạm theo LƯU LƯỢNG, không phải chọn một lần rồi thôi

Đồng hồ đếm từ lúc BẮT ĐẦU mỗi lượt, và mỗi lần đọc lại đặt lại đồng hồ. Nên cái
quyết định là **khoảng cách giữa hai lượt bất kỳ dùng chung khối luật** — cộng
gộp mọi khách, vì khối đó giống hệt nhau cho tất cả:

| Khoảng cách | Nhịp nên dùng |
|---|---|
| dưới 5 phút | 5 phút — lượt nào cũng làm nóng lại, rẻ nhất |
| 5–60 phút | **1 giờ** — khoảng DUY NHẤT bù nổi giá nạp gấp đôi |
| trên 1 giờ | cả hai đều không cứu, chịu lượt nguội |

Hôm nay khách thưa nên đang để **1 giờ**. **Vượt ~12 lượt/giờ (cỡ 10 khách/ngày
trong giờ làm) thì phải đổi ngược về 5 phút** — lúc đó lưu lượng tự giữ nóng và
giá nạp gấp đôi thành lỗ thuần. Điều kiện đổi ghi ngay tại chỗ `cache_control`
trong `chat-reply/index.ts`, đừng sửa mà không đọc.

Hệ quả ngược đời đáng nhớ: **càng đông khách, giá trên đầu lượt càng RẺ.** Sợ
scale lên không chịu nổi là sợ nhầm chiều.

### Nguyên tắc chia prompt: theo GIÁ, không theo chủ đề

Cái gì **giống nhau cho mọi khách** thì lên trước điểm nhớ tạm. Cái gì **đổi
theo từng khách** thì xuống sau. Đừng nhóm theo chủ đề cho gọn mắt.

Đúng một lỗi loại này đã bị bắt hôm 01/09: khối dự án Ny'ah (~1.900 ký tự, riêng
thông số + mẫu căn đã 1.350) nằm chung với khối kho ở nửa sau, nên gửi đủ giá mỗi
lượt cho **cả khách chưa hề hỏi tới dự án**. Nó giống hệt nhau cho mọi người —
chỗ của nó là nửa trước. Dời sang: rẻ đi 10 lần, không mất chi tiết nào. Dự án
khách VỪA NHẮC TÊN thì khác, cái đó biến động, ở lại nửa sau.

### Đọc số thật ở đâu

`/admin` → thẻ **"Tiền bộ não · 7 ngày"**. Ba điều cần biết khi đọc:

1. **Nhìn TRUNG BÌNH MỘT LƯỢT, đừng nhìn tổng.** Tổng lớn lên theo số khách là
   lành mạnh. Trung bình một lượt phình ra mới là bệnh — prompt đang béo dần
   hoặc nhớ tạm đang trượt.
2. **Cột "đọc lại" dưới 50% là đang lỗ.** Nạp nhiều mà đọc lại ít nghĩa là lượt
   nào cũng trượt. Đổi nhịp theo bảng ở trên.
3. **Số đó là SÀN, không phải tổng.** Mới nối `doTien()` ở `chat-reply`. `nudge`,
   `ask-seller`, `ctv-report` chưa gắn. Gắn thêm chỉ là một dòng
   `await doTien(client, r.usage)` ngay sau chỗ lấy text ra.

Trần chặn đốt tiền vẫn là `bump_model_quota` đếm LƯỢT (FR-151a, mặc định
1000 lượt/ngày qua secret `DAILY_MODEL_CALL_CAP`). Đồng hồ đo chữ **không chặn
gì cả** — hỏng thì im, tuyệt đối không được kéo câu trả lời của khách xuống
nhánh dự phòng.

### Chuông hết tiền

Hết tiền tài khoản AI là **bộ não câm hoàn toàn** — mọi tin khách nhắn vào đều
không có câu trả lời. Ngày 28/08 chuyện này đã xảy ra thật và nằm im trong sổ
lỗi dưới cùng một tên nguồn với lỗi model thường ngày, không ai biết.

Nay trigger `trg_bot_errors_het_tien` soi mỗi dòng ghi vào `bot_errors`, thấy
dấu hiệu hết tiền thì dựng một dòng riêng tên nguồn `HET TIEN API`, hiện ở
`/admin`. Ba điều cố ý làm khác thường, đừng "dọn dẹp" mất:

- **Ghi thẳng, không qua `log_loi`.** Van chống ngập sổ (20 dòng/nguồn/giờ,
  200/giờ tổng) đúng cho lỗi thường, nhưng chuông báo sập hệ thống mà bị van
  nuốt đúng lúc sổ đang ngập thì vô dụng — mà sổ ngập chính là lúc dễ có sự cố
  lớn nhất.
- **Không đẩy qua cầu nối.** Cầu nối chết từ 27/08, và hậu quả là 83 dòng cảnh
  báo "cầu nối đang im" xếp hàng chờ **chính cái cầu nối đang im** để được gửi
  đi. Chuông hết tiền không được rơi vào cùng cái bẫy đó.
- **Sáu tiếng mới kêu lại.** Bài học từ `bo_dem_nhac_treo` (29/08): ghi mỗi 30
  phút → 48 dòng/ngày → sau hai ngày chiếm gần nửa sổ lỗi. Báo đúng mà nhịp sai
  cũng là một dạng làm ngập sổ.

### Một cái núm đang không làm gì (đừng tưởng nó có tác dụng)

Ngưỡng tối thiểu để nhớ tạm hoạt động trên Opus 5 là **512 chữ-máy**. Ngắn hơn
thì `cache_control` bị bỏ qua **im lặng** — không lỗi, không cảnh báo, chỉ là
không có gì xảy ra. Đo 01/09:

| Chỗ | Khối được đánh dấu nhớ tạm | ~chữ-máy | Thực tế |
|---|---|---|---|
| `chat-reply` buyer | 6 khối luật + ví dụ mẫu + dự án nhà mình | 5.700 | chạy |
| `chat-reply` seller r1/r2 | TONE + SELLER_SCRIPT | 1.520 | chạy |
| `chat-reply` seller r3 | TONE + SELLER_SCRIPT + FEES | 1.700 | chạy |
| `ask-seller` | TONE + SELLER_SCRIPT | 1.520 | chạy |
| `nudge` | TONE | 1.057 | chạy |
| `ctv-report` | RATE_CTV_RUBRIC | **414** | **KHÔNG chạy** |

`ctv-report` để đó cũng được, không hại gì: nó chạy mỗi ngày một lần và khối
rubric quá ngắn để đáng tiết kiệm. Nhưng **đừng nhồi chữ vào rubric chỉ để vượt
ngưỡng** — trả tiền cho chữ vô nghĩa để được giảm giá trên chính chữ vô nghĩa đó
là lỗ. Ghi ra đây để người sau khỏi tưởng nó đang tiết kiệm được gì.

Các khối seller để **nhịp 5 phút mặc định**, cố ý không đổi sang 1 giờ: chúng chỉ
~1.500 chữ-máy nên chênh lệch cả hai chiều đều dưới một xu mỗi lượt, không đáng
đụng vào một file đang chờ deploy. Chỉ khối buyer 5.700 chữ-máy mới đáng chọn
nhịp.
