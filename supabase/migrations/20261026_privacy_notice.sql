-- ============================================================================
-- 🛡️ ประกาศความเป็นส่วนตัว (PDPA) + การรับทราบและยอมรับของพนักงาน
--   ต้องรัน 20261023_auth_phase1_server_login.sql ก่อน · รันใน Supabase > SQL Editor (DEV ก่อน แล้ว MAIN) · รันซ้ำได้
--
--   • พนักงานเข้าระบบแล้ว ต้องอ่านและกดยอมรับประกาศฉบับล่าสุดก่อนใช้งาน (ครั้งเดียวต่อฉบับ)
--   • HR / ผู้ดูแลระบบแก้ข้อความได้ที่ คอนโซลผู้ดูแลระบบ > ประกาศความเป็นส่วนตัว → ออกเป็นฉบับใหม่ → ทุกคนต้องกดยอมรับใหม่
--   • บันทึกการยอมรับ (ใคร · ฉบับไหน · เมื่อไร · เครื่องอะไร) แก้ไข/ลบไม่ได้ ใช้เป็นหลักฐาน
--   • ฉบับที่ 1 ด้านล่างเป็นร่าง — ⚠️ ให้บริษัท / ฝ่ายกฎหมาย ตรวจและเติมช่อง [ ... ] ก่อนใช้งานจริง
--   (ไม่เขียนเครื่องหมายดอลลาร์ติดกับตัวอักษรในไฟล์นี้ — SQL Editor ของ Supabase จะเข้าใจผิด)
-- ============================================================================

create table if not exists public.privacy_notices (
  version      int primary key,
  title        text not null,
  body         text not null,
  effective_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  created_by   uuid,
  created_by_name text
);

create table if not exists public.privacy_acceptances (
  id            bigserial primary key,
  employee_id   uuid not null,
  notice_version int not null,
  accepted_at   timestamptz not null default now(),
  verified      boolean not null default true,   -- false = เข้าระบบแบบเดิม (ไม่มีบัตรผ่าน) ยืนยันตัวตนจากเครื่องไม่ได้
  user_agent    text
);
create index if not exists idx_privacy_acc_emp on public.privacy_acceptances (employee_id, notice_version);

alter table public.privacy_notices enable row level security;
alter table public.privacy_acceptances enable row level security;
-- ข้อความประกาศเป็นข้อมูลสาธารณะ อ่านได้ (แต่เขียนได้เฉพาะผ่านฟังก์ชัน)
drop policy if exists privacy_notices_read on public.privacy_notices;
create policy privacy_notices_read on public.privacy_notices for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.privacy_notices from anon, authenticated;
grant select on public.privacy_notices to anon, authenticated;
revoke all on public.privacy_acceptances from public, anon, authenticated;
revoke all on sequence public.privacy_acceptances_id_seq from public, anon, authenticated;

create or replace function public._privacy_acceptances_block_change()
returns trigger language plpgsql as $$
begin
  raise exception 'privacy_acceptances เป็นหลักฐาน แก้ไขหรือลบไม่ได้';
end;
$$;
drop trigger if exists privacy_acceptances_no_change on public.privacy_acceptances;
create trigger privacy_acceptances_no_change
  before update or delete on public.privacy_acceptances
  for each row execute function public._privacy_acceptances_block_change();

-- ---------------------------------------------------------------------------
-- ใครกำลังใช้งาน: บัตรผ่าน (ยืนยันตัวตนได้) หรือรหัสพนักงานจากเครื่อง (ระบบเดิม / เข้าด้วยลายนิ้วมือ)
-- ---------------------------------------------------------------------------
create or replace function public._privacy_who(p_token text, p_employee_id uuid, out emp_id uuid, out verified boolean)
language plpgsql volatile security definer
set search_path = public
as $$
declare v_emp public.employees;
begin
  v_emp := public._pvt_session_employee(p_token);
  if v_emp.id is not null then emp_id := v_emp.id; verified := true; return; end if;
  select id into emp_id from public.employees
  where id = p_employee_id and lower(btrim(coalesce(status, 'active'))) = 'active';
  verified := false;
