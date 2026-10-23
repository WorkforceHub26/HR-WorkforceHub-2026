-- ============================================================================
-- 🔐 ความปลอดภัยการเข้าระบบ ช่วงที่ 1: ตรวจรหัสผ่านฝั่งฐานข้อมูล + แยกรหัสผ่านออกจากตารางพนักงาน
--
--   ก่อนหน้านี้: หน้าเว็บดึงคอลัมน์ employees.password มาเทียบเองในเบราว์เซอร์
--                → ใครเปิดเครื่องมือของเบราว์เซอร์ก็อ่านรหัสผ่าน (บางบัญชียังเป็นตัวหนังสือธรรมดา) ได้ทั้งบริษัท
--   หลังรันไฟล์นี้:
--     1) รหัสผ่านย้ายไปเก็บในตาราง employee_secrets แบบเข้ารหัส bcrypt (หน้าเว็บอ่านไม่ได้เลย)
--        คอลัมน์ employees.password ถูกล้างเป็นค่าว่าง และจะว่างตลอด (ระบบย้ายค่าที่เขียนมาให้อัตโนมัติ)
--     2) เข้าระบบผ่านฟังก์ชัน pvt_login / pvt_qr_login → ได้ "บัตรผ่าน" (session token) อายุ 30 วัน / 12 ชม.
--     3) บัญชีผู้ดูแลระบบ (HR / Admin / ผู้บริหาร) กรอกรหัสผิด 5 ครั้งใน 15 นาที → ล็อก 15 นาที
--        (พนักงานทั่วไปไม่ล็อก เพราะเข้าด้วยรหัสพนักงาน — กันคนแกล้งพิมพ์ผิดให้เพื่อนเข้าไม่ได้)
--     4) ตั้ง/เปลี่ยนรหัสผ่านผู้ดูแลระบบได้เฉพาะผ่านฟังก์ชัน (ต้องมีบัตรผ่านของผู้มีสิทธิ์)
--        การเขียนรหัสผ่านบัญชีผู้ดูแลระบบตรง ๆ จากหน้าเว็บจะถูกเพิกเฉย (กันการยึดบัญชี HR)
--
--   ลำดับการติดตั้ง (สำคัญ):
--     ① อัปโหลดไฟล์หน้าเว็บชุดใหม่ก่อน (หน้าเว็บชุดใหม่ใช้ได้ทั้งก่อนและหลังรันไฟล์นี้)
--     ② รันไฟล์นี้ใน Supabase > SQL Editor — DEV ก่อน ทดสอบเข้าระบบ แล้วค่อยรันที่ MAIN · รันซ้ำได้
--     ③ ทดสอบ: พนักงานทั่วไป / ผู้อนุมัติ / HR / ADMIN-T เข้าระบบได้ · สแกน QR บนบัตรพนักงานได้
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) ตาราง (หน้าเว็บเข้าถึงไม่ได้ทั้งหมด — ใช้ผ่านฟังก์ชันเท่านั้น)
-- ---------------------------------------------------------------------------
create table if not exists public.employee_secrets (
  employee_id   uuid primary key,          -- ไม่ผูก FK เพื่อให้ trigger ของ employees เขียนได้ก่อนแถวพนักงานถูกสร้าง
  password_hash text not null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid
);

create table if not exists public.auth_sessions (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique,      -- เก็บเฉพาะค่า hash ของบัตรผ่าน (ถ้าฐานข้อมูลรั่วก็ใช้แทนไม่ได้)
  employee_id   uuid not null,
  method        text not null default 'password',
  device_kind   text not null default 'unknown',   -- ช่วงที่ 2: own / shared
  user_agent    text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_seen_at  timestamptz not null default now(),
  revoked_at    timestamptz
);
create index if not exists idx_auth_sessions_emp on public.auth_sessions (employee_id, expires_at desc);

create table if not exists public.auth_attempts (
  id            bigserial primary key,
  login_key     text,
  employee_id   uuid,
  ok            boolean not null,
  reason        text,
  attempted_at  timestamptz not null default now()
);
create index if not exists idx_auth_attempts_emp on public.auth_attempts (employee_id, attempted_at desc);

