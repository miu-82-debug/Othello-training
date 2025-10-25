/* sw.js */
const SW_VERSION = 'v1.0.0';
const STATIC_CACHE = `othello-static-${SW_VERSION}`;
const RUNTIME_CACHE = `othello-runtime-${SW_VERSION}`;

// ここに最低限のアセットを登録（必要に応じて追加可）
const CORE_ASSETS = [
  './',
  './index.html',
  './othello_trainer_v23_20251025.html',
  './manifest.webmanifest'
  // アイコン類は runtime で取得（自動キャッシュ）
];

// install: コア資産をキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// activate: 古いキャッシュのクリーンアップ
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => {
        if (!k.includes(SW_VERSION)) return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

// fetch: ナビゲーションは network-first、その他は SWR
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 1) ページ遷移（document）
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(STATIC_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          const cache = await caches.open(STATIC_CACHE);
          const cached = await cache.match(req) || await cache.match('./index.html');
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 2) その他（CSS/JS/画像等）は stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(req);
      const networkPromise = fetch(req).then((res) => {
        if (res && res.status === 200) {
          cache.put(req, res.clone());
        }
        return res;
      }).catch(() => null);

      // まずキャッシュがあれば即返し、裏で更新
      return cached || networkPromise || fetch(req);
    })()
  );
});
