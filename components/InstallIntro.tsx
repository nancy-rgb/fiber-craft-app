"use client";

import { useEffect, useState } from "react";

const SEEN_KEY = "fiber-craft-intro-seen";

/**
 * One-time welcome overlay shown on first visit: the logo plus
 * add-to-home-screen steps for phone users.
 */
export function InstallIntro() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      // Storage unavailable (private mode) — never block the app.
    }
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-intro-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-6"
    >
      <div className="relative flex w-full max-w-xs flex-col items-center gap-5 rounded-2xl bg-background p-6 text-center shadow-xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-muted"
        >
          ✕
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/logo.png" alt="Fiber Craft logo" className="size-32" />

        <h2
          id="install-intro-title"
          className="text-xl font-bold tracking-tight"
        >
          Install on your home screen
        </h2>

        <ol className="flex flex-col gap-2.5 text-left text-sm">
          <li className="flex gap-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-oat text-xs font-bold">
              1
            </span>
            <span>Tap the share icon</span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-oat text-xs font-bold">
              2
            </span>
            <span>Select &ldquo;Add to Home Screen&rdquo;</span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-oat text-xs font-bold">
              3
            </span>
            <span>Confirm the name and tap Add</span>
          </li>
        </ol>

        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 w-full rounded-xl bg-accent font-semibold text-accent-foreground"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
