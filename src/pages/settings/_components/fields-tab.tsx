import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  EyeOff,
  Eye,
  Briefcase,
  Palette,
} from "lucide-react";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";

const COLOR_PRESETS = [
  // Blues
  { id: "blue", hex: "#3b82f6" },
  { id: "sky", hex: "#0ea5e9" },
  { id: "cyan", hex: "#06b6d4" },
  { id: "indigo", hex: "#6366f1" },
  { id: "navy", hex: "#1e3a5f" },
  // Greens
  { id: "green", hex: "#22c55e" },
  { id: "emerald", hex: "#10b981" },
  { id: "teal", hex: "#14b8a6" },
  { id: "lime", hex: "#84cc16" },
  { id: "mint", hex: "#34d399" },
  // Reds & Pinks
  { id: "red", hex: "#ef4444" },
  { id: "rose", hex: "#f43f5e" },
  { id: "pink", hex: "#ec4899" },
  { id: "fuchsia", hex: "#d946ef" },
  { id: "coral", hex: "#f97066" },
  // Purples
  { id: "purple", hex: "#a855f7" },
  { id: "violet", hex: "#8b5cf6" },
  { id: "plum", hex: "#9333ea" },
  // Oranges & Yellows
  { id: "orange", hex: "#f97316" },
  { id: "amber", hex: "#f59e0b" },
  { id: "yellow", hex: "#eab308" },
  { id: "tangerine", hex: "#fb923c" },
  // Neutrals & Earth tones
  { id: "slate", hex: "#64748b" },
  { id: "stone", hex: "#78716c" },
  { id: "brown", hex: "#92400e" },
  { id: "charcoal", hex: "#374151" },
] as const;

export default function FieldsTab({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            Only admins can manage positions and vehicles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PositionsCard />
    </div>
  );
}

/* ─── Positions Card ─── */

function PositionsCard() {
  const positions = useQuery(api.positions.listAll);
  const createPosition = useMutation(api.positions.create);
  const updatePosition = useMutation(api.positions.update);
  const removePosition = useMutation(api.positions.remove);
  const reorderPositions = useMutation(api.positions.reorder);

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<string>(COLOR_PRESETS[0].hex);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"positions"> | null>(null);
  const [editLabel, setEditLabel] = useState("");

  if (positions === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    setAdding(true);
    try {
      await createPosition({ label: newLabel.trim(), color: newColor });
      setNewLabel("");
      toast.success("Position added");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to add position");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: Id<"positions">) => {
    if (!editLabel.trim()) return;
    try {
      await updatePosition({ id, label: editLabel.trim() });
      setEditingId(null);
      toast.success("Position updated");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to update");
      }
    }
  };

  const handleColorChange = async (id: Id<"positions">, color: string) => {
    try {
      await updatePosition({ id, color });
      toast.success("Colour updated");
    } catch {
      toast.error("Failed to update colour");
    }
  };

  const handleToggleActive = async (id: Id<"positions">, currentlyActive: boolean) => {
    try {
      await updatePosition({ id, active: !currentlyActive });
      toast.success(currentlyActive ? "Position hidden" : "Position restored");
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleRemove = async (id: Id<"positions">) => {
    try {
      await removePosition({ id });
      toast.success("Position removed");
    } catch {
      toast.error("Failed to remove");
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (!positions) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= positions.length) return;

    const reordered = [...positions];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    try {
      await reorderPositions({ orderedIds: reordered.map((t) => t._id) });
    } catch {
      toast.error("Failed to reorder");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Briefcase className="size-4" />
          Positions
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage the dropdown options and colours for positions. Colours are used on shift blocks and pattern cards. Staff can hold multiple positions.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new */}
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">New position</Label>
            <Input
              placeholder="e.g. Paramedic, Driver, Care Assistant"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
          <ColorPicker
            value={newColor}
            onChange={setNewColor}
          />
          <Button onClick={handleCreate} disabled={adding || !newLabel.trim()} size="sm" className="gap-1.5">
            {adding ? <Spinner className="size-4" /> : <Plus className="size-4" />}
            Add
          </Button>
        </div>

        {/* List */}
        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No positions defined yet. Add your first one above.
          </p>
        ) : (
          <div className="space-y-1">
            {positions.map((pos, index) => (
              <div
                key={pos._id}
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 group"
              >
                {/* Reorder buttons */}
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                  >
                    <ArrowUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, "down")}
                    disabled={index === positions.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                  >
                    <ArrowDown className="size-3" />
                  </button>
                </div>

                {/* Colour dot */}
                <ColorPicker
                  value={pos.color ?? "#64748b"}
                  onChange={(c) => handleColorChange(pos._id, c)}
                />

                {/* Label (editable or display) */}
                {editingId === pos._id ? (
                  <div className="flex-1 flex gap-2 items-center">
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleUpdate(pos._id);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => handleUpdate(pos._id)}>
                      <Check className="size-4 text-green-600" />
                    </Button>
                    <Button size="sm" variant="ghost" className="size-7 p-0" onClick={() => setEditingId(null)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <span className={cn("flex-1 text-sm", !pos.active && "text-muted-foreground line-through")}>
                    {pos.label}
                  </span>
                )}

                {/* Status badge */}
                {!pos.active && (
                  <Badge variant="secondary" className="text-[10px]">Hidden</Badge>
                )}

                {/* Actions */}
                {editingId !== pos._id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0"
                      onClick={() => {
                        setEditingId(pos._id);
                        setEditLabel(pos.label);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0"
                      onClick={() => handleToggleActive(pos._id, pos.active)}
                    >
                      {pos.active ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleRemove(pos._id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Colour Picker ─── */

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="size-8 rounded-md border-2 border-border shrink-0 transition-all hover:scale-110 hover:shadow-md flex items-center justify-center"
          style={{ backgroundColor: value }}
          title="Pick colour"
        >
          <Palette className="size-3.5 text-white drop-shadow-sm" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <p className="text-xs font-medium text-muted-foreground mb-2">Pick a colour</p>
        <div className="grid grid-cols-6 gap-1.5">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.hex)}
              className={cn(
                "size-7 rounded-md border-2 transition-all hover:scale-110",
                value === preset.hex ? "border-foreground ring-1 ring-foreground" : "border-transparent",
              )}
              style={{ backgroundColor: preset.hex }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
