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
| OPEN-08 | ✅ **ĐÃ CHỐT 03/09/2026 — thương hiệu Aioinhadat**, bot "Thái" (xem OPEN-39). Tên miền web hiện vẫn nhadat.cc [giả định BA: chưa có chỉ đạo đổi domain] | — | Copy toàn hệ thống |
| OPEN-09 | Zalo OA có cho gửi tin chủ động ở tần suất cần? | Cao | FR-63, FR-64 |
| OPEN-10 | FR-99 định giá so sánh — chưa có đặc tả | Trung bình | FR-99 |
| OPEN-11 | Logstash làm hàng đợi tin nhắn | Cao | NFR-04 |
| OPEN-12 | Quy trình chấm điểm & chấm dứt NMG | Trung bình | FR-102 |
| OPEN-13 | Nguồn dữ liệu tiện ích quanh BĐS | Thấp | FR-28 |
| OPEN-14 | Chính sách fingerprint & tuân thủ dữ liệu cá nhân | Trung bình | FR-16, NFR-08 |
| OPEN-15 | Hàng dự án (căn/giỏ hàng) — **ĐÃ CHỐT: phương án (b)**, 24/08/2026 | Cao | → FR-113…FR-117 |
| OPEN-16 | ~~Có cần CRM riêng không?~~ **Đã chốt (b)** — bảng deals, không CRM ngoài | — | OPEN-02 |
| OPEN-17 | Định dạng mã công khai listing (#35148 vs BDS-Q5-0012) | Thấp | Copy web + chat |
| OPEN-18 | ✅ **CHỐT TRÊN THỰC TẾ 29/08/2026 — SUPABASE STORAGE** (FR-165 dựng hai bucket `listing-public`/`listing-private`, bảng `listing_media`, worker dọn file; kiểm TS-KHO 25/25). Không dựng adapter OneDrive: adapter chỉ có giá khi thật sự đổi kho, mà đổi kho chưa từng được yêu cầu — dựng sẵn một lớp trừu tượng cho việc chưa xảy ra là tự thêm chỗ hỏng. Cần đổi thì đổi lúc đó, lúc này đã có `app_config` để trỏ URL đi nơi khác. *(Nội dung thảo luận cũ giữ ở mục thân bên dưới.)* | Trung bình | FR-111, NFR-06, FR-165 |
| OPEN-19 | ~~3 công cụ B-side kiểu radanhadat~~ **Đã chốt (b)** 25/08/2026 — tính lãi vay làm rồi (FR-119, port NhaDat-Radar); quy hoạch không tự khẳng định; thời gian di chuyển để giai đoạn 2 | — | FR-119 |
| OPEN-20 | ✅ **ĐÃ CHỐT 27/08/2026 — LÀM** (chủ dự án: "AOND có hệ thống hạng Đồng/Bạc/Vàng cho người rao cứ làm đi test sau"). Đã dựng FR-155, nhưng **bằng công thức KHÁC AOND** — xem OPEN-26. Nội dung gốc giữ ở §OPEN-20 bên dưới | Trung bình | FR-155, OPEN-26 |
| OPEN-21 | Vai người rao 5 loại (CĐT/sàn/NMG/lướt sóng/chủ nhà) + phí riêng cho CĐT — mở rộng nhị phân CCRB/NMG? | Trung bình | BR-05, FR-101 |
| OPEN-22 | ✅ **ĐÃ CHỐT 27/08/2026 — DỮ LIỆU CHIA THEO DÒNG** (chủ dự án: "chia data từng dòng theo id bất động sản, vừa mua vừa bán thì lưu 2 dòng"). Tức là KHÔNG gom một người thành một vai; một Zalo có thể vừa có dòng `buyers` vừa có dòng `sellers`, mọi quan tâm/hỏi đáp bám theo mã căn như hiện tại. ✅ **PHẦN ĐỊNH TUYẾN VAI ĐÃ XONG 27/08/2026** (chủ dự án: "cứ lấy id zalo của người đó thôi"): nhận diện người giữ nguyên theo `zalo_user_id`, còn VAI thì xét từng lượt — tin có ý đi mua thì rẽ sang nhánh buyer, câu hỏi chờ không mất. Xem FR-157 (d), thử ở TS-NEO-04, chạy trên `chat-reply` v33. Nội dung gốc: một người **vừa mua vừa bán** bằng cùng một Zalo: hiện `chat-reply` hễ khớp `sellers.zalo_user_id` là luôn tiếp theo vai người bán — người này không hỏi mua được. Dữ liệu tin thì an toàn (mọi quan tâm/hỏi đáp bám theo mã căn, FR-139/140), chỉ vướng vai hội thoại. Phương án: (a) bot tự đoán vai theo nội dung tin từng lượt; (b) lệnh chuyển vai ("tôi muốn tìm mua"); khuyến nghị BA: (b) trước, (a) sau. Chờ chủ dự án chốt | Trung bình | FR-129, FR-130 |
| OPEN-23 | ✅ **ĐÃ CHỐT 27/08/2026 — XOÁ** (chủ dự án: "ok xóa"). Đã `drop table public.ratings` (0 dòng, không FK nào trỏ tới) và xoá `bot/supabase/functions/rate-ctv/` khỏi repo; FR-102 → `[deprecated → FR-137]`. *Function `rate-ctv` trên Dashboard cũng đã xoá — kiểm 27/08/2026 qua `list_edge_functions`: còn đúng 7 function, đều ACTIVE.* Nội dung gốc: edge function `rate-ctv` (FR-102) **trùng chức năng** với phần chấm điểm CTV nằm sẵn trong `ctv-report` (cùng rubric `RATE_CTV_RUBRIC`, cùng 4 tiêu chí): không có cron, không nơi nào gọi, bảng `ratings` nó ghi vào đang 0 dòng và không màn hình nào đọc. Phương án: (a) xoá `rate-ctv` + bảng `ratings`, đánh dấu FR-102 `[deprecated → FR-137]`; (b) giữ làm cửa chấm-lại-một-hội-thoại theo yêu cầu (admin bấm nút), khi đó cần màn hình đọc `ratings`. Khuyến nghị BA: (a) — chấm điểm đã nằm trong báo cáo 17h, giữ hai đường chấm là nguồn lệch số. Chờ chủ dự án chốt | Thấp | FR-102, FR-137 |
| OPEN-24 | `pg_net` mở cho `anon`: `has_schema_privilege('anon','net','usage')` và `has_function_privilege('anon','net.http_post…')` đều `true` → mồi **SSRF** (ai cầm anon key mà chọc tới `net.*` là sai DB gọi HTTP đi bất cứ đâu, từ IP của Supabase). Hôm nay chưa khai thác được vì PostgREST chỉ phơi `public` — nhưng đó là hàng rào cấu hình, không phải hàng rào quyền. **Không tự vá được**: schema `net` do `supabase_admin` sở hữu, ta là `postgres`, REVOKE thành no-op im lặng. Phương án: (a) gác cửa (giữ Exposed schemas đúng `public, graphql_public`; cấm hàm SECURITY INVOKER trong `public` gọi `net.*`); (b) mở ticket Supabase xin thu hồi grant mặc định. Khuyến nghị BA: (a) ngay + (b) song song | Cao | NFR-06, SRS-3.9 |
| OPEN-25 | ✅ **ĐÃ CHỐT 27/08/2026 — Ở LẠI FREE** (chủ dự án: "free trước đi, đã có user đâu"). Kèm điều kiện bắt buộc: phải chạy `scripts/sao-luu.mjs` định kỳ (Free KHÔNG có backup tự động) và bọc bridge bằng trình giám sát. **Xem lại quyết định này ngay khi có giao dịch thật đầu tiên** — lúc đó Vercel Hobby cấm dùng thương mại thành rủi ro thật, không còn là lý thuyết. Nội dung gốc: **bậc miễn phí không có lưới an toàn** (soát 27/08/2026, đối chiếu docs Supabase): (a) Supabase Free **KHÔNG có backup tự động** — docs ghi rõ chỉ Pro/Team/Enterprise mới được sao lưu hằng ngày, và bản sao lưu "không tải xuống được" với Free; hôm nay một câu `delete` nhỡ tay là mất 173 tin + toàn bộ lịch sử hội thoại, không có nút hoàn tác. (b) Không có PITR. (c) Vercel **Hobby cấm dùng thương mại**, mà site này thu phí giao dịch 1%/0.5% → rủi ro bị đình chỉ, không báo trước. (d) Bridge zca-js là MỘT tiến trình trên máy cá nhân, không có trình giám sát khởi động lại. Đã vá tạm: `scripts/sao-luu.mjs` (sao lưu tay) + FR-152 (nhịp tim + sổ lỗi). Phương án: (a) lên Supabase Pro + Vercel Pro; (b) ở lại Free và chấp nhận, nhưng phải đặt lịch chạy `sao-luu.mjs` và có trình giám sát cho bridge. Khuyến nghị BA: (a) trước khi có giao dịch thật đầu tiên — một cái sổ đỏ chốt hụt vì mất dữ liệu đắt hơn nhiều lần tiền hai gói | Cao | NFR-16, NFR-03, FR-152 |
| OPEN-26 | **Ngưỡng hạng Đồng/Bạc/Vàng là [giả định BA], chưa ai chốt.** FR-155 đã dựng bộ khung và đang chạy với: NMG — Vàng ≥10 tin đang rao **và** tỷ lệ chốt ≥5%, Bạc ≥5 tin đang rao **hoặc** ≥1 căn đã chốt, còn lại Đồng; CCRB — Vàng khi đã chốt ≥1 căn, Bạc khi tin đã đủ thông tin lên sàn, Đồng khi mới rao. Chỉ hai vế NMG có nguồn (ràng buộc "tối thiểu 10 tin và tỷ lệ chốt từ 5%" đã công bố trên `/moi-gioi`, `biz model.docx`); ba vế còn lại là BA tự đặt cho khớp. Hôm nay cả 3 NMG đều Bạc và **chưa ai có thể lên Vàng vì kho chưa có giao dịch `da_chot` nào** — hạng cao nhất đang là thứ không ai với tới, giống hệt lỗi "chưa có đánh giá" của OPEN-23. Phương án: (a) chủ dự án chốt ngưỡng thật (kèm quyền lợi mỗi hạng — hạng không kèm quyền lợi thì chỉ là màu sắc); (b) giữ ngưỡng tạm, nhưng ẨN hạng khỏi web tới khi có giao dịch thật đầu tiên, chỉ hiện trong `/admin`. ✅ **ĐÃ CHỐT PHẦN HIỂN THỊ 27/08/2026 — ẨN KHỎI WEB** (chủ dự án: "ẩn hạng khỏi web đi"), tức phương án (b): hạng vẫn tính và vẫn xem được ở `/admin`, chỉ chưa đưa ra trước mặt khách. Ngưỡng thì VẪN CHƯA CHỐT. Khuyến nghị BA: (a) khi có số thật để định cỡ. **Đã đối chiếu tài liệu gốc 27/08**: `AOND req + chat examples.docx` §IV có công thức riêng (điểm = 50% độ hoàn chỉnh dữ liệu + 50% độ kịp thời phản hồi; Đồng <50đ và bị giới hạn 5 căn, Bạc 50–79đ, Vàng ≥80đ) — FR-155 **KHÔNG** dùng công thức đó, vì cả hai vế hiện đo ra 0 cho toàn kho (xem OPEN-20). Câu hỏi treo còn lại: AOND buộc hạng vào **quyền lợi** gì (ưu tiên chuyển khách nét? giảm phí? chỉ huy hiệu?) và có áp trần số căn cho hạng Đồng không | Trung bình | FR-155, OPEN-20, OPEN-23, OPEN-12 |
| OPEN-27 | **Mở địa bàn ra HCM mới + Long An/Tây Ninh, nhưng hiển thị và tìm kiếm giữ TÊN CŨ.** Quyết định chủ dự án 27/08/2026 ("tao sẽ đánh bds trong khu vực hcm mới và long an tây ninh, nhưng hiển thị hoặc tìm kiếm vẫn là tên cũ cho user dễ dùng"). Cả bộ tài liệu và toàn bộ code đang đóng đinh **một quận**: `chat-reply` ghi cứng `district: "Quận 5"` khi tạo tin, regex phường chỉ bắt `Phường 1–16`, form `/admin/dang-tin` xổ đúng 16 phường, tone bot tự giới thiệu "môi giới bất động sản Quận 5", từ điển lóng neo vào Chợ Lớn/P10-P14, và **20 file** `.ts/.tsx` có nhắc Quận 5 hoặc `district`. Câu hỏi phải chốt trước khi code: (a) "tên cũ" lấy theo mốc nào — trước NQ 202/2025/QH15, hay theo tên dân vẫn gọi ("Chợ Lớn", "Phú Nhuận") kể cả khi hai thứ đó lệch nhau? (b) lưu trong DB là tên cũ hay tên mới, và bên nào là bản dịch (đây chính là bảng `ward_mapping` treo ở FR-118, giờ thành đường găng); (c) tiền tố mã tin `BDS-Q5-####` vừa được FR-158 chốt làm dãy duy nhất — giữ làm ID vô nghĩa (đã có tiền lệ: `geocode-listings` ghi rõ "mã tin mang tiền tố BDS-Q5 không có nghĩa BĐS ở Q5") hay đổi? Khuyến nghị BA: giữ tiền tố như ID vô nghĩa (đổi là gãy URL `/tin/<mã>` và cả thư mục ảnh `listing-photos/<mã>/`), và chốt (a)+(b) trước, vì mọi thứ còn lại phụ thuộc | **Cao** | FR-118, FR-158, BR-01 |
| OPEN-28 | **Phí có đi theo phân loại tự động của FR-160 không?** FR-160 chốt "≥3 tin rao bán = môi giới", nhưng `seller_type` đang đồng thời là thứ tính phí (BR-05: CCRB 1%, NMG 0.5%). Ghép thẳng hai thứ nghĩa là một chính chủ mở tin thứ ba thì phí tự rơi từ 1% xuống 0.5%, và tự leo lại khi tin cũ bị gỡ — mức phí nhảy theo một con số không ai báo cho họ biết. Hai phương án: (a) **tách hai khái niệm** — thêm cột dẫn xuất `vai_hanh_vi` (suy từ số tin, dùng cho giọng hỏi drip + hạng FR-155) và GIỮ `seller_type` khai bằng tay làm căn cứ tính phí; (b) ghép làm một đúng như lời chốt, chấp nhận phí trôi theo số tin. Khuyến nghị BA: (a) — số đếm là chỉ dấu hành vi tốt, nhưng phí là cam kết với người ta, không nên đổi sau lưng. Cần chủ dự án chốt trước khi code FR-160 | **Cao** | FR-160, BR-05, FR-155, OPEN-21 |
| OPEN-29 | ✅ **ĐÃ CHỐT 27/08/2026 — LÀM PHƯƠNG ÁN (a), ĐÃ DỰNG THÀNH FR-161** (chủ dự án: "sửa theo khuyến nghị rồi deploy hết đi"). Nội dung gốc: **Bot ĐIẾC với tiếng Việt không dấu — mà rất nhiều người nhắn Zalo không bỏ dấu.** Phát hiện 27/08/2026 lúc chạy TS-MA: gõ `nha minh ban chua em` thì cổng rao trượt ngay ở vế `\b(bán\|rao)\b` vì `"ban"` không khớp `"bán"`. Kiểm cả `bot/supabase/functions/` lẫn `lib/`: **không một chỗ nào bỏ dấu trước khi khớp**. Hệ quả trải khắp: câu rao không dấu (`ban nha quan 5 gia 5 ty`) KHÔNG sinh tin dù có đủ giá — im lặng y hệt con bug FR-158 vừa vá, chỉ khác nguyên nhân; `hoiMua` không tách được vai (`toi muon mua nha`); `PROMISE_RE` không bắt được lời hứa (`chieu gui anh`); regex phường/giá cũng vậy. Riêng phía người mua thì đỡ hơn vì mặc định đã rơi vào nhánh mua (FR-159), nhưng phía bán là mất trắng câu rao. Phương án: (a) chuẩn hoá `text` một lần đầu hàm (`normalize('NFD')` + bỏ dấu) rồi cho MỌI regex cổng chạy trên bản không dấu, giữ `text` gốc để lưu `description` và đưa cho model — model đọc không dấu vẫn tốt, chỉ regex là mù; (b) viết mỗi regex thành hai nhánh có-dấu/không-dấu. Khuyến nghị BA: (a), vì (b) là nhân đôi số chỗ phải sửa mỗi lần thêm từ. Chưa code, cần chốt trước khi chạy thật | **Cao** | FR-158, FR-129, FR-133, FR-157 |
| OPEN-30 | ✅ **ĐÃ SỬA 28/08/2026 — chat-reply v40** (chủ dự án: "Fix đi"). Cả BA lệnh gọi model nhánh seller (`r1`/`r2`/`r3`) và cả bước tạo `anthropicClient` giờ bọc try/catch + `ghiLoi` + câu mẫu tất định, cùng chuẩn với nhánh mua. Câu mẫu của `r2` CÓ hỏi câu drip kế tiếp (kèm neo căn từ FACT_LABELS) nên `info_requests` chỉ mở khi câu hỏi THẬT SỰ được gửi — đúng luật "không mở khi chưa hỏi được"; `r1` chào bằng mẫu kèm câu hỏi đầu; `r3` ghi nhận bằng mẫu. Test sống trên v40: câu rao sinh tin + model soạn reply bình thường (key đã có credit lại); đường fallback kiểm bằng review vì không giả lập được key hỏng trên môi trường sống. Nội dung gốc: **Nhánh seller gọi model KHÔNG có lưới đỡ — model lỗi là chủ nhà nhận im lặng + HTTP 500.** Lộ ra 27/08 khi chạy TS-KD-01 đúng lúc API key Anthropic của bot hết credit: tin rao vẫn sinh ĐỦ và ĐÚNG (dữ liệu ghi trước khi gọi model, đúng thiết kế FR-152) nhưng ba lệnh gọi model của nhánh seller (`r1` chào tin mới, `r2` hỏi drip, `r3` chăm sóc chung) đều trần trụi — exception xuyên thẳng ra 500, chủ nhà không nhận được chữ nào, và vì là exception nên cũng KHÔNG qua `ghiLoi`. Nhánh mua làm đúng bài từ đầu: try/catch + `ghiLoi` + câu trả lời template. Chữa: bọc ba lệnh gọi trong try/catch, lỗi thì `ghiLoi` + trả template ("Dạ em nhận tin rồi ạ, em xử lý rồi báo lại anh/chị liền nha") — KHÔNG mở `info_requests` mới khi chưa hỏi được. Việc riêng, chưa làm | Trung bình | FR-152, FR-158, FR-161 |
| OPEN-31 | **Bậc nguồn `chu_xac_nhan > admin`: admin cầm sổ đỏ mà chủ nhà nhớ nhầm thì ai thắng?** FR-164(a) khoá cột trước lời admin; cần một bậc riêng cho bằng chứng giấy tờ hay không | Trung bình | FR-164, FR-156, FR-129, FR-163 |
| OPEN-32 | **Ảnh chủ nhà gửi qua chat KHÔNG đi qua hai bucket, nên tách công khai/riêng tư của FR-165 không phủ được nó.** `chat-reply` lưu mọi ảnh người bán gửi thành fact `hinh_anh` (URL Zalo CDN, không vào kho ta), rồi FR-143 gộp thẳng vào `photos` gửi cho NGƯỜI MUA. Mà vòng drip FR-129 có hỏi `phap_ly` — chủ nhà trả lời câu đó bằng ảnh chụp sổ là chuyện thường, và ảnh đó bị ghi nhãn `hinh_anh` bất kể đang hỏi gì. Sửa được nhưng phải đụng luồng chat, mà đợt này chủ dự án khoanh vùng "do not change chat logic" | **Cao** | FR-165, FR-143, FR-129, FR-105, NFR-06 |
| OPEN-33 | **Webhook Zalo nhận sự kiện KHÔNG kiểm chữ ký — ai cũng giả được tin nhắn đến.** `zalo-webhook` buộc chạy `verify_jwt=false` (Zalo không gửi JWT Supabase được) nên chữ ký `X-ZEvent-Signature` là hàng rào DUY NHẤT; khối verify chỉ chạy khi có đủ `ZALO_APP_SECRET` + `ZALO_APP_ID`, mà hai secret đó KHÔNG có trong Vault. Đo 29/08: POST sự kiện bịa, không khoá không chữ ký → 200. Giả được tin nhắn với BẤT KỲ `sender.id` nào (đội lốt chủ nhà bơm fact vào tin họ, hoặc bơm tin rác đốt tiền model). Không tự chặn cứng vì chặn là bot chết với người dùng thật — quyết định vận hành của chủ dự án; bản FR-167 cho nó kêu vào `bot_errors`. Chữa = đặt hai secret vào Vault, không sửa dòng code nào | **Cao** | FR-167, FR-162, SRS-4.4, NFR-06 |
| OPEN-34 | Gộp `zalo-webhook` → `chat-reply` thành một lambda? Nêu trong đợt FR-171, cố ý chưa làm | Trung bình | FR-171, SRS-2 |
| OPEN-35 | Nhắc lời hứa / hỏi thăm khách im: mẫu câu cố định hay lượt model? | Thấp | FR-133, FR-171 |
| OPEN-36 | ✅ **ĐÃ CHỐT 02/09/2026** — lưu hết thông tin chủ chia sẻ, khách hỏi mới khai; liên hệ mở lúc chốt lịch xem (INS-11 chỉnh lại) | — | INS-11, FR-104 |
| OPEN-37 | Lớp dữ liệu vị trí (quy hoạch, ngập, tiện ích): lấy từ đâu, trả bao nhiêu? | Trung bình | FR-28, INS-13, OPEN-40 |
| OPEN-38 | Ảnh tin: thumbnail và watermark trên bậc Free | Thấp | FR-165, NFR-16 |
| OPEN-39 | ✅ **ĐÃ CHỐT 03/09/2026** (chủ dự án: *"bot Thái và Aioinhadat, không có gia đình trợ lý gì hết"*) — thương hiệu **Aioinhadat**, MỘT trợ lý tên **Thái**, KHÔNG nhận kho tên •ai của AOND §II. Đã đổi `TONE_RULES` + `bot_prompts.tone_rules`/`rate_ctv_rubric` ("em là Thái, bên Aioinhadat") | — | OPEN-08, FR-20, DH-01 |
| OPEN-40 | **Phạm vi loại BĐS**: thông số cho thuê, đất nền, nhóm công nghiệp (AOND §III) | Trung bình | FR-172, OPEN-37, DH-03 |
| OPEN-41 | **Nhà cung cấp model**: giữ Claude trên Supabase hay theo AOND §VII (Gemini rồi local) | Thấp | SRS-2, FR-138, FR-168, DH-06 |
| OPEN-42 | **Ngưỡng CTV**: hạn trả lời câu khách hỏi (đang 120 phút) và ngưỡng hạng Vàng ≥90% / Bạc ≥70% / dưới 3 câu = chưa đủ — đều [giả định BA] | Trung bình | FR-173, FR-137, DH-03 |

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

### OPEN-08 · Tên thương hiệu — **ĐÃ CHỐT 03/09/2026**
Tài liệu dùng lẫn `nhadat.cc`, `nhadatCC`, `Nhã Đạt CC`, `nhaadaat.com`.
**Khuyến nghị cũ**: tên miền `nhadat.cc`, tên đọc **Nhã Đạt CC**, tên viết trong sản phẩm
**nhadat.cc**. Bỏ hẳn `nhaadaat.com`.
**Chốt 03/09/2026** (cùng OPEN-39): thương hiệu là **Aioinhadat**; bot tự giới thiệu
"em là Thái, bên Aioinhadat". Tên miền web vẫn `nhadat.cc` cho tới khi có chỉ đạo
đổi [giả định BA]; bộ docs/ vẫn gọi dự án là nhadat.cc theo tên repo.

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

*[cập nhật 29/08/2026]* Phần THỰC HÀNH của khuyến nghị này đã được dựng bằng FR-166:
hàng đợi nghiệp vụ nằm trong chính Postgres (`inbound_events` → `inbound_ledger`,
`reminders`, `media_cleanup_queue`) với worker là edge function do pg_cron gọi — không
Redis, không Kafka, không thêm hạ tầng nào. Yêu cầu của chủ dự án 29/08 nói thẳng "Do
not introduce Redis unless the repository proves it is necessary", và repo không chứng
minh được điều đó. Nghiệm thu: TS-JOB-01…30.
**Vẫn treo**: chốt với vendor về Logstash trong bản đề xuất kỹ thuật — đó là chuyện báo
giá và hợp đồng, không phải chuyện code, nên vẫn chờ chủ dự án.

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
(không spam S) đã chạm một phần; nhadat-cc có sẵn độ đo
`listing_missing_facts` — nghĩa là 50% "độ hoàn chỉnh" tính được ngay.
*(Cập nhật 27/08/2026: bảng `ratings` từng nêu ở đây đã XOÁ theo OPEN-23; nếu
làm gamification thì phải dựng nguồn chấm điểm mới, đừng tính là đã có sẵn.)*
**Phương án**: (a) không làm MVP, chỉ giữ số liệu ngầm (đếm fact đủ/thiếu, tốc
độ trả lời) để sau này quy đổi điểm; (b) làm điểm + hạng nhưng **không nói ra
trong chat** (dùng nội bộ xếp ưu tiên CTV/khách nét); (c) làm đầy đủ như AOND,
điểm hiện trong tin nhắn.
**Khuyến nghị**: (a) → (b). Đo ngầm từ bây giờ (rẻ), quyết định "nói ra trong
chat" sau khi có ≥20 NMG thật — nói điểm sớm quá với ít người dùng dễ thành trò
đùa. (c) chỉ khi hai dự án hợp nhất cơ chế.

**Cập nhật 27/08/2026 — ĐÃ CHỐT "LÀM", nhưng làm chưa đúng công thức AOND.**
FR-155 đang chạy bằng **số lượng tin + tỷ lệ chốt**, không phải công thức AOND
(50% độ hoàn chỉnh dữ liệu + 50% độ kịp thời phản hồi). Lý do không bê thẳng
công thức AOND vào: cả hai vế của nó hôm nay đều đo ra **0** cho toàn kho.

- *Độ hoàn chỉnh*: `listing_missing_facts` chỉ đối chiếu `required_facts` với
  bảng `listing_facts` — nó **không nhìn các cột** `area_m2` / `bedrooms` /
  `price_vnd`. Kho 173 tin nhập từ Excel có 0 dòng `listing_facts`, nên theo
  thước đo này mọi tin đều "hoàn chỉnh 0%" dù cột đã đầy. Muốn dùng công thức
  AOND thì **phải sửa thước đo trước**, không thì mọi người rao đều Đồng vĩnh
  viễn và cái giới hạn "Đồng chỉ được 5 căn" sẽ chặn oan 3 NMG đang có 17–22 tin.
- *Độ kịp thời*: đọc từ `info_requests.answered_at − created_at`. Hôm nay bảng
  đó chưa có lượt nào được trả lời, nên vế này chưa có số thật để chuẩn hoá.

Việc còn phải làm nếu chốt theo AOND: (1) sửa `listing_missing_facts` (hoặc thêm
view mới) để tính cả dữ liệu nằm ở cột, không chỉ ở `listing_facts`; (2) đợi có
lượt hỏi–đáp thật để chuẩn hoá vế kịp thời; (3) chốt có áp trần "Đồng tối đa 5
căn" hay không — đây là chính sách kinh doanh, không phải kỹ thuật.

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

---

### OPEN-25 · Bậc miễn phí không có lưới an toàn (backup, PITR, license, bridge)

**Phát hiện**: soát cloud/compute 27/08/2026 (mục *Availability & Recovery*).

**(a) Không có backup — không phải "ít", là KHÔNG CÓ.**

Trích docs Supabase (*Database Backups*, *Production Checklist*):

> "We automatically back up all **Pro, Team, and Enterprise** Plan projects on
> a daily basis."
>
> "Database backups are **not available for download** for Free Plan projects."
>
> "We recommend that free tier plan projects regularly export their data using
> the Supabase CLI `db dump` command."

Project `nhadat-cc` đang ở org bậc **Free**. Nghĩa là ngay lúc này, kho 173 tin,
toàn bộ `messages`, `conversations`, `buyers.preferences` (hồ sơ nhu cầu — thứ
làm nên FR-130, không dựng lại được từ đâu) đều **không có bản sao nào**. Một
migration viết sai một dòng `where` là mất sạch.

*Đã vá tạm*: `scripts/sao-luu.mjs` — kéo cả 23 bảng về JSON bằng service_role.
Chạy tay, chưa có lịch. Đây là băng gạc, không phải backup thật: nó không có
WAL, không khôi phục về đúng một thời điểm được, và chỉ tốt bằng lần cuối ai đó
nhớ chạy nó.

**(b) Không có PITR.** Đi kèm gói trả phí. RPO hiện tại = khoảng cách giữa hai
lần chạy `sao-luu.mjs` bằng tay.

**(c) Vercel Hobby cấm dùng thương mại.** Site này thu 1% (CCRB) / 0.5% (NMG)
giá trị giao dịch — đúng định nghĩa thương mại. Vercel đình chỉ project vì
license thì không báo trước và không có SLA nào để bám.

**(d) Bridge là điểm chết đơn.** `bot/bridge-zca` là một tiến trình Node trên
máy cá nhân chủ dự án, giữ phiên Zalo acc clone. Máy ngủ / mất mạng / process
chết → toàn bộ đường chat phía B đứng, mà **cửa báo động cũng đi qua chính nó**.
FR-152 gỡ một nửa (ghi sổ + hiện trên `/admin`), nửa còn lại — báo chủ động khi
bridge chết — chưa có đường nào không vòng lại qua bridge.

**Phương án**

- **(a) Lên Pro cả hai** (Supabase Pro + Vercel Pro): có backup ngày, có PITR
  (add-on), hết rủi ro license, hết auto-pause.
- **(b) Ở lại Free**: bắt buộc đặt lịch `sao-luu.mjs` (Task Scheduler / cron
  trên máy chủ dự án, ngày một lần, cất ra ổ khác) + trình giám sát cho bridge
  (pm2 / systemd / NSSM) để nó tự dựng lại.

**Khuyến nghị BA**: (a), và làm **trước** giao dịch thật đầu tiên. Một cái sổ đỏ
chốt hụt vì mất dữ liệu đắt hơn nhiều lần tiền hai gói. Trong lúc chờ, làm (b)
ngay — nó rẻ và mất 20 phút.

**Chờ chủ dự án chốt.**

---

### OPEN-26 · Ngưỡng hạng Đồng/Bạc/Vàng

Nội dung đầy đủ ở bảng tóm tắt đầu file. Tóm: FR-155 đã dựng bộ khung và đang
chạy với ngưỡng **[giả định BA]**, chưa ai chốt. Hạng hiện ra mắt người dùng,
nên đổi ngưỡng về sau là đổi hạng của người đang có hạng.

**Chờ chủ dự án chốt** (mức: Trung bình).

---

### OPEN-27 · Mở địa bàn ra HCM mới + Long An/Tây Ninh

Nội dung đầy đủ ở bảng tóm tắt đầu file. Tóm: quyết định 27/08/2026 mở địa bàn
nhưng hiển thị và tìm kiếm **giữ tên cũ**. Còn treo phần đường cơ sở: dữ liệu,
mã tin, taxonomy và SEO đang neo vào Quận 5.

**Chờ chủ dự án chốt** (mức: Cao).

---

### OPEN-28 · Phí có đi theo phân loại tự động của FR-160 không?

Nội dung đầy đủ ở bảng tóm tắt đầu file. Tóm: FR-160 suy `seller_type` từ số tin
đang rao (≥3 → NMG), mà `seller_type` đồng thời là thứ tính phí (BR-05: CCRB 1%,
NMG 0.5%). Chính chủ mở tin thứ ba là phí TỰ RƠI MỘT NỬA, và rơi ngược lại khi gỡ
tin. FR-160 vì vậy **chưa dựng**.

*[01/09/2026 — thêm một cạnh]* Từ FR-159, người bán mở hồ sơ ngay trong chat
mang `seller_type = unknown` cho tới khi được phân loại. Lúc chốt kèo (FR-142)
`chat-reply` tính `fee_pct` theo `seller_type`; bản trước coi mọi giá trị khác
`ccrb` là môi giới 0,5% — tức chính chủ vào qua chat mà chốt trước khi phân loại
bị tính phí SAI một nửa. Đã sửa: `unknown` → `fee_pct = null`, tức deal ghi
KHÔNG CÓ mức phí, cần người thật gán trước khi lập hợp đồng. Câu hỏi thêm cho
chủ dự án: ai gán, ở đâu (form admin? bot hỏi "anh là chính chủ hay môi giới"?),
và có được gán tự động theo FR-160 không — cùng một nút với câu hỏi gốc.

*[02/09/2026 — chủ dự án chốt NỬA ĐẦU]*: "Gán nhãn khi ai bóc tách là họ có
bds muốn bán" — nhãn gán ngay lúc hồ sơ mở từ chat: có BĐS muốn bán = chính chủ,
tự xưng môi giới = môi giới (FR-159 đoạn 02/09, migration `20260902a`). Hồ sơ
mở qua chat không còn `unknown`. **Còn treo nửa sau, đúng câu hỏi gốc**: người
đã mang nhãn chính chủ mà rao tới tin thứ ba thì có TỰ LẬT sang môi giới theo
FR-160 không, và phí của tin đang rao có đổi theo không. Hàm DB hiện KHÔNG ghi
đè nhãn đã có, nên nếu chốt "có lật" thì phải mở thêm một đường riêng cho FR-160.

**Chờ chủ dự án chốt nửa sau** (mức: Cao).

---

### OPEN-29 · Bot điếc với tiếng Việt không dấu

✅ **ĐÃ CHỐT 27/08/2026 — làm phương án (a), đã dựng thành FR-161.** Nội dung gốc
và lý lẽ ở bảng tóm tắt đầu file.

---

### OPEN-30 · Một lệnh gọi model hỏng kéo sập cả lượt chat

✅ **ĐÃ SỬA 28/08/2026 — chat-reply v40.** Ba lệnh gọi model nhánh seller và bước
tạo `anthropicClient` đều đã bọc try/catch. Chi tiết ở bảng tóm tắt đầu file.
*[29/08/2026 — cùng lưới đã trải sang `nudge` v14+ theo FR-166: `anthropicClient`
và cả hai lệnh gọi model đều bọc, hỏng thì `bao_hong_nhac` chứ không thoát khỏi
vòng lặp.]*

---

### OPEN-31 · Bậc nguồn khi admin cầm bằng chứng cứng

FR-164(a) xếp `chu_xac_nhan` (3) > `admin` (2) > `suy_doan` (1). Lý lẽ chắc và
khớp hai tài liệu có sẵn: FR-156 nói rõ tin admin nhập là tin "nhặt trên
Facebook, Chợ Tốt, Batdongsan, sổ tay CTV" — tức nguồn bên thứ ba; còn cả vòng
drip FR-129 sinh ra chỉ để lấy bằng được lời của người thật sự có căn nhà. Lời
chủ mà thua admin thì drip vô nghĩa.

**Nhưng thứ bậc đó KHOÁ cột.** Một khi chủ nhà đã trả lời, admin không ghi đè
được nữa — kể cả khi admin đang cầm sổ đỏ trong tay và con số trên sổ khác con
số chủ nhà nhớ nhầm. Diện tích và phường là hai thứ người ta hay nhớ sai nhất.

Hai phương án:

- **(a)** Thêm một bậc `admin_xac_minh` (4) dành riêng cho trường hợp admin đã
  đối chiếu giấy tờ. Chủ nhà vẫn thắng admin thường, nhưng giấy tờ thắng tất.
- **(b)** Giữ nguyên hoàn toàn, coi sai lệch là chuyện của con người: admin thấy
  sai thì nhắn hỏi lại để chủ nhà TỰ sửa, hệ thống không có cửa hậu nào.

**Khuyến nghị (a).** Bằng chứng giấy tờ là loại dữ liệu khác hẳn lời nói; gộp nó
chung một bậc với "admin gõ tay từ tin Chợ Tốt" là đánh đồng hai thứ không cùng
độ tin. Phương án (b) gọn hơn nhưng đẩy toàn bộ gánh nặng sang thao tác tay, mà
chủ nhà im lặng thì không có đường nào sửa.

Chưa dựng. Chờ chủ dự án chốt.

### OPEN-32 · Ảnh gửi qua chat nằm ngoài ranh giới công khai/riêng tư

FR-165 dựng hai bucket và ràng ở DB rằng `so_do`/`giay_to` phải nằm trong
`listing-private`. Ràng buộc đó chỉ có hiệu lực với file ĐI QUA KHO CỦA TA.

Ảnh chủ nhà gửi qua Zalo thì không đi qua đó. `chat-reply` lưu URL Zalo CDN
thành fact `hinh_anh`, và FR-143 gộp chính những URL đó vào mảng `photos` gửi
cho người mua. Hai chi tiết làm nó thành rủi ro thật chứ không phải giả định:

1. Vòng drip FR-129 có hỏi `phap_ly`. Người bán trả lời câu đó bằng ảnh chụp
   sổ hồng là chuyện bình thường.
2. Nhánh ảnh trong `chat-reply` ghi nhãn `hinh_anh` cho MỌI ảnh không kèm chữ,
   bất kể câu hỏi đang chờ là gì. Nên ảnh sổ vào kho ảnh của tin, rồi ra với
   khách mua.

FR-105 vốn đã ghi "ảnh duyệt tay giai đoạn đầu" — nhưng chưa có ai duyệt.

Ba hướng, chưa chọn:

- **(a)** Ảnh trả lời câu `phap_ly` (hoặc ảnh mà model đọc ra là giấy tờ) thì
  ghi nhãn `giay_to`, không vào `photos` gửi khách. Đúng gốc nhất, nhưng phải
  sửa nhánh ảnh của `chat-reply`.
- **(b)** Kéo ảnh chat về `listing-private` rồi mới phân loại — có kho, có
  provenance, nhưng thêm một pipeline tải file.
- **(c)** Giữ nguyên, chặn ở khâu duyệt tay theo FR-105.

**Khuyến nghị (a)**, và làm sớm: đây là đường rò giấy tờ đất của người dân ra
người lạ, không phải lỗi hiển thị. Chưa dựng vì đợt FR-165 được khoanh vùng
"không đụng luồng chat".

### OPEN-33 · Webhook Zalo đang nhận sự kiện KHÔNG kiểm chữ ký

**Mức: CAO. Phát hiện 29/08/2026 khi soát bảo mật (FR-167), đo được chứ không suy đoán.**

`zalo-webhook` buộc phải chạy `verify_jwt=false` — Zalo không gửi được JWT của
Supabase. Nên hàng rào DUY NHẤT của nó là chữ ký `X-ZEvent-Signature`. Mà khối
verify chỉ chạy khi có ĐỦ `ZALO_APP_SECRET` và `ZALO_APP_ID`; hai secret đó hiện
KHÔNG có trong Vault, nên khối bị nhảy qua và hàm nhận mọi thứ.

Đo thật 29/08: POST một sự kiện bịa, không khoá không chữ ký → **200 `{"ok":true}`**.

**Khai thác được gì**: giả tin nhắn đến với BẤT KỲ `sender.id` nào. Đội lốt Zalo
ID của một chủ nhà là bơm được fact vào tin của họ (giá, phường, pháp lý — những
thứ FR-164 đóng dấu `chu_xac_nhan` rồi KHOÁ cột); bơm tin rác là đốt tiền model
và làm ngập `messages`.

**Vì sao đợt soát KHÔNG tự chặn cứng**: chặn là bot chết ngay với người dùng
thật. Đó là đánh đổi vận hành, thuộc quyền chủ dự án, không phải quyền của một
đợt soát bảo mật. Thay vào đó bản này cho nó KÊU TO: mỗi lượt bỏ qua verify ghi
một dòng `zalo-webhook KHONG VERIFY` vào `bot_errors` (có van 20 dòng/giờ của
`log_loi` nên không ngập sổ), hiện ở trang `/admin`.

**Khuyến nghị**: đặt `ZALO_APP_SECRET` + `ZALO_APP_ID` vào Vault. Có hai secret
đó là khối verify tự bật, không phải sửa dòng code nào — chữ ký sai sẽ bị trả
401 như thiết kế ban đầu. Đây là việc 5 phút và nó đóng lỗ nghiêm trọng nhất còn
lại của hệ thống.

**Chờ chủ dự án chốt.**

---

### OPEN-34 · Gộp `zalo-webhook` → `chat-reply` thành một lambda?

**Mức: TRUNG BÌNH. Nêu 02/09/2026 trong đợt tối ưu FR-171, cố ý KHÔNG làm.**

Hiện một tin khách nhắn đi qua HAI edge function: `zalo-webhook` nhận, ghi
`inbound_events`, ack 200, rồi gọi HTTP sang `chat-reply`; xong lại nhận kết
quả về để gửi bong bóng. Tức mỗi tin là hai lần khởi động lambda, hai lần đọc
bí mật, một lượt HTTP nội bộ giữa chừng — đo sơ khoảng 200–400 ms và một phần
tiền compute, trên MỌI tin.

**Vì sao chưa gộp**: đó là đổi kiến trúc, không phải tối ưu tại chỗ. Ranh giới
hai hàm đang là chỗ giữ đúng luật chống-gửi-đúp (FR-162/166: `sent_bubbles`,
cửa `replay_event_id`, đường cứu `inbound-sweep` gọi ngược `zalo-webhook`), và
`chat-reply` còn là "bộ não dùng chung mọi kênh" (NFR-12) mà bridge acc clone
gọi thẳng. Gộp là phải thiết kế lại cả ba thứ đó, có test riêng.

**Hai phương án**: (a) giữ hai hàm, chấp nhận chi phí cố định — hợp với lưu
lượng hiện nay (10 chat/ngày, BR-03); (b) gộp khi lưu lượng lên ~10× — lúc đó
`chat-reply` nhận thẳng event Zalo, `zalo-webhook` chỉ còn là cửa cho bridge
và đường cứu. Khuyến nghị (a) cho tới khi `/admin` cho thấy compute là thứ
đáng tiền; hiện thứ đáng tiền là model, không phải lambda.

**Chờ chủ dự án chốt.**

---

### OPEN-35 · Nhắc lời hứa / hỏi thăm khách im: mẫu câu hay lượt model?

**Mức: THẤP. Nêu 02/09/2026 (FR-171), là quyết định sản phẩm.**

`nudge` gọi model cho MỖI tin nhắc (lời hứa tới hẹn, lịch xem, follow-up căn,
hỏi thăm khách im 5–6 ngày) và `ask-seller` gọi model cho mỗi câu hỏi nhỏ giọt.
Đó là những tin ~20–30 từ, khuôn cố định, nội dung động chỉ là tên khách + mã
căn + một chi tiết. Một bộ mẫu câu (xoay 3–4 biến thể để không lặp — luật §6.8
"không lặp mẫu hai lần liên tiếp") làm được ~80% số đó với chi phí bằng 0 và
không bao giờ bịa.

**Đánh đổi**: mẫu câu nghe "máy" hơn ở đúng chỗ bot đang cố nghe như người
(INS-01, tone §6.8); và follow-up căn (FR-32) cần "kể thêm MỘT chi tiết đáng
giá" từ fact — việc đó mẫu câu làm dở. Đợt FR-171 đã hạ `ask-seller` xuống
`effort: low`/512 và `nudge` vốn đã `low`/256, tức phần tiền còn lại nhỏ.

**Khuyến nghị**: giữ model cho follow-up căn và câu hỏi nhỏ giọt (cần nội
dung thật); cân nhắc mẫu câu cho nhắc lịch xem và nhắc lời hứa (khuôn gần như
cố định). Chốt sau khi có số thật ở `/admin` (thẻ "Tiền bộ não") vài tuần.

**Chờ chủ dự án chốt.**

---

### OPEN-36 · Xác thực (KYC) người bán/môi giới có mâu thuẫn với ẩn danh hai chiều không? — **ĐÃ CHỐT 02/09/2026**

**Quyết định chủ dự án (02/09/2026, nguyên văn):** *"Không phải ẩn danh nhưng
tất cả thông tin người bán đã chia sẻ sẽ lưu và khi khách hỏi thì mới khai báo
chứ."* Tức nguyên tắc là **LƯU HẾT — KHAI KHI HỎI**, không phải "giấu":

1. Mọi thứ người bán đã chia sẻ (câu rao, câu trả lời nhỏ giọt, ảnh, sổ) đều
   lưu — đã đúng như hiện nay (`listing_facts` append-only, `listing_media`).
2. Bot **không chủ động phơi** trên web/kho, nhưng khách hỏi tới đâu thì khai
   tới đó từ dữ liệu đã lưu; chỉ thứ CHƯA có mới "để em hỏi lại chủ nhà".
   Khối "căn khách đang nhắc" trong `chat-reply` đã làm đúng thế (địa chỉ,
   thông số FR-172, fact đã xác minh); thứ cần sửa là chữ "ẩn danh" trong docs.
3. KYC (CCCD, chứng chỉ) vì thế không mâu thuẫn — nếu có thì cũng là "thông
   tin người bán đã chia sẻ", lưu và khai khi hỏi. Chưa làm cho tới khi có NMG
   thật.

**Ranh giới còn giữ (giả định BA, chủ dự án chưa nói tới):** số điện thoại /
Zalo của người bán vẫn chỉ mở ở bước chốt lịch xem (UF-06), vì đó là chốt giữ
phí thành công (INS-11 điều 1); ảnh sổ nằm bucket riêng, khai khi hỏi cần
đường signed URL (NFR-06, chưa dựng). Nếu chủ dự án muốn khai cả SĐT khi khách
hỏi thì ghi lại đây và sửa FR-104.

*(Phân tích ban đầu giữ bên dưới để đối chiếu.)*

Cả mogi (`IsVerifiedIDCard`, `AgentCerNo`) lẫn batdongsan (CCCD + selfie +
Zalo + chứng chỉ, danh hiệu "Môi giới chuyên nghiệp", điều kiện duy trì ≥5
tin/30 ngày) đều coi **người đăng đã xác thực** là tài sản uy tín và là trang
SEO thứ hai sau tin. Mình thì INS-11 ẩn danh hai chiều: khách chỉ thấy mã tin,
người bán không lộ tên/số. `sellers` hiện có `seller_type`, `rating_*` và
`agents_public` chỉ lộ tên NMG + số tin.

**Hai phương án**: (a) giữ nguyên — uy tín là của nhadat.cc, không của từng
người bán; bot nói "tin đã xác minh với chủ nhà ngày X" là đủ; (b) thêm
`sellers.verified_at` + bằng chứng KYC (CCCD lưu bucket riêng, không bao giờ
hiện) và nhãn "chính chủ đã xác thực" trên tin — không lộ danh tính nhưng lộ
*trạng thái xác thực*. (b) tốn một luồng thu CCCD qua chat (nhạy cảm, đúng thứ
`sổ đỏ samples/` bị cấm) và luật lưu trữ. Khuyến nghị (a) cho tới khi có NMG
thật; nếu chọn (b) thì làm cùng đường signed URL NFR-06 còn thiếu.

~~Chờ chủ dự án chốt.~~ Đã chốt như trên.

---

### OPEN-37 · Lớp dữ liệu vị trí (quy hoạch, ngập, POI): lấy từ đâu, trả bao nhiêu?

**Mức: TRUNG BÌNH. Nêu 02/09/2026 (docs/01 §1.5c).**

radanhadat mua lớp FIMO (ảnh vệ tinh: quy hoạch + quyết định, ngập, mật độ,
cập nhật tháng) và biến "rà" thành tên thương hiệu; mogi có "địa điểm" (trường,
KCN) để sinh landing "gần X"; batdongsan có POI quanh dự án. Mình có
`lat/lng` cho 164/173 tin qua Nominatim (FR-122) và INS-07 nói khách hỏi "gần
hồ bơi Lam Sơn", "gần ngã tư X–Y" — đúng câu hỏi mà POI trả lời được.

**Ba mức, tăng dần tiền**: (1) `pois` Quận 5 tự nhập + OSM (chợ, trường, bệnh
viện, ngã tư, hồ bơi — vài trăm điểm, 0 đồng, làm được ngay, đề xuất mục 6 ở
§1.5c); (2) khoảng cách/thời gian đi tới POI tính sẵn cho mỗi tin (OSRM công
cộng hoặc tự tính đường chim bay); (3) quy hoạch/ngập theo thửa — cần nguồn trả
tiền hoặc bản đồ quy hoạch quận (PDF) số hoá tay, và câu trả lời sai về quy
hoạch là rủi ro pháp lý (TONE §6.8 cấm khẳng định quy hoạch). Khuyến nghị làm
(1) và (2); (3) chỉ khi có nguồn chính thức.

**Chờ chủ dự án chốt.**

---

### OPEN-38 · Ảnh tin: thumbnail và watermark trên bậc Free

**Mức: THẤP. Nêu 02/09/2026 (docs/01 §1.5c).**

Ba sàn đều phục vụ ảnh qua CDN có nhiều cỡ (crop 200×200, 600×800…) và
batdongsan đóng watermark. Mình lưu file gốc từ điện thoại (vài MB/tấm) trong
`listing-public`, thẻ tin tải lazy nhưng vẫn là file gốc; lưới 24 thẻ = vài
chục MB nếu tin có ảnh thật. Biến đổi ảnh của Supabase Storage là tính năng
bậc Pro (NFR-16: free trước).

**Phương án**: (a) `scripts/up-anh.mjs` sinh thêm bản 480px lúc up (sharp),
lưu cùng thư mục UUID, `listing_media.variants`; (b) `next/image` với loader
tự viết — Vercel Hobby có hạn mức tối ưu ảnh; (c) chờ lên Pro. Watermark: chỉ
đáng khi có tin bị sao chép — chưa thấy. Khuyến nghị (a), làm khi có > 20 tin
có ảnh thật.

**Chờ chủ dự án chốt.**

### OPEN-39 · Tên thương hiệu và tên trợ lý: nhadat.cc, aioinhadat, hay cả hai?

**Mức: TRUNG BÌNH. Nêu 03/09/2026 (`docs/00-dinh-huong.md §0.8`).**

**Nguồn**: quyết định chủ dự án 03/09/2026 *"giờ làm theo hướng aioinhadat nhiều
hơn là nhadat.cc rồi"*; `AOND req + chat examples.docx` §II (SRD AI Ơi Nhà Đất,
aioinhadat.com): kho tên trợ lý ghép phụ âm + "•ai" (m•ai cho người mua, t•ai
cho người bán…). Hôm nay bot xưng **một** tên "Thái" (`06 §6.8`), domain là
nhadat.cc, kênh Zalo là acc clone qua bridge (OA đang chờ — FR-145); OPEN-08 (tên thương hiệu) vẫn treo từ
21/08/2026. Đổi tên là đổi domain, OA, copy toàn hệ thống, `TONE_RULES`,
`bot_prompts.tone_rules`, và cả cách bot tự giới thiệu ở FR-20.

