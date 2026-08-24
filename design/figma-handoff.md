# Bàn giao: viết nốt docs/ vào Figma

**Bối cảnh.** File Figma `nhadat.cc — Design System & SRS` đã tồn tại:
https://www.figma.com/design/mcyVWTPlbyCpHv0RV0DYxy (team NhaDat.cc,
fileKey `mcyVWTPlbyCpHv0RV0DYxy`). Đã có:

- 2 variable collections: `nhadat/color` (21 màu), `nhadat/number` (spacing + radius).
- Page `01 · Nền tảng`, `02 · Màn hình` (trống, chờ dựng), `03 · SRS` (id `1:3`).
- Trên page **03 · SRS**: 4 khung SRS trực quan (y≈0–2100) + nhãn
  "TOÀN VĂN BỘ TÀI LIỆU docs/ 00 → 09" (y=2200) + **6 khung toàn văn** tại y=2300:

| x | Khung |
|---|---|
| 0 | 00 · Từ điển thuật ngữ |
| 1060 | 01 · Research |
| 2120 | 02 · Requirements (1/2) |
| 3180 | 02 · Requirements (2/2) |
| 4240 | 03 · User Flows |
| 5300 | 04 · Information Architecture |
| 6360 | 05 · Wireframes — ghi chú & trạng thái |

**Việc còn lại.** Viết 4 khung toàn văn nữa, cùng page `1:3`, cùng y=2300:

| x | Khung | Nguồn |
|---|---|---|
| 7420 | 06 · UI Design | `docs/06-ui-design.md` — đủ: nguyên tắc, token, kiểu chữ, component C01–C10, tone giọng (7 quy tắc + bảng câu mẫu + mục Cấm), micro-copy, a11y, bảng kế thừa/loại bỏ Veedoo |
| 8480 | 07 · SRS (1/2) | `docs/07-srs.md` §1–4 — giới thiệu, kiến trúc, tech stack, data model đầy đủ các bảng, API SRS-4.1…4.7 với payload JSON |
| 9540 | 07 · SRS (2/2) | `docs/07-srs.md` §5–8 — chu trình chatbot + bất biến I1–I4, xếp hạng, job, phát hiện tiêu cực, email, NFR nghiệm thu, AC-01…12, kế hoạch P0–P4 |
| 10600 | 08 · Traceability | `docs/08-traceability.md` — đủ 5 bảng ma trận |
| 11660 | 09 · Open Issues | `docs/09-open-issues.md` — đủ 14 mục, mỗi mục: vấn đề, phương án, khuyến nghị |

**Cách dựng (use_figma, Plugin API).** Dùng đúng pattern các khung đã có để đồng bộ:

- Khung: `figma.createAutoLayout("VERTICAL", {itemSpacing:10})`, width cố định 1000,
  padding 48/44, nền `#FFFFFF`, header = tên khung (Be Vietnam Pro ExtraBold 26,
  `#0E1B33`) + caption (Inter Regular 12.5, `#6B7C93`), kẻ dưới `#E3E8EF`.
- Kiểu nội dung: `h2` BVP Bold 19–20 · `h3` BVP SemiBold 15.5–16 · `p` Inter 13.5
  lh165% `#243651` · bullet chấm cam `#E2571E` · hàng key–value (key Inter Semi Bold
  13 rộng 215–230px, value Inter 13) kẻ dưới `#F1F4F9` · badge mã (FR-xx, UF-xx)
  JetBrains Mono Medium 12 `#E2571E` · code block nền `#0E1B33` chữ `#DCE4EF`
  JetBrains Mono 11.5 · note card nền `#FFF3EC` bo 10.
- Load font trước khi tạo text: Be Vietnam Pro (ExtraBold/Bold/SemiBold),
  Inter (Regular/Semi Bold — chú ý Inter dùng "Semi Bold" có khoảng trắng),
  JetBrains Mono (Medium).
- Mỗi call use_figma ≤ ~1 khung; `setCurrentPageAsync` đúng 1 lần/call; return node IDs.

**Sau khi xong.** Chụp screenshot page `1:3`, báo lại kèm link file.

**Ràng buộc.** Nội dung lấy NGUYÊN VĂN từ `docs/*.md` — không tóm tắt, không thêm ý.
Ẩn danh số điện thoại/tên thật nếu gặp. Không dùng emoji làm icon.
