import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { LogIn, LogOut, Clock, Coffee } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { format } from "date-fns";

export default function ClockInOut() {
  const activeEntry = useQuery(api.timeTracking.getActiveEntry);
  const clockIn = useMutation(api.timeTracking.clockIn);
  const clockOut = useMutation(api.timeTracking.clockOut);
  const [notes, setNotes] = useState("");
  const [breakMins, setBreakMins] = useState(0);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState("");

  // Live timer when clocked in
  useEffect(() => {
    if (!activeEntry) {
      setElapsed("");
      return;
    }
    const tick = () => {
      const ms = Date.now() - new Date(activeEntry.clockIn).getTime();
      const hrs = Math.floor(ms / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      setElapsed(
        `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  const handleClockIn = async () => {
    setLoading(true);
    try {
      await clockIn({ notes: notes || undefined });
      toast.success("Clocked in successfully");
      setNotes("");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to clock in");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    setLoading(true);
    try {
      await clockOut({
        entryId: activeEntry._id,
        breakMinutes: breakMins,
        notes: notes || undefined,
      });
      toast.success("Clocked out successfully");
      setNotes("");
      setBreakMins(0);
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to clock out");
      }
    } finally {
      setLoading(false);
    }
  };

  const isClockedIn = !!activeEntry;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors",
        isClockedIn && "border-emerald-500/40"
      )}
    >
      {/* Status banner */}
      <div
        className={cn(
          "px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2",
          isClockedIn
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "bg-muted/50 text-muted-foreground"
        )}
      >
        <div
          className={cn(
            "size-2 rounded-full",
            isClockedIn ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
          )}
        />
        {isClockedIn ? "Clocked In" : "Not Clocked In"}
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="size-5" />
          Time Clock
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Timer display when clocked in */}
        {isClockedIn && (
          <div className="text-center py-4">
            <div className="font-mono text-4xl font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
              {elapsed}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Started at{" "}
              {format(new Date(activeEntry.clockIn), "h:mm a")}
            </p>
          </div>
        )}

        {/* Break time (only when clocked in) */}
        {isClockedIn && (
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Coffee className="size-3.5" />
              Break time (minutes)
            </Label>
            <div className="flex items-center gap-2">
              {[0, 15, 30, 45, 60].map((mins) => (
                <Button
                  key={mins}
                  variant={breakMins === mins ? "default" : "secondary"}
                  size="sm"
                  className="text-xs"
                  onClick={() => setBreakMins(mins)}
                >
                  {mins}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs">Notes (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isClockedIn ? "Add notes for this shift..." : "Add notes before clocking in..."}
            rows={2}
            className="text-sm resize-none"
          />
        </div>

        {/* Action button */}
        <Button
          onClick={isClockedIn ? handleClockOut : handleClockIn}
          disabled={loading}
          size="lg"
          className={cn(
            "w-full text-sm font-semibold",
            isClockedIn
              ? "bg-rose-600 hover:bg-rose-700 text-white"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          )}
        >
          {loading ? (
            <Spinner className="size-4 mr-2" />
          ) : isClockedIn ? (
            <LogOut className="size-4 mr-2" />
          ) : (
            <LogIn className="size-4 mr-2" />
          )}
          {isClockedIn ? "Clock Out" : "Clock In"}
        </Button>
      </CardContent>
    </Card>
  );
}
