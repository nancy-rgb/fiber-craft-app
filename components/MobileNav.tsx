"use client";

import { Camera } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    ),
  },
  {
    href: "/garments/new",
    label: "Garment",
    icon: <path d="M8 3 3 6l2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0Z" />,
  },
  {
    href: "/amigurumi/new",
    label: "Amigurumi",
    icon: (
      <>
        <circle cx="12" cy="13" r="7" />
        <circle cx="6.5" cy="5.5" r="2.5" />
        <circle cx="17.5" cy="5.5" r="2.5" />
      </>
    ),
  },
  {
    href: "/hats/new",
    label: "Hat",
    icon: (
      <>
        <circle cx="12" cy="4.5" r="1.5" />
        <path d="M5.5 14a6.5 6.5 0 0 1 13 0" />
        <path d="M4 14h16v6H4z" />
      </>
    ),
  },
  {
    href: "/socks/new",
    label: "Socks",
    icon: (
      <>
        <path d="M8 3h7v9l4.4 3.1a2.9 2.9 0 0 1-1.7 5.3h-6.1a4.6 4.6 0 0 1-3.6-7.5V3Z" />
        <path d="M8 6.5h7" />
      </>
    ),
  },
  {
    href: "/colorwork/new",
    label: "Photo",
    icon: null,
    Icon: Camera,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-md grid-cols-6">
        {tabs.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 px-0.5 text-[11px] font-medium ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                {tab.Icon ? (
                  <span
                    className={`flex size-8 items-center justify-center rounded-full ${
                      active
                        ? "bg-accent text-accent-foreground"
                        : "bg-accent/15 text-accent"
                    }`}
                  >
                    <tab.Icon
                      className="size-5"
                      strokeWidth={1.8}
                      aria-hidden
                    />
                  </span>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="size-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {tab.icon}
                  </svg>
                )}
                <span className="text-center leading-tight">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
