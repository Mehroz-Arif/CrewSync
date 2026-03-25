import { useDraggable } from "@dnd-kit/core";
import { format, parseISO } from "date-fns";
import { Truck, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export type UnassignedShift = {
  _id: Id<"shifts">;
  startTime: string;
  endTime: string;
  vehicle: string;
  callSign?: string;
  staffRole?: string;
  notes?: string;
};

/** A group of identical unassigned shifts (same time/vehicle/callSign on a date) */
export type UnassignedGroup = {
  key: string;
  shifts: UnassignedShift[];
  startTime: string;
  endTime: string;
  vehicle: string;
  callSign?: string;
};

/** Group unassigned shifts by date → pattern signature */
export function groupUnassignedShifts(shifts: UnassignedShift[]): Map<string, UnassignedGroup[]> {
  const byDate = new Map<string, UnassignedShift[]>();
  for (const shift of shifts) {
    const dateStr = format(parseISO(shift.startTime), "yyyy-MM-dd");
    const existing = byDate.get(dateStr) ?? [];
    existing.push(shift);
    byDate.set(dateStr, existing);
  }

  const result = new Map<string, UnassignedGroup[]>();
  for (const [dateStr, dateShifts] of byDate) {
    const groupMap = new Map<string, UnassignedShift[]>();
    for (const s of dateShifts) {
      const sig = `${s.startTime}|${s.endTime}|${s.vehicle}|${s.callSign ?? ""}`;
      const group = groupMap.get(sig) ?? [];
      group.push(s);
      groupMap.set(sig, group);
    }
    const groups: UnassignedGroup[] = [];
    for (const [sig, groupShifts] of groupMap) {
      const first = groupShifts[0];
      groups.push({
        key: `${dateStr}__${sig}`,
        shifts: groupShifts,
        startTime: first.startTime,
        endTime: first.endTime,
        vehicle: first.vehicle,
        callSign: first.callSign,
      });
    }
    result.set(dateStr, groups);
  }
  return result;
}

export function DraggableUnassignedGroup({
  group,
  onClick,
}: {
  group: UnassignedGroup;
  onClick?: () => void;
}) {
  // Use the first shift in the group as the draggable item
  const first = group.shifts[0];
  const count = group.shifts.length;

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `unassigned-${first._id}`,
      data: {
        type: "unassigned",
        shiftId: first._id,
        startTime: first.startTime,
        endTime: first.endTime,
        vehicle: first.vehicle,
      },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDragging && onClick) onClick();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "group relative rounded-md border-l-3 px-2 py-1.5 text-[11px] select-none cursor-grab active:cursor-grabbing transition-all bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15",
        isDragging && "opacity-30 scale-95"
      )}
    >
      <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
        <GripVertical className="size-3" />
      </div>
      <div className="font-semibold truncate leading-tight flex items-center gap-1">
        <span>
          {format(parseISO(first.startTime), "HH:mm")} – {format(parseISO(first.endTime), "HH:mm")}
        </span>
        {count > 1 && (
          <span className="shrink-0 inline-flex items-center justify-center size-4 rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-700 dark:text-amber-300">
            {count}
          </span>
        )}
      </div>
      {(first.callSign || first.vehicle) && (
        <div className="flex items-center gap-1 text-[10px] opacity-75 truncate mt-0.5">
          <Truck className="size-2.5 shrink-0" />
          <span className="truncate">{first.callSign || first.vehicle}</span>
        </div>
      )}
    </div>
  );
}

/** Overlay shown while dragging an unassigned shift */
export function UnassignedShiftOverlay({ shift }: { shift: UnassignedShift }) {
  return (
    <div className="rounded-md border-l-3 px-2 py-1.5 text-[11px] shadow-xl ring-2 ring-amber-500/30 bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300">
      <div className="font-semibold truncate leading-tight">
        {format(parseISO(shift.startTime), "HH:mm")} – {format(parseISO(shift.endTime), "HH:mm")}
      </div>
      {(shift.callSign || shift.vehicle) && (
        <div className="flex items-center gap-1 text-[10px] opacity-75 truncate mt-0.5">
          <Truck className="size-2.5 shrink-0" />
          <span className="truncate">{shift.callSign || shift.vehicle}</span>
        </div>
      )}
    </div>
  );
}
