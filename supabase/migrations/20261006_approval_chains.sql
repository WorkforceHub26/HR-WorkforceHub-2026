-- ============================================================================
-- 🔗 ระยะ 2: สายอนุมัติแบบหลายขั้น + ทีม/กะ + ล็อกสายอนุมัติกับใบลา
--    รันครั้งเดียวใน Supabase > SQL Editor (รันหลัง 20261005_leave_approval_logs.sql)
--    รันซ้ำได้ ไม่ทำให้ข้อมูลเดิมเสีย
--
--    approval_teams         ทีม/กะ ภายในแผนก (เช่น สแลน > กะเช้า, กะดึก)
--    employees.team_id      พนักงานอยู่ทีม/กะไหน (ว่าง = ใช้สายของแผนก)
--    approval_chain_steps   สายอนุมัติของแผนก/ทีม เป็นรายการขั้น (1..9)
--                           แต่ละขั้นมีผู้อนุมัติได้หลายคน "คนใดคนหนึ่งกดก็ได้"
--    leave_approval_steps   ขั้นอนุมัติของใบลาแต่ละใบ (ล็อกไว้ตอนยื่น)
--    leave_requests.current_step  ขั้นที่ใบลารออยู่
-- ============================================================================

-- 1) ทีม / กะ ----------------------------------------------------------------
create table if not exists public.approval_teams (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  team_name     text not null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists approval_teams_dept_idx on public.approval_teams (department_id);

alter table public.employees
  add column if not exists team_id uuid references public.approval_teams(id) on delete set null;

-- 2) สายอนุมัติของแผนก / ทีม --------------------------------------------------
create table if not exists public.approval_chain_steps (
  id           uuid primary key default gen_random_uuid(),
  scope_type   text not null check (scope_type in ('department', 'team')),
  scope_id     uuid not null,
  step_no      int  not null check (step_no between 1 and 9),
  step_label   text,
  approver_ids uuid[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (scope_type, scope_id, step_no)
);
create index if not exists approval_chain_steps_scope_idx     on public.approval_chain_steps (scope_type, scope_id);
create index if not exists approval_chain_steps_approvers_idx on public.approval_chain_steps using gin (approver_ids);

-- 3) ขั้นอนุมัติของแต่ละใบลา (snapshot ตอนยื่น) ---------------------------------
create table if not exists public.leave_approval_steps (
  id             uuid primary key default gen_random_uuid(),
  leave_id       uuid not null references public.leave_requests(id) on delete cascade,
  step_no        int  not null,
  step_label     text,
  approver_ids   uuid[] not null default '{}',   -- ว่าง + hr_any = HR/Admin คนใดก็ได้
  approver_names text[],
  hr_any         boolean not null default false,
  status         text not null default 'waiting'
                 check (status in ('waiting', 'pending', 'approved', 'rejected', 'skipped', 'expired', 'cancelled')),
  skip_reason    text,
  acted_by       uuid,
  acted_by_name  text,
  acted_at       timestamptz,
  comment        text,
  activated_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique (leave_id, step_no)
);
create index if not exists leave_approval_steps_leave_idx     on public.leave_approval_steps (leave_id, step_no);
create index if not exists leave_approval_steps_status_idx    on public.leave_approval_steps (status);
create index if not exists leave_approval_steps_approvers_idx on public.leave_approval_steps using gin (approver_ids);

alter table public.leave_requests add column if not exists current_step int;

-- 4) RLS (ระบบใช้ anon key เหมือนตารางเดิม) -------------------------------------
alter table public.approval_teams        enable row level security;
alter table public.approval_chain_steps  enable row level security;
alter table public.leave_approval_steps  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['approval_teams', 'approval_chain_steps'] loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true)', t || '_all', t);
  end loop;
end $$;

-- ขั้นของใบลา: อ่าน/เพิ่ม/แก้สถานะได้ แต่ลบไม่ได้ (ลบได้เฉพาะเมื่อใบลาถูกลบ)
drop policy if exists leave_approval_steps_select on public.leave_approval_steps;
create policy leave_approval_steps_select on public.leave_approval_steps for select to anon, authenticated using (true);
drop policy if exists leave_approval_steps_insert on public.leave_approval_steps;
create policy leave_approval_steps_insert on public.leave_approval_steps for insert to anon, authenticated with check (true);
drop policy if exists leave_approval_steps_update on public.leave_approval_steps;
create policy leave_approval_steps_update on public.leave_approval_steps for update to anon, authenticated using (true) with check (true);

-- 5) ย้ายสายอนุมัติเดิม (department_approvers) เข้าตารางใหม่ -----------------------
--    หัวหน้า = ขั้น 1, ผู้จัดการ = ขั้น 2 (ถ้าหัวหน้าว่าง หรือเป็นคนเดียวกับผู้จัดการ → ผู้จัดการเป็นขั้น 1)
insert into public.approval_chain_steps (scope_type, scope_id, step_no, step_label, approver_ids)
select 'department', da.department_id, 1, 'หัวหน้างาน', array[da.supervisor_id]
from public.department_approvers da
where da.supervisor_id is not null
  and da.supervisor_id is distinct from da.manager_id
on conflict (scope_type, scope_id, step_no) do nothing;

insert into public.approval_chain_steps (scope_type, scope_id, step_no, step_label, approver_ids)
select 'department', da.department_id,
       case when da.supervisor_id is not null and da.supervisor_id is distinct from da.manager_id then 2 else 1 end,
       'ผู้จัดการ', array[da.manager_id]
from public.department_approvers da
where da.manager_id is not null
on conflict (scope_type, scope_id, step_no) do nothing;

-- 6) ล้างค่าผู้อนุมัติรายบุคคลที่เป็น "สำเนาของแผนก" (ระบบเดิมคัดลอกไว้ทุกคน)
--    ค่าที่ตรงกับของแผนกอยู่แล้วไม่มีผลต่อสายอนุมัติ — เหลือไว้เฉพาะข้อยกเว้นจริง
update public.employees e set l1_approver_id = null
where e.l1_approver_id is not null
  and exists (select 1 from public.department_approvers da
              where da.department_id = e.department_id and da.supervisor_id = e.l1_approver_id);

update public.employees e set l2_approver_id = null
where e.l2_approver_id is not null
  and exists (select 1 from public.department_approvers da
              where da.department_id = e.department_id and da.manager_id = e.l2_approver_id);

-- 7) นโยบาย: ใบลาของหัวหน้า/ผู้จัดการ ต้องผ่านผู้บริหาร (ค่าเริ่มต้น = เปิด เหมือนระบบเดิม)
insert into public.system_settings (setting_key, setting_value)
select 'approval_policy', '{"executive_for_approvers": true}'::jsonb
where not exists (select 1 from public.system_settings where setting_key = 'approval_policy');

-- ✅ ตรวจสอบ
-- select scope_type, scope_id, step_no, step_label, approver_ids from public.approval_chain_steps order by scope_id, step_no;
