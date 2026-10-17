-- แก้ "new row violates row-level security policy for table hr_admin_management_logs" (401)
-- ตอนบันทึกประวัติการแก้ไขข้อมูลพนักงานในหน้า "ระบบจัดการส่วนกลาง"
-- รันใน Supabase > SQL Editor ทั้ง MAIN และ DEV · รันซ้ำได้
-- ประวัติการทำงานของผู้ดูแล = เพิ่มและอ่านได้เท่านั้น (ไม่เปิดให้แก้/ลบ เพื่อให้เป็นหลักฐานที่เชื่อถือได้)

grant select, insert on public.hr_admin_management_logs to anon, authenticated;

alter table public.hr_admin_management_logs enable row level security;

drop policy if exists "Allow insert hr_admin_management_logs" on public.hr_admin_management_logs;
create policy "Allow insert hr_admin_management_logs" on public.hr_admin_management_logs
  for insert to anon, authenticated with check (true);

drop policy if exists "Allow read hr_admin_management_logs" on public.hr_admin_management_logs;
create policy "Allow read hr_admin_management_logs" on public.hr_admin_management_logs
  for select to anon, authenticated using (true);

-- ตรวจ: ต้องเห็น 2 นโยบาย (INSERT, SELECT)
select policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename = 'hr_admin_management_logs' order by cmd;
