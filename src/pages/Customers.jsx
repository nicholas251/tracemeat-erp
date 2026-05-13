import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import CustomerFormDialog from "@/components/customers/CustomerFormDialog";
import CustomerPricingDialog from "@/components/customers/CustomerPricingDialog";
import CustomersTable from "@/components/customers/CustomersTable";
import ImportCustomersDialog from "@/components/customers/ImportCustomersDialog";

export default function Customers() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => base44.entities.Customer.list("name"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Customer.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });

  const handleEdit = (c) => { setSelected(c); setFormOpen(true); };
  const handlePricing = (c) => { setSelected(c); setPricingOpen(true); };
  const handleNew = () => { setSelected(null); setFormOpen(true); };
  const handleClose = () => { setFormOpen(false); setSelected(null); };
  const handlePricingClose = () => { setPricingOpen(false); setSelected(null); };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage customers and their product pricing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Import
          </Button>
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-2" /> New Customer
          </Button>
        </div>
      </div>

      <CustomersTable
        customers={customers}
        isLoading={isLoading}
        onEdit={handleEdit}
        onPricing={handlePricing}
        onDelete={(id) => deleteMutation.mutate(id)}
      />

      <CustomerFormDialog
        open={formOpen}
        customer={selected}
        onClose={handleClose}
        onSaved={() => { queryClient.invalidateQueries({ queryKey: ["customers"] }); handleClose(); }}
      />

      <ImportCustomersDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => { queryClient.invalidateQueries({ queryKey: ["customers"] }); setImportOpen(false); }}
      />

      {selected && (
        <CustomerPricingDialog
          open={pricingOpen}
          customer={selected}
          onClose={handlePricingClose}
        />
      )}
    </div>
  );
}