alter table public.employee_secrets enable row level security;
alter table public.auth_sessions    enable row level security;
alter table public.auth_attempts    enable row level security;
revoke all on public.employee_secrets from public, anon, authenticated;
revoke all on public.auth_sessions    from public, anon, authenticated;
revoke all on public.auth_attempts    from public, anon, authenticated;
revoke all on sequence public.auth_attempts_id_seq from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) ฟังก์ชันภายใน (หน้าเว็บเรียกไม่ได้)
-- ---------------------------------------------------------------------------
-- บัญชีผู้ดูแลระบบ: นโยบายเดียวกับ pvtIsAdminAccount ใน js/auth-guard.js และ auth/index.js
create or replace function public._pvt_is_admin(p_role text, p_code text)
returns boolean language sql immutable as $$
  select lower(btrim(coalesce(p_role, ''))) in ('hr', 'admin', 'superadmin', 'hr_manager', 'executive', 'director', 'owner')
      or lower(btrim(coalesce(p_code, ''))) in ('admin', 'superadmin')
      or lower(btrim(coalesce(p_code, ''))) like 'hr-%';
$$;

create or replace function public._pvt_hash(p_plain text)
returns text language sql volatile
set search_path = public, extensions
as $$
  select case when btrim(coalesce(p_plain, '')) ~ '^[$]2[aby][$]' then btrim(p_plain)
              else crypt(btrim(coalesce(p_plain, '')), gen_salt('bf', 10)) end;
$$;

-- เทียบรหัส: รองรับ bcrypt (รุ่น 2a / 2b / 2y จาก bcryptjs) และค่าเดิมที่ยังไม่เข้ารหัส
--   (ไม่เขียนเครื่องหมายดอลลาร์ติดกับตัวอักษรในไฟล์นี้ เพราะ SQL Editor ของ Supabase จะเข้าใจผิดว่าเป็นจุดเริ่ม/จบฟังก์ชัน)
create or replace function public._pvt_hash_matches(p_stored text, p_input text)
returns boolean language plpgsql stable
set search_path = public, extensions
as $$
declare
  s text := btrim(coalesce(p_stored, ''));
  i text := btrim(coalesce(p_input, ''));
  h text;
begin
  if s = '' or i = '' then return false; end if;
  if s ~ '^[$]2[aby][$]' then
    h := chr(36) || '2a' || chr(36) || substr(s, 5);
    return crypt(i, h) = h;
  end if;
  return s = i;
end;
$$;

-- รหัสผ่านที่เก็บไว้ของพนักงาน (ตารางใหม่ก่อน · ถ้ายังไม่ย้าย ใช้คอลัมน์เดิม)
create or replace function public._pvt_stored_password(p_emp uuid)
returns text language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select s.password_hash from public.employee_secrets s where s.employee_id = p_emp),
    (select nullif(btrim(e.password), '') from public.employees e where e.id = p_emp)
  );
$$;

-- ผลการตรวจรหัส: 'ok' | 'wrong' | 'admin_no_password'
create or replace function public._pvt_check_login(p_emp public.employees, p_input text)
returns text language plpgsql stable security definer
set search_path = public
as $$
declare
  v_code   text := btrim(coalesce(p_emp.employee_code, ''));
  v_stored text := public._pvt_stored_password(p_emp.id);
  v_input  text := btrim(coalesce(p_input, ''));
begin
  if public._pvt_is_admin(p_emp.role, p_emp.employee_code) then
    if v_stored is null or v_stored = v_code then return 'admin_no_password'; end if;
    return case when public._pvt_hash_matches(v_stored, v_input) then 'ok' else 'wrong' end;
  end if;
  -- พนักงานทั่วไป: รหัสพนักงาน (ไม่สนตัวพิมพ์เล็ก/ใหญ่) หรือรหัสผ่านที่เคยตั้งไว้
  if v_code <> '' and lower(v_input) = lower(v_code) then return 'ok'; end if;
  return case when public._pvt_hash_matches(v_stored, v_input) then 'ok' else 'wrong' end;
end;
$$;

-- ข้อมูลผู้ใช้ที่ส่งกลับให้หน้าเว็บ (ไม่มีรหัสผ่าน)
create or replace function public._pvt_user_json(p_emp_id uuid)
returns jsonb language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', e.id, 'employee_code', e.employee_code, 'full_name', e.full_name,
    'role', coalesce(e.role, 'user'), 'status', coalesce(e.status, 'active'),
    'department_id', e.department_id, 'position_id', e.position_id, 'image_url', e.image_url,
    'l1_approver_id', e.l1_approver_id, 'l2_approver_id', e.l2_approver_id, 'l3_approver_id', e.l3_approver_id,
    'departments', case when d.id is null then null else jsonb_build_object('department_name', d.department_name) end,
    'positions', case when p.id is null then null else to_jsonb(p) - 'id' - 'created_at' - 'updated_at' end
  )
  from public.employees e
  left join public.departments d on d.id = e.department_id
  left join public.positions p on p.id = e.position_id
  where e.id = p_emp_id;
