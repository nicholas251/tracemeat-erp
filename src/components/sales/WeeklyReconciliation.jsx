import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, Search } from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";
import CustomerAllocationDialog from "@/components/sales/CustomerAllocationDialog";

export default function WeeklyReconciliation({ products, fgBuckets, onReconcileWeek }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reconciliation, setReconciliation] = useState({});
  const [savingDay, setSavingDay] = useState(null);
  const [search, setSearch] = useState("");
  const [allocations, setAllocations] = useState({});
  const [editing, setEditing] = useState(null);
  const [finalizedDays, setFinalizedDays] = useState(new Set());

  // Get Monday of current week
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const handleProductDayInput = (productId, dayIndex, value) => {
    const key = `${productId}-day${dayIndex}`;
    const newValue = value === "" ? null : parseFloat(value);
    setReconciliation(prev => ({ ...prev, [key]: newValue }));
  };

  const dayHasEntries = (dayIndex) =>
    Object.entries(reconciliation).some(([k, v]) => k.endsWith(`-day${dayIndex}`) && v > 0);

  // Records one day's sales on its own and clears that day's entries from the grid.
  const finalizeDay = async (dayIndex) => {
    const suffix = `-day${dayIndex}`;
    const only = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => k.endsWith(suffix)));
    const without = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => !k.endsWith(suffix)));
    setSavingDay(dayIndex);
    try {
      await onReconcileWeek({
        weekStart: format(weekStart, "yyyy-MM-dd"),
        data: only(reconciliation),
        allocations: only(allocations)
      });
      setReconciliation(without);
      setAllocations(without);
      setFinalizedDays(prev => new Set(prev).add(dayIndex));
    } finally {
      setSavingDay(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Week Header */}
      <div>
        <h3 className="text-lg font-semibold">
          Week of {format(weekStart, "MMM d, yyyy")}
        </h3>
        <p className="text-sm text-muted-foreground">Enter a day's sales below, then finalize that day to record them</p>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, idx) => (
          <div key={idx} className="p-2 rounded-lg border-2 border-border text-center space-y-1">
            <div className="text-xs font-semibold text-muted-foreground">{dayLabels[idx]}</div>
            <div className="text-sm font-semibold flex items-center justify-center gap-1">
              {format(day, "d")}
              {finalizedDays.has(idx) && <CheckCircle2 className="w-4 h-4 text-chart-2" />}
            </div>
            <Button
              size="sm"
              className="w-full px-1 text-[10px] sm:text-xs"
              disabled={!dayHasEntries(idx) || savingDay !== null}
              onClick={() => finalizeDay(idx)}
            >
              {savingDay === idx ? "Saving..." : "Finalize"}
            </Button>
          </div>
        ))}
      </div>

      {/* Products Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-semibold text-sm">Enter Sales by Product & Day</h4>
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
          </div>
        </div>
        {products.filter(p => {
          const q = search.trim().toLowerCase();
          return !q || [p.name, p.sku, p.product_number].some(v => (v || "").toLowerCase().includes(q));
        }).map(product => {
          const bucket = fgBuckets.find(b => b.product_id === product.id);
          const inventory = bucket?.quantity_lbs || 0;
          
          return (
            <Card key={product.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm">{product.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{product.sku}</p>
                  </div>
                  <Badge variant="outline">{inventory.toLocaleString()} lbs</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day, dayIdx) => (
                    <div key={dayIdx} className="space-y-1">
                      <label className="text-xs text-muted-foreground block text-center font-medium">
                        {dayLabels[dayIdx]}
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditing({ product, dayIdx })}
                        className="h-8 w-full rounded-md border border-input bg-background text-center text-sm hover:border-primary"
                      >
                        {reconciliation[`${product.id}-day${dayIdx}`] ?? <span className="text-muted-foreground">0</span>}
                        {allocations[`${product.id}-day${dayIdx}`]?.length > 0 && (
                          <span className="ml-1 text-[10px] text-muted-foreground">({allocations[`${product.id}-day${dayIdx}`].length})</span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CustomerAllocationDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        product={editing?.product}
        dayLabel={editing ? `${dayLabels[editing.dayIdx]} ${format(weekDays[editing.dayIdx], "MMM d")}` : ""}
        initial={editing ? allocations[`${editing.product.id}-day${editing.dayIdx}`] : []}
        onSave={(rows, total) => {
          const key = `${editing.product.id}-day${editing.dayIdx}`;
          setAllocations(prev => ({ ...prev, [key]: rows }));
          handleProductDayInput(editing.product.id, editing.dayIdx, total > 0 ? String(total) : "");
          setEditing(null);
        }}
      />

    </div>
  );
}