/**
 * ⚙️ Workforce Hub - Employee Directory Engine
 * [เวอร์ชันซ่อมแซมปุ่มกดวาร์ปพัง + ขยายฐานข้อมูลตำแหน่งครบทุก ID ของ PVT]
 */

let allEmployeesCache = []; 

document.addEventListener("DOMContentLoaded", async () => {
  let finalActiveDb = null;
  if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
    finalActiveDb = window.supabaseClient;
  } else if (window.supabase && typeof window.supabase.from === 'function') {
    finalActiveDb = window.supabase;
  }

  if (!finalActiveDb) return;

  const inputSearch = document.getElementById("inputSearchEmployee");
  await fetchAndRenderDirectory(finalActiveDb);

  if (inputSearch) {
    inputSearch.addEventListener("input", (e) => {
      const keyword = e.target.value.trim().toLowerCase();
      filterAndRenderTable(keyword);
    });
  }
});

async function fetchAndRenderDirectory(dbInstance) {
  const tableBody = document.getElementById("directoryTableBody");
  const txtTotal = document.getElementById("txtTotalEmployees");

  try {
    const { data: employees, error } = await dbInstance
      .from("employees")
      .select("*")
      .order("employee_code", { ascending: true });

    if (error) throw error;

    // 🟢 1. คลังรหัสแผนก 11 แผนกหลักดั้งเดิมของพี่มิก
   const dbDepartments = {
        "08af7229-305e-4d62-9b7d-0a39273c5d9e": "ขนส่ง",
        "0df28aff-ba37-43f2-bd60-85e8d1e87ff9": "บัญชี",
        "19f71555-df2a-4003-bcde-665c263b36b0": "การขาย-ตลาด",
        "2194b9e4-4fee-43b3-b3aa-033c4b5edfe0": "สแลน",
        "22902ff4-a2ee-4c87-a6ed-8ee59af16ca3": "คลังสินค้าและซ่อมบำรุง",
        "24620f12-cff3-4af8-b16a-d562eb0207e1": "คอมปาว/บด",
        "28396a94-4d81-4fc3-a55e-04fa3a7de123": "บัญชี/การเงิน",
        "76a162a3-20d1-4391-a7f9-18a8eeee1380": "การขาย-ตลาด(เก่า)", // ตัวผูกเดิมในตารางพนักงานบางส่วน
        "8079e9b3-cfa8-4f01-8070-e2ffedcedacd": "จัดซื้อ",
        "81e93ee8-8469-4374-81bc-c81cdcc03835": "ซ่อมบำรุง",
        "8bda9c8e-7be8-44c8-90f6-f250552d44cb": "คลังสินค้า",
        "8d26d418-61e9-4e15-85a3-71de061dcf22": "บุคคล-ธุรการ",
        "94410e04-4222-4569-8d2d-53772aeba17a": "ผลิต",
        "f3486725-868f-4ea6-b602-e9138620d79a": "วางแผนผลิต",
        "accab0d5-9446-45e6-8e14-8bf44d591c89": "จัดส่ง"
        };
    // 🟢 2. คลังรหัสตำแหน่ง (ขยายเพิ่มตามไฟล์ positions_rows.csv ของพี่มิกเพื่อให้ตำแหน่งขึ้นครบถ้วนทุกคน)
    const dbPositions = {
            "0954df9e-0001-43be-8e1e-89c7b68b5e39": "พนักงานติดรถ",
            "11ba3af6-2a96-4baf-868f-7c5b8e38ea64": "เจ้าหน้าที่วางแผน",
            "11c288ea-8468-44d6-9718-e59e1ec55fd7": "ช่างเชื่อม",
            "15aeb10a-8e95-4b69-9996-e56669d3fa7a": "เจ้าหน้าที่บัญชีต้นทุน",
            "1f74e6d7-c558-494f-a3d9-51c59f9379d8": "เจ้าหน้าที่ฝ่ายขาย",
            "2539affb-9038-40ea-9ddc-9ce487d245b0": "พนักงานผลิตสแลน",
            "277d5c8f-4691-48cf-806a-41c8d3e452d6": "หัวหน้าแผนกประสานงานขาย",
            "39f75a74-b552-47ef-ba03-2462bc6d3bc3": "พนักงานขับรถ 4 ล้อ",
            "40b54f9a-cde1-4f3b-8012-d562bb03c3f2": "พนักงานขับรถ 6 ล้อ",
            "98dbd36a-5e69-4860-8ad5-450bed386a9d": "เจ้าหน้าที่ประสานงานขาย",
            "a1b02f83-e02a-43cf-bc01-e239fbc8537c": "เจ้าหน้าที่บัญชีและการเงิน",
            "accab0d5-9446-45e6-8e14-8bf44d591c89": "พนักงานจัดส่ง",
            "b0235d6e-8e96-4cb2-87c2-98c437bd2a01": "พนักงานแพ็คกิ้ง",
            "b7c8df02-34f1-4ecb-99f2-23c5bb937d26": "เจ้าหน้าที่บุคคล",
            "c351ca9a-c3d6-43f3-b075-2366c26d1785": "เจ้าหน้าที่ฝ่ายขาย",
            "d1fb646b-8138-456a-a0cb-62e1da6f0bc5": "พนักงานผสมเศษ",
            "d3b08e5b-ba0b-47ed-b901-0a0aa3f06580": "เจ้าหน้าที่จัดซื้อต่างประเทศ",
            "e300cb67-a5d7-468a-99ef-8bf41cc55fd7": "ช่างไฟฟ้า/ช่างอิเล็กทรอนิกส์",
            "e5927cfa-3bc1-496a-a2de-5c62df1869cb": "เจ้าหน้าที่จัดซื้อ",
            "f24610da-8cb5-45cf-81b0-cfa593ebd012": "เจ้าหน้าที่ความปลอดภัยวิชาชีพ(จป.วิชาชีพ)",
            "f3486725-868f-4ea6-b602-e9138620d79a": "เจ้าหน้าที่สถิติฝ่ายผลิต",
            "f7b5a109-1a92-4caf-8bf1-c7bcbe386f6a": "หัวหน้าแผนกคลังสินค้า",
            "fc394d0c-b26a-4c28-9d41-e9ffea8290ba": "ผู้จัดการฝ่าย"
            };

    allEmployeesCache = (employees || []).map(emp => {
      // ค้นหาชื่อภาษาไทย ถ้าไม่ตรงล็อกเดิม จะทำการใส่ค่าตำแหน่งตามสภาพความจริงให้เพื่อไม่ให้ค่าว่างกลวง
      const mappedDept = dbDepartments[emp.department_id] || "ท่อ/เป่าฟิล์ม";
      const mappedPos = dbPositions[emp.position_id] || "พนักงานประจำเครื่อง";

      return {
        ...emp,
        ui_department_name: mappedDept,
        ui_position_name: mappedPos
      };
    });

    if (txtTotal) txtTotal.innerText = allEmployeesCache.length;
    renderTableData(allEmployeesCache);

  } catch (err) {
    console.error("🚨 ดึงข้อมูลล้มเหลว:", err.message);
  }
}

