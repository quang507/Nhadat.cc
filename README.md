# nhadat.cc

Tài liệu và tài nguyên dự án nhadat.cc — dịch vụ môi giới bất động sản chat-first
tại TP.HCM (Zalo OA + website), khởi điểm thị trường Quận 5.

## 📘 Bắt đầu từ đâu

**[`docs/`](docs/) — bộ tài liệu BA đầy đủ.** Đây là nguồn sự thật của dự án.

| | Tài liệu | Nội dung |
|---|---|---|
| 0 | [Glossary](docs/00-glossary.md) | Từ điển thuật ngữ (B, S, CCRB, NMG, HXH…) |
| 1 | [Research](docs/01-research.md) | Insight, persona, mô hình KD, ngân sách, rủi ro |
| 2 | [Requirements](docs/02-requirements.md) | 9 BR · 92 FR · 15 NFR · 5 giả định |
| 3 | [User Flow](docs/03-user-flows.md) | 13 luồng end-to-end |
| 4 | [Information Architecture](docs/04-information-architecture.md) | Sitemap, URL/SEO, content model |
| 5 | [Wireframe](docs/05-wireframes.md) | 14 màn hình low-fi |
| 6 | [UI Design](docs/06-ui-design.md) | Design system + tone giọng chat |
| 7 | [SRS](docs/07-srs.md) | Kiến trúc, data model, API, 12 tiêu chí nghiệm thu |
| 8 | [Traceability](docs/08-traceability.md) | Ma trận truy vết BR→FR→UF→WF→SRS→AC |
| 9 | [Open Issues](docs/09-open-issues.md) | 18 vấn đề chờ chủ dự án chốt |

Quy ước làm việc và ranh giới bảo mật: [`CLAUDE.md`](CLAUDE.md).
Quy trình cập nhật tài liệu: [`.claude/skills/ba-pipeline/SKILL.md`](.claude/skills/ba-pipeline/SKILL.md).

## 📂 Tài liệu gốc (input thô — chỉ đọc)

| Mục | Mô tả |
|---|---|
| `Tài liệu hệ thống nhadat.cc.pdf`, `SS/` | Tài liệu hệ thống (Le Duong, 10/2024, v.5) |
| `nhadat.cc website.docx` | Mục tiêu website, SEO, hộp mời kết nối Zalo |
| `biz model.docx` / `biz model.pdf` | Mô hình kinh doanh, biểu phí, OKRs |
| `S's side.docx` | Luồng người bán, API S Side ↔ B Side |
| `chats w B.docx` | 24 kịch bản chat với người mua + đặc tả backend B Side |
| `demo2Vitalify.docx` | Concept gốc (tiếng Anh) |
| `OKRs eo2024.pptx` | Định vị "the permanent agent of agents" |
| `dự kiến vốn 6 tháng đầu.xlsx` | Ngân sách 6 tháng (800tr) |
| `Vedoo pages/` | Ảnh chụp theme tham chiếu Veedoo |
| `hình samples/` | Ảnh listing mẫu |
| `.claude/` | Cấu hình Claude Code của dự án |

## 🚫 Không nằm trong repo

Loại trừ có chủ đích (xem `.gitignore`):

- `nhadat-cc/` — mã nguồn app (Next.js), quản lý riêng
- `admin logins/` — credential, tuyệt đối không public
- `sổ đỏ samples/` — bản scan chứa thông tin cá nhân thật
- `masterDB/` — dữ liệu nhà và ảnh (~179MB)
- `ThemeForest/` — theme thương mại có bản quyền (~274MB)
