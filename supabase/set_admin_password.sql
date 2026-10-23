-- ============================================================================
-- 🔐 ตั้งรหัสผ่านเฉพาะให้บัญชีผู้ดูแลระบบ (HR / Admin / ผู้บริหาร)
--    รันใน Supabase > SQL Editor  ** ก่อน ** อัปโหลดไฟล์ระบบล็อกอินชุดใหม่
--    (บัญชีผู้ดูแลระบบจะใช้รหัสพนักงาน / 1234 / 123456 เข้าไม่ได้อีก)
--
--    1) แก้ 'HR-001' เป็นรหัสพนักงานของบัญชีผู้ดูแล และ 'ตั้งรหัสใหม่ที่นี่' เป็นรหัสผ่านที่ต้องการ
--       (อย่างน้อย 8 ตัวอักษร ห้ามซ้ำกับรหัสพนักงาน) ทำซ้ำ 1 บรรทัดต่อ 1 บัญชี
--    2) รหัสผ่านถูกเก็บแบบเข้ารหัส bcrypt (อ่านย้อนกลับไม่ได้) — ระบบล็อกอินตรวจได้ทั้งแบบเข้ารหัสและแบบเดิม
--    3) เปลี่ยนรหัสภายหลัง: เข้าระบบ → คอนโซลผู้ดูแลระบบ → "เปลี่ยนรหัสผ่านผู้ดูแลระบบ"
-- ============================================================================
create extension if not exists pgcrypto;

update public.employees set password = crypt('ตั้งรหัสใหม่ที่นี่', gen_salt('bf', 10)), updated_at = now()
where employee_code = 'HR-001';

-- ตัวอย่างบัญชีที่ 2
-- update public.employees set password = crypt('รหัสของบัญชีที่สอง', gen_salt('bf', 10)), updated_at = now()
-- where employee_code = 'HR-002';

-- ✅ ตรวจดูว่าบัญชีผู้ดูแลระบบบัญชีไหน "ยังไม่ได้ตั้งรหัสผ่านเฉพาะ" (จะเข้าระบบไม่ได้จนกว่าจะตั้ง)
--    (หลังรัน migrations/20261023_auth_phase1_server_login.sql รหัสผ่านเก็บในตาราง employee_secrets — คอลัมน์ password จะว่างเสมอ)
select employee_code, full_name, role,
       case when coalesce((select s.password_hash from public.employee_secrets s where s.employee_id = e.id), nullif(btrim(e.password), '')) is null
              or btrim(coalesce(e.password, '')) = e.employee_code and not exists (select 1 from public.employee_secrets s where s.employee_id = e.id)
            then '❌ ยังไม่ได้ตั้ง' else '✅ ตั้งแล้ว' end as admin_password
from public.employees e
where lower(coalesce(role, '')) in ('hr', 'admin', 'superadmin', 'hr_manager', 'executive', 'director', 'owner')
   or lower(employee_code) like 'hr-%' or lower(employee_code) in ('admin', 'superadmin')
order by employee_code;
