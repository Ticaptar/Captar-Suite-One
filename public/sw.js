const CACHE_NAME = "captar-suite-v3";
const PRECACHE_ASSETS = [
  "/manifest.webmanifest",
  "/icon-192.svg",
  "/icon-512.svg",
  "/logo-captar.svg",
  "/logo-almir.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca cachear APIs para evitar dados/layout antigos.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  const acceptsHtml = (event.request.headers.get("accept") || "").includes("text/html");
  const isNavigation = event.request.mode === "navigate" || acceptsHtml;

  // Para navegação/documento: sempre rede primeiro.
  if (isNavigation) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        return cached || Response.error();
      }),
    );
    return;
  }

  const isNextStatic = url.pathname.startsWith("/_next/static/");
  const hasStaticExtension = /\.(?:css|js|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname);
  const shouldCache = isNextStatic || hasStaticExtension;

  if (!shouldCache) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets: cache com atualização em background.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    }),
  );
});
