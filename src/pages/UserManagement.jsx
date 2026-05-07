import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import UserAssignmentDialog from "@/components/users/UserAssignmentDialog";

export default function UserManagement() {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list("-created_date"),
  });

  const { data: workProfiles = [] } = useQuery({
    queryKey: ["workProfiles"],
    queryFn: () => base44.entities.WorkProfile.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleting(null);
    },
  });

  const getUserProfiles = (userId) => {
    return workProfiles.filter(profile => 
      (profile.assigned_user_ids || []).includes(userId)
    );
  };

  const signupLink = `${window.location.origin}/signup`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(signupLink);
  };

  return (
    <div>
      <PageHeader 
        title="User Management" 
        subtitle="Manage user roles and work profile assignments"
        actions={
          <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg">
            <code className="text-xs text-muted-foreground truncate max-w-xs">{signupLink}</code>
            <Button size="sm" variant="ghost" onClick={copyToClipboard}>
              Copy
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Card key={i} className="h-20 animate-pulse bg-muted" />)}
        </div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">No users yet</h3>
          <p className="text-sm text-muted-foreground">Users will appear here as they create accounts.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map(user => {
            const userProfiles = getUserProfiles(user.id);
            return (
              <Card key={user.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{user.full_name}</h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline">{user.role || "user"}</Badge>
                        {userProfiles.length > 0 ? (
                          userProfiles.map(profile => (
                            <Badge key={profile.id} className="bg-primary/10 text-primary">
                              {profile.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No work profile assigned</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button size="sm" variant="outline" onClick={() => setEditing(user)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Assign
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleting(user)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <UserAssignmentDialog
          open
          user={editing}
          workProfiles={workProfiles}
          onClose={() => setEditing(null)}
          onSave={(workProfileIds) => {
            const updatedProfiles = workProfiles.filter(p => workProfileIds.includes(p.id));
            const assignedUserIds = new Set();
            const assignedUserNames = new Set();

            updatedProfiles.forEach(profile => {
              (profile.assigned_user_ids || []).forEach(id => {
                if (id !== editing.id) assignedUserIds.add(id);
              });
              (profile.assigned_user_names || []).forEach(name => {
                if (name !== editing.full_name) assignedUserNames.add(name);
              });
            });

            // Add current user to selected profiles
            assignedUserIds.add(editing.id);
            assignedUserNames.add(editing.full_name);

            const updatePromises = workProfileIds.map(profileId => {
              const profile = workProfiles.find(p => p.id === profileId);
              return base44.entities.WorkProfile.update(profileId, {
                assigned_user_ids: Array.from(assignedUserIds),
                assigned_user_names: Array.from(assignedUserNames),
              });
            });

            // Remove user from unselected profiles
            const unselectedProfileIds = workProfiles
              .filter(p => !workProfileIds.includes(p.id))
              .map(p => p.id);

            unselectedProfileIds.forEach(profileId => {
              const profile = workProfiles.find(p => p.id === profileId);
              const ids = (profile.assigned_user_ids || []).filter(id => id !== editing.id);
              const names = (profile.assigned_user_names || []).filter(name => name !== editing.full_name);
              updatePromises.push(
                base44.entities.WorkProfile.update(profileId, {
                  assigned_user_ids: ids,
                  assigned_user_names: names,
                })
              );
            });

            Promise.all(updatePromises).then(() => {
              queryClient.invalidateQueries({ queryKey: ["workProfiles"] });
              queryClient.invalidateQueries({ queryKey: ["users"] });
              setEditing(null);
            });
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this user. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleting.id)} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}