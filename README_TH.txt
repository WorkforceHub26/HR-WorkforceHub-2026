PVT Workforce Hub — ลิงก์ LINE ของใบลาที่ดำเนินการแล้ว (pvt_handled.zip)
ติดตั้งต่อจาก pvt_balfix.zip

ไฟล์ที่แก้
- js/hr.js        กดปุ่มใน LINE แล้วใบลาดำเนินการไปแล้ว → ขึ้นแจ้ง "ใบลานี้อนุมัติแล้ว / ถูกยกเลิกแล้ว / ไม่ได้รับอนุมัติ" พร้อมรายละเอียด
- auth/index.js   ไม่แจ้งซ้ำตอนเข้าระบบด้วยลิงก์
- public/sw.js    VERSION = pvt-v20261029-handled

ติดตั้ง: วางทับไฟล์เดิม → deploy MAIN และ DEV → Ctrl+F5
