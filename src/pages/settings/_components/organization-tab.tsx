import { useState, useRef } from "react";
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
import { Building2, Pencil, Save, X, Upload, Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { ConvexError } from "convex/values";

export default function OrganizationTab({ isAdmin }: { isAdmin: boolean }) {
  const organization = useQuery(api.organizations.getMyOrganization);
  const createOrg = useMutation(api.organizations.create);
  const updateOrg = useMutation(api.organizations.update);
  const generateLogoUploadUrl = useMutation(api.organizations.generateLogoUploadUrl);
  const updateLogo = useMutation(api.organizations.updateLogo);
  const removeLogo = useMutation(api.organizations.removeLogo);

  const [name, setName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setIsUploadingLogo(true);
    try {
      const uploadUrl = await generateLogoUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      await updateLogo({ storageId });
      toast.success("Logo updated!");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to upload logo");
      }
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    setIsUploadingLogo(true);
    try {
      await removeLogo();
      toast.success("Logo removed");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { message: string };
        toast.error(message);
      } else {
        toast.error("Failed to remove logo");
      }
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Organization exists – show details with optional editing
  return (
    <div className="space-y-6">
      {/* Logo Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ImageIcon className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle>Organization Logo</CardTitle>
              <CardDescription>
                Upload a logo to represent your organization
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {/* Logo preview */}
            <div className="size-28 rounded-2xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden shrink-0 bg-muted/30">
              {organization.logoUrl ? (
                <img
                  src={organization.logoUrl}
                  alt={`${organization.name} logo`}
                  className="size-full object-cover rounded-2xl"
                />
              ) : (
                <Building2 className="size-12 text-muted-foreground/40" />
              )}
            </div>

            {/* Upload controls */}
            {isAdmin && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={isUploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="size-4 mr-1.5" />
                    {isUploadingLogo ? "Uploading..." : organization.logoUrl ? "Change Logo" : "Upload Logo"}
                  </Button>
                  {organization.logoUrl && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      disabled={isUploadingLogo}
                      onClick={handleRemoveLogo}
                    >
                      <Trash2 className="size-4 mr-1.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Recommended: Square image, at least 200x200px. Max 5MB.
                </p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                />
              </div>
            )}

            {!isAdmin && !organization.logoUrl && (
              <p className="text-sm text-muted-foreground">
                No logo set. Ask an admin to upload one.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Organization Details Card */}
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
    </div>
  );
}
