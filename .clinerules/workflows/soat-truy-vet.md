# Workflow: Soát truy vết docs/

Chạy trước MỌI commit đụng vào docs/.

1. Chạy lần lượt và báo kết quả:
```bash
# ID được tham chiếu nhưng không tồn tại (kết quả phải RỖNG)
# \b bắt buộc: mẫu cũ 'FR-[0-9]+' ăn luôn đuôi của NFR-18 thành FR-18, nên vừa
# đếm dư vừa CHE mất một FR gãy nếu số của nó trùng đuôi một NFR đang có.
comm -13 <(grep -oE '\bFR-[0-9]+' docs/02-requirements.md | sort -u) \
         <(grep -ohE '\bFR-[0-9]+' docs/0[3-8]*.md | sort -u)
comm -13 <(grep -o '^## UF-[0-9]\+' docs/03-user-flows.md | sed 's/^## //' | sort -u) \
         <(grep -oh 'UF-[0-9]\+' docs/0[2,4-8]*.md | sort -u)
comm -13 <(grep -o '^## WF-[0-9]\+' docs/05-wireframes.md | sed 's/^## //' | sort -u) \
         <(grep -oh 'WF-[0-9]\+' docs/0[1-4,6-8]*.md | sort -u)
comm -13 <(grep -o '^### OPEN-[0-9]\+' docs/09-open-issues.md | sed 's/^### //' | sort -u) \
         <(grep -oh 'OPEN-[0-9]\+' docs/*.md CLAUDE.md | sort -u)
# Số đếm để đối chiếu README
echo "FR: $(grep -oE '\bFR-[0-9]+' docs/02-requirements.md | sort -u | wc -l)"
echo "INS: $(grep -c '^### INS-' docs/01-research.md)"
```
2. Nếu có ID gãy: sửa docs (thêm định nghĩa hoặc sửa tham chiếu), KHÔNG xoá lặng lẽ.
3. Đối chiếu số đếm với bảng trong `README.md` — lệch thì cập nhật README.
4. Kiểm tra nhanh: không có số điện thoại thật / Zalo ID thật trong diff
   (`git diff --cached | grep -E '09[0-9]{8}'` phải rỗng).
5. Báo tổng kết: sạch / đã sửa gì.
