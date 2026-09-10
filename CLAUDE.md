# CLAUDE.md — Harness dự án nhadat.cc

Tài liệu điều hướng cho mọi phiên làm việc trên repo này. Đọc file này trước khi
chạm vào bất kỳ file nào khác.

## 1. Dự án là gì

**nhadat.cc** — dịch vụ môi giới bất động sản "chat-first" tại TP.HCM, khởi điểm
là thị trường **Quận 5**. Luận điểm cốt lõi: *listing chỉ là mồi, giao dịch xảy
ra trong cuộc trò chuyện, và cuộc trò chuyện không bao giờ kết thúc.*

- **Người mua (B)** không trả phí, không phải để lại số điện thoại, tương tác qua
  **Zalo OA** với trợ lý AI trực 24/7.
- **Người bán (S)** — gồm **CCRB** (chính chủ rao bán) và **NMG** (nhà môi giới) —
  rao tin bằng một câu rao thông thường, AI bóc tách trường và viết lại.
- **Website nhadat.cc** là kênh SEO + listing + phễu đẩy người dùng sang Zalo OA.
- Doanh thu 100% từ phía bán: CCRB 1%, NMG 0.5% giá trị giao dịch.

Chi tiết đầy đủ: `docs/`.

## 2. Bộ tài liệu BA (nguồn sự thật)

Thứ tự đọc = thứ tự phụ thuộc. Tài liệu sau **không được mâu thuẫn** tài liệu trước.

| # | File | Nội dung | ID prefix |
|---|---|---|---|
| 0 | `docs/00-dinh-huong.md` | **Định hướng** — BRD hợp nhất Aioinhadat × nhadat.cc: thương hiệu Aioinhadat (viết AI Ơi Nhà Đất), trợ lý mỗi khách một tên •ai (FR-181); mặt bán theo SRD AOND, mặt mua + web theo nhadat.cc, câu khách hỏi đi về CTV (FR-173); bất biến, sao Bắc Đẩu, lộ trình, quyết định treo. Đứng trên mọi tầng dưới | `DH-` |
| 0 | `docs/00-glossary.md` | Từ điển thuật ngữ (B, S, CCRB, NMG, CTV, HXH…) | — |
| 1 | `docs/01-research.md` | Nghiên cứu thị trường, người dùng, đối thủ, insight | `INS-` |
| 2 | `docs/02-requirements.md` | Mục tiêu KD, persona, yêu cầu chức năng / phi chức năng | `BR- FR- NFR-` |
| 3 | `docs/03-user-flows.md` | Luồng người dùng end-to-end | `UF-` |
| 4 | `docs/04-information-architecture.md` | Sitemap, URL/SEO, content model, taxonomy | `IA-` |
| 5 | `docs/05-wireframes.md` | Wireframe low-fi từng màn hình | `WF-` |
| 6 | `docs/06-ui-design.md` | Design system, token, component, tone giọng | `UI-` |
| 7 | `docs/07-srs.md` | Đặc tả phần mềm: kiến trúc, data model, API, acceptance | `SRS-` |
| 8 | `docs/08-traceability.md` | Ma trận truy vết BR → FR → UF → WF → SRS | — |
| 9 | `docs/09-open-issues.md` | Mâu thuẫn / quyết định còn treo, cần chủ dự án chốt | `OPEN-` |
| 10 | `docs/10-ke-hoach-kiem-thu.md` | Kế hoạch kiểm thử 4 tầng: chức năng, kỹ thuật, UI/UX, phi chức năng | `TS-` |
| 11 | `docs/11-quy-trinh.md` | Quy trình BA và tester: hai vòng làm việc, ba cổng, máy kiểm gì / người kiểm gì, định nghĩa XONG. Không sinh ID mới | — |

## 3. Tài liệu gốc & Phân định phạm vi

**Tài liệu gốc 2024 KHÔNG còn trong repo** (xoá ở commit `459008d` ngày 08/09/2026 cùng `design/`, `SS/`, `hình samples/`, dữ liệu crawl; chủ dự án 10/09: "tài liệu nào bị cũ thì xoá đi"). Chúng là tư liệu lịch sử nhadat.cc 2024, đã ngưng kế thừa (OPEN-48). Muốn xem lại thì `git show 459008d^:"<tên file>"`. Các trích dẫn `[nguồn: biz model.docx §…]` trong `docs/` giữ nguyên làm dấu vết lịch sử — không phải lời mời đi tìm file.
**Nguồn sự thật chuẩn duy nhất hiện nay của hệ thống là:**
1. Bộ tài liệu `docs/` đã được chuẩn hóa theo **Aioinhadat 2026**.
2. Kịch bản Gemini mới của Sếp: `Kịch bản huấn luyện môi giới (Gemini 07-09-2026).md`.
   Chat Gemini gốc của dự án (21–27/06/2026, share `EEX3PutTDZDt`), chưng cất ở
   `Kịch bản AI Ơi Nhà Đất (Gemini 21-06-2026, share).md` — chủ dự án đối chiếu với
   hệ thống ngày 09/09/2026 và chốt 14 dòng ở `docs/09` OPEN-55 → FR-181…186.
