-- ============================================================================
-- ✍️ พนักงานยืนยันสรุปวันลา (รายเดือน / รายปี) — หลักฐานว่าพนักงานรับทราบและยืนยันรายการลาของตนเอง
--
--   รายเดือน : "แจ้งให้ทราบ" ไม่ต้องกด — สรุปใบลาที่อนุมัติแล้วของเดือนที่ผ่านมา (เฉพาะคนที่มีรายการลา)
--              ทักท้วงได้ภายใน 7 วัน ถ้าไม่ทักท้วงถือว่ารับทราบ
--   รายปี    : กดยืนยันครั้งเดียวต่อปี — สรุปทั้งรอบปีการลา (1 ธ.ค. – 30 พ.ย.) + วันลาคงเหลือ
--              ทุกคนต้องยืนยัน แม้ไม่ได้ลา
--
--   action
--     notified    HR ส่งสรุปให้พนักงาน (ในระบบ)
--     seen        พนักงานเปิดเห็นสรุปในระบบแล้ว (ระบบบันทึกให้อัตโนมัติ)
--     confirmed   พนักงานกดยืนยัน / รับทราบ
--     disputed    พนักงานแจ้งว่าข้อมูลไม่ถูกต้อง (note = รายละเอียด)
--     hr_resolved HR ตรวจสอบ/แก้ไขแล้ว → พนักงานต้องรับทราบ/ยืนยันใหม่
--   snapshot = รายการลาและวันคงเหลือ "ณ เวลาที่ยืนยัน" (ใช้เป็นหลักฐาน) · fingerprint ใช้ตรวจว่าข้อมูลเปลี่ยนภายหลังหรือไม่
--
--   ตารางนี้ "เพิ่มได้อย่างเดียว" แก้ไข/ลบไม่ได้ (เหมือน leave_approval_logs) เพื่อให้เป็นหลักฐานที่เชื่อถือได้
--   รันใน Supabase > SQL Editor ทั้ง MAIN และ DEV · รันซ้ำได้
-- ============================================================================

create table if not exists public.leave_confirmations (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  period_type   text not null check (period_type in ('month', 'year')),
  period_key    text not null,               -- month: '2026-10' · year: '2026' (รอบปีการลา ค.ศ.)
  action        text not null check (action in ('notified', 'seen', 'confirmed', 'disputed', 'hr_resolved')),
  leave_count   int,
  total_days    numeric,
  fingerprint   text,
  snapshot      jsonb,
  note          text,
  actor_id      uuid,                        -- ผู้กด (พนักงานเอง หรือ HR สำหรับ hr_resolved)
  actor_name    text,
  user_agent    text,
  device_info   jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_leave_confirm_period on public.leave_confirmations (period_type, period_key, created_at desc);
-- รันซ้ำบนตารางที่สร้างไว้ก่อน: ปรับรายการ action ให้ตรง
alter table public.leave_confirmations drop constraint if exists leave_confirmations_action_check;
alter table public.leave_confirmations add constraint leave_confirmations_action_check
  check (action in ('notified', 'seen', 'confirmed', 'disputed', 'hr_resolved'));

create index if not exists idx_leave_confirm_emp on public.leave_confirmations (employee_id, period_type, period_key, created_at desc);

-- กันแก้ไข/ลบย้อนหลัง
create or replace function public.leave_confirmations_block_change()
returns trigger language plpgsql as $$
begin
  raise exception 'leave_confirmations เป็นบันทึกหลักฐาน แก้ไขหรือลบไม่ได้';
end;
$$;

drop trigger if exists leave_confirmations_no_change on public.leave_confirmations;
create trigger leave_confirmations_no_change
  before update or delete on public.leave_confirmations
  for each row execute function public.leave_confirmations_block_change();

alter table public.leave_confirmations enable row level security;

drop policy if exists leave_confirmations_insert on public.leave_confirmations;
create policy leave_confirmations_insert on public.leave_confirmations
  for insert to anon, authenticated with check (true);

drop policy if exists leave_confirmations_select on public.leave_confirmations;
create policy leave_confirmations_select on public.leave_confirmations
  for select to anon, authenticated using (true);

revoke update, delete, truncate on public.leave_confirmations from anon, authenticated;
grant select, insert on public.leave_confirmations to anon, authenticated;

-- ✅ ตรวจ: ต้องเห็นตาราง + 2 policy (INSERT, SELECT)
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'leave_confirmations' order by cmd;
