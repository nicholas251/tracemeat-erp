import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

const UserNotRegisteredError = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="mb-4 flex justify-center">
            <Clock className="w-12 h-12 text-amber-500 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Waiting for Access</h1>
          <p className="text-muted-foreground mb-6">
            Your account is pending administrator approval. You'll be able to access the app once your work profiles have been assigned.
          </p>
          <div className="p-4 bg-muted/50 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground">If you haven't submitted a profile request yet, please sign up first.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => base44.auth.logout('/signup')}>
              Sign up with a different account
            </Button>
            <Button variant="ghost" size="sm" onClick={() => base44.auth.logout()}>
              Log out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserNotRegisteredError;