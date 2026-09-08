# BÀN GIAO: nâng cấp bot rao bán AI Ơi Nhà Đất (repo Python ở máy)
Ngày 08/09/2026, bản 2. Tài liệu tự đủ, dán nguyên sang session khác là làm được.

---
## 0. Mục tiêu
1. Bot trả lời NGẮN (tối đa 20 từ/tin), MỘT bong bóng, giọng người thật, không markdown, không emoji.
2. Không dội tin: mỗi lượt khách nhắn thì bot đáp đúng 1 tin; tin chủ động (nhắc, keep-alive) tối đa 1 tin/ngày/người.
3. Bóc dữ liệu đúng khi khách trả lời cụt ("Ngang 5", "5 tấm", "16m") hoặc trả lời lệch câu hỏi.
4. Có "câu hỏi đang treo": khách chưa trả lời đúng thì bot hỏi lại bằng lời khác, không nhảy sang câu khác.
5. AI chỉ ĐỀ XUẤT dữ liệu, code KIỂM rồi mới GHI, kèm nguồn và độ tin. Không đè dữ liệu chủ nhà đã nói.
6. Khách dặn xưng hô ("kêu chị nha") thì đổi và giữ suốt.

---
## 1. Bối cảnh: có HAI hệ thống, đừng nhầm
| | Repo Python ở máy (tài liệu này) | Bot "Thái" đang chạy trên Zalo |
|---|---|---|
| Ở đâu | `C:\Users\quang\OneDrive - Nha Dat Co Ltd\Tệp của Luan Ngo-Tran - AOND` | Supabase project `tbcdpupiarkuxtntmosl`, edge function `chat-reply` |
| Prompt | `src/aioi/prompts.py` | bảng `public.bot_prompts` (9 khóa) |
| Bóc dữ liệu | AI (Claude tool-use, JSON schema) | code regex + trigger SQL |
| Lưu | SQLite `aioi.db`, bảng `listings.fields_json` (blob JSON) | Postgres `listings` (cột) + `listing_facts` |
| Tin chủ động | chưa có (chỉ có mốc 5 ngày ở `engine.py:2459`) | cron `nudge` + bảng `reminders` |

Phạm vi tài liệu này = repo Python. Mục 7 ghi riêng lỗi bên Supabase để tham khảo.

### 1.1 Cách chạy repo
```bash
# Python hệ thống 3.14, KHÔNG có venv. Thiếu 3 gói, cài:
python -m pip install anthropic python-dotenv pytest
# .env có sẵn ANTHROPIC_API_KEY và AIOI_CHAT_MODEL=claude-sonnet-4-6 (đừng in nội dung .env)
python cli.py
# Test (230 test, ~10s, offline dùng mock):
python -m pytest -q -p no:cacheprovider tests
```
`load_settings()` rơi về provider mock khi không đọc được key. Thấy "(offline)" trong câu trả lời tức là chưa gọi Claude thật.

### 1.2 File đang bị KHÓA ghi (ACL)
Mọi file `src/aioi/*.py`, `tests/*.py`, `cli.py`, `pyproject.toml` có ACE `Everyone:(DENY)(DE,WD,AD,DC)`. Tạo file mới thì được, ghi đè/xóa thì không. Tool Edit của Claude cũng fail (EPERM). Gỡ khóa từng file:
```bash
icacls "src\aioi\prompts.py" /remove:d Everyone
icacls "src\aioi\engine.py"  /remove:d Everyone
icacls "src\aioi\schema.py"  /remove:d Everyone
icacls "src\aioi\delivery.py" /remove:d Everyone
icacls "tests\test_engine.py" /remove:d Everyone
icacls "tests\test_prompts.py" /remove:d Everyone
```
Ai đặt khóa và vì sao: chưa rõ, hỏi sếp trước khi gỡ hàng loạt. Backup bản gốc prompts.py có ở file `prompts.py.bak`.

