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

  // --------------------------------------------------------------------------
  // 1️⃣ REGISTER WEBAUTHN CREDENTIAL (สร้างกุญแจสแกนลายนิ้วมือ/ใบหน้า)
  // --------------------------------------------------------------------------
  async function registerBiometricCredential(employee, options = {}) {
    if (!employee || (!employee.id && !employee.employee_code)) {
      throw new Error('ไม่พบข้อมูลพนักงานสำหรับลงทะเบียนไบโอเมตริก');
    }

    const check = await isBiometricAvailable();
    if (!check.supported) {
      throw new Error('เบราว์เซอร์ของคุณไม่รองรับมาตรฐาน WebAuthn Biometric');
    }

    const rpName = options.rpName || 'PVT Workforce Hub';
    const rpId = window.location.hostname || 'localhost';
    const challengeBuffer = generateRandomChallenge(32);
    const userIdBuffer = stringToBuffer(employee.id || employee.employee_code);

    const deviceName = options.deviceName || getAutoDeviceNickname();
    const biometricInfo = detectBiometricTypeName();

    const publicKeyCredentialCreationOptions = {
      challenge: challengeBuffer,
      rp: {
        name: rpName,
        id: rpId === 'localhost' || rpId === '127.0.0.1' ? undefined : rpId
      },
      user: {
        id: userIdBuffer,
        name: employee.employee_code || employee.email || 'user',
        displayName: employee.full_name || employee.employee_code || 'Employee'
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
      id: credentialId,
      credential_id: credentialId,
      raw_id: rawIdBase64,
      employee_id: employee.id,
      employee_code: employee.employee_code,
      employee_name: employee.full_name || employee.emp_name,
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

    // 3. Try persisting to Supabase if table exists
    const sb = getSbClient();
    if (sb) {
      try {
        await sb.from('webauthn_credentials').upsert({
          id: credentialId,
          credential_id: credentialId,
          employee_id: employee.id,
          employee_code: employee.employee_code,
          device_name: deviceName,
          biometric_type: biometricInfo.name,
          transports: transports,
          public_key: attestationObject,
          created_at: newCredRecord.created_at,
          last_used_at: null,
          status: 'active'
        });
      } catch (sbErr) {
        console.warn('Notice: Supabase webauthn table upsert notice:', sbErr.message);
      }
    }

    console.log('✅ [WebAuthn] Successfully registered biometric credential:', newCredRecord);
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
    const localList = getLocalCredentials();
    let empCreds = employeeId 
      ? localList.filter(c => String(c.employee_id) === String(employeeId) || String(c.employee_code) === String(employeeId))
      : localList;

    // Try fetching from server or Supabase to merge
    const sb = getSbClient();
    if (sb && employeeId) {
      try {
        const { data, error } = await sb.from('webauthn_credentials').select('*').eq('employee_id', employeeId);
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
    registerBiometricCredential,
    authenticateBiometric,
    listEmployeeCredentials,
    deleteBiometricCredential,
    getLocalCredentials,
    bufferToBase64Url,
    base64UrlToBuffer
  };
}));
