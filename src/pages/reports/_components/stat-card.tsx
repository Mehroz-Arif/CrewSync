import { cn } from "@/lib/utils.ts";
import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: { value: string; positive: boolean };
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  trend,
}: StatCardProps) {
  return (
    <div className="bg-card border rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          <p className="text-2xl font-heading font-bold mt-1">{value}</p>
        </div>
        <div
          className={cn(
            "size-10 rounded-lg flex items-center justify-center bg-primary/10",
            iconColor.includes("text-") ? iconColor.replace("text-", "bg-").replace(/\/?\d*$/, "/10") : ""
          )}
        >
          <Icon className={cn("size-5", iconColor)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trend.positive ? "text-emerald-600" : "text-rose-500"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
