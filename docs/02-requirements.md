# 02 — Requirements

Quy ước ưu tiên: **M** = Must (MVP), **S** = Should (sau MVP), **C** = Could (backlog).
Ký hiệu trạng thái: `✅` đã dựng · `🟡` một phần · `❌` chưa dựng · `⛔` deprecated.
Tài liệu này nói **yêu cầu là gì và trạng thái hôm nay**. Con trỏ hiện thực đầy đủ ở
`08-traceability.md` §8.3, kịch bản nghiệm thu ở `10-ke-hoach-kiem-thu.md`, lịch sử ở git log.

## 2.1 Mục tiêu kinh doanh

| ID | Mục tiêu | Đo bằng |
|---|---|---|
| BR-01 | Phủ 90% nguồn hàng mua/bán/thuê trên từng cụm địa bàn đang mở (Quận 5 cũ là cụm khởi điểm; địa bàn mở rộng Sài Gòn + Long An — FR-174) | Số listing active / ước lượng tổng thị trường |
| BR-02 | Xây mạng lưới 20 NMG, mỗi người chuyên một khu trong địa bàn | Số NMG active đạt chuẩn |
| BR-03 | 10 cuộc chat mới/ngày, ≥30 tin/cuộc, không rác | Bảng thống kê hội thoại (FR-71) |
| BR-04 | 1 giao dịch / 2 ngày, TB 10 tỉ | Sổ giao dịch |
| BR-05 | Thu phí bên bán: CCRB 1%, NMG 0.5% | Doanh thu ghi nhận |
| BR-06 | Miễn phí và **không thu số ĐT** của B | Chính sách sản phẩm, kiểm tra được trong log |
| BR-07 | Giữ kết nối Zalo sống suốt chu kỳ mua 3–4 năm | Tỉ lệ kết nối còn sống sau 30/90/365 ngày |
| BR-08 | SEO cho 100 keyword BĐS hot nhất | Thứ hạng Google, organic traffic |
| BR-09 | Website đẩy được B sang Zalo OA kèm ngữ cảnh | Tỉ lệ click "Bắt đầu kết nối" |

## 2.2 Persona

### P1 — Chị Dương, 42, người mua để ở
Tìm nhà Quận 5 dưới 12 tỉ, HXH. Đã bị 4 sàn gọi làm phiền nên **không để lại số ĐT**.
Hỏi rất cụ thể: sổ đỏ, hoàn công, quy hoạch, ảnh cái hẻm. Quyết định theo tháng, không theo phiên.
> Nhu cầu #1: được trả lời thật, nhanh, và không bị gọi điện.

### P2 — Anh Hưng, 35, nhà đầu tư
Quan tâm dòng tiền và khả năng kinh doanh: mở quán được không, cho thuê bao nhiêu,
xây lại được không. Xem nhiều căn, so sánh nhanh, phản hồi cụt.
> Nhu cầu #1: danh sách so sánh được, cập nhật liên tục căn mới.

### P3 — Cô Bảy, 61, CCRB
Có một căn ở Phường 4 Quận 5 cần bán. Không dùng app BĐS, chỉ dùng Zalo.
Gõ một câu là hết vốn liếng công nghệ. Sợ bị lộ thông tin, sợ mất phí oan.
> Nhu cầu #1: rao được trong 2 phút, và có người thật dẫn khách tới.

### P4 — Anh Tuấn, 29, NMG
Có 10–30 căn. Muốn thêm nguồn khách mà không tốn phí đăng tin.
Chấp nhận trả 0.5% khi thành công, nhưng phải nhận được câu hỏi của khách **ngay**.
> Nhu cầu #1: dòng lead ổn định, phản hồi câu hỏi nhanh để không mất khách.

### P5 — Ngân, 26, CTV nhadat.cc
1.5 FTE cho toàn hệ thống. Nhận lịch xem nhà, gọi CCRB, dẫn khách, chấm điểm NMG.
> Nhu cầu #1: một hàng đợi công việc rõ ràng, có ưu tiên.

## 2.3 Phạm vi

### Trong phạm vi MVP
Website nhadat.cc (giới thiệu, listing, search, SEO, CTA Zalo) · Zalo OA chatbot cho B ·
Mini-site rao tin cho S · Vòng hỏi-đáp bổ sung thông tin S↔B · Đặt lịch xem nhà ·
Admin backend buyer side · Email notification · Bảng thống kê xuất Excel.

### Ngoài phạm vi MVP
App native · Thanh toán online · Ký hợp đồng điện tử · Định giá tự động đầy đủ ·
Facebook Messenger / Telegram · Đa ngôn ngữ · Cổng NMG tự phục vụ đầy đủ
(MVP dùng CTV vận hành thủ công).

---

## 2.4 Yêu cầu chức năng

### A. Website công khai (WEB)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-01 | ✅ **Landing giới thiệu dịch vụ.** Mỗi mục một lợi ích kèm minh hoạ hội thoại, theo phong cách whatsapp.com. Hiện thực: `app/page.tsx` khối "Lời hứa". | M | website.docx §Giới thiệu dịch vụ |
| FR-02 | ✅ **Ô search dạng chat ở trang chủ.** Placeholder là một câu nói tự nhiên; gõ xong đi thẳng vào kết quả. Hiện thực: form GET ở hero → `app/api/search`. | M | website.docx §Search |
| FR-03 | ✅ **Khối "Hỏi bất kỳ, có tức thì".** Minh hoạ vòng B hỏi → hệ thống hỏi S → báo lại B. Hiện thực: `app/page.tsx` khối 3 bước. | M | website.docx |
| FR-04 | ✅ **Khối cam kết riêng tư.** Ba vế: không hỏi số ĐT, chỉ liên hệ qua Zalo, ngắt kết nối bất cứ lúc nào. Hiện thực: `app/page.tsx`, nhắc lại ở hộp Zalo trang kết quả. | M | website.docx §Tụi em không hỏi số ĐT |
| FR-05 | 🟡 **Cam kết theo dõi dài hạn.** Khối "Mất vài năm mới tìm được nhà?" hứa đi cùng khách suốt chu kỳ mua. Hiện thực: thẻ "Trực 24/7, nhớ nhu cầu" ở `app/page.tsx`. Chưa: khối riêng đúng thông điệp gốc. | M | website.docx |
| FR-06 | ✅ **CTA sang mini-site người bán.** "Bán hay cho thuê với nhadatCC?" dẫn sang `/raoban`. Hiện thực: `app/page.tsx` khối navy. | M | website.docx |
| FR-07 | ✅ **Trang listing dạng lưới card.** Mỗi card: ảnh, mô tả rút gọn, vị trí, DT, giá. Hiện thực: `ListingBrowse`, `/mua-ban`, `/cho-thue`. | M | website.docx §Listing |
| FR-08 | ✅ **Trang kết quả nói lại truy vấn.** "Tìm thấy N tin theo yêu cầu" + tiêu đề diễn giải lại câu người dùng gõ; hộp Zalo mang theo câu đó. Hiện thực: `ListingBrowse` nhận `q`. | M | website.docx §Search |
| FR-09 | 🟡 **Search hiểu ngôn ngữ tự nhiên.** Bóc loại BĐS, quận/phường/đường/mốc, giá, HXH/MT, số PN, mua hay thuê; có dấu lẫn không dấu. Hiện thực: `lib/parse-query.ts`, `app/api/search`. Chưa: tự nới kết quả khi không khớp (thay bằng chip lọc + Zalo). | M | website.docx §Search; INS-07 |
| FR-10 | ✅ **Trang chi tiết BĐS.** Gallery ảnh, mô tả đầy đủ, bảng thông số, bản đồ vị trí ở mức phường (FR-104). Hiện thực: `app/nha-dat/[code]`, `components/WardMap`. | M | website.docx §Chi tiết 1 BĐS |
| FR-11 | ✅ **Cue nhắc mã tin.** Trang chi tiết luôn gợi "khi nhắn Zalo nhớ hỏi #mã". Hiện thực: `app/nha-dat/[code]` hộp Zalo + câu xin hình theo mã. | M | website.docx §Cue |
| FR-12 | 🟡 **Trang tag SEO.** 100 tag BĐS hot nhất, mỗi tag một URL tĩnh: H1 = keyword, mô tả sinh từ số liệu kho, lưới tin khớp, tag liên quan; trang rỗng thì mời Zalo chứ không 404. Hiện thực: `lib/tags.ts`, `app/[tag]` (SSG, 64 tag). Chưa: bộ TOP-100 keyword thật (OPEN-06) và tag theo khu mới (OPEN-27). | M | website.docx §Tag |
| FR-13 | ✅ **Hộp mời kết nối Zalo.** Hiện ở trang chủ và mọi trang kết quả tìm kiếm. Hiện thực: `ListingBrowse`, `app/page.tsx`. | M | website.docx §Hộp mời kết nối |
| FR-14 | ✅ **Chuyển sang Zalo mang theo ngữ cảnh.** Click "Bắt đầu kết nối" thì toàn bộ ngữ cảnh tìm kiếm của phiên đi cùng. Hiện thực: `zaloLink()`, tham số `search:<q>` / `#mã`. | M | website.docx §Hộp mời kết nối |
| FR-15 | 🟡 **Điều hướng nội bộ trước khi sang Zalo.** Khuyến khích B xem 3–5 trang rồi mới click sang Zalo. Hiện thực: breadcrumb, khối "Cùng khu", chip phường, tag liên quan, link tính lãi vay. Chưa: chưa có số đo số trang mỗi phiên. | S | website.docx §Tăng cường SEO |
| FR-16 | ❌ **Fingerprint khách vãng lai.** Ghi nhận hành vi để cá nhân hoá kết quả lần sau. Chưa: thư viện, chính sách lưu trữ và cơ chế từ chối còn treo (OPEN-14). | S | PDF hệ thống §1 |
| FR-17 | ✅ **Nền SEO kỹ thuật.** Sitemap.xml, robots, meta/OG và canonical tự sinh, JSON-LD `RealEstateListing` trên trang tin (địa chỉ tới mức phường — FR-104). Hiện thực: `app/sitemap.ts`, `app/robots.ts`, `app/layout.tsx`. | M | BR-08 [giả định BA] |

