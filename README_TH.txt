PVT Workforce Hub — แก้ยอดวันลา "ใช้ไป" เพี้ยน (pvt_balfix.zip)
ติดตั้งต่อจาก pvt_track.zip

ไฟล์ที่แก้
- auth/supabase-config.js   ทุกครั้งที่อนุมัติ/ยกเลิก ระบบคำนวณยอด "ใช้ไป" ใหม่จากใบลาที่อนุมัติแล้ว (ไม่บวก/ลบทีละครั้งแบบเดิม)
- js/management.js          ปุ่ม "แก้ไข" ใบลาในหน้าข้อมูลพนักงาน → ปรับยอดวันลาตามด้วย
- public/sw.js              VERSION = pvt-v20261029-balfix
- supabase/fix_leave_balance_used.sql   แก้ยอดของคนที่เพี้ยนไปแล้ว (ดูก่อน → แก้)
- supabase/check_leave_balance.sql      ตรวจยอดรายคน

ติดตั้ง
1) วางทับไฟล์เดิม → deploy MAIN และ DEV → Ctrl+F5
2) SQL Editor ของ MAIN: รัน fix_leave_balance_used.sql ข้อ 1 ดูรายชื่อ → ข้อ 2 แก้ → ข้อ 1 อีกครั้งต้องว่าง
