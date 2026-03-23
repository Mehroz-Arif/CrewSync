import { useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isSameDay,
} from "date-fns";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type EventType = "training" | "staff_meeting" | "deadline" | "social" | "other";

export type CalendarEvent = {
  _id: Id<"calendarEvents">;
  title: string;
  description?: string;
  eventType: EventType;
  date: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  creatorName: string;
  attendanceEnabled?: boolean;
  maxAttendees?: number;
  attendanceCount: number;
  approvedCount: number;
};

const EVENT_COLORS: Record<EventType, { bg: string; text: string; dot: string }> = {
  training: {
    bg: "bg-blue-500/15 dark:bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  staff_meeting: {
    bg: "bg-violet-500/15 dark:bg-violet-500/20",
    text: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  deadline: {
    bg: "bg-rose-500/15 dark:bg-rose-500/20",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  social: {
    bg: "bg-emerald-500/15 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  other: {
    bg: "bg-amber-500/15 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
};

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CalendarGridProps = {
  currentDate: Date;
  events: CalendarEvent[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  isAdmin: boolean;
};

export default function CalendarGrid({
  currentDate,
  events,
  selectedDate,
  onSelectDate,
  onEventClick,
  isAdmin,
}: CalendarGridProps) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  // Group events by date string for quick lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const existing = map.get(event.date) ?? [];
      existing.push(event);
      map.set(event.date, existing);
    }
    return map;
  }, [events]);

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            className="py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar body */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate.get(dateStr) ?? [];
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(day)}
              className={cn(
                "relative min-h-[90px] md:min-h-[110px] border-b border-r p-1.5 text-left transition-colors group",
                inMonth
                  ? "hover:bg-muted/50"
                  : "opacity-40 hover:opacity-60",
                selected && "bg-primary/5 ring-1 ring-inset ring-primary/30",
                isAdmin && "cursor-pointer"
              )}
            >
              {/* Date number */}
              <span
                className={cn(
                  "inline-flex items-center justify-center size-7 rounded-full text-sm font-medium",
                  today && "bg-primary text-primary-foreground",
                  !today && "text-foreground"
                )}
              >
                {format(day, "d")}
              </span>

              {/* Events */}
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => {
                  const colors = EVENT_COLORS[event.eventType];
                  return (
                    <button
                      key={event._id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      className={cn(
                        "w-full text-left rounded px-1.5 py-0.5 text-[11px] font-medium truncate transition-opacity hover:opacity-80",
                        colors.bg,
                        colors.text
                      )}
                      title={event.title}
                    >
                      {event.allDay ? (
                        event.title
                      ) : (
                        <>
                          <span className="opacity-70">{event.startTime}</span>{" "}
                          {event.title}
                        </>
                      )}
                    </button>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1.5">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Legend component for event type colors */
export function CalendarLegend() {
  const types: { type: EventType; label: string }[] = [
    { type: "training", label: "Training" },
    { type: "staff_meeting", label: "Staff Meeting" },
    { type: "deadline", label: "Deadline" },
    { type: "social", label: "Social" },
    { type: "other", label: "Other" },
  ];

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {types.map(({ type, label }) => (
        <div key={type} className="flex items-center gap-1.5">
          <div className={cn("size-2.5 rounded-full", EVENT_COLORS[type].dot)} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
