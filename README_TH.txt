PVT Workforce Hub — แก้ LINE ไม่แจ้งเตือน (pvt_linefix.zip)
============================================================
ไฟล์นี้ "แทน" pvt_envfix2.zip (รวมการแก้ของ envfix / envfix2 ไว้ครบแล้ว) — ใช้ไฟล์นี้ไฟล์เดียว

สาเหตุ
- โค้ดหน้าเว็บมีบั๊ก "isUuid is not defined" ทำให้ระบบไม่เคยเรียก Edge Function line-send เลย
  แล้วไปใช้ทางสำรอง /api/send-notification ซึ่งไม่มีบน Cloudflare → HTTP 405
- Token LINE / Edge Function บน MAIN ปกติดี ไม่ต้องแก้

ไฟล์ที่เปลี่ยน
- auth/supabase-config.js   แก้บั๊ก isUuid + กัน GET 400 ตอนกดปุ่มทดสอบ (+ การแก้สภาพแวดล้อม Dev/Main จาก envfix2)
- public/sw.js              VERSION = pvt-v20261028-linefix (บังคับเครื่องผู้ใช้โหลดไฟล์ใหม่)
- CLEANUP_NOTES.md          บันทึกการแก้
- supabase/check_line_and_testdata.sql, .env.example  (เหมือนใน envfix2)

ติดตั้ง
1) แตก zip ทับโฟลเดอร์โปรเจกต์ แล้ว push / deploy ขึ้นทั้ง workforcehub (MAIN) และ hr-workforcehub (DEV)
2) เปิดเว็บแล้วกด Ctrl+F5 (หรือปิด-เปิดแอปบนมือถือ) ให้โหลดเวอร์ชันใหม่
3) ทดสอบ: ตั้งค่าสายอนุมัติ › LINE › ทดสอบส่ง
   - สำเร็จ = LINE เข้า
   - ยังไม่สำเร็จ → ดู line_message_logs คอลัมน์ error (ขึ้นต้นด้วย "edge HTTP ...")
     ถ้าเป็น "The property, 'to' ... is invalid" = LINE ID ของผู้รับคนนั้นมาจาก LINE OA อื่น → ให้ผูก LINE ใหม่
