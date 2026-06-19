// --------------------------------------------------
// Mobile First
// ใช้ Username + Password
// รองรับ QR Login ในอนาคต
// มี Remember Me
// แสดงโลโก้บริษัท
// UI สไตล์เดียวกับ EA Factory / Workforce Hub
// --------------------------------------------------


const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username =
    document.getElementById("username").value.trim();

  const password =
    document.getElementById("password").value;

  if (!username || !password) {
    alert("กรุณากรอกข้อมูลให้ครบ");
    return;
  }

  console.log({
    username,
    password
  });

  // Supabase Login

  window.location.href =
    "index-user.html";
});

function togglePassword() {
  const input =
    document.getElementById("password");

  input.type =
    input.type === "password"
      ? "text"
      : "password";
}

function loginByQr() {
  alert("เปิดระบบสแกน QR");
}