import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/shared/PageHeader";
import ProfilePickerDashboard from "@/components/mywork/ProfilePickerDashboard";
import BlendingDashboard from "@/components/mywork/BlendingDashboard";
import StageDashboard from "@/components/mywork/StageDashboard";
import WarehouseOperatorView from "@/components/mywork/WarehouseOperatorView";
import AdminView from "@/components/mywork/AdminView";
import { Briefcase } from "lucide-react";
import { isUserAdminOrSupervisor } from "@/lib/accessControl";

const FIRST_STEP_KEY = "blending";

export default function MyWork() {
  const [user, setUser] = useState(null);
  const [activeProfileId, setActiveProfileId] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: profiles = [] } = useQuery({
    queryKey: ["allWorkProfiles"],
    queryFn: () => base44.entities.WorkProfile.filter({ status: "active" }),
    enabled: !!user,
  });

  useEffect(() => {
    const unsub = base44.entities.ProductionStage.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["myStages"] });
      queryClient.invalidateQueries({ queryKey: ["allStages"] });
      queryClient.invalidateQueries({ queryKey: ["blendingStages"] });
      queryClient.invalidateQueries({ queryKey: ["productionOrders"] });
    });
    return unsub;
  }, [queryClient]);

  if (!user) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  const myProfiles = profiles.filter(p => (p.assigned_user_ids || []).includes(user.id));

  if (isUserAdminOrSupervisor(myProfiles)) {
    return <AdminView user={user} />;
  }

  if (myProfiles.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No work profile assigned</p>
        <p className="text-sm mt-1">Contact your admin to be assigned to a work profile.</p>
      </div>
    );
  }

  const warehouseProfile = myProfiles.find(p => p.name?.toLowerCase() === "warehouse operator");
  if (warehouseProfile && myProfiles.length === 1) {
    return <WarehouseOperatorView user={user} />;
  }

  const activeProfile = myProfiles.find(p => p.id === activeProfileId) || (myProfiles.length === 1 ? myProfiles[0] : null);

  if (!activeProfile) {
    return (
      <ProfilePickerDashboard
        user={user}
        profiles={myProfiles}
        onSelect={(profileId) => setActiveProfileId(profileId)}
      />
    );
  }

  const capKeys = activeProfile.capability_keys || [];

  const isSingleProfile = myProfiles.length === 1;

  if (capKeys.includes(FIRST_STEP_KEY)) {
    return (
      <BlendingDashboard
        user={user}
        profile={activeProfile}
        singleProfile={isSingleProfile}
        onBack={!isSingleProfile ? () => setActiveProfileId(null) : null}
      />
    );
  }

  return (
    <StageDashboard
      user={user}
      profile={activeProfile}
      singleProfile={isSingleProfile}
      onBack={!isSingleProfile ? () => setActiveProfileId(null) : null}
    />
  );
}