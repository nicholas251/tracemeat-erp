import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, DollarSign } from "lucide-react";

export default function CustomersTable({ customers, isLoading, onEdit, onPricing, onDelete }) {
  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  if (!customers.length) return (
    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
      No customers yet. Add your first customer to get started.
    </div>
  );

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Customer</th>
            <th className="text-left px-4 py-3 font-medium">Contact</th>
            <th className="text-left px-4 py-3 font-medium">Email</th>
            <th className="text-left px-4 py-3 font-medium">Phone</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-right px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c, i) => (
            <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
              <td className="px-4 py-3 font-medium">{c.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.contact_name || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.email || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
              <td className="px-4 py-3">
                <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onPricing(c)} title="Manage Pricing">
                    <DollarSign className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(c)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(c.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}