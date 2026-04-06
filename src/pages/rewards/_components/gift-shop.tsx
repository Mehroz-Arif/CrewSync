import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import {
  ShoppingBag,
  CreditCard,
  Calendar,
  Shirt,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Package,
  Coins,
} from "lucide-react";
import ManageGiftDialog from "./manage-gift-dialog.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const CATEGORY_ICONS: Record<string, typeof CreditCard> = {
  voucher: CreditCard,
  time_off: Calendar,
  merchandise: Shirt,
  experience: Sparkles,
};

const CATEGORY_COLORS: Record<string, string> = {
  voucher: "text-emerald-500 bg-emerald-500/10",
  time_off: "text-blue-500 bg-blue-500/10",
  merchandise: "text-purple-500 bg-purple-500/10",
  experience: "text-amber-500 bg-amber-500/10",
};

const CATEGORY_LABELS: Record<string, string> = {
  voucher: "Gift Card",
  time_off: "Time Off",
  merchandise: "Merchandise",
  experience: "Experience",
};

type Gift = {
  _id: Id<"rewardGifts">;
  name: string;
  description?: string;
  pointsCost: number;
  category: "voucher" | "time_off" | "merchandise" | "experience";
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage">;
  stock?: number;
  active: boolean;
};

export default function GiftShop({ isAdmin }: { isAdmin: boolean }) {
  const gifts = useQuery(api.giftShop.listGifts, {
    includeInactive: isAdmin,
  });
  const balance = useQuery(api.giftShop.getAvailableBalance);
  const redeemGift = useMutation(api.giftShop.redeemGift);
  const deleteGift = useMutation(api.giftShop.deleteGift);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editGift, setEditGift] = useState<Gift | null>(null);
  const [confirmRedeem, setConfirmRedeem] = useState<Gift | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Gift | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  if (gifts === undefined || balance === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const handleRedeem = async () => {
    if (!confirmRedeem) return;
    setIsRedeeming(true);
    try {
      await redeemGift({ giftId: confirmRedeem._id });
      toast.success(`You've redeemed "${confirmRedeem.name}"! An admin will fulfill your request.`);
      setConfirmRedeem(null);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to redeem gift");
      }
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteGift({ giftId: confirmDelete._id });
      toast.success("Gift removed from shop");
      setConfirmDelete(null);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to delete gift");
      }
    }
  };

  const activeGifts = gifts.filter((g) => g.active);
  const inactiveGifts = gifts.filter((g) => !g.active);

  return (
    <div className="space-y-6">
      {/* Balance banner */}
      <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Coins className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Available Balance</p>
            <p className="text-2xl font-bold font-heading">{balance.available} <span className="text-sm font-normal text-muted-foreground">pts</span></p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddDialogOpen(true)} size="sm">
            <Plus className="size-4 mr-1.5" />
            Add Gift
          </Button>
        )}
      </div>

      {/* Gift grid */}
      {activeGifts.length === 0 && inactiveGifts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShoppingBag />
            </EmptyMedia>
            <EmptyTitle>No gifts available yet</EmptyTitle>
            <EmptyDescription>
              {isAdmin
                ? "Add gifts to the shop so your team can redeem their points."
                : "Check back soon — your admin will add gifts to the shop."}
            </EmptyDescription>
          </EmptyHeader>
          {isAdmin && (
            <EmptyContent>
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="size-4 mr-1.5" />
                Add First Gift
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          {activeGifts.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeGifts.map((gift) => (
                <GiftCard
                  key={gift._id}
                  gift={gift}
                  balance={balance.available}
                  isAdmin={isAdmin}
                  onRedeem={() => setConfirmRedeem(gift)}
                  onEdit={() => setEditGift(gift)}
                  onDelete={() => setConfirmDelete(gift)}
                />
              ))}
            </div>
          )}

          {isAdmin && inactiveGifts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Inactive Gifts</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                {inactiveGifts.map((gift) => (
                  <GiftCard
                    key={gift._id}
                    gift={gift}
                    balance={balance.available}
                    isAdmin={isAdmin}
                    onRedeem={() => {}}
                    onEdit={() => setEditGift(gift)}
                    onDelete={() => setConfirmDelete(gift)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <ManageGiftDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
      {editGift && (
        <ManageGiftDialog
          open={!!editGift}
          onOpenChange={(val) => { if (!val) setEditGift(null); }}
          editGift={editGift}
        />
      )}

      {/* Redeem confirmation */}
      <AlertDialog open={!!confirmRedeem} onOpenChange={(val) => { if (!val) setConfirmRedeem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redeem Gift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to redeem <span className="font-semibold text-foreground">{confirmRedeem?.name}</span> for{" "}
              <span className="font-semibold text-foreground">{confirmRedeem?.pointsCost} points</span>?
              This will deduct from your balance and an admin will fulfill your request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRedeeming}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRedeem} disabled={isRedeeming}>
              {isRedeeming ? "Redeeming..." : "Confirm Redeem"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(val) => { if (!val) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gift</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-semibold text-foreground">{confirmDelete?.name}</span> from the shop? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GiftCard({
  gift,
  balance,
  isAdmin,
  onRedeem,
  onEdit,
  onDelete,
}: {
  gift: Gift;
  balance: number;
  isAdmin: boolean;
  onRedeem: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = CATEGORY_ICONS[gift.category] ?? Package;
  const colorClasses = CATEGORY_COLORS[gift.category] ?? "text-muted-foreground bg-muted";
  const label = CATEGORY_LABELS[gift.category] ?? gift.category;
  const canAfford = balance >= gift.pointsCost;
  const outOfStock = gift.stock !== undefined && gift.stock <= 0;

  return (
    <Card className="relative overflow-hidden group">
      <CardContent className="py-5 flex flex-col gap-3">
        {/* Category icon & badge */}
        <div className="flex items-start justify-between">
          <div className={cn("size-10 rounded-lg flex items-center justify-center", colorClasses)}>
            <Icon className="size-5" />
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">{label}</Badge>
            {!gift.active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
          </div>
        </div>

        {/* Name & description */}
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">{gift.name}</h3>
          {gift.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {gift.description}
            </p>
          )}
        </div>

        {/* Points & stock */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-center gap-1.5">
            <Coins className="size-4 text-primary" />
            <span className="font-bold text-lg">{gift.pointsCost}</span>
            <span className="text-xs text-muted-foreground">pts</span>
          </div>
          {gift.stock !== undefined && (
            <span className={cn("text-xs", outOfStock ? "text-destructive font-medium" : "text-muted-foreground")}>
              {outOfStock ? "Out of stock" : `${gift.stock} left`}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {gift.active && !isAdmin && (
            <Button
              size="sm"
              className="flex-1"
              disabled={!canAfford || outOfStock}
              onClick={onRedeem}
            >
              {outOfStock ? "Out of Stock" : !canAfford ? "Not Enough Points" : "Redeem"}
            </Button>
          )}
          {isAdmin && (
            <>
              <Button size="sm" variant="secondary" className="flex-1" onClick={onEdit}>
                <Pencil className="size-3.5 mr-1" />
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete}>
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