### B. Zalo OA — phía mua (BOT)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-20 | ✅ **Chào lần đầu.** Giới thiệu "30 nhà môi giới túc trực", xin tên để xưng hô. Hiện thực: `chat-reply` + `bot_prompts`. | M | chats w B.docx §Chào hỏi |
| FR-21 | ✅ **Chào khi gặp lại.** Nhắc lại tiêu chí lần trước và hỏi xác nhận còn đúng không. Hiện thực: `chat-reply` (hồ sơ `buyers.preferences`). | M | chats w B.docx §Nếu gặp lại |
| FR-22 | 🟡 **Truy vấn theo vị trí ở mọi mức.** Quận, phường, đường, số hẻm, ngã tư, mốc tiện ích, hoặc "gần căn này". Hiện thực: `chat-reply` lọc KHO theo phường/quận. Chưa: luật riêng cho mốc tiện ích và "gần căn này". | M | chats w B.docx §Hỏi nhà quanh 1 vị trí |
| FR-23 | 🟡 **Truy vấn giá.** Khoảng, dưới, trên, giữa hai mốc, hoặc "giá cỡ căn này quanh đây". Hiện thực: `budgetRangeVnd` trong `chat-reply`. Chưa: neo giá theo một căn mốc khi khách hỏi. | M | chats w B.docx §Hỏi giá |
| FR-24 | 🟡 **Tối đa 3 listing mỗi tin nhắn**, kèm nút "Xem thêm". Hiện thực: trần 3 căn là bất biến trong prompt `chat-reply`, mời xem thêm bằng lời. Chưa: nút bấm — Zalo cá nhân không có, chờ OA (OPEN-43). | M | chats w B.docx; S's side.docx §Show a list |
| FR-25 | ✅ **Định dạng listing trong chat**: `#mã – mô tả 1 dòng – giá`. Hiện thực: khối KHO của `chat-reply`. | M | chats w B.docx |
| FR-26 | ✅ **Khai thác nhu cầu sâu.** Hỏi mua ở hay đầu tư; nếu kinh doanh thì hỏi loại hình. Hiện thực: `chat-reply` (nhịp hỏi FR-130). | M | chats w B.docx §Lấy thêm nhu cầu |
| FR-27 | ✅ **Gửi ảnh theo yêu cầu.** Mỗi lượt vài tấm rồi hỏi "xem thêm không"; nhớ chỗ đang dừng để lượt sau gửi tiếp. Hiện thực: `chat-reply` (≤4 tấm/lượt, offset trong `buyers.preferences`). Chưa: mỗi khách chỉ nhớ một offset nên xin hình căn khác giữa chừng là mất chỗ cũ. | M | chats w B.docx §Khi chỉ gửi 1 số hình |
| FR-28 | ❌ **Tiện ích quanh BĐS.** Trả lời trường học, chợ, bệnh viện kèm khoảng cách. Chưa: nguồn dữ liệu POI còn treo (OPEN-13). | S | chats w B.docx §Khi trả lời về tiện ích |
| FR-29 | ✅ **Vào từ quảng cáo với một mã BĐS.** Chào đúng căn đó ngay. Hiện thực: khối "căn khách đang nhắc" trong `chat-reply`. | M | chats w B.docx §Hỏi đáp từ quảng cáo |
| FR-30 | ✅ **Nhận ngữ cảnh tìm kiếm từ website.** Câu tìm kiếm đi kèm khi B click hộp mời kết nối. Hiện thực: `zaloLink()` → `chat-reply`. | M | website.docx; FR-14 |
| FR-31 | ✅ **Gợi ý căn tương tự.** Căn khách hỏi đã chốt/đã gỡ, hoặc khách nói "giống giống vầy" → tối đa 3 căn cùng deal, giá 0,7–1,3× căn gốc, ưu tiên cùng phường rồi mở ra cùng quận. Hiện thực: khối CĂN TƯƠNG TỰ trong `chat-reply`. | S | chats w B.docx |
| FR-32 | ✅ **Chủ động khi B im sau một BĐS.** Gửi thêm thông tin mà không cần được hỏi. Hiện thực: `tao_followup` + `nudge` (một nhắc/khách/24h). | S | chats w B.docx §Khi khách không hỏi gì thêm |

### C. Vòng hỏi-đáp bổ sung thông tin (ASK)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-40 | ✅ **Không chắc thì không đoán.** AI cần xác minh thì tạo một yêu cầu thông tin gửi phía bán thay vì phán bừa. Hiện thực: trường `ask_owner` → `info_requests`. | M | chats w B.docx; RSK-03 |
| FR-41 | ✅ **Yêu cầu mang đủ ngữ cảnh**: mã BĐS, mã yêu cầu, nguyên văn câu hỏi của B. Hiện thực: `info_requests` (một CSDL chung thay cho hai API rời). | M | chats w B.docx §Gọi API về S side |
| FR-42 | ✅ **Định tuyến câu hỏi.** Về chủ tin (CCRB/NMG), hoặc CTV, hoặc admin. Hiện thực: trigger `route_info_request` (câu khách hỏi đi CTV — FR-173; câu drip đi chủ nhà). | M | chats w B.docx |
| FR-43 | ✅ **Câu trả lời quay về kèm nguyên văn và file/ảnh.** Hiện thực: nhánh nội bộ `#mã: trả lời` và nhánh người bán của `chat-reply` → `listing_facts`. | M | chats w B.docx |
| FR-44 | ✅ **Trả lời của S cập nhật luôn listing**, phục vụ mọi B sau đó. Hiện thực: `ghi_fact_listing` → `listing_facts_sync_cols` → cột `listings`. | M | S's side.docx §Hỏi thêm thông tin từ S |
| FR-45 | ✅ **Giữ nhịp trong lúc chờ S.** Kết tin bằng "trong khi chờ, anh/chị có câu hỏi gì khác không ạ?". Hiện thực: luật + few-shot trong `bot_prompts`. | M | S's side.docx |
| FR-46 | ✅ **Nhóm câu hỏi chuẩn hoá**: còn bán không · sổ đỏ · quy hoạch · kinh doanh được không · ảnh hẻm/khu vực · hoàn công. Hiện thực: `required_facts`, view `listing_missing_facts`. | M | chats w B.docx |
| FR-47 | ✅ **SLA cho yêu cầu thông tin.** Quá hạn thì leo thang sang CTV rồi admin. Hiện thực: `info_request_sla_tick` (120 phút CTV — FR-173) và `info_request_timeout_tick` (24h/48h — FR-110). | S | [giả định BA] |

### D. Đặt lịch xem nhà (VIEW)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-50 | ✅ **Khởi động đặt lịch.** B đề nghị xem nhà, hoặc bot chủ động đề nghị khi thấy B quan tâm. Hiện thực: trường `viewing` trong `chat-reply`. | M | chats w B.docx §Hẹn xem nhà |
| FR-51 | ✅ **Xác nhận đúng căn trước khi chốt giờ** (mã, địa chỉ, giá). Hiện thực: `chat-reply` (mã tin viết HOA, neo `listing_id`). | M | chats w B.docx |
| FR-52 | ✅ **Chốt lịch qua CTV.** Thu khung giờ mong muốn, nhắc CTV ngay để xác nhận với chủ nhà trong 120 phút; CTV nhắn `#mã: ok 9h` thì lịch sang `confirmed` và bot báo khách. Quá hạn thì leo thang admin. Hiện thực: trigger `viewings_bao_ctv_va_email`, `nudge`. | M | chats w B.docx |
| FR-53 | ✅ **Xin số điện thoại chỉ tại bước này**, nêu rõ mục đích, cho phép từ chối. Hiện thực: `chat-reply` nhánh `viewing`. | M | chats w B.docx; xung đột INS-04 → OPEN-05 |
| FR-54 | ✅ **Gửi link Google Maps ghim vị trí.** Chỉ gắn khi tin có toạ độ thật, không có thì không bịa link. Hiện thực: `nudge` nhắc `viewing` + `listings.lat/lng` (FR-122). | M | chats w B.docx |
| FR-55 | ✅ **Nhắc trước giờ hẹn.** CTV gọi trước 30 phút; bot nhắn trước buổi xem 45 phút, kèm link bản đồ khi tin có toạ độ. Hiện thực: `reminders` kind `viewing` + `nudge`. | M | chats w B.docx §Nhắc trước khi xem |
| FR-56 | 🟡 **Hỏi cảm nhận sau khi xem.** Hỏi sau buổi xem 4 giờ, mỗi buổi một câu; không ưng thì hỏi lý do để tinh chỉnh tiêu chí. Hiện thực: `reminders` kind `feedback` + `nudge` (mẫu cố định). Chưa: nhánh riêng đọc lý do chê để sửa hồ sơ nhu cầu. | M | chats w B.docx §Không chịu xem nhà |
| FR-57 | 🟡 **Yêu cầu xem nhà sinh sự kiện + email `[VIEWING]` cho admin.** Hiện thực: trigger `viewings` → `property_events` + `email_admin`. Chưa: email chưa đi thật vì ntfy chặn gửi ẩn danh (xem FR-81). | M | chats w B.docx §Hẹn xem nhà (backend) |

