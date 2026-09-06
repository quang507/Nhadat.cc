# Soát chuyển sang CHỈ BÁN (sale-only) — Phase 1–7, 10

**Ngày soát:** 06/09/2026 · **Phạm vi:** toàn repo + DB production `tbcdpupiarkuxtntmosl`
**Trạng thái:** AUDIT ONLY — **chưa sửa một dòng code nào, chưa tạo migration nào.**
Schema đọc từ DB thật (`information_schema`, `pg_constraint`, `pg_trigger`) vì repo chưa có
`bot/supabase/schema.sql` (OPEN-46). Số liệu là số đo, không phải ước tính.

> **Quyết định nghiệp vụ ghi nhận:** từ 06/09/2026 chỉ hỗ trợ BĐS **bán**. Phần cho thuê
> **giữ nguyên tại chỗ**, không gỡ, không xoá dữ liệu. Hiện không có khách nào đăng tin thuê.

---

## 0. Kết luận trước, chi tiết sau

**Chuyển sale-only KHÔNG phải việc gỡ code thuê.** Toàn bộ đường thuê chỉ là 97 dòng, phần lớn
là nhánh `if` rẻ tiền, và `deal` là cột **có ích ngay cả khi chỉ bán** (nó ngăn 11 tin thuê cũ
lọt vào kết quả bán). Gỡ nó ra là công vô ích kèm rủi ro.

Cái thật sự hỏng nằm ở chỗ khác, và sale-only **không tự chữa**:

| # | Vấn đề | Số đo |
|---|---|---|
| **S1** | Bot **KHÔNG lọc `property_type`** khi tìm kho, dù `BuyerTurn` có bóc trường đó | khách xin "nhà phố ≤6 tỷ 3PN" → 31 ứng viên, **1 là chung cư**; trong 6 dòng gửi model có **1 chung cư** |
| **S2** | `LIMIT 6` + sắp theo `created_at desc` = lấy 6 tin **mới nhất**, không phải 6 tin **hợp nhất** | **recall@6 = 19,4%** (6/31) |
| **S3** | Lọc `bedrooms >= N` **loại âm thầm** mọi tin chưa bóc được số PN | **76/153** tin bán có `bedrooms` NULL; riêng dưới 6 tỷ mất **10 tin**, trong đó **7 tin** là nhà ≥2 tầng (nhiều khả năng đủ 3PN) |
| **S4** | Đoán loại BĐS sai vì **kề cận và phủ định** | 4/5 câu thử sai (xem §4.4) — sale-only làm nó **nặng hơn** vì `property_type` sẽ thành bộ lọc chính |
| **S5** | Bộ nhớ tạm prompt trượt gần như mọi lượt | `cache_write 71.380` vs `cache_read 15.298` (04/09) — tỉ lệ **4,7:1**, đúng cảnh báo trong `CLAUDE.md §6` |

Sửa S1–S3 là việc của **search/ranking**, không phải của sale-only. Nhưng vì sale-only
biến `property_type` từ "nhãn hiển thị" thành "bộ lọc chính", **S4 phải sửa TRƯỚC** mọi
thay đổi liên quan tới taxonomy.

---

## 1. Phase 1 — Inventory sale/rent

97 dòng nhắc tới thuê trong đường production (đã lọc nhiễu `current`/`different`/`parent`).
Phân bố:

| File | Dòng | Nhóm |
|---|---|---|
| `lib/tags.ts` | 17 | C |
| `bot/supabase/functions/chat-reply/index.ts` | 14 | C |
| `lib/parse-query.ts` | 10 | C |
| `app/nha-dat/[code]/page.tsx` | 6 | C |
| `bot/supabase/migrations/*` (9 file) | 18 | A-hist |
| `components/ListingBrowse.tsx` | 4 | C |
| `bot/tests/fr159-bon-vai.mjs` | 4 | C |
| `lib/format.ts`, `lib/supabase.ts`, `components/MapView.tsx`, `ListingCard.tsx` | 8 | C |
| `app/[tag]/page.tsx`, `app/page.tsx`, `app/admin/dang-tin/page.tsx`, `app/cho-thue/page.tsx` | 8 | C/A |
| `_shared/prompts.ts` | 2 | C |
| `bot/tests/e2e/run.mjs`, `fr161-go-lan-dau.mjs` | 3 | C |

