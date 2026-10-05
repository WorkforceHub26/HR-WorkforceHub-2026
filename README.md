# PVTT Workforce Hub

ระบบใบลาออนไลน์และจัดการพนักงาน (Vanilla JS + Supabase) — build ด้วย Vite, รันจริงด้วย Express

## เริ่มใช้งาน

1. ติดตั้ง dependency: `npm install`
2. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า Supabase / LINE / `GEMINI_API_KEY`
3. รันโหมดพัฒนา: `npm run dev` → http://localhost:3000
4. Build สำหรับใช้งานจริง: `npm run build` แล้ว `npm start`
5. รันเทสต์: `npm test`

## โครงสร้าง

| โฟลเดอร์ | เนื้อหา |
|---|---|
| `index.html` | หน้าเข้าสู่ระบบ |
| `pages/user/` | หน้าพนักงาน (และ `leave-stats.html` สำหรับหัวหน้างาน) |
| `pages/approver/` | หน้าอนุมัติใบลาของหัวหน้างาน/ผู้จัดการ |
| `pages/hr/` | หน้าฝ่ายบุคคล / ผู้ดูแลระบบ |
| `js/`, `js/components/` | สคริปต์ของแต่ละหน้า และคอมโพเนนต์ที่ใช้ร่วมกัน |
| `auth/` | ระบบล็อกอินและ Supabase client กลาง |
| `css/` | สไตล์ของแต่ละหน้า |
| `assets/` | ไอคอนและรูปภาพ |
| `public/` | `favicon.ico`, `manifest.json`, `sw.js`, `metadata.json` (Vite คัดลอกไปที่ root ของเว็บให้อัตโนมัติ) |
| `api-handlers.js`, `server.js` | API ฝั่ง server (LINE, login logs, OCR, chatbot, WebAuthn) |
| `supabase/` | SQL schema / migrations และ Edge Function |
| `src/tests/` | Unit tests (Vitest) |

รายละเอียดเชิงลึกของโค้ดอยู่ที่ `DEVELOPER_GUIDE.md` และบันทึกการแก้ไขล่าสุดอยู่ที่ `CLEANUP_NOTES.md`
