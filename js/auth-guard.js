/**
 * 🔒 PVT HR - Security Auth Guard (Enterprise Clean Version)
 */
(function () {
  // 1. ดักซ่อนเนื้อหาหน้าเว็บทันที ป้องกันพนักงานเห็นหน้าจอก่อนล็อกอิน (Flicker Effect)
  document.documentElement.style.visibility = 'hidden';

  document.addEventListener("DOMContentLoaded", () => {
    const currentUser = JSON.parse(sessionStorage.getItem("currentUser"));
    const path = window.location.pathname;

    // 2. เช็คว่าเป็นหน้าสำหรับให้ล็อกอินหรือไม่ (Whitelist Pages)
    const isAuthPage = 
      path.includes("login") || 
      path === "/" || 
      path.endsWith("home.html");

    // 3. ถ้าไม่มี User และไม่ใช่หน้าล็อกอิน -> ดีดออกและทำพื้นหลังเบลอ
    if (!currentUser && !isAuthPage) {
      
      // ปลดการซ่อนหน้าเว็บ เพื่อให้เห็นพื้นหลัง
      document.documentElement.style.visibility = 'visible';
      
      // ค้นหาโครงสร้างหลักของเพจ (.app-shell) แล้วสั่งเบลอ
      const appShell = document.querySelector('.app-shell');
      if (appShell) {
        appShell.style.filter = 'blur(12px)'; // ปรับตัวเลขความเบลอได้ (ยิ่งมากยิ่งเบลอ)
        appShell.style.pointerEvents = 'none'; // ป้องกันการคลิกเนื้อหาด้านหลัง
      }

      Swal.fire({
        icon: 'warning',
        title: 'Access Denied',
        text: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'ตกลง',
        allowOutsideClick: false, // บังคับให้คลิกปุ่มตกลงเท่านั้น
        backdrop: `rgba(0,0,0,0.5)` // เพิ่มความมืดทับความเบลอให้ป๊อปอัปเด่นขึ้น
      }).then(() => {
        window.location.href = "/index.html";
      });
      
    } else {
      // 4. ถ้ามีสิทธิ์ถูกต้อง ค่อยเปิดให้มองเห็นหน้าเว็บแบบปกติและคมชัด
      document.documentElement.style.visibility = 'visible';
    }
  });
})();