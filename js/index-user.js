
document.addEventListener("DOMContentLoaded", initUserHome);

function initUserHome() {
  loadUserInfo();
  loadRecentLeaves();
}

function loadUserInfo() {
  const user = {
    name: "นางสาวสุนันทา อธิบูลาล",
    department: "ฝ่ายผลิต / แผนกจัดกระ"
  };

  document.getElementById("userName").textContent = user.name;
  document.getElementById("userDepartment").textContent = user.department;
}

function loadRecentLeaves() {
  const recentLeaves = [
    {
      type: "ลาป่วย",
      date: "18/12/2568",
      days: "1 วัน",
      status: "pending",
      statusText: "รออนุมัติ"
    }
  ];

  const recentList = document.getElementById("recentList");

  if (!recentLeaves.length) {
    recentList.innerHTML = `<div class="empty-state">ยังไม่มีรายการลา</div>`;
    return;
  }

  recentList.innerHTML = recentLeaves.map(item => `
    <div class="recent-item">
      <strong>${item.type}</strong>
      <p>${item.date} · ${item.days}</p>
      <span class="status ${item.status}">${item.statusText}</span>
    </div>
  `).join("");
}

function goToLeaveForm() {
  window.location.href = "leave.html";
}

function goToLeaveHistory() {
  window.location.href = "leave-history.html";
}

function goToProfile() {
  window.location.href = "profile-user.html";
}

function goToContactHR() {
  alert("กรุณาติดต่อฝ่ายบุคคล");
}

function logoutUser() {
  const confirmLogout = confirm("ต้องการออกจากระบบใช่ไหม?");
  if (!confirmLogout) return;

  window.location.href = "login.html";
}