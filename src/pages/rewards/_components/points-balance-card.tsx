import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Trophy } from "lucide-react";

export default function PointsBalanceCard() {
  const balance = useQuery(api.rewards.getMyBalance);

  if (balance === undefined) {
    return <Skeleton className="h-32 w-full rounded-xl" />;
  }

  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 border-0">
      <div className="absolute top-0 right-0 -mt-6 -mr-6 size-36 rounded-full bg-white/5" />
      <div className="absolute bottom-0 left-0 -mb-4 -ml-4 size-24 rounded-full bg-white/5" />
      <CardContent className="relative p-6 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">Your Reward Points</p>
            <p className="text-4xl font-heading font-bold mt-1 tabular-nums">
              {balance}
            </p>
            <p className="text-xs opacity-60 mt-1">Keep up the great work!</p>
          </div>
          <Trophy className="size-14 opacity-20" />
        </div>
      </CardContent>
    </Card>
  );
}
