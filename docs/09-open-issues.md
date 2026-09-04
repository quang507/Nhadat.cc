# 09 — Open Issues

Những điểm **chủ dự án cần quyết định**. Mỗi mục nêu vấn đề, phương án, khuyến nghị BA; không
tự chốt (quy ước 2, `CLAUDE.md`). Mục đã chốt chỉ giữ kết luận + ai chốt, ngày, hiện thực ở đâu;
lý lẽ gốc nằm trong lịch sử git. Ký hiệu: ✅ đã chốt · 🟡 chốt một phần (vẫn tính còn chờ).

| ID | Vấn đề | Mức | Liên quan |
|---|---|---|---|
| OPEN-01 | Toán học OKR không khớp: 1.800 chat → 90 giao dịch = 5%, bằng đúng ngưỡng tối thiểu của một NMG chuyên nghiệp, với 120tr quảng cáo | Cao | Kế hoạch KD |
| OPEN-02 | "Giao dịch thành công" tính phí ở thời điểm nào: đặt cọc, công chứng hay sang tên? | Cao | BR-05, OPEN-16 |
| OPEN-03 | Slack relay vs API S↔B — cái nào là đường nghiệp vụ? | Cao | SRS-2.2, P2 |
| OPEN-04 | Ai dẫn khách xem nhà khi NMG bận hoặc không phản hồi? | Trung bình | UF-06 |
| OPEN-05 | Xin số ĐT lúc đặt lịch có phá lời hứa "không hỏi số ĐT" không? | Cao | FR-53, NFR-07 |
| OPEN-06 | Thiếu file TOP-100 keyword (trỏ Dropbox, dữ liệu 2014) | Cao | FR-12, OPEN-44 |
| OPEN-07 | ✅ **ĐÃ CHỐT 24/08/2026** — theme KingTheme (HTML template) cắt vào Next.js; không commit theme vào repo | — | `06`, OPEN-45 |
| OPEN-08 | ✅ **ĐÃ CHỐT 03/09/2026** — thương hiệu Aioinhadat, bot "Thái" (OPEN-39); tên miền vẫn nhadat.cc [giả định BA] | — | Copy toàn hệ thống |
| OPEN-09 | Zalo OA có cho gửi tin chủ động ở tần suất giữ chân cần không? | Cao | FR-63, FR-64 |
| OPEN-10 | FR-99 định giá so sánh: nguồn giá, số mẫu tối thiểu, cách nói để không thành thẩm định | Trung bình | FR-99 |
| OPEN-11 | Logstash làm hàng đợi — còn treo phần chốt với vendor (hàng đợi thật đã nằm trong Postgres, FR-166) | Cao | NFR-04, FR-166 |
| OPEN-12 | Quy trình chấm điểm & chấm dứt NMG ("≤3/5 một lần là chấm dứt" quá khắt khe) | Trung bình | FR-137, OPEN-26 |
| OPEN-13 | Nguồn dữ liệu tiện ích quanh BĐS: Google Places hay tự nhập? | Thấp | FR-28, OPEN-37 |
| OPEN-14 | Fingerprint (FR-16) có là dữ liệu cá nhân theo NĐ 13/2023 không? | Trung bình | FR-16, NFR-08 |
| OPEN-15 | ✅ **ĐÃ CHỐT 24/08/2026** — phương án (b): MVP chỉ đặt nền data model hàng dự án → FR-113…117 | — | FR-113…117 |
| OPEN-16 | ✅ **ĐÃ CHỐT 08/2026** — phương án (b): thêm bảng `deals` (FR-112), không mua CRM ngoài; định nghĩa stage chờ OPEN-02 | — | FR-112, OPEN-02 |
| OPEN-17 | Mã công khai listing `#35148` hay `BDS-Q5-0012`? (DB/URL đã đi `BDS-Q5-####` theo FR-158; còn chốt cách gõ trong chat) | Thấp | FR-158, OPEN-27 |
| OPEN-18 | ✅ **ĐÃ CHỐT 29/08/2026** — Supabase Storage (FR-165: hai bucket + `listing_media`; upload web FR-96). Còn dọn bảng `media` cũ + bucket `listing-photos` | — | FR-165, FR-96 |
| OPEN-19 | ✅ **ĐÃ CHỐT 25/08/2026** — (b): tính lãi vay dạng trang `/tinh-lai-vay` (FR-119); quy hoạch không tự khẳng định; thời gian di chuyển giai đoạn 2 | — | FR-119 |
| OPEN-20 | ✅ **ĐÃ CHỐT 27/08/2026** — LÀM hạng người rao (FR-155), nhưng bằng công thức khác AOND; ngưỡng treo ở OPEN-26 | — | FR-155, OPEN-26 |
| OPEN-21 | Vai người rao 5 loại (CĐT/sàn/NMG/lướt sóng/chủ nhà) + phí riêng cho CĐT — mở rộng nhị phân CCRB/NMG? | Trung bình | BR-05, OPEN-28 |
| OPEN-22 | ✅ **ĐÃ CHỐT 27/08/2026** — dữ liệu chia theo dòng; người nhận theo `zalo_user_id`, vai xét từng lượt theo nội dung (FR-157 d) | — | FR-157 |
| OPEN-23 | ✅ **ĐÃ CHỐT 27/08/2026** — xoá `rate-ctv` + bảng `ratings`; FR-102 `[deprecated → FR-137]` | — | FR-137 |
| OPEN-24 | `pg_net` mở cho `anon` (mồi SSRF), REVOKE từ vai `postgres` là no-op — gác cửa cấu hình + ticket Supabase? | Cao | NFR-06, SRS-3.9 |
| OPEN-25 | ✅ **ĐÃ CHỐT 27/08/2026** — ở lại Free, điều kiện: chạy `sao-luu.mjs` định kỳ + giám sát bridge; xem lại khi có giao dịch thật đầu tiên | — | NFR-16, FR-152 |
| OPEN-26 | 🟡 **CHỐT MỘT PHẦN 27/08** — hạng ẩn khỏi web, chỉ hiện `/admin`; ngưỡng Đồng/Bạc/Vàng và quyền lợi mỗi hạng vẫn [giả định BA] | Trung bình | FR-155, OPEN-20 |
| OPEN-27 | 🟡 **CHỐT MỘT PHẦN 03/09** — địa bàn = Sài Gòn phường mới + Long An, khởi điểm Quận 5 cũ (FR-174 đợt 1); còn: tên hiển thị, lưu DB, mã tin, thứ tự mở | Cao | FR-118, FR-174, BR-01 |
| OPEN-28 | 🟡 **CHỐT MỘT PHẦN 02/09** — nhãn CCRB/NMG gán lúc mở hồ sơ từ chat; còn: chính chủ rao tin thứ 3 có tự lật sang NMG (FR-160) và phí có đổi theo? | Cao | FR-160, BR-05 |
| OPEN-29 | ✅ **ĐÃ CHỐT 27/08/2026** — bỏ dấu trước khi khớp mọi regex cổng (FR-161) | — | FR-161 |
| OPEN-30 | ✅ **ĐÃ CHỐT 28/08/2026** — mọi lệnh gọi model bọc try/catch + `ghiLoi` + câu mẫu (chat-reply v40, nudge v14+) | — | FR-152, FR-161 |
| OPEN-31 | Bậc nguồn: admin cầm sổ đỏ mà chủ nhà nhớ nhầm thì ai thắng? (FR-164 khoá cột sau `chu_xac_nhan`) | Trung bình | FR-164, FR-156 |
| OPEN-32 | Ảnh chủ nhà gửi qua chat (kể cả ảnh sổ) thành fact `hinh_anh` rồi gửi thẳng cho khách — nằm ngoài hàng rào hai bucket | Cao | FR-165, FR-143, FR-129 |
| OPEN-33 | Webhook Zalo không kiểm chữ ký vì Vault thiếu `ZALO_APP_SECRET`/`ZALO_APP_ID` — ai cũng giả được tin đến | Cao | FR-167, SRS-4.4 |
| OPEN-34 | Gộp `zalo-webhook` → `chat-reply` thành một lambda? | Trung bình | FR-171, SRS-2 |
| OPEN-35 | Nhắc lời hứa / hỏi thăm khách im: mẫu câu cố định hay lượt model? | Thấp | FR-133, FR-171 |
| OPEN-36 | ✅ **ĐÃ CHỐT 02/09/2026** — lưu hết thông tin chủ chia sẻ, khách hỏi mới khai; liên hệ chỉ mở lúc chốt lịch xem | — | INS-11, FR-104 |
| OPEN-37 | Lớp dữ liệu vị trí (POI, quy hoạch, ngập): lấy từ đâu, trả bao nhiêu? | Trung bình | FR-28, INS-13, OPEN-40 |
| OPEN-38 | Ảnh tin: thumbnail và watermark trên bậc Free | Thấp | FR-165, NFR-16 |
| OPEN-39 | ✅ **ĐÃ CHỐT 03/09/2026** — thương hiệu Aioinhadat, MỘT trợ lý tên Thái, không nhận kho tên •ai của AOND | — | OPEN-08, FR-20, DH-01 |
| OPEN-40 | Phạm vi loại BĐS: thông số cho thuê, đất nền, nhóm công nghiệp (AOND §III) | Trung bình | FR-172, OPEN-37, DH-03 |
| OPEN-41 | Nhà cung cấp model: giữ Claude trên Supabase hay theo AOND §VII (Gemini rồi chạy local)? | Thấp | SRS-2, FR-138, DH-06 |
| OPEN-42 | Ngưỡng CTV: hạn trả lời 120 phút, hạng Vàng ≥90% / Bạc ≥70% — đều [giả định BA] | Trung bình | FR-173, FR-137, DH-03 |
| OPEN-43 | 🟡 **CHỐT MỘT PHẦN 04/09** — "dựng hết" đã làm gần hết; còn: FR-16/NFR-08, FR-95, FR-118, FR-160, FR-28, `?ref=`; và nhãn `[deprecated]` cho SRS-4.1/4.2/4.4/4.7 | Thấp | SRS-2/4/5, `10 §10.8` |
| OPEN-44 | 🟡 **CHỐT MỘT PHẦN 04/09** — SEO nền đã dựng (sitemap, robots, canonical, JSON-LD, 64 tag); còn TOP-100 keyword (OPEN-06) + Google Search Console | Thấp | FR-12, NFR-09, OPEN-06 |
| OPEN-45 | Design token `06 §6.2`, `design/tokens.json` và `app/globals.css` là ba bản lệch nhau — chọn nguồn sự thật nào? | Thấp | UI-01…, OPEN-07 |

