import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  startOfWeek,
  addDays,
  format,
  parseISO,
  isToday as isDateToday,
  getDaysInMonth,
  startOfMonth,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  Send,
  Calendar,
  CalendarRange,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Calendar as CalendarPicker } from "@/components/ui/calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import ScheduleGrid from "./_components/schedule-grid.tsx";
import type { CellShift } from "./_components/schedule-grid.tsx";
import type { LeaveNote as LeaveNoteType } from "./_components/schedule-grid.tsx";
import type { UnavailNote as UnavailNoteType } from "./_components/schedule-grid.tsx";
import type { UnassignedShift } from "./_components/unassigned-pool.tsx";
import ShiftDialog from "./_components/shift-dialog.tsx";
import EditLeaveDialog from "./_components/edit-leave-dialog.tsx";
import EditAvailabilityDialog from "./_components/edit-availability-dialog.tsx";
import MonthlyCalendar from "./_components/monthly-calendar.tsx";
import WeeklyCalendar from "./_components/weekly-calendar.tsx";
import PatternsTab from "./_components/patterns-tab.tsx";
import VehicleAllocationsTab from "./_components/vehicle-allocations-tab.tsx";
import ShiftSwapsSection from "./_components/shift-swaps-section.tsx";
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

/** Staff view with Week/Month/Swaps toggle */
function StaffScheduleView() {
  const [view, setView] = useState<"week" | "month" | "swaps">("month");

  // Get swap count for badge (direct swaps + board activity + cover)
  const swapData = useQuery(api.shiftSwaps.getMySwapRequests);
  const boardCounts = useQuery(api.swapBoard.getBoardCounts);
  const coverCounts = useQuery(api.coverRequests.getCoverCounts);
  const pendingIncomingCount =
    (swapData?.received.filter((r) => r.status === "pending").length ?? 0) +
    (boardCounts?.boardCount ?? 0) +
    (boardCounts?.pendingOfferCount ?? 0) +
    (coverCounts?.openCount ?? 0);

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
          <Button
            variant={view === "swaps" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("swaps")}
            className="gap-1.5 relative"
          >
            <ArrowLeftRight className="size-4" />
            Cover & Swaps
            {pendingIncomingCount > 0 && (
              <Badge variant="default" className="absolute -top-1.5 -right-1.5 size-4 p-0 flex items-center justify-center text-[9px]">
                {pendingIncomingCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* View content */}
      {view === "week" && <WeeklyCalendar />}
      {view === "month" && <MonthlyCalendar />}
      {view === "swaps" && <ShiftSwapsSection />}
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
  positions?: string[];
};

type ViewRange = "1" | "3" | "7" | "14" | "month";

const VIEW_RANGE_LABELS: Record<ViewRange, string> = {
  "1": "1 Day",
  "3": "3 Days",
  "7": "1 Week",
  "14": "2 Weeks",
  month: "1 Month",
};

/** Admin-only weekly schedule with unassigned pool and drag-and-drop */
function AdminScheduleView({ staff }: { staff: StaffMember[] }) {
  const [viewRange, setViewRange] = useState<ViewRange>("7");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Compute rangeStart: for week views, snap to Monday; for month, snap to 1st
  const rangeStart = useMemo(() => {
    if (viewRange === "7" || viewRange === "14") {
      return startOfWeek(selectedDate, { weekStartsOn: 1 });
    }
    if (viewRange === "month") {
      return startOfMonth(selectedDate);
    }
    return selectedDate;
  }, [selectedDate, viewRange]);

  // Compute how many days to show
  const dayCount = useMemo(() => {
    if (viewRange === "month") return getDaysInMonth(selectedDate);
    return Number(viewRange);
  }, [viewRange, selectedDate]);

  // Build the days array
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => addDays(rangeStart, i)),
    [rangeStart, dayCount]
  );

  const rangeEnd = addDays(rangeStart, dayCount);

  // Query job titles for role colour map
  const positionOptions = useQuery(api.positions.list);
  const roleColorMap = useMemo(() => buildRoleColorMap(positionOptions), [positionOptions]);

  // Auto-apply active patterns when the viewed week changes
  const applyToWeek = useMutation(api.shiftPatterns.applyToWeek);
  const appliedWeeksRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only auto-apply for week-aligned views
    if (viewRange !== "7" && viewRange !== "14") return;
    const weekKey = rangeStart.toISOString();
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
  }, [rangeStart, applyToWeek, viewRange]);

  const shifts = useQuery(api.shifts.getShiftsByDateRange, {
    startDate: rangeStart.toISOString(),
    endDate: rangeEnd.toISOString(),
  });

  const unassigned = useQuery(api.shifts.getUnassignedByDateRange, {
    startDate: rangeStart.toISOString(),
    endDate: rangeEnd.toISOString(),
  });

  const allAvailability = useQuery(api.availability.getAllByDateRange, {
    startDate: format(rangeStart, "yyyy-MM-dd"),
    endDate: format(rangeEnd, "yyyy-MM-dd"),
  });

  // Fetch vehicle allocations for the same range
  const vehicleAllocations = useQuery(api.vehicleAllocations.getByDateRange, {
    startDate: format(rangeStart, "yyyy-MM-dd"),
    endDate: format(addDays(rangeEnd, -1), "yyyy-MM-dd"),
  });

  // Fetch shift declines for the range
  const declines = useQuery(api.shifts.getDeclinesByDateRange, {
    startDate: format(rangeStart, "yyyy-MM-dd"),
    endDate: format(rangeEnd, "yyyy-MM-dd"),
  });

  // Fetch approved leave for the range
  const approvedLeave = useQuery(api.leaveRequests.getApprovedByDateRange, {
    startDate: format(rangeStart, "yyyy-MM-dd"),
    endDate: format(addDays(rangeEnd, -1), "yyyy-MM-dd"),
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

  // Edit availability dialog state
  const [editAvailOpen, setEditAvailOpen] = useState(false);
  const [editAvailData, setEditAvailData] = useState<UnavailNoteType | null>(null);

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

  // Compute rest period warnings: flag shifts with < 11h gap from the previous shift for the same user
  const MIN_REST_HOURS = 11;
  const restWarnings = useMemo(() => {
    const warnings = new Map<string, string>();
    if (!shifts) return warnings;

    // Group all membership entries by userId
    const userShifts = new Map<string, Array<{ membershipId: string; startTime: string; endTime: string }>>();
    for (const shift of shifts) {
      for (const member of shift.members) {
        const list = userShifts.get(member.userId) ?? [];
        list.push({
          membershipId: member.membershipId,
          startTime: shift.startTime,
          endTime: shift.endTime,
        });
        userShifts.set(member.userId, list);
      }
    }

    // For each user, sort shifts by start time and check rest between consecutive shifts
    for (const [, entries] of userShifts) {
      if (entries.length < 2) continue;
      entries.sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 1; i < entries.length; i++) {
        const prevEnd = new Date(entries[i - 1].endTime).getTime();
        const currStart = new Date(entries[i].startTime).getTime();
        const restHours = (currStart - prevEnd) / (1000 * 60 * 60);
        if (restHours >= 0 && restHours < MIN_REST_HOURS) {
          const restLabel = restHours.toFixed(1);
          warnings.set(entries[i].membershipId, `Only ${restLabel}h rest`);
        }
      }
    }
    return warnings;
  }, [shifts]);

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
    availabilityId: string;
    notes: string;
    allDay: boolean;
    startTime?: string;
    endTime?: string;
    status: "available" | "unavailable";
    date: string;
    userName?: string;
  };

  // Helper to look up staff name by userId
  const staffNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of staff) {
      map.set(s._id, s.name ?? "Unknown");
    }
    return map;
  }, [staff]);

  const unavailabilityNotes = useMemo(() => {
    const map = new Map<string, UnavailNote[]>();
    if (!allAvailability) return map;
    for (const entry of allAvailability) {
      if (entry.status !== "unavailable") continue;
      const key = `${entry.userId}__${entry.date}`;
      const existing = map.get(key) ?? [];
      existing.push({
        availabilityId: entry._id,
        notes: entry.notes ?? "",
        allDay: entry.allDay ?? true,
        startTime: entry.startTime,
        endTime: entry.endTime,
        status: "unavailable",
        date: entry.date,
        userName: staffNameMap.get(entry.userId),
      });
      map.set(key, existing);
    }
    return map;
  }, [allAvailability, staffNameMap]);

  // Build available notes map: "userId__date" → available entries
  const availableNotes = useMemo(() => {
    const map = new Map<string, UnavailNote[]>();
    if (!allAvailability) return map;
    for (const entry of allAvailability) {
      if (entry.status !== "available") continue;
      const key = `${entry.userId}__${entry.date}`;
      const existing = map.get(key) ?? [];
      existing.push({
        availabilityId: entry._id,
        notes: entry.notes ?? "",
        allDay: entry.allDay ?? true,
        startTime: entry.startTime,
        endTime: entry.endTime,
        status: "available",
        date: entry.date,
        userName: staffNameMap.get(entry.userId),
      });
      map.set(key, existing);
    }
    return map;
  }, [allAvailability, staffNameMap]);

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
  type LeaveNote = { leaveRequestId: string; leaveType: string; startDate: string; endDate: string; reason?: string; userName?: string; status?: string };
  const leaveData = useMemo(() => {
    const map = new Map<string, LeaveNote[]>();
    if (!approvedLeave) return map;
    for (const lr of approvedLeave) {
      // Walk each day in the leave range that overlaps with the displayed range
      const rangeStartStr = format(rangeStart, "yyyy-MM-dd");
      const rangeEndStr = format(addDays(rangeEnd, -1), "yyyy-MM-dd");
      const effectiveStart = lr.startDate > rangeStartStr ? lr.startDate : rangeStartStr;
      const effectiveEnd = lr.endDate < rangeEndStr ? lr.endDate : rangeEndStr;

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
          status: lr.status,
        });
        map.set(key, existing);
        cursor = addDays(cursor, 1);
      }
    }
    return map;
  }, [approvedLeave, rangeStart, rangeEnd]);

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

  function handleUnassignedCellClick(dateStr: string) {
    setDialogMode("create");
    setDialogDate(dateStr);
    setDialogUserId(undefined);
    setDialogShift(undefined);
    setDialogOpen(true);
  }

  function handleLeaveClick(leave: LeaveNoteType) {
    setEditLeaveData(leave);
    setEditLeaveOpen(true);
  }

  function handleAvailabilityClick(entry: UnavailNoteType) {
    setEditAvailData(entry);
    setEditAvailOpen(true);
  }

  async function handlePublish(publish: boolean) {
    setIsPublishing(true);
    try {
      const count = await setPublished({
        startDate: rangeStart.toISOString(),
        endDate: rangeEnd.toISOString(),
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

  const showTodayButton = !isDateToday(selectedDate);

  // Format the date range label
  const rangeLabel = useMemo(() => {
    if (viewRange === "1") return format(rangeStart, "EEEE, MMM d, yyyy");
    const lastDay = addDays(rangeStart, dayCount - 1);
    if (viewRange === "month") return format(rangeStart, "MMMM yyyy");
    return `${format(rangeStart, "MMM d")} – ${format(lastDay, "MMM d, yyyy")}`;
  }, [rangeStart, dayCount, viewRange]);

  // Navigation step function
  function stepRange(direction: 1 | -1) {
    setSelectedDate((d) => addDays(d, direction * dayCount));
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

  return (
    <div className="space-y-1 -mx-2 md:-mx-3 lg:-mx-4">
      {/* Actions row */}
      <div className="flex items-center justify-between gap-2 px-2 md:px-3 lg:px-4 flex-wrap">
        {/* Date navigator */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => stepRange(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>

          {/* Date picker popover */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 min-w-[180px] justify-center font-heading font-semibold">
                <CalendarDays className="size-4" />
                {rangeLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    setSelectedDate(date);
                    setCalendarOpen(false);
                  }
                }}
                weekStartsOn={1}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => stepRange(1)}
          >
            <ChevronRight className="size-4" />
          </Button>

          {showTodayButton && (
            <Button
              variant="secondary"
              size="sm"
              className="ml-1"
              onClick={() => setSelectedDate(new Date())}
            >
              Today
            </Button>
          )}

          {/* View range selector */}
          <Select value={viewRange} onValueChange={(v) => setViewRange(v as ViewRange)}>
            <SelectTrigger className="w-[110px] h-8 text-xs ml-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(VIEW_RANGE_LABELS) as ViewRange[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {VIEW_RANGE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons + tab switcher */}
        <div className="flex items-center gap-2">
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
        days={days}
        staff={staff}
        gridData={gridData}
        isAdmin={true}
        unassignedShifts={unassigned}
        availabilityData={availabilityData}
        unavailabilityNotes={unavailabilityNotes}
        availableNotes={availableNotes}
        declineData={declineData}
        leaveData={leaveData}
        roleColorMap={roleColorMap}
        restWarnings={restWarnings}
        onCellClick={handleCellClick}
        onShiftClick={handleShiftClick}
        onUnassignedShiftClick={handleUnassignedShiftClick}
        onUnassignedCellClick={handleUnassignedCellClick}
        onLeaveClick={handleLeaveClick}
        onAvailabilityClick={handleAvailabilityClick}
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
          initialStatus={editLeaveData.status}
        />
      )}

      {/* Edit availability dialog */}
      {editAvailData && (
        <EditAvailabilityDialog
          key={editAvailData.availabilityId}
          open={editAvailOpen}
          onOpenChange={(open) => {
            setEditAvailOpen(open);
            if (!open) setEditAvailData(null);
          }}
          availabilityId={editAvailData.availabilityId as Id<"availability">}
          userName={editAvailData.userName ?? "Team member"}
          date={editAvailData.date}
          initialStatus={editAvailData.status}
          initialAllDay={editAvailData.allDay}
          initialStartTime={editAvailData.startTime}
          initialEndTime={editAvailData.endTime}
          initialNotes={editAvailData.notes || undefined}
        />
      )}
    </div>
  );
}
