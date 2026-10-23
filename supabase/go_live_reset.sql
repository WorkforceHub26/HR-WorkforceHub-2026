-- ============================================================================
-- 🚀 ล้างข้อมูลทดสอบก่อนเปิดใช้งานจริง (การเข้าระบบ · เครื่องที่จำไว้ · ลิงก์ LINE · ความยินยอม)
--   รันใน Supabase > SQL Editor ของฐานข้อมูลที่จะเปิดใช้จริง (MAIN) · รันครั้งเดียวก่อนเปิดให้พนักงานใช้
--   ไม่ลบ: ข้อมูลพนักงาน รหัสผ่าน HR/Admin ใบลา โควตา สายอนุมัติ
--
--   ขั้นตอน
--     1) รันข้อ 0 ดูตัวเลขก่อน
--     2) รันข้อ 1 (ทุกคนออกจากระบบ + ลืมเครื่องที่จำไว้ + ล้างลิงก์ LINE + ล้างประวัติใส่รหัสผิด)
--     3) ความยินยอม (PDPA): ทางที่แนะนำคือ "ออกประกาศฉบับจริง" ในหน้าคอนโซลผู้ดูแลระบบ (ไม่ต้องรันข้อ 2)
--        ข้อ 2 ใช้เฉพาะกรณียังไม่มีพนักงานจริงคนไหนกดยอมรับเลย
-- ============================================================================

-- 0) ดูก่อนว่ามีข้อมูลทดสอบเท่าไร
select
  (select count(*) from public.auth_sessions where revoked_at is null and expires_at > now()) as sessions_active,
  (select count(*) from public.auth_devices) as devices_remembered,
  (select count(*) from public.leave_action_links where used_at is null) as line_links_unused,
  (select count(*) from public.auth_attempts) as login_attempts,
  (select count(*) from public.privacy_acceptances) as privacy_acceptances,
  (select count(distinct employee_id) from public.privacy_acceptances) as privacy_people;

-- 1) ล้างข้อมูลการเข้าระบบ
--    ทุกคนออกจากระบบทุกเครื่อง (ครั้งหน้าต้องเข้าระบบใหม่ และระบบจะถาม "นี่เป็นเครื่องของคุณใช่ไหม?" อีกครั้ง)
update public.auth_sessions set revoked_at = now() where revoked_at is null;
delete from public.auth_devices;                                    -- ลืมเครื่องที่ตอบว่า "เครื่องของฉัน"
delete from public.leave_action_links;                              -- ลิงก์อนุมัติใน LINE ที่ส่งตอนทดสอบใช้ไม่ได้แล้ว
delete from public.auth_attempts;                                   -- ประวัติใส่รหัสผิด / การล็อกชั่วคราว
delete from public.auth_sessions where revoked_at < now() - interval '1 minute' or expires_at < now();  -- เก็บกวาดบัตรผ่านเก่า

-- 2) (เลือกได้) ลบการยอมรับประกาศความเป็นส่วนตัวที่กดตอนทดสอบ
--    ตารางนี้เป็นหลักฐานตาม PDPA ปกติลบไม่ได้ จึงต้องปิดตัวกันลบชั่วคราว
--    ⚠️ ใช้เฉพาะก่อนเปิดใช้จริง ถ้ามีพนักงานจริงกดยอมรับไปแล้ว อย่ารัน ให้ใช้วิธี "ออกประกาศฉบับจริง" แทน
--    ลบเฉพาะบางคน: เปลี่ยนบรรทัด delete เป็น
--      delete from public.privacy_acceptances where employee_id in (select id from public.employees where employee_code in ('19013', '19122'));
-- begin;
-- alter table public.privacy_acceptances disable trigger privacy_acceptances_no_change;
-- delete from public.privacy_acceptances;
-- alter table public.privacy_acceptances enable trigger privacy_acceptances_no_change;
-- commit;

-- 3) ✅ ตรวจผล (sessions_active, devices_remembered, line_links_unused, login_attempts ต้องเป็น 0)
select
  (select count(*) from public.auth_sessions where revoked_at is null and expires_at > now()) as sessions_active,
  (select count(*) from public.auth_devices) as devices_remembered,
  (select count(*) from public.leave_action_links where used_at is null) as line_links_unused,
  (select count(*) from public.auth_attempts) as login_attempts,
  (select count(*) from public.privacy_acceptances) as privacy_acceptances,
  (select tgenabled from pg_trigger where tgname = 'privacy_acceptances_no_change') as privacy_guard;  -- ต้องเป็น O (เปิดอยู่)
