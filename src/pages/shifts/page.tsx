import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
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
  Send,
  Undo2,
  Calendar,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import ScheduleGrid from "./_components/schedule-grid.tsx";
import type { CellShift } from "./_components/schedule-grid.tsx";
import type { LeaveNote as LeaveNoteType } from "./_components/schedule-grid.tsx";
import type { UnassignedShift } from "./_components/unassigned-pool.tsx";
import ShiftDialog from "./_components/shift-dialog.tsx";
import EditLeaveDialog from "./_components/edit-leave-dialog.tsx";
import MonthlyCalendar from "./_components/monthly-calendar.tsx";
import WeeklyCalendar from "./_components/weekly-calendar.tsx";
import PatternsTab from "./_components/patterns-tab.tsx";
import VehicleAllocationsTab from "./_components/vehicle-allocations-tab.tsx";
import { useStaffPreview } from "@/hooks/use-staff-preview.tsx";
import { buildRoleColorMap } from "./_lib/role-colors.ts";

export default function ShiftsPage() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const { isPreviewingAsStaff } = useStaffPreview();

  if (currentUser === undefined) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin" && !isPreviewingAsStaff;

  if (!isAdmin) {
    return <StaffScheduleView />;
  }

  return (
    <div className="w-full">
      <AdminView />
    </div>
  );
}

