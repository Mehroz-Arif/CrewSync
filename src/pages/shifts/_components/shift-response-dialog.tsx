import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format, parseISO } from "date-fns";
import {
  Clock,
  Truck,
  Radio,
  Users,
  Briefcase,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Check,
  X as XIcon,
  ArrowLeftRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useIsMobile } from "@/hooks/use-mobile.ts";

export type ShiftForResponse = {
  _id: string;
  startTime: string;
  endTime: string;
  vehicle: string;
  callSign?: string;
  position?: string;
  membershipId: string;
  responseStatus: "pending" | "accepted" | "declined";
  declineReason?: string;
  members: Array<{ userId: string; name: string }>;
};

type ShiftResponseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: ShiftForResponse | null;
  onRequestSwap?: () => void;
};

export default function ShiftResponseDialog({
  open,
  onOpenChange,
  shift,
  onRequestSwap,
}: ShiftResponseDialogProps) {
  const isMobile = useIsMobile();

  if (!shift) return null;

  // Use drawer on mobile for better UX
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Shift Details</DrawerTitle>
            <DrawerDescription>
              {format(parseISO(shift.startTime), "EEEE, MMM d yyyy")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2">
            <ShiftResponseContent shift={shift} onClose={() => onOpenChange(false)} onRequestSwap={onRequestSwap} />
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
          <DialogTitle>Shift Details</DialogTitle>
          <DialogDescription>
            {format(parseISO(shift.startTime), "EEEE, MMM d yyyy")}
          </DialogDescription>
        </DialogHeader>
        <ShiftResponseContent shift={shift} onClose={() => onOpenChange(false)} onRequestSwap={onRequestSwap} />
      </DialogContent>
    </Dialog>
  );
}

/** Inner content shared between Dialog and Drawer */
function ShiftResponseContent({
  shift,
  onClose,
  onRequestSwap,
}: {
  shift: ShiftForResponse;
  onClose: () => void;
  onRequestSwap?: () => void;
}) {
  const respondToShift = useMutation(api.shifts.respondToShift);
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      await respondToShift({
        membershipId: shift.membershipId as Id<"shiftMembers">,
        response: "accepted",
      });
      toast.success("Shift accepted");
      onClose();
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to accept shift");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclineSubmit = async () => {
    if (!declineReason.trim()) {
      toast.error("Please provide a reason for declining");
      return;
    }
    setIsSubmitting(true);
    try {
      await respondToShift({
        membershipId: shift.membershipId as Id<"shiftMembers">,
        response: "declined",
        declineReason: declineReason.trim(),
      });
      toast.success("Shift declined");
      onClose();
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to decline shift");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Shift info */}
      <div className="space-y-3 rounded-lg bg-muted/40 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-4 shrink-0 text-primary" />
          {format(parseISO(shift.startTime), "HH:mm")} –{" "}
          {format(parseISO(shift.endTime), "HH:mm")}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Truck className="size-4 shrink-0" />
          <span>{shift.vehicle}</span>
        </div>
        {shift.callSign && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className="size-4 shrink-0" />
            <span>{shift.callSign}</span>
          </div>
        )}
        {shift.position && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Briefcase className="size-4 shrink-0" />
            <span>{shift.position}</span>
          </div>
        )}
        {shift.members.length > 1 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4 shrink-0" />
            <span>{shift.members.map((m) => m.name).join(", ")}</span>
          </div>
        )}
      </div>

      {/* Current status display */}
      {shift.responseStatus === "accepted" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3">
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              You have accepted this shift
            </span>
          </div>
          <Button
            size="lg"
            variant="secondary"
            className="w-full gap-2"
            onClick={() => onRequestSwap?.()}
          >
            <ArrowLeftRight className="size-4" />
            Request Swap
          </Button>
        </div>
      )}

      {shift.responseStatus === "declined" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 px-4 py-3">
            <XCircle className="size-5 text-rose-600 dark:text-rose-400" />
            <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
              You have declined this shift
            </span>
          </div>
          {shift.declineReason && (
            <div className="flex items-start gap-2 px-4 text-sm text-muted-foreground">
              <MessageSquare className="size-4 shrink-0 mt-0.5" />
              <span className="italic">{shift.declineReason}</span>
            </div>
          )}
        </div>
      )}

      {/* Pending response actions */}
      {shift.responseStatus === "pending" && !showDecline && (
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            onClick={handleAccept}
            disabled={isSubmitting}
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSubmitting ? <Spinner /> : <Check className="size-5" />}
            Accept Shift
          </Button>
          <Button
            size="lg"
            variant="destructive"
            onClick={() => setShowDecline(true)}
            disabled={isSubmitting}
            className="w-full gap-2"
          >
            <XIcon className="size-5" />
            Decline Shift
          </Button>
        </div>
      )}

      {/* Decline reason form */}
      {shift.responseStatus === "pending" && showDecline && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="decline-reason-dialog" className="text-sm font-medium">
              Reason for declining *
            </Label>
            <Textarea
              id="decline-reason-dialog"
              placeholder="Please provide a reason..."
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              className="text-base"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="lg"
              className="flex-1"
              onClick={() => {
                setShowDecline(false);
                setDeclineReason("");
              }}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="flex-1 gap-2"
              onClick={handleDeclineSubmit}
              disabled={isSubmitting || !declineReason.trim()}
            >
              {isSubmitting ? <Spinner /> : <XIcon className="size-5" />}
              Decline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
