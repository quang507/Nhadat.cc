# bot/tests — test hồi quy

## Chạy cái gì, bằng lệnh nào

Đừng gõ lệnh rời. Người và CI dùng chung script trong `package.json`, không thì
"máy xanh, máy tao đỏ" và không ai biết bên nào đúng.

```bash
bun run kiem       # cổng trước mọi commit — gồm 6 bộ offline dưới đây
bun run test:sec   # TS-SEC thật, DB thật — KHÔNG nằm trong `kiem`, cần Internet
```

`bun run kiem` = `kieu` (tsc) → `build` (next) → `test:bot` → `test:saoluu` →
`truyvet`.

## Sáu bộ chạy offline (315 ca, không cần mạng, không đụng DB thật)

| Bộ | Ca | Lệnh | Giữ bất biến nào |
|---|---|---|---|
| `e2e/run.mjs` | 160 | `bun run e2e` (qua `chay.sh`) | Luồng `chat-reply` thật: cổng vào (CỔNG-1…5), bảo mật (SEC-\*), tranh chấp ghi đồng thời (ĐUA-1…4), chống trùng lượt vào (TRÙNG-1…10) |
| `e2e/webhook.mjs` | 44 | `bun run e2e` (qua `chay.sh`) | `zalo-webhook`: chữ ký + replay (CK-1…8c), gửi đúng-một-lần ra Zalo (GUI-1…8) |
| `e2e/cong-thieu-bi-mat.mjs` | 4 | `bun run e2e` (qua `chay.sh`) | Thiếu `BRIDGE_SECRET` thì cổng ĐÓNG, không mở |
| `fr159-bon-vai.mjs` | 65 | `bun run test:bot` | Bốn vai người nhắn (FR-159, FR-170) |
| `fr161-go-lan-dau.mjs` | 9 | `bun run test:bot` | Câu gõ LẪN dấu vẫn nhận ra là câu rao / câu hỏi mua |
| `fr164-loi-sua-va-cau-hoi-treo.mjs` | 8 | `bun run test:bot` | Câu vừa sửa một trường vừa trả lời câu hỏi treo thì ghi CẢ HAI |
| `ts-sec-anon.tu-kiem.mjs` | 4 cảnh | `bun run test:bot` | Bộ TS-SEC phân biệt "DB từ chối" với "không tới được" |
| `scripts/sao-luu.tu-kiem.mjs` | 21 | `bun run test:saoluu` | Sao lưu phân biệt "đủ" với "trông như đủ" |

Hỏng thì thoát với mã khác 0.

## Hai bộ CẦN MÔI TRƯỜNG THẬT — không chạy được trong sandbox

| Bộ | Cần gì | Chạy sao | Đọc kết quả |
|---|---|---|---|
| `ts-sec-anon.mjs` (TS-SEC-AUTO) | **Internet tới `*.supabase.co`** + DB production đang chạy. Không cần secret: nó bắn bằng khoá publishable công khai. | `bun run test:sec` — có trong CI (`.github/workflows/kiem.yml` job `baomat`) | **Thoát 0 = đạt · 1 = có cửa mở · 2 = CHƯA KIỂM ĐƯỢC** (proxy chặn, DB ngủ). Thoát 2 KHÔNG phải "đạt". Bản đầu của bộ này coi mọi HTTP ≥400 là "bị chặn" và báo 24/24 xanh trong lúc proxy chặn sạch — `ts-sec-anon.tu-kiem.mjs` là bài chống tái phạm, sửa bộ probe thì phải chạy lại nó. |
| `vai-tro.sql` (TS-VAI) | **Quyền SQL trên DB thật** (Dashboard → SQL Editor, hoặc MCP `execute_sql`). Không chạy được trong CI vì CI chỉ có khoá công khai. | Dán cả file vào SQL Editor → Run | Kết thúc bằng `raise exception 'KQ: …'` nên MỌI dòng chèn tự cuộn lại — không để lại rác. Mọi mục phải là `OK`; một chữ `HONG` là một cửa mở. |

`vai-tro.sql` kiểm 5 vai (`anon`, `authenticated` người lạ, người dùng có hồ sơ,
admin, `service_role`) × 41 khẳng định, trong đó **8 đối chứng dương** (`[dc]`).
Đối chứng dương là bắt buộc: "vai X thấy 0 dòng" chỉ có nghĩa khi có vai Y thấy
được đúng dữ liệu đó — không thì "0 dòng" có thể chỉ là "bảng rỗng".

## Vì sao ba file `fr1xx-*.mjs` CHÉP LẠI regex thay vì import

`chat-reply/index.ts` là module Deno (`npm:` specifier, `Deno.serve`), Node
không nạp thẳng được, mà máy này cũng không có Deno. Nên ba file đó chép lại
đúng các biểu thức và phép lọc cần kiểm.

**Hệ quả bắt buộc nhớ:** sửa regex trong `chat-reply/index.ts` thì phải sửa cả ở
đây, nếu không test vẫn xanh trong khi hàm thật đã đổi. Chỗ nào chép được đánh
dấu bằng comment `// ĐỒNG BỘ VỚI chat-reply/index.ts`. Sửa `hoiMua` thì sửa CẢ
`fr159-bon-vai.mjs` LẪN `fr161-go-lan-dau.mjs` (bản rút gọn hai vế).

## `e2e/` — chạy handler THẬT với Supabase + model giả

Khác hẳn ba file trên: không chép regex, mà đóng gói `chat-reply` (và
`zalo-webhook`) bằng bun rồi bơm tin nhắn qua đúng `Deno.serve` handler trong
Node, với DB trong bộ nhớ (`mock-supabase.mjs`) và model theo kịch bản
(`mock-anthropic.mjs`). Bắt được lỗi LUỒNG (thứ tự các khối, cờ, gọi RPC nào với
tham số gì) mà test regex mù.

```
bun run e2e        # = bash bot/tests/e2e/chay.sh — cần `bun install` một lần trong e2e/
```

`chay.sh` chạy ba tiến trình: `run.mjs`, `webhook.mjs`, rồi
`cong-thieu-bi-mat.mjs`. Cái thứ ba phải là tiến trình RIÊNG vì `napCauHinh` nhớ
tạm cấu hình 60 giây ở tầng module — trong `run.mjs` không dựng lại được cảnh
`gate = null` sau lượt gọi đầu.

Thêm kịch bản: mở `run.mjs`, dùng `fresh(seed)` → `send({...})` → `check(...)`.
**Sửa RPC/trigger phía DB thì phải sửa nghĩa tương ứng trong `mock-supabase.mjs`
— DB giả không tự biết.** Mock hiện mô phỏng cả chỉ mục UNIQUE (trả `23505`),
`claim_inbound` đủ 5 nhánh, `giu_luot_gui`/`nha_luot_gui`, và móc trễ truy vấn
`__treTruyVan` để dựng được cảnh hai lượt chạy chồng nhau.

Xem `docs/10-ke-hoach-kiem-thu.md` §10.7 cho ID `TS-` và kết quả mới nhất.
