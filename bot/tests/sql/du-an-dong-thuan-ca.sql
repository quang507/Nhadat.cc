\set ON_ERROR_STOP 1
insert into projects values ('00000000-0000-0000-0000-0000000000a1', 'Conic Boulevard', null, '{}'::jsonb, '[]'::jsonb, null);
insert into projects values ('00000000-0000-0000-0000-0000000000a2', 'Sky Garden', 'Sổ hồng lâu dài', '{}'::jsonb, '[]'::jsonb, null);
-- 8 người rao: s1..s6 điểm 60 (Bạc), s7, s8 điểm 95 (Vàng); mỗi người một tin trong dự án.
insert into sellers select ('00000000-0000-0000-0000-00000000000' || i)::uuid, case when i <= 6 then 60 else 95 end from generate_series(1, 8) i;
insert into listings select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, ('00000000-0000-0000-0000-00000000000' || i)::uuid from generate_series(1, 8) i;

create function pg_temp.phieu(i int, khoa text, gt text) returns bigint language sql as $$
  select public.ghi_fact_du_an('00000000-0000-0000-0000-0000000000a1', khoa, gt, 'seller_chat', ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, null, null) $$;
create function pg_temp.kiem(ten text, ok boolean) returns void language plpgsql as $$
begin if ok then raise notice '✓ %', ten; else raise exception '✗ %', ten; end if; end $$;

-- DT-01: 4 người nói cùng phí quản lý → chưa chốt (cần 5), kho chưa có.
select pg_temp.phieu(i, 'phi_quan_ly', '12 nghìn/m2') from generate_series(1, 4) i;
select pg_temp.kiem('DT-01 4 người cùng ý → chưa chốt, kho chưa ghi',
  (select specs ->> 'phi_quan_ly' from projects where name = 'Conic Boulevard') is null
  and (select trang_thai from project_facts where khoa = 'phi_quan_ly') = 'cho_duyet');
-- DT-02: cùng một người nói lại (khác hoa thường) → vẫn một phiếu, không có dòng mới.
select pg_temp.phieu(1, 'phi_quan_ly', '12 Nghìn/m2');
select pg_temp.kiem('DT-02 một người nói lại → không thêm phiếu, không thêm dòng',
  (select count(*) from project_fact_phieu) = 4 and (select count(*) from project_facts where khoa = 'phi_quan_ly') = 1);
-- DT-03: người thứ 5 → chốt, ghi vào projects.specs, không ai duyệt tay.
select pg_temp.phieu(5, 'phi_quan_ly', '12 nghìn/m2');
select pg_temp.kiem('DT-03 người thứ 5 → tự chốt vào kho (duyet_boi = dong_thuan)',
  (select specs ->> 'phi_quan_ly' from projects where name = 'Conic Boulevard') = '12 nghìn/m2'
  and (select duyet_boi from project_facts where khoa = 'phi_quan_ly') = 'dong_thuan');

-- DT-04: tranh chấp — 2 người Vàng nói "năm 2021" trước, rồi 5 người Bạc nói "năm 2020": phe khác 1.9 > 3.0/3 → chưa chốt.
select pg_temp.phieu(i, 'nam_xay', 'năm 2021') from generate_series(7, 8) i;
select pg_temp.phieu(i, 'nam_xay', 'năm 2020') from generate_series(1, 5) i;
select pg_temp.kiem('DT-04 5 người nhưng phe nói khác (trọng số uy tín) > 1/3 → chưa chốt',
  (select specs ->> 'nam_xay' from projects where name = 'Conic Boulevard') is null);
-- DT-05: một người Vàng đổi ý sang "năm 2020" → phiếu CHUYỂN (không còn ở 2021), phe khác 0.95 ≤ 3.95/3 → chốt 2020, 2021 thành bo.
select pg_temp.phieu(8, 'nam_xay', 'năm 2020');
select pg_temp.kiem('DT-05 đổi ý = chuyển phiếu; đủ áp đảo → chốt 2020, phe thua bo',
  (select specs ->> 'nam_xay' from projects where name = 'Conic Boulevard') = 'năm 2020'
  and (select trang_thai from project_facts where khoa = 'nam_xay' and gia_tri = 'năm 2021') = 'bo'
  and not exists (select 1 from project_fact_phieu ph join project_facts pf on pf.id = ph.fact_id
                   where pf.gia_tri = 'năm 2021' and ph.seller_id = '00000000-0000-0000-0000-000000000008'));

