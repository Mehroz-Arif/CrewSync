import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Eye, ShieldCheck } from "lucide-react";
import FeedbackForm from "./_components/feedback-form.tsx";
import FeedbackAdmin from "./_components/feedback-admin.tsx";

export default function FeedbackPage() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const [previewStaffView, setPreviewStaffView] = useState(false);

  if (currentUser === undefined) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin";
  const showStaffView = !isAdmin || previewStaffView;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl">
            {showStaffView ? "Anonymous Feedback" : "Staff Feedback"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {showStaffView
              ? "Share your thoughts anonymously with management"
              : "Review anonymous feedback from your team"}
          </p>
        </div>

        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreviewStaffView(!previewStaffView)}
            className="shrink-0 gap-2"
          >
            {previewStaffView ? (
              <>
                <ShieldCheck className="size-4" />
                Admin View
              </>
            ) : (
              <>
                <Eye className="size-4" />
                Staff View
              </>
            )}
          </Button>
        )}
      </div>

      {showStaffView ? <FeedbackForm /> : <FeedbackAdmin />}
    </div>
  );
}
