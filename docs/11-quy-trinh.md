# 11 — Quy trình BA và tester

Hai vòng làm việc, viết cho người thật đọc và làm theo. Tầng 00–10 nói **sản
phẩm là gì**; file này nói **làm ra nó và kiểm nó thế nào**.

Không có ID mới ở đây — file này không sinh yêu cầu, nó chỉ mô tả cách các ID ở
tầng khác được sinh ra và được kiểm.

## 11.1 Ai làm gì

Dự án một người + agent, nên "vai" là **chiếc mũ đang đội**, không phải chức
danh. Quan trọng là: *đội mũ nào thì chịu trách nhiệm cái gì*, và **không đội
hai mũ trong cùng một lượt** — người vừa viết yêu cầu vừa nghiệm thu chính nó
thì gần như luôn nghiệm thu đạt.

| Mũ | Sở hữu | Câu hỏi phải trả lời |
|---|---|---|
| **BA** | `docs/00`–`09` | Yêu cầu này đến từ đâu, nó mâu thuẫn gì không, ai kiểm được nó? |
| **Dev** | `app/`, `bot/`, `lib/`, migration | Code có đúng FR không, có `catch` nào chưa nối sổ không? |
| **Tester** | `docs/10`, `bot/tests/`, `scripts/soat-truy-vet.sh` | Có bằng chứng nào cho câu "đã xong" ngoài lời kể không? |

Luật một dòng: **BA viết điều phải đúng, tester viết cách chứng minh nó đúng,
dev làm cho nó đúng.** Ba việc, ba lượt, theo thứ tự đó.

## 11.2 Vòng BA — từ ý muốn tới truy vết

```
1. Nó đến từ đâu?
   ├─ Tài liệu gốc      → trích [nguồn: <file> §<mục>]
   ├─ Insight mới       → thêm INS-xx vào docs/01 TRƯỚC
   ├─ Vận hành/sự cố    → ghi bối cảnh vào docs/09 hoặc bot/README
   └─ Ý muốn tự phát    → DỪNG. Ghi OPEN-xx (2 phương án + khuyến nghị), hỏi chủ dự án.

2. Ba câu hỏi chặn — sai một câu là bỏ, không phải "sửa cho hợp":
   ├─ Nó đẩy người dùng VỀ Zalo hay KÉO họ ra? (IA-P1 — kéo ra là sai hướng)
   ├─ Nó có phá lời hứa không-thu-số-điện-thoại? (NFR-07)
   └─ Nó có khiến hệ thống khẳng định điều chưa xác minh? (RSK-03)

3. Cấp FR-xxx TIẾP THEO trong docs/02 (M/S/C + nguồn). KHÔNG đánh số lại.
   Mục bỏ đi → đánh dấu [deprecated], giữ nguyên số.

4. Đi hết chuỗi — bỏ mắt xích nào là tài liệu vỡ:
   FR → UF (03) → WF (05) → SRS (07) → AC (07 §7)
   ├─ chạm cấu trúc trang / URL → cập nhật 04
   └─ chạm component / câu chữ   → cập nhật 06

5. Thêm dòng vào docs/08 §8.3 — CÙNG COMMIT, không để "commit sau".

6. Chuyển mũ: báo tester có FR mới (bước 11.3).

7. bash scripts/soat-truy-vet.sh  → phải SẠCH mới commit.
```

**Vì sao bước 5 phải cùng commit:** một FR không có dòng truy vết là một FR
không ai biết phải kiểm bằng bài nào. Nó vẫn được code, vẫn được merge, và chỉ
lộ ra khi khách gặp lỗi. `scripts/soat-truy-vet.sh` chặn đúng chỗ này.

**Vì sao bước 1 có nhánh "DỪNG":** hai tài liệu gốc mâu thuẫn nhau thì BA không
có thẩm quyền chốt. Chốt bừa thì cái sai đi xuống tận SRS rồi tận code, và lúc
chủ dự án phát hiện thì phải bóc ngược năm tầng.

