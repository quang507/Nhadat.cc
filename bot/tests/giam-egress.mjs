// Chặn tái phát đợt giảm egress Supabase 02/10/2026 (docs/07 SRS-5.1z). Soi MÃ NGUỒN, không gọi DB:
//  G-01 generateStaticParams của route động KHÔNG được hỏi Supabase — mỗi lượt build (CI mỗi PR + Vercel preview +
//       production) sẽ dựng sẵn mọi dòng; /du-an/[slug] từng đốt 83% request REST cả project như vậy.
//  G-02 mọi `rpc("match_projects", …)` phải nối `.select(…)` — hàm trả SETOF projects, không chọn cột là kéo cả vector `nhung`.
//  G-03 không `select("*")` trên `listings` / `projects` ở web và chat-reply (vector `nhung` ~9,8 KB/dòng).
//  G-04 (03/10, SRS-5.1zl) chat-reply chỉ kéo NỘI DUNG `bot_prompts` (38 KB, 60–80% byte một lượt đo được) sau bước so
//       phiên `key, updated_at` trong `napPrompt` — không chỗ nào khác đọc `content`.
//  G-05 chat-reply đọc CẢ bảng `wards` (17 KB) chỉ qua `napPhuong` (nhớ theo isolate).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const goc = new URL("../..", import.meta.url).pathname;
let dat = 0, hong = 0;
const kiem = (ten, ok, chiTiet = "") => { ok ? dat++ : hong++; console.log(`${ok ? "✓" : "✗"} ${ten}${ok ? "" : ` — ${chiTiet}`}`); };

function duyet(thu, ra = []) {
  for (const f of readdirSync(thu)) {
    const p = join(thu, f);
    if (statSync(p).isDirectory()) duyet(p, ra);
    else if (/\.(tsx?|mjs)$/.test(f)) ra.push(p);
  }
  return ra;
}

// G-01: thân hàm generateStaticParams (tới dấu `}` đầu dòng) không chứa supabase/from(/rpc(.
const trang = duyet(join(goc, "app")).filter((p) => /\[[^\]]+\]/.test(p) && p.endsWith("page.tsx"));
for (const p of trang) {
  const s = readFileSync(p, "utf8");
  const m = s.match(/export (?:async )?function generateStaticParams\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
  if (!m) continue;
  const hoiDb = /supabase|\.from\(|\.rpc\(/.test(m[1]);
  kiem(`G-01 ${p.slice(goc.length)}: generateStaticParams không hỏi DB`, !hoiDb, "dựng sẵn mọi dòng mỗi lượt build — trả [] (vẫn ● / ISR)");
}

// G-02 + G-03 trên chat-reply và web.
const nguon = [join(goc, "bot/supabase/functions/chat-reply/index.ts"), ...duyet(join(goc, "app")), ...duyet(join(goc, "lib")), ...duyet(join(goc, "components"))];
for (const p of nguon) {
  const s = readFileSync(p, "utf8");
  const ten = p.slice(goc.length);
  for (const m of s.matchAll(/rpc\("match_projects",[^)]*\)(\s*\.\w+)?/g)) {
    kiem(`G-02 ${ten}: match_projects có .select`, (m[1] ?? "").trim() === ".select", m[0].slice(0, 80));
  }
  for (const m of s.matchAll(/from\("(listings|projects)"\)\s*\.select\("\*"\)/g)) {
    kiem(`G-03 ${ten}: không select("*") trên ${m[1]}`, false, m[0]);
  }
}

// G-04 + G-05.
{
  const cr = readFileSync(join(goc, "bot/supabase/functions/chat-reply/index.ts"), "utf8");
  const docNoiDung = [...cr.matchAll(/from\("bot_prompts"\)\.select\("key, content"\)/g)].length;
  const thanNap = cr.match(/async function napPrompt\([\s\S]*?\n\}/)?.[0] ?? "";
  kiem("G-04 chat-reply: nội dung bot_prompts chỉ đọc một chỗ, trong napPrompt, sau bước so key/updated_at",
    docNoiDung === 1 && /select\("key, content"\)/.test(thanNap) && thanNap.indexOf('select("key, updated_at")') >= 0 &&
      thanNap.indexOf('select("key, updated_at")') < thanNap.indexOf('select("key, content")'),
    `số chỗ đọc content: ${docNoiDung}`);
  const caBang = [...cr.matchAll(/from\("wards"\)\.select\([^)]*\)\.limit\(/g)].length;
  const thanPhuong = cr.match(/async function napPhuong\([\s\S]*?\n\}/)?.[0] ?? "";
  kiem("G-05 chat-reply: đọc cả bảng wards chỉ trong napPhuong", caBang === 1 && /from\("wards"\)/.test(thanPhuong), `số chỗ đọc cả bảng: ${caBang}`);
}

// Ca tự kiểm: bộ bắt phải BẮT được mẫu xấu (không thì xanh vì soi sai).
const xau = 'export async function generateStaticParams() {\n  const { data } = await supabase.from("projects").select("slug");\n  return data;\n}';
const mx = xau.match(/export (?:async )?function generateStaticParams\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
kiem("G-tu-kiem: bắt được generateStaticParams hỏi DB", !!mx && /supabase/.test(mx[1]), "regex không còn bắt mẫu cũ");
const rpcXau = 'client.rpc("match_projects", { p_text: text }).then((r) => r)';
const mr = [...rpcXau.matchAll(/rpc\("match_projects",[^)]*\)(\s*\.\w+)?/g)][0];
kiem("G-tu-kiem: bắt được match_projects thiếu .select", mr && (mr[1] ?? "").trim() !== ".select", "regex không còn bắt mẫu cũ");

console.log(`\n${dat}/${dat + hong} đạt`);
if (hong) process.exit(1);
