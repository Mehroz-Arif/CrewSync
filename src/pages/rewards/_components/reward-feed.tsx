import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { ArrowRight, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getCategoryConfig } from "../_lib/categories.ts";

export default function RewardFeed() {
  const activity = useQuery(api.rewards.getRecentActivity);

  if (activity === undefined) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Sparkles />
              </EmptyMedia>
              <EmptyTitle>No activity yet</EmptyTitle>
              <EmptyDescription>
                Rewards will appear here as they are given
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
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        <div className="divide-y">
          {activity.map((item) => {
            const cat = getCategoryConfig(item.category);
            const CatIcon = cat?.icon;
            return (
              <div key={item._id} className="px-6 py-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{item.fromName}</span>
                  <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                  <span className="font-medium">{item.toName}</span>
                  {item.points != null && item.points > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-auto text-xs tabular-nums shrink-0"
                    >
                      +{item.points} pts
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {item.message}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {CatIcon && cat && (
                    <div className={`flex items-center gap-1 ${cat.color}`}>
                      <CatIcon className="size-3" />
                      <span>{cat.label}</span>
                    </div>
                  )}
                  <span>{"·"}</span>
                  <span>
                    {formatDistanceToNow(new Date(item._creationTime), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
