import Link from "next/link";
import {
  BarChart3,
  FileText,
  Inbox,
  LayoutDashboard,
  MailCheck,
  Settings,
  Upload,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/leads/new", label: "Add Lead", icon: MailCheck },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/drafts", label: "Drafts", icon: Inbox },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
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
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              )}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
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
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
              <span className="hidden sm:inline">Owner-only</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
