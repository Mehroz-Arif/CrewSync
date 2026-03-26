import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  Clock,
  CalendarOff,
  MessageCircle,
  Trophy,
  FolderOpen,
  MessageSquareText,
  UsersRound,
  LogOut,
  Menu,
  X,
  Settings,
  Eye,
  ShieldCheck,
  BarChart3,
  Ban,
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
import {
  StaffPreviewProvider,
  useStaffPreview,
} from "@/hooks/use-staff-preview.tsx";
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
    label: "Timesheets",
    icon: Clock,
    path: "/timesheets",
    enabled: true,
  },
  {
    label: "Leave",
    icon: CalendarOff,
    path: "/leave",
    enabled: true,
  },
  {
    label: "Calendar",
    icon: CalendarDays,
    path: "/calendar",
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
    enabled: true,
  },
  {
    label: "Documents",
    icon: FolderOpen,
    path: "/documents",
    enabled: true,
  },
  {
    label: "Feedback",
    icon: MessageSquareText,
    path: "/feedback",
    enabled: true,
  },
  {
    label: "Team",
    icon: UsersRound,
    path: "/team",
    enabled: true,
  },
  {
    label: "Reports",
    icon: BarChart3,
    path: "/reports",
    enabled: true,
    adminOnly: true,
  },
  {
    label: "Super Admin",
    icon: ShieldCheck,
    path: "/admin",
    enabled: true,
    superAdminOnly: true,
  },
  {
    label: "Settings",
    icon: Settings,
    path: "/settings",
    enabled: true,
  },
];

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { removeUser } = useAuth();
  const user = useQuery(api.users.getCurrentUser);
  const organization = useQuery(api.organizations.getMyOrganization);
  const { isPreviewingAsStaff, togglePreview } = useStaffPreview();
  const isRealAdmin = user?.role === "admin";
  const isSuperAdmin = user?.isSuperAdmin === true;

  return (
    <div className="flex flex-col h-full">
      {/* Staff preview banner */}
      {isRealAdmin && isPreviewingAsStaff && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2">
          <Eye className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Viewing as Team Member
          </span>
        </div>
      )}

      {/* Logo */}
      <div className="p-4 border-b flex items-center justify-center">
        <a href="/" className="flex items-center justify-center">
          {organization?.logoUrl ? (
            <img
              src={organization.logoUrl}
              alt={`${organization.name} logo`}
              className="h-14 max-w-[220px] object-contain"
            />
          ) : (
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-heading font-black text-sm">
                  CS
                </span>
              </div>
              <span className="font-heading font-bold text-lg tracking-tight text-foreground truncate">
                {organization?.name ?? "CrewSync"}
              </span>
            </div>
          )}
        </a>
      </div>

      {/* User info */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-sm">
            {user?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {user?.name ?? "Loading..."}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {isPreviewingAsStaff ? "Team Member (preview)" : isSuperAdmin ? "Super Admin" : user?.role === "admin" ? "Admin" : "Team Member"}
            </p>
          </div>
        </div>
        {/* View toggle for admins */}
        {isRealAdmin && (
          <button
            onClick={togglePreview}
            className={cn(
              "mt-3 flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors",
              isPreviewingAsStaff
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {isPreviewingAsStaff ? (
              <>
                <ShieldCheck className="size-3.5" />
                Switch to Admin View
              </>
            ) : (
              <>
                <Eye className="size-3.5" />
                Preview as Team Member
              </>
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.filter((item) => {
          if ("superAdminOnly" in item && item.superAdminOnly) {
            return isSuperAdmin;
          }
          if ("adminOnly" in item && item.adminOnly) {
            return isRealAdmin && !isPreviewingAsStaff;
          }
          return true;
        }).map((item) => {
          const isActive = location.pathname === item.path;
          // Show "My Schedule" instead of "Shifts" for team members
          const displayLabel =
            item.path === "/shifts" && (!isRealAdmin || isPreviewingAsStaff)
              ? "My Schedule"
              : item.label;
          return (
            <button
              key={item.path}
              onClick={() => {
                if (item.enabled) {
                  navigate(item.path);
                } else {
                  toast.info(
                    `${displayLabel} is coming soon in a future milestone!`
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
              <span>{displayLabel}</span>
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
        <SuspensionGate />
      </Authenticated>
    </>
  );
}

/** Checks if the current user is suspended and blocks access if so */
function SuspensionGate() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const { removeUser } = useAuth();

  // Still loading user data
  if (currentUser === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-sm">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (currentUser?.suspended) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <div className="size-14 rounded-xl bg-destructive/10 flex items-center justify-center">
          <Ban className="size-7 text-destructive" />
        </div>
        <h1 className="font-heading font-bold text-2xl">Account Suspended</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          Your account has been suspended. Please contact your administrator for more information.
        </p>
        <Button
          variant="secondary"
          onClick={async () => {
            await removeUser();
          }}
        >
          Sign Out
        </Button>
      </div>
    );
  }

  return (
    <StaffPreviewProvider>
      <DashboardShell />
    </StaffPreviewProvider>
  );
}
