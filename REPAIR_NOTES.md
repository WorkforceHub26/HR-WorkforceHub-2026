# PVTT Workforce Hub - Repair Notes

ตรวจและรวมโปรเจกต์จาก ZIP วันที่ 2026-09-17

## แก้ไขหลัก
- รวมไฟล์ที่ขาดจาก `Workforce-Hub-main` เข้ากับชุดรากที่ใหม่กว่า โดยไม่ทับไฟล์รากที่มีการแก้ไขล่าสุด
- เติมหน้า/ไฟล์ที่ขาด เช่น `pages/hr/admin-dashboard.html`, `pages/user/news.html`, assets, auth, JS/CSS services/components และไฟล์ PWA
- คง `pages/hr/holidays.html`, `js/admin-holidays.js`, `css/admin-holidays.css` จากชุดราก และให้ `vite.config.js` build หน้านี้ด้วย
- เปลี่ยน `package.json` เป็นชุด dependency ที่ครบสำหรับ Vite/Tailwind/Express
- ลบ reference ที่ไม่มีไฟล์จริง `/index.tsx` และ `/index.css` ออกจาก `index.html`
- ตรวจ JavaScript syntax ด้วย `node --check`
- ตรวจ local `src`/`href` ใน HTML แล้วไม่พบไฟล์อ้างอิงที่หาย
- ตรวจ Vite multi-page inputs แล้วพบครบทุกหน้า

## ความปลอดภัย
- ไม่รวม `.env.local` ใน ZIP ที่แก้แล้ว โปรดนำ `.env.local` เดิมของคุณวางกลับที่ root ของโปรเจกต์บนเครื่องของคุณเท่านั้น
- `.env.example` ยังคงอยู่เพื่อเป็นตัวอย่างตัวแปรระบบ

## หมายเหตุการทดสอบ
- ตรวจ static references และ JavaScript syntax ผ่านแล้ว
- ไม่ได้รัน `npm run build` จนจบในสภาพแวดล้อมนี้ เนื่องจาก dependency ยังไม่ได้ติดตั้งและการติดตั้งจาก registry ไม่สำเร็จภายใน session
