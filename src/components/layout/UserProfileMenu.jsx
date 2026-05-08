import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function UserProfileMenu() {
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);

  useEffect(() => {
    const fetchData = () => {
      Promise.all([
        base44.auth.me().then(setUser).catch(() => setUser(null)),
        base44.entities.WorkProfile.filter({ status: "active" }).then(setProfiles).catch(() => setProfiles([])),
      ]);
    };
    
    fetchData();
    
    // Refetch when window regains focus to pick up role changes
    window.addEventListener("focus", fetchData);
    return () => window.removeEventListener("focus", fetchData);
  }, []);

  if (!user) return null;

  const userProfiles = profiles.filter(p => (p.assigned_user_ids || []).includes(user.id));

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <User className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">{user.full_name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="font-semibold text-sm">{user.full_name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        
        {userProfiles.length > 0 && (
          <>
            <div className="px-2 py-2">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Roles & Profiles</p>
              <div className="flex flex-wrap gap-1">
                {userProfiles.length > 0 ? userProfiles.map(profile => (
                  <Badge key={profile.id} className="text-xs bg-primary/10 text-primary">
                    {profile.name}
                  </Badge>
                )) : (
                  <span className="text-xs text-muted-foreground">No profile assigned</span>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}