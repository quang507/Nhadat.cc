# 00 — Định hướng (BRD hợp nhất Aioinhadat × nhadat.cc)

Phiên bản: **v1.3** · Ngày: **04/09/2026** · Trạng thái: **tên, luồng CTV, địa bàn đã chốt; còn §0.8; nghiệm thu 04/09 ghi vào §0.6–0.7**

> Bộ `docs/` viết từ tài liệu nhadat.cc 2024; từ 25/08/2026 code chạy theo SRD
> "AI Ơi Nhà Đất" (AOND, `AOND req + chat examples.docx`) ở ngày càng nhiều chỗ.
> Trang này nói thẳng **sản phẩm hôm nay là gì, giữ gì của bên nào, còn gì chưa
> quyết** — và đứng trên `01`–`10`: tầng dưới không được mâu thuẫn với nó
> [nguồn: quyết định chủ dự án 03/09/2026]. Khung mượn `phuryn/pm-skills`
> (canvas §0.4, sao Bắc Đẩu §0.5, phản biện §0.7); nội dung có nguồn từng dòng.

## 0.1 Định vị

**DH-01.** **Aioinhadat** là *người môi giới thường trực đứng sau mọi môi giới
khác* [nguồn: OKRs eo2024.pptx, slide 1], vận hành bằng **một bot tên Thái**
với hai mặt [nguồn: chốt 03/09/2026, OPEN-39]:

| Mặt | Chạy theo | Cốt lõi | Neo |
|---|---|---|---|
| **Bán** | AOND §I–§VI | Rao một câu + ảnh, không form; khen trước hỏi sau, 1 thông tin/lần, nhặt dần nhiều ngày; người rao có hạng | FR-129, FR-144, FR-155, FR-172 |
| **Mua** | nhadat.cc 2024 | Web là phễu SEO đẩy về Zalo; khách không để SĐT; trả lời như người, ≤3 căn/tin, không khẳng định điều chưa xác minh; kết nối sống 3–4 năm | INS-01…04, FR-01…65 |
| **Vòng nối** | Cả hai (INS-06 = AOND §VII) | Khách hỏi → bot không biết → **CTV** hỏi chủ, nhắn lại `#mã tin: câu trả lời` → tin giàu thêm → bot báo lại khách. CTV quá 120' → admin đỡ khách, CTV tụt hạng | FR-140 c, **FR-173** |

