import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Check,
  X as XIcon,
  Clock,
  Trash2,
  Plus,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type AvailabilityEntry = {
  _id: Id<"availability">;
  date: string;
  status: "available" | "unavailable";
  allDay?: boolean;
  startTime?: string;
  endTime?: string;
  notes?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string; // "YYYY-MM-DD"
  entries: AvailabilityEntry[];
};

export default function AvailabilityDialog({
  open,
  onOpenChange,
  date,
  entries,
}: Props) {
  const addAvailability = useMutation(api.availability.add);
  const removeAvailability = useMutation(api.availability.remove);

  // New entry form state
  const [status, setStatus] = useState<"available" | "unavailable">("available");
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"availability"> | null>(null);

  function resetForm() {
    setStatus("available");
    setAllDay(true);
    setStartTime("08:00");
    setEndTime("18:00");
    setNotes("");
  }

  async function handleAdd() {
    setSaving(true);
    try {
      await addAvailability({
        date,
        status,
        allDay,
        startTime: allDay ? undefined : startTime,
        endTime: allDay ? undefined : endTime,
        notes: notes.trim() || undefined,
      });
      toast.success(
        `Marked as ${status}${allDay ? " (all day)" : ` (${startTime} – ${endTime})`}`
      );
      resetForm();
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to add availability");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: Id<"availability">) {
    setDeletingId(id);
    try {
      await removeAvailability({ id });
      toast.success("Entry removed");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to remove entry");
      }
    } finally {
      setDeletingId(null);
    }
  }

  const formattedDate = (() => {
    try {
      return format(parseISO(date), "EEEE, MMMM d, yyyy");
    } catch {
      return date;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-5" />
            Availability
          </DialogTitle>
          <DialogDescription>{formattedDate}</DialogDescription>
        </DialogHeader>

        {/* Existing entries */}
        {entries.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Current entries
            </p>
            <div className="space-y-1.5">
              {entries.map((entry) => (
                <div
                  key={entry._id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm border",
                    entry.status === "available"
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-rose-500/10 border-rose-500/30"
                  )}
                >
                  {entry.status === "available" ? (
                    <Check className="size-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XIcon className="size-4 text-rose-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium capitalize">
                      {entry.status}
                    </span>
                    {entry.allDay === false && entry.startTime && entry.endTime ? (
                      <span className="text-muted-foreground ml-1.5">
                        {entry.startTime} – {entry.endTime}
                      </span>
                    ) : (
                      <span className="text-muted-foreground ml-1.5">
                        All day
                      </span>
                    )}
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(entry._id)}
                    disabled={deletingId === entry._id}
                  >
                    {deletingId === entry._id ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add new entry form */}
        <div className="space-y-4 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Add new entry
          </p>

          {/* Status selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatus("available")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium border transition-colors",
                status === "available"
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                  : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              <Check className="size-4" />
              Available
            </button>
            <button
              type="button"
              onClick={() => setStatus("unavailable")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium border transition-colors",
                status === "unavailable"
                  ? "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-400"
                  : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              <XIcon className="size-4" />
              Unavailable
            </button>
          </div>

          {/* All day toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="allDay" className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-muted-foreground" />
              All day
            </Label>
            <Switch
              id="allDay"
              checked={allDay}
              onCheckedChange={setAllDay}
            />
          </div>

          {/* Time range (shown when not all-day) */}
          {!allDay && (
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="startTime" className="text-xs text-muted-foreground">
                  Start time
                </Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <span className="text-muted-foreground mt-5">–</span>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="endTime" className="text-xs text-muted-foreground">
                  End time
                </Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs text-muted-foreground">
              Notes (optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Doctor appointment, school run..."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Add button */}
          <Button
            className="w-full"
            onClick={handleAdd}
            disabled={saving || (!allDay && (!startTime || !endTime))}
          >
            {saving ? (
              <Spinner className="mr-2" />
            ) : (
              <Plus className="size-4 mr-2" />
            )}
            Add {status === "available" ? "Availability" : "Unavailability"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
