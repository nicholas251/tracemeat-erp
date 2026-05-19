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
      {/* Sidebar — visible on tablet and larger */}
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Main content */}
      <main className={cn(
        "transition-all duration-300 min-h-screen",
        "md:ml-[250px]",
        collapsed && "md:ml-[68px]",
        // On mobile, no left margin but add bottom padding for bottom nav
        "pb-24 md:pb-0"
      )}>
        <div className="flex justify-end p-3 sm:p-4 md:p-6 lg:p-8 mb-2">
          <UserProfileMenu />
        </div>
        <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1600px]">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav — visible on mobile only */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  );
}