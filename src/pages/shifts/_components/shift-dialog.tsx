import { useState, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";

type StaffMember = {
  _id: Id<"users">;
  name?: string;
  role?: string;
};

type ShiftData = {
  _id: Id<"shifts">;
  startTime: string;
  endTime: string;
  vehicle: string;
  callSign?: string;
  position?: string;
  notes?: string;
  members: Array<{
    membershipId: Id<"shiftMembers">;
    userId: Id<"users">;
    name: string;
  }>;
};

type ShiftDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  defaultDate?: string;
  defaultUserId?: Id<"users">;
  shift?: ShiftData;
  staff: StaffMember[];
};

export default function ShiftDialog({
  open,
  onOpenChange,
  mode,
  defaultDate,
  defaultUserId,
  shift,
  staff,
}: ShiftDialogProps) {
  const createShift = useMutation(api.shifts.create);
  const updateShift = useMutation(api.shifts.update);
  const deleteShift = useMutation(api.shifts.remove);
  const positionOptions = useQuery(api.positions.list);

  const [date, setDate] = useState(() => {
    if (shift) return format(parseISO(shift.startTime), "yyyy-MM-dd");
    return defaultDate ?? format(new Date(), "yyyy-MM-dd");
  });
  const [startTime, setStartTime] = useState(() => {
    if (shift) return format(parseISO(shift.startTime), "HH:mm");
    return "08:00";
  });
  const [endTime, setEndTime] = useState(() => {
    if (shift) return format(parseISO(shift.endTime), "HH:mm");
    return "16:00";
  });
  const [vehicle, setVehicle] = useState(() => shift?.vehicle ?? "");
  const [callSign, setCallSign] = useState(() => shift?.callSign ?? "");
  const [position, setPosition] = useState(() => shift?.position ?? "");
  const [notes, setNotes] = useState(() => shift?.notes ?? "");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(() => {
    if (shift) return new Set(shift.members.map((m) => m.userId));
    if (defaultUserId) return new Set([defaultUserId]);
    return new Set();
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");

  function toggleMember(uid: string) {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function handleSubmit() {
    if (!vehicle.trim()) {
      toast.error("Please enter a vehicle name");
      return;
    }
    // Allow unassigned shifts for the pool

    setIsSubmitting(true);
    try {
      // Build ISO times — handle overnight shifts
      const startDate = new Date(`${date}T${startTime}:00`);
      let endDate = new Date(`${date}T${endTime}:00`);
      if (endDate <= startDate) {
        endDate = new Date(endDate.getTime() + 86400000); // next day
      }

      const memberIds = [...selectedMembers] as Id<"users">[];

      if (mode === "create") {
        await createShift({
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          vehicle: vehicle.trim(),
          callSign: callSign.trim() || undefined,
          position: position.trim() || undefined,
          notes: notes.trim() || undefined,
          memberIds,
        });
        toast.success("Shift created");
      } else if (shift) {
        await updateShift({
          shiftId: shift._id,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          vehicle: vehicle.trim(),
          callSign: callSign.trim() || undefined,
          position: position.trim() || undefined,
          notes: notes.trim() || undefined,
          memberIds,
        });
        toast.success("Shift updated");
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const msg = (error.data as { message: string }).message;
        toast.error(msg);
      } else {
        toast.error("Something went wrong");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!shift) return;
    setIsSubmitting(true);
    try {
      await deleteShift({ shiftId: shift._id });
      toast.success("Shift deleted");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        const msg = (error.data as { message: string }).message;
        toast.error(msg);
      } else {
        toast.error("Failed to delete shift");
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
            {mode === "create" ? "Create Shift" : "Edit Shift"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
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

          {/* Call Sign */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Call Sign</Label>
            <Input
              value={callSign}
              onChange={(e) => setCallSign(e.target.value)}
              placeholder="Alpha 1, Bravo 2..."
            />
          </div>

          {/* Position */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Position</Label>
            <Select
              value={position || "none"}
              onValueChange={(v) => setPosition(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No position</SelectItem>
                {positionOptions?.map((pos) => (
                  <SelectItem key={pos.label} value={pos.label}>
                    <div className="flex items-center gap-2">
                      {pos.color && (
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: pos.color }}
                        />
                      )}
                      {pos.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions..."
              rows={2}
            />
          </div>

          {/* Crew assignment */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Assign Crew</Label>
            <CrewSearchList
              staff={staff}
              selectedMembers={selectedMembers}
              onToggle={toggleMember}
            />
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
              "Create Shift"
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CrewSearchList({
  staff,
  selectedMembers,
  onToggle,
}: {
  staff: StaffMember[];
  selectedMembers: Set<string>;
  onToggle: (uid: string) => void;
}) {
  const [search, setSearch] = useState("");

  // Show selected members first, then filter by search
  const { selected, filtered } = useMemo(() => {
    const q = search.toLowerCase().trim();
    const sel = staff.filter((m) => selectedMembers.has(m._id));
    const rest = staff.filter((m) => !selectedMembers.has(m._id));
    const matchingRest = q
      ? rest.filter((m) => (m.name ?? "").toLowerCase().includes(q))
      : rest;
    return { selected: sel, filtered: matchingRest };
  }, [staff, selectedMembers, search]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b">
        <Input
          placeholder="Search team members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
      <div className="max-h-36 overflow-y-auto divide-y">
        {selected.map((member) => (
          <label
            key={member._id}
            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors bg-primary/5"
          >
            <Checkbox
              checked={true}
              onCheckedChange={() => onToggle(member._id)}
            />
            <span className="text-sm font-medium">
              {member.name ?? "Unknown"}
            </span>
            {member.role === "admin" && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                Admin
              </span>
            )}
          </label>
        ))}
        {filtered.map((member) => (
          <label
            key={member._id}
            className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
          >
            <Checkbox
              checked={false}
              onCheckedChange={() => onToggle(member._id)}
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
        {filtered.length === 0 && selected.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">
            No members found
          </p>
        )}
      </div>
    </div>
  );
}