$$;

create or replace function public._pvt_new_session(p_emp uuid, p_method text, p_remember boolean, p_user_agent text)
returns jsonb language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_token   text := encode(gen_random_bytes(32), 'hex');
  v_expires timestamptz := now() + case when coalesce(p_remember, true) then interval '30 days' else interval '12 hours' end;
begin
  insert into public.auth_sessions (token_hash, employee_id, method, user_agent, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_emp, coalesce(p_method, 'password'), left(p_user_agent, 300), v_expires);
  return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end;
$$;

-- พนักงานเจ้าของบัตรผ่าน (บัตรผ่านหมดอายุ / ถูกยกเลิก / บัญชีถูกระงับ → null)
create or replace function public._pvt_session_employee(p_token text)
returns public.employees language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_emp public.employees;
  v_sid uuid;
begin
  if coalesce(p_token, '') = '' then return null; end if;
  select s.id into v_sid from public.auth_sessions s
  where s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and s.revoked_at is null and s.expires_at > now();
  if v_sid is null then return null; end if;
  update public.auth_sessions set last_seen_at = now() where id = v_sid and last_seen_at < now() - interval '5 minutes';
  select e.* into v_emp from public.employees e
  join public.auth_sessions s on s.employee_id = e.id
  where s.id = v_sid and lower(coalesce(e.status, 'active')) = 'active';
  return v_emp;
end;
$$;

create or replace function public._pvt_store_password(p_emp uuid, p_plain text, p_by uuid)
returns void language plpgsql volatile security definer
set search_path = public
as $$
begin
  if btrim(coalesce(p_plain, '')) = '' then
    delete from public.employee_secrets where employee_id = p_emp;
    return;
  end if;
  insert into public.employee_secrets (employee_id, password_hash, updated_at, updated_by)
  values (p_emp, public._pvt_hash(p_plain), now(), p_by)
  on conflict (employee_id) do update
    set password_hash = excluded.password_hash, updated_at = now(), updated_by = excluded.updated_by;
end;
$$;

revoke all on function public._pvt_hash(text) from public, anon, authenticated;
revoke all on function public._pvt_hash_matches(text, text) from public, anon, authenticated;
revoke all on function public._pvt_stored_password(uuid) from public, anon, authenticated;
revoke all on function public._pvt_check_login(public.employees, text) from public, anon, authenticated;
revoke all on function public._pvt_user_json(uuid) from public, anon, authenticated;
revoke all on function public._pvt_new_session(uuid, text, boolean, text) from public, anon, authenticated;
revoke all on function public._pvt_session_employee(text) from public, anon, authenticated;
revoke all on function public._pvt_store_password(uuid, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) เข้าระบบ / ออกจากระบบ (หน้าเว็บเรียกได้)
-- ---------------------------------------------------------------------------
-- ผลลัพธ์: { ok: true, user, token, expires_at }  หรือ  { ok: false, reason }
--   reason: empty · not_found · multiple · locked (+ locked_until) · admin_no_password · wrong · inactive
create or replace function public.pvt_login(
  p_login text, p_password text, p_remember boolean default true, p_user_agent text default null
) returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_login text := btrim(coalesce(p_login, ''));
  v_ids   uuid[];
  v_emp   public.employees;
  v_admin boolean;
  v_fails int;
  v_last  timestamptz;
  v_check text;
  v_sess  jsonb;
