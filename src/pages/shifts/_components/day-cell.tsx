import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils.ts";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

type DayCellProps = {
  cellId: string;
  userId: string;
  dateStr: string;
  isAdmin: boolean;
  isToday: boolean;
  hasShifts: boolean;
  onCellClick: () => void;
  children: ReactNode;
};

export default function DayCell({
  cellId,
  userId,
  dateStr,
  isAdmin,
  isToday,
  hasShifts,
  onCellClick,
  children,
}: DayCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: { type: "cell", userId, date: dateStr },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={isAdmin ? onCellClick : undefined}
      className={cn(
        "min-h-[72px] p-1 border-b border-r relative group/cell transition-colors",
        isOver && isAdmin && "bg-primary/10 ring-1 ring-inset ring-primary/25",
        isToday && !isOver && "bg-primary/[0.03]",
        isAdmin && !hasShifts && "cursor-pointer hover:bg-muted/40"
      )}
    >
      <div className="space-y-1">{children}</div>

      {/* Add hint for empty cells */}
      {isAdmin && !hasShifts && !isOver && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none">
          <Plus className="size-4 text-muted-foreground/50" />
        </div>
      )}
    </div>
  );
}
