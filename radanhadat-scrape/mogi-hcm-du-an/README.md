# mogi.vn — 1.613 dự án bất động sản TPHCM

Dữ liệu cào bằng [Firecrawl CLI](https://docs.firecrawl.dev/sdks/cli) ngày **2026-08-25**.

Nguồn: <https://mogi.vn/du-an/ho-chi-minh-cid30> — 162 trang listing, 10 dự án/trang.

> Lưu ý: URL `mogi.vn/ho-chi-minh/du-an` trả về 404. Trang dự án theo tỉnh/thành
> nằm ở `mogi.vn/du-an/{slug}-cid{id}`, TPHCM là `cid30`.

## Nội dung thư mục

| File | Mô tả |
|---|---|
| `du-an-hcm.csv` | 1.613 dự án, 11 cột, UTF-8 BOM (mở thẳng bằng Excel) |
| `du-an-hcm.json` | Cùng dữ liệu, dạng JSON |
| `thong-ke.txt` | Thống kê theo quận/huyện, chủ đầu tư, năm bàn giao, trạng thái |
| `parse-report.txt` | Báo cáo parse (số trang, số dự án, số ô trống) |
| `pages/p001.md` … `p162.md` | Markdown thô của 162 trang listing — giữ lại để parse lại |
| `parse.py` | Script parse `pages/` → CSV + JSON. Chạy: `python parse.py` |

## Schema

| Cột | Mô tả | Ví dụ |
|---|---|---|
| `project_id` | ID dự án trên mogi | `prj553` |
| `name` | Tên dự án | `Khu căn hộ An Hòa` |
| `developer` | Chủ đầu tư | `Công ty CP Đầu tư Nam Long` |
| `district` | Quận/huyện | `Quận 7` |
| `city` | Luôn là `TPHCM` | `TPHCM` |
| `handover` | Năm bàn giao | `2011` |
| `price_from` | Giá từ | `Từ 1 tỷ 575 triệu` |
| `price_per_m2` | Đơn giá | `21 - 27 triệu/m2` |
| `status` | Trạng thái, phân cách `; ` | `Đang bán; Cho thuê` |
| `url` | Trang dự án | `https://mogi.vn/khu-can-ho-an-hoa-prj553` |
| `listing_urls` | Link tin đăng mua/thuê, phân cách `; ` | |

## Độ phủ dữ liệu

| Trường | Có dữ liệu |
|---|---|
| `name`, `district`, `url` | 1.613 (100%) |
| `developer` | 1.065 (66%) |
| `status`, `listing_urls` | 1.069 (66%) |
| `price_from`, `price_per_m2` | 763 (47%) |
| `handover` | 711 (44%) |

Các ô trống là do trang listing của mogi **thật sự không có** thông tin đó — đã đối
chiếu markdown thô để xác nhận, không phải lỗi parser. Dự án cũ (vd. `prj712`
Khu Dân Cư An Thịnh) chỉ có tên + quận + trạng thái.

## Top quận/huyện

| Quận/huyện | Số dự án |
|---|---|
| Quận 7 | 214 |
| Quận 9 (TP. Thủ Đức) | 173 |
| Quận 2 (TP. Thủ Đức) | 168 |
| Huyện Bình Chánh | 117 |
| Quận Thủ Đức (TP. Thủ Đức) | 99 |
| Quận Bình Tân | 87 |
| Huyện Nhà Bè | 81 |
| Quận 8 | 77 |

Xem đầy đủ trong `thong-ke.txt`.

## Trạng thái

| Trạng thái | Số dự án |
|---|---|
| Đang bán | 549 |
| (không có) | 544 |
| Cho thuê | 349 |
| Đang bán + Cho thuê | 171 |

## Phạm vi

Đây là dữ liệu **cấp danh sách**. Trang chi tiết từng dự án (tiện ích, mặt bằng,
tiến độ, mô tả đầy đủ, ảnh) **chưa cào** — cần thêm 1.613 lượt scrape.

Cách cào tiếp:

```bash
# lấy danh sách URL chi tiết
python -c "import csv;[print(r['url']) for r in csv.DictReader(open('du-an-hcm.csv',encoding='utf-8-sig'))]" > urls.txt

# cào tuần tự (chạy song song dễ dính rate limit)
while read u; do firecrawl scrape "$u" -o "detail/$(basename $u).md"; done < urls.txt
```

## Cách tái tạo

```bash
for p in $(seq 1 162); do
  firecrawl scrape "https://mogi.vn/du-an/ho-chi-minh-cid30?cp=$p" -o "pages/$(printf p%03d $p).md"
done
python parse.py
```

Chạy tuần tự — chạy 2 job song song bị rate limit, hỏng ~60% số trang.
