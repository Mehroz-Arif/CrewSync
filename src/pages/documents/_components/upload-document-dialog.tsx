import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { Upload, FileUp } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { formatFileSize } from "../_lib/file-utils.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: Id<"folders">;
};

export default function UploadDocumentDialog({ open, onOpenChange, folderId }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const uploadDocument = useMutation(api.documents.uploadDocument);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setFiles(Array.from(newFiles));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;
    setLoading(true);

    try {
      for (const file of files) {
        const url = await generateUploadUrl();
        const result = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };

        await uploadDocument({
          name: file.name,
          folderId,
          storageId,
          fileType: file.type,
          fileSize: file.size,
          description: description.trim() || undefined,
        });
      }

      toast.success(
        files.length === 1
          ? "Document uploaded"
          : `${files.length} documents uploaded`,
      );
      setFiles([]);
      setDescription("");
      onOpenChange(false);
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setDescription("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drop zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors",
              dragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
            )}
          >
            <Upload className={cn("size-8 mb-3", dragActive ? "text-primary" : "text-muted-foreground")} />
            <p className="text-sm font-medium">
              {dragActive ? "Drop files here" : "Click or drag files to upload"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, images, spreadsheets, and more
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* Selected files */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                >
                  <FileUp className="size-4 text-primary shrink-0" />
                  <span className="truncate flex-1">{file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="doc-desc">Description (optional)</Label>
            <Input
              id="doc-desc"
              placeholder="e.g. Updated safety guidelines for Q1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={files.length === 0 || loading}>
              {loading && <Spinner className="mr-2" />}
              Upload {files.length > 0 && `(${files.length})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
