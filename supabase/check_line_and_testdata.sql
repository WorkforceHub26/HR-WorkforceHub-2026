-- ============================================================================
-- 🔎 ตรวจ 2 เรื่อง บนฐานข้อมูล MAIN (Supabase > SQL Editor ของโปรเจกต์ pgogmhqjdchakcytsomx)
--    ไฟล์นี้ "อ่านอย่างเดียว" — ไม่แก้ ไม่ลบอะไร · รันทีละข้อแล้วดูผล
--
--    ข้อ 1–3  LINE ไม่แจ้งเตือนบน MAIN
--    ข้อ 4–6  ข้อมูลทดสอบจากเว็บ Dev ที่ลงฐาน MAIN (ก่อนแก้ 28/10/2569 เว็บ Dev ใช้ฐาน MAIN)
-- ============================================================================

-- 1) การส่ง LINE 30 ครั้งล่าสุด — ดูคอลัมน์ result และ error
--    result = 'no_line'  → ผู้รับยังไม่ได้ผูก LINE ในฐาน MAIN (ดูข้อ 2)
--    result = 'failed' + error มีคำว่า
--        "LINE_CHANNEL_ACCESS_TOKEN is not configured" → ยังไม่ได้ตั้ง secret ใน Supabase MAIN
--        "HTTP 404"                                    → ยังไม่ได้ deploy Edge Function line-send บน MAIN
--        "HTTP 401"                                    → เปิด Enforce JWT ไว้แต่คีย์ไม่ตรง / token LINE ผิด
--        "LINE API returned 400"                      → LINE User ID ไม่ใช่ของ LINE OA นี้ (ผูกใหม่)
--    ไม่มีแถวเลย / error "relation ... does not exist" → ยังไม่ได้รัน migrations/20261021_line_message_logs.sql
select sent_at at time zone 'Asia/Bangkok' as เวลา, msg_type, result, via, recipient_role, left(error, 160) as error
from public.line_message_logs
order by sent_at desc
limit 30;

-- 2) ผู้อนุมัติ / HR / ผู้บริหาร ที่ผูก LINE แล้วหรือยัง (ในฐาน MAIN)
select employee_code, full_name, role, status,
       case when coalesce(line_id, '') <> '' then '✅ ผูกแล้ว' else '❌ ยังไม่ผูก' end as line
from public.employees
where role in ('leader', 'supervisor', 'manager', 'hr', 'hr_manager', 'admin', 'superadmin', 'executive', 'director', 'owner')
order by (coalesce(line_id, '') = '') desc, role, employee_code;

-- 3) รหัสผูก LINE ที่สร้างแล้วแต่ไม่เคยถูกใช้ (used_at ว่าง)
--    มีหลายแถวที่หมดอายุโดยไม่ถูกใช้ = พนักงานส่งรหัสใน LINE แล้วแต่ webhook ไม่ได้มาที่ฐาน MAIN
--    → ตรวจ Webhook URL ใน LINE Developers ว่าเป็น https://pgogmhqjdchakcytsomx.supabase.co/functions/v1/line-webhook
select t.created_at at time zone 'Asia/Bangkok' as สร้างเมื่อ, e.employee_code, e.full_name, t.link_code,
       case when t.used_at is not null then 'ใช้แล้ว' when t.expires_at < now() then 'หมดอายุ (ไม่ถูกใช้)' else 'ยังใช้ได้' end as สถานะ
from public.line_link_tokens t
join public.employees e on e.id = t.employee_id
order by t.created_at desc
limit 30;

-- ---------------------------------------------------------------------------
-- 4) ใบลาที่สร้างในช่วงทดสอบ — แก้วันที่ให้ตรงช่วงที่ทดสอบจากเว็บ Dev
select l.created_at at time zone 'Asia/Bangkok' as สร้างเมื่อ, e.employee_code, e.full_name,
       l.start_date, l.end_date, l.total_days, l.status, left(l.reason, 60) as reason, l.id
from public.leave_requests l
join public.employees e on e.id = l.employee_id
where l.created_at >= '2026-10-20'          -- ⬅️ วันที่เริ่มทดสอบ
order by l.created_at desc;

-- 5) พนักงานที่เพิ่มในช่วงทดสอบ
select created_at at time zone 'Asia/Bangkok' as เพิ่มเมื่อ, employee_code, full_name, role, status, id
from public.employees
where created_at >= '2026-10-20'            -- ⬅️ วันที่เริ่มทดสอบ
order by created_at desc;

-- 6) ข้อตกลงวันหยุด / ข่าว ที่สร้างในช่วงทดสอบ
select 'ข้อตกลงวันหยุด' as ประเภท, created_at at time zone 'Asia/Bangkok' as เมื่อ, title as ชื่อ, status, id::text
from public.holiday_swap_rounds where created_at >= '2026-10-20'
union all
select 'ข่าว', created_at at time zone 'Asia/Bangkok', title, '', id::text
from public.company_announcements where created_at >= '2026-10-20'
order by 2 desc;

-- ⚠️ การลบข้อมูลทดสอบ: ลบแล้วกู้คืนไม่ได้ · Export ฐานข้อมูลก่อน และเลือกลบจาก id ที่ตรวจแล้วเท่านั้น
--    ใบลาที่อนุมัติแล้วตัดยอดวันลาไปแล้ว → ให้ "ยกเลิก" จากหน้า HR (ระบบคืนวันลาให้) แทนการลบตรงในฐานข้อมูล
--    ใบลาที่ยังรออนุมัติ ลบได้ตามตัวอย่าง (แก้ id เอง):
-- delete from public.leave_approval_steps where leave_id in ('<id>', '<id>');
-- delete from public.leave_requests       where id       in ('<id>', '<id>') and status = 'pending';
