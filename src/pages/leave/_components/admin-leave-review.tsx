import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { CheckCircle2, XCircle, ClipboardList, Users } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription as EmptyDesc,
} from "@/components/ui/empty.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const LEAVE_LABELS: Record<string, string> = {
  annual: "Annual",
  sick: "Sick",
  compassionate: "Compassionate",
  training: "Training",
  unpaid: "Unpaid",
  other: "Other",
};

const STATUS_STYLES = {
  pending: { label: "Pending", class: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  approved: { label: "Approved", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  rejected: { label: "Rejected", class: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" },
  cancelled: { label: "Cancelled", class: "bg-muted text-muted-foreground border-muted" },
} as const;

type LeaveRow = {
  _id: Id<"leaveRequests">;
  userId: Id<"users">;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewNotes?: string;
  userName: string;
  _creationTime: number;
};

export default function AdminLeaveReview() {
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [reviewDialog, setReviewDialog] = useState<LeaveRow | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const requests = useQuery(api.leaveRequests.getAllRequests, {
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const reviewRequest = useMutation(api.leaveRequests.review);

  const handleReview = async (decision: "approved" | "rejected") => {
    if (!reviewDialog) return;
    setProcessing(true);
    try {
      await reviewRequest({
        requestId: reviewDialog._id,
        decision,
        reviewNotes: reviewNotes || undefined,
      });
      toast.success(`Leave request ${decision}`);
      setReviewDialog(null);
      setReviewNotes("");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to review request");
      }
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = (requests ?? []).filter((r) => r.status === "pending").length;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="size-5" />
            Team Leave Requests
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {pendingCount}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {(["all", "pending", "approved", "rejected"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                  statusFilter === s
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>

          {requests === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No leave requests</EmptyTitle>
                <EmptyDesc>
                  {statusFilter === "all"
                    ? "No leave requests have been submitted yet."
                    : `No ${statusFilter} leave requests.`}
                </EmptyDesc>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Staff Member</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Dates</TableHead>
                    <TableHead className="text-xs">Days</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => {
                    const style = STATUS_STYLES[req.status];
                    const days = differenceInCalendarDays(parseISO(req.endDate), parseISO(req.startDate)) + 1;

                    return (
                      <TableRow key={req._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-[10px]">
                              {req.userName?.charAt(0)?.toUpperCase() ?? "?"}
                            </div>
                            <span className="text-sm font-medium">{req.userName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {LEAVE_LABELS[req.leaveType] ?? req.leaveType}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(parseISO(req.startDate), "d MMM")}
                          {req.startDate !== req.endDate && (
                            <> – {format(parseISO(req.endDate), "d MMM")}</>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {days}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              style.class
                            )}
                          >
                            {style.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {req.status === "pending" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs h-7"
                              onClick={() => {
                                setReviewDialog(req as LeaveRow);
                                setReviewNotes("");
                              }}
                            >
                              Review
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={(o) => !o && setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Leave Request</DialogTitle>
            <DialogDescription>
              {reviewDialog?.userName} —{" "}
              {LEAVE_LABELS[reviewDialog?.leaveType ?? ""] ?? reviewDialog?.leaveType}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg px-4 py-3 space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Dates</span>
                <span className="font-medium">
                  {reviewDialog && format(parseISO(reviewDialog.startDate), "d MMM yyyy")}
                  {reviewDialog && reviewDialog.startDate !== reviewDialog.endDate && (
                    <> – {format(parseISO(reviewDialog.endDate), "d MMM yyyy")}</>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">
                  {reviewDialog && differenceInCalendarDays(parseISO(reviewDialog.endDate), parseISO(reviewDialog.startDate)) + 1} day(s)
                </span>
              </div>
            </div>

            {reviewDialog?.reason && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Reason</Label>
                <p className="text-sm bg-muted/50 rounded px-3 py-2">{reviewDialog.reason}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add review notes..."
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="destructive"
              onClick={() => handleReview("rejected")}
              disabled={processing}
            >
              <XCircle className="size-4 mr-1.5" />
              Reject
            </Button>
            <Button
              onClick={() => handleReview("approved")}
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="size-4 mr-1.5" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
