// 원사부 업무보고 — 설치형 앱(PWA)용 서비스워커
// 화면(index.html)은 항상 인터넷에서 최신 것을 먼저 받아오고, 끊겼을 때만 저장본을 보여줘요.
// Firebase·외부 라이브러리 요청은 건드리지 않아요 (데이터는 항상 실시간).
const CACHE = 'wonsabu-v1011-31';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;
  const isPage = r.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html');
  if (isPage) {
    e.respondWith(fetch(r, { cache: 'no-store' }).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); }
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
    return res;
  }).catch(() => caches.match(r)));
});

// 알림을 누르면: 열려 있는 업무보고 창을 앞으로 가져오고 해당 화면으로 이동, 없으면 새로 엶
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const go = (e.notification.data && e.notification.data.go) || {};
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list.find(x => x.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ type: 'noti-go', go }); return c.focus(); }
    return self.clients.openWindow('./');
  }));
});

// 서버 푸시 도착 (앱이 닫혀 있어도): 업무보고 화면을 보고 있는 중이면 화면 안내로 대신하고, 아니면 알림을 띄움
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { data: { title: '원사부 업무보고', body: e.data ? e.data.text() : '' } }; }
  const m = d.data || d;
  let go = {};
  try { go = typeof m.go === 'string' ? JSON.parse(m.go) : (m.go || {}); } catch (x) {}
  const ios = /iPhone|iPad|iPod/.test(self.navigator.userAgent);
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    list.forEach(c => c.postMessage({ type: 'push-seen' }));
    if (!ios && list.some(c => c.visibilityState === 'visible' && c.focused)) return;   // 지금 보고 있으면 화면 안 안내만
    return self.registration.showNotification(m.title || '원사부 업무보고', {
      body: m.body || '', tag: m.tag || undefined, renotify: !!m.tag,
      icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png', data: { go }
    });
  }));
});
