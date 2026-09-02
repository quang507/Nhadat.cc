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

## `fr159-bon-vai.mjs` (01/09/2026)

Bốn vai người nhắn (FR-159, FR-170): cổng `hoiMua` (người bán có đang hỏi mua
không), cổng `tuNhanCoBDS` (người lạ có tự nhận có BĐS không), `budgetRangeVnd`
(khoảng giá lọc kho — kiểm bằng "có ÔM căn giá X không"), phần tiền của
`regexProfileFallback`, và nhãn chính chủ/môi giới gán lúc bóc tách. 59 ca. Sửa `hoiMua` ở `chat-reply` thì sửa CẢ file này
LẪN `fr161-go-lan-dau.mjs` (bản rút gọn hai vế).


## `e2e/` — chạy handler THẬT với Supabase + model giả (02/09/2026)

Khác hẳn các file trên: không chép regex, mà đóng gói `chat-reply` bằng bun
rồi bơm tin nhắn qua đúng `Deno.serve` handler trong Node, với DB trong bộ nhớ
(`mock-supabase.mjs`) và model theo kịch bản (`mock-anthropic.mjs`). Bắt được
lỗi LUỒNG (thứ tự các khối, cờ, gọi RPC nào với tham số gì) mà test regex mù.

```
cd bot/tests/e2e && bun install && ./chay.sh   # toàn bộ bằng bun
```

Thêm kịch bản: mở `run.mjs`, dùng `fresh(seed)` → `send({...})` → `check(...)`.
Sửa RPC/trigger phía DB thì phải sửa nghĩa tương ứng trong `mock-supabase.mjs`
— DB giả không tự biết. Xem `docs/10` §TS-E2E.
