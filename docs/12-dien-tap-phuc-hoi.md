# 12 — Diễn tập phục hồi từ bản sao

**Trạng thái tính tới 06/09/2026: CHƯA CÓ BẢN SAO NÀO TỒN TẠI.**
`scripts/sao-luu.mjs` chưa từng chạy, `bot/supabase/schema.sql` chưa có.
Vì vậy **KHÔNG có bản sao production nào được coi là "phục hồi ĐẠT"**. Tài liệu
này là quy trình + công cụ để lúc có bản sao thì chạy được ngay, cộng với phần
đã diễn tập thật và phần chưa.

Một bản sao chưa từng phục hồi thử **không phải là bản sao** — nó là một thư
mục file JSON mà chưa ai biết có dùng được không. Bậc Supabase Free không có
backup tự động (OPEN-25), nên đây là lưới duy nhất.

---

## 12.1 Ba script

| Script | Việc | Chạy ở đâu |
|---|---|---|
| `scripts/sao-luu.mjs` | Kéo 31 bảng + `schema.sql` về đĩa | máy có `SUPABASE_SERVICE_ROLE_KEY` |
| `scripts/phuc-hoi.mjs` | Nạp bản sao vào một DB TRỐNG | Postgres local / staging |
| `scripts/soat-phuc-hoi.mjs` | **Quyết định** được nói "ĐẠT" hay không | cùng chỗ |
| `scripts/soat-phuc-hoi.tu-kiem.mjs` | Bắt bộ soát tự chứng minh nó không mù | Postgres local, `bun run test:phuchoi` |

`phuc-hoi.mjs` **từ chối** mọi chuỗi kết nối có `supabase.co` hoặc `pooler.` —
nạp đè lên production là mất sạch, một dòng kiểm ở đó rẻ hơn một đêm không ngủ.

---

## 12.2 Quy trình đầy đủ (khi đã có bản sao thật)

```bash
# 0. Postgres local
pg_ctlcluster 16 main start
psql -U postgres -c 'create database phuc_hoi_thu'

# 1. Nạp
node scripts/phuc-hoi.mjs ~/nhadat-backup/2026-09-07 \
     postgresql://postgres@localhost:5432/phuc_hoi_thu

# 2. SOÁT — đây mới là bước kết luận
node scripts/soat-phuc-hoi.mjs ~/nhadat-backup/2026-09-07 \
     postgresql://postgres@localhost:5432/phuc_hoi_thu
```

Mã thoát của bước 2: **0 = ĐẠT · 1 = HỎNG · 2 = chưa soát được**.
Thoát 2 KHÔNG phải "đạt" — cùng luật với `test:sec`.

Chỉ khi bước 2 thoát 0 mới được ghi ngày vào bảng §12.6.

---

## 12.3 Bộ soát kiểm tám nhóm

| Nhóm | Kiểm gì | Bắt được lỗi nào |
|---|---|---|
| A | manifest ↔ `BANG[]` trong `sao-luu.mjs` | **bản sao khuyết**. Đây là nhóm quan trọng nhất: nếu chỉ so bản phục hồi với manifest của chính nó thì một bản sao thiếu ba bảng sẽ khớp hoàn hảo. Phải đối chiếu với nguồn NGOÀI bản sao |
| B | số dòng từng bảng + **đối chứng dương** | mất dòng lúc nạp; và "0 mồ côi" chỉ có nghĩa khi DB có dữ liệu thật |
| C | **đếm dòng mồ côi bằng LEFT JOIN**, không tin `pg_constraint` | phục hồi kiểu tắt ràng buộc → nạp → bật lại `NOT VALID`: catalog xanh mà dữ liệu đã thủng |
| D | cột trỏ sang `auth.users` | `auth.users` **không nằm trong bản sao**; ngày có người đăng nhập thật thì phục hồi gãy đúng chỗ này |
| E | `inbound_ledger` · `inbound_events` | trạng thái lạ, dòng kẹt `processing`, thiếu khoá idempotency, `event_id` trùng |
| F | `listing_media` **VÀ** `media` | mất bản đồ ảnh↔tin (OPEN-47): file còn trong Storage mà không ai biết của tin nào |
| G | `buyers → conversations → messages` | đứt chuỗi hội thoại |
| H | sequence sau khi nạp | nạp JSON không đẩy con đếm → INSERT kế tiếp đâm id trùng |

---

## 12.4 Ba thứ đồ thị khoá ngoại thật bắt phải làm khác đi

Đọc từ `pg_constraint` của DB production ngày 06/09/2026 (35 khoá ngoại):

**1. `sellers` ↔ `listings` là một VÒNG.**
`listings.seller_id → sellers.id` và `sellers.active_listing_id → listings.id`.
Không thứ tự nạp nào thoả cả hai nếu ràng buộc kiểm từng dòng. `phuc-hoi.mjs`
hạ mọi khoá ngoại xuống `deferrable`, nạp trong MỘT giao dịch với
`set constraints all deferred`, ràng buộc chỉ kiểm lúc COMMIT.

