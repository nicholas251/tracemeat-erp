import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export default function StatCard({ label, value, icon: Icon, trend, color = "text-blue-600", link }) {
  const navigate = useNavigate();
  
  return (
    <Card 
      className={cn("p-5 hover:shadow-lg hover:border-slate-300 transition-all duration-200 border-slate-200 bg-white", link && "cursor-pointer hover:scale-105")}
      onClick={() => link && navigate(link)}
    >
      <div className="flex items-center justify-between gap-4">
         <div className="flex-1 min-h-16 flex flex-col justify-center">
           <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">{label}</p>
            {!trend && label === "Products" && <p className="text-xs h-4"></p>}
            {!trend && label === "Products" && <p className="text-xs h-4"></p>}
            <p className="text-3xl font-bold mt-1 text-slate-900 leading-none -mb-1">{value}</p>
          {trend && (
            <p className={cn("text-xs mt-2 font-semibold", trend > 0 ? "text-green-600" : "text-red-600")}>
              {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% from last week
            </p>
          )}
        </div>
        <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center shadow-md", color)}>
           <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
}