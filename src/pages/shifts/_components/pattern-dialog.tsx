import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
] as const;

type StaffMember = {
  _id: Id<"users">;
  name?: string;
  role?: string;
};

type PatternData = {
  _id: Id<"shiftPatterns">;
  name: string;
  days: number[];
  startTime: string;
  endTime: string;
  vehicle: string;
  notes?: string;
  memberIds: Id<"users">[];
  active: boolean;
};

type PatternDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  pattern?: PatternData;
  staff: StaffMember[];
};

export default function PatternDialog({
  open,
  onOpenChange,
  mode,
  pattern,
  staff,
}: PatternDialogProps) {
  const createPattern = useMutation(api.shiftPatterns.create);
  const updatePattern = useMutation(api.shiftPatterns.update);
  const deletePattern = useMutation(api.shiftPatterns.remove);

  const [name, setName] = useState(() => pattern?.name ?? "");
  const [selectedDays, setSelectedDays] = useState<Set<number>>(
    () => new Set(pattern?.days ?? [])
  );
  const [startTime, setStartTime] = useState(() => pattern?.startTime ?? "08:00");
  const [endTime, setEndTime] = useState(() => pattern?.endTime ?? "16:00");
  const [vehicle, setVehicle] = useState(() => pattern?.vehicle ?? "");
  const [notes, setNotes] = useState(() => pattern?.notes ?? "");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    () => new Set(pattern?.memberIds ?? [])
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function toggleMember(uid: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Please enter a pattern name");
      return;
    }
    if (selectedDays.size === 0) {
      toast.error("Select at least one day");
      return;
    }
    if (!vehicle.trim()) {
      toast.error("Please enter a vehicle name");
      return;
    }

    setIsSubmitting(true);
    try {
      const days = [...selectedDays].sort((a, b) => a - b);
      const memberIds = [...selectedMembers] as Id<"users">[];

      if (mode === "create") {
        await createPattern({
          name: name.trim(),
          days,
          startTime,
          endTime,
          vehicle: vehicle.trim(),
          notes: notes.trim() || undefined,
          memberIds,
        });
        toast.success("Pattern created");
      } else if (pattern) {
        await updatePattern({
          patternId: pattern._id,
          name: name.trim(),
          days,
          startTime,
          endTime,
          vehicle: vehicle.trim(),
          notes: notes.trim() || undefined,
          memberIds,
        });
        toast.success("Pattern updated");
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Something went wrong");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!pattern) return;
    setIsSubmitting(true);
    try {
      await deletePattern({ patternId: pattern._id });
      toast.success("Pattern deleted");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to delete pattern");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {mode === "create" ? "Create Pattern" : "Edit Pattern"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Pattern Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Pattern Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="A-Shift Weekdays"
            />
          </div>

          {/* Day Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Repeat On</Label>
            <div className="flex gap-1.5">
              {DAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    "flex-1 py-1.5 rounded-md text-xs font-semibold transition-all border",
                    selectedDays.has(day.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Start Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">End Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Vehicle */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Vehicle</Label>
            <Input
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="Engine 7 — Pumper Truck"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions for this recurring shift..."
              rows={2}
            />
          </div>

          {/* Crew assignment */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Default Crew</Label>
            <div className="border rounded-lg max-h-36 overflow-y-auto divide-y">
              {staff.map((member) => (
                <label
                  key={member._id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedMembers.has(member._id)}
                    onCheckedChange={() => toggleMember(member._id)}
                  />
                  <span className="text-sm">
                    {member.name ?? "Unknown"}
                  </span>
                  {member.role === "admin" && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      Admin
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {mode === "edit" && (
            <div className="mr-auto">
              {deleteStep === "idle" ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteStep("confirm")}
                  disabled={isSubmitting}
                >
                  Delete
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Spinner /> : "Confirm Delete"}
                </Button>
              )}
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <Spinner />
            ) : mode === "create" ? (
              "Create Pattern"
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
