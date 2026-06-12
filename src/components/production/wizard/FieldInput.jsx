import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import SpiceMixLotPicker from "../SpiceMixLotPicker";
import ProductSplitAllocator from "../ProductSplitAllocator";

export default function FieldInput({ field, value, onChange, casingBuckets = [], cureInventory = [], compatibleHotdogProducts = [], totalLbs = 0, remainingCases = 0, onCasingSelect, spiceShortNotes, onSpiceShortNotesChange }) {
  if (field.type === "finished_product_split") {
    return (
      <ProductSplitAllocator
        compatibleProducts={compatibleHotdogProducts}
        splits={value || []}
        onChange={onChange}
        totalLbs={totalLbs}
        remainingCases={remainingCases}
      />
    );
  }
  if (field.type === "finished_product_select") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">{field.label}</Label>
        <Select value={value || "__default__"} onValueChange={v => onChange(v === "__default__" ? "" : v)}>
          <SelectTrigger className="h-11 bg-slate-200 border-slate-400 text-slate-900">
            <SelectValue placeholder="Same as original product (default)" />
          </SelectTrigger>
          <SelectContent className="bg-slate-100 border-slate-400">
            <SelectItem value="__default__">Same as original product (default)</SelectItem>
            {compatibleHotdogProducts.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "spice_mix_picker") {
    return (
      <SpiceMixLotPicker
        label={field.label}
        requiredLbs={field.requiredLbs || 0}
        value={value || {}}
        onChange={onChange}
        filterSpiceMixId={field.filterSpiceMixId}
        shortNotes={spiceShortNotes}
        onShortNotesChange={onSpiceShortNotesChange}
      />
    );
  }
  if (field.type === "casing_select") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">{field.label}</Label>
        <Select value={value || ""} onValueChange={v => {
          const bucket = (field.options || casingBuckets).find(b => b.id === v);
          onCasingSelect(v, bucket?.name || "");
        }}>
          <SelectTrigger className="h-11 bg-slate-200 border-slate-400 text-slate-900"><SelectValue placeholder="Select casings..." /></SelectTrigger>
          <SelectContent className="bg-slate-100 border-slate-400">
            {(field.options || casingBuckets).map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "cure_select") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">{field.label}</Label>
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger className="h-11 bg-slate-200 border-slate-400 text-slate-900">
            <SelectValue placeholder={cureInventory.length === 0 ? "No cure inventory" : "Select cure lot..."} />
          </SelectTrigger>
          <SelectContent className="bg-slate-100 border-slate-400">
            {cureInventory.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No cure inventory available</div>
            ) : (
              cureInventory
                .filter(c => (c.available_qty || 0) > 0)
                .sort((a, b) => (a.received_date || "") < (b.received_date || "") ? -1 : 1)
                .map(c => (
                  <SelectItem key={c.id} value={c.lot_number}>
                    {c.lot_number} <span className="text-muted-foreground text-xs ml-1">({c.available_qty} lbs)</span>
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "spice_select") {
    return null;
  }
  if (field.type === "boolean") {
    return (
      <div className="flex items-center gap-4 rounded-xl border bg-muted/30 px-4 py-3">
        <Switch checked={!!value} onCheckedChange={onChange} className="scale-125" />
        <Label className="text-sm font-medium cursor-pointer select-none">{field.label}</Label>
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">{field.label}</Label>
        <Textarea
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          className="h-24 text-base"
          placeholder={field.placeholder || "Any observations..."}
          disabled={field.disabled}
        />
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{field.label}</Label>
      <Input
        type={field.type === "number" ? "number" : "text"}
        step={field.type === "number" ? "0.1" : undefined}
        value={value ?? field.defaultValue ?? ""}
        onChange={e => {
          let val = field.type === "number" ? Number(e.target.value) : e.target.value;
          onChange(val);
        }}
        placeholder={field.placeholder || ""}
        className="h-11 text-base"
        disabled={field.disabled}
      />
      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
    </div>
  );
}