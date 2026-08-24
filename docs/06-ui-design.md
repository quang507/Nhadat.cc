# 06 — UI Design

Hệ thống thiết kế cho web nhadat.cc và cho **giọng nói** của bot Zalo — với dự án này,
tone giọng chat là một phần của UI, không phải phụ lục.

## 6.1 Nguyên tắc thị giác

| ID | Nguyên tắc | Hệ quả |
|---|---|---|
| UI-P1 | **Nút Zalo luôn là điểm nhấn mạnh nhất trang** | Không có CTA nào cạnh tranh về độ tương phản |
| UI-P2 | **Thông tin trước, trang trí sau** | Card listing ưu tiên Vị trí/DT/Giá; không hiệu ứng che nội dung |
| UI-P3 | **Mobile-first** | Mọi bố cục thiết kế ở 375px trước, mở rộng lên desktop |
| UI-P4 | **Giọng người, không giọng máy** | Micro-copy dùng "tụi em / anh chị", không dùng "Hệ thống", "Vui lòng" |
| UI-P5 | **Trung thực về độ chắc chắn** | Thông tin pháp lý luôn kèm nhãn nguồn; không hiển thị con số chưa xác minh như sự thật |
| UI-P6 | **Nhẹ** | LCP < 2.5s trên 4G (NFR-02); ảnh lazy, WebP, không carousel tự chạy |

## 6.2 Bảng màu

Kế thừa cấu trúc của theme tham chiếu Veedoo (cam nhấn + nền navy đậm) nhưng dùng
token riêng, **không** dùng asset của theme (NFR-15, `OPEN-07`).

| Token | Hex | Dùng cho |
|---|---|---|
| `--brand-600` | `#E2571E` | CTA chính, giá tiền, badge hot |
| `--brand-500` | `#F2691F` | Hover CTA |
| `--brand-50` | `#FFF3EC` | Nền khối nhấn nhẹ |
| `--ink-900` | `#0E1B33` | Nền footer, header trang chi tiết, chữ tiêu đề |
| `--ink-700` | `#243651` | Chữ thân bài |
| `--ink-400` | `#6B7C93` | Chữ phụ, nhãn |
| `--line` | `#E3E8EF` | Viền, đường chia |
| `--surface` | `#FFFFFF` | Nền card |
| `--canvas` | `#F6F8FB` | Nền trang |
| `--zalo` | `#0068FF` | **Chỉ** dùng cho nút/biểu tượng Zalo |
| `--ok` | `#12805C` | Còn rao, đã xác minh |
| `--warn` | `#B45309` | Chờ xác minh, quá SLA |
| `--danger` | `#B42318` | Đã bán, lỗi, phản ứng tiêu cực |

**Quy tắc màu**
1. `--zalo` là màu **thuộc về Zalo**, không dùng cho gì khác — người dùng phải nhận
   ra ngay đó là nút chuyển sang Zalo (UI-P1).
2. Giá tiền luôn `--brand-600`, đậm — đây là thông tin được đọc đầu tiên.
3. Tương phản văn bản ≥ 4.5:1; `--brand-600` trên nền trắng đạt 4.6:1 nên **chỉ**
   dùng cho chữ ≥ 16px semibold hoặc trên nền `--brand-50`.

## 6.3 Kiểu chữ

| Vai trò | Font | Cỡ (mobile → desktop) | Weight |
|---|---|---|---|
| H1 | Be Vietnam Pro | 28 → 40px | 700 |
| H2 | Be Vietnam Pro | 22 → 30px | 700 |
| H3 / tiêu đề card | Be Vietnam Pro | 17 → 19px | 600 |
| Thân bài | Inter | 16px / 1.6 | 400 |
| Nhãn, chú thích | Inter | 13px | 500 |
| **Giá** | Be Vietnam Pro | 20 → 24px | 700 |
| Mã BĐS `#35148` | JetBrains Mono | 14px | 500 |

Be Vietnam Pro được chọn vì phủ đầy đủ dấu tiếng Việt và giữ chiều cao dòng ổn định
khi có dấu chồng (ế, ỗ, ự) — vấn đề thường gặp với font Latin thuần.

## 6.4 Spacing, bo góc, đổ bóng