end;
$$;
revoke all on function public._privacy_who(text, uuid) from public, anon, authenticated;

-- สถานะของผู้ใช้: { ok, needs, version, accepted_version, accepted_at, title, body, effective_at }
create or replace function public.pvt_privacy_status(p_token text default null, p_employee_id uuid default null)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_emp uuid; v_verified boolean;
  v_n public.privacy_notices;
  v_acc public.privacy_acceptances;
begin
  select * into v_n from public.privacy_notices order by version desc limit 1;
  if v_n.version is null then return jsonb_build_object('ok', true, 'needs', false, 'version', null); end if;
  select w.emp_id, w.verified into v_emp, v_verified from public._privacy_who(p_token, p_employee_id) w;
  if v_emp is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  select * into v_acc from public.privacy_acceptances
  where employee_id = v_emp and notice_version = v_n.version order by accepted_at desc limit 1;
  return jsonb_build_object('ok', true, 'needs', v_acc.id is null, 'version', v_n.version,
    'accepted_version', v_acc.notice_version, 'accepted_at', v_acc.accepted_at,
    'title', v_n.title, 'body', v_n.body, 'effective_at', v_n.effective_at, 'verified', v_verified);
end;
$$;

create or replace function public.pvt_privacy_accept(p_token text, p_employee_id uuid, p_version int, p_user_agent text default null)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_emp uuid; v_verified boolean;
  v_latest int;
begin
  select max(version) into v_latest from public.privacy_notices;
  if v_latest is null or p_version is distinct from v_latest then
    return jsonb_build_object('ok', false, 'reason', 'outdated', 'version', v_latest);
  end if;
  select w.emp_id, w.verified into v_emp, v_verified from public._privacy_who(p_token, p_employee_id) w;
  if v_emp is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not exists (select 1 from public.privacy_acceptances where employee_id = v_emp and notice_version = v_latest) then
    insert into public.privacy_acceptances (employee_id, notice_version, verified, user_agent)
    values (v_emp, v_latest, v_verified, left(p_user_agent, 300));
  end if;
  return jsonb_build_object('ok', true, 'version', v_latest, 'accepted_at', now());
end;
$$;

-- ออกฉบับใหม่ (HR / ผู้ดูแลระบบ) → ทุกคนต้องกดยอมรับใหม่
create or replace function public.pvt_privacy_publish(p_token text, p_title text, p_body text)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_me public.employees;
  v_ver int;
begin
  v_me := public._pvt_session_employee(p_token);
  if v_me.id is null then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if lower(btrim(coalesce(v_me.role, ''))) not in ('superadmin', 'admin', 'hr', 'hr_manager') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  if length(btrim(coalesce(p_body, ''))) < 50 or btrim(coalesce(p_title, '')) = '' then
    return jsonb_build_object('ok', false, 'reason', 'too_short');
  end if;
  select coalesce(max(version), 0) + 1 into v_ver from public.privacy_notices;
  insert into public.privacy_notices (version, title, body, created_by, created_by_name)
  values (v_ver, btrim(p_title), btrim(p_body), v_me.id, v_me.full_name);
  return jsonb_build_object('ok', true, 'version', v_ver);
end;
$$;

-- รายงานสำหรับ HR: ยอมรับฉบับล่าสุดแล้วกี่คน · ใครยังไม่ยอมรับ
create or replace function public.pvt_privacy_report(p_token text)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_me public.employees;
  v_ver int;