### 1.1 Bảng phân loại chi tiết

Ký hiệu: **A** chỉ thuê · **B** chỉ bán · **C** dùng chung · **D** bỏ được · **E** không chắc, giữ.

| File | Hàm / vùng | Dòng | Mục đích | Loại | Đề xuất | Rủi ro nếu đụng |
|---|---|---|---|---|---|---|
| DB `listings` | cột `deal listing_deal` | — | Phân biệt bán/thuê | **C** | **GIỮ** — là bộ lọc chặn 11 tin thuê cũ lọt vào kết quả bán | Gỡ = 9 index + 21 hàm SQL + 6 policy phải sửa. **Cao** |
| DB | enum `listing_deal{ban,cho_thue}` | — | Từ vựng chuẩn | **C** | GIỮ nguyên giá trị | DDL gốc **không có trong repo** (OPEN-46) — sửa enum phải đọc dependents từ DB |
| `app/cho-thue/page.tsx` | cả trang | 1–30 | Trang kệ thuê | **A** | **GIỮ**, không link từ nav nếu muốn ẩn | Xoá route = 404 cho URL đã index |
| `lib/tags.ts` | vòng `for (const deal of ["ban","cho_thue"])` | 87 | Sinh 64 tag SEO | **C** | GIỮ; tag thuê tự rỗng khi kho hết tin thuê (trang rỗng **không** 404 — IA-P1) | Bỏ tag thuê = mất URL đã index. **Trung** |
| `lib/tags.ts` | `TYPE` có `mat-bang`/`phong-tro` chỉ `cho_thue`, `dat` chỉ `ban` | 44–49 | Ràng buộc loại×deal | **C** | **SỬA** — mâu thuẫn DB: có `mat_bang` bán 1 tin, `phong_tro` bán 2 tin | Thấp |
| `components/ListingBrowse.tsx` | `GIA` hai bộ bucket | 15–27 | Khoảng giá tỷ vs triệu/tháng | **C** | GIỮ | Thấp |
| `components/ListingBrowse.tsx` | `{deal === "ban" && (…)}` | 277 | Ẩn lọc tầng/sổ ở kệ thuê | **C** | GIỮ | Thấp |
| `lib/format.ts` | `formatPricePerM2(vnd, deal)` | 89–93 | Thêm "/tháng" khi thuê | **C** | GIỮ; **nên** đổi tham số sang `price_period` thay vì `deal` | Thấp |
| `lib/parse-query.ts` | `f.deal = "cho_thue"` theo từ khoá | 194 | Bóc ý định từ câu tìm | **C** | GIỮ | Thấp |
| `lib/parse-query.ts` | `if (!f.deal && priceApprox < 100tr) f.deal="cho_thue"` | 227 | **Đoán** thuê theo giá | **E** | **XEM LẠI**: sale-only thì "5 củ" hay "80 triệu" của khách mua nhà bị hiểu thành thuê | **Trung** — đổi là đổi hành vi search |
| `lib/parse-query.ts` | `const deal = f.deal ?? "ban"` | 262, 351 | Mặc định bán | **C** | GIỮ — đã đúng hướng sale-only | — |
| `chat-reply/index.ts` | `dealCol(v)` | 192–193 | Dịch `thue`→`cho_thue` | **C** | GIỮ — là **chỗ dịch duy nhất**, đúng kiến trúc | Thấp |
| `chat-reply/index.ts` | `BuyerTurn.profile.deal` | 202 | Model bóc mua/thuê | **C** | GIỮ (rẻ); xem §5 | Đổi Zod = đổi prompt + `bot_prompts` |
| `chat-reply/index.ts` | `regexProfileFallback` đặt `delta.deal` | 83–84 | Lưới cuối khi model hỏng | **C** | GIỮ | Thấp |
| `chat-reply/index.ts` | `.eq("deal", dealCol(prefs.deal))` (KHO) | 1892 | Lọc kho theo deal | **C** | GIỮ | — |
| `chat-reply/index.ts` | `sDeal = /cho thue/.test(tKD)` lúc tạo tin | 1544 | Người bán rao thuê | **C** | GIỮ | Thấp |
| `chat-reply/index.ts` | `giaTBPhuong(client, deal, ward)` | 362–388 | Giá TB theo deal | **C** | GIỮ | — |
| `_shared/prompts.ts` | ví dụ few-shot "thuê mặt bằng… deal=thue" | 133 | Dạy model bóc thuê | **C** | GIỮ hoặc đổi thành ví dụ bán — **cần đo lại** vì đổi few-shot là đổi hành vi model | **Trung** |
| `_shared/prompts.ts` | "phí quản lý tính theo m2/tháng" | 114 | Từ điển lóng | **C** | GIỮ | — |
| `app/nha-dat/[code]/page.tsx` | `deal==="cho_thue"` trong title/JSON-LD/breadcrumb | 101,130,149,265 | Hiển thị + SEO | **C** | GIỮ | Đụng JSON-LD = rủi ro SEO |
| `app/nha-dat/[code]/page.tsx` | `deal==="ban" && rent_income_vnd` | 246 | "Đang cho thuê X tr/tháng" của tin **BÁN** | **B** | **GIỮ** — đây là spec của tin bán, không phải rental flow | — |
| `listings.rent_income_vnd` | cột | — | Thu nhập thuê của tin bán (17 tin) | **B** | **GIỮ** | Xoá = mất dữ liệu |
| `bao_tin_moi_khop()` | `b.deal in ('thue','cho_thue') → 'cho_thue'` | `20260904d:127` | Khớp alert theo deal | **C** | GIỮ | — |
| `can_cung_khu()` | `coalesce(v_deal,'ban')` | `20260904f:280+` | Căn tương tự cùng deal | **C** | GIỮ | — |
| `boc_thong_so()` | `rent_income_vnd` chỉ bóc khi tin bán | `20260903c` | "đang cho thuê 15tr/th" | **B** | GIỮ | — |
| Migrations (9 file) | mọi nhắc tới `cho_thue` | — | Lịch sử | **A-hist** | **KHÔNG SỬA** (luật repo) | — |
| `bot/tests/*` | ca kiểm luồng thuê (V1.17…) | — | Hồi quy | **C** | GIỮ — là lưới chặn hồi quy | Xoá test = mất lưới |

