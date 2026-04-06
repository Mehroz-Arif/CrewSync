import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format, parseISO, addDays } from "date-fns";
import {
  ArrowLeftRight,
  ArrowRight,
  Clock,
  Truck,
  Briefcase,
  User,
  ChevronRight,
  Check,
  X as XIcon,
  CheckCircle2,
  XCircle,
  Ban,
  Megaphone,
  MessageSquare,
  HandHelping,
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
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useIsMobile } from "@/hooks/use-mobile.ts";

type ShiftInfo = {
  startTime: string;
  endTime: string;
  vehicle: string;
  callSign?: string;
  position?: string;
} | null;

/** Compact shift info block */
function ShiftBlock({ shift, label }: { shift: ShiftInfo; label: string }) {
  if (!shift)
    return <span className="text-xs text-muted-foreground italic">Shift deleted</span>;
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Clock className="size-3 text-primary" />
        {format(parseISO(shift.startTime), "EEE, MMM d")} ·{" "}
        {format(parseISO(shift.startTime), "HH:mm")} – {format(parseISO(shift.endTime), "HH:mm")}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Truck className="size-3" />
        {shift.callSign ? `${shift.callSign} · ` : ""}
        {shift.vehicle}
      </div>
      {shift.position && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Briefcase className="size-3" />
          {shift.position}
        </div>
      )}
    </div>
  );
}

// ─── Open Postings (Swap Board) ──────────────────────────────────────────────

