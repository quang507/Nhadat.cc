#!/usr/bin/env bash
# Bài kiểm SQL thật (SRS-5.1zzzzzzz19): dựng PostgreSQL tạm, nạp khung + phần đồng thuận của 20261014e, bắn phiếu. Không có PostgreSQL → bỏ qua
# (thoát 0 kèm dòng "BỎ QUA") — CI không cài Postgres, bài này chạy trên máy dev.
set -euo pipefail
cd "$(dirname "$0")"
B=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)
if [ -z "$B" ] || [ ! -x "$B/initdb" ]; then echo "BỎ QUA: không có PostgreSQL trên máy"; exit 0; fi
D=$(mktemp -d /tmp/pg-dong-thuan-XXXX); chmod 777 "$D"
CHAY="$B"; NGUOI=$(id -un)
if [ "$NGUOI" = root ]; then SU=(su postgres -c); else SU=(bash -c); fi
"${SU[@]}" "$B/initdb -D $D/data -A trust -U postgres >/dev/null && $B/pg_ctl -D $D/data -o '-p 5498 -k $D' -l $D/log start >/dev/null"
trap '"${SU[@]}" "$CHAY/pg_ctl -D $D/data stop -m fast >/dev/null" || true; rm -rf "$D"' EXIT
sleep 2
P=(psql -q -h "$D" -p 5498 -U postgres -v ON_ERROR_STOP=1)
"${P[@]}" -f du-an-dong-thuan.sql
# Phần (1) và hàm pháp lý dự án của migration: từ "create or replace function public.du_an_co_phap_ly" tới hết khối hàm đó, và từ
# "─── (1)" tới hết file.
MIG=../../supabase/migrations/20261014e_du_an_dong_thuan_phap_ly.sql
sed -n '/^create or replace function public.du_an_co_phap_ly/,/^grant execute on function public.du_an_co_phap_ly/p' "$MIG" > "$D/phap_ly.sql"
sed -n '/─── (1) thông tin dự án/,$p' "$MIG" | sed '/^drop policy\|^create policy\|^grant select on public.project_fact_phieu\|^alter table public.project_fact_phieu enable/d' > "$D/dong_thuan.sql"
sed -n '/^create or replace view public.listing_missing_facts as/,/ORDER BY l.id, rf.priority, rf.fact_key;/p' "$MIG" > "$D/view.sql"
"${P[@]}" -f "$D/phap_ly.sql" -f "$D/dong_thuan.sql" -f "$D/view.sql"
"${P[@]}" -f du-an-dong-thuan-ca.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
echo "ĐỒNG THUẬN DỰ ÁN (SQL thật): ĐẠT"
