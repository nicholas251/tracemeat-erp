import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, AlertCircle, Save } from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";

export default function WeeklyReconciliation({ products, fgBuckets, onReconcileWeek }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reconciliation, setReconciliation] = useState({});
  const [saving, setSaving] = useState(false);
  const [completedDays, setCompletedDays] = useState(new Set());

  // Get Monday of current week
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekProgress = (completedDays.size / 7) * 100;
  const isWeekComplete = completedDays.size === 7;

  const handleProductDayInput = (productId, dayIndex, value) => {
    const key = `${productId}-day${dayIndex}`;
    const newValue = value === "" ? null : parseFloat(value);
    setReconciliation(prev => ({ ...prev, [key]: newValue }));
  };

  const toggleDayComplete = (dayIndex) => {
    setCompletedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dayIndex)) {
        newSet.delete(dayIndex);
      } else {
        newSet.add(dayIndex);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (!isWeekComplete) {
      alert("All 7 days must be marked complete before finalizing the week.");
      return;
    }
    setSaving(true);
    try {
      await onReconcileWeek({
        weekStart: format(weekStart, "yyyy-MM-dd"),
        data: reconciliation
      });
      setReconciliation({});
      setCompletedDays(new Set());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Week Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            Week of {format(weekStart, "MMM d, yyyy")}
          </h3>
          <p className="text-sm text-muted-foreground">All 7 days required to complete</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-chart-1">{completedDays.size}/7</div>
          <p className="text-xs text-muted-foreground">Days Complete</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div 
            className="h-full bg-chart-1 transition-all" 
            style={{ width: `${weekProgress}%` }}
          />
        </div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, idx) => {
          const isComplete = completedDays.has(idx);
          return (
            <button
              key={idx}
              onClick={() => toggleDayComplete(idx)}
              className={`p-3 rounded-lg border-2 transition-all text-center cursor-pointer ${
                isComplete
                  ? "border-chart-2 bg-chart-2/10"
                  : "border-border hover:border-chart-1"
              }`}
            >
              <div className="text-xs font-semibold text-muted-foreground mb-1">
                {dayLabels[idx]}
              </div>
              <div className="text-sm font-semibold">{format(day, "d")}</div>
              {isComplete && (
                <CheckCircle2 className="w-4 h-4 text-chart-2 mx-auto mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Products Grid */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm">Enter Sales by Product & Day</h4>
        {products.map(product => {
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
                      <Input
                        type="number"
                        placeholder="0"
                        value={reconciliation[`${product.id}-day${dayIdx}`] ?? ""}
                        onChange={e => handleProductDayInput(product.id, dayIdx, e.target.value)}
                        min="0"
                        step="0.1"
                        className="h-8 text-center text-sm"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Submit Button */}
      <div className="flex gap-2">
        {!isWeekComplete && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-1">
            <AlertCircle className="w-4 h-4" />
            Complete all 7 days to finalize week
          </div>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!isWeekComplete || saving}
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Submitting..." : "Finalize Week"}
        </Button>
      </div>
    </div>
  );
}