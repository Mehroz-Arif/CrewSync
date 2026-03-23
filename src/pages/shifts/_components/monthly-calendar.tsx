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
  isToday,
  isSameDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Truck, Users, Check, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

type ContextMenuState = {
  x: number;
  y: number;
  date: string;
} | null;

export default function MonthlyCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    const map = new Map<string, "available" | "unavailable">();
    if (!availability) return map;
    for (const entry of availability) {
      map.set(entry.date, entry.status);
    }
    return map;
  }, [availability]);

  const handleContextMenu = useCallback((e: React.MouseEvent, day: Date) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      date: format(day, "yyyy-MM-dd"),
    });
  }, []);

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

  if (myShifts === undefined || availability === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  const weekDayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl md:text-3xl">My Schedule</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View your shifts and right-click any day to set your availability
        </p>
      </div>

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

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-rose-500/20 border border-rose-500/40" />
          <span>Unavailable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-primary/15 border border-primary/30" />
          <span>Shift assigned</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-xl overflow-hidden bg-card">
        {/* Day headers */}
        <div className="grid grid-cols-7">
          {weekDayHeaders.map((day) => (
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
            const avail = availabilityByDate.get(dateStr);

            return (
              <div
                key={dateStr}
                onContextMenu={(e) => handleContextMenu(e, day)}
                className={cn(
                  "min-h-[90px] md:min-h-[110px] p-1.5 border-b border-r relative transition-colors",
                  !inMonth && "opacity-40",
                  today && "bg-primary/[0.04]",
                  avail === "available" && "bg-emerald-500/[0.06]",
                  avail === "unavailable" && "bg-rose-500/[0.06]"
                )}
              >
                {/* Day number */}
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
                  {avail && (
                    <span className={cn(
                      "size-2 rounded-full",
                      avail === "available" ? "bg-emerald-500" : "bg-rose-500"
                    )} />
                  )}
                </div>

                {/* Shifts */}
                <div className="space-y-0.5">
                  {dayShifts.map((shift) => (
                    <div
                      key={shift._id}
                      className="rounded px-1.5 py-1 bg-primary/10 border border-primary/20 text-[10px]"
                    >
                      <div className="font-semibold flex items-center gap-1 truncate">
                        <Clock className="size-2.5 shrink-0" />
                        {format(parseISO(shift.startTime), "HH:mm")} – {format(parseISO(shift.endTime), "HH:mm")}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground truncate">
                        <Truck className="size-2.5 shrink-0" />
                        <span className="truncate">{shift.vehicle}</span>
                      </div>
                      {shift.members.length > 1 && (
                        <div className="flex items-center gap-1 text-muted-foreground truncate">
                          <Users className="size-2.5 shrink-0" />
                          <span className="truncate">{shift.members.map((m) => m.name).join(", ")}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
            Set Available
          </button>
          <button
            onClick={() => handleSetAvailability("unavailable")}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <XIcon className="size-4 text-rose-500" />
            Set Unavailable
          </button>
          {availabilityByDate.get(contextMenu.date) && (
            <button
              onClick={handleClearAvailability}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-muted-foreground border-t mt-1"
            >
              Clear Availability
            </button>
          )}
        </div>
      )}
    </div>
  );
}