**Phương án**: (a) giữ nhadat.cc + "Thái" như đang chạy, aioinhadat chỉ là nguồn
thiết kế; (b) đổi thương hiệu sang aioinhadat, gia đình trợ lý •ai đúng AOND §II
(hai tên trước mặt khách: m•ai / t•ai); (c) lai — thương hiệu giữ, bot mang hai
tên nội bộ theo vai để log và báo cáo phân biệt, trước mặt khách vẫn một tên.
**Khuyến nghị BA**: (c) ngay (không tốn gì: `sender` đã tách vai từng lượt theo
FR-157), và chỉ chuyển sang (b) khi chốt OPEN-08 — làm một lần, đừng đổi tên bot
trước rồi đổi domain sau.

**ĐÃ CHỐT 03/09/2026** — chủ dự án: *"bot Thái và Aioinhadat, không có gia đình
trợ lý gì hết"*. Tức: thương hiệu Aioinhadat, một trợ lý tên Thái, bỏ hẳn kho tên
•ai. Đã sửa `_shared/prompts.ts` (TONE_RULES, RATE_CTV_RUBRIC) và hai dòng
`bot_prompts` tương ứng trên DB; docs/06 §6.8 ghi theo. Domain chưa đổi (OPEN-08).

### OPEN-40 · Phạm vi loại BĐS: thông số cho thuê, đất nền, và nhóm công nghiệp

