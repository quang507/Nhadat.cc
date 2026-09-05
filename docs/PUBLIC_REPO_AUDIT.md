# Soát repo PUBLIC — file đang track & toàn bộ lịch sử git

**Ngày soát:** 05/09/2026 · **Phạm vi:** 458 file đang track, 1010 blob trong
lịch sử mọi nhánh · **Không đọc** `admin logins/`, `sổ đỏ samples/`,
`masterDB/`, `ThemeForest/` (ranh giới CLAUDE.md §5).

**Tiền đề đã kiểm lại, không tin ghi chú cũ:** GitHub API 05/09 trả
`"private": false`, `"visibility": "public"`, **0 fork · 0 star · 0 watcher**,
repo tạo 21/08/2026. Không fork nghĩa là xác suất có bản sao ngoài tầm với là
thấp — nhưng "thấp" không phải "không", và số đó không giảm đi khi đóng repo.

---

## 0. Kết luận một dòng

**Không có credential nào từng lọt vào repo. Không cần xoay khoá nào.**
Việc phải làm là chuyện khác: một SĐT khách thật trong tài liệu gốc, và một
đống nội dung của bên thứ ba đang nằm công khai dưới tên mình.

---

## 1. Credential — SẠCH, không phải xoay khoá

Quét **cả 1010 blob** trong lịch sử (mọi nhánh, kể cả commit đã bị bỏ), tìm:
JWT `eyJ…`, `sb_secret_…`, `sk-ant-…`, `ghp_…`, `glpat-…`, `AKIA…`, `xox[bapr]-`.

| Mẫu tìm | Kết quả |
|---|---|
| JWT / service_role Supabase | **0** |
| Khoá bí mật Supabase mới (`sb_secret_`) | **0** |
| Khoá Anthropic (`sk-ant-`) | **0** |
| Token GitHub / GitLab / AWS / Slack | **0** |
| File `.env` thật | **0** — chỉ có `.env.example` với giá trị RỖNG |

Hai file `.env.example` (`bot/bridge-zca/`, `scripts/`) đã kiểm từng phiên bản
trong lịch sử: dòng `BRIDGE_SECRET=` và `SUPABASE_SERVICE_ROLE_KEY=` đều không
có gì sau dấu `=`.

**Khoá publishable (`sb_publishable_…`) có trong 9 file** — `lib/supabase.ts`,
`bot/bridge-zca/index.mjs`, `bot/tests/ts-sec-anon.mjs`, 6 migration. Đây là
khoá **công khai theo thiết kế**, nằm sẵn trong bundle JS của web; nó chỉ có
quyền vai `anon` và toàn bộ hàng rào là RLS (đã soát riêng — xem
`bot/tests/vai-tro.sql`). Không phải rò rỉ, không cần xoay.

**Bốn thư mục cấm chưa bao giờ bị track** — 0 file hiện tại, **0 commit trong
toàn bộ lịch sử**. `.gitignore` che đúng từ đầu.

---

## 2. PII — một chỗ thật, hai chỗ báo giả

### 2.1 PHẢI xử lý: `chats w B.docx`
Trong **văn bản người đọc được** (không phải metadata) có **một SĐT khách
thật**, đầu số `0903xxxxxx`. Đây là bản ghi hội thoại với người mua thật, đang
nằm công khai.

### 2.2 Hai thứ trông giống PII nhưng KHÔNG phải — ghi lại để lần sau khỏi soát lại

- **`bot/tests/e2e/run.mjs` → `0703xxxxxx`.** Fixture cố ý: dãy số tuần tự, dùng
  để kiểm chính bộ lọc SĐT (FR-104) có che được số trong mô tả tin hay không.
  Bỏ nó đi là bỏ luôn ca kiểm.
- **`.docx`/`.xlsx` báo "8–10 SĐT" ở lượt quét đầu — SAI HẾT.** Grep thô trên
  file `.docx` đọc trúng ID metadata của Word (`rsid`, `paraId`). Bóc thẻ XML
  rồi mới quét thì `biz model.docx`, `S's side.docx`,
  `nhadat.cc website.docx`, `demo2Vitalify.docx`,
  `AOND req + chat examples.docx`, `dự kiến vốn 6 tháng đầu.xlsx` đều **0 SĐT**.
  Ba file PDF (giải nén stream FlateDecode rồi quét): **0 SĐT**.

### 2.3 SĐT bên thứ ba
`0318xxxxxx` (tổng đài radanhadat.vn) xuất hiện trong ~20 file `radanhadat-scrape/pages/*.md`. Đó là số
tổng đài công bố công khai của radanhadat.vn, không phải khách của mình. Rủi ro
riêng tư thấp; nó thuộc mục bản quyền bên dưới.

### 2.4 Zalo ID · URL nội bộ
Không có Zalo ID nào trong file text. Chuỗi số dài trong `hình samples/*.jpg` là
mã ảnh Facebook nằm trong TÊN FILE. URL nội bộ chỉ có `localhost:3000` và
`127.0.0.1:3000` — không có ngrok, không có endpoint riêng nào.

---

## 3. Nội dung bên thứ ba — vấn đề lớn hơn PII

`ThemeForest/` bị `.gitignore` chặn vì bản quyền. Nhưng **ba thư mục cùng loại
lại đang được track**:

