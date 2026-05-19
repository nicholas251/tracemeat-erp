import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import UserProfileMenu from "./UserProfileMenu";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar — visible on tablet and larger */}
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Mobile sidebar overlay */}
      <div className="md:hidden">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />
        )}
        <div className={cn(
          "fixed left-0 top-0 h-full z-40 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <Sidebar collapsed={false} onToggle={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* Main content */}
      <main className={cn(
        "transition-all duration-300 min-h-screen",
        "md:ml-[250px]",
        collapsed && "md:ml-[68px]",
        // On mobile, no left margin but add bottom padding for bottom nav
        "pb-24 md:pb-0"
      )}>
        <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 lg:p-8 mb-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-slate-700 hover:bg-slate-200"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
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