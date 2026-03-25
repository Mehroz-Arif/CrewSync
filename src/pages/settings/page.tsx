import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import OrganizationTab from "./_components/organization-tab.tsx";
import TeamMembersTab from "./_components/team-members-tab.tsx";
import FieldsTab from "./_components/fields-tab.tsx";
import VehiclesTab from "./_components/vehicles-tab.tsx";
import { useStaffPreview } from "@/hooks/use-staff-preview.tsx";

export default function SettingsPage() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const { isPreviewingAsStaff } = useStaffPreview();

  if (currentUser === undefined) {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 pt-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin" && !isPreviewingAsStaff;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your organization and team
        </p>
      </div>

      <Tabs defaultValue="organization" className="w-full">
        <TabsList>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          {isAdmin && <TabsTrigger value="fields">Positions</TabsTrigger>}
          {isAdmin && <TabsTrigger value="vehicles">Vehicles</TabsTrigger>}
        </TabsList>

        <TabsContent value="organization" className="mt-6">
          <OrganizationTab isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <TeamMembersTab
            isAdmin={isAdmin}
            currentUserId={currentUser?._id}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="fields" className="mt-6">
            <FieldsTab isAdmin={isAdmin} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="vehicles" className="mt-6">
            <VehiclesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
