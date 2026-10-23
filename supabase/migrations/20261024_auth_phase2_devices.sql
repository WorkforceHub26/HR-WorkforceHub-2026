-- ============================================================================
-- 🔐 ความปลอดภัยการเข้าระบบ ช่วงที่ 2: เครื่องของตัวเอง / เครื่องยืม
--   ต้องรัน 20261023_auth_phase1_server_login.sql ก่อน · รันใน Supabase > SQL Editor (DEV ก่อน แล้ว MAIN) · รันซ้ำได้
--
--   เข้าระบบครั้งแรกบนเครื่องไหน ระบบถามครั้งเดียว "นี่เป็นเครื่องของคุณใช่ไหม"
--     ใช่ (เครื่องของฉัน) → จำไว้ 90 วัน (เปิดแอปมาก็อยู่ในระบบเลย)
--     ไม่ใช่ (ยืมเครื่อง)  → บัตรผ่านอายุ 2 ชั่วโมง · หน้าเว็บออกจากระบบให้หลังยื่นใบลา / ไม่ได้ใช้งาน 10 นาที
--   ไม่ต้องถาม / ถือเป็นเครื่องยืมอัตโนมัติ เมื่อ
--     • เครื่องนี้มีคนอื่นบอกไว้แล้วว่าเป็นเครื่องของเขา
--     • ภายใน 30 วันมีคนอื่นเข้าระบบจากเครื่องนี้ (เครื่องใช้ร่วมกัน)
--   เจ้าของเครื่องไม่ได้ใช้เครื่องนั้นเกิน 60 วัน (เช่น เปลี่ยน/ขายเครื่อง) → คนใหม่บอกว่าเป็นเครื่องของตัวเองได้
--   HR ล้างเครื่องที่จำไว้ของพนักงานได้ (หน้าจัดการพนักงาน > แก้ไขข้อมูล) เช่น เครื่องหาย / ลงทะเบียนผิดคน
--
--   รหัสเครื่องเป็นค่าสุ่มที่เบราว์เซอร์สร้างเอง (ไม่ใช่เลขเครื่อง/ข้อมูลส่วนตัว) และเก็บในฐานข้อมูลเป็นค่า hash
--   (ไม่เขียนเครื่องหมายดอลลาร์ติดกับตัวอักษรในไฟล์นี้ — SQL Editor ของ Supabase จะเข้าใจผิด)
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.auth_devices (
  device_hash        text primary key,
  owner_employee_id  uuid not null,
  claimed_at         timestamptz not null default now(),
  last_seen_at       timestamptz not null default now()
);
create index if not exists idx_auth_devices_owner on public.auth_devices (owner_employee_id);
alter table public.auth_devices enable row level security;
revoke all on public.auth_devices from public, anon, authenticated;

alter table public.auth_sessions add column if not exists device_hash text;
create index if not exists idx_auth_sessions_device on public.auth_sessions (device_hash, created_at desc);

-- ---------------------------------------------------------------------------
-- ภายใน
-- ---------------------------------------------------------------------------
create or replace function public._pvt_device_hash(p_device_id text)
returns text language sql immutable
set search_path = public, extensions
as $$
  select case when length(btrim(coalesce(p_device_id, ''))) between 16 and 100
              then encode(digest('pvt-device:' || btrim(p_device_id), 'sha256'), 'hex') end;
$$;

-- 'own' · 'shared' · 'ask' (ยังไม่รู้ ต้องถาม) · 'none' (หน้าเว็บรุ่นเก่า ไม่ส่งรหัสเครื่อง)
create or replace function public._pvt_device_kind(p_emp uuid, p_device_hash text)
returns text language plpgsql stable security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_seen  timestamptz;
begin
  if p_device_hash is null then return 'none'; end if;
  select owner_employee_id, last_seen_at into v_owner, v_seen from public.auth_devices where device_hash = p_device_hash;
  if v_owner = p_emp then return 'own'; end if;
  if v_owner is not null and v_seen > now() - interval '60 days' then return 'shared'; end if;
  if exists (select 1 from public.auth_sessions s
             where s.device_hash = p_device_hash and s.employee_id <> p_emp
               and s.created_at > now() - interval '30 days'
               and (v_owner is null or s.employee_id <> v_owner)) then
    return 'shared';
  end if;
  return 'ask';
