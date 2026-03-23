import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { Send, ArrowLeft, Users, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function ChatThread({
  conversationId,
  onBack,
}: {
  conversationId: Id<"conversations">;
  onBack: () => void;
}) {
  const convo = useQuery(api.messaging.getConversation, { conversationId });
  const messages = useQuery(api.messaging.getMessages, { conversationId });
  const sendMessage = useMutation(api.messaging.send);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages?.length]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setIsSending(true);
    setDraft("");
    try {
      await sendMessage({ conversationId, body: text });
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to send message");
      }
      setDraft(text); // Restore on error
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  if (!convo || !messages) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b px-4 py-3">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn("h-12 rounded-xl", i % 2 === 0 ? "w-2/3" : "w-1/2 ml-auto")}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center gap-3 shrink-0 bg-card">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div
          className={cn(
            "size-9 rounded-full shrink-0 flex items-center justify-center text-xs font-heading font-bold",
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
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{convo.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {convo.members.length} member{convo.members.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center py-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessageCircle />
                </EmptyMedia>
                <EmptyTitle>Start the conversation</EmptyTitle>
                <EmptyDescription>
                  Send a message to get things going
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}

        {messages.map((msg, idx) => {
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const showAuthor = !prevMsg || prevMsg.authorId !== msg.authorId;

          return (
            <div
              key={msg._id}
              className={cn(
                "flex flex-col",
                msg.isCurrentUser ? "items-end" : "items-start",
                !showAuthor && "mt-0.5"
              )}
            >
              {showAuthor && !msg.isCurrentUser && (
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-heading font-bold">
                    {msg.authorName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {msg.authorName}
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                  msg.isCurrentUser
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md",
                  !showAuthor && !msg.isCurrentUser && "ml-8"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{msg.body}</p>
              </div>
              {showAuthor && (
                <span
                  className={cn(
                    "text-[10px] text-muted-foreground mt-1",
                    msg.isCurrentUser ? "mr-1" : "ml-8"
                  )}
                >
                  {formatDistanceToNow(new Date(msg.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Compose */}
      <form
        onSubmit={handleSend}
        className="border-t px-4 py-3 flex items-center gap-2 shrink-0 bg-card"
      >
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
          disabled={isSending}
        />
        <Button
          type="submit"
          size="icon-sm"
          disabled={!draft.trim() || isSending}
        >
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
