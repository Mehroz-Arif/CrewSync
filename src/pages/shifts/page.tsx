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

export default function ShiftsPage() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const staff = useQuery(api.users.getAllStaff);

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const shifts = useQuery(api.shifts.getShiftsByDateRange, {
    startDate: weekStart.toISOString(),
    endDate: addWeeks(weekStart, 1).toISOString(),
  });

  const isAdmin = currentUser?.role === "admin";

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
  if (shifts === undefined || staff === undefined || currentUser === undefined) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  const isCurrentWeek = isThisWeek(weekStart, { weekStartsOn: 1 });

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl">
            Shift Schedule
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin
              ? "Drag shifts between cells to reassign or reschedule"
              : "View your upcoming crew schedule"}
          </p>
        </div>

        {isAdmin && (
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
        )}
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

      {/* Grid */}
      <ScheduleGrid
        weekStart={weekStart}
        staff={staff}
        gridData={gridData}
        isAdmin={isAdmin}
        onCellClick={handleCellClick}
        onShiftClick={handleShiftClick}
      />

      {/* Shift dialog */}
      {isAdmin && (
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
      )}
    </div>
  );
}
