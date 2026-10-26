// Service worker: only shows push notifications and opens the right screen.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "resto" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "resto", {
      body: data.body || "",
      tag: data.tag,
      renotify: !!data.tag,
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      vibrate: [200, 100, 200],
      requireInteraction: !!data.urgent,
      data: { url: data.url || "/go" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/go", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
