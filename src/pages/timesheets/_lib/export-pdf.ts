import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Common styling constants */
const BRAND_COLOR: [number, number, number] = [30, 64, 175]; // blue-800
const HEADER_BG: [number, number, number] = [241, 245, 249]; // slate-100
const BORDER_COLOR: [number, number, number] = [203, 213, 225]; // slate-300
const TEXT_DARK: [number, number, number] = [15, 23, 42]; // slate-900
const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // slate-500

/**
 * Adds a styled document header with org name, title, and date range
 */
function addDocumentHeader(
  doc: jsPDF,
  opts: {
    orgName?: string;
    title: string;
    dateRange: string;
    generatedDate: string;
  }
): number {
  let y = 15;

  // Organisation name
  if (opts.orgName) {
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(opts.orgName, 14, y);
    y += 6;
  }

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(opts.title, 14, y);
  y += 7;

  // Date range
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MUTED);
  doc.text(opts.dateRange, 14, y);

  // Generated date (right-aligned)
  doc.text(`Generated: ${opts.generatedDate}`, 196, y, { align: "right" });
  y += 4;

  // Separator line
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.4);
  doc.line(14, y, 196, y);
  y += 6;

  return y;
}

/**
 * Adds a footer with page number
 */
function addPageFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Page ${i} of ${pageCount}`, 196, 287, { align: "right" });
  }
}

/** ---- Weekly Report PDF ---- */

type WeeklyReportRow = {
  userName: string;
  totalHours: number;
  timesheetStatus: "none" | "draft" | "submitted" | "approved" | "rejected";
  days: Record<
    string,
    Array<{ start: string; end: string | null; hours: number; breakMinutes: number; status: string }>
  >;
};

const STATUS_LABELS: Record<string, string> = {
  none: "Not submitted",
  draft: "Draft",
  submitted: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};

export function exportWeeklyReportPDF(opts: {
  data: WeeklyReportRow[];
  days: Date[];
  weekStart: Date;
  weekEnd: Date;
  weekNumber: number;
  orgName?: string;
}) {
  const { data, days, weekStart, weekEnd, weekNumber, orgName } = opts;
  // Use landscape for 7-day view
  const doc = new jsPDF({ orientation: "landscape" });

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const formatDayShort = (d: Date) =>
    d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });

  const y = addDocumentHeader(doc, {
    orgName,
    title: `Weekly Timesheet Report — Week ${weekNumber}`,
    dateRange: `${formatDate(weekStart)} – ${formatDate(weekEnd)}`,
    generatedDate: new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  });

  // Build column headers: Name | Mon Start/End/HR | Tue Start/End/HR | ... | Total | Status
  const head = [
    [
      "Name",
      ...days.flatMap((d) => [
        `${formatDayShort(d)} In`,
        `${formatDayShort(d)} Out`,
        `${formatDayShort(d)} HR`,
      ]),
      "Total",
      "Status",
    ],
  ];

  const formatDateKey = (d: Date) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${da}`;
  };

  const body = data.map((row) => {
    const dayCells = days.flatMap((d) => {
      const dateStr = formatDateKey(d);
      const entries = row.days[dateStr];
      if (!entries || entries.length === 0) return ["—", "—", "—"];
      const e = entries[0];
      const totalHrs = entries.reduce((s, entry) => s + entry.hours, 0);
      return [e.start, e.end ?? "Active", totalHrs > 0 ? totalHrs.toFixed(2) : "—"];
    });
    return [
      row.userName,
      ...dayCells,
      row.totalHours > 0 ? row.totalHours.toFixed(2) : "0.00",
      STATUS_LABELS[row.timesheetStatus] ?? row.timesheetStatus,
    ];
  });

  // Grand total row
  const grandTotal = data.reduce((sum, r) => sum + r.totalHours, 0);
  const footRow = [
    `Totals (${data.length} staff)`,
    ...days.flatMap((d) => {
      const dateStr = formatDateKey(d);
      const dayTotal = data.reduce((sum, row) => {
        const entries = row.days[dateStr];
        if (!entries) return sum;
        return sum + entries.reduce((s, e) => s + e.hours, 0);
      }, 0);
      return ["", "", dayTotal > 0 ? dayTotal.toFixed(2) : ""];
    }),
    grandTotal.toFixed(2),
    "",
  ];

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot: [footRow],
    theme: "grid",
    styles: { fontSize: 6, cellPadding: 1.5, textColor: TEXT_DARK, lineColor: BORDER_COLOR, lineWidth: 0.2 },
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 5.5 },
    footStyles: { fillColor: HEADER_BG, textColor: TEXT_DARK, fontStyle: "bold", fontSize: 6 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 28 } },
    margin: { left: 8, right: 8 },
  });

  addPageFooter(doc);

  const startStr = formatDateKey(weekStart);
  const endStr = formatDateKey(weekEnd);
  doc.save(`weekly-timesheet-${startStr}-to-${endStr}.pdf`);
}

/** ---- Timesheet Summary PDF ---- */

type SummaryRow = {
  userName: string;
  shiftCount: number;
  positions: string[];
  locations: string[];
  dateFrom: string | null;
  dateTo: string | null;
  scheduledHours: number;
  actualHours: number;
  hourlyRate: number;
  scheduledPay: number;
  actualPay: number;
  employmentType?: string;
};

