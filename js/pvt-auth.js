/* ==========================================================================
   🔐 PVTAuth — เข้าระบบผ่านฐานข้อมูล (ช่วงที่ 1 ของงานความปลอดภัยการเข้าระบบ)
   --------------------------------------------------------------------------
   • ตรวจรหัสผ่านในฐานข้อมูล (RPC pvt_login / pvt_qr_login) — หน้าเว็บไม่ต้องอ่านรหัสผ่านอีกต่อไป
   • ได้ "บัตรผ่าน" (session token) เก็บไว้ใน localStorage: pvt_session_token
     ใช้กับงานที่ต้องยืนยันตัวตน เช่น เปลี่ยน/ตั้งรหัสผ่าน (pvt_change_password / pvt_set_password)
   • ถ้ายังไม่ได้รัน supabase/migrations/20261023_auth_phase1_server_login.sql → คืน { legacy: true }
     ให้หน้าเข้าระบบใช้วิธีเดิมต่อไปได้ (ช่วงเปลี่ยนผ่าน)
   ใช้ร่วมกันโดย auth/index.js (หน้าเข้าระบบ) · js/auth-guard.js · คอนโซลผู้ดูแลระบบ · หน้าจัดการพนักงาน
   ========================================================================== */
(function (global) {
  'use strict';
  if (global.PVTAuth) return;

  const TOKEN_KEY = 'pvt_session_token';
  // รหัสเครื่อง (ช่วงที่ 2): ค่าสุ่มของเบราว์เซอร์นี้ ใช้แยก "เครื่องของฉัน" กับ "เครื่องยืม" — ไม่ลบตอนออกจากระบบ
  const DEVICE_KEY = 'pvt_device_id';

  function deviceId() {
    try {
      let id = localStorage.getItem(DEVICE_KEY);
      if (!id || id.length < 16) {
        const rnd = (global.crypto && global.crypto.randomUUID) ? global.crypto.randomUUID()
          : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        id = 'pvt-' + rnd;
        localStorage.setItem(DEVICE_KEY, id);
      }
      return id;
    } catch (e) { return ''; }
  }

  function client() {
    try {
      return global.pvtSupabase?.getClient?.() || global.pvtSupabase?.client || global.PVTSDK?.client || global.supabaseClient || null;
    } catch (e) { return null; }
  }

  // ยังไม่ได้ติดตั้งฟังก์ชันในฐานข้อมูล (PostgREST: PGRST202 / 404)
  function isMissingFunction(err) {
    if (!err) return false;
    const msg = String(err.message || err.details || err.hint || '');
    return err.code === 'PGRST202' || err.code === '42883' || err.status === 404 ||
      /Could not find the function|function .* does not exist|schema cache/i.test(msg);
  }

  function readTokenObj() {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      const t = JSON.parse(raw);
      if (!t || !t.token) return null;
      if (t.expires_at && new Date(t.expires_at).getTime() < Date.now()) { localStorage.removeItem(TOKEN_KEY); return null; }
      return t;
    } catch (e) { return null; }
  }
  function readToken() { const t = readTokenObj(); return t ? String(t.token) : ''; }
  function saveToken(token, expiresAt, deviceKind) {
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expires_at: expiresAt || null, device_kind: deviceKind || 'unknown' })); } catch (e) {}
  }
  function patchToken(fields) {
    const t = readTokenObj();
    if (!t) return;
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify(Object.assign(t, fields))); } catch (e) {}
  }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  async function rpc(name, args) {
    const sb = client();
    if (!sb || typeof sb.rpc !== 'function') return { error: { message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', code: 'no_client' } };
    try {
      const { data, error } = await sb.rpc(name, args);
      return { data, error };
    } catch (err) {
      return { error: err };
    }
  }

  // ข้อความภาษาไทยของเหตุผลที่เข้าระบบ/ตั้งรหัสไม่ได้
  const REASON_TEXT = {
    empty: 'กรุณากรอกข้อมูลให้ครบ',
    not_found: 'ไม่พบข้อมูลพนักงานในระบบ (โปรดตรวจสอบ รหัส/ชื่อ/อีเมล/เบอร์โทร อีกครั้ง)',
    multiple: 'พบชื่อซ้ำกันหลายคน กรุณาใช้รหัสพนักงานในการเข้าสู่ระบบ',
    wrong: 'รหัสผ่านไม่ถูกต้อง',
    admin_no_password: 'บัญชีผู้ดูแลระบบยังไม่ได้ตั้งรหัสผ่านเฉพาะ กรุณาติดต่อผู้ดูแลระบบ',
    admin_qr: 'บัญชีผู้ดูแลระบบ (HR / Admin / ผู้บริหาร) เข้าสู่ระบบด้วย QR ไม่ได้ กรุณากรอกรหัสผ่าน',
    inactive: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อฝ่ายบุคคล (HR)',
    locked: 'กรอกรหัสผ่านผิดหลายครั้ง บัญชีถูกล็อกชั่วคราว 15 นาที (หรือให้ผู้ดูแลระบบตั้งรหัสใหม่ให้)',
    expired: 'การเข้าสู่ระบบหมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่อีกครั้ง',
    forbidden: 'บัญชีของคุณไม่มีสิทธิ์ตั้งรหัสผ่านให้บัญชีนี้',
    wrong_current: 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
    too_short: 'รหัสผ่านสั้นเกินไป',
    same_as_code: 'ห้ามใช้รหัสพนักงานเป็นรหัสผ่าน'
  };
  function reasonText(res) {
    if (!res) return 'เกิดข้อผิดพลาด กรุณาลองใหม่';
    if (res.reason === 'too_short' && res.min) return `รหัสผ่านต้องมีอย่างน้อย ${res.min} ตัวอักษร`;
    if (res.reason === 'locked' && res.locked_until) {
      try {
        const t = new Date(res.locked_until).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        return `กรอกรหัสผ่านผิดหลายครั้ง บัญชีถูกล็อกชั่วคราว ลองใหม่ได้หลังเวลา ${t} น. (หรือให้ผู้ดูแลระบบตั้งรหัสใหม่ให้)`;
      } catch (e) {}
    }
    if (res.reason === 'wrong' && typeof res.attempts_left === 'number') {
      return res.attempts_left > 0
        ? `รหัสผ่านไม่ถูกต้อง (ลองได้อีก ${res.attempts_left} ครั้ง ก่อนบัญชีถูกล็อก 15 นาที)`
        : REASON_TEXT.locked;
    }
    if (res.reason === 'inactive' && res.status) return `บัญชีนี้ถูกระงับการใช้งาน (สถานะ: ${res.status}) กรุณาติดต่อฝ่ายบุคคล (HR)`;
    return REASON_TEXT[res.reason] || res.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
  }

  function finishLogin(data) {
    if (data && data.ok && data.token) saveToken(data.token, data.expires_at, data.device_kind);
    return data;
  }

  // เรียกพร้อมรหัสเครื่อง · ถ้าฐานข้อมูลยังเป็นช่วงที่ 1 (ไม่รู้จัก p_device_id) → เรียกซ้ำแบบไม่มีรหัสเครื่อง
  async function rpcWithDevice(name, args) {
    let res = await rpc(name, Object.assign({}, args, { p_device_id: deviceId() }));
    if (res.error && isMissingFunction(res.error)) res = await rpc(name, args);
    return res;
  }

  const PVTAuth = {
    TOKEN_KEY,
    DEVICE_KEY,
    deviceId,
    token: readToken,
    // 'own' (เครื่องของฉัน) · 'shared' (เครื่องยืม) · 'ask' (ยังไม่ได้ตอบ) · 'unknown' (ระบบเดิม)
    deviceKind() { const t = readTokenObj(); return t ? (t.device_kind || 'unknown') : ''; },
    isSharedDevice() { const t = readTokenObj(); return !!t && (t.device_kind === 'shared' || t.device_kind === 'ask'); },
    // วันหมดอายุของบัตรผ่าน (ms) — ใช้เป็นวันหมดอายุของ currentUser
    tokenExpiresAt() { const t = readTokenObj(); return t && t.expires_at ? new Date(t.expires_at).getTime() : 0; },
    hasToken: () => !!readToken(),
    clearToken,
    reasonText,
    isMissingFunction,

    // { ok, user, token, expires_at } | { ok:false, reason, ... } | { legacy:true } (ยังไม่ได้ติดตั้งฟังก์ชัน)
    async login(login, password, remember = true) {
      const { data, error } = await rpcWithDevice('pvt_login', {
        p_login: String(login || ''), p_password: String(password || ''),
        p_remember: remember !== false, p_user_agent: (navigator.userAgent || '').slice(0, 300)
      });
      if (error) return isMissingFunction(error) ? { legacy: true } : { ok: false, reason: 'error', message: error.message };
      return finishLogin(data);
    },

    async qrLogin(code, remember = true) {
      const { data, error } = await rpcWithDevice('pvt_qr_login', {
        p_code: String(code || ''), p_remember: remember !== false, p_user_agent: (navigator.userAgent || '').slice(0, 300)
      });
      if (error) return isMissingFunction(error) ? { legacy: true } : { ok: false, reason: 'error', message: error.message };
      return finishLogin(data);
    },

    // ลิงก์ใช้ครั้งเดียวจากปุ่มใน LINE (ช่วงที่ 3) → { ok, user, token, leave_id, still_pending } | { ok:false, reason }
    async lineLinkLogin(link) {
      const { data, error } = await rpc('pvt_line_link_login', {
        p_link: String(link || ''), p_device_id: deviceId(), p_user_agent: (navigator.userAgent || '').slice(0, 300)
      });
      if (error) return isMissingFunction(error) ? { legacy: true } : { ok: false, reason: 'error', message: error.message };
      return finishLogin(data);
    },

    // ยกเลิกบัตรผ่านของเครื่องนี้ (ออกจากระบบ) — รอไม่เกิน 1 วินาที
    async logout() {
      const t = readToken();
      clearToken();
      if (!t) return;
      try {
        await Promise.race([rpc('pvt_logout', { p_token: t }), new Promise((r) => setTimeout(r, 1000))]);
      } catch (e) {}
    },

    async session() {
      const t = readToken();
      if (!t) return { ok: false, reason: 'expired' };
      const { data, error } = await rpc('pvt_session', { p_token: t });
      if (error) return isMissingFunction(error) ? { legacy: true } : { ok: false, reason: 'error', message: error.message };
      return data;
    },

    async changeOwnPassword(current, next) {
      const t = readToken();
      const { data, error } = await rpc('pvt_change_password', { p_token: t, p_current: String(current || ''), p_new: String(next || '') });
      if (error) return isMissingFunction(error) ? { legacy: true } : { ok: false, reason: 'error', message: error.message };
      return data;
    },

    // ตั้งรหัสให้พนักงาน/ผู้ดูแลระบบ (ว่าง = ล้างรหัส → พนักงานทั่วไปกลับไปใช้รหัสพนักงาน)
    async setPassword(employeeId, next) {
      const t = readToken();
      const { data, error } = await rpc('pvt_set_password', { p_token: t, p_employee_id: employeeId, p_new: String(next || '') });
      if (error) return isMissingFunction(error) ? { legacy: true } : { ok: false, reason: 'error', message: error.message };
      return data;
    },

    // ตอบ "นี่เป็นเครื่องของคุณใช่ไหม" → { ok, device_kind: 'own'|'shared', expires_at, reason? }
    async setDevice(isOwn) {
      const t = readToken();
      const { data, error } = await rpc('pvt_set_device', { p_token: t, p_device_id: deviceId(), p_own: !!isOwn });
      if (error) return isMissingFunction(error) ? { legacy: true } : { ok: false, reason: 'error', message: error.message };
      if (data && data.ok) patchToken({ device_kind: data.device_kind, expires_at: data.expires_at });
      return data;
    },

    // ล้างเครื่องที่จำไว้ของพนักงาน + ให้ออกจากระบบทุกเครื่อง → { ok, devices, sessions }
    async releaseDevices(employeeId) {
      const t = readToken();
      const { data, error } = await rpc('pvt_release_devices', { p_token: t, p_employee_id: employeeId });
      if (error) return isMissingFunction(error) ? { legacy: true } : { ok: false, reason: 'error', message: error.message };
      return data;
    },

    // ถามครั้งแรกบนเครื่องใหม่ (ใช้ SweetAlert2) · คืนชนิดเครื่องหลังตอบ
    async askDeviceIfNeeded(loginResult) {
      if (!loginResult || !loginResult.ok) return '';
      if (!loginResult.ask_device) return loginResult.device_kind || '';
      const Swal = global.Swal;
      let own = false;
      // ตัวหนังสือ/ปุ่มใหญ่ กดง่าย (ผู้ใช้สูงอายุ) — หน้าเข้าระบบตั้งขนาดของ SweetAlert ไว้เล็ก จึงต้องใช้ !important
      if (!document.getElementById('pvtDevPopupCss')) {
        const css = document.createElement('style');
        css.id = 'pvtDevPopupCss';
        css.textContent = '.pvt-dev-popup{width:min(30em,94vw)!important}'
          + '.pvt-dev-popup .swal2-title{font-size:22px!important;line-height:1.35!important}'
          + '.pvt-dev-popup .swal2-html-container{font-size:16px!important;line-height:1.75!important}'
          + '.pvt-dev-popup .swal2-actions{flex-direction:column!important;gap:8px!important;width:100%!important}'
          + '.pvt-dev-popup .swal2-actions button{font-size:17px!important;padding:13px 20px!important;width:85%!important;margin:0!important}';
        document.head.appendChild(css);
      }
      if (Swal) {
        const r = await Swal.fire({
          icon: 'question',
          title: 'นี่เป็นเครื่องของคุณใช่ไหม?',
          html: '<div style="text-align:left;font-size:16px;line-height:1.75;">'
            + '<b>ใช่ เครื่องของฉัน</b> — ระบบจำไว้ 90 วัน เปิดแอปมาก็เข้าได้เลย<br>'
            + '<b>ไม่ใช่ ยืมเครื่องคนอื่น</b> — ยื่นใบลาเสร็จแล้ว ระบบจะออกจากระบบให้อัตโนมัติ เพื่อนจะได้เข้าบัญชีคุณไม่ได้</div>',
          showDenyButton: true,
          confirmButtonText: 'ใช่ เครื่องของฉัน',
          denyButtonText: 'ไม่ใช่ ยืมเครื่องคนอื่น',
          confirmButtonColor: 'var(--th-p-700, #0f766e)',
          denyButtonColor: '#475569',
          allowOutsideClick: false,
          allowEscapeKey: false,
          reverseButtons: false,
          customClass: { popup: 'pvt-dev-popup' },
          // หน้าต่าง "กำลังตรวจสอบ..." ก่อนหน้า (สแกน QR) อาจสั่ง showLoading ตามมาทีหลัง → ปุ่มหาย กดตอบไม่ได้
          didOpen: () => { try { Swal.hideLoading(); } catch (e) {} },
          didRender: () => { try { Swal.hideLoading(); } catch (e) {} }
        });
        own = !!r.isConfirmed;
      }
      const res = await PVTAuth.setDevice(own);
      if (res && res.ok && own && res.device_kind === 'shared' && Swal) {
        await Swal.fire({ icon: 'info', title: 'ใช้เป็นเครื่องยืม', text: 'เครื่องนี้มีคนอื่นใช้เข้าระบบอยู่ ระบบจึงถือเป็นเครื่องยืม (ออกจากระบบอัตโนมัติหลังยื่นใบลา)', confirmButtonText: 'รับทราบ' });
      }
      return res && res.ok ? res.device_kind : (own ? 'own' : 'shared');
    },

    // { ok, states: { [employee_id]: 'set' | 'none' } }
    async passwordStates(ids) {
      const t = readToken();
      const { data, error } = await rpc('pvt_password_states', { p_token: t, p_ids: ids || [] });
      if (error) return isMissingFunction(error) ? { legacy: true } : { ok: false, reason: 'error', message: error.message };
      return data;
    }
  };

  global.PVTAuth = PVTAuth;
})(typeof window !== 'undefined' ? window : globalThis);
