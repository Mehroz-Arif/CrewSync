import { Fragment, useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  format,
  isToday,
  differenceInCalendarDays,
  parseISO,
  differenceInMinutes,
} from "date-fns";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import DayCell from "./day-cell.tsx";
import ShiftBlock from "./shift-block.tsx";
import { ShiftBlockOverlay } from "./shift-block.tsx";
import type { UnassignedShift } from "./unassigned-pool.tsx";
import { UnassignedShiftOverlay, DraggableUnassignedGroup, groupUnassignedShifts } from "./unassigned-pool.tsx";
import { Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AddAbsenceDialog from "./add-absence-dialog.tsx";

const LEAVE_LABELS: Record<string, string> = {
  annual: "Annual Leave",
  sick: "Sick Leave",
  compassionate: "Compassionate",
  training: "Training",
  unpaid: "Unpaid Leave",
  other: "Leave",
};

type StaffMember = {
  _id: Id<"users">;
  name?: string;
  role?: string;
  department?: string;
};

export type CellShift = {
  shiftId: Id<"shifts">;
  membershipId: Id<"shiftMembers">;
  startTime: string;
  endTime: string;
  vehicle: string;
  callSign?: string;
  position?: string;
  notes?: string;
  published: boolean;
  allocatedVehicle?: string;
  responseStatus?: "pending" | "accepted" | "declined";
  declineReason?: string;
};

export type DeclineNote = {
  reason: string;
  shiftStartTime: string;
  shiftEndTime: string;
  userName: string;
};

export type UnavailNote = {
  availabilityId: string;
  notes: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  status: "available" | "unavailable";
  date: string;
  userName?: string;
};

export type LeaveNote = {
  leaveRequestId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
  userName?: string;
};

type ScheduleGridProps = {
  days: Date[];
  staff: StaffMember[];
  gridData: Map<string, CellShift[]>;
  isAdmin: boolean;
  unassignedShifts: UnassignedShift[];
  availabilityData: Map<string, "available" | "unavailable">;
  unavailabilityNotes?: Map<string, UnavailNote[]>;
  availableNotes?: Map<string, UnavailNote[]>;
  declineData?: Map<string, DeclineNote[]>;
  leaveData?: Map<string, LeaveNote[]>;
  roleColorMap: Record<string, string>; // position label → hex colour
  onCellClick: (userId: Id<"users">, date: Date) => void;
  onShiftClick: (shift: CellShift) => void;
  onUnassignedShiftClick?: (shift: UnassignedShift) => void;
  onUnassignedCellClick?: (date: string) => void;
  onLeaveClick?: (leave: LeaveNote) => void;
  onAvailabilityClick?: (entry: UnavailNote) => void;
};

type ActiveDrag =
  | { type: "shift"; startTime: string; endTime: string; vehicle: string; callSign?: string; position?: string; sourceDate: string; published: boolean }
  | { type: "unassigned"; shift: UnassignedShift };

/** Droppable cell for the unassigned row */
function UnassignedDropCell({
  dateStr,
  isCurrentDay,
  isShiftDragging,
  maxHeight,
  onClick,
  children,
}: {
  dateStr: string;
  isCurrentDay: boolean;
  isShiftDragging: boolean;
  maxHeight?: number;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `unassigned-drop-${dateStr}`,
    data: { type: "unassigned-cell", date: dateStr },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "p-0.5 border-r bg-amber-500/[0.02] transition-colors min-h-[40px]",
        onClick && "cursor-pointer hover:bg-amber-500/[0.06]",
        isCurrentDay && "bg-amber-500/[0.05]",
        isShiftDragging && !isOver && "bg-amber-500/[0.06] ring-1 ring-inset ring-dashed ring-amber-500/20",
        isOver && "bg-amber-500/15 ring-2 ring-inset ring-amber-500/40"
      )}
      style={undefined}
      onClick={onClick}
    >
      <div className="space-y-1">
        {children}
        {isShiftDragging && !isOver && (
          <div className="flex items-center justify-center py-2 text-[10px] text-amber-600/60 dark:text-amber-400/60">
            Drop here
          </div>
        )}
      </div>

    </div>
  );
}

