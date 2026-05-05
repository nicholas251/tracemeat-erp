import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className={cn(
        "transition-all duration-300 min-h-screen",
        collapsed ? "ml-[68px]" : "ml-[250px]"
      )}>
        <div className="p-6 lg:p-8 max-w-[1600px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}