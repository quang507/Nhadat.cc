# Ma trận loại BĐS × thông số — Phase 3 & 6

**Ngày:** 06/09/2026 · **Nguồn:** cột thật của `public.listings` (56 cột, đọc từ
`information_schema`) + `required_facts` (38 câu, đã tách theo loại) + `boc_thong_so()`
(23 khoá). **Chưa tạo cột nào, chưa tạo migration nào.**

Đi kèm `docs/sale-only-audit.md`.

---

## 1. Luật của tài liệu này

1. **Cột đã có thì DÙNG LẠI.** Không tạo cột trùng nghĩa chỉ vì tên khác.
2. **Không tạo cột chỉ để tài liệu đẹp.** Trường không có nghiệp vụ thật → để `listing_facts`.
3. `listing_facts` **là kiến trúc hiện tại** cho thứ hỏi được mà chưa cần lọc — không phải
   giải pháp tạm.
4. Ký hiệu: **✓** bắt buộc · **○** tuỳ chọn · **—** không áp dụng · **⊕** chưa có cột, đề xuất.

---

## 2. Ma trận

| Thông số | Cột thật | Chung | nha_pho | nha_cap4 | biet_thu | chung_cu | dat | mat_bang | phong_tro |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Giá | `price_raw` → `price_vnd` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Giá / m² | `price_per_m2_vnd` *(generated)* | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Diện tích | `area_m2` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| DT công nhận | `legal_area_m2` | ○ | ○ | ○ | ○ | ○ | ○ | — | — |
| DT xây dựng | `built_area_m2` | ○ | ○ | — | ○ | — | — | ○ | — |
| Mô tả | `description` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vị trí | `district ward street location_raw lat lng` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pháp lý | `legal_status` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ○ | ○ |
| Hoàn công | `has_completion` | ○ | ✓ | ✓ | ✓ | — | — | ○ | — |
| Hướng | `direction` | ○ | ○ | ○ | ○ | ○ | ○ | — | — |
| Phòng ngủ | `bedrooms` | ○ | ✓ | ✓ | ✓ | ✓ | — | — | ○ |
| Phòng tắm | `bathrooms` | ○ | ✓ | ✓ | ✓ | ✓ | — | ○ | ○ |
| Ngang | `frontage_m` | ○ | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| Dài | `length_m` | ○ | ✓ | ✓ | ✓ | — | ✓ | ○ | — |
| Nở hậu | `rear_width_m` | ○ | ○ | ○ | ○ | — | ○ | — | — |
| Số tầng | `floors` + `floors_text` | ○ | ✓ | ✓ | ✓ | — | ✓ | ○ | ○ |
| Tầng số mấy | `floor` | ○ | — | — | — | ✓ | — | — | ○ |
| Đường vào | `access_type` | ○ | ✓ | ✓ | ○ | — | ○ | ✓ | ○ |
| Bề rộng hẻm | `alley_width_m` | ○ | ✓ | ✓ | ○ | — | ✓ | ○ | ○ |
| Cách mặt tiền | `distance_to_street_m` | ○ | ○ | ○ | ○ | — | ○ | ○ | — |
| Quy hoạch | `planning_status` | ○ | ○ | ○ | ○ | — | ✓ | — | — |
| Nội thất | `furnishing` | ○ | ○ | — | ○ | ✓ | — | ○ | ✓ |
| Thang máy | `has_elevator` | ○ | ○ | — | ○ | — | — | ○ | — |
| Xe hơi vô nhà | `car_in_house` | ○ | ○ | — | ○ | — | — | — | — |
| Căn góc | `corner_lot` | ○ | ○ | ○ | ○ | — | ○ | ○ | — |
| Năm xây | `year_built` | ○ | ○ | ○ | ○ | ○ | — | — | — |
| Thương lượng | `negotiable` | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Đang cho thuê | `rent_income_vnd` | ○ | ○ | ○ | ○ | ○ | — | ○ | ○ |
| Dự án / mã căn | `project_id unit_code unit_status` | ○ | ○ | — | ○ | ✓ | ○ | ○ | — |
| **Sân vườn** | ⊕ *(chưa có)* | — | — | — | ○ | — | — | — | — |
| **Hồ bơi** | ⊕ *(chưa có)* | — | — | — | ○ | — | — | — | — |
| **Tổng số tầng toà** | ⊕ *(chưa có)* | — | — | — | — | ○ | — | — | — |
| **Ban công** | ⊕ *(chưa có)* | — | — | — | — | ○ | — | — | — |
| **View** | ⊕ *(chưa có)* | — | — | — | — | ○ | — | — | — |
| **Thổ cư (m²)** | ⊕ *(chưa có)* | — | — | — | — | — | ✓ | — | — |
| **Bề rộng đường** | ⊕ *(chưa có)* | — | — | — | — | — | ✓ | — | — |
| **Mục đích SD đất** | ⊕ *(chưa có)* | — | — | — | — | — | ○ | — | — |

