import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function ImportCustomersDialog({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | uploading | importing | success | error
  const [message, setMessage] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const inputRef = useRef();

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setStatus("uploading");
    setMessage("Uploading file...");

    // Upload the file
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    setStatus("importing");
    setMessage("Processing and importing customers...");

    let resData;
    try {
      const res = await base44.functions.invoke("importCustomers", { file_url });
      resData = res.data;
    } catch (err) {
      const errData = err?.response?.data;
      setStatus("error");
      setMessage(errData?.error || err.message || "Import failed. Please check your file format.");
      return;
    }

    if (resData?.success) {
      setStatus("success");
      setImportedCount(resData.imported);
      setMessage(`Successfully imported ${resData.imported} customers.`);
      onImported();
    } else {
      setStatus("error");
      setMessage(resData?.error || "Import failed. Please check your file format.");
    }
  };

  const handleClose = () => {
    setFile(null);
    setStatus("idle");
    setMessage("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Customers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload an Excel (.xlsx) or CSV file. Expected columns:
            <span className="block mt-1 font-mono text-xs bg-muted p-2 rounded">
              Active Status, Customer, Company, Main Phone, Main Email, Bill to 1-5, Ship to 1-5, Customer Type, Terms, Rep
            </span>
          </p>

          {status === "idle" || status === "error" ? (
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              {file ? (
                <div>
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">Drop your file here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx or .csv</p>
                </div>
              )}
              <input ref={inputRef} type="file" accept=".xlsx,.csv,.xls" className="hidden" onChange={handleFileChange} />
            </div>
          ) : null}

          {(status === "uploading" || status === "importing") && (
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm">{message}</span>
            </div>
          )}

          {status === "success" && (
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{message}</span>
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{message}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {status === "success" ? "Close" : "Cancel"}
          </Button>
          {status !== "success" && (
            <Button
              onClick={handleImport}
              disabled={!file || status === "uploading" || status === "importing"}
            >
              {status === "uploading" || status === "importing" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" /> Import</>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}