-- ten-duong.sql — boc_ten_duong rút TÊN ĐƯỜNG từ địa chỉ (20261003b, SRS-5.1zj). Sai → raise exception.
begin;
set local client_min_messages = warning;
create temp table ca (ten text, co text, mong text) on commit drop;
insert into ca values
  ('88 hẻm 6m Tân Kỳ Tân Quý', boc_ten_duong('88 hẻm 6m Tân Kỳ Tân Quý'), 'Tân Kỳ Tân Quý'),
  ('số 12 hẻm 4m Trần Bình Trọng', boc_ten_duong('số 12 hẻm 4m Trần Bình Trọng'), 'Trần Bình Trọng'),
  ('hẻm 45 Nguyễn Trãi', boc_ten_duong('hẻm 45 Nguyễn Trãi'), 'Nguyễn Trãi'),
  ('12/3 Lê Văn Sỹ', boc_ten_duong('12/3 Lê Văn Sỹ'), 'Lê Văn Sỹ'),
  ('hẻm 18/5 đường Cách Mạng Tháng 8', boc_ten_duong('hẻm 18/5 đường Cách Mạng Tháng 8'), 'Cách Mạng Tháng 8'),
  ('đường 3/2', boc_ten_duong('đường 3/2'), '3/2'),
  ('đường 30/4', boc_ten_duong('đường 30/4'), '30/4'),
  ('đường D2', boc_ten_duong('đường D2'), 'D2'),
  ('3 Tháng 2', boc_ten_duong('3 Tháng 2'), '3 Tháng 2'),
  ('156/12/4 đường 59', boc_ten_duong('156/12/4 đường 59'), '59');
do $$ declare r record; n int := 0; begin
  for r in select * from ca loop
    if r.co is distinct from r.mong then raise warning 'SAI: % — có %, mong %', r.ten, r.co, r.mong; n := n + 1; end if;
  end loop;
  if n > 0 then raise exception '% ca sai', n; end if;
end $$;
rollback;
