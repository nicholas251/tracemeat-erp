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
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start closed on mobile/tablet

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar — permanent on large screens only */}
      <div className="hidden lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      </div>

      {/* Tablet/Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 h-full z-40 lg:hidden">
            <Sidebar collapsed={false} onToggle={() => setSidebarOpen(false)} onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main content */}
      <main className={cn(
        "transition-all duration-300 min-h-screen",
        "lg:ml-[250px]",
        collapsed && "lg:ml-[68px]",
        // On tablet/mobile, no left margin but add bottom padding for bottom nav
        "pb-24 lg:pb-0"
      )}>
        <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 lg:p-8 mb-2">
          {!sidebarOpen && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-700 hover:bg-slate-200"
            >
              <Menu className="w-5 h-5" />
            </Button>
          )}
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