end;
$$;

create or replace function public._pvt_session_expiry(p_kind text, p_remember boolean)
returns timestamptz language sql stable as $$
  select now() + case p_kind
    when 'own'    then interval '90 days'
    when 'shared' then interval '2 hours'
    when 'ask'    then interval '12 hours'
    else case when coalesce(p_remember, true) then interval '30 days' else interval '12 hours' end
  end;
$$;

drop function if exists public._pvt_new_session(uuid, text, boolean, text);
create or replace function public._pvt_new_session(
  p_emp uuid, p_method text, p_remember boolean, p_user_agent text,
  p_device_hash text default null
) returns jsonb language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_token   text := encode(gen_random_bytes(32), 'hex');
  v_kind    text := public._pvt_device_kind(p_emp, p_device_hash);
  v_expires timestamptz := public._pvt_session_expiry(v_kind, p_remember);
begin
  insert into public.auth_sessions (token_hash, employee_id, method, device_kind, device_hash, user_agent, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_emp, coalesce(p_method, 'password'),
          case when v_kind = 'none' then 'unknown' else v_kind end, p_device_hash, left(p_user_agent, 300), v_expires);
  if v_kind = 'own' then
    update public.auth_devices set last_seen_at = now() where device_hash = p_device_hash;
  end if;
  return jsonb_build_object('token', v_token, 'expires_at', v_expires,
    'device_kind', case when v_kind = 'none' then 'unknown' else v_kind end,
    'ask_device', v_kind = 'ask');
