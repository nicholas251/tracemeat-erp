import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import PageHeader from "@/components/shared/PageHeader";
import { isUserAdminOrSupervisor } from "@/lib/accessControl";

const FILTERS = [["all", "All"], ["deleted", "Deleted"], ["corrected", "Corrected"], ["manual_entry", "Manual Inputs"]];
const BADGE = { deleted: "bg-red-100 text-red-700", corrected: "bg-amber-100 text-amber-700", manual_entry: "bg-blue-100 text-blue-700" };
const LABEL = { deleted: "Deleted", corrected: "Corrected", manual_entry: "Manual Input" };

export default function AuditLog() {
  const [filter, setFilter] = useState("all");
  const { data: access, isLoading: checking } = useQuery({
    queryKey: ["audit_access"],
    queryFn: async () => {
      const me = await base44.auth.me();
      const profiles = await base44.entities.WorkProfile.list();
      return me?.role === "admin" || isUserAdminOrSupervisor(profiles.filter(p => (p.assigned_user_ids || []).includes(me?.id)));
    },
  });
  const { data, isLoading } = useQuery({
    queryKey: ["audit_log", filter],
    enabled: !!access,
    queryFn: () => base44.entities.AuditLog.filter(filter === "all" ? {} : { action: filter }, { sort: "-created_date", limit: 200 }),
  });
  const rows = data?.items || [];

  if (checking) return <Card className="h-32 animate-pulse bg-muted" />;
  if (!access) return <Card className="p-12 text-center text-muted-foreground">Only supervisors and admins can view the Audit Log.</Card>;

  return (
    <div>
      <PageHeader title="Audit Log" subtitle="Deleted items, corrections and manual inputs" />
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(([v, l]) => (
          <Button key={v} size="sm" variant={filter === v ? "default" : "outline"} onClick={() => setFilter(v)}>{l}</Button>
        ))}
      </div>
      {isLoading ? <Card className="h-64 animate-pulse bg-muted" /> : rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No entries yet.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Product / Lot</TableHead>
              <TableHead>Qty</TableHead><TableHead>Details</TableHead><TableHead>Reason</TableHead><TableHead>By</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.created_date), "MMM d, yyyy h:mm a")}</TableCell>
                  <TableCell><Badge className={BADGE[r.action]}>{LABEL[r.action]}</Badge></TableCell>
                  <TableCell><p className="text-sm font-medium">{r.product_name}</p><p className="font-mono text-xs text-muted-foreground">{r.lot_number}</p></TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{r.quantity_lbs != null ? `${r.quantity_lbs.toLocaleString()} lbs` : "—"}{r.cases ? ` / ${r.cases} cs` : ""}</TableCell>
                  <TableCell className="text-xs max-w-xs">{r.details}</TableCell>
                  <TableCell className="text-xs">{r.reason || "—"}</TableCell>
                  <TableCell className="text-xs"><p className="font-semibold">{r.initials || "—"}</p><p className="text-muted-foreground">{r.user_name}</p></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}