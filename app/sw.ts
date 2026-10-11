/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import { OFFLINE_SHELL_ID } from "@/lib/offlineShell";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const isProjectPage = (url: string) =>
  /^\/project\/[^/]+\/?$/.test(new URL(url).pathname);

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
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
