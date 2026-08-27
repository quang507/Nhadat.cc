# 02 — Requirements

Quy ước: **M** = Must (MVP), **S** = Should (sau MVP), **C** = Could (backlog).
Mỗi FR truy được về nguồn và về `08-traceability.md`.

## 2.1 Mục tiêu kinh doanh

| ID | Mục tiêu | Đo bằng |
|---|---|---|
| BR-01 | Phủ 90% nguồn hàng mua/bán/thuê Quận 5 | Số listing active / ước lượng tổng thị trường |
| BR-02 | Xây mạng lưới 20 NMG chuyên Quận 5 | Số NMG active đạt chuẩn |
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
Facebook Messenger / Telegram · Đa ngôn ngữ · Mở rộng ngoài TP.HCM ·
Cổng NMG tự phục vụ đầy đủ (MVP dùng CTV vận hành thủ công).

---

## 2.4 Yêu cầu chức năng

### A. Website công khai (WEB)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-01 | Landing page giới thiệu dịch vụ theo phong cách whatsapp.com: mỗi mục một lợi ích + minh hoạ hội thoại | M | website.docx §Giới thiệu dịch vụ |
| FR-02 | Trang chủ có ô search dạng chat, placeholder là câu nói tự nhiên ("tìm mua nhà phố HXH 8 tỉ ở Q8") | M | website.docx §Search |
| FR-03 | Khối "Hỏi bất kỳ, có tức thì" minh hoạ vòng: B hỏi → hệ thống hỏi S → báo lại B | M | website.docx |
| FR-04 | Khối cam kết riêng tư: không hỏi số ĐT, chỉ liên hệ qua Zalo, ngắt kết nối bất cứ lúc nào | M | website.docx §Tụi em không hỏi số ĐT |
| FR-05 | Khối "Mất vài năm mới tìm được nhà?" — cam kết theo dõi dài hạn | M | website.docx |
| FR-06 | CTA "Bán hay cho thuê với nhadatCC?" dẫn sang mini-site S | M | website.docx |
| FR-07 | Trang listing: lưới card, mỗi card gồm ảnh, mô tả rút gọn, Vị trí, DT, Giá | M | website.docx §Listing |
| FR-08 | Trang kết quả tìm kiếm hiển thị "Tìm thấy N mục theo yêu cầu" + tiêu đề diễn giải lại truy vấn | M | website.docx §Search |
| FR-09 | Search hiểu ngôn ngữ tự nhiên: loại BĐS, quận/phường/đường/mốc, giá, HXH/MT, số PN, mua hay thuê | M | website.docx §Search; INS-07 |
| FR-10 | Trang chi tiết BĐS: gallery ảnh, mô tả đầy đủ, bảng thông số, bản đồ vị trí | M | website.docx §Chi tiết 1 BĐS |
| FR-11 | Trang chi tiết luôn hiển thị **cue**: "Khi Zalo nhớ hỏi #35148" | M | website.docx §Cue |
| FR-12 | Trang tag: 100 tag BĐS hot nhất Google, mỗi tag một URL tĩnh tối ưu SEO | M | website.docx §Tag |
| FR-13 | Hộp mời kết nối Zalo hiển thị ở trang chủ và mọi trang kết quả tìm kiếm | M | website.docx §Hộp mời kết nối |
| FR-14 | Khi click "Bắt đầu kết nối", chuyển sang Zalo OA **mang theo toàn bộ ngữ cảnh tìm kiếm** của phiên | M | website.docx §Hộp mời kết nối |
| FR-15 | Điều hướng nội bộ khuyến khích B xem 3–5 trang trước khi click sang Zalo | S | website.docx §Tăng cường SEO |
| FR-16 | Ghi nhận hành vi khách vãng lai bằng **fingerprint** để cá nhân hoá kết quả lần sau | S | PDF hệ thống §1 |
| FR-17 | Sitemap.xml, meta/OG tự sinh, structured data schema.org/RealEstateListing | M | BR-08 [giả định BA] |

### B. Zalo OA — phía mua (BOT)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-20 | Chào lần đầu: giới thiệu "30 nhà môi giới túc trực", xin tên để xưng hô | M | chats w B.docx §Chào hỏi |
| FR-21 | Chào khi gặp lại: nhắc lại tiêu chí lần trước và hỏi xác nhận còn đúng không | M | chats w B.docx §Nếu gặp lại |
| FR-22 | Nhận truy vấn theo vị trí ở mọi mức: quận, phường, đường, số hẻm, ngã tư, mốc tiện ích ("gần hồ bơi Lam Sơn"), hoặc "gần căn này" | M | chats w B.docx §Hỏi nhà quanh 1 vị trí |
| FR-23 | Nhận truy vấn giá: khoảng, dưới, trên, giữa hai mốc, hoặc "giá cỡ căn này quanh đây" | M | chats w B.docx §Hỏi giá |
| FR-24 | Trả tối đa **3 listing/tin nhắn**, kèm nút "Xem thêm" | M | chats w B.docx §Quận 5 / S's side.docx §Show a list |
| FR-25 | Mỗi listing trong chat: `#ID – mô tả 1 dòng – giá` | M | chats w B.docx |
| FR-26 | Khai thác nhu cầu sâu: "mua ở hay đầu tư?", nếu kinh doanh thì hỏi loại hình | M | chats w B.docx §Lấy thêm nhu cầu |
| FR-27 | Gửi ảnh theo yêu cầu, mỗi lần vài tấm, hỏi "chị xem thêm không?" | M | chats w B.docx §Khi chỉ gửi 1 số hình |
| FR-28 | Trả lời về tiện ích quanh BĐS (trường học, chợ, bệnh viện) kèm khoảng cách | S | chats w B.docx §Khi trả lời về tiện ích |
| FR-29 | Xử lý B vào từ quảng cáo với một mã BĐS cụ thể: chào đúng căn đó ngay | M | chats w B.docx §Hỏi đáp từ quảng cáo |
| FR-30 | Nhận ngữ cảnh tìm kiếm từ website khi B click hộp mời kết nối | M | website.docx; FR-14 |
| FR-31 | "Còn căn nào giống giống vầy không?" → gợi ý listing tương tự | S | chats w B.docx |
| FR-32 | Khi B im lặng sau một BĐS, **chủ động** gửi thêm thông tin không cần được hỏi | S | chats w B.docx §Khi khách hàng không hỏi gì thêm |

