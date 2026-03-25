import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  format,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { useStaffPreview } from "@/hooks/use-staff-preview.tsx";
import CalendarGrid, { CalendarLegend } from "./_components/calendar-grid.tsx";
import type { CalendarEvent } from "./_components/calendar-grid.tsx";
import DayDetail from "./_components/day-detail.tsx";
import EventDialog from "./_components/event-dialog.tsx";

type EventType = "training" | "staff_meeting" | "deadline" | "social" | "other";

export default function CalendarPage() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const { isPreviewingAsStaff } = useStaffPreview();
  const isAdmin = currentUser?.role === "admin" && !isPreviewingAsStaff;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  // Calculate fetch range: full visible calendar grid (can span into adjacent months)
  const { fetchStart, fetchEnd } = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return {
      fetchStart: format(calStart, "yyyy-MM-dd"),
      fetchEnd: format(calEnd, "yyyy-MM-dd"),
    };
  }, [currentDate]);

  const events = useQuery(api.calendarEvents.getByDateRange, {
    startDate: fetchStart,
    endDate: fetchEnd,
  });

  const deleteEvent = useMutation(api.calendarEvents.remove);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogDate, setDialogDate] = useState("");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);

  function handleAddEvent(date?: Date) {
    setDialogMode("create");
    setDialogDate(format(date ?? selectedDate ?? new Date(), "yyyy-MM-dd"));
    setEditingEvent(undefined);
    setDialogOpen(true);
  }

  function handleEditEvent(event: CalendarEvent) {
    setDialogMode("edit");
    setEditingEvent(event);
    setDialogOpen(true);
  }

  function handleEventClick(event: CalendarEvent) {
    // Select the event's date and show in day panel
    const eventDate = new Date(event.date + "T00:00:00");
    setSelectedDate(eventDate);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await deleteEvent({ eventId: deleteTarget._id });
      toast.success("Event deleted");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Failed to delete event");
      }
    }
    setDeleteTarget(null);
  }

  if (currentUser === undefined || events === undefined) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  const isCurrentMonth =
    format(currentDate, "yyyy-MM") === format(new Date(), "yyyy-MM");

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl">
            Calendar
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Team diary with training dates, meetings, and events
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => handleAddEvent()}>
            <Plus className="size-4 mr-1.5" />
            Add Event
          </Button>
        )}
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCurrentDate((d) => subMonths(d, 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-sm font-heading font-semibold min-w-[160px] text-center">
          {format(currentDate, "MMMM yyyy")}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCurrentDate((d) => addMonths(d, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        {!isCurrentMonth && (
          <Button
            variant="secondary"
            size="sm"
            className="ml-1"
            onClick={() => setCurrentDate(new Date())}
          >
            <CalendarDays className="size-4 mr-1.5" />
            Today
          </Button>
        )}
      </div>

      {/* Legend */}
      <CalendarLegend />

      {/* Main layout: calendar + day detail */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <CalendarGrid
            currentDate={currentDate}
            events={events}
            selectedDate={selectedDate}
            onSelectDate={(date) => setSelectedDate(date)}
            onEventClick={handleEventClick}
            isAdmin={isAdmin}
          />
        </div>

        <div>
          {selectedDate ? (
            <DayDetail
              date={selectedDate}
              events={events}
              isAdmin={isAdmin}
              onEdit={handleEditEvent}
              onDelete={setDeleteTarget}
              onAddEvent={() => handleAddEvent(selectedDate)}
            />
          ) : (
            <div className="bg-card border rounded-xl p-5 text-center text-sm text-muted-foreground">
              <CalendarDays className="size-8 mx-auto mb-2 opacity-40" />
              <p>Select a date to view its events</p>
            </div>
          )}
        </div>
      </div>

      {/* Event dialog */}
      <EventDialog
        key={dialogOpen ? (dialogMode === "edit" ? editingEvent?._id : `create-${dialogDate}`) : "closed"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        defaultDate={dialogDate}
        event={
          editingEvent
            ? {
                _id: editingEvent._id,
                title: editingEvent.title,
                description: editingEvent.description,
                eventType: editingEvent.eventType as EventType,
                date: editingEvent.date,
                startTime: editingEvent.startTime,
                endTime: editingEvent.endTime,
                allDay: editingEvent.allDay,
                location: editingEvent.location,
                teamsLink: editingEvent.teamsLink,
                attendanceEnabled: editingEvent.attendanceEnabled,
                maxAttendees: editingEvent.maxAttendees,
              }
            : undefined
        }
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{deleteTarget?.title}" from the calendar. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