- Thang spacing 4px: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.
- Bo góc: card `12px`, nút `10px`, ảnh `8px`, chip `999px`.
- Bóng: `shadow-1 = 0 1px 2px rgba(14,27,51,.06)` (card),
  `shadow-2 = 0 8px 24px rgba(14,27,51,.10)` (hộp mời kết nối, modal).
- Bề rộng nội dung tối đa `1200px`; lưới desktop 12 cột, gutter 24px.

## 6.5 Thư viện component

### UI-C01 · PropertyCard
```
▢ ảnh 4:3 (lazy)   [badge "Hot" nếu hot_score cao]  [#35148 góc phải]
Mô tả rút gọn — 2 dòng, ellipsis
📍 Vị trí   ↔ DT   💰 Giá (brand-600, đậm)
```
Cấu trúc bắt buộc đúng 4 dòng theo đặc tả gốc. Badge "Đã bán" phủ overlay `--danger`
mờ 60% thay vì gỡ card khỏi lưới (giúp người dùng hiểu thị trường).

### UI-C02 · ChatSearchBar
Ô đơn, cao 56px, icon 🔍 trái, nút `[→]` phải màu `--brand-600`.
Placeholder **xoay vòng** giữa 3 ví dụ thật (FR-02). Trên `/tim-kiem` và `/{tag}` thì
sticky ở đỉnh sau khi cuộn 200px.

### UI-C03 · ZaloConnectBox
Nền `--ink-900`, chữ trắng, nút `--zalo`. Có icon Zalo. **Luôn** chứa lời hứa:
> *"Mời anh/chị kết nối ngay với tụi em để tụi em cùng tìm kiếm, và khi có sẽ thông báo tức thì."*

Ba biến thể: `inline` (trong luồng nội dung) · `sticky-mobile` (thanh đáy) ·
`detail` (trên trang chi tiết, kèm mã BĐS).

### UI-C04 · CueBadge
> `💬 Khi Zalo nhớ hỏi #35148`

Nền `--brand-50`, chữ `--ink-900`, mã dùng font mono. Chạm vào = copy mã.
Đây là cầu nối web↔chat (IA-P3), phải hiện ở **mọi** nơi có mã BĐS.

### UI-C05 · SpecTable
Hai cột nhãn/giá trị. Trường chưa xác minh hiển thị nhãn `Chờ xác minh` màu `--warn`
kèm nút `[Hỏi giúp em]` → tạo InfoRequest (UI-P5, FR-40).

### UI-C06 · QuickQuestionChips
Hàng chip từ bộ câu hỏi chuẩn hoá (FR-46): *Còn bán không? · Xem sổ đỏ · Ảnh hẻm ·
Mở quán được không? · Có vướng quy hoạch? · Hoàn công chưa?*
Chạm → mở Zalo với câu hỏi soạn sẵn.

### UI-C07 · ChatBubble (Zalo)
- Bot: nền `--canvas`, căn trái, bo góc `12px` (nhọn góc dưới-trái).
- Người dùng: nền `--zalo`, chữ trắng, căn phải.
- Card listing trong chat: ảnh + `#ID – mô tả 1 dòng – giá` + nút `[Xem chi tiết]`.
- **Tối đa 3 card/tin nhắn** (FR-24) — ràng buộc thiết kế, không phải khuyến nghị.
- Trạng thái chờ S: chip `⏳ Đang hỏi chủ nhà · #35148`.

### UI-C08 · PitchInput (mini-site S)
Textarea 4 dòng, cỡ chữ 17px, placeholder là **một câu rao thật**. Một nút duy nhất
`[Đăng tin ngay]`. Không đếm ký tự, không validate độ dài — INS-05.

### UI-C09 · ParsedFieldRow
Mỗi trường bóc tách hiển thị dạng "đã điền sẵn, sửa được". Trường AI không chắc chắn
có viền `--warn` gạch đứt + nhãn `Em đoán vậy, anh/chị kiểm giúp em`.

### UI-C10 · AdminTable
20 dòng/trang (FR-80), phân trang số. Dòng quá SLA nền `--warn` 8%. Cột ID luôn là
link. Có nút `Xuất Excel` trên mọi bảng (NFR-11).

