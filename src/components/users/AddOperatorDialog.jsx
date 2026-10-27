import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export default function AddOperatorDialog({ open, onClose, managerEmail }) {
  const [name, setName] = useState("");
  const [baseEmail, setBaseEmail] = useState(managerEmail || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    if (open) { setName(""); setError(""); setDone(""); setBaseEmail(managerEmail || ""); }
  }, [open, managerEmail]);

  const [local, domain] = baseEmail.split("@");
  const loginEmail = name && local && domain ? `${local}+${slug(name)}@${domain}` : "";

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await base44.users.inviteUser(loginEmail, "user");
      setDone(loginEmail);
    } catch (e) {
      setError(e.message || "Could not create the login");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add operator (no email)</DialogTitle></DialogHeader>
        {done ? (
          <div className="space-y-2 text-sm">
            <p>Login created: <span className="font-mono font-semibold">{done}</span></p>
            <p className="text-muted-foreground">The invite was sent to your inbox. Open it, set a password, then give the operator this login and password. Assign their work profile here once they appear in the list.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Operator name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Smith" />
            </div>
            <div>
              <Label>Manager mailbox (receives the setup email)</Label>
              <Input value={baseEmail} onChange={e => setBaseEmail(e.target.value)} />
            </div>
            {loginEmail && <p className="text-sm">Operator login: <span className="font-mono">{loginEmail}</span></p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!done && (
            <Button onClick={submit} disabled={!loginEmail || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create login
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}