### E. Giữ chân & tái kích hoạt (RET)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-60 | ✅ **Follow-up sau 5 ngày im lặng.** Một lần cho mỗi lượt im, cửa sổ tới 7 ngày, chỉ gửi trong khung 8–21h VN. Hiện thực: `nudge` + `buyers.last_contact_at`. | M | chats w B.docx §Follow-up; quyết định chủ dự án 04/09/2026 |
| FR-61 | ✅ **Nội dung hỏi thăm đa dạng.** Sáu góc xoay vòng tất định: căn cuối, tiến độ, xem ảnh, tiêu chí, đặt lịch, thị trường; góc cần căn mà không có căn thì nhảy góc kế. Hiện thực: `nudge`. | M | chats w B.docx §Hỏi về căn nhà cuối cùng |
| FR-62 | ✅ **Chào căn khác cùng khu / cùng tầm giá** để khởi động lại hội thoại. 2–3 căn cùng phường (hoặc cùng quận), giá 0,7–1,15× căn mốc, trừ căn đã gửi. Hiện thực: hàm `can_cung_khu()` + `nudge`. | M | chats w B.docx §Chào những căn khác |
| FR-63 | ✅ **Chống Zalo xoá kết nối.** Im ≥6 ngày (trước mốc 7 ngày) thì buộc gửi câu xin nhắn lại một chữ, bằng mẫu cố định nên key model hỏng vẫn cứu được kết nối. Hiện thực: `nudge` góc `giu_ket_noi`. | M | chats w B.docx §Trước khi Zalo xóa; RSK-01 |
| FR-64 | ✅ **Báo tin mới khớp tiêu chí đã lưu.** Tin vừa lên kệ khớp deal + khu vực + ngân sách (0,7–1,15× giá tin) của khách còn liên hệ trong 30 ngày → báo chủ động. Van: 1 tin/khách/24h, 1 tin/khách/tin, tối đa 50 khách/tin. Hiện thực: `bao_tin_moi_khop()` + `reminders` kind `match`. | M | website.docx §Mất vài năm mới tìm được căn nhà |
| FR-65 | 🟡 **Xin đánh giá chất lượng ở 3 thời điểm**: sau khi cấp thông tin một BĐS, sau một đợt tìm kiếm, sau khi xem nhà. Hiện thực: sau buổi xem — khách chấm 1–5 sao trong 48h → `ghi_danh_gia()`. Chưa: hai thời điểm còn lại (cố ý hoãn để khỏi spam). | S | chats w B.docx §Đánh giá chất lượng |

### F. Admin — buyer side (ADM)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-70 | 🟡 **Bảng sự kiện BĐS**: timestamp, mã BĐS, loại sự kiện; chỉ cần kết nối được từ Excel. Hiện thực: bảng `property_events` sinh bằng trigger từ 7 bảng nguồn, thẻ "BĐS hot" ở `/admin`, đọc/xuất qua Table Editor. Chưa: xuất Excel phía server; loại `photos` chưa có nguồn sinh. | M | chats w B.docx §Backend của B Side |
| FR-71 | 🟡 **Bảng thống kê hội thoại**: mã B, timestamp, số tin mỗi bên, thời lượng. Hiện thực: view `hoi_thoai_thong_ke` theo ngày + thẻ 30 ngày và nút tải CSV ở `/admin`; số liệu theo từng hội thoại nằm ở view `hoi_thoai_phien` (FR-72). Chưa: thẻ theo từng hội thoại trên `/admin`, xuất Excel phía server. | M | chats w B.docx §Thống kê cuộc trò chuyện |
| FR-72 | ✅ **Định nghĩa cuộc trò chuyện**: chuỗi tin cách nhau không quá 30 phút. Hiện thực: view `hoi_thoai_phien` tách phiên từ `messages`; model `conversations` giữ nguyên một hội thoại/khách. | M | chats w B.docx |
| FR-73 | ✅ **BĐS hot nhất** = đếm sự kiện trong 2 tháng gần nhất. Hiện thực: view `bds_hot` (tính lúc đọc) + thẻ "BĐS hot · 60 ngày" ở `/admin`. | M | chats w B.docx §BĐS 'hot' nhất |
| FR-74 | 🟡 **Tìm kiếm B.** Lọc theo tên Zalo, theo khoảng thời gian tiếp xúc lần đầu/lần cuối/một cuộc trò chuyện. Hiện thực: ô "Tìm khách" ở `/admin` (tên hoặc Zalo uid), không hiện `phone` (NFR-07). Chưa: lọc theo khoảng thời gian. | M | chats w B.docx §Tìm kiếm B |
| FR-75 | 🟡 **Nhảy từ kết quả sang Zalo xem lịch sử hội thoại.** Hiện thực: link `zalo.me/<uid>` khi có uid. Chưa: chưa có bằng chứng uid mở được trên Zalo thật (best-effort). | M | chats w B.docx |
| FR-76 | 🟡 **Danh sách câu hỏi của B chờ S trả lời**: mã B, mã BĐS, giờ hỏi, câu hỏi, giờ và nội dung trả lời. Hiện thực: thẻ "Câu hỏi đang chờ" ở `/admin` (kèm người được giao, hạn SLA đỏ khi quá hạn). Chưa: mã B bấm được sang Zalo từ dòng câu hỏi. | M | chats w B.docx §Các câu hỏi của B cần S trả lời |
| FR-77 | 🟡 **Danh sách phản ứng tiêu cực**: giờ, mã B, trích nguyên văn vài tin. Hiện thực: view `khach_can_nguoi_that` + thẻ ở `/admin`, dùng cờ `needs_human` làm proxy. Chưa: bot chưa gán nhãn "tiêu cực" riêng. | M | chats w B.docx §Phản ứng tiêu cực |
| FR-78 | ✅ **Danh sách hẹn xem nhà**: giờ, mã B, mã BĐS. Hiện thực: thẻ "Lịch xem nhà" ở `/admin` (sắp tới + 7 ngày qua). | M | chats w B.docx §Hẹn xem nhà |
| FR-79 | 🟡 **Danh sách yêu cầu voice chat.** Khách đòi gọi điện → bật cờ cần người thật, sinh việc `VOICE:` và email `[VOICE]`; bot hứa nhờ người phụ trách gọi lại. Hiện thực: `chat-reply` + `reminders`. Chưa: thẻ riêng trên `/admin` (nay đọc chung bảng `reminders`). | M | chats w B.docx §Khách hàng muốn voice chat |
| FR-80 | ✅ **Mọi danh sách admin phân trang 20 mục/trang.** Hiện thực: `usePhanTrang` ở `/admin`, dữ liệu tải một đợt nên lật trang không tốn truy vấn. | M | chats w B.docx |
| FR-81 | 🟡 **Email cho admin ở mọi mục FR-76…79.** Tiêu đề `<loại> <Zalo ID>`, loại ∈ `[QUESTION] [VOICE] [VIEWING] [UPSET]`, thân thư chứa các trường + mô tả BĐS. Hiện thực: `email_admin()` qua ntfy.sh, đích đọc từ `app_config.admin_email`. Chưa: ntfy chặn gửi email ẩn danh — chờ chủ dự án tạo tài khoản + `NTFY_TOKEN`. | M | chats w B.docx §Email notification |