**Không có mục nào xếp D (bỏ được).** Lý do: mọi chỗ thuê đều nằm chung một nhánh với bán,
gỡ ra tốn công hơn để lại, và để lại thì chi phí chạy gần bằng 0.

---

## 2. Phase 2 — Từ vựng chuẩn

### 2.1 Từ vựng ĐANG CÓ (canonical hiện tại)

```
listing_deal   : ban | cho_thue                              ← DB enum, NOT NULL, default 'ban'
property_type  : nha_pho | nha_cap4 | chung_cu | dat
                 | biet_thu | phong_tro | mat_bang | chua_ro  ← DB enum, default 'chua_ro'
```

### 2.2 Khuyến nghị: GIỮ từ vựng tiếng Việt, KHÔNG đổi sang tên tiếng Anh

Yêu cầu Phase 2 đề xuất `house/townhouse/villa/apartment/land/shophouse/commercial/unknown`.
Theo đúng luật "KHÔNG tự ý đặt tên enum mới nếu repository đã có canonical vocabulary" —
**repo đã có, và nó là tiếng Việt.** Đổi tên value sẽ đụng:

- **173 dòng** dữ liệu, 9 index (3 index bám `deal`), 21 hàm SQL, 6 policy, 8 view
- `lib/format.ts:35-43` `TYPE_LABEL`, `lib/tags.ts:44-49`, `lib/parse-query.ts:68-79`
- `guess_property_type` / `guess_property_type_answer` (regex tiếng Việt)
- `required_facts.property_type` — **38 câu hỏi nhỏ giọt khoá theo enum này**

