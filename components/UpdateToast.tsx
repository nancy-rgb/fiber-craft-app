"use client";

import { useEffect, useState } from "react";

/**
 * Shows a one-tap refresh banner when a new service worker takes over
 * (skipWaiting + clientsClaim make it claim the page immediately). Guarded
 * by an existing controller so it never appears on first install.
 */
export function UpdateToast() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const hadController = navigator.serviceWorker.controller !== null;
    const onChange = () => {
      if (hadController) setUpdateReady(true);
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    return () =>
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onChange,
      );
  }, []);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 mx-auto w-full max-w-md px-4"
    >
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
        <p className="text-sm font-medium text-foreground">
          A new version is ready.
        </p>
        <button
          type="button"
          onClick={() => location.reload()}
          className="min-h-10 shrink-0 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
