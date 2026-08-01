const CACHE = 'arm-cache-v1';
const ASSETS = ['index.html', 'app.js', 'data.js', 'manifest.json', 'admin.html', 'admin.js', 'logo.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

/* ===================== NOTIFICATIONS PUSH EN ARRIÈRE-PLAN ===================== */
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: "AIzaSyBcDKDathrYFPCmgh-b9RGoErGcr0UeoPE",
    authDomain: "arm-boua.firebaseapp.com",
    projectId: "arm-boua",
    storageBucket: "arm-boua.firebasestorage.app",
    messagingSenderId: "988539942178",
    appId: "1:988539942178:web:9dab94952ac8ffd936e17b"
  });
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const titre = (payload.notification && payload.notification.title) || 'A.R.M';
    const corps = (payload.notification && payload.notification.body) || '';
    self.registration.showNotification(titre, { body: corps, icon: 'icon-192.png' });
  });
} catch (err) { /* Cloud Messaging pas encore configuré : sans effet sur le reste du site */ }
