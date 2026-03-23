import { useDraggable } from "@dnd-kit/core";
import { format, parseISO } from "date-fns";
import { Clock, Truck, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export type UnassignedShift = {
  _id: Id<"shifts">;
  startTime: string;
  endTime: string;
  vehicle: string;
  notes?: string;
};

export function DraggableUnassignedShift({ shift }: { shift: UnassignedShift }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `unassigned-${shift._id}`,
      data: {
        type: "unassigned",
        shiftId: shift._id,
        startTime: shift.startTime,
        endTime: shift.endTime,
        vehicle: shift.vehicle,
      },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative rounded-md border-l-3 px-2 py-1.5 text-[11px] select-none cursor-grab active:cursor-grabbing transition-all bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 dark:bg-amber-500/15",
        isDragging && "opacity-30 scale-95"
      )}
    >
      <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
        <GripVertical className="size-3" />
      </div>
      <div className="font-semibold truncate leading-tight">
        {format(parseISO(shift.startTime), "HH:mm")} – {format(parseISO(shift.endTime), "HH:mm")}
      </div>
      <div className="flex items-center gap-1 text-[10px] opacity-75 truncate mt-0.5">
        <Truck className="size-2.5 shrink-0" />
        <span className="truncate">{shift.vehicle}</span>
      </div>
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
      <div className="flex items-center gap-1 text-[10px] opacity-75 truncate mt-0.5">
        <Truck className="size-2.5 shrink-0" />
        <span className="truncate">{shift.vehicle}</span>
      </div>
    </div>
  );
}
