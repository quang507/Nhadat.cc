# 10 — Kế hoạch kiểm thử

Nền có sẵn: 13 kịch bản nghiệm thu AC-01…13 (`docs/07 §7`) và bảng kiểm chứng NFR
(`docs/07 §6`). File này là kế hoạch 4 tầng (§10.1–10.6), bộ test chạy tay đang
sống kèm kết quả mới nhất (§10.7) và nghiệm thu theo tài liệu 04/09/2026 (§10.8).
Nguyên tắc: công cụ **free-tier trước** (NFR-16); mọi test case truy về FR/AC/NFR.

## 10.1 Kiểm thử chức năng

Suite theo nhóm FR. Dữ liệu mẫu: 24 kịch bản chat trong `chats w B.docx` (đã ẩn
danh) — không bịa thêm. Mỗi AC ≥ 1 test E2E; NLU (FR-09/22/23/92) kiểm bằng bảng
quyết định câu vào → trường ra, bắt buộc chạy lại trước khi đổi model/prompt.

| Suite | Phạm vi | Trọng tâm | Ca chạy được (§10.7) |
|---|---|---|---|
| TS-WEB | FR-01…17 | search parse đúng taxonomy §4.6 · trang tag không 404 · deep-link Zalo mang ngữ cảnh (AC-01) | TS-WEB2, TS-SEO, TS-CACHE |
| TS-BOT | FR-20…32 | 4 bất biến I1–I4 (SRS-5.1) chặn release: ≤3 listing/tin · kết thúc bằng câu hỏi · không khẳng định điều chưa xác minh · không hỏi SĐT sai chỗ | TS-CHATREPLY, TS-E2E, TS-V48, TS-VAI |
| TS-ASK | FR-40…47, FR-110 | hỏi kho trước, hỏi S sau · idempotency · timeout 24h/48h · AC-03 | TS-HOICHU, TS-CTV, TS-IDEM, TS-IDEM2 |
| TS-VIEW | FR-50…57 | từ chối cho SĐT vẫn đặt được lịch (AC-04) · email [VIEWING] | TS-MATCH-06, TS-GIUCHAN-01 |
| TS-RET | FR-60…65 | mốc 5 ngày / ≥6 ngày giữ kết nối · nội dung xoay vòng không lặp (AC-06) | TS-GIUCHAN, TS-V48 |
| TS-ADM | FR-70…81 | 20 mục/trang · 4 loại email đúng subject/body (AC-09/10) | TS-ADM2, TS-DANGTIN |
| TS-SEL | FR-90…103, FR-109 | bóc ≥4 trường (AC-07) · rao từng bước trong Zalo · không spam S | TS-MA, TS-KD, TS-NEO, TS-OUNG, TS-THONGSO |
| TS-BROKER | FR-104…112 | ẩn danh hai chiều (lọc SĐT/Zalo/địa chỉ trong relay) · vòng đời listing · sold → báo interests | TS-SEC-10, TS-V48, TS-GIUCHAN |
| TS-PROJECT | FR-113…117 | AC-13: căn theo unit_status · câu tầng dự án không sinh info_request · unique (project_id, unit_code) | TS-V48 |

## 10.2 Kiểm thử kỹ thuật

| Mục | Kiểm gì | Tham chiếu | Ca chạy được |
|---|---|---|---|
| API contract | schema SRS-4.x; request_id trùng → trả kết quả cũ, không nhân đôi; mã 404/409 | FR-41/43 | TS-WEB2 (S), TS-IDEM |
| Database | RLS: anon chỉ đọc tin lên kệ + media công khai của tin đó; unique/enum/CHECK; trigger toàn vẹn | SRS-3.9, FR-113/116/163/167 | TS-SEC, TS-SEC2, TS-TOANVEN |
| Webhook Zalo | 200 < 1s; bất đồng bộ; chữ ký sai → từ chối (chưa hiệu lực: thiếu ZALO_APP_SECRET, OPEN-33); retry không tin đôi | SRS-4.4 | TS-IDEM2 |
| Hàng đợi | worker sập / hết lượt thử → 0 tin mất (dựng cảnh sập bằng tay, không giết được instance Edge Function) | NFR-04, FR-166 | TS-JOB |
| Kho file | signed URL ≤15 phút; bucket riêng không đọc thẳng; adapter đổi backend không đụng bot | NFR-06, FR-111/165 | TS-KHO, TS-WEB2 (P) |
| Migration | chạy được trên project trống + có dữ liệu; không phá dữ liệu cũ | — | TS-SEC sau mỗi migration |
| Còi báo lỗi | lỗi HTTP lẫn lỗi trả 200 đều vào sổ | FR-152, FR-168 | TS-HEALTH, TS-LOG, TS-CHUONG |

## 10.3 Kiểm thử giao diện & trải nghiệm

| Bài | Kiểm gì | Công cụ |
|---|---|---|
| Đối chiếu thiết kế | từng màn so với `06` (canvas/Figma và `design/tokens.json` đã xoá 08/09/2026); token thật là `app/globals.css` — sai token là lỗi, không phải "gần đúng" | soi tay |
| Responsive | 375/768/1440px; bảng rộng cuộn trong container, body không cuộn ngang; sticky CTA Zalo mobile | Playwright |
| Tone giọng chat | 7 quy tắc + mục Cấm (`docs/06 §6.8`) trên 50 hội thoại: đếm câu hỏi/lượt, tin kết thúc "?", từ cấm | script đếm trên log |
| Accessibility | tương phản ≥4.5:1, vùng chạm ≥44px, focus ring, alt ảnh | axe-core + duyệt tay (persona P3) |
| Trạng thái | ma trận loading/rỗng/lỗi cuối `docs/05`, mỗi ô một test; "0 kết quả" nói rõ đã nới gì | Playwright |
| Hiệu năng cảm nhận | Lighthouse mobile ≥ 90, LCP < 2,5s/4G (NFR-02) | Lighthouse CI |

## 10.4 Kiểm thử phi chức năng

Bảng NFR-01…18 với cách đo nằm ở `docs/07 §6` (nguồn sự thật). Bài chuyên sâu:

| Bài | Nội dung | Công cụ |
|---|---|---|
| Tải | 50 tin đồng thời p95 < 3s (NFR-01); seed 5.000 listing + 300 hội thoại không suy giảm (NFR-05) | k6/script |
| Bảo mật | pen-test 3 hướng: prompt-injection dụ bot lộ SĐT (FR-104); đoán URL `/ds/token` + signed URL; RLS bypass qua PostgREST | tay + TS-SEC2 |
| Riêng tư | 100 hội thoại: 0 lần hỏi SĐT ngoài viewing (NFR-07); dữ liệu B không rời hệ thống | rà log |
| SEO | 100 URL tag index, 0 lỗi structured data (NFR-09) | Search Console |
| Chi phí | mỗi tuần đối chiếu usage Supabase/Vercel/AI với ngưỡng free (NFR-16); vượt dự báo là finding | dashboard + `/admin` |

## 10.5 Môi trường & công cụ (free-tier)

- Unit: Vitest · E2E web: Playwright · A11y: axe-core · Perf: Lighthouse CI · bot: `bot/tests/e2e` (mock Supabase + mock model, Node/Bun).
- CI: GitHub Actions free, `.github/workflows/kiem.yml` — mỗi PR chạy 5 job: `web` (tsc + `next build`), `bot` (304 ca e2e = 256 chat-reply + 44 webhook + 4 cổng; 82 ca FR-159/161/164; 199 ca FR-177 tiền định; 4 cảnh tự kiểm TS-SEC — mock Supabase & mock model nên không cần secret), `rohang` (TS-ROHANG 18 ca + TS-MASTERDB 24 ca, máy chủ giả), `baomat` (`TS-SEC-AUTO` bắn anon key công khai vào DB thật), `truyvet` (`scripts/soat-truy-vet.sh`). Vercel preview mỗi PR. **Chưa vào CI:** TS-SEC bài phá huỷ (xoá dữ liệu thật nếu RLS hỏng), TS-SEC3 (`bot/tests/vai-tro.sql` — cần quyền SQL, CI chỉ có khoá công khai), TS-LIVE (cần bridge + hai máy), Lighthouse/axe/k6 — xem `docs/11 §11.4`.
- DB: `nhadat-cc` là môi trường chính, **không** chạy test phá hoại; ca ghi bọc `do … raise exception` để cuộn lại. Zalo: OA thật chế độ ẩn + acc test (OPEN-09).
- Bí mật chỉ trong biến môi trường / Vault; khoá đã dán vào chat phải rotate.

## 10.6 Lịch chạy theo giai đoạn phát hành (SRS §8)

| Phase | Suite bắt buộc xanh để thoát phase |
|---|---|
| P0 Nền | TS-SEL, Migration, Database, Bí mật |
| P1 Nguồn hàng | TS-WEB, UI/UX, SEO, Lighthouse |
| P2 Chat | TS-BOT (I1–I4 chặn), TS-ASK, TS-PROJECT, Webhook, Tone giọng |
| P3 Giao dịch | TS-VIEW, TS-ADM, TS-BROKER, pen-test ẩn danh |
| P4 Giữ chân | TS-RET, Tải, Riêng tư, Chi phí |

Bug tìm thấy sau release phải có test tái hiện trước khi sửa — suite chỉ phình, không teo.

## 10.7 Bộ test chạy tay (cập nhật 06/09/2026)

Lệnh dán vào chạy được, không phải mô tả. ID bất biến. Cột cuối là kết quả **mới
nhất** (dd/mm); ⏭ = chưa chạy lại được trong sandbox (cần deploy/bridge/trình
duyệt). Ca ghi trên DB thật bọc `do … raise exception` hoặc `begin … rollback`;
bí mật lấy bằng `get_secret()` ngay trong SQL, không in ra.

### 10.7.0 Sổ đăng ký bộ test — chạy bằng lệnh nào, cần môi trường gì

Bảng này là danh sách ĐỦ. Một bộ test không có tên ở đây là một bộ không ai
chạy. Đừng gõ lệnh rời: người và CI dùng chung script trong `package.json`, không
thì "máy xanh, máy tao đỏ" và không ai biết bên nào đúng.

**Mười bốn bộ CHẠY MÁY, offline (522 ca) — `bun run kiem` gọi hết, CI chạy hết:**

| Bộ | Ca | Trong lệnh | Nhóm ca / ID | Kiểm cái gì |
|---|---|---|---|---|
| `bot/tests/e2e/run.mjs` | 256 | `bun run e2e` (`chay.sh`) | TS-E2E, TS-TOIUU; nhãn `CỔNG-1…5`, `SEC-*`, `ĐUA-1…4`, `TRÙNG-1…10`, `N1…N34` (09–10/09) | Luồng `chat-reply` thật; cổng vào; tranh chấp ghi đồng thời; chống trùng lượt vào |
| `bot/tests/e2e/webhook.mjs` | 44 | `bun run e2e` (`chay.sh`) | TS-IDEM2; nhãn `CK-1…8c`, `GUI-1…8` | `zalo-webhook`: chữ ký + replay; gửi đúng-một-lần ra Zalo |
| `bot/tests/e2e/cong-thieu-bi-mat.mjs` | 4 | `bun run e2e` (`chay.sh`) | TS-SEC2 phần cổng | Thiếu `BRIDGE_SECRET` thì cổng ĐÓNG, không mở. Tiến trình RIÊNG vì `napCauHinh` nhớ tạm 60 s ở tầng module |
| `bot/tests/fr159-bon-vai.mjs` | 65 | `bun run test:bot` | TS-VAI | Bốn vai người nhắn (FR-159, FR-170) |
| `bot/tests/fr161-go-lan-dau.mjs` | 9 | `bun run test:bot` | TS-KD | Gõ lẫn dấu vẫn nhận ra câu rao / câu hỏi mua (FR-161) |
| `bot/tests/fr164-loi-sua-va-cau-hoi-treo.mjs` | 8 | `bun run test:bot` | TS-OUNG | Vừa sửa trường vừa trả lời câu treo thì ghi CẢ HAI (FR-164) |
| `bot/tests/ts-sec-anon.tu-kiem.mjs` | 4 cảnh | `bun run test:bot` | TS-SEC-AUTO (bài tự kiểm) | Bộ TS-SEC phân biệt "DB từ chối" với "không tới được" — chống tái phạm ca báo 24/24 xanh trong lúc proxy chặn sạch |
| `bot/tests/fr176-khop-cau-tra-loi.mjs` | 49 | `bun run test:bot` | **TS-KYGUI** phần khớp câu | Câu chủ nhà nhắn CÓ PHẢI câu trả lời không (FR-176) — chạy bằng `bun` vì import thẳng `.ts` |
| `bot/tests/fr177-hoi-nhu-moi-gioi-gioi.mjs` | 199 | `bun run test:bot` | **TS-KYGUI** phần nhận fact / chọn câu kế / gật / đủ rồi / gấp | `nhanDienFact`, `chonCauKe`, `laDongY`, `laDuRoi`, `laGap` (FR-177/178) — tiền định, không tốn model |
| `bot/tests/tin-nhac.mjs` | 22 | `bun run test:bot` | **TS-NHAC** | Chữ gửi ra Zalo cho việc trong hàng đợi `reminders`: không lặp tên, không thừa dấu chấm, không bảo admin trả lời khách với tin hệ thống |
| `scripts/xuat-ro-hang.tu-kiem.mjs` | 18 | `bun run test:rohang` | TS-ROHANG | Bản xuất rổ hàng người đọc được: không ghi vào repo, không nuốt dòng thiếu, không nhận nhầm là bản sao lưu |
| `bot/tests/ranh-gioi.mjs` | 9 | `bun run test:bot` (và `test:ranhgioi`) | **TS-RANHGIOI** | Ranh giới bóc tách ⟂ AI, kiểm TĨNH: mã tiền định không import SDK Anthropic / `claude.ts` / gọi RPC; tầng AI không ghi bảng nghiệp vụ, chỉ 3 RPC đã khai tên |
| `scripts/up-masterdb.tu-kiem.mjs` | 24 | `bun run test:masterdb` | **TS-MASTERDB** | Đẩy bản gốc masterDB lên bucket `masterdb-raw`: KHÔNG nén, chạy lại bỏ qua file đã có, và **bắt được lúc bucket trả 200 mà không cất** (đối chiếu đếm đĩa ↔ đếm bucket) |

Ba file `fr1xx-*.mjs` **chép regex** từ `chat-reply` (Node không nạp được module
Deno) — sửa regex ở hàm thật thì phải sửa cả ở đó, không thì test vẫn xanh trong
khi hàm đã đổi.

**Hai bộ CẦN MÔI TRƯỜNG THẬT — không chạy được trong sandbox:**

| Bộ | ID | Cần gì | Chạy sao | Đọc kết quả |
|---|---|---|---|---|
| `bot/tests/ts-sec-anon.mjs` | TS-SEC-AUTO | **Internet tới `*.supabase.co`** + DB production đang chạy. KHÔNG cần secret: bắn bằng khoá publishable công khai | `bun run test:sec` — có trong CI (job `baomat`), **cố ý không nằm trong `kiem`** | Thoát 0 = đạt · 1 = có cửa mở · **2 = CHƯA KIỂM ĐƯỢC** (proxy chặn, DB ngủ). Thoát 2 KHÔNG phải "đạt" |
| `bot/tests/vai-tro.sql` | **TS-SEC3** | **Quyền SQL trên DB thật.** CI không chạy được vì CI chỉ có khoá công khai | Dashboard → SQL Editor → dán cả file → Run; hoặc MCP `execute_sql` | Kết bằng `raise exception 'KQ: …'` nên mọi dòng chèn TỰ CUỘN LẠI, không để rác trên production. Mọi mục phải `OK`; một chữ `HONG` là một cửa mở. **Chạy 06/09/2026 qua MCP `execute_sql`: 41/41 OK**, xác minh rollback bằng đếm dòng `VAITRO*` = 0 |
| người thật, ba điện thoại | **TS-NGUOI** | Bridge `bridge-zca` sống, 8h–20h VN, `test_reset_hello='1'` trong buổi, ba Zalo (A chủ nhà, B khách, C admin/CTV) | Theo bảng TS-NGUOI-01…20 ở dưới; ghi lỗi 5 dòng vào nhóm | Cột "Kết quả" của TS-NGUOI; DB do BA đối chiếu theo giờ |

### TS-SEC3 — ma trận quyền theo VAI DB (5 vai × 41 khẳng định)
`ts-sec-anon.mjs` chỉ bắn được vai `anon` vì nó đi qua PostgREST bằng khoá công
khai. Bốn vai còn lại — `authenticated` người lạ, người dùng có hồ sơ, admin,
`service_role` — là nửa quan trọng hơn: RLS của repo này phân quyền chủ yếu bằng
`auth.uid()` và `auth.jwt()->>'email'`, tức toàn bộ luật nằm ở vai
`authenticated`. Trong 41 khẳng định có **8 đối chứng dương** (nhãn `[dc]`):
"vai X thấy 0 dòng" chỉ có nghĩa khi có vai Y thấy được đúng dữ liệu đó — không
thì "0 dòng" có thể chỉ là "bảng rỗng".
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-SEC3-01 | `anon` đọc 9 bảng kín (`buyers`, `sellers`, `messages`, `conversations`, `inbound_ledger`, `inbound_events`, `media_cleanup_queue`, `admins`, `chat_quota`) | 0 dòng hoặc thiếu grant | ✅ 06/09 (chạy lại qua MCP: 41/41 OK, 0 HONG; xác minh sau đó 0 dòng VAITRO còn lại) |
| TS-SEC3-02 | `anon` đọc tin CHƯA đăng; ghi `listings`; gọi `bump_user_quota` / `giu_luot_gui` / `xuat_schema` | chặn cả 5 | ✅ 06/09 (chạy lại qua MCP: 41/41 OK, 0 HONG; xác minh sau đó 0 dòng VAITRO còn lại) |
| TS-SEC3-03 | người lạ ĐÃ ĐĂNG NHẬP đọc 9 bảng kín | 0 dòng hoặc thiếu grant | ✅ 06/09 (chạy lại qua MCP: 41/41 OK, 0 HONG; xác minh sau đó 0 dòng VAITRO còn lại) |
| TS-SEC3-04 | người lạ đọc 5 view cấp cho `authenticated` (`khach_can_nguoi_that`, `hoi_thoai_phien`, `bds_hot`, `ctv_ranks`, `nmg_hoat_dong`) | 0 dòng — chủ sở hữu view là `postgres` (BYPASSRLS) nên hàng rào DUY NHẤT là mệnh đề WHERE bên trong view, phải kiểm từng cái chứ không suy ra từ RLS | ✅ 06/09 (chạy lại qua MCP: 41/41 OK, 0 HONG; xác minh sau đó 0 dòng VAITRO còn lại) |
| TS-SEC3-05 | người lạ đọc tin chưa đăng; gọi `admin_dang_tin` / `tao_danh_sach` | chặn cả 3 | ✅ 06/09 (chạy lại qua MCP: 41/41 OK, 0 HONG; xác minh sau đó 0 dòng VAITRO còn lại) |
| TS-SEC3-06 | **[dc]** admin đọc `buyers`, `messages`, view `khach_can_nguoi_that`, tin chưa đăng | THẤY được — chứng minh mọi số 0 ở trên là "RLS chặn", không phải "bảng rỗng" | ✅ 06/09 (chạy lại qua MCP: 41/41 OK, 0 HONG; xác minh sau đó 0 dòng VAITRO còn lại) |
| TS-SEC3-07 | admin đọc `inbound_ledger` | KHÔNG thấy (sổ nội bộ của bot, admin không có việc gì ở đó) | ✅ 06/09 (chạy lại qua MCP: 41/41 OK, 0 HONG; xác minh sau đó 0 dòng VAITRO còn lại) |
| TS-SEC3-08 | **[dc]** `service_role` đọc `inbound_ledger`, `messages`, gọi `giu_luot_gui` | làm được — bot phải chạy được việc của nó | ✅ 06/09 (chạy lại qua MCP: 41/41 OK, 0 HONG; xác minh sau đó 0 dòng VAITRO còn lại) |

### TS-SAOLUU — [deprecated 11/09/2026]
TS-SAOLUU-01…08 bỏ cùng sao lưu (OPEN-25): chủ dự án gỡ `sao-luu.mjs`, bài tự
kiểm `sao-luu.tu-kiem.mjs`, CI job `saoluu` và phép soát #8 trong
`soat-truy-vet.sh`. TS-PHUCHOI (diễn tập phục hồi, CI job `phuchoi`) bỏ cùng
lúc. ID giữ nguyên, không cấp lại. Không còn bài nào kiểm sao lưu, vì không còn
sao lưu — Supabase gói Free không tự sao lưu, mất dữ liệu là không lấy lại được.

### TS-RANHGIOI — bóc tách ⟂ AI (SRS-3.0, FR-171)
Hôm nay ranh giới này đúng nhưng đúng do MAY: `boc_thong_so()` nằm trong SQL nên
không thể gọi model được, còn `regexProfileFallback()` thì nằm ngay trong
`chat-reply/index.ts` cách chỗ gọi model hơn hai nghìn dòng — không có gì ngăn
lượt sửa sau nối hai thứ lại. Nối vào là mỗi tin khách một lượt đốt tiền model,
kể cả câu regex bóc được. `bot/tests/ranh-gioi.mjs` là kiểm TĨNH (đọc chữ, không
mạng, không DB), nằm trong `test:bot` nên chạy ở CI mỗi PR mà **không thêm tên
check mới** — danh sách 5 required status checks ở `docs/11 §11.5` giữ nguyên.
Mỗi luật có ca ÂM lẫn ca DƯƠNG: luật hỏng thì ca âm lọt và bài thoát khác 0, chứ
"0 vi phạm" một mình chỉ chứng minh regex sai. Chứng minh bắt được vi phạm THẬT:
chèn `import Anthropic` vào `_shared/thong_so.ts` → thoát 1, gỡ ra → thoát 0.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-RANHGIOI-01 | mã bóc tách import `@anthropic-ai/sdk` | bắt | ✅ 06/09 |
| TS-RANHGIOI-02 | mã bóc tách import `./claude.ts` | bắt | ✅ 06/09 |
| TS-RANHGIOI-03 | mã bóc tách gọi `.rpc(` | bắt — bóc tách phải là hàm thuần | ✅ 06/09 |
| TS-RANHGIOI-04 | mã bóc tách là hàm thuần | bỏ qua | ✅ 06/09 |
| TS-RANHGIOI-05 | chữ "anthropic" nằm trong CHÚ THÍCH | bỏ qua — chú thích không phải mã | ✅ 06/09 |
| TS-RANHGIOI-06 | tầng AI `.from("listings").insert(` | bắt | ✅ 06/09 |
| TS-RANHGIOI-07 | tầng AI gọi RPC chưa khai tên | bắt — thêm RPC phải sửa file luật, tức phải có người đọc lại | ✅ 06/09 |
| TS-RANHGIOI-08 | tầng AI gọi `log_loi` | bỏ qua — sổ lỗi là bắt buộc (FR-152), không phải dữ liệu nghiệp vụ | ✅ 06/09 |
| TS-RANHGIOI-09 | file ngoài phạm vi hai luật | bỏ qua | ✅ 06/09 |
| TS-RANHGIOI-10 | *(chốt lúc chạy, không phải ca giả)* KHÔNG file thật nào rơi vào luật nào | DỪNG, thoát khác 0 — đổi tên thư mục một cái là bộ này soát rỗng mà vẫn báo xanh | ✅ 06/09 (3 file thật) |

### TS-MASTERDB — đẩy bản gốc lên bucket (OPEN-47, NFR-16)
`scripts/up-masterdb.mjs` đưa `masterDB/` lên bucket `masterdb-raw` (`20260907b`) để cái ổ
đĩa cá nhân thôi làm mắt xích duy nhất. Thứ phải chứng minh KHÔNG phải "đẩy được" — mà là
**"biết khi nào mình đẩy hụt"**: Storage trả `200` cho một lượt PUT rồi không cất file thì
vòng lặp vẫn chạy hết và vẫn báo xong, y hệt hình lỗi `net.http_post` của NFR-18. Bài này
dựng **Storage giả** trong bộ nhớ (không chạm bucket thật, không cần khoá, chạy offline nên
vào được `kiem` và CI).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-MASTERDB-01 | đường suôn 4 file | thoát 0, đủ file, cấu trúc thư mục giữ nguyên | ✅ 07/09 |
| TS-MASTERDB-02 | **KHÔNG nén** — byte trên bucket = byte dưới đĩa | khớp từng byte; đây là bản GỐC, nén là hỏng mục đích | ✅ 07/09 |
| TS-MASTERDB-03 | chạy lần hai | bỏ qua file đã có đúng kích thước, không đẩy lại 179 MB | ✅ 07/09 |
| TS-MASTERDB-04 | **bucket NUỐT IM** (trả 200, không cất) | thoát khác 0, nói ra ĐÍCH DANH file thiếu, sổ tay `thieu` | ✅ 07/09 |
| TS-MASTERDB-05 | một file lỗi khi đẩy | thoát khác 0, sổ tay ghi đường dẫn hỏng | ✅ 07/09 |
| TS-MASTERDB-06 | không liệt kê được bucket | thoát khác 0 — đẩy xong mà không đối chiếu được thì coi như CHƯA xong | ✅ 07/09 |
| TS-MASTERDB-07 | nguồn nằm TRONG repo | từ chối, nhắc CLAUDE.md §5 (repo đang public) | ✅ 07/09 |
| TS-MASTERDB-08 | `--dry` | không đẩy file nào, chạy được mà không cần khoá | ✅ 07/09 |
| TS-MASTERDB-09 | rác OneDrive/Windows (`Thumbs.db`, `desktop.ini`, `.DS_Store`) | bỏ qua, chỉ file thật lên bucket | ✅ 07/09 |
| TS-MASTERDB-10 | sổ tay | ghi thẳng `KHONG_PHAI_BAN_SAO_DU_LIEU` — đây là bản gốc FILE, không chứa bảng Postgres nào (dự án không còn sao lưu DB từ 11/09/2026) | ✅ 11/09 |

### TS-SEC — hồi quy bảo mật (chạy sau MỌI migration đụng RLS/GRANT)
SQL Editor, `set role anon` rồi thử phá — anon key là key công khai, repo private không làm nó bí mật. Script: `bot/supabase/migrations/20260826c_soat_bao_mat.sql` khối `-- KIỂM CHỨNG`.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-SEC-01 | anon `select count(*) from reminders` | `0` | ✅ 04/09 |
| TS-SEC-02 | anon `delete from reminders` | lỗi quyền | ✅ 04/09 |
| TS-SEC-03 | anon đọc `public_listings` | lỗi quyền — view không lọc trạng thái, hở là lộ tin nháp | ✅ 04/09 |
| TS-SEC-04 | anon gọi `seller_drip_tick()`, `ctv_report_tick()` | lỗi quyền | ✅ 04/09 |
| TS-SEC-05 | anon `insert listings` · `update bot_prompts` | lỗi quyền cả hai | ✅ 04/09 |
| TS-SEC-06 | anon đếm sellers/ctvs/messages/conversations/viewings/deals | `0` hết | ✅ 04/09 |
| TS-SEC-07 | anon `count(*) from listings` | = `dang_ban + dang_quan_tam + da_chot`, nhỏ hơn tổng — tin `cho_thong_tin` khuất | ✅ 04/09 |
| TS-SEC-08 | anon đọc `listings`, `agents_public`, `listing_photos_v`, `projects`, `listing_facts` | ra dữ liệu bình thường; `agents_public` = số NMG trong `sellers` | ✅ 04/09 (vá 20260904b, anon 3/3) |
| TS-SEC-09 | `proacl` của `get_secret` trong `pg_proc` | chỉ `postgres` + `service_role` | ✅ 04/09 |
| TS-SEC-10 | mở `/nha-dat/<mã>` của tin có fact chứa SĐT | SĐT → `[liên hệ qua Zalo nhadat.cc]` ở cả `description` lẫn `answer` (FR-104) | ⏭ cần bản deploy |

### TS-SEC-AUTO — hồi quy RLS chạy MÁY, mỗi PR (`bun run test:sec`)
Tập không phá huỷ của TS-SEC, bắn khoá **công khai** `sb_publishable_…` vào DB thật qua PostgREST. Bổ sung cho TS-SEC chạy tay chứ không thay: bài `delete from reminders` vẫn ở trên vì nếu RLS hỏng thật thì nó xoá dữ liệu thật. Mã thoát: 0 đạt · 1 hỏng · **2 = không tới được DB (chưa kiểm được, KHÔNG phải đạt)**.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-SEC-AUTO-00 | dò đường: anon đọc `listings` | ra ≥1 dòng, không thì thoát 2 và bỏ chấm điểm | ⏭ CI (sandbox không có đường ra supabase.co) |
| TS-SEC-AUTO-01 | anon đọc 14 bảng nội bộ (`reminders`, `sellers`, `messages`, `curated_lists`, `property_events`…) | PostgREST từ chối, hoặc 0 dòng | ⏭ CI |
| TS-SEC-AUTO-02 | anon đọc `public_listings` | bị từ chối — view không lọc trạng thái | ⏭ CI |
| TS-SEC-AUTO-03 | anon gọi 6 RPC nội bộ (`get_secret`, `seller_drip_tick`, `ctv_report_tick`, `xuat_schema`, `liet_ke_bang`, `liet_ke_migration`) | bị từ chối cả 6 | ⏭ CI |
| TS-SEC-AUTO-04 | anon `insert listings` · `update bot_prompts` | bị từ chối; nếu lọt thì tự dọn và báo P0 | ⏭ CI |
| TS-SEC-AUTO-05 | anon đọc `agents_public`, đối chiếu `rpc/so_nmg_cong_khai` (20260915c, chỉ trả số NMG) | ra ≥1 NMG; rỗng mà số NMG = 0 là đúng cảnh (sau xoá hàng loạt 15/09); rỗng mà số NMG > 0 mới là lỗi làm `/moi-gioi` trắng 27/08→04/09 | ✅ 15/09: CI đỏ 6 lượt (run 302–314) vì DB hết NMG sau FR-210 mà bài kiểm không có tín hiệu độc lập → thêm hàm đếm, tự kiểm thêm cảnh `khong-nmg` (5/5) |
| TS-SEC-AUTO-06 | anon đọc `projects`, `listing_facts`, `listing_photos_v` | HTTP 200 — bắt lỗi siết quá tay | ⏭ CI |
| TS-SEC-AUTO-07 | anon lọc `status=cho_thong_tin` | 0 dòng — tin nháp không lọt ra ngoài | ⏭ CI |
| TS-SEC-AUTO-08 | **tự kiểm bộ trên** bằng PostgREST giả, 5 cảnh (khoẻ / RLS thủng / proxy chặn / siết quá tay / không có NMG) | thoát đúng 0 / 1 / 2 / 1 / 0 | ✅ 05/09 (4/4, chạy offline) · 15/09 5/5 |

### TS-LIVE — thông tuyến thật qua Zalo (chạy khi bật bridge)
Điều kiện: `node bot/bridge-zca/index.mjs` chạy, không còn `pumpEscalations: fetch failed`. Chạy trên project thật nên sau mỗi vòng xoá `listings` `CCRB-*`, `sellers`/`ctvs` test, `reminders` liên quan.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-LIVE-01 | `curl` POST `/functions/v1/escalation-feed` với anon key | 200 — không 200 thì các bài dưới vô nghĩa | ⏭ bridge im từ 27/08 |
| TS-LIVE-02 | acc khác nhắn: `chào em, anh tìm nhà quận 5 tầm 5 tỷ` | trả trong vài giây, gợi ý căn khớp ngân sách, không xổ ngẫu nhiên | ⏭ |
| TS-LIVE-03 | `căn BDS-Q5-0133 còn không em` | chào đúng căn (P16 · 4,8 tỷ · 57.4m²), không bịa tình trạng | ⏭ |
| TS-LIVE-04 | `gửi anh xem hình căn đó với` | căn chưa có ảnh → "để em hỏi lại chủ nhà", không bịa có hình | ⏭ |
| TS-LIVE-05 | `cho anh gặp người thật đi` | `needs_human = true` + 1 `reminders` kind `escalation` gán CTV | ⏭ |
| TS-LIVE-06 | điền `ctvs.phone`, chờ ≤60s | bridge resolve SĐT → uid, nhắn CTV, ghi ngược `ctvs.zalo_user_id` (FR-150) | ⏭ |
| TS-LIVE-07 | acc đã gán `sellers.zalo_user_id` nhắn `Bán nhà hẻm xe hơi phường 8, DT đất 4x16, 1 trệt 2 lầu, giá 8.5 tỷ` | tin `cho_thong_tin`, `property_type = nha_pho`, `price_raw = "8.5 tỷ"`, câu hỏi đầu là diện tích đất | ⏭ |
| TS-LIVE-08 | trả lời câu diện tích | fact lưu; đủ giá + DT + phường → tin nhảy `dang_ban`, bot báo "đã lên web" | ⏭ |
| TS-LIVE-09 | tin không đoán được loại, trả `hông biết nữa` | hỏi lại kèm lựa chọn, không ghi fact `loai_bds` | ⏭ |
| TS-LIVE-10 | người thật gõ tay từ acc clone | bot im 30 phút (FR-141), hạ `needs_human`, huỷ escalation chờ | ⏭ |

### TS-NGUOI — kịch bản NGƯỜI THẬT test qua Zalo (15/09/2026)

Viết sau đợt máy bắn 36 tin ngày 15/09 (TS-VAN-05, TS-GROQ-04…06, TS-NHUNG-01/02). Máy
đã kiểm được bóc tách, trạng thái DB, thứ tự model. Người thật kiểm **đúng những
thứ máy không với tới**: giọng có giống người trong nghề không, ảnh và sổ đi có
đúng đường không, Zalo thật có nhận có gửi không, người thật chen vào bot có
nhường không, và cái gì xảy ra SAU vài giờ (hỏi bù, nhắc lịch). Kiểm theo **cảm
nhận và hậu quả**, không cần đọc DB — DB có người khác soi theo giờ ghi trong
báo lỗi. [nguồn: chủ dự án 15/09/2026 — "kịch bản cho người thật test nên là ntn"]

**Ba vai, ba điện thoại, ~45 phút cho phần trong ngày + 5 phút ngày hôm sau:**
A = chủ nhà (Zalo cá nhân bất kỳ), B = khách mua (Zalo khác), C = admin kiêm CTV
(Zalo đã gắn `admins.zalo_user_id` / `ctvs.zalo_user_id`, mở sẵn `/admin`).
Thứ tự BẮT BUỘC: A rao → C duyệt → B mới có hàng để hỏi (kho hiện 0 tin đang rao).

**C chuẩn bị (5 phút):**
1. `/admin` không băng đỏ; sức khoẻ `bridge-zca` mới trong 2 phút (bridge chết thì
   mọi bài dưới vô nghĩa — TS-LIVE-01).
2. Chạy trong **8h–20h giờ VN**: mọi cron (hỏi bù, drip, nhắc, SLA CTV) chỉ chạy
   1–13 UTC. Ngoài giờ đó bot vẫn trả lời nhưng phần "sau vài giờ" không xảy ra.
3. `app_config.test_reset_hello = '1'` để A/B gõ **hello** là được làm khách mới
   (20260909b). **Tắt về '0' sau buổi test** — khách thật gõ hello mà mất tin là sự cố.
4. Người thật là Zalo thật, KHÔNG có tiền tố `thu-` nên cron `don_du_lieu_thu` 21:00
   không dọn: xong buổi thì `/admin` → CRM → **Xoá hàng loạt** (gõ `XOA HET`, FR-210)
   hoặc xoá từng số bằng `admin_xoa_khach`.

**Cách ghi lỗi (mọi vai):** một tin vào nhóm, 5 dòng: vai (A/B/C) · giờ · mình gõ gì ·
bot nói gì (chụp màn hình) · mình mong gì. Không giải thích thêm, không sửa lại
câu cho "đúng hơn" — câu gõ tự nhiên chính là dữ liệu.

**Điều KHÔNG phải lỗi, đừng báo:** bot im sau khi C gõ tay vào chat (nhường sân 30
phút, FR-141); bot trả lời chậm 5–10 giây khi nhiều người nhắn cùng lúc (Groq
bậc miễn phí chạm trần, tự chuyển Claude — FR-194); hai bong bóng liền nhau (một
"💾 Đã lưu…", một câu hỏi); câu "Em tra thấy đường này thuộc phường X, đúng không
ạ?" (bot đang HỎI, chưa ghi — FR-209).

