-- ============================================================================
-- 🧾 leave_approval_logs — หลักฐานการพิจารณาใบลา (ทุกขั้น ทุกผลลัพธ์)
--    รันครั้งเดียวใน Supabase > SQL Editor
--    • เพิ่มได้อย่างเดียว: แก้ไข/ลบไม่ได้ (ทั้งจากหน้าเว็บและจาก SQL ทั่วไป) เพื่อใช้เป็นหลักฐาน
--    • เก็บข้อมูลใบลา ณ เวลาที่ทำรายการ (leave_snapshot) ไว้ด้วย
--      แม้ใบลาหรือพนักงานถูกลบภายหลัง หลักฐานยังอยู่ (leave_id จะกลายเป็น NULL)
-- ============================================================================

create table if not exists public.leave_approval_logs (
  id             uuid primary key default gen_random_uuid(),
  leave_id       uuid references public.leave_requests(id) on delete set null,
  employee_id    uuid,
  employee_code  text,
  employee_name  text,
  action         text not null,     -- submitted | step_approved | approved | rejected | auto_rejected
                                    -- cancelled | cancel_requested | cancel_approved | cancel_rejected
  step_level     text,              -- L1 | L2 | L3 | HR
  step_label     text,              -- เช่น "หัวหน้างาน (L1)"
  actor_id       uuid,              -- ผู้กด (NULL = ระบบอัตโนมัติ)
  actor_name     text,
  actor_role     text,
  status_before  text,
  status_after   text,
  comment        text,
  leave_snapshot jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists leave_approval_logs_leave_idx    on public.leave_approval_logs (leave_id, created_at);
create index if not exists leave_approval_logs_created_idx  on public.leave_approval_logs (created_at desc);
create index if not exists leave_approval_logs_employee_idx on public.leave_approval_logs (employee_id, created_at desc);

-- 🔒 ห้ามแก้ไข / ลบ (append-only)
create or replace function public.leave_approval_logs_block_change()
returns trigger language plpgsql as $$
begin
  -- อนุญาตเฉพาะกรณีลบใบลาต้นทางแล้วระบบตั้ง leave_id = NULL (on delete set null)
  if tg_op = 'UPDATE'
     and new.leave_id is null and old.leave_id is not null
     and (to_jsonb(new) - 'leave_id') = (to_jsonb(old) - 'leave_id') then
    return new;
  end if;
  raise exception 'leave_approval_logs เป็นหลักฐาน แก้ไขหรือลบไม่ได้';
end $$;

drop trigger if exists leave_approval_logs_no_update on public.leave_approval_logs;
create trigger leave_approval_logs_no_update
  before update or delete on public.leave_approval_logs
  for each row execute function public.leave_approval_logs_block_change();

-- 🔐 RLS: เพิ่มและอ่านได้ (ระบบใช้ anon key) — ไม่มีนโยบาย update/delete จึงทำไม่ได้
alter table public.leave_approval_logs enable row level security;

drop policy if exists leave_approval_logs_insert on public.leave_approval_logs;
create policy leave_approval_logs_insert on public.leave_approval_logs
  for insert to anon, authenticated with check (true);

drop policy if exists leave_approval_logs_select on public.leave_approval_logs;
create policy leave_approval_logs_select on public.leave_approval_logs
  for select to anon, authenticated using (true);

-- ✅ ตรวจสอบ: select * from public.leave_approval_logs order by created_at desc limit 20;
