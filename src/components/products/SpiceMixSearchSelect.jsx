import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SpiceMixSearchSelect({ spiceMixes = [], value, onChange, placeholder = "Select spice mix..." }) {
  const [open, setOpen] = useState(false);
  const selected = spiceMixes.find(m => m.id === value);
  const sorted = [...spiceMixes].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal bg-slate-200 border-slate-400 text-foreground hover:bg-slate-200">
          <span className="truncate">{selected ? selected.name : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] bg-slate-100 border-slate-300" align="start">
        <Command>
          <CommandInput placeholder="Search spice mixes..." />
          <CommandList className="max-h-64 overflow-y-auto">
            <CommandEmpty>No spice mixes found.</CommandEmpty>
            <CommandGroup>
              {sorted.map(m => (
                <CommandItem key={m.id} value={m.name || m.id} onSelect={() => { onChange(m.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === m.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{m.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}