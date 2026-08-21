# 09 — Open Issues

Những điểm **chủ dự án cần quyết định** trước hoặc trong lúc phát triển. Mỗi mục nêu
nguyên nhân, các phương án, và khuyến nghị của BA. Không tự chốt (quy ước 2, `CLAUDE.md`).

| ID | Vấn đề | Mức | Chặn |
|---|---|---|---|
| OPEN-01 | Toán học OKR không khớp | Cao | Kế hoạch KD |
| OPEN-02 | Định nghĩa "giao dịch thành công" & cách thu phí | Cao | BR-05 |
| OPEN-03 | Slack relay vs API S↔B | Cao | SRS-2.2, P2 |
| OPEN-04 | Ai dẫn khách xem nhà khi NMG bận | Trung bình | UF-06 |
| OPEN-05 | Xin số ĐT có phá vỡ lời hứa riêng tư? | Cao | FR-53, NFR-07 |
| OPEN-06 | Thiếu file TOP-100 keyword | Cao | FR-12, toàn bộ SEO |
| OPEN-07 | Dùng theme thương mại hay thiết kế riêng | Trung bình | Toàn bộ `06` |
| OPEN-08 | Tên thương hiệu và tên miền | Thấp | Copy toàn hệ thống |
| OPEN-09 | Zalo OA có cho gửi tin chủ động ở tần suất cần? | Cao | FR-63, FR-64 |
| OPEN-10 | FR-99 định giá so sánh — chưa có đặc tả | Trung bình | FR-99 |
| OPEN-11 | Logstash làm hàng đợi tin nhắn | Cao | NFR-04 |
| OPEN-12 | Quy trình chấm điểm & chấm dứt NMG | Trung bình | FR-102 |
| OPEN-13 | Nguồn dữ liệu tiện ích quanh BĐS | Thấp | FR-28 |
| OPEN-14 | Chính sách fingerprint & tuân thủ dữ liệu cá nhân | Trung bình | FR-16, NFR-08 |

---

### OPEN-01 · Toán học OKR không khớp
**Nguồn**: `biz model.docx §OKRs`.
OKR 3 tạo ~1.800 cuộc chat trong 6 tháng; OKR 4 đòi ~90 giao dịch → tỉ lệ chuyển đổi
chat→giao dịch ~5%, bằng đúng ngưỡng tối thiểu áp cho một NMG chuyên nghiệp.
Đồng thời ngân sách quảng cáo chỉ 120tr/6 tháng.
**Phương án**: (a) giữ OKR 4, tăng mạnh ngân sách acquisition; (b) hạ OKR 4 xuống
1 giao dịch/tuần cho 6 tháng đầu; (c) giữ nguyên và coi là mục tiêu kéo căng.
**Khuyến nghị**: (b) cho kế hoạch vận hành, (c) cho gọi vốn — nhưng phải nói rõ đâu là đâu.

### OPEN-02 · Định nghĩa "giao dịch thành công"
Không tài liệu nào định nghĩa thời điểm phát sinh phí: đặt cọc, công chứng, hay sang tên?
Cũng chưa rõ hệ thống có ghi nhận giao dịch hay làm ngoài (ASM-05).
**Khuyến nghị**: chốt là **thời điểm công chứng hợp đồng mua bán**; MVP ghi nhận thủ
công trong admin, chưa cần module hợp đồng.

### OPEN-03 · Slack relay vs API S↔B
Xem `07-srs.md §SRS-2.2`. **Khuyến nghị**: API là đường nghiệp vụ, Slack là kênh quan
sát/can thiệp của con người. Cần chủ dự án xác nhận để vendor không xây trùng.

### OPEN-04 · Ai dẫn khách xem nhà
Với CCRB thì CTV dẫn; với NMG thì NMG dẫn [nguồn: biz model.docx]. Nhưng chỉ có
**1.5 CTV** (RSK-05) và chưa có quy tắc khi NMG bận hoặc không phản hồi.
**Khuyến nghị**: SLA 4 giờ cho NMG; quá hạn thì CTV tiếp quản và NMG mất phần phí dẫn xem.

### OPEN-05 · Xin số điện thoại
`nhadat.cc website.docx` cam kết *"Tụi em không hỏi số ĐT của anh chị"*, nhưng
`chats w B.docx §Hẹn xem nhà` lại xin số hai lần.
**Phương án**: (a) không bao giờ xin số, liên hệ 100% qua Zalo kể cả lúc dẫn xem;
(b) xin số **chỉ** ở bước đặt lịch, nêu rõ mục đích, cho phép từ chối; (c) bỏ cam kết.
**Khuyến nghị**: (b) — đã đặc tả sẵn ở FR-53/WF-07 với đường từ chối. Cần sửa copy trên
web thành *"Tụi em không hỏi số ĐT để spam"* để không mâu thuẫn.