Đề xuất thay thế, rẻ hơn và đủ mục tiêu "một canonical representation":

```
raw user text  →  normalize (bỏ dấu, viết tắt, phủ định)  →  DB enum (tiếng Việt, GIỮ NGUYÊN)
                                                            └→ TYPE_LABEL (hiển thị)
                                                            └→ tags slug (SEO)
```

Tầng chuẩn hoá **đã tồn tại một phần**: `guess_property_type` (từ mô tả),
`guess_property_type_answer` (từ câu trả lời của chủ), `bo_dau`, `cat_truoc_phu_dinh`.
Việc cần làm không phải đổi tên, mà **vá tầng chuẩn hoá đó** (S4, §4.4).

### 2.3 Ánh xạ tên đề xuất ↔ enum hiện có

| Tên Phase 2 | Enum hiện có | Ghi chú |
|---|---|---|
| `townhouse` | `nha_pho` | 141 tin — loại chủ lực |
| `house` | `nha_cap4` | **AMBIGUOUS**: cấp 4 là *kết cấu* (`floors=1`), không phải loại riêng |
| `villa` | `biet_thu` | 2 tin, cả hai nghi sai (§4.4) |
| `apartment` | `chung_cu` | 16 tin, **≥3 tin nghi sai** |
| `land` | `dat` | **0 tin** |
| `shophouse` | *(chưa có)* | Có bằng chứng nguồn (radanhadat `SHOP_HOUSE`), **0 tin** trong kho |
| `commercial` | `mat_bang` | 1 tin, nghi sai |
| `unknown` | `chua_ro` | 9 tin |
| — | `phong_tro` | Phase 2 **không liệt kê**; DB có 2 tin (cả hai nghi sai). **KHÔNG xoá** |

**STOP:** ba mục AMBIGUOUS (`nha_cap4`, `chua_ro` = *unknown* hay *other*, `phong_tro` có giữ
làm loại không) **cần chủ dự án chốt** trước khi đụng enum.

---

## 3. Phase 4 — Đường bóc tách, truy từng bước

### 3.1 Sơ đồ thật (đã đối chiếu code, không phải mô hình lý thuyết)

```
TIN NHẮN NGƯỜI BÁN
  ↓
[JS] wantsSell — chat-reply:1538                        cổng "đây có phải câu rao không"
  ↓
[JS] regex tại chỗ — chat-reply:1544-1577
     deal      ← /cho thue/ ....................... :1544
     district  ← bocQuan()  ....................... :1579
     ward      ← soPhuong() ....................... :1580
     price_raw ← regex TIEN_CD .................... :1554-1555
     area_m2   ← /(\d+)m2/ đầu tiên ............... :1560   ⚠ lấy số m² ĐẦU TIÊN
     bedrooms  ← /(\d+)\s*(phong ngu|pn)/ ......... :1561
     project   ← RPC match_projects ............... :1573
  ↓
INSERT listings (property_type='chua_ro', status='cho_thong_tin')   :1578-1589
  ↓
[SQL] trigger BEFORE, chạy theo TÊN (thứ tự cố ý — SRS-3.1)
     trg_listings_chuan_hoa_cot ....... price_raw + ward chuẩn hoá trình bày
     trg_listings_fill_code ........... cấp mã BDS-Q5-####
     trg_listings_fill_property_type .. guess_property_type(description)   ⚠ S4
     trg_listings_price_vnd ........... price_vnd = parse_vnd(price_raw)
     trg_y_listings_boc_thong_so ...... boc_thong_so(description, type) → 23 khoá
     trg_z_listings_normalize_status
     trg_zz_listings_dang_tin ......... đủ giá+m²+phường → 'dang_ban'
  ↓
[JS] ghi_fact_listing(dien_tich, so_phong_ngu)      :1604-1607
  ↓
[SQL] listing_facts_sync_cols → cột, THEO BẬC NGUỒN
      chu_xac_nhan > admin > suy_doan/boc_mo_ta
```

### 3.2 Chạy thật câu ví dụ