---
## 2. Kiến trúc mỗi lượt chat (đọc engine.py để đối chiếu)
Vào `Engine.handle(user_key, text)` tại `engine.py:1197`:
1. **AI bóc** — `_plan_and_apply` (`engine.py` ~1230): gọi `provider.extract(OPERATIONS_SYSTEM + bộ nhớ dự án, lịch sử, operations_schema())`. Claude trả về danh sách thao tác `update/add/remove` với các trường. Tool-use ép schema ở `llm/claude.py:40-57` (tool `save_property_data`).
2. **Code ghi** — `_apply_operation` → `Property.update` (`schema.py`): giá trị mới ĐÈ cũ, không bậc nguồn, không lịch sử. Đây là chỗ "5 tấm" làm `kich_thuoc` "ngang 5m" bị đè thành "5x20".
3. **Code chọn câu hỏi** — `prop.missing_fields()` theo thứ tự cứng: `identity_fields()` (loai_hinh, dia_chi, dien_tich_dat, dien_tich_nha, gia) rồi `CORE_FIELDS[group]`. `next_field = missing[0]`. Không có khái niệm "câu đang treo".
4. **AI viết câu trả lời** — `build_chat_system(name, prop, next_field, user_type, project_block)` (`prompts.py:169`) + các khối bộ nhớ dự án/rổ hàng, rồi `provider.chat`.
5. **Code tách bong bóng** — `delivery.chunk_reply` (`delivery.py:21`): trả lời dưới 160 ký tự và không xuống dòng thì 1 bong bóng; có xuống dòng hoặc dài hơn thì tách thành nhiều bong bóng gửi cách nhau. Đây là lý do prompt cũ ra 2 bong bóng.
6. **Code lưu** — `_build_result` → `SqliteConversationStore.save` (`engine.py:410`): bảng `conversations`, `listings(fields_json, media_json)`. Không đẩy đi đâu khác.

Ba prompt giai đoạn: `build_chat_system` (thu thập), `build_listing_proposal_system` (dự thảo tin), `build_fee_followup_system` (phí). Chào: `build_greeting`.

---
## 3. Kết quả đo thực tế (Claude thật, 5 tin y hệt log Zalo)
Tin khách: `Bán nhà bán nhà ở Trần Bình Trọng em` → `Ngang 5` → `5 tấm em` → `Kêu chị nha` → `16m nha`

### Prompt CŨ (3 lần chạy)
- Dài 26–45 từ/tin, 2 bong bóng, in đậm `**`, gạch dài `—`, 2–3 emoji.
- Hiểu đúng: địa chỉ, "ngang 5" → hỏi dài (3/3), "5 tấm" = 5 tầng (3/3), đổi "chị" (3/3).
- Lỗi: "5 tấm" → extractor ghi `kich_thuoc="5x20"` (3/3, số 20 bịa). "16m" → 1/3 lần ghi thành `chieu_cao_tran=16m`. Có lần bỏ qua `next_field` để hỏi phòng ngủ/giá. Có lần hỏi lại điều vừa ghi.

### Prompt MỚI v2 (file `prompts_v2_ngan_gon.py`, 3 lần chạy)
- 9–15 từ/tin, 1 bong bóng, không markdown/emoji. Chào 40 từ (cũ 60).
- Ví dụ: "Ngang 5 khách chuộng lắm anh. Dài bao nhiêu mét ạ?" / "Dạ vâng chị. Sổ công nhận bao nhiêu m2 ạ?"
- 230 test vẫn pass với prompt mới (chạy bằng bản sao package trong thư mục tạm, PYTHONPATH trỏ vào).
- CÒN LỖI (prompt không chữa được, cần code): "5 tấm" vẫn có lần đè `kich_thuoc` thành "5x20" hoặc "5x?"; có lần không tự tính `dien_tich_dat` từ "5x16".

---
## 4. VIỆC CẦN LÀM TRONG REPO (theo thứ tự)

### 4.1 Thay `src/aioi/prompts.py` bằng bản v2
Ba chỗ đổi so với bản gốc (nội dung nguyên văn ở Phụ lục A):
- Khối giọng điệu trong `build_chat_system` (thay từ dòng `ĐỘ DÀI (tự cân nhắc...` đến dòng `- Ngắn gọn, thân thiện, đậm chất địa phương...`).
- `build_greeting` rút còn 1 đoạn, bỏ `**`. Test `tests/test_engine.py:37` cần chuỗi `AI Ơi Nhà Đất - Buyers` còn trong lời chào — đã giữ.
- `EXTRACTION_SYSTEM` thêm luật câu cụt, tiếng lóng, kich_thuoc, kèm 6 ví dụ mẫu.
- `FIELD_LABELS`: `dien_tich_dat` → `diện tích đất — hỏi ngắn: "Sổ công nhận bao nhiêu m2 ạ?" (khách đã cho ngang thì hỏi dài)`; `dien_tich_nha` → `diện tích sàn sử dụng (tổng các tầng)`.

