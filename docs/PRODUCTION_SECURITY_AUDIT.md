# Soát bảo mật trước production — nhadat.cc

**Ngày soát**: 05/09/2026 · **Phạm vi**: toàn repo + project Supabase `tbcdpupiarkuxtntmosl` đang chạy thật
**Trạng thái**: chỉ ĐỌC và BÁO. Không sửa một dòng code nào trong đợt này.

Mọi kết luận dưới đây đo trên hệ thống thật (truy vấn catalog, đọc Vault, đọc
policy), không suy từ tài liệu. Chỗ nào chưa đo được thì ghi rõ là chưa đo.

---

## 0. Kiểm kê bề mặt tấn công

### 0.1 Cửa vào công khai

| # | Cửa | Kiểu | Xác thực | Ghi chú |
|---|---|---|---|---|
| 1 | `POST/GET /api/search` | Next route | **không** | thuần CPU, không đụng DB |
| 2 | `POST/GET /api/listing/parse` | Next route | **không** | thuần CPU, không đụng DB |
| 3 | `POST /functions/v1/zalo-webhook` | Edge, `verify_jwt=false` | **không** (chữ ký tắt — SEC-01) | cửa công khai bắt buộc |
| 4 | `POST /functions/v1/chat-reply` | Edge, `verify_jwt=false` | `x-bridge-secret` hoặc service key | fail-open (SEC-02) |
| 5 | `POST /functions/v1/nudge` | Edge, `verify_jwt=false` | `congBiMat` | fail-open |
| 6 | `POST /functions/v1/inbound-sweep` | Edge, `verify_jwt=false` | `congBiMat` | fail-open |
| 7 | `POST /functions/v1/media-cleanup` | Edge, `verify_jwt=false` | `congBiMat` | fail-open |
| 8 | `POST /functions/v1/escalation-feed` | Edge, `verify_jwt=true` | `congBiMat` (401) | trả PII (SEC-07) |
| 9 | `POST /functions/v1/ask-seller` | Edge, `verify_jwt=true` | `congBiMat` | |
| 10 | `POST /functions/v1/ctv-report` | Edge, `verify_jwt=true` | `congBiMat` | |
| 11 | `POST /functions/v1/geocode-listings` | Edge, `verify_jwt=true` | `congBiMat` | gọi tay |
| 12 | PostgREST `/rest/v1/*` | Supabase | anon key + RLS | 29 bài hồi quy trong CI |

**`verify_jwt=true` KHÔNG phải xác thực** ở dự án này: nó chỉ đòi publishable
key, mà key đó nằm trong `lib/supabase.ts` của repo public và trong mọi bundle
web. Hàng rào thật duy nhất của edge function là `x-bridge-secret`.

### 0.2 Không tồn tại (đã kiểm, không phải bỏ sót)

- **Server actions**: `grep -rl "use server"` → 0 kết quả.
- **Middleware**: không có `middleware.ts`.
- **`service_role` phía client**: `grep -rn "service_role" app/ components/ lib/ public/` → **sạch**.
- **Biến môi trường web**: chỉ 4, đều `NEXT_PUBLIC_*` (URL, anon key, site url, zalo url) — không có bí mật nào.
- **CORS**: edge function không đặt header CORS → trình duyệt bên thứ ba không gọi được bằng XHR (mặc định chặn). Đây là trạng thái đúng, không phải thiếu sót.

### 0.3 Những thứ đo được là ĐANG ĐÚNG

Ghi ra để đợt sửa không đi phá nhầm:

| Mục | Kết quả đo |
|---|---|
| `SECURITY DEFINER` thiếu `search_path` | **0/100 hàm** — tất cả đã ghim |
| `service_role` key trong mã client | không có |
| Hàm SECURITY DEFINER không tự kiểm quyền | không có — `admin_dang_tin` đối chiếu bảng `admins` theo email JWT, `tao_danh_sach` gọi `la_admin()`, `tin_cua_toi` khoá theo `auth.uid()` |
| Storage bucket nhận file tuỳ ý | không — `listing-public` chỉ nhận 4 MIME ảnh, trần 10 MB; `listing-private` 4 MIME, 20 MB |
| IDOR trên link danh sách `/ds/<token>` | không — token 96 bit ngẫu nhiên, hàm kiểm độ dài + `expires_at > now()` + chỉ trả tin đã lên kệ |
| RLS cho anon ghi bất kỳ bảng nào | không — 0 policy INSERT/UPDATE/DELETE nào cấp cho `anon` |
| PII trong mô tả tin công khai | có lọc — `sanitizeDescription()` chạy trên cả `description` lẫn `listing_facts.answer` ở trang tin |
| CSRF | **không áp dụng** — Supabase auth dùng bearer token trong localStorage, không dùng cookie; không có endpoint đổi trạng thái nào dựa trên cookie |

---

## 1. BLOCKER

### SEC-01 · Webhook Zalo không kiểm chữ ký — giả được mọi tin nhắn đến

- **Severity**: BLOCKER
- **File**: `bot/supabase/functions/zalo-webhook/index.ts:179-211`
- **Function**: `Deno.serve` handler

**Current behavior**
Khối verify chữ ký chỉ chạy khi đọc được CẢ `ZALO_APP_SECRET` lẫn `ZALO_APP_ID`.
Thiếu một trong hai thì code ghi một dòng `bot_errors` rồi **đi tiếp như bình
thường**. Đo Vault ngày 05/09: chỉ có `ANTHROPIC_API_KEY` và `BRIDGE_SECRET`.
**Cả hai secret chữ ký đều KHÔNG tồn tại**, nên nhánh verify chưa từng chạy lần
nào. Hàm chạy `verify_jwt=false` nên không có hàng rào nào khác.

