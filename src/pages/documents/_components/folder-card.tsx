import { FolderOpen, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Button } from "@/components/ui/button.tsx";
import type { Doc } from "@/convex/_generated/dataModel.d.ts";

type FolderCardProps = {
  folder: Doc<"folders">;
  isAdmin: boolean;
  onOpen: (folderId: Doc<"folders">["_id"]) => void;
  onRename: (folder: Doc<"folders">) => void;
  onDelete: (folder: Doc<"folders">) => void;
};

export default function FolderCard({ folder, isAdmin, onOpen, onRename, onDelete }: FolderCardProps) {
  return (
    <button
      onClick={() => onOpen(folder._id)}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all",
        "hover:shadow-md hover:border-primary/30 hover:bg-primary/[0.02]",
      )}
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <FolderOpen className="size-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{folder.name}</p>
        {folder.description && (
          <p className="truncate text-xs text-muted-foreground mt-0.5">{folder.description}</p>
        )}
      </div>

      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 shrink-0"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onRename(folder)}>
              <Pencil className="size-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(folder)}
            >
              <Trash2 className="size-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </button>
  );
}
