/* Cache the shell + hashed assets only. Never cache /src/ (Vite HMR). */
const CACHE = "chaind-blitz-v3";

function shellRoot() {
  try {
    return new URL("./", self.registration.scope).pathname;
  } catch {
    return "/";
  }
}

function precacheUrls() {
  const root = shellRoot();
  return [root, `${root}index.html`, `${root}manifest.webmanifest`];
}

function shouldCache(url) {
  if (url.origin !== self.location.origin) return false;
  const root = shellRoot();
  if (url.pathname.startsWith(`${root}assets/`)) return true;
  return precacheUrls().includes(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(precacheUrls())).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!shouldCache(url)) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
