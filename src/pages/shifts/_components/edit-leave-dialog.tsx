import { useState, useEffect } from "react";
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

type EditLeaveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveRequestId: Id<"leaveRequests">;
  userName: string;
  initialLeaveType: LeaveType;
  initialStartDate: string;
  initialEndDate: string;
  initialReason?: string;
};

export default function EditLeaveDialog({
  open,
  onOpenChange,
  leaveRequestId,
  userName,
  initialLeaveType,
  initialStartDate,
  initialEndDate,
  initialReason,
}: EditLeaveDialogProps) {
  const updateAbsence = useMutation(api.leaveRequests.adminUpdateAbsence);
  const deleteAbsence = useMutation(api.leaveRequests.adminDeleteAbsence);

  const [leaveType, setLeaveType] = useState<LeaveType>(initialLeaveType);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [reason, setReason] = useState(initialReason ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      setLeaveType(initialLeaveType);
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
      setReason(initialReason ?? "");
    }
  }, [open, initialLeaveType, initialStartDate, initialEndDate, initialReason]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAbsence({
        requestId: leaveRequestId,
        leaveType,
        startDate,
        endDate: endDate < startDate ? startDate : endDate,
        reason: reason.trim() || undefined,
      });
      toast.success(`Absence updated for ${userName}`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to update absence");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAbsence({ requestId: leaveRequestId });
      toast.success(`Absence removed for ${userName}`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to delete absence");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit absence</DialogTitle>
          <DialogDescription>
            Update or remove absence for {userName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-leave-type">Type</Label>
            <Select
              value={leaveType}
              onValueChange={(v) => setLeaveType(v as LeaveType)}
            >
              <SelectTrigger id="edit-leave-type">
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
              <Label htmlFor="edit-start-date">Start date</Label>
              <Input
                id="edit-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end-date">End date</Label>
              <Input
                id="edit-end-date"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-reason">Reason (optional)</Label>
            <Input
              id="edit-reason"
              placeholder="e.g. Doctor's appointment"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
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
