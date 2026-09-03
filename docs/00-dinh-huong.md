# 00 — Định hướng (BRD hợp nhất nhadat.cc × AI Ơi Nhà Đất)

Phiên bản: **v1.0** · Ngày: **03/09/2026** · Trạng thái: **chờ chủ dự án chốt §0.8**

> **Vì sao có bản này.** Quyết định chủ dự án 03/09/2026: *"trình bày lại rõ ràng
> định hướng BRD, SRS các thứ vì giờ làm theo hướng aioinhadat nhiều hơn là
> nhadat.cc rồi."* Bộ `docs/` được viết từ tài liệu nhadat.cc 2024, rồi từ 25/08/2026
> code chạy theo SRD "AI Ơi Nhà Đất" (AOND, `AOND req + chat examples.docx`) ở
> ngày càng nhiều chỗ — nhưng chưa có trang nào nói thẳng **sản phẩm hôm nay là
> gì, giữ gì của bên nào, và còn gì chưa quyết**. Bản này là trang đó. Nó đứng
> trên `01`–`10`: tài liệu tầng dưới không được mâu thuẫn với nó; chỗ nào vênh thì
> ghi ở §0.8 và `09-open-issues.md`.
>
> Khung trình bày mượn ba skill trong bộ `phuryn/pm-skills` (MIT): *Product
> Strategy Canvas* (§0.4), *North Star Metric* (§0.5), *Strategy Red-Team* (§0.7).
> Nội dung thì lấy từ tài liệu gốc và quyết định đã ghi, có nguồn từng dòng.

## 0.1 Một câu định vị

**DH-01 · Định vị hợp nhất.** nhadat.cc là **người môi giới thường trực đứng sau
mọi môi giới khác** (*"the permanent agent of agents"* [nguồn: OKRs eo2024.pptx,
slide 1]), vận hành bằng **hai mặt của cùng một bot**:

- **Mặt bán chạy theo AOND**: người rao gõ một câu, gửi ảnh, không điền form; bot
  khen trước hỏi sau, mỗi lần một thông tin, nhặt dần qua nhiều ngày; dữ liệu
  tích lũy ngầm vào tin; người rao được xếp hạng theo mức chăm tin
  [nguồn: AOND §I, §II, §IV, §VI].
- **Mặt mua chạy theo nhadat.cc**: web là phễu SEO đẩy về Zalo kèm ngữ cảnh; khách
  không để số điện thoại; bot trả lời như người, tối đa 3 căn một tin, không khẳng
  định điều chưa xác minh; kết nối Zalo được giữ sống suốt chu kỳ 3–4 năm
  [nguồn: nhadat.cc website.docx; chats w B.docx; INS-01…INS-04].
- **Vòng lặp nối hai mặt** là thứ cả hai tài liệu cùng mô tả: khách hỏi → bot không
  biết → hỏi chủ → chủ trả lời → tin giàu thêm → báo lại khách. nhadat.cc gọi là
  INS-06; AOND gọi là *"Truy vấn chéo Bot-to-Bot"* [nguồn: AOND §VII]. Vòng này
  đã khép trên hệ thống thật ngày 02/09/2026 (FR-140 b/c).

Nói ngắn: **AOND là cách nhận hàng và nuôi hàng; nhadat.cc là cách bán hàng.**
Không có "chuyển dự án" — có một sản phẩm dùng hai bản thiết kế cho hai phía.

**DH-02 · Bốn bất biến, hướng nào cũng giữ.** Mọi tính năng mới, dù lấy từ AOND
hay nghĩ thêm, phải qua bốn cửa này (đã là luật ở `ba-pipeline`):

| # | Bất biến | Neo |
|---|---|---|
| 1 | Mọi trang web là phễu về Zalo; không kéo hội thoại ra khỏi Zalo | IA-P1, INS-01 |
| 2 | Không hỏi số điện thoại người mua ngoài bước chốt lịch xem | NFR-07, FR-53, INS-04 |
| 3 | Không khẳng định pháp lý / quy hoạch / còn-hết khi chưa xác minh — chuyển thành câu hỏi cho chủ | RSK-03, FR-40, AOND §II "hình như là" |
| 4 | Bot là trung gian toàn phần: lưu hết những gì chủ chia sẻ, khách hỏi mới khai, liên hệ chỉ mở lúc chốt lịch xem | INS-11, FR-104, OPEN-36 (chốt 02/09/2026) |

