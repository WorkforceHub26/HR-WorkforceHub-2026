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
async getProfile(forceRefresh = false) {
  const cacheKey = "user_profile";
  if (!forceRefresh) {
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
  }

  // 1. เช็คข้อมูลจาก localStorage (currentUser) ของระบบเดิมก่อนเสมอ
  try {
    const rawUser = localStorage.getItem("currentUser");
    if (rawUser) {
      const localUser = JSON.parse(rawUser);
      if (localUser && (localUser.id || localUser.employee_code)) {
        this.cache.set(cacheKey, localUser, CONFIG.DEFAULT_TTL, ["profile"]);
        return localUser;
      }
    }
  } catch (e) {
    console.warn("[SDK] Error parsing currentUser from localStorage", e);
  }

  // 2. Fallback: กรณีใช้ Supabase Auth Session
  const session = await global.PVTSDK.auth.getSession();
  if (session?.user) {
    const { data: employee } = await this.client
      .from("employees")
      .select(`*, departments(department_name), positions(position_name)`)
      .or(`id.eq.${session.user.id},email.eq.${session.user.email}`)
      .maybeSingle();

    if (employee) {
      this.cache.set(cacheKey, employee, CONFIG.DEFAULT_TTL, ["profile"]);
      return employee;
    }
  }

  return null;
}

    async getEmployeesList(options = {}) {
      const { search = "", departmentId = null, role = null, page = 1, limit = 20 } = options;
      const cacheKey = `employees_list_${search}_${departmentId}_${role}_${page}`;
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
  }

  // ✅ เพิ่มฟังก์ชันนี้เพื่อดึง Supabase Client โดยตรง
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

  // Export Global Instance
  global.PVTSDK = new PVTHRSdk();
  global.pvtSupabase = global.PVTSDK; // Backward Compatibility

})(typeof window !== "undefined" ? window : this);