import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WaitingForAccess() {
  useEffect(() => {
    // Poll every 5 seconds to check if the user has been approved
    const interval = setInterval(async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (authed) {
          // Try to fetch user — if it succeeds they're approved, reload the app
          const user = await base44.auth.me();
          if (user) {
            window.location.href = "/";
          }
        }
      } catch {
        // Still pending, keep waiting
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mb-4 flex justify-center">
            <Clock className="w-12 h-12 text-amber-500 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Waiting for Access</h1>
          <p className="text-muted-foreground mb-6">
            Your profile has been created. An administrator will review your request and assign you work profiles shortly.
          </p>
          <div className="p-4 bg-muted/50 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground">This page will automatically update once your access is approved.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => base44.auth.logout('/signup')}>
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}