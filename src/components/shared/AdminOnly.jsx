import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

/**
 * Gates its children behind the platform account role (user.role === "admin").
 * This matches the platform's own built-in protection on the User entity, so the
 * screen and the data rules agree on who counts as an admin.
 */
export default function AdminOnly({ children }) {
  const { data: me, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  if (isLoading) {
    return <Card className="h-32 animate-pulse bg-muted" />;
  }

  if (me?.role !== "admin") {
    return (
      <Card className="p-12 text-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-1">Admins only</h3>
        <p className="text-sm text-muted-foreground">
          You don't have permission to view this page. Ask an administrator if you need access.
        </p>
      </Card>
    );
  }

  return children;
}