# บันทึกการตรวจ แก้ไข และลบไฟล์ (2026-10-03)

ผลตรวจ: `npm run build` ผ่าน (ได้ครบ 20 หน้า) · `npm test` ผ่าน 7/7 · JS ทุกไฟล์ผ่าน `node --check`
· CSS ทุกไฟล์ parse ผ่าน · ไฟล์ที่หน้าเว็บอ้างอิงถึงโหลดได้ครบทั้ง 111 ไฟล์ผ่าน `npm start`

## 1. ปัญหาที่ทำให้ build / production พัง

| ปัญหา | การแก้ |
|---|---|
| `vite.config.js` อ้างถึง `pages/user/leave-stats.html` ซึ่งไม่มีอยู่ → build ล้ม | สร้างหน้านี้ใหม่ (สถิติวันลาสำหรับหัวหน้างาน ใช้ `js/leave-stats.js` ตัวเดิม แสดงเฉพาะแผนกตนเอง) |
| สคริปต์ `build` คัดลอก `favicon.ico` จาก root ซึ่งไม่มีไฟล์นี้ → build ล้ม | เปลี่ยนเป็น `vite build && cp -r js auth css assets dist/` (ไฟล์ใน `public/` Vite คัดลอกให้เอง) |
| ปลั๊กอิน `@tailwindcss/vite` ทำ build ล้มที่ `holidays.css` (โปรเจกต์ไม่ได้ใช้ Tailwind แบบ build เลย มีแค่ CDN ใน full-guide) | ถอดปลั๊กอินและ dependency ออก |
| `css/holidays.css` บรรทัด 3083 มีตัวอักษร `\n` ปนอยู่ ทำให้ CSS หมวด 10 (การพับ/กางสรุปวันหยุด) ไม่ทำงานเลย | แปลงเป็นขึ้นบรรทัดจริง → **CSS ส่วนนี้จะเริ่มทำงาน: กล่องสรุปวันหยุดจะพับไว้เป็นค่าเริ่มต้นตามที่คอมเมนต์ระบุไว้** |
| `pages/approver/leave-approvals.html` ไม่อยู่ใน build input → หน้าอนุมัติของหัวหน้า 404 บน production | เพิ่มเข้า `vite.config.js` |
| `public/manifest.json` ชี้ไอคอน `iconicapp.png` ที่ไม่มีอยู่ → PWA ติดตั้งไม่ได้ | ใช้ `icon-192.png` / `icon-512.png` |
| `package.json` ไม่ตรงกับ `package-lock.json` (vitest ^5 แต่ lock เป็น 2.x) → `npm ci` ล้ม | แก้เวอร์ชัน, ตัด `qrcode` `sirv` ที่ไม่ได้ใช้, สร้าง lock ใหม่, ลบ `bun.lock` |

## 2. ไฟล์ที่หายไปและสร้างใหม่

- `js/components/login-logs-viewer.js` — ตารางประวัติการเข้าสู่ระบบ (ค้นหา, กรองวันที่/สถานะ, ส่งออก CSV, แสดงแบบ Modal) หน้า `pages/hr/login-logs.html` เคยขึ้นข้อความ "โหลดไม่สำเร็จ" ทุกครั้ง และ 7 หน้า HR โหลดไฟล์นี้แล้วได้ 404
- `js/components/recharts-summary.js` — กราฟแนวโน้มรายวันของเดือน (จำนวนคนลา / ใบลาที่ยื่น / การเข้าใช้งาน) ในหน้า HR หน้าหลัก ถ้า CDN ของ Recharts โหลดไม่ได้จะวาดเป็น SVG แทน
- `pages/user/leave-stats.html` — ดูข้อ 1

## 3. ลิงก์ที่เสีย