### OPEN-01 · Toán học OKR không khớp
**Vấn đề**: `biz model.docx §OKRs` — OKR 3 tạo ~1.800 chat/6 tháng, OKR 4 đòi ~90 giao dịch → chuyển
đổi ~5%, bằng đúng ngưỡng tối thiểu áp cho NMG chuyên nghiệp, trong khi ngân sách quảng cáo chỉ
120tr/6 tháng.
**Phương án**: (a) giữ OKR 4, tăng mạnh ngân sách acquisition; (b) hạ OKR 4 xuống 1 giao dịch/tuần
cho 6 tháng đầu; (c) giữ nguyên, coi là mục tiêu kéo căng.
**Khuyến nghị BA**: (b) cho vận hành, (c) cho gọi vốn — nói rõ đâu là đâu. **Chờ**: chủ dự án.

### OPEN-02 · Định nghĩa "giao dịch thành công"
**Vấn đề**: không tài liệu nào định nghĩa thời điểm phát sinh phí (cọc, công chứng, sang tên), cũng
chưa rõ hệ thống ghi nhận giao dịch hay làm ngoài (ASM-05). Stage của bảng `deals` (OPEN-16) phụ
thuộc câu này.
**Phương án**: (a) đặt cọc; (b) công chứng HĐMB; (c) sang tên.
**Khuyến nghị BA**: (b); MVP ghi nhận thủ công trong admin, chưa cần module hợp đồng.
**Chờ**: chủ dự án.

