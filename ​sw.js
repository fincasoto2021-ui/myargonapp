const CACHE_NAME = 'argon-ai-gold-v2026-11';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon%20(3).png'
];

// 1. Instalación: guarda la base y fuerza activación inmediata sin esperar a cerrar pestañas
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );
    })
  );
});

// 2. Activación: destruye todos los cachés viejos de versiones anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Estrategia inteligente:
// - Firebase, Cloudinary y YouTube pasan directo por internet (nunca se congelan en caché)
// - HTML / navegación siempre busca primero la última versión en el servidor (Network-First)
// - Íconos y recursos estáticos cargan rápido y se actualizan en segundo plano
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Nunca interceptar Firebase, Cloudinary, Stripe ni reproductores externos
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('cloudinary.com') ||
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('ytimg.com')
  ) {
    return;
  }

  // Para la página principal (index.html): Internet primero, caché solo si no hay señal
  if (req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((networkRes) => {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return networkRes;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Para íconos y manifest: Caché rápido con actualización silenciosa
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      const networkFetch = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkRes;
        })
        .catch(() => cachedRes);

      return cachedRes || networkFetch;
    })
  );
});
