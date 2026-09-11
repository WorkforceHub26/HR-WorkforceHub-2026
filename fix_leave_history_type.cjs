const fs = require('fs');

let js = fs.readFileSync('js/leave-history.js', 'utf8');

// Inject selectTypeFilter logic and currentTypeFilter variable
const injectVars = `let currentTypeFilter = "all";
window.selectTypeFilter = function(type) {
  currentTypeFilter = type;
  const label = document.getElementById("selectedTypeLabel");
  if (label) label.textContent = type === "all" ? "ทุกประเภท" : type;
  
  document.querySelectorAll("#typeDropdownMenu .year-dropdown-item").forEach(item => {
    item.classList.remove("active");
    if (type === "all" && item.innerText.trim() === "ทุกประเภท") item.classList.add("active");
    else if (item.innerText.trim() === type) item.classList.add("active");
  });
  
  document.getElementById("typeDropdownMenu").classList.remove("show");
  filterLeaveHistory(currentFilter, null);
};

window.toggleTypeDropdown = function(e) {
  e.stopPropagation();
  const menu = document.getElementById("typeDropdownMenu");
  if (menu) menu.classList.toggle("show");
};

document.addEventListener("click", (e) => {
  const typeMenu = document.getElementById("typeDropdownMenu");
  if (typeMenu && !e.target.closest(".year-dropdown-container:last-child")) {
     typeMenu.classList.remove("show");
  }
});
`;

js = js.replace('let selectedYear = "2025";', 'let selectedYear = new Date().getFullYear().toString();\n' + injectVars);

// Update filterLeaveHistory to apply the type filter
const filterStatusCode = `  // 2. FILTER BY STATUS CHIPS
  if (currentFilter === 'pending') {
    rows = rows.filter(item => item.status === 'pending');
  } else if (currentFilter === 'approved') {
    rows = rows.filter(item => item.status === 'approved');
  } else if (currentFilter === 'cancel_requested') {
    rows = rows.filter(item => item.status === 'cancel_requested');
  }`;

const filterTypeCode = `  // 2. FILTER BY STATUS CHIPS
  if (currentFilter === 'pending') {
    rows = rows.filter(item => item.status === 'pending');
  } else if (currentFilter === 'approved') {
    rows = rows.filter(item => item.status === 'approved');
  } else if (currentFilter === 'cancel_requested') {
    rows = rows.filter(item => item.status === 'cancel_requested');
  }
  
  // 3. FILTER BY LEAVE TYPE
  if (currentTypeFilter !== 'all') {
    rows = rows.filter(item => {
      let rawLeaveTypeName = "ไม่ระบุ";
      if (Array.isArray(item.leave_types) && item.leave_types.length > 0) {
        rawLeaveTypeName = item.leave_types[0].leave_name;
      } else if (item.leave_types?.leave_name) {
        rawLeaveTypeName = item.leave_types.leave_name;
      }
      return rawLeaveTypeName === currentTypeFilter;
    });
  }`;

js = js.replace(filterStatusCode, filterTypeCode);

fs.writeFileSync('js/leave-history.js', js);
console.log("Updated leave-history.js with type filter.");