Đầu vào: `"Nhà Q5 5 tỷ, 4x15, 3 phòng ngủ, 3 toilet, hẻm 6m, sổ hồng riêng, hướng Đông."`

| Trường | Ai bóc | Giá trị ra | Ghi vào | Dùng cho search? | Vào prompt LLM? |
|---|---|---|---|---|---|
| `property_type` | SQL `guess_property_type` | `nha_pho` ✓ | `listings` | ✗ **KHÔNG lọc** (S1) | ✓ |
| `price_raw` | JS regex `TIEN_CD` | `"5 tỷ"` | `listings` | — | ✓ |
| `price_vnd` | SQL `parse_vnd` | `5.000.000.000` ✓ | `listings` (trigger) | ✓ | ✓ |
| `frontage_m` / `length_m` | SQL `boc_thong_so` | `4` / `15` ✓ | `listings` | ✗ | ✓ (SPEC_COLS) |
| `bedrooms` | **JS regex `:1561` VÀ SQL `boc_thong_so`** | `3` ✓ | `listings` | ✓ | ✓ |
| `bathrooms` | SQL `boc_thong_so` | `3` ✓ | `listings` | ✗ | ✓ |
| `alley_width_m` | SQL `boc_thong_so` | `6` ✓ | `listings` | ✗ | ✓ |
| `access_type` | SQL `boc_thong_so` | **`hem_xe_tai`** ⚠ | `listings` | ✓ (web) | ✓ |
| `legal_status` | SQL `boc_thong_so` | `so_hong_rieng` ✓ | `listings` | ✓ (web) | ✓ |
| `direction` | SQL `boc_thong_so` | `Đông` ✓ | `listings` | ✗ | ✓ |
| `district` | JS `bocQuan` | `Quận 5` ✓ | `listings` | ✓ (web) | ✓ |
| `area_m2` | JS regex | **null** (câu không có "m2") | — | ✓ | ✓ |
| toàn câu | — | nguyên văn | `description` | ilike (web `moc`) | ✗ (KHO không nạp mô tả) |

**Hai phát hiện:**

1. **`hẻm 6m` → `access_type = hem_xe_tai`.** Khách chỉ nói bề rộng, bộ bóc **suy ra loại
   hẻm**. Trái luật "không khẳng định điều chưa xác minh" (DH-02). Đúng hơn: ghi
   `alley_width_m=6`, để `access_type` null cho vòng nhỏ giọt hỏi.
2. **`bedrooms` có HAI bộ bóc** — JS `:1561` (lúc INSERT, qua `ghi_fact_listing`, bậc
   `seller_chat`) và SQL `boc_thong_so` (trong trigger, bậc `boc_mo_ta`). **Có luật ưu tiên**:
   `bac_nguon()` — `chu_xac_nhan`(3) > `admin`(2) > `suy_doan`/`boc_mo_ta`(1); fact từ
   `seller_chat` map sang `chu_xac_nhan` nên **thắng**. Không phải lỗi, nhưng phải ghi ra
   vì yêu cầu Phase 4 cấm "hai extractor ghi cùng field mà không có precedence".

### 3.3 Đường người MUA (khác hẳn đường người bán)

```
TIN NHẮN NGƯỜI MUA
  ↓
[LLM] BuyerTurn.profile (Zod)  — chat-reply:199-212
  ↓ nếu model hỏng:
[JS] regexProfileFallback  — chat-reply:65-88   (budget, alley, deal — CHỈ 3 trường)
  ↓
merge_buyer_prefs(p_delta)  — JSONB `||` phía DB, KHÔNG ghi đè cả cục   :2321
  ↓
buyers.preferences (JSONB)  ← khoá thật đang có: budget, area, notes, deal,
                                alley, timeline, purpose, bedrooms, property_type
  ↓
KHO query  — :1889-1903
```

**Precedence người mua:** model thắng, regex chỉ chạy khi `!out` (`:2266`). Rõ ràng, đúng.

---

## 4. Phase 5 — Soát `BuyerTurn`

### 4.1 Trường hiện có (`chat-reply:199-212`)

