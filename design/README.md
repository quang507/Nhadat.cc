# design/ — nguồn thiết kế nhadat.cc

Nguồn của bản trình bày *"từ nền tảng đến màn hình"* + SRS trực quan.
Canvas đã publish: xem link trong PR. Thư mục này là **source để dựng lại**,
bao gồm dựng sang Figma.

## Nội dung

| Đường dẫn | Nội dung |
|---|---|
| `tokens.json` | Design token máy đọc được — màu, chữ, spacing, radius, shadow, a11y |
| `artboards/*.dc.html` | 13 artboard, mỗi file là một khung thiết kế độc lập, HTML + inline style |
| `artboards/canvas.json` | Bố cục canvas: vị trí, kích thước, 3 trang, ghi chú |
| `assets/house*.jpg` | Ảnh listing mẫu, downsample từ `hình samples/` |

## 13 artboard

**Trang 1 — Nền tảng**
- `Main` — bìa
- `Foundation` — bảng màu, thang chữ, spacing, bo góc, bóng, icon, 6 nguyên tắc
- `Components` — UI-C01…C10

**Trang 2 — Màn hình** (WF-01, 02, 03, 05, 08, 12)
- `TrangChu` 1440 · `TimKiem` 1440 · `ChiTiet` 1440 · `Admin` 1440
- `RaoBan` 390 · `ChatZalo` 390 (mobile)

**Trang 3 — SRS** (trực quan hoá `docs/07-srs.md`)
- `SrsKienTruc` — 4 phân hệ, tech stack, 2 điểm cần chốt (OPEN-03, OPEN-11)
- `SrsDuLieu` — 11 bảng, khoá, ràng buộc, bảo mật RLS
- `SrsLuong` — sequence UF-05 + payload API, 4 bất biến chatbot, 7 job, công thức xếp hạng
- `SrsNghiemThu` — lộ trình P0→P4, 12 tiêu chí nghiệm thu, NFR

## Dựng sang Figma (phiên local)

Phiên cloud không với tới Figma desktop / `localhost` được, nên bước này chạy ở
máy có Figma. Hai đường:

**A · Figma MCP chính thức** — `use_figma`, `create_new_file`. Ưu tiên đường này.

**B · `claude-talk-to-figma-mcp`** (plugin dev đã cài) — chạy WebSocket server,
mở plugin trong Figma lấy mã channel, bảo Claude `join_channel <mã>`.

Prompt gợi ý sau khi kết nối được:

> Đọc `design/tokens.json` và `design/artboards/canvas.json`. Trong team Figma
> NhaDat.cc, tạo file "nhadat.cc — Design System" với 3 page: **Nền tảng**,
> **Màn hình**, **SRS**. Dựng lại từng artboard trong `design/artboards/` thành
> frame Figma đúng vị trí và kích thước khai báo ở `canvas.json`. Tạo Figma
> variables từ `tokens.json` (color, font, spacing, radius) và gán vào các
> layer thay vì hardcode. Icon dựng bằng vector, không dùng emoji.

## Sửa thiết kế

`.dc.html` là HTML thuần — mở bằng trình duyệt cũng xem được từng khung.
Sửa file → nếu muốn cập nhật canvas đã publish thì re-seed bằng skill `design`
rồi publish lại **cùng đường dẫn file** để giữ nguyên URL.

## Ràng buộc phải giữ

- Màu `zalo #0068FF` chỉ dành cho nút/biểu tượng Zalo (UI-P1).
- Giá tiền luôn `brand-600` đậm.
- Card listing đúng 4 dòng: mô tả · vị trí · DT · giá.
- Chat: tối đa 3 listing mỗi tin nhắn (FR-24).
- Không emoji làm icon — inline SVG stroke 2px, lưới 24.
- Không sao chép asset của theme Veedoo (NFR-15).

Chi tiết đầy đủ: `docs/06-ui-design.md`, `docs/05-wireframes.md`.
