const fs = require('fs');

let html = fs.readFileSync('pages/user/leave-history.html', 'utf8');

// Replace the Download button with a dropdown filter for Leave Type
const downloadBtnRegex = /<!-- Download Action Button -->[\s\S]*?<\/button>/;
const typeFilterHtml = `
            <!-- Leave Type Filter -->
            <div class="year-dropdown-container">
              <button type="button" class="year-dropdown-trigger" onclick="toggleTypeDropdown(event)">
                <span class="material-symbols-outlined" style="font-size: 18px;">filter_list</span>
                <span id="selectedTypeLabel">ทุกประเภท</span>
                <span class="material-symbols-outlined" style="font-size: 16px;">expand_more</span>
              </button>
              <div class="year-dropdown-menu" id="typeDropdownMenu">
                <div class="year-dropdown-item active" onclick="selectTypeFilter('all')">
                  <span>ทุกประเภท</span>
                  <img src="/assets/icons/check-circle.svg" alt="เลือก" class="check-icon" style="width: 16px; height: 16px; object-fit: contain;" />
                </div>
                <div class="year-dropdown-item" onclick="selectTypeFilter('ลาป่วย')">
                  <span>ลาป่วย</span>
                  <img src="/assets/icons/check-circle.svg" alt="เลือก" class="check-icon" style="width: 16px; height: 16px; object-fit: contain;" />
                </div>
                <div class="year-dropdown-item" onclick="selectTypeFilter('ลากิจ')">
                  <span>ลากิจ</span>
                  <img src="/assets/icons/check-circle.svg" alt="เลือก" class="check-icon" style="width: 16px; height: 16px; object-fit: contain;" />
                </div>
                <div class="year-dropdown-item" onclick="selectTypeFilter('ลาพักผ่อน')">
                  <span>ลาพักผ่อน</span>
                  <img src="/assets/icons/check-circle.svg" alt="เลือก" class="check-icon" style="width: 16px; height: 16px; object-fit: contain;" />
                </div>
              </div>
            </div>`;

html = html.replace(downloadBtnRegex, typeFilterHtml);

// Fix Notification bell on this page
// Replace notification icon in this page. We need to add the same dropdown HTML from index-user.html to leave-history.html, OR link it.
// The user says "ปุ่มแจ้งเตือนหน้านั้นใช้ไม่ได้" (Notification button on that page doesn't work).
// Looking at index-user.html, the notification dropdown is explicitly present.
// In leave-history.html:
