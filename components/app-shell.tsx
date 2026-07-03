"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
  Inbox,
  LayoutDashboard,
  MailCheck,
  Search,
  Settings,
  Upload,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/research", label: "Research", icon: Search },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/leads/new", label: "Add Lead", icon: MailCheck },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/drafts", label: "Drafts", icon: Inbox },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-border bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-white">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">OutreachFlow</p>
            <p className="text-xs text-slate-500">Solo agency workspace</p>
          </div>
        </div>
        <nav className="space-y-1 p-3" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2 lg:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-white">
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold">OutreachFlow</span>
            </Link>
            <nav className="hidden items-center gap-1 overflow-x-auto md:flex lg:hidden" aria-label="Mobile navigation">
              {navItems.slice(0, 5).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition duration-150 ease-out hover:bg-slate-100",
                    isActive(item.href) && "bg-teal-50 text-teal-800"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
              <span className="hidden sm:inline">Signed in</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  item,
  active
}: {
  item: (typeof navItems)[number];
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition duration-150 ease-out",
        "hover:-translate-y-0.5 hover:bg-slate-100 hover:text-slate-950 active:translate-y-0",
        active && "bg-teal-50 text-teal-800 shadow-sm"
      )}
    >
      <item.icon
        className={cn("h-4 w-4 transition-transform duration-150 ease-out", active && "scale-110")}
        aria-hidden="true"
      />
      {item.label}
    </Link>
  );
}