3. SRD Aioinhadat `AOND req + chat examples.docx` — đã chưng cất hết vào `06 §6.8`, `09` OPEN-20/21; file gốc cũng đã xoá.

Bản đồ "file gốc (đã xoá) → chưng cất ở đâu", để đọc `[nguồn: …]` trong docs mà không phải mở file:

| File gốc | Được chưng cất vào |
|---|---|
| `Tài liệu hệ thống nhadat.cc.pdf`, `SS/` | `07-srs.md` (kiến trúc, tech stack) |
| `nhadat.cc website.docx` | `02`, `04`, `05`, `06` (website & SEO) |
| `biz model.docx` / `.pdf` | `01`, `02` (mô hình KD, OKRs, phí) |
| `S's side.docx` | `02`, `03` (luồng người bán, API S↔B) |
| `chats w B.docx` | `03`, `06` (kịch bản chat, tone giọng), `07` (backend B Side) |
| `demo2Vitalify.docx` | `01` (concept gốc bằng tiếng Anh) |
| `OKRs eo2024.pptx` | `01` (định vị: *permanent agent of agents*) |
| `dự kiến vốn 6 tháng đầu.xlsx` | `01` (ngân sách, ràng buộc nguồn lực) |
| `AOND req + chat examples.docx` | `06` §6.8 (kịch bản người bán), `09` OPEN-20/21 (gamification, vai người rao) |
| `hình samples/` | `05`, `06` (ảnh listing mẫu) |
| `Kịch bản huấn luyện môi giới (Gemini 07-09-2026).md` | `02` FR-177 (hỏi người bán 1 thông tin/lần + khích lệ, bản nháp tin, điểm 7 tiêu chí), `09` OPEN-49 |
| `Kịch bản AI Ơi Nhà Đất (Gemini 21-06-2026, share).md` | `09` OPEN-55 (14 dòng chốt 09/09), `02` FR-181 (tên trợ lý theo khách), FR-183 (điểm người rao), FR-184 (bán rồi), FR-185 (ảnh vào kho), FR-186 (câu hỏi theo loại; tối 09/09 thêm 4 loại toà nhà/đất nông nghiệp/đất SKC/kho xưởng + nhóm hỏi bù `sau_dang`), FR-187 (JSON chia nhóm từng tin), FR-173 a (chủ nhà trước 12 giờ), FR-114 d (kiến thức dự án), FR-177 h (giá thị trường khu vực) |

## 4. Quy ước làm việc

1. **Mọi câu khẳng định trong `docs/` phải truy được về nguồn.** Dùng cú pháp
   `[nguồn: biz model.docx §Doanh thu]`. Không có nguồn → ghi
   `[giả định BA]` hoặc đưa vào `09-open-issues.md`.
2. **Không tự ý chốt điều còn mơ hồ.** Mâu thuẫn giữa hai tài liệu gốc → tạo
   `OPEN-xx`, nêu hai phương án và khuyến nghị, chờ chủ dự án.
3. **ID là bất biến.** Không đánh số lại `FR-`, `UF-`… khi chèn mục mới — cấp ID
   kế tiếp và đánh dấu mục cũ `[deprecated]`.
4. **Sửa tài liệu tầng trên → phải cập nhật `08-traceability.md` cùng commit.**
5. Ngôn ngữ tài liệu: **tiếng Việt**, giữ nguyên thuật ngữ kỹ thuật tiếng Anh
   (listing, webhook, fingerprint…). Tên biến/bảng/API: **tiếng Anh, snake_case**.
6. Sơ đồ: **Mermaid** (render được trên GitHub). Wireframe: ASCII box.

## 5. Ranh giới bảo mật — TUYỆT ĐỐI

Các thư mục sau từng nằm cạnh repo (nay không còn trên máy chủ dự án — soát 10/09/2026), vẫn giữ trong `.gitignore` và **không bao giờ** được
đọc-rồi-chép nội dung vào `docs/`, commit message, hay PR nếu ai đó chép lại:

- `admin logins/` — credential.
- `sổ đỏ samples/` — sổ đỏ, CCCD, địa chỉ thật của người dân.
- `masterDB/` — dữ liệu nhà + ảnh thật (~179MB).
- `ThemeForest/` — theme thương mại có bản quyền (~274MB).