**Mức: TRUNG BÌNH. Nêu 03/09/2026 (`docs/00-dinh-huong.md §0.3`).**

**Nguồn**: `AOND req + chat examples.docx` §III (cấu trúc dữ liệu động theo ba
nhóm BĐS + thông số cho thuê). FR-172 mới phủ nhóm 1 (nhà ở: kết cấu, hẻm, hoàn
công, pháp lý). Còn lại: *cho thuê* (thời hạn hợp đồng, mức cọc, trượt giá, thời
gian fit-out) — kho đã có tin cho thuê và phí ¾ tháng đã chốt (§1.3) nhưng cột
chỉ có `rent_income_vnd`; *đất* (chỉ tiêu xây dựng, vướng cột điện/hố ga) — có
`planning_status`, `frontage_m × length_m`, nguồn quy hoạch treo ở OPEN-37; *công
nghiệp* (đất SKC/TMD, kho, xưởng: thời hạn sử dụng đất, chiều cao trần, tải trọng
sàn, trạm biến áp, container) — 173 tin không có loại này, chưa khách nào hỏi.

**Phương án**: (a) làm thông số cho thuê ngay (4 cột + regex bóc + drip hỏi),
đất chờ OPEN-37, công nghiệp không làm; (b) làm cả ba nhóm đúng AOND §III để
schema "động" từ đầu; (c) không làm gì thêm cho tới khi có khách hỏi.
**Khuyến nghị BA**: (a). Cho thuê là loại giao dịch đã có phí và đã có tin; công
nghiệp là thị trường khác (khu công nghiệp, không phải Quận 5) và kéo theo bộ câu
hỏi drip riêng — mở khi có tin thật đầu tiên.

