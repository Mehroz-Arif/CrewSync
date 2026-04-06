import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
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
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { HandHeart } from "lucide-react";
import { REWARD_CATEGORIES, POINT_OPTIONS } from "../_lib/categories.ts";

export default function NominateColleagueDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const allUsers = useQuery(api.users.getAllStaff);
  const nominate = useMutation(api.rewardNominations.nominate);

  const [recipientId, setRecipientId] = useState("");
  const [category, setCategory] = useState("");
  const [points, setPoints] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const recipients = allUsers?.filter((u) => u._id !== currentUser?._id) ?? [];

  const resetForm = () => {
    setRecipientId("");
    setCategory("");
    setPoints(null);
    setReason("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !category || !reason.trim()) return;

    const recipient = recipients.find((u) => String(u._id) === recipientId);
    if (!recipient) return;

    setIsLoading(true);
    try {
      await nominate({
        nomineeId: recipient._id,
        reason: reason.trim(),
        category,
        suggestedPoints: points ?? undefined,
      });
      toast.success(`Nomination submitted for ${recipient.name ?? "teammate"}! An admin will review it.`);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to submit nomination");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = recipientId && category && reason.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetForm();
        onOpenChange(val);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandHeart className="size-5 text-primary" />
            Nominate a Colleague
          </DialogTitle>
          <DialogDescription>
            Suggest a reward for a teammate. An admin will review and approve it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Colleague */}
          <div className="space-y-2">
            <Label>Who would you like to nominate?</Label>
            <Select
              value={recipientId}
              onValueChange={setRecipientId}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a colleague" />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((u) => (
                  <SelectItem key={u._id} value={String(u._id)}>
                    {u.name ?? u.email ?? "Unnamed"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="grid grid-cols-2 gap-2">
              {REWARD_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  disabled={isLoading}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors text-left",
                    category === cat.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <cat.icon className={cn("size-4 shrink-0", cat.color)} />
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Suggested Points (optional) */}
          <div className="space-y-2">
            <Label>
              Suggested Points{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="flex gap-2">
              {POINT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPoints(points === opt ? null : opt)}
                  disabled={isLoading}
                  className={cn(
                    "flex-1 rounded-lg border py-2.5 text-sm font-semibold transition-colors",
                    points === opt
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Why do they deserve this?</Label>
            <Textarea
              placeholder="Describe what they did and why it matters..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isLoading}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isLoading}>
              {isLoading ? "Submitting..." : "Submit Nomination"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