### 4.2 `engine.py`/`schema.py`: câu hỏi đang treo (pending field)
- Thêm `Conversation.pending_field: str | None`. Sau khi bot trả lời ở giai đoạn thu thập, gán `pending_field = next_field`.
- Đầu lượt sau, sau khi bóc: nếu `pending_field` vẫn trống trong `prop.fields` → giữ nguyên `next_field = pending_field` (không lấy `missing[0]` khác) và chèn vào system prompt dòng: `Khách CHƯA trả lời câu "<nhãn>" (họ vừa nói: "<text>"). Xử lý ý họ bằng 1 câu thật ngắn rồi hỏi lại "<nhãn>" bằng LỜI KHÁC câu trước.`
- Phân loại nhanh bằng code trước khi gọi AI: xưng hô (regex `kêu|gọi|xưng ... (anh|chị|cô|chú|bác)`), hỏi ngược (có `?` hoặc mở đầu `phí|bao nhiêu|em là|bên em`), chỉ ừ/ok (dưới 2 chữ có nghĩa). Ba loại này không đóng pending.

### 4.3 Chặn bịa kích thước (deterministic guard)
Trong `_apply_operation`, trước khi nhận `kich_thuoc` mới:
- Chỉ nhận khi tin MỚI NHẤT của khách khớp `(ngang|dài|sâu|rộng|mặt tiền|\bmt\b|\d+\s*[x×]\s*\d+|\d+\s*m\b)`; ngược lại bỏ op đó (log `dropped_kich_thuoc`).
- Nếu tin khớp `\b(tấm|tầng|lầu)\b` mà không có `ngang|dài|x` → tuyệt đối không đụng `kich_thuoc`.
- Nếu `kich_thuoc` có dạng `A x B` và `dien_tich_dat` trống → code tự tính `dien_tich_dat = round(A*B, 1) m2`. Không nhờ AI tính.
- Áp dụng cùng logic cho `chieu_cao_tran`, `tai_trong_san` (nhóm kho xưởng): chỉ nhận khi `loai_hinh` thuộc nhóm INDUSTRIAL.

### 4.4 Bậc nguồn, không đè lời chủ nhà
- Thêm `Property.fields_meta: dict[str, {"source": "chu_xac_nhan"|"chu_noi"|"du_an"|"boc_anh"|"suy_dien", "confidence": float, "evidence": str, "at": float}]`.
- `Property.update(captured, source)`: giá trị nguồn thấp không đè nguồn cao; cùng bậc thì cái mới thắng. Bậc: `chu_xac_nhan` > `chu_noi` > `du_an` > `boc_anh` > `suy_dien`.
- Op từ chat = `chu_noi`; khách gật khi bot hỏi xác nhận = `chu_xac_nhan`; từ ảnh/OCR = `boc_anh`; từ bộ nhớ dự án = `du_an`.
- Lưu `fields_meta` vào `listings` (thêm cột `meta_json`) để sau này trả lời "ai nói".

### 4.5 Xưng hô bền
- Regex bắt xưng hô ở đầu lượt, lưu `Conversation.xung_ho` ("chị"/"anh"/"cô"/"chú"/"bác"), persist vào bảng `conversations`.
- Chèn vào mọi prompt: `Gọi khách là "<xung_ho>" — khách đã dặn, tuyệt đối không dùng "anh/chị".` Khi chưa biết: `"anh/chị"`.

### 4.6 Xác nhận quận khi địa chỉ thiếu
- Trong `build_chat_system`: nếu `dia_chi` có nhưng không chứa `quận|q\.|phường|p\.|huyện|thành phố|tp` → thêm dòng: `Địa chỉ mới có tên đường. Trong CÙNG câu khen, hỏi xác nhận quận/thành phố.` Không tạo trường mới.

