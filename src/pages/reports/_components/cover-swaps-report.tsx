import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils.ts";
import {
  ArrowLeftRight,
  ShieldCheck,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Clock,
  XCircle,
  CheckCircle2,
  StickyNote,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs.tsx";
import StatCard from "./stat-card.tsx";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatShiftTime(iso: string | undefined) {
  if (!iso) return "—";
  return format(new Date(iso), "dd MMM yyyy, HH:mm");
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    accepted: { label: "Accepted", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    rejected: { label: "Rejected", className: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
    declined: { label: "Declined", className: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground border-muted" },
    open: { label: "Open", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    swapped: { label: "Swapped", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    claimed: { label: "Claimed", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  };
  const s = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={cn("text-[10px] font-medium capitalize", s.className)}>{s.label}</Badge>;
}

function ShiftInfo({ shift }: { shift: { startTime: string; endTime: string; vehicle?: string; callSign?: string; position?: string } | null }) {
  if (!shift) return <span className="text-xs text-muted-foreground italic">Shift deleted</span>;
  return (
    <div className="text-xs space-y-0.5">
      <p className="font-medium">{formatShiftTime(shift.startTime)} — {format(new Date(shift.endTime), "HH:mm")}</p>
      <p className="text-muted-foreground">
        {[shift.position, shift.vehicle, shift.callSign].filter(Boolean).join(" · ") || "No details"}
      </p>
    </div>
  );
}

// ─── Cover Requests Table ───────────────────────────────────────────────────

function CoverRequestsReport() {
  const data = useQuery(api.coverRequests.getAllForReport);

  if (data === undefined) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>;
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No cover requests yet.</p>;
  }

  return (
    <div className="space-y-2">
      {data.map((req) => (
        <div key={req._id} className="bg-card border rounded-lg p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="size-4 text-blue-500 shrink-0" />
              <span className="text-sm font-medium truncate">{req.requesterName}</span>
              {statusBadge(req.status)}
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {format(new Date(req._creationTime), "dd MMM yyyy")}
            </span>
          </div>

          <ShiftInfo shift={req.shift} />

          {req.reason && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <StickyNote className="size-3 mt-0.5 shrink-0" />
              <span>{req.reason}</span>
            </div>
          )}

          {req.claimedByName && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <UserCheck className="size-3 shrink-0" />
              <span>Covered by {req.claimedByName}</span>
              {req.claimedAt && (
                <span className="text-muted-foreground ml-1">
                  on {format(new Date(req.claimedAt), "dd MMM yyyy, HH:mm")}
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Direct Swaps Table ─────────────────────────────────────────────────────

function DirectSwapsReport() {
  const data = useQuery(api.shiftSwaps.getAllForReport);

  if (data === undefined) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>;
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No direct swap requests yet.</p>;
  }

  return (
    <div className="space-y-2">
      {data.map((swap) => (
        <div key={swap._id} className="bg-card border rounded-lg p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <ArrowLeftRight className="size-4 text-violet-500 shrink-0" />
              <span className="text-sm font-medium truncate">{swap.requesterName}</span>
              <ArrowLeftRight className="size-3 text-muted-foreground" />
              <span className="text-sm font-medium truncate">{swap.targetName}</span>
              {statusBadge(swap.status)}
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {format(new Date(swap._creationTime), "dd MMM yyyy")}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wider mb-0.5">Requester shift</p>
              <ShiftInfo shift={swap.requesterShift} />
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wider mb-0.5">Target shift</p>
              <ShiftInfo shift={swap.targetShift} />
            </div>
          </div>

          {swap.reason && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <StickyNote className="size-3 mt-0.5 shrink-0" />
              <span>{swap.reason}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Swap Board Report ──────────────────────────────────────────────────────

function SwapBoardReport() {
  const data = useQuery(api.swapBoard.getAllPostingsForReport);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (data === undefined) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>;
  }

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No swap board postings yet.</p>;
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {data.map((posting) => {
        const isOpen = expanded.has(posting._id);
        return (
          <div key={posting._id} className="bg-card border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <LayoutGrid className="size-4 text-orange-500 shrink-0" />
                <span className="text-sm font-medium truncate">{posting.posterName}</span>
                {statusBadge(posting.status)}
                {posting.offerCount > 0 && (
                  <button
                    onClick={() => toggleExpand(posting._id)}
                    className="flex items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
                  >
                    {posting.offerCount} offer{posting.offerCount !== 1 ? "s" : ""}
                    {isOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                  </button>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {format(new Date(posting._creationTime), "dd MMM yyyy")}
              </span>
            </div>

            <ShiftInfo shift={posting.shift} />

            {posting.note && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <StickyNote className="size-3 mt-0.5 shrink-0" />
                <span>{posting.note}</span>
              </div>
            )}

            {posting.acceptedOffer && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="size-3 shrink-0" />
                <span>Accepted offer from {posting.acceptedOffer.offererName}</span>
              </div>
            )}

            {isOpen && posting.offers.length > 0 && (
              <div className="ml-4 border-l-2 border-muted pl-3 space-y-2 mt-2">
                {posting.offers.map((offer) => (
                  <div key={offer._id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{offer.offererName}</span>
                      {statusBadge(offer.status)}
                    </div>
                    {offer.shift && <ShiftInfo shift={offer.shift} />}
                    {offer.note && (
                      <p className="text-[10px] text-muted-foreground italic">{offer.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Summary Stats ──────────────────────────────────────────────────────────

function useSummaryStats() {
  const cover = useQuery(api.coverRequests.getAllForReport);
  const swaps = useQuery(api.shiftSwaps.getAllForReport);
  const board = useQuery(api.swapBoard.getAllPostingsForReport);

  if (!cover || !swaps || !board) return null;

  const coverOpen = cover.filter((r) => r.status === "open").length;
  const coverClaimed = cover.filter((r) => r.status === "claimed").length;

  const swapsPending = swaps.filter((s) => s.status === "pending").length;
  const swapsAccepted = swaps.filter((s) => s.status === "accepted").length;

  const boardOpen = board.filter((p) => p.status === "open").length;
  const boardSwapped = board.filter((p) => p.status === "matched").length;

  return {
    totalCover: cover.length,
    coverOpen,
    coverClaimed,
    totalDirectSwaps: swaps.length,
    swapsPending,
    swapsAccepted,
    totalBoardPostings: board.length,
    boardOpen,
    boardSwapped,
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CoverSwapsReport() {
  const stats = useSummaryStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-heading font-bold text-xl">Cover & Swaps</h2>
        <p className="text-muted-foreground text-sm mt-1">
          All shift cover requests, direct swaps, and swap board activity
        </p>
      </div>

      {/* Summary stat cards */}
      {stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Cover Requests"
            value={stats.totalCover}
            subtitle={`${stats.coverOpen} open, ${stats.coverClaimed} claimed`}
            icon={ShieldCheck}
            iconColor="text-blue-500"
          />
          <StatCard
            title="Direct Swaps"
            value={stats.totalDirectSwaps}
            subtitle={`${stats.swapsPending} pending, ${stats.swapsAccepted} accepted`}
            icon={ArrowLeftRight}
            iconColor="text-violet-500"
          />
          <StatCard
            title="Board Postings"
            value={stats.totalBoardPostings}
            subtitle={`${stats.boardOpen} open, ${stats.boardSwapped} matched`}
            icon={LayoutGrid}
            iconColor="text-orange-500"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[130px] rounded-xl" />
          ))}
        </div>
      )}

      {/* Tabs for each category */}
      <Tabs defaultValue="cover" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="cover" className="gap-1.5">
            <ShieldCheck className="size-3.5" />
            Cover Requests
          </TabsTrigger>
          <TabsTrigger value="direct" className="gap-1.5">
            <ArrowLeftRight className="size-3.5" />
            Direct Swaps
          </TabsTrigger>
          <TabsTrigger value="board" className="gap-1.5">
            <LayoutGrid className="size-3.5" />
            Swap Board
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cover" className="mt-4">
          <CoverRequestsReport />
        </TabsContent>
        <TabsContent value="direct" className="mt-4">
          <DirectSwapsReport />
        </TabsContent>
        <TabsContent value="board" className="mt-4">
          <SwapBoardReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
