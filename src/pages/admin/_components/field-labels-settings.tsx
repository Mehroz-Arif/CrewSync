import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useFieldLabels, AVAILABLE_ICONS, getIconComponent } from "@/hooks/use-field-labels.ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover.tsx";
import { Settings2, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import { cn } from "@/lib/utils.ts";

type FieldKey = "vehicle" | "callSign" | "location";

const FIELD_DEFAULTS: Record<FieldKey, { label: string; icon: string }> = {
  vehicle: { label: "Vehicle", icon: "Truck" },
  callSign: { label: "Call Sign", icon: "Radio" },
  location: { label: "Location", icon: "MapPin" },
};

const FIELD_DESCRIPTIONS: Record<FieldKey, string> = {
  vehicle: "The vehicle or apparatus assigned to a shift",
  callSign: "The call sign or unit identifier",
  location: "The station or location for a shift",
};

export default function FieldLabelsSettings() {
  const labels = useFieldLabels();
  const updateLabels = useMutation(api.platformSettings.updateFieldLabels);
  const [saving, setSaving] = useState(false);

  // Local edit state
  const [fields, setFields] = useState<Record<FieldKey, { label: string; icon: string }>>({
    vehicle: { label: "", icon: "" },
    callSign: { label: "", icon: "" },
    location: { label: "", icon: "" },
  });

  // Sync from server
  useEffect(() => {
    setFields({
      vehicle: { label: labels.vehicle.label, icon: labels.vehicle.icon },
      callSign: { label: labels.callSign.label, icon: labels.callSign.icon },
      location: { label: labels.location.label, icon: labels.location.icon },
    });
  }, [labels.vehicle.label, labels.vehicle.icon, labels.callSign.label, labels.callSign.icon, labels.location.label, labels.location.icon]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLabels({
        vehicle: fields.vehicle,
        callSign: fields.callSign,
        location: fields.location,
      });
      toast.success("Field labels updated");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to update field labels");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await updateLabels({
        vehicle: FIELD_DEFAULTS.vehicle,
        callSign: FIELD_DEFAULTS.callSign,
        location: FIELD_DEFAULTS.location,
      });
      toast.success("Field labels reset to defaults");
    } catch (error) {
      toast.error("Failed to reset field labels");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    fields.vehicle.label !== labels.vehicle.label ||
    fields.vehicle.icon !== labels.vehicle.icon ||
    fields.callSign.label !== labels.callSign.label ||
    fields.callSign.icon !== labels.callSign.icon ||
    fields.location.label !== labels.location.label ||
    fields.location.icon !== labels.location.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings2 className="size-4 text-primary" />
          Field Labels & Icons
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Customize the names and icons for Vehicle, Call Sign, and Location fields across the app
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {(["vehicle", "callSign", "location"] as const).map((key) => {
          const SelectedIcon = getIconComponent(fields[key].icon);
          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-2">
                <SelectedIcon className="size-4 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {FIELD_DEFAULTS[key].label}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground">{FIELD_DESCRIPTIONS[key]}</p>
              <div className="flex items-center gap-2">
                {/* Icon picker */}
                <IconPicker
                  value={fields[key].icon}
                  onChange={(icon) =>
                    setFields((prev) => ({
                      ...prev,
                      [key]: { ...prev[key], icon },
                    }))
                  }
                />
                {/* Label input */}
                <div className="flex-1">
                  <Label className="sr-only">Label</Label>
                  <Input
                    value={fields[key].label}
                    onChange={(e) =>
                      setFields((prev) => ({
                        ...prev,
                        [key]: { ...prev[key], label: e.target.value },
                      }))
                    }
                    placeholder={FIELD_DEFAULTS[key].label}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          );
        })}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={saving}
            className="text-muted-foreground"
          >
            <RotateCcw className="size-3.5 mr-1.5" />
            Reset to Defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const SelectedIcon = getIconComponent(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="h-9 w-9 p-0 shrink-0">
          <SelectedIcon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="text-xs font-medium text-muted-foreground px-1 pb-2">
          Choose an icon
        </p>
        <div className="grid grid-cols-5 gap-1">
          {AVAILABLE_ICONS.map((name) => {
            const Ic = getIconComponent(name);
            const isSelected = name === value;
            return (
              <button
                key={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={cn(
                  "size-9 rounded-md flex items-center justify-center transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
                title={name}
              >
                {isSelected ? (
                  <Check className="size-4" />
                ) : (
                  <Ic className="size-4" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
