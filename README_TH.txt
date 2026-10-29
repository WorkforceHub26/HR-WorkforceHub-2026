PVT Workforce Hub — ตั้งค่าประเภทการลาเพิ่มเติม (pvt_ltopts.zip)
ใช้แทน pvt_othertype.zip (รวมไว้แล้ว) · ติดตั้งต่อจาก pvt_suspend.zip

ของใหม่ (หน้า ตั้งค่าโควตากลาง)
- เพิ่ม/แก้ไขประเภทการลา ติ๊กได้ว่า "ได้รับค่าจ้าง" และ "ไม่จำกัดจำนวนวัน"
- ประเภทที่เพิ่มเอง (เช่น หยุดพิเศษ) ใช้โควตาของตัวเอง และ HR ปรับสิทธิ์รายคนได้ที่ "ปรับโควตาพิเศษรายบุคคล"

ไฟล์ที่แก้
- auth/supabase-config.js
- js/management.js
- js/index-user.js
- js/leave-user.js
- public/sw.js                                         VERSION = pvt-v20261029-ltopts
- supabase/migrations/20261029_leave_type_options.sql  (ใหม่ · รันใน SQL Editor)

ติดตั้ง
1) Supabase SQL Editor: รัน 20261029_leave_type_options.sql (DEV ก่อน แล้ว MAIN · รันซ้ำได้ · ไม่แก้ข้อมูลเดิม)
2) วางไฟล์ทับของเดิม → deploy MAIN และ DEV → Ctrl+F5
