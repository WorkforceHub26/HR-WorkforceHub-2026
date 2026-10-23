-- ============================================================================
-- 🔐 ความปลอดภัยการเข้าระบบ ช่วงที่ 3: กด "อนุมัติ / ไม่อนุมัติ" จาก LINE ได้เลย ไม่ต้องใส่รหัส
--   ต้องรันช่วงที่ 1 และ 2 ก่อน · รันใน Supabase > SQL Editor (DEV ก่อน แล้ว MAIN) · รันซ้ำได้
--   และต้อง deploy Edge Function line-send ชุดใหม่ (supabase/functions/line-send/index.ts)
--
--   วิธีทำงาน
--     1) ตอนส่ง LINE ถึงผู้อนุมัติ Edge Function line-send (ทำงานฝั่งเซิร์ฟเวอร์) ขอ "ลิงก์ใช้ครั้งเดียว" จากฐานข้อมูล
--        ใส่ลงในปุ่มของข้อความ — หน้าเว็บของคนที่ยื่นใบลาไม่เห็นลิงก์นี้ (กันการกดอนุมัติใบลาของตัวเอง)
--        ออกลิงก์ให้เฉพาะผู้อนุมัติของลำดับที่รอพิจารณาอยู่จริง
--     2) ผู้อนุมัติกดปุ่มใน LINE → เข้าระบบในบัญชีของตัวเองอัตโนมัติ → เปิดใบลานั้น → กดยืนยันอีกครั้ง
--     3) ลิงก์ใช้ได้ครั้งเดียว · อายุ 3 วัน · ใบลาไม่รออยู่แล้ว / ผู้อนุมัติถูกระงับ → ลิงก์ใช้ไม่ได้
--        ใช้ไปแล้ว → ระบบให้เข้าสู่ระบบตามปกติ แล้วพาไปที่ใบลาเดิม
--     เครื่องที่เปิดจาก LINE ถือเป็น "เครื่องของผู้อนุมัติ" (ถ้ายังไม่มีเจ้าของ) จำไว้ 90 วัน
--   ⚠️ แจ้งผู้อนุมัติ: อย่าส่งต่อข้อความแจ้งเตือนใบลาให้คนอื่น (คนที่กดลิงก์ก่อนจะเข้าบัญชีผู้อนุมัติได้)
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.leave_action_links (
  id           uuid primary key default gen_random_uuid(),
  token_hash   text not null unique,
  leave_id     uuid not null,
  employee_id  uuid not null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  used_at      timestamptz,
  used_user_agent text
);
create index if not exists idx_leave_action_links_leave on public.leave_action_links (leave_id, employee_id);
alter table public.leave_action_links enable row level security;
revoke all on public.leave_action_links from public, anon, authenticated;

-- ผู้อนุมัติของลำดับที่รอพิจารณาอยู่ตอนนี้
--   สายอนุมัติใหม่ (leave_approval_steps): อยู่ในรายชื่อของลำดับ pending หรือเป็น HR/Admin เมื่อลำดับนั้นเป็น "HR คนใดก็ได้"
--   ระบบเดิม (ไม่มีขั้นในตารางใหม่): บทบาทผู้อนุมัติ/HR
create or replace function public._pvt_is_current_approver(p_leave uuid, p_emp uuid)
returns boolean language plpgsql stable security definer
set search_path = public
as $$
declare
  v_role text;
  v_has_steps boolean;
begin
  if not exists (select 1 from public.leave_requests where id = p_leave and status = 'pending') then return false; end if;
  select lower(btrim(coalesce(role, ''))) into v_role from public.employees
  where id = p_emp and lower(btrim(coalesce(status, 'active'))) = 'active';
  if v_role is null then return false; end if;

  select exists (select 1 from public.leave_approval_steps where leave_id = p_leave) into v_has_steps;
  if v_has_steps then
    return exists (
      select 1 from public.leave_approval_steps s
      where s.leave_id = p_leave and s.status = 'pending'
        and (p_emp = any(s.approver_ids)
             or (s.hr_any and v_role in ('hr', 'admin', 'superadmin', 'hr_manager')))
    );
  end if;
  return v_role in ('leader', 'supervisor', 'manager', 'hr', 'admin', 'superadmin', 'hr_manager', 'executive', 'director', 'owner');
