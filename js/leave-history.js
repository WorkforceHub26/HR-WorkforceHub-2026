document.addEventListener("DOMContentLoaded", loadHistory);

async function loadHistory() {
  const list = document.getElementById("historyList");
  const profile = await window.pvtSupabase?.getCurrentProfile();
  const sb = window.pvtSupabase?.getClient();

  if (!sb || !profile?.employee_id) {
    list.innerHTML = `<div class="empty-state">กรุณาเข้าสู่ระบบเพื่อดูประวัติการลา</div>`;
    return;
  }

  try {
    // 🤖 ดึงข้อมูลประวัติการลาพร้อมดึงชื่อประเภทการลามาแสดงผล
    const { data, error } = await sb
      .from("leave_requests")
      .select("id, start_date, end_date, total_days, reason, status, approval_comment, leave_types(leave_name)")
      .eq("employee_id", profile.employee_id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!data?.length) {
      list.innerHTML = `<div class="empty-state">ยังไม่มีรายการลาในระบบ</div>`;
      return;
    }

    list.innerHTML = data.map((item) => {
      // 💡 ดักจับแสดงเหตุผลการปฏิเสธอนุมัติ (ถ้ามี)
      const commentHtml = (item.status === "rejected" && item.approval_comment)
        ? `<div class="reject-reason-box" style="margin-top: 10px; padding: 10px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; color: #991b1b; font-size: 13px;">
            <strong>⚠️ หมายเหตุจาก HR:</strong> ${window.pvtSupabase.escapeHtml(item.approval_comment)}
           </div>`
        : "";

      // ❌ สิทธิ์การกดยกเลิกใบลา (ทำได้เฉพาะตอนสถานะยังเป็น pending เท่านั้น)
      const cancelBtnHtml = item.status === "pending" 
        ? `<button class="inline-action" style="margin-top: 12px; border: 1px solid #ef4444; color: #ef4444; background: #ffffff; padding: 6px 12px; border-radius: 999px; cursor: pointer;" onclick="cancelLeave('${item.id}')">❌ ยกเลิกคำขอ</button>` 
        : "";

      return `
        <article class="recent-item" style="margin-bottom: 16px; padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong>${window.pvtSupabase.escapeHtml(item.leave_types?.leave_name || "การลา")}</strong>
            <span class="status ${item.status}">${window.pvtSupabase.statusLabel(item.status)}</span>
          </div>
          <p style="margin: 4px 0; color: #334155;">📅 วันที่ลา: ${window.pvtSupabase.formatThaiDate(item.start_date)} - ${window.pvtSupabase.formatThaiDate(item.end_date)}</p>
          <p style="margin: 4px 0; color: #334155;">⏱️ จำนวน: <strong>${item.total_days}</strong> วัน</p>
          <p style="margin: 4px 0; color: #64748b; font-size: 13px;">📝 เหตุผล: ${window.pvtSupabase.escapeHtml(item.reason || "-")}</p>
          
          ${commentHtml}
          ${cancelBtnHtml}
        </article>
      `;
    }).join("");
  } catch (error) {
    console.error(error);
    list.innerHTML = `<div class="empty-state">โหลดประวัติไม่สำเร็จ: ${window.pvtSupabase.escapeHtml(error.message)}</div>`;
  }
}

// ❌ ฟังก์ชันยกเลิกใบลาฝั่งพนักงาน
async function cancelLeave(id) {
  if (!confirm("คุณต้องการยกเลิกคำขอนี้ใช่หรือไม่?")) return;
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const { error } = await sb
      .from("leave_requests")
      .delete()
      .eq("id", id)
      .eq("status", "pending"); // ตรวจสอบความปลอดภัยชั้นแรกหน้าบ้าน

    if (error) throw error;
    alert("ยกเลิกคำขอลาเรียบร้อยแล้ว");
    await loadHistory(); // รีเฟรชรายการ
  } catch (error) {
    console.error(error);
    alert(`ไม่สามารถยกเลิกคำขอได้: ${error.message}`);
  }
}