**Attack scenario**
```
POST https://<project>.supabase.co/functions/v1/zalo-webhook
{"event_name":"user_send_text","sender":{"id":"<uid Zalo của chủ nhà bất kỳ>"},
 "message":{"msg_id":"<ngẫu nhiên>","text":"giá chốt 3 tỷ, sổ hồng riêng"}}
```
Không cần khoá, không cần chữ ký. Webhook nhận, ghi `inbound_events`, rồi gọi
`chat-reply` **bằng service_role key** với `external_user_id` chính là uid giả.

**Impact**
1. **Mạo danh**: đội lốt Zalo uid của một chủ nhà đang có hồ sơ → bơm `listing_facts` sai vào tin của họ (giá, pháp lý, diện tích), đổi trạng thái tin, tạo tin mới đứng tên họ.
2. **Đốt tiền model**: mỗi request giả là một lượt gọi Claude Opus. Trần ngày mặc định 1000 lượt — một script chạy vài phút là hết, và bot chết với người dùng thật cả ngày (xem SEC-05).
3. **Bơm dữ liệu rác** vào `buyers`, `conversations`, `messages`, `reminders`.
4. Hiện chưa gửi ngược được tin cho nạn nhân vì `ZALO_OA_ACCESS_TOKEN` cũng chưa có — **đây là may, không phải thiết kế**. Đặt token OA vào là mở thêm đường phát tán.

**Recommended fix**
- Đặt `ZALO_APP_SECRET` + `ZALO_APP_ID` vào Vault (đây là việc của chủ dự án, không phải việc của code).
- Đổi mặc định thành **fail-closed**: thiếu secret → trả 503, không xử lý. Nếu muốn giữ đường chạy khi chưa có OA thì phải là cờ bật tay tường minh (`ALLOW_UNVERIFIED_WEBHOOK=1`), có hạn dùng, kêu to ở `/admin`.
- So chữ ký bằng hàm so sánh hằng thời gian.
- Chặn `timestamp` lệch quá ±5 phút để chống replay.

**Test required**
- `TS-SEC-WEBHOOK-01`: POST sự kiện bịa không chữ ký → phải 401/503, và **không** sinh dòng nào trong `inbound_events`/`messages`.
- `TS-SEC-WEBHOOK-02`: POST đúng chữ ký → 200 và xử lý bình thường.
- `TS-SEC-WEBHOOK-03`: POST đúng chữ ký nhưng `timestamp` cũ 1 giờ → từ chối.
- `TS-SEC-WEBHOOK-04`: gửi lại y hệt một request hợp lệ → không nhân đôi `messages` (đã có `inbound_events` PK, cần khẳng định lại sau khi sửa).

---

## 2. CRITICAL

### SEC-02 · Cổng bí mật fail-open — đọc hụt Vault là mở toang 7 function

- **Severity**: CRITICAL
- **File**: `bot/supabase/functions/_shared/gate.ts:25-30`; lặp lại ở `chat-reply/index.ts:428-441`
- **Function**: `congBiMat()`, và khối cổng nội tuyến của `chat-reply`

**Current behavior**
```ts
const bimat = await secretOf(client, "BRIDGE_SECRET");
if (!bimat) {
  await ghiLoi(client, `${ten} CONG MO`, "…cổng đang MỞ, ai cũng gọi được.");
  return null;                    // ← CHO QUA
}
```
`secretOf` đọc env trước, hụt thì gọi RPC `get_secret` (một vòng mạng tới
Postgres). Vòng đó hụt vì **bất kỳ lý do gì** — Vault lỗi, DB quá tải, timeout,
ai đó xoá nhầm secret, pool cạn kết nối — đều trả `null`, và `null` nghĩa là mở.
Không có phân biệt "không có secret" với "không đọc được secret".

**Attack scenario**
Kẻ tấn công không cần gây ra sự cố: chỉ cần **thăm dò liên tục**. Mỗi phút gửi
một request không kèm `x-bridge-secret` tới `nudge`. 99,9% thời gian nhận 403.
Đúng khoảnh khắc DB nghẹn hoặc Vault chậm, request lọt. Lúc đó:
- `POST /nudge {"force":true}` → bot **nhắn thật** cho toàn bộ khách đang có lời nhắc pending, ngoài giờ, sai ngữ cảnh.
- `POST /escalation-feed {"action":"pull"}` → dump SĐT thật (SEC-07).
- `POST /chat-reply` với `external_user_id` bất kỳ → mạo danh (SEC-04).
- `POST /media-cleanup` → xoá file Storage.

**Impact**
Toàn bộ hàng rào của 7 edge function biến mất trong cửa sổ sự cố, đúng lúc hệ
thống đang yếu nhất. Việc có ghi `bot_errors` là tốt, nhưng đó là ghi nhận SAU
KHI đã cho qua — nó không chặn gì.

**Recommended fix**
- Đảo mặc định thành **fail-closed**: đọc hụt secret → 503 `{"error":"gate_unavailable"}`.
- Nếu vẫn cần đường chạy khi chưa cấu hình secret, tách hai trạng thái: "secret CHƯA ĐẶT" (do một cờ tường minh `GATE_DISABLED=1`) khác hẳn "ĐỌC HỤT" (luôn chặn).
- Nhớ tạm giá trị secret ở tầng module (đã có `napCauHinh` 60 s) để một lần Vault nghẹn không thành một lần mở cổng.

