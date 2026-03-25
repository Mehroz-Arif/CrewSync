import { Card, CardContent } from "@/components/ui/card.tsx";
import { Building2, Users, UserPlus, ShieldCheck } from "lucide-react";

type PlatformStatsProps = {
  stats: {
    totalUsers: number;
    totalOrganizations: number;
    usersInOrgs: number;
    unassignedUsers: number;
    pendingInvites: number;
    superAdminCount: number;
  };
};

const STAT_CARDS = [
  {
    label: "Organizations",
    key: "totalOrganizations" as const,
    icon: Building2,
    color: "text-primary bg-primary/10",
  },
  {
    label: "Total Users",
    key: "totalUsers" as const,
    icon: Users,
    color: "text-emerald-600 bg-emerald-500/10",
  },
  {
    label: "Unassigned Users",
    key: "unassignedUsers" as const,
    icon: UserPlus,
    color: "text-amber-600 bg-amber-500/10",
  },
  {
    label: "Super Admins",
    key: "superAdminCount" as const,
    icon: ShieldCheck,
    color: "text-violet-600 bg-violet-500/10",
  },
];

export default function PlatformStatsCards({ stats }: PlatformStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {STAT_CARDS.map((card) => (
        <Card key={card.key}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={`size-10 rounded-lg flex items-center justify-center ${card.color}`}
              >
                <card.icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">
                  {stats[card.key]}
                </p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
