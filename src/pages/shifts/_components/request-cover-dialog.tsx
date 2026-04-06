import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format, parseISO } from "date-fns";
import { ShieldCheck, Clock, Truck } from "lucide-react";
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

type RequestCoverDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membershipId: string;
  shiftStartTime: string;
  shiftEndTime: string;
  shiftCallSign?: string;
  shiftVehicle?: string;
  shiftPosition?: string;
};

export default function RequestCoverDialog({
  open,
  onOpenChange,
  membershipId,
  shiftStartTime,
  shiftEndTime,
  shiftCallSign,
  shiftVehicle,
  shiftPosition,
}: RequestCoverDialogProps) {
  const isMobile = useIsMobile();

  const shiftLabel = `${format(parseISO(shiftStartTime), "EEE, MMM d")} · ${format(parseISO(shiftStartTime), "HH:mm")} – ${format(parseISO(shiftEndTime), "HH:mm")}`;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Request Shift Cover</DrawerTitle>
            <DrawerDescription>
              Ask qualified colleagues to cover your {shiftLabel} shift
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2">
            <RequestCoverForm
              membershipId={membershipId}
              shiftStartTime={shiftStartTime}
              shiftEndTime={shiftEndTime}
              shiftCallSign={shiftCallSign}
              shiftVehicle={shiftVehicle}
              shiftPosition={shiftPosition}
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
          <DialogTitle>Request Shift Cover</DialogTitle>
          <DialogDescription>
            Ask qualified colleagues to cover your {shiftLabel} shift
          </DialogDescription>
        </DialogHeader>
        <RequestCoverForm
          membershipId={membershipId}
          shiftStartTime={shiftStartTime}
          shiftEndTime={shiftEndTime}
          shiftCallSign={shiftCallSign}
          shiftVehicle={shiftVehicle}
          shiftPosition={shiftPosition}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function RequestCoverForm({
  membershipId,
  shiftStartTime,
  shiftEndTime,
  shiftCallSign,
  shiftVehicle,
  shiftPosition,
  onClose,
}: {
  membershipId: string;
  shiftStartTime: string;
  shiftEndTime: string;
  shiftCallSign?: string;
  shiftVehicle?: string;
  shiftPosition?: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createRequest = useMutation(api.coverRequests.createRequest);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await createRequest({
        membershipId: membershipId as Id<"shiftMembers">,
        reason: reason.trim() || undefined,
      });
      toast.success("Cover request posted — qualified staff will be notified");
      onClose();
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to create cover request");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Shift details */}
      <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Shift needing cover
        </div>
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Clock className="size-3.5 text-primary" />
          {format(parseISO(shiftStartTime), "EEE, MMM d")} ·{" "}
          {format(parseISO(shiftStartTime), "HH:mm")} – {format(parseISO(shiftEndTime), "HH:mm")}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {(shiftCallSign || shiftVehicle) && (
            <span className="flex items-center gap-1">
              <Truck className="size-3" />
              {shiftCallSign ? `${shiftCallSign} · ` : ""}
              {shiftVehicle}
            </span>
          )}
          {shiftPosition && (
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3" />
              {shiftPosition}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Your request will be visible to all staff{shiftPosition ? ` qualified as "${shiftPosition}"` : ""}. When someone accepts, they&apos;ll take over this shift assignment.
      </p>

      {/* Reason field */}
      <div className="space-y-2">
        <Label htmlFor="cover-reason" className="text-sm">
          Reason (optional)
        </Label>
        <Textarea
          id="cover-reason"
          placeholder="e.g. Feeling unwell, family emergency..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
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
        {isSubmitting ? <Spinner /> : <ShieldCheck className="size-4" />}
        Request Cover
      </Button>
    </div>
  );
}