**Test required**
- `TS-SEC-GATE-01`: giả lập `get_secret` trả `null` → mọi function gated phải trả 503, không phải 200.
- `TS-SEC-GATE-02`: có secret, không gửi header → 403.
- `TS-SEC-GATE-03`: có secret, gửi đúng header → 200.
- Chạy được offline bằng khuôn `bot/tests/ts-sec-anon.tu-kiem.mjs` (dựng server giả).

---

### SEC-03 · `escalation-feed` ack ghi `admins.zalo_user_id` KHÔNG có điều kiện dòng

- **Severity**: CRITICAL
- **File**: `bot/supabase/functions/escalation-feed/index.ts:63-66`
- **Function**: `Deno.serve` handler, nhánh `action === "ack"`

**Current behavior**
```ts
} else {
  await client.from("admins").update({ zalo_user_id: learned })
    .is("zalo_user_id", null);          // ← KHÔNG có .eq() nào
}
```
Hai nhánh trên có `.eq("id", r.seller_id)` / `.eq("id", r.ctv_id)`. Nhánh admin
thì không — nó cập nhật **mọi dòng `admins`** đang có `zalo_user_id` NULL, với
giá trị do người gọi truyền vào. Chạy bằng service_role nên RLS không cản.

**Attack scenario**
Kẻ tấn công qua được cổng (bằng secret rò, hoặc bằng cửa sổ fail-open SEC-02):
1. `POST {"action":"pull"}` → lấy một `id` của reminder không gắn seller/ctv.
2. `POST {"action":"ack","id":"<id đó>","zalo_user_id":"<uid Zalo của kẻ tấn công>"}`
3. Từ giờ mọi việc kind `escalation` và `report` không có đích cụ thể đều trả về uid của kẻ tấn công.

**Impact**
- **Báo cáo CTV 17h hằng ngày** (`ctv_daily_reports.body`: đơn, lịch xem, việc chờ, tên khách) được giao thẳng cho kẻ tấn công.
- Mọi escalation "khách cần người thật" — kèm trích tin nhắn của khách — đi về máy kẻ tấn công.
- Admin thật không còn nhận được gì, mà không có cảnh báo nào: ô `zalo_user_id` đã hết NULL nên lần sau không ai ghi đè.

**Recommended fix**
- Bỏ hẳn nhánh admin, hoặc bắt buộc `.eq("email", <email admin lấy từ reminder>)`.
- Nguyên tắc chung: **cấm mọi `update()`/`delete()` không có mệnh đề khoá chính** trong code chạy service_role. Thêm một bài lint/grep chặn ở CI.
- `zalo_user_id` học được nên đi qua hàng đợi chờ admin duyệt, không ghi thẳng.

**Test required**
- `TS-SEC-ACK-01`: ack một reminder không seller/ctv kèm `zalo_user_id` lạ → bảng `admins` KHÔNG đổi.
- `TS-SEC-ACK-02`: ack reminder của seller → chỉ đúng một dòng `sellers` đổi.
- `TS-SEC-ACK-03`: grep toàn repo, không còn `.update(` nào chạy service_role mà thiếu `.eq(`.

---

### SEC-04 · `external_user_id` được tin tuyệt đối — mạo danh mọi vai

- **Severity**: CRITICAL
- **File**: `bot/supabase/functions/chat-reply/index.ts:392-400`
- **Function**: `Deno.serve` handler

**Current behavior**
`external_user_id` lấy thẳng từ body, không đối chiếu với bất kỳ danh tính nào
đã xác thực. Toàn bộ phân vai phía sau (người mua / người bán / CTV / admin) tra
từ chính chuỗi này: `sellers.zalo_user_id`, `ctvs.zalo_user_id`,
`admins.zalo_user_id`. Ai đặt được giá trị đó thì **là** người đó.

**Attack scenario**
Qua cổng (SEC-01 cho đường webhook, SEC-02 cho đường trực tiếp), gửi
`external_user_id` = uid của một CTV → bot nhận là CTV, cho phép cú pháp nội bộ
`#<mã tin>: <câu trả lời>` để ghi `listing_facts` với `source='ctv'` và đóng câu
hỏi của khách. Đặt uid của admin → vào nhánh nội bộ.

**Impact**
Leo thang vai hoàn toàn: ghi dữ liệu đứng tên người khác, đóng câu hỏi khách
bằng thông tin bịa, đổi vòng đời tin. Dữ liệu sai này sau đó được bot đọc lại và
nói với khách thật như sự thật đã xác minh — phá thẳng RSK-03.

**Recommended fix**
- Đường webhook: chỉ tin `sender.id` **sau khi** chữ ký hợp lệ (SEC-01). Đó là cách sửa gốc.
- Đường bridge: bridge chỉ được phép nói thay các uid nó thật sự quản; thêm một danh sách cho phép hoặc ký từng request theo uid.
- Tách hẳn cửa nội bộ (CTV/admin `#mã:`) khỏi cửa nhận tin khách, và cửa đó đòi xác thực riêng chứ không dựa vào một chuỗi trong body.

**Test required**
- `TS-SEC-VAI-01`: gọi `chat-reply` với `external_user_id` = uid CTV nhưng không có chữ ký/quyền tương ứng → từ chối.
- `TS-SEC-VAI-02`: cú pháp `#mã: trả lời` từ uid không thuộc `ctvs` → không ghi `listing_facts`.

