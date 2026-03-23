import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id, Doc } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  FolderPlus,
  Upload,
  ChevronRight,
  Home,
  FileText,
  FolderOpen,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import FolderCard from "./_components/folder-card.tsx";
import DocumentCard from "./_components/document-card.tsx";
import CreateFolderDialog from "./_components/create-folder-dialog.tsx";
import UploadDocumentDialog from "./_components/upload-document-dialog.tsx";
import DocumentSearch from "./_components/document-search.tsx";
import { formatFileSize } from "./_lib/file-utils.ts";
import { useStaffPreview } from "@/hooks/use-staff-preview.tsx";

export default function DocumentsPage() {
  const [currentFolderId, setCurrentFolderId] = useState<Id<"folders"> | undefined>();
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<Id<"documents"> | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Doc<"folders"> | null>(null);
  const [renameTarget, setRenameTarget] = useState<Doc<"folders"> | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const currentUser = useQuery(api.users.getCurrentUser);
  const folders = useQuery(api.documents.getFolders, { parentId: currentFolderId });
  const documents = useQuery(api.documents.getDocuments, { folderId: currentFolderId });
  const breadcrumbs = useQuery(api.documents.getFolderPath, { folderId: currentFolderId });
  const stats = useQuery(api.documents.getStats);

  const deleteDocument = useMutation(api.documents.deleteDocument);
  const deleteFolder = useMutation(api.documents.deleteFolder);
  const renameFolder = useMutation(api.documents.renameFolder);

  const { isPreviewingAsStaff } = useStaffPreview();
  const isAdmin = currentUser?.role === "admin" && !isPreviewingAsStaff;
  const isLoading = folders === undefined || documents === undefined;

  const handleDeleteDoc = async () => {
    if (!deleteDocId) return;
    try {
      await deleteDocument({ documentId: deleteDocId });
      toast.success("Document deleted");
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to delete document");
      }
    }
    setDeleteDocId(null);
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    try {
      await deleteFolder({ folderId: deleteFolderTarget._id });
      toast.success("Folder deleted");
    } catch (err) {
      if (err instanceof ConvexError) {
        const { message } = err.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to delete folder");
      }
    }
    setDeleteFolderTarget(null);
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await renameFolder({ folderId: renameTarget._id, name: renameValue.trim() });
      toast.success("Folder renamed");
    } catch {
      toast.error("Failed to rename folder");
    }
    setRenameTarget(null);
    setRenameValue("");
  };

  const isEmpty =
    !isLoading && (folders?.length ?? 0) === 0 && (documents?.length ?? 0) === 0;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="font-heading font-bold text-2xl tracking-tight">
            Documents
          </h1>
          {stats && (
            <p className="text-sm text-muted-foreground mt-1">
              {stats.documentCount} documents in {stats.folderCount} folders
              {stats.totalSize > 0 && ` \u00B7 ${formatFileSize(stats.totalSize)} total`}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowCreateFolder(true)}>
              <FolderPlus className="size-4 mr-2" />
              New Folder
            </Button>
            <Button size="sm" onClick={() => setShowUpload(true)}>
              <Upload className="size-4 mr-2" />
              Upload
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <DocumentSearch
        isAdmin={isAdmin}
        onDelete={(id) => setDeleteDocId(id as Id<"documents">)}
      />

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm overflow-x-auto pb-1">
        <button
          onClick={() => setCurrentFolderId(undefined)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <Home className="size-3.5" />
          <span>All Documents</span>
        </button>
        {breadcrumbs?.map((crumb) => (
          <span key={crumb._id} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <button
              onClick={() => setCurrentFolderId(crumb._id)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={`f-${i}`} className="h-16 rounded-xl" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={`d-${i}`} className="h-18 rounded-xl" />
            ))}
          </div>
        </div>
      ) : isEmpty && !currentFolderId ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>No documents yet</EmptyTitle>
            <EmptyDescription>
              {isAdmin
                ? "Start by creating a folder or uploading your first document."
                : "Your admin hasn't uploaded any documents yet."}
            </EmptyDescription>
          </EmptyHeader>
          {isAdmin && (
            <EmptyContent>
              <Button size="sm" onClick={() => setShowUpload(true)}>
                <Upload className="size-4 mr-2" />
                Upload Document
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-6">
          {/* Folders */}
          {folders && folders.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <FolderOpen className="size-3.5" />
                Folders
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {folders.map((folder) => (
                  <FolderCard
                    key={folder._id}
                    folder={folder}
                    isAdmin={isAdmin}
                    onOpen={setCurrentFolderId}
                    onRename={(f) => {
                      setRenameTarget(f);
                      setRenameValue(f.name);
                    }}
                    onDelete={setDeleteFolderTarget}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Documents */}
          {documents && documents.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <HardDrive className="size-3.5" />
                Files
              </h2>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <DocumentCard
                    key={doc._id}
                    doc={doc}
                    isAdmin={isAdmin}
                    onDelete={(id) => setDeleteDocId(id as Id<"documents">)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty folder state */}
          {isEmpty && currentFolderId && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderOpen />
                </EmptyMedia>
                <EmptyTitle>This folder is empty</EmptyTitle>
                <EmptyDescription>
                  {isAdmin
                    ? "Upload files or create subfolders to organize your documents."
                    : "No documents have been added to this folder yet."}
                </EmptyDescription>
              </EmptyHeader>
              {isAdmin && (
                <EmptyContent>
                  <Button size="sm" onClick={() => setShowUpload(true)}>
                    <Upload className="size-4 mr-2" />
                    Upload Here
                  </Button>
                </EmptyContent>
              )}
            </Empty>
          )}
        </div>
      )}

      {/* Dialogs */}
      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        parentId={currentFolderId}
      />
      <UploadDocumentDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        folderId={currentFolderId}
      />

      {/* Delete document confirmation */}
      <AlertDialog open={deleteDocId !== null} onOpenChange={() => setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the document and its file. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDoc}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete folder confirmation */}
      <AlertDialog open={deleteFolderTarget !== null} onOpenChange={() => setDeleteFolderTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder "{deleteFolderTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the folder and all documents inside it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFolder}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename folder dialog */}
      <AlertDialog open={renameTarget !== null} onOpenChange={() => setRenameTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename folder</AlertDialogTitle>
          </AlertDialogHeader>
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRename} disabled={!renameValue.trim()}>
              Rename
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
