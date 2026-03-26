import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  startOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  format,
  isToday,
  isThisWeek,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Truck,
  Radio,
  Copy,
  X,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

export default function VehicleAllocationsTab() {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const startDate = format(weekStart, "yyyy-MM-dd");
  const endDate = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const allocations = useQuery(api.vehicleAllocations.getByDateRange, {
    startDate,
    endDate,
  });
  const callSigns = useQuery(api.vehicleAllocations.getCallSigns);
  const vehiclesList = useQuery(api.vehicles.list);
  const vehicles = useMemo(
    () => vehiclesList?.map((v) => v.registration) ?? [],
    [vehiclesList]
  );
  const setAllocation = useMutation(api.vehicleAllocations.setAllocation);
  const removeAllocation = useMutation(api.vehicleAllocations.removeAllocation);
  const copyAllocations = useMutation(api.vehicleAllocations.copyAllocations);

  // Build lookup: "date__callSign" → allocation
  const allocationMap = useMemo(() => {
    const map = new Map<
      string,
      { _id: string; vehicle: string; notes?: string }
    >();
    if (!allocations) return map;
    for (const a of allocations) {
      map.set(`${a.date}__${a.callSign}`, {
        _id: a._id,
        vehicle: a.vehicle,
        notes: a.notes,
      });
    }
    return map;
  }, [allocations]);

  // Build lookup: date → set of vehicles already assigned that day
  const takenVehiclesByDate = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    if (!allocations) return map;
    for (const a of allocations) {
      if (!map.has(a.date)) map.set(a.date, new Map());
      map.get(a.date)!.set(a.vehicle, a.callSign);
    }
    return map;
  }, [allocations]);

  const isCurrentWeek = isThisWeek(weekStart, { weekStartsOn: 1 });

  const handleSetAllocation = async (
    date: string,
    callSign: string,
    vehicle: string
  ) => {
    try {
      await setAllocation({ date, callSign, vehicle });
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to set allocation");
      }
    }
  };

  const handleRemoveAllocation = async (allocationId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await removeAllocation({ allocationId: allocationId as any });
      toast.success("Allocation removed");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to remove allocation");
      }
    }
  };

  const handleCopyDay = async (fromDate: string, toDate: string) => {
    try {
      const count = await copyAllocations({ fromDate, toDate });
      if (count > 0) {
        toast.success(
          `Copied ${count} allocation${count !== 1 ? "s" : ""}`
        );
      } else {
        toast.info("No allocations to copy");
      }
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to copy allocations");
      }
    }
  };

  if (
    allocations === undefined ||
    callSigns === undefined ||
    vehiclesList === undefined
  ) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    );
  }

  if (callSigns.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Radio />
          </EmptyMedia>
          <EmptyTitle>No call signs found</EmptyTitle>
          <EmptyDescription>
            Create shift patterns with call signs first, then allocate vehicles
            here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      {/* Week navigator */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setWeekStart((w) => subWeeks(w, 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-sm font-heading font-semibold min-w-[200px] text-center">
          {format(weekStart, "MMM d")} –{" "}
          {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        {!isCurrentWeek && (
          <Button
            variant="secondary"
            size="sm"
            className="ml-1"
            onClick={() =>
              setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
          >
            <CalendarDays className="size-4 mr-1.5" />
            Today
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Assign a vehicle to each call sign per day. Use the copy button to
        duplicate a day{"'"}s allocations.
      </p>

      {/* Allocation grid */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="sticky left-0 z-10 bg-card px-3 py-2.5 text-left font-heading font-semibold text-xs text-muted-foreground w-28">
                <div className="flex items-center gap-1.5">
                  <Radio className="size-3.5" />
                  Call Sign
                </div>
              </th>
              {weekDates.map((date) => {
                const dateStr = format(date, "yyyy-MM-dd");
                const today = isToday(date);
                return (
                  <th
                    key={dateStr}
                    className={cn(
                      "px-2 py-2.5 text-center font-heading text-xs min-w-[140px]",
                      today && "bg-primary/5"
                    )}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-muted-foreground font-medium">
                        {format(date, "EEE")}
                      </span>
                      <span
                        className={cn(
                          "font-semibold",
                          today && "text-primary"
                        )}
                      >
                        {format(date, "d MMM")}
                      </span>
                    </div>
                    {/* Copy from previous day */}
                    {weekDates.indexOf(date) > 0 && (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="mt-1 size-6"
                              onClick={() => {
                                const prevDate = format(
                                  addDays(date, -1),
                                  "yyyy-MM-dd"
                                );
                                handleCopyDay(prevDate, dateStr);
                              }}
                            >
                              <Copy className="size-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Copy from {format(addDays(date, -1), "EEE")}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {callSigns.map((callSign) => (
              <tr key={callSign} className="border-b last:border-b-0">
                <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-medium">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Radio className="size-3" />
                    {callSign}
                  </Badge>
                </td>
                {weekDates.map((date) => {
                  const dateStr = format(date, "yyyy-MM-dd");
                  const key = `${dateStr}__${callSign}`;
                  const allocation = allocationMap.get(key);
                  const today = isToday(date);

                  return (
                    <td
                      key={dateStr}
                      className={cn(
                        "px-2 py-2 text-center",
                        today && "bg-primary/5"
                      )}
                    >
                      <AllocationCell
                        allocation={allocation}
                        vehicles={vehicles}
                        takenVehicles={takenVehiclesByDate.get(dateStr)}
                        currentCallSign={callSign}
                        onSet={(vehicle) =>
                          handleSetAllocation(dateStr, callSign, vehicle)
                        }
                        onRemove={() =>
                          allocation && handleRemoveAllocation(allocation._id)
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
          <span>Allocated</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-muted border border-dashed border-muted-foreground/30" />
          <span>Unallocated</span>
        </div>
      </div>
    </div>
  );
}

/** Individual cell for a callSign+date intersection */
function AllocationCell({
  allocation,
  vehicles,
  takenVehicles,
  currentCallSign,
  onSet,
  onRemove,
}: {
  allocation?: { _id: string; vehicle: string; notes?: string };
  vehicles: string[];
  takenVehicles?: Map<string, string>;
  currentCallSign: string;
  onSet: (vehicle: string) => void;
  onRemove: () => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteValue, setNoteValue] = useState("");

  if (allocation) {
    return (
      <div className="group relative inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5">
        <Truck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="font-medium text-xs text-emerald-700 dark:text-emerald-300">
          {allocation.vehicle}
        </span>
        {allocation.notes && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger>
                <StickyNote className="size-3 text-emerald-500/60" />
              </TooltipTrigger>
              <TooltipContent>{allocation.notes}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <button
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="size-2.5" />
        </button>
      </div>
    );
  }

  return (
    <Popover open={notesOpen} onOpenChange={setNotesOpen}>
      <Select
        onValueChange={(val) => {
          if (val === "__custom__") {
            setNotesOpen(true);
            return;
          }
          onSet(val);
        }}
      >
        <SelectTrigger className="h-8 text-xs text-muted-foreground border-dashed w-[120px] mx-auto">
          <SelectValue placeholder="Assign..." />
        </SelectTrigger>
        <SelectContent>
          {vehicles.map((v) => {
            const assignedTo = takenVehicles?.get(v);
            const isUsedElsewhere = assignedTo !== undefined && assignedTo !== currentCallSign;
            return (
              <SelectItem key={v} value={v}>
                <div className="flex items-center gap-1.5">
                  <Truck className="size-3" />
                  <span>{v}</span>
                  {isUsedElsewhere && (
                    <span className="text-[10px] text-muted-foreground/60 ml-1">
                      (also {assignedTo})
                    </span>
                  )}
                </div>
              </SelectItem>
            );
          })}
          <SelectItem value="__custom__">
            <span className="text-muted-foreground">Custom vehicle...</span>
          </SelectItem>
        </SelectContent>
      </Select>
      <PopoverTrigger className="hidden" />
      <PopoverContent className="w-56 p-3 space-y-2" align="center">
        <p className="text-xs font-medium">Enter vehicle registration</p>
        <Input
          placeholder="e.g. A301"
          value={noteValue}
          onChange={(e) => setNoteValue(e.target.value)}
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          className="w-full"
          disabled={!noteValue.trim()}
          onClick={() => {
            onSet(noteValue.trim());
            setNoteValue("");
            setNotesOpen(false);
          }}
        >
          Assign
        </Button>
      </PopoverContent>
    </Popover>
  );
}