## 3. Đối chiếu Phase 3 ↔ cột thật

**Có sẵn 13/22 trường Phase 3 yêu cầu.** Không tạo trùng:

| Phase 3 gọi | Cột thật | |
|---|---|---|
| `completion_status` | `has_completion` | dùng lại |
| `floor_number` | `floor` | dùng lại |
| `road_width_m` (nhà) | `alley_width_m` | dùng lại |
| `area_m2` (căn hộ) | `area_m2` | dùng lại — SRS-3.1 định nghĩa "chung cư = tim tường" |
| `land_area` | `area_m2` | dùng lại (đất thì `area_m2` **là** diện tích đất) |

**Chín trường chưa có cột** (⊕ ở trên). Đề xuất theo mức bằng chứng:

| Trường | Có `required_facts` hỏi? | Có dữ liệu? | Đề xuất |
|---|---|---|---|
| `tho_cu` (đất) | ✓ `dat.tho_cu` priority 1 | 0 tin đất | **Nên có cột** khi có tin đất đầu tiên |
| `do_rong_duong` (đất) | ✓ `dat.do_rong_duong` priority 2 | 0 tin đất | **Nên có cột** cùng lúc |
| `san_vuon` (biệt thự) | ✓ `biet_thu.san_vuon` priority 3 | 2 tin, nghi sai | **Để `listing_facts`** — 2 tin không đủ căn cứ |
| `phi_quan_ly` (căn hộ) | ✓ `chung_cu.phi_quan_ly` priority 2 | 16 tin, ≥3 nghi sai | **Để `listing_facts`** cho tới khi loại được soát lại |
| `dien_tich_tim_tuong` | ✓ `chung_cu` priority 1 | — | Đã có `area_m2` + `legal_area_m2` — **không tạo mới** |
| Hồ bơi, ban công, view, tổng tầng, mục đích SD đất | ✗ **không có câu hỏi nào** | 0 | **KHÔNG tạo** — không có nghiệp vụ, đúng luật §1.2 |

## 4. Bộ câu hỏi nhỏ giọt đã tách theo loại (`required_facts`, 38 câu)

Đây là phần **đang làm đúng nhất** của hệ thống — view `listing_missing_facts` join
`required_facts` theo `property_type`, nên đất không bị hỏi số phòng ngủ.

| Loại | Câu hỏi (ưu tiên) |
|---|---|
| `nha_pho` | ket_cau(1) dien_tich_dat(1) do_rong_hem(1) phap_ly(1) · huong(2) quy_hoach(2) · nam_xay(3) |
| `nha_cap4` | do_rong_hem(1) dien_tich_dat(1) phap_ly(1) · quy_hoach(2) hien_trang(2) |
| `biet_thu` | ket_cau(1) dien_tich_dat(1) phap_ly(1) · huong(2) · san_vuon(3) |
| `chung_cu` | phap_ly(1) dien_tich_tim_tuong(1) so_phong_ngu(1) tang(1) · phi_quan_ly(2) huong(2) · noi_that(3) |
| `dat` | dien_tich(1) phap_ly(1) quy_hoach(1) tho_cu(1) · do_rong_duong(2) |
| `mat_bang` | dien_tich(1) mat_tien(1) thoi_han_thue(1) · nganh_hang_phu_hop(2) |
| `phong_tro` | dien_tich(1) gia_dien_nuoc(1) · gio_giac(2) noi_that(2) |
| `chua_ro` | loai_bds(1) |