`name · deal · area · budget · purpose · property_type · bedrooms · alley · timeline · notes`

So với danh sách Phase 5 yêu cầu:

| Phase 5 muốn | Có? | Ghi chú |
|---|---|---|
| area / district / ward | **một trường `area`** | Chuỗi nguyên văn ("Quận 5", "gần chợ Bà Chiểu"). Tách 3 trường = đổi Zod + prompt |
| budget_min / budget_max | **một trường `budget`** | Chuỗi nguyên văn; `budgetRangeVnd()` tách min/max sau |
| property_type | ✓ | **bóc rồi nhưng KHÔNG dùng để lọc** (S1) |
| bedrooms | ✓ | |
| bathrooms | ✗ | Chưa có |
| frontage | ✗ | Chưa có |
| alley/access | ✓ (`alley`) | |
| legal requirement | ✗ | Chưa có |
| direction | ✗ | Chưa có |
| purpose / timeline | ✓ | |
| other requirements | ✓ (`notes`) | |

### 4.2 Luật "chỉ bóc điều khách NÓI RÕ"

**Đã có, viết ngay trong Zod** (`:212`):
> `"CHỈ ghi điều khách NÓI RÕ trong hội thoại. Không suy diễn. Chưa biết để null."`

Từng trường cũng có `.describe()` riêng kèm "Không suy diễn" ở `promise`, `viewing`,
`agreed_deal`, `ask_owner`. **Chưa có ca kiểm tự động nào chứng minh model tuân luật này** —
`bot/tests/e2e` dùng model giả nên nó trả đúng thứ kịch bản đặt sẵn, không kiểm được hành vi
model thật. Đây là **lỗ kiểm thử**, không phải lỗ code.

### 4.3 `deal` trong `BuyerTurn` khi sale-only

Giữ. Lý do: khách vẫn gõ "cho thuê", và cần biết để trả lời "bên em hiện chỉ có tin bán"
thay vì im lặng trả về kho bán. Bỏ trường này thì bot mất khả năng nhận ra câu hỏi lệch mảng.

### 4.4 S4 — Đoán loại sai (chặn taxonomy)

`guess_property_type` (đọc từ DB, `LANGUAGE sql IMMUTABLE`) **không dùng**
`cat_truoc_phu_dinh`, trong khi hàm chị em `guess_property_type_answer` **có dùng**. Thêm nữa
luật `chung cư`/`mặt bằng`/`biệt thự` đứng **trước** luật `nhà`.

Chạy thật 06/09 — **4/5 sai**:

| Câu | Đoán | Thật |
|---|---|---|
| `nhà phố 4x16 hẻm 5m, **gần chung cư** Hùng Vương Plaza` | `chung_cu` | nhà phố |
| `nhà phố 1 trệt 2 lầu, **không phải chung cư**` | `chung_cu` | nhà phố |
| `bán nhà 3 tấm, **kế bên mặt bằng** cho thuê` | `mat_bang` | nhà phố |
| `nhà cấp 4 cũ nát, **tiện xây biệt thự** mini` | `biet_thu` | cấp 4 |
| `đất trống 5x20 gần nhà thờ` | `dat` ✓ | đất |

**Dấu vết trong dữ liệu:** 16 tin `chung_cu` nhưng mô tả là nhà phố —
`BDS-Q5-0008` *"nhà mặt tiền Cao Đạt… 12x12m 2 lầu"*, `BDS-Q5-0054` *"căn nhà mới xây 4x18m"*,
`BDS-Q5-0114` *"nhà hẻm xe hơi 4x21m"*. 2 tin `phong_tro` là nhà **bán 7,6–12,7 tỷ**.
1 tin `mat_bang` là nhà có trệt bán cà phê. 2 tin `biet_thu` *"đối diện khu biệt thự"*.
**Tất cả `property_type_source = 'suy_doan'`** → chưa ai xác nhận tay.

> **STOP CONDITION chạm:** không được backfill/mapping taxonomy khi 22 dòng đang sai —
> làm vậy là **đóng băng lỗi thành nhãn mới**. Phải vá `guess_property_type` và soát tay
> 22 dòng TRƯỚC.

