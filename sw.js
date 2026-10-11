/* Service worker A.R.M
   - Réseau d'abord, cache en secours (le site reste consultable hors ligne).
   - Ne touche QU'AUX fichiers du site lui-même : les requêtes Firebase
     (temps réel, connexion admin) ne doivent jamais être mises en cache.
   - Changer CACHE à chaque mise en ligne force les téléphones à prendre
     la nouvelle version. */
const CACHE = 'arm-cache-v3';
const ASSETS = ['./', 'index.html', 'app.js', 'armtv.js', 'data.js', 'utils.js', 'infinite-scroll.js',
                'manifest.json', 'logo.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // Firebase, CDN : on laisse passer
  if (url.pathname.endsWith('admin.html') || url.pathname.endsWith('admin.js')) return; // admin toujours à jour

  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) {
        const copie = res.clone();
        caches.open(CACHE).then(c => c.put(req, copie));
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
