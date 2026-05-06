import React from "react";
import { cn } from "@/lib/utils";

export default function ResponsiveGrid({ 
  children, 
  columns = 1,
  smColumns = 1,
  mdColumns = 2,
  lgColumns = 3,
  gap = "gap-4",
  className 
}) {
  return (
    <div
      className={cn(
        `grid ${gap}`,
        `grid-cols-${columns}`,
        `sm:grid-cols-${smColumns}`,
        `md:grid-cols-${mdColumns}`,
        `lg:grid-cols-${lgColumns}`,
        className
      )}
    >
      {children}
    </div>
  );
}