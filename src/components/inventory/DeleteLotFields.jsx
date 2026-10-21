import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DeleteLotFields({ initials, setInitials, reason, setReason }) {
  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1">
        <Label>Your Initials *</Label>
        <Input value={initials} onChange={e => setInitials(e.target.value)} maxLength={5} placeholder="e.g. JD" className="uppercase w-32" />
      </div>
      <div className="space-y-1">
        <Label>Reason</Label>
        <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Damaged, data entry error" />
      </div>
    </div>
  );
}