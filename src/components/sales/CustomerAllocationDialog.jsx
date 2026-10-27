import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

const round = (n) => Math.round(n * 100) / 100;

export default function CustomerAllocationDialog({ open, onClose, product, dayLabel, initial, onSave }) {
  const [rows, setRows] = useState([]);
  const caseWeight = product?.case_weight_lbs || 0;

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list("name"),
    enabled: open,
  });

  useEffect(() => {
    if (open) setRows(initial?.length ? initial : [{ customer_id: "", cases: "", lbs: "" }]);
  }, [open]);

  const update = (i, patch) => setRows(r => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const setCases = (i, v) => update(i, { cases: v, lbs: caseWeight && v !== "" ? round(parseFloat(v) * caseWeight) : "" });
  const totalLbs = round(rows.reduce((s, r) => s + (parseFloat(r.lbs) || 0), 0));

  const save = () => {
    const clean = rows
      .filter(r => r.customer_id && parseFloat(r.lbs) > 0)
      .map(r => ({
        customer_id: r.customer_id,
        customer_name: customers.find(c => c.id === r.customer_id)?.name || r.customer_name || "",
        cases: parseFloat(r.cases) || 0,
        lbs: parseFloat(r.lbs),
      }));
    onSave(clean, round(clean.reduce((s, r) => s + r.lbs, 0)));
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{product?.name} — {dayLabel}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {caseWeight ? `Case weight ${caseWeight} lbs — entering cases fills lbs automatically.` : "Enter lbs per customer."}
        </p>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Select value={row.customer_id} onValueChange={v => update(i, { customer_id: v })}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" min="0" placeholder="Cases" value={row.cases} onChange={e => setCases(i, e.target.value)} className="w-20" />
              <Input type="number" min="0" step="0.1" placeholder="Lbs" value={row.lbs} onChange={e => update(i, { lbs: e.target.value })} className="w-24" />
              <Button variant="ghost" size="icon" onClick={() => setRows(r => r.filter((_, idx) => idx !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="gap-1 w-fit" onClick={() => setRows(r => [...r, { customer_id: "", cases: "", lbs: "" }])}>
          <Plus className="w-4 h-4" /> Add customer
        </Button>
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-sm font-semibold">Total: {totalLbs.toLocaleString()} lbs</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}