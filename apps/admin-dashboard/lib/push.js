/**
 * Web Push Notification utility for Admin Dashboard
 * Registers managers/admins to receive cake low-stock alerts.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("br_token");
}

async function getVapidPublicKey() {
  const res = await fetch(`${API_BASE}/api/v1/notifications/vapid-public-key`);
  if (!res.ok) throw new Error("Failed to get VAPID public key");
  const data = await res.json();
  return data.public_key;
}

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
    console.error("Failed to save admin push subscription to server");
  }
}

/**
 * Initialize push notifications for admin dashboard.
 * Call this after successful login.
 * Returns true if push was successfully enabled, false otherwise.
 */
export async function initAdminPush() {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.log("Push notifications not supported");
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log("Notification permission denied");
        return false;
      }

      const vapidPublicKey = await getVapidPublicKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }

    await sendSubscriptionToServer(subscription);
    console.log("Admin push subscription synced");
    return true;
  } catch (err) {
    console.error("Failed to init admin push:", err);
    return false;
  }
}
