/**
 * Service Worker for Admin Dashboard Web Push Notifications
 * Handles cake low-stock alerts sent to managers/admins.
 */

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "BR-RetailFlow Alert", body: event.data.text() };
  }

  const options = {
    body: data.body || "You have a new alert",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/dashboard/cake-alerts",
      timestamp: data.timestamp || Date.now(),
    },
    actions: [
      { action: "open", title: "View Alerts" },
      { action: "dismiss", title: "Dismiss" },
    ],
    requireInteraction: true,
    tag: "cake-alert",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Cake Stock Alert", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/dashboard/cake-alerts";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(clients.claim()));
