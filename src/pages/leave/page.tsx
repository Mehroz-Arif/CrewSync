import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useStaffPreview } from "@/hooks/use-staff-preview.tsx";
import MyLeaveRequests from "./_components/my-leave-requests.tsx";
import LeaveRequestDialog from "./_components/leave-request-dialog.tsx";
import AdminLeaveReview from "./_components/admin-leave-review.tsx";

export default function LeavePage() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const { isPreviewingAsStaff } = useStaffPreview();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  if (currentUser === undefined) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin" && !isPreviewingAsStaff;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Leave</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAdmin ? "Manage time-off requests for your team" : "Request and track your time off"}
        </p>
      </div>

      {/* My requests */}
      <MyLeaveRequests onNewRequest={() => setRequestDialogOpen(true)} />

      {/* Admin review panel */}
      {isAdmin && <AdminLeaveReview />}

      {/* Request dialog */}
      <LeaveRequestDialog
        open={requestDialogOpen}
        onOpenChange={setRequestDialogOpen}
      />
    </div>
  );
}