### OPEN-06 · Thiếu file TOP-100 keyword
`nhadat.cc website.docx` trỏ tới `ndCC-TOP-KW-2014-01.xlsm` trên Dropbox — **không có
trong repo**, và dữ liệu từ **2014**.
**Khuyến nghị**: lấy file về đưa vào repo, đồng thời làm lại nghiên cứu keyword 2026
(Google Keyword Planner + Search Console). Toàn bộ chiến lược SEO (BR-08) đứng trên file này.

### OPEN-07 · Theme thương mại
`ThemeForest/` (274MB) bị loại khỏi repo vì bản quyền; `Vedoo pages/` chỉ là ảnh chụp.
**Phương án**: (a) mua license Veedoo và dùng cho WordPress; (b) tự dựng UI trên
Next.js + Tailwind theo design system ở `06` (đã viết theo hướng này).
**Khuyến nghị**: (b) — `.claude/launch.json` cho thấy dự án đã đi theo Next.js, và
FR-09/FR-14 cần logic tuỳ biến mà theme WordPress không hỗ trợ tự nhiên.

### OPEN-08 · Tên thương hiệu
Tài liệu dùng lẫn `nhadat.cc`, `nhadatCC`, `Nhã Đạt CC`, `nhaadaat.com`.
**Khuyến nghị**: tên miền `nhadat.cc`, tên đọc **Nhã Đạt CC**, tên viết trong sản phẩm
**nhadat.cc**. Bỏ hẳn `nhaadaat.com`. Cần xác nhận trước khi in ấn/quảng cáo.

### OPEN-09 · Hạn mức tin chủ động của Zalo OA
ASM-01 giả định Zalo cho phép gửi tin chủ động đủ để chạy FR-63, FR-64. Zalo OA thực tế
giới hạn tin ngoài cửa sổ tương tác và yêu cầu template được duyệt.
**Khuyến nghị**: xác minh với Zalo trước khi bắt đầu P4. Nếu bị hạn chế → cần kênh dự
phòng (ZNS trả phí, hoặc email/SMS tuỳ chọn) và phải sửa NFR-07 cho phù hợp. **Đây là
rủi ro có thể làm sụp toàn bộ chiến lược giữ chân (BR-07).**

### OPEN-10 · FR-99 định giá so sánh
`S's side.docx` hứa *"giúp họ định giá bằng cách so sánh nhanh với BĐS cạnh tranh"*
nhưng không có đặc tả. Cần: nguồn dữ liệu giá (chỉ dữ liệu nội bộ hay mua ngoài?),
số mẫu tối thiểu, cách trình bày để không bị hiểu là thẩm định giá chính thức.
**Khuyến nghị**: hoãn sang sau MVP; khi làm thì chỉ hiển thị "N căn tương tự quanh đây
đang rao từ X đến Y tỉ", kèm miễn trừ trách nhiệm rõ ràng.

### OPEN-11 · Logstash làm hàng đợi
Xem ghi chú kiến trúc ở `07-srs.md §SRS-2.1`. Logstash không bảo đảm giao nhận mà NFR-04
đòi hỏi.
**Khuyến nghị**: Postgres outbox + worker (hoặc pgmq) cho hàng đợi nghiệp vụ; giữ
Logstash + ElasticSearch cho log và phân tích sự kiện. Cần chủ dự án chốt với vendor vì
ảnh hưởng báo giá.

### OPEN-12 · Chấm điểm & chấm dứt NMG
Quy định *"chấm dứt hợp đồng ngay khi bị chấm ≤3/5 ở mọi tương tác"* là rất khắt khe —
một đánh giá xấu đơn lẻ có thể do khách khó tính. Chưa có quy trình khiếu nại.
**Khuyến nghị**: đổi thành ngưỡng trung bình trượt (ví dụ trung bình 5 lượt gần nhất
< 3.5 → cảnh báo; < 3.0 → chấm dứt), có bước phúc tra bởi CTV.

### OPEN-13 · Nguồn dữ liệu tiện ích quanh BĐS
FR-28 hứa trả lời "quanh đây có trường học nào" kèm khoảng cách. Chưa rõ lấy từ Google
Places (tốn phí, ràng buộc điều khoản hiển thị) hay tự nhập cho Quận 5.
**Khuyến nghị**: MVP tự nhập ~200 POI của Quận 5 — vừa rẻ, vừa chính xác hơn, vừa phù
hợp chiến lược "sâu một quận" (INS-08).

### OPEN-14 · Fingerprint & dữ liệu cá nhân
FR-16 dùng fingerprint trình duyệt để cá nhân hoá. Nghị định 13/2023/NĐ-CP về bảo vệ dữ
liệu cá nhân có thể coi đây là dữ liệu cá nhân, cần thông báo và cơ sở pháp lý.
**Khuyến nghị**: tham vấn pháp lý; tối thiểu phải có banner thông báo, trang `/rieng-tu`
(IA-06) mô tả rõ, và cơ chế từ chối. Trớ trêu: dùng fingerprint quá tay sẽ mâu thuẫn với
chính lời hứa riêng tư đang là điểm bán hàng (INS-04).
