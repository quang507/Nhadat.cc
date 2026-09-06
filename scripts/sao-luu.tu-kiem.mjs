#!/usr/bin/env node
// Tự kiểm `sao-luu.mjs` — dựng PostgREST GIẢ rồi chạy script THẬT lên nó.
//
// ═══════════════════ VÌ SAO ═══════════════════
// Sao lưu là loại mã chỉ được kiểm đúng MỘT lần trong đời: hôm mất dữ liệu.
// Trước hôm đó nó chạy mỗi đêm, in vài con số, thoát 0, và không ai đối chiếu
// gì cả. `ts-sec-anon` từng báo 24/24 xanh trong lúc proxy chặn sạch — cùng
// một cái bẫy, và sao lưu còn dễ dính hơn vì "thoát 0" là tất cả những gì
// cron nhìn.
//
// Bài này KHÔNG chạm DB thật (yêu cầu: không test destructive trên
// production). Nó dựng một PostgREST giả, bơm đúng những cách hỏng đã biết,
// rồi soi HAI thứ: mã thoát và `manifest.json`.
//
//     node scripts/sao-luu.tu-kiem.mjs

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "sao-luu.mjs");
const SCHEMA_REPO = join(HERE, "..", "bot", "supabase", "schema.sql");

// `sao-luu.mjs` ghi schema.sql vào REPO — đó là hành vi đúng của nó, nhưng
// bài kiểm này bơm schema BỊA. Để lại một schema.sql giả trong repo còn tệ hơn
// không có file nào: nó trông đúng là cái lưới an toàn mà CLAUDE.md hứa hẹn,
// và sẽ được tin vào đúng hôm cần dựng lại. Cất trước, trả lại sau, mọi đường.
const CO_SCHEMA_CU = existsSync(SCHEMA_REPO);
const SCHEMA_CU = CO_SCHEMA_CU ? readFileSync(SCHEMA_REPO) : null;

// Danh sách bảng script đang khai — đọc từ chính nguồn, không chép tay.
const NGUON = readFileSync(SCRIPT, "utf8");
const BANG_KHAI = [...NGUON.matchAll(/"([a-z_]+)"/g)]
  .map((m) => m[1])
  .filter((t) => NGUON.slice(NGUON.indexOf("const BANG = ["), NGUON.indexOf("];", NGUON.indexOf("const BANG = ["))).includes(`"${t}"`));

// ── PostgREST giả ────────────────────────────────────────────────────────────
let C = {};
const may = createServer((req, res) => {
  const [duong, truyVan] = req.url.split("?");
  const json = (code, body, headers = {}) => {
    res.writeHead(code, { "Content-Type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  };

  if (req.method === "POST" && duong === "/rest/v1/rpc/liet_ke_bang") {
    let body = "";
    req.on("data", (d) => { body += d; });
    return req.on("end", () => json(200, C.bangTrongDb));
  }
  if (req.method === "POST" && duong === "/rest/v1/rpc/xuat_schema") {
    let body = "";
    req.on("data", (d) => { body += d; });
    return req.on("end", () => json(200, C.schema ?? ("-- schema giả\n" + "x".repeat(2000))));
  }

  const ten = duong.replace("/rest/v1/", "");
  if (C.bangLoi === ten) return json(500, { message: "bang nay co y lam hong" });

  const tong = C.soDong?.[ten] ?? 0;
  // Số dòng THỰC SỰ phục vụ — kịch bản "cắt ngắn" khai tổng lớn mà chỉ trả ít.
  const phucVu = C.chiTraVe?.[ten] ?? tong;
  const m = /^(\d+)-(\d+)$/.exec(req.headers["range"] ?? "0-999");
  const tu = Number(m?.[1] ?? 0);
  const den = Number(m?.[2] ?? 999);
  const lat = [];
  for (let i = tu; i <= den && i < phucVu; i++) lat.push({ id: i, ten_bang: ten });
  const dai = C.khongCount === ten ? "*/*" : `${tu}-${Math.max(tu, tu + lat.length - 1)}/${tong}`;
  json(200, lat, { "Content-Range": dai });
});

await new Promise((ok) => may.listen(0, "127.0.0.1", ok));
const CONG = may.address().port;

// ── chạy script thật ─────────────────────────────────────────────────────────
function chay(dich) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [SCRIPT, dich], {
      env: {
        ...process.env,
        SUPABASE_URL: `http://127.0.0.1:${CONG}`,
        SUPABASE_SERVICE_ROLE_KEY: "khoa-gia-chi-dung-trong-bai-kiem",
      },
    });
    let out = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { out += d; });
    p.on("close", (ma) => ok({ ma, out }));
  });
}