begin
  if v_login = '' or btrim(coalesce(p_password, '')) = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  -- หาบัญชี: อีเมล · รหัสพนักงาน (ไม่สนตัวพิมพ์) · เบอร์โทร · ชื่อ-นามสกุลแบบตรงตัว (เหมือนหน้าเข้าระบบเดิม)
  if position('@' in v_login) > 0 then
    select array_agg(id) into v_ids from public.employees where lower(btrim(email)) = lower(v_login);
  else
    select array_agg(id) into v_ids from public.employees where lower(btrim(employee_code)) = lower(v_login);
    if v_ids is null then
      if v_login ~ '^\d+$' then
        select array_agg(id) into v_ids from public.employees where btrim(phone) = v_login;
      else
        select array_agg(id) into v_ids from public.employees where btrim(full_name) = v_login;
      end if;
    end if;
  end if;

  if v_ids is null or array_length(v_ids, 1) is null then
    insert into public.auth_attempts (login_key, ok, reason) values (left(v_login, 80), false, 'not_found');
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if array_length(v_ids, 1) > 1 then
    return jsonb_build_object('ok', false, 'reason', 'multiple');
  end if;

  select * into v_emp from public.employees where id = v_ids[1];
  v_admin := public._pvt_is_admin(v_emp.role, v_emp.employee_code);

  -- ล็อกบัญชีผู้ดูแลระบบ: ผิด 5 ครั้งใน 15 นาที (นับหลังครั้งที่เข้าสำเร็จล่าสุด)
  if v_admin then
    select count(*), max(attempted_at) into v_fails, v_last
    from public.auth_attempts a
    where a.employee_id = v_emp.id and not a.ok and a.reason = 'wrong'
      and a.attempted_at > now() - interval '15 minutes'
      and a.attempted_at > coalesce((select max(b.attempted_at) from public.auth_attempts b where b.employee_id = v_emp.id and b.ok), '-infinity');
    if v_fails >= 5 then
      return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', v_last + interval '15 minutes');
    end if;
  end if;

  v_check := public._pvt_check_login(v_emp, p_password);
  if v_check <> 'ok' then
    insert into public.auth_attempts (login_key, employee_id, ok, reason) values (left(v_login, 80), v_emp.id, false, v_check);
    if v_check = 'wrong' then perform pg_sleep(0.5); end if;
    return jsonb_build_object('ok', false, 'reason', v_check,
      'attempts_left', case when v_admin and v_check = 'wrong' then greatest(0, 4 - coalesce(v_fails, 0)) end);
  end if;

  if lower(btrim(coalesce(v_emp.status, 'active'))) <> 'active' then
    insert into public.auth_attempts (login_key, employee_id, ok, reason) values (left(v_login, 80), v_emp.id, false, 'inactive');
    return jsonb_build_object('ok', false, 'reason', 'inactive', 'status', v_emp.status);
  end if;

  insert into public.auth_attempts (login_key, employee_id, ok, reason) values (left(v_login, 80), v_emp.id, true, 'password');
  v_sess := public._pvt_new_session(v_emp.id, 'password', p_remember, p_user_agent);
  return jsonb_build_object('ok', true, 'user', public._pvt_user_json(v_emp.id)) || v_sess;
end;
$$;

-- QR บนบัตรพนักงานเดิม (ข้อมูลใน QR = รหัสพนักงาน) — เฉพาะพนักงานทั่วไป · ผู้ดูแลระบบต้องกรอกรหัสผ่าน
--   ช่วงที่ 4 จะเปลี่ยนเป็น QR รหัสลับที่ยกเลิก/ออกใหม่ได้
create or replace function public.pvt_qr_login(
  p_code text, p_remember boolean default true, p_user_agent text default null
) returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_code text := btrim(coalesce(p_code, ''));
  v_emp  public.employees;
  v_sess jsonb;
begin
  if v_code = '' then return jsonb_build_object('ok', false, 'reason', 'empty'); end if;
  select * into v_emp from public.employees where lower(btrim(employee_code)) = lower(v_code) limit 1;
  if v_emp.id is null then
    select * into v_emp from public.employees
    where btrim(employee_code) = lpad(v_code, 4, '0') or btrim(phone) = v_code
    order by employee_code limit 1;
  end if;
  if v_emp.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found', 'code', v_code); end if;
  if public._pvt_is_admin(v_emp.role, v_emp.employee_code) then
    return jsonb_build_object('ok', false, 'reason', 'admin_qr');
  end if;
  if lower(btrim(coalesce(v_emp.status, 'active'))) <> 'active' then
    return jsonb_build_object('ok', false, 'reason', 'inactive', 'status', v_emp.status);
  end if;
  insert into public.auth_attempts (login_key, employee_id, ok, reason) values (left(v_code, 80), v_emp.id, true, 'qr');
  v_sess := public._pvt_new_session(v_emp.id, 'qr', p_remember, p_user_agent);
  return jsonb_build_object('ok', true, 'user', public._pvt_user_json(v_emp.id)) || v_sess;
