# Bộ đo bóc tách (TS-DO-BOC-01)

Đo bot ghi **đúng bao nhiêu phần trăm** trên một bộ câu cố định, để mỗi lần đổi code hay prompt biết con số
tăng hay tụt. Nó không thay e2e: e2e giữ những lỗi đã biết khỏi tái phát, còn bộ này cho con số tổng.

- `ca.jsonl`: 110 ca, 9 nhóm. Mỗi ca là chuỗi tin nhắn của **một** người (Zalo mới), kèm kỳ vọng: số tin bán,
  và từng tin có loại, quận, phường, giá, diện tích, phòng ngủ, pháp lý, số tầng, ngang; ca mua thì có hồ sơ mua.
  Kỳ vọng ghi thứ một môi giới giỏi sẽ ghi, **không** chép thứ bot đang làm. Trường mang giá trị `null` nghĩa là
  bot phải để TRỐNG (không được bịa, không được ghi nhầm sang từ căn khác).
- `cham.mjs`: hàm chấm thuần. Ghép cặp tin kỳ vọng với tin thật, rồi chấm từng trường.
  `bun bot/tests/do-boc/cham.mjs --tu-kiem`.
- `chay.mjs`: trình chạy, có ba đường, cả ba chấm chung một hàm.
- `nen.json`: bản nền của chế độ luật. `--nen` đỏ khi có ca từng đạt nay rớt, hoặc tổng số trường đúng giảm.

## Ba đường chạy

| Đường | Lệnh | Đo gì | Tốn |
|---|---|---|---|
| Luật một mình | `bun bot/tests/do-boc/chay.mjs` | tầng tiền định trên DB giả (model giả trả rỗng, như khi AI chết) | 0 đồng, khoảng 1 phút |
| Model thật | `bun bot/tests/do-boc/chay.mjs --that` | luật cộng AI trên DB giả; cần `ANTHROPIC_API_KEY` (lấy từ env hoặc `scripts/.env`) | token Haiku |
| Production | bắn thật rồi chạy `--tu-trang-thai` | bot đang chạy thật, DB thật (trigger, hàm SQL, prompt trong `bot_prompts`) | token Haiku; tạo dữ liệu thử, đo xong phải dọn |

Số đo của DB giả và DB thật có thể lệch nhau: mock chỉ mô phỏng một phần trigger và hàm SQL. Muốn kết luận
thì lấy số production.

## Đo trên production

1. Bắn từng lượt cho các Zalo thử `do-<id ca viết thường>` qua `net.http_post` tới `chat-reply`, kênh
   `zalo_personal_test`, giống cách bắn thử ở CLAUDE.md. Mỗi lượt phải đợi **mọi** người trả lời xong rồi mới
   bắn lượt kế: bot chỉ xử lý một lượt cho mỗi người tại một thời điểm.
   - Bắn mẻ nhỏ, khoảng 20 người một lần. Bắn 110 cùng lúc thì `pg_net` báo hết giờ, dù bot vẫn trả lời đủ
     (23/09: 41/110 lượt báo timeout, cả 110 đều có trả lời trong `messages`). Muốn biết đã xong chưa thì
     đếm tin `sender='bot'` trong `messages`, đừng đếm `net._http_response`.
2. Đổ trạng thái ra JSON:

```sql
select jsonb_object_agg(upper(substr(u.z, 4)), jsonb_build_object(
  'tin', coalesce((select jsonb_agg(jsonb_build_object('code', l.code, 'property_type', l.property_type,
      'district', l.district, 'ward', l.ward, 'price_vnd', l.price_vnd, 'area_m2', l.area_m2,
      'bedrooms', l.bedrooms, 'legal_status', l.legal_status, 'floors', l.floors,
      'frontage_m', l.frontage_m, 'deal', l.deal, 'status', l.status) order by l.created_at)
    from listings l join sellers s on s.id = l.seller_id where s.zalo_user_id = u.z), '[]'::jsonb),
  'mua', (select b.preferences from buyers b where b.zalo_user_id = u.z)))
from (select zalo_user_id z from sellers where zalo_user_id like 'do-%'
      union select zalo_user_id from buyers where zalo_user_id like 'do-%') u;
```

3. Lưu kết quả vào `train/out/do-boc/production.json` (thư mục này đã gitignore), rồi chạy
   `bun bot/tests/do-boc/chay.mjs --tu-trang-thai train/out/do-boc/production.json`.
4. Dọn dữ liệu thử:
   `select public.reset_nguoi_test(z) from (select zalo_user_id z from sellers where zalo_user_id like 'do-%' union select zalo_user_id from buyers where zalo_user_id like 'do-%') u;`

## Thêm ca

Thêm một dòng vào `ca.jsonl` với `id` chưa dùng, `nhom`, `luot` (mảng tin nhắn), `ky_vong` và `nguon`.
Câu lấy từ tin thật thì phải đổi số nhà, tên người và SĐT: repo đang PUBLIC (CLAUDE.md §5).
Thêm ca làm bản nền đổi theo. Chạy chế độ luật rồi cập nhật `nen.json` trong cùng PR.