## 0.2 Hai nguồn gốc, một sản phẩm

| Khía cạnh | nhadat.cc (2024) | AOND SRD (06/2026) | Hôm nay đang chạy | Nguồn |
|---|---|---|---|---|
| Trọng tâm | Người mua chat trên Zalo OA; web SEO | Người rao gửi hàng tự nhiên; nuôi dữ liệu | Cả hai, cùng một bot `chat-reply`, tách vai từng lượt | FR-157, FR-159 |
| Cách nhận tin rao | Mini-site `/raoban` + câu rao thông thường | Text thô / thoại / ảnh, không form | Câu rao trong Zalo sinh mã tin ngay; ảnh có; thoại chưa | FR-158, FR-134, INS-05 |
| Nuôi tin sau khi đăng | TTL xác nhận 7 ngày | Xoay tua câu hỏi, 1 thông tin/lần, 1–2 căn/ngày với NMG | Đúng AOND | FR-129, FR-144, FR-107 |
| Văn phong | "Thái", 7 quy tắc §6.8 | Gia đình trợ lý •ai, quy tắc 30 từ | Văn phong AOND, bỏ dấu hiệu AI; tên vẫn "Thái"; 30–90 từ | §6.8 (25/08/2026) |
| Xếp hạng người rao | Chuẩn NMG ≥10 tin, chốt ≥5% | Điểm uy tín Đồng/Bạc/Vàng | Có hạng nhưng công thức khác, ẩn khỏi web | FR-155, OPEN-20, OPEN-26 |
| Phí | CCRB 1% · NMG 0.5% · thuê ¾ tháng | Giống hệt | Giống hệt | BR-05, §1.3, AOND §V |
| Địa bàn | Quận 5 | Quận 5 rồi mở rộng | Quận 5 + quyết định mở HCM mới, Long An, Tây Ninh | BR-01, OPEN-27 |
| Hạ tầng | Vendor Vitalify, Slack relay, Logstash | Gemini → máy local, SharePoint, Live Chat Monitor | Supabase Edge + Claude, Supabase Storage, bridge Zalo, `/admin` | SRS-2, OPEN-18, OPEN-03 |
| Người vận hành | 1.5 CTV | CTV dẫn khách cho CCRB | 2 CTV chia đơn xoay vòng + báo cáo 17h | FR-136, FR-137 |

## 0.3 SRD AOND: đã nhận gì, sửa gì, chưa nhận gì

Ký hiệu: ✅ đã làm đúng · 🔶 làm nhưng khác bản gốc · ⏳ chưa làm, giữ chỗ ·
❌ không nhận · ❓ chờ chủ dự án chốt.

