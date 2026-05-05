import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CheckCircle, Circle, Play, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import StatusBadge from "@/components/shared/StatusBadge";

export default function BatchStepTracker({ open, onClose, batch, flow, onAdvanceStep, onHold }) {
  const [tempRecorded, setTempRecorded] = useState("");
  const [stepNotes, setStepNotes] = useState("");
  const [passedInspection, setPassedInspection] = useState(true);

  if (!batch || !flow) return null;

  const steps = flow.steps || [];
  const stepRecords = batch.step_records || [];
  const currentStep = batch.current_step || 0;
  const isComplete = batch.status === "completed";
  const isOnHold = batch.status === "on_hold";

  const handleAdvance = () => {
    onAdvanceStep({
      temp_recorded_c: tempRecorded ? Number(tempRecorded) : null,
      notes: stepNotes,
      passed_inspection: passedInspection,
    });
    setTempRecorded("");
    setStepNotes("");
    setPassedInspection(true);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Batch {batch.batch_number}
            <StatusBadge status={batch.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 text-sm text-muted-foreground mb-4">
          <p><strong>Product:</strong> {batch.product_name}</p>
          <p><strong>Flow:</strong> {batch.flow_name}</p>
          {batch.quantity_kg && <p><strong>Quantity:</strong> {batch.quantity_kg} kg</p>}
        </div>

        {/* Step Progress */}
        <div className="space-y-3">
          {steps.map((step, i) => {
            const record = stepRecords[i];
            const isCurrentStep = i === currentStep && !isComplete;
            const isDone = record?.status === "completed";
            const isInProgress = record?.status === "in_progress";

            return (
              <div key={i} className={cn(
                "p-4 rounded-lg border transition-all",
                isCurrentStep ? "border-primary bg-primary/5" : isDone ? "border-chart-2/30 bg-chart-2/5" : "border-border bg-muted/20"
              )}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isDone ? (
                      <CheckCircle className="w-5 h-5 text-chart-2" />
                    ) : isCurrentStep ? (
                      <Play className="w-5 h-5 text-primary" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{step.name}</span>
                      {step.ccp && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold">CCP</span>
                      )}
                      {step.requires_inspection && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-chart-5/15 text-chart-5 font-medium">INSPECT</span>
                      )}
                    </div>
                    {step.station && <p className="text-xs text-muted-foreground">Station: {step.station}</p>}
                    {step.target_temp_c != null && <p className="text-xs text-muted-foreground">Target: {step.target_temp_c}°C</p>}

                    {isDone && record && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                        {record.temp_recorded_c != null && <p>Recorded: {record.temp_recorded_c}°C</p>}
                        {record.completed_at && <p>Completed: {format(new Date(record.completed_at), "MMM d, HH:mm")}</p>}
                        {record.notes && <p>Notes: {record.notes}</p>}
                      </div>
                    )}

                    {/* Current step input form */}
                    {isCurrentStep && !isOnHold && (
                      <div className="mt-3 space-y-3 pt-3 border-t">
                        <div className="grid grid-cols-2 gap-3">
                          {step.target_temp_c != null && (
                            <div className="space-y-1">
                              <Label className="text-xs">Temperature (°C)</Label>
                              <Input type="number" value={tempRecorded} onChange={e => setTempRecorded(e.target.value)} placeholder="Record temp" />
                            </div>
                          )}
                          {step.requires_inspection && (
                            <div className="flex items-end gap-2 pb-1">
                              <Switch checked={passedInspection} onCheckedChange={setPassedInspection} />
                              <Label className="text-xs">Passed Inspection</Label>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Notes</Label>
                          <Textarea value={stepNotes} onChange={e => setStepNotes(e.target.value)} rows={2} placeholder="Step notes..." />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleAdvance}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            {currentStep === steps.length - 1 ? "Complete Batch" : "Complete Step"}
                          </Button>
                          <Button size="sm" variant="outline" className="text-accent border-accent/30" onClick={onHold}>
                            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Place on Hold
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}