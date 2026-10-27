-- ============================================================================
-- 👫 ประเภทการลา "ใช้กับเพศไหน" (ปุ่ม ชาย / หญิง ในหน้าตั้งค่าโควตากลาง)
--   รันใน Supabase > SQL Editor (DEV ก่อน แล้ว MAIN) · รันซ้ำได้
--
--   leave_types.gender_scope = 'all' (ทุกคน) | 'male' (เฉพาะชาย) | 'female' (เฉพาะหญิง)
--   เพศของพนักงานดูจากคำนำหน้าชื่อ (นาย = ชาย · นาง/นางสาว = หญิง) · ไม่มีคำนำหน้า = เห็นทุกประเภท
-- ============================================================================

-- 1) คอลัมน์ใหม่ (ค่าเริ่มต้น = ทุกคน)
alter table public.leave_types add column if not exists gender_scope text not null default 'all';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leave_types_gender_scope_chk') then
    alter table public.leave_types
      add constraint leave_types_gender_scope_chk check (gender_scope in ('all', 'male', 'female'));
  end if;
end $$;

-- 2) ลาคลอด = เฉพาะหญิง (ตั้งครั้งแรกเท่านั้น · ถ้าเปลี่ยนเองในหน้าตั้งค่าแล้ว จะไม่ทับ)
update public.leave_types
set gender_scope = 'female'
where gender_scope = 'all'
  and (upper(coalesce(leave_code, '')) = 'MATERNITY' or leave_name like '%คลอด%')
  and leave_name not like '%ช่วยภรรยา%' and leave_name not like '%ภริยา%';

-- 3) ✅ ตรวจผล
select leave_code, leave_name, status, gender_scope
from public.leave_types
order by status, leave_code;