const R = [];
const check = (n, ok, d = "") => R.push([n, !!ok, d]);
const docSoTay = async (dich) => {
  try { return JSON.parse(await readFile(join(dich, "manifest.json"), "utf8")); }
  catch { return null; }
};

const DAY_DU = Object.fromEntries(BANG_KHAI.map((t) => [t, 0]));

try {
  // ══ (1) KHOẺ — mọi bảng đủ, có bảng vượt 1000 dòng để ép phân trang ══
  {
    const dich = await mkdtemp(join(tmpdir(), "sl-khoe-"));
    C = { bangTrongDb: BANG_KHAI, soDong: { ...DAY_DU, listings: 2300, messages: 1 } };
    const r = await chay(dich);
    const st = await docSoTay(dich);
    check("KHOẺ → thoát 0", r.ma === 0, r.out.slice(-400));
    check("KHOẺ → manifest trang_thai=day_du", st?.trang_thai === "day_du", JSON.stringify(st?.trang_thai));
    check("KHOẺ → phân trang đúng: listings đủ 2300 dòng (2 vòng + dư)",
      st?.bang.find((b) => b.ten === "listings")?.dong === 2300,
      JSON.stringify(st?.bang.find((b) => b.ten === "listings")));
    check("KHOẺ → manifest có đủ ten/dong/file cho MỌI bảng",
      st?.bang.length === BANG_KHAI.length && st.bang.every((b) => b.ten && b.file && b.dong !== undefined),
      `${st?.bang.length}/${BANG_KHAI.length}`);
    check("KHOẺ → có ghi bảng KHÔNG sao lưu (storage.objects, auth.users, vault)",
      !!st?.khong_sao_luu?.["storage.objects"] && !!st?.khong_sao_luu?.["auth.users"] &&
      !!st?.khong_sao_luu?.["vault.secrets"], JSON.stringify(Object.keys(st?.khong_sao_luu ?? {})));
    await rm(dich, { recursive: true, force: true });
  }

  // ══ (2) DB CÓ BẢNG MỚI mà BANG chưa khai → phải DỪNG ══
  // Đây đúng cảnh `chat_quota` ngày 05/09: bảng sinh ra hôm trước, danh sách
  // chưa ai cập nhật. Bản trước 05/09 sẽ sao lưu 30 bảng rồi báo thành công.
  {
    const dich = await mkdtemp(join(tmpdir(), "sl-bangmoi-"));
    C = { bangTrongDb: [...BANG_KHAI, "bang_moi_toanh"], soDong: DAY_DU };
    const r = await chay(dich);
    const st = await docSoTay(dich);
    check("BẢNG MỚI CHƯA KHAI → thoát khác 0", r.ma !== 0, `ma=${r.ma}`);
    check("BẢNG MỚI CHƯA KHAI → nêu đích danh tên bảng", r.out.includes("bang_moi_toanh"), r.out.slice(-300));
    check("BẢNG MỚI CHƯA KHAI → manifest ghi 'hong', không phải thư mục câm",
      st?.trang_thai === "hong", JSON.stringify(st?.trang_thai));
    await rm(dich, { recursive: true, force: true });
  }

  // ══ (3) MỘT BẢNG LỖI → cả chuyến hỏng, không được báo thành công ══
  {
    const dich = await mkdtemp(join(tmpdir(), "sl-motbang-"));
    C = { bangTrongDb: BANG_KHAI, soDong: DAY_DU, bangLoi: "listings" };
    const r = await chay(dich);
    const st = await docSoTay(dich);
    check("MỘT BẢNG LỖI → thoát khác 0 (29 bảng kia xong vẫn KHÔNG phải thành công)",
      r.ma !== 0, `ma=${r.ma}`);
    check("MỘT BẢNG LỖI → manifest trang_thai=thieu", st?.trang_thai === "thieu", JSON.stringify(st?.trang_thai));
    check("MỘT BẢNG LỖI → manifest nêu đích danh bảng hỏng",
      st?.hong?.some((h) => h.ten === "listings"), JSON.stringify(st?.hong));
    check("MỘT BẢNG LỖI → các bảng khác vẫn được kéo (không bỏ ngang)",
      (st?.bang?.length ?? 0) === BANG_KHAI.length - 1, `${st?.bang?.length}`);
    await rm(dich, { recursive: true, force: true });
  }

  // ══ (4) CẮT NGẮN — DB báo 2300 nhưng chỉ trả 1000 ══
  // Cách hỏng NGUY NHẤT: không có lỗi nào, file JSON tồn tại, chỉ là thiếu
  // 1300 dòng. Bản trước 05/09 sẽ thoát 0 và in "1000 dòng" rất tự tin.
  {
    const dich = await mkdtemp(join(tmpdir(), "sl-catngan-"));
    C = {
      bangTrongDb: BANG_KHAI, soDong: { ...DAY_DU, listings: 2300 },
      chiTraVe: { listings: 1000 },
    };
    const r = await chay(dich);
    const st = await docSoTay(dich);
    check("CẮT NGẮN → thoát khác 0 (không im lặng nhận bản thiếu)", r.ma !== 0, `ma=${r.ma}`);
    check("CẮT NGẮN → nói rõ kéo bao nhiêu / DB báo bao nhiêu",
      /1000 dòng nhưng DB báo có 2300/.test(r.out), r.out.slice(-400));
    check("CẮT NGẮN → manifest ghi listings vào 'hong'",
      st?.hong?.some((h) => h.ten === "listings"), JSON.stringify(st?.hong));
    await rm(dich, { recursive: true, force: true });
  }

  // ══ (5) KHÔNG ĐỌC ĐƯỢC Content-Range → không được coi là đạt ══
  // Mất cái thước thì không đo được. Thà dừng còn hơn tin con số không kiểm được.
  {
    const dich = await mkdtemp(join(tmpdir(), "sl-khongdo-"));
    C = { bangTrongDb: BANG_KHAI, soDong: DAY_DU, khongCount: "messages" };
    const r = await chay(dich);
    const st = await docSoTay(dich);
    check("KHÔNG ĐO ĐƯỢC SỐ DÒNG → thoát khác 0", r.ma !== 0, `ma=${r.ma}`);
    check("KHÔNG ĐO ĐƯỢC SỐ DÒNG → manifest nêu messages",
      st?.hong?.some((h) => h.ten === "messages"), JSON.stringify(st?.hong));
    await rm(dich, { recursive: true, force: true });
  }

  // ══ (6) XUẤT SCHEMA HỤT → dừng, không sao lưu dữ liệu rồi mới báo ══
  {
    const dich = await mkdtemp(join(tmpdir(), "sl-schema-"));
    C = { bangTrongDb: BANG_KHAI, soDong: DAY_DU, schema: "quá ngắn" };
    const r = await chay(dich);
    const st = await docSoTay(dich);
    check("SCHEMA HỤT → thoát khác 0", r.ma !== 0, `ma=${r.ma}`);
    check("SCHEMA HỤT → manifest 'hong'", st?.trang_thai === "hong", JSON.stringify(st?.trang_thai));
    await rm(dich, { recursive: true, force: true });
  }

  // ══ (7) ĐÍCH NẰM TRONG REPO → từ chối ══
  // Bản sao mang SĐT thật, repo đang public. Một lần `git add -A` là xong đời.
  {
    const trongRepo = join(HERE, "..", "tmp-kiem-sao-luu");
    C = { bangTrongDb: BANG_KHAI, soDong: DAY_DU };
    const r = await chay(trongRepo);
    check("ĐÍCH TRONG REPO → từ chối, thoát khác 0", r.ma !== 0, `ma=${r.ma}`);
    check("ĐÍCH TRONG REPO → không tạo thư mục nào trong repo",
      !existsSync(trongRepo), trongRepo);
    await rm(trongRepo, { recursive: true, force: true });
  }
} finally {
  may.close();
  // Trả repo về nguyên trạng, kể cả khi bài kiểm ném giữa chừng.
  await mkdir(dirname(SCHEMA_REPO), { recursive: true }).catch(() => {});
  if (CO_SCHEMA_CU) await writeFile(SCHEMA_REPO, SCHEMA_CU);
  else await rm(SCHEMA_REPO, { force: true });
}

let hong = 0;
for (const [n, ok, d] of R) {
  if (!ok) hong++;
  console.log(`${ok ? "✓" : "✗"} ${n}${ok ? "" : "\n     → " + String(d).slice(0, 400)}`);
}
console.log(hong
  ? `\n${hong}/${R.length} CA HỎNG`
  : `\nTẤT CẢ ${R.length} CA TỰ-KIỂM-SAO-LƯU ĐẠT — script phân biệt được 'đủ' với 'trông như đủ'.`);
process.exit(hong ? 1 : 0);