### 4.7 Báo điểm cho khách (sếp đã chốt trong SRD)
- `_build_result` đã tính `property_score`, `user_score`, `tier` nhưng KHÔNG đưa vào prompt. Chèn 1 dòng vào system: `Điểm BĐS hiện tại: X/100, hạng Y. Còn thiếu để tăng điểm: <3 nhãn đầu của missing>.`
- Luật trong prompt: chỉ nhắc điểm khi vừa lên hạng, khi tin vừa đủ để dự thảo, hoặc khi khách hỏi; không nhắc mỗi tin; số điểm lấy đúng từ dòng trên, không tự bịa.

### 4.8 Lưu thành cột (để sau này web/M•ai tra được)
- Thêm bảng `listing_fields(listing_id, field, value, source, confidence, evidence, updated_at)` ghi song song với `fields_json`. Không đổi API đọc hiện có.

### 4.9 Test cần thêm (pytest, mock provider)
- `test_prompts.py`: `build_chat_system` chứa "TỐI ĐA 20 TỪ", không chứa "**"; `build_greeting` không chứa "**" và có "AI Ơi Nhà Đất - Buyers".
- `test_engine.py`:
  - pending: bot hỏi dien_tich_dat, khách nhắn "Kêu chị nha" → `next_field` vẫn là dien_tich_dat, `conv.xung_ho == "chị"`.
  - guard: fields có `kich_thuoc="ngang 5m"`, mock extractor trả op `kich_thuoc="5x20"` cho tin "5 tấm em" → sau lượt vẫn "ngang 5m", `ket_cau="5 tầng"`.
  - tính diện tích: tin "16m nha" khi pending là dài → `kich_thuoc="5x16m"`, `dien_tich_dat="80m2"`.
  - bậc nguồn: `update({"gia":"9 tỷ"}, source="boc_anh")` không đè `gia` đã có từ `chu_noi`.
  - bong bóng: mọi reply ở giai đoạn thu thập → `chunk_reply` trả đúng 1 phần tử.

### 4.10 Nghiệm thu (bắt buộc chạy Claude thật)
Script chạy 5 tin, in số từ + fields mỗi lượt (Phụ lục B). Chạy 3 lần, đạt khi:
- Mọi tin ≤ 20 từ, 1 bong bóng, không `**`, không `—`, ≤ 1 emoji.
- Sau tin 5: `kich_thuoc="5x16m"`, `dien_tich_dat="80m2"` (hoặc "80"), `ket_cau="5 tầng"`, xưng hô "chị", 3/3 lần.
- Không lần nào `kich_thuoc` chứa "20" hay "?".
- Câu hỏi danh tính: 1 câu tên + 1 câu quay lại việc, ≤ 20 từ.

### 4.11 AI bóc, code kiểm, code ghi (quy trình 5 lớp)
Nguyên tắc: AI không bao giờ ghi thẳng vào DB. AI đề xuất có bằng chứng, code kiểm rồi ghi kèm nguồn.

**Lớp 1 — AI bóc CÓ ngữ cảnh.** Sửa lời gọi `provider.extract` trong `_plan_and_apply` để đưa thêm 3 thứ vào system prompt bóc:
```
CÂU TRỢ LÝ VỪA HỎI: <nhãn pending_field>  (hoặc "không có")
DỮ LIỆU ĐÃ CÓ (kèm nguồn): kich_thuoc="ngang 5m" [chu_noi]; dia_chi="Trần Bình Trọng" [chu_noi]
TIN MỚI NHẤT CỦA KHÁCH: "16m nha"
```
Mở rộng `operations_schema()`: mỗi trường trong `fields` trả về object `{"value": str, "confidence": 0..1, "evidence": "<trích nguyên văn khách nói>"}`. Evidence bắt buộc là chuỗi có trong tin khách; không có evidence thì coi confidence = 0.

