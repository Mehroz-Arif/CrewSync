import { usePaginatedQuery, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { formatDistanceToNow } from "date-fns";
import {
  Heart,
  Megaphone,
  RefreshCw,
  Sparkles,
  MessageSquare,
  MessageSquareQuote,
  Trash2,
  Pin,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  announcement: {
    label: "Announcement",
    icon: Megaphone,
    color: "text-chart-5 bg-chart-5/10",
  },
  update: {
    label: "Update",
    icon: RefreshCw,
    color: "text-primary bg-primary/10",
  },
  shoutout: {
    label: "Shoutout",
    icon: Sparkles,
    color: "text-chart-4 bg-chart-4/10",
  },
  general: {
    label: "General",
    icon: MessageSquare,
    color: "text-muted-foreground bg-muted",
  },
  feedback: {
    label: "You Said, We Did",
    icon: MessageSquareQuote,
    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
};

function PostCard({
  post,
  isLiked,
  currentUserId,
}: {
  post: {
    _id: Id<"posts">;
    _creationTime: number;
    title: string;
    body: string;
    category: string;
    pinned: boolean;
    likesCount: number;
    authorName: string;
    authorAvatarUrl?: string;
    authorDepartment?: string;
    authorId: Id<"users">;
    imageUrl?: string | null;
  };
  isLiked: boolean;
  currentUserId: Id<"users"> | undefined;
}) {
  const toggleLike = useMutation(api.posts.toggleLike);
  const deletePost = useMutation(api.posts.deletePost);
  const categoryInfo = CATEGORY_CONFIG[post.category] ?? CATEGORY_CONFIG.general;
  const CategoryIcon = categoryInfo.icon;
  const isOwner = currentUserId === post.authorId;

  const handleLike = async () => {
    try {
      await toggleLike({ postId: post._id });
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deletePost({ postId: post._id });
      toast.success("Post deleted");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      }
    }
  };

  return (
    <article className="bg-card border rounded-xl p-5 space-y-3 transition-shadow hover:shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-xs shrink-0">
            {post.authorName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{post.authorName}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post._creationTime), {
                addSuffix: true,
              })}
              {post.authorDepartment && ` · ${post.authorDepartment}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {post.pinned && (
            <Pin className="size-3.5 text-primary rotate-45" />
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              categoryInfo.color
            )}
          >
            <CategoryIcon className="size-3" />
            {categoryInfo.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div>
        <h3 className="font-heading font-semibold text-sm mb-1">
          {post.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {post.body}
        </p>
      </div>

      {/* Image */}
      {post.imageUrl && (
        <div className="rounded-lg overflow-hidden border -mx-1">
          <img
            src={post.imageUrl}
            alt={`Photo for ${post.title}`}
            className="w-full max-h-80 object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handleLike}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium transition-colors rounded-md px-2 py-1 -ml-2",
            isLiked
              ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
              : "text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          )}
        >
          <Heart
            className={cn("size-4", isLiked && "fill-current")}
          />
          {post.likesCount > 0 && (
            <span className="tabular-nums">{post.likesCount}</span>
          )}
        </button>

        {isOwner && (
          <button
            onClick={handleDelete}
            className="text-muted-foreground hover:text-destructive transition-colors rounded-md p-1"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

export default function NewsFeed() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.posts.list,
    {},
    { initialNumItems: 10 }
  );
  const userLikes = useQuery(api.posts.getUserLikes);
  const currentUser = useQuery(api.users.getCurrentUser);

  const likedPostIds = new Set(userLikes ?? []);

  if (status === "LoadingFirstPage") {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquare />
          </EmptyMedia>
          <EmptyTitle>No posts yet</EmptyTitle>
          <EmptyDescription>
            Be the first to share something with the team
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((post) => (
        <PostCard
          key={post._id}
          post={post}
          isLiked={likedPostIds.has(post._id)}
          currentUserId={currentUser?._id}
        />
      ))}

      {status === "CanLoadMore" && (
        <div className="flex justify-center pt-2">
          <Button variant="ghost" size="sm" onClick={() => loadMore(10)}>
            Load more
          </Button>
        </div>
      )}

      {status === "LoadingMore" && (
        <Skeleton className="h-36 rounded-xl" />
      )}
    </div>
  );
}
