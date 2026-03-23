import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import { format } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Inbox,
  CheckCircle2,
  Archive,
  Trash2,
  Lightbulb,
  CalendarClock,
  Building2,
  MessageSquare,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

type StatusFilter = "new" | "reviewed" | "archived" | undefined;

const CATEGORY_META: Record<string, { label: string; icon: typeof MessageSquare }> = {
  general: { label: "General", icon: MessageSquare },
  scheduling: { label: "Scheduling", icon: CalendarClock },
  workplace: { label: "Workplace", icon: Building2 },
  suggestion: { label: "Suggestion", icon: Lightbulb },
  concern: { label: "Concern", icon: AlertCircle },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  reviewed: { label: "Reviewed", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  archived: { label: "Archived", className: "bg-muted text-muted-foreground" },
};

export default function FeedbackAdmin() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined);
  const feedback = useQuery(api.feedback.list, { statusFilter });
  const counts = useQuery(api.feedback.getCounts);
  const updateStatus = useMutation(api.feedback.updateStatus);
  const removeFeedback = useMutation(api.feedback.remove);

  async function handleStatusChange(feedbackId: Id<"feedback">, status: "new" | "reviewed" | "archived") {
    try {
      await updateStatus({ feedbackId, status });
      toast.success(`Marked as ${status}`);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to update status");
      }
    }
  }

  async function handleDelete(feedbackId: Id<"feedback">) {
    try {
      await removeFeedback({ feedbackId });
      toast.success("Feedback deleted");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to delete");
      }
    }
  }

  if (feedback === undefined || counts === undefined) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const filterTabs: Array<{ value: StatusFilter; label: string; count: number }> = [
    { value: undefined, label: "All", count: counts.total },
    { value: "new", label: "New", count: counts.new },
    { value: "reviewed", label: "Reviewed", count: counts.reviewed },
    { value: "archived", label: "Archived", count: counts.archived },
  ];

  return (
    <div className="space-y-5">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
              statusFilter === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>{tab.label}</span>
            <span
              className={cn(
                "text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
                statusFilter === tab.value
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Feedback list */}
      {feedback.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>
              {statusFilter ? `No ${statusFilter} feedback` : "No feedback yet"}
            </EmptyTitle>
            <EmptyDescription>
              {statusFilter
                ? "Try a different filter to see more feedback"
                : "Feedback from staff will appear here once submitted"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {feedback.map((item) => {
            const catMeta = CATEGORY_META[item.category] ?? CATEGORY_META.general;
            const statMeta = STATUS_META[item.status] ?? STATUS_META.new;
            const CatIcon = catMeta.icon;

            return (
              <Card key={item._id} className={cn(item.status === "archived" && "opacity-60")}>
                <CardContent className="py-4 space-y-3">
                  {/* Top row: category badge + status + time */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <CatIcon className="size-3" />
                        {catMeta.label}
                      </Badge>
                      <span className={cn("text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5", statMeta.className)}>
                        {statMeta.label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(item._creationTime), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>

                  {/* Message */}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {item.message}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {item.status !== "reviewed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleStatusChange(item._id, "reviewed")}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Mark Reviewed
                      </Button>
                    )}
                    {item.status === "reviewed" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleStatusChange(item._id, "new")}
                      >
                        <RotateCcw className="size-3.5" />
                        Reopen
                      </Button>
                    )}
                    {item.status !== "archived" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleStatusChange(item._id, "archived")}
                      >
                        <Archive className="size-3.5" />
                        Archive
                      </Button>
                    )}
                    {item.status === "archived" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item._id)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
