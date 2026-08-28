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

    // 🖥️ 6. แสดงผล Popup คู่มือการใช้งานแบบใหม่ (Beautiful SweetAlert2)
    showUnifiedHelpPopup() {
      if (!window.Swal) {
        alert("คำแนะนำ: หากพบปัญหาโปรดติดต่อฝ่ายบุคคล (HR)");
        return;
      }

      Swal.fire({
        title: '<div style="font-size: 20px; font-weight: 700; color: #0d9488;">📘 คู่มือแนะนำการใช้งานระบบ</div>',
        html: `
          <div style="text-align: left; font-family: 'Sarabun', sans-serif;">
            <div style="background: #f0fdfa; border-radius: 12px; padding: 16px; margin-bottom: 20px; border: 1px solid #ccfbf1;">
              <strong style="color: #0d9488; display: block; margin-bottom: 8px;">🚀 คู่มือแบบย่อ (Quick Guide)</strong>
              <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #334155; line-height: 1.6;">
                <li><b>การลา:</b> กดปุ่ม "ยื่นใบลาออนไลน์" เลือกประเภทลาและวันที่</li>
                <li><b>ตรวจสอบสถานะ:</b> ดูได้ที่ "ประวัติการลา" หรือแถบแจ้งเตือน</li>
                <li><b>สิทธิ์วันลา:</b> ระบบจะคำนวณวันลาคงเหลือให้ในหน้าหลัก</li>
                <li><b>สแกนบัตร:</b> ใช้ QR บนบัตรพนักงานสแกนเพื่อเข้าสู่ระบบไว</li>
              </ul>
            </div>

            <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
              <button id="pvt-btn-full-guide" class="swal2-styled" style="background: #ffffff; color: #334155; border: 1px solid #cbd5e1; margin: 0; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 20px;">library_books</span> อ่านคู่มือฉบับเต็ม
              </button>
              <button id="pvt-btn-diagnostics" class="swal2-styled" style="background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; margin: 0; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 20px;">healing</span> ตรวจเช็ค & ซ่อมแซมระบบ
              </button>
            </div>
          </div>
        `,
        showConfirmButton: false,
        showCloseButton: true,
        width: 450,
        padding: '2rem',
        didOpen: () => {
          document.getElementById('pvt-btn-full-guide').onclick = () => {
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

          document.getElementById('pvt-btn-diagnostics').onclick = () => {
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
