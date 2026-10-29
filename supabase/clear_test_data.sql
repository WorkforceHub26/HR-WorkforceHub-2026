-- ============================================================================
-- 🧹 ล้างข้อมูลทดสอบ (ใบลา + ข้อมูลที่ผูกกับใบลา + แจ้งเตือน + บันทึก LINE)
--    รันใน Supabase > SQL Editor ของฐานที่ต้องการล้าง (MAIN = pgogmhqjdchakcytsomx)
--
--    ไม่ลบ: พนักงาน · รหัสผ่าน · โควตา/สิทธิ์วันลา · ประเภทการลา · สายอนุมัติ · วันหยุด · การผูก LINE ที่ใช้แล้ว
--    วันลาคงเหลือ: ระบบคำนวณจากใบลาที่อนุมัติ → ลบใบลาทดสอบแล้ว ยอดคงเหลือกลับมาเอง
--
--    ขั้นตอน
--      1) แก้วันที่เริ่มทดสอบ ⬅️ (มี 2 จุด: ข้อ 1 และข้อ 2) ให้ตรงกัน
--      2) รันข้อ 1 ดูรายการที่จะถูกลบ — ตรวจให้แน่ใจว่าไม่มีใบลาจริงของพนักงาน
--         มีใบลาจริงปนอยู่ → ใส่รหัสพนักงานที่ต้องการเก็บไว้ในข้อ 1 (not in) และข้อ 2 (v_keep)
--      3) Export / Backup ฐานข้อมูลก่อน (ลบแล้วกู้คืนไม่ได้)
--      4) รันข้อ 2 ทั้งก้อน (do $$ … $$) — ถ้ามี error ระหว่างทาง จะไม่มีอะไรถูกลบเลย
--      5) รันข้อ 3 ตรวจผล
--      6) (ก่อนเปิดใช้จริง) รัน go_live_reset.sql ต่อ เพื่อล้างการเข้าระบบ / เครื่องที่จำไว้
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) 👀 ดูก่อน (อ่านอย่างเดียว)
-- ----------------------------------------------------------------------------
with t as (
  select l.id
  from public.leave_requests l
  join public.employees e on e.id = l.employee_id
  where l.created_at >= '2026-10-20 00:00+07'            -- ⬅️ วันที่เริ่มทดสอบ (จุดที่ 1)
    and e.employee_code not in ('__none__')              -- ⬅️ รหัสพนักงานที่ "ไม่ลบ" เช่น ('19013','19122')
)
select 'ใบลา' as รายการ, count(*) as จำนวน from t
union all select 'ขั้นอนุมัติของใบลา', count(*) from public.leave_approval_steps where leave_id in (select id from t)
union all select 'บันทึกการพิจารณา (หลักฐาน)', count(*) from public.leave_approval_logs where leave_id in (select id from t)
union all select 'ลิงก์อนุมัติใน LINE', count(*) from public.leave_action_links where leave_id in (select id from t)
union all select 'บันทึกการส่ง LINE', count(*) from public.line_message_logs where sent_at >= '2026-10-20 00:00+07'
union all select 'แจ้งเตือนในระบบ', count(*) from public.notifications where created_at >= '2026-10-20 00:00+07'
union all select 'รหัสผูก LINE ที่ไม่ถูกใช้', count(*) from public.line_link_tokens where used_at is null;

-- รายละเอียดใบลาที่จะถูกลบ
select l.created_at at time zone 'Asia/Bangkok' as สร้างเมื่อ, e.employee_code, e.full_name,
       l.start_date, l.end_date, l.total_days, l.status, left(l.reason, 50) as reason
from public.leave_requests l
join public.employees e on e.id = l.employee_id
where l.created_at >= '2026-10-20 00:00+07'              -- ⬅️ ให้ตรงกับด้านบน
  and e.employee_code not in ('__none__')
order by l.created_at desc;