export function exportTimesheetSummaryPDF(opts: {
  data: SummaryRow[];
  weekStart: Date;
  weekEnd: Date;
  orgName?: string;
}) {
  const { data, weekStart, weekEnd, orgName } = opts;
  const doc = new jsPDF({ orientation: "landscape" });

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

  const y = addDocumentHeader(doc, {
    orgName,
    title: "Timesheet Summary",
    dateRange: `${formatDate(weekStart)} – ${formatDate(weekEnd)}`,
    generatedDate: new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  });

  const head = [["Type", "Person", "Description", "Location", "Date", "Sched. Hours", "Actual Hours", "Rate", "Sched. Pay", "Actual Pay"]];

  const fmtDateRange = (from: string | null, to: string | null) => {
    if (!from) return "—";
    const f = new Date(from);
    const t = to ? new Date(to) : f;
    const fStr = f.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    if (from === to) return fStr;
    const tStr = t.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    return `${fStr} - ${tStr}`;
  };

  const body = data.map((row) => [
    `(${row.shiftCount}) shifts`,
    row.userName,
    row.positions.join(", ") || "—",
    row.locations.join(", ") || "—",
    fmtDateRange(row.dateFrom, row.dateTo),
    row.scheduledHours.toFixed(2),
    row.actualHours.toFixed(2),
    row.hourlyRate > 0 ? `£${row.hourlyRate.toFixed(2)}` : "—",
    `£${row.scheduledPay.toFixed(2)}`,
    `£${row.actualPay.toFixed(2)}`,
  ]);

  // Totals
  const totals = data.reduce(
    (acc, row) => ({
      scheduledHours: acc.scheduledHours + row.scheduledHours,
      actualHours: acc.actualHours + row.actualHours,
      scheduledPay: acc.scheduledPay + row.scheduledPay,
      actualPay: acc.actualPay + row.actualPay,
    }),
    { scheduledHours: 0, actualHours: 0, scheduledPay: 0, actualPay: 0 }
  );

  const footRow = [
    "",
    "TOTALS",
    "",
    "",
    "",
    totals.scheduledHours.toFixed(2),
    totals.actualHours.toFixed(2),
    "",
    `£${totals.scheduledPay.toFixed(2)}`,
    `£${totals.actualPay.toFixed(2)}`,
  ];

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot: [footRow],
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2, textColor: TEXT_DARK, lineColor: BORDER_COLOR, lineWidth: 0.2 },
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    footStyles: { fillColor: HEADER_BG, textColor: TEXT_DARK, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
    margin: { left: 10, right: 10 },
  });

  addPageFooter(doc);

  const formatDateKey = (d: Date) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${da}`;
  };

  doc.save(`timesheet-summary-${formatDateKey(weekStart)}-to-${formatDateKey(weekEnd)}.pdf`);
}

/** ---- My Timesheet PDF (staff view) ---- */

type MyTimesheetEntry = {
  _id: string;
  date: string;
  clockIn: string;
  clockOut?: string | null;
  breakMinutes: number;
};

function computeWorkedMinutes(clockIn: string, clockOut: string, breakMinutes: number): number {
  const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  return Math.max(0, Math.round(diff / 60000) - breakMinutes);
}

function formatMinutes(mins: number): string {
  if (mins <= 0) return "0h 0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function exportMyTimesheetPDF(opts: {
  entries: MyTimesheetEntry[];
  weekStart: Date;
  weekEnd: Date;
  userName: string;
  orgName?: string;
  status?: string;
}) {
  const { entries, weekStart, weekEnd, userName, orgName, status } = opts;
  const doc = new jsPDF();

  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

  let y = addDocumentHeader(doc, {
    orgName,
    title: "My Timesheet",
    dateRange: `${formatDate(weekStart)} – ${formatDate(weekEnd)}`,
    generatedDate: new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  });

  // Staff name & status
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(`Staff: ${userName}`, 14, y);
  if (status) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    doc.text(`Status: ${status}`, 80, y);
  }
  y += 8;

  // Build daily rows
  const dayRows: string[][] = [];
  let totalMins = 0;

  // Group entries by day across the week
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    const dayLabel = day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

    const dayEntries = entries.filter((e) => e.date === dateStr);

    if (dayEntries.length === 0) {
      dayRows.push([dayLabel, "—", "—", "—", "0h 0m"]);
    } else {
      let dayMins = 0;
      dayEntries.forEach((entry, idx) => {
        const clockInTime = new Date(entry.clockIn).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        const clockOutTime = entry.clockOut
          ? new Date(entry.clockOut).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
          : "Active";
        const breakStr = entry.breakMinutes > 0 ? `${entry.breakMinutes}m` : "—";
        const worked = entry.clockOut ? computeWorkedMinutes(entry.clockIn, entry.clockOut, entry.breakMinutes) : 0;
        dayMins += worked;

        dayRows.push([
          idx === 0 ? dayLabel : "",
          clockInTime,
          clockOutTime,
          breakStr,
          idx === 0 && dayEntries.length === 1 ? formatMinutes(worked) : idx === dayEntries.length - 1 ? formatMinutes(dayMins) : "",
        ]);
      });
      totalMins += dayMins;
    }
  }

  const footRow = ["Total", "", "", "", formatMinutes(totalMins)];

  autoTable(doc, {
    startY: y,
    head: [["Day", "Clock In", "Clock Out", "Break", "Hours"]],
    body: dayRows,
    foot: [footRow],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 3, textColor: TEXT_DARK, lineColor: BORDER_COLOR, lineWidth: 0.2 },
    headStyles: { fillColor: BRAND_COLOR, textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: HEADER_BG, textColor: TEXT_DARK, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40 },
      4: { halign: "right" },
    },
  });

  addPageFooter(doc);

  const formatDateKey = (d: Date) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${da}`;
  };

  doc.save(`my-timesheet-${formatDateKey(weekStart)}-to-${formatDateKey(weekEnd)}.pdf`);
}
