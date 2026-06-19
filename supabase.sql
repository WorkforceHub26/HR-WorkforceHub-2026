-- ======================================================
-- SQL ชุดเริ่มต้นสำหรับ Workforce Hub ใช้กับ Supabase
-- START SUPABASE 18/06/2569
-- ======================================================



-- ======================================================
-- EXTENSIONS
-- ======================================================

create extension if not exists "pgcrypto";


-- ======================================================
-- 1) ตารางแผนก
-- ======================================================

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  department_code text unique not null,
  department_name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);


-- ======================================================
-- 2) ตารางตำแหน่งงาน
-- ======================================================

create table if not exists positions (
  id uuid primary key default gen_random_uuid(),
  position_name text not null,
  department_id uuid references departments(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);


-- ======================================================
-- 3) ตารางข้อมูลพนักงาน
-- ======================================================

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),

  employee_code text unique not null,
  full_name text not null,
  nickname text,
  phone text,
  email text,

  department_id uuid references departments(id) on delete set null,
  position_id uuid references positions(id) on delete set null,

  employment_type text default 'monthly', -- monthly / daily / contract
  start_date date,
  resign_date date,

  status text not null default 'active', -- active / inactive / resigned

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ======================================================
-- 4) ตารางลงเวลาเข้าออกงาน
-- ======================================================

create table if not exists attendance_logs (
  id uuid primary key default gen_random_uuid(),

  employee_id uuid not null references employees(id) on delete cascade,

  work_date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,

  check_in_method text default 'manual', -- manual / qr / tablet
  check_out_method text default 'manual',

  status text default 'present', -- present / late / absent / leave
  note text,

  created_at timestamptz not null default now()
);


-- ======================================================
-- 5) ตารางประเภทการลา
-- ======================================================

create table if not exists leave_types (
  id uuid primary key default gen_random_uuid(),
  leave_code text unique not null,
  leave_name text not null,
  yearly_quota numeric default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);


-- ======================================================
-- 6) ตารางคำขอลา
-- ======================================================

create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),

  employee_id uuid not null references employees(id) on delete cascade,
  leave_type_id uuid references leave_types(id) on delete set null,

  start_date date not null,
  end_date date not null,
  total_days numeric not null default 1,

  reason text,
  attachment_url text,

  status text not null default 'pending',
  -- pending / approved / rejected / cancelled

  approved_by uuid references employees(id) on delete set null,
  approved_at timestamptz,
  approval_comment text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ======================================================
-- 7) ตาราง OT
-- ======================================================

create table if not exists overtime_requests (
  id uuid primary key default gen_random_uuid(),

  employee_id uuid not null references employees(id) on delete cascade,

  ot_date date not null,
  start_time time not null,
  end_time time not null,
  total_hours numeric not null default 0,

  reason text,

  status text not null default 'pending',
  -- pending / approved / rejected / cancelled

  approved_by uuid references employees(id) on delete set null,
  approved_at timestamptz,
  approval_comment text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ======================================================
-- 8) ตารางข่าวสารองค์กร
-- ======================================================

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  content text,
  announcement_date date not null default current_date,

  status text not null default 'active',
  created_by uuid references employees(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ======================================================
-- 9) ตารางเอกสาร HR
-- ======================================================

create table if not exists hr_documents (
  id uuid primary key default gen_random_uuid(),

  document_title text not null,
  document_type text,
  file_url text,
  description text,

  status text not null default 'active',
  created_by uuid references employees(id) on delete set null,

  created_at timestamptz not null default now()
);


-- ======================================================
-- 10) ตาราง User Profile เชื่อมกับ Supabase Auth
-- ======================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  employee_id uuid references employees(id) on delete set null,

  email text,
  username text unique,
  display_name text,

  role text not null default 'employee',
  -- admin / hr / manager / supervisor / employee

  status text not null default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ======================================================
-- FUNCTION updated_at
-- ======================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- ======================================================
-- TRIGGERS updated_at
-- ======================================================

drop trigger if exists trg_employees_updated_at on employees;
create trigger trg_employees_updated_at
before update on employees
for each row execute function set_updated_at();

drop trigger if exists trg_leave_requests_updated_at on leave_requests;
create trigger trg_leave_requests_updated_at
before update on leave_requests
for each row execute function set_updated_at();

drop trigger if exists trg_overtime_requests_updated_at on overtime_requests;
create trigger trg_overtime_requests_updated_at
before update on overtime_requests
for each row execute function set_updated_at();

drop trigger if exists trg_announcements_updated_at on announcements;
create trigger trg_announcements_updated_at
before update on announcements
for each row execute function set_updated_at();

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
before update on profiles
for each row execute function set_updated_at();


-- ======================================================
-- RLS เปิดใช้งาน
-- ======================================================

alter table departments enable row level security;
alter table positions enable row level security;
alter table employees enable row level security;
alter table attendance_logs enable row level security;
alter table leave_types enable row level security;
alter table leave_requests enable row level security;
alter table overtime_requests enable row level security;
alter table announcements enable row level security;
alter table hr_documents enable row level security;
alter table profiles enable row level security;


-- ======================================================
-- RLS Policy แบบเริ่มต้น
-- อ่านได้เมื่อ Login แล้ว
-- ======================================================

create policy "authenticated can read departments"
on departments for select
to authenticated
using (true);

create policy "authenticated can read positions"
on positions for select
to authenticated
using (true);

create policy "authenticated can read employees"
on employees for select
to authenticated
using (true);

create policy "authenticated can read leave types"
on leave_types for select
to authenticated
using (true);

create policy "authenticated can read announcements"
on announcements for select
to authenticated
using (status = 'active');

create policy "authenticated can read hr documents"
on hr_documents for select
to authenticated
using (status = 'active');

create policy "user can read own profile"
on profiles for select
to authenticated
using (id = auth.uid());

create policy "user can update own profile"
on profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());


-- ======================================================
-- Seed ข้อมูลเริ่มต้น
-- ======================================================

insert into departments (department_code, department_name)
values
  ('HR', 'ฝ่ายบุคคล'),
  ('ACC', 'บัญชี'),
  ('PROD', 'ผลิต'),
  ('QC', 'ตรวจสอบคุณภาพ'),
  ('MK', 'ฝ่ายขาย / การตลาด'),
  ('IT', 'IT / Digital')
on conflict (department_code) do nothing;


insert into leave_types (leave_code, leave_name, yearly_quota)
values
  ('SICK', 'ลาป่วย', 30),
  ('PERSONAL', 'ลากิจ', 6),
  ('VACATION', 'ลาพักร้อน', 6),
  ('OTHER', 'ลาอื่น ๆ', 0)
on conflict (leave_code) do nothing;