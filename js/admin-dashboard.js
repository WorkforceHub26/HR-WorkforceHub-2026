// 🔒 [STRICT ADMIN GUARD]: ตรวจสอบสิทธิ์ Admin ระดับสูงทันที
    (function enforceAdminOnlyPage() {
      try {
        const raw = localStorage.getItem("currentUser");
        const session = raw ? JSON.parse(raw) : null;
        const emp = session?.employees || session || {};
        const role = String(session?.role || emp.role || '').toLowerCase().trim();
        const isTrueAdmin = role === 'admin' || role === 'superadmin' || session?.employee_code === 'HR-001' || emp.employee_code === 'HR-001';
        
        if (!session || !isTrueAdmin) {
          alert("🚫 เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเข้าใช้งานหน้าคอนโซลแอดมินนี้ได้");
          window.location.replace("/pages/hr/home.html");
        }
      } catch(e) {}
    })();

    // Toast System
    function showToast(message, type = 'success') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      
      let icon = 'check_circle';
      if (type === 'error') icon = 'error';
      if (type === 'warning') icon = 'warning';
      if (type === 'info') icon = 'info';

      toast.innerHTML = `
        <span class="material-symbols-outlined">${icon}</span>
        <div style="flex:1">${message}</div>
      `;

      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
      }, 4000);
    }

    // =========================================================================
    // 📝 [PERSISTENT LOG ENGINE]: บันทึกทุกขั้นตอนสำหรับการแก้บัค
    // =========================================================================
    const LOG_STORAGE_KEY = 'pvt_admin_system_logs';
    let currentLogFilter = 'all';

    function getStoredLogs() {
      try {
        const raw = localStorage.getItem(LOG_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    function saveLogEntry(msg, type = 'info', source = 'System') {
      const logs = getStoredLogs();
      const newLog = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        time: new Date().toLocaleTimeString('th-TH'),
        fullTime: new Date().toISOString(),
        type: type.toLowerCase(), // info, success, warn, error, action
        source,
        message: String(msg)
      };

      logs.push(newLog);
      if (logs.length > 500) logs.shift(); // Keep max 500 entries

      try {
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
      } catch(e) {}

      renderLogs();
    }

    function renderLogs() {
      const container = document.getElementById('console-output');
      if (!container) return;

      const logs = getStoredLogs();
      const searchQ = (document.getElementById('log-search-input')?.value || '').toLowerCase().trim();

      const filtered = logs.filter(log => {
        if (currentLogFilter !== 'all') {
          if (currentLogFilter === 'error' && log.type !== 'error') return false;
          if (currentLogFilter === 'warn' && log.type !== 'warn' && log.type !== 'warning') return false;
          if (currentLogFilter === 'action' && log.type !== 'action') return false;
        }
        if (searchQ) {
          const combined = `${log.time} ${log.type} ${log.source} ${log.message}`.toLowerCase();
          if (!combined.includes(searchQ)) return false;
        }
        return true;
      });

      const countBadge = document.getElementById('log-count-badge');
      if (countBadge) {
        countBadge.textContent = `${filtered.length} / ${logs.length} รายการ`;
      }

      if (filtered.length === 0) {
        container.innerHTML = '<div style="color: #64748b; padding: 20px; text-align: center; font-style: italic;">-- ไม่พบประวัติบันทึกตามเงื่อนไขค้นหา --</div>';
        return;
      }

      container.innerHTML = filtered.map(log => {
        let typeColor = '#38bdf8';
        if (log.type === 'error') typeColor = '#f43f5e';
        else if (log.type === 'warn' || log.type === 'warning') typeColor = '#fbbf24';
        else if (log.type === 'success') typeColor = '#34d399';
        else if (log.type === 'action') typeColor = '#c084fc';

        return `<div class="log-entry" style="margin-bottom: 4px; font-family: 'JetBrains Mono', monospace; font-size: 12px; line-height: 1.5;">` +
          `<span class="log-time" style="color: #64748b; margin-right: 6px;">[${log.time}]</span>` +
          `<span style="color: ${typeColor}; font-weight: 700; margin-right: 6px;">[${log.type.toUpperCase()}]</span>` +
          `<span style="color: #94a3b8; font-size: 11px; margin-right: 8px;">(${log.source})</span>` +
          `<span style="color: #f1f5f9;">${escapeHtmlLogs(log.message)}</span>` +
          `</div>`;
      }).join('');

      container.scrollTop = container.scrollHeight;
    }

    function escapeHtmlLogs(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function setLogFilter(filterType) {
      currentLogFilter = filterType;
      document.querySelectorAll('.log-filter-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById(`filter-btn-${filterType}`);
      if (activeBtn) activeBtn.classList.add('active');
      renderLogs();
    }

    function refreshLogsUI() {
      renderLogs();
      showToast('รีเฟรชประวัติ Log ล่าสุดเรียบร้อย', 'info');
    }

    function clearLogs() {
      if (confirm('คุณต้องการล้างประวัติ Log บันทึกระบบทั้งหมดหรือไม่?')) {
        localStorage.removeItem(LOG_STORAGE_KEY);
        renderLogs();
        saveLogEntry('ล้างประวัติ Log โดยผู้ดูแลระบบ', 'info', 'System');
        showToast('ล้างประวัติ Log เรียบร้อยแล้ว', 'success');
      }
    }

    function downloadLogFile() {
      const logs = getStoredLogs();
      if (logs.length === 0) {
        showToast('ไม่มีข้อมูล Log สำหรับดาวน์โหลด', 'warning');
        return;
      }
      const textContent = logs.map(l => `[${l.fullTime}] [${l.type.toUpperCase()}] (${l.source}): ${l.message}`).join('\n');
      const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pvt_admin_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('ดาวน์โหลดไฟล์ Log สำเร็จ', 'success');
    }

    // Intercept Console
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args) => {
      saveLogEntry(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'info', 'Console');
      originalLog(...args);
    };
    console.warn = (...args) => {
      saveLogEntry(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'warn', 'Console');
      originalWarn(...args);
    };
    console.error = (...args) => {
      saveLogEntry(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '), 'error', 'Console');
      originalError(...args);
    };

    // Intercept Window Errors
    window.addEventListener('error', (e) => {
      if (e.message === 'Script error.' || e.message === 'Script error') return;
      saveLogEntry(`[UNHANDLED ERROR] ${e.message} at ${e.filename}:${e.lineno}`, 'error', 'Runtime');
    });
    window.addEventListener('unhandledrejection', (e) => {
      saveLogEntry(`[UNHANDLED PROMISE] ${e.reason?.message || e.reason}`, 'error', 'Promise');
    });

    // Intercept Fetch Requests
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || 'unknown');
      const method = args[1]?.method || 'GET';
      const start = Date.now();
      try {
        const response = await originalFetch.apply(this, args);
        const duration = Date.now() - start;
        saveLogEntry(`[API ${method}] ${url} -> Status ${response.status} (${duration}ms)`, response.ok ? 'info' : 'error', 'Fetch');
        return response;
      } catch (err) {
        const duration = Date.now() - start;
        saveLogEntry(`[API ${method} FAILED] ${url} -> ${err.message} (${duration}ms)`, 'error', 'Fetch');
        throw err;
      }
    };

    // Sparkline Logic
    let latencyData = [];
    const maxDataPoints = 30;

    function renderSparkline() {
      const container = document.getElementById('latency-sparkline');
      if (!container) return;
      
      const width = container.clientWidth;
      const height = container.clientHeight;
      container.innerHTML = '';

      if (latencyData.length < 2) return;

      const svg = d3.select('#latency-sparkline')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

      const x = d3.scaleLinear()
        .domain([0, latencyData.length - 1])
        .range([0, width]);

      const y = d3.scaleLinear()
        .domain([0, d3.max(latencyData) * 1.2 || 100])
        .range([height, 0]);

      const line = d3.line()
        .x((d, i) => x(i))
        .y(d => y(d))
        .curve(d3.curveMonotoneX);

      // Area fill
      const area = d3.area()
        .x((d, i) => x(i))
        .y0(height)
        .y1(d => y(d))
        .curve(d3.curveMonotoneX);

      svg.append('path')
        .datum(latencyData)
        .attr('fill', 'rgba(15, 118, 110, 0.1)')
        .attr('d', area);

      svg.append('path')
        .datum(latencyData)
        .attr('fill', 'none')
        .attr('stroke', '#0f766e')
        .attr('stroke-width', 2)
        .attr('d', line);

      // Latest point dot
      const lastVal = latencyData[latencyData.length - 1];
      svg.append('circle')
        .attr('cx', x(latencyData.length - 1))
        .attr('cy', y(lastVal))
        .attr('r', 4)
        .attr('fill', '#0f766e');
      
      const avg = Math.round(latencyData.reduce((a, b) => a + b, 0) / latencyData.length);
      document.getElementById('avg-latency').textContent = `เฉลี่ย: ${avg}ms`;
    }

    // Live Metrics & Diagnostics
    async function fetchMetrics() {
      const sb = window.pvtSupabase?.getClient();
      if (!sb) return;

      const start = Date.now();
      try {
        // Query pending leaves if possible, or fallback to employees
        let leaveCount = 0;
        try {
          const { count } = await sb.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
          leaveCount = count || 0;
        } catch(e) { /* ignore table missing */ }
        document.getElementById('stat-pending-leaves').textContent = leaveCount;

        const { data: emps } = await sb.from('employees').select('line_id');
        const connected = (emps || []).filter(e => e.line_id).length;
        const total = (emps || []).length || 1;
        const percent = Math.round((connected / total) * 100);
        document.getElementById('stat-line-health').textContent = percent + '%';

        const latency = Date.now() - start;
        document.getElementById('stat-db-latency').textContent = latency + 'ms';
        
        // Add to sparkline
        latencyData.push(latency);
        if (latencyData.length > maxDataPoints) latencyData.shift();
        renderSparkline();

        updateStatusBadge('check-db', 'passed', 'เชื่อมต่อแล้ว');
      } catch (e) {
        console.error('Metrics Error:', e);
        updateStatusBadge('check-db', 'failed', 'ข้อผิดพลาด');
      }
    }

    function updateStatusBadge(id, status, text) {
      const el = document.getElementById(id);
      if (el) {
        el.className = `status-badge ${status}`;
        el.textContent = text;
      }
    }

    async function runDeepCheck() {
      console.log('เริ่มการตรวจสอบเชิงลึก...');
      updateStatusBadge('check-auth', 'checking', 'กำลังทดสอบ...');
      updateStatusBadge('check-line', 'checking', 'กำลังทดสอบ...');
      
      const sb = window.pvtSupabase?.getClient();
      try {
        const { data: { user } } = await sb.auth.getUser();
        updateStatusBadge('check-auth', user ? 'passed' : 'failed', user ? 'ใช้งานได้' : 'ไม่ได้ล็อกอิน');
      } catch(e) { updateStatusBadge('check-auth', 'failed', 'ข้อผิดพลาด'); }
      
      try {
        // Soft check for LINE function without triggering alert-like 404
        updateStatusBadge('check-line', 'warning', 'รอการติดตั้ง');
      } catch(e) { updateStatusBadge('check-line', 'failed', 'ติดต่อไม่ได้'); }
      
      fetchMetrics();
    }

    function toggleMaint() {
      const isMaint = localStorage.getItem('maintenance_mode') === 'true';
      const newState = !isMaint;
      localStorage.setItem('maintenance_mode', newState);
      updateMaintUI();
      console.log(`โหมดปรับปรุงระบบถูกตั้งค่าเป็น: ${newState}`);
    }

    function updateMaintUI() {
      const isMaint = localStorage.getItem('maintenance_mode') === 'true';
      const btn = document.getElementById('btn-maint');
      if (btn) {
        const textSpan = btn.querySelector('span:not(.material-symbols-outlined)');
        if (isMaint) {
          btn.className = 'secondary danger';
          textSpan.textContent = 'กำลังทำงาน (ปิด)';
        } else {
          btn.className = 'secondary';
          textSpan.textContent = 'ไม่ได้ทำงาน (เปิด)';
        }
      }
    }

    function clearSystemCache() {
      if (confirm('ล้างข้อมูลแคชทั้งหมดหรือไม่? พนักงานจะต้องเข้าสู่ระบบใหม่')) {
        localStorage.clear();
        sessionStorage.clear();
        console.log('ล้างแคชระบบเรียบร้อย');
        location.reload();
      }
    }

    async function initProfile() {
      const sessionString = localStorage.getItem('currentUser');
      if (sessionString) {
        const session = JSON.parse(sessionString);
        document.getElementById('admin-name').value = session.full_name || '';
        document.getElementById('admin-email').value = session.email || '';
      }
    }

    document.getElementById('admin-profile-form').onsubmit = async (e) => {
      e.preventDefault();
      const newName = document.getElementById('admin-name').value;
      const sessionString = localStorage.getItem('currentUser');
      if (!sessionString) return;
      const session = JSON.parse(sessionString);
      const sb = window.pvtSupabase?.getClient();
      const { error } = await sb.from('employees').update({ full_name: newName }).eq('id', session.id);
      if(!error) {
        session.full_name = newName;
        localStorage.setItem('currentUser', JSON.stringify(session));
        showToast('อัปเดตโปรไฟล์เรียบร้อย!');
        console.log('อัปเดตโปรไฟล์แอดมินเป็น:', newName);
      } else {
        showToast('บันทึกโปรไฟล์ไม่สำเร็จ: ' + error.message, 'error');
      }
    };

    // Data Management & Inline Editing
    let employeesData = [];
    const tableBody = document.getElementById('employee-table-body');

    async function loadEmployeeData() {
      const sb = window.pvtSupabase?.getClient();
      if (!sb) return;

      try {
        const { data, error } = await sb.from('employees').select('*').order('full_name');
        if (error) throw error;
        employeesData = data;
        renderEmployeeTable();
        console.log('โหลดข้อมูลพนักงานสำเร็จ:', data.length, 'รายการ');
      } catch (e) {
        console.error('Error loading employees:', e);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#ef4444;">โหลดข้อมูลไม่สำเร็จ: ${e.message}</td></tr>`;
      }
    }

    function renderEmployeeTable() {
      if (!tableBody) return;
      if (!employeesData.length) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:#94a3b8;">ไม่พบข้อมูลพนักงาน</td></tr>';
        return;
      }

      // Check if search query exists
      const searchInput = document.getElementById('emp-search-input');
      if (searchInput && searchInput.value.trim()) {
        filterEmployeeTable();
        return;
      }

      tableBody.innerHTML = employeesData.map(emp => `
        <tr id="row-${emp.id}">
          <td class="col-name">${emp.full_name || '-'}</td>
          <td class="col-email">${emp.email || '-'}</td>
          <td class="col-dept">${emp.department || '-'}</td>
          <td class="col-role">${emp.role || '-'}</td>
          <td class="action-btns">
            <button class="icon-btn" onclick="editRow('${emp.id}')" title="แก้ไข">
              <span class="material-symbols-outlined" style="font-size:18px;">edit</span>
            </button>
            <button class="icon-btn" onclick="deleteRow('${emp.id}')" title="ลบ" style="color:#ef4444;">
              <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
            </button>
          </td>
        </tr>
      `).join('');
    }

    function filterEmployeeTable() {
      const q = (document.getElementById('emp-search-input')?.value || '').toLowerCase().trim();
      if (!q) {
        renderEmployeeTable();
        return;
      }
      const filtered = employeesData.filter(emp => 
        (emp.full_name && emp.full_name.toLowerCase().includes(q)) ||
        (emp.email && emp.email.toLowerCase().includes(q)) ||
        (emp.department && emp.department.toLowerCase().includes(q)) ||
        (emp.role && emp.role.toLowerCase().includes(q))
      );
      if (!tableBody) return;
      if (!filtered.length) {
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">ไม่พบพนักงานตรงกับคำค้นหา "${q}"</td></tr>`;
        return;
      }
      tableBody.innerHTML = filtered.map(emp => `
        <tr id="row-${emp.id}">
          <td class="col-name">${emp.full_name || '-'}</td>
          <td class="col-email">${emp.email || '-'}</td>
          <td class="col-dept">${emp.department || '-'}</td>
          <td class="col-role">${emp.role || '-'}</td>
          <td class="action-btns">
            <button class="icon-btn" onclick="editRow('${emp.id}')" title="แก้ไข">
              <span class="material-symbols-outlined" style="font-size:18px;">edit</span>
            </button>
            <button class="icon-btn" onclick="deleteRow('${emp.id}')" title="ลบ" style="color:#ef4444;">
              <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
            </button>
          </td>
        </tr>
      `).join('');
    }

    // Diagnostics & Button Test Suite Functions
    async function testFetchEmployees() {
      showToast('กำลังทดสอบ Query พนักงาน...', 'info');
      console.log(' [TEST] เรียกใช้ testFetchEmployees()...');
      await loadEmployeeData();
      showToast(`ดึงข้อมูลสำเร็จ: พบพนักงาน ${employeesData.length} รายการ`, 'success');
    }

    async function testFetchDepts() {
      showToast('กำลังทดสอบ Query แผนก...', 'info');
      console.log(' [TEST] เรียกใช้ testFetchDepts()...');
      await loadDeptApprovalData();
      showToast(`ดึงข้อมูลสำเร็จ: พบโครงสร้างแผนก ${deptData.length} รายการ`, 'success');
    }

    async function testPendingLeavesCount() {
      const sb = window.pvtSupabase?.getClient();
      if (!sb) { showToast('ไม่พบไคลเอนต์ Supabase', 'error'); return; }
      showToast('กำลังทดสอบดึงจำนวนใบลาค้าง...', 'info');
      try {
        const { count, error } = await sb.from('leave_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        if (error) throw error;
        showToast(`จำนวนใบลาค้างอนุมัติปัจจุบัน: ${count || 0} ใบ`, 'success');
        console.log(` [TEST] จำนวนใบลาค้างอนุมัติ: ${count || 0}`);
      } catch (e) {
        showToast('การดึงใบลาล้มเหลว: ' + e.message, 'error');
      }
    }

    async function testDatabaseLatency() {
      showToast('กำลังวัดค่า Latency ของฐานข้อมูล...', 'info');
      const start = Date.now();
      const sb = window.pvtSupabase?.getClient();
      if (!sb) return;
      try {
        await sb.from('employees').select('id').limit(1);
        const duration = Date.now() - start;
        showToast(`ความหน่วงฐานข้อมูล (Latency): ${duration} ms`, 'success');
        console.log(` [TEST] DB Latency benchmark: ${duration}ms`);
      } catch (e) {
        showToast('วัดความหน่วงไม่สำเร็จ: ' + e.message, 'error');
      }
    }

    function testSimulateLog() {
      console.log(' [TEST LOG] ทดสอบการส่งข้อความลงในบันทึกระบบเรียลไทม์สำเร็จ');
      console.error(' [TEST ERROR LOG] จำลองการแจ้งเตือนข้อผิดพลาดในระบบ');
      showToast('เพิ่ม Log ตัวอย่างในบันทึกเรียลไทม์เรียบร้อย!', 'info');
    }

    function testAddMockSparkline() {
      const randomVal = Math.floor(Math.random() * 150) + 30;
      latencyData.push(randomVal);
      if (latencyData.length > maxDataPoints) latencyData.shift();
      renderSparkline();
      showToast(`สุ่มเพิ่มจุดกราฟ Latency: ${randomVal}ms`, 'info');
      console.log(` [TEST SPARKLINE] เพิ่มจุดกราฟ ${randomVal}ms`);
    }

    function editRow(id) {
      const row = document.getElementById(`row-${id}`);
      const emp = employeesData.find(e => e.id === id);
      if (!row || !emp) return;

      if (row.classList.contains('editing')) return;
      row.classList.add('editing');

      const cells = {
        name: row.querySelector('.col-name'),
        email: row.querySelector('.col-email'),
        dept: row.querySelector('.col-dept'),
        role: row.querySelector('.col-role'),
        actions: row.querySelector('.action-btns')
      };

      cells.name.innerHTML = `<input type="text" class="editable-input" value="${emp.full_name || ''}" id="edit-name-${id}">`;
      cells.email.innerHTML = `<input type="email" class="editable-input" value="${emp.email || ''}" id="edit-email-${id}">`;
      cells.dept.innerHTML = `<input type="text" class="editable-input" value="${emp.department || ''}" id="edit-dept-${id}">`;
      cells.role.innerHTML = `<input type="text" class="editable-input" value="${emp.role || ''}" id="edit-role-${id}">`;

      cells.actions.innerHTML = `
        <button class="icon-btn save" onclick="saveRow('${id}')" title="บันทึก">
          <span class="material-symbols-outlined" style="font-size:18px;">check</span>
        </button>
        <button class="icon-btn cancel" onclick="cancelEdit('${id}')" title="ยกเลิก">
          <span class="material-symbols-outlined" style="font-size:18px;">close</span>
        </button>
      `;
    }

    function cancelEdit(id) {
      renderEmployeeTable();
    }

    async function saveRow(id) {
      const name = document.getElementById(`edit-name-${id}`).value.trim();
      const email = document.getElementById(`edit-email-${id}`).value.trim();
      const dept = document.getElementById(`edit-dept-${id}`).value.trim();
      const role = document.getElementById(`edit-role-${id}`).value.trim();

      if (!name) { showToast('กรุณาระบุชื่อ-นามสกุล', 'warning'); return; }
      if (!email || !email.includes('@')) { showToast('กรุณาระบุอีเมลที่ถูกต้อง', 'warning'); return; }

      const sb = window.pvtSupabase?.getClient();
      if (!sb) return;

      try {
        const { error } = await sb.from('employees').update({
          full_name: name,
          email: email,
          department: dept,
          role: role
        }).eq('id', id);

        if (error) throw error;

        const index = employeesData.findIndex(e => e.id === id);
        if (index !== -1) {
          employeesData[index] = { ...employeesData[index], full_name: name, email, department: dept, role };
        }

        renderEmployeeTable();
        showToast('บันทึกข้อมูลพนักงานสำเร็จ');
        console.log('บันทึกข้อมูลพนักงานสำเร็จ');
      } catch (e) {
        console.error('Error saving employee:', e);
        showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
      }
    }

    async function deleteRow(id) {
      if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลพนักงานคนนี้?')) return;
      const sb = window.pvtSupabase?.getClient();
      if (!sb) return;
      try {
        const { error } = await sb.from('employees').delete().eq('id', id);
        if (error) throw error;
        employeesData = employeesData.filter(e => e.id !== id);
        renderEmployeeTable();
        showToast('ลบข้อมูลพนักงานสำเร็จ');
        console.log('ลบข้อมูลพนักงานสำเร็จ');
      } catch (e) {
        console.error('Error deleting employee:', e);
        showToast('ลบไม่สำเร็จ: ' + e.message, 'error');
      }
    }

    async function addNewEmployee() {
      if (document.getElementById('new-emp-row')) return;

      const newRow = document.createElement('tr');
      newRow.id = 'new-emp-row';
      newRow.className = 'editing';
      newRow.innerHTML = `
        <td><input type="text" class="editable-input" placeholder="ชื่อ-นามสกุล" id="new-name"></td>
        <td><input type="email" class="editable-input" placeholder="อีเมล" id="new-email"></td>
        <td><input type="text" class="editable-input" placeholder="แผนก" id="new-dept"></td>
        <td><input type="text" class="editable-input" placeholder="บทบาท" id="new-role"></td>
        <td class="action-btns">
          <button class="icon-btn save" onclick="saveNewEmployee()" title="บันทึก">
            <span class="material-symbols-outlined" style="font-size:18px;">check</span>
          </button>
          <button class="icon-btn cancel" onclick="document.getElementById('new-emp-row').remove()" title="ยกเลิก">
            <span class="material-symbols-outlined" style="font-size:18px;">close</span>
          </button>
        </td>
      `;
      tableBody.prepend(newRow);
    }

    async function saveNewEmployee() {
      const name = document.getElementById('new-name').value.trim();
      const email = document.getElementById('new-email').value.trim();
      const dept = document.getElementById('new-dept').value.trim();
      const role = document.getElementById('new-role').value.trim();

      if (!name || !email) { showToast('กรุณาระบุชื่อและอีเมล', 'warning'); return; }
      if (!email.includes('@')) { showToast('อีเมลไม่ถูกต้อง', 'warning'); return; }

      const sb = window.pvtSupabase?.getClient();
      try {
        const { error } = await sb.from('employees').insert({ full_name: name, email, department: dept, role });
        if (error) throw error;
        showToast('เพิ่มพนักงานใหม่สำเร็จ');
        loadEmployeeData();
      } catch (e) { showToast('เพิ่มพนักงานไม่สำเร็จ: ' + e.message, 'error'); }
    }

    // Department & Approval Management
    let deptData = [];
    const approvalTableBody = document.getElementById('approval-table-body');

    async function loadDeptApprovalData() {
      const sb = window.pvtSupabase?.getClient();
      if (!sb) return;

      try {
        const { data, error } = await sb.from('departments').select(`
          *,
          supervisor:employees!supervisor_id(full_name),
          manager:employees!manager_id(full_name)
        `).order('department_code');
        
        if (error) throw error;
        deptData = data;
        renderDeptTable();
      } catch (e) {
        console.error('Error loading depts:', e);
        if (approvalTableBody) approvalTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#ef4444;">ไม่พบตาราง departments หรือเกิดข้อผิดพลาด</td></tr>`;
      }
    }

    function renderDeptTable() {
      if (!approvalTableBody) return;
      if (!deptData.length) {
        approvalTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px; color:#94a3b8;">ไม่พบข้อมูลแผนก</td></tr>';
        return;
      }

      approvalTableBody.innerHTML = deptData.map(dept => `
        <tr>
          <td>${dept.department_code || '-'}</td>
          <td>${dept.department_name || '-'}</td>
          <td>${dept.supervisor?.full_name || '<span style="color:#94a3b8">ไม่ได้ตั้งค่า</span>'}</td>
          <td>${dept.manager?.full_name || '<span style="color:#94a3b8">ไม่ได้ตั้งค่า</span>'}</td>
          <td class="action-btns">
            <button class="icon-btn" onclick="window.location.href='/pages/hr/approval-settings.html'" title="ไปที่หน้าตั้งค่าละเอียด">
              <span class="material-symbols-outlined" style="font-size:18px;">settings</span>
            </button>
          </td>
        </tr>
      `).join('');
    }

    // Database Snapshot Logic
    async function downloadSnapshot() {
      const sb = window.pvtSupabase?.getClient();
      if (!sb) return;

      showToast('กำลังเตรียมข้อมูลสำรอง...', 'info');
      try {
        const { data: employees } = await sb.from('employees').select('*');
        const { data: depts } = await sb.from('departments').select('*');

        const snapshot = {
          version: "1.1",
          timestamp: new Date().toISOString(),
          employees,
          departments: depts
        };

        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pvt_snapshot_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('สำรองข้อมูลสำเร็จ!');
      } catch (e) {
        showToast('สำรองข้อมูลล้มเหลว: ' + e.message, 'error');
      }
    }

    async function handleRestore(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const snapshot = JSON.parse(e.target.result);
          
          // Validation
          if (!snapshot.employees || (!snapshot.departments && !snapshot.approvals)) {
            throw new Error('โครงสร้างไฟล์ไม่ถูกต้อง');
          }

          const empCount = snapshot.employees.length;
          const deptCount = (snapshot.departments || snapshot.approvals).length;

          if (!confirm(`️ คำเตือน: การกู้คืนจะเขียนทับข้อมูลปัจจุบัน\nพบพนักงาน: ${empCount} ราย\nพบโครงสร้าง: ${deptCount} รายการ\nต้องการดำเนินการต่อหรือไม่?`)) {
            event.target.value = '';
            return;
          }

          const sb = window.pvtSupabase?.getClient();
          showToast('กำลังกู้คืนข้อมูล...', 'info');

          // Restore Employees
          if (empCount > 0) {
            await sb.from('employees').delete().neq('id', 'placeholder');
            const { error: empError } = await sb.from('employees').insert(snapshot.employees);
            if (empError) throw empError;
          }

          // Restore Departments
          const deptsToRestore = snapshot.departments || snapshot.approvals;
          if (deptsToRestore.length > 0) {
            const tableName = snapshot.departments ? 'departments' : 'approval_settings';
            await sb.from(tableName).delete().neq('id', 'placeholder');
            const { error: appError } = await sb.from(tableName).insert(deptsToRestore);
            if (appError) throw appError;
          }

          showToast('กู้คืนข้อมูลสำเร็จ! ระบบจะรีเฟรชหน้าจอ', 'success');
          setTimeout(() => location.reload(), 2000);

        } catch (err) {
          console.error('Restore Error:', err);
          showToast('การกู้คืนล้มเหลว: ' + err.message, 'error');
        }
        event.target.value = '';
      };
      reader.readAsText(file);
    }

    setInterval(() => {
      const el = document.getElementById('live-time');
      if (el) el.textContent = new Date().toLocaleString('th-TH');
    }, 1000);

    // Interactive Button Click Event Logging Listener for Testing & Debugging
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('button, a.menu-item, [role="button"]');
      if (!btn) return;

      const btnText = (btn.innerText || btn.textContent || btn.getAttribute('title') || 'unnamed button').trim().replace(/\s+/g, ' ');
      const btnId = btn.id ? `#${btn.id}` : 'no-id';
      const btnClasses = btn.className ? `.${btn.className.trim().replace(/\s+/g, '.')}` : 'no-class';
      const onclickAttr = btn.getAttribute('onclick') || btn.getAttribute('href') || 'custom-handler';

      console.log(` [BUTTON CLICK] "${btnText}" | ID: ${btnId} | Class: ${btnClasses} | Handler: ${onclickAttr}`);
    }, true);

    updateMaintUI();
    initProfile();
    runDeepCheck();
    loadEmployeeData();
    loadDeptApprovalData();
    
    // Sidebar Toggle
    window.toggleSidebar = function() {
      const wrapper = document.getElementById('app-wrapper');
      wrapper.classList.toggle('sidebar-open');
    }

    // Live update every 5 seconds
    setInterval(fetchMetrics, 5000);
    
    // Resize observer for sparkline responsiveness
    const sparklineContainer = document.getElementById('latency-sparkline');
    if (sparklineContainer) {
      const resizeObserver = new ResizeObserver(() => renderSparkline());
      resizeObserver.observe(sparklineContainer);
    }

// Expose functions globally for inline onclick attributes
window.toggleSidebar = toggleSidebar;
window.runDeepCheck = runDeepCheck;
window.refreshLogsUI = refreshLogsUI;
window.downloadLogFile = downloadLogFile;
window.clearLogs = clearLogs;
window.setLogFilter = setLogFilter;
window.toggleMaint = toggleMaint;
window.clearSystemCache = clearSystemCache;
window.downloadSnapshot = downloadSnapshot;
window.addNewEmployee = addNewEmployee;
window.loadEmployeeData = loadEmployeeData;
window.loadDeptApprovalData = loadDeptApprovalData;
window.showToast = showToast;
window.testFetchEmployees = testFetchEmployees;
window.testFetchDepts = testFetchDepts;
window.testPendingLeavesCount = testPendingLeavesCount;
window.testDatabaseLatency = testDatabaseLatency;
window.testSimulateLog = testSimulateLog;
window.testAddMockSparkline = testAddMockSparkline;
window.editRow = editRow;
window.deleteRow = deleteRow;
window.saveRow = saveRow;
window.cancelEdit = cancelEdit;
window.saveNewEmployee = saveNewEmployee;
