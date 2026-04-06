import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format, parseISO } from "date-fns";
import {
  Megaphone,
  Clock,
  Truck,
  Briefcase,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useIsMobile } from "@/hooks/use-mobile.ts";

type SwapRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The requester's shift membership ID */
  membershipId: string;
  /** The requester's shift ID */
  shiftId: string;
  /** The requester's shift start time (for display) */
  shiftStartTime: string;
  shiftEndTime: string;
};

export default function SwapRequestDialog({
  open,
  onOpenChange,
  membershipId,
  shiftStartTime,
  shiftEndTime,
}: SwapRequestDialogProps) {
  const isMobile = useIsMobile();

  const shiftLabel = `${format(parseISO(shiftStartTime), "EEE, MMM d")} · ${format(parseISO(shiftStartTime), "HH:mm")} – ${format(parseISO(shiftEndTime), "HH:mm")}`;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Post Shift for Swap</DrawerTitle>
            <DrawerDescription>
              Post your {shiftLabel} shift to the swap board
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2">
            <PostToBoard
              membershipId={membershipId}
              shiftStartTime={shiftStartTime}
              shiftEndTime={shiftEndTime}
              onClose={() => onOpenChange(false)}
            />
          </div>
          <DrawerFooter />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Post Shift for Swap</DialogTitle>
          <DialogDescription>
            Post your {shiftLabel} shift to the swap board
          </DialogDescription>
        </DialogHeader>
        <PostToBoard
          membershipId={membershipId}
          shiftStartTime={shiftStartTime}
          shiftEndTime={shiftEndTime}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PostToBoard({
  membershipId,
  shiftStartTime,
  shiftEndTime,
  onClose,
}: {
  membershipId: string;
  shiftStartTime: string;
  shiftEndTime: string;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createPosting = useMutation(api.swapBoard.createPosting);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await createPosting({
        membershipId: membershipId as Id<"shiftMembers">,
        note: note.trim() || undefined,
      });
      toast.success("Shift posted to the swap board");
      onClose();
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to post shift");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Shift being posted */}
      <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Your shift
        </div>
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Clock className="size-3.5 text-primary" />
          {format(parseISO(shiftStartTime), "EEE, MMM d")} ·{" "}
          {format(parseISO(shiftStartTime), "HH:mm")} – {format(parseISO(shiftEndTime), "HH:mm")}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Your shift will be posted to the swap board. Other staff members can browse it and offer one of their shifts in exchange.
      </p>

      {/* Note field */}
      <div className="space-y-2">
        <Label htmlFor="post-note" className="text-sm">
          Note (optional)
        </Label>
        <Textarea
          id="post-note"
          placeholder="e.g. Need to swap due to personal appointment..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="text-base"
        />
      </div>

      {/* Submit */}
      <Button
        size="lg"
        className="w-full gap-2"
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? <Spinner /> : <Megaphone className="size-4" />}
        Post to Swap Board
      </Button>
    </div>
  );
}
