import { cn } from "@/lib/utils.ts";
import {
  Briefcase,
  HardHat,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";
import { useNavigate } from "react-router-dom";

type MemberData = {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  employmentType?: "employee" | "subcontractor";
  positions?: string[];
  phone?: string;
  skills?: string[];
};

export default function MemberCard({ member }: { member: MemberData }) {
  const navigate = useNavigate();
  const initials = member.name
    ? member.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const isSubcontractor = member.employmentType === "subcontractor";

  return (
    <button
      onClick={() => navigate(`/team/${member._id}`)}
      className={cn(
        "group relative flex flex-col items-center rounded-xl border bg-card p-6 text-center transition-all",
        "hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "size-16 rounded-full flex items-center justify-center text-lg font-heading font-bold mb-3",
          isSubcontractor
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : "bg-primary/10 text-primary",
        )}
      >
        {initials}
      </div>

      {/* Name and title */}
      <p className="font-semibold text-sm truncate w-full">{member.name ?? "Unnamed"}</p>
      {member.positions && member.positions.length > 0 && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate w-full">{member.positions.join(", ")}</p>
      )}

      {/* Employment type badge */}
      <div className="mt-2">
        {isSubcontractor ? (
          <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            <HardHat className="size-3" />
            Subcontractor
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Briefcase className="size-3" />
            {member.employmentType === "employee" ? "Employee" : "Team Member"}
          </Badge>
        )}
      </div>

      {/* Department */}
      {member.department && (
        <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
          <MapPin className="size-3" />
          {member.department}
        </p>
      )}

      {/* Contact row */}
      <div className="flex items-center gap-3 mt-3 text-muted-foreground">
        {member.email && (
          <span className="flex items-center gap-1 text-[11px]">
            <Mail className="size-3" />
            <span className="sr-only">{member.email}</span>
          </span>
        )}
        {member.phone && (
          <span className="flex items-center gap-1 text-[11px]">
            <Phone className="size-3" />
            <span className="sr-only">{member.phone}</span>
          </span>
        )}
      </div>

      {/* Skills */}
      {member.skills && member.skills.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1 mt-3">
          {member.skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {skill}
            </span>
          ))}
          {member.skills.length > 3 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              +{member.skills.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
