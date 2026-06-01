import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function UserAssignmentDialog({ open, user, workProfiles, onClose, onSave }) {
  const [selectedProfileIds, setSelectedProfileIds] = useState([]);
  const [role, setRole] = useState("user");

  useEffect(() => {
    if (open && user) {
      const userProfileIds = workProfiles
        .filter(p => (p.assigned_user_ids || []).includes(user.id))
        .map(p => p.id);
      setSelectedProfileIds(userProfileIds);
      setRole(user.role || "user");
    }
  }, [open, user, workProfiles]);

  const handleToggle = (profileId) => {
    setSelectedProfileIds(prev =>
      prev.includes(profileId)
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const handleSave = () => {
    onSave(selectedProfileIds, role);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Work Profiles</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4 flex-1 overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Assign {user?.full_name} to work profiles. They will see jobs for assigned capabilities.
          </p>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {workProfiles.length === 0 ? (
            <Card className="p-4 text-center text-muted-foreground text-sm">
              No work profiles created yet.
            </Card>
          ) : (
            <div className="space-y-2">
              {workProfiles.map(profile => (
                <label key={profile.id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition">
                  <Checkbox
                    checked={selectedProfileIds.includes(profile.id)}
                    onCheckedChange={() => handleToggle(profile.id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{profile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(profile.capability_keys || []).length} capabilities
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Assignments</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}