begin
  v_me := public._pvt_session_employee(p_token);
  if v_me.id is null then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if lower(btrim(coalesce(v_me.role, ''))) not in ('superadmin', 'admin', 'hr', 'hr_manager') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  select max(version) into v_ver from public.privacy_notices;
  return jsonb_build_object('ok', true, 'version', v_ver,
    'total', (select count(*) from public.employees where lower(btrim(coalesce(status, 'active'))) = 'active'),
    'accepted', (select count(distinct a.employee_id) from public.privacy_acceptances a
                 join public.employees e on e.id = a.employee_id and lower(btrim(coalesce(e.status, 'active'))) = 'active'
                 where a.notice_version = v_ver),
    'unverified', (select count(distinct a.employee_id) from public.privacy_acceptances a where a.notice_version = v_ver and not a.verified),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object('code', e.employee_code, 'name', e.full_name, 'dept', d.department_name,
                        'accepted_at', a.accepted_at, 'verified', a.verified) order by (a.accepted_at is null) desc, d.department_name, e.employee_code)
      from public.employees e
      left join public.departments d on d.id = e.department_id
      left join lateral (select x.accepted_at, x.verified from public.privacy_acceptances x
                         where x.employee_id = e.id and x.notice_version = v_ver order by x.accepted_at limit 1) a on true
      where lower(btrim(coalesce(e.status, 'active'))) = 'active'
    ), '[]'::jsonb),
    'versions', coalesce((select jsonb_agg(jsonb_build_object('version', n.version, 'title', n.title, 'effective_at', n.effective_at, 'by', n.created_by_name) order by n.version desc) from public.privacy_notices n), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.pvt_privacy_status(text, uuid) to anon, authenticated;
grant execute on function public.pvt_privacy_accept(text, uuid, int, text) to anon, authenticated;
grant execute on function public.pvt_privacy_publish(text, text, text) to anon, authenticated;
grant execute on function public.pvt_privacy_report(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ฉบับที่ 1 (ร่าง) — ใส่ครั้งเดียว ถ้ามีฉบับอยู่แล้วจะไม่ทับ
--   รูปแบบข้อความ: บรรทัดที่ขึ้นต้นด้วย "## " = หัวข้อ · "- " = รายการ · บรรทัดว่าง = ขึ้นย่อหน้าใหม่
-- ---------------------------------------------------------------------------
insert into public.privacy_notices (version, title, body, created_by_name)
select 1, 'ประกาศความเป็นส่วนตัวสำหรับพนักงาน (ระบบใบลาออนไลน์)', '
บริษัท พี.วี.ที. แอนด์ ที.พลาส จำกัด ("บริษัท") ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของพนักงาน ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ประกาศนี้อธิบายว่าระบบ PVT Workforce Hub เก็บข้อมูลอะไร ใช้ทำอะไร และพนักงานมีสิทธิ์อย่างไร

## 1. ข้อมูลที่ระบบเก็บ
- ข้อมูลพนักงาน: ชื่อ-นามสกุล คำนำหน้า ชื่อเล่น รหัสพนักงาน แผนก ตำแหน่ง ประเภทพนักงาน วันเริ่มงาน สถานะการทำงาน รูปถ่าย
- ข้อมูลติดต่อ: เบอร์โทรศัพท์ อีเมล และรหัสผู้ใช้ LINE (เมื่อผูกบัญชีเพื่อรับแจ้งเตือน)
- ข้อมูลเพื่อสิทธิประโยชน์: โรงพยาบาลตามสิทธิประกันสังคม เลขบัญชีธนาคาร (ถ้ามีการบันทึก)
- ข้อมูลการลา: ประเภทการลา วันที่ เหตุผล ไฟล์แนบ ผลการพิจารณา และความเห็นของผู้อนุมัติ
- ใบรับรองแพทย์และเอกสารประกอบการลาป่วย ซึ่งเป็นข้อมูลสุขภาพ (ข้อมูลอ่อนไหว)
- ข้อมูลการใช้งาน: เวลาเข้าระบบ วิธีเข้าระบบ ประเภทเครื่องและเบราว์เซอร์ เพื่อความปลอดภัยของบัญชี

## 2. วัตถุประสงค์
- บริหารการลา: ยื่นใบลา ส่งให้ผู้อนุมัติตามสายงาน คำนวณสิทธิ์วันลาคงเหลือ และสรุปประจำปี
- แจ้งเตือนสถานะใบลาในระบบและทาง LINE
- บริหารงานบุคคลที่เกี่ยวข้อง เช่น ข้อมูลพนักงาน วันหยุด ประกาศของบริษัท
- ปฏิบัติตามกฎหมายคุ้มครองแรงงานและกฎหมายประกันสังคม
- ป้องกันการเข้าใช้บัญชีโดยไม่ได้รับอนุญาต และตรวจสอบย้อนหลังเมื่อมีปัญหา

## 3. ฐานทางกฎหมาย
- เพื่อปฏิบัติตามสัญญาจ้างแรงงาน
- เพื่อปฏิบัติตามกฎหมายที่บริษัทต้องปฏิบัติ
- เพื่อประโยชน์โดยชอบด้วยกฎหมายของบริษัท เช่น ความปลอดภัยของระบบ
- ใบรับรองแพทย์และข้อมูลสุขภาพ: ใช้เพื่อพิจารณาการลาป่วยตามกฎหมายคุ้มครองแรงงานเท่านั้น และพนักงานให้ความยินยอมโดยการกดยอมรับประกาศนี้

## 4. ผู้ที่เห็นข้อมูล
- ผู้อนุมัติตามสายงานของพนักงาน เห็นเฉพาะใบลาที่ส่งถึงตน
- ฝ่ายทรัพยากรบุคคล (HR) และผู้ดูแลระบบที่ได้รับมอบหมาย
- ผู้ให้บริการระบบที่บริษัทใช้: Supabase (ฐานข้อมูลและไฟล์) และ LINE (ส่งข้อความแจ้งเตือน) ซึ่งเก็บข้อมูลบนเซิร์ฟเวอร์ที่อาจอยู่นอกประเทศไทย
- หน่วยงานรัฐเมื่อกฎหมายกำหนด
- บริษัทไม่ขายหรือให้ข้อมูลแก่บุคคลอื่นเพื่อการตลาด

## 5. การเข้าระบบด้วยลายนิ้วมือ / ใบหน้า
ระบบไม่เก็บลายนิ้วมือหรือภาพใบหน้า การยืนยันตัวตนทำบนโทรศัพท์ของพนักงานเอง ระบบเก็บเพียงรหัสอ้างอิงของอุปกรณ์

## 6. ระยะเวลาเก็บข้อมูล
เก็บตลอดระยะเวลาการจ้างงาน และหลังพ้นสภาพพนักงานอีก [ระบุจำนวนปี เช่น 2 ปี หรือตามที่กฎหมายกำหนด] จากนั้นลบหรือทำให้ไม่สามารถระบุตัวตนได้ ยกเว้นข้อมูลที่ต้องเก็บนานกว่าตามกฎหมาย

## 7. สิทธิ์ของพนักงาน
- ขอดูและขอสำเนาข้อมูลของตนเอง
- ขอแก้ไขข้อมูลให้ถูกต้อง (ทำได้ในเมนูคำขอแก้ไขข้อมูล)
- ขอให้ลบ ระงับการใช้ หรือคัดค้านการใช้ข้อมูล ในกรณีที่กฎหมายกำหนด
- ถอนความยินยอมเรื่องข้อมูลสุขภาพได้ แต่อาจทำให้บริษัทพิจารณาการลาป่วยที่ต้องใช้ใบรับรองแพทย์ไม่ได้
- ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล

## 8. ติดต่อ
ฝ่ายทรัพยากรบุคคล บริษัท พี.วี.ที. แอนด์ ที.พลาส จำกัด
[ระบุที่อยู่ / เบอร์โทร / อีเมล และผู้รับผิดชอบด้านข้อมูลส่วนบุคคล (ถ้ามี)]

ประกาศนี้อาจปรับปรุงเป็นครั้งคราว เมื่อมีฉบับใหม่ ระบบจะแสดงให้อ่านและกดยอมรับอีกครั้ง
', 'ระบบ (ร่างเริ่มต้น)'
where not exists (select 1 from public.privacy_notices);

-- ✅ ตรวจผล
select (select max(version) from public.privacy_notices) as latest_version,
       (select count(*) from public.privacy_acceptances) as acceptances;
