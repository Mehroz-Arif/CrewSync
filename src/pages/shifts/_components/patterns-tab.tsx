import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  startOfWeek,
  addWeeks,
  subWeeks,
  addDays,
  format,
} from "date-fns";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Truck,
  Clock,
  Users,
  Zap,
  CalendarRange,
  RotateCw,
  Hash,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import PatternDialog from "./pattern-dialog.tsx";
import { buildRoleColorMap } from "../_lib/role-colors.ts";

const DAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

type StaffMember = {
  _id: Id<"users">;
  name?: string;
  role?: string;
};

type PatternWithMembers = {
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
  position?: string;
  positions?: string[];
  notes?: string;
  memberIds: Id<"users">[];
  crewNumber?: number;
  active: boolean;
  members: Array<{ userId: Id<"users">; name: string }>;
};

export default function PatternsTab({ staff }: { staff: StaffMember[] }) {
  const patterns = useQuery(api.shiftPatterns.list);
  const applyToWeek = useMutation(api.shiftPatterns.applyToWeek);
  const toggleActive = useMutation(api.shiftPatterns.toggleActive);
  const positionOptions = useQuery(api.positions.list);
  const roleColorMap = useMemo(() => buildRoleColorMap(positionOptions), [positionOptions]);

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [isApplying, setIsApplying] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogPattern, setDialogPattern] = useState<PatternWithMembers | undefined>();

  function handleCreate() {
    setDialogMode("create");
    setDialogPattern(undefined);
    setDialogOpen(true);
  }

  function handleEdit(pattern: PatternWithMembers) {
    setDialogMode("edit");
    setDialogPattern(pattern);
    setDialogOpen(true);
  }

  async function handleToggle(patternId: Id<"shiftPatterns">) {
    try {
      const nowActive = await toggleActive({ patternId });
      toast.success(nowActive ? "Pattern activated" : "Pattern paused");
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to toggle pattern");
      }
    }
  }

  async function handleApply() {
    setIsApplying(true);
    try {
      const result = await applyToWeek({ weekStartISO: weekStart.toISOString() });
      const parts: string[] = [];
      if (result.created > 0) {
        parts.push(`${result.created} shift${result.created !== 1 ? "s" : ""} created`);
      }
      if (result.skippedOverlaps > 0) {
        parts.push(
          `${result.skippedOverlaps} crew assignment${result.skippedOverlaps !== 1 ? "s" : ""} skipped (overlap)`
        );
      }
      if (result.skippedDuplicates > 0) {
        parts.push(
          `${result.skippedDuplicates} duplicate${result.skippedDuplicates !== 1 ? "s" : ""} skipped`
        );
      }
      if (parts.length === 0) {
        toast.info("No shifts to create — patterns may already be applied");
      } else {
        toast.success(parts.join(". "));
      }
    } catch (error) {
      if (error instanceof ConvexError) {
        toast.error((error.data as { message: string }).message);
      } else {
        toast.error("Failed to apply patterns");
      }
    } finally {
      setIsApplying(false);
    }
  }

  if (patterns === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const activeCount = patterns.filter((p) => p.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-xl">
            Recurring Patterns
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Define weekly or rotation shift templates. Apply them to fill your schedule.
          </p>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="size-4 mr-1.5" />
          New Pattern
        </Button>
      </div>

      {/* Apply to Week section */}
      {activeCount > 0 && (
        <Card className="border-primary/20 bg-primary/[0.02]">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Zap className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    Apply {activeCount} active pattern{activeCount !== 1 ? "s" : ""} to a week
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Generates shifts from your active patterns. Duplicates are skipped automatically.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setWeekStart((w) => subWeeks(w, 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="text-xs font-heading font-semibold min-w-[170px] text-center">
                  {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setWeekStart((w) => addWeeks(w, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={isApplying}
                  className="ml-2"
                >
                  {isApplying ? <Spinner /> : <Zap className="size-4 mr-1.5" />}
                  Apply
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Patterns grid */}
      {patterns.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Repeat />
            </EmptyMedia>
            <EmptyTitle>No patterns yet</EmptyTitle>
            <EmptyDescription>
              Create a recurring pattern to quickly fill your weekly schedule
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="size-4 mr-1.5" />
              Create Pattern
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patterns.map((pattern) => {
            // Use first position color for border accent
            const firstPos = pattern.positions?.[0] ?? pattern.position;
            const borderColor = firstPos ? roleColorMap[firstPos] : undefined;
            return (
              <PatternCard
                key={pattern._id}
                pattern={pattern}
                roleColor={borderColor}
                roleColorMap={roleColorMap}
                onEdit={() => handleEdit(pattern)}
                onToggle={() => handleToggle(pattern._id)}
              />
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <PatternDialog
        key={dialogOpen ? (dialogMode === "edit" ? dialogPattern?._id : "create") : "closed"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        pattern={dialogPattern}
        staff={staff}
      />
    </div>
  );
}

function PatternCard({
  pattern,
  roleColor,
  roleColorMap,
  onEdit,
  onToggle,
}: {
  pattern: PatternWithMembers;
  roleColor?: string;
  roleColorMap: Record<string, string>;
  onEdit: () => void;
  onToggle: () => void;
}) {
  // Resolve display positions: prefer positions array, fall back to legacy position
  const displayPositions = pattern.positions && pattern.positions.length > 0
    ? pattern.positions
    : pattern.position
      ? [pattern.position]
      : [];

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md border-l-4",
        !pattern.active && "opacity-60"
      )}
      style={roleColor ? { borderLeftColor: roleColor } : { borderLeftColor: "transparent" }}
      onClick={onEdit}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-sm font-heading font-bold truncate">
              {pattern.name}
            </CardTitle>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
              {pattern.patternType === "weekly" ? "Weekly" : "Rotation"}
            </Badge>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
              pattern.active
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {pattern.active ? "Active" : "Paused"}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Schedule info */}
        {pattern.patternType === "weekly" ? (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                <Badge
                  key={day}
                  variant={(pattern.days ?? []).includes(day) ? "default" : "secondary"}
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    !(pattern.days ?? []).includes(day) && "opacity-30"
                  )}
                >
                  {DAY_LABELS[day]}
                </Badge>
              ))}
            </div>
            {(pattern.effectiveStartDate || pattern.effectiveEndDate) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarRange className="size-3 shrink-0" />
                <span>
                  {pattern.effectiveStartDate
                    ? format(new Date(pattern.effectiveStartDate + "T00:00:00"), "MMM d, yyyy")
                    : "No start"}{" "}
                  –{" "}
                  {pattern.effectiveEndDate
                    ? format(new Date(pattern.effectiveEndDate + "T00:00:00"), "MMM d, yyyy")
                    : "No end"}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RotateCw className="size-3 shrink-0" />
              <span className="font-semibold text-foreground">
                {pattern.daysOn} on / {pattern.daysOff} off
              </span>
              <span className="text-muted-foreground">
                ({(pattern.daysOn ?? 0) + (pattern.daysOff ?? 0)}-day cycle)
              </span>
            </div>
            {pattern.rotationStartDate && pattern.rotationEndDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarRange className="size-3 shrink-0" />
                <span>
                  {format(new Date(pattern.rotationStartDate + "T00:00:00"), "MMM d, yyyy")} –{" "}
                  {format(new Date(pattern.rotationEndDate + "T00:00:00"), "MMM d, yyyy")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Time & Vehicle & Crew */}
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="size-3 shrink-0" />
            <span>
              {pattern.startTime} – {pattern.endTime}
            </span>
          </div>
          {pattern.vehicle && (
            <div className="flex items-center gap-2">
              <Truck className="size-3 shrink-0" />
              <span className="truncate">{pattern.vehicle}</span>
            </div>
          )}
          {pattern.callSign && (
            <div className="flex items-center gap-2">
              <Radio className="size-3 shrink-0" />
              <span className="truncate">{pattern.callSign}</span>
            </div>
          )}
          {/* Positions (multi) */}
          {displayPositions.length > 0 && (
            <div className="flex items-start gap-2">
              <ShieldCheck className="size-3 shrink-0 mt-0.5" />
              <div className="flex flex-wrap gap-1">
                {displayPositions.map((pos, idx) => {
                  const posColor = roleColorMap[pos];
                  return (
                    <span
                      key={idx}
                      className="font-semibold"
                      style={posColor ? { color: posColor } : undefined}
                    >
                      {pos}{idx < displayPositions.length - 1 ? "," : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {(pattern.crewNumber ?? 1) > 1 && (
            <div className="flex items-center gap-2">
              <Hash className="size-3 shrink-0" />
              <span className="font-semibold text-foreground">
                {pattern.crewNumber} shifts per day
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="size-3 shrink-0" />
            <span className="truncate">
              {pattern.members.length === 0
                ? "No crew assigned"
                : pattern.members.map((m) => m.name).join(", ")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
