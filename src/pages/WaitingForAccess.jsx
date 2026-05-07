import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function WaitingForAccess() {
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
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">You'll receive a notification once your access is approved.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}