/** Staff view with Week/Month toggle */
function StaffScheduleView() {
  const [view, setView] = useState<"week" | "month">("month");

  return (
    <div className="space-y-2">
      {/* View toggle */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
          <Button
            variant={view === "week" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("week")}
            className="gap-1.5"
          >
            <CalendarRange className="size-4" />
            Week
          </Button>
          <Button
            variant={view === "month" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("month")}
            className="gap-1.5"
          >
            <Calendar className="size-4" />
            Month
          </Button>
        </div>
      </div>

      {/* View content */}
      {view === "week" ? <WeeklyCalendar /> : <MonthlyCalendar />}
    </div>
  );
}

/** Admin view with Schedule and Patterns tabs */
function AdminView() {
  const rawStaff = useQuery(api.users.getAllStaff);

  // Sort staff alphabetically by name
  const staff = useMemo(
    () =>
      rawStaff
        ? [...rawStaff].sort((a, b) =>
            (a.name ?? "").localeCompare(b.name ?? "")
          )
        : undefined,
    [rawStaff]
  );

  if (staff === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="schedule">
      <TabsContent value="schedule" className="mt-0">
        <AdminScheduleView staff={staff} />
      </TabsContent>
      <TabsContent value="vehicles" className="mt-0">
        <div className="flex items-center justify-end mb-1">
          <TabsList>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
          </TabsList>
        </div>
        <VehicleAllocationsTab />
      </TabsContent>
      <TabsContent value="patterns" className="mt-0">
        <div className="flex items-center justify-end mb-1">
          <TabsList>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
          </TabsList>
        </div>
        <PatternsTab staff={staff} />
      </TabsContent>
    </Tabs>
  );
}

type StaffMember = {
  _id: Id<"users">;
  name?: string;
  role?: string;
  department?: string;
};

/** Admin-only weekly schedule with unassigned pool and drag-and-drop */
function AdminScheduleView({ staff }: { staff: StaffMember[] }) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekEnd = addWeeks(weekStart, 1);

  // Query job titles for role colour map
  const positionOptions = useQuery(api.positions.list);
  const roleColorMap = useMemo(() => buildRoleColorMap(positionOptions), [positionOptions]);

  // Auto-apply active patterns when the viewed week changes
  const applyToWeek = useMutation(api.shiftPatterns.applyToWeek);
  const appliedWeeksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const weekKey = weekStart.toISOString();
    if (appliedWeeksRef.current.has(weekKey)) return;
    appliedWeeksRef.current.add(weekKey);

    applyToWeek({ weekStartISO: weekKey })
      .then((result) => {
        if (result.created > 0) {
          toast.success(
            `Auto-applied patterns: ${result.created} shift${result.created !== 1 ? "s" : ""} created`
          );
        }
      })
      .catch(() => {
        // Silently ignore — no active patterns or other expected errors
      });
  }, [weekStart, applyToWeek]);

  const shifts = useQuery(api.shifts.getShiftsByDateRange, {
    startDate: weekStart.toISOString(),
    endDate: weekEnd.toISOString(),
  });

  const unassigned = useQuery(api.shifts.getUnassignedByDateRange, {
    startDate: weekStart.toISOString(),
    endDate: weekEnd.toISOString(),
  });

  const allAvailability = useQuery(api.availability.getAllByDateRange, {
    startDate: format(weekStart, "yyyy-MM-dd"),
    endDate: format(addDays(weekStart, 7), "yyyy-MM-dd"),
  });

  // Fetch vehicle allocations for the same week
  const vehicleAllocations = useQuery(api.vehicleAllocations.getByDateRange, {
    startDate: format(weekStart, "yyyy-MM-dd"),
    endDate: format(addDays(weekStart, 6), "yyyy-MM-dd"),
  });

  // Fetch shift declines for the week
  const declines = useQuery(api.shifts.getDeclinesByDateRange, {
    startDate: format(weekStart, "yyyy-MM-dd"),
    endDate: format(addDays(weekStart, 7), "yyyy-MM-dd"),
  });

  // Fetch approved leave for the week
  const approvedLeave = useQuery(api.leaveRequests.getApprovedByDateRange, {
    startDate: format(weekStart, "yyyy-MM-dd"),
    endDate: format(addDays(weekStart, 6), "yyyy-MM-dd"),
  });

  const setPublished = useMutation(api.shifts.setPublished);
  const [isPublishing, setIsPublishing] = useState(false);

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
        callSign?: string;
        position?: string;
        notes?: string;
        members: Array<{
          membershipId: Id<"shiftMembers">;
          userId: Id<"users">;
          name: string;
        }>;
      }
    | undefined
  >();

  // Edit leave dialog state
  const [editLeaveOpen, setEditLeaveOpen] = useState(false);
  const [editLeaveData, setEditLeaveData] = useState<LeaveNoteType | null>(null);

  // Build vehicle allocation lookup: "date__callSign" → vehicle
  const vehicleAllocationMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!vehicleAllocations) return map;
    for (const alloc of vehicleAllocations) {
      map.set(`${alloc.date}__${alloc.callSign}`, alloc.vehicle);
    }
    return map;
  }, [vehicleAllocations]);

  // Build grid data: cellId → CellShift[]
  const gridData = useMemo(() => {
    const map = new Map<string, CellShift[]>();
    if (!shifts) return map;

    for (const shift of shifts) {
      const dateStr = format(parseISO(shift.startTime), "yyyy-MM-dd");
      // Look up allocated vehicle for this shift's callSign + date
      const allocatedVehicle = shift.callSign
        ? vehicleAllocationMap.get(`${dateStr}__${shift.callSign}`)
        : undefined;

      for (const member of shift.members) {
        const key = `${member.userId}__${dateStr}`;
        const existing = map.get(key) ?? [];
        existing.push({
          shiftId: shift._id,
          membershipId: member.membershipId,
          startTime: shift.startTime,
          endTime: shift.endTime,
          vehicle: shift.vehicle,
          callSign: shift.callSign,
          position: shift.position,
          notes: shift.notes,
          published: shift.published === true,
          allocatedVehicle,
          responseStatus: member.responseStatus,
          declineReason: member.declineReason,
        });
        map.set(key, existing);
      }
    }
    return map;
  }, [shifts, vehicleAllocationMap]);

  // Build availability map — for cells with multiple entries, "unavailable" takes priority
  const availabilityData = useMemo(() => {
    const map = new Map<string, "available" | "unavailable">();
    if (!allAvailability) return map;
    for (const entry of allAvailability) {
      const key = `${entry.userId}__${entry.date}`;
      const existing = map.get(key);
      // "unavailable" always wins over "available"
      if (!existing || entry.status === "unavailable") {
        map.set(key, entry.status);
      }
    }
    return map;
  }, [allAvailability]);

  // Build unavailability notes map: "userId__date" → notes[]
  type UnavailNote = {
    notes: string;
    allDay: boolean;
    startTime?: string;
    endTime?: string;
  };
  const unavailabilityNotes = useMemo(() => {
    const map = new Map<string, UnavailNote[]>();
    if (!allAvailability) return map;
    for (const entry of allAvailability) {
      if (entry.status !== "unavailable") continue;
      const key = `${entry.userId}__${entry.date}`;
      const existing = map.get(key) ?? [];
      existing.push({
        notes: entry.notes ?? "",
        allDay: entry.allDay ?? true,
        startTime: entry.startTime,
        endTime: entry.endTime,
      });
      map.set(key, existing);
    }
    return map;
  }, [allAvailability]);

  // Build decline notes map: "userId__date" → decline entries
  type DeclineNote = { reason: string; shiftStartTime: string; shiftEndTime: string; userName: string };
  const declineData = useMemo(() => {
    const map = new Map<string, DeclineNote[]>();
    if (!declines) return map;
    for (const d of declines) {
      const key = `${d.userId}__${d.date}`;
      const existing = map.get(key) ?? [];
      existing.push({
        reason: d.reason,
        shiftStartTime: d.shiftStartTime,
        shiftEndTime: d.shiftEndTime,
        userName: d.userName,
      });
      map.set(key, existing);
    }
    return map;
  }, [declines]);

  // Build leave data map: "userId__date" → leave entries (expand multi-day ranges)
  type LeaveNote = { leaveRequestId: string; leaveType: string; startDate: string; endDate: string; reason?: string; userName?: string };
  const leaveData = useMemo(() => {
    const map = new Map<string, LeaveNote[]>();
    if (!approvedLeave) return map;
    for (const lr of approvedLeave) {
      // Walk each day in the leave range that overlaps with the displayed week
      const rangeStart = format(weekStart, "yyyy-MM-dd");
      const rangeEnd = format(addDays(weekStart, 6), "yyyy-MM-dd");
      const effectiveStart = lr.startDate > rangeStart ? lr.startDate : rangeStart;
      const effectiveEnd = lr.endDate < rangeEnd ? lr.endDate : rangeEnd;

      let cursor = parseISO(effectiveStart);
      const end = parseISO(effectiveEnd);
      while (cursor <= end) {
        const dateStr = format(cursor, "yyyy-MM-dd");
        const key = `${lr.userId}__${dateStr}`;
        const existing = map.get(key) ?? [];
        existing.push({
          leaveRequestId: lr._id,
          leaveType: lr.leaveType,
          startDate: lr.startDate,
          endDate: lr.endDate,
          reason: lr.reason,
          userName: lr.userName,
        });
        map.set(key, existing);
        cursor = addDays(cursor, 1);
      }
    }
    return map;
  }, [approvedLeave, weekStart]);

  // Check if any assigned shifts in this week are unpublished or published
  const { hasUnpublished, hasPublished } = useMemo(() => {
    if (!shifts) return { hasUnpublished: false, hasPublished: false };
    let unpub = false;
    let pub = false;
    for (const s of shifts) {
      if (s.members.length > 0) {
        if (s.published) pub = true;
        else unpub = true;
      }
    }
    return { hasUnpublished: unpub, hasPublished: pub };
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
      callSign: full.callSign,
      position: full.position,
      notes: full.notes,
      members: full.members,
    });
    setDialogDate("");
    setDialogUserId(undefined);
    setDialogOpen(true);
  }

  function handleUnassignedShiftClick(uShift: UnassignedShift) {
    setDialogMode("edit");
    setDialogShift({
      _id: uShift._id,
      startTime: uShift.startTime,
      endTime: uShift.endTime,
      vehicle: uShift.vehicle,
      callSign: uShift.callSign,
      position: uShift.position,
      notes: uShift.notes,
      members: [],
    });
    setDialogDate("");
    setDialogUserId(undefined);
    setDialogOpen(true);
  }

  function handleLeaveClick(leave: LeaveNoteType) {
    setEditLeaveData(leave);
    setEditLeaveOpen(true);
  }

  async function handlePublish(publish: boolean) {
    setIsPublishing(true);
    try {
      const count = await setPublished({
        startDate: weekStart.toISOString(),
        endDate: weekEnd.toISOString(),
        published: publish,
      });
      if (count > 0) {
        toast.success(
          publish
            ? `${count} shift${count !== 1 ? "s" : ""} published to staff`
            : `${count} shift${count !== 1 ? "s" : ""} unpublished`
        );
      } else {
        toast.info("No shifts to update");
      }
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to update publish status");
      }
    } finally {
      setIsPublishing(false);
    }
  }

  // Loading
  if (shifts === undefined || unassigned === undefined || allAvailability === undefined || vehicleAllocations === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  const isCurrentWeek = isThisWeek(weekStart, { weekStartsOn: 1 });

  return (
    <div className="space-y-1 -mx-2 md:-mx-3 lg:-mx-4">
      {/* Actions row */}
      <div className="flex items-center justify-between gap-2 px-2 md:px-3 lg:px-4">
        {/* Week navigator */}
        <div className="flex items-center gap-1">
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

        {/* Action buttons + tab switcher */}
        <div className="flex items-center gap-2">
          {hasPublished && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePublish(false)}
              disabled={isPublishing}
            >
              {isPublishing ? <Spinner /> : <Undo2 className="size-4 mr-1.5" />}
              Unpublish Week
            </Button>
          )}
          {hasUnpublished && (
            <Button
              size="sm"
              onClick={() => handlePublish(true)}
              disabled={isPublishing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isPublishing ? <Spinner /> : <Send className="size-4 mr-1.5" />}
              Publish to Staff
            </Button>
          )}
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
          <TabsList>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* Grid */}
      <ScheduleGrid
        weekStart={weekStart}
        staff={staff}
        gridData={gridData}
        isAdmin={true}
        unassignedShifts={unassigned}
        availabilityData={availabilityData}
        unavailabilityNotes={unavailabilityNotes}
        declineData={declineData}
        leaveData={leaveData}
        roleColorMap={roleColorMap}
        onCellClick={handleCellClick}
        onShiftClick={handleShiftClick}
        onUnassignedShiftClick={handleUnassignedShiftClick}
        onLeaveClick={handleLeaveClick}
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

      {/* Edit leave dialog */}
      {editLeaveData && (
        <EditLeaveDialog
          key={editLeaveData.leaveRequestId}
          open={editLeaveOpen}
          onOpenChange={(open) => {
            setEditLeaveOpen(open);
            if (!open) setEditLeaveData(null);
          }}
          leaveRequestId={editLeaveData.leaveRequestId as Id<"leaveRequests">}
          userName={editLeaveData.userName ?? "Team member"}
          initialLeaveType={editLeaveData.leaveType as "annual" | "sick" | "compassionate" | "training" | "unpaid" | "other"}
          initialStartDate={editLeaveData.startDate}
          initialEndDate={editLeaveData.endDate}
          initialReason={editLeaveData.reason}
        />
      )}
    </div>
  );
}