export default function ScheduleGrid({
  days,
  staff,
  gridData,
  isAdmin,
  unassignedShifts,
  availabilityData,
  unavailabilityNotes,
  availableNotes,
  declineData,
  leaveData,
  roleColorMap,
  onCellClick,
  onShiftClick,
  onUnassignedShiftClick,
  onUnassignedCellClick,
  onLeaveClick,
  onAvailabilityClick,
}: ScheduleGridProps) {
  const moveAssignment = useMutation(api.shifts.moveShiftAssignment);
  const assignToShift = useMutation(api.shifts.assignToShift);
  const unassignFromShift = useMutation(api.shifts.unassignFromShift);
  const setShiftPublished = useMutation(api.shifts.setShiftPublished);
  const adminAcceptShift = useMutation(api.shifts.adminAcceptShift);
  const navigate = useNavigate();
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  // Absence dialog state
  const [absenceTarget, setAbsenceTarget] = useState<{
    userId: Id<"users">;
    userName: string;
    date: string;
  } | null>(null);

  // Drag-resize state for unassigned section
  const [unassignedHeight, setUnassignedHeight] = useState(120);
  const resizeDragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleResizeStart = useCallback(
    (clientY: number) => {
      resizeDragRef.current = { startY: clientY, startHeight: unassignedHeight };
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [unassignedHeight]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!resizeDragRef.current) return;
      if ("touches" in e) e.preventDefault(); // prevent scroll during resize
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const delta = clientY - resizeDragRef.current.startY;
      setUnassignedHeight(
        Math.max(40, Math.min(400, resizeDragRef.current.startHeight + delta))
      );
    };
    const onEnd = () => {
      if (resizeDragRef.current) {
        resizeDragRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  const handleTogglePublish = useCallback(
    async (shiftId: Id<"shifts">, currentlyPublished: boolean) => {
      try {
        await setShiftPublished({ shiftId, published: !currentlyPublished });
        toast.success(currentlyPublished ? "Shift unpublished" : "Shift published");
      } catch (error) {
        if (error instanceof ConvexError) {
          toast.error((error.data as { message: string }).message);
        } else {
          toast.error("Failed to update shift");
        }
      }
    },
    [setShiftPublished]
  );

  const handleUnassign = useCallback(
    async (membershipId: Id<"shiftMembers">) => {
      try {
        await unassignFromShift({ membershipId });
        toast.success("Shift moved to unassigned");
      } catch (error) {
        if (error instanceof ConvexError) {
          toast.error((error.data as { message: string }).message);
        } else {
          toast.error("Failed to unassign shift");
        }
      }
    },
    [unassignFromShift]
  );

  const handleAdminAccept = useCallback(
    async (membershipId: Id<"shiftMembers">) => {
      try {
        await adminAcceptShift({ membershipId });
        toast.success("Shift accepted on behalf of team member");
      } catch (error) {
        if (error instanceof ConvexError) {
          toast.error((error.data as { message: string }).message);
        } else {
          toast.error("Failed to accept shift");
        }
      }
    },
    [adminAcceptShift]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const dayCount = days.length;

  // Group unassigned shifts by date and pattern signature
  const unassignedGroupsByDate = useMemo(
    () => groupUnassignedShifts(unassignedShifts),
    [unassignedShifts]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const d = event.active.data.current;
      if (d?.type === "shift") {
        setActiveDrag({
          type: "shift",
          startTime: String(d.startTime),
          endTime: String(d.endTime),
          vehicle: String(d.vehicle),
          callSign: d.callSign ? String(d.callSign) : undefined,
          position: d.position ? String(d.position) : undefined,
          sourceDate: String(d.sourceDate),
          published: Boolean(d.published),
        });
      } else if (d?.type === "unassigned") {
        const shift = unassignedShifts.find(
          (s) => s._id === (d.shiftId as Id<"shifts">)
        );
        if (shift) {
          setActiveDrag({ type: "unassigned", shift });
        }
      }
    },
    [unassignedShifts]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over) return;

      const src = active.data.current;
      const tgt = over.data.current;

      // Handle drop onto unassigned row (drag back to unassign)
      if (tgt?.type === "unassigned-cell" && src?.type === "shift") {
        if (src.published) {
          toast.error("Unpublish the shift first before moving it to unassigned");
          return;
        }
        try {
          await unassignFromShift({
            membershipId: String(src.membershipId) as Id<"shiftMembers">,
          });
          toast.success("Shift moved to unassigned");
        } catch (error) {
          if (error instanceof ConvexError) {
            toast.error((error.data as { message: string }).message);
          } else {
            toast.error("Failed to unassign shift");
          }
        }
        return;
      }

      if (tgt?.type !== "cell") return;

      // Handle unassigned shift drop onto staff cell
      if (src?.type === "unassigned") {
        try {
          await assignToShift({
            shiftId: src.shiftId as Id<"shifts">,
            userId: String(tgt.userId) as Id<"users">,
          });
          toast.success("Shift assigned");
        } catch (error) {
          if (error instanceof ConvexError) {
            toast.error((error.data as { message: string }).message);
          } else {
            toast.error("Failed to assign shift");
          }
        }
        return;
      }

      // Handle existing shift move between staff cells
      if (src?.type !== "shift") return;

      const dayOffset = differenceInCalendarDays(
        parseISO(String(tgt.date)),
        parseISO(String(src.sourceDate))
      );

      try {
        await moveAssignment({
          membershipId: String(src.membershipId) as Id<"shiftMembers">,
          targetUserId: String(tgt.userId) as Id<"users">,
          dayOffset,
        });
      } catch (error) {
        if (error instanceof ConvexError) {
          toast.error((error.data as { message: string }).message);
        } else {
          toast.error("Failed to move shift");
        }
      }
    },
    [moveAssignment, assignToShift, unassignFromShift]
  );

  // Calculate total scheduled hours per staff member for the visible range
  const staffHoursMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const [cellId, cellShifts] of gridData.entries()) {
      const userId = cellId.split("__")[0];
      let total = map.get(userId) ?? 0;
      for (const shift of cellShifts) {
        const mins = differenceInMinutes(parseISO(shift.endTime), parseISO(shift.startTime));
        total += mins;
      }
      map.set(userId, total);
    }
    return map;
  }, [gridData]);

  const hasUnassigned = unassignedShifts.length > 0;

  // True when an unpublished assigned shift is being dragged (can be dropped to unassign)
  const isDraggingUnpublishedShift =
    activeDrag?.type === "shift" && !activeDrag.published;

  // Auto-expand when dragging so the drop zone is visible
  const effectiveUnassignedHeight = isDraggingUnpublishedShift
    ? Math.max(unassignedHeight, 80)
    : unassignedHeight;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="overflow-auto max-h-[calc(100vh-100px)]">
          <div className="min-w-[900px]">
            {/* Sticky pinned section: header + unassigned + resize handle */}
            <div className="sticky top-0 z-10 bg-card">
              {/* Header row */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `150px repeat(${dayCount}, minmax(${dayCount <= 3 ? "200px" : dayCount <= 7 ? "100px" : "80px"}, 1fr))`,
                }}
              >
                <div className="px-2 py-1.5 border-b border-r bg-card flex items-end">
                  <span className="font-heading font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
                    Crew
                  </span>
                </div>
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "px-1.5 py-1.5 border-b text-center bg-card",
                      isToday(day) && "[background:color-mix(in_oklab,var(--color-primary)_8%,var(--color-card))]"
                    )}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {dayCount <= 7 ? format(day, "EEE") : format(day, "EEE")}
                    </div>
                    <div
                      className={cn(
                        "text-sm font-heading font-bold",
                        isToday(day) && "text-primary"
                      )}
                    >
                      {dayCount > 7 ? format(day, "d MMM") : format(day, "d")}
                    </div>
                  </div>
                ))}
              </div>

              {/* Unassigned shifts row (admin only) */}
              {isAdmin && (
                <>
                  <div className="flex">
                    {/* Fixed unassigned label — does not scroll */}
                    <div
                      className={cn(
                        "w-[150px] shrink-0 px-2 py-1.5 border-r flex items-start gap-2 bg-amber-500/5",
                        isDraggingUnpublishedShift && "bg-amber-500/10"
                      )}
                    >
                      <div className="size-6 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                        <Package className="size-3 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate text-amber-700 dark:text-amber-300">
                          {isDraggingUnpublishedShift ? "Drop to unassign" : "Unassigned"}
                        </div>
                        {hasUnassigned && !isDraggingUnpublishedShift && (
                          <div className="text-[10px] text-muted-foreground">
                            {unassignedShifts.length} shift{unassignedShifts.length !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Scrollable unassigned day cells */}
                    <div
                      className="flex-1 overflow-y-auto min-w-0"
                      style={{ maxHeight: effectiveUnassignedHeight }}
                    >
                      <div
                        className="grid"
                        style={{
                          gridTemplateColumns: `repeat(${dayCount}, minmax(${dayCount <= 3 ? "200px" : dayCount <= 7 ? "100px" : "80px"}, 1fr))`,
                        }}
                      >
                        {days.map((day) => {
                          const dateStr = format(day, "yyyy-MM-dd");
                          const dayGroups = unassignedGroupsByDate.get(dateStr) ?? [];
                          return (
                            <UnassignedDropCell
                              key={`unassigned-${dateStr}`}
                              dateStr={dateStr}
                              isCurrentDay={isToday(day)}
                              isShiftDragging={isDraggingUnpublishedShift}
                              onClick={() => onUnassignedCellClick?.(dateStr)}
                            >
                              {dayGroups.map((group) => (
                                <DraggableUnassignedGroup
                                  key={group.key}
                                  group={group}
                                  roleColor={group.position ? roleColorMap[group.position] : undefined}
                                  onClick={() => onUnassignedShiftClick?.(group.shifts[0])}
                                />
                              ))}
                            </UnassignedDropCell>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {/* Drag resize handle */}
                  <div
                    className="border-b flex items-center justify-center group hover:bg-muted/40 transition-colors cursor-row-resize select-none bg-card"
                    style={{ height: 10 }}
                    onMouseDown={(e) => { e.preventDefault(); handleResizeStart(e.clientY); }}
                    onTouchStart={(e) => { handleResizeStart(e.touches[0].clientY); }}
                  >
                    <div className="w-8 h-0.5 rounded-full bg-muted-foreground/30 group-hover:bg-muted-foreground/60 transition-colors" />
                  </div>
                </>
              )}
            </div>

            {/* Employee rows — scrollable */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: `150px repeat(${dayCount}, minmax(${dayCount <= 3 ? "200px" : dayCount <= 7 ? "100px" : "80px"}, 1fr))`,
              }}
            >
              {staff.map((employee) => {
              const totalMins = staffHoursMap.get(employee._id) ?? 0;
              const totalHours = totalMins / 60;
              return (
              <Fragment key={employee._id}>
                {/* Name cell */}
                <div className="px-2 py-1.5 border-b border-r flex items-center gap-2 bg-muted/20">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/team/${employee._id}`);
                    }}
                    className="flex items-start gap-2 min-w-0 rounded-md hover:bg-muted/60 transition-colors px-1 py-0.5 -mx-1 -my-0.5 cursor-pointer"
                    title={`View ${employee.name ?? "Unknown"}'s profile`}
                  >
                    <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-[10px] shrink-0 mt-0.5">
                      {employee.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate leading-tight hover:underline">
                        {employee.name ?? "Unknown"}
                      </div>
                      {totalHours > 0 && (
                        <div className="text-[10px] text-muted-foreground/70 leading-tight">
                          {totalHours.toFixed(2)} h
                        </div>
                      )}
                    </div>
                  </button>
                </div>

                {/* Day cells */}
                {days.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const cellId = `${employee._id}__${dateStr}`;
                  const cellShifts = gridData.get(cellId) ?? [];
                  const availKey = `${employee._id}__${dateStr}`;
                  const avail = availabilityData.get(availKey);
                  const cellDeclines = declineData?.get(availKey) ?? [];
                  const cellUnavailNotes = isAdmin ? (unavailabilityNotes?.get(availKey) ?? []) : [];
                  const cellAvailNotes = isAdmin ? (availableNotes?.get(availKey) ?? []) : [];
                  const cellLeave = leaveData?.get(availKey) ?? [];
                  return (
                    <DayCell
                      key={cellId}
                      cellId={cellId}
                      userId={employee._id}
                      dateStr={dateStr}
                      isAdmin={isAdmin}
                      isToday={isToday(day)}
                      hasShifts={cellShifts.length > 0}
                      availability={avail}
                      onCellClick={() => onCellClick(employee._id, day)}
                      onAddAbsence={isAdmin ? () => setAbsenceTarget({
                        userId: employee._id,
                        userName: employee.name ?? "Unknown",
                        date: dateStr,
                      }) : undefined}
                      onAvailabilityClick={
                        (cellUnavailNotes.length > 0 || cellAvailNotes.length > 0)
                          ? () => {
                              const entry = cellUnavailNotes[0] ?? cellAvailNotes[0];
                              if (entry) onAvailabilityClick?.(entry);
                            }
                          : undefined
                      }
                    >
                      {cellShifts.map((shift) => (
                        <ShiftBlock
                          key={shift.membershipId}
                          membershipId={shift.membershipId}
                          shiftId={shift.shiftId}
                          startTime={shift.startTime}
                          endTime={shift.endTime}
                          vehicle={shift.vehicle}
                          callSign={shift.callSign}
                          position={shift.position}
                          allocatedVehicle={shift.allocatedVehicle}
                          roleColor={shift.position ? roleColorMap[shift.position] : undefined}
                          sourceDate={dateStr}
                          isAdmin={isAdmin}
                          published={shift.published}
                          responseStatus={shift.responseStatus}
                          declineReason={shift.declineReason}
                          onClick={() => onShiftClick(shift)}
                          onUnassign={() => handleUnassign(shift.membershipId)}
                          onTogglePublish={() => handleTogglePublish(shift.shiftId as Id<"shifts">, shift.published)}
                          onAdminAccept={() => handleAdminAccept(shift.membershipId)}
                        />
                      ))}
                      {/* Leave badges */}
                      {cellLeave.map((l, i) => (
                        <button
                          key={`leave-${i}`}
                          type="button"
                          className="w-full text-left rounded border border-sky-400/40 bg-sky-500/10 px-1.5 py-0.5 text-[9px] text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 hover:border-sky-400/60 transition-colors cursor-pointer"
                          title={`${LEAVE_LABELS[l.leaveType] ?? l.leaveType}${l.reason ? `: ${l.reason}` : ""} — Click to edit`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onLeaveClick?.(l);
                          }}
                        >
                          <span className="font-medium">{LEAVE_LABELS[l.leaveType] ?? l.leaveType}</span>
                          {l.reason && (
                            <span className="opacity-75 truncate"> {l.reason}</span>
                          )}
                        </button>
                      ))}
                      {/* Decline notes */}
                      {cellDeclines.map((d, i) => (
                        <div
                          key={`decline-${i}`}
                          className="rounded border border-rose-400/40 bg-rose-500/10 px-1.5 py-0.5 text-[9px] text-rose-600 dark:text-rose-400"
                          title={`Declined ${format(parseISO(d.shiftStartTime), "HH:mm")}–${format(parseISO(d.shiftEndTime), "HH:mm")}: ${d.reason}`}
                        >
                          <span className="font-medium">Declined</span>{" "}
                          <span className="opacity-75 truncate">{d.reason}</span>
                        </div>
                      ))}
                    </DayCell>
                  );
                })}
              </Fragment>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDrag?.type === "shift" ? (
          <ShiftBlockOverlay
            startTime={activeDrag.startTime}
            endTime={activeDrag.endTime}
            vehicle={activeDrag.vehicle}
            callSign={activeDrag.callSign}
            roleColor={activeDrag.position ? roleColorMap[activeDrag.position] : undefined}
          />
        ) : activeDrag?.type === "unassigned" ? (
          <UnassignedShiftOverlay
            shift={activeDrag.shift}
            roleColor={activeDrag.shift.position ? roleColorMap[activeDrag.shift.position] : undefined}
          />
        ) : null}
      </DragOverlay>

      {/* Add absence dialog */}
      {absenceTarget && (
        <AddAbsenceDialog
          open={!!absenceTarget}
          onOpenChange={(open) => { if (!open) setAbsenceTarget(null); }}
          userId={absenceTarget.userId}
          userName={absenceTarget.userName}
          date={absenceTarget.date}
        />
      )}
    </DndContext>
  );
}