### OPEN-03 · Slack relay vs API S↔B
**Vấn đề**: `07 §SRS-2.2` — tài liệu gốc vừa tả Slack relay vừa tả API S↔B cho cùng việc, vendor có
thể xây trùng.
**Phương án**: (a) API là đường nghiệp vụ, Slack là kênh quan sát/can thiệp; (b) Slack là đường
chính.
**Khuyến nghị BA**: (a). **Chờ**: chủ dự án xác nhận với vendor.

### OPEN-04 · Ai dẫn khách xem nhà
**Vấn đề**: CCRB thì CTV dẫn, NMG thì NMG dẫn [nguồn: biz model.docx], nhưng chỉ có 1.5 CTV (RSK-05)
và chưa có quy tắc khi NMG bận/không phản hồi.
**Phương án**: (a) SLA cho NMG, quá hạn CTV tiếp quản và NMG mất phần phí dẫn xem; (b) NMG luôn tự
dẫn, khách chờ.
**Khuyến nghị BA**: (a) với SLA 4 giờ. **Chờ**: chủ dự án.

### OPEN-05 · Xin số điện thoại
**Vấn đề**: `nhadat.cc website.docx` cam kết "không hỏi số ĐT", nhưng `chats w B.docx §Hẹn xem nhà`
xin số hai lần.
**Phương án**: (a) không bao giờ xin, liên hệ 100% qua Zalo; (b) xin CHỈ ở bước đặt lịch, nêu mục
đích, cho phép từ chối; (c) bỏ cam kết.
**Khuyến nghị BA**: (b) — đã đặc tả ở FR-53/WF-07 có đường từ chối; sửa copy web thành "không hỏi số
ĐT để spam".
**Chờ**: chủ dự án.

### OPEN-06 · Thiếu file TOP-100 keyword
**Vấn đề**: `nhadat.cc website.docx` trỏ `ndCC-TOP-KW-2014-01.xlsm` trên Dropbox — không có trong
repo, dữ liệu 2014. Trang tag hiện sinh 64 tag từ taxonomy thay vì 100 keyword (OPEN-44).
**Phương án**: (a) lấy file về, dùng tạm; (b) làm lại nghiên cứu keyword 2026 (Keyword Planner +
Search Console).
**Khuyến nghị BA**: (a) rồi (b). **Chờ**: chủ dự án cung cấp file.

### OPEN-07 · Theme thương mại
✅ Chủ dự án chốt 24/08/2026: dùng KingTheme đã mua (HTML template, nằm ngoài repo ở `ThemeForest/`),
cắt thẳng vào Next.js, giữ stack Supabase + Vercel. License regular (1 end product) hợp lệ; không
commit theme vào repo public. Token theme ↔ `06` xem OPEN-45.

### OPEN-08 · Tên thương hiệu
✅ Chủ dự án chốt 03/09/2026 (cùng OPEN-39): thương hiệu **Aioinhadat**, bot tự giới thiệu "em là
Thái, bên Aioinhadat". Tên miền web vẫn `nhadat.cc` cho tới khi có chỉ đạo đổi [giả định BA]; bộ
`docs/` gọi dự án là nhadat.cc theo tên repo.

### OPEN-09 · Hạn mức tin chủ động của Zalo OA
**Vấn đề**: ASM-01 giả định Zalo cho gửi tin chủ động đủ cho FR-63/64; thực tế Zalo OA giới hạn tin
ngoài cửa sổ tương tác và đòi template duyệt. Đây là rủi ro làm sụp cả chiến lược giữ chân (BR-07).
Kênh hiện tại là acc clone qua bridge (FR-145), OA chưa có.
**Phương án**: (a) xác minh với Zalo trước khi bật giữ chân trên OA; (b) chuẩn bị kênh dự phòng (ZNS
trả phí, email/SMS tuỳ chọn) và sửa NFR-07 tương ứng.
**Khuyến nghị BA**: (a), làm (b) chỉ khi (a) trả lời không. **Chờ**: chủ dự án (tài khoản OA).

### OPEN-10 · FR-99 định giá so sánh
**Vấn đề**: `S's side.docx` hứa "so sánh nhanh với BĐS cạnh tranh" nhưng không đặc tả: nguồn giá
(nội bộ hay mua ngoài), số mẫu tối thiểu, cách nói để không bị hiểu là thẩm định giá. Đợt 04/09 đã
dựng bản tối giản (chat-reply v48, TS-V48) chỉ từ kho nội bộ.
**Phương án**: (a) chỉ dữ liệu nội bộ, câu "N căn tương tự đang rao từ X đến Y tỉ" kèm miễn trừ; (b)
mua dữ liệu ngoài.
**Khuyến nghị BA**: (a). **Chờ**: chủ dự án xác nhận cách nói và có mua dữ liệu không.

