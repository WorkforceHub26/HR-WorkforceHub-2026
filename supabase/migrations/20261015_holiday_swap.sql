-- ============================================================================
-- 🔁 ข้อตกลงวันหยุดพิเศษ — หน้า /pages/hr/holiday-swap.html
--    รันใน Supabase > SQL Editor ทั้ง 2 โปรเจกต์ (DEV และเว็บจริง) · รันซ้ำได้ (เคยรันแล้วก็รันทับได้เลย)
--
--    ประเภทข้อตกลง (holiday_swap_rounds.kind)
--      leave_swap    ใช้วันลาแลกวันหยุด (หักพักร้อน / ยืมปีหน้า / ลาไม่รับค่าจ้าง)
--      work_swap     ทำงานวันหยุดแลกวันหยุด (เช่น มาทำงานวันอาทิตย์ แล้วหยุดวันจันทร์แทน)
--      move_holiday  ย้ายวันหยุดนักขัตฤกษ์ไปวันอื่น (รวมเป็นวันหยุดยาว)
--      extra_holiday เพิ่มวันหยุด (ไม่หักวันลา)
--
--    holiday_swap_rounds  รอบที่ HR เปิดตามข้อตกลงที่ประชุมสวัสดิการ (วันหยุดที่เพิ่ม 1–n วัน)
--    holiday_swap_items   รายการหักของพนักงานแต่ละคน "ต่อวัน" (คนเดียวหลายวันใช้วิธีต่างกันได้)
--                         method: vacation_current = พักร้อนปีนี้ · vacation_next = ยืมพักร้อนปีหน้า
--                                 personal = ลากิจ · unpaid = ลาไม่รับค่าจ้าง · exempt = ไม่หัก (ไม่อยู่ในข้อตกลง/มาทำงาน)
--    leave_requests.charge_year    ใบลานี้หักจากสิทธิ์ "รอบปีการลา" ไหน (ว่าง = ตามวันที่ลา)
--    leave_requests.swap_round_id  ใบลาที่ระบบสร้างจากรอบแลกวันหยุด
-- ============================================================================

-- 1) รอบ ---------------------------------------------------------------------
create table if not exists public.holiday_swap_rounds (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  swap_dates    date[] not null,
  agreement_ref text,                       -- อ้างอิงข้อตกลง เช่น "มติที่ประชุมสวัสดิการ 2/2569"
  note          text,                       -- ข้อความที่แสดงให้พนักงานเห็น
  max_borrow    numeric not null default 2, -- ยืมพักร้อนปีหน้าได้ไม่เกินกี่วันต่อคน
  status        text not null default 'draft' check (status in ('draft', 'applied', 'cancelled')),
  created_by    uuid,
  created_by_name text,
  applied_at    timestamptz,
  applied_by_name text,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2) รายการหักรายคน/รายวัน ----------------------------------------------------
create table if not exists public.holiday_swap_items (
  id               uuid primary key default gen_random_uuid(),
  round_id         uuid not null references public.holiday_swap_rounds(id) on delete cascade,
  employee_id      uuid not null references public.employees(id) on delete cascade,
  swap_date        date not null,
  method           text not null check (method in ('vacation_current', 'vacation_next', 'personal', 'unpaid', 'exempt')),
  method_source    text not null default 'auto' check (method_source in ('auto', 'hr')),  -- ระบบเสนอ / HR แก้
  charge_year      int,                      -- ปีการลาที่หัก (ค.ศ.)
  leave_request_id uuid references public.leave_requests(id) on delete set null,
  status           text not null default 'pending' check (status in ('pending', 'applied', 'skipped', 'cancelled')),
  skip_reason      text,
  -- ยืมปีหน้าแล้วลาออกก่อนถึงปีหน้า → HR ตัดสินใจ
  settlement       text check (settlement in ('deduct_pay', 'waive')),
  settlement_note  text,
  settled_by_name  text,
  settled_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (round_id, employee_id, swap_date)
);
create index if not exists holiday_swap_items_emp_idx   on public.holiday_swap_items (employee_id);
create index if not exists holiday_swap_items_round_idx on public.holiday_swap_items (round_id);