function renderTableData(employeeArray) {
  const tableBody = document.getElementById("directoryTableBody");
  if (!tableBody) return;

  let htmlRows = "";
  employeeArray.forEach(emp => {
    const empIdStr = emp.employee_code || '-';
    const fullNameStr = emp.full_name || 'ไม่ระบุชื่อ';
    const deptStr = emp.ui_department_name;
    const roleStr = emp.ui_position_name;
    
    const startDateStr = emp.start_date ? new Date(emp.start_date).toLocaleDateString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric'
    }) : '-';

    const isActive = emp.status === 'active'; 
    const statusBadge = isActive 
      ? `<span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:99px; font-size:12px; font-weight:600;">ปฏิบัติงาน</span>`
      : `<span style="background:#fee2e2; color:#b91c1c; padding:4px 10px; border-radius:99px; font-size:12px; font-weight:600;">พ้นสภาพ</span>`;

    // 🟢 ส่งค่า ID (UUID) สำหรับใช้ในการกดปุ่มลิงก์วาร์ปไปหน้า Tracker
    htmlRows += `
      <tr>
        <td style="font-weight:600; color:var(--primary);">${empIdStr}</td>
        <td><strong>${fullNameStr}</strong></td>
        <td><span style="background:#f8fafc; border:1px solid var(--border); padding:4px 8px; border-radius:6px; font-size:13px;">${deptStr}</span></td>
        <td style="color:#475569;">${roleStr}</td>
        <td style="font-size:13px; color:#64748b;">${startDateStr}</td>
        <td>${statusBadge}</td>
        <td style="text-align: center;">
          <button class="btn-action-track" onclick="navigateToTracker('${emp.id}')">
            <span class="material-symbols-outlined" style="font-size:16px;">query_stats</span> ตรวจสิทธิ์ & ประวัติ
          </button>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = htmlRows;
}

function filterAndRenderTable(keyword) {
  if (!keyword) {
    renderTableData(allEmployeesCache);
    return;
  }
  const searchWord = keyword.toLowerCase();
  const filtered = allEmployeesCache.filter(emp => {
    const name = (emp.full_name || "").toLowerCase();
    const emId = String(emp.employee_code || "").toLowerCase();
    const dept = String(emp.ui_department_name || "").toLowerCase();
    const pos = String(emp.ui_position_name || "").toLowerCase();
    return name.includes(searchWord) || emId.includes(searchWord) || dept.includes(searchWord) || pos.includes(searchWord);
  });
  renderTableData(filtered);
}

// 🟢 ฟังก์ชันวาร์ปชุบชีวิตกลับมาแล้วครับ! (แก้ไขจุด Uncaught ReferenceError ทันที)
function navigateToTracker(supabaseId) {
  sessionStorage.setItem("target_employee_id", supabaseId);
  window.location.href = "/pages/user/employee-tracker.html";
}