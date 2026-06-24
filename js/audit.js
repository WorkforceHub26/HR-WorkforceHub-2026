// ฟังก์ชันกลางสำหรับให้ทุกหน้าเรียกใช้ ยิงสถิติหาพี่มิก
async function logUserAction(userName, actionType, description) {
  try {
    // ดึงชื่อไฟล์หน้าปัจจุบันอัตโนมัติ (เช่น index.html หรือ leave_form.html)
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    await supabase.from('user_activity_logs').insert([
      { 
        user_name: userName, 
        page_url: currentPage, 
        action_type: actionType, 
        description: description 
      }
    ]);
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}