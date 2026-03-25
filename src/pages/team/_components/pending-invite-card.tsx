import { Clock, Mail, X } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

type InviteData = {
  _id: Id<"invites">;
  name: string;
  email: string;
  role: string;
};

export default function PendingInviteCard({
  invite,
  canCancel,
}: {
  invite: InviteData;
  canCancel: boolean;
}) {
  const cancelInvite = useMutation(api.organizations.cancelInvite);

  const initials = invite.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleCancel = async () => {
    try {
      await cancelInvite({ inviteId: invite._id });
      toast.success("Invite cancelled");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to cancel invite");
      }
    }
  };

  return (
    <div className="group relative flex flex-col items-center rounded-xl border border-dashed border-muted-foreground/30 bg-card/50 p-6 text-center">
      {/* Cancel button */}
      {canCancel && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 size-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={handleCancel}
        >
          <X className="size-3.5" />
        </Button>
      )}

      {/* Avatar */}
      <div className="size-16 rounded-full flex items-center justify-center text-lg font-heading font-bold mb-3 bg-muted/50 text-muted-foreground border-2 border-dashed border-muted-foreground/20">
        {initials}
      </div>

      {/* Name */}
      <p className="font-semibold text-sm truncate w-full text-muted-foreground">
        {invite.name}
      </p>

      {/* Email */}
      <p className="text-xs text-muted-foreground/70 mt-0.5 truncate w-full flex items-center justify-center gap-1">
        <Mail className="size-3" />
        {invite.email}
      </p>

      {/* Pending badge */}
      <div className="mt-2">
        <Badge
          variant="secondary"
          className="text-[10px] gap-1 bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800"
        >
          <Clock className="size-3" />
          Pending Invite
        </Badge>
      </div>
    </div>
  );
}