### OPEN-11 · Logstash làm hàng đợi
**Vấn đề**: `07 §SRS-2.1` tả Logstash làm hàng đợi tin nhắn, nhưng Logstash không bảo đảm giao nhận
mà NFR-04 đòi. Phần thực hành đã dựng theo FR-166 (29/08): hàng đợi nằm trong Postgres
(`inbound_events`, `reminders`, `media_cleanup_queue`) + worker do pg_cron gọi, không Redis/Kafka
(chủ dự án: "Do not introduce Redis unless the repository proves it is necessary").
**Phương án**: (a) giữ Logstash + ES chỉ cho log/phân tích trong đề xuất vendor; (b) bỏ hẳn khỏi đề
xuất.
**Khuyến nghị BA**: (a). **Chờ**: chủ dự án chốt với vendor (chuyện báo giá, không phải code).

### OPEN-12 · Chấm điểm & chấm dứt NMG
**Vấn đề**: quy định "chấm dứt ngay khi bị chấm ≤3/5 ở mọi tương tác" rất khắt khe — một đánh giá
xấu đơn lẻ có thể do khách khó tính; chưa có quy trình khiếu nại. Nguồn chấm hiện là báo cáo 17h
(FR-137), `rate-ctv` đã xoá (OPEN-23).
**Phương án**: (a) trung bình trượt 5 lượt gần nhất: <3.5 cảnh báo, <3.0 chấm dứt, có phúc tra bởi
CTV; (b) giữ luật gốc.
**Khuyến nghị BA**: (a). **Chờ**: chủ dự án.

### OPEN-13 · Nguồn dữ liệu tiện ích quanh BĐS
**Vấn đề**: FR-28 hứa trả lời "quanh đây có trường nào" kèm khoảng cách; chưa rõ lấy Google Places
(tốn phí, ràng buộc hiển thị) hay tự nhập. FR-28 chưa dựng vì thiếu dữ liệu.
**Phương án**: (a) tự nhập ~200 POI Quận 5 (+ OSM); (b) Google Places.
**Khuyến nghị BA**: (a) — rẻ, chính xác hơn, hợp "sâu một quận" (INS-08). Gộp với OPEN-37.
**Chờ**: chủ dự án.

### OPEN-14 · Fingerprint & dữ liệu cá nhân
**Vấn đề**: FR-16 dùng fingerprint trình duyệt để cá nhân hoá; NĐ 13/2023/NĐ-CP có thể coi đây là dữ
liệu cá nhân, cần thông báo và cơ sở pháp lý. Dùng quá tay còn mâu thuẫn chính lời hứa riêng tư
(INS-04). Chưa dựng (OPEN-43).
**Phương án**: (a) làm, kèm banner + trang `/rieng-tu` (IA-06) + cơ chế từ chối; (b) cắt khỏi MVP.
**Khuyến nghị BA**: (b) cho tới khi có tham vấn pháp lý. **Chờ**: chủ dự án.

### OPEN-15 · Hàng dự án (căn / giỏ hàng)
✅ Chủ dự án chốt 24/08/2026: phương án (b) — MVP chỉ đặt nền data model (bảng `projects` + cột
`project_id`/`unit_code`/`unit_status`), UI giỏ hàng để giai đoạn 2. Hiện thực: FR-113…117, UF-05/09,
WF-09, SRS-3.1/3.10/5.1, AC-13; trang `/du-an/[slug]` dựng 04/09 (TS-WEB2).