### C. Vòng hỏi-đáp bổ sung thông tin (ASK)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-40 | Khi AI không chắc chắn hoặc cần xác minh, **không đoán** — tạo một yêu cầu thông tin gửi S Side | M | chats w B.docx §Các thông tin cần hỏi S; RSK-03 |
| FR-41 | B Side gọi API S Side với: BĐS ID, Requested Info ID, nguyên văn câu hỏi của B | M | chats w B.docx §Gọi API về S side |
| FR-42 | S Side định tuyến câu hỏi tới: chủ tin (CCRB/NMG), hoặc CTV, hoặc chuyên viên | M | chats w B.docx |
| FR-43 | S Side gọi ngược API B Side với: Requested Info ID, nguyên văn trả lời, file/ảnh đính kèm | M | chats w B.docx |
| FR-44 | Câu trả lời của S **đồng thời cập nhật listing**, phục vụ mọi B sau đó | M | S's side.docx §Hỏi thêm thông tin từ S |
| FR-45 | Trong lúc chờ S, bot giữ nhịp hội thoại: "Trong khi chờ, chị có câu hỏi gì khác không ạ?" | M | S's side.docx |
| FR-46 | Nhóm câu hỏi chuẩn hoá: còn bán không · sổ đỏ · quy hoạch · kinh doanh được không · ảnh hẻm/khu vực · hoàn công | M | chats w B.docx |
| FR-47 | Có SLA cho yêu cầu thông tin; quá hạn thì escalate sang CTV rồi chuyên viên (mốc thời gian cụ thể: FR-110) | S | [giả định BA] |

### D. Đặt lịch xem nhà (VIEW)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-50 | B đề nghị xem nhà, hoặc bot chủ động đề nghị sau khi B tỏ ra quan tâm | M | chats w B.docx §Hẹn xem nhà |
| FR-51 | Bot xác nhận lại đúng căn (MS, địa chỉ, giá) trước khi chốt giờ | M | chats w B.docx |
| FR-52 | Thu thập khung giờ mong muốn; chốt lịch sau khi CTV/NMG xác nhận | M | chats w B.docx |
| FR-53 | Xin số điện thoại **chỉ tại bước này**, nêu rõ mục đích, cho phép từ chối | M | chats w B.docx; xung đột INS-04 → `OPEN-05` |
| FR-54 | Gửi link Google Maps ghim vị trí | M | chats w B.docx |
| FR-55 | Nhắc trước giờ hẹn (mẫu quan sát được: gọi trước 30 phút / nhắn sáng hôm đó) | M | chats w B.docx §Nhắc trước khi xem |
| FR-56 | Sau khi xem: hỏi cảm nhận; nếu không ưng thì **hỏi lý do** để tinh chỉnh tiêu chí | M | chats w B.docx §Không chịu xem nhà |
| FR-57 | Yêu cầu xem nhà sinh sự kiện + email `[VIEWING]` cho admin | M | chats w B.docx §Hẹn xem nhà (backend) |

### E. Giữ chân & tái kích hoạt (RET)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-60 | Follow-up trong vòng **3 ngày** sau khi kết thúc tương tác trước | M | chats w B.docx §Follow-up |
| FR-61 | Khi B im lặng quá lâu: hỏi về căn cuối cùng, mời xem ảnh, mời đặt lịch | M | chats w B.docx §Hỏi về căn nhà cuối cùng |
| FR-62 | Chào các căn khác cùng khu vực / cùng tầm giá để khởi động lại hội thoại | M | chats w B.docx §Chào những căn khác |
| FR-63 | **Job chống xoá kết nối Zalo**: trước mốc 7 ngày im lặng, gửi tin buộc B phải trả lời ("nhờ anh nhắn cho em 1 tin, nếu không Zalo sẽ xóa kết nối") | M | chats w B.docx §Trước khi Zalo xóa; RSK-01 |
| FR-64 | Khi có listing mới khớp tiêu chí đã lưu của B → thông báo chủ động | M | website.docx §Mất vài năm mới tìm được căn nhà |
| FR-65 | Xin đánh giá chất lượng ở 3 thời điểm: sau khi cấp thông tin một BĐS, sau một đợt tìm kiếm, sau khi xem nhà | S | chats w B.docx §Đánh giá chất lượng |

### F. Admin — buyer side (ADM)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-70 | Bảng **sự kiện BĐS**: timestamp, BĐS ID, loại sự kiện. Chỉ cần cách connect để xem ở Excel | M | chats w B.docx §Backend của B Side |
| FR-71 | Bảng **thống kê hội thoại**: B ID, timestamp, số tin của B, số tin của nhadat.cc, thời lượng | M | chats w B.docx §Thống kê cuộc trò chuyện |
| FR-72 | Định nghĩa cuộc trò chuyện: chuỗi tin nhắn cách nhau **không quá 30 phút** | M | chats w B.docx |
| FR-73 | Tính **BĐS hot nhất** = đếm số sự kiện trong 2 tháng gần nhất | M | chats w B.docx §BĐS 'hot' nhất |
| FR-74 | Tìm kiếm B: lọc theo tên Zalo, theo khoảng thời gian tiếp xúc lần đầu / lần cuối / một cuộc trò chuyện | M | chats w B.docx §Tìm kiếm B |
| FR-75 | Click từ kết quả để nhảy sang Zalo xem lịch sử hội thoại | M | chats w B.docx |
| FR-76 | Danh sách **câu hỏi của B chờ S trả lời**: B ID (clickable), BĐS ID, timestamp gọi API sang S, câu hỏi, timestamp S trả lời, nội dung trả lời | M | chats w B.docx §Các câu hỏi của B cần S trả lời |
| FR-77 | Danh sách **phản ứng tiêu cực**: timestamp, B ID, trích nguyên văn vài tin nhắn | M | chats w B.docx §Phản ứng tiêu cực |
| FR-78 | Danh sách **hẹn xem nhà**: timestamp, B ID, BĐS ID | M | chats w B.docx §Hẹn xem nhà |
| FR-79 | Danh sách **yêu cầu voice chat** | M | chats w B.docx §Khách hàng muốn voice chat |
| FR-80 | Mọi danh sách admin phân trang **20 mục/trang** | M | chats w B.docx |
| FR-81 | Email tới `admin.buyerside@nhadat.cc` cho mọi mục ở FR-76…79, subject `<loại> <Zalo ID>`, loại ∈ `[QUESTION] [VOICE] [VIEWING] [UPSET]`; body chứa các field, kèm mô tả BĐS nếu có BĐS ID | M | chats w B.docx §Email notification |

