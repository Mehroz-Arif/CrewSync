import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { cn } from "@/lib/utils.ts";
import { format } from "date-fns";
import {
  ArrowLeft,
  Briefcase,
  HardHat,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  AlertTriangle,
  Pencil,
  Shield,
  Award,
  Wrench,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import EditProfileDialog from "./_components/edit-profile-dialog.tsx";
import AdminEditProfileDialog from "./_components/admin-edit-profile-dialog.tsx";

export default function ProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [showEditOwn, setShowEditOwn] = useState(false);
  const [showAdminEdit, setShowAdminEdit] = useState(false);

  const currentUser = useQuery(api.users.getCurrentUser);
  const profile = useQuery(
    api.profiles.getProfile,
    userId ? { userId: userId as Id<"users"> } : "skip",
  );

  const isAdmin = currentUser?.role === "admin";
  const isSelf = currentUser?._id === userId;
  const isSubcontractor = profile?.employmentType === "subcontractor";

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl md:col-span-2" />
        </div>
      </div>
    );
  }

  const initials = profile.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back nav */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/team")} className="gap-2">
        <ArrowLeft className="size-4" />
        Back to Team
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column – identity card */}
        <Card className="md:row-span-2">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div
              className={cn(
                "size-20 rounded-full flex items-center justify-center text-2xl font-heading font-bold mb-4",
                isSubcontractor
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-primary/10 text-primary",
              )}
            >
              {initials}
            </div>

            <h2 className="font-heading font-bold text-xl">{profile.name ?? "Unnamed"}</h2>
            {profile.jobTitle && (
              <p className="text-sm text-muted-foreground mt-1">{profile.jobTitle}</p>
            )}

            <div className="mt-3">
              {isSubcontractor ? (
                <Badge className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                  <HardHat className="size-3" />
                  Subcontractor
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Briefcase className="size-3" />
                  Employee
                </Badge>
              )}
              {profile.role === "admin" && (
                <Badge className="ml-2 gap-1 bg-primary/10 text-primary border-primary/20">
                  <Shield className="size-3" />
                  Admin
                </Badge>
              )}
            </div>

            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{profile.bio}</p>
            )}

            {/* Actions */}
            <div className="mt-6 w-full space-y-2">
              {isSelf && (
                <Button variant="secondary" size="sm" className="w-full gap-2" onClick={() => setShowEditOwn(true)}>
                  <Pencil className="size-4" />
                  Edit My Profile
                </Button>
              )}
              {isAdmin && !isSelf && (
                <Button variant="secondary" size="sm" className="w-full gap-2" onClick={() => setShowAdminEdit(true)}>
                  <Pencil className="size-4" />
                  Edit as Admin
                </Button>
              )}
              {isAdmin && isSelf && (
                <Button variant="ghost" size="sm" className="w-full gap-2" onClick={() => setShowAdminEdit(true)}>
                  <Shield className="size-4" />
                  Admin Edit
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right column – details */}
        <div className="md:col-span-2 space-y-6">
          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={Mail} label="Email" value={profile.email} />
              <InfoRow icon={Phone} label="Phone" value={profile.phone} />
              {(isAdmin || isSelf) && (
                <InfoRow icon={MapPin} label="Address" value={profile.address} />
              )}
              {profile.department && (
                <InfoRow icon={Briefcase} label="Department" value={profile.department} />
              )}
              {profile.startDate && (
                <InfoRow
                  icon={Calendar}
                  label="Start Date"
                  value={format(new Date(profile.startDate), "MMMM d, yyyy")}
                />
              )}
              {isAdmin && profile.hourlyRate !== undefined && (
                <InfoRow
                  icon={DollarSign}
                  label="Hourly Rate"
                  value={`$${profile.hourlyRate.toFixed(2)}/hr`}
                />
              )}
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          {(isAdmin || isSelf) && (profile.emergencyContactName || profile.emergencyContactPhone) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={Phone} label="Name" value={profile.emergencyContactName} />
                <InfoRow icon={Phone} label="Phone" value={profile.emergencyContactPhone} />
              </CardContent>
            </Card>
          )}

          {/* Skills */}
          {profile.skills && profile.skills.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="size-4" />
                  Skills
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-primary/10 text-primary px-3 py-1 text-sm font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Certifications */}
          {profile.certifications && profile.certifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="size-4" />
                  Certifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {profile.certifications.map((cert) => (
                    <span
                      key={cert}
                      className="rounded-full bg-accent/10 text-accent-foreground px-3 py-1 text-sm font-medium"
                    >
                      {cert}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin notes */}
          {isAdmin && profile.notes && (
            <Card className="border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <StickyNote className="size-4" />
                  Admin Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{profile.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit dialogs */}
      {isSelf && (
        <EditProfileDialog
          open={showEditOwn}
          onOpenChange={setShowEditOwn}
          currentProfile={profile}
        />
      )}
      {isAdmin && (
        <AdminEditProfileDialog
          open={showAdminEdit}
          onOpenChange={setShowAdminEdit}
          profile={profile}
        />
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}
