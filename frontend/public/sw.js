// ReelMind Service Worker for PWA Installation and Web Share Target
const CACHE_NAME = "reelmind-v1";
const OFFLINE_URLS = ["/", "/inbox", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS).catch((err) => {
        console.warn("Service worker offline cache prefill skipped:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // If a POST share arrives at /share-target, convert to GET redirect with query parameters
  if (url.pathname === "/share-target" && event.request.method === "POST") {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const title = formData.get("title") || "";
          const text = formData.get("text") || "";
          const sharedUrl = formData.get("url") || "";

          const targetUrl = new URL("/share-target", event.request.url);
          if (title) targetUrl.searchParams.set("title", String(title));
          if (text) targetUrl.searchParams.set("text", String(text));
          if (sharedUrl) targetUrl.searchParams.set("url", String(sharedUrl));

          return Response.redirect(targetUrl.href, 303);
        } catch (e) {
          return Response.redirect("/share-target", 303);
        }
      })()
    );
    return;
  }

  // Standard fetch strategy: Network first with cache fallback
  if (event.request.method === "GET") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        return caches.match("/");
      })
    );
  }
});