### G. Mini-site & luồng người bán (SEL)

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-90 | Mini-site rao bán/cho thuê riêng tại `nhadat.cc/raoban` | M | S's side.docx §Từ trang web nhadat.cc |
| FR-91 | S rao bằng **một câu rao thông thường**, không bắt điền form nhiều trường | M | S's side.docx; INS-05 |
| FR-92 | AI bóc tách trường từ câu rao: Vị trí, Đường/loại hẻm, Quy mô, Giá, mua/thuê | M | S's side.docx §Bóc tách trường |
| FR-93 | AI sinh nhiều biến thể câu rao: theo độ dài, theo khía cạnh B quan tâm (gần trường, gần tiện ích) | M | S's side.docx |
| FR-94 | Hiển thị bản đã bóc tách cho S xác nhận/chỉnh sửa trước khi đăng | M | PDF hệ thống §2 |
| FR-95 | Đăng nhập bằng **Zalo SSO** | M | PDF hệ thống §2 |
| FR-96 | Upload nhiều ảnh cho listing | M | PDF hệ thống §3 |
| FR-97 | `[deprecated — thay bằng FR-109]` Khi có người nhắn Zalo OA muốn bán, bot gửi link mini-site rao tin | — | S's side.docx §List new |
| FR-98 | S nhận và trả lời câu hỏi bổ sung (kể cả gửi ảnh, PDF sổ đỏ) ngay trong luồng chat | M | S's side.docx §Hỏi thêm thông tin từ S |
| FR-99 | Hỗ trợ định giá bằng cách so sánh nhanh với BĐS cạnh tranh trên thị trường | S | S's side.docx §Dịch vụ của nhadatCC cho S |
| FR-100 | URL "Show a list": tạo danh sách vài chục BĐS riêng cho một B, nhận User ID + danh sách BĐS ID | M | S's side.docx §Show a list |
| FR-101 | Phân loại S là CCRB hay NMG để áp đúng mức phí | M | biz model.docx |
| FR-102 | *[deprecated 27/08/2026 → FR-137]* Theo dõi tiêu chuẩn NMG: ≥10 listing, tỉ lệ thành công ≥5% (MA 6 tháng), rating >3/5. Phần chấm điểm đã nằm trọn trong báo cáo CTV 17h (FR-137, cùng rubric `RATE_CTV_RUBRIC`); đường thứ hai (`rate-ctv` + bảng `ratings`) đã xoá theo OPEN-23 — giữ hai đường chấm là nguồn lệch số | S | biz model.docx §NMG; chủ dự án chốt 27/08/2026 |
| FR-103 | Lời hứa "rao một lần là xong" với S: hệ thống theo đuổi việc bán tới khi gặp người mua phù hợp; chỉ liên hệ lại S khi cần xác minh thông tin hoặc chốt lịch xem — không spam S; tin không bị bỏ rơi (kết hợp `stale_listing_check`) | M | trao đổi chủ dự án 22/08/2026; INS-09 |

### H. Trung gian ẩn danh & vòng đời listing (BROKER)

Nguồn cả nhóm: [nguồn: artifact "Cầu Nối BĐS" v2, phiên nhadat-bot, 08/2026] — spec này thắng khi mâu thuẫn với các mục cũ.

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-104 | Ẩn danh hai chiều: B chỉ thấy mã listing + mô tả khu vực mức phường (không số nhà, không tên chủ); website hiển thị số điện thoại proxy; hai bên không bao giờ nhắn trực tiếp cho nhau | M | INS-11 |
| FR-105 | Lọc liên hệ: mọi tin nhắn relay qua kiểm tra SĐT / Zalo ID / địa chỉ chính xác trước khi chuyển; ảnh duyệt tay giai đoạn đầu | M | INS-11 |
| FR-106 | *[deprecated 25/08/2026 — thay bằng FR-139]* Vòng đời listing bản cũ (tiếng Anh): draft → pending_review (admin duyệt) → active → negotiating → sold / expired. FR-139 thay bằng 5 trạng thái tiếng Việt (`cho_thong_tin` → `dang_ban` → `dang_quan_tam` → `da_chot`, `an`) và bỏ bước duyệt tay; type enum `listing_status` cũ đã DROP khỏi DB 25/08 | M | Cầu Nối §Vòng đời |
| FR-107 | TTL xác nhận 7 ngày (`last_confirmed_at`): trong hạn giới thiệu ngay không hỏi S; quá hạn phải xác nhận "còn bán không" với S trước khi giới thiệu cho B mới | M | Cầu Nối §F2 |
| FR-108 | Bảng interests: ghi B nào đang quan tâm căn nào; khi listing chuyển sold, chủ động báo mọi B đang chờ kèm gợi ý căn thay thế | M | Cầu Nối §F2 |
| FR-109 | Rao tin từng bước ngay trong Zalo (khu vực → loại → giá → DT → pháp lý → mô tả → ảnh); khu vực không khớp danh mục chuẩn thì đưa lựa chọn quận/phường; mini-site /raoban là kênh song song trên web | M | Cầu Nối §F1; thay FR-97 |
| FR-110 | Timeout hỏi S: nhắc 1 lần sau 24h; quá 48h đóng yêu cầu (expired) và báo trung thực cho B kèm gợi ý căn khác | M | Cầu Nối §F3 |
| FR-111 | Ảnh từ Zalo là URL tạm: tải về ngay, đẩy lên kho file qua adapter, DB chỉ lưu tham chiếu (kho file thay được không đụng logic bot — xem OPEN-18) | M | Cầu Nối §Kiến trúc |
| FR-112 | Điểm sao từng tương tác ghi vào hồ sơ người dùng; bảng deals ghi giao dịch thành công làm căn cứ tính phí (CCRB 1% — CTV hưởng 0.5%; NMG 0.5%) và tỉ lệ chốt 5% của NMG | M | Cầu Nối §F4; chốt OPEN-16 phương án (b) |

### I. Hàng dự án (PROJECT)

Nguồn cả nhóm: chốt `OPEN-15` phương án (b), chủ dự án 24/08/2026; phân tích `INS-10`.
Phạm vi MVP: **đặt nền dữ liệu**, chưa làm UI giỏ hàng riêng.