### G. Mini-site & luồng người bán (SEL)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-90 | ✅ **Mini-site rao bán/cho thuê** tại `nhadat.cc/raoban`. Hiện thực: `app/raoban` (3 bước + CTA Zalo). | M | S's side.docx §Từ trang web nhadat.cc |
| FR-91 | ✅ **Rao bằng một câu thông thường**, không bắt điền form nhiều trường. Hiện thực: `/raoban` → Zalo, nhánh câu rao của `chat-reply`. | M | S's side.docx; INS-05 |
| FR-92 | ✅ **AI bóc tách trường từ câu rao**: vị trí, đường/loại hẻm, quy mô, giá, mua/thuê. Hiện thực: `app/api/listing/parse` (xem trước) + `boc_thong_so()` phía DB (FR-172). | M | S's side.docx §Bóc tách trường |
| FR-93 | ❌ **Sinh nhiều biến thể câu rao** theo độ dài và theo khía cạnh B quan tâm. Chưa: chưa dựng ở cả web lẫn bot. | M | S's side.docx |
| FR-94 | 🟡 **Cho S xác nhận/chỉnh sửa bản đã bóc tách trước khi đăng.** Hiện thực: `/quan-ly` sửa tin của mình; bot báo lại từng thông tin đã ghi trong vòng hỏi nhỏ giọt. Chưa: màn xác nhận ngay sau câu rao. | M | PDF hệ thống §2 |
| FR-95 | ❌ **Đăng nhập bằng Zalo SSO.** Chưa: hiện dùng magic-link email cho NMG (FR-124); Zalo SSO còn treo ở ASM-02. | M | PDF hệ thống §2 |
| FR-96 | ✅ **Upload nhiều ảnh cho listing.** Nén ở trình duyệt rồi đẩy vào bucket công khai theo UUID tin và ghi `listing_media`; ảnh sổ đỏ không đi đường này (NFR-06). Hiện thực: `components/UploadAnh` ở `/admin`, `/admin/dang-tin`, `/quan-ly`. | M | PDF hệ thống §3 |
| FR-97 | ⛔ [deprecated → FR-109] **Link mini-site cho người muốn bán.** Bot gửi link `/raoban` khi có người nhắn Zalo OA muốn bán; nay rao từng bước ngay trong Zalo. | — | S's side.docx §List new |
| FR-98 | 🟡 **S trả lời câu hỏi bổ sung ngay trong chat**, kể cả gửi ảnh và giấy tờ. Hiện thực: nhánh người bán của `chat-reply`, ảnh kèm chú thích cũng vào fact `hinh_anh`. Chưa: ảnh chủ gửi qua chat chưa được tải về kho (OPEN-32). | M | S's side.docx §Hỏi thêm thông tin từ S |
| FR-99 | 🟡 **Định giá bằng so sánh nhanh.** Bot và trang tin đối chiếu giá/m² trung bình cùng phường + cùng loại giao dịch, nói rõ là ước tính từ kho và là giá rao. Hiện thực: khối KHO của `chat-reply`, dòng so sánh ở `app/nha-dat/[code]`. Chưa: hỗ trợ phía người bán lúc rao, nguồn giá thị trường ngoài (OPEN-10). | S | S's side.docx §Dịch vụ của nhadatCC cho S |
| FR-100 | 🟡 **Danh sách riêng cho một khách.** Vài chục BĐS gom thành một link chia sẻ được, hết hạn 30 ngày, không đánh chỉ mục. Hiện thực: bảng `curated_lists` + RPC, trang `app/ds/[token]`, ô tạo danh sách ở `/admin`. Chưa: bot tự tạo từ hội thoại. | M | S's side.docx §Show a list |
| FR-101 | ✅ **Phân loại S là CCRB hay NMG để áp đúng mức phí.** Nhãn gán ngay lúc bóc tách: ai nói mình có BĐS là chính chủ, chỉ người tự xưng môi giới mới là NMG. Hiện thực: `mo_ho_so_nguoi_ban()` (FR-159). | M | biz model.docx |
| FR-102 | ⛔ [deprecated → FR-137] **Theo dõi chuẩn NMG.** Ràng buộc chất lượng NMG (≥10 listing, tỉ lệ thành công ≥5%, rating >3/5); việc chấm điểm nay nằm trọn trong báo cáo CTV 17h. | S | biz model.docx §NMG; chủ dự án chốt 27/08/2026 |
| FR-103 | ✅ **Lời hứa "rao một lần là xong".** Hệ thống theo đuổi việc bán tới khi gặp người mua phù hợp, chỉ liên hệ lại S khi cần xác minh hoặc chốt lịch; tin `dang_ban` im 30 ngày thì hỏi lại "còn bán không" (một lần mỗi 30 ngày, trần 5 tin/ngày). Hiện thực: `stale_listing_tick()` + cron 9h VN. | M | trao đổi chủ dự án 22/08/2026; INS-09 |

### H. Trung gian ẩn danh & vòng đời listing (BROKER)

Nguồn cả nhóm: artifact "Cầu Nối BĐS" v2 (08/2026) — spec này thắng khi mâu thuẫn với mục cũ.

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-104 | ✅ **Không chủ động phơi thông tin, khai khi được hỏi.** Web và gợi ý của bot chỉ nêu mã tin + khu vực mức phường; khách hỏi một căn cụ thể thì bot khai mọi thứ đã lưu về căn đó; SĐT/Zalo người bán chỉ mở ở bước hẹn xem; hai bên không nhắn trực tiếp cho nhau. Hiện thực: `sanitizeDescription()` phía web, khối căn-đang-nhắc của `chat-reply`. | M | INS-11; quyết định chủ dự án 02/09/2026 |
| FR-105 | 🟡 **Lọc liên hệ trước khi chuyển tiếp.** Mọi fact và mọi bong bóng gửi người mua bị soát SĐT / Zalo / địa chỉ số nhà, thay bằng "[liên hệ qua Zalo]"; không áp cho nhánh người bán / CTV / admin. Hiện thực: `locLienHe()` (bot) và `sanitizeDescription()` (web) — hai bản phải sửa cùng nhau. Chưa: duyệt ảnh tay giai đoạn đầu. | M | INS-11 |
| FR-106 | ⛔ [deprecated → FR-139] **Vòng đời listing bản cũ.** Chuỗi trạng thái tiếng Anh (draft → pending_review → active → negotiating → sold/expired); nay 5 trạng thái tiếng Việt và không còn bước duyệt tay bắt buộc. | M | Cầu Nối §Vòng đời |
| FR-107 | ⛔ [deprecated → FR-129/FR-144] **TTL xác nhận 7 ngày.** Xác nhận lại với S bằng `last_confirmed_at` trước khi giới thiệu; nay việc giữ tin tươi do vòng hỏi nhỏ giọt lo, riêng TTL 7 ngày cho căn dự án còn sống trong FR-116. | M → S | Cầu Nối §F2; DH-03 |
| FR-108 | ✅ **Sổ quan tâm và báo khi căn đã chốt.** Mọi căn khách nhắc/bot gợi/xin hình đều ghi `interests`; tin sang `da_chot` thì báo mọi B đang chờ kèm 1–2 căn thay thế cùng khu. Van: 1 tin/khách/24h và 1 tin/khách/tin. Hiện thực: `mark_listing_interest`, `bao_can_da_chot()`, `nudge` mẫu cố định. | M | Cầu Nối §F2 |
| FR-109 | ✅ **Rao tin từng bước ngay trong Zalo**: khu vực → loại → giá → DT → pháp lý → mô tả → ảnh; khu vực không khớp danh mục thì đưa lựa chọn quận/phường. `/raoban` là kênh song song trên web. Hiện thực: nhánh câu rao + drip của `chat-reply`. | M | Cầu Nối §F1; thay FR-97 |
| FR-110 | ✅ **Timeout hỏi S.** Nhắc 1 lần sau 24h; quá 48h đóng yêu cầu và báo trung thực cho B kèm gợi ý căn khác. Hiện thực: `info_request_timeout_tick()` + cron mỗi giờ, `followup` → `nudge`. | M | Cầu Nối §F3 |
| FR-111 | 🟡 **Ảnh từ Zalo là URL tạm.** Phải tải về kho file, DB chỉ lưu tham chiếu. Hiện thực: kho Supabase Storage + `listing_media` (FR-165); adapter đổi kho cố ý không dựng, `app_config` đủ để trỏ URL đi nơi khác. Chưa: ảnh chủ gửi qua chat chưa tải về kho (OPEN-32). | M | Cầu Nối §Kiến trúc |
| FR-112 | ✅ **Sổ giao dịch làm căn cứ tính phí.** Điểm sao từng tương tác ghi vào hồ sơ; `deals` ghi giao dịch thành công với phí CCRB 1% (CTV hưởng 0.5%) và NMG 0.5%, kèm tỉ lệ chốt 5% của NMG. Hiện thực: bảng `deals` + `fee_pct` trong `chat-reply`. | M | Cầu Nối §F4; OPEN-16 (b) |

### I. Hàng dự án (PROJECT)

