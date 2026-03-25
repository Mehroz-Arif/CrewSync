import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { formatDistanceToNow } from "date-fns";
import { Star, Heart, Trophy, Rocket, Gem, Award, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { useStaffPreview } from "@/hooks/use-staff-preview.tsx";

const BADGE_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgGradient: string;
  }
> = {
  star: {
    icon: Star,
    color: "text-amber-500",
    bgGradient: "from-amber-500/15 to-amber-500/5",
  },
  heart: {
    icon: Heart,
    color: "text-rose-500",
    bgGradient: "from-rose-500/15 to-rose-500/5",
  },
  trophy: {
    icon: Trophy,
    color: "text-yellow-500",
    bgGradient: "from-yellow-500/15 to-yellow-500/5",
  },
  rocket: {
    icon: Rocket,
    color: "text-violet-500",
    bgGradient: "from-violet-500/15 to-violet-500/5",
  },
  gem: {
    icon: Gem,
    color: "text-cyan-500",
    bgGradient: "from-cyan-500/15 to-cyan-500/5",
  },
};

export default function RecognitionWall() {
  const recognitions = useQuery(api.recognitions.getRecent);
  const currentUser = useQuery(api.users.getCurrentUser);
  const removeRecognition = useMutation(api.recognitions.remove);
  const { isPreviewingAsStaff } = useStaffPreview();

  const isAdmin = (currentUser?.role === "admin" || currentUser?.isSuperAdmin) && !isPreviewingAsStaff;

  if (recognitions === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (recognitions.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-5">
        <h3 className="font-heading font-semibold text-sm flex items-center gap-2 mb-4">
          <Award className="size-4 text-primary" />
          Recognition Wall
        </h3>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Award />
            </EmptyMedia>
            <EmptyTitle>No recognitions yet</EmptyTitle>
            <EmptyDescription>
              Recognitions from management will appear here
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const handleDelete = async (id: typeof recognitions[number]["_id"]) => {
    try {
      await removeRecognition({ recognitionId: id });
      toast.success("Recognition removed");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to remove recognition");
      }
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
        <Award className="size-4 text-primary" />
        Recognition Wall
      </h3>
      <div className="space-y-3">
        {recognitions.map((recognition) => {
          const config = BADGE_CONFIG[recognition.badge] ?? BADGE_CONFIG.star;
          const BadgeIcon = config.icon;

          return (
            <article
              key={recognition._id}
              className={cn(
                "relative rounded-xl border p-4 bg-gradient-to-br transition-shadow hover:shadow-sm",
                config.bgGradient
              )}
            >
              {/* Admin delete button */}
              {isAdmin && (
                <button
                  onClick={() => handleDelete(recognition._id)}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors rounded-md p-1"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}

              {/* Badge icon and title */}
              <div className="flex items-center gap-2.5 mb-2">
                <div className={cn("size-9 rounded-lg flex items-center justify-center", config.color, "bg-background/80")}>
                  <BadgeIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-semibold text-sm truncate">
                    {recognition.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Awarded to <span className="font-medium text-foreground">{recognition.recipientName}</span>
                  </p>
                </div>
              </div>

              {/* Message */}
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-2">
                {recognition.message}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>By {recognition.givenByName}</span>
                <span>
                  {formatDistanceToNow(new Date(recognition._creationTime), { addSuffix: true })}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
