import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
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
import { Star, Heart, Trophy, Rocket, Gem } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

const BADGES = [
  { value: "star", label: "Star Performer", icon: Star, color: "text-amber-500 bg-amber-500/10" },
  { value: "heart", label: "Heart of the Team", icon: Heart, color: "text-rose-500 bg-rose-500/10" },
  { value: "trophy", label: "Outstanding Achievement", icon: Trophy, color: "text-yellow-500 bg-yellow-500/10" },
  { value: "rocket", label: "Going Above & Beyond", icon: Rocket, color: "text-violet-500 bg-violet-500/10" },
  { value: "gem", label: "Hidden Gem", icon: Gem, color: "text-cyan-500 bg-cyan-500/10" },
] as const;

type BadgeValue = typeof BADGES[number]["value"];

export default function GiveRecognitionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const members = useQuery(api.organizations.getMembers);
  const currentUser = useQuery(api.users.getCurrentUser);
  const createRecognition = useMutation(api.recognitions.create);

  const [recipientId, setRecipientId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [badge, setBadge] = useState<BadgeValue>("star");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out the current user from the list
  const eligibleMembers = (members ?? []).filter((m) => m._id !== currentUser?._id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !title.trim() || !message.trim()) return;

    setIsSubmitting(true);
    try {
      await createRecognition({
        recipientId: recipientId as Id<"users">,
        title: title.trim(),
        message: message.trim(),
        badge,
      });
      toast.success("Recognition shared with the team!");
      setRecipientId("");
      setTitle("");
      setMessage("");
      setBadge("star");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message: msg } = error.data as { message: string };
        toast.error(msg);
      } else {
        toast.error("Failed to create recognition");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBadge = BADGES.find((b) => b.value === badge);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recognize a Team Member</DialogTitle>
          <DialogDescription>
            Celebrate someone{"'"}s hard work. This will be shared on the dashboard for all to see.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Team member select */}
          <div className="space-y-2">
            <Label>Team Member</Label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a team member" />
              </SelectTrigger>
              <SelectContent>
                {eligibleMembers.map((member) => (
                  <SelectItem key={member._id} value={member._id}>
                    {member.name ?? member.email ?? "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Badge select */}
          <div className="space-y-2">
            <Label>Badge</Label>
            <div className="flex flex-wrap gap-2">
              {BADGES.map((b) => {
                const Icon = b.icon;
                const isSelected = badge === b.value;
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setBadge(b.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border",
                      isSelected
                        ? cn(b.color, "border-current ring-1 ring-current/20")
                        : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                    )}
                  >
                    <Icon className="size-3.5" />
                    {b.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="recognition-title">Title</Label>
            <Input
              id="recognition-title"
              placeholder="e.g. Employee of the Month"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              maxLength={100}
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="recognition-message">Message</Label>
            <Textarea
              id="recognition-message"
              placeholder="Tell the team why this person deserves recognition..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Preview */}
          {recipientId && title.trim() && selectedBadge && (
            <div className={cn("rounded-xl p-4 border", selectedBadge.color)}>
              <div className="flex items-center gap-2 mb-1">
                <selectedBadge.icon className="size-5" />
                <span className="font-semibold text-sm">{title || "Recognition Title"}</span>
              </div>
              <p className="text-xs opacity-80">
                Preview of how this will appear on the dashboard
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!recipientId || !title.trim() || !message.trim() || isSubmitting}
            >
              {isSubmitting ? "Sharing..." : "Share Recognition"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