**Lỗ đã biết:** chỉ **11/38** khoá được `listing_facts_sync_cols` map vào cột
(`gia phuong loai_bds dien_tich so_phong_ngu tang huong do_rong_hem quy_hoach ket_cau phap_ly`).
27 khoá còn lại — kể cả `tho_cu`, `do_rong_duong`, `phi_quan_ly`, `san_vuon` — trả lời xong
**chỉ nằm ở `listing_facts`**, không bao giờ thành cột, nên không lọc/không sắp xếp được.
Hiện `listing_facts` có **0 dòng** nên chưa ai thấy.

**Ghi chú sale-only:** `mat_bang.thoi_han_thue` là câu hỏi thuê nằm trong bộ mặt bằng. Kho
có 1 tin `mat_bang` **bán**. Khi soát lại loại (bước 2 của kế hoạch), câu này thành thừa
với tin bán — nhưng **không xoá**, chỉ ghi nhận.

## 5. `boc_thong_so()` bóc được gì

23 khoá: `frontage_m length_m rear_width_m floors floors_text floor bedrooms bathrooms
access_type alley_width_m distance_to_street_m legal_status has_completion planning_status
has_elevator car_in_house corner_lot furnishing direction year_built negotiable
rent_income_vnd built_area_m2`

**Chỉ rẽ nhánh theo loại đúng MỘT chỗ** (`20260903c:33`): `chung_cu` → `floor` thay vì
`floors`. Hệ quả đo được 06/09:

| Câu rao thật | Bóc ra | Mất |
|---|---|---|
| `phòng trọ tầng 3 có gác, 20m2, toilet riêng, 3tr/tháng điện 3k5` | `{}` **rỗng** | tất cả |
| `đất thổ cư 100%, 5x20, đường nhựa 8m, SHR, không quy hoạch` | 5x20 · SHR · không QH | **thổ cư**, **đường 8m** |
| `căn hộ 2PN tầng 15, 70m2 tim tường, phí QL 12k/m2, full nội thất` | tầng 15 · 2PN · full | **tim tường**, **phí QL** |
| `mặt bằng 5x20 mặt tiền, hợp đồng 3 năm, 60tr/th` | 5x20 · MT | **hợp đồng 3 năm** |
| `biệt thự 10x20 sân vườn hồ bơi, 2 tầng, 5PN` | 10x20 · 2 tầng · 5PN | **sân vườn**, **hồ bơi** |

Đúng như bảng §3 dự đoán: những thứ mất chính là những khoá **chưa có cột**.

**Không đề xuất mở rộng `boc_thong_so` ngay.** Nhà phố + cấp 4 + biệt thự = **145/173 tin
(84%)** và bóc tốt. Bốn loại còn lại cộng lại **20 tin, phần lớn nghi sai loại**. Sửa bộ bóc
cho loại mà nhãn còn chưa đúng là sửa nhầm thứ tự.

## 6. Việc cần chốt trước khi đụng schema

| # | Câu hỏi | Vì sao chặn |
|---|---|---|
| 1 | `nha_cap4` là **loại** hay là **kết cấu** (`floors=1`)? | Quyết định enum có 7 hay 8 giá trị |
| 2 | `chua_ro` nghĩa là *chưa biết* hay *loại khác*? | Hai nghĩa cần hai giá trị |
| 3 | `phong_tro` có giữ làm loại khi chỉ bán? | Phase 2 không liệt kê nó; DB có 2 tin (nghi sai) |
| 4 | `area_m2` của căn hộ: tim tường hay thông thuỷ? | SRS-3.1 nói tim tường; `required_facts` lại hỏi riêng `dien_tich_tim_tuong` |

Bốn mục này là `[giả định BA]` nếu tự chốt — theo `CLAUDE.md §4.2` phải đưa vào
`09-open-issues.md` chờ chủ dự án.
