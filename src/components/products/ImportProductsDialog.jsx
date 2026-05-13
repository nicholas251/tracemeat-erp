import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";

export default function ImportProductsDialog({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | importing | done | error
  const [message, setMessage] = useState("");
  const [importedCount, setImportedCount] = useState(0);

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setMessage("");
    setImportedCount(0);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleImport = async () => {
    if (!file) return;
    setStatus("uploading");
    setMessage("Uploading file...");

    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    setStatus("importing");
    setMessage("Reading spreadsheet and creating products...");

    const res = await base44.functions.invoke("importProducts", { file_url });
    const data = res.data;

    if (data.success) {
      setImportedCount(data.imported);
      setStatus("done");
      setMessage(`Successfully imported ${data.imported} products.`);
    } else {
      setStatus("error");
      setMessage(data.error || "Import failed.");
      if (data.sample_columns) {
        setMessage(prev => `${data.error}\n\nColumns found: ${data.sample_columns.join(", ")}`);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Products from Spreadsheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Upload an Excel (.xlsx) or CSV file with your product list. The system will look for columns named
            <span className="font-mono text-foreground"> Product Code</span> (or Item Code, SKU, etc.) and
            <span className="font-mono text-foreground"> Description</span> (or Product Name, etc.).
            All other fields will be left blank for you to fill in.
          </p>

          {status === "idle" && (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/40 transition-colors">
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">
                {file ? file.name : "Click to select your spreadsheet"}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </label>
          )}

          {(status === "uploading" || status === "importing") && (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">{message}</p>
            </div>
          )}

          {status === "done" && (
            <div className="flex items-start gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">Import complete</p>
                <p className="text-sm text-green-700">{importedCount} products created. You can now edit each product to add category, flow, recipe, and other details.</p>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 p-4">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Import failed</p>
                <p className="text-sm text-red-700 whitespace-pre-wrap">{message}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {status === "done" ? (
            <>
              <Button variant="outline" onClick={reset}>Import Another</Button>
              <Button onClick={() => { onImported(); handleClose(); }}>Done</Button>
            </>
          ) : status === "error" ? (
            <>
              <Button variant="outline" onClick={reset}>Try Again</Button>
              <Button variant="outline" onClick={handleClose}>Close</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={status !== "idle"}>Cancel</Button>
              <Button
                onClick={handleImport}
                disabled={!file || status !== "idle"}
              >
                <Upload className="w-4 h-4 mr-2" /> Import Products
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}