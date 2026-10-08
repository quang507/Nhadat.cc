# bot/ — Bot Zalo của Aioinhadat (Supabase Edge Functions)

Deno trên Supabase, project `nhadat-cc` (`rqxmmqmctpklqcmbfxuj`). Đặc tả ở
`docs/07-srs.md`; tone giọng ở `docs/06 §6.8` — **sửa docs trước, sửa
`_shared/prompts.ts` sau**, rồi đồng bộ bảng `bot_prompts`.

## Function đang chạy (04/09/2026)

| Function | v | verify_jwt | Việc |
|---|---|---|---|
| `chat-reply` | 48 | tắt | Bộ não hội thoại dùng chung mọi kênh. Phân vai từng lượt (mua / bán / CTV / admin), nhánh mua (hồ sơ nhu cầu, lọc kho, tra mã căn, căn tương tự, giá TB phường, gửi ảnh, đặt lịch, hỏi chủ, chốt kèo), nhánh bán (nhỏ giọt một thông tin/lần), nhánh nội bộ (`#mã: trả lời`). Lọc liên hệ trước khi gửi người mua. |
| `zalo-webhook` | 12 | tắt | Nhận event OA, ghi `inbound_events` rồi ack < 1s, chuyển `chat-reply`, gửi bong bóng (300 ms giữa hai bong bóng). Cửa `{replay_event_id}` cho đường cứu. |
| `nudge` | 25 | tắt | Cron 2 lượt/giờ giờ người: nhắc lời hứa, nhắc lịch xem trước 45' kèm link bản đồ, follow-up, hỏi thăm khách im **5 ngày** (6 góc xoay vòng, ≥6 ngày buộc giữ kết nối Zalo), và các kind mẫu-cố-định `match` / `feedback` / `sold` / `rating`. `{dry_run, force}`. |
| `ask-seller` | 9 | bật | Đọc `listing_missing_facts`, sinh MỘT tin hỏi người bán, ghi `info_requests`; bỏ qua fact đang `pending`. |
| `ctv-report` | 10 | bật | Báo cáo 17h VN per-CTV (đơn, lịch xem, việc chờ người thật, hạng CTV), lưu `ctv_daily_reports`, đẩy qua `reminders` kind `report`. |
| `escalation-feed` | 10 | bật | Cửa cho bridge: `{action:"pull"}` lấy việc kèm text soạn sẵn + đích, `{action:"ack", id}` đánh dấu đã gửi (kèm học `zalo_user_id`), `{action:"log"}` ghi lỗi vào sổ. |
| `media-cleanup` | 4 | tắt | Nhặt `media_cleanup_queue`, xoá file Storage, đánh dấu. File không còn cũng tính xong. |
| `inbound-sweep` | 3 | tắt | Đường cứu tin đến: hỏi `viec_inbound_bo_roi()` rồi gọi ngược `zalo-webhook` ở cửa phát lại (không tự gửi — khâu gửi giữ luật chống gửi đúp). |
| `geocode-listings` | 5 | bật | Điền `lat`/`lng` từ `location_raw` qua Nominatim (1 req/s). Gọi tay. |

Gọi: `POST {SUPABASE_URL}/functions/v1/<name>`, header `Authorization: Bearer
<anon key>`; function nào có cổng thì thêm `x-bridge-secret`.

**Hạ tầng dùng chung — import, đừng chép lại:**
`_shared/claude.ts` (`serviceClient`, `secretOf`, `anthropicClient`,
`jsonResponse`, `sendZalo`, `sendZaloImage`, `escalationText`, `ghiLoi`,
`doTien`, `MODEL`) · `_shared/gate.ts` (`congBiMat`) · `_shared/prompts.ts`
(văn phong, luật phí, kịch bản người bán, từ điển lóng, few-shot, rubric) ·
`_shared/thong_so.ts` (`SPEC_COLS`, `thongSoNgan`) · `_shared/dia_ban.ts`
(`bocQuan`).

Hai luật không được quên: mọi `catch` mới phải gọi `ghiLoi(...)` (FR-152 d);
mọi chỗ gọi model phải gọi `await doTien(client, r.usage)` ngay sau đó, không
thì lượt đó vô hình với đồng hồ tiền ở `/admin` (FR-169).

