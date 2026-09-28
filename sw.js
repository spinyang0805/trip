// TripMaster service worker:網路優先,確保每次開網頁都是最新版。
// GitHub Pages 固定回 Cache-Control: max-age=600,瀏覽器會拿 10 分鐘內的舊檔;
// 這裡對本站檔案一律 cache:'no-store' 向伺服器取,只有離線時才用上次存下的版本。
// 外部網域只處理「帶版本號、內容不會變」的 Firebase SDK 與字型(快取優先,讓離線也能開);
// Firebase 資料連線、Google Maps 等其他外部請求一律不攔截。
const CACHE = 'tripmaster-offline';
const LIB_CACHE = 'tripmaster-libs';
const LIB_PREFIXES = [
  'https://www.gstatic.com/firebasejs/',
  'https://fonts.googleapis.com/',
  'https://fonts.gstatic.com/',
];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (LIB_PREFIXES.some(p => req.url.startsWith(p))) {
    e.respondWith(
      caches.open(LIB_CACHE).then(async c => {
        const hit = await c.match(req.url);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req.url, res.clone());
        return res;
      })
    );
    return;
  }

  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    // navigate 模式的 Request 不能帶 init 重新建構,所以用 URL 取
    fetch(req.url, { cache: 'no-store', credentials: 'same-origin' })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req.url, copy));
        }
        return res;
      })
      .catch(async () =>
        (await caches.match(req.url)) ||
        (await caches.match(req.url, { ignoreSearch: true })) ||
        Response.error())
  );
});