export function SwapBoardPostings() {
  const openPostings = useQuery(api.swapBoard.getOpenPostings);
  const cancelOffer = useMutation(api.swapBoard.cancelOffer);
  const [offerDialogPosting, setOfferDialogPosting] = useState<{
    postingId: Id<"swapPostings">;
    userName: string;
    shift: ShiftInfo;
    note?: string;
  } | null>(null);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);

  if (openPostings === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (openPostings.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Megaphone />
          </EmptyMedia>
          <EmptyTitle>No shifts on the board</EmptyTitle>
          <EmptyDescription>
            When a colleague posts a shift for swap, it will appear here
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  async function handleCancelOffer(offerId: Id<"swapOffers">) {
    setIsCancelling(offerId);
    try {
      await cancelOffer({ offerId });
      toast.success("Offer cancelled");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to cancel offer");
      }
    } finally {
      setIsCancelling(null);
    }
  }

  return (
    <>
      <div className="space-y-3">
        {openPostings.map((posting) => (
          <div
            key={posting._id}
            className="rounded-xl border bg-card p-4 space-y-3"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="size-3.5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{posting.userName}</div>
                  <div className="text-[10px] text-muted-foreground">wants to swap</div>
                </div>
              </div>
              {posting.offerCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {posting.offerCount} offer{posting.offerCount !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {/* Shift details */}
            {posting.shift && <ShiftBlock shift={posting.shift} label="Their shift" />}

            {/* Note */}
            {posting.note && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MessageSquare className="size-3 mt-0.5 shrink-0" />
                <span className="italic">{posting.note}</span>
              </div>
            )}

            {/* Action */}
            {posting.hasMyOffer ? (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                onClick={() => handleCancelOffer(posting.myOfferId as Id<"swapOffers">)}
                disabled={isCancelling === posting.myOfferId}
              >
                {isCancelling === posting.myOfferId ? <Spinner /> : <Ban className="size-3.5" />}
                Cancel My Offer
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  setOfferDialogPosting({
                    postingId: posting._id,
                    userName: posting.userName,
                    shift: posting.shift,
                    note: posting.note,
                  })
                }
              >
                <HandHelping className="size-3.5" />
                Offer Your Shift
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Offer dialog */}
      {offerDialogPosting && (
        <OfferShiftDialog
          open={!!offerDialogPosting}
          onOpenChange={(open) => {
            if (!open) setOfferDialogPosting(null);
          }}
          postingId={offerDialogPosting.postingId}
          posterName={offerDialogPosting.userName}
          posterShift={offerDialogPosting.shift}
          posterNote={offerDialogPosting.note}
        />
      )}
    </>
  );
}

// ─── Offer Shift Dialog ─────────────────────────────────────────────────────

function OfferShiftDialog({
  open,
  onOpenChange,
  postingId,
  posterName,
  posterShift,
  posterNote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postingId: Id<"swapPostings">;
  posterName: string;
  posterShift: ShiftInfo;
  posterNote?: string;
}) {
  const isMobile = useIsMobile();

  const content = (
    <OfferShiftContent
      postingId={postingId}
      posterName={posterName}
      posterShift={posterShift}
      posterNote={posterNote}
      onClose={() => onOpenChange(false)}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Offer Your Shift</DrawerTitle>
            <DrawerDescription>
              Choose one of your shifts to offer {posterName} in exchange
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2 max-h-[60vh] overflow-y-auto">{content}</div>
          <DrawerFooter />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Offer Your Shift</DialogTitle>
          <DialogDescription>
            Choose one of your shifts to offer {posterName} in exchange
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

function OfferShiftContent({
  postingId,
  posterName,
  posterShift,
  posterNote,
  onClose,
}: {
  postingId: Id<"swapPostings">;
  posterName: string;
  posterShift: ShiftInfo;
  posterNote?: string;
  onClose: () => void;
}) {
  const [selectedShift, setSelectedShift] = useState<{
    membershipId: string;
    startTime: string;
    endTime: string;
    vehicle: string;
    callSign?: string;
    position?: string;
  } | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query my accepted shifts in a +/- 30 day range
  const rangeStart = new Date().toISOString();
  const rangeEnd = addDays(new Date(), 60).toISOString();

  const myShifts = useQuery(api.swapBoard.getMyAcceptedShifts, {
    startDate: rangeStart,
    endDate: rangeEnd,
  });

  const makeOffer = useMutation(api.swapBoard.makeOffer);

  const handleSubmit = async () => {
    if (!selectedShift) return;
    setIsSubmitting(true);
    try {
      await makeOffer({
        postingId,
        membershipId: selectedShift.membershipId as Id<"shiftMembers">,
        note: note.trim() || undefined,
      });
      toast.success(`Offer sent to ${posterName}`);
      onClose();
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to send offer");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (myShifts === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // Confirmation step
  if (selectedShift) {
    return (
      <div className="space-y-4">
        {/* Swap summary */}
        <div className="rounded-lg bg-muted/40 p-3 space-y-3">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <ShiftBlock
              shift={{
                startTime: selectedShift.startTime,
                endTime: selectedShift.endTime,
                vehicle: selectedShift.vehicle,
                callSign: selectedShift.callSign,
                position: selectedShift.position,
              }}
              label="You offer"
            />
            <ArrowRight className="size-4 text-muted-foreground" />
            <ShiftBlock shift={posterShift} label="You get" />
          </div>
        </div>

        {/* Note */}
        <div className="space-y-2">
          <Label htmlFor="offer-note" className="text-sm">
            Note (optional)
          </Label>
          <Textarea
            id="offer-note"
            placeholder="e.g. Happy to swap, this works well for me..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
            onClick={() => setSelectedShift(null)}
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
            {isSubmitting ? <Spinner /> : <HandHelping className="size-4" />}
            Send Offer
          </Button>
        </div>
      </div>
    );
  }

  // Shift selection step
  if (myShifts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ArrowLeftRight className="size-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">No eligible shifts</p>
        <p className="text-xs mt-1">
          You don&apos;t have any accepted upcoming shifts to offer
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Poster info */}
      <div className="rounded-lg bg-muted/40 p-3 space-y-2">
        <ShiftBlock shift={posterShift} label={`${posterName}'s shift`} />
        {posterNote && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MessageSquare className="size-3 mt-0.5 shrink-0" />
            <span className="italic">{posterNote}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Select one of your shifts to offer in exchange
      </p>

      {myShifts.map((shift) => (
        <button
          key={shift.membershipId}
          type="button"
          onClick={() =>
            setSelectedShift({
              membershipId: shift.membershipId,
              startTime: shift.startTime,
              endTime: shift.endTime,
              vehicle: shift.vehicle,
              callSign: shift.callSign,
              position: shift.position,
            })
          }
          className="w-full text-left rounded-lg border px-3 py-2.5 text-xs space-y-1 transition-colors hover:bg-muted/30 active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold">
              <Clock className="size-3 text-primary" />
              {format(parseISO(shift.startTime), "EEE, MMM d")} ·{" "}
              {format(parseISO(shift.startTime), "HH:mm")} –{" "}
              {format(parseISO(shift.endTime), "HH:mm")}
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
  );
}

// ─── My Postings (with offers received) ──────────────────────────────────────

export function MySwapPostings() {
  const myPostings = useQuery(api.swapBoard.getMyPostings);
  const myOffers = useQuery(api.swapBoard.getMyOffers);
  const cancelPosting = useMutation(api.swapBoard.cancelPosting);
  const respondToOffer = useMutation(api.swapBoard.respondToOffer);
  const cancelOffer = useMutation(api.swapBoard.cancelOffer);
  const [isRespondingTo, setIsRespondingTo] = useState<string | null>(null);
  const [isCancellingPosting, setIsCancellingPosting] = useState<string | null>(null);
  const [isCancellingOffer, setIsCancellingOffer] = useState<string | null>(null);

  if (myPostings === undefined || myOffers === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const hasPostings = myPostings.length > 0;
  const hasOffers = myOffers.length > 0;

  if (!hasPostings && !hasOffers) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p className="text-sm">No board postings or offers yet</p>
        <p className="text-xs mt-1">Post a shift from your calendar to start</p>
      </div>
    );
  }

  async function handleRespondToOffer(offerId: Id<"swapOffers">, response: "accepted" | "declined") {
    setIsRespondingTo(offerId);
    try {
      await respondToOffer({ offerId, response });
      toast.success(response === "accepted" ? "Swap completed!" : "Offer declined");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to respond to offer");
      }
    } finally {
      setIsRespondingTo(null);
    }
  }

  async function handleCancelPosting(postingId: Id<"swapPostings">) {
    setIsCancellingPosting(postingId);
    try {
      await cancelPosting({ postingId });
      toast.success("Posting cancelled");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to cancel posting");
      }
    } finally {
      setIsCancellingPosting(null);
    }
  }

  async function handleCancelOffer(offerId: Id<"swapOffers">) {
    setIsCancellingOffer(offerId);
    try {
      await cancelOffer({ offerId });
      toast.success("Offer cancelled");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to cancel offer");
      }
    } finally {
      setIsCancellingOffer(null);
    }
  }

  const openPostings = myPostings.filter((p) => p.status === "open");
  const resolvedPostings = myPostings.filter((p) => p.status !== "open");
  const pendingOffers = myOffers.filter((o) => o.status === "pending");
  const resolvedOffers = myOffers.filter((o) => o.status !== "pending");

  return (
    <div className="space-y-4">
      {/* Open postings with offers */}
      {openPostings.map((posting) => {
        const pendingOffersList = posting.offers.filter((o) => o.status === "pending");
        return (
          <div key={posting._id} className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="size-4 text-primary" />
                <span className="text-xs font-semibold">Your posted shift</span>
              </div>
              <Badge variant="default" className="text-[10px]">Open</Badge>
            </div>

            <ShiftBlock shift={posting.shift} label="Your shift" />

            {posting.note && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <MessageSquare className="size-3 mt-0.5 shrink-0" />
                <span className="italic">{posting.note}</span>
              </div>
            )}

            {/* Offers received */}
            {pendingOffersList.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground">
                  {pendingOffersList.length} offer{pendingOffersList.length !== 1 ? "s" : ""} received
                </div>
                {pendingOffersList.map((offer) => (
                  <div key={offer._id} className="rounded-lg border bg-background p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="size-3 text-primary" />
                      </div>
                      <span className="text-xs font-semibold">{offer.offererName}</span>
                    </div>

                    <ShiftBlock shift={offer.shift} label="Their offer" />

                    {offer.note && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MessageSquare className="size-3 mt-0.5 shrink-0" />
                        <span className="italic">{offer.note}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleRespondToOffer(offer._id, "accepted")}
                        disabled={isRespondingTo === offer._id}
                      >
                        {isRespondingTo === offer._id ? <Spinner /> : <Check className="size-3.5" />}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 gap-1.5"
                        onClick={() => handleRespondToOffer(offer._id, "declined")}
                        disabled={isRespondingTo === offer._id}
                      >
                        <XIcon className="size-3.5" />
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pendingOffersList.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No offers yet — waiting for someone to respond
              </p>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-muted-foreground"
              onClick={() => handleCancelPosting(posting._id)}
              disabled={isCancellingPosting === posting._id}
            >
              {isCancellingPosting === posting._id ? <Spinner /> : <Ban className="size-3.5" />}
              Cancel Posting
            </Button>
          </div>
        );
      })}

      {/* Pending offers I made */}
      {pendingOffers.map((offer) => (
        <div key={offer._id} className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HandHelping className="size-4 text-muted-foreground" />
              <span className="text-xs font-semibold">
                Your offer to {offer.posterName}
              </span>
            </div>
            <Badge variant="secondary" className="text-[10px]">Pending</Badge>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <ShiftBlock shift={offer.myShift} label="Your shift" />
            <ArrowRight className="size-4 text-muted-foreground" />
            <ShiftBlock shift={offer.posterShift} label="Their shift" />
          </div>

          {offer.note && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <MessageSquare className="size-3 mt-0.5 shrink-0" />
              <span className="italic">Your note: {offer.note}</span>
            </div>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={() => handleCancelOffer(offer._id)}
            disabled={isCancellingOffer === offer._id}
          >
            {isCancellingOffer === offer._id ? <Spinner /> : <Ban className="size-3.5" />}
            Cancel Offer
          </Button>
        </div>
      ))}

      {/* Resolved postings */}
      {resolvedPostings.slice(0, 5).map((posting) => {
        const statusConfig = {
          matched: { icon: <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />, label: "Swapped", bg: "border-emerald-500/20 bg-emerald-500/[0.03]" },
          cancelled: { icon: <Ban className="size-3.5 text-muted-foreground" />, label: "Cancelled", bg: "border-border bg-muted/20" },
          open: { icon: null, label: "Open", bg: "" },
        } as const;
        const config = statusConfig[posting.status];
        return (
          <div key={posting._id} className={cn("rounded-xl border p-3 space-y-1.5 opacity-70", config.bg)}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Your posting</span>
              <div className="flex items-center gap-1 text-[10px] font-medium">
                {config.icon}
                {config.label}
              </div>
            </div>
            {posting.shift && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="size-3" />
                {format(parseISO(posting.shift.startTime), "MMM d, HH:mm")} – {format(parseISO(posting.shift.endTime), "HH:mm")}
              </div>
            )}
          </div>
        );
      })}

      {/* Resolved offers */}
      {resolvedOffers.slice(0, 5).map((offer) => {
        const statusConfig = {
          accepted: { icon: <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />, label: "Accepted", bg: "border-emerald-500/20 bg-emerald-500/[0.03]" },
          declined: { icon: <XCircle className="size-3.5 text-rose-600 dark:text-rose-400" />, label: "Declined", bg: "border-rose-500/20 bg-rose-500/[0.03]" },
          cancelled: { icon: <Ban className="size-3.5 text-muted-foreground" />, label: "Cancelled", bg: "border-border bg-muted/20" },
          pending: { icon: null, label: "Pending", bg: "" },
        } as const;
        const config = statusConfig[offer.status];
        return (
          <div key={offer._id} className={cn("rounded-xl border p-3 space-y-1.5 opacity-70", config.bg)}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Offer to {offer.posterName}
              </span>
              <div className="flex items-center gap-1 text-[10px] font-medium">
                {config.icon}
                {config.label}
              </div>
            </div>
            {offer.myShift && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Clock className="size-3" />
                {format(parseISO(offer.myShift.startTime), "MMM d, HH:mm")} – {format(parseISO(offer.myShift.endTime), "HH:mm")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
