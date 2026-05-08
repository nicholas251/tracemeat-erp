import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Beef, FlaskConical, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const EMPTY = { name: "", code: "", category: "protein", description: "", unit: "lbs", status: "active" };

const categoryIcons = { protein: Beef, spice: FlaskConical, packaging: Package, casing: Package };

export default function BucketFormDialog({ open, bucket, onClose, onSave, allBuckets = [], onEdit }) {
  const [form, setForm] = useState(bucket || EMPTY);
  const [mode, setMode] = useState(bucket ? "edit" : "list"); // "list" | "add" | "edit"

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.name || !form.category) return;
    onSave(form);
    setForm(EMPTY);
    setMode("list");
  };

  const handleEdit = (b) => {
    setForm({ name: b.name, code: b.code || "", category: b.category, description: b.description || "", unit: b.unit || "lbs", status: b.status || "active" });
    setMode("edit");
    onEdit(b);
  };

  const categories = ["protein", "spice", "packaging", "casing"];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inventory Bucket Settings</DialogTitle>
        </DialogHeader>

        {mode === "list" && (
          <div>
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => { setForm(EMPTY); setMode("add"); }}>
                <Plus className="w-4 h-4 mr-1" /> Add Bucket
              </Button>
            </div>
            {categories.map(cat => {
              const Icon = categoryIcons[cat];
              const catBuckets = allBuckets.filter(b => b.category === cat);
              return (
                <div key={cat} className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4" />
                    <h3 className="text-sm font-semibold capitalize">{cat} Buckets</h3>
                    <Badge variant="outline" className="text-xs">{catBuckets.length}</Badge>
                  </div>
                  {catBuckets.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-6 mb-2">None configured yet.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Code</TableHead>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Unit</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {catBuckets.map(b => (
                          <TableRow key={b.id}>
                            <TableCell className="font-mono text-xs">{b.code || "—"}</TableCell>
                            <TableCell className="text-sm font-medium">{b.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{b.unit}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${b.status === "active" ? "text-chart-2" : "text-muted-foreground"}`}>
                                {b.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(b)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </div>
        )}

        {(mode === "add" || mode === "edit") && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Bucket Name *</Label>
                <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. 50/50 Beef/Pork Trim" />
              </div>
              <div>
                <Label>Code</Label>
                <Input value={form.code} onChange={e => set("code", e.target.value)} placeholder="e.g. PROT-01" />
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => set("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="protein">Protein</SelectItem>
                    <SelectItem value="spice">Spice</SelectItem>
                    <SelectItem value="packaging">Packaging</SelectItem>
                    <SelectItem value="casing">Casing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit of Measure</Label>
                <Select value={form.unit} onValueChange={v => set("unit", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lbs">lbs</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="each">each</SelectItem>
                    <SelectItem value="case">case</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="What types of materials go in this bucket..." className="h-20" />
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setMode("list")}>← Back</Button>
              <Button onClick={handleSave}>Save Bucket</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}