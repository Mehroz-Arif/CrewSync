import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { format } from "date-fns";
import {
  MessageSquareQuote,
  CheckCircle2,
  Lightbulb,
  CalendarClock,
  Building2,
  MessageSquare,
  AlertCircle,
} from "lucide-react";

const CATEGORY_META: Record<string, { label: string; icon: typeof MessageSquare }> = {
  general: { label: "General", icon: MessageSquare },
  scheduling: { label: "Scheduling", icon: CalendarClock },
  workplace: { label: "Workplace", icon: Building2 },
  suggestion: { label: "Suggestion", icon: Lightbulb },
  concern: { label: "Concern", icon: AlertCircle },
};

export default function YouSaidWeDid() {
  const published = useQuery(api.feedback.listPublished);

  if (published === undefined) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (published.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquareQuote />
          </EmptyMedia>
          <EmptyTitle>Nothing here yet</EmptyTitle>
          <EmptyDescription>
            When management responds to feedback, it will appear here so you
            can see the actions being taken
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      {published.map((item) => {
        const catMeta = CATEGORY_META[item.category] ?? CATEGORY_META.general;
        const CatIcon = catMeta.icon;

        return (
          <Card key={item._id} className="overflow-hidden">
            <CardContent className="p-0">
              {/* "You Said" section */}
              <div className="p-4 pb-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <MessageSquareQuote className="size-3.5 text-primary" />
                    You Said
                  </div>
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <CatIcon className="size-3" />
                    {catMeta.label}
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
                  {item.message}
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-dashed" />

              {/* "We Did" section */}
              <div className="p-4 pt-3 bg-primary/5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <CheckCircle2 className="size-3.5" />
                  We Did
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {item.adminResponse}
                </p>
                {item.publishedAt && (
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Responded {format(new Date(item.publishedAt), "MMM d, yyyy")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
