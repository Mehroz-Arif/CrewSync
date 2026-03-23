import StatsCards from "./_components/stats-cards.tsx";
import NewsFeed from "./_components/news-feed.tsx";
import CreatePostForm from "./_components/create-post-form.tsx";
import PinnedPosts from "./_components/pinned-posts.tsx";
import NextShiftCard from "./_components/next-shift-card.tsx";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";

export default function DashboardPage() {
  const user = useQuery(api.users.getCurrentUser);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Here{"'"}s what{"'"}s happening with your team
          </p>
        </div>
        <CreatePostForm />
      </div>

      {/* Stats overview */}
      <StatsCards />

      {/* Next shift + Newsfeed grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Newsfeed - takes 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-heading font-semibold text-lg">Newsfeed</h2>
          <NewsFeed />
        </div>

        {/* Sidebar - next shift, pinned posts, quick links */}
        <div className="space-y-6">
          <NextShiftCard />
          <PinnedPosts />

          {/* Quick links panel */}
          <div className="bg-card border rounded-xl p-5 space-y-3">
            <h3 className="font-heading font-semibold text-sm">
              Quick Actions
            </h3>
            <div className="space-y-2 text-sm">
              <QuickLink
                label="View your shifts"
                description="See your upcoming schedule"
              />
              <QuickLink
                label="Send a message"
                description="Chat with your team"
              />
              <QuickLink
                label="Check rewards"
                description="View your earned points"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted transition-colors cursor-default opacity-60">
      <div className="size-2 rounded-full bg-primary/40" />
      <div className="min-w-0">
        <p className="font-medium text-xs">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
