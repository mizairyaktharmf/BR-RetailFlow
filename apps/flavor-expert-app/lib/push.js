/**
 * Web Push Notification utility
 * Handles: service worker registration, permission request, subscription, and server sync
 *
 * Usage:
 *   import { initPushNotifications } from '@/lib/push'
 *   // Call after successful login:
 *   await initPushNotifications()
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Convert a base64 URL-safe string to a Uint8Array
 * Required for the applicationServerKey parameter
 */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Get the auth token from localStorage
 */
function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("br_token");
}

/**
 * Fetch the VAPID public key from the backend
 */
async function getVapidPublicKey() {
  const res = await fetch(`${API_BASE}/api/v1/notifications/vapid-public-key`);
  if (!res.ok) throw new Error("Failed to get VAPID public key");
  const data = await res.json();
  return data.public_key;
}

/**
 * Send the push subscription to the backend to store it
 */
async function sendSubscriptionToServer(subscription) {
  const token = getToken();
  if (!token) return;

  const res = await fetch(`${API_BASE}/api/v1/notifications/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });

  if (!res.ok) {
    console.error("Failed to save push subscription to server");
  }
}

/**
 * Unsubscribe from push and notify the backend
 */
export async function unsubscribePush() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Notify backend
      const token = getToken();
      if (token) {
        fetch(`${API_BASE}/api/v1/notifications/unsubscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ endpoint }),
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error("Error unsubscribing from push:", err);
  }
}

/**
 * Main function: register service worker, request permission, subscribe to push
 * Call this after login succeeds.
 * Returns true if push was successfully enabled, false otherwise.
 */
export async function initPushNotifications() {
  // Check browser support
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("Push notifications not supported in this browser");
    return false;
  }

  try {
    // 1. Register the service worker
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    console.log("Service worker registered");

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;

    // 2. Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // 3. Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log("Notification permission denied");
        return false;
      }

      // 4. Get VAPID public key from backend
      const vapidPublicKey = await getVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // 5. Subscribe to push
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // required by Chrome
        applicationServerKey,
      });
      console.log("Push subscription created");
    }

    // 6. Send subscription to backend
    await sendSubscriptionToServer(subscription);
    console.log("Push subscription synced with server");
    return true;
  } catch (err) {
    console.error("Failed to initialize push notifications:", err);
    return false;
  }
}
