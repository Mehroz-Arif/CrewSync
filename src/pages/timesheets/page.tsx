import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useStaffPreview } from "@/hooks/use-staff-preview.tsx";
import ClockInOut from "./_components/clock-in-out.tsx";
import MyTimesheet from "./_components/my-timesheet.tsx";
import AdminTimesheets from "./_components/admin-timesheets.tsx";

export default function TimesheetsPage() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const { isPreviewingAsStaff } = useStaffPreview();

  if (currentUser === undefined) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Timesheets</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAdmin ? "Track hours and review team timesheets" : "Track your working hours"}
        </p>
      </div>

      {/* Staff view: clock in/out + my timesheet */}
      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <ClockInOut />
        </div>
        <div className="md:col-span-2">
          <MyTimesheet />
        </div>
      </div>

      {/* Admin view: team timesheets */}
      {isAdmin && (
        <div>
          <AdminTimesheets />
        </div>
      )}
    </div>
  );
}
