import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Users, FileText, Megaphone, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";

const STAT_CONFIG = [
  {
    key: "totalUsers" as const,
    label: "Team Members",
    icon: Users,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    key: "totalPosts" as const,
    label: "Posts",
    icon: FileText,
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    key: "announcements" as const,
    label: "Announcements",
    icon: Megaphone,
    color: "text-chart-5",
    bgColor: "bg-chart-5/10",
  },
  {
    key: "shoutouts" as const,
    label: "Shoutouts",
    icon: Sparkles,
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
  },
];

export default function StatsCards() {
  const stats = useQuery(api.posts.getStats);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {STAT_CONFIG.map((stat) => (
        <div
          key={stat.key}
          className="bg-card border rounded-xl p-4 flex items-center gap-4"
        >
          <div
            className={`size-11 rounded-lg ${stat.bgColor} flex items-center justify-center shrink-0`}
          >
            <stat.icon className={`size-5 ${stat.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-heading font-bold tabular-nums">
              {stats[stat.key]}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {stat.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