-- 3) ใบลา: ปีที่หักสิทธิ์ + รอบที่สร้าง -----------------------------------------
alter table public.leave_requests add column if not exists charge_year int;
alter table public.leave_requests add column if not exists swap_round_id uuid references public.holiday_swap_rounds(id) on delete set null;

-- 4) ประเภทลา "ลาไม่รับค่าจ้าง" (ถ้ายังไม่มี) -------------------------------------
--    สร้างเป็น inactive = ใช้เฉพาะรอบแลกวันหยุด ไม่โผล่ในฟอร์มยื่นลาของพนักงาน
--    (ถ้าอยากให้พนักงานยื่นเองได้ เปลี่ยน status เป็น 'active' ที่หน้าจัดการประเภทลา)
insert into public.leave_types (leave_code, leave_name, yearly_quota, status, paid_leave)
select 'UNPAID', 'ลาไม่รับค่าจ้าง', 0, 'inactive', false
where not exists (
  select 1 from public.leave_types
  where upper(leave_code) = 'UNPAID' or leave_name like '%ไม่รับค่าจ้าง%' or paid_leave = false
);

-- 5) RLS (ระบบใช้ anon key เหมือนตารางอื่น) ---------------------------------------
alter table public.holiday_swap_rounds enable row level security;
alter table public.holiday_swap_items  enable row level security;
do $$
declare t text;
begin
  foreach t in array array['holiday_swap_rounds', 'holiday_swap_items'] loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all to anon, authenticated using (true) with check (true)', t || '_all', t);
  end loop;
end $$;
-- สิทธิ์ตาราง (โปรเจกต์ Supabase รุ่นใหม่ไม่ให้สิทธิ์ตารางใหม่อัตโนมัติ → "permission denied for table")
grant select, insert, update, delete on public.holiday_swap_rounds to anon, authenticated;
grant select, insert, update, delete on public.holiday_swap_items  to anon, authenticated;

-- 6) ประเภทข้อตกลง + คู่วัน + ขอบเขตแผนก (สำหรับอนาคต) -----------------------------
alter table public.holiday_swap_rounds add column if not exists kind text not null default 'leave_swap';
alter table public.holiday_swap_rounds add column if not exists pairs jsonb;                 -- [{"work_date","off_date","label"}] / [{"from_date","to_date","label"}]
alter table public.holiday_swap_rounds add column if not exists scope_department_ids uuid[]; -- ว่าง = ทุกแผนก
alter table public.holiday_swap_rounds drop constraint if exists holiday_swap_rounds_kind_check;
alter table public.holiday_swap_rounds add constraint holiday_swap_rounds_kind_check
  check (kind in ('leave_swap', 'work_swap', 'move_holiday', 'extra_holiday'));

-- วิธีหัก: เพิ่ม attend = มาทำงานตามข้อตกลง (ไม่หัก)
alter table public.holiday_swap_items drop constraint if exists holiday_swap_items_method_check;
alter table public.holiday_swap_items add constraint holiday_swap_items_method_check
  check (method in ('attend', 'vacation_current', 'vacation_next', 'personal', 'unpaid', 'exempt'));

-- 7) ปฏิทิน: วันทำงานพิเศษ (ทับวันอาทิตย์/วันหยุดเดิม) + ผูกกับข้อตกลง ------------------------
alter table public.holidays add column if not exists is_working_day boolean not null default false;
alter table public.holidays add column if not exists agreement_id uuid references public.holiday_swap_rounds(id) on delete cascade;
create index if not exists holidays_agreement_idx on public.holidays (agreement_id);

-- ✅ ตรวจสอบ
-- select * from public.holiday_swap_rounds order by created_at desc;
-- select leave_code, leave_name, paid_leave from public.leave_types order by leave_code;
