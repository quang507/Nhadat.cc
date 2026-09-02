# 01 — Research

> Nguồn: `biz model.docx/.pdf`, `OKRs eo2024.pptx`, `demo2Vitalify.docx`,
> `chats w B.docx`, `S's side.docx`, `dự kiến vốn 6 tháng đầu.xlsx`.
> Mọi số liệu thị trường ngoài các file này đều là **giả định BA**
> và được đánh dấu rõ.
>
> *(`Vedoo pages/` — ảnh chụp theme tham chiếu — đã xoá khỏi repo 26/08/2026
> theo quyết định chủ dự án. Phần đã chưng cất từ nó nằm ở `06-ui-design.md`
> §Kế thừa từ Veedoo / Loại bỏ; muốn xem lại ảnh gốc thì lấy trong lịch sử git.)*

## 1.1 Bối cảnh & định vị

Tuyên ngôn định vị lấy từ OKRs: **"the permanent agent of agents"** — người môi
giới thường trực, không nghỉ, đứng phía sau tất cả các môi giới khác
[nguồn: OKRs eo2024.pptx, slide 1]. Bốn năng lực tự tuyên bố trên các slide còn lại
chính là bốn trụ sản phẩm:

| Slide | Tuyên bố | Trụ sản phẩm tương ứng |
|---|---|---|
| 2 | *I understand all your needs* | Hiểu nhu cầu qua hội thoại tự nhiên (NLU) |
| 3 | *I tell you all the best properties for you* | Gợi ý listing xếp hạng theo nhu cầu |
| 4 | *I will look for more information for you* | Vòng hỏi-đáp bổ sung thông tin từ S |
| 5 | *I will find out more about your tastes* | Học sở thích dài hạn, cá nhân hoá |

Concept gốc bằng tiếng Anh diễn đạt gọn nhất trong `demo2Vitalify.docx`:
> *"The aim is to create a listing service that works around chats. (…) Once it
> starts, the chat never ends!"*

### INS-01 — Chat là sản phẩm, listing chỉ là mồi
Website không phải nơi chốt; nó là phễu SEO đẩy người dùng sang Zalo OA càng
sớm càng tốt [nguồn: biz model.docx §Website và Zalo]. Hệ quả thiết kế: mọi trang
web đều phải có CTA sang Zalo, và CTA phải **mang theo ngữ cảnh tìm kiếm**, nếu
không người dùng phải kể lại nhu cầu từ đầu.

### INS-02 — Chu kỳ mua nhà dài 3–4 năm, không phải 3–4 tuần
> *"nhadat.CC muốn phục vụ khách hàng tìm kiếm trong suốt 3-4 năm cho tới khi họ
> mua được nhà"* [nguồn: chats w B.docx §Trước khi Zalo xóa].

Đây là insight định hình toàn bộ sản phẩm: chỉ số thành công không phải
conversion trong phiên, mà là **giữ được kết nối Zalo sống qua nhiều năm**. Kéo
theo hai ràng buộc kỹ thuật ở INS-03 và INS-04.

### INS-03 — Zalo xoá kết nối sau 7 ngày im lặng
Nền tảng Zalo cắt kết nối OA↔user nếu user không nhắn gì trong 7 ngày
[nguồn: chats w B.docx §Trước khi Zalo xóa]. Với chu kỳ mua 3–4 năm, đây là **rủi
ro tồn vong của tài sản khách hàng**, không phải chi tiết vận hành. Hệ thống bắt
buộc phải có cơ chế tái kích hoạt chủ động, và phải khiến B *nhắn lại* chứ không
chỉ *đọc*.

### INS-04 — Riêng tư là điểm khác biệt cạnh tranh
> *"Tụi em không spam nên không hỏi số điện thoại của anh chị"*
> [nguồn: nhadat.cc website.docx §Tụi em không hỏi số ĐT].

Nỗi đau lớn nhất của người tìm nhà ở Việt Nam là bị hàng chục môi giới gọi liên
tục sau khi để lại số — chủ dự án định lượng: *"để lại SĐT trên trang BĐS đồng
nghĩa với 40 cuộc gọi trong 3 ngày"* [nguồn: trao đổi chủ dự án, 22/08/2026].
nhadat.cc chọn **không thu số điện thoại** làm lời hứa thương hiệu. Ngoại lệ duy nhất quan sát được là khi đặt lịch xem nhà, chat mẫu
vẫn hỏi số ĐT [nguồn: chats w B.docx §Hẹn xem nhà] — mâu thuẫn này ghi ở `OPEN-05`.

### INS-05 — Người bán không muốn điền form
Trong tất cả kịch bản, S chỉ gõ **một câu rao thông thường**:
> *"Bán nhà HXH xe tải quay đầu, gần ngã tư Trần Bình Trọng và An Dương Vương,
> giá 9 tỉ có thể bớt lộc, Phường 4 Quận 5 nhà trệt dễ xây lại"*

