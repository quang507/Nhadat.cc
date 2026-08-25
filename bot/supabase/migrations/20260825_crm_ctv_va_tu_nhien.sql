-- Bản sao tham chiếu các migration đã áp lên project nhadat-bot ngày 25/08/2026
-- (áp qua MCP apply_migration; file này để đọc-hiểu và dựng lại môi trường mới).
-- Gồm: SRS-4.5 giá số, FR-135 cờ người thật, FR-32 follow-up, FR-136/137 CRM CTV.

-- ============ SRS-4.5: giá dạng số để lọc "dưới 4 tỷ" bằng SQL ============
-- Hướng parseVnd của NhaDat-Radar: "5,5 tỷ"→5.5e9; "3 tỷ 200"→3.2e9;
-- "12 triệu/tháng"→12e6; "thương lượng"→NULL.
create or replace function public.parse_vnd(p text) returns bigint
language plpgsql immutable as $$
declare
  m text[];
begin
  if p is null or btrim(p) = '' then return null; end if;
  m := regexp_match(p, '([0-9]+)\s*t[ỷỉyĩ]\w*\s*([0-9]{1,3})(?!\s*m)', 'i');
  if m is not null then
    return m[1]::numeric * 1e9 + m[2]::numeric * 1e6;
  end if;
  m := regexp_match(p, '([0-9]+[.,]?[0-9]*)\s*t[ỷỉyĩ]', 'i');
  if m is not null then
    return (replace(m[1], ',', '.')::numeric * 1e9)::bigint;
  end if;
  m := regexp_match(p, '([0-9]+[.,]?[0-9]*)\s*(tri[ệe]u|tr\M)', 'i');
  if m is not null then
    return (replace(m[1], ',', '.')::numeric * 1e6)::bigint;
  end if;
  return null;
exception when others then
  return null;
end $$;

alter table public.listings add column if not exists price_vnd bigint;
update public.listings set price_vnd = public.parse_vnd(price_raw) where price_vnd is null;

create or replace function public.listings_set_price_vnd() returns trigger
language plpgsql as $$
begin
  new.price_vnd := public.parse_vnd(new.price_raw);
  return new;
end $$;
drop trigger if exists trg_listings_price_vnd on public.listings;
create trigger trg_listings_price_vnd
  before insert or update of price_raw on public.listings
  for each row execute function public.listings_set_price_vnd();
create index if not exists idx_listings_price_vnd on public.listings (deal, price_vnd);

-- ============ FR-135: bot bí / khách đòi người thật → cờ cho CTV ============
alter table public.conversations
  add column if not exists needs_human boolean not null default false,
  add column if not exists needs_human_at timestamptz;

-- ============ FR-32: hỏi một căn rồi im ~2,5h → chủ động gửi thêm ============
alter table public.reminders drop constraint if exists reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check
  check (kind in ('promise', 'reengage', 'viewing', 'followup'));
alter table public.reminders add column if not exists listing_id uuid references public.listings(id);

-- ============ FR-136: CRM CTV — chia đơn xoay vòng ============
create table if not exists public.ctvs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  zalo_user_id text unique,          -- Zalo cá nhân CTV (điền khi có thật)
  active boolean not null default true,
  last_assigned_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.ctvs enable row level security;
alter table public.ctvs add column if not exists last_assigned_at timestamptz;

insert into public.ctvs (name)
select v from (values ('CTV 1'), ('CTV 2')) as t(v)
where not exists (select 1 from public.ctvs where active);

alter table public.conversations add column if not exists ctv_id uuid references public.ctvs(id);

-- Đơn "đang chăm" = có tương tác 30 ngày gần nhất; người ôm ít nhất nhận đơn mới
create or replace function public.assign_ctv_round_robin() returns trigger
language plpgsql security definer as $$
declare
  picked uuid;
begin
  if new.ctv_id is not null then return new; end if;
  select c.id into picked
  from public.ctvs c
  left join public.conversations v
    on v.ctv_id = c.id and v.last_message_at > now() - interval '30 days'
  where c.active
  group by c.id, c.last_assigned_at
  order by count(v.id), c.last_assigned_at nulls first
  limit 1;
  if picked is not null then
    new.ctv_id := picked;
    update public.ctvs set last_assigned_at = now() where id = picked;
  end if;
  return new;
end $$;
drop trigger if exists trg_conversations_assign_ctv on public.conversations;
create trigger trg_conversations_assign_ctv
  before insert on public.conversations
  for each row execute function public.assign_ctv_round_robin();

-- ============ FR-137: báo cáo CTV 17h VN mỗi ngày ============
create table if not exists public.ctv_daily_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  ctv_id uuid references public.ctvs(id),
  body text not null,
  scores jsonb,
  sent_to text,                       -- 'zalo_oa:<admin_id>' | 'none'
  created_at timestamptz not null default now(),
  unique (report_date, ctv_id)
);
alter table public.ctv_daily_reports enable row level security;

-- 17h VN = 10:00 UTC; gọi edge ctv-report qua pg_net với anon key (key công khai)
create or replace function public.ctv_report_tick() returns void
language plpgsql security definer as $$
begin
  perform net.http_post(
    url := 'https://tbcdpupiarkuxtntmosl.supabase.co/functions/v1/ctv-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_zmJBmEgFPn3bBKx_1ve6Pg_dXdo4haX'
    ),
    body := '{}'::jsonb
  );
end $$;
select cron.schedule('ctv-report-tick', '0 10 * * *', 'select public.ctv_report_tick()');
