import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { format } from "date-fns";
import {
  Trophy,
  Star,
  Heart,
  Rocket,
  Gem,
  Gift,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

const CATEGORY_LABELS: Record<string, string> = {
  "great-work": "Great Work",
  "team-player": "Team Player",
  "above-and-beyond": "Above & Beyond",
  "customer-hero": "Customer Hero",
  innovation: "Innovation",
};

const BADGE_ICONS: Record<string, typeof Star> = {
  star: Star,
  heart: Heart,
  trophy: Trophy,
  rocket: Rocket,
  gem: Gem,
};

const BADGE_COLORS: Record<string, string> = {
  star: "text-amber-500",
  heart: "text-rose-500",
  trophy: "text-yellow-600",
  rocket: "text-blue-500",
  gem: "text-violet-500",
};

type ProfileRewardsSectionProps = {
  userId: Id<"users">;
};

export default function ProfileRewardsSection({ userId }: ProfileRewardsSectionProps) {
  const summary = useQuery(api.rewards.getUserRewardsSummary, { userId });

  if (summary === undefined) {
    return <Skeleton className="h-48 rounded-xl" />;
  }

  const hasAnyActivity =
    summary.rewardsReceivedCount > 0 ||
    summary.rewardsGivenCount > 0 ||
    summary.recognitionsCount > 0;

  if (!hasAnyActivity) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4 text-amber-500" />
            Rewards & Recognition
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No rewards or recognitions yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="size-4 text-amber-500" />
          Rewards & Recognition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatPill
            icon={ArrowDown}
            iconColor="text-emerald-500"
            label="Points received"
            value={summary.totalPointsReceived.toLocaleString()}
          />
          <StatPill
            icon={ArrowUp}
            iconColor="text-blue-500"
            label="Points given"
            value={summary.totalPointsGiven.toLocaleString()}
          />
          <StatPill
            icon={Gift}
            iconColor="text-violet-500"
            label="Rewards received"
            value={String(summary.rewardsReceivedCount)}
          />
          <StatPill
            icon={Star}
            iconColor="text-amber-500"
            label="Recognitions"
            value={String(summary.recognitionsCount)}
          />
        </div>

        {/* Category breakdown */}
        {summary.categoryBreakdown.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Reward categories
            </p>
            <div className="flex flex-wrap gap-1.5">
              {summary.categoryBreakdown.map((c) => (
                <Badge key={c.category} variant="secondary" className="text-xs gap-1">
                  {CATEGORY_LABELS[c.category] ?? c.category}
                  <span className="font-bold">{c.count}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Recent rewards */}
        {summary.recentReceived.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Recent rewards
            </p>
            <div className="space-y-2">
              {summary.recentReceived.map((r) => (
                <div
                  key={r._id}
                  className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5"
                >
                  <Trophy className="size-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{r.fromName}</span>
                      {r.points !== undefined && r.points !== null && (
                        <Badge variant="secondary" className="text-[10px]">
                          +{r.points} pts
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {CATEGORY_LABELS[r.category] ?? r.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {r.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(r._creationTime), "dd MMM yyyy")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent recognitions */}
        {summary.recentRecognitions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Recognitions
            </p>
            <div className="space-y-2">
              {summary.recentRecognitions.map((r) => {
                const BadgeIcon = BADGE_ICONS[r.badge] ?? Star;
                const badgeColor = BADGE_COLORS[r.badge] ?? "text-amber-500";
                return (
                  <div
                    key={r._id}
                    className="flex items-start gap-3 rounded-lg bg-muted/50 px-3 py-2.5"
                  >
                    <BadgeIcon className={`size-4 mt-0.5 shrink-0 ${badgeColor}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {r.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        From {r.givenByName} — {format(new Date(r._creationTime), "dd MMM yyyy")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatPill({
  icon: Icon,
  iconColor,
  label,
  value,
}: {
  icon: typeof Star;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2">
      <div className="size-7 rounded-md bg-background flex items-center justify-center shrink-0">
        <Icon className={`size-3.5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold font-heading leading-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}
