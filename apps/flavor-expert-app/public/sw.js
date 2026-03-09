/**
 * Service Worker for Web Push Notifications
 * This file MUST be in /public so it's served from the root URL path.
 * The browser registers it and it runs in the background even when the app is closed.
 */

// Called when a push notification arrives from the server
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    // Fallback if payload is plain text
    data = {
      title: "BR-RetailFlow",
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || "You have a new notification",
    icon: data.icon || "/icons/cake-alert.png",
    badge: data.badge || "/icons/badge.png",
    // vibrate pattern: vibrate 200ms, pause 100ms, vibrate 200ms
    vibrate: [200, 100, 200],
    // data is passed to the notificationclick handler
    data: {
      url: data.url || "/cake/stock",
      timestamp: data.timestamp || Date.now(),
    },
    // Actions: buttons on the notification (Chrome/Edge support)
    actions: [
      { action: "open", title: "View Stock" },
      { action: "dismiss", title: "Dismiss" },
    ],
    // Keep notification visible until user interacts
    requireInteraction: true,
    // Tag groups notifications (same tag replaces previous)
    tag: "cake-alert",
    // Renotify even if tag is same (so user notices updates)
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title || "Cake Alert", options));
});

// Called when user clicks the notification
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  // Open the app at the specified URL, or focus if already open
  const targetUrl = event.notification.data?.url || "/cake/stock";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If the app is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Called when the service worker is installed (first time or update)
self.addEventListener("install", (event) => {
  // Activate immediately instead of waiting
  self.skipWaiting();
});

// Called when the service worker takes control
self.addEventListener("activate", (event) => {
  // Claim all open tabs immediately
  event.waitUntil(clients.claim());
});
