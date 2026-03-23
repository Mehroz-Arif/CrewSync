import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import { GripVertical, Truck, Send, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  ContextMenuItem,
} from "@/components/ui/context-menu.tsx";

type ShiftBlockProps = {
  membershipId: string;
  shiftId: string;
  startTime: string;
  endTime: string;
  vehicle: string;
  sourceDate: string;
  isAdmin: boolean;
  published: boolean;
  onClick: () => void;
  onUnassign?: () => void;
};

/** Color-code based on vehicle type keywords */
function getShiftColor(vehicle: string) {
  const v = vehicle.toLowerCase();
  if (v.includes("engine") || v.includes("pumper"))
    return "bg-primary/15 border-primary/30 text-primary dark:bg-primary/20";
  if (v.includes("ambulance") || v.includes("ems") || v.includes("medic"))
    return "bg-chart-5/15 border-chart-5/30 text-chart-5 dark:bg-chart-5/20";
  if (v.includes("ladder") || v.includes("aerial"))
    return "bg-accent/15 border-accent/30 text-accent dark:bg-accent/20";
  if (v.includes("rescue") || v.includes("hazmat"))
    return "bg-chart-3/15 border-chart-3/30 text-chart-3 dark:bg-chart-3/20";
  return "bg-chart-4/15 border-chart-4/30 text-chart-4 dark:bg-chart-4/20";
}

export default function ShiftBlock({
  membershipId,
  shiftId,
  startTime,
  endTime,
  vehicle,
  sourceDate,
  isAdmin,
  published,
  onClick,
  onUnassign,
}: ShiftBlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: membershipId,
      data: {
        type: "shift",
        membershipId,
        shiftId,
        sourceDate,
        startTime,
        endTime,
        vehicle,
        published,
      },
      disabled: !isAdmin,
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const blockClassName = cn(
    "group/block relative rounded-md border-l-3 px-2 py-1.5 text-[11px] select-none transition-all",
    getShiftColor(vehicle),
    isDragging && "opacity-30 scale-95",
    isAdmin && "cursor-grab active:cursor-grabbing",
    !isAdmin && "cursor-pointer",
    !published && isAdmin && "border-dashed"
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDragging) onClick();
  };

  const blockContent = (
    <>
      {isAdmin && (
        <div
          {...listeners}
          className="absolute -left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/block:opacity-50 transition-opacity"
        >
          <GripVertical className="size-3" />
        </div>
      )}
      <div className="font-semibold truncate leading-tight flex items-center gap-1">
        <span>
          {format(parseISO(startTime), "HH:mm")} –{" "}
          {format(parseISO(endTime), "HH:mm")}
        </span>
        {published && isAdmin && (
          <Send className="size-2.5 shrink-0 opacity-60" />
        )}
      </div>
      <div className="flex items-center gap-1 text-[10px] opacity-75 truncate mt-0.5">
        <Truck className="size-2.5 shrink-0" />
        <span className="truncate">{vehicle}</span>
      </div>
      {!published && isAdmin && (
        <div className="text-[9px] uppercase tracking-wider opacity-50 mt-0.5 font-medium">
          Draft
        </div>
      )}
    </>
  );

  // Wrap in context menu for admin with unassign option
  if (isAdmin && onUnassign) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            className={blockClassName}
            onClick={handleClick}
          >
            {blockContent}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onUnassign();
            }}
            disabled={published}
          >
            <UserMinus className="size-3.5" />
            {published ? "Unpublish to unassign" : "Unassign from shift"}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={blockClassName}
      onClick={handleClick}
    >
      {blockContent}
    </div>
  );
}

/** Visual-only overlay shown while dragging */
export function ShiftBlockOverlay({
  startTime,
  endTime,
  vehicle,
}: {
  startTime: string;
  endTime: string;
  vehicle: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border-l-3 px-2 py-1.5 text-[11px] shadow-xl ring-2 ring-primary/30",
        getShiftColor(vehicle)
      )}
    >
      <div className="font-semibold truncate leading-tight">
        {format(parseISO(startTime), "HH:mm")} –{" "}
        {format(parseISO(endTime), "HH:mm")}
      </div>
      <div className="flex items-center gap-1 text-[10px] opacity-75 truncate mt-0.5">
        <Truck className="size-2.5 shrink-0" />
        <span className="truncate">{vehicle}</span>
      </div>
    </div>
  );
}
