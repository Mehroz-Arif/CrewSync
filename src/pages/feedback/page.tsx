import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import FeedbackForm from "./_components/feedback-form.tsx";
import FeedbackAdmin from "./_components/feedback-admin.tsx";

export default function FeedbackPage() {
  const currentUser = useQuery(api.users.getCurrentUser);

  if (currentUser === undefined) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl md:text-3xl">
          {isAdmin ? "Staff Feedback" : "Anonymous Feedback"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAdmin
            ? "Review anonymous feedback from your team"
            : "Share your thoughts anonymously with management"}
        </p>
      </div>

      {isAdmin ? <FeedbackAdmin /> : <FeedbackForm />}
    </div>
  );
}
