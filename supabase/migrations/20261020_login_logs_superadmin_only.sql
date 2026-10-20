-- ============================================================================
-- 🔒 ประวัติการเข้าสู่ระบบ (login_logs) — ดูได้เฉพาะผู้ดูแลระบบขั้นสูง (role = 'superadmin')
--
--   ก่อนหน้า: ทุกคนที่มี anon key อ่านตาราง login_logs ได้ทั้งหมด (policy using (true))
--   หลังรัน:
--     • ทุกหน้ายังบันทึกการเข้าสู่ระบบได้เหมือนเดิม (INSERT อย่างเดียว)
--     • อ่าน / ลบ ตรงจากตารางไม่ได้อีก (anon, authenticated)
--     • อ่านได้ผ่านฟังก์ชัน admin_get_login_logs() ซึ่งตรวจรหัสพนักงาน + รหัสผ่าน
--       ว่าเป็น superadmin ที่ active เท่านั้น (ใช้ในคอนโซลผู้ดูแลระบบ ส่วนขั้นสูง)
--     • ลบข้อมูลเก่าผ่าน admin_purge_login_logs() (ตรวจสิทธิ์แบบเดียวกัน)
--     • ประวัติเข้าระบบเก่าที่เคยถูกเก็บสำรองไว้ใน hr_admin_management_logs
--       (action_category = 'LOGIN_AUDIT') จะถูกซ่อนจากการอ่านทั่วไปด้วย
--
--   รันใน Supabase > SQL Editor ทั้ง MAIN และ DEV · รันซ้ำได้
--   ต้องรัน supabase/admin_levels.sql (ตั้งบัญชี superadmin + รหัสผ่าน bcrypt) มาก่อน
-- ============================================================================
create extension if not exists pgcrypto;

-- 1) ตาราง login_logs: เขียนได้ อ่าน/แก้/ลบไม่ได้ ---------------------------------
alter table public.login_logs enable row level security;

drop policy if exists "Allow read login_logs" on public.login_logs;
drop policy if exists "Allow insert login_logs" on public.login_logs;
create policy "Allow insert login_logs" on public.login_logs
  for insert to anon, authenticated with check (true);

revoke select, update, delete, truncate on public.login_logs from anon, authenticated;
grant insert on public.login_logs to anon, authenticated;

-- 2) ตรวจสิทธิ์ผู้ดูแลระบบขั้นสูง (ใช้ภายในเท่านั้น) ------------------------------
create or replace function public._verify_superadmin(p_code text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_pw text;
begin
  select e.id, e.password into v_id, v_pw
  from public.employees e
  where lower(e.employee_code) = lower(trim(coalesce(p_code, '')))
    and lower(coalesce(e.role, '')) = 'superadmin'
    and lower(coalesce(e.status, 'active')) = 'active'
  limit 1;

  -- ผู้ดูแลระบบขั้นสูงต้องใช้รหัสผ่านแบบเข้ารหัส bcrypt เท่านั้น (ดู admin_levels.sql)
  if v_id is null or v_pw is null or v_pw !~ '^\$2[aby]\$'
     or crypt(coalesce(p_password, ''), v_pw) <> v_pw then
    perform pg_sleep(1); -- หน่วงเวลาเมื่อรหัสผิด กันการเดารหัส
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return v_id;
end;
$$;

revoke all on function public._verify_superadmin(text, text) from public, anon, authenticated;

-- 3) อ่านประวัติการเข้าสู่ระบบ -----------------------------------------------------
create or replace function public.admin_get_login_logs(
  p_code text,
  p_password text,
  p_limit int default 500,
  p_from date default null,
  p_to date default null
)
returns setof public.login_logs
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public._verify_superadmin(p_code, p_password);

  return query
    select l.*
    from public.login_logs l
    where (p_from is null or l.timestamp >= (p_from::timestamp at time zone 'Asia/Bangkok'))
      and (p_to   is null or l.timestamp <  ((p_to + 1)::timestamp at time zone 'Asia/Bangkok'))
    order by l.timestamp desc
    limit least(greatest(coalesce(p_limit, 500), 1), 2000);
end;
$$;

revoke all on function public.admin_get_login_logs(text, text, int, date, date) from public;
grant execute on function public.admin_get_login_logs(text, text, int, date, date) to anon, authenticated;

-- 4) ลบประวัติที่เก่ากว่า N วัน (ค่าเริ่มต้น 90 วัน ตาม PDPA) ------------------------
create or replace function public.admin_purge_login_logs(
  p_code text,
  p_password text,
  p_days int default 90
)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count int;
begin
  perform public._verify_superadmin(p_code, p_password);

  if coalesce(p_days, 0) < 30 then
    raise exception 'ต้องเก็บประวัติไว้อย่างน้อย 30 วัน';
  end if;

  delete from public.login_logs
  where timestamp < now() - make_interval(days => p_days);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_purge_login_logs(text, text, int) from public;
grant execute on function public.admin_purge_login_logs(text, text, int) to anon, authenticated;

-- 5) ซ่อนประวัติเข้าระบบเก่าที่เคยสำรองไว้ใน hr_admin_management_logs ------------
--    (ประวัติการแก้ไขข้อมูลอื่น ๆ ยังอ่านได้เหมือนเดิม)
drop policy if exists "Allow read hr_admin_management_logs" on public.hr_admin_management_logs;
create policy "Allow read hr_admin_management_logs" on public.hr_admin_management_logs
  for select to anon, authenticated
  using (action_category is distinct from 'LOGIN_AUDIT');

-- (ไม่บังคับ) ถ้าต้องการลบประวัติเข้าระบบเก่าในตารางสำรองทิ้งเลย:
-- delete from public.hr_admin_management_logs where action_category = 'LOGIN_AUDIT';

-- ✅ ตรวจผล
--   1) ต้องเห็น policy ของ login_logs แค่ INSERT
select policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename = 'login_logs';
--   2) anon ต้องไม่มีสิทธิ์ SELECT (ผลต้องเป็น false)
select has_table_privilege('anon', 'public.login_logs', 'select') as anon_can_read_login_logs;
