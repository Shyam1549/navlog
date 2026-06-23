const CACHE_NAME = "navlog-offline-v2";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./sw.js",
];
const EXTERNAL_ASSETS = [
  "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js",
  "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL_ASSETS.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        // ignore pre-cache misses
      }
    }));
    await Promise.all(EXTERNAL_ASSETS.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        // ignore pre-cache misses
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("navlog-offline-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    );
    await self.clients.claim();
  })());
});

function isNetworkOnlyRequest(request) {
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return true;
  if (/\.supabase\.co$/i.test(url.hostname)) return true;
  return false;
}

function shouldHandleRequest(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) return true;
  if (url.hostname === "cdn.jsdelivr.net") return true;
  return false;
}

async function cacheResponse(request, response) {
  if (!response) return;
  if (!(response.ok || response.type === "opaque")) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!shouldHandleRequest(request)) return;

  if (isNetworkOnlyRequest(request)) {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error("offline");
      }
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const network = await fetch(request);
        await cacheResponse(request, network);
        return network;
      } catch {
        const cachedPage = await caches.match(request);
        if (cachedPage) return cachedPage;
        const rootCached = await caches.match("./index.html");
        if (rootCached) return rootCached;
        throw new Error("offline");
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    const networkFetch = fetch(request)
      .then(async (response) => {
        await cacheResponse(request, response);
        return response;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(networkFetch);
      return cached;
    }

    const network = await networkFetch;
    if (network) return network;
    throw new Error("offline");
  })());
});
