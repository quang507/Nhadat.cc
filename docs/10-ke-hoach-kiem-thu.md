# 10 — Kế hoạch kiểm thử

Trả lời câu hỏi "đã có kế hoạch kiểm thử chưa": trước file này mới có **nền** —
13 kịch bản nghiệm thu (AC-01…AC-13, `docs/07 §7`) và bảng kiểm chứng NFR
(`docs/07 §6`). File này nâng thành kế hoạch đầy đủ 4 tầng. Nguyên tắc: công cụ
**free-tier trước** (NFR-16); test case truy được về FR/AC/NFR.

## 10.1 Kiểm thử chức năng (Functional Testing)

Đơn vị tổ chức: **test suite theo nhóm FR**. Dữ liệu mẫu lấy từ 24 kịch bản chat
trong `chats w B.docx` (đã ẩn danh) — đây là bộ dữ liệu vàng, không bịa thêm.

| Suite | Phạm vi | Trọng tâm |
|---|---|---|
| TS-WEB | FR-01…17 | Search NLU parse đúng taxonomy §4.6 · trang tag không bao giờ 404 · cue #ID hiện đủ · deep-link Zalo mang ngữ cảnh (AC-01) |
| TS-BOT | FR-20…32 | 4 bất biến I1–I4 (SRS-5.1) là test chặn release: ≤3 listing/tin · tin chủ động kết thúc bằng câu hỏi · không khẳng định điều chưa xác minh · không hỏi số ĐT sai chỗ |
| TS-ASK | FR-40…47, FR-110 | Kho tích luỹ trả trước, hỏi S sau · idempotency theo request_id · timeout 24h/48h · FR-44 cập nhật listing (AC-03) |
| TS-VIEW | FR-50…57 | Từ chối cho số ĐT vẫn đặt được lịch (AC-04) · email [VIEWING] |
| TS-RET | FR-60…65 | Mốc 3 ngày / 5–6 ngày · nội dung xoay vòng không lặp (AC-06) |
| TS-ADM | FR-70…81 | 20 mục/trang · 4 loại email đúng subject/body (AC-09, AC-10) |
| TS-SEL | FR-90…103, FR-109 | Bóc tách ≥4 trường (AC-07) · rao từng bước trong Zalo · không spam S |
| TS-BROKER | FR-104…112 | Ẩn danh hai chiều: lọc SĐT/Zalo ID/địa chỉ trong relay · vòng đời listing · sold → báo interests |
| TS-PROJECT | FR-113…117 | AC-13: căn 50 theo unit_status · câu tầng dự án không sinh info_request · unique (project_id, unit_code) |

Phương pháp: mỗi AC ≥1 test E2E; NLU (FR-09/22/23/92) dùng **bảng quyết định**
câu vào → trường ra, chạy lại được khi đổi model AI (regression bắt buộc trước
khi đổi model/prompt).

## 10.2 Kiểm thử kỹ thuật (Technical / Integration)

| Mục | Kiểm gì | Tham chiếu |
|---|---|---|
| API contract | SRS-4.1…4.7: schema request/response, idempotency (request_id trùng → trả kết quả cũ, không nhân đôi), mã lỗi 404/409 | FR-41, FR-43 |
| Database | RLS: anon chỉ đọc listing active + media public; unique (project_id, unit_code); enum unit_status/status không nhận giá trị lạ; last_confirmed_at cập nhật đúng | SRS-3.9, FR-107, FR-113 |
| Webhook Zalo | Trả 200 < 1s; xử lý bất đồng bộ; chữ ký sai → từ chối; retry không tạo tin nhắn đôi | SRS-4.4 |
| Hàng đợi | Chaos test: tắt worker 10 phút → 0 tin mất sau khôi phục | NFR-04, OPEN-11 |
| Kho file | Ảnh sổ đỏ: signed URL hết hạn ≤15 phút, truy cập thẳng bucket bị chặn; adapter đổi backend không đụng logic bot | NFR-06, FR-111 |
| Migration | Mỗi migration chạy được trên project trống + project có dữ liệu mẫu; không phá dữ liệu cũ | — |

## 10.3 Kiểm thử giao diện & trải nghiệm (UI/UX)

1. **Đối chiếu thiết kế**: từng màn so với canvas/Figma (page 02) — bố cục, token
   màu (`design/tokens.json`), font. Sai token = lỗi, không phải "gần đúng".
