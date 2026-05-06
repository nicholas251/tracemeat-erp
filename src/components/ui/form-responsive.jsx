import React from "react";
import { cn } from "@/lib/utils";

export function FormGrid({ children, columns = 1, smColumns = 1, mdColumns = 2, className }) {
  return (
    <div className={cn(
      "grid gap-4 md:gap-6",
      `grid-cols-${columns}`,
      `sm:grid-cols-${smColumns}`,
      `md:grid-cols-${mdColumns}`,
      className
    )}>
      {children}
    </div>
  );
}

export function FormField({ label, error, children, fullWidth = false }) {
  return (
    <div className={cn("flex flex-col gap-2", fullWidth && "col-span-full")}>
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}
      {children}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}