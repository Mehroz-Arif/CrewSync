import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { CalendarClock, Clock, Users, Truck, Radio, StickyNote } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function NextShiftCard() {
  const nextShift = useQuery(api.shifts.getNextShift);

  // Loading state
  if (nextShift === undefined) {
    return (
      <div className="bg-card border rounded-xl p-5 space-y-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // No upcoming shift
  if (nextShift === null) {
    return (
      <div className="bg-card border rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" />
          <h3 className="font-heading font-semibold text-sm">Your Next Shift</h3>
        </div>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="size-10 rounded-full bg-muted flex items-center justify-center mb-2">
            <CalendarClock className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No upcoming shifts</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Your schedule is clear for now
          </p>
        </div>
      </div>
    );
  }

  const startDate = parseISO(nextShift.startTime);
  const endDate = parseISO(nextShift.endTime);

  // Check if shift is happening now
  const now = new Date();
  const isActive = now >= startDate && now <= endDate;

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      {/* Header strip */}
      <div className={`px-5 py-3 flex items-center justify-between ${isActive ? "bg-accent/15" : "bg-primary/5"}`}>
        <div className="flex items-center gap-2">
          <CalendarClock className={`size-4 ${isActive ? "text-accent" : "text-primary"}`} />
          <h3 className="font-heading font-semibold text-sm">Your Next Shift</h3>
        </div>
        {isActive && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-0.5 text-[10px] font-semibold text-accent uppercase tracking-wider">
            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
            Active Now
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Shift times */}
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Clock className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Shift Times
            </p>
            <p className="text-sm font-semibold mt-0.5">
              {format(startDate, "EEE, MMM d")}
            </p>
            <p className="text-sm text-foreground">
              {format(startDate, "h:mm a")} &ndash; {format(endDate, "h:mm a")}
            </p>
          </div>
        </div>

        {/* Crew Mates */}
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
            <Users className="size-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Crew Mates
            </p>
            {nextShift.crew.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                No other crew members assigned
              </p>
            ) : (
              <div className="space-y-1.5 mt-1.5">
                {nextShift.crew.map((member) => {
                  const initials = (member.name ?? "?")
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <div
                      key={member._id}
                      className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-2.5 py-2"
                    >
                      <Avatar className="size-7">
                        <AvatarImage src={member.avatarUrl} />
                        <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{member.name}</p>
                        {member.positions.length > 0 && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {member.positions.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Vehicle */}
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-chart-4/10 flex items-center justify-center shrink-0 mt-0.5">
            <Truck className="size-4 text-chart-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Allocated Vehicle
            </p>
            <p className="text-sm font-semibold mt-0.5">{nextShift.vehicle}</p>
          </div>
        </div>

        {/* Call Sign */}
        {nextShift.callSign && (
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-chart-3/10 flex items-center justify-center shrink-0 mt-0.5">
              <Radio className="size-4 text-chart-3" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Call Sign
              </p>
              <p className="text-sm font-semibold mt-0.5">{nextShift.callSign}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {nextShift.notes && (
          <div className="flex items-start gap-3">
            <div className="size-9 rounded-lg bg-chart-5/10 flex items-center justify-center shrink-0 mt-0.5">
              <StickyNote className="size-4 text-chart-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Shift Notes
              </p>
              <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
                {nextShift.notes}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
