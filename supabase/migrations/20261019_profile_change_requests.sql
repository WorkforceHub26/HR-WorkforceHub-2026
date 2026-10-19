-- ระบบควบคุมการแก้ไขข้อมูลส่วนตัวของพนักงาน
-- 1) employees.profile_meta : เก็บสถานะ "HR ยืนยันแล้ว (ล็อก)" และวันที่พนักงานแก้เองล่าสุด ต่อช่องข้อมูล
--    ตัวอย่าง: {"hospital": {"verified_at": "...", "verified_by": "HR", "self_updated_at": "..."}}
-- 2) employee_change_requests : คำขอแก้ข้อมูลสำคัญ (ชื่อ, คำนำหน้า, เลขบัญชี, รพ.ที่ล็อกแล้ว) รอ HR อนุมัติ
-- รันใน Supabase > SQL Editor ทั้ง MAIN และ DEV · รันซ้ำได้

alter table public.employees add column if not exists profile_meta jsonb not null default '{}'::jsonb;

create table if not exists public.employee_change_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  field text not null,                      -- hospital | title | full_name | bank_account
  old_value text,
  new_value text not null,
  reason text,
  status text not null default 'pending',   -- pending | approved | rejected | cancelled
  reviewed_by uuid,
  reviewed_by_name text,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_ecr_status on public.employee_change_requests (status, created_at desc);
create index if not exists idx_ecr_employee on public.employee_change_requests (employee_id, created_at desc);

-- คำขอที่รออยู่ ต่อพนักงาน ต่อช่อง ได้ทีละ 1 รายการ (กันกดส่งซ้ำ/ป่วน)
create unique index if not exists uq_ecr_one_pending
  on public.employee_change_requests (employee_id, field) where status = 'pending';

grant select, insert, update on public.employee_change_requests to anon, authenticated;
alter table public.employee_change_requests enable row level security;

drop policy if exists "ecr read" on public.employee_change_requests;
create policy "ecr read" on public.employee_change_requests for select to anon, authenticated using (true);
drop policy if exists "ecr insert" on public.employee_change_requests;
create policy "ecr insert" on public.employee_change_requests for insert to anon, authenticated
  with check (status = 'pending' and field in ('hospital', 'phone', 'email', 'nickname', 'title', 'full_name')  -- เลขบัญชี: แก้ได้เฉพาะผู้ดูแล ไม่รับคำขอ
              and length(new_value) between 1 and 200 and coalesce(length(reason), 0) <= 500);
drop policy if exists "ecr update" on public.employee_change_requests;
create policy "ecr update" on public.employee_change_requests for update to anon, authenticated using (true) with check (true);
-- ไม่เปิดสิทธิ์ลบ: คำขอทุกรายการเก็บไว้เป็นหลักฐาน

-- ตรวจ
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'employees' and column_name = 'profile_meta';
select policyname, cmd from pg_policies where tablename = 'employee_change_requests' order by cmd;
