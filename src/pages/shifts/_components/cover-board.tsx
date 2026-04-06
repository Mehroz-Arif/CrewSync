import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format, parseISO } from "date-fns";
import {
  ShieldCheck,
  Clock,
  Truck,
  Briefcase,
  HandHelping,
  Ban,
  CheckCircle2,
  XCircle,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
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

/** Open cover requests from other staff that match current user's qualifications */
export function CoverRequestBoard() {
  const openRequests = useQuery(api.coverRequests.getOpenRequests);

  if (openRequests === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (openRequests.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheck />
          </EmptyMedia>
          <EmptyTitle>No cover requests</EmptyTitle>
          <EmptyDescription>
            No colleagues are currently requesting shift cover for your qualifications
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {openRequests.map((request) => (
        <CoverRequestCard key={request._id} request={request} />
      ))}
    </div>
  );
}

type OpenCoverRequest = {
  _id: string;
  _creationTime: number;
  reason?: string;
  requesterName: string;
  shift: {
    startTime: string;
    endTime: string;
    vehicle: string;
    callSign?: string;
    position?: string;
  } | null;
};

function CoverRequestCard({ request }: { request: OpenCoverRequest }) {
  const claimRequest = useMutation(api.coverRequests.claimRequest);
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaim = async () => {
    setIsClaiming(true);
    try {
      await claimRequest({ requestId: request._id as Parameters<typeof claimRequest>[0]["requestId"] });
      toast.success("You've claimed this shift — it's now assigned to you");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to claim cover request");
      }
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-semibold">{request.requesterName} needs cover</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(request._creationTime), "MMM d, HH:mm")}
        </span>
      </div>

      {request.shift && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Clock className="size-3 text-primary" />
            {format(parseISO(request.shift.startTime), "EEE, MMM d")} ·{" "}
            {format(parseISO(request.shift.startTime), "HH:mm")} –{" "}
            {format(parseISO(request.shift.endTime), "HH:mm")}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {(request.shift.callSign || request.shift.vehicle) && (
              <span className="flex items-center gap-1">
                <Truck className="size-3" />
                {request.shift.callSign ? `${request.shift.callSign} · ` : ""}
                {request.shift.vehicle}
              </span>
            )}
            {request.shift.position && (
              <span className="flex items-center gap-1">
                <Briefcase className="size-3" />
                {request.shift.position}
              </span>
            )}
          </div>
        </div>
      )}

      {request.reason && (
        <p className="text-xs text-muted-foreground italic px-1">
          &ldquo;{request.reason}&rdquo;
        </p>
      )}

      <Button
        size="sm"
        className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
        onClick={handleClaim}
        disabled={isClaiming}
      >
        {isClaiming ? <Spinner /> : <HandHelping className="size-3.5" />}
        I&apos;ll Cover This Shift
      </Button>
    </div>
  );
}

/** Current user's own cover requests and their status */
export function MyCoverRequests() {
  const myRequests = useQuery(api.coverRequests.getMyRequests);

  if (myRequests === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (myRequests.length === 0) {
    return null;
  }

  const open = myRequests.filter((r) => r.status === "open");
  const resolved = myRequests.filter((r) => r.status !== "open");

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Your Cover Requests
      </h3>

      {open.map((request) => (
        <OpenRequestCard key={request._id} request={request} />
      ))}

      {resolved.slice(0, 5).map((request) => (
        <ResolvedRequestCard key={request._id} request={request} />
      ))}
    </div>
  );
}

type MyCoverRequest = {
  _id: string;
  _creationTime: number;
  status: "open" | "claimed" | "cancelled";
  reason?: string;
  claimedByName?: string;
  claimedAt?: string;
  shift: {
    startTime: string;
    endTime: string;
    vehicle: string;
    callSign?: string;
    position?: string;
  } | null;
};

function OpenRequestCard({ request }: { request: MyCoverRequest }) {
  const cancelRequest = useMutation(api.coverRequests.cancelRequest);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await cancelRequest({ requestId: request._id as Parameters<typeof cancelRequest>[0]["requestId"] });
      toast.success("Cover request cancelled");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to cancel cover request");
      }
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-semibold">Waiting for cover</span>
        </div>
        <Badge variant="secondary" className="text-[10px]">Open</Badge>
      </div>

      {request.shift && (
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Clock className="size-3 text-primary" />
          {format(parseISO(request.shift.startTime), "EEE, MMM d")} ·{" "}
          {format(parseISO(request.shift.startTime), "HH:mm")} –{" "}
          {format(parseISO(request.shift.endTime), "HH:mm")}
        </div>
      )}

      {request.reason && (
        <p className="text-xs text-muted-foreground italic px-1">
          &ldquo;{request.reason}&rdquo;
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

function ResolvedRequestCard({ request }: { request: MyCoverRequest }) {
  const statusConfig = {
    claimed: {
      icon: <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />,
      label: "Covered",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "border-emerald-500/20 bg-emerald-500/[0.03]",
    },
    cancelled: {
      icon: <XCircle className="size-3.5 text-muted-foreground" />,
      label: "Cancelled",
      color: "text-muted-foreground",
      bg: "border-border bg-muted/20",
    },
    open: { icon: null, label: "Open", color: "", bg: "" },
  } as const;

  const config = statusConfig[request.status];

  return (
    <div className={cn("rounded-xl border p-3 space-y-2 opacity-70", config.bg)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          {request.shift
            ? `${format(parseISO(request.shift.startTime), "MMM d, HH:mm")} – ${format(parseISO(request.shift.endTime), "HH:mm")}`
            : "Shift deleted"}
        </div>
        <div className={cn("flex items-center gap-1 text-[10px] font-medium", config.color)}>
          {config.icon}
          {config.label}
        </div>
      </div>
      {request.status === "claimed" && request.claimedByName && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserCheck className="size-3 text-emerald-600 dark:text-emerald-400" />
          Covered by {request.claimedByName}
        </div>
      )}
    </div>
  );
}
