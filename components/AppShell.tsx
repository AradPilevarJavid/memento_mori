"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { InstallPrompt } from "@/components/InstallPrompt";

const NAVIGATION = [
  { href: "/", label: "Today" },
  { href: "/library", label: "Library" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="MEMENTO MORI home">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>
          <span className="brand-text">MEMENTO MORI</span>
        </Link>

        <nav className="desktop-nav" aria-label="Primary">
          {NAVIGATION.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(pathname, item.href) ? "nav-link nav-link-active" : "nav-link"}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <p className="footer-line">Remember you must die.</p>
        <InstallPrompt />
      </footer>

      <nav className="mobile-nav" aria-label="Primary mobile">
        {NAVIGATION.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(pathname, item.href) ? "mobile-link mobile-link-active" : "mobile-link"}
            aria-current={isActive(pathname, item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