---

## 3. HIGH

### SEC-05 · Không có trần theo người/IP — một kẻ đốt sạch hạn mức model của cả ngày

- **Severity**: HIGH
- **File**: `bot/supabase/functions/chat-reply/index.ts:637-646`, `326-340`
- **Function**: `napCauHinh()`, `bump_model_quota`

**Current behavior**
Trần duy nhất là **toàn cục theo ngày**: `DAILY_MODEL_CALL_CAP`, mặc định 1000.
Không có trần theo `external_user_id`, theo IP, theo phút. Chạm trần thì trả
429 cho **tất cả mọi người**.

**Attack scenario**
Script gửi 1000 request qua `zalo-webhook` (không cần khoá — SEC-01), mỗi
request một `msg_id` mới. Vài phút là hạn mức ngày cạn. Từ đó tới nửa đêm, mọi
khách thật nhắn bot đều rơi vào nhánh 429.

**Impact**
- **DoS toàn dịch vụ** với chi phí gần bằng 0 cho kẻ tấn công.
- Tiền: 1000 lượt Claude Opus/ngày, lặp lại mỗi ngày.
- Trần là cầu chì bảo vệ ví, nhưng đồng thời là nút tắt dịch vụ mà ai cũng bấm được.

**Recommended fix**
- Thêm trần **theo `external_user_id`** (ví dụ 30 lượt/giờ, 100 lượt/ngày) và trần theo IP ở tầng trước.
- Tách hạn mức: người dùng đã biết (có `zalo_user_id` trong `sellers`/`ctvs`/`buyers` cũ) được hạn rộng; uid lạ hạn hẹp.
- Chạm trần cá nhân → im với riêng người đó, không hạ cả hệ thống.

**Test required**
- `TS-SEC-QUOTA-01`: 40 request cùng một `external_user_id` trong 1 giờ → request thứ 31 trở đi bị chặn.
- `TS-SEC-QUOTA-02`: người dùng thứ hai vẫn trả lời bình thường khi người thứ nhất đã chạm trần.

---

### SEC-06 · Không giới hạn độ dài `text` — chi phí model không có trần trên

- **Severity**: HIGH
- **File**: `bot/supabase/functions/chat-reply/index.ts:393`, `2050`, `2114-2129`
- **Function**: `Deno.serve` handler → khối gọi model

**Current behavior**
`const text = String(body.text ?? "").trim();` — không cắt. Các chỗ ghi sổ có
`.slice(0,120/200/300)`, nhưng **chuỗi đưa vào model là `text` nguyên vẹn**.
`max_tokens` chỉ chặn đầu RA (1024), không chặn đầu VÀO.

**Attack scenario**
Một request kèm `text` dài 500 KB. Được tính là ~125.000 token đầu vào cho một
lượt. Lặp lại tới khi chạm trần 1000 lượt: hoá đơn của một ngày bị nhân lên
hàng trăm lần so với dự tính, trong khi bộ đếm `bot_usage.model_calls` vẫn chỉ
thấy 1000 lượt "bình thường".

**Impact**
Trần theo LƯỢT không bảo vệ được ví khi mỗi lượt có kích thước tuỳ ý. Đây là
chỗ cầu chì hiện tại nhìn nhầm đại lượng.

**Recommended fix**
- Cắt cứng `text` (ví dụ 4.000 ký tự) ngay tại cửa vào, trước mọi xử lý.
- Từ chối request có `Content-Length` vượt ngưỡng (ví dụ 64 KB) trước khi đọc body.
- Thêm trần theo TOKEN/ngày bên cạnh trần theo lượt — `bot_usage` đã ghi sẵn `in_tokens`.

**Test required**
- `TS-SEC-PAYLOAD-01`: `text` 1 MB → 413, không gọi model, không tăng `bot_usage`.
- `TS-SEC-PAYLOAD-02`: `text` 3.900 ký tự → xử lý bình thường.

---

### SEC-07 · `escalation-feed` trả SĐT thật cho bất kỳ ai qua cổng

- **Severity**: HIGH
- **File**: `bot/supabase/functions/escalation-feed/index.ts:77-104`
- **Function**: nhánh `pull`

**Current behavior**
Trả về `phone` thật của người bán / CTV / admin, kèm `name` và trích nội dung
việc, 10 dòng mỗi lượt, gọi lại được liên tục. Không phân trang theo danh tính,
không audit ai kéo.

**Attack scenario**
Qua cổng (SEC-02 hoặc secret rò từ máy chạy bridge — bridge là máy cá nhân,
`bot/bridge-zca/.env` chứa secret ở dạng thô), gọi `pull` lặp lại → gom dần danh
bạ chủ nhà và CTV.

**Impact**
Rò PII trực tiếp: số điện thoại thật của người dân. Vi phạm chính lời hứa
NFR-07/BR-06 của sản phẩm, và là loại dữ liệu nhạy cảm nhất hệ thống đang giữ.

**Recommended fix**
- Không trả `phone` khi đã có `zalo_user_id` (bridge chỉ cần SĐT lúc chưa biết uid).
- Ghi audit mỗi lượt `pull`: ai kéo, kéo bao nhiêu dòng.
- Xoay `BRIDGE_SECRET` theo lịch; bridge dùng khoá riêng theo máy, không dùng chung một chuỗi vĩnh viễn.

