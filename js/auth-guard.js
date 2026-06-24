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
      path.endsWith("index.html");

    // 3. ถ้าไม่มี User และไม่ใช่หน้าล็อกอิน -> ดีดออกทันที
    if (!currentUser && !isAuthPage) {
  Swal.fire({
    icon: 'warning',
    title: 'Access Denied',
    text: 'กรุณาเข้าสู่ระบบก่อนใช้งาน',
    confirmButtonColor: '#3085d6',
    confirmButtonText: 'ตกลง'
  }).then(() => {
    window.location.href = "/login.html";
  });
}

    // 4. ถ้ามีสิทธิ์ถูกต้อง ค่อยเปิดให้มองเห็นหน้าเว็บแบบเนียนๆ
    document.documentElement.style.visibility = 'visible';
  });
})();