| AOND | Nội dung | Trạng thái | Ở nhadat.cc |
|---|---|---|---|
| §I | Rao tự nhiên: text thô, không form, không dropdown | ✅ | FR-92, FR-158, FR-144, FR-161 (không dấu); FR-109 (hỏi tuần tự) chỉ là đường phụ |
| §I | Tin nhắn thoại | ⏳ | FR-134 ghi rõ "voice/STT chưa làm" |
| §I | Tích lũy dữ liệu ngầm, nhặt dần qua các phiên | ✅ | FR-129, FR-144, FR-153, FR-172 (bóc thông số từ mô tả) |
| §I | 200–300 người dùng/ngày, 6.000–9.000 tin/ngày; phủ 90% Quận 5 | 🔶 | NFR-05 (~300 chat sống, 5.000 tin), BR-01; hạ tầng đang Free-tier (NFR-16) — chưa đo ở tải đó |
| §II | Kho tên trợ lý •ai (b•ai, m•ai, t•ai…) | ❓ | Bot là một persona "Thái" (§6.8). Tên trợ lý đi cùng tên thương hiệu → **OPEN-39** |
| §II | Quy tắc 30 từ | 🔶 | Tin thu thập ~30 từ (FR-129); tin trả lời khách 30–90 từ (§6.8 quy tắc 4) — cố ý, vì khách hỏi pháp lý cần hơn 30 từ |
| §II | Khen điểm mạnh trước, hỏi tối đa 1 thông tin/lần | ✅ | FR-129, §6.8 "Kịch bản người bán" |
| §II | Trung thực với ảnh, "hình như là", xác nhận lại | ✅ | FR-134 |
| §III | Nhóm 1 nhà ở: kết cấu, lộ giới/hẻm, bàn giao, hoàn công | ✅ | FR-172: `floors`, `access_type`, `alley_width_m`, `has_completion`, `legal_status`… (INS-13) |
| §III | Nhóm 2 đất: kích thước, chỉ tiêu xây dựng, quy hoạch, hạ tầng | ⏳ | Có `planning_status`, `frontage_m × length_m`; chỉ tiêu xây dựng và cột điện/hố ga chưa có; nguồn quy hoạch treo ở OPEN-37 |
| §III | Nhóm 3 sản xuất/thương mại: kho, xưởng, đất SKC/TMD | ❓ | Enum `property_type` (SRS-3.1) chưa có loại này *[giả định BA: chưa đếm DB, chưa có khách hỏi được ghi nhận]*; ngoài phạm vi MVP → **OPEN-40** |
| §III | Thông số cho thuê: thời hạn HĐ, cọc, trượt giá, fit-out | ⏳ | Mới có `rent_income_vnd` và bậc giá theo loại giao dịch (FR-123) → **OPEN-40** |
| §IV | Điểm uy tín = trung bình điểm BĐS × hệ số quy mô; điểm BĐS = 50% hoàn chỉnh + 50% kịp thời | 🔶 | FR-155 tính bằng số tin + tỷ lệ chốt, vì hai vế AOND đo ra 0 khi mới nhập kho (OPEN-20). Nay `listing_missing_facts` đã nhìn cả cột (FR-172) → vế "hoàn chỉnh" đo được rồi |
| §IV | Thưởng quy mô NMG theo bậc ≤10 / ≤30 / >30 căn | ⏳ | Chưa có |
| §IV | Đồng <50đ giới hạn 5 căn; Bạc mở rổ; Vàng ưu tiên khách nét / đẩy tới 20 NMG lõi | ❓ | Ngưỡng và quyền lợi chưa chốt — OPEN-26; hạng đang ẩn khỏi web |
| §V | CCRB 1% hoặc ¾ tháng thuê; NMG 0.5% hoặc ¾ tháng thuê | ✅ | BR-05, §1.3 — trùng `biz model.docx` |
| §V | NMG duy trì ≥10 BĐS, chốt 5%/6 tháng; <3 sao ngưng hợp tác | 🔶 | Chuẩn công bố ở `/moi-gioi` (FR-125) và hạng (FR-155); "sao" chỉ chấm CTV (FR-137), chưa chấm NMG — OPEN-12 |
| §V | Hệ thống tự điều phối CTV dẫn khách cho CCRB | ✅ | FR-136, UF-06 |
| §VI | Quét tài khoản im >5 ngày để vượt luật 7 ngày Zalo | ✅ | FR-63 (người mua), `seller_drip_tick` (người bán) |
| §VI | Với NMG: mỗi ngày hỏi 1–2 căn; trả lời 1 căn = gia hạn cả tài khoản | ✅ | FR-129, §6.8 |
| §VI | Văn phong [khen/cảnh báo điểm] + hỏi 1 + bày cách tăng điểm | 🔶 | Có khen + hỏi 1; phần "điểm" không nói ra trong chat cho tới khi chốt OPEN-26 |
| §VII | Gemini 1.5 rồi chuyển về máy local ASUS GX10 | ❌ | Chạy Claude trên Supabase Edge (SRS-2); một lớp gọi model `_shared/claude.ts`, "não" cấu hình được (FR-138). Đổi nhà cung cấp là quyết định riêng → **OPEN-41** |
| §VII | Lưu trữ SharePoint 5 lớp | ❌ | Supabase Storage hai bucket + `listing_media` (FR-165, OPEN-18 chốt 29/08/2026) |
| §VII | Live Chat Monitor: nhãn AI_HANDLING / WAITING_HINT / NEED_HUMAN + nút cướp quyền | 🔶 | Cờ `needs_human` (FR-135), bot nhường sân khi người thật gõ (FR-141), leo thang 30 phút (FR-147). Chưa có màn hình nhãn và nút — ⏳ |
| §VII | Truy vấn chéo bot-to-bot: m•ai hỏi t•ai hỏi chủ, cập nhật DB, báo lại khách | ✅ | FR-140 b/c (02/09/2026): mọi câu khách hỏi → báo admin + hỏi chủ; chủ trả lời → bot báo lại khách |

