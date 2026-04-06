import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function IssueGiftDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const users = useQuery(api.users.getAllStaff);
  const gifts = useQuery(api.giftShop.listGifts, { includeInactive: false });
  const issueGift = useMutation(api.giftShop.issueGift);

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedGiftId, setSelectedGiftId] = useState<string>("");
  const [adminNote, setAdminNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const reset = () => {
    setSelectedUserId("");
    setSelectedGiftId("");
    setAdminNote("");
  };

  const handleSubmit = async () => {
    if (!selectedUserId || !selectedGiftId) {
      toast.error("Please select both a team member and a gift.");
      return;
    }

    setIsLoading(true);
    try {
      await issueGift({
        userId: selectedUserId as Id<"users">,
        giftId: selectedGiftId as Id<"rewardGifts">,
        adminNote: adminNote.trim() || undefined,
      });
      toast.success("Gift issued successfully!");
      reset();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to issue gift");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const selectedGift = gifts?.find((g) => g._id === selectedGiftId);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue Gift</DialogTitle>
          <DialogDescription>
            Directly award a gift to a team member. No points will be deducted
            from their balance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* User select */}
          <div className="space-y-2">
            <Label>Team member</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {users?.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name ?? u.email ?? "Unnamed"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gift select */}
          <div className="space-y-2">
            <Label>Gift</Label>
            <Select value={selectedGiftId} onValueChange={setSelectedGiftId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a gift" />
              </SelectTrigger>
              <SelectContent>
                {gifts?.map((g) => (
                  <SelectItem key={g._id} value={g._id}>
                    {g.name}{" "}
                    {g.stock !== undefined && (
                      <span className="text-muted-foreground">
                        ({g.stock} left)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedGift && (
              <p className="text-xs text-muted-foreground">
                {selectedGift.category.replace("_", " ")} · {selectedGift.pointsCost} pts value
                {selectedGift.description && ` · ${selectedGift.description}`}
              </p>
            )}
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>
              Note{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              placeholder="e.g. Outstanding performance this quarter"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              disabled={isLoading}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !selectedUserId || !selectedGiftId}
          >
            {isLoading ? "Issuing..." : "Issue Gift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
