import { useState } from "react";
import { format } from "date-fns";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
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
  UserPlus,
  UserCheck,
  UserX,
  XCircle,
  Check,
  X,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { CalendarEvent } from "./calendar-grid.tsx";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

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
          {dayEvents.map((event) => (
            <EventCard
              key={event._id}
              event={event}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Individual Event Card ───────────────────────────────────────────────────

type EventCardProps = {
  event: CalendarEvent;
  isAdmin: boolean;
  onEdit: (event: CalendarEvent) => void;
  onDelete: (event: CalendarEvent) => void;
};

function EventCard({ event, isAdmin, onEdit, onDelete }: EventCardProps) {
  const meta = EVENT_TYPE_META[event.eventType];
  const Icon = meta.icon;

  return (
    <div className="border rounded-lg p-3.5 space-y-2 hover:bg-muted/30 transition-colors">
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

      {/* Teams Meeting Link */}
      {event.teamsLink && (
        <a
          href={event.teamsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          <Video className="size-3.5" />
          <span>Join Teams Meeting</span>
        </a>
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

      {/* Attendance section */}
      {event.attendanceEnabled && (
        <AttendanceSection event={event} isAdmin={isAdmin} />
      )}
    </div>
  );
}

// ─── Attendance Section ──────────────────────────────────────────────────────

function AttendanceSection({ event, isAdmin }: { event: CalendarEvent; isAdmin: boolean }) {
  const myAttendance = useQuery(api.calendarEvents.getMyAttendance, { eventId: event._id });
  const attendanceList = useQuery(
    api.calendarEvents.getAttendance,
    isAdmin ? { eventId: event._id } : "skip"
  );

  const requestAttendance = useMutation(api.calendarEvents.requestAttendance);
  const cancelAttendance = useMutation(api.calendarEvents.cancelAttendance);
  const updateStatus = useMutation(api.calendarEvents.updateAttendanceStatus);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const capacityText = event.maxAttendees
    ? `${event.approvedCount}/${event.maxAttendees} spots filled`
    : `${event.approvedCount} attending`;

  const isFull = event.maxAttendees ? event.approvedCount >= event.maxAttendees : false;

  async function handleRequest() {
    setIsSubmitting(true);
    try {
      await requestAttendance({ eventId: event._id });
      toast.success("Attendance requested");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to request attendance");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    setIsSubmitting(true);
    try {
      await cancelAttendance({ eventId: event._id });
      toast.success("Attendance cancelled");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to cancel attendance");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateStatus(attendanceId: Id<"eventAttendance">, status: "approved" | "denied") {
    try {
      await updateStatus({ attendanceId, status });
      toast.success(status === "approved" ? "Attendance approved" : "Attendance denied");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to update attendance");
      }
    }
  }

  return (
    <div className="mt-2 pt-2 border-t space-y-2">
      {/* Capacity badge */}
      <div className="flex items-center gap-2">
        <Users className="size-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{capacityText}</span>
        {isFull && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            Full
          </Badge>
        )}
      </div>

      {/* Staff: request / status / cancel */}
      {!isAdmin && (
        <div>
          {myAttendance === undefined ? (
            <Spinner />
          ) : myAttendance === null ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={isSubmitting || isFull}
              onClick={handleRequest}
              className="w-full"
            >
              {isSubmitting ? (
                <Spinner />
              ) : isFull ? (
                <>
                  <XCircle className="size-3.5 mr-1.5" />
                  Event Full
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5 mr-1.5" />
                  Request Attendance
                </>
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  myAttendance.status === "approved"
                    ? "default"
                    : myAttendance.status === "denied"
                      ? "destructive"
                      : "secondary"
                }
                className="text-xs"
              >
                {myAttendance.status === "approved" && <UserCheck className="size-3 mr-1" />}
                {myAttendance.status === "denied" && <UserX className="size-3 mr-1" />}
                {myAttendance.status === "requested" && <Clock className="size-3 mr-1" />}
                {myAttendance.status === "approved"
                  ? "Approved"
                  : myAttendance.status === "denied"
                    ? "Denied"
                    : "Pending"}
              </Badge>
              {myAttendance.status !== "denied" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 text-destructive hover:text-destructive"
                  disabled={isSubmitting}
                  onClick={handleCancel}
                >
                  Cancel
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Admin: attendance list with approve/deny */}
      {isAdmin && attendanceList && attendanceList.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Requests ({attendanceList.length})
          </p>
          {attendanceList.map((record) => (
            <div
              key={record._id}
              className="flex items-center gap-2 text-xs bg-muted/40 rounded-md px-2.5 py-1.5"
            >
              <span className="flex-1 truncate font-medium">{record.userName}</span>
              <Badge
                variant={
                  record.status === "approved"
                    ? "default"
                    : record.status === "denied"
                      ? "destructive"
                      : "secondary"
                }
                className="text-[10px] px-1.5 py-0 capitalize"
              >
                {record.status}
              </Badge>
              {record.status === "requested" && (
                <div className="flex items-center gap-0.5">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="size-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                    onClick={() => handleUpdateStatus(record._id, "approved")}
                    title="Approve"
                  >
                    <Check className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="size-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleUpdateStatus(record._id, "denied")}
                    title="Deny"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && attendanceList && attendanceList.length === 0 && (
        <p className="text-[11px] text-muted-foreground/60">No attendance requests yet</p>
      )}
    </div>
  );
}
