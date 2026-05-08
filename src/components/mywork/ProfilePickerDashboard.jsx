import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";

export default function ProfilePickerDashboard({ user, profiles, onSelect }) {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <PageHeader
        title={`Welcome, ${user?.full_name?.split(" ")[0]}`}
        subtitle="Select a work profile to enter your dashboard"
      />

      <div className="grid gap-4 mt-2">
        {profiles.map(profile => (
          <Card
            key={profile.id}
            className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
            onClick={() => onSelect(profile.id)}
          >
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-base">{profile.name}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(profile.capability_keys || []).map(key => (
                    <Badge key={key} variant="outline" className="text-xs capitalize">
                      {key.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 ml-4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}