- `js/index-user.js`: การแจ้งเตือนใบลาด่วนส่งผู้จัดการไปที่ `/pages/management/management.html` (ไม่มีหน้านี้) → ส่งหัวหน้า/ผู้จัดการไปที่หน้าอนุมัติ `/pages/approver/leave-approvals.html` ส่วน HR/Admin ไปที่ `/pages/hr/hr.html`
- `js/index-user.js`: `goToContactHR` ชี้ `contact-hr.html` ที่ไม่มี → ชี้ `full-guide.html`
- `js/employee-card-modal.js`: ลบรูป `download.svg` / `print.svg` ที่ไม่มีอยู่ (ปุ่มมี emoji อยู่แล้ว)
- `pages/user/leave-rules.html`: ไอคอน `Logo_PVT_2026_B.png` → `apple-touch-icon.png`
- `vite.config.js`: เพิ่ม route `/api/test-line-connection` ให้ตรงกับ `server.js`

## 4. ไฟล์ที่ลบ (ไม่มีหน้าไหนอ้างถึง)

**ไฟล์ซ้ำ** — `sw.js`, `manifest.json`, `metadata.json` ที่ root (เหลือชุดเดียวใน `public/`), `public/js/qrcode.min.js`, `public/assets/img/*` (เหลือชุดเดียวใน `assets/img/`)

**CSS** — `Management.css`, `admin.css` (ว่าง), `admin-holidays.css`, `health-wellness.css`, `home.css`, `index.css`, `leave-history.css`, `main.css`, `status-indicator.css`, `user-index.css`, `user-leave-rules.css`, `user-leave-stats.css`, `user-profile.css`, `hr-admin-portal.css`
(เนื้อหาของไฟล์เหล่านี้ถูกรวมไว้ในไฟล์ CSS ของแต่ละหน้าแล้ว หรือเป็นของโครงหน้าแบบเก่า)

**JS** — `js/debug-helper.js`, `js/pvt-logger.js`, `js/status-indicator.js`

**หน้า** — `pages/hr/admin-portal.html` (ไม่มีลิงก์ใดชี้มา และไม่อยู่ใน build; ใช้ `admin-dashboard.html` แทน)

**รูป** — `src/assets/images/*` (5 ไฟล์), `assets/img/company_logo.svg`, และใน `assets/icons/`: `*.af` (3 ไฟล์ ~15MB), `1254x1254.png`, `apple-touch-icon180.png`, `icon-192-1/-y.png`, `icon-512-1/-y.png`, `Logo_PVT_2026_B.svg`, `logo-pvt.svg`, `bell.svg`, `eye-open.svg`, `eye-closed.svg`, `printer.svg`, `shield-security.svg`, `leave-document-new.jpg/.svg`

**เอกสารเก่า** — `README.txt`, `README_FIX.txt`, `REPAIR_NOTES.md`, `bun.lock` (`README.md` เขียนใหม่)

## 5. ลดขนาดไฟล์

- `assets/img/avatar-male.jpg`, `avatar-female.jpg`: เดิมเป็น PNG 1.8MB ที่ตั้งชื่อเป็น .jpg → แปลงเป็น JPEG จริงขนาด 600px (~37KB) ภาพเดิม
- `public/favicon.ico`: เดิมเป็น PNG 2000×2000 ขนาด 3.3MB → ไฟล์ ICO จริงขนาด 16–64px (12KB)
- ขนาดรวมของโปรเจกต์ (ไม่นับ node_modules): 36MB → 8.3MB, จำนวนไฟล์ 190 → 141

## หมายเหตุ

- avatar เดิมมี 2 ชุดที่หน้าตาไม่เหมือนกัน: ชุดการ์ตูนใน `assets/img/` (production ใช้ชุดนี้) และชุดภาพเหมือนจริงใน `public/assets/img/` (`npm run dev` ใช้ชุดนี้) ได้เก็บชุดการ์ตูนไว้ให้ตรงกับ production
- `.env.local` ไม่ได้อยู่ใน ZIP ให้นำไฟล์เดิมวางไว้ที่ root ของโปรเจกต์
