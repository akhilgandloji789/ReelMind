// ReelMind Service Worker for PWA Installation, Share Target, and Notifications
const CACHE_NAME = "reelmind-v4";
const PRECACHE_ASSETS = ["/", "/inbox", "/sunday", "/manifest.json"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("Service worker prefill skipped:", err);
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("Purging old service worker cache:", key);
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

  // Do not intercept non-GET requests or backend API requests
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // For HTML navigation requests: Network first, fallback to cached HTML
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return caches.match("/");
        })
    );
    return;
  }

  // For static assets (scripts, css, images): Network first, fallback to cache, NEVER fallback to '/'
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Push event listener for incoming cloud notifications
self.addEventListener("push", (event) => {
  let data = {
    title: "The ReelMind Chronicle",
    body: "New dispatch printed on the rotary press!",
    url: "/sunday",
  };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/sunday" },
    actions: [
      { action: "open", title: "Read Dispatch" },
      { action: "close", title: "Dismiss" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Click notification handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/sunday";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
