-- ============================================================================
-- 🧹 ล้างข้อมูลทดสอบ "ทั้งหมด" ก่อนเปิดใช้งานจริง — เก็บรายชื่อพนักงานและการตั้งค่าไว้
--    รันใน Supabase > SQL Editor ของฐานที่จะเปิดใช้จริง (MAIN = pgogmhqjdchakcytsomx)
--
--    ✅ เก็บไว้ (ไม่แตะ)
--       พนักงาน (employees) + รหัสผ่าน + ไอดี LINE ไว้ติดต่อ (line_contact) · แผนก · ตำแหน่ง · ทีม/สายอนุมัติ · หัวหน้าแผนก
--       ประเภทการลา + โควตากลาง · วันหยุดบริษัท · การตั้งค่าระบบ (system_settings) · ประกาศความเป็นส่วนตัว (ฉบับ)
--       สิทธิ์วันลาของแต่ละคน (ช่อง *_total / custom_totals) — ล้างเฉพาะ "ใช้ไป" กลับเป็น 0
--
--    🗑 ล้าง
--       ใบลาทั้งหมด + ขั้นอนุมัติ + หลักฐานการพิจารณา + ลิงก์อนุมัติใน LINE
--       แจ้งเตือนในระบบ · บันทึกการส่ง LINE · รหัสผูก LINE
--       การผูก LINE ของพนักงาน (employees.line_id) — ทุกคนต้องผูกใหม่บนเว็บจริง (ตั้งได้ที่ v_line / v_line_keep)
--       ยอด "ใช้ไป" ในสิทธิ์วันลา → 0
--       ข้อตกลงวันหยุดพิเศษ (รอบ + รายชื่อ + วันหยุดที่ระบบเพิ่มจากข้อตกลง) · ยืนยันสรุปวันลา · คำขอแก้ไขข้อมูลพนักงาน
--       ประวัติเข้าระบบ · ประวัติการทำงานของ HR/Admin · การเข้าระบบที่ค้าง / เครื่องที่จำไว้ / ประวัติใส่รหัสผิด
--       ลงเวลา / OT (ถ้ามีตาราง)
--       ข่าวสาร/ประกาศองค์กร (ตั้งได้ที่ v_news)
--    ⚪ เลือกได้ (ค่าเริ่มต้น = ไม่ล้าง)
--       v_privacy  การกดยอมรับประกาศความเป็นส่วนตัว (หลักฐาน PDPA)
--       v_biometric เครื่องที่ลงทะเบียนสแกนนิ้ว/ใบหน้า
--
--    ขั้นตอน
--      1) รันข้อ 1 ดูจำนวนข้อมูลที่จะถูกล้าง (อ่านอย่างเดียว)
--      2) Backup ฐานข้อมูลก่อน (Database > Backups หรือ Export) — ลบแล้วกู้คืนไม่ได้
--      3) ตั้งค่า v_… ในข้อ 2 แล้วรันทั้งก้อน (do $$ … $$) — ถ้ามี error จะไม่มีอะไรถูกลบเลย
--      4) รันข้อ 3 ตรวจผล
--    หมายเหตุ: ไฟล์แนบใบลา (รูป/ใบรับรองแพทย์) ใน Storage ไม่ถูกลบ — ลบเองได้ที่ Storage > bucket ของไฟล์แนบ
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) 👀 ดูก่อน: จำนวนแถวในแต่ละตาราง (ตารางที่ไม่มีในฐานนี้จะไม่แสดง)
-- ----------------------------------------------------------------------------
select t as ตาราง,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t), false, true, '')))[1]::text::int as จำนวน
from unnest(array[
  'leave_requests', 'leave_approval_steps', 'leave_approval_logs', 'leave_action_links',
  'notifications', 'line_message_logs', 'line_link_tokens',
  'holiday_swap_rounds', 'holiday_swap_items', 'leave_confirmations', 'employee_change_requests',
  'login_logs', 'hr_admin_management_logs', 'auth_sessions', 'auth_devices', 'auth_attempts',
  'attendance_logs', 'qr_attendance_logs', 'overtime_requests',
  'company_announcements', 'announcements', 'privacy_acceptances', 'webauthn_credentials'
]) as t
where to_regclass('public.' || t) is not null
union all
select 'employees ที่ผูก LINE ไว้ (line_id)',
       (select count(*)::int from public.employees where coalesce(btrim(line_id), '') <> '')
union all
select 'employee_leave_balances (แถวที่มียอดใช้ไป)',
       (select count(*)::int from public.employee_leave_balances
        where coalesce(sick_used,0) + coalesce(personal_used,0) + coalesce(vacation_used,0)
            + coalesce(maternity_used,0) + coalesce(other_used,0) > 0);


-- ----------------------------------------------------------------------------
-- 2) 🧹 ล้าง — รันทั้งก้อน
-- ----------------------------------------------------------------------------
do $$
declare
  v_news      boolean := true;    -- ⬅️ ล้างข่าวสาร/ประกาศองค์กร (false = เก็บไว้)
  v_privacy   boolean := false;   -- ⬅️ ล้างการกดยอมรับประกาศความเป็นส่วนตัว (ใช้เฉพาะเมื่อยังไม่มีพนักงานจริงกดยอมรับ)
  v_biometric boolean := false;   -- ⬅️ ล้างเครื่องที่ลงทะเบียนสแกนนิ้ว/ใบหน้า
  v_line      boolean := true;    -- ⬅️ ล้างการผูก LINE ของพนักงาน (employees.line_id) ทุกคน
  v_line_keep text[]  := array['__none__'];   -- ⬅️ รหัสพนักงานที่ผูก LINE จริงแล้ว ไม่ต้องล้าง เช่น array['19074']

  -- ลบทั้งตาราง (ถ้ามีตาราง) · ปิดตัวกันลบชั่วคราวถ้ามี
  tbls text[] := array[
    'leave_action_links', 'leave_approval_steps', 'holiday_swap_items', 'holiday_swap_rounds',
    'leave_approval_logs', 'leave_requests',
    'notifications', 'line_message_logs', 'line_link_tokens',
    'leave_confirmations', 'employee_change_requests',
    'login_logs', 'hr_admin_management_logs', 'auth_devices', 'auth_attempts',
    'attendance_logs', 'qr_attendance_logs', 'overtime_requests'
  ];
  guards text[][] := array[
    array['leave_approval_logs', 'leave_approval_logs_no_update'],
    array['line_message_logs',   'line_message_logs_no_change'],
    array['leave_confirmations', 'leave_confirmations_no_change'],
    array['privacy_acceptances', 'privacy_acceptances_no_change']
  ];
  t text;
  i int;
  n int;
