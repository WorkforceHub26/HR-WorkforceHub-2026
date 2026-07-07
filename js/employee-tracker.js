/**
 * ⚙️ Workforce Hub - Employee Tracker Engine (กล่องค้นหาแบบฉลาดกรองแผนกได้ + ดีไซน์ UI สวยงาม)
 */

// คลังแมปปิ้งแผนกอย่างเป็นทางการของ PVT
const dbDepartments = {
  "08af7229-305e-4d62-9b7d-0a39273c5d9e": "ขนส่ง",
  "0df28aff-ba37-43f2-bd60-85e8d1e87ff9": "บัญชี",
  "19f71555-df2a-4003-bcde-665c263b36b0": "การขาย-ตลาด",
  "2194b9e4-4fee-43b3-b3aa-033c4b5edfe0": "สแลน",
  "22902ff4-a2ee-4c87-a6ed-8ee59af16ca3": "คลังสินค้าและซ่อมบำรุง",
  "24620f12-cff3-4af8-b16a-d562eb0207e1": "คอมปาว/บด",
  "28396a94-4d81-4fc3-a55e-04fa3a7de123": "บัญชี/การเงิน",
  "76a162a3-20d1-4391-a7f9-18a8eeee1380": "การขาย-ตลาด(เก่า)", 
  "8079e9b3-cfa8-4f01-8070-e2ffedcedacd": "จัดซื้อ",
  "81e93ee8-8469-4374-81bc-c81cdcc03835": "ซ่อมบำรุง",
  "8bda9c8e-7be8-44c8-90f6-f250552d44cb": "คลังสินค้า",
  "8d26d418-61e9-4e15-85a3-71de061dcf22": "บุคคล-ธุรการ",
  "94410e04-4222-4569-8d2d-53772aeba17a": "ผลิต",
  "f3486725-868f-4ea6-b602-e9138620d79a": "วางแผนผลิต",
  "accab0d5-9446-45e6-8e14-8bf44d591c89": "จัดส่ง"
};

// คลังแมปปิ้งตำแหน่งงานของ PVT
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

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 [Tracker Engine] ทำงานพร้อมกล่องค้นหาอัจฉริยะกึ่งสากล...");
  
  let db = null;
  if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
    db = window.supabaseClient;
  } else if (window.supabase && typeof window.supabase.from === 'function') {
    db = window.supabase;
  }

  if (!db) {
    console.error("🔴 ไม่พบไลบรารีฐานข้อมูล Supabase");
    return;
  }

  await initializeSearchTracker(db);
});