AI chịu trách nhiệm bóc tách thành trường (Vị trí / Đường / Quy mô / Giá) và
**viết lại nhiều biến thể** theo độ dài và theo khía cạnh B quan tâm
[nguồn: S's side.docx §Rao bằng câu rao thông thường]. Form nhập liệu nhiều
trường là phản mô hình ở dự án này.

### INS-06 — Thông tin listing luôn thiếu, và đó là tính năng chứ không phải lỗi
Vòng lặp trung tâm của dịch vụ: B hỏi → hệ thống không biết → hỏi ngược S → S trả
lời → **listing giàu thêm** → phục vụ được cả những B sau. Các câu hỏi thực tế
lặp lại nhiều nhất [nguồn: chats w B.docx §Các thông tin cần hỏi S]:
"Bán chưa em?", "Chỗ này mở quán ăn được không?", "Cho chị xem sổ đỏ",
"Có hình cái hẻm không?", "Có vướng quy hoạch không?".

Mỗi vòng hỏi-đáp vừa phục vụ một khách, vừa là **cơ chế làm giàu dữ liệu miễn phí**.

### INS-07 — Ngôn ngữ tìm kiếm là ngôn ngữ nói, không phải bộ lọc
Người dùng gõ *"Có nhà gần ngã tư Nguyễn Trãi với Trần Bình Trọng không em?"*,
*"Có nhà gần hồ bơi Lam Sơn không?"*, *"Giá cỡ căn này quanh đây còn căn nào không?"*
[nguồn: chats w B.docx §Hỏi nhà quanh 1 vị trí]. Không bộ lọc dropdown nào diễn
đạt được "gần ngã tư X và Y" hay "giống giống căn này". Ô search trên web vì vậy
được đặc tả là **ô chat**, không phải form [nguồn: nhadat.cc website.docx §Search].

### INS-09 — Lời hứa phía bán: "rao một lần là xong"
> *"Bên em sẽ rao bán cho đến khi gặp người mua mà bên em thấy là phù hợp nhất,
> để anh chỉ cần nhắn cho bọn em là xong, không có spam"*
> [nguồn: trao đổi chủ dự án, 22/08/2026].

Lời hứa không-spam áp cho **cả hai phía**: S rao đúng một câu, sau đó hệ thống
tự viết lại tin, tự trả lời B, và chỉ liên hệ lại S khi thật sự cần (câu hỏi
cần xác minh, chốt lịch xem nhà) — theo đuổi cho tới khi gặp người mua phù hợp
nhất, không bỏ rơi tin giữa chừng. Đây là mặt đối xứng của INS-04.

### INS-08 — Mật độ dữ liệu quan trọng hơn độ phủ địa lý
OKR số 1 là phủ **90% thị trường Quận 5**, rồi mới lan tự nhiên sang quận khác
[nguồn: biz model.docx §OKRs]. Chiến lược "một quận thật sâu" cho phép trả lời được
các câu hỏi vi mô ("gần hồ bơi Lam Sơn", "hẻm 174 Trần Bình Trọng") — thứ mà các
site toàn quốc không làm được.

### INS-10 — Hàng dự án là một loại hàng khác hẳn hàng lẻ
Chủ dự án nêu tình huống *"bán căn 50 của Ny'ah"* — tức nhu cầu kiểm soát trong
**một dự án** đã bán những căn nào [nguồn: trao đổi chủ dự án, 22/08/2026].
Hàng dự án (sơ cấp) khác hàng lẻ (thứ cấp) ở ba điểm cấu trúc:

1. **Dữ liệu hai tầng.** Phần lớn thông tin thuộc về *dự án* và dùng chung cho
   mọi căn (vị trí, chủ đầu tư, pháp lý dự án, tiện ích, mặt bằng tầng, tiến độ);
   chỉ một phần nhỏ thuộc về *căn* (mã căn, tầng, hướng, DT, giá, trạng thái bán).
   B hỏi câu thuộc tầng dự án → trả lời ngay từ dữ liệu chung, **không** cần hỏi
   ngược S từng lần như hàng lẻ (INS-06 chỉ áp cho tầng căn).
2. **Tồn kho thay đổi liên tục.** "Căn 50 còn không?" phải trả lời được theo
   trạng thái từng căn (còn / giữ chỗ / đã cọc / đã bán) — sai tồn kho ở hàng dự
   án gây mất uy tín nhanh hơn hàng lẻ vì người mua so được với bảng hàng của
   môi giới khác.
3. **Một tin rao ↔ nhiều căn.** Một listing dự án đại diện cho cả giỏ hàng;
   gợi ý trong chat phải xuống được tới mức căn ("còn căn 2PN tầng trung, hướng
   Đông") thay vì lặp lại tin dự án.

Phạm vi đưa hàng dự án vào MVP hay giai đoạn sau: quyết định ở `OPEN-15`.
Nhu cầu "kiểm soát đã bán những căn nào" cũng mở câu hỏi CRM: `OPEN-16`.

### INS-11 — Bot là trung gian toàn phần: lưu hết, khai khi khách hỏi, liên hệ mở lúc chốt lịch xem
*[chỉnh 02/09/2026 — quyết định chủ dự án (OPEN-36): "không phải ẩn danh nhưng
tất cả thông tin người bán đã chia sẻ sẽ lưu và khi khách hỏi thì mới khai
báo". Đoạn dưới là bản gốc 08/2026; đọc "ẩn danh" là "không chủ động phơi",
không phải "giấu khi được hỏi". Ranh giới còn giữ: SĐT/Zalo người bán mở ở
bước chốt lịch xem.]*
Spec "Cầu Nối BĐS" v2 của chủ dự án đẩy INS-04 đi xa hơn hẳn: không chỉ
không-thu-số-điện-thoại, mà **hai bên không bao giờ nhắn trực tiếp cho nhau** —
mọi trao đổi qua bot; buyer chỉ thấy mã listing + khu vực mức phường (không số
nhà); website hiển thị số điện thoại proxy; danh tính hai bên chỉ mở khoá tại
đúng một khoảnh khắc: **khi lịch xem nhà đã chốt** [nguồn: artifact "Cầu Nối BĐS" v2, phiên nhadat-bot, 08/2026].

Hệ quả cấu trúc:
1. Vị thế trung gian là tài sản — hai bên không thể "đi đêm" bỏ qua phí, và
   nhadat.cc kiểm soát trải nghiệm đầu-cuối.
2. Cần **lọc liên hệ chủ động**: mọi tin nhắn/ảnh relay phải được kiểm SĐT,
   Zalo ID, địa chỉ chính xác trước khi chuyển.
3. Trạng thái listing, matching, hàng đợi nằm trong database — LLM chỉ hiểu ý
   định và trích xuất, "không giao cho LLM nhớ".

### INS-12 — Sau sáp nhập 2025, địa giới CŨ vẫn là ngôn ngữ của thị trường
Từ 1/7/2025 TP.HCM sắp xếp lại đơn vị hành chính (bỏ cấp quận, sáp nhập phường —
Nghị quyết 202/2025/QH15), nhưng người mua bán nhà vẫn tìm kiếm và định giá theo
địa giới cũ: đối thủ radanhadat.vn đến giữa 2026 vẫn chạy toàn bộ URL SEO theo
quận/phường cũ (`/mua-ban-nha-dat-thanh-pho-ho-chi-minh-quan-go-vap`,
`quan-tan-phu`…) và chỉ xử lý địa giới mới bằng **bài content tra cứu** ánh xạ
cũ↔mới [nguồn: WebSearch 24/08/2026 — index Google site radanhadat.vn; bài
"Bản đồ TPHCM sau sáp nhập 2025" trên radanhadat.vn/edutech]. Chủ dự án chốt
cùng hướng: **nhadat.cc dùng vị trí lúc chưa sáp nhập** (Quận 5, phường cũ) làm
trục taxonomy chính [nguồn: trao đổi chủ dự án, 24/08/2026].

Hệ quả:
1. Taxonomy khu vực ở `04` giữ nguyên Quận 5 + phường cũ — không đổi URL.
2. Cần **bảng ánh xạ địa giới cũ↔mới** (`ward_mapping`) để: (a) hiển thị kèm tên
   phường mới khi nói chuyện pháp lý/sổ đỏ, (b) làm content SEO "tra cứu sau
   sáp nhập" — đúng khe traffic radanhadat đang khai thác.
3. Bot phải hiểu cả hai cách gọi trong chat ("Phường 4 Quận 5" và tên phường mới)
   và quy về cùng một khu vực.

### INS-13 — Bộ trường tin rao "chuẩn sàn" là mẫu số chung của thị trường
Đối chiếu 02/09/2026 hai sàn theo yêu cầu chủ dự án ("fetch db mogi.vn,
radanhadat.vn xem họ lấy gì"). Cả hai site chặn egress từ môi trường phân tích,
nên **mogi.vn** đọc qua bản HTML thật lưu trong một repo công khai (fixture
crawler, tin đăng 06/2026) + mã nguồn 7 crawler mở; **radanhadat.vn** đọc qua
quy chế đăng tin (`hotro.radanhadat.vn`) + snippet index Google [nguồn:
WebSearch + GitHub 02/09/2026 — chưa đọc DOM trực tiếp, cần xác minh lại khi
có trình duyệt thật].

| Trường | mogi.vn | radanhadat.vn | nhadat.cc TRƯỚC 02/09 | nhadat.cc SAU (FR-172) |
|---|---|---|---|---|
| Giá · diện tích · giá/m² | có · có · **không** | có · có · **có (tự tính)** | có · có · không | có · có · có (`price_per_m2_vnd`) |
| Ngang × dài | gộp trong ngoặc "145 m² (8x18,12)" | trường riêng "kích thước" | chỉ trong mô tả | `frontage_m`, `length_m`, `rear_width_m` |
| Số tầng · PN · WC | không · có · "nhà tắm" | **bắt buộc** cả ba | không · 79/173 · không | `floors`(+`floors_text`) · `bedrooms` · `bathrooms` |
| Đường vào (mặt tiền/hẻm) | ở **cấp danh mục** (`mua-nha-mat-tien-pho` / `mua-nha-hem-ngo`) | bắt buộc, text | chỉ trong mô tả | `access_type` + `alley_width_m` + `distance_to_street_m` |
| Pháp lý · hoàn công | enum · không | bắt buộc · không | không | `legal_status` · `has_completion` |
| Hướng | tuỳ chọn, thường trống | bắt buộc; chung cư tách hướng cửa/ban công | `direction` 0/173 | bóc từ mô tả + fact chủ nhà |
| Nội thất · năm xây · quy hoạch | không | nội thất có; năm xây không; quy hoạch là **công cụ** (lớp bản đồ) | không | `furnishing` · `year_built` · `planning_status` |
| Dự án · đường phố | dự án `-prj####`, đường `-sid####` | dự án là chiều địa lý thứ 5 | `project_id`, đường trong `location_raw` | + `street` bóc từ địa chỉ |
| Chính chủ / môi giới | **không có** (mọi tài khoản = môi giới) | quy chế nói kiểm duyệt, không thấy nhãn | `seller_type` gán từ chat (FR-159) | giữ |
| Lịch sử giá · giá đã giao dịch | không | không | `deals` (FR-142) | giữ — **khe hở cả hai sàn chưa lấp** |

Ba điều rút ra:
1. **Bộ tối thiểu thị trường đã đồng thuận** = diện tích, giá, ngang×dài, số
   tầng, PN, WC, hướng, đường vào, pháp lý (+ giá/m², dự án). SRS-3.1 đã đặc
   tả gần đủ từ đầu, nhưng bảng thật chỉ có diện tích, giá, PN (dở), hướng và
   tầng (rỗng) — ngang×dài, số tầng, WC, đường vào, pháp lý thì 164 mô tả tin
   của ta chứa ở dạng chữ, không cột nào giữ. Đưa bảng thật về đúng đặc tả (FR-172).
2. **Khe hở để chiếm**: không sàn nào có giá đã giao dịch, lịch sử tin, so sánh
   cùng hẻm — đúng thứ `deals` + `masterDB/` Quận 5 tích luỹ được. Và mogi lộ
   SĐT + toạ độ chính xác ngay trong HTML: ẩn danh hai chiều (INS-11, FR-104)
   vẫn là khác biệt thật.
3. **Đừng bắt điền form** (INS-05 giữ nguyên): radanhadat bắt buộc 10 trường
   lúc đăng; ta lấy cùng 10 trường đó bằng cách bóc câu rao + hỏi nhỏ giọt phần
   thiếu — cột nào đã bóc được thì không hỏi lại (FR-172 d).

## 1.2 Người dùng

### Bên mua (B)
Chân dung suy ra từ 24 đoạn hội thoại mẫu trong `chats w B.docx`:

- Xưng hô anh/chị/em, giọng miền Nam, kỳ vọng được đáp lại lễ phép và **nhanh**.
- Ngân sách chủ đạo quan sát được: **6–13 tỉ**, cá biệt 21–30 tỉ.
- Tiêu chí lặp lại: quận/phường → giá → HXH/MT → diện tích → pháp lý.
- Mục đích chia hai nhánh rõ rệt: **để ở** vs **đầu tư / kinh doanh** — và câu hỏi
  tiếp theo khác hẳn nhau ("mở quán ăn được không" vs "hoàn công chưa").
- Hành vi điển hình: xem 3 căn → xin thêm → xin ảnh → hỏi 1 căn cụ thể → im lặng.

### Bên bán (S)
- **CCRB**: rao 1–2 căn, không rành công nghệ, ngại form, phản hồi chậm, cần CTV
  người thật dẫn khách.
- **NMG**: rao nhiều căn, chuyên nghiệp hơn, chịu tiêu chuẩn chất lượng
  [nguồn: biz model.docx §NMG]:
  1. Tối thiểu **10 BĐS** đang rao tại mọi thời điểm.
  2. Tỉ lệ thành công **≥ 5%** trên giao dịch được giới thiệu, tính moving average 6 tháng.
  3. Chấm dứt hợp đồng ngay khi bị chấm **≤ 3/5 sao** ở bất kỳ tương tác nào.

### Nội bộ
- **CTV** (1.5 FTE trong 6 tháng đầu): dẫn xem nhà, quản lý NMG, hưởng 0.5%.
- **Chuyên viên / admin buyer side**: xử lý escalation qua email
  `admin.buyerside@nhadat.cc`.

## 1.3 Mô hình kinh doanh

| Bên | Phí | Ghi chú |
|---|---|---|
| B (mua/thuê) | **0đ** | Miễn phí tuyệt đối, là lời hứa thương hiệu |
| CCRB | **1%** giá trị BĐS | Trong đó 0.5% trả CTV, 0.5% giữ lại |
| NMG | **0.5%** giá trị BĐS | NMG tự dẫn khách xem nhà |
| Cho thuê | tương đương **3/4 tháng tiền thuê** | Quy đổi từ mức 1% |

[nguồn: biz model.docx §Doanh thu]

### OKRs 6 tháng sau launch
1. Nguồn dữ liệu phủ **90%** thị trường mua/bán/thuê Quận 5.
2. Mạng lưới **20 NMG** chuyên Quận 5.
3. **10 cuộc chat mới/ngày**, mỗi cuộc **≥ 30 tin nhắn**, không có chat vô nghĩa.
4. **1 giao dịch / 2 ngày**, giá trị trung bình **10 tỉ**.

> **Cảnh báo BA.** OKR 4 hàm ý ~90 giao dịch trong 6 tháng × 10 tỉ × ~0.75% ≈
> **6.7 tỉ doanh thu**, trong khi OKR 3 chỉ tạo ~1.800 cuộc chat. Tỉ lệ chuyển đổi
> chat→giao dịch phải đạt ~5% — bằng đúng ngưỡng tối thiểu áp cho NMG, tức là giả
> định *mọi* cuộc chat đều tốt như một môi giới giỏi. Xem `OPEN-01`.

## 1.4 Ràng buộc nguồn lực

Ngân sách 6 tháng đầu: **800.000.000 VND** [nguồn: dự kiến vốn 6 tháng đầu.xlsx].

| # | Khoản | Số tiền | Ghi chú |
|---|---|---|---|
| 1 | Xây dựng hệ thống | 390.000.000 | Vitalify (vendor) |
| 2 | Tạo trang web | 28.000.000 | nhadat.cc |
| 3 | Duy trì hệ thống 6 tháng | 120.000.000 | 20tr/tháng |
| 4 | CTV | 63.000.000 | 1.5 CTV × 7tr × 6 tháng |
| 5 | Quảng cáo dẫn link | 120.000.000 | 20tr/tháng (batdongsan.com.vn…) |
| 6 | Tư vấn khác | 29.000.000 | quản lý CTV |
| 7 | Roadshow, event | 50.000.000 | gọi vốn |
| | **Tổng** | **800.000.000** | |

Hệ quả cho phạm vi sản phẩm:
- **418tr cho toàn bộ build** → MVP phải cắt gọn, không làm app native, không làm
  marketplace hai chiều đầy đủ. Web + Zalo OA + admin tối thiểu.
- **1.5 CTV** → tối đa ~2–3 lịch xem nhà/ngày. Hệ thống phải **xếp hàng và ưu tiên**
  lịch xem, không thể giả định năng lực vô hạn.
- **20tr/tháng quảng cáo dẫn link từ batdongsan.com.vn** → thừa nhận đối thủ đang
  giữ nguồn traffic; nhadat.cc mua traffic chứ chưa cạnh tranh trực diện về SEO
  trong 6 tháng đầu.

## 1.5 Đối thủ & tham chiếu

| Nhóm | Đại diện | Điểm mạnh | Khe hở nhadat.cc khai thác |
|---|---|---|---|
| Portal listing VN | batdongsan.com.vn, chotot Nhà | Traffic, độ phủ toàn quốc | Bán lead → user bị spam gọi điện; tin trùng, tin ảo |
| Sàn/môi giới truyền thống | Đại lý khu vực | Quan hệ, biết hàng thật | Không trực 24/7, phủ hẹp, không lưu nhu cầu khách |
| Chat-first quốc tế | (concept trong `demo2Vitalify.docx`) | — | Chưa có bản địa hoá Zalo cho thị trường VN |
| Portal thế hệ mới | **radanhadat.vn** (MCDX, ra mắt 10/2024) | Đăng tin 0đ, công cụ cho môi giới, SEO facet mạnh | Vẫn là mô hình listing-first bán hiển thị; không có tầng hội thoại giữ khách — chi tiết §1.5b |
| Portal tối giản | **mogi.vn** | Danh mục 2 cấp phân biệt mặt tiền/hẻm ngay ở loại BĐS; SEO tới cấp đường (`-sid####`); trang giá theo quận | Tin chỉ ~7 trường cấu trúc (ngang×dài, HXH, số tầng nằm trong tiêu đề/mô tả tự do); lộ SĐT + toạ độ trong HTML dù UI che (ngược FR-104); mọi tài khoản là "môi giới", không có khái niệm chính chủ — INS-13 |

### 1.5b Phân tích sâu đối thủ trực tiếp: radanhadat.vn

Chủ dự án chỉ định đây là hình mẫu tham chiếu gần nhất ("tao tính làm cũng tương
tự web này") [nguồn: trao đổi chủ dự án, 24/08/2026]. Site chặn crawler từ môi
trường phân tích nên toàn bộ dưới đây tái dựng từ **nguồn thứ cấp** — index
Google của chính site + loạt bài PR (VnExpress, CafeF, Dân trí, baodautu,
Vietnamnet, 12/2024–2025) + mô tả app trên App Store/Google Play
[nguồn: WebSearch 24/08/2026]; cần xác minh lại bằng crawl trực tiếp
(Firecrawl) trước khi trích số liệu cụ thể.

**Mô hình.** Nền tảng đăng tin thế hệ mới của công ty MCDX (ra mắt 21/10/2024):
doanh thu từ phía đăng tin (bảng giá tin thường/VIP/premium + combo, trang
`/bang-gia-dang-tin`), đang chạy chính sách **đăng tin 0 đồng không giới hạn**
để gom cung — đúng bài toán "nguồn hàng trước" mà nhadat.cc cũng đối mặt (RSK-04).
Tin VIP mô tả tới 9 BĐS, premium 12 BĐS trong một tin.

**Tính năng phía người mua (B):**
1. **Tìm theo thời gian di chuyển** — nhập điểm neo (chỗ làm, trường…) và tìm BĐS
   trong ngưỡng phút di chuyển, thay vì chỉ theo ranh giới hành chính.
2. **Kiểm tra quy hoạch** — tra quy hoạch thửa đất ngay trong luồng xem tin
   (trọng tâm cho nhà phố/đất nền).
3. **Công cụ phân tích tài chính** — dòng tiền, tính khoản vay.
4. **Tìm theo tiện ích xung quanh** (siêu thị, trường, bệnh viện) cho căn hộ.

**Tính năng phía môi giới (app "Radanhadat.vn - Môi giới BĐS", 2025):**
1. Quản lý kho hàng với trường thông tin chuẩn hoá (DT, pháp lý, hướng, giá…).
2. **Matching tự động nhu cầu khách đã lưu ↔ kho hàng** — máy gợi ý căn phù hợp
   cho từng khách (đúng ý tưởng `interests`/FR-108 của ta, nhưng đặt trong tay
   môi giới chứ không phải bot).
3. **Chia sẻ kho hàng giữa các môi giới** trong mạng lưới (đầu chung — ta gọi
   là chia hàng NMG).
4. (Lộ trình) quản lý phòng ban cho chủ sàn: giao việc, theo dõi, **đánh giá
   hiệu suất môi giới** — tương đồng bài toán đánh giá CTV/NMG (FR-102).

**Luồng đăng tin (S):** nút "Đăng tin" → đăng nhập Google/Microsoft → bắt buộc
liên kết SĐT + OTP → khai CCCD/mã số thuế (tuân thủ pháp lý sàn TMĐT) → tạo tin
nhập trường + ảnh/video → **duyệt tin trước khi hiển thị**. Đối chiếu: đây chính
là form nhiều bước mà INS-05 xác định là phản mô hình với CCRB — khe hở của ta
là "rao bằng một câu, AI bóc tách" (FR-91) và rao ngay trong Zalo (FR-109).

**IA / SEO:** URL facet đúng kiểu `04` đang đặc tả — mẫu quan sát được:
`/mua-ban-nha-dat-{tinh-thanh}[-{quan}]/gia-tu-{X}-den-{Y}[-dt-tu-{A}-den-{B}]`,
`/thue-nha-dat-toan-quoc/...`; title gắn "mới nhất T{tháng}/{năm}" tự động.
Content hub `/edutech/` (bản đồ quy hoạch từng phường, review dự án, hướng dẫn
tra cứu sau sáp nhập) nuôi SEO informational; trung tâm hỗ trợ tách subdomain
`hotro.radanhadat.vn`. Địa giới: **toàn bộ URL vẫn theo quận/phường cũ** sau
sáp nhập 1/7/2025 → củng cố INS-12.

**Kết luận cạnh tranh — học gì, khác gì:**

| | radanhadat.vn | nhadat.cc học / khác |
|---|---|---|
| Học | URL facet + title theo tháng; content hub quy hoạch/sáp nhập; địa giới cũ làm trục | Áp vào `04` (đã cùng hướng); thêm content ánh xạ cũ↔mới (INS-12) |
| Học | Checklist trường chuẩn hoá theo loại BĐS trong app môi giới | Đã hiện thực bằng `required_facts`/`listing_missing_facts` (INS-06) |
| Khác | Listing-first: giá trị dừng ở tin đăng + công cụ; liên hệ = lộ SĐT trên tin | Chat-first: giá trị nằm ở hội thoại 3–4 năm (INS-01/02), ẩn danh hai chiều (INS-11) |
| Khác | Phục vụ môi giới là khách trả tiền chính, phủ toàn quốc | Phục vụ giao dịch đầu-cuối, sâu một quận (INS-08), phí theo giao dịch chứ không theo tin |
| Né | Đăng tin nhiều bước + duyệt tin thủ công | Rao một câu qua Zalo, AI viết lại (INS-05, FR-109) |

Ba công cụ B-side của họ (thời gian di chuyển, quy hoạch, tài chính) là ứng viên
tính năng giai đoạn sau cho ta ở dạng **trả lời trong chat** thay vì widget —
chưa đưa vào FR, chờ chủ dự án chọn phạm vi: ghi `OPEN-19`.

Tham chiếu giao diện: theme **Veedoo** — cấu trúc card listing,
thanh search dính đầu trang, khối thông số nổi trên ảnh hero ở trang chi tiết.
Chi tiết cách kế thừa/né: `06-ui-design.md` §Kế thừa từ Veedoo / Loại bỏ.
Ảnh chụp theme (`Vedoo pages/`) đã xoá khỏi repo 26/08/2026 — điều cần giữ
đã chưng cất hết vào `06`, đây chỉ còn là tên gọi của gốc bố cục.

> **Lưu ý bản quyền.** Theme thương mại nằm ở `ThemeForest/` đã bị loại khỏi repo.
> Chỉ tham chiếu *bố cục*, không sao chép asset. Xem `OPEN-07`.

### 1.5c Đối chiếu MÔ HÌNH DỮ LIỆU với ba sàn: họ lưu gì, mình còn thiếu gì (02/09/2026)

Yêu cầu chủ dự án: *"xem mấy web kia nó lưu cái gì vào db, xong xem còn thiếu
gì so với project mình"*. Ba sàn: **mogi.vn** (đọc qua bản HTML thật lưu trong
repo công khai + 4 crawler mở), **radanhadat.vn** (quy chế sàn, bảng giá tin,
mô tả app, snippet index — chỉ đoạn trích), **batdongsan.com.vn** (fixture HTML
trang tin 2024, template site 2021, 8 crawler mở, trợ giúp) — cả ba chặn truy
cập trực tiếp từ môi trường phân tích [nguồn: WebSearch + GitHub 02/09/2026;
mức tin cậy ghi từng dòng trong báo cáo agent, tóm ở đây]. Phía mình: 27 bảng
thật trên Supabase + những bảng SRS đã đặc tả mà chưa dựng.

| Thực thể | mogi | radanhadat | batdongsan | nhadat.cc hôm nay | Còn thiếu / đánh giá |
|---|---|---|---|---|---|
| **Tin rao** (trường chuẩn) | ~7 trường | 10 bắt buộc + kích thước | "Đặc điểm BĐS" 8 trường + giá/m² + tags | 24 cột thông số + giá/m² (FR-172) | **Đủ**. Thêm được `rental_yield_pct` (rada tính sẵn tỉ suất thuê từ `rent_income_vnd`) — rẻ |
| **Vòng đời tin** | ngày đăng, hạn 30 ngày tính lại theo lần làm mới, dịch vụ mua trên tin | **tin không bao giờ xoá**, lịch sử đăng lại / nâng cấp / từng lượt đẩy | ngày đăng, hết hạn, hẹn giờ, tự đăng lại, hạ/xoá, nháp — mỗi bước là một giao dịch | `status` 5 trạng thái + `created/updated/last_confirmed/last_interest_at` | **THIẾU `listing_events`** — SRS-3.2 đã đặc tả (FR-70, FR-73 "BĐS hot nhất", đều **M**) mà chưa dựng. Rẻ: trigger ghi sự kiện đổi trạng thái / quan tâm / lượt xem / xác nhận |
| **Người đăng / môi giới** | thực thể riêng: `JoinedDate`, `IsVerifiedIDCard`, `AgentCerNo`, `UserTypeId`, hồ sơ công khai `/moi-gioi/…-uid` là landing SEO thứ hai | không thấy hồ sơ công khai; xếp hạng top 10 môi giới/tháng | KYC đầy đủ (CCCD, selfie, Zalo, chứng chỉ, năm kinh nghiệm, khu vực × loại hình chuyên), điều kiện duy trì ≥5 tin/30 ngày, doanh nghiệp là tài khoản cha | `sellers` (tên, SĐT, nhãn ccrb/nmg, rating), view `agents_public`, `/moi-gioi` | Cố ý KHÔNG lộ danh tính (INS-11). Thiếu thật: `verified_at` / bằng chứng KYC cho NMG, và "khu vực × loại hình chuyên" — **OPEN-36** (KYC người bán vs ẩn danh) |
| **Tài khoản · ví · gói tin · thanh toán** | 3 gói tháng, hạn mức tin, Tin TOP/VIP/UP/nhãn, ví Mogi, mã thưởng, VAT | điểm theo **khung giờ** (1/5/20), ví hai túi (chính + KM hạn 3 tháng), combo, QR chuyển khoản, hoàn tiền hẹp | 2–4 túi tiền có HSD, mã CK định danh, sổ giao dịch có số dư sau mỗi dòng, giá theo ngày, tin tài trợ đấu giá | **không có** — doanh thu 100% phí thành công (biz model), `deals.fee_pct` | **Không phải khoảng trống**: mô hình khác. Chỉ thiếu sổ thu phí sau chốt (`deals` chưa có `fee_invoiced_at/fee_paid_at`) — ASM-05 nói thu ngoài hệ thống, để đó |
| **Lưu tin · tìm kiếm đã lưu · thông báo tin mới** | có cả hai; tìm kiếm băm thành `searchkey`; hộp thông báo | lưu tin, tin đã xem; **không thấy** tìm kiếm đã lưu | lưu tin (báo khi tin cập nhật), lưu tìm kiếm → thông báo tin mới, email/app | tim = localStorage (FR-121); `interests` phía bot; `buyers.preferences` chính là tiêu chí đã lưu | **THIẾU job `match_new_listings`** (SRS-5.3, FR-64 **M**): tin mới khớp `buyers.preferences` → bot chủ động nhắn. Đây là lõi "chat không bao giờ kết thúc", kênh của mình là Zalo chứ không phải email |
| **Lượt xem · thống kê cho người đăng** | lượt xem + thời gian dịch vụ trên trang thống kê; tracking sự kiện có nghĩa (gọi, hỏi, báo, lưu) | lượt xem, lịch sử đẩy | theo NGÀY: hiển thị / xem tin / xem SĐT / "khách hàng" 60 ngày | `listing_views` chỉ cho người đăng nhập; không đếm ẩn danh; chủ nhà không thấy gì | **THIẾU `listing_stats_daily`** (đếm ẩn danh từ `TrackView`, đã có sẵn điểm chạm) → bot báo chủ nhà "tuần này căn anh có 12 khách xem, 2 khách hỏi hẻm" — vừa là dữ liệu vừa là lý-do-vì-khách để chủ trả lời drip |
| **Lead / khách hàng của môi giới** | hộp thư `userInbox`, bấm hiện số, form vay | CRM app: khách + nhu cầu + lịch sử gửi căn + matching, chia sẻ giỏ giữa môi giới | lead = xem SĐT / gọi lại / SMS / email / form dự án, gắn SĐT đã OTP, dashboard "Khách hàng" | `conversations`/`messages`/`buyers.preferences`/`interests`/`viewings`/`deals` — **giàu hơn cả ba** vì chat-first | Đủ. Thứ ba sàn có mà mình không cần: SĐT khách (INS-04) |
| **Kiểm duyệt · báo tin xấu · khiếu nại** | duyệt trước, từ chối trùng, khoá tài khoản leo thang, nút báo xấu | state machine có SLA 4 giờ, lý do từ chối, khiếu nại mốc 7/15 ngày | duyệt ≤8h, lý do theo quy định, báo xấu + hotline, "tin đã bị báo xấu" | `cho_thong_tin` → admin duyệt (FR-127); tin nhặt từ nguồn thứ ba (FR-156) không có cửa báo sai | **THIẾU `listing_reports`** ("tin này bán rồi", "giá sai", "không liên lạc được") từ web lẫn chat + lý do khi admin gỡ. Kho 173 tin phần lớn nhặt từ ngoài — tin cũ là rủi ro uy tín lớn nhất (RSK-06) |
| **Xác thực tin** | — | — | hồ sơ xác thực: sổ + media geotag/timestamp + đối chiếu giá thị trường; nhãn **45 ngày**, gia hạn, gỡ khi bị báo | `last_confirmed_at`, `specs_source = chu_xac_nhan`, bucket `listing-private` cho sổ | Có nguyên liệu, **thiếu nhãn + hạn** trên web/bot ("xác minh với chủ nhà ngày X, còn hiệu lực"). Rẻ: suy từ cột đã có |
| **Taxonomy khu vực · đường · sáp nhập** | bảng phẳng có id mọi cấp, **polygon ranh giới**, `SEOTitle`, bảng tra sáp nhập 2025 | quận cũ trên URL, tin hiện "Phường Sài Gòn (Quận 1 cũ)" | id ở tỉnh/quận/phường/**đường**/dự án, mỗi cấp một trang SEO có đếm tin | `ward` text, `street` (FR-172, 65 đường), tâm phường trong code, `ward_mapping` (FR-118) chưa dựng | **THIẾU bảng `streets`** (Quận 5 có ~65 đường trong kho → trang `/duong/tran-hung-dao`, đúng khe "sâu một quận" INS-08) và `ward_mapping` (FR-118) |
| **Địa điểm · POI · thời gian di chuyển · quy hoạch** | địa điểm `pid` (trường, KCN) ngang hàng khu vực → landing "gần X" | lớp FIMO theo toạ độ/thửa: quy hoạch + quyết định, ngập, mật độ; POI bán kính; isochrone | POI quanh dự án; "Bản đồ nhà đất" | `landmarks jsonb` (SRS-3.1) chưa dựng; `lat/lng` 164/173; INS-07 nói "gần hồ bơi Lam Sơn" là cách khách hỏi | **THIẾU `pois`** cho Quận 5 (chợ, trường, bệnh viện, ngã tư, hồ bơi) — lấy từ OSM đã dùng ở `geocode-listings`, tính khoảng cách mỗi tin. Lớp quy hoạch/ngập: **OPEN-37** (nguồn dữ liệu, tiền) |
| **Dự án · chủ đầu tư** | `prj`/`oid` có id riêng, review cộng đồng | dự án có schema (CĐT, block/tầng/căn, mật độ, năm bàn giao, giá/m²) | dự án + doanh nghiệp là hai bảng, tiến độ timeline, tiện ích chuẩn, FAQ, tính lãi vay | `projects` (jsonb tiện ích/mặt bằng/loại căn), 1 dự án đối tác | Đủ cho quy mô hiện tại; `developers` tách bảng khi có > 3 dự án |
| **Giá theo khu vực · lịch sử giá** | `/gia-nha-dat-*`: đường × loại (MT/hẻm/CC) × **tháng**, % biến động, 10 năm dữ liệu | chỉ bài viết biên tập | phường × loại hình × **quý** (cờ tháng), giá phổ biến + khoảng + số tin + YoY, dùng lại khi duyệt tin; API `GetPricingHistory` | `/thong-ke` tính **tại chỗ** từ tin đang có (FR-120), `price_per_m2_vnd`, `deals.price_vnd` | **THIẾU snapshot `gia_khu_vuc` hằng tháng** (phường × loại × đường vào: trung vị giá/m², số tin, và **giá đã chốt** từ `deals` — thứ không sàn nào có). Không chụp từ bây giờ thì sau này không có lịch sử |
| **Ảnh** | CDN crop nhiều cỡ, lazy | ảnh + video review | crop theo kích thước + **watermark**, 3–24 ảnh, video ≤50MB, 360° | `listing_media` file gốc (vài MB/tấm), thẻ tin lazy | Thiếu thumbnail/watermark — Supabase Free không có biến đổi ảnh: **OPEN-38** |
| **Tỉ suất · công cụ tài chính** | tính vay UOB | tỉ suất lợi nhuận **trên từng tin**, phân tích đầu tư, tính giá đất theo bảng giá nhà nước | tính lãi suất ở trang dự án | `/tinh-lai-vay` (FR-119) | Thêm `rental_yield_pct` là xong (đã có `rent_income_vnd` 17 tin) |

**Kết luận.** Về *tin rao* mình đã ngang hoặc hơn (sau FR-172). Về *khách*
mình hơn hẳn vì chat-first. Khoảng trống thật nằm ở **lớp "chuyện gì đã xảy
ra với tin theo thời gian"** — sự kiện, lượt xem, giá theo tháng, báo tin sai —
là thứ cả ba sàn đều lưu và đều dùng lại (xếp hạng hot, duyệt tin, định giá).
SRS đã đặc tả đúng những bảng đó từ đầu (SRS-3.2, SRS-3.8b, SRS-5.3) nhưng chưa
dựng. Thứ tự đề xuất, mỗi việc là một migration nhỏ:

1. `listing_events` + `hot_score` (FR-70, FR-73 — M, SRS-3.2 có sẵn).
2. `match_new_listings` ↔ `buyers.preferences` → bot nhắn (FR-64 — M, SRS-5.3).
3. `gia_khu_vuc` snapshot tháng từ `listings` + `deals` (FR-99, FR-120).
4. `listing_reports` + lý do gỡ tin (RSK-06, FR-127).
5. `streets` + `ward_mapping` (FR-118, INS-08 — SEO cấp đường).
6. `pois` Quận 5 + khoảng cách mỗi tin (INS-07, SRS-3.1 `landmarks`).
7. Nhãn "đã xác minh với chủ nhà ngày X" + `rental_yield_pct` (chỉ hiển thị).

Ba việc chờ chủ dự án: OPEN-36 (KYC người bán), OPEN-37 (lớp quy hoạch/ngập),
OPEN-38 (thumbnail/watermark ảnh). Không đề xuất: ví/gói tin/đẩy tin (khác mô
hình doanh thu), SĐT khách trong lead (INS-04), CRM chia sẻ giữa môi giới
(OPEN-16 đã treo).

## 1.6 Rủi ro đã nhận diện

| ID | Rủi ro | Mức | Giảm thiểu |
|---|---|---|---|
| RSK-01 | Zalo cắt kết nối sau 7 ngày (INS-03) | Cao | Job tái kích hoạt ngày 5–6, nội dung buộc B phải trả lời |
| RSK-02 | Phụ thuộc một nền tảng đóng (Zalo) | Cao | Trừu tượng hoá tầng messaging; roadmap Messenger, Telegram [nguồn: biz model.docx §Tài khoản chat cá nhân] |
| RSK-03 | AI trả lời sai về pháp lý / quy hoạch | Cao | Không bao giờ khẳng định; luôn chuyển thành câu hỏi cho S (INS-06) |
| RSK-04 | Không đủ nguồn hàng → chat rỗng | Cao | OKR 2 (20 NMG) là điều kiện tiên quyết của OKR 3 |
| RSK-05 | 1.5 CTV không tải nổi lịch xem nhà | Trung bình | Hàng đợi + ưu tiên theo giá trị BĐS và độ nóng |
| RSK-06 | Tin ảo / đã bán nhưng còn hiển thị | Trung bình | Sự kiện `INFO_REQUESTED` định kỳ; hiển thị "cập nhật lần cuối" |
| RSK-07 | Lộ dữ liệu cá nhân (sổ đỏ, CCCD) qua chat | Cao | Ảnh sổ đỏ lưu bucket riêng, chỉ cấp URL ký hạn ngắn |

## 1.7 Khoảng trống dữ liệu

Những thứ **không** có trong tài liệu gốc và cần bổ sung trước khi chốt scope:

1. Số liệu thị trường sơ cấp Quận 5 (số BĐS đang rao, giá trung bình, thanh khoản).
2. Kết quả phỏng vấn người dùng thật — toàn bộ chân dung B hiện dựa trên hội thoại
   *giả định* do chủ dự án soạn, chưa phải transcript thật.
3. Danh sách TOP-100 keyword BĐS (file `.xlsm` trên Dropbox, chưa có trong repo).
4. Hạn mức API và chính sách nội dung của Zalo OA cho ngành BĐS.