Nguồn cả nhóm: OPEN-15 phương án (b), chủ dự án 24/08/2026; phân tích INS-10.
Phạm vi MVP: **đặt nền dữ liệu**, chưa làm UI giỏ hàng riêng.

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-113 | ✅ **Data model dự án.** Bảng `projects` (tên, slug, chủ đầu tư, vị trí, pháp lý, tiện ích, mặt bằng, tiến độ) + liên kết trên listing: `project_id`, `unit_code`, `floor`, `direction`, `unit_status` ∈ {còn bán, giữ chỗ, đã cọc, đã bán}. Hiện thực: SRS-3.10. | M | OPEN-15 (b); INS-10 |
| FR-114 | 🟡 **Gắn tin vào dự án lúc rao.** Chọn dự án có sẵn + nhập mã căn; không thuộc dự án thì tin là hàng lẻ. Hiện thực: luồng Zalo (`match_projects` → `project_id` + `unit_code`). Chưa: chọn dự án ở `/raoban` và form admin. | M | OPEN-15 (b) |
| FR-115 | ✅ **Trả lời câu hỏi tầng dự án từ dữ liệu chung** (vị trí, chủ đầu tư, pháp lý, tiện ích, tiến độ), KHÔNG tạo info_request — vòng hỏi-đáp chỉ dành cho dữ liệu tầng căn. Hiện thực: khối KHO DỰ ÁN của `chat-reply`. | M | INS-10 |
| FR-116 | 🟡 **"Căn X của dự án Y còn không?"** Đọc `unit_status`; quá TTL xác nhận 7 ngày thì phải hỏi lại chủ trước khi khẳng định; mã căn không có thì nói thật. Hiện thực: khối CĂN TRONG DỰ ÁN của `chat-reply`. Chưa: căn chuyển đã bán thì báo mọi B đang chờ kèm căn thay thế cùng dự án. | M | INS-10; Cầu Nối §F2 |
| FR-117 | 🟡 **Trang dự án `/du-an/{slug}` + màn quản lý giỏ hàng** cho admin/NMG (giai đoạn 2). Hiện thực: `app/du-an/[slug]` SSG (thông tin dự án, dải giá, lưới tin kèm mã căn và tình trạng, JSON-LD, sitemap). Chưa: màn quản lý giỏ hàng — đổi `unit_status` vẫn qua sửa tin. | S | OPEN-15 (b) |
| FR-118 | 🟡 **Địa giới hành chính hai tên.** Trục chính là bản trước sáp nhập 1/7/2025 trên toàn hệ thống (URL, taxonomy, chat), kèm bảng ánh xạ phường cũ ↔ mới để bot hiểu cả hai cách gọi, hiển thị tên mới khi nói chuyện pháp lý, và tra cứu SEO hai chiều. Chưa: bảng `ward_mapping` — thuộc đợt 2 của FR-174, chờ OPEN-27. | M | INS-12; quyết định chủ dự án 24/08/2026 |
| FR-119 | ✅ **Máy tính lãi vay `/tinh-lai-vay`.** Trả góp đều, nhập giá/trả trước/lãi suất/thời hạn, biểu đồ dư nợ, nhận `?price=` từ trang tin, ghi rõ "chỉ tham khảo". Hiện thực: `app/tinh-lai-vay` (client). | M | OPEN-19 (b) 25/08/2026 |
| FR-120 | ✅ **Trang `/thong-ke`.** Giá rao trung bình mỗi m² theo phường tính từ tin thật; phường dưới 2 tin không hiện; ghi rõ là giá rao không phải giá chốt. Hiện thực: `app/thong-ke`. | S | port từ NhaDat-Radar |
| FR-121 | ✅ **Lưu tin yêu thích không cần tài khoản.** Nút tim trên card/chi tiết, xem lại ở `/yeu-thich`; muốn nhớ dài hạn đa thiết bị thì đẩy sang chat Zalo. Hiện thực: localStorage + `app/yeu-thich`. | S | INS-04; port từ NhaDat-Radar |
| FR-122 | ✅ **Bản đồ `/ban-do`.** Chấm theo toạ độ geocode từ địa chỉ trên tin, thiếu toạ độ thì rơi về tâm phường. Địa chỉ trên tin vốn chỉ tới mức đường/hẻm nên không phá ẩn danh FR-104. Hiện thực: `app/ban-do`, `lib/geo.ts`, `geocode-listings`. | S | port từ NhaDat-Radar; chốt 25/08/2026 |
| FR-123 | ✅ **Bộ lọc danh sách.** Khoảng giá theo loại giao dịch, khoảng diện tích, số phòng ngủ, sắp xếp — dạng link thuần để URL chia sẻ được. Hiện thực: `/mua-ban`, `/cho-thue` (mở rộng thêm bộ lọc thông số ở FR-172). | M | port từ NhaDat-Radar |
| FR-124 | ✅ **Tài khoản chỉ cho NMG.** Magic-link email ở `/dang-nhap`, dashboard `/quan-ly` xem tin của mình + đăng tin bằng MỘT câu rao. CCRB không cần tài khoản, buyer tuyệt đối không. Hiện thực: `sellers.auth_user_id` + RLS `listings_own_*`. | S | port từ NhaDat-Radar; bổ trợ FR-100 |
| FR-125 | ✅ **Trang `/moi-gioi`.** Mạng lưới NMG: tên + số tin đang rao + khối tuyển NMG nêu chuẩn chất lượng, không lộ liên hệ. Cố ý KHÔNG hiện điểm trung bình vì chưa có nguồn ghi điểm thật (OPEN-12). Hiện thực: view `agents_public` (SECURITY DEFINER tự chứa). | S | port từ NhaDat-Radar; BR-02; sửa 27/08/2026 |
| FR-126 | ✅ **Tài khoản người mua tự nguyện.** `/tai-khoan`: tin đã xem gần đây, khuyến nghị cùng khu + tầm giá, hồ sơ tên/SĐT không bắt buộc kèm cam kết chỉ dùng để xác nhận lịch xem và xoá được. Luồng Zalo vẫn không hỏi số. Hiện thực: `buyers.auth_user_id`, `listing_views`. | S | quyết định chủ dự án 25/08/2026 (nới BR-06 ở kênh web, opt-in) |
| FR-127 | ✅ **Trang `/admin` duyệt tin.** Danh sách `cho_thong_tin` → Duyệt (`dang_ban`) / Ẩn (`an`), kèm số liệu tổng quan; quyền theo bảng `admins` + RLS `listings_admin_*`. | S | quyết định chủ dự án 25/08/2026 |
| FR-128 | ✅ **Cột `listings.bedrooms` + lọc "N+ phòng ngủ".** Backfill bằng regex từ mô tả, phần còn lại do bot bóc khi hỏi S. Hiện thực: `listings.bedrooms`, bộ lọc `/mua-ban`. | S | hoàn thiện FR-123 |
| FR-129 | ✅ **Hỏi nhỏ giọt người bán.** Đăng tin xong hỏi ĐÚNG MỘT thông tin thiếu ưu tiên nhất, trả lời xong hỏi câu kế; im lặng thì cron nhắc theo nhịp với trần: không hỏi khi còn câu chờ, ≤3 câu/24h/tin, ≤10 tin/nhịp, ≤2 căn/24h mỗi seller, chỉ tin <7 ngày hoặc seller có Zalo. Văn phong khen trước — hỏi sau (§6.8). Hiện thực: `ask-seller` + cron `seller-drip-tick`. | M | quyết định chủ dự án 25/08/2026; INS-06, INS-09 |
| FR-130 | ✅ **Khai thác nhu cầu người mua nhỏ giọt, giống người.** Hồ sơ tích luỹ trong `buyers.preferences`, bóc sau mỗi tin, không hỏi lại điều đã biết; hỏi khu vực + khoảng giá trước, gộp được 2–3 ý vào một câu; **đủ khu vực + tầm giá thì ngừng dò**; hỏi 2 lượt liên tiếp thì lượt kế phải đưa giá trị. Trả lời trước — hỏi sau, tối đa 2 bong bóng. Hiện thực: `chat-reply`. | M | quyết định chủ dự án 25/08/2026; UF-04 |
| FR-131 | ✅ **Gộp tin nhắn gõ vụn, không delay nhân tạo.** Có tin mới hơn của cùng khách thì lượt này nhường, chỉ tin cuối chùm trả lời trên toàn ngữ cảnh gộp → một câu trả lời thay vì ba câu chồng nhau; kèm chống đua tạo trùng buyer/conversation. Hiện thực: `ensure_buyer_conversation` (advisory lock) + `messages.seq`. | M | quyết định chủ dự án 25/08/2026 |
| FR-132 | ✅ **Kho dự án, ưu tiên dự án đang phân phối.** Bảng `projects` giữ Ny'ah Phú Định (`priority=1`, `is_partner`) — chủ dự án đang trực tiếp bán; bot trả lời tầng dự án thẳng từ kho, giá từng căn thì phải nói "để em kiểm tra rồi báo"; Ny'ah chỉ giới thiệu chủ động MỘT lần, không lặp khi khách từ chối. Seed mogi đã gỡ, cơ chế nạp giữ ở code. | M | quyết định chủ dự án 25/08/2026; INS-10 |
| FR-133 | ✅ **Nhắc hẹn + hỏi thăm khi im lặng.** (a) Ai hứa "chiều gửi ảnh, mai báo lại" thì đặt hẹn và tới giờ nhắc khéo MỘT tin, họ nhắn lại trước hẹn thì huỷ nhắc; (b) buyer im 5–6 ngày thì hỏi thăm (FR-60…63). Mọi tin chủ động chỉ gửi 8h–21h VN. Hiện thực: `reminders` + `nudge` + cron `nudge-tick`. | M | quyết định chủ dự án 25/08/2026; INS-03 |
| FR-134 | ✅ **Bot đọc ảnh khách gửi (vision).** Mô tả trung thực điều thấy được, đoán thì nói "hình như là…" rồi xác nhận lại, KHÔNG suy diễn vật liệu/pháp lý từ ảnh; ảnh ghi vết trong `messages`. Voice/STT ngoài phạm vi. Hiện thực: `chat-reply` nhận `image_url`, `zalo-webhook` + bridge. | S | quyết định chủ dự án 25/08/2026 |
| FR-135 | ✅ **Cờ cần người thật.** Bật khi khách đòi gặp người thật, bức xúc thật sự, đàm phán giá hồi kết, hoặc "để em hỏi lại" lặp 2 lần cùng một chuyện — không bật vì câu hỏi khó thường ngày; bot hứa nhờ người phụ trách nhắn lại. Hiện thực: `conversations.needs_human` + báo cáo CTV. | M | quyết định chủ dự án 25/08/2026 |
| FR-136 | ✅ **CRM CTV — chia đơn xoay vòng.** Bảng `ctvs` bật/tắt bằng cờ `active`; mỗi hội thoại mới được gán CTV đang ôm ít đơn hoạt-động-30-ngày nhất, hoà thì ai nhận cũ nhất nhận trước. Hiện thực: trigger `assign_ctv_round_robin`. | M | yêu cầu chủ dự án 25/08/2026 |
| FR-137 | 🟡 **Báo cáo CTV 17h mỗi ngày.** Tổng hợp per-CTV (đơn đang chăm, đơn tương tác hôm nay, lịch xem sắp tới, đơn chờ người thật) + chấm điểm chăm khách theo rubric 4 tiêu chí, gửi MỘT tin về Zalo cá nhân admin, lưu `ctv_daily_reports` chống gửi đôi. Hiện thực: `ctv-report` + cron 17h VN. Chưa: `ZALO_ADMIN_ZALO_ID`/OA chưa cấu hình nên tin đi đường bridge (FR-149). | M | yêu cầu chủ dự án 25/08/2026 |
| FR-138 | ✅ **Cấu hình "não" bot không cần deploy.** Bảng `bot_prompts` (văn phong, luật phí, nhịp nhắn, kịch bản người bán, từ điển lóng, few-shot, rubric) đè lên mặc định trong code; sửa ở Table Editor là bot đổi ngay lượt sau, không có dòng thì dùng bản `_shared/prompts.ts`. | M | yêu cầu chủ dự án 25/08/2026 |
| FR-139 | ✅ **Vòng đời tin theo trạng thái tiếng Việt.** `cho_thong_tin` (thiếu giá/DT/phường, ẩn khỏi web) → `dang_ban` (đủ 3 trường thì tự lên web) → `dang_quan_tam` (khách hỏi, badge trên web) → `da_chot` (bot báo thật + gợi căn tương tự); thêm `an` (gỡ tay). 7 ngày không ai hỏi thì `dang_quan_tam` tự về `dang_ban`. Hiện thực: `listings.status` + trigger + cron decay. | M | yêu cầu chủ dự án 25/08/2026 |
| FR-140 | ✅ **Fallback hỏi-chủ-nhà → CTV → admin.** Bot hứa "để em hỏi lại chủ nhà" → `info_requests` (chống trùng 24h/căn), trigger định tuyến theo người còn liên lạc được; giao CTV/admin thì sinh việc escalation đi OA hoặc bridge. Chủ trả lời → báo lại khách đúng câu trả lời và huỷ nhắc im lặng cùng căn. SĐT/Zalo admin nằm ở bảng `admins`, không nằm trong code. Nửa "báo admin luôn" đã thay bằng FR-173. | M | yêu cầu chủ dự án 25/08/2026; cập nhật 02–03/09/2026 |
| FR-141 | ✅ **Người thật chăm thì bot nhường sân.** CTV/admin gõ tay từ acc Zalo → ghi tin `sender='human'` + mốc chạm tay; trong **30 phút** bot chỉ ghi log tin khách, không chen ngang; ngừng đủ lâu thì bot tiếp chuyện lại và thấy cả nội dung người thật đã nhắn. Hiện thực: `conversations.human_touch_at`, endpoint `human_note`. | M | yêu cầu chủ dự án 25/08/2026 |
| FR-142 | ✅ **Chốt giao dịch theo tín hiệu đồng ý.** Tin trước có đề nghị chốt/cọc và khách đồng ý bằng chữ, emoji, like/tim hay sticker → ghi `deals` (phí 1% CCRB / 0.5% NMG), tin sang `da_chot`, báo gấp CTV/admin. Đồng ý lịch xem dùng cùng bộ tín hiệu. Bộ tín hiệu cấu hình ở `bot_prompts.agree_rules`; chống ghi trùng theo cặp căn + khách. | M | yêu cầu chủ dự án 25/08/2026 |
| FR-143 | ✅ **Bot gửi hình thật cho khách.** Nguồn là ảnh kho cộng ảnh chính chủ gửi qua chat; khách xin hình mà model quên thì hệ thống tự đính kèm theo mã khách nhắc, tối đa 4 hình/lượt; căn chưa có hình thì đi đường hỏi-chủ-nhà. Hiện thực: `send_photos` + mảng `photos`, bridge/OA gửi ảnh đính kèm. | M | yêu cầu chủ dự án 25/08/2026 |
| FR-144 | ✅ **Vòng thu thập thông tin chính chủ trọn đời tin.** (a) Câu rao mới → tự tạo tin nháp + hỏi ngay MỘT thông tin thiếu; (b) mỗi câu trả lời lưu fact và chảy vào cột; (c) tin đủ điều kiện thì NGỪNG hỏi và báo "tin đã lên web"; (d) khách quan tâm hỏi thêm thì mở vòng mới; (e) đang có câu chờ thì nhịp cron bỏ qua, không hỏi chồng. Hiện thực: `chat-reply` + `ask-seller`. | M | yêu cầu chủ dự án 25/08/2026 |
| FR-145 | ✅ **Widget Zalo trên web.** Nút nổi góc trái dưới trên mọi trang; riêng trang chi tiết căn ẩn widget, thay bằng nút "Chat Zalo về căn này" mang ngữ cảnh nằm trong bài. Link cấu hình một chỗ. Hiện thực: `components/ZaloWidget` ở `app/layout.tsx`. | M | yêu cầu chủ dự án 25/08/2026 |
| FR-146 | ✅ **Trần 100 tin/24h mỗi khách.** Vượt trần thì bot gửi ĐÚNG MỘT tin hẹn người phụ trách nhắn lại, bật cờ cần người thật, sinh việc cho CTV; các tin sau trong 24h bị bỏ qua im lặng, không tốn lượt model. Mục đích kép: chặn đốt tiền model và chuyển khách nhắn quá nhiều sang người thật. | M | yêu cầu chủ dự án 25/08/2026 |
| FR-151 | ✅ **Hai cổng chặn đốt tiền model.** (a) Trần TOÀN CỤC theo ngày: vượt thì trả 429 và im hẳn, báo admin đúng một lần trong ngày; trần chỉnh bằng secret, mặc định 1000/ngày. (b) Bí mật dùng chung `x-bridge-secret` cho tám edge function; chưa đặt secret thì chạy như cũ. Hiện thực: `bot_usage` + `bump_model_quota()`, `_shared/gate.ts`. | M | soát rate limit 27/08/2026 |
| FR-147 | ✅ **Leo thang cần-người-thật: CTV → admin.** Bật cờ → việc escalation gán CTV đang chăm đơn (chống báo lặp). Quá **30 phút** chưa ai gõ tay → việc thứ hai không gán CTV, rơi về admin, đánh dấu để không báo lại. Người thật vào chat thì cờ tự hạ và các nhắc đang chờ bị huỷ. Hiện thực: `nudge` + endpoint `human_note`. | M | yêu cầu chủ dự án 25/08/2026 |
| FR-148 | ✅ **Kho ảnh thật cho tin rao.** Ảnh nằm trên Supabase Storage, view `listing_photos_v` là cửa đọc chung cho web (ảnh bìa + gallery, chưa có thì rơi về ảnh minh hoạ) và cho bot (gộp ảnh kho, ưu tiên trước ảnh chủ gửi qua chat). Lối neo theo MÃ TIN và xếp theo tên file đã thay bằng FR-165 (UUID + `sort_order`). | M | yêu cầu chủ dự án 25/08/2026 |
| FR-149 | ✅ **Mọi báo cáo cuối đường về Zalo cá nhân admin.** Admin không dùng OA nữa: đích cuối của escalation (FR-140/147), cảnh báo trần (FR-146) và báo cáo CTV 17h (FR-137) là số Zalo trong `admins.zalo_phone`, không nằm trong code. Bridge kéo việc, resolve SĐT → uid, nhắn rồi ack; còn OA thì vẫn ưu tiên gửi thẳng. | M | yêu cầu chủ dự án 25/08/2026 |
| FR-150 | ✅ **Thiếu dữ liệu thì suy giảm êm, không chết lặng.** (a) Loại BĐS tự trích từ câu chữ, chỉ hỏi khi không đoán nổi; đoán không ra thì để giá trị thật `chua_ro` chứ không NULL ngầm, và trả lời vẫn không rõ thì hỏi lại kèm lựa chọn, tuyệt đối không ghi fact bừa. (b) Điều kiện lên web treo trên chính bảng `listings`. (c) Giá tính lại cả khi sửa. (d) Bridge resolve được uid thì ghi ngược vào hồ sơ. | M | soát cấu trúc dữ liệu + yêu cầu chủ dự án 26/08/2026 |
| FR-152 | ✅ **Sổ lỗi bền + nhịp tim bot.** (a) `bot_errors` + `bot_health` (admin đọc được). (b) Nhịp quét phản hồi HTTP, chép mọi cái không 2xx sang sổ, báo admin gộp một tin mỗi giờ. (c) Nhịp tim bridge, im quá 15 phút trong 7–22h thì ghi sổ. (d) Cửa ghi lỗi tầng ứng dụng `log_loi`/`ghiLoi` cho mọi `catch` — lỗi nguy nhất lại TRẢ 200. (e) Cảnh báo đi thẳng ntfy, không qua bridge. Sổ tự dọn sau 30 ngày. | M | soát cloud/compute 27/08/2026; soát 04/09/2026 |
| FR-153 | ✅ **Câu trả lời nhỏ giọt chảy ngược vào cột có cấu trúc.** Fact `so_phong_ngu`, `dien_tich*`, `tang`, `huong` đổ vào cột tương ứng của `listings` để web lọc được; cố ý KHÔNG đụng `description` vì câu rao gốc là văn phong người bán. Luật ghi đè theo bậc nguồn (FR-164) và câu mới nhất của chủ nhà thắng (FR-163). Hiện thực: trigger `listing_facts_sync_cols`. | S | yêu cầu chủ dự án 27/08/2026 |
| FR-154 | ✅ **Bóc giá tiếng lóng ra số VND.** `parse_vnd()` hiểu `tỏi`, `củ`, `rưỡi`, `5t5`, `6ty2`, `4ty` ngoài `tỷ/triệu/tr`. `price_raw` giữ NGUYÊN VĂN người rao, `price_vnd` chỉ là bản dịch máy đọc được nằm cạnh — bộ lọc giá của web đọc cột số. Cố ý KHÔNG quy `cây`/`lượng` vàng ra tiền (tỷ giá đổi mỗi ngày, ghi số vào là bịa). | M | yêu cầu chủ dự án 27/08/2026 |
| FR-155 | ✅ **Hạng người rao Đồng / Bạc / Vàng.** Tính TẠI CHỖ từ số tin, không lưu thành cột (cột không ai cập nhật sẽ đóng băng rồi nói dối). NMG: Vàng từ 10 tin đang rao và tỉ lệ chốt ≥5%, Bạc từ 5 tin hoặc ≥1 căn đã chốt. CCRB: Vàng khi đã chốt được căn, Bạc khi tin đủ thông tin lên sàn. View chỉ lộ tên + số đếm + hạng. Chưa: ngưỡng chốt cuối (OPEN-26). | S | yêu cầu chủ dự án 27/08/2026 |
| FR-156 | ✅ **Admin tự đăng tin theo nguồn** (`/admin/dang-tin`) cho tin không đi qua Zalo. Mọi trường chọn được là ô xổ xuống; giá gõ y như người rao nói và hiện ngay số máy đọc ra (gọi thẳng RPC, không chép luật sang JS); SĐT và Zalo mỗi cái một ô tích riêng — không tích thì không lưu. Chạy qua RPC tự kiểm quyền; trùng Zalo/SĐT thì dùng lại người bán cũ. | M | yêu cầu chủ dự án 27/08/2026 |
| FR-157 | ✅ **Neo hội thoại người bán theo CĂN, tách vai từng lượt.** (a) Câu hỏi đang chờ chọn theo độ tin cậy: mã tin chủ tự nhắc > căn bot vừa hỏi > câu mới nhất — trước đây fact của căn A ghi thẳng vào căn B mà không bao giờ tự lộ. (b) Neo đặt ở trigger DB vì câu hỏi sinh ra từ bốn đường. (c) Câu hỏi drip vắt vai mã căn + tên đường. (d) Có hồ sơ bán không có nghĩa cả đời chỉ được bán. | M | soát cấu trúc 27/08/2026; OPEN-22 |
| FR-158 | ✅ **Câu rao sinh mã tin ngay, cả hệ chỉ còn MỘT dãy mã.** (a) Cổng rao nhận cả ý định rao theo thứ tự từ ("muốn bán", "bán nhà") chứ không đòi phải có chi tiết — câu rao thật thà nhất từng bị trượt. (b) Một dãy `BDS-Q5-####` duy nhất cho thứ khách ĐỌC QUA ZALO. (c) Bộ sinh mã về DB (trigger + advisory lock) thay hai bản chép tay. | M | yêu cầu chủ dự án 27/08/2026 |
| FR-159 | ✅ **Phân vai bằng câu hỏi mở đầu, mặc định là người mua.** Người lạ không tự nhận có BĐS thì bot HỎI "muốn mua hay đang có bất động sản cần rao ạ?" (không gọi model); ai không nói rõ thì Ở LẠI hàng người mua vì đoán nhầm chiều đó rẻ hơn. Hồ sơ bán chỉ mở khi tự nhận có BĐS, và nhãn gán ngay lúc bóc tách: có nhà = chính chủ, chỉ ai tự xưng môi giới mới là NMG. Người đó và admin đều được báo nhãn + mức phí. | M | quyết định chủ dự án 27/08 và 02/09/2026 |
| FR-160 | ❌ **Từ 3 tin rao trở lên thì là môi giới.** Suy `seller_type` từ số tin đang rao thay vì lời tự khai. Chưa dựng: `seller_type` đang là thứ tính phí nên một chính chủ mở tin thứ ba là phí tự rơi một nửa — chờ OPEN-28 chốt phí trước. | M | quyết định chủ dự án 27/08/2026 |
| FR-161 | ✅ **Bot nghe được tiếng Việt KHÔNG DẤU ở mọi tầng cổng.** Chuẩn hoá bỏ dấu MỘT lần rồi khớp, không vá từng mẫu. Hai chế độ: tin có dấu đi bộ regex có dấu như cũ (dấu của người gõ là thông tin — "đang bàn" không phải "đang bán"), tin không dấu mới rơi về bộ đã bỏ dấu. Model luôn đọc chữ gốc; `description`/`price_raw` lưu nguyên văn. | M | quyết định chủ dự án 27/08/2026 (OPEN-29) |
| FR-162 | ✅ **Sổ idempotency cho tin đến.** Mỗi `zalo_msg_id` một vòng đời `received → processing → completed/failed/dead`. Retry cùng mã tin thì PHÁT LẠI y nguyên câu trả lời đã lưu, không gọi model và không đốt quota; hai bản sao đồng thời thì bên thua nhận `in_flight`, không trả lời đôi. Tách bốn danh tính: sự kiện inbound, tin logic, job xử lý, tin gửi ra; thứ tự tin tất định bằng `messages.seq`. | M | yêu cầu chủ dự án 27/08/2026 |
| FR-163 | ✅ **Toàn vẹn dữ liệu ở tầng DB.** Nguồn sự thật: `listings` = giá trị hiện hành, `listing_facts` = bằng chứng hội thoại append-only, `price_vnd` dẫn xuất từ `price_raw`. Bỏ anti-pattern "chỉ ghi khi NULL" — câu trả lời mới nhất của chủ nhà thắng; thêm ràng buộc chặn dữ liệu vô lý cho `deals`, `viewings`, `conversations`, và guard trạng thái kết cho `reminders`/`inbound_ledger`. | M | yêu cầu chủ dự án 28/08/2026 |
| FR-164 | ✅ **Đường ống dữ liệu tin rao — một nhà chức trách cho mỗi chặng.** Chặng chuẩn: bằng chứng → fact → chuẩn hoá → cột → đánh giá đủ tin → quyết định đăng. Bậc nguồn `chu_xac_nhan` > `admin` > `suy_doan` (lời chủ mà thua admin thì cả vòng drip vô nghĩa — treo OPEN-31). Một cửa ghi fact duy nhất, một quyết định đăng tin duy nhất trên `listings`, có cả đường HẠ kệ khi tin mất thông tin. | M | yêu cầu chủ dự án 28/08/2026 |
| FR-165 | ✅ **Kho ảnh neo vào ID bất biến, có bảng media thật.** Đường dẫn `listing-public/<listing_id>/<media_id>`, ràng bằng CHECK — neo theo mã tin thì đổi mã là ảnh rơi khỏi tin âm thầm. Bảng `listing_media` với khoá ngoại thật; hai bucket (công khai chỉ ảnh, riêng thêm PDF) và CHECK buộc giấy tờ nằm bucket riêng; thứ tự tất định + ảnh bìa do trigger giữ; xoá file qua hàng đợi thử lại được. | M | yêu cầu chủ dự án 29/08/2026 |
| FR-166 | ✅ **Việc chạy nền tin cậy.** Giữ ĐƯỜNG NHANH (webhook trả lời inline, độ trễ như cũ) và thêm ĐƯỜNG CỨU quét việc bỏ rơi mỗi phút — instance chết sau khi ack là tin khách mất vĩnh viễn, im lặng. Một luật lùi dần dùng chung cho ba hàng đợi, có trạng thái kết `dead` để không thử mãi; nhắc/nudge giành việc atomic để hai lượt chạy chồng không cùng gửi; đếm bong bóng đã gửi để không gửi đúp. | M | yêu cầu chủ dự án 29/08/2026 |
| FR-167 | ✅ **Soát bảo mật theo VAI THẬT.** Không đọc policy rồi suy diễn mà ĐÓNG VAI `anon`/`authenticated` thật rồi thử đọc/ghi/gọi. Bịt 6 lỗ, 3 khai thác được từ Internet: edge function không kiểm gì, `verify_jwt=true` chỉ đòi khoá công khai (nằm sẵn trong bundle JS), ảnh và mã của tin CHƯA ĐĂNG lộ qua bảng media và view. Bài học: gắn cổng cho một function thì phải liệt kê MỌI người gọi, kể cả trigger. Chưa: webhook Zalo chưa kiểm chữ ký (OPEN-33). | M | yêu cầu chủ dự án 29/08/2026 |
| FR-168 | ✅ **Chuông báo hết tiền tài khoản AI.** Hết credit thì bộ não câm hoàn toàn nhưng lỗi nằm lẫn giữa lỗi model thường ngày. Bắt bằng trigger trên sổ lỗi (không phải sửa edge function), ghi thẳng không qua van chống ngập (chuông bị van nuốt đúng lúc sổ đang ngập là vô dụng), không qua đường escalation (đường đó cũng có thể đang chết), tự hãm nhịp 6 giờ. | M | yêu cầu chủ dự án 01/09/2026 |
| FR-169 | ✅ **Đo tiền bộ não theo CHỮ.** Ghi số chữ vào/ra và chữ nhớ tạm cho mọi lượt gọi model, lưu số chữ chứ không lưu thành tiền (giá đổi thì sửa hằng số, số chữ đã ghi vẫn đúng mãi); admin đọc ở `/admin`. Cắt hai chỗ rò: nhịp nhớ tạm sai (lượt nào cũng trượt, mà trượt còn đắt hơn không dùng) và khối dự án cố định nằm nhầm nửa tính đủ giá. Nguyên tắc: tách hai nửa prompt theo GIÁ chứ không theo chủ đề. | M | yêu cầu chủ dự án 01/09/2026 |
| FR-170 | ✅ **Soát bóc dữ liệu theo bốn vai người nhắn.** Vá: người bán bị rẽ nhầm sang nhánh mua (5/7 câu chủ nhà thường nói); khoảng giá đọc sai ba cách nói rất thường ("5 tỷ 8" thành 5 tỷ, "từ 5 đến 6 tỷ" thành cận dưới); tin CHƯA ĐĂNG và ĐÃ GỠ lộ qua mã căn đoán được; mã căn viết thường sinh lịch xem thứ hai; ảnh kèm chú thích rơi mất; phí tính sai cho người bán chưa phân loại; và bốn lỗi nữa bắt được bằng cách bơm tin qua handler thật. | M | yêu cầu chủ dự án 01/09/2026 |
| FR-171 | ✅ **Tối ưu chi phí vận hành, không đổi hành vi với khách.** Bot chạy rỗ khi im (cron chỉ chạy giờ người, dọn sổ cron cũ, giữ cửa hàng đợi bằng đúng vị từ của hàm nhận việc); một tin khách nhắn tốn ít vòng DB hơn (nhớ tạm ở tầng module, gộp truy vấn `messages`, hậu kỳ chạy song song); chữ-máy gửi model ít đi (kho chỉ nạp khi hồ sơ đủ khu vực + giá, cắt fact và tin khách quá dài); web tải nhẹ hơn (chọn cột thay `select *`, gộp truy vấn `/admin`, ảnh lazy). Hạ tầng dùng chung: một cổng bí mật cho bảy function. Cố ý CHƯA làm vì đổi kiến trúc: gộp webhook vào bộ não (OPEN-34), thay lượt model của nhắc bằng mẫu câu (OPEN-35). | S | yêu cầu chủ dự án 02/09/2026; số đo `[giả định BA — đo trên DB thật + e2e]` |
| FR-172 | ✅ **Tin rao CÓ CẤU TRÚC chuẩn sàn.** Dữ liệu vốn có nhưng nằm trong một cục chữ: web không lọc được, bot đi "hỏi lại chủ nhà" thứ tin rao đã ghi, vòng drip hỏi lại đúng thứ chủ nhà vừa viết. (a) Thêm cụm cột thông số: đường vào và độ rộng hẻm, kích thước ngang/dài/nở hậu, DT công nhận/xây dựng, số tầng, WC, pháp lý, hoàn công, quy hoạch, thang máy, xe hơi vô nhà, căn góc, nội thất, năm xây, thương lượng, đang cho thuê, giá/m². (b) Bóc từ mô tả bằng luật, ghi nguồn `boc_mo_ta` (bậc thấp nhất). (c) Fact chủ nhà đè theo bậc nguồn FR-164. (d) Cột đã có thì bot KHÔNG hỏi lại. (e) Backfill toàn kho. (f) Web thêm bảng thông số + bộ lọc. Cố ý chưa: bóc bằng model (regex đã bắt 70–85%). | M | yêu cầu chủ dự án 02/09/2026; số đo `[giả định BA — đo trên DB thật]` |
| FR-173 | ✅ **Câu khách hỏi đi về CTV; CTV chậm thì rớt hạng và admin đỡ khách.** (a) Câu hỏi nguồn khách KHÔNG giao chủ nhà nữa mà giao CTV đang hoạt động ít việc nhất (không có CTV → admin); câu nhỏ giọt vẫn đi chủ nhà. (b) Nhắc CTV kèm mẫu trả lời `#mã tin: câu trả lời`, admin không bị báo mỗi câu. (c) Hạn **120 phút**, quá hạn thì báo admin đỡ khách đúng một lần. (d) CTV/admin nhắn theo mẫu thì bot ghi fact nguồn nội bộ, đóng câu hỏi và báo lại khách, không tốn lượt model. (e) Hạng CTV theo tỉ lệ trả lời đúng hạn 30 ngày: Vàng ≥90%, Bạc ≥70%, dưới 3 câu là chưa đủ dữ liệu. | M | quyết định chủ dự án 03/09/2026 |
| FR-174 | 🟡 **Địa bàn mở — Sài Gòn (phường mới) + Long An, trọng tâm bán.** Đợt 1 (xong): bot bóc quận/huyện từ chính câu rao thay vì ghi cứng "Quận 5", form admin và `/quan-ly` có ô quận/huyện, bot tự giới thiệu địa bàn mới, web nói đúng địa bàn; `/thong-ke` và danh sách phường vẫn theo kho thật. Mã tin `BDS-Q5-####` không đổi. Chưa (đợt 2, chờ OPEN-27 nửa sau): bảng `wards` một nguồn (tên mới ↔ cũ, quận cũ, tỉnh, toạ độ tâm) thay các danh sách phường và toạ độ ghi cứng, tag SEO theo khu vực mới, ánh xạ FR-118, drip hỏi phường theo địa bàn. | M | quyết định chủ dự án 03/09/2026 |