---

## 5. Phase 7 — Đúng đắn của tìm kiếm

### 5.1 Bộ lọc bot thật sự dùng (`chat-reply:1889-1903`)

```
.eq("deal", dealCol(prefs.deal))                    ✓
.in("status", ["dang_ban","dang_quan_tam"])          ✓
.not("price_raw","is",null).neq("price_raw","")      ✓
.ilike("ward", `Phường ${wardNum}`)      nếu bắt được số phường
.gte("bedrooms", prefs.bedrooms)         nếu khách nói số PN     ⚠ S3
.lte/.gte("price_vnd", budget.max/min)   nếu bóc được ngân sách
.order("created_at", desc).limit(6)                              ⚠ S2
```

**Thiếu:** `property_type`, `district`, `access_type`, `legal_status`, `area_m2` — dù
`BuyerTurn` bóc `property_type` và `alley`, và web đã lọc được `district`/`access_type`/
`legal_status` (`ListingBrowse.tsx:104-116`). Bot **kém hơn web**.

### 5.2 Benchmark — "nhà phố Q5 dưới 6 tỷ, 3 phòng ngủ"

| Đo | Số |
|---|---|
| Tổng tin bán đang lên kệ | **153** |
| Dưới 6 tỷ, không lọc PN | 55 |
| Bot lọc (≤6 tỷ + `bedrooms>=3`) | **31** — gồm `nha_pho` + **`chung_cu`** |
| Đúng ý khách (thêm lọc loại nhà) | **30** |
| Bị loại âm thầm vì `bedrooms` NULL | **10** (7 trong đó là nhà ≥2 tầng) |
| 6 dòng bot **thật sự** gửi model | `0163, 0159, 0147, 0157, 0133, 0121` |
| Trong 6 dòng đó | **5 nhà / 1 không phải nhà** |
| **recall@6** | **6/31 = 19,4%** |
| **precision@6** (đúng loại) | **5/6 = 83,3%** |

**Đọc số này cho đúng:** precision 83% nghe được, nhưng nó **may mắn** — 6 tin mới nhất
tình cờ phần lớn là nhà. Recall 19,4% mới là vấn đề thật: **25/31 căn hợp lệ không bao giờ
tới mắt model**, và tiêu chí chọn 6 căn ấy là "mới đăng nhất", **không liên quan gì** tới
việc căn đó có hợp ý khách không.

### 5.3 Không đổi `LIMIT 6` vội

Đúng như yêu cầu. `LIMIT 6` không phải thủ phạm — **thứ tự sắp xếp** mới là. Nâng lên 12
chỉ tăng recall lên 39% mà tốn gấp đôi token, vẫn chọn theo `created_at`. Hướng đúng:
**sắp theo độ khớp** (khoảng cách giá tới ngân sách, cùng phường, cùng loại) rồi mới `LIMIT`.
Đó là thay đổi ranking — **cần đề xuất riêng, đo trước khi làm**.

---

## 6. Phase 10 — Hiệu năng (đo, chưa tối ưu)

### 6.1 Truy vấn mỗi lượt người mua

`Promise.all` 7 nhánh (`:1910-1952`): KHO (≤6 dòng) · `projects` partner (1) ·
`match_projects` · căn khách nhắc (≤3) · ảnh (≤24) · `giaTBPhuong` · nhắc feedback.
Cộng phần trước đó: **11–17 truy vấn/lượt** (ngưỡng TS-TOIUU-01/02/03 trong `docs/10`).

### 6.2 `giaTBPhuong` có đọc 200 dòng không?

`LIMIT 200` (`:371`) nhưng **thực tế nhiều nhất 23 dòng** — phường đông nhất (P1) chỉ có 23
tin thoả điều kiện. Chỉ 2 cột, chỉ chạy khi `minimumMet && wardNum`, nhớ tạm 60 s.
**Không phải vấn đề. Không cần tối ưu.**

### 6.3 Token (`bot_usage`, ngày 04/09 — ngày duy nhất có `model_calls` và token cùng khác 0)