**Chờ chủ dự án chốt.**

### OPEN-41 · Nhà cung cấp model: giữ Claude trên Supabase, hay theo AOND (Gemini rồi chạy local)?

**Mức: THẤP. Nêu 03/09/2026 (`docs/00-dinh-huong.md §0.3`).**

**Nguồn**: `AOND req + chat examples.docx` §VII: "bắt đầu bằng Google Gemini API
(1.5 Flash cho text, 1.5 Pro cho OCR) để ra mắt nhanh, viết code chuẩn cắm-rút
để sau này chuyển về chạy local trên máy ASUS Ascent GX10". Hệ thống thật đang
chạy Claude qua Supabase Edge (`SRS-2`), một lớp gọi model ở `_shared/claude.ts`,
"não" cấu hình được không cần deploy (FR-138), đo tiền theo chữ (FR-169), chuông
hết tiền (FR-168). Bộ kiểm thử `10` (67 kịch bản e2e + regex [nguồn:
bot/README.md, 02/09/2026]) neo vào hành vi model hiện tại.

**Phương án**: (a) giữ như đang chạy, ghi nhận lớp gọi model là chỗ đổi duy nhất;
(b) đổi sang Gemini theo AOND; (c) lai — Gemini cho OCR ảnh giấy tờ (nếu FR-134
mở rộng sang đọc sổ), Claude cho hội thoại.
**Khuyến nghị BA**: (a). Chưa có lý do chi phí hay chất lượng để đổi; đổi là chạy
lại toàn bộ `10`. Xem lại khi hoá đơn model vượt ngưỡng FR-168 hai tháng liền
hoặc khi cần OCR giấy tờ thật.

