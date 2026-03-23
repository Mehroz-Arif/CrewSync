import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  startOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  format,
  parseISO,
  isThisWeek,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import ScheduleGrid from "./_components/schedule-grid.tsx";
import type { CellShift } from "./_components/schedule-grid.tsx";
import ShiftDialog from "./_components/shift-dialog.tsx";
import MonthlyCalendar from "./_components/monthly-calendar.tsx";

export default function ShiftsPage() {
  const currentUser = useQuery(api.users.getCurrentUser);

  // Quick check before rendering either view
  if (currentUser === undefined) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto">
        <MonthlyCalendar />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <AdminScheduleView />
    </div>
  );
}

/** Admin-only weekly schedule with unassigned pool and drag-and-drop */
function AdminScheduleView() {
  const staff = useQuery(api.users.getAllStaff);

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekEnd = addWeeks(weekStart, 1);

  const shifts = useQuery(api.shifts.getShiftsByDateRange, {
    startDate: weekStart.toISOString(),
    endDate: weekEnd.toISOString(),
  });

  const unassigned = useQuery(api.shifts.getUnassignedByDateRange, {
    startDate: weekStart.toISOString(),
    endDate: weekEnd.toISOString(),
  });

  // Get all staff availability for the week
  const allAvailability = useQuery(api.availability.getAllByDateRange, {
    startDate: format(weekStart, "yyyy-MM-dd"),
    endDate: format(addDays(weekStart, 7), "yyyy-MM-dd"),
  });

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogDate, setDialogDate] = useState("");
  const [dialogUserId, setDialogUserId] = useState<Id<"users"> | undefined>();
  const [dialogShift, setDialogShift] = useState<
    | {
        _id: Id<"shifts">;
        startTime: string;
        endTime: string;
        vehicle: string;
        notes?: string;
        members: Array<{
          membershipId: Id<"shiftMembers">;
          userId: Id<"users">;
          name: string;
        }>;
      }
    | undefined
  >();

  // Build grid data: cellId → CellShift[]
  const gridData = useMemo(() => {
    const map = new Map<string, CellShift[]>();
    if (!shifts) return map;

    for (const shift of shifts) {
      const dateStr = format(parseISO(shift.startTime), "yyyy-MM-dd");
      for (const member of shift.members) {
        const key = `${member.userId}__${dateStr}`;
        const existing = map.get(key) ?? [];
        existing.push({
          shiftId: shift._id,
          membershipId: member.membershipId,
          startTime: shift.startTime,
          endTime: shift.endTime,
          vehicle: shift.vehicle,
          notes: shift.notes,
        });
        map.set(key, existing);
      }
    }
    return map;
  }, [shifts]);

  // Build availability map: userId__date → status
  const availabilityData = useMemo(() => {
    const map = new Map<string, "available" | "unavailable">();
    if (!allAvailability) return map;
    for (const entry of allAvailability) {
      map.set(`${entry.userId}__${entry.date}`, entry.status);
    }
    return map;
  }, [allAvailability]);

  function handleCellClick(userId: Id<"users">, date: Date) {
    setDialogMode("create");
    setDialogDate(format(date, "yyyy-MM-dd"));
    setDialogUserId(userId);
    setDialogShift(undefined);
    setDialogOpen(true);
  }

  function handleShiftClick(cellShift: CellShift) {
    const full = shifts?.find((s) => s._id === cellShift.shiftId);
    if (!full) return;
    setDialogMode("edit");
    setDialogShift({
      _id: full._id,
      startTime: full.startTime,
      endTime: full.endTime,
      vehicle: full.vehicle,
      notes: full.notes,
      members: full.members,
    });
    setDialogDate("");
    setDialogUserId(undefined);
    setDialogOpen(true);
  }

  // Loading
  if (shifts === undefined || staff === undefined || unassigned === undefined || allAvailability === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  const isCurrentWeek = isThisWeek(weekStart, { weekStartsOn: 1 });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl">
            Shift Schedule
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Drag shifts between cells to reassign, or from the pool above to allocate
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            setDialogMode("create");
            setDialogDate(format(new Date(), "yyyy-MM-dd"));
            setDialogUserId(undefined);
            setDialogShift(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4 mr-1.5" />
          Add Shift
        </Button>
      </div>

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

      {/* Availability legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-rose-500/20 border border-rose-500/40" />
          <span>Unavailable</span>
        </div>
      </div>

      {/* Grid with pool */}
      <ScheduleGrid
        weekStart={weekStart}
        staff={staff}
        gridData={gridData}
        isAdmin={true}
        unassignedShifts={unassigned}
        availabilityData={availabilityData}
        onCellClick={handleCellClick}
        onShiftClick={handleShiftClick}
      />

      {/* Shift dialog */}
      <ShiftDialog
        key={
          dialogOpen
            ? dialogMode === "edit"
              ? dialogShift?._id
              : `create-${dialogDate}-${dialogUserId ?? "all"}`
            : "closed"
        }
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        defaultDate={dialogDate}
        defaultUserId={dialogUserId}
        shift={dialogShift}
        staff={staff}
      />
    </div>
  );
}
