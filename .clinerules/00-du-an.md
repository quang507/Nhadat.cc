# Luật dự án nhadat.cc (Cline rules)

Đọc `CLAUDE.md` ở gốc repo trước khi làm bất cứ việc gì — đó là harness đầy đủ.
File này chỉ nhắc các luật bất di bất dịch:

1. Repo này là **tầng đặc tả**. Nguồn sự thật là `docs/00` → `docs/09`.
   Tài liệu gốc (.docx/.pdf/.pptx/.xlsx ở thư mục gốc) CHỈ ĐỌC, không sửa.
2. Mọi khẳng định trong `docs/` phải có nguồn: `[nguồn: file §mục]`
   hoặc `[giả định BA]`. Mơ hồ → tạo `OPEN-xx` trong `docs/09`, không tự chốt.
3. ID (`FR- UF- WF- SRS- AC- INS- OPEN-`) là bất biến — không đánh số lại,
   mục bỏ thì đánh dấu `[deprecated]`.
4. Sửa tầng trên → cập nhật `docs/08-traceability.md` CÙNG commit.
5. TUYỆT ĐỐI không đọc-chép nội dung từ `admin logins/`, `sổ đỏ samples/`,
   `masterDB/`, `ThemeForest/` vào docs, commit hay chat.
   Số điện thoại / Zalo ID / tên thật phải ẩn danh (`0903xxxxxx`, `chị D.`).
6. Ba câu hỏi cho mọi tính năng mới: (a) nó đẩy người dùng VỀ Zalo hay kéo ra?
   (b) có phá lời hứa không-thu-số-ĐT không? (c) có khiến hệ thống khẳng định
   điều chưa xác minh không?
7. Ngôn ngữ docs: tiếng Việt; tên bảng/trường/API: tiếng Anh snake_case.
8. Commit lên branch làm việc hiện tại, không push thẳng main.
