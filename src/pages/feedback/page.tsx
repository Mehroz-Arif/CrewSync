import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { Eye, ShieldCheck, MessageSquareQuote, Send } from "lucide-react";
import FeedbackForm from "./_components/feedback-form.tsx";
import FeedbackAdmin from "./_components/feedback-admin.tsx";
import YouSaidWeDid from "./_components/you-said-we-did.tsx";

type StaffTab = "submit" | "you-said-we-did";

export default function FeedbackPage() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const [previewStaffView, setPreviewStaffView] = useState(false);
  const [staffTab, setStaffTab] = useState<StaffTab>("submit");

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

  const staffTabs: Array<{ value: StaffTab; label: string; icon: typeof Send }> = [
    { value: "submit", label: "Submit Feedback", icon: Send },
    { value: "you-said-we-did", label: "You Said, We Did", icon: MessageSquareQuote },
  ];

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl">
            {showStaffView ? "Feedback" : "Staff Feedback"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {showStaffView
              ? "Share your thoughts and see what actions have been taken"
              : "Review feedback from your team and respond publicly"}
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

      {showStaffView ? (
        <>
          {/* Staff sub-tabs */}
          <div className="flex gap-2">
            {staffTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStaffTab(tab.value)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                    staffTab === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {staffTab === "submit" ? <FeedbackForm /> : <YouSaidWeDid />}
        </>
      ) : (
        <FeedbackAdmin />
      )}
    </div>
  );
}
