import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  parseISO,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Truck,
  Radio,
  Users,
  Briefcase,
  Check,
  X as XIcon,
  CheckCircle2,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import AvailabilityDialog from "./availability-dialog.tsx";
import ShiftResponseDialog from "./shift-response-dialog.tsx";
import type { ShiftForResponse } from "./shift-response-dialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type ContextMenuState = {
  x: number;
  y: number;
  date: string;
} | null;

type AvailabilityEntry = {
  _id: Id<"availability">;
  date: string;
  status: "available" | "unavailable";
  allDay?: boolean;
  startTime?: string;
  endTime?: string;
  notes?: string;
};

export default function MonthlyCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Availability dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState("");

  // Shift response dialog state
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftForResponse | null>(null);

  // Date range for the calendar grid (includes partial weeks)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const myShifts = useQuery(api.shifts.getMyShiftsByDateRange, {
    startDate: gridStart.toISOString(),
    endDate: addDays(gridEnd, 1).toISOString(),
  });

  const availability = useQuery(api.availability.getByDateRange, {
    startDate: format(gridStart, "yyyy-MM-dd"),
    endDate: format(addDays(gridEnd, 1), "yyyy-MM-dd"),
  });

  const setAvailability = useMutation(api.availability.set);
  const clearAvailability = useMutation(api.availability.clear);

  // Build day cells for the calendar grid
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    let day = gridStart;
    while (day <= gridEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [gridStart, gridEnd]);

  // Map shifts by date string
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, typeof myShifts>();
    if (!myShifts) return map;
    for (const shift of myShifts) {
      const dateStr = format(parseISO(shift.startTime), "yyyy-MM-dd");
      const existing = map.get(dateStr) ?? [];
      existing.push(shift);
      map.set(dateStr, existing);
    }
    return map;
  }, [myShifts]);

  // Map availability by date string
  const availabilityByDate = useMemo(() => {
    const map = new Map<string, AvailabilityEntry[]>();
    if (!availability) return map;
    for (const entry of availability) {
      const existing = map.get(entry.date) ?? [];
      existing.push({
        _id: entry._id,
        date: entry.date,
        status: entry.status,
        allDay: entry.allDay,
        startTime: entry.startTime,
        endTime: entry.endTime,
        notes: entry.notes,
      });
      map.set(entry.date, existing);
    }
    return map;
  }, [availability]);

  // Derive dominant status per day
  function getDayStatus(dateStr: string): "available" | "unavailable" | null {
    const entries = availabilityByDate.get(dateStr);
    if (!entries || entries.length === 0) return null;
    const allDayEntry = entries.find((e) => e.allDay !== false);
    if (allDayEntry) return allDayEntry.status;
    return entries[0].status;
  }

  const handleContextMenu = useCallback((e: React.MouseEvent, day: Date) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      date: format(day, "yyyy-MM-dd"),
    });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    if (contextMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [contextMenu]);

  async function handleSetAvailability(status: "available" | "unavailable") {
    if (!contextMenu) return;
    try {
      await setAvailability({ date: contextMenu.date, status });
      toast.success(`Marked as ${status}`);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to update availability");
      }
    }
    setContextMenu(null);
  }

  async function handleClearAvailability() {
    if (!contextMenu) return;
    try {
      await clearAvailability({ date: contextMenu.date });
      toast.success("Availability cleared");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to clear availability");
      }
    }
    setContextMenu(null);
  }

  function openAvailabilityDialog(dateStr: string) {
    setDialogDate(dateStr);
    setDialogOpen(true);
    setContextMenu(null);
  }

  function handleShiftTap(shift: ShiftForResponse, e?: React.MouseEvent) {
    e?.stopPropagation();
    setSelectedShift(shift);
    setShiftDialogOpen(true);
  }

  if (myShifts === undefined || availability === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const selectedDayShifts = shiftsByDate.get(selectedDateStr) ?? [];
  const selectedDayEntries = availabilityByDate.get(selectedDateStr) ?? [];

  const weekDayHeadersFull = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekDayHeadersShort = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="space-y-5">
      {/* ================================================================ */}
      {/* MOBILE VIEW: compact mini-calendar + selected day detail list    */}
      {/* ================================================================ */}
      <div className="md:hidden space-y-0">
        {/* Selected day header */}
        <div className="flex items-center justify-between px-1 pb-3">
          <button
            type="button"
            onClick={() => openAvailabilityDialog(selectedDateStr)}
            className="flex items-center gap-1.5 text-base font-heading font-bold"
          >
            {format(selectedDate, "EEE d MMMM")}
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* Compact mini-calendar */}
        <div className="rounded-xl bg-muted/30 border overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7">
            {weekDayHeadersShort.map((d, i) => (
              <div key={i} className="py-2 text-center">
                <span className="text-[11px] font-medium text-muted-foreground">{d}</span>
              </div>
            ))}
          </div>

          {/* Day number grid */}
          <div className="grid grid-cols-7 pb-1">
            {calendarDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);
              const selected = isSameDay(day, selectedDate);
              const hasShifts = (shiftsByDate.get(dateStr)?.length ?? 0) > 0;
              const dayStatus = getDayStatus(dateStr);

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "relative flex flex-col items-center justify-center py-1.5 transition-colors",
                    !inMonth && "opacity-30"
                  )}
                >
                  <span
                    className={cn(
                      "size-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors",
                      today && !selected && "bg-primary/20 text-primary font-bold",
                      selected && "bg-primary text-primary-foreground font-bold",
                      !today && !selected && "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {/* Indicator dots */}
                  <div className="flex items-center gap-0.5 h-2 mt-0.5">
                    {hasShifts && (
                      <span className="size-1.5 rounded-full bg-primary" />
                    )}
                    {dayStatus === "available" && (
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                    )}
                    {dayStatus === "unavailable" && (
                      <span className="size-1.5 rounded-full bg-rose-500" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t my-3" />

        {/* Selected day detail list */}
        <div className="space-y-2 min-h-[200px]">
          {/* Availability entries */}
          {selectedDayEntries.map((entry) => (
            <div
              key={entry._id}
              className={cn(
                "rounded-xl px-4 py-3 flex items-center gap-3",
                entry.status === "available"
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-rose-500/10 border border-rose-500/20"
              )}
            >
              <span
                className={cn(
                  "size-2.5 rounded-full shrink-0",
                  entry.status === "available" ? "bg-emerald-500" : "bg-rose-500"
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {entry.allDay === false && entry.startTime && entry.endTime
                    ? `${entry.status === "available" ? "Available" : "Unavailable"} ${entry.startTime} – ${entry.endTime}`
                    : entry.status === "available"
                      ? "Available all day"
                      : "Unavailable all day"}
                </div>
                {entry.notes && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {entry.notes}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Shift cards */}
          {selectedDayShifts.map((shift) => {
            const statusDot =
              shift.responseStatus === "accepted"
                ? "bg-emerald-500"
                : shift.responseStatus === "declined"
                  ? "bg-rose-500"
                  : "bg-primary";
            const statusBg =
              shift.responseStatus === "accepted"
                ? "border-emerald-500/20"
                : shift.responseStatus === "declined"
                  ? "border-rose-500/20"
                  : "border-border";

            return (
              <button
                key={shift._id}
                type="button"
                onClick={(e) => handleShiftTap(shift, e)}
                className={cn(
                  "w-full text-left rounded-xl px-4 py-3 bg-card border transition-all active:scale-[0.98] flex items-center gap-3",
                  statusBg
                )}
              >
                {/* Status dot */}
                <span className={cn("size-2.5 rounded-full shrink-0", statusDot)} />

                {/* Shift info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="text-sm font-semibold">
                    {format(parseISO(shift.startTime), "HH:mm")} – {format(parseISO(shift.endTime), "HH:mm")}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {shift.callSign ? `${shift.callSign} · ` : ""}{shift.vehicle}
                  </div>
                  {shift.position && (
                    <div className="text-xs text-muted-foreground truncate">
                      {shift.position}
                    </div>
                  )}
                  {shift.responseStatus === "pending" && (
                    <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      Tap to respond
                    </div>
                  )}
                  {shift.responseStatus === "accepted" && (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3" />
                      Accepted
                    </div>
                  )}
                  {shift.responseStatus === "declined" && (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                      <XCircle className="size-3" />
                      Declined
                    </div>
                  )}
                </div>

                {/* Chevron */}
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}

          {/* Empty state */}
          {selectedDayShifts.length === 0 && selectedDayEntries.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <p className="text-sm">No shifts or availability set</p>
              <p className="text-xs mt-1">Tap the date header to set availability</p>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* DESKTOP VIEW: full grid calendar                                  */}
      {/* ================================================================ */}
      <div className="hidden md:block space-y-5">
        {/* Month navigator */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-sm font-heading font-semibold min-w-[160px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="size-4" />
          </Button>
          {!isSameMonth(currentMonth, new Date()) && (
            <Button variant="secondary" size="sm" className="ml-1" onClick={() => setCurrentMonth(new Date())}>
              <CalendarDays className="size-4 mr-1.5" />
              Today
            </Button>
          )}
        </div>

        {/* Calendar grid */}
        <div className="border rounded-xl overflow-hidden bg-card">
          {/* Day headers */}
          <div className="grid grid-cols-7">
            {weekDayHeadersFull.map((day) => (
              <div key={day} className="px-2 py-2 text-center bg-muted/40 border-b">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {day}
                </span>
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);
              const dayShifts = shiftsByDate.get(dateStr) ?? [];
              const dayEntries = availabilityByDate.get(dateStr) ?? [];
              const dayStatus = getDayStatus(dateStr);

              return (
                <div
                  key={dateStr}
                  onClick={() => openAvailabilityDialog(dateStr)}
                  onContextMenu={(e) => handleContextMenu(e, day)}
                  className={cn(
                    "min-h-[110px] p-1.5 border-b border-r relative transition-colors cursor-pointer hover:bg-muted/30",
                    !inMonth && "opacity-40",
                    today && "bg-primary/[0.04]",
                    dayStatus === "available" && "bg-emerald-500/[0.06]",
                    dayStatus === "unavailable" && "bg-rose-500/[0.06]"
                  )}
                >
                  {/* Day number + availability dots */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        today && "bg-primary text-primary-foreground rounded-full size-6 flex items-center justify-center",
                        !inMonth && "text-muted-foreground"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {dayEntries.map((entry) => (
                        <span
                          key={entry._id}
                          className={cn(
                            "size-2 rounded-full",
                            entry.status === "available" ? "bg-emerald-500" : "bg-rose-500"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Availability entries */}
                  {dayEntries.map((entry) => (
                    <div
                      key={entry._id}
                      className={cn(
                        "rounded px-1 py-0.5 text-[9px] mb-0.5 truncate",
                        entry.status === "available"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                      )}
                    >
                      {entry.allDay === false && entry.startTime && entry.endTime
                        ? `${entry.startTime}–${entry.endTime}`
                        : entry.status === "available"
                          ? "Available"
                          : "Unavailable"}
                    </div>
                  ))}

                  {/* Shifts */}
                  <div className="space-y-0.5">
                    {dayShifts.map((shift) => {
                      const statusBorderClass =
                        shift.responseStatus === "accepted"
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : shift.responseStatus === "declined"
                            ? "border-rose-500/40 bg-rose-500/10"
                            : "border-primary/20 bg-primary/10";

                      return (
                        <button
                          key={shift._id}
                          type="button"
                          onClick={(e) => handleShiftTap(shift, e)}
                          className={cn(
                            "w-full text-left rounded px-1.5 py-1 border text-[10px] transition-colors active:scale-[0.98]",
                            statusBorderClass
                          )}
                        >
                          <div className="font-semibold flex items-center gap-1 truncate">
                            {shift.responseStatus === "accepted" && (
                              <CheckCircle2 className="size-2.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            )}
                            {shift.responseStatus === "declined" && (
                              <XCircle className="size-2.5 shrink-0 text-rose-600 dark:text-rose-400" />
                            )}
                            {shift.responseStatus === "pending" && (
                              <Clock className="size-2.5 shrink-0 text-primary" />
                            )}
                            {format(parseISO(shift.startTime), "HH:mm")} – {format(parseISO(shift.endTime), "HH:mm")}
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground truncate">
                            <Truck className="size-2.5 shrink-0" />
                            <span className="truncate">{shift.vehicle}</span>
                          </div>
                          {shift.callSign && (
                            <div className="flex items-center gap-1 text-muted-foreground truncate">
                              <Radio className="size-2.5 shrink-0" />
                              <span className="truncate">{shift.callSign}</span>
                            </div>
                          )}
                          {shift.members.length > 1 && (
                            <div className="flex items-center gap-1 text-muted-foreground truncate">
                              <Users className="size-2.5 shrink-0" />
                              <span className="truncate">{shift.members.map((m) => m.name).join(", ")}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Context menu (desktop) */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[180px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium border-b mb-1">
            {format(parseISO(contextMenu.date), "EEE, MMM d")}
          </div>
          <button
            onClick={() => handleSetAvailability("available")}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <Check className="size-4 text-emerald-500" />
            Set Available (all day)
          </button>
          <button
            onClick={() => handleSetAvailability("unavailable")}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <XIcon className="size-4 text-rose-500" />
            Set Unavailable (all day)
          </button>
          <button
            onClick={() => openAvailabilityDialog(contextMenu.date)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <Clock className="size-4 text-primary" />
            Set specific times...
          </button>
          {(availabilityByDate.get(contextMenu.date)?.length ?? 0) > 0 && (
            <button
              onClick={handleClearAvailability}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-muted-foreground border-t mt-1"
            >
              Clear All Availability
            </button>
          )}
        </div>
      )}

      {/* Availability Dialog */}
      <AvailabilityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        date={dialogDate}
        entries={availabilityByDate.get(dialogDate) ?? []}
      />

      {/* Shift Response Dialog */}
      <ShiftResponseDialog
        open={shiftDialogOpen}
        onOpenChange={setShiftDialogOpen}
        shift={selectedShift}
      />
    </div>
  );
}
