const leaveForm = document.getElementById("leaveForm");

function goBack() {
  history.back();
}

leaveForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const data = {
    employee_name: document.getElementById("employeeName").value.trim(),
    employee_code: document.getElementById("employeeCode").value.trim(),
    department: document.getElementById("department").value.trim(),
    position: document.getElementById("position").value.trim(),
    leave_type: document.getElementById("leaveType").value,
    start_date: document.getElementById("startDate").value,
    end_date: document.getElementById("endDate").value,
    leave_days: document.getElementById("leaveDays").value,
    leave_period: document.getElementById("leavePeriod").value,
    reason: document.getElementById("reason").value.trim(),
    approver_name: document.getElementById("approverName").value.trim(),
    status: "pending"
  };

  console.log("ข้อมูลคำขอลา:", data);

  alert("ส่งคำขอลาเรียบร้อยแล้ว");
  leaveForm.reset();
});