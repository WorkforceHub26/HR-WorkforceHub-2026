-- ============================================================================
-- 🧮 คำนวณยอด "ใช้ไป" ใน employee_leave_balances ใหม่จากใบลาที่อนุมัติแล้ว
--    ใช้แก้ยอดที่เพี้ยนจากระบบเดิม (บวก/ลบทีละครั้ง) · รอบปีการลา 2569 = 1 ธ.ค. 2568 – 30 พ.ย. 2569
--    รันใน Supabase > SQL Editor ของ MAIN
--
--    ขั้นตอน
--      1) รันข้อ 1 ดูเฉพาะคนที่ยอดไม่ตรง (อ่านอย่างเดียว)
--         ⚠️ ถ้ามีคนที่ HR ตั้งยอด "ใช้ไป" เอง (เช่น ยกยอดวันลาที่ใช้ก่อนเริ่มใช้ระบบ) จะขึ้นในรายการนี้ด้วย
--            → ใส่รหัสพนักงานคนนั้นใน v_keep (ข้อ 2) เพื่อไม่ให้ถูกแก้
--      2) รันข้อ 2 (do $$ … $$) แก้ยอดให้ตรง
--      3) รันข้อ 1 อีกครั้ง ต้องไม่มีแถว
-- ============================================================================

-- 1) 👀 คนที่ยอดไม่ตรง (ปีการลา 2026 = พ.ศ. 2569)
with lv as (
  select l.employee_id,
         coalesce(nullif(l.charge_year, 0),
                  extract(year from l.start_date)::int + case when extract(month from l.start_date) = 12 then 1 else 0 end) as yr,
         case
           when upper(coalesce(t.leave_code,'')) in ('SICK','01') or upper(coalesce(t.leave_code,'')) like '%SICK%' or t.leave_name like '%ป่วย%' then 'sick'
           when upper(coalesce(t.leave_code,'')) in ('PERSONAL','02') or upper(coalesce(t.leave_code,'')) like '%PERSONAL%' or t.leave_name like '%กิจ%' then 'personal'
           when upper(coalesce(t.leave_code,'')) in ('VACATION','03') or upper(coalesce(t.leave_code,'')) like '%VACATION%' or t.leave_name like '%พัก%' then 'vacation'
           when upper(coalesce(t.leave_code,'')) like '%MATERNITY%' or t.leave_name like '%คลอด%' then 'maternity'
           else 'other' end as cat,
         coalesce(l.total_days, 0) as days
  from public.leave_requests l
  join public.leave_types t on t.id = l.leave_type_id
  where l.status = 'approved'
    and not (l.swap_round_id is not null and t.paid_leave = false)
),
s as (
  select employee_id, yr,
         sum(days) filter (where cat = 'sick') as sick, sum(days) filter (where cat = 'personal') as personal,
         sum(days) filter (where cat = 'vacation') as vacation, sum(days) filter (where cat = 'maternity') as maternity,
         sum(days) filter (where cat = 'other') as other
  from lv group by employee_id, yr
)
select e.employee_code, e.full_name,
       b.personal_used as กิจ_เก็บ,   coalesce(s.personal, 0)  as กิจ_ควรเป็น,
       b.vacation_used as พักร้อน_เก็บ, coalesce(s.vacation, 0) as พักร้อน_ควรเป็น,
       b.sick_used as ป่วย_เก็บ,      coalesce(s.sick, 0)      as ป่วย_ควรเป็น,
       b.maternity_used as คลอด_เก็บ, coalesce(s.maternity, 0) as คลอด_ควรเป็น,
       b.other_used as อื่น_เก็บ,      coalesce(s.other, 0)     as อื่น_ควรเป็น
from public.employee_leave_balances b
join public.employees e on e.id = b.employee_id
left join s on s.employee_id = b.employee_id and s.yr = b.year
where b.year = 2026
  and (coalesce(b.personal_used,0) <> coalesce(s.personal,0) or coalesce(b.vacation_used,0) <> coalesce(s.vacation,0)
    or coalesce(b.sick_used,0) <> coalesce(s.sick,0) or coalesce(b.maternity_used,0) <> coalesce(s.maternity,0)
    or coalesce(b.other_used,0) <> coalesce(s.other,0))
order by e.employee_code;


-- 2) 🛠 แก้ยอดให้ตรง — รันทั้งก้อน
do $$
declare
  v_year int    := 2026;                   -- ⬅️ ปีการลา (ค.ศ.)
  v_keep text[] := array['__none__'];      -- ⬅️ รหัสพนักงานที่ "ไม่แก้" (HR ตั้งยอดเอง) เช่น array['19013']
  n int;
begin
  with lv as (
    select l.employee_id,
           coalesce(nullif(l.charge_year, 0),
                    extract(year from l.start_date)::int + case when extract(month from l.start_date) = 12 then 1 else 0 end) as yr,
           case
             when upper(coalesce(t.leave_code,'')) in ('SICK','01') or upper(coalesce(t.leave_code,'')) like '%SICK%' or t.leave_name like '%ป่วย%' then 'sick'
             when upper(coalesce(t.leave_code,'')) in ('PERSONAL','02') or upper(coalesce(t.leave_code,'')) like '%PERSONAL%' or t.leave_name like '%กิจ%' then 'personal'
             when upper(coalesce(t.leave_code,'')) in ('VACATION','03') or upper(coalesce(t.leave_code,'')) like '%VACATION%' or t.leave_name like '%พัก%' then 'vacation'
             when upper(coalesce(t.leave_code,'')) like '%MATERNITY%' or t.leave_name like '%คลอด%' then 'maternity'
             else 'other' end as cat,
           coalesce(l.total_days, 0) as days
    from public.leave_requests l
    join public.leave_types t on t.id = l.leave_type_id
    where l.status = 'approved'
      and not (l.swap_round_id is not null and t.paid_leave = false)
  ),
  s as (
    select employee_id, yr,
           coalesce(sum(days) filter (where cat = 'sick'), 0) as sick, coalesce(sum(days) filter (where cat = 'personal'), 0) as personal,
           coalesce(sum(days) filter (where cat = 'vacation'), 0) as vacation, coalesce(sum(days) filter (where cat = 'maternity'), 0) as maternity,
           coalesce(sum(days) filter (where cat = 'other'), 0) as other
    from lv group by employee_id, yr
  )
  update public.employee_leave_balances b
     set sick_used = coalesce(s.sick, 0), personal_used = coalesce(s.personal, 0), vacation_used = coalesce(s.vacation, 0),
         maternity_used = coalesce(s.maternity, 0), other_used = coalesce(s.other, 0), updated_at = now()
    from public.employees e
    left join s on s.employee_id = e.id and s.yr = v_year
   where e.id = b.employee_id
     and b.year = v_year
     and not (e.employee_code = any (v_keep))
     and (coalesce(b.personal_used,0) <> coalesce(s.personal,0) or coalesce(b.vacation_used,0) <> coalesce(s.vacation,0)
       or coalesce(b.sick_used,0) <> coalesce(s.sick,0) or coalesce(b.maternity_used,0) <> coalesce(s.maternity,0)
       or coalesce(b.other_used,0) <> coalesce(s.other,0));
  get diagnostics n = row_count;
  raise notice 'แก้ยอดแล้ว % คน', n;
end $$;
