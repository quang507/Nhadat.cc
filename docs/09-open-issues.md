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
| OPEN-15 | Hàng dự án (căn/giỏ hàng) — vào MVP hay giai đoạn 2? | Cao | Data model, INS-10 |
| OPEN-16 | Có cần CRM riêng không? | Trung bình | OPEN-02, vận hành |

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

### OPEN-15 · Hàng dự án (căn / giỏ hàng) — vào MVP hay giai đoạn 2?
**Nguồn**: trao đổi chủ dự án 22/08/2026 — *"bán căn 50 của Ny'ah"*, nhu cầu kiểm soát
trong một dự án đã bán những căn nào; phân tích ở `INS-10`.
Toàn bộ tài liệu gốc (kịch bản chat, S's side, biz model) chỉ mô tả **hàng lẻ thứ cấp**;
hàng dự án chưa từng được đặc tả — đưa vào là mở rộng phạm vi thật sự.

**Mô hình dữ liệu đề xuất** (áp dụng khi chốt, bất kể phương án nào):
- Bảng `projects`: `id, name, slug, developer, district, ward, lat/lng, legal_status,
  amenities jsonb, floor_plans jsonb, handover_date, description`.
- `properties` thêm `project_id uuid null fk` + `unit_code text` ("50", "A-12.07"),
  `floor int`, `direction`, `unit_status enum(con_ban, giu_cho, da_coc, da_ban)`.
- **Quy tắc thừa hưởng dữ liệu**: trường nào `properties` để null mà `projects` có →
  trả lời từ dự án, KHÔNG tạo info_request (INS-06 chỉ áp cho dữ liệu tầng căn);
  câu hỏi tầng căn ("căn 50 còn không?") → đọc `unit_status`, nếu `last_verified_at`
  cũ quá X giờ thì mới hỏi S.
- **Cái dùng chung được**: vị trí, chủ đầu tư, pháp lý dự án, tiện ích, mặt bằng,
  tiến độ, ảnh dự án. **Cái không dùng chung**: giá từng căn, trạng thái bán, hướng,
  tầng, ảnh thực tế căn, thông tin thương lượng — và **không bao giờ** dùng chung
  giữa hai dự án khác nhau.

**Phương án**: (a) vào MVP đầy đủ (bảng + luồng rao giỏ hàng + chat mức căn) — chậm
MVP đáng kể; (b) **MVP chỉ đặt nền data model** (bảng `projects` + 4 cột thêm ở
`properties`, chưa làm UI giỏ hàng — NMG rao căn dự án như hàng lẻ có gắn `project_id`),
giai đoạn 2 làm trang dự án + quản lý giỏ hàng; (c) để hẳn giai đoạn 2.
**Khuyến nghị**: (b) — chi phí gần bằng 0 hôm nay, tránh migration đau về sau, và
"căn 50 của Ny'ah còn không?" đã trả lời được ngay từ MVP qua `unit_status`.

### OPEN-16 · Có cần CRM riêng không?
**Nguồn**: trao đổi chủ dự án 22/08/2026.
**Hiện trạng**: hệ thống đặc tả sẵn đã là một CRM tối giản — `buyers` (hồ sơ + tiêu chí
học được), `conversations` (toàn bộ lịch sử), `viewings` (lịch xem + kết quả), 5 bảng
admin + email escalation, tất cả kết nối được Excel (NFR-11). Cái CHƯA có: pipeline
giao dịch sau buổi xem (đàm phán → cọc → công chứng → thu phí) và sổ hoa hồng CTV/NMG.
**Phương án**: (a) mua CRM ngoài (HubSpot/Pipedrive…) — thừa tính năng, đội chi phí,
nhân đôi nơi nhập liệu, lệch lời hứa riêng tư nếu đồng bộ dữ liệu B ra ngoài;
(b) **thêm 1 bảng `deals`** vào hệ thống hiện tại: `id, property_id, buyer_id, seller_id,
stage enum(dam_phan, dat_coc, cong_chung, hoan_tat, huy), price_final, fee_rate,
fee_amount, ctv_id, closed_at` + một trang admin dạng bảng 20 dòng — đủ cho 1 giao
dịch/2 ngày (OKR 4) và trả lời được "dự án X đã bán căn nào" khi ghép `unit_status`;
(c) xây CRM riêng đầy đủ — vượt ngân sách 418tr.
**Khuyến nghị**: (b) cho MVP. Chỉ cân nhắc CRM thật khi có >3 CTV hoặc >5 giao
dịch/tuần. Định nghĩa các stage của `deals` phụ thuộc `OPEN-02` (thời điểm nào tính
phí) — nên chốt hai mục này cùng lúc.
