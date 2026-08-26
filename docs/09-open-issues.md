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
| OPEN-07 | Theme — **ĐÃ CHỐT: KingTheme (HTML template), cắt vào Next.js**, 24/08/2026 | Trung bình | Toàn bộ `06` |
| OPEN-08 | Tên thương hiệu và tên miền | Thấp | Copy toàn hệ thống |
| OPEN-09 | Zalo OA có cho gửi tin chủ động ở tần suất cần? | Cao | FR-63, FR-64 |
| OPEN-10 | FR-99 định giá so sánh — chưa có đặc tả | Trung bình | FR-99 |
| OPEN-11 | Logstash làm hàng đợi tin nhắn | Cao | NFR-04 |
| OPEN-12 | Quy trình chấm điểm & chấm dứt NMG | Trung bình | FR-102 |
| OPEN-13 | Nguồn dữ liệu tiện ích quanh BĐS | Thấp | FR-28 |
| OPEN-14 | Chính sách fingerprint & tuân thủ dữ liệu cá nhân | Trung bình | FR-16, NFR-08 |
| OPEN-15 | Hàng dự án (căn/giỏ hàng) — **ĐÃ CHỐT: phương án (b)**, 24/08/2026 | Cao | → FR-113…FR-117 |
| OPEN-16 | ~~Có cần CRM riêng không?~~ **Đã chốt (b)** — bảng deals, không CRM ngoài | — | OPEN-02 |
| OPEN-17 | Định dạng mã công khai listing (#35148 vs BDS-Q5-0012) | Thấp | Copy web + chat |
| OPEN-18 | Kho file: Supabase Storage vs OneDrive (qua adapter) | Trung bình | FR-111, NFR-06 |
| OPEN-19 | ~~3 công cụ B-side kiểu radanhadat~~ **Đã chốt (b)** 25/08/2026 — tính lãi vay làm rồi (FR-119, port NhaDat-Radar); quy hoạch không tự khẳng định; thời gian di chuyển để giai đoạn 2 | — | FR-119 |
| OPEN-20 | Gamification điểm uy tín người rao (Đồng/Bạc/Vàng) theo AOND — có đem vào nhadat.cc không | Trung bình | FR-102, FR-103 |
| OPEN-21 | Vai người rao 5 loại (CĐT/sàn/NMG/lướt sóng/chủ nhà) + phí riêng cho CĐT — mở rộng nhị phân CCRB/NMG? | Trung bình | BR-05, FR-101 |
| OPEN-22 | Một người **vừa mua vừa bán** bằng cùng một Zalo: hiện `chat-reply` hễ khớp `sellers.zalo_user_id` là luôn tiếp theo vai người bán — người này không hỏi mua được. Dữ liệu tin thì an toàn (mọi quan tâm/hỏi đáp bám theo mã căn, FR-139/140), chỉ vướng vai hội thoại. Phương án: (a) bot tự đoán vai theo nội dung tin từng lượt; (b) lệnh chuyển vai ("tôi muốn tìm mua"); khuyến nghị BA: (b) trước, (a) sau. Chờ chủ dự án chốt | Trung bình | FR-129, FR-130 |
| OPEN-23 | Edge function `rate-ctv` (FR-102) **trùng chức năng** với phần chấm điểm CTV nằm sẵn trong `ctv-report` (cùng rubric `RATE_CTV_RUBRIC`, cùng 4 tiêu chí): không có cron, không nơi nào gọi, bảng `ratings` nó ghi vào đang 0 dòng và không màn hình nào đọc. Phương án: (a) xoá `rate-ctv` + bảng `ratings`, đánh dấu FR-102 `[deprecated → FR-137]`; (b) giữ làm cửa chấm-lại-một-hội-thoại theo yêu cầu (admin bấm nút), khi đó cần màn hình đọc `ratings`. Khuyến nghị BA: (a) — chấm điểm đã nằm trong báo cáo 17h, giữ hai đường chấm là nguồn lệch số. Chờ chủ dự án chốt | Thấp | FR-102, FR-137 |
| OPEN-24 | `pg_net` mở cho `anon`: `has_schema_privilege('anon','net','usage')` và `has_function_privilege('anon','net.http_post…')` đều `true` → mồi **SSRF** (ai cầm anon key mà chọc tới `net.*` là sai DB gọi HTTP đi bất cứ đâu, từ IP của Supabase). Hôm nay chưa khai thác được vì PostgREST chỉ phơi `public` — nhưng đó là hàng rào cấu hình, không phải hàng rào quyền. **Không tự vá được**: schema `net` do `supabase_admin` sở hữu, ta là `postgres`, REVOKE thành no-op im lặng. Phương án: (a) gác cửa (giữ Exposed schemas đúng `public, graphql_public`; cấm hàm SECURITY INVOKER trong `public` gọi `net.*`); (b) mở ticket Supabase xin thu hồi grant mặc định. Khuyến nghị BA: (a) ngay + (b) song song | Cao | NFR-06, SRS-3.9 |

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
> ✅ **ĐÃ CHỐT HOÀN TOÀN**, chủ dự án, 24/08/2026: dùng theme **KingTheme** đã mua
> (nằm trong `ThemeForest/KingTheme`, ngoài repo), là **HTML template** → **cắt
> thẳng vào Next.js**, giữ nguyên stack Supabase + Vercel. Việc còn lại là thi
> công: đưa HTML/CSS của theme vào tầm với của phiên code (Cline local hoặc repo
> private riêng), map token màu/chữ của theme về `design/tokens.json`.
> Phân nhánh cũ dưới đây giữ làm hồ sơ:
> - Theme **HTML/React/Next template** → cắt thẳng vào app Next.js, giữ nguyên
>   stack Supabase + Vercel. Độ khó thấp.
> - Theme **WordPress** (có file `.php` + `style.css`) → hoặc (i) chạy WP làm site
>   listing/SEO (cần hosting PHP, khó free tốt; bot vẫn dùng Supabase) hoặc
>   (ii) chỉ lấy HTML/CSS của theme cắt sang Next.js. Khuyến nghị (ii).
> Tông màu/copy vẫn theo design system `docs/06`; token có thể map lại theo theme.

`ThemeForest/` (274MB) bị loại khỏi repo vì bản quyền; `Vedoo pages/` chỉ là ảnh
chụp, cũng đã xoá khỏi repo 26/08/2026.
**Phương án cũ**: (a) mua license Veedoo và dùng cho WordPress; (b) tự dựng UI trên
Next.js + Tailwind theo design system ở `06`.
**Khuyến nghị cũ**: (b). Quyết định thực tế của chủ dự án: dùng KingTheme (license
ThemeForest regular: 1 end product — hợp lệ cho nhadat.cc; asset của theme dùng
được trong sản phẩm, nhưng **không commit theme vào repo public**).

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
> ✅ **ĐÃ CHỐT — phương án (b)**, chủ dự án, 24/08/2026. Hiện thực hoá thành
> `FR-113`…`FR-117` (docs/02 nhóm I), cập nhật UF-05/UF-09, WF-09, SRS-3.1/3.10/5.1,
> AC-13. Giữ nguyên mục này làm hồ sơ quyết định.

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

**Trạng thái: ĐÃ CHỐT phương án (b)** — spec "Cầu Nối BĐS" v2 của chủ dự án đưa
bảng `deals` vào thiết kế chính thức (FR-112), và schema đã tồn tại trên Supabase
`nhadat-cc`. Còn treo duy nhất: định nghĩa stage chờ `OPEN-02`.

### OPEN-17 · Định dạng mã công khai listing
Bộ docs dùng `#35148` (số tự tăng, cue "Khi Zalo nhớ hỏi #35148"); spec Cầu Nối
dùng `BDS-Q5-0012` (tiền tố + quận + số) [nguồn: artifact "Cầu Nối BĐS" v2, phiên nhadat-bot, 08/2026].
**Phương án**: (a) `#35148` — ngắn, dễ đọc trong chat; (b) `BDS-Q5-0012` — tự mô tả
khu vực, đẹp cho SEO/URL, nhưng dài khi gõ tay.
**Khuyến nghị**: (b) làm mã chính thức trong DB/URL; chat chấp nhận mọi cách gõ
("0012", "Q5-0012", "BDS-Q5-0012"). Cần chốt trước khi in mã lên web.

### OPEN-18 · Kho file: Supabase Storage vs OneDrive
SRS đặc tả Supabase Storage (NFR-06: bucket riêng cho sổ đỏ, signed URL 15 phút);
spec Cầu Nối dùng OneDrive làm kho file sau adapter, "thay được không đụng logic
bot" [nguồn: artifact "Cầu Nối BĐS" v2, phiên nhadat-bot, 08/2026]. Hai bên thống nhất một điểm: **kho file nằm sau adapter**
(FR-111) — bất đồng chỉ còn là backend mặc định.
**Phương án**: (a) Supabase Storage — cùng hệ DB, signed URL + RLS có sẵn, đạt
NFR-06 ngay; (b) OneDrive — dung lượng rẻ, nhưng tự xây kiểm soát truy cập, khó
đạt NFR-06.
**Khuyến nghị**: (a) làm mặc định MVP, giữ interface adapter; OneDrive làm kho
lạnh (ảnh gốc dung lượng lớn) nếu chi phí Storage thành vấn đề.

> **Cập nhật 24/08/2026** — chủ dự án nghiêng về OneDrive (đã có sẵn theo
> Microsoft 365 công ty, dung lượng lớn, chi phí 0đ tăng thêm). Đánh giá kỹ thuật:
> OneDrive làm **kho gốc/kho lạnh** thì dễ (đồng bộ tay hoặc Graph API một chiều);
> OneDrive làm **origin phục vụ web** thì khó vừa-khó: cần app Azure AD + token
> refresh, share link không phải CDN (chậm, rate limit), không resize ảnh, không
> signed URL ngắn hạn cho sổ đỏ (NFR-06). Khuyến nghị giữ nguyên hybrid: ảnh gốc
> OneDrive, ảnh nén phục vụ web trên Supabase Storage (free 1GB ≈ 8–12k ảnh nén
> ≈ đủ MVP Quận 5); vượt free thì cân nhắc Cloudflare R2 trước khi trả Supabase Pro.

### OPEN-19 · Công cụ B-side kiểu radanhadat: làm không, làm lúc nào

> ✅ **ĐÃ CHỐT — phương án (b)**, chủ dự án, 25/08/2026 → FR-119.
> Tính lãi vay làm dạng **trang web** `/tinh-lai-vay` (không phải chat như phân
> tích dưới) vì port sẵn từ repo NhaDat-Radar của chủ dự án; trang nhận
> `?price=` từ tin và CTA chốt vẫn đẩy về Zalo — không trái IA-P1. Bot trả lời
> câu tính vay trong chat làm ở vòng sau. Quy hoạch: không tự khẳng định
> (RSK-03). Thời gian di chuyển: giai đoạn 2.

**Nguồn**: phân tích đối thủ radanhadat.vn (`01 §1.5b`, WebSearch 24/08/2026).
Ba công cụ phía người mua của radanhadat — (1) tìm theo thời gian di chuyển,
(2) kiểm tra quy hoạch, (3) phân tích tài chính/khoản vay — đều khả thi ở dạng
**bot trả lời trong chat** thay vì widget web (đúng IA-P1). Nhưng mỗi cái kéo
theo nguồn dữ liệu/chi phí riêng: routing API (Goong/Mapbox), dữ liệu quy hoạch
(chưa có nguồn máy-đọc-được đáng tin — dính RSK-03), công thức khoản vay (dễ).
**Phương án**: (a) không làm ở MVP, chỉ giữ khe cho giai đoạn 2; (b) làm ngay
món rẻ nhất (tính khoản vay trong chat); (c) làm cả ba.
**Khuyến nghị**: (a) cho quy hoạch (rủi ro khẳng định sai — chuyển thành câu hỏi
cho S theo INS-06), (b) cho khoản vay; thời gian di chuyển để giai đoạn 2.

### OPEN-20 · Gamification điểm uy tín người rao (theo AOND)

**Nguồn**: `AOND req + chat examples.docx` §IV (SRD "AI Ơi Nhà Đất", Luân
Ngô-Trần, 23/06/2026) — dự án chị em cùng chủ. AOND chấm **Điểm Uy tín người
rao** = trung bình điểm các BĐS đang rao × hệ số thưởng quy mô (NMG càng nhiều
căn thưởng lũy tiến càng chậm); điểm BĐS = 50% độ hoàn chỉnh dữ liệu + 50% độ
kịp thời phản hồi; hạng **Đồng** (<50đ, giới hạn 5 căn) / **Bạc** (50–79đ) /
**Vàng** (≥80đ, ưu tiên chuyển khách nét). Kịch bản chat gắn điểm vào từng câu
hỏi ("bổ sung ảnh bếp để cộng 5 điểm").
**Quan hệ với nhadat.cc**: FR-102 (chấm điểm NMG, đang treo OPEN-12) và FR-103
(không spam S) đã chạm một phần; nhadat-cc có sẵn `ratings` + độ đo
`listing_missing_facts` — nghĩa là 50% "độ hoàn chỉnh" tính được ngay.
**Phương án**: (a) không làm MVP, chỉ giữ số liệu ngầm (đếm fact đủ/thiếu, tốc
độ trả lời) để sau này quy đổi điểm; (b) làm điểm + hạng nhưng **không nói ra
trong chat** (dùng nội bộ xếp ưu tiên CTV/khách nét); (c) làm đầy đủ như AOND,
điểm hiện trong tin nhắn.
**Khuyến nghị**: (a) → (b). Đo ngầm từ bây giờ (rẻ), quyết định "nói ra trong
chat" sau khi có ≥20 NMG thật — nói điểm sớm quá với ít người dùng dễ thành trò
đùa. (c) chỉ khi hai dự án hợp nhất cơ chế.

### OPEN-21 · Vai người rao 5 loại + phí riêng cho chủ đầu tư

**Nguồn**: `AOND req + chat examples.docx` §V + `docs/data-model.md` AOND (kiến
thức ngành 24/06/2026). Thực tế có 5 vai: **chủ đầu tư** (bán sơ cấp — thường
trả hoa hồng cho sàn/môi giới, KHÔNG trả phí 1% như chính chủ), **sàn giao
dịch** (phân phối F1), **NMG**, **nhà đầu tư lướt sóng** (giữ HĐMB, bán chênh),
**chủ nhà** (=CCRB). Nhị phân CCRB 1% / NMG 0.5% của BR-05 là đơn giản hóa: map
= bên sở hữu (chủ nhà, lướt sóng) vs bên môi giới (sàn, NMG); CĐT là ca đặc
biệt phải thoả thuận riêng, bot **không được tự báo con số phí** khi gặp CĐT.
Hệ quả hành vi bot: hỏi theo giai đoạn dự án (chưa bàn giao sổ → hỏi HĐMB/mức
chênh, KHÔNG đòi sổ hồng; mở bán → hỏi theo mẫu căn).
**Phương án**: (a) giữ nhị phân, thêm cờ `là CĐT?` để bot né báo phí; (b) mở
rộng `seller_type` thành 5 vai + luật hỏi theo giai đoạn (FR-113…117 đã có nền
hàng dự án); (c) chờ gặp CĐT thật mới quyết.
**Khuyến nghị**: (a) ngay (một cột + một câu luật trong prompt, chặn rủi ro báo
phí sai), (b) khi có dự án sơ cấp đầu tiên vào kho.

### OPEN-22 · Một người vừa mua vừa bán cùng một Zalo

**Nguyên nhân**: `chat-reply` phân vai theo `sellers.zalo_user_id` — hễ khớp là
tiếp theo vai NGƯỜI BÁN cho mọi tin nhắn, nên chính chủ đang rao muốn hỏi mua
căn khác sẽ không vào được luồng người mua. Dữ liệu tin không bị ảnh hưởng:
quan tâm / hỏi đáp / escalation đều bám theo **mã căn** (FR-139, FR-140),
không bám theo người — chỉ vướng vai hội thoại.
**Phương án**: (a) bot tự đoán vai theo nội dung từng lượt (rủi ro đoán sai,
tốn một lượt model); (b) lệnh chuyển vai tường minh — khách nhắn kiểu "tôi
muốn tìm mua" thì lượt đó đi luồng buyer (rẻ, dễ kiểm soát).
**Khuyến nghị BA**: làm (b) trước, cân nhắc (a) sau khi có dữ liệu thật.
Chờ chủ dự án chốt.

### OPEN-23 · `rate-ctv` trùng chức năng với `ctv-report`

**Phát hiện**: đợt dọn logic dư 25/08/2026.

**Nguyên nhân**: FR-102 (`rate-ctv`) được dựng trước, chấm CSKH một hội thoại
theo yêu cầu. Sau đó FR-137 (`ctv-report`, báo cáo 17h) chấm luôn tối đa 3 hội
thoại/CTV/ngày bằng **cùng** `RATE_CTV_RUBRIC` và **cùng** 4 tiêu chí. Hiện
`rate-ctv` không có cron, không function/bridge/web nào gọi; bảng `ratings` nó
ghi vào có 0 dòng và không màn hình nào đọc.

**Phương án**
- (a) **Xoá** `rate-ctv` + bảng `ratings`, đánh dấu FR-102 `[deprecated → FR-137]`.
- (b) **Giữ** làm cửa chấm-lại-một-hội-thoại theo yêu cầu (admin bấm nút trong
  dashboard), khi đó phải làm màn hình đọc `ratings` để nó có ích.

**Khuyến nghị BA**: (a). Chấm điểm đã nằm trong báo cáo 17h; giữ hai đường chấm
ghi vào hai bảng khác nhau là nguồn lệch số về sau. Xoá một FR là quyết định của
chủ dự án nên chưa tự làm.

### OPEN-24 · `pg_net` mở cho `anon` — mồi SSRF không vá được bằng SQL

**Phát hiện**: soát cloud/compute 26/08/2026.

**Hiện trạng đo được**:

```
has_schema_privilege('anon','net','usage')                    → true
has_function_privilege('anon','net.http_post(...)','execute') → true
```

`net.http_post` là cửa cho Postgres tự gọi HTTP ra ngoài. Ai cầm anon key —
key nằm sẵn trong bundle JS của web, ai mở trang cũng lấy được — mà chọc tới
được `net.*` thì sai được DB gọi HTTP đi bất cứ đâu, **từ mạng và IP của
Supabase**. Đó là SSRF.

**Vì sao hôm nay chưa khai thác được**: PostgREST chỉ phơi schema `public` (+
`graphql_public`), mà `net` không nằm trong đó, nên `/rest/v1/rpc/http_post`
không tồn tại. Nhưng đó là hàng rào **cấu hình**, không phải hàng rào **quyền**.
Thủng ngay khi:
- (a) ai đó thêm `net` vào *Exposed schemas* (Dashboard → Settings → API); hoặc
- (b) có hàm `SECURITY INVOKER` mới trong `public` gọi `net.*` — hàm đó chạy
  bằng quyền người gọi, mà `anon` đang có đủ quyền.

**Vì sao không tự vá được**: schema `net` thuộc sở hữu `supabase_admin`, còn ta
kết nối bằng `postgres`. `REVOKE` quyền mình không cấp, trên object mình không
sở hữu, thì Postgres chỉ cảnh báo rồi bỏ qua — **không báo lỗi**. Migration
`soat_cloud_va_compute_26_08` có chạy lệnh revoke và `apply_migration` trả
success, nhưng kiểm lại `has_*_privilege` vẫn `true`: no-op hoàn toàn. Muốn
revoke thật phải là `supabase_admin`, vai Supabase không cấp cho khách.

**Phương án**
- (a) **Sống chung + gác cửa**: giữ *Exposed schemas* đúng `public,
  graphql_public` và kiểm định kỳ; cấm tuyệt đối hàm `SECURITY INVOKER` trong
  `public` gọi `net.*` (hàm nào cần HTTP thì `SECURITY DEFINER` + thu hồi
  EXECUTE khỏi `public, anon, authenticated`, đúng như `20260826c` đã làm).
- (b) **Mở ticket với Supabase** xin thu hồi grant mặc định của `pg_net` cho
  `anon`/`authenticated` trên project này.
- (c) Bỏ hẳn `pg_net` — không khả thi: cron `nudge_tick`/`seller_drip_tick` gọi
  edge function qua nó.

**Khuyến nghị BA**: (a) ngay, kèm (b) song song. (a) không tốn gì và đã đủ chặn
đường khai thác hiện có; (b) mới là dứt điểm nhưng phụ thuộc Supabase.
