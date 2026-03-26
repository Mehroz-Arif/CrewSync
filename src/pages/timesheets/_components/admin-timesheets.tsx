import { useMemo, useState } from "react";
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
import { format, startOfWeek, endOfWeek, addWeeks } from "date-fns";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, ClipboardList, Users } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription as EmptyDesc,
} from "@/components/ui/empty.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

/** Format minutes into "Xh Ym" */
function formatMinutes(mins: number): string {
  if (mins <= 0) return "0h 0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

const STATUS_STYLES = {
  draft: { label: "Draft", class: "bg-muted text-muted-foreground" },
  submitted: { label: "Pending Review", class: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  approved: { label: "Approved", class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  rejected: { label: "Rejected", class: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" },
} as const;

type TimesheetRow = {
  _id: Id<"timesheets">;
  userId: Id<"users">;
  periodStart: string;
  periodEnd: string;
  totalMinutes: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  submittedAt?: string;
  reviewedBy?: Id<"users">;
  reviewedAt?: string;
  reviewNotes?: string;
  userName: string;
  userRole?: string;
  reviewerName?: string;
};

export default function AdminTimesheets() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "approved" | "rejected">("all");
  const [reviewDialog, setReviewDialog] = useState<TimesheetRow | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const weekStart = useMemo(() => {
    const now = addWeeks(new Date(), weekOffset);
    return startOfWeek(now, { weekStartsOn: 1 });
  }, [weekOffset]);
  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);

  const startDate = format(weekStart, "yyyy-MM-dd");

  const timesheets = useQuery(api.timeTracking.getAllTimesheets, {
    periodStart: startDate,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const reviewTimesheet = useMutation(api.timeTracking.reviewTimesheet);

  const handleReview = async (decision: "approved" | "rejected") => {
    if (!reviewDialog) return;
    setProcessing(true);
    try {
      await reviewTimesheet({
        timesheetId: reviewDialog._id,
        decision,
        reviewNotes: reviewNotes || undefined,
      });
      toast.success(`Timesheet ${decision}`);
      setReviewDialog(null);
      setReviewNotes("");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to review timesheet");
      }
    } finally {
      setProcessing(false);
    }
  };

  const isCurrentWeek = weekOffset === 0;

  // Count submitted timesheets for badge
  const submittedCount = (timesheets ?? []).filter((t) => t.status === "submitted").length;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="size-5" />
              Team Timesheets
              {submittedCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {submittedCount}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setWeekOffset((o) => o - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <button
                onClick={() => setWeekOffset(0)}
                className="text-xs font-medium px-2 py-1 rounded hover:bg-muted transition-colors"
              >
                {format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")}
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setWeekOffset((o) => o + 1)}
                disabled={isCurrentWeek}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {(["all", "submitted", "approved", "rejected"] as const).map((s) => (
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

          {/* Table */}
          {timesheets === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : timesheets.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No timesheets</EmptyTitle>
                <EmptyDesc>
                  No timesheets have been submitted for this week yet.
                </EmptyDesc>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Staff Member</TableHead>
                    <TableHead className="text-xs">Total Hours</TableHead>
                    <TableHead className="text-xs">Submitted</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timesheets.map((ts) => {
                    const style = STATUS_STYLES[ts.status];
                    return (
                      <TableRow key={ts._id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-[10px]">
                              {ts.userName?.charAt(0)?.toUpperCase() ?? "?"}
                            </div>
                            <span className="text-sm font-medium">{ts.userName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatMinutes(ts.totalMinutes)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ts.submittedAt
                            ? format(new Date(ts.submittedAt), "d MMM, HH:mm")
                            : "—"}
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
                          {ts.status === "submitted" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs h-7"
                              onClick={() => {
                                setReviewDialog(ts as TimesheetRow);
                                setReviewNotes("");
                              }}
                            >
                              Review
                            </Button>
                          )}
                          {ts.status === "approved" && ts.reviewerName && (
                            <span className="text-[10px] text-muted-foreground">
                              by {ts.reviewerName}
                            </span>
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
            <DialogTitle>Review Timesheet</DialogTitle>
            <DialogDescription>
              {reviewDialog?.userName} — {reviewDialog && format(new Date(reviewDialog.periodStart), "d MMM")} to{" "}
              {reviewDialog && format(new Date(reviewDialog.periodEnd), "d MMM yyyy")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total hours</span>
              <span className="font-heading font-bold text-lg">
                {reviewDialog ? formatMinutes(reviewDialog.totalMinutes) : "—"}
              </span>
            </div>

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
