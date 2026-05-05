import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle } from "lucide-react";

const stageIcons = {
  blending: "🥩",
  chopping: "🔪",
  linking: "🌭",
  cooking: "🔥",
  chilling: "❄️",
  packaging: "📦",
};

const stageColors = {
  blending: "bg-chart-1/15 text-chart-1",
  chopping: "bg-chart-3/15 text-chart-3",
  linking: "bg-chart-5/15 text-chart-5",
  cooking: "bg-accent/15 text-accent",
  chilling: "bg-chart-2/15 text-chart-2",
  packaging: "bg-primary/15 text-primary",
};

export default function ProductionOrderDetail({ open, onClose, order, onUpdate }) {
  const [editingStageIdx, setEditingStageIdx] = useState(null);
  const [stageForm, setStageForm] = useState({});

  if (!order) return null;

  const handleStageClick = (idx) => {
    setEditingStageIdx(idx);
    setStageForm({ ...order.stages[idx] });
  };

  const handleSaveStage = () => {
    onUpdate(editingStageIdx, stageForm);
    setEditingStageIdx(null);
  };

  const currentStage = order.stages[order.current_stage];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order.order_number} - {order.product_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Recipe:</span><span>{order.recipe_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Quantity:</span><span>{order.quantity_to_produce} kg</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><Badge>{order.status}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Target Date:</span><span>{order.target_completion_date}</span></div>
            </CardContent>
          </Card>

          {/* Production Pipeline */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Production Pipeline</h3>
            <div className="space-y-2">
              {order.stages?.map((stage, idx) => (
                <div
                  key={idx}
                  onClick={() => handleStageClick(idx)}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-xl mt-1">{stageIcons[stage.stage_name]}</span>
                      <div className="flex-1">
                        <p className="font-medium capitalize">{stage.stage_name}</p>
                        {stage.status === 'completed' && (
                          <p className="text-xs text-chart-2">Completed {stage.completed_at?.split('T')[0]}</p>
                        )}
                        {stage.assigned_to && (
                          <p className="text-xs text-muted-foreground">Assigned to: {stage.assigned_to}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {stage.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-chart-2" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground" />
                      )}
                      <Badge className={stageColors[stage.stage_name]}>
                        {stage.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stage Editor Modal */}
        {editingStageIdx !== null && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="capitalize">{stageForm.stage_name} Stage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={stageForm.status} onValueChange={v => setStageForm({ ...stageForm, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Assigned To</Label>
                  <Input 
                    value={stageForm.assigned_to || ""}
                    onChange={e => setStageForm({ ...stageForm, assigned_to: e.target.value })}
                    placeholder="e.g., Station 1, John Doe"
                  />
                </div>

                {stageForm.stage_name === 'chopping' && (
                  <>
                    <div className="space-y-2">
                      <Label>Spice Mix ID</Label>
                      <Input 
                        value={stageForm.spice_mix_id || ""}
                        onChange={e => setStageForm({ ...stageForm, spice_mix_id: e.target.value })}
                        placeholder="Select spice mix"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Spice Mix Qty (kg)</Label>
                      <Input 
                        type="number"
                        value={stageForm.spice_mix_qty_kg || ""}
                        onChange={e => setStageForm({ ...stageForm, spice_mix_qty_kg: Number(e.target.value) })}
                      />
                    </div>
                  </>
                )}

                {stageForm.stage_name === 'cooking' && (
                  <>
                    <div className="space-y-2">
                      <Label>Oven Assignment</Label>
                      <Input 
                        value={stageForm.oven_assignment || ""}
                        onChange={e => setStageForm({ ...stageForm, oven_assignment: e.target.value })}
                        placeholder="e.g., Oven 1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Racks Used (3 per oven)</Label>
                      <Input 
                        type="number"
                        value={stageForm.racks_used || ""}
                        onChange={e => setStageForm({ ...stageForm, racks_used: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cook Time (minutes)</Label>
                      <Input 
                        type="number"
                        value={stageForm.cook_time_minutes || ""}
                        onChange={e => setStageForm({ ...stageForm, cook_time_minutes: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cook Temperature (°C)</Label>
                      <Input 
                        type="number"
                        value={stageForm.cook_temperature_c || ""}
                        onChange={e => setStageForm({ ...stageForm, cook_temperature_c: Number(e.target.value) })}
                      />
                    </div>
                  </>
                )}

                {stageForm.stage_name === 'packaging' && (
                  <>
                    <div className="space-y-2">
                      <Label>Packaging Type</Label>
                      <Input 
                        value={stageForm.packaging_type || ""}
                        onChange={e => setStageForm({ ...stageForm, packaging_type: e.target.value })}
                        placeholder="e.g., Vacuum Sealed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Package Weight (lbs)</Label>
                      <Input 
                        type="number"
                        step="0.1"
                        value={stageForm.packaging_weight_lbs || ""}
                        onChange={e => setStageForm({ ...stageForm, packaging_weight_lbs: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Packages Produced</Label>
                      <Input 
                        type="number"
                        value={stageForm.packages_produced || ""}
                        onChange={e => setStageForm({ ...stageForm, packages_produced: Number(e.target.value) })}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label>Quantity Completed (kg)</Label>
                  <Input 
                    type="number"
                    value={stageForm.quantity_completed_kg || ""}
                    onChange={e => setStageForm({ ...stageForm, quantity_completed_kg: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Quality Check Passed</Label>
                  <Select value={stageForm.quality_check_passed ? "yes" : "no"} onValueChange={v => setStageForm({ ...stageForm, quality_check_passed: v === "yes" })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Passed</SelectItem>
                      <SelectItem value="no">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea 
                    value={stageForm.notes || ""}
                    onChange={e => setStageForm({ ...stageForm, notes: e.target.value })}
                    placeholder="Stage notes..."
                  />
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setEditingStageIdx(null)}>Cancel</Button>
                  <Button onClick={handleSaveStage}>Save Stage</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}