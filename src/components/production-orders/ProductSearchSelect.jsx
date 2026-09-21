import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProductSearchSelect({ products = [], value, onChange, placeholder = "Select product..." }) {
  const [open, setOpen] = useState(false);
  const selected = products.find(p => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal bg-slate-200 border-slate-400 text-foreground hover:bg-slate-200">
          <span className="truncate">
            {selected ? `${selected.product_number ? selected.product_number + " · " : ""}${selected.name}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] bg-slate-100 border-slate-300" align="start">
        <Command>
          <CommandInput placeholder="Search by name or product number..." />
          <CommandList>
            <CommandEmpty>No products found.</CommandEmpty>
            <CommandGroup>
              {products.map(p => (
                <CommandItem
                  key={p.id}
                  value={`${p.product_number || ""} ${p.name || ""}`}
                  onSelect={() => { onChange(p.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <span className="font-mono text-xs text-muted-foreground mr-2">{p.product_number}</span>
                  <span className="truncate">{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}