**DH-03 · Mặt bán lấy AOND làm chuẩn.** Mọi quyết định về cách hỏi, nhịp hỏi, dữ
liệu cần gom và xếp hạng người rao tra về AOND §I–§VI trước; chỗ nào nhadat.cc
gốc vênh thì AOND thắng, trừ khi đụng DH-02. Ví dụ: TTL xác nhận 7 ngày (FR-107)
được thay bằng vòng nhỏ giọt FR-129/FR-144 — FR-107 giữ ID, ghi chú 03/09/2026.

**DH-04 · Mặt mua và web lấy nhadat.cc làm chuẩn.** AOND không đặc tả phía mua
ngoài một dòng bot-to-bot; `chats w B.docx` và `nhadat.cc website.docx` vẫn là
nguồn cho FR-01…FR-65. Văn phong AOND được mượn cho cả hai phía (§6.8, 25/08/2026).

## 0.4 Canvas chiến lược (9 ô)

| Ô | Nội dung | Nguồn |
|---|---|---|
| **1. Tầm nhìn** | Người môi giới thường trực, không nghỉ, đứng sau mọi môi giới khác; cuộc trò chuyện một khi bắt đầu thì không kết thúc | OKRs eo2024.pptx; demo2Vitalify.docx |
| **2. Phân khúc** | *Đầu tiên: người rao ở Quận 5* — chính chủ chỉ biết Zalo (P3) và NMG có 10–30 căn (P4). Việc cần làm: rao mà không tốn công, có người dẫn khách. *Sau đó: người mua* để ở (P1) và đầu tư (P2) — việc cần làm: được trả lời thật, nhanh, không bị gọi. Chọn phía bán trước vì **không có hàng thì chat rỗng** (RSK-04) | 02 §2.2; INS-08; RSK-04 |
| **3. Chi phí tương đối** | Rẻ hơn sàn ở cả hai phía: không phí đăng tin, không phí người mua, chỉ thu khi chốt. Build ≤418tr (NFR-14); vận hành neo Free-tier (NFR-16) + 20tr/tháng duy trì (§1.4); bot chạy rỗ khi im (FR-171) | §1.3, §1.4 |
| **4. Giá trị** | *Người rao* — trước: đăng 5 sàn, điền form, bị hỏi lại, tin chết sau 7 ngày; cách: gõ một câu, bot nhặt dần, CTV dẫn khách; sau: "rao một lần là xong" (INS-09). Thay thế hiện có: batdongsan, chợ tốt, nhóm Zalo. *Người mua* — trước: để số là 40 cuộc gọi trong 3 ngày (INS-04); cách: chat trên Zalo, hỏi gì bot đi hỏi chủ; sau: được trả lời thật mà không lộ số. Thay thế: sàn lớn + tự gọi môi giới | INS-04, INS-06, INS-09 |
| **5. Đánh đổi — KHÔNG làm** | App native · form nhập nhiều trường · thu phí đăng tin · hỏi số điện thoại người mua · marketplace tự phục vụ · nhóm 3 BĐS công nghiệp (chờ OPEN-40) · đa ngôn ngữ · Messenger/Telegram trước khi Zalo ổn · khẳng định pháp lý thay chủ | 02 §2.3; DH-02 |
| **6. Chỉ số** | Sao Bắc Đẩu và chỉ số đầu vào ở §0.5 | — |
| **7. Tăng trưởng** | Phía bán: mạng NMG (BR-02) + tin nhặt từ nguồn khác do admin đăng (FR-156). Phía mua: SEO 100 tag (BR-08) + mua traffic từ batdongsan 20tr/tháng (§1.4) + widget Zalo (FR-145). Kiểu tăng trưởng: sản phẩm tự kéo ("rao một câu là có tin"), không đội sales | §1.4, BR-02, BR-08 |
| **8. Năng lực cần có** | Dữ liệu tin có cấu trúc (FR-172) · bộ não cấu hình được (FR-138) · kênh Zalo OA + bridge acc clone · 1.5–2 CTV có hàng đợi (FR-136) · sổ lỗi và nhịp tim (FR-152). Mua ngoài: model, Zalo, geocode. Tự làm: mọi thứ còn lại | 07 §2 |
| **9. Khó sao chép** | (a) Kho câu hỏi–trả lời đã xác minh từ chủ, gắn với từng căn, lớn dần theo mỗi khách hỏi — sàn không có (INS-06); (b) kết nối Zalo sống nhiều năm với người mua chưa cần mua ngay (INS-02); (c) mạng 20 NMG chịu luật 10 tin / 5% | INS-02, INS-06, BR-02 |

