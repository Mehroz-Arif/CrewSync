import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { CalendarOff, X } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";

const LEAVE_LABELS: Record<string, string> = {
  annual: "Annual Leave",
  sick: "Sick Leave",
  compassionate: "Compassionate",
  training: "Training",
  unpaid: "Unpaid Leave",
  other: "Other",
};

const STATUS_STYLES = {
  pending: { label: "Pending", class: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  approved: { label: "Approved", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  rejected: { label: "Rejected", class: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" },
  cancelled: { label: "Cancelled", class: "bg-muted text-muted-foreground border-muted" },
} as const;

type Props = {
  onNewRequest: () => void;
};

export default function MyLeaveRequests({ onNewRequest }: Props) {
  const requests = useQuery(api.leaveRequests.getMyRequests);
  const cancelRequest = useMutation(api.leaveRequests.cancel);

  const handleCancel = async (requestId: (typeof requests extends (infer T)[] | undefined ? T : never)["_id"]) => {
    try {
      await cancelRequest({ requestId });
      toast.success("Request cancelled");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to cancel request");
      }
    }
  };

  if (requests === undefined) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarOff className="size-5" />
            My Leave Requests
          </CardTitle>
          <Button size="sm" onClick={onNewRequest}>
            Request Time Off
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {requests.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarOff />
              </EmptyMedia>
              <EmptyTitle>No leave requests</EmptyTitle>
              <EmptyDescription>
                You haven{"'"}t submitted any leave requests yet.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" onClick={onNewRequest}>
                Request Time Off
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const style = STATUS_STYLES[req.status];
              const days = differenceInCalendarDays(parseISO(req.endDate), parseISO(req.startDate)) + 1;

              return (
                <div
                  key={req._id}
                  className="rounded-lg border p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">
                          {LEAVE_LABELS[req.leaveType] ?? req.leaveType}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            style.class
                          )}
                        >
                          {style.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(req.startDate), "d MMM yyyy")}
                        {req.startDate !== req.endDate && (
                          <> &ndash; {format(parseISO(req.endDate), "d MMM yyyy")}</>
                        )}
                        <span className="ml-1.5 text-muted-foreground/70">
                          ({days} day{days !== 1 ? "s" : ""})
                        </span>
                      </p>
                    </div>
                    {req.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleCancel(req._id)}
                        title="Cancel request"
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>

                  {req.reason && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                      {req.reason}
                    </p>
                  )}

                  {req.status === "rejected" && req.reviewNotes && (
                    <div className="rounded border border-rose-400/30 bg-rose-500/8 px-2 py-1.5 text-xs">
                      <span className="font-medium text-rose-600 dark:text-rose-400">
                        Rejection reason:
                      </span>{" "}
                      <span className="text-muted-foreground">{req.reviewNotes}</span>
                    </div>
                  )}

                  {req.status === "approved" && req.reviewerName && (
                    <p className="text-[10px] text-muted-foreground">
                      Approved by {req.reviewerName}
                      {req.reviewedAt && <> on {format(parseISO(req.reviewedAt), "d MMM")}</>}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