**Test required**
- `TS-SEC-FEED-01`: `pull` khi đích đã có `zalo_user_id` → trường `phone` phải là `null`.
- `TS-SEC-FEED-02`: mỗi lượt `pull` sinh đúng một dòng audit.

---

### SEC-08 · `image_url` không kiểm — SSRF gián tiếp qua API model + nhúng nội dung lạ vào trang công khai

- **Severity**: HIGH
- **File**: `bot/supabase/functions/chat-reply/index.ts:396`, `2114-2115`, `1261`, `1287`
- **Function**: khối dựng `content` gửi Anthropic; khối ghi `listing_facts`

**Current behavior**
```ts
{ type: "image", source: { type: "url", url: imageUrl } }
```
`imageUrl` lấy nguyên từ body người gọi, không kiểm scheme, host, kích thước.
Ngoài ra URL đó được ghi vào `listing_facts.answer` dạng `[ảnh] <url>`, và
`listing_facts` thì anon đọc được (policy `anon_read_listing_facts`).

**Attack scenario**
1. **SSRF gián tiếp**: đặt `image_url` trỏ tới host nội bộ hoặc endpoint metadata của hạ tầng Anthropic → hạ tầng của họ đi lấy hộ. Rủi ro nằm phía đối tác, nhưng khoá API của dự án là thứ ký request đó.
2. **Đốt tiền/treo hàm**: trỏ vào file ảnh 100 MB hoặc URL trả chậm vô hạn.
3. **Nhúng nội dung**: trỏ vào URL của kẻ tấn công → chuỗi đó nằm trong `listing_facts` và hiện trên trang tin công khai. React có escape nên **không phải XSS**, nhưng là nội dung lạ đứng tên tin của người khác, và là một beacon đếm lượt xem trang.

**Recommended fix**
- Chỉ nhận `image_url` khớp danh sách host cho phép (CDN của Zalo) và scheme `https`.
- Kiểm `Content-Length`/`Content-Type` bằng một request `HEAD` trước, có timeout.
- Không ghi URL thô vào `listing_facts`; tải về Storage rồi lưu đường dẫn nội bộ.

**Test required**
- `TS-SEC-SSRF-01`: `image_url = "http://169.254.169.254/…"` → từ chối, không gọi model.
- `TS-SEC-SSRF-02`: `image_url` host ngoài danh sách → từ chối.
- `TS-SEC-SSRF-03`: URL Zalo CDN hợp lệ → xử lý bình thường.

---

## 4. MEDIUM

### SEC-09 · `/api/search`, `/api/listing/parse` — không trần độ dài, không rate limit

- **Severity**: MEDIUM
- **File**: `app/api/search/route.ts:23-45`, `app/api/listing/parse/route.ts:16-32`
- **Function**: `GET`/`POST`
- **Current behavior**: nhận chuỗi dài tuỳ ý, chạy qua hàng chục regex trong `lib/parse-query.ts`. Không xác thực, không trần.
- **Attack scenario**: POST liên tục chuỗi vài trăm KB → mỗi request đốt CPU lambda Vercel. Một số regex có nhóm lồng nên chi phí có thể siêu tuyến tính theo độ dài (chưa đo cụ thể regex nào — cần một lượt đo riêng).
- **Impact**: cạn hạn mức lambda của bậc Free, web chết; hoá đơn Vercel tăng.
- **Recommended fix**: cắt đầu vào ở 500 ký tự; thêm rate limit theo IP ở tầng edge; đo lại từng regex với chuỗi bệnh lý.
- **Test required**: `TS-SEC-API-01` chuỗi 1 MB → 413 dưới 50 ms. `TS-SEC-API-02` đo thời gian parse chuỗi 500 ký tự xấu nhất < 10 ms.

### SEC-10 · Người dùng đăng nhập bất kỳ tạo được vô hạn tin và ảnh

- **Severity**: MEDIUM
- **File**: policy `listings_own_insert`, `listing_media_own_insert`, `storage_seller_own_insert`; `components/UploadAnh.tsx:70-107`
- **Function**: RLS + luồng up ảnh
- **Current behavior**: đăng nhập bằng magic link (mở cho mọi email). Sau đó tạo `sellers` cho chính mình, tạo tin `cho_thong_tin` không giới hạn số lượng, mỗi tin up 20 ảnh × 10 MB.
- **Attack scenario**: đăng ký một email, tạo 50 tin, up 1.000 ảnh → 1 GB bucket Free đầy. Up ảnh của người khác hoặc nội dung không phù hợp cũng nằm trên miền của dự án.
- **Impact**: cạn Storage → người bán thật không up được; nội dung rác gắn với thương hiệu.
- **Recommended fix**: trần số tin `cho_thong_tin` chưa duyệt mỗi tài khoản (ví dụ 5); trần số ảnh mỗi tin (ví dụ 20) ở tầng DB chứ không chỉ ở UI; tin của tài khoản mới phải qua duyệt trước khi ảnh công khai.
- **Test required**: `TS-SEC-QUOTA-03` tài khoản mới tạo tin thứ 6 → bị từ chối. `TS-SEC-QUOTA-04` chèn dòng `listing_media` thứ 21 → bị từ chối.

### SEC-11 · So sánh bí mật không hằng thời gian

