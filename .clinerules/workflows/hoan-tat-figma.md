# Workflow: Hoàn tất Figma (chạy LOCAL — cần Figma desktop mở)

Mục tiêu: làm nốt các phần còn thiếu trong file Figma của dự án theo
`design/figma-handoff.md`. Workflow này tận dụng việc Cline chạy local
nên nói chuyện được với plugin qua localhost.

## Chuẩn bị (một lần)
1. Kiểm tra MCP server Figma trong cài đặt Cline. Hai lựa chọn:
   - **Figma MCP chính thức** (remote, OAuth) — nếu đã cấu hình thì ưu tiên.
   - **claude-talk-to-figma-mcp** (local): chạy WebSocket server của repo đó,
     mở Figma desktop → plugin "Claude Talk to Figma" → lấy mã channel
     → gọi tool `join_channel` với mã đó trước khi làm gì khác.
2. Mở file Figma: https://www.figma.com/design/mcyVWTPlbyCpHv0RV0DYxy
   (team NhaDat.cc, tên "nhadat.cc — Design System & SRS").

## Việc cần làm
3. Đọc `design/figma-handoff.md` — nó ghi chính xác trạng thái hiện tại
   (đã có gì, id page, toạ độ) và 4 khung toàn văn còn thiếu trên page
   "03 · SRS": 06-ui-design (x=7420), 07-srs (x=8480 + 9540),
   08-traceability (x=10600), 09-open-issues (x=11660), đều y=2300.
4. Nội dung lấy NGUYÊN VĂN từ `docs/06 07 08 09`. Pattern dựng (font, cỡ,
   màu, cấu trúc auto-layout) ghi trong handoff — khớp với 6 khung đã có.
5. Xong 4 khung thì dựng tiếp (nếu còn thời lượng):
   - Page "01 · Nền tảng": bảng màu / kiểu chữ / component
     theo `design/artboards/Foundation.dc.html` + `Components.dc.html`.
   - Page "02 · Màn hình": 6 màn theo `design/artboards/*.dc.html`
     (TrangChu, TimKiem, ChiTiet, RaoBan, ChatZalo, Admin).
6. Ràng buộc: không emoji làm icon (vẽ vector); màu #0068FF chỉ dành cho
   nút Zalo; giá tiền luôn #E2571E đậm; ẩn danh mọi số ĐT/tên thật.
7. Kết thúc: chụp screenshot page "03 · SRS", báo user kèm link file.