begin
  -- ปิดตัวกันลบ (ตารางหลักฐาน) ชั่วคราว
  for i in 1 .. array_length(guards, 1) loop
    if to_regclass('public.' || guards[i][1]) is not null
       and exists (select 1 from pg_trigger where tgname = guards[i][2]) then
      execute format('alter table public.%I disable trigger %I', guards[i][1], guards[i][2]);
    end if;
  end loop;

  -- วันหยุดที่ระบบเพิ่มให้จากข้อตกลงวันหยุดพิเศษ (ย้ายวันหยุด / วันแลก) → ลบพร้อมรอบ
  --   วันหยุดบริษัทที่ HR เพิ่มเองไม่ถูกลบ
  if to_regclass('public.holidays') is not null and to_regclass('public.holiday_swap_rounds') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'holidays' and column_name = 'agreement_id') then
      delete from public.holidays where agreement_id in (select id from public.holiday_swap_rounds);
      get diagnostics n = row_count;
      raise notice 'ล้าง holidays (จากข้อตกลงวันหยุดพิเศษ) : % แถว', n;
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'holidays' and column_name = 'holiday_type') then
      delete from public.holidays h using public.holiday_swap_rounds r
       where h.holiday_type = 'swap_day' and h.holiday_name = r.title and h.holiday_date = any (r.swap_dates);
    end if;
  end if;

  foreach t in array tbls loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I', t);
      get diagnostics n = row_count;
      raise notice 'ล้าง % : % แถว', t, n;
    end if;
  end loop;

  -- ออกจากระบบทุกคนทุกเครื่อง (ครั้งหน้าต้องเข้าระบบใหม่)
  if to_regclass('public.auth_sessions') is not null then
    delete from public.auth_sessions;
  end if;

  -- สิทธิ์วันลา: เก็บสิทธิ์ (total) · ล้าง "ใช้ไป" เป็น 0
  update public.employee_leave_balances
     set sick_used = 0, personal_used = 0, vacation_used = 0, maternity_used = 0, other_used = 0, updated_at = now()
   where coalesce(sick_used,0) + coalesce(personal_used,0) + coalesce(vacation_used,0)
       + coalesce(maternity_used,0) + coalesce(other_used,0) <> 0;

  -- การผูก LINE: ล้าง line_id (ไอดีไว้ติดต่อ line_contact ไม่ถูกแตะ)
  if v_line then
    update public.employees set line_id = null
     where coalesce(btrim(line_id), '') <> ''
       and not (coalesce(employee_code, '') = any (v_line_keep));
    get diagnostics n = row_count;
    raise notice 'ล้างการผูก LINE : % คน', n;
  end if;

  if v_news then
    if to_regclass('public.company_announcements') is not null then delete from public.company_announcements; end if;
    if to_regclass('public.announcements') is not null then delete from public.announcements; end if;
  end if;
  if v_privacy and to_regclass('public.privacy_acceptances') is not null then
    delete from public.privacy_acceptances;
  end if;
  if v_biometric and to_regclass('public.webauthn_credentials') is not null then
    delete from public.webauthn_credentials;
  end if;

  -- เปิดตัวกันลบกลับ
  for i in 1 .. array_length(guards, 1) loop
    if to_regclass('public.' || guards[i][1]) is not null
       and exists (select 1 from pg_trigger where tgname = guards[i][2]) then
      execute format('alter table public.%I enable trigger %I', guards[i][1], guards[i][2]);
    end if;
  end loop;

  raise notice '✅ ล้างข้อมูลทดสอบเรียบร้อย';
end $$;


-- ----------------------------------------------------------------------------
-- 3) ✅ ตรวจผล — ใบลา/แจ้งเตือน/ยอดใช้ไป ต้องเป็น 0 · ตัวกันลบต้องเป็น O (เปิดอยู่) · พนักงานยังอยู่ครบ
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.employees)        as พนักงาน_คงอยู่,
  (select count(*) from public.leave_requests)   as ใบลา,
  (select count(*) from public.notifications)    as แจ้งเตือน,
  (select count(*) from public.employees where coalesce(btrim(line_id), '') <> '') as ยังผูก_LINE,
  (select count(*) from public.employee_leave_balances
    where coalesce(sick_used,0) + coalesce(personal_used,0) + coalesce(vacation_used,0)
        + coalesce(maternity_used,0) + coalesce(other_used,0) <> 0) as คนที่ยังมียอดใช้ไป,
  (select string_agg(tgname || '=' || tgenabled::text, ', ' order by tgname) from pg_trigger
    where tgname in ('leave_approval_logs_no_update', 'line_message_logs_no_change',
                     'leave_confirmations_no_change', 'privacy_acceptances_no_change')) as ตัวกันลบ;
