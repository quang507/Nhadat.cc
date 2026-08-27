-- FR-158 — Zalo OA access token tự làm mới.
--
-- VẤN ĐỀ: access token của Zalo OA sống ĐÚNG 25 TIẾNG. Từ trước tới giờ token
-- nằm chết một chỗ trong Vault (`ZALO_OA_ACCESS_TOKEN`), không có dòng code hay
-- cron nào đổi nó. Nghĩa là mỗi lần cấp token thủ công, bot sống được một ngày
-- rồi câm — và câm theo kiểu tệ nhất:
--   · `sendZalo()` trả `error != 0` → hàm trả `false`;
--   · edge function vẫn trả HTTP 200 → `bot_health_tick()` (chỉ soi mã HTTP)
--     không thấy gì;
--   · khách ngồi chờ một câu trả lời không bao giờ tới.
-- Đúng loại hỏng im lặng mà FR-152 sinh ra để diệt.
--
-- CÁCH SỬA: token SỐNG chuyển sang bảng này; cron 12 tiếng gọi edge function
-- `zalo-token-refresh` đi đổi refresh_token lấy cặp mới. Vault chỉ còn giữ HẠT
-- GIỐNG cho lần chạy đầu (`ZALO_OA_REFRESH_TOKEN`) + app_id/secret.
--
-- LƯU Ý SỐNG CÒN: Zalo XOAY refresh_token — mỗi lần đổi là refresh_token cũ
-- CHẾT. Nên bảng này là bản duy nhất giữ chìa khoá còn dùng được; mất nó thì
-- phải vào Zalo Developers cấp tay lại từ đầu. Nó cũng nằm trong danh sách bảng
-- của scripts/sao-luu.mjs vì lý do đó.

create table if not exists public.bot_tokens (
  name          text primary key,          -- 'zalo_oa'
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,               -- hạn của access_token
  updated_at    timestamptz not null default now(),
  last_error    text                       -- lần đổi gần nhất hỏng vì gì
);

-- RLS bật + KHÔNG policy nào = chỉ service_role đọc/ghi được. Bảng này chứa
-- chìa khoá gửi tin thay mặt OA; anon/authenticated tuyệt đối không được thấy.
alter table public.bot_tokens enable row level security;
revoke all on public.bot_tokens from anon, authenticated;

comment on table public.bot_tokens is
  'FR-158: token OA còn sống. Chỉ service_role. refresh_token XOAY mỗi lần đổi — mất là phải cấp tay lại.';

-- Gọi edge function bằng anon key như các tick khác (function tự dùng
-- service_role bên trong). 12 tiếng một nhịp: token sống 25 tiếng nên lỡ MỘT
-- nhịp vẫn còn nhịp sau cứu; đặt 24 tiếng là hụt một nhịp thì mất luôn OA.
create or replace function public.zalo_token_tick() returns void
language plpgsql security definer as $$
begin
  perform net.http_post(
    url := 'https://tbcdpupiarkuxtntmosl.supabase.co/functions/v1/zalo-token-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_zmJBmEgFPn3bBKx_1ve6Pg_dXdo4haX'
    ),
    body := '{}'::jsonb
  );
end $$;
revoke execute on function public.zalo_token_tick() from public, anon, authenticated;

select cron.unschedule('zalo-token-tick')
  where exists (select 1 from cron.job where jobname = 'zalo-token-tick');
select cron.schedule('zalo-token-tick', '17 */12 * * *', 'select public.zalo_token_tick()');

-- NHẮC LẠI NFR-18: cron.job_run_details của job này sẽ LUÔN báo `succeeded`,
-- kể cả khi edge function trả 500 — `net.http_post()` chỉ xếp hàng rồi trả về.
-- Muốn biết lần đổi có thật sự thành công không thì xem `bot_tokens.updated_at`
-- (phải mới hơn 12 tiếng) và `bot_tokens.last_error`, hoặc mở /admin.
