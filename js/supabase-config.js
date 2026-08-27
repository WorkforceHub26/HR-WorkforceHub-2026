/**
 * ============================================================================
 * PVT SUPABASE ENTERPRISE HR SDK (v3.0 Ultra)
 * Full-featured, Resilient & Modular Client Engine for Supabase
 * ============================================================================
 */

(function (global) {
  "use strict";

  // Configuration Constants
  const CONFIG = {
    URL: "https://pgogmhqjdchakcytsomx.supabase.co",
    ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2dtaHFqZGNoYWtjeXRzb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzYsImV4cCI6MjA5NzM0MTEzNn0.Ah-uFFvTK_qMiIyJN9Ddid6cXqjrZRtLbs14QXUa_m8",
    CACHE_PREFIX: "pvt_hr_cache_",
    OFFLINE_QUEUE_KEY: "pvt_offline_queue",
    DEFAULT_TTL: 30 * 60 * 1000, // 30 นาที
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
  };

  // ==========================================================================
  // 1. SMART CACHE ENGINE (Storage + Memory + Tag Invalidation)
  // ==========================================================================
  class CacheEngine {
    constructor() {
      this.memoryCache = new Map();
    }

    _getKey(key) {
      return CONFIG.CACHE_PREFIX + key;
    }

    set(key, value, ttlMs = CONFIG.DEFAULT_TTL, tags = []) {
      const payload = {
        value,
        expiry: Date.now() + ttlMs,
        tags,
      };
      this.memoryCache.set(key, payload);
      try {
        localStorage.setItem(this._getKey(key), JSON.stringify(payload));
      } catch (e) {
        console.warn("[SDK Cache] LocalStorage quota exceeded, using memory cache.");
      }
    }

    get(key) {
      // 1. Check Memory
      if (this.memoryCache.has(key)) {
        const item = this.memoryCache.get(key);
        if (Date.now() <= item.expiry) return item.value;
        this.memoryCache.delete(key);
      }

      // 2. Check Storage
      try {
        const raw = localStorage.getItem(this._getKey(key));
        if (!raw) return null;
        const item = JSON.parse(raw);
        if (Date.now() > item.expiry) {
          this.remove(key);
          return null;
        }
        this.memoryCache.set(key, item);
        return item.value;
      } catch (e) {
        return null;
      }
    }

    remove(key) {
      this.memoryCache.delete(key);
      localStorage.removeItem(this._getKey(key));
    }

    invalidateByTag(tag) {
      // Clear memory
      for (const [key, item] of this.memoryCache.entries()) {
        if (item.tags && item.tags.includes(tag)) {
          this.memoryCache.delete(key);
        }
      }
      // Clear storage
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(CONFIG.CACHE_PREFIX)) {
          try {
            const item = JSON.parse(localStorage.getItem(k));
            if (item?.tags?.includes(tag)) {
              localStorage.removeItem(k);
            }
          } catch (e) {}
        }
      });
    }

    clearAll() {
      this.memoryCache.clear();
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(CONFIG.CACHE_PREFIX)) {
          localStorage.removeItem(k);
        }
      });
    }
  }

  // ==========================================================================
  // 2. RESILIENT NETWORK ENGINE (Auto Retry + Offline Detection)
  // ==========================================================================
  class NetworkEngine {
    constructor() {
      this.isOnline = navigator.onLine;
      window.addEventListener("online", () => this._handleOnlineStatus(true));
      window.addEventListener("offline", () => this._handleOnlineStatus(false));
    }

    _handleOnlineStatus(status) {
      this.isOnline = status;
      console.log(`[SDK Network] Connection Status: ${status ? "ONLINE" : "OFFLINE"}`);
      if (status) {
        global.PVTSDK.offline.processQueue();
      }
    }

    async retry(fn, maxRetries = CONFIG.MAX_RETRIES, delay = CONFIG.RETRY_DELAY) {
      let lastError;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (err) {
          lastError = err;
          console.warn(`[SDK Network] Attempt ${attempt} failed. Retrying in ${delay}ms...`);
          if (attempt < maxRetries) {
            await new Promise((res) => setTimeout(res, delay * Math.pow(2, attempt - 1)));
          }
        }
      }
      throw lastError;
    }
  }

  // ==========================================================================
  // 3. AUTH & RBAC ENGINE
  // ==========================================================================
  class AuthEngine {
    constructor(client, cache) {
      this.client = client;
      this.cache = cache;
    }

    async getSession() {
      if (!this.client?.auth) return null;
      const { data, error } = await this.client.auth.getSession();
      if (error) return null;
      return data?.session || null;
    }

    async getUser() {
      const session = await this.getSession();
      return session?.user || null;
    }

    parseJwt(token) {
      try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        return JSON.parse(jsonPayload);
      } catch (e) {
        return null;
      }
    }

    async hasRole(roles = []) {
      const profile = await global.PVTSDK.hr.getProfile();
      if (!profile) return false;
      const userRole = profile.role || "employee";
      if (Array.isArray(roles)) {
        return roles.includes(userRole);
      }
      return userRole === roles;
    }
  }

  // ==========================================================================
  // 4. HR & PROFILE ENGINE
  // ==========================================================================
  class HREngine {
    constructor(client, cache, network) {
      this.client = client;
      this.cache = cache;
      this.network = network;
    }

      // ค้นหาฟังก์ชัน getProfile() ในไฟล์ pvt-supabase-sdk.js แล้วปรับเป็นแบบนี้:
      // ใน class HREngine (pvt-supabase-sdk.js)
        async getProfile(forceRefresh = false) {
          const cacheKey = "user_profile";
          if (!forceRefresh) {
            const cached = this.cache.get(cacheKey);
            if (cached) return cached;
          }

          let userId = null;
          let empCode = null;

          // 1. เช็ก Supabase Auth Session ก่อน
          const session = await global.PVTSDK.auth.getSession();
          if (session?.user) {
            userId = session.user.id;
          } else {
            // 2. ถ้าไม่มี Supabase Auth ให้ดึงจาก LocalStorage (รองรับ RPC Login)
            try {
              const rawLocal = localStorage.getItem("currentUser");
              if (rawLocal) {
                const localUser = JSON.parse(rawLocal);
                // ตรวจสอบว่า session หมดอายุหรือยัง (12 ชั่วโมง)
                if (localUser.expireAt && Date.now() > localUser.expireAt) {
                  localStorage.removeItem("currentUser");
                  return null;
                }
                userId = localUser.id;
                empCode = localUser.employee_code;
              }
            } catch (e) {
              console.warn("[SDK getProfile] Failed to parse local session:", e);
            }
          }

          if (!userId && !empCode) return null;

          // 3. Query ดึงข้อมูลพนักงานพร้อมแผนกและตำแหน่ง
          let query = this.client.from("employees").select(`
            *,
            departments (department_name),
            positions (position_name)
          `);

          if (userId) {
            query = query.eq("id", userId);
          } else if (empCode) {
            query = query.eq("employee_code", empCode);
          }

          const { data: employeeData, error } = await query.maybeSingle();

          if (error || !employeeData) return null;

          const fullProfile = {
            ...employeeData,
            department_name: employeeData.departments?.department_name || 'ไม่ระบุแผนก',
            position_name: employeeData.positions?.position_name || 'ไม่ระบุตำแหน่ง'
          };

          this.cache.set(cacheKey, fullProfile, CONFIG.DEFAULT_TTL, ["profile"]);
          return fullProfile;
        }

    async getEmployeesList(options = {}) {
      const { search = "", departmentId = null, role = null, page = 1, limit = 20, status = "active" } = options;
      const cacheKey = `employees_list_${search}_${departmentId}_${role}_${page}_${status}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      let query = this.client
        .from("employees")
        .select(`*, departments(department_name), positions(position_name)`, { count: "exact" });

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,employee_code.ilike.%${search}%,nickname.ilike.%${search}%`);
      }
      if (departmentId) query = query.eq("department_id", departmentId);
      if (role) query = query.eq("role", role);
      if (status) query = query.eq("status", status); // กรองสถานะพนักงาน (ค่าเริ่มต้นเป็น active)

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to).order("employee_code", { ascending: true });

      const { data, count, error } = await query;
      if (error) throw error;

      const result = { data, total: count, page, limit };
      this.cache.set(cacheKey, result, 5 * 60 * 1000, ["employees"]);
      return result;
    }
  }

  // ==========================================================================
  // 5. LEAVE & THAI DATE ENGINE
  // ==========================================================================
  class LeaveEngine {
    constructor(client, cache) {
      this.client = client;
      this.cache = cache;
    }

    async getDashboardData(targetYear = new Date().getFullYear()) {
      const cacheKey = `dashboard_data_${targetYear}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      try {
        const { data, error } = await this.client.rpc("get_my_dashboard_data", { p_year: targetYear });
        if (!error && data) {
          this.cache.set(cacheKey, data, CONFIG.DEFAULT_TTL, ["leaves", "profile"]);
          return data;
        }
      } catch (e) {}

      // Fallback Manual
      const profile = await global.PVTSDK.hr.getProfile();
      if (!profile) return null;

      const { data: leaveBalances } = await this.client
        .from("leave_balances")
        .select("*, leave_types(leave_name, leave_code)")
        .eq("employee_id", profile.id)
        .eq("year", targetYear);

      const result = {
        profile,
        leave_balances: leaveBalances || [],
        year: targetYear,
      };

      this.cache.set(cacheKey, result, CONFIG.DEFAULT_TTL, ["leaves"]);
      return result;
    }

    calculateWorkingDays(startDateStr, endDateStr, excludeWeekends = true) {
      const start = new Date(global.PVTSDK.utils.toISODate(startDateStr));
      const end = new Date(global.PVTSDK.utils.toISODate(endDateStr));
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

      let count = 0;
      const cur = new Date(start);
      while (cur <= end) {
        const dayOfWeek = cur.getDay();
        if (!excludeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
          count++;
        }
        cur.setDate(cur.getDate() + 1);
      }
      return count;
    }
  }

  // ==========================================================================
  // 6. STORAGE & MEDIA COMPRESSOR ENGINE
  // ==========================================================================
  class StorageEngine {
    constructor(client) {
      this.client = client;
    }

    getAvatarUrl(imageUrl) {
      if (!imageUrl || !String(imageUrl).trim()) {
        return "/assets/img/default-avatar.jpg";
      }
      let url = String(imageUrl).trim();
      if (url.startsWith("http")) return url;
      return `${CONFIG.URL}/storage/v1/object/public/employee-images/${url.replace(/^\//, "")}`;
    }

    async compressImage(file, maxWidth = 1000, maxHeight = 1000, quality = 0.8) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error("Canvas compression failed"));
              }
            },
            "image/jpeg",
            quality
          );
        };
        img.onerror = (err) => reject(err);
      });
    }

    async uploadEmployeeAvatar(employeeId, file) {
      const compressed = await this.compressImage(file, 800, 800, 0.85);
      const fileExt = "jpg";
      const filePath = `avatars/${employeeId}_${Date.now()}.${fileExt}`;

      const { data, error } = await this.client.storage
        .from("employee-images")
        .upload(filePath, compressed, { upsert: true });

      if (error) throw error;
      const avatarUrl = this.getAvatarUrl(filePath);

      // Update Database
      await this.client.from("employees").update({ image_url: filePath }).eq("id", employeeId);
      global.PVTSDK.cache.invalidateByTag("profile");

      return avatarUrl;
    }
  }

      // ==========================================================================
      // 7. REALTIME SYNCHRONIZATION ENGINE
      // ==========================================================================
      class RealtimeEngine {
        constructor(client) {
          this.client = client;
          this.channels = new Map();
        }

        subscribeLeaveUpdates(employeeId, onUpdateCallback) {
          const channelName = `realtime_leaves_${employeeId}`;
          if (this.channels.has(channelName)) return this.channels.get(channelName);

          const channel = this.client
            .channel(channelName)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "leave_requests",
                filter: `employee_id=eq.${employeeId}`,
              },
              (payload) => {
                console.log("[SDK Realtime] Leave Request Change Detected:", payload);
                global.PVTSDK.cache.invalidateByTag("leaves");
                if (typeof onUpdateCallback === "function") {
                  onUpdateCallback(payload);
                }
              }
            )
            .subscribe();

          this.channels.set(channelName, channel);
          return channel;
        }

        unsubscribeAll() {
          for (const [name, channel] of this.channels.entries()) {
            this.client.removeChannel(channel);
          }
          this.channels.clear();
        }
      }

      // ==========================================================================
      // 8. OFFLINE QUEUE ENGINE
      // ==========================================================================
      class OfflineEngine {
        getQueue() {
          try {
            return JSON.parse(localStorage.getItem(CONFIG.OFFLINE_QUEUE_KEY) || "[]");
          } catch (e) {
            return [];
          }
        }

        enqueue(action) {
          const queue = this.getQueue();
          queue.push({ ...action, timestamp: Date.now() });
          localStorage.setItem(CONFIG.OFFLINE_QUEUE_KEY, JSON.stringify(queue));
          console.log("[SDK Offline] Action queued:", action);
        }

        async processQueue() {
          const queue = this.getQueue();
          if (queue.length === 0) return;

          console.log(`[SDK Offline] Processing ${queue.length} pending actions...`);
          const remaining = [];

          for (const item of queue) {
            try {
              // Process action based on table & payload
              await global.PVTSDK.client.from(item.table).insert(item.payload);
            } catch (err) {
              console.error("[SDK Offline] Failed to process queued item:", item, err);
              remaining.push(item);
            }
          }

          localStorage.setItem(CONFIG.OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
        }
      }

      // ==========================================================================
      // 9. UTILITIES & SANITIZER ENGINE
      // ==========================================================================
      class UtilsEngine {
        toISODate(input) {
          if (!input) return null;
          const str = String(input).trim();
          if (!str) return null;

          const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (dmyMatch) {
            let [, day, month, year] = dmyMatch.map(Number);
            if (year > 2400) year -= 543;
            return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          }

          const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
          if (ymdMatch) {
            let [, year, month, day] = ymdMatch.map(Number);
            if (year > 2400) year -= 543;
            return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          }

          const parsed = new Date(str);
          if (!isNaN(parsed.getTime())) {
            let year = parsed.getFullYear();
            if (year > 2400) year -= 543;
            return `${year}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
          }
          return null;
        }

        formatThaiDate(dateValue, format = "short") {
          if (!dateValue) return "-";
          const iso = this.toISODate(dateValue);
          if (!iso) return dateValue;

          const d = new Date(`${iso}T00:00:00`);
          if (isNaN(d.getTime())) return dateValue;

          const yearType = format === "full" ? "numeric" : "2-digit";
          const monthType = format === "full" ? "long" : "short";

          return new Intl.DateTimeFormat("th-TH", {
            day: "2-digit",
            month: monthType,
            year: yearType,
          }).format(d);
        }

        escapeHtml(value) {
          return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
        }

        validateThaiCitizenId(id) {
          if (!id || id.length !== 13 || !/^\d+$/.test(id)) return false;
          let sum = 0;
          for (let i = 0; i < 12; i++) {
            sum += parseInt(id.charAt(i)) * (13 - i);
          }
          const check = (11 - (sum % 11)) % 10;
          return check === parseInt(id.charAt(12));
        }

        formatPhoneNumber(phone) {
          const clean = String(phone).replace(/\D/g, "");
          if (clean.length === 10) {
            return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
          }
          return phone;
        }
      }

    // ==========================================================================
    // 10. SDK INITIALIZER & BOOTSTRAP
    // ==========================================================================
    class PVTHRSdk {
      constructor() {
        this.client = null;
        this.cache = new CacheEngine();
        this.network = new NetworkEngine();
        this.utils = new UtilsEngine();
        this.offline = new OfflineEngine();

        this._initClient();

        this.auth = new AuthEngine(this.client, this.cache);
        this.hr = new HREngine(this.client, this.cache, this.network);
        this.leave = new LeaveEngine(this.client, this.cache);
        this.storage = new StorageEngine(this.client);
        this.realtime = new RealtimeEngine(this.client);
        
        // Modules
        this.user = new UserEngine(this.client, this.cache, this.network);
        this.card = new CardEngine(this.client);
        this.notification = new NotificationEngine(this.client);
        this.line = new LineOAEngine(this.client);
        this.viewport = new ViewportEngine(); // ✅ เพิ่มเรียบร้อย
      }
      
      getClient() {
        return this.client;
      }

      _initClient() {
        if (window.supabaseClient) {
          this.client = window.supabaseClient;
          return;
        }
        if (global.supabase?.createClient) {
          this.client = global.supabase.createClient(CONFIG.URL, CONFIG.ANON_KEY);
          window.supabaseClient = this.client;
        } else {
          console.error("[SDK Error] Supabase JS Client is not loaded on window.");
        }
      }
    }

    // ==========================================================================
  // 11. USER & CENTRAL SERVICE ENGINE
  // ==========================================================================
  class UserEngine {
    constructor(client, cache, network) {
      this.client = client;
      this.cache = cache;
      this.network = network;
    }

    // ดึงโปรไฟล์พนักงาน + แผนก + ตำแหน่ง (พร้อมระบบ Cache)
    async getFullProfile(employeeId, forceRefresh = false) {
      if (!employeeId) throw new Error("ไม่พบ Employee ID");
      const cacheKey = `full_profile_${employeeId}`;

      if (!forceRefresh) {
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;
      }

      const { data, error } = await this.client
        .from('employees')
        .select(`
          id, employee_code, role, status,
          title, first_name, last_name, full_name, nickname,
          phone, email, line_id, image_url,
          department_id, position_id, employment_type, hospital, bank_account,
          start_date, converted_date, resign_date, created_at, updated_at,
          departments ( id, department_code, department_name, department_name_en, status, created_at ),
          positions ( id, position_name, department_id, status, created_at )
        `)
        .eq('id', employeeId)
        .maybeSingle();

      if (error) throw new Error("ดึงข้อมูลพนักงานไม่สำเร็จ: " + error.message);
      if (!data) throw new Error("ไม่พบข้อมูลพนักงานในระบบ");

      const result = {
        ...data,
        department_name: data.departments?.department_name || 'ไม่ระบุแผนก',
        position_name: data.positions?.position_name || 'ไม่ระบุตำแหน่ง'
      };

      this.cache.set(cacheKey, result, CONFIG.DEFAULT_TTL, ["profile"]);
      return result;
    }

    // ดึงวันลาคงเหลือ
    async getLeaveBalances(employeeId, year = new Date().getFullYear()) {
      const cacheKey = `user_leave_balances_${employeeId}_${year}`;
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;

      const { data, error } = await this.client
        .from('leave_balances')
        .select(`
          id, employee_id, leave_type_id, year, entitlement_days, used_days, remaining_days, quota, created_at,
          leave_types ( 
            id, leave_code, leave_name, yearly_quota, status, allow_after_months, 
            requires_attachment, require_advance_days, max_days_per_request, paid_leave, default_days, created_at 
          )
        `)
        .eq('employee_id', employeeId)
        .eq('year', year);

      if (error) return [];
      this.cache.set(cacheKey, data || [], CONFIG.DEFAULT_TTL, ["leaves"]);
      return data || [];
    }

    // ตรวจสอบและสร้างโควตาวันลาอัตโนมัติหากยังไม่มีในปีนั้นๆ (ใช้ AD เป็นมาตรฐาน)
    async ensureLeaveBalances(employeeId, yearOrDate = new Date().getFullYear()) {
      if (!this.client || !employeeId) return;
      try {
        let yearAD = new Date().getFullYear();
        if (typeof yearOrDate === 'number') {
          yearAD = yearOrDate > 2400 ? yearOrDate - 543 : yearOrDate;
        } else if (typeof yearOrDate === 'string' && yearOrDate.trim()) {
          const parsedYear = parseInt(yearOrDate.split('-')[0], 10);
          if (!isNaN(parsedYear)) {
            yearAD = parsedYear > 2400 ? parsedYear - 543 : parsedYear;
          }
        }
        
        // ใช้เฉพาะปี AD เพื่อป้องกันข้อมูลซ้ำซ้อน
        const yearsToCheck = [yearAD];

        // 1. ดึงประเภทการลาทั้งหมด
        const { data: leaveTypes } = await this.client
          .from('leave_types')
          .select('id, yearly_quota, default_days');

        if (!leaveTypes || leaveTypes.length === 0) return;

        // 2. ดึงรายการที่มีอยู่ใน leave_balances ทั้งปี ค.ศ. และ พ.ศ.
        const { data: existingBalances } = await this.client
          .from('leave_balances')
          .select('leave_type_id, year')
          .eq('employee_id', employeeId)
          .in('year', yearsToCheck);

        const existingKeys = new Set(
          (existingBalances || []).map(b => `${b.leave_type_id}_${b.year}`)
        );

        const newBalances = [];
        for (const yr of yearsToCheck) {
          for (const lt of leaveTypes) {
            const key = `${lt.id}_${yr}`;
            if (!existingKeys.has(key)) {
              const quota = Number(lt.yearly_quota || lt.default_days || 30);
              newBalances.push({
                employee_id: employeeId,
                leave_type_id: lt.id,
                year: yr,
                entitlement_days: quota,
                used_days: 0,
                remaining_days: quota
              });
            }
          }
        }

        if (newBalances.length > 0) {
          await this.client.from('leave_balances').insert(newBalances);
          console.log("✅ Auto-created missing leave_balances:", newBalances.length, "records");
        }
      } catch (err) {
        console.warn("⚠️ [ensureLeaveBalances] Warning:", err);
      }
    }

    // ระบบ Logout กลาง (ล้างทั้ง Session และ SDK Cache)
    async logout() {
      this.cache.clearAll();
      localStorage.clear();
      sessionStorage.clear();
      if (this.client?.auth) {
        try { await this.client.auth.signOut(); } catch (e) {}
      }
      window.location.replace("/index.html");
    }
  }

    // ==========================================================================
    // 12. DIGITAL CARD ENGINE (PERMANENT INDIVIDUAL QR)
    // ==========================================================================
    class CardEngine {
      constructor(client) {
        this.client = client;
        this.timerInstance = null;
      }

      // สร้าง URL สำหรับ QR Code ถาวรประจำตัวพนักงาน
      getSecureToken(employeeCode) {
        const cleanCode = String(employeeCode || "").trim();
        const origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
        const autoLoginUrl = `${origin}/index.html?auto_login=${encodeURIComponent(cleanCode)}`;
        return {
          qr_token: autoLoginUrl,
          employee_code: cleanCode
        };
      }

      // สั่งแสดง QR Code ถาวรประจำตัวพนักงาน
      async init(employeeCode, qrContainerId = "qrcode", countdownElementId = "qr-countdown") {
        if (!employeeCode) return;
        this.stop();

        try {
          const container = document.getElementById(qrContainerId);
          if (!container) return;

          const { qr_token } = this.getSecureToken(employeeCode);
          container.innerHTML = "";

          if (typeof QRCode !== 'undefined') {
            try {
              new QRCode(container, {
                text: qr_token,
                width: 160,
                height: 160,
                correctLevel: QRCode.CorrectLevel.M
              });
            } catch (qrErr) {
              console.warn("⚠️ [CardEngine] QRCode instance creation error, using img fallback:", qrErr);
              const qrImg = document.createElement('img');
              qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qr_token)}`;
              qrImg.alt = "Employee QR Code";
              qrImg.style.width = "160px";
              qrImg.style.height = "160px";
              qrImg.style.borderRadius = "8px";
              container.appendChild(qrImg);
            }
          } else {
            const qrImg = document.createElement('img');
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qr_token)}`;
            qrImg.alt = "Employee QR Code";
            qrImg.style.width = "160px";
            qrImg.style.height = "160px";
            qrImg.style.borderRadius = "8px";
            container.appendChild(qrImg);
          }

          const countdownEl = document.getElementById(countdownElementId);
          if (countdownEl) {
            countdownEl.textContent = "QR Code ถาวรประจำตัวพนักงาน";
          }
        } catch (err) {
          console.error("⚠️ [CardEngine] QR Error:", err);
          const container = document.getElementById(qrContainerId);
          if (container) {
            const origin = window.location.origin || "";
            const fallbackUrl = `${origin}/index.html?auto_login=${encodeURIComponent(employeeCode)}`;
            container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(fallbackUrl)}" style="width:160px; height:160px; border-radius:8px;" />`;
          }
        }
      }

      stop() {
        if (this.timerInstance) {
          clearInterval(this.timerInstance);
          this.timerInstance = null;
        }
      }
    }

  // ==========================================================================
