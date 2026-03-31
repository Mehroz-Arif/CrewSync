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
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";

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
  initialStatus?: string;
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
  initialStatus,
}: EditLeaveDialogProps) {
  const updateAbsence = useMutation(api.leaveRequests.adminUpdateAbsence);
  const deleteAbsence = useMutation(api.leaveRequests.adminDeleteAbsence);
  const reviewLeave = useMutation(api.leaveRequests.review);

  const [leaveType, setLeaveType] = useState<LeaveType>(initialLeaveType);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [reason, setReason] = useState(initialReason ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const isPending = initialStatus === "pending";

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

  const handleApprove = async () => {
    setApproving(true);
    try {
      await reviewLeave({ requestId: leaveRequestId, decision: "approved" });
      toast.success(`Absence approved for ${userName}`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to approve absence");
      }
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await reviewLeave({ requestId: leaveRequestId, decision: "rejected" });
      toast.success(`Absence rejected for ${userName}`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to reject absence");
      }
    } finally {
      setRejecting(false);
    }
  };

  const isBusy = saving || deleting || approving || rejecting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit absence
            {isPending && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px]">
                Pending approval
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Update or remove absence for {userName}
          </DialogDescription>
        </DialogHeader>

        {/* Approve / Reject bar for pending absences */}
        {isPending && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <span className="text-sm text-amber-800 dark:text-amber-200 flex-1">
              This absence is awaiting approval
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900"
              onClick={handleReject}
              disabled={isBusy}
            >
              {rejecting ? <Spinner className="mr-1" /> : <XCircle className="size-4 mr-1" />}
              Reject
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleApprove}
              disabled={isBusy}
            >
              {approving ? <Spinner className="mr-1" /> : <CheckCircle2 className="size-4 mr-1" />}
              Approve
            </Button>
          </div>
        )}

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
              disabled={isBusy}
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
            <Button type="submit" disabled={isBusy}>
              {saving && <Spinner className="mr-2" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