async function initializeSearchTracker(db) {
  const inputSearch = document.getElementById("inputEmployeeSearch");
  const suggestionsBox = document.getElementById("searchSuggestions");
  if (!inputSearch || !suggestionsBox) return;

  let employeeCache = [];
  try {
    const { data, error } = await db.from("employees").select("id, full_name, employee_code, department_id, position_id, status");
    if (!error && data) {
      employeeCache = data;
    }
  } catch (err) {
    console.error("โหลดแคชรายชื่อพนักงานล้มเหลว:", err);
  }

  // ดักจับการพิมพ์ตัวอักษรค้นหา
  inputSearch.addEventListener("input", (e) => {
    const keyword = e.target.value.trim().toLowerCase();
    if (!keyword) {
      suggestionsBox.style.display = "none";
      return;
    }

    // 🟢 ระบบกรองแบบ Multi-Match จับคู่ทั้ง (ชื่อ, รหัสพนักงาน, ชื่อแผนกไทย)
    const filtered = employeeCache.filter(emp => {
      const matchName = emp.full_name && emp.full_name.toLowerCase().includes(keyword);
      const matchCode = emp.employee_code && emp.employee_code.toLowerCase().includes(keyword);
      
      // ค้นหาจากชื่อแผนกภาษาไทย
      const deptNameStr = dbDepartments[emp.department_id] || "";
      const matchDept = deptNameStr.toLowerCase().includes(keyword);

      return matchName || matchCode || matchDept;
    });

    if (filtered.length === 0) {
      suggestionsBox.innerHTML = `<div style="padding: 16px; color: #94a3b8; font-size: 14px; text-align: center;">❌ ไม่พบข้อมูล (ลองพิมพ์ชื่อ, รหัส หรือแผนก)</div>`;
    } else {
      let html = "";
      // แสดงผลยอดฮิต 10 อันดับแรก
      filtered.slice(0, 10).forEach(emp => { 
        const currentDeptName = dbDepartments[emp.department_id] || "ทั่วไป";
        
        // 🟢 ตกแต่งรายการโผล่แนะนำแบบใหม่: มีการเน้นข้อความ แบ่งสัดส่วน มีป้ายบอกแผนกชัดเจน สวยพรีเมียม
        html += `
          <div class="suggestion-item" data-id="${emp.id}" style="padding: 12px 18px; cursor: pointer; border-bottom: 1px solid #f8fafc; font-size: 14px; color: #1e293b; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s ease;">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-weight: 500; color: #0f172a;">${emp.full_name}</span>
              <span style="font-size: 12px; color: #64748b;">รหัส: ${emp.employee_code || '-'}</span>
            </div>
            <span style="font-weight: 500; color: #0284c7; background: #f0f9ff; border: 1px solid #bae6fd; padding: 3px 8px; border-radius: 6px; font-size: 12px;">
              📍 แผนก${currentDeptName}
            </span>
          </div>
        `;
      });
      suggestionsBox.innerHTML = html;
    }
    suggestionsBox.style.display = "block";

    // จัดผูกคำสั่งเมื่อคลิกเลือกรายชื่อพนักงาน
    document.querySelectorAll(".suggestion-item").forEach(item => {
      item.addEventListener("click", async (ev) => {
        const empId = item.getAttribute("data-id");
        const selectedName = item.querySelector("span").innerText;
        inputSearch.value = selectedName;
        suggestionsBox.style.display = "none";
        await fetchAndRenderIndividualData(db, empId);
      });
    });
  });

  // ซ่อนลิสต์หล่นเมื่อคลิกนอกอาณาเขตกล่องค้นหา
  document.addEventListener("click", (e) => {
    if (e.target !== inputSearch && e.target !== suggestionsBox) {
      suggestionsBox.style.display = "none";
    }
  });

  // ใส่เอฟเฟกต์แอนิเมชันตอนเอาเมาส์ชี้เลือกพนักงาน
  suggestionsBox.addEventListener("mouseover", (e) => {
    const item = e.target.closest(".suggestion-item");
    if (item) {
      item.style.backgroundColor = "#f1f5f9";
      item.style.paddingLeft = "22px"; // สไลด์ขยับนิดๆ ดูมีชีวิตชีวา
    }
  });
  suggestionsBox.addEventListener("mouseout", (e) => {
    const item = e.target.closest(".suggestion-item");
    if (item) {
      item.style.backgroundColor = "transparent";
      item.style.paddingLeft = "18px";
    }
  });

  // รองรับการคลิกส่งต่อข้อมูลข้ามหน้ามาจากหน้า Directory
  const targetId = sessionStorage.getItem("target_employee_id");
  if (targetId) {
    sessionStorage.removeItem("target_employee_id");
    await fetchAndRenderIndividualData(db, targetId);
  }
}

