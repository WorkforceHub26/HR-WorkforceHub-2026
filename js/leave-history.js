/**
 * leave-history.js — (ฉบับสมบูรณ์ ล้างไอดีจำลอง + ระบบ Log ติดตามบั๊ก 100%)
 */

console.log("📢 [SYSTEM] เริ่มต้นโหลดหน้าประวัติการลา (Leave History)...");

// 🛠️ 1. ระบบดักจับและบังคับอัปเดต CSS (ป้องกันเบราว์เซอร์จำค่าเก่า)
(function forceLoadNewCSS() {
  const links = document.getElementsByTagName('link');
  let found = false;
  for (let i = 0; i < links.length; i++) {
    if (links[i].rel === 'stylesheet' && links[i].href.includes('leave-history.css')) {
      const oldHref = links[i].href.split('?')[0]; 
      const newHref = `${oldHref}?v=${new Date().getTime()}`; 
      links[i].href = newHref;
      console.log(`✅ [DEBUG-CSS] บังคับโหลด CSS ใหม่ที่: ${newHref}`);
      found = true;
    }
  }
  if (!found) console.warn("⚠️ [DEBUG-CSS] ไม่พบแท็กลิงก์ leave-history.css ใน HTML (กรุณาเช็ก Path ไฟล์ใน HTML อีกครั้ง)");
})();

document.addEventListener("DOMContentLoaded", async () => {
  console.log("📌 [LIFECYCLE] โครงสร้างหน้าเว็บโหลดเสร็จ กำลังเรียกฟังก์ชัน loadLeaveHistory()");
  await loadLeaveHistory();
});

