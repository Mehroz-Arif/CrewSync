import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { formatDistanceToNow } from "date-fns";
import { Heart, Reply, Trash2, Send, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type CommentData = {
  _id: Id<"postComments">;
  _creationTime: number;
  postId: Id<"posts">;
  authorId: Id<"users">;
  body: string;
  parentId?: Id<"postComments">;
  likesCount: number;
  authorName: string;
  authorAvatarUrl?: string;
};

function CommentItem({
  comment,
  replies,
  isLiked,
  likedCommentIds,
  currentUserId,
  onReply,
}: {
  comment: CommentData;
  replies: CommentData[];
  isLiked: boolean;
  likedCommentIds: Set<string>;
  currentUserId: Id<"users"> | undefined;
  onReply: (parentId: Id<"postComments">) => void;
}) {
  const toggleLike = useMutation(api.postComments.toggleLike);
  const deleteComment = useMutation(api.postComments.deleteComment);
  const [showReplies, setShowReplies] = useState(replies.length <= 2);
  const isOwner = currentUserId === comment.authorId;

  const handleLike = async () => {
    try {
      await toggleLike({ commentId: comment._id });
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteComment({ commentId: comment._id });
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2.5 group">
        <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-[10px] shrink-0 mt-0.5">
          {comment.authorName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-muted/60 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-medium">{comment.authorName}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(comment._creationTime), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
              {comment.body}
            </p>
          </div>

          {/* Comment actions */}
          <div className="flex items-center gap-3 mt-1 ml-1">
            <button
              onClick={handleLike}
              className={cn(
                "flex items-center gap-1 text-[11px] font-medium transition-colors",
                isLiked
                  ? "text-red-500"
                  : "text-muted-foreground hover:text-red-500"
              )}
            >
              <Heart className={cn("size-3", isLiked && "fill-current")} />
              {comment.likesCount > 0 && (
                <span className="tabular-nums">{comment.likesCount}</span>
              )}
            </button>

            <button
              onClick={() => onReply(comment._id)}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <Reply className="size-3" />
              Reply
            </button>

            {isOwner && (
              <button
                onClick={handleDelete}
                className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-9 space-y-2">
          {replies.length > 2 && !showReplies && (
            <button
              onClick={() => setShowReplies(true)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <ChevronDown className="size-3" />
              Show {replies.length} replies
            </button>
          )}

          {showReplies && (
            <>
              {replies.length > 2 && (
                <button
                  onClick={() => setShowReplies(false)}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <ChevronUp className="size-3" />
                  Hide replies
                </button>
              )}
              {replies.map((reply) => (
                <ReplyItem
                  key={reply._id}
                  reply={reply}
                  isLiked={likedCommentIds.has(reply._id)}
                  currentUserId={currentUserId}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ReplyItem({
  reply,
  isLiked,
  currentUserId,
}: {
  reply: CommentData;
  isLiked: boolean;
  currentUserId: Id<"users"> | undefined;
}) {
  const toggleLike = useMutation(api.postComments.toggleLike);
  const deleteComment = useMutation(api.postComments.deleteComment);
  const isOwner = currentUserId === reply.authorId;

  const handleLike = async () => {
    try {
      await toggleLike({ commentId: reply._id });
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteComment({ commentId: reply._id });
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      }
    }
  };

  return (
    <div className="flex gap-2 group">
      <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold text-[9px] shrink-0 mt-0.5">
        {reply.authorName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-muted/40 rounded-lg px-2.5 py-1.5">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[11px] font-medium">{reply.authorName}</span>
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(reply._creationTime), { addSuffix: true })}
            </span>
          </div>
          <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words">
            {reply.body}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-0.5 ml-1">
          <button
            onClick={handleLike}
            className={cn(
              "flex items-center gap-1 text-[10px] font-medium transition-colors",
              isLiked
                ? "text-red-500"
                : "text-muted-foreground hover:text-red-500"
            )}
          >
            <Heart className={cn("size-2.5", isLiked && "fill-current")} />
            {reply.likesCount > 0 && (
              <span className="tabular-nums">{reply.likesCount}</span>
            )}
          </button>
          {isOwner && (
            <button
              onClick={handleDelete}
              className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="size-2.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PostComments({
  postId,
  currentUserId,
}: {
  postId: Id<"posts">;
  currentUserId: Id<"users"> | undefined;
}) {
  const comments = useQuery(api.postComments.getByPost, { postId });
  const userCommentLikes = useQuery(api.postComments.getUserLikesByPost, { postId });
  const addComment = useMutation(api.postComments.addComment);

  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<Id<"postComments"> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const likedCommentIds = new Set(userCommentLikes ?? []);

  // Separate top-level comments from replies
  const topLevel = (comments ?? []).filter((c) => !c.parentId);
  const repliesByParent = new Map<string, CommentData[]>();
  for (const c of comments ?? []) {
    if (c.parentId) {
      const arr = repliesByParent.get(c.parentId) ?? [];
      arr.push(c);
      repliesByParent.set(c.parentId, arr);
    }
  }

  const replyingToComment = replyingTo
    ? (comments ?? []).find((c) => c._id === replyingTo)
    : null;

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    try {
      await addComment({
        postId,
        body: trimmed,
        parentId: replyingTo ?? undefined,
      });
      setBody("");
      setReplyingTo(null);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!comments) {
    return (
      <div className="space-y-2 pt-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-2">
      {/* Comment list */}
      {topLevel.length > 0 && (
        <div className="space-y-3">
          {topLevel.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              replies={repliesByParent.get(comment._id) ?? []}
              isLiked={likedCommentIds.has(comment._id)}
              likedCommentIds={likedCommentIds}
              currentUserId={currentUserId}
              onReply={(parentId) => setReplyingTo(parentId)}
            />
          ))}
        </div>
      )}

      {/* Reply indicator */}
      {replyingToComment && (
        <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 rounded-md px-2.5 py-1.5">
          <Reply className="size-3" />
          <span>Replying to {replyingToComment.authorName}</span>
          <button
            onClick={() => setReplyingTo(null)}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Comment input */}
      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
          rows={1}
          className="flex-1 resize-none rounded-lg border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!body.trim() || isSubmitting}
          className="h-auto px-2.5"
        >
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
