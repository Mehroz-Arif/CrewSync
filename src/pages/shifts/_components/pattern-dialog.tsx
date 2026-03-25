import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
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
  positions?: string[];
};

type PatternData = {
  _id: Id<"shiftPatterns">;
  name: string;
  patternType: "weekly" | "rotation";
  days?: number[];
  daysOn?: number;
  daysOff?: number;
  rotationStartDate?: string;
  rotationEndDate?: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  startTime: string;
  endTime: string;
  vehicle?: string;
  callSign?: string;
  staffRole?: string;
  notes?: string;
  memberIds: Id<"users">[];
  crewNumber?: number;
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
  const positionOptions = useQuery(api.positions.list);

  const [name, setName] = useState(() => pattern?.name ?? "");
  const [patternType, setPatternType] = useState<"weekly" | "rotation">(
    () => pattern?.patternType ?? "weekly"
  );

  // Weekly fields
  const [selectedDays, setSelectedDays] = useState<Set<number>>(
    () => new Set(pattern?.days ?? [])
  );

  // Rotation fields
  const [daysOn, setDaysOn] = useState(() => pattern?.daysOn ?? 4);
  const [daysOff, setDaysOff] = useState(() => pattern?.daysOff ?? 4);
  const [rotationStartDate, setRotationStartDate] = useState(
    () => pattern?.rotationStartDate ?? ""
  );
  const [rotationEndDate, setRotationEndDate] = useState(
    () => pattern?.rotationEndDate ?? ""
  );

  // Effective date range (applies to all pattern types)
  const [effectiveStartDate, setEffectiveStartDate] = useState(
    () => pattern?.effectiveStartDate ?? ""
  );
  const [effectiveEndDate, setEffectiveEndDate] = useState(
    () => pattern?.effectiveEndDate ?? ""
  );

  // Shared fields
  const [startTime, setStartTime] = useState(() => pattern?.startTime ?? "08:00");
  const [endTime, setEndTime] = useState(() => pattern?.endTime ?? "16:00");
  const [vehicle, setVehicle] = useState(() => pattern?.vehicle ?? "");
  const [callSign, setCallSign] = useState(() => pattern?.callSign ?? "");
  const [staffRole, setStaffRole] = useState(() => pattern?.staffRole ?? "");
  const [notes, setNotes] = useState(() => pattern?.notes ?? "");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    () => new Set(pattern?.memberIds ?? [])
  );
  const [crewNumber, setCrewNumber] = useState(() => pattern?.crewNumber ?? 1);
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

    if (patternType === "weekly" && selectedDays.size === 0) {
      toast.error("Select at least one day");
      return;
    }

    if (patternType === "rotation") {
      if (daysOn < 1 || daysOff < 1) {
        toast.error("Days on and off must be at least 1");
        return;
      }
      if (!rotationStartDate) {
        toast.error("Please set a rotation start date");
        return;
      }
      if (!rotationEndDate) {
        toast.error("Please set a rotation end date");
        return;
      }
      if (rotationEndDate <= rotationStartDate) {
        toast.error("End date must be after start date");
        return;
      }
    }

    // Validate effective date range
    if (effectiveStartDate && effectiveEndDate && effectiveEndDate <= effectiveStartDate) {
      toast.error("Effective end date must be after start date");
      return;
    }

    setIsSubmitting(true);
    try {
      const memberIds = [...selectedMembers] as Id<"users">[];

      if (mode === "create") {
        await createPattern({
          name: name.trim(),
          patternType,
          days: patternType === "weekly" ? [...selectedDays].sort((a, b) => a - b) : undefined,
          daysOn: patternType === "rotation" ? daysOn : undefined,
          daysOff: patternType === "rotation" ? daysOff : undefined,
          rotationStartDate: patternType === "rotation" ? rotationStartDate : undefined,
          rotationEndDate: patternType === "rotation" ? rotationEndDate : undefined,
          effectiveStartDate: effectiveStartDate || undefined,
          effectiveEndDate: effectiveEndDate || undefined,
          startTime,
          endTime,
          vehicle: vehicle.trim() || undefined,
          callSign: callSign.trim() || undefined,
          staffRole: staffRole.trim() || undefined,
          notes: notes.trim() || undefined,
          memberIds,
          crewNumber,
        });
        toast.success("Pattern created");
      } else if (pattern) {
        await updatePattern({
          patternId: pattern._id,
          name: name.trim(),
          patternType,
          days: patternType === "weekly" ? [...selectedDays].sort((a, b) => a - b) : undefined,
          daysOn: patternType === "rotation" ? daysOn : undefined,
          daysOff: patternType === "rotation" ? daysOff : undefined,
          rotationStartDate: patternType === "rotation" ? rotationStartDate : undefined,
          rotationEndDate: patternType === "rotation" ? rotationEndDate : undefined,
          effectiveStartDate: effectiveStartDate || undefined,
          effectiveEndDate: effectiveEndDate || undefined,
          startTime,
          endTime,
          vehicle: vehicle.trim() || undefined,
          callSign: callSign.trim() || undefined,
          staffRole: staffRole.trim() || undefined,
          notes: notes.trim() || undefined,
          memberIds,
          crewNumber,
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
              placeholder={patternType === "weekly" ? "A-Shift Weekdays" : "4 on 4 off — Engine 7"}
            />
          </div>

          {/* Staff Role */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Staff Role</Label>
            <p className="text-xs text-muted-foreground -mt-0.5">
              The role required for this shift pattern.
            </p>
            <Select value={staffRole || "none"} onValueChange={(v) => setStaffRole(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select staff role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No role</SelectItem>
                {positionOptions?.map((jt) => (
                  <SelectItem key={jt._id} value={jt.label}>{jt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pattern Type Toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Pattern Type</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPatternType("weekly")}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-semibold transition-all border",
                  patternType === "weekly"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => setPatternType("rotation")}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-semibold transition-all border",
                  patternType === "rotation"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                )}
              >
                Rotation
              </button>
            </div>
          </div>

          {/* Weekly: Day Selection */}
          {patternType === "weekly" && (
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
          )}

          {/* Rotation: Days on/off + date range */}
          {patternType === "rotation" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Days On</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={daysOn}
                    onChange={(e) => setDaysOn(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Days Off</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={daysOff}
                    onChange={(e) => setDaysOff(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Cycle: {daysOn} day{daysOn !== 1 ? "s" : ""} on, {daysOff} day{daysOff !== 1 ? "s" : ""} off ({daysOn + daysOff}-day cycle)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Rotation Start</Label>
                  <Input
                    type="date"
                    value={rotationStartDate}
                    onChange={(e) => setRotationStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Rotation End</Label>
                  <Input
                    type="date"
                    value={rotationEndDate}
                    onChange={(e) => setRotationEndDate(e.target.value)}
                    min={rotationStartDate || undefined}
                  />
                </div>
              </div>
            </>
          )}

          {/* Effective Date Range (optional, all pattern types) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Active Date Range
              <span className="text-muted-foreground font-normal ml-1">(optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground -mt-0.5">
              Limit when this pattern generates shifts. Leave blank for no limit.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="date"
                value={effectiveStartDate}
                onChange={(e) => setEffectiveStartDate(e.target.value)}
                placeholder="Start date"
              />
              <Input
                type="date"
                value={effectiveEndDate}
                onChange={(e) => setEffectiveEndDate(e.target.value)}
                min={effectiveStartDate || undefined}
                placeholder="End date"
              />
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

          {/* Call Sign */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Call Sign
              <span className="text-muted-foreground font-normal ml-1">(optional)</span>
            </Label>
            <Input
              value={callSign}
              onChange={(e) => setCallSign(e.target.value)}
              placeholder="Alpha-1"
            />
          </div>

          {/* Crew Number */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Crew Number</Label>
            <p className="text-xs text-muted-foreground -mt-0.5">
              How many separate shifts to create per day. E.g. 2 = two shift slots on the schedule.
            </p>
            <Input
              type="number"
              min={1}
              max={10}
              value={crewNumber}
              onChange={(e) => setCrewNumber(Math.max(1, parseInt(e.target.value) || 1))}
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
