import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { isUserAdminOrSupervisor } from "@/lib/accessControl";
import { logAudit } from "@/lib/auditLog";

// Supervisor/admin action: top a partial (not yet started) tumble batch up to a full batch.
export default function MakeFullBatchButton({ stage, productName, orderId }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: canEdit } = useQuery({
    queryKey: ["supervisorAccess"],
    queryFn: async () => {
      const me = await base44.auth.me();
      const profiles = await base44.entities.WorkProfile.list();
      return me?.role === "admin" || isUserAdminOrSupervisor(profiles.filter(p => (p.assigned_user_ids || []).includes(me?.id)));
    },
  });
  const { data: fullLbs } = useQuery({
    queryKey: ["tumbleBatchLbs", productName],
    queryFn: async () => (await base44.entities.Product.filter({ name: productName }))[0]?.tumble_batch_lbs || 800,
    enabled: !!productName,
  });

  const isTumble = ["tumble", "tumbling"].includes(stage.capability_key);
  if (!canEdit || !isTumble || stage.status !== "available" || !fullLbs || !(stage.input_qty_lbs < fullLbs)) return null;

  const handleClick = async () => {
    if (!window.confirm(`Change this batch from ${stage.input_qty_lbs} lbs to a full ${fullLbs} lb batch?`)) return;
    setSaving(true);
    await base44.entities.ProductionStage.update(stage.id, { input_qty_lbs: fullLbs });
    await logAudit({
      action: "corrected", area: "Production", product_name: productName, lot_number: stage.order_number,
      quantity_lbs: fullLbs, details: `${stage.notes || "Tumble batch"}: ${stage.input_qty_lbs} lbs → ${fullLbs} lbs (made full batch)`,
    });
    queryClient.invalidateQueries({ queryKey: ["orderStages", orderId] });
    setSaving(false);
  };

  return (
    <Button size="sm" variant="outline" className="mt-1 w-full text-xs" disabled={saving} onClick={handleClick}>
      {saving ? "Saving..." : `Make full ${fullLbs} lb batch`}
    </Button>
  );
}