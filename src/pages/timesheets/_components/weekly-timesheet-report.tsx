import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  getISOWeek,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Printer,
  Download,
  ClipboardList,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { Spinner } from "@/components/ui/spinner.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription as EmptyDesc,
} from "@/components/ui/empty.tsx";

type DatePreset = "last_week" | "last_month" | "custom";

const STATUS_LABELS = {
  none: "Not submitted",
  draft: "Draft",
  submitted: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
} as const;

const STATUS_COLORS = {
  none: "text-muted-foreground",
  draft: "text-muted-foreground",
  submitted: "text-blue-600 dark:text-blue-400",
  approved: "text-emerald-600 dark:text-emerald-400",
  rejected: "text-rose-600 dark:text-rose-400",
} as const;

export default function WeeklyTimesheetReport() {
  const [weekOffset, setWeekOffset] = useState(-1); // Default to last week
  const [personFilter, setPersonFilter] = useState("all");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const reviewTimesheet = useMutation(api.timeTracking.reviewTimesheet);

  const weekStart = useMemo(() => {
    const now = addWeeks(new Date(), weekOffset);
    return startOfWeek(now, { weekStartsOn: 1 });
  }, [weekOffset]);

  const weekEnd = useMemo(
    () => endOfWeek(weekStart, { weekStartsOn: 1 }),
    [weekStart]
  );

  const startDate = format(weekStart, "yyyy-MM-dd");
  const endDate = format(weekEnd, "yyyy-MM-dd");

  const report = useQuery(api.timeTracking.getWeeklyTimesheetReport, {
    startDate,
    endDate,
  });

  // Build list of days for columns
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // Unique person names for filter
  const personNames = useMemo(() => {
    if (!report) return [];
    return [...new Set(report.map((r) => r.userName))].sort();
  }, [report]);

  // Apply filter
  const filtered = useMemo(() => {
    if (!report) return [];
    if (personFilter === "all") return report;
    return report.filter((r) => r.userName === personFilter);
  }, [report, personFilter]);

  // Grand total
  const grandTotal = useMemo(
    () => filtered.reduce((sum, r) => sum + r.totalHours, 0),
    [filtered]
  );

  const weekNumber = getISOWeek(weekStart);
  const isCurrentWeek = weekOffset === 0;

  // Confirm (approve) a submitted timesheet
  const handleConfirm = async (timesheetId: Id<"timesheets">) => {
    setConfirmingId(timesheetId);
    try {
      await reviewTimesheet({
        timesheetId,
        decision: "approved",
      });
      toast.success("Timesheet confirmed");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to confirm timesheet");
      }
    } finally {
      setConfirmingId(null);
    }
  };

  // CSV export
  const handleExportCSV = () => {
    if (!filtered.length) return;
    const dayHeaders = days.flatMap((d) => [
      `${format(d, "EEE d")} Start`,
      `${format(d, "EEE d")} End`,
      `${format(d, "EEE d")} HR`,
    ]);
    const headers = ["Name", ...dayHeaders, "Total", "Status"];

    const rows = filtered.map((row) => {
      const dayCells = days.flatMap((d) => {
        const dateStr = format(d, "yyyy-MM-dd");
        const entries = row.days[dateStr];
        if (!entries || entries.length === 0) return ["", "", ""];
        // Take first entry for the day
        const e = entries[0];
        return [e.start, e.end ?? "", e.hours.toFixed(2)];
      });
      return [
        row.userName,
        ...dayCells,
        row.totalHours.toFixed(2),
        STATUS_LABELS[row.timesheetStatus],
      ];
    });

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        headers.join(","),
        ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
      ].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `weekly-timesheet-${startDate}-to-${endDate}.csv`;
    link.click();
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        {/* Person filter */}
        <Select value={personFilter} onValueChange={setPersonFilter}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="All People" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All People</SelectItem>
            {personNames.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date preset buttons */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5">
          <Button
            variant={weekOffset === -1 ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setWeekOffset(-1)}
          >
            Last Week
          </Button>
          <Button
            variant={weekOffset === 0 ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setWeekOffset(0)}
          >
            This Week
          </Button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setWeekOffset((o) => o - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs font-medium whitespace-nowrap min-w-[140px] text-center">
            {format(weekStart, "dd/MM/yyyy")} – {format(weekEnd, "dd/MM/yyyy")}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setWeekOffset((o) => o + 1)}
            disabled={isCurrentWeek}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex-1" />

        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportCSV}
          disabled={!filtered.length}
        >
          <Download className="size-3.5 mr-1.5" />
          Export CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={handlePrint}>
          <Printer className="size-3.5 mr-1.5" />
          Print
        </Button>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-2">
        <h2 className="text-lg font-bold">Weekly Timesheet</h2>
        <div className="flex justify-between text-sm">
          <span>
            Week: {weekNumber}
          </span>
          <span>
            Starting on: {format(weekStart, "do MMMM yyyy")} &nbsp; Ending on:{" "}
            {format(weekEnd, "do MMMM yyyy")}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground print:text-xs">
        <div className="flex items-center gap-1">
          <span className="inline-block size-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-emerald-500" />
          Submitted
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block size-2.5 rotate-45 bg-blue-500" />
          Approved
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block size-2.5 bg-rose-500" />
          Rejected
        </div>
      </div>

      {/* Report table */}
      {report === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>No timesheet data</EmptyTitle>
            <EmptyDesc>
              No time entries found for the selected period.
            </EmptyDesc>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-lg border overflow-x-auto print:border-none print:rounded-none">
          <table className="w-full text-xs border-collapse min-w-[1200px]">
            <thead>
              {/* Day header row */}
              <tr className="bg-muted/40 print:bg-gray-100">
                <th
                  rowSpan={2}
                  className="border-r px-2 py-1.5 text-left font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap sticky left-0 bg-muted/40 print:bg-gray-100 z-10"
                >
                  Week: {weekNumber}
                </th>
                {days.map((day) => (
                  <th
                    key={day.toISOString()}
                    colSpan={3}
                    className="border-r px-1 py-1.5 text-center font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap"
                  >
                    {format(day, "EEEE, do")}
                  </th>
                ))}
                <th
                  rowSpan={2}
                  className="border-r px-2 py-1.5 text-center font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap"
                >
                  Total
                </th>
                <th
                  rowSpan={2}
                  className="px-2 py-1.5 text-center font-semibold text-[10px] uppercase tracking-wider whitespace-nowrap print:hidden"
                >
                  Action
                </th>
              </tr>
              {/* Sub-header row */}
              <tr className="bg-muted/30 print:bg-gray-50">
                {days.map((day) => (
                  <DaySubHeaders key={`sub-${day.toISOString()}`} />
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.userId}
                  className="border-t hover:bg-muted/20 transition-colors print:border-b print:border-gray-300"
                >
                  {/* Name cell */}
                  <td className="border-r px-2 py-1.5 font-medium whitespace-nowrap sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-1.5">
                      <StatusIndicator status={row.timesheetStatus} />
                      <span>{row.userName}</span>
                    </div>
                  </td>

                  {/* Day cells */}
                  {days.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const entries = row.days[dateStr];
                    return (
                      <DayCells
                        key={`${row.userId}-${dateStr}`}
                        entries={entries}
                      />
                    );
                  })}

                  {/* Total */}
                  <td className="border-r px-2 py-1.5 text-center font-bold whitespace-nowrap">
                    {row.totalHours > 0 ? row.totalHours.toFixed(2) : ""}
                  </td>

                  {/* Confirm button */}
                  <td className="px-2 py-1.5 text-center print:hidden">
                    {row.timesheetStatus === "submitted" && row.timesheetId && (
                      <Button
                        size="sm"
                        className="h-6 text-[10px] bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() =>
                          handleConfirm(row.timesheetId as Id<"timesheets">)
                        }
                        disabled={confirmingId === row.timesheetId}
                      >
                        {confirmingId === row.timesheetId ? (
                          <Spinner className="size-3" />
                        ) : (
                          <>
                            <Check className="size-3 mr-0.5" />
                            Confirm
                          </>
                        )}
                      </Button>
                    )}
                    {row.timesheetStatus === "approved" && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Confirmed
                      </span>
                    )}
                    {row.timesheetStatus === "rejected" && (
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                        Rejected
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {/* Totals row */}
              <tr className="border-t-2 bg-muted/40 font-bold print:bg-gray-50">
                <td className="border-r px-2 py-2 sticky left-0 bg-muted/40 print:bg-gray-50 z-10">
                  Totals ({filtered.length} staff)
                </td>
                {days.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayTotal = filtered.reduce((sum, row) => {
                    const entries = row.days[dateStr];
                    if (!entries) return sum;
                    return (
                      sum + entries.reduce((s, e) => s + e.hours, 0)
                    );
                  }, 0);
                  return (
                    <td
                      key={`total-${dateStr}`}
                      colSpan={3}
                      className="border-r px-1 py-2 text-center whitespace-nowrap"
                    >
                      {dayTotal > 0 ? dayTotal.toFixed(2) : ""}
                    </td>
                  );
                })}
                <td className="border-r px-2 py-2 text-center whitespace-nowrap">
                  {grandTotal.toFixed(2)}
                </td>
                <td className="print:hidden" />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Sub-header cells (Start / End / HR) for one day */
