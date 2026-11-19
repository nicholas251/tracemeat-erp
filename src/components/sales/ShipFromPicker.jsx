import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ShipFromAddressForm from "./ShipFromAddressForm";

const ADD_NEW = "__add_new__";

export default function ShipFromPicker({ value, onChange }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: me } = useQuery({ queryKey: ["currentUser"], queryFn: () => base44.auth.me() });
  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["shipFromAddresses"],
    queryFn: () => base44.entities.ShipFromAddress.list("name"),
  });
  const isAdmin = me?.role === "admin";

  // Pre-select the first saved address
  useEffect(() => {
    if (!value && addresses.length) onChange(addresses[0]);
  }, [addresses, value]);

  const handleSaved = (created) => {
    queryClient.invalidateQueries({ queryKey: ["shipFromAddresses"] });
    onChange(created);
    setAdding(false);
  };

  return (
    <div className="space-y-2 text-left">
      <Label>Ship from</Label>
      <Select
        value={adding ? ADD_NEW : value?.id || ""}
        onValueChange={v => {
          if (v === ADD_NEW) return setAdding(true);
          setAdding(false);
          onChange(addresses.find(a => a.id === v));
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Loading..." : "Select ship-from address..."} />
        </SelectTrigger>
        <SelectContent position="popper">
          {addresses.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          {isAdmin && <SelectItem value={ADD_NEW}>+ Add new address</SelectItem>}
        </SelectContent>
      </Select>
      {adding ? (
        <ShipFromAddressForm onSaved={handleSaved} onCancel={() => setAdding(false)} />
      ) : value ? (
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {[value.address, value.phone].filter(Boolean).join("\n")}
        </p>
      ) : !isLoading && addresses.length === 0 && !isAdmin ? (
        <p className="text-sm text-muted-foreground">No ship-from addresses saved yet. An admin can add one here.</p>
      ) : null}
    </div>
  );
}