2. **Responsive**: 375 / 768 / 1440px; bảng rộng cuộn trong container, body không
   cuộn ngang; sticky CTA Zalo trên mobile.
3. **Tone giọng chat**: checklist 7 quy tắc + mục Cấm (`docs/06 §6.8`) chạy trên
   log 50 hội thoại thử — đây là kiểm thử UX, không phải cảm tính: đếm được
   (số câu hỏi/lượt, tin kết thúc bằng "?", từ cấm "Vui lòng/Hệ thống").
4. **Accessibility**: tương phản ≥4.5:1, vùng chạm ≥44px, focus ring, alt ảnh —
   axe-core tự động + duyệt tay màn chính (persona P3, 61 tuổi).
5. **Trạng thái**: ma trận loading/rỗng/lỗi/đặc biệt cuối `docs/05` — mỗi ô một
   test; "0 kết quả" phải nói rõ đã nới tiêu chí gì.
6. **Hiệu năng cảm nhận**: Lighthouse mobile ≥ 90, LCP < 2.5s/4G (NFR-02).

## 10.4 Kiểm thử phi chức năng (Non-functional)

Bảng NFR-01…16 với cách đo đã nằm ở `docs/07 §6` — giữ đó làm nguồn sự thật.
Bổ sung các bài chuyên sâu:

| Bài | Nội dung |
|---|---|
| Tải | 50 tin nhắn đồng thời p95 <3s (NFR-01); seed 5.000 listing + 300 hội thoại không suy giảm (NFR-05) |
| Bảo mật | Pen-test 3 hướng: (1) prompt-injection qua chat dụ bot lộ SĐT/địa chỉ chủ nhà — phá ẩn danh FR-104; (2) đoán/duyệt URL /ds/token và signed URL; (3) RLS bypass qua PostgREST filter |
| Riêng tư | Rà log 100 hội thoại: 0 lần hỏi số ĐT ngoài viewing (NFR-07); dữ liệu B không rời hệ thống |
| SEO | 100 URL tag index trong Search Console, 0 lỗi structured data (NFR-09) |
| Chi phí | Sau mỗi tuần chạy thử: đối chiếu usage Supabase/Vercel/AI với ngưỡng free (NFR-16) — vượt dự báo là finding |

## 10.5 Môi trường & công cụ (free-tier)

- **Unit/integration**: Vitest · **E2E**: Playwright (Chromium có sẵn trong môi
  trường CI) · **A11y**: axe-core · **Perf**: Lighthouse CI.
- **CI**: GitHub Actions free (2.000 phút/tháng) — chạy lint + unit mỗi PR, E2E
  nightly; Vercel preview mỗi PR (đã hoạt động trên PR #1).
- **DB test**: org Supabase free đã đủ 2 project — `nhadat-bot` là môi trường
  chính, **không** chạy test phá hoại lên nó; test DB dùng Postgres chạy trong CI
  (docker) áp cùng bộ migration.
- **Zalo**: OA thật ở chế độ ẩn + tài khoản Zalo test của CTV; chưa có sandbox
  chính thức → ghi nhận hạn chế ở OPEN-09.
- **Bí mật**: khóa API chỉ nằm trong biến môi trường (Vercel env / GitHub
  Secrets / `.env.local`) — tuyệt đối không commit; khóa đã dán vào chat phải
  **rotate** sau khi hệ thống chạy ổn định.

## 10.6 Lịch chạy theo giai đoạn phát hành (SRS §8)

| Phase | Suite bắt buộc xanh để thoát phase |
|---|---|
| P0 Nền | TS-SEL (rao tin), Migration, Database, Bí mật |
| P1 Nguồn hàng | TS-WEB, UI/UX 1–2–5, SEO, Lighthouse |
| P2 Chat | TS-BOT (I1–I4 chặn), TS-ASK, TS-PROJECT, Webhook, Tone giọng |
| P3 Giao dịch | TS-VIEW, TS-ADM, TS-BROKER, Pen-test ẩn danh |
| P4 Giữ chân | TS-RET, Tải, Riêng tư, Chi phí |

Quy tắc: bug tìm thấy sau release phải có test tái hiện trước khi sửa —
suite chỉ phình ra, không teo lại.
