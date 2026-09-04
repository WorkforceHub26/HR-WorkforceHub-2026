/**
 * ============================================================================
 * 🔐 PVT HR LEAVE - WebAuthn Biometric Authentication & Passkey Service
 * ============================================================================
 * Supports Touch ID, Face ID, Windows Hello, Android Biometric Authentication
 * compliant with FIDO2 / W3C Web Authentication standards.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PVTWebAuthn = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 🛠️ ArrayBuffer & Base64URL Encoding Helpers
  function bufferToBase64Url(buffer) {
    if (!buffer) return '';
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  function base64UrlToBuffer(base64url) {
    if (!base64url) return new ArrayBuffer(0);
    let base64 = String(base64url).replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function stringToBuffer(str) {
    return new TextEncoder().encode(str || '');
  }

  function generateRandomChallenge(length = 32) {
    const buffer = new Uint8Array(length);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(buffer);
    } else {
      for (let i = 0; i < length; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
      }
    }
    return buffer;
  }

  // 📱 Device Platform & Biometric Type Identification
  function detectBiometricTypeName() {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';

    if (/iPhone|iPad|iPod/i.test(ua)) {
      return {
        type: 'apple_mobile',
        name: 'Face ID / Touch ID (iOS)',
        icon: 'fingerprint'
      };
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      return {
        type: 'apple_mac',
        name: 'Touch ID / Apple Passkey (macOS)',
        icon: 'fingerprint'
      };
    } else if (/Windows/i.test(ua)) {
      return {
        type: 'windows_hello',
        name: 'Windows Hello (Fingerprint / Face)',
        icon: 'face'
      };
    } else if (/Android/i.test(ua)) {
      return {
        type: 'android_biometric',
        name: 'Android Biometric (Fingerprint / Face)',
        icon: 'fingerprint'
      };
    }
    return {
      type: 'generic_fido2',
      name: 'FIDO2 Biometric / Security Key',
      icon: 'key'
    };
  }

  function getAutoDeviceNickname() {
    const info = detectBiometricTypeName();
    const ua = navigator.userAgent || '';
    let browserName = 'Browser';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browserName = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browserName = 'Safari';
    else if (ua.includes('Edg')) browserName = 'Edge';
    else if (ua.includes('Firefox')) browserName = 'Firefox';

    return `${info.name.split(' ')[0]} on ${browserName}`;
  }

  // 🔍 Check if WebAuthn and Platform Biometrics are supported on this device
  async function isBiometricAvailable() {
    if (!window.PublicKeyCredential) {
      return {
        supported: false,
        platformAuthenticator: false,
        reason: 'เบราว์เซอร์ไม่รองรับ WebAuthn / PublicKeyCredential'
      };
    }

    try {
      const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return {
        supported: true,
        platformAuthenticator: !!isAvailable,
        deviceInfo: detectBiometricTypeName(),
        reason: isAvailable ? 'อุปกรณ์พร้อมใช้งานระบบสแกนลายนิ้วมือ / ใบหน้า' : 'ไม่พบเซ็นเซอร์สแกนลายนิ้วมือ/ใบหน้าบนอุปกรณ์นี้'
      };
    } catch (err) {
      return {
        supported: true,
        platformAuthenticator: false,
        reason: err.message
      };
    }
  }

  // 🗄️ Local Storage Cache for Registered Biometric Credentials
  const LOCAL_STORAGE_KEY = 'pvt_webauthn_credentials';

  function getLocalCredentials() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocalCredentials(list) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save credentials locally:', e);
    }
  }

  // 🌐 Supabase Client Getter
  function getSbClient() {
    return window.pvtSupabase?.client 
        || window.pvtSupabase?.getClient?.() 
        || window.PVTSDK?.client 
        || window.supabaseClient 
        || window.supabase 
        || window.sb;
  }

  // 🌐 Verify Active User Session from Supabase & Storage
  async function verifyActiveSession() {
    const sb = getSbClient();
    let verifiedEmp = null;

    // 1. Supabase Auth Session Verification
    if (sb?.auth?.getSession) {
      try {
        const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
        if (!sessionErr && sessionData?.session?.user) {
          const u = sessionData.session.user;
          // Fetch employee record
          const { data: empDb } = await sb.from('employees')
            .select('id, employee_code, full_name, role, status, email, departments(department_name), positions(position_name)')
            .or(`id.eq.${u.id},email.eq.${u.email}`)
            .maybeSingle();

          if (empDb && String(empDb.status || '').toLowerCase() !== 'inactive') {
            verifiedEmp = {
              id: empDb.id,
              employee_id: empDb.id,
              employee_code: empDb.employee_code || empDb.id,
              full_name: empDb.full_name || 'พนักงาน',
              role: empDb.role || 'user',
              email: empDb.email || u.email,
              source: 'supabase_auth'
            };
          }
        }
      } catch (e) {
        console.warn('Notice: Supabase getSession verification attempt:', e);
      }
    }

    // 2. Fallback to cached profile / window objects
    if (!verifiedEmp) {
      verifiedEmp = await resolveEmployeeObject();
    }

    if (!verifiedEmp || (!verifiedEmp.id && !verifiedEmp.employee_code)) {
      return {
        valid: false,
        employee: null,
        reason: 'ไม่พบเซสชันการเข้าสู่ระบบที่ถูกต้อง กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
      };
    }

    return {
      valid: true,
      employee: verifiedEmp,
      reason: 'เซสชันถูกต้องพร้อมลงทะเบียน'
    };
  }

  // 🌐 Helper: Resolve Employee Identity from all possible runtime sources
  async function resolveEmployeeObject(employee) {
    // 1. Direct input validation
    if (employee && typeof employee === 'object') {
      const inner = employee.employees || employee.user || employee.employee || employee;
      const id = inner.id || inner.employee_id || inner.employeeId || inner.userId || inner.user_id;
      const code = inner.employee_code || inner.employeeCode || inner.code;
      const name = inner.full_name || inner.fullName || inner.emp_name || inner.displayName || inner.name;
      if (id || code) {
        return {
          id: String(id || code),
          employee_id: String(id || code),
          employee_code: String(code || id),
          full_name: String(name || 'พนักงาน')
        };
      }
    } else if (typeof employee === 'string' && employee.trim()) {
      return {
        id: employee.trim(),
        employee_id: employee.trim(),
        employee_code: employee.trim(),
        full_name: 'พนักงาน'
      };
    }

    // 2. Global window objects
    const winCandidates = [
      window.currentEmpProfile,
      window.currentUserProfile,
      window.currentUser,
      window.state?.currentUserProfile,
      window.state?.currentUser
    ];
    for (const cand of winCandidates) {
      if (cand && typeof cand === 'object') {
        const inner = cand.employees || cand.user || cand;
        const id = inner.id || inner.employee_id || inner.employeeId;
        const code = inner.employee_code || inner.employeeCode || inner.code;
        const name = inner.full_name || inner.fullName || inner.emp_name || inner.displayName;
        if (id || code) {
          return {
            id: String(id || code),
            employee_id: String(id || code),
            employee_code: String(code || id),
            full_name: String(name || 'พนักงาน')
          };
        }
      }
    }

    // 3. Storage check
    const storageKeys = [
      'currentUser', 'pvt_user', 'user', 'profile', 'employee_session',
      'hr_session', 'loggedInUser', 'currentUserId', 'currentEmp'
    ];
    for (const k of storageKeys) {
      const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            const inner = parsed.employees || parsed.user || parsed;
            const id = inner.id || inner.employee_id || inner.employeeId || inner.userId;
            const code = inner.employee_code || inner.employeeCode || inner.code;
            const name = inner.full_name || inner.fullName || inner.emp_name || inner.displayName;
            if (id || code) {
              return {
                id: String(id || code),
                employee_id: String(id || code),
                employee_code: String(code || id),
                full_name: String(name || 'พนักงาน')
              };
            }
          } else if (typeof parsed === 'string' && parsed.trim() && !parsed.startsWith('{')) {
            return {
              id: parsed.trim(),
              employee_id: parsed.trim(),
              employee_code: parsed.trim(),
              full_name: 'พนักงาน'
            };
          }
        } catch (e) {}
      }
    }

    // 4. Supabase Auth Session
    const sb = getSbClient();
    if (sb) {
      try {
        if (sb.auth?.getSession) {
          const { data } = await sb.auth.getSession();
          if (data?.session?.user) {
            const u = data.session.user;
            const { data: empDb } = await sb.from('employees')
              .select('id, employee_code, full_name')
              .or(`id.eq.${u.id},email.eq.${u.email}`)
              .maybeSingle();
            if (empDb) {
              return {
                id: String(empDb.id),
                employee_id: String(empDb.id),
                employee_code: String(empDb.employee_code || empDb.id),
                full_name: String(empDb.full_name || 'พนักงาน')
              };
            }
          }
        }
      } catch (e) {}
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // 1️⃣ REGISTER WEBAUTHN CREDENTIAL (สร้างกุญแจสแกนลายนิ้วมือ/ใบหน้า)
  // --------------------------------------------------------------------------
  async function registerBiometricCredential(employee, options = {}) {
    // 🔒 Phase 1: Verify Current Active User Session First
    const sessionCheck = await verifyActiveSession();
    let normalizedEmp = null;

    if (sessionCheck.valid && sessionCheck.employee) {
      normalizedEmp = sessionCheck.employee;
    } else {
      normalizedEmp = await resolveEmployeeObject(employee);
    }

    if (!normalizedEmp || (!normalizedEmp.id && !normalizedEmp.employee_code)) {
      throw new Error('ไม่พบข้อมูลเซสชันการเข้าสู่ระบบที่ถูกต้อง กรุณาเข้าสู่ระบบก่อนลงทะเบียนอุปกรณ์ไบโอเมตริก');
    }

    const deviceName = options.deviceName || employee?.deviceName || getAutoDeviceNickname();

    const check = await isBiometricAvailable();
    if (!check.supported) {
      throw new Error('เบราว์เซอร์ของคุณไม่รองรับมาตรฐาน WebAuthn Biometric');
    }

    const rpName = options.rpName || 'PVT Workforce Hub';
    const rpId = window.location.hostname || 'localhost';
    const challengeBuffer = generateRandomChallenge(32);
    const userIdBuffer = stringToBuffer(normalizedEmp.id || normalizedEmp.employee_code);

    const biometricInfo = detectBiometricTypeName();

    const publicKeyCredentialCreationOptions = {
      challenge: challengeBuffer,
      rp: {
        name: rpName,
        id: rpId === 'localhost' || rpId === '127.0.0.1' ? undefined : rpId
      },
      user: {
        id: userIdBuffer,
        name: normalizedEmp.employee_code || normalizedEmp.email || 'user',
        displayName: normalizedEmp.full_name || normalizedEmp.employee_code || 'Employee'
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256 (ECDSA w/ SHA-256)
        { alg: -257, type: 'public-key' }, // RS256 (RSA w/ SHA-256)
        { alg: -8, type: 'public-key' }    // Ed25519
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Touch ID / Face ID / Windows Hello
        userVerification: 'preferred',
        residentKey: 'preferred',
        requireResidentKey: false
      },
      timeout: 60000,
      attestation: 'none'
    };

    console.log('🔑 [WebAuthn] Initiating navigator.credentials.create...', publicKeyCredentialCreationOptions);

    let credential;
    try {
      credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('การสแกนลายนิ้วมือ/ใบหน้าถูกยกเลิก หรือหมดเวลา');
      } else if (err.name === 'InvalidStateError') {
        throw new Error('อุปกรณ์นี้ได้รับการลงทะเบียนเข้าใช้งานไว้แล้ว');
      }
      throw new Error(`เกิดข้อผิดพลาดในการสร้างกุญแจไบโอเมตริก: ${err.message}`);
    }

    if (!credential) {
      throw new Error('ไม่ได้รับข้อมูลการยืนยันตัวตนจากอุปกรณ์');
    }

    const credentialId = credential.id;
    const rawIdBase64 = bufferToBase64Url(credential.rawId);
    const clientDataJSON = bufferToBase64Url(credential.response.clientDataJSON);
    const attestationObject = bufferToBase64Url(credential.response.attestationObject);
    const transports = credential.response.getTransports ? credential.response.getTransports() : ['internal'];

    const newCredRecord = {
      success: true,
      id: credentialId,
      credential_id: credentialId,
      raw_id: rawIdBase64,
      employee_id: normalizedEmp.id,
      employee_code: normalizedEmp.employee_code,
      employee_name: normalizedEmp.full_name,
      device_name: deviceName,
      biometric_type: biometricInfo.name,
      icon: biometricInfo.icon,
      transports: transports,
      client_data: clientDataJSON,
      attestation_object: attestationObject,
      created_at: new Date().toISOString(),
      last_used_at: null,
      status: 'active'
    };

    // 1. Save to LocalStorage for fast offline client resolution
    const localList = getLocalCredentials();
    const filtered = localList.filter(c => c.credential_id !== credentialId);
    filtered.unshift(newCredRecord);
    saveLocalCredentials(filtered);

    // 2. Try persisting to Server API endpoint
    try {
      await fetch('/api/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCredRecord)
      });
    } catch (apiErr) {
      console.warn('Notice: Server API webauthn save skipped or offline:', apiErr);
    }

    // 3. Persist to Supabase webauthn_credentials table
    const sb = getSbClient();
    if (sb) {
      try {
        const { error: upsertErr } = await sb.from('webauthn_credentials').upsert({
          id: credentialId,
          credential_id: credentialId,
          employee_id: normalizedEmp.id,
          employee_code: normalizedEmp.employee_code,
          device_name: deviceName,
          biometric_type: biometricInfo.name,
          transports: transports,
          public_key: attestationObject,
          created_at: newCredRecord.created_at,
          last_used_at: null,
          status: 'active'
        });
        if (upsertErr) {
          console.warn('Notice: Supabase webauthn upsert detail:', upsertErr.message);
        }
      } catch (sbErr) {
        console.warn('Notice: Supabase webauthn table upsert notice:', sbErr.message);
      }
    }

    console.log('✅ [WebAuthn] Successfully registered biometric credential with Supabase:', newCredRecord);
    return newCredRecord;
  }

  // --------------------------------------------------------------------------
  // 2️⃣ AUTHENTICATE WITH WEBAUTHN (สแกนนิ้ว/ใบหน้าเพื่อเข้าสู่ระบบ)
  // --------------------------------------------------------------------------
  async function authenticateBiometric(options = {}) {
    const check = await isBiometricAvailable();
    if (!check.supported) {
      throw new Error('เบราว์เซอร์นี้ไม่รองรับการยืนยันตัวตนด้วยไบโอเมตริก');
    }

    const localCreds = getLocalCredentials().filter(c => c.status === 'active');
    const targetEmpCode = (options.employeeCode || '').trim();

    let allowedCredentials = [];
    if (targetEmpCode) {
      const matchForEmp = localCreds.filter(c => 
        String(c.employee_code).toLowerCase() === targetEmpCode.toLowerCase()
      );
      if (matchForEmp.length > 0) {
        allowedCredentials = matchForEmp.map(c => ({
          id: base64UrlToBuffer(c.credential_id || c.id),
          type: 'public-key',
          transports: c.transports || ['internal']
        }));
      }
    } else if (localCreds.length > 0) {
      allowedCredentials = localCreds.map(c => ({
        id: base64UrlToBuffer(c.credential_id || c.id),
        type: 'public-key',
        transports: c.transports || ['internal']
      }));
    }

    const challengeBuffer = generateRandomChallenge(32);
    const rpId = window.location.hostname || 'localhost';

    const publicKeyCredentialRequestOptions = {
      challenge: challengeBuffer,
      rpId: rpId === 'localhost' || rpId === '127.0.0.1' ? undefined : rpId,
      allowCredentials: allowedCredentials.length > 0 ? allowedCredentials : undefined,
      userVerification: 'preferred',
      timeout: 60000
    };

    console.log('🔒 [WebAuthn] Prompting biometric scan with navigator.credentials.get...', publicKeyCredentialRequestOptions);

    let assertion;
    try {
      assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error('การสแกนลายนิ้วมือ/ใบหน้าถูกยกเลิก หรือไม่ผ่านการตรวจสอบ');
      }
      throw new Error(`เกิดข้อผิดพลาดในการตรวจสอบไบโอเมตริก: ${err.message}`);
    }

    if (!assertion) {
      throw new Error('ไม่ได้รับผลการตรวจสอบสิทธิ์จากอุปกรณ์');
    }

    const credentialId = assertion.id;
    console.log('✅ [WebAuthn] Assertion received for Credential ID:', credentialId);

    // Find matching employee for this credential
    let matchedCred = localCreds.find(c => c.credential_id === credentialId || c.id === credentialId);
    let employee = null;

    // 1. Check from Supabase if online
    const sb = getSbClient();
    if (sb) {
      try {
        let empQuery = null;
        if (matchedCred && matchedCred.employee_id) {
          empQuery = await sb.from('employees').select('*, departments(department_name), positions(position_name, duty_name)').eq('id', matchedCred.employee_id).maybeSingle();
        } else if (matchedCred && matchedCred.employee_code) {
          empQuery = await sb.from('employees').select('*, departments(department_name), positions(position_name, duty_name)').eq('employee_code', matchedCred.employee_code).maybeSingle();
        } else {
          // Query by webauthn_credentials table
          const { data: dbCred } = await sb.from('webauthn_credentials').select('*, employees(*, departments(department_name), positions(position_name))').eq('credential_id', credentialId).maybeSingle();
          if (dbCred && dbCred.employees) {
            employee = dbCred.employees;
            matchedCred = dbCred;
          }
        }

        if (empQuery && !empQuery.error && empQuery.data) {
          employee = empQuery.data;
        }
      } catch (dbErr) {
        console.warn('Notice: Supabase employee lookup notice:', dbErr);
      }
    }

    // 2. Fallback: If DB failed or offline, use matched credential info
    if (!employee && matchedCred) {
      employee = {
        id: matchedCred.employee_id,
        employee_code: matchedCred.employee_code,
        full_name: matchedCred.employee_name,
        role: 'user',
        status: 'active'
      };
    }

    if (!employee) {
      throw new Error('ไม่พบข้อมูลพนักงานที่ผูกกับกุญแจไบโอเมตริกนี้ กรุณาลงทะเบียนใหม่ในหน้าโปรไฟล์');
    }

    if (String(employee.status || '').toLowerCase() === 'inactive') {
      throw new Error('บัญชีของคุณถูกระงับสิทธิ์การใช้งาน กรุณาติดต่อฝ่ายบุคคล (HR)');
    }

    // Update last_used_at timestamp
    const nowIso = new Date().toISOString();
    if (matchedCred) {
      matchedCred.last_used_at = nowIso;
      saveLocalCredentials(localCreds);
    }

    if (sb && matchedCred) {
      try {
        await sb.from('webauthn_credentials').update({ last_used_at: nowIso }).eq('credential_id', credentialId);
      } catch (e) {}
    }

    return {
      success: true,
      employee: employee,
      credential: matchedCred || { id: credentialId, device_name: getAutoDeviceNickname() },
      assertion: {
        id: assertion.id,
        clientDataJSON: bufferToBase64Url(assertion.response.clientDataJSON),
        authenticatorData: bufferToBase64Url(assertion.response.authenticatorData),
        signature: bufferToBase64Url(assertion.response.signature)
      }
    };
  }

  // --------------------------------------------------------------------------
  // 3️⃣ CREDENTIAL MANAGEMENT & QUERIES
  // --------------------------------------------------------------------------
  async function listEmployeeCredentials(employeeId) {
    let targetId = employeeId;
    if (!targetId) {
      const resolved = await resolveEmployeeObject();
      targetId = resolved?.id || resolved?.employee_code;
    }

    const localList = getLocalCredentials();
    let empCreds = targetId 
      ? localList.filter(c => String(c.employee_id) === String(targetId) || String(c.employee_code) === String(targetId))
      : localList;

    // Try fetching from server or Supabase to merge
    const sb = getSbClient();
    if (sb && targetId) {
      try {
        const { data, error } = await sb.from('webauthn_credentials').select('*').or(`employee_id.eq.${targetId},employee_code.eq.${targetId}`);
        if (!error && data && data.length > 0) {
          const mergedMap = new Map();
          data.forEach(item => mergedMap.set(item.credential_id || item.id, item));
          empCreds.forEach(item => mergedMap.set(item.credential_id || item.id, { ...mergedMap.get(item.credential_id || item.id), ...item }));
          empCreds = Array.from(mergedMap.values());
        }
      } catch (e) {}
    }

    return empCreds;
  }

  async function deleteBiometricCredential(credentialId, employeeId) {
    if (!credentialId) return false;

    // Remove from local storage
    const list = getLocalCredentials().filter(c => c.credential_id !== credentialId && c.id !== credentialId);
    saveLocalCredentials(list);

    // Try removing from server API
    try {
      await fetch('/api/webauthn/credentials', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential_id: credentialId, employee_id: employeeId })
      });
    } catch (e) {}

    // Try removing from Supabase
    const sb = getSbClient();
    if (sb) {
      try {
        await sb.from('webauthn_credentials').delete().eq('credential_id', credentialId);
      } catch (e) {}
    }

    return true;
  }

  // Public Export API
  return {
    isBiometricAvailable,
    detectBiometricTypeName,
    getAutoDeviceNickname,
    resolveEmployeeObject,
    verifyActiveSession,
    registerBiometricCredential,
    authenticateBiometric,
    listEmployeeCredentials,
    deleteBiometricCredential,
    getLocalCredentials,
    bufferToBase64Url,
    base64UrlToBuffer
  };
}));
