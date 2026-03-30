import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Plus, Search, Users, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Switch } from "@/components/ui/switch.tsx";

type Mode = "select" | "group";

export default function NewConversationDialog({
  onCreated,
}: {
  onCreated: (id: Id<"conversations">) => void;
}) {
  const users = useQuery(api.messaging.listUsers);
  const currentUser = useQuery(api.users.getCurrentUser);
  const startDirect = useMutation(api.messaging.startDirect);
  const createGroup = useMutation(api.messaging.createGroup);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("select");
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [broadcastOnly, setBroadcastOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"users">>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const isAdmin = currentUser?.role === "admin";

  const filteredUsers = (users ?? []).filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const reset = () => {
    setMode("select");
    setSearch("");
    setGroupName("");
    setBroadcastOnly(false);
    setSelectedIds(new Set());
    setIsCreating(false);
  };

  const handleStartDirect = async (userId: Id<"users">) => {
    setIsCreating(true);
    try {
      const convoId = await startDirect({ otherUserId: userId });
      onCreated(convoId);
      setOpen(false);
      reset();
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to start conversation");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Please select at least one member");
      return;
    }
    setIsCreating(true);
    try {
      const convoId = await createGroup({
        name: groupName.trim(),
        memberIds: Array.from(selectedIds),
        broadcastOnly,
      });
      onCreated(convoId);
      setOpen(false);
      reset();
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to create group");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const toggleUser = (id: Id<"users">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost">
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {mode === "select" ? "New Conversation" : "Create Group"}
          </DialogTitle>
        </DialogHeader>

        {mode === "select" && (
          <div className="space-y-3">
            {/* Toggle to group mode */}
            <Button
              variant="secondary"
              size="sm"
              className="w-full gap-2"
              onClick={() => setMode("group")}
            >
              <Users className="size-4" />
              Create a Group Chat
            </Button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {filteredUsers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {users ? "No team members found" : "Loading..."}
                </p>
              )}
              {filteredUsers.map((u) => (
                <button
                  key={u._id}
                  onClick={() => handleStartDirect(u._id)}
                  disabled={isCreating}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors text-left"
                >
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-heading font-bold shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    {u.email && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {u.email}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "group" && (
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode("select")}
            >
              Back to direct messages
            </Button>

            <Input
              placeholder="Group name, e.g. Marketing Team"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />

            {/* Broadcast toggle - only shown to admins */}
            {isAdmin && (
              <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 cursor-pointer">
                <div className="flex items-center gap-2 min-w-0">
                  <Megaphone className="size-4 text-chart-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Broadcast only</p>
                    <p className="text-[11px] text-muted-foreground">
                      Only admins can send messages
                    </p>
                  </div>
                </div>
                <Switch
                  checked={broadcastOnly}
                  onCheckedChange={setBroadcastOnly}
                />
              </label>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Select all / Deselect all */}
            {filteredUsers.length > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline cursor-pointer"
                onClick={() => {
                  const allFilteredIds = filteredUsers.map((u) => u._id);
                  const allSelected = allFilteredIds.every((id) => selectedIds.has(id));
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (allSelected) {
                      for (const id of allFilteredIds) next.delete(id);
                    } else {
                      for (const id of allFilteredIds) next.add(id);
                    }
                    return next;
                  });
                }}
              >
                {filteredUsers.every((u) => selectedIds.has(u._id))
                  ? "Deselect all"
                  : "Select all"}
              </button>
            )}

            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {filteredUsers.map((u) => (
                <label
                  key={u._id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors cursor-pointer"
                >
                  <Checkbox
                    checked={selectedIds.has(u._id)}
                    onCheckedChange={() => toggleUser(u._id)}
                  />
                  <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-heading font-bold shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium truncate">{u.name}</span>
                </label>
              ))}
            </div>

            {selectedIds.size > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedIds.size} member{selectedIds.size !== 1 ? "s" : ""}{" "}
                selected
              </p>
            )}

            <Button
              className="w-full"
              onClick={handleCreateGroup}
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create Group"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
