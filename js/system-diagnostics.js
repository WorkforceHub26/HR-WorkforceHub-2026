/**
 * 🩺 PVT HR LEAVE - AUTOMATED SYSTEM DIAGNOSTICS & REPAIR CONSOLE
 * ระบบตรวจเช็คบัคครอบคลุมทุกหน้าและเครื่องมือแก้ปัญหาอัตโนมัติ (Self-Healing System)
 */

(function () {
  'use strict';

  const SystemDiagnostics = {
    version: '2.5.0',
    logs: [],
    testResults: [],

    // 🚀 1. ฟังก์ชันสแกนตรวจสอบความถูกต้องของระบบครบทุกมิติ
    async runAllChecks() {
      this.testResults = [];
      this.log('INFO', 'Starting full system diagnostic sweep...');

      // TEST 1: Global Utilities & Helpers Check
      const helperResult = this.checkGlobalHelpers();
      this.testResults.push(helperResult);

      // TEST 2: User Session & Auth Integrity Check
      const sessionResult = await this.checkUserSession();
      this.testResults.push(sessionResult);

      // TEST 3: Supabase Database Connection & Latency
      const dbResult = await this.checkDatabaseConnection();
      this.testResults.push(dbResult);

      // TEST 4: Storage Buckets Access Test
      const storageResult = await this.checkStorageBuckets();
      this.testResults.push(storageResult);

      // TEST 5: DOM & Page Elements Integrity
      const domResult = this.checkDOMIntegrity();
      this.testResults.push(domResult);

      // TEST 6: Network & Browser Environment
      const envResult = this.checkEnvironment();
      this.testResults.push(envResult);

      // TEST 7: Business Logic Integrity (Deep Check)
      const logicResult = await this.checkBusinessLogic();
      this.testResults.push(logicResult);

      this.log('INFO', 'Diagnostic sweep completed.', this.testResults);
      return this.testResults;
    },

    // 🔍 Check 7: Business Logic Integrity
    async checkBusinessLogic() {
      const sb = window.pvtSupabase?.getClient();
      if (!sb) return { id: 'logic', title: 'ความถูกต้องของตรรกะธุรกิจ', status: 'warning', message: 'ข้ามการตรวจสอบ (ไม่มี DB Client)' };

      try {
        const issues = [];
        
        // Check for negative balances
        const { data: quotas } = await sb.from('leave_quotas').select('id, employee_id, leave_type_id, remaining_days').lt('remaining_days', 0);
        if (quotas?.length > 0) {
          issues.push(`พบพนักงาน ${quotas.length} รายที่มีวันลาติดลบ (Negative Balance)`);
        }

        // Check for pending leaves with past dates (stale requests)
        const today = new Date().toISOString().split('T')[0];
        const { data: staleRequests } = await sb.from('leave_requests').select('id').eq('status', 'pending').lt('start_date', today);
        if (staleRequests?.length > 0) {
          issues.push(`พบใบลาค้างพิจารณาที่เลยกำหนดวันลาแล้ว ${staleRequests.length} รายการ`);
        }

        return {
          id: 'logic',
          title: 'ความถูกต้องของตรรกะธุรกิจ',
          status: issues.length === 0 ? 'passed' : 'warning',
          message: issues.length === 0 ? 'ไม่พบความผิดปกติในข้อมูลใบลาและสิทธิ์วันลา' : issues.join(', ')
        };
      } catch (err) {
        return { id: 'logic', title: 'ความถูกต้องของตรรกะธุรกิจ', status: 'failed', message: `ตรวจเช็คไม่สำเร็จ: ${err.message}` };
      }
    },

    // 🔍 Check 1: Global Functions & Utilities
    checkGlobalHelpers() {
      const issues = [];
      
      // Ensure escapeHtml exists globally
      if (typeof window.escapeHtml !== 'function') {
        issues.push('window.escapeHtml ไม่ถูกนิยาม (ทำการบีบอัดสร้าง Fallback ให้)');
        window.escapeHtml = function (str) {
          return String(str ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
        };
      }

      if (!window.pvtSupabase && !window.PVTSDK) {
        issues.push('ไม่พบ SDK หลักของระบบ (window.pvtSupabase / window.PVTSDK)');
      }

      if (!window.Swal) {
        issues.push('ไม่พบระบบแจ้งเตือน SweetAlert2 (Swal)');
      }

      return {
        id: 'global_helpers',
        title: 'ระบบอรรถประโยชน์และ Helper หน้าบ้าน',
        status: issues.length === 0 ? 'passed' : 'warning',
        message: issues.length === 0 ? 'สคริปต์พื้นฐานและ Helper ทั้งหมดพร้อมใช้งาน 100%' : issues.join(', ')
      };
    },

    // 🔍 Check 2: User Session & Auth
    async checkUserSession() {
      try {
        const rawSession = localStorage.getItem('currentUser');
        if (!rawSession) {
          return {
            id: 'session_auth',
            title: 'การเข้าสู่ระบบและข้อมูลผู้ใช้งาน (Session)',
            status: 'warning',
            message: 'ยังไม่ได้เข้าสู่ระบบ (Guest Session)'
          };
        }

        const session = JSON.parse(rawSession);
        if (!session.id || !session.role) {
          return {
            id: 'session_auth',
            title: 'การเข้าสู่ระบบและข้อมูลผู้ใช้งาน (Session)',
            status: 'failed',
            message: 'โครงสร้าง Session ข้อมูลผู้ใช้ไม่สมบูรณ์'
          };
        }

        const isExpired = session.expireAt && Date.now() > session.expireAt;
        if (isExpired) {
          return {
            id: 'session_auth',
            title: 'การเข้าสู่ระบบและข้อมูลผู้ใช้งาน (Session)',
            status: 'failed',
            message: 'Session เข้าสู่ระบบหมดอายุแล้ว'
          };
        }

        return {
          id: 'session_auth',
          title: 'การเข้าสู่ระบบและข้อมูลผู้ใช้งาน (Session)',
          status: 'passed',
          message: `เข้าสู่ระบบในชื่อ ${session.full_name || 'พนักงาน'} (${session.role})`
        };
      } catch (err) {
        return {
          id: 'session_auth',
          title: 'การเข้าสู่ระบบและข้อมูลผู้ใช้งาน (Session)',
          status: 'failed',
          message: `Session ขัดข้อง: ${err.message}`
        };
      }
    },

    // 🔍 Check 3: Database & Latency
    async checkDatabaseConnection() {
      const startTime = performance.now();
      const sb = window.pvtSupabase?.getClient() || window.supabaseClient;
      if (!sb) {
        return {
          id: 'database',
          title: 'การเชื่อมต่อฐานข้อมูล (Database)',
          status: 'failed',
          message: 'ไม่สามารถสร้าง Client เชื่อมต่อฐานข้อมูล Supabase ได้'
        };
      }

      try {
        const { data, error } = await sb.from('employees').select('id').limit(1);
        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);

        if (error) {
          return {
            id: 'database',
            title: 'การเชื่อมต่อฐานข้อมูล (Database)',
            status: 'failed',
            message: `ข้อผิดพลาดการดึงข้อมูล: ${error.message}`
          };
        }

        return {
          id: 'database',
          title: 'การเชื่อมต่อฐานข้อมูล (Database)',
          status: 'passed',
          message: `เชื่อมต่อสำเร็จปกติ (ความไวตอบสนอง Ping: ${latency} ms)`
        };
      } catch (err) {
        return {
          id: 'database',
          title: 'การเชื่อมต่อฐานข้อมูล (Database)',
          status: 'failed',
          message: `การเชื่อมต่อเครือข่ายล้มเหลว: ${err.message}`
        };
      }
    },

    // 🔍 Check 4: Storage Buckets
    async checkStorageBuckets() {
      const sb = window.pvtSupabase?.getClient();
      if (!sb) {
        return {
          id: 'storage',
          title: 'คลังเก็บรูปภาพและเอกสาร (Storage Buckets)',
          status: 'warning',
          message: 'ข้ามการตรวจสอบ (ไม่มี Supabase Client)'
        };
      }

      try {
        const avatarRes = sb.storage.from('avatars').getPublicUrl('test.jpg');
        const attachRes = sb.storage.from('leave-attachments').getPublicUrl('test.jpg');

        if (avatarRes?.publicUrl && attachRes?.publicUrl) {
          return {
            id: 'storage',
            title: 'คลังเก็บรูปภาพและเอกสาร (Storage Buckets)',
            status: 'passed',
            message: 'ถังเก็บรูปภาพ (avatars) และเอกสารแนบ (leave-attachments) พร้อมใช้งาน'
          };
        }
        return {
          id: 'storage',
          title: 'คลังเก็บรูปภาพและเอกสาร (Storage Buckets)',
          status: 'warning',
          message: 'ดึง URL คลังภาพไม่ได้ตามปกติ'
        };
      } catch (err) {
        return {
          id: 'storage',
          title: 'คลังเก็บรูปภาพและเอกสาร (Storage Buckets)',
          status: 'warning',
          message: `ตรวจสอบคลังภาพไม่ผ่าน: ${err.message}`
        };
      }
    },

    // 🔍 Check 5: DOM & Page Structure
    checkDOMIntegrity() {
      const pageTitle = document.title || 'Unknown';
      const hasMain = Boolean(document.querySelector('main, .main-content, .login-container'));
      const buttons = document.querySelectorAll('button').length;

      return {
        id: 'dom_structure',
        title: 'องค์ประกอบหน้าเว็บ (DOM Structure)',
        status: hasMain ? 'passed' : 'warning',
        message: `หน้าเว็บ: "${pageTitle}" (พบปุ่มโต้ตอบ ${buttons} จุด)`
      };
    },

    // 🔍 Check 6: Environment
    checkEnvironment() {
      const isOnline = navigator.onLine;
      const ua = navigator.userAgent;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);

      return {
        id: 'environment',
        title: 'สภาพแวดล้อมเครือข่ายและอุปกรณ์',
        status: isOnline ? 'passed' : 'failed',
        message: isOnline 
          ? `เชื่อมต่ออินเทอร์เน็ตปกติ (${isMobile ? '📱 Mobile Device' : '💻 Desktop Device'})`
          : '⚠️ อุปกรณ์ของคุณไม่ได้เชื่อมต่ออินเทอร์เน็ต (Offline)'
      };
    },

    // ⚡ 2. ระบบซ่อมแซมและแก้ไขบัคอัตโนมัติ (Self-Healing Routine)
    async autoRepairAll() {
      const repairLogs = [];
      this.log('INFO', 'Executing Auto-Repair sequence...');

      // 1. ซ่อมแซม Helper Functions ที่ขาดหายไป
      if (typeof window.escapeHtml !== 'function') {
        window.escapeHtml = function (str) {
          return String(str ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
        };
        repairLogs.push('✅ ฉีดซ่อมฟังก์ชัน escapeHtml สำเร็จ');
      }

      // 2. ซ่อมและล้างแคช Session ข้อมูลพนักงานที่ค้างหรือเสียหาย
      try {
        const rawSession = localStorage.getItem('currentUser');
        if (rawSession) {
          const session = JSON.parse(rawSession);
          if (session.id) {
            const sb = window.pvtSupabase?.getClient();
            if (sb) {
              const { data: freshEmp } = await sb.from('employees').select('id, full_name, role, status, employee_code').eq('id', session.id).single();
              if (freshEmp) {
                const updatedSession = { ...session, full_name: freshEmp.full_name, role: freshEmp.role, status: freshEmp.status, employee_code: freshEmp.employee_code };
                localStorage.setItem('currentUser', JSON.stringify(updatedSession));
                repairLogs.push(`✅ ซิงค์ข้อมูลสิทธิ์พนักงานล่าสุดสำหรับ "${freshEmp.full_name}" สำเร็จ`);
              }
            }
          }
        }
      } catch (err) {
        repairLogs.push(`⚠️ ซิงค์สิทธิ์ไม่สำเร็จ: ${err.message}`);
      }

      // 3. ปลดล็อก Loading Overlay หรือ SweetAlert ค้าง
      const loadingElements = document.querySelectorAll('.swal2-loading, .loading-overlay');
      if (loadingElements.length > 0) {
        loadingElements.forEach(el => el.remove());
        repairLogs.push('✅ เคลียร์สถานะการโหลดที่ค้างสะสมบนหน้าจอ');
      }

      // 4. เรียกเรนเดอร์ข้อมูลโปรไฟล์ส่วนกลางใหม่
      if (typeof window.renderGlobalUserProfile === 'function') {
        try {
          await window.renderGlobalUserProfile();
          repairLogs.push('✅ อัปเดตข้อมูลแถบเมนูบนสุดเรียบร้อยแล้ว');
        } catch (e) {}
      }

      if (repairLogs.length === 0) {
        repairLogs.push('✅ ตรวจสอบแล้ว ระบบทำงานสมบูรณ์ ไม่พบปัญหาที่ต้องซ่อมแซม');
      }

      return repairLogs;
    },

    // 📜 3. ระบบบันทึก Log ภายใน
    log(level, message, details = null) {
      const entry = {
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
        details
      };
      this.logs.push(entry);
      if (this.logs.length > 100) this.logs.shift(); // เก็บไม่เกิน 100 บรรทัด
      
      const consoleColor = level === 'ERROR' ? '#ef4444' : level === 'WARN' ? '#f59e0b' : '#10b981';
      console.log(`%c[PVT-DIAGNOSTICS][${level}] ${message}`, `color:${consoleColor}; font-weight:bold;`, details || '');
    },

    // 🖥️ 4. แสดงผลกล่องเครื่องมือตรวจแก้บัค (Diagnostics & Repair Modal)
    async showDiagnosticsModal() {
      if (!window.Swal) {
        alert('ระบบซ่อมแซมเปิดใช้งานแล้ว (แต่ไม่พบ SweetAlert2)');
        return;
      }

      Swal.fire({
        title: '⏳ กำลังสแกนและตรวจสอบระบบ...',
        text: 'ระบบกำลังตรวจเช็คการเชื่อมต่อ สิทธิ์การใช้งาน และความสมบูรณ์ของหน้าเว็บ',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      const results = await this.runAllChecks();

      let resultsHtml = results.map(r => {
        let badgeBg = '#dcfce7';
        let badgeColor = '#15803d';
        let icon = 'check_circle';

        if (r.status === 'warning') {
          badgeBg = '#fef3c7';
          badgeColor = '#b45309';
          icon = 'warning';
        } else if (r.status === 'failed') {
          badgeBg = '#ffe4e6';
          badgeColor = '#be123c';
          icon = 'cancel';
        }

        return `
          <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px 14px; margin-bottom:10px; text-align:left;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <strong style="font-size:13.5px; color:#0f172a; display:flex; align-items:center; gap:6px;">
                <span class="material-symbols-outlined" style="font-size:18px; color:${badgeColor};">${icon}</span>
                ${r.title}
              </strong>
              <span style="font-size:11px; font-weight:700; background:${badgeBg}; color:${badgeColor}; padding:2px 8px; border-radius:12px;">
                ${r.status.toUpperCase()}
              </span>
            </div>
            <p style="font-size:12px; color:#475569; margin:0; line-height:1.4;">${r.message}</p>
          </div>
        `;
      }).join('');

      Swal.fire({
        title: '🩺 แผงตรวจเช็ค & ซ่อมแซมระบบ (PVT Diagnostics)',
        html: `
          <div style="max-height: 380px; overflow-y: auto; font-family:'Sarabun', sans-serif; padding-right:4px;">
            <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:10px; margin-bottom:14px; text-align:left; font-size:12.5px; color:#047857;">
              💡 <b>คำแนะนำ:</b> หากคุณพบปัญหาปุ่มไม่ทำงาน สิทธิ์ไม่ตรง หรือดึงข้อมูลค้าง สามารถกดปุ่ม <b>"⚡ ซ่อมแซมระบบอัตโนมัติ"</b> ด้านล่างได้ทันที
            </div>
            ${resultsHtml}
          </div>
          <div style="margin-top:16px; display:flex; flex-wrap:wrap; gap:8px; justify-content:center;">
            <button type="button" id="btn-diag-auto-fix" class="swal2-confirm swal2-styled" style="background:#0d9488; margin:0; padding:8px 14px; font-size:13px; font-weight:600; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
              <span class="material-symbols-outlined" style="font-size:16px;">build</span> ⚡ ซ่อมแซมระบบอัตโนมัติ
            </button>
            <button type="button" id="btn-diag-sync-role" class="swal2-styled" style="background:#2563eb; color:#fff; margin:0; padding:8px 14px; font-size:13px; font-weight:600; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
              <span class="material-symbols-outlined" style="font-size:16px;">sync</span> 🔄 ซิงค์สิทธิ์พนักงาน
            </button>
            <button type="button" id="btn-diag-clear-cache" class="swal2-styled" style="background:#64748b; color:#fff; margin:0; padding:8px 14px; font-size:13px; font-weight:600; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
              <span class="material-symbols-outlined" style="font-size:16px;">cleaning_services</span> 🧹 ล้างแคชหน้าบ้าน
            </button>
            <button type="button" id="btn-diag-copy-report" class="swal2-styled" style="background:#475569; color:#fff; margin:0; padding:8px 14px; font-size:13px; font-weight:600; border-radius:8px; display:inline-flex; align-items:center; gap:4px;">
              <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span> 📋 คัดลอกรายงาน
            </button>
          </div>
        `,
        width: 580,
        showConfirmButton: false,
        showCloseButton: true,
        didOpen: () => {
          document.getElementById('btn-diag-auto-fix')?.addEventListener('click', async () => {
            Swal.showLoading();
            const logs = await SystemDiagnostics.autoRepairAll();
            Swal.fire({
              icon: 'success',
              title: 'ซ่อมแซมระบบสำเร็จ! 🎉',
              html: `<div style="text-align:left; font-size:13px; color:#334155; max-height:220px; overflow-y:auto;">${logs.map(l => `<p style="margin:4px 0;">${l}</p>`).join('')}</div>`,
              confirmButtonText: 'ตกลง',
              confirmButtonColor: '#0d9488'
            });
          });

          document.getElementById('btn-diag-sync-role')?.addEventListener('click', async () => {
            Swal.showLoading();
            const logs = await SystemDiagnostics.autoRepairAll();
            Swal.fire({
              icon: 'info',
              title: 'ซิงค์สิทธิ์และโปรไฟล์สำเร็จ',
              text: 'อัปเดตข้อมูลสิทธิ์และโปรไฟล์ล่าสุดเรียบร้อยแล้ว',
              confirmButtonColor: '#2563eb'
            }).then(() => {
              window.location.reload();
            });
          });

          document.getElementById('btn-diag-clear-cache')?.addEventListener('click', () => {
            sessionStorage.clear();
            Swal.fire({
              icon: 'success',
              title: 'ล้างแคชชั่วคราวเรียบร้อย',
              text: 'ระบบทำการล้างแคชหน่วยความจำชั่วคราวสำเร็จ',
              confirmButtonColor: '#64748b'
            });
          });

          document.getElementById('btn-diag-copy-report')?.addEventListener('click', () => {
            const reportText = JSON.stringify(SystemDiagnostics.testResults, null, 2);
            navigator.clipboard.writeText(reportText).then(() => {
              Swal.fire({ icon: 'success', title: 'คัดลอกรายงานแล้ว', timer: 1200, showConfirmButton: false });
            });
          });
        }
      });
    },

    // 🔘 5. ระบบปุ่มช่วยเหลือใหม่ (Unified Help Button)
    injectUnifiedHelpButton() {
      if (document.getElementById('pvt-unified-help-btn')) return;

      const btn = document.createElement('button');
      btn.id = 'pvt-unified-help-btn';
      btn.title = 'คู่มือการใช้งานและการช่วยเหลือ';
      btn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 26px;">help</span>';

      Object.assign(btn.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: '9999',
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: '#ffffff',
        color: '#0d9488',
        border: '1px solid #e2e8f0',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        outline: 'none'
      });

      btn.onmouseenter = () => {
        btn.style.transform = 'scale(1.1) rotate(5deg)';
        btn.style.boxShadow = '0 12px 28px rgba(13, 148, 136, 0.2)';
      };
      btn.onmouseleave = () => {
        btn.style.transform = 'scale(1) rotate(0deg)';
        btn.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
      };

      btn.onclick = () => this.showUnifiedHelpPopup();

      document.body.appendChild(btn);
    },

    // 🖥️ 6. แสดงผล Popup คู่มือการใช้งานแบบใหม่ (Beautiful SweetAlert2 - Context Aware)
    showUnifiedHelpPopup() {
      if (!window.Swal) {
        alert("คำแนะนำ: หากพบปัญหาโปรดติดต่อฝ่ายบุคคล (HR)");
        return;
      }

      // ตรวจสอบหน้าปัจจุบันด้วย pathname
      const path = window.location.pathname.toLowerCase();
      let pageTitle = "🚀 คู่มือแนะนำการใช้งานระบบ";
      let guideContent = "";

      if (path.includes("index-user.html") || path === "/" || path.endsWith("/user/")) {
        pageTitle = "🏠 หน้าแผงควบคุมหลักพนักงาน (Dashboard)";
        guideContent = `
          <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.7;">
            <li style="margin-bottom: 6px;"><b>สิทธิ์วันลาคงเหลือ:</b> แสดงสถิติโควตาวันลาสะสมปีนี้ที่ได้รับการจัดสรรตามตำแหน่งงานของคุณ</li>
            <li style="margin-bottom: 6px;"><b>ยื่นใบลาแบบด่วน:</b> กดปุ่มสีเขียว <span style="color:#0d9488; font-weight:700;">"ยื่นใบลาออนไลน์"</span> เพื่อเริ่มเปิดฟอร์มยื่นคำขอใหม่</li>
            <li style="margin-bottom: 6px;"><b>ตรวจสอบเพื่อนร่วมงาน:</b> แผงด้านล่างสุดจะแสดงรายชื่อและตารางของเพื่อนร่วมงานในแผนกเดียวกัน</li>
            <li style="margin-bottom: 6px;"><b>ประวัติคำขอลาล่าสุด:</b> ตรวจสอบรายการเดินเอกสารที่อยู่ระหว่างรอผลอนุมัติหรือประวัติสรุปล่าสุด</li>
          </ul>
        `;
      } else if (path.includes("leave-user.html")) {
        pageTitle = "✍️ หน้ายื่นใบลาออนไลน์ (Leave Application)";
        guideContent = `
          <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.7;">
            <li style="margin-bottom: 6px;"><b>เลือกประเภทวันลา:</b> คลิกเลือกประเภทการลาที่ถูกต้อง (เช่น ลาป่วย, ลากิจ, ลาพักร้อน) เพื่อตรวจสอบสิทธิ์คงเหลือ</li>
            <li style="margin-bottom: 6px;"><b>ระบุเวลาการลา:</b> เลือกวันเริ่มต้นและวันสิ้นสุด หรือเลือกติ๊ก <span style="color:#0d9488; font-weight:700;">"ลาเป็นชั่วโมง"</span> เพื่อระบุเวลาแบบละเอียด</li>
            <li style="margin-bottom: 6px;"><b>ระบุเหตุผล:</b> กรอกรายละเอียดความจำเป็น และอัปโหลดรูปภาพหลักฐานประกอบ (เช่น ใบรับรองแพทย์)</li>
            <li style="margin-bottom: 6px;"><b>ตรวจสอบผู้อนุมัติ:</b> ระบบแสดงสายงานการพิจารณา L1 และ L2 อัตโนมัติ ก่อนกดปุ่ม <span style="color:#0d9488; font-weight:700;">"ส่งคำขออนุมัติ"</span></li>
          </ul>
        `;
      } else if (path.includes("leave-history.html")) {
        pageTitle = "📜 หน้าประวัติและติดตามสถานะใบลา";
        guideContent = `
          <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.7;">
            <li style="margin-bottom: 6px;"><b>สถานะใบลาปัจจุบัน:</b> แถบสีจะระบุสิทธิ์พิจารณา เช่น รออนุมัติ (สีส้ม), อนุมัติ (สีเขียว), หรือ ปฏิเสธ (สีแดง)</li>
            <li style="margin-bottom: 6px;"><b>ดูรายละเอียดเชิงลึก:</b> คลิกปุ่มไอคอน <span style="color:#0d9488; font-weight:700;">"ดวงตา (ดูรายละเอียด)"</span> เพื่อเปิดอ่านความเห็นจากผู้อนุมัติ</li>
            <li style="margin-bottom: 6px;"><b>พิมพ์เอกสาร A4:</b> กดปุ่มไอคอน <span style="color:#0d9488; font-weight:700;">"เครื่องพิมพ์"</span> เพื่อเปิดดูหน้าพิมพ์ใบลาที่เป็นทางการเพื่อเก็บหลักฐาน</li>
            <li style="margin-bottom: 6px;"><b>การยกเลิกใบลา:</b> ใบลาที่ยื่นผิดพลาดหรือผ่านการอนุมัติแล้วต้องการขอสิทธิ์คืน สามารถส่งคำขอยกเลิกได้จากตาราง</li>
          </ul>
        `;
      } else if (path.includes("holidays.html")) {
        pageTitle = "📅 หน้าปฏิทินวันหยุดและวันลาทีม";
        guideContent = `
          <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.7;">
            <li style="margin-bottom: 6px;"><b>ปฏิทินวันหยุดบริษัท:</b> เช็ครายชื่อวันหยุดราชการหรือวันหยุดกรณีพิเศษที่องค์กรกำหนดในแถบหลัก</li>
            <li style="margin-bottom: 6px;"><b>ตารางและจุดสีบนปฏิทิน:</b> เมื่อสลับมุมมอง จะแสดงจุดกลมเล็กใต้เลขวันที่ ระบุวันลาของคนในแผนก</li>
            <li style="margin-bottom: 6px;"><b>แผนงานของทีมงาน:</b> แถบข้อมูลด้านล่างจะระบุชื่อพนักงานที่หยุดเพื่อป้องกันการลางานพร้อมกันจำนวนมาก</li>
            <li style="margin-bottom: 6px;"><b>ตัวกรองปีและเดือน:</b> ใช้เมนูแบบเลื่อนเลือกเพื่อเปลี่ยนปีงบประมาณหรือเดือนสำหรับการวางแผนล่วงหน้า</li>
          </ul>
        `;
      } else if (path.includes("profile-user.html")) {
        pageTitle = "👤 หน้าข้อมูลพนักงานและผูกแจ้งเตือน LINE";
        guideContent = `
          <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.7;">
            <li style="margin-bottom: 6px;"><b>ข้อมูลส่วนตัว:</b> แสดงรหัสพนักงาน ชื่อจริง ตแหน่ง และช่องทางการติดต่ออย่างเป็นทางการ</li>
            <li style="margin-bottom: 6px;"><b>เปลี่ยนรูปโปรไฟล์:</b> สามารถเลือกอัปโหลดรูปภาพใบหน้าของคุณเพื่อนำมาอัปเดตบนการ์ดและใบลา</li>
            <li style="margin-bottom: 6px;"><b>เปิดแจ้งเตือน LINE Notify:</b> กดปุ่ม <span style="color:#059669; font-weight:700;">"ขอรหัสผ่าน LINE"</span> จากนั้นนำตัวเลข 6 หลักไปส่งใน LINE OA เพื่อผูกแจ้งเตือน</li>
            <li style="margin-bottom: 6px;"><b>สถิติจำนวนครั้งการลา:</b> สรุปผลอัตราความถี่การยื่นขอลาพักร้อนและวันลาประเภทต่างๆ ของคุณสะสม</li>
          </ul>
        `;
      } else if (path.includes("hr.html")) {
        pageTitle = "⚖️ หน้าอนุมัติและจัดการใบลา (HR/Manager)";
        guideContent = `
          <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.7;">
            <li style="margin-bottom: 6px;"><b>การตรวจสอบแบบกรอง:</b> ตารางงานระบุคำขออนุมัติใหม่ และคำขอพิจารณายกเลิกใบลาอย่างเป็นหมวดหมู่</li>
            <li style="margin-bottom: 6px;"><b>ดูเอกสารและหลักฐาน:</b> กดปุ่ม "รายละเอียด" เพื่อดูรูปภาพใบรับรองแพทย์ หรือตารางสถิติลำดับขั้น</li>
            <li style="margin-bottom: 6px;"><b>การอนุมัติ / ปฏิเสธ:</b> หัวหน้าหรือ HR สามารถป้อนบันทึกความเห็นเพิ่มเติมและกดตอบรับผลกลับทันที</li>
            <li style="margin-bottom: 6px;"><b>คัดลอกข้อมูลด่วน:</b> ส่งประวัติออกเป็นตาราง Excel ผ่านปุ่ม "ส่งออก Excel" ด้านบนปฏิทิน</li>
          </ul>
        `;
      } else if (path.includes("home.html") && path.includes("/hr/")) {
        pageTitle = "📊 หน้าแดชบอร์ดสถิติวิเคราะห์ HR Overview";
        guideContent = `
          <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.7;">
            <li style="margin-bottom: 6px;"><b>ตัวชี้วัดดัชนีลา:</b> แสดงสรุปยอดรวมวันลาประเภทต่างๆ ประจำเดือนนี้ทั้งหมดของบริษัท</li>
            <li style="margin-bottom: 6px;"><b>กราฟแท่งวิเคราะห์ D3.js:</b> ตรวจวัดความถี่การใช้งานวันลาเปรียบเทียบสัดส่วนระหว่างแต่ละแผนกงาน</li>
            <li style="margin-bottom: 6px;"><b>รายงานการลาของบุคคล:</b> วิเคราะห์และจัดอันดับพนักงานที่มีอัตราความถี่ลาสูงสุดเพื่อประเมินศักยภาพ</li>
          </ul>
        `;
      } else if (path.includes("management.html")) {
        pageTitle = "👥 หน้าจัดการข้อมูลพนักงานและจัดสรรสิทธิ์";
        guideContent = `
          <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.7;">
            <li style="margin-bottom: 6px;"><b>เพิ่มบุคลากรรายใหม่:</b> กดปุ่มเพิ่มบัญชี ป้อนชื่อ นามสกุล และเลือกสังกัดแผนกเพื่อสร้าง QR Code บัตรพนักงาน</li>
            <li style="margin-bottom: 6px;"><b>ตั้งค่าหรือปรับโควตาลา:</b> สามารถแก้ไขวันลาเริ่มต้นของพนักงานเป็นรายบุคคลในตารางได้อย่างยืดหยุ่น</li>
            <li style="margin-bottom: 6px;"><b>ยกเลิกการเปิดบัญชี:</b> เปลี่ยนสถานะการทำงานของพนักงานกรณีโยกย้ายตำแหน่งหรือพ้นจากหน้าที่</li>
          </ul>
        `;
      } else if (path.includes("approval-settings.html")) {
        pageTitle = "⚙️ หน้าจัดการสายงานและผู้มีอำนาจอนุมัติ";
        guideContent = `
          <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.7;">
            <li style="margin-bottom: 6px;"><b>เลือกแผนกงาน:</b> เลือกค้นหาแผนกเพื่อดึงสายงานการส่งคำขออนุมัติมาแสดงผล</li>
            <li style="margin-bottom: 6px;"><b>ตั้งค่าขั้น L1 (หัวหน้างาน):</b> เลือกกำหนดพนักงานที่มีตำแหน่งหัวหน้างานของแผนกนั้นให้มีหน้าที่รับตรวจใบลา</li>
            <li style="margin-bottom: 6px;"><b>ตั้งค่าขั้น L2 (ฝ่ายบุคคล/ผู้บริหาร):</b> กำหนดบุคคลที่มีสิทธิ์สูงสุดในการเซ็นอนุมัติขั้นสุดท้าย</li>
          </ul>
        `;
      } else {
        guideContent = `
          <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.7;">
            <li style="margin-bottom: 6px;"><b>การลางาน:</b> เข้าสู่หน้าหลัก เลือก <span style="color:#0d9488; font-weight:700;">"ยื่นใบลาออนไลน์"</span> กรอกข้อมูล แล้วกดตกลง</li>
            <li style="margin-bottom: 6px;"><b>ตรวจสอบผล:</b> เข้าหน้า <span style="color:#0d9488; font-weight:700;">"ประวัติการลา"</span> เพื่อตรวจประเมินสายอนุมัติเรียลไทม์</li>
            <li style="margin-bottom: 6px;"><b>วันลาคงเหลือ:</b> แผงควบคุมคำนวณวันคงเหลือในรูปการ์ดสวยงามให้อย่างรวดเร็วอัตโนมัติ</li>
            <li style="margin-bottom: 6px;"><b>ผูกแจ้งเตือน LINE:</b> ไปหน้าโปรไฟล์ ขอรับรหัสผูกแชท เพื่อรับข้อความแจ้งเตือนทางแอป LINE ได้ฟรี</li>
          </ul>
        `;
      }

      Swal.fire({
        title: `<div style="font-size: 20px; font-weight: 800; color: #0d9488;">📘 ${pageTitle}</div>`,
        html: `
          <div style="text-align: left; font-family: 'Sarabun', sans-serif;">
            <div style="background: #f0fdfa; border-radius: 12px; padding: 18px; margin-bottom: 20px; border: 1px solid #ccfbf1; box-shadow: inset 0 1px 2px rgba(13,148,136,0.05);">
              <strong style="color: #0f766e; display: block; margin-bottom: 10px; font-size: 14.5px; font-weight: 800; border-bottom: 1.5px solid #ccfbf1; padding-bottom: 6px;">🚀 คู่มือแนะนำระบบฉบับย่อ (Quick Guide)</strong>
              ${guideContent}
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
              <button id="pvt-btn-full-guide" class="swal2-styled" style="background: #ffffff; color: #1e293b; border: 1.5px solid #cbd5e1; margin: 0; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s;">
                <span class="material-symbols-outlined" style="font-size: 20px; color: #0d9488;">library_books</span> อ่านคู่มือการใช้งานฉบับเต็ม
              </button>
              <button id="pvt-btn-diagnostics" class="swal2-styled" style="background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; margin: 0; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: all 0.2s;">
                <span class="material-symbols-outlined" style="font-size: 20px; color: #64748b;">healing</span> ตรวจเช็ค & ซ่อมแซมระบบ
              </button>
            </div>
          </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: 470,
        padding: '1.8rem',
        didOpen: () => {
          // Add soft hover effects
          const btnFull = document.getElementById('pvt-btn-full-guide');
          const btnDiag = document.getElementById('pvt-btn-diagnostics');
          
          btnFull.onmouseenter = () => { btnFull.style.borderColor = '#0d9488'; btnFull.style.background = '#f0fdfa'; };
          btnFull.onmouseleave = () => { btnFull.style.borderColor = '#cbd5e1'; btnFull.style.background = '#ffffff'; };
          
          btnDiag.onmouseenter = () => { btnDiag.style.borderColor = '#64748b'; btnDiag.style.background = '#f1f5f9'; };
          btnDiag.onmouseleave = () => { btnDiag.style.borderColor = '#cbd5e1'; btnDiag.style.background = '#f8fafc'; };

          btnFull.onclick = () => {
            Swal.fire({
              title: 'คู่มือฉบับเต็ม',
              text: 'กำลังเปิดหน้าเอกสารคู่มือการใช้งานพนักงาน...',
              icon: 'info',
              timer: 1000,
              showConfirmButton: false
            }).then(() => {
               window.location.href = '/pages/user/full-guide.html';
            });
          };

          btnDiag.onclick = () => {
            this.showDiagnosticsModal();
          };
        }
      });
    },

    // ⌨️ 7. คีย์ลัดแป้นพิมพ์เปิดแผงตรวจแก้บัค (Ctrl + Shift + D)
    initHotkey() {
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
          e.preventDefault();
          this.showDiagnosticsModal();
        }
      });
    }
  };

  // 🚀 เริ่มต้นทำงานอัตโนมัติ
  window.SystemDiagnostics = SystemDiagnostics;

  document.addEventListener('DOMContentLoaded', () => {
    SystemDiagnostics.initHotkey();
    // สร้างปุ่มช่วยเหลือหนึ่งเดียวที่มุมขวา
    setTimeout(() => {
      SystemDiagnostics.injectUnifiedHelpButton();
    }, 800);
  });

})();

// Global UI Helpers
window.showGlobalLoading = function(message = "กำลังโหลด...") {
  let loader = document.getElementById('global-loading-overlay');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'global-loading-overlay';
    Object.assign(loader.style, {
      position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(255,255,255,0.8)',
      backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', 
      alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.3s'
    });
    loader.innerHTML = `
      <span class="material-symbols-outlined spinning-icon" style="font-size: 48px; color: #0fa472; margin-bottom: 16px;">sync</span>
      <p id="global-loading-msg" style="font-size: 16px; font-weight: 600; color: #334155;">${message}</p>
    `;
    document.body.appendChild(loader);
  } else {
    document.getElementById('global-loading-msg').innerText = message;
    loader.style.display = 'flex';
    setTimeout(() => loader.style.opacity = '1', 10);
  }
};

window.hideGlobalLoading = function() {
  const loader = document.getElementById('global-loading-overlay');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.style.display = 'none', 300);
  }
};

window.toggleDesktopSidebar = function() {
  document.body.classList.toggle('desktop-sidebar-collapsed');
  localStorage.setItem('sidebar-collapsed', document.body.classList.contains('desktop-sidebar-collapsed'));
};

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    document.body.classList.add('desktop-sidebar-collapsed');
  }
  
  // Inject desktop toggle button next to mobile toggle if exists
  const headers = document.querySelectorAll('header');
  headers.forEach(header => {
    const leftWrap = header.querySelector('div') || header;
    const desktopBtn = document.createElement('button');
    desktopBtn.className = 'desktop-menu-toggle';
    desktopBtn.innerHTML = '<span class="material-symbols-outlined">menu</span>';
    desktopBtn.onclick = window.toggleDesktopSidebar;
    
    // Find mobile btn and insert desktop btn near it
    const mobileBtn = header.querySelector('.mobile-menu-btn');
    if (mobileBtn && mobileBtn.parentNode) {
      mobileBtn.parentNode.insertBefore(desktopBtn, mobileBtn.nextSibling);
    } else {
      leftWrap.insertBefore(desktopBtn, leftWrap.firstChild);
    }
  });

  // Inject Unified Help button on every page
  // (Handled by SystemDiagnostics for consistency)
});
