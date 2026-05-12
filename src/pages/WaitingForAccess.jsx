import React from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WaitingForAccess() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mb-4 flex justify-center">
            <Clock className="w-12 h-12 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Waiting for Access</h1>
          <p className="text-muted-foreground mb-6">
            Your profile has been created. An administrator will review your request and assign you work profiles shortly.
          </p>
          <div className="p-4 bg-muted/50 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground">You'll receive an email with a link to access the app once your account has been approved.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => base44.auth.logout('/signup')}>
            Log out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}