import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format, parseISO } from "date-fns";
import {
  ArrowLeftRight,
  ArrowRight,
  Clock,
  Truck,
  Check,
  X as XIcon,
  CheckCircle2,
  XCircle,
  Ban,
  Inbox,
  SendHorizonal,
  Megaphone,
  LayoutGrid,
  HandHelping,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Badge } from "@/components/ui/badge.tsx";
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
import { SwapBoardPostings, MySwapPostings } from "./swap-board.tsx";

type ShiftInfo = {
  startTime: string;
  endTime: string;
  vehicle: string;
  callSign?: string;
  position?: string;
} | null;

export default function ShiftSwapsSection() {
  const [tab, setTab] = useState<"board" | "activity">("board");

  const boardCounts = useQuery(api.swapBoard.getBoardCounts);
  const swapData = useQuery(api.shiftSwaps.getMySwapRequests);

  const pendingDirectCount = swapData?.received.filter((r) => r.status === "pending").length ?? 0;
  const totalActivityBadge = (boardCounts?.pendingOfferCount ?? 0) + pendingDirectCount;

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1 w-fit">
        <Button
          variant={tab === "board" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("board")}
          className="gap-1.5 relative"
        >
          <LayoutGrid className="size-4" />
          Swap Board
          {(boardCounts?.boardCount ?? 0) > 0 && (
            <Badge variant="default" className="absolute -top-1.5 -right-1.5 size-4 p-0 flex items-center justify-center text-[9px]">
              {boardCounts?.boardCount}
            </Badge>
          )}
        </Button>
        <Button
          variant={tab === "activity" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("activity")}
          className="gap-1.5 relative"
        >
          <HandHelping className="size-4" />
          My Activity
          {totalActivityBadge > 0 && (
            <Badge variant="default" className="absolute -top-1.5 -right-1.5 size-4 p-0 flex items-center justify-center text-[9px]">
              {totalActivityBadge}
            </Badge>
          )}
        </Button>
      </div>

      {/* Content */}
      {tab === "board" && <SwapBoardPostings />}
      {tab === "activity" && (
        <div className="space-y-6">
          {/* Board-based postings & offers */}
          <MySwapPostings />

          {/* Direct swap requests (legacy) */}
          <DirectSwapsSection />
        </div>
      )}
    </div>
  );
}

// ─── Direct Swap Requests (existing logic) ─────────────────────────────────