*Kiểm tính nhất quán:* ô 2 (bán trước) khớp ô 7 (NMG + admin đăng tin) và ô 9(c);
ô 4 người mua khớp DH-02 #2; ô 5 khớp 02 §2.3 "ngoài phạm vi". Chỗ chưa khớp:
ô 2 nói Quận 5 nhưng OPEN-27 đã mở địa bàn — canvas này giữ "mật độ trước độ phủ"
(INS-08) và đợi OPEN-27 chốt tên gọi + mốc địa giới.

## 0.5 Sao Bắc Đẩu (North Star Metric)

**Loại trò chơi:** giao dịch (transaction) — giá trị sinh ra khi hai bên gặp nhau,
không phải khi người dùng ở lâu trên web.

**DH-05 · NSM đề xuất: số lịch xem nhà được chốt mỗi tuần** *[giả định BA — chờ
chủ dự án chốt]*. Đối chiếu bảy tiêu chí:

| Tiêu chí | Đạt? | Vì sao |
|---|---|---|
| Dễ hiểu | ✅ | Ai trong nhà cũng đếm được: "tuần này dẫn mấy khách đi xem" |
| Lấy khách làm trung tâm | ✅ | Một lịch xem = người mua đã tin đủ để đi, người bán đã cung cấp đủ để được xem |
| Giá trị bền | ✅ | Muốn tăng thì phải tăng chất lượng tin và chất lượng trả lời, không tăng bằng spam |
| Khớp tầm nhìn | ✅ | Là bước "agent of agents" làm được mà sàn không làm: dẫn tới cửa nhà |
| Định lượng | ✅ | `reminders.kind='viewing'` + sự kiện `[VIEWING]` (FR-57) |
| Tác động được | ✅ | Từng đội kéo được: CTV, nội dung tin, nhịp bot |
| Chỉ báo dẫn trước | ✅ | Giao dịch (BR-04) đi sau lịch xem vài tuần |

Vì sao không lấy "giao dịch" làm NSM: quá thưa (mục tiêu 1/2 ngày, hôm nay 0) và
đi sau quá xa để lái sản phẩm hằng tuần. Vì sao không lấy "số chat mới" (BR-03):
là hoạt động, không phải giá trị.

**Chỉ số đầu vào (3–5, kéo được trong tuần):**

| # | Chỉ số đầu vào | Kéo bằng | Đo ở |
|---|---|---|---|
| I1 | Tin **đủ thông tin lên sàn** mới mỗi tuần (`dang_ban`) | Drip FR-129, bóc thông số FR-172, admin đăng FR-156 | `listings.status` |
| I2 | Hội thoại mua đạt **đủ khu vực + tầm giá** (ngưỡng gợi ý căn, UF-04) | FR-130, FR-131 | `buyers.preferences` |
| I3 | Tỷ lệ **câu khách hỏi được chủ trả lời trong 24h** | FR-140 b/c, FR-110 | `info_requests.answered_at − created_at` |
| I4 | Kết nối Zalo **còn sống sau 30 ngày** (BR-07) | FR-63, reengage trong `nudge` | `buyers.last_contact_at` |
| I5 | NMG **hoạt động** (có tin đang rao + trả lời drip trong 7 ngày) | FR-155, `/moi-gioi` | `seller_ranks` |

