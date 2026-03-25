import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Search, Users, Filter, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { cn } from "@/lib/utils.ts";
import MemberCard from "./_components/member-card.tsx";
import AddMemberDialog from "../settings/_components/add-member-dialog.tsx";
import { useStaffPreview } from "@/hooks/use-staff-preview.tsx";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "employee", label: "Employees" },
  { value: "subcontractor", label: "Subcontractors" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

export default function TeamPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const directory = useQuery(api.profiles.getDirectory);
  const currentUser = useQuery(api.users.getCurrentUser);
  const { isPreviewingAsStaff } = useStaffPreview();

  const canAddMembers =
    (currentUser?.role === "admin" || currentUser?.isSuperAdmin) &&
    !isPreviewingAsStaff;

  const filtered = useMemo(() => {
    if (!directory) return [];
    let result = directory;

    // Filter by type
    if (filter === "employee") {
      result = result.filter((m) => m.employmentType !== "subcontractor");
    } else if (filter === "subcontractor") {
      result = result.filter((m) => m.employmentType === "subcontractor");
    }

    // Search
    const q = search.toLowerCase().trim();
    if (q) {
      result = result.filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q) ||
          m.positions?.some((p) => p.toLowerCase().includes(q)) ||
          m.department?.toLowerCase().includes(q) ||
          m.skills?.some((s) => s.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [directory, filter, search]);

  const counts = useMemo(() => {
    if (!directory) return { all: 0, employee: 0, subcontractor: 0 };
    return {
      all: directory.length,
      employee: directory.filter((m) => m.employmentType !== "subcontractor").length,
      subcontractor: directory.filter((m) => m.employmentType === "subcontractor").length,
    };
  }, [directory]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {directory ? `${directory.length} team members` : "Loading..."}
          </p>
        </div>
        {canAddMembers && (
          <Button onClick={() => setAddMemberOpen(true)}>
            <UserPlus className="size-4 mr-1.5" />
            Add Member
          </Button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, title, skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="size-4 text-muted-foreground shrink-0" />
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "secondary"}
              size="sm"
              onClick={() => setFilter(f.value)}
              className={cn("text-xs", filter === f.value ? "" : "text-muted-foreground")}
            >
              {f.label}
              <span className="ml-1 opacity-70">({counts[f.value]})</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {!directory ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No members found</EmptyTitle>
            <EmptyDescription>
              {search
                ? `No results for "${search}". Try a different search.`
                : "No team members match the selected filter."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((member) => (
            <MemberCard key={member._id} member={member} />
          ))}
        </div>
      )}

      {/* Add member dialog */}
      <AddMemberDialog open={addMemberOpen} onOpenChange={setAddMemberOpen} />
    </div>
  );
}
