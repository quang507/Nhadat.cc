-- FR-162 — trần theo NGUỒN GỌI, vá đường vòng của trần 100 tin/24h.
--
-- VẤN ĐỀ: FR-146 đếm tin theo `conversation_id`, mà conversation sinh ra từ
-- `external_user_id` — một chuỗi do NGƯỜI GỌI tự đặt và không ai kiểm. Đổi id
-- mỗi request là bộ đếm về 0. Nói cách khác trần cũ chặn đúng người nó không
-- định chặn (khách thật nhắn nhiều) và không chặn được người nó định chặn.
--
-- Trần toàn cục theo ngày (FR-151, `bump_model_quota`) đã giữ phần TIỀN, nhưng
-- nó là công tắc chung: một kẻ xoay id có thể đốt hết hạn mức của cả hệ thống
-- rồi khách thật ăn 429 tới hết ngày. Cần một tầng ở giữa, đếm theo thứ người
-- gọi KHÔNG tự đặt được.
--
-- CÁCH ĐẾM: cửa sổ cố định (fixed window). Không mượt bằng sliding window
-- nhưng chỉ tốn MỘT dòng cho mỗi khoá mỗi cửa sổ, và ở quy mô này thì độ mượt
-- không mua thêm được gì.

create table if not exists public.rate_counters (
  key       text        not null,
  bucket_at timestamptz not null,
  n         integer     not null default 0,
  primary key (key, bucket_at)
);
alter table public.rate_counters enable row level security;
revoke all on public.rate_counters from anon, authenticated;

comment on table public.rate_counters is
  'FR-162: bộ đếm trần theo cửa sổ cố định. Khoá = "<loại>:<giá trị>", vd "ip:1.2.3.4".';

-- true  = còn trong hạn mức (đã cộng thêm 1 lượt)
-- false = vừa vượt trần
create or replace function public.bump_rate(
  p_key         text,
  p_limit       integer,
  p_window_secs integer default 86400
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_bucket timestamptz;
  v_n      integer;
begin
  if p_key is null or p_key = '' then
    -- Không xác định được nguồn thì KHÔNG chặn. Trần này là lưới phụ; để nó
    -- chặn nhầm khách thật chỉ vì thiếu một header là đổi một lỗi lấy lỗi nặng
    -- hơn. Trần toàn cục vẫn đứng phía sau giữ tiền.
    return true;
  end if;

  v_bucket := to_timestamp(
    floor(extract(epoch from now()) / p_window_secs) * p_window_secs
  );

  insert into public.rate_counters (key, bucket_at, n)
  values (p_key, v_bucket, 1)
  on conflict (key, bucket_at)
    do update set n = public.rate_counters.n + 1
  returning n into v_n;

  -- Dọn rác thưa tay (~1/500 lượt gọi): bảng này chỉ toàn dòng dùng một lần
  -- rồi bỏ, không dọn thì nó phình mãi. Đặt trong cùng transaction nên không
  -- cần thêm một job cron nữa để rồi lại phải trông chừng job đó.
  if random() < 0.002 then
    delete from public.rate_counters where bucket_at < now() - interval '3 days';
  end if;

  return v_n <= p_limit;
end $$;

revoke execute on function public.bump_rate(text, integer, integer)
  from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- PHÍA EDGE FUNCTION (chat-reply): CỔNG 3.
-- Chỉ áp cho lượt gọi KHÔNG mang service_role. Lý do phải chia hai đường:
--   · zalo-webhook gọi bằng service_role, và MỌI khách Zalo đi chung đường đó
--     từ cùng một dải IP hạ tầng Supabase → đếm theo IP ở đây là chặn nhầm cả
--     nhà. Đường này `external_user_id` do ZALO cấp nên không xoay được, trần
--     100 tin/24h theo conversation là đúng chỗ.
--   · Ai gọi thẳng bằng anon key thì `external_user_id` là chuỗi họ tự bịa —
--     đúng lỗ hổng đang vá. Đường này đếm theo IP.