| Thư mục | File | Dung lượng | Là gì |
|---|---|---|---|
| `Vedoo pages/` | 4 | 3,8 MB | Ảnh chụp trang demo của theme thương mại (`dtthemes.kinsta.cloud`) — **đúng cùng loại với `ThemeForest/`** |
| `radanhadat-scrape/` | 203 | 8,0 MB | Bản sao nguyên trang của một đối thủ (radanhadat.vn, mogi.vn), gồm cả JSON/CSV dự án |
| `hình samples/` | 21 | 2,3 MB | Ảnh lấy từ Facebook (tên file là mã ảnh FB) |

Đây không phải rủi ro bảo mật — là rủi ro **pháp lý và hình ảnh**: repo công
khai mang tên mình đang chứa 14 MB nội dung của người khác, trong đó có bản sao
site đối thủ.

---

## 4. Tài liệu kinh doanh nội bộ đang đọc được công khai

| File | Dung lượng | Nội dung |
|---|---|---|
| `OKRs eo2024.pptx` | 13 MB | OKR, định vị chiến lược |
| `dự kiến vốn 6 tháng đầu.xlsx` | — | Ngân sách, ràng buộc nguồn lực |
| `biz model.docx` / `.pdf` | — | Mô hình doanh thu, mức phí |
| `chats w B.docx` | — | Hội thoại người mua thật (**có PII, mục 2.1**) |
| `S's side.docx` | — | Luồng người bán |
| `Tài liệu hệ thống nhadat.cc.pdf` | 1,1 MB | Kiến trúc hệ thống — **có bản trùng ở `SS/`** |
| `nhadat.cc website.docx`, `demo2Vitalify.docx`, `AOND req + chat examples.docx` | — | Đặc tả sản phẩm |

Không cái nào chứa credential. Rủi ro là **thương mại**: đối thủ đọc được cả
mức phí, ngân sách và lộ trình.

---

## 5. Đề xuất theo đúng năm nhóm được hỏi

### (1) Phải BỎ khỏi repo
- `chats w B.docx` — chứa SĐT khách thật. Đây là mục duy nhất bắt buộc.

### (2) Có thể để PUBLIC, không cần đụng
- Toàn bộ `app/`, `components/`, `lib/`, `bot/`, `scripts/`, `docs/`, `design/`,
  `.github/` — mã nguồn, tài liệu BA, test. Đã quét sạch.
- Khoá publishable trong 9 file — công khai theo thiết kế.
- `bot/tests/e2e/run.mjs` với số fixture — giữ nguyên.

### (3) Nên chuyển sang repo PRIVATE
- Tám tài liệu ở mục 4 (kể cả `SS/` trùng lặp). Chúng là **input thô**, không
  phải mã nguồn; `docs/` đã chưng cất hết nội dung cần thiết và có trích nguồn.
  Chuyển chúng sang một repo `nhadat-cc-nguon` private là mất zero chức năng.

### (4) Cần REDACT / gỡ
- `Vedoo pages/`, `radanhadat-scrape/`, `hình samples/` → thêm vào `.gitignore`
  cùng chỗ với `ThemeForest/`. Muốn giữ để tham chiếu thì để ngoài repo.
- `chats w B.docx`: nếu muốn giữ bản đã ẩn danh thì thay `0903…` bằng
  `0903xxxxxx` theo đúng quy ước CLAUDE.md §5 — nhưng **bản gốc vẫn nằm trong
  lịch sử git**, xem mục 6.

### (5) Secret từng xuất hiện trong lịch sử
**KHÔNG CÓ.** Không cần xoay khoá nào. Nói rõ vì đây là câu hỏi tốn tiền nhất:
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `BRIDGE_SECRET`,
`ZALO_OA_ACCESS_TOKEN` — **không cái nào từng nằm trong một blob nào của repo
này**. Chúng chỉ sống trong Vault và biến môi trường.

---

## 6. Điều quan trọng nhất về cách xử lý

**Xoá file ở commit mới KHÔNG gỡ nó khỏi lịch sử.** `chats w B.docx` đã nằm
trong lịch sử từ những commit đầu; một commit xoá chỉ làm nó biến mất khỏi cây
hiện tại, còn `git log -p` vẫn lôi ra được. Muốn gỡ thật phải viết lại lịch sử
(`git filter-repo`) rồi force-push — việc đó làm hỏng mọi bản clone đang có và
phải do chủ dự án quyết định, không phải việc tự làm.

**Và đóng repo cũng không thu hồi được bản đã clone.** Điểm nhẹ nhõm duy nhất:
GitHub báo **0 fork, 0 star, 0 watcher** tính tới 05/09 — nên khả năng có bản
sao ngoài tầm với là thấp.

Thứ tự đề nghị, rẻ đến đắt:
1. Đổi repo sang **private** (một thao tác, chặn ngay mọi truy cập mới).
2. Chuyển 8 tài liệu gốc sang repo private riêng, gỡ khỏi repo này.
3. Thêm ba thư mục bên thứ ba vào `.gitignore`.
4. Chỉ khi vẫn muốn repo public thì mới tính tới `filter-repo` — và lúc đó phải
   làm cho cả `chats w B.docx` lẫn tám tài liệu kia, không nửa vời.
