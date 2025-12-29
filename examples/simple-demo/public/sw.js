"use strict";
(() => {
  // packages/client/src/sw.ts
  self.addEventListener("install", (event) => {
    console.log("[SW] Installed");
    event.waitUntil(self.skipWaiting());
  });
  self.addEventListener("activate", (event) => {
    console.log("[SW] Activated");
    event.waitUntil(self.clients.claim());
  });
  self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith("/p2p/")) {
      event.respondWith(handleRequest(event.request));
    }
  });
  async function handleRequest(request) {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = clients.length > 0 ? clients[0] : null;
    if (!client) {
      return new Response("No client connected to SW", { status: 503 });
    }
    const requestId = crypto.randomUUID();
    let body = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      try {
        const contentType = request.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          body = await request.json();
        } else {
          body = await request.text();
        }
      } catch (e) {
        console.warn("[SW] Failed to serialize body", e);
      }
    }
    const tunnelRequest = {
      type: "TUNNEL_REQUEST",
      requestId,
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers.entries()),
      body
    };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        self.removeEventListener("message", handler);
        resolve(new Response("Gateway Timeout: Bridge did not respond", { status: 504 }));
      }, 5e3);
      const handler = (event) => {
        const data = event.data;
        if (data.type === "TUNNEL_RESPONSE" && data.requestId === requestId) {
          clearTimeout(timeout);
          self.removeEventListener("message", handler);
          resolve(new Response(data.body, {
            status: data.status,
            statusText: data.statusText,
            headers: data.headers
          }));
        }
      };
      self.addEventListener("message", handler);
      client.postMessage(tunnelRequest);
    });
  }
})();
//# sourceMappingURL=sw.js.map
