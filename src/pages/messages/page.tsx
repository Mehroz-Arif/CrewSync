import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ConversationList from "./_components/conversation-list.tsx";
import ChatThread from "./_components/chat-thread.tsx";
import NewConversationDialog from "./_components/new-conversation-dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { MessageCircle } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

export default function MessagesPage() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const selectedId = conversationId
    ? (conversationId as Id<"conversations">)
    : null;

  // On mobile, show chat when a conversation is selected via URL
  useEffect(() => {
    if (selectedId) {
      setMobileShowChat(true);
    }
  }, [selectedId]);

  const handleSelect = (id: Id<"conversations">) => {
    navigate(`/messages/${id}`);
    setMobileShowChat(true);
  };

  const handleBack = () => {
    setMobileShowChat(false);
    navigate("/messages");
  };

  return (
    <div className="h-[calc(100vh-theme(spacing.14)-theme(spacing.8))] lg:h-[calc(100vh-theme(spacing.16))] flex rounded-xl border bg-card overflow-hidden">
      {/* Sidebar - conversation list */}
      <div
        className={cn(
          "w-full lg:w-80 shrink-0 border-r flex flex-col",
          mobileShowChat ? "hidden lg:flex" : "flex"
        )}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <h2 className="font-heading font-semibold text-base">Messages</h2>
          <NewConversationDialog onCreated={handleSelect} />
        </div>

        <ConversationList selectedId={selectedId} onSelect={handleSelect} />
      </div>

      {/* Chat area */}
      <div
        className={cn(
          "flex-1 flex flex-col",
          !mobileShowChat ? "hidden lg:flex" : "flex"
        )}
      >
        {selectedId ? (
          <ChatThread conversationId={selectedId} onBack={handleBack} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <MessageCircle className="size-7 text-muted-foreground" />
              </div>
              <div>
                <p className="font-heading font-semibold text-lg">
                  Select a conversation
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a chat from the sidebar or start a new one
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
