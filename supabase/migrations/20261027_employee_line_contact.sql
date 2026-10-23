-- ============================================================================
-- 📇 แยก "LINE ไว้ติดต่อ" ออกจาก "LINE รับแจ้งเตือน" + กันรหัสพนักงานซ้ำแบบไม่สนตัวพิมพ์
--   รันใน Supabase > SQL Editor (DEV ก่อน แล้ว MAIN) · รันซ้ำได้
--
--   employees.line_id       = รหัสผู้ใช้ LINE ที่ระบบได้มาตอนผูกบัญชี (U + 32 ตัว) ใช้ส่งแจ้งเตือน — HR ไม่ต้องพิมพ์
--   employees.line_contact  = ไอดีที่ไว้ค้นหาเพื่อน/ติดต่อ (เช่น somchai.88) — เป็นแค่ข้อมูลติดต่อ (ใหม่)
--
--   ข้อมูลเดิม: line_id ที่ไม่ใช่รหัส U… (HR เคยพิมพ์ไอดีค้นหาเพื่อนลงไป ซึ่งส่งแจ้งเตือนไม่ได้อยู่แล้ว)
--   → ย้ายไปไว้ใน line_contact แล้วล้าง line_id · คนพวกนี้จะขึ้นว่า "ยังไม่ผูก LINE" ตามจริง
-- ============================================================================

-- 0) ดูก่อนว่าจะย้ายใครบ้าง (ไม่บังคับ)
-- select employee_code, full_name, line_id from public.employees
-- where line_id is not null and btrim(line_id) <> '' and btrim(line_id) !~ '^U[0-9a-fA-F]{32}$';

-- 1) คอลัมน์ใหม่
alter table public.employees add column if not exists line_contact text;

-- 2) ย้ายค่าที่ไม่ใช่รหัสผู้ใช้ LINE ออกจาก line_id
update public.employees
set line_contact = coalesce(nullif(btrim(line_contact), ''), btrim(line_id)),
    line_id = null
where line_id is not null
  and btrim(line_id) <> ''
  and btrim(line_id) !~ '^U[0-9a-fA-F]{32}$';

update public.employees set line_id = null where line_id is not null and btrim(line_id) = '';

-- 3) กันรหัสพนักงานซ้ำแบบไม่สนตัวพิมพ์/ช่องว่างหัวท้าย (ของเดิม UNIQUE แยกตัวพิมพ์ เช่น A001 กับ a001 ผ่านได้)
--    ถ้ามีรหัสชนกันอยู่แล้ว จะข้ามขั้นนี้ และแสดงรายชื่อให้แก้ก่อน (ดูข้อ 4)
do $$
begin
  if exists (
    select 1 from public.employees
    group by lower(btrim(employee_code)) having count(*) > 1
  ) then
    raise notice 'พบรหัสพนักงานที่ซ้ำกันแบบไม่สนตัวพิมพ์ — ยังไม่สร้างดัชนีกันซ้ำ ดูรายชื่อในผลข้อ 4 แล้วแก้ก่อนรันใหม่';
  else
    execute 'create unique index if not exists employees_code_ci_uniq on public.employees (lower(btrim(employee_code)))';
  end if;
end $$;

-- 4) ✅ ตรวจผล
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'employees' and column_name = 'line_contact') as line_contact_ready,  -- ต้องเป็น 1
  (select count(*) from public.employees where line_id is not null and btrim(line_id) !~ '^U[0-9a-fA-F]{32}$') as bad_line_id_left,  -- ต้องเป็น 0
  (select count(*) from public.employees where line_contact is not null) as with_line_contact,
  (select count(*) from pg_indexes where schemaname = 'public' and indexname = 'employees_code_ci_uniq') as code_ci_index,  -- 1 = กันซ้ำแล้ว
  (select string_agg(codes, ' | ') from (
     select string_agg(employee_code, ', ') as codes from public.employees
     group by lower(btrim(employee_code)) having count(*) > 1) d) as duplicate_codes;  -- ต้องว่าง
