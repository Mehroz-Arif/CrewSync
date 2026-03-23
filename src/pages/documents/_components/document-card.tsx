import { Download, MoreVertical, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { getFileConfigFromName, formatFileSize } from "../_lib/file-utils.ts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Button } from "@/components/ui/button.tsx";
import { format } from "date-fns";

type DocumentData = {
  _id: string;
  _creationTime: number;
  name: string;
  fileType: string;
  fileSize: number;
  url: string | null;
  uploaderName: string;
  description?: string;
};

type DocumentCardProps = {
  doc: DocumentData;
  isAdmin: boolean;
  onDelete: (docId: string) => void;
};

export default function DocumentCard({ doc, isAdmin, onDelete }: DocumentCardProps) {
  const config = getFileConfigFromName(doc.name);
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-4 rounded-xl border bg-card p-4 transition-all",
        "hover:shadow-md hover:border-primary/20",
      )}
    >
      <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg", config.bg)}>
        <Icon className={cn("size-6", config.color)} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{doc.name}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{formatFileSize(doc.fileSize)}</span>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span>{doc.uploaderName}</span>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span>{format(new Date(doc._creationTime), "MMM d, yyyy")}</span>
        </div>
        {doc.description && (
          <p className="truncate text-xs text-muted-foreground mt-0.5">{doc.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {doc.url && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100"
            asChild
          >
            <a href={doc.url} target="_blank" rel="noopener noreferrer" download={doc.name}>
              <Download className="size-4" />
            </a>
          </Button>
        )}
        {doc.url && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="opacity-0 group-hover:opacity-100"
            asChild
          >
            <a href={doc.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
            </a>
          </Button>
        )}

        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(doc._id)}
              >
                <Trash2 className="size-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