**Lớp 2 — code kiểm trước khi ghi** (hàm mới `validate_field(field, value, evidence, text, prop) -> value | None` trong `schema.py`):
- `kich_thuoc`: evidence phải khớp `(ngang|dài|sâu|rộng|mặt tiền|mt|\d+\s*[x×]\s*\d+|\d+\s*m\b)`. Không khớp → bỏ.
- `dien_tich_dat`, `dien_tich`, `dien_tich_nha`: parse số, 5 ≤ x ≤ 5000; nếu chuỗi có dạng `AxB` thì đó là kích thước, chuyển sang `kich_thuoc`, không ghi vào diện tích.
- `gia`: chuẩn hóa bằng code: `7t`/`7 tỏi`/`7 tỷ` → 7000000000; `800tr`/`800 củ` → 800000000; `5t5`/`5 tỷ rưỡi` → 5500000000. Bán: 100 triệu ≤ x ≤ 1000 tỷ; thuê: 1 triệu ≤ x ≤ 10 tỷ/tháng.
- `ket_cau`: `\d+\s*(tấm|tầng|lầu)` → số tầng 1..30; "1 trệt 2 lầu" = 3 tầng; "trệt lửng 2 lầu ST" ghi nguyên văn kèm số tầng.
- `chieu_cao_tran`, `tai_trong_san`, `tram_bien_ap`, `tieu_chuan_container`: chỉ khi `loai_hinh` nhóm INDUSTRIAL.
- Trường rớt kiểm → không ghi, thêm vào `conv.last_dropped` để test/log đọc được.

**Lớp 3 — code ghi kèm nguồn và độ tin.** `Property.update` nhận `(field, value, source, confidence, evidence)`, áp luật đè ở 4.4. Ghi cả `fields_json` và bảng `listing_fields` (4.8).

**Lớp 4 — tin thấp thì hỏi khách, không đoán.** Trường có `confidence < 0.7` không ghi chính thức mà ghi vào `conv.tentative[field] = value`, và lượt tới bot hỏi xác nhận bằng chính con số đó ("16m là chiều dài đúng không chị?"). Khách gật → ghi với nguồn `chu_xac_nhan`; khách sửa → ghi giá trị mới; khách lơ → giữ tentative, không hỏi lại quá 1 lần.

**Lớp 5 — người kiểm.** Không chạy AI kiểm theo lô. Sếp/anh tự duyệt bằng lệnh `/state` trong CLI hoặc đọc bảng `listing_fields` (có evidence và nguồn từng trường nên đọc là biết ai nói gì). Phụ lục B là bộ kiểm hồi quy tối thiểu, chạy lại mỗi lần đổi prompt hoặc luật kiểm.

### 4.12 Không dội tin, tin ngắn (luật giao tiếp cứng, code bảo đảm chứ không chỉ prompt)
- **Một lượt khách = một tin bot.** Ở giai đoạn thu thập, sau khi model trả lời: code cắt xuống dòng, lấy đoạn đầu; nếu vẫn quá 160 ký tự thì cắt ở dấu chấm gần nhất trước 160 và log `truncated`. `chunk_reply` chỉ được tách nhiều bong bóng ở giai đoạn dự thảo tin rao (khách xin xem bài đầy đủ).
- **Không gửi tin phụ.** Bỏ kiểu "tin 2: em ghi nhận anh là chính chủ, phí 1%" như bot Supabase đã làm. Vai người rao và phí chỉ nói khi khách hỏi, gộp vào đúng 1 tin.
- **Tin chủ động (khi build keep-alive):** tối đa 1 tin/ngày/người, giờ 8h–21h, gộp mọi việc cần hỏi vào 1 tin và chỉ hỏi 1 thứ; người rao nhiều căn thì mỗi ngày hỏi 1–2 căn; không gửi khi người thật đang chat với khách (dấu `human_touch` trong 30 phút); không gửi lại nếu tin trước chưa được trả lời; không dùng mã trường (`dien_tich_dat`) trong tin gửi khách, phải là chữ người đọc.
- **Nhắc lời hứa:** khách nói "tối gửi" thì bot cảm ơn, chờ; chỉ nhắc 1 lần sau hạn, không nhắc dồn.
- **Test:** thêm test giai đoạn thu thập luôn ra đúng 1 bong bóng ≤ 160 ký tự; test không có tin nào chứa chuỗi dạng `[a-z]+_[a-z]+` (mã trường).

---
## 5. Quyết định cần sếp chốt trước khi code
1. Tên trợ lý: kho tên theo phụ âm (T•ai, Kh•ai... gán theo Zalo ID, như repo) hay một tên "Thái" (như bot Supabase)? Có bỏ `K•ai` không (sếp từng nói K chỉ có Kh•ai)?
2. Trần 20 từ/tin có áp cho cả câu trả lời phí và danh tính không? (bản v2 đang áp cho tất cả trừ bài rao đầy đủ)
3. Có báo điểm/hạng trong chat không, và báo lúc nào?
4. Khi chưa biết giới tính: gọi "anh/chị" (máy móc) hay tạm "anh" rồi đổi khi khách dặn?
5. Ngưỡng độ tin để hỏi xác nhận (đề xuất 0.7).

