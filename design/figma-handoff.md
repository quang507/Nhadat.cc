# Bàn giao Figma — hiện trạng file thiết kế

**File.** `nhadat.cc — Design System & SRS`, team NhaDat.cc, fileKey
`mcyVWTPlbyCpHv0RV0DYxy` — https://www.figma.com/design/mcyVWTPlbyCpHv0RV0DYxy

**Trạng thái 04/09/2026.** File chỉ còn **hai page**:

| Page | Node | Nội dung | Nguồn |
|---|---|---|---|
| `00 · Định hướng` | `54:2` | 2 khung, bản trực quan của `docs/00-dinh-huong.md` **v1.3** | `docs/00-dinh-huong.md` |
| `10 · Trạng thái 04/09/2026` | `73:2` | 1 khung, ảnh chụp nghiệm thu 04/09 | `docs/10 §10.8`, `docs/02` |

> Các page `01 · Nền tảng`, `02 · Màn hình`, `03 · SRS` mô tả trong bản bàn giao
> cũ **không còn tồn tại** — đã bị xoá cùng 7 khung toàn văn `docs/00`–`05` từng
> nằm trên `03 · SRS`. Đừng đi tìm; muốn có lại thì dựng mới từ `docs/*.md`.

**Variable collections** còn nguyên: `nhadat/color` (`VariableCollectionId:2:2`,
21 màu) và `nhadat/number` (`VariableCollectionId:2:24`, 12 biến spacing/radius).
Token máy đọc được ở `design/tokens.json`.

## Page `00 · Định hướng` (`54:2`)

Hai khung xếp ngang, y=0, cách 60px, width 1000. Cập nhật theo **v1.3**
(04/09/2026) — xem "Đã đồng bộ tới đâu" bên dưới.

| x | Khung | Node | Nguồn |
|---|---|---|---|
| 0 | (1/2) §0.1 định vị DH-01 (bảng Bán / Mua / Vòng nối) · sơ đồ luồng câu khách hỏi FR-173 · DH-02 bốn bất biến · §0.2 hai nguồn gốc (10 hàng) | `65:2` | §0.1, §0.2 |
| 1060 | (2/2) §0.3 SRD AOND 19 hàng chip trạng thái · §0.5 DH-05 + I1–I5 · §0.6 DH-06 · §0.7 giả định chịu lực · §0.8 note "đã chốt" + OPEN-27 ½ sau / 40 / 41 / 42, DH-07 | `65:7` | §0.3, §0.5–§0.8 |

Canvas §0.4 chỉ có trong docs, không dựng.

## Page `10 · Trạng thái 04/09/2026` (`73:2`)

Một khung `73:3`, width 1000, cao ~1040 — ảnh chụp nghiệm thu ngày 04/09.

| Khối | Nội dung | Nguồn |
|---|---|---|
| 1 | "Đã dựng đợt 02–04/09" — bảng `Mảng / Đang chạy được / Còn thiếu`, 6 dòng: Web bán hàng · Bot mua · Bot bán · Vòng CTV · Quản trị · Giám sát | `docs/10 §10.8.4`, §10.8.2 |
| 2 | "Trạng thái yêu cầu" — 4 con số lớn 110 đã dựng / 30 một phần / 5 chưa dựng / 4 thay thế (tổng 149 FR) + dòng liệt kê 5 FR chưa dựng và ghi chú FR-15 | `docs/02-requirements.md` |
| 3 | "Ba việc chặn phía chủ dự án" — bridge im từ 27/08 · CTV và chủ nhà chưa có Zalo uid · chưa chạy `up-anh.mjs` nên kho ảnh rỗng | `docs/10 §10.8.4` cuối |
| 4 | "Kiểm thử" — e2e 102/102 · fr159 65 · fr161 9 · fr164 8 + dòng nói suite DB rollback trên project thật và các lỗi đỏ đã vá bằng `20260904b` | `docs/10 §10.8.1` |

