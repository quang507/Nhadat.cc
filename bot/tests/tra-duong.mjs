#!/usr/bin/env bun
// tra-duong.mjs — FR-212: từ điển tên đường, phần THUẦN (chọn kết quả tra, thay tên, câu hỏi).
// Ứng viên ở đây là dạng `tim_duong()` trả về: { ten, khoang_cach, quan_cu[], phuong[], tinh[] }.
import { catTenDuong, cauXacNhanDuong, chonDuong, theTenDuong } from "../supabase/functions/_shared/extraction/tra-duong.ts";

let dat = 0, hong = 0;
const ok = (ten, dk, chi = "") => { if (dk) dat++; else { hong++; console.log(`✗ ${ten}${chi ? `\n    ${chi}` : ""}`); } };
const uv = (ten, kc, quan = ["Quận 8"]) => ({ ten, khoang_cach: kc, quan_cu: quan, phuong: ["Phường Phú Định"], tinh: ["TP.HCM"] });

// ── khớp ĐÚNG sau bỏ dấu → sửa, không hỏi ──
let r = chonDuong("pham the hien", [uv("Phạm Thế Hiển", 0)]);
ok("'pham the hien' khớp đúng → sua 'Phạm Thế Hiển'", r.loai === "sua" && r.ten === "Phạm Thế Hiển", JSON.stringify(r));
r = chonDuong("PHAM THE HIEN", [uv("Phạm Thế Hiển", 0)]);
ok("chữ in hoa không dấu → sua", r.loai === "sua" && r.ten === "Phạm Thế Hiển", JSON.stringify(r));
r = chonDuong("Phạm Thế Hiển", [uv("Phạm Thế Hiển", 0)]);
ok("đã đúng y từ điển → giu (không có gì để sửa)", r.loai === "giu", JSON.stringify(r));
r = chonDuong("nguyen trai", [uv("Nguyễn Trãi", 0, ["Quận 5", "Quận 1"]), uv("Nguyễn Trại", 0, ["Quận 12"])]);
ok("hai tên cùng chữ bỏ dấu, chưa biết quận → giu (không đoán)", r.loai === "giu", JSON.stringify(r));
r = chonDuong("nguyen trai", [uv("Nguyễn Trãi", 0, ["Quận 5", "Quận 1"]), uv("Nguyễn Trại", 0, ["Quận 12"])], "Quận 5");
ok("hai tên cùng chữ bỏ dấu, biết Quận 5 → sua theo tên có Quận 5", r.loai === "sua" && r.ten === "Nguyễn Trãi", JSON.stringify(r));
r = chonDuong("hoa binh", [uv("Hòa Bình", 0), uv("Hoà Bình", 0)]);
ok("hai cách bỏ dấu 'Hòa/Hoà' cùng quận → giu", r.loai === "giu", JSON.stringify(r));

// ── khớp GẦN → hỏi xác nhận, một ứng viên ──
r = chonDuong("pham the hier", [uv("Phạm Thế Hiển", 1)]);
ok("'pham the hier' (1 phép sửa) → hoi 'Phạm Thế Hiển'", r.loai === "hoi" && r.ten === "Phạm Thế Hiển", JSON.stringify(r));
r = chonDuong("pham the hiem", [uv("Phạm Thế Hiển", 1), uv("Phạm Thế Hiệp", 1)]);
ok("hai ứng viên cùng khoảng cách → giu", r.loai === "giu", JSON.stringify(r));
r = chonDuong("pham the hiem", [uv("Phạm Thế Hiển", 1, ["Quận 8"]), uv("Phạm Thế Hiệp", 1, ["Quận 9"])], "Quận 8");
ok("hai ứng viên, biết quận → hoi tên trong quận", r.loai === "hoi" && r.ten === "Phạm Thế Hiển", JSON.stringify(r));
r = chonDuong("le lai", [uv("Lê Lợi", 1)]);
ok("tên ngắn 'le lai' (5 chữ cái) → giu, không đoán", r.loai === "giu", JSON.stringify(r));
r = chonDuong("tran phu", [uv("Trần Phú", 0), uv("Trần Phong", 2)]);
ok("có khớp đúng thì không xét khớp gần", r.loai === "sua" && r.ten === "Trần Phú", JSON.stringify(r));
r = chonDuong("le va vet", [uv("Lê Văn Việt", 2)]);
ok("2 phép sửa mà chữ ngắn 'le va vet' (7 chữ cái) → giu", r.loai === "giu", JSON.stringify(r));
r = chonDuong("cach mang thang tan", [uv("Cách Mạng Tháng Tám", 2)]);
ok("2 phép sửa, chữ dài → hoi", r.loai === "hoi" && r.ten === "Cách Mạng Tháng Tám", JSON.stringify(r));
r = chonDuong("pham the hien", [uv("Phạm Thế Hiển", 3)]);
ok("khoảng cách 3 (RPC nới) → giu", r.loai === "giu", JSON.stringify(r));

