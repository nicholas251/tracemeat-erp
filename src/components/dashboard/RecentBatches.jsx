import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import { Link } from "react-router-dom";

export default function RecentBatches({ batches }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Recent Batches</CardTitle>
          <Link to="/batches" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            View all →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Batch #</TableHead>
              <TableHead className="text-xs">Product</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground text-sm py-8">
                  No batches yet
                </TableCell>
              </TableRow>
            ) : (
              batches.slice(0, 8).map((batch) => (
                <TableRow key={batch.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono text-sm font-medium">{batch.batch_number}</TableCell>
                  <TableCell className="text-sm">{batch.product_name}</TableCell>
                  <TableCell><StatusBadge status={batch.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {batch.production_date ? format(new Date(batch.production_date), "MMM d") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}