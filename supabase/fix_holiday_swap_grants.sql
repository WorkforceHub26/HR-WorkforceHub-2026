-- แก้ "permission denied for table holiday_swap_items" (401) — รันใน Supabase > SQL Editor ทั้ง MAIN และ DEV · รันซ้ำได้
grant select, insert, update, delete on public.holiday_swap_rounds to anon, authenticated;
grant select, insert, update, delete on public.holiday_swap_items  to anon, authenticated;
-- ตรวจ: ต้องเห็น anon มีสิทธิ์ SELECT ทั้ง 2 ตาราง
select table_name, grantee, string_agg(privilege_type, ', ') as privileges
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('holiday_swap_rounds','holiday_swap_items') and grantee in ('anon','authenticated')
group by table_name, grantee order by table_name, grantee;
