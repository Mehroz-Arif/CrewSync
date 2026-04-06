import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Truck,
  Radio,
  MapPin,
  Car,
  Bus,
  Ambulance,
  Ship,
  Plane,
  Train,
  Bike,
  Cog,
  Hash,
  Tag,
  Badge,
  Signal,
  Navigation,
  Building2,
  Home,
  Flag,
  Compass,
  type LucideIcon,
} from "lucide-react";

/** Mapping of icon name strings to actual Lucide icon components */
const ICON_MAP: Record<string, LucideIcon> = {
  Truck,
  Radio,
  MapPin,
  Car,
  Bus,
  Ambulance,
  Ship,
  Plane,
  Train,
  Bike,
  Cog,
  Hash,
  Tag,
  Badge,
  Signal,
  Navigation,
  Building2,
  Home,
  Flag,
  Compass,
};

/** List of available icons for the picker UI */
export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

/** Default fallback labels */
const DEFAULTS = {
  vehicle: { label: "Vehicle", icon: "Truck" },
  callSign: { label: "Call Sign", icon: "Radio" },
  location: { label: "Location", icon: "MapPin" },
} as const;

type FieldKey = "vehicle" | "callSign" | "location";

type FieldConfig = {
  label: string;
  icon: string;
  Icon: LucideIcon;
};

type FieldLabels = Record<FieldKey, FieldConfig>;

/**
 * Hook to get custom field labels and icons set in the super admin console.
 * Returns default values while loading or if no customization has been set.
 */
export function useFieldLabels(): FieldLabels {
  const data = useQuery(api.platformSettings.getFieldLabels);

  const resolve = (key: FieldKey): FieldConfig => {
    const raw = data?.[key] ?? DEFAULTS[key];
    return {
      label: raw.label,
      icon: raw.icon,
      Icon: ICON_MAP[raw.icon] ?? ICON_MAP[DEFAULTS[key].icon],
    };
  };

  return {
    vehicle: resolve("vehicle"),
    callSign: resolve("callSign"),
    location: resolve("location"),
  };
}

/** Helper to resolve an icon name to its component */
export function getIconComponent(name: string): LucideIcon {
  return ICON_MAP[name] ?? Truck;
}