end;
$$;

-- ตรวจบัตรผ่าน: { ok, user } — ใช้ตรวจว่ายังเข้าระบบอยู่ / บัญชีถูกระงับแล้วหรือยัง
create or replace function public.pvt_session(p_token text)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare v_emp public.employees;
begin
  v_emp := public._pvt_session_employee(p_token);
  if v_emp.id is null then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  return jsonb_build_object('ok', true, 'user', public._pvt_user_json(v_emp.id));
end;
$$;

create or replace function public.pvt_logout(p_token text)
returns jsonb language plpgsql volatile security definer
set search_path = public, extensions
as $$
begin
  update public.auth_sessions set revoked_at = now()
  where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') and revoked_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) ตั้ง / เปลี่ยนรหัสผ่าน (ต้องมีบัตรผ่าน)
-- ---------------------------------------------------------------------------
-- เปลี่ยนรหัสของตัวเอง: { ok } หรือ { ok:false, reason: expired · wrong_current · too_short · same_as_code }
create or replace function public.pvt_change_password(p_token text, p_current text, p_new text)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_me public.employees;
  v_admin boolean;
  v_min int;
  v_new text := btrim(coalesce(p_new, ''));
begin
  v_me := public._pvt_session_employee(p_token);
  if v_me.id is null then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  v_admin := public._pvt_is_admin(v_me.role, v_me.employee_code);
  if not public._pvt_hash_matches(public._pvt_stored_password(v_me.id), p_current)
     and not (not v_admin and lower(btrim(coalesce(p_current, ''))) = lower(btrim(v_me.employee_code))) then
    perform pg_sleep(0.5);
    return jsonb_build_object('ok', false, 'reason', 'wrong_current');
  end if;
  v_min := (case when v_admin then 8 else 6 end);
  if length(v_new) < v_min then
    return jsonb_build_object('ok', false, 'reason', 'too_short', 'min', v_min);
  end if;
  if lower(v_new) = lower(btrim(v_me.employee_code)) then
    return jsonb_build_object('ok', false, 'reason', 'same_as_code');
  end if;
  perform public._pvt_store_password(v_me.id, v_new, v_me.id);
  return jsonb_build_object('ok', true);
end;
$$;

-- ตั้งรหัสให้คนอื่น (ผู้มีสิทธิ์เท่านั้น)
--   ผู้ดูแลระบบขั้นสูง (superadmin): ตั้งได้ทุกบัญชี ยกเว้นผู้ดูแลระบบขั้นสูงคนอื่น
--   ผู้ดูแลระบบขั้นต้น / HR: ตั้งได้เฉพาะ HR · ผู้บริหาร และพนักงานทั่วไป (ตั้งให้ admin / superadmin ไม่ได้)
--   p_new ว่าง = ล้างรหัส (พนักงานทั่วไปกลับไปใช้รหัสพนักงาน)
create or replace function public.pvt_set_password(p_token text, p_employee_id uuid, p_new text)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_me public.employees;
  v_target public.employees;
  v_me_role text;
  v_t_role text;
  v_t_admin boolean;
  v_min int;
  v_new text := btrim(coalesce(p_new, ''));
begin
  v_me := public._pvt_session_employee(p_token);
  if v_me.id is null then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  select * into v_target from public.employees where id = p_employee_id;
  if v_target.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  v_me_role := lower(btrim(coalesce(v_me.role, '')));
  v_t_role  := lower(btrim(coalesce(v_target.role, '')));
  v_t_admin := public._pvt_is_admin(v_target.role, v_target.employee_code);

  if v_target.id <> v_me.id then
    if v_me_role = 'superadmin' then
      if v_t_role = 'superadmin' then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
    elsif v_me_role in ('admin', 'hr', 'hr_manager') then
      if v_t_role in ('admin', 'superadmin') then return jsonb_build_object('ok', false, 'reason', 'forbidden'); end if;
    else
      return jsonb_build_object('ok', false, 'reason', 'forbidden');
    end if;
  end if;

  if v_new <> '' then
    v_min := (case when v_t_admin then 8 else 6 end);
    if length(v_new) < v_min then
      return jsonb_build_object('ok', false, 'reason', 'too_short', 'min', v_min);
    end if;
    if lower(v_new) = lower(btrim(v_target.employee_code)) then
      return jsonb_build_object('ok', false, 'reason', 'same_as_code');
    end if;
  end if;

  perform public._pvt_store_password(v_target.id, v_new, v_me.id);
  -- ตั้งรหัสใหม่ให้ผู้อื่น → ยกเลิกบัตรผ่านเดิมของบัญชีนั้นทุกเครื่อง
  if v_target.id <> v_me.id then
    update public.auth_sessions set revoked_at = now() where employee_id = v_target.id and revoked_at is null;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- สถานะรหัสผ่าน (ไว้แสดงในคอนโซล "ตั้งแล้ว / ยังไม่ได้ตั้ง") — เฉพาะผู้ดูแลระบบ
