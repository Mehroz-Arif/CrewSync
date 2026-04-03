import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format, parseISO, addDays, subDays } from "date-fns";
import {
  ArrowLeftRight,
  Clock,
  Truck,
  Radio,
  Briefcase,
  User,
  ChevronRight,
  Check,
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
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
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
  /** The requester's shift start time (for display + candidate range) */
  shiftStartTime: string;
  shiftEndTime: string;
};

export default function SwapRequestDialog({
  open,
  onOpenChange,
  membershipId,
  shiftId,
  shiftStartTime,
  shiftEndTime,
}: SwapRequestDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Request Shift Swap</DrawerTitle>
            <DrawerDescription>
              Choose who you&apos;d like to swap your {format(parseISO(shiftStartTime), "MMM d, HH:mm")} – {format(parseISO(shiftEndTime), "HH:mm")} shift with
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2 max-h-[60vh] overflow-y-auto">
            <SwapRequestContent
              membershipId={membershipId}
              shiftId={shiftId}
              shiftStartTime={shiftStartTime}
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
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Shift Swap</DialogTitle>
          <DialogDescription>
            Choose who you&apos;d like to swap your {format(parseISO(shiftStartTime), "MMM d, HH:mm")} – {format(parseISO(shiftEndTime), "HH:mm")} shift with
          </DialogDescription>
        </DialogHeader>
        <SwapRequestContent
          membershipId={membershipId}
          shiftId={shiftId}
          shiftStartTime={shiftStartTime}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SwapRequestContent({
  membershipId,
  shiftId,
  shiftStartTime,
  onClose,
}: {
  membershipId: string;
  shiftId: string;
  shiftStartTime: string;
  onClose: () => void;
}) {
  const [selectedTarget, setSelectedTarget] = useState<{
    membershipId: string;
    userId: string;
    userName: string;
    startTime: string;
    endTime: string;
    vehicle: string;
    callSign?: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query candidates: shifts +/- 14 days from the requester's shift
  const rangeStart = subDays(parseISO(shiftStartTime), 14).toISOString();
  const rangeEnd = addDays(parseISO(shiftStartTime), 14).toISOString();

  const candidates = useQuery(api.shiftSwaps.getSwapCandidates, {
    shiftId: shiftId as Id<"shifts">,
    startDate: rangeStart,
    endDate: rangeEnd,
  });

  const requestSwap = useMutation(api.shiftSwaps.requestSwap);

  const handleSubmit = async () => {
    if (!selectedTarget) return;
    setIsSubmitting(true);
    try {
      await requestSwap({
        requesterMembershipId: membershipId as Id<"shiftMembers">,
        targetMembershipId: selectedTarget.membershipId as Id<"shiftMembers">,
        reason: reason.trim() || undefined,
      });
      toast.success(`Swap request sent to ${selectedTarget.userName}`);
      onClose();
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to send swap request");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (candidates === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (selectedTarget) {
    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="rounded-lg bg-muted/40 p-4 space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Swap with
          </div>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="size-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-semibold">{selectedTarget.userName}</div>
              <div className="text-xs text-muted-foreground">
                {format(parseISO(selectedTarget.startTime), "EEE, MMM d")} ·{" "}
                {format(parseISO(selectedTarget.startTime), "HH:mm")} – {format(parseISO(selectedTarget.endTime), "HH:mm")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Truck className="size-3" />
            {selectedTarget.callSign ? `${selectedTarget.callSign} · ` : ""}
            {selectedTarget.vehicle}
          </div>
        </div>

        {/* Optional reason */}
        <div className="space-y-2">
          <Label htmlFor="swap-reason" className="text-sm">
            Reason (optional)
          </Label>
          <Textarea
            id="swap-reason"
            placeholder="e.g. Personal appointment, childcare..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="text-base"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="lg"
            className="flex-1"
            onClick={() => setSelectedTarget(null)}
            disabled={isSubmitting}
          >
            Back
          </Button>
          <Button
            size="lg"
            className="flex-1 gap-2"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner /> : <ArrowLeftRight className="size-4" />}
            Send Request
          </Button>
        </div>
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ArrowLeftRight className="size-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">No eligible shifts found</p>
        <p className="text-xs mt-1">
          No other staff members have accepted shifts in the next 2 weeks to swap with
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Select a shift from another staff member to propose a swap
      </p>
      {candidates.map((candidate) => (
        <div key={candidate.user._id} className="space-y-1.5">
          {/* Staff member heading */}
          <div className="flex items-center gap-2 px-1 pt-1">
            <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="size-3 text-primary" />
            </div>
            <span className="text-xs font-semibold">{candidate.user.name}</span>
          </div>

          {/* Their shifts */}
          {candidate.shifts.map((shift) => (
            <button
              key={shift.membershipId}
              type="button"
              onClick={() =>
                setSelectedTarget({
                  membershipId: shift.membershipId,
                  userId: candidate.user._id,
                  userName: candidate.user.name,
                  startTime: shift.startTime,
                  endTime: shift.endTime,
                  vehicle: shift.vehicle,
                  callSign: shift.callSign,
                })
              }
              className="w-full text-left rounded-lg border px-3 py-2.5 text-xs space-y-1 transition-colors hover:bg-muted/30 active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Clock className="size-3 text-primary" />
                  {format(parseISO(shift.startTime), "EEE, MMM d")} ·{" "}
                  {format(parseISO(shift.startTime), "HH:mm")} – {format(parseISO(shift.endTime), "HH:mm")}
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Truck className="size-3" />
                {shift.callSign ? `${shift.callSign} · ` : ""}
                {shift.vehicle}
              </div>
              {shift.position && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Briefcase className="size-3" />
                  {shift.position}
                </div>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