| ID | Vai | Làm gì (gõ tự nhiên, không cần đúng chính tả) | Nhìn thấy gì thì ĐẠT | Dấu hiệu HỎNG → báo |
|---|---|---|---|---|
| TS-NGUOI-01 | A | Rao MỘT căn có thật của mình (hoặc bịa hợp lý), một câu, kiểu Zalo: `ban nha hem 4m nguyen trai q5 4x15 1 tret 2 lau 8ty5` | Bong bóng "Đã lưu" tóm đúng ≥ 5 trường mình vừa nói; sau đó ĐÚNG MỘT câu hỏi, và là thứ mình chưa nói | Hỏi lại điều đã nói · hỏi 2 câu một lượt · bịa trường mình không nói · mã tin lọt vào câu (FR-178) |
| TS-NGUOI-02 | A | Rao căn có TÊN ĐƯỜNG mà không nói quận/phường (vd `mặt tiền Lê Văn Việt`) | Bot tra ra phường + quận cũ và HỎI xác nhận; gật `đúng rồi` → tin ghi đúng phường/quận; nói `không, phường X` → theo mình | Tự ghi quận mà không hỏi · quận nhảy sang quận khác khi mình chỉ nói phường (bắt 15/09, đã vá) |
| TS-NGUOI-03 | A | Trả lời LỆCH ba lần: hỏi phường thì trả lời địa chỉ; `để anh hỏi vợ đã`; `sao em hỏi nhiều vậy` | Địa chỉ được ghi và hỏi lại phường ngắn gọn; "hỏi vợ" → bot dừng, không ghi; "hỏi nhiều" → xin lỗi, dừng hỏi | Ghi "để anh hỏi vợ" thành một trường · hỏi tiếp như không có gì |
| TS-NGUOI-04 | A | Sửa lời: `à nhầm, 9 tỷ 2 nha` rồi `phường 12 chứ không phải 8` | Bot nói rõ đã sửa, tóm tắt tin mới; C thấy cột đổi trên `/admin` | Ghi giá mới thành ghi chú · tin cũ giữ giá cũ |
| TS-NGUOI-05 | A | Gửi 2 ảnh mặt tiền + 1 ảnh SỔ (dùng sổ MẪU, che tên) — có thể gửi kèm chữ hoặc gửi trần | Bot khen ĐÚNG thứ có trong ảnh (không khen chung chung); ảnh sổ: bot đọc diện tích và đối chiếu, KHÔNG nhắc tên người; C soi tin: ảnh sổ nằm kho riêng, không hiện web | Khen bịa · sổ lên web · bot đọc tên/CCCD trong sổ ra chat |
| TS-NGUOI-06 | A | Gõ tiếng lóng và số điện thoại: `gia 2 toi 5, hem xe hoi, 1t2l, lien he 09xxxxxxxx` | Giá 2,5 tỷ · hẻm xe hơi · 1 trệt 2 lầu; SĐT bị che trên web và trong tóm tắt bot | SĐT hiện nguyên trên web · "2 tỏi 5" thành 2 tỷ hoặc 25 tỷ |
| TS-NGUOI-07 | A | Rao thêm căn: `còn căn nữa: mặt tiền Trần Phú 4x20 18 tỷ` rồi `em có 2 căn: căn 1 …, căn 2 …` | Mỗi câu mở TIN MỚI, căn cũ giữ nguyên số; bot gọi căn bằng địa chỉ, không đọc mã | Căn cũ bị đổi giá/kích thước theo căn mới (bắt 15/09, đã vá) |
| TS-NGUOI-08 | A | `thôi đăng đi em` khi còn thiếu vài thứ; sau đó `bán rồi em ơi` | Đủ tối thiểu → bản nháp tin để duyệt + nói còn thiếu gì; "bán rồi" → tin đóng, bot chúc mừng, không hỏi thêm | Hỏi tiếp sau "bán rồi" · nháp thiếu giá vẫn lên |
| TS-NGUOI-09 | C | `/admin` → Tin chờ duyệt: thấy tin của A, bấm duyệt | Tin lên `dang_ban`, mở được link tin trên web nhadat.cc, ảnh mặt tiền hiện, ảnh sổ KHÔNG hiện, SĐT che | Duyệt xong web không có · ảnh vỡ · mô tả lộ SĐT |
| TS-NGUOI-10 | B | Hỏi mơ hồ: `co can nao tam 8 ty q5 ko em` | Bot ghi nhu cầu, gợi ý đúng căn A vừa đăng (địa chỉ + giá), KHÔNG xổ căn lệch ngân sách, KHÔNG đọc mã tin | Gợi ý căn 3 tỷ cho khách 8 tỷ · trả lời chung chung không có căn |
| TS-NGUOI-11 | B | Hỏi chi tiết căn đó: `hẻm mấy mét, sổ riêng chưa` rồi hỏi thứ A CHƯA nói: `nhà có bị ngập không` | Hai câu đầu đúng dữ liệu A đã nói; câu chưa có → "để em hỏi chủ nhà"; **A nhận được câu hỏi trên Zalo** (FR-173: về chủ nhà trước); A trả lời → B được báo lại | Bot bịa "không ngập" · A không nhận gì · B không được báo lại |
| TS-NGUOI-12 | B | `gửi anh xem hình` | Nhận ảnh mặt tiền của A; KHÔNG nhận ảnh sổ | Nhận ảnh sổ · "để em hỏi chủ" trong khi tin có ảnh |
| TS-NGUOI-13 | B | Hẹn xem: `chiều mai 3h anh qua xem được không` | Bot chốt giờ, báo A (hoặc CTV); C thấy lịch hẹn ở `/admin`; **ngày mai** trước giờ hẹn có tin nhắc, có link bản đồ nếu tin có toạ độ | Không ai nhận lịch · nhắc sai giờ · link bản đồ bịa khi tin không có toạ độ |
| TS-NGUOI-14 | B | `cho anh gặp người thật đi` | C (CTV) nhận tin trên Zalo trong ≤ 1 phút với nội dung khách hỏi; C gõ tay vào chat B → bot im (30 phút); C gõ `bot làm tiếp đi` hoặc hết 30 phút → bot tiếp | C không nhận gì · bot chen vào lúc C đang nói |
| TS-NGUOI-15 | B | `ok anh chốt căn này` (hoặc 👍 / ❤️) | Bot xác nhận, C/CTV nhận tin 🤝 "khách đồng ý chốt"; tin sang `da_chot` trên `/admin` | Không ai nhận 🤝 (chỗ này CHẾT IM tới 15/09 — FR-142, đã vá, cần người xác nhận thật) |
| TS-NGUOI-16 | B | Gõ `hello` rồi hỏi kiểu khác: `tìm thuê căn hộ 1pn gần đại học tôn đức thắng dưới 8 triệu` | Được đón như khách mới; bot ghi thuê · 1PN · gần trường · ngân sách; nếu kho không có thì nói thật "chưa có căn khớp, em ghi lại" | Bot bịa vị trí trường (15/09 Claude nói ĐH Tôn Đức Thắng ở Quận 1 — trường ở Quận 7; chưa vá, cần bằng chứng thêm) · hỏi hai câu một lượt |
| TS-NGUOI-17 | C | Mở `/admin` → Tin nhắn: đọc lại hai hội thoại A và B từ đầu | Đọc trôi như người thật nói; không câu tiếng Anh, không thẻ `<think>`, không xưng "tôi là AI" trừ khi bị hỏi; tên trợ lý nhất quán | Câu lạ giọng / lọt tiếng Anh / thẻ nghĩ (dấu hiệu model dự phòng Groq) — ghi giờ để soi model nào |
| TS-NGUOI-18 | A | **NGÀY HÔM SAU**, 8h–20h: không nhắn gì | Bot tự nhắn MỘT lần gom 2–3 câu còn thiếu, không hỏi lại thứ mình đã né; trả lời → cột đổi | Không có tin (hỏi bù chết im 09→15/09, đã vá — đây là bằng chứng sống đầu tiên) · hỏi lại thứ đã né · hỏi lắt nhắt nhiều lần |
| TS-NGUOI-19 | A | **NGÀY HÔM SAU**: nhắn `em ơi tin anh sao rồi` | Bot nói đúng trạng thái (đang rao / chờ duyệt / thiếu gì), không hỏi lại từ đầu | Chào như khách mới · không nhớ tin |
| TS-NGUOI-20 | C | Cuối buổi: `/admin` → Sức khoẻ và sổ lỗi | 0 lỗi mới trong 2 giờ test; băng "đang chạy dự phòng" tắt | Có dòng lỗi → chụp nguyên dòng, kèm giờ |

Sau buổi: C dọn (bước 4 chuẩn bị), tắt `test_reset_hello`, và gửi tôi danh sách
lỗi kèm giờ — tôi đối chiếu `so.hoi_thoai`, `bot_errors`, log edge function theo
từng giờ đó và trả lời từng dòng ở bảng này (cột "Kết quả").

### TS-NGUOI-B — kịch bản CHỦ DỰ ÁN tự test lại 15/09/2026 (dữ liệu mẫu `mau-*` giữ lại)

[nguồn: chủ dự án 15/09/2026 tối — "bắn 1 số và đưa lại test plan để tao tự test lại 1 số tình huống, để data đó ko xóa"]

Mỗi dòng dưới là một lỗi máy đã bắt và vá trong ngày (TS-VAN-06/07/08); người thật
gõ lại đúng câu đó (hoặc tự nhiên hơn) trên Zalo để chắc là **sửa xong thật, không
phải chỉ xanh trên máy**. Mỗi dòng độc lập, 1–3 phút. Cần Zalo A (chủ nhà) và Zalo B
(khách); `test_reset_hello` đang `0` — muốn làm khách mới thì nhờ admin xoá số mình ở
`/admin` → CRM, hoặc báo tôi bật `1` trong buổi.

**Dữ liệu mẫu đã bắn sẵn, KHÔNG bị cron dọn** (tiền tố `mau-`, không nằm trong
`don_du_lieu_thu`; muốn xoá thì `/admin` → CRM → xoá từng số). **17/09/2026: đã XOÁ
HẾT theo lệnh chủ dự án** ("xóa hết hội thoại và rổ hàng cũ đi") bằng
`admin_xoa_het_khach_va_ro_hang('XOA HET')` — 11 tin, 8 người bán, 4 người mua, 12 hội
thoại, 163 tin nhắn. Bảng dưới chỉ còn là lịch sử; mọi số Zalo giờ là khách mới:

