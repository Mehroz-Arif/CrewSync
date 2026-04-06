import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
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
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Coins,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type Redemption = {
  _id: Id<"giftRedemptions">;
  _creationTime: number;
  userName: string;
  giftName: string;
  giftCategory?: string;
  pointsSpent: number;
  status: string;
  fulfilledByName?: string;
  fulfilledAt?: string;
  adminNote?: string;
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: typeof Clock }> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  fulfilled: { label: "Fulfilled", variant: "default", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

export default function RedemptionsList({ isAdmin }: { isAdmin: boolean }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const redemptions = useQuery(api.giftShop.listRedemptions, {
    statusFilter: statusFilter === "all" ? undefined : statusFilter,
  });

  if (redemptions === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {redemptions.length} redemption{redemptions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {redemptions.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package />
            </EmptyMedia>
            <EmptyTitle>No redemptions yet</EmptyTitle>
            <EmptyDescription>
              {isAdmin
                ? "When team members redeem gifts, their requests will appear here."
                : "Redeem your points for gifts in the Gift Shop tab!"}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {redemptions.map((r) => (
            <RedemptionCard key={r._id} redemption={r} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  );
}

function RedemptionCard({
  redemption,
  isAdmin,
}: {
  redemption: Redemption;
  isAdmin: boolean;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const statusCfg = STATUS_CONFIG[redemption.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const timeAgo = formatDistanceToNow(new Date(redemption._creationTime), { addSuffix: true });

  return (
    <>
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-2.5">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{redemption.giftName}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? `Requested by ${redemption.userName}` : "Your request"} · {timeAgo}
                </p>
              </div>
              <Badge variant={statusCfg.variant} className="shrink-0 gap-1">
                <StatusIcon className="size-3" />
                {statusCfg.label}
              </Badge>
            </div>

            {/* Points */}
            <div className="flex items-center gap-1.5">
              <Coins className="size-3.5 text-primary" />
              <span className="text-sm font-medium">{redemption.pointsSpent} pts</span>
            </div>

            {/* Admin note */}
            {redemption.adminNote && (
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs">
                <span className="font-medium">Note:</span> {redemption.adminNote}
                {redemption.fulfilledByName && (
                  <span className="text-muted-foreground"> — {redemption.fulfilledByName}</span>
                )}
              </div>
            )}

            {/* Admin action */}
            {isAdmin && redemption.status === "pending" && (
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={() => setReviewOpen(true)}>
                  Process
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {isAdmin && redemption.status === "pending" && (
        <ProcessRedemptionDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          redemption={redemption}
        />
      )}
    </>
  );
}

function ProcessRedemptionDialog({
  open,
  onOpenChange,
  redemption,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redemption: Redemption;
}) {
  const fulfill = useMutation(api.giftShop.fulfillRedemption);
  const cancel = useMutation(api.giftShop.cancelRedemption);
  const [adminNote, setAdminNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFulfill = async () => {
    setIsLoading(true);
    try {
      await fulfill({
        redemptionId: redemption._id,
        adminNote: adminNote.trim() || undefined,
      });
      toast.success(`Gift fulfilled for ${redemption.userName}!`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to fulfill redemption");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      await cancel({
        redemptionId: redemption._id,
        adminNote: adminNote.trim() || undefined,
      });
      toast.success("Redemption cancelled. Points have been refunded.");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to cancel redemption");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Process Redemption</DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">{redemption.userName}</span> redeemed{" "}
            <span className="font-semibold text-foreground">{redemption.giftName}</span> for{" "}
            {redemption.pointsSpent} pts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              placeholder="Add a note (e.g. delivery details, reason for cancellation)..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              disabled={isLoading}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel & Refund
          </Button>
          <Button onClick={handleFulfill} disabled={isLoading}>
            {isLoading ? "Processing..." : "Mark as Fulfilled"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