- **Severity**: MEDIUM
- **File**: `bot/supabase/functions/_shared/gate.ts:33`, `chat-reply/index.ts:439`, `zalo-webhook/index.ts:207`
- **Function**: `congBiMat()`, khối cổng chat-reply, khối verify chữ ký
- **Current behavior**: `===` trên chuỗi — thoát sớm ở byte đầu khác nhau.
- **Attack scenario**: đo thời gian phản hồi qua nhiều nghìn request để dò dần từng byte. Qua Internet nhiễu lớn nên khó, nhưng `BRIDGE_SECRET` là bí mật dài hạn, kẻ tấn công có thời gian.
- **Impact**: rò dần bí mật cổng → dẫn tới SEC-03, SEC-07.
- **Recommended fix**: so bằng hàm hằng thời gian (băm cả hai vế rồi so, hoặc `crypto.subtle.timingSafeEqual` tương đương).
- **Test required**: `TS-SEC-TIMING-01` đo phân bố thời gian với secret sai ở byte đầu và byte cuối — không được phân biệt.

### SEC-12 · `JSON.parse` không bọc trong nhánh verify chữ ký

- **Severity**: MEDIUM
- **File**: `bot/supabase/functions/zalo-webhook/index.ts:205`
- **Function**: khối verify
- **Current behavior**: `const ts = JSON.parse(raw).timestamp ?? "";` — `raw` đã được parse thử ở trên trong `try/catch`, nhưng ở đây gọi lại **không** bọc.
- **Attack scenario**: sau khi đặt secret chữ ký (tức sau khi vá SEC-01), gửi body không phải JSON → exception không bắt → 500.
- **Impact**: hiện chưa với tới được (nhánh chưa chạy). Sẽ thành lỗi 500 hàng loạt ngay khi vá SEC-01 — **ghi ở đây để đợt vá SEC-01 không đẻ ra sự cố mới**.
- **Recommended fix**: dùng lại biến `body` đã parse ở trên; nếu `body` là `null` thì từ chối 400 trước khi verify.
- **Test required**: `TS-SEC-WEBHOOK-05` POST body không phải JSON → 400, không 500.

### SEC-13 · `mark_sent` sửa sổ gửi của bất kỳ `msg_id` nào

- **Severity**: MEDIUM
- **File**: `bot/supabase/functions/chat-reply/index.ts:456-472`
- **Function**: nhánh `body.mark_sent`
- **Current behavior**: qua cổng là update được `inbound_ledger` theo `zalo_msg_id` tuỳ ý — đặt `sent_at`, `sent_bubbles`.
- **Attack scenario**: đánh dấu "đã gửi" cho các tin thật chưa gửi → cờ chống-gửi-đúp (FR-162) khiến câu trả lời thật không bao giờ tới khách, mà mọi mã HTTP vẫn 200.
- **Impact**: phá tính toàn vẹn của đường giao tin, im lặng hoàn toàn. Đây đúng loại hỏng mà `docs/11` gọi là nguy nhất.
- **Recommended fix**: chỉ cho `mark_sent` với `msg_id` mà chính người gọi vừa nhận ở lượt trước (gắn token một lần), hoặc giới hạn theo kênh của bridge.
- **Test required**: `TS-SEC-MARK-01` `mark_sent` một `msg_id` của kênh khác → từ chối.

### SEC-14 · Tin `da_chot` đọc được công khai

- **Severity**: MEDIUM
- **File**: policy `anon_read_listings`
- **Function**: RLS trên `listings`
- **Current behavior**: `status = ANY (dang_ban, dang_quan_tam, da_chot)` — tin đã chốt vẫn công khai kèm `location_raw` (địa chỉ có số nhà), giá, diện tích.
- **Attack scenario**: kéo toàn bộ tin `da_chot` qua PostgREST → dựng bộ dữ liệu "nhà nào vừa bán, địa chỉ nào, giá bao nhiêu".
- **Impact**: lộ thông tin giao dịch của người dân; cũng là món hàng cho đối thủ. Có thể là chủ ý (bằng chứng thị trường), nhưng chưa thấy quyết định nào ghi lại.
- **Recommended fix**: chốt với chủ dự án. Nếu giữ thì che `location_raw` của tin `da_chot` xuống mức phường.
- **Test required**: `TS-SEC-DACHOT-01` anon đọc tin `da_chot` → `location_raw` không có số nhà.

---

## 5. LOW

| ID | Severity | File · Function | Hiện trạng · Rủi ro · Cách sửa · Test |
|---|---|---|---|
| SEC-15 | LOW | `bot/bridge-zca/index.mjs:175,216,402` · vòng lặp nhận/gửi | Ghi nguyên văn tin nhắn khách và `note` ra console. Máy chạy bridge là máy cá nhân, log lưu trong journald. **Rủi ro**: PII nằm trong log hệ thống ngoài tầm kiểm soát. **Sửa**: cắt còn 30 ký tự hoặc chỉ log id. **Test**: `TS-SEC-LOG-01` grep log sau 10 tin → không có nội dung đầy đủ. |
| SEC-16 | LOW | `app/quan-ly/page.tsx:85` · `submit`; `components/UploadAnh.tsx:100` · `chon` | Hiện `error.message` thô của Supabase ra UI (tên bảng, tên policy, mã lỗi Postgres). **Rủi ro**: lộ cấu trúc nội bộ cho người dùng thường. **Sửa**: ánh xạ sang câu tiếng Việt, ghi chi tiết vào `bot_errors`. **Test**: `TS-SEC-ERR-01` gây lỗi RLS → UI không chứa chữ "policy"/"relation". |
| SEC-17 | LOW | `public.log_loi(text,text,integer)` | Anon gọi được (bắt buộc, web dùng publishable key — FR-152 c). Có van 20 dòng/nguồn/giờ và 200 dòng/giờ. **Rủi ro**: bơm 200 dòng rác/giờ để đẩy lỗi thật ra khỏi tầm nhìn ở `/admin`. **Sửa**: tách `source` do client đặt sang một cột riêng, đừng để nó lách van; thêm van theo IP. **Test**: `TS-SEC-LOG-02` bơm 500 dòng → sổ vẫn thấy được lỗi thật mới nhất. |
| SEC-18 | LOW | `storage.buckets` · `listing-photos` | Bucket mồi còn tồn tại (`file_size_limit = 1` byte, MIME `application/x-nonexistent`). **Rủi ro**: rất thấp, nhưng là vật thừa dễ bị ai đó "sửa cho đúng" rồi mở ra. **Sửa**: xoá bucket. **Test**: `TS-SEC-BUCKET-01` chỉ còn 2 bucket. |
| SEC-19 | LOW | `bot/supabase/functions/*` | Không đặt header CORS. **Hiện là ĐÚNG** (trình duyệt bên thứ ba không gọi được). Ghi lại để đợt sau đừng thêm `Access-Control-Allow-Origin: *` cho tiện. **Test**: `TS-SEC-CORS-01` fetch từ origin lạ → bị chặn. |