---

## 2.5 Yêu cầu phi chức năng

| ID | Loại | Yêu cầu | Đo bằng |
|---|---|---|---|
| NFR-01 | Hiệu năng | 🟡 Bot phản hồi tin nhắn thường < 3s (p95). Hiện thực: view `bot_do_tre` (p50/p95 7 ngày) trên `/admin`. Chưa: chưa chốt số đo trên lưu lượng thật. | Log; thẻ `/admin` |
| NFR-02 | Hiệu năng | 🟡 Trang listing/search LCP < 2.5s trên 4G. Hiện thực: ISR + chọn cột + ảnh lazy (FR-171 j). Chưa: chưa chạy Lighthouse. | Lighthouse ≥ 90 mobile |
| NFR-03 | Sẵn sàng | 🟡 Zalo OA phục vụ 24/7, uptime ≥ 99.5%. Hiện thực: nhịp tim bridge + sổ lỗi (FR-152). Chưa: chưa có công cụ đo uptime. | Monitoring |
| NFR-04 | Tin cậy | ✅ Tin nhắn **không được mất** khi một bên offline → hàng đợi bền. Hiện thực: sổ inbound + đường cứu mỗi phút (FR-162/166). | PDF hệ thống §5 |
| NFR-05 | Quy mô | 🟡 6 tháng đầu: ~10 chat mới/ngày, ~300 chat sống đồng thời, ~5.000 listing. Chưa: chưa chạm ngưỡng nên chưa đo tải thật. | BR-03, BR-01 |
| NFR-06 | Bảo mật | ✅ Ảnh sổ đỏ/giấy tờ lưu bucket riêng, admin xem bằng link ký hạn 15 phút; đường dẫn riêng không bao giờ ra trang công khai. Hiện thực: bucket `listing-private` + thẻ giấy tờ ở `/admin`. | RSK-07 |
| NFR-07 | Riêng tư | ✅ Không thu số ĐT của B ngoài bước đặt lịch xem nhà; cho phép ngắt kết nối bất cứ lúc nào. Hiện thực: `/admin` không đọc cột `phone`, câu cam kết trên web. | BR-06, FR-04 |
| NFR-08 | Riêng tư | ❌ Fingerprint chỉ dùng cá nhân hoá kết quả, có thông báo và cơ chế từ chối. Chưa: đi cùng FR-16 (OPEN-14). | FR-16 |
| NFR-09 | SEO | 🟡 100 URL tag render server-side, có canonical, sitemap, structured data. Hiện thực: 64 tag SSG + JSON-LD (FR-12/17). Chưa: bộ TOP-100 keyword (OPEN-06). | BR-08 |
| NFR-10 | i18n | ✅ Toàn bộ giao diện và nội dung chat: tiếng Việt, xưng hô anh/chị/em. | chats w B.docx |
| NFR-11 | Vận hành | 🟡 Mọi dữ liệu thống kê phải **kết nối được từ Excel** — không cần dashboard đẹp. Hiện thực: view + CSV ở `/admin`, đọc thẳng qua Table Editor. Chưa: xuất Excel phía server. | chats w B.docx §Thống kê |
| NFR-12 | Khả chuyển | 🟡 Tầng messaging trừu tượng hoá để thêm Messenger/Telegram mà không sửa lõi. Hiện thực: bộ não tách khỏi kênh (OA và bridge cùng gọi một cửa). Chưa: chưa có adapter kênh thứ ba. | RSK-02 |
| NFR-13 | Khả kiểm | ✅ Mọi sự kiện listing và hội thoại có timestamp, truy vết được. Hiện thực: `property_events`, `messages.seq`, sổ lỗi. | FR-70, FR-71 |
| NFR-14 | Chi phí | 🟡 Tổng chi phí build MVP ≤ 418tr VND. Hiện thực: hạ tầng còn ở bậc miễn phí (NFR-16). Chưa: chưa có số đo chi phí thực tế. | §1.4 |
| NFR-15 | Tuân thủ | ✅ Asset theme thương mại chỉ dùng trong phạm vi license đã mua (regular = 1 end product); không commit theme vào repo public. | OPEN-07 chốt 24/08/2026 |
| NFR-16 | Chi phí | ✅ **Free-tier trước, trả tiền sau**: mọi dịch vụ hạ tầng khởi đầu ở bậc miễn phí, chỉ nâng cấp khi chạm ngưỡng đo được và ghi lại ngưỡng trong docs. Ràng buộc kèm theo: bậc Free không có backup tự động (OPEN-25). | trao đổi chủ dự án 24/08/2026 |
| NFR-17 | Hiệu năng | ✅ **Trang tin phải nằm trong cache**, không hỏi DB từng lượt xem. Route động có tham số đường dẫn bắt buộc khai `generateStaticParams()`; route đọc `searchParams` thì bọc truy vấn trong Data Cache. Nghiệm thu: bảng route sau build hiện `●`/`○` cho trang tin. | soát cloud/compute 27/08/2026 |
| NFR-18 | Vận hành | ✅ **Xanh phải là xanh thật**: không dùng trạng thái của lớp xếp hàng thay cho kết quả thật của việc — `cron.job_run_details.status` không phải bằng chứng bot chạy được. Kết quả thật phải được quét và ghi vào sổ bền (FR-152). | soát cloud/compute 27/08/2026 |

## 2.6 Giả định

| ID | Giả định | Đổ vỡ nếu sai |
|---|---|---|
| ASM-01 | Zalo OA cho phép gửi tin chủ động ở tần suất cần cho FR-63, FR-64 | Toàn bộ chiến lược giữ chân sụp |
| ASM-02 | Zalo SSO khả dụng cho ứng dụng bên thứ ba của nhadat.cc | Phải làm OTP/đăng nhập riêng |
| ASM-03 | AI bóc tách địa chỉ Việt Nam (hẻm, ngã tư, mốc tiện ích) đạt độ chính xác dùng được | FR-92, FR-22 phải có người kiểm duyệt |
| ASM-04 | CCRB/NMG chịu trả lời câu hỏi bổ sung trong vài giờ | Vòng lặp INS-06 đứt, B mất kiên nhẫn |
| ASM-05 | Giao dịch được ghi nhận và thu phí ngoài hệ thống (thủ công, hợp đồng giấy) | Cần module hợp đồng/thanh toán, vượt ngân sách |