## Đã đồng bộ tới đâu

`00 · Định hướng` khớp `docs/00-dinh-huong.md` **v1.3 · 04/09/2026**: tiêu đề phụ
hai khung, §0.2 hàng "Vận hành", §0.5 cách đo I4 và I5 (view `nmg_hoat_dong`),
§0.6 tách "đã dựng" / "đã chạy thật", §0.7 "rao một câu" chuyển sang *chưa đánh
giá được* + giả định 4 đã đổ một lần, §0.8 mốc đã chốt 04/09.

`10 · Trạng thái 04/09/2026` khớp `docs/10 §10.8` và bảng FR trong `docs/02` ở
mốc 04/09/2026.

## Pattern dựng (use_figma, Plugin API)

Giữ đúng để khung mới đồng bộ với khung cũ:

- **Khung:** `figma.createAutoLayout('VERTICAL', {itemSpacing:14})`, width cố định
  1000, padding 34/40, nền `#FFFFFF`, bo 6.
- **Kiểu chữ:** tiêu đề khung Be Vietnam Pro ExtraBold 22 `#0E1B33` · phụ đề
  Inter Regular 11.5 `#6B7C93` lh 150% · tiêu đề mục BVP SemiBold 15 `#0E1B33` ·
  thân Inter Regular 11.5 `#243651` lh 140% · nhãn cột Inter Semi Bold 9.5
  `#6B7C93` chữ hoa · badge mã (FR-xx, tên bảng) JetBrains Mono Medium 10.5
  `#E2571E` lh 140%.
- **Bảng:** hàng auto-layout HORIZONTAL gap 10, padding dọc 5 (⇒ cao 26px), kẻ
  dưới `#F1F4F9` (`strokeBottomWeight = 1`, ba cạnh kia 0); hàng nhãn cột kẻ dưới
  `#E3E8EF`. Ô là TEXT `textAutoResize = 'HEIGHT'` + `resize(w, h)` rồi
  `layoutSizingHorizontal = 'FIXED'`.
- **Chip trạng thái:** bo 999, padding 2/8, chữ Inter Semi Bold 10.5 trắng.
  đúng `#12805C` · khác bản gốc `#B45309` · chưa `#E3E8EF` · không nhận `#B42318`
  · chờ chốt nền `#FFF3EC` chữ/viền `#E2571E`.
- **Thẻ:** thẻ nhạt nền `#F1F4F9` bo 8 padding 12/14 · thẻ nhấn nền `#FFF3EC`
  viền `#E2571E` bo 10 padding 10/12. Muốn các thẻ cùng hàng bằng chiều cao thì
  đặt `layoutSizingVertical = 'FILL'` cho từng thẻ — `counterAxisAlignItems` KHÔNG
  nhận `'STRETCH'`.
- **Font phải load trước khi tạo/sửa text.** Be Vietnam Pro (ExtraBold, SemiBold,
  Bold), Inter (Regular, **`Semi Bold`** — có khoảng trắng), JetBrains Mono
  (Medium). Sửa text có sẵn thì load font hiện tại lấy từ
  `getStyledTextSegments(['fontName'])`, đừng đoán.
- Mỗi call `use_figma` ≤ ~1 khung · `setCurrentPageAsync` đúng 1 lần/call ·
  luôn `return` node IDs · `get_metadata` trước khi dựng để không tạo trùng.

## Ràng buộc

Nội dung lấy **nguyên văn** từ `docs/*.md` — không tóm tắt, không thêm ý. Không
emoji làm icon (dùng chữ: "đã dựng", "một phần", "chưa dựng", "thay thế").
`#0068FF` chỉ dành cho nút Zalo. Ẩn danh SĐT / Zalo uid / tên thật.

**Figma là ảnh chụp, không phải nguồn.** `docs/*.md` mới là nguồn sự thật; docs
đổi thì dựng lại khung tương ứng, không sửa tay trong Figma rồi để lệch.
