import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export default function StatCard({ label, value, icon: Icon, trend, color = "text-blue-600", link }) {
  const navigate = useNavigate();
  
  return (
    <Card 
      className={cn("p-4 hover:shadow-md hover:border-slate-300 transition-all duration-200 border-slate-200 bg-white", link && "cursor-pointer active:scale-95")}
      onClick={() => link && navigate(link)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
          <p className="text-2xl md:text-3xl font-bold mt-1 text-slate-900 leading-none">{value}</p>
          {trend && (
            <p className={cn("text-xs mt-1 font-semibold", trend > 0 ? "text-green-600" : "text-red-600")}>
              {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
            </p>
          )}
        </div>
        <div className={cn("w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-100", color)}>
          <Icon className="w-5 h-5 md:w-6 md:h-6" />
        </div>
      </div>
    </Card>
  );
}