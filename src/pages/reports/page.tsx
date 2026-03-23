import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import {
  Users,
  CalendarClock,
  MessageSquareText,
  Trophy,
  CalendarDays,
  FolderOpen,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useStaffPreview } from "@/hooks/use-staff-preview.tsx";
import StatCard from "./_components/stat-card.tsx";
import { BarChartCard, PieChartCard, RankingListCard } from "./_components/charts.tsx";

function ReportsContent() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const { isPreviewingAsStaff } = useStaffPreview();
  const isAdmin = currentUser?.role === "admin" && !isPreviewingAsStaff;

  const stats = useQuery(api.analytics.getDashboardStats, isAdmin ? {} : "skip");

  // Not admin — show access denied
  if (currentUser && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="size-14 rounded-xl bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="size-7 text-destructive" />
        </div>
        <h2 className="font-heading font-bold text-xl">Admin Access Required</h2>
        <p className="text-muted-foreground text-sm text-center max-w-sm">
          Reports and analytics are only available to administrators.
        </p>
      </div>
    );
  }

  // Loading
  if (currentUser === undefined || stats === undefined) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[130px] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading font-bold text-2xl md:text-3xl">
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overview of team activity, engagement, and performance
        </p>
      </div>

      {/* Top-level stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Team Members"
          value={stats.team.totalStaff}
          subtitle={`${stats.team.adminCount} admins, ${stats.team.memberCount} members`}
          icon={Users}
          iconColor="text-primary"
        />
        <StatCard
          title="Total Shifts"
          value={stats.shifts.totalShifts}
          subtitle={`${stats.shifts.publishedShifts} published`}
          icon={CalendarClock}
          iconColor="text-blue-500"
        />
        <StatCard
          title="Feedback"
          value={stats.feedback.totalFeedback}
          subtitle={`${stats.feedback.newFeedback} new, ${stats.feedback.publishedFeedback} published`}
          icon={MessageSquareText}
          iconColor="text-violet-500"
        />
        <StatCard
          title="Rewards Given"
          value={stats.rewards.totalRewards}
          subtitle={`${stats.rewards.totalPoints.toLocaleString()} total points`}
          icon={Trophy}
          iconColor="text-amber-500"
        />
      </div>

      {/* Charts row 1: Shifts + Posts over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChartCard
          title="Shifts by Month"
          subtitle="Last 6 months"
          data={stats.shifts.shiftsByMonth}
          barColor="oklch(0.45 0.18 260)"
          emptyMessage="No shift data yet"
        />
        <BarChartCard
          title="Posts by Month"
          subtitle="Last 6 months"
          data={stats.posts.postsByMonth}
          barColor="oklch(0.68 0.16 180)"
          emptyMessage="No posts yet"
        />
      </div>

      {/* Charts row 2: Pie charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <PieChartCard
          title="Feedback by Category"
          data={stats.feedback.feedbackByCategory}
          emptyMessage="No feedback submitted yet"
        />
        <PieChartCard
          title="Post Categories"
          data={stats.posts.postsByCategory}
          emptyMessage="No posts yet"
        />
        <PieChartCard
          title="Event Types"
          data={stats.events.eventsByType}
          emptyMessage="No events created yet"
        />
      </div>

      {/* Bottom row: Rankings + additional stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <RankingListCard
          title="Top Recognised Team Members"
          subtitle="Most rewards received"
          data={stats.rewards.topRecognized}
          emptyMessage="No rewards given yet"
        />
        <RankingListCard
          title="Team by Department"
          subtitle="Staff distribution"
          data={stats.team.departmentBreakdown}
        />
        <div className="space-y-4">
          {/* Feedback status breakdown */}
          <div className="bg-card border rounded-xl p-5 space-y-3">
            <h3 className="font-heading font-semibold text-sm">Feedback Status</h3>
            <div className="space-y-2">
              {stats.feedback.feedbackByStatus.map((item) => {
                const total = stats.feedback.totalFeedback || 1;
                const pct = Math.round((item.count / total) * 100);
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {stats.feedback.feedbackByStatus.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  No feedback yet
                </p>
              )}
            </div>
          </div>

          {/* Quick numbers */}
          <div className="bg-card border rounded-xl p-5 space-y-3">
            <h3 className="font-heading font-semibold text-sm">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CalendarDays className="size-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-lg font-bold font-heading leading-tight">
                    {stats.events.totalEvents}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Events</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FolderOpen className="size-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-lg font-bold font-heading leading-tight">
                    {stats.documents.totalDocuments}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Documents</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <FileText className="size-4 text-violet-500" />
                </div>
                <div>
                  <p className="text-lg font-bold font-heading leading-tight">
                    {stats.posts.totalPosts}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Posts</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Users className="size-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-lg font-bold font-heading leading-tight">
                    {stats.events.eventsWithAttendance}
                  </p>
                  <p className="text-[10px] text-muted-foreground">RSVP Events</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <>
      <AuthLoading>
        <div className="w-full max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[130px] rounded-xl" />
            ))}
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Please sign in to view reports.</p>
        </div>
      </Unauthenticated>
      <Authenticated>
        <ReportsContent />
      </Authenticated>
    </>
  );
}