| ID | Yêu cầu | Ưu tiên | Nguồn |
|---|---|---|---|
| FR-113 | Data model dự án: bảng `projects` (tên, slug, chủ đầu tư, vị trí, pháp lý dự án, tiện ích, mặt bằng, tiến độ) + liên kết trên listing: `project_id` (null với hàng lẻ), `unit_code` ("50", "A-12.07"), `floor`, `direction`, `unit_status` ∈ {còn bán, giữ chỗ, đã cọc, đã bán} | M | OPEN-15 (b); INS-10 |
| FR-114 | Trong luồng rao (Zalo từng bước FR-109 hoặc `/raoban`), S/CTV gắn được tin vào dự án: chọn dự án có sẵn + nhập mã căn; không thuộc dự án thì bỏ qua — tin là hàng lẻ | M | OPEN-15 (b) |
| FR-115 | Bot trả lời câu hỏi **tầng dự án** (vị trí, chủ đầu tư, pháp lý dự án, tiện ích, tiến độ) từ dữ liệu chung của dự án, KHÔNG tạo info_request; vòng hỏi-đáp INS-06 chỉ dành cho dữ liệu tầng căn | M | INS-10 |
| FR-116 | "Căn X của dự án Y còn không?" → đọc `unit_status`; quá TTL xác nhận (FR-107) thì xác nhận lại với S trước khi khẳng định; căn chuyển đã bán → báo mọi B đang chờ (interests, FR-108) kèm gợi ý căn thay thế **cùng dự án** | M | INS-10; Cầu Nối §F2 |
| FR-117 | Trang dự án `/du-an/{slug}` + màn quản lý giỏ hàng cho admin/NMG — **giai đoạn 2**, ngoài phạm vi MVP | S | OPEN-15 (b) |
| FR-118 | Địa giới hành chính dùng **bản cũ trước sáp nhập 1/7/2025** làm trục chính (Quận 5, phường cũ) trên toàn hệ thống: URL, taxonomy, chat. Bảng ánh xạ `ward_mapping` (phường cũ ↔ phường mới theo NQ 202/2025/QH15) để: (a) bot hiểu cả hai cách gọi và quy về một khu vực, (b) hiển thị kèm tên mới khi nói chuyện pháp lý/sổ đỏ, (c) nội dung SEO tra cứu cũ↔mới | M | INS-12; quyết định chủ dự án 24/08/2026 |
| FR-119 | Máy tính lãi vay `/tinh-lai-vay`: trả góp đều (annuity), nhập giá/trả trước/lãi suất/thời hạn, biểu đồ dư nợ; nhận `?price=` từ trang chi tiết tin; kèm ghi chú "chỉ tham khảo, không phải đề nghị cho vay" | M | OPEN-19 chốt (b) 25/08/2026; port từ repo NhaDat-Radar của chủ dự án |
| FR-120 | Trang `/thong-ke`: giá rao trung bình mỗi m² theo phường Quận 5 tính từ listing thật đang rao; phường dưới 2 tin không hiển thị; ghi rõ là giá rao, không phải giá chốt (tránh RSK-03) | S | port từ NhaDat-Radar |
| FR-121 | Lưu tin yêu thích **không cần tài khoản** (localStorage trình duyệt), nút tim trên card/chi tiết, xem lại ở `/yeu-thich`; muốn nhớ dài hạn đa thiết bị → đẩy sang chat Zalo | S | INS-04 (không bắt đăng ký); port từ NhaDat-Radar |
| FR-122 | Bản đồ `/ban-do` (Leaflet + OpenStreetMap): chấm theo **toạ độ geocode từ địa chỉ trên tin** (Nominatim, cache theo đường); thiếu toạ độ thì rơi về tâm phường + jitter. *[cập nhật 25/08 — chủ dự án chốt: địa chỉ trên tin vốn chỉ tới mức đường/hẻm nên chấm đúng không phá ẩn danh FR-104; số nhà cụ thể vẫn chỉ chia sẻ khi hẹn xem]* | S | port từ NhaDat-Radar |
| FR-123 | Bộ lọc danh sách: khoảng giá (bậc theo loại giao dịch), khoảng diện tích, sắp xếp (mới nhất / giá tăng / giá giảm / DT lớn) — dạng link thuần giữ được URL chia sẻ; lọc số phòng ngủ chờ dữ liệu có cấu trúc từ `listing_facts` | M | port từ NhaDat-Radar |
| FR-124 | Tài khoản **chỉ cho NMG**: đăng nhập magic-link email `/dang-nhap`, dashboard `/quan-ly` xem tin của mình + đăng tin bằng MỘT câu rao (đúng INS-05) → status `cho_thong_tin`, đủ giá + diện tích + phường thì tự lên web (FR-139). CCRB không cần tài khoản (Zalo/token FR-100 giữ nguyên); buyer tuyệt đối không tài khoản | S | port từ NhaDat-Radar; bổ trợ FR-100/SRS-4.3 |
| FR-125 | Trang `/moi-gioi` công khai mạng lưới NMG: tên + số tin đang rao + điểm trung bình (qua view `agents_public`, không lộ liên hệ) + khối tuyển NMG nêu chuẩn chất lượng | S | port từ NhaDat-Radar; BR-02 |
| FR-126 | Tài khoản **người mua tự nguyện** (Google OAuth / magic-link): trang `/tai-khoan` với tin đã xem gần đây (localStorage + đồng bộ `listing_views` khi đăng nhập), khuyến nghị cùng khu + tầm giá quanh tin xem gần nhất, hồ sơ tên/SĐT **không bắt buộc** kèm cam kết "chỉ để CTV gọi xác nhận lịch xem, không chào hàng, xoá được". Luồng Zalo vẫn không hỏi số (BR-06 giữ nguyên ở kênh chat) | S | quyết định chủ dự án 25/08/2026 — chấp nhận nới BR-06 ở kênh web dạng opt-in |
| FR-127 | Trang `/admin` duyệt tin trên web: danh sách `cho_thong_tin` → Duyệt (`dang_ban`) / Ẩn (`an`) theo FR-139, số liệu tổng quan; quyền theo bảng `admins` (email) + RLS `listings_admin_*` — bổ trợ WF-12 (admin email hiện có) | S | quyết định chủ dự án 25/08/2026 |
| FR-128 | Cột `listings.bedrooms` + lọc "N+ phòng ngủ" trong danh sách; backfill bằng regex từ mô tả (79/173 tin), phần còn lại do bot bóc tách khi hỏi S (INS-06) | S | hoàn thiện FR-123 |
| FR-129 | **Hỏi nhỏ giọt người bán**: đăng tin xong bot chào + hỏi ĐÚNG MỘT thông tin thiếu ưu tiên nhất; S trả lời → lưu `listing_facts`, đóng câu hỏi, hỏi câu kế trong cùng phiên chat; S im lặng → cron 30 phút nhắc theo nhịp với trần chống spam (không hỏi khi còn câu chờ, ≤3 câu/24h/tin, ≤10 tin/nhịp, **≤2 căn/24h mỗi seller**, chỉ tin <7 ngày hoặc seller có kênh Zalo). Văn phong theo kịch bản người bán §6.8 (06): khen trước — hỏi sau, ~30 từ, lý do vì-khách. *[cập nhật 25/08 — chưng cất AOND req + chat examples.docx]* Bổ trợ FR-109/FR-40…47 | M | quyết định chủ dự án 25/08/2026; INS-06, INS-09; AOND SRD §VI |
| FR-130 | **Khai thác nhu cầu người mua nhỏ giọt, giống người**: bot duy trì hồ sơ nhu cầu tích luỹ trong `buyers.preferences` (mua/thuê, khu vực, khoảng giá, mục đích ở/kinh doanh, loại hình, số PN, hẻm/mặt tiền, thời điểm cần) — bóc tách tự động sau mỗi tin của B, **không hỏi lại điều đã biết**, gặp lại nhắc đúng nhu cầu cũ; hỏi các tiêu chí còn thiếu theo thứ tự UF-04 (khu vực + khoảng giá trước, chưa đủ thì chưa gợi ý căn) — **được gộp 2-3 ý vào một câu hỏi liền mạch**, không ép mỗi lượt một câu và cũng không liệt kê thành bảng hỏi *[cập nhật 25/08]*; trả lời trước — hỏi sau; **đủ khu vực + tầm giá thì NGỪNG dò hồ sơ** — 5 tiêu chí còn lại chỉ nhặt khi khách tự kể hoặc hỏi lại đúng một câu khi khách chê căn vừa gửi *[cập nhật 25/08 theo phản hồi "bot hỏi liên tục à, khi nào nó để khách yên"]*; bot đã hỏi 2 lượt liên tiếp thì lượt kế đưa giá trị (gợi ý căn khớp hồ sơ) thay vì hỏi tiếp; trả lời được tách tối đa 2 bong bóng ngắn, gửi lần lượt như người nhắn tay | M | quyết định chủ dự án 25/08/2026 "bên mua cũng hỏi từ từ… giống con người nhất có thể"; UF-04, chưng cất `chats w B.docx` |
| FR-131 | **Gộp tin nhắn gõ vụn**: khách hay gõ 3–4 tin liên tiếp ("tìm nhà" / "quận 10" / "tầm 2 tỷ") — **KHÔNG delay nhân tạo** *[chốt 25/08: "càng nhanh càng tốt", bỏ hẳn debounce lẫn typing giả]*: bot xử lý ngay; có tin mới hơn của cùng khách vào trong lúc xử lý thì nhường lượt (không trả lời), chỉ lượt của tin cuối chùm trả lời trên toàn bộ ngữ cảnh gộp → MỘT câu trả lời duy nhất thay vì 3 câu chồng nhau. Kèm chống đua tạo trùng buyer/conversation khi tin đến đồng thời (advisory lock theo `zalo_user_id`) | M | quyết định chủ dự án 25/08/2026; bổ trợ FR-130 |
| FR-132 | **Kho dự án + ưu tiên dự án đang phân phối**: bảng `projects` chứa (a) **Ny'ah Phú Định** (nguồn AOND — CĐT Nhã Đạt, 50 căn khu biệt lập P16 Q8, mẫu nhà + danh mục lô + quy cách bàn giao; `priority=1`, `is_partner=true` vì chủ dự án đang trực tiếp bán) và (b) ~458 dự án cào từ mogi.vn (qua crawler NhaDat-Radar, nguồn `mogi`). Bot trả lời **tầng dự án** trực tiếp từ kho (thực thi FR-115): vị trí/CĐT/pháp lý/tiện ích/mẫu nhà — không tạo info_request; GIÁ từng căn không nằm trong kho, bot phải nói "để em kiểm tra rồi báo"; Ny'ah được chủ động giới thiệu MỘT lần khi khách hợp nhu cầu, không lặp khi khách từ chối | M | quyết định chủ dự án 25/08/2026 "dự án Ny'ah nằm trên cùng vì tao đang bán"; INS-10, FR-113…115. *[cập nhật 25/08: chủ dự án chốt xoá seed mogi khỏi DB — kho chỉ giữ Ny'ah, dữ liệu CĐT khác nạp dần khi rao; cơ chế nạp (pg_net + upsert theo slug, nguồn `radanhadat-scrape/mogi-hcm-du-an`) giữ ở code]* |
| FR-133 | **Nhắc hẹn + hỏi thăm khi im lặng**: (a) B/S hứa "chiều/mai/tối gửi ảnh, báo lại…" → bot cảm ơn, không hỏi dồn, hệ thống đặt hẹn (`reminders`, giờ VN) và tới hẹn nhắc khéo MỘT tin không trách móc; người ta nhắn lại trước hẹn thì hủy nhắc; (b) buyer im lặng **5-6 ngày** → hỏi thăm 1-2 câu, **kịch bản đa dạng** (4 góc chọn ngẫu nhiên + tránh lặp 2 tin bot gần nhất), tối đa 1 lần/5 ngày/người — nhắc TRƯỚC mốc Zalo xoá kết nối 7 ngày (INS-03, thực thi FR-63 phía bot). Cron `nudge-tick` 30 phút. *[cập nhật 25/08: mọi tin chủ động chỉ gửi trong **8h–21h giờ VN** (ngoài cửa sổ dời sang nhịp sau), xê dịch 0–45 giây cho khỏi đúng boong :00/:30]* | M | quyết định chủ dự án 25/08/2026; INS-03, FR-63; giờ giấc: khuyến nghị BA 25/08 được chủ dự án duyệt ("giờ giấc gửi sửa luôn") |
| FR-134 | **Bot đọc ảnh khách gửi (vision)**: khách gửi ảnh qua Zalo → webhook/bridge chuyển `image_url` vào bộ não; bot mô tả trung thực điều thấy được, đoán thì nói "hình như là…" và xác nhận lại, KHÔNG suy diễn vật liệu/pháp lý từ ảnh; ảnh được ghi vết trong `messages` dạng `[ảnh: url]`. Voice/STT chưa làm (cần dịch vụ STT ngoài) | S | quyết định chủ dự án 25/08/2026 ("sửa theo các khuyến nghị"); AOND có pipeline vision tương đương |
| FR-135 | **Cờ cần người thật**: bot tự bật `need_human` khi khách đòi gặp người thật/quản lý, bức xúc thật sự, đàm phán giá hồi kết, hoặc "để em hỏi lại" lặp 2 lần cùng một chuyện → `conversations.needs_human=true` + trả lời "để em nhờ anh/chị phụ trách khu này nhắn lại liền"; đơn chờ tiếp quản hiện trong báo cáo CTV (FR-137). Không bật vì câu hỏi khó thường ngày | M | quyết định chủ dự án 25/08/2026; hướng Live Chat Monitor của AOND (bản tối thiểu: cờ, chưa có UI cướp quyền) |
| FR-136 | **CRM CTV — chia đơn xoay vòng**: bảng `ctvs` (~2 cộng tác viên, bật/tắt bằng cờ `active`); mỗi conversation khi tạo được gán CTV bằng trigger round-robin (người đang ôm ít đơn hoạt-động-30-ngày nhất nhận đơn mới, hoà thì ai nhận cũ nhất nhận trước); "đơn" = hội thoại người mua mà CTV chịu trách nhiệm chăm (gọi xác nhận lịch xem FR-53, tiếp quản needs_human FR-135) | M | yêu cầu chủ dự án 25/08/2026 "2 người làm cộng tác viên… dùng 2 repo đã gửi để xoay vòng" |
| FR-137 | **Báo cáo CTV 17h mỗi ngày về Zalo admin**: cron 17h VN tổng hợp per-CTV — số đơn đang chăm (hoạt động 30 ngày), đơn tương tác hôm nay kèm nhu cầu, lịch xem sắp tới, số đơn chờ người thật — và **chấm điểm chăm khách** bằng rubric 4 tiêu chí (lễ phép / đúng luật hỏi / hiểu BĐS / chăm khách, tối đa 3 hội thoại gần nhất mỗi CTV); gửi MỘT tin về Zalo cá nhân admin (secret `ZALO_ADMIN_ZALO_ID` qua OA API), lưu `ctv_daily_reports` chống gửi đôi; chưa cấu hình OA thì chỉ lưu bảng | M | yêu cầu chủ dự án 25/08/2026 "có chấm điểm và gửi điểm vào zalo chính của admin vào 17 giờ mỗi ngày" |
| FR-138 | **Cấu hình "não" bot không cần deploy**: bảng `bot_prompts` (key/content) chứa văn phong, luật phí, nhịp nhắn, kịch bản người bán, từ điển lóng, few-shot, rubric chấm CTV — đè lên mặc định trong code; chủ dự án sửa content ở Supabase Table Editor là bot đổi ngay lượt sau. Không có dòng thì dùng bản trong `_shared/prompts.ts` (dự phòng) | M | yêu cầu chủ dự án 25/08/2026 "tao vào cấu hình luôn"; hướng admin-configurable prompt của AOND SRD |
| FR-139 | **Vòng đời tin theo trạng thái tiếng Việt**: `cho_thong_tin` (chờ đủ thông tin — thiếu giá/diện tích/phường, ẩn khỏi web) → `dang_ban` (đủ thông tin, tự lên web bằng trigger khi UPDATE đủ 3 trường) → `dang_quan_tam` (khách hỏi/bot giới thiệu căn đó — RPC `mark_listing_interest` gọi từ chat-reply, bám theo **mã căn**; badge 🔥 trên web) → `da_chot` (đã chốt — bot báo thật với khách + gợi ý căn tương tự, web hiện banner); thêm `an` (gỡ tay). Cron mỗi đêm: 7 ngày không ai hỏi thì `dang_quan_tam` tự về `dang_ban`. Giá trị cũ (unverified/active/sold/expired) được trigger dịch tự động | M | yêu cầu chủ dự án 25/08/2026 "các trạng thái… thêm vào, và các trigger khi khách hỏi" |
| FR-140 | **Fallback hỏi-chủ-nhà → CTV → admin**: bot hứa "để em hỏi lại chủ nhà" (trường `ask_owner` trong BuyerTurn) → tạo `info_requests` (source `buyer_ask`, chống trùng 24h/căn); trigger DB định tuyến: tin có chính chủ (seller có Zalo) → giao seller (luồng hỏi nhỏ giọt FR-129); không có → giao CTV còn-liên-lạc-được ít việc nhất; không có CTV → giao admin phụ trách. Giao CTV/admin thì sinh reminder `escalation` — `nudge` gửi qua OA, chưa có OA thì bridge acc clone kéo qua `escalation-feed` (resolve SĐT → uid Zalo) rồi ack. SĐT/Zalo admin cấu hình trong bảng `admins` (cột `zalo_phone`/`zalo_user_id`), không nằm trong code | M | yêu cầu chủ dự án 25/08/2026 "không có chính chủ rao bán thì fallback về cộng tác viên, không có CTV thì fallback về admin phụ trách" |
| FR-141 | **Người thật chăm thì bot nhường sân**: CTV/admin gõ tay từ acc Zalo (bridge phân biệt tin đi ra không phải bot vừa gửi) → hệ thống ghi tin `sender='human'` + `conversations.human_touch_at`; trong **30 phút** kể từ đó bot chỉ ghi log tin khách, không trả lời chen ngang; người thật ngừng đủ lâu thì bot tự tiếp chuyện lại (thấy cả nội dung người thật đã nhắn trong ngữ cảnh, "hỏi thêm tí" theo nhịp thường) | M | yêu cầu chủ dự án 25/08/2026 "để CTV chat xong bot hỏi thêm tí cũng được" |
| FR-142 | **Chốt giao dịch theo tín hiệu đồng ý**: tin trước của bot/CTV có đề nghị chốt hợp đồng/cọc và khách ĐỒNG Ý — bằng chữ ("ok", "chốt đi"…), emoji vui, like/tim, sticker — thì hệ thống tự: ghi `deals` (giá theo tin, phí 1% CCRB / 0.5% NMG), chuyển tin sang `da_chot` (FR-139), báo gấp CTV/admin qua kênh escalation. Đồng ý lịch xem nhà cũng nhận cùng bộ tín hiệu (điền viewing). Bộ tín hiệu cấu hình được ở `bot_prompts` key `agree_rules`; chống ghi trùng deal theo cặp căn+khách | M | yêu cầu chủ dự án 25/08/2026 "khách đồng ý theo nhiều kiểu… gửi icon vui vẻ hoặc like tim thì đồng ý" |
| FR-143 | **Bot gửi hình thật cho khách**: nguồn hình = URL chính chủ đã gửi qua chat (facts `hinh_anh`); khối căn-đang-nhắc báo model "CÓ N HÌNH SẴN" → model điền `send_photos` (khách xin hình mà model quên thì hệ thống tự đính kèm theo mã khách nhắc, tối đa 4 hình); response trả mảng `photos`, bridge tải về gửi dạng ảnh đính kèm, OA gửi dạng media template. Căn chưa có hình thì đi đường hỏi-chủ-nhà FR-140. Kho `media` (OneDrive, OPEN-18) chưa dùng được cho tới khi có pipeline upload | M | yêu cầu chủ dự án 25/08/2026 "cần làm gấp rồi test đi" |
| FR-144 | **Vòng thu thập thông tin chính chủ trọn đời tin**: (a) chính chủ nhắn câu rao mới (bán/cho thuê + loại BĐS + giá/diện tích/phường) → bot tự tạo tin nháp `cho_thong_tin` (deal/phường/giá bóc bằng regex, loại BĐS do trigger DB tự điền theo FR-150) + hỏi ngay MỘT câu thiếu ưu tiên nhất; (b) mỗi câu trả lời lưu fact, riêng diện tích đồng bộ vào `listings.area_m2` để trigger auto-publish FR-139 chạy; (c) tin **đủ để đăng** (tự nhảy `dang_ban`) → NGỪNG hỏi, báo "tin đã lên web"; (d) khách quan tâm hỏi thêm → FR-140 tạo yêu cầu, định tuyến seller sinh escalation → nudge (OA) hoặc bridge chủ động nhắn chính chủ xin bổ sung; (e) drip ask-seller một-câu-một-lúc: đang có câu pending thì nhịp cron bỏ qua, không hỏi chồng | M | yêu cầu chủ dự án 25/08/2026 "hỏi đến khi đủ đăng, để ở đó đến khi khách quan tâm thì trigger hỏi thêm, cấu hình đường này" |
| FR-145 | **Widget Zalo trên web**: nút nổi góc TRÁI dưới trên mọi trang (vị trí widget chat quen thuộc), bấm mở chat Zalo (acc clone trong lúc chờ OA — link cấu hình một chỗ `ZALO_OA_URL`/env `NEXT_PUBLIC_ZALO_URL`); riêng trang chi tiết căn `/nha-dat/[code]` ẨN widget nổi, thay bằng nút "Chat Zalo về căn này" mang ngữ cảnh nằm trong bài (đã có từ FR-13/14) | M | yêu cầu chủ dự án 25/08/2026 "widget góc trái bên dưới… vào xem từng căn thì bỏ widget, thêm nút trong sản phẩm" |
| FR-146 | **Trần 100 tin/24h mỗi khách**: đếm tin `sender='buyer'` của một hội thoại trong 24 giờ trượt; vượt 100 thì bot gửi ĐÚNG MỘT tin báo "để em nhờ anh/chị phụ trách nhắn lại trực tiếp", bật `needs_human` và sinh reminder `escalation` (gán CTV đang chăm đơn); các tin sau trong cùng 24h bị bỏ qua im lặng, không tốn lượt model. Mục đích kép: chặn người lấy anon key gọi thẳng edge function đốt tiền model, và chuyển khách nhắn quá nhiều sang người thật | M | yêu cầu chủ dự án 25/08/2026 "rate limit 100 câu" |
| FR-151 | **Hai cổng chặn đốt tiền model** (soát 27/08/2026 phát hiện FR-146 KHÔNG chặn được kẻ cố ý). **(a) Trần TOÀN CỤC theo ngày**: bảng `bot_usage` + RPC `bump_model_quota(p_limit)` đếm mọi lượt vào bộ não, vượt trần thì trả 429 và im hẳn, đồng thời báo admin ĐÚNG MỘT LẦN trong ngày. Trần chỉnh bằng secret `DAILY_MODEL_CALL_CAP` (Vault), mặc định 1000/ngày. **(b) Bí mật dùng chung**: đặt `BRIDGE_SECRET` trong Vault thì `chat-reply` chỉ nhận request kèm header `x-bridge-secret` khớp, hoặc request mang service_role key (zalo-webhook). Chưa đặt secret thì chạy như cũ — bật được mà không làm gãy bridge đang chạy. Cùng khuôn với cổng sẵn có của `escalation-feed` | M | soát rate limit 27/08/2026 |
| FR-147 | **Leo thang cần-người-thật: CTV → admin**: model bật `need_human` (hoặc chạm trần FR-146) → đặt `conversations.needs_human/needs_human_at` + reminder `escalation` gán **CTV đang chăm đơn** (chống báo lặp: đã có escalation pending cho khách này thì thôi). Quá **30 phút** chưa ai gõ tay (`human_touch_at` cũ hơn `needs_human_at`) → nhịp `nudge` sinh reminder `escalation` thứ hai **không gán CTV** → rơi về admin, và đánh dấu `conversations.human_escalated_at` để không báo lại. Người thật vào chat (FR-141) thì `human_note` tự hạ cờ `needs_human` và huỷ các nhắc escalation đang chờ | M | yêu cầu chủ dự án 25/08/2026 "cần người thật cũng báo theo thứ tự là báo cho CTV rồi báo cho admin" |
| FR-148 | **Kho ảnh thật theo mã bất động sản**: ảnh nằm trên Supabase Storage, bucket công khai `listing-photos`, đường dẫn `<mã tin>/<tên file>` (vd `BDS-Q5-0164/01.jpg`) — chủ dự án tự up qua giao diện Storage, không cần code. View `public.listing_photos_v` (mã, url, path) là cửa đọc chung: web lấy ảnh bìa cho thẻ listing và gallery cho trang chi tiết (tin chưa có ảnh thì rơi về ảnh minh hoạ); bot gộp ảnh kho (ưu tiên) với URL chính chủ gửi qua chat khi trả `photos` cho FR-143. Thứ tự ảnh = thứ tự tên file | M | yêu cầu chủ dự án 25/08/2026 "ảnh cần nằm trên DB để tao up lên, cứ đi theo mã số bất động sản thôi" |
| FR-149 | **Mọi báo cáo cuối đường về Zalo cá nhân admin, không qua OA**: admin không dùng Zalo OA nữa — đích cuối của escalation (FR-140/147), cảnh báo trần (FR-146) và báo cáo CTV 17h (FR-137) là **số Zalo cá nhân admin** lưu trong bảng `admins.zalo_phone` (không nằm trong code, không lên repo). `ctv-report` đẩy báo cáo vào `reminders` kind `report`; `escalation-feed` phục vụ cả `escalation` lẫn `report` (báo cáo gửi NGUYÊN VĂN, không bọc lời chào); bridge acc clone kéo về, resolve SĐT → uid Zalo, nhắn rồi ack. Còn OA hoạt động thì vẫn ưu tiên gửi thẳng qua OA | M | yêu cầu chủ dự án 25/08/2026 "admin sẽ không có Zalo OA nữa mà DM vào số admin, các công đoạn cuối cứ báo cáo hết vào số này, báo cáo cũng gửi về Zalo này" |
| FR-150 | **Thiếu dữ liệu thì suy giảm êm, không chết lặng**: (a) loại BĐS **tự trích xuất từ câu chữ, chỉ hỏi khi không đoán nổi**: hàm DB `guess_property_type(text)` đọc `description` + `location_raw` (xét theo độ đặc trưng, nhánh `dat` có guard phủ định trệt/lầu/tầng/PN/WC vì tin NHÀ rất hay ghi "DT **đất** 25.5m²"), trigger `trg_listings_fill_property_type` (BEFORE INSERT OR UPDATE OF `description`, `location_raw`, `property_type`) tự điền khi cột còn trống hoặc `chua_ro` — mọi đường tạo tin (chat FR-144, `/quan-ly`, import) đều được lấp miễn phí, kho 173 tin backfill đoán ra 164. Tin nào câu chữ thật sự không đủ thì nằm lại giá trị THẬT `chua_ro` (không phải NULL ngầm) và mới bị hỏi `loai_bds` (`required_facts.chua_ro → loai_bds`); trả lời xong `chat-reply` gọi `guess_property_type_answer()` (cùng họ, nhận cả từ cụt "đất"/"trọ"/"nền" vì đây là câu trả lời đúng câu hỏi loại chứ không phải cả câu rao) ghi `listings.property_type`, lượt sau `listing_missing_facts` tự chuyển sang bộ câu hỏi đúng loại. Trả lời vẫn không đọc ra loại → bot **hỏi lại kèm lựa chọn** và GIỮ câu hỏi pending, tuyệt đối không ghi fact `loai_bds` (ghi là view hết hỏi, tin kẹt `chua_ro` vĩnh viễn — đúng kiểu chết lặng mà FR-150 sinh ra để diệt). (b) Điều kiện "đủ thông tin thì lên web" treo trên CHÍNH bảng `listings` (trigger `trg_listings_autopublish` + hàm chung `listings_try_publish`), không phụ thuộc thứ tự ghi trong code. (c) `price_vnd` tính lại cả khi UPDATE `price_raw`. (d) Bridge resolve được Zalo ID từ SĐT thì **ghi ngược** vào `sellers`/`ctvs`/`admins` qua `escalation-feed` action `ack` — người bán tự được nhận diện từ lần nhắn sau, không chờ ai điền tay | M | soát cấu trúc dữ liệu 26/08/2026 (4 chỗ gãy: view inner-join nullable, nhận diện một-khoá không đường lùi, auto-publish treo nhầm bảng, drip lọc theo trạng thái tiếng Anh đã bỏ) + yêu cầu chủ dự án 26/08/2026 "property type thì nó tự trích xuất ra chứ hỏi làm gì, khó lắm mới hỏi nhé" |
| FR-152 | **Sổ lỗi bền + nhịp tim bot** (soát 27/08/2026: pg_cron báo `succeeded` cho MỌI lần chạy kể cả khi edge function trả 500, vì `net.http_post()` là fire-and-forget — cron chỉ xếp request vào hàng đợi, mã trạng thái rơi vào `net._http_response`, chỗ không ai đọc và Supabase tự dọn sau vài giờ; đo 26/08: 3 ngày 147 lượt cron "thành công" nhưng bảng phản hồi chỉ còn 16 dòng). **(a)** Bảng `bot_errors` (bền, RLS, admin đăng nhập đọc được) + `bot_health` (mốc quét + nhịp tim). **(b)** `bot_health_tick()` (cron `*/15`) quét các phản hồi HTTP chưa xem, chép mọi cái KHÔNG 2xx sang `bot_errors`, báo admin gộp ĐÚNG MỘT tin mỗi giờ qua `reminders` kind `escalation`. **(c)** Nhịp tim: `escalation-feed` gọi RPC `beat('bridge-zca')` mỗi lần bridge kéo việc (1 phút/lần) — im quá 15 phút trong khung 7–22h giờ VN thì ghi sổ + báo. **(d)** Cửa ghi lỗi TẦNG ỨNG DỤNG `log_loi(source, detail, code)` — vì loại lỗi nguy nhất lại TRẢ 200 (catch nuốt exception rồi hàm chạy tiếp), nên (a)(b) vốn chỉ soi mã HTTP không thấy gì. Nối vào 9 chỗ đang chỉ `console.error`: `chat-reply` (model hỏng → im lặng rơi về regex fallback), `ctv-report` (đúng bug 26/08), `zalo-webhook` ×4 (bộ não từ chối, gửi text hụt, gửi ảnh hụt, exception trong tác vụ nền), và bridge ×7 (qua `escalation-feed` action `log`, dùng lại cổng `x-bridge-secret`). Web: `instrumentation.ts` → `onRequestError` bắt mọi lỗi server chưa bắt; `app/error.tsx` cho khách một trang tử tế thay màn hình trắng. `log_loi` phải mở cho `anon` (server Next chạy bằng publishable key) nên có **hai van**: 20 dòng/nguồn/giờ và 200 dòng/giờ tổng; `bot_errors` tự dọn sau 30 ngày. **Giới hạn thành thật**: tin báo đi ĐƯỜNG BRIDGE, nên bridge chết thì tin nằm chờ tới lúc nó sống lại; muốn biết ngay phải mở `/admin` (đọc thẳng `bot_health`/`bot_errors`). Chưa từng thấy nhịp nào thì KHÔNG báo, tránh nhắc suông lúc bridge còn chưa bật. Log thô của edge function vẫn chỉ giữ 1 ngày (giới hạn bậc Free) — `bot_errors` là bản trích, không phải bản đầy đủ | M | soát cloud/compute 27/08/2026 (mục Error Tracking & Logs, Availability & Recovery) |

---

## 2.5 Yêu cầu phi chức năng

| ID | Loại | Yêu cầu | Đo bằng |
|---|---|---|---|
| NFR-01 | Hiệu năng | Bot phản hồi tin nhắn thường < 3s (p95) | Log |
| NFR-02 | Hiệu năng | Trang listing/search LCP < 2.5s trên 4G | Lighthouse ≥ 90 mobile |
| NFR-03 | Sẵn sàng | Zalo OA phục vụ 24/7, uptime ≥ 99.5% | Monitoring |
| NFR-04 | Tin cậy | Tin nhắn **không được mất** khi một bên offline → hàng đợi bền | PDF hệ thống §5 |
| NFR-05 | Quy mô | 6 tháng đầu: ~10 chat mới/ngày, ~300 chat sống đồng thời, ~5.000 listing | BR-03, BR-01 |
| NFR-06 | Bảo mật | Ảnh sổ đỏ/giấy tờ lưu bucket riêng, truy cập bằng signed URL hạn ngắn | RSK-07 |
| NFR-07 | Riêng tư | Không thu số ĐT của B ngoài bước đặt lịch xem nhà; cho phép ngắt kết nối bất cứ lúc nào | BR-06, FR-04 |
| NFR-08 | Riêng tư | Fingerprint chỉ dùng cá nhân hoá kết quả, có thông báo và cơ chế từ chối | FR-16 |
| NFR-09 | SEO | 100 URL tag render server-side, có canonical, sitemap, structured data | BR-08 |
| NFR-10 | i18n | Toàn bộ giao diện và nội dung chat: tiếng Việt, xưng hô anh/chị/em | chats w B.docx |
| NFR-11 | Vận hành | Mọi dữ liệu thống kê phải **kết nối được từ Excel** — không cần dashboard đẹp | chats w B.docx §Thống kê |
| NFR-12 | Khả chuyển | Tầng messaging trừu tượng hoá để thêm Messenger/Telegram mà không sửa lõi | RSK-02 |
| NFR-13 | Khả kiểm | Mọi sự kiện listing và hội thoại có timestamp, truy vết được | FR-70, FR-71 |
| NFR-14 | Chi phí | Tổng chi phí build MVP ≤ 418tr VND | §1.4 |
| NFR-15 | Tuân thủ | Asset theme thương mại chỉ dùng trong phạm vi license đã mua (KingTheme, regular license = 1 end product); không commit theme vào repo public | OPEN-07 chốt 24/08 |
| NFR-16 | Chi phí | **Free-tier trước, trả tiền sau**: mọi dịch vụ hạ tầng khởi đầu ở bậc miễn phí (Vercel Hobby, Supabase Free, Zalo OA cơ bản); chỉ nâng cấp khi chạm ngưỡng đo được, ghi lại ngưỡng trong docs | trao đổi chủ dự án 24/08/2026 |
| NFR-17 | Hiệu năng | **Trang tin phải nằm trong cache, không hỏi DB từng lượt xem**: mọi route đọc dữ liệu phải chứng minh được là có cache — route tĩnh/ISR trả `x-nextjs-cache` + `s-maxage`; route động (đọc `searchParams`) thì bọc truy vấn Supabase trong Data Cache. Route động **có tham số đường dẫn** bắt buộc khai `generateStaticParams()`: thiếu nó thì `export const revalidate` là chữ chết (Next 15 để `prerender-manifest.dynamicRoutes` rỗng, mỗi lượt xem = một lambda + đủ số query). Bằng chứng chấp nhận: bảng route sau build hiện `●`/`○` cho trang tin, và `dynamicRoutes` có mục `/nha-dat/[code]` | soát cloud/compute 27/08/2026 (mục Caching & CDN) |
| NFR-18 | Vận hành | **Xanh phải là xanh thật**: không được dùng trạng thái của lớp xếp hàng thay cho kết quả thật của việc. Cụ thể `cron.job_run_details.status` KHÔNG phải bằng chứng bot chạy được, vì `net.http_post()` trả về ngay khi xếp hàng; kết quả thật phải được quét và ghi vào sổ bền (FR-152) | soát cloud/compute 27/08/2026 (mục Error Tracking & Logs) |

## 2.6 Giả định

| ID | Giả định | Đổ vỡ nếu sai |
|---|---|---|
| ASM-01 | Zalo OA cho phép gửi tin chủ động ở tần suất cần cho FR-63, FR-64 | Toàn bộ chiến lược giữ chân sụp |
| ASM-02 | Zalo SSO khả dụng cho ứng dụng bên thứ ba của nhadat.cc | Phải làm OTP/đăng nhập riêng |
| ASM-03 | AI bóc tách địa chỉ Việt Nam (hẻm, ngã tư, mốc tiện ích) đạt độ chính xác dùng được | FR-92, FR-22 phải có người kiểm duyệt |
| ASM-04 | CCRB/NMG chịu trả lời câu hỏi bổ sung trong vài giờ | Vòng lặp INS-06 đứt, B mất kiên nhẫn |
| ASM-05 | Giao dịch được ghi nhận và thu phí ngoài hệ thống (thủ công, hợp đồng giấy) | Cần module hợp đồng/thanh toán, vượt ngân sách |