### OPEN-16 · Có cần CRM riêng không?
✅ Đã chốt phương án (b) — thêm bảng `deals` vào hệ thống hiện tại, không mua CRM ngoài (spec "Cầu
Nối BĐS" v2 của chủ dự án, 08/2026 → FR-112; schema đã có trên Supabase). Còn treo duy nhất: định
nghĩa stage chờ OPEN-02.

### OPEN-17 · Định dạng mã công khai listing
**Vấn đề**: docs dùng `#35148`, spec Cầu Nối dùng `BDS-Q5-0012`. FR-158 đã chốt cả hệ chỉ còn MỘT
dãy `BDS-Q5-####` trong DB/URL (tiền tố là ID vô nghĩa — xem OPEN-27).
**Phương án**: (a) chat chấp nhận mọi cách gõ ("0012", "Q5-0012", "BDS-Q5-0012"); (b) chỉ nhận mã
đầy đủ.
**Khuyến nghị BA**: (a). **Chờ**: chủ dự án xác nhận, rồi đóng mục.

### OPEN-18 · Kho file: Supabase Storage vs OneDrive
✅ Chốt trên thực tế 29/08/2026: Supabase Storage — FR-165 (hai bucket public/private, bảng
`listing_media`, worker dọn file; TS-KHO 25/25) + upload ảnh web FR-96 (04/09). Không dựng adapter
OneDrive. Còn dọn (là dữ liệu, cần chủ dự án gật): bảng `media` cũ 1.005 dòng + `public_media`, bucket `listing-photos`.

### OPEN-19 · Công cụ B-side kiểu radanhadat
✅ Chủ dự án chốt 25/08/2026: phương án (b) — tính lãi vay làm trang `/tinh-lai-vay` (FR-119, port từ
NhaDat-Radar, CTA vẫn đẩy về Zalo); quy hoạch không tự khẳng định (RSK-03); thời gian di chuyển để
giai đoạn 2.

### OPEN-20 · Gamification điểm uy tín người rao (theo AOND)
✅ Chủ dự án chốt 27/08/2026: "AOND có hệ thống hạng Đồng/Bạc/Vàng cho người rao cứ làm đi test sau"
→ FR-155. Không bê công thức AOND §IV (50% hoàn chỉnh + 50% kịp thời) vì cả hai vế hôm nay đo ra 0
cho toàn kho. Ngưỡng và quyền lợi hạng treo ở OPEN-26.

### OPEN-21 · Vai người rao 5 loại + phí riêng cho chủ đầu tư
**Vấn đề**: `AOND req + chat examples.docx §V` — thực tế có 5 vai: CĐT (bán sơ cấp, trả hoa hồng cho
sàn, KHÔNG trả 1%), sàn, NMG, lướt sóng (giữ HĐMB), chủ nhà. Nhị phân CCRB 1%/NMG 0.5% của BR-05 là
đơn giản hoá; gặp CĐT bot không được tự báo con số phí.
**Phương án**: (a) giữ nhị phân, thêm cờ "là CĐT?" để bot né báo phí; (b) mở `seller_type` thành 5
vai + luật hỏi theo giai đoạn dự án; (c) chờ gặp CĐT thật.
**Khuyến nghị BA**: (a) ngay, (b) khi có dự án sơ cấp đầu tiên. **Chờ**: chủ dự án.

### OPEN-22 · Một người vừa mua vừa bán cùng một Zalo
✅ Chủ dự án chốt 27/08/2026: "chia data từng dòng theo id bất động sản, vừa mua vừa bán thì lưu 2
dòng" và "cứ lấy id zalo của người đó thôi" — nhận diện người theo `zalo_user_id`, VAI xét từng lượt
theo nội dung tin. Hiện thực: FR-157 (d), chat-reply v33, TS-NEO-04.

### OPEN-23 · `rate-ctv` trùng chức năng với `ctv-report`
✅ Chủ dự án chốt 27/08/2026 ("ok xóa"): drop `public.ratings` (0 dòng), xoá
`bot/supabase/functions/rate-ctv/` và function trên Dashboard; FR-102 `[deprecated → FR-137]`. Chấm
điểm CTV chỉ còn một đường: báo cáo 17h.

### OPEN-24 · `pg_net` mở cho `anon` — mồi SSRF không vá được bằng SQL
**Vấn đề**: `anon` có USAGE schema `net` + EXECUTE `net.http_post` (đo 26/08); chưa khai thác được
chỉ vì PostgREST không phơi `net` — hàng rào cấu hình, không phải quyền. Không tự REVOKE được: schema
thuộc `supabase_admin`, lệnh từ vai `postgres` là no-op im lặng.
**Phương án**: (a) gác cửa — giữ Exposed schemas đúng `public, graphql_public`, cấm hàm SECURITY
INVOKER trong `public` gọi `net.*`; (b) ticket Supabase xin thu hồi grant mặc định; (c) bỏ `pg_net`
— không khả thi, cron gọi edge function qua nó.
**Khuyến nghị BA**: (a) ngay + (b) song song. **Chờ**: chủ dự án (ticket Supabase).

### OPEN-25 · Bậc miễn phí không có lưới an toàn
✅ Chủ dự án chốt 27/08/2026 ("free trước đi, đã có user đâu"): ở lại Supabase Free + Vercel Hobby,
điều kiện: `scripts/sao-luu.mjs` định kỳ (Free không có backup) + giám sát bridge (ntfy + systemd đã
có 04/09, VPS chưa bật). **Xem lại khi có giao dịch thật đầu tiên** — Vercel Hobby cấm dùng thương mại.

### OPEN-26 · Ngưỡng hạng Đồng/Bạc/Vàng
**Vấn đề**: FR-155 chạy với ngưỡng [giả định BA] (NMG: Vàng ≥10 tin và chốt ≥5%, Bạc ≥5 tin hoặc ≥1
chốt; CCRB: Vàng ≥1 chốt, Bạc đủ thông tin lên sàn). Chỉ vế NMG có nguồn (`/moi-gioi`, `biz
model.docx`). Kho chưa có giao dịch `da_chot` nên chưa ai lên Vàng được.
🟡 Chủ dự án chốt phần hiển thị 27/08 ("ẩn hạng khỏi web đi"): hạng chỉ hiện ở `/admin`.
**Phương án**: (a) chốt ngưỡng thật kèm quyền lợi mỗi hạng (ưu tiên khách nét? giảm phí? trần số căn
cho Đồng như AOND?); (b) giữ ngưỡng tạm tới khi có số thật.
**Khuyến nghị BA**: (b) rồi (a) khi có giao dịch thật để định cỡ. **Chờ**: chủ dự án.

### OPEN-27 · Mở địa bàn ra HCM mới + Long An
**Vấn đề**: 27/08 chủ dự án: "đánh bds trong khu vực hcm mới và long an tây ninh, nhưng hiển thị
hoặc tìm kiếm vẫn là tên cũ cho user dễ dùng". 🟡 Chốt nửa đầu 03/09: "bán sản phẩm bất động sản ở
Sài Gòn, các phường mới và Long An" → địa bàn = TP.HCM phường mới + Long An (không Tây Ninh), trọng
tâm bán, khởi điểm Quận 5 cũ; ghi vào `00 §0.1/0.2/0.8`, BR-01/02, FR-174 đợt 1. Còn ghi cứng: regex
phường, 16 phường ở form admin, từ điển lóng, 15 toạ độ `lib/geo.ts`.
**Phương án (nửa sau)**: (a) "tên cũ" lấy mốc nào — trước NQ 202/2025 hay tên dân gọi; (b) DB lưu
tên cũ hay mới, bên nào là bản dịch (bảng `wards` — FR-118); (c) mã tin `BDS-Q5-####` giữ làm ID vô
nghĩa hay đổi; (d) thứ tự mở cụm/huyện; (e) "các phường mới" là địa bàn hay tên hiển thị.
**Khuyến nghị BA**: hiện cả hai tên; bảng `wards` một nguồn (mã, tên mới/cũ, quận cũ, tỉnh, toạ độ);
giữ mã tin; mở Long An theo MỘT huyện có hàng thật → FR-174 đợt 2. **Chờ**: chủ dự án chốt (a)…(e).

### OPEN-28 · Phí có đi theo phân loại tự động của FR-160 không?
**Vấn đề**: FR-160 định "≥3 tin rao bán = môi giới", nhưng `seller_type` đồng thời là căn cứ phí
(CCRB 1%, NMG 0.5%): chính chủ mở tin thứ ba là phí tự rơi một nửa, gỡ tin lại leo.
🟡 Chủ dự án chốt nửa đầu 02/09 ("Gán nhãn khi ai bóc tách là họ có bds muốn bán"): nhãn gán lúc mở
hồ sơ từ chat — có BĐS bán = chính chủ, tự xưng môi giới = môi giới (FR-159, `20260902a`); `unknown`
→ `fee_pct = null`. Nghiệm thu 04/09: FR-160 chưa có trong code, hàm DB không ghi đè nhãn đã có.
**Phương án**: (a) tách hai khái niệm — cột dẫn xuất `vai_hanh_vi` từ số tin (cho giọng drip +
hạng), `seller_type` khai tay là căn cứ phí; (b) ghép làm một, phí trôi theo số tin.
**Khuyến nghị BA**: (a) — phí là cam kết, không đổi sau lưng. **Chờ**: chủ dự án, trước khi code FR-160.

### OPEN-29 · Bot điếc với tiếng Việt không dấu
✅ Chủ dự án chốt 27/08/2026 ("sửa theo khuyến nghị rồi deploy hết đi"): chuẩn hoá bỏ dấu một lần đầu
hàm, mọi regex cổng chạy trên bản không dấu, giữ `text` gốc cho model → FR-161.

### OPEN-30 · Một lệnh gọi model hỏng kéo sập cả lượt chat
✅ Chủ dự án chốt 28/08/2026 ("Fix đi"): ba lệnh gọi model nhánh seller và bước tạo `anthropicClient`
bọc try/catch + `ghiLoi` + câu mẫu tất định (chat-reply v40); cùng lưới trải sang `nudge` v14+
(FR-166). Không mở `info_requests` khi chưa hỏi được.

### OPEN-31 · Bậc nguồn khi admin cầm bằng chứng cứng
**Vấn đề**: FR-164(a) xếp `chu_xac_nhan` (3) > `admin` (2) > `suy_doan` (1) và KHOÁ cột sau lời chủ
— đúng với tin admin nhặt từ Chợ Tốt/Facebook (FR-156), nhưng admin cầm sổ đỏ mà chủ nhà nhớ nhầm
diện tích/phường thì không ghi đè được.
**Phương án**: (a) thêm bậc `admin_xac_minh` (4) cho trường hợp đã đối chiếu giấy tờ; (b) giữ
nguyên, admin nhắn hỏi để chủ nhà tự sửa.
**Khuyến nghị BA**: (a) — bằng chứng giấy tờ khác hẳn lời nói. **Chờ**: chủ dự án. Chưa dựng.

### OPEN-32 · Ảnh gửi qua chat nằm ngoài ranh giới công khai/riêng tư
**Vấn đề**: FR-165 ràng `so_do`/`giay_to` phải ở `listing-private`, nhưng chỉ với file đi qua kho.
Ảnh chủ nhà gửi qua Zalo được `chat-reply` lưu URL CDN thành fact `hinh_anh` bất kể câu hỏi đang chờ
(kể cả `phap_ly` — trả lời bằng ảnh sổ là chuyện thường), rồi FR-143 gộp vào `photos` gửi khách.
**Phương án**: (a) ảnh trả lời câu `phap_ly` (hoặc model đọc ra là giấy tờ) ghi nhãn `giay_to`,
không vào `photos`; (b) kéo ảnh chat về `listing-private` rồi phân loại; (c) chặn ở duyệt tay FR-105.
**Khuyến nghị BA**: (a), làm sớm — đường rò giấy tờ đất của người dân. **Chờ**: chủ dự án (đợt
FR-165 khoanh vùng "không đụng luồng chat").

### OPEN-33 · Webhook Zalo đang nhận sự kiện KHÔNG kiểm chữ ký
**Vấn đề**: `zalo-webhook` chạy `verify_jwt=false`, hàng rào duy nhất là chữ ký `X-ZEvent-Signature`;
khối verify chỉ chạy khi Vault có `ZALO_APP_SECRET` + `ZALO_APP_ID` — hiện không có. Đo 29/08: POST
sự kiện bịa → 200. Giả được tin với bất kỳ `sender.id` (bơm fact vào tin người khác, bơm rác đốt tiền
model). FR-167 cho nó kêu vào `bot_errors`.
**Phương án**: (a) đặt hai secret vào Vault — verify tự bật, không sửa code; (b) chặn cứng — bot chết.
**Khuyến nghị BA**: (a), việc 5 phút. **Chờ**: chủ dự án (chỉ chủ dự án có secret app Zalo).

### OPEN-34 · Gộp `zalo-webhook` → `chat-reply` thành một lambda?
**Vấn đề**: mỗi tin đi qua hai edge function (nhận + gọi HTTP nội bộ sang `chat-reply`), tốn
~200–400 ms và compute đôi. Nêu ở FR-171, cố ý chưa làm vì ranh giới hai hàm đang giữ luật chống gửi
đúp (FR-162/166) và `chat-reply` là bộ não dùng chung mọi kênh (NFR-12).
**Phương án**: (a) giữ hai hàm; (b) gộp khi lưu lượng lên ~10×.
**Khuyến nghị BA**: (a) — thứ đáng tiền hiện là model, không phải lambda. **Chờ**: chủ dự án.

### OPEN-35 · Nhắc lời hứa / hỏi thăm khách im: mẫu câu hay lượt model?
**Vấn đề**: `nudge` và `ask-seller` gọi model cho mỗi tin nhắc/câu hỏi nhỏ giọt dù khuôn gần cố
định. Mẫu câu xoay 3–4 biến thể làm được ~80% với chi phí 0, nhưng nghe "máy" hơn và follow-up căn
(FR-32) cần một chi tiết thật từ fact.
**Phương án**: (a) giữ model cho follow-up căn + câu hỏi nhỏ giọt, mẫu câu cho nhắc lịch xem + nhắc
lời hứa; (b) model hết như hiện tại.
**Khuyến nghị BA**: (a), chốt sau vài tuần có số ở thẻ "Tiền bộ não" `/admin`. **Chờ**: chủ dự án.

### OPEN-36 · KYC người bán có mâu thuẫn với ẩn danh hai chiều không?
✅ Chủ dự án chốt 02/09/2026: "Không phải ẩn danh nhưng tất cả thông tin người bán đã chia sẻ sẽ lưu
và khi khách hỏi thì mới khai báo chứ" → LƯU HẾT — KHAI KHI HỎI; INS-11 chỉnh lại. Còn giữ [giả định
BA]: SĐT/Zalo người bán chỉ mở lúc chốt lịch xem (UF-06, FR-104). KYC chưa làm tới khi có NMG thật.