---

## 6. Những mục audit không phát sinh finding

| Mục yêu cầu | Kết quả |
|---|---|
| Server actions / server routes | Không tồn tại — không có bề mặt |
| `service_role` ở client | Sạch |
| `SECURITY DEFINER` thiếu `search_path` | 0/100 hàm |
| RLS bypass qua PostgREST | 29 bài hồi quy chạy mỗi PR (job `baomat`), 0 hỏng |
| IDOR trên `/ds/<token>` | Token 96 bit + kiểm hạn + chỉ tin đã lên kệ |
| Unrestricted file upload | Bucket chặn MIME + kích thước |
| CSRF | Không áp dụng (bearer token, không cookie) |
| Duplicate webhook | `inbound_events` PK theo `msg_id`, `delivery_count` tăng thay vì nhân đôi |
| Idempotency chiều gửi | `sent_bubbles` + `already_sent` (FR-162) — có, nhưng xem SEC-13 |
| Race condition worker | `reminders.locked_by`/`locked_at`, `inbound_ledger.locked_by` — có khoá; chưa soát sâu, đề nghị một lượt riêng |

**Chưa soát trong đợt này** (nói rõ để không ai tưởng đã xong): phân tích ReDoS
từng regex trong `lib/parse-query.ts` và `chat-reply`; đọc kỹ toàn bộ 2.507 dòng
`chat-reply` (mới đọc các khối cửa vào, cổng, gọi model, ghi fact); kiểm race
condition giữa hai worker `nudge` chạy chồng.

---

## 7. Tổng kết

| Mức | Số lượng | ID |
|---|---|---|
| **BLOCKER** | **1** | SEC-01 |
| **CRITICAL** | **3** | SEC-02, SEC-03, SEC-04 |
| **HIGH** | **4** | SEC-05, SEC-06, SEC-07, SEC-08 |
| **MEDIUM** | **6** | SEC-09, SEC-10, SEC-11, SEC-12, SEC-13, SEC-14 |
| LOW | 5 | SEC-15, SEC-16, SEC-17, SEC-18, SEC-19 |
| **Tổng** | **19** | |

### Top 10 phải xong trước production

| # | ID | Vì sao nằm ở đây |
|---|---|---|
| 1 | **SEC-01** | Cửa công khai không kiểm chữ ký. Mọi thứ khác đứng sau nó đều vô nghĩa. Cần chủ dự án đặt 2 secret Zalo — không code nào thay được. |
| 2 | **SEC-02** | Fail-open biến 7 function thành công khai đúng lúc hệ thống yếu. Sửa rẻ: đảo mặc định. |
| 3 | **SEC-04** | Mạo danh mọi vai. Vá SEC-01 là vá được nửa; nửa còn lại là đường bridge. |
| 4 | **SEC-03** | `update` thiếu `.eq()` — báo cáo CTV và escalation chuyển hướng về kẻ tấn công. Sửa một dòng. |
| 5 | **SEC-06** | Trần đang đếm nhầm đại lượng: đếm lượt trong khi tiền tính theo token. Sửa rẻ, chặn ngay hoá đơn bất ngờ. |
| 6 | **SEC-05** | Không có trần cá nhân → một kẻ tắt được dịch vụ cho tất cả. |
| 7 | **SEC-07** | Rò SĐT thật của người dân — đúng thứ NFR-07/BR-06 hứa không đụng tới. |
| 8 | **SEC-08** | URL không kiểm đi thẳng vào API model và vào trang công khai. |
| 9 | **SEC-13** | Phá đường giao tin một cách im lặng — loại hỏng khó phát hiện nhất. |
| 10 | **SEC-12** | Tự nó vô hại, nhưng sẽ đẻ ra 500 hàng loạt **ngay khi vá SEC-01**. Phải vá cùng lượt. |

### Ba nhận xét về gốc rễ

1. **Fail-open là một lựa chọn lặp lại, không phải một lần lỡ tay.** Cùng một
   khuôn "đọc hụt secret → cho qua, ghi sổ" xuất hiện ở `congBiMat`, ở cổng
   `chat-reply`, và ở verify chữ ký webhook. Bình luận trong code nói rõ đó là
   chủ ý để không làm gãy cron lúc chưa có bí mật. Ý đồ hợp lý cho giai đoạn
   dựng; **không hợp lý cho production**. Cần một lần đảo mặc định toàn cục.

