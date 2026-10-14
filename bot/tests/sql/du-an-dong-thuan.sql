-- SRS-5.1zzzzzzz19 — bài kiểm SQL thật cho tự chốt thông tin dự án (20261014e). Chạy: bash bot/tests/sql/chay.sh (cần PostgreSQL ≥ 14 trên máy).
-- Dựng khung tối thiểu (bảng / hàm phụ thuộc), nạp phần đồng thuận của migration, rồi bắn phiếu.
\set ON_ERROR_STOP 1
create schema if not exists auth;
do $$ begin create role anon; create role authenticated; create role service_role; exception when duplicate_object then null; end $$;
create or replace function auth.role() returns text language sql as $$ select 'service_role'::text $$;
create or replace function public.la_admin() returns boolean language sql as $$ select false $$;
create table public.projects (id uuid primary key, name text, legal_status text, specs jsonb, amenities jsonb, updated_at timestamptz);
create table public.sellers (id uuid primary key, diem_gia int);
create type public.property_type as enum ('nha_pho', 'chung_cu', 'dat', 'chua_ro');
-- Đủ các cột view `listing_missing_facts` đọc (kiểu đơn giản hoá, đủ cho phép thử).
create table public.listings (id uuid primary key, seller_id uuid references public.sellers(id), property_type public.property_type, deal text,
  floors int, alley_width_m numeric, access_type text, legal_status text, direction text, bedrooms int, bathrooms int, floor int, area_m2 numeric,
  year_built int, furnishing text, frontage_m numeric, rear_width_m numeric, distance_to_street_m numeric, corner_lot boolean, has_elevator boolean,
  negotiable boolean, rent_income_vnd numeric, planning_status text, price_vnd numeric, gap boolean, ward text, project_id uuid, location_raw text,
  street text, floors_text text);
create table public.required_facts (property_type public.property_type, fact_key text, priority int, nhom text, deal text);
create table public.listing_facts (id bigserial primary key, listing_id uuid, question text, answer text);
create table public.listing_media (listing_id uuid);
insert into public.required_facts values ('chung_cu', 'phap_ly', 16, 'co_ban', 'ban'), ('chung_cu', 'gia', 12, 'co_ban', null);
create table public.conversations (id uuid primary key, seller_id uuid);
create table public.project_facts (
  id bigserial primary key, project_id uuid references public.projects(id) on delete cascade, khoa text not null, gia_tri text not null,
  nguon text not null default 'seller_chat', listing_id uuid, conversation_id uuid, trang_thai text not null default 'cho_duyet',
  duyet_at timestamptz, duyet_boi text, created_at timestamptz not null default now(), ten_du_an text);
create unique index project_facts_khong_trung_idx on public.project_facts (coalesce(project_id::text, lower(btrim(ten_du_an))), khoa, gia_tri) where trang_thai <> 'bo';
-- Điểm uy tín giả: đọc cột diem_gia (bản thật tính từ tin + phản hồi).
create or replace function public.diem_nguoi_ban(p uuid) returns jsonb language sql as $$ select jsonb_build_object('diem', diem_gia) from sellers where id = p $$;
