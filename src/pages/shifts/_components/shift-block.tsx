import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import { Truck, Send, UserMinus, Eye, EyeOff, CheckCircle2, XCircle, CircleDashed } from "lucide-react";
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
  responseStatus?: "pending" | "accepted" | "declined";
  declineReason?: string;
  onClick: () => void;
  onUnassign?: () => void;
  onTogglePublish?: () => void;
  onAdminAccept?: () => void;
  hasVehicleConflict?: boolean;
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
  responseStatus,
  declineReason,
  onClick,
  onUnassign,
  onTogglePublish,
  onAdminAccept,
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
  const baseColorStyle = roleColorStyles(colorHex);

  // Unpublished blocks get diagonal stripe fill; published get solid fill
  const colorStyle = !published && isAdmin
    ? {
        ...baseColorStyle,
        backgroundImage: `repeating-linear-gradient(
          -45deg,
          transparent,
          transparent 4px,
          ${colorHex}25 4px,
          ${colorHex}25 8px
        )`,
        backgroundColor: `${colorHex}12`,
      }
    : baseColorStyle;

  const blockClassName = cn(
    "group/block relative rounded-md border-l-3 px-1.5 py-1 text-[11px] select-none transition-all overflow-hidden",
    isDragging && "opacity-30 scale-95",
    isAdmin && "cursor-grab active:cursor-grabbing",
    !isAdmin && "cursor-pointer",
    // Published: subtle ring for emphasis
    published && isAdmin && "ring-1 ring-inset ring-current/10",
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDragging) onClick();
  };

  const displayVehicle = allocatedVehicle ?? vehicle;

  // Response status icon for admin view on published shifts
  const responseIcon =
    published && isAdmin && responseStatus
      ? responseStatus === "accepted"
        ? <CheckCircle2 className="size-2.5 shrink-0 text-emerald-500" />
        : responseStatus === "declined"
          ? <XCircle className="size-2.5 shrink-0 text-rose-500" />
          : <CircleDashed className="size-2.5 shrink-0 text-amber-500" />
      : null;

  const blockContent = (
    <>
      {/* Status badge — top-right corner (admin only) */}
      {isAdmin && (
        <div className="absolute top-0.5 right-0.5 z-[1]">
          {published ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-1 py-px text-[8px] font-bold uppercase tracking-wider">
              <Send className="size-2" />
              Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/25 text-amber-800 dark:text-amber-300 px-1 py-px text-[8px] font-bold uppercase tracking-wider">
              Draft
            </span>
          )}
        </div>
      )}
      <div className="relative z-[1] font-semibold truncate leading-tight flex items-center gap-1 pr-8">
        <span>
          {format(parseISO(startTime), "HH:mm")} –{" "}
          {format(parseISO(endTime), "HH:mm")}
        </span>
        {responseIcon}
      </div>
      <div className="relative z-[1] flex items-center gap-1 text-[10px] opacity-75 truncate mt-0.5">
        <Truck className="size-2.5 shrink-0" />
        <span className="truncate">
          {callSign ? `${callSign} · ${allocatedVehicle ?? vehicle}` : displayVehicle}{position ? ` · ${position}` : ""}
        </span>
      </div>
      {published && isAdmin && responseStatus === "declined" && declineReason && (
        <div className="relative z-[1] text-[9px] text-rose-500 truncate mt-0.5 italic" title={declineReason}>
          {declineReason}
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
          {published && responseStatus !== "accepted" && onAdminAccept && (
            <ContextMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onAdminAccept();
              }}
            >
              <CheckCircle2 className="size-3.5" />
              Accept for member
            </ContextMenuItem>
          )}
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onTogglePublish?.();
            }}
          >
            {published ? (
              <>
                <EyeOff className="size-3.5" />
                Unpublish shift
              </>
            ) : (
              <>
                <Eye className="size-3.5" />
                Publish shift
              </>
            )}
          </ContextMenuItem>
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
