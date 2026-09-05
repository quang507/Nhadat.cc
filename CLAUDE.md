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
| 0 | `docs/00-dinh-huong.md` | **Định hướng** — BRD hợp nhất Aioinhadat × nhadat.cc: thương hiệu Aioinhadat, một bot Thái; mặt bán theo SRD AOND, mặt mua + web theo nhadat.cc, câu khách hỏi đi về CTV (FR-173); bất biến, sao Bắc Đẩu, lộ trình, quyết định treo. Đứng trên mọi tầng dưới | `DH-` |
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

## 3. Tài liệu gốc (không sửa)

Các file ở thư mục gốc là **input thô do chủ dự án cung cấp** — chỉ đọc, không
chỉnh sửa, không "dọn dẹp". Mọi diễn giải phải đi vào `docs/` kèm trích nguồn.

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

Các thư mục sau đã bị loại khỏi git (`.gitignore`) và **không bao giờ** được
đọc-rồi-chép nội dung vào `docs/`, commit message, hay PR:

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
  nó chỉ ĐỌC `masterDB/`, không bao giờ copy ảnh vào repo.
  `sao-luu.mjs` kéo cả **30 bảng** về JSON và gọi `xuat_schema()` ghi
  `bot/supabase/schema.sql` — **bậc Supabase Free không có backup tự động**,
  đây là bản sao duy nhất đang tồn tại (OPEN-25). Cần
  `SUPABASE_SERVICE_ROLE_KEY` trong biến môi trường; khoá đó bỏ qua mọi RLS nên
  tuyệt đối không ghi vào file trong repo, và thư mục đích mặc định nằm NGOÀI
  repo vì bản sao chứa SĐT thật. `soat-migration.mjs` so DB ↔ repo.

**Migration ghi THAY ĐỔI, `schema.sql` mới dựng lại được** (soát 05/09/2026).
Câu cũ ở đây nói "migration là nguồn sự thật của schema" — sai: DB đã áp 103
migration, repo có 62 file; 44 migration 21/08 → 27/08 áp thẳng qua MCP mà
không ai lưu file, nội dung mất vĩnh viễn (OPEN-46). Không ai thấy suốt hai
tuần vì không có gì đối chiếu hai bên. Nay: thay đổi schema vẫn BẮT BUỘC đi qua
một file trong `bot/supabase/migrations/`, `soat-migration.mjs` chặn trôi thêm,
và `bot/supabase/schema.sql` là lưới an toàn để dựng lại từ số không (quy trình
đầy đủ ở `bot/README.md §Phục hồi từ số không`).

**Danh sách bảng trong `sao-luu.mjs` phải đủ.** Nó liệt kê tay là cố ý (đọc là
thấy), nhưng suốt 27/08 → 05/09 nó thiếu 8 bảng — trong đó `listing_media`, bản
đồ ảnh ↔ tin (FR-165): mất nó thì file trong Storage còn nguyên mà không ai
biết ảnh của tin nào (OPEN-47). Nay `liet_ke_bang()` bắt script hỏi DB mỗi lần
chạy, thiếu bảng là DỪNG. Thêm bảng mới thì thêm vào mảng `BANG`.

**Trang tin phải nằm trong cache** (NFR-17). Route động có tham số đường dẫn mà
thiếu `generateStaticParams()` thì `export const revalidate` là chữ chết —
Next 15 để `prerender-manifest.dynamicRoutes` rỗng và mỗi lượt xem là một lambda
+ đủ số query. Kiểm bằng bảng route sau `bun run build`: trang tin phải là `●`
hoặc `○`, thấy `ƒ` là hỏng. Route đọc `searchParams` thì không ISR được, phải
bọc truy vấn trong `unstable_cache`.

**Đừng tin `cron.job_run_details.status`** (NFR-18). `net.http_post()` trả về
ngay khi xếp hàng nên cron luôn báo `succeeded`, kể cả lúc edge function trả
500. Kết quả thật nằm ở `net._http_response`, và được `bot_health_tick()` quét
sang `bot_errors` (FR-152). Xem sức khoẻ ở trang `/admin`.

**Mọi `catch` mới phải nối dây vào sổ** (FR-152 d). `console.error` một mình là
mất: log edge function bậc Free chỉ giữ 1 ngày, còn loại lỗi nguy nhất ở đây
lại TRẢ 200 nên `bot_health_tick` — vốn chỉ soi mã HTTP — không thấy gì. Trong
edge function dùng `ghiLoi(client, "tên chỗ", e)` của `_shared/claude.ts`;
trong bridge dùng `ghiLoi("tên chỗ", detail)`; phía web thì `instrumentation.ts`
đã bắt sẵn mọi lỗi server chưa bắt. Thêm `catch` mà quên nối là thêm một chỗ
hỏng im lặng.

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

`design/` chứa nguồn của bản trình bày thiết kế: `tokens.json` (design token máy
đọc được), `artboards/*.dc.html` (13 khung thiết kế), `artboards/canvas.json`
(bố cục), `assets/` (ảnh mẫu đã downsample). Dùng để dựng lại sang Figma hoặc
làm tham chiếu khi code. Xem `design/README.md`.

## 7. Cách chạy pipeline BA

Quy trình đầy đủ (BA + tester + ba cổng + định nghĩa XONG): `docs/11-quy-trinh.md`.
Bản rút gọn nạp tự động cho agent: `.claude/skills/ba-pipeline/SKILL.md`.

**Cổng kiểm — chạy trước mọi commit:**

```bash
bun run kiem   # = kieu (tsc) + build + test:bot (102 e2e + FR-159/161/164 + tự kiểm TS-SEC) + truyvet
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
4 workflow gõ bằng lệnh slash trong chat Cline:

| Lệnh | Việc |
|---|---|
| `/ba-pipeline.md` | Thêm/sửa yêu cầu giữ truy vết |
| `/soat-truy-vet.md` | Soát ID gãy trước commit |
| `/review-docs.md` | Review diff đụng docs/ |
| `/hoan-tat-figma.md` | Làm nốt Figma (local nói chuyện được với plugin Talk-to-Figma) |

Claude Code và Cline dùng chung nguồn sự thật (`docs/`, `design/`) — harness
hai bên phải được cập nhật song song khi quy ước đổi.

## 9. Agent vai phụ (.claude/agents/)

Ba vai gọi được từ mọi phiên Claude Code mở repo này:

| Agent | Việc | Khi nào |
|---|---|---|
| `soat-truy-vet` | Soát ID gãy, truy vết thiếu, số đếm lệch, PII | Trước mọi commit đụng docs/ |
| `reviewer` | Review diff/PR theo checklist BA, chỉ báo finding | Khi review PR |
| `figma-builder` | Dựng Figma theo `design/figma-handoff.md`, chống dựng trùng | Khi Figma MCP khả dụng |

Routine nền: soát docs hằng đêm 22:00 (giờ VN) trên phiên mới, chỉ báo khi có lỗi.
