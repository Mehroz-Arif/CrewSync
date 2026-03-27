import { useMemo, useState, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
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
  parseISO,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Printer,
  Download,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription as EmptyDesc,
} from "@/components/ui/empty.tsx";

type DatePreset = "this_week" | "last_week" | "custom";

/** Format a number to 2 decimal places */
function fmtNum(n: number): string {
  return n.toFixed(2);
}

/** Format currency */
function fmtCurrency(n: number): string {
  return `\u00A3${n.toFixed(2)}`;
}

/** Format a date range nicely */
function fmtDateRange(from: string | null, to: string | null): string {
  if (!from) return "—";
  const f = parseISO(from);
  const t = to ? parseISO(to) : f;
  if (from === to) return format(f, "EEE, d MMM");
  return `${format(f, "EEE, d MMM")} - ${format(t, "EEE, d MMM")}`;
}

export default function TimesheetSummary() {
  const [weekOffset, setWeekOffset] = useState(0); // default to current week
  const [positionFilter, setPositionFilter] = useState("all");
  const [employmentFilter, setEmploymentFilter] = useState("all");
  const tableRef = useRef<HTMLDivElement>(null);

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

  const summary = useQuery(api.timeTracking.getTimesheetSummary, {
    startDate,
    endDate,
  });

  // Derive filter options from data
  const allPositions = useMemo(() => {
    if (!summary) return [];
    const set = new Set<string>();
    for (const row of summary) {
      for (const p of row.positions) set.add(p);
    }
    return [...set].sort();
  }, [summary]);

  // Apply filters
  const filtered = useMemo(() => {
    if (!summary) return [];
    return summary.filter((row) => {
      if (
        positionFilter !== "all" &&
        !row.positions.includes(positionFilter)
      )
        return false;
      if (
        employmentFilter !== "all" &&
        row.employmentType !== employmentFilter
      )
        return false;
      return true;
    });
  }, [summary, positionFilter, employmentFilter]);

  // Totals
  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, row) => ({
        scheduledHours: acc.scheduledHours + row.scheduledHours,
        actualHours: acc.actualHours + row.actualHours,
        scheduledPay: acc.scheduledPay + row.scheduledPay,
        actualPay: acc.actualPay + row.actualPay,
      }),
      { scheduledHours: 0, actualHours: 0, scheduledPay: 0, actualPay: 0 }
    );
  }, [filtered]);

  const isCurrentWeek = weekOffset === 0;
  const weekLabel =
    weekOffset === 0
      ? "This week"
      : weekOffset === -1
        ? "Last week"
        : `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`;

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // CSV export
  const handleExportCSV = () => {
    if (!filtered.length) return;
    const headers = [
      "Type",
      "Person",
      "Description",
      "Location",
      "Date",
      "Scheduled Hours",
      "Actual Hours",
      "Rate",
      "Scheduled Pay",
      "Actual Pay",
    ];
    const rows = filtered.map((row) => [
      `(${row.shiftCount}) shifts`,
      row.userName,
      row.positions.join(", ") || "—",
      row.locations.join(", ") || "—",
      fmtDateRange(row.dateFrom, row.dateTo),
      fmtNum(row.scheduledHours),
      fmtNum(row.actualHours),
      fmtNum(row.hourlyRate),
      fmtNum(row.scheduledPay),
      fmtNum(row.actualPay),
    ]);
    // Add totals row
    rows.push([
      "",
      "TOTALS",
      "",
      "",
      "",
      fmtNum(totals.scheduledHours),
      fmtNum(totals.actualHours),
      "",
      fmtNum(totals.scheduledPay),
      fmtNum(totals.actualPay),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join(
        "\n"
      );
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `timesheet-summary-${startDate}-to-${endDate}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setWeekOffset((o) => o - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <button
            onClick={() => setWeekOffset(-1)}
            className="text-xs font-medium px-2 py-1 rounded hover:bg-muted transition-colors whitespace-nowrap"
          >
            {format(weekStart, "dd/MM/yyyy")}
          </button>
          <span className="text-xs text-muted-foreground">to</span>
          <button
            onClick={() => setWeekOffset(-1)}
            className="text-xs font-medium px-2 py-1 rounded hover:bg-muted transition-colors whitespace-nowrap"
          >
            {format(weekEnd, "dd/MM/yyyy")}
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

        {/* Position filter */}
        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="All Positions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Positions</SelectItem>
            {allPositions.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Employment type filter */}
        <Select value={employmentFilter} onValueChange={setEmploymentFilter}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="All Employment Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees & Subcontractors</SelectItem>
            <SelectItem value="employee">Employees only</SelectItem>
            <SelectItem value="subcontractor">Subcontractors only</SelectItem>
          </SelectContent>
        </Select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action buttons */}
        <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={!filtered.length}>
          <Download className="size-3.5 mr-1.5" />
          Export CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={handlePrint}>
          <Printer className="size-3.5 mr-1.5" />
          Print
        </Button>
      </div>

      {/* Period label for print */}
      <div className="hidden print:block mb-4">
        <h2 className="text-lg font-bold">
          Timesheet Summary: {format(weekStart, "d MMM yyyy")} –{" "}
          {format(weekEnd, "d MMM yyyy")}
        </h2>
      </div>

      {/* Week label */}
      <div className="text-sm font-medium text-muted-foreground print:hidden">
        {weekLabel}
      </div>

      {/* Summary table */}
      {summary === undefined ? (
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
            <EmptyTitle>No data for this period</EmptyTitle>
            <EmptyDesc>
              No shifts or time entries found for the selected date range and
              filters.
            </EmptyDesc>
          </EmptyHeader>
        </Empty>
      ) : (
        <div
          ref={tableRef}
          className="rounded-lg border overflow-x-auto print:border-none print:rounded-none"
        >
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 print:bg-gray-100">
                <TableHead className="text-[10px] uppercase font-semibold tracking-wider whitespace-nowrap">
                  Type
                </TableHead>
                <TableHead className="text-[10px] uppercase font-semibold tracking-wider whitespace-nowrap">
                  Person
                </TableHead>
                <TableHead className="text-[10px] uppercase font-semibold tracking-wider whitespace-nowrap">
                  Description
                </TableHead>
                <TableHead className="text-[10px] uppercase font-semibold tracking-wider whitespace-nowrap">
                  Location
                </TableHead>
                <TableHead className="text-[10px] uppercase font-semibold tracking-wider whitespace-nowrap">
                  Date
                </TableHead>
                <TableHead className="text-[10px] uppercase font-semibold tracking-wider whitespace-nowrap text-right">
                  Scheduled Hours
                </TableHead>
                <TableHead className="text-[10px] uppercase font-semibold tracking-wider whitespace-nowrap text-right">
                  Actual Hours
                </TableHead>
                <TableHead className="text-[10px] uppercase font-semibold tracking-wider whitespace-nowrap text-right">
                  Rate
                </TableHead>
                <TableHead className="text-[10px] uppercase font-semibold tracking-wider whitespace-nowrap text-right">
                  Scheduled Pay
                </TableHead>
                <TableHead className="text-[10px] uppercase font-semibold tracking-wider whitespace-nowrap text-right">
                  Actual Pay
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.userId} className="print:border-b print:border-gray-300">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    ({row.shiftCount}) shifts
                  </TableCell>
                  <TableCell className="text-xs font-medium whitespace-nowrap">
                    {row.userName}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {row.positions.length > 1
                      ? "multiple"
                      : row.positions[0] ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {row.locations.length > 1
                      ? "multiple"
                      : row.locations[0] ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {fmtDateRange(row.dateFrom, row.dateTo)}
                  </TableCell>
                  <TableCell className="text-xs text-right font-medium whitespace-nowrap">
                    {fmtNum(row.scheduledHours)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-xs text-right font-medium whitespace-nowrap",
                      row.actualHours > row.scheduledHours &&
                        "text-amber-600 dark:text-amber-400",
                      row.actualHours < row.scheduledHours &&
                        row.actualHours > 0 &&
                        "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {fmtNum(row.actualHours)}
                  </TableCell>
                  <TableCell className="text-xs text-right whitespace-nowrap">
                    {row.hourlyRate > 0 ? fmtCurrency(row.hourlyRate) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right whitespace-nowrap">
                    {fmtCurrency(row.scheduledPay)}
                  </TableCell>
                  <TableCell className="text-xs text-right whitespace-nowrap">
                    {fmtCurrency(row.actualPay)}
                  </TableCell>
                </TableRow>
              ))}

              {/* Totals row */}
              <TableRow className="bg-muted/40 font-semibold print:bg-gray-50 print:font-bold">
                <TableCell colSpan={5} className="text-xs text-right">
                  Totals
                </TableCell>
                <TableCell className="text-xs text-right font-bold whitespace-nowrap">
                  {fmtNum(totals.scheduledHours)}
                </TableCell>
                <TableCell className="text-xs text-right font-bold whitespace-nowrap">
                  {fmtNum(totals.actualHours)}
                </TableCell>
                <TableCell />
                <TableCell className="text-xs text-right font-bold whitespace-nowrap">
                  {fmtCurrency(totals.scheduledPay)}
                </TableCell>
                <TableCell className="text-xs text-right font-bold whitespace-nowrap">
                  {fmtCurrency(totals.actualPay)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Staff count */}
      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground print:hidden">
          Showing {filtered.length} staff member{filtered.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
