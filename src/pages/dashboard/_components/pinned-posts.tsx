import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Pin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatDistanceToNow } from "date-fns";

export default function PinnedPosts() {
  const pinned = useQuery(api.posts.getPinned);

  if (!pinned) {
    return <Skeleton className="h-24 rounded-xl" />;
  }

  if (pinned.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Pin className="size-3.5 rotate-45" />
        <span>Pinned</span>
      </div>
      {pinned.map((post) => (
        <div
          key={post._id}
          className="bg-primary/5 border border-primary/20 rounded-xl p-4"
        >
          <h4 className="font-heading font-semibold text-sm">{post.title}</h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {post.body}
          </p>
          <p className="text-[11px] text-muted-foreground mt-2">
            by {post.authorName} ·{" "}
            {formatDistanceToNow(new Date(post._creationTime), {
              addSuffix: true,
            })}
          </p>
        </div>
      ))}
    </div>
  );
}
