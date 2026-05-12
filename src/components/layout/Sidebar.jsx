import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { 
  LayoutDashboard, 
  Package, 
  GitBranch, 
  Factory, 
  ShieldAlert, 
  Search, 
  Warehouse,
  Boxes,
  ShoppingCart,
  Truck,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  Spline,
  Building2,
  Workflow,
  Users,
  Monitor,
  Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getVisibleNavRoles } from "@/lib/accessControl";

const allNavItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "supervisor", "quality_control", "production_worker"] },
  { path: "/my-work", label: "My Work", icon: Briefcase, roles: ["all"] },
  { path: "/suppliers", label: "Suppliers", icon: Building2, roles: ["admin", "supervisor", "quality_control"] },
  { path: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart, roles: ["admin", "supervisor", "quality_control", "warehouse_operator"] },
  { path: "/receiving", label: "Receiving", icon: Truck, roles: ["admin", "supervisor", "quality_control", "warehouse_operator"] },
  { path: "/products", label: "Products", icon: Package, roles: ["admin", "supervisor", "quality_control", "production_worker"] },
  { path: "/recipes", label: "Recipes", icon: UtensilsCrossed, roles: ["admin", "supervisor", "quality_control"] },
  { path: "/spice-mixes", label: "Spice Mixes", icon: Spline, roles: ["admin", "supervisor", "quality_control"] },
  { path: "/flow-builder", label: "Flow Builder", icon: Workflow, roles: ["admin", "supervisor", "quality_control"] },
  { path: "/work-profiles", label: "Work Profiles", icon: Users, roles: ["admin", "supervisor", "quality_control"] },
  { path: "/user-management", label: "User Management", icon: Users, roles: ["admin", "supervisor", "quality_control"] },
  { path: "/production-orders", label: "Production Orders", icon: Factory, roles: ["admin", "supervisor", "quality_control", "production_worker"] },
  { path: "/floor-view", label: "Floor View", icon: Monitor, roles: ["admin", "supervisor", "quality_control"] },
  { path: "/hold-release", label: "Hold & Release", icon: ShieldAlert, roles: ["admin", "supervisor", "quality_control", "production_worker"] },
  { path: "/traceability", label: "Traceability", icon: Search, roles: ["admin", "supervisor", "quality_control"] },
  { path: "/raw-materials", label: "Raw Materials", icon: Warehouse, roles: ["admin", "supervisor", "quality_control", "warehouse_operator"] },
  { path: "/raw-inventory", label: "Raw Inventory", icon: Boxes, roles: ["admin", "supervisor", "quality_control", "warehouse_operator"] },
  { path: "/inventory", label: "Finished Goods", icon: Boxes, roles: ["admin", "supervisor", "quality_control", "warehouse_operator", "production_worker"] },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    const fetchData = () => {
      Promise.all([
        base44.auth.me().then(u => setUser(u)).catch(() => setUser(null)),
        base44.entities.WorkProfile.filter({ status: "active" }).then(setProfiles).catch(() => setProfiles([])),
      ]);
    };
    
    fetchData();
    
    // Refetch when window regains focus to pick up role changes
    window.addEventListener("focus", fetchData);
    return () => window.removeEventListener("focus", fetchData);
  }, []);

  // Get user's work profiles — sole source of truth for access control
  const userProfiles = profiles.filter(p => (p.assigned_user_ids || []).includes(user?.id));
  const visibleRoles = getVisibleNavRoles(userProfiles);

  // Determine visible items purely from work profile roles
  const visibleItems = allNavItems.filter(item =>
    item.roles.some(r => visibleRoles.has(r))
  );

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full bg-sidebar text-sidebar-foreground z-40 transition-all duration-300 flex flex-col",
      collapsed ? "w-[68px]" : "w-[250px]"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center flex-shrink-0">
          <Factory className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-sidebar-primary tracking-wide">MeatTrace</h1>
            <p className="text-[10px] text-sidebar-foreground/60 tracking-wider uppercase">ERP System</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link key={item.path} to={item.path}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
                <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-sidebar-primary-foreground")} />
                {!collapsed && (
                  <span className="text-sm font-medium truncate">{item.label}</span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-sidebar-border">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onToggle}
          className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>
    </aside>
  );
}