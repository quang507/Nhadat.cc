# bot/tests — test hồi quy chạy tay

Chạy bằng Node (không cần Deno, không cần mạng, không đụng Supabase):

```bash
node bot/tests/fr161-go-lan-dau.mjs
node bot/tests/fr164-loi-sua-va-cau-hoi-treo.mjs
```

Hỏng thì thoát với mã khác 0.

## Vì sao mấy file này CHÉP LẠI regex thay vì import

`chat-reply/index.ts` là module Deno (`npm:` specifier, `Deno.serve`), Node
không nạp thẳng được, mà máy này cũng không có Deno. Nên hai file dưới đây chép
lại đúng các biểu thức và phép lọc cần kiểm.

**Hệ quả bắt buộc nhớ:** sửa regex trong `chat-reply/index.ts` thì phải sửa cả ở
đây, nếu không test vẫn xanh trong khi hàm thật đã đổi. Chỗ nào chép được đánh
dấu bằng comment `// ĐỒNG BỘ VỚI chat-reply/index.ts`.

| File | Giữ bất biến nào | Hỏng thì mất gì |
|---|---|---|
| `fr161-go-lan-dau.mjs` | Câu gõ LẪN dấu vẫn nhận ra là câu rao / câu hỏi mua | Tin rao rơi im lặng; người hỏi mua bị bot hỏi ngược về căn của họ |
| `fr164-loi-sua-va-cau-hoi-treo.mjs` | Câu vừa sửa một trường vừa trả lời câu hỏi đang treo thì ghi CẢ HAI | Câu trả lời drip bay mất, `info_requests` kẹt `pending`, bot hỏi lại điều vừa được đáp |
