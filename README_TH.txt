PVT Workforce Hub — แก้การ์ดใบลาในหน้าอนุมัติของหัวหน้า (pvt_apcards.zip)
ติดตั้งต่อจาก pvt_nocache.zip

ปัญหา: หน้าอนุมัติใบลาของหัวหน้า (มือถือ) แท็บ "ประวัติรายการ" / "คำร้องขอยกเลิก" การ์ดไม่มีรูปแบบ รูปโปรไฟล์ใหญ่เต็มจอ

ไฟล์ที่แก้
- css/approver-cards.css                (ใหม่) รูปแบบการ์ดใบลาสำหรับหน้าอนุมัติของหัวหน้า
- pages/approver/leave-approvals.html   โหลดไฟล์ด้านบน
- public/sw.js                          VERSION = pvt-v20261030-apcards

ติดตั้ง: วางทับไฟล์เดิม → deploy MAIN และ DEV → Ctrl+F5
