import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { Crown, Medal, Award } from "lucide-react";

const RANK_STYLES = [
  { icon: Crown, color: "text-amber-500", bg: "bg-amber-500/10" },
  { icon: Medal, color: "text-gray-400", bg: "bg-gray-400/10" },
  { icon: Award, color: "text-orange-500", bg: "bg-orange-500/10" },
];

export default function Leaderboard() {
  const leaderboard = useQuery(api.rewards.getLeaderboard);

  if (leaderboard === undefined) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  if (leaderboard.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Crown />
              </EmptyMedia>
              <EmptyTitle>No rewards yet</EmptyTitle>
              <EmptyDescription>
                Be the first to recognize a teammate
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leaderboard</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        <div className="divide-y">
          {leaderboard.map((entry, i) => {
            const rankStyle = i < 3 ? RANK_STYLES[i] : null;
            return (
              <div
                key={entry.userId}
                className="flex items-center gap-3 px-6 py-3"
              >
                {rankStyle ? (
                  <div
                    className={`size-8 rounded-full ${rankStyle.bg} flex items-center justify-center shrink-0`}
                  >
                    <rankStyle.icon
                      className={`size-4 ${rankStyle.color}`}
                    />
                  </div>
                ) : (
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                    {i + 1}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.name}</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-primary">
                  {entry.points} pts
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