-- DT-06: tiện ích là danh sách — "hồ bơi" và "phòng gym" không chọi nhau; mỗi ý đủ 5 người là vào amenities.
select pg_temp.phieu(i, 'tien_ich_gan', 'hồ bơi') from generate_series(1, 5) i;
select pg_temp.phieu(i, 'tien_ich_gan', 'phòng gym') from generate_series(4, 8) i;
select pg_temp.kiem('DT-06 tiện ích: hai ý cùng đủ 5 người → cả hai vào amenities, không ý nào bị bo',
  (select amenities from projects where name = 'Conic Boulevard') @> '["hồ bơi", "phòng gym"]'::jsonb
  and not exists (select 1 from project_facts where khoa = 'tien_ich_gan' and trang_thai = 'bo'));

-- DT-07: pháp lý dự án.
select pg_temp.kiem('DT-07 du_an_co_phap_ly: Sky Garden có legal_status → true; Conic chưa có → false; null → false',
  public.du_an_co_phap_ly('00000000-0000-0000-0000-0000000000a2') and not public.du_an_co_phap_ly('00000000-0000-0000-0000-0000000000a1')
  and not public.du_an_co_phap_ly(null));
-- DT-08: so_huu đủ 5 người chốt → dự án có pháp lý.
select pg_temp.phieu(i, 'so_huu', 'sổ hồng lâu dài') from generate_series(1, 5) i;
select pg_temp.kiem('DT-08 so_huu chốt bằng đồng thuận → du_an_co_phap_ly(Conic) = true', public.du_an_co_phap_ly('00000000-0000-0000-0000-0000000000a1'));

-- DT-09: uy tín đổi kết quả — 2 người mới (điểm 5, hạng Đồng) nói "không có thang máy" trước, rồi 5 người Bạc nói "có 2 thang máy".
-- Đếm đầu người: phe khác 2 > 5/3 → không chốt. Theo uy tín: 2 × 0,10 = 0,20 ≤ 3,0/3 → chốt "có 2 thang máy".
insert into sellers values ('00000000-0000-0000-0000-000000000009', 5), ('00000000-0000-0000-0000-000000000010', 5);
insert into listings values ('00000000-0000-0000-0000-000000000109', '00000000-0000-0000-0000-000000000009'),
                            ('00000000-0000-0000-0000-000000000110', '00000000-0000-0000-0000-000000000010');
select pg_temp.phieu(i, 'thang_may', 'không có thang máy') from generate_series(9, 10) i;
select pg_temp.phieu(i, 'thang_may', 'có 2 thang máy') from generate_series(1, 5) i;
select pg_temp.kiem('DT-09 hai người uy tín thấp nói khác không chặn được 5 người Bạc → chốt theo uy tín',
  (select specs ->> 'thang_may' from projects where name = 'Conic Boulevard') = 'có 2 thang máy');

-- DT-10: căn hộ thuộc dự án đã có pháp lý → view không đòi pháp lý; căn hộ dự án chưa có pháp lý → còn đòi; nhà phố không bị ảnh hưởng.
insert into listings (id, seller_id, property_type, deal, project_id) values
  ('00000000-0000-0000-0000-0000000002a1', '00000000-0000-0000-0000-000000000001', 'chung_cu', 'ban', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000002a2', '00000000-0000-0000-0000-000000000001', 'chung_cu', 'ban', null),
  ('00000000-0000-0000-0000-0000000002a3', '00000000-0000-0000-0000-000000000001', 'nha_pho', 'ban', '00000000-0000-0000-0000-0000000000a2');
insert into required_facts values ('nha_pho', 'phap_ly', 16, 'co_ban', 'ban');
select pg_temp.kiem('DT-10 căn hộ dự án có pháp lý không bị hỏi pháp lý; căn hộ không dự án vẫn hỏi; nhà phố vẫn hỏi',
  not exists (select 1 from listing_missing_facts where listing_id = '00000000-0000-0000-0000-0000000002a1' and fact_key = 'phap_ly')
  and exists (select 1 from listing_missing_facts where listing_id = '00000000-0000-0000-0000-0000000002a2' and fact_key = 'phap_ly')
  and exists (select 1 from listing_missing_facts where listing_id = '00000000-0000-0000-0000-0000000002a3' and fact_key = 'phap_ly'));
