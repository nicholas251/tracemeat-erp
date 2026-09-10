import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

const CATEGORY_ORDER = ["protein", "spice", "casing", "packaging"];

export default function BlendIngredientRow({ ingredient, buckets, onSelectBucket, onChangeQty, onRemove }) {
  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, items: buckets.filter(b => b.category === cat && b.status !== "inactive") }))
    .filter(g => g.items.length > 0);
  const other = buckets.filter(b => !CATEGORY_ORDER.includes(b.category));

  return (
    <div className="flex gap-2 items-center bg-muted/30 rounded-lg p-2">
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <Select value={ingredient.bucket_id} onValueChange={onSelectBucket}>
          <SelectTrigger className="h-8 text-xs bg-slate-200 border-slate-400"><SelectValue placeholder="Select ingredient bucket..." /></SelectTrigger>
          <SelectContent className="bg-slate-100 border-slate-300">
            {grouped.map(g => (
              <React.Fragment key={g.cat}>
                <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{g.cat}</div>
                {g.items.map(b => <SelectItem key={b.id} value={b.id}>{b.code ? `[${b.code}] ` : ""}{b.name}</SelectItem>)}
              </React.Fragment>
            ))}
            {other.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">Other</div>
                {other.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </>
            )}
          </SelectContent>
        </Select>
        {ingredient.bucket_id && ingredient.category && (
          <Badge variant="outline" className="text-[10px] capitalize shrink-0">{ingredient.category}</Badge>
        )}
      </div>
      <div className="w-28">
        <Input type="number" step="0.01" className="h-8 text-xs" placeholder="lbs" value={ingredient.quantity_lbs} onChange={e => onChangeQty(e.target.value)} />
      </div>
      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onRemove}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}