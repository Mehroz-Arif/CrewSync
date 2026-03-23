import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { cn } from "@/lib/utils.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { MessageCircle, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: Id<"conversations"> | null;
  onSelect: (id: Id<"conversations">) => void;
}) {
  const conversations = useQuery(api.messaging.listConversations);

  if (!conversations) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageCircle />
            </EmptyMedia>
            <EmptyTitle>No conversations</EmptyTitle>
            <EmptyDescription>
              Start a new conversation with a team member
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-2 space-y-0.5">
        {conversations.map((convo) => (
          <button
            key={convo._id}
            onClick={() => onSelect(convo._id)}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
              selectedId === convo._id
                ? "bg-primary/10 text-foreground"
                : "hover:bg-muted text-foreground"
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                "size-10 rounded-full shrink-0 flex items-center justify-center text-xs font-heading font-bold",
                convo.type === "group"
                  ? "bg-accent/15 text-accent"
                  : "bg-primary/10 text-primary"
              )}
            >
              {convo.type === "group" ? (
                <Users className="size-4" />
              ) : (
                convo.name.charAt(0).toUpperCase()
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{convo.name}</p>
                {convo.lastMessageAt && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(convo.lastMessageTime), {
                      addSuffix: false,
                    })}
                  </span>
                )}
              </div>
              {convo.lastMessagePreview && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {convo.lastMessageAuthorName}: {convo.lastMessagePreview}
                </p>
              )}
              {!convo.lastMessagePreview && (
                <p className="text-xs text-muted-foreground italic mt-0.5">
                  No messages yet
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
