import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { format, startOfWeek, endOfWeek, addWeeks, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Send, Clock, FileCheck, FileText } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { exportMyTimesheetPDF } from "../_lib/export-pdf.ts";

/** Format minutes into "Xh Ym" */
function formatMinutes(mins: number): string {
  if (mins <= 0) return "0h 0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

/** Compute worked minutes between two ISO timestamps minus break */
function computeWorkedMinutes(clockIn: string, clockOut: string, breakMinutes: number): number {
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  return Math.max(0, Math.round(diff / 60000) - breakMinutes);
}

const STATUS_MAP = {
  draft: { label: "Draft", variant: "secondary" as const },
  submitted: { label: "Submitted", variant: "default" as const },
  approved: { label: "Approved", variant: "default" as const },
  rejected: { label: "Rejected", variant: "destructive" as const },
} as const;

export default function MyTimesheet() {
  const [weekOffset, setWeekOffset] = useState(0);
  const currentUser = useQuery(api.users.getCurrentUser);
  const org = useQuery(api.organizations.getMyOrganization);

  const weekStart = useMemo(() => {
    const now = addWeeks(new Date(), weekOffset);
    return startOfWeek(now, { weekStartsOn: 1 }); // Monday
  }, [weekOffset]);

  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);

  const startDate = format(weekStart, "yyyy-MM-dd");
  const endDate = format(weekEnd, "yyyy-MM-dd");

  const entries = useQuery(api.timeTracking.getEntriesByDateRange, {
    startDate,
    endDate,
  });

  const timesheet = useQuery(api.timeTracking.getMyTimesheet, {
    periodStart: startDate,
  });

  const submitTimesheet = useMutation(api.timeTracking.submitTimesheet);
  const [submitting, setSubmitting] = useState(false);

  // Group entries by date
  const days = useMemo(() => {
    const result: { date: Date; dateStr: string; entries: NonNullable<typeof entries> }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dateStr = format(day, "yyyy-MM-dd");
      result.push({
        date: day,
        dateStr,
        entries: (entries ?? []).filter((e) => e.date === dateStr),
      });
    }
    return result;
  }, [entries, weekStart]);

  const totalMinutes = useMemo(() => {
    return (entries ?? []).reduce((acc, e) => {
      if (e.clockOut) {
        return acc + computeWorkedMinutes(e.clockIn, e.clockOut, e.breakMinutes);
      }
      return acc;
    }, 0);
  }, [entries]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitTimesheet({ periodStart: startDate, periodEnd: endDate });
      toast.success("Timesheet submitted for approval");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to submit timesheet");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isCurrentWeek = weekOffset === 0;
  const canSubmit =
    !isCurrentWeek &&
    (entries ?? []).length > 0 &&
    (!timesheet || timesheet.status === "draft" || timesheet.status === "rejected");

  const statusInfo = timesheet ? STATUS_MAP[timesheet.status] : null;

  // PDF export
  const handleExportPDF = () => {
    if (!entries || entries.length === 0) return;
    exportMyTimesheetPDF({
      entries,
      weekStart,
      weekEnd,
      userName: currentUser?.name ?? "Staff",
      orgName: org?.name,
      status: statusInfo?.label,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileCheck className="size-5" />
            My Timesheet
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleExportPDF}
              disabled={!entries || entries.length === 0}
              title="Export PDF"
            >
              <FileText className="size-4" />
            </Button>
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
        {/* Summary bar */}
        <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total hours</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-heading font-bold text-lg">
              {formatMinutes(totalMinutes)}
            </span>
            {statusInfo && (
              <Badge
                variant={statusInfo.variant}
                className={cn(
                  statusInfo.variant === "default" && timesheet?.status === "approved" && "bg-emerald-600"
                )}
              >
                {statusInfo.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Daily breakdown table */}
        {entries === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">Day</TableHead>
                  <TableHead className="text-xs">Clock In</TableHead>
                  <TableHead className="text-xs">Clock Out</TableHead>
                  <TableHead className="text-xs">Break</TableHead>
                  <TableHead className="text-xs text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map(({ date, dateStr, entries: dayEntries }) => {
                  const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;
                  const dayTotal = dayEntries.reduce((acc, e) => {
                    if (e.clockOut) {
                      return acc + computeWorkedMinutes(e.clockIn, e.clockOut, e.breakMinutes);
                    }
                    return acc;
                  }, 0);

                  if (dayEntries.length === 0) {
                    return (
                      <TableRow key={dateStr} className={cn(isToday && "bg-primary/5")}>
                        <TableCell className="text-xs font-medium">
                          <span className={cn(isToday && "text-primary font-semibold")}>
                            {format(date, "EEE d")}
                          </span>
                        </TableCell>
                        <TableCell colSpan={3} className="text-xs text-muted-foreground">
                          —
                        </TableCell>
                        <TableCell className="text-xs text-right text-muted-foreground">
                          0h 0m
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return dayEntries.map((entry, idx) => (
                    <TableRow
                      key={entry._id}
                      className={cn(isToday && "bg-primary/5")}
                    >
                      <TableCell className="text-xs font-medium">
                        {idx === 0 && (
                          <span className={cn(isToday && "text-primary font-semibold")}>
                            {format(date, "EEE d")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(entry.clockIn), "HH:mm")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.clockOut
                          ? format(new Date(entry.clockOut), "HH:mm")
                          : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Active
                            </span>
                          )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.breakMinutes > 0 ? `${entry.breakMinutes}m` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {idx === 0 ? formatMinutes(dayTotal) : ""}
                      </TableCell>
                    </TableRow>
                  ));
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Submit button */}
        {canSubmit && (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            <Send className="size-4 mr-2" />
            Submit Timesheet for Approval
          </Button>
        )}

        {/* Rejection notes */}
        {timesheet?.status === "rejected" && timesheet.reviewNotes && (
          <div className="rounded-lg border border-rose-400/30 bg-rose-500/8 p-3 text-sm">
            <p className="font-medium text-rose-600 dark:text-rose-400 mb-1">
              Rejection reason
            </p>
            <p className="text-muted-foreground text-xs">{timesheet.reviewNotes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