Số điện thoại, Zalo ID, tên thật xuất hiện trong tài liệu gốc phải được **ẩn
danh** khi trích vào `docs/` (`0903xxxxxx`, `chị D.`).

## 6. Mã nguồn app

Từ 24/08/2026 (quyết định chủ dự án) code nằm **trong repo này**, hai mảnh:

- **Web** (Next.js 15 + TS + Tailwind 4, App Router) ở **root repo**:
  `app/`, `components/`, `lib/`, `public/` — Vercel project `nhadat-cc` build
  từ root, package manager **Bun** (`bun.lock`). Dữ liệu đọc Supabase bằng
  publishable key qua RLS; mô tả listing luôn qua `sanitizeDescription()`
  (lọc SĐT — FR-104) trước khi render.
- **Bot** ở `bot/` — Supabase Edge Functions (xem `bot/README.md`).
- **Script vận hành** ở `scripts/` — chạy trên máy local, không deploy.
  `up-anh.mjs` đẩy ảnh thật lên bucket `listing-public` theo UUID của tin và
  ghi kèm dòng `listing_media` (FR-165; lối cũ theo mã tin của FR-148 đã bỏ);
  nó chỉ ĐỌC `masterDB/`, không bao giờ copy ảnh vào repo. **Đã chạy thật
  07/09/2026**: `listing_media` 1005 dòng, `listing_photos_v` 945, **171/173 tin
  có ảnh** (`BDS-Q5-0113` và `BDS-Q5-0124` trống vì thư mục nguồn rỗng, không
  phải lỗi script). Trước hôm đó `storage.objects` = 0 và web hiện ảnh giữ chỗ
  cho MỌI tin — nếu thấy lại cảnh đó thì kiểm `listing_media` trước tiên.
  Lần chạy đầu để lộ một bẫy đáng nhớ: `sort_order` là `int4`, hai ảnh mang tên
  là dấu thời gian 14 chữ số làm tràn kiểu, insert nổ **sau khi** file đã lên
  kho nên nhánh dọn dẹp xoá mất file vừa up, để lại một dòng lỗi trôi giữa 1005
  dòng thành công. Vá ở CẢ HAI tầng (`20260907a`: `CHECK sort_order 0..9999`;
  script: chỉ nhận số ≤4 chữ số) — vì `1700000000` vừa khít `int4` nên kiểu dữ
  liệu một mình không bắt được.
  `sao-luu.mjs` kéo cả **31 bảng** về JSON, ghi `manifest.json` (bảng · số dòng
  · file · trạng thái) và gọi `xuat_schema()` ghi
  `bot/supabase/schema.sql` — **bậc Supabase Free không có backup tự động**,
  đây là bản sao duy nhất đang tồn tại (OPEN-25). **Bản sao ĐẦU TIÊN đã có
  07/09/2026**: 31/31 bảng, `trang_thai: "day_du"`, nằm trên OneDrive công ty ở
  thư mục hạn chế quyền — trước hôm đó script chưa từng chạy lần nào. Cần
  `SUPABASE_SERVICE_ROLE_KEY` (đặt trong `scripts/.env`, đã gitignore); khoá đó
  bỏ qua mọi RLS nên tuyệt đối không ghi vào file được track, và thư mục đích
  mặc định nằm NGOÀI repo vì bản sao chứa SĐT thật.
  **Sao lưu phải chạy SAU khi dữ liệu đổi, không phải trước.** Bản 07/09 chạy
  lúc 09:29, `up-anh.mjs` chạy sau — nên `listing_media.json` trong đó chỉ 1 KB
  trong khi bảng thật có 1005 dòng: file ảnh còn nguyên trong Storage mà không
  gì nói tấm nào của tin nào, đúng kịch bản OPEN-47. Đổi dữ liệu lớn thì sao lưu
  lại, và đọc `manifest.json` xác nhận SỐ DÒNG chứ đừng nhìn thư mục thấy đủ file.
  `soat-migration.mjs` so DB ↔ repo. `phuc-hoi.mjs` + `soat-phuc-hoi.mjs` nạp
  bản sao vào một DB RỖNG rồi chấm đạt/không (quy trình ở `docs/12`).
  `xuat-ro-hang.mjs` xuất rổ hàng ra thứ NGƯỜI đọc được — mỗi tin một thư mục
  (`tin.md` + `anh/`) kèm `ro-hang.csv` mở thẳng Excel; nó **không phải bản sao
  lưu** (chỉ 3/31 bảng, không giữ UUID/khoá ngoại) và `manifest.json` của nó ghi
  thẳng chữ `KHONG_PHAI_BAN_SAO_LUU`.

