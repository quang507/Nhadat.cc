-- Ảnh chụp schema `public` + `storage` của project nhadat-cc.
-- SINH TỰ ĐỘNG bởi public.xuat_schema() — ĐỪNG SỬA TAY.
-- Sinh lại: node scripts/sao-luu.mjs (ghi đè file này).
-- Đây là lưới an toàn để dựng lại từ số không, KHÔNG thay cho migration:
-- thay đổi schema vẫn phải đi qua một file trong bot/supabase/migrations/.
-- Sinh lúc: 2026-09-07 09:00 (giờ VN)

-- ══ Extension ══
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema public;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;

-- ══ Kiểu enum ══
do $d$ begin
  create type public.listing_deal as enum ('ban', 'cho_thue');
exception when duplicate_object then null; end $d$;
do $d$ begin
  create type public.msg_sender as enum ('buyer', 'seller', 'bot', 'ctv', 'system', 'human');
exception when duplicate_object then null; end $d$;
do $d$ begin
  create type public.property_type as enum ('nha_pho', 'nha_cap4', 'chung_cu', 'dat', 'biet_thu', 'phong_tro', 'mat_bang', 'chua_ro');
exception when duplicate_object then null; end $d$;
do $d$ begin
  create type public.request_status as enum ('pending', 'answered', 'expired');
exception when duplicate_object then null; end $d$;
do $d$ begin
  create type public.seller_type as enum ('ccrb', 'nmg', 'unknown');
exception when duplicate_object then null; end $d$;
do $d$ begin
  create type public.unit_status as enum ('con_ban', 'giu_cho', 'da_coc', 'da_ban');
exception when duplicate_object then null; end $d$;

-- ══ Sequence ══
create sequence if not exists public.bot_errors_id_seq;
create sequence if not exists public.messages_seq_seq;
create sequence if not exists public.property_events_id_seq;

-- ══ Bảng ══
create table if not exists public.admins (
  email text not null,
  zalo_user_id text,
  zalo_phone text
);

create table if not exists public.app_config (
  key text not null,
  value text not null,
  ghi_chu text
);

create table if not exists public.bot_errors (
  id bigint not null default nextval('bot_errors_id_seq'::regclass),
  at timestamp with time zone not null default now(),
  source text not null,
  status_code integer,
  detail text
);

create table if not exists public.bot_health (
  who text not null,
  at timestamp with time zone not null default now(),
  last_id bigint not null default 0
);

create table if not exists public.bot_prompts (
  key text not null,
  content text not null,
  updated_at timestamp with time zone not null default now()
);

create table if not exists public.bot_usage (
  day date not null default ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date,
  model_calls integer not null default 0,
  capped_at timestamp with time zone,
  in_tokens bigint not null default 0,
  out_tokens bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  cache_read_tokens bigint not null default 0
);

create table if not exists public.buyers (
  id uuid not null default gen_random_uuid(),
  name text,
  phone text,
  zalo_user_id text,
  created_at timestamp with time zone not null default now(),
  preferences jsonb default '{}'::jsonb,
  last_contact_at timestamp with time zone,
  notes text,
  auth_user_id uuid
);

create table if not exists public.chat_quota (
  zalo_user_id text not null,
  gio timestamp with time zone not null,
  calls integer not null default 0
);

create table if not exists public.conversations (
  id uuid not null default gen_random_uuid(),
  buyer_id uuid,
  seller_id uuid,
  ctv_id uuid,
  channel text not null default 'zalo_oa'::text,
  started_at timestamp with time zone not null default now(),
  last_message_at timestamp with time zone,
  needs_human boolean not null default false,
  needs_human_at timestamp with time zone,
  human_touch_at timestamp with time zone,
  human_escalated_at timestamp with time zone
);

