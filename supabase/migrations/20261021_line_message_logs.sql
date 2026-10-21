-- ============================================================================
-- 💬 บันทึกการส่งข้อความ LINE (ใช้นับจำนวนต่อเดือนในคอนโซลผู้ดูแลระบบ)
--
--   ระบบบันทึกทุกครั้งที่ส่งแจ้งเตือนผ่าน LINE OA (auth/supabase-config.js → sendWorkflowNotification)
--     result = 'sent'     ส่งสำเร็จ (นับเป็นข้อความที่ใช้โควตา LINE)
--              'failed'   ส่งไม่สำเร็จ (ไม่ใช้โควตา)
--              'no_line'  ผู้รับยังไม่ผูกบัญชี LINE จึงไม่ได้ส่ง (ไม่ใช้โควตา)
--   ตัวเลข "ใช้ไปเดือนนี้" ที่แม่นที่สุดมาจาก LINE โดยตรง (Edge Function line-send → action: 'quota')
--   ตารางนี้ใช้แยกดูว่าส่งเรื่องอะไร ถึงใคร สำเร็จหรือไม่ และดูย้อนหลังรายเดือน
--
--   เพิ่มได้อย่างเดียว แก้/ลบไม่ได้ · รันใน Supabase > SQL Editor ทั้ง MAIN และ DEV · รันซ้ำได้
-- ============================================================================

create table if not exists public.line_message_logs (
  id              uuid primary key default gen_random_uuid(),
  sent_at         timestamptz not null default now(),
  msg_type        text,                 -- NEW_REQUEST, LEADER_APPROVED, REQUEST_APPROVED, REJECTED, CANCELLATION, TEST ...
  result          text not null check (result in ('sent', 'failed', 'no_line')),
  via             text,                 -- edge | server
  recipient_id    uuid,
  recipient_role  text,
  leave_id        uuid,
  error           text,
  sender_id       uuid                  -- ผู้ใช้ที่ทำให้เกิดการส่ง (คนที่กดอนุมัติ/ยื่นใบลา)
);

create index if not exists idx_line_logs_sent_at on public.line_message_logs (sent_at desc);

create or replace function public.line_message_logs_block_change()
returns trigger language plpgsql as $$
begin
  raise exception 'line_message_logs เป็นบันทึก แก้ไขหรือลบไม่ได้';
end;
$$;

drop trigger if exists line_message_logs_no_change on public.line_message_logs;
create trigger line_message_logs_no_change
  before update or delete on public.line_message_logs
  for each row execute function public.line_message_logs_block_change();

alter table public.line_message_logs enable row level security;

drop policy if exists line_message_logs_insert on public.line_message_logs;
create policy line_message_logs_insert on public.line_message_logs
  for insert to anon, authenticated with check (true);

drop policy if exists line_message_logs_select on public.line_message_logs;
create policy line_message_logs_select on public.line_message_logs
  for select to anon, authenticated using (true);

revoke update, delete, truncate on public.line_message_logs from anon, authenticated;
grant select, insert on public.line_message_logs to anon, authenticated;

-- ✅ ตรวจ
select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'line_message_logs' order by cmd;
