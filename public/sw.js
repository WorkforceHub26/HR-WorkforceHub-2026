// PVT Workforce Hub - Service Worker
// - หน้าเว็บ/ไฟล์ของระบบ: "เน็ตก่อน" (ได้เวอร์ชันล่าสุดเสมอ) ถ้าเน็ตหลุดค่อยใช้สำเนาที่เก็บไว้
// - ไลบรารีจาก CDN / ฟอนต์: ใช้สำเนาก่อนแล้วอัปเดตเบื้องหลัง (เปิดเร็วขึ้น)
// - ข้อมูล Supabase / /api/ : ไม่แตะเลย (ข้อมูลสดเสมอ)
const VERSION = 'pvt-v20261006-status';
const CACHE_PAGES = VERSION + '-app';
const CACHE_CDN = VERSION + '-cdn';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  OFFLINE_URL,
  '/css/mobile-shell.css',
  '/js/mobile-shell.js',
  '/js/theme-boot.js',
  '/assets/icons/PVTT_LEAVE.png',
  '/assets/icons/icon-192.png'
];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_PAGES)
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function isDevInternal(url) {
  // ไฟล์ภายในของ Vite dev server / HMR
  return url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/src/') || url.search.includes('import') || url.pathname.includes('hot-update');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ไลบรารี CDN: stale-while-revalidate
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(CACHE_CDN).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;           // Supabase / API ภายนอก
  if (url.pathname.startsWith('/api/') || isDevInternal(url)) return;

  // ไฟล์ของระบบ + หน้าเว็บ: network-first
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_PAGES).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(async () => {
      const cached = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const offline = await caches.match(OFFLINE_URL);
        if (offline) return offline;
      }
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});
