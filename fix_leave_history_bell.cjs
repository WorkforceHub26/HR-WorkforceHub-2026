const fs = require('fs');

let html = fs.readFileSync('pages/user/leave-history.html', 'utf8');

// Replace the old bell button with the dropdown wrapper
const oldBell = `<button class="notif-bell-btn" onclick="toggleUserNotifications()" title="การแจ้งเตือน" style="display: inline-flex; align-items: center; justify-content: center;">
            <img src="/assets/icons/bell-new.svg" alt="การแจ้งเตือน" style="width: 22px; height: 22px; object-fit: contain;" />
            <span class="notif-bell-badge"></span>
          </button>`;

const newBell = `<!--  NOTIFICATION COMPONENT (REAL DATA DROPDOWN) -->
          <div class="notif-wrapper" style="position: relative; display: inline-block;">
            <button id="notificationBtn" class="notif-btn" style="display: inline-flex; align-items: center; justify-content: center; background:transparent; border:none; cursor:pointer;" onclick="toggleUserNotifDropdown(event)" title="การแจ้งเตือนใบลา">
              <img src="/assets/icons/bell-new.svg" alt="การแจ้งเตือน" style="width: 22px; height: 22px; object-fit: contain;" />
              <span id="notifBadge" class="notif-badge" style="display: none;">0</span>
            </button>
            <div class="notif-dropdown" id="userNotifDropdown" style="position: absolute; top: calc(100% + 12px); right: 0; width: 360px; background: #ffffff; border: 1px solid #cbd5e1; max-width: calc(100vw - 32px); border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); z-index: 1000; display: none; flex-direction: column; overflow: hidden;">
              <div class="notif-header" style="padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #cbd5e1; background: #f8fafc;">
                <div class="notif-title" style="display: flex; align-items: center; gap: 8px;">
                  <strong style="font-size: 14px; color: #1e293b;">การแจ้งเตือน</strong>
                  <span class="notif-count-pill" id="userNotifCount" style="font-size: 11px; font-weight: 600; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 12px;">0 รายการใหม่</span>
                </div>
                <button type="button" class="btn-mark-read" onclick="markAllUserNotificationsAsRead(event)" style="background: transparent; border: none; font-size: 11px; color: #0284c7; font-weight: 600; cursor: pointer; padding: 4px 8px; border-radius: 4px;">อ่านทั้งหมด</button>
              </div>
              <div class="notif-body" id="userNotifList" style="max-height: 320px; overflow-y: auto;">
                <div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">
                  ⌛ กำลังโหลดแจ้งเตือน...
                </div>
              </div>
            </div>
          </div>`;

html = html.replace(oldBell, newBell);
fs.writeFileSync('pages/user/leave-history.html', html);
console.log("Replaced bell HTML.");
