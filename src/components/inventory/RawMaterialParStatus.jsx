import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Check } from "lucide-react";

export default function RawMaterialParStatus({ material }) {
  const availableQty = material.available_qty_lbs || 0;
  const allocatedQty = material.allocated_qty_lbs || 0;
  const parLevel = material.par_level || 0;
  const totalQty = material.quantity_lbs || 0;
  
  // Calculate percentages for visual indicators
  const availablePercent = totalQty > 0 ? (availableQty / totalQty) * 100 : 0;
  const allocatedPercent = totalQty > 0 ? (allocatedQty / totalQty) * 100 : 0;
  
  // Determine status
  const isLowStock = availableQty < parLevel;
  const isCritical = availableQty < (parLevel * 0.5);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-sm">{material.name}</h4>
          <p className="text-xs text-muted-foreground">{material.supplier}</p>
        </div>
        <div className="flex gap-2 items-center">
          {isCritical && <AlertTriangle className="w-4 h-4 text-destructive" />}
          {isLowStock && !isCritical && <AlertCircle className="w-4 h-4 text-accent" />}
          {!isLowStock && <Check className="w-4 h-4 text-chart-2" />}
        </div>
      </div>

      {/* Par Level Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Available: {availableQty.toFixed(2)} lbs</span>
          <span className="text-muted-foreground">Par Level: {parLevel.toFixed(2)} lbs</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          {/* Available portion (green/normal) */}
          <div 
            className="h-full bg-chart-2 transition-all"
            style={{ width: `${Math.min(availablePercent, 100)}%` }}
          />
          {/* Allocated portion (orange/warning) */}
          {allocatedQty > 0 && (
            <div 
              className="absolute h-2 bg-accent opacity-70"
              style={{ 
                width: `${Math.min(allocatedPercent, 100)}%`,
                left: `${Math.min(availablePercent, 100)}%`
              }}
            />
          )}
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex gap-2 flex-wrap">
        {allocatedQty > 0 && (
          <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/20">
            Allocated: {allocatedQty.toFixed(2)} lbs
          </Badge>
        )}
        {isCritical && (
          <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
            Critical Stock
          </Badge>
        )}
        {isLowStock && !isCritical && (
          <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/20">
            Low Stock
          </Badge>
        )}
      </div>
    </div>
  );
}