## Deploy

**Đường chính: workflow `Deploy bot lên Supabase`** (tab Actions → Run workflow
→ chọn hàm). Runner tự checkout, Supabase CLI tự tìm `_shared/` và đẩy thẳng
file NGUỒN lên — không bundle, và quan trọng hơn là **bytes không đi qua tay
ai**. Cần secret `SUPABASE_ACCESS_TOKEN` của repo (Personal Access Token ở
https://supabase.com/dashboard/account/tokens); thiếu nó job dừng ngay bước
đầu.

Workflow tự đọc `verify_jwt` của bản đang chạy rồi deploy lại đúng giá trị đó —
**không chép cứng vào file**, vì chép cứng là sẽ lệch (đúng vết `schema.sql` đã
lệch với DB). Đặt sai cờ này là bot câm: `chat-reply` đang `false`, bật lên thì
`zalo-webhook` gọi vào ăn 401. Xong nó đọc lại lần nữa: version phải TĂNG,
`verify_jwt` phải GIỮ NGUYÊN — "đã gọi lệnh deploy" không phải bằng chứng đã
deploy, cùng cái bẫy NFR-18.

**Mỗi lúc chỉ MỘT lượt deploy** (`concurrency: deploy-bot`, 28/09/2026). Hôm đó
`chat-reply` và `ask-seller` deploy song song: bước kiểm báo v262 → v263, vài
phút sau Supabase vẫn ghi v262 và production chạy code cũ suốt một lượt test.
Nay lượt sau xếp hàng chờ lượt trước xong, và bước kiểm đọc lại lần hai sau 30
giây — version / mã bản build phải giữ nguyên. GitHub chỉ giữ MỘT lượt chờ trong
nhóm: bấm ba lượt liền thì lượt chờ cũ bị huỷ (tab Actions ghi "cancelled"),
nên deploy nhiều hàm thì bấm lần lượt, đợi lượt trước xong.

Chạy tay trên máy có CLI thì tương đương:

```bash
cd bot && supabase functions deploy <fn> --project-ref rqxmmqmctpklqcmbfxuj \
  [--no-verify-jwt nếu bản đang chạy là false]
```

**Lối MCP chỉ dùng cho hàm NHỎ** (dưới ~10 KB sau bundle), vì nó bắt chép tay
nội dung vào lời gọi tool — và chép tay đo được **một lỗi mỗi 7 KB**, lỗi rơi
vào regex thì hỏng im lặng. `escalation-feed` 5 KB thì còn kiểm được bằng cách
so từng byte; `chat-reply` 120 KB thì không, 17 lỗi kỳ vọng và chữa cũng phải
chép tay 120 KB nữa. Khi buộc phải đi lối đó:

```bash
bun build bot/supabase/functions/<fn>/index.ts --target=node \
  --external 'npm:*' --minify-whitespace --outfile <scratch>/<fn>.ts
```

1. Bundle như trên (gộp `_shared/`, chỉ còn một file `index.ts`).
2. `deploy_edge_function` với nội dung lấy **thẳng từ file bundle**, giữ đúng
   `verify_jwt` của bản đang chạy.
3. `get_edge_function` kéo ngược, chuẩn hoá `\uXXXX` rồi **so từng byte** với
   bundle. Lệch là deploy lại, không được để bản lệch.
4. Chạy e2e **trên chính nội dung kéo ngược** trước khi coi là xong.
5. Gọi thử một lượt thật bằng `net.http_post` từ SQL (uid `TEST-…`, secret đọc
   từ `vault.decrypted_secrets` ngay trong câu truy vấn, không in ra), rồi dọn
   dữ liệu thử. Đọc kết quả ở `net._http_response`, đừng tin `net.http_post`.

Hai lối đẻ ra hai hình hài khác nhau trên server: CLI để lại **nhiều file
nguồn**, MCP để lại **một file bundle**. `get_edge_function` trả về cái nào là
biết lần trước ai deploy.

## Test

```bash
bun run test:bot                    # cả bốn bộ dưới + tự kiểm TS-SEC (offline)
bash bot/tests/e2e/chay.sh          # 274 ca (226 chat-reply + 44 zalo-webhook + 4 cổng-thiếu-bí-mật),
                                    # TỰ dựng lại cả hai bundle — đừng chạy run.mjs / webhook.mjs trực tiếp
node bot/tests/fr159-bon-vai.mjs    # 65 ca phân vai
node bot/tests/fr161-go-lan-dau.mjs # 9 ca tiếng Việt không dấu
node bot/tests/fr164-loi-sua-va-cau-hoi-treo.mjs  # 8 ca

bun run test:sec                    # TS-SEC thật: bắn anon key vào DB thật (cần Internet)
node bot/tests/ts-sec-anon.tu-kiem.mjs   # chứng minh bộ trên không báo xanh giả
```

`test:sec` dùng **khoá công khai** (`sb_publishable_…`, đã nằm trong
`lib/supabase.ts`) — đừng thay bằng service_role, làm thế là bỏ qua RLS và bộ
test mất sạch ý nghĩa. Nó thoát **2** khi không tới được DB, khác hẳn thoát 0
là đạt: bản đầu của nó coi mọi HTTP ≥400 là "bị chặn = đạt" và báo 24/24 xanh
trong lúc proxy chặn sạch, chưa request nào tới Supabase.

Suite chạy trên DB thật (rollback) và bảng kiểm đầy đủ nằm ở `docs/10`.

## Cron (Postgres `pg_cron`, giờ UTC; 1–13 UTC = 8–20h VN)

| Job | Lịch | Việc |
|---|---|---|
| `nudge-tick` | `7,37 1-13 * * *` | gọi `nudge` |
| `seller-drip-tick` | `22,52 1-13 * * *` | hỏi nhỏ giọt người bán |
| `ctv-sla-tick` | `*/15 1-13 * * *` | quá 120' thì admin đỡ khách (FR-173) |
| `info-timeout-tick` | `3 1-13 * * *` | 24h nhắc, 48h đóng câu hỏi (FR-110) |
| `ctv-report-tick` | `0 10 * * *` | báo cáo 17h VN |
| `stale-listing-tick` | `0 2 * * *` | tin im 30 ngày → hỏi còn bán không (FR-103) |
| `listing-interest-decay` | `0 20 * * *` | hạ cờ "đang quan tâm" sau 7 ngày |
| `bot-health-tick` | `*/15 * * * *` | quét `net._http_response`, nhịp tim, còi ntfy |
| `inbound-sweep-tick` | `* * * * *` | đường cứu tin đến |
| `media-cleanup-tick` | `*/5 * * * *` | dọn file |
| `media-chet-tick` | `0 * * * *` | nhặt việc dọn chết |
| `cron-don-so` | `15 18 * * *` | xoá `cron.job_run_details` quá 7 ngày |

**Đừng tin `cron.job_run_details.status`**: `net.http_post` trả về ngay khi xếp
hàng nên cron luôn báo `succeeded` kể cả khi function trả 500. Kết quả thật ở
`net._http_response`, được `bot_health_tick()` quét sang `bot_errors`.

## Cấu hình

- **Sửa "não" không cần deploy (FR-138)**: bảng `bot_prompts` (key/content) —
  `tone_rules`, `human_chat_rules`, `fee_rules`, `seller_script_rules`,
  `seller_fewshot` (FR-178), `slang_notes`, `buyer_fewshot`, `agree_rules`, `rate_ctv_rubric`. Sửa ở Table
  Editor là bot đổi trong vòng một phút (nhớ tạm 60 s). Nội dung phải khớp
  `_shared/prompts.ts` — đổi một bên thì đồng bộ bên kia bằng script, đừng gõ tay.
- **Secret trong Vault** (đọc qua RPC `get_secret`, chỉ `service_role`):
  `ANTHROPIC_API_KEY`, `BRIDGE_SECRET`, `GROQ_API_KEY`, `GROQ_MODEL` (danh sách
  ngăn phẩy, FR-194), `MODEL_TRUOC` (`groq` mặc định — Groq trả lời trước, chạm
  trần thì Claude liền; `claude` là Claude trước, FR-194 b). Chưa có: `ZALO_OA_TOKEN`,
  `ZALO_APP_SECRET`/`ZALO_APP_ID` (OPEN-33), `ZALO_ADMIN_ZALO_ID`,
  `NTFY_TOKEN` (cần cho email FR-81), `DAILY_MODEL_CALL_CAP` (mặc định 1000).
- **`app_config`** (khoá/giá trị, không phải secret): `ntfy_topic`, `admin_email`,
  URL Storage công khai; `bao_lai_da_luu` (`tat` · `thay_doi` · `day_du` · `admin` = 🤖 chỉ ghi
  `messages` cho /admin, không gửi khách — SRS-5.1zzi); `luat_loi_bot` (`gon` mặc định · `du`);
  `nhip_go` (`bat` = nghỉ "đang gõ" theo độ dài tin trước, chat-reply trả `nhip_go[]` cho webhook
  và bridge — SRS-5.1zzm; không có dòng = 300 ms như quyết định 25/08).
- **File và link người bán gửi (05/10/2026, SRS-5.1zzj…zzl)**: webhook OA nhận
  `user_send_file` / `user_send_link`; PDF / ảnh bảng giá, phân lô, brochure → model đọc ra từng
  căn vào kho `du_an_can` (dự án dùng chung, giá niêm yết), file gốc ở `listing-private/du-an/…`,
  dòng tham chiếu `du_an_tai_lieu`; CSV / XLSX → nhập rổ hàng mỗi dòng một tin (cột SĐT bỏ).
  Link Google Drive: file công khai tải không cần khoá; THƯ MỤC cần secret `GOOGLE_API_KEY`
  trong Vault (chưa có → bot nói gửi từng file). Xem kho căn: Table Editor `du_an_can` (admin
  đọc qua `la_admin()`); duyệt bằng cột `trang_thai`.

## Vận hành

- **Bridge Zalo** (`bot/bridge-zca/`, zca-js trên acc cá nhân trong lúc chờ OA
  duyệt): poll `escalation-feed`, gửi tin, ack ngược. Cài lên VPS theo
  `bot/bridge-zca/VPS.md` (systemd `nhadat-bridge.service`). Bridge chết là
  đường ra Zalo đứt.
- **Còi báo ngoài bridge**: `canh_bao_ngoai()` → ntfy.sh topic trong
  `app_config.ntfy_topic`; `bot_health_tick` kêu 1 tin/giờ khi bridge im. Đây là
  đường báo động DUY NHẤT không vòng lại qua bridge (FR-152 e).
- **Sao lưu**: KHÔNG CÒN — chủ dự án bỏ 11/09/2026. Supabase gói Free không
  tự sao lưu — mất dữ liệu là không lấy lại được (OPEN-25).
  `bot/supabase/schema.sql` chỉ là ảnh chụp DDL, không có dòng dữ liệu nào;
  lệnh sinh lại ở `CLAUDE.md §6`.
- **Soát trôi schema**: `node scripts/soat-migration.mjs` — so migration đã áp
  trên DB với file trong repo, và kiểm ảnh chụp schema còn mới. Chạy sau mỗi
  lần áp migration bằng MCP.

### Dựng lại từ số không

**Đã diễn tập thật 08/10/2026** (project cũ `tbcdpupiarkuxtntmosl` bị xoá nhầm, gói Free, Supabase xác nhận không khôi
phục được — dữ liệu cũ đều là dữ liệu thử). Project mới `rqxmmqmctpklqcmbfxuj` dựng bằng **`scripts/dung-lai-db.mjs`**
chạy qua `apply-migration.yml` ô `dung_lai` (token `SUPABASE_ACCESS_TOKEN`, không cần service_role), theo thứ tự:
`kiem` (chỉ đọc) → `cau-truc` → `bu` → `du-lieu` → `xac-minh` (kèm `commit_schema` = `commit`). Mỗi bước in kết quả
thành annotation (log job phiên Claude không đọc được). Những gì lượt diễn tập bắt được — thủ tục tay bên dưới đều
dính, script đã xử lý:

- `xuat_schema()` cũ xuất **cột sinh** (`duong.ten_khong_dau`, `listings.price_per_m2_vnd`) thành `default <biểu thức>`
  và **cột identity** (`messages.seq`, `required_facts.id`, `phuong_cu.id`, `boc_tach_bong.id`, `van_kich.id`) thành
  `not null` trơn; làm rơi `security_invoker=false` của view → `schema.sql` chưa bao giờ dựng lại được hai bảng lõi.
  Sửa tận gốc ở `20261008b`.
- Dashboard tick "Enable automatic RLS" tạo event trigger `ensure_rls` — gỡ trước khi nạp (bảng cố ý tắt RLS).
- Project mới **tự cấp quyền** bảng / view mới cho `anon` + `authenticated`; `schema.sql` chỉ chép GRANT nên phải
  `revoke all` rồi cấp lại theo `schema.sql` **bản cũ** (sinh lại `schema.sql` trước bước này là chép luôn quyền thừa).
- Project mới không có `supabase_migrations.schema_migrations` (chỉ CLI tạo) — tạo và ghi mọi file trong repo.
- Dữ liệu tham chiếu không nằm trong `schema.sql`: script chạy lại câu insert/update/delete trên `wards`, `phuong_cu`,
  `quan_cu`, `required_facts`, `app_config` từ **điểm reset** của từng bảng (`20260909h` xoá rồi nạp lại nguyên bộ
  `required_facts`), file có bảng tạm gửi chung một lượt. Kết quả đối chiếu: câu `co_ban` khớp mock e2e.
- Đối chiếu sau dựng: 646/646 đối tượng (hàm, view, trigger, policy, index, ràng buộc, bảng, cron) có đủ; chỉ khác ở
  các chỗ sửa có chủ đích; cổng CI 7 và 8 xanh.
- Còn phải làm tay sau khi dựng: Vault (`ANTHROPIC_API_KEY`, `BRIDGE_SECRET`…), `nap-duong.mjs`, `thu-du-an.mjs`,
  deploy 9 function (`deploy-bot.yml` — lần đầu lấy `verify_jwt` theo bảng ở đầu file này), `dong-bo-prompt --day`,
  biến môi trường Vercel, `.env` bridge.

Thủ tục tay cũ (giữ để tham chiếu):

Không còn sao lưu (chủ dự án bỏ 11/09/2026): làm theo đây ra một DB đúng cấu
trúc nhưng RỖNG — tin, người bán, hội thoại đều mất. Thứ tự này chưa diễn tập
thật (chưa có project thứ hai để thử).

1. Tạo project Supabase mới, ghi lại URL + khoá.
2. **Schema**: chạy `bot/supabase/schema.sql` trong SQL Editor. File này là ảnh
   chụp DDL đầy đủ (bảng, ràng buộc, index, hàm, view, trigger, RLS, policy,
   quyền, bucket, cron). Thứ tự trong file là bảng → hàm → view → trigger; view
   chồng view có thể phải chạy lại lượt hai — file dùng `create or replace` và
   `if not exists` nên chạy lại được, không cần dọn.
   *`xuat_schema()` KHÔNG xuất DỮ LIỆU: bảng `wards` (168 phường mới ↔ quận cũ,
   FR-209) dựng xong phải chạy thêm `migrations/20260915a_wards_phuong_moi.sql`
   (có `on conflict` nên chạy lại được). Bảng `duong` (từ điển tên đường, FR-212,
   `20260921b`) cũng là DỮ LIỆU: dựng xong chạy `node scripts/nap-duong.mjs` (cần
   service_role trong `scripts/.env` + ra được Overpass; ~10 phút, upsert nên chạy lại được).*
   *Không dùng thư mục `migrations/` để dựng lại: 44 migration đầu không còn
   file (OPEN-46), và soát 13/09/2026 thấy 34 hàm trên DB có thân khác file
   migration cuối cùng của chúng. Migration là để ghi THAY ĐỔI, `schema.sql` mới
   là để dựng — cổng CI thứ 7 so md5 từng thân hàm `schema.sql` ↔ DB nên file này
   không tụt lại được nữa; đỏ thì `node scripts/sinh-schema.mjs` rồi commit.*
   Xong thì chạy thêm `migrations/20260907c_schema_so_doc_nhu_excel.sql`,
   `migrations/20260907f_so_ro_hang_doc_mot_dong.sql` rồi
   `migrations/20260907g_so_hoi_thoai_doc_lai_log_chat.sql`:
   schema `so` (hai view nhìn như Excel) nằm NGOÀI vùng `xuat_schema()` quét
   nên không có trong `schema.sql`. Bỏ qua cũng không mất dữ liệu — chỉ là view.
3. **Bí mật**: chép tay vào Vault — `ANTHROPIC_API_KEY`, `BRIDGE_SECRET`.
   Không có trong `schema.sql`, cố ý.
4. **Dữ liệu**: không còn bản sao nào để nạp. Cấu hình (`admins`,
   `app_config`, `bot_prompts`, `required_facts`…) phải nhập lại tay; tin,
   người bán, người mua, hội thoại thì mất hẳn.
5. **Storage**: không sao lưu. Bucket còn thì giữ nguyên; mất là mất
   (`masterDB/` cũng đã xoá 09/09, `up-anh.mjs` không còn nguồn).
6. **Edge function**: deploy lại 9 function từ `bot/supabase/functions/` theo
   mục Deploy ở trên (bundle → deploy → kéo ngược → so byte).
7. **Kiểm**: `bun run test:sec` phải xanh, `/admin` phải lên số, `/moi-gioi`
   phải ra đủ NMG.
- **Sức khoẻ**: trang `/admin` — sổ lỗi, nhịp tim, tiền bộ não, độ trễ bot,
  việc chờ, hạng CTV.

### Sự cố 27/08 → 04/09/2026: bridge im 8 ngày

Bridge dừng lúc 27/08 16:21 (VN). Sổ lỗi có ghi, nhưng **đường báo động lại đi
qua chính bridge** nên không ai biết: 120 lời nhắc escalation bị huỷ vì treo quá
lâu, báo cáo CTV không tới. Vá: `canh_bao_ngoai()` gọi thẳng ntfy (04/09), và
bridge chuyển lên VPS có systemd tự khởi động lại. Bài học ghi vào NFR-18: một
kênh báo động không được đi qua thứ mà nó phải giám sát.

## Migration

72 file ở `bot/supabase/migrations/`, đặt tên `YYYYMMDD<chữ>_<việc>.sql`, áp
theo thứ tự tên. Sửa DB bằng `apply_migration` với đúng nội dung file trong
repo, không sửa tay ở dashboard rồi quên ghi lại. Đợt gần nhất: `20260906a`
(còi ntfy đọc lại kết quả) → `20260906b` (chú thích bảng + view `ro_hang_ban`)
→ `20260907a` (`CHECK sort_order`, đang ở PR #35).

**Áp migration xong mà chưa mở PR cho file của nó thì việc CHƯA XONG.** Đẩy
nhánh lên remote không phải là đưa file về repo — 07/09 `20260907a` đã áp lên
production trong khi file chỉ nằm trên một nhánh không có PR, đúng hình lỗi đẻ
ra OPEN-46 (chỉ khác là bắt sau vài giờ thay vì hai tuần).

**Migration ghi THAY ĐỔI, `schema.sql` mới dựng lại được.** Câu cũ ở đây nói
migration là "nguồn sự thật của schema" — sai. Đo lại 07/09: DB đã áp **114**
migration, `main` có **72** file → **41** migration (gần hết là khối 21/08 →
27/08) áp qua MCP mà không ai lưu file (OPEN-46). Nội dung chúng mất vĩnh viễn.
Lưới an toàn là `bot/supabase/schema.sql`, sinh bởi `xuat_schema()` — **file đó
thật sự vào repo lần đầu 07/09** (5112 dòng, PR #35); trước đó lời hứa "repo một
mình cũng dựng lại được" chưa thành sự thật vì chưa ai commit nó. Chạy
`node scripts/soat-migration.mjs` để không trôi thêm.

## Chưa làm

OA Zalo chờ duyệt (đang chạy acc clone qua bridge) · thoại/STT (FR-134) ·
fingerprint (FR-16, OPEN-14) · chữ ký webhook Zalo (OPEN-33) · các mục còn lại
ở `docs/09` OPEN-43.
