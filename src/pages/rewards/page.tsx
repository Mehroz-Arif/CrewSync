import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Gift } from "lucide-react";
import PointsBalanceCard from "./_components/points-balance-card.tsx";
import GiveRewardDialog from "./_components/give-reward-dialog.tsx";
import Leaderboard from "./_components/leaderboard.tsx";
import RewardFeed from "./_components/reward-feed.tsx";

export default function RewardsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

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
        <Button onClick={() => setDialogOpen(true)}>
          <Gift className="size-4 mr-1.5" />
          Give Reward
        </Button>
        <GiveRewardDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>

      {/* Points balance */}
      <PointsBalanceCard />

      {/* Leaderboard + Activity grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Leaderboard />
        </div>
        <div className="lg:col-span-2">
          <RewardFeed />
        </div>
      </div>
    </div>
  );
}
