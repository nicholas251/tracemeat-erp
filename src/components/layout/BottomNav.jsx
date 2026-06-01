import React, { useState, useEffect } from "react";
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
  Search,
  Warehouse,
  Spline,
  X,
  Building2,
  Briefcase,
  ClipboardList,
  TrendingUp,
  Users,
  Workflow,
  Monitor,
  UserCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";

const adminPrimaryNav = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/production-orders", label: "Production", icon: Factory },
  { path: "/hold-release", label: "Holds", icon: ShieldAlert },
  { path: "/inventory", label: "Inventory", icon: Boxes },
  { path: "/sales-orders", label: "Sales", icon: ClipboardList },
];

const adminMoreNav = [
  { path: "/suppliers", label: "Suppliers", icon: Building2 },
  { path: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
  { path: "/receiving", label: "Receiving", icon: Truck },
  { path: "/products", label: "Products", icon: Package },
  { path: "/flow-builder", label: "Prod. Flows", icon: Workflow },
  { path: "/work-profiles", label: "Work Profiles", icon: Users },
  { path: "/user-management", label: "Users", icon: UserCheck },
  { path: "/floor-view", label: "Floor View", icon: Monitor },
  { path: "/traceability", label: "Traceability", icon: Search },
  { path: "/raw-materials", label: "Raw Materials", icon: Warehouse },
  { path: "/raw-inventory", label: "Raw Inventory", icon: Boxes },
  { path: "/spice-mixes", label: "Spice Mixes", icon: Spline },
  { path: "/customers", label: "Customers", icon: UserCheck },
  { path: "/daily-sales", label: "Daily Sales", icon: TrendingUp },
  { path: "/forecast", label: "Forecast", icon: Zap },
];

const workerPrimaryNav = [
  { path: "/my-work", label: "My Work", icon: Briefcase },
  { path: "/production-orders", label: "Production", icon: Factory },
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
];

const ADMIN_ROLES = ["admin", "supervisor", "quality_control"];

export default function BottomNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUserRole(u?.role)).catch(() => setUserRole(null));
  }, []);

  // Close drawer on navigation
  useEffect(() => { setShowMore(false); }, [location.pathname]);

  const isAdmin = ADMIN_ROLES.includes(userRole);
  const primaryNav = isAdmin ? adminPrimaryNav : workerPrimaryNav;
  const moreNav = isAdmin ? adminMoreNav : [];

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
      {showMore && moreNav.length > 0 && (
        <div className="fixed bottom-[64px] left-0 right-0 z-50 bg-white border-t border-slate-200 rounded-t-2xl shadow-2xl px-4 pt-4 pb-6 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-slate-800">All Modules</span>
            <button
              onClick={() => setShowMore(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
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
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all",
                    isActive
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 active:bg-slate-200"
                  )}>
                    <item.icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 h-16 flex items-center px-2">
        {primaryNav.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link key={item.path} to={item.path} className="flex-1">
              <div className={cn(
                "flex flex-col items-center gap-1 py-2 px-1 rounded-xl mx-0.5 transition-all",
                isActive
                  ? "text-blue-400"
                  : "text-slate-400 hover:text-slate-200"
              )}>
                <item.icon className="w-5 h-5 md:w-6 md:h-6" />
                <span className="text-[10px] md:text-[11px] font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}

        {/* More button — only for admins */}
        {isAdmin && (
          <button
            className="flex-1"
            onClick={() => setShowMore(!showMore)}
          >
            <div className={cn(
              "flex flex-col items-center gap-1 py-2 px-1 rounded-xl mx-0.5 transition-all",
              showMore ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
            )}>
              <MoreHorizontal className="w-5 h-5 md:w-6 md:h-6" />
              <span className="text-[10px] md:text-[11px] font-medium">More</span>
            </div>
          </button>
        )}
      </nav>
    </>
  );
}