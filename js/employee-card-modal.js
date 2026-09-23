/**
 * =========================================================================
 * 🪪 PVT WORKFORCE HUB - UNIVERSAL EMPLOYEE CARD & BATCH PRINT MANAGER
 * =========================================================================
 * Provides full digital employee card viewing, search, and batch printing
 * across all HR and administrative pages in the system.
 */

(function () {
  let cachedEmployeeList = null;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getBaseUrl() {
    const currentOrigin = window.location.origin;
    if (!currentOrigin || currentOrigin.includes("localhost") || currentOrigin.includes("127.0.0.1") || currentOrigin.includes("file://")) {
      return "https://dev-workforcehub-2026.pages.dev";
    }
    return currentOrigin;
  }

  // Preload standalone QRCode generator for instant offline QR generation (<2ms)
  if (typeof window !== 'undefined' && !window.QRCode) {
    const s = document.createElement('script');
    s.src = '/js/qrcode.min.js';
    s.async = true;
    document.head.appendChild(s);
  }

  // Fast offline QR Code generator (fallback to online API if needed)
  async function generateEmployeeQrDataUrl(empCode) {
    if (!empCode) return "";
    const cleanCode = String(empCode).trim();
    const baseUrl = getBaseUrl();
    const targetUrl = `${baseUrl}/index.html?auto_login=${encodeURIComponent(cleanCode)}`;

    try {
      if (window.QRCode && typeof window.QRCode.toString === 'function') {
        const svg = await window.QRCode.toString(targetUrl, { type: 'svg', margin: 1, width: 220 });
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      }
    } catch (e) {
      console.warn("Offline QR generator fallback:", e);
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(targetUrl)}`;
  }

  function generateEmployeeQrUrl(empCode) {
    if (!empCode) return "";
    const cleanCode = String(empCode).trim();
    const baseUrl = getBaseUrl();
    try {
      const targetUrl = new URL("/index.html", baseUrl);
      targetUrl.searchParams.set("auto_login", cleanCode);
      const encodedTarget = encodeURIComponent(targetUrl.toString());
      return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodedTarget}`;
    } catch (err) {
      console.error("❌ Error generating QR URL:", err);
      const fallbackTarget = `${baseUrl}/index.html?auto_login=${encodeURIComponent(cleanCode)}`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(fallbackTarget)}`;
    }
  }

  window.generateEmployeeQrDataUrl = generateEmployeeQrDataUrl;

  async function getClient() {
    if (window.sb) return window.sb;
    if (window.pvtSupabase?.getClient) return window.pvtSupabase.getClient();
    if (typeof getSupabaseClient === 'function') return getSupabaseClient();
    return null;
  }

  function isUserAdmin() {
    try {
      const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
      const sessionUser = savedSession ? JSON.parse(savedSession) : {};
      const userStatus = window.getUserRoleCategory ? window.getUserRoleCategory(sessionUser) : {};
      const empObj = sessionUser?.employees || sessionUser || {};
      const myProfile = window.currentUserProfile || window.currentProfile || sessionUser || {};
      const rawRoleVal = String(sessionUser?.role || empObj.role || myProfile?.role || userStatus?.role || '').toLowerCase().trim();

      return userStatus.category === 'hr_exec' ||
             ['admin', 'superadmin', 'hr', 'hr_manager', 'executive'].includes(rawRoleVal) ||
             Boolean(sessionUser?.is_admin) ||
             Boolean(sessionUser?.is_hr) ||
             Boolean(myProfile?.is_admin) ||
             Boolean(myProfile?.is_hr) ||
             sessionUser?.employee_code === 'HR-001' ||
             empObj.employee_code === 'HR-001' ||
             myProfile?.employee_code === 'HR-001';
    } catch (e) {
      return false;
    }
  }

  // 🟢 1. Open Employee Card Selection & Batch Print Modal
  window.openEmployeeCardManagerPopup = async function (forceRefresh = false) {
    if (typeof Swal === "undefined") {
      alert("⚠️ กำลังโหลดไลบรารี กรุณารอสักครู่");
      return;
    }

    const isAdmin = isUserAdmin();
    if (!isAdmin) {
      // พนักงานทั่วไปที่ไม่ใช่แอดมิน ให้เปิดเฉพาะบัตรพนักงานตนเองเท่านั้น
      return window.openMyEmployeeCardModal();
    }

    if (!cachedEmployeeList || forceRefresh) {
      Swal.fire({
        title: 'กำลังโหลดบัญชีรายชื่อพนักงาน...',
        html: '<div style="padding:20px; font-size:14px; color:#0f766e;">⌛ กำลังเชื่อมต่อและดึงข้อมูลพนักงานทุกคน...</div>',
        showConfirmButton: false,
        allowOutsideClick: false
      });

      const client = await getClient();
      if (!client) {
        // Fallback to local storage or dummy
        const fallbackUsers = JSON.parse(localStorage.getItem('allEmployees') || '[]');
        if (fallbackUsers.length > 0) {
          cachedEmployeeList = fallbackUsers;
        } else {
          Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง', 'error');
          return;
        }
      } else {
        try {
          const { data: employees, error } = await client
            .from('employees')
            .select(`
              id,
              employee_code,
              full_name,
              image_url,
              line_id,
              status,
              department_id,
              departments!department_id ( department_name ),
              positions ( position_name )
            `)
            .order('employee_code', { ascending: true });

          if (error) throw error;
          cachedEmployeeList = (employees || []).filter(emp => {
            const st = String(emp.status || '').toLowerCase().trim();
            return st !== 'resigned' && st !== 'inactive' && st !== 'ลาออก';
          });
        } catch (err) {
          console.error("Error loading employees for cards:", err);
          Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถดึงรายชื่อพนักงานได้: ' + (err.message || ''), 'error');
          return;
        }
      }
    }

    // Filter by user's department to only see their own department if not Admin
    const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
    let sessionUser = {};
    try {
      sessionUser = savedSession ? JSON.parse(savedSession) : {};
    } catch (e) {}
    const myProfile = window.currentUserProfile || sessionUser || {};
    const myDeptId = myProfile?.department_id || myProfile?.employees?.department_id;

    let displayEmployees = cachedEmployeeList || [];
    if (!isAdmin && myDeptId) {
      displayEmployees = displayEmployees.filter(emp => String(emp.department_id) === String(myDeptId));
    }

    let rowsHtml = "";
    if (displayEmployees.length === 0) {
      rowsHtml = `<div style="text-align:center; padding:32px; color:#64748b; font-size:14px;">ไม่พบข้อมูลพนักงานในระบบ</div>`;
    } else {
      displayEmployees.forEach(emp => {
        const empRole = emp.positions?.position_name || emp.position_name || 'พนักงาน';
        const empDept = emp.departments?.department_name || emp.department_name || 'ไม่ระบุแผนก';
        const empName = emp.full_name || 'ไม่ระบุชื่อ';
        const empCode = emp.employee_code || '';
        const empTitle = emp.title || '';
        const empGender = emp.gender || '';
        const defaultAvatar = (typeof window.getDefaultAvatarUrl === 'function') 
          ? window.getDefaultAvatarUrl(empTitle, empGender, empName)
          : ((empTitle.includes('สาว') || empTitle.includes('นาง') || empTitle.includes('น.ส.') || empGender === 'female' || empName.includes('นาง') || empName.includes('น.ส.')) ? '/assets/img/avatar-female.jpg?v=2' : '/assets/img/avatar-male.jpg?v=2');

        const fullAvatarUrl = (window.pvtSupabase && typeof window.pvtSupabase.getAvatarUrl === 'function')
          ? window.pvtSupabase.getAvatarUrl(emp.image_url, empTitle, empGender, empName)
          : (typeof window.getAvatarUrl === 'function' ? window.getAvatarUrl(emp.image_url, empTitle, empGender, empName) : (emp.image_url ? (emp.image_url.startsWith('http') ? emp.image_url : `${(window.SUPABASE_URL || 'https://pgogmhqjdchakcytsomx.supabase.co')}/storage/v1/object/public/employee-images/${emp.image_url.replace(/^\//, '')}`) : defaultAvatar));

        rowsHtml += `
          <div class="emp-card-selection-item" style="display: flex; align-items: center; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; gap: 12px; transition: background 0.15s ease;">
            <div style="flex-shrink: 0; display: flex; align-items: center;">
              <input type="checkbox" class="emp-card-checkbox" 
                     data-code="${escapeHtml(empCode)}" 
                     data-name="${escapeHtml(empName)}" 
                     data-role="${escapeHtml(empRole)}" 
                     data-dept="${escapeHtml(empDept)}"
                     style="cursor: pointer; width: 19px; height: 19px; accent-color: #0f766e;" />
            </div>
            <div style="flex-shrink: 0;">
              <img src="${fullAvatarUrl}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0;" onerror="this.onerror=null; this.src='${defaultAvatar}';">
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 700; color: #0f172a; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(empName)}</div>
              <div style="color: #64748b; font-size: 12px; margin-top: 2px; display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 600; color: #0f766e; background: #ccfbf1; padding: 1px 6px; border-radius: 4px;">#${escapeHtml(empCode)}</span>
                <span>•</span>
                <span>${escapeHtml(empRole)}</span>
                <span>•</span>
                <span>${escapeHtml(empDept)}</span>
              </div>
            </div>
            <div style="flex-shrink: 0;">
              <button type="button" class="btn-view-card" 
                      data-code="${escapeHtml(empCode)}" 
                      data-name="${escapeHtml(empName)}" 
                      data-role="${escapeHtml(empRole)}" 
                      data-dept="${escapeHtml(empDept)}"
                      data-avatar="${escapeHtml(fullAvatarUrl)}"
                style="background: #0284c7; color: white; border: none; padding: 7px 12px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <span class="material-symbols-outlined" style="font-size:18px;">badge</span>
                <span>ดูบัตร</span>
              </button>
            </div>
          </div>
        `;
      });
    }

    Swal.fire({
      title: '🪪 ระบบจัดการและพิมพ์บัตรพนักงานดิจิทัล',
      width: '640px',
      html: `
        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px; text-align: left;">
          <div style="display: flex; gap: 8px;">
            <input type="text" id="cardSearchInput" placeholder="🔍 ค้นหารหัสพนักงาน, ชื่อ-สกุล, ตำแหน่ง, หรือแผนก..." 
              style="flex: 1; padding: 11px 14px; font-size: 14px; border: 1px solid #cbd5e1; border-radius: 10px; outline: none; font-family: inherit;" />
            <button type="button" onclick="window.openEmployeeCardManagerPopup(true)" title="รีเฟรชข้อมูลล่าสุด"
              style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 0 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #475569;">
              <span class="material-symbols-outlined" style="font-size: 20px;">sync</span>
            </button>
          </div>
          
          <div style="display: flex; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px 14px; border-radius: 10px; border: 1px solid #e2e8f0;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; font-weight: 600; color: #334155;">
              <input type="checkbox" id="selectAllCardsCheckbox" onchange="window.toggleSelectAllCards(this)" style="cursor: pointer; width: 18px; height: 18px; accent-color: #0f766e;" />
              <span>เลือกทั้งหมด (<span id="totalVisibleCardCount">${displayEmployees.length}</span> คน)</span>
            </label>
            <button id="btnPrintSelectedCards" onclick="window.handlePrintSelectedCardsFromPopup()" disabled
              style="background: #0f766e; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: not-allowed; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; opacity: 0.5; transition: all 0.2s;">
              <span class="material-symbols-outlined" style="font-size:18px;">print</span> 
              พิมพ์ชุด (<span id="selectedCardCount">0</span>)
            </button>
          </div>
        </div>
        
        <div id="employeeCardTableBody" style="max-height: 420px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; text-align: left;">
          ${rowsHtml}
        </div>
        <div id="noMatchCardMessage" style="display: none; padding: 28px; text-align: center; color: #64748b; font-size: 14px;">
          ❌ ไม่พบข้อมูลพนักงานที่ตรงกับคำค้นหา
        </div>
      `,
      confirmButtonText: 'ปิดหน้าต่าง',
      confirmButtonColor: '#64748b',
      didOpen: () => {
        const searchInput = document.getElementById("cardSearchInput");
        const container = document.getElementById("employeeCardTableBody");
        const noMatchMsg = document.getElementById("noMatchCardMessage");
        const totalVisibleEl = document.getElementById("totalVisibleCardCount");

        if (container) {
          container.addEventListener('change', (e) => {
            if (e.target.classList.contains('emp-card-checkbox')) {
              window.updateCardSelectionCount();
            }
          });

          container.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-view-card');
            if (btn) {
              const { code, name, role, dept, avatar } = btn.dataset;
              window.showIndividualIdCard(code, name, role, dept, avatar);
            }
          });
        }

        if (searchInput && container) {
          searchInput.focus();
          searchInput.addEventListener("input", (e) => {
            const keyword = e.target.value.trim().toLowerCase();
            const items = container.querySelectorAll(".emp-card-selection-item");
            let visibleCount = 0;

            items.forEach(item => {
              const text = item.innerText.toLowerCase();
              if (text.includes(keyword)) {
                item.style.display = "flex";
                visibleCount++;
              } else {
                item.style.display = "none";
              }
            });

            if (totalVisibleEl) totalVisibleEl.textContent = visibleCount;
            if (noMatchMsg) {
              noMatchMsg.style.display = (visibleCount === 0 && items.length > 0) ? "block" : "none";
            }
            window.updateCardSelectionCount();
          });
        }
      }
    });
  };

  // 🟢 2. Checkbox selection helpers
  window.toggleSelectAllCards = function (masterCb) {
    const checkboxes = document.querySelectorAll('.emp-card-checkbox');
    checkboxes.forEach(cb => {
      const row = cb.closest('.emp-card-selection-item');
      if (row && row.style.display !== 'none') {
        cb.checked = masterCb.checked;
      }
    });
    window.updateCardSelectionCount();
  };

  window.updateCardSelectionCount = function () {
    const checkedBoxes = document.querySelectorAll('.emp-card-checkbox:checked');
    const countEl = document.getElementById('selectedCardCount');
    const btnPrint = document.getElementById('btnPrintSelectedCards');

    const count = checkedBoxes.length;
    if (countEl) countEl.textContent = count;

    if (btnPrint) {
      if (count > 0) {
        btnPrint.disabled = false;
        btnPrint.style.opacity = '1';
        btnPrint.style.cursor = 'pointer';
      } else {
        btnPrint.disabled = true;
        btnPrint.style.opacity = '0.5';
        btnPrint.style.cursor = 'not-allowed';
      }
    }
  };

  window.handlePrintSelectedCardsFromPopup = function () {
    const checkedBoxes = document.querySelectorAll('.emp-card-checkbox:checked');
    if (checkedBoxes.length === 0) return;

    const selectedEmployees = Array.from(checkedBoxes).map(cb => ({
      empCode: cb.dataset.code,
      empName: cb.dataset.name,
      empRole: cb.dataset.role,
      empDept: cb.dataset.dept
    }));

    window.printMultipleCards(selectedEmployees);
  };

  // 🟢 3. Show Single Digital ID Card Modal
  window.showIndividualIdCard = async function (empCode, empName, empRole, empDept, avatarUrl) {
    const qrUrl = generateEmployeeQrUrl(empCode);
    const defaultAvatar = (typeof window.getDefaultAvatarUrl === 'function')
      ? window.getDefaultAvatarUrl('', '', empName)
      : ((empName.includes('นาง') || empName.includes('น.ส.')) ? '/assets/img/avatar-female.jpg' : '/assets/img/avatar-male.jpg');
    const imgUrl = (avatarUrl && avatarUrl !== '/assets/img/default-avatar.jpg') ? avatarUrl : defaultAvatar;
    
    Swal.fire({
      title: '💳 บัตรประจำตัวพนักงานดิจิทัล',
      width: '440px',
      html: `
        <div id="pvt-id-card" style="background: linear-gradient(135deg, #0a2558 0%, #1e40af 55%, #0284c7 100%); width: 320px; margin: 12px auto; border-radius: 20px; padding: 22px; color: white; box-shadow: 0 15px 30px rgba(30,58,138,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.15);">
          <div style="font-weight: 700; font-size: 13px; letter-spacing: 1.5px; color: #bae6fd; margin-bottom: 14px;">PVT WORKFORCE HUB</div>
          <div style="width: 84px; height: 84px; margin: 0 auto 12px auto; border-radius: 50%; border: 3px solid #38bdf8; overflow: hidden; background: #0f2b6e;">
            <img src="${imgUrl}" onerror="this.onerror=null; this.src='${defaultAvatar}';" style="width: 100%; height: 100%; object-fit: cover;" alt="Employee Photo" />
          </div>
          <div style="font-size: 18px; font-weight: 700; margin-bottom: 4px; color: #ffffff;">${escapeHtml(empName)}</div>
          <div style="font-size: 13px; color: #7dd3fc; font-weight: 600; margin-bottom: 2px;">ตำแหน่ง: ${escapeHtml(empRole)}</div>
          <div style="font-size: 12px; color: #e2e8f0; font-weight: 500; margin-bottom: 14px;">แผนก: ${escapeHtml(empDept)}</div>
          <div style="background: white; padding: 10px; border-radius: 14px; display: inline-block; margin-bottom: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
            <img src="${qrUrl}" alt="Employee QR Code" style="width: 125px; height: 125px; display: block;" 
                 onerror="this.onerror=null; this.src='https://via.placeholder.com/125?text=QR+Error';" />
          </div>
          <div>
            <span style="font-size: 11px; color: #bae6fd; display: block; text-transform: uppercase; margin-bottom: 2px;">Employee ID</span>
            <span style="font-size: 16px; font-weight: 800; background: rgba(255,255,255,0.2); padding: 4px 18px; border-radius: 30px; display: inline-block; letter-spacing: 1px; font-family: monospace;">
              ${escapeHtml(empCode)}
            </span>
          </div>
        </div>
        <div style="display: flex; gap: 8px; justify-content: center; margin-top: 12px;">
          <button type="button" id="btnDownloadSingleCardPng"
                  style="flex: 1; background: #0284c7; color: white; border: none; padding: 10px 14px; border-radius: 10px; font-size: 13.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>📥 ดาวน์โหลด PNG</span>
          </button>
          <button type="button" id="btnPrintSingleCardAction"
                  style="flex: 1; background: #0f766e; color: white; border: none; padding: 10px 14px; border-radius: 10px; font-size: 13.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>🖨️ สั่งพิมพ์บัตร</span>
          </button>
        </div>
      `,
      showCancelButton: true,
      cancelButtonText: '🔙 ย้อนกลับ',
      showConfirmButton: false,
      cancelButtonColor: '#64748b',
      didOpen: () => {
        const dlBtn = document.getElementById('btnDownloadSingleCardPng');
        if (dlBtn) {
          dlBtn.addEventListener('click', async () => {
            dlBtn.disabled = true;
            dlBtn.innerText = 'กำลังสร้างไฟล์...';
            try {
              const currentTheme = localStorage.getItem('pvt_emp_card_theme') || 'royal_blue';
              const dataUrl = await generateEmployeeCardPNG({
                empCode,
                empName,
                myRole: empRole,
                myDept: empDept,
                avatarUrl: imgUrl,
                qrUrl: qrUrl,
                themeKey: currentTheme
              });
              downloadCardPNG(dataUrl, empCode);
            } catch (err) {
              console.error("Card generation error:", err);
            } finally {
              dlBtn.disabled = false;
              dlBtn.innerText = '📥 ดาวน์โหลด PNG';
            }
          });
        }

        const printBtn = document.getElementById('btnPrintSingleCardAction');
        if (printBtn) {
          printBtn.addEventListener('click', () => {
            const currentTheme = localStorage.getItem('pvt_emp_card_theme') || 'royal_blue';
            window.printSingleCard(empCode, empName, empRole, empDept, imgUrl, currentTheme);
          });
        }
      }
    }).then((result) => {
      if (result.dismiss === Swal.DismissReason.cancel) {
        window.openEmployeeCardManagerPopup();
      }
    });
  };

  // 🟢 4. Single Card Print
  window.printSingleCard = function (empCode, empName, position, department, pictureUrl, themeKey) {
    const selectedThemeKey = themeKey || localStorage.getItem('pvt_emp_card_theme') || 'royal_blue';
    const theme = CARD_THEMES[selectedThemeKey] || CARD_THEMES.royal_blue;

    let employee = {};
    if (typeof empCode === 'object' && empCode !== null) {
      employee = {
        code: empCode.employee_code || empCode.empCode || empCode.id || '',
        name: empCode.name || empCode.empName || empCode.full_name || '-',
        position: empCode.position || empCode.empRole || '-',
        department: empCode.department || empCode.empDept || '-',
        avatar: empCode.image_url || empCode.avatarUrl || '/assets/img/default-avatar.jpg',
        qr_url: empCode.qr_url || generateEmployeeQrUrl(empCode.employee_code || empCode.empCode)
      };
    } else {
      employee = {
        code: empCode || '',
        name: empName || '-',
        position: position || '-',
        department: department || '-',
        avatar: pictureUrl || '/assets/img/default-avatar.jpg',
        qr_url: (pictureUrl && pictureUrl.includes('qrserver.com')) ? pictureUrl : generateEmployeeQrUrl(empCode)
      };
    }

    const printWindow = window.open('', '_blank', 'width=500,height=600');
    if (!printWindow) {
      alert('⚠️ เบราว์เซอร์ระงับการเปิด Pop-up! กรุณากด "อนุญาตให้เปิด Pop-up" ที่แถบ URL ด้านบน');
      return;
    }

    const cardHtml = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>พิมพ์บัตรพนักงาน - ${escapeHtml(employee.name)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: 85.6mm 53.98mm; margin: 0; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Sarabun', sans-serif; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f1f5f9; }
          .card {
            position: relative; width: 85.6mm; height: 53.98mm; border-radius: 8px; padding: 8px 12px;
            background: linear-gradient(135deg, ${theme.bgGrad[0]} 0%, ${theme.bgGrad[1]} 55%, ${theme.bgGrad[2]} 100%);
            color: ${theme.nameText};
            border: ${theme.isLight ? '1px solid #cbd5e1' : 'none'};
            display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .card::before {
            content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
            background: linear-gradient(90deg, ${theme.topAccent[0]}, ${theme.topAccent[1]}, ${theme.topAccent[2]});
          }
          .card-header { font-size: 10px; font-weight: 700; color: ${theme.brandText}; text-align: center; letter-spacing: 1px; }
          .card-body { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
          .avatar-box { width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 2px solid ${theme.avatarRing}; flex-shrink: 0; background: ${theme.avatarFallbackBg || '#0f2b6e'}; }
          .avatar-box img { width: 100%; height: 100%; object-fit: cover; }
          .details { flex: 1; font-size: 9px; line-height: 1.3; }
          .name { font-weight: 700; font-size: 11px; color: ${theme.nameText}; margin-bottom: 2px; }
          .meta { color: ${theme.deptText}; font-size: 9px; }
          .role { color: ${theme.roleText}; font-weight: 600; }
          .qr-box { background: ${theme.qrContainerBg || '#ffffff'}; padding: 4px; border-radius: 6px; display: flex; align-items: center; justify-content: center; ${theme.qrContainerBorder ? `border: 1px solid ${theme.qrContainerBorder};` : ''} }
          .qr-box img { width: 50px; height: 50px; display: block; }
          .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid ${theme.isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}; padding-top: 3px; }
          .emp-id { font-size: 10px; font-weight: 700; background: ${theme.pillBg}; color: ${theme.pillText}; border: 1px solid ${theme.pillBorder}; padding: 2px 8px; border-radius: 10px; font-family: monospace; }
          @media print { body { background: transparent; } .card { border: none; box-shadow: none; } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="card-header">PVT WORKFORCE HUB</div>
          <div class="card-body">
            <div class="avatar-box">
              <img src="${employee.avatar}" onerror="this.src='/assets/img/default-avatar.jpg';" alt="Avatar" />
            </div>
            <div class="details">
              <div class="name">${escapeHtml(employee.name)}</div>
              <div class="meta role">ตำแหน่ง: ${escapeHtml(employee.position)}</div>
              <div class="meta">แผนก: ${escapeHtml(employee.department)}</div>
            </div>
            <div class="qr-box">
              <img id="singleQrImg" src="${employee.qr_url}" alt="QR Code" />
            </div>
          </div>
          <div class="card-footer">
            <span style="font-size: 8px; color: #94a3b8;">EMPLOYEE ID</span>
            <span class="emp-id">${escapeHtml(employee.code)}</span>
          </div>
        </div>
        <script>
          const img = document.getElementById('singleQrImg');
          let printed = false;
          function triggerPrint() {
            if (printed) return;
            printed = true;
            setTimeout(() => {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            }, 300);
          }
          if (img.complete) { triggerPrint(); } 
          else { img.onload = triggerPrint; img.onerror = triggerPrint; }
          setTimeout(triggerPrint, 1500);
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(cardHtml);
    printWindow.document.close();
  };

  // 🟢 5. Batch Print Multiple Cards (A4 Sheet)
  window.printMultipleCards = function (selectedList = []) {
    if (!Array.isArray(selectedList) || selectedList.length === 0) {
      alert("⚠️ กรุณาเลือกพนักงานที่ต้องการพิมพ์บัตร");
      return;
    }

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      alert('⚠️ เบราว์เซอร์ระงับการเปิด Pop-up! กรุณากด "อนุญาตให้เปิด Pop-up" ที่แถบ URL ด้านบน');
      return;
    }

    let cardsHtml = selectedList.map(item => {
      const empCode = item.empCode || item.employee_code || '';
      const qrUrl = generateEmployeeQrUrl(empCode);

      return `
        <div class="card">
          <div class="lanyard-hole"></div>
          <div class="company">PVT WORKFORCE HUB</div>
          <div class="profile-section">
            <div class="name">${escapeHtml(item.empName)}</div>
            <div class="badge-container">
              <span class="role-badge">${escapeHtml(item.empRole)}</span>
              <span class="dept-text">แผนก: ${escapeHtml(item.empDept)}</span>
            </div>
          </div>
          <div class="qr-box"><img class="batch-qr-img" src="${qrUrl}" alt="QR Code" /></div>
          <div class="footer-section"><div class="id-tag">${escapeHtml(empCode)}</div></div>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <meta charset="UTF-8">
          <title>Batch Print ID Cards (${selectedList.length} รายการ)</title>
          <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-family: 'Sarabun', sans-serif; background: #f1f5f9; padding: 20px; margin: 0; }
            .card-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
            .card { 
              position: relative; background: linear-gradient(145deg, #0a2558 0%, #1e40af 55%, #0284c7 100%); 
              width: 240px; height: 380px; border-radius: 16px; padding: 18px 14px; color: white; 
              text-align: center; border: 1px solid rgba(255, 255, 255, 0.15); display: flex; flex-direction: column;
              justify-content: space-between; align-items: center; overflow: hidden; page-break-inside: avoid;
            }
            .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #38bdf8, #60a5fa, #93c5fd); }
            .lanyard-hole { width: 32px; height: 6px; background: #020617; border-radius: 10px; margin-bottom: 6px; border: 1px solid rgba(255, 255, 255, 0.15); }
            .company { font-weight: 700; font-size: 10px; letter-spacing: 2px; color: #bae6fd; text-transform: uppercase; margin-bottom: 6px; }
            .profile-section { margin-bottom: 4px; width: 100%; }
            .name { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; line-height: 1.2; word-break: break-word; }
            .badge-container { display: flex; flex-direction: column; gap: 3px; align-items: center; justify-content: center; }
            .role-badge { font-size: 10px; color: #38bdf8; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); padding: 2px 8px; border-radius: 12px; font-weight: 500; }
            .dept-text { font-size: 10px; color: #94a3b8; font-weight: 400; }
            .qr-box { background: #ffffff; padding: 6px; border-radius: 10px; display: inline-block; border: 2px solid #38bdf8; }
            .qr-box img { width: 110px; height: 110px; display: block; }
            .footer-section { width: 100%; }
            .id-tag { font-size: 13px; font-weight: 700; letter-spacing: 1.5px; color: #f8fafc; background: rgba(255, 255, 255, 0.08); padding: 4px 14px; border-radius: 20px; display: inline-block; border: 1px solid rgba(255,255,255,0.15); font-family: monospace, 'Sarabun'; }
            @media print { body { background: transparent; padding: 0; } .card-grid { gap: 15px; } }
          </style>
        </head>
        <body>
          <div class="card-grid">${cardsHtml}</div>
          <script>
            const images = document.querySelectorAll('.batch-qr-img');
            let loadedCount = 0;
            let printed = false;

            function triggerPrint() {
              if (printed) return;
              printed = true;
              setTimeout(() => {
                window.print();
                setTimeout(() => { window.close(); }, 500);
              }, 400);
            }

            function checkAllLoaded() {
              loadedCount++;
              if (loadedCount >= images.length) {
                triggerPrint();
              }
            }

            if (images.length === 0) {
              triggerPrint();
            } else {
              images.forEach(img => {
                if (img.complete) { checkAllLoaded(); } 
                else { img.onload = checkAllLoaded; img.onerror = checkAllLoaded; }
              });
            }

            setTimeout(triggerPrint, 2500);
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  window.generateEmployeeQrUrl = generateEmployeeQrUrl;

  // 🟢 5. Color Themes & HTML5 Canvas High-Res Digital Card Generator (PNG)
  const CARD_THEMES = {
    royal_blue: {
      id: 'royal_blue',
      name: 'ฟ้าอ่อนพาสเทล',
      emoji: '🔵',
      chipBg: '#e0f2fe',
      chipBorder: '#0284c7',
      bgGrad: ['#f0f9ff', '#e0f2fe', '#bae6fd'],
      topAccent: ['#38bdf8', '#0284c7', '#0369a1'],
      brandText: '#0369a1',
      subText: '#0284c7',
      avatarRing: '#0284c7',
      avatarFallbackBg: '#e0f2fe',
      avatarFallbackText: '#0284c7',
      nameText: '#0369a1',
      roleText: '#0284c7',
      deptText: '#334155',
      qrContainerBg: '#ffffff',
      qrContainerBorder: '#bae6fd',
      qrHelpText: '#475569',
      pillBg: '#ffffff',
      pillBorder: '#bae6fd',
      pillText: '#0284c7',
      isLight: true
    },
    emerald_teal: {
      id: 'emerald_teal',
      name: 'เขียวมิ้นต์พาสเทล',
      emoji: '🟢',
      chipBg: '#dcfce7',
      chipBorder: '#0d9488',
      bgGrad: ['#f0fdf4', '#dcfce7', '#a7f3d0'],
      topAccent: ['#34d399', '#0d9488', '#065f46'],
      brandText: '#065f46',
      subText: '#0d9488',
      avatarRing: '#0d9488',
      avatarFallbackBg: '#dcfce7',
      avatarFallbackText: '#0d9488',
      nameText: '#065f46',
      roleText: '#0d9488',
      deptText: '#115e59',
      qrContainerBg: '#ffffff',
      qrContainerBorder: '#a7f3d0',
      qrHelpText: '#475569',
      pillBg: '#ffffff',
      pillBorder: '#a7f3d0',
      pillText: '#0f766e',
      isLight: true
    },
    emerald_green: {
      id: 'emerald_green',
      name: 'เขียวมิ้นต์พาสเทล',
      emoji: '🟢',
      chipBg: '#dcfce7',
      chipBorder: '#0d9488',
      bgGrad: ['#f0fdf4', '#dcfce7', '#a7f3d0'],
      topAccent: ['#34d399', '#0d9488', '#065f46'],
      brandText: '#065f46',
      subText: '#0d9488',
      avatarRing: '#0d9488',
      avatarFallbackBg: '#dcfce7',
      avatarFallbackText: '#0d9488',
      nameText: '#065f46',
      roleText: '#0d9488',
      deptText: '#115e59',
      qrContainerBg: '#ffffff',
      qrContainerBorder: '#a7f3d0',
      qrHelpText: '#475569',
      pillBg: '#ffffff',
      pillBorder: '#a7f3d0',
      pillText: '#0f766e',
      isLight: true
    },
    luxury_gold: {
      id: 'luxury_gold',
      name: 'ทองครีมพรีเมียม',
      emoji: '🟡',
      chipBg: '#fef3c7',
      chipBorder: '#d97706',
      bgGrad: ['#fffbeb', '#fef3c7', '#fde68a'],
      topAccent: ['#fbbf24', '#d97706', '#78350f'],
      brandText: '#78350f',
      subText: '#b45309',
      avatarRing: '#d97706',
      avatarFallbackBg: '#fef3c7',
      avatarFallbackText: '#b45309',
      nameText: '#78350f',
      roleText: '#b45309',
      deptText: '#92400e',
      qrContainerBg: '#ffffff',
      qrContainerBorder: '#fde68a',
      qrHelpText: '#475569',
      pillBg: '#ffffff',
      pillBorder: '#fde68a',
      pillText: '#b45309',
      isLight: true
    },
    modern_white: {
      id: 'modern_white',
      name: 'ขาวมุกพลาตินัม',
      emoji: '⚪',
      chipBg: '#ffffff',
      chipBorder: '#94a3b8',
      bgGrad: ['#ffffff', '#f8fafc', '#f1f5f9'],
      topAccent: ['#0284c7', '#3b82f6', '#6366f1'],
      brandText: '#0f172a',
      subText: '#0284c7',
      avatarRing: '#0284c7',
      avatarFallbackBg: '#e2e8f0',
      avatarFallbackText: '#0284c7',
      nameText: '#0f172a',
      roleText: '#0284c7',
      deptText: '#475569',
      qrContainerBg: '#ffffff',
      qrContainerBorder: '#cbd5e1',
      qrHelpText: '#64748b',
      pillBg: '#0f172a',
      pillBorder: '#0284c7',
      pillText: '#ffffff',
      isLight: true
    },
    pearl_white: {
      id: 'pearl_white',
      name: 'ขาวมุกพลาตินัม',
      emoji: '⚪',
      chipBg: '#ffffff',
      chipBorder: '#94a3b8',
      bgGrad: ['#ffffff', '#f8fafc', '#f1f5f9'],
      topAccent: ['#0284c7', '#3b82f6', '#6366f1'],
      brandText: '#0f172a',
      subText: '#0284c7',
      avatarRing: '#0284c7',
      avatarFallbackBg: '#e2e8f0',
      avatarFallbackText: '#0284c7',
      nameText: '#0f172a',
      roleText: '#0284c7',
      deptText: '#475569',
      qrContainerBg: '#ffffff',
      qrContainerBorder: '#cbd5e1',
      qrHelpText: '#64748b',
      pillBg: '#0f172a',
      pillBorder: '#0284c7',
      pillText: '#ffffff',
      isLight: true
    },
    dark_navy: {
      id: 'dark_navy',
      name: 'ขาวสเลทพลาตินัม',
      emoji: '⚪',
      chipBg: '#ffffff',
      chipBorder: '#94a3b8',
      bgGrad: ['#ffffff', '#f8fafc', '#e2e8f0'],
      topAccent: ['#0284c7', '#3b82f6', '#0f172a'],
      brandText: '#0f172a',
      subText: '#0284c7',
      avatarRing: '#0284c7',
      avatarFallbackBg: '#e2e8f0',
      avatarFallbackText: '#0284c7',
      nameText: '#0f172a',
      roleText: '#0284c7',
      deptText: '#475569',
      qrContainerBg: '#ffffff',
      qrContainerBorder: '#cbd5e1',
      qrHelpText: '#64748b',
      pillBg: '#0f172a',
      pillBorder: '#0284c7',
      pillText: '#ffffff',
      isLight: true
    },
    violet_platinum: {
      id: 'violet_platinum',
      name: 'ม่วงลาเวนเดอร์พาสเทล',
      emoji: '🟣',
      chipBg: '#f3e8ff',
      chipBorder: '#9333ea',
      bgGrad: ['#faf5ff', '#f3e8ff', '#e9d5ff'],
      topAccent: ['#c084fc', '#9333ea', '#581c87'],
      brandText: '#581c87',
      subText: '#7e22ce',
      avatarRing: '#9333ea',
      avatarFallbackBg: '#f3e8ff',
      avatarFallbackText: '#7e22ce',
      nameText: '#581c87',
      roleText: '#7e22ce',
      deptText: '#6b21a8',
      qrContainerBg: '#ffffff',
      qrContainerBorder: '#e9d5ff',
      qrHelpText: '#475569',
      pillBg: '#ffffff',
      pillBorder: '#e9d5ff',
      pillText: '#7e22ce',
      isLight: true
    },
    purple_luxury: {
      id: 'purple_luxury',
      name: 'ม่วงลาเวนเดอร์พาสเทล',
      emoji: '🟣',
      chipBg: '#f3e8ff',
      chipBorder: '#9333ea',
      bgGrad: ['#faf5ff', '#f3e8ff', '#e9d5ff'],
      topAccent: ['#c084fc', '#9333ea', '#581c87'],
      brandText: '#581c87',
      subText: '#7e22ce',
      avatarRing: '#9333ea',
      avatarFallbackBg: '#f3e8ff',
      avatarFallbackText: '#7e22ce',
      nameText: '#581c87',
      roleText: '#7e22ce',
      deptText: '#6b21a8',
      qrContainerBg: '#ffffff',
      qrContainerBorder: '#e9d5ff',
      qrHelpText: '#475569',
      pillBg: '#ffffff',
      pillBorder: '#e9d5ff',
      pillText: '#7e22ce',
      isLight: true
    },
    rose_crimson: {
      id: 'rose_crimson',
      name: 'ชมพูพีชพาสเทล',
      emoji: '🌸',
      chipBg: '#ffe4e6',
      chipBorder: '#e11d48',
      bgGrad: ['#fff1f2', '#ffe4e6', '#fecdd3'],
      topAccent: ['#fb7185', '#e11d48', '#881337'],
      brandText: '#881337',
      subText: '#be123c',
      avatarRing: '#e11d48',
      avatarFallbackBg: '#ffe4e6',
      avatarFallbackText: '#be123c',
      nameText: '#881337',
      roleText: '#be123c',
      deptText: '#9f1239',
      qrContainerBg: '#ffffff',
      qrContainerBorder: '#fecdd3',
      qrHelpText: '#475569',
      pillBg: '#ffffff',
      pillBorder: '#fecdd3',
      pillText: '#be123c',
      isLight: true
    },
    ocean_cyan: {
      id: 'ocean_cyan',
      name: 'ฟ้าใสซีแอน',
      emoji: '🔷',
      chipBg: '#cffafe',
      chipBorder: '#0891b2',
      bgGrad: ['#ecfeff', '#cffafe', '#a5f3fc'],
      topAccent: ['#38bdf8', '#0891b2', '#155e75'],
      brandText: '#155e75',
      subText: '#0891b2',
      avatarRing: '#0891b2',
      avatarFallbackBg: '#cffafe',
      avatarFallbackText: '#0891b2',
      nameText: '#155e75',
      roleText: '#0891b2',
      deptText: '#0e7490',
      qrContainerBg: '#ffffff',
      qrContainerBorder: '#a5f3fc',
      qrHelpText: '#475569',
      pillBg: '#ffffff',
      pillBorder: '#a5f3fc',
      pillText: '#0891b2',
      isLight: true
    },
    midnight_dark: {
      id: 'midnight_dark',
      name: 'สเลทอ่อนโมเดิร์น',
      emoji: '⚪',
      chipBg: '#f1f5f9',
      chipBorder: '#475569',
      bgGrad: ['#f8fafc', '#f1f5f9', '#e2e8f0'],
      topAccent: ['#0284c7', '#475569', '#0f172a'],
      brandText: '#0f172a',
      subText: '#475569',
      avatarRing: '#0284c7',
      avatarFallbackBg: '#e2e8f0',
      avatarFallbackText: '#0284c7',
      nameText: '#0f172a',
      roleText: '#0284c7',
      deptText: '#475569',
      qrContainerBg: '#ffffff',
      qrContainerBorder: '#cbd5e1',
      qrHelpText: '#64748b',
      pillBg: '#0f172a',
      pillBorder: '#0284c7',
      pillText: '#ffffff',
      isLight: true
    }
  };

  async function generateEmployeeCardPNG({ empCode, empName, myRole, myDept, avatarUrl, qrUrl, themeKey = 'royal_blue' }) {
    const theme = CARD_THEMES[themeKey] || CARD_THEMES.royal_blue;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 960;
    const ctx = canvas.getContext("2d");

    // Ensure we have a high-speed QR code (offline SVG data URL takes <2ms)
    let finalQrUrl = qrUrl;
    if (!finalQrUrl) {
      finalQrUrl = await generateEmployeeQrDataUrl(empCode);
    }

    const loadSafeImage = async (url) => {
      if (!url) return null;
      // Instant loading for Data URLs / SVGs
      if (url.startsWith('data:')) {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = url;
        });
      }
      // Strict timeout of 600ms for network images to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600);
      try {
        const res = await fetch(url, { mode: 'cors', signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('CORS fetch failed');
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = objUrl;
        });
      } catch (e) {
        clearTimeout(timeoutId);
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          let settled = false;
          const done = (val) => {
            if (!settled) {
              settled = true;
              resolve(val);
            }
          };
          img.onload = () => done(img);
          img.onerror = () => done(null);
          img.src = url;
          setTimeout(() => done(null), 500);
        });
      }
    };

    const [avatarImg, qrImg] = await Promise.all([
      loadSafeImage(avatarUrl),
      loadSafeImage(finalQrUrl)
    ]);

    const drawRoundedRect = (x, y, w, h, r, fillStyle) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
    };

    // Background Gradient with Theme
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 960);
    bgGrad.addColorStop(0, theme.bgGrad[0]);
    bgGrad.addColorStop(0.55, theme.bgGrad[1]);
    bgGrad.addColorStop(1, theme.bgGrad[2]);
    drawRoundedRect(0, 0, 640, 960, 48, bgGrad);

    // Subtle border for light themes
    if (theme.isLight) {
      ctx.beginPath();
      ctx.moveTo(48, 0);
      ctx.arcTo(640, 0, 640, 960, 48);
      ctx.arcTo(640, 960, 0, 960, 48);
      ctx.arcTo(0, 960, 0, 0, 48);
      ctx.arcTo(0, 0, 640, 0, 48);
      ctx.closePath();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // Decorative Top Accent Bar
    const lineGrad = ctx.createLinearGradient(0, 0, 640, 0);
    lineGrad.addColorStop(0, theme.topAccent[0]);
    lineGrad.addColorStop(0.5, theme.topAccent[1]);
    lineGrad.addColorStop(1, theme.topAccent[2]);
    drawRoundedRect(0, 0, 640, 14, 7, lineGrad);

    // Organization Branding Header
    ctx.fillStyle = theme.brandText;
    ctx.font = 'bold 22px "Sarabun", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PVT WORKFORCE HUB', 320, 75);

    ctx.fillStyle = theme.subText;
    ctx.font = '600 13px "Sarabun", sans-serif';
    ctx.fillText('DIGITAL EMPLOYEE IDENTITY CARD', 320, 102);

    // Avatar Circle Clip
    const avatarX = 320, avatarY = 220, avatarRadius = 88;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (avatarImg) {
      try {
        const aspect = avatarImg.width / avatarImg.height;
        let dw = avatarRadius * 2, dh = avatarRadius * 2;
        if (aspect > 1) dw = dh * aspect;
        else dh = dw / aspect;
        ctx.drawImage(avatarImg, avatarX - dw / 2, avatarY - dh / 2, dw, dh);
      } catch (e) {
        drawFallbackAvatar();
      }
    } else {
      drawFallbackAvatar();
    }
    ctx.restore();

    function drawFallbackAvatar() {
      ctx.fillStyle = theme.avatarFallbackBg || '#0f2b6e';
      ctx.fill();
      ctx.fillStyle = theme.avatarFallbackText || '#38bdf8';
      ctx.font = 'bold 52px "Sarabun", sans-serif';
      ctx.textAlign = 'center';
      const initial = (empName || 'P').trim().charAt(0).toUpperCase();
      ctx.fillText(initial, avatarX, avatarY + 18);
    }

    // Avatar Border Ring
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.strokeStyle = theme.avatarRing;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Employee Details
    ctx.fillStyle = theme.nameText;
    ctx.font = 'bold 32px "Sarabun", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(empName, 320, 360);

    ctx.fillStyle = theme.roleText;
    ctx.font = 'bold 22px "Sarabun", sans-serif';
    ctx.fillText(`ตำแหน่ง: ${myRole}`, 320, 404);

    ctx.fillStyle = theme.deptText;
    ctx.font = '500 20px "Sarabun", sans-serif';
    ctx.fillText(`แผนก: ${myDept}`, 320, 442);

    // QR Frame Container
    drawRoundedRect(185, 480, 270, 270, 28, theme.qrContainerBg);
    if (theme.qrContainerBorder) {
      ctx.strokeStyle = theme.qrContainerBorder;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (qrImg) {
      try {
        ctx.drawImage(qrImg, 205, 500, 230, 230);
      } catch (e) {
        drawFallbackQr();
      }
    } else {
      drawFallbackQr();
    }

    function drawFallbackQr() {
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px "Sarabun", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SCAN QR CODE', 320, 615);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText(empCode, 320, 640);
    }

    // QR Helper Text
    ctx.fillStyle = theme.qrHelpText;
    ctx.font = '500 14px "Sarabun", sans-serif';
    ctx.fillText('สแกน QR สำหรับลงเวลาและเข้าสู่ระบบ', 320, 785);

    // Employee Code Badge
    drawRoundedRect(195, 820, 250, 60, 30, theme.pillBg);
    ctx.strokeStyle = theme.pillBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.pillText;
    ctx.font = 'bold 28px monospace, "Sarabun", sans-serif';
    ctx.fillText(empCode, 320, 861);

    try {
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.warn("Canvas toDataURL tainted, returning vector fallback:", e);
      return drawPureVectorPNG({ empCode, empName, myRole, myDept, themeKey });
    }
  }

  // Safe vector fallback PNG generator that never fails
  function drawPureVectorPNG({ empCode, empName, myRole, myDept, themeKey = 'royal_blue' }) {
    const theme = CARD_THEMES[themeKey] || CARD_THEMES.royal_blue;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 960;
    const ctx = canvas.getContext("2d");

    const drawRoundedRect = (x, y, w, h, r, fillStyle) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fillStyle = fillStyle;
      ctx.fill();
    };

    const bgGrad = ctx.createLinearGradient(0, 0, 0, 960);
    bgGrad.addColorStop(0, theme.bgGrad[0]);
    bgGrad.addColorStop(0.55, theme.bgGrad[1]);
    bgGrad.addColorStop(1, theme.bgGrad[2]);
    drawRoundedRect(0, 0, 640, 960, 48, bgGrad);

    if (theme.isLight) {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    ctx.fillStyle = theme.brandText;
    ctx.font = 'bold 22px "Sarabun", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PVT WORKFORCE HUB', 320, 80);

    ctx.fillStyle = theme.subText;
    ctx.font = '600 13px "Sarabun", sans-serif';
    ctx.fillText('DIGITAL EMPLOYEE IDENTITY CARD', 320, 105);

    const avatarX = 320, avatarY = 220, avatarRadius = 88;
    ctx.fillStyle = theme.avatarFallbackBg || '#0f2b6e';
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.avatarRing;
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle = theme.avatarFallbackText || '#38bdf8';
    ctx.font = 'bold 52px "Sarabun", sans-serif';
    const initial = (empName || 'P').trim().charAt(0).toUpperCase();
    ctx.fillText(initial, avatarX, avatarY + 18);

    ctx.fillStyle = theme.nameText;
    ctx.font = 'bold 32px "Sarabun", sans-serif';
    ctx.fillText(empName, 320, 360);

    ctx.fillStyle = theme.roleText;
    ctx.font = 'bold 22px "Sarabun", sans-serif';
    ctx.fillText(`ตำแหน่ง: ${myRole}`, 320, 404);

    ctx.fillStyle = theme.deptText;
    ctx.font = '500 20px "Sarabun", sans-serif';
    ctx.fillText(`แผนก: ${myDept}`, 320, 442);

    drawRoundedRect(185, 480, 270, 270, 28, theme.qrContainerBg);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('EMPLOYEE QR CODE', 320, 610);
    ctx.fillStyle = '#64748b';
    ctx.font = '15px monospace';
    ctx.fillText(empCode, 320, 635);

    drawRoundedRect(195, 820, 250, 60, 30, theme.pillBg);
    ctx.strokeStyle = theme.pillBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = theme.pillText;
    ctx.font = 'bold 28px monospace, "Sarabun", sans-serif';
    ctx.fillText(empCode, 320, 861);

    return canvas.toDataURL('image/png');
  }

  // Helper: Download Card PNG to user's device
  function downloadCardPNG(dataUrl, empCode) {
    try {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Employee_Card_${empCode || 'PVT'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // แจ้งเตือนดาวน์โหลดแบบ custom fixed เพื่อให้อยู่กึ่งกลาง viewport จริง ๆ
      // และไม่ชน/แทนที่ SweetAlert popup บัตรพนักงานที่กำลังเปิดอยู่
      const oldNotice = document.getElementById('employeeCardDownloadNotice');
      if (oldNotice) oldNotice.remove();

      const notice = document.createElement('div');
      notice.id = 'employeeCardDownloadNotice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.style.cssText = `
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        z-index: 2147483647;
        width: min(340px, calc(100vw - 32px));
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: #ffffff;
        color: #0f172a;
        border: 1px solid #dbeafe;
        border-radius: 16px;
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.28);
        font-family: inherit;
        opacity: 0;
        transition: opacity .18s ease, transform .18s ease;
        pointer-events: none;
      `;

      const icon = document.createElement('div');
      icon.style.cssText = `
        width: 38px;
        height: 38px;
        min-width: 38px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: #dcfce7;
        color: #16a34a;
        font-size: 22px;
        font-weight: 900;
      `;
      icon.textContent = '✓';

      const message = document.createElement('div');
      message.style.cssText = `
        min-width: 0;
        font-size: 15px;
        line-height: 1.45;
        font-weight: 700;
        text-align: left;
        word-break: break-word;
      `;
      message.textContent = `ดาวน์โหลดบัตร #${empCode || 'PVT'} เรียบร้อยแล้ว`;

      notice.appendChild(icon);
      notice.appendChild(message);
      document.body.appendChild(notice);

      requestAnimationFrame(() => {
        notice.style.opacity = '1';
        notice.style.transform = 'translate(-50%, -50%) scale(1)';
      });

      setTimeout(() => {
        notice.style.opacity = '0';
        notice.style.transform = 'translate(-50%, -50%) scale(.97)';
        setTimeout(() => notice.remove(), 220);
      }, 2200);
    } catch (err) {
      console.error("❌ Error downloading card PNG:", err);
      window.open(dataUrl, '_blank');
    }
  }

  // 🟢 6. Open My Individual Employee Card Modal (สำหรับหน้า User - "ของใครของมัน / กรองด้วยรหัสพนักงาน")
  window.openMyEmployeeCardModal = async function (targetEmpCode) {
    if (typeof Swal === "undefined") {
      alert("⚠️ กำลังโหลดระบบบัตรพนักงาน กรุณารอสักครู่");
      return;
    }

    const isAdmin = isUserAdmin();

    // หากผู้ใช้งานเป็น Admin และกดเมนูบัตรพนักงานเข้ามาโดยไม่ได้ระบุรหัสพนักงาน ให้เปิดระบบดูและพิมพ์บัตรพนักงานทุกคน
    if (isAdmin && !targetEmpCode) {
      return window.openEmployeeCardManagerPopup();
    }

    // ดึงรหัสพนักงานของผู้ใช้งานปัจจุบัน
    let currentCode = String(targetEmpCode || "").trim();
    
    // หากไม่ใช่อุปกรณ์/บัญชี Admin ให้จำกัดดูได้เฉพาะบัตรพนักงานของตนเองเท่านั้น
    if (!isAdmin) {
      const sessionUser = JSON.parse(localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser") || "{}");
      const profile = window.currentProfile || window.currentUserProfile || sessionUser || {};
      const myOwnCode = String(
        profile?.employee_code ||
        profile?.emp_code ||
        sessionUser?.employee_code ||
        sessionUser?.emp_code ||
        ""
      ).trim();

      if (myOwnCode) {
        currentCode = myOwnCode;
      }
    } else if (!currentCode) {
      const sessionUser = JSON.parse(localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser") || "{}");
      const profile = window.currentProfile || window.currentUserProfile || sessionUser || {};
      currentCode = String(
        profile?.employee_code ||
        profile?.emp_code ||
        sessionUser?.employee_code ||
        sessionUser?.emp_code ||
        ""
      ).trim();
    }

    // หากไม่พบรหัสพนักงานใน Session ให้แสดงป๊อปอัปให้ผู้ใช้ระบุรหัสพนักงานเพื่อกรอง
    if (!currentCode) {
      Swal.fire({
        title: '💳 บัตรประจำตัวพนักงานดิจิทัล',
        html: `
          <div style="font-size: 14px; color: #475569; margin-bottom: 14px;">
            กรุณาระบุรหัสพนักงานของคุณเพื่อค้นหาและเปิดบัตรประจำตัว
          </div>
          <div style="margin-bottom: 10px;">
            <input type="text" id="swalInputEmpCode" placeholder="ระบุรหัสพนักงาน เช่น EMP001"
                   style="width: 85%; padding: 10px 14px; font-size: 15px; font-weight: 700; border: 1.5px solid #cbd5e1; border-radius: 8px; text-align: center; font-family: monospace; outline: none; color: #0f172a;" />
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: '🔍 ดูบัตรพนักงาน',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#0f766e',
        cancelButtonColor: '#64748b',
        preConfirm: () => {
          const val = document.getElementById('swalInputEmpCode')?.value.trim();
          if (!val) {
            Swal.showValidationMessage('กรุณากรอกรหัสพนักงาน');
            return false;
          }
          return val;
        }
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          window.openMyEmployeeCardModal(result.value);
        }
      });
      return;
    }

    // แสดงสถานะกำลังโหลด
    Swal.fire({
      title: '⏳ กำลังเตรียมบัตรพนักงาน...',
      html: `
        <div style="padding: 16px 8px; font-size: 14px; color: #0f766e; display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <span>กำลังกรองข้อมูลรหัสพนักงาน: <b style="font-family: monospace; font-size: 16px; color: #0284c7;">${escapeHtml(currentCode)}</b></span>
          <span style="font-size: 12px; color: #64748b;">ระบบกำลังจัดเตรียมภาพบัตรความละเอียดสูงสำหรับดาวน์โหลด...</span>
        </div>
      `,
      allowOutsideClick: false,
      didOpen: () => {
        if (Swal.showLoading) Swal.showLoading();
      }
    });

    // ดึงข้อมูลพนักงานจากฐานข้อมูล Supabase ด้วยการกรอง employee_code หรือ full_name
    let empData = null;
    try {
      const client = await getClient();
      if (client) {
        const { data, error } = await client
          .from('employees')
          .select(`
            id,
            employee_code,
            full_name,
            image_url,
            line_id,
            department_id,
            departments!department_id ( department_name ),
            positions ( position_name )
          `)
          .or(`employee_code.ilike.%${currentCode}%,full_name.ilike.%${currentCode}%`)
          .limit(1)
          .maybeSingle();

        if (data) {
          empData = data;
        }
      }
    } catch (err) {
      console.warn("⚠️ ไม่สามารถดึงข้อมูลจาก Supabase ได้ ใช้ข้อมูลแคช:", err);
    }

    // หากไม่พบในฐานข้อมูล ให้ใช้ข้อมูลใน Local Session
    if (!empData) {
      const sessionUser = JSON.parse(localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser") || "{}");
      const profile = window.currentProfile || window.currentUserProfile || sessionUser || {};
      const profileCode = profile?.employee_code || profile?.emp_code || sessionUser?.employee_code || sessionUser?.emp_code || "";
      if (profileCode && profileCode.toUpperCase() === currentCode.toUpperCase()) {
        empData = profile;
      }
    }

    // หากยังไม่พบข้อมูล ให้แจ้งเตือนและให้กรอกรหัสใหม่
    if (!empData) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่พบข้อมูลพนักงาน',
        html: `
          <div style="font-size: 14px; color: #475569; margin-bottom: 12px;">
            ไม่พบข้อมูลพนักงานสำหรับคำค้นหา: <b style="font-family: monospace; color: #ef4444;">${escapeHtml(currentCode)}</b>
          </div>
          <div style="font-size: 13px; color: #64748b;">
            กรุณาตรวจสอบรหัสพนักงานหรือชื่อใหม่อีกครั้ง
          </div>
        `,
        confirmButtonText: 'กรอกรหัสใหม่',
        confirmButtonColor: '#0f766e',
        showCancelButton: true,
        cancelButtonText: 'ปิด',
        cancelButtonColor: '#64748b'
      }).then((res) => {
        if (res.isConfirmed) {
          window.openMyEmployeeCardModal();
        }
      });
      return;
    }

    const finalCode = empData.employee_code || currentCode;
    const fullName = empData.full_name || "พนักงาน";
    const myDept = empData.departments?.department_name || empData.department_name || "ทั่วไป";
    const myRole = empData.positions?.position_name || empData.position_name || "พนักงาน";
    const empTitle = empData.title || '';
    const empGender = empData.gender || '';
    const defaultAvatar = (typeof window.getDefaultAvatarUrl === 'function')
      ? window.getDefaultAvatarUrl(empTitle, empGender, fullName)
      : ((empTitle.includes('สาว') || empTitle.includes('นาง') || empTitle.includes('น.ส.') || empGender === 'female' || fullName.includes('นาง') || fullName.includes('น.ส.')) ? '/assets/img/avatar-female.jpg?v=2' : '/assets/img/avatar-male.jpg?v=2');

    const avatarUrl = (window.pvtSupabase && typeof window.pvtSupabase.getAvatarUrl === 'function')
      ? window.pvtSupabase.getAvatarUrl(empData.image_url, empTitle, empGender, fullName)
      : (typeof window.getAvatarUrl === 'function' ? window.getAvatarUrl(empData.image_url, empTitle, empGender, fullName) : (empData.image_url ? (empData.image_url.startsWith('http') ? empData.image_url : `${(window.SUPABASE_URL || 'https://pgogmhqjdchakcytsomx.supabase.co')}/storage/v1/object/public/employee-images/${empData.image_url.replace(/^\//, '')}`) : defaultAvatar));
    const qrUrl = generateEmployeeQrUrl(finalCode);

    let currentThemeKey = localStorage.getItem('pvt_emp_card_theme') || 'royal_blue';
    if (!CARD_THEMES[currentThemeKey]) currentThemeKey = 'royal_blue';

    // Normalize legacy duplicate theme keys so the dropdown shows each color once.
    const themeAliases = {
      emerald_green: 'emerald_teal',
      pearl_white: 'modern_white',
      purple_luxury: 'violet_platinum'
    };
    if (themeAliases[currentThemeKey]) {
      currentThemeKey = themeAliases[currentThemeKey];
      localStorage.setItem('pvt_emp_card_theme', currentThemeKey);
    }

    // สำหรับ Admin: ดึงรายชื่อพนักงานทั้งหมดสร้าง Dropdown Selector
    let adminSelectHtml = '';
    if (isAdmin) {
      if (!cachedEmployeeList || cachedEmployeeList.length === 0) {
        try {
          const client = await getClient();
          if (client) {
            const { data } = await client
              .from('employees')
              .select(`
                id,
                employee_code,
                full_name,
                department_id,
                departments!department_id ( department_name )
              `)
              .order('employee_code', { ascending: true });
            if (data) cachedEmployeeList = data;
          }
        } catch (e) {}
      }

      if (cachedEmployeeList && cachedEmployeeList.length > 0) {
        const optionsHtml = cachedEmployeeList.map(e => {
          const code = e.employee_code || '';
          const name = e.full_name || '';
          const dept = e.departments?.department_name || '';
          const isSelected = code.toUpperCase() === finalCode.toUpperCase();
          return `<option value="${escapeHtml(code)}" ${isSelected ? 'selected' : ''}>${escapeHtml(code)} - ${escapeHtml(name)} (${escapeHtml(dept)})</option>`;
        }).join('');

        adminSelectHtml = `
          <!-- ตัวเลือกสำหรับ Admin ดูบัตรพนักงานทุกคน -->
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 10px 14px; margin-bottom: 12px; text-align: left;">
            <div style="font-size: 12px; font-weight: 700; color: #0369a1; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
              <span>👑 สิทธิ์แอดมิน: เลือกดูบัตรพนักงานทุกคน</span>
              <button type="button" id="btnAdminOpenAllCardsList" style="background: #0284c7; color: #ffffff; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                <span>📋 ดูรายชื่อทั้งหมด</span>
              </button>
            </div>
            <select id="adminCardEmpSelect" style="width: 100%; padding: 8px 10px; font-size: 13.5px; font-weight: 700; border: 1.5px solid #0284c7; border-radius: 8px; outline: none; background: #ffffff; color: #0f172a; cursor: pointer;">
              ${optionsHtml}
            </select>
          </div>
        `;
      }
    }

    // สร้างรูปบัตรความละเอียดสูง (PNG Data URL) ตามธีมสีที่เลือก
    let cardImageDataUrl = await generateEmployeeCardPNG({
      empCode: finalCode,
      empName: fullName,
      myRole: myRole,
      myDept: myDept,
      avatarUrl: avatarUrl,
      qrUrl: qrUrl,
      themeKey: currentThemeKey
    });

    // สร้างรายการสีบัตรแบบ Dropdown (แสดงเฉพาะธีมที่ไม่ซ้ำกัน)
    const visibleThemeKeys = [
      'royal_blue',
      'emerald_teal',
      'luxury_gold',
      'modern_white',
      'dark_navy',
      'violet_platinum',
      'rose_crimson',
      'ocean_cyan',
      'midnight_dark'
    ];
    const colorThemeOptionsHtml = visibleThemeKeys.map(key => {
      const t = CARD_THEMES[key];
      if (!t) return '';
      return `<option value="${t.id}" ${t.id === currentThemeKey ? 'selected' : ''}>${t.emoji || '🎨'} ${t.name}</option>`;
    }).join('');

    const adminFilterHtml = isAdmin ? `
        <!-- ฟิลเตอร์กรองด้วยรหัสพนักงานสำหรับ Admin -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px; margin-bottom: 16px; text-align: left;">
          <div style="font-size: 11.5px; font-weight: 700; color: #475569; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
            <span>🔍 ค้นหารหัสพนักงาน / ชื่อพนักงาน</span>
            <span style="color: #0f766e; background: #ccfbf1; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;">สิทธิ์แอดมิน</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="myCardFilterCodeInput" value="${escapeHtml(finalCode)}" placeholder="ระบุรหัสพนักงานหรือชื่อ..."
                   style="flex: 1; padding: 8px 10px; font-size: 13.5px; font-weight: 700; border: 1.5px solid #cbd5e1; border-radius: 8px; outline: none; font-family: inherit; color: #0f172a;" />
            <button type="button" id="btnApplyCodeFilter"
                    style="background: #0f766e; color: #ffffff; border: none; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <span>ค้นหา</span>
            </button>
          </div>
        </div>
    ` : '';

    // แสดงป๊อปอัปบัตรพนักงาน
    Swal.fire({
      title: '💳 บัตรประจำตัวพนักงานดิจิทัล',
      width: '470px',
      html: `
        ${adminSelectHtml}

        <!-- เลือกชุดสีบัตรแบบ Dropdown -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; margin: 4px 0 14px 0; text-align: left;">
          <label for="cardThemeSelect" style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 7px; display: flex; align-items: center; gap: 6px;">
            <span>🎨</span>
            <span>เลือกสีบัตรพนักงาน (Card Theme)</span>
          </label>
          <div style="position: relative; display: flex; align-items: center; gap: 8px;">
            <span id="cardThemeColorPreview" aria-hidden="true"
                  style="width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0; background: ${CARD_THEMES[currentThemeKey]?.chipBg || '#e0f2fe'}; border: 1px solid ${CARD_THEMES[currentThemeKey]?.chipBorder || '#0284c7'};"></span>
            <select id="cardThemeSelect" aria-label="เลือกสีบัตรพนักงาน"
                    style="width: 100%; min-width: 0; padding: 9px 36px 9px 11px; font-family: inherit; font-size: 13px; font-weight: 600; color: #0f172a; background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 9px; outline: none; cursor: pointer; box-shadow: 0 1px 2px rgba(15,23,42,0.04);">
              ${colorThemeOptionsHtml}
            </select>
          </div>
        </div>

        <div style="margin: 0 0 16px 0; position: relative;">
          <!-- ภาพตัวอย่างบัตรพนักงาน -->
          <div style="position: relative; display: inline-block;">
            <img id="myEmpCardImgPreview" src="${cardImageDataUrl}" alt="บัตรพนักงาน ${escapeHtml(finalCode)}"
                 style="width: 270px; border-radius: 20px; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.28); display: block; margin: 0 auto; border: 1px solid rgba(0,0,0,0.08); transition: opacity 0.2s ease;" />
            <div id="cardRenderingSpinner" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600;">
              กำลังเปลี่ยนสี...
            </div>
          </div>
        </div>

        ${adminFilterHtml}

        <!-- ปุ่มคำสั่งดาวน์โหลดและพิมพ์ -->
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <button type="button" id="btnDownloadCardPng"
                  style="width: 100%; background: #0284c7; color: #ffffff; border: none; padding: 12px; border-radius: 10px; font-size: 14.5px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.28); transition: all 0.2s ease;">
            <img src="/assets/icons/download.svg" onerror="this.remove()" style="width: 18px; height: 18px; filter: brightness(0) invert(1);" alt="" />
            <span>📥 ดาวน์โหลดรูปลงเครื่อง (PNG)</span>
          </button>

          <button type="button" id="btnPrintCardSingle"
                  style="width: 100%; background: #0f766e; color: #ffffff; border: none; padding: 11px; border-radius: 10px; font-size: 13.5px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 2px 6px rgba(15, 118, 110, 0.25); transition: all 0.2s ease;">
            <img src="/assets/icons/print.svg" onerror="this.remove()" style="width: 18px; height: 18px; filter: brightness(0) invert(1);" alt="" />
            <span>🖨️ สั่งพิมพ์บัตร / บันทึก PDF (CR80)</span>
          </button>
        </div>
      `,
      showCancelButton: false,
      confirmButtonText: 'ปิดหน้าต่าง',
      confirmButtonColor: '#64748b',
      customClass: {
        confirmButton: 'swal2-confirm-btn-standard'
      },
      didOpen: () => {
        if (isAdmin) {
          const adminSelect = document.getElementById('adminCardEmpSelect');
          if (adminSelect) {
            adminSelect.addEventListener('change', (e) => {
              const selectedCode = e.target.value;
              if (selectedCode) {
                window.openMyEmployeeCardModal(selectedCode);
              }
            });
          }
          const adminListBtn = document.getElementById('btnAdminOpenAllCardsList');
          if (adminListBtn) {
            adminListBtn.addEventListener('click', () => {
              window.openEmployeeCardManagerPopup();
            });
          }
        }

        // ผูก Dropdown เปลี่ยนสีบัตรพนักงานแบบตอบสนองทันที
        const themeSelect = document.getElementById('cardThemeSelect');
        const themeColorPreview = document.getElementById('cardThemeColorPreview');
        const previewImg = document.getElementById('myEmpCardImgPreview');
        const spinner = document.getElementById('cardRenderingSpinner');

        if (themeSelect) {
          themeSelect.addEventListener('change', async () => {
            const selectedKey = themeSelect.value;
            if (!selectedKey || !CARD_THEMES[selectedKey] || selectedKey === currentThemeKey) return;

            currentThemeKey = selectedKey;
            localStorage.setItem('pvt_emp_card_theme', currentThemeKey);

            // อัปเดตจุดตัวอย่างสีข้าง Dropdown
            const selectedTheme = CARD_THEMES[currentThemeKey];
            if (themeColorPreview && selectedTheme) {
              themeColorPreview.style.background = selectedTheme.chipBg;
              themeColorPreview.style.borderColor = selectedTheme.chipBorder || 'transparent';
            }

            // สร้างรูปบัตรใหม่ตามสีที่เลือก
            if (previewImg) previewImg.style.opacity = '0.4';
            if (spinner) spinner.style.display = 'block';
            themeSelect.disabled = true;

            try {
              cardImageDataUrl = await generateEmployeeCardPNG({
                empCode: finalCode,
                empName: fullName,
                myRole: myRole,
                myDept: myDept,
                avatarUrl: avatarUrl,
                qrUrl: qrUrl,
                themeKey: currentThemeKey
              });
              if (previewImg) previewImg.src = cardImageDataUrl;
            } catch (err) {
              console.error("❌ Failed to update card theme:", err);
            } finally {
              if (previewImg) previewImg.style.opacity = '1';
              if (spinner) spinner.style.display = 'none';
              themeSelect.disabled = false;
            }
          });
        }

        // ผูกปุ่มดาวน์โหลดรูปบัตร
        const dlBtn = document.getElementById('btnDownloadCardPng');
        if (dlBtn) {
          dlBtn.addEventListener('click', () => {
            downloadCardPNG(cardImageDataUrl, finalCode);
          });
        }

        // ผูกปุ่มสั่งพิมพ์บัตรเดี่ยว
        const printBtn = document.getElementById('btnPrintCardSingle');
        if (printBtn) {
          printBtn.addEventListener('click', () => {
            window.printSingleCard(finalCode, fullName, myRole, myDept, avatarUrl, currentThemeKey);
          });
        }

        // ผูกปุ่มกรองด้วยรหัสพนักงาน
        const filterBtn = document.getElementById('btnApplyCodeFilter');
        const filterInput = document.getElementById('myCardFilterCodeInput');
        if (filterBtn && filterInput) {
          const runFilter = () => {
            const newCode = filterInput.value.trim();
            if (newCode) {
              window.openMyEmployeeCardModal(newCode);
            }
          };
          filterBtn.addEventListener('click', runFilter);
          filterInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              runFilter();
            }
          });
        }
      }
    });
  };

  // Export functions globally
  window.viewMyDigitalCard = function(targetEmpCode) {
    if (isUserAdmin() && !targetEmpCode) {
      return window.openEmployeeCardManagerPopup();
    }
    return window.openMyEmployeeCardModal(targetEmpCode);
  };
  window.showStaffCard = window.viewMyDigitalCard;
  window.generateEmployeeCardPNG = generateEmployeeCardPNG;
  window.downloadCardPNG = downloadCardPNG;
})();