## 6.6 Trạng thái tương tác

| Trạng thái | Xử lý |
|---|---|
| Hover nút | `--brand-500`, không dịch chuyển layout |
| Focus | Viền `2px --zalo`, offset 2px — bắt buộc, không được `outline:none` |
| Disabled | Opacity 45%, `cursor: not-allowed`, kèm tooltip lý do |
| Loading | Skeleton theo đúng hình dạng card, không spinner toàn trang |
| Rỗng | Luôn kèm hành động kế tiếp + ZaloConnectBox (IA-P1) |

## 6.7 Ảnh

- Tỉ lệ chuẩn: card 4:3, hero chi tiết 16:9, thumbnail vuông.
- Ảnh mẫu tham chiếu ở `hình samples/` — ảnh chụp bằng điện thoại, sáng không đều,
  đôi khi lệch khung. Thiết kế phải **chịu được ảnh xấu**: luôn `object-fit: cover`,
  nền `--canvas` khi ảnh chưa tải, không dựa vào ảnh đẹp để bố cục đứng vững.
- Thứ tự ưu tiên hiển thị: mặt tiền → phòng khách → hẻm → sân thượng → sổ (che thông
  tin cá nhân).
- **Ảnh sổ đỏ không bao giờ hiển thị công khai trên web** — chỉ gửi trong chat qua
  signed URL (NFR-06).

## 6.8 Tone giọng — Zalo bot

Chưng cất từ 24 hội thoại mẫu trong `chats w B.docx`. Đây là đặc tả có tính ràng buộc.

### Bảng nhân xưng
| Đối tượng | Bot tự xưng | Gọi khách |
|---|---|---|
| Khách bất kỳ | **em** | **anh / chị** (hỏi tên ngay lượt đầu, sau đó dùng "anh Hưng", "chị Dương") |
| Chưa biết giới tính | em | anh/chị |

### Bảy quy tắc
1. **Mở đầu bằng "Dạ"** khi đáp lại thông tin khách vừa cung cấp.
2. **Một câu hỏi mỗi lượt.** Không bao giờ hỏi hai điều cùng lúc.
3. **Kết thúc mọi tin chủ động bằng câu hỏi** — mục tiêu là khách *nhắn lại* (RSK-01).
4. **Không khẳng định điều chưa xác minh.** Mẫu chuẩn:
   > *"Cho tới 15h ngày 17/9 thì còn. Nhưng để em hỏi lại anh nhé."*
5. **Xin lỗi ngắn, sửa ngay.** Không giải thích dài dòng lý do chậm.
6. **Không dùng từ hệ thống**: tránh "Hệ thống ghi nhận", "Yêu cầu của quý khách",
   "Vui lòng". Dùng "Em ghi nhận…", "Anh/chị cho em xin…".
7. **Không bao giờ đòi số điện thoại** ngoài bước đặt lịch xem nhà, và luôn kèm lý do
   + đường từ chối (NFR-07).

### Thư viện câu mẫu

