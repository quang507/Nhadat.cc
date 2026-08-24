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
| `Vedoo pages/` | `06` (tham chiếu theme thương mại) |
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

Thư mục `nhadat-cc/` cũ (máy local) không dùng nữa. Quy tắc giữ nguyên: tính
năng mới phải có FR/SRS tương ứng trong `docs/` trước khi code.

## 6b. Nguồn thiết kế

`design/` chứa nguồn của bản trình bày thiết kế: `tokens.json` (design token máy
đọc được), `artboards/*.dc.html` (13 khung thiết kế), `artboards/canvas.json`
(bố cục), `assets/` (ảnh mẫu đã downsample). Dùng để dựng lại sang Figma hoặc
làm tham chiếu khi code. Xem `design/README.md`.

## 7. Cách chạy pipeline BA

Xem `.claude/skills/ba-pipeline/SKILL.md` — quy trình chuẩn để tạo mới hoặc cập
nhật một tầng tài liệu mà không phá vỡ truy vết.

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
