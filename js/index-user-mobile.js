/* ==========================================================================
   📱 PVT WORKFORCE HUB — index-user-mobile.js
   แก้ปัญหาการใช้งานบนมือถือของหน้า index-user โดยไม่แตะไฟล์เดิม
   ⚠️ ต้องโหลดแบบ type="module" และวาง "หลัง" /js/index-user.js
      (module จะรันตามลำดับ และก่อน DOMContentLoaded ของ index-user.js)
   ========================================================================== */

const touchMQ = window.matchMedia("(hover: none), (pointer: coarse)");
const isTouchUI = () => touchMQ.matches;

/* --------------------------------------------------------------------------
   1) แชตเปิดอยู่ + คีย์บอร์ดขึ้น/ลง → เลื่อนข้อความล่าสุดให้เห็นเสมอ
   (ตัวแปร --pvt-vvh / --pvt-vv-top ตั้งโดย /js/mobile-shell.js)
   -------------------------------------------------------------------------- */
(window.visualViewport || window).addEventListener("resize", () => {
  if (!document.body.classList.contains("hr-chat-open")) return;
  const msgs = document.getElementById("hrChatMessages");
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
});

/* --------------------------------------------------------------------------
   2) แถบชิปประเภทวันลา (สิทธิ์วันลาคงเหลือ)
   - เดิมผูก touchmove แล้วตั้ง scrollLeft เอง ซ้อนกับการเลื่อน native
     → บนมือถือเลื่อนกระตุก/เร็วเกิน ตอนนี้ใช้ native อย่างเดียวบนจอสัมผัส
   - เดิมแตะชิปแล้ว re-render ทั้งการ์ด → แถบชิปเด้งกลับไปซ้ายสุด
     ตอนนี้จำตำแหน่งเลื่อนไว้
   -------------------------------------------------------------------------- */
let savedPillsScroll = 0;
const origHandleMicro = window.handleMicroQuotaChange;
const origInitPills = window.initMicroPillsDragScroll;

if (typeof origHandleMicro === "function") {
  window.handleMicroQuotaChange = function (typeId) {
    const el = document.getElementById("microPillsScrollContainer");
    savedPillsScroll = el ? el.scrollLeft : 0;
    return origHandleMicro.call(this, typeId);
  };
}

window.initMicroPillsDragScroll = function () {
  const el = document.getElementById("microPillsScrollContainer");
  if (!el) return;

  if (savedPillsScroll > 0) {
    const prev = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";
    el.scrollLeft = savedPillsScroll;
    el.style.scrollBehavior = prev;
  }

  if (isTouchUI()) return; // จอสัมผัส: ใช้การปัดนิ้วแบบ native

  if (el.dataset.dragBound === "1") return;
  el.dataset.dragBound = "1";
  if (typeof origInitPills === "function") origInitPills();
};

/* --------------------------------------------------------------------------
   3) รายการลาล่าสุด — polling ทุก 25 วิ เขียน innerHTML ใหม่
   ทำให้กำลังเลื่อนดูอยู่แล้วเด้งกลับบนสุด → จำตำแหน่งแล้วคืนค่า
   -------------------------------------------------------------------------- */
const origLoadRecent = window.loadRecentLeaves;
if (typeof origLoadRecent === "function") {
  window.loadRecentLeaves = async function (...args) {
    const box = document.querySelector("#recentList > div");
    const prevTop = box ? box.scrollTop : 0;
    const result = await origLoadRecent.apply(this, args);
    if (prevTop > 0) {
      const newBox = document.querySelector("#recentList > div");
      if (newBox) newBox.scrollTop = prevTop;
    }
    return result;
  };
}

// รายการลาเป็น role="button" แต่กด Enter/Space ไม่ได้ → เพิ่มให้
document.getElementById("recentList")?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const item = e.target.closest?.(".compact-leave-item");
  if (!item) return;
  e.preventDefault();
  item.click();
});

/* --------------------------------------------------------------------------
   4) HR Chatbot — ล็อกการเลื่อนหน้าหลัง + ไม่เด้งคีย์บอร์ดทันทีบนมือถือ
   -------------------------------------------------------------------------- */
const origToggleChat = window.toggleHrChatbot;
if (typeof origToggleChat === "function") {
  window.toggleHrChatbot = function () {
    origToggleChat();
    const modal = document.getElementById("hrChatbotModal");
    const isOpen = !!modal && modal.style.display === "flex";
    document.body.classList.toggle("hr-chat-open", isOpen);

    if (isOpen && isTouchUI()) {
      // ต้นฉบับ focus ช่องพิมพ์ทันที → คีย์บอร์ดบังคำถามแนะนำ
      document.getElementById("hrChatInput")?.blur();
      const msgs = document.getElementById("hrChatMessages");
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }
  };
}

const chatInput = document.getElementById("hrChatInput");
if (chatInput) {
  chatInput.setAttribute("enterkeyhint", "send");
  chatInput.setAttribute("autocomplete", "off");
}

/* --------------------------------------------------------------------------
   5) ป๊อปอัปรายละเอียดใบลา — ล็อกสกรอลล์, แตะฉากหลังเพื่อปิด
   -------------------------------------------------------------------------- */
const origOpenTimeline = window.openVisualTimelineModal;
if (typeof origOpenTimeline === "function") {
  window.openVisualTimelineModal = function (...args) {
    document.body.classList.add("pvt-modal-open");
    return origOpenTimeline.apply(this, args);
  };
}

const origCloseTimeline = window.closeVisualTimelineModal;
window.closeVisualTimelineModal = function () {
  document.body.classList.remove("pvt-modal-open");
  if (typeof origCloseTimeline === "function") return origCloseTimeline();
  const modal = document.getElementById("visualTimelineModal");
  if (modal) modal.style.display = "none";
};

document.getElementById("visualTimelineModal")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) window.closeVisualTimelineModal();
});

/* --------------------------------------------------------------------------
   6) ปุ่ม Esc (คีย์บอร์ดต่อแท็บเล็ต) ปิดป๊อปอัป/แชต
   -------------------------------------------------------------------------- */
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  const timeline = document.getElementById("visualTimelineModal");
  if (timeline && timeline.style.display === "flex") {
    window.closeVisualTimelineModal();
    return;
  }

  const chat = document.getElementById("hrChatbotModal");
  if (chat && chat.style.display === "flex" && typeof window.toggleHrChatbot === "function") {
    window.toggleHrChatbot();
  }
});

/* --------------------------------------------------------------------------
   7) หมุนจอ/ขยายจอข้าม breakpoint ขณะเปิดกล่องแจ้งเตือน → ปิดเพื่อไม่ค้าง
   -------------------------------------------------------------------------- */
const mobileMQ = window.matchMedia("(max-width: 768px)");
const onBreakpointChange = () => {
  if (typeof window.closeUserNotifDropdown === "function") window.closeUserNotifDropdown();
};
if (mobileMQ.addEventListener) mobileMQ.addEventListener("change", onBreakpointChange);
else if (mobileMQ.addListener) mobileMQ.addListener(onBreakpointChange);