**Địa bàn: Sài Gòn (TP.HCM theo phường mới sau 01/07/2025) + Long An; trọng
tâm là bán; khởi điểm cụm Quận 5 cũ** [nguồn: chốt 03/09/2026 — "bán sản phẩm
bất động sản ở Sài Gòn, các phường mới và Long An"; OPEN-27 nửa đầu, FR-174].
Cho thuê giữ như đang có *[giả định BA]*; tên hiển thị cũ/mới và thứ tự mở
từng cụm là OPEN-27 nửa sau.

**AOND là cách nhận và nuôi hàng; nhadat.cc là cách bán hàng.** Không có
"chuyển dự án" — một sản phẩm, hai bản thiết kế, một người đứng giữa là CTV.

**DH-02 · Bốn bất biến** (luật ở `ba-pipeline`, hướng nào cũng giữ):

| # | Bất biến | Neo |
|---|---|---|
| 1 | Mọi trang web là phễu về Zalo; không kéo hội thoại ra khỏi Zalo | IA-P1, INS-01 |
| 2 | Không hỏi SĐT người mua ngoài bước chốt lịch xem | NFR-07, FR-53, INS-04 |
| 3 | Không khẳng định pháp lý / quy hoạch / còn-hết khi chưa xác minh — chuyển thành câu hỏi | RSK-03, FR-40, AOND §II |
| 4 | Bot là trung gian toàn phần: lưu hết chủ chia sẻ, khách hỏi mới khai, liên hệ chỉ mở lúc chốt lịch xem | INS-11, FR-104, OPEN-36 |

**DH-03.** Mặt bán: AOND thắng khi vênh với nhadat.cc gốc, trừ khi đụng DH-02
(ví dụ TTL 7 ngày FR-107 → nhỏ giọt FR-129/144). **DH-04.** Mặt mua + web:
`chats w B.docx`, `nhadat.cc website.docx` là nguồn; văn phong AOND mượn cho
cả hai phía (`06 §6.8`).

## 0.2 Hai nguồn gốc, một sản phẩm

| Khía cạnh | nhadat.cc (2024) | AOND SRD (06/2026) | Hôm nay | Neo |
|---|---|---|---|---|
| Tên | nhadat.cc, "Thái" | aioinhadat.com, gia đình •ai | **Aioinhadat**, một bot **Thái**; domain web còn nhadat.cc *[giả định BA]* | OPEN-08, OPEN-39 |
| Trọng tâm | Khách chat Zalo; web SEO | Người rao gửi hàng tự nhiên | Cả hai, một `chat-reply`, tách vai từng lượt | FR-157, FR-159 |
| Nhận tin rao | `/raoban` + câu rao | Text/thoại/ảnh, không form | Câu rao trong Zalo sinh mã tin; ảnh có; thoại chưa | FR-158, FR-134 |
| Nuôi tin | TTL 7 ngày | 1 thông tin/lần, 1–2 căn/ngày | Đúng AOND | FR-129, FR-144 |
| Khách hỏi điều bot không biết | Hỏi chủ | Bot-to-bot hỏi chủ | **Giao CTV**, quá hạn → admin | FR-173 |
| Xếp hạng | NMG ≥10 tin, chốt ≥5% | Đồng/Bạc/Vàng người rao | Hạng người rao (ẩn) + **hạng CTV** theo đúng hạn | FR-155, FR-173, OPEN-26/42 |
| Phí | CCRB 1% · NMG 0.5% · thuê ¾ tháng | Giống | Giống | BR-05, AOND §V |
| Địa bàn | Quận 5 | Quận 5 rồi mở | **Sài Gòn (phường mới) + Long An**, trọng tâm bán; khởi điểm Q5 cũ (chốt 03/09) | BR-01, OPEN-27, FR-174 |
| Hạ tầng | Vendor, Slack, Logstash | Gemini → local, SharePoint | Supabase Edge + Claude, Storage, bridge Zalo, `/admin` | SRS-2, OPEN-41 |
| Vận hành | 1.5 CTV | CTV dẫn khách | 2 CTV xoay vòng + báo cáo 17h + hạng (CTV cần Zalo uid mới nhận được nhắc) | FR-136/137/173 |

## 0.3 SRD AOND: nhận / sửa / chưa / không

✅ đúng · 🔶 khác bản gốc · ⏳ chưa · ❌ không nhận · ❓ chờ chốt

| AOND | Nội dung | | Ở đây |
|---|---|---|---|
| §I | Rao tự nhiên, không form | ✅ | FR-92/158/144/161 |
| §I | Thoại | ⏳ | FR-134 "STT chưa làm" |
| §I | Tích lũy ngầm nhiều phiên | ✅ | FR-129/144/153/172 |
| §I | 200–300 người/ngày, 6–9k tin, phủ 90% Q5 | 🔶 | NFR-05; Free-tier chưa đo (NFR-16) |
| §II | Kho tên •ai (m•ai, t•ai…) | ❌ | Chốt 03/09: một tên Thái (OPEN-39) |
| §II | Quy tắc 30 từ | 🔶 | Thu thập ~30; trả lời khách 30–90 (`06 §6.8`) |
| §II | Khen trước, hỏi 1/lần; "hình như là" | ✅ | FR-129, FR-134 |
| §III | Nhóm 1 nhà ở | ✅ | FR-172 |
| §III | Nhóm 2 đất; thông số cho thuê | ⏳ | OPEN-40, OPEN-37 |
| §III | Nhóm 3 công nghiệp | ❓ | OPEN-40 |
| §IV | Điểm uy tín 50% hoàn chỉnh + 50% kịp thời | 🔶 | FR-155 (số tin + chốt); CTV đo kịp thời riêng — FR-173 |
| §IV | Thưởng quy mô; quyền lợi Đồng/Bạc/Vàng | ❓ | OPEN-26 (người rao), OPEN-42 (CTV) |
| §V | Phí; NMG ≥10 tin, chốt 5% | ✅ | BR-05, FR-125, FR-155 |
| §V | Hệ thống điều phối CTV | ✅ | FR-136, FR-173 |
| §VI | Quét im >5 ngày; hỏi 1–2 căn/ngày | ✅ | FR-63, FR-129, `seller_drip_tick` |
| §VII | Gemini → máy local | ❌ | Claude/Supabase; OPEN-41 |
| §VII | SharePoint 5 lớp | ❌ | Supabase Storage (FR-165) |
| §VII | Live Chat Monitor: nhãn + nút cướp quyền | 🔶 | FR-135/141/147; màn hình ⏳ |
| §VII | Bot-to-bot hỏi chủ, báo lại khách | 🔶 | Qua CTV thay vì bot-to-bot — FR-173 |

## 0.4 Canvas chiến lược

| Ô | Nội dung | Neo |
|---|---|---|
| Tầm nhìn | Môi giới thường trực đứng sau mọi môi giới; hội thoại bắt đầu thì không kết thúc | OKRs eo2024; demo2Vitalify |
| Phân khúc | Trước: người rao ở cụm Q5 cũ, rồi Sài Gòn (phường mới) + Long An (P3 chính chủ, P4 NMG 10–30 căn). Sau: người mua ở (P1), đầu tư (P2). Bán trước vì không hàng thì chat rỗng | 02 §2.2, RSK-04, FR-174 |
| Chi phí | Không phí đăng, không phí mua, thu khi chốt. Build ≤418tr; vận hành Free-tier + 20tr/tháng | NFR-14/16, §1.3–1.4 |
| Giá trị | Người rao: "rao một lần là xong". Người mua: được trả lời thật, không lộ số (thay cho 40 cuộc gọi/3 ngày) | INS-04/06/09 |
| KHÔNG làm | App · form nhiều trường · phí đăng · hỏi SĐT · marketplace tự phục vụ · công nghiệp (OPEN-40) · đa ngôn ngữ · Messenger/Telegram · khẳng định pháp lý | 02 §2.3, DH-02 |
| Chỉ số | §0.5 | — |
| Tăng trưởng | Bán: mạng NMG + admin đăng tin (FR-156). Mua: SEO 100 tag + traffic batdongsan + widget Zalo (FR-145) | BR-02/08, §1.4 |
| Năng lực | Tin có cấu trúc (FR-172) · não cấu hình (FR-138) · Zalo + bridge · 2 CTV có hàng đợi + hạng (FR-136/173) · sổ lỗi (FR-152) | 07 §2 |
| Khó sao chép | Kho hỏi-đáp đã xác minh theo từng căn; kết nối Zalo nhiều năm; mạng NMG chịu luật 10 tin/5% | INS-02/06, BR-02 |

Địa bàn đã chốt 03/09 (Sài Gòn + Long An); mở cụm nào trước vẫn theo "mật độ
trước độ phủ" (INS-08) — OPEN-27 nửa sau (d).

## 0.5 Sao Bắc Đẩu

**DH-05 · NSM: số lịch xem nhà chốt mỗi tuần** *[giả định BA]* — dễ đếm, khách
làm trung tâm, chỉ tăng bằng chất lượng tin + trả lời, đo được
(`reminders.kind='viewing'`, FR-57), dẫn trước giao dịch (BR-04) vài tuần.
Không lấy "giao dịch" (quá thưa, hôm nay 0) hay "chat mới" (hoạt động, không
phải giá trị).

| # | Đầu vào | Kéo bằng | Đo |
|---|---|---|---|
| I1 | Tin đủ thông tin lên sàn / tuần | FR-129, FR-172, FR-156 | `listings.status='dang_ban'` |
| I2 | Hội thoại mua đủ khu vực + tầm giá | FR-130, FR-131 | `buyers.preferences` |
| I3 | **Câu khách hỏi được trả lời đúng hạn** | **FR-173**, FR-140 c | `info_requests.answered_at ≤ sla_due_at`; `ctv_ranks` |
| I4 | Kết nối Zalo sống sau 30 ngày | FR-63, `nudge` | `buyers.last_contact_at` (đo được từ ~21/09 — buyer đầu tạo cuối 08/2026) |
| I5 | NMG hoạt động (có tin + trả lời drip 7 ngày) | FR-155 | view `nmg_hoat_dong` (`20260904e`): có tin lên kệ VÀ ≥1 câu nhỏ giọt trả lời trong 7 ngày; hôm nay 0/3 |

**OMTM quý này: I3.** Vòng hỏi-đáp mới khép 02–03/09/2026, `info_requests` chưa
có lượt trả lời thật — mắt xích duy nhất chưa có số, và là mắt xích cả hai tài
liệu gốc đặt ở trung tâm.

## 0.6 Lộ trình

Đã dựng (03/09/2026): web + Supabase; bot hai mặt qua bridge (OA chờ — FR-145);
173 tin có cấu trúc; drip người bán; hỏi-đáp qua CTV + hạng CTV; CTV chia đơn +
báo cáo 17h; sổ lỗi, nhịp tim, chuông hết tiền, còi ngoài ntfy; kiểm thử 4 tầng
(`10`). **Đã chạy thật** (nghiệm thu 04/09, `10 §10.8`): web + kho tin + sổ lỗi.
Chưa: bridge **im từ 27/08** (VPS chưa bật), 0 chủ nhà/CTV có Zalo uid, 0 fact,
0 ảnh, 0 câu hỏi khách, 0 lịch xem — mọi vòng chat mới có bằng chứng từ test.

**DH-06 · 90 ngày:**

| Đợt | Việc | Neo |
|---|---|---|
| 1 · Chốt | §0.8 (OPEN-40/41/42, 27 nửa sau) + OPEN-21 (5 vai), 26 (quyền lợi hạng), 28 (phí) | 09 |
| 2 · Đo I3 | 20 tin có chủ thật vào vòng CTV; đo tỷ lệ trả lời trong 120' / 24h; định cỡ lại OPEN-42 | FR-173 |
| 2b · Địa bàn | Đợt 1 xong 03/09 (không ghi cứng Quận 5, copy nói Sài Gòn + Long An). Đợt 2 khi OPEN-27 nửa sau chốt: bảng `wards` một nguồn, SEO theo khu mới, mở cụm kề Q5 cũ + một huyện Long An có hàng thật | FR-174 |
| 3 · Dữ liệu | 7 hạng mục theo `01 §1.5c` (sự kiện tin, khớp tin–hồ sơ, giá khu vực…) | INS-13 |
| 4 · AOND còn thiếu | Màn hình nhãn + nút cướp quyền; thông số cho thuê/đất nếu OPEN-40 chốt; thưởng quy mô nếu OPEN-26 chốt | FR-135/141/172 |
| 5 · Vận hành | Sao lưu định kỳ; lên Pro ngay khi có giao dịch thật đầu tiên | NFR-16, OPEN-25 |

Ngoài 90 ngày: thoại, Messenger/Telegram, app, công nghiệp, đổi domain.

## 0.7 Giả định chịu lực

| # | Giả định | Đổ nếu | Ngưỡng dừng | Thử rẻ nhất |
|---|---|---|---|---|
| 1 | **CTV + chủ nhà trả lời kịp** khi khách hỏi (FR-173) | <30% câu trả lời trong 48h; admin phải đỡ >50% | 2 tuần liền | 20 tin chủ thật; hỏi đúng câu khách hỏi |
| 2 | **Khách chịu chat bot** không cần người thật ngay (INS-04) | Hội thoại → lịch xem <2%; cờ cần người >30% | Cờ >30% | Widget Zalo trên 20 trang tin nhiều view; đọc 50 hội thoại |
| 3 | **Hạng làm người ta chăm hơn** (AOND §IV) | Hạng lên/xuống không đổi tỷ lệ trả lời | Không lệch sau 30 ngày | Nói hạng qua Zalo cho 3 NMG + 2 CTV, chưa cần UI |
| 4 | **Free-tier chịu tới giao dịch đầu** (NFR-16) | Mất dữ liệu; Vercel đình chỉ | Một sự cố | Sao lưu hằng ngày, thử khôi phục một lần |
| 5 | **Mở Sài Gòn + Long An không loãng kho** (FR-174 vs INS-08) | >50% phường/huyện mở có <5 tin sau 60 ngày | — | Mở cụm phường kề Q5 cũ trước; Long An theo một huyện có nguồn hàng thật |

Đứng vững: không thu SĐT; phí chỉ khi chốt; một tên bot Thái. Chưa đánh giá
được: "rao một câu" — 173/173 tin là `import_excel` ngày 21/08, chưa tin nào
sinh từ câu rao Zalo thật (04/09); OKR "1 giao dịch/2 ngày" (OPEN-01); nhu cầu
nhóm công nghiệp. Giả định 4 đã **đổ một lần**: bridge chết 8 ngày (27/08 →
04/09) mà không ai biết cho tới khi có còi ntfy.

## 0.8 Chờ chủ dự án chốt

Đã chốt 03/09/2026: **OPEN-08 + OPEN-39** (Aioinhadat, một bot Thái, không
•ai), **luồng CTV** (FR-173), **địa bàn — OPEN-27 nửa đầu** (Sài Gòn phường
mới + Long An, trọng tâm bán — FR-174). Đã chốt 04/09/2026: **giữ chân khách
mốc 5 ngày** (FR-60 đổi từ 3 ngày; FR-63 buộc giữ kết nối từ ngày 6) và **dựng
hết phần tài liệu có mà code chưa** (OPEN-43 → xem `10 §10.8.4`) [nguồn: chủ
dự án 04/09/2026 "dựng hết đi, giữ chân 5 ngày"]. Còn:

| ID | Câu hỏi | Khuyến nghị BA |
|---|---|---|
| OPEN-27 nửa sau | Tên hiển thị cũ hay mới; DB lưu gì; mã tin; mở phường/huyện nào trước; cho thuê có giữ | Hiển thị cả hai tên; bảng `wards` một nguồn; giữ mã tin; mở cụm kề Q5 cũ + một huyện Long An có hàng; giữ cho thuê như đang có |
| OPEN-40 | Thông số cho thuê / đất / công nghiệp — làm gì, khi nào | Cho thuê: làm. Đất: chờ OPEN-37. Công nghiệp: không, tới khi có khách hỏi thật |
| OPEN-41 | Model: giữ Claude/Supabase hay Gemini → local theo AOND §VII | Giữ; lớp gọi model đã gom một chỗ, đổi sau được |
| OPEN-42 | CTV: hạn trả lời (đang 120') và mốc Vàng ≥90% / Bạc ≥70% / Đồng; hệ quả của hạng | Giữ tới khi có ~30 câu thật rồi định cỡ; chốt hệ quả cùng lúc |

**DH-07.** Cho tới khi §0.8 chốt, việc mới đi theo cột phải và tầng dưới ghi
`[giả định BA]` ở chỗ phụ thuộc.

---

*Truy vết:* DH-01…DH-07 → `08-traceability.md §8.0`. Bản trực quan: page
**00 · Định hướng** trong Figma `nhadat.cc — Design System & SRS`
(`design/figma-handoff.md`).