**Chờ chủ dự án chốt.**

### OPEN-42 · Ngưỡng CTV: hạn trả lời và mốc hạng Đồng/Bạc/Vàng

**Mức: TRUNG BÌNH. Nêu 03/09/2026 (FR-173).**

**Nguồn**: quyết định chủ dự án 03/09/2026 *"nếu CTV bận sau khoảng thời gian
chưa rep thì chấm điểm Đồng/Bạc/Vàng, và nhắn để admin hỗ trợ khách"* — "khoảng
thời gian" và thang điểm không được nêu số. BA đặt tạm để chạy được ngay:
hạn **120 phút** (`ctv_sla_phut()`, nhịp kiểm 15 phút trong 8–20h VN, nên câu hỏi
lúc 20h30 chỉ bị coi là trễ vào 8h sáng hôm sau); hạng theo **tỷ lệ trả lời đúng
hạn 30 ngày**: Vàng ≥ 90%, Bạc ≥ 70%, còn lại Đồng; dưới 3 câu = "chưa đủ dữ
liệu". Khác với FR-155 (hạng người rao theo số tin + tỷ lệ chốt) và với công thức
AOND §IV (50% hoàn chỉnh + 50% kịp thời) — đây là thang riêng cho CTV, chỉ đo
độ kịp thời, vì CTV không rao tin.

