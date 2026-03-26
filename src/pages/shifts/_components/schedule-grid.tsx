import { Fragment, useState, useCallback, useMemo } from "react";
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
  addDays,
  differenceInCalendarDays,
  parseISO,
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
import { Package, ChevronDown, ChevronRight } from "lucide-react";

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
  notes: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
};

type ScheduleGridProps = {
  weekStart: Date;
  staff: StaffMember[];
  gridData: Map<string, CellShift[]>;
  isAdmin: boolean;
  unassignedShifts: UnassignedShift[];
  availabilityData: Map<string, "available" | "unavailable">;
  unavailabilityNotes?: Map<string, UnavailNote[]>;
  declineData?: Map<string, DeclineNote[]>;
  roleColorMap: Record<string, string>; // position label → hex colour
  onCellClick: (userId: Id<"users">, date: Date) => void;
  onShiftClick: (shift: CellShift) => void;
  onUnassignedShiftClick?: (shift: UnassignedShift) => void;
};

type ActiveDrag =
  | { type: "shift"; startTime: string; endTime: string; vehicle: string; callSign?: string; position?: string; sourceDate: string; published: boolean }
  | { type: "unassigned"; shift: UnassignedShift };

/** Droppable cell for the unassigned row */
function UnassignedDropCell({
  dateStr,
  isCurrentDay,
  isShiftDragging,
  children,
}: {
  dateStr: string;
  isCurrentDay: boolean;
  isShiftDragging: boolean;
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
        "min-h-[56px] p-0.5 border-b border-r bg-amber-500/[0.02] transition-colors",
        isCurrentDay && "bg-amber-500/[0.05]",
        isShiftDragging && !isOver && "bg-amber-500/[0.06] ring-1 ring-inset ring-dashed ring-amber-500/20",
        isOver && "bg-amber-500/15 ring-2 ring-inset ring-amber-500/40"
      )}
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
  weekStart,
  staff,
  gridData,
  isAdmin,
  unassignedShifts,
  availabilityData,
  unavailabilityNotes,
  declineData,
  roleColorMap,
  onCellClick,
  onShiftClick,
  onUnassignedShiftClick,
}: ScheduleGridProps) {
  const moveAssignment = useMutation(api.shifts.moveShiftAssignment);
  const assignToShift = useMutation(api.shifts.assignToShift);
  const unassignFromShift = useMutation(api.shifts.unassignFromShift);
  const setShiftPublished = useMutation(api.shifts.setShiftPublished);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [unassignedExpanded, setUnassignedExpanded] = useState(true);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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

  const hasUnassigned = unassignedShifts.length > 0;

  // True when an unpublished assigned shift is being dragged (can be dropped to unassign)
  const isDraggingUnpublishedShift =
    activeDrag?.type === "shift" && !activeDrag.published;

  // Auto-expand when dragging so the drop zone is visible
  const showUnassignedCells = unassignedExpanded || isDraggingUnpublishedShift;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[900px]"
            style={{
              gridTemplateColumns: "150px repeat(7, minmax(100px, 1fr))",
            }}
          >
            {/* Header row */}
            <div className="px-2 py-1.5 border-b border-r bg-muted/40 flex items-end">
              <span className="font-heading font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
                Crew
              </span>
            </div>
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "px-1.5 py-1.5 border-b text-center",
                  isToday(day)
                    ? "bg-primary/8"
                    : "bg-muted/40"
                )}
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {format(day, "EEE")}
                </div>
                <div
                  className={cn(
                    "text-sm font-heading font-bold",
                    isToday(day) && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </div>
              </div>
            ))}

            {/* Unassigned shifts row (admin only, always shown) */}
            {isAdmin && (
              <>
                <div
                  className={cn(
                    "px-2 py-1.5 border-b border-r flex items-center gap-2 bg-amber-500/5 transition-colors cursor-pointer select-none hover:bg-amber-500/10",
                    isDraggingUnpublishedShift && "bg-amber-500/10"
                  )}
                  onClick={() => setUnassignedExpanded((prev) => !prev)}
                >
                  <div className="size-5 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                    {showUnassignedCells ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </div>
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
                {showUnassignedCells ? (
                  days.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const dayGroups = unassignedGroupsByDate.get(dateStr) ?? [];
                    return (
                      <UnassignedDropCell
                        key={`unassigned-${dateStr}`}
                        dateStr={dateStr}
                        isCurrentDay={isToday(day)}
                        isShiftDragging={isDraggingUnpublishedShift}
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
                  })
                ) : (
                  /* Collapsed: single merged cell spanning all 7 days */
                  <div
                    className="border-b bg-amber-500/[0.02] col-span-7 flex items-center px-3 py-1 text-[10px] text-muted-foreground cursor-pointer hover:bg-amber-500/[0.05] transition-colors"
                    onClick={() => setUnassignedExpanded(true)}
                  >
                    {hasUnassigned
                      ? `${unassignedShifts.length} unassigned shift${unassignedShifts.length !== 1 ? "s" : ""} — click to expand`
                      : "No unassigned shifts"}
                  </div>
                )}
              </>
            )}

            {/* Employee rows */}
            {staff.map((employee) => (
              <Fragment key={employee._id}>
                {/* Name cell */}
                <div className="px-2 py-1.5 border-b border-r flex items-center gap-2 bg-muted/20">
                  <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-[10px] shrink-0">
                    {employee.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">
                      {employee.name ?? "Unknown"}
                    </div>
                    {employee.department && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {employee.department}
                      </div>
                    )}
                  </div>
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
                        />
                      ))}
                      {/* Unavailability notes (admin only) */}
                      {cellUnavailNotes.map((u, i) => (
                        <div
                          key={`unavail-${i}`}
                          className="rounded border border-rose-400/30 bg-rose-500/8 px-1.5 py-0.5 text-[9px] text-rose-600 dark:text-rose-400"
                          title={
                            u.allDay
                              ? `Unavailable (all day)${u.notes ? `: ${u.notes}` : ""}`
                              : `Unavailable ${u.startTime ?? ""}–${u.endTime ?? ""}${u.notes ? `: ${u.notes}` : ""}`
                          }
                        >
                          <span className="font-medium">
                            {u.allDay ? "Unavailable" : `Unavail ${u.startTime}–${u.endTime}`}
                          </span>
                          {u.notes && (
                            <span className="opacity-75 truncate"> {u.notes}</span>
                          )}
                        </div>
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
            ))}
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
    </DndContext>
  );
}