---
## 6. Bàn giao file
- `prompts_v2_ngan_gon.py`: bản prompts.py mới hoàn chỉnh, chép đè `src/aioi/prompts.py` sau khi gỡ khóa.
- `so_sanh_truoc_sau.md`: bảng trước/sau cho sếp.
- `prompts.py.bak`: bản gốc.

---
## 7. THAM KHẢO: lỗi bên bot Supabase (không thuộc repo, chỉ để đối chiếu)
- Dội tin "cần bổ sung: dien_tich_dat": trigger `trg_notify_info_request_escalation` trên `info_requests` tạo `reminders(kind=escalation)` gửi cho CHÍNH chủ nhà mỗi lần bot đặt câu hỏi (nguồn `seller_flow`), in thẳng mã trường; không hủy khi đã trả lời; cron `nudge` gom gửi 1 lượt. Sửa: trigger bỏ qua `source='seller_flow'`, hủy reminder khi `status→answered`, đổi mã trường thành chữ.
- Dữ liệu sai: trigger `listing_facts_sync_cols` đọc số bằng regex số đầu tiên → "6x11" thành area 6; "7t" thành floors 7, giá trống. Sửa: parse `AxB` → frontage/length/area; "7t" → 7 tỷ (dùng đúng bộ chuẩn hóa ở 4.11 lớp 2).
- View `listing_missing_facts` không lọc nhóm `phu` (hướng, quy hoạch, năm xây) dù `seller_script_rules` cấm hỏi. Thêm `where nhom <> 'phu'`.
- Câu hỏi treo cũ của căn test BDS-Q5-0174 còn 4 dòng pending; xóa trước khi test lại.
- Bot gửi 2 tin một lượt (tin phụ báo nhãn chính chủ + phí) — vi phạm 4.12.
- Hướng dài hạn: thay bộ phân loại regex `phanLoaiCauTraLoi` bằng một lần gọi model tool-use như 4.11 lớp 1, code vẫn giữ quyền ghi cột và đóng câu hỏi treo.

---
## PHỤ LỤC A — ba khối prompt mới (nguyên văn, đã test)

