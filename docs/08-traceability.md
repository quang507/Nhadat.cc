# 08 — Traceability Matrix

Cập nhật **cùng commit** với bất kỳ thay đổi nào ở `01`…`07` (quy ước 4, `CLAUDE.md`).

## 8.1 Business Requirement → Functional Requirement

| BR | Mục tiêu | FR liên quan |
|---|---|---|
| BR-01 | Phủ 90% nguồn hàng Q5 | FR-90…FR-97, FR-101 |
| BR-02 | 20 NMG | FR-101, FR-102 |
| BR-03 | 10 chat/ngày, ≥30 tin | FR-13, FR-14, FR-20…FR-32, FR-71 |
| BR-04 | 1 giao dịch/2 ngày | FR-50…FR-57, FR-99 |
| BR-05 | Thu phí bên bán | FR-101, FR-102 |
| BR-06 | Miễn phí, không thu số ĐT | FR-04, FR-53, NFR-07 |
| BR-07 | Giữ kết nối 3–4 năm | FR-60…FR-65, FR-64 |
| BR-08 | SEO 100 keyword | FR-12, FR-15, FR-17, NFR-09 |
| BR-09 | Web → Zalo kèm ngữ cảnh | FR-13, FR-14, FR-30 |

## 8.2 Insight → yêu cầu

| INS | Insight | Hiện thực ở |
|---|---|---|
| INS-01 | Chat là sản phẩm | FR-13, IA-P1, UI-P1, WF-01 |
| INS-02 | Chu kỳ mua 3–4 năm | FR-60…FR-65, UF-08 |
| INS-03 | Zalo xoá sau 7 ngày | FR-63, SRS-5.3 `zalo_keepalive`, AC-06 |
| INS-04 | Riêng tư là khác biệt | FR-04, NFR-07, WF-07, AC-04 |
| INS-05 | S không điền form | FR-91, UI-C08, WF-08, AC-07 |
| INS-06 | Thiếu thông tin là tính năng | FR-40…FR-47, UF-05, SRS-3.6, AC-03 |
| INS-07 | Ngôn ngữ nói ≠ bộ lọc | FR-02, FR-09, FR-22, FR-23, SRS-4.5, AC-12 |
| INS-08 | Sâu một quận trước | BR-01, SRS-8 (thứ tự P1 trước P2) |
| INS-09 | "Rao một lần là xong", không spam S | FR-103, §6.9 (06), SRS-5.3 `stale_listing_check` |
| INS-10 | Hàng dự án: dữ liệu hai tầng, tồn kho theo căn | *chưa có FR — chờ chốt phạm vi ở OPEN-15* |
| INS-11 | Trung gian toàn phần, ẩn danh hai chiều | FR-104…FR-112, UF-10, UF-13, SRS-3.8 |

## 8.3 FR → UF → WF → SRS → AC