| Chỉ số | Giá trị |
|---|---|
| Lượt gọi model | 11 |
| Vào / lượt | **8.365** chữ-máy |
| Ra / lượt | 212 |
| `cache_write` | 71.380 |
| `cache_read` | 15.298 |
| **write : read** | **4,7 : 1** |

`CLAUDE.md §6` viết sẵn luật đọc cặp số này: *"write cao mà read thấp nghĩa là lượt nào cũng
trượt bộ nhớ tạm — đang trả THÊM tiền để không được gì."* **Đang đúng vào trường hợp đó.**
Nguyên nhân chưa xác định (nhịp `cache_control`, hay khối tĩnh bị chèn nội dung động).
**Chưa đủ dữ liệu để sửa** — 11 lượt là quá ít.

### 6.4 Đồng hồ lệch

Ngày 03/09 và 05/09 có token thật nhưng `model_calls = 0`: `doTien()` chạy mà
`bump_model_quota()` không. Trần ngày đếm theo `model_calls` → **đang đếm thiếu**, trần lỏng
hơn thực tế. Không nguy hiểm ngay, nhưng số ở `/admin` không tin được.

---

## 7. Điều kiện DỪNG đã chạm

| # | Điều kiện | Trạng thái |
|---|---|---|
| 1 | Schema không đủ tách property_type/spec | **KHÔNG chạm** — 23 cột spec đã có, `required_facts` đã tách 7 loại |
| 2 | Migration có nguy cơ mất dữ liệu | **CHẠM** — chưa có bản sao nào (`sao-luu.mjs` chưa từng chạy, `schema.sql` chưa có) |
| 3 | Không chắc field/function có đang dùng | **CHẠM** — DDL enum `listing_deal`/`property_type` nằm trong 41 migration đã mất (OPEN-46) |
| 4 | Test fail | Không — 315 ca offline xanh, CI 6/6 |
| 5 | Taxonomy | **CHẠM** — 22 dòng `property_type` nghi sai, `guess_property_type` sai 4/5 |

**→ Chưa được sang Phase 8 (migration) và Phase 11 (implementation).**

---

## 8. Đề xuất thứ tự làm (chưa làm gì trong lượt này)

| Bước | Việc | Vì sao trước |
|---|---|---|
| 0 | `node scripts/sao-luu.mjs` → phục hồi thử → `soat-phuc-hoi.mjs` thoát 0 | Gỡ STOP #2 |
| 1 | Migration mới: `guess_property_type` dùng `cat_truoc_phu_dinh` + đảo thứ tự luật; `boc_thong_so` bắt phủ định; `hẻm Nm` **không** suy ra loại hẻm | Gỡ STOP #5. Không đụng dữ liệu |
| 2 | Soát tay 22 dòng `property_type_source='suy_doan'` nghi sai, ghi lại qua admin | Gỡ STOP #5 |
| 3 | **S1**: thêm `.in("property_type", …)` vào KHO khi `prefs.property_type` có | Diff nhỏ nhất, lợi nhất |
| 4 | **S3**: đổi `gte(bedrooms)` thành `or(bedrooms.gte.N, bedrooms.is.null)` — hoặc chỉ dùng PN để **xếp hạng**, không để **loại** | Lấy lại 10 tin/55 |
| 5 | **S2**: đổi thứ tự sắp xếp theo độ khớp; đo lại recall@6 trước/sau | Cần benchmark riêng |
| 6 | Sửa `tags.ts:44-49` cho khớp DB (`mat_bang`/`phong_tro` có tin bán) | Thấp |
| 7 | Chốt 3 mục AMBIGUOUS với chủ dự án → `OPEN-xx` mới | Chặn Phase 2 |

**Không đề xuất:** gỡ cột `deal`, xoá route `/cho-thue`, xoá tag thuê, xoá test thuê,
đổi tên enum sang tiếng Anh, đổi `LIMIT 6`, tối ưu `giaTBPhuong`.

---

## 9. Ma trận loại × spec

Xem `docs/property-spec-matrix.md` (Phase 3 + 6).