create table if not exists public.ctv_daily_reports (
  id uuid not null default gen_random_uuid(),
  report_date date not null,
  ctv_id uuid,
  body text not null,
  scores jsonb,
  sent_to text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.ctvs (
  id uuid not null default gen_random_uuid(),
  name text not null,
  zalo_user_id text,
  phone text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  last_assigned_at timestamp with time zone
);

create table if not exists public.curated_lists (
  id uuid not null default gen_random_uuid(),
  token text not null default encode(extensions.gen_random_bytes(12), 'hex'::text),
  buyer_id uuid,
  listing_ids uuid[] not null,
  title text,
  created_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null default (now() + '30 days'::interval)
);

create table if not exists public.deals (
  id uuid not null default gen_random_uuid(),
  listing_id uuid not null,
  buyer_id uuid,
  price_vnd bigint,
  fee_pct numeric,
  closed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  ctv_id uuid
);

create table if not exists public.inbound_events (
  event_id text not null,
  zalo_user_id text,
  payload jsonb,
  delivery_count integer not null default 1,
  first_seen_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now()
);

create table if not exists public.inbound_ledger (
  zalo_msg_id text not null,
  status text not null default 'received'::text,
  attempts integer not null default 1,
  reply jsonb,
  detail text,
  sent_at timestamp with time zone,
  send_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  next_retry_at timestamp with time zone,
  locked_by text,
  started_at timestamp with time zone,
  finished_at timestamp with time zone,
  sent_bubbles integer not null default 0,
  sending_until timestamp with time zone
);

create table if not exists public.info_requests (
  id uuid not null default gen_random_uuid(),
  listing_id uuid not null,
  buyer_id uuid,
  question text not null,
  status request_status not null default 'pending'::request_status,
  answer text,
  reminded_at timestamp with time zone,
  answered_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  assignee text,
  ctv_id uuid,
  source text not null default 'seller_flow'::text,
  sla_due_at timestamp with time zone,
  sla_missed_at timestamp with time zone
);

create table if not exists public.interests (
  buyer_id uuid not null,
  listing_id uuid not null,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.listing_facts (
  id uuid not null default gen_random_uuid(),
  listing_id uuid not null,
  question text not null,
  answer text not null,
  source text not null default 'seller_zalo'::text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.listing_media (
  id uuid not null default gen_random_uuid(),
  listing_id uuid not null,
  bucket text not null,
  storage_path text not null,
  media_type text not null,
  mime_type text not null,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.listing_views (
  auth_user_id uuid not null,
  listing_id uuid not null,
  viewed_at timestamp with time zone not null default now()
);

create table if not exists public.listings (
  id uuid not null default gen_random_uuid(),
  code text not null,
  legacy_sst integer,
  seller_id uuid,
  deal listing_deal not null default 'ban'::listing_deal,
  district text not null default 'Quận 5'::text,
  ward text,
  location_raw text,
  area_m2 numeric,
  price_vnd bigint,
  price_raw text,
  description text,
  source text not null default 'import_excel'::text,
  source_url text,
  cc_link text,
  status text not null default 'cho_thong_tin'::text,
  last_confirmed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  project_id uuid,
  unit_code text,
  floor integer,
  direction text,
  unit_status unit_status,
  property_type property_type default 'chua_ro'::property_type,
  lat numeric,
  lng numeric,
  bedrooms integer,
  last_interest_at timestamp with time zone,
  property_type_source text not null default 'suy_doan'::text,
  price_source text not null default 'suy_doan'::text,
  ward_source text not null default 'suy_doan'::text,
  street text,
  access_type text,
  alley_width_m numeric,
  distance_to_street_m numeric,
  frontage_m numeric,
  length_m numeric,
  rear_width_m numeric,
  legal_area_m2 numeric,
  built_area_m2 numeric,
  floors integer,
  floors_text text,
  bathrooms integer,
  legal_status text,
  has_completion boolean,
  planning_status text,
  has_elevator boolean,
  car_in_house boolean,
  corner_lot boolean,
  furnishing text,
  year_built integer,
  negotiable boolean,
  rent_income_vnd bigint,
  specs_source text,
  price_per_m2_vnd bigint default 
CASE
    WHEN ((price_vnd IS NOT NULL) AND (area_m2 > (0)::numeric)) THEN (((price_vnd)::numeric / area_m2))::bigint
    ELSE NULL::bigint
END
);

create table if not exists public.media (
  id uuid not null default gen_random_uuid(),
  listing_id uuid not null,
  category text not null default 'photo'::text,
  storage_provider text not null default 'onedrive'::text,
  storage_path text not null,
  approved boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.media_cleanup_queue (
  id uuid not null default gen_random_uuid(),
  bucket text not null,
  storage_path text not null,
  trang_thai text not null default 'cho'::text,
  attempts integer not null default 0,
  last_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  next_retry_at timestamp with time zone
);

create table if not exists public.messages (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  sender msg_sender not null,
  body text not null,
  zalo_msg_id text,
  created_at timestamp with time zone not null default now(),
  seq bigint not null
);

create table if not exists public.projects (
  id uuid not null default gen_random_uuid(),
  name text not null,
  slug text,
  developer text,
  district text,
  ward text,
  location_raw text,
  lat numeric,
  lng numeric,
  legal_status text,
  amenities jsonb,
  floor_plans jsonb,
  handover_date date,
  description text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  province text,
  images jsonb,
  price_min bigint,
  price_max bigint,
  priority integer not null default 100,
  is_partner boolean not null default false,
  source text,
  source_url text,
  status_text text,
  handover text,
  specs jsonb,
  unit_types jsonb
);

create table if not exists public.property_events (
  id bigint not null default nextval('property_events_id_seq'::regclass),
  listing_id uuid not null,
  event_type text not null,
  buyer_id uuid,
  at timestamp with time zone not null default now(),
  meta jsonb
);

create table if not exists public.ratings_log (
  buyer_id uuid not null,
  listing_id uuid not null,
  stars integer not null,
  note text,
  at timestamp with time zone not null default now()
);

create table if not exists public.reminders (
  id uuid not null default gen_random_uuid(),
  kind text not null,
  buyer_id uuid,
  seller_id uuid,
  listing_id uuid,
  due_at timestamp with time zone not null,
  note text,
  status text not null default 'pending'::text,
  created_at timestamp with time zone not null default now(),
  sent_at timestamp with time zone,
  viewing_id uuid,
  ctv_id uuid,
  locked_at timestamp with time zone,
  locked_by text,
  attempts integer not null default 0,
  next_retry_at timestamp with time zone,
  last_error text
);

create table if not exists public.required_facts (
  property_type property_type not null,
  fact_key text not null,
  priority integer not null default 1
);

create table if not exists public.sellers (
  id uuid not null default gen_random_uuid(),
  name text,
  phone text,
  phone_proxy text,
  seller_type seller_type not null default 'unknown'::seller_type,
  zalo_user_id text,
  rating_sum integer not null default 0,
  rating_count integer not null default 0,
  created_at timestamp with time zone not null default now(),
  auth_user_id uuid,
  active_listing_id uuid
);

create table if not exists public.viewings (
  id uuid not null default gen_random_uuid(),
  listing_id uuid,
  buyer_id uuid,
  guide text,
  slot timestamp with time zone,
  status text not null default 'proposed'::text,
  buyer_rating integer,
  note text,
  created_at timestamp with time zone not null default now(),
  time_text text,
  phone text,
  listing_code text,
  source text default 'bot'::text
);

-- ══ Ràng buộc (PK / UNIQUE / CHECK) ══
do $d$ begin
  alter table public.admins add constraint admins_pkey PRIMARY KEY (email);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.app_config add constraint app_config_pkey PRIMARY KEY (key);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.bot_errors add constraint bot_errors_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.bot_health add constraint bot_health_pkey PRIMARY KEY (who);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.bot_prompts add constraint bot_prompts_pkey PRIMARY KEY (key);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.bot_usage add constraint bot_usage_pkey PRIMARY KEY (day);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.buyers add constraint buyers_auth_user_id_key UNIQUE (auth_user_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.buyers add constraint buyers_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.buyers add constraint buyers_zalo_user_id_key UNIQUE (zalo_user_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.chat_quota add constraint chat_quota_pkey PRIMARY KEY (zalo_user_id, gio);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.conversations add constraint conversations_mot_vai_check CHECK (((buyer_id IS NULL) <> (seller_id IS NULL)));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.conversations add constraint conversations_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.ctv_daily_reports add constraint ctv_daily_reports_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.ctv_daily_reports add constraint ctv_daily_reports_report_date_ctv_id_key UNIQUE (report_date, ctv_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.ctvs add constraint ctvs_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.ctvs add constraint ctvs_zalo_user_id_key UNIQUE (zalo_user_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.curated_lists add constraint curated_lists_listing_ids_check CHECK (((cardinality(listing_ids) >= 1) AND (cardinality(listing_ids) <= 60)));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.curated_lists add constraint curated_lists_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.curated_lists add constraint curated_lists_token_key UNIQUE (token);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.deals add constraint deals_listing_buyer_key UNIQUE NULLS NOT DISTINCT (listing_id, buyer_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.deals add constraint deals_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.inbound_events add constraint inbound_events_pkey PRIMARY KEY (event_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.inbound_ledger add constraint inbound_ledger_pkey PRIMARY KEY (zalo_msg_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.inbound_ledger add constraint inbound_ledger_status_check CHECK ((status = ANY (ARRAY['received'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'dead'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.info_requests add constraint info_requests_assignee_check CHECK ((assignee = ANY (ARRAY['seller'::text, 'ctv'::text, 'admin'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.info_requests add constraint info_requests_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.interests add constraint interests_pkey PRIMARY KEY (buyer_id, listing_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_facts add constraint listing_facts_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_media add constraint listing_media_bia_phai_cong_khai CHECK (((NOT is_cover) OR (bucket = 'listing-public'::text)));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_media add constraint listing_media_bucket_check CHECK ((bucket = ANY (ARRAY['listing-public'::text, 'listing-private'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_media add constraint listing_media_duong_dan_sach CHECK ((storage_path !~ '(^/)|(\.\.)|(//)'::text));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_media add constraint listing_media_duong_dan_theo_uuid CHECK ((storage_path ~~ ((listing_id)::text || '/%'::text)));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_media add constraint listing_media_giay_to_phai_rieng CHECK (((media_type <> ALL (ARRAY['so_do'::text, 'giay_to'::text])) OR (bucket = 'listing-private'::text)));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_media add constraint listing_media_media_type_check CHECK ((media_type = ANY (ARRAY['mat_tien'::text, 'trong_nha'::text, 'hem'::text, 'so_do'::text, 'giay_to'::text, 'khac'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_media add constraint listing_media_path_key UNIQUE (bucket, storage_path);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_media add constraint listing_media_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_views add constraint listing_views_pkey PRIMARY KEY (auth_user_id, listing_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_access_type_check CHECK ((access_type = ANY (ARRAY['mat_tien'::text, 'hem_xe_tai'::text, 'hem_xe_hoi'::text, 'hem_xe_may'::text, 'hem'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_bedrooms_check CHECK (((bedrooms >= 1) AND (bedrooms <= 20)));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_code_key UNIQUE (code);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_furnishing_check CHECK ((furnishing = ANY (ARRAY['full'::text, 'co_ban'::text, 'khong'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_legal_status_check CHECK ((legal_status = ANY (ARRAY['so_hong_rieng'::text, 'so_hong_chung'::text, 'so_hong'::text, 'hdmb'::text, 'giay_tay'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_price_source_check CHECK ((price_source = ANY (ARRAY['suy_doan'::text, 'chu_xac_nhan'::text, 'admin'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_property_type_source_check CHECK ((property_type_source = ANY (ARRAY['suy_doan'::text, 'chu_xac_nhan'::text, 'admin'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_specs_source_check CHECK (((specs_source IS NULL) OR (specs_source = ANY (ARRAY['boc_mo_ta'::text, 'admin'::text, 'chu_xac_nhan'::text]))));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_status_check CHECK ((status = ANY (ARRAY['cho_thong_tin'::text, 'dang_ban'::text, 'dang_quan_tam'::text, 'da_chot'::text, 'an'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_ward_source_check CHECK ((ward_source = ANY (ARRAY['suy_doan'::text, 'chu_xac_nhan'::text, 'admin'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.media add constraint media_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.media_cleanup_queue add constraint media_cleanup_queue_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.media_cleanup_queue add constraint media_cleanup_queue_trang_thai_check CHECK ((trang_thai = ANY (ARRAY['cho'::text, 'dang_lam'::text, 'xong'::text, 'loi'::text, 'chet'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.messages add constraint messages_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.messages add constraint messages_seq_key UNIQUE (seq);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.messages add constraint messages_zalo_msg_id_key UNIQUE (zalo_msg_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.projects add constraint projects_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.projects add constraint projects_slug_key UNIQUE (slug);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.property_events add constraint property_events_event_type_check CHECK ((event_type = ANY (ARRAY['view'::text, 'asked'::text, 'interest'::text, 'photos'::text, 'viewing'::text, 'deal'::text, 'match_sent'::text, 'status'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.property_events add constraint property_events_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.ratings_log add constraint ratings_log_pkey PRIMARY KEY (buyer_id, listing_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.ratings_log add constraint ratings_log_stars_check CHECK (((stars >= 1) AND (stars <= 5)));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.reminders add constraint reminders_kind_check CHECK ((kind = ANY (ARRAY['promise'::text, 'reengage'::text, 'viewing'::text, 'followup'::text, 'escalation'::text, 'report'::text, 'match'::text, 'feedback'::text, 'sold'::text, 'rating'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.reminders add constraint reminders_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.reminders add constraint reminders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'cancelled'::text, 'dead'::text])));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.required_facts add constraint required_facts_pkey PRIMARY KEY (property_type, fact_key);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.sellers add constraint sellers_auth_user_id_key UNIQUE (auth_user_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.sellers add constraint sellers_phone_key UNIQUE (phone);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.sellers add constraint sellers_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.sellers add constraint sellers_zalo_user_id_key UNIQUE (zalo_user_id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.viewings add constraint viewings_buyer_rating_check CHECK (((buyer_rating >= 1) AND (buyer_rating <= 5)));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.viewings add constraint viewings_can_neo_check CHECK (((listing_id IS NOT NULL) OR (listing_code IS NOT NULL)));
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.viewings add constraint viewings_pkey PRIMARY KEY (id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.viewings add constraint viewings_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'pending'::text, 'confirmed'::text, 'done'::text, 'cancelled'::text])));
exception when duplicate_object then null; end $d$;

-- ══ Khoá ngoại ══
do $d$ begin
  alter table public.buyers add constraint buyers_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.conversations add constraint conversations_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES buyers(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.conversations add constraint conversations_ctv_id_fkey FOREIGN KEY (ctv_id) REFERENCES ctvs(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.conversations add constraint conversations_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES sellers(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.ctv_daily_reports add constraint ctv_daily_reports_ctv_id_fkey FOREIGN KEY (ctv_id) REFERENCES ctvs(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.curated_lists add constraint curated_lists_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE SET NULL;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.deals add constraint deals_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES buyers(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.deals add constraint deals_ctv_id_fkey FOREIGN KEY (ctv_id) REFERENCES ctvs(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.deals add constraint deals_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.info_requests add constraint info_requests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES buyers(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.info_requests add constraint info_requests_ctv_id_fkey FOREIGN KEY (ctv_id) REFERENCES ctvs(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.info_requests add constraint info_requests_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.interests add constraint interests_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.interests add constraint interests_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_facts add constraint listing_facts_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_media add constraint listing_media_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_views add constraint listing_views_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listing_views add constraint listing_views_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.listings add constraint listings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES sellers(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.media add constraint media_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.messages add constraint messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.property_events add constraint property_events_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE SET NULL;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.property_events add constraint property_events_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.ratings_log add constraint ratings_log_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.ratings_log add constraint ratings_log_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.reminders add constraint reminders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.reminders add constraint reminders_ctv_id_fkey FOREIGN KEY (ctv_id) REFERENCES ctvs(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.reminders add constraint reminders_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.reminders add constraint reminders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.reminders add constraint reminders_viewing_id_fkey FOREIGN KEY (viewing_id) REFERENCES viewings(id) ON DELETE CASCADE;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.sellers add constraint sellers_active_listing_id_fkey FOREIGN KEY (active_listing_id) REFERENCES listings(id) ON DELETE SET NULL;
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.sellers add constraint sellers_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.viewings add constraint viewings_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES buyers(id);
exception when duplicate_object then null; end $d$;
do $d$ begin
  alter table public.viewings add constraint viewings_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES listings(id);
exception when duplicate_object then null; end $d$;

-- ══ Index ══
create index if not exists bot_errors_at_idx ON public.bot_errors USING btree (at DESC);
create index if not exists bot_errors_source_at_idx ON public.bot_errors USING btree (source, at DESC);
create index if not exists chat_quota_gio_idx ON public.chat_quota USING btree (gio);
create index if not exists conversations_buyer_id_idx ON public.conversations USING btree (buyer_id);
CREATE UNIQUE INDEX conversations_buyer_uniq ON public.conversations USING btree (buyer_id) WHERE (buyer_id IS NOT NULL);
create index if not exists conversations_ctv_id_idx ON public.conversations USING btree (ctv_id);
CREATE UNIQUE INDEX conversations_seller_uniq ON public.conversations USING btree (seller_id) WHERE (seller_id IS NOT NULL);
create index if not exists ctv_daily_reports_ctv_id_idx ON public.ctv_daily_reports USING btree (ctv_id);
create index if not exists curated_lists_buyer_idx ON public.curated_lists USING btree (buyer_id);
create index if not exists deals_buyer_id_idx ON public.deals USING btree (buyer_id);
create index if not exists deals_ctv_id_idx ON public.deals USING btree (ctv_id);
create index if not exists deals_listing_id_idx ON public.deals USING btree (listing_id);
create index if not exists idx_conversations_seller ON public.conversations USING btree (seller_id, started_at DESC);
create index if not exists idx_listings_price_vnd ON public.listings USING btree (deal, price_vnd);
create index if not exists inbound_events_first_seen_idx ON public.inbound_events USING btree (first_seen_at);
create index if not exists inbound_ledger_can_cuu_idx ON public.inbound_ledger USING btree (next_retry_at, created_at) WHERE (status = ANY (ARRAY['received'::text, 'processing'::text, 'failed'::text]));
create index if not exists info_requests_buyer_id_idx ON public.info_requests USING btree (buyer_id);
create index if not exists info_requests_ctv_id_idx ON public.info_requests USING btree (ctv_id);
create index if not exists info_requests_listing_id_idx ON public.info_requests USING btree (listing_id);
CREATE UNIQUE INDEX info_requests_mot_cau_cho_idx ON public.info_requests USING btree (listing_id, question) WHERE (status = 'pending'::request_status);
create index if not exists info_requests_sla_idx ON public.info_requests USING btree (sla_due_at) WHERE ((status = 'pending'::request_status) AND (sla_missed_at IS NULL));
create index if not exists interests_listing_id_idx ON public.interests USING btree (listing_id);
create index if not exists listing_facts_listing_id_idx ON public.listing_facts USING btree (listing_id);
CREATE UNIQUE INDEX listing_media_mot_bia_idx ON public.listing_media USING btree (listing_id) WHERE is_cover;
create index if not exists listing_media_tin_thu_tu_idx ON public.listing_media USING btree (listing_id, sort_order, created_at, id);
create index if not exists listing_views_listing_id_idx ON public.listing_views USING btree (listing_id);
create index if not exists listings_access_idx ON public.listings USING btree (deal, status, access_type);
create index if not exists listings_district_status_idx ON public.listings USING btree (district, status);
create index if not exists listings_floors_idx ON public.listings USING btree (deal, status, floors);
create index if not exists listings_project_idx ON public.listings USING btree (project_id) WHERE (project_id IS NOT NULL);
CREATE UNIQUE INDEX listings_project_unit_uniq ON public.listings USING btree (project_id, unit_code) WHERE ((project_id IS NOT NULL) AND (unit_code IS NOT NULL));
create index if not exists listings_seller_id_idx ON public.listings USING btree (seller_id);
create index if not exists media_cleanup_can_lam_idx ON public.media_cleanup_queue USING btree (trang_thai, created_at) WHERE (trang_thai = ANY (ARRAY['cho'::text, 'dang_lam'::text]));
create index if not exists media_listing_id_idx ON public.media USING btree (listing_id);
create index if not exists messages_conv_seq_idx ON public.messages USING btree (conversation_id, seq DESC);
create index if not exists messages_conv_time_idx ON public.messages USING btree (conversation_id, created_at);
create index if not exists projects_priority_idx ON public.projects USING btree (priority, district);
create index if not exists property_events_at_idx ON public.property_events USING btree (at DESC);
create index if not exists property_events_buyer_idx ON public.property_events USING btree (buyer_id);
create index if not exists property_events_listing_at_idx ON public.property_events USING btree (listing_id, at DESC);
create index if not exists ratings_log_listing_idx ON public.ratings_log USING btree (listing_id);
create index if not exists reminders_buyer_id_idx ON public.reminders USING btree (buyer_id);
create index if not exists reminders_ctv_id_idx ON public.reminders USING btree (ctv_id);
create index if not exists reminders_den_han_idx ON public.reminders USING btree (due_at) WHERE (status = 'pending'::text);
create index if not exists reminders_due_idx ON public.reminders USING btree (status, due_at);
create index if not exists reminders_listing_id_idx ON public.reminders USING btree (listing_id);
CREATE UNIQUE INDEX reminders_mot_feedback_moi_buoi_idx ON public.reminders USING btree (viewing_id) WHERE ((kind = 'feedback'::text) AND (viewing_id IS NOT NULL));
CREATE UNIQUE INDEX reminders_mot_match_moi_tin_idx ON public.reminders USING btree (buyer_id, listing_id) WHERE (kind = 'match'::text);
CREATE UNIQUE INDEX reminders_mot_nhac_moi_buoi_xem_idx ON public.reminders USING btree (viewing_id) WHERE ((kind = 'viewing'::text) AND (status = 'pending'::text) AND (viewing_id IS NOT NULL));
CREATE UNIQUE INDEX reminders_mot_reengage_cho_idx ON public.reminders USING btree (buyer_id) WHERE ((kind = 'reengage'::text) AND (status = 'pending'::text));
CREATE UNIQUE INDEX reminders_mot_sold_moi_tin_idx ON public.reminders USING btree (buyer_id, listing_id) WHERE (kind = 'sold'::text);
create index if not exists reminders_seller_id_idx ON public.reminders USING btree (seller_id);
create index if not exists reminders_viewing_id_idx ON public.reminders USING btree (viewing_id);
create index if not exists sellers_active_listing_idx ON public.sellers USING btree (active_listing_id) WHERE (active_listing_id IS NOT NULL);
create index if not exists viewings_buyer_id_idx ON public.viewings USING btree (buyer_id);
create index if not exists viewings_listing_id_idx ON public.viewings USING btree (listing_id);
CREATE UNIQUE INDEX viewings_mot_hen_cho_moi_can_idx ON public.viewings USING btree (buyer_id, COALESCE(listing_code, (listing_id)::text)) WHERE (status = 'pending'::text);
create index if not exists viewings_status_slot_idx ON public.viewings USING btree (status, slot);

-- ══ Hàm ══
CREATE OR REPLACE FUNCTION public.admin_dang_tin(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email  text := (select auth.jwt() ->> 'email');
  v_seller uuid;
  v_zalo   text;
  v_phone  text;
  v_code   text;
  v_id     uuid;
  v_price  bigint;
begin
  if v_email is null or not exists (select 1 from admins a where a.email = v_email) then
    raise exception 'Khong co quyen quan tri' using errcode = '42501';
  end if;

  v_seller := nullif(p->>'seller_id', '')::uuid;

  if v_seller is null and coalesce(btrim(p->>'seller_name'), '') <> '' then
    v_zalo  := nullif(btrim(p->>'seller_zalo'), '');
    v_phone := nullif(btrim(p->>'seller_phone'), '');

    if v_zalo is not null then
      select id into v_seller from sellers where zalo_user_id = v_zalo;
    end if;
    if v_seller is null and v_phone is not null then
      select id into v_seller from sellers where phone = v_phone;
    end if;

    if v_seller is null then
      insert into sellers (name, seller_type, phone, zalo_user_id)
      values (
        btrim(p->>'seller_name'),
        coalesce(nullif(p->>'seller_type', ''), 'ccrb')::seller_type,
        v_phone,
        v_zalo
      )
      returning id into v_seller;
    end if;
  end if;

  insert into listings (
    code, seller_id, deal, district, ward, ward_source, location_raw,
    area_m2, price_raw, price_source, bedrooms,
    property_type, property_type_source, description, source, status
  ) values (
    null,
    v_seller,
    coalesce(nullif(p->>'deal', ''), 'ban')::listing_deal,
    coalesce(nullif(btrim(p->>'district'), ''), 'Quận 5'),
    nullif(btrim(p->>'ward'), ''),
    case when nullif(btrim(p->>'ward'), '') is not null then 'admin' else 'suy_doan' end,
    nullif(btrim(p->>'location_raw'), ''),
    nullif(p->>'area_m2', '')::numeric,
    nullif(btrim(p->>'price_raw'), ''),
    case when nullif(btrim(p->>'price_raw'), '') is not null then 'admin' else 'suy_doan' end,
    nullif(p->>'bedrooms', '')::int,
    coalesce(nullif(p->>'property_type', ''), 'chua_ro')::property_type,
    case when nullif(p->>'property_type', '') is not null then 'admin' else 'suy_doan' end,
    nullif(btrim(p->>'description'), ''),
    coalesce(nullif(btrim(p->>'source'), ''), 'admin'),
    coalesce(nullif(p->>'status', ''), 'cho_thong_tin')
  )
  returning id, code, price_vnd into v_id, v_code, v_price;

  return jsonb_build_object(
    'id', v_id, 'code', v_code, 'price_vnd', v_price, 'seller_id', v_seller
  );
end
$function$
;

CREATE OR REPLACE FUNCTION public.ap_thong_so(p_listing_id uuid, j jsonb, p_bac text, p_de boolean)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k text; typ text; n int := 0; r int; v_deal text;
begin
  if p_listing_id is null or j is null or j = '{}'::jsonb then return 0; end if;
  select deal into v_deal from listings where id = p_listing_id;
  for k in select jsonb_object_keys(j) loop
    typ := case k
      when 'frontage_m' then 'numeric' when 'length_m' then 'numeric' when 'rear_width_m' then 'numeric'
      when 'legal_area_m2' then 'numeric' when 'built_area_m2' then 'numeric'
      when 'alley_width_m' then 'numeric' when 'distance_to_street_m' then 'numeric'
      when 'floors' then 'int' when 'floor' then 'int' when 'bedrooms' then 'int'
      when 'bathrooms' then 'int' when 'year_built' then 'int'
      when 'has_completion' then 'boolean' when 'has_elevator' then 'boolean'
      when 'car_in_house' then 'boolean' when 'corner_lot' then 'boolean' when 'negotiable' then 'boolean'
      when 'access_type' then 'text' when 'legal_status' then 'text' when 'planning_status' then 'text'
      when 'furnishing' then 'text' when 'direction' then 'text'
      when 'rent_income_vnd' then 'bigint'
      else null end;
    if typ is null then continue; end if;
    if k = 'rent_income_vnd' and coalesce(v_deal, '') <> 'ban' then continue; end if;
    if k = 'floors' then
      update listings set floors = (j->>'floors')::int, floors_text = j->>'floors_text', specs_source = p_bac
       where id = p_listing_id and (floors is null or p_de);
    else
      execute format('update listings set %I = ($1)::%s, specs_source = $2 where id = $3 and (%I is null or $4)', k, typ, k)
        using j->>k, p_bac, p_listing_id, p_de;
    end if;
    get diagnostics r = row_count;
    n := n + r;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.ask_seller_drip(p_listing_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select net.http_post(
    url := public.cau_hinh('functions_base_url') || '/ask-seller',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.cau_hinh('publishable_key'),
      'x-bridge-secret', public.get_secret('BRIDGE_SECRET')),
    body := jsonb_build_object('listing_id', p_listing_id, 'mode', 'drip'),
    timeout_milliseconds := 60000
  );
$function$
;

CREATE OR REPLACE FUNCTION public.assign_ctv_round_robin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.bac_nguon(p_source text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case p_source
    when 'chu_xac_nhan' then 3
    when 'admin'        then 2
    when 'ctv'          then 2
    else 1
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.bao_can_da_chot(p_listing_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; v_code text; v_note text; v_thay text; n int := 0;
begin
  select code into v_code from listings where id = p_listing_id;
  for r in
    select i.buyer_id
      from interests i
      join buyers b on b.id = i.buyer_id
     where i.listing_id = p_listing_id
       and b.zalo_user_id is not null
       and not exists (select 1 from deals d where d.listing_id = p_listing_id and d.buyer_id = i.buyer_id)
       and not exists (select 1 from reminders x
                        where x.buyer_id = i.buyer_id and x.kind = 'sold'
                          and x.status in ('pending', 'sent')
                          and x.created_at > now() - interval '24 hours')
     limit 50
  loop
    select string_agg(c.tom_tat, '; ') into v_thay
      from public.can_cung_khu(r.buyer_id, p_listing_id, 2) c;
    v_note := '#' || coalesce(v_code, '?') || ' đã chốt'
           || coalesce(' · thay thế: ' || v_thay, '');
    insert into reminders (kind, buyer_id, listing_id, due_at, note)
    values ('sold', r.buyer_id, p_listing_id, now(), v_note)
    on conflict (buyer_id, listing_id) where kind = 'sold' do nothing;
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.bao_hong_inbound(p_msg_id text, p_detail text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_attempts int; v_status text; v_max constant int := 8;
begin
  select attempts, status into v_attempts, v_status
    from inbound_ledger where zalo_msg_id = p_msg_id;
  if v_attempts is null then return 'khong_co'; end if;
  if v_status = 'completed' then return 'da_completed'; end if;
  if v_attempts >= v_max then
    update inbound_ledger set status='dead', detail=left(p_detail,500),
           finished_at=now(), updated_at=now() where zalo_msg_id = p_msg_id;
    return 'dead';
  end if;
  update inbound_ledger set status='failed', detail=left(p_detail,500),
         next_retry_at = now() + public.lan_thu_ke(v_attempts), updated_at=now()
   where zalo_msg_id = p_msg_id;
  return 'failed';
end $function$
;

CREATE OR REPLACE FUNCTION public.bao_hong_nhac(p_id uuid, p_detail text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_attempts int; v_max constant int := 5;
begin
  select attempts into v_attempts from reminders where id = p_id;
  if v_attempts is null then return 'khong_co'; end if;
  if v_attempts >= v_max then
    update reminders set status='dead', last_error=left(p_detail,300), locked_at=null
     where id = p_id;
    return 'dead';
  end if;
  update reminders set locked_at=null, last_error=left(p_detail,300),
         next_retry_at = now() + public.lan_thu_ke(v_attempts) where id = p_id;
  return 'retry';
end $function$
;

CREATE OR REPLACE FUNCTION public.bao_tin_moi_khop(p_listing_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l          record;
  v_deal     text;
  v_ward_no  text;
  v_ward_kd  text;
  v_dist_kd  text;
  v_dist_re  text;
  v_note     text;
  v_n        integer := 0;
begin
  select id, code, deal::text as deal, district, ward, price_vnd, price_raw,
         area_m2, access_type, alley_width_m
    into l
    from listings where id = p_listing_id;
  if l.id is null or l.price_vnd is null or l.ward is null or btrim(l.ward) = '' then
    return 0;
  end if;

  v_deal    := coalesce(l.deal, 'ban');
  v_ward_kd := btrim(regexp_replace(public.bo_dau(l.ward), '^phuong\s*', ''));
  v_ward_no := (regexp_match(v_ward_kd, '^([0-9]{1,2})$'))[1];
  v_dist_kd := btrim(public.bo_dau(coalesce(l.district, '')));
  -- "quan 5" → khớp "quan 5" / "q5" / "q.5" (không dính "quan 50", "q15")
  v_dist_re := case
    when v_dist_kd ~ '^(quan|q)\s*\.?\s*[0-9]{1,2}$'
      then '(quan|q)\s*\.?\s*' || (regexp_match(v_dist_kd, '([0-9]{1,2})$'))[1] || '\M'
    when v_dist_kd <> '' then '\m' || v_dist_kd || '\M'
    else null end;

  v_note := '#' || l.code
         || ' · ' || l.ward || coalesce(', ' || l.district, '')
         || coalesce(' · ' || l.price_raw, '')
         || coalesce(' · ' || rtrim(to_char(l.area_m2, 'FM9999999990.99'), '.') || 'm2', '')
         || coalesce(' · ' || case l.access_type
              when 'mat_tien'   then 'mặt tiền'
              when 'hem_xe_tai' then 'hẻm xe tải'
              when 'hem_xe_hoi' then 'hẻm xe hơi'
              when 'hem_xe_may' then 'hẻm xe máy'
              when 'hem'        then 'trong hẻm' end
            || coalesce(' ' || rtrim(to_char(l.alley_width_m, 'FM9999990.99'), '.') || 'm', ''), '');

  insert into reminders (kind, buyer_id, listing_id, due_at, note)
  select 'match', b.id, l.id, now(), v_note
    from (
      select b.id, b.last_contact_at,
             public.bo_dau(coalesce(b.preferences->>'area', '')) as area_kd,
             coalesce(b.preferences->>'deal', 'ban')             as deal,
             public.parse_vnd(b.preferences->>'budget')          as budget
        from buyers b
       where b.zalo_user_id is not null
         and b.last_contact_at >= now() - interval '30 days'
         and b.preferences is not null
    ) b
   where -- giao dịch
         (case when b.deal in ('thue', 'cho_thue') then 'cho_thue' else 'ban' end) = v_deal
     -- ngân sách trong dải
     and b.budget is not null
     and b.budget between (l.price_vnd * 0.7)::bigint and (l.price_vnd * 1.15)::bigint
     -- khu vực
     and b.area_kd <> ''
     and (
       case
         -- khách NÊU số phường → phải đúng phường của tin
         when b.area_kd ~ '(phuong\s*\.?\s*[0-9]{1,2}|(^|[^a-z0-9])p\.?\s*[0-9]{1,2}(?![0-9]))' then
              v_ward_no is not null
              and b.area_kd ~ ('(phuong\s*\.?\s*' || v_ward_no || '(?![0-9])|(^|[^a-z0-9])p\.?\s*' || v_ward_no || '(?![0-9]))')
         -- không nêu phường: tên phường chữ, hoặc quận/huyện
         else (v_ward_no is null and v_ward_kd <> '' and b.area_kd ~ ('\m' || v_ward_kd || '\M'))
              or (v_dist_re is not null and b.area_kd ~ v_dist_re)
       end
     )
     -- van 24 giờ: một khách một tin chủ động loại này mỗi ngày
     and not exists (select 1 from reminders r
                      where r.buyer_id = b.id and r.kind = 'match'
                        and r.status in ('pending', 'sent')
                        and r.created_at > now() - interval '24 hours')
   order by b.last_contact_at desc
   limit 50
  on conflict (buyer_id, listing_id) where kind = 'match' do nothing;

  get diagnostics v_n = row_count;
  return v_n;
end $function$
;

CREATE OR REPLACE FUNCTION public.bat_het_tien_api()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_lan_cuoi timestamptz;
  v_noi_dung text;
begin
  if new.source = 'HET TIEN API' then
    return null;
  end if;

  if not (
       lower(coalesce(new.detail,'')) like '%credit balance%'
    or lower(coalesce(new.detail,'')) like '%plans & billing%'
    or lower(coalesce(new.detail,'')) like '%plans and billing%'
    or lower(coalesce(new.detail,'')) like '%insufficient%quota%'
    or lower(coalesce(new.detail,'')) like '%billing%'
    or coalesce(new.status_code, 0) = 402
  ) then
    return null;
  end if;

  select max(at) into v_lan_cuoi
    from bot_errors where source = 'HET TIEN API';

  if v_lan_cuoi is not null and v_lan_cuoi > now() - interval '6 hours' then
    return null;
  end if;

  v_noi_dung :=
    '🔴 BỘ NÃO ĐANG CÂM — HẾT TIỀN TÀI KHOẢN AI. Mọi tin khách nhắn vào sẽ KHÔNG '
    || 'có câu trả lời cho tới khi nạp tiền. Vào console.anthropic.com → Plans & '
    || 'Billing để nạp, rồi xem mục Usage để biết khoá nào tiêu hết. '
    || 'Nguồn báo: ' || coalesce(new.source,'?')
    || ' · nguyên văn: ' || left(coalesce(new.detail,''), 200);

  insert into bot_errors (source, status_code, detail)
  values ('HET TIEN API', new.status_code, left(v_noi_dung, 500));

  return null;
exception when others then
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.beat(p_who text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into bot_health (who, at) values (p_who, now())
  on conflict (who) do update set at = now();
$function$
;

CREATE OR REPLACE FUNCTION public.bo_dau(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select translate(lower(t),
    'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd')
$function$
;

CREATE OR REPLACE FUNCTION public.bo_dem_nhac_treo(p_gio integer DEFAULT 24)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_so int;
begin
  select count(*) into v_so
    from reminders
   where status = 'pending'
     and kind in ('escalation', 'report')
     and created_at < now() - make_interval(hours => p_gio);

  if v_so > 0 then
    perform public.log_loi(
      'nhac treo qua lau',
      format('%s lời nhắc escalation/report nằm chờ quá %s giờ — bridge (escalation-feed) '
             || 'nhiều khả năng không chạy hoặc sai BRIDGE_SECRET. Chúng KHÔNG tự vào thư '
             || 'chết: nudge nhả lại mỗi nhịp nên đếm lượt luôn về 0 và không có lỗi nào '
             || 'khác lộ ra. Xem /admin.', v_so, p_gio),
      null::int
    );
  end if;
  return v_so;
end $function$
;

CREATE OR REPLACE FUNCTION public.boc_ten_duong(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select nullif(btrim(regexp_replace(regexp_replace(seg,
           '^(?:hẻm|hem|hxh)\s*[\d/]+\s*', '', 'i'),
           '^(?:đường|duong|phố|pho|đ\.|đ )\s*', '', 'i')), '')
  from (
    select s as seg
    from unnest(string_to_array(coalesce(p, ''), ',')) with ordinality as t(s, i)
    where btrim(s) !~* '^(?:số|so)?\s*\d+[a-z]?(?:/\d+[a-z]?)*$'
      and btrim(s) !~* '^(?:hẻm|hem|hxh)\s*[\d/]+\s*$'
      and btrim(s) !~* '^(?:dự án|du an|chung cư|cc |toà|tòa|toa|khu|kdc|cư xá|cu xa)'
      and btrim(s) !~* '^(?:phường|phuong|p\.|p\d|quận|quan|q\.|q\d|tp|thành phố|hồ chí minh|ho chi minh|việt nam)'
      and btrim(s) <> ''
    order by i limit 1
  ) x
$function$
;

CREATE OR REPLACE FUNCTION public.boc_thong_so(p_text text, p_type text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  k text;
  k_ngang text;
  m text[];
  j jsonb := '{}'::jsonb;
  n_lau int; co_tret bool; co_lung bool; co_st bool; co_ham bool; co_apmai bool;
  parts text[];
  chung_cu bool := coalesce(p_type = 'chung_cu', false);
begin
  if p_text is null or btrim(p_text) = '' then return j; end if;
  k := public.bo_dau(p_text);
  k := regexp_replace(k, '(\d),(\d)', '\1.\2', 'g');
  k := regexp_replace(k, '\s+', ' ', 'g');
  k := replace(k, 'm²', 'm2');
  k := regexp_replace(k, '(\d)\s*m ?2\M', '\1m2', 'g');
  k := replace(k, 'm2', 'mv');
  k := regexp_replace(k, '(\d)m(\d)', '\1.\2', 'g');
  k := replace(k, 'mv', 'm2');
  k := regexp_replace(k, '(\d)\s*\*\s*(\d)', '\1 x \2', 'g');
  k := replace(k, 'hem hong', 'hemhong');
  k := regexp_replace(k, '\m2 ?mt\M', '2 mat tien', 'g');
  k_ngang := regexp_replace(k, '(cach|ra|toi|den|gan|sat|buoc ra|ke)\s*(mat tien|\mmt\M)\s*(?:chi|khoang|tam|hon|gan|duong)?[^,;.]{0,25}?\d+(?:\.\d+)?\s*m\M', ' ', 'g');

  m := regexp_match(k, '(\d+(?:\.\d+)?)\s*m?\s*x\s*(\d+(?:\.\d+)?)\s*m?');
  if m is not null and m[1]::numeric between 1.5 and 40 and m[2]::numeric between 3 and 150 then
    j := j || jsonb_build_object('frontage_m', m[1]::numeric, 'length_m', m[2]::numeric);
  end if;
  if j->>'frontage_m' is null then
    m := regexp_match(k_ngang, '(?:ngang|mat tien|chieu ngang|be ngang)\s*(?:hon|gan|:)?\s*(\d+(?:\.\d+)?)\s*m?\M');
    if m is not null and m[1]::numeric between 1.5 and 40 then j := j || jsonb_build_object('frontage_m', m[1]::numeric); end if;
  end if;
  if j->>'length_m' is null then
    m := regexp_match(k, '(?:dai|chieu dai|chieu sau)\s*(?:hon|gan|:)?\s*(\d+(?:\.\d+)?)\s*m?\M');
    if m is not null and m[1]::numeric between 3 and 150 then j := j || jsonb_build_object('length_m', m[1]::numeric); end if;
  end if;
  if j->>'frontage_m' is null and j->>'length_m' is not null then
    m := regexp_match(k, '(\d+(?:\.\d+)?)\s*m?\s*,?\s*(?:dai|chieu dai)\s*(?:hon|gan|:)?\s*\d');
    if m is not null and m[1]::numeric between 1.5 and 40 then j := j || jsonb_build_object('frontage_m', m[1]::numeric); end if;
  end if;
  m := regexp_match(k, 'no hau\s*(?:hon|gan|:)?\s*(\d+(?:\.\d+)?)');
  if m is not null and m[1]::numeric between 1.5 and 40 then j := j || jsonb_build_object('rear_width_m', m[1]::numeric); end if;

  m := regexp_match(k, '(?:cong nhan|dtcn|dt cn|so|so hong)\s*(?:thuc te|du)?\s*:?\s*(\d+(?:\.\d+)?)\s*m2');
  if m is not null and m[1]::numeric between 5 and 5000 then j := j || jsonb_build_object('legal_area_m2', m[1]::numeric); end if;
  m := regexp_match(k, '(?:dtxd|dt xd|dien tich xay dung|dt xay dung|dien tich san|dt san|dtsd|dt sd|dien tich su dung|dt su dung|tong dien tich san)\s*:?\s*(\d+(?:\.\d+)?)\s*m(?:2|\M)');
  if m is not null and m[1]::numeric between 5 and 20000 then j := j || jsonb_build_object('built_area_m2', m[1]::numeric); end if;

  if not chung_cu then
    co_tret  := k ~ '\mtret\M';
    co_lung  := k ~ '\mlung\M';
    co_st    := k ~ '(san thuong|\mst\M|mai tum)';
    co_ham   := k ~ '\mham\M';
    co_apmai := k ~ 'ap mai';
    n_lau := null;
    m := regexp_match(k, '(?:tong )?so tang\s*:?\s*(\d+)');
    if m is not null and m[1]::int between 1 and 30 then j := j || jsonb_build_object('floors', m[1]::int); end if;
    if j->>'floors' is null
       and k !~ '(duoc xay|xay duoc|cho xay|co the xay|xay len|xay them|nang len|len duoc|len toi)\s*(?:len|toi|den|them|toi da)?\s*\d+\s*tam'
       and k !~ '(cap 4|nha c4|\mc4\M)' then
      m := regexp_match(k, '(\d+)\s*tam(\s*ruoi)?\M');
      if m is not null and m[1]::int between 1 and 30 then
        j := j || jsonb_build_object('floors', m[1]::int);
        if m[2] is not null then co_lung := true; end if;
      end if;
    end if;
    m := regexp_match(k, '(\d+)\s*lau\M');
    if m is not null and m[1]::int between 1 and 30 and j->>'floors' is null then n_lau := m[1]::int; end if;
    if n_lau is null then
      m := regexp_match(k, '(\d+)\s*(?:tang|t)\M');
      if m is not null and m[1]::int between 1 and 30 and j->>'floors' is null then
        j := j || jsonb_build_object('floors', m[1]::int);
      end if;
      if j->>'floors' is null and (k ~ '\mlau\M' or co_tret) then
        j := j || jsonb_build_object('floors', case when k ~ '\mlau\M' then 2 else 1 end);
      end if;
      if j->>'floors' is null and k ~ '(cap 4|nha c4|\mc4\M)' then j := j || jsonb_build_object('floors', 1); end if;
    else
      j := j || jsonb_build_object('floors', n_lau + 1);
    end if;
    if j->>'floors' is not null then
      parts := array[]::text[];
      if co_ham then parts := array_append(parts, 'hầm'); end if;
      parts := array_append(parts, 'trệt');
      if co_lung then parts := array_append(parts, 'lửng'); end if;
      if n_lau is not null then parts := array_append(parts, n_lau || ' lầu');
      elsif (j->>'floors')::int > 1 then parts := array_append(parts, ((j->>'floors')::int - 1) || ' lầu'); end if;
      if co_apmai then parts := array_append(parts, 'áp mái'); end if;
      if co_st then parts := array_append(parts, 'sân thượng'); end if;
      j := j || jsonb_build_object('floors_text', array_to_string(parts, ' + '));
    end if;
  else
    m := regexp_match(k, '(?:tang|lau)\s*(\d{1,2})\M');
    if m is not null and m[1]::int between 1 and 80 then j := j || jsonb_build_object('floor', m[1]::int); end if;
  end if;

  m := regexp_match(k, '(\d+)\s*(?:pn|phong ngu|p\.ngu)\M');
  if m is null then m := regexp_match(k, 'so phong ngu\s*:?\s*(\d+)'); end if;
  if m is not null and m[1]::int between 1 and 30 then j := j || jsonb_build_object('bedrooms', m[1]::int); end if;
  m := regexp_match(k, '(\d+)\s*(?:wc|toilet|nha ve sinh|nvs|ve sinh|phong tam)\M');
  if m is null then m := regexp_match(k, '(?:so )?(?:phong ve sinh|phong tam|wc)\s*:?\s*(\d+)\M'); end if;
  if m is not null and m[1]::int between 1 and 30 then j := j || jsonb_build_object('bathrooms', m[1]::int); end if;

  if k ~ '(nha|ban nha|can nha|can|ban|thue|cho thue)\s*(?:pho|rieng|dep|gap|nguyen can|moi)?\s*(hem|\mhxh\M|\mhxt\M)' then
    null;
  elsif k ~ '(cach|gan|sat|ra|toi|den|buoc ra|ke|ngay|\d+\s*m) (mat tien|\mmt\M)' and k !~ '(nha|ban|ban nha|can|lo)\s*(\d\s*)?mat tien' then
    null;
  elsif k ~ '(mat tien|\mmt\M|mat pho|mat duong|co via he|via he rong|le duong)' then
    j := j || jsonb_build_object('access_type', 'mat_tien');
  end if;
  if j->>'access_type' is null then
    if k ~ '(hem xe tai|\mhxt\M|xe tai)' then j := j || jsonb_build_object('access_type', 'hem_xe_tai');
    elsif k ~ '(hem xe hoi|\mhxh\M|hem o ?to|hem xe con|xe hoi|o ?to (vo|vao|dau|toi|do)|hem 7 cho|xe 7 cho)' then j := j || jsonb_build_object('access_type', 'hem_xe_hoi');
    elsif k ~ '(hem xe may|hem nho|hem ba gac|hem 3 gac|hem xe 3 banh|xe may)' then j := j || jsonb_build_object('access_type', 'hem_xe_may');
    elsif k ~ '\mhem\M' then j := j || jsonb_build_object('access_type', 'hem');
    end if;
  end if;
  m := regexp_match(k, '(?:hem|hxh|hxt|duong truoc nha|duong)\s*(?:xe hoi|xe tai|xe may|truoc nha|rong|thong)?\s*(?:rong)?\s*(?:hon|gan|:)?\s*(\d+(?:\.\d+)?)\s*m\M');
  if m is not null and m[1]::numeric between 1 and 40 then
    j := j || jsonb_build_object('alley_width_m', m[1]::numeric);
    if j->>'access_type' = 'hem' then
      j := j || jsonb_build_object('access_type', case when m[1]::numeric >= 6 then 'hem_xe_tai' when m[1]::numeric >= 3.5 then 'hem_xe_hoi' else 'hem_xe_may' end);
    end if;
  end if;
  m := regexp_match(k, '(?:cach|ra)\s*(?:mat tien|\mmt\M)\s*(?:chi|khoang|tam|hon|gan|duong)?\s*(?:[a-z ]{0,25}?)\s*(\d+(?:\.\d+)?)\s*m\M');
  if m is null then m := regexp_match(k, 'cach\s*(?:chi|khoang|tam)?\s*(\d+(?:\.\d+)?)\s*m\s*(?:la )?(?:ra|toi|den)\s*(?:mat tien|\mmt\M|duong)'); end if;
  if m is not null and m[1]::numeric between 5 and 500 then j := j || jsonb_build_object('distance_to_street_m', m[1]::numeric); end if;

  if k ~ '(so hong rieng|\mshr\M|so rieng|so do rieng)' then j := j || jsonb_build_object('legal_status', 'so_hong_rieng');
  elsif k ~ '(so hong chung|\mshc\M|so chung|dong so huu)' then j := j || jsonb_build_object('legal_status', 'so_hong_chung');
  elsif k ~ '(hop dong mua ban|\mhdmb\M)' then j := j || jsonb_build_object('legal_status', 'hdmb');
  elsif k ~ '(giay tay|vi bang)' then j := j || jsonb_build_object('legal_status', 'giay_tay');
  elsif k ~ '(so hong|so do|\mshcc\M|so chinh chu|so dep|so vuong|so sach|so cam tay|\mso\M (day du|ro rang|chuan)|co so)' then j := j || jsonb_build_object('legal_status', 'so_hong');
  end if;
  if k ~ 'chua hoan cong' then j := j || jsonb_build_object('has_completion', false);
  elsif k ~ 'hoan cong' then j := j || jsonb_build_object('has_completion', true); end if;
  if k ~ '(khong lo gioi|khong dinh lo gioi|khong bi lo gioi|da bo lo gioi)' then j := j || jsonb_build_object('planning_status', 'khong_lo_gioi');
  elsif k ~ '(khong quy hoach|khong dinh quy hoach|khong quy hoach treo)' then j := j || jsonb_build_object('planning_status', 'khong_quy_hoach');
  elsif k ~ '(dinh lo gioi|co lo gioi|lo gioi \d|dinh quy hoach)' then j := j || jsonb_build_object('planning_status', 'dinh_lo_gioi');
  end if;

  if k ~ 'thang may' then j := j || jsonb_build_object('has_elevator', true); end if;
  if k ~ '(xe hoi (vo|vao|ngu|de) (trong )?nha|o ?to (vo|vao|ngu|dau) (trong |tan )?nha|dau (o ?to|xe hoi|xe oto) trong nha|san dau (o ?to|xe hoi)|\mgarage\M|ga ?ra ?ge|\mgara\M|xe hoi ngu trong nha|(o ?to|xe hoi) (vo|vao|toi) tan (cua|nha))' then
    j := j || jsonb_build_object('car_in_house', true);
  end if;
  if k ~ '(can goc|lo goc|nha goc|2 mat tien|hai mat tien|2 mat hem|hai mat hem|goc 2 mat|2 mat thoang)' then j := j || jsonb_build_object('corner_lot', true); end if;
  if k ~ '(full noi that|noi that day du|day du noi that|tang (toan bo |het |full |tat ca )?noi that|noi that cao cap|full nt|tang nt|nt cao cap|nt day du|noi that sang trong)' then j := j || jsonb_build_object('furnishing', 'full');
  elsif k ~ '(noi that co ban|nt co ban)' then j := j || jsonb_build_object('furnishing', 'co_ban');
  elsif k ~ '(khong noi that|nha trong|khong co noi that)' then j := j || jsonb_build_object('furnishing', 'khong');
  end if;
  m := regexp_match(k, '(?:xay|xay dung|xd|hoan cong)\s*(?:nam|moi|tu|vao)?\s*(?:giua|dau|cuoi)?\s*(?:nam)?\s*((?:19|20)\d\d)\M');
  if m is null then m := regexp_match(k, 'nam xay\s*(?:dung)?\s*:?\s*((?:19|20)\d\d)\M'); end if;
  if m is not null then j := j || jsonb_build_object('year_built', m[1]::int); end if;

  m := regexp_match(k, 'huong\s*(?:nha|cua|chinh|ban cong)?\s*:?\s*(dong nam|dong bac|tay nam|tay bac|dong|tay|nam|bac)\M');
  if m is not null then
    j := j || jsonb_build_object('direction',
      replace(replace(replace(initcap(m[1]), 'Dong', 'Đông'), 'Tay', 'Tây'), 'Bac', 'Bắc'));
  end if;

  if k ~ '(khong tl|khong thuong luong|gia chot|mien tl|mien thuong luong)' then j := j || jsonb_build_object('negotiable', false);
  elsif k ~ '(\mtl\M|thuong luong|thoa thuan|con tl)' then j := j || jsonb_build_object('negotiable', true); end if;
  m := regexp_match(k, '(?:dang|hien|hien dang|co hop dong)\s*(?:cho )?thue\s*(?:duoc|voi gia|gia|:)?\s*(\d+(?:\.\d+)?)\s*(?:tr|trieu)\M');
  if m is null then m := regexp_match(k, '(?:cho thue|thue)\s*(\d+(?:\.\d+)?)\s*(?:tr|trieu)\s*/?\s*(?:thang|th)\M'); end if;
  if m is not null and m[1]::numeric between 1 and 2000 then j := j || jsonb_build_object('rent_income_vnd', (m[1]::numeric * 1000000)::bigint); end if;

  return j;
end $function$
;

CREATE OR REPLACE FUNCTION public.bot_health_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
declare
  v_from bigint; v_to bigint; v_new integer := 0;
  v_beat timestamptz; v_co_hang boolean; v_hour integer;
  v_dead boolean := false; v_chua_bao_gio boolean := false;
  v_cnt integer; v_last text; v_ntfy bigint;
  v_ntfy_truoc bigint; v_ma_truoc integer; v_co_dau_vet boolean;
  v_da_gui boolean := false;
begin
  select last_id into v_from from bot_health where who = 'pg_net';
  if v_from is null then
    select coalesce(max(id), 0) into v_from from net._http_response;
    insert into bot_health (who, last_id) values ('pg_net', v_from);
  end if;

  select coalesce(max(id), v_from) into v_to from net._http_response;

  insert into bot_errors (at, source, status_code, detail)
  select r.created, 'pg_net', r.status_code,
         left(public.che_sdt(coalesce(r.error_msg, r.content)), 500)
  from net._http_response r
  where r.id > v_from and r.id <= v_to
    and (r.status_code is null or r.status_code < 200 or r.status_code >= 300);
  get diagnostics v_new = row_count;
  update bot_health set last_id = v_to, at = now() where who = 'pg_net';

  v_hour := extract(hour from (now() at time zone 'Asia/Ho_Chi_Minh'))::int;
  select at into v_beat from bot_health where who = 'bridge-zca';
  v_co_hang := found;

  if v_hour between 7 and 22 then
    if not v_co_hang then
      v_chua_bao_gio := true;
      v_dead := true;
      insert into bot_errors (source, detail)
      select 'bridge', 'bridge-zca CHƯA TỪNG điểm danh lần nào — chưa chạy, hoặc chạy mà không ghi được bot_health.'
      where not exists (select 1 from bot_errors
                        where source = 'bridge' and at > now() - interval '1 hour');
    elsif v_beat < now() - interval '15 minutes' then
      v_dead := true;
      insert into bot_errors (source, detail)
      select 'bridge', format('bridge-zca im từ %s (VN)',
                              to_char(v_beat at time zone 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI'))
      where not exists (select 1 from bot_errors
                        where source = 'bridge' and at > now() - interval '1 hour');
    end if;
  end if;

  select last_id into v_ntfy_truoc from bot_health
   where who = 'ntfy' and at > now() - interval '1 hour';
  if v_ntfy_truoc is not null then
    select status_code into v_ma_truoc from net._http_response where id = v_ntfy_truoc;
    v_co_dau_vet := found;
    if not v_co_dau_vet then
      v_da_gui := true;
    elsif v_ma_truoc between 200 and 299 then
      v_da_gui := true;
    else
      v_da_gui := false;
      insert into bot_errors (source, detail)
      select 'coi ntfy',
             format('lượt báo trước (pg_net req %s) KHÔNG tới nơi (mã %s) — bắn lại.',
                    v_ntfy_truoc, coalesce(v_ma_truoc::text, 'timeout/không có mã'))
      where not exists (select 1 from bot_errors
                        where source = 'coi ntfy' and at > now() - interval '1 hour');
    end if;
  end if;

  select count(*) into v_cnt from bot_errors where at > now() - interval '1 hour';

  if (v_new > 0 or v_dead or v_cnt > 0)
     and not exists (select 1 from reminders
                     where kind = 'escalation' and note like '🩺%'
                       and created_at > now() - interval '1 hour') then
    update reminders set status = 'cancelled'
     where kind = 'escalation' and status = 'pending' and note like '🩺%';
    insert into reminders (kind, due_at, note)
    values ('escalation', now(),
      format('🩺 nhadat.cc: %s lỗi trong 1 giờ qua%s. Xem trang /admin.',
             v_cnt, case when v_dead then ' + bridge-zca đang im' else '' end));
  end if;

  if (v_new > 0 or v_dead or v_cnt > 0) and not v_da_gui then
    select left(source || ': ' || coalesce(detail, ''), 200) into v_last
      from bot_errors order by at desc limit 1;
    v_ntfy := public.canh_bao_ngoai(
      case when v_dead then 'nhadat.cc: bridge Zalo đang im' else 'nhadat.cc: có lỗi mới' end,
      format('%s lỗi trong 1 giờ qua%s. Mới nhất: %s. Xem /admin.',
             v_cnt,
             case when v_chua_bao_gio then ' + bridge-zca chưa từng điểm danh'
                  when v_dead then ' + bridge-zca im từ ' || to_char(v_beat at time zone 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI')
                  else '' end,
             coalesce(v_last, '-')),
      case when v_dead then 5 else 4 end);
    insert into bot_health (who, at, last_id) values ('ntfy', now(), coalesce(v_ntfy, 0))
    on conflict (who) do update set at = now(), last_id = excluded.last_id;
  end if;

  update reminders set status = 'cancelled'
   where kind = 'report' and status = 'pending' and created_at < now() - interval '36 hours';

  delete from bot_errors where at < now() - interval '30 days';

  return jsonb_build_object('loi_moi', v_new, 'bridge_im', v_dead,
                            'bridge_chua_bao_gio', v_chua_bao_gio,
                            'quet_toi', v_to, 'ntfy', v_ntfy,
                            'lan_truoc_da_gui', v_da_gui);
end $function$
;

CREATE OR REPLACE FUNCTION public.bot_prompts_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.bump_model_quota(p_limit integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_calls integer;
begin
  insert into bot_usage (day, model_calls)
  values ((now() at time zone 'Asia/Ho_Chi_Minh')::date, 1)
  on conflict (day) do update set model_calls = bot_usage.model_calls + 1
  returning model_calls into v_calls;

  if v_calls > p_limit then
    -- Chạm trần: ghi mốc + báo admin ĐÚNG MỘT LẦN mỗi ngày, đừng spam.
    update bot_usage set capped_at = now()
      where day = (now() at time zone 'Asia/Ho_Chi_Minh')::date
        and capped_at is null;
    if found then
      insert into reminders (kind, due_at, note)
      values ('escalation', now(),
        format('🚨 Bot chạm trần %s lượt gọi model trong ngày và đã TẠM DỪNG trả lời. '
               'Nếu không phải khách thật thì có người đang đốt tiền model bằng anon key.',
               p_limit));
    end if;
    return false;
  end if;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.bump_user_quota(p_uid text, p_gio_limit integer DEFAULT 30, p_ngay_limit integer DEFAULT 120)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_gio   timestamptz := date_trunc('hour', now());
  v_quen  boolean;
  v_he    integer;
  v_trong_gio integer;
  v_trong_ngay integer;
begin
  if p_uid is null or btrim(p_uid) = '' then
    return true;
  end if;

  select exists (
    select 1 from sellers s where s.zalo_user_id = p_uid
    union all
    select 1 from ctvs c   where c.zalo_user_id = p_uid
    union all
    select 1 from admins a where a.zalo_user_id = p_uid
  ) into v_quen;
  v_he := case when v_quen then 4 else 1 end;

  insert into chat_quota (zalo_user_id, gio, calls)
  values (p_uid, v_gio, 1)
  on conflict (zalo_user_id, gio) do update set calls = chat_quota.calls + 1
  returning calls into v_trong_gio;

  select coalesce(sum(calls), 0) into v_trong_ngay
  from chat_quota
  where zalo_user_id = p_uid and gio > now() - interval '24 hours';

  delete from chat_quota where zalo_user_id = p_uid and gio < now() - interval '48 hours';
  if random() < 0.01 then
    delete from chat_quota where gio < now() - interval '48 hours';
  end if;

  if v_trong_gio > p_gio_limit * v_he or v_trong_ngay > p_ngay_limit * v_he then
    return false;
  end if;
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.can_cung_khu(p_buyer_id uuid, p_listing_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 3)
 RETURNS TABLE(id uuid, code text, ward text, district text, price_raw text, area_m2 numeric, tom_tat text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ward text; v_dist text; v_price bigint; v_deal text; v_area_kd text := '';
begin
  if p_listing_id is not null then
    select l.ward, l.district, l.price_vnd, l.deal::text into v_ward, v_dist, v_price, v_deal
      from listings l where l.id = p_listing_id;
  end if;
  if v_ward is null and v_dist is null and p_buyer_id is not null then
    select public.bo_dau(coalesce(b.preferences->>'area', '')),
           public.parse_vnd(b.preferences->>'budget'),
           case when coalesce(b.preferences->>'deal', 'ban') in ('thue', 'cho_thue') then 'cho_thue' else 'ban' end
      into v_area_kd, v_price, v_deal
      from buyers b where b.id = p_buyer_id;
  end if;
  v_deal := coalesce(v_deal, 'ban');
  if v_ward is null and v_dist is null and coalesce(v_area_kd, '') = '' then
    return;  -- không có mốc khu vực thì không đoán
  end if;

  return query
  select l.id, l.code, l.ward, l.district, l.price_raw, l.area_m2,
         '#' || l.code || ' · ' || coalesce(l.ward, '') || coalesce(', ' || l.district, '')
           || coalesce(' · ' || l.price_raw, '')
           || coalesce(' · ' || rtrim(to_char(l.area_m2, 'FM9999999990.99'), '.') || 'm2', '')
    from listings l
   where l.status in ('dang_ban', 'dang_quan_tam')
     and l.id is distinct from p_listing_id
     and l.deal::text = v_deal
     and (v_price is null or l.price_vnd is null
          or l.price_vnd between (v_price * 0.7)::bigint and (v_price * 1.15)::bigint)
     and (
       case when v_ward is not null or v_dist is not null then
              (v_ward is not null and public.bo_dau(l.ward) = public.bo_dau(v_ward))
              or (v_dist is not null and public.bo_dau(l.district) = public.bo_dau(v_dist))
            else public.khu_khop(v_area_kd, l.ward, l.district) end
     )
     and (p_buyer_id is null or not exists (
           select 1 from reminders r where r.buyer_id = p_buyer_id and r.listing_id = l.id
                                       and r.kind in ('match', 'sold', 'followup')))
     and (p_buyer_id is null or not exists (select 1 from interests i where i.buyer_id = p_buyer_id and i.listing_id = l.id))
     and (p_buyer_id is null or not exists (select 1 from viewings v where v.buyer_id = p_buyer_id and v.listing_id = l.id))
   order by (v_ward is not null and public.bo_dau(l.ward) = public.bo_dau(v_ward)) desc,
            l.last_interest_at desc nulls last, l.created_at desc
   limit greatest(1, least(coalesce(p_limit, 3), 5));
end $function$
;

CREATE OR REPLACE FUNCTION public.canh_bao_ngoai(p_title text, p_text text, p_priority integer DEFAULT 4, p_email boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net'
AS $function$
declare v_topic text; v_mail text; v_token text; v_body jsonb; v_hdr jsonb; v_id bigint;
begin
  select value into v_topic from app_config where key = 'ntfy_topic';
  if v_topic is null or btrim(v_topic) = '' then return null; end if;
  v_body := jsonb_build_object('topic', v_topic, 'title', left(p_title, 120),
                               'message', left(p_text, 900), 'priority', p_priority,
                               'tags', jsonb_build_array('house'));
  v_hdr := '{"Content-Type": "application/json"}'::jsonb;
  begin
    v_token := public.get_secret('NTFY_TOKEN');
  exception when others then v_token := null;
  end;
  if v_token is not null and btrim(v_token) <> '' then
    v_hdr := v_hdr || jsonb_build_object('Authorization', 'Bearer ' || btrim(v_token));
  end if;
  if p_email then
    select value into v_mail from app_config where key = 'admin_email';
    if v_mail is not null and btrim(v_mail) <> '' then
      v_body := v_body || jsonb_build_object('email', btrim(v_mail));
    end if;
  end if;
  select net.http_post(url := 'https://ntfy.sh', body := v_body, headers := v_hdr,
                       timeout_milliseconds := 15000) into v_id;
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.cat_truoc_phu_dinh(p_text text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  t   text := public.bo_dau(coalesce(p_text, ''));
  m   text;
  p   int;
  min_p int := null;
begin
  -- bo_dau dùng lower() + translate() 1-đổi-1 nên VỊ TRÍ ký tự không đổi:
  -- tìm trên bản đã bỏ dấu, cắt trên bản gốc.
  foreach m in array array['chu khong', 'chu ko', 'khong phai', 'ko phai',
                           'chang phai', 'hong phai', 'dau phai']
  loop
    p := position(m in t);
    if p > 0 and (min_p is null or p < min_p) then min_p := p; end if;
  end loop;

  if min_p is null then return p_text; end if;
  return btrim(substring(p_text from 1 for min_p - 1));
end $function$
;

CREATE OR REPLACE FUNCTION public.cau_hinh(p_key text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select value from public.app_config where key = p_key $function$
;

CREATE OR REPLACE FUNCTION public.che_sdt(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select regexp_replace(coalesce(p, ''), '(\+84|\m84|\m0)(\d{3})\d{5,7}\M', '0\2xxxxxx', 'g')
$function$
;

CREATE OR REPLACE FUNCTION public.chon_viec_don_chet()
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with x as (
    update public.media_cleanup_queue set trang_thai='chet', updated_at=now()
     where trang_thai in ('cho','loi','dang_lam') and attempts >= 6
    returning 1)
  select count(*)::int from x;
$function$
;

CREATE OR REPLACE FUNCTION public.chuan_hoa_gia_raw(p_text text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare
  s   text := btrim(coalesce(p_text, ''));
  goc bigint := public.parse_vnd(p_text);
  t   text;
  m   text[];
begin
  if s = '' then return null; end if;

  loop
    t := public.bo_dau(s);
    m := regexp_match(
      t,
      '([[:space:],]+(nha|nhe|nhen|nhak|nho|a|ah|oi|em|anh|chi|do|day|luon|thoi|ok|nghen|he))$'
    );
    exit when m is null;
    s := btrim(substring(s from 1 for length(s) - length(m[1])));
    exit when s = '';
  end loop;

  if s = '' then return btrim(p_text); end if;
  if public.parse_vnd(s) is distinct from goc then return btrim(p_text); end if;
  return s;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.chuan_hoa_lai_gia(p_batch integer DEFAULT 200)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  with lech as (
    select id from listings
     where price_raw is not null and btrim(price_raw) <> ''
       and price_vnd is distinct from public.parse_vnd(price_raw)
     order by id
     limit greatest(1, p_batch)
  )
  update listings l set price_raw = l.price_raw
    from lech where l.id = lech.id;
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.chuan_hoa_phuong(p_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case
    when p_text is null or btrim(p_text) = '' then null
    when (regexp_match(public.bo_dau(p_text), '(?:phuong|p)\s*\.?\s*([0-9]{1,2})'))[1] is not null
     and ((regexp_match(public.bo_dau(p_text), '(?:phuong|p)\s*\.?\s*([0-9]{1,2})'))[1])::int between 1 and 25
      then 'Phường ' || ((regexp_match(public.bo_dau(p_text), '(?:phuong|p)\s*\.?\s*([0-9]{1,2})'))[1])::int
    when btrim(p_text) ~ '^[0-9]{1,2}$' and btrim(p_text)::int between 1 and 25
      then 'Phường ' || btrim(p_text)::int
    when length(btrim(p_text)) between 2 and 50 then btrim(p_text)
    else null
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_inbound(p_msg_id text, p_stale_secs integer DEFAULT 150, p_worker text DEFAULT NULL::text)
 RETURNS TABLE(r_state text, r_reply jsonb, r_attempts integer, r_sent_at timestamp with time zone, r_dead boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row public.inbound_ledger%rowtype;
  v_max constant int := 8;
begin
  insert into inbound_ledger (zalo_msg_id, status, attempts, started_at, locked_by)
  values (p_msg_id, 'processing', 1, now(), p_worker)
  on conflict (zalo_msg_id) do nothing;
  if found then
    return query select 'received'::text, null::jsonb, 1, null::timestamptz, false;
    return;
  end if;

  select * into v_row from inbound_ledger where zalo_msg_id = p_msg_id for update;

  if v_row.status = 'completed' then
    return query select 'completed'::text, v_row.reply, v_row.attempts, v_row.sent_at, false;
    return;
  end if;
  if v_row.status = 'dead' then
    return query select 'dead'::text, v_row.reply, v_row.attempts, v_row.sent_at, true;
    return;
  end if;
  if v_row.status = 'processing'
     and v_row.updated_at > now() - make_interval(secs => p_stale_secs) then
    return query select 'in_flight'::text, null::jsonb, v_row.attempts, v_row.sent_at, false;
    return;
  end if;
  if v_row.next_retry_at is not null and v_row.next_retry_at > now() then
    return query select 'in_flight'::text, null::jsonb, v_row.attempts, v_row.sent_at, false;
    return;
  end if;
  if v_row.attempts >= v_max then
    update inbound_ledger set status='dead', finished_at=now(), updated_at=now()
     where zalo_msg_id = p_msg_id;
    return query select 'dead'::text, v_row.reply, v_row.attempts, v_row.sent_at, true;
    return;
  end if;

  update inbound_ledger
     set status='processing', attempts=v_row.attempts+1, locked_by=p_worker,
         started_at=now(), next_retry_at=null, updated_at=now()
   where zalo_msg_id = p_msg_id;
  return query select 'received'::text, v_row.reply, v_row.attempts+1, v_row.sent_at, false;
end $function$
;

CREATE OR REPLACE FUNCTION public.cong_token(p_in bigint DEFAULT 0, p_out bigint DEFAULT 0, p_cache_write bigint DEFAULT 0, p_cache_read bigint DEFAULT 0)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into bot_usage (day, model_calls, in_tokens, out_tokens, cache_write_tokens, cache_read_tokens)
  values ((now() at time zone 'Asia/Ho_Chi_Minh')::date, 0,
          coalesce(p_in,0), coalesce(p_out,0), coalesce(p_cache_write,0), coalesce(p_cache_read,0))
  on conflict (day) do update set
    in_tokens          = bot_usage.in_tokens          + coalesce(p_in,0),
    out_tokens         = bot_usage.out_tokens         + coalesce(p_out,0),
    cache_write_tokens = bot_usage.cache_write_tokens + coalesce(p_cache_write,0),
    cache_read_tokens  = bot_usage.cache_read_tokens  + coalesce(p_cache_read,0);
exception when others then
  return;
end $function$
;

CREATE OR REPLACE FUNCTION public.conversations_email_upset()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid text; v_ten text; v_trich text;
begin
  if new.needs_human and not coalesce(old.needs_human, false) and new.buyer_id is not null then
    select b.zalo_user_id, b.name into v_uid, v_ten from buyers b where b.id = new.buyer_id;
    select string_agg('- ' || left(m.body, 200), E'\n' order by m.created_at) into v_trich
      from (select body, created_at from messages
             where conversation_id = new.id and sender = 'buyer'
             order by created_at desc limit 3) m;
    perform public.email_admin('UPSET', v_uid,
      'Khách: ' || coalesce(v_ten, '(chưa biết tên)') || E'\nHội thoại: ' || new.id::text
      || E'\nTin gần nhất:\n' || coalesce(v_trich, '-'));
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.ctv_report_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  perform net.http_post(
    url := public.cau_hinh('functions_base_url') || '/ctv-report',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer sb_publishable_zmJBmEgFPn3bBKx_1ve6Pg_dXdo4haX',
      'x-bridge-secret', public.get_secret('BRIDGE_SECRET')),
    body := '{}'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.ctv_sla_phut()
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$ select 120 $function$
;

CREATE OR REPLACE FUNCTION public.deals_chan_xoa_da_chot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if old.closed_at is not null then
    raise exception 'FR-163: deal da chot (closed_at=%) khong duoc xoa. Muon xoa that: UPDATE closed_at ve NULL truoc.', old.closed_at
      using errcode = 'P0001';
  end if;
  return old;
end $function$
;

CREATE OR REPLACE FUNCTION public.doc_danh_sach(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'title',      c.title,
    'created_at', c.created_at,
    'expires_at', c.expires_at,
    'listings',   coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'code', l.code, 'deal', l.deal, 'district', l.district, 'ward', l.ward,
        'street', l.street, 'location_raw', l.location_raw, 'area_m2', l.area_m2,
        'price_vnd', l.price_vnd, 'price_raw', l.price_raw, 'property_type', l.property_type,
        'bedrooms', l.bedrooms, 'bathrooms', l.bathrooms, 'floors', l.floors,
        'access_type', l.access_type, 'status', l.status, 'created_at', l.created_at
      ) order by x.ord)
      from unnest(c.listing_ids) with ordinality as x(id, ord)
      join public.listings l on l.id = x.id
      where l.status in ('dang_ban', 'dang_quan_tam')
    ), '[]'::jsonb)
  )
  from public.curated_lists c
  where c.token = p_token
    and length(p_token) between 16 and 64
    and c.expires_at > now()
$function$
;

CREATE OR REPLACE FUNCTION public.email_admin(p_loai text, p_zalo_uid text, p_body text, p_listing_id uuid DEFAULT NULL::uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_mail text; v_bds text; v_id bigint;
begin
  select value into v_mail from app_config where key = 'admin_email';
  if v_mail is null or btrim(v_mail) = '' then return null; end if;
  if p_listing_id is not null then
    select '#' || code || ' · ' || coalesce(location_raw, '') || ' ' || coalesce(ward, '')
           || coalesce(', ' || district, '') || coalesce(' · ' || price_raw, '')
           || coalesce(' · ' || rtrim(to_char(area_m2, 'FM9999999990.99'), '.') || 'm2', '')
           || coalesce(E'\n' || left(description, 300), '')
      into v_bds from listings where id = p_listing_id;
  end if;
  v_id := public.canh_bao_ngoai(
    '[' || p_loai || '] ' || coalesce(p_zalo_uid, '?'),
    coalesce(p_body, '') || coalesce(E'\nBĐS: ' || v_bds, '')
      || E'\nThời điểm: ' || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI'),
    case when p_loai in ('UPSET', 'VOICE') then 5 else 4 end,
    true);
  return v_id;
exception when others then
  perform public.log_loi('email_admin', left(p_loai || ': ' || sqlerrm, 400), null::integer);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.ensure_buyer_conversation(p_zalo_user_id text, p_channel text DEFAULT 'zalo_oa'::text)
 RETURNS TABLE(b_id uuid, c_id uuid, b_name text, b_prefs jsonb, c_ctv_id uuid, c_human_touch_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_buyer buyers%rowtype; v_conv conversations%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('buyer:' || p_zalo_user_id));

  select * into v_buyer from buyers where zalo_user_id = p_zalo_user_id;
  if not found then
    insert into buyers (zalo_user_id) values (p_zalo_user_id) returning * into v_buyer;
  end if;
  update buyers set last_contact_at = now() where id = v_buyer.id;

  select * into v_conv from conversations
    where conversations.buyer_id = v_buyer.id
    order by started_at desc limit 1;
  if not found then
    insert into conversations (buyer_id, channel) values (v_buyer.id, p_channel)
      returning * into v_conv;
  end if;

  return query select v_buyer.id, v_conv.id, v_buyer.name, v_buyer.preferences,
                      v_conv.ctv_id, v_conv.human_touch_at;
end $function$
;

CREATE OR REPLACE FUNCTION public.ensure_seller_conversation(p_seller_id uuid, p_channel text DEFAULT 'zalo_oa'::text)
 RETURNS TABLE(c_id uuid, c_human_touch_at timestamp with time zone, c_ctv_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_conv conversations%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('seller:' || p_seller_id::text));

  select * into v_conv from conversations
    where conversations.seller_id = p_seller_id
    order by started_at desc limit 1;
  if not found then
    insert into conversations (seller_id, channel) values (p_seller_id, p_channel)
      returning * into v_conv;
  end if;

  return query select v_conv.id, v_conv.human_touch_at, v_conv.ctv_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.get_secret(secret_name text)
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name;
$function$
;

CREATE OR REPLACE FUNCTION public.ghi_danh_gia(p_buyer_id uuid, p_listing_id uuid, p_stars integer, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_seller uuid; v_viewing uuid;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then
    raise exception 'sao phải 1..5';
  end if;
  insert into ratings_log (buyer_id, listing_id, stars, note)
  values (p_buyer_id, p_listing_id, p_stars, left(p_note, 300))
  on conflict (buyer_id, listing_id) do nothing;
  if not found then return; end if;   -- đã chấm rồi: không cộng đúp

  select id into v_viewing from viewings
   where buyer_id = p_buyer_id and listing_id = p_listing_id
   order by coalesce(slot, created_at) desc limit 1;
  if v_viewing is not null then
    update viewings set buyer_rating = p_stars,
           note = case when p_note is null then note
                       else coalesce(note || ' · ', '') || left(p_note, 300) end
     where id = v_viewing;
  end if;

  select seller_id into v_seller from listings where id = p_listing_id;
  if v_seller is not null then
    update sellers set rating_sum = coalesce(rating_sum, 0) + p_stars,
                       rating_count = coalesce(rating_count, 0) + 1
     where id = v_seller;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.ghi_fact_listing(p_listing_id uuid, p_question text, p_answer text, p_source text DEFAULT 'seller_chat'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if p_listing_id is null or coalesce(btrim(p_answer), '') = '' then
    return null;
  end if;
  insert into listing_facts (listing_id, question, answer, source)
  values (p_listing_id, btrim(p_question), btrim(p_answer),
          coalesce(nullif(btrim(p_source), ''), 'seller_chat'))
  returning id into v_id;
  return v_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.ghi_su_kien_bds(p_listing_id uuid, p_type text, p_buyer_id uuid DEFAULT NULL::uuid, p_meta jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_listing_id is null then return; end if;
  insert into property_events (listing_id, event_type, buyer_id, meta)
  values (p_listing_id, p_type, p_buyer_id, p_meta);
exception when others then
  perform public.log_loi('ghi_su_kien_bds', left(p_type || ': ' || sqlerrm, 400), null::integer);
end $function$
;

CREATE OR REPLACE FUNCTION public.ghi_su_kien_inbound(p_event_id text, p_zalo_user_id text, p_payload jsonb)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into inbound_events (event_id, zalo_user_id, payload)
  values (p_event_id, p_zalo_user_id, p_payload)
  on conflict (event_id) do update
    set delivery_count = inbound_events.delivery_count + 1,
        last_seen_at   = now()
  returning delivery_count;
$function$
;

CREATE OR REPLACE FUNCTION public.giu_luot_gui(p_msg_id text, p_han_secs integer DEFAULT 120)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_co boolean;
begin
  update public.inbound_ledger
     set sending_until = now() + make_interval(secs => p_han_secs),
         updated_at    = now()
   where zalo_msg_id = p_msg_id
     and sent_at is null
     and (sending_until is null or sending_until < now());
  if found then
    return true;
  end if;

  select exists(select 1 from public.inbound_ledger where zalo_msg_id = p_msg_id)
    into v_co;
  if not v_co then
    return true;
  end if;

  return false;
end $function$
;

CREATE OR REPLACE FUNCTION public.guess_property_type(p_text text)
 RETURNS property_type
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select (case
    when p_text is null or btrim(p_text) = '' then null
    when lower(p_text) is distinct from public.bo_dau(p_text) then (case
      when p_text ~* '(phòng trọ|nhà trọ|dãy trọ|khu trọ|phòng cho thuê)' then 'phong_tro'
      when p_text ~* '(biệt thự|villa)'                                   then 'biet_thu'
      when p_text ~* 'mặt bằng'                                            then 'mat_bang'
      when p_text ~* '(chung cư|căn hộ|penthouse|duplex|officetel)'        then 'chung_cu'
      when p_text ~* '(cấp 4|cấp bốn)'                                     then 'nha_cap4'
      when p_text ~* '(đất nền|lô đất|nền đất|bán đất|đất thổ cư|đất trống)'
           and p_text !~* '(trệt|lầu|tầng|phòng ngủ|\mPN\M|\mWC\M)'        then 'dat'
      when p_text ~* '(nhà|trệt|lầu|tầng|hẻm|mặt tiền|\mHXH\M|\mMT\M)'     then 'nha_pho'
      else null
    end)
    else (case
      when public.bo_dau(p_text) ~ '(phong tro|nha tro|day tro|khu tro|phong cho thue)' then 'phong_tro'
      when public.bo_dau(p_text) ~ '(biet thu|villa)'                                   then 'biet_thu'
      when public.bo_dau(p_text) ~ 'mat bang'                                            then 'mat_bang'
      when public.bo_dau(p_text) ~ '(chung cu|can ho|penthouse|duplex|officetel)'        then 'chung_cu'
      when public.bo_dau(p_text) ~ '(cap 4|cap bon)'                                     then 'nha_cap4'
      when public.bo_dau(p_text) ~ '(dat nen|lo dat|nen dat|ban dat|dat tho cu|dat trong)'
           and public.bo_dau(p_text) !~ '(tret|lau|tang|phong ngu|\mpn\M|\mwc\M)'        then 'dat'
      when public.bo_dau(p_text) ~ '(\mnha\M|tret|\mlau\M|tang|\mhem\M|mat tien|\mhxh\M|\mmt\M)' then 'nha_pho'
      else null
    end)
  end)::property_type;
$function$
;

CREATE OR REPLACE FUNCTION public.guess_property_type_answer(p_text text)
 RETURNS property_type
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (case
      when p_text is null or btrim(p_text) = '' then null
      when btrim(public.cat_truoc_phu_dinh(p_text)) = '' then null
      when lower(public.cat_truoc_phu_dinh(p_text))
             is distinct from public.bo_dau(public.cat_truoc_phu_dinh(p_text)) then (case
        when public.cat_truoc_phu_dinh(p_text) ~* '\mtrọ\M|phòng cho thuê'      then 'phong_tro'
        when public.cat_truoc_phu_dinh(p_text) ~* '(biệt thự|villa)'            then 'biet_thu'
        when public.cat_truoc_phu_dinh(p_text) ~* '(mặt bằng|\mmb\M)'           then 'mat_bang'
        when public.cat_truoc_phu_dinh(p_text) ~* '(chung cư|căn hộ|penthouse|duplex|officetel|\mcc\M)' then 'chung_cu'
        when public.cat_truoc_phu_dinh(p_text) ~* '(cấp 4|cấp bốn)'             then 'nha_cap4'
        when public.cat_truoc_phu_dinh(p_text) ~* '\m(đất|nền|thổ cư)\M'
             and public.cat_truoc_phu_dinh(p_text) !~* '(trệt|lầu|tầng|phòng ngủ|\mPN\M|\mWC\M)' then 'dat'
        when public.cat_truoc_phu_dinh(p_text) ~* '\mnhà\M|nhà phố|nhà riêng|nhà hẻm' then 'nha_pho'
        else null
      end)
      else (case
        when public.bo_dau(public.cat_truoc_phu_dinh(p_text)) ~ '\mtro\M|phong cho thue' then 'phong_tro'
        when public.bo_dau(public.cat_truoc_phu_dinh(p_text)) ~ '(biet thu|villa)'       then 'biet_thu'
        when public.bo_dau(public.cat_truoc_phu_dinh(p_text)) ~ '(mat bang|\mmb\M)'      then 'mat_bang'
        when public.bo_dau(public.cat_truoc_phu_dinh(p_text)) ~ '(chung cu|can ho|penthouse|duplex|officetel|\mcc\M)' then 'chung_cu'
        when public.bo_dau(public.cat_truoc_phu_dinh(p_text)) ~ '(cap 4|cap bon)'        then 'nha_cap4'
        when public.bo_dau(public.cat_truoc_phu_dinh(p_text)) ~ '\m(dat|nen|tho cu)\M'
             and public.bo_dau(public.cat_truoc_phu_dinh(p_text)) !~ '(tret|lau|tang|phong ngu|\mpn\M|\mwc\M)' then 'dat'
        when public.bo_dau(public.cat_truoc_phu_dinh(p_text)) ~ '\mnha\M|nha pho|nha rieng|nha hem' then 'nha_pho'
        else null
      end)
    end)::public.property_type,
    -- Đường lùi cũ: quét như mô tả. Cũng phải đi qua bộ cắt phủ định, nếu không
    -- thì "nhà phố chứ không phải chung cư" lại lọt xuống đây và ra chung_cu.
    public.guess_property_type(public.cat_truoc_phu_dinh(p_text))
  );
$function$
;

CREATE OR REPLACE FUNCTION public.inbound_ledger_giu_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if old.status = 'completed' and new.status is distinct from 'completed' then
    raise exception 'FR-163: inbound_ledger % da completed — khong duoc tut trang thai (thu ghi %).',
      old.zalo_msg_id, new.status using errcode = 'P0001';
  end if;
  if old.status = 'dead' and new.status not in ('dead','completed') then
    raise exception 'FR-166: inbound_ledger % da dead — chi go duoc bang completed (thu ghi %).',
      old.zalo_msg_id, new.status using errcode = 'P0001';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.inbound_sweep_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_n int;
begin
  select count(*) into v_n from public.viec_inbound_bo_roi(1);
  if v_n = 0 then return; end if;

  perform net.http_post(
    url := public.cau_hinh('functions_base_url') || '/inbound-sweep',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer sb_publishable_zmJBmEgFPn3bBKx_1ve6Pg_dXdo4haX',
      'x-bridge-secret', public.get_secret('BRIDGE_SECRET')),
    body := '{}'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.info_request_bao_lai_khach()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_code text; v_vw uuid;
begin
  if new.status = 'answered' and old.status is distinct from 'answered'
     and new.source = 'buyer_ask' and new.buyer_id is not null then
    select code into v_code from listings where id = new.listing_id;
    update reminders set status = 'cancelled'
     where buyer_id = new.buyer_id and listing_id = new.listing_id
       and kind = 'followup' and status = 'pending';
    if coalesce(new.question, '') = 'xac_nhan_lich' then                       -- 20260904f FR-52
      select id into v_vw from viewings
       where buyer_id = new.buyer_id and listing_id = new.listing_id
         and status in ('proposed', 'pending')
       order by created_at desc limit 1;
      if v_vw is not null then
        update viewings set status = 'confirmed' where id = v_vw;
      end if;
      insert into reminders (kind, buyer_id, listing_id, viewing_id, due_at, note)
      values ('followup', new.buyer_id, new.listing_id, v_vw, now(),
        'lịch xem #' || coalesce(v_code, '?') || ' đã được xác nhận: ' || left(coalesce(new.answer, ''), 200));
    else
      insert into reminders (kind, buyer_id, listing_id, due_at, note)
      values ('followup', new.buyer_id, new.listing_id, now(),
        'chủ nhà vừa trả lời câu khách hỏi về #' || coalesce(v_code, '?') || ' — "'
        || coalesce(new.question, '') || '": ' || left(coalesce(new.answer, ''), 300));
    end if;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.info_request_set_active_listing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'pending' then
    update sellers s
       set active_listing_id = new.listing_id
      from listings l
     where l.id = new.listing_id
       and s.id = l.seller_id
       and s.active_listing_id is distinct from new.listing_id;
  end if;
  return null;
end
$function$
;

CREATE OR REPLACE FUNCTION public.info_request_sla_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; n int := 0;
begin
  for r in
    select q.id, q.question, q.buyer_id, q.listing_id, l.code, coalesce(c.name, '?') as ctv_name,
           b.zalo_user_id as buyer_uid, b.name as buyer_name
    from info_requests q
    join listings l on l.id = q.listing_id
    left join ctvs c on c.id = q.ctv_id
    left join buyers b on b.id = q.buyer_id
    where q.status = 'pending' and q.source = 'buyer_ask' and q.assignee = 'ctv'
      and q.sla_due_at < now() and q.sla_missed_at is null
    limit 50
  loop
    insert into reminders (kind, listing_id, due_at, note)
    values ('escalation', r.listing_id, now(),
      '⏰ CTV ' || r.ctv_name || ' chưa trả lời câu khách hỏi #' || coalesce(r.code, '?')
      || ' ("' || coalesce(r.question, '') || '") sau ' || public.ctv_sla_phut()
      || ' phút. Admin đỡ khách giúp: hỏi chủ rồi nhắn bot "#' || coalesce(r.code, '?') || ': câu trả lời".');
    update info_requests set sla_missed_at = now() where id = r.id;
    if coalesce(r.question, '') <> 'xac_nhan_lich' then
      perform public.email_admin('QUESTION', r.buyer_uid,
        'Khách: ' || coalesce(r.buyer_name, '(chưa biết tên)') || E'\nCâu hỏi: "' || coalesce(r.question, '')
        || E'"\nCTV: ' || r.ctv_name || ' quá ' || public.ctv_sla_phut() || ' phút chưa trả lời', r.listing_id);
    end if;
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.info_request_timeout_tick()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; v_thay text; n_nhac int := 0; n_het int := 0; n_khach int := 0;
begin
  update info_requests set reminded_at = now()
   where status = 'pending' and source = 'seller_flow' and reminded_at is null
     and created_at < now() - interval '24 hours';
  get diagnostics n_nhac = row_count;

  update info_requests set status = 'expired'
   where status = 'pending' and source = 'seller_flow'
     and created_at < now() - interval '48 hours';
  get diagnostics n_het = row_count;

  for r in
    select q.id, q.buyer_id, q.listing_id, l.code
      from info_requests q left join listings l on l.id = q.listing_id
     where q.status = 'pending' and q.source = 'buyer_ask'
       and q.created_at < now() - interval '48 hours'
     limit 50
  loop
    update info_requests set status = 'expired' where id = r.id;
    if r.buyer_id is not null then
      select string_agg(c.tom_tat, '; ') into v_thay
        from public.can_cung_khu(r.buyer_id, r.listing_id, 2) c;
      update reminders set status = 'cancelled'
       where buyer_id = r.buyer_id and listing_id = r.listing_id
         and kind = 'followup' and status = 'pending';
      insert into reminders (kind, buyer_id, listing_id, due_at, note)
      values ('followup', r.buyer_id, r.listing_id, now(),
        'chủ nhà chưa phản hồi #' || coalesce(r.code, '?')
        || coalesce(', gợi ý căn khác: ' || v_thay, ''));
      n_khach := n_khach + 1;
    end if;
  end loop;
  return jsonb_build_object('nhac_24h', n_nhac, 'het_han_seller', n_het, 'het_han_buyer_ask', n_khach);
end $function$
;

CREATE OR REPLACE FUNCTION public.khu_khop(p_area_kd text, p_ward text, p_district text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
declare v_ward_kd text; v_ward_no text; v_dist_kd text; v_dist_re text;
begin
  if coalesce(p_area_kd, '') = '' then return false; end if;
  v_ward_kd := btrim(regexp_replace(public.bo_dau(coalesce(p_ward, '')), '^phuong\s*', ''));
  v_ward_no := (regexp_match(v_ward_kd, '^([0-9]{1,2})$'))[1];
  v_dist_kd := btrim(public.bo_dau(coalesce(p_district, '')));
  v_dist_re := case
    when v_dist_kd ~ '^(quan|q)\s*\.?\s*[0-9]{1,2}$'
      then '(quan|q)\s*\.?\s*' || (regexp_match(v_dist_kd, '([0-9]{1,2})$'))[1] || '\M'
    when v_dist_kd <> '' then '\m' || v_dist_kd || '\M'
    else null end;
  if p_area_kd ~ '(phuong\s*\.?\s*[0-9]{1,2}|(^|[^a-z0-9])p\.?\s*[0-9]{1,2}(?![0-9]))' then
    return v_ward_no is not null
       and p_area_kd ~ ('(phuong\s*\.?\s*' || v_ward_no || '(?![0-9])|(^|[^a-z0-9])p\.?\s*' || v_ward_no || '(?![0-9]))');
  end if;
  return (v_ward_no is null and v_ward_kd <> '' and p_area_kd ~ ('\m' || v_ward_kd || '\M'))
      or (v_dist_re is not null and p_area_kd ~ v_dist_re);
end $function$
;

CREATE OR REPLACE FUNCTION public.la_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.admins a
     where a.email = ((select auth.jwt()) ->> 'email')
  )
$function$
;

CREATE OR REPLACE FUNCTION public.lan_thu_ke(p_attempts integer)
 RETURNS interval
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select least(interval '30 seconds' * power(2, greatest(p_attempts,1) - 1),
               interval '1 hour') * (0.8 + random() * 0.4);
$function$
;

CREATE OR REPLACE FUNCTION public.liet_ke_bang()
 RETURNS text[]
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select coalesce(array_agg(c.relname order by c.relname), '{}')
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r';
$function$
;

CREATE OR REPLACE FUNCTION public.liet_ke_migration()
 RETURNS TABLE(version text, name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select m.version, m.name
  from supabase_migrations.schema_migrations m
  order by m.version;
$function$
;

CREATE OR REPLACE FUNCTION public.listing_du_dang_tin(p_price_vnd bigint, p_area_m2 numeric, p_ward text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select p_price_vnd is not null
     and p_area_m2  is not null
     and p_ward     is not null and btrim(p_ward) <> '';
$function$
;

CREATE OR REPLACE FUNCTION public.listing_facts_sync_cols()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_txt   text := coalesce(new.answer, '');
  v_num   numeric;
  v_vnd   bigint;
  v_raw   text;
  v_ward  text;
  v_pt    public.property_type;
  j       jsonb;
  -- Bậc nguồn theo FR-164/173: admin nhập tay hoặc CTV trả lời là `admin` (2);
  -- còn lại coi như lời chủ nhà `chu_xac_nhan` (3).
  bac     text := case when new.source ilike 'admin%' or new.source ilike 'ctv%'
                       then 'admin' else 'chu_xac_nhan' end;
  l       listings%rowtype;
  de      boolean;
begin
  select * into l from listings where id = new.listing_id;
  if not found then return null; end if;
  -- Cụm thông số (FR-172): được đè khi bậc của fact ≥ bậc cụm đang giữ.
  de := public.bac_nguon(bac) >= public.bac_nguon(coalesce(l.specs_source, 'boc_mo_ta'));
  j := public.boc_thong_so(v_txt, l.property_type::text);

  if new.question = 'so_phong_ngu' then
    v_num := nullif(substring(v_txt, '[0-9]+'), '')::numeric;
    if v_num is not null and v_num between 1 and 20 then
      update listings set bedrooms = v_num::int, specs_source = bac
       where id = new.listing_id and (bedrooms is null or de);
    end if;

  -- Diện tích đất / diện tích chung. KHÔNG khớp `dien_tich_tim_tuong` (FR-163).
  elsif new.question in ('dien_tich', 'dien_tich_dat') then
    v_num := nullif(substring(replace(v_txt, ',', '.'), '[0-9]+[.]?[0-9]*'), '')::numeric;
    if v_num is not null and v_num > 5 and v_num < 5000 then
      update listings set area_m2 = v_num, specs_source = bac
       where id = new.listing_id and (area_m2 is null or de)
         and area_m2 is distinct from v_num;
    end if;

  -- Tim tường chỉ là diện tích CỦA chung cư; nhà đất thì đó là sàn, không phải đất.
  elsif new.question = 'dien_tich_tim_tuong' then
    if l.property_type = 'chung_cu' then
      v_num := nullif(substring(replace(v_txt, ',', '.'), '[0-9]+[.]?[0-9]*'), '')::numeric;
      if v_num is not null and v_num > 5 and v_num < 5000 then
        update listings set area_m2 = v_num, specs_source = bac
         where id = new.listing_id and (area_m2 is null or de)
           and area_m2 is distinct from v_num;
      end if;
    end if;

  -- Giá: validate bằng parse_vnd, ghi NGUYÊN VĂN đã cắt tiểu từ (20260828d),
  -- bậc riêng `price_source`; trigger `trg_listings_price_vnd` tự tính lại price_vnd.
  elsif new.question = 'gia' then
    v_vnd := public.parse_vnd(v_txt);
    if v_vnd is not null and (
         (l.deal = 'cho_thue' and v_vnd between 1000000 and 10000000000)
      or (l.deal is distinct from 'cho_thue' and v_vnd between 100000000 and 1000000000000)
    ) then
      v_raw := public.chuan_hoa_gia_raw(v_txt);
      update listings set price_raw = v_raw, price_source = bac
       where id = new.listing_id
         and public.bac_nguon(bac) >= public.bac_nguon(price_source)
         and (price_raw is distinct from v_raw or price_source is distinct from bac);
    end if;

  elsif new.question = 'phuong' then
    v_ward := public.chuan_hoa_phuong(v_txt);
    if v_ward is not null then
      update listings set ward = v_ward, ward_source = bac
       where id = new.listing_id
         and public.bac_nguon(bac) >= public.bac_nguon(ward_source)
         and (ward is distinct from v_ward or ward_source is distinct from bac);
    end if;

  elsif new.question = 'loai_bds' then
    v_pt := public.guess_property_type_answer(v_txt);
    if v_pt is not null then
      update listings set property_type = v_pt, property_type_source = bac
       where id = new.listing_id
         and public.bac_nguon(bac) >= public.bac_nguon(property_type_source)
         and (property_type is distinct from v_pt or property_type_source is distinct from bac);
    end if;

  elsif new.question = 'tang' then
    v_num := nullif(substring(v_txt, '[0-9]+'), '')::numeric;
    if v_num is not null and v_num between 0 and 80 and not (j ? 'floors') then
      update listings set floor = v_num::int, specs_source = bac
       where id = new.listing_id and (floor is null or de);
    end if;
  elsif new.question = 'huong' and not (j ? 'direction') and length(btrim(v_txt)) between 2 and 40 then
    update listings set direction = btrim(v_txt), specs_source = bac
     where id = new.listing_id and (direction is null or de);
  elsif new.question in ('do_rong_hem', 'do_rong_duong') and not (j ? 'alley_width_m') then
    v_num := nullif(substring(replace(v_txt, ',', '.'), '[0-9]+[.]?[0-9]*'), '')::numeric;
    if v_num is not null and v_num between 1 and 40 then
      update listings set alley_width_m = v_num,
             access_type = coalesce(access_type, case when v_num >= 6 then 'hem_xe_tai' when v_num >= 3.5 then 'hem_xe_hoi' else 'hem_xe_may' end),
             specs_source = bac
       where id = new.listing_id and (alley_width_m is null or de);
    end if;
  elsif new.question = 'quy_hoach' and not (j ? 'planning_status') and public.bo_dau(v_txt) ~ '(khong|ko|k co|k dinh)' then
    update listings set planning_status = 'khong_quy_hoach', specs_source = bac
     where id = new.listing_id and (planning_status is null or de);
  elsif new.question = 'nam_xay' and not (j ? 'year_built') then
    v_num := nullif(substring(v_txt, '(?:19|20)[0-9]{2}'), '')::numeric;
    if v_num is not null then
      update listings set year_built = v_num::int, specs_source = bac
       where id = new.listing_id and (year_built is null or de);
    end if;
  elsif new.question = 'noi_that' and not (j ? 'furnishing') then
    update listings set furnishing = case when public.bo_dau(v_txt) ~ '(full|day du|cao cap)' then 'full'
                                          when public.bo_dau(v_txt) ~ '(khong|trong|ko)' then 'khong'
                                          when public.bo_dau(v_txt) ~ '(co ban)' then 'co_ban' end, specs_source = bac
     where id = new.listing_id and (furnishing is null or de)
       and public.bo_dau(v_txt) ~ '(full|day du|cao cap|khong|trong|ko|co ban)';
  elsif new.question = 'mat_tien' and not (j ? 'frontage_m') then
    v_num := nullif(substring(replace(v_txt, ',', '.'), '[0-9]+[.]?[0-9]*'), '')::numeric;
    if v_num is not null and v_num between 1.5 and 40 then
      update listings set frontage_m = v_num, specs_source = bac
       where id = new.listing_id and (frontage_m is null or de);
    end if;
  end if;

  perform public.ap_thong_so(new.listing_id, j, bac, de);
  return null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.listing_media_chon_bia(p_listing_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if exists (select 1 from listing_media where listing_id = p_listing_id and is_cover) then
    return;
  end if;
  select id into v_id from listing_media
   where listing_id = p_listing_id and bucket = 'listing-public'
   order by sort_order, created_at, id limit 1;
  if v_id is not null then
    update listing_media set is_cover = true where id = v_id;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_media_giu_bia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.listing_media_chon_bia(coalesce(new.listing_id, old.listing_id));
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.listing_media_xep_hang_don()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'DELETE' then
    insert into media_cleanup_queue (bucket, storage_path)
    values (old.bucket, old.storage_path);
    return old;
  end if;
  if old.bucket is distinct from new.bucket
     or old.storage_path is distinct from new.storage_path then
    insert into media_cleanup_queue (bucket, storage_path)
    values (old.bucket, old.storage_path);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.listings_autopublish()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.listings_try_publish(new.id);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.listings_bao_can_da_chot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'da_chot' and old.status is distinct from 'da_chot' then
    begin
      perform public.bao_can_da_chot(new.id);
    exception when others then
      perform public.log_loi('bao_can_da_chot', left(sqlerrm, 400), null::integer);
    end;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.listings_bao_tin_moi_khop()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'dang_ban'
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and (tg_op = 'INSERT' or old.status not in ('dang_ban', 'dang_quan_tam'))
     and new.price_vnd is not null and new.ward is not null then
    begin
      perform public.bao_tin_moi_khop(new.id);
    exception when others then
      perform public.log_loi('bao_tin_moi_khop', left(sqlerrm, 400), null::integer);
    end;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.listings_boc_thong_so()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  j jsonb;
  de boolean;
  co boolean := false;
begin
  if new.street is null then new.street := public.boc_ten_duong(new.location_raw); end if;
  if new.description is null then return new; end if;
  de := tg_op = 'UPDATE' and new.description is distinct from old.description
        and coalesce(new.specs_source, 'boc_mo_ta') = 'boc_mo_ta';
  j := public.boc_thong_so(new.description, new.property_type::text);

  if j ? 'frontage_m'           and (de or new.frontage_m is null)           then new.frontage_m := (j->>'frontage_m')::numeric; co := true; end if;
  if j ? 'length_m'             and (de or new.length_m is null)             then new.length_m := (j->>'length_m')::numeric; co := true; end if;
  if j ? 'rear_width_m'         and (de or new.rear_width_m is null)         then new.rear_width_m := (j->>'rear_width_m')::numeric; co := true; end if;
  if j ? 'legal_area_m2'        and (de or new.legal_area_m2 is null)        then new.legal_area_m2 := (j->>'legal_area_m2')::numeric; co := true; end if;
  if j ? 'built_area_m2'        and (de or new.built_area_m2 is null)        then new.built_area_m2 := (j->>'built_area_m2')::numeric; co := true; end if;
  if j ? 'floors'               and (de or new.floors is null)               then new.floors := (j->>'floors')::int; new.floors_text := j->>'floors_text'; co := true; end if;
  if j ? 'floor'                and (de or new.floor is null)                then new.floor := (j->>'floor')::int; co := true; end if;
  if j ? 'bedrooms'             and (de or new.bedrooms is null)             then new.bedrooms := (j->>'bedrooms')::int; co := true; end if;
  if j ? 'bathrooms'            and (de or new.bathrooms is null)            then new.bathrooms := (j->>'bathrooms')::int; co := true; end if;
  if j ? 'access_type'          and (de or new.access_type is null)          then new.access_type := j->>'access_type'; co := true; end if;
  if j ? 'alley_width_m'        and (de or new.alley_width_m is null)        then new.alley_width_m := (j->>'alley_width_m')::numeric; co := true; end if;
  if j ? 'distance_to_street_m' and (de or new.distance_to_street_m is null) then new.distance_to_street_m := (j->>'distance_to_street_m')::numeric; co := true; end if;
  if j ? 'legal_status'         and (de or new.legal_status is null)         then new.legal_status := j->>'legal_status'; co := true; end if;
  if j ? 'has_completion'       and (de or new.has_completion is null)       then new.has_completion := (j->>'has_completion')::boolean; co := true; end if;
  if j ? 'planning_status'      and (de or new.planning_status is null)      then new.planning_status := j->>'planning_status'; co := true; end if;
  if j ? 'has_elevator'         and (de or new.has_elevator is null)         then new.has_elevator := true; co := true; end if;
  if j ? 'car_in_house'         and (de or new.car_in_house is null)         then new.car_in_house := true; co := true; end if;
  if j ? 'corner_lot'           and (de or new.corner_lot is null)           then new.corner_lot := true; co := true; end if;
  if j ? 'furnishing'           and (de or new.furnishing is null)           then new.furnishing := j->>'furnishing'; co := true; end if;
  if j ? 'year_built'           and (de or new.year_built is null)           then new.year_built := (j->>'year_built')::int; co := true; end if;
  if j ? 'direction'            and (de or new.direction is null)            then new.direction := j->>'direction'; co := true; end if;
  if j ? 'negotiable'           and (de or new.negotiable is null)           then new.negotiable := (j->>'negotiable')::boolean; co := true; end if;
  if j ? 'rent_income_vnd' and new.deal = 'ban' and (de or new.rent_income_vnd is null) then new.rent_income_vnd := (j->>'rent_income_vnd')::bigint; co := true; end if;

  if co and new.specs_source is null then new.specs_source := 'boc_mo_ta'; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.listings_chuan_hoa_cot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.price_raw := public.chuan_hoa_gia_raw(new.price_raw);
  new.ward      := public.chuan_hoa_phuong(new.ward);
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.listings_fill_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := public.next_listing_code();
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.listings_fill_property_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  g public.property_type;
begin
  if new.property_type is null or new.property_type = 'chua_ro' then
    g := public.guess_property_type(
      coalesce(new.description, '') || ' ' || coalesce(new.location_raw, '')
    );
    if g is not null then
      new.property_type := g;
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.listings_normalize_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.status := case coalesce(new.status, 'cho_thong_tin')
    when 'unverified'     then 'cho_thong_tin'
    when 'draft'          then 'cho_thong_tin'
    when 'pending_review' then 'cho_thong_tin'
    when 'active'         then 'dang_ban'
    when 'negotiating'    then 'dang_quan_tam'
    when 'sold'           then 'da_chot'
    when 'expired'        then 'an'
    when 'hidden'         then 'an'
    else new.status end;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.listings_quyet_dinh_dang_tin()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_du boolean := public.listing_du_dang_tin(new.price_vnd, new.area_m2, new.ward);
begin
  if v_du and new.status = 'cho_thong_tin' then
    new.status := 'dang_ban';
  elsif not v_du and new.status = 'dang_ban' then
    new.status := 'cho_thong_tin';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.listings_set_price_vnd()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.price_vnd := public.parse_vnd(new.price_raw);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.listings_try_publish(p_listing_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.listings set id = id where id = p_listing_id;
$function$
;

CREATE OR REPLACE FUNCTION public.log_loi(p_source text, p_detail text, p_code integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_src text := left(coalesce(nullif(trim(p_source), ''), 'khong_ro'), 40);
  v_nguon int;
  v_tong int;
  v_noi_bo boolean := coalesce(auth.role(), '') = 'service_role'
                      or current_user in ('postgres', 'supabase_admin');
begin
  select count(*) filter (where source = v_src), count(*)
    into v_nguon, v_tong
    from bot_errors where at > now() - interval '1 hour';
  if v_nguon >= 20 then return; end if;
  if not v_noi_bo and v_tong >= 200 then return; end if;
  insert into bot_errors (source, status_code, detail)
  values (v_src, p_code, left(public.che_sdt(coalesce(p_detail, '')), 500));
end $function$
;

CREATE OR REPLACE FUNCTION public.mark_listing_interest(p_codes text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  n int;
begin
  update public.listings
  set status = 'dang_quan_tam', last_interest_at = now()
  where code = any(p_codes) and status in ('dang_ban', 'dang_quan_tam');
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.mark_listing_interest(p_codes text[], p_buyer_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare n int;
begin
  n := public.mark_listing_interest(p_codes);
  if p_buyer_id is not null then
    insert into interests (buyer_id, listing_id)
    select p_buyer_id, l.id from listings l
     where l.code = any(p_codes) and l.status in ('dang_ban', 'dang_quan_tam', 'da_chot')
    on conflict (buyer_id, listing_id) do nothing;
  end if;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.match_projects(p_text text)
 RETURNS SETOF projects
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select * from projects
  where length(name) >= 4 and position(lower(name) in lower(p_text)) > 0
  order by priority asc, name limit 2;
$function$
;

CREATE OR REPLACE FUNCTION public.media_cleanup_giu_trang_thai()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if old.trang_thai = 'xong' and new.trang_thai is distinct from 'xong' then
    raise exception 'media_cleanup_queue: da xong thi khong lui trang thai';
  end if;
  -- Chi tu dong dong dau thoi gian khi NGUOI GOI khong tu dat. Ep cung
  -- now() thi khong ai lui duoc updated_at, ma do la thu duy nhat quyet dinh
  -- bao gio mot viec 'loi' duoc nhan lai -- khong kiem thu duoc, cung khong
  -- van hanh duoc (muon thu lai ngay thi chiu).
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.media_cleanup_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not exists (
    select 1 from public.media_cleanup_queue
     where (trang_thai = 'cho'
            or (trang_thai in ('dang_lam','loi') and updated_at < now() - interval '10 minutes'))
       and attempts < 6
       and coalesce(next_retry_at, '-infinity'::timestamptz) <= now())
  then return; end if;

  perform net.http_post(
    url := public.cau_hinh('functions_base_url') || '/media-cleanup',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || public.cau_hinh('publishable_key'),
      'x-bridge-secret', public.get_secret('BRIDGE_SECRET')),
    body := '{}'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.merge_buyer_prefs(p_buyer_id uuid, p_delta jsonb)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update buyers
     set preferences = coalesce(preferences, '{}'::jsonb) || coalesce(p_delta, '{}'::jsonb)
   where id = p_buyer_id;
$function$
;

CREATE OR REPLACE FUNCTION public.messages_bump_last_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update conversations
     set last_message_at = greatest(coalesce(last_message_at, '-infinity'::timestamptz), new.created_at)
   where id = new.conversation_id;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.mo_ho_so_nguoi_ban(p_zalo_user_id text, p_seller_type seller_type DEFAULT 'ccrb'::seller_type)
 RETURNS TABLE(id uuid, name text, active_listing_id uuid, seller_type seller_type)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into sellers (zalo_user_id, seller_type)
  values (p_zalo_user_id, coalesce(p_seller_type, 'ccrb'))
  on conflict (zalo_user_id) do update
    set seller_type = case
      when sellers.seller_type = 'unknown' then excluded.seller_type
      else sellers.seller_type
    end
  returning sellers.id, sellers.name, sellers.active_listing_id, sellers.seller_type;
$function$
;

CREATE OR REPLACE FUNCTION public.mo_viec_can_nguoi_that(p_buyer_id uuid, p_ctv_id uuid, p_note text, p_voice boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  da int;
begin
  if p_buyer_id is null then
    raise exception 'p_buyer_id khong duoc null' using errcode = '22004';
  end if;

  perform pg_advisory_xact_lock(hashtext('escalation_nguoi_that'), hashtext(p_buyer_id::text));

  if p_voice then
    select count(*) into da from public.reminders
     where buyer_id = p_buyer_id
       and kind = 'escalation'
       and status in ('pending', 'sent')
       and note ilike 'VOICE:%'
       and created_at > now() - interval '24 hours';
  else
    select count(*) into da from public.reminders
     where buyer_id = p_buyer_id
       and kind = 'escalation'
       and status = 'pending';
  end if;

  if da > 0 then
    return false;
  end if;

  insert into public.reminders (kind, buyer_id, ctv_id, due_at, note)
  values ('escalation', p_buyer_id, p_ctv_id, now(), p_note);
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.next_listing_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_code text;
begin
  -- Advisory lock, KHONG `lock table`: ham nay chay trong trigger BEFORE INSERT,
  -- luc do transaction da giu ROW EXCLUSIVE tren listings. Xin them
  -- SHARE ROW EXCLUSIVE la nang cap khoa -> hai insert dong thoi deadlock.
  perform pg_advisory_xact_lock(hashtext('listing_code'));

  select 'BDS-Q5-' || lpad(
           (coalesce(max((regexp_match(code, '^BDS-Q5-([0-9]+)$'))[1]::int), 0) + 1)::text,
           4, '0')
    into v_code
    from listings
   where code ~ '^BDS-Q5-[0-9]+$';

  return v_code;
end $function$
;

CREATE OR REPLACE FUNCTION public.nguoi_noi_bo(p_zalo text)
 RETURNS TABLE(vai text, id uuid, name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select 'ctv'::text, c.id, c.name from ctvs c
   where c.active and c.zalo_user_id = p_zalo
  union all
  select 'admin'::text, null::uuid, coalesce(a.email, 'admin') from admins a
   where a.zalo_user_id = p_zalo
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.nha_luot_gui(p_msg_id text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  update public.inbound_ledger
     set sending_until = null, updated_at = now()
   where zalo_msg_id = p_msg_id;
$function$
;

CREATE OR REPLACE FUNCTION public.nha_viec_nhac(p_id uuid, p_worker text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update reminders
     set locked_at = null,
         locked_by = null,
         attempts  = greatest(attempts - 1, 0)
   where id = p_id
     and status = 'pending'
     and (p_worker is null or locked_by = p_worker);
  if not found then return 'khong_co'; end if;
  return 'da_nha';
end $function$
;

CREATE OR REPLACE FUNCTION public.nhan_viec_don_media(p_limit integer DEFAULT 50)
 RETURNS SETOF media_cleanup_queue
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.media_cleanup_queue q
     set trang_thai='dang_lam', attempts=q.attempts+1, updated_at=now()
   where q.id in (
     select id from public.media_cleanup_queue
      where (trang_thai='cho'
             or (trang_thai in ('dang_lam','loi') and updated_at < now() - interval '10 minutes'))
        and attempts < 6
        and coalesce(next_retry_at, '-infinity'::timestamptz) <= now()
      order by created_at limit p_limit for update skip locked)
  returning q.*;
$function$
;

CREATE OR REPLACE FUNCTION public.nhan_viec_nhac(p_kinds text[], p_limit integer DEFAULT 20, p_worker text DEFAULT NULL::text)
 RETURNS SETOF reminders
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  update public.reminders r
     set locked_at = now(), locked_by = p_worker, attempts = r.attempts + 1
   where r.id in (
     select id from public.reminders
      where status='pending' and kind = any(p_kinds) and due_at <= now()
        and (locked_at is null or locked_at < now() - interval '5 minutes')
        and coalesce(next_retry_at, '-infinity'::timestamptz) <= now()
      order by due_at limit p_limit for update skip locked)
  returning r.*;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_info_request_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_code   text;
  v_seller uuid;
  v_hoi    text;
begin
  if coalesce(new.question, '') in ('xac_nhan_lich', 'con_ban') then return new; end if;  -- 20260904f

  select l.code, l.seller_id into v_code, v_seller from listings l where l.id = new.listing_id;
  v_hoi := coalesce(new.question, 'thông tin');

  if new.assignee = 'admin' then
    insert into reminders (kind, listing_id, due_at, note)
    values ('escalation', new.listing_id, now(),
      '❓ Khách hỏi căn #' || coalesce(v_code, '?') || ': "' || v_hoi
      || '" — không có CTV nào đang hoạt động. Admin hỏi chủ rồi nhắn bot "#'
      || coalesce(v_code, '?') || ': câu trả lời".');

  elsif new.assignee = 'ctv' then
    if new.source = 'buyer_ask' then
      insert into reminders (kind, listing_id, ctv_id, due_at, note)
      values ('escalation', new.listing_id, new.ctv_id, now(),
        'khách hỏi #' || coalesce(v_code, '?') || ': "' || v_hoi
        || '". Anh/chị hỏi chủ rồi nhắn lại em theo mẫu "#' || coalesce(v_code, '?')
        || ': câu trả lời" trong ' || public.ctv_sla_phut() || ' phút nha, em báo khách liền.');
    else
      insert into reminders (kind, listing_id, ctv_id, due_at, note)
      values ('escalation', new.listing_id, new.ctv_id, now(),
        'khách hỏi #' || coalesce(v_code, '?') || ' · cần: ' || v_hoi
        || ' · tin không có chính chủ trên hệ thống → giao ctv');
    end if;

  elsif new.assignee = 'seller' and v_seller is not null then
    insert into reminders (kind, listing_id, seller_id, due_at, note)
    values ('escalation', new.listing_id, v_seller, now(),
      'khách đang quan tâm căn #' || coalesce(v_code, '?') || ' của mình, cần bổ sung: ' || v_hoi);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.nudge_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  perform net.http_post(
    url := public.cau_hinh('functions_base_url') || '/nudge',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer sb_publishable_zmJBmEgFPn3bBKx_1ve6Pg_dXdo4haX',
      'x-bridge-secret', public.get_secret('BRIDGE_SECRET')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000);
end $function$
;

CREATE OR REPLACE FUNCTION public.parse_vnd(p text)
 RETURNS bigint
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  t    text;
  m    text[];
  v    numeric;
  ruoi boolean;
begin
  if p is null or btrim(p) = '' then return null; end if;
  t := lower(p);
  ruoi := t ~ 'rưỡi|rươi|ruoi';

  t := regexp_replace(t, 'tỏi|tỷ|tỉ|tị|tỹ', ' _ty ', 'g');
  t := regexp_replace(t, 'triệu|trieu|củ',  ' _trieu ', 'g');

  t := regexp_replace(t, '([0-9])\s*ty\s*([0-9])', '\1 _ty \2', 'g');
  t := regexp_replace(t, '([0-9])\s*t\s*([0-9])',  '\1 _ty \2', 'g');
  t := regexp_replace(t, '([0-9])\s*ty\M',         '\1 _ty ',   'g');
  t := regexp_replace(t, '([0-9])\s*tr\M',         '\1 _trieu ', 'g');

  -- Phan le sau don vi: "5 ty 5" = 5,5 ty | "3 ty 200" = 3,2 ty.
  -- Chan hai kieu bat nham: "5 ty 50m2" (dien tich) va viec cat bot chu so
  -- ("50" bi lui ve "5" cho khop) — nen cam ca chu so lan m dung ngay sau.
  m := regexp_match(t, '([0-9]+)\s*_ty\s*([0-9]{1,3})(?![0-9.,]|\s*m)');
  if m is not null then
    return (m[1]::numeric * 1e9
            + case when length(m[2]) = 1
                   then m[2]::numeric * 1e8
                   else m[2]::numeric * 1e6 end)::bigint;
  end if;

  m := regexp_match(t, '([0-9]+[.,]?[0-9]*)\s*_ty');
  if m is not null then
    v := replace(m[1], ',', '.')::numeric * 1e9;
    if ruoi then v := v + 5e8; end if;
    return v::bigint;
  end if;

  m := regexp_match(t, '([0-9]+[.,]?[0-9]*)\s*_trieu');
  if m is not null then
    v := replace(m[1], ',', '.')::numeric * 1e6;
    if ruoi then v := v + 5e5; end if;
    return v::bigint;
  end if;

  return null;
exception when others then
  return null;
end
$function$
;

CREATE OR REPLACE FUNCTION public.reminders_email_voice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid text; v_ten text;
begin
  if new.kind = 'escalation' and new.note like 'VOICE:%' then
    if new.buyer_id is not null then
      select b.zalo_user_id, b.name into v_uid, v_ten from buyers b where b.id = new.buyer_id;
    end if;
    perform public.email_admin('VOICE', v_uid,
      'Khách: ' || coalesce(v_ten, '(chưa biết tên)') || E'\n' || left(new.note, 500), new.listing_id);
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.reminders_giu_trang_thai_ket()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if old.status in ('sent','cancelled','dead')
     and new.status is distinct from old.status then
    new.status  := old.status;
    new.sent_at := old.sent_at;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.reminders_hen_hoi_cam_nhan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v record;
begin
  if new.kind = 'viewing' and new.status = 'sent' and old.status is distinct from 'sent'
     and new.buyer_id is not null then
    begin
      select vw.slot, vw.listing_id, l.code
        into v
        from viewings vw left join listings l on l.id = vw.listing_id
       where vw.id = new.viewing_id;
      insert into reminders (kind, buyer_id, listing_id, viewing_id, due_at, note)
      values ('feedback', new.buyer_id, v.listing_id, new.viewing_id,
              coalesce(v.slot, new.due_at + interval '45 minutes') + interval '4 hours',
              'hỏi cảm nhận sau khi xem ' || coalesce('#' || v.code, 'nhà'))
      on conflict (viewing_id) where kind = 'feedback' and viewing_id is not null do nothing;
    exception when others then
      perform public.log_loi('reminders_hen_hoi_cam_nhan', left(sqlerrm, 400), null::integer);
    end;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.route_info_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_seller_zalo text;
  v_ctv ctvs%rowtype;
begin
  if new.assignee is not null then return new; end if;

  if coalesce(new.source, '') <> 'buyer_ask' then
    select s.zalo_user_id into v_seller_zalo
    from listings l join sellers s on s.id = l.seller_id
    where l.id = new.listing_id;
    if v_seller_zalo is not null then
      new.assignee := 'seller';
      return new;
    end if;
  end if;

  select * into v_ctv from ctvs
  where active and (zalo_user_id is not null or phone is not null)
  order by last_assigned_at nulls first, created_at
  limit 1;

  if found then
    new.assignee := 'ctv';
    new.ctv_id := v_ctv.id;
    update ctvs set last_assigned_at = now() where id = v_ctv.id;
    if new.source = 'buyer_ask' then
      new.sla_due_at := now() + make_interval(mins => public.ctv_sla_phut());
    end if;
  else
    new.assignee := 'admin';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.seller_drip_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; n int := 0;
begin
  for r in
    with asked as (
      select l2.seller_id, count(distinct q.listing_id) as c
      from info_requests q join listings l2 on l2.id = q.listing_id
      where q.created_at > now() - interval '24 hours'
      group by l2.seller_id
    ),
    cand as (
      select l.id, l.seller_id, l.created_at, coalesce(a.c, 0) as asked24,
             row_number() over (partition by l.seller_id order by l.created_at desc) as rn
      from listings l
      join sellers s on s.id = l.seller_id
      left join asked a on a.seller_id = l.seller_id
      where l.status = 'cho_thong_tin'
        and (s.zalo_user_id is not null or l.created_at > now() - interval '7 days')
        and exists (select 1 from listing_missing_facts m where m.listing_id = l.id)
        and not exists (select 1 from info_requests q
                          where q.listing_id = l.id and q.status = 'pending')
        and (select count(*) from info_requests q
               where q.listing_id = l.id and q.created_at > now() - interval '24 hours') < 3
    )
    -- rn + asked24 <= 2: một người bán không bị hỏi quá 2 căn trong 24h
    select id from cand where rn + asked24 <= 2 order by created_at desc limit 10
  loop
    perform ask_seller_drip(r.id);
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.seller_rank(p_type seller_type, p_active integer, p_closed integer, p_total integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case
    when p_type = 'nmg' then case
      when p_active >= 10 and p_total > 0 and p_closed::numeric / p_total >= 0.05 then 'vang'
      when p_active >= 5  or  p_closed >= 1                                        then 'bac'
      else 'dong'
    end
    else case
      when p_closed >= 1 then 'vang'
      when p_active >= 1 then 'bac'
      else 'dong'
    end
  end;
$function$
;

CREATE OR REPLACE FUNCTION public.stale_listing_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; n int := 0; v_ir uuid; v_assignee text; v_ctv uuid;
begin
  for r in
    select l.id, l.code, l.seller_id, s.zalo_user_id as seller_zalo
      from listings l join sellers s on s.id = l.seller_id
     where l.status = 'dang_ban'
       and l.updated_at < now() - interval '30 days'
       and not exists (select 1 from property_events e
                        where e.listing_id = l.id and e.at > now() - interval '30 days')
       and not exists (select 1 from info_requests q
                        where q.listing_id = l.id and q.question = 'con_ban'
                          and q.created_at > now() - interval '30 days')
     order by l.updated_at
     limit 5
  loop
    insert into info_requests (listing_id, question, status, source)
    values (r.id, 'con_ban', 'pending', 'seller_flow')
    returning id, assignee, ctv_id into v_ir, v_assignee, v_ctv;
    if v_assignee = 'seller' then
      insert into reminders (kind, listing_id, seller_id, due_at, note)
      values ('escalation', r.id, r.seller_id, now(),
        'tin #' || coalesce(r.code, '?') || ' của mình đăng đã hơn 30 ngày. Nhà mình còn bán không ạ? Còn thì anh/chị nhắn "còn" giúp em, em giữ tin và tiếp tục tìm khách');
    else
      insert into reminders (kind, listing_id, ctv_id, due_at, note)
      values ('escalation', r.id, v_ctv, now(),
        'tin #' || coalesce(r.code, '?') || ' đăng đã 30 ngày không có khách hỏi. Anh/chị hỏi chủ nhà còn bán không rồi nhắn lại em "#' || coalesce(r.code, '?') || ': còn bán" hoặc "#' || coalesce(r.code, '?') || ': đã bán" nha');
    end if;
    n := n + 1;
  end loop;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.tao_danh_sach(p_listing_codes text[], p_title text DEFAULT NULL::text, p_buyer_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_codes text[];
  v_ids   uuid[];
  v_thieu text[];
  v_row   public.curated_lists;
begin
  if auth.role() <> 'service_role' and not public.la_admin() then
    raise exception 'Khong co quyen quan tri' using errcode = '42501';
  end if;

  select array_agg(distinct upper(btrim(x))) into v_codes
    from unnest(coalesce(p_listing_codes, '{}')) as x
   where btrim(x) <> '';
  if v_codes is null or cardinality(v_codes) = 0 then
    raise exception 'Danh sach ma tin rong';
  end if;
  if cardinality(v_codes) > 60 then
    raise exception 'Toi da 60 tin mot danh sach';
  end if;

  select array_agg(l.id order by x.ord) into v_ids
    from unnest(v_codes) with ordinality as x(code, ord)
    join public.listings l on l.code = x.code;
  select array_agg(x.code) into v_thieu
    from unnest(v_codes) as x(code)
   where not exists (select 1 from public.listings l where l.code = x.code);
  if v_thieu is not null then
    raise exception 'Khong co tin: %', array_to_string(v_thieu, ', ');
  end if;

  insert into public.curated_lists (buyer_id, listing_ids, title)
  values (p_buyer_id, v_ids, nullif(btrim(p_title), ''))
  returning * into v_row;

  return jsonb_build_object(
    'token', v_row.token,
    'path', '/ds/' || v_row.token,
    'expires_at', v_row.expires_at,
    'n', cardinality(v_ids)
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.tao_followup(p_buyer_id uuid, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_listing uuid; v_id uuid;
begin
  select id into v_listing from listings where code = p_code;
  if v_listing is null then return false; end if;
  if exists (select 1 from reminders
              where buyer_id = p_buyer_id and kind = 'followup'
                and status in ('pending','sent')
                and created_at > now() - interval '24 hours') then
    return false;
  end if;
  insert into reminders (kind, buyer_id, listing_id, due_at, note)
  values ('followup', p_buyer_id, v_listing, now() + interval '150 minutes',
          'khách hỏi #' || p_code || ' rồi im — chủ động gửi thêm thông tin căn này')
  returning id into v_id;
  return v_id is not null;
end $function$
;

CREATE OR REPLACE FUNCTION public.thu_muc_dau_uuid(p_name text)
 RETURNS uuid
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
    else null end
$function$
;

CREATE OR REPLACE FUNCTION public.tin_cua_toi(p_listing uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
      from public.listings l
      join public.sellers s on s.id = l.seller_id
     where l.id = p_listing
       and s.auth_user_id = (select auth.uid())
  )
$function$
;

CREATE OR REPLACE FUNCTION public.trg_listing_drip()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.seller_id is not null and new.status = 'cho_thong_tin' then
    perform ask_seller_drip(new.id);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.trg_property_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_listing uuid;
begin
  if tg_table_name = 'listing_views' then
    perform public.ghi_su_kien_bds(new.listing_id, 'view', null, jsonb_build_object('auth_user_id', new.auth_user_id));
  elsif tg_table_name = 'interests' then
    perform public.ghi_su_kien_bds(new.listing_id, 'interest', new.buyer_id, null);
  elsif tg_table_name = 'info_requests' then
    if new.source = 'buyer_ask' and coalesce(new.question, '') <> 'xac_nhan_lich' then
      perform public.ghi_su_kien_bds(new.listing_id, 'asked', new.buyer_id, jsonb_build_object('question', left(new.question, 200)));
    end if;
  elsif tg_table_name = 'viewings' then
    v_listing := new.listing_id;
    if v_listing is null and new.listing_code is not null then
      select id into v_listing from listings where code = new.listing_code;
    end if;
    perform public.ghi_su_kien_bds(v_listing, 'viewing', new.buyer_id,
      jsonb_build_object('viewing_id', new.id, 'slot', new.slot, 'time_text', new.time_text));
  elsif tg_table_name = 'deals' then
    perform public.ghi_su_kien_bds(new.listing_id, 'deal', new.buyer_id, jsonb_build_object('deal_id', new.id, 'price_vnd', new.price_vnd));
  elsif tg_table_name = 'reminders' then
    if new.kind = 'match' and new.status = 'sent' and old.status is distinct from 'sent' then
      perform public.ghi_su_kien_bds(new.listing_id, 'match_sent', new.buyer_id, jsonb_build_object('reminder_id', new.id));
    end if;
  elsif tg_table_name = 'listings' then
    if tg_op = 'UPDATE' and old.status is distinct from new.status then
      perform public.ghi_su_kien_bds(new.id, 'status', null, jsonb_build_object('tu', old.status, 'den', new.status));
    end if;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.viec_inbound_bo_roi(p_limit integer DEFAULT 20)
 RETURNS TABLE(event_id text, ly_do text, attempts integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select e.event_id,
         case when l.zalo_msg_id is null then 'chua_co_job'
              when l.status = 'completed' and l.sent_at is null then 'chua_gui'
              else 'job_do_dang' end,
         coalesce(l.attempts, 0)
    from inbound_events e
    left join inbound_ledger l on l.zalo_msg_id = e.event_id
   where e.first_seen_at > now() - interval '24 hours'
     and (l.zalo_msg_id is null
          or l.status in ('received','failed')
          or (l.status = 'processing' and l.updated_at < now() - interval '150 seconds')
          or (l.status = 'completed'
              and l.sent_at is null
              and coalesce(jsonb_array_length(l.reply -> 'replies'), 0) > coalesce(l.sent_bubbles, 0)))
     and coalesce(l.next_retry_at, '-infinity'::timestamptz) <= now()
     and coalesce(l.status, '') <> 'dead'
   order by e.first_seen_at limit p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.viewings_bao_ctv_va_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_listing uuid; v_code text; v_ctv uuid; v_uid text; v_ten text; v_gio text; v_note text;
begin
  v_listing := new.listing_id;
  if v_listing is null and new.listing_code is not null then
    select id into v_listing from listings where code = new.listing_code;
  end if;
  select code into v_code from listings where id = v_listing;
  v_code := coalesce(v_code, new.listing_code, '?');
  select b.zalo_user_id, b.name into v_uid, v_ten from buyers b where b.id = new.buyer_id;
  select c.ctv_id into v_ctv from conversations c
   where c.buyer_id = new.buyer_id and c.ctv_id is not null
   order by c.started_at desc limit 1;
  if v_ctv is not null and not exists (select 1 from ctvs where id = v_ctv and active) then
    v_ctv := null;
  end if;
  v_gio := coalesce(to_char(new.slot at time zone 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM'), new.time_text, '?');

  -- (a) nhắc CTV/admin ngay
  begin
    v_note := 'Lịch xem #' || v_code || ' · ' || v_gio || ' · khách ' || coalesce(v_ten, '(chưa biết tên)')
           || ', xác nhận với chủ nhà rồi nhắn lại em "#' || v_code || ': ok ' || coalesce(to_char(new.slot at time zone 'Asia/Ho_Chi_Minh', 'HH24"h"'), 'giờ') || '" nha';
    insert into reminders (kind, buyer_id, listing_id, viewing_id, ctv_id, due_at, note)
    values ('escalation', new.buyer_id, v_listing, new.id, v_ctv, now(), v_note);
  exception when others then
    perform public.log_loi('viewings_bao_ctv', left(sqlerrm, 400), null::integer);
  end;

  -- (b) câu xác nhận lịch — assignee đặt sẵn nên `route_info_request` không
  --     đụng; sla_due_at theo CTV để `info_request_sla_tick` leo thang nếu 2h
  --     chưa ai xác nhận.
  if v_listing is not null and new.buyer_id is not null and new.status in ('proposed', 'pending') then
    begin
      insert into info_requests (listing_id, buyer_id, question, status, source, assignee, ctv_id, sla_due_at)
      values (v_listing, new.buyer_id, 'xac_nhan_lich', 'pending', 'buyer_ask',
              case when v_ctv is null then 'admin' else 'ctv' end, v_ctv,
              case when v_ctv is null then null else now() + make_interval(mins => public.ctv_sla_phut()) end);
    exception when others then
      perform public.log_loi('viewings_xac_nhan_lich', left(sqlerrm, 400), null::integer);
    end;
  end if;

  -- (c) email [VIEWING] (FR-57/81)
  perform public.email_admin('VIEWING', v_uid,
    'Khách: ' || coalesce(v_ten, '(chưa biết tên)') || E'\nGiờ hẹn: ' || v_gio
    || coalesce(E'\nSĐT khách: ' || new.phone, '') || E'\nTrạng thái: ' || new.status, v_listing);
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.xuat_schema()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  o text;
  p text;
begin
  if not (coalesce(auth.role(), '') = 'service_role'
          or current_user in ('postgres', 'supabase_admin')) then
    raise exception 'Chi service_role duoc xuat schema' using errcode = '42501';
  end if;

  o := '-- Ảnh chụp schema `public` + `storage` của project nhadat-cc.' || E'\n'
    || '-- SINH TỰ ĐỘNG bởi public.xuat_schema() — ĐỪNG SỬA TAY.' || E'\n'
    || '-- Sinh lại: node scripts/sao-luu.mjs (ghi đè file này).' || E'\n'
    || '-- Đây là lưới an toàn để dựng lại từ số không, KHÔNG thay cho migration:' || E'\n'
    || '-- thay đổi schema vẫn phải đi qua một file trong bot/supabase/migrations/.' || E'\n'
    || '-- Sinh lúc: '
    || to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI')
    || ' (giờ VN)' || E'\n';

  select coalesce(string_agg(
           format('create extension if not exists %I with schema %I;', e.extname, n.nspname),
           E'\n' order by e.extname), '')
    into p
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname <> 'plpgsql';
  o := o || E'\n-- ══ Extension ══\n' || p || E'\n';

  select coalesce(string_agg(
           format(E'do $d$ begin\n  create type public.%I as enum (%s);\nexception when duplicate_object then null; end $d$;',
                  x.typname, x.vals),
           E'\n' order by x.typname), '')
    into p
  from (
    select t.typname,
           string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) as vals
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace and n.nspname = 'public'
    group by t.typname
  ) x;
  o := o || E'\n-- ══ Kiểu enum ══\n' || p || E'\n';

  select coalesce(string_agg(
           format('create sequence if not exists public.%I;', c.relname),
           E'\n' order by c.relname), '')
    into p
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'S';
  o := o || E'\n-- ══ Sequence ══\n' || p || E'\n';

  select coalesce(string_agg(
           format(E'create table if not exists public.%I (\n%s\n);', x.tbl, x.body),
           E'\n\n' order by x.tbl), '')
    into p
  from (
    select c.relname as tbl,
           string_agg(format('  %I %s%s%s',
             a.attname,
             format_type(a.atttypid, a.atttypmod),
             case when a.attnotnull then ' not null' else '' end,
             case when ad.adbin is not null
                  then ' default ' || pg_get_expr(ad.adbin, ad.adrelid) else '' end),
             E',\n' order by a.attnum) as body
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
    where c.relkind = 'r'
    group by c.relname
  ) x;
  o := o || E'\n-- ══ Bảng ══\n' || p || E'\n';

  select coalesce(string_agg(
           format(E'do $d$ begin\n  alter table public.%I add constraint %I %s;\nexception when duplicate_object then null; end $d$;',
                  c.relname, con.conname, pg_get_constraintdef(con.oid)),
           E'\n' order by c.relname, con.conname), '')
    into p
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where con.contype in ('p', 'u', 'c');
  o := o || E'\n-- ══ Ràng buộc (PK / UNIQUE / CHECK) ══\n' || p || E'\n';

  select coalesce(string_agg(
           format(E'do $d$ begin\n  alter table public.%I add constraint %I %s;\nexception when duplicate_object then null; end $d$;',
                  c.relname, con.conname, pg_get_constraintdef(con.oid)),
           E'\n' order by c.relname, con.conname), '')
    into p
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where con.contype = 'f';
  o := o || E'\n-- ══ Khoá ngoại ══\n' || p || E'\n';

  select coalesce(string_agg(replace(i.indexdef, 'CREATE INDEX', 'create index if not exists')
                             || ';', E'\n' order by i.indexname), '')
    into p
  from pg_indexes i
  where i.schemaname = 'public'
    and not exists (
      select 1 from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where con.conname = i.indexname and con.contype in ('p', 'u')
    );
  o := o || E'\n-- ══ Index ══\n' || p || E'\n';

  select coalesce(string_agg(pg_get_functiondef(p2.oid) || ';', E'\n\n' order by p2.proname, p2.oid), '')
    into p
  from pg_proc p2
  join pg_namespace n on n.oid = p2.pronamespace and n.nspname = 'public'
  where p2.prokind in ('f', 'p')
    and not exists (
      select 1 from pg_depend d
      where d.objid = p2.oid and d.deptype = 'e'
    );
  o := o || E'\n-- ══ Hàm ══\n' || p || E'\n';

  select coalesce(string_agg(
           format(E'create or replace view public.%I%s as\n%s',
                  c.relname,
                  case when c.reloptions::text[] @> array['security_invoker=true']
                       then ' with (security_invoker = true)' else '' end,
                  pg_get_viewdef(c.oid, true)),
           E'\n\n' order by c.oid), '')
    into p
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'v';
  o := o || E'\n-- ══ View ══\n' || p || E'\n';

  select coalesce(string_agg(
           format(E'drop trigger if exists %I on public.%I;\n%s;',
                  t.tgname, c.relname, pg_get_triggerdef(t.oid)),
           E'\n' order by c.relname, t.tgname), '')
    into p
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where not t.tgisinternal;
  o := o || E'\n-- ══ Trigger ══\n' || p || E'\n';

  select coalesce(string_agg(
           format('alter table public.%I enable row level security;', c.relname),
           E'\n' order by c.relname), '')
    into p
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  where c.relkind = 'r' and c.relrowsecurity;
  o := o || E'\n-- ══ Bật RLS ══\n' || p || E'\n';

  select coalesce(string_agg(
           format(E'drop policy if exists %I on public.%I;\ncreate policy %I on public.%I as %s for %s to %s%s%s;',
                  pol.policyname, pol.tablename,
                  pol.policyname, pol.tablename,
                  case when pol.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
                  pol.cmd,
                  array_to_string(pol.roles, ', '),
                  case when pol.qual is not null then ' using (' || pol.qual || ')' else '' end,
                  case when pol.with_check is not null then ' with check (' || pol.with_check || ')' else '' end),
           E'\n' order by pol.tablename, pol.policyname), '')
    into p
  from pg_policies pol
  where pol.schemaname = 'public';
  o := o || E'\n-- ══ Policy ══\n' || p || E'\n';

  select coalesce(string_agg(x.dong, E'\n' order by x.dong), '')
    into p
  from (
    select format('grant %s on public.%I to %I;',
                  string_agg(distinct g.privilege_type, ', '),
                  g.table_name, g.grantee) as dong
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.grantee in ('anon', 'authenticated', 'service_role')
    group by g.table_name, g.grantee
  ) x;
  o := o || E'\n-- ══ Quyền bảng ══\n' || p || E'\n';

  select coalesce(string_agg(x.dong, E'\n' order by x.dong), '')
    into p
  from (
    select format(E'revoke all on function public.%I(%s) from public, anon, authenticated;\n%s',
                  p2.proname,
                  pg_get_function_identity_arguments(p2.oid),
                  coalesce((
                    select string_agg(format('grant execute on function public.%I(%s) to %I;',
                                             p2.proname,
                                             pg_get_function_identity_arguments(p2.oid),
                                             r.rolname), E'\n' order by r.rolname)
                    from aclexplode(p2.proacl) a
                    join pg_roles r on r.oid = a.grantee
                    where a.privilege_type = 'EXECUTE'
                      and r.rolname in ('anon', 'authenticated', 'service_role')
                  ), '-- (chỉ postgres giữ EXECUTE)')) as dong
    from pg_proc p2
    join pg_namespace n on n.oid = p2.pronamespace and n.nspname = 'public'
    where p2.prokind in ('f', 'p')
      and not exists (select 1 from pg_depend d where d.objid = p2.oid and d.deptype = 'e')
  ) x;
  o := o || E'\n-- ══ Quyền hàm (FR-167) ══\n' || p || E'\n';

  select coalesce(string_agg(
           format('insert into storage.buckets (id, name, public) values (%L, %L, %L) on conflict (id) do nothing;',
                  b.id, b.name, b.public),
           E'\n' order by b.id), '')
    into p
  from storage.buckets b;
  o := o || E'\n-- ══ Storage bucket ══\n' || p || E'\n';

  select coalesce(string_agg(
           format(E'drop policy if exists %I on storage.objects;\ncreate policy %I on storage.objects as %s for %s to %s%s%s;',
                  pol.policyname,
                  pol.policyname,
                  case when pol.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
                  pol.cmd,
                  array_to_string(pol.roles, ', '),
                  case when pol.qual is not null then ' using (' || pol.qual || ')' else '' end,
                  case when pol.with_check is not null then ' with check (' || pol.with_check || ')' else '' end),
           E'\n' order by pol.policyname), '')
    into p
  from pg_policies pol
  where pol.schemaname = 'storage' and pol.tablename = 'objects';
  o := o || E'\n-- ══ Storage policy ══\n' || p || E'\n';

  select coalesce(string_agg(
           format('select cron.schedule(%L, %L, %L);', j.jobname, j.schedule, j.command),
           E'\n' order by j.jobname), '')
    into p
  from cron.job j;
  o := o || E'\n-- ══ Cron ══\n' || p || E'\n';

  return o;
end
$function$
;

-- ══ View ══
create or replace view public.public_media as
 SELECT id,
    listing_id,
    category,
    storage_path
   FROM media m
  WHERE approved;

create or replace view public.listing_missing_facts as
 SELECT l.id AS listing_id,
    rf.fact_key,
    rf.priority
   FROM listings l
     JOIN required_facts rf ON rf.property_type = COALESCE(l.property_type, 'chua_ro'::property_type)
     LEFT JOIN listing_facts lf ON lf.listing_id = l.id AND lf.question = rf.fact_key
  WHERE lf.id IS NULL AND NOT (rf.fact_key = 'ket_cau'::text AND l.floors IS NOT NULL OR (rf.fact_key = ANY (ARRAY['do_rong_hem'::text, 'do_rong_duong'::text])) AND (l.alley_width_m IS NOT NULL OR l.access_type = 'mat_tien'::text) OR rf.fact_key = 'phap_ly'::text AND l.legal_status IS NOT NULL OR rf.fact_key = 'huong'::text AND l.direction IS NOT NULL OR rf.fact_key = 'so_phong_ngu'::text AND l.bedrooms IS NOT NULL OR rf.fact_key = 'tang'::text AND l.floor IS NOT NULL OR (rf.fact_key = ANY (ARRAY['dien_tich'::text, 'dien_tich_dat'::text, 'dien_tich_tim_tuong'::text])) AND l.area_m2 IS NOT NULL OR rf.fact_key = 'nam_xay'::text AND l.year_built IS NOT NULL OR rf.fact_key = 'noi_that'::text AND l.furnishing IS NOT NULL OR rf.fact_key = 'mat_tien'::text AND l.frontage_m IS NOT NULL OR rf.fact_key = 'quy_hoach'::text AND l.planning_status IS NOT NULL)
  ORDER BY l.id, rf.priority, rf.fact_key;

create or replace view public.public_listings as
 SELECT id,
    code,
    district,
    ward,
    deal,
    area_m2,
    price_vnd,
    price_raw,
    description,
    status,
    last_confirmed_at
   FROM listings;

create or replace view public.agents_public as
 SELECT s.id,
    s.name,
    s.seller_type,
    s.rating_sum,
    s.rating_count,
    ( SELECT count(*) AS count
           FROM listings l
          WHERE l.seller_id = s.id AND (l.status = ANY (ARRAY['dang_ban'::text, 'dang_quan_tam'::text, 'cho_thong_tin'::text]))) AS listing_count,
    seller_rank(s.seller_type, c.active::integer, c.closed::integer, c.total::integer) AS rank,
    c.closed::integer AS closed_count
   FROM sellers s
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE l.status = ANY (ARRAY['dang_ban'::text, 'dang_quan_tam'::text])) AS active,
            count(*) FILTER (WHERE l.status = 'da_chot'::text) AS closed,
            count(*) AS total
           FROM listings l
          WHERE l.seller_id = s.id) c ON true
  WHERE s.seller_type = 'nmg'::seller_type;

create or replace view public.seller_ranks with (security_invoker = true) as
 SELECT s.id,
    s.name,
    s.seller_type,
    COALESCE(c.active, 0::bigint)::integer AS active_count,
    COALESCE(c.closed, 0::bigint)::integer AS closed_count,
    COALESCE(c.total, 0::bigint)::integer AS total_count,
    seller_rank(s.seller_type, COALESCE(c.active, 0::bigint)::integer, COALESCE(c.closed, 0::bigint)::integer, COALESCE(c.total, 0::bigint)::integer) AS rank
   FROM sellers s
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE l.status = ANY (ARRAY['dang_ban'::text, 'dang_quan_tam'::text])) AS active,
            count(*) FILTER (WHERE l.status = 'da_chot'::text) AS closed,
            count(*) AS total
           FROM listings l
          WHERE l.seller_id = s.id) c ON true;

create or replace view public.media_mo_coi_storage as
 SELECT bucket_id AS bucket,
    name AS storage_path,
    created_at
   FROM storage.objects o
  WHERE (bucket_id = ANY (ARRAY['listing-public'::text, 'listing-private'::text])) AND NOT (EXISTS ( SELECT 1
           FROM listing_media m
          WHERE m.bucket = o.bucket_id AND m.storage_path = o.name));

create or replace view public.media_mo_coi_db as
 SELECT id,
    listing_id,
    bucket,
    storage_path,
    created_at
   FROM listing_media m
  WHERE NOT (EXISTS ( SELECT 1
           FROM storage.objects o
          WHERE o.bucket_id = m.bucket AND o.name = m.storage_path));

create or replace view public.listing_photos_v as
 SELECT l.code,
    ((((( SELECT c.value
           FROM app_config c
          WHERE c.key = 'storage_public_base_url'::text)) || '/'::text) || m.bucket) || '/'::text) || m.storage_path AS url,
    m.storage_path AS path,
    m.sort_order,
    m.is_cover,
    m.created_at,
    m.listing_id,
    m.id AS media_id
   FROM listing_media m
     JOIN listings l ON l.id = m.listing_id
  WHERE m.bucket = 'listing-public'::text AND (l.status = ANY (ARRAY['dang_ban'::text, 'dang_quan_tam'::text, 'da_chot'::text]));

create or replace view public.job_suc_khoe as
 SELECT 'inbound'::text AS hang_doi,
    inbound_ledger.zalo_msg_id AS job_id,
    inbound_ledger.status AS trang_thai,
    inbound_ledger.attempts,
    inbound_ledger.detail AS loi,
    inbound_ledger.started_at,
    inbound_ledger.finished_at,
    inbound_ledger.next_retry_at,
    inbound_ledger.updated_at
   FROM inbound_ledger
  WHERE inbound_ledger.status <> 'completed'::text
UNION ALL
 SELECT 'nhac'::text AS hang_doi,
    reminders.id::text AS job_id,
    reminders.status AS trang_thai,
    reminders.attempts,
    reminders.last_error AS loi,
    NULL::timestamp with time zone AS started_at,
    reminders.sent_at AS finished_at,
    reminders.next_retry_at,
    reminders.created_at AS updated_at
   FROM reminders
  WHERE reminders.status = ANY (ARRAY['pending'::text, 'dead'::text])
UNION ALL
 SELECT 'don_file'::text AS hang_doi,
    media_cleanup_queue.id::text AS job_id,
    media_cleanup_queue.trang_thai,
    media_cleanup_queue.attempts,
    media_cleanup_queue.last_error AS loi,
    NULL::timestamp with time zone AS started_at,
    NULL::timestamp with time zone AS finished_at,
    media_cleanup_queue.next_retry_at,
    media_cleanup_queue.updated_at
   FROM media_cleanup_queue
  WHERE media_cleanup_queue.trang_thai <> 'xong'::text;

create or replace view public.ctv_ranks as
 WITH q AS (
         SELECT q_1.ctv_id,
            count(*) AS tong,
            count(*) FILTER (WHERE q_1.status = 'answered'::request_status) AS tra_loi,
            count(*) FILTER (WHERE q_1.status = 'answered'::request_status AND q_1.answered_at <= q_1.sla_due_at) AS dung_han,
            count(*) FILTER (WHERE q_1.sla_missed_at IS NOT NULL) AS tre
           FROM info_requests q_1
          WHERE q_1.source = 'buyer_ask'::text AND q_1.assignee = 'ctv'::text AND q_1.created_at >= (now() - '30 days'::interval)
          GROUP BY q_1.ctv_id
        )
 SELECT c.id,
    c.name,
    c.active,
    COALESCE(q.tong, 0::bigint)::integer AS tong,
    COALESCE(q.tra_loi, 0::bigint)::integer AS tra_loi,
    COALESCE(q.dung_han, 0::bigint)::integer AS dung_han,
    COALESCE(q.tre, 0::bigint)::integer AS tre,
        CASE
            WHEN COALESCE(q.tong, 0::bigint) = 0 THEN NULL::numeric
            ELSE round(q.dung_han::numeric / q.tong::numeric, 2)
        END AS ty_le_dung_han,
        CASE
            WHEN COALESCE(q.tong, 0::bigint) < 3 THEN 'chua_du'::text
            WHEN (q.dung_han::numeric / q.tong::numeric) >= 0.9 THEN 'vang'::text
            WHEN (q.dung_han::numeric / q.tong::numeric) >= 0.7 THEN 'bac'::text
            ELSE 'dong'::text
        END AS rank
   FROM ctvs c
     LEFT JOIN q ON q.ctv_id = c.id
  WHERE auth.role() = 'service_role'::text OR (EXISTS ( SELECT 1
           FROM admins a
          WHERE a.email = (auth.jwt() ->> 'email'::text)));

create or replace view public.hoi_thoai_thong_ke as
 WITH ngay AS (
         SELECT d.d::date AS ngay
           FROM generate_series(((now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text)::date - 29)::timestamp with time zone, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh'::text)::date::timestamp with time zone, '1 day'::interval) d(d)
        ), ht AS (
         SELECT (c.started_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text)::date AS ngay,
            count(*) FILTER (WHERE c.buyer_id IS NOT NULL) AS hoi_thoai_khach_moi,
            count(*) FILTER (WHERE c.seller_id IS NOT NULL) AS hoi_thoai_ban_moi
           FROM conversations c
          WHERE c.started_at >= (now() - '31 days'::interval)
          GROUP BY ((c.started_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text)::date)
        ), co AS (
         SELECT (c.needs_human_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text)::date AS ngay,
            count(*) AS co_nguoi_that
           FROM conversations c
          WHERE c.needs_human_at >= (now() - '31 days'::interval)
          GROUP BY ((c.needs_human_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text)::date)
        ), tin AS (
         SELECT (m.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text)::date AS ngay,
            count(*) FILTER (WHERE m.sender = 'buyer'::msg_sender) AS tin_khach,
            count(*) FILTER (WHERE m.sender = 'seller'::msg_sender) AS tin_nguoi_ban,
            count(*) FILTER (WHERE m.sender = 'bot'::msg_sender) AS tin_bot,
            count(*) FILTER (WHERE m.sender = ANY (ARRAY['ctv'::msg_sender, 'human'::msg_sender])) AS tin_nguoi_that
           FROM messages m
          WHERE m.created_at >= (now() - '31 days'::interval)
          GROUP BY ((m.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text)::date)
        ), kh AS (
         SELECT (b.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text)::date AS ngay,
            count(*) AS khach_moi
           FROM buyers b
          WHERE b.created_at >= (now() - '31 days'::interval)
          GROUP BY ((b.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text)::date)
        )
 SELECT n.ngay,
    COALESCE(ht.hoi_thoai_khach_moi, 0::bigint)::integer AS hoi_thoai_khach_moi,
    COALESCE(ht.hoi_thoai_ban_moi, 0::bigint)::integer AS hoi_thoai_ban_moi,
    COALESCE(tin.tin_khach, 0::bigint)::integer AS tin_khach,
    COALESCE(tin.tin_nguoi_ban, 0::bigint)::integer AS tin_nguoi_ban,
    COALESCE(tin.tin_bot, 0::bigint)::integer AS tin_bot,
    COALESCE(tin.tin_nguoi_that, 0::bigint)::integer AS tin_nguoi_that,
    COALESCE(kh.khach_moi, 0::bigint)::integer AS khach_moi,
    COALESCE(co.co_nguoi_that, 0::bigint)::integer AS co_nguoi_that
   FROM ngay n
     LEFT JOIN ht ON ht.ngay = n.ngay
     LEFT JOIN tin ON tin.ngay = n.ngay
     LEFT JOIN kh ON kh.ngay = n.ngay
     LEFT JOIN co ON co.ngay = n.ngay
  WHERE auth.role() = 'service_role'::text OR (EXISTS ( SELECT 1
           FROM admins a
          WHERE a.email = ((( SELECT auth.jwt() AS jwt)) ->> 'email'::text)));

create or replace view public.khach_can_nguoi_that as
 SELECT c.id AS conversation_id,
        CASE
            WHEN c.buyer_id IS NOT NULL THEN 'khach'::text
            ELSE 'nguoi_ban'::text
        END AS vai,
    c.buyer_id,
    c.seller_id,
    COALESCE(b.name, s.name) AS ten,
    COALESCE(b.zalo_user_id, s.zalo_user_id) AS zalo_user_id,
    c.needs_human_at,
    c.human_escalated_at,
    c.last_message_at,
    c.ctv_id,
    ct.name AS ctv_name,
    "left"(m.body, 120) AS tin_khach_cuoi,
    m.created_at AS tin_khach_cuoi_at
   FROM conversations c
     LEFT JOIN buyers b ON b.id = c.buyer_id
     LEFT JOIN sellers s ON s.id = c.seller_id
     LEFT JOIN ctvs ct ON ct.id = c.ctv_id
     LEFT JOIN LATERAL ( SELECT m_1.body,
            m_1.created_at
           FROM messages m_1
          WHERE m_1.conversation_id = c.id AND (m_1.sender = ANY (ARRAY['buyer'::msg_sender, 'seller'::msg_sender]))
          ORDER BY m_1.created_at DESC
         LIMIT 1) m ON true
  WHERE c.needs_human = true AND (c.human_touch_at IS NULL OR c.human_touch_at < c.needs_human_at) AND (auth.role() = 'service_role'::text OR (EXISTS ( SELECT 1
           FROM admins a
          WHERE a.email = ((( SELECT auth.jwt() AS jwt)) ->> 'email'::text))));

create or replace view public.nmg_hoat_dong as
 SELECT s.id,
    s.name,
    COALESCE(t.active, 0::bigint)::integer AS active_count,
    COALESCE(d.tra_loi_7d, 0::bigint)::integer AS drip_answered_7d,
    d.last_answer_at,
    COALESCE(t.active, 0::bigint) > 0 AND COALESCE(d.tra_loi_7d, 0::bigint) > 0 AS hoat_dong
   FROM sellers s
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE l.status = ANY (ARRAY['dang_ban'::text, 'dang_quan_tam'::text])) AS active
           FROM listings l
          WHERE l.seller_id = s.id) t ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS tra_loi_7d,
            max(q.answered_at) AS last_answer_at
           FROM info_requests q
             JOIN listings l ON l.id = q.listing_id
          WHERE l.seller_id = s.id AND (q.source = ANY (ARRAY['seller_flow'::text, 'seller_drip'::text])) AND q.answered_at >= (now() - '7 days'::interval)) d ON true
  WHERE s.seller_type = 'nmg'::seller_type AND (auth.role() = 'service_role'::text OR (EXISTS ( SELECT 1
           FROM admins a
          WHERE a.email = (auth.jwt() ->> 'email'::text))));

create or replace view public.bds_hot as
 SELECT l.id AS listing_id,
    l.code,
    l.ward,
    l.district,
    l.status,
    count(e.id) FILTER (WHERE e.at > (now() - '60 days'::interval))::integer AS so_su_kien_60d,
    count(e.id) FILTER (WHERE e.at > (now() - '60 days'::interval) AND e.event_type = 'view'::text)::integer AS xem_60d,
    count(e.id) FILTER (WHERE e.at > (now() - '60 days'::interval) AND e.event_type = 'asked'::text)::integer AS hoi_60d,
    count(e.id) FILTER (WHERE e.at > (now() - '60 days'::interval) AND e.event_type = 'viewing'::text)::integer AS lich_xem_60d,
    max(e.at) AS last_event_at
   FROM listings l
     LEFT JOIN property_events e ON e.listing_id = l.id
  WHERE auth.role() = 'service_role'::text OR (EXISTS ( SELECT 1
           FROM admins a
          WHERE a.email = ((( SELECT auth.jwt() AS jwt)) ->> 'email'::text)))
  GROUP BY l.id, l.code, l.ward, l.district, l.status
  ORDER BY (count(e.id) FILTER (WHERE e.at > (now() - '60 days'::interval))::integer) DESC, (max(e.at)) DESC NULLS LAST;

create or replace view public.hoi_thoai_phien as
 WITH m AS (
         SELECT messages.conversation_id,
            messages.created_at,
            messages.sender,
            messages.seq,
            lag(messages.created_at) OVER (PARTITION BY messages.conversation_id ORDER BY messages.created_at, messages.seq) AS prev_at
           FROM messages
        ), g AS (
         SELECT m.conversation_id,
            m.created_at,
            m.sender,
            m.seq,
            m.prev_at,
            sum(
                CASE
                    WHEN m.prev_at IS NULL OR (m.created_at - m.prev_at) > '00:30:00'::interval THEN 1
                    ELSE 0
                END) OVER (PARTITION BY m.conversation_id ORDER BY m.created_at, m.seq ROWS UNBOUNDED PRECEDING) AS phien
           FROM m
        )
 SELECT g.conversation_id,
    c.buyer_id,
    c.seller_id,
    g.phien::integer AS so_phien,
    min(g.created_at) AS phien_bat_dau,
    max(g.created_at) AS phien_ket_thuc,
    max(g.created_at) - min(g.created_at) AS thoi_luong,
    count(*)::integer AS so_tin,
    count(*) FILTER (WHERE g.sender = ANY (ARRAY['buyer'::msg_sender, 'seller'::msg_sender]))::integer AS so_tin_khach,
    count(*) FILTER (WHERE g.sender = 'bot'::msg_sender)::integer AS so_tin_bot,
    (array_agg(g.sender::text ORDER BY g.created_at, g.seq))[1] AS sender_dau
   FROM g
     JOIN conversations c ON c.id = g.conversation_id
  WHERE auth.role() = 'service_role'::text OR (EXISTS ( SELECT 1
           FROM admins a
          WHERE a.email = ((( SELECT auth.jwt() AS jwt)) ->> 'email'::text)))
  GROUP BY g.conversation_id, c.buyer_id, c.seller_id, g.phien;

create or replace view public.bot_do_tre as
 SELECT so_luot,
    p50_giay,
    p95_giay,
    max_giay,
    tu,
    den
   FROM ( SELECT count(*)::integer AS so_luot,
            round(percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (EXTRACT(epoch FROM inbound_ledger.finished_at - inbound_ledger.started_at)::double precision))::numeric, 2) AS p50_giay,
            round(percentile_cont(0.95::double precision) WITHIN GROUP (ORDER BY (EXTRACT(epoch FROM inbound_ledger.finished_at - inbound_ledger.started_at)::double precision))::numeric, 2) AS p95_giay,
            round(max(EXTRACT(epoch FROM inbound_ledger.finished_at - inbound_ledger.started_at)), 2) AS max_giay,
            min(inbound_ledger.started_at) AS tu,
            max(inbound_ledger.finished_at) AS den
           FROM inbound_ledger
          WHERE inbound_ledger.started_at IS NOT NULL AND inbound_ledger.finished_at IS NOT NULL AND inbound_ledger.finished_at >= (now() - '7 days'::interval)) x
  WHERE auth.role() = 'service_role'::text OR (EXISTS ( SELECT 1
           FROM admins a
          WHERE a.email = ((( SELECT auth.jwt() AS jwt)) ->> 'email'::text)));

create or replace view public.ro_hang_ban as
 SELECT code AS ma,
        CASE property_type
            WHEN 'nha_pho'::property_type THEN 'nhà phố'::text
            WHEN 'nha_cap4'::property_type THEN 'nhà cấp 4'::text
            WHEN 'chung_cu'::property_type THEN 'chung cư'::text
            WHEN 'dat'::property_type THEN 'đất'::text
            WHEN 'biet_thu'::property_type THEN 'biệt thự'::text
            WHEN 'phong_tro'::property_type THEN 'phòng trọ'::text
            WHEN 'mat_bang'::property_type THEN 'mặt bằng'::text
            ELSE 'chưa rõ'::text
        END AS loai,
    ward AS phuong,
    street AS duong,
    area_m2 AS dien_tich_m2,
    round(price_vnd::numeric / 1000000000::numeric, 2) AS gia_ty,
    round(price_per_m2_vnd::numeric / 1000000::numeric, 1) AS gia_m2_trieu,
    frontage_m AS ngang,
    length_m AS dai,
    COALESCE(floors_text, floors || ' tầng'::text) AS ket_cau,
    bedrooms AS phong_ngu,
    bathrooms AS phong_tam,
        CASE legal_status
            WHEN 'so_hong_rieng'::text THEN 'sổ hồng riêng'::text
            WHEN 'so_hong_chung'::text THEN 'sổ hồng chung'::text
            WHEN 'so_hong'::text THEN 'có sổ'::text
            WHEN 'hdmb'::text THEN 'hợp đồng mua bán'::text
            WHEN 'giay_tay'::text THEN 'giấy tay'::text
            ELSE NULL::text
        END ||
        CASE
            WHEN has_completion THEN ', hoàn công'::text
            ELSE ''::text
        END AS phap_ly,
        CASE access_type
            WHEN 'mat_tien'::text THEN 'mặt tiền'::text
            WHEN 'hem_xe_tai'::text THEN 'hẻm xe tải'::text
            WHEN 'hem_xe_hoi'::text THEN 'hẻm xe hơi'::text
            WHEN 'hem_xe_may'::text THEN 'hẻm xe máy'::text
            WHEN 'hem'::text THEN 'trong hẻm'::text
            ELSE NULL::text
        END || COALESCE((' '::text || alley_width_m) || 'm'::text, ''::text) AS duong_vao,
        CASE status
            WHEN 'cho_thong_tin'::text THEN 'chờ thông tin'::text
            WHEN 'dang_ban'::text THEN 'đang bán'::text
            WHEN 'dang_quan_tam'::text THEN 'đang quan tâm'::text
            WHEN 'da_chot'::text THEN 'đã chốt'::text
            WHEN 'an'::text THEN 'ẩn'::text
            ELSE status
        END AS trang_thai,
    NULLIF(concat_ws(' · '::text,
        CASE
            WHEN property_type_source = 'suy_doan'::text THEN 'LOẠI do máy đoán'::text
            ELSE NULL::text
        END,
        CASE
            WHEN specs_source = 'boc_mo_ta'::text THEN 'THÔNG SỐ bóc từ mô tả'::text
            ELSE NULL::text
        END,
        CASE
            WHEN price_source = 'suy_doan'::text THEN 'GIÁ do máy đoán'::text
            ELSE NULL::text
        END,
        CASE
            WHEN ward_source = 'suy_doan'::text THEN 'PHƯỜNG do máy đoán'::text
            ELSE NULL::text
        END), ''::text) AS canh_bao,
    created_at AS ngay_vao_ro,
    id
   FROM listings l
  WHERE deal = 'ban'::listing_deal;

-- ══ Trigger ══
drop trigger if exists trg_bot_errors_het_tien on public.bot_errors;
CREATE TRIGGER trg_bot_errors_het_tien AFTER INSERT ON public.bot_errors FOR EACH ROW EXECUTE FUNCTION bat_het_tien_api();
drop trigger if exists trg_bot_prompts_touch on public.bot_prompts;
CREATE TRIGGER trg_bot_prompts_touch BEFORE UPDATE ON public.bot_prompts FOR EACH ROW EXECUTE FUNCTION bot_prompts_touch();
drop trigger if exists trg_conversations_assign_ctv on public.conversations;
CREATE TRIGGER trg_conversations_assign_ctv BEFORE INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION assign_ctv_round_robin();
drop trigger if exists trg_conversations_email_upset on public.conversations;
CREATE TRIGGER trg_conversations_email_upset AFTER UPDATE OF needs_human ON public.conversations FOR EACH ROW EXECUTE FUNCTION conversations_email_upset();
drop trigger if exists trg_deals_chan_xoa on public.deals;
CREATE TRIGGER trg_deals_chan_xoa BEFORE DELETE ON public.deals FOR EACH ROW EXECUTE FUNCTION deals_chan_xoa_da_chot();
drop trigger if exists trg_pe_deals on public.deals;
CREATE TRIGGER trg_pe_deals AFTER INSERT ON public.deals FOR EACH ROW EXECUTE FUNCTION trg_property_event();
drop trigger if exists trg_inbound_ledger_trang_thai on public.inbound_ledger;
CREATE TRIGGER trg_inbound_ledger_trang_thai BEFORE UPDATE ON public.inbound_ledger FOR EACH ROW EXECUTE FUNCTION inbound_ledger_giu_completed();
drop trigger if exists trg_info_request_bao_lai_khach on public.info_requests;
CREATE TRIGGER trg_info_request_bao_lai_khach AFTER UPDATE OF status ON public.info_requests FOR EACH ROW EXECUTE FUNCTION info_request_bao_lai_khach();
drop trigger if exists trg_info_request_set_active_listing on public.info_requests;
CREATE TRIGGER trg_info_request_set_active_listing AFTER INSERT ON public.info_requests FOR EACH ROW EXECUTE FUNCTION info_request_set_active_listing();
drop trigger if exists trg_notify_info_request_escalation on public.info_requests;
CREATE TRIGGER trg_notify_info_request_escalation AFTER INSERT ON public.info_requests FOR EACH ROW EXECUTE FUNCTION notify_info_request_escalation();
drop trigger if exists trg_pe_info_requests on public.info_requests;
CREATE TRIGGER trg_pe_info_requests AFTER INSERT ON public.info_requests FOR EACH ROW EXECUTE FUNCTION trg_property_event();
drop trigger if exists trg_route_info_request on public.info_requests;
CREATE TRIGGER trg_route_info_request BEFORE INSERT ON public.info_requests FOR EACH ROW EXECUTE FUNCTION route_info_request();
drop trigger if exists trg_pe_interests on public.interests;
CREATE TRIGGER trg_pe_interests AFTER INSERT ON public.interests FOR EACH ROW EXECUTE FUNCTION trg_property_event();
drop trigger if exists trg_listing_facts_sync_cols on public.listing_facts;
CREATE TRIGGER trg_listing_facts_sync_cols AFTER INSERT ON public.listing_facts FOR EACH ROW EXECUTE FUNCTION listing_facts_sync_cols();
drop trigger if exists trg_listing_media_bia on public.listing_media;
CREATE TRIGGER trg_listing_media_bia AFTER INSERT OR DELETE OR UPDATE OF is_cover, bucket, sort_order ON public.listing_media FOR EACH ROW EXECUTE FUNCTION listing_media_giu_bia();
drop trigger if exists trg_listing_media_don_file on public.listing_media;
CREATE TRIGGER trg_listing_media_don_file AFTER DELETE OR UPDATE OF bucket, storage_path ON public.listing_media FOR EACH ROW EXECUTE FUNCTION listing_media_xep_hang_don();
drop trigger if exists trg_pe_listing_views on public.listing_views;
CREATE TRIGGER trg_pe_listing_views AFTER INSERT ON public.listing_views FOR EACH ROW EXECUTE FUNCTION trg_property_event();
drop trigger if exists listing_insert_drip on public.listings;
CREATE TRIGGER listing_insert_drip AFTER INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION trg_listing_drip();
drop trigger if exists trg_listings_bao_can_da_chot on public.listings;
CREATE TRIGGER trg_listings_bao_can_da_chot AFTER UPDATE OF status ON public.listings FOR EACH ROW EXECUTE FUNCTION listings_bao_can_da_chot();
drop trigger if exists trg_listings_bao_tin_moi_khop on public.listings;
CREATE TRIGGER trg_listings_bao_tin_moi_khop AFTER INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION listings_bao_tin_moi_khop();
drop trigger if exists trg_listings_chuan_hoa_cot on public.listings;
CREATE TRIGGER trg_listings_chuan_hoa_cot BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION listings_chuan_hoa_cot();
drop trigger if exists trg_listings_fill_code on public.listings;
CREATE TRIGGER trg_listings_fill_code BEFORE INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION listings_fill_code();
drop trigger if exists trg_listings_fill_property_type on public.listings;
CREATE TRIGGER trg_listings_fill_property_type BEFORE INSERT OR UPDATE OF description, location_raw, property_type ON public.listings FOR EACH ROW EXECUTE FUNCTION listings_fill_property_type();
drop trigger if exists trg_listings_price_vnd on public.listings;
CREATE TRIGGER trg_listings_price_vnd BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION listings_set_price_vnd();
drop trigger if exists trg_pe_listings on public.listings;
CREATE TRIGGER trg_pe_listings AFTER UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION trg_property_event();
drop trigger if exists trg_y_listings_boc_thong_so on public.listings;
CREATE TRIGGER trg_y_listings_boc_thong_so BEFORE INSERT OR UPDATE OF description, location_raw, property_type ON public.listings FOR EACH ROW EXECUTE FUNCTION listings_boc_thong_so();
drop trigger if exists trg_z_listings_normalize_status on public.listings;
CREATE TRIGGER trg_z_listings_normalize_status BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION listings_normalize_status();
drop trigger if exists trg_zz_listings_dang_tin on public.listings;
CREATE TRIGGER trg_zz_listings_dang_tin BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION listings_quyet_dinh_dang_tin();
drop trigger if exists trg_media_cleanup_trang_thai on public.media_cleanup_queue;
CREATE TRIGGER trg_media_cleanup_trang_thai BEFORE UPDATE ON public.media_cleanup_queue FOR EACH ROW EXECUTE FUNCTION media_cleanup_giu_trang_thai();
drop trigger if exists trg_messages_bump_last_message on public.messages;
CREATE TRIGGER trg_messages_bump_last_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION messages_bump_last_message();
drop trigger if exists trg_pe_reminders on public.reminders;
CREATE TRIGGER trg_pe_reminders AFTER UPDATE OF status ON public.reminders FOR EACH ROW EXECUTE FUNCTION trg_property_event();
drop trigger if exists trg_reminders_email_voice on public.reminders;
CREATE TRIGGER trg_reminders_email_voice AFTER INSERT ON public.reminders FOR EACH ROW EXECUTE FUNCTION reminders_email_voice();
drop trigger if exists trg_reminders_hen_hoi_cam_nhan on public.reminders;
CREATE TRIGGER trg_reminders_hen_hoi_cam_nhan AFTER UPDATE OF status ON public.reminders FOR EACH ROW EXECUTE FUNCTION reminders_hen_hoi_cam_nhan();
drop trigger if exists trg_reminders_trang_thai on public.reminders;
CREATE TRIGGER trg_reminders_trang_thai BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION reminders_giu_trang_thai_ket();
drop trigger if exists trg_pe_viewings on public.viewings;
CREATE TRIGGER trg_pe_viewings AFTER INSERT ON public.viewings FOR EACH ROW EXECUTE FUNCTION trg_property_event();
drop trigger if exists trg_viewings_bao_ctv_va_email on public.viewings;
CREATE TRIGGER trg_viewings_bao_ctv_va_email AFTER INSERT ON public.viewings FOR EACH ROW EXECUTE FUNCTION viewings_bao_ctv_va_email();

-- ══ Bật RLS ══
alter table public.admins enable row level security;
alter table public.app_config enable row level security;
alter table public.bot_errors enable row level security;
alter table public.bot_health enable row level security;
alter table public.bot_prompts enable row level security;
alter table public.bot_usage enable row level security;
alter table public.buyers enable row level security;
alter table public.chat_quota enable row level security;
alter table public.conversations enable row level security;
alter table public.ctv_daily_reports enable row level security;
alter table public.ctvs enable row level security;
alter table public.curated_lists enable row level security;
alter table public.deals enable row level security;
alter table public.inbound_events enable row level security;
alter table public.inbound_ledger enable row level security;
alter table public.info_requests enable row level security;
alter table public.interests enable row level security;
alter table public.listing_facts enable row level security;
alter table public.listing_media enable row level security;
alter table public.listing_views enable row level security;
alter table public.listings enable row level security;
alter table public.media enable row level security;
alter table public.media_cleanup_queue enable row level security;
alter table public.messages enable row level security;
alter table public.projects enable row level security;
alter table public.property_events enable row level security;
alter table public.ratings_log enable row level security;
alter table public.reminders enable row level security;
alter table public.required_facts enable row level security;
alter table public.sellers enable row level security;
alter table public.viewings enable row level security;

-- ══ Policy ══
drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins as permissive for SELECT to authenticated using ((email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)));
drop policy if exists bot_errors_admin_read on public.bot_errors;
create policy bot_errors_admin_read on public.bot_errors as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists bot_health_admin_read on public.bot_health;
create policy bot_health_admin_read on public.bot_health as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists bot_usage_admin_read on public.bot_usage;
create policy bot_usage_admin_read on public.bot_usage as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists buyers_admin_read on public.buyers;
create policy buyers_admin_read on public.buyers as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists buyers_self_insert on public.buyers;
create policy buyers_self_insert on public.buyers as permissive for INSERT to authenticated with check ((auth_user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists buyers_self_read on public.buyers;
create policy buyers_self_read on public.buyers as permissive for SELECT to authenticated using ((auth_user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists buyers_self_update on public.buyers;
create policy buyers_self_update on public.buyers as permissive for UPDATE to authenticated using ((auth_user_id = ( SELECT auth.uid() AS uid))) with check ((auth_user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists conversations_admin_read on public.conversations;
create policy conversations_admin_read on public.conversations as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists ctvs_admin_read on public.ctvs;
create policy ctvs_admin_read on public.ctvs as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists info_requests_admin_read on public.info_requests;
create policy info_requests_admin_read on public.info_requests as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists anon_read_listing_facts on public.listing_facts;
create policy anon_read_listing_facts on public.listing_facts as permissive for SELECT to anon, authenticated using (((question <> ALL (ARRAY['hinh_anh'::text, 'dia_chi_chi_tiet'::text])) AND (EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = listing_facts.listing_id) AND (l.status = ANY (ARRAY['dang_ban'::text, 'dang_quan_tam'::text, 'da_chot'::text])))))));
drop policy if exists listing_media_admin_all on public.listing_media;
create policy listing_media_admin_all on public.listing_media as permissive for ALL to authenticated using (la_admin()) with check (la_admin());
drop policy if exists listing_media_doc_cong_khai on public.listing_media;
create policy listing_media_doc_cong_khai on public.listing_media as permissive for SELECT to anon, authenticated using (((bucket = 'listing-public'::text) AND (EXISTS ( SELECT 1
   FROM listings l
  WHERE ((l.id = listing_media.listing_id) AND (l.status = ANY (ARRAY['dang_ban'::text, 'dang_quan_tam'::text, 'da_chot'::text])))))));
drop policy if exists listing_media_own_delete on public.listing_media;
create policy listing_media_own_delete on public.listing_media as permissive for DELETE to authenticated using (((bucket = 'listing-public'::text) AND tin_cua_toi(listing_id)));
drop policy if exists listing_media_own_insert on public.listing_media;
create policy listing_media_own_insert on public.listing_media as permissive for INSERT to authenticated with check (((bucket = 'listing-public'::text) AND tin_cua_toi(listing_id)));
drop policy if exists listing_media_own_read on public.listing_media;
create policy listing_media_own_read on public.listing_media as permissive for SELECT to authenticated using (((bucket = 'listing-public'::text) AND tin_cua_toi(listing_id)));
drop policy if exists views_own_all on public.listing_views;
create policy views_own_all on public.listing_views as permissive for ALL to authenticated using ((auth_user_id = ( SELECT auth.uid() AS uid))) with check ((auth_user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists anon_read_listings on public.listings;
create policy anon_read_listings on public.listings as permissive for SELECT to anon, authenticated using ((status = ANY (ARRAY['dang_ban'::text, 'dang_quan_tam'::text, 'da_chot'::text])));
drop policy if exists listings_admin_read on public.listings;
create policy listings_admin_read on public.listings as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists listings_admin_update on public.listings;
create policy listings_admin_update on public.listings as permissive for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text))))) with check (true);
drop policy if exists listings_own_insert on public.listings;
create policy listings_own_insert on public.listings as permissive for INSERT to authenticated with check (((status = 'cho_thong_tin'::text) AND (seller_id IN ( SELECT sellers.id
   FROM sellers
  WHERE (sellers.auth_user_id = ( SELECT auth.uid() AS uid))))));
drop policy if exists listings_own_read on public.listings;
create policy listings_own_read on public.listings as permissive for SELECT to authenticated using ((seller_id IN ( SELECT sellers.id
   FROM sellers
  WHERE (sellers.auth_user_id = ( SELECT auth.uid() AS uid)))));
drop policy if exists anon_read_media on public.media;
create policy anon_read_media on public.media as permissive for SELECT to anon, authenticated using (((approved = true) AND (category = 'photo'::text)));
drop policy if exists messages_admin_read on public.messages;
create policy messages_admin_read on public.messages as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists anon_read_projects on public.projects;
create policy anon_read_projects on public.projects as permissive for SELECT to anon, authenticated using (true);
drop policy if exists property_events_admin_read on public.property_events;
create policy property_events_admin_read on public.property_events as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists reminders_admin_read on public.reminders;
create policy reminders_admin_read on public.reminders as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists reminders_admin_update on public.reminders;
create policy reminders_admin_update on public.reminders as permissive for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text))))) with check ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists sellers_admin_read on public.sellers;
create policy sellers_admin_read on public.sellers as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists sellers_admin_update on public.sellers;
create policy sellers_admin_update on public.sellers as permissive for UPDATE to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text))))) with check ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));
drop policy if exists sellers_self_insert on public.sellers;
create policy sellers_self_insert on public.sellers as permissive for INSERT to authenticated with check ((auth_user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists sellers_self_read on public.sellers;
create policy sellers_self_read on public.sellers as permissive for SELECT to authenticated using ((auth_user_id = ( SELECT auth.uid() AS uid)));
drop policy if exists viewings_admin_read on public.viewings;
create policy viewings_admin_read on public.viewings as permissive for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM admins a
  WHERE (a.email = (( SELECT auth.jwt() AS jwt) ->> 'email'::text)))));

-- ══ Quyền bảng ══
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.admins to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.agents_public to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.app_config to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.bot_errors to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.bot_health to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.bot_prompts to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.bot_usage to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.buyers to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.chat_quota to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.conversations to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.ctv_daily_reports to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.ctv_ranks to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.ctv_ranks to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.ctvs to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.curated_lists to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.deals to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.inbound_events to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.inbound_ledger to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.info_requests to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.interests to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.job_suc_khoe to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.listing_facts to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.listing_media to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.listing_missing_facts to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.listing_photos_v to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.listing_views to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.listings to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.media to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.media_cleanup_queue to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.media_mo_coi_db to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.media_mo_coi_storage to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.messages to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.nmg_hoat_dong to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.nmg_hoat_dong to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.projects to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.property_events to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.public_listings to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.public_media to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.ratings_log to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.reminders to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.required_facts to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.ro_hang_ban to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.seller_ranks to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.sellers to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on public.viewings to service_role;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.admins to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.buyers to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.conversations to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.ctv_daily_reports to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.ctvs to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.deals to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.info_requests to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.interests to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.listing_facts to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.listing_views to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.listings to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.media to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.messages to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.projects to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.reminders to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.required_facts to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.sellers to authenticated;
grant DELETE, INSERT, REFERENCES, SELECT, TRIGGER, UPDATE on public.viewings to authenticated;
grant DELETE, INSERT, SELECT on public.listing_media to authenticated;
grant REFERENCES, SELECT, TRIGGER on public.admins to anon;
grant REFERENCES, SELECT, TRIGGER on public.agents_public to anon;
grant REFERENCES, SELECT, TRIGGER on public.agents_public to authenticated;
grant REFERENCES, SELECT, TRIGGER on public.bot_prompts to anon;
grant REFERENCES, SELECT, TRIGGER on public.bot_prompts to authenticated;
grant REFERENCES, SELECT, TRIGGER on public.buyers to anon;
grant REFERENCES, SELECT, TRIGGER on public.conversations to anon;
grant REFERENCES, SELECT, TRIGGER on public.ctv_daily_reports to anon;
grant REFERENCES, SELECT, TRIGGER on public.ctvs to anon;
grant REFERENCES, SELECT, TRIGGER on public.deals to anon;
grant REFERENCES, SELECT, TRIGGER on public.info_requests to anon;
grant REFERENCES, SELECT, TRIGGER on public.interests to anon;
grant REFERENCES, SELECT, TRIGGER on public.listing_facts to anon;
grant REFERENCES, SELECT, TRIGGER on public.listing_photos_v to anon;
grant REFERENCES, SELECT, TRIGGER on public.listing_photos_v to authenticated;
grant REFERENCES, SELECT, TRIGGER on public.listing_views to anon;
grant REFERENCES, SELECT, TRIGGER on public.listings to anon;
grant REFERENCES, SELECT, TRIGGER on public.media to anon;
grant REFERENCES, SELECT, TRIGGER on public.messages to anon;
grant REFERENCES, SELECT, TRIGGER on public.projects to anon;
grant REFERENCES, SELECT, TRIGGER on public.property_events to authenticated;
grant REFERENCES, SELECT, TRIGGER on public.reminders to anon;
grant REFERENCES, SELECT, TRIGGER on public.required_facts to anon;
grant REFERENCES, SELECT, TRIGGER on public.sellers to anon;
grant REFERENCES, SELECT, TRIGGER on public.viewings to anon;
grant SELECT on public.bds_hot to authenticated;
grant SELECT on public.bds_hot to service_role;
grant SELECT on public.bot_do_tre to authenticated;
grant SELECT on public.bot_do_tre to service_role;
grant SELECT on public.bot_errors to authenticated;
grant SELECT on public.bot_health to authenticated;
grant SELECT on public.bot_usage to authenticated;
grant SELECT on public.hoi_thoai_phien to authenticated;
grant SELECT on public.hoi_thoai_phien to service_role;
grant SELECT on public.hoi_thoai_thong_ke to authenticated;
grant SELECT on public.hoi_thoai_thong_ke to service_role;
grant SELECT on public.khach_can_nguoi_that to authenticated;
grant SELECT on public.khach_can_nguoi_that to service_role;
grant SELECT on public.listing_media to anon;
grant SELECT on public.ro_hang_ban to authenticated;
grant SELECT on public.seller_ranks to anon;
grant SELECT on public.seller_ranks to authenticated;

-- ══ Quyền hàm (FR-167) ══
revoke all on function public.admin_dang_tin(p jsonb) from public, anon, authenticated;
grant execute on function public.admin_dang_tin(p jsonb) to authenticated;
grant execute on function public.admin_dang_tin(p jsonb) to service_role;
revoke all on function public.ap_thong_so(p_listing_id uuid, j jsonb, p_bac text, p_de boolean) from public, anon, authenticated;
grant execute on function public.ap_thong_so(p_listing_id uuid, j jsonb, p_bac text, p_de boolean) to service_role;
revoke all on function public.ask_seller_drip(p_listing_id uuid) from public, anon, authenticated;
grant execute on function public.ask_seller_drip(p_listing_id uuid) to service_role;
revoke all on function public.assign_ctv_round_robin() from public, anon, authenticated;
grant execute on function public.assign_ctv_round_robin() to service_role;
revoke all on function public.bac_nguon(p_source text) from public, anon, authenticated;
grant execute on function public.bac_nguon(p_source text) to anon;
grant execute on function public.bac_nguon(p_source text) to authenticated;
grant execute on function public.bac_nguon(p_source text) to service_role;
revoke all on function public.bao_can_da_chot(p_listing_id uuid) from public, anon, authenticated;
grant execute on function public.bao_can_da_chot(p_listing_id uuid) to service_role;
revoke all on function public.bao_hong_inbound(p_msg_id text, p_detail text) from public, anon, authenticated;
grant execute on function public.bao_hong_inbound(p_msg_id text, p_detail text) to service_role;
revoke all on function public.bao_hong_nhac(p_id uuid, p_detail text) from public, anon, authenticated;
grant execute on function public.bao_hong_nhac(p_id uuid, p_detail text) to service_role;
revoke all on function public.bao_tin_moi_khop(p_listing_id uuid) from public, anon, authenticated;
grant execute on function public.bao_tin_moi_khop(p_listing_id uuid) to service_role;
revoke all on function public.bat_het_tien_api() from public, anon, authenticated;
grant execute on function public.bat_het_tien_api() to service_role;
revoke all on function public.beat(p_who text) from public, anon, authenticated;
grant execute on function public.beat(p_who text) to service_role;
revoke all on function public.bo_dau(t text) from public, anon, authenticated;
grant execute on function public.bo_dau(t text) to anon;
grant execute on function public.bo_dau(t text) to authenticated;
grant execute on function public.bo_dau(t text) to service_role;
revoke all on function public.bo_dem_nhac_treo(p_gio integer) from public, anon, authenticated;
grant execute on function public.bo_dem_nhac_treo(p_gio integer) to service_role;
revoke all on function public.boc_ten_duong(p text) from public, anon, authenticated;
grant execute on function public.boc_ten_duong(p text) to anon;
grant execute on function public.boc_ten_duong(p text) to authenticated;
grant execute on function public.boc_ten_duong(p text) to service_role;
revoke all on function public.boc_thong_so(p_text text, p_type text) from public, anon, authenticated;
grant execute on function public.boc_thong_so(p_text text, p_type text) to anon;
grant execute on function public.boc_thong_so(p_text text, p_type text) to authenticated;
grant execute on function public.boc_thong_so(p_text text, p_type text) to service_role;
revoke all on function public.bot_health_tick() from public, anon, authenticated;
grant execute on function public.bot_health_tick() to service_role;
revoke all on function public.bot_prompts_touch() from public, anon, authenticated;
grant execute on function public.bot_prompts_touch() to service_role;
revoke all on function public.bump_model_quota(p_limit integer) from public, anon, authenticated;
grant execute on function public.bump_model_quota(p_limit integer) to service_role;
revoke all on function public.bump_user_quota(p_uid text, p_gio_limit integer, p_ngay_limit integer) from public, anon, authenticated;
grant execute on function public.bump_user_quota(p_uid text, p_gio_limit integer, p_ngay_limit integer) to service_role;
revoke all on function public.can_cung_khu(p_buyer_id uuid, p_listing_id uuid, p_limit integer) from public, anon, authenticated;
grant execute on function public.can_cung_khu(p_buyer_id uuid, p_listing_id uuid, p_limit integer) to service_role;
revoke all on function public.canh_bao_ngoai(p_title text, p_text text, p_priority integer, p_email boolean) from public, anon, authenticated;
grant execute on function public.canh_bao_ngoai(p_title text, p_text text, p_priority integer, p_email boolean) to service_role;
revoke all on function public.cat_truoc_phu_dinh(p_text text) from public, anon, authenticated;
grant execute on function public.cat_truoc_phu_dinh(p_text text) to anon;
grant execute on function public.cat_truoc_phu_dinh(p_text text) to authenticated;
grant execute on function public.cat_truoc_phu_dinh(p_text text) to service_role;
revoke all on function public.cau_hinh(p_key text) from public, anon, authenticated;
grant execute on function public.cau_hinh(p_key text) to service_role;
revoke all on function public.che_sdt(p text) from public, anon, authenticated;
grant execute on function public.che_sdt(p text) to anon;
grant execute on function public.che_sdt(p text) to authenticated;
grant execute on function public.che_sdt(p text) to service_role;
revoke all on function public.chon_viec_don_chet() from public, anon, authenticated;
grant execute on function public.chon_viec_don_chet() to service_role;
revoke all on function public.chuan_hoa_gia_raw(p_text text) from public, anon, authenticated;
grant execute on function public.chuan_hoa_gia_raw(p_text text) to anon;
grant execute on function public.chuan_hoa_gia_raw(p_text text) to authenticated;
grant execute on function public.chuan_hoa_gia_raw(p_text text) to service_role;
revoke all on function public.chuan_hoa_lai_gia(p_batch integer) from public, anon, authenticated;
grant execute on function public.chuan_hoa_lai_gia(p_batch integer) to service_role;
revoke all on function public.chuan_hoa_phuong(p_text text) from public, anon, authenticated;
grant execute on function public.chuan_hoa_phuong(p_text text) to anon;
grant execute on function public.chuan_hoa_phuong(p_text text) to authenticated;
grant execute on function public.chuan_hoa_phuong(p_text text) to service_role;
revoke all on function public.claim_inbound(p_msg_id text, p_stale_secs integer, p_worker text) from public, anon, authenticated;
grant execute on function public.claim_inbound(p_msg_id text, p_stale_secs integer, p_worker text) to service_role;
revoke all on function public.cong_token(p_in bigint, p_out bigint, p_cache_write bigint, p_cache_read bigint) from public, anon, authenticated;
grant execute on function public.cong_token(p_in bigint, p_out bigint, p_cache_write bigint, p_cache_read bigint) to service_role;
revoke all on function public.conversations_email_upset() from public, anon, authenticated;
grant execute on function public.conversations_email_upset() to service_role;
revoke all on function public.ctv_report_tick() from public, anon, authenticated;
grant execute on function public.ctv_report_tick() to service_role;
revoke all on function public.ctv_sla_phut() from public, anon, authenticated;
grant execute on function public.ctv_sla_phut() to anon;
grant execute on function public.ctv_sla_phut() to authenticated;
grant execute on function public.ctv_sla_phut() to service_role;
revoke all on function public.deals_chan_xoa_da_chot() from public, anon, authenticated;
grant execute on function public.deals_chan_xoa_da_chot() to service_role;
revoke all on function public.doc_danh_sach(p_token text) from public, anon, authenticated;
grant execute on function public.doc_danh_sach(p_token text) to anon;
grant execute on function public.doc_danh_sach(p_token text) to authenticated;
grant execute on function public.doc_danh_sach(p_token text) to service_role;
revoke all on function public.email_admin(p_loai text, p_zalo_uid text, p_body text, p_listing_id uuid) from public, anon, authenticated;
grant execute on function public.email_admin(p_loai text, p_zalo_uid text, p_body text, p_listing_id uuid) to service_role;
revoke all on function public.ensure_buyer_conversation(p_zalo_user_id text, p_channel text) from public, anon, authenticated;
grant execute on function public.ensure_buyer_conversation(p_zalo_user_id text, p_channel text) to service_role;
revoke all on function public.ensure_seller_conversation(p_seller_id uuid, p_channel text) from public, anon, authenticated;
grant execute on function public.ensure_seller_conversation(p_seller_id uuid, p_channel text) to service_role;
revoke all on function public.get_secret(secret_name text) from public, anon, authenticated;
grant execute on function public.get_secret(secret_name text) to service_role;
revoke all on function public.ghi_danh_gia(p_buyer_id uuid, p_listing_id uuid, p_stars integer, p_note text) from public, anon, authenticated;
grant execute on function public.ghi_danh_gia(p_buyer_id uuid, p_listing_id uuid, p_stars integer, p_note text) to service_role;
revoke all on function public.ghi_fact_listing(p_listing_id uuid, p_question text, p_answer text, p_source text) from public, anon, authenticated;
grant execute on function public.ghi_fact_listing(p_listing_id uuid, p_question text, p_answer text, p_source text) to service_role;
revoke all on function public.ghi_su_kien_bds(p_listing_id uuid, p_type text, p_buyer_id uuid, p_meta jsonb) from public, anon, authenticated;
grant execute on function public.ghi_su_kien_bds(p_listing_id uuid, p_type text, p_buyer_id uuid, p_meta jsonb) to service_role;
revoke all on function public.ghi_su_kien_inbound(p_event_id text, p_zalo_user_id text, p_payload jsonb) from public, anon, authenticated;
grant execute on function public.ghi_su_kien_inbound(p_event_id text, p_zalo_user_id text, p_payload jsonb) to service_role;
revoke all on function public.giu_luot_gui(p_msg_id text, p_han_secs integer) from public, anon, authenticated;
grant execute on function public.giu_luot_gui(p_msg_id text, p_han_secs integer) to service_role;
revoke all on function public.guess_property_type(p_text text) from public, anon, authenticated;
grant execute on function public.guess_property_type(p_text text) to authenticated;
grant execute on function public.guess_property_type(p_text text) to service_role;
revoke all on function public.guess_property_type_answer(p_text text) from public, anon, authenticated;
grant execute on function public.guess_property_type_answer(p_text text) to service_role;
revoke all on function public.inbound_ledger_giu_completed() from public, anon, authenticated;
grant execute on function public.inbound_ledger_giu_completed() to service_role;
revoke all on function public.inbound_sweep_tick() from public, anon, authenticated;
grant execute on function public.inbound_sweep_tick() to service_role;
revoke all on function public.info_request_bao_lai_khach() from public, anon, authenticated;
grant execute on function public.info_request_bao_lai_khach() to service_role;
revoke all on function public.info_request_set_active_listing() from public, anon, authenticated;
grant execute on function public.info_request_set_active_listing() to service_role;
revoke all on function public.info_request_sla_tick() from public, anon, authenticated;
grant execute on function public.info_request_sla_tick() to service_role;
revoke all on function public.info_request_timeout_tick() from public, anon, authenticated;
grant execute on function public.info_request_timeout_tick() to service_role;
revoke all on function public.khu_khop(p_area_kd text, p_ward text, p_district text) from public, anon, authenticated;
grant execute on function public.khu_khop(p_area_kd text, p_ward text, p_district text) to anon;
grant execute on function public.khu_khop(p_area_kd text, p_ward text, p_district text) to authenticated;
grant execute on function public.khu_khop(p_area_kd text, p_ward text, p_district text) to service_role;
revoke all on function public.la_admin() from public, anon, authenticated;
grant execute on function public.la_admin() to authenticated;
grant execute on function public.la_admin() to service_role;
revoke all on function public.lan_thu_ke(p_attempts integer) from public, anon, authenticated;
grant execute on function public.lan_thu_ke(p_attempts integer) to service_role;
revoke all on function public.liet_ke_bang() from public, anon, authenticated;
grant execute on function public.liet_ke_bang() to service_role;
revoke all on function public.liet_ke_migration() from public, anon, authenticated;
grant execute on function public.liet_ke_migration() to service_role;
revoke all on function public.listing_du_dang_tin(p_price_vnd bigint, p_area_m2 numeric, p_ward text) from public, anon, authenticated;
grant execute on function public.listing_du_dang_tin(p_price_vnd bigint, p_area_m2 numeric, p_ward text) to anon;
grant execute on function public.listing_du_dang_tin(p_price_vnd bigint, p_area_m2 numeric, p_ward text) to authenticated;
grant execute on function public.listing_du_dang_tin(p_price_vnd bigint, p_area_m2 numeric, p_ward text) to service_role;
revoke all on function public.listing_facts_sync_cols() from public, anon, authenticated;
grant execute on function public.listing_facts_sync_cols() to service_role;
revoke all on function public.listing_media_chon_bia(p_listing_id uuid) from public, anon, authenticated;
grant execute on function public.listing_media_chon_bia(p_listing_id uuid) to service_role;
revoke all on function public.listing_media_giu_bia() from public, anon, authenticated;
grant execute on function public.listing_media_giu_bia() to service_role;
revoke all on function public.listing_media_xep_hang_don() from public, anon, authenticated;
grant execute on function public.listing_media_xep_hang_don() to service_role;
revoke all on function public.listings_autopublish() from public, anon, authenticated;
grant execute on function public.listings_autopublish() to service_role;
revoke all on function public.listings_bao_can_da_chot() from public, anon, authenticated;
grant execute on function public.listings_bao_can_da_chot() to service_role;
revoke all on function public.listings_bao_tin_moi_khop() from public, anon, authenticated;
grant execute on function public.listings_bao_tin_moi_khop() to service_role;
revoke all on function public.listings_boc_thong_so() from public, anon, authenticated;
grant execute on function public.listings_boc_thong_so() to service_role;
revoke all on function public.listings_chuan_hoa_cot() from public, anon, authenticated;
grant execute on function public.listings_chuan_hoa_cot() to service_role;
revoke all on function public.listings_fill_code() from public, anon, authenticated;
grant execute on function public.listings_fill_code() to service_role;
revoke all on function public.listings_fill_property_type() from public, anon, authenticated;
grant execute on function public.listings_fill_property_type() to service_role;
revoke all on function public.listings_normalize_status() from public, anon, authenticated;
grant execute on function public.listings_normalize_status() to service_role;
revoke all on function public.listings_quyet_dinh_dang_tin() from public, anon, authenticated;
grant execute on function public.listings_quyet_dinh_dang_tin() to service_role;
revoke all on function public.listings_set_price_vnd() from public, anon, authenticated;
grant execute on function public.listings_set_price_vnd() to service_role;
revoke all on function public.listings_try_publish(p_listing_id uuid) from public, anon, authenticated;
grant execute on function public.listings_try_publish(p_listing_id uuid) to service_role;
revoke all on function public.log_loi(p_source text, p_detail text, p_code integer) from public, anon, authenticated;
grant execute on function public.log_loi(p_source text, p_detail text, p_code integer) to anon;
grant execute on function public.log_loi(p_source text, p_detail text, p_code integer) to authenticated;
grant execute on function public.log_loi(p_source text, p_detail text, p_code integer) to service_role;
revoke all on function public.mark_listing_interest(p_codes text[]) from public, anon, authenticated;
grant execute on function public.mark_listing_interest(p_codes text[]) to service_role;
revoke all on function public.mark_listing_interest(p_codes text[], p_buyer_id uuid) from public, anon, authenticated;
grant execute on function public.mark_listing_interest(p_codes text[], p_buyer_id uuid) to service_role;
revoke all on function public.match_projects(p_text text) from public, anon, authenticated;
grant execute on function public.match_projects(p_text text) to service_role;
revoke all on function public.media_cleanup_giu_trang_thai() from public, anon, authenticated;
grant execute on function public.media_cleanup_giu_trang_thai() to service_role;
revoke all on function public.media_cleanup_tick() from public, anon, authenticated;
grant execute on function public.media_cleanup_tick() to service_role;
revoke all on function public.merge_buyer_prefs(p_buyer_id uuid, p_delta jsonb) from public, anon, authenticated;
grant execute on function public.merge_buyer_prefs(p_buyer_id uuid, p_delta jsonb) to service_role;
revoke all on function public.messages_bump_last_message() from public, anon, authenticated;
grant execute on function public.messages_bump_last_message() to service_role;
revoke all on function public.mo_ho_so_nguoi_ban(p_zalo_user_id text, p_seller_type seller_type) from public, anon, authenticated;
grant execute on function public.mo_ho_so_nguoi_ban(p_zalo_user_id text, p_seller_type seller_type) to service_role;
revoke all on function public.mo_viec_can_nguoi_that(p_buyer_id uuid, p_ctv_id uuid, p_note text, p_voice boolean) from public, anon, authenticated;
grant execute on function public.mo_viec_can_nguoi_that(p_buyer_id uuid, p_ctv_id uuid, p_note text, p_voice boolean) to service_role;
revoke all on function public.next_listing_code() from public, anon, authenticated;
grant execute on function public.next_listing_code() to service_role;
revoke all on function public.nguoi_noi_bo(p_zalo text) from public, anon, authenticated;
grant execute on function public.nguoi_noi_bo(p_zalo text) to service_role;
revoke all on function public.nha_luot_gui(p_msg_id text) from public, anon, authenticated;
grant execute on function public.nha_luot_gui(p_msg_id text) to service_role;
revoke all on function public.nha_viec_nhac(p_id uuid, p_worker text) from public, anon, authenticated;
grant execute on function public.nha_viec_nhac(p_id uuid, p_worker text) to service_role;
revoke all on function public.nhan_viec_don_media(p_limit integer) from public, anon, authenticated;
grant execute on function public.nhan_viec_don_media(p_limit integer) to service_role;
revoke all on function public.nhan_viec_nhac(p_kinds text[], p_limit integer, p_worker text) from public, anon, authenticated;
grant execute on function public.nhan_viec_nhac(p_kinds text[], p_limit integer, p_worker text) to service_role;
revoke all on function public.notify_info_request_escalation() from public, anon, authenticated;
grant execute on function public.notify_info_request_escalation() to service_role;
revoke all on function public.nudge_tick() from public, anon, authenticated;
grant execute on function public.nudge_tick() to service_role;
revoke all on function public.parse_vnd(p text) from public, anon, authenticated;
grant execute on function public.parse_vnd(p text) to authenticated;
grant execute on function public.parse_vnd(p text) to service_role;
revoke all on function public.reminders_email_voice() from public, anon, authenticated;
grant execute on function public.reminders_email_voice() to service_role;
revoke all on function public.reminders_giu_trang_thai_ket() from public, anon, authenticated;
grant execute on function public.reminders_giu_trang_thai_ket() to service_role;
revoke all on function public.reminders_hen_hoi_cam_nhan() from public, anon, authenticated;
grant execute on function public.reminders_hen_hoi_cam_nhan() to service_role;
revoke all on function public.route_info_request() from public, anon, authenticated;
grant execute on function public.route_info_request() to service_role;
revoke all on function public.seller_drip_tick() from public, anon, authenticated;
grant execute on function public.seller_drip_tick() to service_role;
revoke all on function public.seller_rank(p_type seller_type, p_active integer, p_closed integer, p_total integer) from public, anon, authenticated;
grant execute on function public.seller_rank(p_type seller_type, p_active integer, p_closed integer, p_total integer) to anon;
grant execute on function public.seller_rank(p_type seller_type, p_active integer, p_closed integer, p_total integer) to authenticated;
grant execute on function public.seller_rank(p_type seller_type, p_active integer, p_closed integer, p_total integer) to service_role;
revoke all on function public.stale_listing_tick() from public, anon, authenticated;
grant execute on function public.stale_listing_tick() to service_role;
revoke all on function public.tao_danh_sach(p_listing_codes text[], p_title text, p_buyer_id uuid) from public, anon, authenticated;
grant execute on function public.tao_danh_sach(p_listing_codes text[], p_title text, p_buyer_id uuid) to authenticated;
grant execute on function public.tao_danh_sach(p_listing_codes text[], p_title text, p_buyer_id uuid) to service_role;
revoke all on function public.tao_followup(p_buyer_id uuid, p_code text) from public, anon, authenticated;
grant execute on function public.tao_followup(p_buyer_id uuid, p_code text) to service_role;
revoke all on function public.thu_muc_dau_uuid(p_name text) from public, anon, authenticated;
grant execute on function public.thu_muc_dau_uuid(p_name text) to authenticated;
grant execute on function public.thu_muc_dau_uuid(p_name text) to service_role;
revoke all on function public.tin_cua_toi(p_listing uuid) from public, anon, authenticated;
grant execute on function public.tin_cua_toi(p_listing uuid) to authenticated;
grant execute on function public.tin_cua_toi(p_listing uuid) to service_role;
revoke all on function public.trg_listing_drip() from public, anon, authenticated;
grant execute on function public.trg_listing_drip() to service_role;
revoke all on function public.trg_property_event() from public, anon, authenticated;
grant execute on function public.trg_property_event() to service_role;
revoke all on function public.viec_inbound_bo_roi(p_limit integer) from public, anon, authenticated;
grant execute on function public.viec_inbound_bo_roi(p_limit integer) to service_role;
revoke all on function public.viewings_bao_ctv_va_email() from public, anon, authenticated;
grant execute on function public.viewings_bao_ctv_va_email() to service_role;
revoke all on function public.xuat_schema() from public, anon, authenticated;
grant execute on function public.xuat_schema() to service_role;

-- ══ Storage bucket ══
insert into storage.buckets (id, name, public) values ('listing-photos', 'listing-photos', 'f') on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('listing-private', 'listing-private', 'f') on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('listing-public', 'listing-public', 't') on conflict (id) do nothing;

-- ══ Storage policy ══
drop policy if exists storage_admin_private_all on storage.objects;
create policy storage_admin_private_all on storage.objects as permissive for ALL to authenticated using (((bucket_id = 'listing-private'::text) AND la_admin())) with check (((bucket_id = 'listing-private'::text) AND la_admin()));
drop policy if exists storage_admin_public_all on storage.objects;
create policy storage_admin_public_all on storage.objects as permissive for ALL to authenticated using (((bucket_id = 'listing-public'::text) AND la_admin())) with check (((bucket_id = 'listing-public'::text) AND la_admin()));
drop policy if exists storage_seller_own_delete on storage.objects;
create policy storage_seller_own_delete on storage.objects as permissive for DELETE to authenticated using (((bucket_id = 'listing-public'::text) AND tin_cua_toi(thu_muc_dau_uuid(name))));
drop policy if exists storage_seller_own_insert on storage.objects;
create policy storage_seller_own_insert on storage.objects as permissive for INSERT to authenticated with check (((bucket_id = 'listing-public'::text) AND tin_cua_toi(thu_muc_dau_uuid(name))));

-- ══ Cron ══
select cron.schedule('bot-health-tick', '*/15 * * * *', 'select public.bot_health_tick()');
select cron.schedule('cron-don-so', '15 18 * * *', 'delete from cron.job_run_details where end_time < now() - interval ''7 days''');
select cron.schedule('ctv-report-tick', '0 10 * * *', 'select public.ctv_report_tick()');
select cron.schedule('ctv-sla-tick', '*/15 1-13 * * *', 'select public.info_request_sla_tick()');
select cron.schedule('inbound-sweep-tick', '* * * * *', 'select public.inbound_sweep_tick()');
select cron.schedule('info-timeout-tick', '3 1-13 * * *', 'select public.info_request_timeout_tick()');
select cron.schedule('listing-interest-decay', '0 20 * * *', 'update public.listings set status = ''dang_ban''
   where status = ''dang_quan_tam'' and last_interest_at < now() - interval ''7 days''');
select cron.schedule('media-chet-tick', '0 * * * *', 'select public.chon_viec_don_chet()');
select cron.schedule('media-cleanup-tick', '*/5 * * * *', 'select public.media_cleanup_tick()');
select cron.schedule('nudge-tick', '7,37 1-13 * * *', 'select nudge_tick()');
select cron.schedule('seller-drip-tick', '22,52 1-13 * * *', 'select seller_drip_tick()');
select cron.schedule('stale-listing-tick', '0 2 * * *', 'select public.stale_listing_tick()');