**2. `buyers`, `sellers`, `listing_views` trỏ sang `auth.users` — mà `auth.users`
KHÔNG có trong bản sao.**
Hôm nay vô hại: `auth.users` rỗng và cả ba cột đều NULL (đo 06/09). Nhưng ngày
có người đăng nhập thật, phục hồi sẽ gãy — và gãy lúc đang chữa cháy. Nhóm D
đếm và kêu. Diễn tập ca 6 chứng minh: nạp một `buyers.auth_user_id` non-null
làm nạp gãy ngay với `buyers_auth_user_id_fkey`.

**3. `listing_media` đang RỖNG; kho ảnh thật nằm ở `media`.**
Đo 06/09: `listing_media` = 0 dòng, `media` = 1005 dòng. Bộ soát kiểm **cả
hai** — chỉ nhìn bảng được nêu tên trong yêu cầu là bỏ sót toàn bộ kho ảnh.

---

## 12.5 Đã diễn tập thật cái gì — và CHƯA cái gì

### ✅ ĐÃ chạy thật (06/09/2026, Postgres 16.13 local)

`node scripts/soat-phuc-hoi.tu-kiem.mjs` → **10/10 ĐẠT**. Mười cảnh, mỗi cảnh
nạp một bản sao rồi soi mã thoát VÀ dấu hiệu trong đầu ra:

| # | Cảnh | Mong | Thật |
|---|---|---|---|
| 1 | **[đc]** bản sao lành → ĐẠT | 0 | ✅ 0 |
| 2 | manifest thiếu `listing_media` | 1 | ✅ 1 |
| 3 | xoá 1 dòng `messages` sau nạp | 1 | ✅ 1 |
| 4 | khoá ngoại bỏ lại `NOT VALID` + có mồ côi | 1 | ✅ 1 |
| 5 | manifest khai `trang_thai=thieu` | 1 | ✅ 1 (từ chối nạp) |
| 6 | `buyers.auth_user_id` non-null | 1 | ✅ 1 |
| 7 | sequence bị kéo lùi | 1 | ✅ 1 |
| 8 | `listing_media` VÀ `media` đều rỗng | 1 | ✅ 1 |
| 9 | `inbound_ledger` kẹt `processing` | 1 | ✅ 1 |
| 10 | manifest không khai thứ cố ý bỏ | 1 | ✅ 1 |

Ca 1 là **đối chứng dương**: không có nó thì chín ca kia có thể chỉ đang chứng
minh bộ soát luôn đỏ.

**Diễn tập bắt được ba lỗi thật trong chính công cụ vừa viết** — đó là điểm của
việc diễn tập:
- `phuc-hoi.mjs`: `format('%s', <boolean>)` sinh chữ `t` trần, Postgres đọc là
  TÊN CỘT → `column "t" does not exist`. Phải dùng `%L`.
- `soat-phuc-hoi.mjs`: so `convalidated::text` với `"t"`, trong khi `::text` của
  boolean ra `"true"`. Bản đầu báo **mọi** khoá ngoại là `NOT VALID` trên một DB
  hoàn toàn lành.
- `soat-phuc-hoi.mjs`: thiếu một cột thì cả bộ soát thoát 2 ("chưa soát được"),
  biến một phát hiện thành một sự im lặng. Nay thiếu cột là một dòng HỎNG.

Và bắt được một **ca tự kiểm giả đạt**: hai cảnh ban đầu báo ĐẠT chỉ vì mã thoát
tình cờ bằng 1 — do lỗi setval hoàn toàn khác. Nay mọi cảnh BẮT BUỘC khớp thêm
một dấu hiệu chữ trong đầu ra; ca nào quên khai dấu hiệu thì script tự ném.

### ❌ CHƯA — không được nói "restore VERIFIED"

| Thứ | Vì sao chưa |
|---|---|
| Phục hồi từ **bản sao production thật** | Chưa có bản sao nào. `sao-luu.mjs` chưa từng chạy |
| Dựng lại từ **`schema.sql` thật** | File chưa tồn tại. Tự kiểm dùng **schema giả** 31 bảng, giữ đúng hình khoá ngoại của các bảng chính, KHÔNG phải schema thật (RLS, policy, trigger, RPC, view, extension đều không có) |
| Phục hồi trên **Postgres 17** | Local là 16.13, production là **17.6**. `schema.sql` sinh từ 17 có thể dùng cú pháp 16 không hiểu — chỉ biết được khi chạy thật |
| **Storage** (file ảnh) | Không nằm trong bản sao. `media`/`listing_media` chỉ là đường dẫn; phục hồi metadata xong mà bucket trống thì web vẫn vỡ ảnh |
| `auth.users`, `vault.secrets`, `cron.job`, edge function | Cố ý không sao lưu, ghi rõ trong manifest. Phục hồi DB xong **bot vẫn chưa chạy được** cho tới khi deploy lại function và nạp lại secret |

---

## 12.6 Sổ diễn tập — chỉ ghi khi bước 2 thoát 0

| Ngày | Bản sao | Đích | Kết quả | Ghi chú |
|---|---|---|---|---|
| 06/09/2026 | — | PG 16.13 local | **tự kiểm 10/10** | Chỉ chứng minh BỘ SOÁT đúng. Không phải phục hồi production |
| _(trống)_ | | | | Chưa có lượt phục hồi bản sao thật nào |
