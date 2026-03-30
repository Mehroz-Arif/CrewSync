import { ConvexError } from "convex/values";
import { query } from "./_generated/server";

/** Aggregated analytics data for admin dashboard */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user || user.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins can view analytics" });
    }

    // ─── Team stats ──────────────────────────────────────────────
    const allUsers = await ctx.db.query("users").collect();
    const totalStaff = allUsers.length;
    const adminCount = allUsers.filter((u) => u.role === "admin").length;
    const memberCount = totalStaff - adminCount;

    // Department breakdown
    const departmentMap = new Map<string, number>();
    for (const u of allUsers) {
      const dept = u.department || "Unassigned";
      departmentMap.set(dept, (departmentMap.get(dept) ?? 0) + 1);
    }
    const departmentBreakdown = Array.from(departmentMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // ─── Shift stats ─────────────────────────────────────────────
    const allShifts = await ctx.db.query("shifts").collect();
    const totalShifts = allShifts.length;
    const publishedShifts = allShifts.filter((s) => s.published).length;

    // Shifts by month (last 6 months)
    const now = new Date();
    const shiftsByMonth: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-GB", { month: "short", year: "2-digit" });
      const count = allShifts.filter((s) => s.startTime.startsWith(monthKey)).length;
      shiftsByMonth.push({ month: label, count });
    }

    // ─── Post / engagement stats ─────────────────────────────────
    const allPosts = await ctx.db.query("posts").collect();
    const totalPosts = allPosts.length;

    // Posts by category
    const categoryMap = new Map<string, number>();
    for (const p of allPosts) {
      categoryMap.set(p.category, (categoryMap.get(p.category) ?? 0) + 1);
    }
    const postsByCategory = Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name: formatCategoryLabel(name), count }))
      .sort((a, b) => b.count - a.count);

    // Posts by month (last 6 months)
    const postsByMonth: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startMs = d.getTime();
      const endMs = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      const label = d.toLocaleString("en-GB", { month: "short", year: "2-digit" });
      const count = allPosts.filter(
        (p) => p._creationTime >= startMs && p._creationTime < endMs
      ).length;
      postsByMonth.push({ month: label, count });
    }

    // ─── Feedback stats ──────────────────────────────────────────
    const allFeedback = await ctx.db.query("feedback").collect();
    const totalFeedback = allFeedback.length;
    const newFeedback = allFeedback.filter((f) => f.status === "new").length;
    const reviewedFeedback = allFeedback.filter((f) => f.status === "reviewed").length;
    const archivedFeedback = allFeedback.filter((f) => f.status === "archived").length;
    const publishedFeedback = allFeedback.filter((f) => f.published).length;

    // Feedback by category
    const feedbackCatMap = new Map<string, number>();
    for (const f of allFeedback) {
      feedbackCatMap.set(f.category, (feedbackCatMap.get(f.category) ?? 0) + 1);
    }
    const feedbackByCategory = Array.from(feedbackCatMap.entries())
      .map(([name, count]) => ({ name: formatCategoryLabel(name), count }))
      .sort((a, b) => b.count - a.count);

    // Feedback by status
    const feedbackByStatus = [
      { name: "New", count: newFeedback },
      { name: "Reviewed", count: reviewedFeedback },
      { name: "Archived", count: archivedFeedback },
    ].filter((s) => s.count > 0);

    // ─── Rewards stats ───────────────────────────────────────────
    const allRewards = await ctx.db.query("rewards").collect();
    const totalRewards = allRewards.length;
    const totalPoints = allRewards.reduce((sum, r) => sum + (r.points ?? 0), 0);

    // Top recognized (most rewards received)
    const receivedMap = new Map<string, number>();
    for (const r of allRewards) {
      receivedMap.set(r.toUserId, (receivedMap.get(r.toUserId) ?? 0) + 1);
    }
    const topRecognizedIds = Array.from(receivedMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topRecognized = await Promise.all(
      topRecognizedIds.map(async ([userId, count]) => {
        const u = await ctx.db.get(userId as typeof user._id);
        return { name: u?.name ?? "Unknown", count };
      })
    );

    // ─── Calendar event stats ────────────────────────────────────
    const allEvents = await ctx.db.query("calendarEvents").collect();
    const totalEvents = allEvents.length;
    const eventsWithAttendance = allEvents.filter((e) => e.attendanceEnabled).length;

    // Events by type
    const eventTypeMap = new Map<string, number>();
    for (const e of allEvents) {
      eventTypeMap.set(e.eventType, (eventTypeMap.get(e.eventType) ?? 0) + 1);
    }
    const eventsByType = Array.from(eventTypeMap.entries())
      .map(([name, count]) => ({ name: formatCategoryLabel(name), count }))
      .sort((a, b) => b.count - a.count);

    // ─── Document stats ──────────────────────────────────────────
    const allDocuments = await ctx.db.query("documents").collect();
    const totalDocuments = allDocuments.length;

    return {
      team: {
        totalStaff,
        adminCount,
        memberCount,
        departmentBreakdown,
      },
      shifts: {
        totalShifts,
        publishedShifts,
        shiftsByMonth,
      },
      posts: {
        totalPosts,
        postsByCategory,
        postsByMonth,
      },
      feedback: {
        totalFeedback,
        newFeedback,
        reviewedFeedback,
        archivedFeedback,
        publishedFeedback,
        feedbackByCategory,
        feedbackByStatus,
      },
      rewards: {
        totalRewards,
        totalPoints,
        topRecognized,
      },
      events: {
        totalEvents,
        eventsWithAttendance,
        eventsByType,
      },
      documents: {
        totalDocuments,
      },
    };
  },
});

/** Format category names for display */
function formatCategoryLabel(category: string): string {
  return category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
