-- ============================================================================
-- 🛡️ ระดับผู้ดูแลระบบ (คอนโซลผู้ดูแลระบบ /pages/hr/admin-dashboard.html)
--    role = 'superadmin' → ผู้ดูแลระบบขั้นสูง (เช่น ADMIN-T)
--                          สร้าง / ลบ / รีเซ็ตรหัสผ่าน / ระงับ ผู้ดูแลระบบขั้นต้น ได้ในหน้าคอนโซล
--    role = 'admin'      → ผู้ดูแลระบบขั้นต้น (เช่น HR001, HR002, HR003)
--                          เข้าคอนโซลและหน้า HR ได้ แต่จัดการผู้ดูแลระบบคนอื่นไม่ได้
--    บัญชีอื่น (รวม role 'hr') เข้าคอนโซลไม่ได้
--
--    รันใน Supabase > SQL Editor ทั้ง 2 โปรเจกต์ (DEV และเว็บจริง)
--    แก้ 'ตั้งรหัสผ่านขั้นสูงที่นี่' ก่อนรัน (อย่างน้อย 8 ตัวอักษร)
-- ============================================================================
create extension if not exists pgcrypto;

-- 1) สร้างบัญชีผู้ดูแลระบบขั้นสูง ADMIN-T (ถ้ามีอยู่แล้ว → ตั้งเป็นขั้นสูง + เปลี่ยนรหัส)
insert into public.employees (employee_code, full_name, role, status, password)
values ('ADMIN-T', 'ผู้ดูแลระบบขั้นสูง', 'superadmin', 'active', crypt('ตั้งรหัสผ่านขั้นสูงที่นี่', gen_salt('bf', 10)))
on conflict (employee_code) do update
set role = 'superadmin', status = 'active', password = excluded.password, updated_at = now();

-- 2) (ถ้าต้องการ) บัญชี ADMIN เดิม → ผู้ดูแลระบบขั้นต้น (role admin อยู่แล้ว ไม่ต้องทำอะไร)
--    หรือถ้าไม่ใช้แล้ว ระงับไว้:
-- update public.employees set status = 'inactive', updated_at = now() where employee_code = 'ADMIN';

-- 3) HR001 / HR002 / HR003 → สร้างจากหน้าคอนโซลด้วยบัญชี ADMIN-T
--    (คอนโซลผู้ดูแลระบบ → จัดการผู้ดูแลระบบ → เพิ่มผู้ดูแลระบบขั้นต้น)

-- ✅ ตรวจสอบ
select employee_code, full_name, role, status,
       case when role = 'superadmin' then 'ขั้นสูง' when role = 'admin' then 'ขั้นต้น' end as admin_level,
       case when password like '$2%' then 'เข้ารหัสแล้ว' else 'ยังไม่เข้ารหัส/ยังไม่ตั้ง' end as password_state
from public.employees
where role in ('admin', 'superadmin')
order by role desc, employee_code;
