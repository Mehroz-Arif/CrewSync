import { Star, Users, Rocket, Heart, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type RewardCategory = {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
};

export const REWARD_CATEGORIES: RewardCategory[] = [
  { value: "great-work", label: "Great Work", icon: Star, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  { value: "team-player", label: "Team Player", icon: Users, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { value: "above-and-beyond", label: "Above & Beyond", icon: Rocket, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  { value: "customer-hero", label: "Customer Hero", icon: Heart, color: "text-rose-500", bgColor: "bg-rose-500/10" },
  { value: "innovation", label: "Innovation", icon: Lightbulb, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
];

export const POINT_OPTIONS = [10, 25, 50, 100] as const;

export function getCategoryConfig(value: string): RewardCategory | undefined {
  return REWARD_CATEGORIES.find((c) => c.value === value);
}
