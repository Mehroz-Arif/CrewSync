import { format } from "date-fns";
import {
  Clock,
  MapPin,
  Pencil,
  Trash2,
  GraduationCap,
  Users,
  Target,
  PartyPopper,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import type { CalendarEvent } from "./calendar-grid.tsx";

type EventType = "training" | "staff_meeting" | "deadline" | "social" | "other";

const EVENT_TYPE_META: Record<EventType, { label: string; icon: typeof GraduationCap; color: string }> = {
  training: { label: "Training", icon: GraduationCap, color: "text-blue-500" },
  staff_meeting: { label: "Staff Meeting", icon: Users, color: "text-violet-500" },
  deadline: { label: "Deadline", icon: Target, color: "text-rose-500" },
  social: { label: "Social Event", icon: PartyPopper, color: "text-emerald-500" },
  other: { label: "Other", icon: Tag, color: "text-amber-500" },
};

type DayDetailProps = {
  date: Date;
  events: CalendarEvent[];
  isAdmin: boolean;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
  onAddEvent: () => void;
};

export default function DayDetail({
  date,
  events,
  isAdmin,
  onEdit,
  onDelete,
  onAddEvent,
}: DayDetailProps) {
  const dayEvents = events.filter((e) => e.date === format(date, "yyyy-MM-dd"));

  return (
    <div className="bg-card border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold text-base">
            {format(date, "EEEE, d MMMM yyyy")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dayEvents.length === 0
              ? "No events scheduled"
              : `${dayEvents.length} event${dayEvents.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={onAddEvent}>
            Add Event
          </Button>
        )}
      </div>

      {dayEvents.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Nothing scheduled for this day.
        </div>
      ) : (
        <div className="space-y-3">
          {dayEvents.map((event) => {
            const meta = EVENT_TYPE_META[event.eventType];
            const Icon = meta.icon;
            return (
              <div
                key={event._id}
                className="border rounded-lg p-3.5 space-y-2 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={cn("mt-0.5", meta.color)}>
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{event.title}</h4>
                    <p className="text-xs text-muted-foreground">{meta.label}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEdit(event)}
                        title="Edit event"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDelete(event)}
                        title="Delete event"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Time */}
                {event.allDay ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    <span>All day</span>
                  </div>
                ) : (
                  event.startTime &&
                  event.endTime && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3.5" />
                      <span>
                        {event.startTime} – {event.endTime}
                      </span>
                    </div>
                  )
                )}

                {/* Location */}
                {event.location && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" />
                    <span>{event.location}</span>
                  </div>
                )}

                {/* Description */}
                {event.description && (
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                    {event.description}
                  </p>
                )}

                {/* Creator */}
                <p className="text-[11px] text-muted-foreground/60">
                  Added by {event.creatorName}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
