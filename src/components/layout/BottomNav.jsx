import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Factory,
  ShieldAlert,
  Boxes,
  MoreHorizontal,
  ShoppingCart,
  Truck,
  Package,
  UtensilsCrossed,
  GitBranch,
  Search,
  Warehouse,
  Spline,
  X,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryNav = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/production-orders", label: "Production", icon: Factory },
  { path: "/hold-release", label: "Holds", icon: ShieldAlert },
  { path: "/inventory", label: "Inventory", icon: Boxes },
];

const moreNav = [
  { path: "/suppliers", label: "Suppliers", icon: Building2 },
  { path: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
  { path: "/receiving", label: "Receiving", icon: Truck },
  { path: "/products", label: "Products", icon: Package },
  { path: "/recipes", label: "Recipes", icon: UtensilsCrossed },
  { path: "/flows", label: "Prod. Flows", icon: GitBranch },
  { path: "/batches", label: "Batches", icon: Factory },
  { path: "/traceability", label: "Traceability", icon: Search },
  { path: "/raw-materials", label: "Raw Materials", icon: Warehouse },
  { path: "/raw-inventory", label: "Raw Inventory", icon: Boxes },
  { path: "/spice-mixes", label: "Spice Mixes", icon: Spline },
];

export default function BottomNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* More drawer overlay */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More drawer */}
      {showMore && (
        <div className="fixed bottom-[72px] left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl shadow-2xl px-4 pt-4 pb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-foreground">All Modules</span>
            <button
              onClick={() => setShowMore(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {moreNav.map((item) => {
              const isActive = location.pathname === item.path ||
                (item.path !== "/" && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMore(false)}
                >
                  <div className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground active:bg-secondary"
                  )}>
                    <item.icon className="w-6 h-6" />
                    <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border h-[72px] flex items-center px-2 safe-area-pb">
        {primaryNav.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link key={item.path} to={item.path} className="flex-1">
              <div className={cn(
                "flex flex-col items-center gap-1 py-2 px-1 rounded-xl mx-0.5 transition-all",
                isActive
                  ? "text-sidebar-primary"
                  : "text-sidebar-foreground/60"
              )}>
                <item.icon className="w-6 h-6" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}

        {/* More button */}
        <button
          className="flex-1"
          onClick={() => setShowMore(!showMore)}
        >
          <div className={cn(
            "flex flex-col items-center gap-1 py-2 px-1 rounded-xl mx-0.5 transition-all",
            showMore ? "text-sidebar-primary" : "text-sidebar-foreground/60"
          )}>
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-[11px] font-medium">More</span>
          </div>
        </button>
      </nav>
    </>
  );
}