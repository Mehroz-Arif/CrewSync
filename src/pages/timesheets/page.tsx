import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useStaffPreview } from "@/hooks/use-staff-preview.tsx";
import ClockInOut from "./_components/clock-in-out.tsx";
import MyTimesheet from "./_components/my-timesheet.tsx";
import AdminTimesheets from "./_components/admin-timesheets.tsx";
import TimesheetSummary from "./_components/timesheet-summary.tsx";
import { cn } from "@/lib/utils.ts";

type AdminTab = "summary" | "approvals";

export default function TimesheetsPage() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const { isPreviewingAsStaff } = useStaffPreview();
  const [adminTab, setAdminTab] = useState<AdminTab>("summary");

  if (currentUser === undefined) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 md:col-span-2" />
        </div>
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin" && !isPreviewingAsStaff;

  return (
    <div className="max-w-7xl mx-auto space-y-6 print:max-w-none print:p-0">
      <div className="print:hidden">
        <h1 className="font-heading text-2xl font-bold">Timesheets</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAdmin ? "Track hours and review team timesheets" : "Track your working hours"}
        </p>
      </div>

      {/* Admin tabs */}
      {isAdmin && (
        <div className="print:hidden">
          <div className="flex items-center gap-1 border-b">
            <button
              onClick={() => setAdminTab("summary")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                adminTab === "summary"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Timesheet Summary
            </button>
            <button
              onClick={() => setAdminTab("approvals")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                adminTab === "approvals"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Approvals & Time Tracking
            </button>
          </div>
        </div>
      )}

      {/* Tab content */}
      {isAdmin && adminTab === "summary" ? (
        <TimesheetSummary />
      ) : (
        <>
          {/* Staff view: clock in/out + my timesheet */}
          <div className="grid md:grid-cols-3 gap-6 print:hidden">
            <div>
              <ClockInOut />
            </div>
            <div className="md:col-span-2">
              <MyTimesheet />
            </div>
          </div>

          {/* Admin view: team timesheets */}
          {isAdmin && (
            <div className="print:hidden">
              <AdminTimesheets />
            </div>
          )}
        </>
      )}
    </div>
  );
}