## 11.3 Vòng tester — từ FR tới bằng chứng

```
1. Đọc FR mới + AC liên quan (docs/07 §7). Không có AC → quay lại hỏi BA,
   đừng tự nghĩ ra tiêu chí đạt.

2. Nó rơi vào suite nào? (docs/10 §10.1 — TS-WEB / TS-BOT / TS-ASK / TS-VIEW /
   TS-RET / TS-ADM / TS-SEL / TS-BROKER / TS-PROJECT)

3. Kiểm được bằng MÁY không?
   ├─ Được → viết ca vào bot/tests/ hoặc bot/tests/e2e/run.mjs, nối vào CI
   └─ Chưa → viết ca chạy tay vào docs/10 §10.7, kèm LỆNH DÁN VÀO CHẠY ĐƯỢC
             (không phải mô tả), kỳ vọng, và cách dọn dữ liệu thử

4. Cấp ID TS-xxx-nn. Bất biến như FR.

5. Chạy. Ghi kết quả + NGÀY vào cột cuối docs/10 §10.7.
   ✅ đạt · ⚠ đạt một phần · ⏭ chưa chạy được (ghi rõ THIẾU GÌ) · ❌ hỏng

6. Hỏng → mở lại cho dev. Bug tìm thấy sau release phải có ca tái hiện TRƯỚC
   khi sửa — suite chỉ phình, không teo.
```

**Ba luật của tester ở repo này:**

1. **`⏭` phải nói thiếu gì.** "Chưa chạy" là vô nghĩa; "cần bridge sống",
   "cần bản deploy", "cần tài khoản ntfy" là việc giao được cho người khác.
2. **Ca ghi trên DB thật phải tự cuộn lại.** Bọc `do $$ … raise exception 'KQ:
   %', o; end $$;` hoặc `begin … rollback`. `nhadat-cc` là môi trường CHÍNH,
   bậc Free không có backup tự động (OPEN-25) — làm hỏng là mất thật.
3. **Bí mật lấy bằng `get_secret()` ngay trong câu SQL, không in ra.** Khoá đã
   dán vào chat coi như lộ, phải xoay.

## 11.4 Máy kiểm gì, người kiểm gì

Trước 04/09/2026 repo không có CI: mọi câu "tsc sạch, e2e xanh" đều là **lời kể
của người đẩy commit**. Nay chia lại cho sòng phẳng.

| Tầng | Ai kiểm | Ở đâu | Chặn merge? |
|---|---|---|---|
| Kiểu dữ liệu TypeScript | máy | CI job `web` | có |
| Web dựng được, trang tin còn trong cache (NFR-17) | máy dựng, người soi bảng route | CI job `web` | có / không |
| 102 kịch bản hội thoại + FR-159/161/164 | máy | CI job `bot` | có |
| ID gãy, truy vết thiếu, số đếm README, PII, khoá service_role | máy | CI job `truyvet` | có |
| RLS / GRANT — tập không phá huỷ (TS-SEC-AUTO) | máy | CI job `baomat` | có |
| RLS / GRANT — bài phá huỷ (xoá thật nếu RLS hỏng) | người, SQL Editor | `docs/10 §10.7` | có, tay |
| Migration đã áp ↔ file trong repo, ảnh chụp schema còn mới | máy, chạy tay | `scripts/soat-migration.mjs` | có, tay |
| Thông tuyến Zalo thật (TS-LIVE) | người, hai điện thoại | `docs/10 §10.7` | có, tay |
| Tone giọng, a11y, Lighthouse, tải | người | `docs/10 §10.3–10.4` | chưa |

Chỗ máy KHÔNG với tới được là chỗ nguy nhất, vì nó im lặng: RLS hở, bridge chết,
bot trả 200 kèm câu trả lời sai. Đó là lý do TS-SEC chạy sau **mọi** migration
đụng RLS/GRANT, và `bot_health_tick` + còi ntfy tồn tại (FR-152, NFR-18).