### OPEN-37 · Lớp dữ liệu vị trí (quy hoạch, ngập, POI)
**Vấn đề**: radanhadat mua lớp FIMO, mogi/batdongsan có POI; ta có `lat/lng` 164/173 tin (FR-122) và
khách hỏi "gần hồ bơi Lam Sơn" (INS-07). Câu trả lời sai về quy hoạch là rủi ro pháp lý (§6.8 cấm
khẳng định).
**Phương án**: (1) `pois` Quận 5 tự nhập + OSM, 0 đồng; (2) khoảng cách/thời gian tới POI tính sẵn
mỗi tin; (3) quy hoạch/ngập theo thửa — cần nguồn trả tiền.
**Khuyến nghị BA**: (1) + (2); (3) chỉ khi có nguồn chính thức. Gộp OPEN-13. **Chờ**: chủ dự án.

### OPEN-38 · Ảnh tin: thumbnail và watermark trên bậc Free
**Vấn đề**: ta lưu file gốc (vài MB/tấm) trong `listing-public`; lưới 24 thẻ = vài chục MB nếu có
ảnh thật. Biến đổi ảnh của Supabase là tính năng Pro (NFR-16).
**Phương án**: (a) `up-anh.mjs`/upload web sinh thêm bản 480px (sharp) vào `listing_media.variants`;
(b) `next/image` loader tự viết (Hobby có hạn mức); (c) chờ Pro. Watermark: chỉ khi có tin bị chép.
**Khuyến nghị BA**: (a), làm khi có >20 tin có ảnh thật. **Chờ**: chủ dự án.

