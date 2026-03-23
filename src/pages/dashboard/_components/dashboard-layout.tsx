import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarClock,
  MessageCircle,
  Trophy,
  FolderOpen,
  LogOut,
  Menu,
  X,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useAuth } from "@/hooks/use-auth.ts";
import { useState } from "react";
import { toast } from "sonner";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
    enabled: true,
  },
  {
    label: "Shifts",
    icon: CalendarClock,
    path: "/shifts",
    enabled: true,
  },
  {
    label: "Messages",
    icon: MessageCircle,
    path: "/messages",
    enabled: true,
  },
  {
    label: "Rewards",
    icon: Trophy,
    path: "/rewards",
    enabled: false,
  },
  {
    label: "Documents",
    icon: FolderOpen,
    path: "/documents",
    enabled: false,
  },
];

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { removeUser } = useAuth();
  const user = useQuery(api.users.getCurrentUser);

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b">
        <a href="/" className="flex items-center gap-2.5">
          <div className="size-9 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-heading font-black text-sm">
              CS
            </span>
          </div>
          <span className="font-heading font-bold text-lg tracking-tight text-foreground">
            CrewSync
          </span>
        </a>
      </div>

      {/* User info */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-sm">
            {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.name ?? "Loading..."}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.role === "admin" ? "Admin" : "Team Member"}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => {
                if (item.enabled) {
                  navigate(item.path);
                } else {
                  toast.info(
                    `${item.label} is coming soon in a future milestone!`
                  );
                }
                onItemClick?.();
              }}
              className={cn(
                "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                !item.enabled && "opacity-60"
              )}
            >
              <item.icon className="size-5 shrink-0" />
              <span>{item.label}</span>
              {!item.enabled && (
                <span className="ml-auto text-[10px] uppercase tracking-wider opacity-70">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="p-3 border-t">
        <button
          onClick={async () => {
            await removeUser();
          }}
          className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="size-5 shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

function DashboardShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-card fixed inset-y-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent onItemClick={() => setMobileOpen(false)} />
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-20 bg-card border-b px-4 h-14 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(true)}
          >
            {mobileOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </Button>
          <span className="font-heading font-bold text-base">CrewSync</span>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <div className="space-y-4 w-full max-w-sm">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
          <div className="size-14 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-heading font-black text-xl">
              CS
            </span>
          </div>
          <h1 className="font-heading font-bold text-2xl">
            Sign in to CrewSync
          </h1>
          <p className="text-muted-foreground text-center max-w-sm">
            Access your dashboard, shifts, messages and more.
          </p>
          <SignInButton size="lg" />
        </div>
      </Unauthenticated>
      <Authenticated>
        <DashboardShell />
      </Authenticated>
    </>
  );
}