// 🔔 NOTIFICATION ENGINE (สำหรับนำไปต่อใน Class/SDK)
// ==========================================================================
class NotificationEngine {
  constructor(client) {
    this.client = client;
  }

  // 1. ดึงรายการแจ้งเตือนที่ยังไม่ได้อ่าน
  async getUnread(userId) {
    if (!userId) return [];
    const { data, error } = await this.client
      .from('notifications')
      .select('id, user_id, title, message, is_read, created_at')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn("⚠️ [Notification] Fetch error:", error.message);
      return [];
    }
    return data || [];
  }

  // 2. เปลี่ยนสถานะเป็นอ่านแล้ว (Mark as Read)
  async markAsRead(notificationId) {
    if (!notificationId) return false;
    const { error } = await this.client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error("❌ [Notification] Mark read error:", error.message);
      return false;
    }
    return true;
  }

  // 3. รับแจ้งเตือนแบบ Realtime เมื่อมีข้อความใหม่เด้งเข้า DB
  subscribe(userId, callback) {
    if (!userId) return null;
    return this.client
      .channel(`realtime_notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          if (typeof callback === 'function') {
            callback(payload.new);
          }
        }
      )
      .subscribe();
  }
}

// ==========================================================================
// 💬 LINE OA NOTIFICATION ENGINE (หัวหน้า -> ผู้จัดการ -> พนักงาน)
// ==========================================================================
class LineOAEngine {
  constructor(client) {
    this.client = client;
    this.webhookUrl = "";
    this.channelAccessToken = "";
    this._loadConfig(); // โหลดคอนฟิกจาก DB ทันที
  }

  async _loadConfig() {
    if (!this.client) return;
    try {
      const { data } = await this.client
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'line_oa_config')
        .maybeSingle();
      
      if (data?.setting_value) {
        this.webhookUrl = data.setting_value.webhook_url || "";
        this.channelAccessToken = data.setting_value.channel_access_token || "";
      }
    } catch (e) {
      console.warn("⚠️ [LINE OA] Failed to load config from system_settings:", e);
    }
  }

  async setConfig(webhookUrl, channelToken) {
    this.webhookUrl = webhookUrl;
    this.channelAccessToken = channelToken;
    if (this.client) {
      await this.client.from('system_settings').upsert({
        setting_key: 'line_oa_config',
        setting_value: { webhook_url: webhookUrl, channel_access_token: channelToken },
        updated_at: new Date().toISOString()
      });
    }
  }

  async sendWorkflowNotification(opts = {}) {
    const {
      type = 'NEW_REQUEST', // 'NEW_REQUEST', 'LEADER_APPROVED', 'FINAL_APPROVED', 'REJECTED'
      leaveId = '',
      employeeName = 'พนักงาน',
      employeeCode = '',
      departmentName = '',
      recipientId = '', // ID พนักงานผู้รับแจ้งเตือน
      recipientRole = 'leader', // 'leader', 'manager', 'employee'
      recipientLineId = '',
      leaveType = 'ใบลา',
      startDate = '',
      endDate = '',
      totalDays = 1,
      reason = '',
      comment = ''
    } = opts;

    const nowStr = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    let title = "";
    let messageText = "";

    switch (type) {
      case 'NEW_REQUEST':
        title = "📩 มีคำขอใบลาใหม่ (รอหัวหน้างานอนุมัติ L1)";
        messageText = `📩 [แจ้งเตือนคำขอลาใหม่ - รอหัวหน้างานตรวจสอบ L1]\n` +
          `👤 ผู้ขอลา: ${employeeName} (${employeeCode || '-'})\n` +
          (departmentName ? `🏢 แผนก: ${departmentName}\n` : '') +
          `📝 ประเภทการลา: ${leaveType}\n` +
          `📅 ช่วงวันที่: ${startDate} ถึง ${endDate} (${totalDays} วัน)\n` +
          `💬 เหตุผลการลา: ${reason || '-'}\n` +
          `⏰ วันที่ส่งคำขอ: ${nowStr}\n\n` +
          `👉 กรุณาเข้าสู่ระบบเพื่อตรวจสอบและพิจารณาอนุมัติขั้นต้น`;
        break;

      case 'LEADER_APPROVED':
        title = "🟢 หัวหน้างานอนุมัติแล้ว (รอผู้จัดการฝ่ายอนุมัติ L2)";
        messageText = `🟢 [แจ้งเตือนใบลาผ่านการรับรอง - รอผู้จัดการฝ่ายอนุมัติ L2]\n` +
          `👤 ผู้ขอลา: ${employeeName} (${employeeCode || '-'})\n` +
          (departmentName ? `🏢 แผนก: ${departmentName}\n` : '') +
          `📝 ประเภทการลา: ${leaveType} (${totalDays} วัน)\n` +
          `📅 ช่วงวันที่: ${startDate} ถึง ${endDate}\n` +
          `💬 ความเห็นหัวหน้างาน: ${comment || 'หัวหน้างานตรวจสอบแล้ว เห็นควรอนุมัติ'}\n` +
          `⏰ ดำเนินการเมื่อ: ${nowStr}\n\n` +
          `👉 หัวหน้างานให้ความเห็นชอบแล้ว กรุณาเข้าสู่ระบบเพื่อพิจารณาอนุมัติขั้นสุดท้าย (L2)`;
        break;

      case 'FINAL_APPROVED':
        title = "🎉 ใบลาของคุณได้รับการอนุมัติสมบูรณ์แล้ว!";
        messageText = `👤 พนักงาน: ${employeeName}\n📝 ประเภทการลา: ${leaveType}\n📅 ช่วงวันที่: ${startDate} ถึง ${endDate} (${totalDays} วัน)\n✨ สถานะ: อนุมัติสมบูรณ์ (ใบลาเสร็จเรียบร้อย)\n⏰ อนุมัติเมื่อ: ${nowStr}`;
        break;

      case 'REJECTED':
        title = "❌ คำขอใบลาไม่ได้รับการอนุมัติ";
        messageText = `👤 พนักงาน: ${employeeName}\n📝 ประเภทการลา: ${leaveType}\n📅 ช่วงวันที่: ${startDate} ถึง ${endDate}\n⚠️ เหตุผลที่ไม่ผ่าน: ${comment || 'ไม่อนุมัติ'}\n⏰ ดำเนินการเมื่อ: ${nowStr}`;
        break;

      default:
        title = "📢 แจ้งเตือนระบบใบลา PVT HR";
        messageText = `ข้อมูลคำขอลาของคุณมีความเคลื่อนไหว (${type})`;
    }

    console.log(`💬 [LINE OA Engine] Processing [${type}] for ${recipientRole}:`, messageText);

    // 1. บันทึกแจ้งเตือนลงฐานข้อมูล (In-App Notifications)
    if (this.client && recipientId) {
      try {
        await this.client.from('notifications').insert([{
          user_id: recipientId,
          title: title,
          message: messageText.replace(/\*\*/g, ''),
          is_read: false
        }]);
      } catch (err) {
        console.warn("⚠️ [LINE OA Engine] DB notification log fallback:", err);
      }
    }

    // 2. 💬 กรองให้ส่งแจ้งเตือน LINE ภายนอกครอบคลุมทั้งกระบวนการลา:
    //   - ส่งคำขอลาใหม่ -> แจ้งเตือนผู้อนุมัติ
    //   - อนุมัติเบื้องต้น -> แจ้งเตือนผู้จัดการ
    //   - อนุมัติสมบูรณ์ / ปฏิเสธ -> แจ้งเตือนพนักงานผู้ขอลา
    const allowedLineTypes = ['NEW_REQUEST', 'LEADER_APPROVED', 'REQUEST_APPROVED', 'FINAL_APPROVED', 'REJECTED', 'TEST'];
    if (!allowedLineTypes.includes(type)) {
      console.log(`ℹ️ [LINE OA Engine] Skip external LINE message for [${type}] per workflow setting.`);
      return { success: true, title, message: messageText, lineSent: false };
    }

 // 3. ส่ง LINE ผ่าน Supabase Edge Function: line-send
if (!recipientLineId) {
  console.warn(
    "⚠️ [LINE OA] ผู้รับยังไม่มี LINE User ID:",
    recipientId
  );

  return {
    success: true,
    title,
    message: messageText,
    lineSent: false
  };
}

try {
  const LINE_SEND_URL =
    "https://pgogmhqjdchakyctsomx.supabase.co/functions/v1/line-send";

  const response = await fetch(LINE_SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: recipientLineId,
      message: messageText.replace(/\*\*/g, "")
    })
  });

  const resultText = await response.text();

  if (!response.ok) {
    console.error(
      "❌ [LINE OA] line-send Error:",
      response.status,
      resultText
    );

    return {
      success: false,
      title,
      message: messageText,
      lineSent: false
    };
  }

  console.log(
    "✅ [LINE OA] Push message sent:",
    recipientLineId
  );

  return {
    success: true,
    title,
    message: messageText,
    lineSent: true
  };

} catch (lineErr) {
  console.error(
    "❌ [LINE OA] line-send failed:",
    lineErr
  );

  return {
    success: false,
    title,
    message: messageText,
    lineSent: false
  };
}
  }
}

// ==========================================================================
  // 14. VIEWPORT & RESPONSIVE ENGINE
  // ==========================================================================
  class ViewportEngine {
    constructor() {
      this.isMobile = window.innerWidth <= 768;
      this.init();
    }

    init() {
      this.updateVh();
      // ลิสเซนเนอร์ตรวจจับการหมุนจอหรือย่อขยายเบราว์เซอร์
      window.addEventListener('resize', () => {
        this.updateVh();
        this.isMobile = window.innerWidth <= 768;
      });
    }

    // แก้ปัญหา 100vh บนมือถือ (แถบ URL บัง)
    updateVh() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    // คำนวณขนาด QR Code ให้เหมาะสมกับขนาดจออัตโนมัติ
    getAdaptiveQrSize() {
      const width = window.innerWidth;
      if (width < 360) return 130; // จอเล็กมาก (iPhone SE)
      if (width < 768) return 160; // จอมือถือทั่วไป
      return 200;                  // จอแท็บเล็ต / คอมพิวเตอร์
    }
  }

  // Export Global Instance
  global.PVTSDK = new PVTHRSdk();
  global.pvtSupabase = global.PVTSDK; // Backward Compatibility

})(typeof window !== "undefined" ? window : this);