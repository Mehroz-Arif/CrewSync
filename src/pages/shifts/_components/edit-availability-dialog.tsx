import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Switch } from "@/components/ui/switch.tsx";

type AvailabilityStatus = "available" | "unavailable";

type EditAvailabilityDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availabilityId: Id<"availability">;
  userName: string;
  date: string;
  initialStatus: AvailabilityStatus;
  initialAllDay: boolean;
  initialStartTime?: string;
  initialEndTime?: string;
  initialNotes?: string;
};

export default function EditAvailabilityDialog({
  open,
  onOpenChange,
  availabilityId,
  userName,
  date,
  initialStatus,
  initialAllDay,
  initialStartTime,
  initialEndTime,
  initialNotes,
}: EditAvailabilityDialogProps) {
  const updateAvailability = useMutation(api.availability.adminUpdate);
  const deleteAvailability = useMutation(api.availability.adminDelete);

  const [status, setStatus] = useState<AvailabilityStatus>(initialStatus);
  const [allDay, setAllDay] = useState(initialAllDay);
  const [startTime, setStartTime] = useState(initialStartTime ?? "09:00");
  const [endTime, setEndTime] = useState(initialEndTime ?? "17:00");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setStatus(initialStatus);
      setAllDay(initialAllDay);
      setStartTime(initialStartTime ?? "09:00");
      setEndTime(initialEndTime ?? "17:00");
      setNotes(initialNotes ?? "");
    }
  }, [open, initialStatus, initialAllDay, initialStartTime, initialEndTime, initialNotes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAvailability({
        id: availabilityId,
        status,
        allDay,
        startTime: allDay ? undefined : startTime,
        endTime: allDay ? undefined : endTime,
        notes: notes.trim() || undefined,
      });
      toast.success(`Availability updated for ${userName}`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to update availability");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAvailability({ id: availabilityId });
      toast.success(`Availability entry removed for ${userName}`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to delete availability");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit availability</DialogTitle>
          <DialogDescription>
            Update or remove availability for {userName} on {date}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-avail-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as AvailabilityStatus)}
            >
              <SelectTrigger id="edit-avail-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="edit-avail-allday"
              checked={allDay}
              onCheckedChange={setAllDay}
            />
            <Label htmlFor="edit-avail-allday">All day</Label>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-avail-start">Start time</Label>
                <Input
                  id="edit-avail-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-avail-end">End time</Label>
                <Input
                  id="edit-avail-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-avail-notes">Notes (optional)</Label>
            <Input
              id="edit-avail-notes"
              placeholder="e.g. Only available mornings"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="sm:mr-auto"
            >
              {deleting && <Spinner className="mr-2" />}
              Delete
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || deleting}>
              {saving && <Spinner className="mr-2" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
