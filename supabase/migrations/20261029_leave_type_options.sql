-- ============================================================================
-- ⚙️ ตัวเลือกเพิ่มของประเภทการลา (หน้าตั้งค่าโควตากลาง) + โควตารายคนของประเภทที่เพิ่มเอง
--   รันใน Supabase > SQL Editor (DEV ก่อน แล้ว MAIN) · รันซ้ำได้ · ไม่ลบ/ไม่เปลี่ยนข้อมูลเดิม
--
--   leave_types.paid_leave   true = ได้รับค่าจ้าง (ค่าเริ่มต้น) · false = ไม่รับค่าจ้าง
--   leave_types.unlimited    true = ไม่จำกัดจำนวนวัน (ไม่ตรวจสิทธิ์คงเหลือ · ยังนับวันที่ใช้ไป)
--   employee_leave_balances.custom_totals
--       สิทธิ์รายคนของประเภทที่เพิ่มเอง (ไม่ใช่ ป่วย/กิจ/พักร้อน/คลอด) เช่น {"<leave_type_id>": 4}
--       ไม่มีค่า = ใช้โควตากลางของประเภทนั้น
-- ============================================================================

alter table public.leave_types add column if not exists paid_leave boolean not null default true;
alter table public.leave_types add column if not exists unlimited  boolean not null default false;
alter table public.employee_leave_balances add column if not exists custom_totals jsonb not null default '{}'::jsonb;

-- ✅ ตรวจผล
select leave_code, leave_name, status, yearly_quota, paid_leave, unlimited
from public.leave_types
order by status, leave_code;