async function fetchAndRenderIndividualData(db, supabaseUuid) {
  try {
    const { data: emp, error: empErr } = await db
      .from("employees")
      .select("*")
      .eq("id", supabaseUuid)
      .single();

    if (empErr) throw empErr;

    const finalDept = dbDepartments[emp.department_id] || "ไม่ระบุแผนก";
    const finalPosition = dbPositions[emp.position_id] || "พนักงานประจำเครื่อง";

    // แสดงข้อความบนการ์ดด้านบน
    if (document.getElementById("txtProfileName")) document.getElementById("txtProfileName").innerText = emp.full_name || 'ไม่ระบุชื่อ';
    if (document.getElementById("txtProfileCode")) document.getElementById("txtProfileCode").innerText = emp.employee_code || '-'; 
    if (document.getElementById("txtProfileDept")) document.getElementById("txtProfileDept").innerText = finalDept;        
    if (document.getElementById("txtProfilePosition")) document.getElementById("txtProfilePosition").innerText = finalPosition; 
    
    if (document.getElementById("txtProfileStatus")) {
      document.getElementById("txtProfileStatus").innerHTML = emp.status === 'active'
        ? `<span style="color:#16a34a; font-weight:600; background:#dcfce7; padding:4px 10px; border-radius:99px; font-size:13px;">● ปฏิบัติงานปกติ</span>`
        : `<span style="color:#dc2626; font-weight:600; background:#fee2e2; padding:4px 10px; border-radius:99px; font-size:13px;">● พ้นสภาพพนักงาน</span>`;
    }

    // อัปเดตตัวเลขคงเหลือลงการ์ดโควตาแนวนอน
    if (document.getElementById("sickLeaveBalance")) document.getElementById("sickLeaveBalance").innerHTML = `${emp.sick_leave_balance ?? 30} <small>วัน</small>`;
    if (document.getElementById("personalLeaveBalance")) document.getElementById("personalLeaveBalance").innerHTML = `${emp.personal_leave_balance ?? 6} <small>วัน</small>`;
    if (document.getElementById("vacationBalance")) document.getElementById("vacationBalance").innerHTML = `${emp.vacation_balance ?? 6} <small>วัน</small>`;

    await loadEmployeeLeaveHistoryTable(db, emp.employee_code || supabaseUuid);

  } catch (err) {
    console.error("❌ ดึงโปรไฟล์ล้มเหลว:", err.message);
  }
}

async function loadEmployeeLeaveHistoryTable(db, identifierCode) {
  const tableBody = document.getElementById("trackerTableBody");
  if (!tableBody) return;

  tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b; padding: 20px;">กำลังค้นหาประวัติคำขอลา...</td></tr>`;

  try {
    const { data: leaves, error } = await db
      .from("leave_requests")
      .select("*")
      .eq("employee_code", identifierCode)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (document.getElementById("totalUsedLeaves")) {
      const approvedCount = leaves ? leaves.filter(l => l.status === 'APPROVED' || l.status === 'อนุมัติ').length : 0;
      document.getElementById("totalUsedLeaves").innerHTML = `${approvedCount} <small>ใบงาน</small>`;
    }

    if (!leaves || leaves.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:35px; color:#64748b;">ไม่มีประวัติการยื่นขอลาในระบบประจำปีนี้ 🍃</td></tr>`;
      return;
    }

    let htmlRows = "";
    leaves.forEach(item => {
      const reqDate = item.created_at ? new Date(item.created_at).toLocaleDateString('th-TH') : '-';
      const leaveType = item.leave_type || 'ลาป่วย';
      
      const startDate = item.start_date ? new Date(item.start_date).toLocaleDateString('th-TH') : '';
      const endDate = item.end_date ? new Date(item.end_date).toLocaleDateString('th-TH') : '';
      const dateRange = startDate && endDate ? `${startDate} - ${endDate}` : `${startDate || '-'}`;

      const duration = item.total_days ? `${item.total_days} วัน` : '-';
      const reason = item.reason || '-';
      
      let statusStyle = `background:#f1f5f9; color:#475569;`;
      if (item.status === 'APPROVED' || item.status === 'อนุมัติ') statusStyle = `background:#dcfce7; color:#15803d;`;
      if (item.status === 'REJECTED' || item.status === 'ไม่นุมัติ') statusStyle = `background:#fee2e2; color:#b91c1c;`;
      if (item.status === 'PENDING' || item.status === 'รออนุมัติ') statusStyle = `background:#fef9c3; color:#a16207;`;

      htmlRows += `
        <tr>
          <td><strong>${reqDate}</strong></td>
          <td><span style="background:#f0fdf4; border:1px solid #bbf7d0; padding:3px 6px; border-radius:4px;">${leaveType}</span></td>
          <td style="font-size: 13px; color: #475569;">${dateRange}</td>
          <td style="font-weight:600;">${duration}</td>
          <td style="max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${reason}">${reason}</td>
          <td><span style="${statusStyle} padding:4px 8px; border-radius:99px; font-size:12px; font-weight:600;">${item.status || 'PENDING'}</span></td>
        </tr>
      `;
    });

    tableBody.innerHTML = htmlRows;

  } catch (err) {
    console.error("❌ โหลดตารางล้มเหลว:", err.message);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444;">โหลดตารางประวัติล้มเหลว: ${err.message}</td></tr>`;
  }
}