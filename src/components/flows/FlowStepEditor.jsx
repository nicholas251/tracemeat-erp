import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Trash2, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function FlowStepEditor({ step, index, onChange, onRemove }) {
  const update = (field, value) => onChange(index, { ...step, [field]: value });

  return (
    <Card className="p-4 bg-muted/30">
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 pt-2 text-muted-foreground">
          <GripVertical className="w-4 h-4" />
          <span className="text-sm font-bold w-6">{index + 1}</span>
        </div>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Step Name *</Label>
            <Input value={step.name || ""} onChange={e => update("name", e.target.value)} placeholder="e.g. Grinding" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Station</Label>
            <Input value={step.station || ""} onChange={e => update("station", e.target.value)} placeholder="e.g. Line A" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Target Temp (°C)</Label>
            <Input type="number" value={step.target_temp_c || ""} onChange={e => update("target_temp_c", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max Duration (min)</Label>
            <Input type="number" value={step.max_duration_min || ""} onChange={e => update("max_duration_min", e.target.value ? Number(e.target.value) : null)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={step.description || ""} onChange={e => update("description", e.target.value)} placeholder="Step details..." />
          </div>
          <div className="flex items-end gap-4 pb-1">
            <div className="flex items-center gap-2">
              <Switch checked={step.requires_inspection || false} onCheckedChange={v => update("requires_inspection", v)} />
              <Label className="text-xs">Inspection</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={step.ccp || false} onCheckedChange={v => update("ccp", v)} />
              <Label className="text-xs font-semibold text-destructive">CCP</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={step.is_metal_detection || false} onCheckedChange={v => update("is_metal_detection", v)} />
              <Label className="text-xs">Metal Detection</Label>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-destructive/60 hover:text-destructive mt-1" onClick={() => onRemove(index)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}