### A1. Khối giọng trong `build_chat_system` (thay cho đoạn từ "ĐỘ DÀI (tự cân nhắc..." đến "...gọi khách "anh/chị"")
```
GIỌNG (viết như người môi giới thật đang nhắn Zalo):
- Xưng "em", gọi khách "anh/chị". Khách dặn gọi gì (chị, cô, chú, bác...) thì từ đó gọi đúng vậy, không đổi lại.
- Khen điểm mạnh THẬT và gắn với khách mua ("hẻm xe hơi là khách chuộng", "sổ riêng thì chốt cọc nhanh"). Không khen suông kiểu "tuyệt vời", "đẹp quá" liên tục, không lặp cùng lời khen hai tin liền.
- Từ lóng hiểu ngầm, đừng hỏi lại nghĩa: "tấm" = tầng, "tỏi" = tỷ, "củ" = triệu, "HXH" = hẻm xe hơi, "MT" = mặt tiền, "sổ" = sổ hồng/sổ đỏ, "SHR" = sổ hồng riêng, "nở hậu", "trệt lửng 2 lầu".

ĐỘ DÀI (luật cứng, áp dụng MỌI tin kể cả khi khách hỏi phí, hỏi em là ai):
- Mỗi tin TỐI ĐA 20 TỪ, một đoạn duy nhất, không xuống dòng. Thà bớt lời khen còn hơn dài. Cấu trúc: [1 câu ghi nhận/khen ngắn] + [1 câu hỏi]. Ví dụ đúng: "Ngang 5 là đẹp rồi anh. Dài bao nhiêu mét ạ?" / "Hẻm xe hơi khách chuộng lắm. Nhà mấy lầu, chị?"
- Chỉ khi khách yêu cầu xem/đăng toàn bộ tin ("nêu đầy đủ", "xem lại tin", "đăng giúp em") mới soạn BÀI RAO ĐẦY ĐỦ, dài bao nhiêu cũng được, viết trọn vẹn, không bỏ lửng.

CẤM (dấu hiệu máy):
- Không markdown: không **in đậm**, không gạch đầu dòng, không đánh số. Không gạch dài "—". Tối đa 1 emoji, thường là không.
- Không "Hệ thống ghi nhận", "Quý khách", "Vui lòng", "Tuyệt vời!", "Chắc chắn rồi!". Không đọc tên trường kiểu máy ("kết cấu (số tầng, phòng)").
- Không hỏi 2 thứ trong một tin. Không hỏi lại điều khách đã nói hoặc đã có trong DỮ LIỆU ĐÃ GHI.

CÁCH HỎI:
- Hỏi ĐÚNG thông tin hệ thống chỉ định ở dòng cuối prompt. Chỉ được nối sang chi tiết vừa nghe khi cùng chủ đề: khách nói "ngang 5" mà đang hỏi diện tích → hỏi dài trước; "hẻm 4m" → ô tô tới cửa không.
- Khách chưa trả lời câu vừa hỏi: hỏi lại bằng LỜI KHÁC, không lặp nguyên văn.
- Địa chỉ chỉ có tên đường: khen vị trí và xác nhận quận/thành phố trong cùng một câu ("Trần Bình Trọng, Quận 5 phải không anh?").
- Diện tích mơ hồ (một con số): hỏi lại dựa trên chính con số đó ("70m2 là sổ hay sàn ạ?").
- Khách hỏi ngược, chỉ ừ/ok, hay dặn xưng hô: xử lý ý đó bằng một câu thật ngắn, rồi hỏi lại đúng thông tin đang thiếu bằng lời khác. Chưa coi là đã trả lời.
- Khách hỏi "em là ai / tên gì / người thật không": "Dạ em là {assistant_name} bên AI Ơi Nhà Đất ạ" một câu, rồi quay lại việc. Không thuyết minh về AI.

TRUNG THỰC:
- Chỉ dùng (a) thông tin khách cung cấp, và (b) KIẾN THỨC CHUNG DỰ ÁN em đã có sẵn (mục "BỘ NHỚ DỰ ÁN" / "MẪU NHÀ" bên dưới — dữ liệu đã xác minh). Không bịa ngoài hai nguồn đó, không suy diễn vật liệu/hiện trạng từ ảnh. Đoán thì "hình như là" rồi hỏi lại.
- Kiến thức dự án (mẫu nhà, phân lô, tiện ích, chủ đầu tư...) là thứ em ĐÃ CÓ và dùng thoải mái để trả lời ngay, không nói "em không tra được".
```
(Trong f-string của Python, `{assistant_name}` là biến; giữ nguyên.)

### A2. `build_greeting`
```python
    return (
        f"Dạ em là {assistant_name} bên AI Ơi Nhà Đất ạ. Anh/chị có nhà đất cần bán hay cho thuê "
        "cứ nhắn em, không cần điền form. Tìm mua hoặc thuê thì qua kênh AI Ơi Nhà Đất - Buyers nha."
    )
```

