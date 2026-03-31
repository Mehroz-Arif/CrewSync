import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils.ts";
import { Plus, CalendarOff } from "lucide-react";
import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  ContextMenuItem,
} from "@/components/ui/context-menu.tsx";

type DayCellProps = {
  cellId: string;
  userId: string;
  dateStr: string;
  isAdmin: boolean;
  isToday: boolean;
  hasShifts: boolean;
  availability?: "available" | "unavailable";
  isPositionMatch?: boolean;
  onCellClick: () => void;
  onAddAbsence?: () => void;
  onAvailabilityClick?: () => void;
  children: ReactNode;
};

export default function DayCell({
  cellId,
  userId,
  dateStr,
  isAdmin,
  isToday,
  hasShifts,
  availability,
  isPositionMatch,
  onCellClick,
  onAddAbsence,
  onAvailabilityClick,
  children,
}: DayCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: { type: "cell", userId, date: dateStr },
  });

  const cellContent = (
    <div
      ref={setNodeRef}
      onClick={isAdmin ? onCellClick : undefined}
      className={cn(
        "min-h-[56px] p-0.5 border-b border-r relative group/cell transition-colors",
        isOver && isAdmin && "bg-primary/10 ring-1 ring-inset ring-primary/25",
        isToday && !isOver && !isPositionMatch && "bg-primary/[0.03]",
        isAdmin && !hasShifts && "cursor-pointer hover:bg-muted/40",
        // Position match highlight during drag
        isPositionMatch && !isOver && "bg-emerald-500/[0.06]",
        // Availability indicators (subtle background) — only when not position-highlighted
        !isOver && !isPositionMatch && availability === "available" && "bg-emerald-500/[0.06]",
        !isOver && !isPositionMatch && availability === "unavailable" && "bg-rose-500/[0.06]"
      )}
    >
      {/* Availability dot — clickable to edit */}
      {availability && (
        <button
          type="button"
          className="absolute top-0.5 right-0.5 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer z-[2]"
          title={`${availability === "available" ? "Available" : "Unavailable"} — Click to edit`}
          onClick={(e) => {
            e.stopPropagation();
            onAvailabilityClick?.();
          }}
        >
          <div
            className={cn(
              "size-2 rounded-full",
              availability === "available" ? "bg-emerald-500" : "bg-rose-500"
            )}
          />
        </button>
      )}

      <div className="space-y-1">{children}</div>

      {/* Add hint for empty cells */}
      {isAdmin && !hasShifts && !isOver && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none">
          <Plus className="size-4 text-muted-foreground/50" />
        </div>
      )}
    </div>
  );

  if (isAdmin && onAddAbsence) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{cellContent}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onAddAbsence();
            }}
          >
            <CalendarOff className="size-3.5" />
            Add absence
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return cellContent;
}
