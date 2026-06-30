// 1. ตั้งค่าการเชื่อมต่อ Supabase (ดึงข้อมูลชุดเดียวกับโปรเจกต์เดิมของคุณมาใส่)
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// จำลองข้อมูลของหัวหน้าที่ Login เข้ามา (ในระบบจริงจุดนี้ต้องดึงมาจากคุกกี้หรือ LocalStorage)
let currentApprover = {
    id: "11111111-1111-1111-1111-111111111111", // UUID ของหัวหน้า
    full_name: "นายเสกสรร ทองลพ",
    position_name: "ผู้จัดการฝ่าย",
    department_id: "DEP_FILM_PIPE_UUID", // เปลี่ยนเป็น UUID แผนกคอมปาว หรือท่อ/เป่าฟิล์ม ที่คุณเซ็ตในระบบ
    department_name: "ท่อ/เป่าฟิล์ม"
};

// รันเมื่อเปิดหน้าเว็บ
document.addEventListener("DOMContentLoaded", () => {
    initDashboard();
    setupEventListeners();
});

// ฟังก์ชันเริ่มต้นหน้าจอ
async function initDashboard() {
    // พ่นชื่อหัวหน้าขึ้นบนหน้าจอ
    document.getElementById("approverName").innerText = currentApprover.full_name;
    document.getElementById("approverRole").innerText = `ตำแหน่ง: ${currentApprover.position_name} | ฝ่าย: ${currentApprover.department_name}`;
    
    // โหลดรายการใบลาของลูกน้อง
    await fetchSubordinateLeaveRequests();
}

// ฟังก์ชันดึงใบลาเฉพาะของลูกน้องที่อยู่ในฝ่ายเดียวกัน
async function fetchSubordinateLeaveRequests() {
    try {
        // ค้นหาใบลาทั้งหมด และใช้ !inner ในการกรองเฉพาะลูกน้องที่อยู่ฝ่ายเดียวกับหัวหน้า
        const { data: requests, error } = await supabase
            .from('leave_requests')
            .select(`
                id,
                start_date,
                end_date,
                total_days,
                reason,
                status,
                employees:employee_id!inner(
                    employee_code,
                    full_name,
                    department_id
                ),
                leave_types:leave_type_id(
                    leave_name
                )
            `)
            .eq('employees.department_id', currentApprover.department_id) // กรองตรงนี้! หัวหน้าจะเห็นเฉพาะพนักงานในฝ่ายตัวเองเท่านั้น
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderTable(requests);
        updateSummaryCards(requests);

    } catch (error) {
        console.error("Error fetching data:", error.message);
        document.getElementById("leaveTableBody").innerHTML = `<tr><td colspan="8" class="text-center" style="color:red">เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>`;
    }
}

// พ่นข้อมูลลงในตาราง HTML
function renderTable(requests) {
    const tbody = document.getElementById("leaveTableBody");
    if (!requests || requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">🎉 ไม่มีคำขอลาพนักงานในฝ่ายของคุณในขณะนี้</td></tr>`;
        return;
    }

    tbody.innerHTML = requests.map(req => {
        const isPending = req.status === 'pending';
        // สร้างปุ่มจัดการ ปิดการใช้งานหากอนุมัติ/ไม่อนุมัติไปแล้ว
        // 💡 ให้หาจุดเรนเดอร์ตารางใบลาใน hr.js แล้วปรับโครงสร้างกลุ่มปุ่ม (Action Buttons) ให้เป็นแบบนี้ครับ
            const actionButtons = `
            <div class="action-icon-group" style="display: flex; gap: 8px; justify-content: center;">
                <button class="icon-btn info" onclick="openLeaveSlipModal('${item.id}')" title="ดูรายละเอียดใบลา">
                <span class="material-symbols-outlined">visibility</span>
                </button>
                
                <button class="icon-btn approve" onclick="approveAndDeductBalance('${item.id}', '${item.employee_id}', '${item.leave_type_id}', ${item.total_days})" title="อนุมัติ & ตัดยอดวันลา">
                <span class="material-symbols-outlined">check</span>
                </button>

                <button class="icon-btn reject" onclick="rejectLeaveByHR('${item.id}')" title="ปฏิเสธคำขอ">
                <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            `;

        // แปลงสถานะเป็น Badge ภาษาไทย/อังกฤษเพื่อความสวยงาม
        let statusBadge = `<span class="badge pending">รออนุมัติ</span>`;
        if(req.status === 'approved') statusBadge = `<span class="badge approved">อนุมัติแล้ว</span>`;
        if(req.status === 'rejected') statusBadge = `<span class="badge rejected">ไม่อนุมัติ</span>`;

        return `
            <tr>
                <td>${req.employees.employee_code}</td>
                <td><b>${req.employees.full_name}</b></td>
                <td>${req.leave_types?.leave_name || 'ไม่ระบุประเภท'}</td>
                <td>${req.start_date} ถึง ${req.end_date}</td>
                <td>${req.total_days} วัน</td>
                <td>${req.reason || '-'}</td>
                <td>${statusBadge}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join('');
}

// อัปเดตตัวเลขจำนวนบนการ์ดด้านบน
function updateSummaryCards(requests) {
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;

    document.getElementById("countPending").innerText = pending;
    document.getElementById("countApproved").innerText = approved;
    document.getElementById("countRejected").innerText = rejected;
}

// เปิดกล่อง Modal เพื่อกรอกเหตุผลคอมเมนต์
function openActionModal(id, empName, status) {
    document.getElementById("targetLeaveId").value = id;
    document.getElementById("targetStatus").value = status;
    document.getElementById("modalEmployeeName").innerText = `พนักงาน: ${empName}`;
    document.getElementById("modalTitle").innerText = status === 'approved' ? 'ยืนยันการอนุมัติใบลา' : 'ปฏิเสธคำขอใบลา';
    document.getElementById("approvalComment").value = status === 'approved' ? 'อนุมัติตามขั้นตอนฝ่ายบุคคล' : '';
    document.getElementById("actionModal").style.display = "flex";
}

// ตั้งค่าเหตุการณ์กดปุ่มต่างๆ
function setupEventListeners() {
    // ปิดโมดอลเมื่อกดกดยกเลิก
    document.getElementById("btnCancelAction").addEventListener("click", () => {
        document.getElementById("actionModal").style.display = "none";
    });

    // กดยืนยันการ บันทึก อนุมัติ/ปฏิเสธ ลงฐานข้อมูล
    document.getElementById("btnConfirmAction").addEventListener("click", async () => {
        const id = document.getElementById("targetLeaveId").value;
        const status = document.getElementById("targetStatus").value;
        const comment = document.getElementById("approvalComment").value;

        try {
            const { error } = await supabase
                .from('leave_requests')
                .update({
                    status: status,
                    approved_by: currentApprover.id,
                    approved_at: new Date().toISOString(),
                    approval_comment: comment
                })
                .eq('id', id);

            if (error) throw error;

            alert("บันทึกการพิจารณาใบลาเรียบร้อยแล้ว");
            document.getElementById("actionModal").style.display = "none";
            await fetchSubordinateLeaveRequests(); // โหลดตารางใหม่ทันที

        } catch (error) {
            alert("เกิดข้อผิดพลาด: " + error.message);
        }
    });
}