create or replace function public.pvt_password_states(p_token text, p_ids uuid[])
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare v_me public.employees;
begin
  v_me := public._pvt_session_employee(p_token);
  if v_me.id is null or lower(btrim(coalesce(v_me.role, ''))) not in ('superadmin', 'admin', 'hr', 'hr_manager') then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;
  return jsonb_build_object('ok', true, 'states', coalesce((
    select jsonb_object_agg(e.id, case
      when public._pvt_stored_password(e.id) is null or public._pvt_stored_password(e.id) = btrim(e.employee_code) then 'none'
      else 'set' end)
    from public.employees e where e.id = any(p_ids)
  ), '{}'::jsonb));
end;
$$;

grant execute on function public.pvt_login(text, text, boolean, text) to anon, authenticated;
grant execute on function public.pvt_qr_login(text, boolean, text) to anon, authenticated;
grant execute on function public.pvt_session(text) to anon, authenticated;
grant execute on function public.pvt_logout(text) to anon, authenticated;
grant execute on function public.pvt_change_password(text, text, text) to anon, authenticated;
grant execute on function public.pvt_set_password(text, uuid, text) to anon, authenticated;
grant execute on function public.pvt_password_states(text, uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) ป้องกันคอลัมน์ employees.password
--    • ค่าที่เขียนมา → ย้ายไปเก็บแบบเข้ารหัสใน employee_secrets แล้วล้างคอลัมน์เป็น null เสมอ
--    • บัญชีผู้ดูแลระบบ: เขียนจากหน้าเว็บโดยตรง (anon/authenticated) → ไม่รับ (ต้องตั้งผ่าน pvt_set_password)
--    • พนักงานที่ถูกเปลี่ยนเป็นผู้ดูแลระบบจากหน้าเว็บโดยตรง → ล้างรหัสเดิมทิ้ง (ต้องตั้งรหัสเฉพาะใหม่)
--    • SQL Editor (ผู้ใช้ postgres) เขียนได้ตามปกติ (เช่น admin_levels.sql / set_admin_password.sql)
-- ---------------------------------------------------------------------------
create or replace function public._pvt_employees_password_guard()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  -- เขียนจาก API ของ Supabase: session_user = authenticator และมี request.jwt.claims เสมอ → ไม่ใช่ผู้ดูแลฐานข้อมูล
  v_trusted boolean := session_user not in ('anon', 'authenticated', 'authenticator')
                       and coalesce(current_setting('request.jwt.claims', true), '') = '';
  v_admin_new boolean := public._pvt_is_admin(new.role, new.employee_code);
  v_admin_old boolean := tg_op = 'UPDATE' and public._pvt_is_admin(old.role, old.employee_code);
begin
  -- INSERT: ยังไม่รู้ว่าจะชนแถวเดิม (upsert) หรือไม่ → ปล่อยค่าไว้ ให้ trigger AFTER INSERT / UPDATE ด้านล่างจัดการ
  if tg_op = 'INSERT' then return new; end if;

  if new.password is not null and btrim(new.password) <> '' then
    if v_admin_new and not v_trusted then
      raise notice 'pvt: ignored direct admin password write for %', new.employee_code;
    else
      perform public._pvt_store_password(new.id, new.password, null);
    end if;
    new.password := null;
  elsif new.password is distinct from old.password then
    new.password := null;   -- ล้างคอลัมน์ (ไม่ลบรหัสที่เก็บไว้)
  end if;

  -- ยกระดับเป็นผู้ดูแลระบบจากหน้าเว็บโดยตรง → รหัสเดิม (ที่พนักงานเคยตั้ง) ใช้ไม่ได้
  if v_admin_new and not v_trusted and not v_admin_old then
    delete from public.employee_secrets where employee_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employees_password_guard on public.employees;
