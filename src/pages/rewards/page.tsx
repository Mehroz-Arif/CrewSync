import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Gift, HandHeart } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import PointsBalanceCard from "./_components/points-balance-card.tsx";
import GiveRewardDialog from "./_components/give-reward-dialog.tsx";
import NominateColleagueDialog from "./_components/nominate-colleague-dialog.tsx";
import NominationsList from "./_components/nominations-list.tsx";
import GiftShop from "./_components/gift-shop.tsx";
import RedemptionsList from "./_components/redemptions-list.tsx";
import Leaderboard from "./_components/leaderboard.tsx";
import RewardFeed from "./_components/reward-feed.tsx";
import { useStaffPreview } from "@/hooks/use-staff-preview.tsx";

type Tab = "rewards" | "gift-shop" | "nominations" | "redemptions";

export default function RewardsPage() {
  const [giveDialogOpen, setGiveDialogOpen] = useState(false);
  const [nominateDialogOpen, setNominateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("rewards");

  const currentUser = useQuery(api.users.getCurrentUser);
  const pendingNominations = useQuery(api.rewardNominations.pendingCount);
  const pendingRedemptions = useQuery(api.giftShop.pendingRedemptionCount);
  const { isPreviewingAsStaff } = useStaffPreview();

  const isAdmin = currentUser?.role === "admin" && !isPreviewingAsStaff;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "rewards", label: "Rewards" },
    { id: "gift-shop", label: "Gift Shop" },
    {
      id: "nominations",
      label: "Nominations",
      badge: isAdmin && pendingNominations ? pendingNominations : undefined,
    },
    {
      id: "redemptions",
      label: "Redemptions",
      badge: isAdmin && pendingRedemptions ? pendingRedemptions : undefined,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl">
            Rewards
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Recognize and celebrate your teammates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setNominateDialogOpen(true)}
          >
            <HandHeart className="size-4 mr-1.5" />
            Nominate Colleague
          </Button>
          {isAdmin && (
            <Button onClick={() => setGiveDialogOpen(true)}>
              <Gift className="size-4 mr-1.5" />
              Give Reward
            </Button>
          )}
        </div>
        <GiveRewardDialog open={giveDialogOpen} onOpenChange={setGiveDialogOpen} />
        <NominateColleagueDialog open={nominateDialogOpen} onOpenChange={setNominateDialogOpen} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0",
              activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <Badge variant="destructive" className="size-5 p-0 justify-center text-[10px]">
                {tab.badge}
              </Badge>
            )}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "rewards" && (
        <>
          <PointsBalanceCard />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Leaderboard />
            </div>
            <div className="lg:col-span-2">
              <RewardFeed />
            </div>
          </div>
        </>
      )}

      {activeTab === "gift-shop" && <GiftShop isAdmin={isAdmin} />}

      {activeTab === "nominations" && <NominationsList isAdmin={isAdmin} />}

      {activeTab === "redemptions" && <RedemptionsList isAdmin={isAdmin} />}
    </div>
  );
}