// ── không có gì / rác ──
ok("không ứng viên → giu", chonDuong("duong la", []).loai === "giu");
ok("null → giu", chonDuong("pham the hien", null).loai === "giu");
ok("ứng viên rác (thiếu ten) → giu", chonDuong("pham the hien", [{ khoang_cach: 0 }]).loai === "giu");
ok("tên tra quá ngắn 'abc' → giu", chonDuong("abc", [uv("Abc", 0)]).loai === "giu");
ok("khoảng cách 0 nhưng chữ bỏ dấu KHÁC (RPC lạ) → không tin, giu", chonDuong("le loi", [uv("Lê Lai", 0)]).loai === "giu");

// ── thay tên trong địa chỉ ──
ok("thay giữa câu, giữ số hẻm/phường", theTenDuong("hem 4m pham the hien p4", "pham the hien", "Phạm Thế Hiển") === "hem 4m Phạm Thế Hiển p4");
ok("thay không phân biệt hoa thường/dấu", theTenDuong("123 Pham The Hiển", "pham the hien", "Phạm Thế Hiển") === "123 Phạm Thế Hiển");
ok("không thấy → giữ nguyên", theTenDuong("hẻm 12 Lê Văn Việt", "nguyen trai", "Nguyễn Trãi") === "hẻm 12 Lê Văn Việt");
ok("goc rỗng → giữ nguyên", theTenDuong("hẻm 12 Lê Văn Việt", "", "X") === "hẻm 12 Lê Văn Việt");

// ── cắt tên đường trần từ cụm địa chỉ dài (bắn thật 21/09 mau-tdt) ──
ok("'ở đường trần đình trọng quận 5' → 'trần đình trọng'", catTenDuong("ở đường trần đình trọng quận 5") === "trần đình trọng", catTenDuong("ở đường trần đình trọng quận 5"));
ok("'tran binh trong phuong 2 q5' → 'tran binh trong'", catTenDuong("tran binh trong phuong 2 q5") === "tran binh trong");
ok("'Lê Văn Việt, gần chợ' → 'Lê Văn Việt'", catTenDuong("Lê Văn Việt, gần chợ") === "Lê Văn Việt");
ok("'Phạm Thế Hiển p4' → 'Phạm Thế Hiển'", catTenDuong("Phạm Thế Hiển p4") === "Phạm Thế Hiển");
ok("'Cách Mạng Tháng 8' giữ nguyên (không cắt ở số)", catTenDuong("Cách Mạng Tháng 8") === "Cách Mạng Tháng 8");
ok("'tại đường số 7' → 'đường số 7' (duongTraDuoc sẽ loại)", catTenDuong("tại đường số 7") === "đường số 7", catTenDuong("tại đường số 7"));
ok("'Nguyễn Trãi hẻm 4m' → 'Nguyễn Trãi'", catTenDuong("Nguyễn Trãi hẻm 4m") === "Nguyễn Trãi");
ok("'Xa lộ Hà Nội' giữ ('xa' đứng đầu là tên, không phải xã)", catTenDuong("Xa lộ Hà Nội") === "Xa lộ Hà Nội", catTenDuong("Xa lộ Hà Nội"));

// ── câu hỏi xác nhận ──
const cau = cauXacNhanDuong("Dạ em hiểu là đường {ten} đúng không {ac}?", "anh", "pham the hier", "Phạm Thế Hiển");
ok("điền mẫu (không nhắc chữ khách gõ sai — chủ dự án 21/09: 'tinh tế vào')", cau === "Dạ em hiểu là đường Phạm Thế Hiển đúng không anh?", cau);
ok("câu xác nhận < 30 từ", cau.split(/\s+/).length < 30);

console.log(`\ntra-duong: ${dat} đạt, ${hong} hỏng`);
process.exit(hong ? 1 : 0);
