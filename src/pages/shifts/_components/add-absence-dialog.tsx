import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
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

type LeaveType = "annual" | "sick" | "compassionate" | "training" | "unpaid" | "other";

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Annual leave",
  sick: "Sick leave",
  compassionate: "Compassionate",
  training: "Training",
  unpaid: "Unpaid leave",
  other: "Other",
};

type AddAbsenceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  userName: string;
  date: string; // "YYYY-MM-DD"
  membershipId?: Id<"shiftMembers">; // when triggered from a shift block
};

export default function AddAbsenceDialog({
  open,
  onOpenChange,
  userId,
  userName,
  date,
  membershipId,
}: AddAbsenceDialogProps) {
  const createAbsence = useMutation(api.leaveRequests.adminCreateAbsence);
  const addAbsenceFromShift = useMutation(api.leaveRequests.addAbsenceFromShift);
  const [leaveType, setLeaveType] = useState<LeaveType>("sick");
  const [endDate, setEndDate] = useState(date);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const isFromShift = !!membershipId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const finalEndDate = endDate < date ? date : endDate;
      const trimmedReason = reason.trim() || undefined;

      if (membershipId) {
        // Shift-level: creates pending leave request + unassigns from shift
        await addAbsenceFromShift({
          userId,
          membershipId,
          leaveType,
          startDate: date,
          endDate: finalEndDate,
          reason: trimmedReason,
        });
        toast.success(`Absence submitted for ${userName} — pending approval. Shift returned to unassigned.`);
      } else {
        // Cell-level: admin creates auto-approved absence
        await createAbsence({
          userId,
          leaveType,
          startDate: date,
          endDate: finalEndDate,
          reason: trimmedReason,
        });
        toast.success(`Absence added for ${userName}`);
      }

      onOpenChange(false);
      setLeaveType("sick");
      setReason("");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to add absence");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setEndDate(date);
      setReason("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add absence</DialogTitle>
          <DialogDescription>
            Record an absence for {userName} starting{" "}
            {format(parseISO(date), "EEE, d MMM yyyy")}
            {isFromShift && (
              <span className="block mt-1 text-amber-600 dark:text-amber-400">
                This will unassign them from the shift and create a leave request pending approval.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leave-type">Type</Label>
            <Select
              value={leaveType}
              onValueChange={(v) => setLeaveType(v as LeaveType)}
            >
              <SelectTrigger id="leave-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input type="date" value={date} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                min={date}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input
              id="reason"
              placeholder="e.g. Doctor's appointment"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner className="mr-2" />}
              {isFromShift ? "Submit absence" : "Add absence"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
