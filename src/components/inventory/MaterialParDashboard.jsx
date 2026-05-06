import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function MaterialParDashboard({ materials = [] }) {
  if (!materials || materials.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No raw materials to track
        </CardContent>
      </Card>
    );
  }

  // Group by category
  const byCategory = materials.reduce((acc, m) => {
    const cat = m.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  const categoryLabels = {
    beef: "Protein - Beef",
    pork: "Protein - Pork",
    poultry: "Protein - Poultry",
    lamb: "Protein - Lamb",
    seasoning: "Seasonings & Additives",
    casing: "Casings",
    packaging: "Packaging",
    additive: "Additives",
    other: "Other"
  };

  return (
    <div className="space-y-6">
      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category}>
          <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider">
            {categoryLabels[category]}
          </h3>
          <div className="grid gap-3">
            {items.map(material => {
               const available = material.available_qty_lbs || 0;
               const allocated = material.allocated_qty_lbs || 0;
               const parLevel = material.par_level || 0;
               const original = material.quantity_lbs || 0;

               // Total in system is available + allocated
               const total = available + allocated;

               const isCritical = available < (parLevel * 0.5);
               const isLow = available < parLevel;

               const availablePercent = total > 0 ? (available / total) * 100 : 0;
               const allocatedPercent = total > 0 ? (allocated / total) * 100 : 0;

              return (
                <Card key={material.id} className="p-4">
                  <div className="space-y-3">
                    {/* Header with name and status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{material.name}</h4>
                        <p className="text-xs text-muted-foreground">{material.supplier} • Lot: {material.lot_number}</p>
                      </div>
                      <div className="flex gap-1">
                        {isCritical && <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />}
                        {isLow && !isCritical && <AlertCircle className="w-4 h-4 text-accent flex-shrink-0" />}
                        {!isLow && <Check className="w-4 h-4 text-chart-2 flex-shrink-0" />}
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="bg-muted p-2 rounded">
                        <p className="text-muted-foreground">Available</p>
                        <p className="font-semibold text-sm">{available.toFixed(0)} lbs</p>
                      </div>
                      <div className="bg-accent/10 p-2 rounded">
                        <p className="text-muted-foreground">Allocated</p>
                        <p className="font-semibold text-sm text-accent">{allocated.toFixed(0)} lbs</p>
                      </div>
                      <div className="bg-primary/10 p-2 rounded">
                        <p className="text-muted-foreground">Par Level</p>
                        <p className="font-semibold text-sm text-primary">{parLevel.toFixed(0)} lbs</p>
                      </div>
                      <div className="bg-muted p-2 rounded">
                        <p className="text-muted-foreground">Original</p>
                        <p className="font-semibold text-sm">{original.toFixed(0)} lbs</p>
                      </div>
                    </div>

                    {/* Visual bar */}
                    <div className="space-y-2">
                      <div className="flex gap-1 h-8 bg-muted rounded-md overflow-hidden">
                        {/* Available section (green) */}
                        <div 
                          className="bg-chart-2 transition-all flex items-center justify-center"
                          style={{ width: `${Math.max(availablePercent, 2)}%` }}
                          title={`Available: ${available.toFixed(0)} lbs`}
                        >
                          {availablePercent > 15 && <span className="text-xs font-medium text-white">Avail</span>}
                        </div>
                        
                        {/* Allocated section (orange) */}
                        {allocatedPercent > 0 && (
                          <div 
                            className="bg-accent transition-all flex items-center justify-center"
                            style={{ width: `${Math.max(allocatedPercent, 2)}%` }}
                            title={`Allocated: ${allocated.toFixed(0)} lbs`}
                          >
                            {allocatedPercent > 15 && <span className="text-xs font-medium text-white">Alloc</span>}
                          </div>
                        )}

                        {/* Remaining free space */}
                        <div 
                          className="bg-muted-foreground/10 flex-1"
                        />
                      </div>

                      {/* Par level indicator */}
                       {parLevel > 0 && original > 0 && (
                         <div className="relative h-1 bg-muted rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-primary"
                             style={{ width: `${(parLevel / original) * 100}%` }}
                           />
                         </div>
                       )}
                    </div>

                    {/* Status badges */}
                    <div className="flex gap-2 flex-wrap">
                      {isCritical && (
                        <Badge className="text-xs bg-destructive/15 text-destructive border-destructive/20">
                          Critical - Below 50% Par
                        </Badge>
                      )}
                      {isLow && !isCritical && (
                        <Badge className="text-xs bg-accent/15 text-accent border-accent/20">
                          Low Stock - Below Par Level
                        </Badge>
                      )}
                      {allocated > 0 && (
                        <Badge className="text-xs bg-accent/15 text-accent border-accent/20">
                          {((allocated / total) * 100).toFixed(0)}% Allocated to Orders
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}