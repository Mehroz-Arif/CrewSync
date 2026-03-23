import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
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
  EmptyContent,
} from "@/components/ui/empty.tsx";
import {
  Users,
  MoreVertical,
  Shield,
  User,
  UserMinus,
  Clock,
  X,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import AddMemberDialog from "./add-member-dialog.tsx";

export default function TeamMembersTab({
  isAdmin,
  currentUserId,
}: {
  isAdmin: boolean;
  currentUserId?: Id<"users">;
}) {
  const organization = useQuery(api.organizations.getMyOrganization);
  const members = useQuery(api.organizations.getMembers);
  const invites = useQuery(api.organizations.getInvites);
  const updateRole = useMutation(api.organizations.updateMemberRole);
  const removeMember = useMutation(api.organizations.removeMember);
  const cancelInvite = useMutation(api.organizations.cancelInvite);

  const [dialogOpen, setDialogOpen] = useState(false);

  if (
    members === undefined ||
    invites === undefined ||
    organization === undefined
  ) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!organization) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>No Organization</EmptyTitle>
          <EmptyDescription>
            Create an organization first to manage team members
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const handleRoleChange = async (userId: Id<"users">, role: string) => {
    try {
      await updateRole({ userId, role });
      toast.success(
        `Role updated to ${role === "admin" ? "Admin" : "Team Member"}`,
      );
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to update role");
      }
    }
  };

  const handleRemove = async (userId: Id<"users">, name: string) => {
    try {
      await removeMember({ userId });
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

  const handleCancelInvite = async (inviteId: Id<"invites">) => {
    try {
      await cancelInvite({ inviteId });
      toast.success("Invite cancelled");
    } catch (error) {
      toast.error("Failed to cancel invite");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Team Members</h3>
          <p className="text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <>
            <Button onClick={() => setDialogOpen(true)}>
              <UserPlus className="size-4 mr-1.5" />
              Add Member
            </Button>
            <AddMemberDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />
          </>
        )}
      </div>

      {/* Members list */}
      {members.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No team members yet</EmptyTitle>
            <EmptyDescription>
              Add team members to your organization
            </EmptyDescription>
          </EmptyHeader>
          {isAdmin && (
            <EmptyContent>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <UserPlus className="size-4 mr-1.5" />
                Add Member
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {members.map((member) => {
                const isCurrentUser = member._id === currentUserId;
                return (
                  <div
                    key={member._id}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {member.name?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {member.name ?? "Unnamed"}
                          </p>
                          {isCurrentUser && (
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              You
                            </Badge>
                          )}
                        </div>
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
                            <User className="size-3 mr-1" /> Team Member
                          </>
                        )}
                      </Badge>

                      {isAdmin && !isCurrentUser && (
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
                                  handleRoleChange(member._id, "admin")
                                }
                              >
                                <Shield className="size-4 mr-2" />
                                Make Admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRoleChange(member._id, "staff")
                                }
                              >
                                <User className="size-4 mr-2" />
                                Make Team Member
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                handleRemove(
                                  member._id,
                                  member.name ?? "member",
                                )
                              }
                            >
                              <UserMinus className="size-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Clock className="size-4" />
            Pending Invites ({invites.length})
          </h4>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {invites.map((invite) => (
                  <div
                    key={invite._id}
                    className="flex items-center justify-between p-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm shrink-0">
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
                        {invite.role === "admin" ? "Admin" : "Team Member"}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-xs text-amber-600"
                      >
                        Pending
                      </Badge>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleCancelInvite(invite._id)}
                          title="Cancel invite"
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
