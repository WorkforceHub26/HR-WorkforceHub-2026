-- ============================================================================
-- 🔎 ตรวจยอดวันลาของพนักงาน 1 คน (อ่านอย่างเดียว ไม่แก้ข้อมูล)
--    รันใน Supabase > SQL Editor ของ MAIN · แก้รหัสพนักงานที่ ⬅️ (มี 2 จุด)
-- ============================================================================

-- 1) ใบลาทั้งหมดของรอบปีนี้ (1 ธ.ค. 2568 – 30 พ.ย. 2569) แยกประเภท
select l.created_at at time zone 'Asia/Bangkok' as ยื่นเมื่อ,
       t.leave_name as ประเภท, l.start_date, l.end_date,
       l.start_period, l.end_period, l.total_days, l.leave_hours,
       l.status, l.cancel_status,
       l.approved_at is not null as เคยอนุมัติครบ,
       left(coalesce(l.approval_comment, ''), 80) as หมายเหตุ
from public.leave_requests l
join public.employees e on e.id = l.employee_id
left join public.leave_types t on t.id = l.leave_type_id
where e.employee_code = '20030'                       -- ⬅️ รหัสพนักงาน
  and l.start_date >= '2025-12-01'
order by l.start_date, l.created_at;

-- 2) เทียบ "ยอดที่ระบบเก็บไว้" กับ "ยอดที่ควรเป็น" (รวม total_days ของใบลาที่อนุมัติแล้ว)
with e as (select id from public.employees where employee_code = '20030'),   -- ⬅️ รหัสพนักงาน
used as (
  select
    sum(l.total_days) filter (where t.leave_name ilike '%ป่วย%')                                 as sick,
    sum(l.total_days) filter (where t.leave_name ilike '%กิจ%')                                  as personal,
    sum(l.total_days) filter (where t.leave_name ilike '%พักร้อน%' or t.leave_name ilike '%พักผ่อน%') as vacation
  from public.leave_requests l
  join public.leave_types t on t.id = l.leave_type_id
  where l.employee_id = (select id from e) and l.status = 'approved'
    and l.start_date between '2025-12-01' and '2026-11-30'
)
select b.year,
       b.sick_used     as ป่วย_ระบบเก็บ,     coalesce(u.sick, 0)     as ป่วย_ควรเป็น,
       b.personal_used as กิจ_ระบบเก็บ,      coalesce(u.personal, 0) as กิจ_ควรเป็น,
       b.vacation_used as พักร้อน_ระบบเก็บ,  coalesce(u.vacation, 0) as พักร้อน_ควรเป็น
from public.employee_leave_balances b, used u
where b.employee_id = (select id from e) and b.year in (2026, 2569);
