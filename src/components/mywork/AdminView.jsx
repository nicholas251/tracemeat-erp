import React from "react";
import { Card } from "@/components/ui/card";
import PageHeader from "@/components/shared/PageHeader";

export default function AdminView({ user }) {
  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Admin Dashboard"
        subtitle={`${user?.full_name} · Full System Access`}
      />
      <Card className="p-12 text-center">
        <p className="text-muted-foreground mb-4">You have full access to all system features. Use the sidebar to navigate to specific areas.</p>
        <p className="text-sm text-muted-foreground">Dashboard, Floor View, Production Orders, and more are available in the main menu.</p>
      </Card>
    </div>
  );
}