### OPEN-39 · Tên thương hiệu và tên trợ lý
✅ Chủ dự án chốt 03/09/2026: "bot Thái và Aioinhadat, không có gia đình trợ lý gì hết" — thương hiệu
Aioinhadat, MỘT trợ lý tên Thái, bỏ kho tên •ai của AOND §II. Đã sửa `_shared/prompts.ts`
(TONE_RULES, RATE_CTV_RUBRIC), `bot_prompts` trên DB, `06 §6.8`. Domain chưa đổi (OPEN-08).

### OPEN-40 · Phạm vi loại BĐS: cho thuê, đất nền, công nghiệp
**Vấn đề**: AOND §III tả ba nhóm BĐS + thông số cho thuê; FR-172 mới phủ nhóm nhà ở. Cho thuê đã có
tin và phí ¾ tháng nhưng cột chỉ có `rent_income_vnd`; đất chờ nguồn quy hoạch OPEN-37; công nghiệp 0 tin.
**Phương án**: (a) làm thông số cho thuê ngay (4 cột + regex + drip), đất chờ OPEN-37, công nghiệp
không làm; (b) làm cả ba đúng AOND; (c) không làm gì tới khi khách hỏi.
**Khuyến nghị BA**: (a). **Chờ**: chủ dự án.

### OPEN-41 · Nhà cung cấp model
**Vấn đề**: AOND §VII bắt đầu bằng Gemini rồi chuyển về chạy local (máy ASUS GX10); hệ thống thật
chạy Claude qua Supabase Edge với lớp gọi model duy nhất `_shared/claude.ts`, não cấu hình được
(FR-138), đo tiền (FR-169), chuông hết tiền (FR-168); bộ `10` neo vào hành vi model hiện tại.
**Phương án**: (a) giữ, ghi nhận lớp gọi model là chỗ đổi duy nhất; (b) đổi sang Gemini; (c) lai —
Gemini cho OCR giấy tờ, Claude cho hội thoại.
**Khuyến nghị BA**: (a); xem lại khi hoá đơn vượt ngưỡng FR-168 hai tháng liền. **Chờ**: chủ dự án.

### OPEN-42 · Ngưỡng CTV: hạn trả lời và mốc hạng
**Vấn đề**: chủ dự án 03/09: "nếu CTV bận sau khoảng thời gian chưa rep thì chấm điểm Đồng/Bạc/Vàng,
và nhắn để admin hỗ trợ khách" — không nêu số. BA đặt tạm: hạn 120 phút (`ctv_sla_phut()`, kiểm 15
phút trong 8–20h VN); hạng theo tỷ lệ đúng hạn 30 ngày Vàng ≥90%, Bạc ≥70%, dưới 3 câu = chưa đủ dữ
liệu (FR-173). Thang riêng cho CTV, khác FR-155.
**Phương án**: (a) giữ tới khi có ~30 câu thật rồi định cỡ; (b) hạn theo giờ làm việc; (c) gộp vào
điểm chăm khách 4 tiêu chí FR-137.
**Khuyến nghị BA**: (a), ngưỡng để trong hàm DB; hạng phải kèm hệ quả (ưu tiên đơn? thưởng?) — chốt
cùng lúc. **Chờ**: chủ dự án.

