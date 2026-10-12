/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import { OFFLINE_SHELL_ID } from "@/lib/offlineShell";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const isProjectPage = (url: string) =>
  /^\/project\/[^/]+\/?$/.test(new URL(url).pathname);

// Pages must always match the deployed build. defaultCache serves HTML
// documents and RSC payloads NetworkFirst for 24h, so a stale page can pair
// with fresh JS chunks after a deploy and every tap silently dies. Force
// documents and RSC data to the network; offline navigation still lands on
// the precached fallbacks below.
const freshPages = [
  {
    matcher: ({ request, url: { pathname }, sameOrigin }: { request: Request; url: URL; sameOrigin: boolean }) =>
      request.headers.get("RSC") === "1" &&
      request.headers.get("Next-Router-Prefetch") === "1" &&
      sameOrigin &&
      !pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request, url: { pathname }, sameOrigin }: { request: Request; url: URL; sameOrigin: boolean }) =>
      request.headers.get("RSC") === "1" &&
      sameOrigin &&
      !pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request, url: { pathname }, sameOrigin }: { request: Request; url: URL; sameOrigin: boolean }) =>
      request.headers.get("Content-Type")?.includes("text/html") &&
      sameOrigin &&
      !pathname.startsWith("/api/"),
    handler: new NetworkOnly(),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...freshPages, ...defaultCache],
  // Offline navigations that miss the cache fall back to a precached page.
  // Project data lives in IndexedDB, so one shell renders every project.
  fallbacks: {
    entries: [
      {
        url: `/project/${OFFLINE_SHELL_ID}`,
        matcher: ({ request }) =>
          request.destination === "document" && isProjectPage(request.url),
      },
      {
        url: "/",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