function DirectSwapsSection() {
  const swapData = useQuery(api.shiftSwaps.getMySwapRequests);

  if (swapData === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  const { sent, received } = swapData;
  const pendingReceived = received.filter((r) => r.status === "pending");
  const resolvedReceived = received.filter((r) => r.status !== "pending");
  const pendingSent = sent.filter((s) => s.status === "pending");
  const resolvedSent = sent.filter((s) => s.status !== "pending");

  const hasAny = sent.length > 0 || received.length > 0;
  if (!hasAny) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Direct Swap Requests
      </h3>

      {/* Incoming */}
      {(pendingReceived.length > 0 || resolvedReceived.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Inbox className="size-4 text-primary" />
            <span className="text-sm font-heading font-semibold">Incoming</span>
            {pendingReceived.length > 0 && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                {pendingReceived.length}
              </Badge>
            )}
          </div>
          {pendingReceived.map((swap) => (
            <IncomingSwapCard key={swap._id} swap={swap} />
          ))}
          {resolvedReceived.slice(0, 5).map((swap) => (
            <ResolvedSwapCard key={swap._id} swap={swap} type="received" />
          ))}
        </div>
      )}

      {/* Outgoing */}
      {(pendingSent.length > 0 || resolvedSent.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <SendHorizonal className="size-4 text-muted-foreground" />
            <span className="text-sm font-heading font-semibold">Your Requests</span>
            {pendingSent.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {pendingSent.length} pending
              </Badge>
            )}
          </div>
          {pendingSent.map((swap) => (
            <OutgoingSwapCard key={swap._id} swap={swap} />
          ))}
          {resolvedSent.slice(0, 5).map((swap) => (
            <ResolvedSwapCard key={swap._id} swap={swap} type="sent" />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────

function ShiftInfoBlock({ shift, label }: { shift: ShiftInfo; label: string }) {
  if (!shift) return <span className="text-xs text-muted-foreground italic">Shift deleted</span>;
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Clock className="size-3 text-primary" />
        {format(parseISO(shift.startTime), "EEE, MMM d")} · {format(parseISO(shift.startTime), "HH:mm")} – {format(parseISO(shift.endTime), "HH:mm")}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Truck className="size-3" />
        {shift.callSign ? `${shift.callSign} · ` : ""}{shift.vehicle}
      </div>
    </div>
  );
}

type EnrichedSwap = {
  _id: Id<"shiftSwaps">;
  requesterName: string;
  targetName: string;
  requesterShift: ShiftInfo;
  targetShift: ShiftInfo;
  reason?: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  _creationTime: number;
};

function IncomingSwapCard({ swap }: { swap: EnrichedSwap }) {
  const respondToSwap = useMutation(api.shiftSwaps.respondToSwap);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRespond = async (response: "accepted" | "declined") => {
    setIsSubmitting(true);
    try {
      await respondToSwap({ swapId: swap._id, response });
      toast.success(response === "accepted" ? "Swap completed!" : "Swap declined");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to respond to swap request");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="size-4 text-primary" />
        <span className="text-xs font-semibold">{swap.requesterName} wants to swap</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <ShiftInfoBlock shift={swap.requesterShift} label="Their shift" />
        <ArrowRight className="size-4 text-muted-foreground" />
        <ShiftInfoBlock shift={swap.targetShift} label="Your shift" />
      </div>
      {swap.reason && (
        <p className="text-xs text-muted-foreground italic px-1">
          &ldquo;{swap.reason}&rdquo;
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => handleRespond("accepted")}
          disabled={isSubmitting}
        >
          {isSubmitting ? <Spinner /> : <Check className="size-3.5" />}
          Accept Swap
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="flex-1 gap-1.5"
          onClick={() => handleRespond("declined")}
          disabled={isSubmitting}
        >
          <XIcon className="size-3.5" />
          Decline
        </Button>
      </div>
    </div>
  );
}

function OutgoingSwapCard({ swap }: { swap: EnrichedSwap }) {
  const cancelSwap = useMutation(api.shiftSwaps.cancelSwap);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await cancelSwap({ swapId: swap._id });
      toast.success("Swap request cancelled");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to cancel swap request");
      }
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Swap request to {swap.targetName}</span>
        </div>
        <Badge variant="secondary" className="text-[10px]">Pending</Badge>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <ShiftInfoBlock shift={swap.requesterShift} label="Your shift" />
        <ArrowRight className="size-4 text-muted-foreground" />
        <ShiftInfoBlock shift={swap.targetShift} label="Their shift" />
      </div>
      {swap.reason && (
        <p className="text-xs text-muted-foreground italic px-1">
          &ldquo;{swap.reason}&rdquo;
        </p>
      )}
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 text-muted-foreground"
        onClick={handleCancel}
        disabled={isCancelling}
      >
        {isCancelling ? <Spinner /> : <Ban className="size-3.5" />}
        Cancel Request
      </Button>
    </div>
  );
}

function ResolvedSwapCard({ swap, type }: { swap: EnrichedSwap; type: "sent" | "received" }) {
  const statusConfig = {
    accepted: {
      icon: <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />,
      label: "Completed",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "border-emerald-500/20 bg-emerald-500/[0.03]",
    },
    declined: {
      icon: <XCircle className="size-3.5 text-rose-600 dark:text-rose-400" />,
      label: "Declined",
      color: "text-rose-600 dark:text-rose-400",
      bg: "border-rose-500/20 bg-rose-500/[0.03]",
    },
    cancelled: {
      icon: <Ban className="size-3.5 text-muted-foreground" />,
      label: "Cancelled",
      color: "text-muted-foreground",
      bg: "border-border bg-muted/20",
    },
    pending: { icon: null, label: "Pending", color: "", bg: "" },
  } as const;

  const config = statusConfig[swap.status];
  const otherName = type === "sent" ? swap.targetName : swap.requesterName;

  return (
    <div className={cn("rounded-xl border p-3 space-y-2 opacity-70", config.bg)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {type === "sent" ? `To ${otherName}` : `From ${otherName}`}
        </span>
        <div className={cn("flex items-center gap-1 text-[10px] font-medium", config.color)}>
          {config.icon}
          {config.label}
        </div>
      </div>
      {swap.requesterShift && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          {format(parseISO(swap.requesterShift.startTime), "MMM d, HH:mm")} –{" "}
          {format(parseISO(swap.requesterShift.endTime), "HH:mm")}
          <ArrowRight className="size-3" />
          {swap.targetShift
            ? `${format(parseISO(swap.targetShift.startTime), "MMM d, HH:mm")} – ${format(parseISO(swap.targetShift.endTime), "HH:mm")}`
            : "—"}
        </div>
      )}
    </div>
  );
}
