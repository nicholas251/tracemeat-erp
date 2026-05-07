import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export default function WorkProfileDialog({ open, onClose, onSave, profile, capabilities, users, colorOptions }) {
  const [form, setForm] = useState({ name: "", description: "", capability_keys: [], assigned_user_ids: [], assigned_user_names: [], color: colorOptions[0], status: "active" });

  useEffect(() => {
    if (profile) setForm(profile);
    else setForm({ name: "", description: "", capability_keys: [], assigned_user_ids: [], assigned_user_names: [], color: colorOptions[0], status: "active" });
  }, [profile, open]);

  const toggleCapability = (key) => {
    setForm(f => ({
      ...f,
      capability_keys: f.capability_keys.includes(key)
        ? f.capability_keys.filter(k => k !== key)
        : [...f.capability_keys, key]
    }));
  };

  const toggleUser = (user) => {
    const ids = form.assigned_user_ids || [];
    const names = form.assigned_user_names || [];
    if (ids.includes(user.id)) {
      setForm(f => ({ ...f, assigned_user_ids: ids.filter(id => id !== user.id), assigned_user_names: names.filter(n => n !== user.full_name) }));
    } else {
      setForm(f => ({ ...f, assigned_user_ids: [...ids, user.id], assigned_user_names: [...names, user.full_name] }));
    }
  };

  const handleSave = () => {
    if (!form.name) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit Work Profile" : "New Work Profile"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Profile Name</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Smokehouse Operator" />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this role do?" className="h-16" />
          </div>

          <div className="space-y-1.5">
            <Label>Profile Color</Label>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map(color => (
                <button
                  key={color}
                  onClick={() => setForm(f => ({ ...f, color }))}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === color ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Capabilities This Profile Can Work</Label>
            <div className="space-y-1">
              {capabilities.map(cap => (
                <div key={cap.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">{cap.name}</span>
                  <Switch
                    checked={(form.capability_keys || []).includes(cap.key)}
                    onCheckedChange={() => toggleCapability(cap.key)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign Employees</Label>
            {users.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No users found.</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {users.map(user => (
                  <div key={user.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                    <div>
                      <span className="text-sm">{user.full_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{user.email}</span>
                    </div>
                    <Switch
                      checked={(form.assigned_user_ids || []).includes(user.id)}
                      onCheckedChange={() => toggleUser(user)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!form.name}>{profile ? "Update" : "Create"} Profile</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}