import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  startOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  format,
  parseISO,
  isToday,
  isThisWeek,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Truck,
  Users,
  Check,
  X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import AvailabilityDialog from "./availability-dialog.tsx";
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

export default function WeeklyCalendar() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Availability dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState("");

  const weekEnd = addDays(weekStart, 7);

  const myShifts = useQuery(api.shifts.getMyShiftsByDateRange, {
    startDate: weekStart.toISOString(),
    endDate: weekEnd.toISOString(),
  });

  const availability = useQuery(api.availability.getByDateRange, {
    startDate: format(weekStart, "yyyy-MM-dd"),
    endDate: format(weekEnd, "yyyy-MM-dd"),
  });

  const setAvailability = useMutation(api.availability.set);
  const clearAvailability = useMutation(api.availability.clear);

  // Build 7 day cells
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart]);

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

  // Map availability by date string — now supports multiple entries per day
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

  // Derive dominant status per day (for background color)
  function getDayStatus(dateStr: string): "available" | "unavailable" | null {
    const entries = availabilityByDate.get(dateStr);
    if (!entries || entries.length === 0) return null;
    // If any all-day entry exists, use its status
    const allDayEntry = entries.find((e) => e.allDay !== false);
    if (allDayEntry) return allDayEntry.status;
    // Otherwise use the first entry's status
    return entries[0].status;
  }

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, day: Date) => {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        date: format(day, "yyyy-MM-dd"),
      });
    },
    []
  );

  // Close context menu on click outside
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

  if (myShifts === undefined || availability === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  const isCurrentWeek = isThisWeek(weekStart, { weekStartsOn: 1 });

  return (
    <div className="space-y-5">
      {/* Week navigator */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setWeekStart((w) => subWeeks(w, 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-sm font-heading font-semibold min-w-[200px] text-center">
          {format(weekStart, "MMM d")} –{" "}
          {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        {!isCurrentWeek && (
          <Button
            variant="secondary"
            size="sm"
            className="ml-1"
            onClick={() =>
              setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
          >
            <CalendarDays className="size-4 mr-1.5" />
            Today
          </Button>
        )}
      </div>

      {/* Weekly grid */}
      <div className="border rounded-xl overflow-hidden bg-card">
        {/* Desktop: horizontal layout */}
        <div className="hidden md:grid md:grid-cols-7">
          {weekDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
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
                  "min-h-[200px] border-r last:border-r-0 flex flex-col transition-colors cursor-pointer hover:bg-muted/30",
                  today && "bg-primary/[0.04]",
                  dayStatus === "available" && "bg-emerald-500/[0.06]",
                  dayStatus === "unavailable" && "bg-rose-500/[0.06]"
                )}
              >
                {/* Day header */}
                <div
                  className={cn(
                    "px-3 py-2.5 border-b bg-muted/30 text-center",
                    today && "bg-primary/10"
                  )}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    {format(day, "EEE")}
                  </div>
                  <div
                    className={cn(
                      "text-lg font-heading font-bold mt-0.5",
                      today &&
                        "bg-primary text-primary-foreground rounded-full size-8 flex items-center justify-center mx-auto"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  {dayEntries.length > 0 && (
                    <div className="flex items-center justify-center gap-1 mt-1">
                      {dayEntries.map((entry) => (
                        <span
                          key={entry._id}
                          className={cn(
                            "size-2 rounded-full",
                            entry.status === "available"
                              ? "bg-emerald-500"
                              : "bg-rose-500"
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Shifts */}
                <div className="flex-1 p-2 space-y-2">
                  {/* Availability entries */}
                  {dayEntries.map((entry) => (
                    <AvailabilityPill key={entry._id} entry={entry} />
                  ))}

                  {dayShifts.length === 0 && dayEntries.length === 0 && (
                    <p className="text-[10px] text-muted-foreground text-center mt-4">
                      No shifts
                    </p>
                  )}
                  {dayShifts.map((shift) => (
                    <ShiftCard key={shift._id} shift={shift} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile: stacked layout */}
        <div className="md:hidden divide-y">
          {weekDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
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
                  "p-3 transition-colors cursor-pointer hover:bg-muted/30",
                  today && "bg-primary/[0.04]",
                  dayStatus === "available" && "bg-emerald-500/[0.06]",
                  dayStatus === "unavailable" && "bg-rose-500/[0.06]"
                )}
              >
                {/* Day header */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={cn(
                      "text-sm font-heading font-bold",
                      today &&
                        "bg-primary text-primary-foreground rounded-full size-7 flex items-center justify-center"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(day, "EEEE")}
                  </span>
                  {dayEntries.length > 0 && (
                    <div className="flex items-center gap-1 ml-auto">
                      {dayEntries.map((entry) => (
                        <span
                          key={entry._id}
                          className={cn(
                            "size-2 rounded-full",
                            entry.status === "available"
                              ? "bg-emerald-500"
                              : "bg-rose-500"
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Availability entries */}
                {dayEntries.length > 0 && (
                  <div className="space-y-1 pl-9 mb-2">
                    {dayEntries.map((entry) => (
                      <AvailabilityPill key={entry._id} entry={entry} />
                    ))}
                  </div>
                )}

                {/* Shifts */}
                {dayShifts.length === 0 && dayEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-9">
                    No shifts
                  </p>
                ) : (
                  <div className="space-y-2 pl-9">
                    {dayShifts.map((shift) => (
                      <ShiftCard key={shift._id} shift={shift} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Context menu */}
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
    </div>
  );
}

/** Small pill showing an availability entry */
function AvailabilityPill({ entry }: { entry: AvailabilityEntry }) {
  return (
    <div
      className={cn(
        "rounded px-2 py-1 text-[10px] flex items-center gap-1.5",
        entry.status === "available"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
      )}
    >
      {entry.status === "available" ? (
        <Check className="size-2.5 shrink-0" />
      ) : (
        <XIcon className="size-2.5 shrink-0" />
      )}
      <span className="truncate">
        {entry.allDay === false && entry.startTime && entry.endTime
          ? `${entry.status === "available" ? "Avail" : "Unavail"} ${entry.startTime}–${entry.endTime}`
          : entry.status === "available"
            ? "Available all day"
            : "Unavailable all day"}
        {entry.notes ? ` · ${entry.notes}` : ""}
      </span>
    </div>
  );
}

/** Detailed shift card for weekly view */
function ShiftCard({
  shift,
}: {
  shift: {
    _id: string;
    startTime: string;
    endTime: string;
    vehicle: string;
    callSign?: string;
    position?: string;
    members: Array<{ userId: string; name: string }>;
  };
}) {
  return (
    <div className="rounded-lg px-2.5 py-2 bg-primary/10 border border-primary/20 text-xs space-y-1">
      <div className="font-semibold flex items-center gap-1.5">
        <Clock className="size-3 shrink-0 text-primary" />
        {format(parseISO(shift.startTime), "HH:mm")} –{" "}
        {format(parseISO(shift.endTime), "HH:mm")}
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Truck className="size-3 shrink-0" />
        <span className="truncate">
          {shift.callSign ? `${shift.callSign} · ${shift.vehicle}` : shift.vehicle}{shift.position ? ` · ${shift.position}` : ""}
        </span>
      </div>
      {shift.members.length > 1 && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="size-3 shrink-0" />
          <span className="truncate">
            {shift.members.map((m) => m.name).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