### OPEN-43 · Tài liệu tả nhiều thứ chưa dựng như đã có
**Vấn đề**: nghiệm thu 04/09 (`10 §10.8.2`) thấy một lớp đặc tả chưa dựng nhưng không đánh dấu. 🟡
Cùng ngày chủ dự án: "dựng hết đi, giữ chân 5 ngày" → đã dựng phần lớn (`10 §10.8.4`: FR-60…65,
FR-70…80, FR-01…10, FR-96/100/117, SEO nền, email ntfy, chat-reply v48 — TS-GIUCHAN/TS-V48/TS-WEB2).
**Còn treo thật sự**: FR-16/NFR-08 fingerprint (OPEN-14), FR-95 Zalo SSO (cần app Zalo), FR-118
(OPEN-27), FR-160 (OPEN-28), FR-28 POI (OPEN-13), `?ref=` (zalo.me cá nhân rớt tham số — chờ OA),
FR-93 biến thể câu rao, FR-94 màn xác nhận bản bóc tách, FR-24 nút "Xem thêm" (Zalo cá nhân không có nút).
**Phương án**: (a) gắn nhãn `[thiết kế — chưa dựng]` cho phần còn lại; (b) `[deprecated]` cho
SRS-4.1/4.2/4.4/4.7, `escalations`, email thuần SRS-5.5 (đã có đường thay thế: bảng + trigger, ntfy).
**Khuyến nghị BA**: (b) cho phần có đường thay thế, (a) cho phần còn lại; không đánh số lại (quy ước
3). **Chờ**: chủ dự án chốt nhãn.

### OPEN-44 · SEO
**Vấn đề**: tới 04/09 web chỉ có `title`/`description` từng trang. 🟡 Cùng ngày đã dựng nền:
`app/sitemap.ts`, `app/robots.ts`, canonical + OpenGraph, JSON-LD `RealEstateListing`, trang tag
`app/[tag]` với 64 tag SSG từ taxonomy (`lib/tags.ts`), TS-SEO-01…03.
**Còn treo**: bộ TOP-100 keyword thật (OPEN-06); tag theo khu mới sau OPEN-27; đăng ký Google Search
Console cho nhadat.cc và gửi `/sitemap.xml` — ai giữ tài khoản?
**Khuyến nghị BA**: đăng ký Search Console ngay; keyword theo OPEN-06. **Chờ**: chủ dự án.

### OPEN-45 · Design token `06` lệch code
**Vấn đề**: `06 §6.2`, `design/tokens.json` và `app/globals.css` (đặt theo theme cắt, OPEN-07) là ba
bản không khớp; wireframe `05` có 6/14 màn chưa dựng (WF-08, WF-11, WF-13…). Việc Figma
(`design/figma-handoff.md`) đang dựng theo `06` — thứ web không dùng.
**Phương án**: (a) code làm gốc, sinh lại `tokens.json` từ `globals.css`, sửa `06`; (b) sửa code theo `06`.
**Khuyến nghị BA**: (a); wireframe chưa dựng gắn nhãn theo OPEN-43. **Chờ**: chủ dự án.

---

### Advisor Supabase — các cảnh báo cố ý giữ

Ghi lại để lần sau không ai đi "vá" nhầm. Mọi cảnh báo dưới đây là chủ ý, đã đo.

| Cảnh báo | Đối tượng | Vì sao giữ |
|---|---|---|
| `security_definer_view` (ERROR) | `agents_public` | Anon phải đọc được hình chiếu NMG đã cắt sạch liên hệ (FR-125). View **tự chứa**, không join view khác — `20260827g` từng lỡ đổi sang invoker làm `/moi-gioi` trống, vá `20260904b` (TS-SEC-08) |
| `security_definer_view` (ERROR) | `listing_photos_v` | Ghép URL từ `app_config` mà anon đã bị thu quyền đọc (TS-KHO-21); chỉ trả ảnh bucket public của tin đã lên kệ (FR-167c) |
| `security_definer_view` (ERROR) | `ctv_ranks`, `hoi_thoai_thong_ke`, `khach_can_nguoi_that`, `nmg_hoat_dong`, `bds_hot`, `bot_do_tre` | Bảng nguồn bật RLS không policy; view tự gác cổng bằng `auth.role() = 'service_role'` hoặc email trong `admins`; anon đọc 0 dòng (TS-CTV, TS-ADM2) |
| `anon_security_definer_function_executable` (WARN) | 8 hàm trigger của đợt 04/09 | **Đã vá `20260904h`** — Supabase cấp EXECUTE cho `public` theo mặc định nên hàm trigger mới lộ ra `/rest/v1/rpc/`; nay chỉ còn `service_role` |
| `anon_security_definer_function_executable` (WARN) | `log_loi` | Web chạy publishable key nên phải mở cho anon (FR-152 d); có van 20 dòng/nguồn/giờ và 200 dòng/giờ |
| `extension_in_public` (WARN) | `pg_net` | Schema thuộc `supabase_admin`, không tự chuyển được — cùng gốc OPEN-24 |
| `rls_enabled_no_policy` (INFO ×12) | `messages`, `conversations`, `reminders`, `deals`… | Bật RLS không policy = chặn hết, chỉ `service_role` đụng được — đúng ý |
| `multiple_permissive_policies` (WARN hiệu năng) | `listings`, vai `authenticated` | Giữ 3 policy cho rõ luật quyền; gộp khi `listings` qua ~10k dòng. 8 index chưa dùng: để đó, bảng còn nhỏ |
