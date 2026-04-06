import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs.tsx";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Building2,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  ShieldCheck,
  ShieldOff,
  ExternalLink,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import PlatformStatsCards from "./_components/platform-stats.tsx";
import CreateOrgDialog from "./_components/create-org-dialog.tsx";
import EditOrgDialog from "./_components/edit-org-dialog.tsx";

export default function SuperAdminPage() {
  const isSuperAdmin = useQuery(api.superAdmin.isSuperAdmin);
  const stats = useQuery(
    api.superAdmin.getPlatformStats,
    isSuperAdmin ? {} : "skip",
  );
  const organizations = useQuery(
    api.superAdmin.listOrganizations,
    isSuperAdmin ? {} : "skip",
  );
  const allUsers = useQuery(
    api.superAdmin.listAllUsers,
    isSuperAdmin ? {} : "skip",
  );

  const deleteOrg = useMutation(api.superAdmin.deleteOrganization);
  const updateOrg = useMutation(api.superAdmin.updateOrganization);
  const toggleSuperAdmin = useMutation(api.superAdmin.toggleSuperAdmin);

  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<{
    _id: Id<"organizations">;
    name: string;
    description?: string;
    status?: "active" | "suspended";
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"organizations">;
    name: string;
  } | null>(null);

  // Loading state
  if (isSuperAdmin === undefined) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Not a super admin
  if (!isSuperAdmin) {
    return (
      <div className="w-full max-w-6xl mx-auto">
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
          <EmptyContent>
            <Button size="sm" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  const handleDeleteOrg = async () => {
    if (!deleteTarget) return;
    try {
      await deleteOrg({ organizationId: deleteTarget.id });
      toast.success(`"${deleteTarget.name}" has been deleted`);
      setDeleteTarget(null);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to delete organization");
      }
    }
  };

  const handleToggleStatus = async (
    orgId: Id<"organizations">,
    currentStatus: string | undefined,
  ) => {
    const newStatus = currentStatus === "suspended" ? "active" : "suspended";
    try {
      await updateOrg({ organizationId: orgId, status: newStatus });
      toast.success(
        `Organization ${newStatus === "suspended" ? "suspended" : "reactivated"}`,
      );
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleToggleSuperAdmin = async (
    userId: Id<"users">,
    name: string,
    currentlySuper: boolean,
  ) => {
    try {
      await toggleSuperAdmin({ userId });
      toast.success(
        currentlySuper
          ? `${name} is no longer a super admin`
          : `${name} is now a super admin`,
      );
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to update super admin status");
      }
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="size-7 text-primary" />
            Super Admin Console
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage all organizations and users across the platform
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1.5" />
          New Organization
        </Button>
      </div>

      {/* Stats */}
      {stats && <PlatformStatsCards stats={stats} />}

      {/* Tabs: Organizations / Users */}
      <Tabs defaultValue="organizations">
        <TabsList>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="users">All Users</TabsTrigger>
        </TabsList>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="mt-6">
          {!organizations || organizations.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Building2 />
                </EmptyMedia>
                <EmptyTitle>No organizations yet</EmptyTitle>
                <EmptyDescription>
                  Create your first organization to get started
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4 mr-1.5" />
                  New Organization
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {organizations.map((org) => (
                <Card key={org._id} className="relative group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="size-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-primary/15">
                          {org.logoUrl ? (
                            <img
                              src={org.logoUrl}
                              alt={`${org.name} logo`}
                              className="size-full object-cover"
                            />
                          ) : (
                            <Building2 className="size-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">
                            {org.name}
                          </CardTitle>
                          {org.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {org.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              navigate(`/admin/org/${org._id}`)
                            }
                          >
                            <ExternalLink className="size-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setEditOrg({
                                _id: org._id,
                                name: org.name,
                                description: org.description,
                                status: org.status,
                              })
                            }
                          >
                            <Pencil className="size-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleToggleStatus(org._id, org.status)
                            }
                          >
                            {org.status === "suspended" ? (
                              <>
                                <CheckCircle2 className="size-4 mr-2" />
                                Reactivate
                              </>
                            ) : (
                              <>
                                <Ban className="size-4 mr-2" />
                                Suspend
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              setDeleteTarget({ id: org._id, name: org.name })
                            }
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="size-3.5" />
                        <span>
                          {org.memberCount} member
                          {org.memberCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {org.adminNames && (
                        <span className="text-xs text-muted-foreground truncate">
                          Admin: {org.adminNames}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <Badge
                        variant={
                          org.status === "suspended" ? "destructive" : "secondary"
                        }
                        className="text-[10px]"
                      >
                        {org.status === "suspended" ? "Suspended" : "Active"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-6">
          {!allUsers || allUsers.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No users yet</EmptyTitle>
                <EmptyDescription>
                  Users will appear here once they sign up
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {allUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex items-center justify-between p-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {user.name ?? "Unnamed"}
                            </p>
                            {user.isSuperAdmin && (
                              <Badge className="text-[10px] bg-violet-600 hover:bg-violet-700">
                                Super Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email ?? "No email"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {user.organizationName ? (
                          <Badge variant="secondary" className="text-xs">
                            <Building2 className="size-3 mr-1" />
                            {user.organizationName}
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-xs text-amber-600"
                          >
                            Unassigned
                          </Badge>
                        )}
                        {user.role && (
                          <Badge variant="secondary" className="text-xs">
                            {user.role === "admin" ? "Admin" : "Staff"}
                          </Badge>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleToggleSuperAdmin(
                                  user._id,
                                  user.name ?? "User",
                                  user.isSuperAdmin === true,
                                )
                              }
                            >
                              {user.isSuperAdmin ? (
                                <>
                                  <ShieldOff className="size-4 mr-2" />
                                  Remove Super Admin
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="size-4 mr-2" />
                                  Make Super Admin
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs>

      {/* Dialogs */}
      <CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} />

      {editOrg && (
        <EditOrgDialog
          open={!!editOrg}
          onOpenChange={(open) => {
            if (!open) setEditOrg(null);
          }}
          org={editOrg}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.name}</strong>? All members will be
              removed from the organization and pending invites will be deleted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrg}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
