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
import { Gift } from "lucide-react";
import { REWARD_CATEGORIES, POINT_OPTIONS } from "../_lib/categories.ts";

export default function GiveRewardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currentUser = useQuery(api.users.getCurrentUser);
  const allUsers = useQuery(api.users.getAllStaff);
  const giveReward = useMutation(api.rewards.give);

  const [recipientId, setRecipientId] = useState("");
  const [category, setCategory] = useState("");
  const [points, setPoints] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Filter out current user from potential recipients
  const recipients =
    allUsers?.filter((u) => u._id !== currentUser?._id) ?? [];

  const resetForm = () => {
    setRecipientId("");
    setCategory("");
    setPoints(null);
    setMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !category || !message.trim()) return;

    const recipient = recipients.find(
      (u) => String(u._id) === recipientId,
    );
    if (!recipient) return;

    setIsLoading(true);
    try {
      await giveReward({
        toUserId: recipient._id,
        points: points ?? undefined,
        message: message.trim(),
        category,
      });
      toast.success(`Reward sent to ${recipient.name ?? "teammate"}!`);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message: msg } = error.data as { message: string };
        toast.error(msg);
      } else {
        toast.error("Failed to send reward");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isValid =
    recipientId && category && message.trim().length > 0;

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
            <Gift className="size-5 text-primary" />
            Give a Reward
          </DialogTitle>
          <DialogDescription>
            Recognize a teammate for their great work
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Recipient */}
          <div className="space-y-2">
            <Label>Who are you recognizing?</Label>
            <Select
              value={recipientId}
              onValueChange={setRecipientId}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a teammate" />
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
                      : "border-border hover:bg-muted",
                  )}
                >
                  <cat.icon className={cn("size-4 shrink-0", cat.color)} />
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Points (optional) */}
          <div className="space-y-2">
            <Label>Points <span className="text-muted-foreground font-normal">(optional)</span></Label>
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
                      : "border-border hover:bg-muted",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Tell them why they deserve this reward..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
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
              {isLoading ? "Sending..." : "Send Reward"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