| Zalo giả | Vai | Đã gõ | Tin / hồ sơ tạo ra | Đang chờ câu |
|---|---|---|---|---|
| `mau-chu-nha` | chủ nhà bán | "anh có căn nhà hẻm 7m Trần Bình Trọng phường 1 quận 5 muốn bán, 4x16, 1 trệt 2 lầu, sổ hồng riêng, giá 11 tỷ 5" → "à quên, nhà đang cho thuê 25 triệu/tháng, khách thuê tới cuối năm. mà giá khu này giờ bao nhiêu 1m2 em?" → "3 phòng ngủ em. nhà đang cho thuê 25 triệu/tháng tới cuối năm nha" | `BDS-NP-Q5-0015` (64m², trệt + 2 lầu, hẻm xe tải 7m, SHR, 3PN, đang cho thuê 25 triệu/tháng, 11,5 tỷ) | tiềm năng sử dụng |
| `mau-khach-mua` | khách mua | "chị tìm nhà hẻm xe hơi quận 5 tầm 8-9 tỷ cho gia đình ở, 3 phòng ngủ" → "có căn nào ở hẻm Trần Bình Trọng không em" | hồ sơ: mua · Q5 · 8-9 tỷ · để ở · nhà hẻm · 3PN · HXH | kho chưa có tin đang rao → "em lọc rồi báo" |
| `mau-moi-gioi` | môi giới 2 căn | "em là môi giới, có 2 căn: căn 1 hẻm 6m An Dương Vương q5 5x18 giá 14 tỷ, căn 2 mặt tiền Hùng Vương q5 4x20 giá 30 tỷ" → "căn 1 sổ hồng riêng hoàn công đủ, căn 2 đang cho thuê 80 triệu/tháng" | `BDS-NP-Q5-0013` (An Dương Vương, 90m², SHR hoàn công, 14 tỷ), `BDS-NP-Q5-0014` (Hùng Vương, 80m², đang cho thuê 80 triệu/tháng, 30 tỷ) | phường (căn Hùng Vương) |
| `mau-chu-lon-tuoi` | chủ nhà xưng CHÚ, 2 căn | "Chào cháu chú có căn nhà hẻm 5m Phú Định phường 16 quận 8 cần bán, 4x15, giá 6 tỷ" → "Chào cháu chú có căn nhà này cần giao bán" → "căn khác" → "Căn số 14 ở Ny'ah Phú Định, 80m2, giá 7 tỷ" → "Nhà trong hẻm 2 xẹc nhưng hẻm rộng 5m nhà 4 tấm diện tích tổng 240m2" → "shr, nhà ở từ năm 2019 rồi" → "ngang 5m còn dọc 16m cần bán gấp" | `xung_ho=chú · nam · lon_tuoi`; `BDS-NP-Q8-0002` (hẻm 5m Phú Định, 60m², 6 tỷ); `BDS-NP-Q8-0003` (Căn số 14 ở Ny'ah Phú Định, 80m², 5x16, 4 tấm, sàn 240m2, SHR, gấp, 7 tỷ) | tiềm năng (0003) |
| `mau-cho-thue` | chủ nhà cho thuê | "cho thuê căn hộ Sunrise City q7, 76m2 2pn full nội thất, 18 triệu/tháng cọc 2 tháng" → "tầng 15 view hồ bơi, bên em có cần mình gửi hình không" | `BDS-CH-Q7-0001` (Tân Hưng Q7, dự án Sunrise City, 76m², tầng 15, 18 triệu/tháng) | hướng ban công |

Xem lại hội thoại máy đã bắn ở Table Editor → schema `so` → `so.hoi_thoai` (lọc theo
Zalo giả ở trên) hoặc `/admin` → CRM.

| ID | Vai | Gõ gì (tự nhiên là được) | ĐẠT khi | HỎNG → báo (lỗi cũ đã vá ngày 15/09) |
|---|---|---|---|---|
| TS-NGUOI-B01 | A | Rao KHÔNG DẤU kiểu cò: `co lo dat 5x18 thu duc phuong hiep binh chanh gia 6ty2 shr thanh khoan nhanh ko ban` | Tin đất · TP Thủ Đức · **Phường Hiệp Bình** · 90m² · SHR · giá 6ty2; bot hỏi tiếp một câu | "không thấy tin nào đang rao" (hiểu "ko ban" là rút tin) · phường trống · giá dính đuôi "shr thanh khoan…" |
| TS-NGUOI-B02 | B | Mở bằng "chào bạn": `chào bạn mình tìm nhà cho ba mẹ ở gần bệnh viện, tầm 5 tỷ đổ lại, q10 hoặc q5 gì cũng đc` | Bong bóng "Đã lưu nhu cầu: mua · Q10 hoặc Q5 · gần bệnh viện · tầm 5 tỷ" | Bot mở hồ sơ BÁN / "Đã lưu: Nhà phố bán · Quận 10 · 5 tỷ" |
| TS-NGUOI-B03 | A | Đang bị hỏi phường, trả lời bằng địa chỉ + kích thước: `hẻm 5m Cách Mạng Tháng 8, 4x14 nở hậu 5m` | Vị trí ghi đủ "…Tháng 8", tin có 56m² và nở hậu 5m; bot vẫn hỏi lại phường (ngắn) | Tên đường cụt "Cách Mạng Tháng" · 4x14 / nở hậu mất |
| TS-NGUOI-B04 | A | Đổi ý giữa chừng: `à mà nhà này cho thuê chứ ko bán, 25 triệu` | 💾 "loại giao dịch: cho thuê · giá 25 triệu"; 📦 Tin giờ: … **cho thuê** · giá 25 triệu | Tin vẫn "bán", giá không đổi, hoặc bot nói "đã ngưng rao" |
| TS-NGUOI-B05 | A | Hỏi thay vì trả lời: `bên bạn có cần mình gửi hình không hay sao` (lúc bot đang hỏi gấp/tầng) | Bong bóng "Dạ … gửi ảnh thẳng vào đây là em cất vào tin luôn ạ", rồi hỏi tiếp; KHÔNG có "Đã lưu: thông tin bổ sung / gấp: bên bạn có cần…" | Câu hỏi bị ghi thành dữ liệu · bot lờ câu hỏi |
| TS-NGUOI-B06 | A | `giá thì mình muốn tầm 4 tỷ 2, để mình hỏi vợ đã nhé` | 💾 "giá mong muốn: tầm 4 tỷ 2"; từ tin sau bot gọi **anh** | Ghi nguyên câu vào ô giá · bot gọi "chị" |
| TS-NGUOI-B07 | A | Hỏi giá thị trường: `giá khu này giờ bao nhiêu 1m2 vậy` — thử với căn KHÔNG thuộc dự án, rồi với căn Sunrise City | Không dự án: "em kiểm tra giá giao dịch gần đây rồi báo lại", **không nêu số**; Sunrise City: nêu số từ kho dự án ("40–43 triệu/m²") | Bịa số cho căn không dự án |
| TS-NGUOI-B08 | A | Trong câu rao chèn `…, mà bên em là bot hả?`; lượt sau `phí sao, có gọi điện phiền tôi không` | Bong bóng "Dạ em là trợ lý AI bên AI Ơi Nhà Đất…" trước câu hỏi đầu; phí: chính chủ 1% (môi giới 0,5%), chỉ thu khi thành công; không gọi điện | Câu hỏi bị nuốt · bot chối là máy · bot gửi lời như đang đọc lại câu lệnh ("Em hiểu rồi ạ… Sẵn sàng nhận hội thoại") |
| TS-NGUOI-B09 | A (môi giới) | Rao 2 căn một tin: `em là sale, có 2 căn q5: căn 1 hẻm 6m An Dương Vương 5x18 giá 14 tỷ, căn 2 mặt tiền Hùng Vương 4x20 giá 30 tỷ`; lượt sau `căn 2 sổ hồng riêng, có thương lượng. căn 1 đúc 3 tấm` | "Em mở 2 tin riêng: hẻm 6m An Dương Vương 14 tỷ · mặt tiền Hùng Vương 30 tỷ"; lượt sau ghi đúng căn, **không mở tin mới**, bong bóng "căn 2 pháp lý… · căn 1 kết cấu…" | Tin trống địa chỉ · mở thêm 2 tin rỗng · fact vào sai căn |
| TS-NGUOI-B10 | A | Tin BÁN kể thu nhập thuê: `nhà đang cho thuê 25 triệu/tháng, khách thuê tới cuối năm` | 💾 "hiện trạng: đang cho thuê 25 triệu/tháng"; giá tin KHÔNG đổi | "giá mong muốn: 25 triệu" · tin lật sang cho thuê |
| TS-NGUOI-B11 | A | Tin cho thuê kiểu Facebook nhiều dòng + emoji + SĐT, rồi `à giá 7tr thôi em, bớt cho người ở lâu dài` | Tin thuê đủ cột (quận, m², PN/WC, nội thất, giá, cọc); lượt sau giá 7tr + "thương lượng: bớt cho người ở lâu dài" | "thời hạn sử dụng đất: bớt cho người ở lâu dài" · giá "7tr thôi em" |
| TS-NGUOI-B12 | B | Gõ cụt: `trọ q5` → (bot hỏi vai) → `thuê trọ, tầm 3tr gần đh sài gòn` | Hồ sơ thuê · phòng trọ · Q5 gần ĐH Sài Gòn · 3 triệu; bot hỏi ĐÚNG MỘT câu | Hai câu hỏi trong một tin ("…phòng riêng hay share? Ngoài ra có cần toilet riêng…?") |
| TS-NGUOI-B13 | A | Báo bán rồi: `căn Trần Bình Trọng bán rồi em` (khi có ≥ 2 căn thì bot hỏi căn nào) | "Chúc mừng … đã bán được căn …! Em đã gỡ tin"; `/admin` tin sang `da_chot` | Bot hỏi tiếp như thường · gỡ nhầm căn |
| TS-NGUOI-B14 | C | `/admin` → Sức khoẻ sau buổi | 0 lỗi mới; không dòng "chat-reply model r1/r2 tra loi cau lenh" lặp | Có lỗi → chụp nguyên dòng |
| TS-NGUOI-B15 | A | Zalo A ĐÃ có tin đang rao, gõ đúng câu của bạn: `Chào cháu chú có căn nhà này cần giao bán` | Bot gọi "chú", xưng "cháu", nhắc căn đang có ("trước đó chú có căn …") và hỏi "căn đó hay căn khác?"; KHÔNG có bong bóng 💾; `/admin` → CRM: `xung_ho` = chú, `gioi_tinh` = nam, `nhom_tuoi` = lon_tuoi | "Dạ em chào chú" · 💾 "thông tin bổ sung: Chào cháu…" · bot hỏi tiếp câu của tin cũ |
| TS-NGUOI-B16 | A | Tiếp B15: `căn khác` → (bot xin địa chỉ, diện tích, giá) → `Căn số 14 ở Ny'ah Phú Định, 80m2, giá 7 tỷ` | Tin THỨ HAI mở (địa chỉ "Căn số 14 ở Ny'ah Phú Định", 80m², 7 tỷ), tin cũ giữ nguyên giá; gõ lại `chú có căn nhà cần bán` → `căn đó` → bot "tiếp tục với căn …" và hỏi câu đang treo | Giá tin cũ bị đổi thành 7 tỷ · không mở tin mới · "căn đó" bị ghi thành fact |
| TS-NGUOI-B17 | A | Trả lời câu diện tích đất bằng `Nhà trong hẻm 2 xẹc nhưng hẻm rộng 5m nhà 4 tấm diện tích tổng 240m2`, rồi `shr, nhà ở từ năm 2019 rồi`, rồi `ngang 5m còn dọc 16m cần bán gấp` | 💾 lượt 1: hẻm 5m · kết cấu "4 tấm" · **diện tích sàn** 240m2 (KHÔNG "nội thất", KHÔNG diện tích đất — bot vẫn hỏi lại đất); lượt 2: pháp lý "shr" · hiện trạng "nhà ở từ năm 2019 rồi"; lượt 3: diện tích đất "ngang 5m dài 16m" · gấp "cần bán gấp" · mặt tiền "ngang 5m dài 16m" — mỗi ô đúng một mảnh | Ô nào ghi nguyên cả câu · "nhà trống" · 240m² vào diện tích · "tiềm năng sử dụng: nhà ở từ năm 2019" |

| ID | Kết quả mới nhất |
|---|---|
| TS-NGUOI-01…20 | ⏳ chưa chạy — kịch bản viết 15/09 sau deploy #131 |

### TS-RENT — hồi quy luồng CHO THUÊ (chạy sau MỌI lần sửa `chat-reply`)
Hai lỗi SRS-3.8a từng làm luồng thuê chết im lặng (bot vẫn trả lời tử tế). Dọn sau khi chạy: xoá `listings` `CCRB-*` vừa sinh.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-RENT-01 | acc đã gán `sellers.zalo_user_id`: `cho thuê nhà mặt tiền phường 11, 60m2, giá 25 triệu/tháng` | tin được tạo; `deal='cho_thue'`, `property_type='nha_pho'`, `price_raw="25 triệu/tháng"`, `price_vnd=25000000` | ✅ 04/09 |
| TS-RENT-02 | acc khách: `anh muốn thuê nhà quận 5 tầm 20 triệu` | `buyers.preferences.deal="thue"`; gợi ý căn cho thuê, không xổ căn bán | ✅ 04/09 |
| TS-RENT-03 | `count(*) from listings where deal='cho_thue' and status in ('dang_ban','dang_quan_tam')` | > 0 và trùng số căn bot gợi ý | ✅ 04/09 |
| TS-RENT-04 | `cho anh hỏi đóng thuế nhà đất ở đâu` | không bị hiểu thành nhu cầu thuê — `preferences.deal` không đổi | ✅ 04/09 |
| TS-RENT-05 | log function sau TS-RENT-01 | không có `invalid input value for enum listing_deal` | ✅ 04/09 |

### TS-CHATREPLY — bộ kiểm sau MỌI lần deploy `chat-reply`
Bắt buộc khi deploy qua MCP (chép tay: mỗi `\` phải nhân đôi, `chat-reply` có 123 dấu; sót một cái là bóc sai mà vẫn biên dịch). Gọi `net.http_post` kèm `x-bridge-secret` từ Vault. Dọn: `sellers.zalo_user_id` về NULL, xoá tin `CCRB-*` + info_requests/facts/reminders, buyer `ZZTEST-*`, `bot_errors`, đẩy `bot_health.last_id`.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-CHATREPLY-01 | `anh co 5 tỏi rưỡi, tìm nhà quận 5 phường 9, coi giúp anh căn #BDS-Q5-0164` (`CODE_RE`, regex tiền, `wardNum`) | trả đúng căn được nhắc, lọc kho theo tầm giá đã bóc | ✅ 04/09 |
| TS-CHATREPLY-02 | `anh muốn thuê nhà quận 5 tầm 20 triệu một tháng` → `để ở, tìm luôn đi` (`dealCol()`) | lượt 2 trả căn CHO THUÊ thật | ✅ 04/09 |
| TS-CHATREPLY-03 | acc seller: `cho thuê nhà mặt tiền phường 11, 60m2, giá 25 triệu một tháng` (`wantsSell`, `sDeal`, `wardM`, `priceM`) | tin `deal=cho_thue`, đúng phường, `price_raw` không dính "trệt" | ✅ 04/09 |
| TS-CHATREPLY-04 | tin kèm `image_url` trỏ host không tồn tại (`ghiLoi()` trong catch) | HTTP 200, khách vẫn có trả lời (fallback regex); `bot_errors` có `source='chat-reply model'` | ✅ 04/09 |

### TS-CACHE — trang tin thật sự nằm trong cache (NFR-17)
`export const revalidate` không có tác dụng khi route thiếu `generateStaticParams()` — không lỗi, không cảnh báo, mỗi lượt xem là một lambda. Nhìn code không thấy; phải đo.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-CACHE-01 | `bun run build`, đọc bảng route | `/nha-dat/[code]` là `●` (SSG), không phải `ƒ` | ✅ 04/09 |
| TS-CACHE-02 | `node -e "console.log(Object.keys(require('./.next/prerender-manifest.json').dynamicRoutes))"` | có `/nha-dat/[code]` | ✅ 04/09 |
| TS-CACHE-03 | `bun run start`, `curl -D - http://127.0.0.1:3000/` | `x-nextjs-cache: HIT` + `Cache-Control: s-maxage=300` | ✅ 04/09 |
| TS-CACHE-04 | bản deploy: mở một trang tin hai lần, xem `x-vercel-cache` | lần hai `HIT`/`STALE`, không `MISS` liên tục | ⏭ sandbox không tới Vercel |
| TS-CACHE-05 | `/mua-ban?gia=duoi-5` hai lần trong 5 phút, đếm query ở Supabase Logs | lần hai không sinh query `listings` mới (Data Cache của `layTin`) | ⏭ |

### TS-HEALTH — còi báo lỗi có kêu không (FR-152)
SQL trên DB thật. Dọn: `delete from bot_errors; delete from reminders where note like '🩺%'`, đẩy `bot_health.last_id` của `pg_net` lên `max(id)` của `net._http_response`.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-HEALTH-01 | `net.http_post` tới `/functions/v1/khong-he-ton-tai`, chờ 15s, `bot_health_tick()` | trả `loi_moi = 1` | ⏭ 04/09 |
| TS-HEALTH-02 | `select * from bot_errors order by id desc limit 1` | dòng `source='pg_net'`, `status_code=404` | ✅ 04/09 |
| TS-HEALTH-03 | `select note from reminders where note like '🩺%'` | đúng MỘT tin dù tick nhiều lần trong giờ | ✅ 04/09 |
| TS-HEALTH-04 | `cron.job_run_details` của chính lần chạy hỏng ở 01 | vẫn `succeeded` — lý do FR-152 tồn tại, đừng tin cột này | ✅ 04/09 |
| TS-HEALTH-05 | gọi `escalation-feed` kèm `x-bridge-secret` đúng | `bot_health` có `who='bridge-zca'`, `at` vừa xong | ⏭ |
| TS-HEALTH-06 | xoá dòng `bridge-zca` khỏi `bot_health` rồi tick | **KỲ VỌNG CŨ SAI, đã đổi 06/09:** trước ghi `bridge_im = false` ("chưa từng có nhịp thì không báo") — đó chính là lỗ. Bridge chưa từng chạy là lúc ĐÁNG báo nhất, mà nhánh canh lại không chạy: "không có" bị lẫn với "bình thường", cùng hình lỗi SEC-02. Nay (`20260906a`) trong 7–22h VN phải ra `bridge_im = true`, `bridge_chua_bao_gio = true`, và một dòng `bot_errors` nói thẳng "CHƯA TỪNG điểm danh" | ⏭ cần dựng cảnh |
| TS-HEALTH-07 | bridge im > 15 phút trong 7–22h VN, tick hai lần cùng giờ (`20260904a`) | lần 1 `ntfy = <id>`, `net._http_response` 200 từ ntfy.sh, `bot_health` có `who='ntfy'`; lần 2 `ntfy = null` (1 tin/giờ) | ✅ 04/09 (id 2102/2103 → 200) |
| TS-HEALTH-08 | tồn 🩺 cũ + báo cáo CTV `pending` từ 27/08, chạy tick | 🩺 cũ → `cancelled`, chỉ còn mới nhất; báo cáo CTV quá 36h → `cancelled` | ✅ 04/09 (huỷ 117 + 7, còn 1) |
| TS-HEALTH-09 | **còi có tự nhận là đã kêu không** (`20260906a`): đối chiếu `bot_health(who='ntfy').last_id` với `net._http_response` cùng id | id đó phải là một lượt gửi **2xx**. Không phải 2xx mà còi vẫn im = còi câm | ❌→✅ 06/09 — bắt tại trận: dấu `ntfy` lúc `00:00:00.054` trỏ req **2221**, mà req 2221 là `status_code NULL`, `Timeout of 5000 ms` lúc `00:00:00.212`. Còi đóng dấu "đã gửi" trước khi pg_net kịp nói nó hụt, rồi im một giờ |
| TS-HEALTH-10 | chạy `bot_health_tick()` sau khi áp `20260906a`, trong lúc lượt báo trước đang hụt | `lan_truoc_da_gui = false`, sinh dòng `bot_errors` nguồn `coi ntfy`, và BẮN LẠI | ✅ 06/09 — `{"ntfy":2222,"lan_truoc_da_gui":false}`; `coi ntfy: lượt báo trước (pg_net req 2221) KHÔNG tới nơi` |
| TS-HEALTH-11 | lượt bắn lại đó có tới ntfy.sh thật không | `net._http_response` của id mới phải `200` | ✅ 06/09 — req **2222 → 200**, thân `{"id":"g55xO8pg8zLp",…}` từ ntfy.sh |
| TS-HEALTH-12 | đếm lượt `Timeout of 5000 ms` trong `bot_errors` nguồn `pg_net` từ 27/08 | mỗi lượt rơi đúng phút `:00` là một giờ không ai được báo | ⚠️ 06/09 — **24 lượt**, nhiều lượt đúng phút `:00`. Đã nới hạn chờ `net.http_post` 5 s → 15 s cho `canh_bao_ngoai` (5 s là mặc định của pg_net, không phải con số ai chọn) |
| TS-HEALTH-13 | `che_sdt()` — SĐT không được vào sổ lỗi (`sellers.phone` UNIQUE nên lỗi 23505 kèm nguyên số) | 6 ca dương che đúng; 5 ca âm không đụng | ✅ 06/09 — dương: 10 số, 11 số, `+84`, `84`, hai số một dòng, trong JSON. Âm: chuỗi timeout pg_net, epoch 13 số, UUID, mã tin `#BDS-0001`, dãy 12 số. Neo `\m`…`\M` là phần bắt buộc: bỏ neo thì UUID `…-000000000001` bị xén thành `…-0000xxxxxx01` |

### TS-LOG — lỗi tầng ứng dụng có vào sổ không (FR-152 d)
Loại lỗi này TRẢ 200 nên TS-HEALTH không bắt được. Không phủ log thô edge function (Free giữ 1 ngày); chỗ chưa gọi `ghiLoi()` vẫn im. Dọn như TS-HEALTH.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-LOG-01 | lặp 25 lượt `log_loi('thu-van','x',null)` | đúng **20** dòng — van theo nguồn | ✅ 04/09 |
| TS-LOG-02 | 600 lượt với 30 `p_source` khác nhau, `set local role anon` | tổng bảng dừng ở **200** — van tổng chặn kẻ đổi nguồn | ✅ 04/09 |
| TS-LOG-03 | `escalation-feed` `{"action":"log","source":"x","detail":"y"}` + `x-bridge-secret` | 200 `{"ok":true}`; `bot_errors` có `source='bridge x'` | ⏭ cần HTTP |
| TS-LOG-04 | tin kèm `image_url` host không tồn tại (đừng phá `ANTHROPIC_API_KEY` — làm chết bot thật) | HTTP 200, khách vẫn có trả lời; `bot_errors` `source='chat-reply model'` kèm lỗi API | ✅ 27/08 (`400 Unable to download`) · ⏭ 04/09 |
| TS-LOG-05 | route web ném lỗi có chủ ý trên bản deploy | `bot_errors` `source='web app'` kèm đường dẫn; khách thấy `app/error.tsx` | ⏭ cần deploy |
| TS-LOG-06 | `bot_health_tick()` sau TS-LOG-04 | có reminder 🩺 — còi đếm cả lỗi ứng dụng | ✅ 04/09 |

### TS-GIA — bóc giá tiếng lóng ra số (FR-154)
SQL editor, test hồi quy mỗi lần sửa `parse_vnd`: `select s, parse_vnd(s) from unnest(array['5 tỏi rưỡi','5 tỏi','5 tỷ rưỡi','5,5 tỷ','5 tỷ 5','3 tỷ 200','800 triệu','12 củ','15tr/th','900tr','1 trệt 2 lầu','5t5','2 tỉ 8','giá 6ty2 TL','7 tỏi 3','nhà 4x15 giá 8 tỏi','25 củ/tháng','5 cây vàng','5 tỏi 500 triệu','tỷ lệ chốt 5%','giá 5 tỷ 50m2','đất 100m2 giá 4ty','2 tý','thuê 8 củ rưỡi','5 tỷ 120m2','1 tỷ 050']) s;`
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-GIA-01 | bộ 26 ca ở trên | khớp đủ 26 | ✅ 04/09 |
| TS-GIA-02 | `'giá 5 tỷ 50m2'` | **5.000.000.000**, không phải 5,5 tỷ (regex từng lùi `{1,3}` để né lookahead `m`) | ✅ 04/09 |
| TS-GIA-03 | `'1 trệt 2 lầu'` | **NULL** — `tr` là "trệt"; `\M` Postgres hiểu dấu, đừng bê sang JS (`\b` chỉ ASCII) | ✅ 04/09 |
| TS-GIA-04 | `'5 cây vàng'`, `'2 tý'` | **NULL** cả hai — vàng không quy ra tiền; "tý" không phải tỷ | ✅ 04/09 |
| TS-GIA-05 | `count(*) from listings where price_vnd is distinct from parse_vnd(price_raw)` | **0** — khác 0 là sửa hàm chưa backfill | ✅ 04/09 |

### TS-SPECS — fact nhỏ giọt chảy vào cột (FR-153)
SQL trên tin có cột trống; dọn: xoá fact vừa chèn **và** trả cột về NULL (trigger không tự lùi).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-SPECS-01 | tin `bedrooms is null`, chèn `listing_facts` (`so_phong_ngu`, `'3PN 2wc'`, `thu`) | `listings.bedrooms = 3` | ✅ 04/09 |
| TS-SPECS-02 | chèn tiếp (`so_phong_ngu`, `'9 phòng'`) cùng tin | **9** — fact mới nhất thắng (luật "chỉ ghi khi trống" đã bỏ ở FR-163 a; chặn ghi đè là việc của bậc nguồn FR-164 a) | ✅ 04/09 |
| TS-SPECS-03 | (`huong`, `'Đông Nam'`) trên tin `direction is null` | `direction = 'Đông Nam'`; chuỗi > 40 ký tự thì bỏ qua | ✅ 04/09 |
| TS-SPECS-04 | (`so_phong_ngu`, `'ba phòng ngủ'`) | `bedrooms` vẫn NULL — không chữ số thì không đoán | ✅ 04/09 |

### TS-HANG — hạng Đồng/Bạc/Vàng (FR-155)
Đọc view `seller_ranks`. Không phủ: ngưỡng có đúng không (OPEN-26).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-HANG-01 | `select * from seller_ranks` | mỗi người bán một dòng; NMG 17–22 tin, 0 chốt → **bac** | ✅ 04/09 (3/3 Bạc) |
| TS-HANG-02 | cùng view, vai `anon` | không có cột `phone`/`zalo_user_id` (FR-104); từ `20260904b` view invoker → anon **0 dòng** là đúng ý (hạng ẩn khỏi web, chỉ `/admin` đọc) | ✅ 04/09 |
| TS-HANG-03 | đặt tay một tin `da_chot` cho NMG ≥10 tin, đọc lại (nhớ trả lại) | nhảy **vang** | ✅ 04/09 |

### TS-DANGTIN — admin tự đăng tin (FR-156)
RPC `admin_dang_tin` + trang `/admin/dang-tin`. Dọn: xoá tin `BDS-Q5-####` vừa tạo, `info_requests` của nó, người bán thử; kiểm lại `listings` = 173, `sellers` = 3.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-DANGTIN-01 | gọi `admin_dang_tin('{"price_raw":"1 tỷ"}')` không JWT admin | `42501` "Khong co quyen quan tri" | ✅ 04/09 |
| TS-DANGTIN-02 | `request.jwt.claims` = email trong `admins`, `price_raw='5 tỏi rưỡi'` | `code = BDS-Q5-####` nối dãy, `price_vnd = 5500000000` | ✅ 04/09 |
| TS-DANGTIN-03 | cùng lệnh, không gửi `seller_phone`/`seller_zalo` | người bán mới `phone IS NULL` và `zalo_user_id IS NULL` | ✅ 04/09 |
| TS-DANGTIN-04 | gọi lần hai cùng `seller_zalo` (hoặc `seller_phone`) | dùng lại `seller_id` cũ, không đẻ dòng `sellers` thứ hai | ✅ 04/09 |
| TS-DANGTIN-05 | mở `/admin/dang-tin` bằng tài khoản không trong `admins` | màn "Cần đăng nhập bằng tài khoản quản trị", không thấy form | ✅ 04/09 |

### TS-NEO — neo hội thoại người bán theo căn, tách vai (FR-157)
Cần người bán thử có `zalo_user_id` và **hai** tin cùng thiếu thông tin; gọi `chat-reply` qua `net.http_post`. Không phủ: câu hỏi chờ bị bỏ lại bao lâu thì drip hỏi lại. Dọn: xoá facts/info_requests/reminders/listings của người bán thử, `active_listing_id = null` rồi xoá `sellers`; xoá buyer/conversation của 04.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-NEO-01 | tạo câu hỏi pending cho căn A rồi căn B (B mới hơn) | `sellers.active_listing_id = B` — trigger neo trên INSERT | ✅ 04/09 |
| TS-NEO-02 | người bán nhắn "căn BDS-Q5-9001 xây năm 2015 nha em" (9001 = A) | fact `nam_xay` vào **A**, không vào B | ✅ 27/08 (v33) |
| TS-NEO-03 | đọc câu bot hỏi tiếp | nhắc rõ mã căn + tên đường ("căn #BDS-Q5-9001 ở Trần Bình Trọng diện tích đất…") | ✅ 27/08 |
| TS-NEO-04 | cùng Zalo ID nhắn "giờ anh muốn mua thêm một căn nữa ở quận 5 tầm 4 tỷ" | rẽ nhánh **buyer** (có `conversation_id`, không `role: seller`); câu chờ của A/B vẫn `pending` | ✅ 27/08 |

### TS-MA — câu rao sinh mã tin, một dãy mã duy nhất (FR-158)
Người bán thử **không** có câu hỏi chờ (có thì tin nhắn bị coi là câu trả lời). Test cổng rao **phải gõ có dấu** — gõ không dấu trượt ở `\b(bán|rao)\b` là pass giả (OPEN-29). Không phủ: người lạ chưa có dòng `sellers` nhắn câu rao vẫn rơi nhánh mua (chủ dự án để sau, 27/08).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-MA-01 | `insert into listings (code, …) values (null, …)` rồi `rollback` | `trg_listings_fill_code` điền mã nối dãy, không lỗi NOT NULL | ✅ 04/09 |
| TS-MA-02 | câu rao trần: `anh muốn bán căn nhà` | sinh tin `cho_thong_tin` + mã `BDS-Q5-####`; trigger đoán `nha_pho` từ chính câu rao, câu đầu hỏi `dien_tich_dat` | ✅ 27/08 (v35) |
| TS-MA-03 | `nhà mình bán chưa em` | **không** sinh tin — câu hỏi tình trạng, không phải câu rao | ✅ 27/08 |
| TS-MA-04 | `bán nhà hẻm xe hơi phường 8, 4x16, 8.5 tỷ` | sinh tin; `price_raw = "8.5 tỷ"`, `ward = "Phường 8"` | chưa chạy |
| TS-MA-05 | hai lượt rao đồng thời cùng người bán | hai mã khác nhau, không deadlock (advisory lock) | chưa chạy |

### TS-KD — tiếng Việt không dấu (FR-161)
Dựng như TS-MA. Bộ không dấu chỉ kích hoạt khi tin KHÔNG có dấu; tin có dấu đi đường cũ. Chấp nhận có chủ đích: "ban" ôm bán/bàn/bạn (cổng đòi đủ ba vế), "toi" ôm tôi/tối, "anh" trần không phải xin ảnh.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-KD-01 | `ban nha hem xe hoi phuong 8 gia 8.5 ty` | tin: `ward="Phường 8"`, `price_raw="8.5 ty"`, `price_vnd=8.5e9`, `property_type=nha_pho` | ✅ 27/08 live (v36) |
| TS-KD-02 | cùng người nhắn `toi muon mua nha quan 5` | rẽ nhánh buyer (`hoiMua` không dấu), không tạo tin | ✅ 27/08 live |
| TS-KD-03 | `nha minh ban chua em` | không sinh tin — trượt vì bộ chặn câu hỏi bản không dấu, không phải "ăn may" | ✅ 27/08 (đơn vị, 18 ca cổng) |
| TS-KD-04 | người bán có câu chờ nhắn `chieu gui anh so cho em` | `PROMISE_RE_KD` bắt → reminder `promise` | chưa chạy |
| TS-KD-05 | `select guess_property_type('ban dat nen quan 5'), guess_property_type('chưa đạt thoả thuận')` | `dat` và `NULL` — "đạt" ≠ "đất" | ✅ 04/09 |

### TS-IDEM — sổ idempotency + retry (FR-162)
SQL gọi thẳng `claim_inbound`, rồi E2E `net.http_post` vào chat-reply thật nhánh buyer (có fallback khi model hỏng). Đo quota bằng `bot_usage.model_calls`. Bẫy: CTE nhiều nhánh gọi `claim_inbound` trong cùng statement chạy không theo thứ tự — tách từng lệnh.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-IDEM-01 | `claim_inbound('x')` lần đầu | `claimed`, attempts 1 | ✅ 04/09 |
| TS-IDEM-02 | gọi lại khi hàng còn `received` tươi | `in_flight` | ✅ 04/09 |
| TS-IDEM-03 | đặt `completed` + reply rồi claim lại | `completed` kèm nguyên reply | ✅ 04/09 |
| TS-IDEM-04 | đặt `failed` rồi claim lại | `claimed`, attempts 2 | ✅ 04/09 |
| TS-IDEM-05 | đặt `processing`, lùi `updated_at` 200 s | `claimed` (reclaim sau 150 s) | ✅ 04/09 |
| TS-IDEM-06 | `claim_inbound(null)` | `23502` — từ `20260829a` PK `zalo_msg_id` NOT NULL; `chat-reply` chỉ gọi khi có `msgId` (kỳ vọng cũ "claimed" lỗi thời) | ✅ 04/09 (sửa kỳ vọng) |
| TS-IDEM-07 | E2E: tin buyer mới, msg_id mới | 200 + replies; sổ `completed`; quota **+1** | ✅ 27/08 (v37) |
| TS-IDEM-08 | E2E: gửi LẠI đúng msg_id | `replayed: true` + nguyên câu cũ; quota **+0**; `messages` 1 dòng | ✅ 27/08 |
| TS-IDEM-09 | E2E: 2 request cùng msg_id đồng thời | một bên trả lời, bên kia `in_flight`; quota **+1** | ✅ 27/08 |
| TS-IDEM-10 | E2E: sửa sổ `failed` rồi gửi lại | xử lý THẬT, attempts 2, `messages` 1 dòng; quota **+1** | ✅ 27/08 |

### TS-IDEM2 — sự kiện tách khỏi job, exactly-once chiều gửi (FR-162 phần 2)
Cùng harness TS-IDEM (chat-reply v38 + zalo-webhook v9 + `20260827n`). Bẫy: `now()` cố định theo transaction — muốn `last_seen_at` nhích phải gọi ở hai request rời.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-IDEM2-A | cùng webhook giao 2 lần | lần 2 `replayed` + nguyên câu; quota +0 | ✅ 28/08 |
| TS-IDEM2-B | cùng webhook giao 10 lần | 1 dòng `messages`, attempts 1, 9/9 replay; quota +1 | ✅ 28/08 |
| TS-IDEM2-C | 2 bản sao đến đồng thời | một bên trả lời, bên kia `in_flight` rỗng; 1 dòng messages | ✅ 28/08 |
| TS-IDEM2-D | worker retry sau `failed` | xử lý thật, attempts +1, messages 1 dòng; quota +1 | ✅ 28/08 |
| TS-IDEM2-E | chết SAU khi AI chạy, TRƯỚC commit (`processing` kẹt, lùi 200 s) | reclaim sau 150 s → xử lý thật, reply lưu, messages 1 dòng | ✅ 28/08 |
| TS-IDEM2-F | chết SAU commit, TRƯỚC ack (caller gọi lại) | replay nguyên payload, không business effect mới | ✅ 28/08 |
| TS-IDEM2-G | lần trước GỬI HỤT (`send_error` có, `sent_at` trống) | replay `already_sent=false` → kênh gửi lại | ✅ 28/08 |
| TS-IDEM2-H | lần trước gửi thành công, provider giao trùng | replay `already_sent=true` → webhook im, khách không nhận đúp | ✅ 28/08 |
| TS-IDEM2-I | cùng event giao nhiều lần, timestamp khác | `inbound_events` MỘT dòng, `delivery_count` đủ, payload giữ bản đầu, `last_seen_at` nhích | ✅ 04/09 |

### TS-TOANVEN — toàn vẹn dữ liệu tầng DB (FR-163)
Một khối DO trên DB thật, bắt exception cho ca "phải bị chặn", ghi bảng tạm rồi đọc (RAISE NOTICE không về qua MCP). EXPLAIN `messages` theo `conversation_id order by seq desc` phải là `Index Scan using messages_conv_seq_idx`.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| 01 | fact `so_phong_ngu` "3 phòng" rồi sửa "4 phòng ngủ" | `bedrooms = 4` — fact mới nhất thắng | ✅ 04/09 |
| 02a | fact `dien_tich_tim_tuong` "120m2" | `area_m2` không đổi | ✅ 04/09 |
| 02b | fact `dien_tich` "50m2" | `area_m2 = 50` | ✅ 04/09 (vá 20260904b) |
| 03 | fact `loai_bds` "nhà phố ạ" | `property_type=nha_pho` + `property_type_source=chu_xac_nhan` | ✅ 04/09 (vá 20260904b) |
| 04 | UPDATE thẳng `price_vnd = 999` | trigger đè lại = `parse_vnd(price_raw)` | ✅ 04/09 |
| 05a | INSERT 2 deals cùng (listing, buyer NULL) | 23505 — unique `NULLS NOT DISTINCT` | ✅ 04/09 |
| 05b | DELETE deal có `closed_at` | trigger raise | ✅ 04/09 |
| 05c | gỡ `closed_at` rồi DELETE | được — đường thoát hai bước | ✅ 04/09 |
| 06a | viewing không có cả `listing_id` lẫn `listing_code` | CHECK chặn | ✅ 04/09 |
| 06b | viewing chỉ có `listing_code` | được | ✅ 04/09 |
| 06c | viewing `status='tùm lum'` | CHECK chặn | ✅ 04/09 |
| 07a | conversation có cả buyer lẫn seller | CHECK một-vai chặn | ✅ 04/09 |
| 07b | seller thứ hai hội thoại | unique chặn | ✅ 04/09 |
| 08 | reminder `cancelled` bị UPDATE thành `sent` | revert êm: vẫn `cancelled`, `sent_at` trống | ✅ 04/09 |
| 09 | ledger `completed` bị hạ xuống `failed` | raise | ✅ 04/09 |

### TS-OUNG — đường ống dữ liệu tin rao (FR-164)
DO block trên DB thật + E2E qua `chat-reply`. Mọi cửa ghi (`listing_facts`, `admin_dang_tin`, web) đều qua trigger `trg_listings_chuan_hoa_cot` (`20260828f`) nên `ward`/`price_raw` một luật trình bày; bộ `chuan_hoa_gia_raw` 14/14.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-OUNG-01 | fact vào TRƯỚC khi cột cấu trúc được ghi | cột theo fact, `*_source` đúng bậc, tin đủ ba trường lên `dang_ban` | ✅ 04/09 (vá 20260904b) |
| TS-OUNG-02 | cột ghi trước, fact đến sau | fact chủ nhà (`chu_xac_nhan`) đè `suy_doan` | ✅ 04/09 (vá 20260904b) |
| TS-OUNG-03 | hai fact cùng trường ghi đồng thời | không mất cập nhật; giá trị cuối là fact sau, không kẹt khoá | ✅ 04/09 |
| TS-OUNG-04 | chủ sửa giá 6.5→6.8 tỷ, DT 25→27, PN 3→4, loại chưa rõ→nhà phố, phường 1→3 | cả năm đổi; cột non-NULL không chặn | ✅ 04/09 (vá 20260904b) |
| TS-OUNG-05 | tin thiếu giá / diện tích / phường | `listing_du_dang_tin()` false, giữ `cho_thong_tin` | ✅ 04/09 |
| TS-OUNG-06 | `property_type` chưa rõ | vẫn đăng được — loại không nằm trong ba trường quyết định | ✅ 04/09 |
| TS-OUNG-07 | loại suy từ mô tả | `property_type_source='suy_doan'` | ✅ 04/09 |
| TS-OUNG-08 | chủ xác nhận có phủ định: "nhà phố chứ không phải chung cư em" | `nha_pho` — `cat_truoc_phu_dinh()` | ✅ 04/09 (vá 20260904b) |
| TS-OUNG-09 | `parse_vnd()` không đọc được chuỗi giá | không ghi; `price_raw`/`price_vnd` giữ nguyên | ✅ 04/09 |
| TS-OUNG-10 | diện tích dị dạng ("mấy chục mét") | không ghi; fact vẫn lưu làm bằng chứng | ✅ 04/09 |
| TS-OUNG-11 | tin đủ thông tin | tự lên `dang_ban`, một trigger quyết định | ✅ 04/09 |
| TS-OUNG-12 | tin đang bán bị gỡ mất một trường | tự hạ về `cho_thong_tin` | ✅ 04/09 |

### TS-KHO — kho ảnh tin rao theo UUID (FR-165)
DB trong DO block cuộn lại; HTTP qua `pg_net`. Chưa kết luận: anon LIỆT KÊ bucket riêng trả `200 []` — kho rỗng nên không phân biệt "RLS lọc" với "cho phép nhưng rỗng", kiểm lại khi có ảnh thật. Bẫy: `revoke … from anon` không tác dụng với hàm, phải revoke từ PUBLIC.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-KHO-01 | upload: ghi dòng media đúng quy ước | nhận, tự thành ảnh bìa | ✅ 04/09 |
| TS-KHO-02 | upload đường dẫn theo MÃ TIN (lối cũ) | CHECK chặn | ✅ 04/09 |
| TS-KHO-03 | upload trùng (bucket, path) | UNIQUE chặn | ✅ 04/09 |
| TS-KHO-04 | `so_do` vào bucket công khai | CHECK chặn | ✅ 04/09 |
| TS-KHO-05 | sort_order NGƯỢC thứ tự tên file | ra `10,2,1` (xếp theo tên sẽ ra `1,10,2`) | ✅ 04/09 |
| TS-KHO-06 | ảnh bìa | tấm `sort_order` nhỏ nhất — tiền đề chèn theo `sort_order` tăng dần (như `up-anh.mjs`); `listing_media_chon_bia()` cố ý không đè bìa admin chọn tay | ✅ 04/09 (ghi tiền đề) |
| TS-KHO-07 | đổi mã tin | 3/3 ảnh còn nguyên, view đổi theo mã mới | ✅ 04/09 |
| TS-KHO-08 | replace (đổi storage_path) | đường dẫn cũ vào hàng đợi dọn | ✅ 04/09 |
| TS-KHO-09 | xoá ảnh đang là bìa | vào hàng đợi + tấm kế lên bìa | ✅ 04/09 |
| TS-KHO-10 | xoá tin | media cascade về 0, cả 4 file vào hàng đợi (kể cả riêng tư) | ✅ 04/09 |
| TS-KHO-11 | upload hỏng (có dòng, chưa có file) | `media_mo_coi_db` soi ra | ✅ 04/09 |
| TS-KHO-12 | worker nhận việc | `dang_lam`, attempts=1 | ✅ 04/09 |
| TS-KHO-13 | xoá hỏng rồi quá 10 phút | nhận lại được, attempts=2 (trigger chỉ tự đóng dấu `updated_at` khi người gọi không đặt) | ✅ 04/09 |
| TS-KHO-14 | việc đã `xong` | không bị nhận lại, không lùi trạng thái được | ✅ 04/09 |
| TS-KHO-15 | worker chạy thật với file KHÔNG tồn tại | `da_xoa=1` — Storage trả HTTP 400 thân `{"statusCode":"404"}`, worker phải đọc thân | ✅ 29/08 · ⏭ 04/09 |
| TS-KHO-16 | anon xin quyền GHI `listing-public` | 403 AccessDenied | ✅ 29/08 · ⏭ 04/09 |
| TS-KHO-17 | anon xin quyền GHI `listing-private` | 403 AccessDenied | ✅ 29/08 · ⏭ 04/09 |
| TS-KHO-18 | anon tự tạo bucket | 403 AccessDenied | ✅ 29/08 · ⏭ 04/09 |
| TS-KHO-19 | đọc `/object/public/` của bucket RIÊNG | `NoSuchBucket` | ✅ 29/08 · ⏭ 04/09 |
| TS-KHO-20 | anon đọc `listing_media` | chỉ thấy dòng `listing-public`; `so_do` bị RLS lọc | ✅ 04/09 |
| TS-KHO-21 | anon đọc view sau khi siết execute | vẫn ra URL dạng UUID — view đọc thẳng `app_config` bằng subquery, không gọi hàm (EXECUTE xét theo người gọi) | ✅ 04/09 |
| TS-KHO-22 | đường dẫn có `..` | CHECK chặn | ✅ 04/09 |
| TS-KHO-23 | đường dẫn có `//` | CHECK chặn | ✅ 04/09 |
| TS-KHO-24 | ảnh thường vào bucket riêng | cho — bucket riêng không cấm ảnh thường | ✅ 04/09 |
| TS-KHO-25 | `is_cover` cho file ở bucket riêng | CHECK chặn | ✅ 04/09 |

### TS-JOB — việc chạy nền tin cậy (FR-166)
Một khối DO trên DB thật, cuộn lại (0 dòng `TSJOB%` sót). Cảnh sập dựng bằng tay: `updated_at` lùi quá hạn thuê, `attempts` đẩy lên trần. E2E: sự kiện mồ côi thật trong `inbound_events` → `inbound-sweep` nhặt, job `completed`, 3 `messages`, lượt sau không liệt kê nữa.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-JOB-01 | claim tin lần đầu | `received`, attempts=1, sổ `processing` | ✅ 04/09 |
| TS-JOB-02 | hai worker giành cùng tin | bên thua `in_flight`, không xử lý đôi | ✅ 04/09 |
| TS-JOB-03 | worker sập: `processing` quá hạn thuê 150s | worker sau nhận lại, attempts=2 | ✅ 04/09 |
| TS-JOB-04 | báo hỏng một job | `failed` + `next_retry_at` | ✅ 04/09 |
| TS-JOB-05 | claim trước giờ thử lại | `in_flight` — không đập API sớm | ✅ 04/09 |
| TS-JOB-06 | luật lùi dần `lan_thu_ke()` | nhân đôi dần, chặn 1 tiếng, nhiễu ±20% | ✅ 04/09 |
| TS-JOB-07 | hỏng vĩnh viễn: lần thứ 8 | `dead`, thôi thử | ✅ 04/09 |
| TS-JOB-08 | claim việc đã `dead` | trả `dead` + cờ `r_dead` | ✅ 04/09 |
| TS-JOB-09 | lùi `dead` → `processing` | guard chặn (chỉ gỡ bằng `completed`) | ✅ 04/09 |
| TS-JOB-10 | báo hỏng trên dòng đã `completed` | `da_completed`, không đụng status | ✅ 04/09 |
| TS-JOB-11 | nudge giành việc nhắc tới hạn | 1 dòng, `locked_by`, attempts=1 | ✅ 04/09 |
| TS-JOB-12 | hai worker nudge chạy chồng | worker thứ hai lấy 0 dòng | ✅ 04/09 |
| TS-JOB-13 | gửi nhắc hụt | nhả thuê + hẹn giờ lùi dần | ✅ 04/09 |
| TS-JOB-14 | giành nhắc trước giờ thử lại | 0 dòng | ✅ 04/09 |
| TS-JOB-15 | nhắc hỏng lần thứ 5 | `dead` | ✅ 04/09 |
| TS-JOB-16 | lùi nhắc `dead` → `pending` | guard giữ `dead` | ✅ 04/09 |
| TS-JOB-17 | hai lời hỏi thăm cùng một khách | 23505 — unique index, bên thua nhường | ✅ 04/09 |
| TS-JOB-18 | nhắc chưa tới hạn | không bị nhặt | ✅ 04/09 |
| TS-JOB-19 | worker nhận việc dọn file | `dang_lam`, attempts=1 | ✅ 04/09 |
| TS-JOB-20 | việc dọn file quá 6 lần | thôi nhận | ✅ 04/09 |
| TS-JOB-21 | `chon_viec_don_chet()` | đổi sang `chet` | ✅ 04/09 |
| TS-JOB-22 | sập trước khi gọi chat-reply: có sự kiện, không job | đường cứu thấy, `chua_co_job` | ✅ 04/09 |
| TS-JOB-23 | sập giữa lúc gọi model: job kẹt `processing` | đường cứu thấy, `job_do_dang` | ✅ 04/09 |
| TS-JOB-24 | sập sau AI, trước lần gửi đầu (`completed`, `sent_at` null, `sent_bubbles` 0) | đường cứu thấy, `chua_gui` — so `jsonb_array_length(reply->'replies')` với `sent_bubbles`, không đợi `send_error` | ✅ 04/09 |
| TS-JOB-25 | đã gửi đủ bong bóng | không liệt kê | ✅ 04/09 |
| TS-JOB-26 | việc đã `dead` | không liệt kê | ✅ 04/09 |
| TS-JOB-27 | view `job_suc_khoe` | thấy việc dở của cả ba hàng đợi | ✅ 04/09 |
| TS-JOB-28 | giành được nhưng KHÔNG thử gửi (thiếu đích/token OA) | `nha_viec_nhac` trả việc: hết khoá, `attempts` về 0 (`20260829c`) | ✅ 04/09 |
| TS-JOB-29 | nhả xong, worker sau nhặt lại | lấy được ngay | ✅ 04/09 |
| TS-JOB-30 | nhả một việc đã `sent` | `khong_co` — chỉ nhả việc `pending` | ✅ 04/09 |

### TS-SEC2 — soát bảo mật theo VAI THẬT (FR-167)
Không đọc policy rồi suy, mà `set local role anon`/`authenticated` kèm `request.jwt.claims` rồi thử đọc/ghi/gọi RPC; edge function gọi HTTP bằng publishable key. Chấm theo SỐ DÒNG (UPDATE bị RLS chặn không ném lỗi) và ép đánh giá hàm bằng `execute … into` (`count(*)` bỏ qua hàm). Kho file: `storage.objects`/`buckets` bật RLS 0 policy — 16 ca ghi/leo thư mục/đổi bucket đều chặn (29/08); liệt kê bucket rỗng `200 []` chưa kết luận được.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-SEC2-01…22 | `anon` ĐỌC sellers, buyers, messages, conversations, deals, viewings, reminders, admins, ctvs, info_requests, bot_prompts, app_config, bot_errors, inbound_ledger, media_cleanup_queue, job_suc_khoe, tin nháp, fact địa chỉ/hình, media bucket riêng | 22/22 chặn | ✅ 04/09 |
| TS-SEC2-23…41 | người lạ ĐÃ ĐĂNG NHẬP ghi: sửa/xoá tin người khác, tự phong admin, sửa SĐT chủ nhà, tạo seller/buyer đội tên, sửa CRM/phí, chốt/xoá deal, chèn tin nhắn, spam nhắc, sửa prompt/app_config, thêm media/fact, lịch xem giả | 19/19 chặn | ✅ 04/09 |
| TS-SEC2-42…56 | người lạ gọi RPC: get_secret, cau_hinh, next_listing_code, listings_fill_code, info_request_set_active_listing, ghi_fact_listing, merge_buyer_prefs, claim_inbound, nhan_viec_nhac, bump_model_quota, beat, các `*_tick` | 15/15 chặn | ✅ 04/09 |
| TS-SEC2-57…59 | chéo người bán: B đọc hồ sơ A, tin nháp A, cướp tin A (đổi `seller_id`) | 3/3 chặn | ✅ 04/09 |
| TS-SEC2-60…61 | không vỡ nghiệp vụ: anon đọc tin đã lên kệ + ảnh | 2/2 đạt | ✅ 04/09 |
| TS-SEC2-H1 | `nudge` không kèm khoá | 403 (trước vá: 200 + lộ lời nhắc) | ✅ 29/08 · ⏭ 04/09 |
| TS-SEC2-H2 | `nudge` + publishable key | 403 (trước: 200) | ✅ 29/08 · ⏭ |
| TS-SEC2-H3 | `nudge` + `x-bridge-secret` đúng (đường cron) | 200 | ✅ 29/08 · ⏭ |
| TS-SEC2-H4 | `nudge` + bridge secret sai | 403 | ✅ 29/08 · ⏭ |
| TS-SEC2-H5 | `ask-seller` + publishable key | 403 (trước: 400 — đã qua cổng); bằng bridge secret vẫn qua | ✅ 29/08 · ⏭ |
| TS-SEC2-H6 | `ctv-report` + publishable key | 403 (trước: chạy tới model) | ✅ 29/08 · ⏭ |
| TS-SEC2-H7 | `geocode-listings` + publishable key | 403 (trước: 200, ghi lat/lng) | ✅ 29/08 · ⏭ |
| TS-SEC2-H8 | `chat-reply`/`escalation-feed`/`media-cleanup`/`inbound-sweep` + publishable key | 403/401/403/403 (vốn kín) | ✅ 29/08 · ⏭ |
| TS-SEC2-62 | mọi hàm SQL có `net.http_post` đều mang `x-bridge-secret` — trừ `canh_bao_ngoai` (ntfy, FR-152 e), loại trừ tường minh trong câu `pg_get_functiondef` | danh sách thiếu rỗng | ✅ 04/09 (6 hàm: 5 + 1 loại trừ; sửa câu) |
| TS-SEC2-63 | không hàm nào còn nhúng cứng anon JWT đời cũ (`eyJhbGciOi…`) | rỗng | ✅ 04/09 |
| TS-SEC2-64 | `authenticated` gọi `ask_seller_drip()` | chặn | ✅ 04/09 |
| TS-SEC2-65 | `anon` gọi `ask_seller_drip()` | chặn | ✅ 04/09 |
| TS-SEC2-66 | `seller_drip_tick` + `trg_listing_drip` vẫn SECURITY DEFINER | 2/2 — siết `ask_seller_drip` không gãy đường vận hành (hồi quy drip vá `20260829e`) | ✅ 04/09 |

### TS-HQ — hồi quy sau soát thù địch + hai lượt review diff (29/08/2026)
Mười lỗi đều ở tầng TypeScript của FR-161…167 — nơi chưa có test; 01–04 chạy máy (`bot/tests/*.mjs`, Node, không cần mạng), 05–12 là bất biến kiểm tĩnh. Hạn còn lại: bridge chưa tiếp tục từ `sent_bubbles` (cần `claim_inbound` trả thêm cột).
| ID | Bài | Kỳ vọng / vá ở | Kết quả mới nhất |
|---|---|---|---|
| TS-HQ-01 | `node bot/tests/fr161-go-lan-dau.mjs` — câu gõ LẪN dấu là câu rao (`ban nha q5 giá 5 ty`) | 9/9 | ✅ 04/09 |
| TS-HQ-02 | cùng file — câu gõ lẫn dấu là câu hỏi mua | nhận ra | ✅ 04/09 |
| TS-HQ-03 | `node bot/tests/fr164-loi-sua-va-cau-hoi-treo.mjs` — vừa sửa trường vừa trả lời câu treo | ghi CẢ HAI, 8/8 | ✅ 04/09 |
| TS-HQ-04 | cùng file — câu CHỈ có lời sửa | không rơi xuống khối câu hỏi treo | ✅ 04/09 |
| TS-HQ-05 | `chat-reply` gặp job `dead` | DỪNG, không gọi model — nhánh `r_state === "dead"` (vỡ exactly-once nếu không) | ✅ 04/09 kiểm tĩnh |
| TS-HQ-06 | báo hỏng job | qua `bao_hong_inbound`, không ghi thẳng `status='failed'` (thiếu `next_retry_at` → sweep đốt 8 lượt/8 phút) | ✅ 04/09 kiểm tĩnh |
| TS-HQ-07 | `nudge --dry_run` | không đụng lời nhắc thật — `baoHongNhac` | ✅ 04/09 kiểm tĩnh |
| TS-HQ-08 | dòng giữ chỗ `reengage` mồ côi | được dọn (quét > 15 phút) — nếu không khách đó không bao giờ được hỏi thăm | ✅ 04/09 kiểm tĩnh |
| TS-HQ-09 | lỗi chèn giữ chỗ khác 23505 | vào `bot_errors`, không `continue` trần | ✅ 04/09 kiểm tĩnh |
| TS-HQ-10 | `catch` ở cửa phát lại `zalo-webhook` | chỉ bọc `JSON.parse`; `handleEvent` ném không được nuốt thành 200 | ✅ 04/09 kiểm tĩnh |
| TS-HQ-11 | bridge tôn trọng `replayed`+`already_sent`, ghi `sent_at` (`mark_sent`) | thả tim đúp không phát lại loạt bong bóng | ✅ 04/09 kiểm tĩnh |
| TS-HQ-12 | `nha_viec_nhac` chỉ nhả việc của CHÍNH worker đó (`20260829f`) | worker treo không xoá khoá worker đang chạy | ✅ 04/09 |

### TS-TIEN — đồng hồ đo tiền bộ não (FR-169)
`DO … raise exception` trên DB thật, `bot_usage` giữ nguyên 3 dòng cũ. Điểm mù: chỉ `chat-reply` nối `doTien()`; `nudge`/`ask-seller`/`ctv-report` chưa — số ở `/admin` là SÀN. Chưa kiểm: số chữ thật và nhịp nhớ tạm 1 giờ (`cache_read_tokens` phải > `cache_write_tokens` sau 3 lượt cách 10 phút).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-TIEN-01 | `cong_token(1000,200,5000,0)` khi ngày chưa có dòng | tự tạo dòng, `model_calls` giữ 0 | ✅ 04/09 |
| TS-TIEN-02 | `cong_token(300,100,0,5000)` tiếp | CỘNG DỒN: in=1300 out=300 nạp=5000 đọc=5000 | ✅ 04/09 |
| TS-TIEN-03 | `cong_token(null,null,null,null)` | `coalesce` về 0, dòng không đổi | ✅ 04/09 |
| TS-TIEN-04 | `bump_model_quota(1000)` SAU `cong_token` | calls 0→1 trên CÙNG dòng, số chữ nguyên — `insert … on conflict`, không `update` thuần | ✅ 04/09 |
| TS-TIEN-05 | `anon` đọc `bot_usage` | chặn ở tầng quyền | ✅ 04/09 |
| TS-TIEN-06 | `authenticated` không trong `admins` | RLS lọc còn 0 dòng | ✅ 04/09 |
| TS-TIEN-07 | `authenticated` trong `admins` | thấy đủ dòng | ✅ 04/09 (3 dòng) |

### TS-CHUONG — chuông báo hết tiền tài khoản AI (FR-168)
Cùng khuôn TS-TIEN; đối chiếu sau: `bot_errors` về số cũ, 0 dòng `HET TIEN API`. Luật rút ra: mệnh đề `or` để lọc bỏ phải bọc `coalesce` mọi cột cho phép NULL; ca âm tính quan trọng ngang ca dương tính.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-CHUONG-01 | ghi lỗi `Your credit balance is too low…` | chuông kêu, đúng 1 dòng nguồn `HET TIEN API` | ✅ 04/09 |
| TS-CHUONG-02 | ghi thêm lỗi hết tiền trong cùng 6 giờ | vẫn 1 dòng — van hãm nhịp | ✅ 04/09 |
| TS-CHUONG-03 | ghi thẳng một dòng nguồn `HET TIEN API` | không tự soi mình, không đệ quy | ✅ 04/09 |
| TS-CHUONG-04 | sau khi chuông kêu, soi `reminders` | 0 — cố ý không đẩy qua cầu nối | ✅ 04/09 |
| TS-CHUONG-05 | nội dung dòng chuông | mở đầu "🔴 BỘ NÃO ĐANG CÂM — HẾT TIỀN TÀI KHOẢN AI", có đường dẫn nạp tiền | ✅ 04/09 |
| TS-CHUONG-06 | ÂM TÍNH: `Overloaded`, `Unterminated string`, `connection reset`, hai cái `status_code` RỖNG | chuông im (`NULL` trong chuỗi `or` làm hàm rơi xuống nhánh kêu) | ✅ 04/09 (vá 20260901c) |
| TS-CHUONG-07 | HTTP 402, nội dung không khớp mẫu chữ | chuông kêu | ✅ 04/09 |

### TS-VAI — bóc dữ liệu theo bốn vai người nhắn (FR-159, FR-170)
Tầng regex: `node bot/tests/fr159-bon-vai.mjs` (65 ca: chủ nhà ở lại nhánh bán, hỏi mua rẽ nhánh mua, người lạ mở/không mở hồ sơ bán, khoảng giá "có ÔM căn giá X không", nhãn chính chủ/môi giới). Tầng DB: RPC `mo_ho_so_nguoi_ban(zalo, nhãn default ccrb)` (`20260901d`), cuộn lại, 0 dòng `test-fr159-%` sót. Trọn luồng người lạ → câu hỏi vai → hồ sơ bán → câu rao: kiểm ở TS-E2E.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-VAI-01 | Zalo id lạ | tạo đúng 1 dòng, `seller_type = unknown` | ✅ 02/09 |
| TS-VAI-02 | gọi lần hai cùng id (race) | CÙNG id, không 23505 | ✅ 02/09 |
| TS-VAI-03 | người đã có tên gọi lại | trả đúng tên cũ, không xoá | ✅ 02/09 |
| TS-VAI-04 | vai `anon` gọi | chặn | ✅ 02/09 |
| TS-VAI-05 | vai `authenticated` gọi | chặn | ✅ 02/09 |
| TS-VAI-06 | mở với nhãn `nmg` | dòng mới mang `nmg` | ✅ 02/09 |
| TS-VAI-07 | mở không truyền nhãn | mặc định `ccrb` | ✅ 02/09 |
| TS-VAI-08 | hồ sơ tạo tay còn `unknown`, gọi lại với `ccrb` | nâng thành `ccrb` | ✅ 02/09 |
| TS-VAI-09 | nhãn đã `ccrb`, gọi lại với `nmg` | không ghi đè — lời tự xưng không lật nhãn admin | ✅ 02/09 |
| TS-VAI-10 | `anon` gọi chữ ký mới | chặn | ✅ 02/09 |
| TS-VAI-11 | `authenticated` gọi chữ ký mới | chặn | ✅ 02/09 |
| TS-VAI-12 | `anon` đọc `sellers` | 0 dòng | ✅ 02/09 |
| TS-VAI-13 | đăng nhập không phải admin đọc `sellers` | 0 dòng | ✅ 02/09 |
| TS-VAI-14 | đăng nhập không phải admin đọc `reminders` | 0 dòng | ✅ 02/09 |
| TS-VAI-15 | admin đọc `sellers` | thấy đủ | ✅ 02/09 (3) |
| TS-VAI-16 | admin đọc `reminders` đang chờ | thấy | ✅ 02/09 (93) |
| TS-VAI-17 | admin update `sellers.seller_type` | được | ✅ 02/09 |
| TS-VAI-18 | admin update `reminders.status` | được | ✅ 02/09 |

### TS-E2E — chạy `chat-reply` THẬT trong Node, Supabase + model giả lập
`bun build` đóng gói `chat-reply/index.ts` (Deno) thành file Node, thay `npm:` bằng gói thật (`zod`, `@anthropic-ai/sdk`) và gói giả (`mock-supabase.mjs` DB trong bộ nhớ, `mock-anthropic.mjs` model theo kịch bản). Không Deno, không DB thật, ~1 giây: `cd bot/tests/e2e && bun install && bash chay.sh` (`chay.sh` tự đóng gói lại — chạy `run.mjs` trực tiếp là chạy bundle cũ). Kịch bản chia bốn vai + bất biến chéo (nhường lượt, model hỏng, ảnh trần, mã từ web), khẳng định trên DB giả hoặc PROMPT thật gửi model. Giới hạn: DB giả chép NGHĨA của RPC/trigger, RPC thật đổi thì bộ này không tự biết — tầng DB kiểm bằng TS-SEC3/TS-TIEN/TS-CHUONG. Kết quả mới nhất: **160/160** (05/09). Từ 04/09 thêm bốn nhóm: `CỔNG-1…5` (cổng vào fail-closed), `SEC-*` (chữ ký, quyền gọi), `ĐUA-1…4` (hai lượt chạy chồng nhau — mock có móc trễ truy vấn `__treTruyVan` để dựng được cảnh interleave thật), `TRÙNG-1…10` (`claim_inbound` đủ 5 nhánh). `webhook.mjs` (44 ca) và `cong-thieu-bi-mat.mjs` (4 ca) là hai tiến trình riêng trong cùng `chay.sh` — xem §10.7.0.

**Mốc thời gian trong mock phải DUY NHẤT** (bắt 08/09/2026). `mock-supabase.mjs`
lấy `new Date().toISOString()` làm `created_at` — chỉ có mili giây. Ba câu hỏi chờ
mở liên tiếp rơi trọn trong một mili giây là chuyện thường; khi đó
`order("created_at", { ascending: false })` **hoà**, `Array.sort` ổn định giữ
nguyên thứ tự chèn, nên `ds[0]` hoá ra câu **cũ nhất** trong nhóm hoà thay vì mới
nhất — `chat-reply` bốc nhầm câu đang treo và ca **G5 đỏ chừng 1/6 lượt chạy**.
Postgres lưu timestamp tới micro giây nên không hoà; mock nay có bộ đếm đơn điệu
cho khớp. Bài học chung: **mock lệch bản thật ở chỗ nào thì bộ e2e đo sai ở chỗ
đó**, và triệu chứng ra ngoài dưới dạng "test chập chờn" chứ không phải "test sai".

### TS-NHAC — tin nhắc đi ra Zalo, và vòng tự nuôi của còi (08/09/2026)
Sinh ra từ ảnh Zalo admin của chủ dự án. Hai lớp: chữ (`bot/tests/tin-nhac.mjs`,
offline) và hành vi DB (chạy tay, bọc `do … raise exception` để rollback).

| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-NHAC-01 | `bun bot/tests/tin-nhac.mjs` | 22/22: "💬 …" (câu hỏi bù ask-seller) gửi nguyên văn; tin có dấu hiệu đầu (🩺 🆕 ❓ ✏️) gửi nguyên; CTV vẫn có tiền tố + đuôi; chính chủ giọng CSKH; `report` nguyên văn | ✅ 08/09 |
| TS-NHAC-02 | chèn `info_requests(source='seller_flow', assignee='seller')` | **0** dòng `reminders` — vòng drip không dội tin cho chủ nhà | ✅ 08/09 (rollback) |
| TS-NHAC-03 | chèn `info_requests(source='buyer_ask', assignee='seller')` | 1 dòng, ghi chú đọc "cần bổ sung: **diện tích đất**", không phải `dien_tich_dat` | ✅ 08/09 (rollback) |
| TS-NHAC-04 | `update info_requests set status='answered'` | tin nhắc escalation cùng căn + cùng nhãn chuyển `cancelled` | ⏭ chưa chạy |
| TS-NHAC-05 | ack một reminder không gắn seller/ctv qua `escalation-feed` | **không** thêm dòng `bot_errors` nào — cắt vòng tự nuôi | ⏭ chờ deploy |

**Vòng tự nuôi của còi báo lỗi** (bắt 08/09/2026): `bot_health_tick` mỗi giờ đếm
`bot_errors` trong một giờ qua, có lỗi thì đẻ một reminder 🩺 gửi Zalo admin.
Bridge gửi xong gọi `ack`, rơi vào nhánh "không học được uid admin (SEC-03)" —
nhánh ĐÚNG THEO THIẾT KẾ — nhưng nhánh đó lại `log_loi`. Giờ sau đếm được đúng
dòng vừa ghi, lại đẻ tin. Sổ lỗi 07/09 có đúng một dòng `escalation-feed admin
uid` mỗi giờ có tin 🩺 được gửi, từ 05:00 tới 10:00 UTC. **Bài học: đường đi
đúng thiết kế không được ghi vào sổ lỗi — sổ lỗi là đầu vào của còi.**

### TS-TOIUU — đếm vòng đi về DB và bất biến tối ưu (FR-171)
Cùng bộ e2e; mock ghi mọi truy vấn vào `db().log`. Ngưỡng đặt bằng số đo SAU khi sửa — ai thêm truy vấn vào đường nóng là đỏ. Đo build: `bun install` 4,4 s vs `npm` 20,1 s; `next build` ~34 s ở cả hai.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-TOIUU-01 | người lạ nhắn câu mập mờ → bot hỏi vai | ≤ 11 truy vấn, 0 lượt model | ✅ 04/09 (v43: 18 → 11) |
| TS-TOIUU-02 | người mua lượt đầu (chưa hồ sơ) | ≤ 17 truy vấn | ✅ 04/09 (20 → 17) |
| TS-TOIUU-03 | người mua đã có hồ sơ, hỏi tiếp | ≤ 16 truy vấn | ✅ 04/09 (24 → 16) |
| TS-TOIUU-04 | khách hỏi một căn rồi im | follow-up qua RPC `tao_followup`, có `reminders` kind `followup` | ✅ 04/09 (3 vòng → 1 RPC) |
| TS-TOIUU-05 | ba lượt liên tiếp trong 60 s | `bot_prompts` đọc ≤ 1 lần (nhớ tạm module) | ✅ 04/09 |
| TS-TOIUU-06 | bot trả 2–3 bong bóng | vào `messages` bằng MỘT INSERT mảng | ✅ 04/09 |
| TS-TOIUU-07 | người bán trả lời câu hỏi chờ | ≤ 15 truy vấn, `role = seller` | ✅ 04/09 (21 → 15) |
| TS-TOIUU-08 | mọi kịch bản | không còn UPDATE `conversations` chỉ để ghi `last_message_at` | ✅ 04/09 |
| TS-TOIUU-09 | mọi kịch bản | hội thoại có tin thì `last_message_at` đã được trigger (giả) đẩy — kiểm chính mock | ✅ 04/09 |
| TS-TOIUU-10 | người mua lượt đầu, chưa đủ khu vực + giá | không `select listings` | ✅ 04/09 |

### TS-HOICHU — khách hỏi → báo admin + hỏi chủ → chủ trả lời → báo lại khách (FR-140 b/c)
DB thật trong một giao dịch rồi rollback. Từ 03/09 FR-173 đổi đường `buyer_ask` (giao CTV, admin không bị báo mỗi câu) nên 01 và 03 lỗi thời — bản mới ở TS-CTV; 02 vẫn đúng.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-HOICHU-01 | chèn `buyer_ask`, tin có chủ trên Zalo | HAI `reminders` `escalation`: một gắn `seller_id`, một đi đường admin "❓ Khách hỏi căn #…" | ✅ 02/09 · lỗi thời từ 03/09 (xem TS-CTV-01/02) |
| TS-HOICHU-02 | `info_requests` → `answered` | thêm `followup` gắn `buyer_id` "chủ nhà vừa trả lời câu khách hỏi về #…"; nhắc im lặng cùng căn bị huỷ | ✅ 02/09 |
| TS-HOICHU-03 | `assignee` sau định tuyến | `seller`; nguồn giữ `buyer_ask` | ✅ 02/09 · lỗi thời từ 03/09 |

### TS-CTV — câu khách hỏi về CTV; CTV chậm → admin đỡ khách; hạng CTV (FR-173)
DB thật `begin … rollback` (`20260903a`, `20260903b` khoá hai hàm khỏi REST; `ctv_ranks` bị advisor báo "security definer view" — cố ý, xem `09`). Phần chat-reply: e2e CTV-01…04 (CTV nhắn `#mã: câu trả lời` → `answered` + fact nguồn `ctv`, 0 lượt model; mã lạ → "Em không thấy tin"; người lạ nhắn `#mã` → tra `nguoi_noi_bo` một lượt rồi đi nhánh mua) ✅ 04/09.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-CTV-01 | chèn `buyer_ask` cho tin có chủ trên Zalo, có một CTV `active` | `assignee = ctv`, `ctv_id` gán, `sla_due_at = now() + 120 phút`; không giao chủ nhà | ✅ 03/09 |
| TS-CTV-02 | dòng nhắc sinh ra | MỘT `escalation` gắn `ctv_id` (mẫu `#mã: câu trả lời` trong 120 phút); 0 dòng đường admin | ✅ 03/09 |
| TS-CTV-03 | lùi `sla_due_at` về quá khứ, `info_request_sla_tick()` hai lần | lần 1 trả 1 + một dòng admin "⏰ CTV … chưa trả lời … Admin đỡ khách", `sla_missed_at` đánh dấu; lần 2 trả 0 | ✅ 03/09 |
| TS-CTV-04 | `nguoi_noi_bo('<zalo CTV>')` / `nguoi_noi_bo('nguoi-la')` | (`ctv`, tên) / 0 dòng | ✅ 03/09 |
| TS-CTV-05 | `ghi_fact_listing(…, 'ctv')` rồi `info_requests → answered` | `listing_facts.source = ctv`, `bac_nguon('ctv') = 2`; trigger FR-140 c sinh `followup` cho khách | ✅ 03/09 |
| TS-CTV-06 | view `ctv_ranks` (claims `service_role`): 4 câu 30 ngày, 3 đúng hạn, 1 trễ | `tong=4 tra_loi=3 dung_han=3 tre=1 ty_le=0.75 rank=bac`; vai `postgres` không jwt → 0 dòng | ✅ 03/09 |

### TS-DIABAN — địa bàn mở: quận/huyện từ câu rao, không ghi cứng Quận 5 (FR-174 đợt 1)
Ba ca e2e + một ca DB thật (`do … raise`). Chưa kiểm trên Zalo thật: `nudge` v23 soạn tin báo lại khách.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-DIABAN-01 | e2e: chính chủ rao "bán nhà Bến Lức Long An 2 tỷ 80m2" | `district = "Bến Lức, Long An"` | ✅ 04/09 |
| TS-DIABAN-02 | e2e: "bán nhà P4 giá 5 tỷ 8 50m2" (không nói quận) | `district = "Quận 5"` (mặc định cụm khởi điểm), `ward = Phường 4` | ✅ 04/09 |
| TS-DIABAN-03 | e2e: "bán nhà Tân Bình hẻm 6m 6 tỷ 60m2" | `district = "Quận Tân Bình"` | ✅ 04/09 |
| TS-DIABAN-04 | `admin_dang_tin` (`20260903d`) với `district = "Đức Hoà, Long An"` và không có `district`, JWT admin giả | ghi "Đức Hoà, Long An" / mặc định "Quận 5" | ✅ 03/09 |

### TS-THONGSO — tin rao có cấu trúc: bóc từ mô tả, cột đã có thì không hỏi (FR-172)
DB thật qua MCP sau `20260902e` + `20260902f`, trên 173 tin (164 có mô tả). Ca 01–08 là số đo bao phủ (chốt chống hồi quy khi sửa regex — giảm là phải giải thích), 09–15 là hành vi. Giới hạn biết mà chưa vá: "306m² (4,2mx22m)" là tổng sàn (6 tin `dt_lech` > 35%); "cách mặt tiền 40m" đi cùng "nhà mặt tiền" trong cùng bài; chung cư gán nhầm `nha_pho` thì "tầng 25" ra null (dải 1–30 chặn), không ra sai.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-THONGSO-01 | ngang × dài từ "4x16m", "4m x 15m", "3m6 x 16", "ngang 4.6m dài 13.2m", "4*15" | ≥ 115/164 có `frontage_m` | ✅ 02/09 (ngang 121, dài 118, nở hậu 11) |
| TS-THONGSO-02 | số tầng "1 trệt 3 lầu" (=4), "5 tầng", "x 3T", "trệt, lầu" (=2), "nhà C4" (=1); chung cư "tầng 25" → `floor` | ≥ 135/164; 2 chung cư có `floor` | ✅ 02/09 (141; floor 2) |
| TS-THONGSO-03 | đường vào: "mặt tiền"/"MT"/"2MT" → MT; "HXH"/"xe hơi vô" → HXH; "HXT"/"xe tải" → HXT; "nhà hẻm … cách mặt tiền 20m" → HẺM; "hẻm hông 6m" không tính | ≥ 120/164 | ✅ 02/09 (126: MT 53, HXH 42, HXT 9) |
| TS-THONGSO-04 | hẻm rộng "hẻm 4m", "HXH 5.5m", "đường rộng 8m"; cách MT "cách mặt tiền 40m" | số hợp lý (1–40 m / 5–500 m) | ✅ 02/09 (hẻm 25, cách MT 19) |
| TS-THONGSO-05 | pháp lý "sổ hồng riêng/SHR" → `so_hong_rieng`; "sổ hồng/đỏ" → `so_hong`; "sổ chung"; "hoàn công"/"chưa hoàn công" → bool; "pháp lý rõ ràng" trơ → không đoán | ≥ 70/164 | ✅ 02/09 (75; hoàn công 37; quy hoạch 6) |
| TS-THONGSO-06 | PN/WC "4PN 5WC", "3 phòng ngủ 4 nhà vệ sinh", "Số phòng ngủ: 4" | PN không ghi đè giá trị đã có (79 giữ nguyên), WC ≥ 60 | ✅ 02/09 (PN 81, 0 lệch; WC 63) |
| TS-THONGSO-07 | tiện ích: thang máy, xe hơi vô nhà, căn góc, nội thất, năm xây, hướng (chỉ chữ la bàn sau "hướng"), TL, "đang cho thuê 20 triệu/tháng" (chỉ tin bán) | có, không bịa | ✅ 02/09 (thang máy 10, góc 21, nội thất 25, năm 4, hướng 7, TL 52, thuê 17) |
| TS-THONGSO-08 | `street` từ `location_raw`: "Số 1xx, Đường Trần Hưng Đạo" → "Trần Hưng Đạo"; "Hẻm xx/, Đường Hồ Thành Biên" → "Hồ Thành Biên"; "Phường 2, Quận 5" → null | mọi tin có tên đường trong địa chỉ | ✅ 02/09 (159/164; 5 tin chỉ ghi phường → null) |
| TS-THONGSO-09 | `listing_missing_facts` sau backfill | giảm rõ, KHÔNG về 0 | ✅ 02/09 (1.140 → 638; còn nhiều nhất hướng 152, quy hoạch 139, năm xây 137) |
| TS-THONGSO-10 | `price_per_m2_vnd` cho mọi tin có giá + diện tích; tin thuê theo tháng | 164/164 | ✅ 02/09 (thuê 70 tr/64m² → 1,1 tr/m²/tháng) |
| TS-THONGSO-11 | e2e THONGSO-01: dòng KHO gửi model | "4x12.5m · trệt + 2 lầu · 3WC · hẻm xe hơi 6m · sổ hồng riêng, hoàn công" | ✅ 04/09 |
| TS-THONGSO-12 | e2e THONGSO-02: khách gõ mã căn | khối "căn khách đang nhắc" mang "hẻm xe hơi 6m" + "sổ hồng riêng" | ✅ 04/09 |
| TS-THONGSO-13 | bậc nguồn khi fact chảy vào cột (`20260902g`): tin `boc_mo_ta` → (1) chủ `ket_cau` "trệt 3 lầu, 4 toilet"; (2) admin đặt hẻm 4 rồi chủ nói "hẻm 6m xe tải"; (3) `admin_form` "hẻm 3m" sau; (4) view thiếu | (1) floors 4, WC 4, `chu_xac_nhan`; (2) hẻm 6 `hem_xe_tai` — chủ đè admin (FR-164 a); (3) vẫn 6 — admin không đè chủ; (4) 0 câu thiếu | ✅ 02/09 (rollback, kho vẫn 173) |
| TS-THONGSO-14 | bộ 20 câu mẫu qua `boc_thong_so()`: "hẻm 2m xe máy, giấy tay"; "cách mặt tiền 30m, đang cho thuê 25tr/tháng"; "hầm trệt lửng 4 lầu, thang máy"; "nhà 4 tấm"/"2 tấm rưỡi"; "60 m 2, hẻm 2.5m"; "hẻm 2 xẹt"; chung cư "tầng 5 lầu"; cấp 4 "được xây 3 tấm" | mọi khoá đúng, không bịa | ✅ 03/09 20/20 (vá 20260903c: hẻm 2m, ngang 30 m, `p_type` NULL, "tấm") |
| TS-THONGSO-15 | fact `question` chữ tự do → cột (`ap_thong_so`): (A) CTV "pháp lý" → "sổ hồng riêng, hoàn công"; (B) "hẻm mấy mét" → "hẻm 4m xe hơi"; (C) chủ `so_phong_ngu` "3"; (D) CTV `bo_sung` "sổ hồng chung, 5PN" SAU chủ; (E) chủ "sổ hồng chung"; (F) "còn bán, bớt được chút" | (A) SHR + hoàn công bậc admin; (B) hẻm 4 HXH; (C) 3 PN `chu_xac_nhan`; (D) không đè; (E) đè được; (F) không đụng cột | ✅ 03/09 (rollback) |

### TS-SEO — nền SEO: trang tag SSG, sitemap, robots, canonical, JSON-LD (FR-12/17, NFR-09)
Dựng theo IA §4.4 sau nghiệm thu 04/09 (OPEN-44). 01–04 chạy trong sandbox, 05–06 cần Vercel. Trang tag dùng cùng luật lọc với `/mua-ban`; `revalidate = 3600` nhưng bảng build in `5m` vì `coverByCode` (unstable_cache 300 s) — cố ý.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-SEO-01 | `bun run build`, bảng route | `/[tag]` là `●` đủ số tag của `lib/tags.ts`; `/sitemap.xml`, `/robots.txt` có; `/nha-dat/[code]` vẫn `●` | ✅ 04/09 (83 trang tĩnh: 17 + 64 tag + 2) |
| TS-SEO-02 | `bun -e 'import {TAG_DEFS} from "./lib/tags.ts"; …'` | slug không dấu, chữ thường, gạch nối, `ty` không `tỉ`, duy nhất; keyword hiển thị giữ "tỉ" | ✅ 04/09 (64 slug duy nhất) |
| TS-SEO-03 | `relatedTags(t)` | 6–8 tag, không chứa chính nó, ưu tiên cùng giao dịch + loại + khu | ✅ 04/09 |
| TS-SEO-04 | `/ban-nha-hem-xe-hoi-quan-5` trên `next start` | H1 = keyword, mô tả 80–120 từ, lưới lọc `access_type in (mat_tien, hem_xe_tai, hem_xe_hoi)`, 8 tag liên quan; `/abc-xyz` → 404 | ⏭ sandbox không tới Supabase (lưới rỗng → hộp Zalo, đúng luật) |
| TS-SEO-05 | `curl -s https://nhadat-cc.vercel.app/sitemap.xml \| grep -c '<loc>'` | ≥ 8 tĩnh + 64 tag + số tin lên kệ (~165) | ⏭ chờ deploy |
| TS-SEO-06 | trang tin: `application/ld+json` + canonical + OG | một `RealEstateListing`, `identifier` = mã, `offers.price` = `price_vnd`, `address` chỉ tới phường (FR-104); canonical = URL tin; OG = ảnh thật nếu có | ⏭ chờ deploy; kiểm tĩnh `jsonLd()` không dùng `location_raw` |

### TS-ADM2 — admin buyer side (FR-71/74/75/76/77/78/80)
Migration `20260904c_admin_buyer_side.sql` + thẻ mới `app/admin/page.tsx`. 01–09 là MỘT khối `do … raise exception 'KQ: …'` (chép ở cuối migration, chạy RIÊNG sau khi áp): dựng buyer/hội thoại/câu hỏi/lịch xem bằng vai chủ, rồi `authenticated` với email admin lấy từ bảng `admins`, rồi `anon`. Chạy lại sau MỌI migration đụng RLS sáu bảng này. Cố ý chưa làm: bảng theo hội thoại FR-71 (cần FR-72), lọc thời gian FR-74, email FR-81, nhãn "tiêu cực" FR-77 (`needs_human` là proxy [giả định BA]).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-ADM2-01 | admin đọc `info_requests` dòng thử (`buyer_ask`, trigger FR-173 chạy bình thường) | 1 dòng | ✅ 04/09 |
| TS-ADM2-02 | admin đọc `viewings` của buyer thử | 1 dòng | ✅ 04/09 |
| TS-ADM2-03 | admin đọc `buyers` — policy mở cả bảng, web chỉ chọn `id, name, zalo_user_id, preferences, last_contact_at, created_at` | 1 dòng; `page.tsx` không có chuỗi `phone` trong select | ✅ 04/09 |
| TS-ADM2-04 | admin đọc `messages` của hội thoại thử | 1 dòng | ✅ 04/09 |
| TS-ADM2-05 | admin đọc `ctvs` (web chỉ chọn `name` qua join) | = số CTV thật | ✅ 04/09 (2) |
| TS-ADM2-06 | admin đọc view `khach_can_nguoi_that` lọc `conversation_id` thử | 1 dòng, `ten` = tên buyer, `tin_khach_cuoi` = tin vừa chèn | ✅ 04/09 |
| TS-ADM2-07 | admin đọc view `hoi_thoai_thong_ke` | đủ 30 dòng kể cả ngày trống; hôm nay (giờ VN) `tin_khach` = 1 | ✅ 04/09 |
| TS-ADM2-08 | anon đếm `info_requests`, `buyers`, `conversations` (GRANT có, policy không) | 0 / 0 / 0 | ✅ 04/09 |
| TS-ADM2-09 | anon `select` hai view | `42501` — đã revoke, không phải "0 dòng" | ✅ 04/09 |
| TS-ADM2-10 | sau rollback: dữ liệu thử = 0; hai view vai `postgres` không JWT → 0; `pg_policies` đủ 6 `*_admin_read`; grant view chỉ `authenticated`/`service_role` SELECT | như kỳ vọng | ✅ 04/09 (`ctv_ranks` cũ còn INSERT/UPDATE thừa, vô hại) |
| TS-ADM2-11 | UI: đăng nhập admin thật mở `/admin` — năm thẻ mới hiện, không dòng "Không đọc được"; truy vấn đợt đầu bắn song song (FR-171 j); câu `pending` quá `sla_due_at` chữ cam; tìm khách không lộ SĐT, "Mở Zalo" chỉ ở dòng có uid | như mô tả | ⏭ cần trình duyệt; `tsc --noEmit` + `bun run build` xanh 04/09 |
| TS-ADM2-12 | UI FR-80 + CSV: > 20 tin `cho_thong_tin` → "trang 1/2 · N mục", Trước/Sau, kẹp về trang 1; "Tải CSV" → `hoi-thoai-30-ngay-<ngày>.csv` BOM UTF-8, 31 dòng | như mô tả | ⏭ cần trình duyệt |

### TS-MATCH — tin mới khớp tiêu chí + cảm nhận sau xem + bản đồ (FR-64/56/54)
Migration `20260904d` + `nudge` v24. 01–07 một khối `do … raise exception` trên DB thật; 08–09 trên `nudge` đang deploy với dữ liệu `TEST-` commit rồi xoá, `dry_run: true`. Hồ sơ khách thử `{area:"phường 8 quận 5", budget:"5 tỷ", deal:"ban"}`. Lưu ý: trigger FR-64 khớp cả khách THẬT có hồ sơ "Quận 5, tầm 5 tỷ" — từ giờ mỗi tin thật lên kệ là có khách được nhắn ở nhịp cron kế; van 1 tin/khách/24h đổi ở `bao_tin_moi_khop`, không ở `nudge`.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-MATCH-01 | tin P8 Q5, 5,2 tỷ, 45,5 m², mặt tiền → `dang_ban` | khách x đúng 1 `match`, note "#mã · Phường 8, Quận 5 · 5.2 tỷ · 45.5m2 · mặt tiền"; khách y (không Zalo) 0 | ✅ 04/09 (sửa `to_char … FM`: "40m2" không thành "4m2") |
| TS-MATCH-02 | tin P3 Q5, 5,2 tỷ | x (nêu P8) 0; z (`area:"Quận 5"`, không `deal`) 1 — quận chỉ là dự phòng; w (im 40 ngày) 0 | ✅ 04/09 |
| TS-MATCH-03 | tin P8, 9 tỷ | 0 (5 tỷ ngoài dải 0,7×–1,15×) | ✅ 04/09 |
| TS-MATCH-04 | tin thứ hai P8, 5 tỷ, cùng ngày | 0 (van 1 tin/khách/24h); z đã có `match` cũng không nhận thêm | ✅ 04/09 |
| TS-MATCH-05 | (a) tin sang `dang_quan_tam` rồi về `dang_ban`; (b) tin thuê P8 5 tỷ; (c) tin `cho_thong_tin` không giá rồi `update … set price_raw` | (a) không sinh thêm; (b) 0; (c) 1 — BEFORE trigger tự lật `dang_ban` (FR-144) | ✅ 04/09 |
| TS-MATCH-06 | `viewings.slot` = +2h, nhắc `viewing` → `sent` | 1 `feedback`, `listing_id` = tin buổi xem, `due_at` = slot + 4h; đánh `sent` lần nữa không đúp | ✅ 04/09 |
| TS-MATCH-07 | `anon` gọi `bao_tin_moi_khop` | `has_function_privilege = false` | ✅ 04/09 |
| TS-MATCH-08 | `nudge` v24 `dry_run` với 3 nhắc `match`/`viewing` (tin có lat/lng)/`feedback` | 200; `match` và `feedback` mẫu cố định không gọi model; `viewing` có "Bản đồ: https://maps.google.com/?q=lat,lng"; `sent = none`, không dòng mới, không `bot_errors` | ✅ 04/09 (done=10, 0 lỗi, dọn sót 0) |
| TS-MATCH-09 | deploy v24: bun bundle → `deploy_edge_function` (`verify_jwt=false`) → `get_edge_function` kéo ngược → so byte | trùng byte | ✅ 04/09 (19.067 byte, SHA-256 `35152a33…`) |

### TS-WEB2 — search NL, upload ảnh, dự án, danh sách riêng, giấy tờ
Luồng WEB (FR-01/02/03/04/08/09/10, FR-70/73 web, FR-96, FR-99 web, FR-100, FR-117, NFR-06) + `20260904g`. **P** = policy/RPC trên DB thật (khối `do … raise` cuối migration, chạy lại sau mọi lần đụng RLS `storage.objects`/`listing_media`/`curated_lists`; sau khối mọi bảng thử = 0); **S** = bóc câu qua `next start` + curl; **W** = trang web. Sandbox chặn host Supabase nên ca cần DB từ web ⏭ (trên Vercel chạy như trang cũ).
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-WEB2-P01 | người bán đăng nhập (`sellers.auth_user_id`) insert `storage.objects` `listing-public` `<uuid tin mình>/a.jpg` | được | ✅ 04/09 |
| TS-WEB2-P02 | cùng người, `<uuid tin người khác>/b.jpg` | chặn | ✅ 04/09 (42501) |
| TS-WEB2-P03 | cùng người, bucket `listing-private` | chặn | ✅ 04/09 (42501) |
| TS-WEB2-P04 | người bán insert `listing_media` (public) tin mình, đọc lại | được, đọc = 1 | ✅ 04/09 |
| TS-WEB2-P05 | người bán insert `listing_media` tin người khác | chặn | ✅ 04/09 (42501) |
| TS-WEB2-P06 | người bán gọi `tao_danh_sach` | chặn | ✅ 04/09 (42501) |
| TS-WEB2-P07 | admin (JWT email trong `admins`): insert object public mọi đường dẫn + private + SELECT object private + `listing_media` `so_do` private | được cả bốn | ✅ 04/09 |
| TS-WEB2-P08 | admin `tao_danh_sach([A, B], 'TS-WEB2 ds')`; rồi mã lạ | `{token 24 hex, n=2}`; mã lạ → "Khong co tin" | ✅ 04/09 |
| TS-WEB2-P09 | anon `doc_danh_sach(token)`; token sai | có `listings`, không `buyer_id`; NULL | ✅ 04/09 (n=1: tin B thiếu DT nên FR-164 giữ nháp — đúng luật) |
| TS-WEB2-P10 | anon `select curated_lists`; insert `storage.objects`; đếm `listing_media` private | chặn; chặn; 0 | ✅ 04/09 |
| TS-WEB2-S01 | `GET /api/search?q=tìm mua nhà phố HXH 8 tỉ ở Q5` | ban, nhà, HXH, 6,8–9,2 tỉ, Quận 5; title "Mua nhà phố hẻm xe hơi khoảng 8 tỉ, Quận 5"; url `/mua-ban?gmin&gmax&vao=hxh&loai&q` | ✅ 04/09 |
| TS-WEB2-S02 | câu S01 không dấu | y hệt S01 | ✅ 04/09 |
| TS-WEB2-S03 | `thuê căn hộ 2 phòng ngủ dưới 15tr/tháng phường 4` | cho_thue, chung_cu, P4, max 15 tr, 2 PN; url `/cho-thue?phuong&gmax=15000000&pn=2&loai=chung_cu&q` | ✅ 04/09 |
| TS-WEB2-S04 | `ban nha mat tien duong Tran Binh Trong quan 5 duoi 5 ty` | mt, street "Tran Binh Trong", max 5 tỉ; `duong=` → ilike `street` | ✅ 04/09 |
| TS-WEB2-S05 | `đất Bình Chánh 5-8 tỷ gần chợ Bình Điền` | dat, `quan=` Bình Chánh, 5–8 tỉ, `moc=` "chợ Bình Điền" giữ dấu | ✅ 04/09 |
| TS-WEB2-S06 | `cho em hỏi giá nhà ở đây thế nào` (không tín hiệu mạnh) | `empty: true`, url `/mua-ban?q=`; hộp "Câu này tụi em chưa hiểu hết — nhắn Zalo" (loại BĐS một mình chưa đủ) | ✅ 04/09 |
| TS-WEB2-S07 | `ban nha hxh phuong 5` / `cần thuê mặt bằng Q5` | khớp tag → `/ban-nha-hem-xe-hoi-phuong-5-quan-5` / `/cho-thue-mat-bang-quan-5` | ✅ 04/09 |
| TS-WEB2-S08 | `?go=1` với S01 và S06 | 302 → url tương ứng | ✅ 04/09 |
| TS-WEB2-S09 | `POST /api/listing/parse` "Bán nhà HXH xe tải quay đầu, gần ngã tư Trần Bình Trọng, 4x16 một trệt hai lầu, 3PN, sổ hồng riêng, phường 5 Q5, 9 tỉ bớt lộc" | ban, nha_pho, P5/Q5, mốc "ngã tư Trần Bình Trọng", 3 PN, `price_raw` "9 tỉ" → 9e9, HXH, 4×16, area 64 (`needs_review`), floors 3, SHR, negotiable | ✅ 04/09 (sửa: từ dừng "tư", price_raw dính, "một trệt hai lầu") |
| TS-WEB2-S10 | `POST /api/search {"q":"nha 3pn q5"}`; `GET ?text=cho thue mat bang duong nguyen trai q5 dt 60m2 15tr/thang` | 200 JSON; mat_bang + street + 60 m² + 15 tr/tháng, không đọc "60 m2" thành 60 triệu | ✅ 04/09 |
| TS-WEB2-W01 | `/` có 3 khối FR-01 + "Hỏi bất kỳ, có tức thì" + ba vế FR-04 | có | ✅ 04/09 |
| TS-WEB2-W02 | `/` form `action="/api/search"` + placeholder "tìm mua nhà phố HXH 8 tỉ ở Q5" | có, không cần JS | ✅ 04/09 |
| TS-WEB2-W03 | `/mua-ban?q=…` | `<meta name="robots" content="noindex, follow">` + dải "Tìm thấy N tin theo yêu cầu: …" | ✅ meta · ⏭ dải (DB) |
| TS-WEB2-W04 | `/mua-ban?q=cho+em+hoi+gia` | hộp Zalo "Câu này tụi em chưa hiểu hết…" | ✅ 04/09 |
| TS-WEB2-W05 | trang tin: `WardMap` chỉ vẽ khi phường có toạ độ, lat/lng xoá trước khi vào `MapView` | kiểm tĩnh (tsc) | ✅ tsc · ⏭ trình duyệt |
| TS-WEB2-W06 | `/admin` thẻ BĐS hot / Độ trễ bot khi view chưa có | thẻ ghi "chưa có dữ liệu", thẻ khác vẫn tải (`hot.error`/`tre.error` tách `setLoi`) | ✅ tĩnh · ⏭ trình duyệt |
| TS-WEB2-W07 | `UploadAnh`: up file → ghi dòng; ghi hỏng → remove file; lỗi từng tấm ra UI | kiểm tĩnh | ✅ tsc · ⏭ trình duyệt (P01–P05 đã kiểm hàng rào) |
| TS-WEB2-W08 | trang tin dòng FR-99 | ẩn khi < 3 tin khác; tự loại chính tin | ✅ tĩnh `soSanhGia` · ⏭ DB (P1 có 23 tin có giá/m²) |
| TS-WEB2-W09 | `/ds/abcdefabcdefabcdefabcdef` | `<meta robots noindex, nofollow>`; trang "hết hạn" + Zalo, không 404 | ✅ meta · ⏭ nội dung (RPC) |
| TS-WEB2-W10 | `bun run build` | `/du-an/[slug]` ●, `/nha-dat/[code]` ●, `/[tag]` ●, `/ds/[token]` ƒ, `/api/*` ƒ | ✅ 04/09 (sandbox prerender 0 đường nha-dat/du-an vì host chặn) |
| TS-WEB2-W11 | `/admin` "Xem giấy tờ" → `createSignedUrl(path, 900)`; đường dẫn không in ra | kiểm tĩnh | ✅ tĩnh · ⏭ trình duyệt (P07 đã kiểm SELECT private) |
| TS-WEB2-W12 | `bunx tsc --noEmit` | sạch | ✅ 04/09 |
| TS-WEB2-W13 | `/robots.txt` chặn `/ds/`, `/api/`; `/sitemap.xml` có `/du-an/<slug>` | có | ✅ robots · ⏭ sitemap (DB) |

### TS-GIUCHAN — giữ chân 5 ngày, vòng đời, email (FR-60…65/70/72/73/81/103/108/110/52)
Migration `20260904f` + `nudge` v25 + cron `info-timeout-tick`, `stale-listing-tick`. 01–05 khối `do … raise exception` (uid `TEST-gc-*`); 06 một `net.http_post` thật tới ntfy; 07–08 trên `nudge` đang deploy, dữ liệu `TEST-GCN` commit rồi xoá, `dry_run: true`. Nên biết: câu `xac_nhan_lich` mở với `source='buyer_ask'` nên ĐẾM vào `ctv_ranks` [giả định BA]; FR-103 chỉ hỏi tin CÓ chủ (158 tin Excel không chủ không bao giờ được hỏi); `email_admin` với `admin_email` rỗng im hoàn toàn — chủ ý.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-GIUCHAN-01 | vòng đời một khách (FR-108/70/52/57/65/110/103): `mark_listing_interest` ×2 → `buyer_ask` → lịch xem → CTV `xac_nhan_lich` → nhắc `match` `sent` → `deals` → `da_chot` ×2 → `ghi_danh_gia(4)` rồi `(5)` → 3 câu hỏi cũ + `info_request_timeout_tick()` → tin cũ 31 ngày + `stale_listing_tick()` ×2 → giơ cờ + VOICE | interests 1; `property_events` 6 loại ×1; escalation lịch 1, không escalation mặc định; `confirmed` + followup; `sold` 1 có căn thay thế; rating 4 (5 không cộng); tick `{nhac_24h, het_han_seller, het_han_buyer_ask}` đúng; stale 1 rồi 0; `bot_errors` 0 | ✅ 04/09 đúng cả (timeout `{2,1,1}`; stale đi nhánh CTV vì chủ chưa có Zalo) |
| TS-GIUCHAN-02 | van FR-108: cùng tin `da_chot` lần hai | không thêm `sold` (index + van 24h) | ✅ 04/09 |
| TS-GIUCHAN-03 | FR-103 trần và lặp: `stale_listing_tick()` hai lần cùng ngày | lần 2 không hỏi lại tin vừa hỏi | ✅ 04/09 |
| TS-GIUCHAN-04 | ba view qua vai admin: 5 tin cách 10'/40'/5'/2h → `hoi_thoai_phien`; `interests` → `bds_hot`; 2 dòng ledger 1,2 s / 4,8 s → `bot_do_tre`; đọc `property_events` | 3 phiên `2/buyer, 2/buyer, 1/bot`; `bds_hot` 1 dòng/tin; `so_luot=2`, `p95≈4,6`; admin đọc được | ✅ 04/09 (`listing_views` chưa thử: FK `auth.users`, chưa có user auth) |
| TS-GIUCHAN-05 | anon: đọc 3 view, SELECT `property_events`, EXECUTE `ghi_danh_gia`/`can_cung_khu`/`mark_listing_interest`/`info_request_timeout_tick`/`canh_bao_ngoai` | tất cả chặn | ✅ 04/09 |
| TS-GIUCHAN-06 | ntfy email thật: `net.http_post` tới ntfy.sh với `email:` | 200, hoặc mã lỗi cho biết vì sao | ⚠️ 04/09 `400 40053 anonymous email sending is not allowed` — cần tài khoản + `NTFY_TOKEN` (đã mở đường đọc Vault; FR-81 / SRS-5.5 chờ chủ dự án) |
| TS-GIUCHAN-07 | deploy `nudge` v25: bun bundle → `\uXXXX` → UTF-8 → `deploy_edge_function` (`verify_jwt=false`) → `get_edge_function` → so byte | trùng byte | ✅ 04/09 (24.203 byte, SHA-256 `d7fb2323…`) |
| TS-GIUCHAN-08 | `nudge` v25 `dry_run` (secret từ Vault trong SQL): (a) kho thật; (b) `TEST-GCN`: 5 nhắc `sold`/`followup` chủ chưa phản hồi/`followup` lịch/`feedback`/`rating`; khách im 6,5 ngày; khách im 5,2 ngày có căn cuối | (a) 200, không `bot_errors`; (b) năm mẫu đúng chữ không gọi model; 6,5 ngày → `giu_ket_noi` "nhắn lại em một chữ thôi, kẻo Zalo tự ngắt"; 5,2 ngày → `can_cuoi` kèm `#mã`, `kho>0`; `sent=none` | ✅ 04/09 (a) done=7; (b) done=14, đúng cả, dọn sót 0 |

### TS-V48 — chat-reply v48 (FR-27/31/45/65/79/99/105/108/114/116)
Mười FR có tài liệu mà bot chưa làm (lộ ở §10.8): `chat-reply` v48 + `_shared/prompts.ts` (`human_chat_rules`, `buyer_fewshot` đồng bộ xuống `bot_prompts` bằng SQL sinh từ file). Chạy trong e2e (74 → 102 → 160 kịch bản), lần cuối trên nội dung kéo ngược sau deploy. Cố ý chưa làm (ghi ở `02` từng FR): hai thời điểm xin đánh giá còn lại FR-65; thẻ voice riêng `/admin` FR-79; FR-99 phía bán + nguồn giá ngoài (OPEN-10); chọn dự án ở `/raoban` FR-114; "tin chốt → báo mọi B" tầng DB; duyệt ảnh tay FR-105.
| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-V48-105a…c | fact chủ nhà có SĐT + "zalo 0903…" + "nhà số 12 Trần Hưng Đạo"; model trả lời có số | prompt gửi model không còn số, có "[liên hệ qua Zalo]", bỏ "số 12" giữ tên đường; bong bóng gửi khách không số; `location_raw` trong KHO giữ số nhà (OPEN-36) | ✅ 04/09 |
| TS-V48-105d | chính chủ trả lời câu chờ kèm SĐT | nhánh bán KHÔNG lọc, fact giữ số để CTV gọi | ✅ 04/09 |
| TS-V48-108a…c | khách nhắc căn; `ask_owner` một căn; overload thiếu (PGRST202) | `mark_listing_interest(p_codes, p_buyer_id)` + dòng `interests`; căn nhờ hỏi chủ cũng vào; overload thiếu → gọi bản cũ + `bot_errors`, khách vẫn có trả lời | ✅ 04/09 |
| TS-V48-45 | khối luật + few-shot | có "Trong khi chờ, anh/chị có câu hỏi gì khác về căn này không ạ?", `voice_request=true`, "giá TB phường", CĂN TƯƠNG TỰ, CHẤM SAO | ✅ 04/09 |
| TS-V48-31a | hỏi căn ĐÃ GỠ (P12, 9 tỷ, HXH); kho có P12 8 tỷ HXH / 12 tỷ / 7 tỷ MT | CĂN TƯƠNG TỰ có 8 + 7 tỷ (0,7–1,3×), không 12 tỷ, HXH trước; không lộ địa chỉ/giá căn đã gỡ | ✅ 04/09 |
| TS-V48-31b | bot vừa nói #0006; khách "còn căn nào giống giống vầy không" | căn gốc = #0006 từ lịch sử, tương tự có #0008 | ✅ 04/09 |
| TS-V48-27a…c | căn có 6 hình, khách xin hình; rồi "xem thêm" | 4 tấm đầu + "xem thêm hình không ạ?" + `photo_offset={code,n:4}`; "xem thêm" → 2 tấm kế, hết thì không hỏi, offset xoá | ✅ 04/09 |
| TS-V48-79a…d | người lạ "alo được không em, gọi cho anh đi"; lặp; model bật `voice_request`; model hỏng + không dấu | không hỏi vai; `need_human`; `reminders(escalation, 'VOICE: <uid>…')`; 24h không đẻ thêm; câu mẫu "gọi lại" khi model hỏng | ✅ 04/09 |
| TS-V48-65a…c | nhắc `feedback` `sent` 1h trước, "4 sao em"; 3 ngày trước, "3/5"; RPC thiếu | `ghi_danh_gia(buyer, tin buổi xem, 4)` + `rated:4`; quá 48h không ghi; RPC thiếu → `bot_errors`, khách vẫn có trả lời | ✅ 04/09 |
| TS-V48-116a…c | "căn A12-05 dự án Ny'ah còn không" (giữ chỗ, xác nhận 10 ngày trước); "căn B9-99"; "#BDS… còn không" (`con_ban` vừa xác nhận) | khối CĂN TRONG DỰ ÁN đúng căn, "đang giữ chỗ", "QUÁ 7 NGÀY" → ask_owner, không lộ căn khác; mã không có → nói thật; dòng căn nhắc mang dự án + "chủ xác nhận 0 ngày trước" | ✅ 04/09 |
| TS-V48-114 | rao "bán căn A12-05 dự án Ny'ah giá 6 tỷ 60m2"; rao không dự án (114b) | tin gắn `project_id` + `unit_code A12-05` + `unit_status con_ban` + `last_confirmed_at`; hàng lẻ → null | ✅ 04/09 |
| TS-V48-99a…c | hồ sơ P4 + tầm 6 tỷ, hỏi "#… giá vậy ok không"; lượt kế; chưa đủ hồ sơ | KHO kèm "giá TB phường 4 (bán): 116 tr/m² (1 tin)"; hai lượt ≤1 truy vấn (nhớ tạm 60 s theo `deal\|phường`, không nhớ kết quả rỗng); chưa đủ hồ sơ → không truy vấn | ✅ 04/09 |
| TS-V48-DEPLOY | bun bundle (`--minify-whitespace`, `\uXXXX` → UTF-8) → `deploy_edge_function` (`verify_jwt=false`) → `get_edge_function` → so byte | trùng 100% | ✅ 04/09 (92.388 byte, SHA-256 `6eb8de75…`; e2e trên bản kéo ngược 102/102) |
| TS-V48-PROMPTS | md5 `bot_prompts` ↔ hằng TS | trước ghi 8/8 khoá khớp (không đè sửa tay); sau ghi `human_chat_rules` `b4633cc2…`, `buyer_fewshot` `90f602df…` = TS | ✅ 04/09 |
| TS-V48-LIVE | `net.http_post` uid `TEST-e2e-v48`: "nhà 3PN phường 8 tầm 5 tỷ"; rồi "mua, nhà 3PN phường 8 tầm 5 tỷ" | 200 hỏi vai (không tốn model); 200 nhánh model: hồ sơ `{deal:ban, area:"Phường 8", budget:"tầm 5 tỷ", bedrooms:3}`, hai bong bóng, `bot_errors` 0; dọn sạch | ✅ 04/09 |

### TS-KYGUI — nhận ký gửi như môi giới giỏi (FR-176/177/178, 07/09/2026)
Ba tầng, ba cách chạy. **Tầng tiền định** (`fr176-…`, `fr177-…`) chạy offline, không
model, không DB — sửa luật khớp câu hay thứ tự hỏi thì phải chạy lại hai bộ này.
**Tầng luồng** (e2e `run.mjs`, nhóm `H`) chạy `chat-reply` thật với Supabase +
model giả. **Tầng DB** chạy trên DB thật sau khi áp `20260907h`. Không phủ: giọng
văn model sinh ra (không kiểm tự động được — đọc `so.hoi_thoai` bằng mắt sau mỗi
đợt), và cron `ask-seller` chưa biết gửi bản nháp (ghi ở FR-177).

| ID | Bài | Kỳ vọng | Kết quả mới nhất |
|---|---|---|---|
| TS-KYGUI-01 | `bun bot/tests/fr176-khop-cau-tra-loi.mjs` | 49/49: "Kêu chị nha" → `xung_ho`, "16m nha" khi hỏi hướng → `lech`, "5x16" → `khop` | ✅ 07/09 |
| TS-KYGUI-02 | `bun bot/tests/fr177-hoi-nhu-moi-gioi-gioi.mjs` | 99/99: `nhanDienFact` 23 ca, `chonCauKe` 8 ca, `laDongY` 22 ca, `laDuRoi` 23 ca, `laGap` 13 ca | ✅ 09/09 |
| TS-KYGUI-03 | e2e H1: rao "bán nhà hẻm trần bình trọng p4 giá 5 tỷ 8 60m2" | tin `can_chu_duyet = true`, **chưa** lên kệ, câu đầu là `do_rong_hem` (hết nhóm cơ bản) | ✅ 07/09 |
| TS-KYGUI-04 | e2e H2: trả lời "hẻm 4m xe hơi vào tận nhà" | ghi fact hẻm; câu kế là `ket_cau` (liên quan), KHÔNG nhảy sang pháp lý | ✅ 07/09 |
| TS-KYGUI-05 | e2e H3: đang hỏi kết cấu, chủ nhắn "sổ hồng riêng rồi em" | ghi fact `phap_ly` nguyên văn; câu `ket_cau` VẪN treo; bot hỏi lại | ✅ 07/09 |
| TS-KYGUI-06 | e2e H4: chủ nhắn "nhà nở hậu chút" | ghi nguyên văn vào fact `bo_sung`; câu hỏi gốc vẫn treo | ✅ 07/09 |
| TS-KYGUI-07 | e2e H5: trả nốt "3 lầu 4 phòng ngủ" | gửi BẢN NHÁP TIN, điểm ≥ 70, mở câu chờ `duyet_tin`, tin vẫn `cho_thong_tin`; bản nháp KHÔNG do model soạn | ✅ 07/09 |
| TS-KYGUI-08 | e2e H6: đang chờ duyệt, chủ nhắn "à giá 6 tỷ nha" | ghi giá mới rồi GỬI LẠI bản nháp với giá mới; câu duyệt vẫn treo | ✅ 07/09 |
| TS-KYGUI-09 | e2e H7: đang chờ duyệt, chủ hỏi "phí sao em?" | loại `hoi`, không đóng dấu duyệt, câu duyệt vẫn treo | ✅ 07/09 |
| TS-KYGUI-10 | e2e H8: chủ nhắn "ok đăng đi em" | `chu_duyet_at` có, tin sang `dang_ban`, bong bóng báo đã lên web | ✅ 07/09 |
| TS-KYGUI-11 | e2e H8b/c/d | KHÔNG bong bóng nào chứa `#BDS`; câu mẫu là câu người nói (không "kết cấu (số tầng, phòng)"); system prompt có few-shot ĐÚNG/SAI | ✅ 07/09 |
| TS-KYGUI-12 | e2e H9: tin nhập tay (`can_chu_duyet = false`) đủ giá + dt + phường | lên kệ theo luật cũ, KHÔNG đòi duyệt | ✅ 07/09 |
| TS-KYGUI-13 | DB: `select diem_tin(l) from listings l where code = 'BDS-Q5-0174'` | trả `{diem, chi_tiet, thieu[], co_anh}`; tin thiếu diện tích/giá/pháp lý → 28/100 | ✅ 07/09 |
| TS-KYGUI-14 | DB: đếm tin đang rao có điểm < 70 | 38/164 — nhưng tất cả `can_chu_duyet = false` nên KHÔNG bị kéo xuống `cho_thong_tin` | ✅ 07/09 |
| TS-KYGUI-15 | DB: `select fact_key, priority, nhom from listing_missing_facts` cho một tin `nha_pho` | cơ bản (1–9) trước chuyên môn (10–19); `huong`/`quy_hoach`/`nam_xay` ≥ 20 | ✅ 07/09 |
| TS-KYGUI-16 | DB: md5 `bot_prompts` ↔ hằng trong `_shared/prompts.ts` | 6/6 khớp (`tone_rules`, `human_chat_rules`, `seller_script_rules`, `seller_fewshot`, `cau_hoi_mau` = `CAU_HOI_MAU_TEXT`, `loi_chao` = `LOI_CHAO`) | ✅ 09/09 |
| TS-KYGUI-17 | Sau deploy `chat-reply`: nhắn thật một lượt rao qua Zalo, đọc `so.hoi_thoai` | mỗi tin dưới 30 từ, có khích lệ thật, không đọc mã tin, không đọc tên trường | ⏭ chờ deploy + bridge |
| TS-KYGUI-18 | e2e V1.3 (09/09): rao "bán nhà P4 giá 5 tỷ 8 50m2" (chưa nói đường/hẻm) | câu đầu là `vi_tri` (vị trí cụ thể, nhóm cơ bản); `boc_tach` có loại giao dịch/phường/giá thô/diện tích, KHÔNG có khoá null | ✅ 09/09 |
| TS-KYGUI-19 | e2e H1b: rao "bán nhà hẻm trần bình trọng p4…" | fact `vi_tri` = "hẻm trần bình trọng" → `location_raw`, không hỏi lại vị trí; câu đầu vẫn là hẻm rộng | ✅ 09/09 |
| TS-KYGUI-20 | e2e H8e/H8f: chủ gật bản nháp | bong bóng "Chúc mừng … X/100", cách thêm điểm, nhắc ảnh, hứa hỏi thêm; tin `dang_ban` vẫn còn câu thiếu trong view để cron hỏi bù | ✅ 09/09 |
| TS-KYGUI-21 | e2e H10/H10b/H10c: mở câu ảnh (mô phỏng cron) → chủ nhắn "đủ rồi em, đừng hỏi nữa" → chấm "8 điểm" | `chu_noi_du_at` có, câu treo đóng, điểm KHÔNG đổi, không gọi model; bong bóng 2 xin chấm điểm; "8 điểm" → fact `danh_gia` + `boc_tach`, cảm ơn tiền định, không hỏi lại | ✅ 09/09 |
| TS-KYGUI-22 | e2e H11/H12: rao "cần bán gấp nhà 123/4 an dương vương p9 …" / "… không gấp" | `gap` = true, `boc_tach.gap` = true, `location_raw` = "123/4 an dương vương"; "không gấp" → `gap` = false | ✅ 09/09 |
| TS-KYGUI-23 | DB sau `20260909a`: `select diem_tin(l) from listings l`; `select * from cron.job where jobname='seller-hoi-bu-tick'`; md5 `bot_prompts` ↔ TS | `chi_tiet.anh` + `so_anh` có; cron */5 1-13; `seller_fewshot` và `seller_script_rules` khớp TS | ✅ 09/09 — áp qua execute_sql + ghi sổ; cron */5 1-13; md5 40de5445… / 5ce10f4a… khớp; diem_tin tin thật 78/89/10 có `anh`, `so_anh`; chat-reply v52, ask-seller v10, escalation-feed v15, nudge v26 |
| TS-KYGUI-24 | e2e T1/T1b/T2 (FR-179): h-1 nhắn "hello" khi công tắc bật / h-2 khi tắt | h-1 mất tin H + fact + hội thoại + dòng sellers, có câu "(TEST) Em đã xoá…", vai không còn là seller; h-2/h-3 nguyên; tắt công tắc thì "hello" không xoá gì | ✅ 09/09 |
| TS-KYGUI-25 | FR-180: e2e H8g (mock `mau_cau_fewshot` trả 1 mẫu bán) + DB: `select mau_cau_fewshot('ban', 12)` sau khi sửa 1 câu ở `/admin/mau-cau` + `node scripts/xuat-mau-cau.mjs` | system prompt người bán có "Ví dụ CHUẨN do anh/sếp sửa tay" + câu mẫu; DB trả đúng dòng "- Khách: … → Thái: …"; script ra 2 file JSONL, đếm đúng, nói "chưa đủ 300" | ⏳ e2e ✅ 09/09; DB/script chờ mẫu đầu tiên |
| TS-KYGUI-26 | FR-181: e2e V1.1b ("chào em" từ la-1), N1/N1b (z-ccrb hai lượt), N2 (khách mua); `fr177` 5 ca `tenTroLy`/`KHO_TEN_TRO_LY`/`dienTen`; DB: `select ten_tro_ly from sellers`, `select content from bot_prompts where key='tone_rules'` | lời chào xưng đúng tên băm từ Zalo ID, không "Thái", không "{ten}"; `sellers.ten_tro_ly` ghi đúng một lần; system prompt mua/bán "Bạn là \"<tên>\""; kho 20 tên có T•ai, Kh•ai, không P•ai; bot_prompts chứa "{ten}" | ✅ 09/09 |
| TS-KYGUI-27 | FR-183: e2e N11 (z-ccrb 3 tin gật bản nháp tin 0002); DB: `select diem_nguoi_ban(id) from sellers`, `select * from seller_ranks` | chúc mừng có "Điểm người rao của … X/100 (N căn đang rao)"; RPC gọi đúng một lần; NMG hệ số >1, CCRB =1, trần 100 | ✅ e2e 09/09; DB sau khi áp `20260909h` |
| TS-KYGUI-28 | FR-184: e2e N3 (một căn "bán được rồi"), N4/N4b (nhiều căn → hỏi → "căn nguyễn trãi"), N5 ("bán rồi hả em?"), N6c ("chốt đi" lúc duyệt); `fr177` 30 ca `laNgungRao` + 9 ca `chonCanTheoCau` | `da_chot`/`an` đúng căn, câu treo expired, nhắc cancelled, `boc_tach.ket_thuc`, 0 lượt model; câu hỏi/phủ định/câu rao không kích; lúc duyệt là gật | ✅ 09/09 |
| TS-KYGUI-29 | FR-185: e2e V2.1/V2.1b/V2.1c (ảnh sổ 50m2 khớp), V2.2/V2.2b (ảnh mặt tiền), N9 (kho hỏng), N10 (sổ 60 vs tin 50 → lệch 20%), N10b (chưa có diện tích → lấy 48.5), N10d (model không phân loại → riêng tư); `ranh-gioi.mjs` bao `_shared/ai/`; DB thật: gửi một ảnh nhà + một ảnh sổ qua Zalo rồi `select bucket, media_type, nguon, ocr from listing_media` | giấy tờ → `listing-private` + `ocr` không có tên người; ảnh nhà → `listing-public`; không fact URL Zalo khi đã vào kho; kho hỏng → fact URL tạm + `bot_errors` "anh vao kho"; lệch → hỏi lại + việc 📐; câu `hinh_anh` treo đóng | ✅ e2e 09/09; DB thật chờ ảnh đầu tiên |
| TS-KYGUI-30 | FR-186: e2e H4b (nhà phố hỏi tiềm năng trước nháp), N6/N6b, N7 (chung cư → hướng ban công), N7b (nhà phố không có hướng), N8/N8b (cho thuê → cọc → thời hạn); `fr177` 10 ca nhận diện + 5 ca `chonCauKe` + 4 câu mẫu; DB: `select property_type, fact_key, priority, deal from required_facts order by 1,3` | 94 dòng đúng bảng FR-186; view `listing_missing_facts` tin cho_thue có `tien_coc`, tin bán không; câu mẫu "Ban công căn mình quay hướng nào" cho chung cư | ✅ e2e 09/09; DB sau khi áp `20260909h` |
| TS-KYGUI-31 | FR-173 a: DB thật sau `20260909h`: khách mua hỏi "hình bếp" một căn có chủ Zalo → `select assignee, sla_due_at from info_requests`; `select note from reminders where note like '💬%'`; đợi quá 12 giờ (hoặc `update info_requests set sla_due_at = now() - interval '1 minute'`) rồi `select info_request_sla_tick()` | assignee='seller', sla +12 giờ, tin 💬 có địa chỉ + câu hỏi; quá hạn → assignee='ctv', `chu_nha_qua_han_at`, hạn +120 phút, việc cho CTV ghi "chủ nhà 12 giờ chưa trả lời"; chủ trả lời trong chat → `answered` + followup cho khách | ⏳ chờ DB thật |
| TS-KYGUI-32 | FR-114 d: e2e N12 (mock `match_projects` trả Sunrise City) | ngữ cảnh model có khối "DỰ ÁN (kiến thức ĐÃ XÁC THỰC" với "Hồ bơi Olympic"; `listings.project_id` được gắn | ✅ 09/09 |
| TS-KYGUI-33 | FR-186 mở rộng + FR-187: e2e N13/N13b (kho xưởng: "cao thông thủy 9m" → `chieu_cao`, kế `tai_trong_san` → `tram_bien_ap`), N14 (đủ co_ban+chuyen_mon → view còn `so_wc`… nhóm `sau_dang` nhưng KHÔNG có câu pending nào thuộc nhóm đó); DB thật sau `20260909i`: `select enum_range(null::property_type)`; `select property_type, count(*) from required_facts group by 1`; `select jsonb_object_keys(nhom) from boc_tach_v limit 1`; `select boc_tach_nhom(id) from listings limit 1` dưới vai admin; `select guess_property_type('cho thuê kho xưởng 1000m2 KCN Tân Tạo')`; `/admin/ro-hang` bấm JSON một dòng, `/admin/ro-hang/json` tải một tin | enum 12 giá trị; 11 loại có dòng (toa_nha 16, dat_nong_nghiep 13, dat_kinh_doanh 12, kho_xuong 17); khoá nhóm ⊆ {tin, nguoi_rao, vi_tri, thong_so, phap_ly, gia, cho_thue, khai_thac, anh, bo_sung, cham_soc, diem}, không có giá trị null/"" ở bất kỳ tầng nào; anon select `boc_tach_v` → permission denied; guess → `kho_xuong`; file tải tên `<mã tin>.json` | ✅ e2e 09/09 tối; DB sau khi áp `20260909i` |
| TS-KYGUI-35 | FR-188…191 trên DB thật sau `20260909n`: `select doc_gap('cần bán gấp'), doc_gap('không vội, được giá thì thôi')`; `select chon_ctv('Quận 5')` sau khi gán `ctvs.khu_vuc`; tạo 16 info_requests pending cho một CTV rồi gọi `chon_ctv` → phải sang CTV khác/admin; `update conversations set human_hold=true` rồi chủ nhắn → bot im; `select seller_keep_alive_tick()` với một tin `dang_ban` có tin chủ cuối > 6 ngày (đẩy `messages.created_at` lùi) → có info_request mới hoặc reminder "còn bán không"; kịch bản thật M/N/O/P (câu rao dài, đại diện CĐT, nhà đầu tư, Vũng Tàu) | true/false; CTV đúng khu; CTV đầy bị bỏ; bot im khi giữ; keep-alive chạy; 4 chân dung mới ra bản nháp | ⏳ DB thật; e2e N18–N24 ✅ 10/09. Lần 6 (01:54 UTC 10/09) M câu rao dài: 85 điểm + CẦN BÁN GẤP ✅; N đại diện CĐT: chỉ 1 tin, "căn A5…" bị coi là sửa giá → vá `nhanDienNhieuCan`; O nhà đầu tư: rơi nhánh mua vì chữ "mua" → vá `coHangCoGia`; P Vũng Tàu: địa bàn ✅, 74 điểm, "phí quản lý" bị coi là hỏi ngược → vá CAU_HOI_RE. **Lần 7 (02:05 UTC 10/09, sau PR #61):** N mở đúng 3 tin riêng cho lô A5/A7/B2 ✅; O nhà đầu tư lên kệ 83 điểm ✅; P Vũng Tàu nháp 74 ✅; M câu rao dài 78 + CẦN BÁN GẤP ✅. Bốn lỗi lời lẽ bắt được khi chủ dự án đọc lại bản ghi và vá ngay sau đó: (1) bản nháp lặp nhãn "Phí: phí QL phí quản lý 20 nghìn/m2" → nhãn so theo từng chữ; (2) "Anh đầu tư mua nhà cũ sửa lại bán" (chủ nhà kể về MÌNH) thành "💡 Phù hợp" → luật `tiem_nang`/`muc_dich` bỏ câu mở bằng đại từ + nghề; (3) câu "cần bán gấp hay không" hỏi ba lượt liền → `HOI_MOT_LAN` (FR-188 b); (4) địa chỉ "hẻm 100 Nguyễn Trãi" và "7 Hồng Bàng" không vào tin nên bot hỏi lại địa chỉ vòng vòng, bản nháp trống địa chỉ, danh sách "đã bán căn nào" chỉ hiện phường → mẫu `vi_tri` nhận số nhà (FR-177 o), và lời ghi nhận không còn nói "cập nhật lại" cho trường trống (FR-177 p). **Lần 8 (03:16 UTC 10/09, sau PR #63)** chạy lại J/N/O: địa chỉ "hẻm 100 Nguyễn Trãi" và "7 Hồng Bàng" vào tin ngay (J 75→82 điểm, O 83→85), "bán rồi em" → "căn Nguyễn Trãi" khớp đúng căn và gỡ tin, câu gấp chỉ hỏi một lần, không còn "💡 Phù hợp: Anh đầu tư mua nhà cũ sửa lại bán", không còn nhãn lặp. **Cả lượt này KHÔNG có model**: khoá API Anthropic của bot hết credit ("credit balance is too low", `bot_errors` nguồn `chat-reply model r1/r2/r2b`), nên mọi câu là CÂU MẪU tiền định — đường dự phòng OPEN-30 chạy đúng, nhưng đừng đọc lượt này để chấm giọng model. Hai chỗ câu mẫu còn thô, vá luôn: neo căn đọc "Căn Phường 16" (cả lô cùng phường) → neo bằng mã căn, và dấu phẩy trước câu hỏi viết hoa → dấu chấm. Kiểm lại: e2e N25–N29, FR-177 199 ca |
| TS-QUOTA-01 | FR-192 quyền: gọi `rpc/quota_tieu_hao` bằng anon (nằm trong `bot/tests/ts-sec-anon.mjs` nhóm 2) | PostgREST từ chối (42501 "permission denied for function") | ✅ 10/09 DB thật |
| TS-QUOTA-02 | FR-192 quyền: gọi bằng `authenticated` với email KHÔNG có trong `admins` | 42501 "Khong co quyen quan tri" — hàm tự kiểm `la_admin()`, không rò số liệu | ✅ 10/09 DB thật |
| TS-QUOTA-03 | FR-192 nội dung: gọi bằng email admin thật | JSON có `luot_hom_nay`, `tran_ngay` (đọc Vault, mặc định 1000), `token_hom_nay`, `nguoi_dot_nhieu` (≤10 người, kèm cờ người quen), `het_credit` + `credit_loi_24h` + `credit_lan_cuoi`; KHÔNG có bí mật nào khác | ✅ 10/09 DB thật: 246 lượt/1000, 886.639 chữ-máy, het_credit=true (48 lượt bị từ chối, lần cuối 03:16 UTC) |
| TS-QUOTA-04 | FR-192 b: khi sổ lỗi CÒN dòng "credit balance is too low" trong 24h, bắn một tin cho bot rồi mở thẻ Quota tiêu hao | model gọi được → dấu `bot_health(model_chinh)` mới hơn lỗi cuối → thẻ chuyển sang "gọi lại được lúc HH:MM — N lượt bị từ chối trước đó", băng đỏ tắt; model vẫn hỏng thì vẫn đỏ | ⏳ đo sau khi deploy chat-reply |
| TS-LOAI-01 | FR-193 trên DB thật: `guess_property_type` với 14 câu người thật gõ, gồm câu chủ dự án nhắn 10/09 ("Chào bạn tôi cần bán căn ho ở Hà đô centrosa garden"), câu không dấu ("ban can ho 2pn quan 7"), viết tắt ("Bán CC Sunrise City") | 14/14 đúng loại | ✅ 10/09 DB thật |
| TS-DUAN-01 | FR-193 c/d trên DB thật sau khi nạp 1.643 dự án: `match_projects` với 7 câu khách hay nói, có dấu và không dấu, tên đủ và tên rút gọn | mỗi câu ra đúng dự án và đúng quận | ✅ 10/09: Hà Đô Centrosa → Quận 10 (cả "ha do centrosa garden" không dấu), Vinhomes Grand Park → Quận 9, Cát Tường Phú Sinh → Đức Hoà, Sunrise City → Quận 7, Masteri Thảo Điền → Quận 2, The Win City → Đức Hoà |
| TS-DUAN-02 | FR-195 vòng đầy đủ trên DB thật: `ghi_fact_du_an()` một dòng phí quản lý cho Centrosa → hiện ở `project_facts_cho_duyet` → gọi `duyet_fact_du_an(id, true)` bằng email admin | dòng vào trạng thái cho_duyet; sau khi gật thì `projects.specs.phi_quan_ly` có giá trị và dòng chuyển da_duyet | ✅ 10/09 DB thật (đã dọn dòng thử sau khi đo) |
| TS-DUAN-03 | FR-196: hỏi bot 5 câu tầng dự án trên production (số căn, tiện ích, phí quản lý, quận + năm bàn giao, loại căn + diện tích, giá đất nền) rồi ĐỐI CHIẾU từng con số với `projects` | mỗi con số nói ra phải có trong kho; không có thì bot nói "để em xác nhận lại" | ✅ đo lần 2 (08:12 UTC 10/09) ĐẠT — The Beverly: bot đọc đúng 4 loại căn kèm diện tích y như kho (Studio 32,5-35,4 · 1PN+ 53,1-55,1 · 2PN 78,7-80,2 · 3PN 100,2-101,5); Centrosa đọc đúng số căn từng loại; phí quản lý không có trong kho thì bot nói xác nhận lại. Lần 1 (07:42 UTC) HỎNG: The Beverly kho ghi studio 32,5m²/2PN 78,7m² mà bot nói 1PN hơn 30m²/2PN 55-70m² → thêm luật số + đào sâu; đo lại sau khi đào xong |
| TS-MODEL-01 | FR-198: gọi thẳng API Anthropic bằng Haiku 4.5 với ba khuôn tham số bot đang dùng (trần trụi · `effort` · `format`), rồi chạy `bun bot/tests/tham-so-model.mjs` | API: trần trụi 200, `effort` **400 không hỗ trợ**, `format` 200 — nên lớp lọc phải bỏ `effort` và giữ `format`; 13/13 ca lọc đạt | ✅ 10/09 đo thật trên API, 13/13 ca đạt |
| TS-VET-01 | FR-199: `bun bot/tests/vet-du-an.mjs` — 6 câu có mùi dự án, 6 câu thường, và bộ dọn (cắt đuôi địa bàn, bỏ tên quá dài, cắt 120 ký tự, tối đa 6 fact) | 12 câu phân loại đúng (câu thường KHÔNG gọi model), 6 ca dọn đúng | ✅ 10/09, 18/18 ca đạt |
| TS-GAN-01 | FR-204: `bun bot/tests/tien-ich.mjs` — 29 câu khách mua (có/không dấu, tên là số "bv 115", "thị trường", "cho con", phủ định, bán kính km / m / phút đi bộ, kẹp 3 km); cổng `coMuiViTri` (câu nói vòng lọt, câu thường không); câu tra geocode (không số nhà, nấc không quận / không dấu, quận mặc định, tỉnh ngoài, "Đường số 7"); câu tra dự án; JSON Overpass (bỏ nhà thuốc / thú y / điểm trùng); khoảng cách; gần nhất mỗi loại | tất cả đạt; KHÔNG câu tra nào mang số nhà | ✅ 11/09, 76/76 ca đạt · 14/09: 80/80 (+4: tin chỉ có huyện → tra tâm huyện mức 'quan'; quận mặc định không tra; có đường/phường không lùi về tâm quận) |
| TS-GAN-02 | FR-204: e2e `bot/tests/e2e/run.mjs` GAN-01…09 — "tiện đi khám bệnh" → model đọc ra bệnh viện, `tin_gan_moc` đúng loại / bán kính / deal, KHO chỉ còn căn gần + "cách … khoảng 600 m"; hồ sơ lưu điều kiện, lượt sau lọc tiếp mà không gọi lại model; câu HỎI "căn đó gần chợ không" không thành bộ lọc; model hỏng → regex; "thôi khỏi cần" gỡ điều kiện; RPC hỏng → bỏ lọc; không căn nào trong bán kính → dặn nói thật | 9/9 | ✅ 11/09, e2e 300/300 |
| TS-GAN-03 | FR-204: sau khi apply `20260911g` trên DB thật — gọi `geocode_tick()`, đợi `geocode-listings` chạy, đếm tin có `lat/lng` theo `toa_do_muc`, số điểm `tien_ich` theo loại, rồi `tin_gan_moc('benh_vien', …)` quanh một tin đã định vị. (Migration đã thử trước trên Postgres trong bộ nhớ: 28/28 ca — khoảng cách, khớp tên nguyên chữ, lọc trạng thái / deal / mức phường, trigger đổi địa chỉ, tick rảnh không gọi, chạy lại migration không nổ.) | tin có tên đường có toạ độ mức đường; có điểm tiện ích; khoảng cách khớp tay | ✅ 11/09 lượt đầu: 15/37 tin có toạ độ — 2 mức đường (đúng bằng số tin có tên đường), 13 mức phường (tin chỉ có phường); 72 điểm tiện ích; BDS-CH-Q8-0001: THCS Bình Tân ~570 m, WinMart ~1,2 km, chợ Kiến Đức 2 ~1,2 km, BV Triều An ~1,9 km. **Bắt được lỗi:** "Trần Bình Trọng, Q5" khớp nhầm đường cùng tên cách ~7 km ở nấc bỏ quận → khoá hộp tìm quanh quận cũ (`viewbox` + kiểm bán kính). Overpass công cộng quá tải (504 / 406) → gọi POST, thêm máy thứ ba, lỗi Overpass thử lại sau ~1 giờ |
| TS-GAN-04 | FR-204, FR-152: sổ lỗi không nhận đường đi đúng thiết kế — gọi cùng một request Overpass từ máy văn phòng nhiều lần (đo 14/09: overpass-api.de lúc 504 sau 10 s, lúc 200 sau 1,5 s; hai máy phụ quá 30 s) rồi soát `bot_errors` source `geocode-listings` sau deploy 1 giờ | máy hỏng rồi máy kế chạy được → không dòng nào; cả lượt không nạp được tin nào → đúng MỘT dòng tổng liệt kê máy + lý do; payload trả `overpass_hong` | ✅ 14/09 trước vá: 4–5 dòng/tick (HTTP 406, Signal timed out) · sau vá: đo sau deploy |
| TS-PHANVAI-01 | FR-205: offline `bun bot/tests/phan-vai.mjs` — van gọi model (mùi nhà đất; bảy điều kiện bỏ qua: đã có hồ sơ bán, luật đã ra bán, luật đã ra mua, đã có hồ sơ nhu cầu, gửi ảnh, nhắc mã tin, đòi gọi) và dọn kết quả (khuôn sai, cụm làm bằng không có trong câu, khác dấu vẫn nhận) | câu chào / "ok em" / "để anh hỏi vợ đã em" không tốn lượt model; model bịa cớ bị bỏ | ✅ 11/09 |
| TS-PHANVAI-02 | FR-205: e2e `bot/tests/e2e/run.mjs` VAI-01…06 | rao không chữ "bán" → mở hồ sơ bán, nhánh bán; model "mua" → hàng mua, không chào khuôn; `chua_ro` / cụm làm bằng bịa / model hỏng → hỏi vai như cũ; câu chào, câu luật đã rõ → không gọi model phân vai | ✅ 11/09 |
| TS-NHAP-01 | FR-206: offline `bun bot/tests/tin-nhap-rao.mjs` — ba mẫu (nhà phố đủ thông số, căn hộ cho thuê, đất nghèo thông tin) | tiêu đề đúng thứ tự cụm và kết bằng giá, không lặp "hẻm", ≤120 ký tự; dòng 2 tiêu đề, dòng 3 📍 viết hoa, dòng 4 💰; tin nghèo thông tin không đẻ dòng bịa; không đọc mã tin | ✅ 12/09, 15/15 |
| TS-NHAP-02 | FR-206: e2e `bot/tests/e2e/run.mjs` (H5, H6, N6b, BLDL) + bắn thật trên production | bản nháp mở bằng "Em đăng tin như vầy", có giá và tiêu đề; bong bóng 💾 đứng TRƯỚC bản nháp; model không thấy bảng 💾 trong lịch sử | ✅ 12/09, e2e 306/306 |
| TS-BLDL-01 | FR-207: e2e `bot/tests/e2e/run.mjs` BLDL-01…11d | 💾 là bong bóng ĐẦU; "Vừa lưu" chỉ fact của lượt (không kèm "6x11" lượt trước), nguyên văn đã lưu; 📦 Tin giờ đúng cột DB (6m² không phải 66) và chỉ kèm khi tin đổi; lượt tạo tin bỏ 📝 giữ "Sai chỗ nào"; tin không lưu gì → không 💾; người mua bật công tắc → "Đã lưu nhu cầu" đúng khoá đã vào DB, không khoá nội bộ; tắt → không 💾; model hai nhánh không thấy 💾 | ✅ 14/09, e2e 318/318 |
| TS-BLDL-02 | FR-207: bắn 20 tin thật trên production (`ban-20.mjs`, dừng bridge) rồi đối chiếu từng bong bóng 💾 với `listing_facts` / `buyers.preferences` đọc thẳng từ DB | mỗi thứ 💾 nói có trong DB, mỗi fact lượt đó ghi đều được nói | chạy sau deploy 14/09 |
| TS-BLDL-03 | FR-207 (g): offline `bun bot/tests/van-tra-loi.mjs` — `boCauGhiNhan` (bỏ bong bóng/ câu ghi nhận có nội dung, giữ khen + câu hỏi, câu còn lại mở bằng "Dạ", không đụng 📋/💾/ghi nhận trơ trọi), `kemLuotTao`, tóm tắt căn hộ có dự án/tầng/nội thất, `tomTatTrongCau`, `vuaLuuMua` chỉ khoá đổi | tất cả đạt | ✅ 14/09, 82/82 (+6 ca người mua: "em tìm cho mấy căn", "những căn này" khi kho trống, "Dạ chị, em ghi lại: …" lặp 💾) |
| TS-TOC-01 | FR-171 h (tốc độ lượt đầu người mua): bắn thật 4 lượt đầu (2 câu có "gần …", 2 câu thường), đọc `_ms` từng chặng + token model chính; e2e GAN-SONGSONG, NHOTAM-01/02 | lượt "gần" không còn chờ model vị trí trước model chính; từ lượt thứ hai trở đi (khách khác tên trợ lý) `cache_read` > 0 | ✅ 14/09 lần 1: gần 11,5–13 s / thường 8,3–9,6 s, `cache_read 0` mọi lượt · sau song song: gần 6,2–6,8 s · sau nhớ tạm: `cache_read 16.063` 7/8 lượt nhưng model chính vẫn 6–7 s · thử trên API: structured output 4,1–5,4 s vs JSON bằng lời 1,8–3,5 s (8/8 hợp lệ) → bỏ khuôn ở nhánh mua (e2e JSONCHU-01…03), đo sau deploy |
| TS-SIET-01 | FR-130, FR-159: bắn 16 hội thoại người mua thật (`ban-mua.mjs`: thuê căn hộ, hoàn cảnh, hỏi kho, gần trường, không dấu, đầu tư, ngân sách mơ hồ, hỏi phí, pháp lý, vay, gấp, đổi ý, cụt lủn, khách xưng em, hẹn xem, bực) trước và sau khi siết; offline `van-tra-loi.mjs` (+14 ca), `fr159-bon-vai.mjs` (+6 ca) | sau siết: không lưu mục đích/thời hạn/hoàn cảnh không căn cứ, không "chúng mình", không hứa "có nhiều"/hẹn xem khi kho trống, "mua để/qua bên em" vào nhánh mua | ✅ 14/09 offline 94/94 + 71/71, e2e 326/326; lượt bắn lần 2 (sau PR #128): hết bịa hồ sơ / "chúng mình" / "có nhiều", "mua để/qua" vào nhánh mua; còn dò "để ở hay đầu tư" dù đủ khu + giá (5/9), nhận hẹn xem & "để em gửi căn" khi kho trống, và lộ `bocQuan("quận 5 tầm 6 tỷ") = null` → vá (e2e DUTIEUCHI-01/02, van 98/98, luật phá dữ liệu); lần 3 (sau PR #129): 8/9 ca đủ khu + giá hết dò mục đích, hết "ghi nhận lịch" / "gửi căn" khi kho trống, `bocQuan` đúng; còn lọt thuê căn hộ bị hỏi "để ở hay cho thuê lại", ca vay 4 tỷ Q6 vẫn hỏi "để ở hay đầu tư", ghi chú lặp "cần gần trường…", model gõ dính "Emghi nhận" → vá bằng code (`boHoiMucDich` khi đủ tiêu chí hoặc khách thuê, `gopGhiChu` tách ý mới ở dấu phẩy, `suaTuXungMua` tách chữ dính; e2e MUCDICH-01…03 331/331, van 108/108); lần 4 (sau PR #131): hết dò mục đích ở ca thuê + ca vay, hết "Emghi", ghi chú "trường" không lặp; model đổi chữ để lọt van ("Mình ở hoặc đầu tư ạ?", "tìm mua hay để ở?"), "kho em còn vài căn" khi kho trống, gọi khách "bạn", ghi chú đồng nghĩa "cần/muốn gần bệnh viện" → nới van (hay/hoặc, mua/thuê hay để ở; "còn vài căn"; "bạn" làm chủ ngữ → "mình"; so ý bỏ động từ mong muốn; van 118/118, e2e 331/331); lần 5: đo sau deploy |
| TS-VAN-01 | FR-176, FR-206, FR-172 — lỗi còn chờ sau lượt bắn 20 tin thật 12/09, phần TS: offline `bun bot/tests/van-tra-loi.mjs` — câu hứa có hàng (6 phải chặn, 8 không được chặn), `laHoiCoHang` ("Dạ có ạ." chỉ là hứa khi khách đang hỏi hàng), chèn lời thật đúng chỗ, gộp ghi chú người mua theo từng ý, bong bóng ghi nhận trùng ("Dạ em ghi nhận rồi ạ." trơ trọi không tính), giá thuê kèm kỳ hạn `gonGiaKyHan`, tự xưng giữa câu, tiểu từ chat ở đuôi dòng bản nháp | tất cả đạt | ✅ 13/09, 54/54 ca đạt |
| TS-VAN-02 | Như TS-VAN-01, trong luồng: e2e `bot/tests/e2e/run.mjs` (KHO-01…03, XH-MUA-01/02, NOTES-01) | kho trống + model "Dạ có em." / "em đang có vài căn" → câu hứa bị bỏ, câu hỏi còn nguyên; kho CÓ căn → không đụng; khách "chị đang tìm mua" → hồ sơ `xung_ho` = chị và câu lệnh lượt sau mang cách gọi; ghi chú không lặp | ✅ 13/09, e2e 313/313 |
| TS-VAN-03 | FR-172, FR-164 — phần SQL `20260913a`: khối `DO … raise exception` (tự rollback) trên DB thật chèn căn hộ + fact `tang`=15 + `gia`="18 triệu 1 tháng", nhà phố + `tang`=4; và gọi `chuan_hoa_gia_raw` / `boc_ten_duong` trên 14 câu giá, 16 câu địa chỉ | căn hộ: `floor`=15, `floors` rỗng, giá "18 triệu/tháng"; nhà phố: `floors`=4 "trệt + 3 lầu"; "hẻm 5m Nguyễn Trãi" → "Nguyễn Trãi", "đường 3 Tháng 2" giữ "3 Tháng 2", "1 tỷ 1 năm" giữ nguyên | ✅ 13/09 trên DB thật |
| TS-VAN-04 | FR-176, FR-164 — lượt bắn 20 tin thật thứ hai (13/09): offline `bun bot/tests/van-tra-loi.mjs` (câu nhận là người thật / chối là máy: 4 phải chặn, 5 không được chặn như "không phải ai cũng…", "không phải máy lạnh"; hai kẽ van kho "Dạ có anh/chị!", "em tìm vài căn … cho chị xem") + `bun bot/tests/boc-tach-42-ca.mjs` (12 ca từ đúng các câu đã bắn: luật trả nguyên câu làm đáp án chỉ còn lấy MẢNH chứa từ khoá; "để lại căn nhà" không là nội thất; "cho thuê căn hộ …" không là tiềm năng; lý do bán giữ dấu; view) + e2e NGUOI-01. Bắn lại thật kịch bản 5/8/10 sau deploy: bot tự nói "Em là trợ lý AI", kho trống ra "em lọc kho…", câu đầu tin đất hỏi xã; lượt 2 lộ hai lỗi nữa (hỏi lại vẫn "phường", mất "dài 20") → vá, thêm ca `mat_tien` giữ hai chiều | tất cả đạt; không fact nào mang nguyên câu rao nhiều mảnh | ✅ 13/09, van 68/68, bóc tách 122/122, e2e 314/314 |
| TS-VAN-05 | FR-194 b/c, FR-209 c/d, FR-186 q, FR-174 — lượt bắn 14 tin thật 15/09 (07:11–07:21 UTC, Groq trước, 4–5 tin đồng thời mỗi đợt): rao đất mặt tiền Lê Văn Việt · cho thuê mặt bằng Q7 · nhà nát Q5 · khách mua 2PN Q7 · gật gợi ý phường · "phường Tân Phú" cho tin Q7 · sửa giá · khách bổ sung gần trường · căn hộ Q7 · kho xưởng xã Tân Kiên Bình Chánh · tin 2 căn "căn 1 …, căn 2 …" · khách thuê gần ĐH Tôn Đức Thắng · ngưng rao · 3 câu nối | 14/14 có trả lời, 0 `bot_errors`; lỗi lộ ra được vá cùng ngày, offline: `bocQuan` 105/105, bóc tách 131/131, tra phường 28/28, thứ tự model 23/23 | ✅ 15/09: bắt 5 lỗi — (1) Groq 413 đi thẳng Claude thay vì xoay model; (2) "phường Tân Phú" đè Quận 7 thành Quận Tân Phú; (3) "xã Tân Kiên đó em" ghi nguyên chữ; (4) "căn 1 / căn 2" không nhận nhiều căn, "còn căn 2 …" sửa nhầm căn 1; (5) "đường xe container" thành tên đường. CHƯA vá: Claude Haiku nói "ĐH Tôn Đức Thắng ở Quận 1" (trường ở Quận 7) và hỏi hai câu một lượt (FR-177); Groq bậc miễn phí chạm 429/413 ngay khi 4 tin đến cùng lúc → phần lớn rơi về Claude, đúng thiết kế nhưng tiết kiệm ít |
| TS-VAN-06 | FR-176 e — Zalo thật 15/09 17:36–17:38 (tin Ny'ah Phú Định, chủ dự án tự test): bốn câu thật chạy offline `bun bot/tests/boc-tach-42-ca.mjs` (tách hỏi ngược · số nhà không phải diện tích · cắt gấp/kết cấu · 8 câu KHÔNG được tách nhầm) và e2e HN-1…4; sau deploy bắn lại đúng bốn câu qua `net.http_post` | offline 152/152, e2e 351/351; thật: `area_m2` không thành 14, kết cấu = "Nhà 5 tầng", gấp = "Được giá", bot trả lời câu hỏi ngược trước khi hỏi tiếp | ✅ 15/09 10:51–11:00 UTC (deploy #132–133, tài khoản thử, cùng 4 câu): "Căn số 14 ở ny'ah phú định" → vi_tri, `area_m2` trống, hỏi lại diện tích; "Tầm 13 tỉ 500 triệu nhé" → 13,5 tỷ; "Được giá, … bạn có thông tin thêm về căn này không" → gấp = "Được giá", bot: "Em chưa rành chi tiết căn nên sẽ kiểm tra rồi báo lại" rồi mới hỏi kết cấu; "Nhà 5 tầng, có thang máy thì phải, bạn có biết xung quanh khu này có tiện ích gì không" → kết cấu "Nhà 5 tầng", thang máy = có, `floors = 5`, bot trả lời tiện ích trước rồi hỏi phòng ngủ. Lượt đầu (deploy #132) lộ thêm: nhánh lệch → hỏi lại chưa nối hỏi ngược, "Được giá" rơi bo_sung → vá ở PR #152 |
| TS-VAN-07 | FR-159, FR-164, FR-176 e, FR-177 e, FR-184, FR-209 b — lượt bắn 4 hội thoại người-thật-giả-lập 15/09 (12:22–12:40 UTC, tài khoản `thu-nt-A…D`, mỗi hội thoại 4–5 câu nối nhau như người gõ: A căn hộ Sunrise City Q7 kể lể + hỏi ngược giá/phí/ảnh; B cò đất Thủ Đức gõ không dấu "gia 6ty2 shr … ko ban"; C trả lời cụt "bán nhà" → "quận 10" → "hẻm 5m Cách Mạng Tháng 8, 4x14 nở hậu 5m" → "à mà nhà này cho thuê chứ ko bán, 25 triệu"; D người mua "chào bạn mình tìm nhà cho ba mẹ… tầm 5 tỷ") — đọc câu trả lời qua `net._http_response` và chụp `listings`/`listing_facts`/`info_requests` từng lượt; offline `bun bot/tests/boc-tach-42-ca.mjs`, e2e V1.8b · PH-08c · DEAL-01 · HN-5 | vai đúng (D là NGƯỜI MUA), câu rao không dấu tạo tin, tên đường giữ số cuối, fact đi kèm không rơi, đổi loại giao dịch lật `deal` và giữ giá, câu hỏi trọn không thành fact | ✅ 15/09 offline: bóc tách 169/169, e2e 355/355, `luat-pha-du-lieu` đạt, `soat:migration` 159 hàm khớp. Thật (trước vá) bắt 5 lỗi: (1) B1 thành "không thấy tin nào đang rao" — `laNgungRao` khớp "ko ban" vì cửa chặn tiền hụt "6ty2"; (2) D1 người MUA bị mở hồ sơ bán + tạo tin "Nhà phố bán · Quận 10 · 5 tỷ" — "chào BẠN" bỏ dấu thành "ban"; (3) C3 "Cách Mạng Tháng 8" cắt còn "Cách Mạng Tháng", "4x14" và "nở hậu 5m" rơi mất khi trả lời câu phường bằng địa chỉ; (4) C4 "cho thuê chứ ko bán, 25 triệu" vào ô tiềm năng, tin vẫn BÁN, giá bị gạt, bot vẫn nói "đã ghi nhận 25 triệu cho thuê"; (5) A5 câu hỏi "bên bạn có cần mình gửi hình không hay sao" thành fact bổ sung. Ổn: A1–A4 (dự án + phường từ tên dự án, 70m²/2PN, giá 4,2 → 4 tỷ, sổ hồng, trả lời phí 1% và câu hỏi ngược trước khi hỏi tiếp), C1–C2 (quận mặc định rồi nhận "quận 10", cấp lại mã Q10). Soát lại 13:55 UTC: "giá khu này 40–43 triệu/m²" và "hồ bơi chân mây" KHÔNG phải bịa — cả hai nằm trong `projects.description` / `projects.amenities` của Sunrise City (kho dự án mogi, FR-114 d), model trích đúng khối DỰ ÁN; luật mới ở FR-177 chỉ chặn nêu số khi ngữ cảnh KHÔNG có bảng giá; fact `gia`/`dien_tich_tim_tuong` ghi nguyên mệnh đề ("giá thì mình muốn tầm 4 tỷ 2", "70m2 2pn") dù cột đúng; bot gọi "chị" sau khi khách nói "hỏi vợ". **Bắn lại thật sau deploy #134 (12:47–12:52 UTC, tài khoản mới `thu-nt-B2/C2/D2` + A lượt 6): 5/5 đúng** — B1 tạo tin "Đất bán · TP Thủ Đức · 90m² · 5x18 · sổ hồng riêng · 6,2 tỷ"; D1 vào hàng MUA ("Đã lưu nhu cầu: mua · Quận 10 hoặc Quận 5, gần bệnh viện · tầm 5 tỷ"); C "hẻm 5m Cách Mạng Tháng 8" giữ số 8, 56m² + nở hậu 5m ghi kèm; C "cho thuê chứ ko bán, 25 triệu" → `deal=cho_thue`, `price_vnd` 25.000.000, bong bóng "loại giao dịch: cho thuê"; A câu hỏi ảnh → không fact, bot trả lời rồi hỏi tầng. Lượt này lộ thêm 2 lỗi nhỏ: `price_raw` mang nguyên đuôi "6ty2 shr thanh khoan nhanh ko ban" (vá cùng ngày: `DUOI_GIA` dừng trước chữ của thứ khác, `boc-cau-rao` 53/53) và phường tên chữ KHÔNG DẤU ("phuong hiep binh chanh") không nhận — `phuongTenCauRao` cố ý chỉ nhận chữ viết hoa có dấu). **Đợt vá 2 cùng ngày ("vá đi"):** giá thị trường không nêu số (prompt + DB), `motCauHoi` cho lời model, `catDapAn` giá/m² gọn, xưng hô từ "vợ/chồng", phường không dấu tra `wards`. Bắn lại thật sau deploy #136 (13:52–13:57 UTC, `thu-nt-E`, `thu-nt-B4`): B4 `ward = Phường Hiệp Bình` (tra từ `don_vi_cu`), `price_raw = 6ty2`; E2 tim tường = "70m2", bot nêu "40–43 triệu/m²" đúng từ khối DỰ ÁN; E3 giá = "tầm 4 tỷ 2", `xung_ho = anh`, bot gọi "anh"; E4 lộ lỗi mới — câu hỏi trọn khi câu treo là GẤP (loại có/không) bị coi là KHỚP vì chữ "không", nguyên câu vào ô gấp → vá: `laCauHoiTron` chạy trước luật có/không, xếp loại `hoi`; e2e HN-6. Bắn lại sau deploy #137 (`thu-nt-F`, câu treo ép thành gấp): không ghi ô gấp, gấp `expired` đúng luật câu mềm, nhưng model bỏ qua câu hỏi ảnh và chỉ hỏi phường → `dapHoiNguocTienDinh` trả lời tiền định về ảnh trước lời model. Offline: bóc tách 192/192, van 130/130, bóc câu rao 58/58, e2e 356/356 |
| TS-NHUNG-01 | FR-144 f, FR-142, FR-54: `bun bot/tests/nhung-mo-ho.mjs` — soi mã nguồn `bot/supabase/functions`, `app`, `lib`: mọi chuỗi select có `sellers(` trần trong ngữ cảnh đi từ `listings` (`.from("listings")` hoặc lồng sau `listings(`) là đỏ; bỏ qua chú thích; mock e2e nhận cú pháp `!fkey`. Kiểm thật: gọi `ask-seller` (`dry_run`) với một tin có thật qua `net.http_post` trước và sau deploy | trước vá: 2 chỗ đỏ (ask-seller, nudge) + 1 chỗ chat-reply; sau vá: sạch; ask-seller trả 200 kèm câu hỏi thay vì 404 | ✅ 15/09 offline: sạch (76 file, 4 chuỗi) · thật: trước deploy 404 "listing không tồn tại" (req 3217) — sau deploy: xem dòng dưới |
| TS-NHUNG-02 | Sau deploy `ask-seller`/`chat-reply`/`nudge`: gọi lại `ask-seller` dry_run với cùng tin; soi `bot_errors` 1 giờ sau | 200; không dòng "listing không tồn tại" mới | ✅ 15/09 07:40 UTC (deploy #129–131 ask-seller/chat-reply/nudge): req 3220 → 200 `{skipped_pending: ["phuong"], note: "drip: đang có câu chờ trả lời - không hỏi chồng"}` — đúng luật một-câu-một-lúc (FR-144 e), thay vì 404; 0 `bot_errors` mới |
| TS-VAN-08 | FR-159, FR-164, FR-176 e, FR-177, FR-186 q — lượt bắn 4 hội thoại 15/09 (15:15–15:25 UTC, `thu-nt-H/K/N/P`: chủ nhà cho thuê gõ kiểu Facebook + emoji + SĐT; người thuê trọ gõ cụt "trọ q5"; môi giới rao 2 căn "căn 1 …, căn 2 …" rồi bổ sung "căn 2 sổ hồng riêng, có thương lượng. căn 1 đúc 3 tấm"; chủ nhà hỏi khó "bên em là bot hả?", "phí sao, có gọi điện phiền tôi không") | tin thuê đúng cột, phường xin lại; trọ đi hàng thuê; 2 tin có địa chỉ riêng, câu bổ sung vào đúng căn; câu hỏi "bot hả"/"phí" được trả lời thật | ✅ ổn: H1 (cho thuê · Bình Tân · 64m² · 2PN2WC · full NT · 7tr5/tháng · cọc), H2 sửa giá 7tr, K2 hồ sơ thuê trọ gần ĐH Sài Gòn 3 triệu. **Bắt 6 lỗi, vá cùng ngày:** (1) N1 hai tin đều TRỐNG địa chỉ — `bocViTriRao` không nhận "mặt tiền X", tin nhiều căn không ghi vi_tri từng căn; (2) N2 "căn 2 sổ hồng riêng… căn 1 đúc 3 tấm" mở thêm 2 tin RỖNG — nay `nhanDienNhieuCan` đòi giá/kích thước cho căn thứ tự, `tachTheoCan` ghi fact vào đúng căn theo thứ tự mở (e2e N23b); (3) P1 câu rao kèm "bot hả?" bị nuốt — `dapHoiNguocTienDinh` thêm đáp án bot/phí, nhánh tạo tin nối hỏi ngược (e2e RAO-HOI-01); (4) P2 model (Groq) TRẢ LỜI CÂU LỆNH "Em hiểu rồi ạ… Sẵn sàng nhận hội thoại" gửi thẳng cho khách — van `laLoiMeta` bỏ, dùng câu tiền định; (5) H2 "bớt cho người ở lâu dài" vào ô thời hạn sử dụng đất — nay là thương lượng; giá "7tr thôi em" cắt tiểu từ; (6) K2 phía mua hỏi hai câu một lượt — `motCauHoi` áp cho cả phía mua. Offline: bóc tách 202/202, van 139/139, e2e 358/358. **Bắn lại thật sau deploy #140** (`thu-nt-N2/P2`): N1b hai tin có địa chỉ riêng ("hẻm 7m Hồng Bàng", "mặt tiền Nguyễn Chí Thanh"); N2b `fact_theo_can = 3`, không mở tin, đúng căn; P1b bong bóng "em là trợ lý AI…" trước câu hỏi đầu; P2b phí + không gọi điện được trả lời rồi hỏi địa chỉ. Lộ thêm 2 lỗi nhỏ, vá cùng lượt: cột `street` = "mặt tiền Nguyễn Chí Thanh" (migration `20260915e` `boc_ten_duong` bỏ tiền tố mặt tiền/mt) và câu treo cùng họ của căn nhận fact chưa đóng (nay đóng mọi câu treo cùng họ của căn đó, nhãn tin mở nhiều căn dùng địa chỉ). **Đợt dữ liệu mẫu `mau-*` (16:55 UTC, giữ lại cho TS-NGUOI-B):** lượt 1 bốn vai đều đúng; lượt 2 lộ 2 lỗi, vá cùng lượt — "nhà đang cho thuê 25 triệu/tháng" của tin BÁN thành "giá mong muốn: 25 triệu" (nay là hiện trạng, luật `TRUOC_LA_THUE` chặn ở cả `nhanDienFact` lẫn `FACT_PHU`), và "căn 1 sổ hồng…, căn 2 đang cho thuê 80 triệu/tháng" vào nhầm căn vì cổng rao khớp "cho thuê + tiền" (fact theo căn nay không bị `wantsSell` chặn); tách hỏi ngược thêm ranh "dấu chấm + khoảng trắng". e2e N23c. Bắn lại sau deploy #142: C3 đúng căn (pháp lý → căn 1, hiện trạng thuê 80 triệu → căn 2, `rent_income_vnd` = 80.000.000); A3 "3 phòng ngủ em. nhà đang cho thuê 25 triệu/tháng…" khi đang hỏi phòng ngủ → cột `bedrooms` = 3 và `rent_income` đúng nhưng fact ghi "bổ sung" nguyên câu và bot hỏi lại phòng ngủ (luật "tiền ở câu không phải tiền → lệch" và ranh mảnh chưa nhận dấu chấm) → vá: câu nhiều ý có ý đang hỏi là KHỚP, mọi chỗ tách mảnh nhận thêm "dấu chấm + khoảng trắng" |
| TS-VAN-09 | FR-176 c, FR-164, FR-159 — Zalo thật 16/09 08:42–08:57 (ảnh chụp chủ dự án, tin `BDS-NP-Q8-0001`): chủ nhà ĐÃ có tin nhắn "Chào cháu chú có căn nhà này cần giao bán" → "Nhà trong hẻm 2 xẹc nhưng hẻm rộng 5m nhà 4 tấm diện tích tổng 240m2" → "shr, nhà ở từ năm 2019 rồi" → "ngang 5m còn dọc 16m cần bán gấp" | gọi "chú", xưng "cháu"; hỏi căn đó hay căn khác; mỗi ô một mảnh đọc được | ❌ 6 lỗi, vá cùng ngày: (1) "Dạ em chào chú" — xưng "em" với người xưng "chú", `xung_ho` null (cột chỉ có anh/chị); (2) câu rao suông ghi vào "thông tin bổ sung" của tin cũ, hai căn gộp một; (3) "nhà trong hẻm…" thành "nội thất không (nhà trống)", "240m2" thành diện tích đất; (4) "nhà ở từ năm 2019" vào "tiềm năng sử dụng"; (5) bong bóng 💾 ghi NGUYÊN câu "ngang 5m còn dọc 16m cần bán gấp" vào cả ô diện tích đất lẫn ô gấp; (6) `TS-VAN-06` từng vá "Căn số 14" chỉ cho câu diện tích, câu giá/kết cấu vẫn nhận 14. Sửa: `20260916a` + `khop-cau-tra-loi.ts` + `chat-reply` (chi tiết FR-176 c). Offline: bóc tách 231/231, van 144/144, e2e 368/368 (CHU-1…9). Dữ liệu thật của tin đã dọn tay bằng SQL trước khi vá (fact rác xoá, `area_m2` null, `floors` 5). **Bắn lại thật sau deploy #144** (`mau-chu-lon-tuoi`, giữ lại): lượt 1–4 đúng — gọi "chú", xưng "cháu", `xung_ho=chú · nam · lon_tuoi`, tin `BDS-NP-Q8-0002`; câu rao suông → "trước đó chú có căn hẻm 5m Phú Định, Phường 16 giá 6 tỷ. Căn chú vừa nhắc là căn đó hay căn khác ạ?" không ghi gì; "căn khác" → xin chi tiết; "Căn số 14 ở Ny'ah Phú Định, 80m2, giá 7 tỷ" → tin `BDS-NP-Q8-0003`, tin cũ giữ 6 tỷ. **Lượt 5 lộ 4 lỗi, vá cùng lượt**: (a) câu treo là LOẠI BĐS nên lời sửa FR-164 nuốt "diện tích tổng 240m2" → `area_m2 = 240`, mất fact sàn (nay lời sửa diện tích bỏ qua sàn/tổng-của-nhà-có-tầng); (b) ô loại BĐS ghi NGUYÊN câu (nay ghi tên loại DB đoán ra: "nhà phố"); (c) `boc_thong_so` phía DB đọc "nha trong" → `furnishing = khong` (`20260916b`); (d) kết cấu fact kèm "4 tam" mất dấu; thêm: tin mới mở trống `location_raw` vì `bocViTriRao` không nhận "Căn số 14 ở Ny'ah Phú Định". e2e CHU-8b, CHU-5 siết. **Bắn lại sau deploy #145**: lượt 5 đúng (💾 loại "nhà phố" · hẻm 5m · kết cấu "4 tấm" · diện tích sàn 240m2; `area_m2` giữ 80, không "nhà trống"); lượt 7 "shr, nhà ở từ năm 2019 rồi" → pháp lý "shr" · hiện trạng "nhà ở từ năm 2019 rồi". Lượt 8 "ngang 5m còn dọc 16m cần bán gấp" lộ lỗi thứ 5: chữ "cần bán" + `coLoaiBDS` bỏ dấu nhận "cần" như "căn" → bot hỏi "căn đó hay căn khác" thay vì ghi. Vá: rao suông đòi chữ loại RÕ (còn dấu), không số, không fact nào ngoài gấp (e2e CHU-7b/7c/7d); nhãn 💾 "diện tích sàn". **Bắn lại sau deploy #146**: "ngang 5m còn dọc 16m cần bán gấp" → 💾 diện tích đất "ngang 5m dài 16m" · gấp "cần bán gấp" · mặt tiền "ngang 5m dài 16m"; cột `frontage_m 5 · length_m 16 · gap true`, `area_m2` giữ 80. Tổng 8 lượt `mau-chu-lon-tuoi` đều đạt sau 3 PR (#167/#168/#169). **Zalo thật 13:36 (ảnh chủ dự án, "chưa được, bạn xóa data đi")** lộ 2 lỗi nữa: "Hello" khi đang chờ ảnh → 💾 "thông tin bổ sung: Hello" (nay lời chào suông là ack — `CHAO_SUONG_RE`); "Chào cháu cô có căn nhà này ở quận 5 cần giao bán gấp" → không hỏi căn nào mà ghi gấp + ĐỔI QUẬN tin cũ sang Quận 5 (số của quận/phường không phải chi tiết căn; e2e CHU-7e/7f). Dữ liệu số Zalo thật của chủ dự án đã XOÁ theo yêu cầu (tin `BDS-NP-Q5-0016`, 34 tin nhắn, hội thoại, hồ sơ người bán) — lần nhắn kế là khách mới. **Bắn lại trọn luồng từ khách MỚI** (`mau-chu-q8`, sau deploy #148, 12 lượt: Hello → "Chào cháu chú có căn nhà này cần giao bán" → hẻm 2 xẹc/4 tấm/240m2 → "Căn số 14 ở ny'ah phú định" → "shr, nhà ở từ năm 2019 rồi" → "ngang 5m còn dọc 16m cần bán gấp" → "phường 16 quận 8" → "Tầm 13 tỉ 500 triệu nhé" → "cô có căn nhà này ở quận 5 cần giao bán gấp" → "căn khác" → "nhà 60m2 hẻm 4m Nguyễn Trãi quận 5, giá 6 tỷ 5" → Hello): 10/12 đúng. Lộ thêm: (7) ô GIÁ nhận "quận 8" — lời sửa FR-164 bóc "phường 16", mảnh còn lại "quận 8" rơi vào câu giá đang treo (nay câu chỉ còn quận/phường là ack; quận đã có `capNhatQuan`); (8) trả lời vị trí "Căn số 14 ở Ny'ah Phú Định" không gắn dự án (chỉ khớp lúc rao) nên tin nằm "Quận 5 (chưa rõ quận)" tới khi khách nói quận — nay khớp `match_projects` ngay ở câu vị trí, lấy quận/phường của dự án khi tin còn mặc định; (9) chữ "căn Căn số 14" lặp. Vá cùng ngày (PR #172/#173), bắn lại sau deploy #149/#150: "phường 5 quận 5" khi đang hỏi giá → phường ghi, giá không đè, hỏi lại giá; "Căn số 14 ở ny'ah phú định" trả lời vị trí → tin gắn dự án Ny'ah Phú Định, Phường 16, Quận 8. **Đợt 2 ("test tiếp", sau deploy #150)** — (A) `mau-co-thue` cô CHO THUÊ căn hộ Q7 gõ nửa không dấu, 6 lượt; (B) `mau-bac-mua` bác TÌM MUA cho con, 3 lượt. B đúng cả 3 (xưng "bác", hồ sơ mua · Q8 · 7 tỷ · gần chợ · 3PN · chỗ đậu xe; trả lời từ kho dự án Ny'ah). A đúng 3/6: nội thất full, tầng 20 + view + gắn dự án Sunrise City; lộ 4 lỗi, vá cùng lượt: (10) câu rao "cô có căn chung cư ở q7 muốn cho thuê" ghi thêm ô TIỀM NĂNG (`laViecRao` nay nhận "muốn/cần/đang + bán/cho thuê"); (11) "à mà cháu là bot hay người vậy" được trả lời đúng nhưng vẫn ghi "thông tin bổ sung" (`laCauHoiTron`/`DAU_HOI_RE` biết "cháu là… / là bot / hay người"); (12) "cọc 2 tháng, ở tối thiểu 1 năm" → ô thời hạn ghi cả câu (nay chỉ mảnh); (13) "thôi để cô hỏi lại con cô đã" lúc KHÔNG có câu treo → model "cháu chờ" rồi hỏi luôn hướng ban công (nay hoãn ở mọi nhánh: đáp một câu, không hỏi thêm). Nhận xét thêm: câu phường bị hỏi lại 4 lượt liền vì khách toàn nói thứ khác — luật né-2-lần chỉ đếm câu lệch, chưa đếm câu hỏi ngược. **Chủ dự án chốt "làm cả 4"** → `20260916c` (gấp sau pháp lý, tiềm năng sang hỏi bù, căn hộ nội thất trước hướng) + né 1 lần trong chat-reply; e2e H4b/N6/N18 đổi kỳ vọng theo thứ tự mới, 374/374. **Chủ dự án tự test 17/09 09:43–09:48 (Zalo thật, khách mới sau khi xoá hết) — "chưa hề được"**, 7 lỗi: (14) tin gắn dự án Ny'ah mà quận vẫn "Quận 5" → BỎ HẲN mặc định Quận 5 (`20260917a`, FR-174 đợt 3); (15) "Nhà trong hẻm 2 xẹc nhưng hẻm rộng 5m…" trả lời câu phường → ĐÈ địa chỉ "Căn số 14 ở Ny'ah" bằng "hẻm 2 xẹc nhưng hẻm rộng" (nay "xẹc/nhưng" là từ dừng; đã có địa chỉ thì câu lệch không ghi đè); (16) "ngang 5m còn dọc 18m" khi đang hỏi phường → cột PHƯỜNG = "ngang 5m còn dọc 18m" (nay số kèm đơn vị không phải phường; ngang+dọc là diện tích); (17) đổi xưng "chú" → "cô" mà bot vẫn gọi "chú" (nay cách tự xưng mới nhất thắng); (18) "à mà cháu là bot hay người vậy Tr" → ghi bổ sung + bot nói "cháu là người hỗ trợ" (nay đuôi rác không làm mất câu hỏi; van chặn "cháu là người hỗ trợ/tư vấn"); (19) "srh" gõ lỡ không nhận là sổ hồng riêng; (20) model suy "nhà ở từ 2019 là đã có sổ hồng riêng" — chưa vá (prompt). **Zalo thật 16:42 (ảnh chủ dự án, sau deploy #154)**: câu treo là PHƯỜNG của căn "hẻm 4m Nguyễn Trãi" (sáng), chủ nhà nhắn "Chào cháu, cô có căn nhà hẻm 4m Trần Hưng Đạo quận 5, 50m2, giá 5 tỷ 8, mặt nhà quay về phía Đông, nhà mới sơn sửa lại" → 3 lỗi: (21) không nhận là căn KHÁC (chữ "có căn nhà" + giá, không có "thêm/nữa"), nguyên câu thành vị trí tin cũ (`location_raw` = cả câu, `street` = "Chào cháu"), 50m2 / 5 tỷ 8 đè tin cũ — nay câu rao mang địa chỉ ở ĐƯỜNG KHÁC căn đang hỏi là căn khác (`khacDuong` trong `raoMoiKhiDangHoi`), và mọi đường ghi vị trí từ câu dài chỉ lấy mệnh đề địa chỉ (`bocViTriRao`); (22) 💾 chưa báo hồ sơ — nay lượt mở hồ sơ / lượt ghi cách gọi có dòng `👤 Hồ sơ: Zalo: "…3339" · cách gọi: "cô"` (Zalo che còn 4 ký tự cuối); (23) câu hỏi phường dài, đọc mẫu ("cho cháu xin thêm phường cụ thể để cháu kiểm tra giá chính xác") — nay hỏi ngắn nhắc địa chỉ: "Hẻm 4m Trần Hưng Đạo đó phường mấy cô nhỉ?" (`cauPhuongNgan`, câu mẫu `phuong` đổi, DB `bot_prompts.cau_hoi_mau` đồng bộ md5 với code), model được dặn chép NGUYÊN VĂN câu hỏi kế. e2e CHU-10/10b, BLDL-12, PH-08 (381/381). Tin thật `BDS-NP-Q5-0002` dọn tay về trạng thái sáng (hẻm 4m Nguyễn Trãi · 60m² · 6 tỷ 5, 5 fact rác xoá). **Bắn lại sau deploy #155** (`mau-hai-can`, giữ lại): lượt 1 "Chào cháu, chú có căn nhà hẻm 4m Nguyễn Trãi quận 5, 60m2, giá 6 tỷ 5" → 💾 kèm `👤 Hồ sơ: Zalo: "…-can" · cách gọi: "chú"`, câu hỏi "Hẻm 4m Nguyễn Trãi đó phường mấy chú nhỉ?" (tin `BDS-NP-Q5-0004`); lượt 2 câu của chủ dự án nguyên văn → tin MỚI `BDS-NP-Q5-0005` (hẻm 4m Trần Hưng Đạo · 50m² · 5 tỷ 8, `street` = Trần Hưng Đạo), tin cũ giữ nguyên, 💾 `👤 Hồ sơ: cách gọi: "cô"`, 🤖 hướng "Đông", câu hỏi "Hẻm 4m Trần Hưng Đạo đó phường mấy cô nhỉ?"; không dòng lỗi. Câu hỏi của chủ dự án "lúc ghi có AI chuyển câu trả lời thành chuẩn dữ liệu không": KHÔNG — ghi là tiền định (regex `khop-cau-tra-loi.ts` + trigger DB `listing_facts_sync_cols`/`boc_thong_so`); AI bóc tách chỉ chạy bóng để so (FR-208, `boc_tach_ai`), không ghi **Zalo thật 18/09 08:53–09:13 (chủ dự án, DB trống, sau deploy #156)**: 9 lượt đúng luồng (rao → 💾 kèm 👤 Hồ sơ, 🤖 kiến thức, hỏi phường ngắn; "trệt 2 lầu, shr, nhà ở từ 2019 rồi, khu này yên tĩnh lắm" → kết cấu/pháp lý/hiện trạng luật ghi, 🤖 bổ sung; 3 phòng ngủ + tiện ích; sửa giá 6 tỷ; đổi "bác"; bản nháp có dòng `📝 Thêm`; gấp). Chủ dự án chê 2 điểm, vá cùng ngày: (24) bot khen ở 4/5 tin ("trông rất sáng sủa", "khách chốt nhanh lắm", "rất tiện cho gia đình") → `vuaKhen`/`boCauKhen` (FR-178 18/09), e2e KHEN-01/02; (25) tin 🆕 "Hồ sơ người bán MỞ TỪ CHAT… Bot đã báo họ nhãn và mức phí" gửi admin (chữ đã sai từ 09/09) → bỏ (FR-159 18/09), e2e ADMIN-01. |
| TS-VAN-10 | FR-211, FR-177 e/q, FR-176 c, FR-184, FR-164, FR-174 — bắn thật 20/09/2026 (07:58–08:12 UTC, deploy #159, 4 người thử `mau-y-A…D` chạy song song, 5 lượt mỗi người, kịch bản KHÁC hẳn các lượt trước): (A) môi giới gõ KHÔNG DẤU rao 2 căn trong một tin kèm SĐT ("can 1 nha hem 6m Ba Hat 4x14…, can 2 dat 5x20 duong Ly Thai To 12 ty, lien he 0912xxxxxx"), hỏi phí không dấu, trả lời phường/pháp lý theo "can 1 … can 2 …", nói quận muộn; (B) chị miền Bắc "mảnh nhà đất… ngõ 3 mét… sổ đỏ chính chủ… 5 tỉ 2… ngõ thông không ngập, gần trường cấp 1", rồi đổi BÁN → CHO THUÊ 15 triệu cọc 2 tháng, "phường 17 nhé, đường Phan Văn Trị", 3PN 2WC điều hoà, "tối chụp ảnh gửi, giờ đang bận"; (C) người MUA tìm theo NHÃN "Q5 khu yên tĩnh gần chợ xe hơi vào được nhà, tầm 7 tỉ, 3PN", hỏi căn cụ thể, nới ngân sách "8 tỷ rưỡi", xin số chủ nhà, "thôi khỏi, có căn báo"; (D) chủ nhà mặt tiền Nguyễn Chí Thanh "ngang 4 dài 15, giá 250 triệu/m2 thương lượng", trả lời phường kèm 7 fact một câu, sửa "dài 16 chứ không phải 15", kết cấu 5PN 6WC thang máy, rồi "bán rồi em, đừng rao nữa" | mỗi lượt có trả lời, đúng vai, cột đúng ô, nhãn gắn, không dòng lỗi | ✅ 20/20 lượt HTTP 200, 0 `bot_errors`. **Đúng**: NMG nhận vai `nmg`, mở 2 tin riêng, SĐT không lộ ra bong bóng; "sổ đỏ / ngõ 3 mét / xây 3 tầng / 5 tỉ 2" → có sổ · hẻm xe máy 3m · trệt + 2 lầu · 5,2 tỷ; đổi bán → thuê lật `deal` + giá 15 triệu + cọc; hồ sơ mua có `nhan` [yen_tinh, khong_ngap], ngân sách "7-8,5 tỷ", "chưa có căn nào khớp… có căn em báo"; D một câu 7 fact ghi đủ (phường, hướng, hoàn công → `has_completion`, full nội thất, thu nhập thuê 40 triệu → `rent_income_vnd`, gấp + lý do định cư, 2 mặt tiền → `corner_lot`), sửa dài 15 → 16 vào cột, "bán rồi" → `da_chot` + chúc mừng; lời hứa gửi ảnh → `reminders(promise)`. **10 lỗi thấy — chủ dự án 20/09 "vá hết 10 lỗi đi" → vá cùng ngày (e2e VA10-01…13, 404/404; `20260920a`)**: (1) "giá 250 triệu/m2" + ngang 4 dài 15 KHÔNG quy ra 15 tỷ (`price_vnd` null, "(chưa đọc ra số)"), trong khi "95 triệu/m2" + 5x20 ở lượt 18/09 quy được — luật nhân giá/m² chỉ chạy khi câu có "5x20", không nhận "ngang 4 dài 15"; và bản nháp 📋 vẫn gửi (75/100) dù giá chưa đọc ra; (2) câu sửa "à sửa lại, dài 16 chứ không phải 15" vào `bo_sung` và in ra 📝 Thêm của bản nháp; (3) "phường 17 nhé, đường Phan Văn Trị" → `location_raw` = "nhé, đường Phan Văn Trị", `street` = "nhé" (đuôi "nhé" đứng ĐẦU mệnh đề địa chỉ không bị cắt); (4) hỏi phí KHÔNG DẤU "phi ben minh sao, co bat ky doc quyen ko" không được nhận là câu hỏi ngược → ghi `bo_sung` + "Cảm ơn mình đã ghi nhận…"; (5) "ben q10" lúc rao và "ca 2 can deu quan 10 nhe" lúc sau đều KHÔNG vào `district` (2 tin mang mã `XX`), câu quận muộn bị bỏ qua vì câu chờ là loại BĐS; "dat 5x20" không dấu không nhận là đất; (6) "can 1 so hong rieng hoan cong du, can 2 tho cu 100% 2 mat tien": pháp lý vào đúng căn 1 nhưng `has_completion` lan sang căn 2 và 💾 in dưới tin căn 2; (7) khách mua "gần chợ xe hơi vào được nhà" → mốc "chợ chợ xe hơi, trong ~600 m" (`boc-gan` đọc "chợ xe hơi" thành tên mốc); (8) "có căn nào hẻm 4m Nguyễn Trãi không" → "để em kiểm tra rồi báo liền" hai lượt, chỉ tới lượt 4 mới nói thẳng "chưa có căn nào khớp"; xin số chủ nhà không được giải thích đường đi qua CTV; (9) "giờ đang bận" vẫn bị hỏi tiếp thời hạn thuê (FR-177 e hoãn chưa bắt "đang bận" khi kèm lời hứa); (10) lượt đầu B có cả 💾 lẫn "📝 Em ghi nhận" (FR-177 h nói bỏ 📝 khi đã có 💾). **Vá cùng ngày (từ điển nhãn, `nhan.mjs` 30/30)**: "ngõ thông" → `hem_thong`; "xe hơi vào ĐƯỢC/TỚI nhà" → `xe_hoi_vao_nha`; "gần chợ xe hơi vào" không còn bị loại vì "chợ xe". Dữ liệu 4 người thử đã xoá sau khi đo (2 nhắc · 61 tin nhắn · 4 hội thoại · 4 tin · 3 người bán · 1 khách mua); dữ liệu khác của chủ dự án giữ nguyên. **Cách vá từng lỗi**: (1) `ngangNhanDai` nhận "ngang 4 dài 15" → 15 tỷ; `guiBanNhap` từ chối gửi nháp khi `price_vnd` trống, báo thiếu "giá cả căn bằng con số" và mở lại câu giá; (2) `gonLoiSua` (khop-cau-tra-loi.ts) bỏ vỏ "sửa lại … chứ không phải", lời sửa kích thước → fact `mat_tien` đủ hai chiều (ngang lấy từ tin), xử TRƯỚC phân loại nên đang hỏi kết cấu cũng không bị nhận là kết cấu; (3) `TIEU_TU_DAU` cắt tiểu từ đứng đầu mệnh đề địa chỉ (`catDapAn` vi_tri + phần còn lại sau lời sửa); (4) `laCauHoiTron` nhận chủ ngữ không dấu "ben minh/cua em … sao", "co bat/tinh/lay … ko" → trả lời phí tiền định; (5) tin nhiều căn lấy quận của CẢ CÂU (`bocQuan`), mảnh "dat 5x20" không dấu → đất; `capNhatQuan` áp "cả 2 căn / cả lô / đều" cho mọi tin đang mở còn trống quận, chạy cả khi câu chờ là loại BĐS và báo "em ghi Quận 10 cho 2 căn"; (6) fact `nhan` không đi qua `listing_facts_sync_cols` (`20260920a` — tên nhãn không phải câu tả căn), nhãn gắn theo TỪNG mảnh "căn N …", 💾 theo căn tự soạn (tắt 💾 chung); (7) `lamSachTenMoc` (boc-gan.ts) bỏ chữ loại lặp và tên mốc là chữ tả nhà ("xe hơi", "vào được nhà") → "chợ, trong ~600 m"; (8) `HUA_CO_HANG` thêm "để em kiểm tra … rồi báo", "đang kiểm tra … sắp báo", "kiểm tra kho" → thay bằng "chưa có căn nào khớp" khi kho trống; câu xin số chủ nhà (`XIN_SO_CHU_RE`) → "bên em không gửi số chủ nhà qua chat, người phụ trách dẫn đi xem"; (9) nhánh hoãn đứng TRƯỚC luật hết hạn câu mềm, kèm lời hứa thì "em chờ … gửi"; (10) dòng "📝 Em ghi nhận" bị bỏ dù nằm chung bong bóng với lời chào. Offline: boc-cau-rao 66/66, boc-tach-42-ca 270/270, van-tra-loi 158/158, nhan 30/30, e2e 404/404, schema.sql khớp DB 160 hàm. **Bắn lại THẬT sau deploy #161** (20/09 11:42–11:48 UTC, `mau-z-A…D`, cùng 4 kịch bản, 14 lượt): 14/14 HTTP 200 — (1) "ngang 4 dài 15, giá 250 triệu/m2" → 💾 "giá 15 tỷ", bản nháp 85/100 với "💰 15 tỷ (còn thương lượng)"; (2) "à sửa lại, dài 16…" → 💾 "chiều ngang mặt tiền: ngang 4m dài 16m", cột `length_m` 16, không bổ sung, nháp không còn dòng "à sửa lại"; (3) "phường 17 nhé, đường Phan Văn Trị" → `street` = Phan Văn Trị; (4) "phi ben minh sao…" → "Dạ phí bên em chỉ thu khi giao dịch thành công, 0,5% giá chốt ạ"; (5) 2 tin đều Quận 10, căn 2 mã `BDS-DAT-Q10-0001` (đất); (6) căn 1 nhãn [đã hoàn công], căn 2 nhãn [căn góc, thổ cư 100%], `has_completion` căn 2 null, 💾 "căn 1 pháp lý: … · căn 2 diện tích thổ cư: 100%"; (7) hồ sơ mua "muốn ở gần: chợ, trong ~1 km"; (8) "có căn nào hẻm 4m Nguyễn Trãi không" → "chưa có căn nào khớp" ngay lượt 2; xin số → "bên em không gửi số chủ nhà qua chat…"; (9) "tối chị chụp ảnh gửi nhé, giờ đang bận" → "Dạ em chờ chị nha…", câu treo giữ, nhắc hứa 1; (10) lượt đầu B chỉ một 💾, lời chào đứng riêng. Sổ lỗi: 4 dòng `bridge escalation … Tham số không hợp lệ` (bridge gửi nhắc tới Zalo id GIẢ `mau-z-*`, Zalo từ chối; lặp mỗi phút tới khi dọn dữ liệu — cùng hình với 06:06 cùng ngày, không phải lỗi của bản vá). Dữ liệu 4 người thử đã xoá; DB còn đúng 1 tin của chủ dự án |
| TS-VAN-11 | FR-177, FR-159, FR-164, FR-211, FR-114 — bắn thật 21/09/2026 (04:47–04:55 UTC, deploy #161, `mau-w-E…H`, 3 lượt mỗi người, kịch bản chưa từng dùng): (E) tin rao kiểu Facebook nhiều emoji/xuống dòng "🏠 BÁN GẤP NHÀ Q6 📍 Hẻm 5m Phạm Văn Chí, P.7 📐 4.2 x 12, nở hậu 4.5 🏗 Trệt lửng 2 lầu, 3PN 3WC 📜 SHR, hoàn công 2021 💰 6.9 tỷ TL" rồi "phường 7 quận 6 đó em, nhà đang trống dọn vô ở liền", "à quên, nhà có gara…, đang thế chấp ngân hàng 1 tỷ, mua thì giải chấp"; (F) chủ ĐẦU TƯ "mình là chủ đầu tư dự án căn hộ ở Bình Tân, có 20 căn muốn đẩy qua bên bạn, phí sao" → "dự án tên là Aio Garden, giá từ 1 tỷ 8 căn 2PN, bàn giao quý 2 năm sau" → "vậy phí bao nhiêu, bên bạn có làm hợp đồng phân phối không"; (G) sinh viên THUÊ TRỌ gần ĐH SPKT Thủ Đức 2,5 triệu, hỏi "tính cả điện nước chưa ạ", rồi "thôi khỏi, em tìm được rồi"; (H) căn hộ The Sun Avenue đang cho thuê 14 triệu bán 3 tỷ 9, hỏi hỗ trợ vay, "khách chốt nhanh anh bớt 50 triệu", tầng 12 view hồ bơi phí QL 15k/m2 | đúng vai, cột đúng ô, câu hỏi ngược được trả lời | ✅ 12/12 HTTP 200, 0 `bot_errors`. **Đúng**: E lượt 1 bóc trọn 14 trường từ tin emoji (4.2×12, nở hậu 4.5, trệt lửng 2 lầu, 3PN 3WC, SHR + hoàn công, xây 2021, 6,9 tỷ TL) + gara → `car_in_house`; G ra đúng thuê · phòng trọ · 2,5 triệu · gần ĐH SPKT (mốc `truong_hoc`), "thôi khỏi" → chúc ngắn; H gắn dự án The Sun Avenue + phường An Phú, thu nhập thuê 14 triệu → `rent_income_vnd`, tầng 12 → `floor`, nội thất full, phí QL. **7 lỗi mới, chưa vá** (21/09 chiều: chủ dự án chốt ĐẢO TẦNG — FR-208 f, kiểm lại ở TS-AIBOC-07 thay vì vá từng luật): (1) H "khách chốt nhanh anh bớt 50 triệu" → fact `gia` = "50 triệu", 💾 "giá mong muốn: 50 triệu", bot "cảm ơn anh đã giảm 50 triệu" (cột giữ 3 tỷ 9 nhờ sàn parse_vnd) — "bớt/giảm N" là mức giảm, không phải giá; (2) F vai CHỦ ĐẦU TƯ không được nhận (mở tin căn hộ `du_an_ten` = "căn hộ ở Bình Tân"), "phí sao" ở câu đầu bị bỏ qua (lượt 3 model mới trả lời đúng "thoả thuận riêng"); (3) F "dự án tên là Aio Garden, giá từ 1 tỷ 8 căn 2 phòng ngủ, bàn giao quý 2 năm sau" → `street` = "quý 2 năm sau", fact giá "1 tỷ 8 căn 2 phòng ngủ"; (4) F "bên bạn có làm hợp đồng phân phối không" → fact `phap_ly` (cùng họ x-07 "hợp đồng 3 năm" — chữ "hợp đồng" bị coi là pháp lý, và câu hỏi ngược không được nhận); (5) E "phường 7 quận 6 đó em, nhà đang trống…" → phần dư "quận 6 đó em, nhà đang trống dọn vô ở liền" vào `bo_sung` nguyên văn và in ra 📝 Thêm của bản nháp; (6) E "đang thế chấp ngân hàng 1 tỷ" vào `bo_sung` (AI) dù có fact `the_chap`, bản nháp gửi ngay lượt đó không có dòng thế chấp; (7) G "2 triệu rưỡi là tính cả điện nước chưa ạ" là CÂU HỎI mà bot đáp "Dạ, 2,5 triệu chưa tính điện nước à" và ghi ngân sách "(chưa tính điện nước)"; G lượt 1 kho trống vẫn "để em coi có phòng nào… rồi báo" (`HUA_CO_HANG` thiếu "coi"). Dữ liệu 4 người thử đã xoá |
| TS-RAO-01 | FR-144, FR-172, FR-174 — bắn 14 tin RAO BÁN thật (`ban-ban.mjs`: mặt tiền đang cho thuê, căn hộ có tầng + mã căn, cấp 4 hẻm ba gác sổ chung, rao kiểu Facebook, đất nền giá/m², hẻm xe hơi "tỏi", môi giới, hai căn một tin, sang nhượng mặt bằng, Thủ Đức phường tên chữ + m², rao từng mẩu, giá/m² + cọc, biệt thự, đổi giá + đổi loại) rồi chụp DB từng cột; offline `bun bot/tests/boc-cau-rao.mjs`; SQL `20260914b` chạy thử trong giao dịch rollback | deal/giá/diện tích/phường/đường/dự án đúng như câu rao; không có cọc, phí sang, tiền thuê đang thu nào thành giá; câu bổ sung vào đúng ô và đúng cột | ✅ 14/09 lượt a (trước vá): 6 lỗi ghi sai DB (mặt tiền 32 tỷ thành tin thuê 45 triệu; sang nhượng mặt bằng thành tin bán; dự án "Căn Hộ Cao Cấp Huỳnh Tấn Phát" gán cho nhà phố đường Huỳnh Tấn Phát; "62,5m²" không có diện tích; "hẻm 2m5" không lưu, hỏi lại; "Phạm Thế Hiển" → "Phạm", "Cộng Hòa" → "Tân Bình đường Cộng") + nhẹ (95tr/m² không ra giá, "p5" dính tên đường → hỏi phường 3 lần, emoji trong fact, xe hơi trong nhà thành hẻm xe hơi); sau vá offline 43/43, e2e 331/331; còn treo: hai căn một tin chỉ lưu căn đầu; lượt b (sau PR #134): 13/14 tin đúng từng cột như câu rao; lộ thêm 2 lỗi — "đất trống" thành PHÒNG TRỌ (`guess_property_type_answer` so `tro`/`kho`/`pho` không ranh giới từ → `20260914c`) và căn S1.02 đã có tin khác → `listings_project_unit_uniq` chặn, tin MẤT, bot trả câu chào khuôn (nay tạo tin bỏ mã căn trùng, ghi `boc_tach.ma_can_trung_tin_khac`; mock e2e mô phỏng khoá đó, TRUNGCAN-01; V48-114 từng xanh lạc quan vì rao lại đúng căn đã có) — e2e 332/332; lượt c: đo sau deploy |
| TS-AIBOC-01 | FR-208 (b): offline `bun bot/tests/kiem-bang-chung.mjs` — đề xuất bịa (giá trị không có trong tin, trích dẫn bịa, trích dẫn có thật nhưng giá trị đọc ra khác, cụm tiền cọc/phí sang làm giá, tiền thuê đang thu làm giá tin bán, quận không khớp cụm) phải BỎ kèm lý do; đề xuất đúng (giá, diện tích ngang×dài, "2m5", phường chữ, tên đường, loại BĐS, gấp) phải ĐẠT; `soSanhVoiDb` ra trung/lech/ai_them đúng | 0 đề xuất bịa lọt vào `dat` | ✅ 14/09 46/46 (16 ca bịa / gán nhầm ô đều bị bỏ đúng lý do) |
| TS-AIBOC-02 | FR-208 (c): e2e `bot/tests/e2e/run.mjs` AIBOC-01…03 — công tắc `bong`: mock model trả đề xuất đúng + bịa → một dòng `boc_tach_bong` có `dat`/`bo`/`so_sanh`, tin rao vẫn tạo như cũ, không cột nghiệp vụ nào đổi vì AI; công tắc `tat` → không gọi model bóc; model ném lỗi → khách vẫn được trả lời, lỗi vào sổ | lượt chạy bóng không đổi DB nghiệp vụ, không làm hỏng lượt trả lời | ✅ 14/09 e2e 336/336 (AIBOC-01…03; TOIUU-07/07b +1 truy vấn song song đọc công tắc) |
| TS-AIBOC-03 | FR-208 (d): bắn lại 14 tin bán + 20 tin (`ban-ban.mjs`, `ban-20.mjs`) với `boc_tach_ai = bong`, đọc `boc_tach_bong`: đếm đề xuất / bị bỏ theo lý do / đạt mà sai so với câu rao (soi tay) / AI thêm trường luật thiếu / lệch | số trường đạt mà sai = 0 mới được bàn bước 2 | 🟡 14/09 lần 1 (sau PR #137, 33 lượt, 203 đề xuất): 174 đạt / 29 bỏ; bỏ đúng — bịa "bán" khi tin không có chữ bán, "thương lượng" từ "hoa hồng", "gấp" từ "để ở hoặc cho thuê đều được", loại "cấp 4" từ "4x16", độ rộng hẻm = "ba gác"; bỏ OAN 17 (giá số trần "5.2", quận "5", cọc "2 tháng"); **đạt mà sai ~13** (số tầng quên trệt ×5, "sang nhượng mặt bằng" thành bán, phí sang 350 triệu thành giá, thu nhập thuê ở tin sang nhượng, "view sông" vào hướng, "Thảo Điền" thành dự án, "thổ cư hết" vào pháp lý, "xây tự do" vào kết cấu, "gấp" vào lý do bán) → siết bộ kiểm + câu dặn (kiem-bang-chung 70/70, gồm 24 ca rút từ lượt đo); AI thêm đúng: đường nhựa 7m, mã căn S1.02, KDC Trung Sơn; lần 2 (sau PR #138, 33 lượt): 196 đề xuất → 186 đạt / 10 bỏ, so DB 173 trùng; **đạt mà sai 2** ("phí sang 350 triệu" thành tiền cọc, "để ở hoặc cho thuê đều được" vào nội thất) → vá (cọc phải có chữ cọc, hình dạng ô nội thất; so DB đọc "2m5" = 2.5), kiem-bang-chung 75/75; AI tách đúng căn thứ 2 của tin "bán 2 căn" (luật làm mất căn này); lần 3: đo sau deploy |
| TS-AIBOC-04 | FR-208 (d) bước 2: `boc_tach_ai = ghi` — rao có ý luật KHÔNG bắt ("mặt nhà quay về phía Đông Nam", "nhà mới sơn sửa lại"; đo bằng `nhanDienNhieuFact`), model đề xuất giá (luật đã ghi) + hướng + hiện trạng + pháp lý bịa | hướng, hiện trạng vào `listing_facts` nguồn `ai_kiem`; giá không đụng; pháp lý bịa bị bỏ; dòng 🤖 nêu đúng hai trường, đứng ngay sau 💾, 💾 không lặp; tin "ok em" không gọi model; `chonDeGhi` offline: trùng/lệch không ghi, sàn không phải đất, ngoài khoảng bỏ, khoá không có chỗ ghi bỏ, căn thứ 2 bỏ, giá thuê ngoài khoảng bỏ | ✅ 17/09/2026: e2e AIBOC-04/04b/05 (377/377), `kiem-bang-chung.mjs` 84/84 (9 ca `chonDeGhi`). **Bắn thật sau deploy #154** (`mau-ai-ghi`, giữ lại): "Chào cháu, chú cần bán căn nhà hẻm 5m Nguyễn Trãi quận 5, 60m2, giá 6 tỷ 5, mặt nhà quay về phía Đông Nam, nhà mới sơn sửa lại" → model 8 đề xuất đạt, 1 bỏ (loại `nha_cap4` từ "căn nhà"); 6 trùng luật (bán, hẻm 5m, đường, quận, 60m2, 6 tỷ 5) không đụng; 2 `ai_them` → ghi `huong = Đông Nam`, `hien_trang = mới sơn sửa lại` nguồn `ai_kiem`, cột `direction` = Đông Nam; khách thấy "🤖 AI đọc thêm (đã kiểm): hiện trạng nhà: \"mới sơn sửa lại\" · hướng: \"Đông Nam\"" ngay sau 💾; lượt AI 965 ms, không dòng lỗi |
| TS-AIBOC-05 | FR-208 (e) AI đọc trước, luật lưu: câu treo PHÁP LÝ, chủ nhà "shr, nhà ở từ 2019 rồi, gần chợ Bình Tây, khu này yên tĩnh lắm"; model trả phap_ly "sổ hồng riêng" (trích "shr"), hien_trang, view "view sông" (bịa), kien_thuc ["gần chợ Bình Tây", "khu này yên tĩnh lắm"] | pháp lý ghi "sổ hồng riêng" nguồn seller_chat (AI chuẩn hoá, luật lưu), câu treo answered; hiện trạng + tiện ích gần do luật bắt kèm ghi một lần; view bịa không ghi; "khu này yên tĩnh lắm" → bo_sung nguồn ai_kiem, 🤖 nêu; "gần chợ Bình Tây" đã ở ô tiện ích → không bổ sung lần hai; nhắn lại y chang không ghi trùng; bản nháp có dòng `📝 Thêm` gom bo_sung cũ trước không lặp; offline: chuẩn hoá pháp lý cùng mã đạt, khác mã bỏ; kiến thức bịa bỏ, tối đa 3 | ✅ 17/09/2026: e2e AIBOC-06/07/07b (384/384), kiem-bang-chung 93/93, tin-nhap-rao 16/16. **Bắn thật sau deploy #156** (`mau-ai-truoc`, xoá lại sau khi đo để chủ dự án test từ DB trống): rao → 💾 kèm `👤 Hồ sơ`, câu hỏi kết cấu; "trệt 2 lầu, shr, nhà ở từ 2019 rồi, khu này yên tĩnh lắm" → 💾 kết cấu "trệt 2 lầu" · pháp lý "shr" · hiện trạng "nhà ở từ 2019 rồi" (luật; cột `floors` 3, `legal_status` so_hong_rieng), 🤖 thông tin bổ sung "khu này yên tĩnh lắm" (bo_sung, ai_kiem), lượt AI 534 ms, không dòng lỗi. Ghi nhận: model câu hỏi kết cấu chép "Nhà cháu xây mấy tầng rồi cô?" thay vì "Nhà mình…" (đổi "mình" thành "cháu") — chưa vá |
| TS-AIBOC-06 | FR-208 (f) chế độ `chinh`: offline `bun bot/tests/kiem-bang-chung.mjs` (`docAiChinh`, câu treo mặt tiền / `AxB`, `KHOA_FACT_AI_BIET`) + e2e AIBOC-08…12: rao "bán căn hộ 2 phòng ngủ đường Nguyễn Lương Bằng quận 7, giá 1 tỷ 8 căn 2 phòng ngủ, bàn giao quý 2 năm sau" (mock AI đủ 6 trường + kiến thức); câu treo giá "khách chốt nhanh anh bớt 50 triệu" (AI không thấy giá); câu treo pháp lý "bên em có làm hợp đồng phân phối không" (AI rỗng); câu treo kết cấu "1 trệt 2 lầu, 3 wc, hướng đông"; model bóc chết | giá 1,8 tỷ, căn hộ, Quận 7, 2 PN, địa chỉ = "Nguyễn Lương Bằng", không cột/fact nào mang "quý 2" (trừ `bo_sung` nguồn ai_kiem), `da_ghi.che_do = chinh`, `boc_tach.nguon = cau_rao+ai_chinh`; KHÔNG ghi giá "50 triệu", câu giá vẫn treo, `bo_sung` một lần; KHÔNG ghi pháp lý; kết cấu ghi "1 trệt 2 lầu" nguồn seller_chat, WC + hướng nguồn ai_kiem mỗi ô một lần; model chết → luật đỡ (6 tỷ, Quận 5, Trần Hưng Đạo), lỗi vào sổ | ✅ 21/09 offline 103/103, e2e 458 ✓ (410 ca + cổng), `test:bot` xanh |
| TS-AIBOC-07 | FR-208 (f) bắn thật 15 tin trên production 21/09/2026 (05:33–05:41 UTC, deploy #162, `boc_tach_ai = chinh`, Zalo giả `mau-v-01…11`): 11 câu rao — 10 loại BĐS (nhà phố emoji FB, căn hộ Sunrise Riverside "giá 2 tỷ 9 căn 2 phòng ngủ, bàn giao quý 2 năm sau", đất không dấu "5x20 gia 32 trieu/m2", nhà cấp 4 "đang thế chấp ngân hàng 1 tỷ", villa Thảo Điền, phòng trọ không dấu "2tr8/thang coc 1 thang", sang nhượng mặt bằng "phí sang 350 triệu", toà CHDV "thu nhập 180 triệu/tháng", đất vườn Củ Chi, kho xưởng KCN) + chủ đầu tư "20 căn… phí sao?"; 4 câu nối: "phường 7 quận 6 đó em, nhà đang trống dọn vô ở liền" (câu treo ảnh), "khách chốt nhanh anh bớt 50 triệu" (câu treo nội thất), "bên em có làm hợp đồng phân phối không" (câu treo phường), "ngang 5 dài 20 nha, hẻm xe hơi, để em coi lại sổ rồi báo" (câu treo phường) | mỗi tin: cột lõi đúng câu rao, không fact rác từ luật tìm-chuỗi; 7 lỗi TS-VAN-11 hết | ✅ 15/15 HTTP 200. **Đúng**: 10/10 loại BĐS đúng cột `property_type`; 10/10 giá đúng `price_vnd` (2 tỷ 9 không còn đuôi "căn 2 phòng ngủ"; 32 triệu/m² × 5x20 = 3 tỷ 200; 2tr8 thuê; 60 triệu/tháng, phí sang không thành giá); 10/10 quận (Quận 6/7, Huyện Nhà Bè + xã từ dự án, Huyện Bình Chánh, Quận Bình Tân, TP Thủ Đức ×2, Quận 5, Quận Phú Nhuận, Huyện Củ Chi, Quận Tân Bình); "bàn giao quý 2 năm sau" / "đang thế chấp ngân hàng 1 tỷ" / "24 phòng full khách" → `bo_sung` nguồn ai_kiem, KHÔNG thành tên đường; TS-VAN-11 lỗi (1) "bớt 50 triệu" không còn thành giá (AI không thấy giá → câu vẫn treo, nguyên văn vào bổ sung, model đáp "Em hiểu anh muốn bớt giá nếu khách chốt nhanh"); lỗi (3) đuôi giá hết; lỗi (4) "hợp đồng phân phối" không thành pháp lý; lỗi (6) thế chấp → bổ sung. **Vết mới, đã vá cùng lượt (PR sau #195)**: (a) `docAiChinh` lúc tạo tin không biết bán/thuê → "2tr8" bị coi ngoài khoảng giá bán → luật đỡ, `price_raw` = "2tr8/tháng coc 1 thang gio giac tu" (cột số vẫn 2,8 triệu) — nay khoảng giá theo `loai_giao_dich` AI đọc / luật; (b) câu treo thuộc `CAU_KHONG_LAY_AI` (phường, ảnh) đi hẳn đường luật nên fact kèm vẫn là luật: "hẻm xe hơi" → độ rộng hẻm, phần dư "quận 6 đó em, nhà đang trống…" → bổ sung (lỗi TS-VAN-11 (5) còn) — nay AI vẫn quyết fact kèm, chỉ không quyết giá trị câu treo; (c) AI đọc hiện trạng = "xe hơi" từ "hẻm xe hơi" lọt kiểm (chữ có trong cụm) — thêm hình dạng `hien_trang`; (d) kiến thức "để em coi lại sổ rồi báo" (lời hứa) vào `bo_sung` — `kiemKienThuc` bỏ lời hứa / lời nói chuyện; (e) một dòng sổ đo `boc_tach_bong` mất vì jsonb từ chối `\u0000` trong chuỗi model trả — lọc trước khi ghi (`bot_errors` 1 dòng, không đụng tin rao). **Còn lại, ngoài phạm vi đảo tầng**: vai CHỦ ĐẦU TƯ (TS-VAN-11 (2): AI báo `so_can = 20` nên đứng ngoài, luật vẫn mở tin lẻ "Căn hộ bán · Quận Bình Tân", `du_an_ten` = "căn hộ ở Bình Tân"; phí có trả lời nhưng nói 1% — CĐT/NMG là 0,5%); model đáp "Dạ có, bên em hỗ trợ ký hợp đồng phân phối" (nói bừa — cần câu tiền định trong `dapHoiNguocTienDinh`); "để em coi lại sổ rồi báo" không có mốc giờ nên không đặt nhắc (PROMISE_RE cần thời điểm); fact `san_vuon` luật ghi CẢ CÂU rao (v-05); "xã Trung Lập Thượng", "300m2 thổ" chưa vào ô (v-09); mã tin `BDS-NP-…` cho đất nông nghiệp / kho xưởng (tiền tố mã theo loại chưa có). **Kiểm chứng sau deploy #163 (05:49 UTC, tin thứ 16, mau-v-05 câu treo phường)**: "ngang 10 dài 20 nha, hẻm xe hơi, để em coi lại sổ rồi báo" → chỉ một fact `dien_tich = 10x20` nguồn ai_kiem (frontage 10 / length 20), không độ rộng hẻm, hiện trạng "xe hơi" bị bỏ `gia_tri_khong_dung_loai_truong`, kiến thức rỗng, câu phường vẫn treo, 0 `bot_errors`. Dữ liệu `mau-v-*` đã xoá sau khi đo. |
| TS-PROMPT-01 | FR-200: mở `/admin/prompt` bằng tài khoản admin, sửa một khoá rồi nhắn thử bot; sửa một khoá thành rỗng | 12 khoá hiện đủ kèm nhãn khớp/lệch; lưu xong bot đổi giọng trong ≤60 giây; ô rỗng bị hàm từ chối (`22023`) | ⏳ đo cùng lượt bắn tin sau khi merge |
| TS-DUYET-01 | FR-201: ở `/admin/ro-hang` thử đổi trạng thái một tin `cho_thong_tin` sang *đang bán* bằng dropdown; rồi mở Sửa và bấm *Duyệt & rao tin* trên một tin thiếu mô tả | dropdown KHÔNG cho chọn (kèm chữ “qua nút Sửa”); nút duyệt hỏi xác nhận và nêu đúng ô còn thiếu trước khi rao | ⏳ đo cùng lượt bắn tin sau khi merge |
| TS-NHAC-CLONE-01 | FR-202: một lịch xem của người thử cho một tin có chủ nhà mang Zalo ID; kéo `due_at` nhắc khách về hiện tại rồi gọi `nudge` với `force` | nhắc khách có `noi_dung_gui`, vẫn `pending`, lượt `nudge` sau KHÔNG nhận lại; có thêm đúng một dòng nhắc chủ nhà (`seller_id`, không `viewing_id`); `escalation-feed pull` trả cả hai kèm Zalo ID, dòng người mua `phone = null`; ack → `sent` + một dòng bot trong hội thoại | ⏳ đo sau khi quét lại Zalo clone |
| TS-QR-01 | FR-203: bấm *Đăng nhập lại* ở `/admin` (hoặc để phiên hết hạn) | trong lúc chờ quét: thẻ *Trợ lý AI Bot* đỏ *Đang lỗi · Zalo clone: Chờ quét mã QR*, ô QR nằm đầu trang ở mọi tab, tab *Vận hành* có chấm đỏ; trong ≤ 5 phút ô *Zalo clone* hiện mã QR; quét bằng acc clone → *Đã quét* → *Đã đăng nhập*, ảnh QR biến khỏi bảng; khoá công khai đọc `bridge_dang_nhap` bị chặn | ⏳ đo lượt quét lại 11/09 |
| TS-MIG-01 | Cổng CI thứ 7 (`bun run soat:migration`): giấu một file migration đi rồi chạy; thêm một file lạ rồi chạy; đủ cả rồi chạy | thiếu file → thoát 1 kèm tên; file lạ → thoát 1; đủ → thoát 0. Đọc DB bằng KHOÁ CÔNG KHAI qua `liet_ke_migration_cong_khai()` (chỉ version + name, không có nội dung DDL) nên CI không cần secret | ✅ 10/09 đo cả ba chiều: 1 · 1 · 0 |
| TS-MIG-02 | Cổng CI thứ 7, phép mới (review code 13/09): `soat-migration.mjs` so md5 TỪNG THÂN HÀM `bot/supabase/schema.sql` ↔ DB qua `ham_md5_cong_khai()` (`20260913c`, khoá công khai). Chạy với schema.sql vừa sinh bằng `node scripts/sinh-schema.mjs`; rồi thay bằng schema.sql của commit `2dec9e0` (trước khi sinh lại) | sinh lại → ✓ khớp DB 156 hàm, thoát 0; bản cũ → ✗ 9 hàm khác thân (`parse_vnd`, `chuan_hoa_gia_raw`, `doc_gap`, `guess_property_type`, `trg_vi_tri_vao_cot` — đúng 5 hàm review nêu — cùng `boc_ten_duong`, `boc_thong_so`, `listing_facts_sync_cols`, `ngu_canh_tin`), 1 hàm DB có mà file thiếu, 1 hàm file có mà DB đã bỏ, thoát 1. Phép cũ so MTIME luôn xanh sau `git clone` | ✅ 13/09 đo cả hai chiều: 0 · 1 |
| TS-DB-01 | Cổng CI thứ 8 (`bun run soat:db`): tám phép soát chỉ đọc qua `soat_db_cong_khai()` — policy phủ khoá · view thiếu security_invoker · hàm trùng chữ ký · bảng thiếu khoá chính · definer thiếu search_path · RLS bật không policy · trigger sai thứ tự · gửi quá 2 tin/ngày. Bỏ một dòng khỏi bản nền rồi chạy lại | mọi phép chạy dưới 1 giây; trùng bản nền → thoát 0; khác bản nền → thoát 1 nêu đúng phép nào; không gọi được hàm → thoát 2 ("chưa kiểm được", không phải "đạt") | ✅ 10/09: 0,5s · 5/8 sạch · 3 phát hiện đã biết · bỏ 1 dòng nền → thoát 1 |
| TS-KIEU-01 | Tầng bốn · cổng CI thứ 9: `bun run kieu:bot` (`deno check --node-modules-dir=auto` trên cả 9 edge function) | 0 lỗi kiểu | ✅ 11/09: lần bật đầu ra 15 lỗi — tất cả là kiểu KHAI SAI so với dữ liệu thật (RPC trả `r_dead` mà kiểu không có, select có `created_at` mà kiểu không có…), không cái nào là lỗi chạy; sửa xong 0 lỗi |
| TS-LUAT-01 | Tầng bốn · cổng CI thứ 10: `bun run doi-chieu:tien` — một bảng ca `bot/tests/luat/tien.json`, chạy qua TS `docTien` (`luat-tien.ts`) và SQL `parse_vnd` (qua `doi_chieu_tien_cong_khai`, 20260911a) | hai bản ra cùng một số trên mọi ca và khớp `mong`; lệch là đỏ, dòng đỏ nói bản nào lệch; không gọi được SQL → thoát 2 | ✅ 11/09: 21/21 · 13/09: 42/42 (+4 ca "1t2l" = 1 trệt 2 lầu, không phải 1,2 tỷ — `20260913b`) |
| TS-LUAT-02 | Tầng bốn: `bun bot/tests/luat-pha-du-lieu.mjs` — bảng `bot/tests/luat/khong-duoc-kich.json` cho 5 luật tìm-chuỗi mà khớp là ĐỔI DỮ LIỆU (`laNgungRao` · `bocQuan` · `laDuRoi` · `laDongY` · `laGap`) | mọi câu `phai_kich` khớp, mọi câu `khong_duoc_kich` KHÔNG khớp, mỗi luật ≥ 8 câu phủ định; canh cửa: số chỗ ghi đè dữ liệu trong chat-reply tăng mà bảng không thêm luật là đỏ | ✅ 11/09: 70/70 · 15/09: 105/105 (+3 phải kích, +7 không được kích cho `bocQuan`: phường mới trùng tên quận cũ — bắt tại trận "phường Tân Phú" đè Quận 7) |
| TS-LUAT-03 | Tầng bốn: `bun bot/tests/luat-lien-he.mjs` — luật che SĐT/mạng xã hội MỘT NGUỒN (`luat-lien-he.ts`) cho web và bot, trên đúng hai nhãn hai bên dùng | SĐT + zalo cùng câu ra hai nhãn KHÔNG lồng nhau; lọc lại kết quả không đổi gì; không đụng giá, diện tích, số nhà ngắn | ✅ 11/09: 11/11 — lượt gom bắt được lỗi LỒNG NHÃN có sẵn trên main từ 02/09 · 13/09 (review code): 31/31 — thêm 10 câu KHÔNG được làm hỏng (chữ sau "Zalo" bị nuốt: "Chat Zalo trao đổi" → "[L] đổi"; giá "10.000.000.000" bị che thành SĐT) và 10 câu VẪN phải che (zalo kèm số/ID, SĐT có chấm, +84, máy bàn) |
| TS-DON-01 | FR-197: gọi `don_du_lieu_thu()` khi kho đang sạch, rồi gọi lại sau khi bắn vài tin thử | lần đầu trả 0 mọi ô và ghi `app_config.don_thu_lan_cuoi`; lần sau xoá đúng người thử, giữ nguyên dự án và CTV | ✅ 10/09 lần đầu (0 dòng, có ghi dấu); lần sau đo cùng lượt bắn tin tối nay |
| TS-GROQ-01 | FR-194: gọi Groq bằng đúng khuôn prompt người bán (câu hỏi bắt buộc "sổ hồng riêng chưa, hoàn công chưa") trên 3 model | model giữ đúng câu hỏi cuối, giọng tự nhiên, dưới 30 từ | ✅ 10/09: qwen3.8-27b đạt (465 ms), gpt-oss-120b đạt (1.3 s), gpt-oss-20b TRẢ RỖNG — không dùng |
| TS-GROQ-02 | FR-194: đầu ra có khuôn (`response_format json_schema`) cho hồ sơ người mua | JSON đúng schema, đọc được | ✅ 10/09 (đúng khuôn; chất lượng bóc kém hơn model chính — đã có lưới regex `regexProfileFallback`) |
| TS-GROQ-03 | FR-194: lượt có ẢNH khi đang chạy dự phòng | ném lỗi → tầng gọi cất ảnh vào bucket RIÊNG TƯ (FR-185), KHÔNG bịa nhãn ảnh | ⏳ chờ ảnh thật qua Zalo |
| TS-GROQ-04 | FR-194 b: `bun bot/tests/thu-tu-model.mjs` — Groq giả qua `globalThis.fetch`, Claude giả đếm lượt gọi: Groq trả lời · m1 429 → m2 · m1 413 → m2 · cả danh sách 429 · 5xx với `parse` · 400 không phải nhịp · lượt có ảnh · Groq trần + Claude hết tiền · không khoá Claude · đường cũ `claude` (trả lời / 429 / 400 sai tham số) · không truyền thứ tự | Groq trả lời được thì Claude 0 lượt; hết danh sách thì Claude đúng 1 lượt cùng loại (`create`/`parse`), `ghiSo` 0 dòng; ảnh → Claude, Groq 0 lượt; cả hai hỏng → ném lỗi Claude; đường `claude` giữ y như cũ (ghi sổ 1 dòng khi đổi, 400 không đổi); FR-194 c: `giaiThamChieu` giải `$ref` giữ description, trả `enum` về chỗ (có/không mô tả phía trước), không đụng `{minimum…}`, JSON hỏng để nguyên; body gửi Groq không còn `$ref`/`$defs` | ✅ 15/09: 14/14 · sau FR-194 c: 22/22 · thêm ca 413 xoay model: 23/23 |
| TS-GROQ-05 | FR-194 b: sau deploy `chat-reply`, bắn một tin thử qua `net.http_post` rồi đối chiếu `bot_usage` (delta cache_write/cache_read = 0, in/out > 0) và log edge function; thăm dò Groq trực tiếp bằng `net.http_post` với 5 khuôn schema (có `$ref` · anyOf giải `$ref` · type mảng · enum-nullable của boc-gan · object-nullable của phan-loai-anh) | bot trả lời; token ghi sổ KHÔNG có cache (Groq); không dòng `bot_errors` mới; khuôn có `$ref` là khuôn DUY NHẤT Groq từ chối | ✅ 15/09 06:41 UTC (deploy #125): bot trả lời đúng, 0 `bot_errors`, cache delta 0 — NHƯNG log ghi "Groq 400 invalid JSON schema … /truong/items/properties/can" rồi rơi về Claude ở lượt bóc tách → đẻ ra FR-194 c; thăm dò: `$ref` 400, bốn khuôn kia 200; thiếu enum thì model bịa giá trị ngoài danh sách |
| TS-GROQ-06 | FR-194 c: bắn lại tin rao thử sau deploy, đọc log edge function | KHÔNG còn dòng "Groq chan tran/hong" cho lượt bóc tách; tin rao lưu đúng | ✅ 15/09 06:49 UTC (deploy #126): tin "căn hộ 2PN 68m2 quận 7, tầng 12, sổ hồng riêng, 3 tỷ 2" lưu đúng 7 trường, hỏi tiếp phường; log edge function không có dòng đổi sang Claude; `bot_health(model_chinh)` giữ nguyên dấu 06:41 (Claude không được gọi); `bot_usage` +1 lượt, +5.366 in / +343 out, cache 0; 0 `bot_errors` |
| TS-PHUONG-01 | FR-209: `bun bot/tests/tra-phuong.mjs` — phần thuần: JSON thật Nominatim "Lê Văn Việt" → Phường Tăng Nhơn Phú; Hà Nội / cả thành phố / không tiền tố → null; "Đường số 7" không tra; câu sửa "không, phường long trường" → tên; URL ghim `countrycodes=vn`; câu xác nhận < 30 từ | 22/22 · 28/28 sau FR-209 d (+"xã Tân Kiên đó em" → Xã Tân Kiên, "phường Tân Phú nha em ạ", "An Phú Đông" giữ nguyên) | ✅ 15/09 |
| TS-PHUONG-02 | FR-209: e2e PH-01…09 (Nominatim giả qua `globalThis.__nominatim`, `wards` seed 2 dòng): rao có đường không quận → hỏi xác nhận, chưa ghi, gọi Nominatim đúng 1 lần bằng tên đường; gật → ward/district/quan_mac_dinh/gợi ý; "phường 8 quận 5" → đường cũ; "phường long trường" → tên chuẩn + quận từ `wards`; Nominatim 404 / `wards` trống → hỏi như cũ, 0 `bot_errors`; câu rao có quận → không gọi; hỏi phường mà trả lời địa chỉ → ghi vi_tri, hỏi xác nhận, ward trống | 11 ca | ✅ 15/09 (347/347 e2e) |
| TS-PHUONG-03 | FR-209 DB thật: `select count(*), count(lat) from wards`; `select ten, quan_cu from wards where ten in ('Tăng Nhơn Phú','Sài Gòn','Bình Phú','Tam Bình','Củ Chi')`; khoá công khai `select * from wards` | 168 / 163; Quận 9 · Quận 1 · Quận 6 · Quận Thủ Đức · Huyện Củ Chi; anon bị chặn | ✅ 15/09: 168 / 163; đúng 5/5; khoá publishable → HTTP 401 `permission denied for table wards`. DDL áp qua MCP, 168 dòng qua `execute_sql` (4 lượt). **Còn nợ:** `schema.sql` chưa sinh lại (cần service_role trên máy chủ dự án: `node scripts/sinh-schema.mjs`) — cổng CI thứ 7 chỉ so md5 hàm nên không đỏ, nhưng `schema.sql` đang thiếu bảng `wards` |
| TS-PHUONG-04 | FR-209 Zalo thật sau deploy `chat-reply`: nhắn "hello" rồi "bán căn hộ 5 tầng sổ hồng riêng, đường Lê Văn Việt, 60m2, 5 tỷ"; trả lời "đúng rồi" | bong bóng 💾 KHÔNG còn "Quận 5 (chưa rõ quận)" ở lượt sau; câu hỏi đầu "Em tra thấy đường Lê Văn Việt thuộc Phường Tăng Nhơn Phú (Quận 9 cũ), đúng không anh?"; sau gật: `ward = Phường Tăng Nhơn Phú`, `district = Quận 9`, mã tin `BDS-CH-Q9-…`, `bot_errors` 0 dòng mới | ✅ 15/09 03:10 UTC, production sau `deploy-bot` #123 (người thử `thu-hv-92`, `net.http_post`): lượt 1 → "💾 Đã lưu: … đường Lê Văn Việt, Quận 5 (chưa rõ quận)…" + "Em tra thấy đường Lê Văn Việt thuộc Phường Tăng Nhơn Phú (Quận 9 cũ), đúng không ạ?" (street = "Lê Văn Việt", không còn "mới"); lượt 2 "đúng rồi em" → "💾 Vừa lưu: phường… 📦 Tin giờ: … Phường Tăng Nhơn Phú, Quận 9", `ward`/`district` đúng, mã tin `BDS-CH-Q5-0003` → `BDS-CH-Q9-0001`, `quan_mac_dinh=false`, gợi ý xoá, câu phường answered → hỏi gấp; `bot_errors` 0. Lượt 2 nằm hàng đợi `pg_net` ~40 s trước khi đi (NFR-18, không phải lỗi bot) |
| TS-PHUONG-05 | FR-209 Zalo thật: rao "bán nhà 50m2 4 tỷ" (không địa chỉ) → bot hỏi phường → trả lời "hẻm 12 Lê Văn Việt" | bot ghi địa chỉ, hỏi xác nhận phường; `listings.ward` KHÔNG phải "hẻm 12 Lê Văn Việt" | ⏳ chờ deploy |
| TS-XOAHET-01 | FR-210: gọi `admin_xoa_het_khach_va_ro_hang('XOA HET')` bằng chủ DB; gọi bằng khoá publishable; gọi với chữ sai | trả JSON số dòng, bảng khách/tin về 0, `projects`/`wards`/`ctvs`/`mau_cau`/`bot_prompts` giữ nguyên, `bot_health(xoa_het)` có dấu; anon → 401/42501; chữ sai → 22023 | ✅ 15/09: đã xoá 3 người bán · 2 khách · 4 tin · 33 tin nhắn · 5 hội thoại · 9 fact · 5 câu hỏi · 4 dòng bóng · 3 fact dự án · 3 quota; anon → HTTP 401; `projects` 1639, `wards` 168 giữ nguyên. Nút trên `/admin` chưa bấm thử bằng trình duyệt (`tsc` xanh) |
| TS-NHAN-01 | FR-211: `bun bot/tests/nhan.mjs` — từ điển đóng: "khu yên tĩnh, gần chợ" → [yen_tinh, gan_cho]; "không ngập" → khong_ngap, "ngập" không gắn; "không có thang máy" không gắn; "gần chỗ làm" / "gần Chợ Rẫy" không ra gan_cho; "xe hơi vào tận nhà" → xe_hoi_vao_nha; không dấu "yen tinh" vẫn nhận; `tenNhan` in tên; mọi khoá nằm trong `NHAN_HOP_LE`; e2e NHAN-01…04 (rao có nhãn → `listings.nhan` + fact `nhan` + 💾 "nhãn tìm kiếm"; câu sau thêm nhãn mới không trùng; câu không nhãn không ghi; khách mua "khu yên tĩnh" → `preferences.nhan`); H3 vẫn hỏi lại kết cấu sau lượt có nhãn (fact `nhan` không tính là né) | 22/22; e2e 391/391 | ✅ 18/09/2026 |
| TS-NHAN-02 | FR-211 thật sau deploy #158 (18/09/2026 08:47 UTC, `mau-x-01…10`, mỗi loại BĐS một câu rao, bắn cùng lúc qua `net.http_post`, đọc `net._http_response` + `listings` + `listing_facts`): nhà phố hẻm 4m Nguyễn Trãi · nhà cấp 4 Q11 · căn hộ Sunrise City · đất Lê Văn Việt · biệt thự Thảo Điền · phòng trọ · mặt bằng Hồng Bàng · toà nhà Phú Nhuận · đất nông nghiệp Củ Chi · kho xưởng Tân Kiên — kết quả từng cột ở `docs/anh-xa-du-lieu-listings.xlsx` sheet "Ví dụ 10 tin" | 10/10 HTTP 200, 💾 đúng loại + giá + diện tích; `listings.nhan` có nhãn ở 7/10 tin; sổ lỗi: **8 dòng `chat-reply match_projects(rao)` "canceling statement due to statement timeout"** trong 7 giây khi 10 câu rao tới cùng lúc (RPC dò kho 1.639 dự án nghẽn dưới tải đồng thời — tin vẫn tạo, chỉ x-03 Sunrise City cần dự án và vẫn khớp được; cần soát chỉ mục / `statement_timeout` của `match_projects` trước khi có nhiều chủ nhà rao cùng lúc) | ✅ 18/09: nhãn đúng ở x-01 (yên tĩnh, xe hơi vào nhà), x-03 (full nội thất, view sông), x-04 (thổ cư 100%), x-06 (gác lửng), x-08 (thang máy, dòng tiền). **4 lỗ từ điển vá cùng ngày** (`nhan.mjs` 27/27): (1) "gần chợ, xe hơi vào" mất `gan_cho` vì dấu phẩy bị xoá trước khi so, lookahead "chợ xe" chặn — nay dấu câu giữ làm ranh giới; (2) "nhà cũ tiện xây mới" gắn nhầm `moi_sua` — nay chặn sau tiện/để/phù hợp/có thể/nên/muốn; (3) "sân vườn hồ bơi thang máy" không ra `thang_may` (mẫu đòi chữ "có") — nay nhận "thang máy" trần, phủ định vẫn chặn; (4) "phù hợp quán ăn" không ra `kinh_doanh`. **Lỗi NGOÀI nhãn thấy trong cùng lượt, chưa vá (chờ chủ dự án chốt)**: x-02 đường "Lạc Long Quân" cắt còn "Lạc Long"; x-05 "Thảo Điền"/x-08 "Nguyễn Văn Trỗi"/x-09 "xã Bình Mỹ" không vào vị trí/phường (không có chữ đường/hẻm, xã); x-07 luật ghi `phap_ly` = "hợp đồng 3 năm"; x-08 AI ghi `so_phong_ngu` = 30 (là số phòng toà nhà); x-10 AI ghi `ward` = "Phường Tân Kiên" (là xã) rồi bot vẫn hỏi xã; các ý có fact riêng theo loại (gio_giac, nganh_hang_phu_hop, duong_vao, chieu_cao, duong_container) rơi vào `bo_sung`; mã tin loại toà nhà/đất NN/kho dùng nhãn `NP` và quận chữ ghép thô (`BDS-NP-QUANPHUNHUAN-0001`); `match_projects(rao)` timeout ×8 dưới tải 10 tin đồng thời. **Bắn lại sau deploy #159** (`mau-x-11`, câu x-01): `listings.nhan = {yen_tinh, gan_cho, xe_hoi_vao_nha}`, 💾 "nhãn tìm kiếm: yên tĩnh · gần chợ · xe hơi vào nhà". Dữ liệu 11 người thử đã xoá sau khi đo |
| TS-KYGUI-34 | **Kịch bản thật trên production** (scratchpad `chay-kich-ban.mjs`, 12 người test `thu-*`, kênh `zalo_personal_test`, gọi `chat-reply` qua bí mật bridge; `test_reset_hello=1` nên nhắn "hello" là xoá sạch người đó): A nhà phố Q5 (kịch bản 07/09), B chung cư + xưng hô + hỏi phí, C đất Phong Phú, D biệt thự dự án Ny'ah, E cho thuê nhà, F toà CHDV, G kho xưởng thuê, H đất nông nghiệp, I đất SKC, J môi giới 2 căn + bán rồi, K câu lệch/ack/sửa giá, L người mua hỏi tin thiếu. Sau mỗi lần chạy đối chiếu bảng `listing_facts` với câu đã nhắn | mỗi câu trả lời nằm ĐÚNG khoá (không lệch một ô); giá không bị doanh thu/phí đè; địa chỉ không nhận "lên thổ cư…"; kho xưởng/môi giới tạo được tin; loại mới đúng nhãn trong "📝 Em ghi nhận" và bản nháp; bản nháp đủ dòng như tin rao thật; sửa xong vẫn hỏi tiếp; "tối gửi ảnh" không gửi lại nháp; không có bong bóng nhãn/phí | 🔴 lần 1 (15:53 UTC 09/09): 9/11 tin tạo được, ~60% fact lệch ô, giá 45 tỷ → "120 trieu" — vá (PR #53). 🟡 lần 2 (16:27 UTC): 11/11 tin, fact đúng ô ~95%, bản nháp đủ dòng; lộ thêm: câu "địa chỉ" treo mãi chặn bản nháp, "đăng đi" giữa vòng bị ghi làm fact, doanh thu bị coi là giá lạc chỗ, "tầng 12"/"thuê tối thiểu 1 năm"/"hợp ở" rơi bo_sung — vá (PR #54: né 2 lần thì bỏ câu, chủ muốn đăng → nháp, `20260909m` vi_tri có khi có street/project, e2e N15/N15b/N16). 🟡 lần 3 (16:47 UTC): 11/11 tin, 4 tin lên kệ ngay trong chat, bản nháp đủ dòng, giá 45 tỷ đúng; còn: câu địa chỉ hết hạn xong bị chọn lại làm câu kế (hết hạn ×3), "ừ" bị coi là muốn đăng, tin nhắn khi KHÔNG có câu chờ ("sổ đỏ, đất thuê nhà nước tới 2058") rơi chăm sóc chung → fact mất — vá (PR #55: không mở lại câu đã hết hạn trong cùng vòng; "ừ/dạ" không phải muốn đăng, chưa đủ điểm thì giữ câu treo; không câu chờ vẫn ghi fact + mở câu kế tiền định; nội thất/tiềm năng nhận rộng hơn). ✅ lần 4 (17:02 UTC 09/09): 11/11 tin, 8 tin lên kệ ngay trong chat (2 tin còn lại đang chờ gật, kho xưởng 68 điểm còn thiếu pháp lý), 0 fact rơi bo_sung, mọi câu trả lời đúng ô, giá/diện tích/địa chỉ đúng; bản sao kết quả: nhadat-backup/kich-ban-chat-lan-4-2026-09-10.md. Chưa chạy: kịch bản M "một câu rao dài mang 5–6 thông số" (FR-177 n; chủ dự án ngưng test 10/09 00:20). Sót một ca: "sổ đỏ, đất thuê nhà nước tới 2058" khớp regex ý định mua ("thuê nhà") → tin người bán rơi nhánh mua, pháp lý mất — vá PR #57 (`hoiMua` loại "thuê nhà nước / đất thuê / cho thuê", e2e N17) |


## 10.8 Nghiệm thu theo từng tài liệu (04/09/2026)

Đi từ `00` xuống từng tầng, đối chiếu từng khẳng định với code ở HEAD và DB thật
(chỉ đọc; ca ghi bọc `do … raise`), đồng thời chạy lại toàn bộ suite §10.7 chạy
được trong sandbox. Lệch nhỏ sửa cùng commit; lệch lớn thành OPEN-43/44/45.

### 10.8.1 Kết quả suite §10.7 (chạy lại 04/09/2026)

| Suite | Kết quả | Ghi chú |
|---|---|---|
| TS-E2E (`bash chay.sh`) | ✅ 74/74 (sáng) → 102/102 (sau v48) | gồm CTV, DIABAN, THONGSO, TOIUU |
| `fr159` / `fr161` / `fr164` `.mjs` | ✅ 65 / 9 / 8 | |
| TS-CHATREPLY-01…04, TS-RENT-01…05 (bot thật qua `net.http_post`) | ✅ 9/9 | uid `TEST-e2e-*`, dọn sau |
| TS-CACHE-01…03 | ✅ | 04/05 ⏭ Vercel |
| TS-SEC-01…10 | ✅ 8 · ❌ 1 → vá · ⏭ 1 | TS-SEC-08 `agents_public` (vá `20260904b`) |
| TS-SEC2-01…66 + kho file | ✅ · ❌ 1 (62: câu bất biến, đã sửa câu) · ⏭ H1…H8 | |
| TS-HQ-01…12 | ✅ 12/12 | 05–11 kiểm tĩnh |
| TS-LOG-01/02/06 · TS-HEALTH-02/03/04/07/08 | ✅ | còn lại ⏭ cần HTTP/bridge/trình duyệt |
| TS-GIA, TS-SPECS, TS-HANG, TS-DANGTIN, TS-NEO-01, TS-MA-01, TS-KD-05 | ✅ | |
| TS-IDEM-01…06, TS-IDEM2-I | ✅ | IDEM-06 kỳ vọng lỗi thời (đã sửa dòng) |
| TS-TOANVEN · TS-OUNG | ✅ · ❌ 02b/03 · ❌ 01/02/04/08 → vá | FR-164 gãy (vá `20260904b`), chạy lại xanh |
| TS-KHO-01…14, 20…25 | ✅ | 15…19 ⏭ worker; 06 ghi tiền đề |
| TS-JOB-01…30, TS-TIEN-01…07, TS-CHUONG-01…07 | ✅ 44/44 | |
| TS-LIVE | ⏭ | bridge im từ 27/08 |

Đỏ thật, đã vá bằng `20260904b_nghiem_thu_theo_tai_lieu.sql`: (1) **FR-164 gãy
tầng DB từ 02/09** — `20260902e` viết lại `listing_facts_sync_cols` làm rơi bốn
nhánh `gia`/`phuong`/`loai_bds`/`dien_tich_tim_tuong`, không ai thấy vì
`listing_facts` thật rỗng và TS-THONGSO-13 chỉ thử cụm thông số; cấy lại luật
20260828b/d + dải giá tin thuê. (2) **`/moi-gioi` trống từ 27/08** —
`agents_public` invoker, anon 0/3 → view definer tự chứa. (3) **Người bán web
tự đăng tin vỡ 42501** — cấp EXECUTE `parse_vnd`/`guess_property_type` cho
`authenticated`. (4) Dọn: `lan_thu_ke` thu hồi khỏi anon (SRS-3.12), xoá hàm mồ
côi `listing_facts_touch_status`, enum mồ côi `rating_target`.

### 10.8.2 Kết luận theo tài liệu (gộp 10.8.3 sao Bắc Đẩu; trạng thái sau khi dựng thêm §10.8.4)

| Tài liệu | Buổi sáng (đúng / một phần / sai) | Trạng thái sau 04/09 |
|---|---|---|
| `00` Định hướng (v1.2 → v1.3) | 73 khẳng định: 50 / 20 / 3 | sửa §0.6 (bridge dừng), §0.7 (173 tin là import, chưa phải bằng chứng "rao một câu"), OPEN-26/28; `/quan-ly` gỡ `Quận 5` cứng |
| `02` FR-01…90 | 21 / 28 / 16 chưa | RET (FR-60…65) + ADM (FR-70…81) + WEB dựng chiều — TS-GIUCHAN, TS-ADM2, TS-WEB2; còn treo ghi tại từng FR (OPEN-43) |
| `02` FR-91…174 | 60 / 10 / 10 chưa · 4 deprecated | lệch chữ FR-133/137/110/100/108 ghi chú vào `02`; 10 FR bot dựng ở v48 (TS-V48) |
| `02` NFR-01…18 | 8 / 5 / 5 chưa đo | NFR-09 SEO dựng (TS-SEO); NFR-02/05/14 vẫn chưa có số đo |
| `03` UF-01…13 | 4 / 5 / 4 | UF-06/07/13 nửa sau: curated list + upload dựng; email cần tài khoản ntfy; fingerprint chưa (OPEN-43) |
| `04` IA | 8 trang đặc tả chưa có, 10 route IA chưa ghi | trang tag/SEO dựng (OPEN-44); IA cập nhật đợt sau |
| `05` WF-01…14 | 2 / 6 / 6 | nhãn "Nhã Đạt CC" → Aioinhadat (sửa); còn lại theo OPEN-43/45 |
| `06` UI | tone 8/8; TONE_RULES #5 mâu thuẫn; DB↔TS lệch 3 khoá | #5 → "một tin một thông tin"; `bot_prompts` = `prompts.ts`; token lệch `06 §6.2` → OPEN-45 |
| `07` SRS | cron 10/10; RPC service_role đúng trừ `lan_thu_ke`; AC 1 ✅ / 3 ⚠ / 9 ❌; 2.1 còn Zalo SSO/Realtime/Logstash/Slack/SMTP/Fingerprint; `/api/*` 0/7 | DB vá theo SRS (`20260904b`); `/api/search`, `/api/listing/parse` dựng (TS-WEB2); SRS gắn ghi chú trạng thái → OPEN-43 |
| `00 §0.5` sao Bắc Đẩu | **Đo lại 07/09 SAU khi dọn bã kiểm thử**: NSM lịch xem 0 · I1 0 tin mới/7 ngày (160 `dang_ban`, 173 tin toàn `import_excel` 21/08, chưa khách nào đăng) · I2 **0/0** · I3 0/0 · I4 chờ ~21/09 | I5 qua view `nmg_hoat_dong` (`20260904e`): 0/3 NMG hoạt động. Con số I2 cũ (3/3) là hội thoại THỬ của chính nhóm làm, đã xoá — mốc sao Bắc Đẩu nay tính từ số 0 thật |

### 10.8.4 Dựng thêm cùng ngày (theo yêu cầu "dựng mấy thứ có trong tài liệu")

| Việc | Ở đâu | Kiểm |
|---|---|---|
| FR-12/17, NFR-09 — SEO nền: 64 trang tag SSG, sitemap, robots, canonical/OG, JSON-LD | `lib/tags.ts`, `app/[tag]`, `app/sitemap.ts`, `app/robots.ts`, trang tin | TS-SEO-01…03 ✅, 04…06 ⏭ deploy |
| FR-64 tin mới khớp tiêu chí, FR-56 cảm nhận sau xem, FR-54 link bản đồ | `20260904d`, nudge v24 | TS-MATCH-01…09 ✅ |
| FR-71/74/75/76/77/78/80 admin buyer side | `20260904c`, `app/admin/page.tsx` | TS-ADM2-01…10 ✅, 11–12 ⏭ UI |
| I5 đo được | `20260904e` view `nmg_hoat_dong` | admin/service_role 3 dòng, 0 hoạt động; anon 0 |
| Đợt 2 "dựng hết, giữ chân 5 ngày": FR-60/61/62/63/65/70/72/73/52/103/108/110, FR-57/81 email ntfy, NFR-01 | `20260904f`, nudge v25, cron `info-timeout-tick`, `stale-listing-tick` | TS-GIUCHAN-01…05 ✅, 06 ⚠ ntfy cần tài khoản |
| FR-27/31/45/65/79/99/105/108/114/116 | chat-reply v48 (byte trùng), `prompts.ts` + `bot_prompts` | TS-V48 ✅, e2e 102/102, live 200 |
| FR-01/02/03/04/08/09/10, FR-96, FR-99 web, FR-100 `/ds/[token]`, FR-117 `/du-an/[slug]`, SRS-4.3/4.5/4.6, NFR-06 | `20260904g`, `lib/parse-query.ts`, `app/api/*`, `components/UploadAnh.tsx`, `/admin` | TS-WEB2 P/S ✅, W ⏭ UI |

Dữ liệu thật đáng lưu ý: `listing_facts`, `info_requests`, `listing_media`,
`deals`, `interests`, `viewings` đều 0; `ctvs` 2 (1 bật, 0 có Zalo uid);
`sellers.zalo_user_id` 0/3; bridge im từ 27/08 16:21 (VN). Toàn bộ chuỗi
FR-129/140/153/165/172c/173 mới có bằng chứng từ test rollback + e2e, **chưa có
giao dịch thật nào chảy qua** — điều kiện tiên quyết cho DH-06 đợt 2.