### A3. Thêm vào `EXTRACTION_SYSTEM` ngay sau dòng "Tập trung vào BĐS đang nói ở các tin nhắn MỚI NHẤT."
```
QUAN TRỌNG — câu trả lời CỤT (chỉ một con số, vd "16m", "5", "8 tỷ"): hiểu nó là câu trả lời cho
CÂU TRỢ LÝ VỪA HỎI ngay trước đó. Đang hỏi chiều dài mà khách nói "16m" thì đó là chiều dài, KHÔNG
phải chiều cao trần hay lộ giới. Không có câu hỏi đứng trước thì bỏ qua con số, đừng đoán.
QUAN TRỌNG — tiếng lóng: "tấm" = tầng ("5 tấm" = 5 tầng, KHÔNG phải mét); "tỏi" = tỷ; "củ" = triệu;
"HXH" = hẻm xe hơi; "MT" = mặt tiền; "SHR" = sổ hồng riêng; "trệt lửng 2 lầu" = kết cấu.
QUAN TRỌNG — kich_thuoc: CHỈ trả về kich_thuoc khi tin mới có số đo ngang/dài/mặt tiền. Tin nói về
số tầng ("5 tấm", "3 lầu") hay số phòng thì KHÔNG trả về kich_thuoc, để nguyên giá trị cũ.
Ghi ĐÚNG số khách nói: "ngang 5" → "ngang 5m"; đã có ngang 5, khách nói thêm "16m" khi đang được hỏi
dài → kich_thuoc = "5x16m". Không tự điền chiều dài chưa được nói (không tự ghi "5x20").
dien_tich_dat / dien_tich / dien_tich_nha CHỈ ghi SỐ m2 (vd "80m2"), KHÔNG BAO GIỜ ghi "ngang 5",
"5x16", "5 tấm" vào các trường diện tích. Ngay khi kich_thuoc có dạng ngang x dài, BẮT BUỘC trả thêm
dien_tich_dat = ngang × dài, trừ khi khách đã nói diện tích sổ khác.
VÍ DỤ BÓC ĐÚNG (tin mới nhất của khách → JSON):
- "Ngang 5" → {"kich_thuoc": "ngang 5m"}
- "5 tấm em" → {"ket_cau": "5 tầng"}  (KHÔNG có kich_thuoc, KHÔNG có diện tích)
- "16m nha" khi đã có ngang 5 và trợ lý vừa hỏi dài → {"kich_thuoc": "5x16m", "dien_tich_dat": "80m2"}
- "Kêu chị nha" → {}  (không phải dữ liệu BĐS)
- "sổ 70m2" → {"dien_tich_dat": "70m2"}
- "4x15, 3 lầu, 8 tỏi" → {"kich_thuoc": "4x15m", "dien_tich_dat": "60m2", "ket_cau": "3 lầu", "gia": "8 tỷ"}
```
Khi làm 4.11 lớp 1, thêm vào cuối khối này 3 dòng ngữ cảnh (câu vừa hỏi, dữ liệu đã có, tin mới nhất) do code điền lúc chạy.

---
## PHỤ LỤC B — script nghiệm thu (chạy trong thư mục repo, Claude thật)
```python
# run_check.py — python run_check.py ; cần .env có key; dùng DB tạm _check.db, không đụng aioi.db
import sys, os, json
sys.stdout.reconfigure(encoding="utf-8"); sys.path.insert(0, "src")
for _l in open(".env", encoding="utf-8"):
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, v = _l.split("=", 1); v = v.strip().strip('"').strip("'")
        if v: os.environ.setdefault(k.strip(), v)
os.environ["AIOI_LLM_PROVIDER"] = "claude"; os.environ["AIOI_DB_PATH"] = "_check.db"
from aioi.config import load_settings
from aioi.delivery import chunk_reply
from aioi.engine import Engine, SqliteConversationStore
from aioi.llm import build_provider
from aioi.projects import SqliteProjectStore
s = load_settings()
eng = Engine(build_provider(s), project_store=SqliteProjectStore(s.db_path),
             conversation_store=SqliteConversationStore(s.db_path))
print("provider:", s.effective_provider, "| model:", s.chat_model)
MSGS = ["Bán nhà bán nhà ở Trần Bình Trọng em", "Ngang 5", "5 tấm em", "Kêu chị nha", "16m nha"]
for rep in (1, 2, 3):
    u = f"check{rep}"; print(f"\n=== lần {rep} [{eng.conversation(u).assistant.name}] ===")
    for m in MSGS:
        r = eng.handle(u, m); txt = r.reply.replace("\n", " / ")
        flags = [f for f, bad in (("MARKDOWN", "**" in r.reply), ("GẠCH DÀI", "—" in r.reply),
                                  ("DÀI>20", len(r.reply.split()) > 20),
                                  ("NHIỀU BONG BÓNG", len(chunk_reply(r.reply)) > 1)) if bad]
        print(f"KHÁCH> {m}\n  BOT ({len(r.reply.split())} từ) {flags}> {txt}\n"
              f"  fields={json.dumps(eng.conversation(u).prop.fields, ensure_ascii=False)} | next={r.next_field}")
```
Kỳ vọng mỗi lần: không flag nào; sau tin 5 fields có `kich_thuoc=5x16m`, `dien_tich_dat=80m2`, `ket_cau=5 tầng`.
