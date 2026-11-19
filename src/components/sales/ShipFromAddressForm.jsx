import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ShipFromAddressForm({ onSaved, onCancel }) {
  const [draft, setDraft] = useState({ name: "", address: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    const created = await base44.entities.ShipFromAddress
      .create({ name: draft.name.trim(), address: draft.address.trim(), phone: draft.phone.trim() })
      .finally(() => setSaving(false));
    onSaved(created);
  };

  return (
    <div className="space-y-2 border rounded-md p-3 bg-muted/20">
      <Input placeholder="Shipper / facility name" value={draft.name} onChange={e => set("name", e.target.value)} />
      <Textarea placeholder={"Street address\nCity, State ZIP"} rows={3} value={draft.address} onChange={e => set("address", e.target.value)} />
      <Input placeholder="Phone (optional)" value={draft.phone} onChange={e => set("phone", e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button size="sm" onClick={save} disabled={saving || !draft.name.trim() || !draft.address.trim()}>
          {saving ? "Saving..." : "Save Address"}
        </Button>
      </div>
    </div>
  );
}