**Một chỉ số của quý này (OMTM): I3.** Vòng hỏi-đáp vừa khép ngày 02/09/2026 và
bảng `info_requests` chưa có lượt trả lời thật nào (OPEN-20 ghi nhận) — đây là
mắt xích duy nhất chưa có số, và là mắt xích cả hai tài liệu gốc đặt ở trung tâm.

## 0.6 Lộ trình

**Đã chạy trên hệ thống thật (đến 02/09/2026):** web Next.js + Supabase; bot hai
mặt trên Zalo qua bridge acc clone (OA đang chờ — FR-145); 173 tin có cấu trúc;
drip người bán; hỏi-đáp khép vòng; hạng người rao (ẩn); CTV chia đơn + báo cáo
17h; sổ lỗi, nhịp tim, chuông hết tiền; kiểm thử 4 tầng (`10`). Hiện trạng chi
tiết ở `bot/README.md` và `10`; kế hoạch phát hành gốc ở `07 §8`.

**DH-06 · 90 ngày tới, theo thứ tự:**

| Đợt | Việc | Vì sao trước | Neo |
|---|---|---|---|
| 1 · Chốt hướng | Chủ dự án chốt §0.8 (OPEN-39/40/41) và bốn OPEN đang chặn: 21 (5 vai người rao), 26 (ngưỡng + quyền lợi hạng), 27 (địa bàn + tên gọi), 28 (phí có trôi theo số tin) | Mọi việc dưới đều đụng một trong bốn cái này | 09 |
| 2 · Đo I3 | Đưa 20 tin có chủ thật trên Zalo vào vòng hỏi-đáp; đo tỷ lệ trả lời 24h/48h | Là OMTM; là giả định sống còn số 1 ở §0.7 | FR-140, FR-110 |
| 3 · Dữ liệu | 7 hạng mục học từ sàn khác theo thứ tự ở `01 §1.5c`: sự kiện tin / điểm nóng, khớp tin mới với hồ sơ khách, ảnh chụp giá khu vực, báo cáo tin xấu, bảng đường/phường, tiện ích quanh nhà, nhãn xác minh | Tăng I1 và I2 mà không thêm lượt model | INS-13, OPEN-37 |
| 4 · AOND còn thiếu | Màn hình nhãn + nút cướp quyền cho CTV (§VII); thông số cho thuê + đất (§III) nếu OPEN-40 chốt làm; thưởng quy mô NMG (§IV) nếu OPEN-26 chốt | Hoàn tất phần AOND đã nhận | FR-135, FR-141, FR-172 |
| 5 · Vận hành | Sao lưu định kỳ; lên Supabase Pro + Vercel Pro **ngay khi có giao dịch thật đầu tiên** | Free-tier không có lưới (OPEN-25) | NFR-16, FR-152 |

Không nằm trong 90 ngày: thoại (STT), Messenger/Telegram, app, nhóm 3 BĐS.

## 0.7 Phản biện: giả định nào sai thì kế hoạch chết

Theo cách của *Strategy Red-Team*: chỉ chọn giả định **chịu lực** (sai là đổ),
mỗi cái kèm điều kiện đổ, bằng chứng lấy được trong tuần, ngưỡng dừng, và phép thử
rẻ nhất. Xếp theo tác động × khả năng sai × rẻ để thử.