**Phương án**: (a) giữ 120 phút / 90-70 tới khi có ~30 câu thật rồi định cỡ lại;
(b) hạn theo giờ làm việc (ví dụ 60 phút trong 8–18h, đêm không tính); (c) gộp
độ kịp thời vào điểm chăm khách 4 tiêu chí của FR-137 thành một số.
**Khuyến nghị BA**: (a), và ghi ngưỡng ở một hàm DB như đang làm để đổi không
cần deploy. Hạng chỉ có nghĩa khi đi kèm hệ quả (ưu tiên nhận đơn? thưởng?) —
chưa có, cần chốt cùng lúc.

**Chờ chủ dự án chốt.**

---

### Soát mã nguồn 27/08/2026 — kết luận về advisor Supabase

Advisor bảo mật đang báo **2 ERROR**. Đã soi từng cái, **cả hai là cố ý và an
toàn** — ghi lại đây để lần sau không ai đi "vá" nhầm:

**`security_definer_view` trên `public.agents_public`** — view phơi đúng
`id, name, seller_type, rating_sum, rating_count, listing_count`, lọc
`seller_type = 'nmg'`. **Không có** `phone`, `zalo_user_id`, `email`, `auth_user_id`.
Nó PHẢI là SECURITY DEFINER thì anon mới đọc được qua RLS của `sellers` — đó
chính là mục đích của FR-125: một hình chiếu công khai đã cắt sạch liên hệ.

