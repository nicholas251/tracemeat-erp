import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";

export default function ReleaseDialog({ open, onClose, hold, onRelease }) {
  const [action, setAction] = useState("released");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!hold) return null;

  const handleSubmit = () => {
    onRelease({
      status: action,
      resolution_notes: resolutionNotes,
      corrective_action: correctiveAction,
      review_date: new Date().toISOString(),
    });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1500);
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-16 h-16 text-chart-2" />
            <h2 className="text-xl font-semibold">Decision Updated</h2>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Hold — {hold.batch_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <p><strong>Product:</strong> {hold.product_name}</p>
            <p><strong>Reason:</strong> {(hold.hold_reason || "").replace(/_/g, " ")}</p>
            <p><strong>Description:</strong> {hold.hold_description}</p>
          </div>

          <div className="space-y-2">
            <Label>Decision *</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="released">Release — Product is safe</SelectItem>
                <SelectItem value="rejected">Reject — Product not suitable</SelectItem>
                <SelectItem value="destroyed">Destroy — Product must be disposed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Resolution Notes</Label>
            <Textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} placeholder="Document findings and decision rationale..." rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Corrective Action</Label>
            <Textarea value={correctiveAction} onChange={e => setCorrectiveAction(e.target.value)} placeholder="What corrective actions were taken..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit}>
            Submit Decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}