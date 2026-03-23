import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Building2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

export default function OrganizationTab({ isAdmin }: { isAdmin: boolean }) {
  const organization = useQuery(api.organizations.getMyOrganization);
  const createOrg = useMutation(api.organizations.create);
  const updateOrg = useMutation(api.organizations.update);

  const [name, setName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Still loading
  if (organization === undefined) {
    return <Skeleton className="h-48 w-full" />;
  }

  // No organization yet – show create form
  if (!organization) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle>Create Organization</CardTitle>
              <CardDescription>
                Set up your organization to start managing your team
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              setIsLoading(true);
              try {
                await createOrg({ name: name.trim() });
                toast.success("Organization created!");
                setName("");
              } catch (error) {
                if (error instanceof ConvexError) {
                  const { message } = error.data as { message: string };
                  toast.error(message);
                } else {
                  toast.error("Failed to create organization");
                }
              } finally {
                setIsLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="Acme Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? "Creating..." : "Create Organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Organization exists – show details with optional editing
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>
                Manage your organization settings
              </CardDescription>
            </div>
          </div>
          {isAdmin && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditName(organization.name);
                setIsEditing(true);
              }}
            >
              <Pencil className="size-4 mr-1" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editName.trim()) return;
              setIsLoading(true);
              try {
                await updateOrg({ name: editName.trim() });
                toast.success("Organization updated!");
                setIsEditing(false);
              } catch (error) {
                if (error instanceof ConvexError) {
                  const { message } = error.data as { message: string };
                  toast.error(message);
                } else {
                  toast.error("Failed to update organization");
                }
              } finally {
                setIsLoading(false);
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-org-name">Organization Name</Label>
              <Input
                id="edit-org-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={!editName.trim() || isLoading}
              >
                <Save className="size-4 mr-1" />
                {isLoading ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEditing(false)}
                disabled={isLoading}
              >
                <X className="size-4 mr-1" />
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium text-lg">{organization.name}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