create trigger trg_employees_password_guard
  before update on public.employees
  for each row execute function public._pvt_employees_password_guard();

-- แถวใหม่: ย้ายรหัสผ่านไป employee_secrets แล้วล้างคอลัมน์
create or replace function public._pvt_employees_password_after_insert()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_trusted boolean := session_user not in ('anon', 'authenticated', 'authenticator')
                       and coalesce(current_setting('request.jwt.claims', true), '') = '';
begin
  if new.password is null then return null; end if;
  if btrim(new.password) <> '' then
    if public._pvt_is_admin(new.role, new.employee_code) and not v_trusted then
      raise notice 'pvt: ignored direct admin password write for %', new.employee_code;
    else
      perform public._pvt_store_password(new.id, new.password, null);
    end if;
  end if;
  update public.employees set password = null where id = new.id;
  return null;
end;
$$;

drop trigger if exists trg_employees_password_after_insert on public.employees;
create trigger trg_employees_password_after_insert
  after insert on public.employees
  for each row execute function public._pvt_employees_password_after_insert();

create or replace function public._pvt_employees_cleanup()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  delete from public.employee_secrets where employee_id = old.id;
  update public.auth_sessions set revoked_at = now() where employee_id = old.id and revoked_at is null;
  return old;
end;
$$;
drop trigger if exists trg_employees_cleanup on public.employees;
create trigger trg_employees_cleanup
  after delete on public.employees
  for each row execute function public._pvt_employees_cleanup();

-- ระงับบัญชี → ยกเลิกบัตรผ่านทุกเครื่อง
create or replace function public._pvt_employees_status_revoke()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if lower(btrim(coalesce(new.status, 'active'))) <> 'active' and lower(btrim(coalesce(old.status, 'active'))) = 'active' then
    update public.auth_sessions set revoked_at = now() where employee_id = new.id and revoked_at is null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_employees_status_revoke on public.employees;
create trigger trg_employees_status_revoke
  after update of status on public.employees
  for each row execute function public._pvt_employees_status_revoke();

-- ---------------------------------------------------------------------------
-- 6) ย้ายรหัสผ่านเดิม → employee_secrets (เข้ารหัส) แล้วล้างคอลัมน์
--    รหัสที่เท่ากับรหัสพนักงาน ไม่ต้องย้าย (พนักงานใช้รหัสพนักงานได้อยู่แล้ว · ผู้ดูแลระบบใช้ไม่ได้อยู่แล้ว)
-- ---------------------------------------------------------------------------
insert into public.employee_secrets (employee_id, password_hash)
select e.id, public._pvt_hash(e.password)
from public.employees e
where e.password is not null and btrim(e.password) <> '' and lower(btrim(e.password)) <> lower(btrim(e.employee_code))
on conflict (employee_id) do nothing;

update public.employees set password = null where password is not null;

-- ---------------------------------------------------------------------------
-- 7) ฟังก์ชันเดิมของคอนโซล (ดูประวัติเข้าระบบ) → อ่านรหัสจากตารางใหม่
-- ---------------------------------------------------------------------------
create or replace function public._verify_superadmin(p_code text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_pw text;
begin
  select e.id into v_id
  from public.employees e
  where lower(e.employee_code) = lower(trim(coalesce(p_code, '')))
    and lower(coalesce(e.role, '')) = 'superadmin'
    and lower(coalesce(e.status, 'active')) = 'active'
  limit 1;
  v_pw := case when v_id is null then null else public._pvt_stored_password(v_id) end;

  if v_id is null or v_pw is null or v_pw !~ '^[$]2[aby][$]' or not public._pvt_hash_matches(v_pw, p_password) then
    perform pg_sleep(1);
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  return v_id;
end;
$$;
revoke all on function public._verify_superadmin(text, text) from public, anon, authenticated;

-- ✅ ตรวจผล
select
  (select count(*) from public.employee_secrets)                       as passwords_moved,
  (select count(*) from public.employees where password is not null)   as passwords_left_in_employees,  -- ต้องเป็น 0
  (select count(*) from public.employees e
     where public._pvt_is_admin(e.role, e.employee_code)
       and (public._pvt_stored_password(e.id) is null or public._pvt_stored_password(e.id) = btrim(e.employee_code))) as admin_accounts_without_password;
