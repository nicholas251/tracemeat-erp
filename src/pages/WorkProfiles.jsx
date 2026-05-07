import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import WorkProfileDialog from "@/components/work-profiles/WorkProfileDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function WorkProfiles() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null);
  const [deleteProfile, setDeleteProfile] = useState(null);
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["workProfiles"],
    queryFn: () => base44.entities.WorkProfile.list(),
  });

  const { data: capabilities = [] } = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => base44.entities.Capability.filter({ status: "active" }),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.WorkProfile.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workProfiles"] }); setShowDialog(false); setEditingProfile(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.WorkProfile.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workProfiles"] }); setShowDialog(false); setEditingProfile(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkProfile.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["workProfiles"] }); setDeleteProfile(null); },
  });

  const handleSave = (data) => {
    if (editingProfile) updateMutation.mutate({ id: editingProfile.id, data });
    else createMutation.mutate(data);
  };

  const PROFILE_COLORS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#06B6D4","#84CC16"];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Work Profiles"
        subtitle="Define roles, assign capabilities, and manage employee assignments"
        actions={
          <Button onClick={() => { setEditingProfile(null); setShowDialog(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> New Profile
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No work profiles yet. Create one to assign roles to employees.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profiles.map(profile => (
            <Card key={profile.id} className="border-l-4" style={{ borderLeftColor: profile.color || "#6B7280" }}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{profile.name}</CardTitle>
                    {profile.description && <p className="text-xs text-muted-foreground mt-1">{profile.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditingProfile(profile); setShowDialog(true); }}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteProfile(profile)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">CAPABILITIES</p>
                  <div className="flex flex-wrap gap-1">
                    {(profile.capability_keys || []).map(key => (
                      <Badge key={key} variant="outline" className="text-xs capitalize">{key.replace(/_/g, " ")}</Badge>
                    ))}
                    {(!profile.capability_keys || profile.capability_keys.length === 0) && (
                      <span className="text-xs text-muted-foreground italic">None assigned</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">EMPLOYEES ({(profile.assigned_user_ids || []).length})</p>
                  <div className="flex flex-wrap gap-1">
                    {(profile.assigned_user_names || []).map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
                    ))}
                    {(!profile.assigned_user_names || profile.assigned_user_names.length === 0) && (
                      <span className="text-xs text-muted-foreground italic">No employees assigned</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showDialog && (
        <WorkProfileDialog
          open={showDialog}
          onClose={() => { setShowDialog(false); setEditingProfile(null); }}
          onSave={handleSave}
          profile={editingProfile}
          capabilities={capabilities}
          users={users}
          colorOptions={PROFILE_COLORS}
        />
      )}

      <AlertDialog open={!!deleteProfile} onOpenChange={() => setDeleteProfile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteProfile?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the work profile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteProfile.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}