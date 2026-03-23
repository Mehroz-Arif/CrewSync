import { useDraggable } from "@dnd-kit/core";
import { format, parseISO } from "date-fns";
import { Clock, Truck, GripVertical, Package } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export type UnassignedShift = {
  _id: Id<"shifts">;
  startTime: string;
  endTime: string;
  vehicle: string;
  notes?: string;
};

type UnassignedPoolProps = {
  shifts: UnassignedShift[];
};

export default function UnassignedPool({ shifts }: UnassignedPoolProps) {
  if (shifts.length === 0) return null;

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <div className="px-4 py-3 bg-amber-500/10 border-b flex items-center gap-2">
        <Package className="size-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-heading font-semibold">
          Unassigned Shifts
        </span>
        <span className="ml-auto text-xs text-muted-foreground bg-amber-500/15 px-2 py-0.5 rounded-full font-medium">
          {shifts.length}
        </span>
      </div>
      <div className="p-3 flex flex-wrap gap-2">
        {shifts.map((shift) => (
          <DraggableUnassignedShift key={shift._id} shift={shift} />
        ))}
      </div>
    </div>
  );
}

function DraggableUnassignedShift({ shift }: { shift: UnassignedShift }) {
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
        "group flex items-center gap-2 rounded-lg border bg-amber-500/8 border-amber-500/25 px-3 py-2 text-xs select-none cursor-grab active:cursor-grabbing transition-all",
        isDragging && "opacity-30 scale-95"
      )}
    >
      <GripVertical className="size-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
      <div className="min-w-0">
        <div className="font-semibold flex items-center gap-1">
          <Clock className="size-3 shrink-0" />
          {format(parseISO(shift.startTime), "MMM d")} /{" "}
          {format(parseISO(shift.startTime), "HH:mm")} – {format(parseISO(shift.endTime), "HH:mm")}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
          <Truck className="size-3 shrink-0" />
          <span className="truncate">{shift.vehicle}</span>
        </div>
      </div>
    </div>
  );
}

/** Overlay shown while dragging an unassigned shift */
export function UnassignedShiftOverlay({ shift }: { shift: UnassignedShift }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-amber-500/15 border-amber-500/40 px-3 py-2 text-xs shadow-xl ring-2 ring-amber-500/30">
      <div className="min-w-0">
        <div className="font-semibold flex items-center gap-1">
          <Clock className="size-3 shrink-0" />
          {format(parseISO(shift.startTime), "MMM d")} /{" "}
          {format(parseISO(shift.startTime), "HH:mm")} – {format(parseISO(shift.endTime), "HH:mm")}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
          <Truck className="size-3 shrink-0" />
          <span className="truncate">{shift.vehicle}</span>
        </div>
      </div>
    </div>
  );
}
