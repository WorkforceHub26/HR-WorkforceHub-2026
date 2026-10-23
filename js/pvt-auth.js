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

  function readToken() {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return '';
      const t = JSON.parse(raw);
      if (!t || !t.token) return '';
      if (t.expires_at && new Date(t.expires_at).getTime() < Date.now()) { localStorage.removeItem(TOKEN_KEY); return ''; }
      return String(t.token);
    } catch (e) { return ''; }
  }
  function saveToken(token, expiresAt) {
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expires_at: expiresAt || null })); } catch (e) {}
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
    if (data && data.ok && data.token) saveToken(data.token, data.expires_at);
    return data;
  }

  const PVTAuth = {
    TOKEN_KEY,
    token: readToken,
    hasToken: () => !!readToken(),
    clearToken,
    reasonText,
    isMissingFunction,

    // { ok, user, token, expires_at } | { ok:false, reason, ... } | { legacy:true } (ยังไม่ได้ติดตั้งฟังก์ชัน)
    async login(login, password, remember = true) {
      const { data, error } = await rpc('pvt_login', {
        p_login: String(login || ''), p_password: String(password || ''),
        p_remember: remember !== false, p_user_agent: (navigator.userAgent || '').slice(0, 300)
      });
      if (error) return isMissingFunction(error) ? { legacy: true } : { ok: false, reason: 'error', message: error.message };
      return finishLogin(data);
    },

    async qrLogin(code, remember = true) {
      const { data, error } = await rpc('pvt_qr_login', {
        p_code: String(code || ''), p_remember: remember !== false, p_user_agent: (navigator.userAgent || '').slice(0, 300)
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