| # | Giả định chịu lực | Đổ nếu | Bằng chứng tuần này | Ngưỡng dừng | Thử rẻ nhất |
|---|---|---|---|---|---|
| 1 | **Chủ nhà chịu trả lời bot** khi khách hỏi (INS-06, AOND §VI) | <30% câu hỏi được trả lời trong 48h → vòng lặp trung tâm thành "để em hỏi lại" rồi im | `select count(*) filter (where answered_at is not null) … from info_requests` sau khi có ≥20 câu thật | 2 tuần liền dưới 30% | Đưa 20 tin có chủ thật vào vòng; bot hỏi đúng câu khách hỏi, không hỏi chung chung |
| 2 | **Người mua chịu chat với bot mà không cần người thật ngay** (INS-04) | Tỷ lệ hội thoại → lịch xem <2%, hoặc >30% bật cờ cần người thật | `conversations.needs_human` và `reminders viewing` trên 100 hội thoại đầu | Cờ cần người thật >30% | Bật widget Zalo (FR-145) trên 20 trang tin nhiều lượt xem nhất, đọc 50 hội thoại đầu bằng mắt |
| 3 | **Hạng Đồng/Bạc/Vàng làm NMG chăm tin hơn** (AOND §IV) | Hạng lên/xuống không đổi tỷ lệ trả lời drip của NMG | So tỷ lệ trả lời drip 3 NMG hiện có (TS-HANG-01), trước/sau khi nói hạng cho họ biết | Không lệch sau 30 ngày | Nói hạng qua Zalo cho đúng 3 NMG, không cần UI |
| 4 | **Free-tier chịu được tới giao dịch đầu tiên** (NFR-16, OPEN-25) | Mất dữ liệu một lần, hoặc Vercel đình chỉ vì dùng thương mại | Nhật ký `sao-luu.mjs`, `bot_errors` loại hạ tầng | Một sự cố mất dữ liệu | Chạy sao lưu mỗi ngày bằng lịch, thử khôi phục từ bản sao một lần |
| 5 | **Mở địa bàn ra HCM mới + Long An + Tây Ninh không làm loãng kho** (OPEN-27 vs INS-08) | Số tin mỗi phường mới dưới 5 sau 60 ngày → khách hỏi khu nào cũng "chưa có" | `listings` nhóm theo `ward` sau khi mở | >50% phường mở có <5 tin | Mở từng cụm phường liền kề Quận 5 trước, không mở cả tỉnh |

**Chỗ đứng vững:** không thu số điện thoại (đã là lời hứa thương hiệu, có số liệu
"40 cuộc gọi trong 3 ngày"); rao bằng một câu (cả hai tài liệu gốc cùng nói, và
đã chạy 173 tin); phí chỉ thu khi chốt (trùng ở cả hai nguồn).

**Chưa đánh giá được:** OKR "1 giao dịch / 2 ngày" (OPEN-01 chưa chốt); nhu cầu
thật của nhóm 3 BĐS công nghiệp (chưa có tin, chưa có khách hỏi).

## 0.8 Quyết định cần chủ dự án chốt

Ba câu mới sinh ra từ bản này, ghi thành `OPEN-39`, `OPEN-40`, `OPEN-41` ở
`09-open-issues.md`; bốn câu cũ đang chặn lộ trình là OPEN-21, 26, 27, 28.

| ID | Câu hỏi | Khuyến nghị BA |
|---|---|---|
| OPEN-39 | **Tên**: thương hiệu là nhadat.cc, aioinhadat.com, hay cả hai; trợ lý là một "Thái" hay gia đình •ai (m•ai cho người mua, t•ai cho người bán) theo AOND §II | Giữ **một** tên bot trước mặt khách cho tới khi chốt thương hiệu (OPEN-08); hai tên bot nội bộ (mua/bán) chỉ dùng trong log. Đổi tên là đổi domain, OA, copy toàn hệ — làm một lần |
| OPEN-40 | **Phạm vi loại BĐS**: có làm thông số cho thuê (thời hạn HĐ, cọc, trượt giá, fit-out) và nhóm 2 đất (chỉ tiêu xây dựng) ngay không; nhóm 3 công nghiệp có nằm trong 12 tháng không | Cho thuê: **làm** (đã có tin cho thuê, phí ¾ tháng đã chốt). Đất: chờ nguồn quy hoạch (OPEN-37). Công nghiệp: **không** cho tới khi có khách hỏi thật |
| OPEN-41 | **Nhà cung cấp model**: giữ Claude trên Supabase Edge, hay theo AOND §VII (Gemini rồi chạy local) | Giữ như đang chạy; lớp gọi model đã gom một chỗ nên đổi sau được. Đổi bây giờ là làm lại toàn bộ kiểm thử `10` mà chưa có lý do chi phí |

**DH-07 · Cho tới khi §0.8 được chốt**, mọi việc mới đi theo khuyến nghị ở cột phải,
và tài liệu tầng dưới ghi `[giả định BA]` ở chỗ phụ thuộc.

---

*Truy vết:* DH-01…DH-07 → `08-traceability.md §8.0`. Trang trực quan của bản này
nằm ở page **00 · Định hướng** trong file Figma
`nhadat.cc — Design System & SRS` (xem `design/figma-handoff.md`).