function DaySubHeaders() {
  return (
    <>
      <th className="border-r border-r-transparent px-1 py-1 text-center font-medium text-[9px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
        Start
      </th>
      <th className="px-1 py-1 text-center font-medium text-[9px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
        End
      </th>
      <th className="border-r px-1 py-1 text-center font-medium text-[9px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
        HR
      </th>
    </>
  );
}

/** Day cells (Start / End / HR) for one person/day */
function DayCells({
  entries,
}: {
  entries?: Array<{
    start: string;
    end: string | null;
    hours: number;
    status: string;
  }>;
}) {
  if (!entries || entries.length === 0) {
    return (
      <>
        <td className="px-1 py-1.5 text-center text-muted-foreground/40">—</td>
        <td className="px-1 py-1.5 text-center text-muted-foreground/40">—</td>
        <td className="border-r px-1 py-1.5 text-center text-muted-foreground/40">
          —
        </td>
      </>
    );
  }

  // Show first entry; if multiple, show total hours
  const primary = entries[0];
  const totalHrs = entries.reduce((s, e) => s + e.hours, 0);
  const hasMultiple = entries.length > 1;

  return (
    <>
      <td className="px-1 py-1.5 text-center whitespace-nowrap">
        <span className={cn(primary.status === "active" && "text-emerald-600 dark:text-emerald-400 animate-pulse")}>
          {primary.start}
        </span>
      </td>
      <td className="px-1 py-1.5 text-center whitespace-nowrap">
        {primary.end ? (
          primary.end
        ) : (
          <span className="text-emerald-600 dark:text-emerald-400 text-[9px] animate-pulse">
            Active
          </span>
        )}
      </td>
      <td className="border-r px-1 py-1.5 text-center font-medium whitespace-nowrap">
        {totalHrs > 0 ? (
          <span
            className={cn(hasMultiple && "underline decoration-dotted")}
            title={
              hasMultiple
                ? `${entries.length} entries totalling ${totalHrs.toFixed(2)} hrs`
                : undefined
            }
          >
            {totalHrs.toFixed(2)}
          </span>
        ) : (
          ""
        )}
      </td>
    </>
  );
}

/** Status indicator icon */
function StatusIndicator({
  status,
}: {
  status: "none" | "draft" | "submitted" | "approved" | "rejected";
}) {
  if (status === "submitted") {
    return (
      <span
        className="inline-block size-0 border-l-[4px] border-r-[4px] border-b-[7px] border-l-transparent border-r-transparent border-b-emerald-500 shrink-0"
        title={STATUS_LABELS[status]}
      />
    );
  }
  if (status === "approved") {
    return (
      <span
        className="inline-block size-2 rotate-45 bg-blue-500 shrink-0"
        title={STATUS_LABELS[status]}
      />
    );
  }
  if (status === "rejected") {
    return (
      <span
        className="inline-block size-2 bg-rose-500 shrink-0"
        title={STATUS_LABELS[status]}
      />
    );
  }
  return null;
}
