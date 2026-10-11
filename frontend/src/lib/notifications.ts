/**
 * Mobile Push & System Notification Utilities
 * Triggers native system notifications on Android / mobile devices
 * via Service Worker and Web Notifications API.
 */

export async function checkNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  return Notification.permission;
}

export async function sendMobileNotification(title?: string, body?: string, url?: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (!("Notification" in window)) {
    throw new Error("Push notifications are not supported on this browser.");
  }

  // Request permission if not yet decided
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted. Please tap 'Allow' when your browser asks.");
  }

  const notificationTitle = title || "🗞️ THE REELMIND CHRONICLE";
  const notificationBody =
    body || "Sunday Edition Ready: 14 Dispatches filed this week. Tap to read your weekly intelligence brief!";
  const targetUrl = url || "/sunday";

  // Use ServiceWorker registration for true background native mobile notifications
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(notificationTitle, {
        body: notificationBody,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "reelmind-sunday-" + Date.now(),
        vibrate: [250, 100, 250, 100, 250],
        data: { url: targetUrl },
      } as NotificationOptions);
      return true;
    } catch (e) {
      console.warn("ServiceWorker showNotification failed, trying standard Notification fallback:", e);
    }
  }

  // Fallback to standard Notification API
  new Notification(notificationTitle, {
    body: notificationBody,
    icon: "/icon-192.png",
  });
  return true;
}
