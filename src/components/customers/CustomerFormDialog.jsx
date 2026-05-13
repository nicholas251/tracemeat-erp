import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const empty = { name: "", contact_name: "", email: "", phone: "", address: "", city: "", state: "", zip: "", billing_address: "", notes: "", status: "active" };

export default function CustomerFormDialog({ open, customer, onClose, onSaved }) {
  const [form, setForm] = useState(empty);

  useEffect(() => {
    setForm(customer ? { ...empty, ...customer } : empty);
  }, [customer, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: (data) => customer
      ? base44.entities.Customer.update(customer.id, data)
      : base44.entities.Customer.create(data),
    onSuccess: onSaved,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "New Customer"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2">
            <Label>Company Name *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="ABC Grocery" />
          </div>
          <div>
            <Label>Contact Name</Label>
            <Input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
          </div>
          <div>
            <Label>Zip</Label>
            <Input value={form.zip} onChange={e => set("zip", e.target.value)} />
          </div>
          <div>
            <Label>City</Label>
            <Input value={form.city} onChange={e => set("city", e.target.value)} />
          </div>
          <div>
            <Label>State</Label>
            <Input value={form.state} onChange={e => set("state", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => set("address", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Billing Address</Label>
            <Textarea value={form.billing_address} onChange={e => set("billing_address", e.target.value)} rows={2} placeholder="Full billing address" />
          </div>
          <div className="col-span-2">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}