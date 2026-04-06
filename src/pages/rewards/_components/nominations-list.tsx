import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  HandHeart,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { getCategoryConfig, POINT_OPTIONS } from "../_lib/categories.ts";
import { formatDistanceToNow } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Nomination = {
  _id: Id<"rewardNominations">;
  _creationTime: number;
  nominatedByName: string;
  nomineeName: string;
  reason: string;
  category: string;
  suggestedPoints?: number;
  status: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNote?: string;
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: typeof Clock }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
};

export default function NominationsList({ isAdmin }: { isAdmin: boolean }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const nominations = useQuery(api.rewardNominations.list, {
    statusFilter: statusFilter === "all" ? undefined : statusFilter,
  });

  if (nominations === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {nominations.length} nomination{nominations.length !== 1 ? "s" : ""}
        </span>
      </div>

      {nominations.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HandHeart />
            </EmptyMedia>
            <EmptyTitle>No nominations yet</EmptyTitle>
            <EmptyDescription>
              {isAdmin
                ? "Nominations from team members will appear here for your review."
                : "Nominate a colleague to get started!"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {nominations.map((n) => (
            <NominationCard key={n._id} nomination={n} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}

function NominationCard({
  nomination,
  isAdmin,
}: {
  nomination: Nomination;
  isAdmin: boolean;
}) {
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const catConfig = getCategoryConfig(nomination.category);
  const statusCfg = STATUS_CONFIG[nomination.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const timeAgo = formatDistanceToNow(new Date(nomination._creationTime), { addSuffix: true });

  return (
    <>
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="font-medium truncate">
                  {nomination.nominatedByName}
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                <span className="font-semibold truncate">
                  {nomination.nomineeName}
                </span>
              </div>
              <Badge variant={statusCfg.variant} className="shrink-0 gap-1">
                <StatusIcon className="size-3" />
                {statusCfg.label}
              </Badge>
            </div>

            {/* Category & points */}
            <div className="flex items-center gap-2 flex-wrap">
              {catConfig && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1",
                    catConfig.bgColor,
                    catConfig.color
                  )}
                >
                  <catConfig.icon className="size-3" />
                  {catConfig.label}
                </span>
              )}
              {nomination.suggestedPoints && (
                <span className="text-xs text-muted-foreground">
                  {nomination.suggestedPoints} pts suggested
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {timeAgo}
              </span>
            </div>

            {/* Reason */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {nomination.reason}
            </p>

            {/* Review note */}
            {nomination.reviewNote && (
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs">
                <span className="font-medium">Admin note:</span>{" "}
                {nomination.reviewNote}
                {nomination.reviewedByName && (
                  <span className="text-muted-foreground">
                    {" "}— {nomination.reviewedByName}
                  </span>
                )}
              </div>
            )}

            {/* Admin actions */}
            {isAdmin && nomination.status === "pending" && (
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  onClick={() => setReviewDialogOpen(true)}
                >
                  Review
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin && nomination.status === "pending" && (
        <ReviewDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          nomination={nomination}
        />
      )}
    </>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  nomination,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nomination: Nomination;
}) {
  const approve = useMutation(api.rewardNominations.approve);
  const reject = useMutation(api.rewardNominations.reject);
  const [points, setPoints] = useState<number | null>(nomination.suggestedPoints ?? null);
  const [reviewNote, setReviewNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const catConfig = getCategoryConfig(nomination.category);

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await approve({
        nominationId: nomination._id,
        points: points ?? undefined,
        reviewNote: reviewNote.trim() || undefined,
      });
      toast.success(`Nomination approved! Reward sent to ${nomination.nomineeName}.`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to approve nomination");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await reject({
        nominationId: nomination._id,
        reviewNote: reviewNote.trim() || undefined,
      });
      toast.success("Nomination rejected.");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to reject nomination");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Nomination</DialogTitle>
          <DialogDescription>
            {nomination.nominatedByName} nominated{" "}
            <span className="font-semibold text-foreground">{nomination.nomineeName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded-lg border p-3 space-y-2">
            {catConfig && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1",
                  catConfig.bgColor,
                  catConfig.color
                )}
              >
                <catConfig.icon className="size-3" />
                {catConfig.label}
              </span>
            )}
            <p className="text-sm">{nomination.reason}</p>
          </div>

          {/* Points override */}
          <div className="space-y-2">
            <Label>
              Award Points{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="flex gap-2">
              {POINT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPoints(points === opt ? null : opt)}
                  disabled={isLoading}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors",
                    points === opt
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Review note */}
          <div className="space-y-2">
            <Label>
              Note{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              placeholder="Add a note about your decision..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              disabled={isLoading}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isLoading}
            className="gap-1.5"
          >
            <ThumbsDown className="size-4" />
            Reject
          </Button>
          <Button onClick={handleApprove} disabled={isLoading} className="gap-1.5">
            <ThumbsUp className="size-4" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