**`security_definer_view` trên `public.listing_photos_v`** — *[viết lại
29/08/2026 theo FR-165; bản cũ mô tả view đọc `storage.objects` lọc
`bucket_id='listing-photos'`, không còn đúng]*. Nay view đọc bảng
`listing_media`, lọc `bucket='listing-public'` **và tin ĐÃ LÊN KỆ** *(vế thứ hai
siết thêm 29/08/2026 — FR-167c, sau khi đo thấy anon đọc ra mã tin + đường dẫn
ảnh của tin `cho_thong_tin`)*, trả `code/url/path/sort_order/is_cover/created_at`. Bucket đó **công khai**, URL ai cũng mở được. Lý do THẬT
phải giữ SECURITY DEFINER là view ghép URL từ `app_config`, mà `app_config` đã
bị thu hồi quyền đọc của anon — bỏ definer là anon vỡ ngay
("permission denied"), đo được ở TS-KHO-21. Cũng vì thế view đọc `app_config`
bằng subquery chứ không gọi `cau_hinh()`: quyền EXECUTE một HÀM vẫn xét theo
người gọi, không theo chủ view.

**`security_definer_view` trên `public.ctv_ranks`** *(thêm 03/09/2026, FR-173)* —
cố ý, cùng lý do với `seller_ranks` ngược lại: `ctvs` và `info_requests` bật RLS
không policy, nên view chạy quyền người gọi thì admin đăng nhập bằng JWT đọc ra
rỗng. View tự gác cổng bằng `auth.role() = 'service_role'` hoặc email trong
`admins` (hàm `auth.*` xét theo phiên người gọi, không theo chủ view); đã đo
anon nhận 0 dòng, service_role đọc đủ (TS-CTV, 03/09). Không phơi SĐT/Zalo —
chỉ tên CTV và bốn con số đếm. Cùng đợt: `20260903b` thu hồi EXECUTE của
anon/authenticated trên `info_request_sla_tick()` và
`info_request_bao_lai_khach()`, cố định `search_path` cho `ctv_sla_phut()`.

**`anon_security_definer_function_executable` trên `log_loi`** (WARN) — cố ý,
xem FR-152 (d). Server Next.js chạy bằng publishable key nên bắt buộc mở cho
`anon`; bù lại có hai van 20 dòng/nguồn/giờ và 200 dòng/giờ, đã thử thật.

**`extension_in_public` cho `pg_net`** (WARN) — không tự chuyển được, schema do
`supabase_admin` sở hữu. Cùng gốc với OPEN-24.

**12 INFO `rls_enabled_no_policy`** — bật RLS mà không policy = **chặn hết**,
đúng ý: các bảng đó (`messages`, `conversations`, `reminders`, `deals`…) chỉ
`service_role` được đụng. Không phải lỗi.

Advisor hiệu năng: 8 index chưa dùng (bảng còn nhỏ, để đó) và 1 WARN
`multiple_permissive_policies` trên `listings` cho vai `authenticated` (3 policy
`anon_read_listings` / `listings_admin_read` / `listings_own_read` cùng chạy mỗi
query SELECT). Gộp lại được nhưng ở quy mô 164 tin thì chưa đáng đánh đổi độ
rõ ràng của luật quyền. Xem lại khi `listings` qua ~10k dòng.

