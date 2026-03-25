import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card.tsx";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import {
  Building2,
  ArrowLeft,
  Users,
  Shield,
  User,
  MoreVertical,
  UserMinus,
  Clock,
  X,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

export default function SuperAdminOrgDetailPage() {
  const { orgId } = useParams();
  const navigate = useNavigate();

  const isSuperAdmin = useQuery(api.superAdmin.isSuperAdmin);
  const orgDetails = useQuery(
    api.superAdmin.getOrganizationDetails,
    isSuperAdmin && orgId
      ? { organizationId: orgId as Id<"organizations"> }
      : "skip",
  );
  const moveUser = useMutation(api.superAdmin.moveUserToOrganization);

  // Loading
  if (isSuperAdmin === undefined || (isSuperAdmin && orgDetails === undefined)) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Not super admin
  if (!isSuperAdmin) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldCheck />
            </EmptyMedia>
            <EmptyTitle>Access Restricted</EmptyTitle>
            <EmptyDescription>
              You need super admin privileges to access this page
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (!orgDetails) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>Organization Not Found</EmptyTitle>
            <EmptyDescription>
              This organization may have been deleted
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const handleRemoveFromOrg = async (userId: Id<"users">, name: string) => {
    try {
      await moveUser({ userId });
      toast.success(`${name} has been removed from the organization`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to remove member");
      }
    }
  };

  const handleChangeRole = async (
    userId: Id<"users">,
    newRole: string,
  ) => {
    try {
      await moveUser({
        userId,
        organizationId: orgId as Id<"organizations">,
        role: newRole,
      });
      toast.success(
        `Role updated to ${newRole === "admin" ? "Admin" : "Staff"}`,
      );
    } catch (error) {
      toast.error("Failed to update role");
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/admin")}
        className="gap-2"
      >
        <ArrowLeft className="size-4" />
        Back to Super Admin
      </Button>

      {/* Org header */}
      <div className="flex items-center gap-4">
        <div className="size-14 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
          {orgDetails.logoUrl ? (
            <img
              src={orgDetails.logoUrl}
              alt={`${orgDetails.name} logo`}
              className="size-full object-cover"
            />
          ) : (
            <Building2 className="size-7 text-primary" />
          )}
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">{orgDetails.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {orgDetails.description && (
              <p className="text-sm text-muted-foreground">
                {orgDetails.description}
              </p>
            )}
            <Badge
              variant={
                orgDetails.status === "suspended" ? "destructive" : "secondary"
              }
              className="text-[10px]"
            >
              {orgDetails.status === "suspended" ? "Suspended" : "Active"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="size-5 text-primary" />
            <div>
              <CardTitle>Members ({orgDetails.members.length})</CardTitle>
              <CardDescription>
                Users belonging to this organization
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {orgDetails.members.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No members</EmptyTitle>
                <EmptyDescription>
                  This organization has no members yet
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y -mx-6">
              {orgDetails.members.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {member.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.name ?? "Unnamed"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email ?? "No email"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={
                        member.role === "admin" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {member.role === "admin" ? (
                        <>
                          <Shield className="size-3 mr-1" /> Admin
                        </>
                      ) : (
                        <>
                          <User className="size-3 mr-1" /> Staff
                        </>
                      )}
                    </Badge>
                    {member.isSuperAdmin && (
                      <Badge className="text-[10px] bg-violet-600 hover:bg-violet-700">
                        Super Admin
                      </Badge>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.role !== "admin" ? (
                          <DropdownMenuItem
                            onClick={() =>
                              handleChangeRole(member._id, "admin")
                            }
                          >
                            <Shield className="size-4 mr-2" />
                            Make Admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              handleChangeRole(member._id, "staff")
                            }
                          >
                            <User className="size-4 mr-2" />
                            Make Staff
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            handleRemoveFromOrg(
                              member._id,
                              member.name ?? "member",
                            )
                          }
                        >
                          <UserMinus className="size-4 mr-2" />
                          Remove from Org
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {orgDetails.pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Clock className="size-5 text-amber-500" />
              <div>
                <CardTitle>
                  Pending Invites ({orgDetails.pendingInvites.length})
                </CardTitle>
                <CardDescription>
                  Invitations waiting to be accepted
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y -mx-6">
              {orgDetails.pendingInvites.map((invite) => (
                <div
                  key={invite._id}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm shrink-0">
                      {invite.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {invite.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {invite.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {invite.role === "admin" ? "Admin" : "Staff"}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="text-xs text-amber-600"
                    >
                      Pending
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
