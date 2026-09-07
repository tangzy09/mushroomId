/* sw.js — 三层离线缓存（照 fishId 的方案）
 * L1 核心：代码 + 数据，装机时逐条预缓存
 * L2 缩略图：assets/photos/thumb/ 166 张 1.2 MB，激活后后台预缓存 —— 断网时列表与检索全可用
 * L3 大图：assets/photos/real/，浏览时按需写入；拿不到时回退同名缩略图
 *
 * 采菇人在山里查，没信号是常态，所以这不是二期功能。
 *
 * 发版：改任何 JS/CSS 后同步 bump V（与 index.html 的 ?v= 用同一个日期串）。
 * 缓存键一律归一化为不带查询串的 pathname，读写同键。
 */
const V = '20260907b';
const CORE = 'mush-core-' + V;
const THUMB = 'mush-thumb-v1';
const IMG = 'mush-img-v1';          // 不带版本：升级时不丢用户已下载的大图
const KEEP = [CORE, THUMB, IMG];

// ⚠ 必须与 index.html 实际加载的脚本一一对应，漏一个离线时就是 ReferenceError
const CORE_URLS = [
  'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/game/config.js', 'js/core/storage.js', 'js/core/gacha.js', 'js/core/quiz.js',
  'js/core/share.js', 'js/core/transfer.js', 'js/game/weather.js', 'js/game/shroom-art.js',
  'js/game/garden.js', 'js/data.gen.js', 'js/photo_credits.js', 'js/game/app.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png'
];
const CORE_SET = new Set(CORE_URLS.map(u => new URL(u, self.registration.scope).pathname));
const isImg = p => /\/assets\/photos\/real\//.test(p);
const isThumb = p => /\/assets\/photos\/thumb\//.test(p);
const isCore = p => CORE_SET.has(p);
const keyOf = url => url.pathname;

async function precacheThumbs() {
  const cache = await caches.open(THUMB);
  let names = [];
  try { names = await (await fetch('assets/photos/thumb/index.json')).json(); } catch (e) { return; }
  for (const n of names) {
    const u = 'assets/photos/thumb/' + n;
    try {
      const k = new URL(u, self.registration.scope).pathname;
      if (!(await cache.match(k))) { const r = await fetch(u); if (r.ok) await cache.put(k, r); }
    } catch (e) { /* 单张失败不影响其余，下次激活续传 */ }
  }
}

self.addEventListener('install', e => {
  // 逐条缓存：addAll 是原子的，一个 404 会丢掉整批且无声
  e.waitUntil((async () => {
    const cache = await caches.open(CORE);
    const results = await Promise.allSettled(CORE_URLS.map(async u => {
      const r = await fetch(u, { cache: 'reload' });
      if (!r.ok) throw new Error(u + ' ' + r.status);
      await cache.put(new URL(u, self.registration.scope).pathname, r);
    }));
    const failed = results.filter(r => r.status === 'rejected');
    failed.forEach(r => console.warn('[sw] 预缓存失败:', r.reason && r.reason.message));
    if (failed.length === 0) self.skipWaiting();   // 核心不完整时不接管
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.indexOf('mush-') === 0 && KEEP.indexOf(k) < 0)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
  precacheThumbs();   // 后台跑，不阻塞激活
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const key = keyOf(url);

  // 导航：网络优先，断网回落缓存的 index.html
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { return await fetch(req); }
      catch (err) {
        const c = await caches.open(CORE);
        return (await c.match(new URL('index.html', self.registration.scope).pathname)) || Response.error();
      }
    })());
    return;
  }

  // 缩略图与大图：缓存优先
  if (isThumb(key) || isImg(key)) {
    e.respondWith((async () => {
      const hit = await caches.match(key);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) { const c = await caches.open(isThumb(key) ? THUMB : IMG); c.put(key, res.clone()); }
        return res;
      } catch (err) {
        // 大图拿不到就退回同名缩略图，断网时详情页仍然有画面
        if (isImg(key)) {
          const id = key.split('/').pop();
          const t = await caches.match(new URL('assets/photos/thumb/' + id, self.registration.scope).pathname);
          if (t) return t;
        }
        return Response.error();
      }
    })());
    return;
  }

  // 核心资源：缓存优先 + 后台更新（读写同键，?v= 不参与键）
  if (isCore(key)) {
    e.respondWith((async () => {
      const c = await caches.open(CORE);
      const hit = await c.match(key);
      const net = fetch(req).then(res => { if (res.ok) c.put(key, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || Response.error();
    })());
  }
});