**Migration ghi THAY ĐỔI, `schema.sql` mới dựng lại được** (soát lại 07/09/2026).
Câu cũ ở đây nói "migration là nguồn sự thật của schema" — sai. Số đo 07/09: DB
đã áp **114** migration, `main` có **72** file, tức **41 migration áp thẳng qua
MCP mà không ai lưu file** — gần hết là khối 21/08 → 27/08 dựng schema lõi (30
bảng, RLS, projects, conversations, reminders, CTV, drip). Nội dung chúng mất
vĩnh viễn (OPEN-46). Không ai thấy suốt hai tuần vì không có gì đối chiếu hai
bên. Nay: thay đổi schema vẫn BẮT BUỘC đi qua một file trong
`bot/supabase/migrations/`, `soat-migration.mjs` chặn trôi thêm, và
`bot/supabase/schema.sql` là lưới an toàn để dựng lại từ số không (quy trình
đầy đủ ở `bot/README.md §Phục hồi từ số không`).

**Vết đó suýt lặp lại 07/09.** `20260907a_sort_order_la_so_thu_tu` áp lên
production xong, file thì nằm trên một nhánh đã đẩy lên remote **mà không ai mở
PR** — đúng hình lỗi đẻ ra OPEN-46, chỉ khác là bắt được sau vài giờ chứ không
phải hai tuần (nay là PR #35). **Áp migration xong mà chưa mở PR cho file của nó
thì việc chưa xong.** Đẩy nhánh lên không phải là đưa file về repo.

**Danh sách bảng trong `sao-luu.mjs` phải đủ.** Nó liệt kê tay là cố ý (đọc là
thấy), nhưng suốt 27/08 → 05/09 nó thiếu 8 bảng — trong đó `listing_media`, bản
đồ ảnh ↔ tin (FR-165): mất nó thì file trong Storage còn nguyên mà không ai
biết ảnh của tin nào (OPEN-47). Nay `liet_ke_bang()` bắt script hỏi DB mỗi lần
chạy, thiếu bảng là DỪNG. Thêm bảng mới thì thêm vào mảng `BANG`.

Vết đó lặp lại ngay hôm sau: `chat_quota` (migration `20260905d`) sinh ra mà
không ai thêm vào `BANG`. `liet_ke_bang()` có bắt — nhưng chỉ bắt lúc CHẠY sao
lưu, tức đêm hôm trên máy chủ, trước mặt không ai. Nay `soat-truy-vet.sh` so
`create table` trong migration với `BANG` và kêu **ở PR**.

**Sao lưu phải phân biệt "đủ" với "trông như đủ".** Ba luật, tất cả có ca kiểm
trong `scripts/sao-luu.tu-kiem.mjs` (PostgREST giả, không chạm DB thật):
`Prefer: count=exact` để đối chiếu số dòng kéo về với số DB tự báo — lệch là
hỏng, vì một file JSON ngắn không kêu ca gì; `manifest.json` ghi ra ĐĨA với
`trang_thai` (`day_du`/`thieu`/`hong`) — thư mục thiếu ba bảng trông y hệt thư
mục đủ nếu không có gì nói ra; và mọi đường hỏng đều thoát khác 0. Thứ KHÔNG
nằm trong bản sao (`storage.objects`, `auth.users`, `vault.secrets`) được liệt
kê tường minh trong manifest — "không thấy" và "cố ý bỏ" nhìn giống hệt nhau
lúc đang chữa cháy.

**`bun run build` có thể im lặng bỏ sót lớp Tailwind MỚI** (bắt 07/09/2026 lúc
dựng lại `/admin`). Lượt build đầu sau khi sửa giao diện sinh ra CSS **thiếu
`mt-16`, `gap-x-2.5`, `pb-24`, `max-w-[70ch]`** — đúng những lớp vừa đặt lần đầu
trong dự án; các lớp đã dùng ở chỗ khác (`mt-12`, `mt-8`, `gap-x-3`) thì có đủ.
Không lỗi, không cảnh báo: `tsc` sạch, build xanh, trang lên — chỉ là các khối
dính vào nhau vì margin không tồn tại. `rm -rf .next/cache && bun run build` là
hết. **Vercel có khôi phục `.next/cache` giữa các lần build, nên vết này ra được
tới production.** Sửa giao diện mà thấy khoảng cách sai so với mã nguồn thì
việc đầu tiên là soi CSS đã build (`grep -o 'mt-16' .next/static/css/*.css`),
đừng sửa lại mã theo cái mình thấy — cách đó dẫn tới việc bịa số cho vừa một
bản dựng hỏng. Đây cũng là lý do phải CHỤP MÀN HÌNH bản dựng thật khi đổi bố
cục: đọc mã nguồn không bao giờ thấy được lớp bị rụng.

**Trang tin phải nằm trong cache** (NFR-17). Route động có tham số đường dẫn mà
thiếu `generateStaticParams()` thì `export const revalidate` là chữ chết —
Next 15 để `prerender-manifest.dynamicRoutes` rỗng và mỗi lượt xem là một lambda
+ đủ số query. Kiểm bằng bảng route sau `bun run build`: trang tin phải là `●`
hoặc `○`, thấy `ƒ` là hỏng. Route đọc `searchParams` thì không ISR được, phải
bọc truy vấn trong `unstable_cache`.

**Đường đi ĐÚNG THIẾT KẾ không được ghi vào sổ lỗi** (bắt 08/09/2026). Sổ lỗi
`bot_errors` là ĐẦU VÀO của còi: `bot_health_tick` mỗi giờ đếm lỗi trong một giờ
qua, có lỗi thì đẻ một tin 🩺 gửi Zalo admin. `escalation-feed` có một nhánh từ
chối học `zalo_user_id` của admin (bản vá SEC-03, hoàn toàn đúng) — nhưng nhánh
đó lại `log_loi`. Bridge gửi tin 🩺 xong gọi `ack`, rơi đúng nhánh ấy, ghi thêm
một dòng lỗi, giờ sau còi lại đếm được. **Vòng tự nuôi**: sổ lỗi 07/09 có đúng
một dòng `escalation-feed admin uid` mỗi giờ có tin 🩺 được gửi, liên tục 05:00
→ 10:00 UTC, và tin nào cũng chỉ nói "1 lỗi trong 1 giờ qua" mà không nói lỗi
gì. Nay nhánh đó `console.log`. Thêm bất kỳ `log_loi` nào thì hỏi: đây là SỰ CỐ
hay là đường đi bình thường?

**Bot hỏi thứ chính luật cấm hỏi** (cùng ngày). `20260907h` xếp nhóm `phu`
(hướng, quy hoạch, năm xây) priority ≥ 20 với ý "không bao giờ tới lượt" — nhưng
khi các nhóm trên trả lời hết thì `phu` LÀ nhóm còn lại, `chonCauKe()` bốc ngay.
Log 07/09 đúng vậy. Ngưỡng ưu tiên không phải là cấm; muốn cấm thì phải LỌC.
Nay `listing_missing_facts` bỏ hẳn `nhom = 'phu'`, và mock e2e bỏ theo — mock
lệch bản thật ở chỗ nào thì bộ e2e đo sai ở chỗ đó.

**`schema.sql` tụt lại sau migration mà không ai biết** (cùng ngày). Nó do
`xuat_schema()` sinh ra khi CHẠY `scripts/sao-luu.mjs`; áp migration qua MCP rồi
quên chạy sao lưu là nó lặng lẽ cũ đi — `20260907h` merge hôm trước mà
`schema.sql` không hề có `diem_tin`, `can_chu_duyet`. Đúng hình lỗi OPEN-46 nhưng
thiếu NGƯỢC (repo thiếu so với DB), nên `soat-migration.mjs` không thấy. Nay
`soat-truy-vet.sh` so tên hàm trong migration với `schema.sql` và kêu ở PR.

**Đừng tin `cron.job_run_details.status`** (NFR-18). `net.http_post()` trả về
ngay khi xếp hàng nên cron luôn báo `succeeded`, kể cả lúc edge function trả
500. Kết quả thật nằm ở `net._http_response`, và được `bot_health_tick()` quét
sang `bot_errors` (FR-152). Xem sức khoẻ ở trang `/admin`.

**Luật đó áp cho CẢ CÁI CÒI, không chỉ cho cron** (soát 06/09/2026). Chính
`bot_health_tick` đã tái phạm: nó gọi `canh_bao_ngoai()` — hàm này cũng chỉ
XẾP HÀNG một `net.http_post` — rồi đóng dấu `bot_health(who='ntfy')` ngay và
dùng con dấu đó để im lặng một giờ. Bắt tại trận: dấu lúc `00:00:00.054` trỏ
request 2221, mà request 2221 là `Timeout of 5000 ms` lúc `00:00:00.212`. 24
lượt timeout như vậy từ 27/08, nhiều lượt đúng phút `:00` — mỗi lượt là một giờ
không ai được báo, và không có gì nói ra điều đó. Nay (`20260906a`) còi ĐỌC LẠI
`net._http_response` của lượt trước rồi mới quyết im, hạn chờ nới 5→15 s, và
lượt hụt tự ghi một dòng `coi ntfy`. **Thêm bất kỳ đường báo động nào thì phải
hỏi: cái gì chứng minh nó tới nơi? "Đã gọi hàm gửi" không phải bằng chứng.**

**SĐT không được vào sổ lỗi.** `sellers.phone` có UNIQUE, nên một lượt chèn
trùng sinh lỗi 23505 mà PostgREST kèm nguyên `Key (phone)=(09…)`; một
`ghiLoi(client, "...", e)` trên đường đó là SĐT khách nằm vĩnh viễn trong
`bot_errors`, trái §5 và repo đang PUBLIC. `log_loi` nay che qua `che_sdt()` —
che ở một chỗ vì mọi đường ghi sổ (edge function, bridge qua escalation-feed,
web qua `instrumentation.ts`) đều chảy qua đó.

**Mọi `catch` mới phải nối dây vào sổ** (FR-152 d). `console.error` một mình là
mất: log edge function bậc Free chỉ giữ 1 ngày, còn loại lỗi nguy nhất ở đây
lại TRẢ 200 nên `bot_health_tick` — vốn chỉ soi mã HTTP — không thấy gì. Trong
edge function dùng `ghiLoi(client, "tên chỗ", e)` của `_shared/claude.ts`;
trong bridge dùng `ghiLoi("tên chỗ", detail)`; phía web thì `instrumentation.ts`
đã bắt sẵn mọi lỗi server chưa bắt. Thêm `catch` mà quên nối là thêm một chỗ
hỏng im lặng.

**Bốn bucket Storage, đừng lẫn** (`masterdb-raw` thêm 07/09, `20260907b`):

| Bucket | Chứa gì | Ai vào được |
|---|---|---|
| `listing-public` | ảnh ĐÃ nén (sharp ≤2500px q80) phục vụ web — 1005 file / 148 MB | **công khai** |
| `listing-private` | sổ đỏ, giấy tờ — link ký sống 15 phút | policy riêng (NFR-06) |
| **`masterdb-raw`** | **bản GỐC masterDB, chưa đụng vào, KHÔNG phục vụ ai** | **chỉ `service_role`** |
| `listing-photos` | lối cũ FR-148 đã bỏ — đã bịt bằng trần 1 byte + mime không tồn tại | (đã khoá) |

**09/09/2026: `masterDB/` KHÔNG còn trên máy chủ dự án** (chủ dự án chốt xoá dữ liệu cũ; thư mục đã không tồn tại ở máy này khi soát), `masterdb-raw` và `listing-public` đều 0 file — `up-anh.mjs`/`up-masterdb.mjs` không còn nguồn để chạy. Rổ hàng từ đây là tin rao THẬT qua chat.
Đường đẩy là **`scripts/up-masterdb.mjs`** (chạy trên máy local, `--dry` xem trước).
Nó **KHÔNG nén** — ai định thêm `sharp` vào đó thì đọc lại: `up-anh.mjs` nén để
phục vụ web, file này giữ nguyên byte để mai kia còn dựng lại được thứ khác từ
bản gốc. Chạy lại được (bỏ qua file đã có đúng kích thước — 179 MB qua mạng nhà
đứt giữa chừng là chuyện thường), và **cuối cùng đối chiếu đếm đĩa ↔ đếm bucket
rồi mới dám báo xong**: Storage trả `200` cho một lượt PUT rồi không cất file
thì vòng lặp vẫn chạy hết và vẫn báo thành công — cùng một hình lỗi với
`net.http_post` ở NFR-18. Bài tự kiểm TS-MASTERDB (24 ca, Storage giả) canh
đúng chỗ đó.

`masterdb-raw` **cố ý không có policy nào** cho `anon` lẫn `authenticated`: RLS trên
`storage.objects` đang bật nên không policy = không ai vào, trừ `service_role`. Đó
là chủ đích, không phải quên — bản gốc mang địa chỉ nhà dân (§5). **Đừng trỏ web
vào bucket này**, nó là tủ hồ sơ chứ không phải CDN. Nó sinh ra để trả lời OPEN-47:
bucket `listing-public` không nằm trong bản sao nào, dựng lại được chỉ vì `masterDB/`
còn trên một ổ đĩa cá nhân. **Nhưng dựng cái tủ không phải là cất đồ vào tủ** — chừng
nào chưa đẩy `masterDB/` lên thì lưới an toàn vẫn y như cũ.

**Dữ liệu hội thoại đã dọn sạch 07/09.** Xoá 286 dòng bã kiểm thử: `messages` 69,
`reminders` 192, `ctv_daily_reports` 15, `conversations` 3 (hai dòng
`channel='zalo_personal_test'`), `buyers` 3 (một dòng `zalo_user_id='e2e-sweep-user'`),
`inbound_ledger`/`inbound_events`/`property_events`. **Giữ nguyên** `listings` 173,
`listing_media` 1005, `projects` 1, `ctvs` 2 (cấu hình FR-173), và **`sellers` 3 —
"Trai/Ngai/Lai" tạo 21/08 đang sở hữu 60 tin, là NMG THẬT chứ không phải test**;
khoá `listings_seller_id_fkey` là `NO ACTION` nên có xoá cũng bị chặn. Mốc sao Bắc
Đẩu nay đếm từ số 0 thật (`docs/10 §10.9`), không còn lẫn lượt thử của nhóm làm.

**Chú thích bảng nằm TRONG DB, không nằm trong docs** (`20260906b`). 31/31 bảng
và 17/17 view đã có `comment on`, cộng 69 chú thích cột; tiền tố `[RỔ HÀNG]`
`[NGƯỜI & HỘI THOẠI]` `[BOT & HÀNG ĐỢI]` `[CTV]` `[HỆ THỐNG]` để Table Editor
xếp A→Z mà mắt vẫn gom được theo việc. Thêm bảng hay cột mới thì **thêm
`comment on` trong cùng migration** — chú thích ở chỗ khác là chú thích sẽ lệch.
Bản in ra giấy (sơ đồ quan hệ + đường bóc tách) ở `docs/07-srs.md §SRS-3.0`;
đừng mở `docs/architecture/` song song với `07-srs.md`, hai nguồn sự thật là
đúng cái bẫy đã đẻ ra OPEN-46. Mở rổ hàng bằng mắt người thì dùng view
`ro_hang_ban` chứ đừng mở `listings` 56 cột — hoặc chọn schema **`so`** trong
Table Editor (`20260907c`): ba view `so.ro_hang` (9 cột đầu đúng thứ tự
sheet Excel gốc Q5 trong `masterDB/`), `so.nguoi_ban` và `so.hoi_thoai` (log chat đọc
được, `20260907g` — muốn xem lại bot nói gì với khách thì mở đây, đừng mở `messages`
trần), không lẫn ruột bot, PostgREST không phơi, `anon`/`authenticated` bị revoke; `xuat_schema()` không quét `so` nên
dựng lại phải chạy thêm file migration đó. **View MỚI ở project này mặc định
LỘ**: `alter default privileges` cấp sẵn toàn quyền cho `anon` và
`authenticated`, nên `grant select` không siết được gì — phải `revoke all …
from anon, authenticated` TRƯỚC rồi mới grant.

**Bóc tách và AI là hai tầng, có máy canh** (`bot/tests/ranh-gioi.mjs`, trong
`bun run test:bot`). Mã bóc tách tiền định không được import SDK Anthropic hay
`claude.ts` hay gọi RPC — nó phải chạy và kiểm được mà không tốn một đồng. Tầng
AI không được ghi bảng nghiệp vụ; ba RPC ngoại lệ đã khai tên trong file luật
(`get_secret`, `log_loi`, `cong_token`), muốn thêm thì phải sửa file đó, tức
phải có người đọc lại câu "cái này có phải dữ liệu nghiệp vụ không?". Hôm nay
ranh giới đúng nhưng đúng do may: `regexProfileFallback()` vẫn nằm trong
`chat-reply/index.ts` cạnh chỗ gọi model, và nhánh NGƯỜI MUA đang chạy ngược —
model trước, regex chỉ đỡ khi model chết.

**Repo hiện đang PUBLIC** (kiểm 26/08/2026 qua API GitHub: `"private": false`).
Nghĩa là mọi file đang track đều đọc được công khai, kể cả tài liệu gốc ở thư
mục gốc: `biz model.docx`, `dự kiến vốn 6 tháng đầu.xlsx`, `chats w B.docx`,
`S's side.docx`, `Tài liệu hệ thống nhadat.cc.pdf`, `hình samples/`. Muốn đóng
thì đổi visibility ở GitHub Settings — nhưng đóng KHÔNG xoá được lịch sử người
khác đã clone.

Dù public hay private, **đừng để web trỏ tới
`raw.githubusercontent.com/quang507/Nhadat.cc/...`**: nó buộc ảnh của web phụ
thuộc vào một thiết lập GitHub chẳng liên quan gì, set private một cái là raw
trả 404 và ảnh vỡ sạch. Tài nguyên tĩnh để trong `public/` rồi tham chiếu bằng
đường dẫn tương đối (`/img/house1.jpg`).

Thư mục `nhadat-cc/` cũ (máy local) không dùng nữa. Quy tắc giữ nguyên: tính
năng mới phải có FR/SRS tương ứng trong `docs/` trước khi code.

## 6b. Nguồn thiết kế

`design/` (token, 13 artboard, canvas) và việc Figma đã **xoá** 08/09/2026 (commit `459008d`); OPEN-45 đóng 10/09. Nguồn thiết kế còn lại là `docs/06-ui-design.md` (tone giọng, component) và chính code (`app/globals.css` là token thật). Không dựng lại Figma trừ khi chủ dự án yêu cầu.

## 7. Cách chạy pipeline BA

Quy trình đầy đủ (BA + tester + ba cổng + định nghĩa XONG): `docs/11-quy-trinh.md`.
Bản rút gọn nạp tự động cho agent: `.claude/skills/ba-pipeline/SKILL.md`.

**Cổng kiểm — chạy trước mọi commit:**

```bash
bun run kiem   # = kieu (tsc) + build + test:bot (253 e2e + FR-159/161/164/176/177 + tự kiểm TS-SEC) + truyvet
bun run test:sec   # TS-SEC thật trên DB thật — cần Internet, nên KHÔNG nằm trong `kiem`
```

Bốn job đó chạy trong CI (`.github/workflows/kiem.yml`) mỗi PR, kể cả `test:sec`.
**Thoát 2 của `test:sec` nghĩa là "chưa kiểm được", không phải "đạt"** — bản đầu
của nó coi mọi HTTP ≥400 là bị chặn và báo 24/24 xanh trong lúc proxy chặn sạch,
chưa request nào tới Supabase. Bài tự kiểm offline
(`bot/tests/ts-sec-anon.tu-kiem.mjs`) dựng PostgREST giả để chứng minh nó không
tái phạm; sửa bộ probe thì phải chạy lại bài đó. Người và
máy dùng chung script trong `package.json` — đừng gõ lệnh rời, không thì "máy
xanh, máy tao đỏ" và không ai biết bên nào đúng. `scripts/soat-truy-vet.sh` bắt
ID gãy, FR thiếu dòng truy vết, số đếm README lệch, SĐT thật lọt vào `docs/`,
khoá service_role bị ghi vào file, và web trỏ `raw.githubusercontent.com`.

**Skill PM mượn ngoài** (`phuryn/pm-skills`, MIT — kiểm license 03/09/2026;
marketplace đã khai ở `.claude/settings.json` không ghim commit, nên nội dung
skill đổi theo thượng nguồn; Claude Code sẽ hỏi cài lần đầu mở repo). Dùng làm
*khung trình bày*, không thay `ba-pipeline`; chúng viết bằng tiếng Anh và không
biết ID truy vết, nên kết quả phải đổi sang tiếng Việt và gắn `BR-/FR-/DH-` tay:

| Việc | Skill | Đã dùng ở |
|---|---|---|
| Canvas chiến lược 9 ô | `/product-strategy` | `docs/00-dinh-huong.md §0.4` |
| Chỉ số sao Bắc Đẩu + chỉ số đầu vào | `/north-star-metric` | `§0.5` |
| Phản biện kế hoạch (giả định chịu lực) | `/strategy-red-team` | `§0.7` |
| Đối chiếu tài liệu ↔ code theo ranh giới tin cậy | `/intended-vs-implemented` | soát bảo mật kiểu FR-167 |
| Kịch bản kiểm thử từ tiêu chí nghiệm thu | `/test-scenarios` | nháp cho `docs/10` (giữ ID `TS-` của mình) |
| Job story cho tính năng chat | `/job-stories` | nháp UF mới |

Không dùng: `competitor-analysis` / `competitive-battlecard` (tìm nguồn tiếng
Anh, không biết batdongsan/mogi), `pm-toolkit`, `pm-data-analytics`.

## 8. Dùng với Cline (VS Code, chạy local)

`.clinerules/` chứa bản đồ tương đương cho Cline: luật dự án tự nạp +
3 workflow gõ bằng lệnh slash trong chat Cline:

| Lệnh | Việc |
|---|---|
| `/ba-pipeline.md` | Thêm/sửa yêu cầu giữ truy vết |
| `/soat-truy-vet.md` | Soát ID gãy trước commit |
| `/review-docs.md` | Review diff đụng docs/ |

Claude Code và Cline dùng chung nguồn sự thật (`docs/`) — harness
hai bên phải được cập nhật song song khi quy ước đổi.

## 9. Agent vai phụ (.claude/agents/)

Hai vai gọi được từ mọi phiên Claude Code mở repo này (`figma-builder` xoá 10/09/2026 cùng `design/`):

| Agent | Việc | Khi nào |
|---|---|---|
| `soat-truy-vet` | Soát ID gãy, truy vết thiếu, số đếm lệch, PII | Trước mọi commit đụng docs/ |
| `reviewer` | Review diff/PR theo checklist BA, chỉ báo finding | Khi review PR |

Routine nền: soát docs hằng đêm 22:00 (giờ VN) trên phiên mới, chỉ báo khi có lỗi.