-- ----------------------------------------------------------------------------
-- 2) 🧹 ลบ — รันทั้งก้อน (do $$ … $$) · ทำงานเป็นคำสั่งเดียว ถ้ามี error จะไม่มีอะไรถูกลบเลย
-- ----------------------------------------------------------------------------
do $$
declare
  v_cutoff timestamptz := '2026-10-20 00:00+07';        -- ⬅️ วันที่เริ่มทดสอบ (จุดที่ 2 — ให้ตรงกับข้อ 1)
  v_keep   text[]      := array['__none__'];              -- ⬅️ รหัสพนักงานที่ "ไม่ลบ" เช่น array['19013','19122']
  v_ids    uuid[];
  n        int;
begin
  select coalesce(array_agg(l.id), '{}') into v_ids
  from public.leave_requests l
  join public.employees e on e.id = l.employee_id
  where l.created_at >= v_cutoff
    and not (e.employee_code = any (v_keep));
  raise notice 'ใบลาทดสอบที่จะลบ: % ใบ', cardinality(v_ids);

  -- 2.1 บันทึกหลักฐานการพิจารณาของใบลาทดสอบ (ปกติลบไม่ได้ → ปิดตัวกันลบชั่วคราว)
  alter table public.leave_approval_logs disable trigger leave_approval_logs_no_update;
  delete from public.leave_approval_logs where leave_id = any (v_ids);
  alter table public.leave_approval_logs enable trigger leave_approval_logs_no_update;

  -- 2.2 บันทึกการส่ง LINE ช่วงทดสอบ (ปกติลบไม่ได้ → ปิดตัวกันลบชั่วคราว)
  alter table public.line_message_logs disable trigger line_message_logs_no_change;
  delete from public.line_message_logs where sent_at >= v_cutoff or leave_id = any (v_ids);
  alter table public.line_message_logs enable trigger line_message_logs_no_change;

  -- 2.3 ลิงก์อนุมัติใน LINE ของใบลาทดสอบ
  delete from public.leave_action_links where leave_id = any (v_ids);

  -- 2.4 ใบลา (ขั้นอนุมัติ leave_approval_steps ถูกลบตามอัตโนมัติ · รายการข้อตกลงวันหยุดที่อ้างถึงจะว่างลิงก์ใบลา)
  delete from public.leave_requests where id = any (v_ids);
  get diagnostics n = row_count;
  raise notice 'ลบใบลาแล้ว: % ใบ', n;

  -- 2.5 แจ้งเตือนในระบบ (กระดิ่ง) ช่วงทดสอบ
  delete from public.notifications where created_at >= v_cutoff;

  -- 2.6 รหัสผูก LINE ที่สร้างแล้วไม่ถูกใช้ (การผูกที่สำเร็จแล้วไม่กระทบ)
  delete from public.line_link_tokens where used_at is null;

  -- 2.7 (เลือกได้) ข้อตกลงวันหยุดพิเศษ / ข่าว ที่สร้างตอนทดสอบ — เอา -- ออกถ้าต้องการลบ
  -- delete from public.holiday_swap_rounds    where created_at >= v_cutoff;  -- รายชื่อพนักงานในรอบถูกลบตาม
  -- delete from public.company_announcements  where created_at >= v_cutoff;
end $$;


-- ----------------------------------------------------------------------------
-- 3) ✅ ตรวจผล
--    ใบลา_ช่วงทดสอบ = 0 · ตัวกันลบทั้ง 2 ตัวต้องเป็น O (เปิดอยู่)
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.leave_requests where created_at >= '2026-10-20 00:00+07') as ใบลา_ช่วงทดสอบ,
  (select count(*) from public.notifications  where created_at >= '2026-10-20 00:00+07') as แจ้งเตือน_ช่วงทดสอบ,
  (select tgenabled from pg_trigger where tgname = 'leave_approval_logs_no_update') as กันลบ_อนุมัติ,
  (select tgenabled from pg_trigger where tgname = 'line_message_logs_no_change')   as กันลบ_LINE;
