import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import UserProfileMenu from "./UserProfileMenu";
import { cn } from "@/lib/utils";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar — visible on large screens only */}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Main content */}
      <main className={cn(
        "transition-all duration-300 min-h-screen",
        "lg:ml-[250px]",
        collapsed && "lg:ml-[68px]",
        // On tablet/mobile, no left margin but add bottom padding for bottom nav
        "pb-24 lg:pb-0"
      )}>
        <div className="flex justify-end p-3 sm:p-4 md:p-6 lg:p-8 mb-2">
          <UserProfileMenu />
        </div>
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1600px]">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav — visible on tablet/mobile only */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}