// ─── ฟังก์ชันหลัก: ดึงประวัติการลา ───
async function loadLeaveHistory() {
  const listContainer = document.getElementById("historyList");
  
  if (listContainer) listContainer.innerHTML = `<div class="empty-state">⏳ กำลังโหลดประวัติการลา...</div>`;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    if (listContainer) listContainer.innerHTML = `<div class="empty-state" style="color:red;">❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้ (เช็ก supabase-config.js)</div>`;
    return;
  }

  let employeeId = "";

  try {
    console.log("🔄 [AUTH] กำลังตรวจสอบสิทธิ์ผู้ใช้งาน...");
    // 1. ดึงข้อมูลจาก Supabase Auth 
    const profile = await window.pvtSupabase?.getCurrentProfile();
    employeeId = profile?.employee_id || profile?.id;
    console.log("👤 [AUTH] ข้อมูลจาก Supabase Profile:", profile);

    // 2. ถ้าไม่ได้ผล ให้ดึงจาก Session Storage (คนที่เพิ่งล็อกอินเข้ามา)
    if (!employeeId) {
      const cachedUser = JSON.parse(sessionStorage.getItem("currentUser") || "null");
      console.log("📦 [AUTH] ข้อมูลจาก Session Storage:", cachedUser);
      if (cachedUser) {
        employeeId = cachedUser.employee_id || cachedUser.id;
      }
    }
  } catch (e) {
    console.error("❌ [AUTH ERROR] เช็กสิทธิ์ล้มเหลว:", e);
  }

  // ถ้าสุดท้ายหาไอดีไม่เจอเลย เตะกลับหรือแจ้งเตือน
  if (!employeeId) {
    console.warn("🚫 [AUTH] ไม่พบไอดีพนักงาน กรุณาล็อกอินใหม่");
    if (listContainer) listContainer.innerHTML = `<div class="empty-state">กรุณาเข้าสู่ระบบใหม่อีกครั้งเพื่อดูประวัติการลา</div>`;
    return;
  }

  console.log(`⏳ [FETCHING] กำลังดึงประวัติการลาของไอดีจริง: ${employeeId}`);

  try {
    // 🔍 วิ่งไปดึงประวัติในตาราง leave_requests
    const { data, error } = await sb
      .from("leave_requests")
      .select(`
        id, start_date, end_date, total_days, reason, status, approval_comment, created_at,
        leave_types ( leave_name )
      `)
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ [DB ERROR] คำสั่ง SQL ผิดพลาด:", error);
      throw error;
    }

    console.log(`📋 [DATA] ดึงประวัติสำเร็จ เจอข้อมูลทั้งหมด: ${data ? data.length : 0} รายการ`, data);

    if (!data || data.length === 0) {
      if (listContainer) listContainer.innerHTML = `<div class="empty-state">📭 ยังไม่มีประวัติการยื่นใบลาในระบบ</div>`;
      return;
    }

    // 🎨 เริ่มวาด UI จากข้อมูลที่ดึงมาได้
    if (listContainer) listContainer.innerHTML = ""; // ล้างคำว่ากำลังโหลดทิ้ง

    data.forEach(item => {
      const writeDate = new Date(item.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
      const leaveName = item.leave_types?.leave_name || "ไม่ระบุประเภท";
      const escapedLeaveName = window.pvtSupabase?.escapeHtml ? window.pvtSupabase.escapeHtml(leaveName) : leaveName;
      const escapedReason = window.pvtSupabase?.escapeHtml ? window.pvtSupabase.escapeHtml(item.reason || "-") : (item.reason || "-");
      const statusLabel = window.pvtSupabase?.statusLabel ? window.pvtSupabase.statusLabel(item.status) : item.status;

      let commentHtml = "";
      if (item.status === "rejected" && item.approval_comment) {
        commentHtml = `<div style="margin-top: 8px; padding: 8px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; color: #991b1b; font-size: 13px;">
                        <strong>⚠️ หมายเหตุ:</strong> ${item.approval_comment}
                       </div>`;
      }

      let cancelBtnHtml = "";
      if (item.status === "pending") {
        cancelBtnHtml = `<button style="margin-top: 10px; background: #fff1f2; border: 1px solid #fda4af; color: #e11d48; padding: 6px 12px; border-radius: 20px; font-size: 12px; cursor: pointer; font-weight: 600;" onclick="cancelLeave('${item.id}')">❌ ยกเลิกคำขอลา</button>`;
      }

      let statusBadge = "";
      if (item.status === "pending") statusBadge = `<span style="background-color: #fef08a; color: #854d0e; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid #fde047;">⏳ รอตรวจ</span>`;
      else if (item.status === "approved") statusBadge = `<span style="background-color: #d1e7dd; color: #0f5132; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid #badbcc;">✅ อนุมัติแล้ว</span>`;
      else if (item.status === "rejected") statusBadge = `<span style="background-color: #f8d7da; color: #842029; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid #f5c2c7;">❌ ปฏิเสธ</span>`;
      else statusBadge = `<span style="background-color: #e2e8f0; color: #475569; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;">${statusLabel}</span>`;

      // ปั้นการ์ดประวัติ 1 ชิ้น
      const article = document.createElement("article");
      article.style = "margin-bottom: 16px; padding: 18px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.02);";
      article.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <strong style="font-size: 16px; color: #0f172a;">${escapedLeaveName}</strong>
          ${statusBadge}
        </div>
        <div style="font-size: 14px; color: #475569; display: flex; flex-direction: column; gap: 6px;">
          <div><span style="color: #94a3b8; font-size: 12px;">วันที่ยื่น:</span> ${writeDate}</div>
          <div><span style="color: #94a3b8; font-size: 12px;">วันที่ลา:</span> <strong>${item.start_date}</strong> ถึง <strong>${item.end_date}</strong></div>
          <div><span style="color: #94a3b8; font-size: 12px;">จำนวน:</span> <strong style="color: #0ea5e9;">${item.total_days}</strong> วัน</div>
          <div><span style="color: #94a3b8; font-size: 12px;">เหตุผล:</span> ${escapedReason}</div>
        </div>
        ${commentHtml}
        <div style="text-align: right;">${cancelBtnHtml}</div>
      `;
      listContainer.appendChild(article);
    });

    console.log("✅ [SUCCESS] วาด UI ประวัติเสร็จสมบูรณ์!");

  } catch (err) {
    console.error("❌ [CRITICAL] โหลดประวัติไม่สำเร็จ:", err);
    if (listContainer) listContainer.innerHTML = `<div class="empty-state" style="color:red;">❌ เกิดข้อผิดพลาด: ${err.message}</div>`;
  }
}

// ─── ฟังก์ชันยกเลิกใบลา (สำหรับรายการสถานะ pending) ───
async function cancelLeave(id) {
  if (!confirm("คุณต้องการ 'ยกเลิก' คำขอลาใบนี้ใช่หรือไม่?")) return;
  
  const sb = window.pvtSupabase?.getClient();
  if (!sb) { alert("ไม่สามารถเชื่อมต่อฐานข้อมูลได้"); return; }

  try {
    const { error } = await sb.from("leave_requests").delete().eq("id", id).eq("status", "pending"); 
    if (error) throw error;
    
    alert("✅ ยกเลิกคำขอลาสำเร็จเรียบร้อยแล้ว!");
    await loadLeaveHistory(); // รีเฟรชหน้าจอใหม่
  } catch (error) {
    console.error("❌ ลบใบลาไม่สำเร็จ:", error);
    alert(`เกิดข้อผิดพลาด: ${error.message}`);
  }
}