| FR | User Flow | Wireframe | SRS | Acceptance |
|---|---|---|---|---|
| FR-01…06 | UF-01 | WF-01 | SRS-2.1 | — |
| FR-07, FR-08 | UF-01 | WF-02 | SRS-4.5 | AC-01 |
| FR-09 | UF-01 | WF-02 | SRS-4.5 | AC-12 |
| FR-10, FR-11 | UF-02 | WF-03 | SRS-3.1 | AC-01 |
| FR-12 | UF-01 | WF-04 | §4.4 (IA) | AC-01 |
| FR-13, FR-14 | UF-03 | WF-01, WF-02 | SRS-4.7 | AC-01 |
| FR-15 | UF-02 | WF-03, WF-04 | — | — |
| FR-16 | UF-01 | — | SRS-3.3 `fingerprint_ids` | — |
| FR-17 | — | WF-04 | NFR-09 | — |
| FR-20…FR-26 | UF-04 | WF-05 | SRS-5.1 | AC-02 |
| FR-27, FR-28 | UF-04 | WF-03, WF-05 | SRS-3.8 `photos` | — |
| FR-29, FR-30 | UF-03, UF-04 | WF-05 | SRS-4.7 | AC-01 |
| FR-31, FR-32 | UF-04 | WF-05 | SRS-5.2 | — |
| FR-40…FR-47 | UF-05 | WF-06, WF-10 | SRS-3.6, SRS-4.1, SRS-4.2 | AC-03 |
| FR-50…FR-57 | UF-06 | WF-07 | SRS-3.7 | AC-04 |
| FR-56 | UF-07 | — | SRS-5.2 (loại listing đã từ chối) | AC-05 |
| FR-60…FR-65 | UF-08 | — | SRS-5.3 | AC-06 |
| FR-70…FR-73 | — | WF-12 | SRS-3.2 | AC-09 |
| FR-74, FR-75 | — | WF-13 | SRS-3.5 | AC-09 |
| FR-76 | UF-05, UF-11 | WF-12 | SRS-3.6 | AC-09 |
| FR-77 | UF-11 | WF-14 | SRS-5.4 | AC-10 |
| FR-78, FR-79 | UF-06, UF-11 | WF-14 | SRS-3.7, SRS-3.8 | AC-10 |
| FR-80 | — | WF-12…14 | UI-C10 | AC-09 |
| FR-81 | UF-11 | — | SRS-5.5 | AC-10 |
| FR-90…FR-96 | UF-09 | WF-08, WF-09 | SRS-4.6 | AC-07 |
| FR-98 | UF-05 | WF-10 | SRS-4.2 | AC-03 |
| FR-99 | — | — | — | *chưa đặc tả — `OPEN-10`* |
| FR-100 | UF-12 | WF-11 | SRS-4.3 | AC-11 |
| FR-101, FR-102 | UF-09 | WF-09 | SRS-3.4 | — |
| FR-103 | UF-09 | — | SRS-5.3 | — |
| FR-104, FR-105 | UF-06, UF-12 | — | SRS-3.8 (bất biến ẩn danh) | — |
| FR-106, FR-107, FR-108 | UF-13 | — | SRS-3.8, SRS-5.3 | — |
| FR-109, FR-111 | UF-10 | — | SRS-3.8 | — |
| FR-110 | UF-05 | WF-06 | SRS-5.3 `info_request_sla` | — |
| FR-112 | UF-07 | — | SRS-3.8 `deals` | — |
| FR-97 | *[deprecated → FR-109]* | — | — | — |

## 8.4 Rủi ro → biện pháp

| RSK | Biện pháp trong đặc tả |
|---|---|
| RSK-01 | FR-63, SRS-5.3 `zalo_keepalive`, UF-08, AC-06 |
| RSK-02 | NFR-12, SRS-2.1 (tầng messaging tách rời) |
| RSK-03 | FR-40, UI-C05, SRS-5.1 bất biến I3, §6.8 quy tắc 4 |
| RSK-04 | Thứ tự phát hành SRS-8 (P1 trước P2) |
| RSK-05 | UF-06 nhánh lỗi, SRS-5.2 xếp hạng |
| RSK-06 | `last_verified_at`, SRS-5.3 `stale_listing_check`, WF-03 |
| RSK-07 | NFR-06, SRS-3.9, §6.7 |

## 8.5 FR chưa có đặc tả kỹ thuật đầy đủ

| FR | Thiếu gì | Theo dõi ở |
|---|---|---|
| FR-99 (định giá so sánh) | Thuật toán, nguồn dữ liệu giá thị trường | `OPEN-10` |
| FR-102 (chấm điểm NMG) | Quy trình thu thập rating, ngưỡng cảnh báo | `OPEN-12` |
| FR-28 (tiện ích quanh BĐS) | Nguồn dữ liệu POI (Google Places? tự nhập?) | `OPEN-13` |
| FR-16 (fingerprint) | Thư viện, chính sách lưu trữ, cơ chế từ chối | `OPEN-14` |
