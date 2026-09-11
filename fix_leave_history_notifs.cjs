const fs = require('fs');

let js = fs.readFileSync('js/leave-history.js', 'utf8');

const notifCode = `
// ==========================================
// 🔔 NOTIFICATION SYSTEM (DUPLICATED FOR LEAVE-HISTORY)
// ==========================================
let localReadNotifIds = [];
try {
  const stored = localStorage.getItem("userReadNotifIds");
  if (stored) localReadNotifIds = JSON.parse(stored);
} catch(e){}

function getUserReadNotifIds() { return localReadNotifIds; }
function addUserReadNotifId(id) {
  if (!localReadNotifIds.includes(id)) {
    localReadNotifIds.push(id);
    localStorage.setItem("userReadNotifIds", JSON.stringify(localReadNotifIds));
  }
}

window.toggleUserNotifDropdown = function(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById("userNotifDropdown");
  if (!dropdown) return;
  const isShowing = dropdown.style.display === "flex";
  dropdown.style.display = isShowing ? "none" : "flex";
  if (!isShowing) fetchUserNotifications();
};

document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("userNotifDropdown");
  const btn = document.getElementById("notificationBtn");
  if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.style.display = "none";
  }
});

async function fetchUserNotifications() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb || !window.currentProfile) return;
  const myId = window.currentProfile.id || window.currentProfile.employee_id;
  
  try {
    let notifList = [];
    const { data: dbNotifs } = await sb.from("notifications").select("*").eq("employee_id", myId).order("created_at", { ascending: false }).limit(20);
    
    if (dbNotifs) {
      dbNotifs.forEach(n => {
        notifList.push({
          id: n.id,
          title: n.title,
          message: n.message,
          created_at: n.created_at,
          is_read: n.is_read || getUserReadNotifIds().includes(n.id),
          link: '/pages/user/leave-history.html'
        });
      });
    }
    
    const unreadCount = notifList.filter(n => !n.is_read).length;
    const badge = document.getElementById("notifBadge");
    const countPill = document.getElementById("userNotifCount");
    
    if (badge) {
      badge.innerText = unreadCount;
      badge.style.display = unreadCount > 0 ? "flex" : "none";
    }
    if (countPill) {
      countPill.innerText = unreadCount > 0 ? \`\${unreadCount} รายการใหม่\` : "ไม่มีรายการใหม่";
      countPill.style.background = unreadCount > 0 ? "#e0f2fe" : "#f1f5f9";
      countPill.style.color = unreadCount > 0 ? "#0369a1" : "#64748b";
    }
    
    const listEl = document.getElementById("userNotifList");
    if (!listEl) return;
    
    if (notifList.length === 0) {
      listEl.innerHTML = \`<div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">ไม่มีการแจ้งเตือนใหม่</div>\`;
      return;
    }
    
    listEl.innerHTML = notifList.map(n => {
      const isRead = n.is_read;
      const bg = isRead ? "transparent" : "#f0f9ff";
      const dot = isRead ? "" : \`<div style="width: 8px; height: 8px; background: #0ea5e9; border-radius: 50%; margin-top: 6px; flex-shrink: 0;"></div>\`;
      let icon = "📢";
      if (n.title.includes("อนุมัติแล้ว") || n.title.includes("✅")) icon = "✅";
      else if (n.title.includes("ไม่อนุมัติ") || n.title.includes("❌")) icon = "❌";
      else if (n.title.includes("คำขอใหม่") || n.title.includes("📥")) icon = "📥";
      
      return \`
        <div onclick="handleUserNotifClick('\${n.id}', '\${n.link}')" style="display: flex; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; background: \${bg}; cursor: pointer; transition: background 0.2s;">
          \${dot}
          <div style="font-size: 20px;">\${icon}</div>
          <div style="flex-grow: 1;">
            <div style="font-weight: \${isRead ? '500' : '700'}; color: #1e293b; font-size: 13px; margin-bottom: 4px;">\${n.title.replace(/^[❌✅📌🟢🎉📢⚠️📥\\s]+/, '')}</div>
            <div style="color: #64748b; font-size: 12px; line-height: 1.4;">\${n.message}</div>
          </div>
        </div>
      \`;
    }).join('');
  } catch (err) {
    console.error("Error fetching notifs:", err);
  }
}

window.handleUserNotifClick = async function(id, link) {
  addUserReadNotifId(id);
  const sb = window.pvtSupabase?.getClient();
  if (sb) {
    await sb.from("notifications").update({ is_read: true }).eq("id", id);
  }
  if (link) window.location.href = link;
};

window.markAllUserNotificationsAsRead = async function(event) {
  if (event) event.stopPropagation();
  const sb = window.pvtSupabase?.getClient();
  const myId = window.currentProfile?.id || window.currentProfile?.employee_id;
  if (sb && myId) {
    await sb.from("notifications").update({ is_read: true }).eq("employee_id", myId);
  }
  document.querySelectorAll("#userNotifList [onclick]").forEach(el => {
    const match = el.getAttribute("onclick")?.match(/handleUserNotifClick\\('([^']+)'/);
    if (match) addUserReadNotifId(match[1]);
  });
  fetchUserNotifications();
  if (typeof Swal !== 'undefined') Swal.fire({ icon: "success", title: "อ่านทั้งหมดแล้ว", timer: 1000, showConfirmButton: false });
};

// Auto load on init
setTimeout(() => { fetchUserNotifications(); }, 2000);
`;

if (!js.includes('toggleUserNotifDropdown')) {
  fs.writeFileSync('js/leave-history.js', js + '\n' + notifCode);
  console.log('Appended notification code to leave-history.js');
}
