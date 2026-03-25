import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import { Truck, Send, UserMinus } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { roleColorStyles } from "../_lib/role-colors.ts";
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
  callSign?: string;
  position?: string;
  allocatedVehicle?: string;
  roleColor?: string; // hex colour from position
  sourceDate: string;
  isAdmin: boolean;
  published: boolean;
  onClick: () => void;
  onUnassign?: () => void;
};

export default function ShiftBlock({
  membershipId,
  shiftId,
  startTime,
  endTime,
  vehicle,
  callSign,
  position,
  allocatedVehicle,
  roleColor,
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
        callSign,
        position,
        published,
      },
      disabled: !isAdmin,
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  // Use position colour if available, otherwise fall back to default
  const colorHex = roleColor ?? "#64748b";
  const colorStyle = roleColorStyles(colorHex);

  const blockClassName = cn(
    "group/block relative rounded-md border-l-3 px-1.5 py-1 text-[11px] select-none transition-all",
    isDragging && "opacity-30 scale-95",
    isAdmin && "cursor-grab active:cursor-grabbing",
    !isAdmin && "cursor-pointer",
    !published && isAdmin && "border-dashed"
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDragging) onClick();
  };

  const displayVehicle = allocatedVehicle ?? vehicle;

  const blockContent = (
    <>
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
        <span className="truncate">
          {callSign ? `${callSign} · ${allocatedVehicle ?? vehicle}` : displayVehicle}{position ? ` · ${position}` : ""}
        </span>
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
            style={{ ...style, ...colorStyle }}
            {...attributes}
            {...listeners}
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
      style={{ ...style, ...colorStyle }}
      {...attributes}
      {...listeners}
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
  callSign,
  roleColor,
}: {
  startTime: string;
  endTime: string;
  vehicle: string;
  callSign?: string;
  roleColor?: string;
}) {
  const colorHex = roleColor ?? "#64748b";
  const colorStyle = roleColorStyles(colorHex);

  return (
    <div
      className="rounded-md border-l-3 px-2 py-1.5 text-[11px] shadow-xl ring-2 ring-primary/30"
      style={colorStyle}
    >
      <div className="font-semibold truncate leading-tight">
        {format(parseISO(startTime), "HH:mm")} –{" "}
        {format(parseISO(endTime), "HH:mm")}
      </div>
      <div className="flex items-center gap-1 text-[10px] opacity-75 truncate mt-0.5">
        <Truck className="size-2.5 shrink-0" />
        <span className="truncate">{callSign || vehicle}</span>
      </div>
    </div>
  );
}