**Một bài kiểm im lặng còn tệ hơn không có bài nào.** Bản đầu của
`bot/tests/ts-sec-anon.mjs` coi "HTTP ≥ 400 = bị chặn = đạt". Chạy thử: 24/24
ĐẠT — trong khi không một request nào tới được Supabase, proxy trả 403 chữ trần.
Mất mạng, sai URL, project bị pause đều cho ra một bộ bảo mật xanh rờn. Luật rút
ra, áp cho mọi bài kiểm ở repo này:

> Trước khi tin một bài kiểm, hỏi: **nếu thứ nó giám sát chết ngay bây giờ, bài
> này có kêu không?** Không kêu thì nó đang đo sự im lặng, không đo sự đúng.

Nên mọi bài "phải bị chặn" giờ đòi đúng hình lỗi của thứ được kiểm (PostgREST
trả JSON có `message`), có bài dò đường chạy trước, và có mã thoát riêng cho
"chưa kiểm được" (2) khác với "đạt" (0). Và bài tự kiểm
`ts-sec-anon.tu-kiem.mjs` dựng PostgREST giả để bắt chính nó chứng minh điều đó
— chạy offline, nằm trong `test:bot`.

## 11.5 Ba cổng

**Cổng 1 — trước commit** (người, tại máy):

```bash
bun run kiem     # kiểu + dựng + e2e bot + soát truy vết, một lệnh
```

Đụng migration RLS/GRANT thì chạy thêm TS-SEC bằng tay.

**Cổng 2 — trước merge** (máy, GitHub Actions `.github/workflows/kiem.yml`):
ba job `web` / `bot` / `truyvet` phải xanh. Đỏ là không merge — không "merge
rồi sửa sau".

**Cổng 3 — trước deploy edge function** (người, `bot/README.md §Deploy`):
bundle → deploy → kéo ngược → **so từng byte** → chạy e2e trên chính nội dung
kéo ngược → gọi thử một lượt thật rồi dọn. Bỏ bước so byte là bỏ cả cổng: chép
tay đo được một lỗi mỗi 7 KB, và lỗi rơi vào regex thì hỏng im lặng.

## 11.6 Định nghĩa XONG

Một FR chỉ được ghi ✅ trong `docs/02` khi đủ **cả bốn**:

1. Có dòng trong ma trận `docs/08`.
2. Có ít nhất một ca `TS-` trong `docs/10` — và ca đó đã chạy, có ngày.
3. Ba cổng ở §11.5 đã qua.
4. Có bằng chứng từ hệ thống thật, không chỉ từ test: dòng trong DB, log, ảnh
   màn hình, hoặc số ở `/admin`.

Thiếu (4) thì trạng thái cao nhất là 🟡. Tính đến 04/09/2026 phần lớn chuỗi
FR-129/140/153/165/172c/173 dừng ở 🟡 vì **chưa có giao dịch thật nào chảy
qua** (`docs/10 §10.8`).

## 11.7 Lệnh

| Việc | Lệnh |
|---|---|
| Toàn bộ cổng 1 | `bun run kiem` |
| Chỉ kiểu dữ liệu | `bun run kieu` |
| Chỉ e2e bot | `bun run test:bot` |
| Chỉ soát tài liệu | `bun run truyvet` |
| Hồi quy RLS trên DB thật (cần Internet) | `bun run test:sec` |
| Soát trôi migration DB ↔ repo (cần khoá) | `node scripts/soat-migration.mjs` |
| Sao lưu 30 bảng + ảnh chụp schema (cần khoá) | `node scripts/sao-luu.mjs` |
| Soát tài liệu chi tiết hơn (agent) | gọi agent `soat-truy-vet` |
| Review diff đụng `docs/` | gọi agent `reviewer` |

Cùng một lệnh cho người và cho CI (`package.json` là nguồn duy nhất) — không thì
"máy xanh, máy tao đỏ" và không ai biết bên nào đúng.