end;
$$;
revoke all on function public._pvt_device_hash(text) from public, anon, authenticated;
revoke all on function public._pvt_device_kind(uuid, text) from public, anon, authenticated;
revoke all on function public._pvt_session_expiry(text, boolean) from public, anon, authenticated;
revoke all on function public._pvt_new_session(uuid, text, boolean, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- เข้าระบบ (เพิ่มรหัสเครื่อง p_device_id · หน้าเว็บรุ่นช่วงที่ 1 ที่ไม่ส่งรหัสเครื่องยังใช้ได้)
-- ---------------------------------------------------------------------------
drop function if exists public.pvt_login(text, text, boolean, text);
create or replace function public.pvt_login(
  p_login text, p_password text, p_remember boolean default true, p_user_agent text default null,
  p_device_id text default null
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
  v_sess := public._pvt_new_session(v_emp.id, 'password', p_remember, p_user_agent, public._pvt_device_hash(p_device_id));
  return jsonb_build_object('ok', true, 'user', public._pvt_user_json(v_emp.id)) || v_sess;
end;
$$;

drop function if exists public.pvt_qr_login(text, boolean, text);
create or replace function public.pvt_qr_login(
  p_code text, p_remember boolean default true, p_user_agent text default null,
  p_device_id text default null
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
  v_sess := public._pvt_new_session(v_emp.id, 'qr', p_remember, p_user_agent, public._pvt_device_hash(p_device_id));
  return jsonb_build_object('ok', true, 'user', public._pvt_user_json(v_emp.id)) || v_sess;
end;
$$;

grant execute on function public.pvt_login(text, text, boolean, text, text) to anon, authenticated;
grant execute on function public.pvt_qr_login(text, boolean, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ตอบคำถาม "นี่เป็นเครื่องของคุณใช่ไหม"
--   ผล: { ok, device_kind: 'own' | 'shared', expires_at, reason? }
--   reason 'used_by_others' = มีคนอื่นใช้เครื่องนี้อยู่ จึงตั้งเป็นเครื่องของตัวเองไม่ได้ (ระบบถือเป็นเครื่องยืม)
-- ---------------------------------------------------------------------------
create or replace function public.pvt_set_device(p_token text, p_device_id text, p_own boolean)
returns jsonb language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_sid   uuid;
  v_emp   uuid;
  v_dhash text := public._pvt_device_hash(p_device_id);
  v_sdev  text;
  v_kind  text;
  v_exp   timestamptz;
begin
  select s.id, s.employee_id, s.device_hash into v_sid, v_emp, v_sdev
  from public.auth_sessions s
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and s.revoked_at is null and s.expires_at > now();
  if v_sid is null then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if v_dhash is null or v_sdev is distinct from v_dhash then
    return jsonb_build_object('ok', false, 'reason', 'device_mismatch');
  end if;

  v_kind := public._pvt_device_kind(v_emp, v_dhash);
  if coalesce(p_own, false) and v_kind in ('ask', 'own') then
    insert into public.auth_devices (device_hash, owner_employee_id) values (v_dhash, v_emp)
    on conflict (device_hash) do update set owner_employee_id = excluded.owner_employee_id, claimed_at = now(), last_seen_at = now();
    v_exp := public._pvt_session_expiry('own', true);
    update public.auth_sessions set device_kind = 'own', expires_at = v_exp where id = v_sid;
    return jsonb_build_object('ok', true, 'device_kind', 'own', 'expires_at', v_exp);
  end if;

  v_exp := least((select expires_at from public.auth_sessions where id = v_sid), public._pvt_session_expiry('shared', false));
  update public.auth_sessions set device_kind = 'shared', expires_at = v_exp where id = v_sid;
  return jsonb_build_object('ok', true, 'device_kind', 'shared', 'expires_at', v_exp,
    'reason', case when coalesce(p_own, false) then 'used_by_others' end);
end;
$$;
grant execute on function public.pvt_set_device(text, text, boolean) to anon, authenticated;

-- ตรวจบัตรผ่าน: เพิ่ม device_kind
create or replace function public.pvt_session(p_token text)
returns jsonb language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_emp public.employees;
  v_kind text;
  v_exp timestamptz;
begin
  v_emp := public._pvt_session_employee(p_token);
  if v_emp.id is null then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  select device_kind, expires_at into v_kind, v_exp from public.auth_sessions
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  return jsonb_build_object('ok', true, 'user', public._pvt_user_json(v_emp.id), 'device_kind', v_kind, 'expires_at', v_exp);
end;
$$;

-- ล้างเครื่องที่จำไว้ของพนักงาน + ให้ออกจากระบบทุกเครื่อง (เช่น เครื่องหาย / ลงทะเบียนผิดคน)
--   ทำให้ตัวเองได้ · HR / ผู้ดูแลระบบทำให้คนอื่นได้ (บัญชี admin / superadmin ทำได้เฉพาะ superadmin)
create or replace function public.pvt_release_devices(p_token text, p_employee_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_me public.employees;
  v_target public.employees;
  v_me_role text;
  v_devices int;
  v_sessions int;
begin
  v_me := public._pvt_session_employee(p_token);
  if v_me.id is null then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  select * into v_target from public.employees where id = p_employee_id;
  if v_target.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  v_me_role := lower(btrim(coalesce(v_me.role, '')));
  if v_target.id <> v_me.id then
    if v_me_role not in ('superadmin', 'admin', 'hr', 'hr_manager') then
      return jsonb_build_object('ok', false, 'reason', 'forbidden');
    end if;
    if lower(btrim(coalesce(v_target.role, ''))) in ('admin', 'superadmin') and v_me_role <> 'superadmin' then
      return jsonb_build_object('ok', false, 'reason', 'forbidden');
    end if;
  end if;
  delete from public.auth_devices where owner_employee_id = v_target.id;
  get diagnostics v_devices = row_count;
  update public.auth_sessions set revoked_at = now()
  where employee_id = v_target.id and revoked_at is null
    and (v_target.id <> v_me.id or token_hash <> encode(extensions.digest(p_token, 'sha256'), 'hex'));
  get diagnostics v_sessions = row_count;
  return jsonb_build_object('ok', true, 'devices', v_devices, 'sessions', v_sessions);
end;
$$;
grant execute on function public.pvt_release_devices(text, uuid) to anon, authenticated;

-- ลบพนักงาน → ลบเครื่องที่จำไว้ด้วย
create or replace function public._pvt_employees_cleanup()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  delete from public.employee_secrets where employee_id = old.id;
  delete from public.auth_devices where owner_employee_id = old.id;
  update public.auth_sessions set revoked_at = now() where employee_id = old.id and revoked_at is null;
  return old;
end;
$$;

-- ✅ ตรวจผล
select
  (select count(*) from pg_proc where proname in ('pvt_login', 'pvt_qr_login')) as login_functions,   -- ต้องเป็น 2
  (select count(*) from public.auth_devices) as devices_registered;
