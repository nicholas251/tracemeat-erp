import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";

export function ProgressBar({ current, total, pct, label }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-semibold text-muted-foreground">
        <span>{label} {current} of {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-chart-1 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function NavButtons({ onBack, onNext, nextDisabled, nextLabel }) {
  return (
    <div className="flex gap-3 pt-1">
      <Button variant="outline" className="gap-2 h-11 px-5" onClick={onBack}>
        <ChevronLeft className="w-4 h-4" /> Back
      </Button>
      <Button className="flex-1 gap-2 h-11 font-semibold" disabled={nextDisabled} onClick={onNext}>
        {nextLabel} <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}