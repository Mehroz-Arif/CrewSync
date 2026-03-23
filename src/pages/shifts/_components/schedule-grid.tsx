import { Fragment, useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
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
  notes?: string;
};

type ScheduleGridProps = {
  weekStart: Date;
  staff: StaffMember[];
  gridData: Map<string, CellShift[]>;
  isAdmin: boolean;
  onCellClick: (userId: Id<"users">, date: Date) => void;
  onShiftClick: (shift: CellShift) => void;
};

type ActiveDrag = {
  startTime: string;
  endTime: string;
  vehicle: string;
  sourceDate: string;
};

export default function ScheduleGrid({
  weekStart,
  staff,
  gridData,
  isAdmin,
  onCellClick,
  onShiftClick,
}: ScheduleGridProps) {
  const moveAssignment = useMutation(api.shifts.moveShiftAssignment);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const d = event.active.data.current;
    if (d?.type === "shift") {
      setActiveDrag({
        startTime: String(d.startTime),
        endTime: String(d.endTime),
        vehicle: String(d.vehicle),
        sourceDate: String(d.sourceDate),
      });
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDrag(null);
      const { active, over } = event;
      if (!over) return;

      const src = active.data.current;
      const tgt = over.data.current;
      if (src?.type !== "shift" || tgt?.type !== "cell") return;

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
    [moveAssignment]
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="border rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[860px]"
            style={{
              gridTemplateColumns: "170px repeat(7, minmax(96px, 1fr))",
            }}
          >
            {/* Header row */}
            <div className="px-3 py-2 border-b border-r bg-muted/40 flex items-end">
              <span className="font-heading font-semibold text-[10px] text-muted-foreground uppercase tracking-widest">
                Crew
              </span>
            </div>
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "px-2 py-2 border-b text-center",
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

            {/* Employee rows */}
            {staff.map((employee) => (
              <Fragment key={employee._id}>
                {/* Name cell */}
                <div className="px-3 py-2 border-b border-r flex items-center gap-2.5 bg-muted/20">
                  <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-[10px] shrink-0">
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
                  return (
                    <DayCell
                      key={cellId}
                      cellId={cellId}
                      userId={employee._id}
                      dateStr={dateStr}
                      isAdmin={isAdmin}
                      isToday={isToday(day)}
                      hasShifts={cellShifts.length > 0}
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
                          sourceDate={dateStr}
                          isAdmin={isAdmin}
                          onClick={() => onShiftClick(shift)}
                        />
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
        {activeDrag ? (
          <ShiftBlockOverlay
            startTime={activeDrag.startTime}
            endTime={activeDrag.endTime}
            vehicle={activeDrag.vehicle}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
