import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
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
import { format } from "date-fns";

const LEAVE_TYPES = [
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "compassionate", label: "Compassionate Leave" },
  { value: "training", label: "Training" },
  { value: "unpaid", label: "Unpaid Leave" },
  { value: "other", label: "Other" },
] as const;

type LeaveType = (typeof LEAVE_TYPES)[number]["value"];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function LeaveRequestDialog({ open, onOpenChange }: Props) {
  const submitRequest = useMutation(api.leaveRequests.submit);
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }
    setSubmitting(true);
    try {
      await submitRequest({
        leaveType,
        startDate,
        endDate,
        reason: reason || undefined,
      });
      toast.success("Leave request submitted");
      onOpenChange(false);
      // Reset form
      setLeaveType("annual");
      setReason("");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to submit request");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Time Off</DialogTitle>
          <DialogDescription>
            Submit a leave request for your manager to review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Leave type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Leave Type</Label>
            <Select value={leaveType} onValueChange={(v) => setLeaveType(v as LeaveType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">End Date</Label>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Reason (optional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add any details about your request..."
              rows={3}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Spinner className="size-4 mr-2" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