end;
$$;
revoke all on function public._pvt_is_current_approver(uuid, uuid) from public, anon, authenticated;

-- ออกลิงก์ (เรียกได้เฉพาะ Edge Function ด้วย service_role) → คืนรหัสลิงก์ หรือ null ถ้าไม่ใช่ผู้อนุมัติ
create or replace function public.pvt_mint_action_link(p_leave_id uuid, p_line_id text)
returns text language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_emp uuid;
  v_token text;
begin
  if p_leave_id is null or btrim(coalesce(p_line_id, '')) = '' then return null; end if;
  select id into v_emp from public.employees
  where btrim(line_id) = btrim(p_line_id) and lower(btrim(coalesce(status, 'active'))) = 'active'
  order by updated_at desc nulls last limit 1;
  if v_emp is null or not public._pvt_is_current_approver(p_leave_id, v_emp) then return null; end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.leave_action_links (token_hash, leave_id, employee_id, expires_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_leave_id, v_emp, now() + interval '3 days');
  return v_token;
end;
$$;
revoke all on function public.pvt_mint_action_link(uuid, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.pvt_mint_action_link(uuid, text) to service_role';
  end if;
end $$;

-- ใช้ลิงก์ (หน้าเว็บเรียก) → เข้าระบบในบัญชีผู้อนุมัติ
--   ผล: { ok, user, token, expires_at, device_kind, leave_id } หรือ { ok:false, reason: invalid · used · expired · not_pending · inactive }
create or replace function public.pvt_line_link_login(p_link text, p_device_id text default null, p_user_agent text default null)
returns jsonb language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_link  public.leave_action_links;
  v_sess  jsonb;
  v_dhash text := public._pvt_device_hash(p_device_id);
  v_exp   timestamptz;
begin
  if btrim(coalesce(p_link, '')) !~ '^[0-9a-f]{64}' then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  select * into v_link from public.leave_action_links where token_hash = encode(digest(btrim(p_link), 'sha256'), 'hex');
  if v_link.id is null then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if v_link.used_at is not null then return jsonb_build_object('ok', false, 'reason', 'used', 'leave_id', v_link.leave_id); end if;
  if v_link.expires_at < now() then return jsonb_build_object('ok', false, 'reason', 'expired', 'leave_id', v_link.leave_id); end if;
  if not exists (select 1 from public.employees where id = v_link.employee_id and lower(btrim(coalesce(status, 'active'))) = 'active') then
    return jsonb_build_object('ok', false, 'reason', 'inactive');
  end if;

  update public.leave_action_links set used_at = now(), used_user_agent = left(p_user_agent, 300) where id = v_link.id;
  insert into public.auth_attempts (login_key, employee_id, ok, reason) values ('line_link', v_link.employee_id, true, 'line_link');

  v_sess := public._pvt_new_session(v_link.employee_id, 'line_link', true, p_user_agent, v_dhash);
  -- เปิดจาก LINE ของผู้อนุมัติเอง → เครื่องที่ยังไม่มีเจ้าของ ถือเป็นเครื่องของผู้อนุมัติ
  if coalesce((v_sess->>'ask_device')::boolean, false) and v_dhash is not null then
    insert into public.auth_devices (device_hash, owner_employee_id) values (v_dhash, v_link.employee_id)
    on conflict (device_hash) do update set owner_employee_id = excluded.owner_employee_id, claimed_at = now(), last_seen_at = now();
    v_exp := public._pvt_session_expiry('own', true);
    update public.auth_sessions set device_kind = 'own', expires_at = v_exp
    where token_hash = encode(digest(v_sess->>'token', 'sha256'), 'hex');
    v_sess := v_sess || jsonb_build_object('device_kind', 'own', 'ask_device', false, 'expires_at', v_exp);
  end if;

  return jsonb_build_object('ok', true, 'user', public._pvt_user_json(v_link.employee_id),
    'leave_id', v_link.leave_id, 'still_pending', public._pvt_is_current_approver(v_link.leave_id, v_link.employee_id)) || v_sess;
end;
$$;
grant execute on function public.pvt_line_link_login(text, text, text) to anon, authenticated;

-- ✅ ตรวจผล
select (select count(*) from pg_proc where proname in ('pvt_mint_action_link', 'pvt_line_link_login')) as functions_ready;  -- ต้องเป็น 2