2. **Ghi sổ đang bị dùng thay cho chặn.** Nhiều chỗ phát hiện đúng tình huống
   nguy hiểm, viết bình luận rất rõ, ghi `bot_errors` — rồi vẫn cho đi tiếp.
   Sổ chỉ có giá trị khi có người đọc; hàng rào thì không cần ai đọc.

3. **Trần và hàng rào đang đo sai đại lượng.** Trần model đếm LƯỢT trong khi
   tiền tính theo TOKEN (SEC-06); trần toàn cục trong khi mối đe doạ là MỘT
   người (SEC-05). Cầu chì đúng chỗ nhưng nhìn nhầm dòng điện.

---

## 8. Trạng thái vá (cập nhật 05/09/2026)

Toàn bộ 10 mục Top-10 đã VÁ TRONG MÃ NGUỒN, có test, đã commit. Migration đã
áp. Deploy edge function thì mới xong một phần — bảng dưới nói rõ cái nào đang
thật sự chạy trên production.

| ID | Vá trong mã | Đã deploy | Đã ĐO trên hệ thống thật |
|---|---|---|---|
| SEC-01 | ✅ | ✅ zalo-webhook v13 | ✅ sự kiện giả → **503**, `inbound_events` nhận **0 dòng** (trước: 200 + ghi sổ) |
| SEC-02 | ✅ | 🟡 5/7 function | ✅ 3 function: bí mật sai → 403, đúng → 200. **Còn: ctv-report, ask-seller, nudge, chat-reply** |
| SEC-03 | ✅ | ✅ escalation-feed v11 | ✅ nhánh ghi `admins` không điều kiện đã bỏ hẳn |
| SEC-04 | ✅ | ✅ (đóng theo SEC-01) | ✅ cùng phép đo SEC-01 |
| SEC-05 | ✅ `20260905d` | ❌ chat-reply | ✅ hàm DB: lượt 31 → false, uid rỗng → true, người quen nới ×4 |
| SEC-06 | ✅ | 🟡 webhook có, chat-reply chưa | ✅ e2e: body >128 KB → 413, text cắt còn 4.000 |
| SEC-07 | ✅ | ✅ escalation-feed v11 | ✅ **5/5 mục trả `phone: null`** — trước đó là 5 SĐT thật |
| SEC-08 | ✅ | ❌ chat-reply | ✅ e2e 3 ca (host lạ, http://, giả mạo hậu tố) |
| SEC-12 | ✅ | ✅ zalo-webhook v13 | ✅ body không phải object → 400 |
| SEC-13 | ✅ | ❌ chat-reply | ✅ e2e: msg_id không hợp lệ → `ok:false` |

**Đã deploy + đo**: `zalo-webhook` v13, `escalation-feed` v11, `inbound-sweep` v4,
`media-cleanup` v5, `geocode-listings` v6.
**Chưa deploy** (vẫn chạy bản fail-open cũ): `chat-reply`, `nudge`, `ask-seller`,
`ctv-report`.

**Vì sao dừng**: quy trình deploy của repo (`bot/README §Deploy`) bắt buộc bước
**so từng byte** bản kéo ngược với bundle. Trong phiên chạy từ xa này, nội dung
function phải đi qua context để vào lệnh deploy, và muốn so byte thì phải chép
bản kéo ngược một lần nữa — tức không có phép kiểm độc lập nào. Bốn function
còn lại đều nặng và dày template literal nhiều dòng (`chat-reply` 94 KB);
CLAUDE.md nói thẳng về đúng tình huống này: *"chép tay đo được một lỗi mỗi 7 KB,
và lỗi rơi vào regex thì hỏng im lặng"*. Đẩy bản chưa kiểm được vào bộ não hội
thoại là loại rủi ro không đáng, khi mã đã nằm an toàn trong repo.

**Cách deploy nốt** (máy có repo + Supabase CLI):
```bash
supabase functions deploy chat-reply nudge ask-seller ctv-report \
  --project-ref tbcdpupiarkuxtntmosl
bun run test:sec     # hồi quy RLS
```

### Hai điều đợt vá tự phát hiện

1. **SEC-02 bắt được một ca thật ngay sau khi deploy.** Sổ lỗi ghi
   `zalo-webhook VAULT HUT — Không đọc được secret chữ ký (JWT issued at future)`.
   Đó là lệch đồng hồ giữa edge runtime và DB, tức **đọc hụt thật**, không phải
   "chưa đặt secret". Với mã cũ, đúng khoảnh khắc đó cổng đã MỞ. Đây là bằng
   chứng trực tiếp cho kịch bản tấn công mô tả ở SEC-02, không phải giả định.
2. **Bộ e2e bắt lỗi của chính bản vá.** Danh sách host cho `image_url` bản đầu
   chỉ có `zadn.vn` mà quên `zdn.vn` — deploy như vậy là ảnh khách gửi bị chặn
   sạch trong khi bot vẫn trả lời tử tế, đúng kiểu hỏng im lặng. Ba ca ảnh của
   suite đỏ ngay.

### Còn treo, chưa vá trong đợt này

SEC-09, SEC-10, SEC-11 (một phần — đã so hằng thời gian ở 3 chỗ, còn các chỗ
khác), SEC-14, và toàn bộ nhóm LOW. Kèm ba mục "chưa soát" ở §6.