| Tình huống | Câu chuẩn |
|---|---|
| Chào lần đầu | *"Nhã Đạt CC xin cảm ơn! Công ty em có 30 nhà môi giới túc trực để tìm nhà đất chung cư cho anh/chị. Em tên là Trai. Em xin tên anh/chị để xưng hô cho lễ phép ạ"* |
| Gặp lại | *"Em chào anh Hưng. Anh vẫn tìm nhà ở Quận 5, dưới 10 tỉ, hẻm xe hơi hả anh? Có gì mới không anh?"* |
| Gửi danh sách | *"Em hiện có 24 mục. Anh xem thử vài mục hot nhất nha"* |
| Hỏi mục đích | *"Chị mua để ở hay kinh doanh ạ?"* |
| Chờ hỏi S | *"Chị chờ giùm một chút. Trong khi chờ chị có câu hỏi nào khác không ạ?"* |
| Có câu trả lời | *"Em đã hỏi chủ nhà. Có chuyển chị ngay."* |
| Xác nhận lịch xem | *"Em ghi nhận lịch xem nhà: #30148 — Trần Bình Trọng, Phường 4 Quận 5, 9h sáng Thứ 3 ngày 12/10. Em sẽ thu xếp rồi liên lạc lại với chị nha. Cảm ơn chị!"* |
| Nhắc trước buổi xem | *"Chào chị! Em là Trai, có hẹn với chị xem nhà lúc 9h sáng nay. Chị nhớ đến vị trí này: [maps]. Hẹn gặp chị."* |
| Khách không ưng | *"Căn nhà này có gì chưa phù hợp ạ? Chị chia sẻ với em đi. Để em tìm căn khác cho phù hợp với chị nha."* |
| Follow-up | *"Chị đã tìm mua được nhà chưa ạ? Em tiếp tục tìm cho chị nha?"* |
| Chống xoá Zalo | *"Chào anh! Nhờ anh nhắn cho em 1 tin, nếu không Zalo sẽ xóa kết nối. Em tiếp tục tìm nhà dưới 7 tỉ ở Quận 5 cho anh nhé?"* |
| Xin đánh giá | *"Xin chị đánh giá cách em cung cấp thông tin cho căn #346 nhé. Chị vào link này giúp em."* |
| Bắt lead bên bán | *"nhadat.CC cảm ơn chị đến với tụi em để rao bán/cho thuê. Mời chị đến trang web rao bán của tụi em: https://www.nhadat.cc/raoban"* |

### Cấm
- ❌ Hứa chắc về pháp lý, quy hoạch, hay tình trạng "còn/hết".
- ❌ Gửi quá 3 listing một lượt.
- ❌ Hỏi số điện thoại ngoài UF-06.
- ❌ Lặp lại **cùng một** mẫu follow-up hai lần liên tiếp.
- ❌ Dùng emoji quá 1 cái mỗi tin nhắn.

## 6.9 Micro-copy web

| Vị trí | Copy |
|---|---|
| Placeholder search | *"tìm mua nhà phố HXH 8 tỉ ở Q8"* |
| Nút CTA Zalo | *"Bắt đầu kết nối"* (không phải "Đăng ký", "Liên hệ") |
| Nhãn cue | *"Khi Zalo nhớ hỏi #35148"* |
| 0 kết quả | *"Chưa có căn nào khớp đúng. Em nới giá lên 9.6 tỉ thì có 41 căn:"* |
| Chờ xác minh | *"Thông tin do người bán cung cấp — hỏi tụi em để xác minh lại."* |
| CTA người bán | *"Miễn phí đăng tin. Chỉ thu phí khi bán được: chính chủ 1% · môi giới 0.5%"* |
| Khối riêng tư (phụ đề) | *"Để lại số ĐT trên trang BĐS khác nghĩa là 40 cuộc gọi trong 3 ngày. Ở đây: không một cuộc nào."* |
| Lời hứa với người bán | *"Bên em rao cho đến khi gặp người mua phù hợp nhất — anh/chị chỉ cần nhắn một lần."* |

## 6.10 Accessibility

- Tương phản chữ ≥ 4.5:1, chữ lớn ≥ 3:1.
- Vùng chạm ≥ 44×44px — quan trọng với persona P3 (61 tuổi).
- Mọi ảnh listing có `alt` sinh từ mô tả rút gọn.
- Điều hướng bàn phím đầy đủ, focus ring không bị tắt.
- Không dùng **riêng** màu để truyền đạt trạng thái: "Đã bán" phải có chữ, không chỉ màu đỏ.

## 6.11 Quan hệ với theme tham chiếu

| Kế thừa từ Veedoo | Loại bỏ |
|---|---|
| Lưới card 2 cột với ảnh lớn | Ảnh nhà kiểu Âu Mỹ, biệt thự có hồ bơi |
| Thanh search dính đầu trang | Bộ lọc dropdown Keyword/Type/Location (trái INS-07) |
| Khối thông số nổi trên hero chi tiết | Khối "Floor Plans", "Signature Features" — không có dữ liệu này |
| Cấu trúc footer 4 cột + đăng ký nhận tin | Form đăng ký email (trái NFR-07 — kênh là Zalo) |
| Cặp màu cam nhấn / navy đậm | Toàn bộ asset, icon, font của theme (NFR-15) |
| — | Khối bình luận/review công khai trên trang BĐS (đưa hội thoại ra khỏi Zalo) |
